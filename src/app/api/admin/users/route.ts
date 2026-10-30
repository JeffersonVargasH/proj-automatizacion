import { NextResponse } from 'next/server';
import { allow, limits } from '@/lib/rate-limit';
import { audit, requireUser, supabaseAdmin } from '@/lib/supabase/server';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Lista de cuentas con cuÃ¡ntos negocios y publicaciones tiene cada una.
export async function GET() {
  const guard = await requireUser({ admin: true });
  if (!guard.ok) return guard.response;
  const { data, error } = await guard.caller.supabase
    .from('profiles')
    .select('id, email, full_name, role, status, created_at, businesses(count), publications(count)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'No se pudieron cargar las cuentas.' }, { status: 500 });
  const users = (data || []).map(({ businesses, publications, ...row }) => ({
    ...row,
    businesses: (businesses as { count: number }[])[0]?.count ?? 0,
    publications: (publications as { count: number }[])[0]?.count ?? 0,
  }));
  return NextResponse.json({ users });
}

// Invita emprendedores por correo: cada uno recibe un enlace para elegir su contraseÃ±a.
export async function POST(request: Request) {
  const guard = await requireUser({ admin: true });
  if (!guard.ok) return guard.response;
  const body = await request.json().catch(() => null);
  const rows: { name?: string; email?: string; business?: string }[] = Array.isArray(body?.users) ? body.users.slice(0, 200) : [];
  if (!rows.length) return NextResponse.json({ error: 'Agrega al menos un emprendedor.' }, { status: 400 });
  if (!allow(`invite:${guard.caller.user.id}`, limits.invite.max, limits.invite.windowMs)) return NextResponse.json({ error: 'Llegaste al lÃ­mite de invitaciones por hora.' }, { status: 429 });

  let admin;
  try { admin = supabaseAdmin(); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Falta configuraciÃ³n.' }, { status: 503 }); }
  const origin = new URL(request.url).origin;
  const invited: string[] = [];
  const skipped: { email: string; reason: string }[] = [];
  for (const row of rows) {
    const email = (row.email || '').trim().toLowerCase();
    const name = (row.name || '').trim().slice(0, 120);
    const business = (row.business || '').trim().slice(0, 120);
    if (!emailPattern.test(email) || !name || !business) { skipped.push({ email: email || '(sin correo)', reason: 'Faltan nombre, correo vÃ¡lido o negocio.' }); continue; }
    const { error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: name, business }, redirectTo: `${origin}/auth/callback?next=${encodeURIComponent('/?mode=welcome')}` });
    if (error) skipped.push({ email, reason: /already|registered|exists/i.test(error.message) ? 'Ya tiene una cuenta.' : 'No se pudo enviar la invitaciÃ³n.' });
    else invited.push(email);
  }
  if (invited.length) await audit(guard.caller, 'invited', 'users', undefined, { count: String(invited.length), email: invited.slice(0, 5).join(', ') });
  return NextResponse.json({ invited, skipped });
}

// Cambia el rol o suspende/reactiva una cuenta. La suspensiÃ³n tambiÃ©n bloquea el inicio de sesiÃ³n.
export async function PATCH(request: Request) {
  const guard = await requireUser({ admin: true });
  if (!guard.ok) return guard.response;
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  const role = body?.role === 'admin' || body?.role === 'entrepreneur' ? body.role : undefined;
  const status = body?.status === 'active' || body?.status === 'suspended' ? body.status : undefined;
  if (!id || (!role && !status)) return NextResponse.json({ error: 'Indica la cuenta y el cambio.' }, { status: 400 });
  if (id === guard.caller.user.id) return NextResponse.json({ error: 'No puedes cambiar tu propio rol ni suspender tu cuenta.' }, { status: 400 });

  let admin;
  try { admin = supabaseAdmin(); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Falta configuraciÃ³n.' }, { status: 503 }); }
  // Se actualiza con la sesiÃ³n del admin para que la auditorÃ­a quede a su nombre.
  const { error } = await guard.caller.supabase.from('profiles').update({ ...(role && { role }), ...(status && { status }) }).eq('id', id);
  if (error) return NextResponse.json({ error: 'No se pudo actualizar la cuenta.' }, { status: 500 });
  if (status) {
    const { error: banError } = await admin.auth.admin.updateUserById(id, { ban_duration: status === 'suspended' ? '876000h' : 'none' });
    if (banError) return NextResponse.json({ error: 'Se actualizÃ³ el perfil, pero no se pudo bloquear el inicio de sesiÃ³n.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

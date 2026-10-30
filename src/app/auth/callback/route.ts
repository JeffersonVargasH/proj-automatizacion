import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

const otpTypes: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

// Destino de los enlaces de Supabase: confirmar correo, invitación y recuperar contraseña.
// Acepta `token_hash` (plantillas de supabase/templates, sirve en cualquier navegador) y `code` (PKCE:
// solo funciona en el navegador donde se pidió el enlace, porque ahí quedó guardado el verificador).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get('next') || '/';
  // Solo rutas internas, para que el enlace no pueda redirigir a otro sitio.
  const target = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const fail = (reason: string) => NextResponse.redirect(new URL(`/?auth_error=${reason}`, url.origin));

  // Supabase ya rechazó el enlace antes de llegar aquí (vencido o usado).
  if (url.searchParams.get('error_code') === 'otp_expired' || url.searchParams.has('error')) return fail('expired');

  const supabase = await supabaseServer();
  if (tokenHash && type && otpTypes.includes(type)) {
    if ((await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error) return fail('expired');
  } else if (code) {
    // Si falla, casi siempre es porque se abrió en otro navegador. El correo ya quedó confirmado igual.
    if ((await supabase.auth.exchangeCodeForSession(code)).error) return fail(target.includes('mode=reset') ? 'browser_reset' : 'browser');
  } else return fail('expired');

  // Quien entra por invitación o recuperación debe elegir su contraseña.
  const destination = type === 'invite' ? '/?mode=welcome' : type === 'recovery' && target === '/' ? '/?mode=reset' : target;
  return NextResponse.redirect(new URL(destination, url.origin));
}

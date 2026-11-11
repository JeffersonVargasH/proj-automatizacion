import { NextResponse } from 'next/server';
import { billingSetupMessage, isBillingSchemaMissing } from '@/lib/billing';
import { scheduledPostFromRow, validateScheduleInput, type ScheduledPostRow } from '@/lib/publishing';
import { requireUser } from '@/lib/supabase/server';

const columns = 'id, publication_id, channel, scheduled_at, caption, status, created_at';
const setupError = () => NextResponse.json({ error: billingSetupMessage, setupRequired: true }, { status: 503 });

// Cola de publicaciones programadas de quien llama (RLS: solo ve las propias).
export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  const { data, error } = await guard.caller.supabase.from('scheduled_posts').select(columns).order('scheduled_at');
  if (error) return isBillingSchemaMissing(error) ? setupError() : NextResponse.json({ error: 'No se pudo cargar la programación.' }, { status: 500 });
  return NextResponse.json({ posts: (data as ScheduledPostRow[]).map(scheduledPostFromRow) });
}

// Programa una publicación propia. La base valida de nuevo la fecha, la red, la propiedad y el límite del plan.
export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  const validation = validateScheduleInput(await request.json().catch(() => ({})) ?? {});
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
  const { publicationId, channel, at, caption } = validation.value;
  const { data, error } = await guard.caller.supabase.rpc('schedule_post', { p_publication: publicationId, p_channel: channel, p_at: at, p_caption: caption });
  if (error) return isBillingSchemaMissing(error) ? setupError() : NextResponse.json({ error: error.message || 'No se pudo programar la publicación.' }, { status: 400 });
  return NextResponse.json({ post: scheduledPostFromRow(data as ScheduledPostRow) }, { status: 201 });
}

// Publicaciones programadas. Se guardan en `public.scheduled_posts` (Supabase) y quedan en cola
// como `pending_connection` hasta que se conecte la publicación automática en redes.
export const channels = ['instagram', 'facebook', 'whatsapp'] as const;
export type PublishingChannel = typeof channels[number];
export type ScheduledPostStatus = 'pending_connection' | 'cancelled' | 'published' | 'error';
export type ScheduledPost = {
  id: string;
  publicationId: string;
  channel: PublishingChannel;
  at: string;
  caption: string;
  status: ScheduledPostStatus;
  createdAt: string;
};

export type ScheduledPostRow = { id: string; publication_id: string; channel: string; scheduled_at: string; caption: string; status: string; created_at: string };

export function scheduledPostFromRow(row: ScheduledPostRow): ScheduledPost {
  const statuses: ScheduledPostStatus[] = ['pending_connection', 'cancelled', 'published', 'error'];
  return {
    id: row.id,
    publicationId: row.publication_id,
    channel: channels.find(channel => channel === row.channel) ?? 'instagram',
    at: row.scheduled_at,
    caption: row.caption,
    status: statuses.find(status => status === row.status) ?? 'pending_connection',
    createdAt: row.created_at,
  };
}

/** Validación previa en el servidor (la base vuelve a validar todo dentro de `schedule_post`). */
export function validateScheduleInput(input: { designId?: unknown; channel?: unknown; at?: unknown; caption?: unknown }, now = Date.now()):
  { ok: true; value: { publicationId: string; channel: PublishingChannel; at: string; caption: string } } | { ok: false; error: string } {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof input.designId !== 'string' || !uuid.test(input.designId)) return { ok: false, error: 'Falta la publicación que quieres programar.' };
  if (typeof input.channel !== 'string' || !channels.includes(input.channel as PublishingChannel)) return { ok: false, error: 'Elige Instagram, Facebook o WhatsApp.' };
  const time = typeof input.at === 'string' ? new Date(input.at).getTime() : NaN;
  if (!Number.isFinite(time) || time <= now) return { ok: false, error: 'La fecha debe estar en el futuro.' };
  const caption = typeof input.caption === 'string' ? input.caption.slice(0, 2200) : '';
  return { ok: true, value: { publicationId: input.designId, channel: input.channel as PublishingChannel, at: new Date(time).toISOString(), caption } };
}

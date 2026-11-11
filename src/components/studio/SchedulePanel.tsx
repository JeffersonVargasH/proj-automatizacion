'use client';

// "Programar publicación": guarda una fecha en la cola del usuario (Supabase, tabla scheduled_posts).
// Queda pendiente hasta que se conecte la publicación automática en redes. Traído de avance-hasta-3.6.
import { useState } from 'react';
import { EventAvailable } from '@mui/icons-material';
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { captionFor, type Design, type Network, networks, outputs } from '@/lib/studio';
import { Panel } from './Fields';

const dateTimeLocal = (iso: string) => { const date = new Date(iso); return Number.isFinite(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : ''; };
const readable = (iso: string) => new Date(iso).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' });

export function SchedulePanel({ design: d, active, update, notify }: { design: Design; active: Network; update: (patch: Partial<Design>) => void; notify: (message: string, error?: boolean) => void }) {
  const [channel, setChannel] = useState<Network>(active);
  const [date, setDate] = useState(d.schedule ? dateTimeLocal(d.schedule.at) : '');
  const [busy, setBusy] = useState(false);
  const scheduled = d.schedule && d.schedule.status === 'pending_connection' ? d.schedule : null;
  const label = (value: string) => networks[value as Network]?.label ?? value;

  async function save() {
    const time = new Date(date).getTime();
    if (!date || !Number.isFinite(time) || time <= Date.now()) { notify('Elige una fecha y hora futuras.', true); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/publishing/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ designId: d.id, channel, at: new Date(time).toISOString(), caption: captionFor(d, channel) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo programar la publicación.');
      update({ schedule: { id: data.post.id, channel: data.post.channel, at: data.post.at, status: data.post.status } });
      notify('Publicación en la cola. Quedará pendiente hasta conectar tus redes.');
    } catch (reason) { notify(reason instanceof Error ? reason.message : 'No se pudo programar la publicación.', true); }
    finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true);
    try {
      // Las fechas antiguas (antes de la cola) no tienen id: solo se quitan del diseño.
      if (d.schedule?.id) {
        const response = await fetch(`/api/publishing/schedule/${encodeURIComponent(d.schedule.id)}`, { method: 'DELETE' });
        if (!response.ok && response.status !== 404) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'No se pudo quitar la fecha.'); }
      }
      update({ schedule: null }); setDate('');
      notify('Publicación retirada de la cola.');
    } catch (reason) { notify(reason instanceof Error ? reason.message : 'No se pudo quitar la fecha.', true); }
    finally { setBusy(false); }
  }

  return <Panel title="Programar publicación"><Stack spacing={1.5}>
    <Alert severity="info" sx={{ py: 0 }}>La publicación automática aún no está conectada: la fecha queda en tu cola para cuando se active.</Alert>
    {scheduled
      ? <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
        <EventAvailable color="primary" />
        <Typography sx={{ flex: 1, minWidth: 180 }}><strong>{label(scheduled.channel)}</strong> · {readable(scheduled.at)}</Typography>
        <Button variant="outlined" color="inherit" disabled={busy} onClick={() => void remove()}>Quitar fecha</Button>
      </Stack>
      : <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        <TextField select size="small" label="Red" value={channel} onChange={event => setChannel(event.target.value as Network)}>{outputs.map(network => <MenuItem key={network} value={network}>{networks[network].label}</MenuItem>)}</TextField>
        <TextField size="small" type="datetime-local" label="Fecha y hora" value={date} onChange={event => setDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <Button variant="contained" disabled={busy || !date} onClick={() => void save()} sx={{ gridColumn: { sm: '1 / -1' } }}>{busy ? 'Guardando…' : 'Programar'}</Button>
      </Box>}
  </Stack></Panel>;
}

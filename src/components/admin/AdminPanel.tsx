'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowForward, Block, Business, FileUpload, History, Logout, PeopleOutline, PlayCircleOutline, SpaceDashboard } from '@mui/icons-material';
import { Alert, Box, Button, Chip, Divider, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import { ClicLogo } from '@/components/brand/ClicLogo';
import { Activity, AppUser, describeActivity, recentActivity, UserRole } from '@/lib/auth';
import { supabaseBrowser } from '@/lib/supabase/client';

type Row = { id: string; email: string; full_name: string; role: UserRole; status: 'active' | 'suspended'; created_at: string; businesses: number; publications: number };
type Invite = { name: string; email: string; business: string };

async function api<T>(method: string, body?: unknown): Promise<T> {
  const response = await fetch('/api/admin/users', { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la acción.');
  return data as T;
}

/** Filas "nombre,correo,negocio" (la primera puede ser el encabezado). */
export function parseInvites(csv: string): Invite[] {
  const rows = csv.split(/\r?\n/).map(row => row.trim()).filter(Boolean);
  const start = rows[0] && /correo|email/i.test(rows[0]) ? 1 : 0;
  return rows.slice(start).map(row => { const [name = '', email = '', business = ''] = row.split(',').map(value => value.trim().replace(/^"|"$/g, '')); return { name, email, business }; });
}

const date = (value: string) => new Date(value).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' });

export default function AdminPanel({ user, onOpenStudio, onLogout }: { user: AppUser; onOpenStudio: () => void; onLogout: () => void }) {
  const [users, setUsers] = useState<Row[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [business, setBusiness] = useState('');
  const [csv, setCsv] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [list, events] = await Promise.all([api<{ users: Row[] }>('GET'), recentActivity(supabaseBrowser(), 25)]);
      setUsers(list.users); setActivity(events);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las cuentas.'); }
  }, []);
  useEffect(() => { queueMicrotask(() => void refresh()); }, [refresh]);

  async function invite(list: Invite[]) {
    setNotice(''); setError(''); setBusy(true);
    try {
      const result = await api<{ invited: string[]; skipped: { email: string; reason: string }[] }>('POST', { users: list });
      const skipped = result.skipped.map(item => `${item.email}: ${item.reason}`).join(' · ');
      setNotice(`${result.invited.length} invitación(es) enviada(s). Cada persona recibirá un correo para elegir su contraseña.${skipped ? ` Omitidas: ${skipped}` : ''}`);
      await refresh();
      return result.invited.length > 0;
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo invitar.'); return false; }
    finally { setBusy(false); }
  }
  async function addOne(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (await invite([{ name, email, business }])) { setName(''); setEmail(''); setBusiness(''); } }
  async function change(row: Row, patch: Partial<Pick<Row, 'role' | 'status'>>) {
    setNotice(''); setError('');
    try { await api('PATCH', { id: row.id, ...patch }); setNotice(`Cuenta de ${row.email} actualizada.`); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo actualizar.'); }
  }

  const names = useMemo(() => new Map(users.map(item => [item.id, item.full_name || item.email])), [users]);
  const stats = [
    { icon: PeopleOutline, value: users.filter(item => item.role === 'entrepreneur').length, label: 'Emprendedores' },
    { icon: Business, value: users.reduce((sum, item) => sum + item.businesses, 0), label: 'Negocios' },
    { icon: SpaceDashboard, value: users.reduce((sum, item) => sum + item.publications, 0), label: 'Publicaciones' },
    { icon: Block, value: users.filter(item => item.status === 'suspended').length, label: 'Suspendidas' },
  ];

  return <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}><Box sx={{ maxWidth: 1360, mx: 'auto', px: { xs: 2, sm: 4, lg: 6 }, py: { xs: 2, sm: 4 } }}>
    <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="center"><ClicLogo size={32} /><Stack direction="row" spacing={1} alignItems="center"><Stack alignItems="flex-end"><Typography variant="body2" fontWeight={800}>{user.name}</Typography><Typography variant="caption" color="text.secondary">Administrador</Typography></Stack><Button onClick={onLogout} color="inherit" startIcon={<Logout />}>Salir</Button></Stack></Stack>
    <Divider sx={{ my: 3 }} />
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ md: 'flex-end' }}>
      <Box><Typography variant="overline" color="primary.dark" sx={{ letterSpacing: '.12em', fontWeight: 900 }}>Panel de administración</Typography><Typography variant="h1">Cuentas de los emprendedores</Typography><Typography color="text.secondary" sx={{ mt: .75 }}>Invita, cambia permisos o suspende accesos. Todo queda registrado en la auditoría.</Typography></Box>
      <Button variant="contained" startIcon={<SpaceDashboard />} onClick={onOpenStudio}>Abrir mi estudio</Button>
    </Stack>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.5, mt: 3 }}>{stats.map(({ icon: Icon, value, label }) => <Paper key={label} variant="outlined" sx={{ p: 2, borderRadius: 2 }}><Stack direction="row" spacing={1.5} alignItems="center"><Box sx={{ color: 'primary.main' }}><Icon /></Box><Box><Typography variant="h2">{value}</Typography><Typography variant="caption" color="text.secondary">{label}</Typography></Box></Stack></Paper>)}</Box>
    {(notice || error) && <Alert severity={error ? 'error' : 'success'} sx={{ mt: 2 }} onClose={() => { setNotice(''); setError(''); }}>{error || notice}</Alert>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2, mt: 2 }}>
      <Paper component="form" onSubmit={addOne} variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}><PeopleOutline color="primary" /><Box><Typography variant="h2" fontSize={21}>Invitar a un emprendedor</Typography><Typography variant="body2" color="text.secondary">Le llegará un correo para crear su contraseña.</Typography></Box></Stack>
        <Stack spacing={1.75}><TextField label="Nombre" value={name} onChange={event => setName(event.target.value)} required /><TextField label="Correo" type="email" value={email} onChange={event => setEmail(event.target.value)} required /><TextField label="Negocio" value={business} onChange={event => setBusiness(event.target.value)} required /><Button type="submit" variant="contained" disabled={busy} endIcon={<ArrowForward />}>Enviar invitación</Button></Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}><FileUpload color="primary" /><Box><Typography variant="h2" fontSize={21}>Invitar en bloque</Typography><Typography variant="body2" color="text.secondary">Una fila por emprendedor: nombre, correo, negocio.</Typography></Box></Stack>
        <Stack spacing={1.75}><TextField multiline minRows={6} value={csv} onChange={event => setCsv(event.target.value)} placeholder={'nombre,correo,negocio\nAna Pérez,ana@empresa.com,Mi negocio'} /><Button variant="contained" disabled={busy || !csv.trim()} onClick={async () => { if (await invite(parseInvites(csv))) setCsv(''); }} endIcon={<ArrowForward />}>Enviar invitaciones</Button></Stack>
      </Paper>
    </Box>
    <Paper variant="outlined" sx={{ mt: 2, borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ p: { xs: 2, sm: 3 }, pb: 1 }}><Typography variant="h2" fontSize={21}>Cuentas</Typography></Box>
      <TableContainer sx={{ overflowX: 'auto' }}><Table size="small" sx={{ minWidth: 820 }}>
        <TableHead><TableRow><TableCell>Nombre</TableCell><TableCell>Correo</TableCell><TableCell align="right">Negocios</TableCell><TableCell align="right">Publicaciones</TableCell><TableCell>Rol</TableCell><TableCell>Estado</TableCell><TableCell /></TableRow></TableHead>
        <TableBody>{users.map(row => { const self = row.id === user.id; return <TableRow key={row.id}>
          <TableCell><Typography variant="body2" fontWeight={700}>{row.full_name || '—'}</Typography><Typography variant="caption" color="text.secondary">Desde {date(row.created_at)}</Typography></TableCell>
          <TableCell>{row.email}</TableCell>
          <TableCell align="right">{row.businesses}</TableCell>
          <TableCell align="right">{row.publications}</TableCell>
          <TableCell><Select size="small" value={row.role} disabled={self} onChange={event => void change(row, { role: event.target.value as UserRole })}><MenuItem value="entrepreneur">Emprendedor</MenuItem><MenuItem value="admin">Administrador</MenuItem></Select></TableCell>
          <TableCell><Chip size="small" label={row.status === 'active' ? 'Activa' : 'Suspendida'} color={row.status === 'active' ? 'success' : 'warning'} variant="outlined" /></TableCell>
          <TableCell align="right">{!self && <Tooltip title={row.status === 'active' ? 'Bloquea el acceso y sus datos' : 'Devuelve el acceso'}><Button size="small" color={row.status === 'active' ? 'warning' : 'success'} startIcon={row.status === 'active' ? <Block /> : <PlayCircleOutline />} onClick={() => void change(row, { status: row.status === 'active' ? 'suspended' : 'active' })}>{row.status === 'active' ? 'Suspender' : 'Reactivar'}</Button></Tooltip>}</TableCell>
        </TableRow>; })}</TableBody>
      </Table></TableContainer>
    </Paper>
    <Paper variant="outlined" sx={{ mt: 2, p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}><History color="primary" /><Typography variant="h2" fontSize={21}>Auditoría reciente</Typography></Stack>
      {activity.length ? <Stack divider={<Divider flexItem />} spacing={1}>{activity.map(item => <Stack key={item.id} direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={.5}><Typography variant="body2"><b>{item.actor_id ? names.get(item.actor_id) || 'Usuario' : 'Sistema'}</b> · {describeActivity(item)}</Typography><Typography variant="caption" color="text.secondary">{date(item.created_at)}</Typography></Stack>)}</Stack> : <Typography variant="body2" color="text.secondary">Aún no hay actividad.</Typography>}
    </Paper>
  </Box></Box>;
}

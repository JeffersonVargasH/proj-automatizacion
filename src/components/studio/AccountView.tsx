'use client';

import { FormEvent, useEffect, useState } from 'react';
import { DeleteOutline, History, LockOutlined, Logout, PersonOutline, Storefront } from '@mui/icons-material';
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { Activity, AppUser, authMessage, BusinessSummary, describeActivity, passwordProblem, recentActivity } from '@/lib/auth';
import { supabaseBrowser } from '@/lib/supabase/client';

type Props = {
  user: AppUser;
  businesses: BusinessSummary[];
  activeBusinessId: string;
  onUserChange: (user: AppUser) => void;
  onDeleteBusiness: (id: string) => Promise<void>;
  notify: (message: string, error?: boolean) => void;
  onLogout: () => void;
};

function Section({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}><Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}><Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box><Box><Typography variant="h2" fontSize={20}>{title}</Typography><Typography variant="body2" color="text.secondary">{subtitle}</Typography></Box></Stack>{children}</Paper>;
}

export function AccountView({ user, businesses, activeBusinessId, onUserChange, onDeleteBusiness, notify, onLogout }: Props) {
  const [name, setName] = useState(user.name);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<BusinessSummary | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  useEffect(() => { void recentActivity(supabaseBrowser(), 10, user.id).then(setActivity); }, [user.id]);

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const clean = name.trim().slice(0, 120);
    const { error } = await supabaseBrowser().from('profiles').update({ full_name: clean }).eq('id', user.id);
    setBusy(false);
    if (error) notify('No se pudo guardar tu nombre.', true); else { onUserChange({ ...user, name: clean || user.email.split('@')[0] }); notify('Datos de tu cuenta guardados.'); }
  }
  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = passwordProblem(password) || (password !== confirm ? 'Las contraseñas no coinciden.' : '');
    if (problem) { notify(problem, true); return; }
    setBusy(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password });
    setBusy(false);
    if (error) notify(authMessage(error.message), true); else { setPassword(''); setConfirm(''); notify('Contraseña actualizada.'); }
  }
  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    try { await onDeleteBusiness(removing.id); notify(`Se eliminó «${removing.name}» con sus publicaciones.`); }
    catch (error) { notify(error instanceof Error ? error.message : 'No se pudo eliminar el negocio.', true); }
    finally { setBusy(false); setRemoving(null); }
  }

  return <Stack spacing={2.5}>
    <Box><Typography variant="overline" color="primary.dark" sx={{ letterSpacing: '.12em', fontWeight: 900 }}>Tu acceso</Typography><Typography variant="h1">Mi cuenta</Typography><Typography color="text.secondary">Tus datos personales, tu contraseña y tus negocios.</Typography></Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '1fr 1fr' }, gap: 2 }}>
      <Section icon={<PersonOutline />} title="Datos personales" subtitle="Así te verá el equipo de Clic.">
        <Stack component="form" onSubmit={saveName} spacing={1.75}>
          <TextField label="Nombre" value={name} onChange={event => setName(event.target.value)} required />
          <TextField label="Correo" value={user.email} disabled helperText="Para cambiar el correo, escribe al administrador." />
          <Stack direction="row" spacing={1} alignItems="center"><Chip size="small" label={user.role === 'admin' ? 'Administrador' : 'Emprendedor'} color="primary" variant="outlined" />{user.createdAt && <Typography variant="caption" color="text.secondary">Cuenta creada el {new Date(user.createdAt).toLocaleDateString('es-PE')}</Typography>}</Stack>
          <Button type="submit" variant="contained" disabled={busy || name.trim() === user.name} sx={{ alignSelf: 'flex-start' }}>Guardar</Button>
        </Stack>
      </Section>
      <Section icon={<LockOutlined />} title="Contraseña" subtitle="Mínimo 8 caracteres, con letras y números.">
        <Stack component="form" onSubmit={savePassword} spacing={1.75}>
          <TextField label="Nueva contraseña" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} required />
          <TextField label="Repite la contraseña" type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} required />
          <Button type="submit" variant="contained" disabled={busy || !password} sx={{ alignSelf: 'flex-start' }}>Cambiar contraseña</Button>
        </Stack>
      </Section>
      <Section icon={<Storefront />} title="Mis negocios" subtitle="Cambia de negocio desde el menú lateral; cada uno guarda su marca y publicaciones.">
        <Stack divider={<Divider flexItem />} spacing={1}>{businesses.map(item => <Stack key={item.id} direction="row" alignItems="center" spacing={1}><Typography sx={{ flex: 1 }} fontWeight={item.id === activeBusinessId ? 800 : 500} noWrap>{item.name || 'Mi negocio'}</Typography>{item.id === activeBusinessId && <Chip size="small" label="Abierto ahora" />}<Tooltip title={businesses.length === 1 ? 'Necesitas al menos un negocio' : 'Eliminar negocio'}><span><IconButton size="small" color="error" disabled={businesses.length === 1} onClick={() => setRemoving(item)} aria-label={`Eliminar ${item.name}`}><DeleteOutline /></IconButton></span></Tooltip></Stack>)}</Stack>
      </Section>
      <Section icon={<History />} title="Actividad reciente" subtitle="Lo último que se hizo con tu cuenta.">
        {activity.length ? <Stack spacing={1}>{activity.map(item => <Stack key={item.id} direction="row" justifyContent="space-between" spacing={1}><Typography variant="body2">{describeActivity(item)}</Typography><Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{new Date(item.created_at).toLocaleDateString('es-PE')}</Typography></Stack>)}</Stack> : <Typography variant="body2" color="text.secondary">Aún no hay actividad.</Typography>}
      </Section>
    </Box>
    <Button color="inherit" startIcon={<Logout />} onClick={onLogout} sx={{ alignSelf: 'flex-start' }}>Cerrar sesión</Button>
    <Dialog open={!!removing} onClose={() => setRemoving(null)} fullWidth maxWidth="xs"><DialogTitle>¿Eliminar «{removing?.name}»?</DialogTitle><DialogContent><Typography color="text.secondary">Se borrarán su marca y todas sus publicaciones. Esta acción no se puede deshacer.</Typography></DialogContent><DialogActions sx={{ p: 2.5, pt: 0 }}><Button onClick={() => setRemoving(null)}>Cancelar</Button><Button variant="contained" color="error" disabled={busy} onClick={() => void confirmRemove()}>Eliminar negocio</Button></DialogActions></Dialog>
  </Stack>;
}

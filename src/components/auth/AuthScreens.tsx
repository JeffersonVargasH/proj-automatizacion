'use client';

import { FormEvent, ReactNode, useState } from 'react';
import { ArrowForward, Business, LockOutlined, MailOutline, PersonOutline } from '@mui/icons-material';
import { Alert, Box, Button, Divider, Link, Paper, Stack, TextField, Typography } from '@mui/material';
import { ClicLogo } from '@/components/brand/ClicLogo';
import { authMessage, passwordProblem } from '@/lib/auth';
import { supabaseBrowser } from '@/lib/supabase/client';

export type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

const fieldSx = { '& .MuiOutlinedInput-root': { minHeight: 50, borderRadius: '12px', bgcolor: '#FFFFFF', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#D3DAE5' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#AFC0E8' }, '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(47,91,255,.10)' }, '&.Mui-focused .MuiSvgIcon-root': { color: '#2F5BFF' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#2F5BFF', borderWidth: 1.5 } }, '& .MuiInputBase-input': { fontSize: '0.92rem', paddingBlock: 1.4 } };
const buttonSx = { width: '100%', minHeight: 50, borderRadius: '12px', fontSize: '0.94rem', fontWeight: 650 };

const highlights = ['Sube la foto de tu producto', 'Recibe el diseño con tus colores', 'Publica en Instagram, Facebook y WhatsApp'];

/** Panel de marca a la izquierda (solo escritorio) y formulario a la derecha. */
export function AuthCard({ title, subtitle, children }: { title?: string; subtitle: string; children: ReactNode }) {
  return <Box sx={{ minHeight: '100dvh', display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.05fr) minmax(0, 1fr)' }, bgcolor: '#F7F8FA' }}>
    <Box component="aside" sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', justifyContent: 'space-between', p: { md: 5, lg: 7 }, color: '#FFFFFF', background: 'radial-gradient(circle at 85% 15%, rgba(47,91,255,.45), transparent 45%), radial-gradient(circle at 10% 95%, rgba(46,139,255,.25), transparent 40%), #0B1220' }}>
      <ClicLogo size={40} wordmark inverse />
      <Box sx={{ maxWidth: 460 }}>
        <Typography sx={{ fontSize: { md: '2.4rem', lg: '2.9rem' }, fontWeight: 700, lineHeight: 1.08, letterSpacing: '-0.04em' }}>Tu contenido,<br /><Box component="span" sx={{ color: '#5B8CFF' }}>resuelto con claridad.</Box></Typography>
        <Typography sx={{ mt: 2, color: 'rgba(255,255,255,.72)', fontSize: '1.02rem', lineHeight: 1.6 }}>Convierte tus fotos en publicaciones listas para compartir, con la marca de tu negocio.</Typography>
        <Stack spacing={1.25} sx={{ mt: 3.5 }}>{highlights.map((item, index) => <Stack key={item} direction="row" spacing={1.5} alignItems="center"><Box sx={{ width: 28, height: 28, borderRadius: '9px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)', fontSize: 13, fontWeight: 700 }}>{index + 1}</Box><Typography sx={{ color: 'rgba(255,255,255,.88)', fontSize: '.95rem' }}>{item}</Typography></Stack>)}</Stack>
      </Box>
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.5)' }}>Desarrollado por ABC</Typography>
    </Box>
    <Box component="main" sx={{ display: 'grid', placeItems: 'center', p: { xs: 2.5, sm: 4 } }}>
      <Box sx={{ width: '100%', maxWidth: 400, animation: 'authIn 240ms cubic-bezier(.22,1,.36,1) both', '@keyframes authIn': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'none' } } }}>
        <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'center', mb: 3 }}><ClicLogo size={36} wordmark /></Box>
        <Typography component="h1" sx={{ fontSize: { xs: '1.6rem', sm: '1.85rem' }, fontWeight: 700, letterSpacing: '-0.035em', color: '#101418', textAlign: { xs: 'center', md: 'left' } }}>{title || 'Bienvenido de nuevo'}</Typography>
        <Typography variant="body2" sx={{ mt: .75, lineHeight: 1.55, color: '#5B6474', textAlign: { xs: 'center', md: 'left' } }}>{subtitle}</Typography>
        <Paper variant="outlined" sx={{ mt: 3, p: { xs: 2.25, sm: 3 }, borderRadius: '20px', boxShadow: '0 1px 2px rgba(16,20,24,.04)' }}>{children}</Paper>
        <Typography variant="caption" sx={{ display: { xs: 'block', md: 'none' }, mt: 2, textAlign: 'center', color: '#8B95A7' }}>Desarrollado por ABC</Typography>
      </Box>
    </Box>
  </Box>;
}

function Field({ id, label, icon, ...props }: { id: string; label: string; icon: ReactNode; type?: string; value: string; onChange: (value: string) => void; autoComplete?: string; placeholder?: string; helperText?: string }) {
  return <Box><Typography component="label" htmlFor={id} sx={{ display: 'block', mb: .65, fontSize: '0.79rem', fontWeight: 500, color: '#5B6474' }}>{label}</Typography>
    <TextField id={id} type={props.type} value={props.value} onChange={event => props.onChange(event.target.value)} placeholder={props.placeholder} autoComplete={props.autoComplete} helperText={props.helperText} required fullWidth sx={fieldSx} slotProps={{ input: { startAdornment: <Box sx={{ mr: 1, display: 'flex', color: '#8B95A7', '& svg': { fontSize: 19 } }}>{icon}</Box> } }} /></Box>;
}

const origin = () => window.location.origin;
// El botón aparece solo cuando Google está activado en Supabase; si no, llevaría a una página de error.
const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH === 'true';

function GoogleMark() {
  return <Box component="svg" viewBox="0 0 48 48" aria-hidden sx={{ width: 20, height: 20 }}>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </Box>;
}

/** Inicio de sesión, registro y "olvidé mi contraseña" en una sola tarjeta. */
export function AuthScreen({ initialError = '', initialNotice = '' }: { initialError?: string; initialNotice?: string }) {
  const [mode, setMode] = useState<Exclude<AuthMode, 'reset'>>('login');
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState(initialNotice);
  const [busy, setBusy] = useState(false);
  const go = (next: typeof mode) => { setMode(next); setError(''); setNotice(''); };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setNotice('');
    const supabase = supabaseBrowser();
    const cleanEmail = email.trim().toLowerCase();
    if (mode === 'register') {
      const problem = passwordProblem(password);
      if (problem) { setError(problem); return; }
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error: failure } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (failure) setError(authMessage(failure.message));
        else void supabase.rpc('log_activity', { p_action: 'login', p_entity: 'session' });
      } else if (mode === 'register') {
        const { data, error: failure } = await supabase.auth.signUp({ email: cleanEmail, password, options: { data: { full_name: name.trim(), business: business.trim() }, emailRedirectTo: `${origin()}/auth/callback` } });
        if (failure) setError(authMessage(failure.message));
        // Supabase no avisa si el correo ya existe (para no revelar cuentas): devuelve un usuario sin identidades.
        else if (data.user && !data.user.identities?.length) setError(authMessage('already registered'));
        else if (!data.session) { setNotice(`Te enviamos un correo a ${cleanEmail}. Ábrelo para confirmar tu cuenta y luego inicia sesión.`); setMode('login'); setPassword(''); }
      } else {
        const { error: failure } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo: `${origin()}/auth/callback?next=${encodeURIComponent('/?mode=reset')}` });
        if (failure) setError(authMessage(failure.message));
        else setNotice('Si ese correo tiene una cuenta, te llegará un enlace para crear una nueva contraseña. Revisa también la carpeta de spam.');
      }
    } finally { setBusy(false); }
  }

  async function withGoogle() {
    setError(''); setNotice(''); setBusy(true);
    // Google devuelve a /auth/callback con un código; el perfil y el primer negocio se crean solos en la base de datos.
    const { error: failure } = await supabaseBrowser().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin()}/auth/callback?provider=google`, queryParams: { prompt: 'select_account' } } });
    if (failure) { setError(authMessage(failure.message)); setBusy(false); }
  }

  const copy = {
    login: { subtitle: 'Inicia sesión en tu espacio creativo.', action: 'Ingresar' },
    register: { subtitle: 'Crea tu cuenta gratis y prepara tu primera publicación en minutos.', action: 'Crear mi cuenta' },
    forgot: { subtitle: 'Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.', action: 'Enviar enlace' },
  }[mode];

  return <AuthCard subtitle={copy.subtitle}>
    <Box component="form" onSubmit={submit}><Stack spacing={1.75}>
      {googleEnabled && mode !== 'forgot' && <>
        <Button type="button" variant="outlined" size="large" disabled={busy} onClick={() => void withGoogle()} startIcon={<GoogleMark />} sx={{ ...buttonSx, color: '#101418', borderColor: '#D3DAE5', bgcolor: '#FFFFFF', '&:hover': { borderColor: '#AFC0E8', bgcolor: '#F7F8FA' } }}>Continuar con Google</Button>
        <Divider sx={{ color: '#8B95A7', fontSize: '0.78rem', '&::before, &::after': { borderColor: '#E6EBF2' } }}>o con tu correo</Divider>
      </>}
      {mode === 'register' && <>
        <Field id="auth-name" label="Tu nombre" icon={<PersonOutline />} value={name} onChange={setName} autoComplete="name" placeholder="Nombre y apellido" />
        <Field id="auth-business" label="Nombre de tu negocio" icon={<Business />} value={business} onChange={setBusiness} autoComplete="organization" placeholder="Ej. Panadería Rosita" />
      </>}
      <Field id="auth-email" label="Correo electrónico" type="email" icon={<MailOutline />} value={email} onChange={setEmail} autoComplete="email" placeholder="tu@empresa.com" />
      {mode !== 'forgot' && <Field id="auth-password" label="Contraseña" type="password" icon={<LockOutlined />} value={password} onChange={setPassword} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder="••••••••" helperText={mode === 'register' ? 'Mínimo 8 caracteres, con letras y números.' : undefined} />}
      {mode === 'login' && <Link component="button" type="button" onClick={() => go('forgot')} sx={{ alignSelf: 'flex-end', fontSize: '0.8rem', fontWeight: 600 }}>¿Olvidaste tu contraseña?</Link>}
      {error && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}
      <Button type="submit" variant="contained" size="large" disabled={busy} endIcon={<ArrowForward />} sx={buttonSx}>{busy ? 'Un momento…' : copy.action}</Button>
      <Typography variant="body2" sx={{ textAlign: 'center', color: '#5B6474' }}>
        {mode === 'login' ? <>¿Aún no tienes cuenta? <Link component="button" type="button" onClick={() => go('register')} fontWeight={700}>Regístrate</Link></> : <Link component="button" type="button" onClick={() => go('login')} fontWeight={700}>Volver a iniciar sesión</Link>}
      </Typography>
    </Stack></Box>
  </AuthCard>;
}

/** Tras abrir el enlace de recuperación o de invitación: elegir la contraseña. */
export function ResetPasswordScreen({ invited, onDone }: { invited: boolean; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = passwordProblem(password) || (password !== confirm ? 'Las contraseñas no coinciden.' : '');
    if (problem) { setError(problem); return; }
    setBusy(true);
    const { error: failure } = await supabaseBrowser().auth.updateUser({ password });
    setBusy(false);
    if (failure) setError(authMessage(failure.message)); else onDone();
  }
  return <AuthCard title={invited ? 'Bienvenido a Clic' : 'Nueva contraseña'} subtitle={invited ? 'Elige la contraseña con la que entrarás a tu cuenta.' : 'Escribe tu nueva contraseña. La usarás desde ahora para ingresar.'}>
    <Box component="form" onSubmit={submit}><Stack spacing={1.75}>
      <Field id="reset-password" label="Nueva contraseña" type="password" icon={<LockOutlined />} value={password} onChange={setPassword} autoComplete="new-password" helperText="Mínimo 8 caracteres, con letras y números." />
      <Field id="reset-confirm" label="Repite la contraseña" type="password" icon={<LockOutlined />} value={confirm} onChange={setConfirm} autoComplete="new-password" />
      {error && <Alert severity="error">{error}</Alert>}
      <Button type="submit" variant="contained" size="large" disabled={busy} endIcon={<ArrowForward />} sx={buttonSx}>{busy ? 'Guardando…' : 'Guardar contraseña'}</Button>
    </Stack></Box>
  </AuthCard>;
}

export function MessageScreen({ title, message, action }: { title: string; message: string; action?: { label: string; onClick: () => void } }) {
  return <AuthCard title={title} subtitle={message}>{action && <Button variant="outlined" fullWidth onClick={action.onClick} sx={{ minHeight: 48, borderRadius: '13px' }}>{action.label}</Button>}</AuthCard>;
}

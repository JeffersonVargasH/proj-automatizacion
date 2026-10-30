'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import AdminPanel from '@/components/admin/AdminPanel';
import Studio from '@/components/studio/Studio';
import { AppUser, BusinessSummary, createBusiness, deleteBusiness, listBusinesses, loadProfile, rememberBusiness, rememberedBusiness } from '@/lib/auth';
import { supabaseBrowser } from '@/lib/supabase/client';
import { supabaseConfigured } from '@/lib/supabase/env';
import { storage } from '@/lib/studio-storage';
import { AuthScreen, MessageScreen, ResetPasswordScreen } from './AuthScreens';

type Account = { user: AppUser; businesses: BusinessSummary[]; activeId: string };

function Loading({ text = 'Preparando tu espacio…' }: { text?: string }) {
  return <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', bgcolor: 'background.default' }}><Typography color="text.secondary">{text}</Typography></Box>;
}

const linkMessages: Record<string, string> = {
  browser: 'Tu correo ya está confirmado. Inicia sesión con tu correo y contraseña.',
  browser_reset: 'Abre el enlace en el mismo navegador donde pediste el cambio, o vuelve a pedirlo desde aquí.',
  expired: 'El enlace venció o ya se usó. Si ya confirmaste tu correo, inicia sesión; si no, pide uno nuevo.',
  google: 'No se pudo entrar con Google. Inténtalo de nuevo o ingresa con tu correo.',
};

/** Lee y limpia de la URL las señales que dejan los enlaces de correo. */
function readUrlSignals() {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const signals = {
    mode: url.searchParams.get('mode'),
    authError: url.searchParams.get('auth_error') || (hash.has('error') ? 'expired' : null),
    // Plantillas de correo por defecto de Supabase: la sesión llega en el fragmento (#access_token=…).
    tokens: hash.get('access_token') && hash.get('refresh_token') ? { access_token: hash.get('access_token')!, refresh_token: hash.get('refresh_token')! } : null,
    hashType: hash.get('type'),
  };
  if (signals.mode || signals.authError || url.hash) window.history.replaceState(null, '', url.pathname);
  return signals;
}

export default function AuthGate() {
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [suspended, setSuspended] = useState(false);
  const [passwordMode, setPasswordMode] = useState<'reset' | 'welcome' | null>(null);
  const [linkError, setLinkError] = useState('');
  const [adminStudio, setAdminStudio] = useState(false);

  const loadedId = useRef<string | null>(null);

  const loadAccount = useCallback(async (userId: string) => {
    loadedId.current = userId;
    const supabase = supabaseBrowser();
    const user = await loadProfile(supabase, userId);
    if (!user) { setAccount(null); return; }
    if (user.status !== 'active') { setSuspended(true); setAccount(null); return; }
    let businesses = await listBusinesses(supabase, user.id);
    if (!businesses.length) businesses = [await createBusiness(supabase, user.id, 'Mi negocio')];
    const remembered = rememberedBusiness(user.id);
    const activeId = businesses.some(item => item.id === remembered) ? remembered! : businesses[0].id;
    setSuspended(false);
    setAccount({ user, businesses, activeId });
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) { queueMicrotask(() => setReady(true)); return; }
    const supabase = supabaseBrowser();
    const signals = readUrlSignals();
    let active = true;
    async function start() {
      if (signals.tokens) await supabase.auth.setSession(signals.tokens);
      const mode = signals.mode === 'welcome' || signals.hashType === 'invite' ? 'welcome' : signals.mode === 'reset' || signals.hashType === 'recovery' ? 'reset' : null;
      if (signals.authError) setLinkError(linkMessages[signals.authError] || linkMessages.expired);
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (user) { if (mode) setPasswordMode(mode); await loadAccount(user.id).catch(() => setLinkError('No se pudo cargar tu cuenta. Recarga la página.')); }
      if (active) setReady(true);
    }
    void start();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { loadedId.current = null; storage.configure(null); setAccount(null); setAdminStudio(false); }
      if (event === 'PASSWORD_RECOVERY') setPasswordMode('reset');
      // SIGNED_IN también llega al volver a la pestaña: solo se recarga si cambió la cuenta.
      if (event === 'SIGNED_IN' && session?.user && loadedId.current !== session.user.id) void loadAccount(session.user.id);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [loadAccount]);

  const logout = useCallback(async () => { await supabaseBrowser().auth.signOut(); }, []);

  if (!supabaseConfigured) return <MessageScreen title="Falta configurar Supabase" message="Agrega NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local y reinicia el servidor. Las instrucciones están en el README." />;
  if (!ready) return <Loading />;
  if (suspended) return <MessageScreen title="Cuenta suspendida" message="Tu cuenta está suspendida. Escribe al administrador de Clic para reactivarla." action={{ label: 'Cerrar sesión', onClick: () => { setSuspended(false); void logout(); } }} />;
  // Un enlace abierto en otro navegador igual confirmó el correo: se avisa en verde, no como error.
  if (!account) return linkError === linkMessages.browser ? <AuthScreen key={linkError} initialNotice={linkError} /> : <AuthScreen key={linkError} initialError={linkError} />;
  if (passwordMode) return <ResetPasswordScreen invited={passwordMode === 'welcome'} onDone={() => setPasswordMode(null)} />;

  const { user, businesses, activeId } = account;
  if (user.role === 'admin' && !adminStudio) return <AdminPanel user={user} onOpenStudio={() => setAdminStudio(true)} onLogout={logout} />;

  const supabase = supabaseBrowser();
  // Studio se vuelve a montar al cambiar de negocio para cargar sus datos desde cero.
  storage.configure({ supabase, userId: user.id, businessId: activeId });
  const switchTo = (id: string) => { rememberBusiness(user.id, id); setAccount({ ...account, activeId: id }); };
  return <Studio
    key={activeId}
    currentUser={user}
    businesses={businesses}
    activeBusinessId={activeId}
    onSwitchBusiness={switchTo}
    onCreateBusiness={async name => { const created = await createBusiness(supabase, user.id, name); rememberBusiness(user.id, created.id); setAccount({ ...account, businesses: [...businesses, created], activeId: created.id }); }}
    onDeleteBusiness={async id => { await deleteBusiness(supabase, id); const rest = businesses.filter(item => item.id !== id); rememberBusiness(user.id, rest[0].id); setAccount({ ...account, businesses: rest, activeId: rest[0].id }); }}
    onBusinessRenamed={name => setAccount(current => current && ({ ...current, businesses: current.businesses.map(item => item.id === activeId ? { ...item, name } : item) }))}
    onUserChange={next => setAccount(current => current && ({ ...current, user: next }))}
    onOpenAdmin={user.role === 'admin' ? () => setAdminStudio(false) : undefined}
    onLogout={logout}
  />;
}

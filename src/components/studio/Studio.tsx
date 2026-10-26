'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Add, ArrowForward, AutoAwesome, Brush, Business, CheckCircle, ContentCopy,
  DeleteOutline, FolderOpen, HomeOutlined, Menu as MenuIcon, MoreHoriz,
  PaletteOutlined, Search, Storefront,
} from '@mui/icons-material';
import {
  Alert, AppBar, Avatar, Box, Breadcrumbs, Button, Card, CardActionArea,
  CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Menu,
  MenuItem, Paper, Select, Skeleton, Snackbar, Stack, TextField, Toolbar,
  Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import { AppUser } from '@/lib/auth';
import { ClicLogo } from '@/components/brand/ClicLogo';
import { Brand, Design, duplicateDesign, emptyBrand, generationPayload, Network, networks, newDesign, normalizeBrand, outputs, Publication, publishPayload } from '@/lib/studio';
import { renderDesign } from '@/lib/studio-renderer';
import { storage } from '@/lib/studio-storage';
import { usePolling } from '@/hooks/usePolling';
import { BrandForm } from './BrandForm';
import { CreateFlow, lastStep } from './CreateFlow';
import { Editor } from './Editor';

type View = 'home' | 'brand' | 'create' | 'editor' | 'history';
const drawerWidth = 256;
const versionsLabel = outputs.map(network => networks[network].label).join(' · ');
const historyFilters = ['Todos', 'Generadas con IA', 'Maquetas', 'Publicadas', 'Con fecha deseada'];

function statusOf(item: Design): { label: string; color: 'info' | 'success' | 'warning' | 'default' | 'error' } {
  if (item.generation?.status === 'processing') return { label: 'Generando…', color: 'info' };
  if (item.generation?.status === 'completed') return { label: 'Generada con IA', color: 'success' };
  if (item.schedule) return { label: 'Fecha deseada · pendiente', color: 'warning' };
  return { label: 'Maqueta', color: 'default' };
}
function publishedIn(item: Design, status: Publication['status']) {
  return outputs.filter(network => item.publications?.[network]?.status === status).map(network => networks[network].label);
}

function Thumbnail({ design }: { design: Design }) {
  const [src, setSrc] = useState('');
  const generated = design.generation?.status === 'completed' ? design.generation.urls[design.format as Network] : undefined;
  useEffect(() => {
    let live = true;
    if (generated) return;
    void renderDesign(design).then(canvas => {
      if (live) setSrc(canvas.toDataURL('image/jpeg', 0.55));
    }).catch(() => {});
    return () => { live = false; };
  }, [design, generated]);
  return generated || src ? <Box component="img" src={generated || src} alt={design.title || design.product} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ height: '100%', color: 'primary.main', bgcolor: '#EAF6FE' }}><Skeleton variant="rounded" width="65%" height="70%" /><Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: '86%' }}>{design.product || 'Tu diseño'}</Typography></Stack>;
}

export default function Studio({ currentUser, onLogout }: { currentUser?: AppUser; onLogout?: () => void }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [view, setView] = useState<View>('home');
  const [brand, setBrand] = useState<Brand>(emptyBrand);
  const [draft, setDraft] = useState<Design | null>(null);
  const [history, setHistory] = useState<Design[]>([]);
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [storageStatus, setStorageStatus] = useState('');
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newConfirm, setNewConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuTarget, setMenuTarget] = useState<Design | null>(null);
  const { status: generationStatus, ticketId: generationTicket, resultUrl: generatedImageUrl, resultUrls: generatedImageUrls, error: generationError, startPolling } = usePolling();
  const main = useRef<HTMLElement>(null);
  const historyRef = useRef<Design[]>([]);

  const notify = (message: string, error = false) => setNotice({ message, error });

  useEffect(() => { historyRef.current = history; }, [history]);
  async function writeHistory(next: Design[]) { historyRef.current = next; setHistory(next); await storage.put('history', next); }
  const upsert = (design: Design) => writeHistory([design, ...historyRef.current.filter(item => item.id !== design.id)]);
  /** Aplica un cambio a la publicación en el borrador y en Mis publicaciones, sin pisar ediciones posteriores. */
  function patchDesign(id: string, patch: Partial<Design> | ((design: Design) => Partial<Design>)) {
    const apply = (design: Design) => ({ ...design, ...(typeof patch === 'function' ? patch(design) : patch) });
    setDraft(current => current?.id === id ? apply(current) : current);
    if (historyRef.current.some(item => item.id === id)) void writeHistory(historyRef.current.map(item => item.id === id ? apply(item) : item)).catch(error => notify(error instanceof Error ? error.message : 'No se pudo actualizar Mis publicaciones.', true));
  }

  useEffect(() => {
    let active = true;
    void Promise.all([storage.get<Brand>('brand'), storage.get<Design>('draft'), storage.get<Design[]>('history')]).then(async ([savedBrand, savedDraft, savedHistory]) => {
      if (!active) return;
      const nextBrand = normalizeBrand(savedBrand);
      setBrand(nextBrand);
      setDraft(savedDraft || null);
      let nextHistory = savedHistory;
      if (!nextHistory) {
        try {
          const legacy: unknown = JSON.parse(localStorage.getItem('impulsa-design-history') || '[]');
          if (Array.isArray(legacy)) {
            nextHistory = legacy.filter(item => item && typeof item.headline === 'string').map(item => ({
              ...newDesign(nextBrand), product: item.headline.slice(0, 80), title: item.headline.slice(0, 80),
              body: typeof item.description === 'string' ? item.description.slice(0, 180) : '',
              images: typeof item.image === 'string' && item.image.startsWith('data:image/') ? [item.image] : [],
              color: /^#[0-9a-f]{6}$/i.test(item.accent) ? item.accent : emptyBrand.primary,
              format: item.format === 'story' ? 'story' : item.format === 'whatsapp' ? 'whatsapp' : 'instagram',
            }));
            if (nextHistory.length) await storage.put('history', nextHistory);
          }
        } catch { /* Keep malformed legacy storage untouched. */ }
      }
      if (!active) return;
      setHistory(nextHistory || []);
      const pending = nextHistory?.find(item => item.generation?.status === 'processing' && item.generation.ticketId);
      if (pending?.generation?.ticketId) startPolling(pending.generation.ticketId);
    }).catch(error => {
      if (active) { setStorageAvailable(false); notify(`${error instanceof Error ? error.message : 'No se pudo abrir el almacenamiento.'} Puedes editar, pero los cambios no se conservarán al cerrar.`, true); }
    }).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [startPolling]);

  useEffect(() => {
    if (!loaded || !draft || !storageAvailable) return;
    let active = true;
    const timer = setTimeout(() => {
      if (active) setStorageStatus('Guardando borrador…');
      const inHistory = historyRef.current.some(item => item.id === draft.id);
      void storage.put('draft', draft).then(() => inHistory ? writeHistory(historyRef.current.map(item => item.id === draft.id ? draft : item)) : undefined).then(() => { if (active) setStorageStatus(inHistory ? 'Cambios guardados en Mis publicaciones' : 'Borrador guardado en este navegador'); }).catch(error => {
        if (active) { setStorageStatus('No se pudo guardar el borrador'); notify(error instanceof Error ? error.message : 'No se pudo guardar el borrador.', true); }
      });
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [draft, loaded, storageAvailable]);

  useEffect(() => { main.current?.scrollTo({ top: 0 }); }, [view, step]);

  const update = (patch: Partial<Design>) => setDraft(current => current ? { ...current, ...patch, updatedAt: new Date().toISOString() } : current);
  const navigate = (next: View) => { setView(next); setDrawerOpen(false); };

  function begin() {
    setDrawerOpen(false);
    // Solo se pregunta por borradores que aún no llegaron a Mis publicaciones.
    if (draft && (draft.product || draft.images.length) && !history.some(item => item.id === draft.id)) { setNewConfirm(true); return; }
    setDraft(newDesign(brand)); setStep(0); navigate('create');
  }
  function resume(design: Design) {
    const newest = draft?.id === design.id && draft.updatedAt > design.updatedAt ? draft : design;
    // Publicaciones antiguas podían usar formatos que ya no se generan (vertical, historia).
    const latest = (outputs as string[]).includes(newest.format) ? newest : { ...newest, format: outputs[0] };
    setDraft(latest); setStep(latest.images.length && latest.product ? lastStep : 1); navigate(latest.images.length && latest.title ? 'editor' : 'create');
  }

  async function generateWithN8n() {
    if (!draft || !draft.product.trim() || !draft.images.length || !draft.title.trim() || !draft.cta.trim()) {
      notify('Completa el producto, al menos una imagen, el título y el llamado a la acción.', true);
      return;
    }
    const design = draft;
    setStep(lastStep);
    navigate('editor');
    // Toda publicación creada queda en Mis publicaciones, aunque la generación con IA falle.
    try { await upsert(design); }
    catch (error) { notify(error instanceof Error ? error.message : 'No se pudo guardar en Mis publicaciones.', true); }
    try {
      const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(generationPayload(design)) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo iniciar la generación.');
      patchDesign(design.id, { generation: { status: 'processing', ticketId: data.ticket_id, urls: {} } });
      startPolling(data.ticket_id);
      notify('Guardada en Mis publicaciones. Estamos generando las versiones para Instagram, Facebook y WhatsApp.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo iniciar la generación.';
      patchDesign(design.id, { generation: { status: 'error', urls: {}, error: message } });
      notify(`${message} La maqueta quedó guardada en Mis publicaciones.`, true);
    }
  }

  async function publish(design: Design, targets: Network[]) {
    const sent: string[] = [];
    for (const network of targets) {
      const { account } = brand.connections[network];
      const mark = (state: Publication) => patchDesign(design.id, current => ({ publications: { ...current.publications, [network]: state } }));
      if (!account.trim()) { mark({ status: 'error', at: new Date().toISOString(), error: 'Falta indicar la cuenta en Mi negocio.' }); continue; }
      mark({ status: 'sending', at: new Date().toISOString() });
      try {
        const generated = design.generation?.status === 'completed' ? design.generation.urls[network] : undefined;
        const image = (await renderDesign({ ...design, format: network }, generated)).toDataURL('image/png');
        const response = await fetch('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(publishPayload(design, network, account.trim(), image)) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'No se pudo publicar.');
        mark({ status: 'sent', at: new Date().toISOString() });
        sent.push(networks[network].label);
      } catch (error) {
        mark({ status: 'error', at: new Date().toISOString(), error: error instanceof Error ? error.message : 'No se pudo publicar.' });
      }
    }
    if (sent.length === targets.length) notify(`Publicado en ${sent.join(', ')}.`);
    else notify(sent.length ? `Publicado en ${sent.join(', ')}. Revisa las redes con error en el editor.` : 'No se pudo publicar. Revisa el detalle en el editor.', true);
  }

  // Al terminar la generación, guarda las 3 imágenes y publica en las redes activadas.
  useEffect(() => {
    if (!generationTicket || (generationStatus !== 'completed' && generationStatus !== 'error')) return;
    const target = historyRef.current.find(item => item.generation?.status === 'processing' && item.generation.ticketId === generationTicket);
    if (!target) return;
    if (generationStatus === 'error') { patchDesign(target.id, { generation: { status: 'error', ticketId: generationTicket, urls: {}, error: generationError || 'No se pudo generar la imagen.' } }); return; }
    const urls = Object.fromEntries(outputs.map(network => [network, generatedImageUrls[network] || generatedImageUrl]).filter(([, url]) => url));
    const generation = { status: 'completed' as const, ticketId: generationTicket, urls };
    patchDesign(target.id, { generation });
    const auto = outputs.filter(network => brand.connections[network].enabled);
    if (auto.length) void publish({ ...target, generation }, auto);
    else notify('¡Listo! Tus versiones para Instagram, Facebook y WhatsApp están en Mis publicaciones.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generationStatus, generationTicket]);

  const nav = [
    { id: 'home' as View, label: 'Inicio', icon: HomeOutlined },
    { id: 'create' as View, label: 'Crear publicación', icon: Add },
    { id: 'history' as View, label: 'Mis publicaciones', icon: FolderOpen },
    { id: 'brand' as View, label: 'Mi negocio', icon: Storefront },
  ];
  const matchesFilter = (item: Design) => filter === 'Todos' ? true : filter === 'Generadas con IA' ? item.generation?.status === 'completed' : filter === 'Maquetas' ? item.generation?.status !== 'completed' : filter === 'Publicadas' ? publishedIn(item, 'sent').length > 0 : !!item.schedule;
  const visibleHistory = history.filter(item => `${item.title} ${item.product}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()) && matchesFilter(item));
  const pageLabel = view === 'editor' ? 'Editor' : nav.find(item => item.id === view)?.label || 'Inicio';

  async function duplicate(item: Design) {
    setBusy(true);
    try { const copy = duplicateDesign(item); const next = [copy, ...history]; await storage.put('history', next); setHistory(next); setMenuAnchor(null); setMenuTarget(null); resume(copy); notify('Copia creada. El original sigue en tu historial.'); }
    catch (error) { notify(error instanceof Error ? error.message : 'No se pudo duplicar la publicación.', true); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!deleteId) return;
    setBusy(true);
    try { const next = history.filter(item => item.id !== deleteId); await storage.put('history', next); setHistory(next); setDeleteId(null); notify('Publicación eliminada del historial.'); }
    catch (error) { notify(error instanceof Error ? error.message : 'No se pudo eliminar la publicación.', true); }
    finally { setBusy(false); }
  }

  const sidebar = <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', px: 1.5, py: 2 }}>
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 1.25, pb: 3 }}><ClicLogo size={38} /><Box><Typography sx={{ fontSize: '1.08rem', lineHeight: 1, fontWeight: 700, letterSpacing: '-.035em', color: 'primary.dark' }}>Clic</Typography><Typography variant="caption" color="text.secondary">Estudio creativo</Typography></Box></Stack>
    <Typography variant="overline" color="text.secondary" sx={{ px: 1.5, mb: .5, letterSpacing: '.12em', fontWeight: 800 }}>Espacio creativo</Typography>
    <List disablePadding sx={{ display: 'grid', gap: .5 }}>{nav.map(({ id, label, icon: Icon }) => <ListItemButton key={id} selected={view === id || (id === 'create' && view === 'editor')} onClick={() => id === 'create' ? begin() : navigate(id)} sx={{ borderRadius: 2.5, minHeight: 48, px: 1.25, '&.Mui-selected': { bgcolor: '#EEF2FF', color: 'primary.dark', boxShadow: 'inset 3px 0 0 #3F63E9', '& .MuiListItemIcon-root': { color: 'primary.main' }, '& .MuiListItemText-primary': { fontWeight: 700 } }, '&:hover': { bgcolor: '#F8FAFF' } }}><ListItemIcon sx={{ minWidth: 38, color: 'text.secondary' }}><Icon /></ListItemIcon><ListItemText primary={label} primaryTypographyProps={{ fontWeight: view === id ? 700 : 600, fontSize: 14 }} />{id === 'create' && <ArrowForward fontSize="small" />}</ListItemButton>)}</List>
    <Box sx={{ mt: 'auto', p: 1.5, borderRadius: 2, bgcolor: '#F3F6FF', border: '1px solid #D7E2FB' }}><AutoAwesome sx={{ color: 'primary.main', mb: .75, fontSize: 20 }} /><Typography variant="body2" fontWeight={800} sx={{ lineHeight: 1.28 }}>Tu próxima idea merece verse bien.</Typography><Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: .5, lineHeight: 1.45 }}>Un pequeño paso para tu gran negocio.</Typography></Box>
    <Divider sx={{ my: 2 }} />
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 1 }}><Avatar variant="rounded" src={brand.logo || undefined} sx={{ bgcolor: brand.primary || 'primary.main', width: 36, height: 36 }}>{!brand.logo && <Storefront fontSize="small" />}</Avatar><Box minWidth={0}><Typography variant="body2" fontWeight={800} noWrap>{brand.name || 'Tu negocio'}</Typography><Typography variant="caption" color="text.secondary" noWrap>Estudio de publicaciones</Typography></Box></Stack>
  </Box>;

  return <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: 'background.default', backgroundImage: 'radial-gradient(circle at 88% 12%, rgba(198,160,255,.10), transparent 28%)' }}>
    <AppBar position="fixed" color="inherit" elevation={0} sx={{ width: { md: `calc(100% - ${drawerWidth}px)` }, ml: { md: `${drawerWidth}px` }, borderBottom: 1, borderColor: 'rgba(213,224,235,.82)', bgcolor: 'rgba(255,255,255,.88)', backdropFilter: 'blur(18px)', boxShadow: '0 4px 18px rgba(31,41,55,.035)', zIndex: { md: theme.zIndex.drawer + 1 } }}>
      <Toolbar sx={{ minHeight: { xs: 64, sm: 72 }, gap: 1.5, px: { xs: 2, sm: 3, lg: 5 } }}>
        <IconButton onClick={() => setDrawerOpen(true)} sx={{ display: { md: 'none' } }} aria-label="Abrir menú"><MenuIcon /></IconButton>
        <Breadcrumbs aria-label="Migas de pan"><Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>Tu espacio creativo</Typography><Typography variant="body2" fontWeight={800}>{pageLabel}</Typography></Breadcrumbs>
        <Box sx={{ flex: 1 }} />
        <Chip icon={<CheckCircle />} label="Guardado local" color="success" variant="outlined" size="small" sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />
        {currentUser && <Tooltip title="Cerrar sesión"><IconButton onClick={onLogout} aria-label="Cerrar sesión"><Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 13 }}>{currentUser.name.slice(0, 1).toUpperCase()}</Avatar></IconButton></Tooltip>}
      </Toolbar>
    </AppBar>
    <Drawer variant={isMobile ? 'temporary' : 'permanent'} open={isMobile ? drawerOpen : true} onClose={() => setDrawerOpen(false)} ModalProps={{ keepMounted: true }} sx={{ '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper' } }}>{sidebar}</Drawer>
    <Box component="main" ref={main} sx={{ flex: 1, minWidth: 0, ml: { md: `${drawerWidth}px` }, pt: { xs: 8, sm: 9 }, height: '100dvh', overflowY: 'auto' }}>
      <Box sx={{ maxWidth: 1360, mx: 'auto', px: { xs: 2, sm: 3, lg: 5 }, py: { xs: 2.5, sm: 4 } }}>
        {!loaded ? <Stack spacing={2}><Skeleton variant="rounded" height={52} /><Skeleton variant="rounded" height={250} /><Skeleton variant="rounded" height={140} /></Stack> : <>
          {view === 'home' && <HomeView brand={brand} draft={draft} history={history} begin={begin} resume={resume} navigate={navigate} />}
          {view === 'brand' && <BrandForm key={brand.name + brand.logo.length} initial={brand} onSave={async next => { try { await storage.put('brand', next); setBrand(next); notify('Datos del negocio guardados. Se usarán en las nuevas publicaciones.'); } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo guardar el negocio.', true); } }} />}
          {view === 'create' && draft && <CreateFlow design={draft} update={update} step={step} setStep={setStep} onCreate={generateWithN8n} />}
          {view === 'editor' && draft && <Editor key={draft.id} design={draft} update={update} notify={notify} connections={brand.connections} onPublish={targets => publish(draft, targets)} onConnect={() => navigate('brand')} onBack={() => { setStep(lastStep); navigate('create'); }} />}
          {(view === 'editor' || view === 'create') && draft && <Typography role="status" variant="caption" color={storageAvailable ? 'text.secondary' : 'error.main'} sx={{ display: 'block', textAlign: 'center', mt: 2 }}>{storageAvailable ? storageStatus : 'Almacenamiento no disponible: los cambios no se conservarán.'}</Typography>}
          {view === 'history' && <HistoryView history={history} visibleHistory={visibleHistory} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} begin={begin} resume={resume} onMenu={(event, item) => { setMenuAnchor(event.currentTarget); setMenuTarget(item); }} onDelete={setDeleteId} />}
        </>}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: { xs: 4, sm: 6 }, letterSpacing: '.01em' }}>Hecho para dar impulso a tu negocio · Clic</Typography>
      </Box>
    </Box>
    <Snackbar open={!!notice} autoHideDuration={5000} onClose={() => setNotice(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}><Alert onClose={() => setNotice(null)} severity={notice?.error ? 'error' : 'success'} variant="filled" sx={{ width: '100%' }}>{notice?.message}</Alert></Snackbar>
    <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => { setMenuAnchor(null); setMenuTarget(null); }}><MenuItem disabled={!menuTarget || busy} onClick={() => menuTarget && void duplicate(menuTarget)}><ContentCopy fontSize="small" sx={{ mr: 1 }} />Duplicar</MenuItem><MenuItem onClick={() => { if (menuTarget) setDeleteId(menuTarget.id); setMenuAnchor(null); setMenuTarget(null); }}><DeleteOutline fontSize="small" sx={{ mr: 1 }} />Eliminar</MenuItem></Menu>
    <Dialog open={!!deleteId || newConfirm} onClose={() => { setDeleteId(null); setNewConfirm(false); }} fullWidth maxWidth="xs"><DialogTitle>{deleteId ? '¿Eliminar esta publicación?' : 'Tienes un borrador en curso'}</DialogTitle><DialogContent><Typography color="text.secondary">{deleteId ? 'Se eliminará del historial de este navegador. Esta acción no se puede deshacer.' : `Empezaste "${draft?.product || 'una publicación'}" y aún no la terminas. ¿Quieres continuarla o empezar una nueva?`}</Typography></DialogContent><DialogActions sx={{ p: 2.5, pt: 0 }}><Button onClick={() => { setDeleteId(null); setNewConfirm(false); if (newConfirm && draft) resume(draft); }}>{deleteId ? 'Cancelar' : 'Continuar borrador'}</Button><Button variant="contained" color={deleteId ? 'error' : 'primary'} disabled={busy} onClick={() => deleteId ? void remove() : (() => { setDraft(newDesign(brand)); setStep(0); setView('create'); setNewConfirm(false); })()}>{deleteId ? 'Eliminar' : 'Empezar nueva'}</Button></DialogActions></Dialog>
  </Box>;
}

function HomeView({ brand, draft, history, begin, resume, navigate }: { brand: Brand; draft: Design | null; history: Design[]; begin: () => void; resume: (design: Design) => void; navigate: (view: View) => void }) {
  const steps = [{ n: '01', title: 'Elige qué publicar', body: 'Vender, una oferta, un evento… tú decides la intención.', icon: AutoAwesome }, { n: '02', title: 'Sube tus fotos', body: 'De una a tres fotos de tu producto. Nosotros armamos el diseño.', icon: PaletteOutlined }, { n: '03', title: 'Revisa y publica', body: 'Recibe versiones para Instagram, Facebook y WhatsApp.', icon: ArrowForward }];
  // Lo pendiente va primero: configurar el negocio y retomar lo que quedó a medias.
  const unfinished = draft && (draft.product || draft.images.length) && !history.some(item => item.id === draft.id) ? draft : null;
  return <Stack spacing={{ xs: 3, sm: 4 }}>
    <Box><Typography variant="overline" color="primary.dark" sx={{ letterSpacing: '.12em', fontWeight: 900 }}>Hecho para emprendedores</Typography><Typography variant="h1">Hola{brand.name ? `, ${brand.name}` : ''} <Brush aria-hidden sx={{ color: '#3F63E9', fontSize: '0.78em', verticalAlign: '-0.08em', ml: 0.35 }} /></Typography><Typography color="text.secondary">Hoy es un buen día para mostrar lo que haces.</Typography></Box>
    {!brand.name && <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', borderColor: 'primary.main', bgcolor: '#F3F6FF' }}><Storefront color="primary" sx={{ fontSize: 34 }} /><Box sx={{ flex: 1, minWidth: 220 }}><Typography variant="h3">Primero, cuéntanos de tu negocio</Typography><Typography variant="body2" color="text.secondary">Nombre, logo, colores y redes. Lo haces una sola vez y se usa en todas tus publicaciones.</Typography></Box><Button variant="contained" onClick={() => navigate('brand')} endIcon={<ArrowForward />}>Configurar mi negocio</Button></Paper>}
    {unfinished && <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', borderColor: 'primary.light' }}><Business color="primary" sx={{ fontSize: 32 }} /><Box sx={{ flex: 1, minWidth: 220 }}><Typography variant="overline" color="primary.dark" fontWeight={800}>Quedó a medias</Typography><Typography variant="h3">{unfinished.product || 'Tu próxima publicación'}</Typography></Box><Button variant="outlined" onClick={() => resume(unfinished)} endIcon={<ArrowForward />}>Continuar</Button></Paper>}
    <Card sx={{ overflow: 'hidden', color: '#1C1C1E', background: 'linear-gradient(135deg, #EEF2FF 0%, #F7FAFF 62%, #F3F0FF 100%)', border: '1px solid #D8E3F4', boxShadow: '0 12px 32px rgba(63,99,233,.08)', position: 'relative', minHeight: { sm: 260 } }}><CardContent sx={{ p: { xs: 2.25, sm: 3.5, lg: 4 }, maxWidth: { xs: '100%', lg: 680 }, position: 'relative', zIndex: 1 }}><Typography variant="h2" sx={{ color: 'inherit', fontSize: { xs: '1.7rem', sm: '2.35rem' } }}>Grandes ideas.<br />Publicaciones <Box component="em" sx={{ color: '#3F63E9', fontStyle: 'normal' }}>muy tuyas.</Box></Typography><Typography sx={{ color: '#526273', maxWidth: 560, mt: 1.5 }}>Sube la foto de tu producto y recibe tu publicación lista para Instagram, Facebook y WhatsApp, con tu marca.</Typography><Button variant="contained" color="primary" size="large" endIcon={<ArrowForward />} onClick={begin} sx={{ mt: 2.5, '&:hover': { bgcolor: '#3157D5' } }}>Crear publicación</Button></CardContent><Box aria-hidden sx={{ position: 'absolute', display: { xs: 'none', lg: 'grid' }, placeItems: 'center', right: { lg: 72 }, top: '50%', transform: 'translateY(-50%)', width: 164, height: 164, borderRadius: '50%', background: 'rgba(255,255,255,.62)', border: '1px solid rgba(63,99,233,.12)', boxShadow: '0 16px 36px rgba(63,99,233,.08)' }}><ClicLogo size={104} /></Box></Card>
    <Box><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}><Typography variant="h2" fontSize={{ xs: 22, sm: 26 }}>Tus últimas publicaciones</Typography>{history.length > 0 && <Button size="small" onClick={() => navigate('history')} endIcon={<ArrowForward />}>Ver todas</Button>}</Stack>{history.length ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 1.5 }}>{history.slice(0, 3).map(item => <Card key={item.id} variant="outlined"><CardActionArea onClick={() => resume(item)}><Box sx={{ aspectRatio: '16/9', overflow: 'hidden' }}><Thumbnail design={item} /></Box><CardContent><Typography fontWeight={800} noWrap>{item.title || item.product}</Typography><Typography variant="caption" color="text.secondary">{statusOf(item).label}</Typography></CardContent></CardActionArea></Card>)}</Box> : <Paper variant="outlined" sx={{ p: { xs: 2.25, sm: 3 }, borderStyle: 'dashed', display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.secondary' }}><FolderOpen /><Typography variant="body2">Aquí aparecerán tus publicaciones. Crea la primera en tres pasos.</Typography></Paper>}</Box>
    <Box><Typography variant="h2" fontSize={{ xs: 22, sm: 26 }} sx={{ mb: 1.5 }}>Así de sencillo</Typography><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 1.5 }}>{steps.map(({ n, title, body, icon: Icon }) => <Paper key={n} variant="outlined" sx={{ p: 2.25, borderColor: 'divider', borderRadius: 2 }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Icon color="primary" /><Chip label={n} size="small" sx={{ bgcolor: '#EEF2FF', color: 'primary.dark', fontWeight: 800 }} /></Stack><Typography variant="h3" sx={{ mt: 2 }}>{title}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .75 }}>{body}</Typography></Paper>)}</Box></Box>
  </Stack>;
}

function HistoryView({ history, visibleHistory, query, setQuery, filter, setFilter, begin, resume, onMenu, onDelete }: { history: Design[]; visibleHistory: Design[]; query: string; setQuery: (value: string) => void; filter: string; setFilter: (value: string) => void; begin: () => void; resume: (design: Design) => void; onMenu: (event: React.MouseEvent<HTMLElement>, item: Design) => void; onDelete: (id: string) => void }) {
  return <Stack spacing={2.5}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'flex-end' }} spacing={2}><Box><Typography variant="overline" color="primary.dark" sx={{ letterSpacing: '.12em', fontWeight: 900 }}>Tu colección de ideas</Typography><Typography variant="h1">Mis publicaciones</Typography><Typography color="text.secondary">Recupera, duplica y vuelve a darle vida a tus diseños.</Typography></Box><Button variant="contained" startIcon={<Add />} onClick={begin}>Crear publicación</Button></Stack><Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}><TextField fullWidth size="small" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por título o producto" aria-label="Buscar publicaciones" InputProps={{ startAdornment: <Search color="action" sx={{ mr: 1 }} /> }} sx={{ flex: 1 }} /><Select size="small" value={filter} onChange={event => setFilter(event.target.value)} aria-label="Filtrar publicaciones" sx={{ width: { xs: '100%', md: 'auto' }, minWidth: { md: 210 } }}>{historyFilters.map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}</Select></Stack>{visibleHistory.length ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }, gap: 2 }}>{visibleHistory.map(item => <Card key={item.id} variant="outlined" sx={{ overflow: 'hidden' }}><Box component="button" type="button" onClick={() => resume(item)} aria-label={`Editar ${item.title || item.product}`} sx={{ width: '100%', p: 0, border: 0, display: 'block', cursor: 'pointer', aspectRatio: '16/9', overflow: 'hidden', bgcolor: '#F5FAFD' }}><Thumbnail design={item} /></Box><CardContent><Stack direction="row" justifyContent="space-between" alignItems="start" spacing={1}><Chip size="small" label={statusOf(item).label} color={statusOf(item).color} variant="outlined" /><IconButton size="small" onClick={event => onMenu(event, item)} aria-label="Más acciones"><MoreHoriz /></IconButton></Stack><Typography variant="h3" sx={{ mt: 1 }} noWrap>{item.title || item.product}</Typography><Typography variant="body2" color="text.secondary">{versionsLabel}</Typography>{publishedIn(item, 'sent').length > 0 && <Typography variant="caption" color="success.main" display="block">Publicada en {publishedIn(item, 'sent').join(', ')}</Typography>}{publishedIn(item, 'error').length > 0 && <Typography variant="caption" color="error.main" display="block">Error al publicar en {publishedIn(item, 'error').join(', ')}</Typography>}<Typography variant="caption" color="text.secondary" display="block" sx={{ mt: .5 }}>Actualizado {new Date(item.updatedAt).toLocaleDateString('es-PE')}</Typography><Stack direction="row" spacing={1} sx={{ mt: 2 }}><Button size="small" onClick={() => resume(item)} endIcon={<ArrowForward />}>Editar</Button><Tooltip title="Eliminar"><IconButton size="small" color="error" onClick={() => onDelete(item.id)} aria-label={`Eliminar ${item.title || item.product}`}><DeleteOutline /></IconButton></Tooltip></Stack></CardContent></Card>)}</Box> : <Paper variant="outlined" sx={{ textAlign: 'center', p: { xs: 3, sm: 6 }, borderStyle: 'dashed' }}><FolderOpen sx={{ fontSize: 42, color: 'primary.main' }} /><Typography variant="h2" sx={{ mt: 1.5 }}>{history.length ? 'No encontramos coincidencias' : 'Tu primera publicación te espera'}</Typography><Typography color="text.secondary" sx={{ mt: .75 }}>{history.length ? 'Prueba con otro nombre o filtro.' : 'Las publicaciones que crees aparecerán aquí, listas para volver a editarlas o publicarlas.'}</Typography><Button variant="contained" sx={{ mt: 2 }} onClick={begin} endIcon={<ArrowForward />}>Crear publicación</Button></Paper>}<Typography variant="caption" color="text.secondary">Cada publicación que creas o generas se guarda aquí automáticamente, en este navegador. Todavía no se sincroniza entre dispositivos.</Typography></Stack>;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Add, AdminPanelSettings, ArrowForward, Check, ContentCopy,
  DeleteOutline, FolderOpen, HomeOutlined, ManageAccounts, Menu as MenuIcon, MoreHoriz,
  AddPhotoAlternateOutlined, EditNote, IosShare, Search, Storefront, TouchAppOutlined, UnfoldMore,
} from '@mui/icons-material';
import {
  Alert, AppBar, Avatar, Box, Button, Card, CardActionArea,
  CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Menu,
  MenuItem, Paper, Select, Skeleton, Snackbar, Stack, TextField, Toolbar,
  Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import { AppUser, BusinessSummary } from '@/lib/auth';
import { ClicLogo } from '@/components/brand/ClicLogo';
import { NetworkIcon } from '@/components/brand/NetworkIcon';
import { Brand, Design, duplicateDesign, emptyBrand, generationPayload, Network, networks, newDesign, normalizeBrand, outputs, Publication, publishPayload } from '@/lib/studio';
import { renderDesign } from '@/lib/studio-renderer';
import { shareableUrl, storage } from '@/lib/studio-storage';
import { usePolling } from '@/hooks/usePolling';
import { AccountView } from './AccountView';
import { BrandForm } from './BrandForm';
import { CreateFlow, lastStep } from './CreateFlow';
import { Editor } from './Editor';

type View = 'home' | 'brand' | 'create' | 'editor' | 'history' | 'account';
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
  return generated || src ? <Box component="img" src={generated || src} alt={design.title || design.product} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ height: '100%', color: 'primary.main', bgcolor: '#F2F5FA' }}><Skeleton variant="rounded" width="65%" height="70%" /><Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: '86%' }}>{design.product || 'Tu diseño'}</Typography></Stack>;
}

type StudioProps = {
  currentUser: AppUser;
  businesses: BusinessSummary[];
  activeBusinessId: string;
  onSwitchBusiness: (id: string) => void;
  onCreateBusiness: (name: string) => Promise<void>;
  onDeleteBusiness: (id: string) => Promise<void>;
  onBusinessRenamed: (name: string) => void;
  onUserChange: (user: AppUser) => void;
  onOpenAdmin?: () => void;
  onLogout: () => void;
};

export default function Studio({ currentUser, businesses, activeBusinessId, onSwitchBusiness, onCreateBusiness, onDeleteBusiness, onBusinessRenamed, onUserChange, onOpenAdmin, onLogout }: StudioProps) {
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
  const [businessAnchor, setBusinessAnchor] = useState<HTMLElement | null>(null);
  const [newBusiness, setNewBusiness] = useState<string | null>(null);
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
    // Un corte breve de red no debería dejar el estudio sin datos: se reintenta una vez.
    const load = () => Promise.all([storage.get<Brand>('brand'), storage.get<Design>('draft'), storage.get<Design[]>('history')]);
    void load().catch(() => new Promise(resolve => setTimeout(resolve, 800)).then(load)).then(async ([savedBrand, savedDraft, savedHistory]) => {
      if (!active) return;
      const nextBrand = normalizeBrand(savedBrand);
      setBrand(nextBrand);
      setDraft(savedDraft || null);
      const nextHistory = savedHistory || [];
      setHistory(nextHistory);
      const pending = nextHistory.find(item => item.generation?.status === 'processing' && item.generation.ticketId);
      if (pending?.generation?.ticketId) startPolling(pending.generation.ticketId);
    }).catch(error => {
      if (active) { setStorageAvailable(false); notify(`${error instanceof Error ? error.message : 'No se pudieron cargar tus datos.'} Recarga la página; mientras tanto, los cambios no se guardarán.`, true); }
    }).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [startPolling]);

  useEffect(() => {
    if (!loaded || !draft || !storageAvailable) return;
    let active = true;
    const timer = setTimeout(() => {
      if (active) setStorageStatus('Guardando borrador…');
      const inHistory = historyRef.current.some(item => item.id === draft.id);
      void storage.put('draft', draft).then(() => inHistory ? writeHistory(historyRef.current.map(item => item.id === draft.id ? draft : item)) : undefined).then(() => { if (active) setStorageStatus(inHistory ? 'Cambios guardados en Mis publicaciones' : 'Borrador guardado en este dispositivo'); }).catch(error => {
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
    setDraft(latest); setStep(latest.images.length && latest.product ? lastStep : 0); navigate(latest.images.length && latest.title ? 'editor' : 'create');
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
        // Meta descarga la imagen por URL: la maqueta se sube a Storage y se comparte con un enlace firmado.
        const image = await shareableUrl(generated || (await renderDesign({ ...design, format: network })).toDataURL('image/png'));
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
    { id: 'account' as View, label: 'Mi cuenta', icon: ManageAccounts },
  ];
  const matchesFilter = (item: Design) => filter === 'Todos' ? true : filter === 'Generadas con IA' ? item.generation?.status === 'completed' : filter === 'Maquetas' ? item.generation?.status !== 'completed' : filter === 'Publicadas' ? publishedIn(item, 'sent').length > 0 : !!item.schedule;
  const visibleHistory = history.filter(item => `${item.title} ${item.product}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()) && matchesFilter(item));
  const pageLabel = view === 'editor' ? 'Tu publicación' : nav.find(item => item.id === view)?.label || 'Inicio';

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

  const sidebar = <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', px: 2, py: 2.5 }}>
    <Box sx={{ px: 1, pb: 3.5 }}><ClicLogo size={30} wordmark /></Box>
    <List disablePadding sx={{ display: 'grid', gap: .5 }}>{nav.map(({ id, label, icon: Icon }) => {
      const selected = view === id || (id === 'create' && view === 'editor');
      return <ListItemButton key={id} selected={selected} onClick={() => id === 'create' ? begin() : navigate(id)} sx={{ borderRadius: '12px', minHeight: 44, px: 1.5, color: 'text.secondary', '&.Mui-selected, &.Mui-selected:hover': { bgcolor: '#EEF3FF', color: 'primary.main' } }}><ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}><Icon fontSize="small" /></ListItemIcon><ListItemText primary={label} slotProps={{ primary: { fontWeight: selected ? 650 : 550, fontSize: 14 } }} /></ListItemButton>;
    })}</List>
    <Box sx={{ mt: 'auto' }} />
    {onOpenAdmin && <Button size="small" color="inherit" startIcon={<AdminPanelSettings />} onClick={onOpenAdmin} sx={{ mb: 1, justifyContent: 'flex-start', color: 'text.secondary', px: 1.5 }}>Panel de administración</Button>}
    <ListItemButton onClick={event => setBusinessAnchor(event.currentTarget)} aria-label="Cambiar de negocio" sx={{ flexGrow: 0, border: 1, borderColor: 'divider', borderRadius: '14px', p: 1.25, gap: 1.25 }}><Avatar variant="rounded" src={brand.logo || undefined} sx={{ bgcolor: brand.primary || 'primary.main', width: 36, height: 36, borderRadius: '10px' }}>{!brand.logo && <Storefront fontSize="small" />}</Avatar><Box minWidth={0} flex={1}><Typography variant="body2" fontWeight={650} noWrap>{brand.name || 'Tu negocio'}</Typography><Typography variant="caption" color="text.secondary" noWrap component="div">{businesses.length > 1 ? `${businesses.length} negocios · cambiar` : 'Agregar otro negocio'}</Typography></Box><UnfoldMore fontSize="small" color="action" /></ListItemButton>
  </Box>;

  return <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: 'background.default' }}>
    <AppBar position="fixed" color="inherit" elevation={0} sx={{ width: { md: `calc(100% - ${drawerWidth}px)` }, ml: { md: `${drawerWidth}px` }, borderBottom: 1, borderColor: 'divider', bgcolor: 'rgba(255,255,255,.9)', backdropFilter: 'blur(12px)', boxShadow: 'none', zIndex: { md: theme.zIndex.drawer + 1 } }}>
      <Toolbar sx={{ minHeight: { xs: 60, sm: 68 }, gap: 1.5, px: { xs: 2, sm: 3, lg: 5 } }}>
        <IconButton onClick={() => setDrawerOpen(true)} sx={{ display: { md: 'none' }, ml: -1 }} aria-label="Abrir menú"><MenuIcon /></IconButton>
        <Typography sx={{ fontWeight: 650, fontSize: '1rem' }}>{pageLabel}</Typography>
        <Box sx={{ flex: 1 }} />
        <Stack role="status" direction="row" alignItems="center" spacing={.75} sx={{ display: { xs: 'none', sm: 'flex' } }}><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: storageAvailable ? 'success.main' : 'warning.main' }} /><Typography variant="caption" color="text.secondary">{storageAvailable ? 'Guardado en tu cuenta' : 'Sin conexión'}</Typography></Stack>
        <Tooltip title="Mi cuenta"><IconButton onClick={() => navigate('account')} aria-label="Mi cuenta"><Avatar sx={{ width: 34, height: 34, bgcolor: '#EEF3FF', color: 'primary.main', fontSize: 14, fontWeight: 650 }}>{currentUser.name.slice(0, 1).toUpperCase()}</Avatar></IconButton></Tooltip>
      </Toolbar>
    </AppBar>
    <Drawer variant={isMobile ? 'temporary' : 'permanent'} open={isMobile ? drawerOpen : true} onClose={() => setDrawerOpen(false)} ModalProps={{ keepMounted: true }} sx={{ '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper' } }}>{sidebar}</Drawer>
    <Box component="main" ref={main} sx={{ flex: 1, minWidth: 0, ml: { md: `${drawerWidth}px` }, pt: { xs: 7.5, sm: 8.5 }, height: '100dvh', overflowY: 'auto' }}>
      <Box sx={{ maxWidth: 1280, mx: 'auto', px: { xs: 2, sm: 3, lg: 5 }, py: { xs: 2.5, sm: 4 } }}>
        {!loaded ? <Stack spacing={2}><Skeleton variant="rounded" height={52} /><Skeleton variant="rounded" height={250} /><Skeleton variant="rounded" height={140} /></Stack> : <>
          {view === 'home' && <HomeView userName={currentUser.name} brand={brand} draft={draft} history={history} begin={begin} resume={resume} navigate={navigate} />}
          {view === 'brand' && <BrandForm key={brand.name + brand.logo.length} initial={brand} onSave={async next => { try { await storage.put('brand', next); setBrand(next); onBusinessRenamed(next.name.trim() || 'Mi negocio'); notify('Datos del negocio guardados. Se usarán en las nuevas publicaciones.'); } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo guardar el negocio.', true); } }} />}
          {view === 'create' && draft && <CreateFlow design={draft} update={update} step={step} setStep={setStep} onCreate={generateWithN8n} />}
          {view === 'editor' && draft && <Editor key={draft.id} design={draft} update={update} notify={notify} connections={brand.connections} onPublish={targets => publish(draft, targets)} onConnect={() => navigate('brand')} onBack={() => { setStep(lastStep); navigate('create'); }} />}
          {/* El guardado normal ya se ve en la barra superior: aquí solo se avisa si algo falla. */}
          {(view === 'editor' || view === 'create') && draft && (!storageAvailable || storageStatus.startsWith('No se pudo')) && <Typography role="status" variant="body2" color="error.main" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>{storageAvailable ? storageStatus : 'No hay conexión: tus cambios no se están guardando.'}</Typography>}
          {view === 'account' && <AccountView user={currentUser} businesses={businesses} activeBusinessId={activeBusinessId} onUserChange={onUserChange} onDeleteBusiness={onDeleteBusiness} notify={notify} onLogout={onLogout} />}
          {view === 'history' && <HistoryView history={history} visibleHistory={visibleHistory} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} begin={begin} resume={resume} onMenu={(event, item) => { setMenuAnchor(event.currentTarget); setMenuTarget(item); }} onDelete={setDeleteId} />}
        </>}
        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: { xs: 4, sm: 6 }, color: '#8B95A7' }}>Clic · Tu contenido, resuelto con claridad.</Typography>
      </Box>
    </Box>
    <Snackbar open={!!notice} autoHideDuration={5000} onClose={() => setNotice(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}><Alert onClose={() => setNotice(null)} severity={notice?.error ? 'error' : 'success'} variant="filled" sx={{ width: '100%' }}>{notice?.message}</Alert></Snackbar>
    <Menu anchorEl={businessAnchor} open={!!businessAnchor} onClose={() => setBusinessAnchor(null)} anchorOrigin={{ vertical: 'top', horizontal: 'left' }} transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
      {businesses.map(item => <MenuItem key={item.id} selected={item.id === activeBusinessId} onClick={() => { setBusinessAnchor(null); if (item.id !== activeBusinessId) onSwitchBusiness(item.id); }}><ListItemIcon>{item.id === activeBusinessId ? <Check fontSize="small" /> : <Storefront fontSize="small" />}</ListItemIcon>{item.name || 'Mi negocio'}</MenuItem>)}
      <Divider />
      <MenuItem onClick={() => { setBusinessAnchor(null); setNewBusiness(''); }}><ListItemIcon><Add fontSize="small" /></ListItemIcon>Agregar negocio</MenuItem>
    </Menu>
    <Dialog open={newBusiness !== null} onClose={() => setNewBusiness(null)} fullWidth maxWidth="xs" component="form" onSubmit={async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); try { await onCreateBusiness(newBusiness || ''); } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo crear el negocio.', true); setBusy(false); } }}>
      <DialogTitle>Agregar un negocio</DialogTitle>
      <DialogContent><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Cada negocio tiene su propio logo, colores, redes y publicaciones. Puedes cambiar entre ellos desde el menú.</Typography><TextField autoFocus fullWidth label="Nombre del negocio" value={newBusiness || ''} onChange={event => setNewBusiness(event.target.value)} required /></DialogContent>
      <DialogActions sx={{ p: 2.5, pt: 0 }}><Button onClick={() => setNewBusiness(null)}>Cancelar</Button><Button type="submit" variant="contained" disabled={busy || !newBusiness?.trim()}>Crear negocio</Button></DialogActions>
    </Dialog>
    <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => { setMenuAnchor(null); setMenuTarget(null); }}><MenuItem disabled={!menuTarget || busy} onClick={() => menuTarget && void duplicate(menuTarget)}><ContentCopy fontSize="small" sx={{ mr: 1 }} />Duplicar</MenuItem><MenuItem onClick={() => { if (menuTarget) setDeleteId(menuTarget.id); setMenuAnchor(null); setMenuTarget(null); }}><DeleteOutline fontSize="small" sx={{ mr: 1 }} />Eliminar</MenuItem></Menu>
    <Dialog open={!!deleteId || newConfirm} onClose={() => { setDeleteId(null); setNewConfirm(false); }} fullWidth maxWidth="xs"><DialogTitle>{deleteId ? '¿Eliminar esta publicación?' : 'Tienes un borrador en curso'}</DialogTitle><DialogContent><Typography color="text.secondary">{deleteId ? 'Se eliminará de Mis publicaciones en todos tus dispositivos. Esta acción no se puede deshacer.' : `Empezaste "${draft?.product || 'una publicación'}" y aún no la terminas. ¿Quieres continuarla o empezar una nueva?`}</Typography></DialogContent><DialogActions sx={{ p: 2.5, pt: 0 }}><Button onClick={() => { setDeleteId(null); setNewConfirm(false); if (newConfirm && draft) resume(draft); }}>{deleteId ? 'Cancelar' : 'Continuar borrador'}</Button><Button variant="contained" color={deleteId ? 'error' : 'primary'} disabled={busy} onClick={() => deleteId ? void remove() : (() => { setDraft(newDesign(brand)); setStep(0); setView('create'); setNewConfirm(false); })()}>{deleteId ? 'Eliminar' : 'Empezar nueva'}</Button></DialogActions></Dialog>
  </Box>;
}

const tile = { p: 2.25, borderRadius: '16px' };
const navy = 'radial-gradient(circle at 85% 10%, rgba(47,91,255,.6), transparent 50%), radial-gradient(circle at 0% 100%, rgba(46,139,255,.28), transparent 45%), #0B1220';

/** Ilustración de la guía de marca: una foto real que se convierte en publicación. */
function HeroVisual() {
  const note = { position: 'absolute', zIndex: 2, px: 1.25, py: .5, borderRadius: '8px', bgcolor: '#FFFFFF', color: '#101418', fontSize: 13, fontWeight: 600, fontStyle: 'italic', boxShadow: '0 6px 16px rgba(0,0,0,.25)' } as const;
  const card = { position: 'absolute', display: 'block', objectFit: 'cover', borderRadius: '16px', border: '4px solid #FFFFFF', boxShadow: '0 18px 40px rgba(0,0,0,.4)' } as const;
  return <Box aria-hidden sx={{ position: 'relative', height: 290, display: { xs: 'none', md: 'block' } }}>
    <Box sx={{ ...note, left: '2%', top: 4, transform: 'rotate(-5deg)' }}>De tu foto…</Box>
    <Box component="img" src="/ejemplo/foto-producto.webp" alt="" sx={{ ...card, left: '2%', top: 38, width: '38%', aspectRatio: '3/4', transform: 'rotate(-6deg)' }} />
    <ArrowForward sx={{ position: 'absolute', left: '41%', top: '50%', color: 'rgba(255,255,255,.8)', fontSize: 30 }} />
    <Box sx={{ ...note, right: '6%', top: 0, transform: 'rotate(4deg)' }}>…a una publicación lista</Box>
    <Box component="img" src="/ejemplo/publicacion.webp" alt="" sx={{ ...card, right: '2%', top: 34, width: '50%', aspectRatio: '1', transform: 'rotate(4deg)' }} />
    <Stack direction="row" spacing={.5} sx={{ position: 'absolute', right: '8%', bottom: 0, zIndex: 2 }}>{outputs.map(network => <NetworkIcon key={network} network={network} size={14} badge />)}</Stack>
  </Box>;
}

function HomeView({ userName, brand, draft, history, begin, resume, navigate }: { userName: string; brand: Brand; draft: Design | null; history: Design[]; begin: () => void; resume: (design: Design) => void; navigate: (view: View) => void }) {
  const unfinished = draft && (draft.product || draft.images.length) && !history.some(item => item.id === draft.id) ? draft : null;
  const today = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  const howTo = [
    { title: 'Sube una foto', body: 'Desde tu celular o computadora.', icon: AddPhotoAlternateOutlined },
    { title: 'Elige para qué es', body: 'Vender, una oferta, un evento…', icon: TouchAppOutlined },
    { title: 'Compártela', body: 'En Instagram, Facebook o WhatsApp.', icon: IosShare },
  ];
  return <Stack spacing={{ xs: 2.5, sm: 3.5 }}>
    <Box><Typography variant="h1">¡Hola, {userName.split(' ')[0] || 'emprendedor'}!</Typography><Typography color="text.secondary" sx={{ mt: .5, '&::first-letter': { textTransform: 'uppercase' } }}>{today}</Typography></Box>
    {unfinished && <Paper variant="outlined" sx={{ ...tile, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', borderColor: '#C9D6FF', bgcolor: '#F5F8FF' }}><Box sx={{ width: 44, height: 44, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: '#FFFFFF', color: 'primary.main', border: '1px solid #DCE4FF' }}><EditNote /></Box><Box sx={{ flex: 1, minWidth: 200 }}><Typography fontWeight={650}>Tienes una publicación sin terminar</Typography><Typography variant="body2" color="text.secondary">{unfinished.product || 'Tu próxima publicación'}</Typography></Box><Button variant="contained" onClick={() => resume(unfinished)} endIcon={<ArrowForward />}>Continuar</Button></Paper>}
    <Box sx={{ borderRadius: '24px', overflow: 'hidden', color: '#FFFFFF', background: navy, p: { xs: 3, sm: 4, md: 5 }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, .9fr)' }, gap: 4, alignItems: 'center' }}>
      <Box>
        <Typography sx={{ fontSize: { xs: '1.75rem', sm: '2.2rem', lg: '2.6rem' }, fontWeight: 700, lineHeight: 1.08, letterSpacing: '-.04em' }}>Tu contenido,<br /><Box component="span" sx={{ color: '#6E9BFF' }}>resuelto con claridad.</Box></Typography>
        <Typography sx={{ mt: 1.5, color: 'rgba(255,255,255,.74)', maxWidth: 440, fontSize: '1.02rem', lineHeight: 1.6 }}>Sube la foto de tu producto y en 3 pasos tendrás una publicación lista para tus redes.</Typography>
        <Button variant="contained" size="large" startIcon={<Add />} onClick={begin} sx={{ mt: 3, minHeight: 52, px: 3, fontSize: '1rem', boxShadow: '0 10px 24px rgba(47,91,255,.45)' }}>Crear publicación</Button>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 3 }}>{outputs.map(network => <NetworkIcon key={network} network={network} size={16} badge />)}<Typography variant="body2" sx={{ pl: .5, color: 'rgba(255,255,255,.62)' }}>Lista para tus redes</Typography></Stack>
      </Box>
      <HeroVisual />
    </Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5 }}>{howTo.map(({ title, body, icon: Icon }, index) => <Paper key={title} variant="outlined" sx={{ ...tile, display: 'flex', gap: 1.75, alignItems: 'center' }}>
      <Box sx={{ position: 'relative', width: 46, height: 46, borderRadius: '14px', display: 'grid', placeItems: 'center', bgcolor: '#EEF3FF', color: 'primary.main', flexShrink: 0 }}><Icon /><Box sx={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'primary.main', color: '#FFFFFF', fontSize: 11, fontWeight: 700, border: '2px solid #FFFFFF' }}>{index + 1}</Box></Box>
      <Box><Typography fontWeight={650}>{title}</Typography><Typography variant="body2" color="text.secondary">{body}</Typography></Box>
    </Paper>)}</Box>
    {!brand.name && <Paper variant="outlined" sx={{ ...tile, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}><Box sx={{ width: 44, height: 44, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(111,217,193,.18)', color: '#1F9C80' }}><Storefront /></Box><Box sx={{ flex: 1, minWidth: 200 }}><Typography fontWeight={650}>Agrega tu negocio</Typography><Typography variant="body2" color="text.secondary">Tu nombre, logo y colores aparecerán en cada publicación.</Typography></Box><Button variant="outlined" onClick={() => navigate('brand')} endIcon={<ArrowForward />}>Agregar</Button></Paper>}
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}><Typography variant="h2">Tus publicaciones</Typography>{history.length > 3 && <Button onClick={() => navigate('history')} endIcon={<ArrowForward />}>Ver todas</Button>}</Stack>
      {history.length ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 2 }}>{history.slice(0, 3).map(item => <PublicationCard key={item.id} item={item} onOpen={() => resume(item)} />)}</Box>
        : <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, borderRadius: '20px', display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', gap: { xs: 2.5, sm: 4 } }}>
          <Box aria-hidden sx={{ position: 'relative', width: 170, height: 120, flexShrink: 0 }}>{[-10, 0, 10].map((angle, index) => <Box key={angle} sx={{ position: 'absolute', left: 10 + index * 40, top: index === 1 ? 0 : 16, width: 70, height: 90, borderRadius: '12px', bgcolor: index === 1 ? '#EEF3FF' : '#F7F8FA', border: '1.5px dashed', borderColor: index === 1 ? '#AFC0FF' : '#D3DAE5', transform: `rotate(${angle}deg)`, zIndex: index === 1 ? 1 : 0, display: 'grid', placeItems: 'center' }}><NetworkIcon network={outputs[index]} size={22} /></Box>)}</Box>
          <Box sx={{ flex: 1, textAlign: { xs: 'center', sm: 'left' } }}><Typography fontWeight={650} fontSize="1.08rem">Aquí verás tus publicaciones</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .5, maxWidth: 420 }}>Cada una queda guardada para que la vuelvas a compartir cuando quieras.</Typography><Button variant="outlined" startIcon={<Add />} onClick={begin} sx={{ mt: 2 }}>Crear mi primera publicación</Button></Box>
        </Paper>}
    </Box>
  </Stack>;
}

function PublicationCard({ item, onOpen }: { item: Design; onOpen: () => void }) {
  const sent = outputs.filter(network => item.publications?.[network]?.status === 'sent');
  return <Card variant="outlined" sx={{ borderRadius: '18px', transition: 'transform 160ms ease, box-shadow 160ms ease', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 12px 28px rgba(16,20,24,.08)' } }}><CardActionArea onClick={onOpen}>
    <Box sx={{ aspectRatio: '4/3', overflow: 'hidden', bgcolor: '#F2F5FA' }}><Thumbnail design={item} /></Box>
    <CardContent sx={{ p: 2 }}>
      <Typography fontWeight={650} noWrap>{item.title || item.product}</Typography>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
        {sent.length ? <Stack direction="row" spacing={.5} alignItems="center">{sent.map(network => <NetworkIcon key={network} network={network} size={16} />)}<Typography variant="caption" color="text.secondary" sx={{ pl: .25 }}>Publicada</Typography></Stack> : <Typography variant="caption" color="primary.main" fontWeight={600}>Abrir y compartir</Typography>}
        <Typography variant="caption" color="text.secondary">{new Date(item.updatedAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}</Typography>
      </Stack>
    </CardContent>
  </CardActionArea></Card>;
}

function HistoryView({ history, visibleHistory, query, setQuery, filter, setFilter, begin, resume, onMenu, onDelete }: { history: Design[]; visibleHistory: Design[]; query: string; setQuery: (value: string) => void; filter: string; setFilter: (value: string) => void; begin: () => void; resume: (design: Design) => void; onMenu: (event: React.MouseEvent<HTMLElement>, item: Design) => void; onDelete: (id: string) => void }) {
  return <Stack spacing={2.5}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'flex-end' }} spacing={2}><Box><Typography variant="overline" color="primary.dark" sx={{ letterSpacing: '.12em', fontWeight: 900 }}>Tu colección de ideas</Typography><Typography variant="h1">Mis publicaciones</Typography><Typography color="text.secondary">Recupera, duplica y vuelve a darle vida a tus diseños.</Typography></Box><Button variant="contained" startIcon={<Add />} onClick={begin}>Crear publicación</Button></Stack><Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}><TextField fullWidth size="small" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por título o producto" aria-label="Buscar publicaciones" InputProps={{ startAdornment: <Search color="action" sx={{ mr: 1 }} /> }} sx={{ flex: 1 }} /><Select size="small" value={filter} onChange={event => setFilter(event.target.value)} aria-label="Filtrar publicaciones" sx={{ width: { xs: '100%', md: 'auto' }, minWidth: { md: 210 } }}>{historyFilters.map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}</Select></Stack>{visibleHistory.length ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }, gap: 2 }}>{visibleHistory.map(item => <Card key={item.id} variant="outlined" sx={{ overflow: 'hidden' }}><Box component="button" type="button" onClick={() => resume(item)} aria-label={`Editar ${item.title || item.product}`} sx={{ width: '100%', p: 0, border: 0, display: 'block', cursor: 'pointer', aspectRatio: '16/9', overflow: 'hidden', bgcolor: '#F2F5FA' }}><Thumbnail design={item} /></Box><CardContent><Stack direction="row" justifyContent="space-between" alignItems="start" spacing={1}><Chip size="small" label={statusOf(item).label} color={statusOf(item).color} variant="outlined" /><IconButton size="small" onClick={event => onMenu(event, item)} aria-label="Más acciones"><MoreHoriz /></IconButton></Stack><Typography variant="h3" sx={{ mt: 1 }} noWrap>{item.title || item.product}</Typography><Typography variant="body2" color="text.secondary">{versionsLabel}</Typography>{publishedIn(item, 'sent').length > 0 && <Typography variant="caption" color="success.main" display="block">Publicada en {publishedIn(item, 'sent').join(', ')}</Typography>}{publishedIn(item, 'error').length > 0 && <Typography variant="caption" color="error.main" display="block">Error al publicar en {publishedIn(item, 'error').join(', ')}</Typography>}<Typography variant="caption" color="text.secondary" display="block" sx={{ mt: .5 }}>Actualizado {new Date(item.updatedAt).toLocaleDateString('es-PE')}</Typography><Stack direction="row" spacing={1} sx={{ mt: 2 }}><Button size="small" onClick={() => resume(item)} endIcon={<ArrowForward />}>Editar</Button><Tooltip title="Eliminar"><IconButton size="small" color="error" onClick={() => onDelete(item.id)} aria-label={`Eliminar ${item.title || item.product}`}><DeleteOutline /></IconButton></Tooltip></Stack></CardContent></Card>)}</Box> : <Paper variant="outlined" sx={{ textAlign: 'center', p: { xs: 3, sm: 6 }, borderStyle: 'dashed' }}><FolderOpen sx={{ fontSize: 42, color: 'primary.main' }} /><Typography variant="h2" sx={{ mt: 1.5 }}>{history.length ? 'No encontramos coincidencias' : 'Tu primera publicación te espera'}</Typography><Typography color="text.secondary" sx={{ mt: .75 }}>{history.length ? 'Prueba con otro nombre o filtro.' : 'Las publicaciones que crees aparecerán aquí, listas para volver a editarlas o publicarlas.'}</Typography><Button variant="contained" sx={{ mt: 2 }} onClick={begin} endIcon={<ArrowForward />}>Crear publicación</Button></Paper>}<Typography variant="caption" color="text.secondary">Cada publicación que creas o generas se guarda aquí automáticamente en tu cuenta, y la ves desde cualquier dispositivo.</Typography></Stack>;
}

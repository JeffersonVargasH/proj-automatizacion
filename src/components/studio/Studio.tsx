'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Copy, Download, FolderOpen, Home, Palette, Plus, Search, Sparkles, Store, Trash2, X } from 'lucide-react';
import { Brand, Design, duplicateDesign, emptyBrand, formats, newDesign } from '@/lib/studio';
import { storage } from '@/lib/studio-storage';
import { renderDesign } from '@/lib/studio-renderer';
import { BrandForm } from './BrandForm';
import { CreateFlow } from './CreateFlow';
import { Editor } from './Editor';
import { Panel } from './Fields';

type View = 'home' | 'brand' | 'create' | 'editor' | 'history';
function Thumbnail({ design }: { design: Design }) {
  const [src, setSrc] = useState('');
  useEffect(() => { let live = true; void renderDesign(design).then(canvas => { if (live) setSrc(canvas.toDataURL('image/jpeg', 0.55)); }).catch(() => {}); return () => { live = false; }; }, [design]);
  return src ? <img src={src} alt={design.title || design.product} /> : <div className="thumbnail-placeholder"><Palette size={32} /><span>{design.product}</span></div>;
}
export default function Studio() {
  const [view, setView] = useState<View>('home'), [brand, setBrand] = useState<Brand>(emptyBrand);
  const [draft, setDraft] = useState<Design | null>(null), [history, setHistory] = useState<Design[]>([]), [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false), [storageAvailable, setStorageAvailable] = useState(true), [storageStatus, setStorageStatus] = useState('');
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('Todos'), [createAfterBrand, setCreateAfterBrand] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null), [newConfirm, setNewConfirm] = useState(false), [busy, setBusy] = useState(false);
  const main = useRef<HTMLElement>(null);
  const notify = (message: string, error = false) => setNotice({ message, error });
  useEffect(() => {
    let active = true;
    void Promise.all([storage.get<Brand>('brand'), storage.get<Design>('draft'), storage.get<Design[]>('history')]).then(async ([b, d, h]) => {
      if (!active) return;
      setBrand(b || emptyBrand); setDraft(d || null);
      // Preserve the earlier prototype's saved designs without deleting its storage.
      if (!h) {
        try {
          const legacy: unknown = JSON.parse(localStorage.getItem('impulsa-design-history') || '[]');
          if (Array.isArray(legacy)) {
            h = legacy.filter(item => item && typeof item.headline === 'string').map(item => ({ ...newDesign(b || emptyBrand), product: item.headline.slice(0, 80), title: item.headline.slice(0, 80), body: typeof item.description === 'string' ? item.description.slice(0, 180) : '', images: typeof item.image === 'string' && item.image.startsWith('data:image/') ? [item.image] : [], color: /^#[0-9a-f]{6}$/i.test(item.accent) ? item.accent : emptyBrand.primary, format: item.format === 'story' ? 'story' : item.format === 'whatsapp' ? 'whatsapp' : 'instagram' }));
            if (h.length) await storage.put('history', h);
          }
        } catch { /* Malformed legacy data stays untouched. */ }
      }
      if (active) setHistory(h || []);
    }).catch(e => { if (active) { setStorageAvailable(false); notify((e as Error).message + ' Puedes editar, pero los cambios no se conservarán al cerrar.', true); } }).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!loaded || !draft || !storageAvailable) return;
    let active = true; setStorageStatus('Guardando borrador…');
    const timer = setTimeout(() => { void storage.put('draft', draft).then(() => { if (active) setStorageStatus('Borrador guardado en este navegador'); }).catch(e => { if (active) { setStorageStatus('No se pudo guardar el borrador'); notify((e as Error).message, true); } }); }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [draft, loaded, storageAvailable]);
  useEffect(() => { main.current?.scrollTo({ top: 0 }); }, [view, step]);
  const update = (patch: Partial<Design>) => setDraft(current => current ? { ...current, ...patch, updatedAt: new Date().toISOString() } : current);
  function begin() {
    if (!brand.name) { setCreateAfterBrand(true); setView('brand'); return; }
    if (draft && (draft.product || draft.images.length)) { setNewConfirm(true); return; }
    setDraft(newDesign(brand)); setStep(0); setView('create');
  }
  function resume(d: Design) {
    const latest = draft?.id === d.id && draft.updatedAt > d.updatedAt ? draft : d;
    setDraft(latest); setStep(latest.images.length && latest.product ? 4 : 1);
    setView(latest.images.length && latest.title ? 'editor' : 'create');
  }
  async function save() {
    if (!draft || !draft.images.length || !draft.title.trim()) { notify('Agrega al menos una imagen y un título.', true); return; }
    try { const next = [draft, ...history.filter(item => item.id !== draft.id)]; await storage.put('history', next); setHistory(next); notify('Diseño guardado en Mis publicaciones.'); } catch (e) { notify((e as Error).message, true); }
  }
  const visibleHistory = history.filter(item => `${item.title} ${item.product}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()) && (filter === 'Todos' || (filter === 'Con fecha deseada' ? item.schedule : !item.schedule)));
  const nav = [{ id: 'home' as View, label: 'Inicio', icon: Home }, { id: 'create' as View, label: 'Crear', icon: Plus }, { id: 'history' as View, label: 'Mis publicaciones', icon: FolderOpen }, { id: 'brand' as View, label: 'Mi negocio', icon: Store }];
  return <div className="studio-shell"><aside className="sidebar"><a href="#inicio" className="wordmark" onClick={e => { e.preventDefault(); setView('home'); }}><span><Sparkles size={22} /></span>impulsa<b>✦</b></a><p className="sidebar-caption">IDEAS QUE HACEN CRECER</p><nav aria-label="Navegación principal">{nav.map(({ id, label, icon: Icon }) => <button key={id} className={(view === id || id === 'create' && view === 'editor') ? 'active' : ''} onClick={() => id === 'create' ? begin() : setView(id)}><Icon size={20} /><span>{label}</span>{id === 'create' && <ArrowRight size={16} />}</button>)}</nav><div className="sidebar-note"><div className="little-spark">✦</div><b>Tu próxima idea<br />merece verse bien.</b><p>Un pequeño paso para tu gran negocio.</p></div><div className="business-mini"><div style={{ background: brand.primary }}>{brand.logo ? <img src={brand.logo} alt="" /> : <Store size={20} />}</div><span><b>{brand.name || 'Tu negocio'}</b><small>Estudio de publicaciones</small></span></div></aside>
    <div className="workspace"><header className="topbar"><span className="breadcrumb">Tu espacio creativo <span>/</span> <b>{view === 'editor' ? 'Editor' : nav.find(n => n.id === view)?.label}</b></span><span className="local-badge"><span />Guardado local</span></header>
      <main ref={main} className="studio-main" id="contenido"><div className="content-container">
        {!loaded ? <div className="empty-state" role="status">Preparando tu espacio…</div> : <>
          {notice && <div className={`notice ${notice.error ? 'notice-error' : ''}`} role={notice.error ? 'alert' : 'status'}><span>{notice.message}</span><button aria-label="Cerrar mensaje" onClick={() => setNotice(null)}><X size={18} /></button></div>}
          {view === 'home' && <><div className="home-intro"><div><span className="eyebrow">HECHO PARA EMPRENDEDORES</span><h1>Hola{brand.name ? `, ${brand.name}` : ''} <span className="greeting">✳</span></h1><p>Hoy es un buen día para mostrar lo que haces.</p></div><span className="home-date">Tu negocio, a tu manera.</span></div>
            <section className="hero"><div className="hero-copy"><span className="hero-label"><Sparkles size={15} /> TU CREATIVIDAD EMPIEZA AQUÍ</span><h2>Grandes ideas.<br />Publicaciones <em>muy tuyas.</em></h2><p>Convierte las fotos de tus productos en flyers, posts e historias. Con tu marca y sin empezar de cero.</p><button className="cream-button" onClick={begin}>Crear publicación <ArrowRight size={19} /></button><small>Elige · Personaliza · Comparte</small></div><div className="hero-art" aria-hidden="true"><div className="hero-orbit" /><div className="sample-card back-card"><span>CREADO POR TI</span><div className="abstract-product"><div /><div /></div><b>Pequeños detalles.<br />Grandes momentos.</b></div><div className="sample-card front-card"><div className="sample-brand">TU MARCA <span>✳</span></div><div className="abstract-product"><div /><div /></div><p>HECHO CON MUCHO AMOR</p><b>Tu próximo<br /><em>favorito.</em></b><span className="sample-pill">Descúbrelo →</span></div><div className="art-sticker"><Check size={16} />Con tu identidad</div></div></section>
            <div className="home-section-title"><h2>De tu idea a tus clientes</h2><span>Así de sencillo</span></div><div className="how-grid">{[{ n: '01', title: 'Cuéntanos tu idea', body: 'Elige un objetivo y agrega las fotos de tu producto.', icon: Sparkles }, { n: '02', title: 'Dale tu estilo', body: 'Prueba colores, ajusta el mensaje y encuentra tu formato.', icon: Palette }, { n: '03', title: 'Haz que te vean', body: 'Descarga tu diseño y compártelo en tus redes.', icon: Download }].map(({ n, title, body, icon: Icon }) => <div className="how-card" key={n}><div><Icon size={21} /><span>{n}</span></div><h3>{title}</h3><p>{body}</p></div>)}</div>
            <div className="home-bottom"><Panel className="brand-nudge"><Store size={27} /><div><h2>{brand.name ? 'Tu marca ya tiene su espacio' : 'Primero, hagámoslo tuyo'}</h2><p>{brand.name ? 'Nombre, colores y contacto listos para tus nuevas ideas.' : 'Agrega tu logo, colores y contacto. Solo necesitas hacerlo una vez.'}</p></div><button className="text-button" onClick={() => setView('brand')}>{brand.name ? 'Editar mi negocio' : 'Configurar mi negocio'}<ArrowRight size={16} /></button></Panel>{draft && <Panel title="Una idea en camino"><p className="hint">{draft.product || 'Tu próxima publicación'}</p><button className="secondary" onClick={() => resume(draft)}>Continuar borrador<ArrowRight size={16} /></button></Panel>}</div>
            <div className="home-section-title"><h2>Tus últimas publicaciones</h2><button className="text-button" onClick={() => setView('history')}>Ver todas<ArrowRight size={16} /></button></div>{history.length ? <div className="recent-grid">{history.slice(0, 3).map(item => <button className="recent-card" key={item.id} onClick={() => resume(item)}><div><Thumbnail design={item} /></div><b>{item.title || item.product}</b><small>{formats[item.format].label}</small></button>)}</div> : <div className="empty-inline"><FolderOpen size={24} /><span>Aquí vivirán tus ideas. Crea y guarda tu primera publicación.</span></div>}
          </>}
          {view === 'brand' && <BrandForm key={brand.name + brand.logo.length} initial={brand} onSave={async next => { try { await storage.put('brand', next); setBrand(next); notify('Datos del negocio guardados. Se usarán en las nuevas publicaciones.'); if (createAfterBrand) { setCreateAfterBrand(false); setDraft(newDesign(next)); setStep(0); setView('create'); } } catch (e) { notify((e as Error).message, true); } }} />}
          {view === 'create' && draft && <CreateFlow design={draft} update={update} step={step} setStep={setStep} onCreate={() => setView('editor')} />}
          {view === 'editor' && draft && <Editor key={draft.id} design={draft} update={update} onSave={save} notify={notify} onBack={() => { setStep(4); setView('create'); }} />}
          {(view === 'editor' || view === 'create') && draft && <p className="draft-status" role="status">{storageAvailable ? storageStatus : 'Almacenamiento no disponible: los cambios no se conservarán.'}</p>}
          {view === 'history' && <><div className="page-heading editor-heading"><div><span className="eyebrow">TU COLECCIÓN DE IDEAS</span><h1>Mis publicaciones</h1><p>Recupera, duplica y vuelve a darle vida a tus diseños.</p></div><button className="primary" onClick={begin}><Plus size={18} />Crear publicación</button></div><div className="history-tools"><label className="search-field"><Search size={18} /><input aria-label="Buscar publicaciones" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por título o producto" /></label><select aria-label="Filtrar publicaciones" value={filter} onChange={e => setFilter(e.target.value)}>{['Todos', 'Diseños guardados', 'Con fecha deseada'].map(f => <option key={f}>{f}</option>)}</select></div>
            {visibleHistory.length ? <div className="history-grid">{visibleHistory.map(item => <article className="history-card" key={item.id}><button className="history-image" onClick={() => resume(item)} aria-label={`Editar ${item.title || item.product}`}><Thumbnail design={item} /></button><div className="history-info"><span className="tag">{item.schedule ? 'Fecha deseada · pendiente' : 'Guardado'}</span><h2>{item.title || item.product}</h2><p>{formats[item.format].label}</p><small>Actualizado {new Date(item.updatedAt).toLocaleDateString('es-PE')}</small><div className="actions"><button className="text-button" onClick={() => resume(item)}>Editar<ArrowRight size={15} /></button><button className="icon-button" aria-label={`Duplicar ${item.title || item.product}`} disabled={busy} onClick={async () => { setBusy(true); try { const copy = duplicateDesign(item); const next = [copy, ...history]; await storage.put('history', next); setHistory(next); resume(copy); notify('Copia creada. El original sigue en tu historial.'); } catch (e) { notify((e as Error).message, true); } finally { setBusy(false); } }}><Copy size={17} /></button><button className="icon-button danger" aria-label={`Eliminar ${item.title || item.product}`} onClick={() => setDeleteId(item.id)}><Trash2 size={17} /></button></div></div></article>)}</div> : <div className="empty-state"><FolderOpen size={38} /><h2>{history.length ? 'No encontramos coincidencias' : 'Tu primera publicación te espera'}</h2><p>{history.length ? 'Prueba con otro nombre o filtro.' : 'Los diseños que guardes aparecerán aquí, listos para volver a editarlos.'}</p><button className="primary" onClick={begin}>Crear publicación<ArrowRight size={18} /></button></div>}<p className="hint">Tus diseños se guardan en este navegador. Todavía no se sincronizan entre dispositivos.</p>
          </>}
        </>}
      </div><footer className="content-footer">Hecho para dar impulso a tu negocio. <span>✦</span></footer></main>
      <nav className="mobile-nav" aria-label="Navegación móvil">{nav.map(({ id, label, icon: Icon }) => <button key={id} className={view === id || id === 'create' && view === 'editor' ? 'active' : ''} onClick={() => id === 'create' ? begin() : setView(id)}><Icon size={21} /><span>{label}</span></button>)}</nav>
    </div>
    {(deleteId || newConfirm) && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onKeyDown={e => { if (e.key === 'Escape') { setDeleteId(null); setNewConfirm(false); } if (e.key === 'Tab') { const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')); const first = buttons[0], last = buttons[buttons.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } } }}><h2 id="dialog-title">{deleteId ? '¿Eliminar esta publicación?' : 'Tienes un borrador en curso'}</h2><p>{deleteId ? 'Se eliminará del historial de este navegador. Esta acción no se puede deshacer.' : 'Puedes continuar tu borrador o empezar uno nuevo. Si ya guardaste el diseño, seguirá en Mis publicaciones.'}</p><div className="actions"><button autoFocus className="secondary" disabled={busy} onClick={() => { setDeleteId(null); setNewConfirm(false); if (newConfirm && draft) resume(draft); }}>{deleteId ? 'Cancelar' : 'Continuar borrador'}</button><button className={deleteId ? 'primary danger-button' : 'primary'} disabled={busy} onClick={async () => { if (deleteId) { setBusy(true); try { const next = history.filter(item => item.id !== deleteId); await storage.put('history', next); setHistory(next); setDeleteId(null); notify('Publicación eliminada del historial.'); } catch (e) { notify((e as Error).message, true); } finally { setBusy(false); } } else { setDraft(newDesign(brand)); setStep(0); setView('create'); setNewConfirm(false); } }}>{deleteId ? 'Eliminar' : 'Empezar nueva'}</button></div></section></div>}
  </div>;
}

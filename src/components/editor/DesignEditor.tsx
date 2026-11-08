'use client';

// Editor visual (fase 3A): lienzo, edición directa de textos, panel de propiedades, panel de capas,
// agregar texto/formas/imágenes locales, deshacer/rehacer y exportar PNG. Está desacoplado de Clic: recibe
// un documento (escenas + campos comerciales) y avisa de los cambios con `onChange`. Todavía no se usa en la app.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AddPhotoAlternateOutlined, CategoryOutlined, Download, Redo, TextFields, Undo } from '@mui/icons-material';
import { Alert, Box, Button, IconButton, ListItemIcon, Menu, MenuItem, Paper, Skeleton, Stack, Tab, Tabs, Tooltip, Typography } from '@mui/material';
import { CircleOutlined, Crop54, HorizontalRule, Sell } from '@mui/icons-material';
import { NetworkIcon, networkLook } from '@/components/brand/NetworkIcon';
import { loadImage, startDownload } from '@/lib/editor/canvas-assets';
import { currentScene, createEditorState, editorCanRedo, editorCanUndo, editorReducer, selectedLayer, type EditorDocument, type TextMeasure } from '@/lib/editor/editor-state';
import { exportFilename } from '@/lib/editor/export';
import { newImageLayer, newShapeLayer, newTextLayer } from '@/lib/editor/new-layers';
import type { Arrange } from '@/lib/editor/operations';
import { sceneFormats, type Layer, type SceneFormat, type ShapeKind } from '@/lib/editor/scene';
import { readPhoto } from '@/lib/studio-storage';
import { LayersPanel } from './LayersPanel';
import { PropertiesPanel } from './PropertiesPanel';

// Konva solo existe en el navegador: el lienzo se carga aparte y nunca se prerenderiza en el servidor.
const SceneCanvas = dynamic(() => import('./SceneCanvas'), { ssr: false, loading: () => <Skeleton variant="rounded" width="100%" height={320} /> });

const formatOrder = Object.keys(sceneFormats) as SceneFormat[];
const ratioLabel: Record<SceneFormat, string> = { instagram: '1:1', facebook: '1.91:1', whatsapp: '9:16' };
const shapeOptions: { kind: ShapeKind; label: string; icon: typeof Crop54 }[] = [
  { kind: 'rect', label: 'Rectángulo', icon: Crop54 },
  { kind: 'ellipse', label: 'Círculo', icon: CircleOutlined },
  { kind: 'badge', label: 'Etiqueta', icon: Sell },
  { kind: 'line', label: 'Línea', icon: HorizontalRule },
];

export type DesignEditorProps = {
  document: EditorDocument;
  initialFormat?: SceneFormat;
  onChange?: (document: EditorDocument) => void;
  /** Aviso opcional con el PNG exportado (por ejemplo, para una vista previa). El PNG se descarga siempre. */
  onExport?: (blob: Blob, format: SceneFormat) => void;
};

export default function DesignEditor({ document, initialFormat, onChange, onExport }: DesignEditorProps) {
  const [state, dispatch] = useReducer(editorReducer, undefined, () => createEditorState(document, initialFormat));
  const scene = currentScene(state);
  const values = state.history.present.values;
  const selected = selectedLayer(state);
  const frame = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [exporting, setExporting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [brokenImages, setBrokenImages] = useState<string[]>([]);
  const [download, setDownload] = useState<{ url: string; filename: string; size: string } | null>(null);
  const [shapeMenu, setShapeMenu] = useState<HTMLElement | null>(null);

  // Medición de textos con Konva (se carga junto con el lienzo) para que las cajas crezcan con el contenido.
  const measure = useRef<TextMeasure | undefined>(undefined);
  useEffect(() => { let live = true; void import('@/lib/editor/konva-measure').then(module => { if (live) measure.current = module.measureTextHeight; }); return () => { live = false; }; }, []);

  // La URL del último PNG se conserva para el enlace manual y se libera al reemplazarla o al cerrar el editor.
  useEffect(() => () => { if (download) URL.revokeObjectURL(download.url); }, [download]);

  // El lienzo se adapta al espacio disponible (ancho del contenedor y alto de la ventana).
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const resize = () => setBox({ width: element.clientWidth, height: Math.max(260, Math.min(window.innerHeight * 0.72, 900)) });
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    window.addEventListener('resize', resize);
    return () => { observer.disconnect(); window.removeEventListener('resize', resize); };
  }, []);

  // Avisa de los cambios del documento: solo cuando cambia de verdad (no al montar, ni dos veces en modo estricto).
  const notified = useRef(state.history.present);
  const notify = useRef(onChange);
  useEffect(() => { notify.current = onChange; }, [onChange]);
  useEffect(() => {
    if (state.history.present === notified.current) return;
    notified.current = state.history.present;
    notify.current?.(state.history.present);
  }, [state.history.present]);

  // Atajos de teclado. Nunca actúan mientras se escribe en un campo o en el texto del lienzo,
  // para no quitarle al navegador su propio deshacer.
  const selectedRef = useRef(selected);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      const mod = event.ctrlKey || event.metaKey;
      const current = selectedRef.current;
      if (mod && event.key.toLowerCase() === 'z') { event.preventDefault(); dispatch({ type: event.shiftKey ? 'redo' : 'undo' }); }
      else if (mod && event.key.toLowerCase() === 'y') { event.preventDefault(); dispatch({ type: 'redo' }); }
      else if (mod && event.key.toLowerCase() === 'd' && current) { event.preventDefault(); dispatch({ type: 'duplicateLayer', id: current.id }); }
      else if ((event.key === 'Delete' || event.key === 'Backspace') && current && !current.locked) { event.preventDefault(); dispatch({ type: 'removeLayer', id: current.id }); }
      else if (event.key === 'Escape') dispatch({ type: 'select', id: null });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onSelect = useCallback((id: string | null) => dispatch({ type: 'select', id }), []);
  const onCommit = useCallback((id: string, patch: Partial<Layer>) => dispatch({ type: 'commitLayer', id, patch }), []);
  const onEditText = useCallback((id: string, text: string) => dispatch({ type: 'setText', id, text, measure: measure.current }), []);
  const onImageErrors = useCallback((sources: string[]) => setBrokenImages(sources), []);
  const layerActions = {
    change: (id: string, patch: Partial<Layer>, transient?: boolean) => dispatch({ type: 'commitLayer', id, patch, transient, measure: measure.current }),
    setText: (id: string, text: string, transient?: boolean) => dispatch({ type: 'setText', id, text, transient, measure: measure.current }),
    settle: () => dispatch({ type: 'settle' }),
    select: (id: string) => dispatch({ type: 'select', id }),
    arrange: (id: string, where: Arrange) => dispatch({ type: 'arrangeLayer', id, where }),
    duplicate: (id: string) => dispatch({ type: 'duplicateLayer', id }),
    remove: (id: string) => dispatch({ type: 'removeLayer', id }),
  };

  async function addImage(file: File | undefined) {
    if (!file || !scene) return;
    setAdding(true); setError('');
    try {
      // Misma validación y reducción que las fotos de Clic (JPG, PNG o WebP de hasta 8 MB). Queda solo en este editor.
      const src = await readPhoto(file);
      const image = await loadImage(src);
      dispatch({ type: 'addLayer', layer: newImageLayer(scene, src, { width: image.naturalWidth, height: image.naturalHeight }, file.name.replace(/\.[^.]+$/, '') || 'Imagen') });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo agregar la imagen.');
    } finally {
      setAdding(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function exportPng() {
    if (!scene) return;
    setExporting(true); setError('');
    try {
      // Se exporta la escena tal como se ve. Si falla, se muestra el error: no hay otro renderizador de respaldo.
      const { renderSceneToBlob } = await import('@/lib/editor/konva-export');
      const blob = await renderSceneToBlob(scene, values);
      const url = URL.createObjectURL(blob);
      const filename = exportFilename(state.format, new Date());
      setDownload({ url, filename, size: `${scene.width} × ${scene.height} px` });
      startDownload(url, filename);
      onExport?.(blob, state.format);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo exportar el diseño.');
    } finally { setExporting(false); }
  }

  const available = formatOrder.filter(format => state.history.present.scenes[format]);
  const scale = scene && box.width ? Math.min(box.width / scene.width, box.height / scene.height) : 0;

  if (!scene) return <Alert severity="warning">Este diseño todavía no tiene una versión editable.</Alert>;

  return <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(0,1fr) 360px' }, alignItems: 'start' }} aria-label="Editor visual">
    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.25 }, borderRadius: '20px', minWidth: 0 }}>
      <Tabs value={state.format} onChange={(_, format: SceneFormat) => dispatch({ type: 'format', format })} variant="fullWidth" sx={{ mb: 1.5, minHeight: 44, bgcolor: '#F2F5FA', borderRadius: '12px', p: .5, '& .MuiTabs-indicator': { display: 'none' }, '& .MuiTab-root': { minHeight: 40, borderRadius: '9px', textTransform: 'none', fontWeight: 600, fontSize: { xs: '.8rem', sm: '.9rem' }, px: .5 }, '& .Mui-selected': { bgcolor: 'background.paper', boxShadow: '0 1px 3px rgba(16,20,24,.1)' } }}>
        {available.map(format => <Tab key={format} value={format} icon={<NetworkIcon network={format} size={18} />} iconPosition="start" label={`${networkLook[format].short} · ${ratioLabel[format]}`} sx={{ gap: .75, '& .MuiTab-icon': { m: 0 } }} />)}
      </Tabs>

      <Stack direction="row" alignItems="center" spacing={.5} sx={{ mb: 1.5, minHeight: 40, flexWrap: 'wrap', rowGap: 1 }}>
        <Tooltip title="Deshacer (Ctrl+Z)"><span><IconButton aria-label="Deshacer" disabled={!editorCanUndo(state)} onClick={() => dispatch({ type: 'undo' })}><Undo /></IconButton></span></Tooltip>
        <Tooltip title="Rehacer (Ctrl+Y)"><span><IconButton aria-label="Rehacer" disabled={!editorCanRedo(state)} onClick={() => dispatch({ type: 'redo' })}><Redo /></IconButton></span></Tooltip>
        <Box sx={{ width: 8 }} />
        <Button size="small" variant="outlined" startIcon={<TextFields />} onClick={() => dispatch({ type: 'addLayer', layer: newTextLayer(scene) })} sx={{ textTransform: 'none' }}>Texto</Button>
        <Button size="small" variant="outlined" startIcon={<CategoryOutlined />} onClick={event => setShapeMenu(event.currentTarget)} aria-haspopup="menu" sx={{ textTransform: 'none' }}>Forma</Button>
        <Button size="small" variant="outlined" startIcon={<AddPhotoAlternateOutlined />} disabled={adding} onClick={() => fileInput.current?.click()} sx={{ textTransform: 'none' }}>{adding ? 'Cargando…' : 'Imagen'}</Button>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="Elegir imagen" onChange={event => void addImage(event.target.files?.[0])} />
        <Menu anchorEl={shapeMenu} open={!!shapeMenu} onClose={() => setShapeMenu(null)}>
          {shapeOptions.map(({ kind, label, icon: Icon }) => <MenuItem key={kind} onClick={() => { setShapeMenu(null); dispatch({ type: 'addLayer', layer: newShapeLayer(scene, kind) }); }}><ListItemIcon><Icon fontSize="small" /></ListItemIcon>{label}</MenuItem>)}
        </Menu>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<Download />} disabled={exporting || brokenImages.length > 0} onClick={() => void exportPng()} sx={{ minHeight: 40, whiteSpace: 'nowrap' }}>{exporting ? 'Exportando…' : 'Exportar PNG'}</Button>
      </Stack>

      {brokenImages.length > 0 && <Alert severity="error" sx={{ mb: 1.5 }}>Una imagen del diseño no se pudo cargar. No se puede exportar hasta que cargue.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError('')}>{error}</Alert>}
      {download && !error && <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setDownload(null)}>
        Descargamos <strong>{download.filename}</strong> ({download.size}). ¿No aparece en tus descargas? <Box component="a" href={download.url} download={download.filename} sx={{ color: 'inherit', fontWeight: 700 }}>Descárgala aquí</Box>.
      </Alert>}

      <Box sx={{ p: { xs: .5, sm: 1.5 }, borderRadius: '14px', bgcolor: '#F2F5FA' }}>
        <Box ref={frame} sx={{ width: '100%', minHeight: 260, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {scale > 0 && <Box sx={{ boxShadow: '0 12px 32px rgba(35,55,90,.14)', lineHeight: 0 }}>
            <SceneCanvas scene={scene} values={values} scale={scale} selectedId={state.selectedId} onSelect={onSelect} onCommit={onCommit} onEditText={onEditText} onImageErrors={onImageErrors} />
          </Box>}
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>{scene.width} × {scene.height} px · Toca un elemento para elegirlo y arrástralo para moverlo. Doble clic sobre un texto para escribir (Ctrl+Enter o clic fuera para guardar, Esc para cancelar).</Typography>
    </Paper>

    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <PropertiesPanel layer={selected} scene={scene} values={values} actions={layerActions} />
      <LayersPanel scene={scene} selectedId={state.selectedId} actions={layerActions} />
    </Stack>
  </Box>;
}

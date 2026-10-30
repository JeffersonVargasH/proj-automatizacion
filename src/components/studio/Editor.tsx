'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowBack, AutoAwesome, CheckCircle, ContentCopy, Download, ExpandMore, Send, Share, Tune } from '@mui/icons-material';
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, CircularProgress, Paper, Slider, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { Brand, captionFor, captionLimits, Design, formats, Network, networks, outputs, styleLook, styles } from '@/lib/studio';
import { requestCopy } from '@/lib/copy';
import { downloadBlob, pngBlob, renderDesign } from '@/lib/studio-renderer';
import { NetworkIcon, networkLook } from '@/components/brand/NetworkIcon';
import { Choices, Field, Panel, Photos } from './Fields';

const tabs = ['Texto', 'Foto', 'Colores', 'Mover'];
const publicationLabels = { sending: 'Publicando…', sent: 'Publicada', error: 'No se pudo publicar' } as const;
const accordionSx = { borderRadius: '16px', '&:before': { display: 'none' } };

export function Editor({ design: d, update, notify, connections, onPublish, onConnect, onBack }: { design: Design; update: (patch: Partial<Design>) => void; notify: (message: string, error?: boolean) => void; connections: Brand['connections']; onPublish: (targets: Network[]) => Promise<void>; onConnect: () => void; onBack: () => void }) {
  const active = d.format as Network;
  const generation = d.generation;
  const generatedImageUrl = generation?.status === 'completed' ? generation.urls[active] : undefined;
  const readyAccounts = outputs.filter(network => connections[network].account.trim());
  const canExport = d.images.length > 0 && !!d.title.trim();
  const [publishing, setPublishing] = useState(false);
  const [writing, setWriting] = useState(false);
  const [preview, setPreview] = useState<{ url: string; blob: Blob; design: Design } | null>(null);
  const [renderState, setRenderState] = useState<{ design: Design; error: string; rendering: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  const [tab, setTab] = useState('Texto');
  const [element, setElement] = useState('Texto');
  const drag = useRef<{ x: number; y: number; a: number; b: number; width: number; height: number; element: string } | null>(null);

  useEffect(() => {
    let live = true;
    let url = '';
    const timer = setTimeout(() => {
      const result = generatedImageUrl
        ? fetch(generatedImageUrl).then(response => { if (!response.ok) throw new Error('No se pudo cargar la imagen generada.'); return response.blob(); })
        : renderDesign(d).then(pngBlob);
      void result.then(blob => { if (!live) return; const previewUrl = generatedImageUrl || (url = URL.createObjectURL(blob)); setPreview({ url: previewUrl, blob, design: d }); setRenderState({ design: d, error: '', rendering: false }); }).catch(reason => { if (live) setRenderState({ design: d, error: reason instanceof Error ? reason.message : 'No se pudo generar la vista previa.', rendering: false }); });
    }, 100);
    return () => { live = false; clearTimeout(timer); if (url) URL.revokeObjectURL(url); };
  }, [d, generatedImageUrl, retry]);

  const rendering = !renderState || renderState.design !== d || renderState.rendering;
  const renderError = renderState?.design === d ? renderState.error : '';
  const ready = !!preview && preview.design === d && !rendering && !renderError;
  const filename = `${d.product.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 50) || 'publicacion'}-${d.format}.png`;
  const finalFilename = generatedImageUrl ? filename.replace(/\.png$/, '.jpg') : filename;
  const label = networks[active]?.label || 'esta red';

  async function share() {
    if (!ready || !preview) return;
    const file = new File([preview.blob], finalFilename, { type: preview.blob.type || 'image/png' });
    try { if (navigator.canShare?.({ files: [file] }) && navigator.share) await navigator.share({ files: [file], title: d.title, text: captionFor(d, active) }); else { downloadBlob(preview.blob, finalFilename); notify('Guardamos la imagen en tus descargas. Ábrela desde WhatsApp o tu red social para enviarla.'); } }
    catch (reason) { if ((reason as Error).name !== 'AbortError') notify('No se pudo compartir. Descarga la imagen y envíala desde tu red social.', true); }
  }
  function download() {
    if (!preview) return;
    downloadBlob(preview.blob, finalFilename);
    notify('Imagen guardada en tus descargas.');
  }
  async function downloadAll() {
    try {
      for (const network of outputs) {
        const url = generation?.status === 'completed' ? generation.urls[network] : undefined;
        const blob = url ? await fetch(url).then(response => response.blob()) : await renderDesign({ ...d, format: network }).then(pngBlob);
        downloadBlob(blob, filename.replace(`-${d.format}.png`, `-${network}.${url ? 'jpg' : 'png'}`));
      }
      notify('Guardamos las versiones para Instagram, Facebook y WhatsApp.');
    } catch { notify('No se pudieron descargar todas las versiones. Inténtalo de nuevo.', true); }
  }
  // Solo cambia el texto para redes: el diseño ya aprobado no se toca.
  async function rewriteCaption() {
    setWriting(true);
    try { const { caption, captions, hashtags } = await requestCopy(d, captionFor(d, active)); update({ caption, captions, hashtags }); notify('Listo, escribimos un texto nuevo.'); }
    catch (error) { notify(error instanceof Error ? error.message : 'No se pudo escribir el texto.', true); }
    finally { setWriting(false); }
  }
  async function publishTo(targets: Network[]) { setPublishing(true); try { await onPublish(targets); } finally { setPublishing(false); } }
  // Editar el texto de una red no toca el de las otras; Instagram sigue siendo el `caption` principal.
  const setCaption = (value: string) => update({ captions: { ...d.captions, [active]: value }, ...(active === 'instagram' ? { caption: value } : {}) });
  async function copy() { try { await navigator.clipboard.writeText(captionFor(d, active) || `${d.title}\n${d.body}\n${d.cta}\n${d.hashtags}`); notify('Texto copiado. Pégalo al publicar tu foto.'); } catch { notify('No se pudo copiar. Mantén presionado el texto para copiarlo.', true); } }
  const move = (a: number, b: number, target: string) => update(target === 'Texto' ? { textX: Math.max(4, Math.min(18, a)), textY: Math.max(45, Math.min(70, b)) } : { imageX: Math.max(0, Math.min(100 - d.imageWidth, a)), imageY: Math.max(12, Math.min(55, b)) });
  const range = (name: string, key: 'textX' | 'textY' | 'textSize' | 'imageX' | 'imageY' | 'imageWidth', min: number, max: number) => <Box><Typography variant="body2" color="text.secondary">{name}</Typography><Slider value={d[key]} min={min} max={max} onChange={(_, value) => { const next = Array.isArray(value) ? value[0] : value; update({ [key]: next, ...(key === 'imageWidth' ? { imageX: Math.min(d.imageX, 100 - next) } : {}) }); }} /></Box>;

  const bigButton = { minHeight: 52, fontSize: '1rem', justifyContent: 'flex-start', px: 2.25 };

  return <Box className="editor" sx={{ pb: 2 }}>
    <Button variant="text" startIcon={<ArrowBack />} onClick={onBack} sx={{ mb: 1, ml: -1 }}>Cambiar fotos o texto</Button>
    <Typography variant="h1">{generation?.status === 'processing' ? 'Estamos preparando tu publicación' : '¡Tu publicación está lista!'}</Typography>
    <Typography color="text.secondary" sx={{ mt: .75, mb: 3, fontSize: '1.02rem' }}>Elige la red, mira cómo queda y compártela. Todo se guarda solo.</Typography>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1.1fr) minmax(0, .9fr)' }, gap: 2, alignItems: 'start' }}>
      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.25 }, borderRadius: '20px' }} aria-label="Vista previa del diseño">
        <Tabs value={active} onChange={(_, format: Network) => update({ format })} variant="fullWidth" sx={{ mb: 2, minHeight: 44, bgcolor: '#F2F5FA', borderRadius: '12px', p: .5, '& .MuiTabs-indicator': { display: 'none' }, '& .MuiTab-root': { minHeight: 40, borderRadius: '9px', textTransform: 'none', fontWeight: 600, fontSize: { xs: '.82rem', sm: '.9rem' }, px: .5 }, '& .Mui-selected': { bgcolor: 'background.paper', boxShadow: '0 1px 3px rgba(16,20,24,.1)' } }}>{outputs.map(network => <Tab key={network} value={network} icon={<NetworkIcon network={network} size={18} />} iconPosition="start" label={networkLook[network].short} sx={{ gap: .75, '& .MuiTab-icon': { m: 0 } }} />)}</Tabs>
        {generation?.status === 'processing' && <Alert severity="info" icon={<CircularProgress size={18} />} sx={{ mb: 2 }}>Estamos mejorando el diseño. Ya puedes usar esta versión o esperar unos minutos.</Alert>}
        {generation?.status === 'error' && <Alert severity="info" sx={{ mb: 2 }}>Esta versión con los colores de tu negocio ya está lista para usar.</Alert>}
        <Box sx={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 1, sm: 2 }, borderRadius: '14px', bgcolor: '#F2F5FA' }}><Box sx={{ position: 'relative', width: '100%', maxWidth: d.format === 'story' || d.format === 'whatsapp' ? 295 : 520, aspectRatio: `${formats[d.format].width}/${formats[d.format].height}`, bgcolor: 'common.white', borderRadius: 2, overflow: 'hidden', boxShadow: '0 12px 32px rgba(35,55,90,.14)' }}>{preview && <Box component="img" src={preview.url} alt={`Vista previa: ${d.title}`} draggable={false} sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />}{tab === 'Mover' && <Box role="group" tabIndex={0} aria-label={`Mover ${element.toLowerCase()}. Arrastra o usa las flechas.`} onKeyDown={event => { const keys: Record<string, number[]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }; if (keys[event.key]) { event.preventDefault(); const [a, b] = keys[event.key]; move((element === 'Texto' ? d.textX : d.imageX) + a, (element === 'Texto' ? d.textY : d.imageY) + b, element); } }} onPointerDown={event => { const rect = event.currentTarget.getBoundingClientRect(); drag.current = { x: event.clientX, y: event.clientY, a: element === 'Texto' ? d.textX : d.imageX, b: element === 'Texto' ? d.textY : d.imageY, width: rect.width, height: rect.height, element }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { const current = drag.current; if (current) move(current.a + (event.clientX - current.x) / current.width * 100, current.b + (event.clientY - current.y) / current.height * 100, current.element); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} sx={{ position: 'absolute', inset: 0, cursor: 'move' }}><Box sx={{ position: 'absolute', left: `${element === 'Texto' ? d.textX : d.imageX}%`, top: `${element === 'Texto' ? d.textY : d.imageY}%`, width: `${element === 'Texto' ? 94 - d.textX : d.imageWidth}%`, height: element === 'Texto' ? `${93 - d.textY}%` : '40%', border: '2px dashed', borderColor: 'secondary.main' }}><Chip size="small" label={element} color="secondary" sx={{ borderRadius: 1, position: 'absolute', top: -11, left: -2 }} /></Box></Box>}{!preview && !renderError && <Stack alignItems="center" justifyContent="center" sx={{ position: 'absolute', inset: 0 }}><CircularProgress size={28} /><Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>Preparando tu diseño…</Typography></Stack>}</Box></Box>
        {renderError && <Alert severity="error" sx={{ mt: 1.5 }} action={<Button color="inherit" size="small" onClick={() => setRetry(value => value + 1)}>Reintentar</Button>}>No pudimos mostrar el diseño.</Alert>}
      </Paper>

      <Stack spacing={2}>
        <Panel title={`Usar en ${label}`}><Stack spacing={1.25}>
          {connections[active].account.trim() && <Button variant="contained" size="large" startIcon={<Send />} disabled={publishing || !canExport} onClick={() => void publishTo([active])} sx={bigButton}>{publishing ? 'Publicando…' : d.publications?.[active]?.status === 'sent' ? `Publicar de nuevo en ${label}` : `Publicar en ${label}`}</Button>}
          <Button variant={connections[active].account.trim() ? 'outlined' : 'contained'} size="large" startIcon={<Share />} disabled={!ready || !canExport} onClick={() => void share()} sx={bigButton}>Compartir</Button>
          <Button variant="outlined" size="large" startIcon={<Download />} disabled={!ready || !canExport} onClick={download} sx={bigButton}>Guardar imagen</Button>
          {d.publications?.[active] && <Typography variant="body2" color={d.publications[active].status === 'error' ? 'error.main' : d.publications[active].status === 'sent' ? 'success.main' : 'text.secondary'} sx={{ display: 'flex', alignItems: 'center', gap: .75 }}>{d.publications[active].status === 'sent' && <CheckCircle fontSize="small" />}{publicationLabels[d.publications[active].status]}{d.publications[active].error ? `: ${d.publications[active].error}` : ''}</Typography>}
          {!canExport && <Typography variant="body2" color="warning.main">Agrega una foto y un título para poder compartir.</Typography>}
          {!readyAccounts.length && <Typography variant="body2" color="text.secondary">¿Quieres publicar directo desde aquí? <Box component="button" type="button" onClick={onConnect} sx={{ p: 0, border: 0, bgcolor: 'transparent', color: 'primary.main', font: 'inherit', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>Conecta tus redes</Box>.</Typography>}
        </Stack></Panel>

        <Panel title="Texto para acompañar la foto"><Stack spacing={1.5}>
          <Field label={`Texto para ${label}`} multiline value={captionFor(d, active)} onChange={setCaption} maxLength={captionLimits[active] || 2200} disabled={writing} />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap><Button variant="outlined" startIcon={<ContentCopy />} onClick={() => void copy()} sx={{ minHeight: 46 }}>Copiar texto</Button><Button variant="text" startIcon={<AutoAwesome />} disabled={writing || !d.product.trim()} onClick={() => void rewriteCaption()}>{writing ? 'Escribiendo…' : 'Escribir otro'}</Button></Stack>
        </Stack></Panel>

        <Accordion disableGutters variant="outlined" sx={accordionSx}><AccordionSummary expandIcon={<ExpandMore />}><Stack direction="row" spacing={1} alignItems="center"><Tune fontSize="small" color="action" /><Typography fontWeight={600}>Cambiar el diseño</Typography></Stack></AccordionSummary><AccordionDetails>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="fullWidth" sx={{ mb: 2, '& .MuiTab-root': { minWidth: 0, px: .5, textTransform: 'none', fontWeight: 600 } }}>{tabs.map(item => <Tab key={item} value={item} label={item} />)}</Tabs>
          {tab === 'Texto' && <Stack spacing={2}><Field label="Título" value={d.title} onChange={title => update({ title })} maxLength={80} /><Field label="Mensaje" multiline value={d.body} onChange={body => update({ body })} maxLength={180} /><Field label="Frase final" value={d.cta} onChange={cta => update({ cta })} maxLength={40} /><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}><Field label="Precio" value={d.price} onChange={price => update({ price })} maxLength={45} /><Field label="¿Hasta cuándo?" value={d.validity} onChange={validity => update({ validity })} maxLength={60} /></Box><Field label="Contacto" value={d.contact} onChange={contact => update({ contact })} maxLength={35} /></Stack>}
          {tab === 'Foto' && <Stack spacing={2}><Choices label="¿Cómo se ve la foto?" options={['Foto completa', 'Llenar todo el espacio']} value={d.imageFit === 'cover' ? 'Llenar todo el espacio' : 'Foto completa'} onChange={value => update({ imageFit: value === 'Llenar todo el espacio' ? 'cover' : 'contain' })} />{d.images.length > 1 && <><Typography variant="body2" color="text.secondary">Toca la foto que quieres que se vea:</Typography><Box sx={{ display: 'flex', gap: 1, overflowX: 'auto' }}>{d.images.map((src, index) => <Box component="button" key={index} type="button" onClick={() => update({ selectedImage: index })} aria-label={`Usar foto ${index + 1}`} sx={{ p: 0, border: '3px solid', borderColor: index === d.selectedImage ? 'primary.main' : 'transparent', borderRadius: 2, overflow: 'hidden', width: 76, height: 60, flexShrink: 0, bgcolor: 'grey.100' }}><Box component="img" src={src} alt={`Foto ${index + 1}`} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /></Box>)}</Box></>}<Photos images={d.images} onChange={images => update({ images, selectedImage: 0 })} /></Stack>}
          {tab === 'Colores' && <Stack spacing={2}><Choices label="Estilo" options={styles} value={d.style} onChange={style => update(styleLook(style, d.brand))} /><Choices label="Letra" options={['Moderna', 'Clásica']} value={d.font === 'sans' ? 'Moderna' : 'Clásica'} onChange={value => update({ font: value === 'Moderna' ? 'sans' : 'serif' })} /><Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}><TextField label="Color principal" type="color" value={d.color} onChange={event => update({ color: event.target.value })} /><TextField label="Fondo" type="color" value={d.background} onChange={event => update({ background: event.target.value })} /></Box><Button variant="outlined" onClick={() => update(styleLook(d.style, d.brand))}>Volver a los colores de mi negocio</Button></Stack>}
          {tab === 'Mover' && <Stack spacing={2}><Choices label="¿Qué quieres mover?" options={['Texto', 'Imagen']} value={element} onChange={setElement} /><Typography variant="body2" color="text.secondary">Arrastra sobre el diseño o usa estas barras.</Typography>{element === 'Texto' ? <>{range('Izquierda o derecha', 'textX', 4, 18)}{range('Arriba o abajo', 'textY', 45, 70)}{range('Tamaño del título', 'textSize', 35, 100)}</> : <>{range('Izquierda o derecha', 'imageX', 0, 100 - d.imageWidth)}{range('Arriba o abajo', 'imageY', 12, 55)}{range('Tamaño', 'imageWidth', 40, 100)}</>}<Button variant="outlined" onClick={() => update({ textX: 7, textY: 62, textSize: 68, imageX: 7, imageY: 16, imageWidth: 86 })}>Volver a como estaba</Button></Stack>}
        </AccordionDetails></Accordion>

        <Accordion disableGutters variant="outlined" sx={accordionSx}><AccordionSummary expandIcon={<ExpandMore />}><Stack direction="row" spacing={1} alignItems="center"><Download fontSize="small" color="action" /><Typography fontWeight={600}>Todas las redes a la vez</Typography></Stack></AccordionSummary><AccordionDetails><Stack spacing={1.25}>
          <Button variant="outlined" startIcon={<Download />} disabled={!canExport} onClick={() => void downloadAll()}>Guardar las 3 imágenes</Button>
          {readyAccounts.length > 1 && <Button variant="outlined" startIcon={<Send />} disabled={publishing || !canExport} onClick={() => void publishTo(readyAccounts)}>Publicar en {readyAccounts.map(network => networks[network].label).join(', ')}</Button>}
          {outputs.map(network => { const publication = d.publications?.[network]; return publication && <Typography key={network} variant="body2" color={publication.status === 'error' ? 'error.main' : publication.status === 'sent' ? 'success.main' : 'text.secondary'}>{networks[network].label}: {publicationLabels[publication.status]}</Typography>; })}
        </Stack></AccordionDetails></Accordion>
      </Stack>
    </Box>
  </Box>;
}

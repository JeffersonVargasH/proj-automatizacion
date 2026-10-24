'use client';

import { useState } from 'react';
import { ArrowBack, ArrowForward, AutoAwesome, EditOutlined, ExpandMore, TipsAndUpdates, Tune } from '@mui/icons-material';
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, LinearProgress, Stack, Step, StepButton, Stepper, Typography } from '@mui/material';
import { requestCopy } from '@/lib/copy';
import { captionFor, captionLimits, Design, intentOf, intents, networks, outputs, styleLook, suggestCopy, tones } from '@/lib/studio';
import { Choices, Field, Panel, Photos, StylePicker } from './Fields';

export const steps = ['Intención', 'Producto', 'Revisión'];
export const lastStep = steps.length - 1;
const titles = ['¿Qué quieres publicar hoy?', 'Muéstranos tu producto.', 'Revisa y crea.'];
const descriptions = ['Elige la intención. Tu estilo y tono ya vienen de Mi negocio.', 'Agrega entre una y tres fotos. La primera será la imagen principal.', 'Preparamos el mensaje por ti. Ajusta lo que quieras y crea tu publicación.'];

export function CreateFlow({ design: d, update, step, setStep, onCreate }: { design: Design; update: (patch: Partial<Design>) => void; step: number; setStep: (step: number) => void; onCreate: () => void }) {
  const [variant, setVariant] = useState(0);
  const [customize, setCustomize] = useState(false);
  const [writing, setWriting] = useState(false);
  const [copyNote, setCopyNote] = useState<{ ai: boolean; message: string } | null>(null);
  const valid = step === 1 ? Boolean(d.product.trim() && d.images.length) : step === 2 ? Boolean(d.title.trim() && d.cta.trim()) && !writing : true;
  // Grok escribe el texto; si no está disponible queda la plantilla local.
  async function write(base: Design, avoid = '') {
    setWriting(true);
    try { update(await requestCopy(base, avoid)); setCopyNote({ ai: true, message: 'Texto escrito con IA según tu tono. Ajusta lo que quieras.' }); }
    catch (error) {
      if (avoid) { update(suggestCopy(base, variant + 1)); setVariant(variant + 1); }
      setCopyNote({ ai: false, message: `${error instanceof Error ? error.message : 'No se pudo escribir con IA.'} Te dejamos una sugerencia de plantilla.` });
    } finally { setWriting(false); }
  }
  const next = () => { if (!valid) return; if (step === 1 && !d.title) { update(suggestCopy(d)); void write(d); } setStep(step + 1); };
  return <Box className="flow" sx={{ pb: 2 }}>
    <Stack spacing={1} sx={{ mb: 3 }}><Typography variant="overline" color="primary.dark" sx={{ fontWeight: 800, letterSpacing: '.12em' }}>NUEVA PUBLICACIÓN</Typography><Typography variant="h1">{titles[step]}</Typography><Typography color="text.secondary" sx={{ maxWidth: 680 }}>{descriptions[step]}</Typography></Stack>
    <Stepper activeStep={step} alternativeLabel sx={{ mb: 3, '& .MuiStepLabel-label': { fontSize: { xs: '.78rem', sm: '.8rem' } }, '& .MuiStepIcon-root.Mui-active, & .MuiStepIcon-root.Mui-completed': { color: 'primary.main' } }}>{steps.map((name, index) => <Step key={name} completed={index < step}><StepButton color="inherit" onClick={() => index <= step && setStep(index)}>{name}</StepButton></Step>)}</Stepper>
    {step === 1 && <Alert severity="info" icon={<TipsAndUpdates />}>Para continuar, escribe el nombre de tu producto o servicio y añade al menos una foto.</Alert>}
    <Box sx={{ mt: 2 }}>
      {step === 0 && <Panel><Stack spacing={2.5}><Choices label="¿Qué quieres conseguir?" options={intents.map(intent => intent.label)} value={intentOf(d).label} onChange={label => { const intent = intents.find(item => item.label === label)!; update({ type: intent.type, objective: intent.objective }); }} /><Alert severity="success">Generaremos tres versiones listas para publicar: Instagram, Facebook y estado de WhatsApp.</Alert></Stack></Panel>}
      {step === 1 && <ResponsiveGrid><Panel title="El protagonista"><Stack spacing={2}><Field label="Producto o servicio" value={d.product} onChange={product => update({ product })} required maxLength={80} placeholder="Ej. Taza de cerámica hecha a mano" /><Field label="Descripción" multiline value={d.description} onChange={description => update({ description })} maxLength={350} placeholder="¿Qué lo hace especial? Materiales, beneficios, sabores…" /><Photos images={d.images} onChange={images => update({ images, selectedImage: 0 })} /></Stack></Panel><Panel title="Los detalles que importan"><Stack spacing={2}><Field label="Precio o promoción · opcional" value={d.price} onChange={price => update({ price })} maxLength={45} placeholder="Ej. S/ 35 o 2 por S/ 60" /><Field label="Fecha o vigencia · opcional" value={d.validity} onChange={validity => update({ validity })} maxLength={60} placeholder="Ej. Válido hasta el 30 de octubre" /><Accordion disableGutters variant="outlined" sx={{ borderRadius: 2, '&:before': { display: 'none' } }}><AccordionSummary expandIcon={<ExpandMore />}><Typography variant="body2" fontWeight={700}>Más opciones</Typography></AccordionSummary><AccordionDetails><Stack spacing={1.5}><Field label="Contacto para esta publicación" type="tel" value={d.contact} onChange={contact => update({ contact })} maxLength={35} placeholder="WhatsApp o teléfono" /><Typography variant="caption" color="text.secondary">El contacto viene de tu negocio. Cámbialo solo si esta publicación usa otro.</Typography></Stack></AccordionDetails></Accordion></Stack></Panel></ResponsiveGrid>}
      {step === 2 && <ResponsiveGrid>
        <Panel title="Tu mensaje"><Stack spacing={2}><Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: .5 }}>{d.images.map((src, index) => <Box component="img" key={index} src={src} alt={`Referencia ${index + 1}`} sx={{ width: 84, height: 64, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }} />)}</Box><Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}><Typography variant="body2" color="text.secondary" sx={{ minWidth: 0 }} noWrap>{intentOf(d).label} · {[d.product, d.price, d.validity].filter(Boolean).join(' · ')}</Typography><Button size="small" startIcon={<EditOutlined />} onClick={() => setStep(1)} sx={{ flexShrink: 0 }}>Editar</Button></Stack>{writing && <Box><LinearProgress sx={{ borderRadius: 1 }} /><Typography variant="caption" color="text.secondary">Escribiendo tu texto con IA…</Typography></Box>}<Field label="Título" value={d.title} onChange={title => update({ title })} maxLength={80} required disabled={writing} /><Field label="Texto del diseño" multiline value={d.body} onChange={body => update({ body })} maxLength={180} disabled={writing} /><Field label="Llamado a la acción" value={d.cta} onChange={cta => update({ cta })} maxLength={40} required disabled={writing} /><Button variant="outlined" startIcon={<AutoAwesome />} disabled={writing} onClick={() => void write(d, [d.title, d.body].join(' · '))}>{writing ? 'Escribiendo…' : 'Escribir otra versión con IA'}</Button>{copyNote && <Typography variant="caption" color={copyNote.ai ? 'success.main' : 'warning.dark'}>{copyNote.message}</Typography>}</Stack></Panel>
        <Stack spacing={2}>
          <Panel title="Tu estilo"><Stack spacing={2}><Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap><Chip label={d.style} /><Chip label={d.tone} /><Chip label={outputs.map(network => networks[network].label).join(' · ')} /></Stack>{!customize ? <Button variant="text" startIcon={<Tune />} onClick={() => setCustomize(true)} sx={{ alignSelf: 'flex-start' }}>Cambiar solo para esta publicación</Button> : <Stack spacing={2.5}><StylePicker brand={d.brand} value={d.style} onChange={style => update(styleLook(style, d.brand))} /><Choices label="Tono" options={tones} value={d.tone} onChange={tone => update({ tone })} /><Field label="Instrucciones para el generador · opcional" multiline value={d.instructions} onChange={instructions => update({ instructions })} maxLength={700} placeholder="Ej. Conserva el color del producto y usa un fondo cálido." /></Stack>}<Typography variant="caption" color="text.secondary">Tus valores por defecto se cambian en Mi negocio.</Typography></Stack></Panel>
          <Accordion disableGutters variant="outlined" sx={{ borderRadius: 2.25, '&:before': { display: 'none' } }}><AccordionSummary expandIcon={<ExpandMore />}><Typography fontWeight={700}>Textos para Instagram, Facebook y WhatsApp</Typography></AccordionSummary><AccordionDetails><Stack spacing={2}>{outputs.map(network => <Field key={network} label={`Texto para ${networks[network].label}`} multiline value={captionFor(d, network)} onChange={value => update({ captions: { ...d.captions, [network]: value }, ...(network === 'instagram' ? { caption: value } : {}) })} maxLength={captionLimits[network]} disabled={writing} />)}<Typography variant="caption" color="text.secondary">Estos textos acompañan la imagen al publicar; no se imprimen sobre el diseño.</Typography></Stack></AccordionDetails></Accordion>
        </Stack>
      </ResponsiveGrid>}
    </Box>
    <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mt: 2.5 }}><Button variant="outlined" startIcon={<ArrowBack />} onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>Atrás</Button><Typography variant="caption" color="text.secondary" sx={{ flex: 1, textAlign: { xs: 'center', sm: 'left' } }}>Paso {step + 1} de {steps.length}</Typography>{step < lastStep ? <Button variant="contained" endIcon={<ArrowForward />} onClick={next} disabled={!valid}>Continuar</Button> : <Button variant="contained" endIcon={<ArrowForward />} onClick={onCreate} disabled={writing || !d.product.trim() || !d.images.length || !d.title.trim() || !d.cta.trim()}>Crear publicación</Button>}</Stack>
  </Box>;
}

function ResponsiveGrid({ children }: { children: React.ReactNode }) {
  return <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>{children}</Box>;
}

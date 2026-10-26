'use client';

import { useState } from 'react';
import { ArrowBack, ArrowForward, AutoAwesome, Check, EditOutlined, ExpandMore, TipsAndUpdates, Tune } from '@mui/icons-material';
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Card, CardActionArea, Chip, LinearProgress, Stack, Step, StepButton, Stepper, Typography } from '@mui/material';
import { requestCopy } from '@/lib/copy';
import { captionFor, captionLimits, Design, intentOf, intents, networks, outputs, styleLook, suggestCopy, tones } from '@/lib/studio';
import { Choices, Field, Panel, Photos, StylePicker } from './Fields';

export const steps = ['Tipo de publicación', 'Producto', 'Revisión'];
export const lastStep = steps.length - 1;
const titles = ['¿Qué tipo de publicación quieres crear?', 'Muéstranos tu producto.', 'Revisa y crea.'];
const descriptions = ['Elige el formato y objetivo de tu diseño (Flyer publicitario, Oferta, etc.). Tu estilo y tono ya vienen de Mi negocio.', 'Agrega entre una y tres fotos. La primera será la imagen principal.', 'Preparamos el diseño y el mensaje por ti. Ajusta lo que quieras y crea tu publicación.'];

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
      {step === 0 && <Panel title="Elige el tipo de publicación"><Stack spacing={2.5}>
        <Typography variant="body2" color="text.secondary">
          Selecciona el formato y objetivo de tu diseño comercial. Generaremos un flyer completo con imagen de alta gama, tipografía y llamado a la acción.
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 1.5 }}>
          {intents.map(intent => {
            const selected = intentOf(d).objective === intent.objective;
            return (
              <Card
                key={intent.objective}
                variant="outlined"
                sx={{
                  borderColor: selected ? 'primary.main' : 'divider',
                  bgcolor: selected ? '#EEF2FF' : 'background.paper',
                  boxShadow: selected ? '0 0 0 1.5px #3F63E9' : 'none',
                  transition: 'all 160ms ease',
                  '&:hover': { borderColor: 'primary.light' }
                }}
              >
                <CardActionArea
                  onClick={() => update({ type: intent.type, objective: intent.objective })}
                  sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start' }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: '100%', mb: 1 }}>
                    <Chip
                      size="small"
                      label={intent.badge}
                      color={selected ? 'primary' : 'default'}
                      sx={{ fontWeight: 800, fontSize: '0.72rem' }}
                    />
                    {selected && <Check color="primary" fontSize="small" />}
                  </Stack>
                  <Typography variant="subtitle2" fontWeight={800} sx={{ lineHeight: 1.25, mb: 0.5 }}>
                    {intent.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.35 }}>
                    {intent.desc}
                  </Typography>
                </CardActionArea>
              </Card>
            );
          })}
        </Box>
        <Alert severity="success">Generaremos tres versiones comerciales listas para publicar: Instagram (1080×1080), Facebook (1200×630) y estado de WhatsApp (1080×1920).</Alert>
      </Stack></Panel>}
      {step === 1 && <ResponsiveGrid><Panel title="El protagonista"><Stack spacing={2}><Field label="Producto o servicio" value={d.product} onChange={product => update({ product })} required maxLength={80} placeholder="Ej. Taza de cerámica hecha a mano" /><Field label="Descripción" multiline value={d.description} onChange={description => update({ description })} maxLength={350} placeholder="¿Qué lo hace especial? Materiales, beneficios, sabores…" /><Photos images={d.images} onChange={images => update({ images, selectedImage: 0 })} /></Stack></Panel><Panel title="Los detalles que importan"><Stack spacing={2}><Field label="Precio o promoción · opcional" value={d.price} onChange={price => update({ price })} maxLength={45} placeholder="Ej. S/ 35 o 2 por S/ 60" /><Field label="Fecha o vigencia · opcional" value={d.validity} onChange={validity => update({ validity })} maxLength={60} placeholder="Ej. Válido hasta el 30 de octubre" /><Accordion disableGutters variant="outlined" sx={{ borderRadius: 2, '&:before': { display: 'none' } }}><AccordionSummary expandIcon={<ExpandMore />}><Typography variant="body2" fontWeight={700}>Más opciones</Typography></AccordionSummary><AccordionDetails><Stack spacing={1.5}><Field label="Contacto para esta publicación" type="tel" value={d.contact} onChange={contact => update({ contact })} maxLength={35} placeholder="WhatsApp o teléfono" /><Typography variant="caption" color="text.secondary">El contacto viene de tu negocio. Cámbialo solo si esta publicación usa otro.</Typography></Stack></AccordionDetails></Accordion></Stack></Panel></ResponsiveGrid>}
      {step === 2 && <ResponsiveGrid>
        <Panel title="Tu mensaje publicitario"><Stack spacing={2}>
          <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: .5 }}>
            {d.images.map((src, index) => <Box component="img" key={index} src={src} alt={`Referencia ${index + 1}`} sx={{ width: 84, height: 64, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }} />)}
          </Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ p: 1.25, bgcolor: '#F8FAFF', borderRadius: 2, border: '1px solid #E2E8F0' }}>
            <Box minWidth={0}>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.25 }}>
                <Chip size="small" label={intentOf(d).badge || intentOf(d).type} color="primary" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }} />
                <Typography variant="body2" fontWeight={700} noWrap>{intentOf(d).label}</Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" noWrap>{[d.product, d.price, d.validity].filter(Boolean).join(' · ')}</Typography>
            </Box>
            <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
              <Button size="small" startIcon={<Tune />} onClick={() => setStep(0)}>Tipo</Button>
              <Button size="small" startIcon={<EditOutlined />} onClick={() => setStep(1)}>Producto</Button>
            </Stack>
          </Stack>

          {/* Caja de vista previa del contenido que irá a la IA */}
          <Box sx={{ p: 2, bgcolor: '#F0F5FF', border: '1px solid #D0E0FD', borderRadius: 2.5 }}>
            <Typography variant="overline" color="primary.dark" fontWeight={800} sx={{ letterSpacing: '.08em', display: 'block', mb: 1 }}>
              TEXTO QUE LA IA PLASMARÁ EN TU FLYER
            </Typography>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" sx={{ px: 1, py: 0.25, bgcolor: 'primary.main', color: 'common.white', borderRadius: 1, fontWeight: 700, flexShrink: 0 }}>Titular</Typography>
                <Typography variant="body2" fontWeight={800}>{d.title || 'Sin titular'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Typography variant="caption" sx={{ px: 1, py: 0.25, bgcolor: '#4B5563', color: 'common.white', borderRadius: 1, fontWeight: 700, flexShrink: 0 }}>Texto</Typography>
                <Typography variant="body2" color="text.secondary">{d.body || 'Sin texto'}</Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ pt: 0.5 }}>
                {d.price ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption" sx={{ px: 1, py: 0.25, bgcolor: '#059669', color: 'common.white', borderRadius: 1, fontWeight: 700 }}>Precio en cucarda</Typography>
                    <Typography variant="body2" fontWeight={800} color="success.dark">{d.price}</Typography>
                  </Box>
                ) : (
                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>Sin precio (puedes agregarlo abajo)</Typography>
                )}
                {d.validity && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption" sx={{ px: 1, py: 0.25, bgcolor: '#D97706', color: 'common.white', borderRadius: 1, fontWeight: 700 }}>Vigencia</Typography>
                    <Typography variant="body2">{d.validity}</Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="caption" sx={{ px: 1, py: 0.25, bgcolor: '#2563EB', color: 'common.white', borderRadius: 1, fontWeight: 700 }}>Botón</Typography>
                  <Typography variant="body2" fontWeight={700}>{d.cta} &gt;</Typography>
                </Box>
              </Stack>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25, fontStyle: 'italic' }}>
              ✓ La IA adaptará este contenido con tipografía publicitaria 100% en español e integrará la cucarda y botón en la composición.
            </Typography>
          </Box>

          {writing && <Box><LinearProgress sx={{ borderRadius: 1 }} /><Typography variant="caption" color="text.secondary">Escribiendo tu texto con IA…</Typography></Box>}
          <Field label="Título principal en el diseño" value={d.title} onChange={title => update({ title })} maxLength={80} required disabled={writing} placeholder="Ej. Uvas frescas al mejor precio" />
          <Field label="Texto del diseño (subtítulo o beneficio)" multiline value={d.body} onChange={body => update({ body })} maxLength={180} disabled={writing} placeholder="Ej. Disfruta la dulzura natural de nuestras uvas recién cosechadas." />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Field label="Precio a destacar en cucarda · opcional" value={d.price} onChange={price => update({ price })} maxLength={45} disabled={writing} placeholder="Ej. S/ 20 o 2 por S/ 35" />
            <Field label="Llamado a la acción (botón)" value={d.cta} onChange={cta => update({ cta })} maxLength={40} required disabled={writing} placeholder="Ej. Separa la tuya" />
          </Stack>
          <Field label="Fecha o vigencia · opcional" value={d.validity} onChange={validity => update({ validity })} maxLength={60} disabled={writing} placeholder="Ej. Válido hasta agotar stock" />
          <Button variant="outlined" startIcon={<AutoAwesome />} disabled={writing} onClick={() => void write(d, [d.title, d.body].join(' · '))}>{writing ? 'Escribiendo…' : 'Escribir otra versión con IA'}</Button>
          {copyNote && <Typography variant="caption" color={copyNote.ai ? 'success.main' : 'warning.dark'}>{copyNote.message}</Typography>}
        </Stack></Panel>
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

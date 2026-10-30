'use client';

import { useState } from 'react';
import { ArrowBack, ArrowForward, AutoAwesome, Campaign, Check, CheckCircle, Event, ExpandMore, LocalOffer, NewReleases, ShoppingBag, Storefront } from '@mui/icons-material';
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Card, CardActionArea, LinearProgress, Stack, Typography } from '@mui/material';
import { NetworkIcon } from '@/components/brand/NetworkIcon';
import { requestCopy } from '@/lib/copy';
import { captionFor, captionLimits, Design, intentOf, intents, networks, outputs, styleLook, suggestCopy, tones } from '@/lib/studio';
import { contrast } from '@/lib/studio-renderer';
import { Choices, Field, Photos, StylePicker } from './Fields';

// Un paso, una sola pregunta. Todo lo opcional queda plegado en "Más opciones".
export const steps = ['Tu producto', 'Para qué es', 'Tu mensaje'];
export const lastStep = steps.length - 1;
const titles = ['¿Qué quieres publicar?', '¿Para qué es esta publicación?', 'Así dirá tu publicación'];
const descriptions = ['Sube una foto y escribe qué es. Con eso basta para empezar.', 'Toca la opción que más se parezca a lo que buscas.', 'Escribimos el texto por ti. Puedes cambiar cualquier palabra.'];
const tips = ['Usa una foto con buena luz y el producto al centro.', 'Esto ayuda a escribir el mensaje justo para tu objetivo.', 'Frases cortas se leen mejor en el celular.'];
const intentHelp: Record<string, { hint: string; icon: typeof ShoppingBag }> = {
  'Vender un producto': { hint: 'Que te compren', icon: ShoppingBag },
  'Anunciar una novedad': { hint: 'Algo nuevo que llegó', icon: NewReleases },
  'Promocionar una oferta': { hint: 'Descuento o 2x1', icon: LocalOffer },
  'Invitar a un evento': { hint: 'Una fecha especial', icon: Event },
  'Atraer visitas': { hint: 'Que vengan a tu local', icon: Storefront },
  'Informar': { hint: 'Horarios, avisos', icon: Campaign },
};
const navy = 'radial-gradient(circle at 85% 0%, rgba(47,91,255,.6), transparent 55%), radial-gradient(circle at 0% 100%, rgba(46,139,255,.25), transparent 45%), #0B1220';
const card = { borderRadius: '20px', border: '1px solid #E6EBF2', bgcolor: 'background.paper', p: { xs: 2, sm: 3 } };
const label = { fontWeight: 650, fontSize: '.95rem', mb: 1 };

/** Publicación en miniatura que se arma mientras la persona completa los pasos. */
function LivePreview({ d }: { d: Design }) {
  const ink = contrast(d.background);
  const photo = d.images[d.selectedImage] || d.images[0];
  const serif = d.font === 'serif' ? 'Georgia, "Times New Roman", serif' : 'inherit';
  return <Box sx={{ position: 'relative', pt: 2.5 }}>
    <Box sx={{ position: 'absolute', zIndex: 2, top: 0, left: 16, px: 1.25, py: .5, borderRadius: '8px', bgcolor: '#FFFFFF', color: '#101418', fontSize: 13, fontWeight: 600, fontStyle: 'italic', transform: 'rotate(-4deg)', boxShadow: '0 6px 16px rgba(0,0,0,.25)' }}>Así va quedando…</Box>
    <Box sx={{ aspectRatio: '1', borderRadius: '16px', border: '4px solid #FFFFFF', overflow: 'hidden', bgcolor: d.background, boxShadow: '0 18px 40px rgba(0,0,0,.4)', transform: 'rotate(2deg)', display: 'flex', flexDirection: 'column', p: 2, gap: 1.25 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        {d.brand.logo ? <Box component="img" src={d.brand.logo} alt="" sx={{ width: 22, height: 22, borderRadius: '6px', objectFit: 'cover' }} /> : <Box sx={{ width: 22, height: 3, borderRadius: 2, bgcolor: d.color }} />}
        <Typography noWrap sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: d.color }}>{d.brand.name || 'Tu negocio'}</Typography>
      </Stack>
      <Typography sx={{ fontFamily: serif, fontWeight: d.font === 'serif' ? 500 : 800, fontSize: 20, lineHeight: 1.1, letterSpacing: d.font === 'serif' ? 0 : '-.02em', color: ink, minHeight: 22 }}>{d.title || d.product || 'Tu producto'}</Typography>
      <Box sx={{ flex: 1, minHeight: 0, borderRadius: '10px', overflow: 'hidden', bgcolor: 'rgba(16,20,24,.06)', border: photo ? 0 : '2px dashed rgba(16,20,24,.18)', display: 'grid', placeItems: 'center' }}>{photo ? <Box component="img" src={photo} alt="" sx={{ width: '100%', height: '100%', objectFit: d.imageFit === 'cover' ? 'cover' : 'contain' }} /> : <Typography variant="caption" sx={{ color: ink, opacity: .55 }}>Aquí irá tu foto</Typography>}</Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Box sx={{ px: 1.5, py: .5, borderRadius: '999px', bgcolor: d.color, color: contrast(d.color), fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.cta || 'Escríbenos'}</Box>
        {d.price && <Typography noWrap sx={{ fontSize: 13, fontWeight: 800, color: ink }}>{d.price}</Typography>}
      </Stack>
    </Box>
    <Stack direction="row" spacing={.75} sx={{ position: 'absolute', right: 10, bottom: -14 }}>{outputs.map(network => <NetworkIcon key={network} network={network} size={14} badge />)}</Stack>
  </Box>;
}

export function CreateFlow({ design: d, update, step, setStep, onCreate }: { design: Design; update: (patch: Partial<Design>) => void; step: number; setStep: (step: number) => void; onCreate: () => void }) {
  const [variant, setVariant] = useState(0);
  const [writing, setWriting] = useState(false);
  const [copyNote, setCopyNote] = useState<{ ai: boolean; message: string } | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  // Se explica qué falta en vez de dejar un botón apagado sin razón.
  const missing = step === 0 ? [!d.images.length && 'una foto', !d.product.trim() && 'el nombre de tu producto'].filter(Boolean)
    : step === 2 ? [!d.title.trim() && 'el título', !d.cta.trim() && 'la frase final'].filter(Boolean) : [];
  // La IA escribe el texto; si no está disponible queda la plantilla local.
  async function write(base: Design, avoid = '') {
    setWriting(true);
    try { update(await requestCopy(base, avoid)); setCopyNote({ ai: true, message: 'Listo, escribimos un texto nuevo.' }); }
    catch {
      if (avoid) { update(suggestCopy(base, variant + 1)); setVariant(variant + 1); }
      setCopyNote({ ai: false, message: 'Te dejamos un texto de ejemplo. Puedes cambiarlo.' });
    } finally { setWriting(false); }
  }
  function next() {
    if (writing) return;
    if (missing.length) { setShowMissing(true); return; }
    setShowMissing(false);
    if (step === lastStep) { onCreate(); return; }
    if (step === 1 && !d.title) { update(suggestCopy(d)); void write(d); }
    setStep(step + 1);
  }
  const back = () => { setShowMissing(false); setStep(Math.max(0, step - 1)); };

  const actions = <Stack direction="row" spacing={1.5}>
    {step > 0 && <Button size="large" variant="outlined" startIcon={<ArrowBack />} onClick={back} sx={{ minHeight: 50 }}>Atrás</Button>}
    <Button size="large" variant="contained" endIcon={step === lastStep ? <AutoAwesome /> : <ArrowForward />} onClick={next} disabled={writing} sx={{ flex: 1, minHeight: 50, fontSize: '1rem' }}>{step === lastStep ? 'Crear mi publicación' : 'Continuar'}</Button>
  </Stack>;

  return <Box className="flow" sx={{ pb: { xs: 12, md: 2 } }}>
    <Box sx={{ borderRadius: '24px', color: '#FFFFFF', background: navy, px: { xs: 2.5, sm: 4 }, py: { xs: 2.5, sm: 3.25 }, mb: { xs: 2, sm: 3 } }}>
      <Stack direction="row" spacing={{ xs: .75, sm: 1 }} sx={{ mb: { xs: 2, sm: 2.5 } }} role="list" aria-label={`Paso ${step + 1} de ${steps.length}`}>{steps.map((name, index) => {
        const done = index < step, current = index === step;
        return <Box key={name} role="listitem" component={done ? 'button' : 'div'} type={done ? 'button' : undefined} onClick={done ? () => setStep(index) : undefined} aria-current={current ? 'step' : undefined} sx={{ display: 'flex', alignItems: 'center', gap: .75, pl: .5, pr: { xs: 1, sm: 1.5 }, py: .5, borderRadius: '999px', border: 0, font: 'inherit', cursor: done ? 'pointer' : 'default', bgcolor: current ? '#FFFFFF' : 'rgba(255,255,255,.08)', color: current ? '#101418' : 'rgba(255,255,255,.75)' }}>
          <Box sx={{ width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, bgcolor: current ? 'primary.main' : done ? '#6FD9C1' : 'rgba(255,255,255,.14)', color: done ? '#0B1220' : '#FFFFFF' }}>{done ? <Check sx={{ fontSize: 14 }} /> : index + 1}</Box>
          <Typography component="span" sx={{ fontSize: 13, fontWeight: 600, display: { xs: current ? 'inline' : 'none', sm: 'inline' } }}>{name}</Typography>
        </Box>;
      })}</Stack>
      <Typography component="h1" sx={{ fontSize: { xs: '1.45rem', sm: '1.85rem' }, fontWeight: 700, lineHeight: 1.15, letterSpacing: '-.035em' }}>{titles[step]}</Typography>
      <Typography sx={{ mt: .75, color: 'rgba(255,255,255,.72)', fontSize: { xs: '.95rem', sm: '1rem' } }}>{descriptions[step]}</Typography>
    </Box>

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 300px', lg: 'minmax(0, 1fr) 340px' }, gap: 3, alignItems: 'start' }}>
      <Box>
        {step === 0 && <Box sx={card}><Stack spacing={2.5}>
          <Box><Typography sx={label}>Foto de tu producto</Typography><Photos images={d.images} onChange={images => update({ images, selectedImage: 0 })} /></Box>
          <Box><Typography sx={label}>¿Qué es?</Typography><Field label="Nombre del producto o servicio" value={d.product} onChange={product => update({ product })} maxLength={80} placeholder="Ej. Torta de chocolate" /></Box>
          <Accordion disableGutters variant="outlined" sx={{ borderRadius: '12px', '&:before': { display: 'none' } }}><AccordionSummary expandIcon={<ExpandMore />}><Typography variant="body2" fontWeight={600}>Contar más del producto (opcional)</Typography></AccordionSummary><AccordionDetails><Field label="¿Qué lo hace especial?" multiline value={d.description} onChange={description => update({ description })} maxLength={350} placeholder="Ej. Hecha en casa, con chocolate peruano" /></AccordionDetails></Accordion>
        </Stack></Box>}

        {step === 1 && <Box sx={card}><Stack spacing={3}>
          <Box role="radiogroup" aria-label="Para qué es la publicación" sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1.25 }}>{intents.map(intent => {
            const selected = intentOf(d).label === intent.label;
            const { hint, icon: Icon } = intentHelp[intent.label];
            return <Card key={intent.label} variant="outlined" sx={{ borderRadius: '16px', borderWidth: 2, borderColor: selected ? 'primary.main' : 'transparent', bgcolor: selected ? 'background.paper' : '#F7F8FA', boxShadow: selected ? '0 0 0 4px rgba(47,91,255,.12)' : 'none' }}><CardActionArea role="radio" aria-checked={selected} onClick={() => update({ type: intent.type, objective: intent.objective })} sx={{ p: 1.75, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
              <Stack direction="row" justifyContent="space-between" sx={{ width: '100%' }}><Box sx={{ width: 38, height: 38, borderRadius: '11px', display: 'grid', placeItems: 'center', bgcolor: selected ? 'primary.main' : '#EEF3FF', color: selected ? '#FFFFFF' : 'primary.main' }}><Icon fontSize="small" /></Box>{selected && <CheckCircle color="primary" fontSize="small" />}</Stack>
              <Box><Typography fontWeight={650} fontSize=".95rem" sx={{ lineHeight: 1.25 }}>{intent.label}</Typography><Typography variant="body2" color="text.secondary">{hint}</Typography></Box>
            </CardActionArea></Card>;
          })}</Box>
          <Box><Typography sx={label}>¿Tiene precio u oferta? <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>(opcional)</Box></Typography><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}><Field label="Precio" value={d.price} onChange={price => update({ price })} maxLength={45} placeholder="Ej. S/ 35" /><Field label="¿Hasta cuándo?" value={d.validity} onChange={validity => update({ validity })} maxLength={60} placeholder="Ej. Solo este sábado" /></Box></Box>
        </Stack></Box>}

        {step === 2 && <Stack spacing={2}>
          <Box sx={card}><Stack spacing={2}>
            {writing && <Box><LinearProgress sx={{ borderRadius: 1 }} /><Typography variant="body2" color="text.secondary" sx={{ mt: .75 }}>Escribiendo tu texto…</Typography></Box>}
            <Field label="Título" value={d.title} onChange={title => update({ title })} maxLength={80} disabled={writing} />
            <Field label="Mensaje" multiline value={d.body} onChange={body => update({ body })} maxLength={180} disabled={writing} />
            <Field label="Frase final" value={d.cta} onChange={cta => update({ cta })} maxLength={40} disabled={writing} placeholder="Ej. Pide por WhatsApp" />
            <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap><Button variant="outlined" startIcon={<AutoAwesome />} disabled={writing} onClick={() => void write(d, [d.title, d.body].join(' · '))}>{writing ? 'Escribiendo…' : 'Escribir otro texto'}</Button>{copyNote && <Typography variant="body2" color={copyNote.ai ? 'success.main' : 'text.secondary'}>{copyNote.message}</Typography>}</Stack>
          </Stack></Box>
          <Accordion disableGutters variant="outlined" sx={{ borderRadius: '20px', border: '1px solid #E6EBF2', '&:before': { display: 'none' }, '& .MuiAccordionSummary-root': { px: { xs: 2, sm: 3 }, minHeight: 56 }, '& .MuiAccordionDetails-root': { px: { xs: 2, sm: 3 }, pb: 3 } }}><AccordionSummary expandIcon={<ExpandMore />}><Typography fontWeight={600}>Más opciones: estilo, tono y textos de cada red</Typography></AccordionSummary><AccordionDetails><Stack spacing={2.5}>
            <Box><Typography sx={label}>Estilo</Typography><StylePicker brand={d.brand} value={d.style} onChange={style => update(styleLook(style, d.brand))} /></Box>
            <Choices label="Forma de hablar" options={tones} value={d.tone} onChange={tone => update({ tone })} />
            {outputs.map(network => <Field key={network} label={`Texto que acompaña la foto en ${networks[network].label}`} multiline value={captionFor(d, network)} onChange={value => update({ captions: { ...d.captions, [network]: value }, ...(network === 'instagram' ? { caption: value } : {}) })} maxLength={captionLimits[network]} disabled={writing} />)}
            <Field label="Indicaciones para el diseño (opcional)" multiline value={d.instructions} onChange={instructions => update({ instructions })} maxLength={700} placeholder="Ej. Usa un fondo cálido" />
          </Stack></AccordionDetails></Accordion>
        </Stack>}

        {showMissing && missing.length > 0 && <Alert severity="warning" sx={{ mt: 2, borderRadius: '14px' }}>Para seguir, falta {missing.join(' y ')}.</Alert>}
        <Box sx={{ mt: 2.5, position: { xs: 'fixed', md: 'static' }, left: 0, right: 0, bottom: 0, zIndex: 10, p: { xs: 1.5, md: 0 }, bgcolor: { xs: 'background.paper', md: 'transparent' }, borderTop: { xs: 1, md: 0 }, borderColor: 'divider' }}>{actions}</Box>
      </Box>

      <Box sx={{ display: { xs: 'none', md: 'block' }, position: 'sticky', top: 16, borderRadius: '24px', background: navy, p: 3, pb: 4 }}>
        <LivePreview d={d} />
        <Stack direction="row" spacing={1.25} sx={{ mt: 4, color: 'rgba(255,255,255,.78)' }}><AutoAwesome sx={{ fontSize: 18, color: '#6FD9C1', mt: .25 }} /><Typography variant="body2" sx={{ lineHeight: 1.5 }}>{tips[step]}</Typography></Stack>
      </Box>
    </Box>
  </Box>;
}

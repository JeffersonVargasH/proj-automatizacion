'use client';

// Banco de pruebas del editor visual (solo desarrollo: /dev/editor). Usa imágenes de ejemplo dibujadas
// en el navegador, sin Supabase ni servicios externos, y no guarda nada.
import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Chip, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import DesignEditor from '@/components/editor/DesignEditor';
import { createDesignScenes, designValues } from '@/lib/editor/design-scenes';
import type { EditorDocument } from '@/lib/editor/editor-state';
import type { BaseImage } from '@/lib/editor/layouts';
import type { SceneFormat } from '@/lib/editor/scene';
import { fieldLabels, type CommercialValues } from '@/lib/editor/bindings';
import { emptyBrand, newDesign } from '@/lib/studio';

type Example = 'photo' | 'background' | 'complete';
const examples: { id: Example; label: string }[] = [
  { id: 'photo', label: 'Foto del producto' },
  { id: 'background', label: 'Fondo IA + producto' },
  { id: 'complete', label: 'Imagen IA completa' },
];

function draw(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void): string {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Sin lienzo');
  paint(ctx);
  return canvas.toDataURL('image/png');
}
function mug(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.fillStyle = 'rgba(80,50,30,.25)'; ctx.beginPath(); ctx.ellipse(cx, cy + size * 0.62, size * 0.62, size * 0.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ad754b'; ctx.lineWidth = size * 0.11; ctx.beginPath(); ctx.arc(cx + size * 0.48, cy + size * 0.05, size * 0.24, -Math.PI / 2.4, Math.PI / 2.4); ctx.stroke();
  ctx.fillStyle = '#ad754b'; ctx.beginPath(); ctx.moveTo(cx - size * 0.45, cy - size * 0.4); ctx.lineTo(cx + size * 0.45, cy - size * 0.4); ctx.lineTo(cx + size * 0.4, cy + size * 0.5); ctx.quadraticCurveTo(cx, cy + size * 0.66, cx - size * 0.4, cy + size * 0.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d2a980'; ctx.beginPath(); ctx.ellipse(cx, cy - size * 0.4, size * 0.45, size * 0.09, 0, 0, Math.PI * 2); ctx.fill();
}
function sampleImages() {
  const product = draw(900, 900, ctx => { ctx.fillStyle = '#efe3d3'; ctx.fillRect(0, 0, 900, 900); mug(ctx, 450, 430, 380); });
  const logo = draw(300, 300, ctx => { ctx.fillStyle = '#1a2c77'; ctx.beginPath(); ctx.arc(150, 150, 140, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 150px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('L', 150, 160); });
  const scenery = (ctx: CanvasRenderingContext2D) => { const g = ctx.createLinearGradient(0, 0, 0, 1024); g.addColorStop(0, '#f6d8c2'); g.addColorStop(1, '#8c5a3c'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 1024); ctx.fillStyle = 'rgba(255,255,255,.25)'; [[200, 220, 120], [820, 160, 90], [700, 780, 160]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }); ctx.fillStyle = '#5b3a26'; ctx.fillRect(0, 760, 1024, 264); };
  const background = draw(1024, 1024, scenery);
  const complete = draw(1024, 1024, ctx => { scenery(ctx); mug(ctx, 512, 520, 330); });
  return { product, logo, background, complete };
}

function sampleDocument(example: Example, images: ReturnType<typeof sampleImages>): EditorDocument {
  const brand = { ...emptyBrand, name: 'Cerámica Luna', logo: images.logo, primary: '#1A2C77', secondary: '#FFF4E8', instagram: '@ceramica.luna', address: 'Jr. Lima 123, Cusco' };
  const design = { ...newDesign(brand), product: 'Taza artesanal', title: 'Taza artesanal de cerámica', body: 'Hecha a mano, apta para microondas.', price: 'S/ 35', validity: 'Solo esta semana', cta: 'Escríbenos', contact: '999 888 777', images: [images.product] };
  const base: BaseImage | undefined = example === 'complete' ? { src: images.complete, kind: 'complete' } : example === 'background' ? { src: images.background, kind: 'background' } : undefined;
  const scenes = createDesignScenes(design, base ? { base: { instagram: base, facebook: base, whatsapp: base } } : {});
  // Una capa bloqueada para probar que no se mueve.
  scenes.instagram.layers = scenes.instagram.layers.map(layer => layer.name === 'Logo' ? { ...layer, locked: true } : layer);
  return { scenes, values: designValues(design) };
}

export default function PlaygroundBody() {
  const [example, setExample] = useState<Example>('photo');
  // Este componente solo se monta en el navegador (ver EditorPlayground), así que puede dibujar aquí.
  const [images] = useState(sampleImages);
  const [changes, setChanges] = useState(0);
  const [values, setValues] = useState<CommercialValues | null>(null);
  const [exported, setExported] = useState<{ url: string; format: SceneFormat; width: number; height: number; size: number } | null>(null);
  const document = useMemo(() => sampleDocument(example, images), [example, images]);
  useEffect(() => () => { if (exported) URL.revokeObjectURL(exported.url); }, [exported]);

  async function onExport(blob: Blob, format: SceneFormat) {
    const url = URL.createObjectURL(blob);
    const bitmap = await createImageBitmap(blob);
    setExported({ url, format, width: bitmap.width, height: bitmap.height, size: blob.size });
    bitmap.close();
  }

  const shownValues = values ?? document.values;
  return <Box sx={{ maxWidth: 1320, mx: 'auto', px: 2, py: 3 }}>
    <Typography variant="h1" sx={{ fontSize: '1.6rem' }}>Editor visual · banco de pruebas</Typography>
    <Alert severity="info" sx={{ my: 2 }}>Solo en desarrollo. Usa imágenes de ejemplo y no guarda nada. El logo de Instagram está bloqueado a propósito.</Alert>
    <ToggleButtonGroup exclusive size="small" value={example} onChange={(_, value: Example | null) => { if (value) { setExample(value); setChanges(0); setValues(null); } }} sx={{ mb: 2, flexWrap: 'wrap' }}>
      {examples.map(item => <ToggleButton key={item.id} value={item.id} sx={{ textTransform: 'none' }}>{item.label}</ToggleButton>)}
    </ToggleButtonGroup>
    <DesignEditor key={example} document={document} onChange={next => { setChanges(value => value + 1); setValues(next.values); }} onExport={(blob, format) => void onExport(blob, format)} />
    <Box sx={{ display: 'grid', gap: 2, mt: 2, gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'minmax(0,1fr) minmax(0,1fr)' }, alignItems: 'start' }}>
      <Box data-testid="design-values" sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
        <Typography variant="body2" fontWeight={650} sx={{ mb: 1 }}>Datos de la publicación (fuente única en Design)</Typography>
        {(Object.keys(shownValues) as (keyof CommercialValues)[]).map(field => <Typography key={field} variant="body2" data-field={field}><strong>{fieldLabels[field]}:</strong> {shownValues[field] || '—'}</Typography>)}
      </Box>
      <Stack spacing={1.5}>
        <Chip label={`Cambios registrados: ${changes}`} sx={{ alignSelf: 'flex-start' }} data-testid="changes" />
        {exported ? <Box>
          <Typography variant="body2" fontWeight={600} data-testid="export-info">PNG exportado · {exported.format} · {exported.width} × {exported.height} px · {Math.round(exported.size / 1024)} KB</Typography>
          <Box component="img" src={exported.url} alt="PNG exportado" sx={{ mt: 1, width: '100%', border: 1, borderColor: 'divider', borderRadius: 1 }} />
        </Box> : <Typography variant="body2" color="text.secondary">Exporta para ver aquí el PNG resultante.</Typography>}
      </Stack>
    </Box>
  </Box>;
}

'use client';

import { ChangeEvent, ReactNode, useState } from 'react';
import { AddPhotoAlternate, Check, DeleteOutline } from '@mui/icons-material';
import { Box, Button, Card, CardActionArea, IconButton, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { Brand, styles } from '@/lib/studio';
import { readPhoto } from '@/lib/studio-storage';

export function Field({ label, value, onChange, multiline = false, type = 'text', maxLength = 120, placeholder, required = false, disabled = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; type?: string; maxLength?: number; placeholder?: string; required?: boolean; disabled?: boolean }) {
  return <TextField fullWidth label={label} value={value} onChange={event => onChange(event.target.value)} type={type} multiline={multiline} minRows={multiline ? 3 : undefined} inputProps={{ maxLength }} placeholder={placeholder} required={required} disabled={disabled} slotProps={{ inputLabel: type === 'date' || type === 'datetime-local' ? { shrink: true } : undefined }} />;
}

export function Choices({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string; onChange: (value: string) => void }) {
  return <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}><Typography component="legend" variant="body2" fontWeight={700} color="text.secondary" sx={{ mb: 1 }}>{label}</Typography><ToggleButtonGroup exclusive value={value} onChange={(_, next: string | null) => next && onChange(next)} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, '& .MuiToggleButtonGroup-grouped': { border: '1px solid', borderColor: 'divider', borderRadius: 2, px: 1.5, py: 1, textTransform: 'none', color: 'text.secondary', '&.Mui-selected': { color: 'primary.dark', backgroundColor: '#EEF3FF', borderColor: 'primary.main' } } }}>{options.map(option => <ToggleButton key={option} value={option} aria-label={option}>{option}</ToggleButton>)}</ToggleButtonGroup></Box>;
}

const styleInfo: Record<string, { hint: string; icon: string }> = {
  Moderno: { hint: 'Limpio y ordenado', icon: '/estilos/moderno.webp' },
  Vibrante: { hint: 'Colores intensos', icon: '/estilos/vibrante.webp' },
  Minimalista: { hint: 'Sobrio y elegante', icon: '/estilos/minimalista.webp' },
};

/** Elige el estilo con los íconos de la marca Clic. */
export function StylePicker({ value, onChange }: { value: string; onChange: (style: string) => void; brand?: Pick<Brand, 'primary' | 'secondary'> }) {
  return <Box role="radiogroup" aria-label="Estilo de la publicación" sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: { xs: 1, sm: 1.5 }, maxWidth: 560 }}>{styles.map(style => {
    const selected = value === style;
    const { hint, icon } = styleInfo[style] || styleInfo.Moderno;
    return <Card key={style} variant="outlined" sx={{ borderRadius: '18px', borderWidth: 2, borderColor: selected ? 'primary.main' : '#E6EBF2', boxShadow: selected ? '0 0 0 4px rgba(47,91,255,.12)' : 'none', transition: 'border-color 150ms ease, box-shadow 150ms ease' }}>
      <CardActionArea role="radio" aria-checked={selected} aria-label={`${style}: ${hint}`} onClick={() => onChange(style)} sx={{ p: { xs: 1.25, sm: 1.75 }, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        <Box sx={{ height: { xs: 64, sm: 84 }, display: 'flex', justifyContent: 'center', overflow: 'hidden' }}><Box component="img" src={icon} alt="" sx={{ height: { xs: 64, sm: 84 }, width: { xs: 64, sm: 84 }, objectFit: 'contain', filter: selected ? 'none' : 'saturate(.85)', transition: 'transform 150ms ease', transform: selected ? 'scale(1.04)' : 'none' }} /></Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.25, gap: .5 }}>
          <Box minWidth={0}><Typography fontWeight={650} fontSize={{ xs: 13, sm: 15 }} noWrap>{style}</Typography><Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>{hint}</Typography></Box>
          <Box sx={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', border: selected ? 0 : '2px solid #D3DAE5', bgcolor: selected ? 'primary.main' : 'transparent', color: '#FFFFFF' }}>{selected && <Check sx={{ fontSize: 15 }} />}</Box>
        </Stack>
      </CardActionArea>
    </Card>;
  })}</Box>;
}

export function Panel({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return <Paper className={className} variant="outlined" sx={{ p: { xs: 2, sm: 2.75 }, borderColor: '#E1E1E6', borderRadius: 2.25, bgcolor: 'background.paper', boxShadow: '0 10px 28px rgba(28,28,30,.045)', transition: 'border-color 180ms ease, box-shadow 180ms ease', '&:focus-within': { borderColor: '#9BD7F5', boxShadow: '0 12px 32px rgba(0,122,255,.08)' } }}>{title && <Typography variant="h3" sx={{ mb: 2, letterSpacing: '-.02em' }}>{title}</Typography>}{children}</Paper>;
}

export function Photos({ images, onChange, logo = false }: { images: string[]; onChange: (images: string[]) => void; logo?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const limit = logo ? 1 : 3;
  async function upload(files: File[]) {
    setError('');
    if (files.length + images.length > limit) { setError(`Puedes agregar hasta ${limit} ${logo ? 'logo' : 'fotos'}.`); return; }
    setBusy(true);
    try { const result = await Promise.all(files.map(file => readPhoto(file, logo))); onChange([...images, ...result]); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo procesar la imagen.'); }
    finally { setBusy(false); }
  }
  const onFiles = (event: ChangeEvent<HTMLInputElement>) => { const files = Array.from(event.target.files || []); event.target.value = ''; if (files.length) void upload(files); };
  return <Stack spacing={1.25}>
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))', gap: 1.25 }}>
      {images.map((src, index) => <Box key={index} sx={{ position: 'relative', aspectRatio: logo ? '1' : '4/3', overflow: 'hidden', borderRadius: 2.5, bgcolor: 'grey.100', border: '1px solid', borderColor: 'divider' }}><Box component="img" src={src} alt={logo ? 'Logo del negocio' : `Foto del producto ${index + 1}`} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /><IconButton size="small" disabled={busy} onClick={() => onChange(images.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Quitar ${logo ? 'logo' : `foto ${index + 1}`}`} sx={{ position: 'absolute', top: 6, right: 6, color: 'common.white', bgcolor: 'rgba(24,35,59,.76)', '&:hover': { bgcolor: 'error.main' } }}><DeleteOutline fontSize="small" /></IconButton>{!logo && <Typography variant="caption" sx={{ position: 'absolute', left: 6, bottom: 6, px: .75, py: .25, borderRadius: 1, color: 'common.white', bgcolor: 'rgba(24,35,59,.72)' }}>{index === 0 ? 'Principal' : `Foto ${index + 1}`}</Typography>}</Box>)}
      {images.length < limit && <Button component="label" variant="outlined" disabled={busy} sx={{ gridColumn: images.length ? undefined : '1 / -1', minHeight: images.length ? 120 : 170, flexDirection: 'column', gap: .75, borderStyle: 'dashed', borderWidth: 2, borderRadius: '16px', bgcolor: images.length ? undefined : '#F5F8FF', '&:hover': { borderWidth: 2, borderStyle: 'dashed' } }}><AddPhotoAlternate sx={{ fontSize: images.length ? 28 : 40 }} /><Box component="span" sx={{ fontSize: images.length ? '.9rem' : '1.02rem', fontWeight: 650 }}>{busy ? 'Subiendo…' : logo ? 'Subir logo' : images.length ? 'Agregar otra' : 'Toca aquí para subir una foto'}</Box>{!logo && !images.length && <Box component="span" sx={{ fontSize: '.82rem', color: 'text.secondary', fontWeight: 400 }}>Desde tu galería o cámara</Box>}<input hidden aria-label={logo ? 'Subir logo' : 'Agregar fotos del producto'} type="file" accept="image/jpeg,image/png,image/webp" multiple={!logo} onChange={onFiles} /></Button>}
    </Box>
    <Typography variant="caption" color="text.secondary">{logo ? 'Foto JPG, PNG o WebP de hasta 8 MB.' : `Puedes subir hasta 3 fotos (${images.length} de 3).`}</Typography>
    {error && <Typography variant="caption" color="error.main" role="alert">{error}</Typography>}
  </Stack>;
}

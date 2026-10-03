'use client';

import { ChangeEvent, ReactNode, useState } from 'react';
import { AddPhotoAlternate, DeleteOutline } from '@mui/icons-material';
import { Box, Button, IconButton, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { readPhoto } from '@/lib/studio-storage';

export function Field({ label, value, onChange, multiline = false, type = 'text', maxLength = 120, placeholder, required = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; type?: string; maxLength?: number; placeholder?: string; required?: boolean }) {
  return <TextField fullWidth label={label} value={value} onChange={event => onChange(event.target.value)} type={type} multiline={multiline} minRows={multiline ? 3 : undefined} inputProps={{ maxLength }} placeholder={placeholder} required={required} slotProps={{ inputLabel: type === 'date' || type === 'datetime-local' ? { shrink: true } : undefined }} />;
}

export function Choices({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string; onChange: (value: string) => void }) {
  return <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}><Typography component="legend" variant="body2" fontWeight={700} color="text.secondary" sx={{ mb: 1 }}>{label}</Typography><ToggleButtonGroup exclusive value={value} onChange={(_, next: string | null) => next && onChange(next)} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, '& .MuiToggleButtonGroup-grouped': { border: '1px solid', borderColor: 'divider', borderRadius: 2, px: 1.5, py: 1, textTransform: 'none', color: 'text.secondary', '&.Mui-selected': { color: 'primary.dark', backgroundColor: '#EEF2FF', borderColor: 'primary.main' } } }}>{options.map(option => <ToggleButton key={option} value={option} aria-label={option}>{option}</ToggleButton>)}</ToggleButtonGroup></Box>;
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
      {images.length < limit && <Button component="label" variant="outlined" disabled={busy} startIcon={<AddPhotoAlternate />} sx={{ minHeight: logo ? 112 : 120, flexDirection: 'column', gap: .5, borderStyle: 'dashed', borderRadius: 2.5, color: 'primary.dark' }}>{busy ? 'Procesando…' : logo ? 'Subir logo' : 'Agregar fotos'}<input hidden aria-label={logo ? 'Subir logo' : 'Agregar fotos del producto'} type="file" accept="image/jpeg,image/png,image/webp" multiple={!logo} onChange={onFiles} /></Button>}
    </Box>
    <Typography variant="caption" color="text.secondary">JPG, PNG o WebP. Máximo 8 MB por imagen.{!logo && ` ${images.length}/3 fotos. Al menos una es obligatoria.`}</Typography>
    {error && <Typography variant="caption" color="error.main" role="alert">{error}</Typography>}
  </Stack>;
}

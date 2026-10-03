'use client';

import { useState } from 'react';
import { Palette, Save, Storefront } from '@mui/icons-material';
import { Box, Button, Divider, Stack, Typography } from '@mui/material';
import { Brand } from '@/lib/studio';
import { Field, Panel, Photos } from './Fields';

export function BrandForm({ initial, onSave }: { initial: Brand; onSave: (brand: Brand) => Promise<void> }) {
  const [brand, setBrand] = useState(initial);
  const [busy, setBusy] = useState(false);
  const change = (patch: Partial<Brand>) => setBrand(current => ({ ...current, ...patch }));
  return <Box component="form" onSubmit={async event => { event.preventDefault(); setBusy(true); try { await onSave({ ...brand, name: brand.name.trim() }); } finally { setBusy(false); } }}>
    <Stack spacing={1} sx={{ mb: 3 }}><Typography variant="overline" color="primary.dark" sx={{ fontWeight: 800, letterSpacing: '.12em' }}>MI NEGOCIO</Typography><Typography variant="h1">Un negocio, tu estilo.</Typography><Typography color="text.secondary" sx={{ maxWidth: 680 }}>Configura tu identidad una vez y reutilízala en tus próximas publicaciones.</Typography></Stack>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.05fr .95fr' }, gap: 2 }}>
      <Panel title="Identidad de marca"><Stack spacing={2.25}><Field label="Nombre del negocio" value={brand.name} onChange={name => change({ name })} maxLength={60} required placeholder="Ej. Taller de cerámica Luna" /><Divider /><Stack direction="row" spacing={1} alignItems="center"><Storefront color="primary" /><Box><Typography fontWeight={700}>Logo del negocio</Typography><Typography variant="caption" color="text.secondary">Opcional · se usará en tus diseños.</Typography></Box></Stack><Photos logo images={brand.logo ? [brand.logo] : []} onChange={images => change({ logo: images[0] || '' })} /><Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}><ColorField label="Color principal" value={brand.primary} onChange={primary => change({ primary })} /><ColorField label="Color de fondo" value={brand.secondary} onChange={secondary => change({ secondary })} /></Stack></Stack></Panel>
      <Panel title="Datos de contacto"><Stack spacing={2}><Field label="WhatsApp o teléfono" type="tel" value={brand.phone} onChange={phone => change({ phone })} maxLength={25} placeholder="Ej. +51 999 123 456" /><Field label="Instagram" value={brand.instagram} onChange={instagram => change({ instagram })} maxLength={80} placeholder="@tunegocio" /><Field label="Facebook" value={brand.facebook} onChange={facebook => change({ facebook })} maxLength={80} placeholder="Nombre o enlace de tu página" /><Field label="Dirección o zona de atención" value={brand.address} onChange={address => change({ address })} maxLength={100} placeholder="Ej. Miraflores, Lima" /><Typography variant="caption" color="text.secondary">Estos datos pueden aparecer en tus publicaciones. Agregar una red aquí no conecta la cuenta.</Typography></Stack></Panel>
    </Box>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mt: 2.5 }}><Button type="submit" variant="contained" startIcon={<Save />} disabled={busy || !brand.name.trim()}>{busy ? 'Guardando…' : 'Guardar mi negocio'}</Button><Typography variant="caption" color="text.secondary">Se guarda en este navegador.</Typography></Stack>
  </Box>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0, flex: 1 }}><Box component="label" sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: value, border: '1px solid', borderColor: 'divider', cursor: 'pointer', flexShrink: 0 }}><input aria-label={label} type="color" value={value} onChange={event => onChange(event.target.value)} style={{ opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} /></Box><Box sx={{ minWidth: 0 }}><Typography variant="body2" fontWeight={700}>{label}</Typography><Typography variant="caption" color="text.secondary">{value.toUpperCase()}</Typography></Box><Palette fontSize="small" sx={{ ml: 'auto', color: 'text.disabled' }} /></Stack>;
}

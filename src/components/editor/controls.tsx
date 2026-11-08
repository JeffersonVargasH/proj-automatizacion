'use client';

// Controles pequeños de los paneles del editor. Los que cambian de forma continua (deslizadores, color)
// envían `transient` mientras se mueven y llaman a `onSettle` al terminar: así un ajuste es un solo paso.
import { useState } from 'react';
import { Box, Slider, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { colorTokens, isHex, resolvePaint, type ColorToken, type Paint, type Palette } from '@/lib/editor/scene';

const tokenLabels: Record<ColorToken, string> = { primary: 'Principal', secondary: 'Fondo', ink: 'Texto', onPrimary: 'Sobre principal', paper: 'Blanco' };

/** Número que se confirma al salir del campo o con Enter (Escape deshace lo escrito). */
export function NumberField({ label, value, min, max, step = 1, disabled, onCommit, suffix }: { label: string; value: number; min?: number; max?: number; step?: number; disabled?: boolean; onCommit: (value: number) => void; suffix?: string }) {
  const shown = String(Math.round(value * 10) / 10);
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const parsed = Number(draft.replace(',', '.'));
    setDraft(null);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed));
    if (clamped !== value) onCommit(clamped);
  };
  return <TextField size="small" label={label} type="number" value={draft ?? shown} disabled={disabled}
    slotProps={{ htmlInput: { min, max, step, inputMode: 'decimal' }, input: suffix ? { endAdornment: <Typography variant="caption" color="text.secondary">{suffix}</Typography> } : undefined }}
    onChange={event => setDraft(event.target.value)} onBlur={commit}
    onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commit(); } else if (event.key === 'Escape') { event.stopPropagation(); setDraft(null); } }} />;
}

/** Deslizador con valor visible: se ve en vivo y se registra un solo paso al soltar. */
export function RangeField({ label, value, min, max, step = 1, disabled, format = (v: number) => String(v), onChange, onSettle }: { label: string; value: number; min: number; max: number; step?: number; disabled?: boolean; format?: (value: number) => string; onChange: (value: number) => void; onSettle: () => void }) {
  return <Box>
    <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="body2" fontWeight={600}>{format(value)}</Typography></Stack>
    <Slider size="small" value={Math.min(max, Math.max(min, value))} min={min} max={max} step={step} disabled={disabled} aria-label={label}
      onChange={(_, next) => onChange(Array.isArray(next) ? next[0] : next)} onChangeCommitted={onSettle} />
  </Box>;
}

/** Colores de la escena (paleta de la marca) más un color libre. */
export function PaintField({ label, value, palette, disabled, allowNone = false, onChange, onSettle }: { label: string; value: Paint | null; palette: Palette; disabled?: boolean; allowNone?: boolean; onChange: (paint: Paint | null, transient?: boolean) => void; onSettle: () => void }) {
  const current = resolvePaint(value, palette);
  const selectedToken = value && typeof value === 'object' ? value.token : null;
  const swatch = (selected: boolean) => ({ width: 30, height: 30, borderRadius: '50%', border: '2px solid', borderColor: selected ? 'primary.main' : 'divider', boxShadow: selected ? '0 0 0 2px #fff inset' : 'none', cursor: disabled ? 'default' : 'pointer', p: 0, opacity: disabled ? 0.5 : 1 });
  return <Box>
    <Typography variant="body2" color="text.secondary" sx={{ mb: .75 }}>{label}</Typography>
    <Stack direction="row" spacing={.75} alignItems="center" flexWrap="wrap" useFlexGap>
      {colorTokens.map(token => <Tooltip key={token} title={`${tokenLabels[token]} de la marca`}><Box component="button" type="button" disabled={disabled} aria-label={`${label}: ${tokenLabels[token]}`} aria-pressed={selectedToken === token} onClick={() => onChange({ token })} sx={{ ...swatch(selectedToken === token), bgcolor: palette[token] }} /></Tooltip>)}
      {allowNone && <Tooltip title="Sin color"><Box component="button" type="button" disabled={disabled} aria-label={`${label}: sin color`} aria-pressed={value === null} onClick={() => onChange(null)} sx={{ ...swatch(value === null), bgcolor: '#fff', backgroundImage: 'linear-gradient(135deg, transparent 45%, #d32f2f 45%, #d32f2f 55%, transparent 55%)' }} /></Tooltip>}
      <Tooltip title="Otro color"><Box component="label" sx={{ ...swatch(typeof value === 'string'), position: 'relative', overflow: 'hidden', background: typeof value === 'string' ? value : 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}>
        <input type="color" aria-label={`${label}: otro color`} disabled={disabled} value={isHex(current) ? current : '#000000'}
          onChange={event => onChange(event.target.value.toLowerCase(), true)} onBlur={onSettle}
          style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
      </Box></Tooltip>
    </Stack>
  </Box>;
}

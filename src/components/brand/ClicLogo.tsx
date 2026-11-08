import { Box, Stack } from '@mui/material';

// Isotipo de Clic: una "C" armada con bloques en tres tonos de azul.
const deep = '#0540FF';
const mid = '#2E8BFF';
const soft = '#BDDBFA';
const corner = 'M34 4v22a4 4 0 0 1-4 4H3.4a2.6 2.6 0 0 1-2.6-3A32 32 0 0 1 30 0a4 4 0 0 1 4 4Z';

export function ClicMark({ size = 40 }: { size?: number }) {
  return <Box component="svg" viewBox="0 0 90 90" aria-hidden="true" sx={{ width: size, height: size, flexShrink: 0, display: 'block' }}>
    <path d={corner} fill={deep} />
    <rect x="34" y="0" width="36" height="30" rx="7" fill={mid} />
    <rect x="60" y="0" width="30" height="30" rx="7" fill={soft} />
    <rect x="0" y="31.5" width="34" height="27" rx="7" fill={mid} />
    <path d={corner} fill={deep} transform="matrix(1 0 0 -1 0 90)" />
    <rect x="34" y="60" width="36" height="30" rx="7" fill={mid} />
    <rect x="60" y="60" width="30" height="30" rx="7" fill={soft} />
  </Box>;
}

/** Logo completo. `inverse` para fondos oscuros. */
export function ClicLogo({ size = 32, wordmark = false, inverse = false }: { size?: number; wordmark?: boolean; inverse?: boolean }) {
  if (!wordmark) return <ClicMark size={size} />;
  return <Stack direction="row" alignItems="center" sx={{ gap: `${size * 0.28}px` }} aria-label="Clic">
    <ClicMark size={size} />
    <Box component="span" sx={{ fontSize: size * 0.92, lineHeight: 1, fontWeight: 700, letterSpacing: '-0.045em', color: inverse ? '#FFFFFF' : '#101418' }}>Clic</Box>
  </Stack>;
}

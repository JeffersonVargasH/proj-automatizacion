import { AutoAwesome, Brush } from '@mui/icons-material';
import { Box } from '@mui/material';

export function ClicMark({ size = 40 }: { size?: number }) {
  return <Box aria-hidden="true" sx={{ position: 'relative', width: size, height: size, display: 'grid', placeItems: 'center', flexShrink: 0, color: '#FFFFFF', background: 'linear-gradient(145deg, #7188F3 0%, #3F63E9 100%)', borderRadius: '50%' }}><Brush sx={{ fontSize: size * 0.58 }} /><AutoAwesome sx={{ position: 'absolute', right: size * 0.16, bottom: size * 0.14, fontSize: size * 0.2, color: '#FFCC00', opacity: 0.96 }} /></Box>;
}

export function ClicLogo({ size = 32 }: { size?: number }) {
  return <ClicMark size={size} />;
}

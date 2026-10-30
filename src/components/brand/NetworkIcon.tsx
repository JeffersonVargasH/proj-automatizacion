import { Facebook, Instagram, WhatsApp } from '@mui/icons-material';
import { Box } from '@mui/material';
import type { Network } from '@/lib/studio';

// Colores oficiales de cada red, como en la guía de marca de Clic.
export const networkLook = {
  instagram: { icon: Instagram, color: '#E1306C', short: 'Instagram' },
  facebook: { icon: Facebook, color: '#1877F2', short: 'Facebook' },
  whatsapp: { icon: WhatsApp, color: '#25D366', short: 'WhatsApp' },
} satisfies Record<Network, unknown>;

/** Ícono de la red. `badge` lo pone dentro de un círculo, para fondos oscuros o tarjetas. */
export function NetworkIcon({ network, size = 20, badge = false }: { network: Network; size?: number; badge?: boolean }) {
  const { icon: Icon, color } = networkLook[network];
  if (!badge) return <Icon aria-hidden sx={{ fontSize: size, color }} />;
  return <Box aria-hidden sx={{ width: size * 1.8, height: size * 1.8, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: '#FFFFFF', boxShadow: '0 1px 3px rgba(16,20,24,.12)', flexShrink: 0 }}><Icon sx={{ fontSize: size, color }} /></Box>;
}

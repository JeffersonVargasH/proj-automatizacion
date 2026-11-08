import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import AppThemeProvider from '@/components/theme/AppThemeProvider';
import './globals.css';

// Tipografía de la marca. Se expone como variable para que el tema de MUI la use.
const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });

export const metadata: Metadata = {
  title: 'Clic · Estudio de publicaciones',
  description: 'Convierte tus fotos en publicaciones listas para Instagram, Facebook y WhatsApp.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={geist.variable}>
      <body><AppRouterCacheProvider><AppThemeProvider>{children}</AppThemeProvider></AppRouterCacheProvider></body>
    </html>
  );
}

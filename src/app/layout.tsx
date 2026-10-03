import type { Metadata } from 'next';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import AppThemeProvider from '@/components/theme/AppThemeProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'CreaMás · Estudio de publicaciones',
  description: 'Crea publicaciones para tu negocio con tus fotos, colores e ideas.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body><AppRouterCacheProvider><AppThemeProvider>{children}</AppThemeProvider></AppRouterCacheProvider></body>
    </html>
  );
}

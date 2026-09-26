import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Impulsa · Tu estudio creativo',
  description: 'Crea publicaciones para tu negocio con tus fotos, colores e ideas.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Impulsa Wizard',
  description: 'Crea flyers increíbles de manera automatizada',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-slate-900 text-slate-900">
        <div className="max-w-md mx-auto min-h-screen relative bg-slate-50 shadow-2xl overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}

'use client';

// Carga el banco de pruebas solo en el navegador: dibuja imágenes de ejemplo con <canvas>.
import dynamic from 'next/dynamic';
import { Skeleton } from '@mui/material';

const PlaygroundBody = dynamic(() => import('./PlaygroundBody'), { ssr: false, loading: () => <Skeleton variant="rounded" height={480} sx={{ m: 3 }} /> });

export default function EditorPlayground() {
  return <PlaygroundBody />;
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import EditorPlayground from '@/components/editor/dev/EditorPlayground';

export const metadata: Metadata = { title: 'Editor visual · desarrollo', robots: { index: false, follow: false } };

// Banco de pruebas del editor visual. Solo existe con `next dev`: en producción responde 404.
export default function EditorDevPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <EditorPlayground />;
}

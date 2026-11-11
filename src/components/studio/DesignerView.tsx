'use client';

// Abre el editor visual (Konva) con la publicación actual. Si todavía no tiene escenas, se crean con la
// plantilla: fondo de IA (si hay) + foto real del producto + logo + textos editables. Cada cambio se guarda
// en el diseño (escenas y textos comerciales), y el autoguardado de siempre lo lleva a IndexedDB y Supabase.
import { useState } from 'react';
import { ArrowBack } from '@mui/icons-material';
import { Box, Button, Stack, Typography } from '@mui/material';
import DesignEditor from '@/components/editor/DesignEditor';
import { designValues, ensureDesignScenes } from '@/lib/editor/design-scenes';
import type { EditorDocument } from '@/lib/editor/editor-state';
import type { Design, Network } from '@/lib/studio';

export function DesignerView({ design, update, onBack }: { design: Design; update: (patch: Partial<Design>) => void; onBack: () => void }) {
  // El documento se arma una sola vez al abrir; desde ahí el editor es la fuente de los cambios.
  const [document] = useState<EditorDocument>(() => {
    const generated = design.generation?.status === 'completed' && design.generation.kind === 'background' ? design.generation.urls : {};
    const seeded = ensureDesignScenes(design, { base: Object.fromEntries(Object.entries(generated).map(([network, src]) => [network, { src: src as string, kind: 'background' as const }])) as Partial<Record<Network, { src: string; kind: 'background' }>> });
    return { scenes: seeded.scenes ?? {}, values: designValues(design) };
  });

  return <Box sx={{ pb: 2 }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1} sx={{ mb: 2 }}>
      <Box>
        <Button variant="text" startIcon={<ArrowBack />} onClick={onBack} sx={{ ml: -1 }}>Volver a mi publicación</Button>
        <Typography variant="h1">Editor visual</Typography>
        <Typography color="text.secondary" sx={{ mt: .5 }}>Mueve, cambia o agrega textos, formas e imágenes. Los cambios se guardan solos.</Typography>
      </Box>
    </Stack>
    <DesignEditor document={document} initialFormat={design.format as Network}
      onChange={next => update({ scenes: next.scenes, ...next.values })} />
  </Box>;
}

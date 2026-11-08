'use client';

// Lista de capas del formato activo, de la que está más arriba a la del fondo. La selección es la misma
// que la del lienzo. Ocultar, bloquear, renombrar, ordenar, duplicar y eliminar pasan por el reductor
// del editor, así que todo se puede deshacer.
import { useState } from 'react';
import { ArrowDownward, ArrowUpward, CircleOutlined, ContentCopy, Crop54, DeleteOutline, DriveFileRenameOutline, HorizontalRule, Image as ImageIcon, Link as LinkIcon, Lock, LockOpen, Sell, TextFields, Visibility, VisibilityOff } from '@mui/icons-material';
import { Box, Chip, IconButton, List, ListItemButton, ListItemIcon, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { Panel } from '@/components/studio/Fields';
import { fieldLabels } from '@/lib/editor/bindings';
import type { Arrange } from '@/lib/editor/operations';
import type { Layer, Scene } from '@/lib/editor/scene';

const imageRoleLabels = { 'ai-complete': 'Imagen con IA', 'ai-background': 'Fondo con IA', product: 'Foto del producto', photo: 'Imagen', logo: 'Logo' } as const;
const shapeLabels = { rect: 'Rectángulo', ellipse: 'Círculo', line: 'Línea', badge: 'Etiqueta' } as const;

export function layerKindLabel(layer: Layer): string {
  if (layer.type === 'text') return layer.bind ? `Texto · ${fieldLabels[layer.bind.field]}` : 'Texto libre';
  if (layer.type === 'image') return imageRoleLabels[layer.role];
  return shapeLabels[layer.kind];
}

function KindIcon({ layer }: { layer: Layer }) {
  if (layer.type === 'text') return <TextFields fontSize="small" />;
  if (layer.type === 'image') return <ImageIcon fontSize="small" />;
  if (layer.kind === 'ellipse') return <CircleOutlined fontSize="small" />;
  if (layer.kind === 'line') return <HorizontalRule fontSize="small" />;
  if (layer.kind === 'badge') return <Sell fontSize="small" />;
  return <Crop54 fontSize="small" />;
}

export type LayerListActions = {
  select: (id: string) => void;
  change: (id: string, patch: Partial<Layer>) => void;
  arrange: (id: string, where: Arrange) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
};

function NameEditor({ layer, onDone }: { layer: Layer; onDone: (name: string | null) => void }) {
  const [value, setValue] = useState(layer.name || layerKindLabel(layer));
  return <TextField size="small" autoFocus value={value} aria-label="Nombre de la capa" slotProps={{ htmlInput: { maxLength: 60 } }} sx={{ flex: 1 }}
    onChange={event => setValue(event.target.value)} onClick={event => event.stopPropagation()}
    onBlur={() => onDone(value.trim())}
    onKeyDown={event => { event.stopPropagation(); if (event.key === 'Enter') onDone(value.trim()); else if (event.key === 'Escape') onDone(null); }} />;
}

export function LayersPanel({ scene, selectedId, actions }: { scene: Scene; selectedId: string | null; actions: LayerListActions }) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const top = scene.layers.length - 1;
  const selectedIndex = scene.layers.findIndex(layer => layer.id === selectedId);
  const selected = selectedIndex >= 0 ? scene.layers[selectedIndex] : null;
  const rows = scene.layers.map((layer, index) => ({ layer, index })).reverse();

  return <Panel title="Capas">
    <Stack direction="row" spacing={.5} sx={{ mb: 1 }} aria-label="Acciones de la capa elegida">
      <Tooltip title="Subir"><span><IconButton size="small" aria-label="Subir capa" disabled={!selected || selectedIndex === top} onClick={() => selected && actions.arrange(selected.id, 'forward')}><ArrowUpward fontSize="small" /></IconButton></span></Tooltip>
      <Tooltip title="Bajar"><span><IconButton size="small" aria-label="Bajar capa" disabled={!selected || selectedIndex === 0} onClick={() => selected && actions.arrange(selected.id, 'backward')}><ArrowDownward fontSize="small" /></IconButton></span></Tooltip>
      <Tooltip title="Cambiar nombre"><span><IconButton size="small" aria-label="Cambiar nombre de la capa" disabled={!selected} onClick={() => selected && setRenaming(selected.id)}><DriveFileRenameOutline fontSize="small" /></IconButton></span></Tooltip>
      <Tooltip title="Duplicar (Ctrl+D)"><span><IconButton size="small" aria-label="Duplicar capa" disabled={!selected} onClick={() => selected && actions.duplicate(selected.id)}><ContentCopy fontSize="small" /></IconButton></span></Tooltip>
      <Tooltip title={selected?.locked ? 'Desbloquéala para eliminarla' : 'Eliminar (Supr)'}><span><IconButton size="small" aria-label="Eliminar capa" color="error" disabled={!selected || selected.locked} onClick={() => selected && actions.remove(selected.id)}><DeleteOutline fontSize="small" /></IconButton></span></Tooltip>
    </Stack>
    <List dense disablePadding sx={{ display: 'grid', gap: .25, maxHeight: 420, overflowY: 'auto' }}>
      {rows.map(({ layer }) => {
        const isSelected = layer.id === selectedId;
        return <ListItemButton key={layer.id} selected={isSelected} onClick={() => actions.select(layer.id)} onDoubleClick={() => setRenaming(layer.id)}
          sx={{ borderRadius: '10px', pr: .5, opacity: layer.visible ? 1 : .55, '&.Mui-selected, &.Mui-selected:hover': { bgcolor: '#EEF3FF' } }} aria-label={`${layer.name || layerKindLabel(layer)}, ${layerKindLabel(layer)}`}>
          <ListItemIcon sx={{ minWidth: 30, color: isSelected ? 'primary.main' : 'text.secondary' }}><KindIcon layer={layer} /></ListItemIcon>
          {renaming === layer.id
            ? <NameEditor layer={layer} onDone={name => { setRenaming(null); if (name !== null && name !== layer.name) actions.change(layer.id, { name }); }} />
            : <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={isSelected ? 650 : 500} noWrap>{layer.name || layerKindLabel(layer)}</Typography>
              <Stack direction="row" spacing={.5} alignItems="center">
                {layer.type === 'text' && layer.bind && <LinkIcon sx={{ fontSize: 13, color: 'primary.main' }} aria-hidden />}
                <Typography variant="caption" color="text.secondary" noWrap>{layerKindLabel(layer)}</Typography>
              </Stack>
            </Box>}
          <Tooltip title={layer.visible ? 'Ocultar' : 'Mostrar'}><IconButton size="small" aria-label={layer.visible ? `Ocultar ${layer.name}` : `Mostrar ${layer.name}`} onClick={event => { event.stopPropagation(); actions.change(layer.id, { visible: !layer.visible }); }}>{layer.visible ? <Visibility fontSize="small" /> : <VisibilityOff fontSize="small" />}</IconButton></Tooltip>
          <Tooltip title={layer.locked ? 'Desbloquear' : 'Bloquear'}><IconButton size="small" aria-label={layer.locked ? `Desbloquear ${layer.name}` : `Bloquear ${layer.name}`} onClick={event => { event.stopPropagation(); actions.change(layer.id, { locked: !layer.locked }); }} color={layer.locked ? 'warning' : 'default'}>{layer.locked ? <Lock fontSize="small" /> : <LockOpen fontSize="small" />}</IconButton></Tooltip>
        </ListItemButton>;
      })}
    </List>
    {!scene.layers.length && <Chip label="Sin capas" />}
  </Panel>;
}

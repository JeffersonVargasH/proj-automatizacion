'use client';

// Panel de propiedades de la capa elegida. No guarda datos propios: cada cambio se envía al reductor del
// editor (en vivo con `transient` y confirmado con `settle`), que es la única fuente del documento.
import { FormatAlignCenter, FormatAlignLeft, FormatAlignRight, FormatBold, FormatItalic, Link as LinkIcon, Lock, VerticalAlignBottom, VerticalAlignCenter, VerticalAlignTop } from '@mui/icons-material';
import { Alert, Box, Chip, Divider, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import { Panel } from '@/components/studio/Fields';
import { fieldLabels, fieldLimits, type CommercialValues } from '@/lib/editor/bindings';
import { editorFonts, fontLabel } from '@/lib/editor/fonts';
import { MAX_TEXT_LENGTH, type Layer, type Paint, type Scene, type TextLayer } from '@/lib/editor/scene';
import { NumberField, PaintField, RangeField } from './controls';
import { layerKindLabel } from './LayersPanel';

export type LayerActions = {
  change: (id: string, patch: Partial<Layer>, transient?: boolean) => void;
  setText: (id: string, text: string, transient?: boolean) => void;
  settle: () => void;
};

function TextSection({ layer, scene, values, actions, disabled }: { layer: TextLayer; scene: Scene; values: CommercialValues; actions: LayerActions; disabled: boolean }) {
  const bound = layer.bind?.field;
  const content = bound ? values[bound] ?? '' : layer.text;
  const change = (patch: Partial<TextLayer>, transient?: boolean) => actions.change(layer.id, patch, transient);
  const styles = [layer.fontWeight === 700 ? 'bold' : '', layer.italic ? 'italic' : ''].filter(Boolean);
  const fonts = editorFonts.some(font => font.family === layer.fontFamily) ? editorFonts : [...editorFonts, { label: fontLabel(layer.fontFamily), family: layer.fontFamily }];
  return <Stack spacing={2}>
    {bound && <Alert icon={<LinkIcon fontSize="small" />} severity="info" sx={{ py: 0 }}>
      <strong>{fieldLabels[bound]}</strong> es un dato de la publicación: al cambiarlo aquí se actualiza en Instagram, Facebook y WhatsApp.
    </Alert>}
    <TextField label={bound ? fieldLabels[bound] : 'Texto'} multiline minRows={2} maxRows={6} value={content} disabled={disabled}
      slotProps={{ htmlInput: { maxLength: bound ? fieldLimits[bound] : MAX_TEXT_LENGTH } }}
      helperText={bound ? `${content.length}/${fieldLimits[bound]}` : undefined}
      onChange={event => actions.setText(layer.id, event.target.value, true)} onBlur={actions.settle} />
    <TextField select size="small" label="Tipografía" value={layer.fontFamily} disabled={disabled} onChange={event => change({ fontFamily: event.target.value })}>
      {fonts.map(font => <MenuItem key={font.family} value={font.family} sx={{ fontFamily: font.family }}>{font.label}</MenuItem>)}
    </TextField>
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 96px', gap: 1.5, alignItems: 'end' }}>
      <RangeField label="Tamaño" value={layer.fontSize} min={8} max={200} disabled={disabled} format={value => `${Math.round(value)} px`} onChange={fontSize => change({ fontSize }, true)} onSettle={actions.settle} />
      <NumberField label="px" value={layer.fontSize} min={8} max={600} disabled={disabled} onCommit={fontSize => change({ fontSize })} />
    </Box>
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      <ToggleButtonGroup size="small" value={styles} disabled={disabled} aria-label="Estilo" onChange={(_, next: string[]) => change({ fontWeight: next.includes('bold') ? 700 : 400, italic: next.includes('italic') })}>
        <ToggleButton value="bold" aria-label="Negrita"><FormatBold fontSize="small" /></ToggleButton>
        <ToggleButton value="italic" aria-label="Cursiva"><FormatItalic fontSize="small" /></ToggleButton>
      </ToggleButtonGroup>
      <ToggleButtonGroup size="small" exclusive value={layer.align} disabled={disabled} aria-label="Alineación horizontal" onChange={(_, align: TextLayer['align'] | null) => align && change({ align })}>
        <ToggleButton value="left" aria-label="Alinear a la izquierda"><FormatAlignLeft fontSize="small" /></ToggleButton>
        <ToggleButton value="center" aria-label="Centrar"><FormatAlignCenter fontSize="small" /></ToggleButton>
        <ToggleButton value="right" aria-label="Alinear a la derecha"><FormatAlignRight fontSize="small" /></ToggleButton>
      </ToggleButtonGroup>
      <ToggleButtonGroup size="small" exclusive value={layer.verticalAlign} disabled={disabled} aria-label="Alineación vertical" onChange={(_, verticalAlign: TextLayer['verticalAlign'] | null) => verticalAlign && change({ verticalAlign })}>
        <ToggleButton value="top" aria-label="Arriba"><VerticalAlignTop fontSize="small" /></ToggleButton>
        <ToggleButton value="middle" aria-label="Al centro"><VerticalAlignCenter fontSize="small" /></ToggleButton>
        <ToggleButton value="bottom" aria-label="Abajo"><VerticalAlignBottom fontSize="small" /></ToggleButton>
      </ToggleButtonGroup>
    </Stack>
    <PaintField label="Color del texto" value={layer.fill} palette={scene.palette} disabled={disabled} onChange={(fill, transient) => fill && change({ fill }, transient)} onSettle={actions.settle} />
  </Stack>;
}

export function PropertiesPanel({ layer, scene, values, actions }: { layer: Layer | null; scene: Scene; values: CommercialValues; actions: LayerActions }) {
  if (!layer) return <Panel title="Propiedades"><Typography variant="body2" color="text.secondary">Toca un elemento del diseño o de la lista de capas para cambiar su texto, color o tamaño. Doble clic sobre un texto para escribir directamente.</Typography></Panel>;
  const disabled = layer.locked;
  const change = (patch: Partial<Layer>, transient?: boolean) => actions.change(layer.id, patch, transient);
  return <Panel title="Propiedades">
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
        <Typography fontWeight={650} noWrap sx={{ minWidth: 0 }}>{layer.name || layerKindLabel(layer)}</Typography>
        <Chip size="small" label={layerKindLabel(layer)} variant="outlined" />
        {!layer.visible && <Chip size="small" label="Oculta" />}
      </Stack>
      {disabled && <Alert severity="warning" icon={<Lock fontSize="small" />} sx={{ py: 0 }}>Capa bloqueada. Desbloquéala en la lista de capas para editarla.</Alert>}

      {layer.type === 'text' && <TextSection layer={layer} scene={scene} values={values} actions={actions} disabled={disabled} />}

      {layer.type === 'shape' && <Stack spacing={2}>
        <PaintField label={layer.kind === 'line' ? 'Color de la línea' : 'Relleno'} value={layer.kind === 'line' ? layer.stroke ?? layer.fill : layer.fill} palette={scene.palette} disabled={disabled} allowNone={layer.kind !== 'line'}
          onChange={(paint: Paint | null, transient) => change(layer.kind === 'line' ? { stroke: paint ?? { token: 'ink' } } : { fill: paint }, transient)} onSettle={actions.settle} />
        {layer.kind === 'line'
          ? <RangeField label="Grosor" value={layer.strokeWidth} min={1} max={60} disabled={disabled} format={value => `${value} px`} onChange={strokeWidth => change({ strokeWidth }, true)} onSettle={actions.settle} />
          : <PaintField label="Borde" value={layer.stroke} palette={scene.palette} disabled={disabled} allowNone onChange={(stroke, transient) => change({ stroke, strokeWidth: stroke ? Math.max(layer.strokeWidth, 6) : 0 }, transient)} onSettle={actions.settle} />}
        {layer.kind === 'rect' && <RangeField label="Esquinas redondeadas" value={layer.cornerRadius} min={0} max={Math.round(Math.min(layer.width, layer.height) / 2)} disabled={disabled} format={value => `${value} px`} onChange={cornerRadius => change({ cornerRadius }, true)} onSettle={actions.settle} />}
      </Stack>}

      {layer.type === 'image' && <Stack spacing={2}>
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: .75 }}>¿Cómo se ve la imagen?</Typography>
          <ToggleButtonGroup size="small" exclusive value={layer.fit} disabled={disabled} onChange={(_, fit: 'contain' | 'cover' | null) => fit && change({ fit })}>
            <ToggleButton value="contain" sx={{ textTransform: 'none' }}>Completa</ToggleButton>
            <Tooltip title={layer.role === 'product' ? 'Recorta los bordes de la foto del producto' : ''}><ToggleButton value="cover" sx={{ textTransform: 'none' }}>Llenar el espacio</ToggleButton></Tooltip>
          </ToggleButtonGroup>
        </Box>
        <RangeField label="Esquinas redondeadas" value={layer.cornerRadius} min={0} max={Math.round(Math.min(layer.width, layer.height) / 2)} disabled={disabled} format={value => `${value} px`} onChange={cornerRadius => change({ cornerRadius }, true)} onSettle={actions.settle} />
      </Stack>}

      <Divider />
      <RangeField label="Opacidad" value={Math.round(layer.opacity * 100)} min={0} max={100} disabled={disabled} format={value => `${value} %`} onChange={value => change({ opacity: value / 100 }, true)} onSettle={actions.settle} />
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 1.25 }}>
        <NumberField label="X" value={layer.x} disabled={disabled} onCommit={x => change({ x })} />
        <NumberField label="Y" value={layer.y} disabled={disabled} onCommit={y => change({ y })} />
        <NumberField label="Ancho" value={layer.width} min={1} max={scene.width * 4} disabled={disabled} onCommit={width => change({ width })} />
        <NumberField label="Alto" value={layer.height} min={1} max={scene.height * 4} disabled={disabled} onCommit={height => change({ height })} />
        <NumberField label="Giro" value={layer.rotation} min={-360} max={360} disabled={disabled} suffix="°" onCommit={rotation => change({ rotation })} />
      </Box>
    </Stack>
  </Panel>;
}

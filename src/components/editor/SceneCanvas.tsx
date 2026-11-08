'use client';

// Lienzo interactivo del editor. Dibuja una escena del modelo JSON con react-konva y avisa de los cambios
// terminados (soltar un arrastre o una transformación) con `onCommit`. No guarda estado propio de la escena:
// Konva solo dibuja lo que recibe. Se carga con next/dynamic y `ssr: false` (ver DesignEditor).
//
// Edición directa de textos (patrón recomendado por Konva): con doble clic o doble toque se oculta el texto
// del lienzo y se coloca encima un <textarea> HTML con la misma posición, giro, ancho y estilo. Al confirmar
// (clic fuera o Ctrl/Cmd+Enter) se envía el texto completo con `onEditText`; Escape cancela.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Konva from 'konva';
import { Ellipse, Group, Image as KonvaImage, Layer as KonvaLayer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import { fieldLimits, type CommercialValues } from '@/lib/editor/bindings';
import { canvasFont, loadImage } from '@/lib/editor/canvas-assets';
import { anchorKind, backgroundAttrs, boxFromTransform, groupAttrs, hitAttrs, imageAttrs, imageSourcesOf, resizeTextBox, shapeAttrs, textAttrs } from '@/lib/editor/draw-attrs';
import { measureTextHeight } from '@/lib/editor/konva-measure';
import { MAX_TEXT_LENGTH, resolvePaint, type ImageLayer, type Layer, type Scene, type TextLayer } from '@/lib/editor/scene';

export type SceneCanvasProps = {
  scene: Scene;
  values: CommercialValues;
  /** Píxeles de pantalla por píxel del lienzo. */
  scale: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCommit: (id: string, patch: Partial<Layer>) => void;
  /** Texto confirmado desde la edición directa (un solo paso del historial). */
  onEditText: (id: string, text: string) => void;
  /** Avisa qué imágenes no se pudieron cargar (la exportación también fallaría). */
  onImageErrors?: (sources: string[]) => void;
};

type Loaded = Map<string, HTMLImageElement | 'error'>;

function useSceneImages(scene: Scene, onErrors?: (sources: string[]) => void): Loaded {
  const sources = useMemo(() => imageSourcesOf({ ...scene, layers: scene.layers.map(layer => ({ ...layer, visible: true })) }), [scene]);
  const key = sources.join('\n');
  const [loaded, setLoaded] = useState<Loaded>(new Map());
  const report = useRef(onErrors);
  useEffect(() => { report.current = onErrors; }, [onErrors]);
  useEffect(() => {
    let live = true;
    const list = key ? key.split('\n') : [];
    type Entry = [string, HTMLImageElement | 'error'];
    void Promise.all(list.map(src => loadImage(src).then((img): Entry => [src, img], (): Entry => [src, 'error']))).then(entries => {
      if (!live) return;
      setLoaded(new Map(entries));
      report.current?.(entries.filter(([, value]) => value === 'error').map(([src]) => src));
    });
    return () => { live = false; };
  }, [key]);
  return loaded;
}

function ImageContent({ layer, image }: { layer: ImageLayer; image: HTMLImageElement | 'error' | undefined }) {
  if (!image || image === 'error') {
    // Marcador solo de pantalla mientras carga (o si falló). La exportación espera las imágenes o falla.
    return <Rect width={layer.width} height={layer.height} fill={image === 'error' ? '#fdecea' : '#eef1f6'} stroke={image === 'error' ? '#d32f2f' : '#c5cbd6'} strokeWidth={2} dash={[12, 8]} strokeScaleEnabled={false} listening={false} />;
  }
  return <KonvaImage image={image} {...imageAttrs(layer, { width: image.naturalWidth, height: image.naturalHeight })} />;
}

function LayerContent({ layer, scene, values, images, editing }: { layer: Layer; scene: Scene; values: CommercialValues; images: Loaded; editing: boolean }) {
  // Mientras se edita, el texto del lienzo se oculta y se ve el textarea en su lugar.
  if (layer.type === 'text') return <Text {...textAttrs(layer, scene.palette, values, canvasFont)} visible={!editing} />;
  if (layer.type === 'image') return <ImageContent layer={layer} image={images.get(layer.src)} />;
  const draw = shapeAttrs(layer, scene.palette);
  if (draw.kind === 'ellipse') return <Ellipse {...draw.attrs} />;
  if (draw.kind === 'line') return <Line {...draw.attrs} />;
  return <Rect {...draw.attrs} />;
}

const cornerAnchors = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
// Texto: esquinas para escalar la letra y laterales para el ancho (sin controles arriba/abajo, que lo deformarían).
const textAnchors = [...cornerAnchors, 'middle-left', 'middle-right'];

/** Texto que se edita: el valor del campo comercial (sin prefijo ni sufijo) o el texto libre de la capa. */
const editableText = (layer: TextLayer, values: CommercialValues) => layer.bind ? values[layer.bind.field] ?? '' : layer.text;

function TextEditor({ layer, scene, scale, initial, onDone }: { layer: TextLayer; scene: Scene; scale: number; initial: string; onDone: (text: string | null) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(initial);
  const finished = useRef(false);
  const finish = (text: string | null) => { if (finished.current) return; finished.current = true; onDone(text); };
  const fit = () => { const el = ref.current; if (!el) return; el.style.height = 'auto'; el.style.height = `${Math.max(el.scrollHeight, layer.height * scale)}px`; };
  useEffect(() => { const el = ref.current; if (!el) return; el.focus(); el.select(); fit(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const weight = layer.fontWeight === 700 ? 700 : 400;
  const style: CSSProperties = {
    position: 'absolute', left: layer.x * scale, top: layer.y * scale, width: layer.width * scale, minHeight: layer.height * scale,
    transform: `rotate(${layer.rotation}deg)`, transformOrigin: 'top left',
    margin: 0, padding: 0, border: 0, outline: '2px dashed #2F5BFF', outlineOffset: 2, borderRadius: 2,
    background: 'rgba(255,255,255,.18)', resize: 'none', overflow: 'hidden', zIndex: 2,
    font: `${layer.italic ? 'italic ' : ''}${weight} ${layer.fontSize * scale}px ${canvasFont(layer.fontFamily)}`,
    lineHeight: layer.lineHeight, color: resolvePaint(layer.fill, scene.palette) ?? '#000', textAlign: layer.align,
    whiteSpace: 'pre-wrap', overflowWrap: 'break-word', boxSizing: 'content-box',
  };
  return <textarea ref={ref} value={value} aria-label={layer.bind ? `Editar ${layer.name || 'texto'} (dato del diseño)` : `Editar ${layer.name || 'texto'}`}
    maxLength={layer.bind ? fieldLimits[layer.bind.field] : MAX_TEXT_LENGTH} spellCheck style={style}
    onChange={event => { setValue(event.target.value); fit(); }}
    onBlur={() => finish(value)}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); finish(null); }
      else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); finish(value); }
    }} />;
}

export default function SceneCanvas({ scene, values, scale, selectedId, onSelect, onCommit, onEditText, onImageErrors }: SceneCanvasProps) {
  const images = useSceneImages(scene, onImageErrors);
  const transformer = useRef<Konva.Transformer>(null);
  const stage = useRef<Konva.Stage>(null);
  const [coarse, setCoarse] = useState(false);
  const selected = scene.layers.find(layer => layer.id === selectedId && layer.visible) ?? null;
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingLayer = scene.layers.find((layer): layer is TextLayer => layer.id === editingId && layer.type === 'text' && layer.visible && !layer.locked) ?? null;
  const startEditing = (layer: Layer) => { if (layer.type !== 'text' || layer.locked) return; onSelect(layer.id); setEditingId(layer.id); };

  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)');
    const sync = () => setCoarse(query.matches);
    sync(); query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  // El marco de transformación sigue a la capa elegida.
  useEffect(() => {
    const tr = transformer.current;
    if (!tr) return;
    const node = selected && !editingLayer ? stage.current?.findOne<Konva.Group>(`#${selected.id}`) : undefined;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selected, scene, editingLayer]);

  // Al desmontar, Konva libera sus lienzos; aquí se sueltan además las referencias del marco.
  useEffect(() => () => { transformer.current?.nodes([]); }, []);

  const select = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>, id: string | null) => { event.cancelBubble = true; onSelect(id); };
  const commitTransform = (layer: Layer, node: Konva.Node) => {
    if (layer.type === 'text') {
      // El texto ya se ajustó en vivo (ver liveTextResize): se guarda su tamaño de letra y de caja.
      const text = (node as Konva.Group).findOne<Konva.Text>('Text');
      node.scaleX(1); node.scaleY(1);
      // El alto se redondea hacia arriba: medio píxel menos bastaría para que Konva corte la última línea con «…».
      onCommit(layer.id, { x: node.x(), y: node.y(), rotation: node.rotation(), width: Math.round(text?.width() ?? layer.width), height: Math.ceil(text?.height() ?? layer.height), fontSize: text?.fontSize() ?? layer.fontSize });
      return;
    }
    const patch = boxFromTransform(layer, { x: node.x(), y: node.y(), rotation: node.rotation(), scaleX: node.scaleX(), scaleY: node.scaleY() });
    // El tamaño pasa a la caja de la capa: el grupo vuelve a escala 1 para no deformar bordes.
    node.scaleX(1); node.scaleY(1);
    onCommit(layer.id, patch);
  };

  /**
   * Konva transforma escalando el grupo. Para un texto, en cada paso esa escala se convierte en tamaño
   * de letra (esquinas) o en ancho (laterales) y el grupo vuelve a escala 1: la letra nunca se deforma
   * y no se acumulan escalas entre ediciones.
   */
  const liveTextResize = (node: Konva.Group) => {
    const text = node.findOne<Konva.Text>('Text');
    const hit = node.findOne<Konva.Rect>('.hit');
    if (!text || !hit) return;
    const kind = anchorKind(transformer.current?.getActiveAnchor());
    const layer = scene.layers.find(item => item.id === node.id());
    if (!layer || layer.type !== 'text') return;
    const measure = (width: number, fontSize: number) => measureTextHeight({ ...layer, width, fontSize }, text.text());
    const next = resizeTextBox({ width: text.width(), height: text.height(), fontSize: text.fontSize() }, { scaleX: node.scaleX(), scaleY: node.scaleY() }, kind, measure);
    text.setAttrs(next);
    hit.setAttrs({ width: next.width, height: next.height });
    node.scale({ x: 1, y: 1 });
  };

  const locked = !!selected?.locked;
  const anchor = coarse ? 22 : 11;

  return <div style={{ position: 'relative', lineHeight: 0 }}><Stage ref={stage} width={Math.round(scene.width * scale)} height={Math.round(scene.height * scale)} scaleX={scale} scaleY={scale} style={{ touchAction: 'none' }} aria-label="Lienzo del diseño">
    <KonvaLayer>
      <Rect {...backgroundAttrs(scene)} onMouseDown={event => select(event, null)} onTouchStart={event => select(event, null)} />
      {scene.layers.map(layer => layer.visible && (
        <Group key={layer.id} {...groupAttrs(layer)} draggable={!layer.locked && layer.id !== editingLayer?.id}
          onDblClick={layer.type === 'text' ? () => startEditing(layer) : undefined} onDblTap={layer.type === 'text' ? () => startEditing(layer) : undefined}
          onMouseDown={event => select(event, layer.id)} onTouchStart={event => select(event, layer.id)}
          onDragStart={() => onSelect(layer.id)}
          onDragEnd={event => onCommit(layer.id, { x: Math.round(event.target.x()), y: Math.round(event.target.y()) })}
          onTransform={layer.type === 'text' ? event => liveTextResize(event.currentTarget as unknown as Konva.Group) : undefined}
          onTransformEnd={event => commitTransform(layer, event.target)}>
          <Rect {...hitAttrs(layer)} />
          <LayerContent layer={layer} scene={scene} values={values} images={images} editing={layer.id === editingLayer?.id} />
        </Group>
      ))}
      <Transformer ref={transformer}
        rotateEnabled={!locked} resizeEnabled={!locked}
        keepRatio={selected?.type === 'image' || selected?.type === 'text'}
        enabledAnchors={selected?.type === 'image' ? cornerAnchors : selected?.type === 'text' ? textAnchors : undefined}
        anchorSize={anchor} rotateAnchorOffset={coarse ? 34 : 26} padding={2}
        borderStroke={locked ? '#9aa3b2' : '#2F5BFF'} borderDash={locked ? [6, 4] : undefined}
        anchorStroke="#2F5BFF" anchorFill="#ffffff" anchorCornerRadius={anchor / 2}
        rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]} rotationSnapTolerance={4}
        ignoreStroke flipEnabled={false}
        boundBoxFunc={(previous, next) => (Math.abs(next.width) < 8 || Math.abs(next.height) < 8 ? previous : next)} />
    </KonvaLayer>
  </Stage>
  {editingLayer && <TextEditor key={editingLayer.id} layer={editingLayer} scene={scene} scale={scale} initial={editableText(editingLayer, values)}
    onDone={text => { setEditingId(null); if (text !== null) onEditText(editingLayer.id, text); }} />}
  </div>;
}

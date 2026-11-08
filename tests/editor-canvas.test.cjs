// Fase 2: atributos de dibujo compartidos por el lienzo y la exportación, y estado del editor.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { loadTs } = require('./load-ts.cjs');

const plain = value => JSON.parse(JSON.stringify(value));
const cache = new Map();
const d = loadTs('src/lib/editor/draw-attrs.ts', { cache });
const s = loadTs('src/lib/editor/editor-state.ts', { cache });
const { paletteFrom, emptyScene, normalizeScene } = loadTs('src/lib/editor/scene.ts', { cache });
const { imageLayer, textLayer, shapeLayer, addLayer } = loadTs('src/lib/editor/operations.ts', { cache });
const { createSceneFromTemplate } = loadTs('src/lib/editor/layouts.ts', { cache });
const { commercialValuesOf } = loadTs('src/lib/editor/bindings.ts', { cache });

const png = 'data:image/png;base64,iVBORw0KGgo=';
const palette = paletteFrom({ primary: '#1A2C77', secondary: '#FFF4E8' });
const values = commercialValuesOf({ title: 'Taza', body: 'Hecha a mano', price: 'S/ 35', cta: 'Escríbenos', contact: '999' });
const box = { x: 10, y: 20, width: 400, height: 200 };

test('text attributes read bound values and resolve palette colors and fonts', () => {
  const layer = textLayer(box, { bind: { field: 'price', prefix: 'Precio: ', suffix: '' }, fontWeight: 700, italic: true, fill: { token: 'onPrimary' }, fontFamily: 'Geist, Arial, sans-serif' });
  const attrs = d.textAttrs(layer, palette, values, family => family.replace('Geist', '__Geist_x'));
  assert.equal(attrs.text, 'Precio: S/ 35');
  assert.equal(attrs.fill, '#ffffff');
  assert.equal(attrs.fontStyle, 'italic bold');
  assert.equal(attrs.fontFamily, '__Geist_x, Arial, sans-serif');
  assert.equal(attrs.width, 400);
  assert.equal(attrs.x, 0, 'content is relative to the layer group');
  assert.equal(attrs.ellipsis, true);
  assert.equal(attrs.verticalAlign, 'top');
  assert.equal(normalizeScene({ ...emptyScene('instagram', palette), layers: [{ type: 'text', verticalAlign: 'sideways' }] }).scene.layers[0].verticalAlign, 'top', 'older scenes default to top');
  assert.equal(d.textAttrs(textLayer(box, { text: 'Libre' }), palette, values).fontStyle, 'normal');
});

test('contain keeps the whole product photo; cover fills the box with a centered crop', () => {
  const contain = d.imageAttrs(imageLayer({ ...box, width: 400, height: 200 }, 'product', png), { width: 1000, height: 1000 });
  assert.deepEqual(plain(contain), { x: 100, y: 0, width: 200, height: 200, cornerRadius: 0, listening: false });
  const cover = d.imageAttrs(imageLayer({ ...box, width: 400, height: 200 }, 'ai-complete', png, { cornerRadius: 30 }), { width: 1000, height: 1000 });
  assert.equal(cover.width, 400);
  assert.deepEqual(plain(cover.crop), { x: 0, y: 250, width: 1000, height: 500 });
  assert.equal(cover.cornerRadius, 30);
});

test('shape attributes for rect, badge, ellipse and line', () => {
  const rect = d.shapeAttrs(shapeLayer(box, 'rect', { cornerRadius: 999 }), palette);
  assert.equal(rect.kind, 'rect');
  assert.equal(rect.attrs.cornerRadius, 100, 'radius is limited to half the side');
  assert.equal(rect.attrs.fill, '#1a2c77');
  const badge = d.shapeAttrs(shapeLayer(box, 'badge'), palette);
  assert.equal(badge.attrs.cornerRadius, 100);
  const ellipse = d.shapeAttrs(shapeLayer(box, 'ellipse', { fill: '#ff0000' }), palette);
  assert.deepEqual(plain(ellipse.attrs).radiusX, 200);
  assert.equal(ellipse.attrs.fill, '#ff0000');
  const line = d.shapeAttrs(shapeLayer({ ...box, height: 6 }, 'line', { fill: null, stroke: { token: 'ink' }, strokeWidth: 4 }), palette);
  assert.deepEqual(plain(line.attrs.points), [0, 3, 400, 3]);
  assert.equal(line.attrs.strokeWidth, 4);
});

test('group attributes keep position, rotation, opacity and visibility', () => {
  const layer = { ...shapeLayer(box, 'rect'), rotation: 30, opacity: 0.5, visible: false };
  assert.deepEqual(plain(d.groupAttrs(layer)), { id: layer.id, name: 'layer', x: 10, y: 20, rotation: 30, opacity: 0.5, visible: false });
  assert.deepEqual(plain(d.hitAttrs(layer)), { x: 0, y: 0, width: 400, height: 200, fill: 'rgba(0,0,0,0)', strokeEnabled: false, name: 'hit' });
});

test('a transformation becomes a new box size, not a stretched layer', () => {
  const layer = textLayer(box, { text: 'Hola' });
  assert.deepEqual(plain(d.boxFromTransform(layer, { x: 50, y: 60, rotation: 15, scaleX: 1.5, scaleY: 0.5 })), { x: 50, y: 60, rotation: 15, width: 600, height: 100 });
  assert.equal(d.boxFromTransform(layer, { x: 0, y: 0, rotation: 0, scaleX: 0, scaleY: -2 }).width, 1);
});

test('only visible images and fonts are preloaded for export', () => {
  let scene = emptyScene('instagram', palette);
  scene = addLayer(scene, imageLayer(box, 'product', png));
  scene = addLayer(scene, { ...imageLayer(box, 'photo', 'clic-media://u/b/hidden.png'), visible: false });
  scene = addLayer(scene, textLayer(box, { text: 'A', fontWeight: 700, fontSize: 40.4 }));
  assert.deepEqual(plain(d.imageSourcesOf(scene)), [png]);
  assert.deepEqual(plain(d.fontsOf(scene)), ['700 40px Geist, Arial, sans-serif']);
});

// ───────── Estado del editor ─────────

const template = format => createSceneFromTemplate(format, { palette, brandName: 'Luna', values, product: png, logo: png });
const doc = () => ({ scenes: { instagram: template('instagram'), facebook: template('facebook'), whatsapp: template('whatsapp') }, values });

test('editor starts on the requested format and discards invalid scenes', () => {
  const state = s.createEditorState({ scenes: { instagram: template('facebook'), facebook: template('facebook'), whatsapp: { version: 9 } }, values }, 'whatsapp');
  assert.equal(state.format, 'facebook');
  assert.deepEqual(Object.keys(state.history.present.scenes), ['facebook']);
  assert.equal(s.currentScene(s.createEditorState({ scenes: {}, values })), null);
});

test('select, commit, undo and redo follow the scene model', () => {
  let state = s.createEditorState(doc(), 'instagram');
  const title = s.currentScene(state).layers.find(layer => layer.bind?.field === 'title');
  state = s.editorReducer(state, { type: 'select', id: title.id });
  assert.equal(state.selectedId, title.id);
  assert.equal(s.editorReducer(state, { type: 'select', id: 'missing' }), state);
  state = s.editorReducer(state, { type: 'commitLayer', id: title.id, patch: { x: 300, y: 400 } });
  state = s.editorReducer(state, { type: 'commitLayer', id: title.id, patch: { width: 500, rotation: -20 } });
  const moved = s.currentScene(state).layers.find(layer => layer.id === title.id);
  assert.deepEqual([moved.x, moved.y, moved.width, moved.rotation], [300, 400, 500, 340]);
  assert.equal(moved.text, '', 'the title stays bound to the design field');
  assert.equal(s.editorCanUndo(state), true);
  state = s.editorReducer(s.editorReducer(state, { type: 'undo' }), { type: 'undo' });
  assert.equal(s.currentScene(state).layers.find(layer => layer.id === title.id).x, title.x);
  assert.equal(s.editorCanRedo(state), true);
  state = s.editorReducer(state, { type: 'redo' });
  assert.equal(s.currentScene(state).layers.find(layer => layer.id === title.id).x, 300);
  assert.equal(s.editorReducer(state, { type: 'commitLayer', id: title.id, patch: { x: 300 } }), state, 'no-op commits are not steps');
});

test('locked layers cannot be moved; hidden layers can still be chosen from the layers panel', () => {
  let state = s.createEditorState(doc(), 'instagram');
  const scene = s.currentScene(state);
  const logo = scene.layers.find(layer => layer.role === 'logo');
  state = s.createEditorState({ ...doc(), scenes: { ...doc().scenes, instagram: { ...scene, layers: scene.layers.map(layer => layer.id === logo.id ? { ...layer, locked: true } : layer.name === 'Mensaje' ? { ...layer, visible: false } : layer) } } }, 'instagram');
  assert.equal(s.editorReducer(state, { type: 'commitLayer', id: logo.id, patch: { x: 0 } }), state);
  const hidden = s.currentScene(state).layers.find(layer => layer.name === 'Mensaje');
  assert.equal(s.editorReducer(state, { type: 'select', id: hidden.id }).selectedId, hidden.id);
});

test('switching format keeps each scene and clears the selection; history spans formats', () => {
  let state = s.createEditorState(doc(), 'instagram');
  const layer = s.currentScene(state).layers[0];
  state = s.editorReducer(state, { type: 'select', id: layer.id });
  state = s.editorReducer(state, { type: 'commitLayer', id: layer.id, patch: { x: 5 } });
  state = s.editorReducer(state, { type: 'format', format: 'whatsapp' });
  assert.equal(state.selectedId, null);
  assert.equal(s.currentScene(state).format, 'whatsapp');
  assert.equal(state.history.present.scenes.instagram.layers[0].x, 5);
  assert.equal(s.editorReducer(state, { type: 'format', format: 'whatsapp' }), state);
  for (const format of ['instagram', 'facebook', 'whatsapp']) assert.deepEqual(plain(normalizeScene(plain(state.history.present.scenes[format])).issues), [], format);
});

test('the dev editor page is blocked outside development', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/app/dev/editor/page.tsx'), 'utf8');
  assert.match(source, /process\.env\.NODE_ENV !== 'development'\) notFound\(\)/);
});

// ───────── Fase 2.1: redimensionar textos ─────────

test('anchors: corners scale the font, sides change the width', () => {
  assert.equal(d.anchorKind('top-left'), 'corner');
  assert.equal(d.anchorKind('bottom-right'), 'corner');
  assert.equal(d.anchorKind('middle-left'), 'side');
  assert.equal(d.anchorKind('middle-right'), 'side');
  assert.equal(d.anchorKind('top-center'), 'other');
  assert.equal(d.anchorKind('rotater'), 'other');
  assert.equal(d.anchorKind(null), 'other');
});

test('corner resize scales font and box proportionally, without leftover scale', () => {
  const bigger = d.resizeTextBox({ width: 400, height: 100, fontSize: 40 }, { scaleX: 1.5, scaleY: 1.5 }, 'corner');
  assert.deepEqual(plain(bigger), { fontSize: 60, width: 600, height: 150 });
  const smaller = d.resizeTextBox(bigger, { scaleX: 0.5, scaleY: 0.5 }, 'corner');
  assert.deepEqual(plain(smaller), { fontSize: 30, width: 300, height: 75 });
  assert.ok(!('scaleX' in smaller), 'the result has no scale to accumulate');
});

test('many small live steps grow and shrink back without drift', () => {
  let box = { width: 500, height: 120, fontSize: 48 };
  for (let i = 0; i < 20; i++) box = d.resizeTextBox(box, { scaleX: 1.05, scaleY: 1.05 }, 'corner');
  for (let i = 0; i < 20; i++) box = d.resizeTextBox(box, { scaleX: 1 / 1.05, scaleY: 1 / 1.05 }, 'corner');
  assert.ok(Math.abs(box.fontSize - 48) <= 1, `font back near 48 (${box.fontSize})`);
  assert.ok(Math.abs(box.width / box.fontSize - 500 / 48) < 0.2, 'width stays proportional to the font');
});

test('font size respects minimum and maximum limits', () => {
  const tiny = d.resizeTextBox({ width: 400, height: 100, fontSize: 20 }, { scaleX: 0.01, scaleY: 0.01 }, 'corner');
  assert.equal(tiny.fontSize, d.textLimits.minFont);
  assert.equal(tiny.width, 160, 'the box shrinks only as much as the font could');
  const huge = d.resizeTextBox({ width: 400, height: 100, fontSize: 300 }, { scaleX: 10, scaleY: 10 }, 'corner');
  assert.equal(huge.fontSize, d.textLimits.maxFont);
  assert.equal(huge.width, 800, 'the box grows only as much as the font could');
});

test('side resize changes only the width and fits the height to the content', () => {
  const calls = [];
  const measure = (width, fontSize) => { calls.push([width, fontSize]); return width < 300 ? 2 * fontSize * 1.15 : fontSize * 1.15; };
  const narrow = d.resizeTextBox({ width: 600, height: 60, fontSize: 40 }, { scaleX: 0.4, scaleY: 1 }, 'side', measure);
  assert.equal(narrow.fontSize, 40);
  assert.equal(narrow.width, 240);
  assert.equal(narrow.height, 92, 'two lines after wrapping');
  assert.deepEqual(calls, [[240, 40]]);
  assert.equal(d.resizeTextBox({ width: 100, height: 60, fontSize: 40 }, { scaleX: 0.01, scaleY: 1 }, 'side').width, d.textLimits.minWidth);
  assert.equal(d.resizeTextBox({ width: 600, height: 60, fontSize: 40 }, { scaleX: 2, scaleY: 7 }, 'side').height, 60, 'without a measure the height is kept');
});

test('font size from a transform persists in the scene JSON, for free and bound texts, with undo/redo', () => {
  let state = s.createEditorState(doc(), 'instagram');
  const scene = s.currentScene(state);
  const title = scene.layers.find(layer => layer.bind?.field === 'title');
  const brand = scene.layers.find(layer => layer.name === 'Nombre del negocio');
  for (const layer of [title, brand]) {
    const next = d.resizeTextBox({ width: layer.width, height: layer.height, fontSize: layer.fontSize }, { scaleX: 1.25, scaleY: 1.25 }, 'corner');
    state = s.editorReducer(state, { type: 'commitLayer', id: layer.id, patch: { ...next, x: layer.x + 10 } });
  }
  const saved = normalizeScene(plain(s.currentScene(state))).scene;
  assert.equal(saved.layers.find(layer => layer.id === title.id).fontSize, title.fontSize * 1.25);
  assert.equal(saved.layers.find(layer => layer.id === brand.id).fontSize, brand.fontSize * 1.25);
  assert.equal(saved.layers.find(layer => layer.id === title.id).text, '', 'bound text still comes from the design');
  assert.equal(saved.layers.find(layer => layer.id === brand.id).text, 'Luna');
  assert.equal(state.history.past.length, 2, 'each full transformation is one step');
  state = s.editorReducer(state, { type: 'undo' });
  assert.equal(s.currentScene(state).layers.find(layer => layer.id === brand.id).fontSize, brand.fontSize);
  assert.equal(s.currentScene(state).layers.find(layer => layer.id === title.id).fontSize, title.fontSize * 1.25);
  state = s.editorReducer(state, { type: 'redo' });
  assert.equal(s.currentScene(state).layers.find(layer => layer.id === brand.id).fontSize, brand.fontSize * 1.25);
  const attrs = d.textAttrs(s.currentScene(state).layers.find(layer => layer.id === title.id), palette, values);
  assert.equal(attrs.fontSize, title.fontSize * 1.25, 'canvas and export read the same font size');
});

test('exported PNG files get a descriptive name', () => {
  const { exportFilename } = loadTs('src/lib/editor/export.ts', { cache });
  assert.equal(exportFilename('instagram', new Date(2026, 10, 7, 9, 5)), 'clic-instagram-2026-11-07-0905.png');
  assert.equal(exportFilename('whatsapp', new Date(2026, 0, 31, 23, 59)), 'clic-whatsapp-2026-01-31-2359.png');
});

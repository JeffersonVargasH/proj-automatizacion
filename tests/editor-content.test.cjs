// Fase 3A: edición de contenido, propiedades, panel de capas y elementos nuevos (reductor del editor).
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadTs } = require('./load-ts.cjs');

const plain = value => JSON.parse(JSON.stringify(value));
const cache = new Map();
const s = loadTs('src/lib/editor/editor-state.ts', { cache });
const { paletteFrom, normalizeScene } = loadTs('src/lib/editor/scene.ts', { cache });
const { createSceneFromTemplate } = loadTs('src/lib/editor/layouts.ts', { cache });
const { commercialValuesOf, resolveLayerText } = loadTs('src/lib/editor/bindings.ts', { cache });
const { textAttrs, imageSourcesOf } = loadTs('src/lib/editor/draw-attrs.ts', { cache });
const n = loadTs('src/lib/editor/new-layers.ts', { cache });
const { fontLabel, editorFonts } = loadTs('src/lib/editor/fonts.ts', { cache });

const png = 'data:image/png;base64,iVBORw0KGgo=';
const palette = paletteFrom({ primary: '#1A2C77', secondary: '#FFF4E8' });
const values = commercialValuesOf({ title: 'Taza artesanal', body: 'Hecha a mano', price: 'S/ 35', validity: 'Solo hoy', cta: 'Escríbenos', contact: '999' });
const template = format => createSceneFromTemplate(format, { palette, brandName: 'Luna', values, product: png, logo: png, footer: '@luna' });
const doc = () => ({ scenes: { instagram: template('instagram'), facebook: template('facebook'), whatsapp: template('whatsapp') }, values });
const start = (format = 'instagram') => s.createEditorState(doc(), format);
const find = (state, predicate, format = state.format) => state.history.present.scenes[format].layers.find(predicate);
const byField = field => layer => layer.bind?.field === field;
const byName = name => layer => layer.name === name;
const run = (state, ...actions) => actions.reduce((current, action) => s.editorReducer(current, action), state);

// ───────── Contenido de textos ─────────

test('editing a bound price updates Design once and every format shows it', () => {
  let state = start();
  const price = find(state, byField('price'));
  state = run(state, { type: 'setText', id: price.id, text: 'S/ 45' });
  assert.equal(state.history.present.values.price, 'S/ 45');
  for (const format of ['instagram', 'facebook', 'whatsapp']) {
    const layer = find(state, byField('price'), format);
    assert.equal(layer.text, '', `${format}: the value is not copied into the layer`);
    assert.equal(resolveLayerText(layer, state.history.present.values), 'S/ 45', format);
    assert.equal(textAttrs(layer, palette, state.history.present.values).text, 'S/ 45', `${format}: canvas and PNG draw the new price`);
  }
  // Posición y estilo siguen siendo propios de cada formato.
  assert.notEqual(find(state, byField('price'), 'instagram').x, find(state, byField('price'), 'whatsapp').x);
  assert.ok(!JSON.stringify(state.history.present.scenes).includes('S/ 45'));
  assert.equal(state.history.past.length, 1);
});

test('editing a free text changes only that layer and never the commercial fields', () => {
  let state = start();
  const brand = find(state, byName('Nombre del negocio'));
  state = run(state, { type: 'setText', id: brand.id, text: 'Luna Cerámica\nCusco' });
  assert.equal(find(state, byName('Nombre del negocio')).text, 'Luna Cerámica\nCusco', 'multi-line text');
  assert.equal(find(state, byName('Nombre del negocio'), 'facebook').text, 'Luna', 'other formats keep their own free text');
  assert.deepEqual(plain(state.history.present.values), plain(values));
});

test('typing many letters is one history step; undo restores the value in all formats', () => {
  let state = start();
  const title = find(state, byField('title'));
  for (const text of ['T', 'Ta', 'Taz', 'Taza', 'Taza nueva']) state = run(state, { type: 'setText', id: title.id, text, transient: true });
  assert.equal(state.history.present.values.title, 'Taza nueva', 'shown live');
  assert.equal(state.history.past.length, 0, 'no steps while typing');
  state = run(state, { type: 'settle' });
  assert.equal(state.history.past.length, 1, 'one step after leaving the field');
  state = run(state, { type: 'undo' });
  assert.equal(state.history.present.values.title, 'Taza artesanal');
  assert.equal(resolveLayerText(find(state, byField('title'), 'whatsapp'), state.history.present.values), 'Taza artesanal');
  state = run(state, { type: 'redo' });
  assert.equal(state.history.present.values.title, 'Taza nueva');
});

test('text boxes grow to fit new content (all formats for bound fields), never shrink', () => {
  let state = start();
  const body = find(state, byField('body'));
  const measure = (layer, text) => Math.ceil(text.length / 10) * layer.fontSize * layer.lineHeight;
  const long = 'Hecha a mano en Cusco con arcilla local, esmaltada y apta para microondas y lavavajillas.';
  state = run(state, { type: 'setText', id: body.id, text: long, measure });
  for (const format of ['instagram', 'facebook', 'whatsapp']) {
    const layer = find(state, byField('body'), format);
    const before = find(start(), byField('body'), format);
    assert.ok(layer.height >= Math.ceil(measure(layer, long)), `${format} fits`);
    assert.ok(layer.height >= before.height, `${format} never shrinks`);
  }
  assert.equal(state.history.past.length, 1, 'text and box growth are a single step');
  state = run(state, { type: 'undo' });
  assert.equal(find(state, byField('body')).height, body.height);
  const short = run(start(), { type: 'setText', id: body.id, text: 'Hola', measure });
  assert.equal(find(short, byField('body')).height, body.height, 'short text keeps the box');
});

test('commercial limits and locked layers are respected when editing text', () => {
  let state = start();
  const cta = find(state, byField('cta'));
  state = run(state, { type: 'setText', id: cta.id, text: 'x'.repeat(200) });
  assert.equal(state.history.present.values.cta.length, 40);
  state = run(state, { type: 'commitLayer', id: cta.id, patch: { locked: true } });
  const locked = run(state, { type: 'setText', id: cta.id, text: 'Otro' });
  assert.equal(locked, state);
});

// ───────── Propiedades ─────────

test('property changes from sliders are live and count as one step', () => {
  let state = start();
  const title = find(state, byField('title'));
  for (const fontSize of [70, 80, 90, 100]) state = run(state, { type: 'commitLayer', id: title.id, patch: { fontSize }, transient: true });
  assert.equal(find(state, byField('title')).fontSize, 100);
  assert.equal(state.history.past.length, 0);
  state = run(state, { type: 'settle' }, { type: 'commitLayer', id: title.id, patch: { fill: '#ff0000', fontFamily: 'Georgia, serif', fontWeight: 400, italic: true, align: 'right', opacity: 0.5 } });
  assert.equal(state.history.past.length, 2);
  const changed = find(state, byField('title'));
  const attrs = textAttrs(changed, palette, state.history.present.values);
  assert.deepEqual([attrs.fill, attrs.fontFamily, attrs.fontStyle, attrs.align, attrs.fontSize], ['#ff0000', 'Georgia, serif', 'italic', 'right', 100]);
  assert.equal(changed.opacity, 0.5);
  assert.deepEqual(plain(normalizeScene(plain(state.history.present.scenes.instagram)).issues), [], 'saved scene stays valid');
  state = run(state, { type: 'undo' }, { type: 'undo' });
  assert.equal(find(state, byField('title')).fontSize, title.fontSize);
});

test('cancel discards a live change; switching format settles it', () => {
  const state = start();
  const title = find(state, byField('title'));
  const previewed = run(state, { type: 'commitLayer', id: title.id, patch: { opacity: 0.2 }, transient: true });
  assert.equal(find(run(previewed, { type: 'cancel' }), byField('title')).opacity, 1);
  const switched = run(previewed, { type: 'format', format: 'facebook' });
  assert.equal(switched.history.past.length, 1);
  assert.equal(find(switched, byField('title'), 'instagram').opacity, 0.2);
});

// ───────── Panel de capas ─────────

test('rename, hide, lock, reorder, duplicate and delete are undoable steps', () => {
  let state = start();
  const logo = find(state, layer => layer.role === 'logo');
  const ids = st => st.history.present.scenes.instagram.layers.map(layer => layer.id);
  state = run(state, { type: 'select', id: logo.id }, { type: 'commitLayer', id: logo.id, patch: { name: 'Mi logo' } });
  assert.equal(find(state, layer => layer.id === logo.id).name, 'Mi logo');
  state = run(state, { type: 'commitLayer', id: logo.id, patch: { visible: false } });
  assert.equal(state.selectedId, logo.id, 'hiding keeps the selection so it can be shown again');
  state = run(state, { type: 'commitLayer', id: logo.id, patch: { visible: true } });
  const before = ids(state);
  state = run(state, { type: 'arrangeLayer', id: logo.id, where: 'back' });
  assert.equal(ids(state)[0], logo.id);
  state = run(state, { type: 'duplicateLayer', id: logo.id });
  assert.notEqual(state.selectedId, logo.id, 'the copy is selected');
  assert.equal(ids(state).length, before.length + 1);
  state = run(state, { type: 'removeLayer', id: state.selectedId });
  assert.equal(ids(state).length, before.length);
  assert.equal(state.selectedId, null);
  state = run(state, { type: 'commitLayer', id: logo.id, patch: { locked: true } });
  assert.equal(run(state, { type: 'removeLayer', id: logo.id }), state, 'locked layers cannot be deleted');
  assert.equal(state.history.past.length, 7);
  for (let i = 0; i < 7; i++) state = run(state, { type: 'undo' });
  assert.deepEqual(plain(ids(state)), plain(before));
  assert.equal(find(state, layer => layer.id === logo.id).name, 'Logo');
});

test('duplicating a bound text keeps showing the same commercial value', () => {
  let state = start();
  const price = find(state, byField('price'));
  state = run(state, { type: 'duplicateLayer', id: price.id });
  const copy = find(state, layer => layer.id === state.selectedId);
  assert.equal(copy.bind.field, 'price');
  state = run(state, { type: 'setText', id: copy.id, text: 'S/ 50' });
  assert.equal(resolveLayerText(find(state, layer => layer.id === price.id), state.history.present.values), 'S/ 50');
});

// ───────── Elementos nuevos ─────────

test('new text, shapes and local images are added centered, selected and undoable', () => {
  let state = start('whatsapp');
  const scene = state.history.present.scenes.whatsapp;
  const text = n.newTextLayer(scene);
  assert.equal(text.bind, null);
  assert.ok(text.x > 0 && text.x + text.width < scene.width);
  state = run(state, { type: 'addLayer', layer: text });
  assert.equal(state.selectedId, text.id);
  for (const kind of ['rect', 'ellipse', 'badge', 'line']) state = run(state, { type: 'addLayer', layer: n.newShapeLayer(scene, kind) });
  const image = n.newImageLayer(scene, png, { width: 2000, height: 1000 }, 'Mi foto');
  assert.deepEqual([image.width, image.height, image.fit, image.role, image.name], [648, 324, 'contain', 'photo', 'Mi foto']);
  state = run(state, { type: 'addLayer', layer: image });
  const layers = state.history.present.scenes.whatsapp.layers;
  assert.equal(layers.at(-1).id, image.id, 'new layers go on top');
  assert.ok(imageSourcesOf(state.history.present.scenes.whatsapp).includes(png), 'the local image is exported');
  assert.deepEqual(plain(normalizeScene(plain(state.history.present.scenes.whatsapp)).issues), []);
  state = run(state, { type: 'undo' });
  assert.ok(!state.history.present.scenes.whatsapp.layers.some(layer => layer.id === image.id));
  assert.equal(state.selectedId, null);
});

test('fonts list resolves labels for stored families', () => {
  assert.equal(fontLabel('Georgia, serif'), 'Georgia');
  assert.equal(fontLabel("'Comic Sans MS', cursive"), 'Comic Sans MS');
  assert.ok(editorFonts.every(font => /^[\w\s,'"-]+$/.test(font.family)), 'all families pass scene validation');
});

test('a bigger font from the panel grows the text box; canvas transforms keep their own height', () => {
  const measure = (layer, text) => Math.ceil((text.length * layer.fontSize * 0.55) / layer.width) * layer.fontSize * layer.lineHeight;
  let state = start();
  const title = find(state, byField('title'));
  state = run(state, { type: 'commitLayer', id: title.id, patch: { fontSize: 150 }, transient: true, measure }, { type: 'settle' });
  const grown = find(state, byField('title'));
  assert.ok(grown.height >= measure(grown, 'Taza artesanal'), 'the whole title fits');
  assert.equal(state.history.past.length, 1, 'font and box growth are one step');
  const fresh = start();
  const freshTitle = find(fresh, byField('title'));
  const transformed = run(fresh, { type: 'commitLayer', id: freshTitle.id, patch: { fontSize: 150, width: 400, height: 50 }, measure });
  assert.equal(find(transformed, byField('title')).height, 50, 'an explicit height from the canvas is kept');
});

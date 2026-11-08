const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadTs } = require('./load-ts.cjs');

const { emptyScene, paletteFrom, MAX_LAYERS } = loadTs('src/lib/editor/scene.ts');
const ops = loadTs('src/lib/editor/operations.ts');
const h = loadTs('src/lib/editor/history.ts');
const { imageLayer, textLayer, shapeLayer, addLayer, updateLayer, removeLayers, duplicateLayers, arrangeLayer, reorderLayer, setLocked, setVisible, moveLayerBy, applyPalette, setBackground, containsProduct } = ops;

const png = 'data:image/png;base64,iVBORw0KGgo=';
const box = { x: 0, y: 0, width: 100, height: 100 };
const deepFreeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); } return value; };
const plain = value => JSON.parse(JSON.stringify(value));
const ids = scene => plain(scene.layers.map(layer => layer.id));
function sample() {
  let scene = emptyScene('instagram', paletteFrom({}));
  scene = addLayer(scene, imageLayer(box, 'product', png, { id: 'photo' }));
  scene = addLayer(scene, shapeLayer(box, 'rect', { id: 'button' }));
  scene = addLayer(scene, textLayer(box, { id: 'title', bind: { field: 'title', prefix: '', suffix: '' } }));
  return deepFreeze(scene);
}

test('operations never mutate the scene they receive', () => {
  const scene = sample();
  assert.doesNotThrow(() => {
    updateLayer(scene, 'button', { x: 50, rotation: 30 });
    removeLayers(scene, ['photo']);
    duplicateLayers(scene, ['button']);
    arrangeLayer(scene, 'photo', 'front');
    addLayer(scene, shapeLayer(box, 'ellipse'));
    applyPalette(scene, paletteFrom({ primary: '#000000' }));
  });
});

test('no-op changes return the same scene reference', () => {
  const scene = sample();
  assert.equal(updateLayer(scene, 'button', { x: 0 }), scene);
  assert.equal(updateLayer(scene, 'missing', { x: 10 }), scene);
  assert.equal(removeLayers(scene, ['missing']), scene);
  assert.equal(arrangeLayer(scene, 'title', 'front'), scene);
  assert.equal(applyPalette(scene, scene.palette), scene);
  assert.equal(setBackground(scene, { token: 'secondary' }), scene);
});

test('update keeps id, type and value ranges', () => {
  const scene = updateLayer(sample(), 'button', { id: 'hacked', type: 'text', rotation: -30, opacity: 3, width: -5 });
  const button = scene.layers[1];
  assert.equal(button.id, 'button');
  assert.equal(button.type, 'shape');
  assert.equal(button.rotation, 330);
  assert.equal(button.opacity, 1);
  assert.equal(button.width, 1);
  assert.equal(moveLayerBy(scene, 'button', 5, -5).layers[1].y, -5);
});

test('bound text cannot receive its own text through updateLayer', () => {
  const scene = sample();
  assert.equal(updateLayer(scene, 'title', { text: 'copia desincronizada' }), scene);
});

test('locked layers only accept lock, visibility and name changes and are not deleted', () => {
  const scene = setLocked(sample(), 'photo', true);
  assert.equal(updateLayer(scene, 'photo', { x: 300 }), scene);
  assert.equal(setVisible(scene, 'photo', false).layers[0].visible, false);
  assert.equal(removeLayers(scene, ['photo', 'button']).layers.length, 2);
  assert.equal(setLocked(scene, 'photo', false).layers[0].locked, false);
});

test('duplicate places unlocked copies above the originals, keeping bindings', () => {
  const { scene, ids: created } = duplicateLayers(setLocked(sample(), 'title', true), ['photo', 'title']);
  assert.equal(scene.layers.length, 5);
  assert.deepEqual(ids(scene).filter(id => !created.includes(id)), ['photo', 'button', 'title']);
  assert.equal(scene.layers[1].id, created[0]);
  assert.equal(scene.layers[1].x, 24);
  const titleCopy = scene.layers[4];
  assert.equal(titleCopy.locked, false);
  assert.equal(titleCopy.bind.field, 'title');
  assert.notEqual(titleCopy.bind, scene.layers[3].bind);
});

test('arrange and reorder change stacking order', () => {
  const scene = sample();
  assert.deepEqual(ids(arrangeLayer(scene, 'photo', 'front')), ['button', 'title', 'photo']);
  assert.deepEqual(ids(arrangeLayer(scene, 'title', 'back')), ['title', 'photo', 'button']);
  assert.deepEqual(ids(arrangeLayer(scene, 'photo', 'forward')), ['button', 'photo', 'title']);
  assert.deepEqual(ids(arrangeLayer(scene, 'photo', 'backward')), ['photo', 'button', 'title']);
  assert.deepEqual(ids(reorderLayer(scene, 'title', 99)), ['photo', 'button', 'title']);
  assert.deepEqual(ids(reorderLayer(scene, 'title', 0)), ['title', 'photo', 'button']);
});

test('add respects the layer limit, renews repeated ids and inserts at an index', () => {
  let scene = sample();
  scene = addLayer(scene, shapeLayer(box, 'rect', { id: 'photo' }), 0);
  assert.notEqual(scene.layers[0].id, 'photo');
  for (let i = scene.layers.length; i < MAX_LAYERS; i++) scene = addLayer(scene, shapeLayer(box, 'rect'));
  assert.equal(addLayer(scene, shapeLayer(box, 'rect')), scene);
  assert.equal(duplicateLayers(scene, ['photo']).ids.length, 0);
});

test('palette changes only when applied explicitly', () => {
  const scene = sample();
  const next = applyPalette(scene, paletteFrom({ primary: '#112233' }));
  assert.equal(next.palette.primary, '#112233');
  assert.equal(scene.palette.primary, '#2f5bff');
  assert.equal(next.layers, scene.layers);
});

test('knows when an image already contains the product', () => {
  const ai = addLayer(emptyScene('instagram', paletteFrom({})), imageLayer(box, 'ai-complete', png));
  const background = addLayer(emptyScene('instagram', paletteFrom({})), imageLayer(box, 'ai-background', png));
  assert.equal(containsProduct(ai), true);
  assert.equal(containsProduct(background), false);
  assert.equal(containsProduct(sample()), true);
});

// ───────── Historial ─────────

test('undo and redo walk through committed steps', () => {
  let history = h.createHistory('a');
  assert.equal(h.canUndo(history), false);
  history = h.commit(history, 'b');
  history = h.commit(history, 'c');
  assert.equal(h.commit(history, 'c'), history, 'same state is not a step');
  history = h.undo(history);
  assert.equal(history.present, 'b');
  history = h.undo(history);
  assert.equal(history.present, 'a');
  assert.equal(h.undo(history), history);
  history = h.redo(history);
  assert.equal(history.present, 'b');
  history = h.commit(history, 'x');
  assert.equal(h.canRedo(history), false, 'a new change clears the redo stack');
  assert.deepEqual(plain(history.past), ['a', 'b']);
});

test('a drag previewed many times counts as a single step', () => {
  let history = h.createHistory(0);
  for (let x = 1; x <= 20; x++) history = h.preview(history, x);
  assert.equal(history.present, 20);
  assert.equal(history.past.length, 0);
  history = h.settle(history);
  assert.deepEqual(plain(history.past), [0]);
  assert.equal(h.undo(history).present, 0);
});

test('cancel restores the state before the preview, and undo settles pending previews', () => {
  let history = h.preview(h.preview(h.createHistory('start'), 'moving'), 'moved');
  assert.equal(h.cancel(history).present, 'start');
  assert.equal(h.canRedo(history), false);
  history = h.undo(history);
  assert.equal(history.present, 'start');
  assert.equal(h.redo(history).present, 'moved');
});

test('commit during a preview records one step from the original state', () => {
  let history = h.preview(h.createHistory('a'), 'dragging');
  history = h.commit(history, 'dropped');
  assert.deepEqual(plain(history.past), ['a']);
  assert.equal(history.pending, null);
  assert.equal(h.commit(h.preview(h.createHistory('a'), 'b'), 'a').past.length, 0);
});

test('history keeps at most the configured number of steps', () => {
  let history = h.createHistory(0, 3);
  for (let i = 1; i <= 10; i++) history = h.commit(history, i);
  assert.deepEqual(plain(history.past), [7, 8, 9]);
  assert.equal(h.resetHistory(history, 'new').past.length, 0);
  assert.equal(h.resetHistory(history, 'new').limit, 3);
});

test('history works with scene snapshots', () => {
  const start = sample();
  let history = h.createHistory(start);
  history = h.commit(history, updateLayer(history.present, 'button', { x: 40 }));
  history = h.commit(history, removeLayers(history.present, ['photo']));
  history = h.undo(h.undo(history));
  assert.equal(history.present, start);
});

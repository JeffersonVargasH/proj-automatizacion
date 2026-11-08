const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadTs } = require('./load-ts.cjs');

const { paletteFrom, normalizeScene, sceneFormats } = loadTs('src/lib/editor/scene.ts');
const { createSceneFromTemplate, createScenes, templateSlots } = loadTs('src/lib/editor/layouts.ts');
const b = loadTs('src/lib/editor/bindings.ts');
const { updateLayer } = loadTs('src/lib/editor/operations.ts');

const plain = value => JSON.parse(JSON.stringify(value));
const photo = 'data:image/jpeg;base64,/9j/real';
const ai = 'clic-media://user/business/ai.jpg';
const values = b.commercialValuesOf({ title: 'Taza artesanal', body: 'Hecha a mano', price: 'S/ 35', validity: '', cta: 'Escríbenos', contact: '999 888 777', product: 'no es un campo comercial' });
const input = (extra = {}) => ({ palette: paletteFrom({ primary: '#2F5BFF', secondary: '#F7F9FC' }), brandName: 'Cerámica Luna', logo: 'data:image/png;base64,logo', footer: '@ceramica.luna', values, product: photo, ...extra });
const roles = scene => plain(scene.layers.filter(layer => layer.type === 'image').map(layer => layer.role));
const bound = scene => plain(scene.layers.filter(layer => layer.type === 'text' && layer.bind).map(layer => layer.bind.field));

test('templates exist for the three networks with the right canvas size', () => {
  const scenes = createScenes(input());
  assert.deepEqual(Object.keys(scenes).sort(), ['facebook', 'instagram', 'whatsapp']);
  for (const [format, scene] of Object.entries(scenes)) {
    assert.equal(scene.width, sceneFormats[format].width);
    assert.equal(scene.height, sceneFormats[format].height);
    assert.equal(scene.format, format);
  }
});

test('template slots and layers stay inside the canvas', () => {
  for (const format of Object.keys(sceneFormats)) {
    const slots = templateSlots(format);
    for (const [name, rect] of Object.entries(slots)) {
      if (!Array.isArray(rect)) continue;
      const [x, y, w, h] = rect;
      assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1.0001 && y + h <= 1.0001, `${format}.${name}`);
    }
    for (const kind of [undefined, 'complete', 'background']) {
      const scene = createSceneFromTemplate(format, input(kind ? { base: { src: ai, kind } } : {}));
      for (const layer of scene.layers) {
        assert.ok(layer.x >= 0 && layer.y >= 0 && layer.x + layer.width <= scene.width && layer.y + layer.height <= scene.height, `${format}/${kind}: ${layer.name}`);
      }
    }
  }
});

test('templates produce scenes that pass validation unchanged', () => {
  for (const scene of Object.values(createScenes(input({ base: { src: ai, kind: 'background' } })))) {
    const result = normalizeScene(JSON.parse(JSON.stringify(scene)));
    assert.deepEqual(plain(result.issues), []);
    assert.deepEqual(plain(result.scene), plain(scene));
  }
});

test('real product photo is never duplicated over a complete AI image', () => {
  const complete = createSceneFromTemplate('instagram', input({ base: { src: ai, kind: 'complete' } }));
  assert.deepEqual(roles(complete), ['ai-complete', 'logo']);
  const background = createSceneFromTemplate('instagram', input({ base: { src: ai, kind: 'background' } }));
  assert.deepEqual(roles(background), ['ai-background', 'product', 'logo']);
  const plainPhoto = createSceneFromTemplate('instagram', input());
  assert.deepEqual(roles(plainPhoto), ['product', 'logo']);
  const product = plainPhoto.layers.find(layer => layer.role === 'product');
  assert.equal(product.src, photo, 'the real photo is used as-is');
  assert.equal(product.fit, 'contain', 'the product is not cropped');
});

test('commercial texts are bound layers, never text baked into the scene', () => {
  const scene = createSceneFromTemplate('whatsapp', input());
  assert.deepEqual(bound(scene), ['title', 'body', 'price', 'cta', 'contact']);
  const json = JSON.stringify(scene);
  for (const value of ['Taza artesanal', 'Hecha a mano', 'S/ 35', 'Escríbenos', '999 888 777']) assert.ok(!json.includes(value), value);
  assert.ok(json.includes('Cerámica Luna'), 'brand name comes from the brand snapshot');
});

test('optional price and validity layers are created only when there is a value', () => {
  const noPrice = createSceneFromTemplate('facebook', input({ values: { ...values, price: ' ' } }));
  assert.ok(!bound(noPrice).includes('price'));
  assert.ok(!noPrice.layers.some(layer => layer.name === 'Etiqueta de precio'));
  const withValidity = createSceneFromTemplate('facebook', input({ values: { ...values, validity: 'Hasta el domingo' } }));
  assert.ok(bound(withValidity).includes('validity'));
});

test('unsafe images are ignored by templates', () => {
  const scene = createSceneFromTemplate('instagram', input({ logo: 'javascript:alert(1)', product: 'data:image/svg+xml;base64,x', base: { src: 'http://x', kind: 'complete' } }));
  assert.deepEqual(roles(scene), []);
});

test('brand palette is a snapshot: later brand changes do not alter the scene', () => {
  const brand = { primary: '#2F5BFF', secondary: '#F7F9FC' };
  const scene = createSceneFromTemplate('instagram', input({ palette: paletteFrom(brand) }));
  brand.primary = '#FF0000';
  assert.equal(scene.palette.primary, '#2f5bff');
});

// ───────── Sincronización de campos comerciales ─────────

test('bound layers show the design field; empty fields show nothing', () => {
  const scene = createSceneFromTemplate('instagram', input());
  const price = scene.layers.find(layer => layer.bind?.field === 'price');
  assert.equal(b.resolveLayerText(price, values), 'S/ 35');
  assert.equal(b.resolveLayerText({ ...price, bind: { field: 'price', prefix: 'Precio: ', suffix: '' } }, values), 'Precio: S/ 35');
  assert.equal(b.resolveLayerText({ ...price, bind: { field: 'price', prefix: 'Precio: ', suffix: '' } }, { ...values, price: '' }), '');
});

test('editing a bound layer changes the single source of truth, not the layer', () => {
  const scene = createSceneFromTemplate('instagram', input());
  const title = scene.layers.find(layer => layer.bind?.field === 'title');
  const edit = b.editLayerText(scene, values, title.id, 'Nueva taza');
  assert.equal(edit.changed, 'values');
  assert.equal(edit.scene, scene);
  assert.equal(edit.values.title, 'Nueva taza');
  assert.equal(values.title, 'Taza artesanal', 'input values are not mutated');
  // Las otras redes muestran el mismo dato sin tocar sus escenas.
  const story = createSceneFromTemplate('whatsapp', input());
  assert.equal(b.resolveLayerText(story.layers.find(layer => layer.bind?.field === 'title'), edit.values), 'Nueva taza');
  assert.equal(b.editLayerText(scene, values, title.id, 'x'.repeat(200)).values.title.length, b.fieldLimits.title);
  assert.equal(b.editLayerText(scene, values, title.id, 'Taza artesanal').changed, null);
});

test('editing a free text layer changes only that layer', () => {
  const scene = createSceneFromTemplate('instagram', input());
  const brandName = scene.layers.find(layer => layer.name === 'Nombre del negocio');
  const edit = b.editLayerText(scene, values, brandName.id, 'Luna Cerámica');
  assert.equal(edit.changed, 'scene');
  assert.equal(edit.values, values);
  assert.equal(edit.scene.layers.find(layer => layer.id === brandName.id).text, 'Luna Cerámica');
  const locked = updateLayer(scene, brandName.id, { locked: true });
  assert.equal(b.editLayerText(locked, values, brandName.id, 'otro').changed, null);
});

test('unbinding is explicit and keeps the visible text; binding drops the old text', () => {
  const scene = createSceneFromTemplate('instagram', input());
  const cta = scene.layers.find(layer => layer.bind?.field === 'cta');
  const unbound = b.unbindLayer(scene, values, cta.id);
  const free = unbound.layers.find(layer => layer.id === cta.id);
  assert.equal(free.bind, null);
  assert.equal(free.text, 'Escríbenos');
  const rebound = b.bindLayer(unbound, cta.id, 'cta');
  assert.equal(rebound.layers.find(layer => layer.id === cta.id).text, '');
  assert.equal(b.bindLayer(rebound, cta.id, 'cta'), rebound);
});

test('binding report warns about hidden data and empty bound layers', () => {
  const scene = createSceneFromTemplate('instagram', input());
  const report = b.bindingReport(scene, { ...values, contact: '', validity: 'Solo hoy' });
  assert.deepEqual(plain(report.notShown), ['validity']);
  assert.equal(report.emptyLayers.length, 1);
  const priceId = scene.layers.find(layer => layer.bind?.field === 'price').id;
  const hidden = updateLayer(scene, priceId, { visible: false });
  assert.ok(b.bindingReport(hidden, values).notShown.includes('price'));
});

test('commercial values only include the commercial fields', () => {
  assert.deepEqual(Object.keys(values), ['title', 'body', 'price', 'validity', 'cta', 'contact']);
  assert.equal(b.commercialValuesOf({ title: 3 }).title, '');
});

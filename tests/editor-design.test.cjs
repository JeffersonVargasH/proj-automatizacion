// Fase 1: escenas dentro de Design, compatibilidad con diseños anteriores, duplicación y exportación desacoplada.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadTs } = require('./load-ts.cjs');

const plain = value => JSON.parse(JSON.stringify(value));
const studio = loadTs('src/lib/studio.ts');
const ds = loadTs('src/lib/editor/design-scenes.ts');
const { createDesignExporter } = loadTs('src/lib/editor/export.ts');
const { normalizeScene } = loadTs('src/lib/editor/scene.ts');
const b = loadTs('src/lib/editor/bindings.ts');
const ops = loadTs('src/lib/editor/operations.ts');

const photo = 'data:image/jpeg;base64,/9j/real';
const logo = 'data:image/png;base64,logo';
const commercialTexts = ['Taza artesanal', 'Hecha a mano en Cusco', 'S/ 35', 'Escríbenos', '999 888 777'];

function design(extra = {}) {
  const brand = { ...studio.emptyBrand, name: 'Cerámica Luna', logo, primary: '#1A2C77', secondary: '#FFF4E8', instagram: '@ceramica.luna' };
  const d = studio.newDesign(brand);
  Object.assign(d, { product: 'Taza', title: commercialTexts[0], body: commercialTexts[1], price: commercialTexts[2], cta: commercialTexts[3], contact: commercialTexts[4], images: [photo] }, extra);
  return d;
}
/** Diseño guardado antes del editor visual: sin `scenes`, sin `captions`, con un formato que ya no se genera. */
const legacy = () => ({
  id: 'legacy-1', createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-02T10:00:00.000Z',
  brand: { name: 'Panadería Rosa', logo: '', primary: '#C94B45', secondary: '#FFFFFF', phone: '999', instagram: '', facebook: '', address: '' },
  type: 'Publicación', objective: 'Vender', product: 'Pan', description: '', price: 'S/ 1', validity: '', contact: '999',
  images: ['clic-media://u/b/pan.jpg'], selectedImage: 0, format: 'portrait', style: 'Moderno', tone: 'Cercano', instructions: '',
  title: 'Pan del día', body: 'Recién horneado', cta: 'Haz tu pedido', hashtags: '#Pan', caption: 'Pan del día',
  color: '#C94B45', background: '#FFFFFF', font: 'sans', textX: 7, textY: 62, textSize: 68, imageX: 7, imageY: 16, imageWidth: 86,
  requests: [], schedule: null, generation: { status: 'completed', ticketId: 't1', urls: { instagram: 'clic-media://u/b/ai.jpg' } },
});

// ───────── Compatibilidad con diseños anteriores ─────────

test('legacy designs without scenes pass through untouched', () => {
  const old = legacy();
  const before = JSON.stringify(old);
  const { design: result, issues } = ds.normalizeDesignScenes(old);
  assert.equal(result, old, 'same reference: nothing is rewritten');
  assert.deepEqual(plain(issues), []);
  assert.equal(ds.hasScenes(old), false);
  assert.equal(ds.sceneFor(old, 'instagram'), null);
  assert.equal(JSON.stringify(old), before);
});

test('legacy designs keep the same generation and publishing payloads', () => {
  const old = legacy();
  const payload = plain(studio.generationPayload(old));
  assert.ok(!('scenes' in payload) && !JSON.stringify(payload).includes('"scenes"'));
  assert.deepEqual(Object.keys(payload).sort(), ['business', 'content', 'copy', 'edits', 'product', 'requestId', 'schedule', 'version']);
  assert.equal(payload.copy.title, 'Pan del día');
  assert.equal(studio.publishPayload(old, 'instagram', '@rosa', 'https://x/img.png').caption, 'Pan del día');
});

test('scenes are never sent to n8n or Meta', () => {
  const d = ds.ensureDesignScenes(design());
  assert.ok(!JSON.stringify(studio.generationPayload(d)).includes('"scenes"'));
  assert.ok(!JSON.stringify(studio.publishPayload(d, 'facebook', 'page', 'https://x/i.png')).includes('"scenes"'));
});

test('legacy designs duplicate exactly as before (no scenes added)', () => {
  const copy = studio.duplicateDesign(legacy());
  assert.equal(plain(copy).scenes, undefined);
  assert.equal(copy.title, 'Pan del día · copia');
  assert.equal(copy.generation, undefined);
});

test('exporter uses the classic renderer only when there is no editable scene', async () => {
  const calls = [];
  const legacyRenderer = async d => { calls.push(['legacy', d.format]); return 'legacy-image'; };
  const sceneRenderer = async scene => { calls.push(['scene', scene.format]); return 'scene-image'; };
  const old = legacy();
  const withScenes = ds.ensureDesignScenes(design());
  assert.equal(await createDesignExporter({ legacy: legacyRenderer, scene: sceneRenderer }).render(old, 'facebook'), 'legacy-image');
  await assert.rejects(createDesignExporter({ legacy: legacyRenderer }).render(withScenes, 'facebook'), { name: 'SceneRendererMissingError' }, 'an edited scene never falls back silently');
  assert.equal(await createDesignExporter({ legacy: legacyRenderer, scene: sceneRenderer }).render(withScenes, 'whatsapp'), 'scene-image');
  assert.deepEqual(calls, [['legacy', 'facebook'], ['scene', 'whatsapp']]);
  const failing = createDesignExporter({ legacy: legacyRenderer, scene: async () => { throw new Error('canvas tainted'); } });
  await assert.rejects(failing.render(withScenes, 'instagram'), /canvas tainted/);
  assert.equal(calls.length, 2, 'the classic renderer is not used when the scene render fails');
  const partial = { ...withScenes, scenes: { instagram: withScenes.scenes.instagram } };
  const exporter = createDesignExporter({ legacy: legacyRenderer, scene: sceneRenderer });
  assert.equal(exporter.source(partial, 'instagram'), 'scene');
  assert.equal(exporter.source(partial, 'facebook'), 'legacy', 'missing formats fall back');
  assert.equal(exporter.source({ ...withScenes, scenes: { instagram: { version: 99 } } }, 'instagram'), 'legacy', 'invalid scenes fall back');
});

// ───────── Escenas dentro del diseño ─────────

test('scenes are created from the design snapshot, not from the live brand', () => {
  const d = design({ color: '#123456', background: '#FAFAFA' });
  const scenes = ds.createDesignScenes(d);
  assert.deepEqual(Object.keys(scenes).sort(), ['facebook', 'instagram', 'whatsapp']);
  for (const scene of Object.values(scenes)) {
    assert.equal(scene.palette.primary, '#123456');
    assert.equal(scene.palette.secondary, '#fafafa');
  }
  // La marca del negocio cambia después: el diseño ya creado y sus escenas no.
  const liveBrand = { ...studio.emptyBrand, name: 'Luna', primary: '#1A2C77', secondary: '#FFFFFF' };
  const later = ds.ensureDesignScenes(studio.newDesign(liveBrand));
  liveBrand.primary = '#FF0000'; liveBrand.name = 'Otro nombre';
  assert.equal(later.brand.primary, '#1A2C77');
  assert.equal(later.scenes.instagram.palette.primary, '#1a2c77');
  assert.ok(JSON.stringify(later.scenes).includes('Luna') && !JSON.stringify(later.scenes).includes('Otro nombre'));
});

test('scenes use the real product photo and never copy commercial texts', () => {
  const d = ds.ensureDesignScenes(design());
  const json = JSON.stringify(d.scenes);
  for (const text of commercialTexts) assert.ok(!json.includes(text), text);
  const product = d.scenes.instagram.layers.find(layer => layer.role === 'product');
  assert.equal(product.src, photo);
  assert.ok(json.includes('Cerámica Luna'));
});

test('a complete AI image is not combined with a duplicated product photo', () => {
  const d = ds.ensureDesignScenes(design(), { base: { instagram: { src: 'clic-media://u/b/ai.jpg', kind: 'complete' }, facebook: { src: 'clic-media://u/b/bg.jpg', kind: 'background' } } });
  const roles = network => plain(d.scenes[network].layers.filter(layer => layer.type === 'image').map(layer => layer.role));
  assert.deepEqual(roles('instagram'), ['ai-complete', 'logo']);
  assert.deepEqual(roles('facebook'), ['ai-background', 'product', 'logo']);
  assert.deepEqual(roles('whatsapp'), ['product', 'logo']);
});

test('ensureDesignScenes keeps existing scenes and only fills missing ones', () => {
  const first = ds.ensureDesignScenes(design());
  assert.equal(ds.ensureDesignScenes(first), first, 'idempotent');
  const edited = ds.withScene(first, 'instagram', ops.moveLayerBy(first.scenes.instagram, first.scenes.instagram.layers[0].id, 10, 10));
  const partial = { ...edited, scenes: { instagram: edited.scenes.instagram } };
  const filled = ds.ensureDesignScenes(partial);
  assert.deepEqual(plain(filled.scenes.instagram), plain(partial.scenes.instagram), 'the edited scene is kept');
  assert.ok(filled.scenes.facebook && filled.scenes.whatsapp);
});

test('withScene validates the scene and its format', () => {
  const d = ds.ensureDesignScenes(design());
  assert.equal(ds.withScene(d, 'instagram', d.scenes.facebook), d, 'a Facebook scene cannot be stored as Instagram');
  assert.equal(ds.withScene(d, 'instagram', { version: 7 }), d);
  assert.equal(ds.withoutScenes(d).scenes, undefined);
  assert.equal(ds.withoutScenes(legacy()).scenes, undefined);
});

test('invalid stored scenes are dropped per format and reported', () => {
  const d = ds.ensureDesignScenes(design());
  const stored = plain({ ...d, scenes: { instagram: d.scenes.instagram, facebook: { ...d.scenes.whatsapp }, whatsapp: { version: 99 }, tiktok: d.scenes.instagram } });
  const { design: result, issues } = ds.normalizeDesignScenes(stored);
  assert.deepEqual(Object.keys(result.scenes), ['instagram']);
  assert.ok(issues.some(issue => issue.includes('tiktok')));
  assert.ok(issues.some(issue => issue.startsWith('facebook')));
  assert.ok(issues.some(issue => issue.startsWith('whatsapp')));
  assert.equal(ds.normalizeDesignScenes({ ...d, scenes: 'roto' }).design.scenes, undefined);
  assert.equal(ds.normalizeDesignScenes({ ...d, scenes: { whatsapp: { version: 99 } } }).design.scenes, undefined);
});

test('stale texts saved inside bound layers are discarded on load', () => {
  const d = ds.ensureDesignScenes(design());
  const stored = plain(d);
  const price = stored.scenes.instagram.layers.find(layer => layer.bind?.field === 'price');
  price.text = 'S/ 20 (precio viejo)';
  const loaded = ds.normalizeDesignScenes(stored).design;
  assert.equal(loaded.scenes.instagram.layers.find(layer => layer.id === price.id).text, '');
});

// ───────── Duplicación ─────────

test('duplicating copies scenes and brand without shared mutable references', () => {
  const original = ds.ensureDesignScenes(design());
  const copy = studio.duplicateDesign(original);
  assert.notEqual(copy.id, original.id);
  assert.deepEqual(plain(copy.scenes), plain(original.scenes));
  assert.notEqual(copy.scenes, original.scenes);
  assert.notEqual(copy.scenes.instagram, original.scenes.instagram);
  assert.notEqual(copy.scenes.instagram.layers[0], original.scenes.instagram.layers[0]);
  assert.notEqual(copy.brand, original.brand);
  copy.scenes.instagram.layers[0].x = 999;
  copy.scenes.instagram.palette.primary = '#000000';
  copy.brand.name = 'Otro';
  assert.notEqual(original.scenes.instagram.layers[0].x, 999);
  assert.equal(original.scenes.instagram.palette.primary, '#1a2c77');
  assert.equal(original.brand.name, 'Cerámica Luna');
  assert.equal(ds.normalizeDesignScenes(copy).issues.length, 0);
});

// ───────── Fuente única de verdad ─────────

test('editing a bound layer updates the design field used by captions, n8n and every network', async () => {
  let d = ds.ensureDesignScenes(design());
  const scene = d.scenes.facebook;
  const priceLayer = scene.layers.find(layer => layer.bind?.field === 'price');
  const edit = b.editLayerText(scene, ds.designValues(d), priceLayer.id, 'S/ 29');
  assert.equal(edit.changed, 'values');
  d = { ...d, ...edit.values };
  assert.equal(studio.generationPayload(d).product.price, 'S/ 29');
  assert.ok(!JSON.stringify(d.scenes).includes('S/ 29'));
  const seen = [];
  const exporter = createDesignExporter({ legacy: async () => null, scene: async (s, values) => { seen.push(values.price); return s.format; } });
  for (const network of ['instagram', 'facebook', 'whatsapp']) await exporter.render(d, network);
  assert.deepEqual(seen, ['S/ 29', 'S/ 29', 'S/ 29']);
  for (const network of ['instagram', 'whatsapp']) {
    const layer = d.scenes[network].layers.find(item => item.bind?.field === 'price');
    assert.equal(b.resolveLayerText(layer, ds.designValues(d)), 'S/ 29');
  }
});

test('templates validate cleanly after a JSON round trip', () => {
  const d = ds.ensureDesignScenes(design());
  for (const scene of Object.values(plain(d).scenes)) assert.deepEqual(plain(normalizeScene(scene).issues), []);
});

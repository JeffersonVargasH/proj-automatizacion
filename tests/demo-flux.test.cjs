// Demo E2E: fondos sin texto con FLUX (Cloudflare Workers AI) → escenas del editor visual.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { loadTs } = require('./load-ts.cjs');

const plain = value => JSON.parse(JSON.stringify(value));
const cache = new Map();
const studio = loadTs('src/lib/studio.ts', { cache });
const ds = loadTs('src/lib/editor/design-scenes.ts', { cache });
const ops = loadTs('src/lib/editor/operations.ts', { cache });
const flow = JSON.parse(fs.readFileSync(path.join(__dirname, '../n8n/creamas-flux-images.json'), 'utf8'));

const photo = 'data:image/jpeg;base64,/9j/real';
const bg = network => `data:image/png;base64,iVBOR-${network}`;
function design() {
  const d = studio.newDesign({ ...studio.emptyBrand, name: 'varjeff', logo: 'data:image/png;base64,logo' });
  Object.assign(d, { product: 'Torta', title: 'Torta de chocolate', body: 'Hecha en casa', price: 'S/ 10', cta: 'Pide ya', images: [photo] });
  return d;
}
const roles = scene => plain(scene.layers.filter(layer => layer.type === 'image').map(layer => layer.role));

test('the app asks n8n for a background only', () => {
  assert.equal(studio.generationPayload(design()).content.imageMode, 'background');
});

test('generated backgrounds create scenes: AI background + real product photo + editable texts', () => {
  const urls = { instagram: bg('ig'), facebook: bg('fb'), whatsapp: bg('wa') };
  const result = ds.applyGeneratedBackgrounds(design(), urls);
  for (const network of ['instagram', 'facebook', 'whatsapp']) {
    const scene = result.scenes[network];
    assert.deepEqual(roles(scene), ['ai-background', 'product', 'logo'], network);
    assert.equal(scene.layers.find(layer => layer.role === 'ai-background').src, urls[network]);
    assert.equal(scene.layers.find(layer => layer.role === 'product').src, photo, 'the real photo is kept');
    assert.ok(scene.layers.some(layer => layer.bind?.field === 'price'), 'price is an editable layer');
  }
  assert.ok(!JSON.stringify(result.scenes).includes('Torta de chocolate'), 'commercial text stays in Design');
});

test('a new generation replaces only the background and keeps the user edits', () => {
  const first = ds.applyGeneratedBackgrounds(design(), { instagram: bg('1'), facebook: bg('1'), whatsapp: bg('1') });
  const title = first.scenes.instagram.layers.find(layer => layer.bind?.field === 'title');
  const edited = ds.withScene(first, 'instagram', ops.updateLayer(first.scenes.instagram, title.id, { x: 123, fontSize: 90 }));
  const second = ds.applyGeneratedBackgrounds(edited, { instagram: bg('2') });
  const scene = second.scenes.instagram;
  assert.equal(scene.layers.find(layer => layer.role === 'ai-background').src, bg('2'));
  const kept = scene.layers.find(layer => layer.id === title.id);
  assert.deepEqual([kept.x, kept.fontSize], [123, 90]);
  assert.equal(second.scenes.facebook.layers.find(layer => layer.role === 'ai-background').src, bg('1'), 'networks without a new image do not change');
  assert.equal(scene.layers.filter(layer => layer.role === 'ai-background').length, 1, 'no duplicated background');
});

test('a scene without an AI layer gets the background at the bottom', () => {
  const plainScenes = ds.ensureDesignScenes(design());
  assert.deepEqual(roles(plainScenes.scenes.whatsapp), ['product', 'logo']);
  const next = ds.applyGeneratedBackgrounds(plainScenes, { whatsapp: bg('wa') });
  const scene = next.scenes.whatsapp;
  assert.equal(scene.layers[0].role, 'ai-background');
  assert.deepEqual([scene.layers[0].x, scene.layers[0].y, scene.layers[0].width, scene.layers[0].height], [0, 0, 1080, 1920]);
  assert.equal(ds.applyGeneratedBackgrounds(plainScenes, {}), plainScenes, 'no images → same design');
});

test('legacy designs without scenes are untouched until a background arrives', () => {
  const d = design();
  assert.equal(ds.hasScenes(d), false);
  assert.equal(ds.applyGeneratedBackgrounds(d, { instagram: '' }), d);
});

// ───────── Flujo n8n ─────────

const node = name => flow.nodes.find(item => item.name === name);

test('the n8n flow keeps the webhook contract used by the app', () => {
  assert.equal(node('Generate Webhook').parameters.path, 'creamas-generate');
  assert.equal(node('Generate Webhook').parameters.httpMethod, 'POST');
  assert.equal(node('Status Webhook').parameters.path, 'status');
  const wiring = Object.fromEntries(Object.entries(flow.connections).map(([from, value]) => [from, value.main[0][0].node]));
  assert.deepEqual(wiring, { 'Generate Webhook': 'Initialize Job', 'Initialize Job': 'Respond with Ticket', 'Respond with Ticket': 'Split Formats', 'Split Formats': 'Cloudflare Workers AI: FLUX', 'Cloudflare Workers AI: FLUX': 'Finalize Job', 'Status Webhook': 'Lookup Job', 'Lookup Job': 'Respond with Status' });
  const finalize = node('Finalize Job').parameters.jsCode;
  assert.match(finalize, /kind: 'background'/);
  assert.ok(finalize.includes('finalUrls: finalUrl ? { instagram: finalUrl, facebook: finalUrl, whatsapp: finalUrl }'), 'one square image for the three networks');
  assert.ok(finalize.includes('result?.image'));
  assert.match(finalize, /cuota gratuita diaria/, 'quota errors are explained');
});

test('the n8n flow asks FLUX on Cloudflare for a text-free background', () => {
  const init = node('Initialize Job').parameters.jsCode;
  assert.match(init, /Absolutely no text of any kind/);
  assert.match(init, /do not show the product itself/);
  assert.ok(init.includes("const MODEL = '@cf/black-forest-labs/flux-1-schnell'"));
  assert.ok(init.includes("'/accounts/' + ACCOUNT_ID + '/ai/run/' + MODEL"));
  assert.match(init, /const ACCOUNT_ID = 'PEGA_AQUI_TU_ACCOUNT_ID'/, 'the repo copy has no real account');
  assert.match(init, /Falta configurar el Account ID/);
  assert.match(init, /slice\(0, 2048\)/, 'prompt fits the API limit');
});

test('the API token lives in an n8n credential, never in the flow', () => {
  const http = node('Cloudflare Workers AI: FLUX');
  assert.equal(http.parameters.url, '={{ $json.url }}');
  assert.equal(http.parameters.genericAuthType, 'httpHeaderAuth');
  assert.equal(http.credentials.httpHeaderAuth.name, 'Cloudflare Workers AI');
  assert.equal(http.onError, 'continueRegularOutput', 'errors reach Finalize Job with a clear message');
  assert.match(http.parameters.jsonBody, /steps: 4/);
  assert.doesNotMatch(JSON.stringify(flow), /Bearer [A-Za-z0-9_-]{10,}|tgp_v1_|sk-[A-Za-z0-9]{10,}/);
});

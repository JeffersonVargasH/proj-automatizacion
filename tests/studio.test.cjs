const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const ts = require('typescript');
const { test } = require('node:test');
const plain = value => JSON.parse(JSON.stringify(value));
const source = fs.readFileSync(path.join(__dirname, '../src/lib/studio.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const api = {};
vm.runInNewContext(compiled, { exports: api, crypto: webcrypto, Date });
const { newDesign, emptyBrand, normalizeBrand, intents, intentOf, duplicateDesign, suggestCopy, generationPayload, publishPayload, styleLook, outputs, formats } = api;

test('new designs inherit an independent brand snapshot and contact', () => {
  const brand = { ...emptyBrand, name: 'Cerámica Prueba', phone: '123456' };
  const d = newDesign(brand);
  brand.name = 'Changed';
  assert.equal(d.brand.name, 'Cerámica Prueba');
  assert.equal(d.contact, '123456');
  assert.equal(d.images.length, 0);
});
test('duplicating keeps editable content but resets delivery requests', () => {
  const d = newDesign(emptyBrand);
  d.title = 'Prueba'; d.images = ['data:image/png;base64,test'];
  d.schedule = { channel: 'Instagram', at: '2030-01-01T12:00', status: 'pending_connection' };
  d.requests = [{ text: 'Cambia el fondo' }];
  const copy = duplicateDesign(d);
  assert.notEqual(copy.id, d.id);
  assert.equal(copy.images[0], d.images[0]);
  assert.equal(copy.schedule, null);
  assert.equal(copy.requests.length, 0);
  assert.equal(d.title, 'Prueba');
});
test('copy suggestions adapt CTA to goal without inventing prices', () => {
  const d = newDesign({ ...emptyBrand, name: 'Luna & Sol' });
  d.product = 'Taza de cerámica'; d.objective = 'Atraer visitas';
  const copy = suggestCopy(d);
  assert.equal(copy.cta, 'Visítanos');
  assert.ok(copy.hashtags.includes('#Tazadeceramica'));
  assert.ok(!copy.caption.includes('Precio:'));
});
test('contract includes all references, edits, schedule and exact dimensions', () => {
  const d = newDesign(emptyBrand);
  d.images = ['image1', 'image2', 'image3']; d.format = 'facebook';
  d.requests = [{ text: 'Fondo rojo', status: 'pending' }];
  const payload = generationPayload(d);
  assert.equal(payload.product.images.length, 3);
  assert.equal(payload.content.dimensions.width, 1200);
  assert.equal(payload.content.dimensions.height, 630);
  assert.equal(payload.edits[0].status, 'pending');
  assert.equal(payload.version, 1);
});
test('new designs start from the brand publishing preferences', () => {
  const brand = { ...emptyBrand, preferences: { tone: 'Elegante', style: 'Minimalista', hashtags: '#HechoAMano', instructions: 'Fondo cálido' } };
  const d = newDesign(brand);
  assert.equal(d.tone, 'Elegante');
  assert.equal(d.style, 'Minimalista');
  assert.equal(d.font, 'serif');
  assert.equal(d.format, 'instagram');
  assert.equal(d.instructions, 'Fondo cálido');
  assert.equal(d.hashtags, '#HechoAMano');
  brand.preferences.tone = 'Juvenil';
  assert.equal(d.brand.preferences.tone, 'Elegante');
});
test('profiles saved before preferences existed get safe defaults', () => {
  const legacy = { name: 'Antiguo', logo: '', primary: '#112233', secondary: '#FFFFFF', phone: '', instagram: '', facebook: '', address: '' };
  const brand = normalizeBrand(legacy);
  assert.equal(brand.name, 'Antiguo');
  assert.equal(brand.preferences.tone, 'Cercano');
  assert.equal(brand.connections.whatsapp.enabled, false);
  assert.equal('format' in normalizeBrand({ ...legacy, preferences: { format: 'story' } }).preferences, false);
  assert.equal(newDesign(legacy).color, '#112233');
});
test('visual styles are built from the brand colors', () => {
  const brand = { primary: '#AA0000', secondary: '#00BB00' };
  assert.deepEqual(plain(styleLook('Moderno', brand)), { style: 'Moderno', font: 'sans', color: '#AA0000', background: '#00BB00' });
  assert.equal(styleLook('Vibrante', brand).background, '#AA0000');
  assert.equal(styleLook('Vibrante', brand).color, '#00BB00');
  assert.equal(styleLook('Minimalista', brand).color, '#AA0000');
});
test('generation asks n8n for Instagram, Facebook and WhatsApp versions', () => {
  const d = newDesign({ ...emptyBrand, connections: { ...emptyBrand.connections, instagram: { enabled: true, account: '@luna' } } });
  const payload = generationPayload(d);
  assert.deepEqual(plain(payload.content.outputs.map(output => output.network)), ['instagram', 'facebook', 'whatsapp']);
  assert.equal(payload.content.outputs[1].width, 1200);
  assert.equal(payload.content.outputs[2].height, 1920);
  assert.equal(JSON.parse(JSON.stringify(payload)).business.connections, undefined);
});
test('publishing sends one image per network with the caption', () => {
  const d = newDesign(emptyBrand);
  d.title = 'Taza'; d.caption = 'Texto para redes';
  const payload = publishPayload(d, 'facebook', 'Mi página', 'data:image/png;base64,x');
  assert.equal(payload.network, 'facebook');
  assert.equal(payload.account, 'Mi página');
  assert.equal(payload.dimensions.width, 1200);
  assert.equal(payload.caption, 'Texto para redes');
  assert.deepEqual(plain(outputs), ['instagram', 'facebook', 'whatsapp']);
});
test('each network publishes its own text, falling back to the main caption', () => {
  const d = newDesign(emptyBrand);
  d.caption = 'Texto general';
  d.captions = { whatsapp: 'Corto para el estado' };
  assert.equal(publishPayload(d, 'whatsapp', '+51 999', 'img').caption, 'Corto para el estado');
  assert.equal(publishPayload(d, 'facebook', 'Página', 'img').caption, 'Texto general');
  assert.equal(suggestCopy(d).captions, undefined);
});
test('duplicates start without generation or publication results', () => {
  const d = newDesign(emptyBrand);
  d.generation = { status: 'completed', urls: { instagram: 'x' } };
  d.publications = { instagram: { status: 'sent', at: '2026-01-01' } };
  const copy = duplicateDesign(d);
  assert.equal(copy.generation, undefined);
  assert.equal(copy.publications, undefined);
});
test('intents map to the type and objective sent to n8n', () => {
  const d = newDesign(emptyBrand);
  const offer = intents.find(intent => intent.label === 'Promocionar una oferta');
  Object.assign(d, { type: offer.type, objective: offer.objective });
  assert.equal(intentOf(d).label, 'Promocionar una oferta');
  assert.equal(generationPayload(d).content.type, 'Oferta');
  assert.equal(generationPayload(d).content.objective, 'Promocionar una oferta');
});
test('suggested hashtags keep the brand hashtags', () => {
  const d = newDesign({ ...emptyBrand, name: 'Luna', preferences: { ...emptyBrand.preferences, hashtags: '#HechoAMano, CeramicaPeruana' } });
  d.product = 'Taza';
  const { hashtags } = suggestCopy(d);
  assert.ok(hashtags.includes('#HechoAMano'));
  assert.ok(hashtags.includes('#CeramicaPeruana'));
  assert.ok(hashtags.includes('#Taza'));
});
test('all formats have a usable portrait, square or landscape canvas', () => {
  assert.equal(Object.keys(formats).length, 5);
  assert.equal(formats.instagram.width, formats.instagram.height);
  assert.ok(formats.story.height > formats.story.width);
  assert.ok(formats.facebook.height < formats.facebook.width);
});

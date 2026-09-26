const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const ts = require('typescript');
const { test } = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../src/lib/studio.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const api = {};
vm.runInNewContext(compiled, { exports: api, crypto: webcrypto, Date });
const { newDesign, emptyBrand, duplicateDesign, suggestCopy, generationPayload, formats } = api;

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
test('all formats have a usable portrait, square or landscape canvas', () => {
  assert.equal(Object.keys(formats).length, 5);
  assert.equal(formats.instagram.width, formats.instagram.height);
  assert.ok(formats.story.height > formats.story.width);
  assert.ok(formats.facebook.height < formats.facebook.width);
});

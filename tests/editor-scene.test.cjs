const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { loadTs } = require('./load-ts.cjs');

const plain = value => JSON.parse(JSON.stringify(value));
const scene = loadTs('src/lib/editor/scene.ts');
const { normalizeScene, paletteFrom, emptyScene, sceneFormats, SCENE_VERSION, MAX_LAYERS, isSafeImageSrc, resolvePaint } = scene;
const png = 'data:image/png;base64,iVBORw0KGgo=';
const palette = paletteFrom({ primary: '#2F5BFF', secondary: '#F7F9FC' });
const valid = (layers = []) => ({ ...emptyScene('instagram', palette), layers });

test('scene formats match the network formats used by the studio', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/studio.ts'), 'utf8');
  for (const [format, { width, height }] of Object.entries(sceneFormats)) {
    assert.match(source, new RegExp(`${format}: \\{[^}]*width: ${width}, height: ${height}`), format);
  }
  assert.equal(sceneFormats.instagram.width / sceneFormats.instagram.height, 1);
  assert.ok(Math.abs(sceneFormats.facebook.width / sceneFormats.facebook.height - 1.91) < 0.01);
  assert.equal(sceneFormats.whatsapp.width / sceneFormats.whatsapp.height, 9 / 16);
});

test('palette is a snapshot with readable ink and button text', () => {
  const colors = { primary: '#1A2C77', secondary: '#FFFFFF' };
  const p = paletteFrom(colors);
  colors.primary = '#000000';
  assert.equal(p.primary, '#1a2c77');
  assert.equal(p.ink, '#142e2c');
  assert.equal(p.onPrimary, '#ffffff');
  assert.equal(paletteFrom({ primary: 'red' }).primary, '#2f5bff');
  assert.equal(resolvePaint({ token: 'primary' }, p), '#1a2c77');
  assert.equal(resolvePaint('#abcdef', p), '#abcdef');
  assert.equal(resolvePaint(null, p), null);
});

test('a valid scene round-trips through JSON unchanged', () => {
  const input = valid([
    { id: 'a', name: 'Foto', type: 'image', role: 'product', src: png, fit: 'contain', cornerRadius: 0, x: 10, y: 20, width: 300, height: 200, rotation: 15, opacity: 1, visible: true, locked: false },
    { id: 'b', name: 'Precio', type: 'text', text: '', bind: { field: 'price', prefix: '', suffix: '' }, fontFamily: 'Geist, Arial, sans-serif', fontSize: 40, fontWeight: 700, italic: false, align: 'center', verticalAlign: 'middle', lineHeight: 1.15, fill: { token: 'onPrimary' }, x: 0, y: 0, width: 200, height: 60, rotation: 0, opacity: 1, visible: true, locked: false },
  ]);
  const { scene: result, issues } = normalizeScene(JSON.parse(JSON.stringify(input)));
  assert.deepEqual(plain(issues), []);
  assert.deepEqual(plain(result), plain(input));
});

test('versions: missing, newer and current', () => {
  assert.equal(normalizeScene({ ...valid(), version: undefined }).scene, null);
  const newer = normalizeScene({ ...valid(), version: SCENE_VERSION + 1 });
  assert.equal(newer.scene, null);
  assert.match(newer.issues[0], /más nueva/);
  assert.equal(normalizeScene(null).scene, null);
  assert.equal(normalizeScene({ ...valid(), format: 'tiktok' }).scene, null);
});

test('invalid values are repaired and unsafe layers dropped', () => {
  const { scene: result, issues } = normalizeScene({
    ...valid(), width: 10, height: 10, background: 'javascript:alert(1)', palette: { primary: 'nope' },
    layers: [
      { id: 'x', type: 'image', role: 'product', src: 'javascript:alert(1)' },
      { id: 'y', type: 'image', role: 'logo', src: 'data:image/svg+xml;base64,PHN2Zz4=' },
      { id: 'z', type: 'video' },
      'not a layer',
      { id: 't', type: 'text', text: 'x'.repeat(900), fontSize: 99999, opacity: 7, rotation: -90, fill: 'blue', fontFamily: '</style><script>', fontWeight: 900 },
      { id: 't', type: 'shape', kind: 'star', fill: '#FF0000', stroke: 'bad' },
    ],
  });
  assert.equal(result.width, 1080);
  assert.equal(result.height, 1080);
  assert.deepEqual(plain(result.background), { token: 'secondary' });
  assert.equal(result.palette.primary, '#2f5bff');
  assert.equal(result.layers.length, 2);
  const [text, shape] = result.layers;
  assert.equal(text.text.length, 500);
  assert.equal(text.fontSize, 600);
  assert.equal(text.opacity, 1);
  assert.equal(text.rotation, 270);
  assert.deepEqual(plain(text.fill), { token: 'ink' });
  assert.equal(text.fontFamily, 'Geist, Arial, sans-serif');
  assert.equal(text.fontWeight, 400);
  assert.equal(shape.kind, 'rect');
  assert.equal(shape.fill, '#ff0000');
  assert.equal(shape.stroke, null);
  assert.notEqual(shape.id, text.id, 'duplicated ids are renewed');
  assert.ok(issues.length >= 5);
});

test('bound text layers never keep their own copy of the text', () => {
  const { scene: result } = normalizeScene(valid([{ id: 'p', type: 'text', text: 'S/ 10 (viejo)', bind: { field: 'price' } }]));
  assert.equal(result.layers[0].text, '');
  assert.deepEqual(plain(result.layers[0].bind), { field: 'price', prefix: '', suffix: '' });
  const unknown = normalizeScene(valid([{ id: 'q', type: 'text', text: 'Hola', bind: { field: 'password' } }]));
  assert.equal(unknown.scene.layers[0].bind, null);
  assert.equal(unknown.scene.layers[0].text, 'Hola');
});

test('layer count is capped', () => {
  const many = Array.from({ length: MAX_LAYERS + 5 }, (_, i) => ({ id: `s${i}`, type: 'shape', kind: 'rect' }));
  const { scene: result, issues } = normalizeScene(valid(many));
  assert.equal(result.layers.length, MAX_LAYERS);
  assert.ok(issues.some(issue => issue.includes(String(MAX_LAYERS))));
});

test('only photo data URLs, storage references and https images are accepted', () => {
  assert.ok(isSafeImageSrc(png));
  assert.ok(isSafeImageSrc('data:image/jpeg;base64,/9j/'));
  assert.ok(isSafeImageSrc('clic-media://user/business/hash.png'));
  assert.ok(isSafeImageSrc('https://example.supabase.co/storage/v1/object/sign/media/a.png?token=1'));
  assert.ok(!isSafeImageSrc('http://insecure.test/a.png'));
  assert.ok(!isSafeImageSrc('data:image/svg+xml;base64,PHN2Zz4='));
  assert.ok(!isSafeImageSrc('javascript:alert(1)'));
  assert.ok(!isSafeImageSrc(42));
});

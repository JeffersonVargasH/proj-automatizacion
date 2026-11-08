// Fase 1: las escenas se guardan y recuperan con el almacenamiento real de Clic (studio-storage.ts),
// usando dobles en memoria de Supabase (tabla + Storage) e IndexedDB. No hay red ni servicios externos.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadTs } = require('./load-ts.cjs');

const plain = value => JSON.parse(JSON.stringify(value));
const SUPABASE_URL = 'https://test.supabase.co';
const png = 'data:image/png;base64,iVBORw0KGgo=';
const jpg = 'data:image/jpeg;base64,/9j/4AAQ';

function fakeIndexedDB() {
  const data = new Map();
  const later = fn => setTimeout(fn, 0);
  return {
    data,
    open() {
      const req = {};
      later(() => {
        req.result = {
          close() {},
          transaction() {
            const tx = {};
            const done = request => { later(() => tx.oncomplete?.()); return request; };
            tx.objectStore = () => ({
              get: key => { const request = { result: structuredClone(data.get(key)) }; return done(request); },
              put: (value, key) => { data.set(key, structuredClone(value)); return done({ result: key }); },
              delete: key => { data.delete(key); return done({ result: undefined }); },
            });
            return tx;
          },
        };
        req.onsuccess?.();
      });
      return req;
    },
  };
}

function fakeSupabase() {
  const rows = new Map();
  const files = new Map();
  const signed = path => `${SUPABASE_URL}/storage/v1/object/sign/media/${path}?token=signed`;
  return {
    rows, files,
    from: () => ({
      select: () => ({ eq: () => ({ order: async () => ({ data: [...rows.values()].map(row => ({ id: row.id, design: structuredClone(row.design) })), error: null }) }) }),
      upsert: async list => { list.forEach(row => rows.set(row.id, structuredClone(row))); return { error: null }; },
      delete: () => ({ in: async ids => { ids.forEach(id => rows.delete(id)); return { error: null }; } }),
    }),
    storage: {
      from: () => ({
        upload: async (path, blob) => { files.set(path, blob.type); return { error: null }; },
        createSignedUrls: async paths => ({ data: paths.map(path => ({ signedUrl: signed(path) })), error: null }),
        createSignedUrl: async path => ({ data: { signedUrl: signed(path) }, error: null }),
      }),
    },
  };
}

function setup() {
  const idb = fakeIndexedDB();
  const globals = { process: { env: { NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL } }, indexedDB: idb, TextEncoder, Blob, atob, Uint8Array, setTimeout };
  const cache = new Map();
  const { storage } = loadTs('src/lib/studio-storage.ts', { globals, cache });
  const studio = loadTs('src/lib/studio.ts', { globals, cache });
  const ds = loadTs('src/lib/editor/design-scenes.ts', { globals, cache });
  const { normalizeScene } = loadTs('src/lib/editor/scene.ts', { globals, cache });
  const supabase = fakeSupabase();
  storage.configure({ supabase, userId: 'user-1', businessId: 'biz-1' });
  return { storage, studio, ds, normalizeScene, supabase, idb };
}

function designWithScenes({ studio, ds }) {
  const brand = { ...studio.emptyBrand, name: 'Cerámica Luna', logo: png, primary: '#1A2C77', secondary: '#FFF4E8' };
  const d = studio.newDesign(brand);
  Object.assign(d, { product: 'Taza', title: 'Taza artesanal', body: 'Hecha a mano', price: 'S/ 35', cta: 'Escríbenos', contact: '999', images: [jpg] });
  return ds.ensureDesignScenes(d, { base: { facebook: { src: png, kind: 'background' } } });
}
const imageSources = design => Object.values(design.scenes).flatMap(scene => scene.layers.filter(layer => layer.type === 'image').map(layer => layer.src));

test('saving uploads layer images and stores only clic-media references', async () => {
  const ctx = setup();
  const d = designWithScenes(ctx);
  await ctx.storage.put('history', [d]);
  const row = ctx.supabase.rows.get(d.id);
  const json = JSON.stringify(row.design);
  assert.ok(!json.includes('data:image'), 'no base64 in the database');
  const sources = imageSources(row.design);
  assert.ok(sources.length >= 6);
  assert.ok(sources.every(src => src.startsWith('clic-media://user-1/biz-1/')), 'every layer image is a storage reference');
  assert.ok(ctx.supabase.files.size >= 2, 'photo and logo uploaded');
  for (const scene of Object.values(row.design.scenes)) assert.deepEqual(plain(ctx.normalizeScene(scene).issues), [], 'references pass validation');
  assert.ok(!JSON.stringify(row.design.scenes).includes('Taza artesanal'), 'commercial text stays in the design fields');
  assert.equal(row.design.title, 'Taza artesanal');
  assert.equal(d.scenes.instagram.layers.find(layer => layer.role === 'product').src, jpg, 'the in-memory design is not modified');
});

test('loading signs layer images and returns valid, usable scenes', async () => {
  const ctx = setup();
  const d = designWithScenes(ctx);
  await ctx.storage.put('history', [d]);
  const [loaded] = await ctx.storage.get('history');
  const sources = imageSources(loaded);
  assert.ok(sources.every(src => src.startsWith(`${SUPABASE_URL}/storage/v1/object/sign/media/`)), 'signed URLs for the canvas');
  for (const network of ['instagram', 'facebook', 'whatsapp']) {
    assert.ok(ctx.ds.sceneFor(loaded, network), network);
    assert.deepEqual(plain(ctx.normalizeScene(loaded.scenes[network]).issues), []);
  }
  assert.deepEqual(plain(loaded.scenes.instagram.layers.map(layer => layer.id)), plain(d.scenes.instagram.layers.map(layer => layer.id)));
  assert.equal(loaded.scenes.instagram.palette.primary, d.scenes.instagram.palette.primary);
  // Volver a guardar lo recuperado no cambia nada: las URLs firmadas vuelven a ser las mismas referencias.
  const before = JSON.stringify(ctx.supabase.rows.get(d.id).design);
  await ctx.storage.put('history', [loaded]);
  assert.equal(JSON.stringify(ctx.supabase.rows.get(d.id).design), before);
});

test('legacy designs are stored and recovered exactly as before', async () => {
  const ctx = setup();
  const old = { ...ctx.studio.newDesign(ctx.studio.emptyBrand), id: 'legacy', title: 'Pan', images: [jpg] };
  delete old.scenes;
  await ctx.storage.put('history', [old]);
  const stored = ctx.supabase.rows.get('legacy').design;
  assert.ok(!('scenes' in stored));
  assert.ok(stored.images[0].startsWith('clic-media://'));
  const [loaded] = await ctx.storage.get('history');
  assert.ok(!('scenes' in loaded));
  const expected = plain({ ...old, images: loaded.images });
  assert.deepEqual(plain(loaded), expected);
});

test('unsafe or invalid scene content never reaches the database', async () => {
  const ctx = setup();
  const d = designWithScenes(ctx);
  const tampered = plain(d);
  tampered.scenes.instagram.layers.push({ id: 'evil', type: 'image', role: 'photo', src: 'javascript:alert(1)' });
  tampered.scenes.instagram.layers.find(layer => layer.bind?.field === 'price').text = 'S/ 1 (copia vieja)';
  tampered.scenes.whatsapp = { version: 99 };
  await ctx.storage.put('history', [tampered]);
  const stored = ctx.supabase.rows.get(d.id).design;
  assert.ok(!JSON.stringify(stored).includes('javascript:'));
  assert.ok(!JSON.stringify(stored).includes('copia vieja'));
  assert.deepEqual(Object.keys(stored.scenes).sort(), ['facebook', 'instagram']);
});

test('draft with scenes survives the local store and re-signs expired URLs', async () => {
  const ctx = setup();
  const d = designWithScenes(ctx);
  await ctx.storage.put('history', [d]);
  const [loaded] = await ctx.storage.get('history');
  await ctx.storage.put('draft', loaded);
  const raw = [...ctx.idb.data.values()][0];
  assert.ok(imageSources(raw).every(src => src.includes('token=signed')), 'the draft keeps what was on screen');
  const draft = await ctx.storage.get('draft');
  assert.ok(imageSources(draft).every(src => src.startsWith(`${SUPABASE_URL}/storage/v1/object/sign/media/`)));
  assert.ok(ctx.ds.sceneFor(draft, 'whatsapp'));
  assert.equal(draft.title, 'Taza artesanal');
});

test('duplicated designs with scenes are saved as independent rows', async () => {
  const ctx = setup();
  const d = designWithScenes(ctx);
  const copy = ctx.studio.duplicateDesign(d);
  await ctx.storage.put('history', [copy, d]);
  assert.equal(ctx.supabase.rows.size, 2);
  const [first, second] = [ctx.supabase.rows.get(copy.id).design, ctx.supabase.rows.get(d.id).design];
  assert.deepEqual(first.scenes, second.scenes);
  assert.equal(first.title, 'Taza artesanal · copia');
});

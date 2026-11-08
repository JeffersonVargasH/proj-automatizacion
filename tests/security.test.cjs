const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const ts = require('typescript');
const { test } = require('node:test');
const plain = value => JSON.parse(JSON.stringify(value));
const load = (file, modules = {}) => {
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const api = {};
  vm.runInNewContext(compiled, { exports: api, require: name => modules[name] ?? {}, crypto: webcrypto, TextEncoder, Uint8Array, Blob, atob, Date });
  return api;
};
const media = load('lib/media.ts');
const { allow } = load('lib/rate-limit.ts');
const auth = load('lib/auth.ts');
const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261029000000_base.sql'), 'utf8');

const png = 'data:image/png;base64,iVBORw0KGgo=';

test('las imágenes se guardan como referencias y no como base64', async () => {
  const design = { id: 'p1', images: [png, 'https://cdn.n8n/x.png'], brand: { logo: png, name: 'Rosita' } };
  const stored = await media.mapStrings(design, media.isDataImage, async () => 'clic-media://u/b/hash.png');
  assert.deepEqual(plain(stored), { id: 'p1', images: ['clic-media://u/b/hash.png', 'https://cdn.n8n/x.png'], brand: { logo: 'clic-media://u/b/hash.png', name: 'Rosita' } });
  assert.equal(design.images[0], png, 'no modifica el original');
  assert.deepEqual(plain(media.collectStrings(stored, media.isMediaRef)), ['clic-media://u/b/hash.png']);
  assert.equal(media.extensionOf('data:image/jpeg;base64,xx'), 'jpg');
  assert.equal(media.isDataImage('data:image/svg+xml;base64,xx'), false, 'SVG no se acepta: puede llevar scripts');
});

test('una URL firmada de nuestro bucket vuelve a su referencia; otras URLs no', () => {
  const base = 'https://abc.supabase.co';
  const signed = `${base}/storage/v1/object/sign/media/u1/b1/f%C3%A1.png?token=xyz`;
  assert.equal(media.refFromSignedUrl(signed, base, 'media'), 'clic-media://u1/b1/fá.png');
  assert.equal(media.refFromSignedUrl('https://evil.com/storage/v1/object/sign/media/u1/x.png', base, 'media'), null);
  assert.equal(media.refFromSignedUrl(`${base}/storage/v1/object/sign/otro/u1/x.png`, base, 'media'), null);
});

test('solo se suben las publicaciones que cambiaron y se borran las que ya no están', () => {
  const saved = new Map([['a', '{"v":1}'], ['b', '{"v":1}'], ['c', '{"v":1}']]);
  const diff = media.diffRows(saved, [{ id: 'a', json: '{"v":1}' }, { id: 'b', json: '{"v":2}' }, { id: 'd', json: '{}' }]);
  assert.deepEqual(plain(diff), { upserts: ['b', 'd'], deletes: ['c'] });
});

test('el límite por usuario corta al superar el máximo y se libera con el tiempo', () => {
  const t = 1_000_000;
  for (let i = 0; i < 3; i++) assert.equal(allow('copy:u1', 3, 60_000, t + i), true);
  assert.equal(allow('copy:u1', 3, 60_000, t + 10), false);
  assert.equal(allow('copy:u2', 3, 60_000, t + 10), true, 'otro usuario no se ve afectado');
  assert.equal(allow('copy:u1', 3, 60_000, t + 60_001), true);
});

test('contraseñas y mensajes de error de Auth en español', () => {
  assert.match(auth.passwordProblem('abc'), /8 caracteres/);
  assert.match(auth.passwordProblem('solamenteletras'), /letras y números/);
  assert.equal(auth.passwordProblem('clave2026segura'), '');
  assert.equal(auth.authMessage('Invalid login credentials'), 'Correo o contraseña incorrectos.');
  assert.match(auth.authMessage('User already registered'), /ya tiene una cuenta/);
  assert.match(auth.authMessage('Email not confirmed'), /Confirma tu correo/);
});

test('la auditoría se describe en lenguaje claro', () => {
  assert.equal(auth.describeActivity({ action: 'insert', entity: 'publications', details: { title: 'Pan de yema' } }), 'Creó publicación «Pan de yema»');
  assert.equal(auth.describeActivity({ action: 'update', entity: 'profiles', details: { role: 'entrepreneur', status: 'suspended' } }), 'Actualizó cuenta (emprendedor, suspendida)');
});

test('la migración activa RLS en todas las tablas y protege rol, estado y Storage', () => {
  for (const table of ['profiles', 'businesses', 'publications', 'activity_log']) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(migration, /revoke all on public\.profiles, public\.businesses, public\.publications, public\.activity_log from anon/);
  assert.match(migration, /new\.role := old\.role;/, 'un usuario no puede volverse admin');
  assert.match(migration, /values \('media', 'media', false/, 'bucket privado');
  assert.doesNotMatch(migration, /on public\.activity_log for (insert|update|delete)/, 'la auditoría no se puede escribir ni borrar desde el cliente');
  for (const fn of migration.matchAll(/create function public\.(\w+)[\s\S]*?\$\$;?/g)) {
    if (/security definer/.test(fn[0])) assert.match(fn[0], /set search_path = ''/, `${fn[1]} fija search_path`);
  }
});

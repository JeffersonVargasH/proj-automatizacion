const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const ts = require('typescript');
const { test } = require('node:test');
const plain = value => JSON.parse(JSON.stringify(value));
const load = (file, modules = {}) => {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib', file), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const api = {};
  vm.runInNewContext(compiled, { exports: api, require: name => modules[name], crypto: webcrypto, Date });
  return api;
};
const studio = load('studio.ts');
const { copyRequest, copyMessages, sanitizeCopy, copyLimits, availableProviders } = load('copy.ts', { './studio': studio });

test('Groq goes first, Grok is the fallback, and only providers with a key are used', () => {
  assert.deepEqual(plain(availableProviders({}).map(p => p.id)), []);
  assert.deepEqual(plain(availableProviders({ XAI_API_KEY: 'x' }).map(p => p.id)), ['xai']);
  const both = availableProviders({ GROQ_API_KEY: 'g', XAI_API_KEY: 'x' });
  assert.deepEqual(plain(both.map(p => p.id)), ['groq', 'xai']);
  assert.equal(both[0].model, 'openai/gpt-oss-120b');
  assert.equal(both[0].url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.deepEqual(plain(availableProviders({ GROQ_API_KEY: 'g', XAI_API_KEY: 'x', COPY_PROVIDER: 'xai' }).map(p => p.id)), ['xai', 'groq']);
  assert.equal(availableProviders({ GROQ_API_KEY: 'g', GROQ_MODEL: 'openai/gpt-oss-20b' })[0].model, 'openai/gpt-oss-20b');
});

const design = () => {
  const d = studio.newDesign({ ...studio.emptyBrand, name: 'Taller Luna', instagram: '@tallerluna', preferences: { ...studio.emptyBrand.preferences, tone: 'Juvenil', hashtags: '#HechoAMano' } });
  Object.assign(d, { product: 'Jarrón artesanal', description: 'Cerámica pintada a mano', price: 'S/ 45', objective: 'Promocionar una oferta' });
  return d;
};

test('the copy request carries product facts but never the photos', () => {
  const input = copyRequest(design(), 'versión anterior');
  assert.equal(input.product, 'Jarrón artesanal');
  assert.equal(input.intent, 'Promocionar una oferta');
  assert.equal(input.tone, 'Juvenil');
  assert.equal(input.brandHashtags, '#HechoAMano');
  assert.equal(input.avoid, 'versión anterior');
  assert.ok(!JSON.stringify(input).includes('data:image'));
});
test('the prompt forbids invented data and passes tone, intent and facts', () => {
  const [system, user] = copyMessages(copyRequest(design()));
  assert.match(system.content, /nunca inventes datos/);
  assert.match(system.content, /instagram \(entre 150 y 220 palabras/);
  assert.match(system.content, /whatsapp \(30 a 60 palabras\)/);
  assert.match(user.content, /expresiones actuales/);
  assert.match(user.content, /Promocionar una oferta/);
  assert.match(user.content, /S\/ 45/);
});
const output = extra => ({ title: '"' + 'Hecho a mano para tu casa '.repeat(5) + '"', body: '**Único** y pintado a mano.', cta: 'Pídelo hoy', instagram: '¿Buscas algo único? ✨\n\n\n\nLlévate tu jarrón.\n#Jarron #Otro', facebook: 'Ideal para tu sala.', whatsapp: 'Jarrón a S/ 45. Escríbeme 📲', hashtags: ['Ceramica', '#decoracion', 'ceramica', 'Lima', 'Barranco'], ...extra });
test('model output is trimmed to the design limits and keeps brand hashtags', () => {
  const copy = sanitizeCopy(output(), { brandHashtags: '#HechoAMano' });
  assert.ok(copy.title.length <= copyLimits.title + 1);
  assert.ok(!copy.title.startsWith('"'));
  assert.equal(copy.body, 'Único y pintado a mano.');
  assert.equal(copy.hashtags, '#HechoAMano #Ceramica #decoracion #ceramica #Lima #Barranco');
});
test('each network gets its own text: Instagram with all hashtags, Facebook with three, WhatsApp with none', () => {
  const { caption, captions, hashtags } = sanitizeCopy(output(), { brandHashtags: '#HechoAMano' });
  assert.equal(captions.instagram, `¿Buscas algo único? ✨\n\nLlévate tu jarrón.\n\n${hashtags}`);
  assert.equal(caption, captions.instagram);
  assert.equal(captions.facebook, 'Ideal para tu sala.\n\n#HechoAMano #Ceramica #decoracion');
  assert.equal(captions.whatsapp, 'Jarrón a S/ 45. Escríbeme 📲');
});
test('incomplete model output is rejected so the template stays', () => {
  assert.equal(sanitizeCopy({ title: '', cta: 'Pide' }, { brandHashtags: '' }), null);
  assert.equal(sanitizeCopy(output({ instagram: '' }), { brandHashtags: '' }), null);
  assert.equal(sanitizeCopy('texto suelto', { brandHashtags: '' }), null);
});

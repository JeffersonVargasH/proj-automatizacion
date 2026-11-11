const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/studio-contract.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const api = {};
vm.runInNewContext(compiled, { exports: api });
const { validateGenerationRequest, validateTicketId } = api;

const validRequest = {
  requestId: 'request-1',
  product: { name: 'Taza artesanal', images: ['data:image/png;base64,reference'] },
  content: { format: 'instagram' },
};

test('generation contract accepts the minimum valid request', () => {
  const result = validateGenerationRequest(validRequest);
  assert.equal(result.ok, true);
  assert.equal(result.payload.product.images.length, 1);
});

test('generation contract rejects missing product images and format', () => {
  assert.equal(validateGenerationRequest({ ...validRequest, product: { name: 'Taza', images: [] } }).ok, false);
  assert.equal(validateGenerationRequest({ ...validRequest, content: {} }).ok, false);
});

test('ticket validation trims values and rejects oversized input', () => {
  assert.equal(validateTicketId('  ticket-1  '), 'ticket-1');
  assert.equal(validateTicketId(''), null);
  assert.equal(validateTicketId('x'.repeat(161)), null);
});

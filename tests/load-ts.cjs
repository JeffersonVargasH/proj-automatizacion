// Carga un módulo TypeScript de src/ para probarlo con node --test, sin compilar el proyecto.
// Resuelve los imports relativos entre archivos .ts; cualquier otro import se rechaza para
// garantizar que los módulos probados no dependen del navegador ni de librerías externas
// (los imports solo de tipos desaparecen al transpilar). `globals` permite inyectar dobles de prueba
// como `process.env`, `indexedDB` o `Blob`.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function loadTs(relativePath, { globals = {}, cache = new Map() } = {}) {
  const file = path.resolve(root, relativePath);
  if (cache.has(file)) return cache.get(file).exports;
  const loaded = { exports: {} };
  cache.set(file, loaded);
  const source = fs.readFileSync(file, 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: file });
  const localRequire = specifier => {
    if (!specifier.startsWith('.')) throw new Error(`${relativePath} importa «${specifier}»: solo se admiten módulos locales.`);
    const target = path.relative(root, path.resolve(path.dirname(file), specifier + '.ts'));
    return loadTs(target, { globals, cache });
  };
  vm.runInNewContext(outputText, { crypto: webcrypto, Date, Math, JSON, ...globals, module: loaded, exports: loaded.exports, require: localRequire }, { filename: file });
  return loaded.exports;
}

module.exports = { loadTs };

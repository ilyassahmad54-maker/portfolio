// Local tooling/test loader; TypeScript remains the single validator implementation.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function loadModule(file, overrides = {}, cache = new Map()) {
  const filename = path.resolve(file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loadedModule = new Module(filename);
  cache.set(filename, loadedModule);
  loadedModule.filename = filename;
  loadedModule.paths = Module._nodeModulePaths(path.dirname(filename));
  const nativeRequire = loadedModule.require.bind(loadedModule);
  loadedModule.require = name => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    const target = name.startsWith('.') ? path.resolve(path.dirname(filename), name) : null;
    if (target && fs.existsSync(`${target}.ts`)) return loadModule(`${target}.ts`, overrides, cache);
    return nativeRequire(name);
  };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  loadedModule._compile(code, filename);
  return loadedModule.exports;
}
module.exports = { loadModule };

import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {resolve} from 'node:path';
import ts from 'typescript';
export function loadServerModule(file) {
 const require=createRequire(resolve('package.json')),cache=new Map();
 function load(path){const filename=resolve(path);if(cache.has(filename))return cache.get(filename).exports;
  const module=new Module(filename);cache.set(filename,module);
  module.require=name=>name.startsWith('.')?load(resolve(filename,'..',name.replace(/\.js$/,'.ts'))):require(name);
  module._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);return module.exports;
 }
 return load(file);
}

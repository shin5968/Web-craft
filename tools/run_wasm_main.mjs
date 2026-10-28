import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const path=process.argv[2];
if(!path)throw new Error('Wasm path required');
vm.runInThisContext(readFileSync(path+'-runtime.js','utf8'));
const app=await globalThis.TeaVM.wasmGC.load(new Uint8Array(readFileSync(path)));
await app.exports.main([]);

if(process.argv[3]==='--registry-result'){
  if(typeof app.exports.registryResult!=='function')throw new Error('Registry result export missing');
  const result=app.exports.registryResult();
  if(!result)throw new Error('Registry bootstrap did not complete');
  console.log('WEBCRAFT_REGISTRY_OK '+result);
}

import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const path=process.argv[2];
if(!path)throw new Error('Wasm path required');
vm.runInThisContext(readFileSync(path+'-runtime.js','utf8'));
const app=await globalThis.TeaVM.wasmGC.load(new Uint8Array(readFileSync(path)));
await app.exports.main([]);

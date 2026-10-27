import {readFileSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {verifyBitStorage} from '../web/bit-storage-check.mjs';

const root=new URL('../web/minecraft-smoke/',import.meta.url);
const runtime=new URL('classes.wasm-runtime.js',root);
vm.runInThisContext(readFileSync(runtime,'utf8'),{filename:fileURLToPath(runtime)});
const app=await globalThis.TeaVM.wasmGC.load(new Uint8Array(readFileSync(new URL('classes.wasm',root))));
app.exports.main([]);
const message=verifyBitStorage(app.exports);
console.log(message);
const provenance=JSON.parse(readFileSync(new URL('provenance.json',root),'utf8'));
writeFileSync(new URL('bit-storage-result.json',root),JSON.stringify({status:'passed',message,
  provenance,node:process.version,compiler:'TeaVM 0.16.0',
  scope:'Original SimpleBitStorage operations; synthetic block palette indices, not a loaded chunk or world.'},null,2)+'\n');

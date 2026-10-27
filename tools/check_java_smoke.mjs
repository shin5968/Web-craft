import {readFileSync, writeFileSync} from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {verifyJava} from '../web/java-smoke-check.mjs';

const runtime = new URL('../web/java-smoke/classes.wasm-runtime.js', import.meta.url);
vm.runInThisContext(readFileSync(runtime, 'utf8'), {filename:fileURLToPath(runtime)});
const app = await globalThis.TeaVM.wasmGC.load(
  new Uint8Array(readFileSync(new URL('../web/java-smoke/classes.wasm', import.meta.url)))
);
app.exports.main([]);
const message = verifyJava(app.exports);
console.log(message);
const report = {status:'passed',message,javaClassMajor:69,compiler:'TeaVM 0.16.0',
  node:process.version,scope:'Original small Java program compiled to Wasm GC. Not Minecraft or complete Java 25 support.'};
writeFileSync(new URL('../web/java-smoke/build-result.json', import.meta.url), JSON.stringify(report,null,2)+'\n');

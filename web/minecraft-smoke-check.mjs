export function verifyMinecraft(exports) {
  let checked=0;
  for (const size of [0,1,7,64,8191,8192,8193]) {
    let expected=0;
    for (let i=0;i<size;i++) expected=(Math.imul(expected,31)+((Math.imul(i,17)+3)&255))|0;
    for (const capacity of [1,7,64]) {
      for (const method of ['readChecksum','bulkChecksum']) {
        const actual=exports[method](size,capacity);
        if (actual!==expected) throw new Error(`${method}(${size},${capacity}): ${actual} != ${expected}`);
        checked++;
      }
    }
  }
  if (exports.skipProbe()!==1) throw new Error('Minecraft stream skip/available mismatch');
  return `Minecraft 26.3 원본 스트림: 읽기 ${checked}건·건너뛰기/잔여 길이 검사 성공`;
}

let loaderPromise;
let appPromise;
export async function loadMinecraftSmoke() {
  if (!appPromise) {
    appPromise=instantiateMinecraftSmoke().catch(error=>{appPromise=undefined;throw error;});
  }
  return appPromise;
}

export async function runMinecraftSmoke() {
  const app=await loadMinecraftSmoke();
  return verifyMinecraft(app.exports);
}

async function instantiateMinecraftSmoke() {
  if (!loaderPromise) {
    loaderPromise = new Promise((resolve,reject) => {
      const script=document.createElement('script');
      script.src=new URL('./minecraft-smoke/classes.wasm-runtime.js',import.meta.url).href;
      script.onload=()=>resolve(globalThis.TeaVM.wasmGC.load);
      script.onerror=()=>{script.remove();reject(new Error('Minecraft 검사 빌드 없음: Codespaces에서 bash tools/start_codespaces.sh를 다시 실행하세요.'));};
      document.head.append(script);
    }).catch(error=>{loaderPromise=undefined;throw error;});
  }
  const load=await loaderPromise;
  const app=await load(new URL('./minecraft-smoke/classes.wasm',import.meta.url).href);
  app.exports.main([]);
  return app;
}

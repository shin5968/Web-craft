export function verifyMinecraft(exports) {
  const cases = [
    [0,0,0,0], [255,255,255,255], [255,18,52,86], [128,255,0,127],
    [1,2,3,4], [0,255,128,64], [127,128,129,130], [254,1,254,1]
  ];
  for (const channels of cases) {
    const [a,r,g,b] = channels;
    const expected = (a << 24) | (r << 16) | (g << 8) | b;
    const actual = exports.pack(a,r,g,b);
    if (actual !== expected) throw new Error(`ARGB pack mismatch: ${actual} != ${expected}`);
    for (let i=0;i<4;i++) {
      if (exports.component(actual,i) !== channels[i]) throw new Error(`ARGB component mismatch: ${i}`);
    }
  }
  return 'Minecraft 26.3 원본 ARGB: 색상 합성 8건·채널 추출 32건 성공';
}

let loaderPromise;
export async function runMinecraftSmoke() {
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
  return verifyMinecraft(app.exports);
}

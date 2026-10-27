export function verifyJava(exports) {
  let checked = 0;
  for (const seed of [0, 1, 42, -1, 2147483647, -2147483648]) {
    let expected = 0;
    for (let i = 0; i < 4096; i++) expected += ((Math.imul(i, 31) + seed) ^ (i >>> 2)) & 255;
    const actual = exports.checksum(seed);
    if (actual !== expected) throw new Error(`Java checksum(${seed}): ${actual}, expected ${expected}`);
    checked++;
  }
  if (exports.exceptionCheck(-1) !== -42 || exports.exceptionCheck(7) !== 7) {
    throw new Error('Java 예외 처리 결과 불일치');
  }
  return `객체·배열 체크섬 ${checked}건 및 예외 처리 성공`;
}

let runtimePromise;
export async function runJavaSmoke() {
  if (!runtimePromise) {
    runtimePromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('./java-smoke/classes.wasm-runtime.js', import.meta.url).href;
      script.onload = resolve;
      script.onerror = () => { script.remove(); reject(new Error('Java 빌드 파일 없음: java-smoke-site artifact 전체를 배포하세요.')); };
      document.head.append(script);
    }).catch(error => { runtimePromise = undefined; throw error; });
  }
  await runtimePromise;
  const teavm = await globalThis.TeaVM.wasmGC.load(new URL('./java-smoke/classes.wasm', import.meta.url).href);
  teavm.exports.main([]);
  return verifyJava(teavm.exports);
}

// Minimal GC module: allocate struct { i32: 42 }, read its field, return 42.
export const gcModule = new Uint8Array([
  0,97,115,109,1,0,0,0,1,9,2,95,1,127,0,96,0,1,127,
  3,2,1,1,7,7,1,3,114,117,110,0,0,
  10,13,1,11,0,65,42,251,0,0,251,2,0,0,11
]);

export async function checkGC() {
  if (typeof WebAssembly === 'undefined') throw new Error('WebAssembly 미지원');
  const {instance} = await WebAssembly.instantiate(gcModule);
  if (instance.exports.run() !== 42) throw new Error('GC 실행 결과 불일치');
  return '구조체 생성·필드 읽기 성공 (42)';
}

export async function checkSharedMemory() {
  if (!globalThis.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') {
    return {ok: false, message: '미검증: 페이지 격리·SharedArrayBuffer 필요'};
  }
  // Shared memory definition, min/max 1 page; no imports or executable code.
  await WebAssembly.instantiate(new Uint8Array([
    0,97,115,109,1,0,0,0,5,4,1,3,1,1
  ]));
  const memory = new WebAssembly.Memory({initial:1, maximum:1, shared:true});
  const cells = new Int32Array(memory.buffer);
  const worker = new Worker(new URL('./shared-probe-worker.js', import.meta.url));
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Worker 응답 시간 초과')), 5000);
      worker.onmessage = event => {
        clearTimeout(timer);
        if (event.data === 42 && Atomics.load(cells, 0) === 42) resolve();
        else reject(new Error('공유 메모리 결과 불일치'));
      };
      worker.onerror = event => { clearTimeout(timer); reject(new Error(event.message || 'Worker error')); };
      try { worker.postMessage(memory.buffer); }
      catch (error) { clearTimeout(timer); reject(error); }
    });
    return {ok:true, message:'Wasm 공유 메모리·Worker 원자적 쓰기 확인 (42)'};
  } finally { worker.terminate(); }
}

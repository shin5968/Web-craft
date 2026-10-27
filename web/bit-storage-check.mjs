export function verifyBitStorage(api) {
  let scenarios=0, comparisons=0;
  function equal(actual,expected,label) {
    comparisons++;
    if (actual!==expected) throw new Error(`${label}: ${actual} != ${expected}`);
  }
  for (const bits of [1,4,5,8,9,13,16,31]) {
    const max=2**bits-1;
    const perWord=Math.floor(64/bits);
    for (const size of [1,17,4096]) {
      api.storageInit(bits,size);
      const reference=new Int32Array(size);
      equal(api.storageGet(0),0,'initial first');
      equal(api.storageGet(size-1),0,'initial last');
      equal(api.storageWordCount(),Math.ceil(size/perWord),'raw word count');
      let seed=0x12345678;
      for (let i=0;i<size;i++) {
        seed=(Math.imul(seed,1664525)+1013904223)|0;
        reference[i]=seed&max;
        api.storageSet(i,reference[i]);
      }
      for (let i=0;i<size;i++) equal(api.storageGet(i),reference[i],`get ${bits}/${size}/${i}`);
      // Independent BigInt oracle verifies the actual 64-bit packed representation.
      for (let word=0;word<Math.ceil(size/perWord);word++) {
        let expected=0n;
        for (let j=0;j<perWord;j++) {
          const index=word*perWord+j;
          if (index<size) expected|=BigInt(reference[index])<<BigInt(j*bits);
        }
        const actual=BigInt(api.storageWordLow(word)>>>0)|(BigInt(api.storageWordHigh(word)>>>0)<<32n);
        equal(actual,expected,`raw ${bits}/${size}/${word}`);
      }
      for (const i of new Set([0,1,perWord-1,perWord,size-1].filter(i=>i<size))) {
        const next=reference[i]^max;
        equal(api.storageSwap(i,next),reference[i],'swap old value');
        reference[i]=next;
        equal(api.storageGet(i),next,'swap new value');
      }
      api.storageCopy();
      const old=reference[size-1];
      reference[size-1]=old^max;
      api.storageSet(size-1,reference[size-1]);
      equal(api.storageCopyGet(size-1),old,'independent copy');
      api.storageReload();
      for (let i=0;i<size;i++) equal(api.storageGet(i),reference[i],'raw reload');
      api.storageFill(max);
      for (let i=0;i<size;i++) equal(api.storageGet(i),max,'fill');
      for (const invalid of [()=>api.storageGet(-1),()=>api.storageGet(size),()=>api.storageSet(0,-1)]) {
        let threw=false;
        try { invalid(); } catch { threw=true; }
        equal(threw,true,'bounds validation');
      }
      scenarios++;
    }
  }
  return `Minecraft 원본 비트 저장소: ${scenarios}개 조합·${comparisons}회 비교 성공`;
}

const MAX_NBT=32*1024*1024;

export function readNBT(input) {
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  if(bytes.length>MAX_NBT)throw new Error('NBT가 32 MiB 제한을 초과합니다.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let offset=0,tags=0;
  const need=n=>{if(n<0||offset+n>bytes.length)throw new Error('잘리거나 잘못된 NBT 데이터입니다.');};
  const u8=()=>{need(1);return view.getUint8(offset++);};
  const number=(size,method)=>{need(size);const value=view[method](offset,false);offset+=size;return value;};
  const length=()=>{const n=number(4,'getInt32');if(n<0||n>1048576)throw new Error('잘못되거나 너무 큰 NBT 배열입니다.');return n;};
  function string() {
    const n=number(2,'getUint16');need(n);const end=offset+n,units=[];
    // Java NBT strings use modified UTF-8, including UTF-16 surrogate code units.
    while(offset<end) {
      const a=u8();
      if(a>0&&a<128){units.push(a);continue;}
      if((a&224)===192) {
        if(offset>=end)throw new Error('잘린 NBT 문자열입니다.');
        const b=u8();if((b&192)!==128)throw new Error('잘못된 NBT 문자열입니다.');
        const value=((a&31)<<6)|(b&63);
        if(value<128&&value!==0)throw new Error('잘못된 NBT 문자열 인코딩입니다.');
        units.push(value);continue;
      }
      if((a&240)===224) {
        if(offset+2>end)throw new Error('잘린 NBT 문자열입니다.');
        const b=u8(),c=u8();if((b&192)!==128||(c&192)!==128)throw new Error('잘못된 NBT 문자열입니다.');
        const value=((a&15)<<12)|((b&63)<<6)|(c&63);
        if(value<2048)throw new Error('잘못된 NBT 문자열 인코딩입니다.');
        units.push(value);continue;
      }
      throw new Error('지원하지 않는 NBT 문자열 인코딩입니다.');
    }
    let result='';for(let i=0;i<units.length;i+=8192)result+=String.fromCharCode(...units.slice(i,i+8192));
    return result;
  }
  function payload(type,depth) {
    if(++tags>200000||depth>64)throw new Error('NBT 항목 수 또는 깊이 제한을 초과합니다.');
    switch(type) {
      case 1:return number(1,'getInt8');
      case 2:return number(2,'getInt16');
      case 3:return number(4,'getInt32');
      case 4:return number(8,'getBigInt64');
      case 5:return number(4,'getFloat32');
      case 6:return number(8,'getFloat64');
      case 7:{const n=length();need(n);const value=bytes.slice(offset,offset+n);offset+=n;return value;}
      case 8:return string();
      case 9:{const item=u8(),n=length();if(item>12||(!item&&n))throw new Error('잘못된 NBT 리스트입니다.');return Array.from({length:n},()=>payload(item,depth+1));}
      case 10:{
        const result=Object.create(null);
        while(true){const item=u8();if(item===0)break;const name=string();if(Object.hasOwn(result,name))throw new Error('중복 NBT 키입니다.');result[name]=payload(item,depth+1);}
        return result;
      }
      case 11:{const n=length();need(n*4);return Int32Array.from({length:n},()=>number(4,'getInt32'));}
      case 12:{const n=length();need(n*8);return Array.from({length:n},()=>number(8,'getBigInt64'));}
      default:throw new Error(`지원하지 않는 NBT 태그: ${type}`);
    }
  }
  if(u8()!==10)throw new Error('이 파일은 이름이 있는 Java NBT 루트 compound가 아닙니다.');
  const name=string(),root=payload(10,0);
  if(offset!==bytes.length)throw new Error('NBT 뒤에 예상하지 못한 데이터가 있습니다.');
  return {name,root};
}

async function inflate(bytes,format) {
  if(typeof DecompressionStream==='undefined')throw new Error('브라우저가 압축 해제를 지원하지 않습니다.');
  const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format)).getReader();
  const chunks=[];let size=0;
  try {
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;
      if(size>MAX_NBT){await reader.cancel();throw new Error('압축 해제된 NBT가 32 MiB 제한을 초과합니다.');}chunks.push(value);}
  } finally {reader.releaseLock();}
  const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
}

export function regionEntries(bytes) {
  if(bytes.length<8192)throw new Error('MCA 헤더가 잘렸습니다.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),entries=[];
  for(let slot=0;slot<1024;slot++) {
    const location=view.getUint32(slot*4,false),sector=location>>>8,count=location&255;
    if(!sector&&!count)continue;
    if(sector<2||!count||(sector+count)*4096>bytes.length)throw new Error(`잘못된 MCA 위치 항목: ${slot}`);
    entries.push({slot,x:slot%32,z:Math.floor(slot/32),offset:sector*4096,sectors:count});
  }
  return entries;
}

export async function readRegionChunk(bytes,entry) {
  const offset=entry.offset;
  if(offset<8192||offset+5>bytes.length)throw new Error('잘못된 청크 위치입니다.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const length=view.getUint32(offset,false),compression=bytes[offset+4];
  if(length<1||length+4>entry.sectors*4096||offset+length+4>bytes.length)throw new Error('잘린 MCA 청크입니다.');
  if(compression&128)throw new Error('외부 .mcc 파일 청크는 아직 지원하지 않습니다.');
  let payload=bytes.subarray(offset+5,offset+4+length);
  if(compression===1)payload=await inflate(payload,'gzip');
  else if(compression===2)payload=await inflate(payload,'deflate');
  else if(compression!==3)throw new Error(`청크 압축 ${compression}은 아직 지원하지 않습니다. LZ4 청크도 포함됩니다.`);
  return readNBT(payload).root;
}

export async function readStandaloneNBT(bytes) {
  if(bytes[0]===31&&bytes[1]===139)bytes=await inflate(bytes,'gzip');
  else if(bytes[0]===120)bytes=await inflate(bytes,'deflate');
  return readNBT(bytes).root;
}

export function chunkSections(root) {
  const chunk=root.Level||root;
  const sections=chunk.sections||chunk.Sections;
  if(!Array.isArray(sections))throw new Error('청크 sections가 없습니다. level.dat/구조물 NBT는 지원하지 않습니다.');
  const result=sections.filter(section=>section?.block_states?.palette);
  if(!result.length)throw new Error('현대 형식의 block_states.palette가 없습니다. 구형 BlockStates 형식은 아직 지원하지 않습니다.');
  return result.map(section=>{const y=Number(section.Y);if(!Number.isInteger(y))throw new Error('섹션 Y 좌표가 잘못됐습니다.');return {section,y};}).sort((a,b)=>a.y-b.y);
}

function paletteState(entry) {
  if(typeof entry==='string')return {name:entry,properties:Object.create(null)};
  if(entry&&typeof entry==='object') {
    if(typeof entry['']==='string')return paletteState(entry['']);
    const name=entry.id??entry.Name,properties=entry.properties??entry.Properties??Object.create(null);
    if(typeof name==='string'&&properties&&typeof properties==='object'&&!Array.isArray(properties)&&Object.values(properties).every(value=>typeof value==='string'))return {name,properties};
  }
  throw new Error('알 수 없는 블록 팔레트 형식입니다.');
}

export function blockMaterial(name) {
  if(/(?:grass_block|leaves|moss|grass|fern|vine)$/.test(name))return {color:[.3,.68,.32],sideColor:name.endsWith('grass_block')?[.48,.29,.16]:undefined};
  if(/(?:sand|sandstone)$/.test(name))return {color:[.86,.76,.48]};
  if(/(?:dirt|mud|farmland|podzol|log|wood|planks)$/.test(name))return {color:[.48,.29,.16]};
  if(/(?:water|ice)$/.test(name))return {color:[.18,.45,.8]};
  if(/(?:snow|quartz)$/.test(name))return {color:[.9,.93,.96]};
  if(name.endsWith('lava'))return {color:[1,.35,.06]};
  return {color:[.48,.53,.59]};
}

export function decodeSection(section,api) {
  const raw=section?.block_states?.palette;
  if(!Array.isArray(raw)||!raw.length||raw.length>4096)throw new Error('잘못된 블록 팔레트 크기입니다.');
  const palette=raw.map(paletteState),bits=Math.max(4,Math.ceil(Math.log2(palette.length)));
  const words=section.block_states.data;
  const expected=new Int32Array(4096);
  if(palette.length===1&&(words===undefined||words.length===0))api.storageInit(4,4096);
  else {
    const perWord=Math.floor(64/bits),count=Math.ceil(4096/perWord);
    if(!Array.isArray(words)||words.length!==count||!words.every(v=>typeof v==='bigint'))throw new Error(`블록 데이터 길이가 맞지 않습니다 (${count}개 long 필요).`);
    if(typeof api.storageRawBegin!=='function')throw new Error('새 Java 빌드가 필요합니다. Codespaces에서 bash tools/start_codespaces.sh를 다시 실행하세요.');
    api.storageRawBegin(bits,4096,words.length);
    words.forEach((word,i)=>api.storageRawWord(i,Number(BigInt.asIntN(32,word)),Number(BigInt.asIntN(32,word>>32n))));
    api.storageRawFinish();
    const mask=(1n<<BigInt(bits))-1n;
    for(let i=0;i<4096;i++)expected[i]=Number((words[Math.floor(i/perWord)]>>BigInt((i%perWord)*bits))&mask);
  }
  const values=new Int32Array(4096),materials=Object.create(null);
  palette.forEach((state,i)=>{materials[i+1]={...state,...blockMaterial(state.name),sourceIndex:i};});
  for(let i=0;i<4096;i++) {
    const index=api.storageGet(i);
    if(index!==expected[i]||index<0||index>=palette.length)throw new Error(`팔레트 인덱스 디코딩 실패: ${i}`);
    values[i]=['minecraft:air','minecraft:cave_air','minecraft:void_air'].includes(palette[index].name)?0:index+1;
  }
  return {values,palette:materials,sourcePalette:palette,sectionY:Number(section.Y),verified:4096};
}

// Synthetic test files, not copied game/world data.
import {deflateSync,gzipSync} from 'node:zlib';
import {terrainValues} from '../web/voxel-data.mjs';

const scalar=(size,method,value)=>{const b=Buffer.alloc(size);b[method](value);return b;};
const byte=v=>scalar(1,'writeInt8',v),int=v=>scalar(4,'writeInt32BE',v);
export function mutf(value) {
  const bytes=[];
  for(let i=0;i<value.length;i++) {
    const c=value.charCodeAt(i);
    if(c>0&&c<128)bytes.push(c);
    else if(c<2048)bytes.push(192|(c>>6),128|(c&63));
    else bytes.push(224|(c>>12),128|((c>>6)&63),128|(c&63));
  }
  return Buffer.concat([scalar(2,'writeUInt16BE',bytes.length),Buffer.from(bytes)]);
}
export function encodePayload(type,value) {
  switch(type) {
    case 1:return byte(value);
    case 2:return scalar(2,'writeInt16BE',value);
    case 3:return int(value);
    case 4:return scalar(8,'writeBigInt64BE',BigInt.asIntN(64,value));
    case 5:return scalar(4,'writeFloatBE',value);
    case 6:return scalar(8,'writeDoubleBE',value);
    case 7:return Buffer.concat([int(value.length),Buffer.from(value)]);
    case 8:return mutf(value);
    case 9:return Buffer.concat([byte(value.type),int(value.items.length),...value.items.map(item=>encodePayload(value.type,item))]);
    case 10:return Buffer.concat([...Object.entries(value).map(([name,{type,value}])=>Buffer.concat([byte(type),mutf(name),encodePayload(type,value)])),byte(0)]);
    case 11:return Buffer.concat([int(value.length),...value.map(int)]);
    case 12:return Buffer.concat([int(value.length),...value.map(v=>encodePayload(4,v))]);
    default:throw new Error('Bad fixture type');
  }
}
export const tag=(type,value)=>({type,value});
export function namedRoot(compound) {return Buffer.concat([byte(10),mutf(''),encodePayload(10,compound)]);}

export function fixtureSection(palette=[{'':'minecraft:air'},{id:'minecraft:grass_block',properties:{snowy:'false'}},{Name:'minecraft:dirt',Properties:{}},{id:'minecraft:stone'},{'':'minecraft:sand'}],indices=terrainValues(),y=-4) {
  const bits=Math.max(4,Math.ceil(Math.log2(palette.length))),perWord=Math.floor(64/bits);
  const words=Array.from({length:Math.ceil(4096/perWord)},()=>0n);
  for(let i=0;i<4096;i++)words[Math.floor(i/perWord)]|=BigInt(indices[i])<<BigInt((i%perWord)*bits);
  const stringList=palette.every(state=>typeof state==='string');
  const entries=stringList?palette:palette.map(state=>Object.fromEntries(Object.entries(typeof state==='string'?{'':state}:state).map(([key,value])=>[key,
    typeof value==='string'?tag(8,value):tag(10,Object.fromEntries(Object.entries(value).map(([k,v])=>[k,tag(8,v)])))])));
  const states={palette:tag(9,{type:stringList?8:10,items:entries})};
  if(palette.length>1)states.data=tag(12,words);
  return {Y:tag(1,y),block_states:tag(10,states)};
}
export function fixtureNBT(palette,indices,y) {
  return namedRoot({DataVersion:tag(3,5023),xPos:tag(3,0),zPos:tag(3,0),sections:tag(9,{type:10,items:[fixtureSection(palette,indices,y)]})});
}
export function fixtureColumnNBT() {
  return namedRoot({DataVersion:tag(3,5023),xPos:tag(3,0),zPos:tag(3,0),sections:tag(9,{type:10,items:[
    fixtureSection(['minecraft:stone'],new Int32Array(4096),-1),
    fixtureSection(['minecraft:air','minecraft:stone'],new Int32Array(4096).fill(1),0),
    fixtureSection(['minecraft:air'],new Int32Array(4096),1)
  ]})});
}

export function fixtureRegion(nbt=fixtureNBT(),compression=2) {
  const payload=compression===1?gzipSync(nbt):compression===2?deflateSync(nbt):nbt;
  const count=Math.ceil((payload.length+5)/4096),region=Buffer.alloc((2+count)*4096);
  region.writeUInt32BE((2<<8)|count,0);region.writeUInt32BE(payload.length+1,8192);region[8196]=compression;
  payload.copy(region,8197);return region;
}

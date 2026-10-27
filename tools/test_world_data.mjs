import assert from 'node:assert/strict';
import {gzipSync,deflateSync} from 'node:zlib';
import {mkdirSync,writeFileSync} from 'node:fs';
import {readNBT,regionEntries,readRegionChunk,readStandaloneNBT,chunkSections} from '../web/world-data.mjs';
import {fixtureNBT,fixtureRegion,namedRoot,tag} from './world-fixture.mjs';

const nbt=fixtureNBT();
assert.equal(readNBT(nbt).root.DataVersion,5023);
for(const compression of [1,2,3]) {
  const region=fixtureRegion(nbt,compression),entries=regionEntries(region);
  assert.equal(entries.length,1);
  const root=await readRegionChunk(region,entries[0]);
  const sections=chunkSections(root);
  assert.equal(sections[0].y,-4);
  assert.equal(sections[0].section.block_states.palette[1].id,'minecraft:grass_block');
  assert.equal(sections[0].section.block_states.data.length,256);
}
for(const bytes of [nbt,gzipSync(nbt),deflateSync(nbt)])assert.equal((await readStandaloneNBT(bytes)).DataVersion,5023);
const all=readNBT(namedRoot({
  b:tag(1,-128),s:tag(2,-300),i:tag(3,-42),l:tag(4,-9223372036854775808n),
  f:tag(5,1.5),d:tag(6,Math.PI),ba:tag(7,[0,128,255]),
  text:tag(8,'한글\0😀'),ia:tag(11,[-1,2]),la:tag(12,[-1n,1n]),
  empty:tag(9,{type:0,items:[]})
})).root;
assert.equal(all.text,'한글\0😀');assert.equal(all.l,-9223372036854775808n);
assert.deepEqual([...all.ba],[0,128,255]);assert.deepEqual([...all.ia],[-1,2]);assert.deepEqual(all.la,[-1n,1n]);
for(const bytes of [Buffer.alloc(0),nbt.subarray(0,nbt.length-1),Buffer.concat([nbt,Buffer.from([0])])])assert.throws(()=>readNBT(bytes));
assert.throws(()=>regionEntries(Buffer.alloc(10)));
const bad=fixtureRegion();bad.writeUInt32BE((999<<8)|1,0);assert.throws(()=>regionEntries(bad));
for(const type of [4,130]) {const region=fixtureRegion(nbt,3);region[8196]=type;await assert.rejects(()=>readRegionChunk(region,regionEntries(region)[0]));}
const invalid=fixtureRegion();invalid.writeUInt32BE(99999,8192);await assert.rejects(()=>readRegionChunk(invalid,regionEntries(invalid)[0]));
const deep={};let cursor=deep;for(let i=0;i<66;i++){cursor.n=tag(10,{});cursor=cursor.n.value;}
assert.throws(()=>readNBT(namedRoot(deep)));
assert.throws(()=>chunkSections({sections:[{block_states:{palette:['minecraft:stone']}}]}));
mkdirSync('reports',{recursive:true});writeFileSync('reports/world-fixture.mca',fixtureRegion());
console.log('NBT/MCA: all tag types, modified UTF-8, gzip/zlib/raw chunks, negative section Y, truncation and unsupported formats passed');

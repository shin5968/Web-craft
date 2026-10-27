import assert from 'node:assert/strict';
import {meshColumn,columnDisplaySections} from '../web/world-column.mjs';
import {fixtureRegion,fixtureColumnNBT} from './world-fixture.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const section=(y,filled=true)=>({sectionY:y,values:new Int32Array(4096).fill(filled?1:0),palette:{1:{name:'minecraft:stone',color:[.5,.5,.5]}}});
const adjacent=meshColumn([section(-1),section(0),section(1,false)]);
assert.equal(adjacent.blocks,8192);assert.equal(adjacent.faces,2560);
assert.equal(adjacent.sectionCount,3);assert.equal(adjacent.nonEmptySections,2);
assert.equal(adjacent.minY,-16);assert.equal(adjacent.maxY,15);assert.equal(adjacent.height,32);
assert.equal(adjacent.verifiedIndices,12288);
const gap=meshColumn([section(-1),section(1)]);assert.equal(gap.faces,3072);assert.equal(gap.height,48);
const empty=meshColumn([section(-4,false)]);assert.equal(empty.blocks,0);assert.equal(empty.faces,0);assert.equal(empty.minY,null);
assert.throws(()=>meshColumn([section(0),section(0)]));
assert.throws(()=>meshColumn([section(0)],100));
assert.ok(adjacent.vertices.every(Number.isFinite));
for(let i=1;i<adjacent.vertices.length;i+=6)assert.ok(adjacent.vertices[i]>=-16&&adjacent.vertices[i]<=16);
mkdirSync('reports',{recursive:true});writeFileSync('reports/column-fixture.mca',fixtureRegion(fixtureColumnNBT()));
console.log('Chunk column: vertical neighbor culling, negative Y, gaps, empty sections, coordinates and memory cap passed');

const wet=section(-4);wet.palette[2]={name:'minecraft:water',color:[0,0,1]};wet.values.fill(2,256);
const filtered=columnDisplaySections([wet],true);
assert.equal(filtered.hiddenWaterBlocks,3840);
assert.equal(meshColumn(filtered.display).blocks,256);
assert.equal(meshColumn(filtered.display).faces,576);
assert.equal(wet.values[256],2); // Source data and validation remain unchanged.
assert.equal(columnDisplaySections([wet]).display[0],wet);
const water=section(0);water.palette[1].name='minecraft:water';
assert.equal(meshColumn(columnDisplaySections([water],true).display).blocks,0);
console.log('Water visibility: source preserved, floor faces exposed, all-water column empty');

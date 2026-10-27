import assert from 'node:assert/strict';
import {SIDE,indexOf,meshVoxels,terrainValues} from '../web/voxel-data.mjs';

const empty=new Int32Array(SIDE**3);
assert.equal(meshVoxels(empty).faces,0);
const one=empty.slice();one[indexOf(1,1,1)]=1;
assert.equal(meshVoxels(one).faces,6);
one[indexOf(2,1,1)]=1;
assert.equal(meshVoxels(one).faces,10);
const solid=new Int32Array(SIDE**3).fill(3);
assert.equal(meshVoxels(solid).faces,6*SIDE**2);
assert.equal(new Set(Array.from({length:SIDE**3},(_,i)=>indexOf(i%16,Math.floor(i/256),Math.floor(i/16)%16))).size,SIDE**3);
for(const values of [one,solid,terrainValues()]) {
  const mesh=meshVoxels(values);
  assert.equal(mesh.vertices.length,mesh.faces*6*6);
  assert.ok(mesh.vertices.every(Number.isFinite));
  // Every triangle must face away from its containing solid voxel (CCW).
  for(let offset=0;offset<mesh.vertices.length;offset+=18) {
    const v=mesh.vertices;
    const a=[v[offset],v[offset+1],v[offset+2]];
    const b=[v[offset+6],v[offset+7],v[offset+8]];
    const c=[v[offset+12],v[offset+13],v[offset+14]];
    const u=b.map((x,i)=>x-a[i]),w=c.map((x,i)=>x-a[i]);
    const n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
    assert.equal(n.reduce((s,x)=>s+Math.abs(x),0),1);
    const center=a.map((x,i)=>(x+b[i]+c[i])/3);
    const inside=center.map((x,i)=>Math.floor(x-n[i]*.01+[8,5,8][i]));
    assert.notEqual(values[indexOf(...inside)],0);
  }
}
console.log('Voxel mesh: empty, single, adjacent, solid, terrain and outward winding passed');

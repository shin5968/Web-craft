import assert from 'node:assert/strict';
import {indexOf,meshVoxels} from '../web/voxel-data.mjs';
import {pickVoxel,screenRay,cameraBasis} from '../web/voxel-edit.mjs';
const values=new Int32Array(4096);values[indexOf(8,5,8)]=3;
for(let axis=0;axis<3;axis++)for(const sign of [-1,1]) {
  const origin=[.5,.5,.5],direction=[0,0,0],normal=[0,0,0];
  origin[axis]=sign<0?-4:5;direction[axis]=-sign;normal[axis]=sign;
  const hit=pickVoxel(values,origin,direction);
  assert.deepEqual([hit.x,hit.y,hit.z],[8,5,8]);assert.deepEqual(hit.normal,normal);
}
assert.equal(pickVoxel(values,[-4,2,2],[1,0,0]),null);
assert.equal(pickVoxel(values,[-4,.5,.5],[-1,0,0]),null);
values[indexOf(9,5,8)]=2;
assert.equal(pickVoxel(values,[-4,.5,.5],[1,0,0]).x,8);
const camera=cameraBasis(.75,.55,34),ray=screenRay(0,0,1.5,camera);
ray.direction.forEach((value,i)=>assert.ok(Math.abs(value-camera.forward[i])<1e-10));
assert.equal(meshVoxels(values).vertices.length,meshVoxels(values,indexOf(8,5,8)).vertices.length);
assert.notDeepEqual(meshVoxels(values).vertices,meshVoxels(values,indexOf(8,5,8)).vertices);
console.log('Voxel picking: all six normals, closest hit, misses, camera ray and highlight passed');

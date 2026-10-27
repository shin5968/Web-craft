import {SIDE,indexOf,terrainFromOriginalStorage} from './voxel-data.mjs';
const inside=(x,y,z)=>[x,y,z].every(v=>Number.isInteger(v)&&v>=0&&v<SIDE);

export function createEditableTerrain(api) {
  let values=terrainFromOriginalStorage(api),edits=0;
  function write(x,y,z,id) {
    if(!inside(x,y,z))throw new Error('16×16×16 섹션 밖에는 설치할 수 없습니다.');
    if(!Number.isInteger(id)||id<0||id>4)throw new Error('알 수 없는 테스트 블록입니다.');
    const index=indexOf(x,y,z),next=values.slice();next[index]=id;
    // The diagnostic buttons share the exported storage slot. Restore this scene
    // before each edit, then mutate and read back the entire original storage.
    api.storageInit(4,values.length);
    for(let i=0;i<values.length;i++)api.storageSet(i,values[i]);
    api.storageSet(index,id);
    for(let i=0;i<next.length;i++) {
      const actual=api.storageGet(i);
      if(actual!==next[i])throw new Error(`원본 저장소 수정 검증 실패: ${i}`);
      next[i]=actual;
    }
    values=next;edits++;
  }
  return {
    get values(){return values;},get edits(){return edits;},
    remove(hit){
      if(!hit||!inside(hit.x,hit.y,hit.z)||!values[indexOf(hit.x,hit.y,hit.z)])throw new Error('먼저 블록을 탭해 선택하세요.');
      write(hit.x,hit.y,hit.z,0);
    },
    place(hit,id){
      if(!hit||!Array.isArray(hit.normal)||hit.normal.length!==3||hit.normal.reduce((s,v)=>s+Math.abs(v),0)!==1||!hit.normal.every(Number.isInteger))throw new Error('먼저 블록 면을 탭해 선택하세요.');
      const [x,y,z]=[hit.x+hit.normal[0],hit.y+hit.normal[1],hit.z+hit.normal[2]];
      if(!inside(x,y,z))throw new Error('16×16×16 섹션 밖에는 설치할 수 없습니다.');
      if(values[indexOf(x,y,z)])throw new Error('이미 블록이 있는 위치입니다.');
      if(!Number.isInteger(id)||id<1||id>4)throw new Error('설치할 블록을 선택하세요.');
      write(x,y,z,id);
    },
    reset(){values=terrainFromOriginalStorage(api);edits=0;}
  };
}

export function cameraBasis(yaw,pitch,distance) {
  const eye=[Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance];
  return {eye,forward:eye.map(v=>-v/distance),right:[Math.cos(yaw),0,-Math.sin(yaw)],
    up:[-Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),-Math.cos(yaw)*Math.sin(pitch)]};
}

export function screenRay(nx,ny,aspect,camera) {
  const f=1/Math.tan(Math.PI/8);
  const direction=camera.forward.map((v,i)=>v+camera.right[i]*nx*aspect/f+camera.up[i]*ny/f);
  const length=Math.hypot(...direction);
  return {origin:camera.eye,direction:direction.map(v=>v/length)};
}

export function pickVoxel(values,origin,direction) {
  let closest=null;
  for(let y=0;y<SIDE;y++)for(let z=0;z<SIDE;z++)for(let x=0;x<SIDE;x++) {
    if(!values[indexOf(x,y,z)])continue;
    const min=[x-8,y-5,z-8];
    let enter=-Infinity,exit=Infinity,normal=[0,0,0],valid=true;
    for(let axis=0;axis<3;axis++) {
      if(Math.abs(direction[axis])<1e-10) {
        if(origin[axis]<min[axis]||origin[axis]>min[axis]+1){valid=false;break;}
        continue;
      }
      const a=(min[axis]-origin[axis])/direction[axis];
      const b=(min[axis]+1-origin[axis])/direction[axis];
      const near=Math.min(a,b),far=Math.max(a,b);
      if(near>enter){enter=near;normal=[0,0,0];normal[axis]=a<b?-1:1;}
      exit=Math.min(exit,far);
      if(enter>exit){valid=false;break;}
    }
    if(valid&&enter>=0&&exit>=enter&&(!closest||enter<closest.distance))closest={x,y,z,normal,distance:enter};
  }
  return closest;
}

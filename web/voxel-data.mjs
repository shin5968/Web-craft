export const SIDE=16;
export const indexOf=(x,y,z)=>x+SIDE*(z+SIDE*y);

// Original test terrain; IDs are local test palette entries, not game registry IDs.
export function terrainValues() {
  const values=new Int32Array(SIDE**3);
  for(let z=0;z<SIDE;z++) for(let x=0;x<SIDE;x++) {
    const height=Math.max(2,Math.min(12,Math.floor(6+2*Math.sin(x*.45)+2*Math.cos(z*.38))));
    for(let y=0;y<=height;y++) values[indexOf(x,y,z)]=y===height?(height<5?4:1):(y>height-3?2:3);
  }
  return values;
}

export function terrainFromOriginalStorage(api) {
  const expected=terrainValues();
  api.storageInit(4,expected.length);
  for(let i=0;i<expected.length;i++) api.storageSet(i,expected[i]);
  const values=new Int32Array(expected.length);
  for(let i=0;i<values.length;i++) {
    values[i]=api.storageGet(i);
    if(values[i]!==expected[i]) throw new Error(`Original storage mismatch at ${i}`);
  }
  return values;
}

const faces=[
  {n:[1,0,0],shade:.78,v:[[1,0,0],[1,1,0],[1,1,1],[1,0,1]]},
  {n:[-1,0,0],shade:.65,v:[[0,0,1],[0,1,1],[0,1,0],[0,0,0]]},
  {n:[0,1,0],shade:1,v:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]]},
  {n:[0,-1,0],shade:.45,v:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]]},
  {n:[0,0,1],shade:.87,v:[[1,0,1],[1,1,1],[0,1,1],[0,0,1]]},
  {n:[0,0,-1],shade:.7,v:[[0,0,0],[0,1,0],[1,1,0],[1,0,0]]}
];
const colors={1:[.3,.68,.32],2:[.48,.29,.16],3:[.48,.53,.59],4:[.86,.76,.48]};

export function meshVoxels(values) {
  if(values.length!==SIDE**3) throw new Error('Expected one 16³ section');
  const vertices=[];
  let blocks=0,faceCount=0;
  const at=(x,y,z)=>x<0||y<0||z<0||x>=SIDE||y>=SIDE||z>=SIDE?0:values[indexOf(x,y,z)];
  for(let y=0;y<SIDE;y++) for(let z=0;z<SIDE;z++) for(let x=0;x<SIDE;x++) {
    const id=at(x,y,z);
    if(!id) continue;
    if(!colors[id]) throw new Error(`Unknown test palette ID ${id}`);
    blocks++;
    for(const face of faces) {
      if(at(x+face.n[0],y+face.n[1],z+face.n[2])) continue;
      const base=colors[id===1&&face.n[1]!==1?2:id];
      for(const i of [0,1,2,0,2,3]) {
        const corner=face.v[i];
        vertices.push(x+corner[0]-8,y+corner[1]-5,z+corner[2]-8,
          base[0]*face.shade,base[1]*face.shade,base[2]*face.shade);
      }
      faceCount++;
    }
  }
  return {vertices:new Float32Array(vertices),blocks,faces:faceCount,vertexCount:faceCount*6};
}

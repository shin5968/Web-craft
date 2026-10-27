import {chunkSections,decodeSection} from './world-data.mjs';
import {meshVoxels,indexOf} from './voxel-data.mjs';
import {sectionSummary} from './world-report.mjs';

export function meshColumn(decodedSections,maxBytes=24*1024*1024) {
  const byY=new Map();let minY=Infinity,maxY=-Infinity,nonEmpty=0;
  for(const section of decodedSections) {
    if(!Number.isInteger(section.sectionY)||section.sectionY< -128||section.sectionY>127||byY.has(section.sectionY))throw new Error('중복되거나 잘못된 섹션 Y입니다.');
    if(!(section.values instanceof Int32Array)||section.values.length!==4096||!section.palette)throw new Error('잘못된 섹션 데이터입니다.');
    byY.set(section.sectionY,section);
    let occupied=false;
    for(let i=0;i<4096;i++)if(section.values[i]){
      const y=section.sectionY*16+Math.floor(i/256);
      minY=Math.min(minY,y);maxY=Math.max(maxY,y);occupied=true;
    }
    if(occupied)nonEmpty++;
  }
  if(!nonEmpty){minY=0;maxY=15;}
  const centerY=(minY+maxY+1)/2,parts=[];
  let bytes=0,blocks=0,faces=0;
  for(const section of decodedSections) {
    if(!section.values.some(value=>value!==0))continue;
    const neighborAt=(x,y,z)=>{
      const neighbor=byY.get(section.sectionY+(y<0?-1:1));
      return neighbor?neighbor.values[indexOf(x,y<0?15:0,z)]:0;
    };
    const mesh=meshVoxels(section.values,-1,section.palette,{neighborAt,offsetY:section.sectionY*16-centerY+5});
    bytes+=mesh.vertices.byteLength;
    if(bytes>maxBytes)throw new Error('청크 메쉬가 24 MiB 제한을 초과합니다. 섹션을 개별 표시해 주세요.');
    parts.push(mesh.vertices);blocks+=mesh.blocks;faces+=mesh.faces;
  }
  const vertices=new Float32Array(bytes/4);let offset=0;
  for(const part of parts){vertices.set(part,offset);offset+=part.length;}
  return {vertices,blocks,faces,vertexCount:faces*6,minY:nonEmpty?minY:null,maxY:nonEmpty?maxY:null,height:maxY-minY+1,
    sectionCount:decodedSections.length,nonEmptySections:nonEmpty,verifiedIndices:decodedSections.length*4096};
}

export function columnDisplaySections(sections,hideWater=false) {
  let hiddenWaterBlocks=0;
  const display=sections.map(section=>{
    if(!hideWater)return section;
    const values=section.values.slice();
    for(let i=0;i<values.length;i++)if(section.palette[values[i]]?.name==='minecraft:water'){
      values[i]=0;hiddenWaterBlocks++;
    }
    return {...section,values};
  });
  return {display,hiddenWaterBlocks};
}

export async function decodeChunkColumn(root,api,progress=()=>{},options={}) {
  const sections=chunkSections(root),decoded=[];
  if(sections.length>64)throw new Error('전체 청크 보기는 최대 64개 섹션까지 지원합니다.');
  for(const {section} of sections){decoded.push(decodeSection(section,api));progress(decoded.length,sections.length);await new Promise(resolve=>setTimeout(resolve,0));}
  const {display,hiddenWaterBlocks}=columnDisplaySections(decoded,!!options.hideWater);
  const mesh=meshColumn(display);mesh.sectionReports=decoded.map(sectionSummary);
  mesh.hideWater=!!options.hideWater;mesh.hiddenWaterBlocks=hiddenWaterBlocks;return mesh;
}

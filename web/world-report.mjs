import {chunkSections,decodeSection} from './world-data.mjs';

export function newWorldReport(file,environment={}) {
  return {
    schema:'web-craft.chunk-inspection.v1',createdAt:new Date().toISOString(),
    file:{name:file.name,size:file.size,lastModified:file.lastModified??null,sha256:null},environment,
    scope:'Custom MCA/NBT reader + Minecraft 26.3 SimpleBitStorage. File origin is not authenticated. No game startup, block registry or world simulation validation.',
    chunk:null,sections:[],errors:[],result:{read:'pending',validation:'not-run',render:'not-run'}
  };
}

export async function fingerprint(report,bytes) {
  if(bytes.length>32*1024*1024){report.file.hashNote='Skipped SHA-256 above 32 MiB to limit browser memory use.';return;}
  try {
    const hash=await globalThis.crypto.subtle.digest('SHA-256',bytes);
    report.file.sha256=[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');
  }catch(error){report.file.hashNote=String(error);}
}

export function recordFailure(report,stage,error) {
  if(report)report.errors.push({stage,message:String(error),at:new Date().toISOString()});
}

export function sectionSummary(decoded) {
  const counts=new Map();let nonAir=0;
  for(const id of decoded.values)if(id){nonAir++;counts.set(id,(counts.get(id)||0)+1);}
  return {
    y:decoded.sectionY,status:'passed',paletteCount:decoded.sourcePalette.length,
    verifiedIndices:decoded.verified,nonAir,air:4096-nonAir,usedNonAirStates:counts.size,
    topStates:[...counts].sort((a,b)=>b[1]-a[1]).slice(0,32).map(([id,count])=>({
      name:decoded.palette[id].name,properties:decoded.palette[id].properties,count
    })),
    topStatesLimit:32
  };
}

export async function inspectChunk(root,api,progress=()=>{}) {
  const sections=chunkSections(root),results=[];
  for(const {section,y} of sections) {
    try {results.push(sectionSummary(decodeSection(section,api)));}
    catch(error){results.push({y,status:'failed',error:String(error)});}
    progress(results.length,sections.length);
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  return results;
}

export function downloadWorldReport(report) {
  const blob=new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'});
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download='web-craft-report.json';document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}

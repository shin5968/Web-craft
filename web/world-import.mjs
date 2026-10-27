import {regionEntries,readRegionChunk,readStandaloneNBT,chunkSections,decodeSection} from './world-data.mjs';
import {loadMinecraftSmoke} from './minecraft-smoke-check.mjs';

export function mountWorldImport(ensureView) {
  const fileInput=document.querySelector('#world-file'),chunkSelect=document.querySelector('#world-chunk');
  const sectionSelect=document.querySelector('#world-section'),button=document.querySelector('#world-load');
  const result=document.querySelector('#world-result'),paletteOutput=document.querySelector('#world-palette');
  let bytes,entries=[],sections=[],root,filename='',busy=false;
  const message=(value,ok)=>{result.textContent=value;result.className=ok?'pass':'fail';};
  function controls() {
    fileInput.disabled=busy;chunkSelect.disabled=busy||!entries.length;
    sectionSelect.disabled=busy||!sections.length;button.disabled=busy||!sections.length;
  }
  async function chooseChunk() {
    result.dataset.loaded='false';
    sections=[];root=null;sectionSelect.replaceChildren();paletteOutput.textContent='';
    root=entries.length?await readRegionChunk(bytes,entries[Number(chunkSelect.value)]):await readStandaloneNBT(bytes);
    sections=chunkSections(root);
    sections.forEach(({y},index)=>sectionSelect.add(new Option(`섹션 Y=${y} (블록 Y ${y*16}~${y*16+15})`,String(index))));
    message(`청크 (${root.xPos??root.Level?.xPos??'?'}, ${root.zPos??root.Level?.zPos??'?'}) · DataVersion ${root.DataVersion??'미상'} · 섹션 ${sections.length}개. 섹션을 선택하고 표시하세요.`,true);
  }
  fileInput.addEventListener('change',async()=>{
    const file=fileInput.files?.[0];if(!file)return;
    busy=true;entries=[];sections=[];root=null;chunkSelect.replaceChildren();sectionSelect.replaceChildren();controls();
    try {
      if(file.size>128*1024*1024)throw new Error('파일 크기 제한은 128 MiB입니다.');
      filename=file.name;bytes=new Uint8Array(await file.arrayBuffer());
      if(file.name.toLowerCase().endsWith('.mca')) {
        entries=regionEntries(bytes);
        if(!entries.length)throw new Error('이 리전에는 저장된 청크가 없습니다.');
        entries.forEach((entry,index)=>chunkSelect.add(new Option(`리전 내부 청크 (${entry.x}, ${entry.z})`,String(index))));
      } else chunkSelect.add(new Option('단일 청크 NBT','0'));
      await chooseChunk();
    }catch(error){message(String(error),false);}
    finally{busy=false;controls();}
  });
  chunkSelect.addEventListener('change',async()=>{
    busy=true;controls();
    try{await chooseChunk();}catch(error){message(String(error),false);}finally{busy=false;controls();}
  });
  button.addEventListener('click',async()=>{
    busy=true;controls();
    try {
      const chosen=sections[Number(sectionSelect.value)];if(!chosen)throw new Error('섹션을 먼저 선택하세요.');
      const view=await ensureView();if(!view)throw new Error('WebGPU 화면을 시작하지 못했습니다.');
      const app=await loadMinecraftSmoke(),decoded=decodeSection(chosen.section,app.exports);
      const chunk=root.Level||root;
      const label=`${filename} · 청크 (${chunk.xPos??'?'}, ${chunk.zPos??'?'}) · 섹션 Y=${chosen.y}`;
      view.loadSection(decoded,label);
      const names=decoded.sourcePalette.map((state,index)=>`${index}: ${state.name} ${JSON.stringify(state.properties)}`);
      paletteOutput.textContent=names.slice(0,128).join('\n')+(names.length>128?`\n… 전체 ${names.length}개 중 앞 128개 표시`:'');
      message(`실제 파일 섹션 읽기 성공 · ${decoded.sourcePalette.length}개 블록 상태 · 원본 SimpleBitStorage 4096개 인덱스 일치. 색상은 근사 표현이며 모든 비공기 블록을 정육면체로 표시합니다.`,true);
      result.dataset.loaded='true';
    }catch(error){result.dataset.loaded='false';message(String(error),false);}
    finally{busy=false;controls();}
  });
  controls();
}

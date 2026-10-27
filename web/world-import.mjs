import {regionEntries,readRegionChunk,readStandaloneNBT,chunkSections,decodeSection} from './world-data.mjs';
import {loadMinecraftSmoke} from './minecraft-smoke-check.mjs';
import {newWorldReport,fingerprint,recordFailure,sectionSummary,inspectChunk,downloadWorldReport} from './world-report.mjs';
import {decodeChunkColumn} from './world-column.mjs';

export function mountWorldImport(ensureView) {
  const fileInput=document.querySelector('#world-file'),chunkSelect=document.querySelector('#world-chunk');
  const sectionSelect=document.querySelector('#world-section'),button=document.querySelector('#world-load');
  const result=document.querySelector('#world-result'),paletteOutput=document.querySelector('#world-palette');
  const inspectButton=document.querySelector('#world-check'),reportButton=document.querySelector('#world-report');
  const columnButton=document.querySelector('#world-column');
  const inspectionResult=document.querySelector('#world-inspection');
  let bytes,entries=[],sections=[],root,filename='',busy=false,report;
  const message=(value,ok)=>{result.textContent=value;result.className=ok?'pass':'fail';};
  function controls() {
    fileInput.disabled=busy;chunkSelect.disabled=busy||!entries.length;
    sectionSelect.disabled=busy||!sections.length;button.disabled=busy||!sections.length;
    inspectButton.disabled=busy||!root||!sections.length;reportButton.disabled=busy||!report;
    columnButton.disabled=busy||!root||!sections.length;
  }
  async function chooseChunk() {
    result.dataset.loaded='false';
    if(report){report.chunk=null;report.sections=[];report.errors=[];report.result={read:'pending',validation:'not-run',render:'not-run'};}
    if(report){delete report.renderedSectionY;delete report.renderedColumn;}
    inspectionResult.textContent='';inspectionResult.dataset.complete='false';
    sections=[];root=null;sectionSelect.replaceChildren();paletteOutput.textContent='';
    const entry=entries[Number(chunkSelect.value)];
    report.chunk={x:null,z:null,dataVersion:null,sectionCount:null,regionSlot:entry?.slot??null,
      compression:entry?bytes[entry.offset+4]:null};
    root=entries.length?await readRegionChunk(bytes,entries[Number(chunkSelect.value)]):await readStandaloneNBT(bytes);
    const chunk=root.Level||root;
    Object.assign(report.chunk,{x:chunk.xPos??null,z:chunk.zPos??null,dataVersion:root.DataVersion??null});
    sections=chunkSections(root);
    report.chunk.sectionCount=sections.length;
    report.chunk.skippedSections=(chunk.sections||chunk.Sections).length-sections.length;
    report.result.read='passed';
    sections.forEach(({y},index)=>sectionSelect.add(new Option(`섹션 Y=${y} (블록 Y ${y*16}~${y*16+15})`,String(index))));
    message(`청크 (${root.xPos??root.Level?.xPos??'?'}, ${root.zPos??root.Level?.zPos??'?'}) · DataVersion ${root.DataVersion??'미상'} · 섹션 ${sections.length}개. 섹션을 선택하고 표시하세요.`,true);
  }
  fileInput.addEventListener('change',async()=>{
    const file=fileInput.files?.[0];if(!file)return;
    report=newWorldReport(file,{userAgent:navigator.userAgent,secureContext:isSecureContext,crossOriginIsolated});
    report.file.format=file.name.toLowerCase().endsWith('.mca')?'region-mca':'named-chunk-nbt';
    filename=file.name;bytes=undefined;
    inspectionResult.textContent='';result.dataset.loaded='false';
    busy=true;entries=[];sections=[];root=null;chunkSelect.replaceChildren();sectionSelect.replaceChildren();controls();
    try {
      if(file.size>128*1024*1024)throw new Error('파일 크기 제한은 128 MiB입니다.');
      filename=file.name;bytes=new Uint8Array(await file.arrayBuffer());
      await fingerprint(report,bytes);
      if(file.name.toLowerCase().endsWith('.mca')) {
        entries=regionEntries(bytes);
        if(!entries.length)throw new Error('이 리전에는 저장된 청크가 없습니다.');
        entries.forEach((entry,index)=>chunkSelect.add(new Option(`리전 내부 청크 (${entry.x}, ${entry.z})`,String(index))));
      } else chunkSelect.add(new Option('단일 청크 NBT','0'));
      await chooseChunk();
    }catch(error){report.result.read='failed';recordFailure(report,'read-file',error);message(String(error),false);}
    finally{busy=false;controls();}
  });
  chunkSelect.addEventListener('change',async()=>{
    busy=true;controls();
    try{await chooseChunk();}catch(error){report.result.read='failed';recordFailure(report,'read-chunk',error);message(String(error),false);}finally{busy=false;controls();}
  });
  button.addEventListener('click',async()=>{
    report.result.render='not-run';
    busy=true;controls();
    try {
      const chosen=sections[Number(sectionSelect.value)];if(!chosen)throw new Error('섹션을 먼저 선택하세요.');
      const view=await ensureView();if(!view)throw new Error('WebGPU 화면을 시작하지 못했습니다.');
      const app=await loadMinecraftSmoke(),decoded=decodeSection(chosen.section,app.exports);
      const summary=sectionSummary(decoded);
      report.sections=report.sections.filter(section=>section.y!==summary.y);report.sections.push(summary);
      report.result.validation='selected-section-passed';
      const chunk=root.Level||root;
      const label=`${filename} · 청크 (${chunk.xPos??'?'}, ${chunk.zPos??'?'}) · 섹션 Y=${chosen.y}`;
      view.loadSection(decoded,label);
      report.result.render='submitted';
      delete report.renderedColumn;
      report.renderedSectionY=decoded.sectionY;
      const names=decoded.sourcePalette.map((state,index)=>`${index}: ${state.name} ${JSON.stringify(state.properties)}`);
      paletteOutput.textContent=names.slice(0,128).join('\n')+(names.length>128?`\n… 전체 ${names.length}개 중 앞 128개 표시`:'');
      message(`실제 파일 섹션 읽기 성공 · ${decoded.sourcePalette.length}개 블록 상태 · 원본 SimpleBitStorage 4096개 인덱스 일치. 색상은 근사 표현이며 모든 비공기 블록을 정육면체로 표시합니다.`,true);
      result.dataset.loaded='true';
    }catch(error){result.dataset.loaded='false';recordFailure(report,'load-section',error);message(String(error),false);}
    finally{busy=false;controls();}
  });
  inspectButton.addEventListener('click',async()=>{
    busy=true;controls();inspectionResult.dataset.complete='false';
    try {
      const app=await loadMinecraftSmoke();
      report.sections=await inspectChunk(root,app.exports,(done,total)=>{
        inspectionResult.textContent=`섹션 검사 중: ${done}/${total}`;
      });
      const passed=report.sections.filter(section=>section.status==='passed').length;
      const failed=report.sections.length-passed;
      report.result.validation=failed?'failed':'all-sections-passed';
      inspectionResult.textContent=`선택 청크: ${report.sections.length}개 섹션 중 ${passed}개 통과, ${failed}개 실패 · ${passed*4096}개 인덱스 검증. 검사 보고서를 저장할 수 있습니다.`;
      inspectionResult.className=failed?'fail':'pass';
    }catch(error){report.result.validation='failed';recordFailure(report,'inspect-chunk',error);inspectionResult.textContent=String(error);inspectionResult.className='fail';}
    finally{inspectionResult.dataset.complete='true';busy=false;controls();}
  });
  reportButton.addEventListener('click',()=>{if(report)downloadWorldReport(report);});
  columnButton.addEventListener('click',async()=>{
    report.result.render='not-run';
    busy=true;controls();result.dataset.columnLoaded='false';
    try {
      const view=await ensureView();if(!view)throw new Error('WebGPU 화면을 시작하지 못했습니다.');
      const app=await loadMinecraftSmoke();
      const mesh=await decodeChunkColumn(root,app.exports,(done,total)=>{inspectionResult.textContent=`청크 표시 준비: ${done}/${total}개 섹션`;});
      const chunk=root.Level||root,label=`${filename} · 청크 (${chunk.xPos??'?'}, ${chunk.zPos??'?'}) 전체 높이`;
      view.loadColumn(mesh,label);
      report.result.render='column-submitted';delete report.renderedSectionY;
      report.sections=mesh.sectionReports;report.result.validation='all-sections-passed';
      report.renderedColumn={minY:mesh.minY,maxY:mesh.maxY,sectionCount:mesh.sectionCount,nonEmptySections:mesh.nonEmptySections,verifiedIndices:mesh.verifiedIndices};
      message(`${mesh.sectionCount}개 섹션의 ${mesh.verifiedIndices}개 인덱스 검증 후 합쳐 표시했습니다. 공기만 있는 구간은 생략하고 위아래 섹션의 가려진 면을 제거합니다. 전체 보기는 읽기 전용입니다.`,true);
      result.dataset.columnLoaded='true';inspectionResult.textContent='청크 전체 높이 표시 준비 완료';
    }catch(error){recordFailure(report,'load-column',error);message(String(error),false);}
    finally{busy=false;controls();}
  });
  controls();
}

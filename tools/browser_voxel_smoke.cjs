const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {spawn}=require('node:child_process');
const {mkdirSync,readFileSync}=require('node:fs');

(async()=>{
  const server=spawn('python3',['tools/dev_server.py','--port','8123'],{stdio:'ignore'});
  let browser;
  try {
    for(let i=0;i<100;i++) {
      try {if((await fetch('http://127.0.0.1:8123')).ok)break;}catch{}
      await new Promise(r=>setTimeout(r,100));
    }
    browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined,args:[
      '--enable-unsafe-webgpu','--use-angle=swiftshader','--use-vulkan=swiftshader',
      '--enable-features=Vulkan','--disable-vulkan-surface','--no-sandbox'
    ]});
    const page=await browser.newPage({viewport:{width:1024,height:1000},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',error=>errors.push(String(error)));
    page.on('console',message=>console.log(`Browser ${message.type()}: ${message.text()}`));
    await page.goto('http://127.0.0.1:8123');
    await page.evaluate(()=>{
      // Reproduce both an incompatible old context and a one-off null result.
      window.oldVoxelCanvas=document.querySelector('#voxel-canvas');
      window.oldVoxelCanvas.getContext('2d');
      const original=HTMLCanvasElement.prototype.getContext;
      let injected=false;
      HTMLCanvasElement.prototype.getContext=function(type,...args){
        if(this.id==='voxel-canvas'&&type==='webgpu'&&!injected){injected=true;return null;}
        return original.call(this,type,...args);
      };
    });
    await page.locator('#voxel-run').click();
    await page.waitForFunction(()=>document.querySelector('#voxel-canvas').dataset.rendered==='true'||document.querySelector('#voxel-result').className==='fail',{},{timeout:60000});
    const text=await page.locator('#voxel-result').innerText();
    if(await page.locator('#voxel-canvas').getAttribute('data-rendered')!=='true')throw new Error(text);
    const canvas=page.locator('#voxel-canvas');
    if(await canvas.getAttribute('data-context-attempts')!=='2')throw new Error('Null context retry was not exercised');
    if(await page.evaluate(()=>window.oldVoxelCanvas===document.querySelector('#voxel-canvas')))throw new Error('Old canvas was reused');
    const before=await canvas.screenshot();
    const cameraBefore=await canvas.getAttribute('data-camera');
    const box=await canvas.boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await page.mouse.down();await page.mouse.move(box.x+box.width/2+90,box.y+box.height/2+40,{steps:8});await page.mouse.up();
    await page.waitForTimeout(200);
    const after=await canvas.screenshot();
    mkdirSync('reports',{recursive:true});
    await canvas.screenshot({path:'reports/voxel-render.png'});
    console.log('Camera debug',cameraBefore,await canvas.getAttribute('data-camera'),await canvas.getAttribute('data-frames'),box);
    if(before.equals(after))throw new Error('Camera drag did not change the rendered canvas');
    if(!(await page.locator('#block-remove').isDisabled()))throw new Error('Dragging unexpectedly selected a block');
    await page.locator('#zoom-in').click();await page.waitForTimeout(100);
    await page.locator('#run').click();
    await page.waitForFunction(()=>!document.querySelector('#run').disabled);
    if(await canvas.getAttribute('data-rendered')!=='true')throw new Error('Diagnostic canvas interfered with terrain canvas');
    const initialBlocks=Number(await canvas.getAttribute('data-blocks'));
    async function selectTop() {
      for(const fy of [.45,.35,.55,.25,.65])for(const fx of [.5,.4,.6,.3,.7]) {
        const size=await canvas.evaluate(c=>({w:c.clientWidth,h:c.clientHeight}));
        await canvas.click({position:{x:size.w*fx,y:size.h*fy}});
        const hit=JSON.parse(await canvas.getAttribute('data-selection')||'null');
        if(hit&&hit.normal[1]===1&&hit.y<15)return;
      }
      throw new Error('No selectable top face found');
    }
    await selectTop();await page.locator('#block-remove').click();
    await page.waitForFunction(expected=>Number(document.querySelector('#voxel-canvas').dataset.blocks)===expected,initialBlocks-1);
    // This diagnostic uses the same Wasm exports; subsequent edits must keep scene state.
    await page.locator('#storage-run').click();
    await page.waitForFunction(()=>!document.querySelector('#storage-run').disabled);
    await selectTop();await page.locator('#block-type').selectOption('3');await page.locator('#block-place').click();
    await page.waitForFunction(expected=>Number(document.querySelector('#voxel-canvas').dataset.blocks)===expected,initialBlocks);
    if(await canvas.getAttribute('data-edits')!=='2')throw new Error('Original storage edit count mismatch');
    await page.locator('#terrain-reset').click();
    if(await canvas.getAttribute('data-edits')!=='0'||Number(await canvas.getAttribute('data-blocks'))!==initialBlocks)throw new Error('Terrain reset mismatch');
    await page.waitForTimeout(150);
    if(await canvas.getAttribute('data-rendered')!=='true')throw new Error('GPU error after terrain editing');
    await page.evaluate(()=>{window.previousVoxelCanvas=document.querySelector('#voxel-canvas');});
    await page.locator('#voxel-run').click();
    await page.waitForFunction(()=>document.querySelector('#voxel-canvas').dataset.rendered==='true'||document.querySelector('#voxel-result').className==='fail');
    if(await canvas.getAttribute('data-rendered')!=='true')throw new Error(await page.locator('#voxel-result').innerText());
    if(await page.evaluate(()=>window.previousVoxelCanvas===document.querySelector('#voxel-canvas')))throw new Error('Restart reused previous canvas');
    await page.getByText('실제 월드 파일에서 섹션 읽기',{exact:true}).click();
    await page.locator('#world-file').setInputFiles('reports/world-fixture.mca');
    await page.waitForFunction(()=>!document.querySelector('#world-load').disabled||document.querySelector('#world-result').className==='fail');
    if(await page.locator('#world-load').isDisabled())throw new Error(await page.locator('#world-result').innerText());
    await page.locator('#world-load').click();
    await page.waitForFunction(()=>document.querySelector('#world-result').dataset.loaded==='true'||document.querySelector('#world-result').dataset.loaded==='false');
    if(await page.locator('#world-result').getAttribute('data-loaded')!=='true')throw new Error(await page.locator('#world-result').innerText());
    if(Number(await canvas.getAttribute('data-blocks'))!==1664)throw new Error('Imported MCA section block count mismatch');
    if(!(await page.locator('#voxel-result').innerText()).includes('world-fixture.mca'))throw new Error('Imported file was not connected to the renderer');
    await page.getByText('읽은 팔레트 보기',{exact:true}).click();
    if(!(await page.locator('#world-palette').innerText()).includes('snowy'))throw new Error('Block state properties were lost');
    await page.locator('#world-check').click();
    await page.waitForFunction(()=>document.querySelector('#world-inspection').dataset.complete==='true');
    if(await page.locator('#world-inspection').getAttribute('class')!=='pass')throw new Error(await page.locator('#world-inspection').innerText());
    const downloadPromise=page.waitForEvent('download');await page.locator('#world-report').click();
    const download=await downloadPromise;
    const report=JSON.parse(readFileSync(await download.path(),'utf8'));
    if(report.result.validation!=='all-sections-passed'||report.sections[0].verifiedIndices!==4096||report.file.sha256.length!==64)throw new Error('Downloaded inspection report mismatch');
    await page.locator('#terrain-reset').click();
    if(Number(await canvas.getAttribute('data-blocks'))!==1664||!(await page.locator('#voxel-result').innerText()).includes('world-fixture.mca'))throw new Error('Imported section reset lost source data');
    await page.locator('#world-file').setInputFiles('reports/column-fixture.mca');
    await page.waitForFunction(()=>!document.querySelector('#world-column').disabled||document.querySelector('#world-result').className==='fail');
    await page.locator('#world-column').click();
    await page.waitForFunction(()=>document.querySelector('#world-result').dataset.columnLoaded==='true'||document.querySelector('#world-result').className==='fail');
    if(await canvas.getAttribute('data-mode')!=='column'||Number(await canvas.getAttribute('data-blocks'))!==8192)throw new Error('Full chunk column was not rendered');
    if(!(await page.locator('#voxel-result').innerText()).includes('2560노출 면'))throw new Error('Vertical boundary faces were not removed');
    if(!(await page.locator('#terrain-reset').isDisabled()))throw new Error('Full column editing was not disabled');
    const columnCamera=await canvas.getAttribute('data-camera');await page.locator('#zoom-out').click();
    await page.waitForFunction(before=>document.querySelector('#voxel-canvas').dataset.camera!==before,columnCamera);
    await canvas.screenshot({path:'reports/column-render.png'});
    if(await canvas.getAttribute('data-rendered')!=='true')throw new Error('GPU error in full-height column');
    const columnDownloadPromise=page.waitForEvent('download');await page.locator('#world-report').click();
    const columnDownload=await columnDownloadPromise;
    const columnReport=JSON.parse(readFileSync(await columnDownload.path(),'utf8'));
    if(columnReport.result.render!=='column-submitted'||columnReport.renderedColumn.verifiedIndices!==12288||columnReport.sections.length!==3)throw new Error('Full column report mismatch');
    await page.locator('#world-load').click();
    await page.waitForFunction(()=>document.querySelector('#voxel-canvas').dataset.mode==='section');
    if(await page.locator('#terrain-reset').isDisabled())throw new Error('Section edit mode did not recover');
    await page.waitForTimeout(150);
    if(await canvas.getAttribute('data-rendered')!=='true')throw new Error('GPU error after returning to section mode');
    if(errors.length)throw new Error(errors.join('\n'));
    mkdirSync('reports',{recursive:true});
    await canvas.screenshot({path:'reports/voxel-render.png'});
    await page.locator('#world-file').setInputFiles({name:'broken.mca',mimeType:'application/octet-stream',buffer:Buffer.from([0,1,2])});
    await page.waitForFunction(()=>document.querySelector('#world-result').className==='fail'&&!document.querySelector('#world-report').disabled);
    const failedDownloadPromise=page.waitForEvent('download');await page.locator('#world-report').click();
    const failedDownload=await failedDownloadPromise;
    const failedReport=JSON.parse(readFileSync(await failedDownload.path(),'utf8'));
    if(failedReport.result.read!=='failed'||!failedReport.errors.length||failedReport.file.name!=='broken.mca')throw new Error('Failed file report mismatch');
    console.log(`WebGPU browser: ${text}; canvas recovery, editing, MCA import, full-height column, mode switching and report downloads passed`);
  }finally{await browser?.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});

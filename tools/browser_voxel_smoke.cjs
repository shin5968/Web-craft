const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {spawn}=require('node:child_process');
const {mkdirSync}=require('node:fs');

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
    await page.locator('#voxel-run').click();
    await page.waitForFunction(()=>document.querySelector('#voxel-canvas').dataset.rendered==='true'||document.querySelector('#voxel-result').className==='fail',{},{timeout:60000});
    const text=await page.locator('#voxel-result').innerText();
    if(await page.locator('#voxel-canvas').getAttribute('data-rendered')!=='true')throw new Error(text);
    const canvas=page.locator('#voxel-canvas');
    const before=await canvas.screenshot();
    const box=await canvas.boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await page.mouse.down();await page.mouse.move(box.x+box.width/2+90,box.y+box.height/2+40,{steps:8});await page.mouse.up();
    await page.waitForTimeout(200);
    const after=await canvas.screenshot();
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
    if(errors.length)throw new Error(errors.join('\n'));
    mkdirSync('reports',{recursive:true});
    await canvas.screenshot({path:'reports/voxel-render.png'});
    console.log(`WebGPU browser: ${text}; drag, picking, remove, place, diagnostic isolation and reset passed`);
  }finally{await browser?.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});

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
    browser=await chromium.launch({headless:true,args:[
      '--enable-unsafe-webgpu','--use-angle=swiftshader','--no-sandbox'
    ]});
    const page=await browser.newPage({viewport:{width:1024,height:1000},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',error=>errors.push(String(error)));
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
    await page.locator('#zoom-in').click();await page.waitForTimeout(100);
    await page.locator('#run').click();
    await page.waitForFunction(()=>!document.querySelector('#run').disabled);
    if(await canvas.getAttribute('data-rendered')!=='true')throw new Error('Diagnostic canvas interfered with terrain canvas');
    if(errors.length)throw new Error(errors.join('\n'));
    mkdirSync('reports',{recursive:true});
    await canvas.screenshot({path:'reports/voxel-render.png'});
    console.log(`WebGPU browser: ${text}; camera drag and separate diagnostic canvas passed`);
  }finally{await browser?.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});

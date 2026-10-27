import {loadMinecraftSmoke} from './minecraft-smoke-check.mjs';
import {indexOf,meshVoxels} from './voxel-data.mjs';
import {createEditableTerrain,cameraBasis,screenRay,pickVoxel} from './voxel-edit.mjs';

const shader=`
struct Camera { right:vec4f, up:vec4f, forward:vec4f, eye:vec4f, projection:vec4f }
@group(0) @binding(0) var<uniform> camera:Camera;
struct Output { @builtin(position) position:vec4f, @location(0) color:vec3f }
@vertex fn vs(@location(0) position:vec3f,@location(1) color:vec3f)->Output {
  let delta=position-camera.eye.xyz;
  let z=dot(delta,camera.forward.xyz);
  var out:Output;
  out.position=vec4f(dot(delta,camera.right.xyz)*camera.projection.x,
    dot(delta,camera.up.xyz)*camera.projection.y,
    camera.projection.z*z+camera.projection.w,z);
  out.color=color;
  return out;
}
@fragment fn fs(in:Output)->@location(0) vec4f { return vec4f(in.color,1.0); }
`;

export async function startVoxelView(canvas,status,onSelection=()=>{},preparedContext=undefined) {
  if(!navigator.gpu) throw new Error('WebGPU를 사용할 수 없습니다.');
  // Acquire the surface before awaits and before allocating a GPU device.
  const context=preparedContext===undefined?canvas.getContext('webgpu'):preparedContext;
  if(!context)throw new Error('새 캔버스에서도 WebGPU 컨텍스트를 만들지 못했습니다. 이전 테스트 탭을 닫고 Safari에서 페이지를 다시 열어 주세요.');
  const app=await loadMinecraftSmoke();
  const terrain=createEditableTerrain(app.exports);
  let selected=null,mesh=meshVoxels(terrain.values);
  const adapter=await navigator.gpu.requestAdapter();
  if(!adapter) throw new Error('WebGPU 어댑터가 없습니다.');
  const device=await adapter.requestDevice();
  let depth,vertex,uniform,observer,raf=0,disposed=false;
  const pointers=new Map();
  let yaw=.75,pitch=.55,distance=34;
  let column=null,extent=20,maxDistance=65;
  const report=()=>column?`${column.label} · ${mesh.sectionCount}개 섹션 (${mesh.nonEmptySections}개 비공기) · ${mesh.blocks?`Y ${mesh.minY}~${mesh.maxY}`:'전부 공기'} · ${mesh.blocks}블록 · ${mesh.faces}노출 면 · ${mesh.verifiedIndices}개 인덱스 일치 · 읽기 전용`:
    `${terrain.source} · ${mesh.blocks}블록 · ${mesh.faces}노출 면 · 원본 저장소 4096개 값 일치 · 수정 ${terrain.edits}회 · WebGPU 렌더링 성공`;
  const fail=error=>{canvas.dataset.rendered='error';status(String(error),false);};
  const draw=()=>{
    raf=0;
    if(disposed) return;
    try {
      const ratio=Math.min(window.devicePixelRatio||1,2);
      const width=Math.max(1,Math.min(1600,Math.round(canvas.clientWidth*ratio)));
      const height=Math.max(1,Math.min(1000,Math.round(canvas.clientHeight*ratio)));
      if(!depth||canvas.width!==width||canvas.height!==height) {
        depth?.destroy();canvas.width=width;canvas.height=height;
        depth=device.createTexture({size:[width,height],format:'depth24plus',usage:GPUTextureUsage.RENDER_ATTACHMENT});
      }
      const {eye,forward,right,up}=cameraBasis(yaw,pitch,distance);
      const f=1/Math.tan(Math.PI/8),near=.1,far=Math.max(150,distance+extent*4);
      device.queue.writeBuffer(uniform,0,new Float32Array([
        ...right,0,...up,0,...forward,0,...eye,0,f*height/width,f,far/(far-near),-far*near/(far-near)
      ]));
      const encoder=device.createCommandEncoder();
      const pass=encoder.beginRenderPass({colorAttachments:[{view:context.getCurrentTexture().createView(),
        clearValue:{r:.055,g:.095,b:.13,a:1},loadOp:'clear',storeOp:'store'}],
        depthStencilAttachment:{view:depth.createView(),depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}});
      pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.setVertexBuffer(0,vertex);
      pass.draw(mesh.vertexCount);pass.end();device.queue.submit([encoder.finish()]);
      canvas.dataset.camera=JSON.stringify([yaw,pitch,distance]);
      canvas.dataset.frames=String(Number(canvas.dataset.frames||0)+1);
    } catch(error) {fail(error);}
  };
  const schedule=()=>{if(!disposed&&!raf) raf=requestAnimationFrame(draw);};
  function rebuild() {
    mesh=column?column.mesh:meshVoxels(terrain.values,selected?indexOf(selected.x,selected.y,selected.z):-1,terrain.palette);
    const next=device.createBuffer({size:Math.max(24,mesh.vertices.byteLength),usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});
    if(mesh.vertices.byteLength)device.queue.writeBuffer(next,0,mesh.vertices);
    vertex?.destroy();vertex=next;
    canvas.dataset.blocks=String(mesh.blocks);canvas.dataset.edits=String(column?0:terrain.edits);
    canvas.dataset.selection=JSON.stringify(selected);
    canvas.dataset.mode=column?'column':'section';
    onSelection(selected,!!column);status(report(),true);schedule();
  }
  const down=event=>{
    for(const state of pointers.values())state.moved=true;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moved:pointers.size>0});
    canvas.setPointerCapture(event.pointerId);
  };
  const move=event=>{
    const old=pointers.get(event.pointerId);if(!old)return;
    if(Math.hypot(event.clientX-old.startX,event.clientY-old.startY)>8)old.moved=true;
    if(old.moved){
      yaw-=(event.clientX-old.x)*.008;
      pitch=Math.max(.12,Math.min(1.4,pitch+(event.clientY-old.y)*.008));schedule();
    }
    old.x=event.clientX;old.y=event.clientY;
  };
  const end=event=>{
    const old=pointers.get(event.pointerId);pointers.delete(event.pointerId);
    if(!old||old.moved||event.type==='pointercancel'||Math.hypot(event.clientX-old.startX,event.clientY-old.startY)>8)return;
    if(column){onSelection(null,true);return;}
    const rect=canvas.getBoundingClientRect();
    const ray=screenRay(2*(event.clientX-rect.left)/rect.width-1,1-2*(event.clientY-rect.top)/rect.height,
      canvas.width/canvas.height,cameraBasis(yaw,pitch,distance));
    selected=pickVoxel(terrain.values,ray.origin,ray.direction);
    if(selected)selected.blockName=terrain.palette?.[terrain.values[indexOf(selected.x,selected.y,selected.z)]]?.name;
    rebuild();
  };
  function dispose() {
    if(disposed)return;
    disposed=true;cancelAnimationFrame(raf);observer?.disconnect();
    canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);
    canvas.removeEventListener('pointerup',end);canvas.removeEventListener('pointercancel',end);
    depth?.destroy();vertex?.destroy();uniform?.destroy();
    try {context.unconfigure();} finally {device.destroy();}
  }
  let pipeline,bind;
  try {
    const format=navigator.gpu.getPreferredCanvasFormat();
    context.configure({device,format,alphaMode:'opaque'});
    device.addEventListener('uncapturederror',event=>{fail(event.error.message);});
    device.lost.then(info=>{if(!disposed){fail(`GPU 장치 연결 종료: ${info.message||info.reason}`);dispose();}});
    device.pushErrorScope('validation');
    const module=device.createShaderModule({code:shader});
    const info=await module.getCompilationInfo();
    const errors=info.messages.filter(m=>m.type==='error');
    if(errors.length) throw new Error(errors.map(m=>m.message).join('\n'));
    pipeline=await device.createRenderPipelineAsync({layout:'auto',
      vertex:{module,entryPoint:'vs',buffers:[{arrayStride:24,attributes:[
        {shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'}]}]},
      fragment:{module,entryPoint:'fs',targets:[{format}]},
      primitive:{topology:'triangle-list',cullMode:'back',frontFace:'ccw'},
      depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less'}});
    vertex=device.createBuffer({size:mesh.vertices.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});
    device.queue.writeBuffer(vertex,0,mesh.vertices);
    uniform=device.createBuffer({size:80,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:uniform}}]});
    draw();
    const validation=await device.popErrorScope();
    if(validation)throw new Error(validation.message);
    await device.queue.onSubmittedWorkDone();
    if(canvas.dataset.rendered==='error')throw new Error('렌더 패스 실행 오류');
    observer=new ResizeObserver(schedule);observer.observe(canvas);
    canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);
    canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
    canvas.dataset.rendered='true';canvas.dataset.blocks=String(mesh.blocks);canvas.dataset.edits='0';canvas.dataset.selection='null';canvas.dataset.mode='section';onSelection(null);status(report(),true);
    return {dispose,
      zoom(amount){distance=Math.max(18,Math.min(maxDistance,distance+amount*Math.max(1,extent/20)));schedule();},
      remove(){if(column)throw new Error('전체 청크는 읽기 전용입니다. 섹션을 선택해 편집하세요.');terrain.remove(selected);selected=null;rebuild();},
      place(id){if(column)throw new Error('전체 청크는 읽기 전용입니다. 섹션을 선택해 편집하세요.');terrain.place(selected,id);selected=null;rebuild();},
      reset(){if(column)throw new Error('전체 청크는 읽기 전용입니다.');terrain.reset();selected=null;rebuild();},
      loadSection(section,label){terrain.loadSection(section,label);column=null;extent=20;maxDistance=65;distance=34;selected=null;rebuild();},
      loadColumn(next,label){
        column={mesh:next,label};selected=null;extent=Math.hypot(16,next.height,16);
        maxDistance=Math.max(65,extent*4);distance=Math.max(34,extent*1.7);pitch=.3;rebuild();
      }
    };
  } catch(error) {dispose();throw error;}
}

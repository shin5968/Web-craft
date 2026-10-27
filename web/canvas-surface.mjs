// A canvas keeps its context mode for its lifetime. Never reuse a previously
// initialized element when starting a new renderer session.
export function freshGpuSurface(previous) {
  let canvas=previous,context=null;
  for(let attempt=1;attempt<=2;attempt++) {
    const next=canvas.cloneNode(false);
    for(const key of Object.keys(next.dataset))delete next.dataset[key];
    next.width=780;next.height=420;
    canvas.replaceWith(next);canvas=next;
    context=canvas.getContext('webgpu');
    canvas.dataset.contextAttempts=String(attempt);
    if(context)break;
  }
  return {canvas,context};
}

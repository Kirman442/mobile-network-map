import {PALETTES} from '../data/binaryData.js';
import {SCHEME_REGISTRY} from '../ColorScaleMaps.js';
// One worker, time-bounded slices. Yield a task so priority messages can interrupt.
let chunks=[],queue=[],job=null,running=false;
const yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0));
self.onmessage=({data:m})=>{
  if(m.type==='init'){
    chunks=m.chunks;queue=PALETTES.filter(p=>p!==m.selected).map(p=>({palette:p,index:0,offset:0,colors:null}));
    pump();
  }else if(m.type==='priority'){
    const i=queue.findIndex(q=>q.palette===m.palette);
    if(i>=0){if(job){queue.unshift(job);job=null;}const wanted=queue.splice(queue.findIndex(q=>q.palette===m.palette),1)[0];queue.unshift(wanted);}
  }
};
async function pump(){
  if(running)return;running=true;const started=performance.now();let cpuMs=0,maxSliceMs=0;
  try{
    while(job||queue.length){
      job??=queue.shift();const c=chunks[job.index];job.colors??=new Uint8Array(c.download.length*4);
      const scale=SCHEME_REGISTRY[job.palette].scaleFunction,t=performance.now();
      let processed=0;
      while(job.offset<c.download.length){const i=job.offset++;job.colors.set(scale(c.download[i]),i*4);if(++processed%128===0&&performance.now()-t>=4)break;}
      const elapsed=performance.now()-t;cpuMs+=elapsed;maxSliceMs=Math.max(maxSliceMs,elapsed);
      if(job.offset===c.download.length){
        const colors=job.colors;self.postMessage({type:'colors',id:c.id,palette:job.palette,colors},[colors.buffer]);
        self.postMessage({type:'color-transfer-proof',detached:colors.byteLength===0});
        job.index++;job.offset=0;job.colors=null;
        if(job.index===chunks.length){self.postMessage({type:'palette-ready',palette:job.palette});job=null;}
      }
      await yieldTask();
    }
    const inputBytes=chunks.reduce((n,c)=>n+c.download.byteLength,0);chunks=[];
    self.postMessage({type:'done',cpuMs,maxSliceMs,elapsedMs:performance.now()-started,releasedInputBytes:inputBytes});
  }catch(e){self.postMessage({type:'error',error:e.message});}finally{running=false;}
}

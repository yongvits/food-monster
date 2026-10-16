'use strict';
// Every locomotion pose is a separate painted frame, arranged in a 4 × 4 atlas.
// Rows 0–1: eight walk poses. Rows 2–3: eight run poses.
const animationSheets = Array.from({length:5},(_,id)=>{
  const image=new Image(); image.src=`assets/character-${id}-motion.webp`;
  return {image,frames:[],height:1,ready:false};
});

function prepareAnimation(sheet){
  const id=animationSheets.indexOf(sheet);
  sheet.frames=FRAME_RECTS[id];
  sheet.height=Math.max(...sheet.frames.map(f=>f.h));
  sheet.poses=[];sheet.pixels=[];sheet.between=new Map();
  sheet.flows=MOTION_FLOW[id].map(pair=>pair.map(encoded=>{const bytes=atob(encoded);return Int8Array.from(bytes,c=>c.charCodeAt(0));}));
  for(let index=0;index<16;index++){
    const f=sheet.frames[index],scale=104/sheet.height,canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
    const context=canvas.getContext('2d',{willReadFrequently:true}),w=Math.round(f.w*scale),h=Math.round(f.h*scale);
    context.drawImage(sheet.image,f.x,f.y,f.w,f.h,Math.round(64-FRAME_ANCHORS[id][index]*scale),120-h,w,h);
    sheet.poses.push(canvas);sheet.pixels.push(context.getImageData(0,0,128,128).data);
  }
  sheet.ready=sheet.frames.length===16;
}

function positivePhase(phase){return ((phase%8)+8)%8;}
function locomotionFrame(mode,phase,vy=0){
  if(mode==='jump')return vy<0?11:14;
  if(mode==='idle')return 0;
  return (mode==='run'?8:0)+Math.floor(positivePhase(phase));
}
function poseSamples(mode,phase,vy=0){
  if(mode==='jump'||mode==='idle')return [{index:locomotionFrame(mode,phase,vy),weight:1}];
  const p=positivePhase(phase),base=Math.floor(p),fraction=p-base,offset=mode==='run'?8:0;
  return [{index:offset+base,weight:1-fraction},{index:offset+(base+1)%8,weight:fraction}];
}
function gridVector(field,x,y,axis){
  const gx=Math.max(0,Math.min(31,x*31/127)),gy=Math.max(0,Math.min(31,y*31/127));
  const ix=Math.min(30,Math.floor(gx)),iy=Math.min(30,Math.floor(gy)),tx=gx-ix,ty=gy-iy,k=axis*1024+iy*32+ix;
  return ((field[k]*(1-tx)+field[k+1]*tx)*(1-ty)+(field[k+32]*(1-tx)+field[k+33]*tx)*ty)/2;
}
function samplePremultiplied(pixels,x,y,result){
  if(x<0||y<0||x>=127||y>=127){result.fill(0);return;}
  const ix=Math.floor(x),iy=Math.floor(y),tx=x-ix,ty=y-iy;
  result.fill(0);
  for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
    const index=((iy+dy)*128+ix+dx)*4,weight=(dx?tx:1-tx)*(dy?ty:1-ty),alpha=pixels[index+3]/255;
    result[0]+=pixels[index]*alpha*weight;result[1]+=pixels[index+1]*alpha*weight;result[2]+=pixels[index+2]*alpha*weight;result[3]+=alpha*weight;
  }
}
function interpolatedPose(sheet,index,quarter){
  if(quarter===0)return sheet.poses[index];
  const key=index*4+quarter;if(sheet.between.has(key))return sheet.between.get(key);
  const next=Math.floor(index/8)*8+(index+1)%8,t=quarter/4;
  const fields=sheet.flows[index],a=sheet.pixels[index],b=sheet.pixels[next];
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const context=canvas.getContext('2d'),out=context.createImageData(128,128);
  const pa=new Float32Array(4),pb=new Float32Array(4);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    let ax=x,ay=y,bx=x,by=y;
    for(let iteration=0;iteration<2;iteration++){
      const ux=gridVector(fields[0],ax,ay,0),uy=gridVector(fields[0],ax,ay,1);
      const vx=gridVector(fields[1],bx,by,0),vy=gridVector(fields[1],bx,by,1);
      ax=x-t*ux;ay=y-t*uy;bx=x-(1-t)*vx;by=y-(1-t)*vy;
    }
    samplePremultiplied(a,ax,ay,pa);samplePremultiplied(b,bx,by,pb);
    const alpha=pa[3]*(1-t)+pb[3]*t,k=(y*128+x)*4;
    if(alpha>.001){for(let c=0;c<3;c++)out.data[k+c]=(pa[c]*(1-t)+pb[c]*t)/alpha;out.data[k+3]=alpha*255;}
  }
  context.putImageData(out,0,0);sheet.between.set(key,canvas);return canvas;
}
function renderedPose(sheet,mode,phase,vy){
  const index=locomotionFrame(mode,phase,vy);
  const quarter=mode==='walk'||mode==='run'?Math.floor((positivePhase(phase)%1)*4):0;
  return interpolatedPose(sheet,index,quarter);
}
const poseSurface=document.createElement('canvas');poseSurface.width=128;poseSurface.height=128;
const poseContext=poseSurface.getContext('2d');
function drawLocomotion(c,id,center,feet,height,mode,phase,face=1,vy=0,transition=null){
  const sheet=animationSheets[id];if(!sheet?.ready)return false;
  const current=renderedPose(sheet,mode,phase,vy);
  let image=current;
  if(transition&&transition.amount<1){
    const t=transition.amount*transition.amount*(3-2*transition.amount);
    poseContext.clearRect(0,0,128,128);poseContext.globalCompositeOperation='lighter';
    poseContext.globalAlpha=1-t;poseContext.drawImage(renderedPose(sheet,transition.mode,transition.phase,transition.vy),0,0);
    poseContext.globalAlpha=t;poseContext.drawImage(current,0,0);poseContext.globalAlpha=1;poseContext.globalCompositeOperation='source-over';image=poseSurface;
  }
  const scale=height/104;c.save();c.translate(center,feet);c.scale(face,1);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  c.drawImage(image,-64*scale,-120*scale,128*scale,128*scale);c.restore();return true;
}
function updatePose(actor,mode,dt,rate){
  if(actor.mode!==mode){actor.transition={mode:actor.mode,phase:actor.phase,vy:actor.previousPoseVy??actor.vy,amount:0};actor.mode=mode;}
  actor.cadence+=(rate-(actor.cadence||0))*(1-Math.exp(-dt*14));actor.phase+=actor.cadence*dt;
  if(actor.transition){actor.transition.amount=Math.min(1,actor.transition.amount+dt/.10);if(actor.transition.amount===1)actor.transition=null;}
  actor.previousPoseVy=actor.vy;
}

const sceneArt=[new Image(),new Image(),new Image()],depthArt=new Image();
sceneArt[0].src='assets/world.webp';sceneArt[1].src='assets/soda-city.webp';sceneArt[2].src='assets/chocolate-factory.webp';
depthArt.src='assets/depth-props.webp';
const palettes=[
  {sky:'#a4e5e1',soil:'#b86836',edge:'#e4aa6b',grain:'#c78343',top:'#f7dca0',slab:'#ac6045',platform:'#f8d7a0',haze:'#fff0ca'},
  {sky:'#f4b5bc',soil:'#7d557d',edge:'#e595bd',grain:'#a572a0',top:'#ffd3e2',slab:'#704773',platform:'#ffaac9',haze:'#ffe0c8'},
  {sky:'#192e5d',soil:'#473244',edge:'#885852',grain:'#684756',top:'#cba0df',slab:'#493453',platform:'#c7b9ef',haze:'#8c97dc'}
];

function drawDepthLayer(front,scene,viewX,viewW,clock){
  if(!depthArt.complete||!depthArt.naturalWidth)return;
  const cw=depthArt.width/3,ch=front?604:420,sy=front?420:0;
  const speed=front?1.28:.47,spacing=front?910:780;
  const base=Math.floor(viewX*speed/spacing)-1;
  for(let n=base;n<(viewX*speed+viewW)/spacing+1;n++){
    const variant=((n%3)+3)%3, width=front?320+variant*40:400+variant*36;
    const height=width*ch/cw,x=n*spacing-viewX*speed+(front?260:150);
    // Foreground scenery remains below the playable surface, preserving hazard visibility.
    const y=front?H-95:H-115-height;
    ctx.save();ctx.globalAlpha=front?.94:.70;
    if(!front)ctx.filter='saturate(.8)';
    ctx.drawImage(depthArt,scene*cw,sy,cw,ch,x,y,width,height);
    ctx.restore();
  }
}

function renderWorldBackground(scene,viewX,clock){
  const p=palettes[scene],image=sceneArt[scene];ctx.fillStyle=p.sky;ctx.fillRect(0,0,W,H);
  if(image.complete&&image.naturalWidth){
    const width=H*image.width/image.height;
    const start=Math.floor(viewX*.12/width);
    // Mirror alternating panoramas so the repeat has no hard vertical seam.
    for(let n=start;n*width-viewX*.12<W;n++){
      const x=n*width-viewX*.12;ctx.save();ctx.translate(x,0);
      if(n%2){ctx.translate(width,0);ctx.scale(-1,1);}
      ctx.drawImage(image,0,0,width,H);ctx.restore();
    }
  }
  const haze=ctx.createLinearGradient(0,360,0,610);haze.addColorStop(0,'transparent');haze.addColorStop(1,p.haze+'35');
  ctx.fillStyle=haze;ctx.fillRect(0,360,W,250);
  drawDepthLayer(false,scene,viewX,W,clock);
  // Small drifting lights give each setting a distinct atmosphere without hiding the path.
  for(let i=0;i<18;i++){
    const x=((i*193-viewX*.25+clock*(scene===1?6:2))%(W+80)+W+80)%(W+80)-40;
    const y=100+(i*71)%430+Math.sin(clock*.6+i)*10;
    ctx.globalAlpha=scene===2?.35+.2*Math.sin(clock+i):.22;
    ctx.fillStyle=scene===2?'#f6d685':'#ffffff';ctx.beginPath();ctx.arc(x,y,scene===1?3:1.5,0,Math.PI*2);ctx.fill();
  }ctx.globalAlpha=1;
}

function waitImage(image){return new Promise((resolve,reject)=>{
  if(image.complete&&image.naturalWidth){resolve();return;}
  image.addEventListener('load',resolve,{once:true});image.addEventListener('error',()=>reject(new Error(image.src)),{once:true});
});}

const motionAssetsReady=Promise.all([
  ...animationSheets.map(async s=>{await waitImage(s.image);prepareAnimation(s);}),
  ...sceneArt.map(waitImage),waitImage(depthArt)
]).then(async()=>{
  // Bake intermediate poses once before play; gameplay only draws cached images.
  for(const sheet of animationSheets){
    for(let index=0;index<16;index++){
      for(let quarter=1;quarter<4;quarter++)interpolatedPose(sheet,index,quarter);
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    sheet.pixels=null;sheet.flows=null;
  }
});

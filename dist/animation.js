 'use strict';
// Discrete, complete poses: no optical-flow morphs or cross-faded limbs.
const animationSheets=Array.from({length:5},(_,id)=>{
  const image=new Image();image.src=`assets/character-${id}-clean.webp`;
  return {image,ready:false};
});
function prepareAnimation(sheet){
  if(sheet.image.width!==1024||sheet.image.height!==1024)throw new Error('Invalid motion atlas');
  sheet.ready=true;
}
function positivePhase(phase){return ((phase%8)+8)%8;}
function locomotionFrame(mode,phase,vy=0){
  if(mode==='jump')return vy<0?11:15;
  if(mode==='idle')return 2;
  return (mode==='run'?8:0)+Math.floor(positivePhase(phase));
}
function drawLocomotion(c,id,center,feet,height,mode,phase,face=1,vy=0){
  const sheet=animationSheets[id];if(!sheet?.ready)return false;
  const frame=locomotionFrame(mode,phase,vy),scale=height/208;
  c.save();c.translate(center,feet);c.scale(face,1);
  c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  c.drawImage(sheet.image,(frame%4)*256,Math.floor(frame/4)*256,256,256,-128*scale,-240*scale,256*scale,256*scale);
  c.restore();return true;
}
function updatePose(actor,mode,dt,rate){
  // Retain stride phase between walk/run so the planted foot does not swap.
  if(actor.mode!==mode){
    if(actor.mode==='idle'&&(mode==='walk'||mode==='run'))actor.phase=0;
    actor.mode=mode;
  }
  actor.cadence+=(rate-(actor.cadence||0))*(1-Math.exp(-dt*14));
  if(mode==='walk'||mode==='run')actor.phase=(actor.phase+actor.cadence*dt)%8;
  actor.transition=null;actor.previousPoseVy=actor.vy;
}

const sceneArt=Array.from({length:5},()=>new Image()),depthArt=new Image(),extraDepthArt=new Image();
sceneArt[0].src='assets/world.webp';sceneArt[1].src='assets/soda-city.webp';sceneArt[2].src='assets/chocolate-factory.webp';
depthArt.src='assets/depth-props.webp';extraDepthArt.src='assets/extra-depth-props.webp';sceneArt[3].src='assets/cloud-peaks.webp';sceneArt[4].src='assets/donut-coast.webp';
const palettes=[
  {sky:'#a4e5e1',soil:'#b86836',edge:'#e4aa6b',grain:'#c78343',top:'#f7dca0',slab:'#ac6045',platform:'#f8d7a0',haze:'#fff0ca'},
  {sky:'#f4b5bc',soil:'#7d557d',edge:'#e595bd',grain:'#a572a0',top:'#ffd3e2',slab:'#704773',platform:'#ffaac9',haze:'#ffe0c8'},
  {sky:'#192e5d',soil:'#473244',edge:'#885852',grain:'#684756',top:'#cba0df',slab:'#493453',platform:'#c7b9ef',haze:'#8c97dc'},
  {sky:'#9adeee',soil:'#bf863f',edge:'#edc77d',grain:'#c79e61',top:'#fff0b3',slab:'#98733c',platform:'#ffe8a0',haze:'#fff9d7'},
  {sky:'#a0e4df',soil:'#c28b64',edge:'#efb88f',grain:'#ce9d77',top:'#ffe5bf',slab:'#b46f6d',platform:'#ffd2da',haze:'#fff2d6'}
];

function drawDepthLayer(front,scene,viewX,viewW,clock){
  const art=scene<3?depthArt:extraDepthArt,col=scene<3?scene:scene-3;
  if(!art.complete||!art.naturalWidth)return;
  const cw=art.width/(scene<3?3:2),ch=scene<3?(front?604:420):(front?660:594),sy=front?(scene<3?420:594):0;
  const speed=front?1.28:.47,spacing=front?910:780;
  const base=Math.floor(viewX*speed/spacing)-1;
  for(let n=base;n<(viewX*speed+viewW)/spacing+1;n++){
    const variant=((n%3)+3)%3, width=front?320+variant*40:400+variant*36;
    const height=width*ch/cw,x=n*spacing-viewX*speed+(front?260:150);
    // Foreground scenery remains below the playable surface, preserving hazard visibility.
    const y=front?H-95:H-115-height;
    ctx.save();ctx.globalAlpha=front?.94:1;
    ctx.drawImage(art,col*cw,sy,cw,ch,x,y,width,height);
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
  ...animationSheets.map(async sheet=>{await waitImage(sheet.image);prepareAnimation(sheet);}),
  ...sceneArt.map(waitImage),waitImage(depthArt),waitImage(extraDepthArt)
]);

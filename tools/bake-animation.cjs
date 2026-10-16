const fs=require('fs'),vm=require('vm'),path=require('path');
const {createCanvas:nativeCanvas,loadImage}=require(require.resolve('@napi-rs/canvas',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]}));
const dir=process.cwd()+'/dist';const noop=()=>{};
function createCanvas(w,h){const c=nativeCanvas(w,h),q=c.getContext('2d'),proxy=new Proxy(q,{get(t,k){if(k==='drawImage')return (im,...a)=>t.drawImage(im.native||im,...a);const v=t[k];return typeof v==='function'?v.bind(t):v;},set(t,k,v){t[k]=v;return true;}});c.getContext=()=>proxy;return c;}
class BrowserImage {
 constructor(){this.listeners={load:[],error:[]};this.complete=false;this.width=0;this.height=0;}
 set src(src){this.url=src;let p=path.join(dir,src);if(!fs.existsSync(p))p=path.join(dir,src.includes('motion')?'assets/character-0-motion.webp':src.includes('depth')?'assets/monsters.webp':'assets/world.webp');loadImage(fs.readFileSync(p)).then(im=>{this.native=im;this.width=im.width;this.height=im.height;this.complete=true;this.onload?.();this.listeners.load.forEach(fn=>fn());});}
 get src(){return this.url;}get naturalWidth(){return this.width;}
 addEventListener(name,fn){this.listeners[name].push(fn);}
}
const canvas=createCanvas(1280,720);canvas.getBoundingClientRect=()=>({width:1280,height:720});
const nodes={'#game':canvas};function el(){return {classList:{add:noop,remove:noop,toggle:noop},style:{},setAttribute:noop,append:noop,addEventListener:noop,querySelector:()=>{const c=createCanvas(210,126);c.parentElement={};return c;}}}
const sandbox={document:{querySelector:s=>nodes[s]??=el(),createElement:t=>t==='canvas'?createCanvas(1,1):el(),querySelectorAll:()=>[],addEventListener:noop},Image:BrowserImage,addEventListener:noop,requestAnimationFrame:noop,setTimeout,atob,Math,console,location:{reload:noop}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('tools/frame-data.js','utf8'),sandbox);vm.runInContext(fs.readFileSync('tools/flow-data.js','utf8'),sandbox);vm.runInContext(fs.readFileSync('tools/motion-source.js','utf8'),sandbox);vm.runInContext(fs.readFileSync('dist/game.js','utf8'),sandbox);
(async()=>{await vm.runInContext('motionAssetsReady',sandbox);
for(let id=0;id<5;id++){
 const out=createCanvas(1024,1024),q=out.getContext('2d');sandbox.exportContext=q;
 for(let frame=0;frame<64;frame++){
   const index=Math.floor(frame/4),quarter=frame%4;
   vm.runInContext(`exportContext.drawImage(interpolatedPose(animationSheets[${id}],${index},${quarter}),${frame%8*128},${Math.floor(frame/8)*128})`,sandbox);
 }
 fs.writeFileSync(`dist/assets/character-${id}-smooth.png`,out.toBuffer('image/png'));console.log('Baked',id,64,'frames');
}
})().catch(e=>{console.error(e);process.exitCode=1});

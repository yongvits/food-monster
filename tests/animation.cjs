const assert=require('assert'),fs=require('fs'),vm=require('vm');
const {createCanvas,loadImage}=require(require.resolve('@napi-rs/canvas',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]}));
const ctx={Image:class{},document:{createElement(){return createCanvas(1,1)}}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('dist/animation.js','utf8').split('const sceneArt=')[0],ctx);
for(const mode of ['walk','run']){
 const indices=Array.from({length:8},(_,i)=>vm.runInContext(`locomotionFrame('${mode}',${i})`,ctx));
 assert.equal(new Set(indices).size,8);assert.equal(vm.runInContext(`locomotionFrame('${mode}',8)`,ctx),indices[0]);
}
(async()=>{
 for(let id=0;id<5;id++){
  const im=await loadImage(`dist/assets/character-${id}-clean.webp`);assert.equal(im.width,1024);assert.equal(im.height,1024);
  const c=createCanvas(256,256),q=c.getContext('2d');
  for(let f=0;f<16;f++){
   q.clearRect(0,0,256,256);q.drawImage(im,f%4*256,Math.floor(f/4)*256,256,256,0,0,256,256);
   const {data}=q.getImageData(0,0,256,256);let count=0;
   for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(data[(y*256+x)*4+3]>16){count++;assert(x>=8&&x<248&&y>=8&&y<248,`Clipped hero ${id}, frame ${f}`);}
   assert(count>3000,`Missing body ${id}:${f}`);
  }
 }
 console.log('PASS: 80 populated poses with safe transparent margins; both gait cycles wrap correctly');
})().catch(e=>{console.error(e);process.exitCode=1});

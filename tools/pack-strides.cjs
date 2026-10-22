// Build engine atlases from isolated generated poses, retaining only each body silhouette.
// Never synthesize intermediate frames or deform a sprite.
const fs=require('fs');
const {createCanvas,loadImage}=require(require.resolve('@napi-rs/canvas',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]}));
(async()=>{
 for(let id=0;id<5;id++){
  const src=await loadImage(`tools/stride-source-${id}.webp`);
  const source=createCanvas(src.width,src.height),sq=source.getContext('2d');sq.drawImage(src,0,0);
  const pixels=sq.getImageData(0,0,src.width,src.height),d=pixels.data,w=src.width,h=src.height;
  const seen=new Uint8Array(w*h),components=[];
  for(let p=0;p<w*h;p++){
   if(seen[p]||d[p*4+3]<128)continue;
   const list=[p];seen[p]=1;let x0=w,y0=h,x1=0,y1=0;
   for(let q=0;q<list.length;q++){
    const at=list[q],x=at%w,y=Math.floor(at/w);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
    for(const n of [x>0?at-1:-1,x<w-1?at+1:-1,y>0?at-w:-1,y<h-1?at+w:-1])if(n>=0&&!seen[n]&&d[n*4+3]>=128){seen[n]=1;list.push(n);}
   }
   if(list.length>1000)components.push({list,x:x0,y:y0,w:x1-x0+1,h:y1-y0+1});
  }
  components.sort((a,b)=>b.list.length-a.list.length);
  if(components.length<16)throw Error(`Hero ${id}: only ${components.length} complete bodies found`);
  const bodies=components.slice(0,16).sort((a,b)=>(a.y+a.h/2)-(b.y+b.h/2));
  const boxes=[];
  for(let row=0;row<4;row++)boxes.push(...bodies.slice(row*4,row*4+4).sort((a,b)=>a.x-b.x));
  const atlas=createCanvas(1024,1024),ctx=atlas.getContext('2d');
  const scale=Math.min(208/Math.max(...boxes.map(b=>b.h)),224/Math.max(...boxes.map(b=>b.w)));
  boxes.forEach((b,f)=>{
   const cell=createCanvas(b.w+4,b.h+4),q=cell.getContext('2d'),out=q.createImageData(cell.width,cell.height);
   // Main opaque component plus its immediate antialiased border. Detached scraps are excluded.
   const mask=new Set();
   for(const at of b.list)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const x=at%w+dx,y=Math.floor(at/w)+dy;if(x>=0&&x<w&&y>=0&&y<h)mask.add(y*w+x);
   }
   for(const at of mask){const x=at%w-b.x+2,y=Math.floor(at/w)-b.y+2;if(x<0||x>=cell.width||y<0||y>=cell.height)continue;out.data.set(d.subarray(at*4,at*4+4),(y*cell.width+x)*4);}
   q.putImageData(out,0,0);
   ctx.drawImage(cell,(f%4)*256+128-cell.width*scale/2,Math.floor(f/4)*256+240-cell.height*scale,cell.width*scale,cell.height*scale);
  });
  fs.writeFileSync(`dist/assets/character-${id}-clean.webp`,atlas.toBuffer('image/webp',95));
  console.log(`Hero ${id}: 16 isolated poses, shared scale ${scale.toFixed(3)}, atlas 1024x1024`);
 }
})().catch(e=>{console.error(e);process.exitCode=1});

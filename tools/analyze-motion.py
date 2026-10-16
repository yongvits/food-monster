import json,base64
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import zoom,map_coordinates,gaussian_filter
src=Path(__file__).resolve().parents[1]/'dist'
s=(src.parent/'tools/frame-data.js').read_text();rects=json.loads(s.split('const FRAME_RECTS=')[1].split(';')[0]);anchors=json.loads(s.split('const FRAME_ANCHORS=')[1].split(';')[0]);N=128

def feature(im):
 a=im[:,:,3];rgb=im[:,:,:3];return np.stack((a,(rgb[:,:,0]*.299+rgb[:,:,1]*.587+rgb[:,:,2]*.114)*a),axis=-1)
def flow(a,b):
 uv=None
 for size in [16,32,64,128]:
  aa=zoom(a,(size/N,size/N,1),order=1);bb=zoom(b,(size/N,size/N,1),order=1)
  if uv is None:uv=np.zeros((2,size,size),dtype=np.float32)
  else:uv=zoom(uv,(1,2,2),order=1)*2
  yy,xx=np.mgrid[:size,:size].astype(np.float32)
  gy,gx=np.gradient(bb,axis=(0,1))
  for _ in range(30):
   coords=[yy+uv[1],xx+uv[0]]
   warped=np.stack([map_coordinates(bb[:,:,c],coords,order=1,mode='constant') for c in range(2)],axis=-1)
   ix=np.stack([map_coordinates(gx[:,:,c],coords,order=1,mode='constant') for c in range(2)],axis=-1)
   iy=np.stack([map_coordinates(gy[:,:,c],coords,order=1,mode='constant') for c in range(2)],axis=-1)
   diff=aa-warped;den=(ix*ix+iy*iy).sum(axis=2)+.003
   dx=np.clip((diff*ix).sum(axis=2)/den,-1.5,1.5)
   dy=np.clip((diff*iy).sum(axis=2)/den,-1.5,1.5)
   uv[0]=gaussian_filter(uv[0]+dx*.7,.7);uv[1]=gaussian_filter(uv[1]+dy*.7,.7)
 return uv
all_data=[]
for id in range(5):
 im=Image.open(src/f'assets/character-{id}-motion.webp');height=max(r['h'] for r in rects[id]);poses=[]
 for i,r in enumerate(rects[id]):
  k=104/height;w=round(r['w']*k);h=round(r['h']*k)
  piece=im.crop((r['x'],r['y'],r['x']+r['w'],r['y']+r['h'])).resize((w,h),Image.Resampling.LANCZOS)
  pose=Image.new('RGBA',(N,N));pose.paste(piece,(round(64-anchors[id][i]*k),120-h));poses.append(feature(np.array(pose,dtype=np.float32)/255))
 pair=[]
 for i in range(16):
  j=(i//8)*8+(i+1)%8
  fields=[]
  for a,b in [(poses[i],poses[j]),(poses[j],poses[i])]:
   f=flow(a,b);small=zoom(f,(1,.25,.25),order=1)
   q=np.clip(np.round(small*2),-127,127).astype(np.int8)
   fields.append(base64.b64encode(q.tobytes()).decode())
  pair.append(fields)
 all_data.append(pair);print('analyzed',id,flush=True)
(src.parent/'tools/flow-data.js').write_text('// Motion vectors between adjacent painted poses, at quarter resolution.\nconst MOTION_FLOW='+json.dumps(all_data,separators=(',',':'))+';\n')

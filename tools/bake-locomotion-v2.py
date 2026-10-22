"""Normalize generated key poses and bake flow in-betweens; runtime only draws atlas frames."""
import base64,json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import zoom,map_coordinates,gaussian_filter
root=Path(__file__).resolve().parents[1]
# Reuse the repository's bidirectional motion estimator without its batch driver.
source=(root/'tools/analyze-motion.py').read_text()
exec(source[source.index('def feature'):source.index('all_data=[]')])
N=128
sheet=Image.open(root/'tools/locomotion-source.png').convert('RGBA')
bounds=[0,232,405,607,782,sheet.height]
for hero in range(5):
 pieces=[]
 for col in range(8):
  cell=sheet.crop((round(col*sheet.width/8),bounds[hero],round((col+1)*sheet.width/8),bounds[hero+1]))
  box=cell.getchannel('A').point(lambda x:255 if x>50 else 0).getbbox()
  pieces.append(cell.crop(box))
 scale=min(104/max(p.height for p in pieces),116/max(p.width for p in pieces))
 poses=[]
 for p in pieces:
  p=p.resize((round(p.width*scale),round(p.height*scale)),Image.Resampling.LANCZOS)
  im=Image.new('RGBA',(N,N));im.alpha_composite(p,((N-p.width)//2,120-p.height));poses.append(np.asarray(im).astype(np.float32)/255)
 atlas=Image.new('RGBA',(1024,1024))
 yy,xx=np.mgrid[:N,:N].astype(np.float32)
 for index in range(8):
  nxt=index//4*4+(index+1)%4
  a,b=poses[index],poses[nxt];u=flow(feature(a),feature(b));v=flow(feature(b),feature(a))
  for sub in range(8):
   t=sub/8;pa=a.copy();pb=b.copy();pa[:,:,:3]*=pa[:,:,3:];pb[:,:,:3]*=pb[:,:,3:]
   ax=xx-t*u[0];ay=yy-t*u[1];bx=xx-(1-t)*v[0];by=yy-(1-t)*v[1]
   wa=np.stack([map_coordinates(pa[:,:,c],[ay,ax],order=1,mode='constant') for c in range(4)],axis=-1)
   wb=np.stack([map_coordinates(pb[:,:,c],[by,bx],order=1,mode='constant') for c in range(4)],axis=-1)
   out=wa*(1-t)+wb*t;out[:,:,:3]/=np.maximum(out[:,:,3:],.001)
   im=Image.fromarray(np.uint8(np.clip(out*255,0,255)))
   frame=index*8+sub;atlas.paste(im,((frame%8)*128,(frame//8)*128))
 atlas.save(root/f'dist/assets/character-{hero}-stride.webp',quality=92,method=6)
 print('Baked hero',hero,flush=True)

'use strict';
const enemyArt=new Image();enemyArt.src='assets/enemies.webp';
const powers={mega:0,shield:0,magnet:0};let pickups=[],powerHudClock=0;
const powerInfo={mega:{label:'MEGA',duration:12,color:'#ffb253',symbol:'↗'},shield:{label:'SHIELD',duration:15,color:'#7fcbff',symbol:'◇'},magnet:{label:'MAGNET',duration:12,color:'#d6a5ff',symbol:'∩'},heart:{label:'HEART',color:'#ff8d9d',symbol:'+'}};
function setPlayerSize(large){
 const w=large?76:46,h=large?112:68;
 if(player.h===h)return true;
 const next={x:player.x+(player.w-w)/2,y:player.y+player.h-h,w,h};
 if(large&&platforms.some(p=>!p.broken&&overlap(next,p)))return false;
 Object.assign(player,next);return true;
}
function resetPowers(){Object.keys(powers).forEach(k=>powers[k]=0);if(player)setPlayerSize(false);}
function initPickups(gaps){
 resetPowers();pickups=[];powerHudClock=0;
 const kinds=['mega','shield','magnet','heart'];
 for(let i=0,x=340;x<world-650;i++,x+=730){
  if(gaps.some(([a,b])=>x>a-80&&x<b+80))continue;
  pickups.push({x,y:548,w:40,h:40,type:kinds[i%4],got:false});
 }
 // Two-block walls can always be jumped over; Mega breaks them on contact.
 for(let x=920;x<world-750;x+=1460){
  if(gaps.some(([a,b])=>x>a-100&&x<b+100))continue;
  for(let row=0;row<2;row++)platforms.push({x,y:600-(row+1)*48,w:48,h:48,breakable:true});
 }
}
function collectPower(item){
 if(item.type==='mega'&&!setPlayerSize(true))return false;
 item.got=true;
 if(item.type==='heart'){hp=Math.min(stats[selected].hp,hp+1);notice('Heart restored');}
 else{powers[item.type]=powerInfo[item.type].duration;notice(item.type==='mega'?'Mega · smash blocks and enemies for 12s':item.type==='shield'?'Shield · blocks one hit for 15s':'Magnet · attracts stars for 12s');}
 burst(item.x+20,item.y+20,powerInfo[item.type].color,22);tone(780,.22);return true;
}
function tickPowers(dt){
 for(const key of Object.keys(powers))powers[key]=Math.max(0,powers[key]-dt);
 if(!powers.mega)setPlayerSize(false);
 for(const item of pickups)if(!item.got&&overlap(player,item))collectPower(item);
 if(powers.magnet)for(const c of coins)if(!c.got){const dx=player.x+player.w/2-c.x,dy=player.y+player.h/2-c.y;if(Math.hypot(dx,dy)<230){c.x+=dx*Math.min(1,dt*9);c.y+=dy*Math.min(1,dt*9);}}
 powerHudClock-=dt;if(powerHudClock>0)return;powerHudClock=.1;
 const active=Object.keys(powers).filter(k=>powers[k]>0);
 $('#powerHud').innerHTML=active.map(k=>`<div class="power-chip" style="--power:${powerInfo[k].color}"><span>${powerInfo[k].label}</span><b>${Math.ceil(powers[k])}s</b><i style="width:${powers[k]/powerInfo[k].duration*100}%"></i></div>`).join('');
}
function breakBlock(p){p.broken=true;score+=2;burst(p.x+p.w/2,p.y+p.h/2,'#ffc987',18);tone(145,.10,'triangle');}
function updateEnemy(e,dt){
 e.hitCooldown=Math.max(0,(e.hitCooldown||0)-dt);e.phase=(e.phase||0)+dt;
 e.x+=e.dir*e.speed*dt;
 if(e.x<e.minX){e.x=e.minX;e.dir=1;}if(e.x>e.maxX){e.x=e.maxX;e.dir=-1;}
 if(e.kind===2)e.y=e.baseY+Math.sin(e.phase*2.7)*45;
 if(e.kind===4)e.y=e.baseY-Math.abs(Math.sin(e.phase*3.4))*110;
}
function spawnEnemy(x,i,gaps){
 const kind=(i+level)%5,w=[54,42,68,55,48][kind],h=[48,62,42,54,52][kind];
 const ground=platforms.find(p=>p.ground&&x>=p.x&&x+w<=p.x+p.w);if(!ground)return;
 const baseY=kind===2?430:600-h;
 enemies.push({x,y:baseY,w,h,base:x,baseY,kind,phase:i*.6,minX:Math.max(ground.x+10,x-110),maxX:Math.min(ground.x+ground.w-w-10,x+110),dir:i%2?1:-1,speed:[55,115,80,38,65][kind]+level*8,alive:true,hits:kind===3?2:1});
}
function drawEnemy(e){
 const bob=e.kind===2?0:Math.sin(e.phase*9)*2;
 if(enemyArt.complete&&enemyArt.naturalWidth){
  const id=e.boss?5:e.kind,cw=enemyArt.width/3,ch=enemyArt.height/2;
  ctx.save();ctx.translate(e.x+e.w/2,e.y+e.h/2+bob);ctx.scale(e.dir>0?-1:1,1);ctx.rotate(e.kind===2?Math.sin(e.phase*8)*.09:Math.sin(e.phase*8)*.025);
  const size=Math.max(e.w,e.h)*1.35;ctx.drawImage(enemyArt,(id%3)*cw,Math.floor(id/3)*ch,cw,ch,-size/2,-size/2,size,size);ctx.restore();
 }else sprite(ctx,5,e.x-8,e.y-8,e.w+16,e.h+16,e.dir>0);
 if(e.boss||e.kind===3){rr(e.x,e.y-13,e.w,4,2,'#20302b66');rr(e.x,e.y-13,e.w*e.hits/(e.boss?3:2),4,2,e.boss?'#ccff78':'#fff1bd');}
}
function drawPowerObjects(){
 for(const item of pickups){if(item.got||item.x<camera-60||item.x>camera+W+60)continue;const info=powerInfo[item.type],y=item.y+Math.sin(time*3+item.x)*5;
  ctx.save();ctx.shadowColor=info.color;ctx.shadowBlur=16;rr(item.x,y,40,40,13,info.color);ctx.shadowBlur=0;ctx.strokeStyle='#fff9';ctx.lineWidth=2;ctx.strokeRect(item.x+8,y+8,24,24);ctx.fillStyle='#21312b';ctx.textAlign='center';ctx.font='bold 27px sans-serif';ctx.fillText(info.symbol,item.x+20,y+29);ctx.restore();
 }
}
function drawPowerAura(){
 if(!powers.shield&&!powers.magnet&&!powers.mega)return;
 ctx.save();ctx.strokeStyle=powers.shield?'#b9ebff':powers.mega?'#ffbd66':'#e3b9ff';ctx.lineWidth=3;ctx.globalAlpha=.65+.2*Math.sin(time*5);ctx.beginPath();ctx.ellipse(player.x+player.w/2,player.y+player.h/2,player.w*.8,player.h*.65,0,0,Math.PI*2);ctx.stroke();ctx.restore();
}

'use strict';
const $=s=>document.querySelector(s),canvas=$('#game'),ctx=canvas.getContext('2d');
const names=['Pretzel King','Grumpy Toast','Eggy Loaf','Muscle Cloud','Sausage Donut'];
const abilities=['High jump · Agile','Extra health · Steady pace','Float longer · Soft landing','Extra health · Strong dash','Fast runner · Long dash'];
const stats=[{speed:340,jump:790,hp:3},{speed:295,jump:770,hp:4},{speed:310,jump:700,hp:3,gravity:1250},{speed:300,jump:780,hp:4},{speed:385,jump:780,hp:3}];
const stageNames=['BURGER VALLEY','SODA CITY','CHOCOLATE FACTORY','CLOUD PEAKS','DONUT COAST'];
let chosenScene=0,assetsReady=false,previewClock=0;
const previewPose={mode:'walk',phase:0,cadence:9,vy:0};
let selected=0,state='menu',level=0,score=0,hp=3,camera=0,W=1280,H=720,world=5500,time=0,checkpoint=80,player,platforms=[],coins=[],enemies=[],particles=[],keys={},jumpBuffer=0,coyote=0,dashTime=0,dashCooldown=0,invincible=0,toastTimer=0,previous=0,sound=true,audio;
const atlas=new Image();atlas.src='assets/monsters.webp';
const cards=[];names.forEach((name,i)=>{const b=document.createElement('button');b.className='character'+(i===0?' active':'');b.innerHTML=`<span>0${i+1}</span><canvas width="210" height="126"></canvas><b>${name}</b>`;b.setAttribute('aria-label','Select '+name);b.onclick=()=>{if(state!=='menu')return;selected=i;$('.character.active')?.classList.remove('active');b.classList.add('active');$('#ability').textContent=abilities[i];if($('#followCharacter').checked)selectScene(i);};$('#characters').append(b);cards.push(b.querySelector('canvas'));});
function sprite(c,id,x,y,w,h,flip=false,angle=0){if(!atlas.complete||!atlas.naturalWidth)return;const sw=atlas.width/3,sh=atlas.height/2;c.save();c.translate(x+w/2,y+h/2);c.rotate(angle);if(flip)c.scale(-1,1);const sx=id===3?20:(id%3)*sw,sy=id===3?540:Math.floor(id/3)*sh,sww=id===3?530:sw,shh=id===3?484:sh;c.drawImage(atlas,sx,sy,sww,shh,-w/2,-h/2,w,h);c.restore();}
function paintCards(){cards.forEach((c,i)=>{const q=c.getContext('2d');q.clearRect(0,0,c.width,c.height);sprite(q,i,35,-9,140,140);});}atlas.onload=paintCards;
function resize(){const r=canvas.getBoundingClientRect();W=Math.max(360,Math.round(720*r.width/r.height));canvas.width=W;canvas.height=H;}addEventListener('resize',resize);resize();
function tone(f,d=.09,type='sine'){if(!sound)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(f,audio.currentTime);o.frequency.exponentialRampToValueAtTime(f*.6,audio.currentTime+d);g.gain.setValueAtTime(.08,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+d);}catch{}}
function toggleSound(){sound=!sound;if(sound)Music.unlock();for(const b of document.querySelectorAll('[data-sound]')){b.setAttribute('aria-label',sound?'Mute sound':'Enable sound');b.setAttribute('aria-pressed',String(sound));b.classList.toggle('muted',!sound);}Music.update();}
$('#sound').onclick=toggleSound;$('#mobileSound').onclick=toggleSound;$('#musicVolume').oninput=e=>Music.setVolume(Number(e.target.value)/100);
function notice(t){$('#toast').textContent=t;$('#toast').style.opacity=1;toastTimer=2.5;}
function initStage(){world=5500+level*700;camera=0;checkpoint=80;platforms=[];coins=[];enemies=[];particles=[];player={x:80,y:460,w:46,h:68,vx:0,vy:0,face:1,on:false,phase:0,mode:'idle',cadence:0,jumpsUsed:0};dashCooldown=0;dashTime=0;invincible=1;jumpBuffer=0;coyote=0;keys={};
const gaps=[[[1330,1450],[2820,2980],[4280,4440]],[[1200,1350],[2380,2560],[3790,3990],[5050,5220]],[[1180,1340],[2260,2460],[3580,3770],[4850,5040]],[[1440,1590],[2940,3120],[4440,4620],[5940,6120]],[[1200,1380],[2520,2690],[3900,4100],[5280,5470],[6660,6840]]][level];
let start=0;gaps.forEach(([a,b])=>{platforms.push({x:start,y:600,w:a-start,h:140,ground:true});start=b;});platforms.push({x:start,y:600,w:world-start,h:140,ground:true});
for(let n=0;n<12+level*2;n++){const x=420+n*365;platforms.push({x,y:440-(n%3===1?90:0),w:n%3===1?160:190,h:30});for(let j=0;j<3;j++)coins.push({x:x+35+j*52,y:platforms.at(-1).y-48,got:false});if(n%2===0)platforms.push({x:x+220,y:505,w:100,h:30});}
for(let x=300;x<world-400;x+=190){if(!gaps.some(([a,b])=>x>a-20&&x<b+20))coins.push({x,y:545,got:false});}
for(let i=0;i<10+level*3;i++){let x=720+i*360;if(x>world-650)break;if(!gaps.some(([a,b])=>x>a-100&&x<b+100))spawnEnemy(x,i,gaps);}
if(level===stageNames.length-1)enemies.push({x:world-540,y:492,w:115,h:108,base:world-540,range:160,minX:world-700,maxX:world-350,phase:0,kind:5,dir:-1,speed:95,alive:true,hits:3,boss:true});
initPickups(gaps);$('#stage').textContent=`0${level+1} / ${stageNames[level]}`;$('#levelLabel').textContent=stageNames[level];updateHud();}
function updateHud(){$('#score').textContent=String(score).padStart(3,'0');$('#life').textContent=hp;$('#progress').style.width=Math.min(100,player?player.x/(world-160)*100:0)+'%';}
function startGame(){if(!assetsReady)return;if(sound)Music.unlock();level=chosenScene;score=0;hp=stats[selected].hp;state='play';$('#menu').classList.add('hidden');$('#modal').classList.add('hidden');cards.forEach(c=>c.parentElement.disabled=true);initStage();notice('Tap jump twice · Jump through platforms · Hold run');document.querySelectorAll('[data-scene]').forEach(b=>b.disabled=true);}
$('#play').onclick=startGame;
$('#play').disabled=true;$('#play').textContent='Loading…';
Promise.all([motionAssetsReady,waitImage(enemyArt)]).then(()=>{assetsReady=true;$('#play').disabled=false;$('#play').textContent='Play';}).catch(()=>{$('#play').disabled=false;$('#play').textContent='Reload';$('#play').onclick=()=>location.reload();notice('Assets could not load. Please reload.');});
function selectScene(index){
 if(state!=='menu')return;chosenScene=index;level=index;camera=0;
 document.querySelectorAll('[data-scene]').forEach(button=>{const active=Number(button.dataset.scene)===index;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
 $('#stage').textContent=`0${index+1} / ${stageNames[index]}`;$('#levelLabel').textContent=stageNames[index];
 $('#musicTheme').textContent=MUSIC_THEMES[index].name;
}
document.querySelectorAll('[data-scene]').forEach(b=>b.onclick=()=>{if(state!=='menu')return;$('#followCharacter').checked=false;selectScene(Number(b.dataset.scene));});
$('#followCharacter').onchange=()=>{if($('#followCharacter').checked)selectScene(selected);};
function modal(k,title,txt,button){$('#modalKicker').textContent=k;$('#modalTitle').textContent=title;$('#modalText').textContent=txt;$('#resume').textContent=button;$('#modal').classList.remove('hidden');keys={};Music.stop();}
function pause(){if(state==='play'){state='pause';modal('TAKE A SNACK BREAK','Paused','Take your time. Your adventure is right here.','Resume');}else if(state==='pause'){state='play';$('#modal').classList.add('hidden');}}
$('#pause').onclick=pause;$('#resume').onclick=()=>{if(sound)Music.unlock();if(state==='pause'){state='play';$('#modal').classList.add('hidden');}else if(state==='clear'){level++;hp=Math.min(stats[selected].hp,hp+1);initStage();state='play';$('#modal').classList.add('hidden');}else startGame();};
$('#home').onclick=()=>{state='menu';resetPowers();$('#powerHud').innerHTML='';$('#modal').classList.add('hidden');$('#menu').classList.remove('hidden');cards.forEach(c=>c.parentElement.disabled=false);document.querySelectorAll('[data-scene]').forEach(b=>b.disabled=false);level=chosenScene;camera=0;$('#stage').textContent=`0${level+1} / ${stageNames[level]}`;};
function press(k){if(['Space','ArrowUp','KeyW'].includes(k)&&!['Space','ArrowUp','KeyW'].some(key=>keys[key]))jumpBuffer=.14;if(k==='Shift'&&!keys[k]&&dashCooldown<=0&&state==='play'){dashTime=.19;dashCooldown=1.1;tone(180,.12,'sawtooth');}keys[k]=true;}
addEventListener('keydown',e=>{if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','ShiftLeft','ShiftRight'].includes(e.code))e.preventDefault();if(e.code==='Escape'||e.code==='KeyP'){if(!e.repeat)pause();return;}press(e.code.startsWith('Shift')?'Shift':e.code);});addEventListener('keyup',e=>{keys[e.code.startsWith('Shift')?'Shift':e.code]=false;if(['Space','ArrowUp','KeyW'].includes(e.code)&&player?.vy<-260)player.vy=-260;});
addEventListener('blur',()=>{keys={};if(state==='play')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='play')pause();});
function overlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function burst(x,y,color='#fff29b',n=12){for(let i=0;i<n;i++)particles.push({x,y,vx:(Math.random()-.5)*300,vy:-Math.random()*260,life:.65,color});}
function hurt(fall=false){if(invincible>0&&!fall)return;if(!fall&&powers.shield){powers.shield=0;invincible=1.5;notice('Shield absorbed the hit');tone(500,.18);return;}if(!fall&&powers.mega)return;if(fall)resetPowers();hp--;tone(120,.3,'triangle');burst(player.x,player.y,'#ff8c70');if(hp<=0){state='dead';modal('ONE MORE BITE?','Try again',score+' stars collected. Find your rhythm and reach the exit.','Restart');}else{invincible=1.8;if(fall){player.x=checkpoint;player.y=400;player.vx=0;player.vy=0;player.jumpsUsed=0;player.on=false;coyote=0;jumpBuffer=0;}else{player.vy=-380;player.vx=-player.face*220;}updateHud();}}
function tick(dt){if(state==='play'||state==='menu')time+=dt;if(state==='menu'){previewClock+=dt;const mode=Math.floor(previewClock/3)%2?'run':'walk';updatePose(previewPose,mode,dt,mode==='run'?14:10);}if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('#toast').style.opacity=0;}if(state!=='play')return;tickPowers(dt);const s=stats[selected];jumpBuffer-=dt;coyote-=dt;dashTime-=dt;dashCooldown-=dt;invincible-=dt;const oldY=player.y;
let direction=(keys.ArrowRight||keys.KeyD?1:0)-(keys.ArrowLeft||keys.KeyA?1:0);if(direction)player.face=direction;const running=!!keys.Shift;const target=direction*s.speed*(running?1.15:.76);player.vx+=(target-player.vx)*(1-Math.exp(-dt*14));if(dashTime>0)player.vx=player.face*(selected===3?820:760);
if(player.on){coyote=.1;player.jumpsUsed=0;}
// Leaving a ledge consumes the ground jump after the coyote window.
if(!player.on&&coyote<=0&&player.jumpsUsed===0)player.jumpsUsed=1;
if(jumpBuffer>0&&(coyote>0||player.jumpsUsed<2)){
 const airJump=!(player.on||coyote>0);
 player.jumpsUsed=airJump?2:1;player.vy=-s.jump*(airJump?.92:1);
 player.on=false;coyote=0;jumpBuffer=0;
 tone(airJump?820:620,.13);burst(player.x+player.w/2,player.y+player.h,airJump?'#a8f0ff':'#fff6d0',airJump?16:5);
}
player.vy+=((dashTime>0)?200:(s.gravity||1700))*dt;
player.x+=player.vx*dt;player.x=Math.max(0,Math.min(world-60,player.x));
// Floating platforms are one-way. Crates retain side collisions for Mega smashing.
for(const p of platforms)if(!p.broken&&p.breakable&&overlap(player,p)&&oldY+player.h>p.y+4&&oldY<p.y+p.h-4){
 if(powers.mega&&(keys.Shift||Math.abs(player.vx)>160)){breakBlock(p);continue;}
 if(player.vy<0)continue;
 if(player.vx>0)player.x=p.x-player.w;else if(player.vx<0)player.x=p.x+p.w;
 player.vx=0;
}
player.y+=player.vy*dt;player.on=false;
// Swept top crossing prevents tunnelling and never catches a player from below.
if(player.vy>=0){
 let landing=null;
 for(const p of platforms)if(!p.broken&&player.x<p.x+p.w&&player.x+player.w>p.x&&oldY+player.h<=p.y+.01&&player.y+player.h>=p.y){
  if(!landing||p.y<landing.y)landing=p;
 }
 if(landing){player.y=landing.y-player.h;player.vy=0;player.on=true;player.jumpsUsed=0;}
}else if(powers.mega){
 for(const p of platforms)if(!p.broken&&p.breakable&&overlap(player,p))breakBlock(p);
}
if(player.y>850){hurt(true);return;}
const speed=Math.abs(player.vx);
const poseMode=!player.on?'jump':speed<12?'idle':(running||dashTime>0?'run':'walk');
const cadence=player.on&&speed>=12?(poseMode==='run'?18:12)*Math.max(.45,Math.min(1.35,speed/(s.speed*(running?1.15:.76)))):0;
updatePose(player,poseMode,dt,cadence);
if(player.x>world*.5&&checkpoint<world*.5){checkpoint=Math.floor(world*.5)+100;const safe=platforms.find(p=>p.ground&&checkpoint>=p.x&&checkpoint<p.x+p.w-70);if(!safe)checkpoint=platforms.find(p=>p.ground&&p.x>checkpoint).x+50;notice('Checkpoint saved');tone(880,.22);}
for(const c of coins)if(!c.got&&Math.abs(player.x+player.w/2-c.x)<player.w/2+18&&Math.abs(player.y+player.h/2-c.y)<player.h/2+18){c.got=true;score++;tone(1100,.06);burst(c.x,c.y);}
for(const e of enemies){if(!e.alive)continue;updateEnemy(e,dt);if(overlap(player,e)){
 const stomp=player.vy>30&&oldY+player.h<e.y+28;
 if((stomp||powers.mega>0||(dashTime>0&&!e.boss))&&e.hitCooldown<=0){
  e.hits--;e.hitCooldown=.5;if(stomp){player.vy=-470;player.jumpsUsed=1;}burst(e.x+e.w/2,e.y,'#dda7ff',20);tone(300,.1,'square');
  if(e.hits<=0){e.alive=false;score+=e.boss?25:5;}else{invincible=.6;notice(e.boss?'Boss: '+e.hits+' hits left':'Armor cracked · one more hit');}
 }else if(!powers.mega&&e.hitCooldown<=0)hurt();
}}
for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=650*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0);camera+=(Math.max(0,Math.min(world-W,player.x-W*.32))-camera)*(1-Math.exp(-dt*7));
if(player.x>world-190){if(level===stageNames.length-1&&enemies.some(e=>e.boss&&e.alive)){player.x=world-195;notice('Defeat the boss to open the exit');}else{state=level===stageNames.length-1?'win':'clear';tone(900,.4);modal(level===stageNames.length-1?'YOU ARE THE SNACK LEGEND':'LEVEL COMPLETE',level===stageNames.length-1?'Delicious victory':'Stage complete',`${score} stars collected${level===stageNames.length-1?' · The snack crew is home':' · Next: '+stageNames[level+1]}`,level===stageNames.length-1?'Play again':'Next stage');}}updateHud();}
function rr(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function star(x,y,r){ctx.save();ctx.translate(x,y);ctx.rotate(time*.35);ctx.beginPath();for(let i=0;i<10;i++){let a=-Math.PI/2+i*Math.PI/5,rad=i%2?r*.48:r;ctx.lineTo(Math.cos(a)*rad,Math.sin(a)*rad);}ctx.closePath();ctx.fillStyle='#ffdf58';ctx.strokeStyle='#c38526';ctx.lineWidth=2;ctx.fill();ctx.stroke();ctx.restore();}
function background(){renderWorldBackground(level,state==='menu'?previewClock*28:camera,time);}
function draw(){ctx.clearRect(0,0,W,H);background();if(state==='menu'){
  const running=Math.floor(previewClock/3)%2===1;
  const center=W*.72,feet=548;
  if(!drawLocomotion(ctx,selected,center,feet,270,previewPose.mode,previewPose.phase,1,0,previewPose.transition))sprite(ctx,selected,center-150,235,300,300);
  ctx.fillStyle=level===stageNames.length-1?'#fff2d5':'#315641';ctx.font='bold 17px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText(names[selected],center,584);
  ctx.font='14px Noto Sans Thai,sans-serif';ctx.fillText(running?'Run':'Walk',center,610);
  drawDepthLayer(true,level,previewClock*28,W,time);return;
}
ctx.save();ctx.translate(-camera,0);const palette=palettes[level];
for(const p of platforms){if(p.broken)continue;if(p.x+p.w<camera||p.x>camera+W)continue;if(p.breakable){rr(p.x,p.y,p.w,p.h,6,'#ad744d');rr(p.x+3,p.y+3,p.w-6,p.h-7,4,'#e7ba83');ctx.strokeStyle='#bd8c57';ctx.lineWidth=2;ctx.strokeRect(p.x+10,p.y+10,p.w-20,p.h-20);}else if(p.ground){rr(p.x,p.y,p.w,p.h,12,palette.soil);ctx.fillStyle=palette.edge;ctx.fillRect(p.x,p.y+20,p.w,12);ctx.fillStyle=palette.grain;for(let x=Math.max(p.x,Math.floor(camera/42)*42);x<p.x+p.w;x+=42){ctx.fillRect(x+3,p.y+49,29,3);ctx.fillRect(x+20,p.y+85,25,3);}rr(p.x,p.y,p.w,20,9,palette.top);}else{rr(p.x,p.y+5,p.w,p.h,9,palette.slab);rr(p.x,p.y,p.w,18,9,palette.platform);ctx.fillStyle='#fff4d0';for(let x=p.x+14;x<p.x+p.w;x+=28)ctx.fillRect(x,p.y+6,8,3);}}
for(const c of coins)if(!c.got&&c.x>camera-40&&c.x<camera+W+40)star(c.x,c.y+Math.sin(time*3+c.x)*5,13);
const flagX=Math.floor(world*.5)+100;ctx.fillStyle='#436a53';ctx.fillRect(flagX,480,5,120);ctx.fillStyle=checkpoint>100?'#d5fa75':'#fff8df';ctx.beginPath();ctx.moveTo(flagX+5,482);ctx.lineTo(flagX+64,501);ctx.lineTo(flagX+5,520);ctx.fill();
drawPowerObjects();for(const e of enemies)if(e.alive&&e.x>camera-150&&e.x<camera+W+150)drawEnemy(e);
const gx=world-130;ctx.lineWidth=30;ctx.strokeStyle='#b77343';ctx.beginPath();ctx.ellipse(gx,522,54,73,0,0,Math.PI*2);ctx.stroke();ctx.lineWidth=19;ctx.strokeStyle='#f69dba';ctx.stroke();ctx.fillStyle='#ffffff';ctx.font='bold 15px Outfit';ctx.textAlign='center';ctx.fillText('EXIT',gx,528);
drawPowerAura();if(player.on){ctx.fillStyle='#26332730';ctx.beginPath();ctx.ellipse(player.x+player.w/2,player.y+player.h,26,5,0,0,Math.PI*2);ctx.fill();}
if(invincible<=0||Math.floor(time*13)%2===0){
  drawLocomotion(ctx,selected,player.x+player.w/2,player.y+player.h,powers.mega?155:94,player.mode,player.phase,player.face,player.vy,player.transition);
}
if(dashTime>0){ctx.globalAlpha=.22;drawLocomotion(ctx,selected,player.x+player.w/2-player.face*55,player.y+player.h,powers.mega?155:94,'run',player.phase-1,player.face,player.vy);ctx.globalAlpha=1;}
for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/.65);rr(p.x,p.y,6,6,2,p.color);}ctx.globalAlpha=1;ctx.restore();drawDepthLayer(true,level,camera,W,time);}
function frame(ms){Music.update();let remaining=Math.min((ms-previous)/1000||0,.1);previous=ms;while(remaining>0){const step=Math.min(remaining,1/120);tick(step);remaining-=step;}draw();requestAnimationFrame(frame);}requestAnimationFrame(frame);
// Pure helpers exposed for the lightweight collision checks.
if(typeof module!=='undefined')module.exports={overlap,stats};

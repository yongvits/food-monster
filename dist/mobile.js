'use strict';
const activePointers=new Map();
const touchButtons=[...document.querySelectorAll('[data-key]')];
function refreshTouchKey(key){
  const down=[...activePointers.values()].includes(key);
  keys[key]=down;
  touchButtons.filter(b=>b.dataset.key===key).forEach(b=>b.classList.toggle('pressed',down));
  if(!down&&key==='Space'&&player?.vy<-260)player.vy=-260;
}
function releasePointer(id){const key=activePointers.get(id);activePointers.delete(id);if(key)refreshTouchKey(key);}
function clearTouch(){activePointers.clear();touchButtons.forEach(b=>{keys[b.dataset.key]=false;b.classList.remove('pressed');});}
for(const button of touchButtons){
  button.addEventListener('pointerdown',event=>{
    event.preventDefault();if(state!=='play')return;
    activePointers.set(event.pointerId,button.dataset.key);
    button.setPointerCapture(event.pointerId);press(button.dataset.key);refreshTouchKey(button.dataset.key);
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,event=>releasePointer(event.pointerId));
  button.addEventListener('contextmenu',event=>event.preventDefault());
}
$('#mobilePause').onclick=pause;
const gameScreen=$('.screen');
const standalone=()=>navigator.standalone===true||matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches;
let pendingFullscreen=true;
async function enterImmersive(explicit=false){
  if(standalone())return;
  if(document.fullscreenElement){if(explicit)await document.exitFullscreen();return;}
  if(gameScreen.requestFullscreen){try{await gameScreen.requestFullscreen();}catch{if(explicit)showInstallHelp();}}
  else if(explicit)showInstallHelp();
}
function showInstallHelp(){if(state==='play')pause();clearTouch();$('#installHelp').showModal();}
$('#expand').hidden=false;
$('#expand').onclick=()=>enterImmersive(true);
$('#installApp').onclick=showInstallHelp;
$('#closeInstall').onclick=()=>$('#installHelp').close();
$('#play').addEventListener('click',()=>{if(assetsReady&&matchMedia('(orientation: landscape)').matches)enterImmersive();});
gameScreen.addEventListener('pointerdown',()=>{
  if(sound)Music.unlock();
  if(pendingFullscreen&&state==='play'&&matchMedia('(orientation: landscape)').matches){pendingFullscreen=false;enterImmersive();}
});
function syncMobileView(){
  const active=state!=='menu';document.body.classList.toggle('game-active',active);
  if(state!=='play')clearTouch();
  requestAnimationFrame(resize);
}
new MutationObserver(syncMobileView).observe($('#menu'),{attributes:true,attributeFilter:['class']});
new MutationObserver(syncMobileView).observe($('#modal'),{attributes:true,attributeFilter:['class']});
addEventListener('blur',clearTouch);
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTouch();Music.stop();}});
addEventListener('orientationchange',()=>{pendingFullscreen=true;clearTouch();requestAnimationFrame(resize);});
window.visualViewport?.addEventListener('resize',resize);
new ResizeObserver(resize).observe(canvas);
syncMobileView();

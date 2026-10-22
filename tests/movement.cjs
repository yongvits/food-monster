const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const noop=()=>{},ctx=new Proxy({},{get:()=>noop});
const element=()=>({style:{},classList:{add:noop,remove:noop,toggle:noop},setAttribute:noop,append:noop,addEventListener:noop,getContext:()=>ctx,getBoundingClientRect:()=>({width:1280,height:720}),querySelector:()=>({...element(),parentElement:{}})});
const nodes={};const sandbox={console,Math,Image:class{},document:{querySelector:s=>nodes[s]??=element(),createElement:element,querySelectorAll:()=>[],addEventListener:noop},addEventListener:noop,requestAnimationFrame:noop,Music:{update:noop,stop:noop},motionAssetsReady:new Promise(()=>{}),waitImage:()=>new Promise(()=>{}),enemyArt:{},powers:{mega:0,shield:0},tickPowers:noop,resetPowers:noop,updatePose:noop,updateEnemy:noop,spawnEnemy:noop,initPickups:noop,breakBlock:p=>p.broken=true};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('dist/game.js','utf8'),sandbox);
function run(s){return vm.runInContext(s,sandbox)}
function setup(){run("initStage();state='play';sound=false;enemies=[];coins=[];platforms=[{x:0,y:600,w:5500,h:140,ground:true}];player.y=532;player.on=true;")}
for(let id=0;id<5;id++){
 setup();run(`selected=${id};press('Space');tick(1/120)`);assert.equal(run('player.jumpsUsed'),1);
 run('tick(1/120)');assert.equal(run('player.jumpsUsed'),1,'held key must not double jump');
 run("keys.Space=false;press('Space');tick(1/120)");assert.equal(run('player.jumpsUsed'),2);assert(run('player.vy')<0);
 run("keys.Space=false;press('Space');tick(1/120)");assert.equal(run('player.jumpsUsed'),2);
 run('keys={};for(let n=0;n<300;n++)tick(1/120)');assert.equal(run('player.jumpsUsed'),0);assert.equal(run('player.on'),true);
 setup();run(`selected=${id};platforms.push({x:40,y:440,w:190,h:30});press('Space');for(let n=0;n<200;n++)tick(1/120)`);
 assert.equal(run('player.y+player.h'),440,'land on platform after passing through underside');
}
setup();run("platforms.push({x:40,y:440,w:190,h:30});player.y=460;player.vy=100;player.on=false;tick(1/120)");assert(run('player.y')>460,'must not snap onto platform from below');
setup();run("platforms.push({x:40,y:440,w:190,h:30},{x:40,y:420,w:190,h:30});player.y=340;player.vy=1800;player.on=false;tick(.05)");assert.equal(run('player.y+player.h'),420,'nearest swept top wins');
setup();run("player.on=false;coyote=0;press('Space');tick(1/120)");assert.equal(run('player.jumpsUsed'),2,'ledge has one recovery jump');
setup();run("platforms.push({x:130,y:504,w:48,h:96,breakable:true});powers.mega=12;keys.ArrowRight=true;keys.Shift=true;for(let n=0;n<50;n++)tick(1/120)");assert.equal(run('platforms[1].broken'),true,'Mega still smashes crates');
console.log('PASS: 5 heroes double jump, held input, reset, one-way ascent/landing, underside, swept landing, ledge recovery, Mega crates');

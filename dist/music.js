'use strict';
// Original looping arrangements: melody, chord arpeggios, bass and percussion.
const MUSIC_THEMES=[
 {name:'Pretzel Bounce',bpm:112,root:60,scale:[0,2,4,5,7,9,11],melody:[0,2,4,-1,2,4,6,4,3,-1,2,0,1,2,4,-1,4,5,6,4,2,-1,1,0,2,3,4,2,1,-1,0,-1],chords:[0,5,3,4],wave:'triangle'},
 {name:'Grumpy Soda Swing',bpm:94,root:57,scale:[0,2,3,5,7,9,10],melody:[0,-1,2,4,-1,6,4,2,1,-1,3,-1,5,4,2,-1,0,2,-1,4,6,-1,5,3,2,-1,1,3,2,1,0,-1],chords:[0,3,5,4],wave:'sine',swing:.14},
 {name:'Eggy Midnight Dream',bpm:104,root:60,scale:[0,2,3,5,7,8,10],melody:[4,-1,2,-1,0,2,3,-1,5,-1,4,3,2,-1,0,-1,2,-1,4,6,5,-1,3,-1,4,2,1,-1,0,-1,0,-1],chords:[0,5,2,4],wave:'sine'},
 {name:'Cloud Power',bpm:128,root:62,scale:[0,2,4,6,7,9,11],melody:[0,0,4,-1,5,4,2,4,6,6,5,4,2,-1,1,2,0,2,4,5,6,4,5,2,4,3,2,1,0,-1,4,-1],chords:[0,4,5,3],wave:'triangle'},
 {name:'Donut Island',bpm:120,root:65,scale:[0,2,4,5,7,9,10],melody:[0,-1,4,2,5,-1,4,2,3,-1,6,5,4,-1,2,1,0,2,4,-1,5,6,4,-1,3,2,1,-1,2,1,0,-1],chords:[0,3,4,0],wave:'triangle',swing:.07}
];
const Music={master:null,voices:new Set(),volume:.45,next:0,step:0,scene:-1,playing:false,
 unlock(){try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(!this.master){this.master=audio.createGain();this.master.gain.value=this.volume*.45;this.master.connect(audio.destination);}audio.resume();}catch{}},
 note(midi,when,length,wave='triangle',gain=.08){if(!audio||!this.master)return;const oscillator=audio.createOscillator(),envelope=audio.createGain();oscillator.type=wave;oscillator.frequency.value=440*2**((midi-69)/12);envelope.gain.setValueAtTime(0,when);envelope.gain.linearRampToValueAtTime(gain,when+.012);envelope.gain.exponentialRampToValueAtTime(.001,when+length);oscillator.connect(envelope);envelope.connect(this.master);this.voices.add(oscillator);oscillator.onended=()=>{this.voices.delete(oscillator);oscillator.disconnect();envelope.disconnect();};oscillator.start(when);oscillator.stop(when+length+.02);},
 drum(when,kick){if(!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.type=kick?'sine':'triangle';o.frequency.setValueAtTime(kick?135:1100,when);o.frequency.exponentialRampToValueAtTime(kick?42:400,when+.065);g.gain.setValueAtTime(kick?.14:.025,when);g.gain.exponentialRampToValueAtTime(.001,when+.085);o.connect(g);g.connect(this.master);this.voices.add(o);o.onended=()=>{this.voices.delete(o);o.disconnect();g.disconnect();};o.start(when);o.stop(when+.1);},
 stop(){for(const v of this.voices){try{v.stop();}catch{}}this.voices.clear();this.playing=false;},
 setVolume(v){this.volume=v;if(this.master)this.master.gain.setTargetAtTime(v*.45,audio.currentTime,.04);},
 update(){if(!sound||state!=='play'||document.hidden||!audio||audio.state!=='running'){if(this.playing)this.stop();return;}if(this.scene!==level||!this.playing){this.stop();this.scene=level;this.step=0;this.next=audio.currentTime+.03;this.playing=true;}const theme=MUSIC_THEMES[level],unit=60/theme.bpm/4;
 if(this.next<audio.currentTime-.15)this.next=audio.currentTime+.03;
 while(this.next<audio.currentTime+.15){const step=this.step%64,chord=theme.chords[Math.floor(step/16)],degree=theme.melody[Math.floor(step/2)%32];let at=this.next+(step%2?(theme.swing||0)*unit:0);const pitch=d=>theme.root+theme.scale[((d%7)+7)%7]+12*Math.floor(d/7);
 if(step%2===0&&degree>=0)this.note(pitch(degree)+12,at,unit*1.65,theme.wave,.085);
 if(step%4===0)this.note(pitch(chord)-12,at,unit*3,'triangle',.12);
 if(step%2===1)this.note(pitch(chord+[0,2,4,2][Math.floor(step/2)%4]),at,unit*1.4,'sine',.04);
 if(step%4===0)this.drum(at,true);else if(step%2===0)this.drum(at,false);
 this.step++;this.next+=unit;}
 }
};

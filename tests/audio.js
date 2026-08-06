/* Cut sounds: every bin has one, nothing clips, and a swipe is not a burst.

   THE BUG THIS GUARDS. The sound is chosen by `o.it.bin`, so the day someone
   adds a sixth bin — or renames one — the new items cut in SILENCE and nothing
   else complains. items.js already validates bins against QBINS; this does the
   same for the audio, from the opposite side. */
const fs=require('fs'), vm=require('vm'), path=require('path');
const R=path.join(__dirname,'..')+'/';
const audioSrc=fs.readFileSync(R+'js/audio.js','utf8');
const gameSrc=fs.readFileSync(R+'js/game.js','utf8');

let pass=true;
const ck=(n,c,d)=>{ if(!c)pass=false; console.log(`${c?'PASS':'FAIL'}  ${n}${d?'  '+d:''}`); };

/* ---- run the real js/audio.js against a fake Web Audio ---- */
let CLOCK=0;                                    /* seconds, as AudioContext reports */
const started=[];
function FakeCtx(){
  return { state:"running", get currentTime(){ return CLOCK; },
    destination:{},
    createGain:()=>({ gain:{value:1}, connect(){} }),
    createBufferSource:()=>{ const s={ buffer:null, playbackRate:{value:1},
      connect(){}, start(){ started.push({rate:s.playbackRate.value, t:CLOCK}); } }; return s; },
    resume(){ return Promise.resolve(); } };
}
const STORE={};
const ctx={ console, Math, Promise, Object,
  AudioContext:FakeCtx, window:null,
  fetch:()=>Promise.reject(new Error('no network in tests')),
  el:()=>null,
  lsGet:(k,d)=>(k in STORE?STORE[k]:d), lsSet:(k,v)=>{STORE[k]=String(v);} };
ctx.window={ AudioContext:FakeCtx, addEventListener(){} };
vm.createContext(ctx);
vm.runInContext(audioSrc, ctx);

console.log('--- 1. every bin has a sound, and every sound has a bin ---');
/* QBINS is the single source of truth for what a bin is; read it out of game.js
   rather than restating the five names here, so a rename cannot pass. */
const qbinsLine=gameSrc.match(/var QBINS=\{[\s\S]*?\};/)[0];
const bins=[...qbinsLine.matchAll(/(\w+):\{n:/g)].map(m=>m[1]);
ck('found QBINS in js/game.js', bins.length===5, bins.join(','));
const sounds=Object.keys(ctx.SFXSRC);
bins.forEach(b=>ck(`bin "${b}" has a cut sound`, sounds.indexOf(b)>=0));
sounds.forEach(s=>ck(`sound "${s}" maps to a real bin`, bins.indexOf(s)>=0));
ck('no bin is left silent and no sound is orphaned', bins.length===sounds.length,
   `${bins.length} bins, ${sounds.length} sounds`);

console.log('\n--- 2. the files actually ship ---');
sounds.forEach(b=>{
  const f=R+'audio/'+ctx.SFXSRC[b].f;
  ck(`audio/${ctx.SFXSRC[b].f} exists`, fs.existsSync(f));
});
ck('the CC0 provenance ships with them', fs.existsSync(R+'audio/SOURCES.md'));

console.log('\n--- 3. the loudness trims must not clip ---');
/* Peak of each file, measured from the WAV itself, times its trim, times the
   master gain. Two voices can overlap, so leave room for that too. */
function peak(file){
  const b=fs.readFileSync(file);
  let off=12; while(off<b.length-8 && b.toString('ascii',off,off+4)!=='data') off+=8+b.readUInt32LE(off+4);
  let mx=0; for(let i=off+8;i+1<b.length;i+=2) mx=Math.max(mx, Math.abs(b.readInt16LE(i)));
  return mx/32768;
}
let loudest=0;
sounds.forEach(b=>{
  const p=peak(R+'audio/'+ctx.SFXSRC[b].f)*ctx.SFXSRC[b].g;
  loudest=Math.max(loudest,p);
  ck(`${b} stays below full scale after its trim`, p<=1.0, `peak ${p.toFixed(2)}`);
});
ck('two of the loudest voices together still fit under the master gain',
   loudest*2*0.5<=1.0, `${(loudest*2*0.5).toFixed(2)} of full scale`);

console.log('\n--- 4. a swipe through many items is not a burst of noise ---');
/* A single sliceAlong call can cross several items, and Versus has two players
   swiping at once. Unthrottled that is a wall of sound, and identical samples
   starting on the same frame sum into a harsh peak instead of sounding louder. */
ctx.SFX.ctx=FakeCtx(); ctx.SFX.master={gain:{value:0.5}};
sounds.forEach(b=>{ ctx.SFX.buf[b]={}; });
CLOCK=0; started.length=0;
for(let i=0;i<10;i++) ctx.sfxCut('paper');       /* ten paper items, same instant */
ck('the same bin does not retrigger within the gap', started.length===1,
   `${started.length} voices`);
started.length=0;
sounds.forEach(b=>ctx.sfxCut(b));                /* five different bins at once */
ck('simultaneous voices are capped', started.length<=4, `${started.length} voices`);
CLOCK=1; started.length=0;
ctx.sfxCut('paper');
ck('after the gap it plays again', started.length===1);

console.log('\n--- 5. repeats must not sound mechanical ---');
CLOCK=10; started.length=0;
const rates=[];
for(let i=0;i<6;i++){ CLOCK+=1; ctx.sfxCut('glass'); }
started.forEach(s=>rates.push(s.rate));
ck('playback rate varies between cuts', new Set(rates).size>1,
   rates.map(r=>r.toFixed(3)).join(' '));
ck('but stays close enough to be the same material',
   rates.every(r=>r>0.9 && r<1.1), `${Math.min(...rates).toFixed(2)}-${Math.max(...rates).toFixed(2)}`);

console.log('\n--- 6. muting is real and it is remembered ---');
ctx.sfxSetMuted(true);
started.length=0; CLOCK=100; ctx.sfxCut('metal');
ck('a muted game is silent', started.length===0);
ck('the choice is persisted', STORE['ss3d.muted']==='1');
ctx.sfxSetMuted(false);
CLOCK=200; ctx.sfxCut('metal');
ck('unmuting brings it back', started.length===1);

console.log('\n--- 7. both requested modes are wired up ---');
const decomment=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
const gameCode=decomment(gameSrc);
const sortFn=gameCode.match(/function sliceAlong\([\s\S]*?\n\}/)[0];
const vsFn=gameCode.match(/function vsSliceFor\([\s\S]*?\n\}/)[0];
ck('Sort mode plays a cut sound', /sfxCut\(o\.it\.bin\)/.test(sortFn));
ck('Versus mode plays a cut sound', /sfxCut\(o\.it\.bin\)/.test(vsFn));
/* The material, not the verdict — a glass jar sounds like glass whether or not
   it belonged in this round's bin. */
ck('the sound is chosen by bin, never by correctness',
   !/sfxCut\([^)]*correct/.test(gameCode));
/* A missing js file must not throw inside the game loop; that race is what
   broke builds 62, 63 and 66. */
ck('the call cannot throw if audio.js failed to load',
   (gameCode.match(/typeof sfxCut==="function"/g)||[]).length===2);
ck('index.html loads js/audio.js',
   /<script src="js\/audio\.js">/.test(fs.readFileSync(R+'index.html','utf8')));

console.log('\n'+(pass?'ALL PASS':'FAILURES PRESENT'));
process.exit(pass?0:1);

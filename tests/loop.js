/* Guards the three things that turned a broken frame into a silent freeze.

   The reported bug was "the game starts but no items come out": HUD up, round
   showing, timer bar full, nothing on screen ever. Two separate defects produce
   exactly that picture, and neither said a word about it. */
const fs=require('fs'), vm=require('vm');
const R=require('path').join(__dirname,'..')+'/';
const src=fs.readFileSync(R+'js/game.js','utf8');

let pass=true;
const ck=(n,c,d)=>{ if(!c)pass=false; console.log(`${c?'PASS':'FAIL'}  ${n}${d?'  '+d:''}`); };
/* Pull a function out of the real file by its start and the thing that follows,
   so these tests run shipped code rather than a copy. */
function slice(from, until, label){
  const a=src.indexOf(from), b=src.indexOf(until);
  if(a<0||b<a){ ck('found '+label+' in js/game.js', false); return null; }
  return src.slice(a,b);
}

/* ---------- 1. items must arc into the playfield, at any screen height ------
   spawn() launches from y=H+55 with vy=-sqrt(2*g*rise), so the apex sits
   exactly `rise` above the launch point: apex_y = H+55-rise. The old code used
   a flat min(H,380), which on a tall stage left every item down among the
   skyline. */
console.log('--- 1. spawn height scales with the screen ---');
const riseSrc=slice('function riseFor(base)', '\nfunction spawn(', 'riseFor');
const apexFrac=(H, base)=>{
  const c={H}; vm.createContext(c); vm.runInContext(riseSrc, c);
  return (H+55-c.riseFor(base))/H;          /* 0 = top of screen, 1 = bottom */
};
const OLD=(H,base)=>(H+55-Math.min(H,base))/H;
for(const H of [600, 900, 1200, 1400]){
  const now=apexFrac(H,380), before=OLD(H,380);
  console.log(`    ${String(H).padStart(4)}px tall:  was ${(before*100).toFixed(0)}% down the screen`+
              `  ->  now ${(now*100).toFixed(0)}%`);
  ck(`items reach above mid-screen on a ${H}px stage`, now<0.5, `apex at ${(now*100).toFixed(0)}%`);
}
/* The floor matters as much as the scaling: short screens keep their tuned feel. */
ck('the tuned 380px is still the floor on a short screen',
   Math.abs(apexFrac(500,380)-OLD(500,380))<1e-9);
ck('both spawners use riseFor', (src.match(/riseFor\(/g)||[]).length>=3,
   `${(src.match(/riseFor\(/g)||[]).length} references`);
ck('no flat Math.min(H,...) launch height survives',
   !/Math\.sqrt\(2\*[^)]*Math\.min\(H,/.test(src));

/* ---------- 2. a failed round start must not strand the player ------------- */
console.log('\n--- 2. startRound is all-or-nothing ---');
const startSrc=slice('function startRound(){', 'function endRound()', 'startRound');
function runStart(breakIt){
  const ovl={hidden:false};
  const els={ ovl:{classList:{add(){ovl.hidden=true;},remove(){ovl.hidden=false;}}},
              ovlT:{textContent:''}, ovlD:{innerHTML:''}, ovlBtn:{textContent:''} };
  const c={ console, Math, performance:{now:()=>1000},
    G:{objs:[],pops:[],parts:[],flashes:[],running:false,paused:false,spawnT:99},
    BLADE:{trail:[1,2,3]}, DIFF:{round:44000},
    resize(){}, clearObjs(){},
    specialsReset(){ if(breakIt) throw new Error('specials exploded'); },
    el:id=>els[id]||{textContent:'',innerHTML:'',classList:{add(){},remove(){}}} };
  vm.createContext(c); vm.runInContext(startSrc, c);
  c.startRound();
  return {running:c.G.running, overlayHidden:ovl.hidden, msg:els.ovlD.innerHTML};
}
const good=runStart(false);
ck('a normal start runs the round', good.running===true);
ck('and dismisses the overlay', good.overlayHidden===true);

const bad=runStart(true);
console.log(`    on failure: running=${bad.running}, overlayHidden=${bad.overlayHidden}`);
/* THE BUG: overlay hidden AND not running = the frozen board with no explanation. */
ck('a throwing start never leaves a hidden overlay on a stopped game',
   !(bad.overlayHidden===true && bad.running===false));
ck('the player is shown the reason', /specials exploded/.test(bad.msg), bad.msg.slice(0,60));

/* ---------- 3. one bad frame must not kill the render loop ----------------- */
console.log('\n--- 3. the render loop survives a throwing frame ---');
const loopSrc=slice('var loopErr=null;', 'function loopBody(now){', 'loop/loopFail');
function runLoop(framesThatThrow){
  let scheduled=0, frame=0, reported=[], barShown=false;
  /* The round-start button is watched, not driven: nothing in the error path
     may write to it. It already has a listener calling startRound(). */
  const ovlBtn={ textContent:'', _onclick:null,
                 set onclick(v){ this._onclick=v; }, get onclick(){ return this._onclick; } };
  const els={ ovl:{classList:{add(){},remove(){}}}, ovlR:{textContent:''},
              ovlT:{textContent:''}, ovlD:{innerHTML:''}, ovlBtn,
              errBar:{classList:{add(){barShown=false;},remove(){barShown=true;}}},
              errMsg:{set innerHTML(v){reported.push(v);}, get innerHTML(){return '';}},
              errReload:{addEventListener(){}}, errHide:{addEventListener(){}} };
  const c={ console, Math, location:{reload(){}},
    requestAnimationFrame(){ scheduled++; },
    el:id=>els[id]||{textContent:'',innerHTML:'',classList:{add(){},remove(){}}} };
  vm.createContext(c); vm.runInContext(loopSrc, c);
  c.loopBody=function(){ frame++; if(framesThatThrow) throw new Error('bad frame '+frame); };
  for(let i=0;i<5;i++) c.loop(i*16.7);
  return {scheduled, frame, reports:reported.length, barShown,
          ovlBtnOnclick:ovlBtn.onclick, ovlBtnText:ovlBtn.textContent};
}
const ok=runLoop(false);
ck('a healthy loop reschedules every frame', ok.scheduled===5, `${ok.scheduled}/5`);
ck('and runs the body every frame', ok.frame===5, `${ok.frame}/5`);
/* Exactly one rAF per call: a stray reschedule inside the body would double the
   chain every frame until the tab dies. */
ck('exactly one reschedule per frame, never two', ok.scheduled===ok.frame);
ck('loopBody does not schedule its own frame',
   !/drawFx\(now\);\s*requestAnimationFrame/.test(src));

const dead=runLoop(true);
console.log(`    5 throwing frames -> ${dead.scheduled} reschedules, ${dead.reports} message(s)`);
ck('a throwing frame still reschedules, so the loop lives', dead.scheduled===5, `${dead.scheduled}/5`);
ck('the failure is reported to the player', dead.reports>=1);
ck('a fault that repeats every frame reports only once', dead.reports===1, `${dead.reports} reports`);
ck('the report goes to the dedicated error bar', dead.barShown===true);

/* THE REGRESSION. Writing onclick onto the round-start button did not replace
   its existing listener, it added a second handler — so the next "Start round"
   both started the round and reloaded the page, bouncing to the main menu and
   making the game impossible to start in every mode. */
console.log('\n--- 4. the error report must not touch game controls ---');
ck('loopFail never sets onclick on the round-start button',
   dead.ovlBtnOnclick===null, 'onclick was '+dead.ovlBtnOnclick);
ck('loopFail never relabels the round-start button',
   dead.ovlBtnText==='', `text was "${dead.ovlBtnText}"`);
/* Scan CODE only — this block explains the old mistake in prose, and matching
   the pattern inside its own comment is a false positive. */
const loopCode=loopSrc.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
ck('no ovlBtn handler is assigned anywhere in the error path',
   !/ovlBtn"\)\.onclick|ovlBtn"\)\.addEventListener/.test(loopCode));
ck('the reload button is the error bar\'s own',
   /errReload/.test(src) && /errBar/.test(src));

console.log('\n'+(pass?'ALL PASS':'FAILURES PRESENT'));
process.exit(pass?0:1);

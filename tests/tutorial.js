/* Tutorial: bilingual, isolated from progress, and pointing at real items.

   THE BUG THIS GUARDS. A lesson names the item it wants — tutSpawn("canAlu") —
   and ITEMBYT lookup MISSES SILENTLY: no item spawns, no error, and the step's
   goal can then never come true. The lesson simply hangs on "let the can fall"
   forever. That shipped into the first run of this file; `canAlu` was never a
   real key (the soda can is `canTall`). Nothing but a test can catch it, because
   the failure looks exactly like a player who has not acted yet. */
const fs=require('fs'), vm=require('vm'), path=require('path');
const R=path.join(__dirname,'..')+'/';
const tutSrc=fs.readFileSync(R+'js/tutorial.js','utf8');
const itemsSrc=fs.readFileSync(R+'js/items.js','utf8');
const gameSrc=fs.readFileSync(R+'js/game.js','utf8');
const scoresSrc=fs.readFileSync(R+'js/scores.js','utf8');
const htmlSrc=fs.readFileSync(R+'index.html','utf8');
const cssSrc=fs.readFileSync(R+'css/styles.css','utf8');

let pass=true;
const ck=(n,c,d)=>{ if(!c)pass=false; console.log(`${c?'PASS':'FAIL'}  ${n}${d?'  '+d:''}`); };

/* Run the real js/tutorial.js. Only the lesson DATA is inspected here, so the
   stubs need to be no more than enough for the file to evaluate. */
const STORE={};
const ctx={ console, Math, JSON, Object, Date,
  lsGet:(k,d)=>(k in STORE?STORE[k]:d), lsSet:(k,v)=>{STORE[k]=String(v);},
  el:()=>null, W:1280, H:720, controlMode:"mouse",
  window:{ matchMedia:()=>({matches:false}) } };
vm.createContext(ctx);
vm.runInContext(tutSrc, ctx);

const L=ctx.TLESSONS;

console.log('--- 1. every item a lesson asks for must exist ---');
/* Read the roster out of items.js rather than restating it, so a renamed item
   fails here instead of hanging a lesson at runtime. */
const keys=[...itemsSrc.matchAll(/t:"([A-Za-z0-9_]+)"/g)].map(m=>m[1]);
ck('found the item roster in js/items.js', keys.length>=50, `${keys.length} items`);
const asked=[...tutSrc.matchAll(/tutSpawn\("([^"]+)"/g)].map(m=>m[1]);
ck('lessons do spawn named items', asked.length>0, `${asked.length} spawns`);
[...new Set(asked)].forEach(t=>ck(`tutSpawn("${t}") names a real item`, keys.indexOf(t)>=0));

console.log('\n--- 2. the library is complete and bilingual ---');
const want=["quickstart","sort","quiz","binit","versus","controls"];
ck('all six lessons are present', L.length===6, L.map(x=>x.id).join(','));
want.forEach(id=>ck(`lesson "${id}" exists`, !!ctx.tutById(id)));
L.forEach(les=>{
  ck(`${les.id}: has an English and a Chinese name`, !!les.name && !!les.zh);
  ck(`${les.id}: has both blurbs`, !!les.blurb && !!les.blurbZh);
  ck(`${les.id}: has steps`, les.steps.length>0, `${les.steps.length} steps`);
});

console.log('\n--- 3. NO step may be missing its translation ---');
/* The single most likely thing to rot: someone adds a step in a hurry and only
   writes the English. A half-translated tutorial is worse than an obvious gap. */
let miss=0;
L.forEach(les=>les.steps.forEach((s,i)=>{
  const en=typeof s.en==="function" ? s.en() : s.en;
  const zh=typeof s.zh==="function" ? s.zh() : s.zh;
  if(!en || !zh) { miss++; console.log(`      missing on ${les.id} step ${i+1}`); }
  /* Chinese text that contains no CJK is untranslated English in the zh slot. */
  else if(!/[一-鿿]/.test(zh)) { miss++; console.log(`      not Chinese on ${les.id} step ${i+1}`); }
}));
ck('every step has English and Traditional Chinese', miss===0, `${miss} gaps`);
let failMiss=0;
L.forEach(les=>les.steps.forEach(s=>{ if(s.fail && (!s.failEn || !s.failZh)) failMiss++; }));
ck('every correction message is bilingual too', failMiss===0);

console.log('\n--- 4. the step machine cannot be handed a broken step ---');
let bad=0;
L.forEach(les=>les.steps.forEach((s,i)=>{
  if(["say","do","demo"].indexOf(s.k)<0){ bad++; console.log(`      unknown kind "${s.k}" on ${les.id} ${i+1}`); }
  if(s.k==="do" && typeof s.goal!=="function"){ bad++; console.log(`      do-step with no goal on ${les.id} ${i+1}`); }
  if(s.k==="demo" && !s.demo){ bad++; console.log(`      demo-step with no illustration on ${les.id} ${i+1}`); }
}));
ck('every step is a known kind, and do-steps can be completed', bad===0);
/* A `do` step the player cannot fail out of still needs a way past it, or a
   stuck player is trapped. Skip is always rendered — assert it stays that way. */
ck('every coach card offers Skip and Exit',
   /id="tutSkip"/.test(tutSrc) && /id="tutQuit"/.test(tutSrc));

console.log('\n--- 5. isolation: a tutorial must never touch real progress ---');
/* XP is derived from the run history, and unlocks from XP, so refusing to
   record is the whole of the guarantee. It must live in scoresRecord itself —
   not at the four call sites, which is where it would rot. */
ck('scoresRecord refuses to record while a lesson is running',
   /function scoresRecord\([^)]*\)\{[\s\S]{0,600}?TUT\.active\)\s*return;/.test(scoresSrc));
const recCalls=(gameSrc.match(/scoresRecord\(/g)||[]).length
             + (fs.readFileSync(R+'js/mode-quiz.js','utf8').match(/scoresRecord\(/g)||[]).length
             + (fs.readFileSync(R+'js/mode-defend.js','utf8').match(/scoresRecord\(/g)||[]).length;
ck('and it is still the only way a run is recorded', recCalls===3, `${recCalls} call sites`);
/* The tutorial's own slicing must not add to the score — a running total in a
   lesson implies a result the player never gets. */
const sliceFn=tutSrc.match(/function tutSliceAlong[\s\S]*?\n\}/)[0];
ck('tutSliceAlong scores nothing', !/G\.score/.test(sliceFn));
/* Scan CODE only: this file explains the isolation rule in prose, and matching
   the rule's own explanation is a false positive that fails a correct fix. */
const tutCode=tutSrc.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
ck('and never records a run', !/scoresRecord/.test(tutCode));
ck('nor writes the XP floor', !/bladeSetXPFloor/.test(tutCode));
ck('progress is stored under a versioned key', /TUTKEY="sliceSortTutorial\.v1"/.test(tutSrc));
/* Its own storage must not collide with the game's ss3d.* namespace. */
const writes=[...tutSrc.matchAll(/lsSet\(([^,]+),/g)].map(m=>m[1].trim());
ck('the tutorial writes only its own key', writes.every(w=>w==="TUTKEY"), writes.join(','));

console.log('\n--- 6. Versus must never sell mouse as a real controller ---');
/* A mouse player who reaches a real match and cannot play was misled here. */
const vs=L.filter(x=>x.id==="versus")[0];
const vsText=vs.steps.map(s=>(typeof s.en==="function"?s.en():s.en)).join(" ");
ck('the Versus lesson says mouse cannot play a real match',
   /mouse and touch cannot play versus/i.test(vsText));
ck('and it names what a real match does need',
   /two webcam hands/i.test(vsText) && /two phones/i.test(vsText));
ck('it never calls mouse a supported Versus controller',
   !/mouse[^.]{0,40}(works|supported|can play)/i.test(vsText));

console.log('\n--- 7. wired into the app ---');
ck('show() routes to the tutorial screen', /"blades","tutorial"\]/.test(gameSrc));
ck('index.html has the tutorial screen', /<section id="tutorial"/.test(htmlSrc));
ck('index.html loads js/tutorial.js', /<script src="js\/tutorial\.js">/.test(htmlSrc));
/* Two rows: START alone on the first, TUTORIAL and BLADES equal on the second. */
ck('START keeps its own full-width row', /<div class="v6-actions">\s*<button class="v6-primary" id="playBtn"[\s\S]{0,200}?<\/div>/.test(htmlSrc));
ck('TUTORIAL and BLADES are siblings on the second row',
   /<div class="v6-actions2">[\s\S]{0,400}?id="tutBtn"[\s\S]{0,400}?id="bladesBtn"/.test(htmlSrc));
ck('the pause menu offers HOW TO PLAY', /id="helpBtn"[^>]*>How to play/.test(htmlSrc));
ck('and it is bilingual', /How to play <i>遊戲教學<\/i>/.test(htmlSrc));

console.log('\n--- 8. Quick Help must not disturb the run it opens over ---');
const helpFn=tutSrc.match(/function tutHelpOpen[\s\S]*?\n\}/)[0]
           + tutSrc.match(/function tutHelpClose[\s\S]*?\n\}/)[0];
ck('Quick Help never touches the pause state', !/G\.paused\s*=/.test(helpFn));
ck('nor the clock', !/roundEndAt|pauseRemain/.test(helpFn));
ck('nor the objects on screen', !/clearObjs|G\.objs/.test(helpFn));
ck('there is a reference for every mode',
   ["sort","quiz","tsunami","vs"].every(m=>!!ctx.TUTREF[m]));
Object.keys(ctx.TUTREF).forEach(m=>{
  ck(`the ${m} reference is bilingual`, !!ctx.TUTREF[m].en && /[一-鿿]/.test(ctx.TUTREF[m].zh));
});

console.log('\n--- 9. reduced motion is honoured, not ignored ---');
ck('the demos have a static variant in JS', /tutReduced\(\)/.test(tutSrc));
ck('and the animations are switched off in CSS',
   /prefers-reduced-motion[\s\S]{0,400}?\.tcDemo .dmArc,\.tcDemo .dmPhone/.test(cssSrc));
ck('the still variant kills the animation too', /\.tcDemo\.still[\s\S]{0,120}?animation:none/.test(cssSrc));

console.log('\n--- 10. it fits a narrow phone ---');
ck('the lesson grid collapses to one column',
   /max-width:560px\)\{[\s\S]{0,300}?\.tutList\{grid-template-columns:1fr\}/.test(cssSrc));
ck('the coach card is width-capped, not fixed',
   /\.tutCoach\{[\s\S]{0,300}?width:min\(/.test(cssSrc));

console.log('\n'+(pass?'ALL PASS':'FAILURES PRESENT'));
process.exit(pass?0:1);

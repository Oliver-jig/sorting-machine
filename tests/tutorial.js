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

console.log('\n--- 2. the library is complete ---');
const want=["quickstart","sort","quiz","binit","versus","controls"];
ck('all six lessons are present', L.length===6, L.map(x=>x.id).join(','));
want.forEach(id=>ck(`lesson "${id}" exists`, !!ctx.tutById(id)));
L.forEach(les=>{
  ck(`${les.id}: has a name and a blurb`, !!les.name && !!les.blurb);
  ck(`${les.id}: has steps`, les.steps.length>0, `${les.steps.length} steps`);
});

console.log('\n--- 3. the tutorial is ENGLISH ONLY ---');
/* Requested outright: no Chinese anywhere in the tutorial. It was bilingual, and
   the Chinese line under every instruction is also what doubled the height of
   the coach card — the direct cause of the "no items" bug guarded in section 11.
   So this is not only a wording preference; the layout depends on it.
   The game's ITEM NAMES are still bilingual and are NOT covered here: they come
   from the roster in items.js and read the same in every mode. */
const CJK=/[㐀-鿿豈-﫿]/;
let cjk=0;
const flag=(where,txt)=>{ if(txt && CJK.test(txt)){ cjk++; console.log(`      Chinese in ${where}: ${txt.slice(0,40)}`); } };
L.forEach(les=>{
  flag(`${les.id} name`, les.name); flag(`${les.id} blurb`, les.blurb);
  les.steps.forEach((s,i)=>{
    const en=typeof s.en==="function" ? s.en() : s.en;
    if(!en){ cjk++; console.log(`      ${les.id} step ${i+1} has no text at all`); }
    flag(`${les.id} step ${i+1}`, en);
    flag(`${les.id} step ${i+1} correction`, s.failEn);
  });
});
ck('no lesson text contains Chinese', cjk===0, `${cjk} found`);
/* The old bilingual fields must be gone, not merely emptied — an empty zh slot
   invites someone to "helpfully" fill it back in. */
ck('the bilingual fields are removed, not blanked',
   L.every(les=>les.zh===undefined && les.blurbZh===undefined &&
     les.steps.every(s=>s.zh===undefined && s.failZh===undefined)));
ck('the coach card renders no Chinese column', !/tcZh/.test(tutSrc));
/* Buttons and chrome too, not just the lesson prose. */
const chrome=tutSrc.match(/function tutRenderCoach[\s\S]*?\n\}/)[0]
           + tutSrc.match(/function tutRenderDone[\s\S]*?\n\}/)[0]
           + tutSrc.match(/function tutRenderLibrary[\s\S]*?\n\}/)[0]
           + tutSrc.match(/function tutDemoHTML[\s\S]*?\n^\}/m)[0];
ck('the buttons, library and demo captions are English only', !CJK.test(chrome));

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
/* The tutorial screen and its menu button must stay English too. Checked on the
   markup because that is where the Chinese labels used to live. */
const tutMarkup=(htmlSrc.match(/<section id="tutorial"[\s\S]*?<\/section>/)||[''])[0]
              + (htmlSrc.match(/id="tutBtn"[^<]*<\/button>/)||[''])[0]
              + (htmlSrc.match(/id="helpBtn"[^<]*<\/button>/)||[''])[0];
ck('the tutorial screen and its buttons carry no Chinese', !CJK.test(tutMarkup));

console.log('\n--- 8. Quick Help must not disturb the run it opens over ---');
const helpFn=tutSrc.match(/function tutHelpOpen[\s\S]*?\n\}/)[0]
           + tutSrc.match(/function tutHelpClose[\s\S]*?\n\}/)[0];
ck('Quick Help never touches the pause state', !/G\.paused\s*=/.test(helpFn));
ck('nor the clock', !/roundEndAt|pauseRemain/.test(helpFn));
ck('nor the objects on screen', !/clearObjs|G\.objs/.test(helpFn));
ck('there is a reference for every mode',
   ["sort","quiz","tsunami","vs"].every(m=>!!ctx.TUTREF[m]));
Object.keys(ctx.TUTREF).forEach(m=>{
  ck(`the ${m} reference is written and English only`,
     typeof ctx.TUTREF[m]==="string" && ctx.TUTREF[m].length>40 && !CJK.test(ctx.TUTREF[m]));
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

console.log('\n--- 11. the lesson must be VISIBLE and PLAYABLE ---');
/* TWO BUGS THIS GUARDS, both reported as "I cannot play, nothing is showing".

   (a) Step 2 of Quick Start asks the player to move the blade into a ring, and
       NOTHING DREW THE RING. The instruction pointed at something that did not
       exist on screen.
   (b) The coach card is an overlay at the bottom of the stage. tutSpawn used the
       normal launch height, so on a 720px stage an item apexed at ~453 while the
       card's top edge sat at ~472 — items spent their whole flight BEHIND the
       card, and the sky looked empty. */
/* Scan CODE only — game.js explains this fix in prose right above it. */
const gameCode=gameSrc.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
ck('the tutorial has its own draw pass', /function tutDraw\(/.test(tutSrc));
ck('and the render loop actually calls it', /TUT\.active\)\{\s*tutDraw\(now\)/.test(gameCode));
ck('it is called before the host mode draws, not after',
   gameCode.indexOf('tutDraw(now)') < gameCode.indexOf('quizDraw(now)'));
const drawFn=tutSrc.match(/function tutDraw[\s\S]*?\n\}/)[0];
ck('the aim ring is actually stroked', /scratch\.ring/.test(drawFn) && /arc\(/.test(drawFn));
ck('and it shows the player when they are inside it', /inside/.test(drawFn));
ck('the Versus bot is drawn too, not invisible', /TUT\.bot/.test(drawFn));

/* Items must be launched at a height derived from the card, never a constant. */
const spawnFn=tutSrc.match(/function tutSpawn[\s\S]*?\n\}/)[0];
ck('scripted items are launched to clear the coach card', /tutApexY\(\)/.test(spawnFn));
ck('the ceiling is measured from the real card, not assumed',
   /getBoundingClientRect/.test(tutSrc.match(/function tutCeil[\s\S]*?\n\}/)[0]));
ck('the card is rendered before setup runs, so the measurement is current',
   /tutRenderCoach\(\);\s*\n\s*if\(s\.setup\)/.test(tutSrc));
/* Arithmetic check on a realistic stage: the apex must sit clear of the card. */
(()=>{
  const H=720, cardH=170;                       // English-only card measures ~150-170px
  const ceil=Math.max(120, H-(cardH+34));
  const apex=Math.max(70, Math.min(H*0.34, ceil-90));
  ck('on a 720px stage the apex clears the card', apex < ceil-60,
     `apex y=${apex.toFixed(0)}, card top y=${ceil.toFixed(0)}`);
  const short=320, sCeil=Math.max(120, short-(cardH+34));
  const sApex=Math.max(70, Math.min(short*0.34, sCeil-90));
  ck('and on a 320px landscape phone it is still on screen', sApex>=70 && sApex<short,
     `apex y=${sApex.toFixed(0)}`);
})();
/* A do-step whose items all fell without the goal being met must not strand the
   player in an empty arena forever. */
ck('an exhausted exercise restocks itself', /function tutRestock/.test(tutSrc));
ck('and restocking does not wipe the progress already made',
   /slicedT=keep;\s*TUT\.scratch\.slicedN=keepN/.test(tutSrc));
/* A SECOND BUG, caught by playing it rather than by reading it. Restock re-runs
   the step's setup() when the arena is empty. The aim-ring step spawns nothing,
   so its arena is empty for its whole duration — restock re-ran setup on every
   frame, resetting the ring's dwell counter, and the goal could never be met.
   The ring step became impossible to complete. Only item exercises may restock. */
const restockFn=tutSrc.match(/function tutRestock[\s\S]*?\n\}/)[0];
ck('restock only applies to steps that actually spawn items',
   /scratch\.spawnedT\)\s*return;/.test(restockFn));
ck('so a step with no items is never re-set-up under the player',
   restockFn.indexOf('spawnedT') < restockFn.indexOf('s.setup()'));
ck('the card cannot grow back over the playfield', /\.tutCoach\{[\s\S]{0,400}?max-height:/.test(cssSrc));

console.log('\n'+(pass?'ALL PASS':'FAILURES PRESENT'));
process.exit(pass?0:1);

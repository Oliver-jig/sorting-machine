/* Drives the REAL js/mode-quiz.js to prove the accidental-selection fix.
   Simulates the blade the same way game.js does:
     quizUpdate(dt) -> quizSliceCheck(px,py,x,y) -> BLADE.trail.push -> px=x,py=y
   (that order matters: the trail is pushed AFTER the check) */
const fs=require('fs'), vm=require('vm');
const R=require('path').join(__dirname,'..')+'/';

function fresh(W,H){
  const ctx={ console, Math, JSON,
    W, H, G:{objs:[],parts:[],pops:[],flashes:[],paused:false},
    BLADE:{x:0,y:0,px:0,py:0,active:true,trail:[]},
    el:()=>({textContent:"",innerHTML:"",style:{},classList:{add(){},remove(){}}}),
    show(){}, resize(){}, setupCam(){}, setupMouse(){}, stopCam(){}, scoresRecord(){},
    spawnBurst(){}, drawHeart(){}, wrapFx(){}, setRoundLbl(){}, setTopic(){}, hx:n=>"#"+n.toString(16),
    fxRR(){}, fxc:new Proxy({},{get:()=>()=>{},set:()=>true}),
    shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const t=a[i]; a[i]=a[j]; a[j]=t; } return a; },
    segDist(ox,oy,x1,y1,x2,y2){ const dx=x2-x1,dy=y2-y1,len2=dx*dx+dy*dy||1;
      const t=Math.max(0,Math.min(1,((ox-x1)*dx+(oy-y1)*dy)/len2));
      return Math.hypot(ox-(x1+t*dx), oy-(y1+t*dy)); },
    controlMode:"cam", GMODE:"quiz", FACTS:[], ART:{_def(){}},
    QBINS:{paper:{n:"Paper",c:"#1"},plastic:{n:"Plastic",c:"#2"},metal:{n:"Metal",c:"#3"},
           glass:{n:"Glass",c:"#4"},trash:{n:"General",c:"#5"}} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(R+'js/items.js','utf8').replace(/var ART=\{[\s\S]*\n\};/,''), ctx);
  vm.runInContext('var ITEMBYT={}; ITEMS.forEach(function(it){ITEMBYT[it.t]=it;});', ctx);
  vm.runInContext(fs.readFileSync(R+'js/mode-quiz.js','utf8'), ctx);
  return ctx;
}

let pass=true;
const ck=(n,c,d)=>{ if(!c)pass=false; console.log(`${c?'PASS':'FAIL'}  ${n}${d?'  '+d:''}`); };

/* One frame, exactly as game.js:593-595 sequences it */
function frame(c, dt, now, x, y){
  c.quizUpdate(dt);
  c.quizSliceCheck(c.BLADE.px, c.BLADE.py, x, y);
  c.BLADE.trail.push({x, y, t:now});
  while(c.BLADE.trail.length && now-c.BLADE.trail[0].t>400) c.BLADE.trail.shift();
  c.BLADE.px=x; c.BLADE.py=y; c.BLADE.x=x; c.BLADE.y=y;
}
function startQ(c){ c.launchQuiz(); return c; }
function settle(c, startNow){           /* run until every card has landed */
  let now=startNow;
  for(let i=0;i<400 && !c.Q.live;i++){ frame(c,16.7,now,-999,-999); now+=16.7; }
  return now;
}
const cardOf=c=>c.Q.opts.find(o=>!o.sliced);
/* Park the blade at a position (and let the trail agree) before swiping.
   Without this the first swipe frame teleports from wherever settle() left the
   blade, producing a screen-wide segment that clips cards the swipe never went
   near — a test artifact, not game behaviour. */
/* A swipe SHORT enough to stay inside its own card's lane. Cards sit ~285px
   apart, so the earlier +/-250px sweeps began inside the neighbouring card and
   selected that one instead — a test artifact that looked like a game bug.
   +/-95px keeps a neighbour (285px away) more than 74px from every point on the
   path, while 8 steps of 24px is 190px of travel, comfortably over QSWIPE. */
function swipeThrough(c, now, card){
  park(c, now, card.x-95, card.y);
  for(let i=0;i<9 && !c.Q.locked;i++){ frame(c,16.7,now,card.x-95+i*24,card.y); now+=16.7; }
  return now;
}
function park(c, now, x, y){
  c.BLADE.trail.length=0;
  for(let i=0;i<4;i++) c.BLADE.trail.push({x, y, t:now-(4-i)*16.7});
  c.BLADE.px=x; c.BLADE.py=y; c.BLADE.x=x; c.BLADE.y=y;
}

console.log('--- 1. a resting hand with tracking jitter must select NOTHING ---');
{
  const c=startQ(fresh(1280,700));
  let now=settle(c,0);
  ck('cards landed', c.Q.live===true);
  const t=cardOf(c);
  park(c, now, t.x, t.y);
  let s=7; const rnd=()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; };
  /* Jitter is resampled at the DETECTION rate (~25fps) and held in between,
     which is what the camera grace window actually produces. Resampling every
     render frame would model a tracker that is 2.4x noisier than reality. */
  let hx=t.x, hy=t.y, nextDet=now;
  for(let i=0;i<600;i++){
    if(now>=nextDet){ hx=t.x+(rnd()-0.5)*12; hy=t.y+(rnd()-0.5)*12; nextDet+=40; }
    frame(c, 16.7, now, hx, hy);
    now+=16.7;
  }
  /* Assert on cards SELECTED, not Q.locked: the question times out after
     QCFG.qTime (8s) and quizTimeout also sets locked. An earlier version of this
     test checked locked and "failed" on the timeout, which is correct game
     behaviour, not an accidental pick. */
  ck('10s of a resting hand ON a card selected no card',
     c.Q.opts.filter(o=>o.sliced).length===0,
     `${c.Q.opts.filter(o=>o.sliced).length} selected, maxTravel stayed under ${c.QSWIPE}px`);
}

console.log('\n--- 2. a deliberate swipe must select, every time ---');
{
  let hits=0;
  for(let trial=0; trial<20; trial++){
    const c=startQ(fresh(1280,700));
    let now=settle(c,0);
    const t=cardOf(c);
    swipeThrough(c, now, t);
    if(c.Q.locked) hits++;
  }
  ck('20/20 deliberate swipes selected an answer', hits===20, `${hits}/20`);
}

console.log('\n--- 3. NOTHING can be selected while cards are still flying ---');
{
  let bad=0;
  for(let trial=0; trial<20; trial++){
    const c=startQ(fresh(1280,700));
    let now=0;
    // sweep the blade violently up and down the whole ascent path while cards rise
    /* The claim under test is precisely: nothing can be selected while a card is
       still FLYING. Checking Q.live instead is wrong, because quizUpdate runs
       before quizSliceCheck inside a frame, so live can flip mid-frame and the
       loop reports correct post-arm behaviour as a failure. */
    for(let i=0;i<200; i++){
      const flying=c.Q.opts.some(o=>o.state!=="hover");
      const y=700-(i*13)%760;
      frame(c, 16.7, now, 300+((i*97)%700), y);
      now+=16.7;
      if(flying && c.Q.opts.some(o=>o.sliced)){ bad++; break; }
      if(!flying) break;                        // everything has landed
    }
  }
  ck('20 runs of thrashing during the ascent selected nothing', bad===0, `${bad} accidental selections`);
}

console.log('\n--- 4. mouse-rate input must still work (60fps, small steps) ---');
{
  const c=startQ(fresh(1280,700));
  let now=settle(c,0);
  const t=cardOf(c);
  park(c, now, t.x-95, t.y);
  for(let i=0;i<20 && !c.Q.locked;i++){ frame(c,16.7,now,t.x-95+i*10,t.y); now+=16.7; }
  ck('a smooth 60fps swipe selects', c.Q.locked===true, `locked=${c.Q.locked}`);
}

console.log('\n--- 5. slow drift must NOT select (this is the miscontrol case) ---');
{
  const c=startQ(fresh(1280,700));
  let now=settle(c,0);
  const t=cardOf(c);
  park(c, now, t.x-180, t.y);
  // drifting across the card slowly: 3px/frame = 180px/s, below a real slash
  for(let i=0;i<120 && !c.Q.locked;i++){ frame(c,16.7,now,t.x-180+i*3,t.y); now+=16.7; }
  ck('a slow drift across a card does not select', !c.Q.locked, `locked=${c.Q.locked}`);
}

console.log('\n--- 6. nearest-only still holds when two cards are close ---');
{
  /* Seeded: the question is picked at random, and with an unseeded RNG this
     occasionally drew a layout the fixed swipe path did not suit — a flaky
     test is worse than no test, because it trains you to ignore red. */
  const c=fresh(1280,700);
  let s=20260731; c.Math.random=()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; };
  c.launchQuiz();
  let now=settle(c,0);
  const opts=c.Q.opts;
  // swipe centred hard on opts[1]
  const t=opts[1];
  swipeThrough(c, now, t);
  const chosen=opts.filter(o=>o.sliced);
  ck('exactly one card was selected', chosen.length===1, `${chosen.length} selected`);
  ck('and it was the one swiped through', chosen[0]===t);
}

console.log('\n--- 7. the rest of Quiz still behaves ---');
{
  const c=startQ(fresh(1280,700));
  let now=settle(c,0);
  ck('clock only starts once cards land', c.Q.qLeft<=c.QCFG.qTime && c.Q.live);
  const wrong=c.Q.opts.find(o=>!o.correct);
  const lives0=c.Q.lives;
  now=swipeThrough(c, now, wrong);
  ck('a wrong answer locks the question', c.Q.locked===true);
  ck('a wrong answer costs a life', c.Q.lives===lives0-1, `${lives0} -> ${c.Q.lives}`);
  ck('the teaching card comes up', c.Q.teach>0, `teach=${Math.round(c.Q.teach)}`);
  // a second swipe while locked must do nothing
  const before=c.Q.opts.filter(o=>o.sliced).length;
  now=swipeThrough(c, now, wrong);
  ck('no further selection while locked', c.Q.opts.filter(o=>o.sliced).length===before);
}

console.log('\n--- 8. a new question is not answerable from the old state ---');
{
  const c=startQ(fresh(1280,700));
  settle(c,0);
  c.quizNext();
  ck('Q.live resets on the next question', c.Q.live===false, `live=${c.Q.live}`);
}

console.log('\n--- 8b. a badly jittering tracker is the documented limit ---');
{
  const c=startQ(fresh(1280,700));
  let now=settle(c,0);
  const t=cardOf(c);
  park(c, now, t.x, t.y);
  let s=3; const rnd=()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; };
  let hx=t.x, hy=t.y, nextDet=now;
  for(let i=0;i<600;i++){
    if(now>=nextDet){ hx=t.x+(rnd()-0.5)*16; hy=t.y+(rnd()-0.5)*16; nextDet+=40; }
    frame(c, 16.7, now, hx, hy); now+=16.7;
  }
  ck('even +/-8px jitter for 10s selects no card',
     c.Q.opts.filter(o=>o.sliced).length===0,
     `${c.Q.opts.filter(o=>o.sliced).length} selected`);
}

console.log('\n--- 9. how much travel separates jitter from a swipe? ---');
{
  const c=fresh(1280,700);
  const mk=(step,n)=>{ c.BLADE.trail.length=0; let now=0;
    for(let i=0;i<n;i++){ c.BLADE.trail.push({x:i*step,y:0,t:now}); now+=16.7; }
    return c.bladeTravel(c.QSWIPEMS, (n)*step, 0); };
  const jitter=mk(0.6,10), drift=mk(3,10), moderate=mk(12,10), swipe=mk(40,10);
  console.log(`    jitter=${jitter.toFixed(0)}px  drift=${drift.toFixed(0)}px  moderate=${moderate.toFixed(0)}px  swipe=${swipe.toFixed(0)}px  threshold=${c.QSWIPE}px`);
  ck('threshold sits above jitter and drift', jitter<c.QSWIPE && drift<c.QSWIPE);
  ck('a MODERATE deliberate swipe still registers', moderate>c.QSWIPE, `${moderate.toFixed(0)} > ${c.QSWIPE}`);
  ck('threshold sits well below a real swipe', swipe>c.QSWIPE*2, `${swipe.toFixed(0)} vs ${c.QSWIPE}`);
}

console.log('\n'+(pass?'ALL PASS':'FAILURES PRESENT'));
process.exit(pass?0:1);

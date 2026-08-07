/* ================= interactive tutorial =================

   A tutorial that is PLAYED, not read. Lessons run on the real arena with the
   real items, blade and HUD — the only differences are that a coach card sits on
   top, spawns are scripted, and nothing that happens can touch the player's XP,
   scores, unlocks or saved results.

   ISOLATION IS ENFORCED IN ONE PLACE, NOT SPRINKLED. XP in this game is not a
   stored counter — `bladeXP()` derives it from the run history, and unlocks
   derive from XP. So "a tutorial must not award XP, scores or unlocks" reduces
   to a single rule: a tutorial run is never recorded. `scoresRecord()` returns
   early while TUT.active, which closes the local best, the run history, the XP
   floor and the leaderboard submit all at once. The second rule is that a
   lesson never reaches a mode's game over — tutModeEnded() intercepts first —
   so no result screen, no life ever runs out for real.

   Lessons are DATA. The runner below is small and generic; everything specific
   to a lesson lives in TLESSONS as a list of steps, so adding or reordering
   teaching material never means touching the state machine.

   ENGLISH ONLY. An earlier build carried a Traditional Chinese line under every
   instruction. It doubled the height of the coach card, which is what pushed the
   card up over the flight path of the items (see TUTCEIL below). The item name
   labels are still bilingual, because those come from the game's own roster and
   are the same in every mode. */

var TUT={
  active:false,       /* a lesson is running — the isolation flag */
  lesson:null,        /* the TLESSONS entry */
  step:0,
  waiting:false,      /* on a `do` step, watching for its goal */
  done:false,
  pending:null,       /* lesson id waiting on the phone-connect screen */
  bot:null,           /* Versus demonstration bot */
  playing:false,      /* a `play` step: the REAL mode owns the frame */
  playEnd:0,          /* when the practice window closes */
  scratch:{}          /* per-step working state, cleared on every advance */
};

var TUTKEY="sliceSortTutorial.v1";

/* Versioned on purpose: the shape below is what v1 means. If lesson ids change
   meaning later, bump the key rather than silently reading stale completions. */
function tutLoad(){
  var d={done:[], seen:false};
  try{
    var raw=lsGet(TUTKEY,"");
    if(raw){ var p=JSON.parse(raw); if(p&&p.done instanceof Array){ d.done=p.done; d.seen=!!p.seen; } }
  }catch(e){}
  return d;
}
function tutSave(d){ lsSet(TUTKEY, JSON.stringify({done:d.done, seen:d.seen})); }
function tutIsDone(id){ return tutLoad().done.indexOf(id)>=0; }
function tutMarkDone(id){
  var d=tutLoad();
  if(d.done.indexOf(id)<0){ d.done.push(id); tutSave(d); }
}
function tutMarkSeen(){ var d=tutLoad(); if(!d.seen){ d.seen=true; tutSave(d); } }
function tutFirstVisit(){ return !tutLoad().seen; }

/* Reduced motion is a system setting, not a preference we invent. Checked at
   call time rather than cached: the OS toggle can flip while the page is open. */
function tutReduced(){
  try{ return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch(e){ return false; }
}

/* ---------- the play ceiling ----------
   THE BUG THIS EXISTS FOR. The coach card is an overlay at the bottom of the
   stage, and tutSpawn used the normal launch height. On a 720px stage an item
   apexed at about y=453 while the card's top edge sat at about y=472, so an item
   spent almost its entire flight BEHIND the card. The lesson said "slice the
   newspaper" and the player saw an empty sky — reported as "I cannot play, there
   is not any items".

   Everything the player must see is now kept above this line, and items are
   launched to reach it rather than to a fixed height. */
function tutCeil(){
  var c=el("tutCoach");
  var cardTop = (c && !c.classList.contains("hidden")) ? c.getBoundingClientRect().height+34 : 120;
  return Math.max(120, H-cardTop);         /* lowest y that is still clearly visible */
}
/* Where a scripted item should hang at the top of its arc: comfortably above the
   card, and never off the top of a short stage. */
function tutApexY(){ return Math.max(70, Math.min(H*0.34, tutCeil()-90)); }

/* ---------- controller naming, shared by several lessons ---------- */
function tutCtlName(){
  return controlMode==="cam" ? "webcam hand" : controlMode==="remote" ? "phone" : "mouse";
}
function tutCtlVerb(){
  /* What "aim" physically means differs per controller, and a lesson that says
     "move your mouse" to someone on a phone is worse than no lesson. */
  return controlMode==="cam" ? "Move your hand in front of the webcam."
       : controlMode==="remote" ? "Tilt and swing your phone."
       : "Move your mouse, or drag on a touch screen.";
}

/* ================= lesson content ================= */
/* Step kinds:
     say   — a coach card, advanced by the player
     demo  — a coach card with an animated controller illustration
     do    — a coach card that waits for `goal` to come true
   Optional per step: setup(), goal(), cleanup(), demo id, ok (confirm sound). */

var TLESSONS=[
  {
    id:"quickstart", name:"Quick Start",
    blurb:"The five-minute version. Aim, slice, and read the HUD.",
    mode:"sort",
    steps:[
      {k:"demo", demo:"aim",
       en:function(){ return "Welcome. You are holding a blade, and your "+tutCtlName()+" moves it. "+tutCtlVerb(); }},
      {k:"do", en:"Move the blade into the glowing ring.",
       setup:function(){ TUT.scratch.ring={x:W*0.5, y:tutApexY()+40, r:95, hit:0}; },
       goal:function(){ var r=TUT.scratch.ring; if(!r) return false;
         if(BLADE.active && Math.hypot(BLADE.x-r.x, BLADE.y-r.y)<r.r) r.hit++; else r.hit=0;
         return r.hit>10; },                       /* ~10 frames inside, so a fly-through does not count */
       cleanup:function(){ TUT.scratch.ring=null; }},
      {k:"say", en:"Good — that is your aim. To cut, sweep the blade THROUGH an item. A trail follows behind you."},
      {k:"do", en:"This round is PAPER. Slice the newspaper.",
       setup:function(){ tutSetTopic(0); tutSpawn("news"); },
       goal:function(){ return tutSlicedT("news"); }, ok:true},
      {k:"say", en:"That was +15 points. Your score is top-left, and the bar under the round name is your time."},
      {k:"do", en:"Now a trap. This round wants paper only, so LET THE CAN FALL — do not slice it.",
       setup:function(){ tutSpawn("canTall"); },
       goal:function(){ return tutGone("canTall"); },
       fail:function(){ return tutSlicedT("canTall"); },
       failEn:"That one cost 12 points. Slicing the wrong category subtracts."},
      {k:"say", en:"Wishcycling is what this game is really about: a greasy pizza box LOOKS like paper, but it is general waste."},
      {k:"do", en:"Last one. Slice the magazine and you are ready.",
       setup:function(){ tutSpawn("mag"); },
       goal:function(){ return tutSlicedT("mag"); }, ok:true},
      {k:"play", play:"sort", secs:30, topic:0,
       en:"Now play it for real. Paper round — slice the paper, leave everything else. Your score counts here, but only inside this lesson."},
      {k:"say", en:"That is everything you need. Pause any time with the button top-right — it also holds HOW TO PLAY."}
    ]
  },
  {
    id:"sort", name:"Sort Mode",
    blurb:"Four rounds, one category each. Combos, traps and specials.",
    mode:"sort",
    steps:[
      {k:"say", en:"Sort is four rounds: Paper, Plastic, Metal & Glass, then Spot the traps."},
      {k:"do", en:"Round 1 is PAPER. Slice the cardboard.",
       setup:function(){ tutSetTopic(0); tutSpawn("box"); },
       goal:function(){ return tutSlicedT("box"); }, ok:true},
      {k:"say", en:"Correct slice: +15. Wrong slice: -12. You are never punished twice for one mistake."},
      {k:"do", en:"Slice three paper items in a row to build a combo.",
       setup:function(){ tutSpawn("news",W*0.30); tutSpawn("mag",W*0.50); tutSpawn("envelope",W*0.70); },
       goal:function(){ return tutSlicedCount()>=3; }, ok:true},
      {k:"say", en:"The last round flips the rule: only items that CANNOT be recycled are correct. Drink cartons, greasy boxes and dirty tubs live there."},
      {k:"do", en:"Try it. This is the traps round — slice the greasy pizza box, not the bottle.",
       setup:function(){ tutSetTopic(3); tutSpawn("pizza",W*0.38); tutSpawn("bottle",W*0.64); },
       goal:function(){ return tutSlicedT("pizza"); },
       fail:function(){ return tutSlicedT("bottle"); },
       failEn:"The bottle is recyclable, so in THIS round it is the wrong answer.", ok:true},
      {k:"say", en:"Specials fall too: a golden item doubles your score for a while, a clock adds time, a snowflake freezes the conveyor. They score nothing themselves — slice them for the effect."},
      {k:"play", play:"sort", secs:45, topic:0,
       en:"Your turn. A real Paper round for 45 seconds — spawns, specials, scoring and all."},
      {k:"say", en:"That is Sort. In a real game it is four rounds like that, back to back, and the category changes each time."}
    ]
  },
  {
    id:"quiz", name:"Quiz Mode",
    blurb:"Slice the right answer. Twelve questions, three lives.",
    mode:"quiz",
    steps:[
      {k:"say", en:"Quiz asks a question, then floats the answers up. You slice the one you believe."},
      {k:"say", en:"A run is 12 questions, or 3 lives — whichever ends first. A wrong answer costs a life, and so does running out of time."},
      {k:"say", en:"After every answer you get a short explanation. That is the part worth reading — the questions repeat, the reasons are the lesson."},
      {k:"say", en:"Questions come in a few shapes: which bin an item belongs to, which item belongs in a named bin, and true-or-false claims about recycling in Hong Kong."},
      {k:"play", play:"quiz", secs:60,
       en:"Try it. A real quiz for 60 seconds — real questions, real answer cards, real explanations. Lives here cost you nothing."},
      {k:"say", en:"Answer three in a row and your multiplier rises, up to three times. Speed counts too — answering early scores more than answering late."}
    ]
  },
  {
    id:"binit", name:"Bin It Mode",
    blurb:"No blade. Move the bin and catch what belongs.",
    mode:"tsunami",
    steps:[
      {k:"say", en:"Bin It is the one mode with NO blade. You move a bin along the bottom and catch what belongs in it."},
      {k:"demo", demo:"bin",
       en:function(){ return "The bin follows your "+tutCtlName()+" left and right. Height is ignored — only sideways matters."; }},
      {k:"say", en:"The bin's category changes as you play, and the label above it always tells you which one you are holding."},
      {k:"say", en:"Catch a matching item and you score. Catch the wrong one, or miss one that belonged, and you lose a life. Three lives, then it ends."},
      {k:"say", en:"Two helpers fall here. A Repair Kit gives back a life. A Solar Surge briefly scores everything you catch at a bonus."},
      {k:"play", play:"tsunami", secs:45,
       en:"Your turn. Move the bin and catch what matches the label above it. Running out of lives just restarts the practice."},
      {k:"say", en:"Consecutive correct catches build a combo, the same as Sort. Missing breaks it."}
    ]
  },
  {
    id:"versus", name:"Versus Mode",
    blurb:"Two players, 60 seconds, split screen.",
    mode:"vs",
    steps:[
      {k:"say", en:"Versus is a 60-second race. The screen splits in two and each player defends their own half."},
      {k:"say", en:"Scoring is simple: +1 for a correct slice, -1 for a wrong one. No combos, no specials — just speed and accuracy."},
      {k:"say", en:"The target category rotates every 15 seconds, and it is the SAME category for both players. Nobody gets an easier half."},
      {k:"play", play:"vsbot", secs:45, topic:0,
       en:"Practice against a demonstration bot. It plays the right half, you play the left — slice the paper and keep ahead of it."},
      /* Stated plainly and never softened: a mouse player who reaches a real
         Versus match and finds they cannot play has been misled by the tutorial. */
      {k:"say", warn:true,
       en:"One rule before you invite someone: a REAL Versus match needs two webcam hands, or two phones. Mouse and touch cannot play Versus — there is only one pointer."},
      {k:"say", en:"With two phones, both players scan the same QR code. The laptop hands out player 1 and player 2 in the order you connect."}
    ]
  },
  {
    id:"controls", name:"Controls & Features",
    blurb:"Every controller, the phone connection states, and blades.",
    mode:"sort",
    steps:[
      {k:"demo", demo:"mouse",
       en:"Mouse or touch is the fallback that always works. The blade follows the pointer; drag to leave a trail."},
      {k:"demo", demo:"cam",
       en:"The webcam tracks your index fingertip. Good light and a plain background help. If tracking drops for a moment the blade holds its last position rather than snapping away."},
      {k:"demo", demo:"phone",
       en:"Phone control uses the handset's motion sensors. Scan the QR code, then hold the phone like a knife and swing."},
      {k:"say", en:"Tilting AIMS. It does not slice by itself — you slice by swinging, exactly as with a real blade. Rolling the phone is ignored, so spinning it in your hand will not throw your aim."},
      {k:"say", en:"Hold the phone still and press Calibrate to set your neutral position. Do that once at the start and the centre of the screen becomes your resting point."},
      {k:"say", warn:true,
       en:"On screen you will see the connection state. DIRECT means a straight link to your phone, which is fastest. RELAY / delayed means it fell back to the internet relay and you will feel about a fifth of a second of lag. INPUT LOST means nothing is arriving at all."},
      {k:"say", en:"If you see RELAY, put the laptop and the phones on the same WiFi and reconnect. That is almost always the fix."},
      {k:"play", play:"sort", secs:40, topic:0,
       en:function(){ return "Free play — get a feel for the "+tutCtlName()+". Paper round, 40 seconds, nothing at stake."; }},
      {k:"say", en:"Blades are cosmetic ONLY. A rarer blade does not cut better, reach further or score more — it just looks different."},
      {k:"say", en:"You unlock them with XP, and XP comes from the scores you actually post. Playing well is the only way to earn them — this tutorial deliberately earns you none."}
    ]
  }
];

function tutById(id){ for(var i=0;i<TLESSONS.length;i++) if(TLESSONS[i].id===id) return TLESSONS[i]; return null; }

/* ================= exercise helpers =================
   Used by lesson steps. They talk to the real G.objs list, so a tutorial item
   is a real item: same art, same physics, same slicing. */

function tutSetTopic(idx){
  var R=ROUNDS[idx]; if(!R) return;
  G.round=idx; setTopic(R.topic, R.color);
  el("roundN").textContent=(idx+1)+"/4";
}
/* Scripted spawn. Unlike spawn(), the item is named rather than random — a
   lesson that says "slice the newspaper" has to be able to guarantee one — and
   it is launched to reach tutApexY(), so it is always visible ABOVE the coach
   card rather than hidden behind it. */
function tutSpawn(t, x){
  var it=ITEMBYT[t]; if(!it) return null;
  if(x===undefined) x=W*0.5+(Math.random()-0.5)*W*0.30;
  var rise=Math.max(120, (H+55)-tutApexY());
  var vy=-Math.sqrt(2*DIFF.g*rise);
  var mesh=makeSprite(it); scene.add(mesh);
  var o={it:it, x:x, y:H+55, vx:(W/2-x)/4200, vy:vy, r:50, sliced:false, a:1, scale:1,
         spin:(Math.random()-.5)*1.0, dspin:(Math.random()-.5)*0.03, phase:Math.random()*6,
         side:(x<W/2?0:1), mesh:mesh, tut:true};
  G.objs.push(o);
  /* Recorded because tutGone() has to tell "it fell past you" (the goal of a
     do-not-slice step) apart from "it was never here yet" — both look like an
     empty G.objs from the outside. */
  if(!TUT.scratch.spawnedT) TUT.scratch.spawnedT={};
  TUT.scratch.spawnedT[t]=true;
  return o;
}
function tutSlicedT(t){
  for(var i=0;i<G.objs.length;i++){ var o=G.objs[i]; if(o.it && o.it.t===t && o.sliced) return true; }
  return (TUT.scratch.slicedT||{})[t]===true;
}
function tutSlicedCount(){ return TUT.scratch.slicedN||0; }
function tutGone(t){
  if(tutSlicedT(t)) return false;
  for(var i=0;i<G.objs.length;i++){ if(G.objs[i].it && G.objs[i].it.t===t) return false; }
  return (TUT.scratch.spawnedT||{})[t]===true;
}
/* A `do` step whose items have all gone without its goal being met would strand
   the player, so the runner re-supplies them. */
function tutRestock(){
  var s=tutCurrent(); if(!s || !TUT.waiting || !s.setup) return;
  if(G.objs.length) return;
  if(TUT.scratch.failed) return;
  /* ONLY item exercises. A step whose setup spawns nothing — the aim ring — has
     an empty G.objs for its whole duration, so restocking it would re-run setup
     every frame and reset the ring's dwell counter, making the goal impossible.
     spawnedT is written by tutSpawn, so it is the honest test for "this step is
     about items". */
  if(!TUT.scratch.spawnedT) return;
  var keep=TUT.scratch.slicedT, keepN=TUT.scratch.slicedN;
  try{ s.setup(); }catch(e){}
  TUT.scratch.slicedT=keep; TUT.scratch.slicedN=keepN;   /* progress survives a restock */
}

/* ---------- the Versus demonstration bot ----------
   Deliberately imperfect: it misses sometimes. A bot that cut everything would
   teach the player that they are hopeless rather than how the mode works. */
function tutBotStart(){ TUT.bot={t:0, x:W*0.75, tx:W*0.75}; }
function tutBotStop(){ TUT.bot=null; }
function tutBotUpdate(dt){
  var b=TUT.bot; if(!b) return;
  b.t-=dt;
  if(b.t<=0){
    var target=null;
    for(var i=0;i<G.objs.length;i++){ var o=G.objs[i];
      if(o.sliced || o.x<W/2) continue;
      if(!target || o.y<target.y) target=o; }
    if(target && Math.random()<0.75){ b.tx=target.x; b.t=260+Math.random()*220; }
    else { b.tx=W*0.55+Math.random()*W*0.4; b.t=420; }
  }
  b.x+=(b.tx-b.x)*Math.min(1,dt/170);
}

/* ================= practice: hand the frame to the real mode =================

   THE COMPLAINT THIS ANSWERS. Every lesson was coach cards and scripted single
   items — "user just reading the text and cannot have a taste of it". Quiz, Bin
   It and Controls had no playable step at all.

   A `play` step starts the ACTUAL mode: the real spawner, the real quiz cards,
   the real bin, the real lives and the real score readout, for a fixed number of
   seconds. Nothing is simulated. What keeps it a tutorial is not a watered-down
   copy of the mode — it is that the run is never recorded (scoresRecord returns
   early on TUT.active) and never reaches a result screen (tutModeEnded). */

function tutPlayStart(kind, secs){
  TUT.playing=true;
  TUT.playEnd=performance.now()+secs*1000;
  TUT.scratch.playKind=kind;
  if(kind==="quiz"){ launchQuiz(); }
  else if(kind==="tsunami"){
    launchTsunami();
    /* launchTsunami stops on its own "Start sorting" overlay. In a lesson the
       coach card has already said all of that, and the overlay lands on top of
       it — an unexplained second dialog between the player and the practice.
       Begin immediately instead. */
    tsunamiBegin();
  }
  else {
    /* Sort, and the Versus practice, both run the Sort arena: the real spawner
       in loopBody, the real slicing, the real scoring. Versus adds the bot. */
    GMODE="sort"; setRoundLbl("round");
    G.running=true; G.paused=false; G.score=0; G.objs.length && clearObjs();
    G.spawnT=300; G.pops=[]; G.parts=[]; G.flashes=[]; BLADE.trail=[];
    el("scoreN").textContent="0";
    tutSetTopic(TUT.scratch.playTopic||0);
    el("quizQ").classList.add("hidden");
    /* Beyond the practice window on purpose: the lesson's own timer ends the
       step, and endRound is intercepted anyway. */
    G.roundEndAt=performance.now()+secs*1000+60000;
    show("play");
    tutInput();
    if(kind==="vsbot") tutBotStart();
  }
  el("pauseBtn").style.display="none";      /* the lesson still owns the exit */
  el("tutCoach").classList.remove("hidden");
}

function tutPlayStop(){
  TUT.playing=false;
  TUT.bot=null;
  Q.running=false; TS.running=false; VS.running=false;
  G.running=false;
  el("quizQ").classList.add("hidden");
  clearObjs();
  setRoundLbl("round");
}

/* Seconds left in the practice window, for the live counter on the card. */
function tutPlayLeft(){ return Math.max(0, Math.ceil((TUT.playEnd-performance.now())/1000)); }

/* ================= the runner ================= */

/* THE BUG THAT MADE THE WHOLE TUTORIAL UNPLAYABLE. tutStart wired up the webcam
   and nothing else, so on mouse or touch — the default, and what most people
   open it with — setupMouse() was never called and the blade never moved at
   all. Every mode launcher does exactly this pair; the tutorial silently did
   half of it. Kept as one function so a third controller cannot be added to the
   modes and forgotten here. */
function tutInput(){
  if(controlMode==="cam") setupCam();
  else if(controlMode==="mouse") setupMouse();
  /* remote is already connected before a lesson starts — see tutStart */
}

function tutStart(id){
  var L=tutById(id); if(!L) return;
  /* Phone control keeps its normal QR flow: there is no point teaching the
     phone lessons to someone whose phone is not connected yet. */
  if(controlMode==="remote" && remCount()<1){ TUT.pending=id; hostStartConnect(); return; }
  TUT.pending=null;
  TUT.active=true; TUT.lesson=L; TUT.step=-1; TUT.done=false; TUT.scratch={};
  GMODE=L.mode==="vs" ? "sort" : L.mode;    /* Versus is taught in the shared arena; the bot supplies the opponent */
  G.running=true; G.paused=false; G.score=0; G.round=0;
  clearObjs();
  el("scoreN").textContent="0";
  el("pauseBtn").style.display="none";      /* the lesson has its own exit */
  el("quizQ").classList.add("hidden");
  el("ovl").classList.add("hidden");
  tutSetTopic(0);
  show("play");
  tutInput();
  el("tutCoach").classList.remove("hidden");
  tutAdvance();
  tutMarkSeen();
}

function tutCurrent(){ return TUT.lesson && TUT.lesson.steps[TUT.step]; }

function tutAdvance(){
  var prev=tutCurrent();
  if(prev && prev.cleanup) try{ prev.cleanup(); }catch(e){}
  if(TUT.playing) tutPlayStop();             /* leaving a practice step tears the mode down */
  TUT.step++;
  TUT.scratch={};                            /* per-step state never leaks forward */
  var s=tutCurrent();
  if(!s){ tutFinish(); return; }
  TUT.waiting=(s.k==="do");
  /* Render the card BEFORE setup runs: tutApexY() measures the card, so it has
     to be on screen at its new height before anything is launched at it. */
  tutRenderCoach();
  if(s.setup) try{ s.setup(); }catch(e){}
  if(s.k==="play"){ TUT.scratch.playTopic=s.topic||0; tutPlayStart(s.play, s.secs||35); tutRenderCoach(); }
}

function tutSkipStep(){ if(TUT.lesson) tutAdvance(); }

function tutFinish(){
  if(TUT.lesson) tutMarkDone(TUT.lesson.id);
  TUT.done=true;
  clearObjs();
  tutRenderDone();
}

function tutExit(){
  var s=tutCurrent();
  if(s && s.cleanup) try{ s.cleanup(); }catch(e){}
  if(TUT.playing) tutPlayStop();
  TUT.active=false; TUT.lesson=null; TUT.step=0; TUT.waiting=false;
  TUT.bot=null; TUT.scratch={};
  G.running=false; G.paused=false;
  clearObjs();
  el("tutCoach").classList.add("hidden");
  el("pauseBtn").style.display="";
  stopCam();
  tutRenderLibrary();
  show("tutorial");
}

/* Called instead of a mode's game over while a lesson is running. A tutorial
   must never reach a result screen or spend a real life. */
function tutModeEnded(){
  if(!TUT.active) return false;
  if(TUT.playing){
    /* Practice runs the real mode, so it can really run out of lives or finish a
       round. Neither may end the lesson: restart it and let the practice window
       be the only thing that decides when the step is over. */
    var k=TUT.scratch.playKind, left=Math.max(4,(TUT.playEnd-performance.now())/1000);
    if(k==="quiz"){ launchQuiz(); }
    else if(k==="tsunami"){ launchTsunami(); }
    else { G.running=true; G.score=0; el("scoreN").textContent="0";
           G.roundEndAt=performance.now()+left*1000+60000; }
    el("pauseBtn").style.display="none";
    return true;
  }
  G.running=true;                              /* keep the arena alive under the coach card */
  return true;
}

/* One tick of the lesson, driven from loopBody. */
function tutUpdate(dt, now){
  if(!TUT.active || TUT.done) return;
  if(TUT.bot) tutBotUpdate(dt);
  var s=tutCurrent(); if(!s) return;
  if(s.k==="play"){
    /* Tick the counter on the card without re-rendering it — a card that
       rebuilt every frame would drop the button the player is reaching for. */
    var c=el("tutClock"); if(c) c.textContent=tutPlayLeft()+"s";
    if(TUT.playing && performance.now()>=TUT.playEnd) tutAdvance();
    return;
  }
  if(s.fail && !TUT.scratch.failed){
    var f=false; try{ f=!!s.fail(); }catch(e){}
    if(f){ TUT.scratch.failed=true; tutRenderCoach(true); }
  }
  if(!TUT.waiting) return;
  var ok=false; try{ ok=!!s.goal(); }catch(e){}
  if(ok){
    TUT.waiting=false;
    if(s.ok && typeof sfxCut==="function") sfxCut("paper");   /* short confirmation */
    tutAdvance();
    return;
  }
  tutRestock();
}

/* Tutorial slicing. Reuses the real blade and the real hit test, but scores
   nothing — the lesson's goal is the feedback, and a running total would imply
   a result the player never gets. */
function tutSliceAlong(x1,y1,x2,y2){
  if(!TUT.active) return;
  for(var i=0;i<G.objs.length;i++){ var o=G.objs[i];
    if(o.sliced) continue;
    if(segHit(o,x1,y1,x2,y2)){
      o.sliced=true; o.vy-=0.1; o.dspin=(o.dspin>0?1:-1)*0.28;
      spawnBurst(o.x,o.y, BINCOL[o.it.bin]||"#2fae6a");
      if(typeof sfxCut==="function") sfxCut(o.it.bin);
      if(!TUT.scratch.slicedT) TUT.scratch.slicedT={};
      TUT.scratch.slicedT[o.it.t]=true;
      TUT.scratch.slicedN=(TUT.scratch.slicedN||0)+1;
    }
  }
}

/* ================= arena drawing =================
   THE BUG THIS FIXES. Step 2 of Quick Start asked the player to move the blade
   into a ring, and nothing ever drew the ring. The instruction referred to
   something that did not exist on screen. Called from drawFx. */
function tutDraw(now){
  if(!TUT.active) return;
  var r=TUT.scratch.ring;
  if(r){
    var pulse=0.5+0.5*Math.sin(now/380);
    var inside=BLADE.active && Math.hypot(BLADE.x-r.x, BLADE.y-r.y)<r.r;
    fxc.save();
    fxc.strokeStyle=inside ? "#4fbf7f" : "#ffa94a";
    fxc.lineWidth=inside ? 6 : 4;
    fxc.globalAlpha=inside ? 1 : (0.55+0.35*pulse);
    fxc.setLineDash([14,11]);
    fxc.lineDashOffset=-now/26;
    fxc.beginPath(); fxc.arc(r.x, r.y, r.r, 0, 7); fxc.stroke();
    fxc.setLineDash([]);
    fxc.globalAlpha=inside ? 0.22 : 0.10;
    fxc.fillStyle=inside ? "#4fbf7f" : "#ffa94a";
    fxc.beginPath(); fxc.arc(r.x, r.y, r.r, 0, 7); fxc.fill();
    fxc.restore();
  }
  /* The Versus bot is a demonstration, so it has to be visible as a second
     blade rather than an invisible opponent. */
  if(TUT.bot){
    fxc.save();
    fxc.globalAlpha=0.85; fxc.strokeStyle="#e24b4a"; fxc.lineWidth=4; fxc.lineCap="round";
    fxc.beginPath(); fxc.moveTo(TUT.bot.x-26, H*0.52+14); fxc.lineTo(TUT.bot.x+26, H*0.52-14); fxc.stroke();
    fxc.globalAlpha=0.6; fxc.fillStyle="#e24b4a";
    fxc.font="600 12px "+FONT; fxc.textAlign="center";
    fxc.fillText("BOT", TUT.bot.x, H*0.52+34);
    fxc.restore();
  }
}

/* ================= coach card ================= */

function tutText(v){ return typeof v==="function" ? v() : v; }

function tutRenderCoach(failed){
  var s=tutCurrent(); if(!s) return;
  var c=el("tutCoach"); if(!c) return;
  var en=failed ? s.failEn : tutText(s.en);
  var total=TUT.lesson.steps.length;
  var demo=(s.k==="demo" && s.demo) ? tutDemoHTML(s.demo) : "";
  c.className="tutCoach"+(s.warn?" warn":"")+(failed?" failed":"");
  c.innerHTML=
    '<div class="tcTop"><span class="tcName">'+TUT.lesson.name+'</span>'+
      '<span class="tcStep">'+(TUT.step+1)+' / '+total+'</span></div>'+
    '<div class="tcBar"><i style="width:'+Math.round((TUT.step+1)/total*100)+'%"></i></div>'+
    demo+
    '<p class="tcEn">'+en+'</p>'+
    '<div class="tcRow">'+
      (s.k==="play"
        ? '<span class="tcWait">Playing — <b id="tutClock">'+tutPlayLeft()+'s</b> left</span>'+
          '<button class="btn" id="tutNext" type="button">Finish early</button>'
        : TUT.waiting && !failed
          ? '<span class="tcWait">Try it now</span>'
          : '<button class="btn" id="tutNext" type="button">Continue</button>')+
      (s.k==="play" ? '' : '<button class="btn ghost" id="tutSkip" type="button">Skip step</button>')+
      '<button class="btn ghost" id="tutQuit" type="button">Exit</button>'+
    '</div>';
  tutWireCoach();
}

function tutRenderDone(){
  var c=el("tutCoach"); if(!c) return;
  c.className="tutCoach done";
  c.innerHTML=
    '<div class="tcTop"><span class="tcName">'+TUT.lesson.name+'</span></div>'+
    '<p class="tcEn">Lesson complete.</p>'+
    '<p class="tcNote">No XP, score or unlock was changed — tutorials never count.</p>'+
    '<div class="tcRow">'+
      '<button class="btn" id="tutQuit" type="button">Back to lessons</button>'+
      '<button class="btn ghost" id="tutAgain" type="button">Replay</button>'+
    '</div>';
  tutWireCoach();
}

function tutWireCoach(){
  var n=el("tutNext"); if(n) n.addEventListener("click", tutAdvance);
  var s=el("tutSkip"); if(s) s.addEventListener("click", tutSkipStep);
  var q=el("tutQuit"); if(q) q.addEventListener("click", tutExit);
  var a=el("tutAgain"); if(a) a.addEventListener("click", function(){ var id=TUT.lesson.id; tutExit(); tutStart(id); });
}

/* Animated controller illustrations, inline SVG so they cost no request and
   inherit the theme. Reduced motion gets the same drawing with the movement
   removed — a static illustration, not a missing one. */
function tutDemoHTML(kind){
  var still=tutReduced() ? " still" : "";
  if(kind==="phone"){
    return '<div class="tcDemo'+still+'"><svg viewBox="0 0 200 90" aria-hidden="true">'+
      '<g class="dmPhone"><rect x="86" y="20" width="28" height="50" rx="6"/><line x1="96" y1="63" x2="104" y2="63"/></g>'+
      '<path class="dmArc" d="M40 70 Q100 18 160 70"/></svg>'+
      '<span class="tcCap">Tilt to aim, swing to slice</span></div>';
  }
  if(kind==="cam"){
    return '<div class="tcDemo'+still+'"><svg viewBox="0 0 200 90" aria-hidden="true">'+
      '<rect class="dmBox" x="52" y="16" width="96" height="58" rx="8"/>'+
      '<circle class="dmDot" cx="100" cy="45" r="7"/>'+
      '<path class="dmArc" d="M64 60 Q100 26 136 60"/></svg>'+
      '<span class="tcCap">Your fingertip is the blade</span></div>';
  }
  if(kind==="mouse"){
    return '<div class="tcDemo'+still+'"><svg viewBox="0 0 200 90" aria-hidden="true">'+
      '<g class="dmPhone"><rect x="90" y="22" width="20" height="30" rx="10"/><line x1="100" y1="28" x2="100" y2="36"/></g>'+
      '<path class="dmArc" d="M44 68 Q100 22 156 68"/></svg>'+
      '<span class="tcCap">Drag to leave a trail</span></div>';
  }
  if(kind==="bin"){
    return '<div class="tcDemo'+still+'"><svg viewBox="0 0 200 90" aria-hidden="true">'+
      '<g class="dmBin"><rect x="86" y="46" width="30" height="26" rx="4"/><rect x="82" y="40" width="38" height="7" rx="3"/></g>'+
      '<path class="dmTrack" d="M36 78 L164 78"/></svg>'+
      '<span class="tcCap">Left and right only</span></div>';
  }
  /* aim */
  return '<div class="tcDemo'+still+'"><svg viewBox="0 0 200 90" aria-hidden="true">'+
    '<circle class="dmRing" cx="100" cy="45" r="22"/>'+
    '<path class="dmArc" d="M40 70 Q100 14 160 70"/></svg>'+
    '<span class="tcCap">Sweep through, do not tap</span></div>';
}

/* ================= library screen ================= */

function tutRenderLibrary(){
  var wrap=el("tutList"); if(!wrap) return;
  var d=tutLoad(), n=0;
  var html="";
  for(var i=0;i<TLESSONS.length;i++){
    var L=TLESSONS[i], done=d.done.indexOf(L.id)>=0;
    if(done) n++;
    html+='<button class="tutCard'+(done?" done":"")+'" type="button" data-lesson="'+L.id+'" aria-label="'+L.name+'">'+
      '<span class="tcMark" aria-hidden="true">'+(done?"✓":(i+1))+'</span>'+
      '<span class="tcBody"><b>'+L.name+'</b><small>'+L.blurb+'</small></span>'+
      '<span class="tcGo" aria-hidden="true">'+(done?"Replay":"Start")+'</span></button>';
  }
  wrap.innerHTML=html;
  var pct=Math.round(n/TLESSONS.length*100);
  var p=el("tutProg");
  if(p){
    p.innerHTML='<div class="tpBar"><i style="width:'+pct+'%"></i></div>'+
      '<span>'+n+' of '+TLESSONS.length+' complete</span>';
  }
  var hint=el("tutHint");
  if(hint) hint.classList.toggle("hidden", !!d.seen);
}

/* ================= pause: HOW TO PLAY =================
   A reference for the mode you are already in, opened over the pause overlay
   and closed back to it. It must not touch G.paused, the clock or any object —
   the player asked for help, not for their run to be disturbed. */

var TUTREF={
  sort:"Four rounds, one category each. Slice items from the named category for +15, anything else for -12. The last round inverts: slice only what CANNOT be recycled. Golden items double your score, clocks add time, snowflakes freeze the conveyor.",
  quiz:"Slice the answer you believe. 12 questions or 3 lives, whichever ends first. A wrong answer or a timeout costs a life. Three right in a row raises your multiplier, and answering early scores more.",
  tsunami:"No blade here. Move the bin left and right and catch what matches the label above it. A wrong catch or a missed match costs a life. Repair Kits give one back; Solar Surge briefly boosts your score.",
  vs:"60 seconds, split screen, one shared target category that rotates every 15 seconds. +1 for a correct slice, -1 for a wrong one. Needs two webcam hands or two phones."
};

function tutHelpOpen(){
  var r=TUTREF[GMODE]||TUTREF.sort;
  var box=el("tutHelp"); if(!box) return;
  box.innerHTML='<div class="t">How to play</div>'+
    '<p class="tcEn">'+r+'</p>'+
    '<div class="row"><button class="btn" id="tutHelpBack" type="button">Back</button></div>';
  box.classList.remove("hidden");
  el("pauseOvl").classList.add("hidden");
  var b=el("tutHelpBack");
  if(b){ b.addEventListener("click", tutHelpClose); b.focus(); }
}
function tutHelpClose(){
  el("tutHelp").classList.add("hidden");
  el("pauseOvl").classList.remove("hidden");
  var r=el("resumeBtn"); if(r) r.focus();
}

/* ================= wiring ================= */

function tutSetup(){
  var b=el("tutBtn");
  /* Opening the library is what "first visit" means — the nudge has done its
     job at that point, whether or not they go on to start a lesson. */
  if(b) b.addEventListener("click", function(){ tutMarkSeen(); b.classList.remove("suggest"); tutRenderLibrary(); show("tutorial"); });
  var toMenu=function(){ show("start"); };
  var back=el("tutBack"); if(back) back.addEventListener("click", toMenu);
  var backTop=el("tutBackTop"); if(backTop) backTop.addEventListener("click", toMenu);
  var list=el("tutList");
  if(list) list.addEventListener("click", function(e){
    var card=e.target.closest && e.target.closest("[data-lesson]");
    if(card) tutStart(card.getAttribute("data-lesson"));
  });
  var help=el("helpBtn");
  if(help) help.addEventListener("click", tutHelpOpen);
  /* First-time players are nudged, never gated. */
  if(b && tutFirstVisit()) b.classList.add("suggest");
  tutRenderLibrary();
}

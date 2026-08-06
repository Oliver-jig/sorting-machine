/* ================= interactive tutorial =================

   A tutorial that is PLAYED, not read. Lessons run the real modes on the real
   arena with the real items, blade and HUD — the only differences are that a
   coach card sits on top, spawns are scripted, and nothing that happens can
   touch the player's XP, scores, unlocks or saved results.

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
   teaching material never means touching the state machine. */

var TUT={
  active:false,       /* a lesson is running — the isolation flag */
  lesson:null,        /* the TLESSONS entry */
  step:0,
  waiting:false,      /* on a `do` step, watching for its goal */
  done:false,
  pending:null,       /* lesson id waiting on the phone-connect screen */
  ret:0,              /* frame budget for goal checks */
  bot:null,           /* Versus demonstration bot */
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

/* ---------- controller naming, shared by several lessons ---------- */
function tutCtlName(){
  return controlMode==="cam" ? "webcam hand" : controlMode==="remote" ? "phone" : "mouse";
}
function tutCtlVerb(){
  /* What "aim" physically means differs per controller, and a lesson that says
     "move your mouse" to someone on a phone is worse than no lesson. */
  return controlMode==="cam" ? {en:"Move your hand in front of the webcam.", zh:"在鏡頭前移動你的手。"}
       : controlMode==="remote" ? {en:"Tilt and swing your phone.", zh:"傾斜及揮動你的手機。"}
       : {en:"Move your mouse, or drag on a touch screen.", zh:"移動滑鼠，或在觸控螢幕上拖曳。"};
}

/* ================= lesson content ================= */
/* Step kinds:
     say   — a coach card, advanced by the player
     demo  — a coach card with an animated controller illustration
     do    — a coach card that waits for `goal` to come true
   Optional per step: setup(), goal(), cleanup(), demo id, ok (confirm sound). */

var TLESSONS=[
  {
    id:"quickstart", name:"Quick Start", zh:"快速入門",
    blurb:"The five-minute version. Aim, slice, and read the HUD.",
    blurbZh:"五分鐘速成：瞄準、切割、看懂介面。",
    mode:"sort",
    steps:[
      {k:"demo", demo:"aim",
       en:function(){ return "Welcome. You are holding a blade, and your "+tutCtlName()+" moves it. "+tutCtlVerb().en; },
       zh:function(){ return "歡迎。你手上有一把刀，用你的"+(controlMode==="cam"?"手":controlMode==="remote"?"手機":"滑鼠")+"控制它。"+tutCtlVerb().zh; }},
      {k:"do", en:"Move the blade into the ring to check your controller.",
       zh:"把刀移到圓圈中，確認控制器運作正常。",
       setup:function(){ TUT.scratch.ring={x:W*0.5, y:H*0.45, r:90, hit:0}; },
       goal:function(){ var r=TUT.scratch.ring; if(!r) return false;
         if(BLADE.active && Math.hypot(BLADE.x-r.x, BLADE.y-r.y)<r.r) r.hit++; else r.hit=0;
         return r.hit>10; },                       /* ~10 frames inside, so a fly-through does not count */
       cleanup:function(){ TUT.scratch.ring=null; }},
      {k:"say", en:"Good. That is your aim. To cut, sweep the blade THROUGH an item — a trail appears behind you.",
       zh:"很好，這就是瞄準。切割時，把刀掃過物品，刀鋒會留下軌跡。"},
      {k:"do", en:"This round is PAPER. Slice the newspaper.",
       zh:"這一回合收集「紙張」。切開報紙。",
       setup:function(){ tutSetTopic(0); tutSpawn("news"); },
       goal:function(){ return tutSlicedT("news"); }, ok:true},
      {k:"say", en:"+15 points. The score sits top-left, and the bar under the round name is your time.",
       zh:"+15 分。分數在左上角，回合名稱下的長條是時間。"},
      {k:"do", en:"Now a trap. This round wants paper only — LET THE CAN FALL. Do not slice it.",
       zh:"陷阱來了。這回合只要紙張，讓鋁罐掉下去，不要切它。",
       setup:function(){ tutSpawn("canTall"); TUT.scratch.guard=1; },
       goal:function(){ return tutGone("canTall"); },
       fail:function(){ return tutSlicedT("canTall"); },
       failEn:"That one cost you 12 points. Wrong-category slices subtract.",
       failZh:"那一刀扣了 12 分。切錯類別會扣分。"},
      {k:"say", en:"Wishcycling is the trap this game is really about: a greasy pizza box LOOKS like paper, but it is general waste.",
       zh:"「一廂情願回收」是本遊戲的重點：油污薄餅盒看似紙張，其實是普通垃圾。"},
      {k:"do", en:"Last one. Slice the magazine, then you are ready.",
       zh:"最後一個。切開雜誌，你就可以開始了。",
       setup:function(){ tutSpawn("mag"); },
       goal:function(){ return tutSlicedT("mag"); }, ok:true},
      {k:"say", en:"That is everything you need. Pause any time with the button top-right — it also holds HOW TO PLAY.",
       zh:"這樣就夠了。右上角可隨時暫停，那裡也有「遊戲教學」。"}
    ]
  },
  {
    id:"sort", name:"Sort Mode", zh:"分類模式",
    blurb:"Four rounds, one category each. Combos, traps and specials.",
    blurbZh:"四個回合，每回合一種類別。連擊、陷阱與特殊道具。",
    mode:"sort",
    steps:[
      {k:"say", en:"Sort is four rounds: Paper, Plastic, Metal & Glass, then Spot the traps.",
       zh:"分類模式共四回合：紙張、塑膠、金屬與玻璃，最後是「找出陷阱」。"},
      {k:"do", en:"Round 1 is PAPER. Slice the cardboard.",
       zh:"第一回合是紙張。切開紙皮。",
       setup:function(){ tutSetTopic(0); tutSpawn("box"); },
       goal:function(){ return tutSlicedT("box"); }, ok:true},
      {k:"say", en:"Correct slice: +15. Wrong slice: −12. You are never punished twice for one mistake.",
       zh:"切對 +15 分，切錯 −12 分。同一個錯誤不會被罰兩次。"},
      {k:"do", en:"Slice three paper items in a row for a combo.",
       zh:"連續切開三件紙類物品，形成連擊。",
       setup:function(){ TUT.scratch.chain=0; tutSpawn("news"); tutSpawn("mag"); tutSpawn("envelope"); },
       goal:function(){ return tutSlicedCount()>=3; }, ok:true},
      {k:"say", en:"The last round flips the rule: only items that CANNOT be recycled are correct. Drink cartons, greasy boxes and dirty tubs live there.",
       zh:"最後一回合規則相反：只有「不能回收」的物品才算正確。紙包飲品、油污盒、髒容器都屬於這類。"},
      {k:"do", en:"Try it. This is the traps round — slice the greasy pizza box, not the bottle.",
       zh:"試試看。這是陷阱回合：切油污薄餅盒，不要切膠樽。",
       setup:function(){ tutSetTopic(3); tutSpawn("pizza"); tutSpawn("bottle"); },
       goal:function(){ return tutSlicedT("pizza"); },
       fail:function(){ return tutSlicedT("bottle"); },
       failEn:"The bottle is recyclable, so in THIS round it is the wrong answer.",
       failZh:"膠樽可以回收，所以在「這個」回合它是錯的。", ok:true},
      {k:"say", en:"Specials fall too: a golden item doubles your score for a while, a clock adds time, a snowflake freezes the conveyor. They score nothing themselves — slice them for the effect.",
       zh:"特殊道具也會出現：金色物品短暫雙倍分數，時鐘增加時間，雪花凍結輸送帶。它們本身不計分，切它們是為了效果。"}
    ]
  },
  {
    id:"quiz", name:"Quiz Mode", zh:"問答模式",
    blurb:"Slice the right answer. Twelve questions, three lives.",
    blurbZh:"切出正確答案。十二題，三條命。",
    mode:"quiz",
    steps:[
      {k:"say", en:"Quiz asks a question, then floats the answers up. You slice the one you believe.",
       zh:"問答模式會出題，答案會浮上來，你切開你認為正確的一個。"},
      {k:"say", en:"A run is 12 questions, or 3 lives — whichever ends first. A wrong answer costs a life; running out of time also costs one.",
       zh:"每局 12 題或 3 條命，先到者為止。答錯扣一條命，超時同樣扣一條。"},
      {k:"say", en:"After every answer you get a short explanation. That is the part worth reading — the questions repeat, the reasons are the lesson.",
       zh:"每題作答後會有簡短解說。那才是重點——題目會重複，道理才是學習的內容。"},
      {k:"say", en:"Questions come in a few shapes: which bin an item belongs to, which item belongs in a named bin, and true-or-false claims about recycling in Hong Kong.",
       zh:"題型有幾種：物品應放哪個回收桶、哪件物品屬於指定回收桶，以及關於香港回收的是非題。"},
      {k:"say", en:"Answer three in a row and your score multiplier rises, up to three times. Speed counts too — answering early scores more than answering late.",
       zh:"連續答對三題會提升分數倍率，最高三倍。速度也重要——越早作答分數越高。"}
    ]
  },
  {
    id:"binit", name:"Bin It Mode", zh:"入樽模式",
    blurb:"No blade. Move the bin and catch what belongs.",
    blurbZh:"沒有刀。移動回收桶，接住屬於它的物品。",
    mode:"tsunami",
    steps:[
      {k:"say", en:"Bin It is the one mode with NO blade. You move a bin along the bottom and catch what belongs in it.",
       zh:"入樽模式是唯一沒有刀的模式。你在底部移動回收桶，接住屬於它的物品。"},
      {k:"demo", demo:"bin",
       en:function(){ return "The bin follows your "+tutCtlName()+" left and right. Height is ignored — only sideways matters."; },
       zh:function(){ return "回收桶會左右跟隨你的"+(controlMode==="cam"?"手":controlMode==="remote"?"手機":"滑鼠")+"。高度無效，只有左右有用。"; }},
      {k:"say", en:"The bin's category changes as you play, and the label above it always tells you which one you are holding.",
       zh:"回收桶的類別會轉換，桶上方的標籤永遠顯示目前的類別。"},
      {k:"say", en:"Catch a matching item: points. Catch the wrong one, or miss one that belonged: you lose a life. Three lives, then it ends.",
       zh:"接到正確物品得分；接錯，或漏掉本應接住的物品，會失去一條命。三條命用完即結束。"},
      {k:"say", en:"Two helpers fall here. A Repair Kit gives back a life. A Solar Surge briefly scores everything you catch at a bonus.",
       zh:"這裡有兩種助力：維修包可回復一條命；太陽能爆發會在短時間內為你接住的物品加成。"},
      {k:"say", en:"Consecutive correct catches build a combo, same as Sort. Missing breaks it.",
       zh:"連續接對會累積連擊，與分類模式相同。漏接則中斷。"}
    ]
  },
  {
    id:"versus", name:"Versus Mode", zh:"對戰模式",
    blurb:"Two players, 60 seconds, split screen.",
    blurbZh:"兩位玩家，六十秒，分割畫面。",
    mode:"vs",
    steps:[
      {k:"say", en:"Versus is a 60-second race. The screen splits in two and each player defends their own half.",
       zh:"對戰模式是六十秒競賽。畫面分成兩半，各自防守自己那一半。"},
      {k:"say", en:"Scoring is simple here: +1 for a correct slice, −1 for a wrong one. No combos, no specials — just speed and accuracy.",
       zh:"計分很簡單：切對 +1，切錯 −1。沒有連擊，沒有特殊道具，只比快和準。"},
      {k:"say", en:"The target category rotates every 15 seconds, and it is the SAME category for both players. Nobody gets an easier half.",
       zh:"目標類別每 15 秒轉換一次，兩位玩家的類別相同，沒有人會分到較容易的一半。"},
      {k:"do", en:"Practice against a demonstration bot. Slice the paper on your side — the bot plays the other.",
       zh:"對電腦示範對手練習。切開你這邊的紙類，電腦會玩另一半。",
       setup:function(){ tutBotStart(); tutSetTopic(0); tutSpawn("news"); tutSpawn("box"); },
       goal:function(){ return tutSlicedCount()>=2; },
       cleanup:function(){ tutBotStop(); }, ok:true},
      /* Stated plainly and never softened: a mouse player who reaches a real
         Versus match and finds they cannot play has been misled by the tutorial. */
      {k:"say", en:"One rule to know before you invite someone: a REAL Versus match needs two webcam hands, or two phones. Mouse and touch cannot play Versus — there is only one pointer.",
       zh:"開始真正對戰前必須知道：真正的對戰需要兩隻鏡頭手，或兩部手機。滑鼠和觸控無法對戰，因為只有一個游標。",
       warn:true},
      {k:"say", en:"With two phones, both players scan the same QR code. The laptop hands out player 1 and player 2 in the order you connect.",
       zh:"使用兩部手機時，兩位玩家掃描同一個 QR 碼。電腦會按連接次序分配一號及二號玩家。"}
    ]
  },
  {
    id:"controls", name:"Controls & Features", zh:"操作與功能",
    blurb:"Every controller, the phone connection states, and blades.",
    blurbZh:"所有控制方式、手機連線狀態，以及刀鋒。",
    mode:"sort",
    steps:[
      {k:"demo", demo:"mouse",
       en:"Mouse or touch is the fallback that always works. The blade follows the pointer; drag to leave a trail.",
       zh:"滑鼠或觸控是永遠可用的後備方式。刀鋒跟隨游標，拖曳即可留下軌跡。"},
      {k:"demo", demo:"cam",
       en:"Webcam tracks your index fingertip. Good light and a plain background help. If tracking drops for a moment the blade holds its last position rather than snapping away.",
       zh:"鏡頭會追蹤你的食指指尖。光線充足、背景簡潔會更準確。若短暫失去追蹤，刀鋒會保持原位而不會亂跳。"},
      {k:"demo", demo:"phone",
       en:"Phone control uses the handset's motion sensors. Scan the QR code, then hold the phone like a knife and swing.",
       zh:"手機控制使用手機的動作感應器。掃描 QR 碼，然後像握刀一樣握住手機揮動。"},
      {k:"say", en:"Tilting AIMS. It does not slice by itself — you slice by swinging, exactly as with a real blade. Rolling the phone is ignored, so spinning it in your hand will not throw your aim.",
       zh:"傾斜是「瞄準」，本身不會切割；揮動才會切，就像真刀一樣。轉動手機會被忽略，所以在手中轉刀不會影響瞄準。"},
      {k:"say", en:"Hold the phone still and press Calibrate to set your neutral position. Do that once at the start and the centre of the screen becomes your resting point.",
       zh:"握穩手機並按「校正」以設定中立位置。開始時做一次，畫面中央就是你的休息位置。"},
      {k:"say", en:"On screen you will see the connection state. DIRECT means a straight link to your phone — the fastest. RELAY / delayed means it fell back to the internet relay and you will feel about a fifth of a second of lag. INPUT LOST means nothing is arriving at all.",
       zh:"畫面上會顯示連線狀態。DIRECT 表示與手機直接連線，速度最快。RELAY / delayed 表示改用網絡中繼，會有約五分之一秒延遲。INPUT LOST 表示完全收不到訊號。",
       warn:true},
      {k:"say", en:"If you see RELAY, put the laptop and the phones on the same WiFi and reconnect. That is almost always the fix.",
       zh:"若看到 RELAY，請把電腦與手機連到同一個 WiFi 再重新連接，這幾乎總能解決問題。"},
      {k:"say", en:"Blades are cosmetic ONLY. A rarer blade does not cut better, reach further or score more — it just looks different.",
       zh:"刀鋒只影響外觀。稀有的刀不會切得更好、更遠或更高分，只是外型不同。"},
      {k:"say", en:"You unlock them with XP, and XP comes from the scores you actually post. Playing well is the only way to earn them — this tutorial deliberately earns you none.",
       zh:"刀鋒以經驗值解鎖，而經驗值來自你實際取得的分數。只有好好遊玩才能賺取——本教學刻意不會給你任何經驗值。"}
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
/* Scripted spawn. Unlike spawn(), the item is named, not random — a lesson that
   says "slice the newspaper" has to be able to guarantee a newspaper. */
function tutSpawn(t, x){
  var it=ITEMBYT[t]; if(!it) return null;
  if(x===undefined) x=W*0.5+(Math.random()-0.5)*W*0.35;
  var vy=-(Math.sqrt(2*DIFF.g*riseFor(DIFF.h)))*0.92;
  var mesh=makeSprite(it); scene.add(mesh);
  var o={it:it, x:x, y:H+55, vx:(W/2-x)/2600, vy:vy, r:50, sliced:false, a:1, scale:1,
         spin:(Math.random()-.5)*1.2, dspin:(Math.random()-.5)*0.04, phase:Math.random()*6,
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
/* "Gone" means it left the screen unsliced — the success condition for a step
   that asks the player NOT to cut something. */
function tutGone(t){
  if(tutSlicedT(t)) return false;
  for(var i=0;i<G.objs.length;i++){ if(G.objs[i].it && G.objs[i].it.t===t) return false; }
  return (TUT.scratch.spawnedT||{})[t]===true;
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

/* ================= the runner ================= */

function tutStart(id){
  var L=tutById(id); if(!L) return;
  /* Phone control keeps its normal QR flow: there is no point teaching the
     phone lessons to someone whose phone is not connected yet. */
  if(controlMode==="remote" && remCount()<1){ TUT.pending=id; hostStartConnect(); return; }
  TUT.pending=null;
  TUT.active=true; TUT.lesson=L; TUT.step=-1; TUT.done=false; TUT.scratch={};
  GMODE=L.mode==="vs" ? "sort" : L.mode;    /* Versus is taught in the shared arena; the bot supplies the opponent */
  G.running=true; G.paused=false; G.score=0; G.round=0;
  G.objs && clearObjs();
  el("scoreN").textContent="0";
  el("pauseBtn").style.display="none";      /* the lesson has its own exit */
  el("quizQ").classList.add("hidden");
  el("ovl").classList.add("hidden");
  tutSetTopic(0);
  show("play");
  if(controlMode==="cam") setupCam();
  el("tutCoach").classList.remove("hidden");
  tutAdvance();
  tutMarkSeen();
}

function tutCurrent(){ return TUT.lesson && TUT.lesson.steps[TUT.step]; }

function tutAdvance(){
  var prev=tutCurrent();
  if(prev && prev.cleanup) try{ prev.cleanup(); }catch(e){}
  TUT.step++;
  TUT.scratch={};                            /* per-step state never leaks forward */
  var s=tutCurrent();
  if(!s){ tutFinish(); return; }
  TUT.waiting=(s.k==="do");
  if(s.setup) try{ s.setup(); }catch(e){}
  tutRenderCoach();
}

function tutSkipStep(){ if(TUT.lesson) tutAdvance(); }

function tutFinish(){
  if(TUT.lesson) tutMarkDone(TUT.lesson.id);
  TUT.done=true;
  tutRenderDone();
}

function tutExit(){
  var s=tutCurrent();
  if(s && s.cleanup) try{ s.cleanup(); }catch(e){}
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
  G.running=true;                              /* keep the arena alive under the coach card */
  return true;
}

/* One tick of the lesson, driven from loopBody. Kept cheap: goal checks run at
   frame rate, so they must not allocate. */
function tutUpdate(dt, now){
  if(!TUT.active || TUT.done) return;
  if(TUT.bot) tutBotUpdate(dt);
  var s=tutCurrent(); if(!s) return;
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
  }
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

/* ================= coach card ================= */

function tutText(v){ return typeof v==="function" ? v() : v; }

function tutRenderCoach(failed){
  var s=tutCurrent(); if(!s) return;
  var c=el("tutCoach"); if(!c) return;
  var en=failed ? s.failEn : tutText(s.en);
  var zh=failed ? s.failZh : tutText(s.zh);
  var total=TUT.lesson.steps.length;
  var demo=(s.k==="demo" && s.demo) ? tutDemoHTML(s.demo) : "";
  c.className="tutCoach"+(s.warn?" warn":"")+(failed?" failed":"");
  c.innerHTML=
    '<div class="tcTop"><span class="tcName">'+TUT.lesson.name+' <i>'+TUT.lesson.zh+'</i></span>'+
      '<span class="tcStep">'+(TUT.step+1)+' / '+total+'</span></div>'+
    '<div class="tcBar"><i style="width:'+Math.round((TUT.step+1)/total*100)+'%"></i></div>'+
    demo+
    '<p class="tcEn">'+en+'</p><p class="tcZh">'+zh+'</p>'+
    '<div class="tcRow">'+
      (TUT.waiting && !failed
        ? '<span class="tcWait">Try it — 動手試試</span>'
        : '<button class="btn" id="tutNext" type="button">Continue 繼續</button>')+
      '<button class="btn ghost" id="tutSkip" type="button">Skip step 略過</button>'+
      '<button class="btn ghost" id="tutQuit" type="button">Exit 離開</button>'+
    '</div>';
  tutWireCoach();
}

function tutRenderDone(){
  var c=el("tutCoach"); if(!c) return;
  c.className="tutCoach done";
  c.innerHTML=
    '<div class="tcTop"><span class="tcName">'+TUT.lesson.name+' <i>'+TUT.lesson.zh+'</i></span></div>'+
    '<p class="tcEn">Lesson complete.</p><p class="tcZh">課程完成。</p>'+
    '<p class="tcNote">No XP, score or unlock was changed — tutorials never count.<br>'+
      '<i>教學不會影響經驗值、分數或解鎖。</i></p>'+
    '<div class="tcRow">'+
      '<button class="btn" id="tutQuit" type="button">Back to lessons 返回</button>'+
      '<button class="btn ghost" id="tutAgain" type="button">Replay 重播</button>'+
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
      '<span class="tcCap">Tilt to aim, swing to slice · 傾斜瞄準，揮動切割</span></div>';
  }
  if(kind==="cam"){
    return '<div class="tcDemo'+still+'"><svg viewBox="0 0 200 90" aria-hidden="true">'+
      '<rect class="dmBox" x="52" y="16" width="96" height="58" rx="8"/>'+
      '<circle class="dmDot" cx="100" cy="45" r="7"/>'+
      '<path class="dmArc" d="M64 60 Q100 26 136 60"/></svg>'+
      '<span class="tcCap">Your fingertip is the blade · 指尖就是刀鋒</span></div>';
  }
  if(kind==="mouse"){
    return '<div class="tcDemo'+still+'"><svg viewBox="0 0 200 90" aria-hidden="true">'+
      '<g class="dmPhone"><rect x="90" y="22" width="20" height="30" rx="10"/><line x1="100" y1="28" x2="100" y2="36"/></g>'+
      '<path class="dmArc" d="M44 68 Q100 22 156 68"/></svg>'+
      '<span class="tcCap">Drag to leave a trail · 拖曳留下軌跡</span></div>';
  }
  if(kind==="bin"){
    return '<div class="tcDemo'+still+'"><svg viewBox="0 0 200 90" aria-hidden="true">'+
      '<g class="dmBin"><rect x="86" y="46" width="30" height="26" rx="4"/><rect x="82" y="40" width="38" height="7" rx="3"/></g>'+
      '<path class="dmTrack" d="M36 78 L164 78"/></svg>'+
      '<span class="tcCap">Left and right only · 只有左右</span></div>';
  }
  /* aim */
  return '<div class="tcDemo'+still+'"><svg viewBox="0 0 200 90" aria-hidden="true">'+
    '<circle class="dmRing" cx="100" cy="45" r="22"/>'+
    '<path class="dmArc" d="M40 70 Q100 14 160 70"/></svg>'+
    '<span class="tcCap">Sweep through, do not tap · 掃過，不是點擊</span></div>';
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
      '<span class="tcBody"><b>'+L.name+'</b><i>'+L.zh+'</i>'+
        '<small>'+L.blurb+'</small><small class="zh">'+L.blurbZh+'</small></span>'+
      '<span class="tcGo" aria-hidden="true">'+(done?"Replay 重播":"Start 開始")+'</span></button>';
  }
  wrap.innerHTML=html;
  var pct=Math.round(n/TLESSONS.length*100);
  var p=el("tutProg");
  if(p){
    p.innerHTML='<div class="tpBar"><i style="width:'+pct+'%"></i></div>'+
      '<span>'+n+' of '+TLESSONS.length+' complete · 已完成 '+n+'/'+TLESSONS.length+'</span>';
  }
  var hint=el("tutHint");
  if(hint) hint.classList.toggle("hidden", !!d.seen);
}

/* ================= pause: HOW TO PLAY =================
   A reference for the mode you are already in, opened over the pause overlay
   and closed back to it. It must not touch G.paused, the clock or any object —
   the player asked for help, not for their run to be disturbed. */

var TUTREF={
  sort:{en:"Four rounds, one category each. Slice items from the named category for +15, anything else for −12. The last round inverts: slice only what CANNOT be recycled. Golden items double your score, clocks add time, snowflakes freeze the conveyor.",
        zh:"四個回合，每回合一種類別。切指定類別 +15 分，其他 −12 分。最後一回合相反：只切「不能回收」的物品。金色物品雙倍分數，時鐘加時，雪花凍結輸送帶。"},
  quiz:{en:"Slice the answer you believe. 12 questions or 3 lives, whichever ends first. A wrong answer or a timeout costs a life. Three right in a row raises your multiplier, and answering early scores more.",
        zh:"切開你認為正確的答案。12 題或 3 條命，先到者為止。答錯或超時失去一條命。連對三題提升倍率，越早作答分數越高。"},
  tsunami:{en:"No blade here. Move the bin left and right and catch what matches the label above it. A wrong catch or a missed match costs a life. Repair Kits give one back; Solar Surge briefly boosts your score.",
        zh:"這裡沒有刀。左右移動回收桶，接住符合桶上標籤的物品。接錯或漏接會失去一條命。維修包回復一條命，太陽能爆發短暫提升分數。"},
  vs:{en:"60 seconds, split screen, one shared target category that rotates every 15 seconds. +1 for a correct slice, −1 for a wrong one. Needs two webcam hands or two phones.",
        zh:"六十秒，分割畫面，共用目標類別，每 15 秒轉換。切對 +1，切錯 −1。需要兩隻鏡頭手或兩部手機。"}
};

function tutHelpOpen(){
  var r=TUTREF[GMODE]||TUTREF.sort;
  var box=el("tutHelp"); if(!box) return;
  box.innerHTML='<div class="t">How to play <i>遊戲教學</i></div>'+
    '<p class="tcEn">'+r.en+'</p><p class="tcZh">'+r.zh+'</p>'+
    '<div class="row"><button class="btn" id="tutHelpBack" type="button">Back 返回</button></div>';
  box.classList.remove("hidden");
  el("pauseOvl").classList.add("hidden");
  var b=el("tutHelpBack");
  if(b) b.addEventListener("click", tutHelpClose);
  b && b.focus();
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
  var badge=el("tutBtn");
  if(badge && tutFirstVisit()) badge.classList.add("suggest");
  tutRenderLibrary();
}

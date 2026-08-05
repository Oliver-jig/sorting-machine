/* ================= QUIZ MODE =================
   A run is 12 questions or 3 lives, whichever comes first.
   Every answer teaches immediately; nothing is saved for the result screen.
   Depends on game.js for: G, GMODE, W, H, fxc, el, show, resize, shuffle,
   fxRR, segDist, wrapFx, drawHeart, spawnBurst, ITEMBYT, QBINS, ART, hx, FACTS,
   BLADE, setRoundLbl, setTopic. */
var QUIZ=[
  /* The bag/foam/carton answers here used to contradict the roster: all three
     are accepted recyclables on the HK list and are binned as such, so the
     questions now use real traps from the not-accepted list instead. */
  {type:"item", q:"Which of these can NOT go in a recycling bin?", pool:["bottle","canTall","news","receipt"], correctType:"receipt", why:"receipts are coated thermal paper, not recyclable paper — general waste."},
  {type:"item", q:"Which belongs in the yellow METAL bin?", pool:["news","canTall","bottle","wine"], correctType:"canTall", why:"aluminium drink cans go in the yellow metal bin."},
  {type:"item", q:"Which is a wishcycling trap (looks recyclable but isn't)?", pool:["news","bottle","ceramic","canTall"], correctType:"ceramic", why:"ceramics melt at a different temperature to glass and ruin the whole batch — general waste."},
  {type:"item", q:"Which goes to a green GLASS point, not the tricolour bins?", pool:["wine","bottle","canTall","box"], correctType:"wine", why:"glass isn't in the tricolour bins; use the green glass collection points."},
  {type:"item", q:"Which belongs in the blue PAPER bin?", pool:["bag","bottle","news","canTall"], correctType:"news", why:"clean paper like newspaper goes in the blue bin."},
  {type:"item", q:"Which one is general waste?", pool:["bottle","tissue","canTall","news"], correctType:"tissue", why:"tissue fibres are too short to re-pulp — general waste."},
  {type:"bin", q:"Where does a greasy pizza box go?", correctBin:"trash", why:"food-soiled cardboard contaminates recycling — general waste."},
  {type:"bin", q:"Where does a rinsed plastic water bottle go?", correctBin:"plastic", why:"empty, rinsed PET bottles go in the brown plastic bin."},
  {type:"bin", q:"Where does an aluminium soda can go?", correctBin:"metal", why:"cans go in the yellow metal bin."},
  {type:"bin", q:"Where does a clean glass jar go?", correctBin:"glass", why:"glass goes to the green glass collection points."},
  {type:"bin", q:"Where does a used tissue go?", correctBin:"trash", why:"used tissues can't be recycled — general waste."},
  {type:"text", q:"True or False: greasy pizza boxes can be recycled.", opts:["True","False"], correct:1, why:"false — grease contaminates the paper fibres."},
  {type:"text", q:"True or False: you should rinse containers before recycling.", opts:["True","False"], correct:0, why:"true — rinsing keeps the whole batch usable."},
  {type:"text", q:"About how much waste does Hong Kong landfill each day?", opts:["1,100 tonnes","Over 11,000 tonnes","Under 500 tonnes"], correct:1, why:"Hong Kong sends over 11,000 tonnes to landfill every day."},
  {type:"text", q:"True or False: clean plastic bags can be recycled in Hong Kong.", opts:["True","False"], correct:0, why:"true — clean, dry plastic bags are accepted at GREEN@COMMUNITY points."},
  {type:"text", q:"Which colour bin is for METAL?", opts:["Blue","Yellow","Brown"], correct:1, why:"yellow is metal; blue is paper and brown is plastic."},
  {type:"text", q:"True or False: used batteries can go in the recycling bin.", opts:["True","False"], correct:1, why:"false — batteries are hazardous and need special disposal."},
  {type:"item", q:"Which belongs in the brown PLASTIC bin?", pool:["news","bottle","canTall","wine"], correctType:"bottle", why:"empty, rinsed plastic bottles go in the brown plastic bin."},
  {type:"item", q:"Which goes in the yellow METAL bin?", pool:["spam","news","bottle","wine"], correctType:"spam", why:"a rinsed luncheon-meat tin is metal — the yellow bin."},
  {type:"item", q:"Which counts as PAPER (blue bin)?", pool:["mag","bottle","canTall","foam"], correctType:"mag", why:"magazines count as paper — the blue bin."},
  {type:"item", q:"Which is glass for the green points?", pool:["jar","bottle","canTall","box"], correctType:"jar", why:"glass jars go to the green glass collection points."},
  {type:"item", q:"Which one is general waste?", pool:["news","canTall","bubbletea","wine"], correctType:"bubbletea", why:"a bubble-tea cup and straw are contaminated plastic — general waste."},
  {type:"bin", q:"Where does a flattened cardboard box go?", correctBin:"paper", why:"flatten it into the blue paper bin."},
  {type:"bin", q:"Where does a rinsed yogurt tub go?", correctBin:"plastic", why:"rinsed #5 PP tubs go in the brown plastic bin."},
  {type:"bin", q:"Where does a clean foam box go?", correctBin:"plastic", why:"clean foam is accepted as plastic at GREEN@COMMUNITY points."},
  {type:"bin", q:"Where does a rinsed drink carton go?", correctBin:"paper", why:"GREEN@COMMUNITY collects beverage cartons — they are not general waste."},
  {type:"item", q:"Which of these is NOT glass recycling?", pool:["wine","jar","mirror","beer"], correctType:"mirror", why:"mirrors are coated and melt differently to bottles — general waste."},
  {type:"item", q:"Which is a wishcycling trap?", pool:["box","foil","photo","jar"], correctType:"photo", why:"photo paper carries a chemical emulsion layer — general waste."},
  {type:"item", q:"Which belongs in the yellow METAL bin?", pool:["poonChoi","cdCase","textbook","perfume"], correctType:"poonChoi", why:"a rinsed poon choi tray is metal — the yellow bin."},
  {type:"text", q:"True or False: glass belongs in the tricolour bins.", opts:["True","False"], correct:1, why:"false — glass has its own green collection points."},
  {type:"text", q:"Which colour bin is for PAPER?", opts:["Blue","Yellow","Brown"], correct:0, why:"blue is paper; yellow is metal and brown is plastic."},
  {type:"text", q:"True or False: you should flatten cardboard before recycling.", opts:["True","False"], correct:0, why:"true — flattening saves space and helps collection."},
  {type:"text", q:"Roughly what share of Hong Kong's waste is food waste?", opts:["About 5%","About 30%","About 70%"], correct:1, why:"food waste is around 30% of the municipal waste stream."}
];

/* Tuning. qTime/teachMs are counted down with dt (never wall-clock) so that
   pausing freezes them for free — see the loop's !G.paused guard. */
var QCFG={lives:3, total:12, qTime:8000, teachMs:2100, base:100, speedMax:100, comboEvery:3, comboCap:3};

var Q={running:false, score:0, opts:[], cur:null, locked:false, answer:"", why:"",
       lives:3, asked:0, streak:0, mult:1, qLeft:0, teach:0, teachOK:false, missed:[], lastIdx:-1,
       live:false, armT:0};   /* live = landed AND armed; armT counts that beat down */
var Qseq=[];

/* The handwritten questions above teach nuance — traps, contamination, the
   tricolour scheme — but each one names specific items by hand. That meant the
   roster could grow to 50 items and Quiz would still only ever show the same
   dozen. These generated questions are built from the WHOLE of ITEMS, so every
   item reaches Quiz, and adding more items later needs no work here. */
var QBINWHY={
  paper:"paper and card go in the blue paper bin.",
  plastic:"rinsed plastics go in the brown plastic bin.",
  metal:"rinsed metal goes in the yellow metal bin.",
  glass:"glass goes to the green glass collection points, not the tricolour bins.",
  trash:"this one is not accepted for recycling — general waste."
};
function quizGenItems(n){
  var bins=["paper","plastic","metal","glass","trash"], out=[];
  for(var i=0;i<n;i++){
    var b=bins[i%bins.length];
    var right=ITEMS.filter(function(x){ return x.bin===b; });
    var wrong=shuffle(ITEMS.filter(function(x){ return x.bin!==b; }).slice());
    if(!right.length || wrong.length<3) continue;
    var correct=right[Math.floor(Math.random()*right.length)];
    /* One distractor per bin at most: two items from the same wrong bin is
       fine, but two from the CORRECT bin would give the question two right
       answers, so bins are tracked rather than items. */
    var pool=[correct.t], used={}; used[b]=1;
    wrong.forEach(function(w){
      if(pool.length>=4 || used[w.bin]) return;
      used[w.bin]=1; pool.push(w.t);
    });
    if(pool.length<4) continue;
    out.push({type:"item",
      q:(b==="trash" ? "Which one is general waste?"
                     : "Which belongs in the "+QBINS[b].n.toUpperCase()+" bin?"),
      pool:shuffle(pool), correctType:correct.t, why:QBINWHY[b]});
  }
  return out;
}
var QBANK=QUIZ;                       /* rebuilt each run so generated items vary */

function qpick(){
  if(Qseq.length===0){ Qseq=QBANK.map(function(_,i){return i;}); shuffle(Qseq);
    if(Qseq[0]===Q.lastIdx && Qseq.length>1){ var t=Qseq[0]; Qseq[0]=Qseq[1]; Qseq[1]=t; } }
  var idx=Qseq.shift(); Q.lastIdx=idx; return QBANK[idx];
}

function launchQuiz(){ setRoundLbl("question");
  GMODE="quiz"; Q.running=true; Q.score=0; Q.lives=QCFG.lives; Q.asked=0;
  Q.streak=0; Q.mult=1; Q.missed=[]; Q.locked=false; Q.teach=0; Qseq=[];
  QBANK=QUIZ.concat(quizGenItems(15));      /* fresh roster-wide questions each run */
  BLADE.trail=[]; G.parts=[]; G.pops=[]; G.flashes=[];
  el("scoreN").textContent="0"; setTopic("Quiz", "#7f77dd");
  el("timeFill").style.width="100%"; el("pauseBtn").style.display="";
  show("play"); resize();
  el("ovl").classList.add("hidden"); el("pauseOvl").classList.add("hidden"); el("quizQ").classList.remove("hidden");
  if(controlMode==="cam") setupCam(); else if(controlMode==="mouse") setupMouse();
  quizNext();
}

function quizNext(){
  if(Q.lives<=0 || Q.asked>=QCFG.total){ quizGameOver(); return; }
  Q.asked++; Q.locked=false; Q.teach=0; Q.qLeft=QCFG.qTime; Q.live=false; Q.armT=QARM;
  el("roundN").textContent=Q.asked+"/"+QCFG.total;
  var qq=qpick(); Q.cur=qq; Q.why=qq.why;
  el("quizQ").textContent=qq.q;
  var built=[];
  if(qq.type==="item"){ qq.pool.forEach(function(t){ var it=ITEMBYT[t]||{t:t,col:0xcccccc,n:t}; built.push({kind:"item", t:t, col:it.col, name:(it.n||t), correct:(t===qq.correctType)}); }); Q.answer=(ITEMBYT[qq.correctType]||{n:qq.correctType}).n; }
  else if(qq.type==="bin"){ ["paper","plastic","metal","glass","trash"].forEach(function(b){ built.push({kind:"bin", bin:b, correct:(b===qq.correctBin)}); }); Q.answer="the "+QBINS[qq.correctBin].n+" bin"; }
  else { qq.opts.forEach(function(txt,i){ built.push({kind:"text", txt:txt, correct:(i===qq.correct)}); }); Q.answer=qq.opts[qq.correct]; }
  shuffle(built);
  built.forEach(function(o,i){ o.state="wait"; o.delay=i*200+Math.random()*110; o.r=68;
    o.sliced=false; o.showCorrect=false; o.sliceable=false; o.lane=i; o.laneN=built.length; o.bob=Math.random()*6.28; });
  Q.opts=built;
}

/* Answers rise, decelerate, then hover in their own lane. They no longer fall
   back off-screen — the 8s timer supplies the pressure, so a re-throw only ever
   made you wait for your own answer to come back. */
var QRISE=0.00042;
/* Beat between the last card landing and answers becoming selectable. 150ms is
   ~2% of the 8s question budget, small enough not to feel like a delay, long
   enough that a card cannot land onto a hand that is already moving. */
var QARM=150;
function quizLaunch(o){
  var pad=70, lw=Math.max(170,W-pad*2)/o.laneN;
  o.state="fly"; o.x=pad+o.lane*lw+lw/2;
  o.hy=Math.max(150, H*0.44);
  o.y=H+70; o.vy=-Math.sqrt(2*QRISE*Math.max(60,o.y-o.hy));
}

function quizUpdate(dt){
  if(Q.teach>0){                               /* teaching card is up — everything else holds */
    Q.teach-=dt;
    if(Q.teach<=0){ quizNext(); }
    return;
  }
  var ready=true;
  for(var i=0;i<Q.opts.length;i++){ var o=Q.opts[i]; if(o.sliced) continue;
    if(o.state==="wait"){ o.delay-=dt; if(o.delay<=0) quizLaunch(o); ready=false; continue; }
    if(o.state==="fly"){
      o.vy+=QRISE*dt; o.y+=o.vy*dt;
      /* A flying card is NEVER answerable. It used to become sliceable the
         moment it cleared the bottom edge (o.y<H-70), which meant every card was
         live while travelling ~46% of the screen height for over a second. Four
         of them swept up past wherever the player's hand was and the first one
         to touch it locked in an answer nobody chose.
         Note sliceable is set true ON the landing frame, not the one after:
         Q.live flips as soon as the last card lands, so a card that waited a
         frame to arm would leave a gap where the question was answerable but one
         of its answers was not. */
      if(o.vy>=0 || o.y<=o.hy){ o.state="hover"; o.y=o.hy; o.sliceable=true; }
      else { ready=false; o.sliceable=false; }
    } else { o.bob+=dt*0.0026; o.y=o.hy+Math.sin(o.bob)*7; o.sliceable=true; }
  }
  /* A short beat AFTER the last card lands before anything can be chosen.
     Without it there is still a one-frame hole: on the very frame the last card
     arrives everything arms at once, so a hand that happens to be moving right
     then has a card land straight onto it and picks it. That is the same
     "it chose for me" complaint, just narrowed from 1.2s to one frame.
     The clock is held for the same beat, so the player is never charged for time
     they cannot use — answerable and timed always start together. */
  if(!ready){ Q.armT=QARM; Q.live=false; return; }
  if(Q.armT>0){ Q.armT-=dt; Q.live=false; return; }
  Q.live=true;
  Q.qLeft-=dt;
  el("timeFill").style.width=(Math.max(0,Q.qLeft)/QCFG.qTime*100)+"%";
  if(Q.qLeft<=0 && !Q.locked){ quizTimeout(); }
}

/* How much the blade must actually travel, and over what window, before a swipe
   counts as choosing an answer.
   A window rather than per-frame speed: webcam detection runs ~25fps against a
   60fps render loop, so movement arrives in spikes like 0,0,120,0,0 and any
   per-frame threshold would either miss real swipes or fire on a single jitter
   sample. Summing over ~130ms smooths that out.
   Without this a COMPLETELY STILL hand selects an answer, because with x1,y1
   equal to x2,y2 the segDist test below collapses to plain distance from the
   hand to the card centre — no movement required at all. Standing in front of
   the camera, that meant whichever card landed nearest your resting hand was
   chosen for you. */
/* 80px chosen from measurement. Worst travel in a 130ms window over 60s:
     resting hand, +/-6px tracker jitter ... 48px
     resting hand, +/-8px jitter .......... 64px
     slow drift, 3px per frame ............ 24px
     moderate deliberate swipe ............ 96px
     real slash ........................... 320px
   80 sits above every resting case with margin and below the slowest motion
   worth calling a swipe. The window is what makes that separation possible;
   note the two DO overlap for a badly jittering tracker (+/-12px reaches 95px),
   so this trades a rare missed swipe on bad tracking for never choosing an
   answer the player did not mean. That is the right way round here, because a
   wrong pick locks the question and costs a life. */
var QSWIPEMS=130, QSWIPE=80;
function bladeTravel(ms, x2, y2){
  var t=BLADE.trail, n=t.length, now=(t.length?t[n-1].t:0), d=0;
  /* the current point is not in the trail yet — game.js pushes it AFTER this
     check runs — so it is added on here explicitly */
  var px=x2, py=y2;
  for(var i=n-1;i>=0;i--){
    if(now-t[i].t>ms) break;
    d+=Math.hypot(px-t[i].x, py-t[i].y);
    px=t[i].x; py=t[i].y;
  }
  return d;
}

function quizSliceCheck(x1,y1,x2,y2){
  if(Q.locked || Q.teach>0) return;
  if(!Q.live) return;                       /* still landing — nothing is answerable yet */
  if(bladeTravel(QSWIPEMS,x2,y2)<QSWIPE) return;   /* resting hand must never choose */
  var best=null, bestD=1e9;
  for(var i=0;i<Q.opts.length;i++){ var o=Q.opts[i]; if(o.sliced || o.state==="wait" || !o.sliceable) continue;
    var d=segDist(o.x,o.y,x1,y1,x2,y2); if(d<o.r+6 && d<bestD){ bestD=d; best=o; } }   /* nearest answer only */
  if(!best) return;
  best.sliced=true; Q.locked=true;
  if(best.correct){
    spawnBurst(best.x,best.y,"#20a45a");
    var speed=Math.round(QCFG.speedMax*Math.max(0,Q.qLeft)/QCFG.qTime);
    Q.streak++; Q.mult=Math.min(QCFG.comboCap, 1+Math.floor(Q.streak/QCFG.comboEvery));
    var gain=(QCFG.base+speed)*Q.mult;
    Q.score+=gain; el("scoreN").textContent=Q.score;
    G.pops.push({x:best.x,y:best.y-46,txt:"+"+gain+(Q.mult>1?"  x"+Q.mult:""),col:"#20a45a",a:1,big:true});
    quizTeach(true);
  } else {
    spawnBurst(best.x,best.y,"#d70015");
    G.pops.push({x:best.x,y:best.y-46,txt:"Wrong!",col:"#d70015",a:1,big:true});
    quizMiss();
  }
}

function quizTimeout(){
  Q.locked=true;
  G.pops.push({x:W/2,y:H*0.28,txt:"Out of time!",col:"#d70015",a:1,big:true});
  quizMiss();
}

/* A miss costs a life instead of ending the run, and always records the
   question so the result screen can teach it again. */
function quizMiss(){
  Q.streak=0; Q.mult=1; Q.lives--;
  Q.missed.push({q:Q.cur.q, a:Q.answer, why:Q.why});
  quizTeach(false);
}

function quizTeach(ok){
  Q.teach=QCFG.teachMs; Q.teachOK=ok;
  for(var i=0;i<Q.opts.length;i++){ var o=Q.opts[i]; if(o.correct){ o.showCorrect=true; o.sliced=false; } }
}

function quizGameOver(){
  Q.running=false; Q.teach=0;
  el("quizQ").classList.add("hidden");
  el("rScore").textContent=Q.score;
  var right=Q.asked-Q.missed.length;
  el("rGrade").textContent="You got "+right+" of "+Q.asked+" right"+(Q.lives<=0?" — then ran out of lives.":".");
  var f=el("rFacts"); f.innerHTML="";
  if(Q.missed.length===0){
    var p=document.createElement("div"); p.className="fact";
    p.innerHTML="<b>Clean sweep — no mistakes.</b> Here's one more for the road:";
    f.appendChild(p);
    var d0=document.createElement("div"); d0.className="fact"; d0.textContent=FACTS[Math.floor(Math.random()*FACTS.length)]; f.appendChild(d0);
  } else {
    Q.missed.forEach(function(m){
      var d=document.createElement("div"); d.className="fact";
      d.innerHTML="<b>"+m.q+"</b><br>Answer: <b>"+m.a+"</b> — "+m.why;
      f.appendChild(d);
    });
  }
  scoresRecord("quiz", Q.score);
  stopCam();
  show("result");
}

function quizDraw(now){
  if(G.paused) return;                         /* pausing must not let you read the question for free */
  for(var i=0;i<Q.opts.length;i++){ var o=Q.opts[i]; if(o.sliced || o.state==="wait") continue;
    var w=148,h=148;
    fxc.save(); fxc.translate(o.x,o.y);
    /* A card that has not landed yet cannot be answered, so it must not LOOK
       answerable. Without this the new gate is invisible and a swipe at a rising
       card just silently does nothing, which reads as the game being broken. */
    var armed=Q.live && o.sliceable;
    fxc.globalAlpha=armed?1:0.55;
    fxRR(-w/2,-h/2,w,h,20); fxc.fillStyle="#ffffff"; fxc.fill();
    fxc.lineWidth=o.showCorrect?6:2.5;
    fxc.strokeStyle=o.showCorrect?"#20a45a":(armed?"#cfe6d8":"#e8eeea"); fxc.stroke();
    /* Quiz cards are the OTHER place item art is drawn — they paint straight
       onto the 2D overlay rather than going through makeSprite. They have to
       use the same source or the cards would show old canvas drawings while the
       playfield showed the renders. itemPhoto() returns the decoded image only
       once it is ready, so a card never flashes empty. */
    if(o.kind==="item"){ fxc.save(); fxRR(-w/2,-h/2,w,h,20); fxc.clip();
      var ph=(typeof itemPhoto==="function")?itemPhoto(o.t):null;
      if(ph){ var pw=104, phh=Math.round(pw*ph.naturalHeight/ph.naturalWidth);
        fxc.drawImage(ph, -pw/2, -14-phh/2, pw, phh); }
      else { fxc.translate(0,-14); fxc.scale(0.5,0.5); fxc.translate(-110,-110); (ART[o.t]||ART._def)(fxc, hx(o.col)); }
      fxc.restore();
      fxc.fillStyle="#173a2a"; fxc.font="600 15px "+FONT; fxc.textAlign="center"; fxc.textBaseline="middle"; fxc.fillText((o.name+"").replace(/^[^ ]+\s/,""), 0, 58); }
    else if(o.kind==="bin"){ var b=QBINS[o.bin]; fxc.beginPath(); fxc.arc(0,-20,34,0,7); fxc.fillStyle=b.c; fxc.fill(); fxc.fillStyle="#173a2a"; fxc.font="700 20px "+FONT; fxc.textAlign="center"; fxc.textBaseline="middle"; fxc.fillText(b.n, 0, 40); }
    else { fxc.fillStyle="#173a2a"; fxc.font="700 20px "+FONT; fxc.textAlign="center"; fxc.textBaseline="middle"; wrapFx(o.txt, 0, 0, w-26); }
    fxc.restore();
  }
  for(var hI=0;hI<QCFG.lives;hI++){ drawHeart(28+hI*30, 26, 12, hI<Q.lives?"#e24b4a":"#e2e2e2"); }
  if(Q.mult>1){ fxc.fillStyle="#7f77dd"; fxc.font="700 18px "+FONT; fxc.textAlign="left"; fxc.textBaseline="middle"; fxc.fillText("streak x"+Q.mult, 28, 56); }
  if(Q.teach>0) quizDrawTeach();
}

/* The whole point of the redesign: the explanation lands at the moment of the
   mistake, not on the result screen after the run is already over. */
function quizDrawTeach(){
  var w=Math.min(560,W-40), lines=[], cy=H*0.78;
  fxc.font="600 16px "+FONT;
  var head=Q.teachOK?"Correct":"Answer: "+Q.answer;
  var body=Q.why||"";
  var h=104;
  fxc.save();
  fxRR(W/2-w/2, cy-h/2, w, h, 18);
  fxc.fillStyle="rgba(255,255,255,.96)"; fxc.fill();
  fxc.lineWidth=3; fxc.strokeStyle=Q.teachOK?"#20a45a":"#d70015"; fxc.stroke();
  fxc.textAlign="center"; fxc.textBaseline="middle";
  fxc.fillStyle=Q.teachOK?"#20a45a":"#d70015"; fxc.font="700 20px "+FONT;
  fxc.fillText(head, W/2, cy-28);
  fxc.fillStyle="#173a2a"; fxc.font="600 15px "+FONT;
  wrapFx(body, W/2, cy+12, w-44);
  fxc.restore();
}

/* ================= BIN IT RIGHT =================
   You MOVE A BIN along the bottom and catch the items that belong in it.
   Catch a matching item to score. Miss one, or catch something that does not
   belong, and you lose a life. Three lives ends the run.

   This replaced a steering design where slicing nudged items sideways towards
   five fixed bins. That failed for three measured reasons, none fixable by
   tuning: the bin highlight read an item's CURRENT position and ignored its
   momentum, so it was wrong 46% of the time; items coasted 1.13 bin widths
   after you stopped pushing, with nothing on screen showing it; and the push
   saturated at 80px of blade travel per frame, which after the build 43
   controller fix meant every phone swing maxed out and the control was
   effectively binary. A round was watched ending in ~3 seconds with no input.
   Catching has no momentum to predict and no indirection, so the whole failure
   mode is gone by construction rather than by tuning.

   Depends on game.js for: G, GMODE, W, H, fxc, el, show, resize, scene,
   makeSprite, toWorld, fxRR, drawHeart, spawnBurst, clearObjs, BLADE,
   ITEMS, QBINS, controlMode, setupCam, setupMouse, stopCam, FACTS, hx,
   setRoundLbl, setTopic. */

var DBINS=["paper","plastic","metal","glass","trash"];

var DCFG={
  lives:3,
  /* binW is LOAD-BEARING and must stay 150. The catch test uses exactly this
     width (see the landing test) and dSpawn's reachability window and corridor
     guard are both sized from it — changing it silently changes the fairness
     guarantee. binH is cosmetic only: item y is interpolated from land TIME, not
     a physics fall, so the bin's height and the line's position affect how far
     things visually travel and nothing else. */
  binW:150, binH:82, itemR:45,
  switchMs:17000, warnMs:3000,          /* how long a target holds, and the heads-up */
  fall0:2200, fallMin:1250,             /* fall time ramps down with elapsed */
  gap0:900,   gapMin:450,               /* spawn gap ramps down too */
  rampMs:120000,
  pCorrect:0.45,
  /* How long either side of a correct landing wrong items keep clear. Measured
     over 6 runs each: 260ms gave a mean of 16.8 wrong catches, 450ms gave 14.2,
     but the ranges overlap heavily — this is a marginal lever, not a fix. 450
     is taken because it costs nothing. What actually decides the difficulty is
     how well the player dodges, which no simulation here models honestly. */
  guardMs:450,
  base:10, comboEvery:4, comboCap:4
};

/* The bin can only be in one place, and that — not items colliding — is the
   real constraint. The obvious rule, "space items apart", is COUNTERPRODUCTIVE:
   modelled across seven spawn rates it produced more forced strikes than no
   rule at all, because spreading two correct items apart makes them less
   reachable, not more.
   So correct items are placed INSIDE the window the bin can reach from the
   previous one. Generative, not rejective, which is what makes it hold at any
   spawn rate. Calibrated to the SLOWEST control (webcam hand, taken as one
   screen crossing per second) so the guarantee covers every scheme; phone and
   mouse are quicker and get the slack for free. */
function dVmax(){ return W/1000; }      /* px per ms */

/* Items that look like they belong in the target bin but do not. This is where
   late-game difficulty comes from: knowing the material, not reacting faster.
   Empty list = fall back to any non-matching item. */
var DTRAPS={
  paper:  ["receipt","tissue","photo"],        /* paper-ish, actually general waste */
  glass:  ["mirror","ceramic"],                /* glass-ish, actually general waste */
  plastic:["bubbletea","coffeeCup"],           /* plastic-ish, actually general waste */
  metal:  [],
  trash:  ["carton","bag","foam"]              /* assumed rubbish, actually recyclable */
};

var TS={running:false, lives:3, score:0, streak:0, mult:1, elapsed:0,
        spawnT:0, switchT:0, target:"paper", nextTarget:"plastic",
        right:0, wrong:0, binX:0, lastC:null, banner:0, shield:false, spNext:0};

/* Bin It power-ups. They are CAUGHT like anything else; missing one costs
   nothing, so they are a bonus and never a trap. */
var DSPEC=[
  {n:"🔧 Repair kit",  t:"dsRepair", col:0x30d158, sp:"repair"},
  {n:"☀ Solar surge", t:"dsSolar",  col:0xf5c518, sp:"solar"}
];
var DSCFG={first:9000, every:13000, everyRand:7000};

function dFall(){ var r=Math.min(1,TS.elapsed/DCFG.rampMs); return DCFG.fall0+(DCFG.fallMin-DCFG.fall0)*r; }
function dGap(){  var r=Math.min(1,TS.elapsed/DCFG.rampMs); return DCFG.gap0 +(DCFG.gapMin -DCFG.gap0 )*r; }
function dTrapBias(){ return 0.15+0.5*Math.min(1,TS.elapsed/DCFG.rampMs); }
function binLineY(){ return H-104; }        /* raised so the taller bin still fits */
function binRect(){ return {x:TS.binX-DCFG.binW/2, y:binLineY(), w:DCFG.binW, h:DCFG.binH}; }

function tsunamiIntro(){
  el("ovlT").textContent="Bin It Right";
  el("ovlD").innerHTML="<b>Move the bin</b> and <b>catch</b> the items that belong in it.<br>"+
    "The bin changes what it wants every few seconds — watch the label.<br>"+
    "Miss one it wants, or catch one it doesn't, and you lose a life.";
  el("ovlBtn").textContent="Start sorting";
  el("ovl").classList.remove("hidden");
}
function tsunamiBegin(){ el("ovl").classList.add("hidden"); TS.running=true; }

function dPickTarget(not){
  var p=DBINS.filter(function(b){ return b!==not; });
  return p[Math.floor(Math.random()*p.length)];
}

function launchTsunami(){
  GMODE="tsunami"; TS.running=false; TS.lives=DCFG.lives; TS.score=0;
  TS.streak=0; TS.mult=1; TS.elapsed=0; TS.right=0; TS.wrong=0;
  TS.target=dPickTarget(null); TS.nextTarget=dPickTarget(TS.target);
  TS.switchT=DCFG.switchMs; TS.spawnT=700; TS.lastC=null; TS.banner=2000;
  TS.binX=W/2; TS.shield=false; TS.spNext=DSCFG.first;
  G.pops=[]; G.parts=[]; G.flashes=[]; BLADE.trail=[]; clearObjs();
  el("scoreN").textContent="0"; el("roundN").textContent=TS.lives; setRoundLbl("lives");
  setTopic(QBINS[TS.target].n, QBINS[TS.target].c);
  el("timeFill").style.width="100%";
  el("quizQ").classList.add("hidden"); el("pauseBtn").style.display="";
  show("play"); resize(); el("pauseOvl").classList.add("hidden");
  TS.binX=W/2;
  if(controlMode==="cam") setupCam(); else if(controlMode==="mouse") setupMouse();
  tsunamiIntro();
}

/* ---- spawning ---- */
function dPush(it, x, land, correct){
  var mesh=makeSprite(it); scene.add(mesh);
  G.objs.push({it:it, x:x, y:-40, r:DCFG.itemR, land:land, correct:correct,
    a:1, scale:1, spin:(Math.random()-0.5)*1.2, dspin:(Math.random()-0.5)*0.03,
    phase:Math.random()*6, y0:-40, born:TS.elapsed, mesh:mesh});
}

function dSpawn(){
  var fall=dFall(), land=TS.elapsed+fall;
  var wantCorrect=Math.random()<DCFG.pCorrect;
  var pool, x=null;

  if(wantCorrect){
    pool=ITEMS.filter(function(i){ return i.bin===TS.target; });
    if(!pool.length) return;
    /* the reachable window from the previous correct item */
    var lo=DCFG.itemR, hi=W-DCFG.itemR;
    if(TS.lastC){
      var reach=dVmax()*(land-TS.lastC.land);
      lo=Math.max(lo, TS.lastC.x-reach);
      hi=Math.min(hi, TS.lastC.x+reach);
    }
    if(hi<lo) return;                       /* no legal spot — skip rather than be unfair */
    x=lo+Math.random()*(hi-lo);
    TS.lastC={x:x, land:land};
  } else {
    /* prefer a look-alike so the mistake is a knowledge mistake */
    var traps=(DTRAPS[TS.target]||[]).filter(function(t){
      var it=ITEMBYT[t]; return it && it.bin!==TS.target; });
    if(traps.length && Math.random()<dTrapBias()){
      pool=traps.map(function(t){ return ITEMBYT[t]; });
    } else {
      pool=ITEMS.filter(function(i){ return i.bin!==TS.target; });
    }
    if(!pool.length) return;
    /* stay clear of anywhere the bin is committed to be */
    for(var k=0;k<24;k++){
      var c=DCFG.itemR+Math.random()*(W-2*DCFG.itemR), ok=true;
      for(var i=0;i<G.objs.length;i++){ var o=G.objs[i];
        if(!o.correct) continue;
        if(Math.abs(o.land-land)<DCFG.guardMs &&
           Math.abs(o.x-c)<(DCFG.binW+DCFG.itemR)/2+20){ ok=false; break; }
      }
      if(ok){ x=c; break; }
    }
    if(x===null) return;
  }
  dPush(pool[Math.floor(Math.random()*pool.length)], x, land, wantCorrect);
}

function dspecTry(){
  var s=DSPEC.filter(function(q){ return q.sp!=="repair" || TS.lives<DCFG.lives; });
  if(!s.length) return;
  TS.spNext=DSCFG.every+Math.random()*DSCFG.everyRand;
  var pick=s[Math.floor(Math.random()*s.length)];
  dPush(pick, DCFG.itemR+Math.random()*(W-2*DCFG.itemR), TS.elapsed+dFall(), false);
  G.objs[G.objs.length-1].special=true;
}
function dspecTake(o){
  if(o.it.sp==="repair"){
    TS.lives=Math.min(DCFG.lives, TS.lives+1); el("roundN").textContent=TS.lives;
    G.pops.push({x:o.x, y:o.y, txt:"REPAIRED  +1 life", col:"#20a45a", a:1, big:true});
  } else {
    TS.shield=true;
    G.pops.push({x:o.x, y:o.y, txt:"COMBO SHIELD", col:"#bf8b2e", a:1, big:true});
  }
  spawnBurst(o.x, o.y, hx(o.it.col));
}

/* ---- landing ---- */
function dStrike(o, why){
  /* Solar surge protects the COMBO only — the mistake still costs a life, or
     the shield would simply cancel it. */
  TS.wrong++; TS.lives--;
  if(TS.shield){ TS.shield=false;
    G.pops.push({x:o.x, y:binLineY()-58, txt:"combo saved!", col:"#bf8b2e", a:1}); }
  else { TS.streak=0; TS.mult=1; }
  el("roundN").textContent=Math.max(0,TS.lives);
  spawnBurst(o.x, binLineY(), "#d70015");
  G.pops.push({x:o.x, y:binLineY()-30, txt:why, col:"#d70015", a:1, big:true});
  if(TS.lives<=0) tsunamiGameOver();
}
function dCatch(o){
  TS.right++; TS.streak++;
  TS.mult=Math.min(DCFG.comboCap, 1+Math.floor(TS.streak/DCFG.comboEvery));
  var gain=DCFG.base*TS.mult; TS.score+=gain; el("scoreN").textContent=TS.score;
  spawnBurst(o.x, binLineY(), "#20a45a");
  G.pops.push({x:o.x, y:binLineY()-30, txt:"+"+gain+(TS.mult>1?"  x"+TS.mult:""), col:"#20a45a", a:1, big:true});
}

function tsunamiUpdate(dt, now){
  TS.elapsed+=dt;

  /* bin follows the player's horizontal position, whatever the control scheme.
     BLADE.active is ignored on purpose: the bin should stay put when the mouse
     stops rather than vanish. */
  /* `BLADE.x || TS.binX` would be wrong: x=0 is a legitimate position (hard
     left) and would read as falsy, snapping the bin back instead of letting it
     reach the edge. */
  var px=(typeof BLADE.x==="number" && isFinite(BLADE.x)) ? BLADE.x : TS.binX;
  TS.binX=Math.max(DCFG.binW/2, Math.min(W-DCFG.binW/2, px));

  if(TS.banner>0) TS.banner-=dt;

  /* target rotation. Spawning stops one fall-time before the switch so the
     screen has drained by the time the label changes — otherwise items thrown
     under the old target would still be falling when the bin starts asking for
     something else, and an item's status would change mid-flight. */
  TS.switchT-=dt;
  if(TS.switchT<=0){
    TS.target=TS.nextTarget; TS.nextTarget=dPickTarget(TS.target);
    TS.switchT=DCFG.switchMs; TS.lastC=null; TS.banner=1600;
    setTopic(QBINS[TS.target].n, QBINS[TS.target].c);
  }
  el("timeFill").style.width=(Math.max(0,TS.switchT)/DCFG.switchMs*100)+"%";

  /* +150ms of margin, not just dFall(): without it an item spawned right on the
     boundary can land a frame or two AFTER the switch, and it would then be
     judged against a target that was not showing when it was thrown. Rare, but
     it is exactly the kind of "the game changed the rules mid-air" unfairness
     this redesign exists to remove. */
  var draining=(TS.switchT<=dFall()+150);
  if(!draining){
    TS.spawnT-=dt;
    if(TS.spawnT<=0){ dSpawn(); TS.spawnT=dGap()*(0.75+Math.random()*0.5); }
    TS.spNext-=dt;
    if(TS.spNext<=0) dspecTry();
  }

  /* fall: position is derived from land time, so an item always arrives exactly
     when the spawner promised and the reachability guarantee stays true. */
  var line=binLineY(), br=binRect();
  for(var i=G.objs.length-1;i>=0;i--){ var o=G.objs[i];
    var span=o.land-o.born;
    var p=span>0 ? (TS.elapsed-o.born)/span : 1;
    o.y=o.y0+(line-o.y0)*Math.max(0,p);
    o.spin+=o.dspin;
    var w=toWorld(o.x,o.y); o.mesh.position.set(w.x,w.y,0);
    o.mesh.rotation.set(0.25*Math.sin(now*0.002+o.phase),0,o.spin);
    o.mesh.scale.setScalar(o.scale); o.mesh.material.opacity=o.a;

    if(o.y>=line){
      /* The catch mouth is EXACTLY the bin's drawn width, and the guide column
         above is drawn from the same rect. An earlier version caught anything
         within binW+itemR, which is 195px against a 150px column — items that
         visibly missed still counted, which is precisely the kind of "the game
         lied to me" feeling that made the old steering design unplayable. */
      var inBin=(o.x>=br.x && o.x<=br.x+br.w);
      if(o.special){ if(inBin) dspecTake(o); }
      else if(o.correct && inBin)  dCatch(o);
      else if(o.correct && !inBin) dStrike(o, "missed "+QBINS[o.it.bin].n+"!");
      else if(!o.correct && inBin) dStrike(o, "that's "+QBINS[o.it.bin].n+"!");
      releaseObj(o); G.objs.splice(i,1);
      if(!TS.running) return;                 /* game over mid-loop */
    }
  }
}

/* A lesson never reaches a real game over: tutModeEnded() restarts the practice
   instead, so no result screen, no recorded run and no life spent for real. */
function tsunamiGameOver(){
  if(typeof tutModeEnded==="function" && tutModeEnded()) return;
  TS.running=false;
  el("rScore").textContent=TS.score;
  el("rGrade").textContent="You caught "+TS.right+" item"+(TS.right===1?"":"s")+" correctly and made "+TS.wrong+" mistake"+(TS.wrong===1?"":"s")+".";
  var f=el("rFacts"); f.innerHTML="";
  FACTS.forEach(function(x){ var d=document.createElement("div"); d.className="fact"; d.textContent=x; f.appendChild(d); });
  scoresRecord("tsunami", TS.score);
  stopCam();
  show("result");
}

/* ---- the bin's artwork ----
   Modelled on an EPD three-coloured waste separation bin: colour-coded upright
   body, proud lid, chasing-arrows mark, bilingual label.

   The LID is drawn at exactly br.w, because the lid opening IS the catch mouth.
   The widest drawn element and the catch test have to agree — an earlier version
   caught within binW+itemR while drawing binW, so items that visibly missed
   still counted, and that is the single worst thing this mode can do. The body
   tapers BELOW the lid, which is what the real bins do and costs nothing,
   because items are caught at the mouth.

   Everything here is deliberately bold. The bin moves the full width of the
   screen in a second and is read at a glance; fine detail would be mud. */
function dShade(hex, f){
  var n=parseInt(hex.slice(1),16);
  return "rgb("+Math.round(((n>>16)&255)*f)+","+Math.round(((n>>8)&255)*f)+","+Math.round((n&255)*f)+")";
}
/* Three chasing arrows. A faithful mobius loop is illegible at this size.
   The first attempt drew three thick strokes on a triangle with arrowheads
   partway along each side: the heads overshot into the neighbouring side and
   the strokes merged into a lumpy outline with a stray wedge. So each arrow is
   now ONE filled polygon — strokes cannot merge if there are no strokes — and
   the sides are shortened to leave a visible gap at each corner. */
function dBinArrows(cx, cy, r){
  var d=r*0.40, hw=r*0.115;           /* side offset from centre, and bar half-thickness */
  fxc.save(); fxc.translate(cx, cy);
  fxc.fillStyle="#ffffff";
  for(var i=0;i<3;i++){
    fxc.save(); fxc.rotate(i*Math.PI*2/3);
    var x0=-r*0.56, x1=r*0.10, tip=r*0.60, flare=r*0.30;
    fxc.beginPath();
    fxc.moveTo(x0, -d-hw);            /* bar, top edge */
    fxc.lineTo(x1, -d-hw);
    fxc.lineTo(x1, -d-flare);         /* head flares out */
    fxc.lineTo(tip, -d);              /* tip, pointing round the triangle */
    fxc.lineTo(x1, -d+flare);
    fxc.lineTo(x1, -d+hw);
    fxc.lineTo(x0, -d+hw);            /* bar, bottom edge */
    fxc.closePath(); fxc.fill();
    fxc.restore();
  }
  fxc.restore();
}
function dBinArt(br, q){
  var lidH=18, tap=7, bx=br.x, bw=br.w, by=br.y, bh=br.h;
  var bodyTop=by+lidH-2, bodyMid=bodyTop+(bh-lidH)*0.5;

  /* body */
  fxc.beginPath();
  fxc.moveTo(bx+2, bodyTop); fxc.lineTo(bx+bw-2, bodyTop);
  fxc.lineTo(bx+bw-2-tap, by+bh); fxc.lineTo(bx+2+tap, by+bh);
  fxc.closePath();
  fxc.fillStyle=q.c; fxc.fill();
  fxc.lineWidth=4; fxc.strokeStyle=OL; fxc.stroke();

  /* ONE seam, sitting in the gap between the mark and the label so it reads as
     a panel line and doubles as a divider. Two evenly spaced ribs were tried
     first and the second ran straight through the label text, which read as a
     rendering artifact rather than part of the bin. */
  fxc.strokeStyle=dShade(q.c,0.76); fxc.lineWidth=3;
  fxc.beginPath();
  fxc.moveTo(bx+54, bodyTop+7);
  fxc.lineTo(bx+54+tap*0.45, by+bh-5);
  fxc.stroke();

  /* lid at FULL width — this is the catch mouth */
  fxRR(bx, by, bw, lidH, 6); fxc.fillStyle=dShade(q.c,0.70); fxc.fill();
  fxc.lineWidth=4; fxc.strokeStyle=OL; fxc.stroke();
  /* the opening: inset vertically only, so the full catch WIDTH still reads */
  fxRR(bx+5, by+4, bw-10, lidH-9, 4); fxc.fillStyle="rgba(18,14,9,.55)"; fxc.fill();

  /* mark + bilingual label */
  dBinArrows(bx+28, bodyMid+1, 17);
  var tx=bx+bw*0.5+16;
  cjk(fxc, q.zh||q.n, tx, bodyMid-9, 17, "#ffffff");
  fxc.fillStyle="rgba(255,255,255,.95)";
  fxc.font="700 12px "+FONT;
  fxc.textAlign="center"; fxc.textBaseline="middle";
  fxc.fillText(q.n.toUpperCase(), tx, bodyMid+12);
}

function tsunamiDraw(now){
  if(G.paused) return;
  var br=binRect(), q=QBINS[TS.target];

  dBinArt(br, q);

  /* No guide column up the screen — it was visual noise. The bin itself shows
     its position, and the catch mouth is exactly the bin's drawn width (see
     the landing test), so nothing is hidden by dropping it. */

  /* halo on power-ups only — ordinary items must be judged on what they ARE */
  for(var s=0;s<G.objs.length;s++){ var so=G.objs[s];
    if(!so.special || so.a<0.5) continue;
    var pl=0.5+0.5*Math.sin(now*0.006);
    fxc.save(); fxc.globalAlpha=0.30+0.35*pl;
    fxc.strokeStyle=hx(so.it.col); fxc.lineWidth=5;
    fxc.beginPath(); fxc.arc(so.x, so.y, Math.max(0.1, so.r+10+pl*5), 0, 7); fxc.stroke();
    fxc.restore();
  }

  /* Below the floating HUD. These sat at y=26/56/80, inside the score badge.
     The spent-life colour was #e2e2e2 — near-white on a dark playfield, which
     read as a FULL heart rather than an empty one. */
  var dr0=(typeof hudRow==="function")?hudRow(0):114;
  var dRow=1;
  for(var h=0;h<DCFG.lives;h++) drawHeart(30+h*30, dr0, 12, h<TS.lives?"#e24b4a":"#4a3f33");
  if(TS.mult>1){ fxc.fillStyle="#49d17d"; fxc.font="700 18px "+FONT;
    fxc.textAlign="left"; fxc.textBaseline="middle";
    fxc.fillText("combo x"+TS.mult, 18, (typeof hudRow==="function")?hudRow(dRow):144); dRow++; }
  if(TS.shield){ fxc.fillStyle="#ffc83d"; fxc.font="700 16px "+FONT;
    fxc.textAlign="left"; fxc.textBaseline="middle";
    fxc.fillText("☀ shield ready", 18, (typeof hudRow==="function")?hudRow(dRow):174); }

  /* heads-up before the bin changes what it wants */
  if(TS.switchT<DCFG.warnMs){
    var a=0.55+0.45*Math.sin(now*0.012);
    fxc.save(); fxc.globalAlpha=a;
    fxc.fillStyle=QBINS[TS.nextTarget].c;
    fxc.font="700 22px "+FONT;
    fxc.textAlign="center"; fxc.textBaseline="middle";
    fxc.fillText("next: "+QBINS[TS.nextTarget].n+"  "+Math.ceil(TS.switchT/1000), W/2, 40);
    fxc.restore();
  }
  if(TS.banner>0){
    var b=Math.min(1, TS.banner/500);
    fxc.save(); fxc.globalAlpha=b;
    fxc.fillStyle=q.c; fxc.font="700 34px "+FONT;
    fxc.textAlign="center"; fxc.textBaseline="middle";
    fxc.fillText(q.n, W/2, H*0.2);
    fxc.font="600 15px "+FONT; fxc.fillStyle="#c9bda8";   /* was #5a7c6b: unreadable on the dark playfield */
    fxc.fillText("catch only "+q.n.toLowerCase(), W/2, H*0.2+30);
    fxc.restore();
  }
}

/* ---- artwork for the two Bin It power-ups (220x220, ART conventions) ---- */
ART.dsRepair=function(c){
  c.save(); c.translate(110,110); c.rotate(-0.5);
  rr(c,-13,-20,26,96,6); fillIt(c,"#9aa4b0"); outline(c);          /* handle */
  c.restore();
  c.save(); c.translate(110,110); c.rotate(-0.5);
  c.beginPath(); c.arc(0,-40,32,0.5,Math.PI*2-0.5); fillIt(c,"#30d158"); outline(c);
  c.beginPath(); c.arc(0,-40,14,0,7); fillIt(c,"#eafaf0"); outline(c);
  c.restore();
};
ART.dsSolar=function(c){
  c.beginPath(); c.arc(110,96,34,0,7); fillIt(c,"#f5c518"); outline(c);
  c.strokeStyle=OL; c.lineWidth=6; c.lineCap="round";
  for(var i=0;i<8;i++){ var a=i*Math.PI/4;
    c.beginPath(); c.moveTo(110+Math.cos(a)*44,96+Math.sin(a)*44);
    c.lineTo(110+Math.cos(a)*58,96+Math.sin(a)*58); c.stroke(); }
  c.lineCap="butt";
  rr(c,50,150,120,34,5); fillIt(c,"#2f5f9e"); outline(c);           /* panel */
  c.strokeStyle="#8fc0ee"; c.lineWidth=3;
  for(var j=1;j<4;j++){ c.beginPath(); c.moveTo(50+j*30,150); c.lineTo(50+j*30,184); c.stroke(); }
};

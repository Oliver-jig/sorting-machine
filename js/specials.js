/* ================= SPECIAL ITEMS (Sort mode only) =================
   Fruit-Ninja-style power-ups. A special is shaped exactly like a normal
   ITEMS entry ({n,t,col}) plus an `sp` tag, so makeSprite/getTex/the name
   label all work on it unchanged. Only three places in game.js branch on
   `o.it.sp`: the single-item spawn, updatePhysics, and sliceAlong.

   Sort mode is the only consumer — updatePhysics and sliceAlong are not
   shared with the other modes. */

var SPECIALS=[
  {n:"❄ Freeze",       t:"spFreeze",  col:0x8fd8ff, sp:"freeze",  dur:3000,  w:20},
  {n:"♻ Double",       t:"spDouble",  col:0x30d158, sp:"dbl",     dur:8000,  w:20},
  {n:"🧲 Magnet",      t:"spMagnet",  col:0xe0762b, sp:"magnet",  dur:4000,  w:16},
  {n:"⏱ +5 seconds",   t:"spClock",   col:0xbf8b2e, sp:"clock",   dur:0,     w:16},
  {n:"⚠ Battery",      t:"spBattery", col:0xd70015, sp:"battery", dur:0,     w:28, bad:true},
  {n:"🚛 Truck",       t:"spTruck",   col:0x2f7fd1, sp:"truck",   dur:0,     w:18}
];
var SPBYT={}; SPECIALS.forEach(function(s){ SPBYT[s.t]=s; });

/* ms remaining on each timed effect */
var PWR={freeze:0, dbl:0, magnet:0};

/* Specials run on their OWN timer rather than stealing a normal spawn slot.
   The slot approach tied them to the item spawn rate, so on the relaxed preset
   — slow spawns, near-empty screen — the "needs items on screen" rule blocked
   almost every attempt and specials got RARER instead of more common. */
var SPCFG={
  first:3500,       /* ms before the first special of a round */
  every:6000,       /* ms minimum between specials */
  everyRand:4000,   /* plus up to this much, so they don't feel metronomic */
  minItems:2,       /* other items that must be ON SCREEN before one appears */
  battPts:-40,
  clockMs:5000,
  truckMs:1100,     /* ms for the truck to cross the whole screen */
  /* Magnet tuning (simulated, not guessed). Pull must beat gravity (0.00085)
     or items just keep falling away — 0.00055 was invisible in play. And
     attraction WITHOUT drag conserves energy, so items slingshot past the
     blade and orbit it; magDamp is what makes them settle instead.
     At these values: an item 700px away arrives in ~2.2s, 400px in ~1.2s. */
  magPull:0.0020,   /* px/ms^2 of pull toward the blade */
  magMax:0.7,       /* px/ms cap, so an item never rockets across the screen */
  magDamp:0.94      /* per-frame drag on pulled items; kills orbiting */
};
var SPS={next:0, shakeUntil:0};
/* Collection day: the truck drives across and takes everything recyclable.
   It deliberately leaves contaminants behind — that IS the lesson. */
var TRUCK={on:false, x:0, speed:0};

function specialsReset(){
  PWR.freeze=0; PWR.dbl=0; PWR.magnet=0;
  TRUCK.on=false;
  SPS.next=SPCFG.first;
}
function specialReschedule(){ SPS.next=SPCFG.every+Math.random()*SPCFG.everyRand; }

/* ---- spawning ---- */
function specialPool(){
  return SPECIALS.filter(function(s){
    /* the battery is a trap in a round whose whole rule is "slice the traps",
       so it sits out round 4 rather than contradicting the lesson */
    if(s.sp==="battery" && ROUNDS[G.round] && ROUNDS[G.round].bins.indexOf("trash")>=0) return false;
    return true;
  });
}
function specialPick(){
  var pool=specialPool(), tot=0, i;
  for(i=0;i<pool.length;i++) tot+=pool[i].w;
  var r=Math.random()*tot;
  for(i=0;i<pool.length;i++){ r-=pool[i].w; if(r<=0) return pool[i]; }
  return pool[pool.length-1];
}
/* Ordinary items currently VISIBLE. Items spawn below the screen at y=H+55 and
   rise into view, so anything still under the bottom edge doesn't count. */
function liveItemCount(){
  var n=0;
  for(var i=0;i<G.objs.length;i++){ var o=G.objs[i];
    if(o.sliced || o.it.sp) continue;
    if(o.y>H-20) continue;
    n++;
  }
  return n;
}

/* Driven by specialUpdate's timer. When the timer is up but the screen is too
   empty, the timer is NOT reset — so the special appears the moment enough
   items are in play, rather than being skipped for another full interval. */
function maybeSpawnSpecial(){
  if(PWR.freeze>0) return false;                       /* nothing new arrives mid-freeze */
  if(G.objs.length>=14) return false;
  /* A power-up on an empty screen is wasted — freezing nothing, doubling
     nothing. Only offer one when there is something to use it on. */
  if(liveItemCount()<SPCFG.minItems) return false;
  var s=specialPick(); if(!s) return false;
  specialReschedule();
  var x=90+Math.random()*Math.max(1,W-180);
  var vy=-(Math.sqrt(2*DIFF.g*Math.min(H,DIFF.h)))-Math.random()*0.06;
  var mesh=makeSprite(s); scene.add(mesh);
  G.objs.push({it:s,x:x,y:H+55,vx:(W/2-x)/2200,vy:vy,r:50,sliced:false,a:1,scale:1,
    spin:0, dspin:0.012, phase:Math.random()*6, mesh:mesh});
  return true;
}

/* ---- effects ---- */
function specialSlice(o){
  var s=o.it, col=hx(s.col);
  o.sliced=true; o.vy-=0.1; o.dspin=0.3;
  spawnBurst(o.x,o.y,col);
  if(s.sp==="freeze"){ PWR.freeze=s.dur; G.pops.push({x:o.x,y:o.y,txt:"FREEZE!",col:"#3aa8e0",a:1,big:true}); }
  else if(s.sp==="dbl"){ PWR.dbl=s.dur; G.pops.push({x:o.x,y:o.y,txt:"DOUBLE!",col:"#1f9d55",a:1,big:true}); }
  else if(s.sp==="magnet"){ PWR.magnet=s.dur; G.pops.push({x:o.x,y:o.y,txt:"MAGNET!",col:"#e0762b",a:1,big:true}); }
  else if(s.sp==="clock"){ G.roundEndAt+=SPCFG.clockMs; G.pops.push({x:o.x,y:o.y,txt:"+5s",col:"#bf8b2e",a:1,big:true}); }
  else if(s.sp==="truck"){ TRUCK.on=true; TRUCK.x=-160; TRUCK.speed=(W+320)/SPCFG.truckMs;
    G.pops.push({x:o.x,y:o.y,txt:"COLLECTION DAY!",col:"#2f7fd1",a:1,big:true}); }
  else if(s.sp==="battery"){
    G.score=Math.max(-999,G.score+SPCFG.battPts); el("scoreN").textContent=G.score;
    G.pops.push({x:o.x,y:o.y,txt:SPCFG.battPts+"",col:"#d70015",a:1,big:true});
    G.flashes.push({x:o.x,y:o.y,r:10,life:1});
    specialShake();
  }
}
function specialShake(){
  SPS.shakeUntil=performance.now()+320;
  if(stage){ stage.classList.remove("shake"); void stage.offsetWidth; stage.classList.add("shake");
    setTimeout(function(){ stage.classList.remove("shake"); }, 340); }
}
/* magnet: nudge round-correct items toward the blade. Applied as acceleration,
   not teleportation, so items curve in rather than snapping. */
function specialPull(o,dt){
  if(PWR.magnet<=0 || o.sliced || !BLADE.active) return;
  if(o.it.sp) return;                                  /* specials are not magnetic */
  var R=ROUNDS[G.round]; if(!R || R.bins.indexOf(o.it.bin)<0) return;
  var dx=BLADE.x-o.x, dy=BLADE.y-o.y, d=Math.hypot(dx,dy)||1;
  o.vx+=(dx/d)*SPCFG.magPull*dt; o.vy+=(dy/d)*SPCFG.magPull*dt;
  o.vx*=SPCFG.magDamp; o.vy*=SPCFG.magDamp;
  if(Math.abs(o.vx)>SPCFG.magMax) o.vx=(o.vx>0?1:-1)*SPCFG.magMax;
  if(Math.abs(o.vy)>SPCFG.magMax) o.vy=(o.vy>0?1:-1)*SPCFG.magMax;
}
/* Scores one item exactly as a correct manual slice would, so the truck and the
   blade stay worth the same (and Double still applies). */
function truckCollect(o){
  var R=ROUNDS[G.round];
  if(!R || R.bins.indexOf(o.it.bin)<0) return;   /* the truck refuses contaminants */
  o.sliced=true; o.vy-=0.06; o.dspin=0.2;
  var pts=15*specialMult();
  G.score=Math.max(-999,G.score+pts); el("scoreN").textContent=G.score;
  spawnBurst(o.x,o.y, BINCOL[o.it.bin]||"#2fae6a");
  G.pops.push({x:o.x,y:o.y,txt:"+"+pts,col:"#1f9d55",a:1});
}
function truckUpdate(dt){
  if(!TRUCK.on) return;
  TRUCK.x+=TRUCK.speed*dt;
  for(var i=0;i<G.objs.length;i++){ var o=G.objs[i];
    if(o.sliced || o.it.sp) continue;
    if(o.x<=TRUCK.x) truckCollect(o);            /* sliced flag stops any re-collect */
  }
  if(TRUCK.x>W+200) TRUCK.on=false;
}
function truckDraw(){
  if(!TRUCK.on) return;
  var x=TRUCK.x, y=H*0.60, w=150, h=74;
  fxc.save();
  fxc.globalAlpha=0.28; fxc.fillStyle="#2f7fd1";
  fxc.fillRect(Math.max(0,x-w), y-6, Math.max(0,Math.min(x,W)-Math.max(0,x-w)), h+12);  /* wake */
  fxc.globalAlpha=1;
  fxc.translate(x,y);
  fxc.fillStyle="#2f7fd1"; fxc.strokeStyle="#1d1d1f"; fxc.lineWidth=4;
  fxRR(-w/2,-h/2,w*0.62,h,8); fxc.fill(); fxc.stroke();                 /* container */
  fxRR(-w/2+w*0.62,-h/2+16,w*0.36,h-16,8); fxc.fillStyle="#5aa9e6"; fxc.fill(); fxc.stroke();  /* cab */
  fxc.fillStyle="#cfe6ff"; fxRR(-w/2+w*0.68,-h/2+22,w*0.2,22,4); fxc.fill(); fxc.stroke();     /* window */
  fxc.fillStyle="#1d1d1f";
  fxc.beginPath(); fxc.arc(-w*0.22,h/2,13,0,7); fxc.fill();
  fxc.beginPath(); fxc.arc(w*0.28,h/2,13,0,7); fxc.fill();
  fxc.fillStyle="#ffffff"; fxc.font="700 22px "+FONT;
  fxc.textAlign="center"; fxc.textBaseline="middle"; fxc.fillText("♻", -w*0.2, 0);
  fxc.restore();
}

function specialUpdate(dt){
  truckUpdate(dt);
  if(PWR.freeze>0) PWR.freeze-=dt;
  if(PWR.dbl>0) PWR.dbl-=dt;
  if(PWR.magnet>0) PWR.magnet-=dt;
  if(PWR.freeze<=0){                      /* the schedule holds while frozen */
    SPS.next-=dt;
    if(SPS.next<=0) maybeSpawnSpecial();
  }
}
function specialMult(){ return PWR.dbl>0 ? 2 : 1; }

/* ---- drawing ---- */
/* A halo on the fx overlay is what makes a special read as special at a
   glance; the battery gets its own alarming treatment so it is never
   mistaken for ordinary rubbish. */
function specialDraw(now){
  var i,o;
  for(i=0;i<G.objs.length;i++){ o=G.objs[i];
    if(!o.it.sp || o.sliced || o.a<0.5) continue;
    var bad=!!o.it.bad, t=now*0.006, pulse=0.5+0.5*Math.sin(t);
    fxc.save();
    fxc.globalAlpha=0.30+0.35*pulse;
    fxc.strokeStyle=bad?"#d70015":"#ffd66b";
    fxc.lineWidth=bad?7:5;
    fxc.beginPath(); fxc.arc(o.x,o.y,Math.max(0.1,o.r+10+pulse*5),0,7); fxc.stroke();
    if(bad){ fxc.globalAlpha=0.22+0.2*pulse; fxc.lineWidth=14;
      fxc.beginPath(); fxc.arc(o.x,o.y,Math.max(0.1,o.r+22),0,7); fxc.stroke(); }
    fxc.restore();
  }
  truckDraw();
  specialDrawChips();
}
function specialDrawChips(){
  var chips=[];
  if(PWR.freeze>0) chips.push({txt:"FREEZE "+(PWR.freeze/1000).toFixed(1)+"s", col:"#3aa8e0"});
  if(PWR.dbl>0)    chips.push({txt:"×2 "+(PWR.dbl/1000).toFixed(1)+"s",    col:"#1f9d55"});
  if(PWR.magnet>0) chips.push({txt:"MAGNET "+(PWR.magnet/1000).toFixed(1)+"s",  col:"#e0762b"});
  if(!chips.length) return;
  fxc.save();
  fxc.font="700 14px "+FONT;
  fxc.textAlign="left"; fxc.textBaseline="middle";
  /* Below the HUD, not in it. These used to start at y=26, which is inside the
     score badge (top 18, 74px tall) — the active-power chips sat on top of the
     score. HUDSAFE is the first y clear of the whole floating HUD.

     Dark chips, too: the old ones were a white pill with a coloured border, from
     the light theme. On the dark playfield that was a bright slab in the corner. */
  var X=18;
  for(var i=0;i<chips.length;i++){
    var c=chips[i], w=fxc.measureText(c.txt).width+24, y=(typeof HUDSAFE!=="undefined"?HUDSAFE:100)+14+i*32;
    fxc.globalAlpha=0.92; fxc.fillStyle="#160f0a";
    fxRR(X,y-13,w,26,13); fxc.fill();
    fxc.globalAlpha=1; fxc.strokeStyle=c.col; fxc.lineWidth=2;
    fxRR(X,y-13,w,26,13); fxc.stroke();
    fxc.fillStyle=c.col; fxc.fillText(c.txt,X+12,y);
  }
  fxc.restore();
}

/* ---- artwork (220x220, same conventions as ART in game.js) ---- */
ART.spFreeze=function(c){
  c.strokeStyle="#3aa8e0"; c.lineWidth=13; c.lineCap="round";
  for(var i=0;i<3;i++){ var a=i*Math.PI/3;
    c.beginPath(); c.moveTo(110-Math.cos(a)*66,110-Math.sin(a)*66); c.lineTo(110+Math.cos(a)*66,110+Math.sin(a)*66); c.stroke(); }
  c.strokeStyle="#bfe9ff"; c.lineWidth=6;
  for(var j=0;j<3;j++){ var b=j*Math.PI/3;
    c.beginPath(); c.moveTo(110-Math.cos(b)*66,110-Math.sin(b)*66); c.lineTo(110+Math.cos(b)*66,110+Math.sin(b)*66); c.stroke(); }
  c.beginPath(); c.arc(110,110,17,0,7); fillIt(c,"#eaf9ff"); outline(c); c.lineCap="butt";
};
ART.spDouble=function(c){
  c.beginPath(); c.arc(110,110,72,0,7); fillIt(c,"#eafaf0"); outline(c);
  c.fillStyle="#20a45a";
  for(var i=0;i<3;i++){ c.save(); c.translate(110,110); c.rotate(i*2*Math.PI/3);
    c.beginPath(); c.moveTo(-24,-14); c.lineTo(24,-14); c.lineTo(6,20); c.closePath(); c.fill(); c.restore(); }
  c.fillStyle="#173a2a"; c.font="700 34px "+FONT;
  c.textAlign="center"; c.textBaseline="middle"; c.fillText("x2",110,176);
};
ART.spMagnet=function(c){
  c.strokeStyle="#d1452f"; c.lineWidth=30; c.lineCap="butt";
  c.beginPath(); c.arc(110,120,52,Math.PI,0); c.stroke();
  c.strokeStyle=OL; c.lineWidth=OLW;
  c.beginPath(); c.arc(110,120,52,Math.PI,0); c.stroke();
  c.beginPath(); c.arc(110,120,22,Math.PI,0); c.stroke();
  rr(c,43,120,34,40,4); fillIt(c,"#cfd6dd"); outline(c);
  rr(c,143,120,34,40,4); fillIt(c,"#cfd6dd"); outline(c);
};
ART.spClock=function(c){
  c.beginPath(); c.arc(110,116,68,0,7); fillIt(c,"#fff6e0"); outline(c);
  rr(c,96,34,28,16,5); fillIt(c,"#bf8b2e"); outline(c);
  c.strokeStyle=OL; c.lineWidth=7; c.lineCap="round";
  c.beginPath(); c.moveTo(110,116); c.lineTo(110,76); c.stroke();
  c.beginPath(); c.moveTo(110,116); c.lineTo(142,128); c.stroke();
  c.lineCap="butt";
  c.fillStyle="#bf8b2e"; c.font="700 26px "+FONT;
  c.textAlign="center"; c.textBaseline="middle"; c.fillText("+5s",110,170);
};
ART.spTruck=function(c){
  rr(c,32,84,104,70,8); fillIt(c,"#2f7fd1"); outline(c);              /* container */
  rr(c,132,102,54,52,8); fillIt(c,"#5aa9e6"); outline(c);             /* cab */
  rr(c,142,110,34,22,4); fillIt(c,"#d9ecff"); outline(c);             /* window */
  c.fillStyle="#1d1d1f";
  c.beginPath(); c.arc(66,158,17,0,7); c.fill();
  c.beginPath(); c.arc(150,158,17,0,7); c.fill();
  c.fillStyle="#ffffff"; c.font="700 34px "+FONT;
  c.textAlign="center"; c.textBaseline="middle"; c.fillText("♻",84,119);
};
ART.spBattery=function(c){
  rr(c,66,42,88,140,10); fillIt(c,"#2d2d2d"); outline(c);
  rr(c,92,26,36,18,5); fillIt(c,"#cfd6dd"); outline(c);
  /* hazard stripes */
  c.save(); rr(c,66,42,88,140,10); c.clip();
  c.fillStyle="#f5c518";
  for(var i=-4;i<8;i++){ c.save(); c.translate(66+i*26,42); c.rotate(-0.5);
    c.fillRect(0,-20,13,190); c.restore(); }
  c.restore();
  rr(c,66,42,88,140,10); outline(c);
  c.fillStyle="#d70015"; c.font="700 46px "+FONT;
  c.textAlign="center"; c.textBaseline="middle"; c.fillText("⚠",110,116);
};

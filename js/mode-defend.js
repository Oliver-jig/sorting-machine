/* ================= BIN IT RIGHT =================
   Every falling item has one correct bin. Slicing does NOT destroy anything —
   it nudges the item sideways, so the blade is how you steer things home.
   Landing in the right bin scores; the wrong bin costs a life.

   Depends on game.js for: G, GMODE, W, H, fxc, el, show, resize, scene,
   makeSprite, toWorld, segHit, fxRR, drawHeart, spawnBurst, clearObjs,
   ITEMS, QBINS, controlMode, setupCam, setupMouse, FACTS. */

var DBINS=["paper","plastic","metal","glass","trash"];
var DCFG={lives:3, cap:8, grav:0.00014, vyCap:0.15, nudge:0.0035, vxCap:0.34, kick:0.06,
          vxDrag:0.0012, hitCool:130, waveMs:30000, comboEvery:4, comboCap:4, base:10};
var WAVES=[{n:"Warm-up",bias:null},{n:"Paper run",bias:"paper"},{n:"Plastic tide",bias:"plastic"},
           {n:"Glass rush",bias:"glass"},{n:"Mixed load",bias:null},{n:"Metal sweep",bias:"metal"}];

var TS={running:false, lives:3, score:0, spawnT:0, elapsed:0, streak:0, mult:1,
        waveT:0, waveIdx:0, banner:0, right:0, wrong:0, shield:false, spNext:0};

/* Bin It power-ups. These two live HERE rather than in Sort because they need
   lives and a combo to act on, and Sort has neither.
   Unlike ordinary items a special is CONSUMED by a slice instead of nudged,
   and if you miss it, it just leaves — no bin, no penalty. */
var DSPEC=[
  {n:"🔧 Repair kit",  t:"dsRepair", col:0x30d158, sp:"repair"},
  {n:"☀ Solar surge", t:"dsSolar",  col:0xf5c518, sp:"solar"}
];
var DSCFG={first:7000, every:11000, everyRand:6000, minItems:2};

/* Bins tile the full width, so every item lands in exactly one bin and nothing
   can slip through a gap or off the side. */
function binRects(){
  var n=DBINS.length, m=16, gap=8, bw=(W-2*m-(n-1)*gap)/n, out=[];
  for(var i=0;i<n;i++) out.push({bin:DBINS[i], x:m+i*(bw+gap), w:bw});
  return out;
}
function binLineY(){ return H-62; }
function binAt(x){
  var r=binRects();
  for(var i=0;i<r.length;i++){ if(x>=r[i].x-4 && x<=r[i].x+r[i].w+4) return r[i].bin; }
  return x<W/2 ? r[0].bin : r[r.length-1].bin;      /* clamp to the nearest end bin */
}

/* Bin It used to drop you straight in with no explanation — Sort shows its
   rules before every round, this showed nothing, so the steering mechanic was
   invisible and the mode looked broken. */
function tsunamiIntro(){
  el("ovlT").textContent="Bin It Right";
  el("ovlD").innerHTML="Every item has <b>one correct bin</b>.<br>"+
    "A slice does <b>not</b> destroy it — <b>slash sideways to steer it</b> left or right, "+
    "or hit it off-centre to bat it across.<br>"+
    "Land it in the matching bin to score. Wrong bin costs a life.";
  el("ovlBtn").textContent="Start sorting";
  el("ovl").classList.remove("hidden");
}
function tsunamiBegin(){
  el("ovl").classList.add("hidden");
  TS.running=true;
}

function launchTsunami(){
  GMODE="tsunami"; TS.running=false; TS.lives=DCFG.lives; TS.score=0; TS.spawnT=500;
  TS.elapsed=0; TS.streak=0; TS.mult=1; TS.waveT=DCFG.waveMs; TS.waveIdx=0;
  TS.banner=2200; TS.right=0; TS.wrong=0; TS.shield=false; TS.spNext=DSCFG.first;
  G.pops=[]; G.parts=[]; G.flashes=[]; BLADE.trail=[]; clearObjs();
  el("scoreN").textContent="0"; el("topicName").textContent=WAVES[0].n; el("topicDot").style.background="#2f7fd1";
  el("roundN").textContent=TS.lives; el("timeFill").style.width="100%";
  el("quizQ").classList.add("hidden"); el("pauseBtn").style.display="";
  show("play"); resize(); el("pauseOvl").classList.add("hidden");
  if(controlMode==="cam") setupCam(); else if(controlMode==="mouse") setupMouse();
  tsunamiIntro();                       /* wait for the player to read the rules */
}

function tsunamiSpawn(){
  if(G.objs.length>=DCFG.cap) return;
  var bias=WAVES[TS.waveIdx%WAVES.length].bias, pool=ITEMS;
  if(bias && Math.random()<0.6){ var p=ITEMS.filter(function(it){ return it.bin===bias; }); if(p.length) pool=p; }
  var it=pool[Math.floor(Math.random()*pool.length)];
  var mesh=makeSprite(it); scene.add(mesh);
  G.objs.push({it:it, x:70+Math.random()*(W-140), y:-40, vx:(Math.random()-0.5)*0.02,
    vy:0.012+Math.random()*0.01, r:50, sliced:false, a:1, scale:1,
    spin:(Math.random()-.5)*2, dspin:(Math.random()-.5)*0.04, phase:Math.random()*6, cool:0, mesh:mesh});
}

/* Ordinary items currently in play — a power-up is pointless with an empty
   screen, and the repair kit is pointless on full lives. */
function dspecLive(){
  var n=0;
  for(var i=0;i<G.objs.length;i++){ var o=G.objs[i];
    if(o.it.sp) continue;
    if(o.y>0 && o.y<binLineY()-40) n++;
  }
  return n;
}
function dspecTry(){
  if(G.objs.length>=DCFG.cap) return;
  if(dspecLive()<DSCFG.minItems) return;            /* timer not reset — retry next frame */
  var pool=DSPEC.filter(function(s){ return s.sp!=="repair" || TS.lives<DCFG.lives; });
  if(!pool.length) return;                          /* on full lives only solar can drop */
  var s=pool[Math.floor(Math.random()*pool.length)];
  TS.spNext=DSCFG.every+Math.random()*DSCFG.everyRand;
  var mesh=makeSprite(s); scene.add(mesh);
  G.objs.push({it:s, x:80+Math.random()*Math.max(1,W-160), y:-40, vx:0, vy:0.013, r:50,
    sliced:false, a:1, scale:1, spin:0, dspin:0.012, phase:0, cool:0, mesh:mesh});
}
function dspecTake(o){
  if(o.it.sp==="repair"){
    TS.lives=Math.min(DCFG.lives, TS.lives+1);
    el("roundN").textContent=TS.lives;
    G.pops.push({x:o.x, y:o.y, txt:"REPAIRED  +1 life", col:"#20a45a", a:1, big:true});
  } else {
    TS.shield=true;
    G.pops.push({x:o.x, y:o.y, txt:"COMBO SHIELD", col:"#bf8b2e", a:1, big:true});
  }
  spawnBurst(o.x, o.y, hx(o.it.col));
}

function tsunamiLand(o){
  if(o.it.sp) return;                               /* a missed power-up just leaves */
  var got=binAt(o.x), ok=(got===o.it.bin);
  if(ok){
    TS.right++; TS.streak++; TS.mult=Math.min(DCFG.comboCap, 1+Math.floor(TS.streak/DCFG.comboEvery));
    var gain=DCFG.base*TS.mult; TS.score+=gain; el("scoreN").textContent=TS.score;
    spawnBurst(o.x, binLineY(), "#20a45a");
    G.pops.push({x:o.x, y:binLineY()-28, txt:"+"+gain+(TS.mult>1?"  x"+TS.mult:""), col:"#20a45a", a:1, big:true});
  } else {
    TS.wrong++; TS.lives--;
    /* Solar surge protects the COMBO only — the mis-sort still costs a life,
       or the shield would simply cancel the mistake. */
    if(TS.shield){ TS.shield=false;
      G.pops.push({x:o.x, y:binLineY()-56, txt:"combo saved!", col:"#bf8b2e", a:1}); }
    else { TS.streak=0; TS.mult=1; }
    el("roundN").textContent=Math.max(0,TS.lives);
    spawnBurst(o.x, binLineY(), "#d70015");
    G.pops.push({x:o.x, y:binLineY()-28, txt:"→ "+QBINS[o.it.bin].n+"!", col:"#d70015", a:1, big:true});
    if(TS.lives<=0){ tsunamiGameOver(); }
  }
}

function tsunamiUpdate(dt, now){
  var ramp=1+Math.min(0.9, TS.elapsed/120000);
  if(TS.banner>0) TS.banner-=dt;
  TS.waveT-=dt;
  if(TS.waveT<=0){ TS.waveIdx++; TS.waveT=DCFG.waveMs; TS.banner=2200;
    var wv=WAVES[TS.waveIdx%WAVES.length];
    el("topicName").textContent=wv.n;
    el("topicDot").style.background=wv.bias?QBINS[wv.bias].c:"#2f7fd1"; }
  el("timeFill").style.width=(Math.max(0,TS.waveT)/DCFG.waveMs*100)+"%";

  TS.spawnT-=dt;
  if(TS.spawnT<=0){ tsunamiSpawn(); TS.spawnT=Math.max(620, 1500-TS.elapsed/120)+Math.random()*420; }
  TS.spNext-=dt;
  if(TS.spNext<=0) dspecTry();

  var line=binLineY(), vcap=DCFG.vyCap*ramp;   /* cap has to ramp too, or the ramp does nothing */
  for(var i=G.objs.length-1;i>=0;i--){ var o=G.objs[i];
    if(o.cool>0) o.cool-=dt;
    o.vy+=DCFG.grav*ramp*dt; if(o.vy>vcap) o.vy=vcap;
    o.vx-=o.vx*DCFG.vxDrag*dt;                                   /* sideways drift bleeds off */
    o.y+=o.vy*dt; o.x+=o.vx*dt; o.spin+=o.dspin;
    if(o.x<40){ o.x=40; o.vx=Math.abs(o.vx)*0.4; }               /* bounce off the walls */
    if(o.x>W-40){ o.x=W-40; o.vx=-Math.abs(o.vx)*0.4; }
    var w=toWorld(o.x,o.y); o.mesh.position.set(w.x,w.y,0);
    o.mesh.rotation.set(0.25*Math.sin(now*0.002+o.phase),0,o.spin);
    o.mesh.scale.setScalar(o.scale); o.mesh.material.opacity=o.a;
    if(o.y>=line){ tsunamiLand(o); scene.remove(o.mesh); G.objs.splice(i,1); continue; }
  }
  TS.elapsed+=dt;
}

/* A slice pushes the item along the blade's direction instead of destroying it.
   The per-object cooldown stops one slow drag from applying thrust every frame. */
function tsunamiSlice(x1,y1,x2,y2){
  var bdx=x2-x1, bdy=y2-y1;
  if(Math.abs(bdx)<0.5 && Math.abs(bdy)<0.5) return;
  for(var i=G.objs.length-1;i>=0;i--){ var o=G.objs[i];   /* backwards: power-ups are spliced out */
    if(o.cool>0) continue;
    if(segHit(o,x1,y1,x2,y2)){
      if(o.it.sp){ dspecTake(o); scene.remove(o.mesh); G.objs.splice(i,1); continue; }
      /* Two ways to push. The blade's sideways travel is the main one, but a
         straight-down chop has no sideways travel at all and used to do
         nothing — which reads as the game being broken. So hitting an item
         off-centre also bats it away from the blade, like a bat on a ball. */
      var off=o.x-x2, side=Math.max(-1, Math.min(1, off/(o.r||50)));
      o.vx+=bdx*DCFG.nudge + side*DCFG.kick;
      if(o.vx>DCFG.vxCap) o.vx=DCFG.vxCap;
      if(o.vx<-DCFG.vxCap) o.vx=-DCFG.vxCap;
      if(o.vy>0.05) o.vy*=0.72;                                  /* a hit also buys you a little time */
      o.cool=DCFG.hitCool;
      o.dspin=(bdx>0?1:-1)*0.16;
      spawnBurst(o.x,o.y,"#ffffff");
    }
  }
}

function tsunamiGameOver(){
  TS.running=false;
  el("rScore").textContent=TS.score;
  el("rGrade").textContent="You sorted "+TS.right+" item"+(TS.right===1?"":"s")+" correctly and mis-sorted "+TS.wrong+".";
  var f=el("rFacts"); f.innerHTML="";
  FACTS.forEach(function(x){ var d=document.createElement("div"); d.className="fact"; d.textContent=x; f.appendChild(d); });
  scoresRecord("tsunami", TS.score);
  stopCam();
  show("result");
}

function tsunamiDraw(now){
  if(G.paused) return;
  var r=binRects(), by=binLineY(), bh=52;
  /* highlight whichever bins currently have something falling towards them */
  var hot={};
  for(var i=0;i<G.objs.length;i++){ var o=G.objs[i]; if(o.y>H*0.45) hot[binAt(o.x)]=true; }
  for(var b=0;b<r.length;b++){ var q=QBINS[r[b].bin];
    fxRR(r[b].x, by, r[b].w, bh, 10); fxc.globalAlpha=hot[r[b].bin]?1:0.86; fxc.fillStyle=q.c; fxc.fill(); fxc.globalAlpha=1;
    if(hot[r[b].bin]){ fxc.lineWidth=3; fxc.strokeStyle="rgba(255,255,255,.95)"; fxc.stroke(); }
    fxc.fillStyle="#ffffff"; fxc.font="700 14px 'Fredoka',system-ui,sans-serif";
    fxc.textAlign="center"; fxc.textBaseline="middle";
    fxc.fillText(q.n, r[b].x+r[b].w/2, by+bh/2);
  }
  /* halo so a power-up never reads as just another falling item */
  for(var s=0;s<G.objs.length;s++){ var so=G.objs[s];
    if(!so.it.sp || so.a<0.5) continue;
    var pl=0.5+0.5*Math.sin(now*0.006);
    fxc.save(); fxc.globalAlpha=0.30+0.35*pl;
    fxc.strokeStyle=hx(so.it.col); fxc.lineWidth=5;
    fxc.beginPath(); fxc.arc(so.x, so.y, Math.max(0.1, so.r+10+pl*5), 0, 7); fxc.stroke();
    fxc.restore();
  }
  for(var h=0;h<DCFG.lives;h++){ drawHeart(28+h*30, 26, 12, h<TS.lives?"#e24b4a":"#e2e2e2"); }
  if(TS.mult>1){ fxc.fillStyle="#20a45a"; fxc.font="700 18px 'Fredoka',system-ui,sans-serif";
    fxc.textAlign="left"; fxc.textBaseline="middle"; fxc.fillText("combo x"+TS.mult, 28, 56); }
  if(TS.shield){ fxc.fillStyle="#bf8b2e"; fxc.font="700 16px 'Fredoka',system-ui,sans-serif";
    fxc.textAlign="left"; fxc.textBaseline="middle"; fxc.fillText("☀ shield ready", 28, TS.mult>1?80:56); }
  if(TS.banner>0){
    var wv=WAVES[TS.waveIdx%WAVES.length], a=Math.min(1, TS.banner/500);
    fxc.save(); fxc.globalAlpha=a;
    fxc.fillStyle="#173a2a"; fxc.font="700 30px 'Fredoka',system-ui,sans-serif";
    fxc.textAlign="center"; fxc.textBaseline="middle";
    fxc.fillText(wv.n, W/2, H*0.22);
    fxc.font="600 15px 'Fredoka',system-ui,sans-serif"; fxc.fillStyle="#5a7c6b";
    fxc.fillText("slice to steer each item into its bin", W/2, H*0.22+30);
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

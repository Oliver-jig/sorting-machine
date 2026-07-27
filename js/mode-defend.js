/* ================= BIN IT RIGHT =================
   Every falling item has one correct bin. Slicing does NOT destroy anything —
   it nudges the item sideways, so the blade is how you steer things home.
   Landing in the right bin scores; the wrong bin costs a life.

   Depends on game.js for: G, GMODE, W, H, fxc, el, show, resize, scene,
   makeSprite, toWorld, segHit, fxRR, drawHeart, spawnBurst, clearObjs,
   ITEMS, QBINS, controlMode, setupCam, setupMouse, FACTS. */

var DBINS=["paper","plastic","metal","glass","trash"];
var DCFG={lives:3, cap:8, grav:0.00014, vyCap:0.15, nudge:0.0035, vxCap:0.34,
          vxDrag:0.0012, hitCool:130, waveMs:30000, comboEvery:4, comboCap:4, base:10};
var WAVES=[{n:"Warm-up",bias:null},{n:"Paper run",bias:"paper"},{n:"Plastic tide",bias:"plastic"},
           {n:"Glass rush",bias:"glass"},{n:"Mixed load",bias:null},{n:"Metal sweep",bias:"metal"}];

var TS={running:false, lives:3, score:0, spawnT:0, elapsed:0, streak:0, mult:1,
        waveT:0, waveIdx:0, banner:0, right:0, wrong:0};

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

function launchTsunami(){
  GMODE="tsunami"; TS.running=true; TS.lives=DCFG.lives; TS.score=0; TS.spawnT=500;
  TS.elapsed=0; TS.streak=0; TS.mult=1; TS.waveT=DCFG.waveMs; TS.waveIdx=0;
  TS.banner=2200; TS.right=0; TS.wrong=0;
  G.pops=[]; G.parts=[]; G.flashes=[]; BLADE.trail=[]; clearObjs();
  el("scoreN").textContent="0"; el("topicName").textContent=WAVES[0].n; el("topicDot").style.background="#2f7fd1";
  el("roundN").textContent=TS.lives; el("timeFill").style.width="100%";
  el("quizQ").classList.add("hidden"); el("pauseBtn").style.display="";
  show("play"); resize(); el("ovl").classList.add("hidden"); el("pauseOvl").classList.add("hidden");
  if(controlMode==="cam") setupCam(); else if(controlMode==="mouse") setupMouse();
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

function tsunamiLand(o){
  var got=binAt(o.x), ok=(got===o.it.bin);
  if(ok){
    TS.right++; TS.streak++; TS.mult=Math.min(DCFG.comboCap, 1+Math.floor(TS.streak/DCFG.comboEvery));
    var gain=DCFG.base*TS.mult; TS.score+=gain; el("scoreN").textContent=TS.score;
    spawnBurst(o.x, binLineY(), "#20a45a");
    G.pops.push({x:o.x, y:binLineY()-28, txt:"+"+gain+(TS.mult>1?"  x"+TS.mult:""), col:"#20a45a", a:1, big:true});
  } else {
    TS.wrong++; TS.streak=0; TS.mult=1; TS.lives--;
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
  for(var i=0;i<G.objs.length;i++){ var o=G.objs[i];
    if(o.cool>0) continue;
    if(segHit(o,x1,y1,x2,y2)){
      o.vx+=bdx*DCFG.nudge;
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
  for(var h=0;h<DCFG.lives;h++){ drawHeart(28+h*30, 26, 12, h<TS.lives?"#e24b4a":"#e2e2e2"); }
  if(TS.mult>1){ fxc.fillStyle="#20a45a"; fxc.font="700 18px 'Fredoka',system-ui,sans-serif";
    fxc.textAlign="left"; fxc.textBaseline="middle"; fxc.fillText("combo x"+TS.mult, 28, 56); }
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

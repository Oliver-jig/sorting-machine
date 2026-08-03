/* Runs the REAL Bin It spawner from js/mode-defend.js (not a copy of it) and
   checks that an optimal player is never forced into a strike. */
const fs=require('fs'), vm=require('vm');
const R=require('path').join(__dirname,'..')+'/';

function makeCtx(W,H){
  const ctx={ console, Math, JSON, W, H,
    G:{objs:[],pops:[],parts:[],flashes:[],paused:false},
    BLADE:{x:W/2,y:0,px:0,py:0,active:true,trail:[]},
    scene:{add(){},remove(){}},
    makeSprite:()=>({position:{set(){}},rotation:{set(){}},scale:{setScalar(){}},material:{}}),
    toWorld:(x,y)=>({x,y}),
    el:()=>({textContent:"",innerHTML:"",style:{},classList:{add(){},remove(){}}}),
    show(){}, resize(){}, clearObjs(){ ctx.G.objs=[]; },
    spawnBurst(){}, releaseObj(o){ ctx.scene.remove(o.mesh); }, drawHeart(){}, fxRR(){}, stopCam(){}, scoresRecord(){},
    setupCam(){}, setupMouse(){}, hx:n=>"#"+n.toString(16), setRoundLbl(){}, setTopic(){},
    fxc:new Proxy({},{get:()=>()=>{},set:()=>true}),
    rr(){}, fillIt(){}, outline(){}, cjk(){}, OL:"#000", OLW:5, ART:{},
    controlMode:"mouse", GMODE:"tsunami", FACTS:[],
    QBINS:{paper:{n:"Paper",c:"#1"},plastic:{n:"Plastic",c:"#2"},metal:{n:"Metal",c:"#3"},
           glass:{n:"Glass",c:"#4"},trash:{n:"General",c:"#5"}} };
  vm.createContext(ctx);
  // real roster
  const items=fs.readFileSync(R+'js/items.js','utf8').replace(/var ART=\{[\s\S]*\n\};/,'');
  vm.runInContext(items, ctx);
  vm.runInContext('var ITEMBYT={}; ITEMS.forEach(function(it){ITEMBYT[it.t]=it;});', ctx);
  // real mode
  vm.runInContext(fs.readFileSync(R+'js/mode-defend.js','utf8'), ctx);
  return ctx;
}

function collect(W,H,seconds,seed){
  const ctx=makeCtx(W,H);
  let s=seed>>>0; ctx.Math.random=()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; };
  ctx.launchTsunami(); ctx.tsunamiBegin();
  const seen=[]; const dt=16.7;
  const origPush=ctx.G.objs;
  let t=0;
  while(t<seconds*1000){
    const before=ctx.G.objs.length;
    ctx.tsunamiUpdate(dt, t);
    // record anything newly spawned
    for(let i=before;i<ctx.G.objs.length;i++){
      const o=ctx.G.objs[i];
      seen.push({x:o.x, land:o.land, correct:!!o.correct, special:!!o.special, target:ctx.TS.target});
    }
    // keep the player alive so the run continues
    if(ctx.TS.lives<3) ctx.TS.lives=3;
    if(!ctx.TS.running){ ctx.TS.running=true; }
    t+=dt;
  }
  return {seen, ctx};
}

const W=1280,H=682;
const VMAX=W/1000;                 // px per ms, the value the spawner calibrates to
const BINW=150, ITEMR=45;
let forcedTotal=0, correctTotal=0, runs=0, minGapSeen=1e9;
const travel=[];

for(let seed=1;seed<=40;seed++){
  const {seen}=collect(W,H,90,seed*7919);
  runs++;
  const items=seen.filter(o=>!o.special).sort((a,b)=>a.land-b.land);
  const corr=items.filter(o=>o.correct);
  correctTotal+=corr.length;
  // optimal player walks the correct items in landing order
  let bx=W/2, prev=-1e9;
  for(const c of corr){
    const dtms=c.land-prev, reach=VMAX*dtms;
    if(Math.abs(c.x-bx) > reach+1e-6) forcedTotal++;
    if(prev>-1e9){ travel.push(Math.abs(c.x-bx)); minGapSeen=Math.min(minGapSeen,dtms); }
    bx=c.x; prev=c.land;
  }
  // a wrong item is a forced strike only if the bin is pinned on a correct
  // catch at that instant and cannot avoid overlapping it
  const catchR=(BINW+ITEMR)/2;
  for(const w of items.filter(o=>!o.correct)){
    const near=corr.filter(c=>Math.abs(c.land-w.land)<120);
    if(near.length && near.every(c=>Math.abs(c.x-w.x)<catchR)) forcedTotal++;
  }
}
travel.sort((a,b)=>a-b);
const p=q=>travel.length?travel[Math.floor(travel.length*q)].toFixed(0):"-";
console.log(`runs: ${runs} x 90s   correct items: ${correctTotal}`);
console.log(`FORCED STRIKES: ${forcedTotal}   ${forcedTotal===0?"OK":"FAIL"}`);
console.log(`tightest gap between consecutive correct items: ${minGapSeen.toFixed(0)}ms`);
console.log(`bin travel between catches: median ${p(0.5)}px, p90 ${p(0.9)}px, max ${p(0.999)}px`);
console.log(`(screen is ${W}px; bin crosses it in ${(W/VMAX/1000).toFixed(2)}s)`);
process.exit(forcedTotal===0?0:1);

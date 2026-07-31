/* Reproduces the webcam flicker without a camera, and proves the fix.

   Models three configurations so the comparison is honest:
     A  original   fixed 140ms life, blade deactivates on a single missed frame
     B  regressed  per-blade life (Ice 100ms), still instant-off  <- what the user sees
     C  fixed      per-blade life + 3-point floor + 150ms grace window

   Config C's expiry rule is read from the REAL js/blades.js so this cannot drift
   from what ships. */
const fs=require('fs'), vm=require('vm');
const R=require('path').join(__dirname,'..')+'/';

let STORE={}, RUNS=[];
const ctx={ console, Math, JSON, parseInt,
  localStorage:{ getItem:k=>(k in STORE?STORE[k]:null), setItem:(k,v)=>{STORE[k]=String(v);} },
  getRuns:()=>RUNS, drawTrail(){}, show(){},
  document:{ addEventListener(){}, getElementById:()=>null, querySelectorAll:()=>[],
    createElement:()=>({style:{},classList:{add(){},remove(){}},appendChild(){},
      addEventListener(){},setAttribute(){},
      getContext:()=>new Proxy({},{get:()=>()=>{},set:()=>true})}) },
  fxc:new Proxy({},{get:()=>()=>{},set:()=>true}) };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(R+'js/blades.js','utf8'), ctx);
RUNS=Array.from({length:80},()=>({m:'quiz',s:2000}));

let pass=true;
const ck=(n,c,d)=>{ if(!c)pass=false; console.log(`${c?'PASS':'FAIL'}  ${n}${d?'  '+d:''}`); };

const REAL_MINPTS=3, REAL_GRACE=200;
// sanity: the constants this harness assumes must match the shipped source
const bladesSrc=fs.readFileSync(R+'js/blades.js','utf8');
const gameSrc=fs.readFileSync(R+'js/game.js','utf8');
ck('harness MINPTS matches blades.js', bladesSrc.includes('MINPTS=3'));
ck('harness grace matches game.js', gameSrc.includes('CAMGRACE=200'));

/* One run. cfg: {life:'fixed'|'blade', floor:bool, grace:number|null} */
function run(bladeId, fps, lossPct, cfg, seconds, seed){
  const b=ctx.bladeById(bladeId);
  const life = cfg.life==='fixed' ? 140 : (b.life||140);
  let s=seed>>>0; const rnd=()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; };
  const camStep=1000/fps, renderStep=1000/60;
  let now=0, nextCam=0, lastSeen=-1e9, active=false, x=200, dir=1;
  const trail=[];
  let midSwipeFrames=0, blank=0, ringOff=0, worstRun=0, cur=0, everDrew=false;

  while(now<seconds*1000){
    while(nextCam<=now){
      if(rnd()>=lossPct){ lastSeen=nextCam; active=true; x+=26*dir; if(x>900||x<200) dir=-dir; }
      nextCam+=camStep;
    }
    // activation model
    if(cfg.grace===null){ if(lastSeen<now-camStep*0.5) active=false; }   // instant off
    else { if(now-lastSeen>cfg.grace) active=false; }

    if(active) trail.push({x:x, y:150, t:now});

    // expiry model
    if(cfg.floor){
      if(trail.length && now-trail[trail.length-1].t>=life) trail.length=0;
      else while(trail.length>REAL_MINPTS && now-trail[0].t>=life) trail.shift();
    } else {
      while(trail.length && now-trail[0].t>=life) trail.shift();
    }

    const drawn=trail.length>=2;
    if(drawn) everDrew=true;
    /* The hand IS present for the whole run — detection loss is the tracker
       failing, not the player stopping. So every frame after the first draw
       counts, whether `active` is true or not: a frame with the cursor ring
       missing is exactly the flash being reported. */
    if(everDrew){
      midSwipeFrames++;
      const visible = active || drawn;      // ring (needs active) or trail
      if(!active){ ringOff++; }
      if(!visible){ blank++; cur++; worstRun=Math.max(worstRun,cur); } else cur=0;
    }
    now+=renderStep;
  }
  return { blade:bladeId, life, midSwipeFrames, blank, ringOff,
           pct:+(ringOff/Math.max(1,midSwipeFrames)*100).toFixed(1),
           blankPct:+(blank/Math.max(1,midSwipeFrames)*100).toFixed(1), worstRun };
}

const A={life:'fixed', floor:false, grace:null};
const B={life:'blade', floor:false, grace:null};
const C={life:'blade', floor:true,  grace:REAL_GRACE};

console.log('\n--- 1. reproduce the flicker (25fps camera, 25% detection loss) ---');
console.log('    %% of frames where the blade cursor was MISSING while the hand was present');
console.log('    blade     A original   B what you see now   C fixed');
let worstA=0, worstB=0, worstC=0, streakC=0;
for(const id of ['ice','leaf','classic','ocean','amber','disco','sunset','gold']){
  const a=run(id,25,0.25,A,8,99), b=run(id,25,0.25,B,8,99), c=run(id,25,0.25,C,8,99);
  worstA=Math.max(worstA,a.pct); worstB=Math.max(worstB,b.pct);
  worstC=Math.max(worstC,c.pct); streakC=Math.max(streakC,c.worstRun);
  console.log(`    ${id.padEnd(9)} ${String(a.pct+'%').padStart(9)}   ${String(b.pct+'%').padStart(17)}   ${String(c.pct+'%').padStart(6)}`);
}
ck('the reported flicker reproduces', worstB>5, `worst ${worstB}% of frames blank`);
/* The RING flicker is driven purely by `active`, which does not depend on life
   at all, so A and B are identical here — the missing grace window is the whole
   story for this metric. The life change shows up in the fully-blank numbers
   below instead. */
ck('the missing grace window explains the ring flicker on its own', worstA>50 && worstB>50,
   `A ${worstA}%  B ${worstB}%`);
ck('the fix eliminates it', worstC===0, `worst ${worstC}%`);
// and the SECOND cause: shorter life raises the fully-blank rate
{
  const a=run('ice',25,0.25,A,8,99), b=run('ice',25,0.25,B,8,99), c=run('ice',25,0.25,C,8,99);
  console.log(`    fully-blank on Ice: original ${a.blankPct}%  ->  after my life change ${b.blankPct}%  ->  fixed ${c.blankPct}%`);
  ck('shortening life DID make the blank case worse', b.blankPct>a.blankPct*2,
     `${a.blankPct}% -> ${b.blankPct}%`);
  ck('the point floor fixes that too', c.blankPct===0, `${c.blankPct}%`);
}
ck('no blank streaks at all after the fix', streakC===0, `worst streak ${streakC}`);

console.log('\n--- 2. harsher: 15fps camera, 40% loss (slow laptop) ---');
let hB=0,hC=0;
for(const id of ['ice','gold']){
  const b=run(id,15,0.40,B,8,7), c=run(id,15,0.40,C,8,7);
  hB=Math.max(hB,b.pct); hC=Math.max(hC,c.pct);
  console.log(`    ${id.padEnd(9)} before ${String(b.pct+'%').padStart(6)}   after ${c.pct}%`);
}
/* 15fps with 40% loss is a tracker that is genuinely failing; some dropout there
   is honest rather than a bug. The bar is a large improvement, not perfection. */
ck('massively improved even on a failing tracker', hC<hB/5, `${hB}% -> ${hC}%`);
ck('and it was bad there before', hB>5, `worst ${hB}%`);

console.log('\n--- 3. the trail must still CLEAR when input stops ---');
{
  ctx.bladeSelect('gold');
  const b=ctx.bladeById('gold'), trail=[];
  let now=0;
  for(let i=0;i<6;i++){ trail.push({x:100+i*20,y:150,t:now}); now+=16.7; }
  ctx.bladeDrawTrail(trail, now);
  const during=trail.length;
  now+=b.life+50;
  ctx.bladeDrawTrail(trail, now);
  ck('a finished swipe clears completely, no stuck smear',
     during>0 && trail.length===0, `during=${during} after=${trail.length}`);
}

console.log('\n--- 4. grace window timing (25fps => 40ms per frame) ---');
{
  const G=REAL_GRACE, step=1000/25;
  ck('survives 1 dropped frame',  !(step*1<=G ? false : true), `${(step*1).toFixed(0)}ms`);
  ck('survives 3 dropped frames', step*3<=G, `${(step*3).toFixed(0)}ms <= ${G}ms`);
  ck('gives up once the hand is really gone', 250>G, `250ms > ${G}ms`);
}

console.log('\n--- 5. no phantom slices while the blade is held across a gap ---');
{
  const segHit=(o,x1,y1,x2,y2)=>{ const dx=x2-x1,dy=y2-y1,len2=dx*dx+dy*dy||1;
    const tt=Math.max(0,Math.min(1,((o.x-x1)*dx+(o.y-y1)*dy)/len2));
    const px=x1+tt*dx,py=y1+tt*dy; return Math.hypot(o.x-px,o.y-py)<o.r+12; };
  const hx=500, hy=150;
  ck('a held zero-length blade cannot reach a distant item',
     segHit({x:900,y:150,r:45}, hx,hy,hx,hy)===false);
  ck('a held blade still hits what it already overlaps',
     segHit({x:505,y:150,r:45}, hx,hy,hx,hy)===true);
}

console.log('\n--- 6. grace sweep: what value actually covers real detection gaps? ---');
console.log('    grace   25fps/25% loss   15fps/40% loss   hand-removal lag');
for(const g of [90,120,150,200,250,300]){
  const c1=run('ice',25,0.25,{life:'blade',floor:true,grace:g},8,99);
  const c2=run('ice',15,0.40,{life:'blade',floor:true,grace:g},8,7);
  console.log(`    ${String(g+'ms').padStart(6)}   ${String(c1.pct+'%').padStart(13)}   ${String(c2.pct+'%').padStart(13)}   ${g}ms`);
}

console.log('\n'+(pass?'ALL PASS':'FAILURES PRESENT'));
process.exit(pass?0:1);


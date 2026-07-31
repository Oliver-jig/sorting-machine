/* Does dead reckoning actually reduce the felt delay, or just look busy?

   Simulates a real swing, samples it the way each transport does, and compares
   where the blade IS against where the hand really is.

     relay   ~11 samples/sec, ~195ms one-way-ish transport (measured across four
             public brokers: emqx 206, hivemq 190, mosquitto 200, emqx-cn 188)
     direct  ~60 samples/sec, ~0ms (measured 0.3ms round trip on the LAN)

   "Effective lag" is the time shift that best aligns the drawn blade with the
   true hand path — i.e. what the player actually feels, not what the network
   reports. Lower is better; error is in screen widths. */
const fs=require('fs'), vm=require('vm');
const R=require('path').join(__dirname,'..')+'/';
const src=fs.readFileSync(R+'js/game.js','utf8');

const A=src.indexOf('var RCFG={');
const END='  return { x:Math.max(0,Math.min(W,px)), y:Math.max(0,Math.min(H,py)) };\n}';
const B=src.indexOf(END);

let pass=true;
const ck=(n,c,d)=>{ if(!c)pass=false; console.log(`${c?'PASS':'FAIL'}  ${n}${d?'  '+d:''}`); };
ck('found the dead-reckoning block in js/game.js', A>=0 && B>A);

let CLOCK=0;
const ctx={ console, Math, W:1280, H:720, performance:{ now:()=>CLOCK } };
vm.createContext(ctx);
vm.runInContext(src.slice(A, B+END.length), ctx);

/* The hand: a swing across the screen and back, the motion the game is for. */
const hand=t=>({ x:640+520*Math.sin(t/1000*2*Math.PI*0.7), y:360+120*Math.sin(t/1000*2*Math.PI*0.35) });

/* Run one transport for `secs`, returning the drawn path against the true one.
   predict=false reproduces the old behaviour: hold the last packet until the
   next arrives. */
function run({hz, delay, predict, relay, secs=6}){
  ctx.remoteReset();
  const step=1000/60, gap=1000/hz;
  let nextSample=0, held=null;
  const drawn=[], truth=[];
  for(let t=0; t<secs*1000; t+=step){
    CLOCK=t;
    if(t>=nextSample){                       /* a packet leaves the phone */
      const at=t-delay;                      /* carrying a position from `delay` ago */
      if(at>=0){ const h=hand(at);
        if(predict) ctx.remoteSample(0,h.x,h.y,relay); else held=h; }
      nextSample+=gap;
    }
    const p = predict ? ctx.remotePos(0,t) : held;
    if(p){ drawn.push({t, x:p.x, y:p.y}); truth.push(hand(t)); }
  }
  return {drawn, truth};
}
/* Mean distance between the blade and the hand, as a fraction of screen width. */
const err=({drawn,truth})=>drawn.reduce((s,p,i)=>
  s+Math.hypot(p.x-truth[i].x,p.y-truth[i].y),0)/drawn.length/1280;
/* The shift that best aligns the two paths = the lag the player feels. */
function felt({drawn}){
  let best=0, bestE=Infinity;
  for(let sh=0; sh<=400; sh+=5){
    let s=0,n=0;
    for(const p of drawn){ const h=hand(p.t-sh); s+=Math.hypot(p.x-h.x,p.y-h.y); n++; }
    if(s/n<bestE){ bestE=s/n; best=sh; }
  }
  return best;
}

console.log('\n--- 1. the relay path (~11 Hz, ~195ms) ---');
const oldRelay=run({hz:11, delay:195, predict:false, relay:true});
const newRelay=run({hz:11, delay:195, predict:true, relay:true});
const oe=err(oldRelay), ne=err(newRelay), of=felt(oldRelay), nf=felt(newRelay);
console.log(`    hold-last-packet : error ${(oe*100).toFixed(1)}% of screen, feels like ${of}ms of lag`);
console.log(`    dead reckoning   : error ${(ne*100).toFixed(1)}% of screen, feels like ${nf}ms of lag`);
ck('dead reckoning tracks the hand more closely', ne<oe,
   `${(oe*100).toFixed(1)}% -> ${(ne*100).toFixed(1)}%`);
ck('and it reduces the felt lag', nf<of, `${of}ms -> ${nf}ms`);
/* The sample gap is 90ms; recovering a good part of that is the whole point. */
ck('it cuts the felt lag by at least a third', (of-nf)/of>=0.33, `${of}ms -> ${nf}ms, cut ${Math.round(100*(of-nf)/of)}%`);

console.log('\n--- 2. the direct path (~60 Hz, ~0ms) must not be made worse ---');
const oldDirect=run({hz:60, delay:0, predict:false, relay:false});
const newDirect=run({hz:60, delay:0, predict:true, relay:false});
const ode=err(oldDirect), nde=err(newDirect);
console.log(`    hold-last-packet : error ${(ode*100).toFixed(2)}% of screen, feels like ${felt(oldDirect)}ms`);
console.log(`    dead reckoning   : error ${(nde*100).toFixed(2)}% of screen, feels like ${felt(newDirect)}ms`);
ck('the direct link stays exact (no lead applied there)', nde<0.005, `${(nde*100).toFixed(2)}% of screen`);

console.log('\n--- 3. prediction must not throw the blade off ---');
/* A hostile feed: alternating extremes, the worst case for velocity estimates. */
ctx.remoteReset();
let worst=0;
for(let i=0,t=0;i<200;i++,t+=90){
  CLOCK=t;
  ctx.remoteSample(0, i%2? 40:1240, i%2? 40:680, true);
  for(let k=0;k<6;k++){ CLOCK=t+k*16;
    const p=ctx.remotePos(0,CLOCK);
    worst=Math.max(worst, Math.abs(p.x-640)/640, Math.abs(p.y-360)/360);
  }
}
ck('the blade never leaves the playfield', worst<=1.0001, `peak ${(worst*100).toFixed(0)}% from centre`);

console.log('\n--- 4. a dropped connection must stop the guessing ---');
ctx.remoteReset();
CLOCK=0;    ctx.remoteSample(0,200,200,true);
CLOCK=90;   ctx.remoteSample(0,900,500,true);   /* moving fast */
CLOCK=1200; ctx.remoteSample(0,900,500,true); /* then a long silence */
CLOCK=1400;
const after=ctx.remotePos(0,1400);
ck('velocity is dropped after a stale gap, so the blade holds still',
   Math.abs(after.x-900)<60 && Math.abs(after.y-500)<60,
   `at ${after.x.toFixed(0)},${after.y.toFixed(0)} vs last sample 900,500`);

console.log('\n--- 5. the loop must actually drive it ---');
ck('loop() calls remoteDrive for phone control',
   /controlMode==="remote"\)\s*remoteDrive\(now\)/.test(src));
ck('remReset clears the samples too', /function remReset\(\)\{[\s\S]{0,80}?remoteReset\(\)/.test(src));

console.log('\n'+(pass?'ALL PASS':'FAILURES PRESENT'));
process.exit(pass?0:1);

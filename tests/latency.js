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
/* remMax lives above the extracted block; remStale uses it to size the
   input-lost window to how many phones are sharing the relay topic. */
let PLAYERS=1;
const ctx={ console, Math, W:1280, H:720, performance:{ now:()=>CLOCK },
            remMax:()=>PLAYERS };
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
ck('it cuts the felt lag by at least 30%', (of-nf)/of>=0.30, `${of}ms -> ${nf}ms, cut ${Math.round(100*(of-nf)/of)}%`);

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

console.log('\n--- 6. ordered samples and transport changes ---');
ctx.remoteReset(); CLOCK=0; ctx.remoteSample(0,400,360,false,10);
CLOCK=16; ctx.remoteSample(0,900,360,false,12);
CLOCK=32; const accepted=ctx.remoteSample(0,100,360,false,11);
ck('late packets are ignored', accepted===false, `accepted=${accepted}`);
const newest=ctx.remotePos(0,CLOCK);
ck('late packet cannot reverse the newest position', newest.x>850, `x=${newest.x.toFixed(0)}`);
CLOCK=48; ctx.remoteSample(0,920,360,true,13);
const switched=ctx.remotePos(0,CLOCK);
ck('transport change clears old velocity', Math.abs(switched.x-920)<1, `x=${switched.x.toFixed(0)}`);

console.log('\n--- 7. VERSUS: the second player is a first-class slot ---');
/* Player 2 was an afterthought everywhere: the direct data channel hardcoded
   slot 0, so before this fix a second phone could not have driven BLADE2 even
   if Versus had been allowed a direct link at all. Dead reckoning was always
   per-slot; assert it stays that way and that the slots do not leak into each
   other. */
PLAYERS=2; ctx.remoteReset();
CLOCK=0;  ctx.remoteSample(0,200,300,true,1); ctx.remoteSample(1,900,300,true,1);
CLOCK=90; ctx.remoteSample(0,300,300,true,2); ctx.remoteSample(1,800,300,true,2);
const s0=ctx.remotePos(0,90), s1=ctx.remotePos(1,90);
ck('player 1 keeps its own position', Math.abs(s0.x-300)<200, `x=${s0.x.toFixed(0)}`);
ck('player 2 keeps its own position', Math.abs(s1.x-800)<200, `x=${s1.x.toFixed(0)}`);
ck('the two players move independently', s0.x<s1.x, `${s0.x.toFixed(0)} vs ${s1.x.toFixed(0)}`);
/* Player 2 moved LEFT while player 1 moved right — if the slots shared state
   the prediction for one would carry the other's velocity. */
ck('player 2 is predicted along its own velocity, not player 1\'s',
   ctx.RSAMP[1].vx<0 && ctx.RSAMP[0].vx>0,
   `p1 vx=${ctx.RSAMP[0].vx.toFixed(2)} p2 vx=${ctx.RSAMP[1].vx.toFixed(2)}`);
ck('a direct sample gets no lead on either slot', (()=>{
  ctx.remoteReset(); CLOCK=0;
  ctx.remoteSample(0,400,300,false,1); ctx.remoteSample(1,900,300,false,1);
  return ctx.RSAMP[0].lead===0 && ctx.RSAMP[1].lead===0;
})());

console.log('\n--- 8. the input-lost window must fit the cadence it is given ---');
/* THE BUG THIS GUARDS. The window was a flat 350ms, tuned against ONE phone
   publishing every 90ms. Two phones share the MQTT topic, which the broker caps
   near 11 msg/s in TOTAL, so each publishes at 180ms — two dropped packets and
   the blade blanked to INPUT LOST in the middle of a swing. */
PLAYERS=2;
const gap2=90*2;
ck('a two-player relay survives a dropped publish', ctx.remStale(true)>gap2*2,
   `window ${ctx.remStale(true)}ms vs ${gap2}ms cadence`);
ck('the direct link keeps the tuned window', ctx.remStale(false)===ctx.RCFG.stale,
   `${ctx.remStale(false)}ms`);
PLAYERS=1;
ck('single player is unchanged at the tuned 350ms', ctx.remStale(true)===350,
   `${ctx.remStale(true)}ms`);
/* And the blade must actually still be alive across that gap. */
PLAYERS=2; ctx.remoteReset();
CLOCK=0;   ctx.remoteSample(1,600,300,true,1);
CLOCK=360;                                    /* one publish missed at 180ms each */
ck('player 2 is not declared lost after one missed publish', !!ctx.remotePos(1,CLOCK),
   `at ${CLOCK}ms`);
CLOCK=900;
ck('a phone genuinely put down still goes quiet', ctx.remotePos(1,CLOCK)===null);

console.log('\n'+(pass?'ALL PASS':'FAILURES PRESENT'));
process.exit(pass?0:1);

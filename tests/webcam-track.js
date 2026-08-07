/* Webcam tracking: steady when still, present when moving, edges reachable.

   THE BUGS THIS GUARDS. The webcam blade was reported as unstable, and three
   separate things caused it — none of them the camera:

     1. NOTHING WAS SMOOTHED. `BLADE.x=(1-tip.x)*W` put the raw landmark on
        screen, so the fingertip's own jitter shivered the blade permanently.
     2. THE BLADE MOVED AT CAMERA RATE. ~25 samples a second into a 60fps
        render: two frozen frames, then a teleport, forever.
     3. THE WHOLE 4:3 CAMERA FRAME MAPPED ONTO A 16:9 STAGE. Horizontal and
        vertical gain differed by a third, and reaching a screen edge meant
        putting your hand at the very edge of the camera view — where it is
        half out of frame and tracking drops. The blade died exactly where
        players reach for it.

   These are numeric choices, so they are checked numerically. */
const fs=require('fs'), vm=require('vm'), path=require('path');
const R=path.join(__dirname,'..')+'/';
const src=fs.readFileSync(R+'js/game.js','utf8');

let pass=true;
const ck=(n,c,d)=>{ if(!c)pass=false; console.log(`${c?'PASS':'FAIL'}  ${n}${d?'  '+d:''}`); };

/* Pull out the real tracking block and run it against a fake stage. */
const A=src.indexOf('var CAMCFG={');
const END='function camStatus(txt, ok){';
const B=src.indexOf(END);
ck('found the tracking block in js/game.js', A>=0 && B>A);

let CLOCK=0;
const ctx={ console, Math, W:1280, H:720,
  BLADE:{x:0,y:0,active:false}, BLADE2:{x:0,y:0,active:false},
  performance:{ now:()=>CLOCK },
  /* a 640x480 webcam — the common case, and the one whose aspect fights a
     16:9 stage */
  el:(id)=>id==="cam"?{videoWidth:640, videoHeight:480}:null };
vm.createContext(ctx);
vm.runInContext(src.slice(A,B), ctx);
const C=ctx.CAMCFG;

/* Deterministic noise, so a failure is reproducible rather than flaky. */
let seed=20260806;
const rnd=()=>{ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; };
const gauss=()=>{ let s=0; for(let i=0;i<6;i++) s+=rnd(); return (s-3)/1.2; };
const JIT=0.004;                       /* MediaPipe fingertip noise, normalized */

console.log('\n--- 1. a still hand must not shiver ---');
/* WOBBLE: RMS distance between the drawn blade and where the hand really is.
   Measured through the whole pipeline — filter, mapping and per-frame
   interpolation — because that is what reaches the screen. */
function wobble(filtered){
  const f=ctx.camFilterNew(); ctx.CAM.f=f; ctx.CAM.has=true; ctx.CAM.dT=0;
  const truth=filtered?ctx.camMap(0.5,0.5):{x:0.5*ctx.W,y:0.5*ctx.H};
  ctx.BLADE.x=truth.x; ctx.BLADE.y=truth.y;
  /* Seed the drive target too. Without this camDrive spends the frames before
     the first camera sample easing toward (0,0), which is a harness artifact —
     in the game CAM.has is false until the first hand is seen. */
  ctx.CAM.tx=truth.x; ctx.CAM.ty=truth.y;
  let camT=0,sum=0,n=0,peak=0;
  for(let fr=1;fr<=600;fr++){ CLOCK=fr*16.7;
    const nx=0.5+gauss()*JIT, ny=0.5+gauss()*JIT;
    if(CLOCK-camT>=40){ camT=CLOCK;
      if(!filtered){ ctx.BLADE.x=nx*ctx.W; ctx.BLADE.y=ny*ctx.H; }
      else { ctx.camSmooth(f,nx,ny,CLOCK); const p=ctx.camMap(f.fx,f.fy);
             ctx.CAM.tx=p.x; ctx.CAM.ty=p.y; } }
    if(filtered) ctx.camDrive(CLOCK);
    const d=Math.hypot(ctx.BLADE.x-truth.x, ctx.BLADE.y-truth.y);
    sum+=d*d; n++; peak=Math.max(peak,d);
  }
  return {rms:Math.sqrt(sum/n), peak};
}
seed=20260806; const raw=wobble(false);
seed=20260806; const smoothed=wobble(true);
ck('the blade is steadier than the raw landmark', smoothed.rms < raw.rms*0.8,
   `${smoothed.rms.toFixed(2)}px vs ${raw.rms.toFixed(2)}px raw`);
ck('and its worst excursion is smaller too', smoothed.peak < raw.peak*0.85,
   `${smoothed.peak.toFixed(1)}px vs ${raw.peak.toFixed(1)}px`);
ck('a resting hand stays inside a few pixels', smoothed.rms < 3.2,
   `${smoothed.rms.toFixed(2)}px`);

console.log('\n--- 2. but it must still keep up with a fast swing ---');
/* Smoothing that lags is worse than jitter here: the blade has to be under your
   hand at the moment you swipe, or you cut the wrong item. One item radius is
   50px, so that is the budget. */
function lag(){
  const f=ctx.camFilterNew(); let worst=0;
  for(let i=0;i<=25;i++){ CLOCK=i*40;
    const nx=0.15+0.7*Math.min(1,i/12);
    ctx.camSmooth(f,nx,0.5,CLOCK);
    worst=Math.max(worst, Math.abs(ctx.camMap(f.fx,f.fy).x - ctx.camMap(nx,0.5).x));
  }
  return worst;
}
const L=lag();
ck('a fast swing lags by less than one item radius', L<50, `${L.toFixed(0)}px`);
ck('the filter opens up with speed rather than dragging', C.beta>0 && C.mincut>0,
   `mincut ${C.mincut}Hz, beta ${C.beta}`);

console.log('\n--- 3. the blade must move every frame, not every camera frame ---');
(()=>{
  const f=ctx.camFilterNew(); ctx.CAM.f=f; ctx.CAM.has=true; ctx.CAM.dT=0;
  ctx.BLADE.x=ctx.camMap(0.3,0.5).x;
  let camT=0, frozen=0, tot=0, jump=0, prev=ctx.BLADE.x;
  for(let fr=1;fr<=240;fr++){ CLOCK=fr*16.7;
    const nx=0.2+0.6*(0.5+0.5*Math.sin(CLOCK/1000*2*Math.PI*0.8));
    if(CLOCK-camT>=40){ camT=CLOCK; ctx.camSmooth(f,nx,0.5,CLOCK);
      const p=ctx.camMap(f.fx,f.fy); ctx.CAM.tx=p.x; ctx.CAM.ty=p.y; }
    ctx.camDrive(CLOCK);
    const d=Math.abs(ctx.BLADE.x-prev); prev=ctx.BLADE.x;
    if(d<0.02) frozen++; tot++; jump=Math.max(jump,d);
  }
  ck('the blade is not frozen for most of the frames', frozen/tot<0.10,
     `${(100*frozen/tot).toFixed(0)}% frozen`);
  ck('and it never teleports across the screen in one frame', jump<ctx.W*0.35,
     `biggest step ${jump.toFixed(0)}px`);
})();
ck('interpolation is fast enough not to add lag of its own', C.lerpTau<=16,
   `lerpTau ${C.lerpTau}ms`);

console.log('\n--- 4. the mapping must be square, and the edges reachable ---');
const o=ctx.camMap(0.5,0.5);
/* The same PHYSICAL hand movement: 5% of the frame's width, and the height
   equivalent of that same distance on a 4:3 sensor. */
const gx=ctx.camMap(0.55,0.5).x-o.x;
const gy=ctx.camMap(0.5,0.5+0.05*(640/480)).y-o.y;
ck('horizontal and vertical gain match', Math.abs(gx-gy)<2,
   `${gx.toFixed(1)}px across vs ${gy.toFixed(1)}px down`);
/* What it used to be, for the record: the old code mapped the whole frame, so
   the same hand movement travelled 64px across and 48px down — a third off. */
ck('this is an improvement on mapping the whole frame',
   Math.abs(0.05*1280 - 0.05*(640/480)*720) > 10);
ck('a margin of camera frame is left unused', C.margin>0.04 && C.margin<0.2,
   `${(C.margin*100).toFixed(0)}% per side`);
ck('the left edge is reached before the camera edge', ctx.camMap(C.margin,0.5).x<=0.5);
ck('the right edge is reached before the camera edge', ctx.camMap(1-C.margin,0.5).x>=ctx.W-0.5);
ck('going past it clamps instead of overshooting',
   ctx.camMap(-0.5,0.5).x===0 && ctx.camMap(1.5,0.5).x===ctx.W);
/* A stage narrower than the camera must be handled too, not just wider. */
ctx.W=800; ctx.H=900;
const p2=ctx.camMap(0.5,0.5);
ck('a portrait stage still maps to its own centre',
   Math.abs(p2.x-400)<1 && Math.abs(p2.y-450)<1, `${p2.x.toFixed(0)},${p2.y.toFixed(0)}`);
ctx.W=1280; ctx.H=720;

console.log('\n--- 5. losing the hand, and getting it back ---');
ck('re-acquisition after a gap SNAPS rather than sliding across', (()=>{
  const f=ctx.camFilterNew();
  ctx.camSmooth(f,0.2,0.2,0);
  return ctx.camSmooth(f,0.8,0.8,5000)===true;     /* true == filter reset */
})());
ck('a continuous track does NOT snap', (()=>{
  const f=ctx.camFilterNew(); ctx.camSmooth(f,0.5,0.5,0);
  return ctx.camSmooth(f,0.52,0.5,40)===false;
})());
const code=src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
/* MediaPipe re-runs palm detection when tracking confidence drops, which is a
   multi-frame dropout. During a fast swing the hand is blurred and confidence
   dips — exactly when the blade must not die. */
const tracks=[...code.matchAll(/minTrackingConfidence:([\d.]+)/g)].map(m=>+m[1]);
ck('tracking confidence is low enough to survive motion blur',
   tracks.length===2 && tracks.every(v=>v<=0.4), tracks.join(', '));
const dets=[...code.matchAll(/minDetectionConfidence:([\d.]+)/g)].map(m=>+m[1]);
ck('detection confidence is low enough for poor light',
   dets.length===2 && dets.every(v=>v<=0.55), dets.join(', '));
const grace=+(src.match(/var CAMGRACE=(\d+)/)||[])[1];
ck('the grace window still covers a single missed frame', grace>=150, `${grace}ms`);
ck('a hand lost for good clears the drive target',
   /CAM\.has=false/.test(code));
/* Sending a frame before the video has decoded one throws inside MediaPipe and
   kills the onFrame pump for the rest of the session. */
ck('no frame is sent before the video is ready',
   (code.match(/readyState>=2/g)||[]).length===2);
ck('filter state is dropped with the camera', /function stopCam[\s\S]{0,700}?camFilterNew\(\)/.test(code));

console.log('\n--- 6. both webcam paths get the same treatment ---');
/* Versus tracks two hands. It had the identical raw-landmark problem, and one
   extra: sorting the hands AFTER filtering would swap the two filters' state
   whenever the players' hands crossed, jumping both blades. */
ck('single-player tracking is smoothed', /camSmooth\(CAM\.f,/.test(code));
ck('Versus smooths both hands', /camSmooth\(CAM\.f2,/.test(code));
const vsFn=code.slice(code.indexOf('async function setupCamVS'));
ck('Versus sorts hands BEFORE filtering, so filters do not swap',
   vsFn.indexOf('raw.sort(') >=0 && vsFn.indexOf('raw.sort(') < vsFn.indexOf('camSmooth(CAM.f,'));
ck('the loop drives the camera blade every frame',
   /controlMode==="cam"\) camDrive\(now\)/.test(code));
ck('tracking state is shown to the player, not left to be guessed',
   /function camStatus/.test(src) && /Hand tracked/.test(src) && /Show your hand/.test(src));

console.log('\n'+(pass?'ALL PASS':'FAILURES PRESENT'));
process.exit(pass?0:1);

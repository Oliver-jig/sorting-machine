/* Phone controller: does a real arm swing actually move the blade?

   THE BUG THIS GUARDS. Build 43 rebuilt Slash on a pointing vector from
   alpha+beta because tilt-against-gravity (beta/gamma) is blind to yaw, and an
   arm sweep is almost pure yaw. Aim was left on the old beta/gamma path AND was
   the default mode, so out of the box the controller could not see the motion
   the QR screen instructs ("hold your phone sideways like a knife handle").
   Measured in that grip, an 80-degree sweep moved Aim's input by 0.00 degrees:
   the grip puts gamma at exactly -90, the gimbal-lock singularity of the
   beta/gamma parameterisation, so the whole swing lands in alpha.

   This harness runs the REAL controller.html script in a vm and drives it with
   synthesised sensor readings, so it fails if either mode ever goes deaf again. */
const fs=require('fs'), vm=require('vm');
const R=require('path').join(__dirname,'..')+'/';

/* ---- the sensor model: what a browser reports for a given physical pose ----
   W3C: device frame = world frame after intrinsic Z(alpha) X'(beta) Y''(gamma),
   i.e. R = Rz(a)*Rx(b)*Ry(g). We build a pose, then invert to the angles the
   browser would hand us — so the harness feeds the code real sensor values
   rather than numbers chosen to make it pass. */
const D=Math.PI/180, deg=r=>r*180/Math.PI;
const mul=(A,B)=>A.map((r,i)=>B[0].map((_,j)=>r.reduce((s,v,k)=>s+v*B[k][j],0)));
const Rz=t=>[[Math.cos(t),-Math.sin(t),0],[Math.sin(t),Math.cos(t),0],[0,0,1]];
const Rx=t=>[[1,0,0],[0,Math.cos(t),-Math.sin(t)],[0,Math.sin(t),Math.cos(t)]];
const Ry=t=>[[Math.cos(t),0,Math.sin(t)],[0,1,0],[-Math.sin(t),0,Math.cos(t)]];
function euler(M){
  const b=Math.asin(Math.max(-1,Math.min(1,M[2][1])));
  let a,g;
  if(Math.abs(Math.cos(b))<1e-7){ a=0; g=Math.atan2(M[0][2],M[0][0]); }
  else { a=Math.atan2(-M[0][1],M[1][1]); g=Math.atan2(-M[2][0],M[2][2]); }
  return {alpha:(deg(a)+360)%360, beta:deg(b), gamma:deg(g)};
}
/* A pose described the way a player would: point the phone's tip at a compass
   bearing (`yaw`, degrees right of straight ahead) and an elevation (`elev`,
   degrees above horizontal), holding it rolled by `roll` about its own length.
   Built as a rotation matrix and inverted back to Euler angles by euler(), so
   the harness feeds the controller genuine sensor values rather than numbers
   reverse-engineered from the code it is testing. */
const pose=(yaw,elev,roll)=>euler(mul(Rz(-yaw*D), mul(Rx(elev*D), Ry((roll||0)*D))));
/* The documented grip: "sideways like a knife handle" == rolled 90 degrees. */
const knife=(swing,chop)=>pose(swing, chop||0, -90);
/* Same motion, phone held upright instead — the grip must not matter, because
   roll is deliberately dropped from the pointing vector. */
const upright=(swing,chop)=>pose(swing, chop||0, 0);

/* ---- load the real controller script ---- */
const html=fs.readFileSync(R+'controller.html','utf8');
const src=html.slice(html.lastIndexOf('<script>')+8, html.lastIndexOf('</script>'));
const stubEl=()=>({ style:{}, value:"", className:"", innerHTML:"",
  addEventListener(){}, focus(){} });
const STORE={};
let frames=0;
const ctx={ console, Math, Date, JSON, parseInt, isNaN, setTimeout,
  localStorage:{ getItem:k=>(k in STORE?STORE[k]:null), setItem:(k,v)=>{STORE[k]=String(v);} },
  location:{search:"", protocol:"https:"}, URLSearchParams,
  screen:{}, navigator:{}, RTCPeerConnection:undefined, DeviceOrientationEvent:undefined,
  requestAnimationFrame:()=>{ frames++; },      /* never actually re-enter tick */
  document:{ getElementById:stubEl, addEventListener(){}, body:{className:""} },
  window:{ addEventListener(){} } };
ctx.window=ctx; vm.createContext(ctx);
vm.runInContext(src, ctx);

let pass=true;
const ck=(n,c,d)=>{ if(!c)pass=false; console.log(`${c?'PASS':'FAIL'}  ${n}${d?'  '+d:''}`); };

/* Drive one sensor reading through the real handler + one tick, and report
   where the blade ended up. */
function feed(e){ ctx.onOrient(e); ctx.tick(); return {x:ctx.bx, y:ctx.by}; }
function recentre(){ ctx.yaw0=null; ctx.elev0=null; ctx.bx=0.5; ctx.by=0.5; ctx.vx=0; ctx.vy=0; }
function setMode(g){ ctx.GRIP=g; recentre(); }
/* Slash springs toward the target, so let it settle before reading position. */
function settle(e,n){ let p; for(let i=0;i<(n||40);i++) p=feed(e); return p; }

console.log('--- 1. the reported sensor values in the documented grip ---');
[-40,-20,0,20,40].forEach(s=>{ const e=knife(s,0);
  console.log(`    swing ${String(s).padStart(4)}°  ->  alpha ${e.alpha.toFixed(1).padStart(6)}  beta ${e.beta.toFixed(1).padStart(6)}  gamma ${e.gamma.toFixed(1).padStart(6)}`); });
const sweep=[-40,-20,0,20,40].map(s=>knife(s,0));
const span=v=>Math.max(...v)-Math.min(...v);
/* This is the ROOT CAUSE, asserted directly: an arm sweep is invisible in the
   two axes the old Aim read, and fully present in the one it ignored. */
ck('beta and gamma do not move at all across an 80° sweep',
   span(sweep.map(e=>e.beta))<0.01 && span(sweep.map(e=>e.gamma))<0.01,
   `beta span ${span(sweep.map(e=>e.beta)).toFixed(3)}°, gamma span ${span(sweep.map(e=>e.gamma)).toFixed(3)}°`);
/* alpha is reported in 0..360, so measure it relative to the first reading and
   unwrap — otherwise a sweep straddling 0 reads as 340° instead of 80°. */
const aRel=sweep.map(e=>ctx.wrapDeg(e.alpha-sweep[0].alpha));
ck('the whole sweep is in alpha', span(aRel)>79, `alpha span ${span(aRel).toFixed(1)}°`);

console.log('\n--- 2. AIM: an arm swing must move the blade ---');
setMode('aim');
feed(knife(0,0));                                   /* centre pose */
const aimL=feed(knife(-40,0)).x, aimR=feed(knife(40,0)).x;
console.log(`    swing -40° -> x=${aimL.toFixed(3)}    swing +40° -> x=${aimR.toFixed(3)}`);
ck('80° of arm swing crosses most of the screen', Math.abs(aimR-aimL)>0.6,
   `travel ${(Math.abs(aimR-aimL)*100).toFixed(1)}% of screen`);
ck('the two ends land on opposite sides of centre', (aimL-0.5)*(aimR-0.5)<0);

console.log('\n--- 3. AIM: a chop must move the blade vertically ---');
setMode('aim');
feed(knife(0,0));
const aimU=feed(knife(0,-25)).y, aimD=feed(knife(0,25)).y;
console.log(`    chop -25° -> y=${aimU.toFixed(3)}    chop +25° -> y=${aimD.toFixed(3)}`);
ck('50° of chop crosses most of the screen', Math.abs(aimD-aimU)>0.6,
   `travel ${(Math.abs(aimD-aimU)*100).toFixed(1)}% of screen`);

console.log('\n--- 4. SLASH still works, and agrees with AIM ---');
setMode('slash');
settle(knife(0,0));
const slL=settle(knife(-40,0)).x, slR=settle(knife(40,0)).x;
console.log(`    swing -40° -> x=${slL.toFixed(3)}    swing +40° -> x=${slR.toFixed(3)}`);
ck('Slash crosses the screen too', Math.abs(slR-slL)>0.6,
   `travel ${(Math.abs(slR-slL)*100).toFixed(1)}% of screen`);
/* The modes are documented as "the same target, one with weight". Once Slash
   has settled they must land in the SAME place, or that claim is false again. */
ck('settled Slash lands where Aim lands', Math.abs(slL-aimL)<0.02 && Math.abs(slR-aimR)<0.02,
   `aim ${aimL.toFixed(3)}/${aimR.toFixed(3)} vs slash ${slL.toFixed(3)}/${slR.toFixed(3)}`);

console.log('\n--- 5. holding still must hold still ---');
setMode('aim');
feed(knife(12,7));
const h1=feed(knife(12,7)), h2=feed(knife(12,7));
ck('a repeated reading does not drift', Math.abs(h2.x-h1.x)<1e-9 && Math.abs(h2.y-h1.y)<1e-9);

console.log('\n--- 6. the grip must not matter: same swing, phone held upright ---');
setMode('aim');
feed(upright(0,0));
const uL=feed(upright(-40,0)).x, uR=feed(upright(40,0)).x;
console.log(`    swing -40° -> x=${uL.toFixed(3)}    swing +40° -> x=${uR.toFixed(3)}`);
ck('an upright phone steers identically to the knife grip',
   Math.abs(uL-aimL)<0.02 && Math.abs(uR-aimR)<0.02,
   `knife ${aimL.toFixed(3)}/${aimR.toFixed(3)} vs upright ${uL.toFixed(3)}/${uR.toFixed(3)}`);

console.log('\n--- 6b. roll is IGNORED on purpose (spinning the knife, not aiming) ---');
setMode('aim');
feed(pose(0,0,0));
const r0=feed(pose(0,0,0)).x, r90=feed(pose(0,0,75)).x;
console.log(`    roll 0° -> x=${r0.toFixed(3)}    roll 75° -> x=${r90.toFixed(3)}`);
/* NOTE A BEHAVIOUR CHANGE: the old Aim read gamma, so twisting your wrist used
   to steer. It no longer does — you point the phone instead. That is the
   documented intent of the pointing vector, and it is what makes the knife grip
   work, but it is a real difference for anyone who held the phone flat. */
ck('rolling the phone does not move the blade', Math.abs(r90-r0)<0.02,
   `moved ${(Math.abs(r90-r0)*100).toFixed(1)}%`);

console.log('\n--- 7. an empty sensor event must not look like a working sensor ---');
ctx.haveOrient=false;
ctx.onOrient({alpha:null, beta:null, gamma:null});
ck('all-null reading is rejected', ctx.haveOrient===false);
ctx.onOrient({});
ck('a completely empty event is rejected', ctx.haveOrient===false);
ctx.onOrient({alpha:90, beta:0, gamma:-90});
ck('a real reading is accepted', ctx.haveOrient===true);

console.log('\n--- 8. the +/-180 seam must not teleport the blade ---');
/* Centre on a pose near the wrap point, then swing across it. Without wrapDeg
   the yaw difference reads as ~357° instead of ~-3° and the blade slams to the
   far edge of the screen. */
setMode('aim');
feed(knife(175,0));
const seamA=feed(knife(175,0)).x, seamB=feed(knife(-175,0)).x;
console.log(`    swing 175° -> x=${seamA.toFixed(3)}    swing -175° (10° further) -> x=${seamB.toFixed(3)}`);
ck('crossing +/-180 moves the blade by a small amount, not a jump',
   Math.abs(seamB-seamA)<0.25, `moved ${(Math.abs(seamB-seamA)*100).toFixed(1)}% for a 10° swing`);

console.log('\n--- 9. motion packets are sequenced and input loss is visible ---');
const ctrlCode=src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
ck('phone motion packets carry a monotonic sequence', /\+\+motionSeq/.test(ctrlCode) && /seq:packet\.seq/.test(ctrlCode));
ck('phone exposes an INPUT LOST state', /INPUT LOST/.test(ctrlCode) && /lastOrientAt/.test(ctrlCode));

console.log('\n'+(pass?'ALL PASS':'FAILURES PRESENT'));
process.exit(pass?0:1);

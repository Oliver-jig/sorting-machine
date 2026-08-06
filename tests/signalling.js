/* WebRTC signalling: no ICE candidate may be lost to arrival order.

   THE BUG THIS GUARDS. Offer/answer and ICE candidates all travel over the same
   MQTT relay, and addIceCandidate() REJECTS if it is called before the remote
   description is set. The rejection is a promise, so the old sync try/catch
   never saw it and the candidate vanished silently. The host also had an
   `&& hostPC` guard that discarded any candidate arriving before the offer.

   Scope, honestly: browsers queue addIceCandidate behind a pending
   setRemoteDescription, so the common ordering is absorbed for you and this was
   probably not the whole latency story. The `&& hostPC` / `&& pc` discards were
   real unconditional losses though, and a lost candidate can mean ICE fails and
   the phone plays the whole game on the relay. Measured against the public
   broker this game uses:

     rate     delivered   median latency
     60 Hz      19.5%        207 ms
     10 Hz      98.0%        220 ms

   ~205ms round trip, capped near 11 messages/second. That is the delay. */
const fs=require('fs'), vm=require('vm');
const R=require('path').join(__dirname,'..')+'/';
const gameSrc=fs.readFileSync(R+'js/game.js','utf8');
const ctrlSrc=fs.readFileSync(R+'controller.html','utf8');

let pass=true;
const ck=(n,c,d)=>{ if(!c)pass=false; console.log(`${c?'PASS':'FAIL'}  ${n}${d?'  '+d:''}`); };

/* A peer connection that behaves like the real thing on the one point that
   matters: addIceCandidate rejects until a remote description exists. */
function fakePC(){
  return { remote:false, added:[], rejected:[],
    addIceCandidate(c){
      if(!this.remote){ this.rejected.push(c); return Promise.reject(new Error('no remote description')); }
      this.added.push(c); return Promise.resolve();
    } };
}

/* ---- host side: run the REAL signalling block out of js/game.js ----
   The block is per-cid now: one peer connection per phone. Versus used to
   answer no offer at all, which pinned two-player games to the relay. */
const A=gameSrc.indexOf('var HPEER={}');
const endMark='function remCount(){ return remOrder.length; }';
const B=gameSrc.indexOf(endMark);
ck('found the host signalling block in js/game.js', A>=0 && B>A);
const hostBlock=gameSrc.slice(A, B+endMark.length);

/* Stubs for the few things the block reaches outside itself. */
function makeHostCtx(gmode){
  const ctx={ console, Promise, Error, JSON, Math, RTCPeerConnection:FakeRTC,
    GMODE:gmode, roomCode:'1234', mqttClient:null, published:[], applied:[],
    HICE:{iceServers:[]},                       /* defined above the block in game.js */
    roomLine(){}, el:()=>({innerHTML:"", textContent:"", disabled:false}),
    remoteReset(){}, };
  ctx.applyRemote=(g,b,slot,relay,seq)=>{ ctx.applied.push({g,b,slot,relay,seq}); };
  ctx.hostPub=o=>{ ctx.published.push(o); };
  vm.createContext(ctx);
  vm.runInContext(hostBlock, ctx);
  /* hostPub is defined inside the block; re-stub it after so we can see traffic */
  ctx.hostPub=o=>{ ctx.published.push(o); };
  return ctx;
}
/* A peer connection that behaves like the real thing on the points that matter:
   addIceCandidate rejects until a remote description exists, and the handshake
   is a promise chain. */
function FakeRTC(){
  const self={ remote:false, added:[], rejected:[], closed:false,
    localDescription:{type:'answer',sdp:'fake'},
    onicecandidate:null, ondatachannel:null,
    addIceCandidate(c){
      if(!self.remote){ self.rejected.push(c); return Promise.reject(new Error('no remote description')); }
      self.added.push(c); return Promise.resolve();
    },
    setRemoteDescription(){ self.remote=true; return Promise.resolve(); },
    createAnswer(){ return Promise.resolve({type:'answer',sdp:'fake'}); },
    setLocalDescription(){ return Promise.resolve(); },
    close(){ self.closed=true; } };
  FakeRTC.made.push(self);
  return self;
}
FakeRTC.made=[];

const hostCtx=makeHostCtx('sort');

console.log('--- 1. HOST: candidates that arrive before the offer ---');
hostCtx.hostAddIce('p1','c1'); hostCtx.hostAddIce('p1','c2');
ck('nothing is thrown away while the peer does not exist',
   hostCtx.HPEER.p1.iceQ.length===2, `${hostCtx.HPEER.p1.iceQ.length} queued`);
const hpc=fakePC(); hostCtx.HPEER.p1.pc=hpc;
hostCtx.hostAddIce('p1','c3');                         /* pc exists, remote not set yet */
ck('still queued until the remote description lands',
   hostCtx.HPEER.p1.iceQ.length===3, `${hostCtx.HPEER.p1.iceQ.length} queued`);
hpc.remote=true; hostCtx.hostFlushIce('p1');
ck('every candidate is delivered once the offer is applied',
   hpc.added.join(',')==='c1,c2,c3', `added [${hpc.added.join(',')}]`);
ck('none were rejected', hpc.rejected.length===0, `${hpc.rejected.length} rejected`);
ck('the queue is empty afterwards', hostCtx.HPEER.p1.iceQ.length===0);

console.log('\n--- 2. HOST: candidates arriving after the handshake go straight through ---');
hostCtx.hostAddIce('p1','c4');
ck('delivered immediately, not queued',
   hpc.added.length===4 && hostCtx.HPEER.p1.iceQ.length===0, `added [${hpc.added.join(',')}]`);

console.log('\n--- 3. HOST: flushing with no peer connection must not hang ---');
hostCtx.HPEER.p1.pc=null; hostCtx.HPEER.p1.remoteSet=false; hostCtx.HPEER.p1.iceQ.length=0;
hostCtx.hostAddIce('p1','x1'); hostCtx.hostAddIce('p1','x2');
const t0=Date.now(); hostCtx.hostFlushIce('p1');
ck('flush returns instead of looping forever', Date.now()-t0<1000, `${Date.now()-t0}ms`);
ck('the candidates are re-queued, not lost', hostCtx.HPEER.p1.iceQ.length===2,
   `${hostCtx.HPEER.p1.iceQ.length} queued`);

console.log('\n--- 3b. one phone\'s candidates never reach the other phone ---');
const twoCtx=makeHostCtx('vs');
twoCtx.remSlot('a'); twoCtx.remSlot('b');
const pa=fakePC(), pb=fakePC(); pa.remote=true; pb.remote=true;
twoCtx.HPEER.a={pc:pa, iceQ:[], remoteSet:true, slot:0};
twoCtx.HPEER.b={pc:pb, iceQ:[], remoteSet:true, slot:1};
twoCtx.hostAddIce('a','a1'); twoCtx.hostAddIce('b','b1'); twoCtx.hostAddIce('a','a2');
ck('player 1 got only its own candidates', pa.added.join(',')==='a1,a2', `[${pa.added.join(',')}]`);
ck('player 2 got only its own candidates', pb.added.join(',')==='b1', `[${pb.added.join(',')}]`);

/* ---- controller side: run the REAL script out of controller.html ---- */
const stubEl=()=>({ style:{}, value:"", className:"", innerHTML:"",
  addEventListener(){}, focus(){} });
const STORE={};
const cctx={ console, Math, Date, JSON, parseInt, isNaN, setTimeout, Promise, Error,
  localStorage:{ getItem:k=>(k in STORE?STORE[k]:null), setItem:(k,v)=>{STORE[k]=String(v);} },
  location:{search:"",protocol:"https:"}, URLSearchParams, screen:{}, navigator:{},
  RTCPeerConnection:undefined, DeviceOrientationEvent:undefined,
  requestAnimationFrame:()=>{},
  document:{ getElementById:stubEl, addEventListener(){}, body:{className:""} } };
cctx.window=cctx; vm.createContext(cctx);
vm.runInContext(ctrlSrc.slice(ctrlSrc.lastIndexOf('<script>')+8, ctrlSrc.lastIndexOf('</script>')), cctx);

console.log('\n--- 4. CONTROLLER: host candidates always beat the answer ---');
const cpc=fakePC(); cctx.pc=cpc; cctx.remoteSet=false; cctx.iceQ.length=0;
cctx.addIce('h1'); cctx.addIce('h2'); cctx.addIce('h3');
ck('all three are held, none rejected',
   cctx.iceQ.length===3 && cpc.rejected.length===0, `${cctx.iceQ.length} queued`);
cpc.remote=true; cctx.flushIce();
ck('all three land once the answer is applied', cpc.added.join(',')==='h1,h2,h3',
   `added [${cpc.added.join(',')}]`);
ck('none were rejected', cpc.rejected.length===0);

console.log('\n--- 5. CONTROLLER: flush with no pc must not hang ---');
cctx.pc=null; cctx.remoteSet=false; cctx.iceQ.length=0;
cctx.addIce('y1');
const t1=Date.now(); cctx.flushIce();
ck('returns promptly', Date.now()-t1<1000, `${Date.now()-t1}ms`);

console.log('\n--- 6. the discard guard must not come back ---');
/* Scan CODE only. These files explain the old guard in prose, and matching the
   pattern inside its own comment is a false positive that fails a correct fix. */
const decomment=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
const gameCode=decomment(gameSrc), ctrlCode=decomment(ctrlSrc);
ck('js/game.js no longer drops candidates when hostPC is null',
   !/d\.type==="ice"\s*&&\s*hostPC/.test(gameCode));
ck('controller.html no longer drops candidates when pc is null',
   !/d\.type==="ice"\s*&&\s*pc\b/.test(ctrlCode));
/* And the dead TURN server must not creep back in. */
ck('no openrelay TURN entry in js/game.js', !/openrelay/.test(gameCode));
ck('no openrelay TURN entry in controller.html', !/openrelay/.test(ctrlCode));

console.log('\n--- 7. the relay must not be flooded ---');
const m=ctrlSrc.match(/RELAYMS\s*=\s*(\d+)/);
ck('controller.html defines RELAYMS', !!m, m?`${m[1]}ms`:'missing');
/* The broker measured out at ~11 msg/s; anything faster is discarded, so a
   value below ~80ms means we are back to throwing the player's input away. */
ck('the relay is throttled to at most ~12 updates/sec', m && Number(m[1])>=80,
   m?`${m[1]}ms => ${(1000/Number(m[1])).toFixed(1)} Hz`:'');
const dm=ctrlSrc.match(/DCMS\s*=\s*(\d+)/);
ck('the direct link keeps full rate', dm && Number(dm[1])<=20,
   dm?`${dm[1]}ms => ${(1000/Number(dm[1])).toFixed(0)} Hz`:'missing');

console.log('\n--- 8. VERSUS: two phones, two direct links ---');
/* THE BUG THIS GUARDS. `else if(d.type==="offer"){ if(remMax()===1) hostAnswer(d.sdp); }`
   — in Versus remMax() is 2, so the host answered NO offer and both players
   spent the whole game on the ~205ms relay, sharing a topic capped near 11
   msg/s. Two-player Versus was unplayable and the sensors were never at fault. */
ck('the Versus offer gate is gone', !/remMax\(\)===1\)\s*hostAnswer/.test(gameCode));
ck('the host tags its answer with a cid',
   /type:"answer",\s*cid:/.test(gameCode));
ck('the host tags its candidates with a cid',
   /type:"ice",\s*cid:/.test(gameCode));
ck('the controller tags its offer with a cid',
   /type:"offer",\s*cid:CID/.test(ctrlCode));
ck('the controller tags its candidates with a cid',
   /type:"ice",\s*cid:CID/.test(ctrlCode));
ck('the data channel no longer hardcodes slot 0',
   !/applyRemote\(o\.g,o\.b,0,false/.test(gameCode));
/* The relay rate must scale with how many phones share the topic — 90ms each
   for two is ~22 msg/s into an 11 msg/s pipe, which is where half of each
   player's input went. */
ck('the host reports the player count to the phone', /players:remMax\(\)/.test(gameCode));
ck('the controller scales RELAYMS by the player count',
   /RELAYMS\s*=\s*RELAYBASE\s*\*/.test(ctrlCode));

const vs=makeHostCtx('vs');
FakeRTC.made.length=0;
vs.connectHostMqtt=null;                        /* not used; drive hostAnswer directly */
vs.remSlot('phoneA'); vs.remSlot('phoneB');     /* hello order decides the slots */
vs.hostAnswer('phoneA', {type:'offer',sdp:'A'});
vs.hostAnswer('phoneB', {type:'offer',sdp:'B'});

/* The handshake is a promise chain; a macrotask lets all of it settle first. */
setTimeout(()=>{
  ck('both phones got a peer connection', FakeRTC.made.length===2, `${FakeRTC.made.length} made`);
  ck('they are two DIFFERENT connections',
     vs.HPEER.phoneA.pc && vs.HPEER.phoneB.pc && vs.HPEER.phoneA.pc!==vs.HPEER.phoneB.pc);
  ck('neither closed the other',
     !vs.HPEER.phoneA.pc.closed && !vs.HPEER.phoneB.pc.closed);
  ck('the peers carry the two different slots',
     vs.HPEER.phoneA.slot===0 && vs.HPEER.phoneB.slot===1,
     `A=${vs.HPEER.phoneA.slot} B=${vs.HPEER.phoneB.slot}`);

  const answers=vs.published.filter(o=>o.type==='answer');
  ck('an answer was published for each phone', answers.length===2, `${answers.length} answers`);
  ck('every answer is addressed to one phone', answers.every(a=>!!a.cid),
     answers.map(a=>a.cid).join(','));
  ck('the two answers went to different phones',
     answers.length===2 && answers[0].cid!==answers[1].cid);

  /* The real payoff: player 2's phone must drive BLADE2, not BLADE. */
  vs.applied.length=0;
  const chA={}, chB={};
  vs.HPEER.phoneA.pc.ondatachannel({channel:chA});
  vs.HPEER.phoneB.pc.ondatachannel({channel:chB});
  chA.onmessage({data:JSON.stringify({g:10,b:40,seq:1})});
  chB.onmessage({data:JSON.stringify({g:-10,b:50,seq:1})});
  ck('player 1\'s direct channel drives slot 0',
     vs.applied[0] && vs.applied[0].slot===0, `slot ${vs.applied[0]&&vs.applied[0].slot}`);
  ck('player 2\'s direct channel drives slot 1',
     vs.applied[1] && vs.applied[1].slot===1, `slot ${vs.applied[1]&&vs.applied[1].slot}`);
  ck('the direct channel is not treated as the relay',
     vs.applied.every(a=>a.relay===false));

  console.log('\n--- 9. a third phone is refused, and never gets a peer ---');
  const before=FakeRTC.made.length;
  vs.hostAnswer('phoneC', {type:'offer',sdp:'C'});
  ck('no peer connection is built for it', FakeRTC.made.length===before);
  ck('it is not recorded', !vs.HPEER.phoneC);

  console.log('\n--- 10. a fresh room closes the old peers ---');
  const oldA=vs.HPEER.phoneA.pc, oldB=vs.HPEER.phoneB.pc;
  vs.remReset();
  ck('both connections were closed', oldA.closed && oldB.closed);
  ck('no peers are carried into the new room', Object.keys(vs.HPEER).length===0,
     `${Object.keys(vs.HPEER).length} left`);

  console.log('\n'+(pass?'ALL PASS':'FAILURES PRESENT'));
  process.exit(pass?0:1);
});

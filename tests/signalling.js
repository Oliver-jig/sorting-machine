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

/* ---- host side: run the REAL helper block out of js/game.js ---- */
const A=gameSrc.indexOf('var hostIceQ=[]');
const endMark='  for(var i=0;i<q.length;i++) hostAddIce(q[i]);\n}';
const B=gameSrc.indexOf(endMark);
ck('found the host ICE helpers in js/game.js', A>=0 && B>A);
const hostBlock=gameSrc.slice(A, B+endMark.length);

const hostCtx={ console, Promise, Error };
vm.createContext(hostCtx);
vm.runInContext('var hostPC=null;\n'+hostBlock, hostCtx);

console.log('--- 1. HOST: candidates that arrive before the offer ---');
hostCtx.hostPC=null;                                   /* offer not seen yet */
hostCtx.hostRemoteSet=false; hostCtx.hostIceQ.length=0;
hostCtx.hostAddIce('c1'); hostCtx.hostAddIce('c2');
ck('nothing is thrown away while hostPC is null', hostCtx.hostIceQ.length===2,
   `${hostCtx.hostIceQ.length} queued`);
const hpc=fakePC(); hostCtx.hostPC=hpc;
hostCtx.hostAddIce('c3');                              /* pc exists, remote not set yet */
ck('still queued until the remote description lands', hostCtx.hostIceQ.length===3,
   `${hostCtx.hostIceQ.length} queued`);
hpc.remote=true; hostCtx.hostFlushIce();
ck('every candidate is delivered once the offer is applied',
   hpc.added.join(',')==='c1,c2,c3', `added [${hpc.added.join(',')}]`);
ck('none were rejected', hpc.rejected.length===0, `${hpc.rejected.length} rejected`);
ck('the queue is empty afterwards', hostCtx.hostIceQ.length===0);

console.log('\n--- 2. HOST: candidates arriving after the handshake go straight through ---');
hostCtx.hostAddIce('c4');
ck('delivered immediately, not queued',
   hpc.added.length===4 && hostCtx.hostIceQ.length===0, `added [${hpc.added.join(',')}]`);

console.log('\n--- 3. HOST: flushing with no peer connection must not hang ---');
hostCtx.hostPC=null; hostCtx.hostRemoteSet=false; hostCtx.hostIceQ.length=0;
hostCtx.hostAddIce('x1'); hostCtx.hostAddIce('x2');
const t0=Date.now(); hostCtx.hostFlushIce();
ck('flush returns instead of looping forever', Date.now()-t0<1000, `${Date.now()-t0}ms`);
ck('the candidates are re-queued, not lost', hostCtx.hostIceQ.length===2,
   `${hostCtx.hostIceQ.length} queued`);

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

console.log('\n'+(pass?'ALL PASS':'FAILURES PRESENT'));
process.exit(pass?0:1);

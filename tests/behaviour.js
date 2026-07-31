/* Behavioural checks against the real js/mode-defend.js */
const fs=require('fs'), vm=require('vm');
const R=require('path').join(__dirname,'..')+'/';
function ctxFor(W,H){
  const ctx={ console, Math, JSON, W, H,
    G:{objs:[],pops:[],parts:[],flashes:[],paused:false},
    BLADE:{x:W/2,y:0,px:0,py:0,active:true,trail:[]},
    scene:{add(){},remove(){}},
    makeSprite:()=>({position:{set(){}},rotation:{set(){}},scale:{setScalar(){}},material:{}}),
    toWorld:(x,y)=>({x,y}),
    el:()=>({textContent:"",innerHTML:"",style:{},classList:{add(){},remove(){}}}),
    show(){}, resize(){}, clearObjs(){ ctx.G.objs=[]; },
    spawnBurst(){}, drawHeart(){}, fxRR(){}, stopCam(){}, scoresRecord(){},
    setupCam(){}, setupMouse(){}, hx:n=>"#"+n.toString(16), setRoundLbl(){}, setTopic(){},
    fxc:new Proxy({},{get:()=>()=>{},set:()=>true}),
    rr(){}, fillIt(){}, outline(){}, cjk(){}, OL:"#000", OLW:5, ART:{},
    controlMode:"mouse", GMODE:"tsunami", FACTS:[],
    QBINS:{paper:{n:"Paper",c:"#1"},plastic:{n:"Plastic",c:"#2"},metal:{n:"Metal",c:"#3"},
           glass:{n:"Glass",c:"#4"},trash:{n:"General",c:"#5"}} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(R+'js/items.js','utf8').replace(/var ART=\{[\s\S]*\n\};/,''), ctx);
  vm.runInContext('var ITEMBYT={}; ITEMS.forEach(function(it){ITEMBYT[it.t]=it;});', ctx);
  vm.runInContext(fs.readFileSync(R+'js/mode-defend.js','utf8'), ctx);
  return ctx;
}
let pass=true;
const ck=(n,c,d)=>{ if(!c)pass=false; console.log(`${c?'PASS':'FAIL'}  ${n}${d?'  '+d:''}`); };

// 1. missed correct item costs exactly one life
{ const c=ctxFor(1280,682); c.launchTsunami(); c.tsunamiBegin();
  const it=c.ITEMS.find(i=>i.bin===c.TS.target);
  c.G.objs.length=0;
  c.G.objs.push({it, x:100, y:-40, y0:-40, r:45, land:c.TS.elapsed+100, born:c.TS.elapsed,
                 correct:true, a:1, scale:1, spin:0, dspin:0, phase:0,
                 mesh:{position:{set(){}},rotation:{set(){}},scale:{setScalar(){}},material:{}}});
  c.BLADE.x=1200;                                     // bin far away -> must miss
  const before=c.TS.lives;
  for(let i=0;i<20;i++) c.tsunamiUpdate(16.7, i*16.7);
  ck("missed correct item costs 1 life", c.TS.lives===before-1, `${before}->${c.TS.lives}`);
}
// 2. caught wrong item costs exactly one life
{ const c=ctxFor(1280,682); c.launchTsunami(); c.tsunamiBegin();
  const it=c.ITEMS.find(i=>i.bin!==c.TS.target);
  c.G.objs.length=0;
  c.G.objs.push({it, x:640, y:-40, y0:-40, r:45, land:c.TS.elapsed+100, born:c.TS.elapsed,
                 correct:false, a:1, scale:1, spin:0, dspin:0, phase:0,
                 mesh:{position:{set(){}},rotation:{set(){}},scale:{setScalar(){}},material:{}}});
  c.BLADE.x=640;                                      // bin right under it -> catches it
  const before=c.TS.lives;
  for(let i=0;i<20;i++) c.tsunamiUpdate(16.7, i*16.7);
  ck("caught wrong item costs 1 life", c.TS.lives===before-1, `${before}->${c.TS.lives}`);
}
// 3. dodged wrong item is free
{ const c=ctxFor(1280,682); c.launchTsunami(); c.tsunamiBegin();
  const it=c.ITEMS.find(i=>i.bin!==c.TS.target);
  c.G.objs.length=0;
  c.G.objs.push({it, x:100, y:-40, y0:-40, r:45, land:c.TS.elapsed+100, born:c.TS.elapsed,
                 correct:false, a:1, scale:1, spin:0, dspin:0, phase:0,
                 mesh:{position:{set(){}},rotation:{set(){}},scale:{setScalar(){}},material:{}}});
  c.BLADE.x=1200;
  const before=c.TS.lives;
  for(let i=0;i<20;i++) c.tsunamiUpdate(16.7, i*16.7);
  ck("dodged wrong item is free", c.TS.lives===before, `lives ${c.TS.lives}`);
}
// 4. caught correct item scores and costs nothing
{ const c=ctxFor(1280,682); c.launchTsunami(); c.tsunamiBegin();
  const it=c.ITEMS.find(i=>i.bin===c.TS.target);
  c.G.objs.length=0;
  c.G.objs.push({it, x:640, y:-40, y0:-40, r:45, land:c.TS.elapsed+100, born:c.TS.elapsed,
                 correct:true, a:1, scale:1, spin:0, dspin:0, phase:0,
                 mesh:{position:{set(){}},rotation:{set(){}},scale:{setScalar(){}},material:{}}});
  c.BLADE.x=640;
  for(let i=0;i<20;i++) c.tsunamiUpdate(16.7, i*16.7);
  ck("caught correct item scores", c.TS.score>0 && c.TS.lives===3, `score ${c.TS.score} lives ${c.TS.lives}`);
}
// 5. three strikes ends the run
{ const c=ctxFor(1280,682); c.launchTsunami(); c.tsunamiBegin();
  const it=c.ITEMS.find(i=>i.bin===c.TS.target);
  for(let k=0;k<3;k++){
    c.G.objs.length=0;
    c.G.objs.push({it, x:100, y:-40, y0:-40, r:45, land:c.TS.elapsed+50, born:c.TS.elapsed,
                   correct:true, a:1, scale:1, spin:0, dspin:0, phase:0,
                   mesh:{position:{set(){}},rotation:{set(){}},scale:{setScalar(){}},material:{}}});
    c.BLADE.x=1200;
    for(let i=0;i<10 && c.TS.running;i++) c.tsunamiUpdate(16.7,i*16.7);
  }
  ck("three strikes ends the run", c.TS.running===false && c.TS.lives<=0, `lives ${c.TS.lives} running ${c.TS.running}`);
}
// 6. the screen has drained by the time the target switches
{ const c=ctxFor(1280,682); c.launchTsunami(); c.tsunamiBegin();
  let s=12345; c.Math.random=()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; };
  let worst=0, switches=0, prevTarget=c.TS.target;
  for(let t=0;t<180000;t+=16.7){
    c.TS.lives=3;                                   // keep alive
    c.tsunamiUpdate(16.7,t);
    if(c.TS.target!==prevTarget){
      switches++;
      // Only items spawned BEFORE this switch are stale. An item born on the
      // switch frame itself belongs to the NEW target and is perfectly valid.
      const stale=c.G.objs.filter(o=>!o.special && o.born < c.TS.elapsed-1).length;
      worst=Math.max(worst,stale); prevTarget=c.TS.target;
    }
  }
  ck("no items in flight when the target switches", worst===0,
     `${switches} switches, worst leftover ${worst}`);
}
// 7. bin stays on screen at the edges
{ const c=ctxFor(1280,682); c.launchTsunami(); c.tsunamiBegin();
  c.BLADE.x=-500; c.tsunamiUpdate(16.7,0); const lo=c.TS.binX;
  c.BLADE.x=9999; c.tsunamiUpdate(16.7,16.7); const hi=c.TS.binX;
  ck("bin clamps to the screen", lo>=75 && hi<=1280-75, `left ${lo.toFixed(0)} right ${hi.toFixed(0)}`);
}
// 8. traps get more common later
{ const c=ctxFor(1280,682); c.launchTsunami(); c.tsunamiBegin();
  c.TS.elapsed=0;   const early=c.dTrapBias();
  c.TS.elapsed=120000; const late=c.dTrapBias();
  ck("trap bias rises over a run", late>early*2, `${early.toFixed(2)} -> ${late.toFixed(2)}`);
}
console.log('\n'+(pass?'ALL PASS':'FAILURES PRESENT'));
process.exit(pass?0:1);

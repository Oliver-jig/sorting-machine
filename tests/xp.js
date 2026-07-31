/* Checks the XP curve and unlock pacing against the real js/blades.js */
const fs=require('fs'), vm=require('vm');
const R=require('path').join(__dirname,'..')+'/';
let RUNS=[], STORE={};
const ctx={ console, Math, JSON, parseInt,
  localStorage:{ getItem:k=>(k in STORE?STORE[k]:null), setItem:(k,v)=>{STORE[k]=String(v);} },
  getRuns:()=>RUNS, drawTrail(){}, show(){},
  /* enough DOM for blades.js to load; the UI itself is checked in the browser */
  document:{ addEventListener(){}, getElementById:()=>null,
             querySelectorAll:()=>[], createElement:()=>({style:{},classList:{add(){},remove(){}},
               appendChild(){}, addEventListener(){}, setAttribute(){},
               getContext:()=>new Proxy({},{get:()=>()=>{},set:()=>true}) }) } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(R+'js/blades.js','utf8'), ctx);

let pass=true;
const ck=(n,c,d)=>{ if(!c)pass=false; console.log(`${c?'PASS':'FAIL'}  ${n}${d?'  '+d:''}`); };
const reset=()=>{ RUNS=[]; STORE={}; };

// 1. a good run in each mode is worth comparable XP
console.log('--- 1. per-mode XP for a good run (target ~100 each) ---');
const good={sort:300, quiz:2000, tsunami:300};
const xps={};
for(const m of ['sort','quiz','tsunami']){
  reset(); RUNS=[{m, s:good[m]}];
  xps[m]=ctx.bladeXP();
  console.log(`    ${m.padEnd(8)} score ${String(good[m]).padStart(4)} -> ${xps[m]} XP`);
}
const vals=Object.values(xps), spread=Math.max(...vals)/Math.min(...vals);
ck('no mode is worth more than 1.5x another', spread<1.5, `spread ${spread.toFixed(2)}x`);

// 2. first unlock must arrive fast
console.log('\n--- 2. runs needed to reach each level (playing Bin It, good runs) ---');
let hit={}, seen=[], skipped=[];
for(let run=1; run<=60; run++){
  reset();
  RUNS=Array.from({length:run},()=>({m:'tsunami', s:300}));
  const lv=ctx.bladeLevel();
  for(let L=1;L<=lv;L++) if(!hit[L]) hit[L]=run;   // reaching lv unlocks everything up to it
  if(seen.length && lv>seen[seen.length-1]+1) skipped.push(seen[seen.length-1]+'->'+lv);
  if(!seen.length||lv!==seen[seen.length-1]) seen.push(lv);
}
console.log('    level after each run: '+seen.join(','));
ck('no level is skipped as XP accrues', skipped.length===0, skipped.join(' '));
ctx.BLADES.forEach(b=>console.log(`    blade ${b.zh} ${b.n} (Lv ${b.lvl}) at run ${hit[b.lvl]}`));
// blades now sit on every SECOND level
const bladeLvls=ctx.BLADES.map(b=>b.lvl);
ck('first NEW blade (level 3) within 2 runs', hit[3]<=2, `run ${hit[3]}`);
ck('second new blade (level 5) within 6 runs', hit[5]<=6, `run ${hit[5]}`);
const topLvl=ctx.LEVELXP.length;
ck('max level reachable but a grind', hit[topLvl]>=20 && hit[topLvl]<=60, `run ${hit[topLvl]}`);

// 3. gaps must widen (fast early, slower later)
console.log('\n--- 3. gap between levels widens ---');
const gaps=[]; for(let i=1;i<ctx.LEVELXP.length;i++) gaps.push(ctx.LEVELXP[i]-ctx.LEVELXP[i-1]);
console.log('    '+gaps.join(' -> '));
ck('every gap is >= the one before', gaps.every((g,i)=>i===0||g>=gaps[i-1]));

// 4. negative and versus runs contribute nothing
console.log('\n--- 4. what does not count ---');
reset(); RUNS=[{m:'sort',s:-500},{m:'vs',s:9999},{m:'sort',s:0}];
ck('negative scores and versus give 0 XP', ctx.bladeXP()===0, `${ctx.bladeXP()} XP`);

// 5. locked blades cannot be selected
console.log('\n--- 5. lock enforcement ---');
reset();  // level 1
const locked=ctx.BLADES.filter(b=>b.lvl>1);
let blocked=0;
locked.forEach(b=>{ if(ctx.bladeSelect(b.id)===false) blocked++; });
ck('all higher-level blades refuse selection at level 1', blocked===locked.length,
   `${blocked}/${locked.length}`);
ck('selected id falls back to classic', ctx.bladeSelectedId()==='classic', ctx.bladeSelectedId());
ck('the level-1 blade can be selected', ctx.bladeSelect('classic')===true);

// 6. a blade already chosen then locked again falls back rather than drawing
reset(); STORE['ss3d.blade']='gold';
ck('stale selection above your level falls back', ctx.bladeSelectedId()==='classic', ctx.bladeSelectedId());

// 7. server floor never demotes, never drags down
console.log('\n--- 6. server floor is monotonic ---');
reset(); RUNS=[{m:'tsunami',s:300}];
const localXp=ctx.bladeXP();
ctx.bladeSetXPFloor(5000);
ck('a higher server value raises XP', ctx.bladeXP()===5000, `${localXp} -> ${ctx.bladeXP()}`);
ctx.bladeSetXPFloor(10);
ck('a lower server value cannot lower it', ctx.bladeXP()===5000, `${ctx.bladeXP()}`);
RUNS=Array.from({length:100},()=>({m:'quiz',s:2000}));
ck('local progress beyond the floor still counts', ctx.bladeXP()>5000, `${ctx.bladeXP()}`);

// 8. blade roster sanity
console.log('\n--- 7. roster ---');
const lvls=ctx.BLADES.map(b=>b.lvl);
ck('a blade every second level, starting at 1',
   JSON.stringify(lvls)===JSON.stringify([1,3,5,7,9,11,13,15]), lvls.join(','));
ck('the last blade is at the max level', lvls[lvls.length-1]===ctx.LEVELXP.length,
   `blade ${lvls[lvls.length-1]}, max ${ctx.LEVELXP.length}`);
ck('no blade sits above the max level', lvls.every(l=>l<=ctx.LEVELXP.length));
const ids=ctx.BLADES.map(b=>b.id);
ck('ids unique', new Set(ids).size===ids.length);
ck('every blade has a description', ctx.BLADES.every(b=>b.d&&b.d.length>5));
ck('non-cycling blades all define a glow colour',
   ctx.BLADES.every(b=>b.cycle||b.glow));
ck('every blade defines a core colour', ctx.BLADES.every(b=>b.core));
// the glow (the wide, visible pass) must differ between blades, or picking is pointless
const glows=ctx.BLADES.filter(b=>b.glow).map(b=>b.glow);
ck('every glow colour is distinct', new Set(glows).size===glows.length,
   `${new Set(glows).size}/${glows.length}`);

// 8b. feel fields: life, sparkle, and the cosmetic-only guarantee
console.log('\n--- 8b. feel fields ---');
ctx.BLADES.forEach(b=>console.log(
  `    ${b.id.padEnd(8)} life=${String(b.life).padStart(3)}ms  w=${b.w.toFixed(2)}  sparkle=${b.sparkle||0}`));
ck('every blade defines life', ctx.BLADES.every(b=>typeof b.life==='number'));
ck('life is in a sane range (80-220ms)', ctx.BLADES.every(b=>b.life>=80&&b.life<=220),
   ctx.BLADES.map(b=>b.life).join(','));
ck('sparkle is a non-negative integer when present',
   ctx.BLADES.every(b=>b.sparkle===undefined||(Number.isInteger(b.sparkle)&&b.sparkle>=0)));
// the descriptions promise specific feels - check the data actually delivers them
const by=id=>ctx.BLADES.find(b=>b.id===id);
ck('Sunset ("see where you have been") outlives Classic', by('sunset').life>by('classic').life,
   `${by('sunset').life} vs ${by('classic').life}`);
ck('Leaf ("thin and quick") is thinner AND shorter-lived than Classic',
   by('leaf').w<by('classic').w && by('leaf').life<by('classic').life,
   `w ${by('leaf').w} life ${by('leaf').life}`);
ck('Ice is the narrowest blade, as its text claims',
   ctx.BLADES.every(b=>b.id==='ice'||b.w>=by('ice').w), 'ice w='+by('ice').w);
const ws=ctx.BLADES.map(b=>b.w);
ck('width spread is wide enough to notice', Math.max(...ws)/Math.min(...ws)>1.6,
   `${Math.min(...ws)}-${Math.max(...ws)} = ${(Math.max(...ws)/Math.min(...ws)).toFixed(2)}x`);

// THE GUARANTEE: no blade may carry a field that could change how the game plays.
const BANNED=['score','mult','multiplier','reach','radius','r','lives','speed','vmax',
              'points','bonus','power','dur','gravity','slow','freeze','magnet'];
const offenders=[];
ctx.BLADES.forEach(b=>Object.keys(b).forEach(k=>{
  if(BANNED.indexOf(k.toLowerCase())>=0) offenders.push(b.id+'.'+k);
}));
ck('NO blade defines a gameplay-affecting field', offenders.length===0, offenders.join(' '));
const ALLOWED=['id','n','zh','lvl','glow','core','w','life','d','cycle','sparkle'];
const unknown=[];
ctx.BLADES.forEach(b=>Object.keys(b).forEach(k=>{ if(ALLOWED.indexOf(k)<0) unknown.push(b.id+'.'+k); }));
ck('no unrecognised fields (catches a new one slipping in)', unknown.length===0, unknown.join(' '));

// bladeStroke must not throw for any blade, locked stub included
console.log('\n--- 8c. renderer ---');
const fakeCtx=new Proxy({},{get:(t,k)=>k==='beginPath'||k==='moveTo'||k==='lineTo'||
  k==='stroke'||k==='arc'||k==='fill'||k==='clearRect'?()=>{}:undefined, set:()=>true});
const pts=Array.from({length:20},(_,i)=>({x:i*15,y:100+Math.sin(i)*20}));
let threw=[];
ctx.BLADES.forEach(b=>{ try{ ctx.bladeStroke(fakeCtx,pts,b,3,1); }catch(e){ threw.push(b.id+': '+e.message); } });
try{ ctx.bladeStroke(fakeCtx,pts,{glow:"1,2,3",core:"4,5,6",w:1,sparkle:9},3,0.72); }
catch(e){ threw.push('locked-stub: '+e.message); }
ck('bladeStroke runs for all 8 blades and the locked stub', threw.length===0, threw.join(' | '));
ck('it survives a degenerate 1-point trail',
   (function(){ try{ ctx.bladeStroke(fakeCtx,[{x:0,y:0}],by('gold'),0,1); return true; }catch(e){ return false; } })());

// 9. disco hues never repeat back to back
console.log('\n--- 8. disco ---');
const hues=[]; for(let i=0;i<12;i++) hues.push(ctx.bladeHue(i));
ck('consecutive swipes differ', hues.every((h,i)=>i===0||h!==hues[i-1]));
ck('12 swipes give 12 distinct colours', new Set(hues).size===12, `${new Set(hues).size} distinct`);

console.log('\n'+(pass?'ALL PASS':'FAILURES PRESENT'));
process.exit(pass?0:1);

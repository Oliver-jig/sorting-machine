/* Guards the per-frame cost of the render loop.

   None of this measures wall-clock speed — that varies by machine and would
   make a flaky test. It asserts the STRUCTURAL properties that made the game
   get slower the longer you played. */
const fs=require('fs'), vm=require('vm');
const R=require('path').join(__dirname,'..')+'/';
const game=fs.readFileSync(R+'js/game.js','utf8');
const defend=fs.readFileSync(R+'js/mode-defend.js','utf8');
const decomment=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
const gameCode=decomment(game), defendCode=decomment(defend);

let pass=true;
const ck=(n,c,d)=>{ if(!c)pass=false; console.log(`${c?'PASS':'FAIL'}  ${n}${d?'  '+d:''}`); };

/* ---- 1. spawned materials must be released ---------------------------------
   makeSprite() allocates a material per spawn (each item fades independently),
   and three.js holds GPU state for every material until dispose() is called.
   Nothing disposed them, so they accumulated across rounds and replays. */
console.log('--- 1. every retired item releases its material ---');
ck('releaseObj exists and disposes the material',
   /function releaseObj\(o\)\{[\s\S]{0,220}?material\.dispose\(\)/.test(gameCode));
/* Every removal must go through it. A bare scene.remove() is the leak. */
const bare=[];
[['js/game.js',gameCode],['js/mode-defend.js',defendCode]].forEach(([f,src])=>{
  src.split('\n').forEach((ln,i)=>{
    if(/scene\.remove\(o\.mesh\)/.test(ln) && !/function releaseObj/.test(src.split('\n')[i-1]||'')
       && !/releaseObj/.test(ln)) {
      /* the one inside releaseObj itself is the legitimate call */
      if(!/^\s*scene\.remove\(o\.mesh\);\s*$/.test(ln)) bare.push(f+':'+(i+1));
    }
  });
});
ck('no item is removed without releasing it', bare.length===0, bare.join(' '));
ck('the shared geometry is never disposed', !/SPRITE_GEO\.dispose/.test(gameCode));
ck('cached textures are never disposed', !/TEXCACHE\[[^\]]*\]\.dispose/.test(gameCode));

/* ---- 2. pixel budget -------------------------------------------------------
   Cost scales with pixel COUNT. A flat min(1.5,dpr) made a big display pay 3x a
   laptop for the same game. */
console.log('\n--- 2. resolution is budgeted by pixel count, not a flat ratio ---');
const a=gameCode.indexOf('var PIXBUDGET'), b=gameCode.indexOf('function resize()');
const c={ window:{devicePixelRatio:2}, Math };
vm.createContext(c); vm.runInContext(gameCode.slice(a,b), c);
const px=(w,h)=>{ const d=c.dprFor(w,h); return {d, mp:(w*h*d*d)/1e6}; };
const OLDMP=(w,h)=>(w*h*Math.min(1.5,2)**2)/1e6;
for(const [w,h] of [[900,600],[1280,720],[1750,1180],[2400,1400]]){
  const n=px(w,h), o=OLDMP(w,h);
  console.log(`    ${String(w)}x${h}:  dpr ${n.d.toFixed(2)}  ${n.mp.toFixed(2)}MP   (was 1.50 / ${o.toFixed(2)}MP)`);
  /* The budget binds UNLESS the 1.0 floor does: below 1.0 text and the blade go
     visibly soft, so a huge stage is allowed to exceed the budget rather than
     look broken. That is a deliberate trade, not a miss. */
  ck(`${w}x${h} is within the pixel budget, or held at the 1.0 floor`,
     n.mp<=2.61 || Math.abs(n.d-1)<1e-9, `${n.mp.toFixed(2)}MP at dpr ${n.d.toFixed(2)}`);
}
ck('a laptop-sized window is unchanged at full 1.5', Math.abs(px(1280,720).d-1.5)<1e-9);
ck('resolution never drops below 1.0', px(4000,2400).d>=1);
ck('a big stage really is cheaper than before',
   px(1750,1180).mp < OLDMP(1750,1180)*0.7,
   `${px(1750,1180).mp.toFixed(2)}MP vs ${OLDMP(1750,1180).toFixed(2)}MP`);

/* ---- 3. per-frame text layout ---------------------------------------------- */
console.log('\n--- 3. item labels do not re-layout every frame ---');
ck('label widths are cached by string', /LBLW\[txt\]/.test(gameCode));
ck('measureText runs only on a cache miss',
   /w===undefined\)\{[\s\S]{0,60}?measureText/.test(gameCode));
/* Caching the font was tried and is wrong — other draws set fxc.font mid-frame. */
ck('the font is still set unconditionally',
   /function roundedText\([^)]*\)\{\s*fxc\.font=/.test(gameCode));

/* ---- 4. the fps meter must cost nothing when off --------------------------- */
console.log('\n--- 4. the fps meter is opt-in ---');
ck('fps meter is off unless ?fps=1', /SHOWFPS=qs\.get\("fps"\)==="1"/.test(gameCode));
ck('no timing work when it is off', /SHOWFPS\?performance\.now\(\):0/.test(gameCode));
ck('the meter cannot break the loop', /try\{ fpsTick[\s\S]{0,40}?catch/.test(gameCode));

console.log('\n'+(pass?'ALL PASS':'FAILURES PRESENT'));
process.exit(pass?0:1);

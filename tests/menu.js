/* The control picker must not offer a control the chosen mode cannot use.

   Versus drives two blades from two webcam hands or two phones. A mouse gives
   one cursor. Offering it there read as "this works", and worse: launchVS()
   routed `else setupCamVS()`, so Mouse + Versus silently started the CAMERA and
   a denied permission bounced the player back to the menu. */
const fs=require('fs'), vm=require('vm');
const R=require('path').join(__dirname,'..')+'/';
const src=fs.readFileSync(R+'js/game.js','utf8');
const css=fs.readFileSync(R+'css/styles.css','utf8');
const decomment=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
const code=decomment(src);

let pass=true;
const ck=(n,c,d)=>{ if(!c)pass=false; console.log(`${c?'PASS':'FAIL'}  ${n}${d?'  '+d:''}`); };

/* Load just the picker block, with a DOM stub standing in for the three tiles. */
const a=src.indexOf('function selectControl(mode)'), b=src.indexOf('\n/* Segmented controls delegate');
function build(startMode, startControl){
  const opts=["cam","remote","mouse"].map(m=>{
    const cls=new Set(["opt"]);
    return { dataset:{mode:m}, disabled:false, _cls:cls, _aria:"false",
      classList:{ add:c=>cls.add(c), remove:c=>cls.delete(c),
                  toggle:(c,on)=>{ on?cls.add(c):cls.delete(c); },
                  contains:c=>cls.has(c) },
      setAttribute(k,v){ if(k==="aria-pressed") this._aria=v; },
      addEventListener(){} };
  });
  const chooseCls=new Set();
  const ctx={ console, GMODE:startMode, controlMode:startControl,
    document:{ querySelectorAll:()=>opts },
    el:id=>id==="choose" ? { classList:{ toggle:(c,on)=>{ on?chooseCls.add(c):chooseCls.delete(c); },
                                         contains:c=>chooseCls.has(c) } } : null };
  vm.createContext(ctx);
  vm.runInContext(src.slice(a,b), ctx);
  return {ctx, opts, chooseCls,
    visible:()=>opts.filter(o=>!o._cls.has("hidden")).map(o=>o.dataset.mode),
    selected:()=>opts.filter(o=>o._cls.has("sel")).map(o=>o.dataset.mode)};
}

console.log('--- 1. which controls each mode offers ---');
{ const t=build("sort","cam");
  ck('controlsFor("sort") offers all three',
     t.ctx.controlsFor("sort").join()==="cam,remote,mouse");
  ck('controlsFor("quiz") offers all three',
     t.ctx.controlsFor("quiz").join()==="cam,remote,mouse");
  ck('controlsFor("tsunami") offers all three',
     t.ctx.controlsFor("tsunami").join()==="cam,remote,mouse");
  ck('controlsFor("vs") does NOT offer mouse',
     t.ctx.controlsFor("vs").indexOf("mouse")<0, t.ctx.controlsFor("vs").join());
}

console.log('\n--- 2. selecting Versus hides Mouse ---');
{ const t=build("vs","cam"); t.ctx.syncControls();
  console.log('    visible tiles: '+t.visible().join(', '));
  ck('only webcam and phone are shown', t.visible().join()==="cam,remote");
  ck('the mouse tile is disabled too, not just hidden',
     t.opts.find(o=>o.dataset.mode==="mouse").disabled===true);
}

console.log('\n--- 3. THE BUG: a stale mouse selection must not survive ---');
/* Hiding the tile while controlMode stayed "mouse" is what made launchVS()
   start the camera behind the player's back. */
{ const t=build("vs","mouse"); t.ctx.syncControls();
  console.log(`    controlMode "mouse" + Versus -> "${t.ctx.controlMode}"`);
  ck('controlMode is moved off mouse', t.ctx.controlMode!=="mouse");
  ck('and lands on a control Versus can actually use',
     t.ctx.controlsFor("vs").indexOf(t.ctx.controlMode)>=0, t.ctx.controlMode);
  ck('the highlight follows it', t.selected().join()===t.ctx.controlMode);
  ck('aria-pressed follows it too',
     t.opts.find(o=>o.dataset.mode===t.ctx.controlMode)._aria==="true");
}

console.log('\n--- 4. leaving Versus restores Mouse ---');
{ const t=build("vs","mouse"); t.ctx.syncControls();
  t.ctx.GMODE="sort"; t.ctx.syncControls();
  console.log('    visible tiles: '+t.visible().join(', '));
  ck('all three tiles are back', t.visible().join()==="cam,remote,mouse");
  ck('the mouse tile is enabled again',
     t.opts.find(o=>o.dataset.mode==="mouse").disabled===false);
}

console.log('\n--- 5. the picker is kept in step ---');
ck('changing mode re-syncs the picker',
   /segDelegate\("modeSeg", function\(b\)\{ GMODE=b\.dataset\.g; syncControls\(\); \}\)/.test(code));
ck('and it runs once at startup', /\nsyncControls\(\);/.test(code));

console.log('\n--- 6. launchVS must not fall through to the camera ---');
const vs=code.slice(code.indexOf('function launchVS()'), code.indexOf('function vsSpawn'));
ck('the camera is started only for controlMode "cam"',
   /else if\(controlMode==="cam"\)\{ setupCamVS\(\); \}/.test(vs));
ck('no bare else reaches setupCamVS', !/else setupCamVS\(\)/.test(vs));
ck('an unsupported mode returns to the menu instead of prompting for a camera',
   /show\("start"\)/.test(vs) && /return;/.test(vs));

/* The 3-up control grid and its `.choose.twoUp` 3->2 reflow both went with the
   V6 menu, which lists controls vertically — hiding the Mouse tile now just
   removes a row. The rule and its assertions are retired together; a leftover
   .twoUp would be dead CSS claiming a layout that no longer exists. */
console.log('\n--- 7. the retired two-column reflow ---');
ck('no .choose.twoUp rule survives in the stylesheet', !/twoUp/.test(css));
ck('and syncControls no longer toggles it', !/twoUp/.test(code));
ck('controls are a vertical list in the V6 menu',
   /\.choose\.v6-controls\{display:grid; grid-template-columns:1fr/.test(css));

/* ---- 8. the re-skin must not break what the code reaches for ---- */
/* The tiles are a VIEW of GMODE/DIFF. segDelegate only paints on a click, but
   the launchers assign GMODE in code, so after a round the menu could show Sort
   highlighted while the header read "Versus selected". */
console.log('\n--- 7b. tiles are painted from state, not from the last click ---');
{ const t=build("vs","cam");
  let painted=null;
  t.ctx.el=id=>id==="modeSeg" ? {querySelectorAll:()=>[
      {dataset:{g:"sort"},classList:{toggle:(c,on)=>{if(on)painted="sort";}},setAttribute(){}},
      {dataset:{g:"vs"},  classList:{toggle:(c,on)=>{if(on)painted="vs";}},  setAttribute(){}}]}
    : {classList:{toggle(){},contains:()=>false}, querySelectorAll:()=>[]};
  t.ctx.DIFFS={}; t.ctx.DIFF=null;
  t.ctx.syncControls();
  ck('the tile matching GMODE is the one highlighted', painted==="vs", `painted ${painted}`);
}
ck('syncControls paints the segmented tiles', /paintSegs\(\)/.test(code));
ck('and returning to the menu re-syncs', /syncControls\(\);\s*\/\* GMODE may have changed/.test(src));

console.log('\n--- 8. V6 re-skin guards ---');
const html=fs.readFileSync(R+'index.html','utf8');
const ctrl=fs.readFileSync(R+'controller.html','utf8');
/* Scan CODE, not prose. These files EXPLAIN in comments why color-mix, oklch
   and the lucide CDN are avoided, and matching those words inside their own
   rationale is a false positive that fails a correct change. This is the third
   time that has bitten in this repo — strip comments before every source scan. */
const cssCode=css.replace(/\/\*[\s\S]*?\*\//g,'');
const htmlCode=html.replace(/<!--[\s\S]*?-->/g,'');
const ctrlCode=ctrl.replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'');
/* A large markup rewrite silently dropping one of these is the obvious failure
   mode. #startNote is the worst of them: it is also the surface bootFail() and
   the Versus refusal write to. */
['modeSeg','choose','diffSeg','playBtn','bladesBtn','startBest','lvlBar','startNote',
 'v6Selection','v6Versus'].forEach(id=>{
  ck(`#${id} still exists in index.html`, html.includes('id="'+id+'"'));
});
ck('the mode buttons still carry data-g',
   ['sort','quiz','tsunami','vs'].every(g=>html.includes('data-g="'+g+'"')));
ck('the control tiles still carry .opt and data-mode',
   ['cam','remote','mouse'].every(m=>html.includes('data-mode="'+m+'"')) &&
   (html.match(/class="opt /g)||[]).length===3);
ck('the difficulty buttons still carry data-d',
   html.includes('data-d="relaxed"') && html.includes('data-d="normal"'));
/* The V6 mode tiles carry aria-pressed and segDelegate did not move it, so the
   selected tile reported aria-pressed="false" — the opposite of what was drawn. */
ck('segDelegate moves aria-pressed with the .on class',
   /t\.setAttribute\("aria-pressed","false"\)/.test(code) &&
   /b\.setAttribute\("aria-pressed","true"\)/.test(code));
/* The mockup leaned on color-mix() 37 times. This file bans oklch() for the
   same reason — a silent colour failure on a school machine. */
ck('no color-mix() shipped in the stylesheet', !/color-mix\(/.test(cssCode));
ck('no light-dark() shipped in the stylesheet', !/light-dark\(/.test(cssCode));
ck('no oklch() shipped in the stylesheet', !/oklch\(/.test(cssCode));
ck('controller.html stays free of them too',
   !/color-mix\(|light-dark\(|oklch\(/.test(ctrlCode));
/* Icons are the inline sprite, not the mockup's CDN. */
ck('no lucide/unpkg script reference', !/lucide|unpkg\.com/.test(htmlCode));
ck('the inline icon sprite is present', /<symbol id="i-check"/.test(html));
/* The mockup inlined a 1.26MB base64 PNG; it is an external cached file now. */
ck('no base64 image payload inlined', !/data:image\/[a-z]+;base64/.test(htmlCode));
ck('the decorative image is an external asset', /src="img\/props\.png"/.test(html));
/* Blades are chosen on the #blades screen only — the home page must not grow a
   second picker that could disagree with it. */
ck('no blade picker on the home page', !/v6Blades|v6-bladepanel/.test(htmlCode));
ck('but the route to the blades screen is still there', /id="bladesBtn"/.test(html));
ck('and it declares width/height so it cannot shift layout',
   /props\.png" width="\d+" height="\d+"/.test(html));

/* ---- 9. nothing may be drawn INTO the floating HUD ---- */
/* The V6 HUD sits over the playfield: .scoreBadge y 18-92 top-left,
   .roundBanner y 0-~50 centre (topic, question counter AND timer), .pauseBtn
   top-right. Two things were drawn straight into that band:
     - the quiz question at top:14px, on top of the counter and timer;
     - the active-power chips at y=26, on top of the score.
   Worse, the question box was an inline style with a hardcoded WHITE background
   and color:var(--ink) — which the V6 palette flipped to #fff7e8, making it
   near-white on near-white. */
console.log('\n--- 9. HUD collision safety ---');
const quizSrc=fs.readFileSync(R+'js/mode-quiz.js','utf8');
const specSrc=fs.readFileSync(R+'js/specials.js','utf8');
const quizCode=decomment(quizSrc), specCode=decomment(specSrc);
ck('a single --hudSafe is defined in CSS', /--hudSafe:\s*(\d+)px/.test(cssCode));
ck('and mirrored as HUDSAFE in game.js', /var HUDSAFE=(\d+);/.test(code));
const cssSafe=+(cssCode.match(/--hudSafe:\s*(\d+)px/)||[])[1];
const jsSafe=+(code.match(/var HUDSAFE=(\d+);/)||[])[1];
ck('the two agree', cssSafe===jsSafe, `css ${cssSafe} vs js ${jsSafe}`);

ck('#quizQ no longer carries an inline style', !/id="quizQ"[^>]*style=/.test(html));
ck('#quizQ is positioned at --hudSafe, not at the top', /#quizQ\{[^}]*top:var\(--hudSafe\)/.test(cssCode));
/* The actual readability bug: a light background with themed light text. */
ck('#quizQ does not put var(--ink) on a white background',
   !/#quizQ\{[^}]*background:\s*(#fff|rgba\(255,\s*255,\s*255)[^}]*var\(--ink\)/.test(cssCode));
ck('#quizQ uses an explicit light-on-dark pair',
   /#quizQ\{[^}]*color:#fbe9d0/.test(cssCode) && /#quizQ\{[^}]*background:linear-gradient\(180deg,#2b1b11/.test(cssCode));

ck('power chips start below the HUD, not at y=26',
   /HUDSAFE[^;]*\+14\+i\*32/.test(specCode) && !/y=26\+i\*30/.test(specCode));
ck('power chips are dark, not a white pill on a dark playfield',
   /fxc\.fillStyle="#160f0a"/.test(specCode));

/* Quiz cards were a fixed 148px in a lane of (W-140)/n, so four answers
   overlapped below ~730px and their labels ran together. */
ck('quiz cards size themselves to their lane', /o\.cw=L\.cw/.test(quizCode) && /cw:Math\.max\(QCARDMIN/.test(quizCode));
ck('and wrap to two rows when a lane would be too narrow',
   /if\(avail\/n < QMINLANE && n>2\)\{ cols=Math\.ceil\(n\/2\); rows=2; \}/.test(quizCode));
ck('the card draw uses the per-card width', /var w=o\.cw\|\|148, h=w;/.test(quizCode));
ck('answer labels shrink and ellipsise to fit the card',
   /while\(fxc\.measureText\(lbl\)\.width>maxw/.test(quizCode));
ck('cards clear the question box', /HUDSAFE[^)]*\)\+76/.test(quizCode));

/* Run the real layout across every width and answer count. */
{
  const c={ console, Math, W:0 };
  vm.createContext(c);
  const a2=quizSrc.indexOf('var QMINLANE'), b2=quizSrc.indexOf('function quizLaunch');
  vm.runInContext(quizSrc.slice(a2,b2), c);
  let bad=[];
  for(const w of [320,360,375,414,500,640,760,900,1200,1600,1920,2560]){
    c.W=w;
    for(const n of [2,3,4,5]){
      const L=c.quizLayout(n);
      const xs=[]; for(let i=0;i<L.cols;i++) xs.push(L.pad+i*L.lw+L.lw/2);
      const gap=L.cols>1 ? (xs[1]-L.cw/2)-(xs[0]+L.cw/2) : 99;
      const fits=(xs[0]-L.cw/2)>=-1 && (xs[L.cols-1]+L.cw/2)<=w+1;
      if(gap<0 || !fits) bad.push(`${w}px/${n} gap=${Math.round(gap)} fits=${fits}`);
    }
  }
  console.log('    checked 12 widths x 4 answer counts');
  ck('no answer layout overlaps or overflows at any width', bad.length===0, bad.slice(0,3).join('; '));
}

/* ---- 10. EVERY mode, not just the two that were reported ---- */
/* Quiz and Bin It both drew lives at y=26 and combo/streak at y=56 — inside the
   score badge (18-92). Versus put its topic box at y=8, on top of the round
   banner, and flanked the badge and pause button with the two scores. */
console.log('\n--- 10. no mode draws into the HUD band ---');
const defSrc=decomment(fs.readFileSync(R+'js/mode-defend.js','utf8'));
ck('a shared hudRow() exists so modes cannot invent offsets',
   /function hudRow\(i\)\{ return HUDSAFE \+ 14 \+ \(i\|\|0\)\*30; \}/.test(code));
[['quiz',quizCode],['bin it',defSrc]].forEach(([name,src])=>{
  ck(`${name} lives are drawn from hudRow, not y=26`,
     /drawHeart\(30\+h?I?\*30, [a-z]+r?0?,/.test(src) && !/drawHeart\(28\+h?I?\*30, 26,/.test(src));
  ck(`${name} combo/streak is drawn from hudRow, not y=56`,
     /hudRow/.test(src) && !/, 28, 56\)/.test(src));
});
ck('bin it no longer uses a near-white spent-life colour',
   !/#e2e2e2/.test(defSrc), 'spent hearts must read as empty on a dark playfield');
const vsDraw=code.slice(code.indexOf('function vsDraw'), code.indexOf('function stopPeer'));
ck('versus draws its panel below the HUD, not at y=8',
   /roundRect\(W\/2-bw\/2, vy,/.test(vsDraw) && !/roundRect\(W\/2-bw\/2, 8,/.test(vsDraw));
ck('versus scores are below the HUD too', /fillText\("P1  "\+VS\.s1, W\*0\.25, vy\+4\)/.test(vsDraw));
ck('versus no longer paints a white slab on the dark playfield',
   !/fillStyle="rgba\(255,255,255,\.9\)"/.test(vsDraw));
/* The badge must come BACK for the other modes. */
ck('the score badge is hidden only for Versus, and from show()',
   /sb\.classList\.toggle\("hidden", GMODE==="vs"\)/.test(code));
/* Scoped to the BADGE: launchVS legitimately hides #quizQ and #ovl. */
ck('and launchVS does not hide the badge locally',
   !/scoreBadge[\s\S]{0,80}?classList\.add\("hidden"\)/.test(
     code.slice(code.indexOf('function launchVS'), code.indexOf('function vsSpawn'))));

console.log('\n'+(pass?'ALL PASS':'FAILURES PRESENT'));
process.exit(pass?0:1);

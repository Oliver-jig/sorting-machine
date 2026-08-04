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
  ck('the row reflows to two columns', t.chooseCls.has("twoUp"));
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
  ck('and the row is three columns again', !t.chooseCls.has("twoUp"));
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

console.log('\n--- 7. the two-column rule exists ---');
ck('.choose.twoUp is defined', /\.choose\.twoUp\{grid-template-columns:repeat\(2,1fr\)\}/.test(css));
/* This one was a false pass. Asserting the media query merely EXISTS says
   nothing about which rule wins: `.choose.twoUp` is two classes and
   out-specifies a bare `.choose` inside the query, so Versus kept two cramped
   columns on a phone. The narrow rule must name .twoUp explicitly. */
ck('the narrow-screen rule names .twoUp, so it out-specifies it',
   /max-width:560px\)\{ ?\.choose,\.choose\.twoUp\{grid-template-columns:1fr\}/.test(css));

console.log('\n'+(pass?'ALL PASS':'FAILURES PRESENT'));
process.exit(pass?0:1);

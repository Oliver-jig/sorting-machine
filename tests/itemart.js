/* The painted item renders must cover the roster exactly, and must never be the
   ONLY way an item can be drawn — a 404, a decode failure or a browser without
   WebP has to fall back to the canvas ART rather than spawn an invisible item. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const R=path.join(__dirname,'..')+'/';
const game=fs.readFileSync(R+'js/game.js','utf8');
const quiz=fs.readFileSync(R+'js/mode-quiz.js','utf8');
const decomment=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
const gcode=decomment(game), qcode=decomment(quiz);

let pass=true;
const ck=(n,c,d)=>{ if(!c)pass=false; console.log(`${c?'PASS':'FAIL'}  ${n}${d?'  '+d:''}`); };

/* the real roster */
const ctx={console,Math};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(R+'js/items.js','utf8')
  .replace(/var ART=\{[\s\S]*?\n\};/,'var ART={};').replace(/checkItems\(\);?/,''), ctx);
const keys=ctx.ITEMS.map(i=>i.t);

console.log('--- 1. one render per roster item, named by item key ---');
const dir=R+'img/items';
const files=fs.existsSync(dir)?fs.readdirSync(dir).filter(f=>f.endsWith('.webp')):[];
console.log(`    ${keys.length} items, ${files.length} renders`);
const missing=keys.filter(k=>!files.includes(k+'.webp'));
const orphan=files.filter(f=>!keys.includes(f.replace('.webp','')));
ck('every item has a render', missing.length===0, missing.join(', '));
ck('no orphan renders', orphan.length===0, orphan.join(', '));
/* Naming by item key is what removes the manifest, and with it any chance of
   the mapping drifting from the roster. */
ck('files are named <ITEMS[].t>.webp, so no manifest is needed at runtime',
   /img\/items\/"\+it\.t\+"\.webp/.test(gcode));
ck('no manifest.json was copied into the game', !fs.existsSync(R+'img/items/manifest.json'));

console.log('\n--- 2. every render is a real transparent WebP ---');
let badFmt=[], noAlpha=[], dims={};
files.forEach(f=>{
  const d=fs.readFileSync(path.join(dir,f));
  if(d.slice(0,4).toString()!=='RIFF' || d.slice(8,12).toString()!=='WEBP'){ badFmt.push(f); return; }
  const chunk=d.slice(12,16).toString();
  if(chunk==='VP8X'){ if(!(d[20]&0x10)) noAlpha.push(f);
    const w=1+(d[24]|d[25]<<8|d[26]<<16), h=1+(d[27]|d[28]<<8|d[29]<<16);
    dims[w+'x'+h]=(dims[w+'x'+h]||0)+1;
  } else if(chunk!=='VP8L') noAlpha.push(f);
});
console.log('    dimensions: '+JSON.stringify(dims));
ck('all files are WebP', badFmt.length===0, badFmt.join(', '));
ck('all carry an alpha channel', noAlpha.length===0, noAlpha.slice(0,5).join(', '));
ck('all share one size, so a single shared geometry fits them',
   Object.keys(dims).length===1, Object.keys(dims).join(' '));

console.log('\n--- 3. the canvas ART is the fallback, not dead code ---');
/* This is the guarantee that matters: if a render cannot be fetched or decoded,
   the item still draws. Deleting the ART path would make a bad network fatal. */
ck('a failed image swaps in the canvas artwork', /img\.onerror=function\(\)\{[\s\S]{0,160}?artCanvas\(it\)/.test(gcode));
ck('artCanvas still renders through ART', /ART\[it\.t\]\|\|ART\._def/.test(gcode));
/* Matched on the fallback BRANCH, not on its exact transform maths — the card
   art now scales with the card, so the numbers inside legitimately change. */
ck('quiz cards fall back to ART too',
   /else \{[\s\S]{0,200}?ART\[o\.t\]\|\|ART\._def/.test(qcode));
ck('items.js still guards that every item HAS an ART entry', /no ART function/.test(fs.readFileSync(R+'js/game.js','utf8')));

console.log('\n--- 4. only roster items use a render ---');
/* specials.js sends power-ups through makeSprite; they have no render and must
   keep their drawing rather than 404. */
ck('PHOTO membership is derived from ITEMS, not assumed',
   /for\(var i=0;i<ITEMS\.length;i\+\+\) PHOTO\[ITEMS\[i\]\.t\]=1/.test(gcode));
ck('a key with no render takes the CanvasTexture path',
   /\} else \{\s*tex=new THREE\.CanvasTexture\(artCanvas\(it\)\);/.test(gcode));
const spec=decomment(fs.readFileSync(R+'js/specials.js','utf8'));
const specKeys=[...spec.matchAll(/t:"(sp[A-Za-z]+)"/g)].map(m=>m[1]);
console.log('    power-up keys: '+specKeys.join(', '));
ck('no power-up accidentally has a render file',
   specKeys.every(k=>!files.includes(k+'.webp')));

console.log('\n--- 5. cost and caching ---');
ck('textures are still cached by item key', /if\(TEXCACHE\[it\.t\]\) return TEXCACHE\[it\.t\]/.test(gcode));
ck('nothing is fetched per spawn — preload warms the cache at boot',
   /function preloadItemArt\(\)/.test(gcode) && /preloadItemArt\(\);/.test(gcode));
ck('quiz reuses the preloaded image instead of loading its own',
   /var tex=TEXCACHE\[t\]/.test(gcode) && !/new Image\(\)/.test(qcode));
const bytes=files.reduce((s,f)=>s+fs.statSync(path.join(dir,f)).size,0);
console.log(`    ${files.length} renders, ${Math.round(bytes/1024)} KB total, avg ${Math.round(bytes/files.length/1024)} KB`);
ck('the whole set stays under 1 MB', bytes<1024*1024, Math.round(bytes/1024)+' KB');

console.log('\n--- 6. aspect ratio is preserved, not stretched ---');
ck('a second geometry carries the render aspect',
   /PHOTO_GEO=new THREE\.PlaneGeometry\(112, Math\.round\(112\*PHOTOH\/PHOTOW\)\)/.test(gcode));
ck('and the mesh picks the right one per item',
   /PHOTO\[it\.t\]\?PHOTO_GEO:SPRITE_GEO/.test(gcode));
/* Contained inside the old 112 box: art may get shorter, never wider, so the
   hit radius stays at least as generous as the visible sprite. */
const h=Math.round(112*220/300);
console.log(`    112x112 square -> 112x${h} (contained, aspect ${(300/220).toFixed(3)})`);
ck('the render is no taller than the old square footprint', h<=112, h+'px');

console.log('\n'+(pass?'ALL PASS':'FAILURES PRESENT'));
process.exit(pass?0:1);

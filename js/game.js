/* ================= data ================= */
var ROUNDS = [
  {topic:"Paper",  bins:["paper"], color:"#0a84ff", desc:"Slice only <b>paper</b> — newspaper, cardboard, magazines."},
  {topic:"Plastic",bins:["plastic"], color:"#ff9f0a", desc:"Slice only <b>plastics</b> — bottles and rinsed tubs (brown bin)."},
  {topic:"Metal & Glass", bins:["metal","glass"], color:"#30d158", desc:"Slice <b>cans</b> (yellow bin) and <b>glass</b> (green points)."},
  {topic:"Spot the traps", bins:["trash"], color:"#8e8e93", desc:"The wishcycling round: slice only the items that <b>can't</b> be recycled."}
];
var FACTS = [
  "Hong Kong sends over 11,000 tonnes of waste to landfill every day.",
  "Tricolour bins: blue = paper, yellow = metal, brown = plastic. Glass goes to green points.",
  /* This used to say plastic bags and foam were not recyclable. They are —
     GREEN@COMMUNITY accepts both, and the roster now bins them as plastic, so
     the old wording contradicted the game. */
  "Drink cartons, clean plastic bags and foam ARE collected at GREEN@COMMUNITY points.",
  "Greasy pizza boxes and plastic-lined coffee cups still go to general waste.",
  "Receipts are thermal-coated and tissue fibres are too short to re-pulp — neither is paper.",
  "Ceramics and mirrors melt at a different temperature to bottles and spoil a whole glass batch.",
  "'Wishcycling' — recycling on hope — contaminates and spoils whole batches."
];
var DIFFS = {
  relaxed:{g:0.00055, h:380, spawnMin:1150, spawnRange:1200, dbl:0.10, burst:0.12, round:52000},
  normal: {g:0.00085, h:440, spawnMin:800,  spawnRange:520,  dbl:0.22, burst:0.24, round:44000}
};

/* ================= helpers ================= */
var el=function(id){return document.getElementById(id)};
var qs=new URLSearchParams(location.search);
var IS_CONTROLLER = qs.get("ctrl")==="1";

/* ================= three setup ================= */
var stage=el("stage"), gl=el("gl"), fx=el("fx"), fxc=fx.getContext("2d");
var W=1,H=1,DPR=1, MESH_SCALE=1.75;
var renderer, scene, camera;

function initThree(){
  renderer=new THREE.WebGLRenderer({canvas:gl, antialias:true, alpha:true});
  scene=new THREE.Scene();
  camera=new THREE.OrthographicCamera(-1,1,1,-1,-1000,1000);
  scene.add(new THREE.AmbientLight(0xffffff,0.75));
  var key=new THREE.DirectionalLight(0xffffff,0.9); key.position.set(-0.4,1,0.8); scene.add(key);
  var rim=new THREE.DirectionalLight(0xbfd3ff,0.4); rim.position.set(0.6,-0.3,0.6); scene.add(rim);
}
/* Every frame clears and repaints the whole #fx canvas AND re-renders the WebGL
   scene, so cost scales with the pixel COUNT, not the CSS size. A flat
   min(1.5, dpr) ignored how big the stage is: on a large display at dpr 2 that
   is 1750x1180 CSS -> 2625x1770 = 4.6 MEGAPIXELS repainted 60 times a second,
   while a laptop-sized window pays a third of that for the same game.

   So budget the pixels instead of the ratio. Small windows still get the full
   1.5 and look identical; only stages big enough to hurt are scaled back, and
   never below 1.0 (below that text and the blade go visibly soft). 2.6MP is
   ~44% less fill than the old behaviour at the size above. */
var PIXBUDGET=2.6e6;
function dprFor(w,h){
  var want=Math.min(1.5, window.devicePixelRatio||1);
  var area=Math.max(1, w*h);
  return Math.max(1, Math.min(want, Math.sqrt(PIXBUDGET/area)));
}
function resize(){
  var r=stage.getBoundingClientRect(); W=r.width; H=r.height; DPR=dprFor(W,H);
  renderer.setPixelRatio(DPR); renderer.setSize(W,H,false);
  camera.left=-W/2; camera.right=W/2; camera.top=H/2; camera.bottom=-H/2; camera.updateProjectionMatrix();
  fx.width=W*DPR; fx.height=H*DPR; fxc.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener("resize", function(){ if(renderer) resize(); });
function toWorld(x,y){ return {x:x-W/2, y:H/2-y}; }

/* ================= meshes ================= */
function mat(col){ return new THREE.MeshStandardMaterial({color:col, flatShading:true, roughness:.7, metalness:.15}); }
function metalMat(col){ return new THREE.MeshStandardMaterial({color:col, flatShading:true, roughness:.35, metalness:.8}); }
function glassMat(col){ return new THREE.MeshStandardMaterial({color:col, flatShading:true, roughness:.2, metalness:.1, transparent:true, opacity:.75}); }
function makeMesh(it){
  var g=new THREE.Group();
  var body=(it.bin==="metal")?metalMat(it.col):(it.bin==="glass")?glassMat(it.col):mat(it.col);
  var dark=mat(0x333333), silver=metalMat(0xbfc4cc);
  if(it.t==="news"){                       /* rolled newspaper: thin light cylinder */
    var roll=new THREE.Mesh(new THREE.CylinderGeometry(9,9,46,16),body); roll.rotation.z=Math.PI/2; g.add(roll);
    var band=new THREE.Mesh(new THREE.CylinderGeometry(9.3,9.3,4,16),mat(0xff5a5a)); band.rotation.z=Math.PI/2; g.add(band);
  } else if(it.t==="mag"){                  /* magazine: thin glossy colourful slab */
    var mg=new THREE.Mesh(new THREE.BoxGeometry(40,4,30),new THREE.MeshStandardMaterial({color:it.col,flatShading:true,roughness:.25,metalness:.1})); g.add(mg);
    var strip=new THREE.Mesh(new THREE.BoxGeometry(40,4.4,7),mat(0xffffff)); strip.position.z=-11; g.add(strip);
  } else if(it.t==="box"){                  /* cardboard box: brown cube with flap line */
    var bx=new THREE.Mesh(new THREE.BoxGeometry(38,34,30),body); g.add(bx);
    var flap=new THREE.Mesh(new THREE.BoxGeometry(38.4,2,30.4),mat(0x8f6330)); flap.position.y=6; g.add(flap);
  } else if(it.t==="pizza"){                /* pizza box: big flat square */
    var pz=new THREE.Mesh(new THREE.BoxGeometry(56,10,56),body); g.add(pz);
    var seam=new THREE.Mesh(new THREE.BoxGeometry(56.4,2,56.4),mat(0xa9834f)); seam.position.y=2; g.add(seam);
  } else if(it.t==="foam"){                 /* foam clamshell: white, hinged lid ajar */
    var base=new THREE.Mesh(new THREE.BoxGeometry(46,10,34),body); base.position.y=-4; g.add(base);
    var lid=new THREE.Mesh(new THREE.BoxGeometry(46,8,34),body); lid.position.y=6; lid.position.z=-3; lid.rotation.x=-0.25; g.add(lid);
  } else if(it.t==="bottle"){               /* plastic drink bottle: slim, blue, cap */
    var bd=new THREE.Mesh(new THREE.CylinderGeometry(12,13,38,16),body); g.add(bd);
    var nk=new THREE.Mesh(new THREE.CylinderGeometry(5,7,12,12),body); nk.position.y=25; g.add(nk);
    var cp=new THREE.Mesh(new THREE.CylinderGeometry(5.5,5.5,5,12),mat(0x2b6bd0)); cp.position.y=33; g.add(cp);
  } else if(it.t==="jug"){                  /* detergent: chunky body + handle + spout */
    var jb=new THREE.Mesh(new THREE.BoxGeometry(26,38,20),body); g.add(jb);
    var handle=new THREE.Mesh(new THREE.TorusGeometry(8,2.4,8,16,Math.PI*1.3),body); handle.position.set(16,6,0); handle.rotation.z=-0.4; g.add(handle);
    var spout=new THREE.Mesh(new THREE.CylinderGeometry(4,5,10,10),body); spout.position.set(-8,22,0); g.add(spout);
    var jcap=new THREE.Mesh(new THREE.CylinderGeometry(4.5,4.5,5,10),mat(0xffffff)); jcap.position.set(-8,29,0); g.add(jcap);
  } else if(it.t==="tub"){                  /* yogurt tub: short tapered + coloured lid */
    var tb=new THREE.Mesh(new THREE.CylinderGeometry(15,11,20,16),body); g.add(tb);
    var tl=new THREE.Mesh(new THREE.CylinderGeometry(15.6,15.6,3,16),mat(0xff5aa0)); tl.position.y=11; g.add(tl);
  } else if(it.t==="canTall"){              /* drink can: slim tall silver */
    var ct=new THREE.Mesh(new THREE.CylinderGeometry(10,10,42,18),body); g.add(ct);
    var tr=new THREE.Mesh(new THREE.CylinderGeometry(10.3,10.3,2,18),silver); tr.position.y=20; g.add(tr);
  } else if(it.t==="canShort"){             /* tin can: short fat + paper label band */
    var cs=new THREE.Mesh(new THREE.CylinderGeometry(15,15,24,18),silver); g.add(cs);
    var lbl=new THREE.Mesh(new THREE.CylinderGeometry(15.3,15.3,15,18),mat(0xcf4030)); g.add(lbl);
  } else if(it.t==="wine"){                 /* glass bottle: tall body + long neck */
    var wb=new THREE.Mesh(new THREE.CylinderGeometry(11,11,30,16),body); wb.position.y=-4; g.add(wb);
    var wsh=new THREE.Mesh(new THREE.CylinderGeometry(4,11,10,16),body); wsh.position.y=14; g.add(wsh);
    var wn=new THREE.Mesh(new THREE.CylinderGeometry(4,4,16,12),body); wn.position.y=24; g.add(wn);
    var wc=new THREE.Mesh(new THREE.CylinderGeometry(4.3,4.3,5,12),mat(0x7a5230)); wc.position.y=33; g.add(wc);
  } else if(it.t==="jar"){                  /* glass jar: short wide + metal lid */
    var jr=new THREE.Mesh(new THREE.CylinderGeometry(15,15,24,18),body); g.add(jr);
    var jl=new THREE.Mesh(new THREE.CylinderGeometry(13,13,7,18),metalMat(0xcaa24a)); jl.position.y=14; g.add(jl);
  } else if(it.t==="cup"){                  /* coffee cup: tapered + dome lid + sleeve */
    var cu=new THREE.Mesh(new THREE.CylinderGeometry(13,9,30,16),body); g.add(cu);
    var sl=new THREE.Mesh(new THREE.CylinderGeometry(13.4,12,9,16),mat(0xb98a5a)); sl.position.y=-2; g.add(sl);
    var dome=new THREE.Mesh(new THREE.SphereGeometry(13,16,8,0,Math.PI*2,0,Math.PI/2),mat(0xffffff)); dome.position.y=15; g.add(dome);
  } else if(it.t==="bag"){                  /* plastic bag: flat wavy + two handles */
    var bg=new THREE.Mesh(new THREE.BoxGeometry(32,36,8),body); bg.scale.z=0.5; g.add(bg);
    var hL=new THREE.Mesh(new THREE.TorusGeometry(6,1.8,8,14,Math.PI),body); hL.position.set(-7,20,0); g.add(hL);
    var hR=new THREE.Mesh(new THREE.TorusGeometry(6,1.8,8,14,Math.PI),body); hR.position.set(7,20,0); g.add(hR);
  } else if(it.t==="spam"){                 /* luncheon meat tin: rectangular metal + key */
    var sp=new THREE.Mesh(new THREE.BoxGeometry(32,18,22),metalMat(it.col)); g.add(sp);
    var trim=new THREE.Mesh(new THREE.BoxGeometry(33,3.5,23),metalMat(0xd4d8dd)); trim.position.y=9; g.add(trim);
    var keyStem=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.5,7,8),metalMat(0xd4d8dd)); keyStem.position.set(11,12,0); g.add(keyStem);
    var keyTab=new THREE.Mesh(new THREE.BoxGeometry(9,2,3),metalMat(0xd4d8dd)); keyTab.position.set(7,15,0); g.add(keyTab);
  } else if(it.t==="bubbletea"){            /* bubble tea: clear cup + dome lid + straw + pearls */
    var btMat=new THREE.MeshStandardMaterial({color:0xe9dcc4,flatShading:true,roughness:.25,metalness:.05,transparent:true,opacity:.85});
    var bt=new THREE.Mesh(new THREE.CylinderGeometry(13,9,30,16),btMat); g.add(bt);
    var dm=new THREE.Mesh(new THREE.SphereGeometry(13,16,8,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0xffffff,flatShading:true,transparent:true,opacity:.45})); dm.position.y=15; g.add(dm);
    var straw=new THREE.Mesh(new THREE.CylinderGeometry(2,2,36,8),mat(0xe0483f)); straw.position.set(4,15,0); straw.rotation.z=0.22; g.add(straw);
    for(var pi=0;pi<5;pi++){ var pearl=new THREE.Mesh(new THREE.SphereGeometry(2.6,8,8),mat(0x241812)); pearl.position.set(-6+pi*3,-12,(pi%2?3:-3)); g.add(pearl); }
  } else if(it.t==="carton"){               /* HK drink carton (Vita-style brick) + straw */
    var cb=new THREE.Mesh(new THREE.BoxGeometry(20,34,15),body); g.add(cb);
    var seam=new THREE.Mesh(new THREE.BoxGeometry(20.4,4,15.4),mat(0xcbb98a)); seam.position.y=15; g.add(seam);
    var cstraw=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.5,28,8),mat(0xffffff)); cstraw.position.set(5,22,0); cstraw.rotation.z=0.18; g.add(cstraw);
  } else { g.add(new THREE.Mesh(new THREE.BoxGeometry(28,28,28),body)); }
  return g;
}

/* ---- item artwork ----
   The 50 roster items are painted cartoon renders in `img/items/<t>.webp`,
   named by the SAME key as ITEMS[].t so there is no manifest to drift from.
   Everything else that reaches makeSprite() — the power-ups in specials.js —
   has no render and keeps its canvas drawing, so PHOTO membership is derived
   from the roster rather than assumed.

   The canvas ART is NOT dead code: it is the fallback. A 404, a decode failure
   or a browser without WebP falls back to it silently and the game still plays
   with every item legible. */
var TEXCACHE={}, SPRITE_GEO=null, PHOTO_GEO=null, PHOTO={}, PHOTOW=300, PHOTOH=220;
(function(){ if(typeof ITEMS!=="undefined") for(var i=0;i<ITEMS.length;i++) PHOTO[ITEMS[i].t]=1; })();

function artCanvas(it){
  var S=220, cv=document.createElement("canvas"); cv.width=S; cv.height=S;
  (ART[it.t]||ART._def)(cv.getContext("2d"), hx(it.col));
  return cv;
}
function getTex(it){
  if(TEXCACHE[it.t]) return TEXCACHE[it.t];
  var tex;
  if(PHOTO[it.t]){
    /* Texture is returned immediately and fills in when the image decodes;
       preloadItemArt() means that has normally already happened. */
    var img=new Image();
    tex=new THREE.Texture(img);
    img.onload=function(){ tex.needsUpdate=true; };
    img.onerror=function(){
      /* fall back to the drawn artwork, in place, so the material needs no fixup */
      tex.image=artCanvas(it); tex.needsUpdate=true;
      if(typeof console!=="undefined"&&console.warn) console.warn("item art missing, using canvas fallback:", it.t);
    };
    img.src="img/items/"+it.t+".webp";
  } else {
    tex=new THREE.CanvasTexture(artCanvas(it));
  }
  tex.anisotropy=2;
  TEXCACHE[it.t]=tex; return tex;
}
/* The decoded <img> for an item, or null if it is not ready / has no render.
   Quiz cards draw onto the 2D overlay and cannot use a THREE.Texture, but they
   must not load a SECOND copy of the same file — so they read the image out of
   the texture the preload already fetched. */
function itemPhoto(t){
  var tex=TEXCACHE[t];
  if(!tex || !PHOTO[t]) return null;
  var im=tex.image;
  return (im && im.naturalWidth) ? im : null;
}
/* Warm every roster texture once, at boot. Without this the first spawn of each
   item type would fetch mid-round and pop in blank for a frame or two. */
function preloadItemArt(){
  if(typeof ITEMS==="undefined") return;
  for(var i=0;i<ITEMS.length;i++) getTex(ITEMS[i]);
}
function makeSprite(it){
  /* Two shared geometries, not one: the renders are 300x220, so a square plane
     would squash them. PHOTO_GEO is that aspect CONTAINED in the old 112 box
     (112 x 82) — the art never grows past the footprint the hit radius was
     tuned against, it only gets shorter. */
  if(!SPRITE_GEO){
    SPRITE_GEO=new THREE.PlaneGeometry(112,112);
    PHOTO_GEO=new THREE.PlaneGeometry(112, Math.round(112*PHOTOH/PHOTOW));
  }
  var m=new THREE.MeshBasicMaterial({map:getTex(it), transparent:true, side:THREE.DoubleSide, depthWrite:false});
  return new THREE.Mesh(PHOTO[it.t]?PHOTO_GEO:SPRITE_GEO, m);
}

/* ================= game state ================= */
var G={score:0, round:0, running:false, paused:false, pauseRemain:0, roundEndAt:0, objs:[], pops:[], spawnT:0, parts:[], flashes:[]};
var BINCOL={paper:"#2f7fd1", plastic:"#e0762b", metal:"#e0a92b", glass:"#2fae6a", trash:"#8a97a0", hazard:"#d70015"};
function spawnBurst(x,y,col){
  for(var i=0;i<8;i++){ var a=Math.random()*6.28, sp=1.5+Math.random()*4.5;
    G.parts.push({x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1.5,life:1,col:col,sz:3+Math.random()*4}); }
  G.flashes.push({x:x,y:y,r:12,life:1});
}
/* First y clear of the floating HUD (score badge 18-92, round banner 0-~50,
   pause 18-64). Mirrors --hudSafe in css/styles.css — canvas drawing cannot
   read a CSS variable, so the two are kept in step by hand. */
var HUDSAFE=100;
/* Row helper for anything a MODE draws on the canvas. Every mode used to place
   its lives/combo/score at y=26..80, which is inside the score badge (18-92),
   and Versus put its topic box at y=8 on top of the round banner. Rows are
   measured from HUDSAFE so a HUD change moves all of them at once. */
function hudRow(i){ return HUDSAFE + 14 + (i||0)*30; }
var DIFF=DIFFS.relaxed;
var BLADE={x:0,y:0,px:0,py:0,active:false, trail:[]};
var BLADE2={x:0,y:0,px:0,py:0,active:false, trail:[]};
var controlMode="cam";

/* ================= rounds ================= */
function showOverlayFor(round){
  var R=ROUNDS[round];
  el("ovlR").textContent="Round "+(round+1)+" of "+ROUNDS.length;
  el("ovlT").textContent=R.topic; el("ovlD").innerHTML=R.desc;
  setTopic(R.topic, R.color);
  el("roundN").textContent=(round+1)+"/"+ROUNDS.length;
  el("ovlBtn").textContent = round===0 ? "Start round" : "Next round";
  el("ovl").classList.remove("hidden");
}
/* Order matters. This used to hide the overlay FIRST and set G.running LAST, so
   anything throwing in between (specialsReset, resize, clearObjs) left the
   overlay gone and the game stopped: HUD up, timer bar stuck full, zero items,
   and nothing on screen saying why. That is indistinguishable from a hang, and
   it cost a long diagnosis.

   Now the round is armed first, the overlay is dismissed only once the setup
   that can throw has succeeded, and a failure puts the overlay BACK with the
   reason on it rather than dumping the player on a dead board. */
function startRound(){
  try{
    resize();
    clearObjs(); G.pops=[]; G.parts=[]; G.flashes=[]; BLADE.trail=[]; G.spawnT=0;
    specialsReset();
    G.roundEndAt=performance.now()+DIFF.round;
    G.running=true;
    el("ovl").classList.add("hidden");
  }catch(e){
    G.running=false;
    el("ovl").classList.remove("hidden");
    el("ovlT").textContent="Could not start the round";
    el("ovlD").innerHTML="<b>"+((e&&e.message)||"unknown error")+
      "</b><br>Try again, or reload the page.";
    el("ovlBtn").textContent="Try again";
  }
}
/* A lesson never reaches a real game over: tutModeEnded() restarts the practice
   instead, so no result screen, no recorded run and no life spent for real. */
function endRound(){
  if(typeof tutModeEnded==="function" && tutModeEnded()) return;
  G.running=false; G.round++;
  if(G.round>=ROUNDS.length) endGame(); else showOverlayFor(G.round); }
/* Retiring an item must RELEASE it, not just unparent it.

   makeSprite() allocates a MeshBasicMaterial per spawn — it has to, because each
   item fades independently through material.opacity when sliced. But three.js
   keeps GPU-side program and uniform state for every material it has ever seen
   until dispose() is called, and nothing here ever called it. A Sort game spawns
   a few hundred items across four rounds and they accumulated for the life of
   the page, across replays, getting progressively less smooth.

   The shared SPRITE_GEO and the TEXCACHE textures are deliberately NOT disposed:
   they are reused by every item and outlive individual objects. material.dispose()
   does not touch the texture it maps, so the cache stays valid. */
function releaseObj(o){
  scene.remove(o.mesh);
  if(o.mesh && o.mesh.material && o.mesh.material.dispose) o.mesh.material.dispose();
}
function clearObjs(){ G.objs.forEach(releaseObj); G.objs=[]; }

/* The roundN stat is shared by every mode, so whoever launches must also say
   what the number MEANS — Bin It puts lives there, and "3 round" reads as
   nonsense. */
function setRoundLbl(t){ var e=el("roundLbl"); if(e) e.textContent=t; }
/* Topic name, dot colour and the bottom reminder pill were being set together at
   six call sites; now one call does all three so they cannot fall out of step.
   The pill only makes sense where the rule is "only this material counts" —
   Quiz shows a question and Versus is two players, so it hides there. */
function setTopic(name, color){
  var n=el("topicName"), d=el("topicDot");
  if(n) n.textContent=name;
  if(d) d.style.background=color;
  var pill=el("targetPill"), pn=el("targetName"), pd=el("targetDot");
  if(!pill) return;
  var show=(GMODE==="sort"||GMODE==="tsunami");
  pill.classList.toggle("hidden", !show);
  if(show){
    if(pn) pn.textContent=(GMODE==="tsunami"?"Catch only: ":"Slice only: ")+name;
    if(pd) pd.style.background=color;
  }
}
function launchGame(){ setRoundLbl("round");
  GMODE="sort"; el("quizQ").classList.add("hidden"); el("pauseBtn").style.display="";
  G.score=0; G.round=0; el("scoreN").textContent=0;
  show("play"); resize(); showOverlayFor(0);
  if(controlMode==="cam") setupCam();
  else if(controlMode==="mouse") setupMouse();
  /* remote already connected before reaching here */
}
function endGame(){ G.running=false;
  el("rScore").textContent=G.score;
  el("rGrade").textContent = G.score>=300?"Recycling champion — you know your bins.":
    G.score>=150?"Solid — but a few traps caught you.":
    G.score>=0?"Getting there — watch the wishcycling traps.":"Ouch — those traps are sneaky. Try again!";
  var f=el("rFacts"); f.innerHTML="";
  FACTS.forEach(function(x){ var d=document.createElement("div"); d.className="fact"; d.textContent=x; f.appendChild(d); });
  scoresRecord("sort", G.score);
  stopCam();
  show("result");
}

/* ================= QUIZ MODE ================= */
var GMODE="sort";
var ITEMBYT={}; ITEMS.forEach(function(it){ ITEMBYT[it.t]=it; });
/* `zh` is used by the Bin It bin artwork, which is bilingual to match the item
   roster (every ITEMS name is "中文 English"). Additive — nothing else reads it.
   Colours follow the HK EPD scheme: blue paper, yellow metal, brown plastic,
   grey general waste, with glass at separate green collection points. */
var QBINS={paper:{n:"Paper",zh:"廢紙",c:"#2f7fd1"},plastic:{n:"Plastic",zh:"塑膠",c:"#e0762b"},metal:{n:"Metal",zh:"金屬",c:"#e0a92b"},glass:{n:"Glass",zh:"玻璃",c:"#2fae6a"},trash:{n:"General",zh:"其他垃圾",c:"#8a97a0"}};
/* A roster mistake is silent otherwise: a typo'd `t` still renders, because
   getTex falls back to ART._def — a plain grey square — and a duplicate `t`
   just overwrites the earlier entry in ITEMBYT. Both ship looking almost fine.
   This turns either into an immediate console error. */
(function checkItems(){
  var seen={}, bad=[];
  ITEMS.forEach(function(it){
    if(!ART[it.t]) bad.push(it.t+": no ART function (would draw a grey square)");
    if(!QBINS[it.bin]) bad.push(it.t+': bin "'+it.bin+'" is not a real bin');
    if(seen[it.t]) bad.push(it.t+": duplicate t, shadows the earlier item");
    seen[it.t]=1;
  });
  if(bad.length) console.error("ITEMS roster problems:\n  "+bad.join("\n  "));
})();
/* Quiz lives in js/mode-quiz.js; the sorting mode in js/mode-defend.js.
   The helpers just below are shared by both, so they stay here. */
function shuffle(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
function segHit2(ox,oy,r,x1,y1,x2,y2){ var dx=x2-x1,dy=y2-y1,len2=dx*dx+dy*dy||1; var t=Math.max(0,Math.min(1,((ox-x1)*dx+(oy-y1)*dy)/len2)); var px=x1+t*dx,py=y1+t*dy; return Math.hypot(ox-px,oy-py)<r+8; }
function fxRR(x,y,w,h,r){ fxc.beginPath(); fxc.moveTo(x+r,y); fxc.arcTo(x+w,y,x+w,y+h,r); fxc.arcTo(x+w,y+h,x,y+h,r); fxc.arcTo(x,y+h,x,y,r); fxc.arcTo(x,y,x+w,y,r); fxc.closePath(); }
function segDist(ox,oy,x1,y1,x2,y2){ var dx=x2-x1,dy=y2-y1,len2=dx*dx+dy*dy||1; var t=Math.max(0,Math.min(1,((ox-x1)*dx+(oy-y1)*dy)/len2)); var px=x1+t*dx,py=y1+t*dy; return Math.hypot(ox-px,oy-py); }
function wrapFx(txt,cx,cy,maxw){
  var words=(txt+"").split(" "), lines=[], line="";
  for(var i=0;i<words.length;i++){ var test=line?line+" "+words[i]:words[i]; if(fxc.measureText(test).width>maxw && line){ lines.push(line); line=words[i]; } else line=test; }
  if(line) lines.push(line);
  var lh=20, sy=cy-(lines.length-1)*lh/2;
  for(var j=0;j<lines.length;j++){ fxc.fillText(lines[j], cx, sy+j*lh); }
}
function drawHeart(cx,cy,s,col){ fxc.save(); fxc.fillStyle=col; fxc.beginPath(); fxc.moveTo(cx,cy+s*0.35); fxc.bezierCurveTo(cx-s*1.1,cy-s*0.4,cx-s*0.5,cy-s*1.1,cx,cy-s*0.45); fxc.bezierCurveTo(cx+s*0.5,cy-s*1.1,cx+s*1.1,cy-s*0.4,cx,cy+s*0.35); fxc.closePath(); fxc.fill(); fxc.restore(); }

/* ================= spawn / physics ================= */
/* How high an item should fly, in px.

   This used to be a flat `Math.min(H, DIFF.h)` — a fixed 380px however tall the
   stage was. Items launch from y=H+55, so on a big screen they rose 380px from
   BELOW the bottom edge and never reached the playfield: measured on a 1180px
   stage they peaked at y=738, staying in the bottom 37% of the screen, which is
   exactly where the skyline sits. They skimmed the rooftops instead of arcing
   into view, and read as "no items are coming out".

   Scaling with H fixes that. DIFF.h stays the FLOOR so short screens and the
   difficulty presets keep their tuned feel; only tall stages get more. 0.62
   puts the apex a bit above mid-screen, leaving room for the label drawn under
   each item without pushing items off the top. */
function riseFor(base){
  /* Items launch from y=H+55, so the apex lands at H+55-rise. The floor stops a
     tall screen leaving them among the skyline (build 63) — but a FLOOR with no
     ceiling overshoots the other way: on a short stage (a landscape phone, ~320px)
     `base` alone put the apex at y=-4, above the top edge, where the item is
     unslicable and invisible. The old `Math.min(H, base)` happened to prevent
     that; removing it lost the protection.

     So clamp the top of the arc too, keeping the apex at least TOPPAD below the
     top edge. On any normal stage (>=440px) the floor still wins and nothing
     changes. */
  var TOPPAD=70;
  return Math.max(60, Math.min(Math.max(base, H*0.62), H+55-TOPPAD));
}
function spawn(fx){
  if(G.objs.length>=16) return;   /* cap on-screen items so weaker machines don't choke */
  var R=ROUNDS[G.round]; var wantCorrect=Math.random()<0.55;
  var pool=ITEMS.filter(function(it){ return wantCorrect ? R.bins.indexOf(it.bin)>=0 : R.bins.indexOf(it.bin)<0; });
  if(!pool.length) pool=ITEMS;
  var it=pool[Math.floor(Math.random()*pool.length)];
  var x=(fx!==undefined)? fx : 60+Math.random()*(W-120);
  var vy=-(Math.sqrt(2*DIFF.g*riseFor(DIFF.h)))-Math.random()*0.1;
  var vx=(fx!==undefined)? (Math.random()-0.5)*0.03 : (W/2-x)/1600+(Math.random()-0.5)*0.1;   /* burst items rise straight in their own lane; solo items drift only gently */
  var mesh=makeSprite(it); scene.add(mesh);
  G.objs.push({it:it,x:x,y:H+55,vx:vx,vy:vy,r:50,sliced:false,a:1,scale:1,
    spin:(Math.random()-.5)*2, dspin:(Math.random()-.5)*0.05, phase:Math.random()*6, mesh:mesh});
}
function updatePhysics(dt){
  var frozen=PWR.freeze>0;
  for(var i=G.objs.length-1;i>=0;i--){
    var o=G.objs[i];
    /* frozen items hold position; already-sliced ones still fade out so a
       freeze never leaves debris stuck mid-air */
    if(!frozen || o.sliced){
      specialPull(o,dt);
      o.vy+=DIFF.g*dt; o.x+=o.vx*dt; o.y+=o.vy*dt; o.spin+=o.dspin;
    }
    if(o.sliced){ o.a-=0.045; o.scale+=0.03; }
    var w=toWorld(o.x,o.y);
    o.mesh.position.set(w.x,w.y,0);
    o.mesh.rotation.set(0.25*Math.sin(tnow*0.002+o.phase), 0, o.spin);
    o.mesh.scale.setScalar(o.scale);
    o.mesh.material.opacity=o.a;
    if(o.y>H+100 || o.a<=0 || o.x<-120 || o.x>W+120){ releaseObj(o); G.objs.splice(i,1); }
  }
}

/* ================= slicing ================= */
function segHit(o,x1,y1,x2,y2){ var dx=x2-x1,dy=y2-y1,len2=dx*dx+dy*dy||1;
  var t=Math.max(0,Math.min(1,((o.x-x1)*dx+(o.y-y1)*dy)/len2));
  var px=x1+t*dx,py=y1+t*dy; return Math.hypot(o.x-px,o.y-py)<o.r+12; }
function sliceAlong(x1,y1,x2,y2){
  var R=ROUNDS[G.round];
  for(var i=0;i<G.objs.length;i++){ var o=G.objs[i]; if(o.sliced) continue;
    if(segHit(o,x1,y1,x2,y2)){
      if(o.it.sp){ specialSlice(o); continue; }                 /* power-ups score nothing themselves */
      o.sliced=true; o.vy-=0.1; o.dspin=(o.dspin>0?1:-1)*0.28;
      /* double only multiplies the reward — being punished twice for one
         mistake reads as unfair */
      var correct=R.bins.indexOf(o.it.bin)>=0, pts=correct?15*specialMult():-12;
      G.score=Math.max(-999,G.score+pts); el("scoreN").textContent=G.score;
      spawnBurst(o.x,o.y, correct?(BINCOL[o.it.bin]||"#2fae6a"):"#d70015");
      /* The sound follows the MATERIAL, not the score: a glass jar sounds like
         glass whether or not it belonged in this round's bin. Right and wrong
         are already said twice over, by the burst colour and the score pop.
         typeof-guarded because a missing js file must not throw inside the game
         loop — that exact race is what broke builds 62/63/66. */
      if(typeof sfxCut==="function") sfxCut(o.it.bin);
      G.pops.push({x:o.x,y:o.y,txt:(pts>0?"+":"")+pts,col:correct?"#1f9d55":"#d70015",a:1}); } }
}

/* ================= controls ================= */
var camStream=null, hands=null, mpCam=null, mouseHandler=null, camWanted=false;
/* Grace window for hand tracking — see setupCam. Kept next to the other camera
   state so it is obvious this belongs to the camera, not to the blade.
   200ms chosen by measurement, not feel. Simulating a 25fps tracker with 25%
   detection loss, the share of frames with no cursor on screen ran:
     90ms 4%   120ms 1.3%   150ms 0.4%   200ms 0%   250ms 0%
   200 is the smallest value that reaches zero. The cost is that the blade
   lingers 200ms after you take your hand away, which is a fifth of a second and
   not noticeable; going higher only helps a badly degraded tracker while making
   removal feel sticky. */
var CAMGRACE=200, camSeen=0, camSeen2=0, camGrace=null;
function loadScript(src){ return new Promise(function(res,rej){ var s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); }

/* Release the webcam the moment play ends. Stopping MediaPipe's Camera is NOT
   enough on its own — the underlying MediaStream tracks keep the hardware (and
   the recording light) on until each one is stopped explicitly.
   `hands` is deliberately left alive: with no camera feeding it, it sits idle,
   and re-initialising its WASM on every game is slow. */
function stopCam(){
  camWanted=false;
  try{ if(mpCam && mpCam.stop) mpCam.stop(); }catch(e){}
  try{ if(camStream && camStream.getTracks) camStream.getTracks().forEach(function(t){ t.stop(); }); }catch(e){}
  var v=el("cam");
  if(v){ try{ v.pause(); }catch(e){} v.srcObject=null; v.classList.add("hidden"); }
  var c=el("camCap"); if(c) c.classList.add("hidden");
  /* Stop the grace timer too, or it keeps clearing BLADE.active for the rest of
     the session and a second interval is added every time the camera restarts. */
  clearInterval(camGrace); camGrace=null; BLADE.active=false; BLADE2.active=false;
  mpCam=null; camStream=null;
}
function setupMouse(){ var lastMove=0;
  mouseHandler=function(e){ var r=stage.getBoundingClientRect(); BLADE.x=e.clientX-r.left; BLADE.y=e.clientY-r.top; lastMove=performance.now(); BLADE.active=true; };
  stage.addEventListener("pointermove",mouseHandler);
  setInterval(function(){ if(performance.now()-lastMove>90) BLADE.active=false; },60);
}
async function setupCam(){
  camWanted=true;
  el("cam").classList.remove("hidden"); el("camCap").classList.remove("hidden");
  try{
    await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js");
    await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");
    hands=new Hands({locateFile:function(f){return "https://cdn.jsdelivr.net/npm/@mediapipe/hands/"+f;}});
    hands.setOptions({maxNumHands:1,modelComplexity:0,minDetectionConfidence:0.6,minTrackingConfidence:0.6});
    /* A single missed detection used to kill the blade outright, which is what
       made it flash. MediaPipe loses the hand most often during FAST motion —
       exactly when you are slicing — so the blade blinked out at the worst
       moment, and because slicing is gated on the same flag, quick swipes
       silently failed to cut.
       setupMouse right above already solves this with a 90ms grace window; the
       camera just never got one. 150ms here rather than 90ms because camera
       frames arrive ~40ms apart against a mouse's ~8ms, so the same tolerance
       in FRAMES needs more wall-clock time.
       Holding the last position across a gap is safe: sliceAlong then gets a
       zero-length segment, and segHit already guards `len2||1`. */
    hands.onResults(function(res){ var lm=res.multiHandLandmarks&&res.multiHandLandmarks[0];
      if(lm){ var tip=lm[8]; BLADE.x=(1-tip.x)*W; BLADE.y=tip.y*H; BLADE.active=true; camSeen=performance.now(); } });
    clearInterval(camGrace);
    camGrace=setInterval(function(){ if(performance.now()-camSeen>CAMGRACE) BLADE.active=false; },50);
    var v=el("cam"); mpCam=new Camera(v,{onFrame:async function(){ if(controlMode==="cam") await hands.send({image:v}); },width:640,height:480});
    await mpCam.start(); camStream=v.srcObject;
    if(!camWanted) stopCam();     /* quit during start-up — don't leave the camera running */
  }catch(err){ el("camCap").classList.add("hidden"); el("cam").classList.add("hidden"); controlMode="mouse"; setupMouse(); }
}

/* ================= VERSUS (2 players, split screen, two webcam hands) ================= */
var VS={running:false, s1:0, s2:0, t:0, spawnT:0, topicIdx:0, topicT:0};
async function setupCamVS(){
  camWanted=true;
  el("cam").classList.remove("hidden"); el("camCap").classList.remove("hidden"); el("camCap").textContent="Two hands = two players";
  try{
    await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js");
    await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");
    hands=new Hands({locateFile:function(f){return "https://cdn.jsdelivr.net/npm/@mediapipe/hands/"+f;}});
    hands.setOptions({maxNumHands:2,modelComplexity:0,minDetectionConfidence:0.6,minTrackingConfidence:0.6});
    hands.onResults(function(res){
      var lms=res.multiHandLandmarks||[], pts=[];
      for(var i=0;i<Math.min(2,lms.length);i++){ var tip=lms[i][8]; pts.push({x:(1-tip.x)*W, y:tip.y*H}); }
      pts.sort(function(a,b){return a.x-b.x;});
      /* Same grace window as single-player: do NOT clear on a miss, or both
         blades blink out whenever either hand is momentarily lost. The two
         players are timed SEPARATELY (camSeen / camSeen2) so one player's
         dropout can never disable the other's blade. */
      var t=performance.now();
      if(pts.length>=1){ BLADE.x=Math.max(0,Math.min(W/2-6,pts[0].x)); BLADE.y=pts[0].y; BLADE.active=true; camSeen=t; }
      if(pts.length>=2){ BLADE2.x=Math.max(W/2+6,Math.min(W,pts[1].x)); BLADE2.y=pts[1].y; BLADE2.active=true; camSeen2=t; }
    });
    clearInterval(camGrace);
    camGrace=setInterval(function(){
      var t=performance.now();
      if(t-camSeen>CAMGRACE)  BLADE.active=false;
      if(t-camSeen2>CAMGRACE) BLADE2.active=false;
    },50);
    var v=el("cam"); mpCam=new Camera(v,{onFrame:async function(){ if(GMODE==="vs") await hands.send({image:v}); },width:640,height:480});
    await mpCam.start(); camStream=v.srcObject;
    if(!camWanted) stopCam();     /* quit during start-up — don't leave the camera running */
  }catch(err){ el("cam").classList.add("hidden"); el("camCap").classList.add("hidden"); alert("Versus needs a webcam. Please allow camera access, then try again."); show("start"); }
}
function launchVS(){ setRoundLbl("players");
  GMODE="vs"; VS.running=false; VS.s1=0; VS.s2=0; VS.t=60000; VS.spawnT=500; VS.topicIdx=0; VS.topicT=15000;
  G.pops=[]; G.parts=[]; G.flashes=[]; BLADE.trail=[]; BLADE2.trail=[]; clearObjs();
  setTopic("Versus", "#7f77dd"); el("roundN").textContent="2P"; el("timeFill").style.width="100%";
  el("quizQ").classList.add("hidden"); el("pauseBtn").style.display="";
  show("play"); resize(); el("ovl").classList.add("hidden"); el("pauseOvl").classList.add("hidden");
  /* Routed EXPLICITLY, never `else setupCamVS()`. That bare else meant any
     control mode other than remote started the camera — so Mouse + Versus asked
     for camera access, and denying it alerted and bounced back to the menu. The
     picker no longer offers Mouse here, but controlMode can also be changed in
     code (setupCam()'s failure path sets it to "mouse"), so the routing must
     refuse an unsupported mode rather than guess. */
  if(controlMode==="remote"){ BLADE.active=false; BLADE2.active=false; }   /* two phones drive the blades */
  else if(controlMode==="cam"){ setupCamVS(); }
  else {
    VS.running=false;
    show("start");
    var n=el("startNote");
    if(n){ n.innerHTML='<b>Versus needs two players.</b> Choose <b>Webcam hand</b> (two hands) '+
      'or <b>Phone controller</b> (two phones) — a mouse only gives one blade.';
      n.style.color="#e2703a"; }
    return;
  }
  VS.running=true;
}
function vsSpawn(side){
  if(G.objs.length>=18) return;
  var tb=ROUNDS[VS.topicIdx].bins, want=Math.random()<0.55;
  var pool=ITEMS.filter(function(x){ return want ? tb.indexOf(x.bin)>=0 : tb.indexOf(x.bin)<0; });
  if(!pool.length) pool=ITEMS;
  var it=pool[Math.floor(Math.random()*pool.length)];
  var lo=side===0?60:(W/2+30), hi=side===0?(W/2-30):(W-60), x=lo+Math.random()*Math.max(20,hi-lo);
  var vy=-(Math.sqrt(2*0.0006*riseFor(380)))-Math.random()*0.03;
  var mesh=makeSprite(it); scene.add(mesh);
  G.objs.push({it:it,x:x,y:H+55,vx:(Math.random()-0.5)*0.03,vy:vy,r:50,sliced:false,a:1,scale:1,spin:(Math.random()-.5)*2,dspin:(Math.random()-.5)*0.05,phase:Math.random()*6,side:side,mesh:mesh});
}
function vsSliceFor(side,x1,y1,x2,y2){
  var tb=ROUNDS[VS.topicIdx].bins;
  for(var i=0;i<G.objs.length;i++){ var o=G.objs[i]; if(o.sliced || o.side!==side) continue;
    if(segHit(o,x1,y1,x2,y2)){ o.sliced=true; o.vy-=0.05; o.dspin=(o.dspin>0?1:-1)*0.28;
      var correct=tb.indexOf(o.it.bin)>=0, pts=correct?1:-1;
      if(side===0){ VS.s1=Math.max(0,VS.s1+pts); } else { VS.s2=Math.max(0,VS.s2+pts); }
      spawnBurst(o.x,o.y, correct?(side===0?"#2f7fd1":"#e24b4a"):"#d70015");
      if(typeof sfxCut==="function") sfxCut(o.it.bin);   /* same material sound for both players */
    }
  }
}
function vsUpdate(dt, now){
  VS.t-=dt; if(VS.t<=0){ vsGameOver(); return; }
  VS.topicT-=dt; if(VS.topicT<=0){ VS.topicIdx=(VS.topicIdx+1)%ROUNDS.length; VS.topicT=15000; }
  el("timeFill").style.width=(Math.max(0,VS.t)/60000*100)+"%";
  VS.spawnT-=dt; if(VS.spawnT<=0){ vsSpawn(0); vsSpawn(1); if(Math.random()<0.3) vsSpawn(Math.random()<0.5?0:1); VS.spawnT=650+Math.random()*480; }
  for(var i=G.objs.length-1;i>=0;i--){ var o=G.objs[i];
    o.vy+=0.0006*dt; if(o.vy>0.28)o.vy=0.28; o.y+=o.vy*dt; o.x+=o.vx*dt; o.spin+=o.dspin;
    if(o.sliced){ o.a-=0.05; o.scale+=0.03; }
    if(o.side===0 && o.x>W/2-24) o.x=W/2-24; if(o.side===1 && o.x<W/2+24) o.x=W/2+24;
    var w=toWorld(o.x,o.y); o.mesh.position.set(w.x,w.y,0); o.mesh.rotation.set(0.25*Math.sin(now*0.002+o.phase),0,o.spin); o.mesh.scale.setScalar(o.scale); o.mesh.material.opacity=o.a;
    if(o.y>H+110||o.a<=0){ releaseObj(o); G.objs.splice(i,1); }
  }
  if(BLADE.active){ vsSliceFor(0,BLADE.px,BLADE.py,BLADE.x,BLADE.y); BLADE.trail.push({x:BLADE.x,y:BLADE.y,t:now}); } BLADE.px=BLADE.x; BLADE.py=BLADE.y;
  if(BLADE2.active){ vsSliceFor(1,BLADE2.px,BLADE2.py,BLADE2.x,BLADE2.y); BLADE2.trail.push({x:BLADE2.x,y:BLADE2.y,t:now}); } BLADE2.px=BLADE2.x; BLADE2.py=BLADE2.y;
}
/* A lesson never reaches a real game over: tutModeEnded() restarts the practice
   instead, so no result screen, no recorded run and no life spent for real. */
function vsGameOver(){
  if(typeof tutModeEnded==="function" && tutModeEnded()) return;
  VS.running=false; el("pauseBtn").style.display="";
  var winner = VS.s1>VS.s2? "Player 1 (blue) wins!" : (VS.s2>VS.s1? "Player 2 (red) wins!" : "It's a draw!");
  el("rScore").textContent=VS.s1+" – "+VS.s2;
  el("rGrade").textContent=winner;
  var f=el("rFacts"); f.innerHTML=""; var d=document.createElement("div"); d.className="fact"; d.textContent="Slice recyclables (+1) and avoid trash (−1) — most points in 60 seconds wins."; f.appendChild(d);
  scoresHidePanel();                      /* two players on one screen — a personal best has no meaning here */
  stopCam();
  show("result");
}
/* `inner` and `w` are optional, so Versus's existing two single-colour calls are
   unchanged. Sort and Quiz pass both, through the selected blade — they used to
   carry their own duplicated copy of this loop. */
function drawTrail(trail, now, rgb, inner, w){
  while(trail.length && now-trail[0].t>=140) trail.shift();
  if(trail.length<2) return;
  w=w||1;
  fxc.lineCap="round"; fxc.lineJoin="round";
  for(var b=1;b<trail.length;b++){ var f=b/trail.length;
    fxc.strokeStyle="rgba("+rgb+","+(f*0.85)+")"; fxc.lineWidth=(f*12+2)*w;
    fxc.beginPath(); fxc.moveTo(trail[b-1].x,trail[b-1].y); fxc.lineTo(trail[b].x,trail[b].y); fxc.stroke(); }
  if(!inner) return;
  for(var c=1;c<trail.length;c++){ var g=c/trail.length;
    fxc.strokeStyle="rgba("+inner+","+(g*0.55)+")"; fxc.lineWidth=(g*7+1)*w;
    fxc.beginPath(); fxc.moveTo(trail[c-1].x,trail[c-1].y); fxc.lineTo(trail[c].x,trail[c].y); fxc.stroke(); }
}
function vsDraw(now){
  fxc.save(); fxc.strokeStyle="rgba(120,140,130,.45)"; fxc.lineWidth=3; fxc.setLineDash([10,10]); fxc.beginPath(); fxc.moveTo(W/2,0); fxc.lineTo(W/2,H); fxc.stroke(); fxc.setLineDash([]); fxc.restore();
  /* All of this used to sit at y=8-60: the topic box landed straight on the
     round banner (also centred, y 0-50) and the two scores flanked the score
     badge and the pause button. Everything drops below HUDSAFE.

     The white box was a light-theme leftover too — a bright slab on a dark
     playfield — so it is now a dark panel like the rest of the V6 chrome. */
  var vy=(typeof hudRow==="function")?hudRow(0)-14:100;
  var R=ROUNDS[VS.topicIdx];
  fxc.textAlign="center"; fxc.textBaseline="top";
  fxc.fillStyle="#160f0a"; fxc.globalAlpha=0.92;
  fxc.strokeStyle=R.color; fxc.lineWidth=2;
  var bw=Math.max(180, fxc.measureText("Slice: "+R.topic).width+40);
  fxc.beginPath(); fxc.roundRect(W/2-bw/2, vy, bw, 52, 14); fxc.fill();
  fxc.globalAlpha=1; fxc.stroke();
  fxc.fillStyle=R.color; fxc.font="700 22px "+FONT; fxc.fillText("Slice: "+R.topic, W/2, vy+4);
  fxc.fillStyle="#fbe9d0"; fxc.font="700 15px "+FONT; fxc.fillText(Math.ceil(Math.max(0,VS.t)/1000)+"s", W/2, vy+30);
  /* Player scores sit on their OWN half, clear of the centre box. */
  fxc.fillStyle="#3f9cff"; fxc.font="700 28px "+FONT; fxc.fillText("P1  "+VS.s1, W*0.25, vy+4);
  fxc.fillStyle="#e24b4a"; fxc.fillText("P2  "+VS.s2, W*0.75, vy+4);
  drawTrail(BLADE.trail, now, "47,127,209"); drawTrail(BLADE2.trail, now, "226,75,74");
  if(BLADE.active){ fxc.strokeStyle="rgba(47,127,209,.95)"; fxc.lineWidth=3; fxc.beginPath(); fxc.arc(BLADE.x,BLADE.y,20,0,7); fxc.stroke(); }
  if(BLADE2.active){ fxc.strokeStyle="rgba(226,75,74,.95)"; fxc.lineWidth=3; fxc.beginPath(); fxc.arc(BLADE2.x,BLADE2.y,20,0,7); fxc.stroke(); }
}

/* ================= phone controller (MQTT relay — pub/sub, no peer-unavailable) ================= */
var mqttClient=null, roomCode=null;
var BROKER="wss://broker.emqx.io:8084/mqtt";
function drawQR(link){
  el("connUrl").textContent=link;
  var box=el("qrbox"); box.innerHTML="";
  try{
    if(window.QRCode){ new QRCode(box,{text:link, width:224, height:224, correctLevel:QRCode.CorrectLevel.M}); }
    else throw new Error("no lib");
  }catch(e){
    box.innerHTML='<div style="font-size:13px;color:#1d1d1f;max-width:220px;word-break:break-all">Open this link on your phone:<br><b>'+link+'</b></div>';
  }
}
function roomLine(extra){
  el("connStatus").innerHTML='<b>Room code: <span style="font-size:26px;letter-spacing:3px">'+roomCode+'</span></b>'+(extra?('<br><span style="font-size:12px;color:#6e6e73">'+extra+'</span>'):"");
}
function hostStartConnect(){
  show("connect");
  remReset();                                        /* fresh slots for a fresh room */
  roomCode=(""+Math.floor(1000+Math.random()*9000));
  var base=new URL("controller.html", location.href); base.search="?room="+roomCode;
  var link=base.toString();
  drawQR(link);
  el("connLead").innerHTML = (GMODE==="vs")
    ? 'Versus needs <b>two phones</b>. Both scan this same code — first to connect is Player 1 (left), second is Player 2 (right). Hold sideways like a knife handle and slash.'
    : 'Open your phone camera and scan this code. Hold your phone sideways like a knife handle and slash to slice.';
  el("connGo").disabled=true;
  el("connGo").textContent=(GMODE==="vs") ? "Waiting for 2 phones…" : "Waiting for phone…";
  roomLine("Connecting to relay…");
  connectHostMqtt();
  el("connUrl").innerHTML='<button class="btn ghost" id="copyLinkBtn" style="font-size:13px;padding:8px 16px">Copy link</button>';
  document.getElementById("copyLinkBtn").addEventListener("click", function(){
    try{ navigator.clipboard.writeText(link).then(function(){ el("connUrl").innerHTML='Copied!'; });
    }catch(e){ el("connUrl").innerHTML='Link: <span style="word-break:break-all;font-size:12px">'+link+'</span>'; }
  });
}
/* NO TURN. The openrelay.metered.ca entry that used to sit here is DEAD — that
   free tier was discontinued, and gathering with iceTransportPolicy:"relay"
   against it now returns zero candidates and ICE error 701 (STUN host lookup).
   It cost handshake time and delivered nothing.

   What that means: the direct link needs a path STUN can find. Same WiFi is the
   easy one and is what the start screen already tells players to do. A phone on
   mobile data behind carrier NAT, or school WiFi with client isolation, has no
   path at all and falls back to the relay — ~205ms, capped near 11 updates/sec.
   If that ever needs to work, it needs a real TURN server with real credentials;
   there is no free one worth relying on. Multiple STUN hosts so one being
   unreachable does not cost us the srflx candidate. */
var HICE={iceServers:[{urls:["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302","stun:stun.cloudflare.com:3478"]}]};
var hostTopic=null;
/* ---- one peer connection PER PHONE, keyed by the controller's cid ----
   This used to be a single `hostPC`, and Versus refused to answer an offer at
   all because "two phones can't share one RTCPeerConnection". True, and the
   wrong conclusion: the host holds one connection each instead. Versus was
   therefore played entirely on the MQTT relay — ~205ms round trip and the
   broker capped near 11 msg/s for the WHOLE topic, so two phones publishing at
   RELAYMS each got about half their packets dropped and landed near 5.5Hz
   apiece. That is the two-player lag; the sensors were never the problem.

   Everything downstream was already per-player (RSAMP is keyed by slot,
   applyRemote splits the screen by slot), so only the signalling was single.

   Both directions of signalling must carry the cid: two phones share one MQTT
   topic, so an untagged answer or candidate is consumed by whichever phone sees
   it first. The controller already drops messages whose cid is not its own. */
var HPEER={};
function hostPeer(cid){
  if(!HPEER[cid]) HPEER[cid]={pc:null, iceQ:[], remoteSet:false, slot:0};
  return HPEER[cid];
}
/* ICE candidates arrive over the same relay as the offer. The old code had
   `d.type==="ice" && hostPC` — so any candidate arriving before the offer built
   the peer was SILENTLY DISCARDED, and addIceCandidate's rejection is a promise
   the sync try/catch could never have caught anyway.

   Honest scope: browsers queue addIceCandidate behind a pending
   setRemoteDescription, so the common ordering is absorbed by the browser and
   this was probably not the whole latency story. The discard when the peer is
   null is a real unconditional loss though, and losing candidates means ICE can
   fail and the phone then plays the whole game on the relay — measured at
   ~205ms round trip, capped near 11 msg/s. Cheap to make correct; do so. */
function hostAddIce(cid, c){
  var p=hostPeer(cid);
  if(!p.pc || !p.remoteSet){ p.iceQ.push(c); return; }
  try{ var r=p.pc.addIceCandidate(c); if(r&&r.catch) r.catch(function(){}); }catch(e){}
}
function hostFlushIce(cid){
  var p=hostPeer(cid); p.remoteSet=true;
  /* Drain into a copy and clear FIRST. Replaying in place would let hostAddIce
     push straight back into the array being iterated — the index and the length
     then advance together and the loop never ends. */
  var q=p.iceQ.slice(); p.iceQ.length=0;
  for(var i=0;i<q.length;i++) hostAddIce(cid, q[i]);
}
function hostClosePeers(){
  for(var cid in HPEER){ if(!HPEER.hasOwnProperty(cid)) continue;
    if(HPEER[cid].pc){ try{ HPEER[cid].pc.close(); }catch(e){} } }
  HPEER={};
}
function hostPub(o){ if(mqttClient&&mqttClient.connected) mqttClient.publish(hostTopic, JSON.stringify(o), {qos:0}); }
/* Versus needs both phones before it can start; every other mode needs one. */
function remStatus(){
  var need=remMax(), got=remCount(), s=el("connStatus"), b=el("connGo");
  if(!s||!b) return;
  if(got>=need){
    s.innerHTML = need===2 ? 'Both phones <b>connected!</b> — press Start game'
                           : 'Phone <b>connected!</b> — press Start game';
    b.disabled=false; b.textContent="Start game";
  } else if(got>0){
    s.innerHTML = 'Player 1 connected. <b>Waiting for Player 2…</b> (same code)';
    b.disabled=true; b.textContent="Waiting for Player 2…";
  }
}
function hostAnswer(cid, offer){
  if(typeof RTCPeerConnection==="undefined") return;
  /* An offer can beat the hello here, so claim the slot now — remSlot is
     idempotent. -1 means the room is full: that phone gets no peer at all. */
  var slot=remSlot(cid); if(slot<0) return;
  try{
    var p=hostPeer(cid);
    /* A renegotiation from the same phone replaces its peer. The old one has to
       be closed, or it leaks and its data channel keeps driving the blade. */
    if(p.pc){ try{ p.pc.close(); }catch(e){} }
    p.remoteSet=false; p.iceQ.length=0;               /* a fresh negotiation */
    p.slot=slot;
    var pc=new RTCPeerConnection(HICE);
    p.pc=pc;
    pc.onicecandidate=function(e){ if(e.candidate) hostPub({from:"host", type:"ice", cid:cid, cand:e.candidate}); };
    pc.ondatachannel=function(e){ var ch=e.channel;
      ch.onopen=function(){ roomLine(remMax()===2 ? "Direct link to player "+(p.slot+1)+" — lowest delay."
                                                  : "Direct link to the phone — lowest delay."); };
      /* p.slot, not 0 — hardcoding 0 here sent player 2's phone to player 1's blade. */
      ch.onmessage=function(m){ try{ var o=JSON.parse(m.data); applyRemote(o.g,o.b,p.slot,false,o.seq); }catch(_){} }; };
    /* Flush the moment the remote description lands, not when the answer is
       published — candidates queued in between are still valid and waiting
       longer than necessary only lengthens the handshake. */
    pc.setRemoteDescription(offer).then(function(){ hostFlushIce(cid); return pc.createAnswer(); }).then(function(a){ return pc.setLocalDescription(a); }).then(function(){ hostPub({from:"host", type:"answer", cid:cid, sdp:pc.localDescription}); }).catch(function(){});
  }catch(e){}
}
function connectHostMqtt(){
  if(typeof mqtt==="undefined"){ roomLine("Relay library didn't load — check internet and reload."); return; }
  hostTopic="slicesort/"+roomCode;
  try{ mqttClient=mqtt.connect(BROKER,{clientId:"host_"+roomCode+"_"+Math.random().toString(16).slice(2,8), reconnectPeriod:2500, connectTimeout:9000}); }
  catch(e){ roomLine("Couldn't reach the relay."); return; }
  mqttClient.on("connect", function(){ mqttClient.subscribe(hostTopic, function(){ roomLine("Scan the QR, or open controller.html and type this code."); }); });
  mqttClient.on("message", function(t, payload){ var d; try{ d=JSON.parse(payload.toString()); }catch(e){ return; }
    if(d.from==="host") return;                                  /* ignore our own echoed messages */
    if(d.type==="hello"){
      var slot=remSlot(d.cid);
      /* `players` lets the phone size its relay rate to how many share the topic */
      if(slot>=0) hostPub({from:"host", type:"slot", cid:d.cid, slot:slot, players:remMax()});   /* tell the phone which player it is */
      remStatus();
    }
    else if(d.type==="orient"){
      var s = d.cid ? REM[d.cid] : 0;               /* no cid = older controller, treat as Player 1 */
      if(s!==undefined) applyRemote(d.g,d.b,s,true,d.seq); /* unknown cid = room was full; ignore it */
    }
    /* Every phone gets its own peer connection, Versus included — this used to
       be gated to `remMax()===1`, which is what pinned two-player Versus to the
       relay for the whole game. An untagged offer is an older controller; it is
       Player 1 by the same rule the orient handler uses. */
    else if(d.type==="offer"){ hostAnswer(d.cid||"anon", d.sdp); }
    /* No `&& pc` guard: a candidate that beats the offer here used to be
       thrown away, which is one of the two ways the direct link failed. */
    else if(d.type==="ice"){ hostAddIce(d.cid||"anon", d.cand); }
  });
  mqttClient.on("error", function(){ roomLine("Relay error — check internet, then reload."); });
}
/* ---- phone slots ----
   Two phones publish to the same MQTT topic, so the only thing telling them
   apart is the `cid` each controller generates. First hello gets Player 1,
   second gets Player 2. Versus takes two; every other mode takes one. */
var REM={}, remOrder=[];
function remMax(){ return GMODE==="vs" ? 2 : 1; }
/* Peers are closed too: a second round inheriting the previous round's
   connections would keep driving blades from a phone that has since re-paired
   into a different slot. */
function remReset(){ REM={}; remOrder=[]; hostClosePeers(); remoteReset(); }
function remSlot(cid){
  if(!cid) cid="anon";
  if(REM[cid]===undefined){
    if(remOrder.length>=remMax()) return -1;        /* room already full */
    REM[cid]=remOrder.length; remOrder.push(cid);
  }
  return REM[cid];
}
function remCount(){ return remOrder.length; }

/* ---- dead reckoning for phone input ----
   Samples arrive at 60Hz on the WebRTC data channel but only ~11Hz on the MQTT
   relay, because that broker caps there (see RELAYMS in controller.html).

   Simply holding the last sample until the next one arrives makes an 11Hz feed
   LOOK like 11Hz: the blade sits still for 90ms and then jumps. That reads as
   lag on its own, on top of the transport delay — and the transport delay is
   not removable. Measured across four public brokers the round trip is
   188-206ms whichever you pick, so switching brokers buys nothing.

   So estimate velocity between samples and carry the blade along it each frame.
   That removes the step entirely and cancels the sample-gap part of the delay.

   `lead` additionally aims at where the hand will be, to cover the transport
   delay itself. It is applied ONLY to relay samples. Swept against a simulated
   swing (tests/latency.js runs the same model):

     lead    felt lag   tracking error   worst excursion
       0ms     200ms        23.7%             41%
      120ms     155ms        21.8%             40%
      180ms     115ms        18.4%             43%

   Every metric improves and the worst excursion barely moves, because during a
   fast swing the blade is already far from the hand — the lead is not what puts
   it there. On the DIRECT link the same lead is pure harm (0.00% error at lead
   0, 5.2% at 45ms), which is why it is per-path and not global.

   Smoothing used to live here and was removed: it lagged behind its own
   prediction and made every metric worse, including leaving the blade hundreds
   of pixels from the last known-good position after a reconnect.

   `cap` bounds total extrapolation, `maxJump` bounds how far a bad velocity
   estimate can throw the blade, and `vmin` stops a resting hand from jittering
   once the lead multiplies its noise. */
var RCFG={ lead:120, cap:220, maxJump:0.20, vlp:0.45, vmin:0.03, stale:350, vmax:1.6, relayMs:90, staleMul:2.5 };
var RSAMP={};
/* How long to keep trusting a sample before declaring the input lost.

   A flat 350ms was tuned against ONE phone on the relay, publishing every
   RELAYMS (90ms). Two phones share the topic and so publish half as often each
   (the controller scales RELAYMS by the player count), which puts the expected
   gap at 180ms — two dropped publishes and the blade blanked to INPUT LOST
   mid-swing. The window is derived from the cadence that path actually has, and
   never drops below the tuned 350, so single-player is unchanged. */
function remStale(relay){
  return relay ? Math.max(RCFG.stale, RCFG.staleMul*RCFG.relayMs*remMax()) : RCFG.stale;
}
function remoteReset(){ RSAMP={}; }
function remoteSample(slot, x, y, viaRelay, seq){
  var now=performance.now(), r=RSAMP[slot];
  var lead=viaRelay ? RCFG.lead : 0;
  if(!r){ RSAMP[slot]={x:x, y:y, t:now, vx:0, vy:0, lead:lead, relay:!!viaRelay, seq:(typeof seq==="number"?seq:null)}; return true; }
  if(typeof seq==="number" && typeof r.seq==="number" && seq<=r.seq) return false;
  if(typeof seq==="number") r.seq=seq;
  var transportChanged=r.relay!==!!viaRelay;
  if(transportChanged){
    /* A direct/relay transition changes both cadence and latency. Never carry
       the old path's velocity into the new one; it can reverse the blade when
       the first packet from the new path arrives. */
    r.vx=0; r.vy=0; r.relay=!!viaRelay;
  }
  r.lead=lead;
  var dt=now-r.t;
  if(dt>=remStale(r.relay)){ r.vx=0; r.vy=0; }        /* long gap: stop guessing */
  else if(dt>4 && !transportChanged){
    /* Low-passed, so one noisy sample cannot fling the blade across the screen */
    r.vx += ((x-r.x)/dt - r.vx)*RCFG.vlp;
    r.vy += ((y-r.y)/dt - r.vy)*RCFG.vlp;
    r.vx=Math.max(-RCFG.vmax,Math.min(RCFG.vmax,r.vx));
    r.vy=Math.max(-RCFG.vmax,Math.min(RCFG.vmax,r.vy));
    /* px per ms. Below this the hand is holding still and any "velocity" is
       sensor noise, which the lead would otherwise magnify into a shake. */
    if(Math.abs(r.vx)<RCFG.vmin) r.vx=0;
    if(Math.abs(r.vy)<RCFG.vmin) r.vy=0;
  }
  r.x=x; r.y=y; r.t=now;
  return true;
}
function remotePos(slot, now){
  var r=RSAMP[slot]; if(!r) return null;
  if(now-r.t>remStale(r.relay)) return null;
  var age=Math.min(now-r.t+r.lead, RCFG.cap);
  var px=r.x+r.vx*age, py=r.y+r.vy*age;
  var mx=W*RCFG.maxJump, my=H*RCFG.maxJump;
  px=Math.max(r.x-mx, Math.min(r.x+mx, px));
  py=Math.max(r.y-my, Math.min(r.y+my, py));
  return { x:Math.max(0,Math.min(W,px)), y:Math.max(0,Math.min(H,py)) };
}
/* Called once per frame from loop(), so the blade moves at the render rate
   rather than at whatever rate the network happens to deliver. */
function remoteDrive(now){
  var p0=remotePos(0, now);
  if(p0){ BLADE.x=p0.x; BLADE.y=p0.y; BLADE.active=true; }
  else BLADE.active=false;
  var states=[];
  if(RSAMP[0]) states.push(RSAMP[0].relay?"RELAY / delayed":"DIRECT");
  if(GMODE==="vs"){
    var p1=remotePos(1, now);
    if(p1){ BLADE2.x=p1.x; BLADE2.y=p1.y; BLADE2.active=true; }
    else BLADE2.active=false;
    if(RSAMP[1]) states.push("P2 "+(RSAMP[1].relay?"RELAY / delayed":"DIRECT"));
  }
  var st=el("phoneState");
  if(st){
    var lost=(RSAMP[0]&&!BLADE.active)||(GMODE==="vs"&&RSAMP[1]&&!BLADE2.active);
    st.textContent=lost?"INPUT LOST":(states.length?states.join(" · "):"WAITING FOR INPUT");
    st.classList.toggle("lost",lost); st.classList.remove("hidden");
  }
}
/* Versus gives each player half the screen, matching the webcam split. */
/* viaRelay decides how far ahead we aim — see RCFG.lead. The two callers know
   which transport they are: the data channel is direct, MQTT is the relay. */
function applyRemote(g,b,slot,viaRelay,seq){
  var fx=Math.max(0,Math.min(1, 0.5+(g||0)/60));
  var y=Math.max(0,Math.min(H, H*(((b||45)-15)/55)));
  var x;
  if(GMODE==="vs") x = (slot===1) ? W/2+6+fx*(W/2-6) : fx*(W/2-6);
  else             x = fx*W;
  remoteSample(slot||0, x, y, !!viaRelay, seq);
}
function stopPeer(){ if(mqttClient){ try{ mqttClient.end(true); }catch(e){} } }

/* ================= main loop ================= */
var last=performance.now(), tnow=0;
/* THE RENDER LOOP MUST NEVER DIE.

   A single throw inside a rAF callback stops the chain permanently: the board
   freezes, items stop arriving, and the only trace is one line in a console
   nobody has open. `CLAUDE.md` records this class already (canvas arc() throws
   on a negative radius), and it has now cost two long diagnoses.

   So the body is wrapped. A throwing frame is reported ON SCREEN and the chain
   is rescheduled, which turns "the game is frozen and I don't know why" into a
   message naming the failure. Only the FIRST error is reported — a fault that
   repeats every frame must not spam, and re-rendering the message would itself
   be work in a loop that is already failing. */
var loopErr=null;
/* Reports into #errBar, which exists only for this and has its own buttons.

   It must NOT write onto any game control. The first version set
   `el("ovlBtn").onclick = location.reload` — but that button already had a
   click listener calling startRound(), and setting onclick does not replace a
   listener, it adds a second handler. So once this had fired even once, the
   next press of "Start round" ran startRound() AND reloaded the page: the game
   bounced to the main menu and became impossible to start, in every mode. A
   global error report borrowing game UI turned a recoverable fault into a
   worse bug than the one it was reporting. */
function loopFail(e){
  if(loopErr) return;                       /* first one only — never spam */
  loopErr=(e&&e.message)||"unknown error";
  try{
    var bar=el("errBar"); if(!bar) return;
    el("errMsg").innerHTML="<b>The game hit an error:</b> "+loopErr+
      "<br>Play may not work correctly. Please report this message.";
    bar.classList.remove("hidden");
  }catch(_){}                               /* reporting must not throw either */
}
/* Wired once at load; `errBar` is inert until loopFail() reveals it. */
(function(){
  var r=el("errReload"), h=el("errHide");
  if(r) r.addEventListener("click", function(){ location.reload(); });
  /* Dismiss clears the latch too, so a LATER, different fault can still report
     instead of being swallowed by the once-only guard. */
  if(h) h.addEventListener("click", function(){
    el("errBar").classList.add("hidden"); loopErr=null; });
})();
/* Opt-in FPS meter: add ?fps=1 to the URL. Off by default and costing nothing
   when off, because the only way to tell a slow MACHINE from slow CODE is a
   number measured on the machine that feels slow. Shows the running frame rate
   and the worst frame in the last second — a steady 60 with a 40ms spike is a
   very different problem from a flat 30. */
var SHOWFPS=qs.get("fps")==="1", fpsN=0, fpsT=0, fpsWorst=0, fpsBox=null;
function fpsTick(now, cost){
  if(!fpsBox){
    fpsBox=document.createElement("div");
    fpsBox.style.cssText="position:fixed;left:10px;top:10px;z-index:999;background:rgba(0,0,0,.72);"+
      "color:#7fe08a;font:600 12px ui-monospace,Menlo,monospace;padding:6px 10px;border-radius:8px;"+
      "pointer-events:none;white-space:pre";
    document.body.appendChild(fpsBox);
  }
  fpsN++; if(cost>fpsWorst) fpsWorst=cost;
  if(now-fpsT>=1000){
    fpsBox.textContent=Math.round(fpsN*1000/(now-fpsT))+" fps   worst frame "+fpsWorst.toFixed(1)+"ms"+
      "\nitems "+G.objs.length+"   dpr "+DPR.toFixed(2)+"   "+Math.round(W)+"x"+Math.round(H);
    fpsN=0; fpsT=now; fpsWorst=0;
  }
}
function loop(now){
  var t0=SHOWFPS?performance.now():0;
  try{ loopBody(now); }
  catch(e){ loopFail(e); }
  finally{
    if(SHOWFPS){ try{ fpsTick(now, performance.now()-t0); }catch(_){} }
    requestAnimationFrame(loop);            /* the chain survives a bad frame */
  }
}
function loopBody(now){
  var dt=Math.min(48,now-last); last=now; tnow=now;
  /* Advance the phone blade BEFORE any mode reads it, so every mode sees a
     position for this frame rather than whatever the last packet left behind.
     Mouse and webcam already update at their own event rate and are untouched. */
  if(controlMode==="remote") remoteDrive(now);
  /* A lesson owns the frame only while it is SCRIPTED — its own slicing (which
     scores nothing), its own spawns, no mode update underneath.

     A `play` step is the opposite and deliberately so: it hands the frame back
     to the real mode, so the player gets the actual game rather than a
     demonstration of it. Isolation does not depend on owning the frame — it is
     scoresRecord refusing to record and tutModeEnded refusing the result
     screen — so the real mechanics can run without touching real progress. */
  if(typeof TUT!=="undefined" && TUT.active && !TUT.playing){
    updatePhysics(dt);
    if(BLADE.active){ tutSliceAlong(BLADE.px,BLADE.py,BLADE.x,BLADE.y); BLADE.trail.push({x:BLADE.x,y:BLADE.y,t:now}); }
    BLADE.px=BLADE.x; BLADE.py=BLADE.y;
    tutUpdate(dt, now);
  } else if(GMODE==="quiz"){
    if(Q.running && !G.paused){
      quizUpdate(dt);
      if(BLADE.active){ quizSliceCheck(BLADE.px,BLADE.py,BLADE.x,BLADE.y); BLADE.trail.push({x:BLADE.x,y:BLADE.y,t:now}); }
      BLADE.px=BLADE.x; BLADE.py=BLADE.y;
    }
  } else if(GMODE==="tsunami"){
    /* No slicing here: Bin It reads BLADE.x purely as "where the player is"
       and moves the bin there. No blade, and no trail to draw. */
    if(TS.running && !G.paused){ tsunamiUpdate(dt, now); BLADE.px=BLADE.x; BLADE.py=BLADE.y; }
  } else if(GMODE==="vs"){
    if(VS.running && !G.paused){ vsUpdate(dt, now); }
  } else if(G.running && !G.paused){
    specialUpdate(dt);
    /* the +5s clock can push time above a full bar, so clamp the fill */
    var timeLeft=Math.max(0,G.roundEndAt-now); el("timeFill").style.width=Math.min(100,timeLeft/DIFF.round*100)+"%";
    if(PWR.freeze<=0){                                  /* a freeze halts the conveyor as well as the items */
      G.spawnT-=dt; if(G.spawnT<=0){
        if(Math.random()<(DIFF.burst||0)){ var seg=(W-160)/3;   /* 3-item wave, spread left/centre/right so they don't cluster */
          spawn(80+seg*0.5+(Math.random()-0.5)*seg*0.25); spawn(80+seg*1.5+(Math.random()-0.5)*seg*0.25); spawn(80+seg*2.5+(Math.random()-0.5)*seg*0.25);
          G.spawnT=DIFF.spawnMin+700+Math.random()*DIFF.spawnRange; }
        else { spawn(); if(Math.random()<DIFF.dbl) spawn();   /* specials are NOT spawned here — they run on their own timer in specialUpdate */
          G.spawnT=DIFF.spawnMin+Math.random()*DIFF.spawnRange; }
      }
    }
    updatePhysics(dt);
    if(BLADE.active){ sliceAlong(BLADE.px,BLADE.py,BLADE.x,BLADE.y); BLADE.trail.push({x:BLADE.x,y:BLADE.y,t:now}); }
    BLADE.px=BLADE.x; BLADE.py=BLADE.y;
    if(timeLeft<=0 && G.objs.length<3) endRound();
  }
  if(renderer) renderer.render(scene,camera);
  drawFx(now);
  /* NO requestAnimationFrame here — loop() owns rescheduling in its `finally`.
     Leaving one here would schedule a second chain on every frame, doubling the
     frame rate each time until the tab dies. */
}
/* Item labels are drawn for every item, every frame — up to 16 a frame. The two
   costly calls here were setting `font` (re-resolves the font stack) and
   measureText (lays out the string) for text that NEVER changes: the label is
   the item's name. Both are now cached by string, so a steady board does one
   layout per item type for the whole session instead of 16 per frame.

   The font assignment stays UNCONDITIONAL on purpose. Caching it was tried and
   is wrong: quiz cards, score pops and the bin labels all set fxc.font too, so a
   cached "we already set it" flag goes stale mid-frame and labels render in
   whichever font drew last. Only the width is cached — that is the measureText
   layout, which is the expensive half and depends only on the string. */
var LBLW={};
function roundedText(txt,x,y){
  fxc.font="600 13px "+FONT;
  var w=LBLW[txt];
  if(w===undefined){ w=fxc.measureText(txt).width+16; LBLW[txt]=w; }
  var h=22;
  fxc.fillStyle="rgba(255,255,255,.92)"; fxc.strokeStyle="rgba(0,0,0,.08)"; fxc.lineWidth=1;
  var rx=x-w/2, ry=y-h/2, rr=11;
  fxc.beginPath();
  fxc.moveTo(rx+rr,ry); fxc.arcTo(rx+w,ry,rx+w,ry+h,rr); fxc.arcTo(rx+w,ry+h,rx,ry+h,rr);
  fxc.arcTo(rx,ry+h,rx,ry,rr); fxc.arcTo(rx,ry,rx+w,ry,rr); fxc.closePath(); fxc.fill(); fxc.stroke();
  fxc.fillStyle="#1d1d1f"; fxc.textAlign="center"; fxc.textBaseline="middle"; fxc.fillText(txt,x,y);
}
function drawFx(now){
  fxc.clearRect(0,0,W,H);
  /* A SCRIPTED lesson step draws its own arena furniture (the aim ring, the
     Versus bot) and suppresses the host mode's, which belongs to a real run —
     without this the ring the coach card asks you to reach was never drawn.
     A `play` step draws the mode for real, and gets the tutorial's own overlay
     on top rather than instead. */
  var tutScripted=(typeof TUT!=="undefined" && TUT.active && !TUT.playing);
  if(tutScripted){ tutDraw(now); }
  else if(GMODE==="quiz"){ quizDraw(now); }
  else if(GMODE==="tsunami"){ tsunamiDraw(now); }
  else if(GMODE==="vs"){ vsDraw(now); }
  else if(G.running && !G.paused){ specialDraw(now); }
  if(!tutScripted && typeof TUT!=="undefined" && TUT.active) tutDraw(now);
  /* item name labels */
  if(G.running || (GMODE==="tsunami" && TS.running) || (GMODE==="vs" && VS.running)){
    for(var i=0;i<G.objs.length;i++){ var o=G.objs[i]; if(o.a<0.5) continue;
      var ly=o.y+o.r+4;
      /* Bin It's bin is 82px tall, so a label sitting UNDER an item that is
         about to land covers the bin's own label — at exactly the moment the
         player needs to read what the bin wants. Flip it above instead. */
      if(GMODE==="tsunami" && ly>binLineY()-16) ly=o.y-o.r-12;
      roundedText(o.it.n, o.x, ly);
    }
  }
  /* score pops */
  for(var k=G.pops.length-1;k>=0;k--){ var p=G.pops[k]; p.y-=1.1; p.a-=0.02;
    fxc.save(); fxc.globalAlpha=Math.max(0,p.a); fxc.fillStyle=p.col;
    fxc.font="700 26px "+FONT; fxc.textAlign="center"; fxc.textBaseline="middle";
    fxc.fillText(p.txt,p.x,p.y); fxc.restore(); if(p.a<=0) G.pops.splice(k,1); }
  /* slice flashes */
  for(var fi=G.flashes.length-1;fi>=0;fi--){ var fl=G.flashes[fi]; fl.r+=6; fl.life-=0.09;
    fxc.save(); fxc.globalAlpha=Math.max(0,fl.life); fxc.strokeStyle="#ffffff"; fxc.lineWidth=4;
    fxc.beginPath(); fxc.arc(fl.x,fl.y,fl.r,0,7); fxc.stroke(); fxc.restore(); if(fl.life<=0) G.flashes.splice(fi,1); }
  /* debris particles */
  for(var pi=G.parts.length-1;pi>=0;pi--){ var pt=G.parts[pi]; pt.vy+=0.22; pt.x+=pt.vx; pt.y+=pt.vy; pt.life-=0.028;
    if(pt.life<=0){ G.parts.splice(pi,1); continue; }
    var pr=Math.max(0.1, pt.sz*pt.life);
    fxc.save(); fxc.globalAlpha=Math.max(0,pt.life); fxc.fillStyle=pt.col;
    fxc.beginPath(); fxc.arc(pt.x,pt.y,pr,0,7); fxc.fill(); fxc.restore(); }
  /* blade trail + marker (single-blade modes; VS draws its own two coloured
     blades, and Bin It has no blade at all — the bin IS the cursor there). */
  if(GMODE!=="vs" && GMODE!=="tsunami"){
  /* This used to be its own copy of drawTrail's loop. It now goes through the
     player's chosen blade, which delegates back to drawTrail — the same function
     Versus uses — so there is one trail implementation instead of two. */
  bladeDrawTrail(BLADE.trail, now);
  /* blade marker for cam/remote */
  if((controlMode==="cam"||controlMode==="remote") && BLADE.active){
    /* Tinted to the blade: on webcam and phone this ring is on screen far more
       than the trail is, so leaving it fixed green would hide the player's
       choice in exactly the modes where it is most visible. */
    var mk=(typeof bladeMarkerRGB==="function") ? bladeMarkerRGB() : "32,164,90";
    fxc.save();
    fxc.strokeStyle="rgba("+mk+",.95)"; fxc.lineWidth=3; fxc.beginPath(); fxc.arc(BLADE.x,BLADE.y,20,0,7); fxc.stroke();
    fxc.fillStyle="rgba("+mk+",.95)"; fxc.beginPath(); fxc.arc(BLADE.x,BLADE.y,6,0,7); fxc.fill();
    roundedText(controlMode==="cam"?"YOUR HAND":"YOUR BLADE", BLADE.x, BLADE.y-30);
    fxc.restore();
  }
  }
}

/* ================= screens/wire ================= */
function show(id){ ["start","connect","controller","play","result","blades","tutorial"].forEach(function(s){ var e=el(s); if(e) e.classList.toggle("hidden", s!==id); });
  /* These screens scroll now, and display:none does NOT reset scrollTop. Without
     this, reaching "Play again" at the bottom of the result screen leaves it
     scrolled there, so the NEXT game over opens past your score. Always open a
     screen at the top. */
  var sc=el(id); if(sc) sc.scrollTop=0;
  if(id==="play"){
    /* Versus keeps its two scores on the canvas, one per half, so the DOM badge
       has nowhere sensible to point and showed a permanent 0 beside them. Driven
       from HERE, not from launchVS, because hiding it in one launcher leaves it
       hidden for every other mode afterwards. */
    var sb=document.querySelector(".scoreBadge");
    if(sb) sb.classList.toggle("hidden", GMODE==="vs");
  }
  if(id==="start"){
    scoresRenderStartBest();                  /* refresh the best-score line after a run */
    if(typeof bladeRenderLvl==="function") bladeRenderLvl("lvlBar");   /* XP may have just changed */
    syncControls();          /* GMODE may have changed during the round */
  } }
function selectControl(mode){
  document.querySelectorAll(".opt").forEach(function(x){
    var on = x.dataset.mode===mode;
    x.classList.toggle("sel", on); x.setAttribute("aria-pressed", on?"true":"false");
  });
  controlMode=mode;
}
document.querySelectorAll(".opt").forEach(function(o){ o.addEventListener("click", function(){
  selectControl(o.dataset.mode); menuLabels(); }); });

/* ---- which controls a mode can actually be played with ----
   Versus drives TWO blades (BLADE and BLADE2) from two webcam hands or two
   phones. A mouse gives one cursor, so it cannot play it — but the menu offered
   it anyway, which reads as "this works".

   It was worse than a dead option: launchVS() routed `else setupCamVS()`, so
   picking Mouse + Versus silently started the CAMERA, and denying access alerted
   "Versus needs a webcam" and bounced the player back to the menu. They asked
   for a mouse and got a camera prompt. */
function controlsFor(mode){
  return mode==="vs" ? ["cam","remote"] : ["cam","remote","mouse"];
}
function syncControls(){
  var allowed=controlsFor(GMODE);
  document.querySelectorAll(".opt").forEach(function(o){
    var ok=allowed.indexOf(o.dataset.mode)>=0;
    o.classList.toggle("hidden", !ok);
    /* display:none already drops it from the tab order; the attribute keeps
       state honest if that class is ever changed to something visual. */
    o.disabled=!ok;
  });
  /* No column reflow to do: the V6 menu lists controls vertically, so hiding
     the Mouse tile just removes a row. The old `.choose.twoUp` 3->2 grid fix
     went with the 3-up layout. */
  /* THE IMPORTANT PART. Hiding the tile while controlMode stays "mouse" is
     exactly the silent-camera bug. This also catches a controlMode that
     setupCam()'s failure path flipped to "mouse" behind the player's back in an
     earlier round. */
  if(allowed.indexOf(controlMode)<0) selectControl("cam");
  /* Versus is the only mode that needs the two-player explanation. */
  var v=el("v6Versus"); if(v) v.classList.toggle("hidden", GMODE!=="vs");
  paintSegs();
  menuLabels();
}

/* Paint the mode and speed tiles FROM state, not from whatever was last clicked.
   segDelegate only highlights on a click, but GMODE is also assigned in code —
   launchGame() sets "sort", launchQuiz() "quiz", launchVS() "vs" — so after
   playing a round the menu could show Sort highlighted while the header said
   "Versus selected". The tiles are a view of GMODE/DIFF; render them that way. */
function paintSegs(){
  var ms=el("modeSeg");
  if(ms) Array.prototype.forEach.call(ms.querySelectorAll("button[data-g]"), function(b){
    var on=b.dataset.g===GMODE;
    b.classList.toggle("on", on); b.setAttribute("aria-pressed", on?"true":"false");
  });
  var ds=el("diffSeg");
  if(ds) Array.prototype.forEach.call(ds.querySelectorAll("button[data-d]"), function(b){
    var on=DIFFS[b.dataset.d]===DIFF;
    b.classList.toggle("on", on); b.setAttribute("aria-pressed", on?"true":"false");
  });
}

/* ---- the V6 menu's live labels ----
   The mockup shipped these as static text. They are the only feedback that the
   picker registered a click, so they are driven from real state. */
var MODENAME={sort:"Sort", quiz:"Quiz", tsunami:"Bin It", vs:"Versus"};
var CTRLNAME={cam:"Webcam hand", remote:"Phone controller", mouse:"Mouse / touch"};
function menuLabels(){
  var m=el("v6ModeLabel"); if(m) m.textContent=(MODENAME[GMODE]||GMODE)+" selected";
  var c=el("v6CtrlLabel"); if(c) c.textContent=CTRLNAME[controlMode]||"Ready";
  var s=el("v6Selection");
  if(s){
    var blade=(typeof bladeCurrent==="function") ? bladeCurrent() : null;
    s.textContent=(MODENAME[GMODE]||GMODE)+" · "+
      (blade ? (blade.zh?blade.zh+" ":"")+blade.n+" · " : "")+
      (CTRLNAME[controlMode]||"");
  }
}
/* Segmented controls delegate from the CONTAINER, not from each button.
   Listeners were on the buttons, and a measurement of the mode selector found
   that 33% of the pill's pixels hit no button at all: the pill is 43px tall but
   the buttons are 33px, leaving 5px dead bands above and below, plus a 5px inset
   at the left and the fully rounded 980px ends. A tap landing in any of that did
   nothing — which is exactly why picking a mode sometimes appeared to be ignored,
   and why it felt random rather than reproducible.

   The 3px inset is deliberate styling, so rather than change how it looks, every
   pixel of the container now resolves to a button: a click outside any button
   takes the horizontally nearest one. That also makes the touch targets bigger
   than the paint, which is what you want on a phone. */
function segDelegate(id, onPick){
  var box=el(id); if(!box) return;
  box.addEventListener("click", function(e){
    var btns=[].slice.call(box.querySelectorAll("button"));
    if(!btns.length) return;
    var b=(e.target && e.target.closest) ? e.target.closest("button") : null;
    if(!b || btns.indexOf(b)<0){
      var x=e.clientX, best=null, bd=Infinity;
      btns.forEach(function(t){
        var r=t.getBoundingClientRect();
        var d=(x<r.left) ? r.left-x : (x>r.right) ? x-r.right : 0;
        if(d<bd){ bd=d; best=t; }
      });
      b=best;
    }
    if(!b) return;
    /* aria-pressed has to move with the `on` class. The V6 mode tiles carry it
       and nothing updated it, so the selected tile stayed aria-pressed="false"
       — a screen reader was told the opposite of what the screen showed. These
       are toggle buttons in a group, so the state belongs on every one of them. */
    btns.forEach(function(t){ t.classList.remove("on"); t.setAttribute("aria-pressed","false"); });
    b.classList.add("on"); b.setAttribute("aria-pressed","true");
    onPick(b);
  });
}
segDelegate("diffSeg", function(b){ DIFF=DIFFS[b.dataset.d]; });
segDelegate("modeSeg", function(b){ GMODE=b.dataset.g; syncControls(); });
syncControls();   /* and once now, so a page loading on Versus is already correct */

function startChosen(){ if(GMODE==="quiz") launchQuiz(); else if(GMODE==="tsunami") launchTsunami(); else if(GMODE==="vs") launchVS(); else launchGame(); }
el("playBtn").addEventListener("click", function(){
  if(controlMode==="remote") hostStartConnect();     /* Versus included — two phones, one per player */
  else startChosen();
});
/* The phone-connect screen is shared: a lesson that needs a phone sends the
   player through the normal QR flow and is resumed here, rather than starting
   a game they did not ask for. */
el("connGo").addEventListener("click", function(){
  if(typeof TUT!=="undefined" && TUT.pending){ var id=TUT.pending; TUT.pending=null; tutStart(id); return; }
  startChosen();
});
el("connBack").addEventListener("click", function(){ stopPeer(); show("start"); });
el("ovlBtn").addEventListener("click", function(){
  if(GMODE==="tsunami") tsunamiBegin();   /* Bin It's rules screen */
  else startRound();
});
el("againBtn").addEventListener("click", function(){ show("start"); });

/* ---- pause / resume ---- */
/* Every mode can pause. Quiz/Defend/Versus count their clocks down with dt inside
   their own update, which the loop skips while paused, so they need no compensation.
   Sort is the exception: its deadline is absolute wall-clock, so it gets adjusted. */
function modeRunning(){
  if(GMODE==="quiz") return !!Q.running;
  if(GMODE==="tsunami") return !!TS.running;
  if(GMODE==="vs") return !!VS.running;
  return !!G.running;
}
function pauseGame(){
  if(!modeRunning() || G.paused) return;
  G.paused=true; G.pauseRemain=G.roundEndAt-performance.now();
  if(GMODE==="quiz") el("quizQ").classList.add("hidden");   /* no free thinking time while paused */
  el("pauseBtn").textContent="Resume"; el("pauseOvl").classList.remove("hidden");
}
function resumeGame(){
  if(!G.paused) return;
  G.paused=false; G.roundEndAt=performance.now()+Math.max(0,G.pauseRemain);
  if(GMODE==="quiz" && Q.running) el("quizQ").classList.remove("hidden");
  el("pauseBtn").textContent="Pause"; el("pauseOvl").classList.add("hidden");
}
el("pauseBtn").addEventListener("click", function(){ G.paused ? resumeGame() : pauseGame(); });
el("resumeBtn").addEventListener("click", resumeGame);
el("quitBtn").addEventListener("click", function(){ G.paused=false; G.running=false;
  Q.running=false; TS.running=false; VS.running=false;                       /* quit must stop whichever mode is live */
  el("pauseBtn").textContent="Pause"; el("pauseOvl").classList.add("hidden");
  el("quizQ").classList.add("hidden"); clearObjs(); try{stopPeer();}catch(e){} stopCam(); show("start"); });

/* ================= controller boot (phone opens with ?ctrl=1&peer=sort-XXXX) ================= */
function bootController(){
  var ctrlPeerId=qs.get("peer")||"", ctrlClient=null, ctrlConn=null;
  function ctrlSetStatus(t){ el("ctrlStatus").innerHTML=t; }
  function ctrlDot(g,b){
    el("dot").style.left=Math.max(0,Math.min(100,50+g/60*50))+"%";
    el("dot").style.top=Math.max(0,Math.min(100,(b-15)/55*100))+"%";
  }
  function ctrlSend(g,b){
    if(ctrlConn && ctrlConn.open){ ctrlConn.send({g:g,b:b}); }
  }
  function ctrlOrient(e){ var g=e.gamma||0, b=e.beta||45; ctrlDot(g,b); ctrlSend(g,b); }
  function ctrlStartMotion(){ window.addEventListener("deviceorientation", ctrlOrient); }

  /* touch fallback — works on any phone */
  (function(){
    var touching=false;
    function touchPos(touch){
      var r=el("pad").getBoundingClientRect();
      var px=Math.max(0,Math.min(1,(touch.clientX-r.left)/r.width));
      var py=Math.max(0,Math.min(1,(touch.clientY-r.top)/r.height));
      var g=(px-.5)*2*60, b=15+py*55;
      el("dot").style.left=(px*100)+"%"; el("dot").style.top=(py*100)+"%";
      ctrlSend(g,b);
    }
    el("pad").addEventListener("touchstart", function(e){ e.preventDefault(); touching=true; touchPos(e.touches[0]); });
    el("pad").addEventListener("touchmove", function(e){ e.preventDefault(); if(touching) touchPos(e.touches[0]); });
    el("pad").addEventListener("touchend", function(e){ e.preventDefault(); touching=false; el("dot").style.left="50%"; el("dot").style.top="50%"; });
    el("pad").addEventListener("touchcancel",function(e){ touching=false; el("dot").style.left="50%"; el("dot").style.top="50%"; });
  })();

  if(!ctrlPeerId){ ctrlSetStatus("No peer ID — scan the QR again."); return; }

  ctrlSetStatus("Connecting…");
  el("ctrlLead").textContent="Connecting to your game — drag the pad to control.";

  function doConnect(){
    try{
      if(ctrlClient) ctrlClient.destroy();
      ctrlClient=new Peer({debug:0});
      ctrlClient.on("open", function(){
        ctrlConn=ctrlClient.connect(ctrlPeerId,{reliable:true});
        ctrlConn.on("open", function(){
          ctrlSetStatus("Connected! <b>Tilt or drag</b> to slice.");
          if(typeof DeviceOrientationEvent!=="undefined" && typeof DeviceOrientationEvent.requestPermission==="function"){
            DeviceOrientationEvent.requestPermission().then(function(p){
              if(p==="granted") ctrlStartMotion();
            }).catch(function(){});
          } else { ctrlStartMotion(); }
        });
        ctrlConn.on("error", function(){ ctrlSetStatus("Connection failed — reload."); });
        ctrlConn.on("close", function(){ ctrlSetStatus("Disconnected — reload and scan again."); });
      });
      ctrlClient.on("error", function(){ ctrlSetStatus("Couldn't reach the game. Reload."); });
    }catch(e){ ctrlSetStatus("WebRTC unavailable. Reload."); }
  }

  doConnect();

  el("ctrlConnect").addEventListener("click", function(){
    ctrlSetStatus("Reconnecting…");
    doConnect();
  });
}

/* ================= boot ================= */
/* Shared by the deferred boot and its outer guard, so a failure reports the
   same way whichever path caught it. */
function bootFail(e){
  var n=el("startNote");
  if(n){
    n.innerHTML='<b>Graphics failed to start</b> ('+((e&&e.message)||"WebGL unavailable")+
      ').<br>Reload the page. If it keeps happening, close some other tabs — each one uses a graphics context.';
    n.style.color="#c0392b";
  }
  if(typeof console!=="undefined" && console.error) console.error("boot failed:", e);
}
if(IS_CONTROLLER){
  show("controller");
  try { bootController(); } catch(e) {
    el("ctrlStatus").innerHTML = "Error: " + (e.message || "page load failed") + " — reload the page.";
  }
} else {
  /* Guarded, and it says so when it fails. initThree() creates a WebGL context,
     which can fail for reasons that have nothing to do with this code — a GPU
     reset, too many live contexts across tabs, a driver hiccup. Unguarded, the
     throw took resize() and the render loop down with it, so the menu still
     responded but starting a game gave a blank frozen screen with nothing in the
     console pointing at why. Intermittent and silent is the worst combination,
     so a failure now surfaces on the start screen instead. */
  /* THE LOOP MUST NOT START UNTIL EVERY SCRIPT HAS LOADED.

     This file is script 2 of 7, but drawFx() calls bladeDrawTrail(), which is
     defined in js/blades.js — script 7. Starting the loop here ran the first
     frame while the browser was still fetching the remaining parser-blocking
     scripts, and rAF callbacks DO fire in those gaps. On a cold cache or a slow
     connection the first frame hit `bladeDrawTrail is not defined`.

     That single race is what produced every "the game is broken" report:
     build 62 it killed the rAF chain outright (frozen board, no items),
     build 63 the error path poisoned the round-start button (bounce to menu),
     build 66 it surfaces in #errBar. It never reproduced locally because
     localhost serves all seven files before the first frame is due.

     DOMContentLoaded fires only after every parser-inserted synchronous script
     has executed, which is exactly the guarantee needed. readyState is checked
     because this file could later be moved after the event has already fired. */
  var bootGame=function(){
    try {
      /* Sound first: it touches no three.js state, and keeping the boot line
         below contiguous is an invariant tests/loop.js checks. */
      if(typeof sfxSetup==="function") sfxSetup();
      if(typeof tutSetup==="function") tutSetup();
      initThree(); resize(); preloadItemArt(); requestAnimationFrame(loop);
    } catch(e) { bootFail(e); }
  };
  try {
    if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", bootGame);
    else bootGame();
  } catch(e) { bootFail(e); }
}

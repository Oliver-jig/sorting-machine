/* ================= BLADES + LEVELS =================
   Cosmetic blade skins, unlocked by levelling up. Cosmetic ONLY: a blade never
   changes reach, speed, scoring or difficulty, so nothing here can affect the
   teaching or make a locked player worse off.

   WHICH MODES: Sort and Quiz. Bin It has no blade — you move a bin there — and
   Versus deliberately keeps a fixed blue P1 / red P2 because those colours are
   how two players tell their blades apart. A skin there would break the mode.

   XP IS NORMALISED PER MODE, and that is the whole reason XPRATE exists. The
   three modes score on wildly different scales:
     Sort    +15 per correct slice, -12 per wrong; its own grade thresholds put
             150 at "solid" and 300 at "champion", so a good run is about 300.
     Quiz    (100 + speed bonus up to 100) x combo up to 3, over 12 questions —
             a good run is about 2000.
     Bin It  10 x combo up to 4 per catch; a real observed game-over run was 340.
   Summing raw score would make ONE Quiz run worth about seven Bin It runs, which
   would quietly herd everyone into Quiz. The rates below make a good run worth
   roughly 100 XP whichever mode you played.

   XP IS DERIVED, NOT COUNTED. It is recomputed from the run history scores.js
   already keeps (getRuns()), so there is no second counter that can drift out of
   sync with the runs. The only stored number is a server-restored floor — see
   bladeXP(). */

var XPRATE={ sort:0.33, quiz:0.05, tsunami:0.33 };   /* good run ~= 100 XP each */

/* Fifteen levels with a blade every SECOND one, so levelling alternates between
   a new blade and progress towards the next.

   The early gaps are deliberately no smaller than about one good run (~100 XP).
   A first attempt used 45/65/85 and levels got SKIPPED — two runs cleared both
   level 3 and level 4, so the player saw "Lv 2" jump straight to "Lv 4" and
   never saw the level their blade was attached to. Gaps still widen throughout
   (55 -> 580); they just do not start below the granularity of a single run.

   Blade 2 lands at level 3, about 2 runs in, so a one-session player still
   unlocks something. The last is around 38 runs. */
var LEVELXP=[0, 55, 130, 230, 350, 500, 680, 890, 1140, 1430, 1770, 2160, 2610, 3120, 3700];

/* `glow` is the blade's IDENTITY colour and is the WIDE pass. `core` is the
   bright hot centre and is narrow. That order matters and was originally the
   wrong way round: every blade had a near-white wide pass with the colour only
   in a thin low-alpha accent, so in play they all looked like the same pale
   streak and picking one appeared to do nothing. The colour has to be the part
   you actually see.
   `w` scales thickness. `cycle` re-hues the glow on every swipe.

   `life` is how long a trail point survives, in ms, and is the strongest FEEL
   cue available — a long-lived trail smears behind your hand, a short one is
   crisp. Everything used to sit at a hard-coded 140ms, which made the shipped
   descriptions untrue: Sunset promises "you can see where you have been" and
   Leaf promises "thin and quick", while both behaved identically. These values
   make that copy honest.

   `sparkle` is a count of small dots scattered along the trail, kept for the
   late unlocks so reaching them looks like a reward.

   EVERY FIELD HERE IS COSMETIC AND MUST STAY THAT WAY. No blade may change
   score, reach, hit radius, lives or speed — the whole system is unit-tested on
   that promise, because scores from this game go to a database a teacher reads
   and have to mean "how well do you know your bins", not "how long have you
   been playing". */
var BLADES=[
  {id:"classic", n:"Classic",   zh:"經典",   lvl:1,  glow:"32,164,90",  core:"255,255,255", w:1.00, life:140,
   d:"The blade you started with."},
  {id:"ocean",   n:"Ocean",     zh:"海洋",   lvl:3,  glow:"47,127,209", core:"235,248,255", w:1.00, life:140,
   d:"Cool blue, for the plastic that should never reach the sea."},
  {id:"amber",   n:"Amber",     zh:"琥珀",   lvl:5,  glow:"223,160,48", core:"255,250,235", w:1.08, life:150,
   d:"The colour of this whole game."},
  /* A bright lime, NOT the same green as Classic: at 31,157,85 it was within a
     few units of Classic's and the two were indistinguishable. */
  {id:"leaf",    n:"Leaf",      zh:"綠葉",   lvl:7,  glow:"124,201,45", core:"244,255,220", w:0.86, life:105,
   d:"Thin and quick. Slices clean."},
  {id:"sunset",  n:"Sunset",    zh:"晚霞",   lvl:9,  glow:"224,72,63",  core:"255,236,214", w:1.18, life:185,
   d:"Heavy and warm. You can see where you have been."},
  {id:"disco",   n:"Disco",     zh:"彩虹",   lvl:11, glow:null,         core:"255,255,255", w:1.05, life:140,
   d:"Changes colour with every swipe. Funky.", cycle:true, sparkle:5},
  {id:"ice",     n:"Ice",       zh:"冰刃",   lvl:13, glow:"90,206,235", core:"255,255,255", w:0.80, life:100,
   d:"The narrowest blade. For people who do not miss.", sparkle:7},
  {id:"gold",    n:"Zero Waste",zh:"零廢棄", lvl:15, glow:"216,161,60", core:"255,252,232", w:1.35, life:195,
   d:"The last one. Nothing wasted.", sparkle:9}
];

function bladeById(id){
  for(var i=0;i<BLADES.length;i++) if(BLADES[i].id===id) return BLADES[i];
  return BLADES[0];
}

/* ---- XP and level ---- */
/* Total XP from the run history, plus a floor from any restored server value.
   max() rather than either alone: a player who levelled on another device must
   not be demoted here, and a player who has since played more here must not be
   dragged back down to their last synced value. Progress only ever goes up. */
function bladeXP(){
  var runs=(typeof getRuns==="function") ? getRuns() : [];
  var xp=0;
  for(var i=0;i<runs.length;i++){
    var r=runs[i], rate=XPRATE[r.m];
    if(!rate) continue;                       /* versus is not recorded, and scores <0 give nothing */
    if(r.s>0) xp+=r.s*rate;
  }
  xp=Math.round(xp);
  var floor=0;
  try{ floor=parseInt(localStorage.getItem("ss3d.xpFloor")||"0",10)||0; }catch(e){}
  return Math.max(xp, floor);
}
function bladeSetXPFloor(v){
  v=Math.round(v)||0;
  if(v<=0) return;
  try{ if(v>(parseInt(localStorage.getItem("ss3d.xpFloor")||"0",10)||0)) localStorage.setItem("ss3d.xpFloor", String(v)); }catch(e){}
}
function bladeLevel(xp){
  if(xp===undefined) xp=bladeXP();
  var lv=1;
  for(var i=0;i<LEVELXP.length;i++) if(xp>=LEVELXP[i]) lv=i+1;
  return lv;
}
/* Progress towards the next level, for the bar. At max level it reads full. */
function bladeProgress(){
  var xp=bladeXP(), lv=bladeLevel(xp);
  if(lv>=LEVELXP.length) return {lv:lv, xp:xp, into:1, need:0, max:true};
  var lo=LEVELXP[lv-1], hi=LEVELXP[lv];
  return {lv:lv, xp:xp, into:(xp-lo)/(hi-lo), need:hi-xp, max:false};
}
function bladeUnlocked(b){ return bladeLevel()>=b.lvl; }

/* ---- selection ---- */
function bladeSelectedId(){
  var id="classic";
  try{ id=localStorage.getItem("ss3d.blade")||"classic"; }catch(e){}
  var b=bladeById(id);
  /* A blade can become locked again only if history is cleared. Fall back rather
     than draw something the player is not entitled to. */
  return bladeUnlocked(b) ? b.id : "classic";
}
function bladeSelect(id){
  var b=bladeById(id);
  if(!bladeUnlocked(b)) return false;
  try{ localStorage.setItem("ss3d.blade", b.id); }catch(e){}
  return true;
}
function bladeCurrent(){ return bladeById(bladeSelectedId()); }

/* ---- drawing ----
   One swipe = one continuous trail. Disco re-hues when a new one starts, which
   is why the previous drawing state is tracked rather than using a timer. */
var BLState={ swipes:0, drawing:false };
function bladeHue(i){
  var h=(i*47)%360;                            /* 47 is coprime with 360, so consecutive swipes never repeat a hue */
  return hslRGB(h, 0.85, 0.55);
}
function hslRGB(h,s,l){
  h/=360; var r,g,b;
  function q(p,q,t){ if(t<0)t+=1; if(t>1)t-=1;
    if(t<1/6) return p+(q-p)*6*t;
    if(t<1/2) return q;
    if(t<2/3) return p+(q-p)*(2/3-t)*6;
    return p; }
  if(s===0){ r=g=b=l; }
  else { var Q=l<0.5?l*(1+s):l+s-l*s, P=2*l-Q;
    r=q(P,Q,h+1/3); g=q(P,Q,h); b=q(P,Q,h-1/3); }
  return Math.round(r*255)+","+Math.round(g*255)+","+Math.round(b*255);
}
/* ================= UI =================
   The picker is its own screen rather than a section of the start card, which was
   already long enough to need scrolling on a phone. */

/* ONE renderer, used by the live trail AND by the picker tiles.
   They were separate before, with different alpha ramps, so a tile showed a
   strongly coloured swipe while the game drew a pale one — and picking a blade
   looked like it had done nothing, or given you a different blade. Sharing this
   function is what makes the tile an honest preview: it cannot drift again
   without both changing together.

   `scale` is the only difference between the two callers, because a 112px tile
   needs thinner strokes than a 1280px playfield. */
function bladeStroke(c, pts, b, seed, scale){
  if(!pts || pts.length<2) return;
  var sc=(b.w||1)*(scale||1), n=pts.length, rainbow=!!b.cycle;
  var glow=b.glow, core=b.core||"255,255,255";
  if(rainbow && !glow) glow=bladeHue(seed||0);
  c.lineCap="round"; c.lineJoin="round";
  /* wide identity-colour pass */
  for(var p=1;p<n;p++){ var f=p/n;
    var g=rainbow ? hslRGB((((seed||0)*47)+300*f)%360, 0.85, 0.55) : glow;
    c.strokeStyle="rgba("+g+","+(0.25+0.6*f)+")"; c.lineWidth=(f*13+3)*sc;
    c.beginPath(); c.moveTo(pts[p-1].x,pts[p-1].y); c.lineTo(pts[p].x,pts[p].y); c.stroke(); }
  /* narrow hot core */
  for(var q=1;q<n;q++){ var e=q/n;
    c.strokeStyle="rgba("+core+","+(0.30+0.65*e)+")"; c.lineWidth=(e*5+1.2)*sc;
    c.beginPath(); c.moveTo(pts[q-1].x,pts[q-1].y); c.lineTo(pts[q].x,pts[q].y); c.stroke(); }
  /* Sparkle: dots scattered along the trail, offset off the line so they read as
     sparks rather than a dotted stroke. Deliberately NOT pushed into G.parts —
     keeping them here means no shared state, nothing to clean up, and no chance
     of interfering with the slice debris that carries correct/wrong meaning.
     The offset is derived from the point index, not Math.random, so a still
     frame and its preview tile look the same every time. */
  var sp=b.sparkle|0;
  if(!sp) return;
  for(var s=0;s<sp;s++){
    var i=1+Math.floor((s+0.5)/sp*(n-1)), a=pts[i], prev=pts[i-1];
    var t=(s*0.618)%1;                                  /* golden ratio: spreads without clumping */
    var dx=a.x-prev.x, dy=a.y-prev.y, len=Math.sqrt(dx*dx+dy*dy)||1;
    var nx=-dy/len, ny=dx/len, off=(t-0.5)*16*sc;       /* perpendicular to the stroke */
    var r=(0.9+t*1.5)*sc, fade=0.35+0.6*(i/n);
    c.fillStyle="rgba("+core+","+fade+")";
    c.beginPath(); c.arc(a.x+nx*off, a.y+ny*off, Math.max(0.4,r), 0, 7); c.fill();
  }
}

/* A short arc into a small canvas, drawn by bladeStroke — the same code the game
   uses, so the tile is what you will actually get. */
function bladePreview(cv, b){
  var c=cv.getContext("2d"), w=cv.width, h=cv.height;
  c.clearRect(0,0,w,h);
  var pts=[], N=18;
  for(var i=0;i<N;i++){
    var t=i/(N-1);
    pts.push({x:7+t*(w-14), y:h*0.56+Math.sin(t*Math.PI)*-h*0.28});
  }
  bladeStroke(c, pts, b, 3, 0.72);
}

function bladeRenderLvl(id){
  var box=(typeof el==="function")?el(id):document.getElementById(id);
  if(!box) return;
  var p=bladeProgress();
  box.classList.remove("hidden");
  var pct=Math.round(Math.max(0,Math.min(1,p.into))*100);
  box.innerHTML=
    '<span class="lvlNum">Lv '+p.lv+'</span>'+
    '<span class="lvlTrack"><span class="lvlFill" style="width:'+pct+'%"></span></span>'+
    '<span class="lvlXp">'+(p.max ? p.xp+" XP · max level"
                                  : p.need+" XP to Lv "+(p.lv+1))+'</span>';
}

function bladeRenderList(){
  var box=(typeof el==="function")?el("bladeList"):document.getElementById("bladeList");
  if(!box) return;
  var sel=bladeSelectedId(), lv=bladeLevel();
  box.innerHTML="";
  BLADES.forEach(function(b){
    var open=lv>=b.lvl, on=(b.id===sel);
    var row=document.createElement("button");
    row.type="button";
    row.className="blade"+(on?" on":"")+(open?"":" locked");
    row.disabled=!open;
    row.setAttribute("aria-pressed", on?"true":"false");

    var cv=document.createElement("canvas");
    cv.width=150; cv.height=54; cv.className="bladePv";
    row.appendChild(cv);

    var txt=document.createElement("div"); txt.className="bladeTxt";
    txt.innerHTML='<div class="bladeN">'+b.zh+' '+b.n+
      (on?' <span class="bladeTag">SELECTED</span>':'')+'</div>'+
      '<div class="bladeD">'+(open ? b.d : "Reach level "+b.lvl+" to unlock.")+'</div>';
    row.appendChild(txt);

    box.appendChild(row);
    if(open) bladePreview(cv, b);
    else {
      /* Locked tiles still show the SHAPE, greyed — a silhouette is a reason to
         keep playing; a blank box is not. */
      /* Greyed but otherwise FAITHFUL: width and sparkle are passed through, so a
         locked tile shows the real silhouette and teases what it will look like.
         Only the colour is withheld. */
      bladePreview(cv, {glow:"120,120,124", core:"168,168,172", w:b.w, sparkle:b.sparkle});
    }
    row.addEventListener("click", function(){
      if(bladeSelect(b.id)){ bladeRenderList(); }
    });
  });
}

function bladeOpen(){
  bladeRenderLvl("lvlBarB");
  bladeRenderList();
  bladeSyncNote();
  show("blades");
}
function bladeSyncNote(){
  var n=(typeof el==="function")?el("bladeSync"):document.getElementById("bladeSync");
  if(!n) return;
  var nm=(typeof getName==="function")?getName():"";
  n.textContent = nm
    ? "Progress is saved on this device and to the name “"+nm+"”."
    : "Progress is saved on this device. Add your name after a run to carry it to another device.";
}

function bladeClose(){ show("start"); }

document.addEventListener("DOMContentLoaded", function(){
  var b=document.getElementById("bladesBtn");
  if(b) b.addEventListener("click", bladeOpen);
  /* Two exits, top and bottom, plus Escape. The list is long, and a screen you
     cannot leave is the worst kind of bug. */
  ["bladesBack","bladesBackTop"].forEach(function(id){
    var k=document.getElementById(id);
    if(k) k.addEventListener("click", bladeClose);
  });
  document.addEventListener("keydown", function(e){
    if(e.key!=="Escape") return;
    var s=document.getElementById("blades");
    if(s && !s.classList.contains("hidden")) bladeClose();
  });
  bladeRenderLvl("lvlBar");
  /* menuLabels() lives in game.js (script 2) and is safe to call from here
     (script 7); the selection summary shows the equipped blade. */
  if(typeof menuLabels==="function") menuLabels();
});

/* The cam/phone cursor ring uses the blade's accent so the choice is visible in
   those modes too. Disco holds its current swipe colour rather than flickering. */
function bladeMarkerRGB(){
  var b=bladeCurrent();
  if(b.cycle) return bladeHue(BLState.swipes);
  return b.glow||"32,164,90";
}
/* Sort and Quiz draw through here. It expires stale points the way drawTrail
   does, then hands off to the shared renderer. Versus keeps calling drawTrail
   directly with a single colour, because its blue/red are how players tell each
   other apart and must never follow a skin. */
function bladeDrawTrail(trail, now){
  var b=bladeCurrent();
  /* Per-blade lifetime, not a fixed 140. drawTrail in game.js keeps its own
     literal because Versus must not follow a skin. */
  var life=b.life||140;
  /* Expire by age, but NEVER below MINPTS points.
     Age alone assumes points arrive at the render rate. They do not: webcam hand
     tracking feeds roughly 25fps, so points land ~40ms apart and a 100ms blade
     (Ice, Leaf) holds only 2-3 of them — one dropped detection then leaves fewer
     than the 2 bladeStroke needs and the blade vanishes for a frame. That was
     half of the webcam flicker.
     A point floor fixes it structurally, for any input rate on any machine.
     Re-tuning the life values instead would only have moved the threshold and
     broken again on a slower laptop. At 60fps mouse input the floor is never
     reached, so each blade keeps its distinct feel. */
  var MINPTS=3;
  if(trail.length && now-trail[trail.length-1].t>=life){
    /* Even the NEWEST point is stale, so input has stopped and the swipe is
       over — drop everything. Without this the floor would hold the last three
       points on screen forever as a stuck smear once the hand left frame. */
    trail.length=0;
  } else {
    while(trail.length>MINPTS && now-trail[0].t>=life) trail.shift();
  }
  var live=trail.length>1;
  if(live && !BLState.drawing) BLState.swipes++;
  BLState.drawing=live;
  bladeStroke(fxc, trail, b, BLState.swipes, 1);
}

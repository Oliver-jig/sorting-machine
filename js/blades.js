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

/* Fast early, slower later, as asked: the first unlock lands at 60 XP, which is
   well under a single good run, so someone playing once at an exhibition still
   sees a reward. Later gaps widen for players who come back. */
var LEVELXP=[0, 60, 160, 320, 560, 900, 1400, 2100];

/* Two-tone trails: `outer` is the wide bright pass, `inner` the narrow accent.
   `w` scales thickness. `cycle` re-hues on every swipe.
   Level 1 is the current look, so an unlocked player loses nothing. */
var BLADES=[
  {id:"classic", n:"Classic",   zh:"經典",   lvl:1, outer:"255,255,255", inner:"32,164,90",  w:1.00,
   d:"The blade you started with."},
  {id:"ocean",   n:"Ocean",     zh:"海洋",   lvl:2, outer:"235,248,255", inner:"47,127,209", w:1.00,
   d:"Cool blue, for the plastic that should never reach the sea."},
  {id:"amber",   n:"Amber",     zh:"琥珀",   lvl:3, outer:"255,250,235", inner:"191,139,46", w:1.05,
   d:"The colour of this whole game."},
  /* A bright lime, NOT the same green as Classic: at 31,157,85 it was within a
     few units of Classic's accent and the two tiles were indistinguishable. */
  {id:"leaf",    n:"Leaf",      zh:"綠葉",   lvl:4, outer:"244,255,220", inner:"124,201,45", w:0.90,
   d:"Thin and quick. Slices clean."},
  {id:"sunset",  n:"Sunset",    zh:"晚霞",   lvl:5, outer:"255,236,214", inner:"224,72,63",  w:1.15,
   d:"Heavy and warm. You can see where you have been."},
  {id:"disco",   n:"Disco",     zh:"彩虹",   lvl:6, outer:null,           inner:null,         w:1.05,
   d:"Changes colour with every swipe. Funky.", cycle:true},
  {id:"ice",     n:"Ice",       zh:"冰刃",   lvl:7, outer:"255,255,255", inner:"120,220,240", w:0.85,
   d:"The narrowest blade. For people who do not miss."},
  {id:"gold",    n:"Zero Waste",zh:"零廢棄", lvl:8, outer:"255,252,232", inner:"216,161,60",  w:1.25,
   d:"The last one. Nothing wasted."}
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
/* Draws the player's blade. Delegates to game.js's drawTrail, which Versus
   already uses — the only addition there was an optional inner colour. */
/* ================= UI =================
   The picker is its own screen rather than a section of the start card, which was
   already long enough to need scrolling on a phone. */

/* A short swipe drawn into a small canvas, so the tile shows the actual blade
   rather than a swatch. Uses the same alpha/width ramp as drawTrail so what you
   pick is what you get. */
function bladePreview(cv, b){
  var c=cv.getContext("2d"), w=cv.width, h=cv.height;
  c.clearRect(0,0,w,h);
  var pts=[], N=16;
  for(var i=0;i<N;i++){
    var t=i/(N-1);
    pts.push({x:6+t*(w-12), y:h*0.5+Math.sin(t*Math.PI)* -h*0.26});
  }
  var outer=b.outer, inner=b.inner, rainbow=!!b.cycle;
  if(rainbow) outer="255,255,255";
  /* A cycling blade shown at one fixed hue is a lie AND it collided with the two
     green tiles. Its preview sweeps hue along the stroke instead, which says
     "this one changes colour" without needing the description. */
  /* In play the trail is 60+ points long and reads by accumulation. A tile has
     16 points on a strip 40px tall, so reusing the in-game alpha ramp (which
     starts near 0) made every preview a faint grey smudge — Ocean and Leaf were
     indistinguishable. The ramp here therefore starts at 0.45 and the accent is
     drawn at full strength, which is what actually shows the COLOUR. */
  var sc=(b.w||1)*0.85;
  c.lineCap="round"; c.lineJoin="round";
  for(var p=1;p<pts.length;p++){ var f=0.45+0.55*(p/pts.length);
    c.strokeStyle="rgba("+outer+","+f+")"; c.lineWidth=(p/pts.length*11+3)*sc;
    c.beginPath(); c.moveTo(pts[p-1].x,pts[p-1].y); c.lineTo(pts[p].x,pts[p].y); c.stroke(); }
  for(var q=1;q<pts.length;q++){ var g=0.55+0.45*(q/pts.length);
    var col=rainbow ? hslRGB(300*(q/pts.length), 0.85, 0.55) : inner;
    c.strokeStyle="rgba("+col+","+g+")"; c.lineWidth=(q/pts.length*6+2)*sc;
    c.beginPath(); c.moveTo(pts[q-1].x,pts[q-1].y); c.lineTo(pts[q].x,pts[q].y); c.stroke(); }
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
      bladePreview(cv, {outer:"150,150,150", inner:"110,110,110", w:b.w});
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
});

/* The cam/phone cursor ring uses the blade's accent so the choice is visible in
   those modes too. Disco holds its current swipe colour rather than flickering. */
function bladeMarkerRGB(){
  var b=bladeCurrent();
  if(b.cycle) return bladeHue(BLState.swipes);
  return b.inner||"32,164,90";
}
function bladeDrawTrail(trail, now){
  var live=trail.length>1;
  if(live && !BLState.drawing) BLState.swipes++;
  BLState.drawing=live;
  var b=bladeCurrent(), outer=b.outer, inner=b.inner;
  if(b.cycle){ outer="255,255,255"; inner=bladeHue(BLState.swipes); }
  drawTrail(trail, now, outer, inner, b.w);
}

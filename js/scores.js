/* ================= SCORES =================
   Two layers with different audiences:

   1. THE PLAYER sees only their own best score, kept in localStorage. No
      leaderboard, no export button — nothing that lets them take the data
      away or see anyone else's.
   2. THE OWNER gets every run written to Firebase Firestore. The security
      rules are write-only: the game can create a score and can NEVER read,
      edit or delete one. Players cannot pull the list back out even by
      opening the console, because the API simply refuses. You read the data
      in the Firebase console, which is behind your Google login.

   That split is the whole point: the API key in this file is public by
   design, so secrecy has to come from the rules, not from hiding the key.

   Everything Firestore-related is best-effort. If it is unconfigured, blocked
   or offline the game carries on and the player's own best still works.

   Versus is not recorded — two players on one screen, so a personal best has
   no clear meaning. See FIREBASE-SETUP.md. */

/* ---- fill these two in; see FIREBASE-SETUP.md ---- */
var FB={
  projectId:"test-99b74",
  apiKey:"AIzaSyChVBlk8Efs5aFipDhp6eRfAuzD341XE7A"
};
/* -------------------------------------------------- */

var SCFG={ nameMax:16, maxRuns:300, scoreMin:-9999, scoreMax:100000, timeout:6000 };
var SMODES={ sort:"Sort", quiz:"Quiz", tsunami:"Bin It" };
var SC={ mode:null, score:0, best:0, isNew:false, sent:false };

/* ---- local storage ---- */
function lsGet(k,d){ try{ var v=localStorage.getItem(k); return v===null?d:v; }catch(e){ return d; } }
function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }   /* private mode / full quota */
function getName(){ return lsGet("ss3d.name",""); }
function setName(n){ lsSet("ss3d.name", n); }
function cleanName(n){ return (n||"").replace(/\s+/g," ").trim().slice(0,SCFG.nameMax); }

function getRuns(){
  try{ var a=JSON.parse(lsGet("ss3d.runs","[]")); return Object.prototype.toString.call(a)==="[object Array]"?a:[]; }
  catch(e){ return []; }                       /* corrupted storage must not brick the screen */
}
function setRuns(a){ lsSet("ss3d.runs", JSON.stringify(a)); }
function addRun(mode,score,name){
  var a=getRuns();
  a.push({ t:Date.now(), n:name||"", m:mode, s:Math.round(score) });
  if(a.length>SCFG.maxRuns) a=a.slice(a.length-SCFG.maxRuns);
  setRuns(a);
}
/* the player's own best, per mode — this is all they ever see */
function bestFor(mode){
  var a=getRuns(), b=null;
  for(var i=0;i<a.length;i++){ if(a[i].m===mode && (b===null || a[i].s>b)) b=a[i].s; }
  return b;
}

/* ---- Firestore: create only, never read ---- */
function fbReady(){ return !!(FB.projectId && FB.apiKey); }
function fbSubmit(mode,name,score){
  if(!fbReady()) return Promise.reject(new Error("not configured"));
  var url="https://firestore.googleapis.com/v1/projects/"+FB.projectId+
          "/databases/(default)/documents/scores?key="+encodeURIComponent(FB.apiKey);
  var body={ fields:{
    name:{stringValue:name},
    mode:{stringValue:mode},
    score:{integerValue:String(Math.round(score))},
    at:{timestampValue:new Date().toISOString()}
  }};
  var opts={method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)};
  if(typeof AbortController!=="undefined"){                 /* don't hang the result screen */
    var ac=new AbortController(); opts.signal=ac.signal;
    setTimeout(function(){ try{ ac.abort(); }catch(e){} }, SCFG.timeout);
  }
  return fetch(url,opts).then(function(r){
    if(!r.ok) throw new Error("HTTP "+r.status);
    return true;
  });
}

/* ---- players: XP carried between devices by name ----
   A SEPARATE collection from `scores`, which stays write-only. This one needs to
   be READABLE, so the rules must allow get on players/{name} — see
   FIREBASE-SETUP.md. Until you make that change in the console, every read here
   fails and the game simply falls back to local progress: no errors, no blocking.

   Understood limitation: there is no authentication, so a name is not a secret
   and anyone can type someone else's to load their level. That is accepted
   because the only thing it unlocks is a blade colour. Do NOT put anything here
   that matters more than that. */
function pDocId(name){
  /* Firestore document ids cannot contain "/" and must not be "." or "..".
     Lowercased so "Oliver" and "oliver" are one player rather than two. */
  return encodeURIComponent(cleanName(name).toLowerCase()).replace(/[.%]/g,"_").slice(0,80);
}
function pUrl(name){
  return "https://firestore.googleapis.com/v1/projects/"+FB.projectId+
         "/databases/(default)/documents/players/"+pDocId(name)+
         "?key="+encodeURIComponent(FB.apiKey);
}
function pTimeout(opts){
  if(typeof AbortController!=="undefined"){
    var ac=new AbortController(); opts.signal=ac.signal;
    setTimeout(function(){ try{ ac.abort(); }catch(e){} }, SCFG.timeout);
  }
  return opts;
}
/* Read the stored XP for a name. Resolves to a number, or 0 for "nothing there
   or not allowed" — callers never need to care which. */
function playersFetch(name){
  if(!fbReady() || !cleanName(name)) return Promise.resolve(0);
  return fetch(pUrl(name), pTimeout({method:"GET"}))
    .then(function(r){ if(!r.ok) return null; return r.json(); })
    .then(function(j){
      if(!j || !j.fields || !j.fields.xp) return 0;
      return parseInt(j.fields.xp.integerValue||"0",10)||0;
    })
    .catch(function(){ return 0; });
}
/* Write the XP for a name, but only upwards: read first and skip if the stored
   value is already higher, so playing badly on a second device cannot wipe out
   progress made on the first. */
function playersPush(name, xp){
  if(!fbReady() || !cleanName(name)) return Promise.resolve(false);
  xp=Math.round(xp)||0;
  if(xp<=0) return Promise.resolve(false);
  return playersFetch(name).then(function(had){
    if(had>=xp) return false;
    var body={ fields:{
      name:{stringValue:cleanName(name)},
      xp:{integerValue:String(xp)},
      at:{timestampValue:new Date().toISOString()}
    }};
    return fetch(pUrl(name), pTimeout({method:"PATCH",
      headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)}))
      .then(function(r){ return r.ok; }).catch(function(){ return false; });
  }).catch(function(){ return false; });
}
/* Pull a name's stored XP in as a floor for local progress. Called when a name
   is already known at load, and again whenever one is saved. */
function playersRestore(){
  var n=getName(); if(!n || typeof bladeSetXPFloor!=="function") return;
  playersFetch(n).then(function(xp){
    if(xp>0){
      bladeSetXPFloor(xp);
      if(typeof bladeRenderLvl==="function") bladeRenderLvl("lvlBar");
    }
  });
}

/* ---- called by each mode's game-over ---- */
function scoresRecord(mode,score){
  /* THE ONE PLACE tutorial isolation is enforced. XP is not a stored counter —
     bladeXP() derives it from this run history, and unlocks derive from XP — so
     refusing to record a tutorial run closes the local best, the history, the
     XP floor and the leaderboard submit in a single line. Do not "helpfully"
     add a second path that writes runs. */
  if(typeof TUT!=="undefined" && TUT.active) return;
  if(!SMODES[mode]) return;                    /* versus is not recorded */
  score=Math.round(score);
  var prevBest=bestFor(mode);                  /* read BEFORE appending, or every run is its own best */
  SC.mode=mode; SC.score=score; SC.sent=false;
  SC.isNew = (prevBest===null || score>prevBest);
  SC.best = SC.isNew ? score : prevBest;
  addRun(mode,score,getName());
  scoresRenderBest();
  scoresRenderPanel();
  if(getName()){
    scoresSend();                              /* name already known — send silently */
    /* XP is derived from the run history, so this must come AFTER addRun */
    if(typeof bladeXP==="function") playersPush(getName(), bladeXP());
  }
}

function scoresHidePanel(){
  var w=el("lbWrap"); if(w) w.classList.add("hidden");
  var b=el("bestLine"); if(b) b.textContent="";
  SC.mode=null;
}

function scoresRenderBest(){
  var b=el("bestLine"); if(!b) return;
  var label=SMODES[SC.mode]||"";
  b.innerHTML = SC.isNew
    ? '<b style="color:#1f9d55">New personal best!</b> &nbsp;'+label+' best: <b>'+SC.best+'</b>'
    : label+' best: <b>'+SC.best+'</b>';
}
function scoresNote(t){ var n=el("lbNote"); if(n) n.textContent=t||""; }

function scoresRenderPanel(){
  var w=el("lbWrap"); if(!w || !SC.mode) return;
  w.classList.remove("hidden");
  var inp=el("playerName"); if(inp && !inp.value) inp.value=getName();
  if(!getName()) scoresNote("Add your name so your teacher can see whose score this is.");
  else scoresNote("");
}

/* Naming happens after the run, so this back-fills the run just recorded. */
function scoresSaveName(){
  var inp=el("playerName"); if(!inp) return;
  var n=cleanName(inp.value);
  if(!n){ inp.focus(); return; }
  setName(n);
  var a=getRuns();
  if(a.length){ a[a.length-1].n=n; setRuns(a); }
  inp.value=n;
  scoresSend();
  /* Pull this name's stored level in first, THEN push the merged total, so
     naming yourself on a new device restores progress instead of overwriting it
     with whatever this device happens to have. */
  if(typeof bladeSetXPFloor==="function"){
    playersFetch(n).then(function(xp){
      if(xp>0) bladeSetXPFloor(xp);
      if(typeof bladeRenderLvl==="function"){ bladeRenderLvl("lvlBar"); bladeRenderLvl("lvlBarB"); }
      return playersPush(n, bladeXP());
    });
  }
}

function scoresSend(){
  if(!SC.mode || SC.sent || !fbReady()) return;
  if(SC.score<SCFG.scoreMin || SC.score>SCFG.scoreMax) return;
  var n=getName(); if(!n) return;
  SC.sent=true;
  fbSubmit(SC.mode,n,SC.score).then(function(){
    scoresNote("Score recorded.");
  }).catch(function(){
    SC.sent=false;                             /* allow a retry via Save name */
    scoresNote("Couldn't reach the server — your best score is still saved here.");
  });
}

/* Start screen: show the target before you play, like an arcade cabinet.
   Hidden entirely until there is at least one score, so a first-time player
   never sees a row of zeros. */
function scoresRenderStartBest(){
  var box=el("startBest"); if(!box) return;
  var parts=[], any=false, k;
  for(k in SMODES){ if(!SMODES.hasOwnProperty(k)) continue;
    var b=bestFor(k);
    if(b!==null){ any=true; parts.push('<span class="bestItem">'+SMODES[k]+' <b>'+b+'</b></span>'); }
  }
  if(!any){ box.classList.add("hidden"); box.innerHTML=""; return; }
  box.classList.remove("hidden");
  box.innerHTML='<span class="bestLbl">Your best</span>'+parts.join("");
}

document.addEventListener("DOMContentLoaded", function(){
  var b=el("saveScore"); if(b) b.addEventListener("click", scoresSaveName);
  var inp=el("playerName");
  if(inp){ inp.value=getName();
    inp.addEventListener("keydown", function(e){ if(e.key==="Enter") scoresSaveName(); }); }
  scoresRenderStartBest();          /* the start screen is already visible on load */
  playersRestore();                 /* if a name is already known, pull its level in */
});

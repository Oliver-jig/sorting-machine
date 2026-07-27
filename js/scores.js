/* ================= SCORES =================
   Two layers, deliberately independent:

   1. Personal best  -> localStorage. Always available, works offline, and
      never fails. This is what guarantees "show my highest mark" keeps
      working even with no network and no database configured.
   2. Shared leaderboard -> Firebase Firestore over its plain REST API
      (no SDK, no build step). Entirely best-effort: every call is wrapped
      so that a missing config, a blocked network or a Firestore error can
      never break the game or the result screen.

   One collection PER MODE (scores_sort, scores_quiz, scores_tsunami).
   That matters: a single collection filtered by mode AND ordered by score
   would be a composite query, which Firestore refuses until you manually
   create a composite index. Ordering a per-mode collection by score alone
   uses the automatic single-field index, so setup needs no index work.

   Versus is intentionally not recorded — it is two players on one screen,
   so a personal best has no clear meaning there.

   See FIREBASE-SETUP.md for the 5-minute setup and the security rules. */

/* ---- fill these two in; see FIREBASE-SETUP.md ---- */
var FB={
  projectId:"",   /* e.g. "slice-sort-3d"  */
  apiKey:""       /* e.g. "AIzaSy..."      */
};
/* -------------------------------------------------- */

var SCFG={ top:10, nameMax:16, scoreMin:-9999, scoreMax:100000, timeout:6000 };
var SMODES={ sort:"Sort", quiz:"Quiz", tsunami:"Bin It" };
var SC={ mode:null, score:0, best:0, isNew:false, submitted:false };

function fbReady(){ return !!(FB.projectId && FB.apiKey); }
function fbBase(){ return "https://firestore.googleapis.com/v1/projects/"+FB.projectId+"/databases/(default)/documents"; }

/* ---- local personal best ---- */
function lsGet(k,d){ try{ var v=localStorage.getItem(k); return v===null?d:v; }catch(e){ return d; } }
function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }   /* private mode / full quota */
function bestKey(mode){ return "ss3d.best."+mode; }
function getBest(mode){ var n=parseInt(lsGet(bestKey(mode),"0"),10); return isNaN(n)?0:n; }
function setBest(mode,v){ lsSet(bestKey(mode), String(v)); }
function getName(){ return lsGet("ss3d.name",""); }
function setName(n){ lsSet("ss3d.name", n); }

function cleanName(n){ return (n||"").replace(/\s+/g," ").trim().slice(0,SCFG.nameMax); }

/* ---- Firestore REST ---- */
/* fetch with a timeout, so a hanging network can't leave the UI on "Loading…" */
function fbFetch(url,opts){
  opts=opts||{};
  if(typeof AbortController!=="undefined"){
    var ac=new AbortController(); opts.signal=ac.signal;
    setTimeout(function(){ try{ ac.abort(); }catch(e){} }, SCFG.timeout);
  }
  return fetch(url,opts).then(function(r){
    if(!r.ok) return r.text().then(function(t){ throw new Error("HTTP "+r.status+" "+t.slice(0,200)); });
    return r.json();
  });
}
function fbSubmit(mode,name,score){
  if(!fbReady()) return Promise.reject(new Error("not configured"));
  var url=fbBase()+"/scores_"+mode+"?key="+encodeURIComponent(FB.apiKey);
  var body={ fields:{
    name:{stringValue:name},
    score:{integerValue:String(Math.round(score))},
    at:{timestampValue:new Date().toISOString()}
  }};
  return fbFetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
}
function fbTop(mode){
  if(!fbReady()) return Promise.reject(new Error("not configured"));
  var url=fbBase()+":runQuery?key="+encodeURIComponent(FB.apiKey);
  var body={ structuredQuery:{
    from:[{collectionId:"scores_"+mode}],
    orderBy:[{field:{fieldPath:"score"},direction:"DESCENDING"}],
    limit:SCFG.top
  }};
  return fbFetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
    .then(function(rows){
      var out=[];
      (rows||[]).forEach(function(r){
        if(!r || !r.document || !r.document.fields) return;      /* runQuery pads with empty rows */
        var f=r.document.fields;
        out.push({ name:(f.name&&f.name.stringValue)||"—",
                   score:parseInt((f.score&&f.score.integerValue)||"0",10)||0 });
      });
      return out;
    });
}

/* ---- called by each mode's game-over ---- */
function scoresRecord(mode,score){
  if(!SMODES[mode]) return;                       /* versus is not recorded */
  score=Math.round(score);
  SC.mode=mode; SC.score=score; SC.submitted=false;
  var prev=getBest(mode);
  SC.isNew = score>prev;
  SC.best = SC.isNew ? score : prev;
  if(SC.isNew) setBest(mode,score);               /* personal best is local, so it never depends on the network */
  scoresRenderBest();
  scoresRenderPanel();
  var n=getName();
  if(n){ scoresSubmit(); }                        /* name already known — store every run, as asked */
  else { scoresSetNote("Enter a name to put this on the leaderboard."); }
  scoresLoadBoard();
}

/* Versus shares the result screen, so its leftovers must be cleared or the
   previous mode's board would still be sitting there. */
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
function scoresSetNote(t){ var n=el("lbNote"); if(n) n.textContent=t||""; }

function scoresRenderPanel(){
  var w=el("lbWrap"); if(!w) return;
  w.classList.remove("hidden");
  var m=el("lbMode"); if(m) m.textContent=SMODES[SC.mode]||"";
  var inp=el("playerName"); if(inp && !inp.value) inp.value=getName();
  if(!fbReady()){
    var l=el("lbList"); if(l) l.innerHTML="";
    scoresSetNote("Leaderboard is off — add your Firebase details in js/scores.js (see FIREBASE-SETUP.md). Your best score above still works.");
    var sb=el("saveScore"); if(sb) sb.style.display="none";
  }
}

function scoresSubmit(){
  if(!SC.mode || SC.submitted) return;
  var inp=el("playerName");
  var n=cleanName(inp?inp.value:getName());
  if(!n){ scoresSetNote("Type a name first."); if(inp) inp.focus(); return; }
  if(SC.score<SCFG.scoreMin || SC.score>SCFG.scoreMax){ scoresSetNote("Score out of range — not saved."); return; }
  setName(n);
  if(!fbReady()){ return; }
  SC.submitted=true;
  scoresSetNote("Saving…");
  fbSubmit(SC.mode,n,SC.score).then(function(){
    scoresSetNote("Saved as "+n+".");
    scoresLoadBoard();
  }).catch(function(err){
    SC.submitted=false;                            /* let them retry */
    scoresSetNote("Couldn't save to the leaderboard ("+(err&&err.message?err.message.slice(0,60):"offline")+"). Your best score above is still saved on this computer.");
  });
}

function scoresLoadBoard(){
  var list=el("lbList"); if(!list || !SC.mode) return;
  if(!fbReady()) return;
  fbTop(SC.mode).then(function(rows){
    list.innerHTML="";
    if(!rows.length){ scoresSetNote("No scores yet — yours will be the first."); return; }
    rows.forEach(function(r,i){
      var li=document.createElement("li");
      li.innerHTML='<span class="lbRank">'+(i+1)+'</span><span class="lbName"></span><span class="lbScore">'+r.score+'</span>';
      li.querySelector(".lbName").textContent=r.name;   /* textContent: names are user input */
      list.appendChild(li);
    });
  }).catch(function(err){
    scoresSetNote("Leaderboard unavailable ("+(err&&err.message?err.message.slice(0,60):"offline")+"). Your best score above still works.");
  });
}

document.addEventListener("DOMContentLoaded", function(){
  var sb=el("saveScore"); if(sb) sb.addEventListener("click", scoresSubmit);
  var inp=el("playerName");
  if(inp){ inp.value=getName();
    inp.addEventListener("keydown", function(e){ if(e.key==="Enter") scoresSubmit(); }); }
});

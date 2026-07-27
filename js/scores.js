/* ================= SCORES =================
   Entirely local. No database, no account, no API key, no network — so it
   works offline, works from `npm start`, and works on the deployed site
   identically. Three things:

   1. Every finished run is appended to a history in localStorage.
   2. A personal best per mode, plus a top-10 board for THIS computer,
      both derived from that history.
   3. A CSV export that opens straight in Excel.

   Versus is not recorded — two players on one screen means a personal best
   has no clear meaning.

   All localStorage access goes through lsGet/lsSet, which swallow errors:
   Safari private browsing throws on setItem, and a thrown error here would
   otherwise take out the whole result screen. */

var SCFG={ top:10, nameMax:16, maxRuns:500 };
var SMODES={ sort:"Sort", quiz:"Quiz", tsunami:"Bin It" };
var SC={ mode:null, score:0, best:0, isNew:false };

/* ---- localStorage plumbing ---- */
function lsGet(k,d){ try{ var v=localStorage.getItem(k); return v===null?d:v; }catch(e){ return d; } }
function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
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
  if(a.length>SCFG.maxRuns) a=a.slice(a.length-SCFG.maxRuns);   /* keep the file from growing forever */
  setRuns(a);
  return a;
}
function bestFor(mode){
  var a=getRuns(), b=null;
  for(var i=0;i<a.length;i++){ if(a[i].m===mode && (b===null || a[i].s>b)) b=a[i].s; }
  return b;
}
function topFor(mode){
  return getRuns().filter(function(r){ return r.m===mode; })
    .sort(function(x,y){ return y.s-x.s; })
    .slice(0,SCFG.top);
}

/* ---- called by each mode's game-over ---- */
function scoresRecord(mode,score){
  if(!SMODES[mode]) return;                    /* versus is not recorded */
  score=Math.round(score);
  var prevBest=bestFor(mode);                  /* read BEFORE appending, or the new run is its own best */
  SC.mode=mode; SC.score=score;
  SC.isNew = (prevBest===null || score>prevBest);
  SC.best = SC.isNew ? score : prevBest;
  addRun(mode,score,getName());
  scoresRenderBest();
  scoresRenderPanel();
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

function scoresRenderPanel(){
  var w=el("lbWrap"); if(!w || !SC.mode) return;
  w.classList.remove("hidden");
  var m=el("lbMode"); if(m) m.textContent=SMODES[SC.mode]||"";
  var inp=el("playerName"); if(inp && !inp.value) inp.value=getName();
  scoresRenderBoard();
  scoresRenderCount();
}

function scoresRenderBoard(){
  var list=el("lbList"); if(!list || !SC.mode) return;
  list.innerHTML="";
  var rows=topFor(SC.mode);
  if(!rows.length) return;
  rows.forEach(function(r,i){
    var li=document.createElement("li");
    li.innerHTML='<span class="lbRank">'+(i+1)+'</span><span class="lbName"></span><span class="lbScore">'+r.s+'</span>';
    li.querySelector(".lbName").textContent = r.n || "—";   /* textContent: names are user input */
    list.appendChild(li);
  });
}
function scoresRenderCount(){
  var n=el("lbNote"); if(!n) return;
  var total=getRuns().length;
  n.textContent = total===1 ? "1 game saved on this computer."
                            : total+" games saved on this computer.";
}

/* Naming happens after the run, so this back-fills the run just recorded and
   remembers the name for next time. */
function scoresSaveName(){
  var inp=el("playerName"); if(!inp) return;
  var n=cleanName(inp.value);
  if(!n){ inp.focus(); return; }
  setName(n);
  var a=getRuns();
  if(a.length){ a[a.length-1].n=n; setRuns(a); }
  inp.value=n;
  scoresRenderBoard();
  var note=el("lbNote"); if(note) note.textContent="Saved as "+n+".";
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

/* ---- CSV export ---- */
function csvCell(v){
  var s=String(v===undefined||v===null?"":v);
  return /[",\n\r]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;   /* RFC4180 quoting */
}
function pad2(n){ return (n<10?"0":"")+n; }
function csvDate(ms){
  var d=new Date(ms);
  return d.getFullYear()+"-"+pad2(d.getMonth()+1)+"-"+pad2(d.getDate())+" "+pad2(d.getHours())+":"+pad2(d.getMinutes());
}
function buildCsv(){
  var a=getRuns(), lines=["date,name,mode,score"];
  a.forEach(function(r){
    lines.push([csvCell(csvDate(r.t)), csvCell(r.n), csvCell(SMODES[r.m]||r.m), csvCell(r.s)].join(","));
  });
  return lines.join("\r\n");                    /* CRLF: what Excel expects */
}
function scoresDownloadCsv(){
  var runs=getRuns();
  var note=el("lbNote");
  if(!runs.length){ if(note) note.textContent="No games saved yet."; return; }
  /* The leading BOM is what makes Excel read the file as UTF-8. Without it,
     Chinese names come out as mojibake. */
  var blob=new Blob(["﻿"+buildCsv()], {type:"text/csv;charset=utf-8;"});
  var d=new Date();
  var fname="slice-sort-scores-"+d.getFullYear()+pad2(d.getMonth()+1)+pad2(d.getDate())+".csv";
  var url=URL.createObjectURL(blob);
  var a=document.createElement("a");
  a.href=url; a.download=fname;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  if(note) note.textContent="Downloaded "+fname+" ("+runs.length+" games).";
}

function scoresClearAll(){
  if(!confirm("Delete all saved scores on this computer? This cannot be undone.")) return;
  setRuns([]);
  scoresRenderBoard(); scoresRenderCount();
}

document.addEventListener("DOMContentLoaded", function(){
  var b;
  if((b=el("saveScore"))) b.addEventListener("click", scoresSaveName);
  if((b=el("dlCsv")))     b.addEventListener("click", scoresDownloadCsv);
  if((b=el("clearScores")))b.addEventListener("click", scoresClearAll);
  var inp=el("playerName");
  if(inp){ inp.value=getName();
    inp.addEventListener("keydown", function(e){ if(e.key==="Enter") scoresSaveName(); }); }
  scoresRenderStartBest();          /* the start screen is already visible on load */
});

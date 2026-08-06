/* ================= cut sounds =================

   One sound per BIN, so cutting a bottle sounds like plastic and cutting a jar
   sounds like glass. The five files map 1:1 onto the five QBINS keys; there is
   no sixth bin and no sound for one.

   WHY WEB AUDIO AND NOT `new Audio()`. Slicing is the one thing this game does,
   and an HTMLAudioElement costs tens of milliseconds between .play() and sound.
   That is the same order as the input latency the phone controller work went to
   some trouble to remove, and it would be audible as the sound trailing the
   blade. A decoded AudioBuffer starts in well under a millisecond and is
   polyphonic for free — a swipe through four items is four voices, not four
   elements fighting over one clip.

   The sounds are CC0; see audio/SOURCES.md. */

var SFX={ ctx:null, buf:{}, master:null, ready:false, muted:false, on:false };

/* The files are peak-normalized but NOT loudness-matched: measured RMS ran from
   -24.9dB (glass) to -16.6dB (general waste), an 8.3dB spread. Played flat,
   glass sounds weak and metal dominates even though their peaks agree.

   These trims close roughly half that gap, in dB, rather than all of it. Full
   RMS-matching is wrong for transients: glass shatter carries a long quiet tail
   that drags its RMS down, so normalizing to it would push the initial smash
   far too loud. Half is the compromise that leaves each material recognisable
   and none of them jarring. */
var SFXSRC={
  paper:  {f:"cut-paper-shred.wav",         g:0.89},
  plastic:{f:"cut-plastic-crunch.wav",      g:1.12},
  metal:  {f:"cut-metal-shear.wav",         g:0.86},
  glass:  {f:"cut-glass-shatter.wav",       g:1.28},
  trash:  {f:"cut-general-waste-slice.wav", g:0.82}
};

/* A swipe can cross several items in ONE sliceAlong call, and Versus has two
   players swiping at once. Firing every voice unthrottled turns a good swipe
   into a burst of noise, and identical samples stacked sample-aligned sum into
   a harsh peak rather than sounding louder. So: a short retrigger gap per bin,
   and a ceiling on how many voices may start in the same instant. */
var SFXMINGAP=45, SFXMAXVOICE=4, sfxLast={}, sfxRecent=[];

function sfxInit(){
  if(SFX.ctx) return;
  var AC=window.AudioContext||window.webkitAudioContext;
  if(!AC) return;                                   /* no Web Audio: stay silent, never throw */
  try{ SFX.ctx=new AC(); }catch(e){ return; }
  SFX.master=SFX.ctx.createGain();
  SFX.master.gain.value=0.5;                        /* headroom for two voices at once */
  SFX.master.connect(SFX.ctx.destination);
  Object.keys(SFXSRC).forEach(function(bin){
    fetch("audio/"+SFXSRC[bin].f).then(function(r){ return r.arrayBuffer(); })
      .then(function(ab){ return SFX.ctx.decodeAudioData(ab); })
      .then(function(b){ SFX.buf[bin]=b; SFX.ready=true; })
      /* A missing or undecodable file must cost that bin its sound and nothing
         else — the game stays playable in silence. */
      .catch(function(){});
  });
}

/* Browsers start the context suspended until the player interacts, so the first
   swipe would otherwise be silent. Resume on the first gesture of any kind
   rather than wiring this to one particular button — the menu, the arena and
   the phone-connect screen all count. */
function sfxArm(){
  sfxInit();
  if(SFX.ctx && SFX.ctx.state==="suspended") SFX.ctx.resume().catch(function(){});
  SFX.on=true;
}

function sfxCut(bin){
  if(SFX.muted || !SFX.ctx || SFX.ctx.state!=="running") return;
  var b=SFX.buf[bin]; if(!b) return;
  var now=SFX.ctx.currentTime*1000;
  if(sfxLast[bin]!==undefined && now-sfxLast[bin]<SFXMINGAP) return;
  while(sfxRecent.length && now-sfxRecent[0]>SFXMINGAP) sfxRecent.shift();
  if(sfxRecent.length>=SFXMAXVOICE) return;
  sfxLast[bin]=now; sfxRecent.push(now);
  try{
    var s=SFX.ctx.createBufferSource(); s.buffer=b;
    /* A few percent of detune each time. Cutting ten newspapers in a row plays
       one file ten times, and the ear hears an exact repeat as a machine gun
       rather than as ten cuts. */
    s.playbackRate.value=1+(Math.random()-0.5)*0.12;
    var g=SFX.ctx.createGain(); g.gain.value=SFXSRC[bin].g;
    s.connect(g); g.connect(SFX.master); s.start();
  }catch(e){}
}

function sfxSetMuted(m){
  SFX.muted=!!m;
  lsSet("ss3d.muted", SFX.muted?"1":"0");
  var b=el("soundBtn");
  if(b){ b.textContent=SFX.muted?"Sound off":"Sound on"; b.setAttribute("aria-pressed", SFX.muted?"true":"false"); }
}

function sfxSetup(){
  /* Decode at boot, not on the first gesture. decodeAudioData works fine on a
     suspended context, and the alternative is fetching five files at the moment
     the player clicks into the arena — the first swipe would land before they
     were ready and cut in silence. */
  sfxInit();
  SFX.muted=lsGet("ss3d.muted","0")==="1";
  sfxSetMuted(SFX.muted);
  var b=el("soundBtn");
  if(b) b.addEventListener("click", function(){ sfxSetMuted(!SFX.muted); if(!SFX.muted) sfxArm(); });
  /* once:true — this is only here to satisfy the autoplay policy */
  window.addEventListener("pointerdown", sfxArm, {once:true});
  window.addEventListener("keydown", sfxArm, {once:true});
}

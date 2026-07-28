/* ================= data ================= */
var ITEMS = [
  {n:"報紙 Newspaper",     t:"news",  bin:"paper",   col:0xe9e7e0},
  {n:"紙皮 Cardboard",     t:"box",   bin:"paper",   col:0xb07a3c},
  {n:"雜誌 Magazine",      t:"mag",   bin:"paper",   col:0xe0483f},
  {n:"蒸餾水樽 Water bottle",t:"bottle",bin:"plastic", col:0x66b6ff},
  {n:"洗潔精 Dish soap",   t:"jug",   bin:"plastic", col:0x2ec98a},
  {n:"乳酪杯 Yogurt tub",  t:"tub",   bin:"plastic", col:0xf2f4f8},
  {n:"汽水罐 Soda can",    t:"canTall",bin:"metal",  col:0xc4c8ce},
  {n:"午餐肉罐 Luncheon meat", t:"spam", bin:"metal", col:0x3f6fb0},
  {n:"玻璃樽 Glass bottle", t:"wine",  bin:"glass",   col:0x2f8f5a},
  {n:"醬料樽 Sauce jar",   t:"jar",   bin:"glass",   col:0x9fd6b4},
  {n:"薄餅盒 Pizza box",   t:"pizza", bin:"trash",   col:0xcaa46a},
  {n:"珍珠奶茶 Bubble tea", t:"bubbletea", bin:"trash", col:0xd8c3a0},
  {n:"膠袋 Plastic bag",   t:"bag",   bin:"trash",   col:0xdfe3ea},
  {n:"發泡膠飯盒 Foam box", t:"foam",  bin:"trash",   col:0xffffff},
  {n:"紙包飲品 Drink carton", t:"carton", bin:"trash", col:0xe4d2a8},
  /* Every item's bin MUST be one of DBINS (paper/plastic/metal/glass/trash) —
     Bin It has no sixth bin, so a `hazard` item would have nowhere to land. */
  {n:"信封 Envelope",       t:"envelope",  bin:"paper",   col:0xf3efe4},
  {n:"廁紙筒 Roll tube",    t:"toiletRoll",bin:"paper",   col:0xe8dcc8},
  {n:"蛋盒 Egg carton",     t:"eggBox",    bin:"paper",   col:0xcbb89a},
  {n:"洗頭水樽 Shampoo",    t:"shampoo",   bin:"plastic", col:0xef7fae},
  {n:"清潔劑樽 Detergent",  t:"detergent", bin:"plastic", col:0x4aa3df},
  {n:"膠杯 Plastic cup",    t:"cup",       bin:"plastic", col:0xeef4fb},
  {n:"罐頭 Food tin",       t:"foodCan",   bin:"metal",   col:0xcdd2d8},
  {n:"錫紙 Aluminium foil", t:"foil",      bin:"metal",   col:0xd7dce2},
  {n:"啤酒樽 Beer bottle",  t:"beer",      bin:"glass",   col:0x7a4a1e},
  {n:"口罩 Face mask",      t:"mask",      bin:"trash",   col:0xbfe4f5},
  {n:"咖啡杯 Coffee cup",   t:"coffeeCup", bin:"trash",   col:0xf6f1e8},
  {n:"即棄筷子 Chopsticks", t:"chopstick", bin:"trash",   col:0xe2c58f}
];
var ROUNDS = [
  {topic:"Paper",  bins:["paper"], color:"#0a84ff", desc:"Slice only <b>paper</b> — newspaper, cardboard, magazines."},
  {topic:"Plastic",bins:["plastic"], color:"#ff9f0a", desc:"Slice only <b>plastics</b> — bottles and rinsed tubs (brown bin)."},
  {topic:"Metal & Glass", bins:["metal","glass"], color:"#30d158", desc:"Slice <b>cans</b> (yellow bin) and <b>glass</b> (green points)."},
  {topic:"Spot the traps", bins:["trash"], color:"#8e8e93", desc:"The wishcycling round: slice only the items that <b>can't</b> be recycled."}
];
var FACTS = [
  "Hong Kong sends over 11,000 tonnes of waste to landfill every day.",
  "Tricolour bins: blue = paper, yellow = metal, brown = plastic. Glass goes to green points.",
  "Greasy pizza boxes, coffee cups, plastic bags and foam are NOT recyclable in normal bins.",
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
function resize(){
  var r=stage.getBoundingClientRect(); W=r.width; H=r.height; DPR=Math.min(1.5,window.devicePixelRatio||1);
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

/* ================= item illustrations ================= */
var OL="#2d2d2d", OLW=5;
function hx(n){ return "#"+("000000"+n.toString(16)).slice(-6); }
function rr(c,x,y,w,h,r){ c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }
function fillIt(c,col){ c.fillStyle=col; c.fill(); }
function outline(c){ c.strokeStyle=OL; c.lineWidth=OLW; c.stroke(); }
function cjk(c,txt,x,y,size,col){ c.fillStyle=col||"#fff"; c.font="600 "+size+"px system-ui,'PingFang HK','PingFang TC','Microsoft JhengHei',sans-serif"; c.textAlign="center"; c.textBaseline="middle"; c.fillText(txt,x,y); }
var ART={
  news:function(c){ rr(c,45,42,130,150,10); fillIt(c,"#efeee7"); outline(c);
    rr(c,45,42,130,30,10); fillIt(c,"#d8342e"); outline(c); cjk(c,"報紙",110,57,20,"#fff");
    c.strokeStyle="#b9b6aa"; c.lineWidth=4; for(var i=0;i<7;i++){ c.beginPath(); c.moveTo(58,90+i*13); c.lineTo(162,90+i*13); c.stroke(); }
    c.strokeStyle=OL; c.lineWidth=3; c.setLineDash([6,6]); c.beginPath(); c.moveTo(110,74); c.lineTo(110,190); c.stroke(); c.setLineDash([]); },
  box:function(c){ c.beginPath(); c.moveTo(55,95); c.lineTo(150,95); c.lineTo(150,185); c.lineTo(55,185); c.closePath(); fillIt(c,"#b07a3c"); outline(c);
    c.beginPath(); c.moveTo(55,95); c.lineTo(80,68); c.lineTo(175,68); c.lineTo(150,95); c.closePath(); fillIt(c,"#c8925a"); outline(c);
    c.beginPath(); c.moveTo(150,95); c.lineTo(175,68); c.lineTo(175,158); c.lineTo(150,185); c.closePath(); fillIt(c,"#9c682f"); outline(c);
    c.strokeStyle="#e6d9b8"; c.lineWidth=8; c.beginPath(); c.moveTo(102,95); c.lineTo(102,185); c.stroke(); },
  mag:function(c,col){ rr(c,55,45,110,145,8); fillIt(c,col); outline(c);
    rr(c,55,45,110,34,8); fillIt(c,"#ffffff"); outline(c); cjk(c,"雜誌",110,62,20,"#333");
    rr(c,66,92,88,58,6); fillIt(c,"rgba(255,255,255,.8)"); outline(c);
    c.strokeStyle="#ffffff"; c.lineWidth=4; for(var i=0;i<3;i++){c.beginPath();c.moveTo(66,164+i*9);c.lineTo(154,164+i*9);c.stroke();} },
  bottle:function(c){ rr(c,98,40,24,16,4); fillIt(c,"#2b6bd0"); outline(c);
    rr(c,100,54,20,16,4); fillIt(c,"#cfeaff"); outline(c);
    rr(c,80,68,60,120,26); fillIt(c,"#cfeaff"); outline(c);
    c.save(); rr(c,80,120,60,68,26); c.clip(); c.fillStyle="#7fc4ff"; c.fillRect(80,120,60,80); c.restore();
    rr(c,80,122,60,32,4); fillIt(c,"#ffffff"); outline(c); cjk(c,"蒸餾水",110,138,16,"#1a6fb0"); },
  jug:function(c,col){ rr(c,66,80,72,110,16); fillIt(c,col); outline(c);
    c.beginPath(); c.arc(150,112,20,-1.15,1.15); c.lineWidth=13; c.strokeStyle=col; c.stroke(); c.lineWidth=OLW; c.strokeStyle=OL; c.stroke();
    rr(c,86,56,20,26,4); fillIt(c,col); outline(c); rr(c,84,46,24,12,3); fillIt(c,"#ffffff"); outline(c);
    rr(c,74,120,56,52,6); fillIt(c,"#ffffff"); outline(c); cjk(c,"洗潔精",102,146,15,"#2a8f6a"); },
  tub:function(c){ c.beginPath(); c.moveTo(72,92); c.lineTo(148,92); c.lineTo(138,180); c.lineTo(82,180); c.closePath(); fillIt(c,"#f4f5f8"); outline(c);
    c.beginPath(); c.ellipse(110,92,40,13,0,0,7); c.closePath(); fillIt(c,"#ff7db0"); outline(c); cjk(c,"乳酪",110,138,20,"#c94b86"); },
  canTall:function(c){ c.save(); rr(c,82,60,56,130,14); c.clip();
    c.fillStyle="#c9ccd2"; c.fillRect(82,60,56,130); c.fillStyle="#e14b4b"; c.fillRect(82,112,56,34); c.restore();
    rr(c,82,60,56,130,14); outline(c); c.beginPath(); c.ellipse(110,62,26,7,0,0,7); fillIt(c,"#dfe2e7"); outline(c);
    cjk(c,"汽水",110,129,18,"#fff"); },
  spam:function(c){ rr(c,52,82,116,68,10); fillIt(c,"#7d94b5"); outline(c);
    rr(c,52,72,116,16,7); fillIt(c,"#aeb9c9"); outline(c);
    c.beginPath(); c.arc(150,68,8,0,7); fillIt(c,"#c9ced6"); outline(c);
    c.strokeStyle=OL; c.lineWidth=6; c.beginPath(); c.moveTo(150,68); c.lineTo(172,68); c.stroke();
    cjk(c,"午餐肉",110,118,20,"#fff"); },
  wine:function(c){ rr(c,101,34,18,12,3); fillIt(c,"#6f4a2a"); outline(c);
    rr(c,102,44,16,42,4); fillIt(c,"#3f9e6a"); outline(c);
    c.beginPath(); c.moveTo(102,82); c.lineTo(82,112); c.lineTo(82,186); c.lineTo(138,186); c.lineTo(138,112); c.lineTo(118,82); c.closePath(); fillIt(c,"#3f9e6a"); outline(c);
    c.strokeStyle="rgba(255,255,255,.5)"; c.lineWidth=6; c.beginPath(); c.moveTo(92,122); c.lineTo(92,176); c.stroke();
    rr(c,86,132,48,38,4); fillIt(c,"#eafff3"); outline(c); cjk(c,"玻璃",110,151,16,"#2f8f5a"); },
  jar:function(c){ rr(c,72,80,76,105,14); fillIt(c,"#cdeedd"); outline(c);
    rr(c,80,58,60,26,6); fillIt(c,"#caa24a"); outline(c);
    rr(c,78,112,64,42,6); fillIt(c,"#fff"); outline(c); cjk(c,"醬料",110,133,18,"#4a8f6a"); },
  pizza:function(c){ rr(c,50,112,120,68,8); fillIt(c,"#caa46a"); outline(c);
    c.beginPath(); c.moveTo(50,112); c.lineTo(70,62); c.lineTo(190,62); c.lineTo(170,112); c.closePath(); fillIt(c,"#d9b884"); outline(c);
    c.beginPath(); c.moveTo(120,72); c.lineTo(152,102); c.lineTo(104,102); c.closePath(); fillIt(c,"#f0c04a"); outline(c);
    c.fillStyle="#c0392b"; c.beginPath(); c.arc(124,90,4,0,7); c.fill(); c.beginPath(); c.arc(136,93,4,0,7); c.fill();
    cjk(c,"薄餅",110,150,20,"#6b4a24"); },
  bubbletea:function(c){ c.beginPath(); c.moveTo(74,88); c.lineTo(146,88); c.lineTo(136,186); c.lineTo(84,186); c.closePath(); fillIt(c,"#f0e6d2"); outline(c);
    c.fillStyle="#241812"; for(var i=0;i<8;i++){ c.beginPath(); c.arc(92+(i%4)*16, 174-(i>3?11:0), 6,0,7); c.fill(); }
    c.beginPath(); c.ellipse(110,88,38,13,0,0,7); fillIt(c,"rgba(255,255,255,.7)"); outline(c);
    c.strokeStyle="#e0483f"; c.lineWidth=10; c.beginPath(); c.moveTo(128,48); c.lineTo(104,150); c.stroke();
    cjk(c,"珍珠奶茶",110,122,14,"#5a3a1a"); },
  bag:function(c){ c.strokeStyle=OL; c.lineWidth=OLW; c.beginPath(); c.arc(90,82,16,Math.PI,0); c.stroke(); c.beginPath(); c.arc(130,82,16,Math.PI,0); c.stroke();
    c.beginPath(); c.moveTo(66,88); c.lineTo(154,88); c.lineTo(146,184); c.lineTo(74,184); c.closePath(); fillIt(c,"rgba(180,205,230,.85)"); outline(c);
    c.strokeStyle="rgba(120,140,160,.6)"; c.lineWidth=3; c.beginPath(); c.moveTo(88,102); c.lineTo(96,176); c.stroke(); c.beginPath(); c.moveTo(122,102); c.lineTo(128,176); c.stroke();
    cjk(c,"膠袋",110,136,18,"#3a5a78"); },
  foam:function(c){ rr(c,56,120,108,54,8); fillIt(c,"#ffffff"); outline(c);
    c.beginPath(); c.moveTo(56,120); c.lineTo(72,84); c.lineTo(180,84); c.lineTo(164,120); c.closePath(); fillIt(c,"#f1f3f6"); outline(c);
    c.strokeStyle="#c9cfd6"; c.lineWidth=4; c.beginPath(); c.moveTo(110,124); c.lineTo(110,170); c.stroke();
    cjk(c,"發泡膠飯盒",110,150,13,"#7a828c"); },
  carton:function(c){ rr(c,74,66,72,120,8); fillIt(c,"#f2c94c"); outline(c);
    rr(c,74,66,72,16,8); fillIt(c,"#e0b23a"); outline(c);
    c.beginPath(); c.arc(110,122,20,0,7); fillIt(c,"#fff3b0"); outline(c);
    c.strokeStyle="#e0a020"; c.lineWidth=3; for(var a=0;a<8;a++){ c.beginPath(); c.moveTo(110,122); c.lineTo(110+18*Math.cos(a*0.8),122+18*Math.sin(a*0.8)); c.stroke(); }
    c.strokeStyle="#fff"; c.lineWidth=8; c.beginPath(); c.moveTo(150,40); c.lineTo(132,70); c.stroke(); c.strokeStyle=OL; c.lineWidth=3; c.beginPath(); c.moveTo(150,40); c.lineTo(132,70); c.stroke();
    cjk(c,"檸檬茶",110,168,15,"#7a5a10"); },
  envelope:function(c){ rr(c,38,72,144,86,8); fillIt(c,"#f3efe4"); outline(c);
    c.strokeStyle=OL; c.lineWidth=OLW; c.beginPath(); c.moveTo(38,76); c.lineTo(110,126); c.lineTo(182,76); c.stroke(); },
  toiletRoll:function(c){ rr(c,72,62,76,108,6); fillIt(c,"#e8dcc8"); outline(c);
    c.beginPath(); c.ellipse(110,62,38,13,0,0,7); fillIt(c,"#dccdb2"); outline(c);
    c.beginPath(); c.ellipse(110,62,15,6,0,0,7); fillIt(c,"#8a7358"); outline(c); },
  eggBox:function(c){ rr(c,40,98,140,64,10); fillIt(c,"#cbb89a"); outline(c);
    c.strokeStyle=OL; c.lineWidth=4;
    for(var i=0;i<3;i++){ c.beginPath(); c.arc(70+i*40,98,17,Math.PI,0); c.stroke(); } },
  shampoo:function(c,col){ rr(c,74,70,72,112,14); fillIt(c,col); outline(c);
    rr(c,98,38,24,34,6); fillIt(c,"#f0f3f7"); outline(c);
    rr(c,86,98,48,42,5); fillIt(c,"#ffffff"); outline(c); },
  detergent:function(c,col){ rr(c,66,76,88,104,12); fillIt(c,col); outline(c);
    rr(c,92,40,36,36,6); fillIt(c,"#e6ebf2"); outline(c);
    rr(c,78,102,64,44,5); fillIt(c,"#ffffff"); outline(c); },
  cup:function(c){ c.beginPath(); c.moveTo(72,72); c.lineTo(148,72); c.lineTo(136,180); c.lineTo(84,180); c.closePath(); fillIt(c,"#eef4fb"); outline(c);
    c.strokeStyle="#b6c5d6"; c.lineWidth=4;
    for(var i=0;i<3;i++){ c.beginPath(); c.moveTo(77+i*3,100+i*26); c.lineTo(143-i*3,100+i*26); c.stroke(); } },
  foodCan:function(c){ rr(c,66,72,88,106,10); fillIt(c,"#cdd2d8"); outline(c);
    rr(c,66,96,88,54,2); fillIt(c,"#c0392b"); outline(c);
    cjk(c,"罐頭",110,123,22,"#fff"); },
  foil:function(c){ c.beginPath(); c.moveTo(56,122); c.lineTo(84,64); c.lineTo(128,56); c.lineTo(168,96); c.lineTo(150,154); c.lineTo(94,170); c.closePath();
    fillIt(c,"#d7dce2"); outline(c);
    c.strokeStyle="#9aa4b0"; c.lineWidth=4;
    c.beginPath(); c.moveTo(84,64); c.lineTo(114,116); c.lineTo(150,154); c.stroke();
    c.beginPath(); c.moveTo(128,56); c.lineTo(114,116); c.lineTo(56,122); c.stroke(); },
  beer:function(c){ rr(c,100,28,20,14,3); fillIt(c,"#c9a227"); outline(c);
    rr(c,102,40,16,42,4); fillIt(c,"#6f421a"); outline(c);
    rr(c,78,78,64,104,14); fillIt(c,"#7a4a1e"); outline(c);
    rr(c,80,106,60,42,3); fillIt(c,"#e8d9a8"); outline(c); },
  mask:function(c){ rr(c,52,80,116,66,14); fillIt(c,"#bfe4f5"); outline(c);
    c.strokeStyle="#7fb7cf"; c.lineWidth=4;
    for(var i=0;i<3;i++){ c.beginPath(); c.moveTo(56,98+i*18); c.lineTo(164,98+i*18); c.stroke(); }
    c.strokeStyle=OL; c.lineWidth=5;
    c.beginPath(); c.arc(42,113,22,-1.15,1.15); c.stroke();
    c.beginPath(); c.arc(178,113,22,Math.PI-1.15,Math.PI+1.15); c.stroke(); },
  coffeeCup:function(c){ c.beginPath(); c.moveTo(76,82); c.lineTo(144,82); c.lineTo(134,178); c.lineTo(86,178); c.closePath(); fillIt(c,"#f6f1e8"); outline(c);
    rr(c,68,60,84,24,7); fillIt(c,"#6b4a33"); outline(c);
    rr(c,80,112,60,36,4); fillIt(c,"#c0895c"); outline(c); },
  chopstick:function(c){ c.save(); c.translate(110,110); c.rotate(-0.32);
    rr(c,-17,-78,13,156,4); fillIt(c,"#e2c58f"); outline(c);
    rr(c,5,-78,13,156,4); fillIt(c,"#e2c58f"); outline(c);
    rr(c,-24,-28,50,40,4); fillIt(c,"#f4efe4"); outline(c);
    c.restore(); },
  _def:function(c,col){ rr(c,60,60,100,100,10); fillIt(c,col||"#ccc"); outline(c); }
};
var TEXCACHE={}, SPRITE_GEO=null;
function getTex(it){
  if(TEXCACHE[it.t]) return TEXCACHE[it.t];
  var S=220, cv=document.createElement("canvas"); cv.width=S; cv.height=S; var c=cv.getContext("2d");
  (ART[it.t]||ART._def)(c, hx(it.col));
  var tex=new THREE.CanvasTexture(cv); tex.anisotropy=2;
  TEXCACHE[it.t]=tex; return tex;
}
function makeSprite(it){
  if(!SPRITE_GEO) SPRITE_GEO=new THREE.PlaneGeometry(112,112);   /* one shared geometry + one cached texture per item type = no per-spawn allocation */
  var m=new THREE.MeshBasicMaterial({map:getTex(it), transparent:true, side:THREE.DoubleSide, depthWrite:false});
  return new THREE.Mesh(SPRITE_GEO, m);
}

/* ================= game state ================= */
var G={score:0, round:0, running:false, paused:false, pauseRemain:0, roundEndAt:0, objs:[], pops:[], spawnT:0, parts:[], flashes:[]};
var BINCOL={paper:"#2f7fd1", plastic:"#e0762b", metal:"#e0a92b", glass:"#2fae6a", trash:"#8a97a0", hazard:"#d70015"};
function spawnBurst(x,y,col){
  for(var i=0;i<8;i++){ var a=Math.random()*6.28, sp=1.5+Math.random()*4.5;
    G.parts.push({x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1.5,life:1,col:col,sz:3+Math.random()*4}); }
  G.flashes.push({x:x,y:y,r:12,life:1});
}
var DIFF=DIFFS.relaxed;
var BLADE={x:0,y:0,px:0,py:0,active:false, trail:[]};
var BLADE2={x:0,y:0,px:0,py:0,active:false, trail:[]};
var controlMode="cam";

/* ================= rounds ================= */
function showOverlayFor(round){
  var R=ROUNDS[round];
  el("ovlR").textContent="Round "+(round+1)+" of "+ROUNDS.length;
  el("ovlT").textContent=R.topic; el("ovlD").innerHTML=R.desc;
  el("topicName").textContent=R.topic; el("topicDot").style.background=R.color;
  el("roundN").textContent=(round+1)+"/"+ROUNDS.length;
  el("ovlBtn").textContent = round===0 ? "Start round" : "Next round";
  el("ovl").classList.remove("hidden");
}
function startRound(){ resize(); el("ovl").classList.add("hidden");
  clearObjs(); G.pops=[]; G.parts=[]; G.flashes=[]; BLADE.trail=[]; G.spawnT=0;
  specialsReset();
  G.roundEndAt=performance.now()+DIFF.round; G.running=true; }
function endRound(){ G.running=false; G.round++;
  if(G.round>=ROUNDS.length) endGame(); else showOverlayFor(G.round); }
function clearObjs(){ G.objs.forEach(function(o){ scene.remove(o.mesh); }); G.objs=[]; }

function launchGame(){
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
var QBINS={paper:{n:"Paper",c:"#2f7fd1"},plastic:{n:"Plastic",c:"#e0762b"},metal:{n:"Metal",c:"#e0a92b"},glass:{n:"Glass",c:"#2fae6a"},trash:{n:"General",c:"#8a97a0"}};
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
function spawn(fx){
  if(G.objs.length>=16) return;   /* cap on-screen items so weaker machines don't choke */
  var R=ROUNDS[G.round]; var wantCorrect=Math.random()<0.55;
  var pool=ITEMS.filter(function(it){ return wantCorrect ? R.bins.indexOf(it.bin)>=0 : R.bins.indexOf(it.bin)<0; });
  if(!pool.length) pool=ITEMS;
  var it=pool[Math.floor(Math.random()*pool.length)];
  var x=(fx!==undefined)? fx : 60+Math.random()*(W-120);
  var vy=-(Math.sqrt(2*DIFF.g*Math.min(H,DIFF.h)))-Math.random()*0.1;
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
    if(o.y>H+100 || o.a<=0 || o.x<-120 || o.x>W+120){ scene.remove(o.mesh); G.objs.splice(i,1); }
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
      G.pops.push({x:o.x,y:o.y,txt:(pts>0?"+":"")+pts,col:correct?"#1f9d55":"#d70015",a:1}); } }
}

/* ================= controls ================= */
var camStream=null, hands=null, mpCam=null, mouseHandler=null, camWanted=false;
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
    hands.onResults(function(res){ var lm=res.multiHandLandmarks&&res.multiHandLandmarks[0];
      if(lm){ var tip=lm[8]; BLADE.x=(1-tip.x)*W; BLADE.y=tip.y*H; BLADE.active=true; } else BLADE.active=false; });
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
      BLADE.active=false; BLADE2.active=false;
      if(pts.length>=1){ BLADE.x=Math.max(0,Math.min(W/2-6,pts[0].x)); BLADE.y=pts[0].y; BLADE.active=true; }
      if(pts.length>=2){ BLADE2.x=Math.max(W/2+6,Math.min(W,pts[1].x)); BLADE2.y=pts[1].y; BLADE2.active=true; }
    });
    var v=el("cam"); mpCam=new Camera(v,{onFrame:async function(){ if(GMODE==="vs") await hands.send({image:v}); },width:640,height:480});
    await mpCam.start(); camStream=v.srcObject;
    if(!camWanted) stopCam();     /* quit during start-up — don't leave the camera running */
  }catch(err){ el("cam").classList.add("hidden"); el("camCap").classList.add("hidden"); alert("Versus needs a webcam. Please allow camera access, then try again."); show("start"); }
}
function launchVS(){
  GMODE="vs"; VS.running=false; VS.s1=0; VS.s2=0; VS.t=60000; VS.spawnT=500; VS.topicIdx=0; VS.topicT=15000;
  G.pops=[]; G.parts=[]; G.flashes=[]; BLADE.trail=[]; BLADE2.trail=[]; clearObjs();
  el("topicName").textContent="Versus"; el("topicDot").style.background="#7f77dd"; el("scoreN").textContent="0"; el("roundN").textContent="2P"; el("timeFill").style.width="100%";
  el("quizQ").classList.add("hidden"); el("pauseBtn").style.display="";
  show("play"); resize(); el("ovl").classList.add("hidden"); el("pauseOvl").classList.add("hidden");
  setupCamVS(); VS.running=true;
}
function vsSpawn(side){
  if(G.objs.length>=18) return;
  var tb=ROUNDS[VS.topicIdx].bins, want=Math.random()<0.55;
  var pool=ITEMS.filter(function(x){ return want ? tb.indexOf(x.bin)>=0 : tb.indexOf(x.bin)<0; });
  if(!pool.length) pool=ITEMS;
  var it=pool[Math.floor(Math.random()*pool.length)];
  var lo=side===0?60:(W/2+30), hi=side===0?(W/2-30):(W-60), x=lo+Math.random()*Math.max(20,hi-lo);
  var vy=-(Math.sqrt(2*0.0006*Math.min(H,380)))-Math.random()*0.03;
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
    if(o.y>H+110||o.a<=0){ scene.remove(o.mesh); G.objs.splice(i,1); }
  }
  if(BLADE.active){ vsSliceFor(0,BLADE.px,BLADE.py,BLADE.x,BLADE.y); BLADE.trail.push({x:BLADE.x,y:BLADE.y,t:now}); } BLADE.px=BLADE.x; BLADE.py=BLADE.y;
  if(BLADE2.active){ vsSliceFor(1,BLADE2.px,BLADE2.py,BLADE2.x,BLADE2.y); BLADE2.trail.push({x:BLADE2.x,y:BLADE2.y,t:now}); } BLADE2.px=BLADE2.x; BLADE2.py=BLADE2.y;
}
function vsGameOver(){
  VS.running=false; el("pauseBtn").style.display="";
  var winner = VS.s1>VS.s2? "Player 1 (blue) wins!" : (VS.s2>VS.s1? "Player 2 (red) wins!" : "It's a draw!");
  el("rScore").textContent=VS.s1+" – "+VS.s2;
  el("rGrade").textContent=winner;
  var f=el("rFacts"); f.innerHTML=""; var d=document.createElement("div"); d.className="fact"; d.textContent="Slice recyclables (+1) and avoid trash (−1) — most points in 60 seconds wins."; f.appendChild(d);
  scoresHidePanel();                      /* two players on one screen — a personal best has no meaning here */
  stopCam();
  show("result");
}
function drawTrail(trail, now, rgb){
  while(trail.length && now-trail[0].t>=140) trail.shift();
  if(trail.length>1){ fxc.lineCap="round"; fxc.lineJoin="round";
    for(var b=1;b<trail.length;b++){ fxc.strokeStyle="rgba("+rgb+","+(b/trail.length*0.85)+")"; fxc.lineWidth=b/trail.length*12+2;
      fxc.beginPath(); fxc.moveTo(trail[b-1].x,trail[b-1].y); fxc.lineTo(trail[b].x,trail[b].y); fxc.stroke(); } }
}
function vsDraw(now){
  fxc.save(); fxc.strokeStyle="rgba(120,140,130,.45)"; fxc.lineWidth=3; fxc.setLineDash([10,10]); fxc.beginPath(); fxc.moveTo(W/2,0); fxc.lineTo(W/2,H); fxc.stroke(); fxc.setLineDash([]); fxc.restore();
  fxc.textAlign="center"; fxc.textBaseline="top";
  fxc.fillStyle="#2f7fd1"; fxc.font="700 28px 'Fredoka',system-ui,sans-serif"; fxc.fillText("P1  "+VS.s1, W*0.25, 12);
  fxc.fillStyle="#e24b4a"; fxc.fillText("P2  "+VS.s2, W*0.75, 12);
  var R=ROUNDS[VS.topicIdx];
  fxc.fillStyle="rgba(255,255,255,.9)"; fxc.strokeStyle=R.color; fxc.lineWidth=2;
  var bw=Math.max(180, fxc.measureText("Slice: "+R.topic).width+40);
  fxc.beginPath(); fxc.roundRect(W/2-bw/2, 8, bw, 52, 14); fxc.fill(); fxc.stroke();
  fxc.fillStyle=R.color; fxc.font="700 22px 'Fredoka',system-ui,sans-serif"; fxc.fillText("Slice: "+R.topic, W/2, 12);
  fxc.fillStyle="#173a2a"; fxc.font="700 15px 'Fredoka',system-ui,sans-serif"; fxc.fillText(Math.ceil(Math.max(0,VS.t)/1000)+"s", W/2, 38);
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
  roomCode=(""+Math.floor(1000+Math.random()*9000));
  var base=new URL("controller.html", location.href); base.search="?room="+roomCode;
  var link=base.toString();
  drawQR(link);
  el("connGo").disabled=true; el("connGo").textContent="Waiting for phone…";
  roomLine("Connecting to relay…");
  connectHostMqtt();
  el("connUrl").innerHTML='<button class="btn ghost" id="copyLinkBtn" style="font-size:13px;padding:8px 16px">Copy link</button>';
  document.getElementById("copyLinkBtn").addEventListener("click", function(){
    try{ navigator.clipboard.writeText(link).then(function(){ el("connUrl").innerHTML='Copied!'; });
    }catch(e){ el("connUrl").innerHTML='Link: <span style="word-break:break-all;font-size:12px">'+link+'</span>'; }
  });
}
var HICE={iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"turn:openrelay.metered.ca:80",username:"openrelayproject",credential:"openrelayproject"}]};
var hostPC=null, hostTopic=null;
function hostPub(o){ if(mqttClient&&mqttClient.connected) mqttClient.publish(hostTopic, JSON.stringify(o), {qos:0}); }
function hostAnswer(offer){
  if(typeof RTCPeerConnection==="undefined") return;
  try{
    hostPC=new RTCPeerConnection(HICE);
    hostPC.onicecandidate=function(e){ if(e.candidate) hostPub({from:"host", type:"ice", cand:e.candidate}); };
    hostPC.ondatachannel=function(e){ var ch=e.channel; ch.onmessage=function(m){ try{ var o=JSON.parse(m.data); applyRemote(o.g,o.b); }catch(_){} }; };
    hostPC.setRemoteDescription(offer).then(function(){ return hostPC.createAnswer(); }).then(function(a){ return hostPC.setLocalDescription(a); }).then(function(){ hostPub({from:"host", type:"answer", sdp:hostPC.localDescription}); }).catch(function(){});
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
    if(d.type==="hello"){ el("connStatus").innerHTML='Phone <b>connected!</b> — press Start game'; el("connGo").disabled=false; el("connGo").textContent="Start game"; }
    else if(d.type==="orient"){ applyRemote(d.g,d.b); }          /* relay fallback */
    else if(d.type==="offer"){ hostAnswer(d.sdp); }              /* set up direct link */
    else if(d.type==="ice" && hostPC){ try{ hostPC.addIceCandidate(d.cand); }catch(e){} }
  });
  mqttClient.on("error", function(){ roomLine("Relay error — check internet, then reload."); });
}
function applyRemote(g,b){ BLADE.x=Math.max(0,Math.min(W, W*(0.5+(g||0)/60))); BLADE.y=Math.max(0,Math.min(H, H*(((b||45)-15)/55))); BLADE.active=true; }
function stopPeer(){ if(mqttClient){ try{ mqttClient.end(true); }catch(e){} } }

/* ================= main loop ================= */
var last=performance.now(), tnow=0;
function loop(now){
  var dt=Math.min(48,now-last); last=now; tnow=now;
  if(GMODE==="quiz"){
    if(Q.running && !G.paused){
      quizUpdate(dt);
      if(BLADE.active){ quizSliceCheck(BLADE.px,BLADE.py,BLADE.x,BLADE.y); BLADE.trail.push({x:BLADE.x,y:BLADE.y,t:now}); }
      BLADE.px=BLADE.x; BLADE.py=BLADE.y;
    }
  } else if(GMODE==="tsunami"){
    if(TS.running && !G.paused){ tsunamiUpdate(dt, now); if(BLADE.active){ tsunamiSlice(BLADE.px,BLADE.py,BLADE.x,BLADE.y); BLADE.trail.push({x:BLADE.x,y:BLADE.y,t:now}); } BLADE.px=BLADE.x; BLADE.py=BLADE.y; }
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
  requestAnimationFrame(loop);
}
function roundedText(txt,x,y){
  fxc.font="600 13px 'Fredoka',-apple-system,system-ui,sans-serif";
  var w=fxc.measureText(txt).width+16, h=22;
  fxc.fillStyle="rgba(255,255,255,.92)"; fxc.strokeStyle="rgba(0,0,0,.08)"; fxc.lineWidth=1;
  var rx=x-w/2, ry=y-h/2, rr=11;
  fxc.beginPath();
  fxc.moveTo(rx+rr,ry); fxc.arcTo(rx+w,ry,rx+w,ry+h,rr); fxc.arcTo(rx+w,ry+h,rx,ry+h,rr);
  fxc.arcTo(rx,ry+h,rx,ry,rr); fxc.arcTo(rx,ry,rx+w,ry,rr); fxc.closePath(); fxc.fill(); fxc.stroke();
  fxc.fillStyle="#1d1d1f"; fxc.textAlign="center"; fxc.textBaseline="middle"; fxc.fillText(txt,x,y);
}
function drawFx(now){
  fxc.clearRect(0,0,W,H);
  if(GMODE==="quiz"){ quizDraw(now); }
  else if(GMODE==="tsunami"){ tsunamiDraw(now); }
  else if(GMODE==="vs"){ vsDraw(now); }
  else if(G.running && !G.paused){ specialDraw(now); }
  /* item name labels */
  if(G.running || (GMODE==="tsunami" && TS.running) || (GMODE==="vs" && VS.running)){ for(var i=0;i<G.objs.length;i++){ var o=G.objs[i]; if(o.a<0.5) continue; roundedText(o.it.n, o.x, o.y+o.r+4); } }
  /* score pops */
  for(var k=G.pops.length-1;k>=0;k--){ var p=G.pops[k]; p.y-=1.1; p.a-=0.02;
    fxc.save(); fxc.globalAlpha=Math.max(0,p.a); fxc.fillStyle=p.col;
    fxc.font="700 26px 'Fredoka',-apple-system,system-ui,sans-serif"; fxc.textAlign="center"; fxc.textBaseline="middle";
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
  /* blade trail + marker (single-blade modes; VS draws its own two coloured blades) */
  if(GMODE!=="vs"){
  BLADE.trail=BLADE.trail.filter(function(b){return now-b.t<140});
  if(BLADE.trail.length>1){ fxc.lineCap="round"; fxc.lineJoin="round";
    for(var b=1;b<BLADE.trail.length;b++){ var a=BLADE.trail[b-1],c=BLADE.trail[b];
      fxc.strokeStyle="rgba(255,255,255,"+(b/BLADE.trail.length*0.9)+")"; fxc.lineWidth=b/BLADE.trail.length*14+2;
      fxc.beginPath(); fxc.moveTo(a.x,a.y); fxc.lineTo(c.x,c.y); fxc.stroke(); }
    for(var b2=1;b2<BLADE.trail.length;b2++){ var a2=BLADE.trail[b2-1],c2=BLADE.trail[b2];
      fxc.strokeStyle="rgba(32,164,90,"+(b2/BLADE.trail.length*0.55)+")"; fxc.lineWidth=b2/BLADE.trail.length*7+1;
      fxc.beginPath(); fxc.moveTo(a2.x,a2.y); fxc.lineTo(c2.x,c2.y); fxc.stroke(); } }
  /* blade marker for cam/remote */
  if((controlMode==="cam"||controlMode==="remote") && BLADE.active){
    fxc.save();
    fxc.strokeStyle="rgba(32,164,90,.95)"; fxc.lineWidth=3; fxc.beginPath(); fxc.arc(BLADE.x,BLADE.y,20,0,7); fxc.stroke();
    fxc.fillStyle="rgba(32,164,90,.95)"; fxc.beginPath(); fxc.arc(BLADE.x,BLADE.y,6,0,7); fxc.fill();
    roundedText(controlMode==="cam"?"YOUR HAND":"YOUR BLADE", BLADE.x, BLADE.y-30);
    fxc.restore();
  }
  }
}

/* ================= screens/wire ================= */
function show(id){ ["start","connect","controller","play","result"].forEach(function(s){ el(s).classList.toggle("hidden", s!==id); });
  if(id==="start") scoresRenderStartBest();   /* refresh the best-score line after a run */ }
document.querySelectorAll(".opt").forEach(function(o){ o.addEventListener("click", function(){
  document.querySelectorAll(".opt").forEach(function(x){x.classList.remove("sel"); x.setAttribute("aria-pressed","false");}); o.classList.add("sel"); o.setAttribute("aria-pressed","true"); controlMode=o.dataset.mode; }); });
document.querySelectorAll("#diffSeg button").forEach(function(bn){ bn.addEventListener("click", function(){
  document.querySelectorAll("#diffSeg button").forEach(function(x){x.classList.remove("on")}); bn.classList.add("on"); DIFF=DIFFS[bn.dataset.d]; }); });
document.querySelectorAll("#modeSeg button").forEach(function(bn){ bn.addEventListener("click", function(){
  document.querySelectorAll("#modeSeg button").forEach(function(x){x.classList.remove("on")}); bn.classList.add("on"); GMODE=bn.dataset.g; }); });

function startChosen(){ if(GMODE==="quiz") launchQuiz(); else if(GMODE==="tsunami") launchTsunami(); else if(GMODE==="vs") launchVS(); else launchGame(); }
el("playBtn").addEventListener("click", function(){
  if(GMODE==="vs") launchVS();                       /* Versus always uses the two-hand webcam */
  else if(controlMode==="remote") hostStartConnect();
  else startChosen();
});
el("connGo").addEventListener("click", function(){ startChosen(); });
el("connBack").addEventListener("click", function(){ stopPeer(); show("start"); });
el("ovlBtn").addEventListener("click", startRound);
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
if(IS_CONTROLLER){
  show("controller");
  try { bootController(); } catch(e) {
    el("ctrlStatus").innerHTML = "Error: " + (e.message || "page load failed") + " — reload the page.";
  }
} else {
  initThree(); resize(); requestAnimationFrame(loop);
}


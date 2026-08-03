/* The canvas font family, in ONE place.
   It used to be written out 24 times across game.js, mode-quiz.js,
   mode-defend.js and specials.js. Changing the webfont in index.html therefore
   left every canvas label silently falling back to system-ui while the DOM used
   the new face — a mismatch nobody would think to check. Defined here because
   items.js loads first, so it exists before anything draws.
   Keep in step with the font-family in css/styles.css and controller.html. */
var FONT="'Space Grotesk',-apple-system,BlinkMacSystemFont,system-ui,sans-serif";

/* ================= ITEM ROSTER + ARTWORK =================
   Split out of game.js: that file had grown past 870 lines while mixing the
   roster, the artwork, the 3D engine, Sort mode and networking. Roster and
   artwork are pure data plus drawing with no engine dependency, so they live
   here. Loaded BEFORE game.js.

   Rules that are easy to break:
   - `t` must be unique. game.js indexes ITEMBYT by it, so a duplicate silently
     shadows an item instead of erroring.
   - `bin` must be one of the five QBINS keys. Bin It has no sixth bin.
   - Every item needs an ART[t]. A missing one falls back to ART._def, a plain
     grey square, which ships as a blank box nobody notices — checkItems() in
     game.js exists to catch exactly that.

   Ten items per bin is deliberate. Modelling a 25s Bin It round showed the old
   three glass items each appeared ~6.5 times; at ten it is ~3.4, and the curve
   is flat past that.

   Bins follow the HK EPD GREEN@COMMUNITY list. Notably drink cartons, plastic
   bags and styrofoam ARE accepted there, so they are not general waste even
   though people assume they are. Everything left in `trash` is on the
   published NOT-accepted list. */
var ITEMS = [
  /* --- PAPER --- cartons moved here from trash: GREEN@COMMUNITY collects them */
  {n:"報紙 Newspaper",      t:"news",         bin:"paper",    col:0xe9e7e0},
  {n:"紙皮 Cardboard",      t:"box",          bin:"paper",    col:0xb07a3c},
  {n:"雜誌 Magazine",       t:"mag",          bin:"paper",    col:0xe0483f},
  {n:"信封 Envelope",       t:"envelope",     bin:"paper",    col:0xf3efe4},
  {n:"廁紙筒 Roll tube",     t:"toiletRoll",   bin:"paper",    col:0xe8dcc8},
  {n:"蛋盒 Egg carton",     t:"eggBox",       bin:"paper",    col:0xcbb89a},
  {n:"紙包飲品 Drink carton", t:"carton",       bin:"paper",    col:0xe4d2a8},
  {n:"辦公室紙 Office paper", t:"officePaper",  bin:"paper",    col:0xf7f7f4},
  {n:"教科書 Textbook",      t:"textbook",     bin:"paper",    col:0x4a7fc1},
  {n:"紙袋 Paper bag",      t:"paperBag",     bin:"paper",    col:0xc8a06a},
  /* --- PLASTIC --- bags and foam moved here from trash: both on the accepted list */
  {n:"蒸餾水樽 Water bottle",  t:"bottle",       bin:"plastic",  col:0x66b6ff},
  {n:"洗潔精 Dish soap",      t:"jug",          bin:"plastic",  col:0x2ec98a},
  {n:"乳酪杯 Yogurt tub",     t:"tub",          bin:"plastic",  col:0xf2f4f8},
  {n:"洗頭水樽 Shampoo",       t:"shampoo",      bin:"plastic",  col:0xef7fae},
  {n:"清潔劑樽 Detergent",     t:"detergent",    bin:"plastic",  col:0x4aa3df},
  {n:"膠杯 Plastic cup",     t:"cup",          bin:"plastic",  col:0xeef4fb},
  {n:"膠袋 Plastic bag",     t:"bag",          bin:"plastic",  col:0xdfe3ea},
  {n:"發泡膠飯盒 Foam box",     t:"foam",         bin:"plastic",  col:0xffffff},
  {n:"光碟盒 CD case",        t:"cdCase",       bin:"plastic",  col:0xd8dce4},
  {n:"保鮮盒 Food container", t:"foodBox",      bin:"plastic",  col:0x9fd8e8},
  /* --- METAL --- milk powder cans, poon choi trays and bread tongs are named on the HK list */
  {n:"汽水罐 Soda can",        t:"canTall",      bin:"metal",    col:0xc4c8ce},
  {n:"午餐肉罐 Luncheon meat",  t:"spam",         bin:"metal",    col:0x3f6fb0},
  {n:"罐頭 Food tin",         t:"foodCan",      bin:"metal",    col:0xcdd2d8},
  {n:"錫紙 Aluminium foil",   t:"foil",         bin:"metal",    col:0xd7dce2},
  {n:"奶粉罐 Milk powder can", t:"milkPowder",   bin:"metal",    col:0x3f8ac4},
  {n:"盆菜盆 Poon choi tray",  t:"poonChoi",     bin:"metal",    col:0xb8bfc6},
  {n:"麵包夾 Bread tongs",     t:"breadTongs",   bin:"metal",    col:0xc9ced6},
  {n:"餅乾罐 Biscuit tin",     t:"biscuitTin",   bin:"metal",    col:0xd4443a},
  {n:"鋁盤 Aluminium tray",   t:"alTray",       bin:"metal",    col:0xc2c8d0},
  {n:"金屬樽蓋 Bottle cap",     t:"metalCap",     bin:"metal",    col:0xd8a13c},
  /* --- GLASS --- accepted glass is beverage bottles and food/sauce jars only */
  {n:"玻璃樽 Glass bottle",   t:"wine",         bin:"glass",    col:0x2f8f5a},
  {n:"醬料樽 Sauce jar",      t:"jar",          bin:"glass",    col:0x9fd6b4},
  {n:"啤酒樽 Beer bottle",    t:"beer",         bin:"glass",    col:0x7a4a1e},
  {n:"豉油樽 Soy sauce",      t:"soySauce",     bin:"glass",    col:0x5a3a1e},
  {n:"果醬樽 Jam jar",        t:"jamJar",       bin:"glass",    col:0xc2456a},
  {n:"香水樽 Perfume",        t:"perfume",      bin:"glass",    col:0xefc8dc},
  {n:"藥樽 Medicine bottle", t:"medicine",     bin:"glass",    col:0x9a6f3c},
  {n:"油樽 Cooking oil",     t:"oilBottle",    bin:"glass",    col:0xd9b23c},
  {n:"醋樽 Vinegar",         t:"vinegar",      bin:"glass",    col:0xc2452a},
  {n:"汽水玻璃樽 Glass soda",   t:"glassSoda",    bin:"glass",    col:0x7fc4d8},
  /* --- TRASH --- every one of these is on the HK NOT-accepted list, and every one looks recyclable */
  {n:"薄餅盒 Pizza box",    t:"pizza",        bin:"trash",    col:0xcaa46a},
  {n:"珍珠奶茶 Bubble tea",  t:"bubbletea",    bin:"trash",    col:0xd8c3a0},
  {n:"口罩 Face mask",     t:"mask",         bin:"trash",    col:0xbfe4f5},
  {n:"咖啡杯 Coffee cup",   t:"coffeeCup",    bin:"trash",    col:0xf6f1e8},
  {n:"即棄筷子 Chopsticks",  t:"chopstick",    bin:"trash",    col:0xe2c58f},
  {n:"收據 Receipt",       t:"receipt",      bin:"trash",    col:0xf7f3e8},
  {n:"紙巾 Tissue",        t:"tissue",       bin:"trash",    col:0xfafafa},
  {n:"鏡 Mirror",         t:"mirror",       bin:"trash",    col:0xc8d8e0},
  {n:"相片 Photograph",    t:"photo",        bin:"trash",    col:0xe8dcc0},
  {n:"陶瓷碗 Ceramic bowl", t:"ceramic",      bin:"trash",    col:0xf0e6d2},
];

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
  /* ---- paper ---- */
  officePaper:function(c){ c.save(); c.translate(110,112); c.rotate(-0.13);
    rr(c,-56,-74,112,148,4); fillIt(c,"#e9e9e4"); outline(c); c.restore();
    c.save(); c.translate(110,108); c.rotate(0.07);
    rr(c,-54,-72,108,144,4); fillIt(c,"#ffffff"); outline(c);
    c.strokeStyle="#c3c8d0"; c.lineWidth=4;
    for(var i=0;i<6;i++){ c.beginPath(); c.moveTo(-36,-46+i*22); c.lineTo(36,-46+i*22); c.stroke(); }
    c.restore(); },
  textbook:function(c,col){ rr(c,58,48,104,144,6); fillIt(c,col); outline(c);
    rr(c,58,48,22,144,6); fillIt(c,"#2f5f9e"); outline(c);
    rr(c,92,72,58,46,4); fillIt(c,"#ffffff"); outline(c);
    cjk(c,"教科書",120,152,19,"#fff"); },
  paperBag:function(c,col){ c.strokeStyle=OL; c.lineWidth=OLW;
    c.beginPath(); c.arc(110,80,26,Math.PI,0); c.stroke();
    rr(c,62,80,96,108,4); fillIt(c,col); outline(c);
    c.strokeStyle="#8a6636"; c.lineWidth=3; c.beginPath(); c.moveTo(64,102); c.lineTo(156,102); c.stroke();
    cjk(c,"紙袋",110,144,20,"#6b4a24"); },

  /* ---- plastic ---- */
  cdCase:function(c){ rr(c,52,52,116,116,5); fillIt(c,"#c2c8d2"); outline(c);
    rr(c,62,62,96,96,3); fillIt(c,"#eef1f6"); outline(c);
    c.beginPath(); c.arc(110,110,37,0,7); fillIt(c,"#b9c6d8"); outline(c);
    c.strokeStyle="rgba(255,255,255,.75)"; c.lineWidth=6;
    c.beginPath(); c.arc(110,110,26,-2.4,-1.1); c.stroke();
    c.beginPath(); c.arc(110,110,10,0,7); fillIt(c,"#ffffff"); outline(c); },
  foodBox:function(c){ c.beginPath(); c.moveTo(62,98); c.lineTo(158,98); c.lineTo(146,180); c.lineTo(74,180); c.closePath(); fillIt(c,"#dff0f7"); outline(c);
    rr(c,52,76,136,24,5); fillIt(c,"#3fa8d8"); outline(c);
    c.strokeStyle="rgba(255,255,255,.7)"; c.lineWidth=5; c.beginPath(); c.moveTo(84,112); c.lineTo(80,166); c.stroke();
    cjk(c,"保鮮盒",110,142,15,"#2f7a9e"); },

  /* ---- metal ---- */
  milkPowder:function(c,col){ rr(c,64,76,92,110,8); fillIt(c,col); outline(c);
    c.beginPath(); c.ellipse(110,76,46,14,0,0,7); fillIt(c,"#e8edf3"); outline(c);
    rr(c,72,110,76,46,4); fillIt(c,"#ffffff"); outline(c); cjk(c,"奶粉",110,133,21,"#3f8ac4"); },
  poonChoi:function(c){ c.beginPath(); c.moveTo(44,98); c.lineTo(176,98); c.lineTo(150,168); c.lineTo(70,168); c.closePath(); fillIt(c,"#b8bfc6"); outline(c);
    c.beginPath(); c.ellipse(110,98,66,19,0,0,7); fillIt(c,"#d3d9df"); outline(c);
    c.beginPath(); c.ellipse(110,98,50,13,0,0,7); fillIt(c,"#8f6a3f"); outline(c);
    cjk(c,"盆菜",110,140,19,"#3f4650"); },
  /* Two arms meeting at a sharp point read unmistakably as a drawing compass.
     Real bakery tongs are a HAIRPIN — one piece bent over at the top — so they
     are drawn as a single curved stroke, with flat pads and a slice held
     between them to settle what they are. */
  breadTongs:function(c){
    c.lineCap="round"; c.lineJoin="round";
    c.beginPath();
    c.moveTo(70,160); c.lineTo(80,96);
    c.quadraticCurveTo(110,46,140,96);
    c.lineTo(150,160);
    c.strokeStyle=OL; c.lineWidth=23; c.stroke();
    c.strokeStyle="#c9ced6"; c.lineWidth=13; c.stroke();
    c.lineCap="butt"; c.lineJoin="miter";
    rr(c,54,148,36,24,5); fillIt(c,"#aeb6c0"); outline(c);
    rr(c,130,148,36,24,5); fillIt(c,"#aeb6c0"); outline(c);
    rr(c,92,146,36,40,6); fillIt(c,"#e8c88a"); outline(c);
    c.beginPath(); c.arc(110,148,18,Math.PI,0); fillIt(c,"#f2dcae"); outline(c); },
  biscuitTin:function(c,col){ rr(c,58,88,104,92,10); fillIt(c,col); outline(c);
    c.beginPath(); c.ellipse(110,88,52,17,0,0,7); fillIt(c,"#e8b0a8"); outline(c);
    rr(c,70,114,80,42,4); fillIt(c,"#ffffff"); outline(c); cjk(c,"餅乾",110,135,21,"#c0392b"); },
  alTray:function(c){ c.beginPath(); c.moveTo(44,90); c.lineTo(176,90); c.lineTo(150,166); c.lineTo(70,166); c.closePath(); fillIt(c,"#c2c8d0"); outline(c);
    c.strokeStyle="#98a2ae"; c.lineWidth=4;
    for(var i=0;i<5;i++){ c.beginPath(); c.moveTo(62+i*24,98); c.lineTo(73+i*19,160); c.stroke(); }
    c.beginPath(); c.ellipse(110,90,68,17,0,0,7); fillIt(c,"#dde2e8"); outline(c); },
  metalCap:function(c,col){ c.save(); c.translate(110,110);
    c.beginPath();
    for(var i=0;i<22;i++){ var a=i/22*Math.PI*2, r=(i%2?50:62); c.lineTo(Math.cos(a)*r, Math.sin(a)*r); }
    c.closePath(); fillIt(c,col); outline(c);
    c.beginPath(); c.arc(0,0,36,0,7); fillIt(c,"#f0d98a"); outline(c);
    c.restore(); cjk(c,"樽蓋",110,116,17,"#7a5a10"); },

  /* ---- glass ----
     Seven bottles is the biggest single-shape cluster in the roster, so these
     lean on SILHOUETTE first (squat jar, round flask, slim neck, contoured
     soda) and colour second. Labels are decoration; they are unreadable at
     sprite size and must never be the only thing telling two items apart. */
  soySauce:function(c){ rr(c,98,30,24,16,3); fillIt(c,"#c0392b"); outline(c);
    rr(c,100,44,20,38,3); fillIt(c,"#4a2f18"); outline(c);
    rr(c,84,80,52,106,10); fillIt(c,"#3f2814"); outline(c);
    rr(c,88,112,44,44,4); fillIt(c,"#f2e2c0"); outline(c); cjk(c,"豉油",110,134,18,"#5a3a1e"); },
  jamJar:function(c,col){ rr(c,64,90,92,92,14); fillIt(c,"#f6dce4"); outline(c);
    rr(c,70,64,80,28,6); fillIt(c,col); outline(c);
    rr(c,74,114,72,42,4); fillIt(c,"#ffffff"); outline(c); cjk(c,"果醬",110,135,19,"#c2456a"); },
  perfume:function(c,col){ rr(c,99,42,22,24,3); fillIt(c,"#c9a227"); outline(c);
    rr(c,104,64,12,18,2); fillIt(c,"#e8d9a8"); outline(c);
    c.beginPath(); c.arc(110,132,52,0,7); fillIt(c,col); outline(c);
    c.strokeStyle="rgba(255,255,255,.7)"; c.lineWidth=7;
    c.beginPath(); c.arc(110,132,34,-2.5,-1.4); c.stroke(); },
  medicine:function(c,col){ rr(c,86,50,48,22,4); fillIt(c,"#f0f3f7"); outline(c);
    rr(c,80,70,60,106,10); fillIt(c,col); outline(c);
    rr(c,88,102,44,52,4); fillIt(c,"#ffffff"); outline(c);
    c.strokeStyle="#c0392b"; c.lineWidth=6; c.lineCap="round";
    c.beginPath(); c.moveTo(110,114); c.lineTo(110,142); c.stroke();
    c.beginPath(); c.moveTo(96,128); c.lineTo(124,128); c.stroke(); c.lineCap="butt"; },
  oilBottle:function(c,col){ rr(c,102,24,16,12,3); fillIt(c,"#3f6f3f"); outline(c);
    rr(c,103,34,14,54,3); fillIt(c,col); outline(c);
    c.beginPath(); c.moveTo(103,84); c.lineTo(80,122); c.lineTo(80,186); c.lineTo(140,186); c.lineTo(140,122); c.lineTo(117,84); c.closePath(); fillIt(c,col); outline(c);
    rr(c,86,134,48,36,4); fillIt(c,"#fff8e0"); outline(c); cjk(c,"食油",110,152,16,"#9a7a10"); },
  /* Was a brown bottle, which made three near-identical dark bottles with beer
     and soy sauce. Now red 浙醋 with sloped shoulders — colour AND silhouette
     both differ, so it survives being shrunk to sprite size. */
  vinegar:function(c,col){ rr(c,102,32,16,12,3); fillIt(c,"#7a2a1a"); outline(c);
    rr(c,103,42,14,30,3); fillIt(c,col); outline(c);
    c.beginPath(); c.moveTo(103,68); c.lineTo(76,104); c.lineTo(76,184); c.lineTo(144,184); c.lineTo(144,104); c.lineTo(117,68); c.closePath(); fillIt(c,col); outline(c);
    rr(c,82,122,56,44,4); fillIt(c,"#fbeee0"); outline(c); cjk(c,"浙醋",110,144,19,"#a83a20"); },
  glassSoda:function(c,col){ rr(c,100,26,20,12,3); fillIt(c,"#c0392b"); outline(c);
    rr(c,101,36,18,30,3); fillIt(c,col); outline(c);
    c.beginPath(); c.moveTo(101,62); c.lineTo(84,92); c.lineTo(93,124); c.lineTo(84,156); c.lineTo(84,186); c.lineTo(136,186); c.lineTo(136,156); c.lineTo(127,124); c.lineTo(136,92); c.lineTo(119,62); c.closePath(); fillIt(c,col); outline(c);
    rr(c,88,130,44,34,4); fillIt(c,"#ffffff"); outline(c); cjk(c,"汽水",110,147,16,"#2f8aa8"); },

  /* ---- trash: the "looks recyclable but isn't" set ---- */
  receipt:function(c){ c.save(); c.translate(110,108); c.rotate(0.09);
    c.beginPath(); c.moveTo(-36,-84); c.lineTo(36,-84); c.lineTo(36,66);
    c.quadraticCurveTo(18,84,0,71); c.quadraticCurveTo(-18,58,-36,76); c.closePath();
    fillIt(c,"#f7f3e8"); outline(c);
    c.strokeStyle="#b8b0a0"; c.lineWidth=4;
    for(var i=0;i<7;i++){ c.beginPath(); c.moveTo(-24,-64+i*18); c.lineTo(24,-64+i*18); c.stroke(); }
    c.restore(); },
  tissue:function(c){ rr(c,54,106,112,72,8); fillIt(c,"#e6f0fa"); outline(c);
    c.beginPath(); c.moveTo(90,106); c.lineTo(110,56); c.lineTo(130,106); c.closePath(); fillIt(c,"#ffffff"); outline(c);
    rr(c,66,126,88,16,4); fillIt(c,"#a8c8e8"); outline(c);
    cjk(c,"紙巾",110,160,18,"#5a7a9a"); },
  mirror:function(c){ rr(c,98,152,24,46,7); fillIt(c,"#9aa4b0"); outline(c);
    c.beginPath(); c.ellipse(110,100,52,64,0,0,7); fillIt(c,"#b9c9d6"); outline(c);
    c.beginPath(); c.ellipse(110,100,39,51,0,0,7); fillIt(c,"#eaf4fa"); outline(c);
    c.strokeStyle="#ffffff"; c.lineWidth=9; c.lineCap="round";
    c.beginPath(); c.moveTo(-16+110,-30+100); c.lineTo(-4+110,16+100); c.stroke();
    c.beginPath(); c.moveTo(6+110,-32+100); c.lineTo(12+110,-14+100); c.stroke(); c.lineCap="butt"; },
  photo:function(c){ c.save(); c.translate(110,110); c.rotate(-0.11);
    rr(c,-58,-66,116,132,4); fillIt(c,"#fbf8f0"); outline(c);
    rr(c,-46,-54,92,86,2); fillIt(c,"#7fb7cf"); outline(c);
    c.save(); rr(c,-46,-54,92,86,2); c.clip();
    c.beginPath(); c.moveTo(-46,32); c.lineTo(-10,-16); c.lineTo(14,16); c.lineTo(30,-4); c.lineTo(46,32); c.closePath(); fillIt(c,"#4a8f6a");
    c.beginPath(); c.arc(24,-34,11,0,7); fillIt(c,"#f5c518");
    c.restore(); rr(c,-46,-54,92,86,2); outline(c);
    c.restore(); },
  ceramic:function(c){ c.beginPath(); c.moveTo(52,102); c.quadraticCurveTo(110,194,168,102); c.closePath(); fillIt(c,"#f4ece0"); outline(c);
    c.strokeStyle="#4a7fc1"; c.lineWidth=5; c.beginPath(); c.moveTo(66,122); c.quadraticCurveTo(110,146,154,122); c.stroke();
    c.beginPath(); c.ellipse(110,102,58,17,0,0,7); fillIt(c,"#ffffff"); outline(c);
    cjk(c,"陶瓷",110,102,18,"#8a7a5c"); },
  _def:function(c,col){ rr(c,60,60,100,100,10); fillIt(c,col||"#ccc"); outline(c); }
};

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page browser arcade game for **SDG 12** — a Fruit-Ninja-style slicer
teaching Hong Kong recycling. No build step, no framework, no bundler. Plain
HTML + CSS + ES5-ish JS with CDN libraries, deployed static to Vercel.

Current state: **build 73**. "Preview V6" dark arcade UI, 50 items, four modes,
blade skins with an XP/level system.

Repo: `Oliver-jig/sorting-machine`. Two branches, **kept in sync after every
change**: work on `claude`, then merge into `master` and push both.

## Commands

```bash
npm start                 # python3 -m http.server 8137 — then open localhost:8137
```

Serve it; do not open `index.html` from disk. Camera and device-motion APIs
need a served origin, and the phone controller needs https (i.e. a deploy).

**`npm test` now runs `npm run check` first.** A parse error in `js/game.js`
used to pass the whole suite — the harnesses read the file as TEXT (regex and
source slices), so a `game.js` that could not load at all still scored every
assertion. That shipped once. Syntax check is the first thing the suite does.

**Syntax-check after every JS edit** — a parse error kills the game silently:

```bash
for f in js/*.js; do node --check $f || echo "FAIL $f"; done
```

```bash
npm test                  # syntax check + all twelve invariant harnesses
node tests/fairness.js    # or run one on its own
npm run check             # syntax-check every js file
```

The harnesses load the real game files into a `vm` context with stubbed browser
globals, so they exercise shipped code rather than a copy.

## Architecture

### Load order matters

`index.html` loads: CDN libs (three.js r128, qrcodejs, mqtt) → `js/items.js` →
`js/game.js` → `js/mode-quiz.js` → `js/mode-defend.js` → `js/specials.js` →
`js/scores.js` → `js/blades.js`. Everything is globals; the mode files depend on
`game.js`. `items.js` is first because it defines `FONT` and the roster.

### Files

| File | Contains |
|---|---|
| `js/items.js` | `FONT` constant, the 50-item `ITEMS` roster, all item `ART` drawing functions, canvas helpers (`rr`/`fillIt`/`outline`/`cjk`) |
| `js/game.js` | Engine, render loop, Sort mode, Versus, input (mouse/cam/phone), WebRTC+MQTT host, shared helpers |
| `js/mode-quiz.js` | Quiz only — `QUIZ` bank, `quizGenItems()`, `Q` state |
| `js/mode-defend.js` | "Bin It" only (still `GMODE==="tsunami"`) — `TS` state, bin art, spawner |
| `js/specials.js` | Sort power-ups (`PWR` timers). Bin It has its own `DSPEC` |
| `js/scores.js` | Local best + write-only Firestore `scores`, readable `players` (XP) |
| `js/blades.js` | Blade skins, XP curve, levels, picker UI, `bladeStroke` renderer |
| `css/styles.css` | Base layer, dark theme layer, then the V6 menu/screens layer |
| `img/props.png` | The V6 hero's decorative 3D props (external, cached) |
| `img/items/*.webp` | The 50 painted item renders, named `<ITEMS[].t>.webp` |
| `controller.html` | Fully self-contained phone page (own CSS+JS). Opened via QR |

### One `GMODE` drives everything

`"sort" | "quiz" | "tsunami" | "vs"`. `startChosen()` routes to the launcher;
`loop()` and `drawFx()` branch on it. Each mode owns a state object (`G`, `Q`,
`TS`, `VS`), a launcher, an update, a slice/hit check, a draw and a game-over.

**Bin It is a catch mode, not a slicing mode.** You move a bin along the bottom
and catch what belongs; there is no blade. It was rewritten from an earlier
steering design where slicing nudged items sideways — that failed because the
bin highlight ignored momentum (wrong 46% of the time), items coasted 1.13 bin
widths after you stopped pushing, and the push saturated so every phone swing
maxed out.

### Rendering

- **Three.js** orthographic camera, world units == pixels. Items are flat
  `PlaneGeometry` textured from 2D canvas drawings in `ART`, cached in `TEXCACHE`
  and sharing one `SPRITE_GEO`. Never create/dispose per frame.
- A second `#fx` **canvas 2D** overlay draws trails, quiz cards, the Bin It bin,
  pops and hearts.
- `#bg` is DOM/SVG (gradient + skyline), so it is restylable with CSS.

## Invariants — these were each a shipped bug, do not regress

**Every retired item must be RELEASED, not just unparented.** `makeSprite()`
allocates a `MeshBasicMaterial` per spawn — it has to, since each item fades
independently through `material.opacity` — and three.js holds GPU program state
for every material until `dispose()` is called. Nothing disposed them, so a few
hundred accumulated per game and kept accumulating across replays for the life
of the page. Use `releaseObj(o)` at **every** removal site; a bare
`scene.remove(o.mesh)` is the leak. `SPRITE_GEO` and the `TEXCACHE` textures are
shared and must NOT be disposed (`material.dispose()` does not touch its map, so
the cache stays valid). `tests/perf.js` fails on a bare removal.

**Resolution is budgeted by pixel COUNT, not a flat ratio.** Cost scales with
pixels, and the old flat `min(1.5, dpr)` made a large display pay 4.65MP a frame
against a laptop's 2.07MP for the same game. `dprFor(w,h)` caps total pixels at
`PIXBUDGET` (2.6MP): laptop windows are unchanged at 1.5, big stages scale back
(1750x1180 -> 1.12), and it never drops below 1.0 because text and the blade go
visibly soft there — a huge stage is allowed to exceed the budget rather than
look broken.

**Item labels cache their measured width, not their font.** `roundedText` runs
per item per frame; `measureText` is the expensive half and the label never
changes, so widths are cached by string. Caching the `font` assignment was tried
and is WRONG — quiz cards, score pops and bin labels all set `fxc.font` too, so
a "already set it" flag goes stale mid-frame and labels render in whichever font
drew last. Keep the font assignment unconditional.

**Canvas `arc()` throws on a negative radius.** Particle sizes are clamped
(`Math.max(0.1, …)`). Keep all radius math positive.

**A global error report must never borrow game UI.** `loopFail()` reports into
`#errBar`, a fixed banner outside `#app` with its **own** Reload and Dismiss
buttons. The first version wrote `el("ovlBtn").onclick = location.reload` — but
that button already had a click listener calling `startRound()`, and assigning
`onclick` does not replace a listener, it adds a second handler. So once a loop
fault had fired even once, pressing "Start round" both started the round and
reloaded the page: the game bounced to the main menu and could not be started at
all, in every mode. The error path made things worse than the fault it reported.
`tests/loop.js` section 4 asserts `loopFail` never touches `ovlBtn`.

**The render loop must not START until every script has loaded.** `js/game.js`
is script 2 of 7, but `drawFx()` calls `bladeDrawTrail()`, defined in
`js/blades.js` — script 7. Starting the loop at the bottom of `game.js` ran the
first frame while the browser was still fetching the remaining parser-blocking
scripts, and **rAF callbacks do fire in those gaps**. On a cold cache or a slow
connection the first frame threw `bladeDrawTrail is not defined`.

That one race caused every "the game is broken" report in this project: build 62
it killed the rAF chain outright (frozen board, no items, timer stuck full),
build 63 the error path then poisoned the round-start button (bounce to main
menu), build 66 it surfaced in `#errBar`. It NEVER reproduced on localhost —
all seven files arrive before the first frame is due. Reproduced deliberately by
serving `blades.js` with a 1.5s delay, which fails pre-fix and is clean after.

Boot is therefore deferred to `DOMContentLoaded`, which fires only once every
parser-inserted synchronous script has executed. `tests/loop.js` section 5
asserts the deferral, that `blades.js` still loads after `game.js`, and that
every `blade*` function `game.js` calls actually exists in `blades.js`.

**The render loop must never die, and a dead board must never be silent.**
`loop()` is a thin wrapper: it calls `loopBody()` in a `try`, reports the first
failure on the overlay via `loopFail()`, and reschedules in a `finally` so one
bad frame degrades instead of bricking the game. Two long diagnoses were spent
on frozen boards that said nothing — an exception in a rAF callback stops the
chain permanently and leaves only a console line nobody has open. **`loopBody`
must NOT call `requestAnimationFrame` itself** — a stray reschedule there
doubles the chain every frame until the tab dies. `tests/loop.js` guards both.

**`startRound()` is all-or-nothing.** It used to hide the round overlay FIRST
and set `G.running` LAST, so anything throwing in between (`specialsReset`,
`resize`, `clearObjs`) left the overlay gone and the game stopped: HUD up, timer
bar stuck full, zero items, no explanation. Arm the round first, dismiss the
overlay only once the throwing part has succeeded, and put the overlay back with
the reason on failure.

**Nothing may be DRAWN into the floating HUD — and EVERY mode did it.** The V6
HUD sits over the playfield: `.scoreBadge` y 18-92 top-left, `.roundBanner`
y 0-~50 centre (topic, question counter AND timer bar), `.pauseBtn` top-right.
Every mode painted into that band:

| mode | drew at | collided with |
|---|---|---|
| Sort | power chips `y=26` | score badge |
| Quiz | question `top:14px`, lives `y=26`, streak `y=56` | banner, badge |
| Bin It | lives `y=26`, combo/shield `y=56/80` | score badge |
| Versus | topic box `y=8`, P1/P2 `y=12` | round banner, badge/pause |

`--hudSafe` (CSS) and `HUDSAFE` (js/game.js) are the first clear y; canvas code
cannot read a CSS variable, so the two are mirrored by hand and `tests/menu.js`
section 9 asserts they agree. **`hudRow(i)` is the shared row helper** — use it
rather than inventing offsets, which is how four modes drifted independently.
Section 10 checks all of them.

**Versus hides the score badge, and `show()` owns that.** Versus keeps its two
scores on the canvas, one per half, so the DOM badge showed a permanent 0 beside
them. It is toggled in `show("play")` from `GMODE`, **not** in `launchVS` —
hiding it in one launcher leaves it hidden for every other mode afterwards.

Spent lives were `#e2e2e2`: near-white on a dark playfield, so an empty heart
read as a full one. They are `#4a3f33` now.

**A hardcoded light background plus `var(--ink)` is a contrast trap.** `#quizQ`
was an inline style with `background:rgba(255,255,255,.92)` and
`color:var(--ink)`. The V6 palette flipped `--ink` from `#1d1d1f` to `#fff7e8`,
so the question became near-white text on a near-white box — invisible. It is
now a themed dark panel with an explicit `#fbe9d0`. When re-theming, grep for
white backgrounds paired with themed text; `#camCap` had the same shape but was
already re-themed in the dark layer.

**Quiz answer cards size themselves to their lane, and wrap.** The card was a
fixed 148px in a lane of `(W-140)/n`, so below ~730px four answers overlapped and
their labels ran together. `quizLayout(n)` returns `{cols, rows, lw, cw}`: the
card shrinks to its lane, and below `QMINLANE` (104px) the answers wrap to two
rows because four cards cannot share one row on a phone at a tappable size.
Labels shrink then ellipsise to the card width. The harness runs the real
`quizLayout` across 12 widths x 4 answer counts and fails on any overlap or
overflow.

**Item artwork is a painted render with the canvas ART as its FALLBACK.** The 50
roster items load from `img/items/<t>.webp`, named by the same key as `ITEMS[].t`
so there is no manifest to drift from. `ART` in `items.js` is NOT dead code — a
404, a decode failure or a browser without WebP falls back to it and the game
stays playable. `PHOTO` membership is derived from `ITEMS`, so the power-ups in
`specials.js` (which also reach `makeSprite`) keep their drawings instead of
404ing. `preloadItemArt()` warms all 50 at boot: **zero network requests during a
round**, verified. Quiz cards draw item art too, on the 2D overlay — they read
the already-decoded image via `itemPhoto()` rather than loading a second copy.

Renders are 300x220, so `PHOTO_GEO` is a second shared geometry at 112x82 — the
aspect CONTAINED in the old 112 square. Art may get shorter, never wider, so the
hit radius stays at least as generous as the sprite.

**Item launch height needs a CEILING as well as a floor.** Build 63 added the
floor (`Math.max(base, H*0.62)`) so tall screens stopped hiding items in the
skyline, and in doing so dropped the old `Math.min(H, base)`. That cap was load
bearing: on a landscape phone (~320px of stage) the 380px floor put the apex at
**y=-4, above the top edge** — invisible and unslicable. `riseFor` now clamps to
`H+55-70` as well. The harness only tested H>=600, which is why it took a live
short-stage screenshot to catch; it now tests 300/321/360/440 too.

**Item launch height scales with the stage, it is not a constant.** `spawn()`
fires from `y=H+55`, so the old flat `Math.min(H, DIFF.h)` (380px) meant that on
a tall screen items rose 380px from BELOW the bottom edge and never reached the
playfield — measured on a 1180px stage they peaked at 73% down, among the
skyline, reading as "no items are coming out". `riseFor(base)` returns
`Math.max(base, H*0.62)`: the tuned preset stays the FLOOR so short screens are
unchanged, and tall ones get a real arc. Both Sort and Versus use it; Bin It and
Quiz have their own spawners and are untouched.

**Screens must scroll and centre with `margin:auto`, never
`justify-content:center`.** A centred flex child that overflows has its top
clipped and unreachable — that made the result screen's "Play again" impossible
to reach on a phone. Any new screen must be added to **both** selectors in
`css/styles.css` (the `#start,#result,#connect,#controller,#blades` pair).

**Segmented controls delegate from the container, not per button.** Listeners on
the buttons left 33% of the mode selector's pixels dead (5px bands above/below,
rounded ends), so mode clicks were intermittently ignored. See `segDelegate()`.

**Bin It's catch mouth is exactly the bin's drawn width.** An earlier version
caught within `binW + itemR` — 195px against a 150px drawing — so items that
visibly missed still counted. `DCFG.binW` must stay 150; the reachability
guarantee in `dSpawn()` is sized from it.

**Bin It fairness is generative, not rejective.** Correct items are placed
*inside* the window the bin can reach from the previous one, calibrated to the
slowest control (webcam ≈ one screen crossing/sec). Spacing items apart was
tried and is *worse* — it makes them less reachable.

**Quiz answers arm only after every card lands, plus a beat, and require a real
swipe** (80px of travel in 130ms, measured from `BLADE.trail`). Before this, a
stationary hand selected an answer, because with `x1,y1 == x2,y2` the hit test
collapses to plain distance. Cards are drawn dimmed until armed — without that
the gate is invisible.

**The webcam has a 200ms grace window** (`CAMGRACE`). Dropping the blade on a
single missed detection made it flash and made fast swipes silently fail to cut.
`stopCam` must clear the interval.

**The MQTT relay is a fallback, not the control path.** Measured against
`broker.emqx.io`, publishing blade positions every frame:

| rate | delivered | median latency |
|---|---|---|
| 60 Hz | 19.5% | 207 ms |
| 30 Hz | 37.4% | 210 ms |
| 20 Hz | 55.4% | 215 ms |
| 10 Hz | 98.0% | 220 ms |

The broker caps near **11 messages/second** whatever you send, so the old 60 Hz
publish bought nothing and discarded 80% of the player's input as random
stutter. `RELAYMS` (90ms) holds the relay just under the cap; `DCMS` (16ms)
keeps the WebRTC data channel at full rate. The ~195ms floor is the round trip
to a distant public broker and CANNOT be tuned away — switching broker does not
help (emqx 206ms, hivemq 190, mosquitto 200, emqx-cn 188). The only cure is the
direct link.

**Phone input is dead-reckoned, and the lead is per-transport.** Holding the
last packet made an 11Hz relay feed *look* like 11Hz — the blade froze for 90ms
then jumped, which reads as lag on top of the transport delay. `remoteSample`
estimates velocity, `remotePos` carries the blade along it every frame, and
`RCFG.lead` additionally aims ahead to cover the transport — **only for relay
samples**. On the direct link the lead is 0 and tracking stays exact (0.00%);
applying it there costs 5.2% error for nothing. Do not add smoothing back — it
lagged behind its own prediction and made every metric worse.

`lead` is **120ms**, not the 180 first shipped. 180 minimised felt lag (115ms vs
155ms) but overshoots more on direction changes, and in a slicing game an
overshoot cuts the wrong item — being late is cheaper than being wrong. `cap`
220, `maxJump` 0.20, `vlp` 0.45, `vmax` 1.6 px/ms all bound how far a bad
velocity estimate can throw the blade.

**Phone packets are sequenced, and a transport switch resets velocity.** The
WebRTC data channel is `ordered:false, maxRetransmits:0` — deliberately, for
latency — so packets genuinely arrive out of order, and an older sample landing
after a newer one dragged the blade backwards. Every packet carries a monotonic
`seq`; `remoteSample` drops anything not newer and returns false. Separately, a
direct/relay transition changes both cadence AND latency, so the old path's
velocity is zeroed rather than carried across — otherwise the first packet from
the new path could reverse the blade.

**A resting phone must stop slicing.** `remotePos` returns null past
`RCFG.stale` (350ms) and the loop clears `BLADE.active`, so a phone put down no
longer keeps cutting whatever it sits on. Mouse idles out after 90ms and webcam
after `CAMGRACE`; the phone had no timeout at all until now. The `#phoneState`
HUD chip shows `DIRECT` / `RELAY / delayed` / `INPUT LOST` — the fastest way to
tell a network problem from a sensor problem without a console.

**There is no TURN server, deliberately.** `openrelay.metered.ca` was in
`HICE`/`CICE` for years and is dead: gathering with `iceTransportPolicy:"relay"`
returns zero candidates and ICE error 701. So the direct link only forms when
STUN can find a path — **same WiFi**. A phone on mobile data behind carrier NAT,
or school WiFi with client isolation, falls back to the relay and there is
nothing in the code that can fix that. The controller now says which path it is
on; if it does not say DIRECT, the lag is the network, not the sensor — and the
`#phoneState` chip now says the same thing on the laptop screen.

**The phone controller must not use the accelerometer.** It measures force, not
position; integrating it drifts and turns end-of-swing deceleration into reverse
motion. Both Aim and Slash use orientation.

**Both phone modes steer from the same `pointing()` vector, built from
`alpha`+`beta`.** Tilt against gravity (`beta`/`gamma`) is blind to yaw, and an
arm sweep is almost pure yaw. Build 43 fixed this for Slash and left Aim on the
old `beta`/`gamma` path *while Aim was the default* — so out of the box the
controller could not see the motion the QR screen instructs. Measured in that
grip ("sideways like a knife handle"), an 80 degree sweep held `gamma` constant
at -90 and moved old-Aim's x by **0%**, while `alpha` carried the whole 80
degrees. Left/right was pinned dead centre; up/down still worked, which is why
it read as "the game can hardly sense my phone" rather than as fully broken.
Aim and Slash now differ ONLY in whether the blade snaps to the target or
springs to it. `tests/controller.js` guards this. Roll is deliberately dropped
(spinning the knife, not aiming), so twisting the wrist no longer steers.

**Yaw maps straight through — do NOT negate it.** Controller build 47 added
`applyAxis(-wrapDeg(...))` on the theory that device yaw runs opposite to screen
x. On real hardware that inverted the controls: swing right, blade goes left.
Build 48 removed it. The tell was in build 47's own test, which asserted a -40°
("left") swing landed at `x=0.8` — the RIGHT half — while its description said
"left swing moves the blade left". The sign was reasoned, not measured.

Changing this base mapping invalidates any Flip ←→ a player already saved, which
would double-flip them straight back to broken, so `ss3d.axisFix` clears the
stored `fx` override exactly once per change (now `left-right-v3`). **Bump that
sentinel whenever the base horizontal mapping changes.** The sign is verified
against one phone plus the harness; the Flip buttons remain the escape hatch for
devices that differ.

**A mode must not offer a control it cannot use.** Versus drives TWO blades
(`BLADE`/`BLADE2`) from two webcam hands or two phones; a mouse gives one
cursor. The picker offered Mouse anyway, and `launchVS()` routed
`else setupCamVS()` — so **Mouse + Versus silently started the camera**, and
denying access alerted "Versus needs a webcam" and bounced the player back to
the menu. They chose a mouse and got a camera prompt.

`controlsFor(mode)` is the single source of truth; `syncControls()` hides
disallowed tiles and **moves `controlMode` off an invalid choice**. That second
half is the real fix — hiding the tile while `controlMode` stayed `"mouse"` is
the silent-camera bug, and `setupCam()`'s failure path can set `"mouse"` on its
own during an earlier round. `launchVS()` now routes explicitly and refuses an
unsupported mode instead of guessing.

**The menu tiles are a VIEW of `GMODE`/`DIFF`, not a record of the last click.**
`segDelegate()` only paints on a click, but the launchers assign `GMODE` in code
(`launchGame()` -> "sort", `launchQuiz()` -> "quiz", `launchVS()` -> "vs"). So
after a round the menu showed **Sort highlighted while the header read "Versus
selected"**. `paintSegs()` renders both segmented groups from state and
`show("start")` re-syncs. `aria-pressed` moves with the `.on` class in
`segDelegate` for the same reason — the V6 tiles carry it and it was stuck at
its initial value, telling a screen reader the opposite of what was drawn.

**The ported design's CSS must not ship as written.** The Codex mockup used
`color-mix()` **37 times** and `light-dark()`; both are the same risk class as
the `oklch()` this file already bans — a silent colour failure on a school
machine. Every one is resolved to a literal `rgba()`/hex. Its lucide CDN icons
are an inline `<symbol>` sprite instead (a blocked unpkg leaves empty boxes),
and its 1.26MB inline base64 PNG is an external `img/props.png` at 317KB.
`tests/menu.js` section 8 fails on any of them coming back.

**The app fills the viewport; width limits live on the CONTENT.** `#app` had a
1100px cap (plus a `:has()`-scoped copy for the menu and blades screens, which
is why the first attempt to remove it appeared not to work — computed
`max-width` stayed 1100 with only one rule edited). Both are gone: `.card` caps
itself at 600px and `.menuWrap.v6` at 1600px, so text never stretches while the
play stage gets the whole screen.

Checked before removing it, because Bin It's fairness is calibrated to "webcam
≈ one screen crossing per second". `dVmax()` returns `W/1000`, so the reachable
window scales with the stage — the harness reports **FORCED STRIKES: 0 at 1280,
1920, 2560 and 3440 wide**. `PIXBUDGET` still bounds the cost: a 1920 viewport
gives dpr 1.15 and exactly 2.60MP.

**Blades are chosen on the `#blades` screen only.** A second picker on the menu
was built and removed at the user's request — one roster, one place to change
it, no chance of the two disagreeing. The menu's selection line still *names*
the equipped blade, which is a summary, not a picker.

**`.menuWrap.v6` must set `display:block`.** The pre-V6 `.menuWrap` is a
two-column flex row; without the override the V6 sections became flex items side
by side and each collapsed to ~300px. The 900px breakpoint also caps
`.menuWrap` at 600px, which the V6 rule has to raise.

**Blades are cosmetic only.** The harness enforces this with a banned-field list
*and* an allowlist. Scores go to a database the teacher reads; if a blade changed
scoring, a high-level student would out-score a beginner with equal knowledge.

**`FONT` lives in one place.** It was hardcoded 24 times in canvas font strings;
changing the webfont alone left canvas text on a system fallback while the DOM
used the new face.

**Bin colours (`QBINS`) and the HK roster carry the teaching.** Bins follow the
EPD GREEN@COMMUNITY list — cartons, clean plastic bags and foam **are** accepted,
so they live in paper/plastic, not trash. Item names are bilingual `中文 English`.
`items.js` has a `checkItems()` guard: a missing `ART` entry silently renders a
grey square, and a duplicate `t` silently shadows an item.

## Test harnesses

Node scripts that load the real files via `vm` with stubbed browser globals.
Run with `node <file>`; each exits non-zero on failure.

| Harness | Guards |
|---|---|
| `fairness.js` | Bin It: 40 runs × 90s, expect `FORCED STRIKES: 0` |
| `behaviour.js` | Bin It: strike accounting, drain at target switch, clamping |
| `quiz.js` | Quiz: resting hand selects nothing, swipes do, nothing while flying |
| `webcam.js` | Blade flicker under simulated detection loss |
| `xp.js` | XP curve, unlock pacing, and the cosmetic-only guarantee |
| `controller.js` | Phone: a real arm swing moves the blade, in both modes |
| `signalling.js` | Phone: no ICE candidate is lost; the relay is not flooded |
| `latency.js` | Phone: dead reckoning cuts felt lag and never overshoots off-screen |
| `loop.js` | Spawn height scales; no silent freeze; errors never touch game UI |
| `perf.js` | Materials are released, resolution is budgeted, labels are cached |
| `menu.js` | Versus never offers Mouse; the V6 re-skin keeps every hook |
| `itemart.js` | Renders cover the roster exactly, and ART is still the fallback |

They are the only automated protection for the invariants above. Run `npm test`
before pushing.

When a harness fails, suspect the harness first: several "failures" during
development were the test teleporting the blade, asserting on `Q.locked` (which
a timeout also sets), or using swipe paths longer than the gap between cards.

## Conventions

- Vanilla ES5-ish (`var`, `function`). No transpiler.
- **Bump the build number** in the start-screen note in `index.html` on any
  meaningful change, and verify it on a live URL before trusting a deploy.
- Theme colours are CSS variables. The variable named `--amber` is now the rust
  accent `#e2703a` — the name is the brand-accent slot, not the colour.
- `css/styles.css` has **two** `:root` blocks (base + theme). The theme layer
  redefines both sets, so unstyled rules do not fall back to light values.
- Colours are hex, not `oklch()` — this runs on school machines where a silent
  colour failure would go unnoticed.
- `controller.html` carries its own standalone copy of the theme. Palette
  changes must be made in both places.
- Accessibility already applied: real `<button>`s with `aria-pressed`,
  `:focus-visible`, `aria-live` status, `tabular-nums`, `theme-color`,
  `prefers-reduced-motion`. Preserve these.
- Only one tool should edit these files at a time — parallel edits have
  silently reverted work before.

## Known stale docs

- `README.md` still lists plastic bags, foam and drink cartons as wishcycling
  traps. The game was corrected to the EPD list and now contradicts it.
- `FIREBASE-SETUP.md` includes the `players` rules block; that block must be
  published in the console before cross-device XP works. Until then reads fail
  and the game silently falls back to local progress.

## Open threads

- **Blade abilities — decided against, 2026-07-31.** Blades stay cosmetic.
  Powers were built (practice-only, unranked runs) and then reverted at the
  user's request: keeping the fairness guarantee simple and absolute beat having
  the feature. Do not re-open without a new reason.
- `controller.html` carries its own build number (now **49**), separate from the
  game's. Phones cache it hard — check that number on the phone before believing
  a controller fix shipped.
- Unverified on real hardware: the build 60 controller fix on an actual phone,
  the dark theme on that page, and a webcam pass confirming the cursor reads
  against the dark playfield.
- **Branch topology is a trap.** `main` is an ORPHAN root commit with **no
  common ancestor** with `master`, and `agent/phone-controller-stability` points
  at that same commit — so "merge the agent branch into main" is a no-op. Vercel
  deploys **`master`** (`origin/HEAD -> master`), which carries the real 90+
  commit history. Work from those branches must be brought over as a content
  copy (`git checkout origin/main -- <files>`), never an unrelated-history
  merge. Build 66 did exactly that for the phone-stability work, controller 47
  for the horizontal-direction fix. **Copy only the files that branch actually
  changed** — it trails master on `CLAUDE.md` and `index.html`, so taking those
  wholesale silently reverts master's docs and build number.

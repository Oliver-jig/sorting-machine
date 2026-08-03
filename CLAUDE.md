# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page browser arcade game for **SDG 12** — a Fruit-Ninja-style slicer
teaching Hong Kong recycling. No build step, no framework, no bundler. Plain
HTML + CSS + ES5-ish JS with CDN libraries, deployed static to Vercel.

Current state: **build 63**. Dark "dojo-arcade" theme, 50 items, four modes,
blade skins with an XP/level system.

Repo: `Oliver-jig/sorting-machine`. Two branches, **kept in sync after every
change**: work on `claude`, then merge into `master` and push both.

## Commands

```bash
npm start                 # python3 -m http.server 8137 — then open localhost:8137
```

Serve it; do not open `index.html` from disk. Camera and device-motion APIs
need a served origin, and the phone controller needs https (i.e. a deploy).

**Syntax-check after every JS edit** — a parse error kills the game silently:

```bash
for f in js/*.js; do node --check $f || echo "FAIL $f"; done
```

```bash
npm test                  # all nine invariant harnesses
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
| `css/styles.css` | Base layer, then a dark theme layer that overrides it |
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

**Canvas `arc()` throws on a negative radius.** Particle sizes are clamped
(`Math.max(0.1, …)`). Keep all radius math positive.

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
`RCFG.lead` (180ms) additionally aims ahead to cover the transport — **only for
relay samples**. Measured by `tests/latency.js`: felt lag on the relay
**230ms -> 115ms**, tracking error 25.7% -> 18.2% of the screen. On the direct
link the lead is 0 and tracking stays exact (0.00%); applying it there costs
5.2% error for nothing. Do not add smoothing back — it lagged behind its own
prediction and made every metric worse.

**There is no TURN server, deliberately.** `openrelay.metered.ca` was in
`HICE`/`CICE` for years and is dead: gathering with `iceTransportPolicy:"relay"`
returns zero candidates and ICE error 701. So the direct link only forms when
STUN can find a path — **same WiFi**. A phone on mobile data behind carrier NAT,
or school WiFi with client isolation, falls back to the relay and there is
nothing in the code that can fix that. The controller now says which path it is
on; if it does not say DIRECT, the lag is the network, not the sensor.

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
| `loop.js` | Spawn height scales with the screen; no silent freeze can return |

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
- `controller.html` carries its own build number (now **44**), separate from the
  game's. Phones cache it hard — check that number on the phone before believing
  a controller fix shipped.
- Unverified on real hardware: the build 60 controller fix on an actual phone,
  the dark theme on that page, and a webcam pass confirming the cursor reads
  against the dark playfield.
- Known, not fixed (spotted while fixing the controller, each its own change):
  - `applyRemote()` sets `BLADE.active=true` and nothing ever clears it. Mouse
    idles out after 90ms and webcam after `CAMGRACE`; the phone has no timeout,
    so a resting phone keeps slicing whatever it sits on.
  - `applyRemote()` still has no idle timeout (see above); unchanged.

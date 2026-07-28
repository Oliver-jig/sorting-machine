# CLAUDE.md — working notes for Slice & Sort 3D

Context for anyone (including Claude Code) picking up this project. Read this
before editing.

## What this is

A single-page browser arcade game for **SDG 12 (Responsible Consumption &
Production)** — a Fruit-Ninja-style slicer about Hong Kong recycling. No build
step, no framework, no backend. It's plain HTML + CSS + JavaScript with a few
CDN libraries. Deployed as a static site (Vercel).

Current state: **build 34** (SDG 12 amber theme, code split into `css/` + `js/`,
phone controller reworked to landscape "slash" control, Quiz rebuilt and Defend
replaced by the "Bin It" sorting mode, pause available in every mode,
Fruit-Ninja-style special items in Sort, score saving + CSV export).
The build number is stamped in the start-screen note — see "Build stamping".

## File map

```
index.html        Page structure only. Five <section> "screens": start,
                  connect, controller, play, result. Loads css/styles.css,
                  then CDN libs (three.js r128, qrcodejs, mqtt), then js/game.js.
                  One small inline <script> sets the start-screen note.
controller.html   Separate, fully self-contained page opened on the PHONE via
                  the QR code. Its own CSS + JS inline. Gyroscope controller.
css/styles.css    All styling. Two layers: (1) base structural/layout CSS,
                  (2) the SDG 12 amber theme that overrides it. Separated by a
                  "/* ===== theme layer ===== */" comment.
js/game.js        Engine + Sort + Versus + shared helpers (~700 lines). Loads FIRST;
                  the two mode files below depend on its globals.
js/mode-quiz.js   Quiz only: QUIZ data, Q state, launch/next/update/slice/draw.
js/mode-defend.js "Bin It" sorting mode only: DBINS/DCFG/WAVES, TS state, bin
                  geometry (binRects/binAt) and the steering slice.
js/specials.js    Sort power-ups (Bin It has its own DSPEC in mode-defend.js): SPECIALS/SPCFG data, PWR effect timers,
                  spawn/slice/update/draw, and their ART entries.
js/scores.js      Local score history (localStorage): personal best, this-computer
                  top 10, and CSV export for Excel. No database, no network.
package.json      npm start = python http.server on :8137.
vercel.json       Static config (cleanUrls).
README.md         Player- and deployer-facing docs.
LICENSE           MIT.
```

Note: CSS and JS were factored OUT of `index.html`. Do not re-inline them.

## How to run / test

- Serve it (webcam + phone modes need https or localhost):
  `npm start` then open `http://localhost:8137`. Do NOT just double-click the
  file — camera/motion APIs need a served origin.
- Deploy: drag folder to Vercel, or `vercel`. Deploy gives the https link the
  phone controller requires.
- **Syntax check after every JS edit** (the game silently dies on a parse error):
  `node --check js/game.js && node --check js/mode-quiz.js && node --check js/mode-defend.js`
- There is no test suite. Verify by playing each mode in a browser. The webcam,
  3D, and phone parts can't be checked headlessly.

## Architecture of js/game.js

### Rendering
- **Three.js (r128)** with an OrthographicCamera where world units == pixels.
  Items are NOT 3D models — each is a flat `PlaneGeometry` textured with a 2D
  canvas drawing, always facing the camera (`makeSprite` / `makeMesh`).
- Per-item drawings live in the `ART` object (one function per item type).
  Textures are cached in `TEXCACHE` via `getTex`, and all sprites share one
  `SPRITE_GEO` — this matters for performance; don't create/dispose per frame.
- A second `#fx` **canvas 2D** overlay draws particles, blade trails, quiz
  cards, versus split UI, hearts, etc. `drawFx()` branches by mode.
- `loop()` is the single requestAnimationFrame loop. It branches on `GMODE`.

### Data tables (top of file — edit these to change content)
- `ITEMS` — the 27 sliceable objects: `{t, name, bin, ...}`. `bin` is one of
  paper/plastic/metal/glass/trash/hazard.
- `ROUNDS` — Sort-mode topics (Paper, Plastic, Metal & Glass, Spot the traps),
  each with the `bins` that count and a display `color`. Also reused as the
  rotating target topics in Versus.
- `QUIZ` — quiz questions (type item/bin/text). `qpick`/`shuffle`/`Qseq` give
  no-repeat ordering.
- `DIFFS` — `relaxed` and `normal` speed presets (gravity, spawn timing, etc.).
- `FACTS` — end-screen facts. `BINCOL` — bin colors.

### Modes — one `GMODE` string drives everything
`GMODE` is `"sort" | "quiz" | "tsunami" | "vs"`, chosen by `#modeSeg` buttons.
`startChosen()` routes to the right launcher. Each mode has its own state object,
launcher, update, slice-check, game-over, and draw:

- **Sort** — `G` state; `launchGame` / `startRound` / `endRound` / `spawn` /
  `updatePhysics` / `sliceAlong`. Four rounds by `ROUNDS`.
- **Quiz** (`js/mode-quiz.js`) — `Q` state (+ `Qseq`, `QCFG`). 12 questions or 3
  lives. Answers rise then HOVER (they no longer fall back and get re-thrown).
  The per-question clock only starts once every card has settled, and `quizTeach`
  shows the `why` after every answer — that immediate explanation is the whole
  point of the mode, so don't move it back to the result screen.
- **Bin It** (`js/mode-defend.js`, still `GMODE==="tsunami"`) — `TS` state.
  Every item has one correct bin. A slice does NOT destroy: `tsunamiSlice` adds
  sideways velocity so you steer items. Bins tile the FULL width via `binRects()`
  so nothing can land in a gap. Right bin scores x combo; wrong bin costs a life.
- **Versus** — `VS` state; `setupCamVS` (MediaPipe maxNumHands:2, left/right by
  x), `launchVS` / `vsSpawn` / `vsSliceFor` / `vsUpdate` / `vsGameOver` /
  `vsDraw` / `drawTrail`. Split screen, 60s, `BLADE` (left/P1) + `BLADE2`
  (right/P2). Follows a **rotating target topic** from `ROUNDS` (`VS.topicIdx`,
  rotates every 15s); +1 slicing a match, −1 otherwise.

### Blades / input
- `BLADE` (and `BLADE2` for Versus) hold blade position + a `trail` array.
- Three control modes chosen on the start screen (`controlMode`):
  - `mouse` — `setupMouse` (also touch via `touchPos`).
  - `cam` — `setupCam` (MediaPipe Hands; landmark 8 = index tip).
  - `remote` — phone controller (see below).

### Phone controller (the fiddly part)
- Laptop is the HOST: `hostStartConnect` → `connectHostMqtt` → shows QR
  (`drawQR`) with a 4-digit room code. Signaling over MQTT
  (`broker.emqx.io:8084` wss), then a WebRTC data channel for low latency, with
  MQTT relay as fallback. `applyRemote(g,b)` maps incoming orientation to the
  blade.
- The PHONE runs `controller.html` (separate file). It reads DeviceOrientation and
  uses **relative "slash" control**: per-frame angle *deltas* feed a velocity that is
  integrated, damped (`FRICTION`) and pulled back to centre (`RECENTER`), so the blade
  moves by how fast you swing rather than by the angle you hold. Layout goes two-column
  in landscape and nags you to rotate if you're portrait while playing.
  Tuning gotcha: the damped integrator multiplies `GAIN` by `1/(1-FRICTION)` (~5.5x) —
  `GAIN` is deliberately tiny (0.0025); raising it makes the blade hair-trigger.
  The MQTT/WebRTC wire format is unchanged (`{g,b}`, g:-30..30, b:15..70).
- Requires https (deploy) — won't work from a local file.

## Known gotchas (do not regress these)

- **Canvas `arc()` throws on negative radius** and kills the whole rAF loop.
  This caused the infamous "game freezes after cutting one object" bug. Particle
  sizes are clamped: `var pr = Math.max(0.1, pt.sz*pt.life)`, and dead particles
  are removed BEFORE drawing. Keep any new canvas `arc`/radius math non-negative.
- Don't call `material.dispose()` per cut (GPU stall) — reuse cached textures.
- Don't call `getComputedStyle` per frame (style thrashing).
- Spawns can burst up to 3 items at once but they must be lane-separated (no
  center pull) — see `spawn`.
- MediaPipe / three / mqtt / qrcode load from CDN; `js/game.js` must run AFTER
  those `<script src>` tags (it already does).

## Conventions

- **Single editor.** Earlier, a second tool was editing these files in parallel
  and silently reverting work. Make sure only one thing edits at a time.
- **Build stamping.** Bump the build number in the start-screen note (search
  `build 21` in `index.html`) on any meaningful change, so you can confirm the
  deployed version is the new one. When checking a live URL, verify the build
  number matches before trusting it.
- Vanilla ES5-ish JS (`var`, `function`) to match the existing style. No
  transpiler.
- Colors/theme are CSS variables in `css/styles.css` (`--amber #bf8b2e` is the
  SDG 12 accent). Keep the SDG 12 palette.
- Accessibility already applied: mode selectors are real `<button>`s with
  `aria-pressed`, there's a `:focus-visible` ring, `aria-live` on status,
  `tabular-nums` on the HUD, `theme-color` meta, `prefers-reduced-motion`
  fallback. Preserve these.

## Likely next tasks

- Play-test all four modes in a browser after the css/js split (only syntax was
  verified programmatically).
- Optional: split `controller.html` similarly, or carry the amber theme into the
  in-game overlays / result screen artwork.
- Push to GitHub (repo name suggested: `slice-sort-3d`).

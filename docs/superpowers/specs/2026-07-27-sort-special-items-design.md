# Sort mode — special items (Fruit-Ninja-style power-ups)

Date: 2026-07-27
Status: implemented in build 24

## Goal

Sort mode was mechanically flat: slice correct items for +15, wrong ones for
−12, with no combo, no lives and no power-ups. Add Fruit-Ninja-style specials
so the mode has moments of tension and reward, without diluting the SDG 12
teaching.

## Roster

Five specials, chosen so each changes play in a different way.

| Item | `sp` | Effect | Duration |
|---|---|---|---|
| ❄ Freeze | `freeze` | Items stop moving; spawning pauses | 3s |
| ♻ Double | `dbl` | Correct slices score 30 instead of 15 | 8s |
| 🧲 Magnet | `magnet` | Round-correct items curve toward the blade | 4s |
| ⏱ Clock | `clock` | +5s on the round timer | instant |
| ⚠ Battery | `battery` | −40 points, red flash, screen shake | instant |

Decisions worth recording:

- **The round clock keeps running during a freeze.** Freeze is therefore a
  guaranteed-points window bought with time, which is a real trade and keeps
  the Clock power-up distinct.
- **Double multiplies rewards only.** A wrong slice stays −12; being punished
  twice for one mistake reads as unfair.
- **The battery costs points, never the run.** A one-slip wipeout is wrong for
  a learning audience.
- **The battery never spawns in round 4.** Round 4 ("Spot the traps") teaches
  "slice the things that can't be recycled", and a battery genuinely can't be.
  Spawning it there would punish a player for reasoning correctly. Excluded via
  a check on `ROUNDS[G.round].bins` containing `trash`.
- **Magnet pulls only round-correct items**, so it rewards knowing the answer
  rather than replacing that knowledge.

## Architecture

A special is shaped exactly like an `ITEMS` entry (`{n, t, col}`) plus an `sp`
tag, so `makeSprite`, `getTex` and the name label work on it unchanged. All
state lives in `PWR = {freeze, dbl, magnet}`, holding milliseconds remaining,
reset by `specialsReset()` from `startRound`.

`js/specials.js` holds the data, effects, drawing and its own `ART` entries
(registered by assignment, e.g. `ART.spFreeze = function(c){...}`). It loads
last, after `js/game.js`. Every reference from `game.js` sits inside a function
body, so nothing resolves at load time.

Interface: `maybeSpawnSpecial()`, `specialSlice(o)`, `specialPull(o,dt)`,
`specialUpdate(dt)`, `specialMult()`, `specialDraw(now)`, `specialsReset()`.

Five hook points in `game.js`, all small:

1. `startRound` → `specialsReset()`
2. loop spawn block → `maybeSpawnSpecial()` replaces a *single* spawn (never a
   burst), and the whole block is skipped while frozen
3. `updatePhysics` → frozen items hold position; `specialPull` applies magnet
4. `sliceAlong` → `o.it.sp` routes to `specialSlice`; `specialMult()` scales
   the reward
5. `drawFx` → `specialDraw(now)` for the Sort branch

The `+5s` clock can push remaining time above a full bar, so the `timeFill`
width is clamped to 100%.

## Rarity

10% of single-item spawns, with a 4s minimum gap, a 5s lead-in at round start,
and none during a freeze. A relaxed round is ~30 spawns, giving roughly 3
specials per round and 12 per game. Weights: battery 28, freeze 20, double 20,
magnet 16, clock 16, with the battery's share redistributing in round 4.

## Readability

Specials get a pulsing halo drawn on the fx overlay — gold for positives, red
plus a wider outer ring for the battery, whose artwork also carries hazard
stripes. Active effects render as chips top-left ("FREEZE 2.1s", "×2 6.3s").

The battery hit adds a `.shake` class to `#stage` driven by a CSS keyframe,
disabled under `prefers-reduced-motion`.

## Magnet tuning (simulated)

The first values were wrong in two ways, both found by simulation rather than
play:

1. `magPull` of 0.00055 lost to gravity (0.00085), so items kept falling away.
   Only items already within ~150px were ever caught — the power-up would have
   been invisible.
2. Attraction without drag conserves energy, so items slingshot past the blade
   and orbit it. Stronger pull made this worse, producing near-misses at 77–95px
   that never resolved.

`magDamp` (per-frame drag on pulled items) fixes the orbiting. Final values:
`magPull 0.0020`, `magMax 0.7`, `magDamp 0.94`. Simulated arrival times: 700px
away → 2.2s, 400px → 1.2s, 150px → 0.3s, all inside the 4s duration.

## Not verified

The 10% spawn rate is a reasoned estimate, not a measured one, and the overall
feel of five specials in rotation has not been play-tested. Neither has the
artwork been seen rendered — the canvas drawings are written blind. All of this
needs one real playthrough.

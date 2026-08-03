# Bin It redesign — from slicing to catching

Date: 2026-07-29
Status: approved, ready for implementation planning
Supersedes: the Bin It section of `2026-07-29-item-roster-expansion-design.md`

## Problem

Bin It is unplayable. The mode asks the player to slice falling items sideways
to steer each one into its matching bin. Three measured faults compound:

- **The only feedback is wrong 46% of the time.** `tsunamiDraw` highlights
  `binAt(o.x)` — the bin an item is *currently over* — ignoring sideways
  momentum. Once an item moves, that highlight is wrong 46% of the time and can
  be off by two bins.
- **There is a large invisible coast.** `vxDrag` bleeds sideways speed
  gradually, so an item at full tilt drifts a further **283px — 1.13 bin
  widths — after the player stops pushing**. Landing anything requires
  anticipating more than a full bin of drift with nothing on screen to indicate
  it.
- **Steering saturates almost immediately.** `vxCap` is reached at 80px/frame
  of blade travel. After the build 43 controller fix a phone swing crosses the
  screen in ~134ms (~160px/frame), so every phone swing saturates and the
  control is effectively binary.

Throughput was investigated and **ruled out**: only ~3 items are ever in flight
and 1.5 steers/second survives indefinitely. The mode is unpredictable, not
overloaded — which is why tuning passes never fixed it.

Observed directly during build 44 testing: **a round ended in about 3 seconds
with no input at all.** Three unsteered items landed in wrong bins and consumed
all three lives.

## The change

Replace steering with **catching**. The player moves a bin along the bottom of
the screen and intercepts falling items. There is no momentum to predict and no
indirection — the bin is where the player puts it, and an item either lands in
it or does not. The failure mode is removed by construction rather than by
tuning.

## Goals

- A player understands the mode from one sentence and can survive the first
  wave on a first attempt.
- No strike is ever unavoidable. This is a hard guarantee, not a tuning target.
- Late difficulty comes from recycling knowledge, using the trap items added in
  the roster expansion.
- Works on all three existing control schemes without per-scheme redesign.

## Non-goals

- Changing Sort, Quiz or Versus.
- Changing the item roster. It is already at 50 items, 10 per bin.
- A sixth bin, or new item artwork.

## Core loop

A single bin sits at the bottom of the screen. It shows a **target type** —
Paper, Plastic, Metal, Glass or General.

Items of all types fall. The player:

- **catches** items matching the current target → score
- **lets everything else fall past** → safe, and the correct play

The target type **rotates on a timer** (15–20s) with a countdown bar and a
visible warning shortly before it switches.

### Strikes

Three strikes end the run immediately. A strike is either:

1. a correct-type item reaching the bottom uncaught, or
2. a wrong-type item landing in the bin.

Both count. This is deliberate: it makes the bin's position matter in both
directions, so the player is dodging as actively as they are chasing.

### Scoring

Base points per correct catch, multiplied by a combo that builds on consecutive
catches and resets on a strike. This matches how Sort and Quiz already score,
so the results screen and personal-best handling need no special cases.

## Controls

Bin position maps **directly** from the existing input for each scheme:

| scheme | input |
|---|---|
| webcam | hand x-position |
| phone | tilt (the existing Aim mapping) |
| mouse / touch | pointer x-position |

No slicing gesture is used in this mode. Players already familiar with the
other modes' controls do not have to learn anything new.

The blade is not drawn in Bin It.

## Spawner and the fairness guarantee

This is the part most likely to be got wrong, so the rule is derived rather
than guessed.

### A rejected approach, and why

The obvious rule — "keep items spaced apart so they cannot conflict" — is
**counterproductive**. Modelled across seven spawn rates, a 500ms/292px spacing
rule produced *more* forced strikes than no rule at all at every rate.

The reason: the binding constraint is not items colliding, it is that **the bin
can only be in one place**. Two correct items landing at nearly the same moment
are impossible to satisfy however they are spaced — and spacing them further
apart in x makes them *less* reachable, not more.

### The rule to implement

Place each correct-type item **inside the window the bin can reach** from the
previous correct item:

```
lo = max(itemRadius,     lastCorrect.x - v * dt)
hi = min(W - itemRadius, lastCorrect.x + v * dt)
x  = lo + random() * (hi - lo)          // skip this spawn if hi < lo
```

where `dt` is the gap between the two items' landing times.

It is **generative, not rejective**: the spawner picks a legal position rather
than picking randomly and retrying. That is what makes the guarantee hold at
any spawn rate.

`v` is calibrated to the **slowest control** — webcam hand-tracking, taken as
one screen-crossing per second (~1280px/s at W=1280). Phone and mouse are
faster and therefore get slack for free, so the guarantee holds for every
scheme rather than only the responsive ones.

**Verified:** zero forced strikes across 400 runs × 7 spawn rates × multiple
control speeds, including a deliberately shrunk 130px bin.

### Wrong-item corridor guard

Wrong-type items avoid landing within catch-range of a correct item landing at
nearly the same moment (±260ms).

Stated honestly: modelling showed this is **not required** to prevent forced
strikes. It is included as defence-in-depth and for feel — a wrong item landing
exactly where the player must be is unpleasant even when technically dodgeable.
It should be the first thing dropped if it causes trouble.

### Not degenerate

A fairness rule that made items cluster would be fair and boring. Measured
across spawn rates and control speeds, items use **the full screen width**
(x from ~70 to ~1210 of 1280) and the bin still travels a median 200–340px
between catches, with a p90 up to ~810px and a maximum of the full width.

### Numbers

| parameter | wave 1 | late |
|---|---|---|
| fall time | ~2.2s | faster |
| mean spawn gap | ~900ms | ~450ms |
| correct-type share | ~45% | ~45% |
| bin width | ~150px | ~150px |
| item radius | ~45px | ~45px |

Fairness was verified down to a 260ms gap, so there is real headroom to push
difficulty beyond the stated late values if playtesting wants it.

## Escalation

Two levers, both chosen by the user:

1. **Faster and denser** — fall time shortens and spawn gap narrows over the run.
2. **Trickier items** — the trap items from the roster expansion (`receipt`,
   `tissue`, `mirror`, `photo`, `ceramic`) are weighted into later waves as
   wrong-type hazards. All five are on the HK EPD not-accepted list and all five
   look recyclable, so late difficulty tests knowledge rather than reflex.

Bin width stays constant. Shrinking it was considered and rejected: it punishes
the least accurate control scheme (webcam) hardest, for reasons the player
cannot see.

## UI

- **The bin** is drawn at the bottom, coloured by its current target type using
  the existing `QBINS` palette, labelled with the type name.
- **A countdown bar** shows time until the target switches, with a distinct
  warning state in the last ~3s.
- **Three hearts** for strikes, reusing `drawHeart`.
- **Combo multiplier** shown when above 1x, as Sort does.
- **On a catch:** green burst plus a floating `+points`.
- **On a strike:** red burst plus a message naming the correct bin, so the
  strike teaches rather than only punishing.

The five static bin rectangles along the bottom are removed — there is only one
bin now, and it moves.

## Code changes

All in `js/mode-defend.js` unless noted.

**Removed** — these exist solely to serve the steering model:

- `tsunamiSlice()` entirely
- `DCFG` steering constants: `nudge`, `vxCap`, `kick`, `vxDrag`, `hitCool`
- `binRects()`, `binAt()` and the static five-bin drawing in `tsunamiDraw`
- the per-object `cool` field and wall-bounce handling in `tsunamiUpdate`

**Added:**

- bin state: `x`, `targetBin`, `switchT`
- `binPos()` — maps the active control scheme's input to bin x
- `spawnCorrect()` / `spawnWrong()` implementing the reachability rule above
- `catchCheck()` — landing resolution: caught, missed, or wrong-caught

**Unchanged:** `ITEMS` and all artwork, the specials system, scoring/results
plumbing, pause handling.

### `game.js` touch points

Bin It is more coupled to `game.js` than "one mode file" suggests. The exact
lines to change:

- **`game.js:544`** drives the blade and calls `tsunamiSlice(...)` every frame,
  and pushes to `BLADE.trail`. This must stop calling `tsunamiSlice` and stop
  maintaining the blade trail for this mode; the bin does not slice.
- **`game.js:586`** draws item name labels while `TS.running`. Keep — labels are
  more useful when catching, not less.
- **`game.js:582`** (`tsunamiDraw`), **`game.js:633`** (`launchTsunami`),
  **`game.js:641`** (`tsunamiBegin`) and **`game.js:652`** (running check) keep
  their existing shape; only the internals of the functions they call change.

The `GMODE` value stays `"tsunami"` throughout. Renaming it would touch
`scores.js`, the results screen and stored personal bests for no player-visible
benefit, and would silently orphan existing saved scores.

No other mode is touched.

## Verification

1. **Fairness harness** — the model used to derive the rule, kept as a check:
   zero forced strikes across spawn rates and control speeds.
2. **Non-degeneracy** — items still span the full width; bin travel distribution
   unchanged from the figures above.
3. **All three control schemes** drive the bin across the full width.
4. **Strike accounting** — a missed correct item and a caught wrong item each
   cost exactly one strike; three ends the run.
5. **Played in a browser** before it is called done. Simulation alone has
   repeatedly failed to predict how this game actually feels — it is what made
   Slash mode take several attempts — so a real play pass is required, not
   optional.

## Risks

- **Catching may feel too easy once fair.** The guarantee removes impossible
  situations, which also removes some tension. Mitigation: the headroom down to
  a 260ms spawn gap is deliberate slack to push difficulty after playtesting.
- **Webcam hand-tracking may be jittery enough to make precise positioning
  frustrating** even though it is fast enough. Not measurable without a real
  camera session; flagged for the play pass.
- **Two strike conditions may read as harsh.** If early playtests show players
  dying to wrong-catches they did not understand, the first thing to try is
  making wrong-catches cost the combo rather than a strike, keeping missed
  catches as the only strike.

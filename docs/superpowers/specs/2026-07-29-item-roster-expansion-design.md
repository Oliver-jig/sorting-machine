# Item roster expansion — 27 to 50 items

Date: 2026-07-29
Status: approved, ready for implementation planning

## Problem

Items repeat noticeably during play. The cause is not the total count but the
**imbalance between bins**.

Modelling one 25-second Bin It round (spawn gap ~1100ms, 60% biased to the
active bin, so ~14 items drawn from that category):

| category size | distinct items seen | most-repeated item appears |
|---|---|---|
| 3 (current glass) | 3.0 | **6.5x** |
| 4 (current metal) | 3.9 | 5.5x |
| 6 (current paper, plastic) | 5.5 | 4.4x |
| 8 (current trash) | 6.8 | 3.8x |
| 10 | 7.7 | 3.4x |
| 12 | 8.5 | 3.2x |
| 15 | 9.3 | 2.9x |

With three glass items the same bottle appears about six times per round. The
benefit flattens past ten per bin, so ten is the target: it removes the
repetition without producing more artwork than can be drawn well in one pass.

Current distribution is paper 6, plastic 6, metal 4, glass 3, trash 8 = 27.

## Goals

- 50 items, exactly 10 per bin.
- Item choices grounded in the Hong Kong government recyclables list, not invented.
- All four modes (Sort, Quiz, Bin It, Versus) benefit without per-mode changes.
- No item ships with artwork that has not been looked at.

## Non-goals

- The Bin It mode redesign. Agreed separately and deferred to its own spec;
  decisions recorded at the end of this document so they are not lost.
- Any change to spawn rates, difficulty curves, or scoring.
- A sixth bin. Every item must map to one of paper/plastic/metal/glass/trash.

## Source

Item choices and the accepted/not-accepted split come from the Hong Kong
Environmental Protection Department's GREEN@COMMUNITY FAQ, which lists the nine
recyclable streams and, importantly, the items people wrongly assume are
recyclable.

## Bin reassignments (existing items, no new artwork)

Three current items contradict the government list:

| item | from | to | reason |
|---|---|---|---|
| `carton` 紙包飲品 Drink carton | trash | **paper** | Beverage cartons are collected by GREEN@COMMUNITY. |
| `bag` 膠袋 Plastic bag | trash | **plastic** | Plastic bags are on the accepted plastics list. |
| `foam` 發泡膠飯盒 Foam box | trash | **plastic** | Styrofoam is on the accepted plastics list. |

Decision: follow the government list for all three. The contamination
counter-argument (a food-soiled lunchbox is not accepted in practice) was
considered and rejected in favour of consistency with the published list.

This leaves trash holding only genuinely non-recyclable items, which sharpens
what that bin teaches.

## The roster

Starting point after reassignment: paper 7, plastic 8, metal 4, glass 3,
trash 5. New items marked **NEW** (23 total).

### Paper (10)

| `t` | name | status |
|---|---|---|
| `news` | 報紙 Newspaper | existing |
| `box` | 紙皮 Cardboard | existing |
| `mag` | 雜誌 Magazine | existing |
| `envelope` | 信封 Envelope | existing |
| `toiletRoll` | 廁紙筒 Roll tube | existing |
| `eggBox` | 蛋盒 Egg carton | existing |
| `carton` | 紙包飲品 Drink carton | moved from trash |
| `officePaper` | 辦公室紙 Office paper | **NEW** |
| `textbook` | 教科書 Textbook | **NEW** |
| `paperBag` | 紙袋 Paper bag | **NEW** |

Office paper and textbooks are both named on the accepted list.

### Plastic (10)

| `t` | name | status |
|---|---|---|
| `bottle` | 蒸餾水樽 Water bottle | existing |
| `jug` | 洗潔精 Dish soap | existing |
| `tub` | 乳酪杯 Yogurt tub | existing |
| `shampoo` | 洗頭水樽 Shampoo | existing |
| `detergent` | 清潔劑樽 Detergent | existing |
| `cup` | 膠杯 Plastic cup | existing |
| `bag` | 膠袋 Plastic bag | moved from trash |
| `foam` | 發泡膠飯盒 Foam box | moved from trash |
| `cdCase` | 光碟盒 CD case | **NEW** |
| `foodBox` | 保鮮盒 Food container | **NEW** |

CD/DVD cases and containers are both named on the accepted list. Both are
visually distinct from the six existing bottle-shaped plastics, which matters
because plastic is the category most at risk of every item looking alike.

### Metal (10)

| `t` | name | status |
|---|---|---|
| `canTall` | 汽水罐 Soda can | existing |
| `spam` | 午餐肉罐 Luncheon meat | existing |
| `foodCan` | 罐頭 Food tin | existing |
| `foil` | 錫紙 Aluminium foil | existing |
| `milkPowder` | 奶粉罐 Milk powder can | **NEW** |
| `poonChoi` | 盆菜盆 Poon choi container | **NEW** |
| `breadTongs` | 麵包夾 Bread tongs | **NEW** |
| `biscuitTin` | 餅乾罐 Biscuit tin | **NEW** |
| `alTray` | 鋁盤 Aluminium tray | **NEW** |
| `metalCap` | 金屬樽蓋 Bottle cap | **NEW** |

Milk powder cans, poon choi containers and bread tongs are named explicitly on
the Hong Kong list and are locally recognisable.

### Glass (10)

| `t` | name | status |
|---|---|---|
| `wine` | 玻璃樽 Glass bottle | existing |
| `jar` | 醬料樽 Sauce jar | existing |
| `beer` | 啤酒樽 Beer bottle | existing |
| `soySauce` | 豉油樽 Soy sauce bottle | **NEW** |
| `jamJar` | 果醬樽 Jam jar | **NEW** |
| `perfume` | 香水樽 Perfume bottle | **NEW** |
| `medicine` | 藥樽 Medicine bottle | **NEW** |
| `oilBottle` | 油樽 Cooking oil bottle | **NEW** |
| `vinegar` | 醋樽 Vinegar bottle | **NEW** |
| `glassSoda` | 汽水玻璃樽 Glass soda bottle | **NEW** |

All qualify as "beverage bottles" or "food and sauce bottles", the two
categories HK glass banks accept. This is the hardest category to fill with
visually distinct objects; silhouette and colour must carry the difference,
since seven bottles risk looking identical at sprite size. See Risks.

### Trash (10)

Every item is on the government's **not accepted** list, and every one looks
recyclable. This is the most educational category in the game.

| `t` | name | status | why it is not recyclable |
|---|---|---|---|
| `pizza` | 薄餅盒 Pizza box | existing | grease contaminates paper pulp |
| `bubbletea` | 珍珠奶茶 Bubble tea | existing | mixed materials plus residue |
| `mask` | 口罩 Face mask | existing | composite fabric layers |
| `coffeeCup` | 咖啡杯 Coffee cup | existing | plastic-lined paper |
| `chopstick` | 即棄筷子 Chopsticks | existing | contaminated, low-grade wood |
| `receipt` | 收據 Receipt | **NEW** | thermal coating |
| `tissue` | 紙巾 Tissue | **NEW** | fibres too short to re-pulp |
| `mirror` | 鏡 Mirror | **NEW** | coated, different melting point to container glass |
| `photo` | 相片 Photograph | **NEW** | chemical emulsion layer |
| `ceramic` | 陶瓷碗 Ceramic bowl | **NEW** | contaminates glass batches |

Totals: 10 + 10 + 10 + 10 + 10 = **50**, of which **23 need new artwork**.

## Technical design

### File split

`ITEMS` and `ART` move from `js/game.js` into a new **`js/items.js`**, along
with the drawing helpers they depend on (`rr`, `fillIt`, `outline`, `cjk`, `hx`,
`OL`, `OLW`).

Rationale: `game.js` is 877 lines and mixes roster data, artwork, the 3D engine,
Sort mode, and networking. The roster work adds roughly 165 lines, pushing it
past 1,000. The roster is a clean boundary — pure data and drawing with no
engine dependencies — and is the file most likely to be edited again as items
are added.

This is a move, not a rewrite. No behaviour changes. `js/items.js` must load
before `game.js` in `index.html`.

### Data shape

Unchanged: `{n, t, bin, col}`. Names stay bilingual (中文 English), matching the
existing convention.

### Constraints verified against the code

- **`t` must be unique.** `game.js:337` builds `ITEMBYT` keyed by `t`; a
  duplicate silently shadows an item rather than erroring.
- **`bin` must be a `QBINS` key** (`game.js:338`) — paper, plastic, metal,
  glass, trash.
- **No consumer hardcodes the item count.** Every reader filters `ITEMS`
  generically (`game.js:358`, `game.js:481`, `mode-defend.js:76`), so all four
  modes pick up new items with no per-mode change.

### Startup assertion

A missing `ART[t]` does not error — `game.js:274` falls back to `ART._def`,
a plain grey square. A new item with a typo'd `t` would therefore ship as a
blank box that nobody notices.

Add a startup check that every `ITEMS` entry has a matching `ART` function and a
valid `bin`, logging a console error listing any failures. Cheap, and it
converts a silent art bug into an immediate signal.

### Facts

The five new trap items each get a `FACTS` entry explaining why they are not
recyclable, using the "why" column above. `FACTS` already feeds the results
screen in both Sort (`game.js:329`) and Bin It (`mode-defend.js:200`).

## Verification

1. **Startup assertion passes** — every item has artwork and a valid bin.
2. **Per-bin count check** — exactly 10 in each of the five bins, 50 total,
   and no duplicate `t`.
3. **Contact sheet** — a standalone page rendering all 50 sprites at in-game
   size, screenshotted and inspected. Any sprite that is unrecognisable, or
   indistinguishable from another, is redrawn before the work is considered
   done. This is a hard gate: no item ships unlooked-at.
4. **Repetition model re-run** against the final roster, confirming the 6.5x
   worst case is gone and every bin sits at ~3.4x.
5. **All four modes launch** and spawn new items without console errors.

## Risks

- **Glass items looking alike.** Seven new bottles is the largest single-shape
  cluster in the roster. Mitigation: deliberately vary silhouette (squat jam
  jar, tall thin vinegar, round perfume, small medicine) and colour rather than
  relying on labels, which are illegible at sprite size. The contact sheet is
  the check — if two glass items are hard to tell apart, one gets redrawn.
- **Art quality drift across 23 items.** Mitigation: the contact sheet, plus
  10-per-bin rather than 12 was chosen specifically to keep the batch small
  enough to draw well.
- **Reassigning three existing items changes what the game teaches.** This is
  intentional and follows the government list, but it means players who learned
  the old behaviour will see different answers. Acceptable: the old behaviour
  was factually wrong.

## Deferred: Bin It redesign

Agreed in the same session, to be specified separately once this ships. Recorded
here so the reasoning is not lost.

**Diagnosis (measured, not assumed).** The current steering mechanic fails for
three compounding reasons:

- The bin highlight uses `binAt(o.x)` (`mode-defend.js:211`) — the bin an item
  is *currently over* — ignoring sideways momentum. Once an item is moving this
  is **wrong 46% of the time** and can be off by two bins. The only feedback the
  mode gives is misleading.
- Items **coast 283px (1.13 bin widths)** after the player stops pushing, due to
  `vxDrag`. Landing something requires anticipating more than a full bin of
  drift, with nothing on screen to indicate it.
- Steering **saturates at 80px/frame** of blade travel (`vxCap`,
  `mode-defend.js:184`), so firm and violent swings are identical. After the
  build 43 controller change a phone swing crosses the screen in ~134ms
  (~160px/frame), making the control effectively binary on phone.

Throughput was investigated and ruled out: only ~3 items are ever in flight and
1.5 steers/second survives indefinitely. The mode is unpredictable, not too fast.

**Agreed replacement.** Remove per-item steering entirely.

- One **active bin** at a time, shown prominently.
- Players slice only items belonging to the active bin. Slicing is collecting,
  not steering.
- Non-matching items are **visible hazards**: slicing one is punished, letting
  it fall is correct and safe. A crowded screen stops being a crisis.
- The active bin rotates **on a timer**, with a countdown and an announcement
  before each switch.
- Difficulty **escalates**: forgiving early waves that teach the bins, harder
  later ones. The trap items in this spec are the primary source of that
  late-game difficulty.

**Still open:** lives and fail model, scoring and combo rules, and whether later
waves activate two bins at once.

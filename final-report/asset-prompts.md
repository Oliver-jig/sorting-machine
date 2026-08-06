# Asset prompts and provenance

One entry per generated asset: the file, the tool that made it, the exact prompt where one
survives, and how many attempts it took.

## Read this first — what is and is not recorded here

**No image-generation prompts were saved.** Every image in this game was produced in a separate
tool by the human and handed to the coding agent as a finished file or folder. The chat history
records the *handover* ("help me use this items to replace the current game items") but never the
prompt that produced the images, and the packs themselves do not carry one.

Rather than invent plausible prompts, this file records exactly what does survive:

- the **tool**, where the chat history names it
- the **handover message**, verbatim
- the **integration brief** that shipped with the item pack — written by the generating tool *for*
  the coding agent, and the closest thing to a prompt that exists
- the **full recipe** for the audio, which is the one asset whose generation was scripted and
  therefore reproducible

**Attempt counts for images are unknown.** The generating tools ran outside the agent, so only the
final output was ever visible. The audio's four generations are known only because the working
folder was kept.

---

## 1. Item artwork — 50 sprites

| | |
|---|---|
| **Files** | `img/items/*.webp` (50 files, 300×220 transparent WebP) |
| **Tool** | An external AI image tool. **Not named anywhere in the chat history.** |
| **Prompt** | **Not saved.** |
| **Attempts** | **Unknown** — only the final pack was handed over |
| **Thumbnails** | See the sprite strip in `insight-report.html` §1, or `docs/item-roster.jpg` |

**Handover message, verbatim (2026-08-05):**

> `@"/Users/tchan/Documents/Fruit ninja game SDG/hong-kong-cartoon-items-pack/" help me use this items to replace the current game items.`

The pack arrived as a folder containing 50 WebPs, a `manifest.json` mapping every image to an
existing `ITEMS[].t` key in `js/items.js`, a `preview.html` roster sheet, and a README.

**The integration brief that shipped with the pack.** This is the most prompt-like artefact in the
project — the generating tool wrote instructions aimed at the coding agent:

```
Integration brief for Claude Code

1. Read manifest.json and preserve every existing itemKey, bin assignment,
   game rule and bilingual name.
2. Preload all WebP files once at startup and cache them by itemKey; never
   create a new image object during each spawn.
3. Replace only the visual output of the existing makeSprite() pipeline. Do not
   change scoring, physics, spawn frequency, phone controls, Aim/Slash behavior
   or recycling classification.
4. Preserve aspect ratio and transparent edges. Fit each image within the
   current item size rather than stretching it.
5. Keep a fallback to the existing canvas artwork if an asset fails to load.
6. Run the existing test suite and verify that a full round does not produce
   missing textures or additional network requests after preload.

If true 3D rotation and depth are required later, use these renders as art
direction references and create optimized low-poly GLB models separately.
Target approximately 300-1,500 triangles per model, shared materials,
compressed textures and no real-time shadows.
```

All six points shipped. The pack also carried an explicit warning that the images are 2D sprite
renders with a 3D look, **not** rotatable `.glb` meshes — which stopped a wrong assumption before
it was made.

---

## 2. Menu artwork

| | |
|---|---|
| **File** | `img/props.png` (800×533, 317 KB) |
| **Tool** | **OpenAI Codex**, as part of a UI mockup |
| **Prompt** | **Not saved** |
| **Attempts** | 2 mockup rounds — one from Claude (31 July), one from Codex (4 August) |

**Handover message, verbatim (2026-08-04):**

> `file:///Users/tchan/Documents/Fruit%20ninja%20game%20SDG/slice-sort-ui-preview.html So here is the UI interface that made by codex. I want you use this UI interface in our website.`

An earlier round used a different tool (31 July):

> `@"/Users/tchan/Downloads/Slice & Sort UI Mockups.dc.html" Here is the UI interface that made by claude design, please use this UI interface for our project`

The Codex export was a static HTML mockup with the real UI inside an `<iframe srcdoc>` — 43 KB of
markup and CSS plus **a 1.26 MB base64-inlined PNG**. That inline image was the menu artwork. It
was extracted to an external, cacheable, lazy-loaded 317 KB `img/props.png`, because leaving it
inline would have outweighed the rest of the page.

---

## 3. Playfield backdrop

| | |
|---|---|
| **File** | `img/bg-harbour.jpg` (1600×900, 141 KB) |
| **Tool** | External image tool, **not named** in the chat history |
| **Prompt** | **Not saved** |
| **Attempts** | **Unknown** |

Supplied as a 627 KB PNG. The agent's work was measurement, not generation:

- The approved plan was to blur and darken it. **Measuring the file said not to** — it arrived
  already treated for gameplay: sky mean luminance 3–8/255 with 0% of pixels over 110, and the
  painted bins in the bottom corners measured 17.6 and 15.4, *darker* than mid-field at 23.3. It
  shipped as supplied.
- Re-encoded to JPEG q82 (627 KB → 141 KB) and then **verified**, because dark smooth gradients are
  exactly where JPEG bands: PSNR 47.6 dB, max error 15/255, sky strip holding 28 luminance levels —
  identical to the source. No banding.

---

## 4. Cut sounds — the one fully reproducible asset

| | |
|---|---|
| **Files** | `audio/*.wav` (5 files, mono 44.1 kHz 16-bit PCM) |
| **Tool** | Freesound CC0 clips, edited with Python |
| **Attempts** | **4 generations** |
| **Licence** | CC0 — copying, modification and commercial use permitted, attribution not required |

### The four generations

Every attempt survives in `~/Documents/Fruit ninja game SDG/audio-preview/`:

| # | What | Where | Result |
|---|---|---|---|
| 1 | **Pure synthesis, generic** — 3 WAVs from maths alone | `generate_slice_sounds.py` | Rejected |
| 2 | **Pure synthesis, per category** — 5 WAVs | `generate_category_sounds.py` → `category-cuts/` | Rejected |
| 3 | **Real recordings gathered** — 12 CC0 clips | `reference-cc0/` | Kept as source |
| 4 | **Edited down** — 6 cuts, 5 shipped | `internet-reference-cuts/` → shipped | **Shipped** |

Synthesised glass never sounded like glass. Generations 1 and 2 used noise plus an envelope plus a
"whoosh" — no recordings at all:

```python
def blade_whoosh(t, data, center=0.105, strength=0.30):
    shape = math.exp(-((t - center) / 0.065) ** 2)
    tone  = math.sin(2 * math.pi * (900 + 2200 * min(1.0, t / center)) * t)
    return (data * 0.86 + tone * 0.14) * shape * strength
```

That is convincing for a generic slash and unconvincing for a specific material, which is why the
shipped pack is real recordings.

### The shipped five — exact source and edit

| File | Source clip | Edit |
|---|---|---|
| `cut-paper-shred.wav` | "Paper shredder" by giddster — freesound.org/s/360488/ | Short shredder fragment, accelerated, filtered to reduce motor rumble, layered with a quiet slash, normalised |
| `cut-plastic-crunch.wav` | "Plastic Bottle Scrunch" by megashroom — freesound.org/s/390175/ | Bottle scrunch transient, accelerated and filtered, layered with a quiet slash, normalised |
| `cut-metal-shear.wav` | "metal scraping" by SamsterBirdies — freesound.org/s/435700/ **+** "Metal clang" by freemaster2 — freesound.org/s/402384/ | Short scrape layered with a clang, faded and normalised |
| `cut-glass-shatter.wav` | "Glass Shatter 3" by lurpsis — freesound.org/s/444136/ | Shortened and softened, with a quiet slash onset |
| `cut-general-waste-slice.wav` | "Slash" by qubodup — freesound.org/s/442903/ | Clean slash trimmed, filtered, faded and normalised |

This table is reproduced from `audio/SOURCES.md`, which ships with the game.

### Post-delivery tuning by the agent

The pack was peak-normalised but **not loudness-matched** — measured RMS ran from −24.9 dB (glass)
to −16.6 dB (general waste), an 8.3 dB spread, so glass sounded weak next to metal despite matching
peaks. Per-bin gain trims in `js/audio.js` close roughly **half** that gap in dB. Only half,
deliberately: glass shatter has a long quiet tail that drags its RMS down, so full normalisation
would have made the initial smash far too loud. Measured in-browser after the trims, peak RMS runs
0.086–0.117 — a 2.7 dB spread.

---

## 5. Original item artwork — written, not generated

| | |
|---|---|
| **File** | `js/items.js`, the `ART` object (50 drawing functions) |
| **Tool** | The coding agent, as canvas code |
| **Prompt** | n/a — written directly as JavaScript |
| **Status** | Still shipping, as the **fallback** |

Before any image pack existed, all 50 items were hand-written canvas drawings. They were not
deleted when the renders arrived: a 404, a decode failure or a browser without WebP swaps the
drawing back in and the game stays playable with every item legible. `docs/item-roster.jpg` is a
poster of this artwork.

The six power-ups in `js/specials.js` go through the same sprite pipeline but were never in the
render pack, so they keep their drawings permanently — membership is derived from the roster rather
than assumed, precisely so they do not 404.

---

## What a future course should require

The gap in this file is entirely avoidable. If asset prompts matter to the assessment, ask interns
to save, next to every asset:

1. the **tool and model** used,
2. the **exact prompt**, including negative prompts and any seed,
3. the **number of attempts** and what was wrong with the rejected ones,
4. the **licence** of any source material.

The audio section above is complete because the generating scripts were kept. The image sections
are thin because nothing was. That difference is the whole lesson.

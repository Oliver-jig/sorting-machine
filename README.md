# Slice & Sort 3D — SDG 12 (Responsible Consumption)

A 3D arcade slicer about Hong Kong recycling. Low-poly objects fly up; you slice
the ones that fit the round's bin. Slice a wrong item and you lose marks. Four
rounds, each a recycling category — the last is the "wishcycling traps" round.

**Headline lesson:** knowing the real bins matters — the traps (greasy pizza box,
coffee cup, plastic bag, foam, cartons) aren't recyclable, even though people
throw them in hoping they count.

## Play it three ways (chosen on the start screen)

- **Webcam hand** — your hand is tracked (MediaPipe) and becomes the blade; move
  it to slice. An on-screen "✋ your hand" marker shows exactly what's tracked
  (it follows your index fingertip). Runs entirely in your browser.
- **Phone controller** — the laptop shows a QR code; scan it with your phone and
  your phone becomes a motion controller, tilting to move the blade on the big
  screen (see below).
- **Mouse / touch** — move (or swipe on a touchscreen) to slice. Always works;
  the reliable fallback for demos.

There's also a **Relaxed / Normal speed** toggle on the start screen. Relaxed
makes objects float slower and hang in the air longer — much easier to cut.

## Phone controller — how the scan-and-connect works

1. Deploy the game (Vercel) so it's on an `https://` link, and open that link on
   your **laptop**. Choose "Phone controller" and press Start game.
2. A **QR code** appears. Scan it with your phone camera — it opens a small
   controller page (the same site with `?ctrl=1`).
3. On the phone, tap **Connect & enable motion** (grant motion permission on
   iOS). The laptop shows "Phone connected"; press **Start game**.
4. Tilt your phone to move the blade on the laptop screen.

The link is peer-to-peer using **PeerJS** (a free hosted broker — no server for
you to run). Phone and laptop on the **same Wi-Fi** connect most reliably. This
feature needs `https`, so it won't work from a double-clicked local file — deploy
it first. Mouse and webcam modes still work locally.

## Rounds

1. **Paper** — newspaper, cardboard, magazines (blue bin).
2. **Plastic** — bottles and rinsed tubs (brown bin).
3. **Metal & Glass** — cans (yellow bin) and glass (green points).
4. **Spot the traps** — slice only the items that CAN'T be recycled.

Correct item = +15, wrong item = −12.

## Tech

- **Three.js** (r128, from CDN) renders the low-poly 3D items — every model is
  built from primitives in `makeMesh()` (bottle = cylinders, box = cube, etc.),
  coloured by material. No external model files.
- Physics and slicing run in screen space over the 3D scene, so all three control
  modes share the same blade logic.
- MediaPipe Hands + camera utils load from CDN only when webcam mode is chosen.

## Run it

Single self-contained `index.html`.

- **Mouse mode:** just double-click `index.html`.
- **Webcam / phone modes:** need `https` or `localhost` (browsers require it for
  camera and motion). Serve with `python3 -m http.server`, or deploy to Vercel
  (static, no config) and open on your phone/laptop.

## Customising

- Items: `ITEMS` array (name, 3D type, bin, colour).
- Rounds: `ROUNDS` array (topic, which bins count, colour, blurb).
- New 3D shapes: add a branch in `makeMesh()`.
- Timing/scoring: `ROUND_MS` and the `pts` values in `sliceAlong()`.

## Data

Bin categories from Hong Kong's EPD tricolour system (blue paper, yellow metal,
brown plastic) plus separate green glass collection points. Hong Kong landfills
receive over 11,000 tonnes of waste per day.

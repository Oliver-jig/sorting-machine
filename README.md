# Slice & Sort 3D — SDG 12 (Responsible Consumption & Production)

A browser arcade slicer about Hong Kong recycling. 3D objects fly up; you slice
the ones that belong in the round's bin and leave the rest. Built for the
**tramplus SDG Sprint** around **SDG 12: Responsible Consumption & Production** —
its theme colour (amber-gold #BF8B2E) and circular-economy loop run through the
whole interface.

**Headline lesson:** knowing the real bins matters. The "wishcycling traps"
(greasy pizza box, coffee cup, plastic bag, foam, drink cartons) aren't
recyclable in Hong Kong, even though people bin them hoping they count.

## Four game modes

- **Sort** — four rounds, each a recycling category (Paper, Plastic, Metal &
  Glass, then the traps). Slice items that fit the round's bin; wrong slice loses
  marks.
- **Quiz** — a question appears and possible answers fly up Fruit-Ninja style.
  Slice the correct one. Sudden death; the correct answer is shown if you miss.
- **Defend** — waste rains down toward the bins. Slice the trash, spare the
  recyclables. Three lives; a small penalty for cutting a recyclable.
- **Versus** — split screen, two webcam hands, 60-second race. A rotating target
  topic banner tells both players what to slice; +1 for a match, −1 for a miss.

## Three ways to play (chosen on the start screen)

- **Webcam hand** — your hand is tracked (MediaPipe) and becomes the blade.
  Runs entirely in your browser; nothing is uploaded.
- **Phone controller** — the laptop shows a QR code; scan it and your phone
  becomes a motion controller. Hold it sideways like a TV remote and swing to
  move the blade (see below).
- **Mouse / touch** — move or swipe to slice. The reliable fallback for demos.

A **Relaxed / Normal** speed toggle sets how fast objects float.

## Project structure

```
slice-sort-3d/
├── index.html        game page (structure only)
├── controller.html   phone controller page
├── css/
│   └── styles.css    all styling (base layout + SDG 12 theme)
├── js/
│   └── game.js       game engine (3D, slicing, all four modes, phone link)
├── package.json
├── vercel.json
├── LICENSE
└── README.md
```

The CSS and JavaScript were factored out of `index.html` into `css/` and `js/`.
There's no build step — the browser loads the files directly.

## Run it

- **Locally:** from this folder run `npm start` (serves on
  `http://localhost:8137`) or `python3 -m http.server 8137`, then open the link.
  Webcam and phone modes need `https` or `localhost` for camera/motion access, so
  serve it — don't just double-click the file.
- **Deploy to Vercel:** drag the folder into Vercel, or run `vercel`. It's static,
  no configuration needed. Deploying gives you the `https` link the phone
  controller requires.

## Phone controller — how scan-and-connect works

1. Open the deployed `https` link on your **laptop**, choose "Phone controller",
   press Start.
2. A **QR code** appears. Scan it with your phone to open the controller page.
3. Tap **Connect & enable motion** (grant motion permission on iOS). The laptop
   shows the phone connected; press Start.
4. Hold the phone sideways and swing it to move the blade on the big screen.

Signalling and low-latency motion run over an MQTT relay plus a WebRTC data
channel (with a relay fallback), so there's no server for you to host.

## Tech

- **Three.js** (r128, CDN) renders the 3D items as camera-facing textured sprites
  drawn on a canvas — no external model files.
- A 2D canvas overlay draws slice particles, blade trails, quiz cards, and the
  versus split UI.
- **MediaPipe Hands** (CDN, loaded only for webcam mode) tracks the index
  fingertip as the blade.
- Phone link: WebRTC over an MQTT relay (`broker.emqx.io`), plus the
  DeviceOrientation API for motion.

## Data

Bin categories follow Hong Kong's EPD tricolour system (blue paper, yellow metal,
brown plastic) plus separate green glass collection points. Hong Kong landfills
receive over 11,000 tonnes of municipal solid waste per day.

## License

MIT — see [LICENSE](LICENSE).

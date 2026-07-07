<img src="public/favicon.png" width="28" alt=""> Bagua Theremin — The Eight Trigrams

A browser theremin played across the Later Heaven (Hou Tian) Bagua. Your right hand's position on the wheel picks colour and pitch, continuously — no fixed notes, just glide. Your left hand's height sets volume, the way a real theremin has separate pitch and volume antennas.

**Try it:** [binyoun.github.io/bagua-theremin](https://binyoun.github.io/bagua-theremin/)

## Concept

Eight trigrams, arranged in their traditional Later Heaven compass positions (South at the top, per Chinese diagram convention, not a literal compass): Li/Fire/red at top, then clockwise through Kun/Earth, Dui/Metal, Qian/Heaven, Kan/Water, Gen/Mountain, Zhen/Thunder, Xun/Wind. Each trigram is drawn with its real line pattern (solid = yang, broken = yin), not a decorative glyph.

The wheel is symbolic and discrete — eight coloured wedges, each a real trigram — but the pitch a hand's angle produces is fully continuous across the whole circle. A theremin has no frets; moving through a wedge means gliding through its pitch *range*, not landing on one fixed note.

**Why it's monophonic, and how it still harmonizes.** A true theremin split means one hand produces pitch and the other only shapes loudness — there's no second hand free to hold a second note. Instead, a quiet drone always sounds exactly one octave below the lead voice. This isn't approximate: the wheel's full circle spans exactly two octaves, so the point diametrically opposite the lead pitch is always exactly one octave away — a guaranteed-consonant relationship by construction, not a coincidence of tuning.

This is a companion piece to **Tứ Bình**, which uses the painting-as-graphic-score catch-and-hold model instead — see the vault for how the two relate.

## How it works

- **HandTracker.js**: MediaPipe HandLandmarker, up to two hands, reports position and a stable per-hand identity (MediaPipe's own Left/Right label). No gesture/openness tracking here — this piece is pure continuous position, not catch-and-hold.
- **BaguaWheel.js**: draws the eight wedges and their real line patterns; `angleOf()`/`radiusFractionOf()` convert a hand's canvas position into wheel-relative angle and radius; `freqAt()` maps angle continuously (exponentially, so equal angular steps feel like equal musical steps) across a fixed 2-octave range; `droneFreqAt()` returns the frequency exactly 180° away.
- **SoundEngine.js**: one lead voice (two slightly detuned sawtooths through a lowpass filter, radius brightening the filter cutoff) plus the octave drone, both scaled by the volume hand's height. With only the pitch hand present, it still plays at a quiet default so a single hand gives feedback.

## Controls

| Hand | Parameter |
|---|---|
| Right — position on wheel (angle) | Pitch and colour, continuous |
| Right — distance from centre (radius) | Timbre brightness |
| Left — height | Volume |
| Neither | Silent, wheel still visible |
| Right only | Plays at a quiet default volume |

## Dev

```bash
npm install
npm run dev   # HTTPS via @vitejs/plugin-basic-ssl — accept the self-signed cert
```

Console-only dev hook (stripped from production builds):
```js
window.__wheel                                              // the BaguaWheel instance, e.g. window.__wheel.freqAt(90)
window.__forceHands = [{ x: 0.5, y: 0.3, handedness: 'Right' }]  // simulate hands without a camera
window.__forceHands = null                                  // hand control back to the real tracker
```

### Deploy

```bash
git push origin main   # GitHub Actions builds and deploys dist/ to GitHub Pages
```

## Structure

```
bagua-theremin/
├── index.html          # landing screen, single canvas stage, styles
├── src/
│   ├── main.js           # orchestration: hand roles, render loop
│   ├── HandTracker.js    # MediaPipe HandLandmarker wrapper, {x,y,handedness} per hand
│   ├── BaguaWheel.js     # wheel geometry, trigram data, continuous pitch/colour mapping
│   └── SoundEngine.js    # lead voice + octave-drone audio engine
└── .github/workflows/deploy.yml
```

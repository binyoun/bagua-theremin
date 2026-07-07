// main.js — Bagua Theremin, WebAR: a 3D bagua mirror floats over the live
// camera feed. Right hand's position on it sets pitch and colour,
// continuously — left hand's height sets volume, the way a real theremin
// has separate pitch and volume antennas.
//
// The same video element is both the visible camera passthrough (behind
// the transparent WebGL canvas) and MediaPipe's input source — one camera
// stream serves both purposes, matching the pattern used across this
// year's other WebAR pieces.

import { HandTracker } from './HandTracker.js';
import { SoundEngine } from './SoundEngine.js';
import { BaguaDisc, TRIGRAMS, freqAt, droneFreqAt } from './BaguaDisc.js';

const canvas = document.getElementById('stage');
const video = document.getElementById('video');
const landing = document.getElementById('landing');
const beginBtn = document.getElementById('begin');
const flipBtn = document.getElementById('flipCam');

const sound = new SoundEngine();
const tracker = new HandTracker();
let disc;

// Dev convenience: `window.__forceHands = [{x:0.5,y:0.3,handedness:'Right'}]`
// simulates hands without a real camera. `window.__forceHands = null` hands
// control back to the real tracker.
if (import.meta.env.DEV) window.__TRIGRAM_NAMES = TRIGRAMS.map((t) => t.name);

let started = false;
let lastT = performance.now();

beginBtn.addEventListener('click', async () => {
  if (started) return;
  beginBtn.disabled = true;
  beginBtn.textContent = 'Loading…';
  try {
    await sound.init();
    sound.build();
    await tracker.init(video);
    video.classList.toggle('mirrored', tracker.isMirrored);

    disc = new BaguaDisc(canvas, video);
    if (import.meta.env.DEV) window.__disc = disc;

    started = true;
    landing.classList.add('hidden');
    canvas.classList.add('ready');
    flipBtn.classList.add('visible');
    lastT = performance.now();
    requestAnimationFrame(loop);
  } catch (err) {
    console.error('Failed to start:', err);
    beginBtn.disabled = false;
    beginBtn.textContent = 'Camera failed — tap to retry';
  }
});

flipBtn.addEventListener('click', () => {
  flipBtn.disabled = true;
  tracker.switchCamera()
    .then(() => video.classList.toggle('mirrored', tracker.isMirrored))
    .finally(() => { flipBtn.disabled = false; });
});

const DEFAULT_VOLUME = 0.35; // when only the pitch hand is present

function loop(t) {
  const dt = Math.min(0.1, (t - lastT) / 1000);
  lastT = t;

  const forced = import.meta.env.DEV ? window.__forceHands : undefined;
  const hands = forced !== undefined ? (forced || []) : tracker.poll();

  const pitchHand = hands.find((h) => h.handedness === 'Right') || null;
  const volumeHand = hands.find((h) => h.handedness === 'Left') || null;

  let volume = 0, angleDeg = 0, radiusFraction = 0.5;

  if (pitchHand) {
    ({ angleDeg, radiusFraction } = disc.pointerToDisc(pitchHand.x, pitchHand.y));
    volume = volumeHand
      ? clamp((0.85 - volumeHand.y) / (0.85 - 0.15), 0, 1)
      : DEFAULT_VOLUME;
  }

  const freq = freqAt(angleDeg);
  const drone = droneFreqAt(angleDeg);
  sound.update(freq, drone, radiusFraction, volume);
  disc.update(dt, angleDeg, !!pitchHand);

  requestAnimationFrame(loop);
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

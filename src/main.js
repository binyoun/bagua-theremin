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
import { BaguaDisc, TRIGRAMS, freqAt, droneFreqAt, trigramIndexAt } from './BaguaDisc.js';

const canvas = document.getElementById('stage');
const video = document.getElementById('video');
const landing = document.getElementById('landing');
const beginBtn = document.getElementById('begin');
const flipBtn = document.getElementById('flipCam');
const hud = document.getElementById('hud');
const hudName = document.getElementById('hudName');
const hudMeta = document.getElementById('hudMeta');
const volMeter = document.getElementById('volMeter');
const volFill = document.getElementById('volMeter-fill');

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
  disc.update(dt, angleDeg, radiusFraction, !!pitchHand);

  // HUD: name the trigram actually sounding right now, in words — colour
  // and light alone proved hard to read against a live camera background.
  if (pitchHand) {
    const tri = TRIGRAMS[trigramIndexAt(angleDeg)];
    hudName.textContent = `${tri.name} · ${tri.element}`;
    hudMeta.textContent = `${tri.direction} · ${Math.round(freq)} Hz · vol ${Math.round(volume * 100)}%`;
    hud.classList.add('visible');
  } else {
    hud.classList.remove('visible');
  }

  // Volume meter: sits directly at the left hand's own screen position, so
  // it's unambiguous which hand it belongs to and what it's currently doing.
  if (volumeHand) {
    volMeter.style.left = `${volumeHand.x * 100}%`;
    volMeter.style.top = `${volumeHand.y * 100}%`;
    volFill.style.height = `${volume * 100}%`;
    volMeter.classList.add('visible');
  } else {
    volMeter.classList.remove('visible');
  }

  requestAnimationFrame(loop);
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

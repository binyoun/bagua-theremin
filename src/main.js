// main.js — Bagua Theremin: a true theremin split across the Later Heaven
// Bagua wheel. Right hand's position on the wheel sets pitch and colour,
// continuously (no fixed notes, just glide) — left hand's height sets
// volume, the way a real theremin has separate pitch and volume antennas.
//
// With only the pitch hand present, it still plays at a quiet default
// volume so a single hand gives feedback; bringing in the volume hand
// takes over full control. An octave-below drone always accompanies the
// lead voice, guaranteed consonant since the wheel's full circle spans
// exactly two octaves (see BaguaWheel.droneFreqAt) — the "harmonize" layer
// in a piece where only one hand can produce a pitch.

import { HandTracker } from './HandTracker.js';
import { SoundEngine } from './SoundEngine.js';
import { BaguaWheel } from './BaguaWheel.js';

const canvas = document.getElementById('stage');
const video = document.getElementById('video');
const landing = document.getElementById('landing');
const beginBtn = document.getElementById('begin');
const flipBtn = document.getElementById('flipCam');

const sound = new SoundEngine();
const tracker = new HandTracker();
const wheel = new BaguaWheel(canvas);

// Dev convenience: `window.__forceHands = [{x:0.5,y:0.3,handedness:'Right'}]`
// simulates hands without a real camera. `window.__forceHands = null` hands
// control back to the real tracker.
if (import.meta.env.DEV) window.__wheel = wheel;

let started = false;

beginBtn.addEventListener('click', async () => {
  if (started) return;
  beginBtn.disabled = true;
  beginBtn.textContent = 'Loading…';
  try {
    await sound.init();
    sound.build();
    await tracker.init(video);
    started = true;
    landing.classList.add('hidden');
    canvas.classList.add('ready');
    flipBtn.classList.add('visible');
    requestAnimationFrame(loop);
  } catch (err) {
    console.error('Failed to start:', err);
    beginBtn.disabled = false;
    beginBtn.textContent = 'Camera failed — tap to retry';
  }
});

flipBtn.addEventListener('click', () => {
  flipBtn.disabled = true;
  tracker.switchCamera().finally(() => { flipBtn.disabled = false; });
});

const DEFAULT_VOLUME = 0.35; // when only the pitch hand is present

function loop() {
  const forced = import.meta.env.DEV ? window.__forceHands : undefined;
  const hands = forced !== undefined ? (forced || []) : tracker.poll();

  const pitchHand = hands.find((h) => h.handedness === 'Right') || null;
  const volumeHand = hands.find((h) => h.handedness === 'Left') || null;

  let freq = 0, droneFreq = 0, brightness = 0.5, volume = 0;

  if (pitchHand) {
    const px = pitchHand.x * canvas.width, py = pitchHand.y * canvas.height;
    const angle = wheel.angleOf(px, py);
    freq = wheel.freqAt(angle);
    droneFreq = wheel.droneFreqAt(angle);
    brightness = wheel.radiusFractionOf(px, py);
    volume = volumeHand
      ? clamp((0.85 - volumeHand.y) / (0.85 - 0.15), 0, 1)
      : DEFAULT_VOLUME;
  }

  sound.update(freq, droneFreq, brightness, volume);
  wheel.draw(pitchHand, volumeHand, volume);

  requestAnimationFrame(loop);
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

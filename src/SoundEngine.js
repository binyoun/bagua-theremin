// SoundEngine.js — a true theremin: one continuously-gliding lead voice
// (pitch hand's angle around the Bagua wheel sets frequency continuously,
// no quantization to notes) plus a quiet drone exactly one octave below,
// which is always consonant by construction (see BaguaWheel.droneFreqAt —
// the wheel's full circle spans exactly two octaves, so the diametrically
// opposite point is always exactly one octave away). This is the
// "harmonize" layer in a piece where only one hand produces pitch.
//
// Radius from the wheel's centre brightens the tone (filter cutoff); the
// volume hand's height sets overall loudness. No instrument is simulated —
// plain oscillators, shaped only by the wheel's own geometry.

export class SoundEngine {
  constructor() {
    this._ctx = null;
  }

  init() {
    this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    return this._ctx.resume();
  }

  resume() {
    if (this._ctx && this._ctx.state === 'suspended') this._ctx.resume();
  }

  build() {
    const ctx = this._ctx;

    // Lead voice
    this.leadOsc = ctx.createOscillator();
    this.leadOsc.type = 'sawtooth';
    this.leadFilter = ctx.createBiquadFilter();
    this.leadFilter.type = 'lowpass';
    this.leadFilter.Q.value = 0.8;
    this.leadGain = ctx.createGain();
    this.leadGain.gain.value = 0;
    this.leadOsc.connect(this.leadFilter).connect(this.leadGain).connect(ctx.destination);

    // A second, slightly detuned oscillator under the lead — theremins
    // are famously not quite a pure tone; a touch of detune gives it a
    // gentle beating warmth instead of a flat digital sawtooth.
    this.leadOsc2 = ctx.createOscillator();
    this.leadOsc2.type = 'sawtooth';
    this.leadOsc2.detune.value = 8;
    this.leadOsc2.connect(this.leadFilter);

    // Octave drone
    this.droneOsc = ctx.createOscillator();
    this.droneOsc.type = 'sine';
    this.droneFilter = ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 900;
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0;
    this.droneOsc.connect(this.droneFilter).connect(this.droneGain).connect(ctx.destination);

    this.leadOsc.start();
    this.leadOsc2.start();
    this.droneOsc.start();
  }

  // freq/droneFreq: Hz. brightness: 0..1 (radius fraction). volume: 0..1
  // (0 = fully silent, from no volume hand and no pitch hand active).
  update(freq, droneFreq, brightness, volume) {
    const now = this._ctx.currentTime;
    const glide = 0.05; // short time-constant: responsive, not zippery

    this.leadOsc.frequency.setTargetAtTime(freq, now, glide);
    this.leadOsc2.frequency.setTargetAtTime(freq, now, glide);
    this.droneOsc.frequency.setTargetAtTime(droneFreq, now, glide);

    this.leadFilter.frequency.setTargetAtTime(500 + brightness * 4500, now, 0.08);

    const leadTarget = volume * 0.22;
    const droneTarget = volume * 0.09;
    this.leadGain.gain.setTargetAtTime(leadTarget, now, 0.06);
    this.droneGain.gain.setTargetAtTime(droneTarget, now, 0.06);
  }
}

// HandTracker.js — thin wrapper around MediaPipe HandLandmarker.
// VIDEO mode, GPU delegate, up to 2 hands. Reports each detected hand's
// mirrored normalized {x, y, handedness} once per video frame via poll() —
// position only; this piece is a true theremin split (one hand = pitch via
// position, the other = volume via height), not a catch/gesture piece, so
// there's no open/closed hand state to track here.
//
// Works with either a laptop webcam or a phone camera. Default is the
// front/user-facing camera on both — this piece works like a mirror (you
// watch the screen while gesturing in front of it), so the camera needs to
// face the same way the screen does. switchCamera() flips to the rear
// camera if you ever want to prop the device up facing outward instead.

import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export class HandTracker {
  constructor() {
    this._landmarker = null;
    this._video = null;
    this._running = false;
    this._lastVideoTime = -1;
    this._facingMode = 'user';
  }

  async init(videoEl, { facingMode = 'user' } = {}) {
    this._video = videoEl;
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
    );
    this._landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 2,
    });

    await this._openCamera(facingMode);
    this._running = true;
  }

  async _openCamera(facingMode) {
    const oldStream = this._video.srcObject;
    if (oldStream) oldStream.getTracks().forEach((t) => t.stop());

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facingMode }, width: { ideal: 640 } },
      audio: false,
    });
    this._facingMode = facingMode;
    this._video.srcObject = stream;
    await this._video.play();
  }

  async switchCamera() {
    const next = this._facingMode === 'user' ? 'environment' : 'user';
    await this._openCamera(next);
  }

  // Whether the *displayed* video should be CSS-mirrored (scaleX(-1)) to
  // match the mirrored hand coordinates poll() reports — front camera
  // only, so the visible feed behaves like a mirror and a hand's on-screen
  // position matches where the disc actually reacts.
  get isMirrored() {
    return this._facingMode === 'user';
  }

  // Returns an array of {x, y, handedness}, one per detected hand. Only x
  // is mirrored for the front camera (selfie view) — the rear camera
  // already matches what's in front of it. y is never mirrored.
  poll() {
    if (!this._running || !this._landmarker) return [];
    const now = performance.now();
    if (this._video.currentTime === this._lastVideoTime) return this._lastHands || [];
    this._lastVideoTime = this._video.currentTime;

    const result = this._landmarker.detectForVideo(this._video, now);
    const hands = (result.landmarks || []).map((lm, i) => {
      const x = this._facingMode === 'user' ? 1 - lm[9].x : lm[9].x;
      const rawSide = result.handedness?.[i]?.[0]?.categoryName || `hand${i}`;
      const handedness = this._facingMode === 'user'
        ? (rawSide === 'Left' ? 'Right' : rawSide === 'Right' ? 'Left' : rawSide)
        : rawSide;
      return { x, y: lm[9].y, handedness };
    });
    this._lastHands = hands;
    return hands;
  }

  stop() {
    this._running = false;
    const stream = this._video?.srcObject;
    if (stream) stream.getTracks().forEach((t) => t.stop());
  }
}

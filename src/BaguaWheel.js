// BaguaWheel.js — the Later Heaven (Hou Tian) Bagua, eight trigrams around
// a circle, South at top per traditional Chinese diagram convention (not a
// literal compass — this is a drawing layout, not GPS orientation).
//
// The wheel is symbolic/discrete (eight coloured wedges, each a real
// trigram with its own line pattern, element, and direction) but the pitch
// a hand's angle produces is fully continuous across the whole circle —
// a true theremin has no frets, just a glide — so moving through a wedge
// means gliding through its pitch *range*, not landing on one fixed note.

// Ordered by canvas angle (atan2, degrees, 0 = screen-right, increasing
// clockwise since canvas y grows downward), starting at -90° (screen-top)
// where the Bagua's South position is drawn, then proceeding clockwise
// through the traditional Later Heaven sequence.
export const TRIGRAMS = [
  { name: 'Li',    glyph: '☲', lines: '101', direction: 'South',     element: 'Fire',    color: '#c4342b' },
  { name: 'Kun',   glyph: '☷', lines: '000', direction: 'Southwest', element: 'Earth',   color: '#8b6b3d' },
  { name: 'Dui',   glyph: '☱', lines: '110', direction: 'West',      element: 'Metal',   color: '#c9d6dc' },
  { name: 'Qian',  glyph: '☰', lines: '111', direction: 'Northwest', element: 'Heaven',  color: '#e8e8ec' },
  { name: 'Kan',   glyph: '☵', lines: '010', direction: 'North',     element: 'Water',   color: '#1c2b3a' },
  { name: 'Gen',   glyph: '☶', lines: '001', direction: 'Northeast', element: 'Mountain',color: '#6b5d52' },
  { name: 'Zhen',  glyph: '☳', lines: '100', direction: 'East',      element: 'Thunder', color: '#3d8b37' },
  { name: 'Xun',   glyph: '☴', lines: '011', direction: 'Southeast', element: 'Wind',    color: '#6fa88a' },
];

const START_DEG = -90; // screen-top, where South/Li is drawn
const OCTAVES = 2;
const BASE_FREQ = 110; // A2 — low enough that a 2-octave range stays comfortable

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
const RGB = TRIGRAMS.map((t) => hexToRgb(t.color));

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpColor(a, b, t) {
  return { r: Math.round(lerp(a.r, b.r, t)), g: Math.round(lerp(a.g, b.g, t)), b: Math.round(lerp(a.b, b.b, t)) };
}

export class BaguaWheel {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * this._dpr;
    this.canvas.height = rect.height * this._dpr;
  }

  _center() {
    return { x: this.canvas.width / 2, y: this.canvas.height / 2 };
  }

  _radius() {
    return Math.min(this.canvas.width, this.canvas.height) * 0.38;
  }

  // Normalizes a canvas point's angle to 0..360, with 0 at the START_DEG
  // (screen-top / South) position, increasing clockwise.
  angleOf(cx, cy) {
    const c = this._center();
    const raw = Math.atan2(cy - c.y, cx - c.x) * 180 / Math.PI; // -180..180, 0=right
    let deg = raw - START_DEG;
    deg = ((deg % 360) + 360) % 360;
    return deg;
  }

  radiusFractionOf(cx, cy) {
    const c = this._center();
    const d = Math.hypot(cx - c.x, cy - c.y);
    return Math.min(1, d / this._radius());
  }

  // Continuous pitch across the whole circle — no quantization to the 8
  // wedges. Exponential mapping so equal angular steps feel like equal
  // musical steps, not equal linear Hz steps.
  freqAt(angleDeg) {
    const t = angleDeg / 360;
    return BASE_FREQ * Math.pow(2, t * OCTAVES);
  }

  // The octave-drone partner: exactly 180° away, which — because the full
  // circle spans exactly OCTAVES=2 octaves — always lands exactly one
  // octave from the lead pitch. Guaranteed consonant, not by luck.
  droneFreqAt(angleDeg) {
    return this.freqAt((angleDeg + 180) % 360);
  }

  // Smoothly interpolated colour at a given angle, blending between the
  // two nearest wedges rather than hard-switching at the boundary — the
  // colour glides the same way the pitch does.
  colorAt(angleDeg) {
    const step = 360 / TRIGRAMS.length;
    const idx = angleDeg / step;
    const i0 = Math.floor(idx) % TRIGRAMS.length;
    const i1 = (i0 + 1) % TRIGRAMS.length;
    const frac = idx - Math.floor(idx);
    return lerpColor(RGB[i0], RGB[i1], frac);
  }

  trigramAt(angleDeg) {
    const step = 360 / TRIGRAMS.length;
    return TRIGRAMS[Math.floor(angleDeg / step) % TRIGRAMS.length];
  }

  // Draws a trigram's three lines centered at (cx, cy), reading bottom
  // ('lines[0]') to top ('lines[2]') as the tradition does. '1' = solid
  // (yang), '0' = broken/two segments with a gap (yin).
  _drawTrigramLines(lines, cx, cy, size) {
    const { ctx } = this;
    const barW = size * 1.6, barH = size * 0.22, gapY = size * 0.32, gapX = size * 0.22;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let row = 0; row < 3; row++) {
      const solid = lines[row] === '1';
      const y = cy + (1 - row) * gapY - barH / 2; // row 0 (bottom, largest y) drawn lowest
      if (solid) {
        ctx.fillRect(cx - barW / 2, y, barW, barH);
      } else {
        const seg = (barW - gapX) / 2;
        ctx.fillRect(cx - barW / 2, y, seg, barH);
        ctx.fillRect(cx + barW / 2 - seg, y, seg, barH);
      }
    }
  }

  // pitchHand / volumeHand: {x,y} in canvas-normalized coords, or null.
  draw(pitchHand, volumeHand, volumeLevel) {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const c = this._center();
    const r = this._radius();
    const step = 360 / TRIGRAMS.length;

    TRIGRAMS.forEach((t, i) => {
      const a0 = (START_DEG + i * step) * Math.PI / 180;
      const a1 = (START_DEG + (i + 1) * step) * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.arc(c.x, c.y, r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.5;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(10,10,12,0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Trigram line pattern + label, mid-wedge. Drawn as actual bars from
      // t.lines (bottom-to-top, '1'=solid/yang, '0'=broken/yin) rather than
      // the Unicode hexagram glyph — font coverage for U+2630-2637 is
      // inconsistent across systems, and this lets the broken/solid
      // distinction always read clearly regardless of what's installed.
      const midA = (a0 + a1) / 2;
      const lx = c.x + Math.cos(midA) * r * 0.72;
      const ly = c.y + Math.sin(midA) * r * 0.72;
      this._drawTrigramLines(t.lines, lx, ly, r * 0.11);
      ctx.textAlign = 'center';
      ctx.font = `${Math.round(r * 0.05)}px sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(`${t.name} · ${t.element}`, lx, ly + r * 0.2);
    });

    // Centre point — the Taiji, traditionally the still point all change
    // moves around.
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * 0.04, 0, Math.PI * 2);
    ctx.fillStyle = '#f2d98a';
    ctx.fill();

    if (pitchHand) {
      const angle = this.angleOf(pitchHand.x * canvas.width, pitchHand.y * canvas.height);
      const col = this.colorAt(angle);
      const px = pitchHand.x * canvas.width, py = pitchHand.y * canvas.height;
      const rr = r * 0.06;
      ctx.save();
      const grad = ctx.createRadialGradient(px, py, 0, px, py, rr * 2.5);
      grad.addColorStop(0, `rgba(${col.r},${col.g},${col.b},0.9)`);
      grad.addColorStop(1, `rgba(${col.r},${col.g},${col.b},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, rr * 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgb(${col.r},${col.g},${col.b})`;
      ctx.beginPath();
      ctx.arc(px, py, rr * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Volume hand: a vertical meter beside wherever that hand is, height
    // of the fill showing the current loudness rather than a dot, since
    // the parameter it controls (loudness) isn't spatial the way pitch is.
    if (volumeHand) {
      const vx = volumeHand.x * canvas.width;
      const meterH = canvas.height * 0.28, meterW = canvas.width * 0.012;
      const meterY = volumeHand.y * canvas.height - meterH / 2;
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(vx - meterW / 2, meterY, meterW, meterH);
      const fillH = meterH * (volumeLevel ?? 0);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(vx - meterW / 2, meterY + (meterH - fillH), meterW, fillH);
      ctx.restore();
    }
  }
}

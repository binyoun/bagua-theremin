// BaguaDisc.js — the Bagua rendered as a real 3D object: a traditional
// bagua mirror (八卦鏡), a round mirrored centre plate ringed by eight
// wedge-shaped panels, each carrying its trigram's actual line pattern as
// raised, embossed bars — not a flat drawn glyph. Same Three.js/PMREM
// pattern as the other 2026 AR pieces (camera passthrough behind a
// transparent WebGL canvas, ACES tone mapping, RoomEnvironment for
// reflections on the metal/water materials).
//
// The disc slowly self-rotates around its own face-normal axis (a mounted
// mirror slowly turning), so the interaction math tracks that rotation
// offset when converting a hand's screen angle into "which trigram is
// here right now" — the wedges move, the meaning of a given screen angle
// moves with them.
//
// Pure data/math (TRIGRAMS, freqAt, droneFreqAt, colorAt, trigramAt) has
// no Three.js dependency and is unchanged in spirit from the flat version.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const TRIGRAMS = [
  { name: 'Li',   lines: '101', direction: 'South',     element: 'Fire',    color: 0xc4342b, roughness: 0.40, metalness: 0.10, emissive: 0x4a0f0a },
  { name: 'Kun',  lines: '000', direction: 'Southwest', element: 'Earth',   color: 0x8b6b3d, roughness: 0.90, metalness: 0.05, emissive: 0x1a1207 },
  { name: 'Dui',  lines: '110', direction: 'West',      element: 'Metal',   color: 0xc9d6dc, roughness: 0.25, metalness: 0.85, emissive: 0x0a0c0d },
  { name: 'Qian', lines: '111', direction: 'Northwest', element: 'Heaven',  color: 0xe8e8ec, roughness: 0.15, metalness: 0.90, emissive: 0x0c0c0d },
  { name: 'Kan',  lines: '010', direction: 'North',     element: 'Water',   color: 0x1c2b3a, roughness: 0.20, metalness: 0.30, emissive: 0x030a12 },
  { name: 'Gen',  lines: '001', direction: 'Northeast', element: 'Mountain',color: 0x6b5d52, roughness: 0.85, metalness: 0.05, emissive: 0x120f0c },
  { name: 'Zhen', lines: '100', direction: 'East',      element: 'Thunder', color: 0x3d8b37, roughness: 0.55, metalness: 0.05, emissive: 0x0a1a08 },
  { name: 'Xun',  lines: '011', direction: 'Southeast', element: 'Wind',    color: 0x6fa88a, roughness: 0.60, metalness: 0.05, emissive: 0x0d1a14 },
];

const OCTAVES = 2;
const BASE_FREQ = 110;

export function freqAt(angleDeg) {
  return BASE_FREQ * Math.pow(2, (angleDeg / 360) * OCTAVES);
}
export function droneFreqAt(angleDeg) {
  return freqAt((angleDeg + 180) % 360);
}
export function trigramIndexAt(angleDeg) {
  const step = 360 / TRIGRAMS.length;
  return Math.floor(((angleDeg % 360) + 360) % 360 / step) % TRIGRAMS.length;
}

const OUTER_R = 1;
const INNER_R = 0.32;
const DEPTH = 0.09;

function buildWedgeGeometry(a0, a1) {
  const shape = new THREE.Shape();
  shape.moveTo(INNER_R * Math.cos(a0), INNER_R * Math.sin(a0));
  shape.lineTo(OUTER_R * Math.cos(a0), OUTER_R * Math.sin(a0));
  shape.absarc(0, 0, OUTER_R, a0, a1, false);
  shape.lineTo(INNER_R * Math.cos(a1), INNER_R * Math.sin(a1));
  shape.absarc(0, 0, INNER_R, a1, a0, true);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, {
    depth: DEPTH, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2,
  });
}

// A pivot at (radius, midAngle) on the disc face, rotated so its local X
// axis runs tangentially — bars/segments are simple children offset along
// that local X, so "solid" vs "broken" is just how many children exist.
function buildLineRow(midAngle, radius, arcWidth, solid) {
  const pivot = new THREE.Group();
  pivot.position.set(radius * Math.cos(midAngle), radius * Math.sin(midAngle), DEPTH + 0.006);
  pivot.rotation.z = midAngle + Math.PI / 2;

  const barMat = new THREE.MeshStandardMaterial({ color: 0xd8c48a, roughness: 0.3, metalness: 0.8, emissive: 0x3a2f14 });
  const barH = 0.05, barD = 0.012;

  if (solid) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(arcWidth, barH, barD), barMat);
    pivot.add(bar);
  } else {
    const gap = arcWidth * 0.28;
    const segLen = (arcWidth - gap) / 2;
    const segGeo = new THREE.BoxGeometry(segLen, barH, barD);
    const left = new THREE.Mesh(segGeo, barMat);
    left.position.x = -(gap / 2 + segLen / 2);
    const right = new THREE.Mesh(segGeo, barMat);
    right.position.x = gap / 2 + segLen / 2;
    pivot.add(left, right);
  }
  return pivot;
}

export class BaguaDisc {
  constructor(canvas, videoEl) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 0, 3.4);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xfff2df, 1.3);
    key.position.set(2, 3, 3);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x8fd0ff, 0.6);
    rim.position.set(-2, -1, 2);
    this.scene.add(rim);

    this.group = new THREE.Group();
    this.scene.add(this.group);
    this._buildDisc();

    this._rotation = 0; // radians, current self-rotation offset
    this._t = 0;

    window.addEventListener('resize', () => this._resize());
    this._resize();
  }

  _buildDisc() {
    const step = (Math.PI * 2) / TRIGRAMS.length;
    this.wedgeMats = [];

    TRIGRAMS.forEach((tri, i) => {
      const a0 = -Math.PI / 2 + i * step; // -90° = screen-top start, matches the flat version
      const a1 = a0 + step;
      const mat = new THREE.MeshStandardMaterial({
        color: tri.color, roughness: tri.roughness, metalness: tri.metalness,
        emissive: tri.emissive, emissiveIntensity: 1,
      });
      this.wedgeMats.push(mat);
      const mesh = new THREE.Mesh(buildWedgeGeometry(a0, a1), mat);
      this.group.add(mesh);

      const mid = (a0 + a1) / 2;
      const midR = (INNER_R + OUTER_R) / 2;
      const arcSpan = step * midR * 0.62; // leaves margin from the wedge edges
      const rows = [midR - 0.16, midR, midR + 0.16];
      for (let row = 0; row < 3; row++) {
        this.group.add(buildLineRow(mid, rows[row], arcSpan, tri.lines[row] === '1'));
      }
    });

    // Mirror centre — the traditional bagua mirror's namesake feature.
    const mirror = new THREE.Mesh(
      new THREE.CylinderGeometry(INNER_R * 0.94, INNER_R * 0.94, DEPTH * 0.9, 48).rotateX(Math.PI / 2),
      new THREE.MeshPhysicalMaterial({ color: 0xdfe6e8, roughness: 0.04, metalness: 1, clearcoat: 1 })
    );
    mirror.position.z = DEPTH * 0.05;
    this.group.add(mirror);

    // Rim
    const rimMesh = new THREE.Mesh(
      new THREE.TorusGeometry(OUTER_R, 0.02, 12, 64),
      new THREE.MeshStandardMaterial({ color: 0x2a1c10, roughness: 0.4, metalness: 0.6 })
    );
    rimMesh.position.z = DEPTH / 2;
    this.group.add(rimMesh);
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // Screen-normalized (0..1) circle the disc currently projects to —
  // recomputed live (not cached) since the disc gently bobs.
  _screenCircle() {
    const center = new THREE.Vector3(0, 0, 0).applyMatrix4(this.group.matrixWorld).project(this.camera);
    const edge = new THREE.Vector3(OUTER_R, 0, 0).applyMatrix4(this.group.matrixWorld).project(this.camera);
    const toPx = (v) => ({ x: (v.x + 1) / 2, y: (1 - v.y) / 2 });
    const c = toPx(center), e = toPx(edge);
    return { cx: c.x, cy: c.y, r: Math.hypot(e.x - c.x, e.y - c.y) };
  }

  // canvas-normalized (0..1) point -> {angleDeg (0=South wedge start,
  // clockwise, already compensated for the disc's current rotation),
  // radiusFraction}.
  pointerToDisc(nx, ny) {
    const circ = this._screenCircle();
    const dx = nx - circ.cx, dy = ny - circ.cy;
    const rawDeg = Math.atan2(dy, dx) * 180 / Math.PI;
    // Compensate for the disc's own rotation so the mapping tracks the
    // wedges' current world orientation, not their rest position.
    const compensated = rawDeg + (this._rotation * 180 / Math.PI);
    let deg = compensated - (-90); // shift so 0 = the South/Li wedge start
    deg = ((deg % 360) + 360) % 360;
    const radiusFraction = Math.min(1, Math.hypot(dx, dy) / Math.max(0.001, circ.r));
    return { angleDeg: deg, radiusFraction };
  }

  update(dt, pitchAngleDeg, isActive) {
    this._t += dt;
    this._rotation += dt * (Math.PI * 2) / 40; // one full turn per 40s
    this.group.rotation.z = this._rotation;
    this.group.position.y = Math.sin(this._t * 0.6) * 0.04;
    this.group.rotation.x = Math.sin(this._t * 0.35) * 0.03;

    const step = 360 / TRIGRAMS.length;
    this.wedgeMats.forEach((mat, i) => {
      if (!isActive) { mat.emissiveIntensity = 1; return; }
      const wedgeMid = i * step + step / 2;
      let d = Math.abs(pitchAngleDeg - wedgeMid);
      d = Math.min(d, 360 - d);
      const closeness = Math.max(0, 1 - d / (step * 1.3));
      mat.emissiveIntensity = 1 + closeness * 5;
    });

    this.renderer.render(this.scene, this.camera);
  }
}

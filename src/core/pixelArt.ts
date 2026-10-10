import * as THREE from 'three';

/** Creates a crisp, non-blurred canvas 2D context at the given pixel size. */
function makeCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

interface TextureOptions {
  repeat?: boolean;
  transparent?: boolean;
}

function toTexture(canvas: HTMLCanvasElement, opts: TextureOptions = {}): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  if (opts.repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.needsUpdate = true;
  return tex;
}

/** Draws a blocky helmet+armor knight silhouette, NES "Wizards & Warriors" style, facing right. */
export function buildKnightTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(16, 24);
  const px = (x: number, y: number, w: number, h: number, color: string) => ctx.fillRect(x, y, w, h);
  void px;

  // Helmet (silver) with a dark visor slit and a small red plume on top.
  ctx.fillStyle = '#d23b3b';
  ctx.fillRect(6, 0, 4, 2);
  ctx.fillStyle = '#c7cdd6';
  ctx.fillRect(4, 2, 9, 2);
  ctx.fillRect(3, 4, 11, 3);
  ctx.fillStyle = '#2b2f36';
  ctx.fillRect(10, 5, 3, 1);
  // Face sliver under the helmet.
  ctx.fillStyle = '#f0b98a';
  ctx.fillRect(4, 6, 3, 2);

  // Torso armor (steel blue) with a gold belt line.
  ctx.fillStyle = '#3a5fb0';
  ctx.fillRect(3, 8, 10, 7);
  ctx.fillStyle = '#26407a';
  ctx.fillRect(3, 8, 10, 2);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(3, 14, 10, 1);

  // Arm + sword hand reaching forward (right side = facing direction).
  ctx.fillStyle = '#3a5fb0';
  ctx.fillRect(12, 9, 2, 4);
  ctx.fillStyle = '#e4e8ee';
  ctx.fillRect(13, 6, 2, 8);
  ctx.fillStyle = '#8a6a2a';
  ctx.fillRect(12, 12, 3, 2);

  // Legs / boots.
  ctx.fillStyle = '#26407a';
  ctx.fillRect(4, 15, 3, 5);
  ctx.fillRect(9, 15, 3, 5);
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(3, 20, 4, 3);
  ctx.fillRect(8, 20, 4, 3);

  return toTexture(canvas, { transparent: true });
}

/** Simple squat green slime enemy with two eyes, or a red variant for visual variety. */
export function buildSlimeTexture(color: 'green' | 'red'): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(16, 16);
  const body = color === 'green' ? '#2f9e44' : '#c92a2a';
  const shade = color === 'green' ? '#1f7a33' : '#8f1f1f';

  ctx.fillStyle = body;
  ctx.fillRect(2, 6, 12, 8);
  ctx.fillRect(3, 4, 10, 2);
  ctx.fillRect(4, 2, 8, 2);
  ctx.fillStyle = shade;
  ctx.fillRect(2, 12, 12, 2);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(5, 8, 2, 3);
  ctx.fillRect(9, 8, 2, 3);
  ctx.fillStyle = '#0b0b0b';
  ctx.fillRect(5, 9, 1, 1);
  ctx.fillRect(9, 9, 1, 1);

  return toTexture(canvas, { transparent: true });
}

/** 16x16 tileable grass-over-dirt ground texture. */
export function buildGroundTileTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(16, 16);
  ctx.fillStyle = '#6b4226';
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = '#5a361e';
  ctx.fillRect(0, 8, 16, 8);
  ctx.fillStyle = '#48bf53';
  ctx.fillRect(0, 0, 16, 5);
  ctx.fillStyle = '#3a9942';
  ctx.fillRect(0, 4, 16, 2);
  // A few dirt speckles for texture.
  ctx.fillStyle = '#3f2616';
  ctx.fillRect(3, 11, 2, 2);
  ctx.fillRect(10, 9, 2, 2);
  return toTexture(canvas, { repeat: true });
}

/** 16x16 tileable wooden-plank texture for floating platforms. */
export function buildPlatformTileTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(16, 16);
  ctx.fillStyle = '#9a6a35';
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = '#7a4e24';
  ctx.fillRect(0, 0, 16, 2);
  ctx.fillRect(0, 7, 16, 2);
  ctx.fillRect(0, 14, 16, 2);
  ctx.fillStyle = '#5c3a1a';
  ctx.fillRect(5, 2, 1, 5);
  ctx.fillRect(11, 9, 1, 5);
  return toTexture(canvas, { repeat: true });
}

/** Vertical sky gradient with a couple of soft clouds for the on-foot segment background. */
export function buildSkyTexture(variant: 'day' | 'dusk' | 'night' = 'day'): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(64, 64);
  const grad = ctx.createLinearGradient(0, 0, 0, 64);
  if (variant === 'day') {
    grad.addColorStop(0, '#2c5fb0');
    grad.addColorStop(1, '#8fc4e8');
  } else if (variant === 'dusk') {
    grad.addColorStop(0, '#2a1f4d');
    grad.addColorStop(0.55, '#8a3f5a');
    grad.addColorStop(1, '#e08a4f');
  } else {
    grad.addColorStop(0, '#050816');
    grad.addColorStop(1, '#141a33');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  if (variant === 'night') {
    ctx.fillStyle = '#fefbe0';
    for (let i = 0; i < 18; i++) {
      const x = Math.floor(Math.random() * 64);
      const y = Math.floor(Math.random() * 40);
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.fillStyle = '#f2eec2';
    ctx.fillRect(46, 8, 8, 8);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(8, 14, 14, 4);
    ctx.fillRect(12, 10, 8, 4);
    ctx.fillRect(38, 24, 16, 4);
    ctx.fillRect(42, 20, 8, 4);
  }
  return toTexture(canvas);
}

/** A simple checkered/panel floor texture evoking the arcade Zaxxon base runway. */
export function buildZaxxonFloorTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(32, 32);
  ctx.fillStyle = '#123a24';
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = '#1c5234';
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillRect(16, 16, 16, 16);
  ctx.strokeStyle = '#2f7a4a';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, 31, 31);
  return toTexture(canvas, { repeat: true });
}

/** Brushed-metal panel texture for Zaxxon walls/pillars. */
export function buildPanelTexture(baseColor: string, lineColor: string): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(16, 16);
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = lineColor;
  ctx.fillRect(0, 0, 16, 1);
  ctx.fillRect(0, 8, 16, 1);
  ctx.fillRect(0, 0, 1, 16);
  ctx.fillRect(8, 0, 1, 16);
  return toTexture(canvas, { repeat: true });
}

/** Deep-space gradient with scattered nebula-colored dots, used as a scene background texture. */
export function buildNebulaTexture(tint: 'blue' | 'orange'): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(256, 256);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  if (tint === 'blue') {
    grad.addColorStop(0, '#05060f');
    grad.addColorStop(0.5, '#0a1030');
    grad.addColorStop(1, '#140a24');
  } else {
    grad.addColorStop(0, '#060608');
    grad.addColorStop(0.5, '#1a0f12');
    grad.addColorStop(1, '#241208');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const cloudColor = tint === 'blue' ? '68,90,200' : '200,90,60';
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 10 + Math.random() * 40;
    const grad2 = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad2.addColorStop(0, `rgba(${cloudColor},0.12)`);
    grad2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad2;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 200; i++) {
    const x = Math.floor(Math.random() * 256);
    const y = Math.floor(Math.random() * 256);
    const s = Math.random() < 0.85 ? 1 : 2;
    ctx.globalAlpha = 0.4 + Math.random() * 0.6;
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;

  return toTexture(canvas);
}

/** Diagonal yellow/black hazard-stripe texture for dangerous Zaxxon industrial surfaces. */
export function buildHazardStripeTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(16, 16);
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = '#ffcc00';
  // Four diagonal stripes drawn as thick parallelograms so the pattern tiles seamlessly.
  for (let i = -16; i < 32; i += 8) {
    ctx.beginPath();
    ctx.moveTo(i, 16);
    ctx.lineTo(i + 16, 0);
    ctx.lineTo(i + 20, 0);
    ctx.lineTo(i + 4, 16);
    ctx.closePath();
    ctx.fill();
  }
  return toTexture(canvas, { repeat: true });
}

/** Small 8x8 spinning gold coin frame; call twice with `frame` 0/1 for a shimmer animation. */
export function buildCoinTexture(frame: 0 | 1 = 0): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(8, 8);
  const rimWidth = frame === 0 ? 3 : 1;
  ctx.fillStyle = '#8a6a1a';
  ctx.fillRect(4 - rimWidth / 2, 1, Math.max(rimWidth, 1), 6);
  ctx.fillStyle = '#ffd94a';
  ctx.fillRect(1, 1, 6, 6);
  ctx.fillStyle = '#fff3b0';
  ctx.fillRect(2, 2, 3, 2);
  ctx.fillStyle = '#b8860b';
  ctx.fillRect(1, 6, 6, 1);
  return toTexture(canvas, { transparent: true });
}

/** A wide, tileable layered-silhouette mountain band for on-foot parallax backgrounds. */
export function buildMountainBandTexture(variant: 'day' | 'dusk' | 'night'): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(256, 64);
  const color =
    variant === 'day' ? '#2f6f4e' : variant === 'dusk' ? '#4a2f63' : '#131a33';
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 64);
  const peaks = 6;
  for (let i = 0; i <= peaks; i++) {
    const x = (i / peaks) * 256;
    const y = 64 - (18 + Math.sin(i * 1.7) * 10 + ((i % 2) * 8));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(256, 64);
  ctx.closePath();
  ctx.fill();
  return toTexture(canvas, { repeat: true });
}

/** Bright, high-contrast two-tone checkerboard ground, the signature Space Harrier floor. */
export function buildCheckerGroundTexture(tint: 'blue' | 'orange'): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(16, 16);
  const [a, b] = tint === 'blue' ? ['#ff3355', '#ffffff'] : ['#ff8a1f', '#ffe9b0'];
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = b;
  ctx.fillRect(0, 0, 8, 8);
  ctx.fillRect(8, 8, 8, 8);
  return toTexture(canvas, { repeat: true });
}

/** Bright arcade sky gradient with a glowing horizon sun, Space-Harrier style (not deep-space). */
export function buildArcadeSkyTexture(tint: 'blue' | 'orange'): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(256, 256);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  if (tint === 'blue') {
    grad.addColorStop(0, '#1a3fd6');
    grad.addColorStop(0.55, '#4a8ef0');
    grad.addColorStop(0.72, '#bfe3ff');
    grad.addColorStop(1, '#eafcff');
  } else {
    grad.addColorStop(0, '#7a1a6a');
    grad.addColorStop(0.5, '#e04a3f');
    grad.addColorStop(0.75, '#ffb23f');
    grad.addColorStop(1, '#fff3c2');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Glowing sun disc sitting on the horizon band.
  const sunColor = tint === 'blue' ? '255,240,200' : '255,255,220';
  const sunY = 185;
  const sunGlow = ctx.createRadialGradient(128, sunY, 0, 128, sunY, 90);
  sunGlow.addColorStop(0, `rgba(${sunColor},0.9)`);
  sunGlow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(0, sunY - 90, 256, 180);
  ctx.fillStyle = tint === 'blue' ? '#fff9e0' : '#fff6cf';
  ctx.beginPath();
  ctx.arc(128, sunY, 46, 0, Math.PI * 2);
  ctx.fill();

  // A couple of flat cloud/mesa silhouettes for depth near the horizon.
  ctx.fillStyle = tint === 'blue' ? 'rgba(255,255,255,0.8)' : 'rgba(120,40,60,0.5)';
  ctx.fillRect(10, 170, 60, 10);
  ctx.fillRect(190, 160, 56, 8);
  return toTexture(canvas);
}

/** Small billboard "alien" creature sprite for Space-Harrier-style floating enemies. */
export function buildAlienSpriteTexture(variant: 'blue' | 'red'): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(16, 16);
  const body = variant === 'blue' ? '#3fd0ff' : '#ff4466';
  const dark = variant === 'blue' ? '#1a6fa0' : '#a01030';

  ctx.fillStyle = body;
  ctx.fillRect(4, 2, 8, 2);
  ctx.fillRect(2, 4, 12, 7);
  ctx.fillRect(4, 11, 8, 2);
  ctx.fillStyle = dark;
  ctx.fillRect(2, 9, 12, 2);
  // Wing fins.
  ctx.fillStyle = dark;
  ctx.fillRect(0, 6, 3, 3);
  ctx.fillRect(13, 6, 3, 3);
  // Eyes.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(5, 6, 2, 3);
  ctx.fillRect(9, 6, 2, 3);
  ctx.fillStyle = '#0b0b0b';
  ctx.fillRect(5, 7, 1, 1);
  ctx.fillRect(9, 7, 1, 1);

  return toTexture(canvas, { transparent: true });
}

export type DungeonTint = 'stone' | 'moss' | 'fire' | 'ice' | 'shadow';

const DUNGEON_PALETTE: Record<DungeonTint, { base: string; dark: string; crack: string }> = {
  stone: { base: '#8a8a92', dark: '#5c5c66', crack: '#454650' },
  moss: { base: '#6e8a5a', dark: '#44593a', crack: '#2d3a26' },
  fire: { base: '#9a4630', dark: '#5e2719', crack: '#2e1210' },
  ice: { base: '#6f9ecf', dark: '#3f5f87', crack: '#28394f' },
  shadow: { base: '#403a4d', dark: '#241f2e', crack: '#120f18' },
};

/** Isometric dungeon floor stone tile, tinted per-level for mood (The Immortal style). */
export function buildDungeonFloorTexture(tint: DungeonTint): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(16, 16);
  const p = DUNGEON_PALETTE[tint];
  ctx.fillStyle = p.base;
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = p.dark;
  ctx.fillRect(0, 0, 16, 1);
  ctx.fillRect(0, 0, 1, 16);
  ctx.fillRect(8, 0, 1, 16);
  ctx.fillRect(0, 8, 16, 1);
  ctx.fillStyle = p.crack;
  ctx.fillRect(3, 3, 1, 1);
  ctx.fillRect(11, 10, 1, 1);
  ctx.fillRect(6, 12, 2, 1);
  return toTexture(canvas, { repeat: true });
}

/** Raised stone wall block texture, tinted per-level to match the floor palette. */
export function buildDungeonWallTexture(tint: DungeonTint): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(16, 16);
  const p = DUNGEON_PALETTE[tint];
  ctx.fillStyle = p.dark;
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = p.base;
  ctx.fillRect(0, 0, 7, 6);
  ctx.fillRect(8, 0, 8, 6);
  ctx.fillRect(0, 7, 7, 6);
  ctx.fillRect(8, 7, 8, 6);
  ctx.fillStyle = p.crack;
  ctx.fillRect(0, 6, 16, 1);
  ctx.fillRect(0, 13, 16, 1);
  ctx.fillRect(7, 0, 1, 6);
  ctx.fillRect(7, 7, 1, 6);
  return toTexture(canvas, { repeat: true });
}

/** Dark bottomless pit tile with a faint jagged edge, a fall hazard in the dungeon crawler. */
export function buildDungeonPitTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(16, 16);
  ctx.fillStyle = '#05050a';
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = '#17141f';
  ctx.fillRect(1, 1, 14, 1);
  ctx.fillRect(1, 1, 1, 14);
  ctx.fillRect(14, 1, 1, 14);
  ctx.fillRect(1, 14, 14, 1);
  return toTexture(canvas, { repeat: true });
}

/** Glowing exit-stairway tile marking the way to the next dungeon level. */
export function buildDungeonExitTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(16, 16);
  ctx.fillStyle = '#2a2033';
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = '#ffdf7a';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(2 + i, 12 - i * 3, 12 - i * 2, 2);
  }
  return toTexture(canvas);
}

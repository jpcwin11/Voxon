import * as THREE from 'three';
import type { GameMode, ModeContext } from '../core/types';
import {
  buildGroundTileTexture,
  buildKnightTexture,
  buildPlatformTileTexture,
  buildSkyTexture,
  buildSlimeTexture,
} from '../core/pixelArt';

interface Platform {
  x1: number;
  x2: number;
  y: number;
  mesh: THREE.Mesh;
}

interface EnemySpawn {
  x: number;
  patrolMin: number;
  patrolMax: number;
  variant: 'green' | 'red';
  hp: number;
}

interface Enemy {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  dir: number;
  patrolMin: number;
  patrolMax: number;
  hp: number;
  hitCooldown: number;
  alive: boolean;
}

interface OnFootLevelConfig {
  name: string;
  length: number;
  /** Ground strips the player can stand on; gaps between them are pits. */
  groundSegments: Array<[number, number]>;
  /** Floating platforms: [x1, x2, y]. */
  platforms: Array<[number, number, number]>;
  enemies: EnemySpawn[];
  sky: 'day' | 'dusk' | 'night';
}

const LEVELS: OnFootLevelConfig[] = [
  {
    name: 'Village Outskirts',
    length: 1400,
    groundSegments: [
      [0, 420],
      [480, 760],
      [820, 1180],
      [1260, 1600],
    ],
    platforms: [[560, 700, 90]],
    enemies: [
      { x: 300, patrolMin: 120, patrolMax: 420, variant: 'green', hp: 1 },
      { x: 900, patrolMin: 820, patrolMax: 1180, variant: 'green', hp: 1 },
      { x: 1350, patrolMin: 1260, patrolMax: 1600, variant: 'green', hp: 1 },
    ],
    sky: 'day',
  },
  {
    name: 'Dark Forest',
    length: 1700,
    groundSegments: [
      [0, 380],
      [440, 700],
      [760, 1000],
      [1080, 1360],
      [1420, 1900],
    ],
    platforms: [
      [500, 640, 90],
      [1150, 1280, 110],
    ],
    enemies: [
      { x: 260, patrolMin: 120, patrolMax: 380, variant: 'green', hp: 1 },
      { x: 850, patrolMin: 760, patrolMax: 1000, variant: 'red', hp: 1 },
      { x: 1200, patrolMin: 1080, patrolMax: 1360, variant: 'green', hp: 1 },
      { x: 1650, patrolMin: 1420, patrolMax: 1900, variant: 'red', hp: 1 },
    ],
    sky: 'day',
  },
  {
    name: 'Mountain Pass',
    length: 2000,
    groundSegments: [
      [0, 340],
      [400, 600],
      [660, 860],
      [920, 1120],
      [1200, 1420],
      [1480, 2200],
    ],
    platforms: [
      [420, 540, 90],
      [700, 800, 130],
      [960, 1080, 90],
      [1240, 1380, 150],
    ],
    enemies: [
      { x: 220, patrolMin: 120, patrolMax: 340, variant: 'green', hp: 1 },
      { x: 500, patrolMin: 420, patrolMax: 540, variant: 'red', hp: 1 },
      { x: 980, patrolMin: 920, patrolMax: 1120, variant: 'green', hp: 1 },
      { x: 1300, patrolMin: 1240, patrolMax: 1380, variant: 'red', hp: 1 },
      { x: 1700, patrolMin: 1480, patrolMax: 1950, variant: 'green', hp: 1 },
    ],
    sky: 'dusk',
  },
  {
    name: 'Crumbling Keep',
    length: 2300,
    groundSegments: [
      [0, 300],
      [360, 520],
      [580, 720],
      [780, 920],
      [980, 1120],
      [1180, 1340],
      [1400, 2400],
    ],
    platforms: [
      [340, 440, 100],
      [560, 650, 140],
      [760, 850, 100],
      [960, 1050, 140],
      [1160, 1260, 100],
    ],
    enemies: [
      { x: 200, patrolMin: 120, patrolMax: 300, variant: 'red', hp: 1 },
      { x: 450, patrolMin: 360, patrolMax: 520, variant: 'green', hp: 1 },
      { x: 650, patrolMin: 580, patrolMax: 720, variant: 'red', hp: 1 },
      { x: 850, patrolMin: 780, patrolMax: 920, variant: 'green', hp: 1 },
      { x: 1050, patrolMin: 980, patrolMax: 1120, variant: 'red', hp: 1 },
      { x: 1700, patrolMin: 1400, patrolMax: 2200, variant: 'green', hp: 1 },
    ],
    sky: 'night',
  },
  {
    name: "Dragon's Approach",
    length: 2600,
    groundSegments: [
      [0, 300],
      [370, 500],
      [570, 700],
      [770, 900],
      [970, 1100],
      [1170, 1300],
      [1370, 1550],
      [1620, 2700],
    ],
    platforms: [
      [330, 430, 100],
      [530, 620, 150],
      [730, 820, 100],
      [930, 1020, 150],
      [1130, 1220, 100],
      [1500, 1620, 130],
    ],
    enemies: [
      { x: 180, patrolMin: 120, patrolMax: 300, variant: 'green', hp: 1 },
      { x: 420, patrolMin: 370, patrolMax: 500, variant: 'red', hp: 1 },
      { x: 630, patrolMin: 570, patrolMax: 700, variant: 'green', hp: 1 },
      { x: 830, patrolMin: 770, patrolMax: 900, variant: 'red', hp: 1 },
      { x: 1030, patrolMin: 970, patrolMax: 1100, variant: 'green', hp: 1 },
      { x: 1230, patrolMin: 1170, patrolMax: 1300, variant: 'red', hp: 1 },
      { x: 2100, patrolMin: 1700, patrolMax: 2500, variant: 'red', hp: 3 },
    ],
    sky: 'night',
  },
];

const SCREEN_W = 256;
const SCREEN_H = 224;
const GROUND_Y = 32;
const GRAVITY = 520;
const JUMP_VELOCITY = 230;
const RUN_SPEED = 90;
const PLAYER_W = 14;
const PLAYER_H = 22;

/**
 * NES "Wizards & Warriors"-style on-foot segment: the ship has landed and the pilot explores
 * on a flat, blocky side view at native 256x224 NES resolution (upscaled with nearest-neighbor
 * filtering elsewhere) with run/jump platforming, pits, and simple melee-or-die enemies.
 */
export class OnFootMode implements GameMode {
  readonly id = 'onfoot';
  readonly label = 'ON FOOT';
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(0, SCREEN_W, SCREEN_H, 0, -10, 10);
  readonly pixelWidth = SCREEN_W;
  readonly pixelHeight = SCREEN_H;

  private knightTex = buildKnightTexture();
  private slimeTex: Record<'green' | 'red', THREE.CanvasTexture> = {
    green: buildSlimeTexture('green'),
    red: buildSlimeTexture('red'),
  };
  private groundTex = buildGroundTileTexture();
  private platformTex = buildPlatformTileTexture();
  private skyTextures: Record<'day' | 'dusk' | 'night', THREE.CanvasTexture> = {
    day: buildSkyTexture('day'),
    dusk: buildSkyTexture('dusk'),
    night: buildSkyTexture('night'),
  };

  private player = new THREE.Mesh(
    new THREE.PlaneGeometry(PLAYER_W, PLAYER_H),
    new THREE.MeshBasicMaterial({ map: this.knightTex, transparent: true, depthWrite: false }),
  );
  private playerX = 24;
  private playerY = GROUND_Y + PLAYER_H / 2;
  private velY = 0;
  private onGround = false;
  private facing = 1;
  private attackFlashTime = 0;
  private invuln = 0;
  private scrollX = 0;
  private platforms: Platform[] = [];
  private enemies: Enemy[] = [];
  private flag!: THREE.Mesh;
  private levelObjects: THREE.Object3D[] = [];
  private config: OnFootLevelConfig = LEVELS[0];
  private finished = false;

  constructor() {
    this.scene.add(this.player);
  }

  levelName(level: number): string {
    return LEVELS[level].name;
  }

  private clearLevel(): void {
    for (const obj of this.levelObjects) this.scene.remove(obj);
    this.levelObjects = [];
    this.platforms = [];
    this.enemies = [];
  }

  private buildLevel(config: OnFootLevelConfig): void {
    this.clearLevel();
    this.scene.background = this.skyTextures[config.sky];

    const hillColor = config.sky === 'night' ? 0x16213a : config.sky === 'dusk' ? 0x4a3060 : 0x2f5f9e;
    for (let i = 0; i < 10; i++) {
      const hill = new THREE.Mesh(
        new THREE.CircleGeometry(60, 10),
        new THREE.MeshBasicMaterial({ color: hillColor }),
      );
      hill.position.set(i * 300, 20, -1);
      this.scene.add(hill);
      this.levelObjects.push(hill);
    }

    const groundMat = new THREE.MeshBasicMaterial({ map: this.groundTex });
    for (const [x1, x2] of config.groundSegments) {
      const width = x2 - x1;
      const tex = this.groundTex.clone();
      tex.repeat.set(width / 16, GROUND_Y / 16);
      tex.needsUpdate = true;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, GROUND_Y),
        new THREE.MeshBasicMaterial({ map: tex }),
      );
      mesh.position.set(x1 + width / 2, GROUND_Y / 2, -0.5);
      this.scene.add(mesh);
      this.levelObjects.push(mesh);
      this.platforms.push({ x1, x2, y: GROUND_Y, mesh });
    }
    void groundMat;

    for (const [x1, x2, y] of config.platforms) {
      const width = x2 - x1;
      const tex = this.platformTex.clone();
      tex.repeat.set(width / 16, 1);
      tex.needsUpdate = true;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, 12),
        new THREE.MeshBasicMaterial({ map: tex }),
      );
      mesh.position.set(x1 + width / 2, y, -0.3);
      this.scene.add(mesh);
      this.levelObjects.push(mesh);
      this.platforms.push({ x1, x2, y: y + 6, mesh });
    }

    for (const spawn of config.enemies) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 16),
        new THREE.MeshBasicMaterial({ map: this.slimeTex[spawn.variant], transparent: true, depthWrite: false }),
      );
      mesh.position.set(spawn.x, GROUND_Y + 8, 0);
      this.scene.add(mesh);
      this.levelObjects.push(mesh);
      this.enemies.push({
        mesh,
        x: spawn.x,
        y: GROUND_Y + 8,
        dir: 1,
        patrolMin: spawn.patrolMin,
        patrolMax: spawn.patrolMax,
        hp: spawn.hp,
        hitCooldown: 0,
        alive: true,
      });
    }

    this.flag = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 48),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    this.flag.position.set(config.length, GROUND_Y + 24, 0.1);
    this.scene.add(this.flag);
    this.levelObjects.push(this.flag);
  }

  enter(ctx: ModeContext, level: number): void {
    this.config = LEVELS[level] ?? LEVELS[0];
    this.buildLevel(this.config);

    this.playerX = 24;
    this.playerY = GROUND_Y + PLAYER_H / 2;
    this.velY = 0;
    this.onGround = true;
    this.invuln = 1;
    this.finished = false;
    void ctx;
  }

  resize(_width: number, _height: number): void {
    // Fixed NES-resolution orthographic camera never needs to change on resize.
  }

  update(dt: number, ctx: ModeContext): void {
    if (this.finished) return;
    const { input } = ctx;

    const moveX = input.axis(['ArrowLeft', 'KeyA'], ['ArrowRight', 'KeyD']);
    this.playerX += moveX * RUN_SPEED * dt;
    this.playerX = Math.max(10, this.playerX);
    if (moveX !== 0) this.facing = moveX > 0 ? 1 : -1;

    if (input.anyPressed(['Space', 'ArrowUp', 'KeyW']) && this.onGround) {
      this.velY = JUMP_VELOCITY;
      this.onGround = false;
    }

    this.velY -= GRAVITY * dt;
    this.playerY += this.velY * dt;

    this.onGround = false;
    for (const p of this.platforms) {
      if (this.playerX > p.x1 + 2 && this.playerX < p.x2 - 2) {
        const surfaceY = p.y + PLAYER_H / 2;
        if (this.velY <= 0 && this.playerY <= surfaceY && this.playerY > surfaceY - 14) {
          this.playerY = surfaceY;
          this.velY = 0;
          this.onGround = true;
        }
      }
    }

    if (this.playerY < -40) {
      // Fell into a pit.
      ctx.loseLife();
      this.playerX = Math.max(10, this.playerX - 60);
      this.playerY = GROUND_Y + PLAYER_H / 2;
      this.velY = 0;
      this.invuln = 1.5;
    }

    if (input.anyPressed(['KeyJ', 'ControlLeft'])) {
      this.attackFlashTime = 0.15;
    }
    if (this.attackFlashTime > 0) this.attackFlashTime -= dt;
    (this.player.material as THREE.MeshBasicMaterial).color.set(
      this.attackFlashTime > 0 ? 0x99ddff : 0xffffff,
    );

    this.updateEnemies(dt, ctx);

    if (this.invuln > 0) this.invuln -= dt;

    this.player.position.set(this.playerX, this.playerY, 0.2);
    this.player.scale.x = this.facing;

    this.scrollX = THREE.MathUtils.clamp(this.playerX - 80, 0, this.config.length - SCREEN_W + 200);
    this.camera.position.x = 0;
    this.camera.left = this.scrollX;
    this.camera.right = this.scrollX + SCREEN_W;
    this.camera.updateProjectionMatrix();

    if (this.playerX > this.config.length - 10) {
      this.finished = true;
      ctx.addScore(500);
      ctx.finish({ kind: 'advance' });
    }
  }

  private updateEnemies(dt: number, ctx: ModeContext): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.x += e.dir * 24 * dt;
      if (e.x < e.patrolMin || e.x > e.patrolMax) e.dir *= -1;
      e.mesh.position.x = e.x;
      e.mesh.scale.x = e.dir;
      if (e.hitCooldown > 0) e.hitCooldown -= dt;

      const dx = Math.abs(e.x - this.playerX);
      const dy = Math.abs(e.y - this.playerY);
      if (dx < 14 && dy < 18) {
        if (this.attackFlashTime > 0 && e.hitCooldown <= 0) {
          e.hitCooldown = 0.2;
          e.hp -= 1;
          if (e.hp <= 0) {
            e.alive = false;
            e.mesh.visible = false;
            ctx.addScore(e.hp <= -2 ? 300 : 75);
          }
        } else if (this.invuln <= 0 && this.attackFlashTime <= 0) {
          ctx.loseLife();
          this.invuln = 1.2;
          this.velY = JUMP_VELOCITY * 0.5;
          this.playerX -= this.facing * 10;
        }
      }
    }
  }

  exit(): void {
    // Level geometry is rebuilt fresh on each enter(); nothing to dispose here.
  }
}

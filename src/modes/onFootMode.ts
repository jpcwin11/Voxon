import * as THREE from 'three';
import type { GameMode, ModeContext } from '../core/types';
import {
  buildDungeonExitTexture,
  buildDungeonFloorTexture,
  buildDungeonPitTexture,
  buildDungeonWallTexture,
  buildKnightTexture,
  buildSlimeTexture,
  buildCoinTexture,
  type DungeonTint,
} from '../core/pixelArt';

type TileKind = 'floor' | 'wall' | 'pit' | 'exit';

interface EnemySpawn {
  gx: number;
  gz: number;
  axis: 'x' | 'z';
  range: number;
  variant: 'green' | 'red';
  hp: number;
}

interface Enemy {
  mesh: THREE.Mesh;
  shadow: THREE.Mesh;
  axis: 'x' | 'z';
  fixedCoord: number;
  min: number;
  max: number;
  pos: number;
  dir: number;
  hp: number;
  hitCooldown: number;
  alive: boolean;
}

interface Pickup {
  gx: number;
  gz: number;
  mesh: THREE.Mesh;
  collected: boolean;
}

interface OnFootLevelConfig {
  name: string;
  width: number;
  height: number;
  tint: DungeonTint;
  start: [number, number];
  exit: [number, number];
  walls: Array<[number, number]>;
  pits: Array<[number, number]>;
  coins: Array<[number, number]>;
  enemies: EnemySpawn[];
}

const LEVELS: OnFootLevelConfig[] = [
  {
    name: 'Entry Hall',
    width: 9,
    height: 7,
    tint: 'stone',
    start: [1, 1],
    exit: [7, 5],
    walls: [
      [3, 2],
      [3, 4],
      [5, 3],
    ],
    pits: [[2, 4]],
    coins: [
      [4, 1],
      [6, 3],
    ],
    enemies: [{ gx: 5, gz: 4, axis: 'x', range: 2, variant: 'green', hp: 1 }],
  },
  {
    name: 'Twisting Corridors',
    width: 11,
    height: 9,
    tint: 'moss',
    start: [1, 1],
    exit: [9, 7],
    walls: [
      [5, 4],
      [4, 4],
      [6, 4],
      [5, 3],
      [5, 5],
      [2, 6],
      [8, 2],
      [3, 2],
    ],
    pits: [
      [7, 5],
      [2, 3],
    ],
    coins: [
      [4, 6],
      [8, 1],
      [1, 6],
    ],
    enemies: [
      { gx: 3, gz: 5, axis: 'z', range: 2, variant: 'green', hp: 1 },
      { gx: 8, gz: 4, axis: 'x', range: 1, variant: 'red', hp: 1 },
    ],
  },
  {
    name: 'Frozen Vaults',
    width: 12,
    height: 10,
    tint: 'ice',
    start: [1, 1],
    exit: [10, 8],
    walls: [
      [5, 3],
      [5, 4],
      [5, 6],
      [2, 7],
      [9, 2],
      [8, 6],
      [3, 4],
    ],
    pits: [
      [6, 2],
      [2, 5],
      [9, 7],
    ],
    coins: [
      [4, 1],
      [7, 3],
      [1, 8],
      [10, 1],
    ],
    enemies: [
      { gx: 4, gz: 6, axis: 'x', range: 3, variant: 'red', hp: 1 },
      { gx: 9, gz: 3, axis: 'z', range: 2, variant: 'green', hp: 1 },
    ],
  },
  {
    name: 'Molten Vault',
    width: 13,
    height: 11,
    tint: 'fire',
    start: [1, 1],
    exit: [11, 9],
    walls: [
      [6, 2],
      [6, 3],
      [6, 4],
      [6, 6],
      [6, 7],
      [6, 8],
      [3, 5],
      [9, 5],
      [4, 8],
      [8, 2],
    ],
    pits: [
      [5, 5],
      [7, 5],
      [2, 8],
      [10, 3],
      [3, 2],
    ],
    coins: [
      [2, 2],
      [10, 1],
      [1, 9],
      [11, 5],
      [6, 9],
    ],
    enemies: [
      { gx: 4, gz: 4, axis: 'x', range: 3, variant: 'red', hp: 1 },
      { gx: 9, gz: 7, axis: 'z', range: 2, variant: 'red', hp: 1 },
      { gx: 6, gz: 1, axis: 'x', range: 2, variant: 'green', hp: 1 },
    ],
  },
  {
    name: "Dragon's Lair",
    width: 14,
    height: 12,
    tint: 'shadow',
    start: [1, 1],
    exit: [12, 10],
    walls: [
      [6, 5],
      [7, 5],
      [8, 5],
      [6, 7],
      [7, 7],
      [8, 7],
      [6, 6],
      [8, 6],
      [3, 3],
      [10, 3],
      [3, 9],
      [10, 9],
      [2, 6],
      [11, 6],
    ],
    pits: [
      [4, 2],
      [9, 2],
      [4, 10],
      [9, 10],
      [7, 3],
    ],
    coins: [
      [2, 2],
      [12, 1],
      [1, 10],
      [9, 9],
      [7, 6],
    ],
    enemies: [
      { gx: 7, gz: 6, axis: 'x', range: 1, variant: 'red', hp: 4 },
      { gx: 3, gz: 5, axis: 'z', range: 3, variant: 'red', hp: 1 },
      { gx: 11, gz: 5, axis: 'z', range: 3, variant: 'green', hp: 1 },
      { gx: 5, gz: 9, axis: 'x', range: 3, variant: 'green', hp: 1 },
    ],
  },
];

const TILE = 2;
const WALL_HEIGHT = 2.1;
const FRUSTUM_SIZE = 15;
const PLAYER_SPEED = 4.2;
const ENEMY_SPEED = 1.6;

/** Screen-up and screen-right directions on the ground plane for the isometric camera rig. */
const SCREEN_FORWARD = new THREE.Vector3(-1, 0, -1).normalize();
const SCREEN_RIGHT = new THREE.Vector3(1, 0, -1).normalize();

/**
 * "The Immortal"-style isometric dungeon crawler: the pilot explores grid-based stone rooms
 * from a fixed oblique camera, dodging pits and walls, fighting patrolling slimes, and
 * collecting treasure on the way to the glowing exit stair of each hand-built room.
 */
export class OnFootMode implements GameMode {
  readonly id = 'onfoot';
  readonly label = 'ON FOOT';
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-8, 8, 8, -8, 0.1, 200);
  readonly pixelWidth = 960;
  readonly pixelHeight = 540;

  private knightTex = buildKnightTexture();
  private slimeTex: Record<'green' | 'red', THREE.CanvasTexture> = {
    green: buildSlimeTexture('green'),
    red: buildSlimeTexture('red'),
  };
  private coinTex = buildCoinTexture(0);
  private exitTex = buildDungeonExitTexture();
  private pitTex = buildDungeonPitTexture();

  private player = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.8),
    new THREE.MeshBasicMaterial({ map: this.knightTex, transparent: true, depthWrite: false }),
  );
  private playerShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
  );
  private torch = new THREE.PointLight(0xffaa55, 1.1, 9, 2);

  private playerX = TILE;
  private playerZ = TILE;
  private lastSafeX = TILE;
  private lastSafeZ = TILE;
  private attackFlashTime = 0;
  private invuln = 0;
  private falling = 0;
  private cameraTarget = new THREE.Vector3();
  private cameraOffset = new THREE.Vector3(9, 9.5, 9);

  private tiles = new Map<string, TileKind>();
  private enemies: Enemy[] = [];
  private pickups: Pickup[] = [];
  private levelObjects: THREE.Object3D[] = [];
  private config: OnFootLevelConfig = LEVELS[0];
  private finished = false;

  constructor() {
    this.scene.add(new THREE.AmbientLight(0x6a6490, 0.85));
    this.scene.add(this.torch);
    this.scene.add(this.playerShadow, this.player);
  }

  levelName(level: number): string {
    return LEVELS[level].name;
  }

  private key(gx: number, gz: number): string {
    return `${gx},${gz}`;
  }

  private tileAt(gx: number, gz: number): TileKind {
    return this.tiles.get(this.key(gx, gz)) ?? 'wall';
  }

  private clearLevel(): void {
    for (const obj of this.levelObjects) this.scene.remove(obj);
    this.levelObjects = [];
    this.enemies.forEach((e) => {
      this.scene.remove(e.mesh);
      this.scene.remove(e.shadow);
    });
    this.enemies = [];
    this.pickups.forEach((p) => this.scene.remove(p.mesh));
    this.pickups = [];
    this.tiles.clear();
  }

  private buildLevel(config: OnFootLevelConfig): void {
    this.clearLevel();
    this.scene.background = new THREE.Color(0x0a0812);
    this.scene.fog = new THREE.Fog(0x0a0812, 14, 34);

    const floorTex = buildDungeonFloorTexture(config.tint);
    const wallTex = buildDungeonWallTexture(config.tint);
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, flatShading: true });
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, flatShading: true });
    const pitMat = new THREE.MeshBasicMaterial({ map: this.pitTex });
    const exitMat = new THREE.MeshBasicMaterial({ map: this.exitTex });

    for (let gz = 0; gz < config.height; gz++) {
      for (let gx = 0; gx < config.width; gx++) {
        const isBorder = gx === 0 || gz === 0 || gx === config.width - 1 || gz === config.height - 1;
        this.tiles.set(this.key(gx, gz), isBorder ? 'wall' : 'floor');
      }
    }
    for (const [gx, gz] of config.walls) this.tiles.set(this.key(gx, gz), 'wall');
    for (const [gx, gz] of config.pits) this.tiles.set(this.key(gx, gz), 'pit');
    this.tiles.set(this.key(config.exit[0], config.exit[1]), 'exit');

    for (const [key, kind] of this.tiles) {
      const [gx, gz] = key.split(',').map(Number);
      if (kind === 'wall') {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(TILE, WALL_HEIGHT, TILE), wallMat);
        mesh.position.set(gx * TILE, WALL_HEIGHT / 2, gz * TILE);
        this.scene.add(mesh);
        this.levelObjects.push(mesh);
      } else {
        const mat = kind === 'pit' ? pitMat : kind === 'exit' ? exitMat : floorMat;
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(TILE, TILE), mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(gx * TILE, 0, gz * TILE);
        this.scene.add(mesh);
        this.levelObjects.push(mesh);
      }
    }

    for (const [gx, gz] of config.coins) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 0.7),
        new THREE.MeshBasicMaterial({ map: this.coinTex, transparent: true, depthWrite: false }),
      );
      mesh.position.set(gx * TILE, 0.9, gz * TILE);
      this.scene.add(mesh);
      this.levelObjects.push(mesh);
      this.pickups.push({ gx, gz, mesh, collected: false });
    }

    for (const spawn of config.enemies) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.1, 1.1),
        new THREE.MeshBasicMaterial({ map: this.slimeTex[spawn.variant], transparent: true, depthWrite: false }),
      );
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.4, 10),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }),
      );
      this.scene.add(mesh, shadow);
      const base = spawn.axis === 'x' ? spawn.gx : spawn.gz;
      const fixedCoord = spawn.axis === 'x' ? spawn.gz : spawn.gx;
      this.enemies.push({
        mesh,
        shadow,
        axis: spawn.axis,
        fixedCoord,
        min: base - spawn.range,
        max: base + spawn.range,
        pos: base,
        dir: 1,
        hp: spawn.hp,
        hitCooldown: 0,
        alive: true,
      });
    }
  }

  enter(ctx: ModeContext, level: number): void {
    this.config = LEVELS[level] ?? LEVELS[0];
    this.buildLevel(this.config);

    this.playerX = this.config.start[0] * TILE;
    this.playerZ = this.config.start[1] * TILE;
    this.lastSafeX = this.playerX;
    this.lastSafeZ = this.playerZ;
    this.invuln = 1;
    this.falling = 0;
    this.finished = false;
    void ctx;
  }

  resize(width: number, height: number): void {
    const aspect = width / height;
    this.camera.left = (-FRUSTUM_SIZE * aspect) / 2;
    this.camera.right = (FRUSTUM_SIZE * aspect) / 2;
    this.camera.top = FRUSTUM_SIZE / 2;
    this.camera.bottom = -FRUSTUM_SIZE / 2;
    this.camera.updateProjectionMatrix();
  }

  /** True if the tile nearest (x,z) is a wall, for simple grid-snapped collision. */
  private isWallAt(x: number, z: number): boolean {
    const gx = Math.round(x / TILE);
    const gz = Math.round(z / TILE);
    return this.tileAt(gx, gz) === 'wall';
  }

  update(dt: number, ctx: ModeContext): void {
    if (this.finished) return;
    const { input } = ctx;

    if (this.falling <= 0) {
      const axisForward = input.axis(['ArrowDown', 'KeyS'], ['ArrowUp', 'KeyW']);
      const axisRight = input.axis(['ArrowLeft', 'KeyA'], ['ArrowRight', 'KeyD']);
      const moveDir = new THREE.Vector3()
        .addScaledVector(SCREEN_FORWARD, axisForward)
        .addScaledVector(SCREEN_RIGHT, axisRight);
      if (moveDir.lengthSq() > 1) moveDir.normalize();

      const nx = this.playerX + moveDir.x * PLAYER_SPEED * dt;
      if (!this.isWallAt(nx, this.playerZ)) this.playerX = nx;
      const nz = this.playerZ + moveDir.z * PLAYER_SPEED * dt;
      if (!this.isWallAt(this.playerX, nz)) this.playerZ = nz;
    }

    const gx = Math.round(this.playerX / TILE);
    const gz = Math.round(this.playerZ / TILE);
    const tile = this.tileAt(gx, gz);

    if (tile === 'pit' && this.falling <= 0 && this.invuln <= 0) {
      this.falling = 0.5;
      ctx.breakCombo();
      ctx.loseLife();
    } else if (tile === 'floor' || tile === 'exit') {
      this.lastSafeX = this.playerX;
      this.lastSafeZ = this.playerZ;
    }

    if (this.falling > 0) {
      this.falling -= dt;
      if (this.falling <= 0) {
        this.playerX = this.lastSafeX;
        this.playerZ = this.lastSafeZ;
        this.invuln = 1;
      }
    }

    if (tile === 'exit' && this.falling <= 0) {
      this.finished = true;
      ctx.comboHit(300);
      ctx.finish({ kind: 'advance' });
      return;
    }

    if (input.anyPressed(['KeyJ', 'ControlLeft', 'Space'])) {
      this.attackFlashTime = 0.18;
    }
    if (this.attackFlashTime > 0) this.attackFlashTime -= dt;
    (this.player.material as THREE.MeshBasicMaterial).color.set(this.attackFlashTime > 0 ? 0x99ddff : 0xffffff);

    this.updatePickups(ctx);
    this.updateEnemies(dt, ctx);

    if (this.invuln > 0) this.invuln -= dt;

    this.player.position.set(this.playerX, 0.95, this.playerZ);
    this.player.quaternion.copy(this.camera.quaternion);
    this.playerShadow.position.set(this.playerX, 0.02, this.playerZ);
    this.torch.position.set(this.playerX, 2.4, this.playerZ);

    this.cameraTarget.set(this.playerX, 0, this.playerZ);
    this.camera.position.lerp(this.cameraTarget.clone().add(this.cameraOffset), 0.12);
    this.camera.lookAt(this.cameraTarget);
  }

  private updatePickups(ctx: ModeContext): void {
    for (const p of this.pickups) {
      if (p.collected) continue;
      p.mesh.rotation.y += 0.05;
      const dx = p.gx * TILE - this.playerX;
      const dz = p.gz * TILE - this.playerZ;
      if (Math.sqrt(dx * dx + dz * dz) < 1) {
        p.collected = true;
        this.scene.remove(p.mesh);
        ctx.comboHit(50);
      }
    }
  }

  private updateEnemies(dt: number, ctx: ModeContext): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.pos += e.dir * ENEMY_SPEED * dt;
      if (e.pos < e.min || e.pos > e.max) {
        e.dir *= -1;
        e.pos = THREE.MathUtils.clamp(e.pos, e.min, e.max);
      }
      const ex = e.axis === 'x' ? e.pos * TILE : e.fixedCoord * TILE;
      const ez = e.axis === 'x' ? e.fixedCoord * TILE : e.pos * TILE;
      e.mesh.position.set(ex, 0.65, ez);
      e.mesh.quaternion.copy(this.camera.quaternion);
      e.shadow.position.set(ex, 0.02, ez);
      if (e.hitCooldown > 0) e.hitCooldown -= dt;

      const dx = ex - this.playerX;
      const dz = ez - this.playerZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 1.3) {
        if (this.attackFlashTime > 0 && e.hitCooldown <= 0) {
          e.hitCooldown = 0.25;
          e.hp -= 1;
          if (e.hp <= 0) {
            e.alive = false;
            e.mesh.visible = false;
            e.shadow.visible = false;
            ctx.comboHit(e.hp <= -3 ? 400 : 100);
          }
        } else if (this.invuln <= 0 && this.attackFlashTime <= 0 && this.falling <= 0) {
          ctx.breakCombo();
          ctx.loseLife();
          this.invuln = 1.2;
          const pushX = dx === 0 ? 0 : dx / dist;
          const pushZ = dz === 0 ? 0 : dz / dist;
          const nx = this.playerX - pushX * 0.8;
          const nz = this.playerZ - pushZ * 0.8;
          if (!this.isWallAt(nx, this.playerZ)) this.playerX = nx;
          if (!this.isWallAt(this.playerX, nz)) this.playerZ = nz;
        }
      }
    }
  }

  exit(): void {
    // Level geometry is rebuilt fresh on each enter(); nothing to dispose here.
  }
}

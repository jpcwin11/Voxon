import * as THREE from 'three';
import type { GameMode, ModeContext } from '../core/types';

interface Platform {
  x1: number;
  x2: number;
  y: number;
  mesh: THREE.Mesh;
}

interface Enemy {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  dir: number;
  patrolMin: number;
  patrolMax: number;
  alive: boolean;
}

const SCREEN_W = 256;
const SCREEN_H = 224;
const GROUND_Y = 32;
const GRAVITY = 520;
const JUMP_VELOCITY = 230;
const RUN_SPEED = 90;
const LEVEL_LENGTH = 2400;
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

  private player = new THREE.Mesh(
    new THREE.PlaneGeometry(PLAYER_W, PLAYER_H),
    new THREE.MeshBasicMaterial({ color: 0xffd27a }),
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
  private finished = false;

  constructor() {
    this.buildScene();
  }

  private buildScene(): void {
    this.scene.background = new THREE.Color(0x4a7ad6);

    // Distant NES-style hill silhouettes for cheap parallax-free scenery.
    for (let i = 0; i < 8; i++) {
      const hill = new THREE.Mesh(
        new THREE.CircleGeometry(60, 10),
        new THREE.MeshBasicMaterial({ color: 0x2f5f9e }),
      );
      hill.position.set(i * 300, 20, -1);
      this.scene.add(hill);
    }

    this.buildLevel();

    this.player.position.set(this.playerX, this.playerY, 0);
    this.scene.add(this.player);
  }

  private buildLevel(): void {
    const groundMat = new THREE.MeshBasicMaterial({ color: 0x5a3a1e });
    const segments: Array<[number, number]> = [
      [0, 420],
      [480, 760],
      [820, 1180],
      [1260, 1500],
      [1560, 2000],
      [2060, LEVEL_LENGTH + 200],
    ];
    for (const [x1, x2] of segments) {
      const width = x2 - x1;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, GROUND_Y), groundMat);
      mesh.position.set(x1 + width / 2, GROUND_Y / 2, 0);
      this.scene.add(mesh);
      this.platforms.push({ x1, x2, y: GROUND_Y, mesh });
    }

    // A couple of raised floating platforms for verticality.
    const raised: Array<[number, number, number]> = [
      [560, 700, 90],
      [1300, 1440, 110],
    ];
    const platMat = new THREE.MeshBasicMaterial({ color: 0x7a5a2e });
    for (const [x1, x2, y] of raised) {
      const width = x2 - x1;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, 12), platMat);
      mesh.position.set(x1 + width / 2, y, 0);
      this.scene.add(mesh);
      this.platforms.push({ x1, x2, y: y + 6, mesh });
    }

    const enemySpots: Array<[number, number, number]> = [
      [300, 120, 480],
      [900, 820, 1180],
      [1650, 1560, 2000],
      [2150, 2060, LEVEL_LENGTH],
    ];
    for (const [x, patrolMin, patrolMax] of enemySpots) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 16),
        new THREE.MeshBasicMaterial({ color: 0x33cc55 }),
      );
      mesh.position.set(x, GROUND_Y + 8, 0);
      this.scene.add(mesh);
      this.enemies.push({ mesh, x, y: GROUND_Y + 8, dir: 1, patrolMin, patrolMax, alive: true });
    }

    this.flag = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 48),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    this.flag.position.set(LEVEL_LENGTH, GROUND_Y + 24, 0);
    this.scene.add(this.flag);
  }

  enter(ctx: ModeContext): void {
    this.playerX = 24;
    this.playerY = GROUND_Y + PLAYER_H / 2;
    this.velY = 0;
    this.onGround = true;
    this.invuln = 1;
    this.finished = false;
    this.enemies.forEach((e) => {
      e.alive = true;
      e.mesh.visible = true;
    });
    void ctx;
  }

  resize(): void {
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
      this.attackFlashTime > 0 ? 0xffffff : 0xffd27a,
    );

    this.updateEnemies(dt, ctx);

    if (this.invuln > 0) this.invuln -= dt;

    this.player.position.set(this.playerX, this.playerY, 0);
    this.player.scale.x = this.facing;

    this.scrollX = THREE.MathUtils.clamp(this.playerX - 80, 0, LEVEL_LENGTH - SCREEN_W + 200);
    this.camera.position.x = 0;
    this.camera.left = this.scrollX;
    this.camera.right = this.scrollX + SCREEN_W;
    this.camera.updateProjectionMatrix();

    if (this.playerX > LEVEL_LENGTH - 10) {
      this.finished = true;
      ctx.addScore(500);
      ctx.finish({ kind: 'gameComplete' });
    }
  }

  private updateEnemies(dt: number, ctx: ModeContext): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.x += e.dir * 24 * dt;
      if (e.x < e.patrolMin || e.x > e.patrolMax) e.dir *= -1;
      e.mesh.position.x = e.x;

      const dx = Math.abs(e.x - this.playerX);
      const dy = Math.abs(e.y - this.playerY);
      if (dx < 14 && dy < 18) {
        if (this.attackFlashTime > 0) {
          e.alive = false;
          e.mesh.visible = false;
          ctx.addScore(75);
        } else if (this.invuln <= 0) {
          ctx.loseLife();
          this.invuln = 1.2;
          this.velY = JUMP_VELOCITY * 0.5;
          this.playerX -= this.facing * 10;
        }
      }
    }
  }

  exit(): void {
    // Scene is reused next time this mode runs; nothing to dispose for the vertical slice.
  }
}

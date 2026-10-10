import * as THREE from 'three';
import type { GameMode, ModeContext } from '../core/types';
import { buildNebulaTexture } from '../core/pixelArt';

interface Obstacle {
  mesh: THREE.Object3D;
  radius: number;
  kind: 'arch' | 'enemy';
  hp: number;
  isBoss: boolean;
  destroyed: boolean;
}

interface Bullet {
  mesh: THREE.Mesh;
  vz: number;
  life: number;
}

interface StarfoxLevelConfig {
  name: string;
  travelDistance: number;
  speed: number;
  /** Probability (0-1) that a spawn is a dodge-arch rather than a shootable enemy. */
  archWeight: number;
  spawnMin: number;
  spawnMax: number;
  enemyHp: number;
  nebulaTint: 'blue' | 'orange';
  /** Distance at which a tough boss enemy is forced to spawn, if any. */
  bossAt?: number;
}

const LEVELS: StarfoxLevelConfig[] = [
  { name: 'Training Run', travelDistance: 300, speed: 18, archWeight: 0.65, spawnMin: 7, spawnMax: 11, enemyHp: 1, nebulaTint: 'blue' },
  { name: 'Debris Field', travelDistance: 340, speed: 20, archWeight: 0.7, spawnMin: 6, spawnMax: 9, enemyHp: 1, nebulaTint: 'blue' },
  { name: 'Enemy Squadron', travelDistance: 380, speed: 22, archWeight: 0.4, spawnMin: 5, spawnMax: 8, enemyHp: 2, nebulaTint: 'orange' },
  { name: 'Asteroid Storm', travelDistance: 420, speed: 25, archWeight: 0.62, spawnMin: 4, spawnMax: 7, enemyHp: 2, nebulaTint: 'orange' },
  { name: 'Final Approach', travelDistance: 460, speed: 28, archWeight: 0.45, spawnMin: 4, spawnMax: 6, enemyHp: 3, nebulaTint: 'orange', bossAt: 420 },
];

const BOUNDS_X = 7;
const BOUNDS_Y = 4.5;
const SHIP_FORWARD_OFFSET = -4;

/**
 * Starfox-style rail shooter segment: the camera auto-flies forward along -Z while the
 * player's ship strafes within a bounded corridor, dodging arches/enemies and shooting back.
 */
export class StarfoxMode implements GameMode {
  readonly id = 'starfox';
  readonly label = 'STARFOX';
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
  readonly pixelWidth = 960;
  readonly pixelHeight = 540;

  private ship = new THREE.Group();
  private shipOffset = new THREE.Vector2(0, 0);
  private obstacles: Obstacle[] = [];
  private bullets: Bullet[] = [];
  private fireCooldown = 0;
  private invuln = 0;
  private traveled = 0;
  private nextSpawnAt = 0;
  private starField!: THREE.Points;
  private config: StarfoxLevelConfig = LEVELS[0];
  private bossSpawned = false;
  private nebulaTextures: Record<'blue' | 'orange', THREE.CanvasTexture>;

  constructor() {
    this.nebulaTextures = {
      blue: buildNebulaTexture('blue'),
      orange: buildNebulaTexture('orange'),
    };
    this.buildScene();
  }

  levelName(level: number): string {
    return LEVELS[level].name;
  }

  private buildScene(): void {
    this.scene.fog = new THREE.Fog(0x05080f, 40, 220);

    this.scene.add(new THREE.AmbientLight(0x6677ff, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(5, 10, 5);
    this.scene.add(sun);

    // Scrolling starfield for a sense of forward speed.
    const starGeo = new THREE.BufferGeometry();
    const starCount = 800;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 120;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 2] = -Math.random() * 400;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.starField = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xaad4ff, size: 0.6, sizeAttenuation: true }),
    );
    this.scene.add(this.starField);

    // Simple scrolling "canyon floor" grid to sell the sense of flying low.
    const floor = new THREE.GridHelper(400, 60, 0x2255ff, 0x113377);
    floor.position.y = -6;
    this.scene.add(floor);

    this.ship.add(this.buildShipModel());
    this.scene.add(this.ship);
  }

  /** Builds a small, readable multi-part fighter silhouette with emissive trim accents. */
  private buildShipModel(): THREE.Object3D {
    const group = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 2, 4),
      new THREE.MeshStandardMaterial({ color: 0xe8edf8, flatShading: true, metalness: 0.2, roughness: 0.5 }),
    );
    hull.rotation.x = Math.PI / 2;
    hull.rotation.y = Math.PI / 4;
    group.add(hull);

    const cockpit = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x3fd0ff, emissive: 0x1a6fa0, emissiveIntensity: 0.8 }),
    );
    cockpit.position.set(0, 0.2, 0.3);
    group.add(cockpit);

    const wingMat = new THREE.MeshStandardMaterial({ color: 0x3355cc, flatShading: true });
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.07, 0.65), wingMat);
    wingL.position.set(-0.9, -0.05, 0.1);
    wingL.rotation.z = 0.08;
    const wingR = wingL.clone();
    wingR.position.x = 0.9;
    wingR.rotation.z = -0.08;
    group.add(wingL, wingR);

    const tipMat = new THREE.MeshStandardMaterial({ color: 0xff5544, emissive: 0x551111, emissiveIntensity: 0.6 });
    const tipL = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 6), tipMat);
    tipL.position.set(-1.6, -0.05, 0.1);
    tipL.rotation.z = Math.PI / 2;
    const tipR = tipL.clone();
    tipR.position.x = 1.6;
    group.add(tipL, tipR);

    const engineMat = new THREE.MeshStandardMaterial({ color: 0xffaa33, emissive: 0xff8800, emissiveIntensity: 1.1 });
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.5, 8), engineMat);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(0, -0.05, 0.9);
    group.add(engine);

    return group;
  }

  enter(ctx: ModeContext, level: number): void {
    this.config = LEVELS[level] ?? LEVELS[0];
    this.scene.background = this.nebulaTextures[this.config.nebulaTint];
    this.traveled = 0;
    this.nextSpawnAt = 10;
    this.invuln = 1.5;
    this.bossSpawned = false;
    this.shipOffset.set(0, 0);
    this.obstacles.forEach((o) => this.scene.remove(o.mesh));
    this.obstacles = [];
    this.bullets.forEach((b) => this.scene.remove(b.mesh));
    this.bullets = [];
    this.camera.position.set(0, 0.8, 8);
    void ctx;
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number, ctx: ModeContext): void {
    const { input } = ctx;
    const speed = this.config.speed;
    this.traveled += speed * dt;

    // Camera auto-advances forward; ship trails a fixed offset ahead of it.
    this.camera.position.z -= speed * dt;

    const moveSpeed = 7;
    this.shipOffset.x += input.axis(['ArrowLeft', 'KeyA'], ['ArrowRight', 'KeyD']) * moveSpeed * dt;
    this.shipOffset.y += input.axis(['ArrowDown', 'KeyS'], ['ArrowUp', 'KeyW']) * moveSpeed * dt;
    this.shipOffset.x = THREE.MathUtils.clamp(this.shipOffset.x, -BOUNDS_X, BOUNDS_X);
    this.shipOffset.y = THREE.MathUtils.clamp(this.shipOffset.y, -BOUNDS_Y, BOUNDS_Y);

    this.ship.position.set(
      this.shipOffset.x,
      0.8 + this.shipOffset.y,
      this.camera.position.z + SHIP_FORWARD_OFFSET,
    );
    this.ship.rotation.z = THREE.MathUtils.lerp(
      this.ship.rotation.z,
      -this.shipOffset.x * 0.12,
      0.2,
    );
    this.ship.rotation.x = THREE.MathUtils.lerp(this.ship.rotation.x, this.shipOffset.y * 0.08, 0.2);

    this.camera.lookAt(this.ship.position.x * 0.4, 0.8 + this.ship.position.y * 0.1, this.camera.position.z - 20);

    // Firing.
    this.fireCooldown -= dt;
    if (input.anyHeld(['Space', 'KeyJ']) && this.fireCooldown <= 0) {
      this.fireCooldown = 0.16;
      this.spawnBullet();
    }

    this.updateBullets(dt);
    this.spawnObstacles();
    this.updateObstacles(dt, ctx);

    this.starField.position.z = this.camera.position.z * 0.02;

    if (this.invuln > 0) this.invuln -= dt;

    if (this.traveled >= this.config.travelDistance) {
      ctx.finish({ kind: 'advance' });
    }
  }

  private spawnBullet(): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0x66ffcc }),
    );
    mesh.position.copy(this.ship.position);
    mesh.position.z -= 1;
    this.scene.add(mesh);
    this.bullets.push({ mesh, vz: -70, life: 1.2 });
  }

  private updateBullets(dt: number): void {
    for (const b of this.bullets) {
      b.mesh.position.z += b.vz * dt;
      b.life -= dt;
    }
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (b.life <= 0) {
        this.scene.remove(b.mesh);
        this.bullets.splice(i, 1);
      }
    }
  }

  private spawnObstacles(): void {
    const { bossAt } = this.config;
    if (bossAt !== undefined && !this.bossSpawned && this.traveled >= bossAt) {
      this.bossSpawned = true;
      this.spawnBoss();
      return;
    }

    if (this.traveled < this.nextSpawnAt) return;
    this.nextSpawnAt = this.traveled + THREE.MathUtils.randFloat(this.config.spawnMin, this.config.spawnMax);

    const spawnZ = this.camera.position.z - 140;
    const roll = Math.random();
    if (roll < this.config.archWeight) {
      // Arch obstacle: must be dodged (fly through the gap).
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(2.1, 0.35, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0xff6644, emissive: 0x551100, emissiveIntensity: 0.4, flatShading: true }),
      );
      arch.position.set(
        THREE.MathUtils.randFloatSpread(BOUNDS_X * 1.6),
        THREE.MathUtils.randFloatSpread(BOUNDS_Y * 1.4),
        spawnZ,
      );
      this.scene.add(arch);
      this.obstacles.push({ mesh: arch, radius: 1.5, kind: 'arch', hp: 999, isBoss: false, destroyed: false });
    } else {
      // Enemy fighter: can be shot for points, or will collide if left alone.
      const enemy = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.7),
        new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0x552200, emissiveIntensity: 0.5, flatShading: true }),
      );
      enemy.position.set(
        THREE.MathUtils.randFloatSpread(BOUNDS_X * 1.6),
        THREE.MathUtils.randFloatSpread(BOUNDS_Y * 1.4),
        spawnZ,
      );
      this.scene.add(enemy);
      this.obstacles.push({ mesh: enemy, radius: 0.9, kind: 'enemy', hp: this.config.enemyHp, isBoss: false, destroyed: false });
    }
  }

  private spawnBoss(): void {
    const boss = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.6, 0),
      new THREE.MeshStandardMaterial({ color: 0xff2244, emissive: 0x660011, emissiveIntensity: 0.7, flatShading: true }),
    );
    boss.position.set(0, 0, this.camera.position.z - 150);
    this.scene.add(boss);
    this.obstacles.push({ mesh: boss, radius: 2, kind: 'enemy', hp: 6, isBoss: true, destroyed: false });
  }

  private updateObstacles(_dt: number, ctx: ModeContext): void {
    const shipPos = this.ship.position;
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      if (o.destroyed) continue;

      // Slow lateral drift for the boss so it's not a sitting duck.
      if (o.isBoss) {
        o.mesh.position.x = Math.sin(this.traveled * 0.05) * BOUNDS_X * 0.6;
        o.mesh.rotation.y += _dt * 0.6;
      }

      // Bullet collision check (enemies only).
      if (o.kind === 'enemy') {
        for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
          const b = this.bullets[bi];
          if (b.mesh.position.distanceTo(o.mesh.position) < o.radius + 0.3) {
            this.scene.remove(b.mesh);
            this.bullets.splice(bi, 1);
            o.hp -= 1;
            if (o.hp <= 0) {
              o.destroyed = true;
              this.scene.remove(o.mesh);
              ctx.addScore(o.isBoss ? 600 : 100);
            }
            break;
          }
        }
      }
      if (o.destroyed) continue;

      // Ship collision check.
      const dz = Math.abs(o.mesh.position.z - shipPos.z);
      if (dz < 1.2) {
        const dx = o.mesh.position.x - shipPos.x;
        const dy = o.mesh.position.y - shipPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < o.radius + 0.6 && this.invuln <= 0) {
          if (!o.isBoss) {
            o.destroyed = true;
            this.scene.remove(o.mesh);
          }
          this.invuln = 2;
          ctx.loseLife();
        }
      }

      // Cull obstacles that have passed behind the camera (never cull the boss).
      if (!o.isBoss && o.mesh.position.z > this.camera.position.z + 10) {
        this.scene.remove(o.mesh);
        this.obstacles.splice(i, 1);
      }
    }
  }

  exit(): void {
    // Scene is reused next time this mode runs; nothing to dispose for the vertical slice.
  }
}

import * as THREE from 'three';
import type { GameMode, ModeContext } from '../core/types';
import { buildNebulaTexture, buildPanelTexture, buildZaxxonFloorTexture } from '../core/pixelArt';

interface WallObstacle {
  mesh: THREE.Group;
  z: number;
  gapBottom: number;
  gapTop: number;
  resolved: boolean;
}

interface Pillar {
  mesh: THREE.Mesh;
  radius: number;
  height: number;
  destroyed: boolean;
}

interface ZaxxonLevelConfig {
  name: string;
  travelDistance: number;
  speed: number;
  wallFreqMin: number;
  wallFreqMax: number;
  gapMin: number;
  gapMax: number;
  pillarFreqMin: number;
  pillarFreqMax: number;
  nebulaTint: 'blue' | 'orange';
}

const LEVELS: ZaxxonLevelConfig[] = [
  { name: 'Hangar Bay', travelDistance: 300, speed: 13, wallFreqMin: 28, wallFreqMax: 36, gapMin: 2.8, gapMax: 3.4, pillarFreqMin: 14, pillarFreqMax: 20, nebulaTint: 'blue' },
  { name: 'Outer Perimeter', travelDistance: 330, speed: 15, wallFreqMin: 24, wallFreqMax: 32, gapMin: 2.6, gapMax: 3.2, pillarFreqMin: 12, pillarFreqMax: 18, nebulaTint: 'blue' },
  { name: 'Reactor Core', travelDistance: 360, speed: 17, wallFreqMin: 20, wallFreqMax: 28, gapMin: 2.3, gapMax: 2.9, pillarFreqMin: 10, pillarFreqMax: 16, nebulaTint: 'orange' },
  { name: 'Canyon Run', travelDistance: 390, speed: 19, wallFreqMin: 18, wallFreqMax: 24, gapMin: 2.0, gapMax: 2.6, pillarFreqMin: 8, pillarFreqMax: 14, nebulaTint: 'orange' },
  { name: 'Fortress Assault', travelDistance: 420, speed: 22, wallFreqMin: 16, wallFreqMax: 22, gapMin: 1.8, gapMax: 2.4, pillarFreqMin: 7, pillarFreqMax: 12, nebulaTint: 'orange' },
];

const LANE_HALF_WIDTH = 6;
const ALTITUDE_MIN = 0.4;
const ALTITUDE_MAX = 7;
const FRUSTUM_SIZE = 16;

/**
 * Zaxxon-style isometric flight segment: a fixed oblique camera follows the ship as it
 * auto-scrolls forward, while the player strafes left/right and manages altitude to thread
 * gaps in walls and avoid ground pillars, exactly like the arcade original's altitude gauge.
 */
export class ZaxxonMode implements GameMode {
  readonly id = 'zaxxon';
  readonly label = 'ZAXXON';
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-8, 8, 8, -8, 0.1, 200);
  readonly pixelWidth = 960;
  readonly pixelHeight = 540;

  private ship = new THREE.Group();
  private shadow!: THREE.Mesh;
  private shipX = 0;
  private shipY = 2.5;
  private walls: WallObstacle[] = [];
  private pillars: Pillar[] = [];
  private bullets: THREE.Mesh[] = [];
  private fireCooldown = 0;
  private invuln = 0;
  private traveled = 0;
  private nextWallAt = 0;
  private nextPillarAt = 0;
  private cameraOffset = new THREE.Vector3(14, 14, 14);
  private config: ZaxxonLevelConfig = LEVELS[0];
  private wallMat!: THREE.MeshStandardMaterial;
  private pillarMat!: THREE.MeshStandardMaterial;
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
    this.scene.add(new THREE.AmbientLight(0x8899cc, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(10, 20, 10);
    this.scene.add(sun);

    // Scrolling ground plane with a checkered panel texture, like the arcade base runway.
    const floorTex = buildZaxxonFloorTexture();
    floorTex.repeat.set((LANE_HALF_WIDTH * 2 + 4) / 2, 250);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(LANE_HALF_WIDTH * 2 + 4, 500),
      new THREE.MeshStandardMaterial({ map: floorTex }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -150);
    this.scene.add(ground);

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.6, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadow);

    this.wallMat = new THREE.MeshStandardMaterial({
      map: buildPanelTexture('#4455cc', '#7788ee'),
      flatShading: true,
    });
    this.pillarMat = new THREE.MeshStandardMaterial({
      map: buildPanelTexture('#aa3344', '#dd6677'),
      flatShading: true,
    });

    this.ship.add(this.buildShipModel());
    this.scene.add(this.ship);
  }

  /** Builds a small, readable multi-part fighter silhouette with emissive trim accents. */
  private buildShipModel(): THREE.Object3D {
    const group = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 1.7, 4),
      new THREE.MeshStandardMaterial({ color: 0xffe08a, flatShading: true }),
    );
    hull.rotation.x = Math.PI / 2;
    hull.rotation.y = Math.PI / 4;
    group.add(hull);

    const cockpit = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x3fd0ff, emissive: 0x1a6fa0, emissiveIntensity: 0.8 }),
    );
    cockpit.position.set(0, 0.18, 0.25);
    group.add(cockpit);

    const wings = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.08, 0.6),
      new THREE.MeshStandardMaterial({ color: 0xff8844, flatShading: true }),
    );
    group.add(wings);

    const engineMat = new THREE.MeshStandardMaterial({ color: 0xffaa33, emissive: 0xff8800, emissiveIntensity: 1.1 });
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.4, 8), engineMat);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(0, -0.05, 0.75);
    group.add(engine);

    return group;
  }

  enter(ctx: ModeContext, level: number): void {
    this.config = LEVELS[level] ?? LEVELS[0];
    this.scene.background = this.nebulaTextures[this.config.nebulaTint];
    this.traveled = 0;
    this.nextWallAt = 14;
    this.nextPillarAt = 8;
    this.invuln = 1.5;
    this.shipX = 0;
    this.shipY = 2.5;
    this.walls.forEach((w) => this.scene.remove(w.mesh));
    this.walls = [];
    this.pillars.forEach((p) => this.scene.remove(p.mesh));
    this.pillars = [];
    this.bullets.forEach((b) => this.scene.remove(b));
    this.bullets = [];
    this.ship.position.set(0, this.shipY, -4);
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

  update(dt: number, ctx: ModeContext): void {
    const { input } = ctx;
    const speed = this.config.speed;
    this.traveled += speed * dt;

    const shipForwardZ = this.ship.position.z - speed * dt;

    const strafeSpeed = 8;
    const altSpeed = 6;
    this.shipX += input.axis(['ArrowLeft', 'KeyA'], ['ArrowRight', 'KeyD']) * strafeSpeed * dt;
    this.shipY += input.axis(['ArrowDown', 'KeyS'], ['ArrowUp', 'KeyW']) * altSpeed * dt;
    this.shipX = THREE.MathUtils.clamp(this.shipX, -LANE_HALF_WIDTH, LANE_HALF_WIDTH);
    this.shipY = THREE.MathUtils.clamp(this.shipY, ALTITUDE_MIN, ALTITUDE_MAX);

    this.ship.position.set(this.shipX, this.shipY, shipForwardZ);
    this.ship.rotation.z = THREE.MathUtils.lerp(this.ship.rotation.z, -this.shipX * 0.05, 0.2);

    this.shadow.position.set(this.shipX, 0.02, shipForwardZ);
    const shadowScale = THREE.MathUtils.clamp(1 - this.shipY / (ALTITUDE_MAX + 1), 0.25, 1);
    this.shadow.scale.setScalar(shadowScale);

    this.camera.position.copy(this.ship.position).add(this.cameraOffset);
    this.camera.lookAt(this.ship.position);

    this.fireCooldown -= dt;
    if (input.anyHeld(['Space', 'KeyJ']) && this.fireCooldown <= 0) {
      this.fireCooldown = 0.2;
      this.spawnBullet();
    }
    this.updateBullets(dt);

    this.spawnWalls();
    this.spawnPillars();
    this.updateWalls(ctx);
    this.updatePillars(ctx);

    if (this.invuln > 0) this.invuln -= dt;

    if (this.traveled >= this.config.travelDistance) {
      ctx.finish({ kind: 'advance' });
    }
  }

  private spawnBullet(): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffff66 }),
    );
    mesh.position.copy(this.ship.position);
    mesh.position.z -= 1;
    this.scene.add(mesh);
    this.bullets.push(mesh);
  }

  private updateBullets(dt: number): void {
    const vz = -90;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.position.z += vz * dt;
      if (b.position.z < this.ship.position.z - 120) {
        this.scene.remove(b);
        this.bullets.splice(i, 1);
      }
    }
  }

  private spawnWalls(): void {
    if (this.traveled < this.nextWallAt) return;
    this.nextWallAt = this.traveled + THREE.MathUtils.randFloat(this.config.wallFreqMin, this.config.wallFreqMax);

    const gapHeight = THREE.MathUtils.randFloat(this.config.gapMin, this.config.gapMax);
    const gapBottom = THREE.MathUtils.randFloat(ALTITUDE_MIN, ALTITUDE_MAX - gapHeight);
    const gapTop = gapBottom + gapHeight;
    const z = this.ship.position.z - 90;

    const group = new THREE.Group();
    if (gapBottom > ALTITUDE_MIN + 0.1) {
      const lower = new THREE.Mesh(
        new THREE.BoxGeometry(LANE_HALF_WIDTH * 2 + 2, gapBottom, 0.8),
        this.wallMat,
      );
      lower.position.set(0, gapBottom / 2, 0);
      group.add(lower);
    }
    if (gapTop < ALTITUDE_MAX - 0.1) {
      const upperHeight = ALTITUDE_MAX + 3 - gapTop;
      const upper = new THREE.Mesh(
        new THREE.BoxGeometry(LANE_HALF_WIDTH * 2 + 2, upperHeight, 0.8),
        this.wallMat,
      );
      upper.position.set(0, gapTop + upperHeight / 2, 0);
      group.add(upper);
    }
    group.position.z = z;
    this.scene.add(group);
    this.walls.push({ mesh: group, z, gapBottom, gapTop, resolved: false });
  }

  private spawnPillars(): void {
    if (this.traveled < this.nextPillarAt) return;
    this.nextPillarAt = this.traveled + THREE.MathUtils.randFloat(this.config.pillarFreqMin, this.config.pillarFreqMax);

    const z = this.ship.position.z - 70;
    const x = THREE.MathUtils.randFloatSpread(LANE_HALF_WIDTH * 1.8);
    const height = THREE.MathUtils.randFloat(2, 4.5);
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.6, height, 8),
      this.pillarMat,
    );
    pillar.position.set(x, height / 2, z);
    this.scene.add(pillar);
    this.pillars.push({ mesh: pillar, radius: 0.7, height, destroyed: false });
  }

  private updateWalls(ctx: ModeContext): void {
    const ship = this.ship.position;
    for (let i = this.walls.length - 1; i >= 0; i--) {
      const w = this.walls[i];
      if (!w.resolved && Math.abs(w.mesh.position.z - ship.z) < 1) {
        w.resolved = true;
        const inGap = ship.y > w.gapBottom + 0.3 && ship.y < w.gapTop - 0.3;
        if (!inGap && this.invuln <= 0) {
          this.invuln = 2;
          ctx.breakCombo();
          ctx.loseLife();
        } else if (inGap) {
          ctx.comboHit(50);
        }
      }
      if (w.mesh.position.z > ship.z + 10) {
        this.scene.remove(w.mesh);
        this.walls.splice(i, 1);
      }
    }
  }

  private updatePillars(ctx: ModeContext): void {
    const ship = this.ship.position;
    for (let i = this.pillars.length - 1; i >= 0; i--) {
      const p = this.pillars[i];
      if (p.destroyed) continue;

      for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
        const b = this.bullets[bi];
        if (b.position.distanceTo(p.mesh.position) < p.radius + 0.3) {
          this.scene.remove(b);
          this.bullets.splice(bi, 1);
          p.destroyed = true;
          this.scene.remove(p.mesh);
          ctx.comboHit(150);
          break;
        }
      }
      if (p.destroyed) continue;

      const dz = Math.abs(p.mesh.position.z - ship.z);
      if (dz < 1) {
        const dx = Math.abs(p.mesh.position.x - ship.x);
        const hitsPillar = dx < p.radius + 0.6 && ship.y < p.height + 0.4;
        if (hitsPillar && this.invuln <= 0) {
          p.destroyed = true;
          this.scene.remove(p.mesh);
          this.invuln = 2;
          ctx.breakCombo();
          ctx.loseLife();
        }
      }

      if (p.mesh.position.z > ship.z + 10 && !p.destroyed) {
        this.scene.remove(p.mesh);
        this.pillars.splice(i, 1);
      } else if (p.destroyed) {
        this.pillars.splice(i, 1);
      }
    }
  }

  exit(): void {
    // Scene is reused next time this mode runs; nothing to dispose for the vertical slice.
  }
}

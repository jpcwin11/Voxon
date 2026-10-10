import * as THREE from 'three';
import type { GameMode, ModeContext } from '../core/types';

interface Obstacle {
  mesh: THREE.Object3D;
  radius: number;
  kind: 'arch' | 'enemy' | 'pickup';
  hp: number;
  destroyed: boolean;
}

interface Bullet {
  mesh: THREE.Mesh;
  vz: number;
  life: number;
}

const BOUNDS_X = 7;
const BOUNDS_Y = 4.5;
const TRAVEL_DISTANCE = 420;
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

  constructor() {
    this.buildScene();
  }

  private buildScene(): void {
    this.scene.background = new THREE.Color(0x02030a);
    this.scene.fog = new THREE.Fog(0x02030a, 40, 220);

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

    // Player ship: a simple wedge made from a cone, good enough as a placeholder silhouette.
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(0.6, 1.8, 4),
      new THREE.MeshStandardMaterial({ color: 0xdde6ff, flatShading: true }),
    );
    body.rotation.x = Math.PI / 2;
    body.rotation.y = Math.PI / 4;
    const wingGeo = new THREE.BoxGeometry(2.2, 0.08, 0.7);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x4466ff, flatShading: true });
    const wings = new THREE.Mesh(wingGeo, wingMat);
    wings.position.z = 0.2;
    this.ship.add(body, wings);
    this.scene.add(this.ship);
  }

  enter(ctx: ModeContext): void {
    this.traveled = 0;
    this.nextSpawnAt = 10;
    this.invuln = 1.5;
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
    const speed = 22;
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

    if (this.traveled >= TRAVEL_DISTANCE) {
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
    if (this.traveled < this.nextSpawnAt) return;
    this.nextSpawnAt = this.traveled + THREE.MathUtils.randFloat(6, 10);

    const spawnZ = this.camera.position.z - 140;
    const roll = Math.random();
    if (roll < 0.55) {
      // Arch obstacle: must be dodged (fly through the gap).
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(2.1, 0.35, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0xff6644, flatShading: true }),
      );
      arch.position.set(
        THREE.MathUtils.randFloatSpread(BOUNDS_X * 1.6),
        THREE.MathUtils.randFloatSpread(BOUNDS_Y * 1.4),
        spawnZ,
      );
      this.scene.add(arch);
      this.obstacles.push({ mesh: arch, radius: 1.5, kind: 'arch', hp: 999, destroyed: false });
    } else {
      // Enemy fighter: can be shot for points, or will collide if left alone.
      const enemy = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.7),
        new THREE.MeshStandardMaterial({ color: 0xffaa00, flatShading: true }),
      );
      enemy.position.set(
        THREE.MathUtils.randFloatSpread(BOUNDS_X * 1.6),
        THREE.MathUtils.randFloatSpread(BOUNDS_Y * 1.4),
        spawnZ,
      );
      this.scene.add(enemy);
      this.obstacles.push({ mesh: enemy, radius: 0.9, kind: 'enemy', hp: 1, destroyed: false });
    }
  }

  private updateObstacles(_dt: number, ctx: ModeContext): void {
    const shipPos = this.ship.position;
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      if (o.destroyed) continue;

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
              ctx.addScore(100);
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
          o.destroyed = true;
          this.scene.remove(o.mesh);
          this.invuln = 2;
          ctx.loseLife();
        }
      }

      // Cull obstacles that have passed behind the camera.
      if (o.mesh.position.z > this.camera.position.z + 10) {
        this.scene.remove(o.mesh);
        this.obstacles.splice(i, 1);
      }
    }
  }

  exit(): void {
    // Scene is reused next time this mode runs; nothing to dispose for the vertical slice.
  }
}

import * as THREE from 'three';
import { Input } from './input';
import type { GameMode, GameState, ModeContext, ModeResult } from './types';
import { StarfoxMode } from '../modes/starfoxMode';
import { ZaxxonMode } from '../modes/zaxxonMode';
import { OnFootMode } from '../modes/onFootMode';

/**
 * Top-level orchestrator: owns the renderer/input, cycles through the three game modes
 * (Starfox rail shooter -> Zaxxon isometric flight -> NES-style on-foot segment), and
 * manages shared score/lives plus the game-over / level-complete overlay flow.
 */
export class Game {
  private renderer: THREE.WebGLRenderer;
  private input = new Input();
  private state: GameState = { score: 0, lives: 3 };
  private modes: GameMode[];
  private currentIndex = 0;
  private current: GameMode;
  private clock = new THREE.Clock();
  private frozen = true;
  private pendingAction: 'gameover' | 'complete' | 'start' = 'start';

  private hudMode = document.getElementById('hud-mode') as HTMLDivElement;
  private hudScore = document.getElementById('hud-score') as HTMLDivElement;
  private hudLives = document.getElementById('hud-lives') as HTMLDivElement;
  private overlay = document.getElementById('overlay') as HTMLDivElement;
  private overlayTitle = document.getElementById('overlay-title') as HTMLDivElement;

  private ctx: ModeContext;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    this.renderer.setPixelRatio(1);

    this.modes = [new StarfoxMode(), new ZaxxonMode(), new OnFootMode()];
    this.current = this.modes[0];

    this.ctx = {
      renderer: this.renderer,
      input: this.input,
      state: this.state,
      addScore: (amount) => this.addScore(amount),
      loseLife: () => this.loseLife(),
      finish: (result) => this.handleModeResult(result),
    };

    this.showOverlay('VOXON', 'Press ENTER to launch');
    this.updateHud();
  }

  start(): void {
    this.applyModeResolution();
    requestAnimationFrame(this.loop);
  }

  private loop = (): void => {
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.frozen) {
      if (this.input.isPressed('Enter') || this.input.isPressed('Space')) {
        this.resolvePendingAction();
      }
    } else {
      this.current.update(dt, this.ctx);
    }

    this.renderer.render(this.current.scene, this.current.camera);
    this.input.endFrame();
    requestAnimationFrame(this.loop);
  };

  private resolvePendingAction(): void {
    this.hideOverlay();
    this.frozen = false;

    if (this.pendingAction === 'gameover') {
      this.state.score = 0;
      this.state.lives = 3;
      this.currentIndex = 0;
      this.current = this.modes[0];
    } else if (this.pendingAction === 'complete') {
      this.currentIndex = 0;
      this.current = this.modes[0];
    }
    // 'start' falls through and simply enters modes[0] as-is.

    this.updateHud();
    this.applyModeResolution();
    this.current.enter(this.ctx);
  }

  private addScore(amount: number): void {
    this.state.score += amount;
    this.updateHud();
  }

  private loseLife(): void {
    this.state.lives -= 1;
    this.updateHud();
    if (this.state.lives <= 0) {
      this.frozen = true;
      this.pendingAction = 'gameover';
      this.showOverlay('GAME OVER', `Final score ${this.state.score}\nPress ENTER to restart`);
    }
  }

  private handleModeResult(result: ModeResult): void {
    if (result.kind === 'advance') {
      this.current.exit();
      this.currentIndex = (this.currentIndex + 1) % this.modes.length;
      this.current = this.modes[this.currentIndex];
      this.applyModeResolution();
      this.current.enter(this.ctx);
      this.updateHud();
    } else if (result.kind === 'gameComplete') {
      this.current.exit();
      this.frozen = true;
      this.pendingAction = 'complete';
      this.showOverlay('LEVEL COMPLETE!', `Score ${this.state.score}\nPress ENTER to fly again`);
    } else if (result.kind === 'playerDied') {
      this.loseLife();
    }
  }

  private applyModeResolution(): void {
    this.renderer.setSize(this.current.pixelWidth, this.current.pixelHeight, false);
    this.current.resize(this.current.pixelWidth, this.current.pixelHeight);
  }

  private updateHud(): void {
    this.hudMode.textContent = this.current.label;
    this.hudScore.textContent = `SCORE ${String(this.state.score).padStart(6, '0')}`;
    this.hudLives.textContent = `LIVES ${Math.max(this.state.lives, 0)}`;
  }

  private showOverlay(title: string, subtitle: string): void {
    this.overlayTitle.textContent = title;
    const sub = document.getElementById('overlay-subtitle');
    if (sub) sub.textContent = subtitle;
    this.overlay.classList.remove('hidden');
  }

  private hideOverlay(): void {
    this.overlay.classList.add('hidden');
  }
}

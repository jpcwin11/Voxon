import * as THREE from 'three';
import { Input } from './input';
import { LEVEL_COUNT } from './types';
import type { GameMode, GameState, ModeContext, ModeResult } from './types';
import { StarfoxMode } from '../modes/starfoxMode';
import { ZaxxonMode } from '../modes/zaxxonMode';
import { OnFootMode } from '../modes/onFootMode';

/**
 * Top-level orchestrator: owns the renderer/input, cycles through the three game modes
 * (Starfox rail shooter -> Zaxxon isometric flight -> NES-style on-foot segment) across
 * five difficulty levels each, manages shared score/lives, and drives the stage/level
 * select menu shown whenever play is paused at an overlay.
 */
export class Game {
  private renderer: THREE.WebGLRenderer;
  private input = new Input();
  private state: GameState = { score: 0, lives: 3 };
  private modes: GameMode[];
  private currentIndex = 0;
  private currentLevel = 0;
  private current: GameMode;
  private clock = new THREE.Clock();
  private frozen = true;
  private menuStage = 0;
  private menuLevel = 0;

  private hudMode = document.getElementById('hud-mode') as HTMLDivElement;
  private hudScore = document.getElementById('hud-score') as HTMLDivElement;
  private hudLives = document.getElementById('hud-lives') as HTMLDivElement;
  private overlay = document.getElementById('overlay') as HTMLDivElement;
  private overlayTitle = document.getElementById('overlay-title') as HTMLDivElement;
  private overlaySubtitle = document.getElementById('overlay-subtitle') as HTMLDivElement;
  private stageRow = document.getElementById('stage-row') as HTMLDivElement;
  private levelRow = document.getElementById('level-row') as HTMLDivElement;
  private levelName = document.getElementById('level-name') as HTMLDivElement;

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

    this.buildMenu();
    this.showOverlay('VOXON', "A SPACE SHOOT 'EM UP");
    this.updateHud();
  }

  start(): void {
    this.applyModeResolution();
    requestAnimationFrame(this.loop);
  }

  private buildMenu(): void {
    this.stageRow.innerHTML = '';
    this.modes.forEach((mode, i) => {
      const span = document.createElement('span');
      span.textContent = mode.label;
      span.dataset.stage = String(i);
      this.stageRow.appendChild(span);
    });
    this.levelRow.innerHTML = '';
    for (let i = 0; i < LEVEL_COUNT; i++) {
      const span = document.createElement('span');
      span.textContent = `L${i + 1}`;
      span.dataset.level = String(i);
      this.levelRow.appendChild(span);
    }
    this.refreshMenuSelection();
  }

  private refreshMenuSelection(): void {
    Array.from(this.stageRow.children).forEach((el, i) => {
      el.classList.toggle('selected', i === this.menuStage);
    });
    Array.from(this.levelRow.children).forEach((el, i) => {
      el.classList.toggle('selected', i === this.menuLevel);
    });
    this.levelName.textContent = this.modes[this.menuStage].levelName(this.menuLevel);
  }

  private loop = (): void => {
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.frozen) {
      this.handleMenuInput();
    } else {
      this.current.update(dt, this.ctx);
    }

    this.renderer.render(this.current.scene, this.current.camera);
    this.input.endFrame();
    requestAnimationFrame(this.loop);
  };

  private handleMenuInput(): void {
    const { input } = this;
    if (input.isPressed('ArrowLeft') || input.isPressed('KeyA')) {
      this.menuStage = (this.menuStage + this.modes.length - 1) % this.modes.length;
      this.refreshMenuSelection();
    }
    if (input.isPressed('ArrowRight') || input.isPressed('KeyD')) {
      this.menuStage = (this.menuStage + 1) % this.modes.length;
      this.refreshMenuSelection();
    }
    if (input.isPressed('ArrowUp') || input.isPressed('KeyW')) {
      this.menuLevel = (this.menuLevel + LEVEL_COUNT - 1) % LEVEL_COUNT;
      this.refreshMenuSelection();
    }
    if (input.isPressed('ArrowDown') || input.isPressed('KeyS')) {
      this.menuLevel = (this.menuLevel + 1) % LEVEL_COUNT;
      this.refreshMenuSelection();
    }
    if (input.isPressed('Enter') || input.isPressed('Space')) {
      this.confirmMenuSelection();
    }
  }

  private confirmMenuSelection(): void {
    this.hideOverlay();
    this.frozen = false;
    this.state.score = 0;
    this.state.lives = 3;
    this.currentIndex = this.menuStage;
    this.currentLevel = this.menuLevel;
    this.current = this.modes[this.currentIndex];
    this.updateHud();
    this.applyModeResolution();
    this.current.enter(this.ctx, this.currentLevel);
  }

  private addScore(amount: number): void {
    this.state.score += amount;
    this.updateHud();
  }

  private loseLife(): void {
    this.state.lives -= 1;
    this.updateHud();
    if (this.state.lives <= 0) {
      this.current.exit();
      this.frozen = true;
      this.menuStage = 0;
      this.menuLevel = 0;
      this.refreshMenuSelection();
      this.showOverlay('GAME OVER', `Final score ${this.state.score}`);
    }
  }

  private handleModeResult(result: ModeResult): void {
    if (result.kind === 'playerDied') {
      this.loseLife();
      return;
    }

    // result.kind === 'advance': move to the next stage, wrapping back to Starfox
    // after on-foot finishes and bumping the shared difficulty level as it does.
    this.current.exit();
    this.currentIndex = (this.currentIndex + 1) % this.modes.length;
    if (this.currentIndex === 0) {
      if (this.currentLevel < LEVEL_COUNT - 1) {
        this.currentLevel += 1;
      } else {
        this.triggerGameComplete();
        return;
      }
    }
    this.current = this.modes[this.currentIndex];
    this.applyModeResolution();
    this.current.enter(this.ctx, this.currentLevel);
    this.updateHud();
  }

  private triggerGameComplete(): void {
    this.frozen = true;
    this.menuStage = 0;
    this.menuLevel = 0;
    this.refreshMenuSelection();
    this.showOverlay('YOU WIN!', `All 5 levels cleared - score ${this.state.score}`);
  }

  private applyModeResolution(): void {
    this.renderer.setSize(this.current.pixelWidth, this.current.pixelHeight, false);
    this.current.resize(this.current.pixelWidth, this.current.pixelHeight);
  }

  private updateHud(): void {
    this.hudMode.textContent = `${this.current.label} L${this.currentLevel + 1}`;
    this.hudScore.textContent = `SCORE ${String(this.state.score).padStart(6, '0')}`;
    this.hudLives.textContent = `LIVES ${Math.max(this.state.lives, 0)}`;
  }

  private showOverlay(title: string, subtitle: string): void {
    this.overlayTitle.textContent = title;
    this.overlaySubtitle.textContent = subtitle;
    this.overlay.classList.remove('hidden');
  }

  private hideOverlay(): void {
    this.overlay.classList.add('hidden');
  }
}

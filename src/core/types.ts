import type * as THREE from 'three';
import type { Input } from './input';

/** Mutable, shared run state that persists across mode transitions. */
export interface GameState {
  score: number;
  lives: number;
}

/** Every stage offers this many hand-tuned difficulty levels. */
export const LEVEL_COUNT = 5;

/** Outcome a mode reports when it finishes, telling the orchestrator what's next. */
export type ModeResult =
  | { kind: 'advance' }
  | { kind: 'playerDied' };

/** Services every mode needs; supplied by the orchestrator so modes stay decoupled. */
export interface ModeContext {
  renderer: THREE.WebGLRenderer;
  input: Input;
  state: GameState;
  /** Report score deltas, hits, etc. back to the HUD/orchestrator. */
  addScore(amount: number): void;
  loseLife(): void;
  /** Resolve this mode and let the orchestrator move to the next one. */
  finish(result: ModeResult): void;
}

/** A self-contained gameplay segment (Starfox rail shooter, Zaxxon flight, on-foot). */
export interface GameMode {
  readonly id: string;
  readonly label: string;
  readonly scene: THREE.Scene;
  readonly camera: THREE.Camera;
  /** Native render resolution for this mode; lower values read as chunkier pixels. */
  readonly pixelWidth: number;
  readonly pixelHeight: number;

  /** Human-readable name for a given level index (0-based), shown in the HUD and menu. */
  levelName(level: number): string;

  enter(ctx: ModeContext, level: number): void;
  update(dt: number, ctx: ModeContext): void;
  resize(width: number, height: number): void;
  exit(): void;
}

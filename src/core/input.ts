/**
 * Tracks keyboard state with both "held" and "just pressed this frame" semantics,
 * which every game mode needs (held for movement, just-pressed for firing/jumping).
 */
export class Input {
  private held = new Set<string>();
  private pressedThisFrame = new Set<string>();

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;
    if (!this.held.has(code)) {
      this.pressedThisFrame.add(code);
    }
    this.held.add(code);
    if (
      [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Space',
        'Enter',
      ].includes(code)
    ) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.held.delete(e.code);
  };

  isHeld(code: string): boolean {
    return this.held.has(code);
  }

  isPressed(code: string): boolean {
    return this.pressedThisFrame.has(code);
  }

  /** Axis helper: -1, 0, or 1 from a pair of keys (e.g. left/right). */
  axis(negative: string[], positive: string[]): number {
    const neg = negative.some((c) => this.held.has(c));
    const pos = positive.some((c) => this.held.has(c));
    return (pos ? 1 : 0) - (neg ? 1 : 0);
  }

  anyHeld(codes: string[]): boolean {
    return codes.some((c) => this.held.has(c));
  }

  anyPressed(codes: string[]): boolean {
    return codes.some((c) => this.pressedThisFrame.has(c));
  }

  /** Call once per frame after update logic has consumed "just pressed" state. */
  endFrame(): void {
    this.pressedThisFrame.clear();
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}

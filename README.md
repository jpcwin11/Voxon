# Voxon

A space shoot 'em up built with three.js that blends three classic arcade/console styles:

- **Starfox-style rail shooter** — chase-cam flight down a corridor, dodging arches and shooting enemy fighters.
- **Zaxxon-style isometric flight** — oblique following camera, strafe + altitude control to thread wall gaps and dodge pillars.
- **NES "Wizards & Warriors"-style on-foot segment** — the pilot gets out of the ship for a chunky, native-resolution 2D platforming stretch with pits and enemies.

The three segments play back-to-back as one looping vertical slice.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL in a browser.

## Controls

- **Arrow keys / WASD** — move (strafe + altitude, or run + aim)
- **Space / J** — fire / jump / attack (context-dependent per segment)
- **Enter** — start / continue past an overlay (game over, level complete)

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check and produce a production build in `dist/`
- `npm run preview` — preview the production build
- `npm run typecheck` — run `tsc` without emitting

## Project structure

```
src/
  core/      # Input handling, shared types, and the mode-switching orchestrator (Game)
  modes/     # StarfoxMode, ZaxxonMode, OnFootMode — each owns its own three.js scene/camera
  main.ts    # Entry point
```


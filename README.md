# Voxon

A space shoot 'em up built with three.js that blends three classic arcade/console styles:

- **Starfox-style rail shooter** — chase-cam flight down a corridor, dodging arches and shooting enemy fighters.
- **Zaxxon-style isometric flight** — oblique following camera, strafe + altitude control to thread wall gaps and dodge pillars.
- **NES "Wizards & Warriors"-style on-foot segment** — the pilot gets out of the ship for a chunky, native-resolution 2D platforming stretch with pits and enemies.

Each stage has **5 hand-tuned levels**. The three segments play back-to-back (Starfox → Zaxxon → On Foot) and loop back to Starfox at the next difficulty level once all three are cleared, until all 5 levels are beaten for the full-game win screen.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL in a browser.

## Stage/level select menu

The title screen, game-over screen, and win screen all show a stage/level picker:

- **Left / Right (or A / D)** — pick a stage (Starfox, Zaxxon, On Foot)
- **Up / Down (or W / S)** — pick a level (L1–L5), with its name shown below
- **Enter / Space** — confirm and start a fresh run (score/lives reset) at that stage and level

Picking a stage/level here is meant for jumping straight into practice or showing off a specific segment — a normal run always cycles Starfox → Zaxxon → On Foot → next level automatically without returning to this menu.

## Controls

- **Arrow keys / WASD** — move (strafe + altitude, or run + aim)
- **Space / J** — fire / jump / attack (context-dependent per segment)
- **Enter** — start / continue past an overlay (menu confirm, game over, win screen)

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check and produce a production build in `dist/`
- `npm run preview` — preview the production build
- `npm run typecheck` — run `tsc` without emitting

## Project structure

```
src/
  core/      # Input handling, shared types, mode-switching orchestrator (Game), and
             # procedural pixel-art texture helpers (pixelArt.ts)
  modes/     # StarfoxMode, ZaxxonMode, OnFootMode — each owns its own three.js scene/camera
             # and a LEVELS config array of 5 difficulty tiers
  main.ts    # Entry point
```


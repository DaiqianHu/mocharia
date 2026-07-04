# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Mocha Rush — a Papa's-style coffee shop simulator (Vite + HTML5 Canvas, no framework, no dependencies beyond Vite). The game evolves through wishlists from a young playtester relayed by the user; keep mechanics forgiving and the tone playful. `mocha-rush.html` at the repo root is an obsolete standalone version of the game kept as a backup — never edit it; all live code is under `src/`.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — production build (also the fastest syntax/import check; there is no lint or test suite)
- `npm run preview` — serve `dist/`

### Verifying changes (headless)

There is no test suite; verify gameplay changes by driving the real game in headless Chrome with `puppeteer-core` (system Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`). Pattern that works:

1. `npm run build`, then `npx vite preview --port 4231` in the background.
2. Launch puppeteer with viewport exactly **960×600** so virtual coordinates equal page coordinates (no letterbox offset). Collect `pageerror`/console errors and take screenshots.
3. `window.G` (game state) and `window.P` (progression) are exposed from `src/main.js` as debug/test handles — use `page.evaluate` to fast-forward state (e.g. set `G.day`, `P.xp`, fill `G.active.cup`, empty `G.customers` to force day end) instead of waiting out timers.
4. Mind real-time pacing when clicking: customers take ~4–5s to walk in before "Take Order" enables; machine brews run 13–20s.

## Architecture

Fixed 960×600 virtual resolution (`VW`/`VH` in `core/constants.js`), letterboxed + DPR-scaled onto a fullscreen canvas (`core/canvas.js`). Everything is immediate-mode: one `requestAnimationFrame` loop in `src/main.js` calls `update(dt)` (`game/state.js`) then `draw()` (`render/index.js`) every frame; there is no DOM UI and no retained scene graph.

**State machine:** `title → dayIntro → play → summary → shop → dayIntro …`, held in the single mutable global `G` (`game/state.js`). During `play`, `G.station` selects one of four stations: `order`, `brew`, `top`, `cannoli` (list in `game/layout.js`).

**Deliberate circular imports:** many modules import `G` from `state.js` while `state.js` imports their update functions (e.g. `stations/top.js`, `game/buttons.js`). This is safe because all cross-references happen inside functions at runtime, never at module-evaluation time. Keep that discipline when adding modules.

**Core flow of a served drink:**
- `game/data.js` — all content is data-driven catalogs (COFFEES, MILKS, CREAMS, DRIZZLES, SPRINKLE_SETS, RANKS, HOLIDAYS, SHOP_ITEMS). Ingredients carry either `rank: n` (unlocked at that rank) or `holiday: id` (unlocked by buying its shop item while that holiday is active). `makeOrder(day, unlocked)` only draws from unlocked items.
- `game/progress.js` — persistent progression `P` (xp, rank, owned shop items, holiday completion) saved to localStorage key `mocha-rush-save-v2`. Unlock filtering, rank-up math, and shop-effect helpers (`patienceCalm`, `brewSpeed`, `owns`) live here.
- `game/ticket.js` — a `Ticket` records what was actually made: `cup.coffee`/`cup.milk` ({type, temp, amt} poured from machines), topping coverage arrays + exact positions (x in −0.5..0.5 of cup width), and cannoli fill state.
- `game/scoring.js` — pure functions comparing ticket vs order, 0–100 per station (`orderScore` = patience, `brewScore`, `topScore`, `cannoliScore` — null when no cannoli ordered). `serveActive()` in state.js aggregates these into stars/tip/XP; `endDay()` averages them into per-station day ratings for the summary.
- Brew machines are global (`G.machines`, geometry in `layout.js` MACHINES), not per-ticket: configure type/temp/amount 1–3, timed via `COFFEE_TIME`/`MILK_TIME`, then pour into the active ticket.

**Interaction model:** `input.js` self-registers pointer listeners and routes taps through `game/buttons.js` (`BT` registry + `activeButtons()` per state + `refreshButtonState()` per frame — buttons are enabled/labeled there, not where they're drawn). Toppings and cannoli use a drag model: pointer-down on a shelf container sets `G.drag`, and the station's `updateTop`/`updateCannoli` emit topping exactly at the pointer while held over the target — recorded per-position so drawing and scoring reflect where the player actually applied it.

**Customers** (`game/customer.js`) never leave once queued: at zero patience they stomp and grumble but wait, punishing only the Order-station rating. Patience drain is scaled by owned decor (`patienceCalm()`).

**Rendering:** `render/scene.js` holds shared scenery, holiday theming (backdrop reads `currentHoliday()`), lobby decors, and `drawCup` (draws cup contents from `t.cup` plus toppings at recorded positions). `render/hud.js` = ticket rail + order checklist panel; `render/screens.js` = title/dayIntro/summary/shop/result overlays; each station module draws its own scene.

**Layout constants** (button rects in `buttons.js`, station geometry in `layout.js`) are hand-placed in virtual pixels; the play area is y≈100 (below the ticket rail, `RAIL_H`) to y≈546 (`TABS_Y`), with the side panel at x≥700 (`PANEL_X`) on non-order stations. Check for overlaps visually via screenshots when moving UI.

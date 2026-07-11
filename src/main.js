/* ============================================================
   MOCHA RUSH! — a Papa's-style coffee shop simulation.
   Entry point: wires the input listeners and runs the main loop.

   Architecture: fixed virtual resolution (960x600), letterboxed
   and DPR-aware; immediate-mode rendering; state machine:
   title -> dayIntro -> play (order/brew/top/cannoli) -> summary
   -> shop -> dayIntro ...

   Module map:
     core/      constants, canvas scaling, audio synth, particles
     ui/        the Btn widget
     game/      data (ingredients/ranks/holidays/shop), progress
                (XP + unlocks + save), layout, scoring, Customer,
                Ticket, buttons, and state.js (the controller)
     stations/  one module per station (order/brew/top/cannoli),
                each owning its own scene + interactions
     render/    scene helpers, HUD, screens, and the master draw()
     input.js   pointer routing (self-registers DOM listeners)
   ============================================================ */
import './core/canvas.js';   // sets up resize + DPR scaling on load
import './input.js';         // registers pointer listeners
import { update, G } from './game/state.js';
import { loadProgress, P } from './game/progress.js';
import { draw } from './render/index.js';
import { update3d } from './render/scene3d.js';
import { isGuest, netTick, netGuestUpdate } from './net/coop.js';
import { updateStickers } from './ui/stickers.js';
import * as DATA from './game/data.js';

G.hasSave = loadProgress();
if (G.hasSave){ G.best = P.best || 0; }
window.G = G; window.P = P; window.D = DATA;   // debug/test handles

let last=0;
function frame(ts){
  const dt=Math.min(0.05, last ? (ts-last)/1000 : 0.016);
  last=ts;
  // co-op guests run NO game sim: host snapshots replace update()
  if (isGuest()) netGuestUpdate(dt); else update(dt);
  updateStickers(dt, G.state==='play');   // co-op emote pops (no-op solo)
  netTick(dt);  // host snapshot/presence broadcast (no-op outside co-op)
  update3d();   // sync + render the WebGL scene (play only), then the 2D HUD
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

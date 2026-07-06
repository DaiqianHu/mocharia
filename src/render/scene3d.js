/* ============================================================
   3D scene orchestrator. Builds the café room plus the four station
   rigs (delegating geometry to each station module), runs every
   station's per-frame sync — the café is one continuous room, so all
   stations stay visible and the CAMERA (render/camera.js) is what
   changes when the player switches tabs — and renders. Thin layer
   over render/three.js; imports the station builders (circular-safe:
   every cross-reference runs inside a function at runtime).
   ============================================================ */
import { scene, camera, renderer,
         orderGroup, brewGroup, topGroup, cannoliGroup,
         setHolidayLighting } from './three.js';
import { buildCafe } from './cafe.js';
import { snapView, updateCamera } from './camera.js';
import { G, currentHoliday } from '../game/state.js';
import { buildOrder3D, updateOrder3D } from '../stations/order.js';
import { buildBrew3D, updateBrew3D } from '../stations/brew.js';
import { buildTop3D, updateTop3D } from '../stations/top.js';
import { buildCannoli3D, updateCannoli3D } from '../stations/cannoli.js';

let inited = false;
let lastHoliday = '__none__';
let lastNow = null;

export function initScene3d(){
  if (inited) return;
  inited = true;
  buildCafe();
  buildOrder3D(orderGroup);
  buildBrew3D(brewGroup);
  buildTop3D(topGroup);
  buildCannoli3D(cannoliGroup);
  snapView(G.station || 'order');
}

/* Called from main.js each frame after update(dt). Syncs the 3D scene to
   game state and renders — but only while playing (2D-only screens keep the
   opaque 2D letterbox fill covering #game3d). */
export function update3d(){
  if (G.state!=='play'){ lastNow = null; return; }
  if (!inited) initScene3d();

  const hol = currentHoliday();
  const hid = hol ? hol.id : '__none__';
  if (hid!==lastHoliday){ setHolidayLighting(hol); lastHoliday = hid; }

  // one continuous café: every station syncs every frame (each update is
  // a cheap model-reader), and the camera flight is the station switch.
  updateOrder3D();
  updateBrew3D();
  updateTop3D();
  updateCannoli3D();

  const now = performance.now()/1000;
  const dt = lastNow===null ? 0.016 : Math.min(0.05, now - lastNow);
  lastNow = now;
  updateCamera(dt, G.station, G.shakeX, G.shakeY);

  renderer.render(scene, camera);
}

/* ============================================================
   3D scene orchestrator. Builds the café room plus the four station
   rigs (delegating geometry to each station module), runs every
   station's per-frame sync — the café is one continuous room, so all
   stations stay visible and the CAMERA (render/camera.js) is what
   changes when the player switches tabs — and renders. Thin layer
   over render/three.js; imports the station builders (circular-safe:
   every cross-reference runs inside a function at runtime).
   ============================================================ */
import { scene, camera, projectVirtual,
         orderGroup, brewGroup, topGroup, cannoliGroup,
         setHolidayLighting } from './three.js';
import { buildCafe } from './cafe.js';
import { buildCat3D, updateCat3D, catScreen } from './cat.js';
import { snapView, updateCamera } from './camera.js';
import { renderInk } from './ink.js';
import { updateFx3d } from './fx3d.js';
import { RIGS, VIEWS, lobbyPos } from './layout3d.js';
import { MACHINES, TOP_CUP, CANNOLI } from '../game/layout.js';
import { G, currentHoliday } from '../game/state.js';
import { buildOrder3D, updateOrder3D } from '../stations/order.js';
import { buildBrew3D, updateBrew3D } from '../stations/brew.js';
import { buildTop3D, updateTop3D } from '../stations/top.js';
import { buildCannoli3D, updateCannoli3D, cannoliScreen } from '../stations/cannoli.js';

let inited = false;
let lastHoliday = '__none__';
let lastNow = null;

/* Debug/test surface (like window.G/P/R): project station anchors to
   virtual-pixel screen coords through the live camera so headless tests
   can click real scene positions without duplicating layout math. */
function rigPoint(rig, vx, vy, vz){
  const {anchor, at, s} = rig;
  return projectVirtual(
    at.x + s*(vx - anchor.ax),
    at.y + s*(anchor.ay - vy),
    at.z + s*(vz - anchor.az));
}
if (typeof window!=='undefined') window.V3 = {
  machineScreen: i => { const m=MACHINES[i]; return rigPoint(RIGS.brew, m.x+m.w/2, m.y+105, 14); },
  cupScreen:     (dy=125) => rigPoint(RIGS.top, TOP_CUP.cx, TOP_CUP.by-dy, 20),
  cannoliEnd:    end => cannoliScreen((end==='L'?-1:1)*CANNOLI.len/2, 0),
  custScreen:    cust => { const p=lobbyPos(cust.x,cust.y); return projectVirtual(p.x, 140, p.z); },
  catScreen:     () => catScreen(),
  RIGS, VIEWS,
};

export function initScene3d(){
  if (inited) return;
  inited = true;
  buildCafe();
  buildCat3D(orderGroup);
  buildOrder3D(orderGroup);
  buildBrew3D(brewGroup);
  buildTop3D(topGroup);
  buildCannoli3D(cannoliGroup);
  snapView(G.station || 'order');
}

/* Called from main.js each frame after update(dt). Syncs the 3D scene to
   game state and renders — during play, and during dayIntro where the café
   shows through a translucent card in a static wide establishing shot
   (2D-only screens keep the opaque 2D letterbox fill covering #game3d). */
export function update3d(){
  if (G.state!=='play' && G.state!=='dayIntro'){ lastNow = null; return; }
  if (!inited) initScene3d();

  const hol = currentHoliday();
  const hid = hol ? hol.id : '__none__';
  if (hid!==lastHoliday){ setHolidayLighting(hol); lastHoliday = hid; }

  const now = performance.now()/1000;
  const dt = lastNow===null ? 0.016 : Math.min(0.05, now - lastNow);
  lastNow = now;

  // one continuous café: every station syncs every frame (each update is
  // a cheap model-reader), and switching stations hard-cuts the camera.
  updateOrder3D();
  updateBrew3D(dt);
  updateTop3D();
  updateCannoli3D();
  updateCat3D(dt);
  updateFx3d(dt);

  if (G.state==='dayIntro') updateCamera('intro');
  else updateCamera(G.station, G.shakeX, G.shakeY);

  renderInk(scene, camera);
}

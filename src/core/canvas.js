/* ============================================================
   Canvas element, 2D context, and the fixed-virtual-resolution
   letterbox/DPR scaling. Sets up resize handling on load.
   ============================================================ */
import { VW, VH } from './constants.js';

export const canvas = document.getElementById('game');
export const ctx = canvas.getContext('2d');
export const VIEW = { scale:1, offX:0, offY:0, dpr:1 };

// modules (the 3D engine) register callbacks here to re-sync on every
// resize, after VIEW has been recomputed.
export const onResize = [];

export function resize(){
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width  = Math.max(1, Math.round(w*dpr));
  canvas.height = Math.max(1, Math.round(h*dpr));
  canvas.style.width  = w+'px';
  canvas.style.height = h+'px';
  VIEW.dpr = dpr;
  VIEW.scale = Math.min(w/VW, h/VH);
  VIEW.offX = (w - VW*VIEW.scale)/2;
  VIEW.offY = (h - VH*VIEW.scale)/2;
  for (const fn of onResize) fn(VIEW);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();

export function toVirtual(clientX, clientY){
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left - VIEW.offX)/VIEW.scale,
    y: (clientY - rect.top  - VIEW.offY)/VIEW.scale
  };
}

/* Virtual pixel -> normalized device coords for raycasting. Because the
   WebGL canvas is CSS-sized to cover exactly the VW x VH virtual rect, this
   mapping is a pure function of the virtual resolution — independent of the
   letterbox scale/offset/DPR (that's the whole point of the CSS approach). */
export function virtualToNDC(vx, vy){
  return { x: (vx/VW)*2 - 1, y: 1 - (vy/VH)*2 };
}
/* Inverse: project a world point back to virtual pixels (for anchoring 2D
   popText/particles onto 3D objects). `v` is a THREE.Vector3, mutated. */
export function worldToVirtual(v, camera){
  v.project(camera);
  return { x: (v.x+1)/2*VW, y: (1-v.y)/2*VH };
}

/* ============================================================
   Canvas element, 2D context, and the fixed-virtual-resolution
   letterbox/DPR scaling. Sets up resize handling on load.
   ============================================================ */
import { VW, VH } from './constants.js';

export const canvas = document.getElementById('game');
export const ctx = canvas.getContext('2d');
export const VIEW = { scale:1, offX:0, offY:0, dpr:1 };

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

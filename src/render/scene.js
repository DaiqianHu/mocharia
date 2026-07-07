/* ============================================================
   Shared 2D scenery drawing for the HUD-only screens: the shop
   backdrop (holiday aware) behind title/summary/shop, plus the
   station title card drawn over the WebGL scene. The in-play
   scenery itself is all 3D now (render/cafe.js + station rigs).
   ============================================================ */
import { VW, VH, TAU, rr } from '../core/constants.js';
import { RAIL_H } from '../game/layout.js';
import { currentHoliday } from '../game/state.js';

export function drawShopBackdrop(c){
  const h = currentHoliday();
  const g = c.createLinearGradient(0,0,0,VH);
  if (h){ g.addColorStop(0,h.sky[0]); g.addColorStop(1,h.sky[1]); }
  else { g.addColorStop(0,'#f8f5ee'); g.addColorStop(0.72,'#efe9db'); g.addColorStop(1,'#ddceb0'); }
  c.fillStyle=g; c.fillRect(0,0,VW,VH);
  if (!h){
    // white-wall paneling seams + a soft window-light falloff for depth
    c.strokeStyle='rgba(120,100,70,0.10)'; c.lineWidth=1.4;
    for(let x=60;x<VW;x+=120){ c.beginPath(); c.moveTo(x,0); c.lineTo(x,418); c.stroke(); }
    const lg=c.createRadialGradient(160,30,20,160,30,420);
    lg.addColorStop(0,'rgba(255,255,255,0.4)'); lg.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle=lg; c.fillRect(0,0,VW,420);
  }
  c.fillStyle='rgba(255,235,205,0.10)';
  for(let i=0;i<7;i++){ c.beginPath(); c.arc(80+i*140, 60+((i%2)*24), 34, 0, TAU); c.fill(); }
  // holiday garland along the rail
  if (h){
    for(let i=0;i<12;i++){
      const x=40+i*84;
      c.fillStyle = i%2 ? h.accent : 'rgba(255,244,214,0.85)';
      c.beginPath();
      c.moveTo(x,RAIL_H+4); c.lineTo(x+16,RAIL_H+4); c.lineTo(x+8,RAIL_H+22);
      c.closePath(); c.fill();
    }
  }
  c.fillStyle='rgba(60,30,14,0.14)'; c.fillRect(0,RAIL_H,VW,3);
}

/* the HUD title card (kept 2D over the WebGL scene) */
export function drawStationLabel(c, title){
  c.fillStyle='rgba(42,22,12,0.82)';
  rr(c,14,RAIL_H+10,240,36,10); c.fill();
  c.fillStyle='#ffe9b8';
  c.font='800 20px "Trebuchet MS", Verdana, sans-serif';
  c.textAlign='left'; c.textBaseline='middle';
  c.fillText(title, 28, RAIL_H+29);
}

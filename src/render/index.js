/* ============================================================
   Master draw — sets up the letterboxed/DPR transform and screen
   shake, then dispatches to the right screen or station scene.
   ============================================================ */
import { canvas, ctx, VIEW } from '../core/canvas.js';
import { VW, VH } from '../core/constants.js';
import { TABS_Y } from '../game/layout.js';
import { G } from '../game/state.js';
import { BT } from '../game/buttons.js';
import { drawParticles, drawFloats, drawAmbient } from '../core/particles.js';
import { drawOrderStation } from '../stations/order.js';
import { drawBrewStation } from '../stations/brew.js';
import { drawTopStation } from '../stations/top.js';
import { drawCannoliStation } from '../stations/cannoli.js';
import { drawRail, drawPanel } from './hud.js';
import { drawTitle, drawDayIntro, drawSummary, drawShop, drawResult } from './screens.js';

export function draw(){
  const d=VIEW.dpr;
  const play = G.state==='play';
  // letterbox / clear. During play the WebGL scene shows through #game3d, so
  // the 2D layer must be TRANSPARENT (clearRect) over the play area instead of
  // painting an opaque fill that would hide it. On 2D-only screens keep the
  // opaque #160d0b letterbox fill.
  ctx.setTransform(d,0,0,d,0,0);
  if (play){
    ctx.clearRect(0,0,canvas.width/d,canvas.height/d);
  } else {
    ctx.fillStyle='#160d0b';
    ctx.fillRect(0,0,canvas.width/d,canvas.height/d);
  }
  // virtual space (+ screen shake)
  ctx.setTransform(d*VIEW.scale,0,0,d*VIEW.scale,
    d*(VIEW.offX+G.shakeX*VIEW.scale), d*(VIEW.offY+G.shakeY*VIEW.scale));
  ctx.save();
  ctx.beginPath(); ctx.rect(0,0,VW,VH); ctx.clip();

  if (G.state==='title') drawTitle(ctx);
  else if (G.state==='dayIntro') drawDayIntro(ctx);
  else if (G.state==='summary') drawSummary(ctx);
  else if (G.state==='shop') drawShop(ctx);
  else if (G.state==='play'){
    if (G.station==='order') drawOrderStation(ctx);
    else if (G.station==='brew') drawBrewStation(ctx);
    else if (G.station==='top') drawTopStation(ctx);
    else drawCannoliStation(ctx);
    if (G.station!=='order') drawPanel(ctx);
    drawRail(ctx);
    // tabs
    ctx.fillStyle='#2c180e'; ctx.fillRect(0,TABS_Y-8,VW,VH-TABS_Y+8);
    for (const b of BT.tabs) b.draw(ctx);
    if (G.result) drawResult(ctx);
  }
  BT.mute.draw(ctx);
  drawAmbient(ctx);
  drawParticles(ctx);
  drawFloats(ctx);
  ctx.restore();
}

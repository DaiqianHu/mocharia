/* ============================================================
   Topping station — physical containers you PICK UP and drag
   over the drink. Whatever you're holding lands exactly where
   you hold it: whip dollops, drizzle lines, sprinkle showers.
   Coverage is recorded per position for drawing and scoring.
   ============================================================ */
import { TAU, rr, rand, clamp, choice, shade } from '../core/constants.js';
import { spawnParticle, popText } from '../core/particles.js';
import { blip, hiss } from '../core/audio.js';
import { TOP_CUP, RAIL_H } from '../game/layout.js';
import { COV_BINS } from '../game/ticket.js';
import { G, unlockedNow } from '../game/state.js';
import { BT } from '../game/buttons.js';
import { drawStationRoom, drawCup } from '../render/scene.js';

/* ---- the shelf of containers (rebuilt as unlocks change) ---- */
export function topShelf(){
  const u = unlockedNow();
  const list = [{cat:'whip', item:{id:'whip', name:'Whipped Cream', color:'#fffdf6'}}];
  for (const d of u.drizzles)  list.push({cat:'drizzle', item:d});
  for (const s of u.sprinkles) list.push({cat:'sprinkles', item:s});
  for (let i=0;i<list.length;i++){
    list[i].x = 70 + (i%3)*96;
    list[i].y = 196 + Math.floor(i/3)*88;
  }
  return list;
}

/* is the pointer over the drop zone above the drink? */
function overCup(px,py){
  const cup=TOP_CUP, topY=cup.by-cup.h;
  return px>cup.cx-cup.w/2-16 && px<cup.cx+cup.w/2+16 &&
         py>topY-110 && py<topY+60;
}
function relX(px){
  const cup=TOP_CUP;
  return clamp((px-cup.cx)/cup.w, -0.48, 0.48);
}
function markCov(cov, rx){
  const bin = clamp(Math.floor((rx+0.5)*COV_BINS), 0, COV_BINS-1);
  cov[bin] = Math.min(1, cov[bin]+0.34);
}

let emitAcc = 0;

export function updateTop(dt){
  const t=G.active, drag=G.drag;
  if (!t || !drag || G.station!=='top') return;
  const p=G.pointer;
  if (!p.down || !overCup(p.x,p.y)) return;
  const rx = relX(p.x), tp=t.top, cup=TOP_CUP, crownY=cup.by-cup.h;
  emitAcc += dt;
  if (drag.cat==='whip'){
    if (emitAcc<0.05) return; emitAcc=0;
    markCov(tp.whip.cov, rx);
    tp.whip.blobs.push({x:rx+rand(-0.02,0.02), size:rand(0.11,0.16)});
    if (tp.whip.blobs.length>26) tp.whip.blobs.shift();
    spawnParticle({type:'steam', x:p.x+rand(-4,4), y:crownY-8, vy:rand(-10,-30),
      size:rand(3,6), color:'rgba(255,252,242,0.9)', life:0.35, alpha:0.9});
    if (Math.random()<dt*20) hiss(0.08,0.03,3000);
  } else if (drag.cat==='drizzle'){
    if (emitAcc<0.03) return; emitAcc=0;
    if (!tp.drizzle || tp.drizzle.item.id!==drag.item.id)
      tp.drizzle = { item:drag.item, cov:new Array(COV_BINS).fill(0), pts:[] };
    markCov(tp.drizzle.cov, rx);
    tp.drizzle.pts.push({x:rx, y:rand(-4,7)});
    if (tp.drizzle.pts.length>60) tp.drizzle.pts.shift();
    spawnParticle({type:'drop', x:p.x, y:p.y+16, vy:rand(120,180), g:300,
      size:2.4, color:drag.item.color, life:0.3, alpha:0.95});
  } else if (drag.cat==='sprinkles'){
    if (emitAcc<0.045) return; emitAcc=0;
    if (!tp.sprinkles || tp.sprinkles.item.id!==drag.item.id)
      tp.sprinkles = { item:drag.item, cov:new Array(COV_BINS).fill(0), dots:[] };
    markCov(tp.sprinkles.cov, rx);
    const col = choice(drag.item.colors);
    tp.sprinkles.dots.push({x:rx+rand(-0.03,0.03), y:rand(-5,5), rot:rand(0,TAU), color:col});
    if (tp.sprinkles.dots.length>70) tp.sprinkles.dots.shift();
    spawnParticle({type:'sprinkle', x:p.x+rand(-6,6), y:p.y+14, vy:rand(90,150), g:480,
      size:rand(2.4,3.4), color:col, life:0.8, vr:rand(-8,8), settleY:crownY+rand(-4,4)});
  }
}

export function clearToppings(){
  const t=G.active; if(!t) return;
  t.top.whip = { cov:new Array(COV_BINS).fill(0), blobs:[] };
  t.top.drizzle=null; t.top.sprinkles=null;
  popText(TOP_CUP.cx, TOP_CUP.by-TOP_CUP.h-70, 'Wiped clean', '#ffe9a8', 16);
  blip(320,0.09,'triangle',0.1);
}

export function drawTopStation(c){
  drawStationRoom(c,'Topping Station');
  const t=G.active;
  drawCup(c, TOP_CUP, t, {});
  // shelf
  c.fillStyle='#6a4a2c'; c.font='800 14px Verdana, sans-serif';
  c.textAlign='left'; c.textBaseline='top';
  c.fillText('GRAB A TOPPING', 44, 156);
  const shelf = topShelf();
  for (const s of shelf){
    const held = G.drag && G.drag.cat===s.cat && G.drag.item.id===s.item.id;
    if (!held) drawContainer(c, s, s.x, s.y, false);
    else { // ghost slot
      c.strokeStyle='rgba(255,244,214,0.35)'; c.setLineDash([5,4]);
      rr(c,s.x-32,s.y-34,64,68,10); c.stroke(); c.setLineDash([]);
    }
  }
  // held container follows the pointer, tilted to pour
  if (G.drag && t){
    drawContainer(c, G.drag, G.pointer.x, G.pointer.y-14, true);
    if (overCup(G.pointer.x,G.pointer.y)){
      const glow=0.5+Math.sin(G.time*7)*0.3;
      c.strokeStyle='rgba(255,235,150,'+glow.toFixed(2)+')'; c.lineWidth=2.6; c.setLineDash([7,6]);
      rr(c,TOP_CUP.cx-TOP_CUP.w/2-14,TOP_CUP.by-TOP_CUP.h-56,TOP_CUP.w+28,66,12);
      c.stroke(); c.setLineDash([]);
    }
  }
  BT.topClear.draw(c);
  c.fillStyle='rgba(42,22,12,0.75)'; rr(c,268,RAIL_H+14,414,28,8); c.fill();
  c.fillStyle='#ffe9b8'; c.font='700 11px Verdana, sans-serif';
  c.textAlign='center'; c.textBaseline='middle';
  c.fillText('Drag a container over the drink — it pours right where you hold it!', 475, RAIL_H+28);
}

export function drawContainer(c, s, x, y, held){
  c.save();
  c.translate(x,y);
  if (held) c.rotate(-0.35);
  if (s.cat==='whip'){
    // whipped-cream canister
    c.fillStyle='#e8e2d6'; rr(c,-13,-22,26,44,7); c.fill();
    c.fillStyle='#d84a3a'; rr(c,-8,-32,16,12,4); c.fill();
    c.fillStyle='#b8b2a6'; rr(c,-3,-38,6,7,2); c.fill();
    c.fillStyle='#c8506a'; rr(c,-13,-6,26,14,2); c.fill();
  } else if (s.cat==='drizzle'){
    // squeeze bottle
    c.fillStyle=s.item.color; rr(c,-12,-18,24,40,8); c.fill();
    c.fillStyle=shade(s.item.color,30); rr(c,-12,-18,24,14,8); c.fill();
    c.fillStyle='#3a2a1c'; c.beginPath();
    c.moveTo(-4,-18); c.lineTo(4,-18); c.lineTo(1.6,-34); c.lineTo(-1.6,-34); c.closePath(); c.fill();
  } else {
    // sprinkle cup
    c.fillStyle='#f4ecdc';
    c.beginPath(); c.moveTo(-16,-16); c.lineTo(16,-16); c.lineTo(12,18); c.lineTo(-12,18); c.closePath(); c.fill();
    c.strokeStyle='#c8b8a0'; c.lineWidth=2; c.stroke();
    for (let i=0;i<8;i++){
      c.save(); c.translate(-10+ (i%4)*6.6, -10+Math.floor(i/4)*7); c.rotate(i*1.3);
      c.fillStyle=s.item.colors[i%s.item.colors.length];
      rr(c,-2.6,-1,5.2,2,1); c.fill(); c.restore();
    }
  }
  c.restore();
  if (!held){
    c.fillStyle='rgba(42,22,12,0.75)'; rr(c,x-46,y+26,92,17,6); c.fill();
    c.fillStyle='#ffe9b8'; c.font='700 9px Verdana, sans-serif';
    c.textAlign='center'; c.textBaseline='middle';
    c.fillText(s.item.name, x, y+35);
  }
}

/* hit-test the shelf for pointer-down (input.js) */
export function shelfHit(x,y){
  for (const s of topShelf())
    if (Math.abs(x-s.x)<34 && Math.abs(y-s.y)<38) return s;
  return null;
}

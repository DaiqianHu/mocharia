/* ============================================================
   Topping station — physical containers you PICK UP and drag
   over the drink. Whatever you're holding lands exactly where
   you hold it: whip dollops, drizzle lines, sprinkle showers.
   Coverage is recorded per position for drawing and scoring.
   ============================================================ */
import { TAU, rr, rand, clamp, choice, shade, mixHex } from '../core/constants.js';
import { spawnParticle, popText } from '../core/particles.js';
import { blip, hiss } from '../core/audio.js';
import { TOP_CUP, RAIL_H } from '../game/layout.js';
import { SIZE_CAP, SIZE_SCALE, SIZE_NAME } from '../game/data.js';
import { COV_BINS } from '../game/ticket.js';
import { G, unlockedNow, currentHoliday } from '../game/state.js';
import { BT } from '../game/buttons.js';
import { drawStationLabel } from '../render/scene.js';

/* ---- compact shelf layout, shared with the cannoli station ----
   Holiday-exclusive items live in a reserved "seasonal" slot row that
   exists even when empty, so unlocks never reshuffle the base grid. */
export const SHELF = { x0:54, seasonalY:192, y0:248 };
export function placeShelf(base, seasonal, cols=4, dx=76, dy=62){
  for (let i=0;i<seasonal.length;i++){
    seasonal[i].x = 70 + i*66; seasonal[i].y = SHELF.seasonalY; seasonal[i].seasonal = true;
  }
  for (let i=0;i<base.length;i++){
    base[i].x = SHELF.x0 + (i%cols)*dx;
    base[i].y = SHELF.y0 + Math.floor(i/cols)*dy;
  }
  return [...seasonal, ...base];
}
/* the dashed seasonal box + section header, shared by both shelves */
export function drawShelfFrame(c, title, seasonalCount){
  c.fillStyle='#f0e2c8'; c.font='800 14px Verdana, sans-serif';
  c.textAlign='left'; c.textBaseline='top';
  c.fillText(title, 44, 140);
  const hol = currentHoliday();
  c.strokeStyle = hol ? hol.accent : 'rgba(255,244,214,0.35)';
  c.lineWidth=2; c.setLineDash([6,5]);
  rr(c, 40, 162, 232, 58, 10); c.stroke(); c.setLineDash([]);
  c.fillStyle = hol ? hol.accent : 'rgba(255,244,214,0.5)';
  c.font='800 9px Verdana, sans-serif';
  c.fillText('✦ SEASONAL', 48, 154);
  if (!seasonalCount){
    c.fillStyle='rgba(255,244,214,0.4)'; c.font='700 10px Verdana, sans-serif';
    c.textAlign='center'; c.textBaseline='middle';
    c.fillText('holiday treats appear here', 156, 191);
  }
}

/* ---- the shelf of containers (rebuilt as unlocks change) ---- */
export function topShelf(){
  const u = unlockedNow();
  const base = [{cat:'whip', item:{id:'whip', name:'Whipped Cream', color:'#fffdf6'}}];
  const seasonal = [];
  for (const d of u.drizzles)  (d.holiday?seasonal:base).push({cat:'drizzle', item:d});
  for (const s of u.sprinkles) (s.holiday?seasonal:base).push({cat:'sprinkles', item:s});
  return placeShelf(base, seasonal);
}

function markCov(cov, rx){
  const bin = clamp(Math.floor((rx+0.5)*COV_BINS), 0, COV_BINS-1);
  cov[bin] = Math.min(1, cov[bin]+0.34);
}

let emitAcc = 0;

export function updateTop(dt){
  const t=G.active, drag=G.drag;
  if (!t || !t.cupSize || !drag || G.station!=='top') return;
  const p=G.pointer;
  if (!p.down) return;
  // the drop zone is the raycast cup-plane (source of truth for relX).
  // relX is a fraction of the FULL-size cup width; smaller cups are a
  // scaled-down group, so divide by the size scale to keep the pour
  // landing under the pointer.
  const hit = hitTestScene(p.x, p.y, 'top');
  if (!hit || hit.kind!=='cup') return;
  const sizeS = SIZE_SCALE[t.cupSize] || 1;
  const rx = clamp(hit.relX/sizeS, -0.48, 0.48);
  const tp=t.top, cup=TOP_CUP, crownY=cup.by-cup.h;
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

/* ---- cup-size picker (the first step at this station) ---- */
export function chooseSize(sz){
  const t=G.active; if(!t || t.cupSize===sz) return;
  t.cupSize = sz;
  const s = cupScreen(TOP_CUP.h + 60);
  popText(s.x, s.y, SIZE_NAME[sz]+' cup!', '#ffe9a8', 17);
  blip(sz==='S'?520:sz==='M'?600:680, 0.09, 'triangle', 0.11);
}

/* the "Small cup · tap to change" card under the cup — drawn at the
   cup's projected screen position; the hit rect is wherever it was
   last drawn (kept in _sizeCard so draw + hit-test always agree) */
let _sizeCard = null;
export function sizeCardHit(x,y){
  if (!_sizeCard) return false;
  return Math.abs(x-_sizeCard.x)<=62 && y>=_sizeCard.y && y<=_sizeCard.y+22;
}

/* project a point `dy` world-units above the cup base to virtual px */
function cupScreen(dy){
  const a = RIGS.top.at;
  return projectVirtual(a.x, a.y + RIGS.top.s*dy, a.z);
}

/* 2D glass-cup icon for the picker, scaled like the real 3D cups */
function drawCupIcon(c, cx, byY, s){
  const w=68*s, h=100*s, bw=w*0.78;
  c.save();
  c.fillStyle='rgba(30,14,8,0.28)';
  c.beginPath(); c.ellipse(cx, byY+4, w*0.6, 7*s, 0, 0, TAU); c.fill();
  const g=c.createLinearGradient(cx-w/2,0,cx+w/2,0);
  g.addColorStop(0,'rgba(223,238,245,0.55)'); g.addColorStop(0.45,'rgba(223,238,245,0.2)');
  g.addColorStop(1,'rgba(150,185,205,0.5)');
  c.beginPath();
  c.moveTo(cx-bw/2, byY); c.lineTo(cx-w/2, byY-h);
  c.lineTo(cx+w/2, byY-h); c.lineTo(cx+bw/2, byY); c.closePath();
  c.fillStyle=g; c.fill();
  c.strokeStyle='rgba(234,244,250,0.9)'; c.lineWidth=2.5; c.stroke();
  c.beginPath(); c.ellipse(cx, byY-h, w/2, 7*s, 0, 0, TAU); c.stroke();
  c.fillStyle='rgba(255,255,255,0.35)';
  rr(c, cx-w/2+7*s, byY-h+12*s, 7*s, h-24*s, 4*s); c.fill();
  c.restore();
}

function drawSizePicker(c, t){
  c.fillStyle='rgba(30,15,8,0.6)'; rr(c,110,150,580,352,18); c.fill();
  c.strokeStyle='rgba(255,233,184,0.35)'; c.lineWidth=2; rr(c,110,150,580,352,18); c.stroke();
  c.textAlign='center'; c.textBaseline='middle';
  c.fillStyle='#ffe9b8'; c.font='800 24px "Trebuchet MS", Verdana, sans-serif';
  c.fillText('Pick a cup size!', 400, 190);
  c.fillStyle='rgba(255,233,184,0.85)'; c.font='700 13px Verdana, sans-serif';
  c.fillText('What size did '+t.cust.name+' ask for? Check the order!', 400, 220);
  const cx=[220,400,580];
  for (let i=0;i<3;i++){
    const sz=['S','M','L'][i];
    drawCupIcon(c, cx[i], 404, SIZE_SCALE[sz]);
    BT.sizeBtns[i].draw(c);
  }
}

export function clearToppings(){
  const t=G.active; if(!t) return;
  t.top.whip = { cov:new Array(COV_BINS).fill(0), blobs:[] };
  t.top.drizzle=null; t.top.sprinkles=null;
  const s = cupScreen(TOP_CUP.h + 80);
  popText(s.x, s.y, 'Wiped clean', '#ffe9a8', 16);
  blip(320,0.09,'triangle',0.1);
}

export function drawTopStation(c){
  drawStationLabel(c,'Topping Station');
  const t=G.active;
  // no size picked yet: the picker is the whole station
  if (t && !t.cupSize){ drawSizePicker(c, t); return; }
  // shelf of containers (2D tool palette over the 3D cup)
  const shelf = topShelf();
  drawShelfFrame(c, 'GRAB A TOPPING', shelf.filter(s=>s.seasonal).length);
  const p=G.pointer;
  for (const s of shelf){
    const held = G.drag && G.drag.cat===s.cat && G.drag.item.id===s.item.id;
    if (!held){
      drawContainer(c, s, s.x, s.y, false, 0.72);
      // name label only on hover — 20+ unlocked containers get cluttered fast
      if (Math.abs(p.x-s.x)<34 && Math.abs(p.y-s.y)<30) drawShelfLabel(c, s.item.name, s.x, s.y);
    } else { // ghost slot
      c.strokeStyle='rgba(255,244,214,0.35)'; c.setLineDash([5,4]);
      rr(c,s.x-25,s.y-27,50,54,9); c.stroke(); c.setLineDash([]);
    }
  }
  // size card under the cup — shows YOUR pick, tap it to change your mind
  if (t){
    const base = cupScreen(-16);
    _sizeCard = { x: base.x, y: base.y };
    c.fillStyle='rgba(42,22,12,0.75)'; rr(c,base.x-62,base.y,124,22,8); c.fill();
    c.fillStyle='#ffe9b8'; c.font='800 11px Verdana, sans-serif';
    c.textAlign='center'; c.textBaseline='middle';
    c.fillText(SIZE_NAME[t.cupSize]+' cup · change', base.x, base.y+11);
  }
  // held container follows the pointer, tilted to pour
  if (G.drag && t){
    drawContainer(c, G.drag, G.pointer.x, G.pointer.y-14, true);
    if (hitTestScene(G.pointer.x, G.pointer.y, 'top')){
      const glow=0.5+Math.sin(G.time*7)*0.3;
      const tl = cupScreen(TOP_CUP.h + 10);
      const halfW = (cupScreen(TOP_CUP.h + 10).x - projectVirtual(
        RIGS.top.at.x - RIGS.top.s*(TOP_CUP.w/2+14), RIGS.top.at.y + RIGS.top.s*(TOP_CUP.h+10), RIGS.top.at.z).x);
      c.strokeStyle='rgba(255,235,150,'+glow.toFixed(2)+')'; c.lineWidth=2.6; c.setLineDash([7,6]);
      rr(c, tl.x-Math.abs(halfW), tl.y-56, Math.abs(halfW)*2, 66, 12);
      c.stroke(); c.setLineDash([]);
    }
  }
  BT.topClear.draw(c);
  c.fillStyle='rgba(42,22,12,0.75)'; rr(c,268,RAIL_H+14,414,28,8); c.fill();
  c.fillStyle='#ffe9b8'; c.font='700 11px Verdana, sans-serif';
  c.textAlign='center'; c.textBaseline='middle';
  c.fillText('Drag a container over the drink — it pours right where you hold it!', 475, RAIL_H+28);
}

export function drawShelfLabel(c, name, x, y){
  c.fillStyle='rgba(42,22,12,0.85)'; rr(c,x-50,y+24,100,17,6); c.fill();
  c.fillStyle='#ffe9b8'; c.font='700 9px Verdana, sans-serif';
  c.textAlign='center'; c.textBaseline='middle';
  c.fillText(name, x, y+33, 94);
}

export function drawContainer(c, s, x, y, held, scale=1){
  c.save();
  c.translate(x,y);
  c.scale(scale,scale);
  if (!held){
    c.fillStyle='rgba(30,14,8,0.22)';
    c.beginPath(); c.ellipse(0, 30, 17, 5, 0, 0, TAU); c.fill();
  }
  if (held) c.rotate(-0.35);
  const outC='rgba(40,26,14,0.5)';
  const gloss=(gx,gy,gr)=>{ const g=c.createRadialGradient(gx,gy,0,gx,gy,gr);
    g.addColorStop(0,'rgba(255,255,255,0.8)'); g.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle=g; c.beginPath(); c.ellipse(gx,gy,gr*0.55,gr,0,0,TAU); c.fill(); };
  if (s.cat==='whip'){
    // whipped-cream canister — cylindrical body: light-to-dark gradient + a glossy rim streak
    const bg=c.createLinearGradient(-13,0,13,0);
    bg.addColorStop(0,'#fbfaf6'); bg.addColorStop(0.4,'#e8e2d6'); bg.addColorStop(1,'#b8b0a0');
    c.fillStyle=bg; rr(c,-13,-22,26,44,7); c.fill();
    c.strokeStyle=outC; c.lineWidth=2.4; rr(c,-13,-22,26,44,7); c.stroke();
    gloss(-6,-8,9);
    const cg=c.createLinearGradient(-8,0,8,0);
    cg.addColorStop(0,'#ff7a68'); cg.addColorStop(0.5,'#ec4a36'); cg.addColorStop(1,'#a82418');
    c.fillStyle=cg; rr(c,-8,-32,16,12,4); c.fill();
    c.strokeStyle=outC; c.lineWidth=2; rr(c,-8,-32,16,12,4); c.stroke();
    c.fillStyle='#b8b2a6'; rr(c,-3,-38,6,7,2); c.fill();
    const lg=c.createLinearGradient(-13,0,13,0);
    lg.addColorStop(0,'#f28aa6'); lg.addColorStop(1,'#b03a58');
    c.fillStyle=lg; rr(c,-13,-6,26,14,2); c.fill();
    c.strokeStyle=outC; c.lineWidth=2; rr(c,-13,-6,26,14,2); c.stroke();
  } else if (s.cat==='drizzle'){
    // squeeze bottle — cylindrical gradient body + specular highlight + gradient cap
    const bg=c.createLinearGradient(-12,0,12,0);
    bg.addColorStop(0, shade(s.item.color,60)); bg.addColorStop(0.42, shade(s.item.color,12)); bg.addColorStop(1, shade(s.item.color,-38));
    c.fillStyle=bg; rr(c,-12,-18,24,40,8); c.fill();
    c.strokeStyle=outC; c.lineWidth=2.4; rr(c,-12,-18,24,40,8); c.stroke();
    const ng=c.createLinearGradient(-12,0,12,0);
    ng.addColorStop(0, shade(s.item.color,75)); ng.addColorStop(0.5, shade(s.item.color,34)); ng.addColorStop(1, shade(s.item.color,-12));
    c.fillStyle=ng; rr(c,-12,-18,24,14,8); c.fill();
    gloss(-6,-2,8);
    c.fillStyle='#3a2a1c'; c.beginPath();
    c.moveTo(-4,-18); c.lineTo(4,-18); c.lineTo(1.6,-34); c.lineTo(-1.6,-34); c.closePath(); c.fill();
    c.strokeStyle=outC; c.lineWidth=1.6; c.stroke();
  } else {
    // sprinkle cup — translucent plastic gradient + individually shaded sprinkles
    const pg=c.createLinearGradient(0,-16,0,18);
    pg.addColorStop(0,'#fffdf8'); pg.addColorStop(1,'#e2d6bc');
    c.beginPath(); c.moveTo(-16,-16); c.lineTo(16,-16); c.lineTo(12,18); c.lineTo(-12,18); c.closePath();
    c.fillStyle=pg; c.fill();
    c.strokeStyle=outC; c.lineWidth=2.4; c.stroke();
    gloss(-8,-2,7);
    for (let i=0;i<8;i++){
      c.save(); c.translate(-10+ (i%4)*6.6, -10+Math.floor(i/4)*7); c.rotate(i*1.3);
      const col=s.item.colors[i%s.item.colors.length];
      c.fillStyle=shade(col,-25); rr(c,-2.6,-0.5,5.2,2,1); c.fill();
      c.fillStyle=shade(col,25); rr(c,-2.6,-1.4,5.2,1.6,1); c.fill();
      c.restore();
    }
  }
  c.restore();
}

/* hit-test the shelf for pointer-down (input.js) */
export function shelfHit(x,y){
  for (const s of topShelf())
    if (Math.abs(x-s.x)<34 && Math.abs(y-s.y)<28) return s;
  return null;
}

/* ============================================================
   3D cup + toppings. The cup shell is a lathed translucent glass;
   fluids are scale-from-anchor cylinders (coffee then milk); whip is
   an InstancedMesh of blobs; drizzle a rebuilt tube; sprinkles an
   InstancedMesh with per-instance color. The drop-zone collider plane
   feeds relX back to updateTop() via the raycaster.
   ============================================================ */
import { THREE, place, mat, shadowDecal, colliders, hitTestScene, colliderMaterial, TOON_RAMP, stationRig, projectVirtual } from '../render/three.js';
import { RIGS } from '../render/layout3d.js';

const CUPH = TOP_CUP.h, CUPTOPR = TOP_CUP.w/2, CUPBOTR = TOP_CUP.w*0.78/2;
const FLUID_INSET = 3;   // keep fluid just inside the glass wall
const BASE_Y = 8;        // cup inner floor (where the wall reaches full CUPBOTR)
let cup3d = null;

// radius of the glass at height y (0..CUPH), matching cupProfile()
function cupRadiusAt(y){
  const yy = Math.max(0, Math.min(CUPH, y));
  if (yy<=8) return CUPBOTR*0.55 + (CUPBOTR - CUPBOTR*0.55)*(yy/8);
  return CUPBOTR + (CUPTOPR - CUPBOTR)*((yy-8)/(CUPH-8));
}
// a fluid layer from height y0 to y1 whose walls follow the cup taper
function fluidFrustum(y0, y1){
  const h = Math.max(0.001, y1-y0);
  const r0 = Math.max(0.5, cupRadiusAt(y0)-FLUID_INSET);
  const r1 = Math.max(0.5, cupRadiusAt(y1)-FLUID_INSET);
  const g = new THREE.CylinderGeometry(r1, r0, h, 28, 1, false);
  g.translate(0, y0 + h/2, 0);
  return g;
}
function cupProfile(){
  // lathe profile points (x=radius, y from 0 at base to CUPH at rim)
  const pts = [];
  pts.push(new THREE.Vector2(0, 0));
  pts.push(new THREE.Vector2(CUPBOTR*0.55, 0));
  pts.push(new THREE.Vector2(CUPBOTR, 8));
  pts.push(new THREE.Vector2(CUPTOPR, CUPH));
  pts.push(new THREE.Vector2(CUPTOPR-2, CUPH));   // rim inner
  return pts;
}

export function buildTop3D(group){
  // cup geometry stays in old virtual-pixel local space; the rig scales
  // it down onto the café's topping island (layout3d.js)
  const rig = stationRig(RIGS.top.anchor, RIGS.top.at, RIGS.top.s);
  group.add(rig);

  const cup = new THREE.Group();
  place(cup, TOP_CUP.cx, TOP_CUP.by, 20);
  rig.add(cup);

  const shadow = shadowDecal(CUPTOPR*1.5, CUPTOPR*0.7);
  shadow.position.set(0,1,0);
  cup.add(shadow);

  // one blended fluid volume (coffee + milk + add-ins mixed like a real
  // drink, not stacked blocks) capped by a lighter foam/crema surface.
  // Geometry rebuilt to follow the cup taper when the fill changes.
  const fluidMat = mat('#3a2317', {rough:0.45, noCache:true});
  const foamMat  = mat('#f4ecdb', {rough:0.7, noCache:true});
  const fluid = new THREE.Mesh(new THREE.BufferGeometry(), fluidMat);
  const foam  = new THREE.Mesh(new THREE.BufferGeometry(), foamMat);
  fluid.visible = foam.visible = false;
  cup.add(fluid, foam);

  // glass shell (translucent, drawn over fluids)
  const shellGeo = new THREE.LatheGeometry(cupProfile(), 36);
  const shellMat = new THREE.MeshToonMaterial({
    color:0xdfeef5, gradientMap:TOON_RAMP, transparent:true, opacity:0.26,
    depthWrite:false, side:THREE.DoubleSide });
  const shell = new THREE.Mesh(shellGeo, shellMat);
  shell.renderOrder = 5;
  cup.add(shell);
  // rim ring
  const rim = new THREE.Mesh(new THREE.TorusGeometry(CUPTOPR, 3, 8, 36),
    mat('#eaf4fa',{rough:0.2,metal:0.1}));
  rim.rotation.x = Math.PI/2; rim.position.y = CUPH; rim.renderOrder = 6;
  cup.add(rim);

  // whip: instanced spheres
  const whip = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8),
    mat('#fffdf6',{rough:0.6, noCache:true}), 26);
  whip.count = 0; whip.renderOrder = 7;
  cup.add(whip);

  // sprinkles: instanced rounded boxes with per-instance color
  const spr = new THREE.InstancedMesh(new THREE.BoxGeometry(6.5,2.4,2.4),
    new THREE.MeshToonMaterial({gradientMap:TOON_RAMP}), 70);
  spr.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(70*3),3);
  spr.count = 0; spr.renderOrder = 8;
  cup.add(spr);

  // drizzle tube (geometry rebuilt on throttle)
  const drizMat = mat('#4a2c17',{rough:0.35, noCache:true});
  const driz = new THREE.Mesh(new THREE.BufferGeometry(), drizMat);
  driz.renderOrder = 8;
  cup.add(driz);

  // ice cubes (shown for cold drinks)
  const ice = new THREE.Group();
  for (let i=0;i<3;i++){
    const cube = new THREE.Mesh(new THREE.BoxGeometry(16,16,16),
      new THREE.MeshToonMaterial({color:0xdff0ff, gradientMap:TOON_RAMP, transparent:true, opacity:0.6}));
    cube.rotation.set(rand(0,1),rand(0,1),rand(0,1));
    ice.add(cube);
  }
  cup.add(ice);

  // drop-zone collider plane (feeds relX). worldToLocal(hit).x / w -> -0.5..0.5
  const zone = new THREE.Mesh(new THREE.PlaneGeometry(TOP_CUP.w, CUPH+140), colliderMaterial());
  zone.userData.w = TOP_CUP.w;
  place(zone, TOP_CUP.cx, TOP_CUP.by - CUPH/2 - 30, 40);
  rig.add(zone);
  colliders.cupZone = zone;

  cup3d = { cup, fluid, foam, shell, whip, spr, driz, drizMat, fluidMat, foamMat, ice };
}

const USABLE = CUPH - BASE_Y;   // fillable height above the cup floor
let drizKey = '', fluidKey = '';

export function updateTop3D(){
  if (!cup3d) return;
  const t = G.active;
  const { cup, fluid, foam, shell, whip, spr, driz, fluidMat, foamMat, ice } = cup3d;
  // while the size picker is up there is no cup on the counter yet
  cup.visible = !(t && !t.cupSize);
  if (!cup.visible) return;
  shell.visible = true;
  const cc = t ? t.cup.coffee : null;
  const mm = t ? t.cup.milk : null;

  // small / medium / large cup — the whole group scales from its base
  const size = t ? t.cupSize : 'M';
  cup.scale.setScalar(SIZE_SCALE[size]);

  // blended fluid: everything poured mixes into one color, the way a
  // real latte does — coffee + milk + any syrup/powder add-ins
  const units = (cc?cc.amt:0) + (mm?mm.amt:0);
  let topY = BASE_Y;   // running surface height
  if (units>0){
    const pairs = [];
    if (cc){ pairs.push([cc.type.color, cc.amt]); if (cc.addin) pairs.push([cc.addin.color, units*0.4]); }
    if (mm){ pairs.push([mm.type.color, mm.amt*1.25]); if (mm.addin) pairs.push([mm.addin.color, units*0.4]); }
    const col = mixHex(pairs);
    const frac = Math.min(1, units / SIZE_CAP[size]);
    const y1 = BASE_Y + frac*USABLE;
    const key = size + '|' + frac.toFixed(3);
    if (key !== fluidKey){
      fluidKey = key;
      fluid.geometry.dispose();
      fluid.geometry = fluidFrustum(BASE_Y, y1-2);
      foam.geometry.dispose();
      foam.geometry = fluidFrustum(y1-3.5, y1);
    }
    fluid.visible = foam.visible = true;
    fluidMat.color.set(col);
    // milky drinks get pale foam; straight coffee gets a crema ring
    foamMat.color.set(mm ? mixHex([[col,1],['#fff6e8',2.2]]) : mixHex([[col,1],['#e8a860',0.9]]));
    topY = y1;
  } else { fluid.visible = foam.visible = false; fluidKey = ''; }
  const surfY = topY;

  // ice
  const iced = (cc && cc.temp==='iced') || (mm && mm.temp==='cold');
  ice.visible = iced && surfY>BASE_Y;
  if (ice.visible){
    for (let i=0;i<ice.children.length;i++){
      const c=ice.children[i];
      c.position.set((i-1)*CUPTOPR*0.5, Math.max(14,surfY-10)+Math.sin(G.time*1.5+i)*2, 6);
      c.rotation.y += 0.003;
    }
  }

  // whip
  const tp = t ? t.top : null;
  const baseY = Math.max(surfY, 14);
  if (tp && tp.whip.blobs.length){
    whip.count = tp.whip.blobs.length;
    const m = new THREE.Matrix4();
    for (let i=0;i<whip.count;i++){
      const b=tp.whip.blobs[i], r=b.size*TOP_CUP.w;
      m.makeTranslation(b.x*TOP_CUP.w, baseY+4, 8);
      m.scale(new THREE.Vector3(r,r*0.9,r));
      whip.setMatrixAt(i,m);
    }
    whip.instanceMatrix.needsUpdate = true;
  } else whip.count = 0;

  const crownY = baseY + (tp && tp.whip.blobs.length ? 20 : 4);

  // drizzle
  if (tp && tp.drizzle && tp.drizzle.pts.length>1){
    cup3d.drizMat.color.set(tp.drizzle.item.color);
    const key = tp.drizzle.item.id+'|'+tp.drizzle.pts.length;
    if (key!==drizKey){
      drizKey = key;
      const pts = tp.drizzle.pts.map(p=> new THREE.Vector3(p.x*TOP_CUP.w, crownY+p.y*0.4, 11));
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, Math.min(80,pts.length*2), 2.6, 6, false);
      driz.geometry.dispose(); driz.geometry = geo;
    }
    driz.visible = true;
  } else { driz.visible = false; drizKey=''; }

  // sprinkles
  if (tp && tp.sprinkles && tp.sprinkles.dots.length){
    spr.count = tp.sprinkles.dots.length;
    const m = new THREE.Matrix4(); const col = new THREE.Color();
    for (let i=0;i<spr.count;i++){
      const d=tp.sprinkles.dots[i];
      m.makeRotationZ(d.rot);
      m.setPosition(d.x*TOP_CUP.w, crownY+d.y*0.4, 12);
      spr.setMatrixAt(i,m);
      col.set(d.color); spr.setColorAt ? spr.setColorAt(i,col) : null;
    }
    spr.instanceMatrix.needsUpdate = true;
    if (spr.instanceColor) spr.instanceColor.needsUpdate = true;
  } else spr.count = 0;
}

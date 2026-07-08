/* ============================================================
   Cannoli station — pipe cream into BOTH ends of the shell
   (caramel, oreo, chocolate... whatever's unlocked), then shower
   sprinkles onto the cream at either end. Uses the same
   drag-a-container interaction as the topping station.
   ============================================================ */
import { TAU, rr, rand, clamp, choice, shade } from '../core/constants.js';
import { spawnParticle, popText } from '../core/particles.js';
import { blip, hiss } from '../core/audio.js';
import { CANNOLI, RAIL_H } from '../game/layout.js';
import { G, unlockedNow } from '../game/state.js';
import { BT } from '../game/buttons.js';
import { drawStationLabel } from '../render/scene.js';
import { drawContainer, placeShelf, drawShelfFrame, drawShelfLabel } from './top.js';

/* shelf: tap-to-pick shells, then cream piping bags + sprinkle cups.
   Denser 5-column grid — this station has the biggest catalog. */
export function cannoliShelf(){
  const u = unlockedNow();
  const base = u.shells.map(sh=>({cat:'shell', item:sh}));
  const seasonal = [];
  for (const cr of u.creams)    (cr.holiday?seasonal:base).push({cat:'cream', item:cr});
  for (const s of u.sprinkles)  (s.holiday?seasonal:base).push({cat:'endsprinkles', item:s});
  return placeShelf(base, seasonal, 5, 60, 56);
}
export function cannoliShelfHit(x,y){
  for (const s of cannoliShelf())
    if (Math.abs(x-s.x)<27 && Math.abs(y-s.y)<26) return s;
  return null;
}

/* tapping a shell on the shelf picks it (no dragging) — the shell is
   chosen BEFORE any cream goes in; switching shells restarts the build */
export function chooseShell(item, ctx=G){
  const t=ctx.active; if(!t || !t.cannoli) return;
  const cn=t.cannoli;
  if (cn.shell && cn.shell.id===item.id) return;
  t.cannoli = { shell:item, cream:null, fillL:0, fillR:0, sprItem:null, dotsL:[], dotsR:[] };
  const s = cannoliScreen(0, -CANNOLI.r-90);
  popText(s.x, s.y, item.name+'!', '#ffe9a8', 16);
  blip(560,0.07,'triangle',0.1,120);
}

/* which end of the shell is the pointer over? (raycast the invisible
   end-collider boxes registered by buildCannoli3D) */
function endAt(px,py){
  const hit = hitTestScene(px, py, 'cannoli');
  return hit ? hit.end : null;
}

/* the shell group is yawed so BOTH mouths face the camera a little */
export const SHELL_YAW = 0.30;

/* project a shell-local point (old virtual-px offsets from the shell
   centre, dx along the tube axis) to virtual screen coords, for glow
   rects, popTexts and the V3 test surface — accounts for SHELL_YAW */
export function cannoliScreen(dx, dy, dz=0){
  const {anchor, at, s} = RIGS.cannoli;
  const rx = dx*Math.cos(SHELL_YAW) + dz*Math.sin(SHELL_YAW);
  const rz = -dx*Math.sin(SHELL_YAW) + dz*Math.cos(SHELL_YAW);
  return projectVirtual(
    at.x + s*((CANNOLI.cx + rx) - anchor.ax),
    at.y + s*(anchor.ay - (CANNOLI.cy + dy)),
    at.z + s*(12 + rz - anchor.az));
}

const MAX_END_SPRINKLES=48;
const pipeRing = { end:null, at:-9 };   // live piping feedback for the draw pass

/* ctx = the acting player (G locally; the host passes the co-op guest's
   shadow context, whose `ray` was raycast on the guest's own camera). */
export function updateCannoli(dt, ctx=G){
  const t=ctx.active, drag=ctx.drag;
  if (!t || !t.cannoli || !drag || ctx.station!=='cannoli') return;
  const p=ctx.pointer;
  if (!p.down) return;
  const end = ctx.remote ? (ctx.ray && ctx.ray.kind==='cannoliEnd' ? ctx.ray.end : null)
                         : endAt(p.x,p.y);
  if (!end) return;
  const cn=t.cannoli;
  if (!cn.shell){
    if (!ctx.remote && Math.random()<dt*2) popText(p.x, p.y-30, 'Pick a shell first!', '#ffb08a', 13);
    return;
  }
  if (drag.cat==='cream'){
    // switching cream flavor restarts the filling
    if (!cn.cream || cn.cream.id!==drag.item.id){
      cn.cream=drag.item; cn.fillL=0; cn.fillR=0; cn.sprItem=null; cn.dotsL.length=0; cn.dotsR.length=0;
    }
    // piping-pressure minigame: a pulse ring swells around the end;
    // piping during its gold swell fills faster AND banks a small tip
    // bonus (bonus-only — off-pulse piping is exactly as before)
    const gold = Math.sin(G.time*2.6) > 0.55;
    const key = end==='L'?'fillL':'fillR';
    cn[key] = clamp(cn[key] + dt*0.55*(gold?1.8:1), 0, 1);
    if (gold) cn.pipeBonus = clamp((cn.pipeBonus||0) + dt*0.25, 0, 0.15);
    pipeRing.end = end; pipeRing.at = G.time;
    if (!ctx.remote){
      if (Math.random()<dt*20)
        spawnParticle({type:'drop', x:p.x+rand(-5,5), y:p.y+18, vy:rand(30,70), g:150,
          size:rand(2,3.6), color:drag.item.color, life:0.35, alpha:0.95});
      if (Math.random()<dt*8) hiss(0.07,0.02,900);
    }
  } else if (drag.cat==='endsprinkles'){
    const fill = end==='L'?cn.fillL:cn.fillR;
    if (fill<0.2){
      if (!ctx.remote && Math.random()<dt*2) popText(p.x, p.y-30, 'Pipe cream first!', '#ffb08a', 13);
      return;
    }
    ctx.emitAcc = (ctx.emitAcc||0) + dt;
    if (ctx.emitAcc<0.05) return; ctx.emitAcc=0;
    // switching sprinkle sets shakes off the old ones — the customer
    // asked for a specific kind
    if (!cn.sprItem || cn.sprItem.id!==drag.item.id){
      cn.sprItem = drag.item; cn.dotsL.length=0; cn.dotsR.length=0;
    }
    const dots = end==='L'?cn.dotsL:cn.dotsR;
    const col = choice(drag.item.colors);
    dots.push({a:rand(0,TAU), rr:rand(0,1), rot:rand(0,TAU), color:col});
    if (dots.length>MAX_END_SPRINKLES) dots.shift();
    if (!ctx.remote)
      spawnParticle({type:'sprinkle', x:p.x+rand(-6,6), y:p.y+12, vy:rand(80,130), g:460,
        size:rand(2.2,3.2), color:col, life:0.7, vr:rand(-8,8), settleY:CANNOLI.cy+rand(-10,10)});
  }
}

export function scrapeCannoli(ctx=G){
  const t=ctx.active; if(!t || !t.cannoli) return;
  // keep the chosen shell, scrape off cream + sprinkles
  t.cannoli = { shell:t.cannoli.shell, cream:null, fillL:0, fillR:0, sprItem:null, dotsL:[], dotsR:[] };
  const s = cannoliScreen(0, -CANNOLI.r-90);
  popText(s.x, s.y, 'Scraped clean', '#ffe9a8', 16);
  blip(320,0.09,'triangle',0.1);
}

export function drawCannoliStation(c){
  drawStationLabel(c,'Cannoli Station');
  const t=G.active;
  if (t && !t.cannoli){
    c.fillStyle='rgba(42,22,12,0.8)'; rr(c,180,250,380,60,12); c.fill();
    c.fillStyle='#ffe9b8'; c.font='800 16px Verdana, sans-serif';
    c.textAlign='center'; c.textBaseline='middle';
    c.fillText('No cannoli on this order — skip ahead!', 370, 280);
    return;
  }
  const {cx,cy,len,r}=CANNOLI;
  const cn = t ? t.cannoli : null;
  // shelf (2D tool palette over the 3D cannoli)
  const shelf = cannoliShelf();
  drawShelfFrame(c, 'SHELLS · CREAMS · SPRINKLES', shelf.filter(s=>s.seasonal).length);
  const p=G.pointer;
  for (const s of shelf){
    const held = G.drag && G.drag.cat===s.cat && G.drag.item.id===s.item.id;
    if (!held){
      drawShelfItem(c, s, s.x, s.y, false, 0.62);
      // the chosen shell gets a glowing frame
      if (s.cat==='shell' && cn && cn.shell && cn.shell.id===s.item.id){
        c.strokeStyle='#ffd98a'; c.lineWidth=2.4;
        rr(c,s.x-25,s.y-24,50,48,9); c.stroke();
      }
      if (Math.abs(p.x-s.x)<27 && Math.abs(p.y-s.y)<26) drawShelfLabel(c, s.item.name, s.x, s.y-4);
    } else { c.strokeStyle='rgba(255,244,214,0.35)'; c.setLineDash([5,4]);
      rr(c,s.x-24,s.y-24,48,48,9); c.stroke(); c.setLineDash([]); }
  }
  if (G.drag && cn){
    drawShelfItem(c, G.drag, G.pointer.x, G.pointer.y-14, true);
    // glow the ends (rects centered on the projected shell-end positions)
    const glow=0.4+Math.sin(G.time*7)*0.25;
    c.strokeStyle='rgba(255,235,150,'+glow.toFixed(2)+')'; c.lineWidth=2.6; c.setLineDash([7,6]);
    for (const dir of [-1,1]){
      const e = cannoliScreen(dir*len/2, 0);
      rr(c, e.x-52, e.y-62, 104, 124, 14); c.stroke();
    }
    c.setLineDash([]);
  }
  // piping pulse ring — pipe during the gold swell for the skill bonus
  if (G.time - pipeRing.at < 0.12 && pipeRing.end){
    const pulse = Math.sin(G.time*2.6);
    const gold = pulse > 0.55;
    const e = cannoliScreen((pipeRing.end==='L'?-1:1)*len/2, 0);
    const rad = 30 + pulse*12;
    c.save();
    c.strokeStyle = gold ? '#ffd24a' : 'rgba(255,244,214,0.55)';
    c.lineWidth = gold ? 5 : 3;
    c.beginPath(); c.arc(e.x, e.y, rad, 0, TAU); c.stroke();
    if (gold){
      c.fillStyle='#ffd24a'; c.font='800 13px Verdana, sans-serif';
      c.textAlign='center'; c.textBaseline='middle';
      c.fillText('NOW!', e.x, e.y - rad - 12);
    }
    c.restore();
  }
  BT.cannoliScrape.draw(c);
  c.fillStyle='rgba(42,22,12,0.75)'; rr(c,268,RAIL_H+14,414,28,8); c.fill();
  c.fillStyle='#ffe9b8'; c.font='700 11px Verdana, sans-serif';
  c.textAlign='center'; c.textBaseline='middle';
  c.fillText(cn && !cn.shell
    ? 'Tap the shell the customer asked for to start the cannoli!'
    : 'Hold a cream bag over EACH end to pipe · then sprinkle the ends', 475, RAIL_H+28);
}

function drawShelfItem(c, s, x, y, held, scale=1){
  if (s.cat==='endsprinkles'){ drawContainer(c, s, x, y, held, scale); return; }
  c.save(); c.translate(x,y); c.scale(scale,scale);
  if (s.cat==='shell'){
    // mini cannoli-tube icon in the shell's pastry color
    const col=s.item.color;
    const g=c.createLinearGradient(0,-12,0,12);
    g.addColorStop(0,shade(col,30)); g.addColorStop(1,shade(col,-30));
    c.fillStyle=g; rr(c,-24,-12,48,24,11); c.fill();
    c.strokeStyle='rgba(70,40,14,0.6)'; c.lineWidth=2.4; rr(c,-24,-12,48,24,11); c.stroke();
    if (s.item.dip){
      c.fillStyle=s.item.dip;
      rr(c,-24,-12,13,24,11); c.fill(); rr(c,11,-12,13,24,11); c.fill();
    }
    c.fillStyle='#5a3a20';
    c.beginPath(); c.ellipse(-24,0,4,9,0,0,TAU); c.ellipse(24,0,4,9,0,0,TAU); c.fill();
    c.restore();
    return;
  }
  // piping bag
  if (held) c.rotate(0.5);
  c.fillStyle=shade(s.item.color,-6);
  c.beginPath(); c.moveTo(-16,-22); c.lineTo(16,-22); c.lineTo(3,20); c.lineTo(-3,20); c.closePath(); c.fill();
  c.strokeStyle='rgba(60,36,20,0.35)'; c.lineWidth=2; c.stroke();
  c.fillStyle='#b8c2cc'; rr(c,-4,20,8,10,2); c.fill();
  c.fillStyle=shade(s.item.color,26); rr(c,-16,-28,32,9,4); c.fill();
  if (s.item.speckle){
    c.fillStyle=s.item.speckle;
    for(let i=0;i<6;i++){ c.beginPath(); c.arc(-8+(i%3)*8,-14+Math.floor(i/3)*12,1.6,0,TAU); c.fill(); }
  }
  c.restore();
}

/* draws a cannoli (also reused at small scale on the ticket panel) */
export function drawCannoli(c, cn, cx, cy, len, r, scale){
  c.save(); c.translate(cx,cy); c.scale(scale,scale); c.translate(-cx,-cy);
  // shell tube
  const g=c.createLinearGradient(0,cy-r,0,cy+r);
  g.addColorStop(0,'#eaad5e'); g.addColorStop(0.5,'#cf8c38'); g.addColorStop(1,'#9c6420');
  c.fillStyle=g;
  rr(c,cx-len/2,cy-r,len,r*2,r*0.9); c.fill();
  c.strokeStyle='rgba(70,40,14,0.6)'; c.lineWidth=3; rr(c,cx-len/2,cy-r,len,r*2,r*0.9); c.stroke();
  // big chunky gloss along the top of the shell
  const shl=c.createLinearGradient(0,cy-r,0,cy);
  shl.addColorStop(0,'rgba(255,255,255,0.5)'); shl.addColorStop(1,'rgba(255,255,255,0)');
  c.save(); rr(c,cx-len/2,cy-r,len,r*2,r*0.9); c.clip();
  c.fillStyle=shl; rr(c,cx-len/2+6,cy-r+3,len-12,r*0.7,r*0.4); c.fill(); c.restore();
  // flaky ridges
  c.strokeStyle='rgba(110,62,20,0.5)'; c.lineWidth=2.4;
  for(let i=-2;i<=2;i++){
    c.beginPath(); c.moveTo(cx+i*len*0.16, cy-r+6);
    c.quadraticCurveTo(cx+i*len*0.16+12, cy, cx+i*len*0.16, cy+r-6); c.stroke();
  }
  // cream at the ends
  const ends=[['L',-1],['R',1]];
  for (const [key,dir] of ends){
    const fill = key==='L'?cn.fillL:cn.fillR;
    if (!cn.cream || fill<=0) {
      // hollow opening
      c.fillStyle='#5a3a20';
      c.beginPath(); c.ellipse(cx+dir*len/2, cy, 10, r*0.82, 0, 0, TAU); c.fill();
      continue;
    }
    const ex=cx+dir*len/2;
    const creamCol=shade(cn.cream.color,10);
    // cream disc grows with fill, then puffs outward
    const rr_ = r*0.82*Math.min(1,fill*1.6);
    c.fillStyle=creamCol;
    c.beginPath(); c.ellipse(ex, cy, 10+fill*10, rr_, 0, 0, TAU); c.fill();
    c.strokeStyle=shade(cn.cream.color,-34); c.lineWidth=2;
    c.beginPath(); c.ellipse(ex, cy, 10+fill*10, rr_, 0, 0, TAU); c.stroke();
    if (fill>0.55){
      const puff=(fill-0.55)/0.45;
      c.fillStyle=creamCol;
      c.beginPath();
      c.arc(ex+dir*(8+puff*10), cy-8, 8*puff+3, 0, TAU);
      c.arc(ex+dir*(10+puff*13), cy+7, 7*puff+2.5, 0, TAU);
      c.fill();
    }
    const chl=c.createRadialGradient(ex,cy-rr_*0.4,0,ex,cy-rr_*0.4,rr_*0.7);
    chl.addColorStop(0,'rgba(255,255,255,0.5)'); chl.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle=chl; c.beginPath(); c.ellipse(ex,cy-rr_*0.35,6+fill*4,rr_*0.5,0,0,TAU); c.fill();
    if (cn.cream.speckle){
      c.fillStyle=cn.cream.speckle;
      for(let i=0;i<5;i++){
        const a=i*2.4, rad=rr_*0.6;
        c.beginPath(); c.arc(ex+Math.cos(a)*8, cy+Math.sin(a)*rad*0.7, 1.4, 0, TAU); c.fill();
      }
    }
    // end sprinkles sit on the cream
    const dots = key==='L'?cn.dotsL:cn.dotsR;
    for (const d of dots){
      const dx=ex+dir*6+Math.cos(d.a)*9, dy=cy+Math.sin(d.a)*rr_*0.7*d.rr;
      c.save(); c.translate(dx,dy); c.rotate(d.rot);
      c.fillStyle=d.color; rr(c,-2.8,-1,5.6,2,1); c.fill();
      c.restore();
    }
  }
  c.restore();
}

/* ============================================================
   3D cannoli. A golden ridged pastry tube laid along the X axis with
   flaky ridge rings; cream at each end is a scale-from-fill blob that
   bulges outward; end sprinkles are a small per-end InstancedMesh. A
   shallow board sits under it. Empty ends show a dark cap. End
   hit-testing still uses the virtual-coord endAt() (shell sits at z≈0).
   ============================================================ */
import { THREE, place, mat, shadowDecal, woodTexture, pastryTexture, TOON_RAMP, stationRig,
         projectVirtual, hitTestScene, colliders, colliderMaterial } from '../render/three.js';
import { RIGS } from '../render/layout3d.js';

let can3d = null;

export function buildCannoli3D(group){
  // cannoli geometry stays in old virtual-pixel local space; the rig
  // scales it down onto the café's side bench (layout3d.js)
  const rig = stationRig(RIGS.cannoli.anchor, RIGS.cannoli.at, RIGS.cannoli.s);
  group.add(rig);
  const {cx,cy,len,r} = CANNOLI;
  const g = new THREE.Group();
  place(g, cx, cy, 12);
  g.rotation.y = SHELL_YAW;   // open both mouths toward the camera
  rig.add(g);

  const sh = shadowDecal(len*0.62, 34); sh.position.set(0,-r-6,0); g.add(sh);

  // serving board
  const board = new THREE.Mesh(new THREE.BoxGeometry(len*1.15, 14, 60),
    mat('#f0e8da',{rough:0.7, noCache:true}));
  board.material.map = woodTexture(2, 0.4);
  board.position.set(0,-r-2,-4); g.add(board);

  // shell tube (pastry, recolored per chosen shell type), axis along X
  const shellGeo = new THREE.CylinderGeometry(r, r, len, 32, 1, true);
  shellGeo.rotateZ(Math.PI/2);
  const shellMat = mat('#cf8c38',{rough:0.55, noCache:true});
  shellMat.map = pastryTexture(3, 1);   // blistered fried-shell surface
  shellMat.transparent = true;   // ghost preview until a shell is chosen
  const shell = new THREE.Mesh(shellGeo, shellMat);
  g.add(shell);
  // inner dark tube (seen through the open ends)
  const innerGeo = new THREE.CylinderGeometry(r-6, r-6, len-2, 24, 1, true);
  innerGeo.rotateZ(Math.PI/2);
  const inner = new THREE.Mesh(innerGeo, mat('#5a3a20',{rough:0.8, noCache:true}));
  inner.material.side = THREE.BackSide; g.add(inner);
  // flaky ridge rings around the tube (recolored with the shell)
  const rings = [];
  for (let i=-2;i<=2;i++){
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r+1, 3, 8, 28),
      mat('#a86e28',{rough:0.6, noCache:true}));
    ring.rotation.y = Math.PI/2;          // wrap around X axis
    ring.position.x = i*len*0.18; g.add(ring);
    rings.push(ring);
  }
  // rim highlights at each mouth + dip coating sleeves (chocolate-dipped
  // and glazed shells get coated ends)
  const rims = [], dips = [];
  for (const dir of [-1,1]){
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r-1, 3, 8, 28),
      mat('#eac06a',{rough:0.4, noCache:true}));
    rim.rotation.y = Math.PI/2; rim.position.x = dir*len/2; g.add(rim);
    rims.push(rim);
    const dipGeo = new THREE.CylinderGeometry(r+2, r+2, len*0.2, 28, 1, true);
    dipGeo.rotateZ(Math.PI/2);
    const dip = new THREE.Mesh(dipGeo, mat('#5a3420',{rough:0.3, noCache:true}));
    dip.position.x = dir*(len/2 - len*0.1); dip.visible = false; g.add(dip);
    dips.push(dip);
  }

  // invisible end colliders for the pipe/sprinkle raycast (generous boxes
  // around each mouth, matching the old ±46/66 virtual-px tap zones)
  colliders.cannoliEnds = {};
  for (const key of ['L','R']){
    const dir = key==='L' ? -1 : 1;
    const col = new THREE.Mesh(new THREE.BoxGeometry(112, r*2+112, r*2+40), colliderMaterial());
    col.position.set(dir*(len/2+10), 0, 10);
    g.add(col);
    colliders.cannoliEnds[key] = col;
  }

  // dark end caps (shown when an end has no cream)
  const caps = {}, creams = {}, sprs = {};
  for (const key of ['L','R']){
    const dir = key==='L' ? -1 : 1;
    const cap = new THREE.Mesh(new THREE.CircleGeometry(r-4, 24), mat('#42260f',{rough:0.9}));
    cap.rotation.y = dir*Math.PI/2; cap.position.x = dir*(len/2-1); g.add(cap);
    caps[key] = cap;
    // cream blob
    const cream = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16),
      mat('#f4e3c0',{rough:0.5, noCache:true}));
    cream.visible = false; g.add(cream);
    creams[key] = cream;
    // end sprinkles
    const spr = new THREE.InstancedMesh(new THREE.BoxGeometry(7.5,2.8,2.8),
      new THREE.MeshToonMaterial({gradientMap:TOON_RAMP}), MAX_END_SPRINKLES);
    spr.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_END_SPRINKLES*3),3);
    spr.count = 0; spr.renderOrder = 3; g.add(spr);
    sprs[key] = spr;
  }

  can3d = { g, shell, inner, rings, rims, dips, caps, creams, sprs };
}

export function updateCannoli3D(){
  if (!can3d) return;
  const t = G.active;
  const on = !!(t && t.cannoli);
  can3d.g.visible = on;
  if (!on) return;
  const cn = t.cannoli;
  const {len,r} = CANNOLI;
  // shell appearance: ghost preview until the player taps a shell type,
  // then recolor the pastry (+ dip sleeves for coated shells)
  const chosen = !!cn.shell;
  can3d.shell.material.opacity = chosen ? 1 : 0.4;
  can3d.shell.material.color.set(chosen ? cn.shell.color : '#d8c49a');
  can3d.inner.visible = chosen;
  for (const ring of can3d.rings){
    ring.visible = chosen;
    if (chosen) ring.material.color.set(shade(cn.shell.color,-25));
  }
  for (const rim of can3d.rims){
    rim.visible = chosen;
    if (chosen) rim.material.color.set(shade(cn.shell.color,25));
  }
  for (const dip of can3d.dips){
    dip.visible = chosen && !!cn.shell.dip;
    if (dip.visible) dip.material.color.set(cn.shell.dip);
  }
  for (const key of ['L','R']){
    const dir = key==='L' ? -1 : 1;
    const fill = key==='L' ? cn.fillL : cn.fillR;
    const cream = can3d.creams[key], cap = can3d.caps[key], spr = can3d.sprs[key];
    if (cn.cream && fill>0.001){
      cream.visible = true;
      cream.material.color.set(cn.cream.color);
      const ry = r*0.82*Math.min(1, fill*1.6);
      const bulge = 8 + fill*22;
      cream.scale.set(bulge, ry, ry);
      cream.position.set(dir*(len/2) + dir*fill*10, 0, 0);
      cap.visible = false;
      // sprinkles spread across the camera-facing surface of the cream dome
      const dots = key==='L' ? cn.dotsL : cn.dotsR;
      spr.count = dots.length;
      const cxk = dir*(len/2) + dir*fill*10;   // cream-bulge centre x
      const m = new THREE.Matrix4(), col = new THREE.Color();
      for (let i=0;i<dots.length;i++){
        const d = dots[i];
        const u = Math.sqrt(d.rr);
        const ox = Math.cos(d.a)*bulge*0.72*u;         // across bulge width
        const oy = Math.sin(d.a)*ry*0.78*u;            // vertical
        const zt = 1 - (ox/bulge)**2 - (oy/ry)**2;     // ellipsoid front surface
        const oz = Math.sqrt(Math.max(0.04, zt))*ry;
        m.makeRotationX(d.rot);
        m.multiply(new THREE.Matrix4().makeRotationY(d.rot*0.6));
        m.setPosition(cxk + ox, oy, oz + 2);
        spr.setMatrixAt(i, m);
        col.set(d.color); spr.setColorAt(i, col);
      }
      spr.instanceMatrix.needsUpdate = true;
      if (spr.instanceColor) spr.instanceColor.needsUpdate = true;
    } else {
      cream.visible = false; cap.visible = chosen; spr.count = 0;
    }
  }
}

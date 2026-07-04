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
import { drawContainer } from './top.js';

/* shelf: cream piping bags + one sprinkle cup per unlocked set */
export function cannoliShelf(){
  const u = unlockedNow();
  const list = u.creams.map(cr=>({cat:'cream', item:cr}));
  for (const s of u.sprinkles) list.push({cat:'endsprinkles', item:s});
  for (let i=0;i<list.length;i++){
    list[i].x = 70 + (i%3)*96;
    list[i].y = 196 + Math.floor(i/3)*88;
  }
  return list;
}
export function cannoliShelfHit(x,y){
  for (const s of cannoliShelf())
    if (Math.abs(x-s.x)<34 && Math.abs(y-s.y)<38) return s;
  return null;
}

/* which end of the shell is the pointer over? */
function endAt(px,py){
  const {cx,cy,len,r}=CANNOLI;
  if (Math.abs(py-cy)>r+56) return null;
  if (px>cx-len/2-46 && px<cx-len/2+66) return 'L';
  if (px>cx+len/2-66 && px<cx+len/2+46) return 'R';
  return null;
}

let emitAcc=0;
const MAX_END_SPRINKLES=48;

export function updateCannoli(dt){
  const t=G.active, drag=G.drag;
  if (!t || !t.cannoli || !drag || G.station!=='cannoli') return;
  const p=G.pointer;
  if (!p.down) return;
  const end = endAt(p.x,p.y);
  if (!end) return;
  const cn=t.cannoli;
  if (drag.cat==='cream'){
    // switching cream flavor restarts the filling
    if (!cn.cream || cn.cream.id!==drag.item.id){
      cn.cream=drag.item; cn.fillL=0; cn.fillR=0; cn.dotsL.length=0; cn.dotsR.length=0;
    }
    const key = end==='L'?'fillL':'fillR';
    cn[key] = clamp(cn[key] + dt*0.55, 0, 1);
    if (Math.random()<dt*20)
      spawnParticle({type:'drop', x:p.x+rand(-5,5), y:p.y+18, vy:rand(30,70), g:150,
        size:rand(2,3.6), color:drag.item.color, life:0.35, alpha:0.95});
    if (Math.random()<dt*8) hiss(0.07,0.02,900);
  } else if (drag.cat==='endsprinkles'){
    const fill = end==='L'?cn.fillL:cn.fillR;
    if (fill<0.2){
      if (Math.random()<dt*2) popText(p.x, p.y-30, 'Pipe cream first!', '#ffb08a', 13);
      return;
    }
    emitAcc+=dt;
    if (emitAcc<0.05) return; emitAcc=0;
    const dots = end==='L'?cn.dotsL:cn.dotsR;
    const col = choice(drag.item.colors);
    dots.push({a:rand(0,TAU), rr:rand(0,1), rot:rand(0,TAU), color:col});
    if (dots.length>MAX_END_SPRINKLES) dots.shift();
    spawnParticle({type:'sprinkle', x:p.x+rand(-6,6), y:p.y+12, vy:rand(80,130), g:460,
      size:rand(2.2,3.2), color:col, life:0.7, vr:rand(-8,8), settleY:CANNOLI.cy+rand(-10,10)});
  }
}

export function scrapeCannoli(){
  const t=G.active; if(!t || !t.cannoli) return;
  t.cannoli = { cream:null, fillL:0, fillR:0, dotsL:[], dotsR:[] };
  popText(CANNOLI.cx, CANNOLI.cy-90, 'Scraped clean', '#ffe9a8', 16);
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
  // shelf (2D tool palette over the 3D cannoli)
  c.fillStyle='#f0e2c8'; c.font='800 14px Verdana, sans-serif';
  c.textAlign='left'; c.textBaseline='top';
  c.fillText('CREAMS & SPRINKLES', 44, 156);
  for (const s of cannoliShelf()){
    const held = G.drag && G.drag.cat===s.cat && G.drag.item.id===s.item.id;
    if (!held) drawShelfItem(c, s, s.x, s.y, false);
    else { c.strokeStyle='rgba(255,244,214,0.35)'; c.setLineDash([5,4]);
      rr(c,s.x-32,s.y-34,64,68,10); c.stroke(); c.setLineDash([]); }
  }
  if (G.drag && t && t.cannoli){
    drawShelfItem(c, G.drag, G.pointer.x, G.pointer.y-14, true);
    // glow the ends
    const glow=0.4+Math.sin(G.time*7)*0.25;
    c.strokeStyle='rgba(255,235,150,'+glow.toFixed(2)+')'; c.lineWidth=2.6; c.setLineDash([7,6]);
    rr(c,cx-len/2-42,cy-r-18,104,r*2+36,14); c.stroke();
    rr(c,cx+len/2-62,cy-r-18,104,r*2+36,14); c.stroke();
    c.setLineDash([]);
  }
  BT.cannoliScrape.draw(c);
  c.fillStyle='rgba(42,22,12,0.75)'; rr(c,268,RAIL_H+14,414,28,8); c.fill();
  c.fillStyle='#ffe9b8'; c.font='700 11px Verdana, sans-serif';
  c.textAlign='center'; c.textBaseline='middle';
  c.fillText('Hold a cream bag over EACH end to pipe · then sprinkle the ends', 475, RAIL_H+28);
}

function drawShelfItem(c, s, x, y, held){
  if (s.cat!=='cream'){ drawContainer(c, s, x, y, held); return; }
  // piping bag
  c.save(); c.translate(x,y);
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
  if (!held){
    c.fillStyle='rgba(42,22,12,0.75)'; rr(c,x-46,y+32,92,17,6); c.fill();
    c.fillStyle='#ffe9b8'; c.font='700 9px Verdana, sans-serif';
    c.textAlign='center'; c.textBaseline='middle';
    c.fillText(s.item.name, x, y+41);
  }
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
import { THREE, place, mat, shadowDecal } from '../render/three.js';
import { stationRoom3D } from '../render/scene3d.js';

let can3d = null;

export function buildCannoli3D(group){
  group.add(stationRoom3D());
  const {cx,cy,len,r} = CANNOLI;
  const g = new THREE.Group();
  place(g, cx, cy, 12);
  group.add(g);

  const sh = shadowDecal(len*0.62, 34); sh.position.set(0,-r-6,0); g.add(sh);

  // serving board
  const board = new THREE.Mesh(new THREE.BoxGeometry(len*1.15, 14, 60),
    mat('#f0e8da',{rough:0.7, noCache:true}));
  board.position.set(0,-r-2,-4); g.add(board);

  // shell tube (golden pastry), axis along X
  const shellGeo = new THREE.CylinderGeometry(r, r, len, 32, 1, true);
  shellGeo.rotateZ(Math.PI/2);
  const shell = new THREE.Mesh(shellGeo, mat('#cf8c38',{rough:0.55, noCache:true}));
  g.add(shell);
  // inner dark tube (seen through the open ends)
  const innerGeo = new THREE.CylinderGeometry(r-6, r-6, len-2, 24, 1, true);
  innerGeo.rotateZ(Math.PI/2);
  const inner = new THREE.Mesh(innerGeo, mat('#5a3a20',{rough:0.8, noCache:true}));
  inner.material.side = THREE.BackSide; g.add(inner);
  // flaky ridge rings around the tube
  for (let i=-2;i<=2;i++){
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r+1, 3, 8, 28),
      mat('#a86e28',{rough:0.6}));
    ring.rotation.y = Math.PI/2;          // wrap around X axis
    ring.position.x = i*len*0.18; g.add(ring);
  }
  // rim highlights at each mouth
  const rimMat = mat('#eac06a',{rough:0.4});
  for (const dir of [-1,1]){
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r-1, 3, 8, 28), rimMat);
    rim.rotation.y = Math.PI/2; rim.position.x = dir*len/2; g.add(rim);
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
      new THREE.MeshStandardMaterial({roughness:0.5}), MAX_END_SPRINKLES);
    spr.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_END_SPRINKLES*3),3);
    spr.count = 0; spr.renderOrder = 3; g.add(spr);
    sprs[key] = spr;
  }

  can3d = { g, shell, inner, caps, creams, sprs };
}

export function updateCannoli3D(){
  if (!can3d) return;
  const t = G.active;
  const on = !!(t && t.cannoli);
  can3d.g.visible = on;
  if (!on) return;
  const cn = t.cannoli;
  const {len,r} = CANNOLI;
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
      cream.visible = false; cap.visible = true; spr.count = 0;
    }
  }
}

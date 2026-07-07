/* ============================================================
   Tiny 3D particle pool — soft billboard puffs for steam curling
   off hot brews (the 2D particle system keeps everything else).
   Sprites are transparent, never write depth, and are flagged
   noInk so the outline pass leaves them un-inked; a fixed pool
   recycles the oldest puff instead of allocating.
   ============================================================ */
import { THREE, scene } from './three.js';

let _puffTex = null;
function puffTexture(){
  if (_puffTex) return _puffTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  // bright core with a cool blue-grey edge so puffs read against the
  // pale plaster wall behind the brew line
  const rg = g.createRadialGradient(32,32,4,32,32,30);
  rg.addColorStop(0,'rgba(255,255,255,0.95)');
  rg.addColorStop(0.45,'rgba(214,228,240,0.7)');
  rg.addColorStop(0.8,'rgba(168,190,206,0.3)');
  rg.addColorStop(1,'rgba(168,190,206,0)');
  g.fillStyle = rg; g.fillRect(0,0,64,64);
  _puffTex = new THREE.CanvasTexture(c);
  return _puffTex;
}

const POOL_MAX = 48;
const pool = [];

export function steam3d(x, y, z, { vy=22, size=12, life=1.3, sway=6 } = {}){
  let p = pool.find(p => !p.alive);
  if (!p){
    if (pool.length >= POOL_MAX) return;
    const m = new THREE.SpriteMaterial({ map: puffTexture(), transparent: true, depthWrite: false });
    const s = new THREE.Sprite(m);
    s.userData.noInk = true;
    s.visible = false;
    scene.add(s);
    p = { s, m, alive: false };
    pool.push(p);
  }
  p.alive = true; p.t = 0;
  p.x = x; p.y = y; p.z = z;
  p.vy = vy; p.size = size; p.life = life; p.sway = sway;
  p.phase = Math.random()*Math.PI*2;
  p.s.visible = true;
}

export function updateFx3d(dt){
  for (const p of pool){
    if (!p.alive) continue;
    p.t += dt;
    if (p.t >= p.life){ p.alive = false; p.s.visible = false; continue; }
    const f = p.t / p.life;
    p.y += p.vy * dt;
    const sz = p.size * (0.7 + f*1.1);
    p.s.scale.set(sz, sz, 1);
    p.s.position.set(p.x + Math.sin(p.phase + p.t*2.6) * p.sway * f, p.y, p.z);
    p.m.opacity = 0.85 * (1 - f);
  }
}

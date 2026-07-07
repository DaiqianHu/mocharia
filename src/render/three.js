/* ============================================================
   The 3D engine (leaf module). Owns the THREE renderer/scene/camera,
   lighting, the four per-station groups, and a library of shared
   helpers (coordinate mapping, scale-from-anchor fill meshes, instanced
   scatter, blurred shadow decals, raycast hit-testing).

   Coordinate contract (the real-3D café): world y is up, the café
   floor is y=0, and the camera (driven by render/camera.js) flies
   between per-station viewpoints defined in render/layout3d.js.

   Station geometry is still authored in the old virtual-pixel local
   space — place()/toWorld() map virtual (px,py) to (px-VW/2, VH/2-py, z)
   INSIDE a station rig, and stationRig() positions/scales that local
   space into the café so an old-virtual anchor lands on a chosen world
   point. That keeps every hand-tuned anchor in game/layout.js valid.

   The renderer's canvas (#game3d) is CSS-sized to cover exactly the
   letterbox rect, so no viewport/scissor offset math is needed and the
   NDC mapping for raycasting is independent of scale/offset/DPR.

   This module imports nothing from game/* — it's a pure engine. The
   dispatcher (scene3d.js) and station builders drive it.
   ============================================================ */
import * as THREE from 'three';
import { VW, VH } from '../core/constants.js';
import { onResize, virtualToNDC, worldToVirtual, VIEW } from '../core/canvas.js';

export { THREE };

export const canvas3d = document.getElementById('game3d');

export const renderer = new THREE.WebGLRenderer({
  canvas: canvas3d, antialias: true, alpha: false, powerPreference: 'high-performance',
});
renderer.setClearColor(0x160d0b, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;

export const scene = new THREE.Scene();

// A perspective camera with a fixed VW/VH aspect (the canvas always
// represents the letterboxed virtual rect). Its pose — position, target
// and fov per station, plus the fly-between tween — is driven every
// frame by render/camera.js.
export const camera = new THREE.PerspectiveCamera(45, VW/VH, 10, 3200);
camera.position.set(0, 300, 500);
camera.lookAt(0, 100, -100);

/* ---- the four station groups (toggled by .visible) ---- */
export const orderGroup   = new THREE.Group();
export const brewGroup    = new THREE.Group();
export const topGroup     = new THREE.Group();
export const cannoliGroup = new THREE.Group();
scene.add(orderGroup, brewGroup, topGroup, cannoliGroup);

/* ---- lighting (hemisphere + two directionals, holiday-tunable) ---- */
const hemi = new THREE.HemisphereLight(0xffffff, 0x4a3a2a, 0.95);
const keyLight = new THREE.DirectionalLight(0xffffff, 1.15);
keyLight.position.set(-260, 420, 520);
const fillLight = new THREE.DirectionalLight(0xffe6c8, 0.45);
fillLight.position.set(320, 120, 360);
scene.add(hemi, keyLight, fillLight);

export function setHolidayLighting(h){
  if (h && h.light){
    // per-holiday palette lives in data.js HOLIDAYS[].light
    hemi.color.set(h.light.hemi); hemi.groundColor.set(h.light.ground); hemi.intensity=0.92;
    keyLight.color.set(h.light.key); keyLight.intensity=1.1;
    fillLight.color.set(h.light.fill); fillLight.intensity=0.5;
  } else {
    hemi.color.set(0xffffff); hemi.groundColor.set(0x4a3a2a); hemi.intensity=0.95;
    keyLight.color.set(0xffffff); keyLight.intensity=1.15;
    fillLight.color.set(0xffe6c8); fillLight.intensity=0.45;
  }
}

/* ============================================================
   Coordinate helpers
   ============================================================ */
export function toWorld(px, py, z=0){ return new THREE.Vector3(px - VW/2, VH/2 - py, z); }
export function place(obj, px, py, z=0){ obj.position.set(px - VW/2, VH/2 - py, z); return obj; }

/* Project a world point to virtual-pixel coords through the live camera
   (for anchoring 2D HUD bits — patience meters, speech bubbles, popText —
   onto 3D objects). Returns {x,y} in virtual pixels. */
const _pv = new THREE.Vector3();
export function projectVirtual(x, y, z){
  _pv.set(x, y, z);
  return worldToVirtual(_pv, camera);
}

/* A station rig: a Group whose LOCAL space is the old virtual-pixel
   mapping (so station geometry keeps using place() verbatim), scaled
   by s and positioned so the old-virtual anchor (ax,ay,az) lands
   exactly on the world point `at`. */
export function stationRig({ax, ay, az=0}, at, s=1){
  const rig = new THREE.Group();
  rig.scale.setScalar(s);
  const a = toWorld(ax, ay, az);
  rig.position.set(at.x - s*a.x, at.y - s*a.y, at.z - s*a.z);
  return rig;
}

/* ============================================================
   Sizing — keep #game3d exactly over the letterbox rect. The camera
   aspect never changes (the canvas always represents the VW x VH rect);
   only the pixel resolution of the drawing buffer changes.
   ============================================================ */
function syncSize(V){
  const cssW = VW*V.scale, cssH = VH*V.scale;
  canvas3d.style.left   = V.offX + 'px';
  canvas3d.style.top    = V.offY + 'px';
  renderer.setPixelRatio(V.dpr);
  renderer.setSize(cssW, cssH, true);   // updates CSS width/height too
}
onResize.push(syncSize);
syncSize(VIEW);   // initial sync (resize() already ran before this module loaded)

/* ============================================================
   Scale-from-anchor fill mesh — the single trick behind drink fill,
   brew measuring-cup fill, and cannoli cream. Geometry is authored so
   its base sits at local y=0 and it extends up by `height`; driving
   mesh.scale.y in [0..1] grows it from that fixed anchor.
   ============================================================ */
export function fillMesh(geo, mat){
  const m = new THREE.Mesh(geo, mat);
  m.scale.y = 0.0001;
  m.userData.fill = f => { m.scale.y = Math.max(0.0001, f); };
  return m;
}
/* A truncated-cone fluid column, base at y=0, apex up by `height`.
   topR/botR are the radii; used for cups (botR<topR). */
export function fluidGeometry(botR, topR, height, seg=28){
  const g = new THREE.CylinderGeometry(topR, botR, height, seg, 1, false);
  g.translate(0, height/2, 0);   // move base to y=0
  return g;
}

/* ============================================================
   Procedural canvas textures. Kept grayscale-light (average near
   white, faint neutral grain) so `material.color` still does the
   tinting — the same texture serves every wood/plaster/pastry hue.
   One canvas per pattern; one texture per (pattern, repeat) pair.
   ============================================================ */
const _texCanvases = new Map(), _texCache = new Map();
function procTexture(name, draw, rx, ry){
  const key = name+'|'+rx+'|'+ry;
  if (_texCache.has(key)) return _texCache.get(key);
  let cv = _texCanvases.get(name);
  if (!cv){
    cv = document.createElement('canvas'); cv.width = cv.height = 256;
    draw(cv.getContext('2d'), 256);
    _texCanvases.set(name, cv);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(rx, ry);
  _texCache.set(key, tex);
  return tex;
}

function drawWoodTex(c, s){
  const plankW = s/4;
  for (let i=0;i<4;i++){
    c.fillStyle = `hsl(32, 9%, ${88 + (i%2 ? -3 : 2) + Math.random()*3}%)`;
    c.fillRect(i*plankW, 0, plankW, s);
    for (let k=0;k<9;k++){            // wavy grain streaks
      const x = i*plankW + 4 + Math.random()*(plankW-8);
      c.strokeStyle = `rgba(70,45,20,${0.05+Math.random()*0.07})`;
      c.lineWidth = 1 + Math.random()*1.6;
      c.beginPath(); c.moveTo(x, 0);
      for (let y=16;y<=s;y+=16) c.lineTo(x + Math.sin(y*0.05+k)*3 + Math.random()*2-1, y);
      c.stroke();
    }
    if (Math.random()<0.7){            // a knot
      const kx = i*plankW + plankW*(0.3+Math.random()*0.4), ky = Math.random()*s;
      c.strokeStyle='rgba(70,45,20,0.16)'; c.lineWidth=2;
      for (let r=2.5;r<9;r+=2.5){ c.beginPath(); c.ellipse(kx,ky,r,r*1.7,0,0,Math.PI*2); c.stroke(); }
    }
    c.strokeStyle='rgba(50,32,14,0.3)'; c.lineWidth=2;   // plank seam
    c.beginPath(); c.moveTo(i*plankW+1,0); c.lineTo(i*plankW+1,s); c.stroke();
  }
}
function drawPlasterTex(c, s){
  c.fillStyle='hsl(40, 10%, 92%)'; c.fillRect(0,0,s,s);
  for (let i=0;i<1400;i++){            // stipple
    c.fillStyle = Math.random()<0.5 ? 'rgba(255,255,255,0.15)' : 'rgba(100,80,55,0.06)';
    c.beginPath(); c.arc(Math.random()*s, Math.random()*s, 0.6+Math.random()*1.8, 0, Math.PI*2); c.fill();
  }
  for (let i=0;i<22;i++){              // faint broad blotches
    c.fillStyle = `rgba(120,100,75,${0.02+Math.random()*0.025})`;
    c.beginPath(); c.arc(Math.random()*s, Math.random()*s, 12+Math.random()*32, 0, Math.PI*2); c.fill();
  }
}
function drawPastryTex(c, s){
  c.fillStyle='hsl(35, 16%, 88%)'; c.fillRect(0,0,s,s);
  for (let i=0;i<260;i++){             // fried blisters, light + toasted
    const x=Math.random()*s, y=Math.random()*s, r=2+Math.random()*7;
    const g=c.createRadialGradient(x,y,0,x,y,r);
    if (Math.random()<0.55){ g.addColorStop(0,'rgba(255,250,240,0.35)'); g.addColorStop(1,'rgba(255,250,240,0)'); }
    else { g.addColorStop(0,'rgba(95,60,22,0.2)'); g.addColorStop(1,'rgba(95,60,22,0)'); }
    c.fillStyle=g; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill();
  }
}

export function woodTexture(rx=1, ry=1){ return procTexture('wood', drawWoodTex, rx, ry); }
export function plasterTexture(rx=1, ry=1){ return procTexture('plaster', drawPlasterTex, rx, ry); }
export function pastryTexture(rx=1, ry=1){ return procTexture('pastry', drawPastryTex, rx, ry); }

/* ============================================================
   Blurred contact-shadow decal (a soft dark ellipse on the floor),
   reused instead of dynamic shadow maps.
   ============================================================ */
let _shadowTex = null;
function shadowTexture(){
  if (_shadowTex) return _shadowTex;
  const c = document.createElement('canvas'); c.width=c.height=64;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(32,32,2,32,32,30);
  rg.addColorStop(0,'rgba(20,10,4,0.55)'); rg.addColorStop(1,'rgba(20,10,4,0)');
  g.fillStyle=rg; g.fillRect(0,0,64,64);
  _shadowTex = new THREE.CanvasTexture(c);
  return _shadowTex;
}
export function shadowDecal(rx, rz){
  const mat = new THREE.MeshBasicMaterial({ map:shadowTexture(), transparent:true, depthWrite:false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(rx*2, rz*2), mat);
  m.rotation.x = -Math.PI/2;
  m.renderOrder = -1;
  return m;
}

/* ============================================================
   Raycast hit-testing. Station builders register invisible collider
   proxies (sized from the existing 2D hit-test functions). Colliders
   use material.visible=false so they never render but still raycast.
   ============================================================ */
export const colliders = {
  machines: [],       // {mesh, index}
  cupZone: null,      // plane mesh; worldToLocal(hit).x -> relX
  customers: [],      // {mesh, id}
  cannoliEnds: null,  // {L: mesh, R: mesh}
};
const raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();

export function colliderMaterial(){
  return new THREE.MeshBasicMaterial({ visible:false });
}

export function hitTestScene(px, py, station){
  const n = virtualToNDC(px, py);
  _ndc.set(n.x, n.y);
  raycaster.setFromCamera(_ndc, camera);
  if (station==='brew'){
    const meshes = colliders.machines.map(c=>c.mesh);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    if (hit){ const c = colliders.machines.find(c=>c.mesh===hit.object); return { kind:'machine', index:c.index }; }
  } else if (station==='order'){
    const meshes = colliders.customers.map(c=>c.mesh);
    const hit = raycaster.intersectObjects(meshes, true)[0];
    if (hit){
      let o = hit.object; while (o && o.userData.custId===undefined) o = o.parent;
      if (o) return { kind:'customer', id:o.userData.custId };
    }
  } else if (station==='top'){
    if (colliders.cupZone){
      const hit = raycaster.intersectObject(colliders.cupZone, false)[0];
      if (hit){
        const local = colliders.cupZone.worldToLocal(hit.point.clone());
        return { kind:'cup', relX: Math.max(-0.48, Math.min(0.48, local.x / colliders.cupZone.userData.w)) };
      }
    }
  } else if (station==='cannoli'){
    if (colliders.cannoliEnds){
      for (const end of ['L','R']){
        if (raycaster.intersectObject(colliders.cannoliEnds[end], false)[0])
          return { kind:'cannoliEnd', end };
      }
    }
  }
  return null;
}

/* ============================================================
   Cartoon look — a shared 3-step toon gradient ramp. MeshToonMaterial
   quantizes our existing hemisphere+directional lighting into flat
   colour bands (Papa's-style cel shading). The ramp is lifted off pure
   black so the darkest band still reads as coloured shadow, not ink.
   Exported so the few hand-built materials (glass, instanced sprinkles,
   chibi customers in render/people.js) can share it and match.
   ============================================================ */
export const TOON_RAMP = (() => {
  const steps = new Uint8Array([107, 184, 255]); // ≈ 0.42 / 0.72 / 1.0
  const tex = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
})();

/* ============================================================
   Materials — small cache of cel-shaded MeshToonMaterials by hex colour.
   (rough/metal opts are accepted for call-site compatibility but ignored;
   toon shading has no glossy term.)
   ============================================================ */
const _matCache = new Map();
export function mat(color, opts={}){
  const key = color+'|'+(opts.rough??0.62)+'|'+(opts.metal??0.0)+'|'+(opts.emissive||'')+'|'+(opts.transparent?('t'+opts.opacity):'');
  if (_matCache.has(key) && !opts.noCache) return _matCache.get(key);
  const m = new THREE.MeshToonMaterial({
    color: new THREE.Color(color),
    gradientMap: TOON_RAMP,
  });
  if (opts.emissive){ m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.emissiveIntensity ?? 1; }
  if (opts.transparent){ m.transparent = true; m.opacity = opts.opacity ?? 0.5; }
  if (!opts.noCache) _matCache.set(key, m);
  return m;
}

let R = renderer;
if (typeof window!=='undefined'){ window.R = renderer; window.S3 = { scene, camera }; }

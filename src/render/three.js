/* ============================================================
   The 3D engine (leaf module). Owns the THREE renderer/scene/camera,
   lighting, the four per-station groups, and a library of shared
   helpers (coordinate mapping, scale-from-anchor fill meshes, instanced
   scatter, blurred shadow decals, raycast hit-testing).

   Coordinate contract: the camera is placed so that world units at z=0
   equal virtual pixels. A virtual point (px,py) maps to world
   (px-VW/2, VH/2-py, z) via toWorld()/place() — so every hand-tuned
   anchor in game/layout.js is reused directly as a z=0 placement.

   The renderer's canvas (#game3d) is CSS-sized to cover exactly the
   letterbox rect, so no viewport/scissor offset math is needed and the
   NDC mapping for raycasting is independent of scale/offset/DPR.

   This module imports nothing from game/* — it's a pure engine. The
   dispatcher (scene3d.js) and station builders drive it.
   ============================================================ */
import * as THREE from 'three';
import { VW, VH } from '../core/constants.js';
import { onResize, virtualToNDC, VIEW } from '../core/canvas.js';

export { THREE };

export const canvas3d = document.getElementById('game3d');

export const renderer = new THREE.WebGLRenderer({
  canvas: canvas3d, antialias: true, alpha: false, powerPreference: 'high-performance',
});
renderer.setClearColor(0x160d0b, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;

export const scene = new THREE.Scene();

// narrow FOV so the "world units at z=0 == virtual px" trick keeps
// perspective distortion small. distance = (VH/2)/tan(fovY/2).
const FOV = 28;
export const CAM_DIST = (VH/2) / Math.tan((FOV*Math.PI/180)/2);
export const camera = new THREE.PerspectiveCamera(FOV, VW/VH, 10, CAM_DIST*3);
camera.position.set(0, 0, CAM_DIST);
camera.lookAt(0, 0, 0);

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
  if (h && h.id==='halloween'){
    hemi.color.set(0xb99cff); hemi.groundColor.set(0x3a2440); hemi.intensity=0.9;
    keyLight.color.set(0xffb060); keyLight.intensity=1.1;
    fillLight.color.set(0x9a6aff);
  } else if (h && h.id==='christmas'){
    hemi.color.set(0xdbe8ff); hemi.groundColor.set(0x1c3048); hemi.intensity=0.95;
    keyLight.color.set(0xfff2e0); keyLight.intensity=1.1;
    fillLight.color.set(0x9ad0ff);
  } else if (h && h.id==='bday'){
    hemi.color.set(0xffe0f0); hemi.groundColor.set(0x5a2a4a); hemi.intensity=0.95;
    keyLight.color.set(0xfff0d8); keyLight.intensity=1.15;
    fillLight.color.set(0xff9ad0);
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
  machines: [],     // {mesh, index}
  cupZone: null,    // plane mesh; worldToLocal(hit).x -> relX
  customers: [],    // {mesh, id}
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
  }
  return null;
}

/* ============================================================
   Materials — small cache of MeshStandardMaterials by hex color.
   ============================================================ */
const _matCache = new Map();
export function mat(color, opts={}){
  const key = color+'|'+(opts.rough??0.62)+'|'+(opts.metal??0.0)+'|'+(opts.emissive||'')+'|'+(opts.transparent?('t'+opts.opacity):'');
  if (_matCache.has(key) && !opts.noCache) return _matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: opts.rough ?? 0.62,
    metalness: opts.metal ?? 0.0,
  });
  if (opts.emissive){ m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.emissiveIntensity ?? 1; }
  if (opts.transparent){ m.transparent = true; m.opacity = opts.opacity ?? 0.5; }
  if (!opts.noCache) _matCache.set(key, m);
  return m;
}

let R = renderer;
if (typeof window!=='undefined') window.R = renderer;

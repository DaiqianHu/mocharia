/* ============================================================
   3D scene orchestrator. Builds the four station groups (delegating
   the geometry to each station module), dispatches per-frame updates
   by G.station, applies screen-shake, and renders. Thin layer over
   render/three.js; imports the station builders (circular-safe: every
   cross-reference runs inside a function at runtime).
   ============================================================ */
import { THREE, scene, camera, renderer, CAM_DIST,
         orderGroup, brewGroup, topGroup, cannoliGroup,
         setHolidayLighting, place, mat } from './three.js';
import { VW, VH } from '../core/constants.js';
import { G, currentHoliday } from '../game/state.js';
import { buildOrder3D, updateOrder3D } from '../stations/order.js';
import { buildBrew3D, updateBrew3D } from '../stations/brew.js';
import { buildTop3D, updateTop3D } from '../stations/top.js';
import { buildCannoli3D, updateCannoli3D } from '../stations/cannoli.js';

let inited = false;
let lastHoliday = '__none__';

/* A shared "station room": a receding floor plane + back wall, used by the
   brew/top/cannoli stations (the order station gets its own lobby). With a
   straight-on camera a big horizontal floor plane still reads as a receding
   ground surface; the hero objects sit on it with soft shadow decals. */
export function stationRoom3D(holidayWall){
  const g = new THREE.Group();
  // back wall, well behind z=0 for parallax
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(2400, 1200), mat('#efe4cf', {rough:0.98, noCache:true}));
  wall.position.set(0, 120, -420);
  wall.userData.wall = true;
  g.add(wall);
  // wainscot band across the wall
  const band = new THREE.Mesh(new THREE.PlaneGeometry(2400, 150), mat('#b98a5a', {rough:0.9}));
  band.position.set(0, -150, -418);
  g.add(band);
  // floor plane, laid flat, receding from foreground into the wall
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2400, 900), mat('#7a4c28', {rough:0.85, noCache:true}));
  floor.rotation.x = -Math.PI/2;
  floor.position.set(0, -230, -140);
  g.add(floor);
  // a warm ledge the props rest on, low and slightly back so it never
  // occludes anything placed near z=0
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(2400, 60, 90), mat('#8a5a2e', {rough:0.6}));
  ledge.position.set(0, -232, -30);
  g.add(ledge);
  g.userData.wall = wall;
  return g;
}

export function initScene3d(){
  if (inited) return;
  inited = true;
  buildOrder3D(orderGroup);
  buildBrew3D(brewGroup);
  buildTop3D(topGroup);
  buildCannoli3D(cannoliGroup);
}

/* Called from main.js each frame after update(dt). Syncs the 3D scene to
   game state and renders — but only while playing (2D-only screens keep the
   opaque 2D letterbox fill covering #game3d). */
export function update3d(){
  if (G.state!=='play'){ return; }
  if (!inited) initScene3d();

  const hol = currentHoliday();
  const hid = hol ? hol.id : '__none__';
  if (hid!==lastHoliday){ setHolidayLighting(hol); lastHoliday = hid; }

  orderGroup.visible   = G.station==='order';
  brewGroup.visible    = G.station==='brew';
  topGroup.visible     = G.station==='top';
  cannoliGroup.visible = G.station==='cannoli';

  if (G.station==='order') updateOrder3D();
  else if (G.station==='brew') updateBrew3D();
  else if (G.station==='top') updateTop3D();
  else if (G.station==='cannoli') updateCannoli3D();

  // screen shake — jitter the camera by the same G.shakeX/shakeY the 2D
  // layer uses, so both layers shake together.
  camera.position.set(G.shakeX*0.6, G.shakeY*0.6, CAM_DIST);
  camera.lookAt(G.shakeX*0.6, G.shakeY*0.6, 0);

  renderer.render(scene, camera);
}

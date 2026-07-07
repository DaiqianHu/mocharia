/* ============================================================
   Fixed cartoon camera. Each station has a hand-tuned viewpoint
   (render/layout3d.js VIEWS) and switching stations CUTS straight
   to it — Papa's-style hard cuts; the playtester found a flying
   camera disorienting, so the camera never travels. Screen shake
   from G.shakeX/shakeY (passed in by the orchestrator) still
   jitters both the position and the look target so slams feel
   punchy like the 2D HUD layer does.
   ============================================================ */
import { camera } from './three.js';
import { VIEWS } from './layout3d.js';

const cur = { px:0, py:0, pz:0, tx:0, ty:0, tz:0, fov:45 };
let curStation = null;

/* cut straight to a station's viewpoint */
export function snapView(station){
  curStation = station;
  const v = VIEWS[station];
  cur.px=v.pos.x; cur.py=v.pos.y; cur.pz=v.pos.z;
  cur.tx=v.tgt.x; cur.ty=v.tgt.y; cur.tz=v.tgt.z;
  cur.fov=v.fov;
}

export function updateCamera(station, shakeX=0, shakeY=0){
  if (station !== curStation) snapView(station);
  const sx = shakeX*0.8, sy = shakeY*0.8;
  camera.position.set(cur.px + sx, cur.py + sy, cur.pz);
  if (camera.fov !== cur.fov){ camera.fov = cur.fov; camera.updateProjectionMatrix(); }
  camera.lookAt(cur.tx + sx, cur.ty + sy, cur.tz);
}

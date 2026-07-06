/* ============================================================
   Cinematic camera rig. Each station has a hand-tuned viewpoint
   (render/layout3d.js VIEWS); switching stations flies the camera
   there with a smoothstep tween over FLY_TIME. Screen shake from
   G.shakeX/shakeY (passed in by the orchestrator) jitters both the
   position and the look target so the whole frame shakes like the
   2D HUD layer does.
   ============================================================ */
import { camera } from './three.js';
import { VIEWS, FLY_TIME } from './layout3d.js';

const cur  = { px:0, py:0, pz:0, tx:0, ty:0, tz:0, fov:45 };
const from = { px:0, py:0, pz:0, tx:0, ty:0, tz:0, fov:45 };
let toView = null;
let t = 1;
let curStation = null;

function copyView(dst, v){
  dst.px=v.pos.x; dst.py=v.pos.y; dst.pz=v.pos.z;
  dst.tx=v.tgt.x; dst.ty=v.tgt.y; dst.tz=v.tgt.z;
  dst.fov=v.fov;
}

/* jump straight to a station's viewpoint (first frame of a day) */
export function snapView(station){
  curStation = station;
  toView = VIEWS[station];
  copyView(cur, toView);
  t = 1;
}

export function updateCamera(dt, station, shakeX=0, shakeY=0){
  if (!curStation) snapView(station);
  if (station !== curStation){
    curStation = station;
    Object.assign(from, cur);        // fly from wherever we are now
    toView = VIEWS[station];
    t = 0;
  }
  if (t < 1){
    t = Math.min(1, t + dt/FLY_TIME);
    const e = t*t*(3 - 2*t);         // smoothstep
    cur.px = from.px + (toView.pos.x - from.px)*e;
    cur.py = from.py + (toView.pos.y - from.py)*e;
    cur.pz = from.pz + (toView.pos.z - from.pz)*e;
    cur.tx = from.tx + (toView.tgt.x - from.tx)*e;
    cur.ty = from.ty + (toView.tgt.y - from.ty)*e;
    cur.tz = from.tz + (toView.tgt.z - from.tz)*e;
    cur.fov = from.fov + (toView.fov - from.fov)*e;
  }
  const sx = shakeX*0.8, sy = shakeY*0.8;
  camera.position.set(cur.px + sx, cur.py + sy, cur.pz);
  if (camera.fov !== cur.fov){ camera.fov = cur.fov; camera.updateProjectionMatrix(); }
  camera.lookAt(cur.tx + sx, cur.ty + sy, cur.tz);
}

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

/* dayIntro establishing shot: a slow glide from a wide view by the
   door across the café toward the order-station viewpoint. Writes
   `cur` and marks the station as '__dolly__' so the first play-frame
   tween flies smoothly from wherever the glide had reached. */
const DOLLY_FROM = { pos:{x:560, y:290, z:470}, tgt:{x:-260, y:150, z:-280}, fov:54 };
export function dollyCamera(time){
  const o = VIEWS.order;
  const e = Math.min(1, time/12);
  const k = 1 - (1-e)*(1-e);           // ease-out, still creeping at the end
  cur.px = DOLLY_FROM.pos.x + (o.pos.x - DOLLY_FROM.pos.x)*k;
  cur.py = DOLLY_FROM.pos.y + (o.pos.y - DOLLY_FROM.pos.y)*k;
  cur.pz = DOLLY_FROM.pos.z + (o.pos.z - DOLLY_FROM.pos.z)*k;
  cur.tx = DOLLY_FROM.tgt.x + (o.tgt.x - DOLLY_FROM.tgt.x)*k;
  cur.ty = DOLLY_FROM.tgt.y + (o.tgt.y - DOLLY_FROM.tgt.y)*k;
  cur.tz = DOLLY_FROM.tgt.z + (o.tgt.z - DOLLY_FROM.tgt.z)*k;
  cur.fov = DOLLY_FROM.fov + (o.fov - DOLLY_FROM.fov)*k;
  curStation = '__dolly__';
  t = 1;
  camera.position.set(cur.px, cur.py, cur.pz);
  if (camera.fov !== cur.fov){ camera.fov = cur.fov; camera.updateProjectionMatrix(); }
  camera.lookAt(cur.tx, cur.ty, cur.tz);
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

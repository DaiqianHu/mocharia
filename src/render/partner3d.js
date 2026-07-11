/* ============================================================
   The co-op partner, visible in the café — a chibi (render/people.js)
   standing at whichever station the other player is working (their
   station arrives on the 5 Hz presence stream → NET.partner.station),
   walking between station spots when they switch tabs. Runs the same
   way on host and guest, driven purely by NET.partner.

   Appearance is derived deterministically from the partner's NAME
   (both sides already know it from the hello/welcome handshake), so
   both screens draw the same look with zero appearance bytes on the
   wire. Two players with the same name get twin looks — acceptable.

   Lifecycle is lazy: created/updated/torn down from updatePartner3D,
   which only runs on rendered play/dayIntro frames — if the state
   leaves play with a rig alive it just lingers unrendered until the
   next play frame re-evaluates inCoop() and disposes or rebuilds.

   The walk is a straight cosmetic lerp; it may briefly clip counters
   on cross-café moves — accepted background-flourish simplification
   (a waypoint path could come later). The CAMERA never moves for any
   of this.
   ============================================================ */
import { THREE, scene, camera, projectVirtual } from './three.js';
import { makeChibi, updateChibi, disposeChibi } from './people.js';
import { PARTNER_SPOTS } from './layout3d.js';
import { puff3d } from './fx3d.js';
import { LOOKS } from '../game/customer.js';
import { NET, inCoop } from '../net/coop.js';
import { TAU, VW, VH } from '../core/constants.js';

const WALK_SPD = 300;                 // world units/s between station spots

let rig = null;
let cust = null;                      // synthetic cust-shaped driver for updateChibi
let curName = '';
const pos = { x: 0, z: 0, yaw: 0 };
const st = { name:'', station:'', x:0, z:0, walking:false, hasRig:false };
if (typeof window !== 'undefined') window.PARTNER3D = st;   // test hook

/* FNV-1a over the name, folded once per pick — same name, same look,
   on both screens */
function hashLook(name){
  let h = 2166136261 >>> 0;
  for (let i=0; i<name.length; i++){ h ^= name.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  const next = () => (h = Math.imul(h, 16777619) >>> 0);
  return {
    skin:  LOOKS.skins[next() % LOOKS.skins.length],
    shirt: LOOKS.shirts[next() % LOOKS.shirts.length],
    pants: LOOKS.pants[next() % LOOKS.pants.length],
    hairC: LOOKS.hairs[next() % LOOKS.hairs.length],
    hairStyle: next() % 6,
    glasses: next() % 4 === 0,
    bobPhase: (next() % 628) / 100,
  };
}

function build(name, station){
  cust = { id:'__partner', name, ...hashLook(name),
           mood:'happy', reaction:0, stompT:0, walking:false };
  rig = makeChibi(cust);
  scene.add(rig.group);
  curName = name;
  const spot = PARTNER_SPOTS[station] || PARTNER_SPOTS.order;
  pos.x = spot.x; pos.z = spot.z; pos.yaw = 0;
}

function teardown(){
  scene.remove(rig.group);
  disposeChibi(rig);
  rig = cust = null;
  curName = '';
  st.hasRig = false;
}

/* per rendered play/dayIntro frame (render/scene3d.js) */
export function updatePartner3D(dt, t){
  const p = inCoop() && NET.partner && NET.partner.name ? NET.partner : null;
  if (!p){ if (rig) teardown(); return; }
  if (p.name !== curName){ if (rig) teardown(); build(p.name, p.station); }

  // stroll toward the current station's spot at constant speed so the
  // walk cycle reads; face the walk direction, else the camera
  const spot = PARTNER_SPOTS[p.station] || PARTNER_SPOTS.order;
  const dx = spot.x - pos.x, dz = spot.z - pos.z;
  const dist = Math.hypot(dx, dz);
  cust.walking = dist > 4;
  if (dist > 0.001){
    const step = Math.min(dist, WALK_SPD * dt);
    pos.x += dx/dist * step; pos.z += dz/dist * step;
  }
  const yaw = cust.walking
    ? Math.atan2(dx, dz)
    : Math.atan2(camera.position.x - pos.x, camera.position.z - pos.z);
  const dy = ((yaw - pos.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
  pos.yaw += dy * 0.15;

  if (cust.reaction > 0) cust.reaction -= dt;
  updateChibi(rig, cust, t, pos.x, pos.z, pos.yaw);

  st.name = curName; st.station = p.station;
  st.x = pos.x; st.z = pos.z; st.walking = cust.walking; st.hasRig = true;
}

/* virtual-px anchor just above the chibi's head for the 2D name pill —
   null when there's no rig or the point is off-frame/behind the camera */
const _v = new THREE.Vector3();
export function partnerAnchor(){
  if (!rig) return null;
  _v.set(pos.x, 210, pos.z).applyMatrix4(camera.matrixWorldInverse);
  if (_v.z > -20) return null;                      // behind (or hugging) the camera
  const a = projectVirtual(pos.x, 210, pos.z);
  if (a.x < -40 || a.x > VW+40 || a.y < -40 || a.y > VH+40) return null;
  return { x: a.x, y: a.y, name: curName };
}

/* the chibi celebrates the emote its player just sent */
export function partnerEmoteJuice(id){
  if (!rig) return;
  cust.reaction = 0.7;   // the served-pop squash from updateChibi
  const kind = id==='heart' || id==='cat' ? 'heart' : 'steam';
  for (let i=0; i<3; i++)
    puff3d(pos.x + (i-1)*12, 190 + i*6, pos.z, { kind, size:14, life:1.1, vy:30 });
}

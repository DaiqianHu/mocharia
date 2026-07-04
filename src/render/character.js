/* ============================================================
   Procedural character rig. A ~17-bone THREE.SkinnedMesh biped built
   entirely in code from merged primitive geometry with rigid (single
   bone, weight 1) skin weights. One prototype is authored once, then
   SkeletonUtils.clone()'d per customer and recoloured via a per-clone
   material array (geometry groups map each body part to a material
   slot: skin / shirt / pants / hair / shoe / eye).

   Animation is direct per-frame bone.rotation assignment in
   poseCharacter() — a port of the 2D bob/walk/stomp formulas. No
   AnimationMixer, no clips, no downloaded assets.
   ============================================================ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

/* bone table: name, parent index, rest world position (model space, feet y=0) */
const BONES = [
  ['hips',      -1, [0, 60, 0]],
  ['spine',      0, [0, 72, 0]],
  ['chest',      1, [0, 86, 0]],
  ['neck',       2, [0,100, 0]],
  ['head',       3, [0,108, 0]],
  ['upperArmL',  2, [-15, 96, 0]],
  ['foreArmL',   5, [-18, 79, 0]],
  ['handL',      6, [-20, 63, 0]],
  ['upperArmR',  2, [ 15, 96, 0]],
  ['foreArmR',   8, [ 18, 79, 0]],
  ['handR',      9, [ 20, 63, 0]],
  ['thighL',     0, [-7, 58, 0]],
  ['shinL',     11, [-8, 32, 0]],
  ['footL',     12, [-8,  8, 0]],
  ['thighR',     0, [ 7, 58, 0]],
  ['shinR',     14, [ 8, 32, 0]],
  ['footR',     15, [ 8,  8, 0]],
];
const IDX = {}; BONES.forEach((b,i)=> IDX[b[0]] = i);

// material slots
const M_SKIN=0, M_SHIRT=1, M_PANTS=2, M_HAIR=3, M_SHOE=4, M_EYE=5;

/* one body part: primitive geometry, translated to its model-space rest
   center, tagged rigidly to one bone and one material slot */
function part(geo, cx, cy, cz, boneName, matIndex){
  geo.translate(cx, cy, cz);
  const n = geo.attributes.position.count;
  const si = new Uint16Array(n*4), sw = new Float32Array(n*4);
  const b = IDX[boneName];
  for (let i=0;i<n;i++){ si[i*4]=b; sw[i*4]=1; }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si,4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw,4));
  // strip uv so every part has an identical attribute set for the merge
  geo.deleteAttribute('uv');
  geo.clearGroups();
  geo.addGroup(0, Infinity, matIndex);
  return geo;
}

function cap(r, len, seg=6){ return new THREE.CapsuleGeometry(r, len, 4, seg); }

function buildGeometry(){
  const P = [];
  // torso + pelvis
  P.push(part(new THREE.BoxGeometry(24,16,15), 0,60,0, 'hips',  M_PANTS));
  P.push(part(new THREE.BoxGeometry(30,30,17,2,2,2), 0,78,0, 'chest', M_SHIRT));
  // neck + head + hair + eyes
  P.push(part(new THREE.CylinderGeometry(4,4.5,9,8), 0,101,0, 'neck', M_SKIN));
  P.push(part(new THREE.SphereGeometry(13,18,14), 0,109,0, 'head', M_SKIN));
  P.push(part(new THREE.SphereGeometry(13.8,18,12, 0, Math.PI*2, 0, Math.PI*0.44), 0,110,0, 'head', M_HAIR));
  P.push(part(new THREE.SphereGeometry(2.3,8,8), -5,107,11.5, 'head', M_EYE));
  P.push(part(new THREE.SphereGeometry(2.3,8,8),  5,107,11.5, 'head', M_EYE));
  // arms (shirt sleeve upper, skin forearm + hand)
  P.push(part(cap(4.5,10), -16,87.5,0, 'upperArmL', M_SHIRT));
  P.push(part(cap(4,11),   -19,71,0,   'foreArmL',  M_SKIN));
  P.push(part(new THREE.SphereGeometry(4.6,10,8), -20,62,0, 'handL', M_SKIN));
  P.push(part(cap(4.5,10),  16,87.5,0, 'upperArmR', M_SHIRT));
  P.push(part(cap(4,11),    19,71,0,   'foreArmR',  M_SKIN));
  P.push(part(new THREE.SphereGeometry(4.6,10,8),  20,62,0, 'handR', M_SKIN));
  // legs (pants) + shoes
  P.push(part(cap(5.5,16), -7.5,45,0, 'thighL', M_PANTS));
  P.push(part(cap(5,16),   -8,20,0,   'shinL',  M_PANTS));
  P.push(part(new THREE.BoxGeometry(9,7,17), -8,4,4, 'footL', M_SHOE));
  P.push(part(cap(5.5,16),  7.5,45,0, 'thighR', M_PANTS));
  P.push(part(cap(5,16),    8,20,0,   'shinR',  M_PANTS));
  P.push(part(new THREE.BoxGeometry(9,7,17),  8,4,4, 'footR', M_SHOE));
  return mergeGeometries(P, true);
}

function baseMaterials(){
  const m = c => new THREE.MeshStandardMaterial({ color:new THREE.Color(c), roughness:0.72, metalness:0 });
  const arr = [];
  arr[M_SKIN]=m('#f3c9a0'); arr[M_SHIRT]=m('#e2574c'); arr[M_PANTS]=m('#3a4a5c');
  arr[M_HAIR]=m('#2c1c12'); arr[M_SHOE]=m('#20160f'); arr[M_EYE]=m('#241812');
  return arr;
}

let _proto = null;
export function characterProto(){
  if (_proto) return _proto;
  const geo = buildGeometry();
  // build bone hierarchy
  const bones = BONES.map(([name,parent,pos])=>{ const b=new THREE.Bone(); b.name=name; return b; });
  BONES.forEach(([name,parent,pos],i)=>{
    const [x,y,z]=pos;
    if (parent<0){ bones[i].position.set(x,y,z); }
    else {
      const p = BONES[parent][2];
      bones[i].position.set(x-p[0], y-p[1], z-p[2]);
      bones[parent].add(bones[i]);
    }
  });
  const mesh = new THREE.SkinnedMesh(geo, baseMaterials());
  mesh.add(bones[0]);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  _proto = mesh;
  return _proto;
}

/* Clone the prototype and give it this customer's colours. Returns a rig
   handle { group, mesh, bones } used by poseCharacter(). */
export function cloneCharacter(cust){
  const proto = characterProto();
  const mesh = skeletonClone(proto);
  mesh.material = proto.material.map(m=>m.clone());
  mesh.material[M_SKIN].color.set(cust.skin);
  mesh.material[M_SHIRT].color.set(cust.shirt);
  mesh.material[M_PANTS].color.set(cust.pants);
  mesh.material[M_HAIR].color.set(cust.hairC);
  const group = new THREE.Group();
  group.add(mesh);
  const bones = {};
  mesh.traverse(o=>{ if (o.isBone) bones[o.name]=o; });
  group.userData.custId = cust.id;
  return { group, mesh, bones };
}

/* Port of the 2D bob / walk / stomp animation to bone rotations. */
export function poseCharacter(rig, cust, t){
  const b = rig.bones;
  const angry = cust.mood==='angry' || cust.mood==='furious';
  const walk = cust.walking ? Math.sin(t*11 + cust.bobPhase) : 0;
  const stomp = angry ? Math.abs(Math.sin(cust.stompT*Math.PI)) : 0;
  const bob = angry ? stomp*3 : Math.sin(t*2.4 + cust.bobPhase)*1.4;
  rig.group.position.y = rig.baseY + bob;

  // gentle idle sway of the upper body
  if (b.chest) b.chest.rotation.z = Math.sin(t*2.0 + cust.bobPhase)*0.02;
  if (b.head)  b.head.rotation.z  = Math.sin(t*1.7 + cust.bobPhase)*0.03;

  if (angry){
    // fists on hips: arms out and forearms turned inward
    if (b.upperArmL) b.upperArmL.rotation.set(0.2, 0, 0.75);
    if (b.upperArmR) b.upperArmR.rotation.set(0.2, 0, -0.75);
    if (b.foreArmL)  b.foreArmL.rotation.set(0, 0, -1.15);
    if (b.foreArmR)  b.foreArmR.rotation.set(0, 0, 1.15);
    // stomping: alternate leg lift
    const s = Math.sin(cust.stompT*Math.PI);
    if (b.thighL) b.thighL.rotation.x = Math.max(0, s)*0.6;
    if (b.thighR) b.thighR.rotation.x = Math.max(0,-s)*0.6;
    if (b.shinL)  b.shinL.rotation.x = -Math.max(0, s)*0.7;
    if (b.shinR)  b.shinR.rotation.x = -Math.max(0,-s)*0.7;
  } else {
    // walk / idle arm + leg swing
    const sw = cust.walking ? walk*0.5 : Math.sin(t*2.4+cust.bobPhase)*0.06;
    if (b.upperArmL) b.upperArmL.rotation.set(-sw, 0, 0.06);
    if (b.upperArmR) b.upperArmR.rotation.set( sw, 0,-0.06);
    if (b.foreArmL)  b.foreArmL.rotation.set(0,0,0);
    if (b.foreArmR)  b.foreArmR.rotation.set(0,0,0);
    const lsw = cust.walking ? walk*0.5 : 0;
    if (b.thighL) b.thighL.rotation.x =  lsw;
    if (b.thighR) b.thighR.rotation.x = -lsw;
    if (b.shinL)  b.shinL.rotation.x = Math.max(0,-lsw)*0.6;
    if (b.shinR)  b.shinR.rotation.x = Math.max(0, lsw)*0.6;
  }
}

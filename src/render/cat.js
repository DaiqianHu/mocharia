/* ============================================================
   Mocha the café cat — a procedural loaf-pose cat napping on the
   front counter, framed by the order camera. Built with the same
   patterns as the chibi customers (render/people.js): toon materials
   on primitive geometry, a cartoon face DRAWN onto a CanvasTexture
   sphere-cap, redrawn only when its key (sleep|pet) changes.
   Tapping her raycasts through colliders.cat and runs petCat() in
   game/state.js (purr + hearts + a small patience calm); asleep she
   exhales lazy Z puffs through the fx3d pool.
   ============================================================ */
import * as THREE from 'three';
import { TOON_RAMP, stationRig, place, colliderMaterial, colliders, projectVirtual } from './three.js';
import { RIGS } from './layout3d.js';
import { puff3d } from './fx3d.js';
import { G } from '../game/state.js';
import { rand, TAU } from '../core/constants.js';

const FUR = '#8a6244', CREAM = '#e8d6b8', PAD = '#f2b9c4';
const FACE_SIZE = 256;

function toon(color){
  return new THREE.MeshToonMaterial({ color: new THREE.Color(color), gradientMap: TOON_RAMP });
}

/* ---- the cat face (sleeping ∪∪ eyes, or wide awake while petted) ---- */
function drawCatFace(c, awake){
  c.clearRect(0, 0, FACE_SIZE, FACE_SIZE);
  const cx = 128, eyeY = 108;
  // eyes
  c.strokeStyle='#2b1a10'; c.lineWidth=9; c.lineCap='round';
  if (awake){
    c.fillStyle='#8fd06a';
    c.beginPath(); c.ellipse(cx-44,eyeY,20,24,0,0,TAU); c.ellipse(cx+44,eyeY,20,24,0,0,TAU); c.fill();
    c.fillStyle='#22140c';
    c.beginPath(); c.ellipse(cx-44,eyeY+2,8,17,0,0,TAU); c.ellipse(cx+44,eyeY+2,8,17,0,0,TAU); c.fill();
    c.fillStyle='rgba(255,255,255,0.9)';
    c.beginPath(); c.arc(cx-50,eyeY-8,5,0,TAU); c.arc(cx+38,eyeY-8,5,0,TAU); c.fill();
    c.fillStyle='rgba(240,120,110,0.4)';
    c.beginPath(); c.arc(cx-84,150,15,0,TAU); c.arc(cx+84,150,15,0,TAU); c.fill();
  } else {
    // content closed eyes: two gentle smile arcs
    c.beginPath();
    c.arc(cx-44, eyeY-6, 20, 0.15*Math.PI, 0.85*Math.PI);
    c.stroke();
    c.beginPath();
    c.arc(cx+44, eyeY-6, 20, 0.15*Math.PI, 0.85*Math.PI);
    c.stroke();
  }
  // pink triangle nose
  c.fillStyle='#e88ba0';
  c.beginPath(); c.moveTo(cx-10,132); c.lineTo(cx+10,132); c.lineTo(cx,148); c.closePath(); c.fill();
  // 'w' mouth
  c.strokeStyle='#2b1a10'; c.lineWidth=7;
  c.beginPath(); c.arc(cx-13,152,13,0.1*Math.PI,0.9*Math.PI); c.stroke();
  c.beginPath(); c.arc(cx+13,152,13,0.1*Math.PI,0.9*Math.PI); c.stroke();
  // whiskers
  c.strokeStyle='rgba(70,50,36,0.8)'; c.lineWidth=5;
  c.beginPath();
  for (const s of [-1,1]){
    c.moveTo(cx+s*40,140); c.lineTo(cx+s*100,128);
    c.moveTo(cx+s*40,150); c.lineTo(cx+s*102,150);
    c.moveTo(cx+s*40,160); c.lineTo(cx+s*100,172);
  }
  c.stroke();
}

let cat3d = null;

/* Build Mocha into the lobby rig space (virtual-px local coords, so the
   counter-top anchor is hand-tunable like every other lobby prop). */
export function buildCat3D(group){
  const rig = stationRig(RIGS.lobby.anchor, RIGS.lobby.at, RIGS.lobby.s);
  group.add(rig);
  const root = new THREE.Group();
  place(root, 415, 450, 52);           // on the front counter top, right of the register
  root.rotation.y = 0.5;               // angled toward the order camera
  rig.add(root);

  const furMat = toon(FUR), creamMat = toon(CREAM);

  // loaf body
  const body = new THREE.Mesh(new THREE.SphereGeometry(26, 20, 14), furMat);
  body.scale.set(1.05, 0.62, 1.35);
  body.position.y = 16;
  root.add(body);
  // front paws peeking out of the loaf
  for (const dx of [-1,1]){
    const paw = new THREE.Mesh(new THREE.SphereGeometry(7, 10, 8), creamMat);
    paw.scale.set(1, 0.7, 1.3);
    paw.position.set(dx*10, 6, 36);
    root.add(paw);
  }
  // curled tail resting flat beside the loaf
  const tail = new THREE.Mesh(new THREE.TorusGeometry(15, 4.2, 8, 18, Math.PI*1.5), furMat);
  tail.rotation.x = -Math.PI/2;
  tail.position.set(21, 6, -16);
  root.add(tail);

  // head
  const head = new THREE.Group();
  head.position.set(0, 30, 28);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(18, 20, 14), furMat);
  skull.scale.y = 0.94;
  head.add(skull);
  const ears = [];
  for (const dx of [-1,1]){
    const ear = new THREE.Mesh(new THREE.ConeGeometry(7.5, 13, 6), furMat);
    ear.position.set(dx*11, 15, -3);
    ear.rotation.z = -dx*0.25;
    head.add(ear);
    ears.push(ear);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(4, 7, 6), toon(PAD));
    inner.position.set(dx*11, 13.4, -1.4);
    inner.rotation.z = -dx*0.25;
    head.add(inner);
  }
  // red collar with a wee gold tag
  const collar = new THREE.Mesh(new THREE.TorusGeometry(13, 2.6, 6, 16), toon('#c04434'));
  collar.rotation.x = Math.PI/2 - 0.35;
  collar.position.set(0, -11, -2);
  head.add(collar);
  const tag = new THREE.Mesh(new THREE.SphereGeometry(3.4, 8, 6), toon('#e8b040'));
  tag.position.set(0, -13, 12);
  head.add(tag);
  // drawn face on a front sphere-cap
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = faceCanvas.height = FACE_SIZE;
  const faceCtx = faceCanvas.getContext('2d');
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.generateMipmaps = false;
  faceTex.minFilter = THREE.LinearFilter;
  const capW = 1.6, capH = 1.25;
  const faceGeo = new THREE.SphereGeometry(18.7, 20, 14,
    Math.PI/2 - capW/2, capW, Math.PI/2 - capH/2 + 0.06, capH);
  const face = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({
    map: faceTex, transparent: true, toneMapped: false }));
  face.scale.y = 0.94;
  head.add(face);
  root.add(head);

  // generous invisible tap collider (kid fingers)
  const col = new THREE.Mesh(new THREE.BoxGeometry(80, 66, 96), colliderMaterial());
  col.position.set(0, 30, 8);
  root.add(col);
  colliders.cat = col;

  cat3d = { root, body, head, ears, tail, faceCtx, faceTex,
    faceKey: '', zAcc: 1.5, twitchAt: 3, twitchT: 0 };
}

const _cw = new THREE.Vector3();
function catWorld(lx, ly, lz){
  _cw.set(lx, ly, lz);
  cat3d.root.updateWorldMatrix(true, false);
  return cat3d.root.localToWorld(_cw);
}

export function updateCat3D(dt){
  if (!cat3d) return;
  const t = G.time;
  const pet = G.cat.petT > 0;
  // breathing
  cat3d.body.scale.y = 0.62 * (1 + 0.035*Math.sin(t*2.1));
  // tail sway (flat torus: local z-rot spins it on the counter)
  cat3d.tail.rotation.z = Math.sin(t*0.9)*0.18;
  // ear twitch every few seconds
  if (t > cat3d.twitchAt){ cat3d.twitchAt = t + 3 + Math.random()*3; cat3d.twitchT = 0.28; }
  if (cat3d.twitchT > 0){
    cat3d.twitchT -= dt;
    cat3d.ears[0].rotation.z = 0.25 + Math.sin(cat3d.twitchT*40)*0.15;
  } else cat3d.ears[0].rotation.z = 0.25;
  // pet reaction: head pops up with a purr wiggle
  if (pet){
    cat3d.head.position.y = 30 + 5*Math.min(1, (1.6 - G.cat.petT)*5);
    cat3d.head.rotation.z = Math.sin(t*26)*0.04;
  } else {
    cat3d.head.position.y = 30;
    cat3d.head.rotation.z = Math.sin(t*1.1)*0.02;
  }
  // face redraw only when sleep|pet flips
  const key = pet ? 'pet' : 'sleep';
  if (key !== cat3d.faceKey){
    cat3d.faceKey = key;
    drawCatFace(cat3d.faceCtx, pet);
    cat3d.faceTex.needsUpdate = true;
  }
  // lazy Zs while asleep
  if (!pet){
    cat3d.zAcc -= dt;
    if (cat3d.zAcc <= 0){
      cat3d.zAcc = 2.2 + Math.random()*1.4;
      const p = catWorld(6, 56, 26);
      puff3d(p.x, p.y, p.z, { kind:'z', vy:15, size:11, life:2.2, sway:5 });
    }
  }
}

/* heart burst over her head when petted (called by petCat) */
export function catHearts(){
  if (!cat3d) return;
  for (let i=0;i<5;i++){
    const p = catWorld(rand(-20,20), 42+rand(0,16), rand(4,32));
    puff3d(p.x, p.y, p.z, { kind:'heart', vy:rand(20,32), size:rand(9,13), life:rand(0.9,1.4), sway:rand(3,7) });
  }
}

/* virtual-px anchor above her head, for popTexts + the V3 test hook */
export function catScreen(){
  if (!cat3d) return null;
  const p = catWorld(0, 60, 28);
  return projectVirtual(p.x, p.y, p.z);
}

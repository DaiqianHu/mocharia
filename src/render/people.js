/* ============================================================
   Chibi customer rigs — big-headed toy-like 3D people with the
   cartoon face DRAWN onto the head as a CanvasTexture (ported from
   Customer.drawFigure's face code, expressions keyed to mood), built
   procedurally as a THREE.Group hierarchy (no skinning): stubby legs,
   round torso, swing arms, oversized head with geometric hair per
   hairStyle. Animation is per-frame rotation/position assignment
   using the same sine formulas as the old 2D figure (bob / walkA /
   stomp / reaction pop).

   Model space: feet at y=0, faces +z; total height ≈ 192.
   ============================================================ */
import * as THREE from 'three';
import { TOON_RAMP } from './three.js';
import { shade, TAU } from '../core/constants.js';

const HEAD_R = 42, HEAD_Y = 150;    // head centre (top ≈ 192)
const TORSO_R = 25, TORSO_LEN = 32; // capsule: total 82 tall
const TORSO_Y = 76;                 // torso centre
const LEG_R = 8.5, LEG_LEN = 20;    // capsule: 37 tall, hip-pivoted
const ARM_R = 7, ARM_LEN = 26;      // capsule: 40 tall, shoulder-pivoted

function toon(color){
  return new THREE.MeshToonMaterial({ color: new THREE.Color(color), gradientMap: TOON_RAMP });
}

/* ---- the face texture (256x256, redrawn only when its key changes) ---- */
const FACE_SIZE = 256;
function drawFace(c, cust, blink){
  c.clearRect(0, 0, FACE_SIZE, FACE_SIZE);
  const cx = 128, eyeY = 118;
  const angry = cust.mood==='angry' || cust.mood==='furious';
  const furious = cust.mood==='furious';
  // eyes: whites + pupils (or shut lines mid-blink)
  if (blink){
    c.strokeStyle='#2b1a10'; c.lineWidth=7; c.lineCap='round';
    c.beginPath(); c.moveTo(cx-64,eyeY); c.lineTo(cx-24,eyeY);
    c.moveTo(cx+24,eyeY); c.lineTo(cx+64,eyeY); c.stroke();
  } else {
    c.fillStyle='#fff';
    c.beginPath(); c.ellipse(cx-44,eyeY,26,30,0,0,TAU); c.ellipse(cx+44,eyeY,26,30,0,0,TAU); c.fill();
    c.fillStyle='#2b1a10';
    c.beginPath(); c.arc(cx-44,eyeY+5,13,0,TAU); c.arc(cx+44,eyeY+5,13,0,TAU); c.fill();
  }
  // brows
  c.strokeStyle='#2b1a10'; c.lineWidth=10; c.lineCap='round';
  c.beginPath();
  if (angry){ c.moveTo(cx-70,eyeY-58); c.lineTo(cx-20,eyeY-38); c.moveTo(cx+70,eyeY-58); c.lineTo(cx+20,eyeY-38); }
  else if (cust.mood==='meh'){ c.moveTo(cx-66,eyeY-46); c.lineTo(cx-22,eyeY-46); c.moveTo(cx+66,eyeY-46); c.lineTo(cx+22,eyeY-46); }
  else { c.moveTo(cx-66,eyeY-44); c.quadraticCurveTo(cx-44,eyeY-58,cx-22,eyeY-44);
         c.moveTo(cx+66,eyeY-44); c.quadraticCurveTo(cx+44,eyeY-58,cx+22,eyeY-44); }
  c.stroke();
  if (cust.glasses){
    c.strokeStyle='rgba(40,30,26,0.85)'; c.lineWidth=8;
    c.beginPath(); c.arc(cx-44,eyeY,34,0,TAU); c.stroke();
    c.beginPath(); c.arc(cx+44,eyeY,34,0,TAU); c.stroke();
    c.beginPath(); c.moveTo(cx-10,eyeY); c.lineTo(cx+10,eyeY); c.stroke();
  }
  // mouth
  c.strokeStyle='#2b1a10'; c.lineWidth=11; c.lineCap='round';
  c.beginPath();
  if (cust.mood==='happy') c.arc(cx,168,34,0.15*Math.PI,0.85*Math.PI);
  else if (cust.mood==='meh'){ c.moveTo(cx-28,186); c.lineTo(cx+28,186); }
  else if (furious){ c.stroke(); c.fillStyle='#7a2a1e';
    c.beginPath(); c.ellipse(cx,192,32,22,0,0,TAU); c.fill(); c.beginPath(); }
  else c.arc(cx,214,34,1.15*Math.PI,1.85*Math.PI);
  c.stroke();
  // happy blush / angry flush
  if (cust.mood==='happy'){
    c.fillStyle='rgba(240,120,110,0.35)';
    c.beginPath(); c.arc(cx-84,164,18,0,TAU); c.arc(cx+84,164,18,0,TAU); c.fill();
  }
  if (angry){
    c.fillStyle = furious ? 'rgba(220,60,40,0.30)' : 'rgba(220,60,40,0.15)';
    c.fillRect(0,0,FACE_SIZE,FACE_SIZE);
  }
}

/* ---- hair styles: geometry per Customer.hairStyle 0..5 ---- */
function buildHair(style, hairMat){
  const g = new THREE.Group();
  const cap = (r, thetaLen=Math.PI*0.55) =>
    new THREE.Mesh(new THREE.SphereGeometry(r, 20, 12, 0, TAU, 0, thetaLen), hairMat);
  switch(style){
    case 0: { const h=cap(HEAD_R+2.5); h.rotation.x=-0.18; g.add(h); break; }
    case 1: { const h=cap(HEAD_R+2.5); h.rotation.x=-0.14; h.rotation.z=0.12; g.add(h);
      const blob=new THREE.Mesh(new THREE.SphereGeometry(14,12,10), hairMat);
      blob.position.set(-26,8,20); g.add(blob); break; }
    case 2: { const h=cap(HEAD_R+2.5, Math.PI*0.5); g.add(h);
      const bun=new THREE.Mesh(new THREE.SphereGeometry(15,12,10), hairMat);
      bun.position.set(0, HEAD_R+6, -6); g.add(bun); break; }
    case 3: { const h=cap(HEAD_R+2.5, Math.PI*0.62); g.add(h);
      for (const dx of [-1,1]){
        const lock=new THREE.Mesh(new THREE.CapsuleGeometry(9, 34, 4, 10), hairMat);
        lock.position.set(dx*(HEAD_R-4), -22, -8); g.add(lock);
      } break; }
    case 4: { for (let i=0;i<5;i++){
        const curl=new THREE.Mesh(new THREE.SphereGeometry(15,12,10), hairMat);
        const a=(i/4-0.5)*1.9;
        curl.position.set(Math.sin(a)*(HEAD_R-4), Math.cos(a)*(HEAD_R-2)+4, -4);
        g.add(curl);
      } break; }
    default: { for (const dx of [-1,1]){
        const puff=new THREE.Mesh(new THREE.SphereGeometry(11,12,10), hairMat);
        puff.position.set(dx*(HEAD_R-6), 14, -14); g.add(puff);
      } break; }
  }
  return g;
}

/* Build one chibi rig for a customer. Returns { group, ... } — group
   is placed by the caller (feet at group origin, model faces +z). */
export function makeChibi(cust){
  const group = new THREE.Group();
  group.userData.custId = cust.id;

  const skinMat  = toon(cust.skin);
  const shirtMat = toon(cust.shirt);
  const armMat   = toon(shade(cust.shirt,-8));
  const pantsMat = toon(cust.pants);
  const shoeMat  = toon('#2e2620');
  const hairMat  = toon(cust.hairC);

  // legs + shoes (hip-pivoted so rotation.x swings them)
  const legs = [];
  for (const dx of [-1,1]){
    const hip = new THREE.Group();
    hip.position.set(dx*11, 42, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(LEG_R, LEG_LEN, 4, 10), pantsMat);
    leg.position.y = -18;
    hip.add(leg);
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(11, 12, 8), shoeMat);
    shoe.scale.set(1, 0.62, 1.5);
    shoe.position.set(0, -36, 4);
    hip.add(shoe);
    group.add(hip);
    legs.push(hip);
  }

  // torso
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(TORSO_R, TORSO_LEN, 6, 14), shirtMat);
  torso.position.y = TORSO_Y;
  torso.scale.set(1, 1, 0.85);
  group.add(torso);

  // arms (shoulder-pivoted) + skin hands
  const arms = [];
  for (const dx of [-1,1]){
    const shoulder = new THREE.Group();
    shoulder.position.set(dx*(TORSO_R+4), 100, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(ARM_R, ARM_LEN, 4, 10), armMat);
    arm.position.y = -16;
    shoulder.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(7.5, 10, 8), skinMat);
    hand.position.set(0, -36, 0);
    shoulder.add(hand);
    group.add(shoulder);
    arms.push(shoulder);
  }

  // head: big skin sphere + ears + face cap + hair
  const head = new THREE.Group();
  head.position.y = HEAD_Y;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R, 24, 18), skinMat);
  skull.scale.y = 0.96;
  head.add(skull);
  for (const dx of [-1,1]){
    const ear = new THREE.Mesh(new THREE.SphereGeometry(8, 10, 8), skinMat);
    ear.position.set(dx*(HEAD_R-1), -2, 0);
    head.add(ear);
  }
  // face: canvas texture on a front sphere-cap so it hugs the head
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = faceCanvas.height = FACE_SIZE;
  const faceCtx = faceCanvas.getContext('2d');
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.generateMipmaps = false;
  faceTex.minFilter = THREE.LinearFilter;
  const capW = 1.5, capH = 1.15;   // radians of head the face covers
  const faceGeo = new THREE.SphereGeometry(HEAD_R+0.8, 24, 18,
    Math.PI/2 - capW/2, capW,                 // phi: centred on +z
    Math.PI/2 - capH/2 + 0.08, capH);         // theta: centred just below equator
  const face = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({
    map: faceTex, transparent: true, toneMapped: false }));
  face.scale.y = 0.96;
  head.add(face);
  head.add(buildHair(cust.hairStyle, hairMat));
  group.add(head);

  const rig = { group, legs, arms, head, torso, faceCtx, faceTex, faceKey: '',
    blinkAt: 2 + Math.random()*3, mats: [skinMat, shirtMat, armMat, pantsMat, shoeMat, hairMat] };
  return rig;
}

/* Per-frame pose + face refresh. (wx,wz) is the world position of the
   feet; yaw is the facing direction (radians, 0 = +z). */
export function updateChibi(rig, cust, t, wx, wz, yaw){
  const angry = cust.mood==='angry' || cust.mood==='furious';
  const stomp = angry ? Math.abs(Math.sin(cust.stompT*Math.PI))*7 : 0;
  const bob = cust.walking ? Math.abs(Math.sin(t*11 + cust.bobPhase))*3
            : angry ? stomp : Math.sin(t*2.4 + cust.bobPhase)*2;
  const walkA = cust.walking ? Math.sin(t*11 + cust.bobPhase) : 0;

  rig.group.position.set(wx, bob, wz);
  rig.group.rotation.y = yaw;
  // reaction pop after being served
  const rx = cust.reaction>0 ? 1 + Math.sin(cust.reaction*14)*0.06 : 1;
  rig.group.scale.setScalar(rx);

  // legs: swing while walking; alternate stomping when angry
  const legSwing = cust.walking ? walkA*0.55 : 0;
  const stompLift = angry && !cust.walking ? Math.sin(cust.stompT*Math.PI)*0.5 : 0;
  rig.legs[0].rotation.x =  legSwing + Math.max(0, stompLift);
  rig.legs[1].rotation.x = -legSwing + Math.max(0,-stompLift);

  // arms: swing opposite the legs; angry = fists jammed down at sides
  if (angry){
    rig.arms[0].rotation.set(0, 0,  0.55);
    rig.arms[1].rotation.set(0, 0, -0.55);
  } else {
    const sw = cust.walking ? walkA*0.7 : Math.sin(t*2.4+cust.bobPhase)*0.06;
    rig.arms[0].rotation.set(-sw, 0,  0.12);
    rig.arms[1].rotation.set( sw, 0, -0.12);
  }

  // angry head shake / happy tilt
  rig.head.rotation.z = angry ? Math.sin(cust.stompT*Math.PI*2)*0.06 : Math.sin(t*1.2+cust.bobPhase)*0.03;

  // face: redraw only when the expression key changes (mood / blink)
  const blink = ((t + cust.bobPhase) % 3.4) > 3.25;
  const key = cust.mood + (blink?'|b':'') + (cust.glasses?'|g':'');
  if (key !== rig.faceKey){
    rig.faceKey = key;
    drawFace(rig.faceCtx, cust, blink);
    rig.faceTex.needsUpdate = true;
  }
}

/* dispose everything a rig owns (geometry is per-rig, materials cloned) */
export function disposeChibi(rig){
  rig.group.traverse(o=>{ if (o.isMesh) o.geometry.dispose(); });
  for (const m of rig.mats) m.dispose();
  rig.faceTex.dispose();
}

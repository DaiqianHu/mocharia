/* ============================================================
   Order station — take the front customer's order, spawning a
   ticket on the rail. Owns order-taking, the 3D lobby scene, and the
   2D HUD (station label, take button, speech bubble, signs, patience
   meters). The customer figures are procedural SkinnedMesh rigs.
   ============================================================ */
import { rr } from '../core/constants.js';
import { blip } from '../core/audio.js';
import { popText } from '../core/particles.js';
import { Ticket } from '../game/ticket.js';
import { RAIL_H } from '../game/layout.js';
import { G, frontCustomer, layoutTickets, layoutCustomers } from '../game/state.js';
import { BT } from '../game/buttons.js';
import { drawStationLabel } from '../render/scene.js';

export function takeOrder(){
  const c = frontCustomer();
  if (!c || G.tickets.length>=7) return;
  c.state='waiting';
  const t = new Ticket(c);
  G.tickets.push(t);
  layoutTickets(); layoutCustomers();
  G.active = t;
  popText(c.x, c.y-96, 'Order up!', '#ffe9a8', 20);
  blip(520,0.08,'triangle',0.12,240);
  setTimeout(()=>blip(760,0.10,'triangle',0.12),80);
}

export function drawOrderStation(c){
  // HUD only — the lobby, counter and customers are drawn by the 3D layer.
  drawStationLabel(c,'Order Station');
  // pick-up / waiting sign
  c.fillStyle='rgba(42,22,12,0.8)'; rr(c,700,206,190,32,8); c.fill();
  c.fillStyle='#ffe9b8'; c.font='800 14px Verdana, sans-serif';
  c.textAlign='center'; c.textBaseline='middle';
  c.fillText('PICK-UP  AREA', 795, 222);
  // patience meters float above each queued customer
  for (const cust of G.customers){
    if (cust.state==='queue' || cust.state==='waiting'){
      const pw=54, px=cust.x-pw/2, py=cust.y-84;
      c.fillStyle='rgba(30,14,8,0.55)'; rr(c,px-2,py-2,pw+4,12,6); c.fill();
      const col = cust.patience>0.6 ? '#3fd08c' : cust.patience>0.3 ? '#ffb400' : '#ff5a4f';
      c.fillStyle=col; rr(c,px,py,Math.max(3,pw*cust.patience),8,4); c.fill();
    }
  }
  // front-customer speech bubble
  const f=frontCustomer();
  if (f && Math.hypot(f.tx-f.x,f.ty-f.y)<6){
    const bx=f.x, byy=f.y-146;
    c.fillStyle='#fff8e6'; rr(c,bx-92,byy-26,184,56,12); c.fill();
    c.beginPath(); c.moveTo(bx-10,byy+30); c.lineTo(bx+10,byy+30); c.lineTo(bx,byy+46); c.closePath(); c.fill();
    c.fillStyle='#3a2216'; c.font='800 13px Verdana, sans-serif';
    c.textAlign='center'; c.textBaseline='alphabetic';
    c.fillText('One '+f.order.name+',', bx, byy-8);
    c.font='700 11px Verdana, sans-serif';
    c.fillText(f.order.cannoli ? 'and a cannoli please!' : 'please!', bx, byy+10);
  }
  BT.take.draw(c);
}

/* ============================================================
   3D lobby + customers. The lobby is a back wall (window + door), a
   receding floor and a solid front counter with a register; customers
   are cloned SkinnedMesh rigs reconciled against G.customers each frame
   and posed by poseCharacter(). Capsule colliders let the raycaster
   hit the front customer (though the 2D circle test is still primary).
   ============================================================ */
import { THREE, place, mat, shadowDecal, colliders, colliderMaterial } from '../render/three.js';
import { cloneCharacter, poseCharacter } from '../render/character.js';

const FOOT = 66;          // virtual px from customer (x,y) origin down to feet
let order3d = null;

export function buildOrder3D(group){
  // ---- lobby room ----
  const room = new THREE.Group();
  // back wall
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(2400,1200), mat('#e7d3b0',{rough:0.98, noCache:true}));
  wall.position.set(0,120,-360); room.add(wall);
  // wainscot
  const wains = new THREE.Mesh(new THREE.PlaneGeometry(2400,150), mat('#b07a44',{rough:0.9}));
  wains.position.set(0,-140,-358); room.add(wains);
  // window (bright sky panel) on the wall, over the pick-up side
  const win = new THREE.Mesh(new THREE.PlaneGeometry(210,150), mat('#bfe3f0',{rough:0.4, emissive:'#7fb8cc', emissiveIntensity:0.4, noCache:true}));
  place(win, 750, 215, -356); room.add(win);
  const winFrame = new THREE.Mesh(new THREE.PlaneGeometry(226,166), mat('#6a4020',{rough:0.7}));
  place(winFrame, 750, 215, -357); room.add(winFrame);
  // door on the far right
  const door = new THREE.Mesh(new THREE.PlaneGeometry(120,230), mat('#8a5a30',{rough:0.8}));
  place(door, 910, 240, -356); room.add(door);
  // floor, receding
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2400,1000), mat('#7a4c28',{rough:0.85, noCache:true}));
  floor.rotation.x = -Math.PI/2; floor.position.set(0,-232,-40); room.add(floor);
  group.add(room);

  // ---- front counter (occludes customer lower bodies) ----
  const counter = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(360,104,70), mat('#8a5a2e',{rough:0.6, noCache:true}));
  place(body, 220, 488, 45); counter.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(376,16,80), mat('#c8a068',{rough:0.5}));
  place(top, 220, 432, 48); counter.add(top);
  // register
  const reg = new THREE.Mesh(new THREE.BoxGeometry(74,52,44), mat('#4a5a6a',{rough:0.4, metal:0.3}));
  place(reg, 343, 408, 50); counter.add(reg);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(58,20,4), mat('#bfe8d8',{rough:0.2, emissive:'#3a8f7a', emissiveIntensity:0.3}));
  place(screen, 343, 400, 73); counter.add(screen);
  group.add(counter);

  order3d = { group, rigs: new Map() };
}

export function updateOrder3D(){
  if (!order3d) return;
  const t = G.time;
  const live = new Set();
  for (const cust of G.customers){
    live.add(cust.id);
    let rig = order3d.rigs.get(cust.id);
    if (!rig){
      rig = cloneCharacter(cust);
      const sh = shadowDecal(28, 10); sh.position.y = 0.5; rig.group.add(sh);
      // capsule collider for the raycaster (mirrors the 2D tap circle)
      const col = new THREE.Mesh(new THREE.CapsuleGeometry(30, 70, 4, 8), colliderMaterial());
      col.position.y = 70; col.userData.custId = cust.id; rig.group.add(col);
      colliders.customers.push({ mesh:col, id:cust.id });
      order3d.group.add(rig.group);
      order3d.rigs.set(cust.id, rig);
    }
    // place at the customer's virtual position (feet at cust.y+FOOT)
    place(rig.group, cust.x, cust.y+FOOT, 5);
    rig.baseY = rig.group.position.y;
    poseCharacter(rig, cust, t);
  }
  // remove rigs whose customers have left
  for (const [id, rig] of order3d.rigs){
    if (!live.has(id)){
      order3d.group.remove(rig.group);
      order3d.rigs.delete(id);
      const ci = colliders.customers.findIndex(c=>c.id===id);
      if (ci>=0) colliders.customers.splice(ci,1);
    }
  }
}

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
  // patience meters float above each queued customer (projected from
  // their 3D lobby position through the live camera)
  for (const cust of G.customers){
    if (cust.state==='queue' || cust.state==='waiting'){
      const wp = lobbyPos(cust.x, cust.y);
      const s = projectVirtual(wp.x, 200, wp.z);
      const pw=54, px=s.x-pw/2, py=s.y;
      c.fillStyle='rgba(30,14,8,0.55)'; rr(c,px-2,py-2,pw+4,12,6); c.fill();
      const col = cust.patience>0.6 ? '#3fd08c' : cust.patience>0.3 ? '#ffb400' : '#ff5a4f';
      c.fillStyle=col; rr(c,px,py,Math.max(3,pw*cust.patience),8,4); c.fill();
    }
  }
  // front-customer speech bubble
  const f=frontCustomer();
  if (f && Math.hypot(f.tx-f.x,f.ty-f.y)<6){
    const fwp = lobbyPos(f.x, f.y);
    const fs = projectVirtual(fwp.x, 215, fwp.z);
    const bx=fs.x, byy=fs.y-40;
    c.fillStyle='#fff8e6'; rr(c,bx-92,byy-26,184,56,12); c.fill();
    c.beginPath(); c.moveTo(bx-10,byy+30); c.lineTo(bx+10,byy+30); c.lineTo(bx,byy+46); c.closePath(); c.fill();
    c.fillStyle='#3a2216'; c.font='800 13px Verdana, sans-serif';
    c.textAlign='center'; c.textBaseline='alphabetic';
    c.fillText('One '+f.order.name+',', bx, byy-8);
    c.font='700 11px Verdana, sans-serif';
    c.fillText(f.order.cannoli
      ? 'and a '+f.order.cannoli.shell.name.replace(' Shell','')+' cannoli!'
      : 'please!', bx, byy+10, 176);
  }
  BT.take.draw(c);
}

/* ============================================================
   3D lobby + customers. The lobby is a back wall (window + door), a
   receding floor and a solid front counter with a register; customers
   are 2D hand-drawn sprite billboards (see render/character.js)
   reconciled against G.customers each frame — they sit at the same z
   as the old rigs so the counter still occludes their lower bodies.
   ============================================================ */
import { THREE, place, mat, woodTexture, camera, stationRig, projectVirtual, colliders } from '../render/three.js';
import { RIGS, lobbyPos, SPRITE_SCALE } from '../render/layout3d.js';
import { makeCustomerRig, updateCustomerRig } from '../render/character.js';
import { owns } from '../game/progress.js';

let order3d = null;

/* ---- lobby decor props for owned shop items ------------------------
   Every decor (and the doorbell) gets a hand-placed primitive prop so
   purchases visibly change the lobby. Wall props hang at z≈-354, hanging
   props at z≈-330, floor props stand on the lobby floor (virtual y≈532,
   z≈-300, behind the customers). Rebuilt only when the owned set changes. */

function boxAt(g,w,h,d,color,x,y,z,opts){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(color,opts));
  m.position.set(x,y,z); g.add(m); return m;
}
function cylAt(g,rT,rB,h,color,x,y,z,opts,seg=16){
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rT,rB,h,seg), mat(color,opts));
  m.position.set(x,y,z); g.add(m); return m;
}
function sphAt(g,r,color,x,y,z,opts){
  const m = new THREE.Mesh(new THREE.SphereGeometry(r,14,10), mat(color,opts));
  m.position.set(x,y,z); g.add(m); return m;
}

/* each builder fills a group whose origin is (0,0,0) at its anchor:
   wall/hanging props anchor at their centre, floor props at their base */
const DECOR_PROPS = {
  // base decors
  poster:   { x:470, y:200, z:-354, build(g){
    boxAt(g,74,94,3,'#6a4020',0,0,0,{rough:0.7});
    boxAt(g,62,82,2,'#e8875a',0,0,2);
    cylAt(g,18,18,2,'#ffd98a',0,6,3.2,{rough:0.5},20).rotation.x=Math.PI/2;
  }},
  table:    { x:440, y:532, z:-300, floor:true, build(g){
    cylAt(g,4.5,5.5,46,'#5a3a1c',0,23,0,{rough:0.7});
    cylAt(g,17,20,8,'#5a3a1c',0,3,0,{rough:0.7});
    cylAt(g,34,34,6,'#8a5a2e',0,49,0,{rough:0.55},22);
    cylAt(g,6,4.5,10,'#f4f4ee',10,57,4,{rough:0.5});   // little cup
  }},
  arcade:   { x:522, y:532, z:-300, floor:true, build(g){
    boxAt(g,64,112,40,'#4a3a8a',0,56,0,{rough:0.5});
    boxAt(g,66,16,42,'#3a2a6a',0,116,0,{rough:0.5});
    boxAt(g,46,34,3,'#7fe8c8',0,78,21,{rough:0.25, emissive:'#3fae8c', emissiveIntensity:0.6});
    boxAt(g,50,12,10,'#c8324a',0,52,22,{rough:0.5});
    sphAt(g,3.4,'#ffd94a',-10,56,26,{rough:0.3});
    sphAt(g,3.4,'#ff5a6a',2,56,26,{rough:0.3});
  }},
  // holiday decors
  'hw-poster': { x:560, y:205, z:-354, build(g){
    boxAt(g,70,90,3,'#3a2a4a',0,0,0,{rough:0.7});
    boxAt(g,58,78,2,'#241a34',0,0,2);
    sphAt(g,14,'#f0f0f8',0,4,3,{rough:0.4});           // ghost blob
    sphAt(g,5,'#f0f0f8',-9,-10,3,{rough:0.4});
    sphAt(g,5,'#f0f0f8',9,-10,3,{rough:0.4});
  }},
  'xm-tree': { x:600, y:532, z:-300, floor:true, build(g){
    cylAt(g,6,7,18,'#6a4020',0,9,0,{rough:0.8});
    cylAt(g,0.5,34,38,'#2f7a3f',0,34,0,{rough:0.7});
    cylAt(g,0.5,26,34,'#37884a',0,62,0,{rough:0.7});
    cylAt(g,0.5,18,30,'#3f965a',0,86,0,{rough:0.7});
    sphAt(g,6,'#ffd94a',0,104,0,{rough:0.3, emissive:'#c89a20', emissiveIntensity:0.5});
    sphAt(g,4,'#ff5a6a',-14,52,20,{rough:0.4});
    sphAt(g,4,'#5ab0ff',12,72,14,{rough:0.4});
  }},
  'bd-balloons': { x:668, y:532, z:-300, floor:true, build(g){
    for (const [dx,dy,col] of [[-14,86,'#ff5a6a'],[2,98,'#ffd94a'],[15,84,'#5ab0ff']]){
      cylAt(g,0.7,0.7,dy-8,'#d8d8d8',dx*0.4,(dy-8)/2,0);
      sphAt(g,13,col,dx,dy,0,{rough:0.35}).scale.y=1.18;
    }
  }},
  'tg-wreath': { x:636, y:180, z:-354, build(g){
    const w = new THREE.Mesh(new THREE.TorusGeometry(26,8,10,24), mat('#3f6f2f',{rough:0.75}));
    g.add(w);
    for (let i=0;i<5;i++){
      const a=i/5*Math.PI*2;
      sphAt(g,4,i%2?'#ff5a4f':'#e88a2a',Math.cos(a)*26,Math.sin(a)*26,6,{rough:0.4});
    }
    boxAt(g,12,10,3,'#c8324a',0,-26,8,{rough:0.5});    // bow
  }},
  'ny-disco': { x:700, y:130, z:-330, build(g){
    cylAt(g,0.8,0.8,34,'#b8b8b8',0,26,0);
    sphAt(g,20,'#dfe8f4',0,0,0,{rough:0.15, metal:0.85});
  }},
  'vd-balloon': { x:772, y:150, z:-330, build(g){
    sphAt(g,13,'#ff5a8a',-9,4,0,{rough:0.35}).scale.y=1.15;
    sphAt(g,13,'#ff8ab0',10,-2,2,{rough:0.35}).scale.y=1.15;
    cylAt(g,0.7,0.7,60,'#d8d8d8',-6,-40,0);
    cylAt(g,0.7,0.7,54,'#d8d8d8',9,-38,2);
  }},
  'sp-gold': { x:735, y:532, z:-300, floor:true, build(g){
    cylAt(g,24,17,28,'#26302e',0,14,0,{rough:0.55},20);
    cylAt(g,26,26,5,'#26302e',0,28,0,{rough:0.55},20);
    for (const [dx,dz] of [[-10,2],[0,-4],[10,3],[-3,7],[5,8]])
      sphAt(g,6.5,'#ffd94a',dx,32,dz,{rough:0.25, metal:0.6});
  }},
  'cb-lantern': { x:480, y:128, z:-330, build(g){
    for (const dx of [-56, 56]){
      cylAt(g,0.8,0.8,26,'#b8b8b8',dx,20,0);
      cylAt(g,12,12,26,'#ffc8d4',dx,0,0,{rough:0.5, emissive:'#e88aa0', emissiveIntensity:0.5},14);
      cylAt(g,13,13,4,'#8a3040',dx,15,0,{rough:0.6},14);
      cylAt(g,13,13,4,'#8a3040',dx,-15,0,{rough:0.6},14);
    }
  }},
  'cm-pinata': { x:870, y:150, z:-330, build(g){
    cylAt(g,0.8,0.8,30,'#d8d8d8',0,26,0);
    boxAt(g,30,12,22,'#ff5a6a',0,8,0,{rough:0.6});
    boxAt(g,32,12,24,'#ffd94a',0,-3,0,{rough:0.6});
    boxAt(g,30,12,22,'#5ab0ff',0,-14,0,{rough:0.6});
    boxAt(g,10,10,10,'#ff8a2a',18,8,0,{rough:0.6});    // head
  }},
  'lu-tiki': { x:800, y:532, z:-300, floor:true, build(g){
    cylAt(g,7,8,84,'#8a5a30',0,42,0,{rough:0.85},10);
    boxAt(g,20,26,16,'#a86e38',0,72,4,{rough:0.8});
    cylAt(g,10,4,20,'#ff8a20',0,98,0,{rough:0.4, emissive:'#ff6a10', emissiveIntensity:0.9},10);
  }},
  'sj-bunting': { x:530, y:116, z:-352, build(g){
    boxAt(g,240,1.6,1.6,'#d8d8d8',0,8,0);
    const cols=['#ff5a5a','#f4f4f4','#5a78ff'];
    for (let i=0;i<7;i++){
      const f = new THREE.Mesh(new THREE.CircleGeometry(11,3), mat(cols[i%3],{rough:0.7}));
      f.position.set(-102+i*34,0,0.5); f.rotation.z=Math.PI/2+Math.PI/6; g.add(f);
    }
  }},
  'gv-lavalamp': { x:868, y:532, z:-300, floor:true, build(g){
    boxAt(g,40,36,30,'#6a4a7a',0,18,0,{rough:0.7});    // little stand
    cylAt(g,9,13,12,'#c8a068',0,42,0,{rough:0.35, metal:0.4},12);
    cylAt(g,6,10,30,'#c85ae8',0,62,0,{rough:0.2, emissive:'#a03ac8', emissiveIntensity:0.7, transparent:true, opacity:0.85},12);
    cylAt(g,4,6,8,'#c8a068',0,80,0,{rough:0.35, metal:0.4},12);
  }},
  'sf-popcorn': { x:928, y:532, z:-300, floor:true, build(g){
    cylAt(g,9,9,6,'#3a2a1a',-22,9,18,{rough:0.6},12).rotation.x=Math.PI/2;
    cylAt(g,9,9,6,'#3a2a1a',22,9,18,{rough:0.6},12).rotation.x=Math.PI/2;
    boxAt(g,68,46,38,'#d84848',0,36,0,{rough:0.55});
    boxAt(g,60,26,32,'#fff4dc',0,72,0,{rough:0.3, transparent:true, opacity:0.55});
    for (const [dx,dz] of [[-16,4],[-4,-6],[8,5],[18,-2]])
      sphAt(g,6,'#ffe9b8',dx,70,dz,{rough:0.8});
    for (let i=0;i<5;i++)
      boxAt(g,13.6,6,40,i%2?'#f4f4f4':'#d84848',-27+i*13.6,88,0,{rough:0.6});
  }},
};

const DECOR_IDS = Object.keys(DECOR_PROPS);

function rebuildDecor(){
  const dg = order3d.decorGroup;
  // drop old props (geometries are per-mesh; materials come from the
  // shared mat() cache, so leave them alone)
  for (let i=dg.children.length-1;i>=0;i--){
    dg.children[i].traverse(o=>{ if (o.isMesh) o.geometry.dispose(); });
    dg.remove(dg.children[i]);
  }
  for (const id of DECOR_IDS){
    if (!owns(id)) continue;
    const d = DECOR_PROPS[id];
    const g = new THREE.Group();
    // wall/hanging props keep their back-wall anchors; floor props move
    // forward into the customer lobby (in front of the counter) so they
    // don't stand inside the café's back work-counter.
    place(g, d.x, d.y, d.z + (d.floor ? 518 : 0));
    d.build(g);
    dg.add(g);
  }
  if (owns('doorbell')){
    const g = new THREE.Group();
    place(g, 910, 122, -352);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(11,14,10,0,Math.PI*2,0,Math.PI/2),
      mat('#e8b040',{rough:0.3, metal:0.5}));
    g.add(bell);
    sphAt(g,3.4,'#8a5a20',0,-4,0,{rough:0.5});
    boxAt(g,26,4,4,'#6a4020',0,8,0,{rough:0.7});
    dg.add(g);
  }
}

export function buildOrder3D(group){
  // The café room itself (walls/floor/window/door) is built once by
  // render/cafe.js — this builder only adds the lobby furniture. The
  // lobby rig keeps the old virtual-pixel local space so the counter
  // and every hand-placed decor prop anchor ports verbatim.
  const rig = stationRig(RIGS.lobby.anchor, RIGS.lobby.at, RIGS.lobby.s);
  group.add(rig);

  // ---- front counter (occludes customer lower bodies) ----
  const counter = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(360,104,70), mat('#8a5a2e',{rough:0.6, noCache:true}));
  body.material.map = woodTexture(2, 0.6);
  place(body, 220, 488, 45); counter.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(376,16,80), mat('#c8a068',{rough:0.5, noCache:true}));
  top.material.map = woodTexture(2, 0.15);
  place(top, 220, 432, 48); counter.add(top);
  // register
  const reg = new THREE.Mesh(new THREE.BoxGeometry(74,52,44), mat('#4a5a6a',{rough:0.4, metal:0.3}));
  place(reg, 343, 408, 50); counter.add(reg);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(58,20,4), mat('#bfe8d8',{rough:0.2, emissive:'#3a8f7a', emissiveIntensity:0.3}));
  place(screen, 343, 400, 73); counter.add(screen);
  rig.add(counter);

  // decor props for owned shop items (rebuilt when purchases change)
  const decorGroup = new THREE.Group();
  rig.add(decorGroup);

  order3d = { group, rig, decorGroup, decorKey: null, rigs: new Map() };
}

export function updateOrder3D(){
  if (!order3d) return;
  const key = DECOR_IDS.concat('doorbell').filter(owns).join(',');
  if (key !== order3d.decorKey){ order3d.decorKey = key; rebuildDecor(); }
  const t = G.time;
  const live = new Set();
  for (const cust of G.customers){
    live.add(cust.id);
    let rig = order3d.rigs.get(cust.id);
    if (!rig){
      rig = makeCustomerRig(cust);
      order3d.group.add(rig.group);
      order3d.rigs.set(cust.id, rig);
      // the sprite plane doubles as the tap collider (group carries custId)
      colliders.customers.push({ mesh: rig.mesh, id: cust.id });
    }
    // map the customer's virtual walk coords onto the lobby floor and
    // billboard the sprite toward the camera. Feet sit ~70 below the
    // figure origin (scaled), so lifting the group grounds them; the
    // front counter (z≈-53) still occludes lower bodies (customers z≤-95).
    const wp = lobbyPos(cust.x, cust.y);
    rig.group.scale.setScalar(SPRITE_SCALE);
    rig.group.position.set(wp.x, 70*SPRITE_SCALE, wp.z);
    rig.group.rotation.y = Math.atan2(camera.position.x - wp.x, camera.position.z - wp.z);
    updateCustomerRig(rig, cust, t);
  }
  // remove sprites whose customers have left
  for (const [id, rig] of order3d.rigs){
    if (!live.has(id)){
      order3d.group.remove(rig.group);
      rig.texture.dispose();
      rig.mesh.geometry.dispose();
      rig.mesh.material.dispose();
      order3d.rigs.delete(id);
      const ci = colliders.customers.findIndex(c=>c.id===id);
      if (ci>=0) colliders.customers.splice(ci,1);
    }
  }
}

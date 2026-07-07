/* ============================================================
   The café interior — one continuous room hosting all four stations
   (built once at init, always visible; the camera flies between
   workspaces). Floor, walls, window, door and menu board, plus the
   three work counters the station rigs sit on:
     back counter (right)  -> brew machine line
     island (mid-left)     -> topping bar
     side bench (far left) -> cannoli board
   The customer-facing front counter still comes from the order
   station's lobby rig (stations/order.js), so it keeps occluding
   customer lower bodies exactly as before.
   ============================================================ */
import { THREE, scene, mat, woodTexture, plasterTexture } from './three.js';
import { ROOM } from './layout3d.js';

/* a chunky wooden counter: body + slightly-overhanging top slab */
function counter(w, d, cx, cz, bodyCol='#8a5a2e', topCol='#c8a068'){
  const g = new THREE.Group();
  const bodyH = ROOM.counterTop - 14;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, bodyH, d), mat(bodyCol, {noCache:true}));
  body.material.map = woodTexture(Math.max(1, Math.round(w/180)), 0.6);
  body.position.set(cx, bodyH/2, cz);
  g.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(w+16, 14, d+16), mat(topCol, {noCache:true}));
  top.material.map = woodTexture(Math.max(1, Math.round(w/180)), 0.15);
  top.position.set(cx, ROOM.counterTop - 7, cz);
  g.add(top);
  return g;
}

export function buildCafe(){
  const g = new THREE.Group();
  const W = ROOM.x1 - ROOM.x0, D = ROOM.zFront - ROOM.zBack;
  const cx = (ROOM.x0 + ROOM.x1)/2, cz = (ROOM.zBack + ROOM.zFront)/2;

  // floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat('#7a4c28', {noCache:true}));
  floor.material.map = woodTexture(10, 6);
  floor.rotation.x = -Math.PI/2;
  floor.position.set(cx, 0, cz);
  g.add(floor);

  // back wall + wainscot
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, ROOM.wallH), mat('#e7d3b0', {noCache:true}));
  back.material.map = plasterTexture(7, 2);
  back.position.set(cx, ROOM.wallH/2, ROOM.zBack);
  g.add(back);
  const wains = new THREE.Mesh(new THREE.PlaneGeometry(W, 120), mat('#b07a44', {noCache:true}));
  wains.material.map = woodTexture(9, 0.5);
  wains.position.set(cx, 60, ROOM.zBack + 1.5);
  g.add(wains);

  // side walls
  for (const [x, rot] of [[ROOM.x0, Math.PI/2], [ROOM.x1, -Math.PI/2]]){
    const side = new THREE.Mesh(new THREE.PlaneGeometry(D, ROOM.wallH), mat('#e0c9a4', {noCache:true}));
    side.material.map = plasterTexture(6, 2);
    side.rotation.y = rot;
    side.position.set(x, ROOM.wallH/2, cz);
    g.add(side);
    const swains = new THREE.Mesh(new THREE.PlaneGeometry(D, 120), mat('#aa7440', {noCache:true}));
    swains.material.map = woodTexture(8, 0.5);
    swains.rotation.y = rot;
    swains.position.set(x + (rot>0 ? 1.5 : -1.5), 60, cz);
    g.add(swains);
  }

  // window with bright sky (back wall, over the lobby/topping side)
  const winFrame = new THREE.Mesh(new THREE.PlaneGeometry(250, 180), mat('#6a4020'));
  winFrame.position.set(-140, 250, ROOM.zBack + 2);
  g.add(winFrame);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(230, 160),
    mat('#bfe3f0', {emissive:'#7fb8cc', emissiveIntensity:0.45, noCache:true}));
  win.position.set(-140, 250, ROOM.zBack + 3);
  g.add(win);
  for (const dx of [-39, 38]){   // mullions
    const bar = new THREE.Mesh(new THREE.BoxGeometry(6, 160, 3), mat('#6a4020'));
    bar.position.set(-140 + dx, 250, ROOM.zBack + 4);
    g.add(bar);
  }

  // entrance door on the RIGHT side wall, at the depth of the customer
  // walk-in row (z≈-100) — customers entering from +x now read as
  // walking in through the door.
  const door = new THREE.Mesh(new THREE.BoxGeometry(8, 260, 150), mat('#8a5a30', {noCache:true}));
  door.material.map = woodTexture(1, 1);
  door.position.set(ROOM.x1 - 4, 130, -100);
  g.add(door);
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(6, 276, 170), mat('#5f3d1e'));
  doorFrame.position.set(ROOM.x1 - 2, 138, -100);
  g.add(doorFrame);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(7, 10, 8), mat('#e8b040'));
  knob.position.set(ROOM.x1 - 12, 125, -150);
  g.add(knob);

  // menu board above the brew counter
  const menu = new THREE.Mesh(new THREE.BoxGeometry(300, 110, 6), mat('#2e1c10'));
  menu.position.set(330, 272, ROOM.zBack + 4);
  g.add(menu);
  for (let i=0;i<3;i++){   // scribble lines
    const line = new THREE.Mesh(new THREE.BoxGeometry(240 - i*30, 7, 2), mat('#ffe9b8', {noCache:true}));
    line.position.set(330 - i*12, 298 - i*26, ROOM.zBack + 8);
    g.add(line);
  }

  // work counters under the station rigs
  g.add(counter(480, 120, 330, -400));    // brew line (back wall, right)
  g.add(counter(300, 150, -300, -195));   // topping island (mid-left)
  g.add(counter(280, 140, -590, -270));   // cannoli bench (far left)

  // pendant lamps over the work counters (simple warm cones)
  for (const [lx, lz] of [[330,-400], [-300,-195], [-590,-270]]){
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 90, 6), mat('#3a2a1a'));
    cord.position.set(lx, ROOM.wallH - 45, lz);
    g.add(cord);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(10, 30, 26, 14, 1, true),
      mat('#c8503a', {emissive:'#732a1a', emissiveIntensity:0.25, noCache:true}));
    shade.material.side = THREE.DoubleSide;
    shade.position.set(lx, ROOM.wallH - 90, lz);
    g.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(7, 10, 8),
      mat('#ffe9b8', {emissive:'#ffcf7a', emissiveIntensity:0.9, noCache:true}));
    bulb.position.set(lx, ROOM.wallH - 98, lz);
    g.add(bulb);
  }

  scene.add(g);
  return g;
}

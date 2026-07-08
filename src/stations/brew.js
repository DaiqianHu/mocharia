/* ============================================================
   Brew station — a line of machines (coffee brewers + milk
   steamers). Pick a machine, choose the type, hot/cold, and how
   many shots/portions (1-3 -> guide lines on its measuring cup),
   then start it and wait out the brew timer. Pour the finished
   cup into the active ticket's drink.
   ============================================================ */
import { TAU, rr, shade, clamp, mixHex, rand } from '../core/constants.js';
import { RAIL_H, MACHINES } from '../game/layout.js';
import { G, machineMarker, MARKER_GOLD } from '../game/state.js';
import { BT } from '../game/buttons.js';
import { owns } from '../game/progress.js';
import { drawStationLabel } from '../render/scene.js';

/* per-machine geometry, in virtual pixels (shared by 3D build + HUD text) */
const BODY_H = 74, CUP_TOP = 108, CUP_BOT = 206, CW = 74;

export function drawBrewStation(c){
  drawStationLabel(c,'Brew Station');
  // per-machine 2D captions over the 3D machines (crisp text the 3D can't do)
  for (let i=0;i<G.machines.length;i++) drawMachineHUD(c, G.machines[i], i===G.selMachine);
  // config strip for the selected machine
  const m = G.machines[G.selMachine];
  c.fillStyle='rgba(42,22,12,0.82)'; rr(c,40,392,640,116,14); c.fill();
  c.fillStyle='#ffe9b8'; c.font='800 13px Verdana, sans-serif';
  c.textAlign='left'; c.textBaseline='middle';
  c.fillText((m.kind==='coffee'?'COFFEE MACHINE ':'MILK STEAMER ')+(G.selMachine+1)
    + (owns(m.kind==='coffee'?'brewfast':'steamfast') ? '  ⚡TURBO' : ''), 58, 404);
  c.font='700 10px Verdana, sans-serif'; c.fillStyle='rgba(255,233,184,0.7)';
  c.fillText(m.kind==='coffee' ? 'shots' : 'portions', 624, 429);
  BT.machType.draw(c); BT.machTemp.draw(c); BT.machAddin.draw(c);
  for (const b of BT.machAmt) b.draw(c);
  BT.machStart.draw(c); BT.machPour.draw(c); BT.machDump.draw(c);
  // hint
  c.fillStyle='rgba(42,22,12,0.75)'; rr(c,268,RAIL_H+14,414,28,8); c.fill();
  c.fillStyle='#ffe9b8'; c.font='700 11px Verdana, sans-serif'; c.textAlign='center';
  c.fillText('Tap a machine · set type, temp & amount · Start, wait, then Pour', 475, RAIL_H+28);
}

/* Crisp 2D captions layered over each 3D machine: name plate, type/temp
   readout and the brew timer / READY / idle status. Anchored by
   projecting the machine's world position through the live camera. */
function drawMachineHUD(c, m, selected){
  const idx = G.machines.indexOf(m);
  const r3 = brew3d && brew3d.machines[idx];
  if (!r3) return;
  const { wp } = r3;
  // caption anchors in world space: name plate over the machine body,
  // status under the measuring cup (cup base is wp.y, body top +206 local)
  const name = projectVirtual(wp.x, wp.y + wp.s*230, wp.z);
  const stat = projectVirtual(wp.x, wp.y - wp.s*26, wp.z);
  const running = m.state==='run', done = m.state==='done';
  c.textAlign='center'; c.textBaseline='middle';
  c.fillStyle = selected ? '#ffe9b8' : 'rgba(255,255,255,0.92)';
  c.font='800 12px Verdana, sans-serif';
  c.fillText((m.kind==='coffee'?'☕ COFFEE ':'🥛 MILK ')+(idx+1), name.x, name.y);
  // type + temp (+ add-in) readout
  c.fillStyle = selected ? '#fff4d6' : 'rgba(255,244,222,0.82)';
  c.font='700 10px Verdana, sans-serif';
  c.fillText(m.type.name+'  ·  '+tempLabel(m), name.x, name.y+15);
  if (m.addin){
    c.fillStyle = shade(m.addin.color, 70);
    c.font='700 9px Verdana, sans-serif';
    c.fillText('+ '+m.addin.name, name.x, name.y+29);
  }
  // status under the measuring cup
  if (running){
    c.fillStyle='#ffd24a'; c.font='800 15px Verdana, sans-serif';
    c.fillText((m.total-m.t).toFixed(1)+'s', stat.x, stat.y);
  } else if (done){
    const b=1+Math.sin(G.time*7)*0.08;
    c.save(); c.translate(stat.x,stat.y); c.scale(b,b);
    c.fillStyle='#3fd08c'; c.font='800 14px Verdana, sans-serif';
    c.fillText('READY!', 0, 0); c.restore();
    // pour-timing bar: pour while the marker crosses the gold center
    // for a bonus (missing is still a normal pour — bonus-only).
    // Sits above the READY text so the config strip can't cover it.
    const bw=90, bh=10, bx=stat.x-bw/2, by=stat.y-30;
    const mk = machineMarker(m), gold = Math.abs(mk)<MARKER_GOLD;
    c.fillStyle='rgba(20,10,4,0.72)'; rr(c,bx-2,by-2,bw+4,bh+4,6); c.fill();
    c.fillStyle = gold ? '#ffd24a' : 'rgba(255,210,74,0.45)';
    const gw = bw*MARKER_GOLD;
    rr(c,stat.x-gw/2,by,gw,bh,4); c.fill();
    c.fillStyle='#fff';
    rr(c,stat.x + mk*(bw/2-3) - 2, by-3, 4, bh+6, 2); c.fill();
  } else {
    c.fillStyle='rgba(255,233,184,0.6)'; c.font='700 11px Verdana, sans-serif';
    c.fillText('idle', stat.x, stat.y);
  }
}

export function tempLabel(m){
  if (m.kind==='coffee') return m.temp==='hot' ? 'Hot' : 'Iced';
  return m.temp==='hot' ? 'Hot' : 'Cold';
}
export function isCold(m){ return m.temp!=='hot'; }

/* ============================================================
   3D brew line. Each machine is a boxy brewer body with a status
   lamp and spout above a translucent measuring cup; the cup fluid is
   a scale-from-anchor cone driven by brew progress. A gold ring marks
   the selected machine; a pour stream and ice appear as needed. Machine
   selection raycasts the invisible collider boxes (hitTestScene 'brew').
   ============================================================ */
import { THREE, place, mat, fillMesh, fluidGeometry, shadowDecal,
         colliders, colliderMaterial, TOON_RAMP, stationRig, projectVirtual } from '../render/three.js';
import { RIGS } from '../render/layout3d.js';
import { steam3d } from '../render/fx3d.js';

/* Project a point `dy` virtual-units above machine i's cup base to
   virtual px — the anchor game/state.js uses for machine popTexts
   ("Coffee ready!", "Poured!"). Null until the 3D scene is built. */
export function machineHudAnchor(i, dy=0){
  const r = brew3d && brew3d.machines[i];
  if (!r) return null;
  return projectVirtual(r.wp.x, r.wp.y + r.wp.s*dy, r.wp.z);
}

const CUP_H = CUP_BOT - CUP_TOP;              // measuring-cup height (98)
const CUP_BOTR = CW*0.4, CUP_TOPR = CW/2;     // cup radii
const MZ = 14;                                // machines sit slightly forward
let brew3d = null;

export function buildBrew3D(group){
  // all machine geometry stays in old virtual-pixel local space; the rig
  // scales it down and stands it on the café's back counter (layout3d.js)
  const rig = stationRig(RIGS.brew.anchor, RIGS.brew.at, RIGS.brew.s);
  group.add(rig);
  // build from the static MACHINES layout, not G.machines — the scene may
  // init during dayIntro, before startDay/resetMachines populates the
  // runtime machine list (geometry is identical either way)
  const machines = [];
  for (let i=0;i<MACHINES.length;i++){
    const src = MACHINES[i];
    const cx = src.x+src.w/2, cupBotV = src.y+CUP_BOT;
    const g = new THREE.Group();
    place(g, cx, cupBotV, MZ);          // local y=0 sits at the cup base
    rig.add(g);

    // contact shadow
    const sh = shadowDecal(src.w*0.5, 26); sh.position.set(0,1,0); g.add(sh);

    // body: virtual y src.y..src.y+BODY_H -> local (cupBot-...) 
    const bodyBot = cupBotV - (src.y+BODY_H);   // = CUP_BOT-BODY_H = 132
    const bodyTop = cupBotV - src.y;            // = CUP_BOT = 206
    const bodyH = bodyTop - bodyBot;            // 74
    const bodyCol = src.kind==='coffee' ? '#38424e' : '#4e5a66';
    const body = new THREE.Mesh(new THREE.BoxGeometry(src.w-10, bodyH, 60),
      mat(bodyCol, {rough:0.4, metal:0.35, noCache:true}));
    body.position.set(0, (bodyBot+bodyTop)/2, 0);
    g.add(body);
    // dark screen panel on the face
    const panel = new THREE.Mesh(new THREE.BoxGeometry(src.w-40, 26, 4),
      mat('#12181e',{rough:0.3, metal:0.2}));
    panel.position.set(0, bodyTop-16, 31); g.add(panel);
    // status lamp
    const lampMat = mat('#7a848e',{rough:0.4, emissive:'#000000', noCache:true});
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(6,12,10), lampMat);
    lamp.position.set(src.w/2-22, bodyBot+18, 31); g.add(lamp);
    // spout
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(6,7,18,10),
      mat('#222a32',{rough:0.4, metal:0.4}));
    spout.position.set(0, CUP_H+22, 8); g.add(spout);

    // measuring cup (translucent glass) + fluid
    const glassGeo = new THREE.CylinderGeometry(CUP_TOPR, CUP_BOTR, CUP_H, 26, 1, true);
    glassGeo.translate(0, CUP_H/2, 0);
    const glass = new THREE.Mesh(glassGeo, new THREE.MeshToonMaterial({
      color:0xd6e6f0, gradientMap:TOON_RAMP, transparent:true, opacity:0.24,
      depthWrite:false, side:THREE.DoubleSide }));
    glass.renderOrder = 5; glass.position.set(0,0,8); g.add(glass);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(CUP_TOPR,2.4,8,26),
      mat('#eaf4fa',{rough:0.2,metal:0.1}));
    rim.rotation.x=Math.PI/2; rim.position.set(0,CUP_H,8); rim.renderOrder=6; g.add(rim);

    // colour is retinted every frame from the live machine's type/add-in
    const fluidMat = mat(src.kind==='coffee' ? '#5a3220' : '#f4ecdb', {rough:0.5, noCache:true});
    const fluid = fillMesh(fluidGeometry(CUP_BOTR-3, CUP_TOPR-3, CUP_H), fluidMat);
    fluid.position.set(0,0,8); g.add(fluid);

    // guide rings 1..3
    const rings = [];
    for (let k=1;k<=3;k++){
      const ry = CUP_H*(k/3);
      const rad = CUP_BOTR + (CUP_TOPR-CUP_BOTR)*(k/3);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rad+1,1,6,24),
        mat('#fff4d6',{rough:0.5, emissive:'#000000', noCache:true}));
      ring.rotation.x=Math.PI/2; ring.position.set(0,ry,8); ring.renderOrder=7;
      g.add(ring); rings.push(ring);
    }

    // pour stream (scaled each frame)
    const pour = new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.5,1,8),
      mat(src.kind==='coffee' ? '#5a3220' : '#f4ecdb',{rough:0.4, noCache:true}));
    pour.position.set(0,0,8); pour.visible=false; g.add(pour);

    // ice cubes
    const ice = new THREE.Group();
    for (let j=0;j<2;j++){
      const cube = new THREE.Mesh(new THREE.BoxGeometry(13,13,13),
        new THREE.MeshToonMaterial({color:0xdff0ff, gradientMap:TOON_RAMP, transparent:true, opacity:0.6}));
      cube.rotation.set(j,j*1.7,j*0.6); ice.add(cube);
    }
    ice.position.z=8; g.add(ice);

    // selection ring on the ground
    const selRing = new THREE.Mesh(new THREE.TorusGeometry(src.w*0.5, 3, 8, 32),
      mat('#ffd98a',{rough:0.4, emissive:'#ffb020', emissiveIntensity:0.8, noCache:true}));
    selRing.rotation.x=Math.PI/2; selRing.position.set(0,2,0); selRing.visible=false; g.add(selRing);

    // turbo upgrade badge: glowing racing fins on both sides of the body
    // (shown once the matching Turbo Brewer / Turbo Steamer is owned)
    const turbo = new THREE.Group();
    const finMat = mat('#e0342a',{rough:0.35, emissive:'#ff5a20', emissiveIntensity:0.55, noCache:true});
    for (const dir of [-1,1]){
      const fin = new THREE.Mesh(new THREE.BoxGeometry(8, bodyH*0.55, 34), finMat);
      fin.position.set(dir*(src.w/2-3), (bodyBot+bodyTop)/2, 6);
      fin.rotation.x = -0.25;
      turbo.add(fin);
    }
    turbo.visible = false; g.add(turbo);

    // brew-alarm bell perched on top of the body (shown when 'alarm' owned)
    const bell = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(9,14,10,0,Math.PI*2,0,Math.PI/2),
      mat('#e8b040',{rough:0.3, metal:0.6}));
    bell.add(dome);
    const clapper = new THREE.Mesh(new THREE.SphereGeometry(3,8,6), mat('#7a5a20',{rough:0.5}));
    clapper.position.set(0,-1,0); bell.add(clapper);
    bell.position.set(-src.w/2+22, bodyTop+8, 12);
    bell.visible = false; g.add(bell);

    // invisible collider box over the whole machineRect (for raycast API)
    const col = new THREE.Mesh(new THREE.BoxGeometry(src.w, 210, 80), colliderMaterial());
    place(col, cx, src.y+105, MZ);
    rig.add(col);
    colliders.machines.push({ mesh:col, index:i });

    // world-space anchor of the cup base, for projecting the 2D captions
    const s = RIGS.brew.s;
    const wp = {
      x: rig.position.x + s*(cx - 480),
      y: rig.position.y + s*(300 - cupBotV),
      z: rig.position.z + s*MZ,
      s,
    };

    machines.push({ g, body, panel, lamp, lampMat, spout, glass, fluid, fluidMat, rings, pour, ice, selRing, turbo, bell, kind:src.kind, wp });
  }
  brew3d = { machines };
}

export function updateBrew3D(dt=0.016){
  if (!brew3d) return;
  for (let i=0;i<G.machines.length;i++){
    const m = G.machines[i], r = brew3d.machines[i];
    const running = m.state==='run', done = m.state==='done';
    const cold = isCold(m);
    // steam curls off a hot brew — busy while running, a lazy wisp when done
    if (!cold && (running || done) && Math.random() < dt*(running ? 9 : 1.5)){
      const s = r.wp.s;
      // spawn in front of the machine face (body spans local z ±30) so the
      // rising puffs read white-on-dark instead of vanishing behind it
      steam3d(r.wp.x + rand(-8,8)*s, r.wp.y + s*(CUP_H+6), r.wp.z + 42*s,
        { vy: rand(20,34), size: rand(13,20), life: rand(1.0,1.7), sway: rand(4,9) });
    }
    // fluid fill (tinted by the chosen add-in so it reads as mixed in)
    const target = m.amt/3;
    const frac = done ? target : running ? target*clamp(m.t/m.total,0,1) : 0;
    r.fluidMat.color.set(m.addin ? mixHex([[m.type.color,1],[m.addin.color,0.5]]) : m.type.color);
    if (frac>0.001){ r.fluid.visible=true; r.fluid.userData.fill(frac); }
    else r.fluid.visible=false;
    const surfY = frac*CUP_H;
    // lamp
    if (running){
      const pulse = Math.sin(G.time*8)>0;
      r.lampMat.color.set(pulse?'#ffd24a':'#ffb400');
      r.lampMat.emissive.set('#ff9000'); r.lampMat.emissiveIntensity = pulse?1.1:0.7;
    } else if (done){
      r.lampMat.color.set('#3fd08c'); r.lampMat.emissive.set('#1f8f5a'); r.lampMat.emissiveIntensity=0.9;
    } else {
      r.lampMat.color.set('#7a848e'); r.lampMat.emissive.set('#000000'); r.lampMat.emissiveIntensity=0;
    }
    // guide rings: highlight the selected amount
    for (let k=0;k<3;k++){
      const on = (k+1)===m.amt;
      r.rings[k].material.color.set(on?'#ffd98a':'#fff4d6');
      r.rings[k].material.emissive.set(on?'#ffb020':'#000000');
      r.rings[k].material.emissiveIntensity = on?0.7:0;
    }
    // pour stream while running, from spout down to the fluid surface
    if (running && frac<target-0.001){
      const top = CUP_H+14, bot = Math.max(surfY, 2), h = Math.max(2, top-bot);
      r.pour.visible=true; r.pour.scale.y=h; r.pour.position.y=(top+bot)/2;
      r.pour.material.color.set(r.kind==='coffee' ? '#5a3220' : '#f4ecdb');
    } else r.pour.visible=false;
    // ice
    r.ice.visible = cold && frac>0.05;
    if (r.ice.visible){
      for (let j=0;j<r.ice.children.length;j++){
        const cube=r.ice.children[j];
        cube.position.set((j?1:-1)*CUP_TOPR*0.4, Math.max(10,surfY-8)+Math.sin(G.time*1.5+j)*2, 0);
        cube.rotation.y += 0.004;
      }
    }
    // selection ring
    r.selRing.visible = (i===G.selMachine);
    // owned-upgrade props
    r.turbo.visible = owns(m.kind==='coffee' ? 'brewfast' : 'steamfast');
    r.bell.visible = owns('alarm');
  }
}

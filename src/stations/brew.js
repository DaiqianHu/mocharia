/* ============================================================
   Brew station — a line of machines (coffee brewers + milk
   steamers). Pick a machine, choose the type, hot/cold, and how
   many shots/portions (1-3 -> guide lines on its measuring cup),
   then start it and wait out the brew timer. Pour the finished
   cup into the active ticket's drink.
   ============================================================ */
import { TAU, rr, shade, clamp, mixHex } from '../core/constants.js';
import { RAIL_H } from '../game/layout.js';
import { G } from '../game/state.js';
import { BT } from '../game/buttons.js';
import { owns } from '../game/progress.js';
import { drawStationLabel } from '../render/scene.js';

/* geometry helpers shared with input hit-testing */
export function machineRect(m){ return {x:m.x, y:m.y, w:m.w, h:210}; }

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
   readout and the brew timer / READY / idle status. */
function drawMachineHUD(c, m, selected){
  const cx = m.x+m.w/2;
  const running = m.state==='run', done = m.state==='done';
  // name plate on the machine face
  c.textAlign='center'; c.textBaseline='middle';
  c.fillStyle = selected ? '#ffe9b8' : 'rgba(255,255,255,0.92)';
  c.font='800 12px Verdana, sans-serif';
  c.fillText((m.kind==='coffee'?'☕ COFFEE ':'🥛 MILK ')+(G.machines.indexOf(m)+1), cx, m.y+20);
  // type + temp (+ add-in) readout
  c.fillStyle = selected ? '#fff4d6' : 'rgba(255,244,222,0.82)';
  c.font='700 10px Verdana, sans-serif';
  c.fillText(m.type.name+'  ·  '+tempLabel(m), cx, m.y+36);
  if (m.addin){
    c.fillStyle = shade(m.addin.color, 70);
    c.font='700 9px Verdana, sans-serif';
    c.fillText('+ '+m.addin.name, cx, m.y+50);
  }
  // status under the measuring cup
  const sy = m.y+CUP_BOT+24;
  if (running){
    c.fillStyle='#ffd24a'; c.font='800 15px Verdana, sans-serif';
    c.fillText((m.total-m.t).toFixed(1)+'s', cx, sy);
  } else if (done){
    const b=1+Math.sin(G.time*7)*0.08;
    c.save(); c.translate(cx,sy); c.scale(b,b);
    c.fillStyle='#3fd08c'; c.font='800 14px Verdana, sans-serif';
    c.fillText('READY!', 0, 0); c.restore();
  } else {
    c.fillStyle='rgba(255,233,184,0.6)'; c.font='700 11px Verdana, sans-serif';
    c.fillText('idle', cx, sy);
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
   selection still uses the 2D machineRect hit-test (valid at z≈0).
   ============================================================ */
import { THREE, place, mat, fillMesh, fluidGeometry, shadowDecal,
         colliders, colliderMaterial } from '../render/three.js';
import { stationRoom3D } from '../render/scene3d.js';

const CUP_H = CUP_BOT - CUP_TOP;              // measuring-cup height (98)
const CUP_BOTR = CW*0.4, CUP_TOPR = CW/2;     // cup radii
const MZ = 14;                                // machines sit slightly forward
let brew3d = null;

export function buildBrew3D(group){
  group.add(stationRoom3D());
  const machines = [];
  for (let i=0;i<G.machines.length;i++){
    const src = G.machines[i];
    const cx = src.x+src.w/2, cupBotV = src.y+CUP_BOT;
    const g = new THREE.Group();
    place(g, cx, cupBotV, MZ);          // local y=0 sits at the cup base
    group.add(g);

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
    const glass = new THREE.Mesh(glassGeo, new THREE.MeshStandardMaterial({
      color:0xd6e6f0, roughness:0.15, metalness:0, transparent:true, opacity:0.24,
      depthWrite:false, side:THREE.DoubleSide }));
    glass.renderOrder = 5; glass.position.set(0,0,8); g.add(glass);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(CUP_TOPR,2.4,8,26),
      mat('#eaf4fa',{rough:0.2,metal:0.1}));
    rim.rotation.x=Math.PI/2; rim.position.set(0,CUP_H,8); rim.renderOrder=6; g.add(rim);

    const fluidMat = mat(src.type.color, {rough:0.5, noCache:true});
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
        new THREE.MeshStandardMaterial({color:0xdff0ff, roughness:0.1, transparent:true, opacity:0.6}));
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
    group.add(col);
    colliders.machines.push({ mesh:col, index:i });

    machines.push({ g, body, panel, lamp, lampMat, spout, glass, fluid, fluidMat, rings, pour, ice, selRing, turbo, bell, kind:src.kind });
  }
  brew3d = { machines };
}

export function updateBrew3D(){
  if (!brew3d) return;
  for (let i=0;i<G.machines.length;i++){
    const m = G.machines[i], r = brew3d.machines[i];
    const running = m.state==='run', done = m.state==='done';
    const cold = isCold(m);
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

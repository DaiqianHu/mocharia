/* ============================================================
   Brew station — a line of machines (coffee brewers + milk
   steamers). Pick a machine, choose the type, hot/cold, and how
   many shots/portions (1-3 -> guide lines on its measuring cup),
   then start it and wait out the brew timer. Pour the finished
   cup into the active ticket's drink.
   ============================================================ */
import { TAU, rr, shade, clamp } from '../core/constants.js';
import { RAIL_H } from '../game/layout.js';
import { G } from '../game/state.js';
import { BT } from '../game/buttons.js';
import { drawStationRoom } from '../render/scene.js';

/* geometry helpers shared with input hit-testing */
export function machineRect(m){ return {x:m.x, y:m.y, w:m.w, h:210}; }

export function drawBrewStation(c){
  drawStationRoom(c,'Brew Station');
  for (let i=0;i<G.machines.length;i++) drawMachine(c, G.machines[i], i===G.selMachine);
  // config strip for the selected machine
  const m = G.machines[G.selMachine];
  c.fillStyle='rgba(42,22,12,0.82)'; rr(c,40,392,640,116,14); c.fill();
  c.fillStyle='#ffe9b8'; c.font='800 13px Verdana, sans-serif';
  c.textAlign='left'; c.textBaseline='middle';
  c.fillText((m.kind==='coffee'?'COFFEE MACHINE ':'MILK STEAMER ')+(G.selMachine+1), 58, 404);
  c.font='700 11px Verdana, sans-serif'; c.fillStyle='rgba(255,233,184,0.7)';
  c.fillText(m.kind==='coffee' ? 'shots' : 'portions', 510, 429);
  BT.machType.draw(c); BT.machTemp.draw(c);
  for (const b of BT.machAmt) b.draw(c);
  BT.machStart.draw(c); BT.machPour.draw(c); BT.machDump.draw(c);
  // hint
  c.fillStyle='rgba(42,22,12,0.75)'; rr(c,268,RAIL_H+14,414,28,8); c.fill();
  c.fillStyle='#ffe9b8'; c.font='700 11px Verdana, sans-serif'; c.textAlign='center';
  c.fillText('Tap a machine · set type, temp & amount · Start, wait, then Pour', 475, RAIL_H+28);
}

function drawMachine(c, m, selected){
  const cx = m.x+m.w/2;
  const running = m.state==='run', done = m.state==='done';
  // body
  const bodyCol = m.kind==='coffee' ? '#38424e' : '#4e5a66';
  c.fillStyle='rgba(20,10,4,0.35)'; rr(c,m.x+3,m.y+4,m.w,74,12); c.fill();
  const bg=c.createLinearGradient(0,m.y,0,m.y+74);
  bg.addColorStop(0,shade(bodyCol,20)); bg.addColorStop(1,shade(bodyCol,-16));
  c.fillStyle=bg; rr(c,m.x,m.y,m.w,74,12); c.fill();
  if (selected){ c.strokeStyle='#ffd98a'; c.lineWidth=4; rr(c,m.x-3,m.y-3,m.w+6,220,14); c.stroke(); }
  // face plate: kind label + status lamp
  c.fillStyle='rgba(255,255,255,0.12)'; rr(c,m.x+10,m.y+10,m.w-20,24,6); c.fill();
  c.fillStyle='#fff'; c.font='800 12px Verdana, sans-serif';
  c.textAlign='center'; c.textBaseline='middle';
  c.fillText(m.kind==='coffee'?'☕ COFFEE':'🥛 MILK', cx, m.y+22);
  c.fillStyle = done ? '#3fd08c' : running ? '#ffb400' : '#7a848e';
  if (running && Math.sin(G.time*8)>0) c.fillStyle='#ffd24a';
  c.beginPath(); c.arc(m.x+m.w-18, m.y+56, 6, 0, TAU); c.fill();
  // temp + type readout
  c.fillStyle='#ffe9b8'; c.font='700 10px Verdana, sans-serif'; c.textAlign='left';
  c.fillText(m.type.name, m.x+12, m.y+48);
  c.fillText(tempLabel(m), m.x+12, m.y+62);
  // spout
  c.fillStyle='#222a32'; rr(c,cx-8,m.y+74,16,16,3); c.fill();
  // measuring cup with 3 guide lines
  const cupTop=m.y+108, cupBot=m.y+206, cw=74;
  const xTL=cx-cw/2, xTR=cx+cw/2, xBL=cx-cw*0.4, xBR=cx+cw*0.4;
  const cupPath=()=>{ c.beginPath(); c.moveTo(xTL,cupTop); c.lineTo(xTR,cupTop);
    c.lineTo(xBR,cupBot); c.lineTo(xBL,cupBot); c.closePath(); };
  cupPath(); c.fillStyle='rgba(210,230,240,0.18)'; c.fill();
  // fill (clipped)
  const target = m.amt/3;
  const frac = done ? target : running ? target*clamp(m.t/m.total,0,1) : 0;
  if (frac>0){
    c.save(); cupPath(); c.clip();
    const col = m.kind==='coffee' ? m.type.color : m.type.color;
    const h=(cupBot-cupTop)*frac;
    const g=c.createLinearGradient(0,cupBot-h,0,cupBot);
    g.addColorStop(0,shade(col,14)); g.addColorStop(1,shade(col,-12));
    c.fillStyle=g; c.fillRect(xTL,cupBot-h,cw,h);
    if (m.kind==='coffee'){ c.fillStyle='rgba(190,130,70,0.6)'; c.fillRect(xTL,cupBot-h,cw,3); }
    // ice cubes in a cold cup
    if (isCold(m)){
      c.fillStyle='rgba(255,255,255,0.5)';
      rr(c,cx-16,cupBot-h+8,11,11,3); c.fill();
      rr(c,cx+4,cupBot-h+16,11,11,3); c.fill();
    }
    c.restore();
  }
  // pour stream while running
  if (running){
    c.fillStyle = m.kind==='coffee' ? 'rgba(90,50,32,0.9)' : 'rgba(244,236,219,0.9)';
    c.fillRect(cx-2, m.y+90, 4, cupBot-(cupBot-cupTop)*frac - (m.y+90) - 2);
  }
  // guide lines 1..3
  c.font='700 9px Verdana, sans-serif'; c.textAlign='left';
  for (let k=1;k<=3;k++){
    const gy = cupBot - (cupBot-cupTop)*(k/3);
    const hot = k===m.amt;
    c.strokeStyle = hot ? '#ffd98a' : 'rgba(255,244,214,0.45)';
    c.lineWidth = hot ? 2.4 : 1.4;
    c.setLineDash(hot?[]:[4,4]);
    c.beginPath(); c.moveTo(xTL-8,gy); c.lineTo(xTR+2,gy); c.stroke();
    c.fillStyle = hot ? '#ffd98a' : 'rgba(255,244,214,0.6)';
    c.fillText(''+k, xTR+5, gy);
  }
  c.setLineDash([]);
  cupPath(); c.strokeStyle='rgba(240,250,255,0.8)'; c.lineWidth=2.6; c.stroke();
  // timer / status
  c.textAlign='center'; c.textBaseline='middle';
  if (running){
    c.fillStyle='#ffd24a'; c.font='800 15px Verdana, sans-serif';
    c.fillText((m.total-m.t).toFixed(1)+'s', cx, cupBot+22);
  } else if (done){
    const b=1+Math.sin(G.time*7)*0.08;
    c.save(); c.translate(cx,cupBot+22); c.scale(b,b);
    c.fillStyle='#3fd08c'; c.font='800 14px Verdana, sans-serif';
    c.fillText('READY!', 0, 0); c.restore();
  } else {
    c.fillStyle='rgba(255,233,184,0.55)'; c.font='700 11px Verdana, sans-serif';
    c.fillText('idle', cx, cupBot+22);
  }
}

export function tempLabel(m){
  if (m.kind==='coffee') return m.temp==='hot' ? 'Hot' : 'Iced';
  return m.temp==='hot' ? 'Hot' : 'Cold';
}
export function isCold(m){ return m.temp!=='hot'; }

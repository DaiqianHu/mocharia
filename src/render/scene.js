/* ============================================================
   Shared scenery drawing: wood floor, shop backdrop (holiday
   aware), station room frame, lobby decors, and the layered cup.
   ============================================================ */
import { VW, VH, TAU, shade, lerp, rr } from '../core/constants.js';
import { RAIL_H, TABS_Y } from '../game/layout.js';
import { G, currentHoliday } from '../game/state.js';
import { owns } from '../game/progress.js';

export function drawWood(c, y, h){
  const g = c.createLinearGradient(0,y,0,y+h);
  g.addColorStop(0,'#8a5a34'); g.addColorStop(0.12,'#7a4c2a'); g.addColorStop(1,'#5f3a20');
  c.fillStyle=g; c.fillRect(0,y,VW,h);
  c.strokeStyle='rgba(60,32,16,0.5)'; c.lineWidth=2;
  for(let i=0;i<6;i++){
    c.beginPath();
    const yy=y+14+i*(h/6);
    c.moveTo(0,yy);
    for(let x=0;x<=VW;x+=60) c.lineTo(x, yy + Math.sin(x*0.02+i*2)*3);
    c.stroke();
  }
}

export function drawShopBackdrop(c){
  const h = currentHoliday();
  const g = c.createLinearGradient(0,0,0,VH);
  if (h){ g.addColorStop(0,h.sky[0]); g.addColorStop(1,h.sky[1]); }
  else { g.addColorStop(0,'#c98a5f'); g.addColorStop(0.55,'#b4744a'); g.addColorStop(1,'#8a542f'); }
  c.fillStyle=g; c.fillRect(0,0,VW,VH);
  c.fillStyle='rgba(255,235,205,0.10)';
  for(let i=0;i<7;i++){ c.beginPath(); c.arc(80+i*140, 60+((i%2)*24), 34, 0, TAU); c.fill(); }
  // holiday garland along the rail
  if (h){
    for(let i=0;i<12;i++){
      const x=40+i*84;
      c.fillStyle = i%2 ? h.accent : 'rgba(255,244,214,0.85)';
      c.beginPath();
      c.moveTo(x,RAIL_H+4); c.lineTo(x+16,RAIL_H+4); c.lineTo(x+8,RAIL_H+22);
      c.closePath(); c.fill();
    }
  }
  c.fillStyle='rgba(60,30,14,0.14)'; c.fillRect(0,RAIL_H,VW,3);
}

export function drawStationRoom(c, title){
  drawShopBackdrop(c);
  drawWood(c, 440, TABS_Y-440);
  c.fillStyle='rgba(42,22,12,0.82)';
  rr(c,14,RAIL_H+10,240,36,10); c.fill();
  c.fillStyle='#ffe9b8';
  c.font='800 20px "Trebuchet MS", Verdana, sans-serif';
  c.textAlign='left'; c.textBaseline='middle';
  c.fillText(title, 28, RAIL_H+29);
}

/* ---- purchased decors, drawn in the order-station lobby ---- */
export function drawDecors(c){
  const h = currentHoliday();
  if (owns('poster')){
    c.fillStyle='#6a4a2c'; rr(c,60,150,96,120,6); c.fill();
    c.fillStyle='#f0e2c8'; rr(c,68,158,80,104,4); c.fill();
    c.fillStyle='#e0813a'; c.beginPath(); c.arc(108,196,22,0,TAU); c.fill();
    c.fillStyle='#f6ecd6'; rr(c,96,206,24,34,4); c.fill();
    c.fillStyle='#6a4a2c'; c.font='700 9px Verdana, sans-serif';
    c.textAlign='center'; c.fillText('COFFEE!', 108, 252);
  }
  if (owns('hw-poster')){
    c.fillStyle='#3a2a4a'; rr(c,170,150,96,120,6); c.fill();
    c.fillStyle='#1c1424'; rr(c,178,158,80,104,4); c.fill();
    c.fillStyle='#ff8c1a'; c.beginPath(); c.arc(218,200,20,0,TAU); c.fill();
    c.fillStyle='#1c1424';
    c.beginPath(); c.moveTo(208,194); c.lineTo(216,198); c.lineTo(208,202); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(228,194); c.lineTo(220,198); c.lineTo(228,202); c.closePath(); c.fill();
  }
  if (owns('xm-tree')){
    c.fillStyle='#5a3a1e'; rr(c,505,392,14,30,3); c.fill();
    c.fillStyle='#2f7a4a';
    for(let i=0;i<3;i++){
      const w=70-i*16, y=396-i*34;
      c.beginPath(); c.moveTo(512-w/2,y); c.lineTo(512+w/2,y); c.lineTo(512,y-40); c.closePath(); c.fill();
    }
    for(let i=0;i<6;i++){
      c.fillStyle=['#ff5a5a','#ffd24a','#5aa0ff'][i%3];
      c.beginPath(); c.arc(496+(i*13)%36, 316+i*14, 3.4, 0, TAU); c.fill();
    }
  }
  if (owns('arcade')){
    const ax=52, ay=280;
    c.fillStyle='#2a3a5c'; rr(c,ax,ay,84,150,8); c.fill();
    c.fillStyle='#182238'; rr(c,ax+8,ay+14,68,44,6); c.fill();
    // little demo game flickers
    c.fillStyle='#3fd08c';
    c.fillRect(ax+16+((G.time*30)%40), ay+40, 8, 8);
    c.fillStyle='#ffd24a'; c.beginPath(); c.arc(ax+30,ay+28,4,0,TAU); c.fill();
    c.fillStyle='#c84a5a'; rr(c,ax+14,ay+70,56,10,4); c.fill();
    c.fillStyle='#e0d8c8'; c.beginPath(); c.arc(ax+26,ay+92,6,0,TAU); c.arc(ax+50,ay+92,6,0,TAU); c.fill();
    c.font='700 9px Verdana, sans-serif'; c.fillStyle='#8fb8ff';
    c.textAlign='center'; c.fillText('ARCADE', ax+42, ay+140);
  }
  if (owns('table')){
    const tx=560, ty=470;
    c.fillStyle='rgba(30,14,8,0.25)';
    c.beginPath(); c.ellipse(tx,ty+34,54,10,0,0,TAU); c.fill();
    c.fillStyle='#7a4a24'; rr(c,tx-6,ty,12,34,3); c.fill();
    const tg=c.createLinearGradient(0,ty-16,0,ty+4);
    tg.addColorStop(0,'#b47a44'); tg.addColorStop(1,'#8a5a2e');
    c.fillStyle=tg;
    c.beginPath(); c.ellipse(tx,ty-8,58,16,0,0,TAU); c.fill();
    c.strokeStyle='#5f3a20'; c.lineWidth=2;
    c.beginPath(); c.ellipse(tx,ty-8,58,16,0,0,TAU); c.stroke();
    // a little vase
    c.fillStyle='#c8506a'; c.beginPath(); c.arc(tx,ty-22,5,0,TAU); c.fill();
    c.fillStyle='#3fa06a'; c.fillRect(tx-1,ty-18,2,8);
  }
}

/* ---- the star of the show: the drink cup ----
   Contents come from t.cup (machine pours); toppings are drawn at
   the exact positions they were applied (x is -0.5..0.5 of width). */
export function drawCup(c, cup, t, opts={}){
  const {cx, by, w, h} = cup;
  const scale = opts.scale || 1;
  c.save();
  c.translate(cx, by); c.scale(scale,scale); c.translate(-cx,-by);
  const topW=w, botW=w*0.78, topY=by-h;
  const xTL=cx-topW/2, xTR=cx+topW/2, xBL=cx-botW/2, xBR=cx+botW/2;
  const cupPath = ()=>{ c.beginPath(); c.moveTo(xTL,topY); c.lineTo(xTR,topY);
    c.lineTo(xBR,by); c.quadraticCurveTo(cx,by+10,xBL,by); c.closePath(); };
  cupPath(); c.fillStyle='rgba(210,230,240,0.20)'; c.fill();

  // fluid: coffee at the bottom, milk on top; 1 unit = 1/6 of the cup
  const UNIT = 1/6.5;
  const cc = t ? t.cup.coffee : null;
  const mm = t ? t.cup.milk : null;
  let acc = 0;
  c.save(); cupPath(); c.clip();
  const wob = Math.sin(G.time*2.2)*1.1;
  const pour = (frac, col, isTop)=>{
    const y0 = by - acc*h; acc += frac;
    const y1 = by - acc*h;
    const g=c.createLinearGradient(0,y1,0,y0);
    g.addColorStop(0, shade(col,14)); g.addColorStop(1, shade(col,-14));
    c.fillStyle=g;
    c.beginPath(); c.moveTo(xTL,y0);
    if (isTop) for (let x=xTL;x<=xTR;x+=10) c.lineTo(x, y1 + Math.sin(x*0.06+G.time*3)*wob*0.5);
    else { c.lineTo(xTL,y1); c.lineTo(xTR,y1); }
    c.lineTo(xTR,y0); c.closePath(); c.fill();
    return y1;
  };
  let surfY = by;
  if (cc) surfY = pour(cc.amt*UNIT, cc.type.color, !mm);
  if (mm) surfY = pour(mm.amt*UNIT, mm.type.color, true);
  if (cc && !mm){ c.fillStyle='rgba(190,130,70,0.65)'; c.fillRect(xTL,surfY,topW,4); }
  // ice cubes bob at the surface of a cold drink
  const iced = (cc && cc.temp==='iced') || (mm && mm.temp==='cold');
  if (t && acc>0 && iced){
    c.fillStyle='rgba(255,255,255,0.55)';
    c.strokeStyle='rgba(200,230,245,0.8)'; c.lineWidth=1.6;
    for (let i=0;i<3;i++){
      const ix=cx+(i-1)*w*0.22+Math.sin(G.time*1.4+i*2)*3;
      const iy=surfY+7+Math.sin(G.time*1.8+i)*1.6;
      rr(c,ix-9,iy-6,18,15,4); c.fill(); c.stroke();
    }
  }
  c.restore();

  // steam over a hot drink
  const hot = (cc && cc.temp==='hot' && (!mm || mm.temp==='hot'));
  if (t && acc>0 && hot && !opts.noSteam){
    c.strokeStyle='rgba(255,246,230,0.4)'; c.lineWidth=2.4; c.lineCap='round';
    for(let i=-1;i<=1;i+=2){
      const sx=cx+i*w*0.16, ph=G.time*2+i;
      c.beginPath();
      c.moveTo(sx, surfY-8);
      c.quadraticCurveTo(sx+Math.sin(ph)*7, surfY-26, sx+Math.sin(ph+1)*5, surfY-44);
      c.stroke();
    }
  }

  // glass front + rim
  cupPath();
  c.strokeStyle='rgba(240,250,255,0.85)'; c.lineWidth=3.4; c.stroke();
  c.fillStyle='rgba(255,255,255,0.14)';
  c.beginPath();
  c.moveTo(xTL+8,topY+8); c.lineTo(xTL+22,topY+8);
  c.lineTo(xBL+18,by-8); c.lineTo(xBL+7,by-8); c.closePath(); c.fill();
  c.strokeStyle='rgba(240,250,255,0.9)'; c.lineWidth=3;
  c.beginPath(); c.moveTo(xTL-3,topY); c.lineTo(xTR+3,topY); c.stroke();

  // toppings — anchored where they were applied
  if (t && !opts.noTop){
    const tp=t.top;
    const baseY = Math.min(surfY, by-6);
    const hasWhip = tp.whip.blobs.length>0;
    for (const b of tp.whip.blobs){
      const wg=c.createRadialGradient(cx+b.x*w, baseY-8, 1, cx+b.x*w, baseY-8, b.size*w);
      wg.addColorStop(0,'#fffdf6'); wg.addColorStop(1,'#efe3cd');
      c.fillStyle=wg;
      c.beginPath(); c.arc(cx+b.x*w, baseY-8, b.size*w, 0, TAU); c.fill();
    }
    const crownY = baseY - (hasWhip?20:2);
    if (tp.drizzle && tp.drizzle.pts.length>1){
      c.strokeStyle = tp.drizzle.item.color; c.lineWidth=3.2; c.lineCap='round';
      c.beginPath();
      const pts=tp.drizzle.pts;
      for (let i=0;i<pts.length;i++){
        const px=cx+pts[i].x*w, py=crownY+pts[i].y;
        if (i===0) c.moveTo(px,py); else c.lineTo(px,py);
      }
      c.stroke();
    }
    if (tp.sprinkles){
      for (const d of tp.sprinkles.dots){
        c.save(); c.translate(cx+d.x*w, crownY+d.y); c.rotate(d.rot);
        c.fillStyle=d.color;
        rr(c,-3.2,-1.2,6.4,2.4,1.2); c.fill();
        c.restore();
      }
    }
  }
  c.restore();
}

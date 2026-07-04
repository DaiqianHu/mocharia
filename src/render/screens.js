/* ============================================================
   Full-screen overlays: title, day intro (holiday banner), the
   end-of-day summary (per-station ratings + XP/rank), the shop,
   and the per-serve result card.
   ============================================================ */
import { VW, VH, TAU, clamp, lerp, easeOut, fmt$, rr } from '../core/constants.js';
import { RANKS, customersForDay } from '../game/data.js';
import { gradeWord, gradeColor } from '../game/scoring.js';
import { G, currentHoliday } from '../game/state.js';
import { P, nextRankXp, shopStock, holidayItems, unlocksAtRank } from '../game/progress.js';
import { BT, shopCardPos, SHOP_CARD_W, SHOP_CARD_H } from '../game/buttons.js';
import { drawShopBackdrop, drawWood } from './scene.js';

// __BUILD_TIME__ is injected by vite.config.js's `define` at build time
// (an ISO string baked into the bundle) — formatted once and cached.
let _buildLabel = null;
function buildLabel(){
  if (_buildLabel) return _buildLabel;
  const iso = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : null;
  if (!iso){ _buildLabel = 'dev build'; return _buildLabel; }
  const d = new Date(iso);
  const pad = n => String(n).padStart(2,'0');
  _buildLabel = 'build ' + d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate())
    + ' ' + pad(d.getUTCHours())+':'+pad(d.getUTCMinutes())+' UTC';
  return _buildLabel;
}

export function drawScoreIcon(c,x,y,kind){
  c.save(); c.translate(x,y); c.strokeStyle='#6a4a2c'; c.fillStyle='#6a4a2c';
  c.lineWidth=2.4; c.lineCap='round'; c.lineJoin='round';
  if (kind==='order'){ // bell
    c.beginPath(); c.arc(0,1,7,Math.PI,0); c.lineTo(8,6); c.lineTo(-8,6); c.closePath(); c.stroke();
    c.beginPath(); c.arc(0,9,2,0,TAU); c.fill();
  } else if (kind==='brew'){ // demitasse
    c.beginPath(); c.moveTo(-8,-6); c.lineTo(8,-6); c.lineTo(5,8); c.lineTo(-5,8);
    c.closePath(); c.stroke();
    c.beginPath(); c.arc(9,-1,4,-Math.PI/2,Math.PI/2); c.stroke();
  } else if (kind==='top'){ // swirl
    c.beginPath(); c.arc(0,2,7,Math.PI,0); c.stroke();
    c.beginPath(); c.arc(0,-3,4,Math.PI,0); c.stroke();
    c.beginPath(); c.arc(0,-7,1.6,0,TAU); c.fill();
  } else if (kind==='cannoli'){ // tube
    rr(c,-9,-4,18,9,4); c.stroke();
    c.beginPath(); c.arc(-9,0.5,2.4,0,TAU); c.arc(9,0.5,2.4,0,TAU); c.fill();
  } else if (kind==='tip'){ // coin
    c.beginPath(); c.arc(0,0,8.4,0,TAU); c.stroke();
    c.font='800 11px Verdana, sans-serif'; c.textAlign='center'; c.textBaseline='middle';
    c.fillText('$',0,0.5);
  }
  c.restore();
}

export function drawStars(c,x,y,n,size=15,total=5,scaleOf=null){
  for(let i=0;i<total;i++){
    const sx=x+i*(size*2.1);
    c.save(); c.translate(sx,y);
    if (scaleOf){ const s=scaleOf(i); c.scale(s,s); }
    c.beginPath();
    for(let k=0;k<5;k++){
      const a=-Math.PI/2 + k*TAU/5;
      const a2=a+TAU/10;
      c.lineTo(Math.cos(a)*size, Math.sin(a)*size);
      c.lineTo(Math.cos(a2)*size*0.45, Math.sin(a2)*size*0.45);
    }
    c.closePath();
    c.fillStyle = i<n ? '#ffb400' : 'rgba(0,0,0,0.15)';
    c.fill();
    c.strokeStyle='rgba(60,32,10,0.5)'; c.lineWidth=1.4; c.stroke();
    c.restore();
  }
}

export function drawTitle(c){
  const g=c.createLinearGradient(0,0,0,VH);
  g.addColorStop(0,'#2c1a2e'); g.addColorStop(1,'#180e14');
  c.fillStyle=g; c.fillRect(0,0,VW,VH);
  // drifting beans
  for(let i=0;i<14;i++){
    const bx=(i*173 + G.titleT*14*(1+(i%3)*0.4))% (VW+80) -40;
    const byy=70+((i*97)%460);
    c.save(); c.translate(bx,byy); c.rotate(i+G.titleT*0.3);
    c.fillStyle='rgba(120,80,50,0.28)';
    c.beginPath(); c.ellipse(0,0,13,9,0,0,TAU); c.fill();
    c.strokeStyle='rgba(60,36,20,0.4)'; c.lineWidth=2;
    c.beginPath(); c.moveTo(-9,0); c.quadraticCurveTo(2,-3,9,0); c.stroke();
    c.restore();
  }
  // hero mug + cannoli
  const mx=VW/2, myB=330;
  c.save();
  const bounce=Math.sin(G.titleT*2)*4;
  c.translate(0,bounce);
  c.fillStyle='#e8dccb';
  c.beginPath(); c.moveTo(mx-52,240); c.lineTo(mx+52,240);
  c.lineTo(mx+42,myB); c.quadraticCurveTo(mx,myB+10,mx-42,myB); c.closePath(); c.fill();
  c.strokeStyle='#c8b8a0'; c.lineWidth=4; c.stroke();
  c.strokeStyle='#e8dccb'; c.lineWidth=9;
  c.beginPath(); c.arc(mx+58,278,22,-Math.PI/2,Math.PI/2); c.stroke();
  c.fillStyle='#3a2317';
  c.beginPath(); c.ellipse(mx,247,45,7,0,0,TAU); c.fill();
  c.fillStyle='#b07a45';
  c.beginPath(); c.ellipse(mx-14,246,13,3.4,0,0,TAU); c.fill();
  // cannoli leaning on the mug
  c.save(); c.translate(mx-92,318); c.rotate(-0.3);
  const cg=c.createLinearGradient(0,-14,0,14);
  cg.addColorStop(0,'#e0a860'); cg.addColorStop(1,'#a06a28');
  c.fillStyle=cg; rr(c,-38,-14,76,28,12); c.fill();
  c.fillStyle='#f6eeda';
  c.beginPath(); c.arc(-38,0,10,0,TAU); c.arc(38,0,10,0,TAU); c.fill();
  c.restore();
  c.restore();
  // logo
  c.textAlign='center'; c.textBaseline='middle';
  const wob=Math.sin(G.titleT*3)*2;
  c.font='900 76px "Trebuchet MS", Verdana, sans-serif';
  c.lineWidth=12; c.lineJoin='round'; c.strokeStyle='#3a1c10';
  c.strokeText('MOCHA RUSH!', VW/2, 140+wob);
  const lg=c.createLinearGradient(0,100,0,180);
  lg.addColorStop(0,'#ffd98a'); lg.addColorStop(1,'#e0813a');
  c.fillStyle=lg; c.fillText('MOCHA RUSH!', VW/2, 140+wob);
  c.font='700 19px Verdana, sans-serif'; c.fillStyle='#e8cdb0';
  c.fillText('Brew it. Steam it. Top it. Cannoli it.', VW/2, 196);
  c.font='700 13px Verdana, sans-serif'; c.fillStyle='rgba(232,205,176,0.7)';
  c.fillText('Best day so far: '+fmt$(G.best), VW/2, 372);
  BT.newGame.pulse=1;
  BT.newGame.draw(c);
  if (G.hasSave) BT.contGame.draw(c);
  c.fillStyle='rgba(232,205,176,0.5)'; c.font='700 12px Verdana, sans-serif';
  c.fillText('Mouse / touch · rank up · unlock the menu · survive the holidays', VW/2, 560);
  // build stamp — which deploy is actually live on GitHub Pages
  c.textAlign='left'; c.font='700 10px Verdana, sans-serif';
  c.fillStyle='rgba(232,205,176,0.35)';
  c.fillText(buildLabel(), 10, VH-14);
}

export function drawDayIntro(c){
  drawShopBackdrop(c);
  drawWood(c,430,VH-430);
  c.fillStyle='rgba(20,10,6,0.55)'; c.fillRect(0,0,VW,VH);
  const t=easeOut(Math.min(1,G.introT/0.6));
  const cy=lerp(-320,120,t);
  const hol = currentHoliday();
  c.save(); c.translate(0,cy);
  c.fillStyle='rgba(20,10,4,0.5)'; rr(c,VW/2-238,4,476,290,22); c.fill();
  c.fillStyle='#f6ecd6'; rr(c,VW/2-240,0,480,290,22); c.fill();
  c.strokeStyle='#a8906a'; c.lineWidth=3; rr(c,VW/2-240,0,480,290,22); c.stroke();
  c.textAlign='center'; c.textBaseline='middle';
  c.fillStyle='#3a2216'; c.font='900 54px "Trebuchet MS", Verdana, sans-serif';
  c.fillText('Day '+G.day, VW/2, 60);
  c.font='700 17px Verdana, sans-serif'; c.fillStyle='#6a4a2c';
  c.fillText(customersForDay(G.day)+' customers on the way', VW/2, 116);
  c.fillText('Wallet: '+fmt$(G.money)+'   ·   Rank: '+RANKS[P.rank].name, VW/2, 148);
  if (hol){
    c.fillStyle=hol.accent; c.font='900 24px "Trebuchet MS", Verdana, sans-serif';
    c.fillText('🎉 It\'s '+hol.name+'! 🎉', VW/2, 196);
    const its=holidayItems(hol), got=its.filter(i=>P.owned[i.id]).length;
    c.font='700 13px Verdana, sans-serif'; c.fillStyle='#6a4a2c';
    c.fillText(hol.greet, VW/2, 228);
    c.fillText('Holiday items collected: '+got+' / '+its.length, VW/2, 252);
  }
  c.restore();
  BT.start.draw(c);
}

export function drawSummary(c){
  drawShopBackdrop(c);
  c.fillStyle='rgba(20,10,6,0.6)'; c.fillRect(0,0,VW,VH);
  const t=easeOut(Math.min(1,G.summaryT/0.5));
  c.save(); c.globalAlpha=t; c.translate(0,(1-t)*40);
  c.fillStyle='#f6ecd6'; rr(c,VW/2-330,52,660,442,22); c.fill();
  c.strokeStyle='#a8906a'; c.lineWidth=3; rr(c,VW/2-330,52,660,442,22); c.stroke();
  c.textAlign='center'; c.textBaseline='middle';
  c.fillStyle='#3a2216'; c.font='900 34px "Trebuchet MS", Verdana, sans-serif';
  c.fillText('Day '+G.day+' Closed!', VW/2, 92);
  const dayEarn=G.served.reduce((a,s)=>a+s.earn,0);

  // ---- station report card ----
  const sa = G.stationAvg || {};
  const rows=[['order','Order Station',sa.order],['brew','Brew Station',sa.brew],
              ['top','Topping Station',sa.top],['cannoli','Cannoli Station',sa.cannoli]];
  let y=146;
  c.font='800 15px Verdana, sans-serif';
  for (const [icon,label,val] of rows){
    drawScoreIcon(c,VW/2-268,y,icon);
    c.textAlign='left'; c.fillStyle='#3a2216';
    c.fillText(label, VW/2-244, y);
    const bw=250, bx=VW/2-70;
    c.fillStyle='rgba(0,0,0,0.12)'; rr(c,bx,y-9,bw,18,9); c.fill();
    if (val===null || val===undefined){
      c.textAlign='right'; c.fillStyle='#8a7a66'; c.fillText('—', VW/2+248, y);
    } else {
      const p=clamp(val/100,0,1)*easeOut(Math.min(1,G.summaryT/1.1));
      c.fillStyle=gradeColor(val); rr(c,bx,y-9,Math.max(4,bw*p),18,9); c.fill();
      c.textAlign='right'; c.fillStyle=gradeColor(val);
      c.fillText(val+'%', VW/2+248, y);
    }
    y+=38;
  }

  // ---- XP + rank ----
  y+=6;
  c.textAlign='center'; c.fillStyle='#3a6ac0'; c.font='800 17px Verdana, sans-serif';
  c.fillText('+'+G.dayXp+' XP today', VW/2, y);
  y+=26;
  const next=nextRankXp();
  if (G.rankRes){
    const pop=1+Math.sin(G.summaryT*5)*0.04;
    c.save(); c.translate(VW/2,y+10); c.scale(pop,pop);
    c.fillStyle='#c8861e'; c.font='900 24px "Trebuchet MS", Verdana, sans-serif';
    c.fillText('★ RANK UP!  You are now a '+G.rankRes.to+' ★', 0, 0);
    c.restore();
    const unl = unlocksAtRank(G.rankRes.rank);
    if (unl.length){
      c.fillStyle='#6a4a2c'; c.font='700 13px Verdana, sans-serif';
      c.fillText('Unlocked: '+unl.map(u=>u.name).join(' · '), VW/2, y+38);
    }
    y+=56;
  } else {
    c.fillStyle='#6a4a2c'; c.font='700 13px Verdana, sans-serif';
    c.fillText(next ? 'Rank: '+RANKS[P.rank].name+'  ·  '+(next-P.xp)+' XP to '+RANKS[P.rank+1].name
                    : 'Rank: '+RANKS[P.rank].name+' (MAX)', VW/2, y);
    if (next){
      const prev=RANKS[P.rank].xp, frac=clamp((P.xp-prev)/(next-prev),0,1);
      c.fillStyle='rgba(58,106,192,0.18)'; rr(c,VW/2-160,y+16,320,12,6); c.fill();
      c.fillStyle='#3a6ac0'; rr(c,VW/2-160,y+16,Math.max(4,320*frac),12,6); c.fill();
    }
    y+=44;
  }

  c.fillStyle='#3a2216'; c.font='800 20px Verdana, sans-serif';
  c.fillText("Today's earnings: "+fmt$(dayEarn), VW/2, y+8);
  c.font='700 13px Verdana, sans-serif'; c.fillStyle='#6a4a2c';
  c.fillText('Total wallet: '+fmt$(G.money)+'  ·  '+G.served.length+' drinks served', VW/2, y+34);
  c.restore();
  BT.next.draw(c);
}

/* ---- the shop, between days ---- */
export function drawShop(c){
  drawShopBackdrop(c);
  c.fillStyle='rgba(20,10,6,0.6)'; c.fillRect(0,0,VW,VH);
  c.textAlign='center'; c.textBaseline='middle';
  c.lineWidth=8; c.lineJoin='round'; c.strokeStyle='#3a1c10';
  c.font='900 40px "Trebuchet MS", Verdana, sans-serif';
  c.strokeText('THE SUPPLY SHOP', VW/2, 56);
  c.fillStyle='#ffd98a'; c.fillText('THE SUPPLY SHOP', VW/2, 56);
  c.font='800 16px Verdana, sans-serif'; c.fillStyle='#8fe0a8';
  c.fillText('Wallet: '+fmt$(G.money), VW/2, 92);

  const hol = currentHoliday();
  const stock = shopStock(G.day);
  for (let i=0;i<Math.min(stock.length, BT.shopBuy.length);i++){
    const it=stock[i], p=shopCardPos(i);
    const isHol = !!it.holiday;
    c.fillStyle='rgba(20,10,4,0.5)'; rr(c,p.x+3,p.y+4,SHOP_CARD_W,SHOP_CARD_H,12); c.fill();
    c.fillStyle = isHol ? '#fdf0d2' : '#f6ecd6';
    rr(c,p.x,p.y,SHOP_CARD_W,SHOP_CARD_H,12); c.fill();
    c.strokeStyle = isHol && hol ? hol.accent : '#a8906a';
    c.lineWidth = isHol?3:2; rr(c,p.x,p.y,SHOP_CARD_W,SHOP_CARD_H,12); c.stroke();
    c.textAlign='left'; c.textBaseline='top';
    c.fillStyle='#3a2216'; c.font='800 14px Verdana, sans-serif';
    c.fillText((isHol?'✦ ':'')+it.name, p.x+14, p.y+10, SHOP_CARD_W-28);
    c.fillStyle='#6a4a2c'; c.font='700 11px Verdana, sans-serif';
    c.fillText(it.desc, p.x+14, p.y+30, SHOP_CARD_W-28);
    c.fillStyle='#2fa06a'; c.font='800 13px Verdana, sans-serif';
    c.fillText(fmt$(it.price), p.x+14, p.y+SHOP_CARD_H-30);
    BT.shopBuy[i].draw(c);
  }
  if (!stock.length){
    c.textAlign='center'; c.fillStyle='rgba(255,244,214,0.8)'; c.font='800 18px Verdana, sans-serif';
    c.fillText('All stocked up — nothing left to buy!', VW/2, 260);
  }
  if (hol){
    const its=holidayItems(hol), got=its.filter(i=>P.owned[i.id]).length;
    c.textAlign='center'; c.fillStyle=hol.accent; c.font='800 14px Verdana, sans-serif';
    c.fillText('✦ '+hol.name+' specials — collect all '+its.length+' to complete the holiday ('+got+'/'+its.length+')', VW/2, 486);
  }
  if (G.holidayJustDone){
    c.fillStyle='#ffd98a'; c.font='900 20px "Trebuchet MS", Verdana, sans-serif';
    c.fillText('🎊 '+G.holidayJustDone+' complete! The seasonal goodies wave goodbye… 🎊', VW/2, 460);
  }
  BT.shopDone.draw(c);
}

export function drawResult(c){
  const r=G.result; if(!r) return;
  c.fillStyle='rgba(16,8,4,0.62)'; c.fillRect(0,0,VW,VH);
  const t=easeOut(Math.min(1,r.t/0.45));
  c.save(); c.globalAlpha=t;
  const cx=VW/2, top=48;
  c.translate(cx,0); c.scale(lerp(0.8,1,t),lerp(0.8,1,t)); c.translate(-cx,0);
  c.fillStyle='rgba(20,10,4,0.5)'; rr(c,cx-262,top+5,524,456,22); c.fill();
  c.fillStyle='#f6ecd6'; rr(c,cx-264,top,524,456,22); c.fill();
  c.strokeStyle='#a8906a'; c.lineWidth=3; rr(c,cx-264,top,524,456,22); c.stroke();
  c.textAlign='center'; c.textBaseline='middle';
  c.fillStyle='#3a2216'; c.font='900 28px "Trebuchet MS", Verdana, sans-serif';
  c.fillText(r.custName+' says: '+(r.mood==='happy'?'Delicious!':'Hmm...'), cx, top+38);
  // stars pop in one by one (starsShown advances in state.js with a chime)
  drawStars(c, cx-64, top+78, r.starsShown, 13, 5, i=>{
    if (i>=r.starsShown) return 1;
    const age = r.t - (0.45 + i*0.18);
    return 1 + 0.8*Math.max(0, 1 - age/0.16);
  });
  // breakdown rows
  const rows=[['order','Order',r.os],['brew','Brew',r.bs],['top','Toppings',r.ts]];
  if (r.cs!==null) rows.push(['cannoli','Cannoli',r.cs]);
  let y=top+122;
  for (const [icon,label,val] of rows){
    drawScoreIcon(c,cx-206,y,icon);
    c.textAlign='left'; c.fillStyle='#3a2216'; c.font='800 15px Verdana, sans-serif';
    c.fillText(label, cx-184, y);
    const bw=240, bx=cx-86;
    c.fillStyle='rgba(0,0,0,0.12)'; rr(c,bx,y-9,bw,18,9); c.fill();
    const p=clamp(val/100,0,1)*easeOut(Math.min(1,r.t/0.9));
    c.fillStyle=gradeColor(val); rr(c,bx,y-9,Math.max(4,bw*p),18,9); c.fill();
    c.textAlign='right'; c.fillStyle=gradeColor(val);
    c.fillText(Math.round(val)+'', cx+206, y);
    y+=40;
  }
  // total + money + xp
  c.textAlign='center';
  c.fillStyle=gradeColor(r.total); c.font='900 28px Verdana, sans-serif';
  c.fillText(gradeWord(r.total)+'  '+Math.round(r.total)+'%', cx, y+6);
  y+=46;
  drawScoreIcon(c,cx-150,y,'tip');
  c.fillStyle='#3a2216'; c.font='800 15px Verdana, sans-serif'; c.textAlign='left';
  c.fillText('Price '+fmt$(r.price), cx-128, y);
  c.fillStyle='#2fa06a';
  c.fillText('Tip +'+fmt$(r.tip), cx-6, y);
  c.fillStyle='#3a6ac0';
  c.fillText('+'+r.xp+' XP', cx+110, y);
  c.restore();
  BT.cont.draw(c);
}

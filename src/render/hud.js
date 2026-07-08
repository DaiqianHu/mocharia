/* ============================================================
   HUD rendering: the ticket rail, individual ticket cards, and the
   active-order side panel with the Serve button.
   ============================================================ */
import { VW, TAU, clamp, fmt$, rr } from '../core/constants.js';
import { RAIL_H, TABS_Y, PANEL_X } from '../game/layout.js';
import { G, queueCustomers } from '../game/state.js';
import { P, nextRankXp } from '../game/progress.js';
import { RANKS, SIZE_NAME } from '../game/data.js';
import { STATION_LABEL } from '../game/layout.js';
import { BT } from '../game/buttons.js';
import { NET } from '../net/coop.js';

export function drawRail(c){
  const g=c.createLinearGradient(0,0,0,RAIL_H);
  g.addColorStop(0,'#3a2216'); g.addColorStop(1,'#2c180e');
  c.fillStyle=g; c.fillRect(0,0,VW,RAIL_H);
  c.fillStyle='#c8a068'; c.fillRect(0,RAIL_H-8,VW,4);
  // day + money + rank/xp
  c.fillStyle='#ffe9b8'; c.font='800 15px Verdana, sans-serif';
  c.textAlign='right'; c.textBaseline='top';
  c.fillText('Day '+G.day, VW-14, 6);
  c.fillStyle='#8fe0a8'; c.font='800 17px Verdana, sans-serif';
  c.fillText(fmt$(G.money), VW-14, 24);
  c.fillStyle='#9ad0ff'; c.font='700 11px Verdana, sans-serif';
  const next = nextRankXp();
  c.fillText(RANKS[P.rank].name+(next?'  '+P.xp+'/'+next+' XP':'  MAX'), VW-14, 46);
  // xp sliver
  if (next){
    const prev=RANKS[P.rank].xp, frac=clamp((P.xp-prev)/(next-prev),0,1);
    c.fillStyle='rgba(154,208,255,0.25)'; rr(c,VW-130,62,116,6,3); c.fill();
    c.fillStyle='#9ad0ff'; rr(c,VW-130,62,Math.max(3,116*frac),6,3); c.fill();
  }
  c.fillStyle='rgba(255,233,184,0.7)'; c.font='700 11px Verdana, sans-serif';
  c.fillText('Customers left: '+(G.spawn.left+queueCustomers().length+G.customers.filter(cc=>cc.state==='waiting').length), VW-14, 74);
  if (G.tickets.length===0){
    c.fillStyle='rgba(255,233,184,0.45)'; c.font='700 14px Verdana, sans-serif';
    c.textAlign='left'; c.fillText('Ticket rail — take an order to get started', 16, 40);
  }
  for (const t of G.tickets) drawTicketCard(c, t);
}

/* streak combo badge — tucked under the station title card */
export function drawStreakBadge(c){
  const n = G.streak.n;
  if (n<2) return;
  const x=14, y=RAIL_H+54, w=86, h=36;
  const wob = 1 + 0.05*Math.sin(G.time*6);
  c.save();
  c.translate(x+w/2, y+h/2); c.scale(wob,wob);
  c.fillStyle='rgba(70,30,8,0.85)'; rr(c,-w/2,-h/2,w,h,10); c.fill();
  c.strokeStyle='#ffd24a'; c.lineWidth=2; rr(c,-w/2,-h/2,w,h,10); c.stroke();
  c.fillStyle='#ffd24a'; c.font='800 18px Verdana, sans-serif';
  c.textAlign='center'; c.textBaseline='middle';
  c.fillText('🔥 x'+n, 0, 1);
  c.restore();
}

/* co-op partner badge — name + which station they're working */
export function drawPartnerBadge(c){
  const p = NET.partner;
  if (!p) return;
  const x = G.streak.n>=2 ? 108 : 14;   // slide right of the streak flame
  const y = RAIL_H+54, h = 36;
  const label = '👤 '+p.name+' · '+(STATION_LABEL[p.station] || p.station);
  c.save();
  c.font='800 13px Verdana, sans-serif';
  const w = c.measureText(label).width + 26;
  c.fillStyle='rgba(30,40,70,0.82)'; rr(c,x,y,w,h,10); c.fill();
  c.strokeStyle='#9ad0ff'; c.lineWidth=2; rr(c,x,y,w,h,10); c.stroke();
  c.fillStyle='#d6eaff'; c.textAlign='left'; c.textBaseline='middle';
  c.fillText(label, x+13, y+h/2+1);
  c.restore();
}

/* rush-hour ribbon (active) / flashing warning (3s before) */
export function drawRushBanner(c){
  const r = G.rush; if (!r) return;
  if (r.active){
    const y = RAIL_H+14;
    c.save();
    const g = c.createLinearGradient(VW/2-190,0,VW/2+190,0);
    g.addColorStop(0,'rgba(210,90,30,0)'); g.addColorStop(0.15,'rgba(210,90,30,0.92)');
    g.addColorStop(0.85,'rgba(210,90,30,0.92)'); g.addColorStop(1,'rgba(210,90,30,0)');
    c.fillStyle=g; c.fillRect(VW/2-190, y, 380, 30);
    c.fillStyle='#fff3d0'; c.font='900 17px Verdana, sans-serif';
    c.textAlign='center'; c.textBaseline='middle';
    c.fillText('☕ RUSH HOUR! Tips +50% · '+Math.ceil(r.t)+'s', VW/2, y+16);
    c.restore();
  } else if (r.warn>0){
    if (Math.floor(G.time*3)%2===0) return;    // flash
    c.save();
    c.fillStyle='#ffb24a'; c.font='900 18px Verdana, sans-serif';
    c.textAlign='center'; c.textBaseline='middle';
    c.fillText('☕ RUSH HOUR INCOMING!', VW/2, RAIL_H+30);
    c.restore();
  }
}

function drawTicketCard(c, t){
  const x=t.x, y=8, w=118, h=82;
  const active = (t===G.active);
  const o=t.order;
  c.save();
  c.fillStyle='rgba(20,10,4,0.5)'; rr(c,x+2,y+4,w,h,8); c.fill();
  c.fillStyle = active ? '#fff8e2' : '#efe2c4';
  rr(c,x,y,w,h,8); c.fill();
  if (t.flash>0){ c.fillStyle='rgba(255,220,120,'+(t.flash*0.5)+')'; rr(c,x,y,w,h,8); c.fill(); }
  c.strokeStyle = active ? '#e0813a' : '#a8906a';
  c.lineWidth = active?3:1.6; rr(c,x,y,w,h,8); c.stroke();
  c.fillStyle='#3a2216'; c.font='800 11px Verdana, sans-serif';
  c.textAlign='left'; c.textBaseline='top';
  c.fillText(o.name, x+8, y+7, w-16);
  c.font='700 10px Verdana, sans-serif'; c.fillStyle='#6a4a2c';
  c.fillText(o.shots+' shot'+(o.shots>1?'s':''), x+8, y+22);
  c.fillText(o.milkAmt ? o.milkAmt+' '+(o.milkTemp==='cold'?'cold':'hot')+' milk' : 'no milk', x+8, y+35);
  // topping dots + cannoli marker
  let dx=x+8;
  const dot=(col,on)=>{ c.fillStyle=on?col:'rgba(0,0,0,0.12)';
    c.beginPath(); c.arc(dx+5, y+55, 5, 0, TAU); c.fill(); dx+=15; };
  dot('#fffdf4', o.whip);
  dot(o.drizzle?o.drizzle.color:'#000', !!o.drizzle);
  dot(o.sprinkles ? o.sprinkles.colors[0] : '#000', !!o.sprinkles);
  if (o.cannoli){
    c.fillStyle=o.cannoli.shell ? o.cannoli.shell.color : '#c98a3e';
    rr(c,dx+2,y+51,20,9,4); c.fill();
    c.fillStyle=o.cannoli.cream.color;
    c.beginPath(); c.arc(dx+2,y+55.5,3,0,TAU); c.arc(dx+22,y+55.5,3,0,TAU); c.fill();
  }
  // progress ticks B T C
  const topDone = !!t.cupSize && (!o.whip || t.top.whip.blobs.length>0) &&
                  (!o.drizzle || !!t.top.drizzle) && (!o.sprinkles || !!t.top.sprinkles);
  const marks=[
    ['B', !!t.cup.coffee && (o.milkAmt===0 || !!t.cup.milk)],
    ['T', topDone],
  ];
  if (o.cannoli) marks.push(['C', t.cannoliReady()]);
  c.font='800 10px Verdana, sans-serif';
  for(let i=0;i<marks.length;i++){
    c.fillStyle = marks[i][1] ? '#2fa06a' : 'rgba(0,0,0,0.25)';
    c.fillText(marks[i][0], x+78+i*13, y+22);
  }
  // patience sliver
  const pat = t.cust ? clamp(t.cust.patience,0,1) : 0;
  c.fillStyle='rgba(0,0,0,0.15)'; rr(c,x+8,y+70,w-16,6,3); c.fill();
  c.fillStyle = pat>0.6?'#3fd08c':pat>0.3?'#ffb400':'#ff5a4f';
  rr(c,x+8,y+70,Math.max(3,(w-16)*pat),6,3); c.fill();
  c.restore();
}

export function drawPanel(c){
  const t=G.active, x=PANEL_X, y=RAIL_H+14, w=VW-x-14, h=TABS_Y-y-14;
  c.fillStyle='rgba(30,15,8,0.35)'; rr(c,x+3,y+4,w,h,14); c.fill();
  c.fillStyle='#f6ecd6'; rr(c,x,y,w,h,14); c.fill();
  c.strokeStyle='#a8906a'; c.lineWidth=2; rr(c,x,y,w,h,14); c.stroke();
  c.textAlign='left'; c.textBaseline='top';
  if (!t){
    c.fillStyle='#6a4a2c'; c.font='700 15px Verdana, sans-serif';
    c.fillText('No active ticket.', x+20, y+24);
    c.font='700 12px Verdana, sans-serif';
    c.fillText('Visit the Order station', x+20, y+52);
    c.fillText('to take a customer order.', x+20, y+70);
    return;
  }
  const o=t.order;
  c.fillStyle='#3a2216'; c.font='800 17px "Trebuchet MS", Verdana, sans-serif';
  c.fillText(t.cust.name+"'s order", x+18, y+12);
  c.font='700 12px Verdana, sans-serif'; c.fillStyle='#6a4a2c';
  let ly=y+42;
  const row=(txt,state)=>{  // state: true done, 'warn' mismatch, false pending
    c.fillStyle = state===true ? '#2fa06a' : state==='warn' ? '#e08a3a' : '#6a4a2c';
    c.fillText((state===true?'✔ ':state==='warn'?'⚠ ':'• ')+txt, x+18, ly, w-34); ly+=20;
  };
  // cup size (picked at the topping station)
  row(SIZE_NAME[o.size]+' cup', t.cupSize ? (t.cupSize===o.size ? true : 'warn') : false);
  // coffee row (+ its syrup/powder add-in)
  const cc=t.cup.coffee;
  const cWant = o.shots+' '+(o.coffeeTemp==='iced'?'iced':'hot')+' '+o.coffee.name+' shot'+(o.shots>1?'s':'');
  row(cWant, cc ? (cc.type.id===o.coffee.id && cc.temp===o.coffeeTemp && cc.amt===o.shots ? true:'warn') : false);
  const ccAdd = cc && cc.addin;
  if (o.coffeeAdd)
    row(o.coffeeAdd.name+' in the coffee',
        cc ? (ccAdd ? (ccAdd.id===o.coffeeAdd.id ? true:'warn') : false) : false);
  else if (ccAdd) row('No add-in in the coffee', 'warn');
  // milk row (+ its add-in)
  const mm=t.cup.milk, mmAdd = mm && mm.addin;
  if (o.milkAmt>0){
    row(o.milkAmt+' '+(o.milkTemp==='cold'?'cold':'hot')+' '+o.milk.name,
        mm ? (mm.type.id===o.milk.id && mm.temp===o.milkTemp && mm.amt===o.milkAmt ? true:'warn') : false);
    if (o.milkAdd)
      row(o.milkAdd.name+' in the milk',
          mm ? (mmAdd ? (mmAdd.id===o.milkAdd.id ? true:'warn') : false) : false);
    else if (mmAdd) row('No add-in in the milk', 'warn');
  } else row('No milk', !t.cup.milk ? true : 'warn');
  // toppings
  if (o.whip) row('Whipped cream on top', t.top.whip.blobs.length>0);
  if (o.drizzle) row(o.drizzle.name, t.top.drizzle ? (t.top.drizzle.item.id===o.drizzle.id?true:'warn') : false);
  if (o.sprinkles) row(o.sprinkles.name, t.top.sprinkles ? (t.top.sprinkles.item.id===o.sprinkles.id?true:'warn') : false);
  if (!o.whip && !o.drizzle && !o.sprinkles) row('No toppings', (t.top.whip.blobs.length||t.top.drizzle||t.top.sprinkles)?'warn':true);
  // cannoli: shell type, cream, then the exact end-sprinkle the customer named
  if (o.cannoli){
    const cn=t.cannoli;
    row('Cannoli: '+o.cannoli.shell.name,
        cn.shell ? (cn.shell.id===o.cannoli.shell.id ? true:'warn') : false);
    row('…filled with '+o.cannoli.cream.name,
        cn.cream ? (cn.cream.id===o.cannoli.cream.id && t.cannoliReady() ? true : cn.cream.id!==o.cannoli.cream.id?'warn':false) : false);
    const dots = cn.dotsL.length+cn.dotsR.length;
    if (o.cannoli.sprinkles)
      row('…'+o.cannoli.sprinkles.name+' on the ends',
          dots>0 && cn.sprItem ? (cn.sprItem.id===o.cannoli.sprinkles.id ? true:'warn') : false);
    else
      row('…plain ends', dots ? 'warn' : true);
  }
  c.fillStyle='#3a2216'; c.font='800 14px Verdana, sans-serif';
  c.fillText('Price: '+fmt$(o.price), x+18, ly+4);
  BT.serve.draw(c);
}

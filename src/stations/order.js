/* ============================================================
   Order station — take the front customer's order, spawning a
   ticket on the rail. Owns order-taking and the lobby scene
   (including any decor bought from the shop).
   ============================================================ */
import { rr } from '../core/constants.js';
import { blip } from '../core/audio.js';
import { popText } from '../core/particles.js';
import { Ticket } from '../game/ticket.js';
import { RAIL_H, TABS_Y } from '../game/layout.js';
import { G, frontCustomer, layoutTickets, layoutCustomers } from '../game/state.js';
import { BT } from '../game/buttons.js';
import { drawShopBackdrop, drawWood, drawDecors } from '../render/scene.js';

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
  drawShopBackdrop(c);
  // window + door dressing
  c.fillStyle='rgba(255,244,214,0.16)'; rr(c,640,140,220,150,14); c.fill();
  c.strokeStyle='rgba(80,44,20,0.6)'; c.lineWidth=6; rr(c,640,140,220,150,14); c.stroke();
  c.beginPath(); c.moveTo(750,140); c.lineTo(750,290); c.moveTo(640,215); c.lineTo(860,215); c.stroke();
  // floor
  drawWood(c, 430, TABS_Y-430);
  // decors bought from the shop
  drawDecors(c);
  // counter
  const g=c.createLinearGradient(0,436,0,540);
  g.addColorStop(0,'#a06a3a'); g.addColorStop(1,'#7a4a24');
  c.fillStyle=g; rr(c,40,436,360,100,12); c.fill();
  c.fillStyle='#c8a068'; rr(c,32,428,376,16,8); c.fill();
  // register
  c.fillStyle='#4a5a6a'; rr(c,306,382,74,52,8); c.fill();
  c.fillStyle='#bfe8d8'; rr(c,314,390,58,20,4); c.fill();
  // customers
  const sorted=[...G.customers].sort((a,b)=>a.y-b.y);
  for (const cust of sorted) cust.draw(c,G.time);
  // waiting sign
  c.fillStyle='rgba(42,22,12,0.8)'; rr(c,700,206,190,32,8); c.fill();
  c.fillStyle='#ffe9b8'; c.font='800 14px Verdana, sans-serif';
  c.textAlign='center'; c.textBaseline='middle';
  c.fillText('PICK-UP  AREA', 795, 222);
  // front-customer speech bubble
  const f=frontCustomer();
  if (f && Math.hypot(f.tx-f.x,f.ty-f.y)<6){
    const bx=f.x, byy=f.y-146;
    c.fillStyle='#fff8e6'; rr(c,bx-92,byy-26,184,56,12); c.fill();
    c.beginPath(); c.moveTo(bx-10,byy+30); c.lineTo(bx+10,byy+30); c.lineTo(bx,byy+46); c.closePath(); c.fill();
    c.fillStyle='#3a2216'; c.font='800 13px Verdana, sans-serif';
    c.fillText('One '+f.order.name+',', bx, byy-8);
    c.font='700 11px Verdana, sans-serif';
    c.fillText(f.order.cannoli ? 'and a cannoli please!' : 'please!', bx, byy+10);
  }
  c.fillStyle='rgba(42,22,12,0.82)'; rr(c,14,RAIL_H+10,240,36,10); c.fill();
  c.fillStyle='#ffe9b8'; c.font='800 20px "Trebuchet MS", Verdana, sans-serif';
  c.textAlign='left'; c.fillText('Order Station', 28, RAIL_H+29);
  BT.take.draw(c);
}

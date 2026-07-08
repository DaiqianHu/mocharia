/* ============================================================
   Co-op lobby screens: menu, host (show the room code BIG), join
   (code entry), name entry, waiting room, and the host-left card.
   All 2D-canvas like the other screens; typing goes through the
   BT.keyGrid canvas keyboard.
   ============================================================ */
import { VW, VH, rr } from '../core/constants.js';
import { G } from '../game/state.js';
import { BT } from '../game/buttons.js';
import { NET } from '../net/coop.js';
import { drawShopBackdrop } from './scene.js';

function card(c, y, h){
  c.fillStyle='rgba(20,10,4,0.5)'; rr(c,VW/2-282,y+5,564,h,22); c.fill();
  c.fillStyle='#f6ecd6'; rr(c,VW/2-284,y,564,h,22); c.fill();
  c.strokeStyle='#a8906a'; c.lineWidth=3; rr(c,VW/2-284,y,564,h,22); c.stroke();
}
function title(c, text, y){
  c.textAlign='center'; c.textBaseline='middle';
  c.fillStyle='#3a2216'; c.font='900 30px "Trebuchet MS", Verdana, sans-serif';
  c.fillText(text, VW/2, y);
}
function sub(c, text, y, color='#6a4a2e'){
  c.fillStyle=color; c.font='700 15px Verdana, sans-serif';
  c.textAlign='center'; c.textBaseline='middle';
  c.fillText(text, VW/2, y);
}
/* letter slots for code/name entry */
function slots(c, text, n, y, w=58){
  const gap=10, total=n*w+(n-1)*gap, x0=VW/2-total/2;
  for (let i=0;i<n;i++){
    const x=x0+i*(w+gap);
    c.fillStyle = i<text.length ? '#fff8ea' : 'rgba(0,0,0,0.08)';
    rr(c,x,y,w,64,10); c.fill();
    c.strokeStyle = i===text.length ? '#e0813a' : '#a8906a';
    c.lineWidth = i===text.length ? 3.5 : 2;
    rr(c,x,y,w,64,10); c.stroke();
    if (i<text.length){
      c.fillStyle='#3a2216'; c.font='900 38px Verdana, sans-serif';
      c.textAlign='center'; c.textBaseline='middle';
      c.fillText(text[i], x+w/2, y+34);
    }
  }
}

export function drawCoopMenu(c){
  drawShopBackdrop(c);
  card(c, 120, 400);
  title(c, '👫 Play Together!', 175);
  sub(c, 'Two baristas, one café — team up on the day\'s orders.', 215);
  BT.coopHostBtn.draw(c); BT.coopJoinBtn.draw(c); BT.coopBack.draw(c);
}

export function drawCoopHost(c){
  drawShopBackdrop(c);
  card(c, 100, 430);
  title(c, 'Your café code', 150);
  if (NET.code){
    slots(c, NET.code, 4, 195, 74);
    sub(c, 'Tell your friend the code — they tap "Join Game" and type it in.', 300);
    const dots = '.'.repeat(1 + Math.floor(G.time*2)%3);
    sub(c, 'Waiting for a friend'+dots, 340, '#c07a2a');
  } else {
    sub(c, 'Opening a room…', 240);
  }
  BT.coopBack.draw(c);
}

export function drawCoopJoin(c){
  drawShopBackdrop(c);
  card(c, 78, 460);
  title(c, 'Type the café code', 120);
  slots(c, NET.joinCode, 4, 150);
  if (NET.err) sub(c, NET.err, 242, '#c0392b');
  BT.keyGrid.draw(c);
  BT.coopGo.draw(c); BT.coopBack.draw(c);
}

export function drawCoopName(c){
  drawShopBackdrop(c);
  card(c, 78, 460);
  title(c, 'What\'s your barista name?', 120);
  slots(c, NET.name, 8, 150, 50);
  BT.keyGrid.draw(c);
  BT.coopDone.draw(c); BT.coopBack.draw(c);
}

export function drawCoopWait(c){
  drawShopBackdrop(c);
  card(c, 150, 320);
  title(c, 'You\'re in, '+NET.name+'! ☕', 210);
  const dots = '.'.repeat(1 + Math.floor(G.time*2)%3);
  sub(c, 'Waiting for '+(NET.partner ? NET.partner.name : 'the host')+' to open the shop'+dots, 260);
  BT.coopBack.draw(c);
}

export function drawHostLeft(c){
  drawShopBackdrop(c);
  card(c, 150, 320);
  title(c, 'Your friend\'s café closed ☕', 210);
  sub(c, 'The host left the room. Back to your own café!', 260);
  BT.hostLeftOk.draw(c);
}

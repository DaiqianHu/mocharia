/* ============================================================
   Button registry (BT), the per-state list of active buttons, and
   the per-frame refresh of enabled/label/selected/visible flags.
   ============================================================ */
import { VW } from '../core/constants.js';
import { isMuted } from '../core/audio.js';
import { Btn } from '../ui/button.js';
import { makeKeyGrid } from '../ui/keygrid.js';
import { PANEL_X, TABS_Y, STATIONS, STATION_LABEL } from './layout.js';
import { G, frontCustomer } from './state.js';
import { NET, inCoop } from '../net/coop.js';
import { EMOTES, emoteCooldown } from '../ui/stickers.js';
import { P, shopStock } from './progress.js';
import { RANKS } from './data.js';

export const BT = {};
BT.newGame  = new Btn(VW/2-110, 402, 220, 56, 'New Game', {color:'#2fa88e'});
BT.contGame = new Btn(VW/2-110, 468, 220, 46, 'Continue', {color:'#7a6ac0', small:true});
BT.start = new Btn(VW/2-100, 486, 200, 56, 'Open the Shop', {color:'#2fa88e'});
BT.next  = new Btn(VW/2-100, 508, 200, 50, 'Visit Shop', {color:'#2fa88e'});
BT.shopDone = new Btn(VW/2+90, 508, 220, 50, 'Start Next Day', {color:'#2fa88e'});
BT.cont  = new Btn(VW/2-90, 512, 180, 48, 'Continue', {color:'#2fa88e'});
BT.take  = new Btn(120, 470, 190, 52, 'Take Order', {color:'#e0813a'});
BT.serve = new Btn(PANEL_X+22, 476, 220, 50, 'Serve!', {color:'#d84a6b'});
BT.tabs = STATIONS.map((s,i)=> new Btn(14+i*172, TABS_Y, 160, 44, STATION_LABEL[s], {color:'#7a4a30'}));

// brew machine config strip (row 1: type · temp · add-in · amount 1-3)
BT.machType  = new Btn(58, 414, 156, 30, '', {color:'#5f6fc4', small:true});
BT.machTemp  = new Btn(222, 414, 76, 30, 'Hot', {color:'#c86b4a', small:true});
BT.machAddin = new Btn(306, 414, 156, 30, 'No Add-in', {color:'#8a5ab0', small:true});
BT.machAmt   = [0,1,2].map(i=> new Btn(492+i*44, 414, 38, 30, ''+(i+1), {color:'#8a6ac0', small:true}));
BT.machStart = new Btn(58, 452, 150, 48, 'Start', {color:'#e0813a'});
BT.machPour  = new Btn(218, 452, 190, 48, 'Pour into Cup', {color:'#2fa88e'});
BT.machDump  = new Btn(418, 452, 120, 48, 'Dump', {color:'#8a6a5a'});

BT.topClear      = new Btn(548, 496, 130, 36, 'Remove All', {color:'#8a6a5a', small:true});
// cup-size picker — the first choice at the topping station (cups drawn above in top.js)
export const SIZE_IDS = ['S','M','L'];
BT.sizeBtns = [['Small','#5f9fc4'],['Medium','#5f8fc4'],['Large','#5f7fc4']]
  .map(([lb,col],i)=> new Btn(160+i*180, 428, 120, 44, lb, {color:col}));
BT.cannoliScrape = new Btn(548, 496, 130, 36, 'Scrape Clean', {color:'#8a6a5a', small:true});

// co-op lobby
BT.coop        = new Btn(VW/2-110, 522, 220, 40, '👫 Play Together!', {color:'#c86b8a', small:true});
BT.coopHostBtn = new Btn(VW/2-110, 268, 220, 56, 'Host a Café', {color:'#2fa88e'});
BT.coopJoinBtn = new Btn(VW/2-110, 340, 220, 56, 'Join a Café', {color:'#5f6fc4'});
BT.coopBack    = new Btn(48, 530, 130, 42, '← Back', {color:'#8a6a5a', small:true});
BT.coopGo      = new Btn(VW-208, 530, 140, 42, 'Join! →', {color:'#2fa88e', small:true});
BT.coopDone    = new Btn(VW-208, 530, 140, 42, 'Done! →', {color:'#2fa88e', small:true});
BT.hostLeftOk  = new Btn(VW/2-90, 396, 180, 48, 'OK', {color:'#2fa88e'});
BT.keyGrid = makeKeyGrid();
if (typeof window !== 'undefined') window.KG = BT.keyGrid;   // test hook

// co-op emote tray — lives in the tab band's dead space (tabs end ≈690,
// mute starts at 906), identical on all four stations
BT.emotes = EMOTES.map((id, i)=> new Btn(700+i*40, TABS_Y+3, 36, 38, '', {color:'#6a4a8a', small:true}));

// sound toggle — lives in the bottom-right corner on every screen
BT.mute = new Btn(VW-54, TABS_Y+3, 42, 38, isMuted()?'🔇':'🔊', {color:'#5a4632', small:true});

// shop buy buttons — fixed slots, laid over the shop cards each frame
export const SHOP_COLS = 3, SHOP_CARD_W = 288, SHOP_CARD_H = 84;
export const shopCardPos = i => ({
  x: 34 + (i%SHOP_COLS)*(SHOP_CARD_W+12),
  y: 118 + Math.floor(i/SHOP_COLS)*(SHOP_CARD_H+10),
});
BT.shopBuy = Array.from({length:12}, (_,i)=>{
  const p = shopCardPos(i);
  return new Btn(p.x+SHOP_CARD_W-96, p.y+SHOP_CARD_H-38, 86, 30, 'Buy', {color:'#2fa88e', small:true});
});

export function activeButtons(){
  const list=[BT.mute];
  if (G.state==='title'){ list.push(BT.newGame, BT.coop); if (G.hasSave) list.push(BT.contGame); }
  else if (G.state==='coopMenu') list.push(BT.coopHostBtn, BT.coopJoinBtn, BT.coopBack);
  else if (G.state==='coopHost') list.push(BT.coopBack);
  else if (G.state==='coopHostName') list.push(...BT.keyGrid.btns, BT.coopDone, BT.coopBack);
  else if (G.state==='coopJoin') list.push(...BT.keyGrid.btns, BT.coopGo, BT.coopBack);
  else if (G.state==='coopName') list.push(...BT.keyGrid.btns, BT.coopDone, BT.coopBack);
  else if (G.state==='coopWait') list.push(BT.coopBack);
  else if (G.state==='hostLeft') list.push(BT.hostLeftOk);
  // co-op guests never drive the day cycle or spend the host's money —
  // the flow buttons belong to the host alone
  else if (G.state==='dayIntro'){ if (NET.role!=='guest') list.push(BT.start); }
  else if (G.state==='summary'){ if (NET.role!=='guest') list.push(BT.next); }
  else if (G.state==='shop'){ if (NET.role!=='guest') list.push(BT.shopDone, ...BT.shopBuy.filter(b=>b.visible)); }
  else if (G.state==='play'){
    // emote tray for both players — even over the result card, so they
    // can cheer (or tease) each other's stars
    if (G.result){ list.push(BT.cont); if (inCoop()) list.push(...BT.emotes); return list; }
    if (inCoop()) list.push(...BT.emotes);
    list.push(...BT.tabs);
    if (G.station==='order') list.push(BT.take);
    else if (G.station==='brew') list.push(BT.machType, BT.machTemp, BT.machAddin, ...BT.machAmt, BT.machStart, BT.machPour, BT.machDump);
    else if (G.station==='top'){
      if (G.active && !G.active.cupSize) list.push(...BT.sizeBtns);
      else list.push(BT.topClear);
    }
    else if (G.station==='cannoli') list.push(BT.cannoliScrape);
    if (G.station!=='order') list.push(BT.serve);
  }
  return list;
}

export function refreshButtonState(){
  const t = G.active;
  BT.coopGo.enabled = NET.joinCode.length===4;
  BT.coopDone.enabled = NET.name.length>=1;
  const eReady = emoteCooldown()<=0;
  for (const b of BT.emotes) b.enabled = eReady;
  BT.take.enabled = !!frontCustomer() && G.tickets.length<7;
  BT.take.pulse = BT.take.enabled ? 1 : 0;
  BT.contGame.label = 'Continue — Day '+P.day+' ('+RANKS[P.rank].name+')';

  // machine strip follows the selected machine
  const m = G.machines[G.selMachine];
  if (m){
    const idle = m.state==='idle';
    BT.machType.label = m.type.name;
    BT.machType.enabled = idle;
    BT.machTemp.label = m.kind==='coffee' ? (m.temp==='hot'?'Hot':'Iced') : (m.temp==='hot'?'Hot':'Cold');
    BT.machTemp.enabled = idle;
    BT.machAddin.label = m.addin ? m.addin.name : 'No Add-in';
    BT.machAddin.enabled = idle;
    for (let i=0;i<3;i++){
      BT.machAmt[i].enabled = idle;
      BT.machAmt[i].selected = (m.amt===i+1);
    }
    BT.machStart.enabled = idle;
    BT.machStart.label = m.state==='run' ? 'Brewing…' : 'Start';
    const slot = m.kind==='coffee' ? 'coffee' : 'milk';
    BT.machPour.enabled = m.state==='done' && !!t && !t.cup[slot];
    BT.machPour.pulse = BT.machPour.enabled ? 1 : 0;
    BT.machDump.enabled = m.state!=='idle';
  }

  if (t){
    BT.topClear.enabled = t.top.whip.blobs.length>0 || !!t.top.drizzle || !!t.top.sprinkles;
    BT.cannoliScrape.enabled = !!t.cannoli && !!t.cannoli.cream;
    BT.serve.enabled = t.ready();
    BT.serve.pulse = t.ready() ? 1 : 0;
  } else {
    BT.topClear.enabled=false; BT.cannoliScrape.enabled=false;
    BT.serve.enabled=false;
    BT.machPour.enabled=false;
  }
  for (let i=0;i<STATIONS.length;i++) BT.tabs[i].selected = (G.station===STATIONS[i]);

  if (G.state==='shop'){
    const stock = shopStock(G.day);
    for (let i=0;i<BT.shopBuy.length;i++){
      const b=BT.shopBuy[i], it=stock[i];
      b.visible = !!it;
      if (it){
        b.label = '$'+it.price;
        b.enabled = G.money >= it.price;
      }
    }
  }
}

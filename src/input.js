/* ============================================================
   Input handler — pointer routing for buttons, ticket-rail
   selection, machine selection, and grabbing topping/cream
   containers. Wires the DOM pointer events at module load.
   ============================================================ */
import { audioCtx, blip, ding, chaChing } from './core/audio.js';
import { canvas, toVirtual } from './core/canvas.js';
import { spawnParticle, popText, confettiBurst } from './core/particles.js';
import { STATIONS, RAIL_H } from './game/layout.js';
import { G, frontCustomer, startDay, serveActive, startMachine, dumpMachine, pourMachine, unlockedNow } from './game/state.js';
import { BT, activeButtons } from './game/buttons.js';
import { P, saveProgress, resetProgress, shopStock, checkHolidayComplete } from './game/progress.js';
import { HOLIDAYS } from './game/data.js';
import { takeOrder } from './stations/order.js';
import { machineRect } from './stations/brew.js';
import { shelfHit, clearToppings } from './stations/top.js';
import { cannoliShelfHit, scrapeCannoli } from './stations/cannoli.js';
import { VW } from './core/constants.js';

function cycleMachineType(m){
  const u = unlockedNow();
  const list = m.kind==='coffee' ? u.coffees : u.milks;
  const i = list.findIndex(x=>x.id===m.type.id);
  m.type = list[(i+1) % list.length] || list[0];
}

function buyItem(it){
  if (!it || G.money < it.price) return;
  G.money -= it.price;
  P.owned[it.id] = true;
  P.money = G.money;
  chaChing();
  popText(VW/2, 110, it.name+' — yours!', '#8fe0a8', 18);
  if (it.holiday){
    const hol = HOLIDAYS.find(h=>h.id===it.holiday);
    if (checkHolidayComplete(hol)){
      G.holidayJustDone = hol.name;
      confettiBurst(VW/2, 240, 120);
      ding();
    }
  }
  saveProgress();
}

function pointerDown(x,y){
  audioCtx(); // unlock audio on first gesture
  G.pointer.x=x; G.pointer.y=y; G.pointer.down=true;

  const btns = activeButtons();
  for (const b of btns){
    if (b.enabled && b.contains(x,y)){
      b.press();
      if (b===BT.newGame){
        resetProgress();
        G.day=1; G.money=0; G.introT=0; G.hasSave=true; G.state='dayIntro'; return;
      }
      if (b===BT.contGame){
        G.day=P.day; G.money=P.money; G.best=P.best||0;
        G.introT=0; G.state='dayIntro'; return;
      }
      if (b===BT.start){ startDay(); return; }
      if (b===BT.next){ G.holidayJustDone=null; G.state='shop'; return; }
      if (b===BT.shopDone){
        G.day++; P.day=G.day; P.money=G.money; saveProgress();
        G.holidayJustDone=null; G.introT=0; G.state='dayIntro'; return;
      }
      if (b===BT.cont){ G.result=null; return; }
      const ti = BT.tabs.indexOf(b);
      if (ti>=0){ G.station=STATIONS[ti]; G.drag=null; return; }
      if (b===BT.take){ takeOrder(); return; }
      // machine config
      const m = G.machines[G.selMachine];
      if (b===BT.machType){ cycleMachineType(m); blip(560,0.06,'triangle',0.1); return; }
      if (b===BT.machTemp){
        m.temp = m.temp==='hot' ? (m.kind==='coffee'?'iced':'cold') : 'hot';
        blip(480,0.06,'triangle',0.1); return;
      }
      const ai = BT.machAmt.indexOf(b);
      if (ai>=0){ m.amt = ai+1; blip(520+ai*80,0.06,'triangle',0.1); return; }
      if (b===BT.machStart){ startMachine(m); return; }
      if (b===BT.machPour){ pourMachine(m); return; }
      if (b===BT.machDump){ dumpMachine(m); return; }
      if (b===BT.topClear){ clearToppings(); return; }
      if (b===BT.cannoliScrape){ scrapeCannoli(); return; }
      if (b===BT.serve){ serveActive(); return; }
      const si = BT.shopBuy.indexOf(b);
      if (si>=0){ buyItem(shopStock(G.day)[si]); return; }
      return;
    } else if (b.contains(x,y)){
      b.press(); // disabled thunk
      if (b===BT.serve && G.active && !G.active.ready())
        popText(x, y-26, 'Drink not finished!', '#ffb08a', 15);
      if (b===BT.machPour && G.active){
        const m = G.machines[G.selMachine];
        if (m.state!=='done') popText(x, y-26, 'Nothing brewed yet!', '#ffb08a', 14);
      }
      const si = BT.shopBuy.indexOf(b);
      if (si>=0) popText(x, y-26, 'Not enough money!', '#ffb08a', 14);
      return;
    }
  }
  if (G.state!=='play' || G.result) return;

  // ticket rail selection
  if (y<RAIL_H){
    for (const t of G.tickets){
      if (x>=t.x && x<=t.x+118 && y>=8 && y<=90){
        G.active=t; blip(700,0.06,'sine',0.1);
        spawnParticle({type:'ring',x:t.x+59,y:49,size:20,color:'#ffd98a',life:0.4});
        return;
      }
    }
    return;
  }
  // order station: tap the front customer directly
  if (G.station==='order'){
    const f=frontCustomer();
    if (f && Math.hypot(x-f.x, y-(f.y-10))<58){ takeOrder(); return; }
  }
  // brew station: tap a machine to select it
  if (G.station==='brew'){
    for (let i=0;i<G.machines.length;i++){
      const r=machineRect(G.machines[i]);
      if (x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h){
        G.selMachine=i; blip(660,0.05,'sine',0.09); return;
      }
    }
  }
  // topping station: grab a container off the shelf
  if (G.station==='top' && G.active){
    const s = shelfHit(x,y);
    if (s){ G.drag=s; blip(600,0.05,'triangle',0.09); return; }
  }
  // cannoli station: grab a cream bag or sprinkle cup
  if (G.station==='cannoli' && G.active && G.active.cannoli){
    const s = cannoliShelfHit(x,y);
    if (s){ G.drag=s; blip(600,0.05,'triangle',0.09); return; }
  }
}

function pointerMove(x,y){ G.pointer.x=x; G.pointer.y=y; }
function pointerUp(){
  G.pointer.down=false;
  G.drag=null;
}

canvas.addEventListener('pointerdown', e=>{
  e.preventDefault();
  const v=toVirtual(e.clientX,e.clientY);
  pointerDown(v.x,v.y);
});
canvas.addEventListener('pointermove', e=>{
  const v=toVirtual(e.clientX,e.clientY);
  pointerMove(v.x,v.y);
});
window.addEventListener('pointerup', pointerUp);
window.addEventListener('pointercancel', pointerUp);
canvas.addEventListener('pointerleave', ()=>{ G.drag=null; });
window.addEventListener('blur', pointerUp);
canvas.addEventListener('contextmenu', e=>e.preventDefault());

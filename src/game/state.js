/* ============================================================
   State controller — the central game state object `G`, day
   lifecycle, customer/ticket bookkeeping, serving, and the master
   per-frame update() that drives every subsystem.
   States: title -> dayIntro -> play -> summary -> shop -> dayIntro
   ============================================================ */
import { VW, clamp, rand } from '../core/constants.js';
import { updateParticles, updateAmbient, spawnParticle, confettiBurst, popText } from '../core/particles.js';
import { blip, ding, chaChing, starChime, fanfare, pour } from '../core/audio.js';
import { MACHINES } from './layout.js';
import { COFFEE_TIME, MILK_TIME, customersForDay } from './data.js';
import { Customer } from './customer.js';
import { brewScore, topScore, cannoliScore, orderScore, xpFor } from './scoring.js';
import { activeButtons, refreshButtonState } from './buttons.js';
import { updateTop } from '../stations/top.js';
import { updateCannoli } from '../stations/cannoli.js';
import { P, unlockedItems, patienceCalm, brewSpeed, owns, applyRankUps, saveProgress, activeHoliday } from './progress.js';
import { RANKS } from './data.js';

export const G = {
  state:'title', station:'order',
  time:0, day:1, money:0,
  customers:[], tickets:[], active:null,
  spawn:{ left:0, total:0, timer:0 },
  served:[],                       // day results
  result:null,                     // serve overlay data
  shake:0, shakeX:0, shakeY:0,
  pointer:{x:-99,y:-99,down:false},
  machines:[],                     // brew station machine line
  selMachine:0,
  drag:null,                       // topping/cream cup being dragged
  cream:null,                      // selected cannoli cream (catalog item)
  dayXp:0, rankRes:null,           // xp earned today / rank-up info
  stationAvg:null,                 // day-end per-station ratings
  holidayJustDone:null,
  dayEndT:0, introT:0, titleT:0, summaryT:0,
  best:0,
};

export function unlockedNow(){ return unlockedItems(G.day); }

export function resetMachines(){
  const u = unlockedNow();
  G.machines = MACHINES.map(m=>({
    ...m,
    type: m.kind==='coffee' ? u.coffees[0] : u.milks[0],
    temp: 'hot', amt: 1, addin: null,
    state:'idle', t:0, total:0,
  }));
  G.selMachine = 0;
}

export function startDay(){
  G.customers.length=0; G.tickets.length=0; G.active=null;
  G.served.length=0; G.result=null;
  G.spawn.total = customersForDay(G.day);
  G.spawn.left = G.spawn.total;
  G.spawn.timer = 1.2;
  G.station='order'; G.drag=null; G.cream=null;
  G.dayXp=0; G.rankRes=null; G.stationAvg=null; G.dayEndT=0;
  resetMachines();
  G.state='play';
}

export function queueCustomers(){ return G.customers.filter(c=>c.state==='queue'||c.state==='enter'); }
export function frontCustomer(){
  const q = G.customers.filter(c=>c.state==='queue');
  return q.length ? q[0] : null;
}
export function layoutCustomers(){
  const q = queueCustomers();
  for (let i=0;i<q.length;i++){ q[i].tx = 210 + i*95; q[i].ty = 388; }
  const w = G.customers.filter(c=>c.state==='waiting');
  for (let i=0;i<w.length;i++){ w[i].tx = 828 - (i%3)*88; w[i].ty = 320 + Math.floor(i/3)*4; }
}
export function layoutTickets(){
  for (let i=0;i<G.tickets.length;i++){
    G.tickets[i].slot = 12 + i*128;
  }
}

export function serveActive(){
  const t = G.active;
  if (!t || !t.ready() || G.result) return;
  const o = t.order;
  const os = orderScore(t);
  const bs = brewScore(t);
  const ts = topScore(t);
  const cs = cannoliScore(t);            // null if no cannoli ordered
  const parts = [bs, ts]; if (cs!==null) parts.push(cs);
  const total = parts.reduce((a,b)=>a+b,0)/parts.length;
  const pat = clamp(t.cust.patience,0,1);
  const tip = o.price * (total/100) * (0.25 + 0.75*pat);
  const earn = o.price + tip;
  const stars = total>=90?5 : total>=75?4 : total>=58?3 : total>=38?2 : 1;
  const xp = xpFor(total, o);
  G.money += earn;
  G.dayXp += xp; P.xp += xp;
  G.served.push({ name:t.cust.name, stars, earn, total, os, bs, ts, cs });
  G.result = { ticket:t, os, bs, ts, cs, total, tip, price:o.price, stars, xp,
               t:0, starsShown:0, custName:t.cust.name, mood: total>=58?'happy':'angry' };
  t.cust.state='served';
  t.cust.mood = total>=58 ? 'happy':'angry';
  t.cust.patience = 1;                   // stop the stomping on the way out
  t.cust.reaction = 0.8;
  t.cust.tx = VW+90;
  const idx = G.tickets.indexOf(t);
  if (idx>=0) G.tickets.splice(idx,1);
  G.active = G.tickets.length ? G.tickets[0] : null;
  layoutTickets();
  if (total>=88){ confettiBurst(480,260,80); ding(); }
  chaChing();
  G.shake = Math.max(G.shake, total>=88?5:2);
}

function endDay(){
  // per-station day ratings (each capped at 100%)
  const avg = (key)=>{
    const vals = G.served.map(s=>s[key]).filter(v=>v!==null && v!==undefined);
    return vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : null;
  };
  G.stationAvg = { order:avg('os'), brew:avg('bs'), top:avg('ts'), cannoli:avg('cs') };
  // rank-ups earned from today's XP
  const before = P.rank;
  const ups = applyRankUps();
  G.rankRes = ups>0 ? { ups, from:RANKS[before].name, to:RANKS[P.rank].name, rank:P.rank } : null;
  if (G.rankRes){ fanfare(); confettiBurst(VW/2, 190, 110); }
  const dayEarn = G.served.reduce((a,s)=>a+s.earn,0);
  if (dayEarn>G.best) G.best=dayEarn;
  P.day = G.day; P.money = G.money; P.best = G.best;
  saveProgress();
  G.summaryT=0; G.state='summary';
}

export function update(dt){
  G.time += dt;
  updateParticles(dt);
  // holiday weather (snow / petals / confetti…) drifts over play + day intro
  updateAmbient(dt, (G.state==='play' || G.state==='dayIntro') ? currentHoliday() : null);
  if (G.shake>0){
    G.shake = Math.max(0, G.shake - dt*22);
    G.shakeX = rand(-G.shake,G.shake); G.shakeY = rand(-G.shake,G.shake);
  } else { G.shakeX=G.shakeY=0; }

  const p = G.pointer;
  for (const b of activeButtons()) b.update(dt,p.x,p.y);

  if (G.state==='title'){
    G.titleT += dt;
    if (Math.random()<dt*4)
      spawnParticle({type:'steam', x:VW/2+rand(-16,16), y:238, vy:rand(-30,-60),
        size:rand(5,10), color:'rgba(255,246,230,0.55)', life:rand(1.2,2), sway:22, alpha:0.55});
    return;
  }
  if (G.state==='dayIntro'){ G.introT += dt; return; }
  if (G.state==='summary'){ G.summaryT += dt; return; }
  if (G.state==='shop'){ refreshButtonState(); return; }
  if (G.state!=='play') return;

  // machines keep brewing even inside the result overlay
  updateMachines(dt);

  if (G.result){
    const r = G.result; r.t += dt;
    // stars pop in one at a time with a chime (drawResult reads starsShown)
    const shown = clamp(Math.floor((r.t - 0.45)/0.18)+1, 0, r.stars);
    if (shown > r.starsShown){ r.starsShown = shown; starChime(shown); }
    refreshButtonState(); return;
  }

  // spawning
  if (G.spawn.left>0){
    G.spawn.timer -= dt;
    if (G.spawn.timer<=0 && queueCustomers().length<5){
      G.spawn.left--;
      const c = new Customer(G.day, unlockedNow(), patienceCalm());
      G.customers.push(c);
      const base = clamp(11 - G.day*0.8, 4.5, 11);
      G.spawn.timer = base*rand(0.7,1.3);
      layoutCustomers();
      if (owns('doorbell')){
        ding();
        if (G.station!=='order') popText(130, 130, '🔔 New customer!', '#ffd98a', 16);
      } else {
        blip(880,0.07,'sine',0.08); setTimeout(()=>blip(660,0.09,'sine',0.08),90);
      }
    }
  }
  layoutCustomers();
  for (const c of G.customers) c.update(dt,G);
  for (let i=G.customers.length-1;i>=0;i--)
    if (G.customers[i].doneT>0.5) G.customers.splice(i,1);

  // tickets slide
  layoutTickets();
  for (const t of G.tickets){
    t.x += (t.slot-t.x)*Math.min(1,dt*7);
    t.flash = Math.max(0,t.flash-dt*1.4);
  }

  updateTop(dt);
  updateCannoli(dt);
  refreshButtonState();

  // day over?
  const busy = G.spawn.left>0 || G.customers.length>0 || G.tickets.length>0;
  if (!busy){
    G.dayEndT += dt;
    if (G.dayEndT>1.1) endDay();
  } else G.dayEndT=0;
}

function updateMachines(dt){
  for (const m of G.machines){
    if (m.state!=='run') continue;
    m.t += dt;
    // drips / steam while working
    if (Math.random()<dt*14){
      const cx = m.x+m.w/2;
      if (m.kind==='coffee')
        spawnParticle({type:'drop', x:cx+rand(-4,4), y:262, vy:rand(120,200), g:300,
          size:rand(2,3.2), color:'#5a3220', life:0.4, alpha:0.9});
      else
        spawnParticle({type:'steam', x:cx+rand(-10,10), y:220, vy:rand(-30,-60),
          size:rand(3,7), color:'rgba(255,255,255,0.7)', life:rand(0.5,1), sway:16, alpha:0.6});
    }
    if (m.t >= m.total){
      m.t = m.total; m.state='done';
      if (owns('alarm')){
        ding();
        popText(m.x+m.w/2, 140, (m.kind==='coffee'?'Coffee':'Milk')+' ready!', '#8fe0a8', 15);
      } else if (G.station==='brew'){
        blip(720,0.1,'sine',0.1);
      }
    }
  }
}

export function startMachine(m){
  if (m.state==='run') return;
  const base = m.kind==='coffee' ? COFFEE_TIME(m.amt) : MILK_TIME(m.amt);
  m.total = base * brewSpeed(m.kind);
  m.t = 0;
  m.state='run';
  blip(500,0.1,'triangle',0.1,120);
}
export function dumpMachine(m){
  m.state='idle'; m.t=0;
  blip(300,0.09,'triangle',0.08);
}
export function pourMachine(m){
  const t = G.active;
  if (!t || m.state!=='done') return;
  const slot = m.kind==='coffee' ? 'coffee' : 'milk';
  if (t.cup[slot]){ popText(m.x+m.w/2, 150, 'Cup already has '+slot+'!', '#ffb08a', 14); return; }
  t.cup[slot] = { type:m.type, temp:m.temp, amt:m.amt, addin:m.addin };
  m.state='idle'; m.t=0;
  popText(m.x+m.w/2, 150, 'Poured!', '#8fe0a8', 16);
  pour(0.5);
  blip(640,0.1,'sine',0.12,180);
}

export function currentHoliday(){ return activeHoliday(G.day); }

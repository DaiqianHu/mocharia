/* ============================================================
   State controller — the central game state object `G`, day
   lifecycle, customer/ticket bookkeeping, serving, and the master
   per-frame update() that drives every subsystem.
   States: title -> dayIntro -> play -> summary -> shop -> dayIntro
   ============================================================ */
import { VW, clamp, rand } from '../core/constants.js';
import { updateParticles, updateAmbient, spawnParticle, confettiBurst, popText } from '../core/particles.js';
import { blip, ding, chaChing, starChime, fanfare, pour, rushHorn, purr } from '../core/audio.js';
import { catHearts, catScreen } from '../render/cat.js';
import { MACHINES } from './layout.js';
import { COFFEE_TIME, MILK_TIME, customersForDay } from './data.js';
import { Customer } from './customer.js';
import { brewScore, topScore, cannoliScore, orderScore, xpFor } from './scoring.js';
import { activeButtons, refreshButtonState } from './buttons.js';
import { updateTop } from '../stations/top.js';
import { updateCannoli } from '../stations/cannoli.js';
import { machineHudAnchor } from '../stations/brew.js';
import { P, unlockedItems, patienceCalm, brewSpeed, owns, applyRankUps, saveProgress, activeHoliday } from './progress.js';
import { RANKS } from './data.js';

export const G = {
  state:'title', station:'order',
  time:0, day:1, money:0,
  customers:[], tickets:[], active:null,
  spawn:{ left:0, total:0, timer:0 },
  dayT:0,                          // seconds since the day opened
  rush:null,                       // rush-hour plan (planRush), null before day 3
  streak:{ n:0 },                  // consecutive 3★+ serves (tip combo)
  cat:{ petT:0, calmT:0 },         // Mocha the café cat (pet anim / calm cooldown)
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
  p2:null,                         // co-op guest shadow context (makeShadowCtx); null in single-player
};

/* A player context: G itself satisfies this contract for the local
   player (active/drag/pointer/station/selMachine/streak). In co-op the
   HOST tracks the guest through this shadow context — the sim functions
   below take `ctx = G` so single-player never touches any of it.
   `ray` is the guest's own-camera raycast result (sent over the wire);
   `remote` suppresses pointer-space particles/popTexts on the host. */
export function makeShadowCtx(name){
  return { active:null, drag:null, pointer:{x:-99,y:-99,down:false},
           station:'order', selMachine:0, ray:null, remote:true, name,
           streak:{ n:0 }, emitAcc:0 };
}

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
  G.dayT=0; G.streak.n=0;
  G.rush = G.day>=3 ? planRush(G.day) : null;
  resetMachines();
  G.state='play';
}

/* rush-hour windows: one mid-morning wave, a second on later days */
function planRush(day){
  const at = [rand(24,34)];
  if (day>=6) at.push(rand(66,84));
  return { at, idx:0, warn:0, active:false, t:0 };
}

const RUSH_LEN = 18;
function updateRush(dt){
  const r = G.rush; if (!r) return;
  if (r.active){
    r.t -= dt;
    if (r.t<=0){
      r.active=false;
      popText(VW/2, 170, 'Rush survived! ☕', '#ffd24a', 20);
    }
    return;
  }
  if (r.idx >= r.at.length) return;
  const next = r.at[r.idx];
  if (G.dayT >= next){
    r.idx++; r.warn=0; r.active=true; r.t=RUSH_LEN;
    G.spawn.left += 2;                         // the wave itself
    G.spawn.timer = Math.min(G.spawn.timer, 0.6);
    rushHorn();
    G.shake = Math.max(G.shake, 3);
  } else if (G.dayT >= next-3){
    if (r.warn<=0) blip(660,0.12,'triangle',0.1);
    r.warn = next - G.dayT;
  }
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

let _rid = 0;   // result serial, so the co-op guest can spot a NEW result card

export function onTicketRemoved(t){
  if (G.active===t) G.active = G.tickets.length ? G.tickets[0] : null;
  if (G.p2 && G.p2.active===t) G.p2.active = G.tickets.length ? G.tickets[0] : null;
}

export function serveActive(ctx=G){
  const t = ctx.active;
  if (!t || !t.ready() || G.result || !G.tickets.includes(t)) return;
  const o = t.order;
  const os = orderScore(t);
  const bs = brewScore(t);
  const ts = topScore(t);
  const cs = cannoliScore(t);            // null if no cannoli ordered
  const parts = [bs, ts]; if (cs!==null) parts.push(cs);
  const total = parts.reduce((a,b)=>a+b,0)/parts.length;
  const pat = clamp(t.cust.patience,0,1);
  const stars = total>=90?5 : total>=75?4 : total>=58?3 : total>=38?2 : 1;
  // streak of 3★+ serves builds a tip combo; only a rough serve breaks it
  const sk = ctx.streak;
  if (stars>=3){
    sk.n++;
    if (sk.n>=2){
      popText(VW/2, 190, 'COMBO x'+sk.n+'!', '#ffd24a', Math.min(34, 16+sk.n*3));
      starChime(Math.min(5, sk.n));
      if (sk.n>=4) confettiBurst(VW/2, 230, sk.n>=6?90:40);
      if (sk.n>=6) G.shake = Math.max(G.shake, 4);
    }
  } else {
    if (sk.n>=2) popText(VW/2, 190, 'Streak reset — you got this!', '#ffc9a0', 15);
    sk.n=0;
  }
  let tip = o.price * (total/100) * (0.25 + 0.75*pat);
  tip *= 1 + 0.1*Math.min(5, sk.n);
  if (G.rush && G.rush.active){
    tip *= 1.5;
    popText(VW/2, 214, 'RUSH BONUS! +50% tip', '#ffb24a', 15);
  }
  // skill-minigame bonus (perfect pours + gold-pulse piping), bonus-only
  const skillFrac = (t.bonus ? t.bonus.pour : 0) + (t.cannoli ? (t.cannoli.pipeBonus||0) : 0);
  const skill = o.price * skillFrac;
  tip += skill;
  const earn = o.price + tip;
  const xp = xpFor(total, o);
  G.money += earn;
  G.dayXp += xp; P.xp += xp;
  G.served.push({ name:t.cust.name, stars, earn, total, os, bs, ts, cs });
  G.result = { rid: ++_rid, ticket:t, os, bs, ts, cs, total, tip, price:o.price, stars, xp, skill,
               t:0, starsShown:0, custName:t.cust.name, mood: total>=58?'happy':'angry' };
  t.cust.state='served';
  t.cust.mood = total>=58 ? 'happy':'angry';
  t.cust.patience = 1;                   // stop the stomping on the way out
  t.cust.reaction = 0.8;
  t.cust.tx = VW+90;
  const idx = G.tickets.indexOf(t);
  if (idx>=0) G.tickets.splice(idx,1);
  onTicketRemoved(t);
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
  if (G.cat.petT>0) G.cat.petT -= dt;
  if (G.cat.calmT>0) G.cat.calmT -= dt;

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
  if (G.state.startsWith('coop') || G.state==='hostLeft'){ refreshButtonState(); return; }
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

  G.dayT += dt;
  updateRush(dt);

  // spawning
  if (G.spawn.left>0){
    G.spawn.timer -= dt;
    if (G.spawn.timer<=0 && queueCustomers().length<5){
      G.spawn.left--;
      const c = new Customer(G.day, unlockedNow(), patienceCalm());
      G.customers.push(c);
      const base = clamp(11 - G.day*0.8, 4.5, 11) * (G.rush && G.rush.active ? 0.45 : 1);
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
  if (G.p2){ updateTop(dt, G.p2); updateCannoli(dt, G.p2); }
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
    // (pour stream + steam are 3D now — stations/brew.js updateBrew3D)
    if (m.t >= m.total){
      m.t = m.total; m.state='done';
      m.doneAt = G.time;               // starts the pour-timing marker
      if (owns('alarm')){
        ding();
        const a = machineHudAnchor(G.machines.indexOf(m), 250);
        if (a) popText(a.x, a.y, (m.kind==='coffee'?'Coffee':'Milk')+' ready!', '#8fe0a8', 15);
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
/* pour-timing minigame: while a machine is done, a marker bounces on a
   small bar over it (drawMachineHUD); pouring while it crosses the gold
   center is a "perfect pour" — bonus-only, a miss is a normal pour. */
export const MARKER_SPEED = 3.2, MARKER_GOLD = 0.25;
export function machineMarker(m){ return Math.sin((G.time - (m.doneAt||0))*MARKER_SPEED); }
export function machineMarkerGold(m){
  return m.state==='done' && Math.abs(machineMarker(m)) < MARKER_GOLD;
}

export function pourMachine(m, ctx=G, perfect=false){
  const t = ctx.active;
  if (!t || m.state!=='done') return;
  const slot = m.kind==='coffee' ? 'coffee' : 'milk';
  const a = machineHudAnchor(G.machines.indexOf(m), 250) || { x:m.x+m.w/2, y:150 };
  if (t.cup[slot]){ popText(a.x, a.y, 'Cup already has '+slot+'!', '#ffb08a', 14); return; }
  t.cup[slot] = { type:m.type, temp:m.temp, amt:m.amt, addin:m.addin };
  m.state='idle'; m.t=0;
  if (perfect){
    t.bonus.pour += 0.12;
    popText(a.x, a.y-20, 'PERFECT POUR! ⭐', '#ffd24a', 16);
    starChime(5);
    confettiBurst(a.x, a.y, 18);
  }
  popText(a.x, a.y, 'Poured!', '#8fe0a8', 16);
  pour(0.5);
  blip(640,0.1,'sine',0.12,180);
}

/* pet Mocha the café cat: always purr + hearts; every 8s the whole
   queue also calms a little (patience nudge — never a penalty) */
export function petCat(){
  G.cat.petT = 1.6;
  purr();
  catHearts();
  const a = catScreen();
  if (a) popText(a.x, a.y, 'purrrr~', '#ffb6c9', 16);
  if (G.cat.calmT<=0){
    G.cat.calmT = 8;
    let calmed = false;
    for (const cust of G.customers)
      if (cust.state==='queue' || cust.state==='waiting'){
        cust.patience = Math.min(1, cust.patience + 0.15);
        calmed = true;
      }
    if (calmed && a) popText(a.x, a.y-24, 'Everyone loves Mocha!', '#8fe0a8', 14);
  }
}

export function currentHoliday(){ return activeHoliday(G.day); }

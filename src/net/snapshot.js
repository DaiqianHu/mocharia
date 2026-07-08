/* ============================================================
   Co-op snapshot codec. The HOST runs the whole sim and encodes G
   ~10x/s; the GUEST runs no game sim — applySnapshot merges the
   wire state into its G by id, keeping object identity (existing
   Customer/Ticket instances are updated in place; new ones are
   revived onto the class prototypes WITHOUT running constructors,
   which would burn id counters and roll fresh random orders).

   Catalog items (data.js) are identical static objects on both
   clients, so they travel as 'kind:id' ref strings and deref back
   to the SAME module objects — every `item.id === order.x.id`
   comparison and color read on the guest works verbatim. Kind is
   mandatory: ids collide across catalogs ('caramel' is a cream AND
   a drizzle).
   ============================================================ */
import { COFFEES, MILKS, CREAMS, DRIZZLES, SPRINKLE_SETS, ADDINS, SHELLS } from '../game/data.js';
import { Ticket } from '../game/ticket.js';
import { Customer } from '../game/customer.js';
import { G, layoutTickets } from '../game/state.js';
import { P } from '../game/progress.js';

const CATS = { coffee:COFFEES, milk:MILKS, cream:CREAMS, drizzle:DRIZZLES,
               sprinkles:SPRINKLE_SETS, addin:ADDINS, shell:SHELLS };
const byRef = new Map();
for (const [kind, list] of Object.entries(CATS))
  for (const it of list) byRef.set(kind+':'+it.id, it);

export const ref   = (kind, it) => it ? kind+':'+it.id : null;
export const deref = r => r ? (byRef.get(r) || null) : null;

/* the shelf-drag categories map onto catalog kinds */
export const DRAG_KIND = { drizzle:'drizzle', sprinkles:'sprinkles',
                           endsprinkles:'sprinkles', cream:'cream', shell:'shell' };

/* ---- encode (host) ---- */

function encOrder(o){
  return { coffee:ref('coffee',o.coffee), shots:o.shots, coffeeTemp:o.coffeeTemp,
    milk:ref('milk',o.milk), milkAmt:o.milkAmt, milkTemp:o.milkTemp,
    coffeeAdd:ref('addin',o.coffeeAdd), milkAdd:ref('addin',o.milkAdd),
    whip:o.whip, drizzle:ref('drizzle',o.drizzle), sprinkles:ref('sprinkles',o.sprinkles),
    cannoli: o.cannoli ? { shell:ref('shell',o.cannoli.shell), cream:ref('cream',o.cannoli.cream),
                           sprinkles:ref('sprinkles',o.cannoli.sprinkles) } : null,
    size:o.size, name:o.name, price:o.price };
}
function decOrder(s){
  return { coffee:deref(s.coffee), shots:s.shots, coffeeTemp:s.coffeeTemp,
    milk:deref(s.milk), milkAmt:s.milkAmt, milkTemp:s.milkTemp,
    coffeeAdd:deref(s.coffeeAdd), milkAdd:deref(s.milkAdd),
    whip:s.whip, drizzle:deref(s.drizzle), sprinkles:deref(s.sprinkles),
    cannoli: s.cannoli ? { shell:deref(s.cannoli.shell), cream:deref(s.cannoli.cream),
                           sprinkles:deref(s.cannoli.sprinkles) } : null,
    size:s.size, name:s.name, price:s.price };
}

const encCupSlot = (c, kind) => c ? { type:ref(kind, c.type),
                              temp:c.temp, amt:c.amt, addin:ref('addin',c.addin) } : null;
const decCupSlot = s => s ? { type:deref(s.type), temp:s.temp, amt:s.amt, addin:deref(s.addin) } : null;

export function encodeSnapshot(seq){
  return { t:'snap', seq,
    st: G.state, day: G.day, money: G.money, time: G.time,
    spawn: { left: G.spawn.left, total: G.spawn.total },
    rush: G.rush, streaks: { host: G.streak.n, guest: G.p2 ? G.p2.streak.n : 0 },
    cat: { petT: G.cat.petT, calmT: G.cat.calmT },
    holidayJustDone: G.holidayJustDone,
    customers: G.customers.map(c => ({ id:c.id, name:c.name, state:c.state,
      x:c.x, y:c.y, tx:c.tx, ty:c.ty, patience:c.patience, mood:c.mood,
      reaction:c.reaction, doneT:c.doneT, skin:c.skin, shirt:c.shirt,
      pants:c.pants, hairC:c.hairC, hairStyle:c.hairStyle, glasses:c.glasses,
      bobPhase:c.bobPhase, order: encOrder(c.order) })),
    tickets: G.tickets.map(t => ({ id:t.id, custId:t.cust.id, slot:t.slot,
      cupSize:t.cupSize, bonus:t.bonus,
      cup: { coffee: encCupSlot(t.cup.coffee,'coffee'), milk: encCupSlot(t.cup.milk,'milk') },
      top: { whip: t.top.whip,
             drizzle: t.top.drizzle ? { item:ref('drizzle',t.top.drizzle.item), cov:t.top.drizzle.cov, pts:t.top.drizzle.pts } : null,
             sprinkles: t.top.sprinkles ? { item:ref('sprinkles',t.top.sprinkles.item), cov:t.top.sprinkles.cov, dots:t.top.sprinkles.dots } : null },
      cannoli: t.cannoli ? { shell:ref('shell',t.cannoli.shell), cream:ref('cream',t.cannoli.cream),
        fillL:t.cannoli.fillL, fillR:t.cannoli.fillR, pipeBonus:t.cannoli.pipeBonus||0,
        sprItem:ref('sprinkles',t.cannoli.sprItem), dotsL:t.cannoli.dotsL, dotsR:t.cannoli.dotsR } : null })),
    machines: G.machines.map(m => ({ kind:m.kind, x:m.x, y:m.y, w:m.w,
      type:ref(m.kind==='coffee'?'coffee':'milk', m.type), temp:m.temp, amt:m.amt,
      addin:ref('addin',m.addin), state:m.state, t:m.t, total:m.total, doneAt:m.doneAt||0 })),
    active: { host: G.active ? G.active.id : null,
              guest: G.p2 && G.p2.active ? G.p2.active.id : null },
    result: G.result ? { rid: G.result.rid, os:G.result.os, bs:G.result.bs, ts:G.result.ts,
      cs:G.result.cs, total:G.result.total, tip:G.result.tip, price:G.result.price,
      stars:G.result.stars, xp:G.result.xp, skill:G.result.skill,
      custName:G.result.custName, mood:G.result.mood } : null,
    served: G.served,
    sum: G.state==='summary' || G.state==='shop'
      ? { stationAvg:G.stationAvg, dayXp:G.dayXp, rankRes:G.rankRes, best:G.best } : null,
    prog: { rank:P.rank, xp:P.xp, day:P.day, owned:Object.keys(P.owned),
            holidayDone:Object.keys(P.holidayDone) },
  };
}

/* ---- apply (guest) ---- */

function mergeById(arr, snaps, makeNew, applyOne){
  const by = new Map(arr.map(o => [o.id, o]));
  arr.length = 0;
  for (const s of snaps){
    let o = by.get(s.id);
    const isNew = !o;
    if (isNew) o = makeNew(s);
    applyOne(o, s, isNew);
    arr.push(o);
  }
}

function applyCustomer(c, s, isNew){
  const { x, y, order, ...rest } = s;
  Object.assign(c, rest);
  c.order = isNew ? decOrder(order) : c.order;
  if (isNew){ c.x = x; c.y = y; c.walking = false; c.stompT = 0; c.grumbleT = 9e9; c.drain = 0; }
  c._nx = x; c._ny = y;      // cosmetic tick lerps toward these
}

function applyTicket(t, s, isNew, custById){
  t.slot = s.slot; t.cupSize = s.cupSize; t.bonus = s.bonus;
  t.cup = { coffee: decCupSlot(s.cup.coffee), milk: decCupSlot(s.cup.milk) };
  t.top = { whip: s.top.whip,
    drizzle: s.top.drizzle ? { item:deref(s.top.drizzle.item), cov:s.top.drizzle.cov, pts:s.top.drizzle.pts } : null,
    sprinkles: s.top.sprinkles ? { item:deref(s.top.sprinkles.item), cov:s.top.sprinkles.cov, dots:s.top.sprinkles.dots } : null };
  t.cannoli = s.cannoli ? { shell:deref(s.cannoli.shell), cream:deref(s.cannoli.cream),
    fillL:s.cannoli.fillL, fillR:s.cannoli.fillR, pipeBonus:s.cannoli.pipeBonus,
    sprItem:deref(s.cannoli.sprItem), dotsL:s.cannoli.dotsL, dotsR:s.cannoli.dotsR } : null;
  t.cust = custById.get(s.custId) || t.cust;
  t.order = t.cust ? t.cust.order : t.order;
  if (isNew){ t.id = s.id; t.x = s.slot + 60; t.flash = 1; }
}

/* returns info the caller (coop.js) uses for delta-driven juice */
export function applySnapshot(s){
  const prev = {
    custIds: new Set(G.customers.map(c=>c.id)),
    machineStates: G.machines.map(m=>m.state),
    cups: G.tickets.map(t=>({ id:t.id, c:!!t.cup.coffee, m:!!t.cup.milk })),
    served: G.served.length,
    rushActive: !!(G.rush && G.rush.active),
    petT: G.cat.petT,
    resultRid: G.result ? G.result.rid : 0,
  };

  G.day = s.day; G.money = s.money;
  G.spawn.left = s.spawn.left; G.spawn.total = s.spawn.total;
  G.rush = s.rush;
  G.streak.n = s.streaks.guest;
  G.cat.petT = s.cat.petT; G.cat.calmT = s.cat.calmT;
  G.holidayJustDone = s.holidayJustDone;
  G.served = s.served;
  if (s.sum){ G.stationAvg = s.sum.stationAvg; G.dayXp = s.sum.dayXp;
              G.rankRes = s.sum.rankRes; G.best = s.sum.best; }

  const skew = s.time - G.time;   // host clock minus ours (for the pour marker)

  mergeById(G.customers, s.customers,
    () => Object.create(Customer.prototype),
    applyCustomer);
  const custById = new Map(G.customers.map(c=>[c.id,c]));

  mergeById(G.tickets, s.tickets,
    () => Object.create(Ticket.prototype),
    (t, snap, isNew) => applyTicket(t, snap, isNew, custById));
  layoutTickets();

  const decMachine = sm => ({ ...sm, type:deref(sm.type), addin:deref(sm.addin),
                              doneAt: sm.doneAt - skew });   // marker phase in OUR clock
  if (G.machines.length !== s.machines.length)
    G.machines = s.machines.map(decMachine);        // first snapshot / new day
  else
    for (let i=0;i<G.machines.length;i++) Object.assign(G.machines[i], decMachine(s.machines[i]));

  // result: static fields replicated; t/starsShown animate locally
  if (!s.result){ G.result = null; }
  else if (!G.result || G.result.rid !== s.result.rid){
    G.result = { ...s.result, t:0, starsShown:0, ticket:null };
  }

  // progression mirror so unlockedNow()-driven shelves match the host
  P.rank = s.prog.rank; P.xp = s.prog.xp; P.day = s.prog.day;
  P.owned = Object.fromEntries(s.prog.owned.map(id=>[id,true]));
  P.holidayDone = Object.fromEntries(s.prog.holidayDone.map(id=>[id,true]));
  P.__mirror = true;   // hard wall: saveProgress() refuses while mirrored

  return prev;
}

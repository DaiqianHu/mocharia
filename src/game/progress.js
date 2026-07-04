/* ============================================================
   Progression — XP/rank, shop purchases, holiday completion, and
   which ingredients are unlocked. Persists to localStorage.
   ============================================================ */
import { COFFEES, MILKS, CREAMS, DRIZZLES, SPRINKLE_SETS, RANKS, HOLIDAYS, SHOP_ITEMS } from './data.js';

export const P = {
  xp: 0,
  rank: 0,               // index into RANKS
  owned: {},             // shop item id -> true
  holidayDone: {},       // holiday id -> true
  day: 1,
  money: 0,
  best: 0,
};

const KEY = 'mocha-rush-save-v2';

export function saveProgress(){
  try { localStorage.setItem(KEY, JSON.stringify(P)); } catch(e){}
}
export function loadProgress(){
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    Object.assign(P, JSON.parse(raw));
    return true;
  } catch(e){ return false; }
}
export function resetProgress(){
  P.xp=0; P.rank=0; P.owned={}; P.holidayDone={}; P.day=1; P.money=0;
  saveProgress();
}

/* ---- holidays ---- */
export function activeHoliday(day){
  for (const h of HOLIDAYS)
    if (day >= h.startDay && !P.holidayDone[h.id]) return h;
  return null;
}
export function holidayItems(h){
  return SHOP_ITEMS.filter(it => it.holiday === h.id);
}
/* returns true when the purchase completed the holiday */
export function checkHolidayComplete(h){
  if (!h || P.holidayDone[h.id]) return false;
  if (holidayItems(h).every(it => P.owned[it.id])){
    P.holidayDone[h.id] = true;
    return true;
  }
  return false;
}

/* ---- unlock filtering ---- */
function grantedIds(field){
  const ids = {};
  for (const it of SHOP_ITEMS)
    if (it.grants && it.grants[field] && P.owned[it.id]) ids[it.grants[field]] = it.holiday;
  return ids;
}
function avail(list, field, day){
  const holiday = activeHoliday(day);
  const bought = grantedIds(field);
  return list.filter(it => {
    if (it.rank !== undefined) return it.rank <= P.rank;
    // holiday item: bought its shop unlock AND its holiday is still running
    return bought[it.id] !== undefined && holiday && holiday.id === it.holiday;
  });
}
export function unlockedItems(day){
  return {
    coffees:   avail(COFFEES,       'coffee',    day),
    milks:     avail(MILKS,         'milk',      day),
    creams:    avail(CREAMS,        'cream',     day),
    drizzles:  avail(DRIZZLES,      'drizzle',   day),
    sprinkles: avail(SPRINKLE_SETS, 'sprinkles', day),
  };
}
/* things newly unlocked at exactly rank r — for the rank-up card */
export function unlocksAtRank(r){
  const all = [
    ...COFFEES.map(x=>({...x, what:'coffee'})),
    ...MILKS.map(x=>({...x, what:'milk'})),
    ...CREAMS.map(x=>({...x, what:'cannoli cream'})),
    ...DRIZZLES.map(x=>({...x, what:'drizzle'})),
    ...SPRINKLE_SETS.map(x=>({...x, what:'sprinkles'})),
  ];
  return all.filter(x => x.rank === r);
}

/* ---- xp / ranks ---- */
export function nextRankXp(){
  return P.rank+1 < RANKS.length ? RANKS[P.rank+1].xp : null;
}
/* apply pending xp; returns number of ranks gained */
export function applyRankUps(){
  let ups = 0;
  while (P.rank+1 < RANKS.length && P.xp >= RANKS[P.rank+1].xp){ P.rank++; ups++; }
  return ups;
}

/* ---- shop effects ---- */
export function owns(id){ return !!P.owned[id]; }
export function patienceCalm(){
  let m = 1;
  for (const it of SHOP_ITEMS)
    if (it.calm && P.owned[it.id]) m *= it.calm;
  return m;
}
export function brewSpeed(kind){
  return owns(kind==='coffee' ? 'brewfast' : 'steamfast') ? 0.7 : 1;
}
/* items visible in the shop right now — holiday specials first, so they
   are never pushed off the fixed card grid by base items */
export function shopStock(day){
  const h = activeHoliday(day);
  return SHOP_ITEMS
    .filter(it => !P.owned[it.id] && (!it.holiday || (h && h.id===it.holiday)))
    .sort((a,b) => (b.holiday?1:0) - (a.holiday?1:0));
}

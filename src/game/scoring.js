/* ============================================================
   Per-station scoring (0..100 each) and grade helpers.
   ============================================================ */
import { clamp } from '../core/constants.js';
import { COV_BINS } from './ticket.js';

/* fraction of coverage bins that got any topping -> 0..100 */
function covScore(cov){
  if (!cov) return 0;
  const hit = cov.filter(v=>v>0.12).length / COV_BINS;
  return clamp(Math.round(hit*118), 0, 100);
}

/* brew: right coffee/milk types, temps, and amounts */
export function brewScore(t){
  const o=t.order, c=t.cup;
  if (!c.coffee) return 0;
  let cs = (c.coffee.type.id===o.coffee.id ? 40 : 10)
         + (c.coffee.temp===o.coffeeTemp ? 20 : 0)
         + Math.max(0, 40 - Math.abs(c.coffee.amt-o.shots)*20);
  if (o.milkAmt===0)
    return clamp(cs - (c.milk?30:0), 0, 100);
  let ms = 0;
  if (c.milk){
    ms = (c.milk.type.id===o.milk.id ? 40 : 10)
       + (c.milk.temp===o.milkTemp ? 20 : 0)
       + Math.max(0, 40 - Math.abs(c.milk.amt-o.milkAmt)*20);
  }
  return clamp(Math.round((cs+ms)/2), 0, 100);
}

export function topScore(t){
  const o=t.order, tp=t.top;
  const parts=[];
  const whipCov = covScore(tp.whip.cov);
  parts.push(o.whip ? whipCov : (whipCov>0 ? 15 : 100));
  if (o.drizzle) parts.push(tp.drizzle ? (tp.drizzle.item.id===o.drizzle.id ? covScore(tp.drizzle.cov) : 25) : 0);
  else parts.push(tp.drizzle ? 15 : 100);
  if (o.sprinkles) parts.push(tp.sprinkles ? (tp.sprinkles.item.id===o.sprinkles.id ? covScore(tp.sprinkles.cov) : 25) : 0);
  else parts.push(tp.sprinkles ? 15 : 100);
  return clamp(Math.round(parts.reduce((a,b)=>a+b,0)/parts.length), 0, 100);
}

/* cannoli: right cream (40), both ends filled (20+20), end sprinkles (20).
   Returns null when the order has no cannoli.                            */
export function cannoliScore(t){
  const o=t.order;
  if (!o.cannoli) return null;
  const cn=t.cannoli;
  if (!cn || !cn.cream) return 0;
  let s = (cn.cream.id===o.cannoli.cream.id ? 40 : 12)
        + 20*clamp(cn.fillL,0,1) + 20*clamp(cn.fillR,0,1);
  const dots = cn.dotsL.length + cn.dotsR.length;
  if (o.cannoli.sprinkles) s += clamp(dots/16,0,1)*20;
  else s += dots>0 ? 6 : 20;
  return clamp(Math.round(s), 0, 100);
}

/* order station: how patiently the customer was handled */
export function orderScore(t){
  return clamp(Math.round((t.cust ? t.cust.patience : 0.5)*100), 0, 100);
}

export function xpFor(total, order){
  return Math.round(total/10) + (order.cannoli?3:0) + (total>=90?3:0);
}

export function gradeWord(v){
  return v>=92?'Perfect!' : v>=78?'Great' : v>=60?'Good' : v>=40?'Okay' : 'Poor';
}
export function gradeColor(v){
  return v>=92?'#3fd08c' : v>=78?'#8fd04a' : v>=60?'#ffb400' : v>=40?'#ff8a3a' : '#ff5a4f';
}

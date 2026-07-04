/* ============================================================
   Ticket — one order-in-progress on the rail. Tracks what's been
   poured into the cup, topping coverage, and the cannoli.
   ============================================================ */
import { VW } from '../core/constants.js';

let _tid = 0;
export const COV_BINS = 8;   // topping coverage resolution across the cup top

export class Ticket {
  constructor(cust){
    this.id = ++_tid;
    this.cust = cust;
    this.order = cust.order;
    // what actually went in the cup: {type:<catalog item>, temp, amt, addin}
    this.cup = { coffee:null, milk:null };
    // toppings record where they were applied (x in -0.5..0.5 of cup width)
    this.top = {
      whip:      { cov:new Array(COV_BINS).fill(0), blobs:[] },   // blobs:{x,size}
      drizzle:   null,   // {item, cov:[], pts:[{x,y}]}
      sprinkles: null,   // {item, cov:[], dots:[{x,y,rot,color}]}
    };
    this.cannoli = this.order.cannoli
      ? { shell:null, cream:null, fillL:0, fillR:0, sprItem:null, dotsL:[], dotsR:[] }
      : null;
    this.x = VW + 80;           // slides in from the right
    this.slot = 0;
    this.flash = 1;             // arrival flash
  }
  cannoliReady(){
    const cn = this.cannoli;
    return !cn || (cn.shell && cn.cream && cn.fillL>0.25 && cn.fillR>0.25);
  }
  ready(){
    return !!this.cup.coffee &&
           (this.order.milkAmt===0 || !!this.cup.milk) &&
           this.cannoliReady();
  }
}

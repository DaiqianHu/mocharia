/* ============================================================
   Static game data: ingredient catalogs (rank/holiday gated),
   ranks, holidays, shop items, and order generation.
   Ingredients carry either `rank` (unlocked at that rank) or
   `holiday` (unlocked by buying its shop item during the holiday).
   ============================================================ */
import { choice, randi } from '../core/constants.js';

/* ---- coffees (types of coffee) ---- */
export const COFFEES = [
  {id:'house',   name:'House Roast',   color:'#3a2317', rank:0},
  {id:'arabica', name:'Arabica',       color:'#4a2c1a', rank:1},
  {id:'decaf',   name:'Golden Decaf',  color:'#5a3a26', rank:3},
  {id:'dark',    name:'Midnight Roast',color:'#2e1a10', rank:5},
  {id:'hazel',   name:'Hazelnut Roast',color:'#6a4226', rank:7},
  {id:'pumpkin', name:'Pumpkin Brew',  color:'#7a4218', holiday:'halloween'},
  {id:'ginger',  name:'Gingerbread Roast', color:'#6a3a1c', holiday:'christmas'},
];
/* ---- milks ---- */
export const MILKS = [
  {id:'whole',   name:'Whole Milk',   color:'#f4ecdb', rank:0},
  {id:'oat',     name:'Oat Milk',     color:'#ecdcb9', rank:2},
  {id:'almond',  name:'Almond Milk',  color:'#e8ddcc', rank:4},
  {id:'coconut', name:'Coconut Milk', color:'#f7f3ea', rank:6},
  {id:'eggnog',  name:'Eggnog',       color:'#f2e3b0', holiday:'christmas'},
];
/* ---- cannoli creams ---- */
export const CREAMS = [
  {id:'vanilla', name:'Vanilla Cream',   color:'#f6eeda', rank:0},
  {id:'caramel', name:'Caramel Cream',   color:'#d89a4a', rank:3},
  {id:'oreo',    name:'Oreo Cream',      color:'#c2bcb2', speckle:'#2a2a2e', rank:4},
  {id:'choc',    name:'Chocolate Cream', color:'#6a4428', rank:6},
  {id:'pump',    name:'Pumpkin Cream',   color:'#e08a3a', holiday:'halloween'},
  {id:'mint',    name:'Mint Cream',      color:'#bfe8c8', holiday:'christmas'},
];
/* ---- drink toppings ---- */
export const DRIZZLES = [
  {id:'chocolate',  name:'Chocolate Drizzle',  color:'#4a2c17', rank:0},
  {id:'caramel',    name:'Caramel Drizzle',    color:'#e09a33', rank:1},
  {id:'berry',      name:'Berry Drizzle',      color:'#c8507a', rank:8},
  {id:'spider',     name:'Spiderweb Drizzle',  color:'#2a2a30', holiday:'halloween'},
  {id:'peppermint', name:'Peppermint Drizzle', color:'#e05a6a', holiday:'christmas'},
];
export const SPRINKLE_SETS = [
  {id:'rainbow',  name:'Rainbow Sprinkles', colors:['#ff5a5f','#ffb400','#2fd08c','#3aa0ff','#c86bff'], rank:0},
  {id:'cocoa',    name:'Cocoa Sprinkles',   colors:['#6b4326','#8a5a33','#4a2c17'], rank:2},
  {id:'gold',     name:'Gold Sprinkles',    colors:['#ffd24a','#ffe9a0','#e0a828'], rank:5},
  {id:'spooky',   name:'Spooky Sprinkles',  colors:['#ff8c1a','#3a2a4a','#141418'], holiday:'halloween'},
  {id:'candy',    name:'Candy Cane Sprinkles', colors:['#ff4a4a','#ffffff','#ff9a9a'], holiday:'christmas'},
];

/* ---- barista ranks: cumulative XP needed to reach each ---- */
export const RANKS = [
  {name:'Trainee',         xp:0},
  {name:'Bean Sprout',     xp:60},
  {name:'Milk Frother',    xp:150},
  {name:'Syrup Slinger',   xp:270},
  {name:'Cannoli Cadet',   xp:420},
  {name:'Shot Caller',     xp:600},
  {name:'Brew Wizard',     xp:820},
  {name:'Espresso Expert', xp:1080},
  {name:'Mocha Master',    xp:1380},
  {name:'Coffee Legend',   xp:1750},
];

/* ---- holidays: begin on startDay, end once every item is bought ---- */
export const HOLIDAYS = [
  {id:'halloween', name:'Halloween', startDay:4,
   sky:['#4a2a55','#31203a'], accent:'#ff8c1a',
   greet:'Spooky specials in the shop — collect them all to finish the holiday!'},
  {id:'christmas', name:'Christmas', startDay:9,
   sky:['#2a4a6a','#1c3048'], accent:'#ff5a5a',
   greet:'Festive specials in the shop — collect them all to finish the holiday!'},
];

/* ---- shop catalog (gadgets, decors, holiday unlocks) ----
   gadgets/decors: permanent effects. `grants` unlocks an ingredient id.
   decors carry `calm` — multiplier on customer patience drain.       */
export const SHOP_ITEMS = [
  {id:'doorbell',  name:'Shop Doorbell', desc:'Ding! whenever a customer walks in', price:30,  kind:'gadget'},
  {id:'alarm',     name:'Brew Alarm',    desc:'Rings when a machine finishes',      price:40,  kind:'gadget'},
  {id:'brewfast',  name:'Turbo Brewer',  desc:'Coffee brews 30% faster',            price:60,  kind:'gadget'},
  {id:'steamfast', name:'Turbo Steamer', desc:'Milk steams 30% faster',             price:60,  kind:'gadget'},
  {id:'poster',    name:'Art Poster',    desc:'Customers wait a bit more patiently',price:25,  kind:'decor', calm:0.90},
  {id:'table',     name:'Cafe Table',    desc:'Customers relax while they wait',    price:50,  kind:'decor', calm:0.85},
  {id:'arcade',    name:'Arcade Machine',desc:'Waiting customers play a round',     price:90,  kind:'decor', calm:0.75},
  // Halloween
  {id:'hw-coffee',   name:'Pumpkin Brew Beans',  desc:'Unlocks Pumpkin Brew coffee',    price:45, holiday:'halloween', grants:{coffee:'pumpkin'}},
  {id:'hw-cream',    name:'Pumpkin Cream Tub',   desc:'Unlocks Pumpkin cannoli cream',  price:50, holiday:'halloween', grants:{cream:'pump'}},
  {id:'hw-drizzle',  name:'Spiderweb Sauce',     desc:'Unlocks Spiderweb drizzle',      price:40, holiday:'halloween', grants:{drizzle:'spider'}},
  {id:'hw-sprinkle', name:'Spooky Sprinkle Jar', desc:'Unlocks Spooky sprinkles',       price:40, holiday:'halloween', grants:{sprinkles:'spooky'}},
  {id:'hw-poster',   name:'Haunted Poster',      desc:'Spooky decor, calms the queue',  price:35, holiday:'halloween', kind:'decor', calm:0.9},
  // Christmas
  {id:'xm-coffee',   name:'Gingerbread Beans',   desc:'Unlocks Gingerbread Roast',      price:45, holiday:'christmas', grants:{coffee:'ginger'}},
  {id:'xm-milk',     name:'Eggnog Crate',        desc:'Unlocks Eggnog milk',            price:50, holiday:'christmas', grants:{milk:'eggnog'}},
  {id:'xm-cream',    name:'Mint Cream Tub',      desc:'Unlocks Mint cannoli cream',     price:50, holiday:'christmas', grants:{cream:'mint'}},
  {id:'xm-drizzle',  name:'Peppermint Sauce',    desc:'Unlocks Peppermint drizzle',     price:40, holiday:'christmas', grants:{drizzle:'peppermint'}},
  {id:'xm-sprinkle', name:'Candy Cane Jar',      desc:'Unlocks Candy Cane sprinkles',   price:40, holiday:'christmas', grants:{sprinkles:'candy'}},
  {id:'xm-tree',     name:'Mini Tree',           desc:'Festive decor, calms the queue', price:35, holiday:'christmas', kind:'decor', calm:0.9},
];

export const NAMES = ['Ava','Milo','June','Theo','Nora','Ezra','Ivy','Otis','Lena','Remy',
               'Sage','Bruno','Carmen','Felix','Hana','Iris','Kai','Mona','Nico','Pia'];

/* ---- brew timing (seconds) — boosters multiply these by 0.7 ---- */
export const COFFEE_TIME = amt => 11 + amt*2;    // 13/15/17s
export const MILK_TIME   = amt => 12.5 + amt*2.5; // 15/17.5/20s

/* ---- order generation, restricted to what the player has unlocked ---- */
export function makeOrder(day, unlocked){
  const coffee = choice(unlocked.coffees);
  const shots  = randi(1, Math.min(3, 1+Math.ceil(day/2)));
  const coffeeTemp = Math.random()<0.32 ? 'iced' : 'hot';
  const wantsMilk = Math.random() < 0.72;
  const milk    = wantsMilk ? choice(unlocked.milks) : null;
  const milkAmt = wantsMilk ? randi(1,3) : 0;
  const milkTemp = wantsMilk ? (coffeeTemp==='iced' && Math.random()<0.75 ? 'cold' : Math.random()<0.7 ? 'hot':'cold') : null;
  const whip  = Math.random() < 0.5;
  const drizzle   = Math.random() < 0.45 ? choice(unlocked.drizzles) : null;
  const sprinkles = Math.random() < 0.40 ? choice(unlocked.sprinkles) : null;
  const cannoli = Math.random() < 0.55
    ? { cream: choice(unlocked.creams), sprinkles: Math.random()<0.5 }
    : null;
  const o = { coffee, shots, coffeeTemp, milk, milkAmt, milkTemp, whip, drizzle, sprinkles, cannoli };
  o.name = (coffeeTemp==='iced'?'Iced ':'') + coffee.name;
  o.price = 2.20 + shots*0.90 + milkAmt*0.45 + (whip?0.35:0) + (drizzle?0.30:0)
          + (sprinkles?0.30:0) + (cannoli?2.50:0);
  return o;
}

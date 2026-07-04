/* ============================================================
   Static game data: ingredient catalogs (rank/holiday gated),
   ranks, holidays, shop items, and order generation.
   Ingredients carry either `rank` (unlocked at that rank) or
   `holiday` (unlocked by buying its shop item during the holiday).
   Names/flavors adopted from Papa's Mocharia To Go! (Flipline).
   ============================================================ */
import { choice, randi } from '../core/constants.js';

/* ---- coffees (types of coffee) ---- */
export const COFFEES = [
  {id:'house',   name:'House Roast',   color:'#3a2317', rank:0},
  {id:'arabica', name:'Arabica',       color:'#4a2c1a', rank:1},
  {id:'vanillab',name:'Vanilla Bean',  color:'#8a5a30', rank:2},
  {id:'decaf',   name:'Golden Decaf',  color:'#5a3a26', rank:3},
  {id:'mocha',   name:'Double Mocha',  color:'#53301e', rank:4},
  {id:'dark',    name:'Midnight Roast',color:'#2e1a10', rank:5},
  {id:'hazel',   name:'Hazelnut Roast',color:'#6a4226', rank:7},
  {id:'toffee',  name:'Toffee Roast',  color:'#7a5228', rank:8},
  {id:'galaxy',  name:'Galaxy Roast',  color:'#3a2440', rank:9},
  {id:'french',  name:'French Roast',  color:'#33200f', rank:10},
  {id:'newengl', name:'New England Roast', color:'#5c3a20', rank:13},
  {id:'pumpkin', name:'Pumpkin Brew',  color:'#7a4218', holiday:'halloween'},
  {id:'ginger',  name:'Gingerbread Roast', color:'#6a3a1c', holiday:'christmas'},
  {id:'party',   name:'Party Roast',   color:'#7a4a5a', holiday:'bday'},
  {id:'snicker', name:'Snickerdoodle Roast', color:'#8a5a2c', holiday:'thanksgiving'},
  {id:'shimmer', name:'Midnight Shimmer',    color:'#34284a', holiday:'newyear'},
  {id:'whitechoc',name:'White Choc Roast',   color:'#b08a58', holiday:'valentine'},
  {id:'goldrush', name:'Gold Rush Roast',    color:'#7a5a1c', holiday:'stpaddy'},
  {id:'sakura',   name:'Sakura Roast',       color:'#7a4048', holiday:'blossom'},
  {id:'champur',  name:'Champurrado Roast',  color:'#5a2c16', holiday:'cinco'},
  {id:'mango',    name:'Mango Roast',        color:'#a86a20', holiday:'luau'},
  {id:'almondsnap',name:'Almond Snap Roast', color:'#6e4a28', holiday:'jubilee'},
  {id:'rooibos',  name:"Rockin' Rooibos",    color:'#7e3520', holiday:'groovstock'},
  {id:'drcherry', name:'Dr. Cherry Roast',   color:'#5e2028', holiday:'filmfest'},
];
/* ---- milks ---- */
export const MILKS = [
  {id:'whole',   name:'Whole Milk',      color:'#f4ecdb', rank:0},
  {id:'oat',     name:'Oat Milk',        color:'#ecdcb9', rank:2},
  {id:'straw',   name:'Strawberry Milk', color:'#f4c9d4', rank:3},
  {id:'almond',  name:'Almond Milk',     color:'#e8ddcc', rank:4},
  {id:'coconut', name:'Coconut Milk',    color:'#f7f3ea', rank:6},
  {id:'banana',  name:'Banana Milk',     color:'#f6e9a6', rank:7},
  {id:'chocmilk',name:'Chocolate Milk',  color:'#c08a56', rank:10},
  {id:'blueberry',name:'Blueberry Milk', color:'#b9c2ee', rank:14},
  {id:'eggnog',  name:'Eggnog',          color:'#f2e3b0', holiday:'christmas'},
  {id:'pecan',   name:'Pecan Milk',      color:'#e3c39a', holiday:'thanksgiving'},
  {id:'unicorn', name:'Unicorn Milk',    color:'#eed2f2', holiday:'newyear'},
  {id:'lollipop',name:'Lollipop Milk',   color:'#f2b6de', holiday:'valentine'},
  {id:'irish',   name:'Irish Cream Milk',color:'#e9d5b2', holiday:'stpaddy'},
  {id:'shiruko', name:'Shiruko Milk',    color:'#d9b9c6', holiday:'blossom'},
  {id:'horchata',name:'Horchata',        color:'#ebdcc0', holiday:'cinco'},
  {id:'pina',    name:'Piña Colada Milk',color:'#f5edd2', holiday:'luau'},
  {id:'cherrybomb',name:'Cherrybomb Milk',color:'#f3b3ba', holiday:'jubilee'},
  {id:'golden',  name:'Golden Milk',     color:'#f0d072', holiday:'groovstock'},
  {id:'rootbeer',name:'Root Beer Float', color:'#d29a5c', holiday:'filmfest'},
];
/* ---- cannoli creams ---- */
export const CREAMS = [
  {id:'vanilla', name:'Vanilla Cream',    color:'#f6eeda', rank:0},
  {id:'strawc',  name:'Strawberry Cream', color:'#f2b8c6', rank:2},
  {id:'caramel', name:'Caramel Cream',    color:'#d89a4a', rank:3},
  {id:'oreo',    name:'Oreo Cream',       color:'#c2bcb2', speckle:'#2a2a2e', rank:4},
  {id:'choc',    name:'Chocolate Cream',  color:'#6a4428', rank:6},
  {id:'pistachio',name:'Pistachio Cream', color:'#b8d49a', rank:7},
  {id:'bgum',    name:'Bubblegum Cream',  color:'#e8a8d8', rank:9},
  {id:'lemonchiffon', name:'Lemon Chiffon',   color:'#f4e88c', rank:11},
  {id:'moonmist',     name:'Moon Mist Cream', color:'#cdddee', speckle:'#8aa8d8', rank:13},
  {id:'pump',    name:'Pumpkin Cream',    color:'#e08a3a', holiday:'halloween'},
  {id:'mint',    name:'Mint Cream',       color:'#bfe8c8', holiday:'christmas'},
  {id:'cake',    name:'Cake Batter Cream',color:'#f6e8c8', speckle:'#e05a8a', holiday:'bday'},
  {id:'candycorn', name:'Candy Corn Cream',  color:'#f4b83a', speckle:'#fff3d0', holiday:'thanksgiving'},
  {id:'rainbowm',  name:'Rainbow Meringue',  color:'#f2e4f8', speckle:'#c86bff', holiday:'newyear'},
  {id:'neapolitan',name:'Neapolitan Cream',  color:'#eab9c1', speckle:'#6a4428', holiday:'valentine'},
  {id:'emerald',   name:'Green Emerald Cream', color:'#4cc87a', holiday:'stpaddy'},
  {id:'azuki',     name:'Azuki Fluff',       color:'#a85a6e', holiday:'blossom'},
  {id:'tresleches',name:'Tres Leches Whip',  color:'#f4e6c6', holiday:'cinco'},
  {id:'maui',      name:'Maui Meringue',     color:'#f6d89a', speckle:'#ff8a5a', holiday:'luau'},
  {id:'powsicle',  name:'Powsicle Cream',    color:'#7cc6ee', speckle:'#ff6a6a', holiday:'jubilee'},
  {id:'bluesberry',name:'Blues-berry Cream', color:'#8c96e2', holiday:'groovstock'},
  {id:'licorice',  name:'Licorice Whip Cream', color:'#4a3e48', speckle:'#e05a6a', holiday:'filmfest'},
];
/* ---- drink toppings ---- */
export const DRIZZLES = [
  {id:'chocolate',  name:'Chocolate Drizzle',  color:'#4a2c17', rank:0},
  {id:'caramel',    name:'Caramel Drizzle',    color:'#e09a33', rank:1},
  {id:'white',      name:'White Choc Drizzle', color:'#f0e2c8', rank:4},
  {id:'honey',      name:'Honey Drizzle',      color:'#f2c73c', rank:6},
  {id:'berry',      name:'Berry Drizzle',      color:'#c8507a', rank:8},
  {id:'redvelvet',  name:'Red Velvet Drizzle', color:'#a83040', rank:10},
  {id:'bluenimbus', name:'Blue Nimbus Drizzle',color:'#4a90e8', rank:12},
  {id:'marshdriz',  name:'Marshmallow Drizzle',color:'#f6f0e2', rank:15},
  {id:'spider',     name:'Spiderweb Drizzle',  color:'#2a2a30', holiday:'halloween'},
  {id:'peppermint', name:'Peppermint Drizzle', color:'#e05a6a', holiday:'christmas'},
  {id:'frosting',   name:'Pink Frosting',      color:'#ff8ab8', holiday:'bday'},
  {id:'pumpspice',  name:'Pumpkin Spice Drizzle', color:'#c86e22', holiday:'thanksgiving'},
  {id:'flavorx',    name:'Flavor X Drizzle',   color:'#7a30c8', holiday:'newyear'},
  {id:'cherrycake', name:'Cherry Cheesecake Drizzle', color:'#d84a5e', holiday:'valentine'},
  {id:'mintdriz',   name:'Mint Drizzle',       color:'#3ec88a', holiday:'stpaddy'},
  {id:'honeydew',   name:'Honeydew Drizzle',   color:'#b2dc5c', holiday:'blossom'},
  {id:'mamey',      name:'Mamey Drizzle',      color:'#e07a3a', holiday:'cinco'},
  {id:'luaupunch',  name:'Luau Punch Drizzle', color:'#e84a7a', holiday:'luau'},
  {id:'jubjelly',   name:'Jubilee Jelly',      color:'#d83444', holiday:'jubilee'},
  {id:'gingerhaze', name:'Ginger Haze Drizzle',color:'#d89a3a', holiday:'groovstock'},
  {id:'goldenage',  name:'Golden Age Drizzle', color:'#e8c24a', holiday:'filmfest'},
];
export const SPRINKLE_SETS = [
  {id:'rainbow',  name:'Rainbow Sprinkles', colors:['#ff5a5f','#ffb400','#2fd08c','#3aa0ff','#c86bff'], rank:0},
  {id:'cocoa',    name:'Cocoa Sprinkles',   colors:['#6b4326','#8a5a33','#4a2c17'], rank:2},
  {id:'ocean',    name:'Ocean Sprinkles',   colors:['#3ac8e8','#2a6ae0','#9ae8f0'], rank:4},
  {id:'gold',     name:'Gold Sprinkles',    colors:['#ffd24a','#ffe9a0','#e0a828'], rank:5},
  {id:'hearts',   name:'Heart Sprinkles',   colors:['#ff6a8a','#ff9ab0','#e04868'], rank:7},
  {id:'cinnsugar',name:'Cinnamon Sugar',    colors:['#d89a5a','#b0703a','#f0cf9a'], rank:11},
  {id:'coconutsp',name:'Toasted Coconut',   colors:['#f4ecd8','#e0c9a0','#c9a068'], rank:12},
  {id:'mallows',  name:'Mini Mallows',      colors:['#fff6f6','#ffd8e0','#d8e8ff'], rank:14},
  {id:'pistachiosp',name:'Crushed Pistachios', colors:['#a8c87a','#7ea850','#d0e0a8'], rank:15},
  {id:'spooky',   name:'Spooky Sprinkles',  colors:['#ff8c1a','#3a2a4a','#141418'], holiday:'halloween'},
  {id:'candy',    name:'Candy Cane Sprinkles', colors:['#ff4a4a','#ffffff','#ff9a9a'], holiday:'christmas'},
  {id:'party',    name:'Party Poppers',     colors:['#ff5a5f','#ffd24a','#3ae0c8','#c86bff','#ffffff'], holiday:'bday'},
  {id:'autumn',   name:'Autumn Leaves',     colors:['#c8622a','#e09a2a','#8a4a1c'], holiday:'thanksgiving'},
  {id:'hoops',    name:'Fruity Hoops',      colors:['#ff5a5f','#ffb400','#2fd08c','#3aa0ff','#c86bff'], holiday:'newyear'},
  {id:'xando',    name:'X & O Sprinkles',   colors:['#ff4a6a','#fff0f0','#ffb8c8'], holiday:'valentine'},
  {id:'shamrock', name:'Shamrock Sprinkles',colors:['#2fb056','#57d07c','#1c8038'], holiday:'stpaddy'},
  {id:'petals',   name:'Sugar Petals',      colors:['#ffc9d8','#ff9ab8','#fff0f4'], holiday:'blossom'},
  {id:'cincoswirl',name:'Cinco Swirls',     colors:['#e0342a','#f0f0e0','#2fa848','#ffb400'], holiday:'cinco'},
  {id:'tropical', name:'Tropical Charms',   colors:['#ff8a2a','#ffd24a','#ff5a8a','#3ae0c8'], holiday:'luau'},
  {id:'crackle',  name:'Crackle Crumbs',    colors:['#ff4a4a','#f0f0f4','#3a6ae0'], holiday:'jubilee'},
  {id:'crimson',  name:'Crimson & Clove',   colors:['#c82a3a','#8a5a2a','#5a3a6a'], holiday:'groovstock'},
  {id:'butterzinger',name:'Butterzinger Bits', colors:['#ffd24a','#e8a020','#6a4a20'], holiday:'filmfest'},
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
  {name:'French Roaster',  xp:2170},
  {name:'Velvet Virtuoso', xp:2650},
  {name:'Nimbus Navigator',xp:3190},
  {name:'Moon Mist Master',xp:3790},
  {name:'Mallow Wizard',   xp:4450},
  {name:'Better Than Papa!',xp:5200},
];

/* ---- holidays: begin on startDay, end once every item is bought ----
   `light` recolors the 3D lighting rig; `ambient` drives the drifting
   weather overlay (see core/particles.js updateAmbient/drawAmbient). */
export const HOLIDAYS = [
  {id:'halloween', name:'Halloween', startDay:4,
   sky:['#4a2a55','#31203a'], accent:'#ff8c1a',
   light:{hemi:0xb99cff, ground:0x3a2440, key:0xffb060, fill:0x9a6aff},
   ambient:{kind:'glyph', glyphs:['✦','◆'], colors:['#ff8c1a','#9a6aff','#e0d0ff']},
   greet:'Spooky specials in the shop — collect them all to finish the holiday!'},
  {id:'christmas', name:'Christmas', startDay:9,
   sky:['#2a4a6a','#1c3048'], accent:'#ff5a5a',
   light:{hemi:0xdbe8ff, ground:0x1c3048, key:0xfff2e0, fill:0x9ad0ff},
   ambient:{kind:'flake', colors:['#ffffff','#e8f4ff','#d0e8ff']},
   greet:'Festive specials in the shop — collect them all to finish the holiday!'},
  {id:'bday', name:'Birthday Bash', startDay:14,
   sky:['#c84a8a','#5a2a5a'], accent:'#ffd24a',
   light:{hemi:0xffe0f0, ground:0x5a2a4a, key:0xfff0d8, fill:0xff9ad0},
   ambient:{kind:'confetti', colors:['#ff5a5f','#ffd24a','#3ae0c8','#c86bff','#fff3d0']},
   greet:'Party specials in the shop — collect them all to finish the holiday!'},
  {id:'thanksgiving', name:'Thanksgiving', startDay:19,
   sky:['#b06a2a','#5a3018'], accent:'#e08a3a',
   light:{hemi:0xffd9b0, ground:0x5a3018, key:0xffc888, fill:0xe08a4a},
   ambient:{kind:'leaf', colors:['#c8622a','#e09a2a','#8a4a1c','#a85a20']},
   greet:'Cozy harvest specials in the shop — collect them all to finish the holiday!'},
  {id:'newyear', name:'New Year', startDay:24,
   sky:['#2a2a5a','#141430'], accent:'#ffd24a',
   light:{hemi:0xd0d0ff, ground:0x202048, key:0xfff0c0, fill:0x8a8aff},
   ambient:{kind:'confetti', colors:['#ffd24a','#e8e8f0','#9a6aff','#3ac8e8']},
   greet:'Countdown specials in the shop — collect them all to finish the holiday!'},
  {id:'valentine', name:"Valentine's Day", startDay:29,
   sky:['#e07a9a','#8a3050'], accent:'#ff5a8a',
   light:{hemi:0xffd8e4, ground:0x6a2a3a, key:0xfff0f0, fill:0xff9ab8},
   ambient:{kind:'glyph', glyphs:['♥'], colors:['#ff6a8a','#ff9ab0','#e04868']},
   greet:'Sweetheart specials in the shop — collect them all to finish the holiday!'},
  {id:'stpaddy', name:"St. Paddy's Day", startDay:34,
   sky:['#3a8a4a','#1c4a28'], accent:'#3fd06a',
   light:{hemi:0xd8ffe0, ground:0x1c4a28, key:0xfff8d8, fill:0x6ae08a},
   ambient:{kind:'glyph', glyphs:['☘'], colors:['#2fb056','#57d07c','#1c8038']},
   greet:'Lucky specials in the shop — collect them all to finish the holiday!'},
  {id:'blossom', name:'Cherry Blossom Festival', startDay:39,
   sky:['#f0b8cc','#c86a90'], accent:'#ff9ab8',
   light:{hemi:0xffe4ee, ground:0x7a4a58, key:0xfff4f0, fill:0xffb0c8},
   ambient:{kind:'petal', colors:['#ffc9d8','#ffaec8','#ff8fb0']},
   greet:'Blossom specials in the shop — collect them all to finish the holiday!'},
  {id:'cinco', name:'Cinco de Mayo', startDay:44,
   sky:['#e0662a','#7a2848'], accent:'#ffb400',
   light:{hemi:0xffe2c0, ground:0x6a3020, key:0xffd890, fill:0xff8a5a},
   ambient:{kind:'confetti', colors:['#ff5a5f','#ffb400','#2fd08c','#3aa0ff']},
   greet:'Fiesta specials in the shop — collect them all to finish the holiday!'},
  {id:'luau', name:'Summer Luau', startDay:49,
   sky:['#2ab8d8','#186a98'], accent:'#ffb400',
   light:{hemi:0xd8f4ff, ground:0x1a5a70, key:0xfff4d0, fill:0x5ad0e8},
   ambient:{kind:'glyph', glyphs:['✿'], colors:['#ff6a8a','#ffb400','#ff8a5a','#f0f0e0']},
   greet:'Tropical specials in the shop — collect them all to finish the holiday!'},
  {id:'jubilee', name:'Starlight Jubilee', startDay:54,
   sky:['#28306a','#141838'], accent:'#ff5a5a',
   light:{hemi:0xd0d8ff, ground:0x1c2050, key:0xffeedd, fill:0x7a8aff},
   ambient:{kind:'glyph', glyphs:['✦','★'], colors:['#ff6a6a','#ffffff','#6a8aff','#ffd24a']},
   greet:'Star-spangled specials in the shop — collect them all to finish the holiday!'},
  {id:'groovstock', name:'Grōōvstock', startDay:59,
   sky:['#7a3a9a','#3a1c50'], accent:'#ffb400',
   light:{hemi:0xe8d0ff, ground:0x3a1c50, key:0xffd8a0, fill:0xc86bff},
   ambient:{kind:'glyph', glyphs:['♪','♫'], colors:['#ffb400','#ff6a5a','#c86bff','#3ae0c8']},
   greet:'Groovy specials in the shop — collect them all to finish the holiday!'},
  {id:'filmfest', name:'Sugarplex Film Fest', startDay:64,
   sky:['#8a2030','#38101c'], accent:'#ffd24a',
   light:{hemi:0xffd8d0, ground:0x481018, key:0xffe8b0, fill:0xff6a6a},
   ambient:{kind:'glyph', glyphs:['★'], colors:['#ffd24a','#fff3d0','#ff9a5a']},
   greet:'Blockbuster specials in the shop — collect them all to finish the holiday!'},
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
  // Birthday Bash
  {id:'bd-coffee',   name:'Party Roast Beans',   desc:'Unlocks Party Roast coffee',     price:45, holiday:'bday', grants:{coffee:'party'}},
  {id:'bd-cream',    name:'Cake Batter Tub',     desc:'Unlocks Cake Batter cream',      price:50, holiday:'bday', grants:{cream:'cake'}},
  {id:'bd-drizzle',  name:'Frosting Bottle',     desc:'Unlocks Pink Frosting drizzle',  price:40, holiday:'bday', grants:{drizzle:'frosting'}},
  {id:'bd-sprinkle', name:'Party Popper Jar',    desc:'Unlocks Party Popper sprinkles', price:40, holiday:'bday', grants:{sprinkles:'party'}},
  {id:'bd-balloons', name:'Balloon Bunch',       desc:'Party decor, calms the queue',   price:35, holiday:'bday', kind:'decor', calm:0.9},
  // Thanksgiving
  {id:'tg-coffee',   name:'Snickerdoodle Beans', desc:'Unlocks Snickerdoodle Roast',    price:45, holiday:'thanksgiving', grants:{coffee:'snicker'}},
  {id:'tg-milk',     name:'Pecan Milk Jug',      desc:'Unlocks Pecan Milk',             price:50, holiday:'thanksgiving', grants:{milk:'pecan'}},
  {id:'tg-cream',    name:'Candy Corn Tub',      desc:'Unlocks Candy Corn cream',       price:50, holiday:'thanksgiving', grants:{cream:'candycorn'}},
  {id:'tg-drizzle',  name:'Pumpkin Spice Sauce', desc:'Unlocks Pumpkin Spice drizzle',  price:40, holiday:'thanksgiving', grants:{drizzle:'pumpspice'}},
  {id:'tg-sprinkle', name:'Autumn Leaves Jar',   desc:'Unlocks Autumn Leaves sprinkles',price:40, holiday:'thanksgiving', grants:{sprinkles:'autumn'}},
  {id:'tg-wreath',   name:'Harvest Wreath',      desc:'Cozy decor, calms the queue',    price:35, holiday:'thanksgiving', kind:'decor', calm:0.9},
  // New Year
  {id:'ny-coffee',   name:'Midnight Shimmer Beans', desc:'Unlocks Midnight Shimmer roast', price:45, holiday:'newyear', grants:{coffee:'shimmer'}},
  {id:'ny-milk',     name:'Unicorn Milk Jug',    desc:'Unlocks Unicorn Milk',           price:50, holiday:'newyear', grants:{milk:'unicorn'}},
  {id:'ny-cream',    name:'Rainbow Meringue Tub',desc:'Unlocks Rainbow Meringue cream', price:50, holiday:'newyear', grants:{cream:'rainbowm'}},
  {id:'ny-drizzle',  name:'Flavor X Bottle',     desc:'Unlocks mysterious Flavor X',    price:40, holiday:'newyear', grants:{drizzle:'flavorx'}},
  {id:'ny-sprinkle', name:'Fruity Hoops Jar',    desc:'Unlocks Fruity Hoops sprinkles', price:40, holiday:'newyear', grants:{sprinkles:'hoops'}},
  {id:'ny-disco',    name:'Disco Ball',          desc:'Sparkly decor, calms the queue', price:35, holiday:'newyear', kind:'decor', calm:0.9},
  // Valentine's Day
  {id:'vd-coffee',   name:'White Choc Beans',    desc:'Unlocks White Choc Roast',       price:45, holiday:'valentine', grants:{coffee:'whitechoc'}},
  {id:'vd-milk',     name:'Lollipop Milk Jug',   desc:'Unlocks Lollipop Milk',          price:50, holiday:'valentine', grants:{milk:'lollipop'}},
  {id:'vd-cream',    name:'Neapolitan Tub',      desc:'Unlocks Neapolitan cream',       price:50, holiday:'valentine', grants:{cream:'neapolitan'}},
  {id:'vd-drizzle',  name:'Cherry Cheesecake Sauce', desc:'Unlocks Cherry Cheesecake drizzle', price:40, holiday:'valentine', grants:{drizzle:'cherrycake'}},
  {id:'vd-sprinkle', name:'X & O Sprinkle Jar',  desc:'Unlocks X & O sprinkles',        price:40, holiday:'valentine', grants:{sprinkles:'xando'}},
  {id:'vd-balloon',  name:'Cupid Balloons',      desc:'Lovely decor, calms the queue',  price:35, holiday:'valentine', kind:'decor', calm:0.9},
  // St. Paddy's Day
  {id:'sp-coffee',   name:'Gold Rush Beans',     desc:'Unlocks Gold Rush Roast',        price:45, holiday:'stpaddy', grants:{coffee:'goldrush'}},
  {id:'sp-milk',     name:'Irish Cream Jug',     desc:'Unlocks Irish Cream Milk',       price:50, holiday:'stpaddy', grants:{milk:'irish'}},
  {id:'sp-cream',    name:'Emerald Cream Tub',   desc:'Unlocks Green Emerald cream',    price:50, holiday:'stpaddy', grants:{cream:'emerald'}},
  {id:'sp-drizzle',  name:'Mint Sauce',          desc:'Unlocks Mint drizzle',           price:40, holiday:'stpaddy', grants:{drizzle:'mintdriz'}},
  {id:'sp-sprinkle', name:'Shamrock Jar',        desc:'Unlocks Shamrock sprinkles',     price:40, holiday:'stpaddy', grants:{sprinkles:'shamrock'}},
  {id:'sp-gold',     name:"Pot o' Gold",         desc:'Lucky decor, calms the queue',   price:35, holiday:'stpaddy', kind:'decor', calm:0.9},
  // Cherry Blossom Festival
  {id:'cb-coffee',   name:'Sakura Beans',        desc:'Unlocks Sakura Roast',           price:45, holiday:'blossom', grants:{coffee:'sakura'}},
  {id:'cb-milk',     name:'Shiruko Milk Jug',    desc:'Unlocks Shiruko Milk',           price:50, holiday:'blossom', grants:{milk:'shiruko'}},
  {id:'cb-cream',    name:'Azuki Fluff Tub',     desc:'Unlocks Azuki Fluff cream',      price:50, holiday:'blossom', grants:{cream:'azuki'}},
  {id:'cb-drizzle',  name:'Honeydew Sauce',      desc:'Unlocks Honeydew drizzle',       price:40, holiday:'blossom', grants:{drizzle:'honeydew'}},
  {id:'cb-sprinkle', name:'Sugar Petals Jar',    desc:'Unlocks Sugar Petals sprinkles', price:40, holiday:'blossom', grants:{sprinkles:'petals'}},
  {id:'cb-lantern',  name:'Paper Lanterns',      desc:'Serene decor, calms the queue',  price:35, holiday:'blossom', kind:'decor', calm:0.9},
  // Cinco de Mayo
  {id:'cm-coffee',   name:'Champurrado Beans',   desc:'Unlocks Champurrado Roast',      price:45, holiday:'cinco', grants:{coffee:'champur'}},
  {id:'cm-milk',     name:'Horchata Jug',        desc:'Unlocks Horchata',               price:50, holiday:'cinco', grants:{milk:'horchata'}},
  {id:'cm-cream',    name:'Tres Leches Tub',     desc:'Unlocks Tres Leches whip',       price:50, holiday:'cinco', grants:{cream:'tresleches'}},
  {id:'cm-drizzle',  name:'Mamey Sauce',         desc:'Unlocks Mamey drizzle',          price:40, holiday:'cinco', grants:{drizzle:'mamey'}},
  {id:'cm-sprinkle', name:'Cinco Swirls Jar',    desc:'Unlocks Cinco Swirls sprinkles', price:40, holiday:'cinco', grants:{sprinkles:'cincoswirl'}},
  {id:'cm-pinata',   name:'Piñata',              desc:'Fiesta decor, calms the queue',  price:35, holiday:'cinco', kind:'decor', calm:0.9},
  // Summer Luau
  {id:'lu-coffee',   name:'Mango Roast Beans',   desc:'Unlocks Mango Roast',            price:45, holiday:'luau', grants:{coffee:'mango'}},
  {id:'lu-milk',     name:'Piña Colada Jug',     desc:'Unlocks Piña Colada Milk',       price:50, holiday:'luau', grants:{milk:'pina'}},
  {id:'lu-cream',    name:'Maui Meringue Tub',   desc:'Unlocks Maui Meringue cream',    price:50, holiday:'luau', grants:{cream:'maui'}},
  {id:'lu-drizzle',  name:'Luau Punch Bottle',   desc:'Unlocks Luau Punch drizzle',     price:40, holiday:'luau', grants:{drizzle:'luaupunch'}},
  {id:'lu-sprinkle', name:'Tropical Charms Jar', desc:'Unlocks Tropical Charms',        price:40, holiday:'luau', grants:{sprinkles:'tropical'}},
  {id:'lu-tiki',     name:'Tiki Torch',          desc:'Beachy decor, calms the queue',  price:35, holiday:'luau', kind:'decor', calm:0.9},
  // Starlight Jubilee
  {id:'sj-coffee',   name:'Almond Snap Beans',   desc:'Unlocks Almond Snap Roast',      price:45, holiday:'jubilee', grants:{coffee:'almondsnap'}},
  {id:'sj-milk',     name:'Cherrybomb Jug',      desc:'Unlocks Cherrybomb Milk',        price:50, holiday:'jubilee', grants:{milk:'cherrybomb'}},
  {id:'sj-cream',    name:'Powsicle Cream Tub',  desc:'Unlocks Powsicle cream',         price:50, holiday:'jubilee', grants:{cream:'powsicle'}},
  {id:'sj-drizzle',  name:'Jubilee Jelly Jar',   desc:'Unlocks Jubilee Jelly drizzle',  price:40, holiday:'jubilee', grants:{drizzle:'jubjelly'}},
  {id:'sj-sprinkle', name:'Crackle Crumbs Jar',  desc:'Unlocks Crackle Crumbs',         price:40, holiday:'jubilee', grants:{sprinkles:'crackle'}},
  {id:'sj-bunting',  name:'Rocket Bunting',      desc:'Star-spangled decor, calms the queue', price:35, holiday:'jubilee', kind:'decor', calm:0.9},
  // Grōōvstock
  {id:'gv-coffee',   name:"Rockin' Rooibos Beans", desc:"Unlocks Rockin' Rooibos",      price:45, holiday:'groovstock', grants:{coffee:'rooibos'}},
  {id:'gv-milk',     name:'Golden Milk Jug',     desc:'Unlocks Golden Milk',            price:50, holiday:'groovstock', grants:{milk:'golden'}},
  {id:'gv-cream',    name:'Blues-berry Tub',     desc:'Unlocks Blues-berry cream',      price:50, holiday:'groovstock', grants:{cream:'bluesberry'}},
  {id:'gv-drizzle',  name:'Ginger Haze Bottle',  desc:'Unlocks Ginger Haze drizzle',    price:40, holiday:'groovstock', grants:{drizzle:'gingerhaze'}},
  {id:'gv-sprinkle', name:'Crimson & Clove Jar', desc:'Unlocks Crimson & Clove',        price:40, holiday:'groovstock', grants:{sprinkles:'crimson'}},
  {id:'gv-lavalamp', name:'Lava Lamp',           desc:'Groovy decor, calms the queue',  price:35, holiday:'groovstock', kind:'decor', calm:0.9},
  // Sugarplex Film Fest
  {id:'sf-coffee',   name:'Dr. Cherry Beans',    desc:'Unlocks Dr. Cherry Roast',       price:45, holiday:'filmfest', grants:{coffee:'drcherry'}},
  {id:'sf-milk',     name:'Root Beer Float Jug', desc:'Unlocks Root Beer Float',        price:50, holiday:'filmfest', grants:{milk:'rootbeer'}},
  {id:'sf-cream',    name:'Licorice Whip Tub',   desc:'Unlocks Licorice Whip cream',    price:50, holiday:'filmfest', grants:{cream:'licorice'}},
  {id:'sf-drizzle',  name:'Golden Age Bottle',   desc:'Unlocks Golden Age drizzle',     price:40, holiday:'filmfest', grants:{drizzle:'goldenage'}},
  {id:'sf-sprinkle', name:'Butterzinger Jar',    desc:'Unlocks Butterzinger Bits',      price:40, holiday:'filmfest', grants:{sprinkles:'butterzinger'}},
  {id:'sf-popcorn',  name:'Popcorn Cart',        desc:'Blockbuster decor, calms the queue', price:35, holiday:'filmfest', kind:'decor', calm:0.9},
];

export const NAMES = ['Ava','Milo','June','Theo','Nora','Ezra','Ivy','Otis','Lena','Remy',
               'Sage','Bruno','Carmen','Felix','Hana','Iris','Kai','Mona','Nico','Pia'];

/* ---- brew timing (seconds) — boosters multiply these by 0.7 ---- */
export const COFFEE_TIME = amt => 11 + amt*2;    // 13/15/17s
export const MILK_TIME   = amt => 12.5 + amt*2.5; // 15/17.5/20s

/* ---- how many customers a day brings (shared by spawner + day intro) ---- */
export const customersForDay = day => Math.min(3 + day, 10);

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

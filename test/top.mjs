import { launch, newPage, shoot, pageCoord } from './harness.mjs';

const browser = await launch();
const W=960,H=600,DPR=1;
const page = await newPage(browser, W, H, DPR);

// Build a fake active ticket with a filled cup + toppings so the 3D drink shows.
await page.evaluate(()=>{
  const G = window.G;
  G.state='play'; G.station='top';
  const coffee={id:'house',name:'House Roast',color:'#3a2317'};
  const milk={id:'whole',name:'Whole Milk',color:'#f4ecdb'};
  const order={ coffee, shots:3, coffeeTemp:'hot', milk, milkAmt:2, milkTemp:'hot',
    whip:true, drizzle:null, sprinkles:null, cannoli:null, name:'House Roast', price:5.9 };
  const t = {
    id:1, cust:{ name:'Ava', patience:1, mood:'happy', state:'waiting' },
    order,
    cup:{ coffee:{type:coffee,temp:'hot',amt:3}, milk:{type:milk,temp:'hot',amt:2} },
    top:{ whip:{cov:new Array(8).fill(0), blobs:[]}, drizzle:null, sprinkles:null },
    cannoli:null,
    x:12, slot:12, flash:0,
    cannoliReady(){return true;}, ready(){return true;},
  };
  G.active = t; G.tickets=[t];
});
await new Promise(r=>setTimeout(r,300));

// simulate dragging whip then drizzle over the cup via real pointer events
async function drag(cat, item, colors){
  await page.evaluate((cat,item,colors)=>{
    window.G.drag = { cat, item:{id:item, color:'#e09a33', colors:colors} };
    window.G.pointer.down = true;
  }, cat, item, colors);
  // sweep the pointer across the cup drop zone
  for (let i=0;i<40;i++){
    const vx = 360 + (i%20)*4;   // 360..440 across cup
    const pc = pageCoord(vx, 250, W, H);
    await page.mouse.move(pc.x, pc.y);
    await page.evaluate((vx)=>{ window.G.pointer.x=vx; window.G.pointer.y=250; }, vx);
    await new Promise(r=>setTimeout(r,12));
  }
}
await drag('whip','whip',null);
await drag('drizzle','caramel',null);
await drag('sprinkles','rainbow',['#ff5a5f','#ffb400','#2fd08c','#3aa0ff','#c86bff']);
await page.evaluate(()=>{ window.G.pointer.down=false; window.G.drag=null; });
await new Promise(r=>setTimeout(r,200));

const state = await page.evaluate(()=>({
  whip: window.G.active.top.whip.blobs.length,
  driz: window.G.active.top.drizzle ? window.G.active.top.drizzle.pts.length : 0,
  spr: window.G.active.top.sprinkles ? window.G.active.top.sprinkles.dots.length : 0,
  calls: window.R.info.render.calls,
}));
await shoot(page, 'top_filled');
console.log('top station:', JSON.stringify(state), 'errors:', page.__errors);
await browser.close();

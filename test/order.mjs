import { launch, newPage, shoot } from './harness.mjs';

const browser = await launch();
const W=960,H=600,DPR=1;
const page = await newPage(browser, W, H, DPR);

// Start a day so customers spawn via the real game logic.
await page.evaluate(()=>{
  // press through title -> day intro -> play by calling startDay indirectly:
  const G = window.G;
  G.state='play'; G.day=1; G.station='order';
});
// Build a few customers directly using the real Customer class path is internal;
// instead fabricate customer-like objects with the fields the rig/pose need.
await page.evaluate(()=>{
  const G = window.G;
  const mk = (id,x,y,mood,walking)=>({
    id, name:'C'+id, order:{name:'Latte', cannoli:false},
    patience: mood==='furious'?0: mood==='angry'?0.2: mood==='meh'?0.4:0.9,
    state:'queue', x, y, tx:x, ty:y, walking:!!walking,
    bobPhase: id*1.3, mood, stompT: id*0.5, drain:0,
    skin:'#f3c9a0', shirt:['#e2574c','#3a86c8','#43a06d'][id%3],
    pants:'#3a4a5c', hairC:['#2c1c12','#a83a2a','#e0c060'][id%3], hairStyle:id%6,
    glasses:false, reaction:0,
    update(){},
  });
  G.customers = [
    mk(1, 210, 388, 'happy', false),
    mk(2, 305, 388, 'meh',   false),
    mk(3, 400, 388, 'angry', false),
    mk(4, 740, 320, 'happy', false),
  ];
  G.customers[3].state='waiting';
});
await new Promise(r=>setTimeout(r,600));

const state = await page.evaluate(()=>({
  calls: window.R.info.render.calls,
  custs: window.G.customers.length,
}));
await shoot(page,'order');
console.log('order:', JSON.stringify(state), 'errors:', page.__errors);
await browser.close();

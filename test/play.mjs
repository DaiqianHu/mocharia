import { launch, newPage, shoot, pageCoord } from './harness.mjs';

const browser = await launch();
const W=1200,H=760,DPR=2;   // deliberately retina + letterboxed, not 960x600
const page = await newPage(browser, W, H, DPR);
const click = async (vx,vy)=>{ const p=pageCoord(vx,vy,W,H); await page.mouse.click(p.x,p.y); await new Promise(r=>setTimeout(r,120)); };
const st = ()=>page.evaluate(()=>({state:window.G.state, station:window.G.station,
  custs:window.G.customers.length, tickets:window.G.tickets.length,
  front: window.G.customers[0] ? {x:Math.round(window.G.customers[0].x), state:window.G.customers[0].state} : null,
  active: !!window.G.active, err:window.__err||null}));

// title -> new game
await click(480, 430);
// dayIntro -> open shop / start day
await new Promise(r=>setTimeout(r,150));
await click(480, 514);
console.log('after start:', JSON.stringify(await st()));

// wait for the front customer to reach the counter (Take Order enables)
let ready=false;
for (let i=0;i<40;i++){
  const s = await st();
  if (s.front && s.front.x<=215 && s.station==='order'){ ready=true; break; }
  await new Promise(r=>setTimeout(r,300));
}
await shoot(page,'play_order');
// take order (real button)
await click(215, 496);
console.log('after take:', JSON.stringify(await st()));

// brew coffee: tab -> Brew, start machine 0, fast-forward, pour
await click(14+1*172+80, 546+22);   // Brew tab
await click(133, 476);              // machStart (selected machine 0 = coffee)
await page.evaluate(()=>{ const m=window.G.machines[window.G.selMachine]; m.t=m.total; m.state='done'; });
await click(313, 476);              // Pour into Cup
// milk: select machine 2 by tapping it, start, ff, pour
await click(376+70, 255);           // tap milk machine 3 (rect x376..516, mid y)
await click(133, 476);              // start
await page.evaluate(()=>{ const m=window.G.machines[window.G.selMachine]; m.t=m.total; m.state='done'; });
await click(313, 476);              // pour
const brewState = await page.evaluate(()=>({sel:window.G.selMachine,
  cup:window.G.active?{coffee:!!window.G.active.cup.coffee, milk:!!window.G.active.cup.milk}:null}));
console.log('after brew:', JSON.stringify(brewState));
await shoot(page,'play_brew');

// toppings: tab -> Toppings, grab whip, sweep over cup
await click(14+2*172+80, 546+22);
await page.evaluate(()=>{ // grab the whip container off the shelf (real shelfHit path)
  const s = window.__shelfGrab ? window.__shelfGrab() : null;
});
// simulate pointer-down on shelf whip (x70,y196) then sweep over cup
{ const p=pageCoord(70,196,W,H); await page.mouse.move(p.x,p.y); await page.mouse.down(); }
await page.evaluate(()=>{ window.G.pointer.down=true; window.G.pointer.x=70; window.G.pointer.y=196; });
await new Promise(r=>setTimeout(r,60));
for (let i=0;i<30;i++){ const vx=360+(i%20)*4; const p=pageCoord(vx,250,W,H);
  await page.mouse.move(p.x,p.y);
  await page.evaluate((vx)=>{window.G.pointer.x=vx; window.G.pointer.y=250;}, vx);
  await new Promise(r=>setTimeout(r,12)); }
await page.mouse.up();
await page.evaluate(()=>{ window.G.pointer.down=false; window.G.drag=null; });
const topState = await page.evaluate(()=>({whip:window.G.active?window.G.active.top.whip.blobs.length:0}));
console.log('after top:', JSON.stringify(topState));
await shoot(page,'play_top');

// serve
await click(832, 501);   // Serve button
await new Promise(r=>setTimeout(r,300));
console.log('after serve:', JSON.stringify(await st()));
await shoot(page,'play_after_serve');
console.log('errors:', page.__errors);
await browser.close();

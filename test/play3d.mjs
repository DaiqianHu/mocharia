/* Full end-to-end playthrough of the 3D café: take an order by tapping
   the customer sprite (raycast), brew coffee + milk on raycast-selected
   machines, pick a cup size, drag whip onto the cup plane, build a
   cannoli via the raycast end colliders, and serve. All scene taps go
   through window.V3 projected coords — the same math the game uses. */
import { launch, newPage, shoot, pageCoord } from './harness.mjs';

const browser = await launch();
const W=1200,H=760,DPR=1;
const page = await newPage(browser, W, H, DPR);
const click = async (vx,vy)=>{ const p=pageCoord(vx,vy,W,H); await page.mouse.click(p.x,p.y); await new Promise(r=>setTimeout(r,140)); };
const st = ()=>page.evaluate(()=>({state:window.G.state, station:window.G.station,
  custs:window.G.customers.length, tickets:window.G.tickets.length, sel:window.G.selMachine,
  active: window.G.active ? {size:window.G.active.cupSize,
    coffee:!!window.G.active.cup.coffee, milk:!!window.G.active.cup.milk,
    whip:window.G.active.top.whip.blobs.length,
    cannoli: window.G.active.cannoli ? {shell:!!window.G.active.cannoli.shell,
      fillL:+window.G.active.cannoli.fillL.toFixed(2), fillR:+window.G.active.cannoli.fillR.toFixed(2)} : null} : null}));
let fails = 0;
const expect = (name, ok)=>{ console.log((ok?'  ok ':'FAIL ')+name); if(!ok) fails++; };

// ---- start a day ----
await click(480,430); await new Promise(r=>setTimeout(r,150)); await click(480,514);
for(let i=0;i<40;i++){ const s=await page.evaluate(()=>window.G.customers[0]?.x??999); if(s<=215)break; await new Promise(r=>setTimeout(r,300)); }

// ---- ORDER: tap the customer sprite itself (raycast) ----
const cs = await page.evaluate(()=>window.V3.custScreen(window.G.customers[0]));
await click(cs.x, cs.y);
let s = await st();
expect('tap customer -> ticket taken', s.tickets===1 && s.active!==null);
// force a cannoli on the ticket so the cannoli station is exercised deterministically
await page.evaluate(()=>{ if (!window.G.active.cannoli)
  window.G.active.cannoli = { shell:null, cream:null, fillL:0, fillR:0, sprItem:null, dotsL:[], dotsR:[] };
  window.G.active.order.cannoli = window.G.active.order.cannoli || {
    shell: window.D.SHELLS[0], cream: window.D.CREAMS[0], sprinkles:null };
});

// ---- CAT: drain the customer's patience, pet Mocha, patience recovers ----
await page.evaluate(()=>{ window.G.customers[0].patience = 0.5; });
const cat = await page.evaluate(()=>window.V3.catScreen());
await click(cat.x, cat.y+18);
{
  const r = await page.evaluate(()=>({ pat:window.G.customers[0].patience, petT:window.G.cat.petT }));
  expect('petting the cat calms the customer', r.petT>0 && r.pat>0.6);
}

// ---- BREW: raycast machine selection ----
await click(14+1*172+80, 546+22);           // Brew tab
await new Promise(r=>setTimeout(r,900));    // camera flight
const m1 = await page.evaluate(()=>window.V3.machineScreen(1));
await click(m1.x, m1.y);
s = await st();
expect('tap machine 2 selects it', s.sel===1);
const m0 = await page.evaluate(()=>window.V3.machineScreen(0));
await click(m0.x, m0.y);
s = await st();
expect('tap machine 1 selects it', s.sel===0);
await click(133, 476);                      // Start
await page.evaluate(()=>{ const m=window.G.machines[window.G.selMachine]; m.t=m.total; });
await new Promise(r=>setTimeout(r,200));
await click(313, 476);                      // Pour
const m2 = await page.evaluate(()=>window.V3.machineScreen(2));
await click(m2.x, m2.y);                    // milk machine
await click(133, 476);
await page.evaluate(()=>{ const m=window.G.machines[window.G.selMachine]; m.t=m.total; });
await new Promise(r=>setTimeout(r,200));
await click(313, 476);
s = await st();
expect('coffee + milk poured', s.active.coffee && s.active.milk);
await shoot(page,'p2_brew');

// ---- TOPPINGS: size pick, then drag whip onto the raycast cup plane ----
await click(14+2*172+80, 546+22);
await new Promise(r=>setTimeout(r,900));
await click(160+1*180+60, 450);             // "Medium" size button
s = await st();
expect('size M picked', s.active.size==='M');
// grab whip from the 2D shelf (first base slot) and sweep across the cup
{
  const g = pageCoord(54,248,W,H); await page.mouse.move(g.x,g.y); await page.mouse.down();
  await new Promise(r=>setTimeout(r,80));
  const drag = await page.evaluate(()=>window.G.drag ? window.G.drag.cat : null);
  expect('whip grabbed off shelf', drag==='whip');
  for (let i=0;i<26;i++){
    const c = await page.evaluate((f)=>window.V3.cupScreen(240 + Math.sin(f)*0), i);
    const vx = c.x - 60 + i*4.6;
    const p = pageCoord(vx, c.y, W, H);
    await page.mouse.move(p.x, p.y);
    await new Promise(r=>setTimeout(r,25));
  }
  await page.mouse.up();
}
s = await st();
expect('whip landed on drink', s.active.whip>0);
await shoot(page,'p2_top');

// ---- CANNOLI: tap shell, pipe cream into both raycast ends ----
await click(14+3*172+80, 546+22);
await new Promise(r=>setTimeout(r,900));
// find the shell + cream shelf slots by probing the 5-col grid
let creamSlot=null, shellDone=false;
for (let i=0;i<10 && (!shellDone || !creamSlot);i++){
  const x=54+(i%5)*60, y=248+Math.floor(i/5)*56;
  const g = pageCoord(x,y,W,H);
  await page.mouse.move(g.x,g.y); await page.mouse.down();
  await new Promise(r=>setTimeout(r,60));
  const got = await page.evaluate(()=>window.G.drag ? window.G.drag.cat :
    (window.G.active.cannoli && window.G.active.cannoli.shell ? 'shell-picked' : null));
  await page.mouse.up();
  await new Promise(r=>setTimeout(r,60));
  if (got==='shell-picked') shellDone=true;
  else if (got==='cream' && !creamSlot) creamSlot={x,y};
}
expect('shell picked from shelf', shellDone);
expect('cream bag located', !!creamSlot);
for (const end of ['L','R']){
  const e = await page.evaluate((en)=>window.V3.cannoliEnd(en), end);
  const g = pageCoord(creamSlot.x, creamSlot.y, W, H);
  await page.mouse.move(g.x,g.y); await page.mouse.down();
  await new Promise(r=>setTimeout(r,60));
  const p = pageCoord(e.x, e.y, W, H);
  await page.mouse.move(p.x, p.y);
  await new Promise(r=>setTimeout(r,900));   // hold to pipe
  await page.mouse.up();
  await new Promise(r=>setTimeout(r,60));
}
s = await st();
expect('cream piped both ends', s.active.cannoli.fillL>0.15 && s.active.cannoli.fillR>0.15);
await shoot(page,'p2_cannoli');

// ---- SERVE (with a forced rush + streak so the tip multipliers are exercised) ----
const pre = await page.evaluate(()=>{
  window.G.streak.n = 3;
  window.G.rush = { at:[], idx:0, warn:0, active:true, t:9 };
  const t = window.G.active;
  return { price: t.order.price, pat: t.cust.patience };
});
await click(832, 501);
await new Promise(r=>setTimeout(r,400));
s = await st();
expect('served (ticket resolved)', s.tickets===0);
{
  const post = await page.evaluate(()=>({ served: window.G.served[0], streak: window.G.streak.n }));
  const total = post.served.total;
  const stars = total>=90?5 : total>=75?4 : total>=58?3 : total>=38?2 : 1;
  const n = stars>=3 ? 4 : 0;                       // serveActive bumps/resets before the tip
  const pat = Math.max(0, Math.min(1, pre.pat));
  const expectTip = pre.price*(total/100)*(0.25+0.75*pat)*(1+0.1*Math.min(5,n))*1.5;
  const gotTip = post.served.earn - pre.price;
  expect('rush+streak tip multipliers applied', Math.abs(gotTip-expectTip) <= Math.max(0.08, expectTip*0.05));
  expect('streak counter updated', post.streak===n);
}
await shoot(page,'p2_served');

const errs = await page.evaluate(()=>null);
console.log('page errors:', page.__errors);
console.log(fails===0 ? 'ALL PASS' : fails+' FAILURES');
await browser.close();
process.exit(fails===0 && page.__errors.length===0 ? 0 : 1);

/* Two-browser-page co-op playthrough over the local relay stub:
   host opens a room, guest joins by typing the code + name on the
   canvas keyboard, then the GUEST drives a full order through the
   wire (take order → brew → toppings → serve) while asserts check
   both sides of the replication. Ends with the host-drop path.
   Pattern: npm run build; npx vite preview --port 4231 &; node test/coop.mjs */
import { spawn } from 'child_process';
import { launch, newPage, pageCoord } from './harness.mjs';

// the relay stub (idempotent: if one is already on :8787, ours exits and
// the existing one serves)
const relay = spawn('node', ['test/relay.mjs'], { stdio: 'ignore' });
await new Promise(r=>setTimeout(r,500));

// two separate browsers, like two real devices — and so neither page is a
// throttled background tab
const hostBrowser  = await launch();
const guestBrowser = await launch();
const W=1200, H=760, DPR=1;
const host  = await newPage(hostBrowser, W, H, DPR);
const guest = await newPage(guestBrowser, W, H, DPR);

let fails = 0;
const expect = (name, ok)=>{ console.log((ok?'  ok ':'FAIL ')+name); if(!ok) fails++; };
const click = async (pg,px,py)=>{ const c=pageCoord(px,py,W,H); await pg.mouse.click(c.x,c.y); await new Promise(r=>setTimeout(r,140)); };
const sleep = ms=>new Promise(r=>setTimeout(r,ms));
const until = async (pg, fn, ms=10000)=>{ const t0=Date.now();
  while (Date.now()-t0<ms){ if (await pg.evaluate(fn)) return true; await sleep(150); } return false; };
const typeOnGrid = async (pg, text)=>{
  for (const ch of text){
    const pos = await pg.evaluate((c)=>{ const b=window.KG.btns.find(b=>b.label===c);
      return {x:b.x+b.w/2, y:b.y+b.h/2}; }, ch);
    await click(pg, pos.x, pos.y);
  }
};

// ---- lobby: host a room, guest joins with a name ----
await click(host, 480, 542);                 // Play Together!
await click(host, 480, 296);                 // Host a Café
expect('host got a room code', await until(host, ()=>window.NET.code.length===4));
const code = await host.evaluate(()=>window.NET.code);

await click(guest, 480, 542);
await click(guest, 480, 368);                // Join a Café
await typeOnGrid(guest, code);
await click(guest, 822, 551);                // Join! →
expect('guest reached name entry', await until(guest, ()=>window.G.state==='coopName'));
await typeOnGrid(guest, 'MAYA');
await click(guest, 822, 551);                // Done! →
expect('host sees MAYA join', await until(host, ()=>window.G.p2 && window.G.p2.name==='MAYA'));
expect('host moved to dayIntro', await host.evaluate(()=>window.G.state==='dayIntro'));

// ---- host opens the shop; guest follows via snapshots ----
await click(host, 480, 514);                 // Open the Shop
expect('guest followed into play', await until(guest, ()=>window.G.state==='play'));
expect('guest sees replicated machines', await guest.evaluate(()=>window.G.machines.length===4));

// ---- GUEST takes the order through the wire ----
expect('guest sees the first customer arrive',
  await until(guest, ()=>window.G.customers.length>0 && window.G.customers[0].x<=215, 15000));
const cs = await guest.evaluate(()=>window.V3.custScreen(window.G.customers[0]));
await click(guest, cs.x, cs.y);
expect('host took the order (wire)', await until(host, ()=>window.G.tickets.length===1));
expect('guest got the ticket + active', await until(guest, ()=>window.G.tickets.length===1 && !!window.G.active));

// ---- GUEST brews coffee + milk on the host's machines ----
await click(guest, 14+1*172+80, 568);        // Brew tab (guest-local camera)
const m0 = await guest.evaluate(()=>window.V3.machineScreen(0));
await click(guest, m0.x, m0.y);
await click(guest, 133, 476);                // Start
expect('host machine started (wire)', await until(host, ()=>window.G.machines[0].state==='run'));
await host.evaluate(()=>{ const m=window.G.machines[0]; m.t=m.total; });
expect('guest sees it done', await until(guest, ()=>window.G.machines[0].state==='done'));
await click(guest, 313, 476);                // Pour
expect('host cup got coffee (wire)', await until(host, ()=>{
  const t=window.G.p2.active; return !!(t && t.cup.coffee); }));
const m2 = await guest.evaluate(()=>window.V3.machineScreen(2));
await click(guest, m2.x, m2.y);
await click(guest, 133, 476);
await host.evaluate(()=>{ const m=window.G.machines[2]; m.t=m.total; });
await until(guest, ()=>window.G.machines[2].state==='done');
await click(guest, 313, 476);
expect('host cup got milk (wire)', await until(host, ()=>{
  const t=window.G.p2.active; return !!(t && t.cup.milk); }));

// ---- GUEST tops: size + whip drag streamed with guest-side raycast ----
await click(guest, 14+2*172+80, 568);        // Toppings tab
await click(guest, 160+1*180+60, 450);       // Medium
expect('host saw size pick (wire)', await until(host, ()=>{
  const t=window.G.p2.active; return t && t.cupSize==='M'; }));
{
  const g = pageCoord(54,248,W,H);
  await guest.mouse.move(g.x,g.y); await guest.mouse.down();
  await sleep(120);
  let sawDrag = false;
  for (let i=0;i<26;i++){
    const c = await guest.evaluate(()=>window.V3.cupScreen(240));
    const p = pageCoord(c.x-60+i*4.6, c.y, W, H);
    await guest.mouse.move(p.x, p.y);
    await sleep(30);
    if (!sawDrag && i>4) sawDrag = await host.evaluate(()=>!!(window.G.p2 && window.G.p2.drag));
  }
  await guest.mouse.up();
  expect('host received the drag stream', sawDrag);
}
expect('whip landed on the host ticket (wire)', await until(host, ()=>{
  const t=window.G.p2.active; return t && t.top.whip.blobs.length>0; }));

// ---- GUEST serves; both see the result; guest Continue clears it ----
// (orders may want a cannoli — skip it by forcing the order simple on the host)
await host.evaluate(()=>{ const t=window.G.p2.active;
  t.order.cannoli=null; t.cannoli=null; t.order.milkAmt = t.cup.milk ? t.order.milkAmt||1 : 0; });
await sleep(300);
await click(guest, 832, 501);                // Serve!
expect('host recorded the serve (wire)', await until(host, ()=>window.G.served.length===1));
expect('guest sees the result card', await until(guest, ()=>!!window.G.result));
await click(guest, 480, 536);                // Continue (BT.cont)
expect('guest Continue cleared the host result (wire)', await until(host, ()=>!window.G.result));

// ---- host drop ends the room ----
await host.close();
expect('guest lands on hostLeft', await until(guest, ()=>window.G.state==='hostLeft'));
expect('guest save unmirrored', await guest.evaluate(()=>!window.P.__mirror));

console.log('guest errors:', guest.__errors);
console.log(fails===0 ? 'ALL PASS' : fails+' FAILURES');
const guestErrs = guest.__errors.length;
await hostBrowser.close();
await guestBrowser.close();
relay.kill();
process.exit(fails===0 && guestErrs===0 ? 0 : 1);

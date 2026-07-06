import { launch, newPage, shoot, pageCoord } from './harness.mjs';
const browser = await launch();
const W=1200,H=760;
const page = await newPage(browser, W, H, 1);
const click = async (vx,vy)=>{ const p=pageCoord(vx,vy,W,H); await page.mouse.click(p.x,p.y); await new Promise(r=>setTimeout(r,120)); };
await click(480,430); await new Promise(r=>setTimeout(r,150)); await click(480,514);
for(let i=0;i<40;i++){ const s=await page.evaluate(()=>window.G.customers[0]?.x??999); if(s<=215)break; await new Promise(r=>setTimeout(r,300)); }
// take order via button, then force-fill the ticket to visualize content
await click(215,496);
await page.evaluate(()=>{
  const t = window.G.active;
  const D = window.D;
  t.cupSize = 'M';
  t.cup.coffee = { type: D.COFFEES[0], temp:'iced', amt:1, addin:null };
  t.cup.milk   = { type: D.MILKS[0], temp:'cold', amt:2, addin:null };
  // whip + drizzle + sprinkles
  for (let i=0;i<14;i++) t.top.whip.blobs.push({x:-0.35+i*0.05, size:0.13});
  t.top.whip.cov = t.top.whip.cov.map(()=>1);
  t.top.drizzle = { item: D.DRIZZLES[0], cov:new Array(8).fill(1),
    pts: Array.from({length:24},(_,i)=>({x:-0.4+i*0.033, y:(i%2? -3:5)})) };
  t.top.sprinkles = { item: D.SPRINKLE_SETS[0], cov:new Array(8).fill(1),
    dots: Array.from({length:30},(_,i)=>({x:-0.42+i*0.028, y:(i%5-2)*2, rot:i, color:D.SPRINKLE_SETS[0].colors[i%3]})) };
  // cannoli even if not ordered: force one for the visual check
  t.cannoli = { shell: D.SHELLS[0], cream: D.CREAMS[0], fillL:0.9, fillR:0.55, sprItem: D.SPRINKLE_SETS[0],
    dotsL: Array.from({length:20},(_,i)=>({a:i*0.7, rr:(i%10)/10, rot:i, color:D.SPRINKLE_SETS[0].colors[i%3]})),
    dotsR: Array.from({length:12},(_,i)=>({a:i*1.1, rr:(i%10)/10, rot:i, color:D.SPRINKLE_SETS[0].colors[i%3]})) };
});
await shoot(page,'f_order');
for (const [i,name] of [[1,'brew'],[2,'top'],[3,'cannoli']]){
  await click(14+i*172+80, 546+22);
  await new Promise(r=>setTimeout(r,1000));
  await shoot(page,'f_'+name);
}
console.log('errors:', page.__errors);
await browser.close();

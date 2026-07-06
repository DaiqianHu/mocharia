import { launch, newPage, shoot, pageCoord } from './harness.mjs';
const browser = await launch();
const W=1200,H=760,DPR=1;
const page = await newPage(browser, W, H, DPR);
const click = async (vx,vy)=>{ const p=pageCoord(vx,vy,W,H); await page.mouse.click(p.x,p.y); await new Promise(r=>setTimeout(r,120)); };
await click(480,430); await new Promise(r=>setTimeout(r,150)); await click(480,514);
// wait for a customer to arrive at the counter
for(let i=0;i<40;i++){ const s=await page.evaluate(()=>window.G.customers[0]?.x??999); if(s<=215)break; await new Promise(r=>setTimeout(r,300)); }
const health = await page.evaluate(()=>({gl2: !!document.getElementById('game3d').getContext('webgl2'), calls: window.R.info.render.calls, state:window.G.state}));
console.log('health:', JSON.stringify(health));
await shoot(page,'p1_order');
// fly to each station via tab clicks; wait out the 0.7s flight
for (const [i,name] of [[1,'brew'],[2,'top'],[3,'cannoli']]){
  await click(14+i*172+80, 546+22);
  await new Promise(r=>setTimeout(r,1000));
  await shoot(page,'p1_'+name);
}
console.log('errors:', page.__errors);
await browser.close();

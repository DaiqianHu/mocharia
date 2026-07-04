import { launch, newPage, shoot } from './harness.mjs';

const browser = await launch();
const sizes = [
  ['identity', 960, 600, 1],
  ['wide',     1440, 720, 2],
  ['tall',     900, 820, 1.5],
];

for (const [name, W, H, DPR] of sizes){
  const page = await newPage(browser, W, H, DPR);
  // start a real day so real Customer instances spawn
  await page.evaluate(()=>{
    const G = window.G;
    G.state='play'; G.station='order'; G.day=1;
    G.customers.length=0; G.tickets.length=0; G.active=null;
    G.spawn.total=6; G.spawn.left=6; G.spawn.timer=0.05;
  });
  // force several rapid spawns
  for (let i=0;i<5;i++){
    await page.evaluate(()=>{ window.G.spawn.timer=0; });
    await new Promise(r=>setTimeout(r,140));
  }
  // snap customers to their target spots (skip the walk-in), vary moods
  await page.evaluate(()=>{
    const moods=['happy','meh','angry','furious'];
    window.G.customers.forEach((c,i)=>{
      c.x=c.tx; c.y=c.ty; c.walking=false; c.state='queue';
      c.mood=moods[i%moods.length];
      c.patience=[0.9,0.45,0.2,0][i%4];
    });
  });
  await new Promise(r=>setTimeout(r,300));

  const info = await page.evaluate(()=>({
    gl: !!document.getElementById('game3d').getContext('webgl2'),
    calls: window.R.info.render.calls,
    n: window.G.customers.length,
    hasFig: typeof window.G.customers[0]?.drawFigure === 'function',
  }));
  await shoot(page, 'cust2d-'+name);
  console.log(name, JSON.stringify(info), 'errors:', page.__errors);
  await page.close();
}
await browser.close();

import { launch, newPage, shoot } from './harness.mjs';

const browser = await launch();
const W=960,H=600,DPR=1;
const page = await newPage(browser, W, H, DPR);

// Enter play at the brew station with a hand-built machine line.
await page.evaluate(()=>{
  const G = window.G;
  G.state='play'; G.day=1; G.station='brew';
  const coffeeT={id:'house',name:'House Roast',color:'#3a2317'};
  const milkT={id:'whole',name:'Whole Milk',color:'#f4ecdb'};
  const base=[
    {kind:'coffee', x:60,  y:150, w:140, type:coffeeT},
    {kind:'coffee', x:218, y:150, w:140, type:coffeeT},
    {kind:'milk',   x:376, y:150, w:140, type:milkT},
    {kind:'milk',   x:534, y:150, w:140, type:milkT},
  ];
  G.machines = base.map(m=>({ ...m, temp:'hot', amt:1, state:'idle', t:0, total:0 }));
  // machine 0: coffee, hot, 3 shots, running mid-way
  const m0=G.machines[0]; m0.amt=3; m0.state='run'; m0.total=15; m0.t=9;
  // machine 1: coffee, iced, 2 shots, done
  const m1=G.machines[1]; m1.amt=2; m1.temp='iced'; m1.state='done';
  // machine 2: milk, cold, running
  const m2=G.machines[2]; m2.amt=2; m2.temp='cold'; m2.state='run'; m2.total=10; m2.t=5;
  G.selMachine=1;
});
await new Promise(r=>setTimeout(r,250));

const state = await page.evaluate(()=>({
  calls: window.R.info.render.calls,
  sel: window.G.selMachine,
  states: window.G.machines.map(m=>m.state),
}));
await shoot(page, 'brew');
console.log('brew:', JSON.stringify(state), 'errors:', page.__errors);
await browser.close();

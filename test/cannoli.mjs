import { launch, newPage, shoot, pageCoord } from './harness.mjs';

const browser = await launch();
const W=960,H=600,DPR=1;
const page = await newPage(browser, W, H, DPR);

// Play at cannoli station with an active ticket that has a cannoli.
await page.evaluate(()=>{
  const G = window.G;
  G.state='play'; G.day=1; G.station='cannoli';
  const cream={id:'choc',name:'Chocolate',color:'#5a3826'};
  const coffee={id:'house',name:'House Roast',color:'#3a2317'};
  const milk={id:'whole',name:'Whole Milk',color:'#f4ecdb'};
  const order={ coffee, shots:2, coffeeTemp:'hot', milk, milkAmt:1, milkTemp:'hot',
    whip:false, drizzle:null, sprinkles:null, cannoli:{cream, sprinkles:null}, name:'House Roast', price:6.5 };
  const t = {
    id:1, cust:{name:'Ava', patience:1, mood:'happy', state:'waiting'}, order,
    cup:{coffee:null, milk:null}, top:{whip:{cov:[],blobs:[]},drizzle:null,sprinkles:null},
    cannoli:{ cream:null, fillL:0, fillR:0, dotsL:[], dotsR:[] },
    x:12, slot:12, flash:0, cannoliReady(){return true;}, ready(){return true;},
  };
  G.active=t; G.tickets=[t];
});
await new Promise(r=>setTimeout(r,200));

// pipe cream into both ends
async function pipe(end){
  const vx = end==='L' ? 250 : 490;
  await page.evaluate((cream)=>{
    window.G.drag={cat:'cream', item:{id:'choc', name:'Chocolate', color:'#5a3826'}};
    window.G.pointer.down=true;
  });
  for (let i=0;i<60;i++){
    const pc=pageCoord(vx,300,W,H);
    await page.mouse.move(pc.x,pc.y);
    await page.evaluate((vx)=>{ window.G.pointer.x=vx; window.G.pointer.y=300; }, vx);
    await new Promise(r=>setTimeout(r,10));
  }
}
await pipe('L');
await pipe('R');
// sprinkle ends
async function sprinkle(end){
  const vx = end==='L' ? 250 : 490;
  await page.evaluate(()=>{
    window.G.drag={cat:'endsprinkles', item:{id:'rb', colors:['#ff5a5f','#ffb400','#2fd08c','#3aa0ff']}};
    window.G.pointer.down=true;
  });
  for (let i=0;i<170;i++){
    const pc=pageCoord(vx,300,W,H);
    await page.mouse.move(pc.x,pc.y);
    await page.evaluate((vx)=>{ window.G.pointer.x=vx; window.G.pointer.y=300; }, vx);
    await new Promise(r=>setTimeout(r,10));
  }
}
await sprinkle('L'); await sprinkle('R');
await page.evaluate(()=>{ window.G.pointer.down=false; window.G.drag=null; });
await new Promise(r=>setTimeout(r,200));

const state = await page.evaluate(()=>({
  fillL:window.G.active.cannoli.fillL.toFixed(2),
  fillR:window.G.active.cannoli.fillR.toFixed(2),
  dotsL:window.G.active.cannoli.dotsL.length,
  dotsR:window.G.active.cannoli.dotsR.length,
  calls:window.R.info.render.calls,
}));
await shoot(page,'cannoli');
console.log('cannoli:', JSON.stringify(state), 'errors:', page.__errors);
await browser.close();

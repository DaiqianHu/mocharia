import { launch, newPage, shoot, sample, near } from './harness.mjs';

// Verify the 2D HUD lines up with the 3D letterbox at several window
// sizes and device-pixel-ratios — the exact axis the previous attempt,
// which only ever tested at 960x600 dpr1, silently broke on.
const CASES = [
  { w:960,  h:600,  dpr:1,  name:'base' },
  { w:1280, h:800,  dpr:2,  name:'retina' },     // dpr2 + pillarbox
  { w:1440, h:720,  dpr:1,  name:'wide' },        // wider aspect -> pillarbox
  { w:900,  h:820,  dpr:1,  name:'tall' },        // taller aspect -> letterbox
  { w:1024, h:640,  dpr:1.5,name:'odd' },
];

const browser = await launch();
let fail = 0;

for (const cs of CASES){
  const page = await newPage(browser, cs.w, cs.h, cs.dpr);
  // Enter the brew station with a populated machine line (lots of HUD).
  await page.evaluate(()=>{
    const G = window.G; G.state='play'; G.day=1; G.station='brew';
    G.spawn.left=9; G.dayEndT=0; // stay "busy" so endDay() can't race the sample
    const cT={id:'house',name:'House Roast',color:'#3a2317'};
    const mT={id:'whole',name:'Whole Milk',color:'#f4ecdb'};
    const base=[
      {kind:'coffee',x:60,y:150,w:140,type:cT},{kind:'coffee',x:218,y:150,w:140,type:cT},
      {kind:'milk',x:376,y:150,w:140,type:mT},{kind:'milk',x:534,y:150,w:140,type:mT}];
    G.machines=base.map(m=>({...m,temp:'hot',amt:2,state:'idle',t:0,total:0}));
    G.machines[0].state='run'; G.machines[0].total=15; G.machines[0].t=7;
    G.selMachine=2;
  });
  await new Promise(r=>setTimeout(r,250));

  const info = await page.evaluate(()=>{
    const g3 = document.getElementById('game3d');
    const g2 = document.getElementById('game');
    const r3 = g3.getBoundingClientRect(), r2 = g2.getBoundingClientRect();
    return {
      calls: window.R.info.render.calls,
      gl: !!g3.getContext('webgl2'),
      win:[window.innerWidth, window.innerHeight],
      rect3:[r3.left,r3.top,r3.width,r3.height],
      rect2:[r2.left,r2.top,r2.width,r2.height],
    };
  });
  const png = await shoot(page, 'verify_'+cs.name);

  // Expected letterbox rect for the 3D canvas, and full window for the 2D.
  const [w,h] = info.win;
  const scale = Math.min(w/960, h/600);
  const cssW = 960*scale, cssH = 600*scale;
  const offX = (w-cssW)/2, offY = (h-cssH)/2;
  const exp3 = [offX, offY, cssW, cssH];
  const exp2 = [0, 0, w, h];
  const d3 = info.rect3.map((v,i)=>Math.abs(v-exp3[i]));
  const d2 = info.rect2.map((v,i)=>Math.abs(v-exp2[i]));
  const ok3 = d3.every(d=>d<1.5), ok2 = d2.every(d=>d<1.5);
  const ok = info.gl && info.calls>0 && ok3 && ok2 && page.__errors.length===0;
  if (!ok) fail++;
  console.log(`${cs.name} ${cs.w}x${cs.h}@${cs.dpr}:`,
    'gl='+info.gl, 'calls='+info.calls,
    '3dRect='+(ok3?'OK':'BAD '+JSON.stringify(d3)),
    '2dRect='+(ok2?'OK':'BAD '+JSON.stringify(d2)),
    'errors='+page.__errors.length,
    ok?'PASS':'*** FAIL ***');
  await page.close();
}

console.log(fail? `\n${fail} case(s) FAILED` : '\nALL CASES PASS');
await browser.close();
process.exit(fail?1:0);

import { launch, newPage, shoot, sample, pageCoord, near } from './harness.mjs';

// Test WebGL/2D alignment at several viewport sizes and DPRs — including the
// non-identity letterbox cases that a real user sees (retina, odd sizes).
const CASES = [
  { w:960, h:600, dpr:1, name:'ident_960x600_dpr1' },
  { w:960, h:600, dpr:2, name:'retina_960x600_dpr2' },
  { w:1280, h:720, dpr:1, name:'wide_1280x720' },
  { w:1000, h:900, dpr:2, name:'tall_1000x900_dpr2' },
  { w:1440, h:600, dpr:1, name:'letterbox_sides_1440x600' },
];

const browser = await launch();
let fail = 0;
for (const cs of CASES){
  const page = await newPage(browser, cs.w, cs.h, cs.dpr);
  // force play + top station
  await page.evaluate(()=>{ window.G.state='play'; window.G.station='top'; });
  await new Promise(r=>setTimeout(r,400));

  const info = await page.evaluate(()=>({
    gl2: !!document.getElementById('game3d').getContext('webgl2') || !!window.R,
    calls: window.R ? window.R.info.render.calls : -1,
    c3: (()=>{ const c=document.getElementById('game3d'); const r=c.getBoundingClientRect();
      return { left:r.left, top:r.top, w:r.width, h:r.height, cw:c.width, ch:c.height }; })(),
  }));
  const png = await shoot(page, cs.name);

  // corner markers: green TL(20,20), cyan TR(940,20), yellow BL(20,580), magenta BR(940,580)
  const checks = [
    ['base', 400, 470, [255,0,0]],
    ['rim', 400, 220, [0,0,255]],
  ];
  let ok = true;
  const results = [];
  for (const [label, vx, vy, [r,g,b]] of checks){
    const pc = pageCoord(vx, vy, cs.w, cs.h);
    const c = sample(png, pc.x, pc.y, cs.dpr);
    const hit = near(c, r,g,b, 70);
    if (!hit) ok=false;
    results.push(`${label}@(${vx},${vy})->[${c.slice(0,3)}]${hit?'ok':'MISS'}`);
  }
  // expected CSS rect of #game3d
  const exp = pageCoord(0,0,cs.w,cs.h);
  const rectOk = Math.abs(info.c3.left-exp.offX)<1.5 && Math.abs(info.c3.top-exp.offY)<1.5
    && Math.abs(info.c3.w-960*exp.scale)<1.5 && Math.abs(info.c3.h-600*exp.scale)<1.5;
  const dprOk = Math.abs(info.c3.cw - 960*exp.scale*cs.dpr)<2;

  const pass = ok && rectOk && dprOk && info.calls>0 && page.__errors.length===0;
  if (!pass) fail++;
  console.log(`\n[${cs.name}] ${pass?'PASS':'*** FAIL ***'}`);
  console.log(`  render.calls=${info.calls} rectOk=${rectOk} dprOk=${dprOk} canvasBuf=${info.c3.cw}x${info.c3.ch}`);
  console.log(`  css rect: left=${info.c3.left.toFixed(1)} top=${info.c3.top.toFixed(1)} ${info.c3.w.toFixed(1)}x${info.c3.h.toFixed(1)} (exp off ${exp.offX.toFixed(1)},${exp.offY.toFixed(1)} size ${(960*exp.scale).toFixed(1)}x${(600*exp.scale).toFixed(1)})`);
  console.log('  '+results.join('  '));
  if (page.__errors.length) console.log('  ERRORS: '+page.__errors.join(' | '));
  await page.close();
}
await browser.close();
console.log(fail? `\n${fail} case(s) FAILED` : '\nALL ALIGNMENT CASES PASSED');
process.exit(fail?1:0);

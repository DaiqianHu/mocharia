import puppeteer from 'puppeteer-core';
import { PNG } from 'pngjs';
import fs from 'fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'http://localhost:4231/';
const OUT = process.env.OUT || '/tmp/mr';
fs.mkdirSync(OUT, { recursive: true });

export async function launch(){
  return puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--headless=new','--use-gl=swiftshader','--enable-webgl',
      '--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--no-sandbox',
      // co-op tests run two pages; background tabs must keep their rAF loop
      // (the host page freezing = no snapshots)
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'],
  });
}

// virtual (px,py) -> CSS page coords given viewport w,h
export function pageCoord(px,py,w,h){
  const scale = Math.min(w/960, h/600);
  const offX = (w-960*scale)/2, offY=(h-600*scale)/2;
  return { x: offX+px*scale, y: offY+py*scale, scale, offX, offY };
}

export async function newPage(browser, w, h, dpr){
  const page = await browser.newPage();
  await page.setViewport({ width:w, height:h, deviceScaleFactor:dpr });
  const errors=[];
  page.on('pageerror', e=>errors.push('PAGEERROR: '+e.message));
  page.on('console', m=>{ const t=m.text();
    if(m.type()==='error' && !/favicon|Failed to load resource|404/.test(t)) errors.push('CONSOLE: '+t); });
  page.__errors = errors;
  // 'load' + poll for the game global: networkidle0 can hang forever on
  // multi-page runs (pending-resource accounting quirk in headless+SwiftShader)
  await page.goto(URL, { waitUntil:'load' });
  await page.waitForFunction(() => window.G && window.R, { timeout: 15000 });
  return page;
}

// sample a pixel from a screenshot PNG at CSS coords (PNG is in device px)
export function sample(png, cssX, cssY, dpr){
  const x=Math.round(cssX*dpr), y=Math.round(cssY*dpr);
  const idx=(png.width*y+x)*4;
  return [png.data[idx],png.data[idx+1],png.data[idx+2],png.data[idx+3]];
}
export async function shoot(page, name){
  const buf = Buffer.from(await page.screenshot());
  fs.writeFileSync(`${OUT}/${name}.png`, buf);
  return PNG.sync.read(buf);
}
export function near(c, r,g,b, tol=60){
  return Math.abs(c[0]-r)<tol && Math.abs(c[1]-g)<tol && Math.abs(c[2]-b)<tol;
}

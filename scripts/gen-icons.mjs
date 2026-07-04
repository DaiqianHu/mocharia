// One-off generator for the PWA app icons under public/icons/.
// Renders an SVG (matching the game's mocha palette) via headless Chrome
// screenshots instead of a raster image library, since none is installed.
// Re-run with `node scripts/gen-icons.mjs` if the icon design changes.
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT_DIR = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(OUT_DIR, { recursive: true });

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#160d0b"/>
  <rect x="16" y="16" width="480" height="480" rx="96" fill="#3a2418"/>
  <g transform="translate(256 268)">
    <path d="M-118 -186 C-108 -226 -78 -226 -68 -196" stroke="#e8c87a" stroke-width="18" fill="none" stroke-linecap="round"/>
    <path d="M-52 -196 C-42 -236 -12 -236 -2 -206" stroke="#e8c87a" stroke-width="18" fill="none" stroke-linecap="round"/>
    <path d="M14 -186 C24 -226 54 -226 64 -196" stroke="#e8c87a" stroke-width="18" fill="none" stroke-linecap="round"/>
    <path d="M170 40 Q210 40 210 4 Q210 -32 170 -32 L170 -4 Q186 -4 186 4 Q186 12 170 12 Z" fill="#f2e0c8"/>
    <path d="M-150 -40 L150 -40 L128 96 Q120 128 84 128 L-84 128 Q-120 128 -128 96 Z" fill="#f2e0c8"/>
    <path d="M-150 -40 L150 -40 L143 8 L-143 8 Z" fill="#cf8c38"/>
    <rect x="-160" y="-60" width="320" height="24" rx="12" fill="#f2e0c8"/>
  </g>
</svg>`;

const html = `<!doctype html><html><head><style>
  html,body{margin:0;padding:0;background:transparent;}
  svg{display:block;width:100vw;height:100vh;}
</style></head><body>${svg}</body></html>`;

const htmlPath = path.join(OUT_DIR, '_icon-source.html');
fs.writeFileSync(htmlPath, html);

const sizes = [180, 192, 512];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--headless=new', '--no-sandbox'],
});
for (const size of sizes) {
  const page = await browser.newPage();
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.goto('file://' + htmlPath, { waitUntil: 'load' });
  const buf = await page.screenshot({ omitBackground: false });
  fs.writeFileSync(path.join(OUT_DIR, `icon-${size}.png`), buf);
  await page.close();
}
await browser.close();
fs.unlinkSync(htmlPath);
console.log('Wrote icons:', sizes.map(s => `icon-${s}.png`).join(', '));

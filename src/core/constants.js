/* ============================================================
   Core constants & math/render utilities.
   Pure leaf module — depends on nothing else in the project.
   ============================================================ */

export const VW = 960, VH = 600, TAU = Math.PI * 2;

export const clamp = (v,a,b)=> v<a?a: v>b?b: v;
export const lerp  = (a,b,t)=> a+(b-a)*t;
export const rand  = (a,b)=> a+Math.random()*(b-a);
export const randi = (a,b)=> Math.floor(rand(a,b+1));
export const choice= (arr)=> arr[Math.floor(Math.random()*arr.length)];
export const easeOut = t => 1-Math.pow(1-clamp(t,0,1),3);
export const easeInOut = t => { t=clamp(t,0,1); return t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; };
export const fmt$ = v => '$'+v.toFixed(2);

export function rr(c,x,y,w,h,r){ // rounded-rect path
  r = Math.min(r, w/2, h/2);
  c.beginPath();
  c.moveTo(x+r,y);
  c.arcTo(x+w,y,x+w,y+h,r);
  c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r);
  c.arcTo(x,y,x+w,y,r);
  c.closePath();
}

export function shade(hex, amt){ // lighten(+)/darken(-) a #rrggbb
  const n = parseInt(hex.slice(1),16);
  let r=(n>>16)+amt, g=((n>>8)&255)+amt, b=(n&255)+amt;
  r=clamp(r,0,255); g=clamp(g,0,255); b=clamp(b,0,255);
  return '#'+((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
}

/* weighted blend of #rrggbb colors: mixHex([[hex,weight],...]) */
export function mixHex(pairs){
  let r=0,g=0,b=0,w=0;
  for (const [hex,wt] of pairs){
    if (!hex || wt<=0) continue;
    const n = parseInt(hex.slice(1),16);
    r += (n>>16)*wt; g += ((n>>8)&255)*wt; b += (n&255)*wt; w += wt;
  }
  if (w<=0) return '#000000';
  r=Math.round(r/w); g=Math.round(g/w); b=Math.round(b/w);
  return '#'+((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
}

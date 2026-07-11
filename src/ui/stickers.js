/* ============================================================
   Emote stickers — co-op reactions. A tap on the tray plays a
   sound + small confirmation here and sends {t:'emote'} to the
   partner, where the same sticker pops BIG mid-screen. All art is
   hand-drawn canvas paths in the game's toon style (warm near-black
   ink outlines), drawn in a local space centered on (0,0) with
   radius r so the same drawing serves tray icons, confirmations and
   the big receiver pop. Deliberately a leaf module: no game state
   imported — callers pass `playing` in and do the net send.
   ============================================================ */
import { TAU, rand } from '../core/constants.js';
import { emoteSound } from '../core/audio.js';

export const EMOTES = ['heart', 'laugh', 'hurry', 'cat', 'star'];

const INK = '#3a2216';
const active = [];        // {id, big, t, life, x, y, rot}
let cooldownT = 0;        // sender-side anti-spam

/* ---- the five drawings ---- */
function star(c, R, inner, n, rot=-Math.PI/2){
  c.beginPath();
  for (let i=0;i<n*2;i++){
    const a = rot + i*Math.PI/n, rr = i%2===0 ? R : inner;
    c[i===0?'moveTo':'lineTo'](Math.cos(a)*rr, Math.sin(a)*rr);
  }
  c.closePath();
}

export function drawStickerArt(c, id, r){
  c.save();
  c.lineJoin = 'round'; c.lineCap = 'round';
  if (id === 'heart'){
    c.beginPath();
    c.moveTo(0, r*0.68);
    c.bezierCurveTo(-r*0.86, r*0.1, -r*0.66, -r*0.72, 0, -r*0.3);
    c.bezierCurveTo(r*0.66, -r*0.72, r*0.86, r*0.1, 0, r*0.68);
    c.closePath();
    c.fillStyle = '#ff7fa6'; c.fill();
    c.strokeStyle = INK; c.lineWidth = r*0.12; c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.beginPath(); c.arc(-r*0.3, -r*0.22, r*0.13, 0, TAU); c.fill();
  } else if (id === 'laugh'){
    c.beginPath(); c.arc(0, 0, r*0.92, 0, TAU);
    c.fillStyle = '#ffd24a'; c.fill();
    c.strokeStyle = INK; c.lineWidth = r*0.1; c.stroke();
    // squint eyes (∩) + big open laugh with a tongue
    c.lineWidth = r*0.09;
    c.beginPath(); c.arc(-r*0.34, -r*0.16, r*0.17, Math.PI, 0); c.stroke();
    c.beginPath(); c.arc( r*0.34, -r*0.16, r*0.17, Math.PI, 0); c.stroke();
    c.beginPath(); c.arc(0, r*0.16, r*0.42, 0, Math.PI); c.closePath();
    c.fillStyle = '#7a2a1e'; c.fill();
    c.strokeStyle = INK; c.lineWidth = r*0.07; c.stroke();
    c.beginPath(); c.arc(0, r*0.42, r*0.2, Math.PI, 0);
    c.fillStyle = '#e2574c'; c.fill();
    // tears flying off
    c.fillStyle = '#9ad0ff'; c.strokeStyle = INK; c.lineWidth = r*0.05;
    for (const dx of [-1, 1]){
      c.beginPath(); c.arc(dx*r*0.82, -r*0.02, r*0.14, 0, TAU); c.fill(); c.stroke();
    }
  } else if (id === 'hurry'){
    star(c, r, r*0.66, 11, 0.12);
    c.fillStyle = '#ffd24a'; c.fill();
    c.strokeStyle = '#e0813a'; c.lineWidth = r*0.07; c.stroke();
    c.fillStyle = INK;
    c.font = '900 ' + Math.round(r*0.34) + 'px "Trebuchet MS", Verdana, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('HURRY!', 0, r*0.02);
  } else if (id === 'cat'){
    // Mocha! (palette from render/cat.js)
    const FUR = '#8a6244', CREAM = '#e8d6b8', PINK = '#f2b9c4';
    c.strokeStyle = INK; c.lineWidth = r*0.09;
    for (const dx of [-1, 1]){        // ears with pink inners
      c.beginPath();
      c.moveTo(dx*r*0.72, -r*0.28); c.lineTo(dx*r*0.52, -r*0.95); c.lineTo(dx*r*0.14, -r*0.6);
      c.closePath(); c.fillStyle = FUR; c.fill(); c.stroke();
      c.beginPath();
      c.moveTo(dx*r*0.56, -r*0.42); c.lineTo(dx*r*0.47, -r*0.74); c.lineTo(dx*r*0.28, -r*0.56);
      c.closePath(); c.fillStyle = PINK; c.fill();
    }
    c.beginPath(); c.arc(0, 0, r*0.78, 0, TAU);
    c.fillStyle = FUR; c.fill(); c.stroke();
    c.beginPath(); c.ellipse(0, r*0.3, r*0.42, r*0.3, 0, 0, TAU);
    c.fillStyle = CREAM; c.fill();
    c.fillStyle = PINK;
    c.beginPath();
    c.moveTo(-r*0.09, r*0.14); c.lineTo(r*0.09, r*0.14); c.lineTo(0, r*0.26);
    c.closePath(); c.fill();
    c.lineWidth = r*0.06;
    c.beginPath(); c.arc(-r*0.3, -r*0.14, r*0.14, Math.PI, 0); c.stroke();   // happy shut eyes
    c.beginPath(); c.arc( r*0.3, -r*0.14, r*0.14, Math.PI, 0); c.stroke();
    c.beginPath(); c.arc(-r*0.09, r*0.32, r*0.09, 0, Math.PI);              // w mouth
    c.arc(r*0.09, r*0.32, r*0.09, 0, Math.PI); c.stroke();
    c.lineWidth = r*0.045;
    for (const dx of [-1, 1]) for (const dy of [-0.06, 0.1]){               // whiskers
      c.beginPath(); c.moveTo(dx*r*0.5, r*(0.22+dy));
      c.lineTo(dx*r*1.02, r*(0.14+dy*2)); c.stroke();
    }
  } else {   // star
    star(c, r, r*0.46, 5);
    c.fillStyle = '#ffd24a'; c.fill();
    c.strokeStyle = INK; c.lineWidth = r*0.1; c.stroke();
    c.lineWidth = r*0.06;
    c.beginPath(); c.arc(-r*0.2, -r*0.06, r*0.09, Math.PI, 0); c.stroke();  // wink
    c.fillStyle = INK;
    c.beginPath(); c.arc(r*0.2, -r*0.06, r*0.055, 0, TAU); c.fill();
    c.beginPath(); c.arc(0, r*0.1, r*0.16, 0.15*Math.PI, 0.85*Math.PI); c.stroke();
  }
  c.restore();
}

/* ---- send / receive / animate ---- */
export function tryEmote(id){
  if (cooldownT > 0 || !EMOTES.includes(id)) return false;
  cooldownT = 0.8;
  // small confirmation drifting up from the tray
  active.push({ id, big:false, t:0, life:0.9, x:788, y:498, rot:-0.06 });
  emoteSound(id);
  return true;
}

export function receiveEmote(id){
  if (!EMOTES.includes(id)) return;     // never trust the wire
  if (active.length >= 6) active.shift();
  active.push({ id, big:true, t:0, life:1.8,
    x: 480 + rand(-28, 28), y: 235 + rand(-20, 20), rot: rand(-0.09, 0.09) });
  emoteSound(id);
}

export function emoteCooldown(){ return cooldownT; }

export function updateStickers(dt, playing){
  cooldownT = Math.max(0, cooldownT - dt);
  if (!playing){ active.length = 0; return; }
  for (let i = active.length-1; i >= 0; i--){
    const e = active[i]; e.t += dt;
    if (e.t >= e.life) active.splice(i, 1);
  }
}

function easeOutBack(u){
  u = Math.min(1, u);
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3*Math.pow(u-1, 3) + c1*Math.pow(u-1, 2);
}

export function drawStickers(c){
  for (const e of active){
    const r = e.big ? 95 : 34;
    const s = easeOutBack(e.t/0.22);                       // pop-in with overshoot
    const alpha = Math.min(1, (e.life - e.t)/0.3);         // fade at the end
    c.save();
    c.globalAlpha = alpha;
    c.translate(e.x, e.y - (e.big ? 0 : e.t*16));
    c.rotate(e.rot + Math.sin(e.t*5)*0.05);
    c.scale(s, s);
    drawStickerArt(c, e.id, r);
    c.restore();
  }
}

if (typeof window !== 'undefined') window.STICKERS = { active, emoteCooldown };  // test hook

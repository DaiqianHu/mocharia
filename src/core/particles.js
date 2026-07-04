/* ============================================================
   Particle system and floating score/text popups.
   ============================================================ */
import { TAU, rand, clamp, choice, rr } from './constants.js';

export const particles = [];
export const floats = [];

export function spawnParticle(p){
  p.life = p.life ?? 1; p.maxLife = p.life;
  p.vx = p.vx ?? 0; p.vy = p.vy ?? 0;
  p.g  = p.g  ?? 0; p.size = p.size ?? 3;
  p.drag = p.drag ?? 1; p.sway = p.sway ?? 0; p.phase = rand(0,TAU);
  p.rot = p.rot ?? 0; p.vr = p.vr ?? 0;
  if (particles.length < 900) particles.push(p);
}

export function popText(x,y,text,color,size=22){
  floats.push({x,y,text,color,size,life:1.15,vy:-42});
  if (floats.length>30) floats.shift();
}

export function updateParticles(dt){
  for (let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.life -= dt;
    if (p.life<=0){ particles.splice(i,1); continue; }
    p.vy += p.g*dt;
    p.vx *= Math.pow(p.drag, dt*60);
    p.vy *= Math.pow(p.drag, dt*60);
    p.x += p.vx*dt + (p.sway ? Math.sin(p.phase + p.life*6)*p.sway*dt : 0);
    p.y += p.vy*dt;
    p.rot += p.vr*dt;
    if (p.type==='sprinkle' && p.settleY!==undefined && p.y >= p.settleY){
      p.y = p.settleY; p.vx = 0; p.vy = 0; p.g = 0; p.vr = 0;
    }
  }
  for (let i=floats.length-1;i>=0;i--){
    const f = floats[i];
    f.life -= dt; f.y += f.vy*dt; f.vy *= 0.96;
    if (f.life<=0) floats.splice(i,1);
  }
}

export function drawParticles(c){
  for (const p of particles){
    const t = p.life/p.maxLife;
    c.save();
    c.globalAlpha = clamp(p.alpha!==undefined ? p.alpha*t : t, 0, 1);
    if (p.type==='steam'){
      c.fillStyle = p.color || 'rgba(255,255,255,0.9)';
      const s = p.size*(1.6-t*0.9);
      c.beginPath(); c.arc(p.x,p.y,s,0,TAU); c.fill();
    } else if (p.type==='confetti'){
      c.translate(p.x,p.y); c.rotate(p.rot);
      c.fillStyle = p.color;
      c.fillRect(-p.size/2,-p.size/4,p.size,p.size/2);
    } else if (p.type==='sprinkle'){
      c.translate(p.x,p.y); c.rotate(p.rot);
      c.fillStyle = p.color;
      rr(c,-p.size, -p.size*0.38, p.size*2, p.size*0.76, p.size*0.38); c.fill();
    } else if (p.type==='ring'){
      c.strokeStyle = p.color; c.lineWidth = 2*t;
      c.beginPath(); c.arc(p.x,p.y,p.size*(1.8-t),0,TAU); c.stroke();
    } else { // drop / spark
      c.fillStyle = p.color;
      c.beginPath(); c.arc(p.x,p.y,p.size*Math.max(0.4,t),0,TAU); c.fill();
    }
    c.restore();
  }
}

export function drawFloats(c){
  for (const f of floats){
    const a = clamp(f.life/0.4,0,1);
    c.save();
    c.globalAlpha = a;
    c.font = '800 '+f.size+'px "Trebuchet MS", Verdana, sans-serif';
    c.textAlign='center'; c.textBaseline='middle';
    c.lineWidth = 5; c.strokeStyle = 'rgba(40,20,10,0.85)'; c.lineJoin='round';
    c.strokeText(f.text, f.x, f.y);
    c.fillStyle = f.color; c.fillText(f.text, f.x, f.y);
    c.restore();
  }
}

export function confettiBurst(x,y,n=60){
  const cols=['#ff5a5f','#ffb400','#2fd08c','#3aa0ff','#c86bff','#fff3d0'];
  for(let i=0;i<n;i++){
    const a=rand(0,TAU), sp=rand(90,320);
    spawnParticle({type:'confetti',x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-140,
      g:420,drag:0.98,size:rand(6,11),color:choice(cols),life:rand(0.9,1.7),vr:rand(-9,9)});
  }
}

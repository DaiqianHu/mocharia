/* ============================================================
   Customer — a normal-looking person who walks in, queues, and
   waits. Patience drains but they NEVER leave without their
   coffee: they just get visibly angrier (stomping, grumbling)
   and tank your Order-station rating.
   ============================================================ */
import { choice, rand, randi, clamp, TAU, VW, shade, rr } from '../core/constants.js';
import { makeOrder, NAMES } from './data.js';
import { popText } from '../core/particles.js';
import { blip } from '../core/audio.js';

let _cid = 0;

export class Customer {
  constructor(day, unlocked, calm){
    this.id = ++_cid;
    this.name = choice(NAMES);
    this.order = makeOrder(day, unlocked);
    this.patience = 1;
    this.drain = calm / clamp(95 - day*4, 55, 95);   // seconds of patience
    this.state = 'enter';   // enter -> queue -> waiting -> served (walks out)
    this.x = VW+70; this.y = 380;
    this.tx = 0;    this.ty = 380;
    this.bobPhase = rand(0,TAU);
    this.mood = 'happy';    // happy / meh / angry / furious
    this.skin  = choice(['#f3c9a0','#e6b088','#c98f60','#8a5a3a','#f7d9b8','#6f4529']);
    this.shirt = choice(['#e2574c','#3a86c8','#43a06d','#c86bb8','#e0a437','#5f6fc4','#3fb0a8','#8a6ac0']);
    this.pants = choice(['#3a4a5c','#5a4632','#444','#6a5a7a','#2e4a3e']);
    this.hairC = choice(['#2c1c12','#5a3a1e','#8a5a2a','#c9c2b8','#a83a2a','#3a3a44','#e0c060']);
    this.hairStyle = randi(0,5);
    this.glasses = Math.random()<0.28;
    this.reaction = 0;      // pop after being served
    this.stompT = rand(0,1);// stomp animation clock
    this.grumbleT = rand(4,9);
    this.doneT = 0;
  }
  update(dt, game){
    const spd = 130;
    const dx = this.tx-this.x, dy = this.ty-this.y;
    const d = Math.hypot(dx,dy);
    this.walking = d>2;
    if (d>2){ this.x += dx/d*Math.min(spd*dt,d); this.y += dy/d*Math.min(spd*dt,d); }
    else if (this.state==='enter') this.state = 'queue';
    if (this.reaction>0) this.reaction -= dt;
    if (this.state==='queue' || this.state==='waiting'){
      this.patience = Math.max(0, this.patience - this.drain*dt);
      this.mood = this.patience>0.6 ? 'happy' : this.patience>0.3 ? 'meh'
                : this.patience>0   ? 'angry' : 'furious';
      if (this.mood==='angry' || this.mood==='furious'){
        this.stompT += dt * (this.mood==='furious' ? 7 : 4.5);
        this.grumbleT -= dt;
        if (this.grumbleT<=0){
          this.grumbleT = rand(5,10);
          popText(this.x, this.y-108, choice(['Hmph!','My coffee!!','Tap tap tap...','Grr...']), '#ff8a6f', 15);
          blip(150,0.12,'sawtooth',0.06,-40);
        }
      }
    }
    if (this.state==='served'){
      if (this.x <= -60 || this.x >= VW+60) this.doneT += dt;
    }
  }
  /* Draw the human figure centred on the current context origin (feet
     origin = this.x/this.y). Used to paint the customer onto its 2D
     sprite canvas; the patience meter is drawn separately as HUD. */
  drawFigure(c, t){
    const angry = this.mood==='angry' || this.mood==='furious';
    // stomp: sharp vertical jolts; calm: gentle idle bob
    const stomp = angry ? Math.abs(Math.sin(this.stompT*Math.PI))*6 : 0;
    const bob = angry ? -stomp : Math.sin(t*2.4 + this.bobPhase)*1.6;
    const walkA = this.walking ? Math.sin(t*11 + this.bobPhase)*1 : 0;
    const rx = this.reaction>0 ? 1+Math.sin(this.reaction*14)*0.06 : 1;
    c.save();
    c.translate(0, bob); c.scale(rx,rx);
    // shadow — two soft layers to fake a blurred contact shadow
    c.fillStyle='rgba(30,14,8,0.16)';
    c.beginPath(); c.ellipse(0, 66-bob, 30, 8.5, 0, 0, TAU); c.fill();
    c.fillStyle='rgba(30,14,8,0.24)';
    c.beginPath(); c.ellipse(0, 66-bob, 22, 6, 0, 0, TAU); c.fill();
    // legs + shoes (alternate lift while walking or stomping) — lit left, shadowed right
    const lift = this.walking ? walkA*4 : (angry ? Math.sin(this.stompT*Math.PI)*5 : 0);
    const outC='rgba(30,18,10,0.55)';
    const legL = c.createLinearGradient(-13,0,-2,0);
    legL.addColorStop(0, shade(this.pants,16)); legL.addColorStop(1, shade(this.pants,-14));
    c.fillStyle=legL; rr(c,-13, 26, 11, 36 - Math.max(0,lift), 5); c.fill();
    c.strokeStyle=outC; c.lineWidth=2; rr(c,-13, 26, 11, 36 - Math.max(0,lift), 5); c.stroke();
    const legR = c.createLinearGradient(2,0,13,0);
    legR.addColorStop(0, shade(this.pants,2)); legR.addColorStop(1, shade(this.pants,-30));
    c.fillStyle=legR; rr(c,  2, 26, 11, 36 + Math.min(0,lift), 5); c.fill();
    rr(c,  2, 26, 11, 36 + Math.min(0,lift), 5); c.stroke();
    const shoeL = c.createLinearGradient(0,58,0,66);
    shoeL.addColorStop(0,'#453a30'); shoeL.addColorStop(1,'#181410');
    c.fillStyle=shoeL; rr(c,-15, 58-Math.max(0,lift), 15, 8, 4); c.fill();
    rr(c,-15, 58-Math.max(0,lift), 15, 8, 4); c.stroke();
    const shoeR = c.createLinearGradient(0,58,0,66);
    shoeR.addColorStop(0,'#332a22'); shoeR.addColorStop(1,'#100d0a');
    c.fillStyle=shoeR; rr(c,  0, 58+Math.min(0,lift), 15, 8, 4); c.fill();
    rr(c,  0, 58+Math.min(0,lift), 15, 8, 4); c.stroke();
    // torso — vertical light-from-above gradient, plus a horizontal rim-light/AO
    // pass to read as a rounded volume rather than a flat rectangle
    const bg = c.createLinearGradient(0,-18,0,30);
    bg.addColorStop(0, shade(this.shirt,18)); bg.addColorStop(1, shade(this.shirt,-20));
    c.fillStyle = bg;
    rr(c,-17,-18,34,48,10); c.fill();
    c.save();
    rr(c,-17,-18,34,48,10); c.clip();
    const torsoRim=c.createLinearGradient(-17,0,-2,0);
    torsoRim.addColorStop(0,'rgba(255,255,255,0.30)'); torsoRim.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle=torsoRim; c.fillRect(-17,-18,20,48);
    const torsoAo=c.createLinearGradient(2,0,17,0);
    torsoAo.addColorStop(0,'rgba(20,10,4,0)'); torsoAo.addColorStop(1,'rgba(20,10,4,0.26)');
    c.fillStyle=torsoAo; c.fillRect(2,-18,15,48);
    c.restore();
    c.strokeStyle=outC; c.lineWidth=2.6; rr(c,-17,-18,34,48,10); c.stroke();
    // arms — swing at sides; angry: fists on hips
    c.fillStyle = shade(this.shirt,-8);
    if (angry){
      rr(c,-24,-12,8,24,4); c.fill(); c.strokeStyle=outC; c.lineWidth=2; c.stroke();
      rr(c,16,-12,8,24,4); c.fill(); rr(c,16,-12,8,24,4); c.stroke();
      const hg=c.createRadialGradient(-21,10,1,-20,12,6);
      hg.addColorStop(0,shade(this.skin,20)); hg.addColorStop(1,shade(this.skin,-14));
      c.fillStyle=hg; c.beginPath(); c.arc(-20,12,5,0,TAU); c.fill();
      const hg2=c.createRadialGradient(19,10,1,20,12,6);
      hg2.addColorStop(0,shade(this.skin,10)); hg2.addColorStop(1,shade(this.skin,-22));
      c.fillStyle=hg2; c.beginPath(); c.arc(20,12,5,0,TAU); c.fill();
    } else {
      const sw = this.walking ? walkA*5 : Math.sin(t*2.4+this.bobPhase)*1;
      rr(c,-24,-14+sw,8,32,4); c.fill(); c.strokeStyle=outC; c.lineWidth=2; c.stroke();
      rr(c,16,-14-sw,8,32,4); c.fill(); rr(c,16,-14-sw,8,32,4); c.stroke();
      const hg=c.createRadialGradient(-21,18+sw,1,-20,20+sw,6);
      hg.addColorStop(0,shade(this.skin,20)); hg.addColorStop(1,shade(this.skin,-14));
      c.fillStyle=hg; c.beginPath(); c.arc(-20,20+sw,4.4,0,TAU); c.fill();
      const hg2=c.createRadialGradient(19,18-sw,1,20,20-sw,6);
      hg2.addColorStop(0,shade(this.skin,10)); hg2.addColorStop(1,shade(this.skin,-22));
      c.fillStyle=hg2; c.beginPath(); c.arc(20,20-sw,4.4,0,TAU); c.fill();
    }
    // neck + head (human proportion: head ~1/4 of figure)
    c.fillStyle=shade(this.skin,-14); rr(c,-5,-26,10,10,3); c.fill();
    // head lit like a sphere: bright upper-left, dark lower-right, soft specular
    const hg=c.createRadialGradient(-7,-49,2,0,-42,22);
    hg.addColorStop(0, shade(this.skin,28));
    hg.addColorStop(0.55, this.skin);
    hg.addColorStop(1, shade(this.skin,-24));
    c.fillStyle = hg;
    c.beginPath(); c.ellipse(0,-42,15,17,0,0,TAU); c.fill();
    c.strokeStyle=outC; c.lineWidth=2.4; c.beginPath(); c.ellipse(0,-42,15,17,0,0,TAU); c.stroke();
    const headHl=c.createRadialGradient(-6,-49,0,-6,-49,10);
    headHl.addColorStop(0,'rgba(255,255,255,0.6)'); headHl.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle=headHl; c.beginPath(); c.ellipse(-6,-48,6,5,0.4,0,TAU); c.fill();
    // ears
    c.beginPath(); c.arc(-15,-42,3.4,0,TAU); c.arc(15,-42,3.4,0,TAU); c.fill();
    // hair styles
    c.fillStyle = this.hairC;
    switch(this.hairStyle){
      case 0: // short crop
        c.beginPath(); c.ellipse(0,-49,15.5,11,0,Math.PI,0); c.fill(); break;
      case 1: // side part
        c.beginPath(); c.ellipse(0,-50,15.5,10,0,Math.PI,0); c.fill();
        c.beginPath(); c.ellipse(-9,-46,7,9,0.3,0,TAU); c.fill(); break;
      case 2: // bun
        c.beginPath(); c.ellipse(0,-50,15,9,0,Math.PI,0); c.fill();
        c.beginPath(); c.arc(0,-61,6,0,TAU); c.fill(); break;
      case 3: // long hair
        c.beginPath(); c.ellipse(0,-50,15.5,10,0,Math.PI,0); c.fill();
        rr(c,-17,-50,6,26,3); c.fill(); rr(c,11,-50,6,26,3); c.fill(); break;
      case 4: // curly
        for(let i=0;i<5;i++){ c.beginPath(); c.arc(-12+i*6,-53+(i%2)*2,5.5,0,TAU); c.fill(); }
        break;
      default: // balding
        c.beginPath(); c.ellipse(-11,-49,5,7,0.4,0,TAU); c.fill();
        c.beginPath(); c.ellipse(11,-49,5,7,-0.4,0,TAU); c.fill(); break;
    }
    // face
    const furious = this.mood==='furious';
    // eyes: whites + pupils
    c.fillStyle='#fff';
    c.beginPath(); c.ellipse(-6,-44,3.4,3.8,0,0,TAU); c.ellipse(6,-44,3.4,3.8,0,0,TAU); c.fill();
    c.fillStyle='#2b1a10';
    c.beginPath(); c.arc(-6,-43.4,1.7,0,TAU); c.arc(6,-43.4,1.7,0,TAU); c.fill();
    // brows
    c.strokeStyle='#2b1a10'; c.lineWidth=1.8; c.lineCap='round';
    c.beginPath();
    if (angry){ c.moveTo(-9.5,-51); c.lineTo(-3,-48.4); c.moveTo(9.5,-51); c.lineTo(3,-48.4); }
    else if (this.mood==='meh'){ c.moveTo(-9,-49.6); c.lineTo(-3,-49.6); c.moveTo(9,-49.6); c.lineTo(3,-49.6); }
    else { c.moveTo(-9,-49.4); c.quadraticCurveTo(-6,-51,-3,-49.4); c.moveTo(9,-49.4); c.quadraticCurveTo(6,-51,3,-49.4); }
    c.stroke();
    if (this.glasses){
      c.strokeStyle='rgba(40,30,26,0.85)'; c.lineWidth=1.6;
      c.beginPath(); c.arc(-6,-44,4.6,0,TAU); c.stroke();
      c.beginPath(); c.arc(6,-44,4.6,0,TAU); c.stroke();
      c.beginPath(); c.moveTo(-1.4,-44); c.lineTo(1.4,-44); c.stroke();
    }
    // mouth
    c.strokeStyle='#2b1a10'; c.lineWidth=2; c.lineCap='round';
    c.beginPath();
    if (this.mood==='happy') c.arc(0,-37,4.6,0.15*Math.PI,0.85*Math.PI);
    else if (this.mood==='meh'){ c.moveTo(-4,-34.5); c.lineTo(4,-34.5); }
    else if (furious){ c.stroke(); c.fillStyle='#7a2a1e'; c.beginPath(); c.ellipse(0,-34,4.4,3,0,0,TAU); c.fill(); c.beginPath(); }
    else c.arc(0,-31,4.6,1.15*Math.PI,1.85*Math.PI);
    c.stroke();
    // happy blush / angry steam+mark
    if (this.mood==='happy'){
      c.fillStyle='rgba(240,120,110,0.3)';
      c.beginPath(); c.arc(-10,-38,2.6,0,TAU); c.arc(10,-38,2.6,0,TAU); c.fill();
    }
    if (angry){
      c.fillStyle= furious ? 'rgba(220,60,40,0.35)' : 'rgba(220,60,40,0.18)';
      c.beginPath(); c.ellipse(0,-42,15,17,0,0,TAU); c.fill();
      // cartoon anger mark
      c.strokeStyle='#e04a34'; c.lineWidth=2.2;
      const ax=18, ay=-58;
      c.beginPath();
      c.moveTo(ax-4,ay-4); c.quadraticCurveTo(ax,ay,ax-4,ay+4);
      c.moveTo(ax+4,ay-4); c.quadraticCurveTo(ax,ay,ax+4,ay+4);
      c.moveTo(ax-4+8,ay-8); c.quadraticCurveTo(ax+4,ay-4,ax-4+8,ay);
      c.stroke();
    }
    c.restore();
  }
}

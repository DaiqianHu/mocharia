/* ============================================================
   Customer — a normal-looking person who walks in, queues, and
   waits. Patience drains but they NEVER leave without their
   coffee: they just get visibly angrier (stomping, grumbling)
   and tank your Order-station rating.
   ============================================================ */
import { choice, rand, randi, clamp, TAU, VW } from '../core/constants.js';
import { makeOrder, NAMES } from './data.js';
import { popText } from '../core/particles.js';
import { blip } from '../core/audio.js';
import { lobbyPos } from '../render/layout3d.js';
import { projectVirtual } from '../render/three.js';

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
          const wp = lobbyPos(this.x, this.y);
          const a = projectVirtual(wp.x, 235, wp.z);   // just above the chibi head
          popText(a.x, a.y, choice(['Hmph!','My coffee!!','Tap tap tap...','Grr...']), '#ff8a6f', 15);
          blip(150,0.12,'sawtooth',0.06,-40);
        }
      }
    }
    if (this.state==='served'){
      if (this.x <= -60 || this.x >= VW+60) this.doneT += dt;
    }
  }
}

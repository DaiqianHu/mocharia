/* ============================================================
   Btn — a springy, glossy immediate-mode button.
   ============================================================ */
import { rr, shade, clamp } from '../core/constants.js';
import { blip } from '../core/audio.js';

export class Btn {
  constructor(x,y,w,h,label,opts={}){
    this.x=x; this.y=y; this.w=w; this.h=h; this.label=label;
    this.color = opts.color || '#2fa88e';
    this.small = !!opts.small;
    this.hold  = !!opts.hold;         // press-and-hold button
    this.onClick = opts.onClick || null;
    this.onDown  = opts.onDown  || null;
    this.onUp    = opts.onUp    || null;
    this.enabled = true; this.visible = true;
    this.s = 1;            // press-scale (springy)
    this.hover = false;
    this.selected = false;
    this.pulse = 0;        // attention pulse
  }
  contains(px,py){
    return this.visible && px>=this.x && px<=this.x+this.w && py>=this.y && py<=this.y+this.h;
  }
  update(dt, px, py){
    this.s += (1-this.s)*Math.min(1, dt*14);
    this.hover = this.enabled && this.contains(px,py);
    if (this.pulse>0) this.pulse -= dt;
  }
  press(){
    this.s = 0.86;
    blip(this.enabled?720:220, 0.06, 'triangle', 0.10);
  }
  draw(c){
    if (!this.visible) return;
    const cx=this.x+this.w/2, cy=this.y+this.h/2;
    let sc=this.s * (this.hover&&this.enabled ? 1.045 : 1);
    if (this.pulse>0) sc *= 1 + Math.sin(this.pulse*18)*0.03;
    c.save();
    c.translate(cx,cy); c.scale(sc,sc); c.translate(-cx,-cy);
    const base = this.enabled ? (this.selected ? shade(this.color,34) : this.color) : '#6f6a64';
    // drop shadow
    c.fillStyle = 'rgba(30,14,8,0.35)';
    rr(c,this.x,this.y+4,this.w,this.h,12); c.fill();
    const g = c.createLinearGradient(0,this.y,0,this.y+this.h);
    g.addColorStop(0, shade(base,26)); g.addColorStop(1, shade(base,-18));
    c.fillStyle = g;
    rr(c,this.x,this.y,this.w,this.h,12); c.fill();
    c.strokeStyle = this.selected ? '#fff8e6' : shade(base,-42);
    c.lineWidth = this.selected ? 3 : 2;
    rr(c,this.x,this.y,this.w,this.h,12); c.stroke();
    // gloss
    c.fillStyle='rgba(255,255,255,0.22)';
    rr(c,this.x+3,this.y+3,this.w-6,this.h*0.42,9); c.fill();
    c.fillStyle = this.enabled ? '#fff' : '#cfc9c2';
    c.font = (this.small?'800 15px':'800 19px')+' "Trebuchet MS", Verdana, sans-serif';
    c.textAlign='center'; c.textBaseline='middle';
    c.fillText(this.label, cx, cy+1);
    c.restore();
  }
}

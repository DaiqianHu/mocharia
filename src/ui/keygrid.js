/* ============================================================
   KeyGrid — a canvas on-screen keyboard (A–Z + backspace) built
   from the existing springy Btn widget. The game has no DOM UI,
   so co-op room-code and role-name entry type through this.
   ============================================================ */
import { Btn } from './button.js';

export function makeKeyGrid({ x=267, y=272, cols=7, cell=54, gap=8 } = {}){
  const chars = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '⌫'];
  const btns = chars.map((ch,i) => new Btn(
    x + (i%cols)*(cell+gap), y + Math.floor(i/cols)*(cell+gap), cell, cell, ch,
    { small:true, color: ch==='⌫' ? '#a05a4a' : '#7a4a30' }));
  return {
    btns,
    draw(c){ for (const b of btns) b.draw(c); },
    /* returns the tapped character ('⌫' for backspace) or null */
    hit(px,py){
      const b = btns.find(b => b.contains(px,py));
      if (b){ b.press(); return b.label; }
      return null;
    },
  };
}

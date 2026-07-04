/* ============================================================
   Shared layout constants for the play scene: rail/tab bands,
   cup anchor rects, machine line, side panel, station ids.
   ============================================================ */

export const RAIL_H = 100;
export const TABS_Y = 546;
export const PANEL_X = 700;

// drink cup at the topping station (by = inside-bottom of glass)
export const TOP_CUP = { cx:400, by:470, w:150, h:250 };

// the brew station's line of machines (2 coffee, 2 milk)
export const MACHINES = [
  {kind:'coffee', x: 60,  y:150, w:140},
  {kind:'coffee', x: 218, y:150, w:140},
  {kind:'milk',   x: 376, y:150, w:140},
  {kind:'milk',   x: 534, y:150, w:140},
];

// cannoli shell on its plate (right of the taller ingredient shelf)
export const CANNOLI = { cx:450, cy:300, len:280, r:52 };

export const STATIONS = ['order','brew','top','cannoli'];
export const STATION_LABEL = {order:'Order', brew:'Brew', top:'Toppings', cannoli:'Cannoli'};

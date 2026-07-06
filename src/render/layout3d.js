/* ============================================================
   3D café layout — the world-space counterpart of game/layout.js.
   World units are roughly virtual-pixel sized; y is up, the floor is
   y=0, and the camera generally looks toward -z (the back wall).

   Each station's hand-tuned geometry still lives in old virtual-pixel
   local space (see stationRig() in three.js): RIGS says where that
   local space lands in the café — which old-virtual anchor point maps
   to which world point, and at what scale. VIEWS holds the cinematic
   camera pose per station (tuned so the subject sits clear of the HUD:
   rail above y≈100, tabs below y≈546, side panel right of x≈700 on
   non-order stations).
   ============================================================ */

export const ROOM = {
  x0: -820, x1: 820,        // side walls
  zBack: -460,              // back wall
  zFront: 560,              // open front (behind the camera, no wall)
  wallH: 460,               // wall height
  counterTop: 112,          // work-counter surface height
};

/* Station rigs: { anchor: old-virtual (ax,ay,az) , at: world target, s: scale }.
   anchor→at: that virtual point lands exactly on the world point. */
export const RIGS = {
  // lobby rig is 1:1 — the old order-station layout (counter z≈45,
  // floor y=-232 in old-world units) shifts so its floor line lands on
  // the café floor and its back-wall props land on the real back wall.
  lobby:   { anchor: {ax:480, ay:532, az:-360}, at: {x:0,    y:0,   z:-458}, s: 1.0 },
  brew:    { anchor: {ax:367, ay:356, az:14},   at: {x:330,  y:ROOM.counterTop, z:-386}, s: 0.62 },
  top:     { anchor: {ax:400, ay:470, az:20},   at: {x:-300, y:ROOM.counterTop, z:-170}, s: 0.42 },
  cannoli: { anchor: {ax:450, ay:352, az:12},   at: {x:-590, y:ROOM.counterTop, z:-250}, s: 0.40 },
};

/* Cinematic camera pose per station: position, lookAt target, fov. */
export const VIEWS = {
  order:   { pos: {x:-130, y:310, z:390},  tgt: {x:70,   y:100, z:-170}, fov: 48 },
  brew:    { pos: {x:280,  y:310, z:160},  tgt: {x:437,  y:145, z:-400}, fov: 46 },
  top:     { pos: {x:-420, y:250, z:150},  tgt: {x:-315, y:135, z:-190}, fov: 42 },
  cannoli: { pos: {x:-478, y:212, z:-48},  tgt: {x:-602, y:118, z:-272}, fov: 40 },
};

export const FLY_TIME = 0.7;   // seconds for the camera swoop between stations

/* lobby mapping for customers while they are still driven in virtual
   coords (Phase 3 replaces this with real waypoints): virtual x maps to
   world x shifted so the queue front lands just left of the register
   (clear of its occlusion from the order camera), and virtual y picks
   the lobby depth row. Sprites are drawn at SPRITE_SCALE so figures
   read taller than the counter. */
export const SPRITE_SCALE = 1.3;
export function lobbyPos(vx, vy){
  return { x: vx - 480 + 80, z: -95 + (vy - 388) * 1.5 };
}

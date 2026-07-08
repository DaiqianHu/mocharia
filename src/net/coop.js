/* ============================================================
   Co-op client — connection lifecycle + the lobby flow. No accounts:
   the host opens a room and reads a 4-letter code aloud; the guest
   types the code + a role name on the canvas keyboard. Max 2 players.
   Transport is a dumb WebSocket relay (relay/ in production,
   test/relay.mjs locally — same URL contract), reached at the
   build-time __RELAY_URL__.

   This module owns the NET singleton and the handshake
   (hello/welcome); state replication rides on top (netTick /
   netGuestUpdate) once a room is paired.
   ============================================================ */
import { G, makeShadowCtx, serveActive, pourMachine, startMachine, dumpMachine,
         machineMarkerGold, petCat, currentHoliday } from '../game/state.js';
import { takeOrder } from '../stations/order.js';
import { chooseSize, clearToppings } from '../stations/top.js';
import { chooseShell, scrapeCannoli } from '../stations/cannoli.js';
import { cycleMachineType, cycleMachineAddin } from '../input.js';
import { activeButtons, refreshButtonState } from '../game/buttons.js';
import { updateParticles, updateAmbient, popText, confettiBurst } from '../core/particles.js';
import { machineHudAnchor } from '../stations/brew.js';
import { hitTestScene } from '../render/three.js';
import { catHearts } from '../render/cat.js';
import { P, loadProgress } from '../game/progress.js';
import { encodeSnapshot, applySnapshot, ref, deref, DRAG_KIND } from './snapshot.js';
import { clamp, rand } from '../core/constants.js';
import { ding, buzz, blip, chaChing, pour, rushHorn, purr, starChime } from '../core/audio.js';

export const PROTO = 1;

export const NET = {
  role: null,          // null | 'host' | 'guest'
  ws: null,
  code: '',            // host: the room code to read aloud
  joinCode: '',        // guest: code being typed
  name: '',            // guest: role name being typed
  err: '',             // lobby error line ('Room not found', …)
  partner: null,       // {name, station, x, y} once paired
  seq: 0,
};

if (typeof window !== 'undefined') window.NET = NET;   // test hook (like window.G)

export function isHost(){ return NET.role === 'host'; }
export function isGuest(){ return NET.role === 'guest'; }
export function inCoop(){ return NET.role !== null && !!NET.partner; }

function send(obj){
  if (NET.ws && NET.ws.readyState === 1) NET.ws.send(JSON.stringify(obj));
}

/* ---- host flow: open a room, wait for a guest hello ---- */
export function hostRoom(){
  leaveCoop(false);
  NET.err = '';
  const ws = new WebSocket(__RELAY_URL__ + '/host');
  NET.ws = ws; NET.role = 'host';
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.t === 'room'){ NET.code = m.code; return; }
    if (m.t === 'peerLeft'){ onPartnerLeft(); return; }
    if (m.t === 'hello'){
      if (m.proto !== PROTO) return;
      NET.partner = { name: m.name || 'FRIEND', station: 'order', x: -99, y: -99 };
      G.p2 = makeShadowCtx(NET.partner.name);
      send({ t:'welcome', proto: PROTO, day: G.day });
      ding();
      if (G.state === 'coopHost') G.state = 'dayIntro';
      return;
    }
    onHostMessage(m);
  };
  ws.onclose = () => { if (NET.role === 'host') resetNet(); };
}

/* ---- guest flow: join by code, then submit a name ---- */
export function joinRoom(){
  if (NET.joinCode.length !== 4) return;
  NET.err = '';
  const ws = new WebSocket(__RELAY_URL__ + '/join/' + NET.joinCode);
  NET.ws = ws; NET.role = 'guest';
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.t === 'ok'){ G.state = 'coopName'; return; }
    if (m.t === 'welcome'){
      NET.partner = { name: 'BARISTA', station: 'order', x: -99, y: -99 };
      ding();
      G.state = 'coopWait';
      return;
    }
    onGuestMessage(m);
  };
  ws.onclose = ev => {
    if (NET.role !== 'guest') return;
    if (ev.code === 4404) NET.err = 'Room not found — check the code!';
    else if (ev.code === 4403) NET.err = 'That room is already full.';
    else if (ev.code === 4000 || NET.partner){ onHostGone(); return; }
    else NET.err = 'Could not reach the café.';
    buzz();
    resetNet();
    if (G.state === 'coopName' || G.state === 'coopWait') G.state = 'coopJoin';
  };
}

export function submitName(){
  if (!isGuest() || NET.name.length === 0) return;
  send({ t:'hello', proto: PROTO, name: NET.name });
}

/* ---- canvas-keyboard input for the lobby screens ---- */
export function coopKey(ch){
  const buf = G.state === 'coopJoin' ? 'joinCode' : G.state === 'coopName' ? 'name' : null;
  if (!buf) return;
  const max = buf === 'joinCode' ? 4 : 8;
  if (ch === '⌫') NET[buf] = NET[buf].slice(0, -1);
  else if (NET[buf].length < max) NET[buf] += ch;
  NET.err = '';
}

/* ---- teardown ---- */
function resetNet(){
  if (NET.ws){ NET.ws.onclose = null; try{ NET.ws.close(); }catch(_){} }
  NET.ws = null; NET.role = null; NET.code = '';
  NET.partner = null; NET.seq = 0;
  G.p2 = null;
  unmirrorP();               // give the guest their own save back
}

export function leaveCoop(toTitle=true){
  send({ t:'bye' });
  resetNet();
  if (toTitle) G.state = 'title';
}

function onPartnerLeft(){
  if (NET.partner) buzz();
  NET.partner = null;
  G.p2 = null;                 // host keeps playing solo; slot reopens
}

function onHostGone(){
  resetNet();
  buzz();
  G.state = 'hostLeft';
}

/* ============================================================
   Replication. Host-authoritative: the guest runs NO game sim —
   it sends actions + a pointer/drag stream (raycast on its OWN
   camera) and receives full snapshots at 10 Hz; update3d()/draw()
   are pure readers of the replicated G. Juice on the guest comes
   from snapshot deltas (new customer, machine done, pour, serve,
   rush, cat pet) instead of a separate event channel.
   ============================================================ */

/* guest → host action (guest-side only; host/solo call the sim directly) */
export function act(a, args={}){ send({ t:'act', a, ...args }); }

/* host: run a guest action against the shadow context */
function execAct(m){
  const ctx = G.p2; if (!ctx) return;
  switch (m.a){
    case 'takeOrder':  takeOrder(ctx); break;
    case 'setActive':  ctx.active = G.tickets.find(t=>t.id===m.id) ?? null; break;
    case 'serve':      serveActive(ctx); break;
    case 'contResult': G.result = null; break;
    case 'size':       chooseSize(m.sz, ctx); break;
    case 'shell':      { const it = deref(m.ref); if (it) chooseShell(it, ctx); } break;
    case 'clearTop':   clearToppings(ctx); break;
    case 'scrape':     scrapeCannoli(ctx); break;
    case 'petCat':     petCat(); break;
    case 'machine':    { const mach = G.machines[m.i]; if (!mach) break;
      const idle = mach.state==='idle';
      if (m.op==='start')      startMachine(mach);
      else if (m.op==='dump')  dumpMachine(mach);
      else if (m.op==='pour')  pourMachine(mach, ctx, !!m.perfect);
      else if (idle && m.op==='type')  cycleMachineType(mach);
      else if (idle && m.op==='addin') cycleMachineAddin(mach);
      else if (idle && m.op==='temp')
        mach.temp = mach.temp==='hot' ? (mach.kind==='coffee'?'iced':'cold') : 'hot';
      else if (idle && m.op==='amt') mach.amt = clamp(m.amt|0, 1, 3);
    } break;
  }
}

function onHostMessage(m){
  if (m.t === 'act') execAct(m);
  else if (m.t === 'drag'){
    const ctx = G.p2; if (!ctx) return;
    ctx.drag = m.cat ? { cat: m.cat, item: deref(m.item) } : null;
    ctx.pointer.down = m.down;
    ctx.ray = m.ray;
    ctx.station = m.station;
  }
  else if (m.t === 'pres'){
    if (NET.partner){ NET.partner.station = m.station; NET.partner.x = m.x; NET.partner.y = m.y; }
  }
  else if (m.t === 'bye') onPartnerLeft();
}

let pendingSnap = null, lastSeq = 0;
function onGuestMessage(m){
  if (m.t === 'snap'){ if (m.seq > lastSeq){ lastSeq = m.seq; pendingSnap = m; } }
  else if (m.t === 'pres'){
    if (NET.partner){ NET.partner.station = m.station; NET.partner.x = m.x; NET.partner.y = m.y; }
  }
  else if (m.t === 'bye') onHostGone();
}

/* ---- host per-frame: broadcast snapshots + presence ---- */
let snapAcc = 0, presAcc = 0;
export function netTick(dt){
  if (NET.role !== 'host' || !NET.partner) return;
  if (G.state==='dayIntro' || G.state==='play' || G.state==='summary' || G.state==='shop'){
    snapAcc += dt;
    if (snapAcc >= 0.1){ snapAcc = 0; send(encodeSnapshot(++NET.seq)); }
  }
  presAcc += dt;
  if (presAcc >= 0.2){ presAcc = 0; send({ t:'pres', station: G.station, x: G.pointer.x, y: G.pointer.y }); }
}

/* ---- guest per-frame: replaces update(dt) entirely ---- */
let dragSig = '', dragAcc = 0, gPresAcc = 0, serverActive = undefined;

export function netGuestUpdate(dt){
  G.time += dt;
  updateParticles(dt);
  updateAmbient(dt, (G.state==='play' || G.state==='dayIntro') ? currentHoliday() : null);
  if (G.state==='dayIntro') G.introT += dt;
  if (G.state==='summary') G.summaryT += dt;
  const p = G.pointer;
  for (const b of activeButtons()) b.update(dt, p.x, p.y);

  // apply the freshest snapshot before the button refresh (revived
  // Ticket prototypes must exist before refreshButtonState runs)
  if (pendingSnap){
    const s = pendingSnap; pendingSnap = null;
    const localActiveId = G.active ? G.active.id : null;
    const prev = applySnapshot(s);
    // guest state follows the host's day cycle
    if (s.st !== G.state && ['dayIntro','play','summary','shop'].includes(s.st)){
      if (s.st==='dayIntro') G.introT = 0;
      if (s.st==='summary') G.summaryT = 0;
      G.state = s.st;
      G.drag = null;
    }
    // keep our own selection; adopt the host-assigned one when IT moves
    // (our takeOrder landed, or our active got served)
    if (s.active.guest !== serverActive){
      serverActive = s.active.guest;
      G.active = G.tickets.find(t=>t.id===serverActive) ?? null;
    } else {
      G.active = G.tickets.find(t=>t.id===localActiveId) ?? G.tickets[0] ?? null;
    }
    guestJuice(prev);
  }
  refreshButtonState();
  cosmeticTick(dt);

  // stream drag + pointer (with our own-camera raycast) while relevant
  const d = G.drag;
  const ray = (d && p.down && (G.station==='top' || G.station==='cannoli'))
    ? hitTestScene(p.x, p.y, G.station) : null;
  dragAcc += dt;
  const sig = [d && d.cat, d && d.item && d.item.id, p.down, G.station,
               ray && (ray.kind==='cup' ? ray.relX.toFixed(3) : ray.end)].join('|');
  if (sig !== dragSig || (d && p.down && dragAcc >= 0.05)){
    dragSig = sig; dragAcc = 0;
    send({ t:'drag', cat: d ? d.cat : null,
           item: d && d.item ? ref(DRAG_KIND[d.cat] || 'drizzle', d.item) : null,
           down: p.down, ray, station: G.station });
  }
  gPresAcc += dt;
  if (gPresAcc >= 0.2){ gPresAcc = 0; send({ t:'pres', station: G.station, x: p.x, y: p.y }); }
}

/* juice from snapshot deltas — the guest's ears and confetti */
function guestJuice(prev){
  for (const c of G.customers)
    if (!prev.custIds.has(c.id)){ blip(880,0.07,'sine',0.08); break; }
  G.machines.forEach((m, i) => {
    if (prev.machineStates[i]==='run' && m.state==='done'){
      blip(720,0.1,'sine',0.1);
      const a = machineHudAnchor(i, 250);
      if (a) popText(a.x, a.y, (m.kind==='coffee'?'Coffee':'Milk')+' ready!', '#8fe0a8', 15);
    }
  });
  for (const t of G.tickets){
    const pc = prev.cups.find(c=>c.id===t.id);
    if (pc && ((!pc.c && t.cup.coffee) || (!pc.m && t.cup.milk))){ pour(0.4); break; }
  }
  if (G.served.length > prev.served){
    chaChing();
    const last = G.served[G.served.length-1];
    if (last && last.total>=88) confettiBurst(480, 260, 80);
    G.shake = Math.max(G.shake, 2);
  }
  if (!prev.rushActive && G.rush && G.rush.active) rushHorn();
  if (G.cat.petT > prev.petT + 0.3){ purr(); catHearts(); }
}

/* animation-only fields the snapshot deliberately doesn't carry */
function cosmeticTick(dt){
  for (const c of G.customers){
    if (c._nx !== undefined){
      const dx = c._nx - c.x, dy = c._ny - c.y;
      c.walking = Math.hypot(dx, dy) > 3;
      const k = Math.min(1, dt*8);
      c.x += dx*k; c.y += dy*k;
    }
    const angry = c.mood==='angry' || c.mood==='furious';
    if (angry && !c.walking) c.stompT += dt * (c.mood==='furious' ? 7 : 4.5);
    if (c.reaction > 0) c.reaction -= dt;
  }
  for (const t of G.tickets){
    t.x += (t.slot - t.x) * Math.min(1, dt*7);
    t.flash = Math.max(0, (t.flash||0) - dt*1.4);
  }
  if (G.result){
    const r = G.result; r.t += dt;
    const shown = clamp(Math.floor((r.t - 0.45)/0.18)+1, 0, r.stars);
    if (shown > r.starsShown){ r.starsShown = shown; starChime(shown); }
  }
  if (G.cat.petT > 0) G.cat.petT -= dt;
  if (G.shake > 0){
    G.shake = Math.max(0, G.shake - dt*22);
    G.shakeX = rand(-G.shake, G.shake); G.shakeY = rand(-G.shake, G.shake);
  } else { G.shakeX = G.shakeY = 0; }
}

/* restore the guest's own save when co-op ends (the mirror overwrote P) */
export function unmirrorP(){
  if (P.__mirror){ delete P.__mirror; loadProgress(); }
}

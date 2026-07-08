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
import { G, makeShadowCtx } from '../game/state.js';
import { ding, buzz } from '../core/audio.js';

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

/* ---- replication layer (Phase 6) ---- */
function onHostMessage(m){ /* guest actions land here once replication ships */ }
function onGuestMessage(m){ /* snapshots/events land here once replication ships */ }

/* per-frame hooks wired from main.js — no-ops until replication ships */
export function netTick(dt){}
export function netGuestUpdate(dt){}

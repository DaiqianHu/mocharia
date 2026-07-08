/* Node twin of relay/src/index.js (same URL contract + close codes) on
   ws://localhost:8787 — the offline dev/test relay, and what test/coop.mjs
   spawns. `node test/relay.mjs --selftest` runs a host/join/echo/drop check. */
import { WebSocketServer, WebSocket } from 'ws';

const PORT = process.env.PORT || 8787;
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const code4 = () => Array.from({length:4}, () => ALPHA[Math.random()*26|0]).join('');

const rooms = new Map();   // code -> {host, guest}

const wss = new WebSocketServer({ port: PORT });
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/host'){
    let code; do { code = code4(); } while (rooms.has(code));
    const room = { host: ws, guest: null };
    rooms.set(code, room);
    ws.send(JSON.stringify({ t:'room', code }));
    ws.on('message', d => { if (room.guest && room.guest.readyState === 1) room.guest.send(d.toString()); });
    ws.on('close', () => {
      if (room.guest) room.guest.close(4000, 'host-left');
      rooms.delete(code);
    });
    return;
  }
  const m = url.pathname.match(/^\/join\/([A-Z]{4})$/);
  const room = m && rooms.get(m[1]);
  if (!room){ ws.close(4404, 'no-room'); return; }
  if (room.guest){ ws.close(4403, 'full'); return; }
  room.guest = ws;
  ws.send(JSON.stringify({ t:'ok' }));
  ws.on('message', d => { if (room.host.readyState === 1) room.host.send(d.toString()); });
  ws.on('close', () => {
    room.guest = null;
    if (room.host.readyState === 1) room.host.send(JSON.stringify({ t:'peerLeft' }));
  });
});
console.log('mocha relay stub on ws://localhost:' + PORT);

/* ---- --selftest: host a room, join it, relay both ways, drop host ---- */
if (process.argv.includes('--selftest')){
  const fail = (msg) => { console.error('SELFTEST FAIL: ' + msg); process.exit(1); };
  const once = (sock, ev) => new Promise(r => sock.once(ev, r));
  const msg = async (sock) => JSON.parse((await once(sock, 'message')).toString());
  (async () => {
    const host = new WebSocket(`ws://localhost:${PORT}/host`);
    const hello = await msg(host);
    if (hello.t !== 'room' || !/^[A-Z]{4}$/.test(hello.code)) fail('no room code');

    const miss = new WebSocket(`ws://localhost:${PORT}/join/ZZZZ`);
    const missCode = await new Promise(r => miss.once('close', c => r(c)));
    if (missCode !== 4404) fail('expected 4404 for bad code, got ' + missCode);

    const guest = new WebSocket(`ws://localhost:${PORT}/join/${hello.code}`);
    if ((await msg(guest)).t !== 'ok') fail('guest not acked');

    guest.send(JSON.stringify({ t:'hello', name:'MAYA' }));
    if ((await msg(host)).name !== 'MAYA') fail('guest->host relay');
    host.send(JSON.stringify({ t:'welcome' }));
    if ((await msg(guest)).t !== 'welcome') fail('host->guest relay');

    const third = new WebSocket(`ws://localhost:${PORT}/join/${hello.code}`);
    const fullCode = await new Promise(r => third.once('close', c => r(c)));
    if (fullCode !== 4403) fail('expected 4403 when full, got ' + fullCode);

    host.close();
    const dropCode = await new Promise(r => guest.once('close', c => r(c)));
    if (dropCode !== 4000) fail('expected 4000 on host drop, got ' + dropCode);

    console.log('SELFTEST PASS');
    process.exit(0);
  })().catch(e => fail(e.message));
}

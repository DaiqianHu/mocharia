/* ============================================================
   Mocha Rush co-op relay — Cloudflare Worker + Durable Object.
   One Room per 4-letter code (DO idFromName, so no registry):
   2 slots (host + guest), verbatim message fan-out to the other
   peer, host-drop closes the room, guest slot reopens on leave.
   The protocol is defined by the game client (src/net/coop.js);
   test/relay.mjs is this file's node twin for offline dev/tests.
   ============================================================ */
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const code4 = () => Array.from({length:4}, () => ALPHA[Math.random()*26|0]).join('');

export default {
  async fetch(req, env){
    if (req.headers.get('Upgrade') !== 'websocket')
      return new Response('mocha-relay ok', { status: 200 });
    const url = new URL(req.url);
    if (url.pathname === '/host'){
      const code = code4();
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      return stub.fetch(new Request('https://do/ws?role=host&code='+code, req));
    }
    const m = url.pathname.match(/^\/join\/([A-Z]{4})$/);
    if (m){
      const stub = env.ROOMS.get(env.ROOMS.idFromName(m[1]));
      return stub.fetch(new Request('https://do/ws?role=guest', req));
    }
    return new Response('not found', { status: 404 });
  }
};

export class Room {
  constructor(state){
    this.state = state;
    this.host = null;
    this.guest = null;
    this.open = false;      // a host is (or was) connected under this code
  }
  async fetch(req){
    const url = new URL(req.url);
    const role = url.searchParams.get('role');
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    // reject by accepting then closing with a typed code so the game
    // client can tell "no such room" from "room full"
    if (role === 'guest' && (!this.open || !this.host)){
      server.close(4404, 'no-room');
      return new Response(null, { status: 101, webSocket: client });
    }
    if (this[role]){
      server.close(4403, 'full');
      return new Response(null, { status: 101, webSocket: client });
    }

    this[role] = server;
    if (role === 'host'){
      this.open = true;
      server.send(JSON.stringify({ t:'room', code: url.searchParams.get('code') }));
    } else {
      server.send(JSON.stringify({ t:'ok' }));
    }
    server.addEventListener('message', e => {
      const peer = role === 'host' ? this.guest : this.host;
      if (peer) try{ peer.send(e.data); }catch(_){ }
    });
    server.addEventListener('close', () => {
      this[role] = null;
      if (role === 'host'){
        this.open = false;
        if (this.guest) try{ this.guest.close(4000, 'host-left'); }catch(_){ }
        this.guest = null;
      } else if (this.host){
        try{ this.host.send(JSON.stringify({ t:'peerLeft' })); }catch(_){ }
      }
    });
    // idle guillotine: nuke stale rooms after 45 min
    this.state.storage.setAlarm(Date.now() + 45*60*1000);
    return new Response(null, { status: 101, webSocket: client });
  }
  alarm(){
    for (const s of [this.host, this.guest]) if (s) try{ s.close(4001, 'idle'); }catch(_){ }
    this.host = this.guest = null;
    this.open = false;
  }
}

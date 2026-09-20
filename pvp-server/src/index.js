const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function safeText(value, fallback, max) {
  return String(value || fallback).slice(0, max);
}

function queueRoomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export class PvpRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.players = new Map();
  }

  async fetch(request) {
    const upgrade = request.headers.get("Upgrade");
    if (!upgrade || upgrade.toLowerCase() !== "websocket") {
      return json({ ok: true, service: "gallina-cosmica-pvp-room" });
    }
    if (this.players.size >= 2) return json({ ok: false, error: "ROOM_FULL" }, 409);

    const pair = new WebSocketPair(), client = pair[0], server = pair[1];
    server.accept();
    const url = new URL(request.url);
    const playerId = safeText(url.searchParams.get("playerId"), crypto.randomUUID(), 128);
    const name = safeText(url.searchParams.get("name"), "Jugador", 40);
    const ship = safeText(url.searchParams.get("ship"), "Gallina", 40);
    const slot = this.players.size + 1;
    this.players.set(server, { playerId, name, ship, slot });

    server.addEventListener("message", event => {
      let message; try { message = JSON.parse(event.data); } catch { return; }
      if (!message || typeof message !== "object") return;
      this.broadcast({ type: "peer-message", from: slot, payload: message }, server);
    });

    const remove = () => {
      if (!this.players.has(server)) return;
      this.players.delete(server);
      this.broadcast({ type: "player-left", slot });
    };
    server.addEventListener("close", remove);
    server.addEventListener("error", remove);

    server.send(JSON.stringify({ type: "joined", slot, players: this.playerList() }));
    this.broadcast({ type: "player-joined", player: { playerId, name, ship, slot } }, server);
    if (this.players.size === 2) this.broadcast({ type: "ready", players: this.playerList() });
    return new Response(null, { status: 101, webSocket: client });
  }

  playerList() { return Array.from(this.players.values()); }
  broadcast(message, except = null) {
    const data = JSON.stringify(message);
    for (const socket of this.players.keys()) {
      if (socket === except) continue;
      try { socket.send(data); } catch {}
    }
  }
}

export class PvpMatchmaker {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.waiting = null;
  }

  async fetch(request) {
    const upgrade = request.headers.get("Upgrade");
    if (!upgrade || upgrade.toLowerCase() !== "websocket") {
      return json({ ok: true, service: "gallina-cosmica-pvp-matchmaker", waiting: !!this.waiting });
    }

    const pair = new WebSocketPair(), client = pair[0], server = pair[1];
    server.accept();
    const url = new URL(request.url);
    const playerId = safeText(url.searchParams.get("playerId"), crypto.randomUUID(), 128);
    const name = safeText(url.searchParams.get("name"), "Jugador", 40);
    const ship = safeText(url.searchParams.get("ship"), "Gallina", 40);

    if (this.waiting && this.waiting.playerId !== playerId) {
      const first = this.waiting;
      this.waiting = null;
      const roomCode = queueRoomCode();
      const match = { type: "match-found", roomCode };
      try { first.socket.send(JSON.stringify(match)); } catch {}
      try { server.send(JSON.stringify(match)); } catch {}
      try { first.socket.close(1000, "matched"); } catch {}
      try { server.close(1000, "matched"); } catch {}
    } else {
      if (this.waiting) {
        try { this.waiting.socket.close(1000, "replaced"); } catch {}
      }
      this.waiting = { socket: server, playerId, name, ship };
      server.send(JSON.stringify({ type: "queue-waiting" }));
      const clear = () => {
        if (this.waiting?.socket === server) this.waiting = null;
      };
      server.addEventListener("close", clear);
      server.addEventListener("error", clear);
    }

    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ ok: true, service: "gallina-cosmica-pvp", version: 2, matchmaking: true });
    }
    if (url.pathname === "/matchmake") {
      const id = env.PVP_MATCHMAKER.idFromName("global-1v1");
      return env.PVP_MATCHMAKER.get(id).fetch(request);
    }
    const match = url.pathname.match(/^\/room\/(\d{6})$/);
    if (!match) return json({ ok: false, error: "NOT_FOUND" }, 404);
    const id = env.PVP_ROOMS.idFromName(match[1]);
    return env.PVP_ROOMS.get(id).fetch(request);
  },
};

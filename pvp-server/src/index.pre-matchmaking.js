const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
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

    if (this.players.size >= 2) {
      return json({ ok: false, error: "ROOM_FULL" }, 409);
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const url = new URL(request.url);
    const playerId = (url.searchParams.get("playerId") || crypto.randomUUID()).slice(0, 128);
    const name = (url.searchParams.get("name") || "Jugador").slice(0, 40);
    const ship = (url.searchParams.get("ship") || "Gallina").slice(0, 40);
    const slot = this.players.size + 1;

    this.players.set(server, { playerId, name, ship, slot });

    server.addEventListener("message", (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!message || typeof message !== "object") return;

      const safe = {
        type: "peer-message",
        from: slot,
        payload: message,
      };
      this.broadcast(safe, server);
    });

    const remove = () => {
      if (!this.players.has(server)) return;
      this.players.delete(server);
      this.broadcast({ type: "player-left", slot });
    };
    server.addEventListener("close", remove);
    server.addEventListener("error", remove);

    server.send(JSON.stringify({
      type: "joined",
      slot,
      players: this.playerList(),
    }));
    this.broadcast({ type: "player-joined", player: { playerId, name, ship, slot } }, server);

    if (this.players.size === 2) {
      this.broadcast({ type: "ready", players: this.playerList() });
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  playerList() {
    return Array.from(this.players.values());
  }

  broadcast(message, except = null) {
    const data = JSON.stringify(message);
    for (const socket of this.players.keys()) {
      if (socket === except) continue;
      try { socket.send(data); } catch {}
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ ok: true, service: "gallina-cosmica-pvp", version: 1 });
    }

    const match = url.pathname.match(/^\/room\/(\d{6})$/);
    if (!match) {
      return json({ ok: false, error: "NOT_FOUND" }, 404);
    }

    const roomCode = match[1];
    const id = env.PVP_ROOMS.idFromName(roomCode);
    const room = env.PVP_ROOMS.get(id);
    return room.fetch(request);
  },
};

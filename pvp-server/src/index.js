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

function gameMode(url) {
  const mode = safeText(url.searchParams.get("mode"), "1v1", 16).toLowerCase();
  return mode === "2v2" || mode === "arena" ? mode : "1v1";
}

function roomCapacity(mode) {
  return mode === "1v1" ? 2 : 4;
}

export class PvpRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.players = new Map();
    this.forfeitedPlayers = new Set();
    this.eliminatedSlots = new Set();
    this.finished = false;
  }

  async fetch(request) {
    const upgrade = request.headers.get("Upgrade");
    if (!upgrade || upgrade.toLowerCase() !== "websocket") {
      return json({ ok: true, service: "gallina-cosmica-pvp-room" });
    }
    const url = new URL(request.url);
    const requestedMode = gameMode(url);
    if (!this.mode) this.mode = requestedMode;
    if (requestedMode !== this.mode) return json({ ok: false, error: "MODE_MISMATCH" }, 409);
    const capacity = roomCapacity(this.mode);
    if (this.players.size >= capacity) return json({ ok: false, error: "ROOM_FULL" }, 409);

    const pair = new WebSocketPair(), client = pair[0], server = pair[1];
    server.accept();
    const playerId = safeText(url.searchParams.get("playerId"), crypto.randomUUID(), 128);
    const name = safeText(url.searchParams.get("name"), "Jugador", 40);
    const ship = safeText(url.searchParams.get("ship"), "Gallina", 40);
    const slot = this.players.size + 1;
    const team = this.mode === "2v2" ? (slot <= 2 ? 1 : 2) : 0;
    this.players.set(server, { playerId, name, ship, slot, team });

    server.addEventListener("message", event => {
      let message; try { message = JSON.parse(event.data); } catch { return; }
      if (!message || typeof message !== "object") return;
      if (message.type === "defeat") {
        if (message.reason === "forfeit") {
          this.forfeitedPlayers.add(playerId);
          message.rewardEligible = false;
        }
        if (this.mode === "2v2" && !this.finished) {
          this.eliminatedSlots.add(slot);
          this.broadcast({ type: "player-eliminated", slot, team, reason: message.reason || "combat" });
          const teamSlots = Array.from(this.players.values()).filter(p => p.team === team).map(p => p.slot);
          if (teamSlots.length === 2 && teamSlots.every(s => this.eliminatedSlots.has(s))) {
            this.finished = true;
            const winnerTeam = team === 1 ? 2 : 1;
            this.broadcast({ type: "team-result", winnerTeam, loserTeam: team });
          }
        }
      }
      this.broadcast({ type: "peer-message", from: slot, team, payload: message }, server);
    });

    const remove = () => {
      if (!this.players.has(server)) return;
      this.players.delete(server);
      // Toda desconexión durante una sala iniciada queda registrada como abandono
      // para que una futura capa de recompensas nunca premie a ese jugador.
      if (this.started) {
        this.forfeitedPlayers.add(playerId);
        if (this.mode === "2v2" && !this.finished) {
          this.eliminatedSlots.add(slot);
          this.broadcast({ type: "player-eliminated", slot, team, reason: "disconnect" });
          const teamSlots = Array.from(this.players.values()).filter(p => p.team === team).map(p => p.slot);
          // El jugador que se desconecta ya fue quitado del Map, así que incluimos su slot.
          if (!teamSlots.includes(slot)) teamSlots.push(slot);
          const expectedTeamSlots = team === 1 ? [1, 2] : [3, 4];
          if (expectedTeamSlots.every(s => this.eliminatedSlots.has(s))) {
            this.finished = true;
            this.broadcast({ type: "team-result", winnerTeam: team === 1 ? 2 : 1, loserTeam: team });
          }
        }
      }
      this.broadcast({ type: "player-left", slot, team, playerId, forfeited: this.started, rewardEligible: !this.started });
    };
    server.addEventListener("close", remove);
    server.addEventListener("error", remove);

    server.send(JSON.stringify({ type: "joined", slot, team, mode: this.mode, capacity, players: this.playerList() }));
    this.broadcast({ type: "player-joined", player: { playerId, name, ship, slot, team } }, server);
    if (this.players.size === capacity) {
      this.started = true;
      this.broadcast({ type: "ready", mode: this.mode, players: this.playerList() });
    }
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
    const mode = gameMode(url);
    const needed = roomCapacity(mode);
    if (!this.waitingByMode) this.waitingByMode = new Map();
    const queue = this.waitingByMode.get(mode) || [];
    const cleanQueue = queue.filter(entry => entry.playerId !== playerId);
    this.waitingByMode.set(mode, cleanQueue);

    const current = this.waitingByMode.get(mode) || [];
    current.push({ socket: server, playerId, name, ship });
    this.waitingByMode.set(mode, current);

    server.send(JSON.stringify({ type: "queue-waiting", mode, waiting: current.length, needed }));

    const clear = () => {
      const list = this.waitingByMode?.get(mode) || [];
      this.waitingByMode?.set(mode, list.filter(entry => entry.socket !== server));
    };
    server.addEventListener("close", clear);
    server.addEventListener("error", clear);

    if (current.length >= needed) {
      const group = current.splice(0, needed);
      this.waitingByMode.set(mode, current);
      const roomCode = queueRoomCode();
      const match = { type: "match-found", roomCode, mode, players: needed };
      for (const entry of group) {
        try { entry.socket.send(JSON.stringify(match)); } catch {}
        try { entry.socket.close(1000, "matched"); } catch {}
      }
    }

    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ ok: true, service: "gallina-cosmica-pvp", version: 3, matchmaking: true, modes: ["1v1", "2v2", "arena"] });
    }
    if (url.pathname === "/matchmake") {
      const mode = gameMode(url);
      const id = env.PVP_MATCHMAKER.idFromName("global-" + mode);
      return env.PVP_MATCHMAKER.get(id).fetch(request);
    }
    const match = url.pathname.match(/^\/room\/(\d{6})$/);
    if (!match) return json({ ok: false, error: "NOT_FOUND" }, 404);
    const id = env.PVP_ROOMS.idFromName(match[1]);
    return env.PVP_ROOMS.get(id).fetch(request);
  },
};

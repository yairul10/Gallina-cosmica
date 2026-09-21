const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

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
    this.started = false;
    this.rewardStatus = new Map();
    this.disconnectTimers = new Map();
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
    let slot, team, reconnected = false;
    const pending = Array.from(this.rewardStatus.entries()).find(([,s]) => s.playerId === playerId && s.pendingReconnect);
    if (pending) {
      slot = Number(pending[0]); team = Number(pending[1].team || (this.mode === "2v2" ? (slot <= 2 ? 1 : 2) : 0));
      const timer = this.disconnectTimers.get(playerId); if (timer) clearTimeout(timer);
      this.disconnectTimers.delete(playerId);
      this.rewardStatus.set(slot, { playerId, eligible: true, reason: null, team, pendingReconnect: false });
      reconnected = true;
    } else {
      const used = new Set(Array.from(this.players.values()).map(p => p.slot));
      slot = Array.from({length: capacity},(_,i)=>i+1).find(s => !used.has(s)) || capacity;
      team = this.mode === "2v2" ? (slot <= 2 ? 1 : 2) : 0;
      this.rewardStatus.set(slot, { playerId, eligible: true, reason: null, team, pendingReconnect: false });
    }
    this.players.set(server, { playerId, name, ship, slot, team });

    server.addEventListener("message", event => {
      let message; try { message = JSON.parse(event.data); } catch { return; }
      if (!message || typeof message !== "object") return;
      if (message.type === "defeat") {
        if (message.reason === "forfeit") {
          this.forfeitedPlayers.add(playerId);
          this.rewardStatus.set(slot, { playerId, eligible: false, reason: "forfeit" });
          message.rewardEligible = false;
          this.broadcast({ type: "reward-status", slot, team, eligible: false, reason: "forfeit" });
        }
        if ((this.mode === "2v2" || this.mode === "arena") && !this.finished) {
          this.eliminatedSlots.add(slot);
          const killerSlot = Number(message.killerSlot || 0);
          const attackKind = message.attackKind === "missile" ? "missile" : "laser";
          this.broadcast({ type: "player-eliminated", slot, team, reason: message.reason || "combat", killerSlot, attackKind });
          if (this.mode === "2v2") {
            const teamSlots = Array.from(this.players.values()).filter(p => p.team === team).map(p => p.slot);
            if (teamSlots.length === 2 && teamSlots.every(s => this.eliminatedSlots.has(s))) {
              this.finished = true;
              const winnerTeam = team === 1 ? 2 : 1;
              this.broadcast({ type: "team-result", winnerTeam, loserTeam: team, rewards: this.rewardList(winnerTeam) });
            }
          } else {
            this.checkArenaResult();
          }
        }
      }
      this.broadcast({ type: "peer-message", from: slot, team, payload: message }, server);
    });

    const remove = () => {
      if (!this.players.has(server)) return;
      this.players.delete(server);
      if (this.started && !this.finished) {
        this.rewardStatus.set(slot, { playerId, eligible: true, reason: null, team, pendingReconnect: true });
        this.broadcast({ type: "player-reconnecting", slot, team, seconds: 5 });
        const timer = setTimeout(() => {
          const state = this.rewardStatus.get(slot);
          if (!state?.pendingReconnect) return;
          this.forfeitedPlayers.add(playerId);
          this.rewardStatus.set(slot, { playerId, eligible: false, reason: "disconnect", team, pendingReconnect: false });
          this.eliminatedSlots.add(slot);
          this.broadcast({ type: "reward-status", slot, team, eligible: false, reason: "disconnect" });
          this.broadcast({ type: "player-eliminated", slot, team, reason: "disconnect" });
          if (this.mode === "2v2") {
            const expectedTeamSlots = team === 1 ? [1, 2] : [3, 4];
            if (expectedTeamSlots.every(s => this.eliminatedSlots.has(s))) {
              this.finished = true;
              const winnerTeam = team === 1 ? 2 : 1;
              this.broadcast({ type: "team-result", winnerTeam, loserTeam: team, rewards: this.rewardList(winnerTeam) });
            }
          } else if (this.mode === "arena") {
            this.checkArenaResult();
          }
          this.disconnectTimers.delete(playerId);
        }, 5000);
        this.disconnectTimers.set(playerId, timer);
      } else {
        this.broadcast({ type: "player-left", slot, team, playerId, forfeited: false, rewardEligible: true });
      }
    };
    server.addEventListener("close", remove);
    server.addEventListener("error", remove);

    server.send(JSON.stringify({ type: "joined", slot, team, mode: this.mode, capacity, players: this.playerList(), reconnected }));
    if (reconnected) this.broadcast({ type: "player-reconnected", player: { playerId, name, ship, slot, team } }, server);
    this.broadcast({ type: "player-joined", player: { playerId, name, ship, slot, team } }, server);
    if (this.players.size === capacity) {
      this.started = true;
      this.broadcast({ type: "ready", mode: this.mode, players: this.playerList() });
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  playerList() { return Array.from(this.players.values()); }
  checkArenaResult() {
    if (this.finished || this.mode !== "arena" || !this.started) return;
    // Arena siempre comienza con 4 participantes. No dependemos de los sockets
    // actualmente conectados para decidir la victoria: una desconexion temporal
    // no puede convertir accidentalmente a varios jugadores en ganadores.
    const arenaSlots = [1, 2, 3, 4];
    const dead = arenaSlots.filter(slot => this.eliminatedSlots.has(slot));
    if (dead.length !== 3) return;
    const winnerSlot = arenaSlots.find(slot => !this.eliminatedSlots.has(slot)) || 0;
    if (!winnerSlot) return;
    this.finished = true;
    const winner = this.playerList().find(p => p.slot === winnerSlot) || null;
    this.broadcast({ type: "arena-result", winnerSlot, winnerPlayerId: winner?.playerId || null, rewards: this.rewardListBySlot(winnerSlot) });
  }
  rewardListBySlot(winnerSlot) {
    const p = this.playerList().find(p => p.slot === winnerSlot);
    if (!p) return [];
    const status = this.rewardStatus.get(p.slot);
    return [{ slot:p.slot, playerId:p.playerId, eligible:status ? status.eligible !== false : true, reason:status?.reason || null }];
  }
  rewardList(winnerTeam) {
    return this.playerList().filter(p => p.team === winnerTeam).map(p => {
      const status = this.rewardStatus.get(p.slot);
      return { slot: p.slot, playerId: p.playerId, eligible: status ? status.eligible !== false : true, reason: status?.reason || null };
    });
  }
  broadcast(message, except = null) {
    const data = JSON.stringify(message);
    for (const socket of this.players.keys()) {
      if (socket === except) continue;
      try { socket.send(data); } catch {}
    }
  }
}

export class PvpRanking {
  constructor(ctx, env) { this.ctx=ctx; this.env=env; }
  async fetch(request) {
    const url=new URL(request.url);
    if(request.method==='GET'){
      const list=(await this.ctx.storage.get('players'))||{};
      const ranking=Object.values(list).sort((a,b)=>b.cups-a.cups||b.wins-a.wins||b.kills-a.kills).slice(0,100);
      return json({ok:true,ranking});
    }
    if(request.method!=='POST') return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
    let body; try{body=await request.json();}catch{return json({ok:false,error:'BAD_JSON'},400);}
    const playerId=safeText(body.playerId,'',128); if(!playerId)return json({ok:false,error:'PLAYER_ID_REQUIRED'},400);
    const name=safeText(body.name,'Jugador',40);
    const kills=Math.max(0,Math.min(3,Math.floor(Number(body.kills)||0)));
    const result=body.result==='win'?'win':body.result==='loss'?'loss':body.result==='forfeit'?'forfeit':body.result==='disconnect'?'disconnect':null;
    if(!result)return json({ok:false,error:'BAD_RESULT'},400);
    const matchId=safeText(body.matchId,'',80); if(!matchId)return json({ok:false,error:'MATCH_ID_REQUIRED'},400);
    const seen=(await this.ctx.storage.get('seen'))||{};
    const dedupe=playerId+'|'+matchId;
    const players=(await this.ctx.storage.get('players'))||{};
    if(seen[dedupe]) return json({ok:true,duplicate:true,record:players[playerId]||null});
    const prev=players[playerId]||{playerId,name,cups:0,kills:0,wins:0,losses:0,matches:0};
    // Copas: +20 victoria, +3 por eliminacion, -10 derrota, -15 abandono/desconexion definitiva.
    const penalizedExit=result==='forfeit'||result==='disconnect';
    const delta=penalizedExit?-15:(kills*3+(result==='win'?20:-10));
    const oldCups=Math.max(0,Number(prev.cups||0));
    const newCups=Math.max(0,oldCups+delta);
    const appliedDelta=newCups-oldCups;
    const record={...prev,name,cups:newCups,kills:Number(prev.kills||0)+kills,wins:Number(prev.wins||0)+(result==='win'?1:0),losses:Number(prev.losses||0)+(result!=='win'?1:0),matches:Number(prev.matches||0)+1};
    players[playerId]=record; seen[dedupe]=Date.now();
    const keys=Object.keys(seen); if(keys.length>1000) keys.sort((a,b)=>seen[a]-seen[b]).slice(0,keys.length-1000).forEach(k=>delete seen[k]);
    await this.ctx.storage.put({players,seen});
    return json({ok:true,delta:appliedDelta,record});
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
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: JSON_HEADERS });
    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ ok: true, service: "gallina-cosmica-pvp", version: 3, matchmaking: true, modes: ["1v1", "2v2", "arena"] });
    }
    if (url.pathname === "/ranking") {
      const id = env.PVP_RANKING.idFromName("global");
      return env.PVP_RANKING.get(id).fetch(request);
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

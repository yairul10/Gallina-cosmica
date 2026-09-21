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
    this.eliminationOrder = [];
    this.finished = false;
    this.started = false;
    this.rewardStatus = new Map();
    this.disconnectTimers = new Map();
    this.botPlayer = null;
    this.botPlayers = [];
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
    const wantsBot = (this.mode === "1v1" || this.mode === "2v2") && url.searchParams.get("bot") === "1";
    const requestedHumanCount = Math.max(1, Math.min(capacity, Number(url.searchParams.get("humanCount") || 1)));
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
      const humanSlots = wantsBot && this.mode==="2v2" ? Array.from({length:requestedHumanCount},(_,i)=>i+1) : Array.from({length:capacity},(_,i)=>i+1);
      slot = humanSlots.find(s => !used.has(s)) || Array.from({length:capacity},(_,i)=>i+1).find(s => !used.has(s)) || capacity;
      team = this.mode === "2v2" ? (slot <= 2 ? 1 : 2) : 0;
      this.rewardStatus.set(slot, { playerId, eligible: true, reason: null, team, pendingReconnect: false });
    }
    this.players.set(server, { playerId, name, ship, slot, team });
    if (wantsBot && this.players.size === 1 && !this.botPlayer && this.botPlayers.length === 0) {
      if (this.mode === "1v1") {
        const botSlot = slot === 1 ? 2 : 1;
        this.botPlayer = { playerId:"bot-cosmico", name:"🤖 Bot Cósmico", ship:"Gallina", slot:botSlot, team:0, bot:true };
      } else if (this.mode === "2v2") {
        // Los humanos de la cola ocupan primero sus slots; sólo los espacios
        // restantes se completan con bots.
        const botSlots=Array.from({length:capacity-requestedHumanCount},(_,i)=>requestedHumanCount+i+1);
        this.botPlayers = botSlots.map(botSlot=>({
          playerId:"bot-cosmico-"+botSlot,
          name:botSlot<=2?"🤖 Bot Aliado":"🤖 Bot Cósmico "+botSlot,
          ship:"Gallina", slot:botSlot, team:botSlot<=2?1:2, bot:true
        }));
      }
    }

    server.addEventListener("message", event => {
      let message; try { message = JSON.parse(event.data); } catch { return; }
      if (!message || typeof message !== "object") return;
      if (message.type === "bot-defeat" && this.mode === "2v2" && !this.finished) {
        const deadSlot=Number(message.slot||0);
        const bot=this.botPlayers.find(p=>Number(p.slot)===deadSlot);
        if(bot && !this.eliminatedSlots.has(deadSlot)){
          this.eliminationOrder.push(deadSlot);
          this.eliminatedSlots.add(deadSlot);
          const killerSlot=Number(message.killerSlot||0);
          const attackKind=message.attackKind==="missile"?"missile":"laser";
          this.broadcast({type:"player-eliminated",slot:deadSlot,team:Number(bot.team||0),reason:"combat",killerSlot,attackKind});
          const teamSlots=this.playerList().filter(p=>Number(p.team)===Number(bot.team)).map(p=>Number(p.slot));
          if(teamSlots.length===2 && teamSlots.every(s=>this.eliminatedSlots.has(s))){
            this.finished=true;
            const winnerTeam=Number(bot.team)===1?2:1;
            this.broadcast({type:"team-result",winnerTeam,loserTeam:Number(bot.team),rewards:this.rewardList(winnerTeam)});
          }
        }
        return;
      }
      if (message.type === "defeat") {
        // En 1v1 una derrota de combate termina oficialmente la sala.
        // Sin esto, al cerrar la pantalla después del resultado el servidor
        // interpretaba ambos sockets como desconexiones y volvía a penalizar copas.
        if (this.mode === "1v1" && message.reason !== "forfeit") {
          this.finished = true;
          if (!this.eliminatedSlots.has(slot)) this.eliminationOrder.push(slot);
          this.eliminatedSlots.add(slot);
        }
        if (message.reason === "forfeit") {
          this.forfeitedPlayers.add(playerId);
          this.rewardStatus.set(slot, { playerId, eligible: false, reason: "forfeit" });
          message.rewardEligible = false;
          this.broadcast({ type: "reward-status", slot, team, eligible: false, reason: "forfeit" });
        }
        if ((this.mode === "2v2" || this.mode === "arena") && !this.finished) {
          if (!this.eliminatedSlots.has(slot)) this.eliminationOrder.push(slot);
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
      if (this.started && !this.finished && !this.forfeitedPlayers.has(playerId)) {
        this.rewardStatus.set(slot, { playerId, eligible: true, reason: null, team, pendingReconnect: true });
        this.broadcast({ type: "player-reconnecting", slot, team, seconds: 5 });
        const timer = setTimeout(() => {
          const state = this.rewardStatus.get(slot);
          if (!state?.pendingReconnect) return;
          this.forfeitedPlayers.add(playerId);
          this.rewardStatus.set(slot, { playerId, eligible: false, reason: "disconnect", team, pendingReconnect: false });
          if (!this.eliminatedSlots.has(slot)) this.eliminationOrder.push(slot);
          this.eliminatedSlots.add(slot);
          this.broadcast({ type: "reward-status", slot, team, eligible: false, reason: "disconnect" });
          this.broadcast({ type: "player-eliminated", slot, team, reason: "disconnect" });
          // La desconexion definitiva se liquida en el servidor tras los 5 s de gracia.
          // El ranking deduplica por jugador+sala para evitar cobros repetidos.
          try {
            const rankingId=this.env.PVP_RANKING.idFromName("global");
            const rankingStub=this.env.PVP_RANKING.get(rankingId);
            const disconnectedName=safeText(state.name || name, name || "Jugador", 40);
            rankingStub.fetch("https://ranking.internal/ranking", {
              method:"POST",
              headers:{"content-type":"application/json"},
              body:JSON.stringify({playerId,name:disconnectedName,kills:0,result:"disconnect",matchId:"disconnect-"+url.pathname+"-"+this.mode})
            }).catch(()=>{});
          } catch {}
          if (this.mode === "1v1") {
            // En 1v1 la desconexion definitiva equivale a derrota.
            // Avisamos al rival con el mismo mensaje que ya usa una derrota normal,
            // para que cierre la partida en vez de quedar esperando.
            this.finished = true;
            this.broadcast({ type: "peer-message", from: slot, team, payload: { type: "defeat", reason: "disconnect", slot, team, killerSlot: 0, rewardEligible: false } });
          } else if (this.mode === "2v2") {
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
    if (new Set(this.playerList().map(p=>Number(p.slot))).size === capacity) {
      this.started = true;
      this.broadcast({ type: "ready", mode: this.mode, players: this.playerList() });
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  playerList() { return [...Array.from(this.players.values()), ...(this.botPlayer ? [this.botPlayer] : []), ...this.botPlayers]; }
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
    const podiumSlots = [winnerSlot, ...this.eliminationOrder.slice().reverse()].slice(0, 4);
    this.broadcast({ type: "arena-result", winnerSlot, winnerPlayerId: winner?.playerId || null, podiumSlots, rewards: this.rewardListBySlot(winnerSlot) });
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

  monthKey(now=Date.now()){
    const d=new Date(now);
    return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');
  }

  sort(list){ return Object.values(list).sort((a,b)=>Number(b.cups||0)-Number(a.cups||0)||Number(b.wins||0)-Number(a.wins||0)||Number(b.kills||0)-Number(a.kills||0)); }

  rankFor(cups){
    cups=Math.max(0,Number(cups)||0);
    if(cups>=12000)return {name:'Leyenda Galáctica',icon:'🌌',floor:12000};
    if(cups>=7000)return {name:'Maestro Cósmico',icon:'🚀',floor:7000};
    if(cups>=3000)return {name:'Diamante',icon:'💎',floor:3000};
    if(cups>=1000)return {name:'Oro',icon:'🥇',floor:1000};
    if(cups>=500)return {name:'Plata',icon:'🥈',floor:500};
    if(cups>=200)return {name:'Bronce',icon:'🥉',floor:200};
    return {name:'Novato',icon:'🥚',floor:0};
  }

  async rollover(now=Date.now()){
    const month=this.monthKey(now);
    let activeMonth=await this.ctx.storage.get('singleRankingMonth');
    let players=(await this.ctx.storage.get('players'))||{};
    let monthlyAwards=(await this.ctx.storage.get('monthlyAwards'))||{};

    if(!activeMonth){
      activeMonth=month;
    } else if(activeMonth!==month){
      const winners=this.sort(players).slice(0,10);
      winners.forEach((p,i)=>{
        const key='month:'+activeMonth+':'+p.playerId;
        if(!monthlyAwards[key]) monthlyAwards[key]={type:i<3?'monthly-skin':'monthly-cosmetic',period:activeMonth,playerId:p.playerId,position:i+1,claimed:false,createdAt:now};
      });
      await this.ctx.storage.put('lastMonth',{period:activeMonth,ranking:winners,closedAt:now});
      for(const p of Object.values(players)){
        const cups=Math.max(0,Number(p.cups||0));
        // Novato, Bronce y Plata conservan sus copas. Desde Oro se vuelve al piso del rango.
        if(cups>=1000)p.cups=this.rankFor(cups).floor;
      }
      activeMonth=month;
    }
    await this.ctx.storage.put({players,singleRankingMonth:activeMonth,monthlyAwards});
    return {activeMonth,players,monthlyAwards};
  }

  async fetch(request) {
    const state=await this.rollover();
    const url=new URL(request.url);

    if(request.method==='GET'){
      const ranking=this.sort(state.players).slice(0,100).map(p=>({...p,rank:this.rankFor(p.cups)}));
      const playerId=safeText(url.searchParams.get('playerId'),'',128);
      const record=playerId&&state.players[playerId]?{...state.players[playerId],rank:this.rankFor(state.players[playerId].cups)}:null;
      const pendingMonthly=playerId?Object.values(state.monthlyAwards).filter(r=>r.playerId===playerId&&!r.claimed):[];
      return json({ok:true,month:state.activeMonth,ranking,record,pendingMonthly});
    }

    if(request.method!=='POST') return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
    let body; try{body=await request.json();}catch{return json({ok:false,error:'BAD_JSON'},400);}
    const playerId=safeText(body.playerId,'',128); if(!playerId)return json({ok:false,error:'PLAYER_ID_REQUIRED'},400);
    const name=safeText(body.name,'Jugador',40);
    const kills=Math.max(0,Math.min(3,Math.floor(Number(body.kills)||0)));
    const result=body.result==='win'?'win':body.result==='loss'?'loss':body.result==='forfeit'?'forfeit':body.result==='disconnect'?'disconnect':null;
    if(!result)return json({ok:false,error:'BAD_RESULT'},400);
    const matchId=safeText(body.matchId,'',80); if(!matchId)return json({ok:false,error:'MATCH_ID_REQUIRED'},400);

    const seen=(await this.ctx.storage.get('seen'))||{}, dedupe=playerId+'|'+matchId;
    const players=state.players;
    if(seen[dedupe]){
      const record=players[playerId]||null;
      return json({ok:true,duplicate:true,record:record?{...record,rank:this.rankFor(record.cups)}:null,month:state.activeMonth});
    }

    const prev=players[playerId]||{playerId,name,cups:0,kills:0,wins:0,losses:0,matches:0};
    const oldCups=Math.max(0,Number(prev.cups||0));
    const lossPenalty=(cups)=>{
      if(cups>=12000)return 10; // Leyenda Galáctica
      if(cups>=7000)return 8;   // Maestro Cósmico
      if(cups>=3000)return 5;   // Diamante
      if(cups>=1000)return 3;   // Oro
      return 0;                 // Novato, Bronce y Plata
    };
    const penalty=lossPenalty(oldCups);
    // Las eliminaciones solo bonifican copas al ganar. Así una derrota nunca termina sumando copas.
    const delta=result==='win'?(20+kills*3):-penalty;
    const newCups=Math.max(0,oldCups+delta), appliedDelta=newCups-oldCups;
    const record={...prev,name,cups:newCups,kills:Number(prev.kills||0)+kills,wins:Number(prev.wins||0)+(result==='win'?1:0),losses:Number(prev.losses||0)+(result!=='win'?1:0),matches:Number(prev.matches||0)+1};
    players[playerId]=record;
    seen[dedupe]=Date.now();
    const keys=Object.keys(seen); if(keys.length>1000) keys.sort((x,y)=>seen[x]-seen[y]).slice(0,keys.length-1000).forEach(k=>delete seen[k]);
    await this.ctx.storage.put({players,seen});
    return json({ok:true,delta:appliedDelta,record:{...record,rank:this.rankFor(record.cups)},month:state.activeMonth});
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

    // Actualiza a todos los jugadores de la cola para que vean cuántos
    // participantes humanos están esperando en este momento.
    const sendQueueCount = list => {
      const msg=JSON.stringify({ type:"queue-waiting", mode, waiting:list.length, needed });
      for(const entry of list){ try{ entry.socket.send(msg); }catch{} }
    };
    sendQueueCount(current);

    const clear = () => {
      const list = this.waitingByMode?.get(mode) || [];
      const remaining=list.filter(entry => entry.socket !== server);
      this.waitingByMode?.set(mode, remaining);
      sendQueueCount(remaining);
    };
    server.addEventListener("close", clear);
    server.addEventListener("error", clear);

    // Prueba: en 1v1 o 2v2, si no se completa la cola en 5 s, crear
    // una partida con bots. Al terminar las pruebas cambiaremos 5000 por 60000.
    if (mode === "1v1" || mode === "2v2") {
      setTimeout(() => {
        const list = this.waitingByMode?.get(mode) || [];
        const index = list.findIndex(entry => entry.socket === server);
        if (index < 0) return;

        if (mode === "2v2") {
          // Al vencer el tiempo, todos los humanos que siguen esperando entran
          // juntos en UNA misma sala; los puestos restantes se completan con bots.
          // Sólo el jugador más antiguo de la cola ejecuta esta agrupación.
          if (index !== 0) return;
          const group = list.splice(0, Math.min(needed, list.length));
          this.waitingByMode.set(mode, list);
          const roomCode = queueRoomCode();
          const humanCount = group.length;
          const match = { type:"match-found", roomCode, mode, players:needed, bot:true, humanCount };
          for (const queued of group) {
            try { queued.socket.send(JSON.stringify(match)); } catch {}
            try { queued.socket.close(1000, "matched-bots"); } catch {}
          }
          return;
        }

        const [entry] = list.splice(index, 1);
        this.waitingByMode.set(mode, list);
        const roomCode = queueRoomCode();
        try { entry.socket.send(JSON.stringify({ type:"match-found", roomCode, mode, players:needed, bot:true })); } catch {}
        try { entry.socket.close(1000, "matched-bot"); } catch {}
      }, 5000);
    }

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

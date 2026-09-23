// Deployment trigger: Play Games verified PvP authentication enabled.
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

const GOOGLE_SERVER_CLIENT_ID = "672762312251-iub1fld742850kn1v637dvhle7e0mdv4.apps.googleusercontent.com";
const PLAY_GAMES_APPLICATION_ID = "672762312251";
const SESSION_TTL_MS = 60 * 60 * 1000;
const ACTIVE_SESSION_HEADER = 'x-pvp-session-internal';

function b64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64urlText(text) { return b64url(new TextEncoder().encode(text)); }
function fromB64url(value) {
  const base64 = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, ch => ch.charCodeAt(0));
}
async function sessionKey(env) {
  if (!env.GOOGLE_OAUTH_CLIENT_SECRET) throw new Error("SERVER_AUTH_NOT_CONFIGURED");
  return crypto.subtle.importKey("raw", new TextEncoder().encode(env.GOOGLE_OAUTH_CLIENT_SECRET),
    { name:"HMAC", hash:"SHA-256" }, false, ["sign","verify"]);
}
async function createSessionToken(env, playerId, sessionId) {
  const payload = b64urlText(JSON.stringify({ sub:String(playerId), sid:String(sessionId||""), exp:Date.now()+SESSION_TTL_MS }));
  const signature = await crypto.subtle.sign("HMAC", await sessionKey(env), new TextEncoder().encode(payload));
  return payload + "." + b64url(new Uint8Array(signature));
}
async function verifySessionToken(env, token) {
  try {
    const [payload, signature] = String(token||"").split(".");
    if (!payload || !signature) return null;
    const ok = await crypto.subtle.verify("HMAC", await sessionKey(env), fromB64url(signature), new TextEncoder().encode(payload));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (!data?.sub || Number(data.exp||0) <= Date.now()) return null;
    return { playerId:String(data.sub), sessionId:String(data.sid||''), expiresAt:Number(data.exp) };
  } catch { return null; }
}
async function authenticatePlayGames(request, env) {
  if (!env.GOOGLE_OAUTH_CLIENT_SECRET) return json({ok:false,error:"SERVER_AUTH_NOT_CONFIGURED"},503);
  let body; try { body=await request.json(); } catch { return json({ok:false,error:"BAD_JSON"},400); }
  const authCode=safeText(body?.authCode,"",4096);
  if(!authCode)return json({ok:false,error:"AUTH_CODE_REQUIRED"},400);

  const form=new URLSearchParams({
    code:authCode,
    client_id:GOOGLE_SERVER_CLIENT_ID,
    client_secret:env.GOOGLE_OAUTH_CLIENT_SECRET,
    grant_type:"authorization_code",
    redirect_uri:""
  });
  const tokenResponse=await fetch("https://oauth2.googleapis.com/token",{
    method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:form
  });
  const tokenData=await tokenResponse.json().catch(()=>({}));
  if(!tokenResponse.ok||!tokenData?.access_token)return json({ok:false,error:"GOOGLE_TOKEN_EXCHANGE_FAILED"},401);

  const verifyResponse=await fetch("https://games.googleapis.com/games/v1/applications/"+PLAY_GAMES_APPLICATION_ID+"/verify",{
    headers:{authorization:"Bearer "+tokenData.access_token}
  });
  const verified=await verifyResponse.json().catch(()=>({}));
  const playerId=safeText(verified?.player_id||verified?.playerId,"",128);
  if(!verifyResponse.ok||!playerId)return json({ok:false,error:"PLAY_GAMES_VERIFY_FAILED"},401);

  const expiresAt=Date.now()+SESSION_TTL_MS;
  const sessionId=crypto.randomUUID();
  const sessionToken=await createSessionToken(env,playerId,sessionId);
  // Una sola sesión activa por cuenta. Un login posterior invalida la anterior.
  const rankingId=env.PVP_RANKING.idFromName("global");
  await env.PVP_RANKING.get(rankingId).fetch("https://ranking.internal/active-session",{
    method:"POST",headers:{"content-type":"application/json",[ACTIVE_SESSION_HEADER]:"1"},
    body:JSON.stringify({playerId,sessionId,expiresAt})
  });
  return json({ok:true,playerId,sessionToken,expiresAt});
}
async function authorizePvpRequest(request, env) {
  const url=new URL(request.url);
  const session=await verifySessionToken(env,url.searchParams.get("session"));
  if(!session)return null;
  const rankingId=env.PVP_RANKING.idFromName("global");
  const activeResponse=await env.PVP_RANKING.get(rankingId).fetch("https://ranking.internal/active-session?playerId="+encodeURIComponent(session.playerId)+"&sessionId="+encodeURIComponent(session.sessionId||""),{headers:{[ACTIVE_SESSION_HEADER]:"1"}});
  const active=await activeResponse.json().catch(()=>({}));
  if(!active?.active)return null;
  url.searchParams.set("playerId",session.playerId);
  url.searchParams.delete("session");

  // El rango y el matchmaking también usan las copas oficiales del servidor,
  // nunca el valor que declare el cliente.
  try{
    const rankingId=env.PVP_RANKING.idFromName("global");
    const rankingResponse=await env.PVP_RANKING.get(rankingId).fetch("https://ranking.internal/ranking?playerId="+encodeURIComponent(session.playerId));
    const rankingData=await rankingResponse.json();
    url.searchParams.set("cups",String(Math.max(0,Number(rankingData?.record?.cups||0))));
  }catch{ url.searchParams.set("cups","0"); }

  return new Request(url.toString(),request);
}

function idSet(value) {
  return new Set(String(value || "").split(",").map(v=>v.trim()).filter(Boolean));
}
function qaPlayerIds(env) { return idSet(env.QA_PLAYER_IDS); }
function qaAdminIds(env) { return idSet(env.QA_ADMIN_PLAYER_IDS); }
async function qaRegistry(env, action, playerId="") {
  const id=env.PVP_RANKING.idFromName("global");
  return env.PVP_RANKING.get(id).fetch("https://ranking.internal/qa-registry",{
    method:"POST",headers:{"content-type":"application/json","x-pvp-internal":"qa-admin"},
    body:JSON.stringify({action,playerId})
  });
}
async function qaAccess(request, env) {
  const url=new URL(request.url);
  const session=await verifySessionToken(env,url.searchParams.get("session"));
  if(!session)return json({ok:false,qaEnabled:false,isAdmin:false,error:"PLAY_GAMES_AUTH_REQUIRED"},401);
  const rankingId=env.PVP_RANKING.idFromName("global");
  const active=await env.PVP_RANKING.get(rankingId).fetch("https://ranking.internal/active-session?playerId="+encodeURIComponent(session.playerId)+"&sessionId="+encodeURIComponent(session.sessionId||""),{headers:{[ACTIVE_SESSION_HEADER]:"1"}}).then(r=>r.json()).catch(()=>({}));
  if(!active?.active)return json({ok:false,qaEnabled:false,isAdmin:false,error:"SESSION_REPLACED"},401);
  const isAdmin=qaAdminIds(env).has(String(session.playerId));
  const response=await qaRegistry(env,"check",session.playerId);
  const data=await response.json().catch(()=>({}));
  const enabled=isAdmin || qaPlayerIds(env).has(String(session.playerId)) || data?.enabled===true;
  return json({ok:true,qaEnabled:enabled,isAdmin});
}
async function qaAdmin(request, env) {
  const url=new URL(request.url);
  const session=await verifySessionToken(env,url.searchParams.get("session"));
  if(!session)return json({ok:false,error:"PLAY_GAMES_AUTH_REQUIRED"},401);
  if(!qaAdminIds(env).has(String(session.playerId)))return json({ok:false,error:"QA_ADMIN_REQUIRED"},403);
  let body={}; if(request.method==="POST"){try{body=await request.json();}catch{return json({ok:false,error:"BAD_JSON"},400);}}
  const action=request.method==="GET"?"list":safeText(body.action,"",16);
  if(!["list","add","remove"].includes(action))return json({ok:false,error:"BAD_ACTION"},400);
  const playerId=safeText(body.playerId,"",128);
  if((action==="add"||action==="remove")&&!playerId)return json({ok:false,error:"PLAYER_ID_REQUIRED"},400);
  return qaRegistry(env,action,playerId);
}

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
  return mode === "2v2" || mode === "arena" || mode === "arena10" ? mode : "1v1";
}

function pvpRankFromCups(cups){
  cups=Math.max(0,Number(cups)||0);
  if(cups>=12000)return {label:"🌌 Leyenda Galáctica",level:6};
  if(cups>=7000)return {label:"🚀 Maestro Cósmico",level:5};
  if(cups>=3000)return {label:"💎 Diamante",level:4};
  if(cups>=1000)return {label:"🥇 Oro",level:3};
  if(cups>=500)return {label:"🥈 Plata",level:2};
  if(cups>=200)return {label:"🥉 Bronce",level:1};
  return {label:"🥚 Novato",level:0};
}
function seeded01(slot,salt=0){let x=(Number(slot)*1103515245+12345+salt*2654435761)>>>0;return x/4294967296;}
function botShipForRank(level,slot){
  const chance=level>=6?.25:level===5?.20:level===4?.15:0;
  if(!chance||seeded01(slot,17)>=chance)return "Gallina";
  const toros=["Toro Aniquilador","Toro Blindado","Toro Baliza"];
  return toros[Math.floor(seeded01(slot,31)*toros.length)%toros.length];
}
function configureBotProfiles(list,humanPlayers){
  const humans=humanPlayers.filter(p=>!p.bot);
  const avg=humans.length?humans.reduce((a,p)=>a+Math.max(0,Number(p.cups)||0),0)/humans.length:0;
  const rank=pvpRankFromCups(avg);
  for(const bot of list){bot.rankLevel=rank.level;bot.rankLabel=rank.label;bot.ship=botShipForRank(rank.level,bot.slot);bot.name="🤖 "+rank.label+" · Bot "+bot.slot;}
}

function roomCapacity(mode) {
  return mode === "1v1" ? 2 : mode === "arena" ? 5 : mode === "arena10" ? 10 : 4;
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
    this.serverKills = new Map();
    this.officialResult = null;
    this.roomCode = null;
    // Registro efímero de disparos humanos para validar confirmaciones de impacto.
    this.activeShots = new Map();
  }

  async fetch(request) {
    const upgrade = request.headers.get("Upgrade");
    if (!upgrade || upgrade.toLowerCase() !== "websocket") {
      return json({ ok: true, service: "gallina-cosmica-pvp-room" });
    }
    const url = new URL(request.url);
    const requestedMode = gameMode(url);
    if(!this.roomCode){const m=url.pathname.match(/\/room\/(\d{6})$/);this.roomCode=m?m[1]:safeText(url.pathname,'room',40);}
    if (!this.mode) this.mode = requestedMode;
    if (requestedMode !== this.mode) return json({ ok: false, error: "MODE_MISMATCH" }, 409);
    const capacity = roomCapacity(this.mode);
    const wantsBot = (this.mode === "1v1" || this.mode === "2v2" || this.mode === "arena" || this.mode === "arena10") && url.searchParams.get("bot") === "1";
    const requestedHumanCount = Math.max(1, Math.min(capacity, Number(url.searchParams.get("humanCount") || 1)));
    if (this.players.size >= capacity) return json({ ok: false, error: "ROOM_FULL" }, 409);

    const pair = new WebSocketPair(), client = pair[0], server = pair[1];
    server.accept();
    const playerId = safeText(url.searchParams.get("playerId"), crypto.randomUUID(), 128);
    const name = safeText(url.searchParams.get("name"), "Jugador", 40);
    const ship = safeText(url.searchParams.get("ship"), "Gallina", 40);
    const cups = Math.max(0, Math.min(9999999, Number(url.searchParams.get("cups") || 0)));
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
      if(wantsBot&&this.mode==="2v2"&&requestedHumanCount===2&&!this.humanSlotPlan){
        this.humanSlotPlan=Math.random()<0.5?[1,2]:[1,3];
      }
      const humanSlots = wantsBot && (this.mode==="2v2"||this.mode==="arena"||this.mode==="arena10")
        ? (this.mode==="2v2"&&requestedHumanCount===2 ? this.humanSlotPlan : Array.from({length:requestedHumanCount},(_,i)=>i+1))
        : Array.from({length:capacity},(_,i)=>i+1);
      slot = humanSlots.find(s => !used.has(s)) || Array.from({length:capacity},(_,i)=>i+1).find(s => !used.has(s)) || capacity;
      team = this.mode === "2v2" ? (slot <= 2 ? 1 : 2) : 0;
      this.rewardStatus.set(slot, { playerId, eligible: true, reason: null, team, pendingReconnect: false });
    }
    this.players.set(server, { playerId, name, ship, slot, team, cups });
    if (wantsBot && this.players.size === 1 && !this.botPlayer && this.botPlayers.length === 0) {
      if (this.mode === "1v1") {
        const botSlot = slot === 1 ? 2 : 1;
        this.botPlayer = { playerId:"bot-cosmico", name:"🤖 Bot Cósmico", ship:"Gallina", slot:botSlot, team:0, bot:true };
      } else if (this.mode === "2v2") {
        // Los humanos de la cola ocupan primero sus slots; sólo los espacios
        // restantes se completan con bots.
        const plannedHumanSlots=requestedHumanCount===2?(this.humanSlotPlan||[1,2]):Array.from({length:requestedHumanCount},(_,i)=>i+1);
        const botSlots=Array.from({length:capacity},(_,i)=>i+1).filter(s=>!plannedHumanSlots.includes(s));
        this.botPlayers = botSlots.map(botSlot=>({
          playerId:"bot-cosmico-"+botSlot,
          name:botSlot<=2?"🤖 Bot Aliado":"🤖 Bot Cósmico "+botSlot,
          ship:"Gallina", slot:botSlot, team:botSlot<=2?1:2, bot:true
        }));
      } else if (this.mode === "arena" || this.mode === "arena10") {
        const plannedHumanSlots=Array.from({length:requestedHumanCount},(_,i)=>i+1);
        const botSlots=Array.from({length:capacity},(_,i)=>i+1).filter(s=>!plannedHumanSlots.includes(s));
        this.botPlayers=botSlots.map(botSlot=>({
          playerId:"bot-arena-"+botSlot,
          name:"🤖 Bot Cósmico "+botSlot,
          ship:"Gallina",slot:botSlot,team:0,bot:true
        }));
      }
    }

    server.addEventListener("message", event => {
      let message; try { message = JSON.parse(event.data); } catch { return; }
      if (!message || typeof message !== "object") return;

      // Un participante eliminado, rendido o una sala ya finalizada no puede
      // seguir alterando el combate. Permitimos únicamente mensajes inocuos de
      // sincronización/salida; disparos, misiles, estado y derrotas se descartan.
      const senderOut=this.eliminatedSlots.has(slot)||this.forfeitedPlayers.has(playerId);
      const gameplayTypes=new Set(["state","shot","missile","evade","hit-confirm","defeat","bot-defeat"]);
      if((this.finished||senderOut)&&gameplayTypes.has(String(message.type||""))) return;

      if (message.type === "shot") {
        const shotId=safeText(message.shotId,"",96), targetSlot=Number(message.targetSlot||0), firedAt=Number(message.firedAt||Date.now());
        const target=this.playerList().find(p=>Number(p.slot)===targetSlot);
        const validTarget=target && targetSlot!==slot && !(this.mode==="2v2" && Number(target.team)===Number(team));
        if(!shotId || !validTarget) return;
        // El servidor no acepta que el cliente suplante al atacante ni reutilice IDs.
        if(this.activeShots.has(shotId)) return;
        const now=Date.now();
        this.activeShots.set(shotId,{attackerSlot:slot,targetSlot,firedAt:Math.max(now-2000,Math.min(now+250,firedAt)),createdAt:now,confirmed:false});
        if(this.activeShots.size>256){
          for(const [id,s] of this.activeShots) if(now-Number(s.createdAt||0)>4000)this.activeShots.delete(id);
        }
        message.shotId=shotId; message.targetSlot=targetSlot; message.firedAt=firedAt;
      }
      if (message.type === "hit-confirm") {
        const shotId=safeText(message.shotId,"",96), shot=this.activeShots.get(shotId);
        // Sólo el objetivo registrado puede confirmar el impacto y cada disparo
        // puede producir como máximo un daño.
        if(!shot || shot.confirmed || Number(shot.targetSlot)!==slot || Number(message.attackerSlot||0)!==Number(shot.attackerSlot)) return;
        if(Date.now()-Number(shot.createdAt||0)>3000){this.activeShots.delete(shotId);return;}
        shot.confirmed=true;
        const x=Number(message.hitX),y=Number(message.hitY);
        const payload={type:"hit-confirm",attackKind:"laser",shotId,attackerSlot:Number(shot.attackerSlot),targetSlot:slot,hitX:Number.isFinite(x)?x:null,hitY:Number.isFinite(y)?y:null,firedAt:Number(shot.firedAt||0)};
        // La misma confirmación llega a ambos clientes, incluido el defensor.
        this.broadcast({type:"peer-message",from:slot,team,payload});
        return;
      }

      if (message.type === "bot-defeat" && (this.mode === "1v1" || this.mode === "2v2" || this.mode === "arena" || this.mode === "arena10") && !this.finished) {
        const deadSlot=Number(message.slot||0);
        const bot=this.mode==="1v1"
          ? (this.botPlayer && Number(this.botPlayer.slot)===deadSlot ? this.botPlayer : null)
          : this.botPlayers.find(p=>Number(p.slot)===deadSlot);
        const reportedKiller=Number(message.killerSlot||0);
        const killer=this.playerList().find(p=>Number(p.slot)===reportedKiller);
        const humanSlots=this.playerList().filter(p=>!p.bot).map(p=>Number(p.slot)).filter(Boolean);
        const botAuthoritySlot=humanSlots.length?Math.min(...humanSlots):0;
        // Un cliente ya no puede adjudicar una baja de bot a otro humano.
        // Las bajas causadas por bots o por la Zona Cósmica sólo las puede
        // confirmar el humano autoridad que ya simula esos impactos.
        const validReporter=reportedKiller>0 && killer && !killer.bot
          ? reportedKiller===slot
          : slot===botAuthoritySlot;
        const enemyKill=!killer || !killer.bot || this.mode!=="2v2" || Number(killer.team)!==Number(bot?.team);
        if(bot && validReporter && enemyKill && !this.eliminatedSlots.has(deadSlot)){
          this.eliminationOrder.push(deadSlot);
          this.eliminatedSlots.add(deadSlot);
          const killerSlot=reportedKiller;
          const attackKind=message.attackKind==="missile"?"missile":message.attackKind==="zone"?"zone":"laser";
          this.recordServerKill(killerSlot,deadSlot);
          this.broadcast({type:"player-eliminated",slot:deadSlot,team:Number(bot.team||0),reason:"combat",killerSlot,attackKind});
          if(this.mode==="1v1"){
            this.finished=true;
            const winner=this.playerList().find(p=>!p.bot&&Number(p.slot)!==deadSlot)||null;
            const winnerSlot=Number(winner?.slot||0);
            if(winnerSlot){
              this.officialResult=this.officialSnapshot({winnerSlot,winnerPlayerId:winner?.playerId||null});
              this.settleOfficialResults({winnerSlot,winnerPlayerId:winner?.playerId||null});
              this.broadcast({type:"peer-message",from:deadSlot,team:0,payload:{type:"defeat",killerSlot:winnerSlot,attackKind}});
            }
          } else if(this.mode==="2v2"){
            const teamSlots=this.playerList().filter(p=>Number(p.team)===Number(bot.team)).map(p=>Number(p.slot));
            if(teamSlots.length===2 && teamSlots.every(s=>this.eliminatedSlots.has(s))){
              this.finished=true;
              const winnerTeam=Number(bot.team)===1?2:1;
              this.officialResult=this.officialSnapshot({winnerTeam,loserTeam:Number(bot.team)}); this.settleOfficialResults({winnerTeam,loserTeam:Number(bot.team)}); this.broadcast({type:"team-result",winnerTeam,loserTeam:Number(bot.team),rewards:this.rewardList(winnerTeam),official:this.officialResult});
            }
          } else {
            if(!this.simulateArenaBotsIfNoHumans()) this.checkArenaResult();
          }
        }
        return;
      }
      if (message.type === "defeat") {
        // slot/team pertenecen al socket autenticado de esta sala. Ignoramos
        // cualquier slot/team enviado por el cliente para que no pueda declarar
        // derrotado a otro participante.
        message.slot = slot;
        message.team = team;
        const reportedKiller=Number(message.killerSlot||0);
        const killer=this.playerList().find(p=>Number(p.slot)===reportedKiller);
        if(!killer || reportedKiller===slot || (this.mode==="2v2" && Number(killer.team)===Number(team))) message.killerSlot=0;
        // En 1v1 una derrota de combate termina oficialmente la sala.
        // Sin esto, al cerrar la pantalla después del resultado el servidor
        // interpretaba ambos sockets como desconexiones y volvía a penalizar copas.
        if (this.mode === "1v1" && message.reason !== "forfeit") {
          this.finished = true;
          if (!this.eliminatedSlots.has(slot)) this.eliminationOrder.push(slot);
          this.eliminatedSlots.add(slot);
          // 1v1 también debe generar la liquidación oficial. Antes la sala se
          // marcaba como terminada pero nunca escribía ganador/perdedor al ranking,
          // por eso el cliente acababa mostrando el mismo total de copas.
          const winner=this.playerList().find(p=>Number(p.slot)!==Number(slot))||null;
          const winnerSlot=Number(winner?.slot||0);
          if(winnerSlot){
            this.recordServerKill(Number(message.killerSlot||0),slot);
            this.officialResult=this.officialSnapshot({winnerSlot,winnerPlayerId:winner?.playerId||null});
            this.settleOfficialResults({winnerSlot,winnerPlayerId:winner?.playerId||null});
          }
        }
        if (message.reason === "forfeit") {
          this.forfeitedPlayers.add(playerId);
          this.rewardStatus.set(slot, { playerId, eligible: false, reason: "forfeit" });
          message.rewardEligible = false;
          this.broadcast({ type: "reward-status", slot, team, eligible: false, reason: "forfeit" });
        }
        if ((this.mode === "2v2" || this.mode === "arena" || this.mode === "arena10") && !this.finished) {
          if (!this.eliminatedSlots.has(slot)) this.eliminationOrder.push(slot);
          this.eliminatedSlots.add(slot);
          const killerSlot = Number(message.killerSlot || 0);
          const attackKind = message.attackKind === "missile" ? "missile" : "laser";
          this.recordServerKill(killerSlot,slot);
          this.broadcast({ type: "player-eliminated", slot, team, reason: message.reason || "combat", killerSlot, attackKind });
          if (this.mode === "2v2") {
            const teamSlots = this.playerList().filter(p => Number(p.team) === Number(team)).map(p => Number(p.slot));
            if (teamSlots.length === 2 && teamSlots.every(s => this.eliminatedSlots.has(s))) {
              this.finished = true;
              const winnerTeam = team === 1 ? 2 : 1;
              this.officialResult=this.officialSnapshot({winnerTeam,loserTeam:team}); this.settleOfficialResults({winnerTeam,loserTeam:team}); this.broadcast({ type: "team-result", winnerTeam, loserTeam: team, rewards: this.rewardList(winnerTeam), official:this.officialResult });
            }
          } else {
            if(!this.simulateArenaBotsIfNoHumans()) this.checkArenaResult();
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
              headers:{"content-type":"application/json","x-pvp-internal":"room"},
              body:JSON.stringify({official:true,playerId,name:disconnectedName,kills:0,botKills:0,humanKills:0,result:"disconnect",mode:this.mode,placement:0,matchId:"disconnect-"+url.pathname+"-"+this.mode})
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
          } else if ((this.mode === "arena" || this.mode === "arena10")) {
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
  simulateArenaBotsIfNoHumans() {
    if (this.finished || (this.mode !== "arena" && this.mode !== "arena10") || !this.started) return false;
    const list=this.playerList();
    const alive=list.filter(p=>!this.eliminatedSlots.has(Number(p.slot)));
    // Si ya queda uno solo, cerrar la Arena inmediatamente. Esto evita que un
    // cliente eliminado quede atascado en "Esperando…" cuando el resultado ya existe.
    if(alive.length===1){ this.checkArenaResult(); return true; }
    if(alive.length===0 || alive.some(p=>!p.bot)) return false;
    // Si sólo quedan bots, resolver el resto inmediatamente. El orden se pondera
    // ligeramente por las vidas reportadas cuando estén disponibles; si no, azar.
    const shuffled=alive.slice().sort(()=>Math.random()-.5);
    while(shuffled.length>1){
      const dead=shuffled.shift();
      const deadSlot=Number(dead.slot);
      if(!this.eliminatedSlots.has(deadSlot)){
        this.eliminationOrder.push(deadSlot); this.eliminatedSlots.add(deadSlot);
        this.broadcast({type:"player-eliminated",slot:deadSlot,team:0,reason:"simulation",killerSlot:0,attackKind:"laser"});
      }
    }
    this.broadcast({type:"arena-simulated"});
    this.checkArenaResult();
    return true;
  }
  checkArenaResult() {
    if (this.finished || (this.mode !== "arena" && this.mode !== "arena10") || !this.started) return;
    // Arena 5 y Arena 10 terminan sólo cuando queda un participante vivo.
    const capacity=roomCapacity(this.mode);
    const arenaSlots = Array.from({length:capacity},(_,i)=>i+1);
    const dead = arenaSlots.filter(slot => this.eliminatedSlots.has(slot));
    if (dead.length !== arenaSlots.length - 1) return;
    const winnerSlot = arenaSlots.find(slot => !this.eliminatedSlots.has(slot)) || 0;
    if (!winnerSlot) return;
    this.finished = true;
    const winner = this.playerList().find(p => p.slot === winnerSlot) || null;
    const finalOrder = [winnerSlot, ...this.eliminationOrder.slice().reverse()].filter((slot,i,a)=>slot&&a.indexOf(slot)===i).slice(0,capacity);
    const podiumSlots = finalOrder.slice(0, 4);
    this.officialResult=this.officialSnapshot({winnerSlot,winnerPlayerId:winner?.playerId||null,finalOrder});
    this.settleOfficialResults({winnerSlot,winnerPlayerId:winner?.playerId||null,finalOrder});
    this.broadcast({ type: "arena-result", winnerSlot, winnerPlayerId: winner?.playerId || null, podiumSlots, finalOrder, rewards: this.rewardListBySlot(winnerSlot), official:this.officialResult });
  }
  recordServerKill(killerSlot, deadSlot) {
    killerSlot=Number(killerSlot||0); deadSlot=Number(deadSlot||0);
    if(!killerSlot||killerSlot===deadSlot)return;
    const killer=this.playerList().find(p=>Number(p.slot)===killerSlot);
    if(!killer||killer.bot)return;
    const dead=this.playerList().find(p=>Number(p.slot)===deadSlot);
    if(!dead)return;
    const row=this.serverKills.get(killerSlot)||{botKills:0,humanKills:0};
    if(dead.bot)row.botKills++;else row.humanKills++;
    this.serverKills.set(killerSlot,row);
  }
  officialSnapshot(extra={}) {
    const players=this.playerList().map(p=>({
      slot:Number(p.slot),playerId:p.playerId,team:Number(p.team||0),bot:!!p.bot,
      kills:this.serverKills.get(Number(p.slot))||{botKills:0,humanKills:0}
    }));
    return {mode:this.mode,players,eliminationOrder:this.eliminationOrder.slice(),...extra};
  }
  async settleOfficialResults(extra={}) {
    if(!this.started)return;
    const snapshot=this.officialSnapshot(extra);
    const finalOrder=Array.isArray(snapshot.finalOrder)?snapshot.finalOrder.map(Number):[];
    const winnerSlot=Number(snapshot.winnerSlot||0),winnerTeam=Number(snapshot.winnerTeam||0);
    const rankingId=this.env.PVP_RANKING.idFromName("global"), ranking=this.env.PVP_RANKING.get(rankingId);
    const tasks=[];
    for(const p of snapshot.players.filter(p=>!p.bot)){
      const status=this.rewardStatus.get(Number(p.slot));
      if(status?.eligible===false && status?.reason==='disconnect')continue;
      const kills=p.kills||{botKills:0,humanKills:0};
      const placement=(this.mode==='arena'||this.mode==='arena10')?Math.max(1,finalOrder.indexOf(Number(p.slot))+1):0;
      const won=this.mode==='1v1'?Number(p.slot)===winnerSlot:this.mode==='2v2'?Number(p.team)===winnerTeam:placement===1;
      const result=status?.reason==='forfeit'?'forfeit':won?'win':'loss';
      tasks.push(ranking.fetch("https://ranking.internal/ranking",{
        method:"POST",headers:{"content-type":"application/json","x-pvp-internal":"room"},
        body:JSON.stringify({official:true,playerId:p.playerId,name:this.playerList().find(x=>x.playerId===p.playerId)?.name||"Jugador",
          kills:Number(kills.botKills||0)+Number(kills.humanKills||0),botKills:Number(kills.botKills||0),humanKills:Number(kills.humanKills||0),
          result,mode:this.mode,placement,matchId:"room-"+this.roomCode+"-"+this.mode})
      }).catch(()=>null));
    }
    await Promise.all(tasks);
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
    const url=new URL(request.url);
    if(url.pathname==="/active-session" && request.headers.get(ACTIVE_SESSION_HEADER)==="1"){
      if(request.method==="POST"){
        let body;try{body=await request.json();}catch{return json({ok:false,error:"BAD_JSON"},400);}
        const playerId=safeText(body?.playerId,"",128),sessionId=safeText(body?.sessionId,"",128);
        if(!playerId||!sessionId)return json({ok:false,error:"SESSION_REQUIRED"},400);
        await this.ctx.storage.put("activeSession:"+playerId,{sessionId,expiresAt:Number(body.expiresAt||0)});
        return json({ok:true});
      }
      const playerId=safeText(url.searchParams.get("playerId"),"",128),sessionId=safeText(url.searchParams.get("sessionId"),"",128);
      const row=playerId?(await this.ctx.storage.get("activeSession:"+playerId))||null:null;
      return json({ok:true,active:!!(row&&row.sessionId===sessionId&&Number(row.expiresAt||0)>Date.now())});
    }
    if(url.pathname==="/qa-registry" && request.headers.get("x-pvp-internal")==="qa-admin"){
      let body; try{body=await request.json();}catch{return json({ok:false,error:"BAD_JSON"},400);}
      const action=safeText(body?.action,"",16), playerId=safeText(body?.playerId,"",128);
      const ids=new Set((await this.ctx.storage.get("qaPlayerIds"))||[]);
      if(action==="add")ids.add(playerId);
      else if(action==="remove")ids.delete(playerId);
      else if(action==="check")return json({ok:true,enabled:ids.has(playerId)});
      else if(action!=="list")return json({ok:false,error:"BAD_ACTION"},400);
      if(action==="add"||action==="remove")await this.ctx.storage.put("qaPlayerIds",[...ids]);
      return json({ok:true,playerIds:[...ids].sort()});
    }
    const state=await this.rollover();

    if(request.method==='GET'){
      const ranking=this.sort(state.players).slice(0,100).map(p=>({...p,rank:this.rankFor(p.cups)}));
      const playerId=safeText(url.searchParams.get('playerId'),'',128);
      const record=playerId&&state.players[playerId]?{...state.players[playerId],rank:this.rankFor(state.players[playerId].cups)}:null;
      const pendingMonthly=playerId?Object.values(state.monthlyAwards).filter(r=>r.playerId===playerId&&!r.claimed):[];
      const matchId=safeText(url.searchParams.get('matchId'),'',80);
      const settlement=playerId&&matchId?(await this.ctx.storage.get('settlement:'+playerId+'|'+matchId))||null:null;
      return json({ok:true,month:state.activeMonth,ranking,record,settlement,pendingMonthly});
    }

    if(request.method!=='POST') return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
    let body; try{body=await request.json();}catch{return json({ok:false,error:'BAD_JSON'},400);}
    const internal=request.headers.get('x-pvp-internal')==='room' && body?.official===true;
    if(!internal){
      const pid=safeText(body?.playerId,'',128), record=pid&&state.players[pid]?{...state.players[pid],rank:this.rankFor(state.players[pid].cups)}:null;
      return json({ok:true,authoritative:true,pending:true,record,month:state.activeMonth});
    }
    const playerId=safeText(body.playerId,'',128); if(!playerId)return json({ok:false,error:'PLAYER_ID_REQUIRED'},400);
    const name=safeText(body.name,'Jugador',40);
    const kills=Math.max(0,Math.min(9,Math.floor(Number(body.kills)||0)));
    const botKills=Math.max(0,Math.min(kills,Math.floor(Number(body.botKills)||0)));
    const humanKills=Math.max(0,Math.min(kills-botKills,Math.floor(Number(body.humanKills)||0)));
    const result=body.result==='win'?'win':body.result==='loss'?'loss':body.result==='forfeit'?'forfeit':body.result==='disconnect'?'disconnect':null;
    if(!result)return json({ok:false,error:'BAD_RESULT'},400);
    const mode=['1v1','2v2','arena','arena10'].includes(String(body.mode||''))?String(body.mode):'1v1';
    const maxPlace=mode==='arena10'?10:mode==='arena'?5:0;
    const placement=maxPlace?Math.max(1,Math.min(maxPlace,Math.floor(Number(body.placement)||maxPlace))):0;
    const matchId=safeText(body.matchId,'',80); if(!matchId)return json({ok:false,error:'MATCH_ID_REQUIRED'},400);

    const seen=(await this.ctx.storage.get('seen'))||{}, dedupe=playerId+'|'+matchId;
    const players=state.players;
    // "seen" se recorta para mantener pequeño el estado, pero las liquidaciones
    // individuales persisten. Consultarlas también evita volver a otorgar copas
    // si una partida antigua sale del mapa seen y se intenta liquidar otra vez.
    const previousSettlement=await this.ctx.storage.get('settlement:'+dedupe);
    if(seen[dedupe]||previousSettlement){
      const record=players[playerId]||null;
      return json({ok:true,duplicate:true,settlement:previousSettlement||null,record:record?{...record,rank:this.rankFor(record.cups)}:null,month:state.activeMonth});
    }

    const prev=players[playerId]||{playerId,name,cups:0,kills:0,wins:0,losses:0,matches:0};
    const oldCups=Math.max(0,Number(prev.cups||0));
    const rankLossMultiplier=(cups)=>{
      if(cups>=12000)return 2;    // Leyenda Galáctica
      if(cups>=7000)return 1.5;   // Maestro Cósmico
      if(cups>=3000)return 1.25;  // Diamante
      if(cups>=1000)return 1;     // Oro
      return 0;                   // Novato, Bronce y Plata: protegidos
    };
    const legacyLossPenalty=(cups)=>{
      if(cups>=12000)return 10;
      if(cups>=7000)return 8;
      if(cups>=3000)return 5;
      if(cups>=1000)return 3;
      return 0;
    };
    // Las eliminaciones sólo dan copas en Arena. 1v1 y 2v2 no tienen bono por muerte.
    const killCups=botKills+(humanKills*3);
    let delta;
    if(mode==='arena'||mode==='arena10'){
      const table=mode==='arena'
        ? {1:10,2:5,3:0,4:-5,5:-10}
        : {1:10,2:8,3:5,4:0,5:-2,6:-4,7:-6,8:-8,9:-9,10:-10};
      let placementDelta=Number(table[placement]||0);
      if(placementDelta<0) placementDelta=-Math.round(Math.abs(placementDelta)*rankLossMultiplier(oldCups));
      delta=placementDelta+killCups;
    }else{
      // Duelo: premio fijo por victoria, sin bono por eliminaciones.
      const winCups=mode==='2v2'?8:5;
      delta=result==='win'?winCups:-legacyLossPenalty(oldCups);
    }
    const newCups=Math.max(0,oldCups+delta), appliedDelta=newCups-oldCups;
    const record={...prev,name,cups:newCups,kills:Number(prev.kills||0)+kills,wins:Number(prev.wins||0)+(result==='win'?1:0),losses:Number(prev.losses||0)+(result!=='win'?1:0),matches:Number(prev.matches||0)+1};
    players[playerId]=record;
    seen[dedupe]=Date.now();
    const keys=Object.keys(seen); if(keys.length>1000) keys.sort((x,y)=>seen[x]-seen[y]).slice(0,keys.length-1000).forEach(k=>delete seen[k]);
    await this.ctx.storage.put({players,seen});
    const settlement={playerId,matchId,delta:appliedDelta,cups:newCups,mode,placement,botKills,humanKills,result,createdAt:Date.now()};
    await this.ctx.storage.put('settlement:'+dedupe,settlement);
    return json({ok:true,delta:appliedDelta,settlement,record:{...record,rank:this.rankFor(record.cups)},month:state.activeMonth});
  }
}

export class PvpMatchmaker {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.waitingByMode = new Map();
  }

  fallbackMsForRank(level){
    return [20000,25000,30000,40000,50000,60000,75000][Math.max(0,Math.min(6,Number(level)||0))];
  }

  allowedRankGap(waitMs, fallbackMs){
    const ratio=Math.max(0,Math.min(1,waitMs/Math.max(1,fallbackMs)));
    if(ratio<0.35)return 0;
    if(ratio<0.65)return 1;
    if(ratio<0.85)return 2;
    return 6;
  }

  async fetch(request) {
    const upgrade=request.headers.get("Upgrade");
    if(!upgrade||upgrade.toLowerCase()!=="websocket"){
      const total=Array.from(this.waitingByMode.values()).reduce((n,list)=>n+list.length,0);
      return json({ok:true,service:"gallina-cosmica-pvp-matchmaker",waiting:total});
    }

    const pair=new WebSocketPair(),client=pair[0],server=pair[1];
    server.accept();
    const url=new URL(request.url);
    const playerId=safeText(url.searchParams.get("playerId"),crypto.randomUUID(),128);
    const name=safeText(url.searchParams.get("name"),"Jugador",40);
    const ship=safeText(url.searchParams.get("ship"),"Gallina",40);
    const cups=Math.max(0,Math.min(9999999,Number(url.searchParams.get("cups")||0)));
    const rank=pvpRankFromCups(cups);
    const mode=gameMode(url),needed=roomCapacity(mode),joinedAt=Date.now();
    const entry={socket:server,playerId,name,ship,cups,rankLevel:rank.level,joinedAt};
    const queue=(this.waitingByMode.get(mode)||[]).filter(e=>e.playerId!==playerId);
    queue.push(entry);this.waitingByMode.set(mode,queue);

    const sendQueueCount=list=>{
      for(const e of list){
        try{e.socket.send(JSON.stringify({type:"queue-waiting",mode,waiting:list.length,needed}));}catch{}
      }
    };
    const removeEntries=group=>{
      const sockets=new Set(group.map(e=>e.socket));
      const left=(this.waitingByMode.get(mode)||[]).filter(e=>!sockets.has(e.socket));
      this.waitingByMode.set(mode,left);sendQueueCount(left);return left;
    };
    const launch=(group,withBots=false)=>{
      if(!group.length)return;
      removeEntries(group);
      const roomCode=queueRoomCode(),humanCount=group.length;
      const match={type:"match-found",roomCode,mode,players:needed};
      if(withBots){match.bot=true;match.humanCount=humanCount;}
      for(const e of group){
        try{e.socket.send(JSON.stringify(match));}catch{}
        try{e.socket.close(1000,withBots?"matched-bots":"matched");}catch{}
      }
    };
    const compatibleGroup=()=>{
      const list=this.waitingByMode.get(mode)||[];
      if(!list.includes(entry))return null;
      const now=Date.now(),myFallback=this.fallbackMsForRank(entry.rankLevel);
      const myGap=this.allowedRankGap(now-entry.joinedAt,myFallback);
      const compatible=list.filter(e=>{
        const theirFallback=this.fallbackMsForRank(e.rankLevel);
        const theirGap=this.allowedRankGap(now-e.joinedAt,theirFallback);
        return Math.abs(e.rankLevel-entry.rankLevel)<=Math.max(myGap,theirGap);
      });
      if(compatible.length<needed)return null;
      // 2v2 se ordena por copas para que la sala pueda repartir alternadamente
      // jugadores fuertes/débiles; FFA y 1v1 priorizan antigüedad.
      return compatible.sort((a,b)=>a.joinedAt-b.joinedAt).slice(0,needed);
    };

    const clear=()=>{
      const list=this.waitingByMode.get(mode)||[];
      const left=list.filter(e=>e.socket!==server);
      this.waitingByMode.set(mode,left);sendQueueCount(left);
    };
    server.addEventListener("close",clear);server.addEventListener("error",clear);
    sendQueueCount(queue);

    // Intento inmediato: sólo empareja rangos compatibles según cuánto haya
    // esperado cada jugador. La búsqueda se amplía gradualmente con el tiempo.
    const immediate=compatibleGroup();
    if(immediate)launch(immediate,false);

    const tick=setInterval(()=>{
      const list=this.waitingByMode.get(mode)||[];
      if(!list.includes(entry)){clearInterval(tick);return;}
      const group=compatibleGroup();
      if(group){clearInterval(tick);launch(group,false);return;}
      const waited=Date.now()-entry.joinedAt;
      const fallback=this.fallbackMsForRank(entry.rankLevel);
      if(waited>=fallback){
        clearInterval(tick);
        const live=this.waitingByMode.get(mode)||[];
        if(!live.includes(entry))return;
        // El más antiguo compatible con su propia ventana reúne a los humanos
        // disponibles y completa únicamente los puestos restantes con bots.
        const candidates=live.filter(e=>{
          const ef=this.fallbackMsForRank(e.rankLevel);
          const gap=Math.max(this.allowedRankGap(waited,fallback),this.allowedRankGap(Date.now()-e.joinedAt,ef));
          return Math.abs(e.rankLevel-entry.rankLevel)<=gap;
        }).sort((a,b)=>a.joinedAt-b.joinedAt);
        if(candidates[0]!==entry)return;
        launch(candidates.slice(0,needed),true);
      }
    },1000);

    return new Response(null,{status:101,webSocket:client});
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: JSON_HEADERS });
    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ ok: true, service: "gallina-cosmica-pvp", version: 4, matchmaking: true, playGamesAuth: true, modes: ["1v1", "2v2", "arena", "arena10"] });
    }
    if (url.pathname === "/auth/play-games") {
      if (request.method !== "POST") return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
      return authenticatePlayGames(request,env);
    }
    if (url.pathname === "/qa/access") {
      if (request.method !== "GET") return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
      return qaAccess(request,env);
    }
    if (url.pathname === "/qa/admin") {
      if (!["GET","POST"].includes(request.method)) return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
      return qaAdmin(request,env);
    }
    if (url.pathname === "/ranking") {
      // El ranking público es SOLO lectura. Las liquidaciones oficiales llegan
      // directamente desde PvpRoom al Durable Object PvpRanking y no pasan por aquí.
      if (request.method !== "GET") return json({ ok:false, error:"RANKING_READ_ONLY" }, 405);
      const id = env.PVP_RANKING.idFromName("global");
      return env.PVP_RANKING.get(id).fetch(request);
    }
    if (url.pathname === "/matchmake") {
      const authorized=await authorizePvpRequest(request,env);
      if(!authorized)return json({ok:false,error:"PLAY_GAMES_AUTH_REQUIRED"},401);
      const verifiedUrl=new URL(authorized.url);
      const mode = gameMode(verifiedUrl);
      const id = env.PVP_MATCHMAKER.idFromName("global-" + mode);
      return env.PVP_MATCHMAKER.get(id).fetch(authorized);
    }
    const match = url.pathname.match(/^\/room\/(\d{6})$/);
    if (!match) return json({ ok: false, error: "NOT_FOUND" }, 404);
    const authorized=await authorizePvpRequest(request,env);
    if(!authorized)return json({ok:false,error:"PLAY_GAMES_AUTH_REQUIRED"},401);
    const id = env.PVP_ROOMS.idFromName(match[1]);
    return env.PVP_ROOMS.get(id).fetch(authorized);
  },
};

/* PvP experimental 0.3: lobby + arena 1v1 sincronizada por WebSocket. */
(() => {
  const PVP_TEST_MODE = true;
  const PVP_WS_BASE = 'wss://gallina-cosmica-pvp-test.jairog940.workers.dev';
  const PVP_HTTP_BASE = 'https://gallina-cosmica-pvp-test.jairog940.workers.dev';
  if (!PVP_TEST_MODE) return;

  const $ = id => document.getElementById(id);
  const lobby = $('pvpLobbyScreen');
  const arena = $('pvpArenaScreen');
  const arenaCanvas = $('pvpCanvas');
  const arenaCtx = arenaCanvas?.getContext('2d');
  const status = $('pvpLobbyStatus');
  const queueProgressWrap = $('pvpQueueProgressWrap');
  const queueProgress = $('pvpQueueProgress');
  const roomInput = $('pvpRoomCode');

  let socket = null, queueSocket = null, currentRoom = '', mySlot = 0, myTeam = 0, players = [];
  let reconnectTimer=0,reconnectAttempts=0,reconnecting=false,intentionalDisconnect=false;
  const MAX_RECONNECT_ATTEMPTS=3, RECONNECT_DELAY=900;
  let pvpMode = '2v2';
  let queueStartedAt = 0, queueTimer = 0;
  const PVP_MISSILE_COOLDOWN = 8000;
  const pvpBackground = new Image();
  pvpBackground.src = 'assets/fondo_pvp.png';
  const pvpMusic = new Audio('assets/musica_4.mp3');
  pvpMusic.loop = true;
  pvpMusic.volume = 0.4;
  let resumeBgMusicAfterPvp = false, pvpMusicUnlocked = false;
  function unlockPvpMusic(){
    if(pvpMusicUnlocked)return;
    pvpMusicUnlocked=true;
    // Android/WebView exige que el primer play ocurra dentro de un gesto del usuario.
    const oldVolume=pvpMusic.volume;
    pvpMusic.volume=0;
    pvpMusic.play().then(()=>{
      pvpMusic.pause(); pvpMusic.currentTime=0; pvpMusic.volume=oldVolume;
    }).catch(()=>{pvpMusic.volume=oldVolume;});
  }
  function startPvpMusic(){
    try{
      resumeBgMusicAfterPvp = typeof bgMusic !== 'undefined' && !bgMusic.paused;
      if(typeof bgMusic !== 'undefined') bgMusic.pause();
      pvpMusic.currentTime = 0;
      pvpMusic.play().catch(()=>{
        // Si el navegador todavía bloquea autoplay, el siguiente toque del jugador lo reintenta.
        pvpMusicUnlocked=false;
      });
    }catch{}
  }
  function stopPvpMusic(){
    try{
      pvpMusic.pause(); pvpMusic.currentTime = 0;
      if(resumeBgMusicAfterPvp && typeof bgMusic !== 'undefined') bgMusic.play().catch(()=>{});
    }catch{}
    resumeBgMusicAfterPvp = false;
  }
  let running = false, countdownActive = false, countdownTimer = 0, raf = 0, lastFrame = 0, lastStateSend = 0, lastSentState = null, lastShot = 0, lastHitAt = 0, lastMissile = -Infinity, missilePointerLock = false;
  let botMatch=false, botLives=20, lastBotHitAt=0, lastRegenAt=0;
  const botAiStates=new Map();
  const botHitTimes=new Map();
  const botRegenTimes=new Map();
  function botAiFor(slot){
    slot=Number(slot||0);
    if(!botAiStates.has(slot))botAiStates.set(slot,{lastShot:0,lastMove:0,moveX:0,moveY:0,nextMoveAt:0,nextMissileAt:0});
    return botAiStates.get(slot);
  }
  let lastAttackerSlot = 0, lastAttackKind = 'laser';
  const keys = new Set();
  const meState = { x: 210, y: 560, lives: 20, angle: -Math.PI / 2, visualAngle: -Math.PI / 2 };
  const peerState = { x: 210, y: 80, lives: 20, angle: Math.PI / 2, visualAngle: Math.PI / 2 };
  const peerStates = new Map();
  let eliminated = new Set(), pendingBotDefeats = new Set(), meEliminated = false, matchFinished = false;
  // Zona Cósmica: exclusiva de Arena 10. Da 90 s de mapa completo y luego
  // reduce gradualmente el área jugable; el cierre acelera con pocos supervivientes.
  let cosmicZoneElapsed=0, cosmicZoneProgress=0, lastZoneDamageAt=0;
  const COSMIC_ZONE_GRACE=90, COSMIC_ZONE_SHRINK_SECONDS=180, COSMIC_ZONE_MIN_RADIUS=420;
  function cosmicZoneState(dt=0){
    if(pvpMode!=='arena10') return null;
    cosmicZoneElapsed+=Math.max(0,dt);
    const aliveCount=players.filter(p=>!eliminated.has(Number(p.slot))).length;
    if(cosmicZoneElapsed>COSMIC_ZONE_GRACE && cosmicZoneProgress<1){
      const speed=aliveCount<=2?2.3:aliveCount<=3?1.8:aliveCount<=5?1.4:1;
      cosmicZoneProgress=Math.min(1,cosmicZoneProgress+(Math.max(0,dt)/COSMIC_ZONE_SHRINK_SECONDS)*speed);
    }
    const cx=worldWidth/2,cy=worldHeight/2;
    const startRadius=Math.hypot(worldWidth,worldHeight)/2+40;
    const radius=startRadius+(COSMIC_ZONE_MIN_RADIUS-startRadius)*cosmicZoneProgress;
    return {cx,cy,radius,aliveCount,active:cosmicZoneElapsed>COSMIC_ZONE_GRACE};
  }
  function peerFor(slot){
    slot=Number(slot||0);
    if(!peerStates.has(slot)) peerStates.set(slot,{x:210,y:80,targetX:210,targetY:80,lives:20,angle:Math.PI/2,targetAngle:Math.PI/2,visualAngle:Math.PI/2,targetVisualAngle:Math.PI/2,slot});
    return peerStates.get(slot);
  }
  function syncPeerPlayers(){
    for(const p of players) if(Number(p.slot)!==mySlot) peerFor(p.slot);
    for(const slot of [...peerStates.keys()]) if(!players.some(p=>Number(p.slot)===slot)) peerStates.delete(slot);
  }
  let bullets = [];
  let missiles = [];
  let impactFx = [];
  let asteroidFx = [];
  let hitFlashUntil = 0;
  let hitShakeUntil = 0;
  const moveStick = { active:false, id:null, x:0, y:0 };
  // Mundo PvP lógico: 2× ancho × 2× alto = 4× superficie. La cámara se añade en la fase siguiente.
  let worldWidth=arenaCanvas.width*2, worldHeight=arenaCanvas.height*2;
  function configureWorld(){const scale=pvpMode==='arena10'?5:2;worldWidth=arenaCanvas.width*scale;worldHeight=arenaCanvas.height*scale;}
  // Alcance universal medido en coordenadas del mundo, idéntico en todos los dispositivos.
  const PVP_ATTACK_RANGE=250;
  const PVP_LOCK_RANGE=350;
  const inAttackRange=(a,b)=>!!a&&!!b&&Math.hypot(b.x-a.x,b.y-a.y)<=PVP_ATTACK_RANGE;
  const inLockRange=(a,b)=>!!a&&!!b&&Math.hypot(b.x-a.x,b.y-a.y)<=PVP_LOCK_RANGE;
  // Obstáculos deterministas: todos los clientes ven exactamente los mismos asteroides.
  // Arena 10 usa una distribución más densa para que el mundo 5×5 tenga cobertura útil.
  const baseAsteroidLayout=[
    {x:.24,y:.25,r:34},{x:.50,y:.18,r:28},{x:.76,y:.29,r:38},
    {x:.34,y:.50,r:31},{x:.66,y:.52,r:35},
    {x:.22,y:.74,r:37},{x:.50,y:.81,r:29},{x:.78,y:.72,r:33}
  ];
  const arena10ExtraAsteroidLayout=[
    {x:.10,y:.12,r:31},{x:.30,y:.11,r:27},{x:.69,y:.10,r:32},
    {x:.11,y:.34,r:36},{x:.43,y:.32,r:30},{x:.89,y:.38,r:27},
    {x:.12,y:.57,r:29},{x:.49,y:.59,r:28},
    {x:.36,y:.88,r:28},{x:.91,y:.82,r:30}
  ];
  let asteroids=[];
  function configureAsteroids(){
    const layout=pvpMode==='arena10'?baseAsteroidLayout.concat(arena10ExtraAsteroidLayout):baseAsteroidLayout;
    asteroids=layout.map(a=>({x:a.x*worldWidth,y:a.y*worldHeight,r:a.r}));
  }
  configureAsteroids();
  function segmentCircleHit(ax,ay,bx,by,cx,cy,r){
    const dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy;
    const t=den?Math.max(0,Math.min(1,((cx-ax)*dx+(cy-ay)*dy)/den)):0;
    return Math.hypot(ax+dx*t-cx,ay+dy*t-cy)<=r;
  }
  function positionBlockedByAsteroid(x,y,r=24){return asteroids.some(a=>Math.hypot(x-a.x,y-a.y)<a.r+r);}
  function addAsteroidImpact(x,y){
    const pieces=Array.from({length:7},(_,i)=>{const a=i*Math.PI*2/7+Math.random()*.45,s=35+Math.random()*75;return{x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.42,maxLife:.42,size:1.5+Math.random()*2.5};});
    asteroidFx.push(...pieces);
  }
  let selectedTargetSlot=0;
  const PVP_EVADE_DURATION=2000, PVP_EVADE_COOLDOWN=12000;
  let evadeUntil=0,lastEvade=-Infinity;
  const remoteEvadeUntil=new Map();

  function identity(){ return window.GallinaPlayerIdentity?.getCurrent?.() || {id:null,name:'Jugador'}; }
  const PVP_CUPS_KEY='gallina_pvp_cups_v1';
  const qaBotRankSelect=$('pvpQaBotRank');
  const QA_BOT_RANK_CUPS=[0,200,500,1000,3000,7000,12000];
  function qaBotCups(){
    if(!PVP_TEST_MODE||!qaBotRankSelect||qaBotRankSelect.value==='auto')return getPvpCups();
    const level=Math.max(0,Math.min(6,Number(qaBotRankSelect.value)||0));
    return QA_BOT_RANK_CUPS[level];
  }
  if(qaBotRankSelect){
    qaBotRankSelect.value=sessionStorage.getItem('pvp_qa_bot_rank')||'auto';
    qaBotRankSelect.addEventListener('change',()=>{
      sessionStorage.setItem('pvp_qa_bot_rank',qaBotRankSelect.value);
      const label=qaBotRankSelect.options[qaBotRankSelect.selectedIndex]?.text||'Automático';
      showStatus('🧪 Bots QA: '+label+'. Tus copas reales no cambian.',true);
    });
  }

  function getPvpCups(){const n=Number(localStorage.getItem(PVP_CUPS_KEY)||0);return Number.isFinite(n)?Math.max(0,Math.floor(n)):0;}
  function pvpRankFromCups(cups){
    const n=Math.max(0,Number(cups)||0);
    const thresholds=[0,200,500,1000,3000,7000,12000];
    let level=0;
    for(let i=1;i<thresholds.length;i++){if(n>=thresholds[i])level=i;else break;}
    return {level};
  }
  function currentGameStats(){
    // gameStats se declara con let en estado.js y no es propiedad de window.
    // Acceder directamente permite que PvP use la nave realmente equipada.
    try { return gameStats || {}; } catch { return {}; }
  }
  function shipLabel(){
    const names=['Gallina','Oveja','Caballo','Vaca'];
    const stats=currentGameStats();
    const i=Number(stats.selectedShip ?? 0);
    const pvpNames={toro_aniquilador:'Toro Aniquilador',toro_blindado:'Toro Blindado',toro_baliza:'Toro Baliza'};
    if(stats.selectedPvpShip&&stats.pvpShips?.[stats.selectedPvpShip]) return pvpNames[stats.selectedPvpShip]||'Gallina';
    if(stats.useGallinaChile) return 'Gallina Chile';
    return (names[i]||'Gallina')+(stats.useProShip?' Pro':'');
  }
  function shipSrc(label){
    const toroSrc={'Toro Aniquilador':'assets/toro_aniquilador.png','Toro Blindado':'assets/toro_blindado.png','Toro Baliza':'assets/toro_baliza.png'};
    if(toroSrc[label]) return toroSrc[label];
    if(label==='Gallina Chile') return 'assets/gallina_chile.png';
    const pro=/ Pro$/.test(label);
    const base=label.replace(/ Pro$/,'').toLowerCase();
    return 'assets/'+base+(pro?'_pro':'')+'_1.png';
  }
  function pvpShipStats(label){
    if(label==='Toro Aniquilador') return {maxLives:20,shotCooldown:247.5,regenDelay:5000,regenEvery:2000};
    if(label==='Toro Blindado') return {maxLives:26,shotCooldown:330,regenDelay:5000,regenEvery:2000};
    if(label==='Toro Baliza') return {maxLives:20,shotCooldown:330,regenDelay:4000,regenEvery:1500};
    return {maxLives:20,shotCooldown:330,regenDelay:5000,regenEvery:2000};
  }
  function shipCombatInfo(label){
    const base=String(label||'Gallina').replace(/ Pro$/,'');
    const index={Gallina:0,'Gallina Chile':0,Oveja:1,Caballo:2,Vaca:3,'Toro Aniquilador':0,'Toro Blindado':0,'Toro Baliza':0}[base] ?? 0;
    const missileType=['chick','wool','horseshoe','milk'][index];
    return {index, missileType, isPro:/ Pro$/.test(String(label||''))};
  }
  function missileImage(type,isPro){
    const names={
      chick:['balaPollito','balaPollitoPro'],
      wool:['balaLana','balaLanaPro'],
      horseshoe:['balaHerradura','balaHerraduraPro'],
      milk:['balaLeche','balaLechePro']
    };
    const pair=names[type]||names.chick;
    const normal=typeof assets!=='undefined'?assets[pair[0]]:null;
    const pro=typeof assets!=='undefined'?assets[pair[1]]:null;
    return isPro&&pro?.complete&&pro.naturalWidth?pro:normal;
  }
  function laserColors(label){
    const info=shipCombatInfo(label);
    let outer='#38bdf8', inner='#ffffff';
    if(info.isPro){
      if(info.index===0) outer='#a855f7';
      else if(info.index===1) outer='#fbbf24';
      else { inner='#fbbf24'; outer='#a855f7'; }
    }else{
      outer=['#ef4444','#a855f7','#fbbf24','#3b82f6'][info.index]||'#38bdf8';
    }
    return {outer,inner};
  }
  function showStatus(text,ok=false,force=false){
    // Mientras el matchmaking está activo, su contador es el estado principal
    // del lobby. Evita que clicks de modo u otros mensajes secundarios lo pisen.
    if(queueStartedAt && !force && !String(text).startsWith('🔎 Buscando ')) return;
    if(status){status.textContent=text;status.style.color=ok?'#86efac':'#cbd5e1';}
  }
  function queueButtonLabel(){
    return pvpMode==='2v2'?'🤝 Buscar equipo 2v2':pvpMode==='arena10'?'🌠 Buscar Arena 10':pvpMode==='arena'?'🌌 Buscar Arena 5':'⚔️ Buscar rival';
  }
  function stopQueueTimer(resetStartedAt=true){
    if(queueTimer){clearInterval(queueTimer);queueTimer=0;}
    if(resetStartedAt){
      queueStartedAt=0;
      if(queueProgressWrap)queueProgressWrap.style.display='none';
      if(queueProgress)queueProgress.style.width='0%';
    }
    const btn=$('pvpFindMatchBtn'); if(btn)btn.textContent=queueButtonLabel();
  }
  let queueWaitingCount=1;
  function updateQueueStatus(){
    if(!queueStartedAt)return;
    const sec=Math.max(0,Math.floor((Date.now()-queueStartedAt)/1000));
    const mm=String(Math.floor(sec/60)).padStart(2,'0'), ss=String(sec%60).padStart(2,'0');
    const needed=pvpMode==='1v1'?2:pvpMode==='arena10'?10:pvpMode==='arena'?5:4;
    const searchLabel=pvpMode==='2v2'?'jugadores para 2v2':pvpMode==='arena10'?'jugadores para Arena 10':pvpMode==='arena'?'jugadores para Arena 5':'rival';
    const maxWait=([20,25,30,40,50,60,75][pvpRankFromCups(getPvpCups()).level]||20);
    const text='🔎 Buscando '+searchLabel+'… '+mm+':'+ss+' · 👥 '+Math.min(queueWaitingCount,needed)+'/'+needed+' conectados · ⏱️ Máx. '+maxWait+' s';
    const btn=$('pvpFindMatchBtn');
    if(btn){
      btn.innerHTML='🔎 '+(pvpMode==='2v2'?'2v2':pvpMode==='arena10'?'Arena 10':pvpMode==='arena'?'Arena 5':'1v1')+' · '+mm+':'+ss+'<br><span style="font-size:.72rem;opacity:.92">👥 '+Math.min(queueWaitingCount,needed)+'/'+needed+' · Máx. '+maxWait+' s · ✖️ Toca para cancelar</span>';
    }
    if(queueProgressWrap)queueProgressWrap.style.display='block';
    if(queueProgress)queueProgress.style.width=Math.min(100,(sec/maxWait)*100)+'%';
    showStatus(text,true);
  }
  function cancelMatch(){
    if(!queueSocket)return;
    const q=queueSocket;queueSocket=null;try{q.close(1000,'cancelled');}catch{}
    stopQueueTimer();showStatus('Búsqueda cancelada.');
  }
  function randomCode(){ return String(Math.floor(100000+Math.random()*900000)); }
  function playerId(){
    const me=identity(); if(me.id) return String(me.id);
    let id=sessionStorage.getItem('gallina_pvp_guest_id');
    if(!id){id='guest-'+crypto.randomUUID();sessionStorage.setItem('gallina_pvp_guest_id',id);}
    return id;
  }
  function send(payload){ if(socket?.readyState!==WebSocket.OPEN)return false; socket.send(JSON.stringify(payload)); return true; }
  function disconnect(silent=false){
    intentionalDisconnect=true;reconnecting=false;reconnectAttempts=0;if(reconnectTimer){clearTimeout(reconnectTimer);reconnectTimer=0;}
    stopArena();
    if(queueSocket){const q=queueSocket;queueSocket=null;try{q.close(1000,'leaving');}catch{}}
    stopQueueTimer();
    if(socket){const old=socket;socket=null;try{old.close(1000,'leaving');}catch{}}
    currentRoom='';mySlot=0;myTeam=0;players=[];
    if(!silent)showStatus('Desconectado de la sala.');
  }

  async function findMatch(){
    if(queueSocket){cancelMatch();return;}
    disconnect(true);
    let verified;
    try{
      showStatus('🔐 Verificando Play Games…');
      if(typeof window.getPlayGamesPvpSession!=='function')throw new Error('Play Games no está listo');
      verified=await window.getPlayGamesPvpSession();
    }catch(error){
      showStatus('🔐 No se pudo verificar Play Games: '+(error?.message||'intenta nuevamente'),false,true);
      return;
    }
    const me=identity();
    const params=new URLSearchParams({playerId:verified.playerId,name:me.name||'Jugador',ship:shipLabel(),mode:pvpMode,cups:String(qaBotCups()),session:verified.token});
    const ws=new WebSocket(`${PVP_WS_BASE}/matchmake?${params}`);
    queueSocket=ws;
    queueStartedAt=Date.now();
    queueWaitingCount=1;
    const findBtn=$('pvpFindMatchBtn'); if(findBtn)findBtn.textContent='✖️ Cancelar búsqueda';
    updateQueueStatus(); queueTimer=setInterval(updateQueueStatus,1000);
    ws.addEventListener('message',event=>{
      if(queueSocket!==ws)return;
      let m;try{m=JSON.parse(event.data);}catch{return;}
      if(m.type==='queue-waiting'){
        queueWaitingCount=Math.max(1,Number(m.waiting||1));
        // Algunos despliegues del Worker cierran/reemplazan el socket de cola
        // justo después de confirmar la espera. El estado visible debe seguir
        // contando hasta recibir match-found o una cancelación real del usuario.
        updateQueueStatus();
      } else if(m.type==='match-found' && /^\d{6}$/.test(String(m.roomCode||''))){
        const code=String(m.roomCode);
        queueSocket=null;
        stopQueueTimer();
        try{ws.close(1000,'matched');}catch{}
        botMatch=!!m.bot;
        showStatus(botMatch?'🤖 ¡Bot Cósmico encontrado! Entrando…':'⚔️ ¡Partida encontrada! Entrando…',true);
        setTimeout(()=>connect(code,false,botMatch,Number(m.humanCount||1)),120);
      }
    });
    ws.addEventListener('close',e=>{
      if(queueSocket===ws){
        // Un cierre normal sólo debe borrar el estado cuando la búsqueda terminó
        // de verdad. Si fue cancelada, cancelMatch() ya limpió queueStartedAt.
        queueSocket=null;
        if(e.code!==1000){
          stopQueueTimer();
          showStatus('La búsqueda se interrumpió. Intenta nuevamente.');
        }else if(queueStartedAt){
          // Conserva el último estado de búsqueda en pantalla en vez de
          // sustituirlo silenciosamente por un texto vacío/antiguo.
          updateQueueStatus();
        }
      }
    });
    ws.addEventListener('error',()=>{if(queueSocket===ws){stopQueueTimer();showStatus('No se pudo conectar a la cola PvP.',false,true);}});
  }

  async function connect(code,creating=false,useBot=false,humanCount=1,isReconnect=false){
    code=String(code||'').replace(/\D/g,'').slice(0,6); roomInput.value=code;
    if(code.length!==6)return showStatus('Escribe un código de sala de 6 dígitos.');
    if(!isReconnect)disconnect(true);
    intentionalDisconnect=false;
    let verified;
    try{
      if(!isReconnect)showStatus('🔐 Verificando Play Games…');
      if(typeof window.getPlayGamesPvpSession!=='function')throw new Error('Play Games no está listo');
      verified=await window.getPlayGamesPvpSession();
    }catch(error){
      showStatus('🔐 No se pudo verificar Play Games: '+(error?.message||'intenta nuevamente'),false,true);
      return;
    }
    const me=identity();
    const params=new URLSearchParams({playerId:verified.playerId,name:me.name||'Jugador',ship:shipLabel(),mode:pvpMode,cups:String(qaBotCups()),session:verified.token});
    if(useBot&&(pvpMode==='1v1'||pvpMode==='2v2'||(pvpMode==='arena'||pvpMode==='arena10')||pvpMode==='arena10')){params.set('bot','1');params.set('humanCount',String(Math.max(1,Number(humanCount||1))));}
    const ws=new WebSocket(`${PVP_WS_BASE}/room/${code}?${params}`);
    socket=ws;currentRoom=code;
    showStatus((creating?'Creando':'Entrando a')+' sala '+code+'…');
    ws.addEventListener('open',()=>{if(socket===ws)showStatus('Conectado a sala '+code+'. Esperando rival…',true);});
    ws.addEventListener('message',event=>{
      if(socket!==ws)return;
      let m;try{m=JSON.parse(event.data);}catch{return;}
      if(m.type==='joined'){
        const wasReconnect=reconnecting||!!m.reconnected;
        reconnecting=false;reconnectAttempts=0;if(reconnectTimer){clearTimeout(reconnectTimer);reconnectTimer=0;}
        players=m.players||[]; const mine=players.find(p=>String(p.playerId)===playerId());
        mySlot=Number(mine?.slot||0); myTeam=Number(mine?.team||m.team||0); syncPeerPlayers();
        const needed=pvpMode==='1v1'?2:pvpMode==='arena10'?10:pvpMode==='arena'?5:4;
        if(wasReconnect&&running)showStatus('✅ Conexión recuperada.',true);
        else showStatus('Sala '+code+' · Jugador '+(mySlot||'?')+(pvpMode==='2v2'?' · Equipo '+(myTeam||'?'):'')+(players.length<needed?' · esperando '+(needed-players.length)+' jugador(es)…':''),true);
      } else if(m.type==='player-joined') {
        if(m.player && !players.some(p=>Number(p.slot)===Number(m.player.slot))) players.push(m.player);
        syncPeerPlayers();
        showStatus('Jugador conectado. Esperando que se complete la partida…',true);
      } else if(m.type==='ready') {
        players=m.players||players; syncPeerPlayers();
        const mates=players.filter(p=>Number(p.slot)!==mySlot && Number(p.team)===myTeam);
        showStatus(pvpMode==='2v2'?'🤝 ¡2v2 listo! Compañero: '+(mates[0]?.name||'Jugador'):'⚔️ ¡Sala lista!',true);
        setTimeout(()=>startArena(),450);
      } else if(m.type==='player-reconnecting') {
        const p=players.find(x=>Number(x.slot)===Number(m.slot));
        showStatus('📡 '+(p?.name||'Un jugador')+' perdió conexión · esperando 5 s…');
      } else if(m.type==='player-reconnected') {
        if(m.player && !players.some(p=>Number(p.slot)===Number(m.player.slot))) players.push(m.player);
        syncPeerPlayers();
        showStatus('✅ '+(m.player?.name||'Jugador')+' volvió a la partida.',true);
      } else if(m.type==='player-left') {
        const leftSlot=Number(m.slot);
        if((running||countdownActive)&&(pvpMode==='2v2'||(pvpMode==='arena'||pvpMode==='arena10')||pvpMode==='arena10')){
          const alreadyOut=eliminated.has(leftSlot);
          markEliminated(leftSlot);
          const leftPlayer=players.find(p=>Number(p.slot)===leftSlot);
          if(!alreadyOut){killFeed.pop();addKillFeed('🚪 '+(leftPlayer?.name||('Jugador '+leftSlot))+' abandonó la partida.');}
          showStatus('⚠️ '+(leftPlayer?.name||'Un jugador')+' abandonó y cuenta como eliminado.');
        } else {
          players=players.filter(p=>Number(p.slot)!==leftSlot); peerStates.delete(leftSlot);
          if(running||countdownActive) endArena('Un jugador salió de la partida.');
          else showStatus('Un jugador salió. Esperando otro jugador…');
        }
      } else if(m.type==='player-eliminated') {
        const deadSlot=Number(m.slot||0),killerSlot=Number(m.killerSlot||0);
        const alreadyOut=eliminated.has(deadSlot);
        pendingBotDefeats.delete(deadSlot);
        markEliminated(deadSlot);
        if(!alreadyOut && m.reason==='combat' && killerSlot && killerSlot!==deadSlot){
          if(killerSlot===mySlot){matchKills++;const victim=players.find(p=>Number(p.slot)===deadSlot);if(victim?.bot)matchBotKills++;else matchHumanKills++;}
          killFeed.pop();
          addKillFeed((m.attackKind==='missile'?'🚀 ':'🔫 ')+playerName(killerSlot)+' eliminó a '+playerName(deadSlot)+(m.attackKind==='missile'?' con misil.':'.'));
        }
        if((pvpMode==='arena'||pvpMode==='arena10') && Number(m.slot)!==mySlot && !meEliminated){
          const alive=players.filter(p=>!eliminated.has(Number(p.slot)));
          // Respaldo del cliente: si ya soy el único superviviente no quedarse
          // esperando el arena-result del Worker. El POST de ranking se deduplica
          // por partida, así que el resultado oficial posterior no duplica copas.
          if(alive.length===1&&Number(alive[0]?.slot)===mySlot){
            // El Worker es quien debe cerrar oficialmente la Arena. Antes el cliente
            // mostraba la victoria inmediatamente y descartaba el arena-result oficial,
            // ocultando el diagnóstico y pudiendo liquidar copas antes del servidor.
            showStatus('🔐 Confirmando resultado con el servidor…',true);
            return;
          }
          showStatus('🌌 Arena · quedan '+alive.length+' jugadores.',true);
        }
      } else if(m.type==='team-result') {
        if(pvpMode==='2v2'){
          const winnerTeam=Number(m.winnerTeam);
          const winners=players.filter(p=>Number(p.team)===winnerTeam).map(p=>p.name||('Jugador '+p.slot)).join(' + ');
          if(winnerTeam===myTeam) endArena('🏆 ¡VICTORIA!\n🤝 Equipo '+winnerTeam+' ganador'+(winners?'\n'+winners:''),'win');
          else endArena('💥 DERROTA\n🏆 Equipo '+winnerTeam+' ganador'+(winners?'\n'+winners:''),'loss');
        }
      } else if(m.type==='arena-simulated') {
        if(pvpMode==='arena'||pvpMode==='arena10') showStatus('🤖 Simulando combate restante…',true);
      } else if(m.type==='arena-result') {
        if((pvpMode==='arena'||pvpMode==='arena10')){
          const podium=Array.isArray(m.podiumSlots)?m.podiumSlots.map(Number).filter(Boolean):[Number(m.winnerSlot||0)].filter(Boolean);
          const medals=['🥇','🥈','🥉','4️⃣','5️⃣'];
          const podiumText=podium.map((slot,i)=>medals[i]+' '+playerName(slot)).join('\n');
          const finalOrder=Array.isArray(m.finalOrder)?m.finalOrder.map(Number).filter(Boolean):podium;
          const myPlace=finalOrder.indexOf(mySlot)+1;
          const title=Number(m.winnerSlot)===mySlot?'🏆 ¡VICTORIA EN ARENA!':(myPlace>0?'🌌 ARENA FINALIZADA · Puesto #'+myPlace:'🌌 ARENA FINALIZADA');
          const official=m.official&&Array.isArray(m.official.players)?m.official:null;
          const officialMe=official?.players.find(p=>Number(p.slot)===mySlot);
          const officialOrder=Array.isArray(official?.finalOrder)?official.finalOrder.map(Number):[];
          const officialPlace=officialOrder.indexOf(mySlot)+1;
          const serverQa=officialMe?'\n\n🔐 Resultado oficial: puesto '+(officialPlace||'—')+' · bots '+Number(officialMe.kills?.botKills||0)+' · humanos '+Number(officialMe.kills?.humanKills||0):'\n\n⚠️ Resultado oficial: sin registro del servidor';
          endArena(title+(podiumText?'\n\n'+podiumText:'')+serverQa,Number(m.winnerSlot)===mySlot?'win':'loss',myPlace);
        }
      } else if(m.type==='peer-message') {
        handlePeer(m.payload||{},Number(m.from||0),Number(m.team||0));
      }
    });
    ws.addEventListener('close',e=>{
      if(socket!==ws)return;
      socket=null;
      if(e.code===1000||intentionalDisconnect)return;
      const detail=' [código '+e.code+(e.reason?' · '+e.reason:'')+']';
      console.error('[PvP] WebSocket de sala cerrado',e.code,e.reason||'(sin motivo)');
      if((running||countdownActive)&&currentRoom&&reconnectAttempts<MAX_RECONNECT_ATTEMPTS){
        reconnecting=true;reconnectAttempts++;
        showStatus('🔄 Reconectando… '+reconnectAttempts+'/'+MAX_RECONNECT_ATTEMPTS);
        reconnectTimer=setTimeout(()=>{
          reconnectTimer=0;
          if(!reconnecting||socket||!currentRoom)return;
          connect(currentRoom,false,botMatch,1,true);
        },RECONNECT_DELAY);
      }else if(running||countdownActive){
        reconnecting=false;endArena('Se perdió la conexión.'+detail);
      }else showStatus('Se perdió la conexión con la sala.'+detail);
    });
    ws.addEventListener('error',()=>{if(socket===ws)showStatus('No se pudo conectar al servidor PvP.');});
  }

  function resetArena(){
    configureWorld();
    configureAsteroids();
    killFeed.length=0;matchKills=0;matchBotKills=0;matchHumanKills=0;matchCupsSettled=false;pendingBotDefeats.clear();lastAttackerSlot=0;lastAttackKind='laser';
    botLives=20;lastBotHitAt=0;lastRegenAt=performance.now();botAiStates.clear();botHitTimes.clear();botRegenTimes.clear();
    for(const p of players.filter(p=>p.bot)){
      const ai=botAiFor(p.slot), t=performance.now();
      ai.nextMoveAt=t+300+Math.random()*900;
      ai.nextMissileAt=t+8000+Math.random()*4000;
      const a=Math.random()*Math.PI*2;ai.moveX=Math.cos(a);ai.moveY=Math.sin(a);
    }
    const h=worldHeight,w=worldWidth;
    peerState.x=w/2;peerState.y=90;peerState.lives=20;peerState.angle=Math.PI/2;peerState.visualAngle=Math.PI/2;
    peerStates.clear(); syncPeerPlayers();
    const starts=[[w*.28,h-90],[w*.72,h-90],[w*.28,90],[w*.72,90]];
    // Arena 5 conserva el mundo 2×2 actual y reparte los cinco spawns
    // alrededor del mapa para evitar que el quinto jugador nazca sobre otro.
    const arenaStarts=[[w*.50,h-90],[w*.88,h*.38],[w*.73,90],[w*.27,90],[w*.12,h*.38]];
    const arena10Starts=Array.from({length:10},(_,i)=>{
      const a=-Math.PI/2+(i/10)*Math.PI*2;
      return [w/2+Math.cos(a)*w*.40,h/2+Math.sin(a)*h*.40];
    });
    if(pvpMode==='1v1'){
      meState.x=w/2;meState.y=h-90;meState.angle=-Math.PI/2;meState.visualAngle=-Math.PI/2;
    }else{
      const pos=pvpMode==='arena10'?arena10Starts[(mySlot-1+10)%10]:(pvpMode==='arena'||pvpMode==='arena10')?arenaStarts[(mySlot-1+5)%5]:starts[(mySlot-1+4)%4];meState.x=pos[0];meState.y=pos[1];
      meState.angle=myTeam===2?Math.PI/2:-Math.PI/2;meState.visualAngle=meState.angle;
    }
    meState.lives=pvpShipStats(shipLabel()).maxLives;
    for(const [slot,state] of peerStates){
      const pos=pvpMode==='arena10'?arena10Starts[(slot-1)%10]:(pvpMode==='arena'||pvpMode==='arena10')?arenaStarts[(slot-1)%5]:starts[(slot-1)%4];state.x=state.targetX=pos[0];state.y=state.targetY=pos[1];state.lives=20;
      const team=Number(players.find(p=>Number(p.slot)===slot)?.team||0);state.angle=state.targetAngle=team===2?Math.PI/2:-Math.PI/2;state.visualAngle=state.targetVisualAngle=state.angle;
    }
    if(pvpMode==='1v1'){
      for(const [slot,state] of peerStates){state.x=state.targetX=w/2;state.y=state.targetY=90;state.angle=state.targetAngle=Math.PI/2;state.visualAngle=state.targetVisualAngle=Math.PI/2;}
    }
    bullets=[]; missiles=[]; selectedTargetSlot=0; evadeUntil=0; lastEvade=-Infinity; remoteEvadeUntil.clear(); eliminated.clear(); meEliminated=false; matchFinished=false; cosmicZoneElapsed=0;cosmicZoneProgress=0;lastZoneDamageAt=0;lastMissile=-Infinity; impactFx=[]; asteroidFx=[]; hitFlashUntil=0; hitShakeUntil=0; lastHitAt=0; $('pvpResult').style.display='none';
    $('pvpRoomHud').textContent='Sala '+currentRoom;
    updateLives();
  }
  function startArena(){
    if(!arenaCanvas||!arenaCtx||running||countdownActive)return;
    lobby.style.display='none'; arena.style.display='flex'; loadPvpControlLayout(); resetArena(); startPvpMusic();
    const overlay=$('pvpCountdown'), label=$('pvpCountdownText');
    countdownActive=true; let count=3;
    // Pintar inmediatamente el estado inicial de la nueva partida.
    // El loop aún no corre durante la cuenta atrás, por lo que sin esto
    // el canvas conserva visualmente el último frame de la partida anterior.
    arenaCtx.clearRect(0,0,arenaCanvas.width,arenaCanvas.height);
    if(pvpBackground.complete&&pvpBackground.naturalWidth) arenaCtx.drawImage(pvpBackground,0,0,arenaCanvas.width,arenaCanvas.height);
    overlay.style.display='flex'; label.textContent=count;
    clearInterval(countdownTimer);
    countdownTimer=setInterval(()=>{
      count--;
      if(count>0){ label.textContent=count; return; }
      if(count===0){ label.textContent='¡YA!'; return; }
      clearInterval(countdownTimer); countdownTimer=0; overlay.style.display='none'; countdownActive=false;
      running=true; lastFrame=performance.now(); raf=requestAnimationFrame(loop);
    },1000);
  }
  function stopArena(){
    running=false;countdownActive=false; syncBackgroundCombat(); stopPvpMusic();
    if(countdownTimer){clearInterval(countdownTimer);countdownTimer=0;}
    const overlay=$('pvpCountdown');if(overlay)overlay.style.display='none';
    if(raf)cancelAnimationFrame(raf);raf=0;moveStick.active=false;
  }
  async function settlePvpRecord(result,forcedMatchId='',placement=0){
    const before=getPvpCups();
    const officialMatchId=forcedMatchId||('room-'+currentRoom+'-'+pvpMode);
    // Espera la liquidación exacta de ESTA partida. Así una escritura retrasada de
    // una partida anterior no se muestra como si fueran copas ganadas ahora.
    for(let attempt=0;attempt<20;attempt++){
      try{
        const r=await fetch(PVP_HTTP_BASE+'/ranking?playerId='+encodeURIComponent(playerId())+'&matchId='+encodeURIComponent(officialMatchId)+'&t='+Date.now(),{cache:'no-store'});
        const data=await r.json();
        if(data?.ok&&data.record&&data.settlement){
          const cups=Number(data.record.cups||0), delta=Number(data.settlement.delta||0);
          localStorage.setItem(PVP_CUPS_KEY,String(cups));
          renderPvpRankSummary(cups);
          return {cups,delta,record:data.record,settlement:data.settlement,authoritative:true};
        }
      }catch{}
      await new Promise(resolve=>setTimeout(resolve,300));
    }
    // Si Cloudflare tarda excepcionalmente, sincronizamos el total oficial pero no
    // inventamos el delta de la partida.
    try{
      const r=await fetch(PVP_HTTP_BASE+'/ranking?playerId='+encodeURIComponent(playerId())+'&t='+Date.now(),{cache:'no-store'});
      const data=await r.json();
      if(data?.record){const cups=Number(data.record.cups||0);localStorage.setItem(PVP_CUPS_KEY,String(cups));renderPvpRankSummary(cups);return {cups,delta:0,record:data.record,pending:true,authoritative:true};}
    }catch{}
    return {cups:before,delta:0,pending:true,authoritative:true};
  }
  function renderPvpRankSummary(cups=getPvpCups()){
    cups=Math.max(0,Number(cups)||0);
    const thresholds=[0,200,500,1000,3000,7000,12000];
    const names=['🥚 Novato','🥉 Bronce','🥈 Plata','🥇 Oro','💎 Diamante','🚀 Maestro Cósmico','🌌 Leyenda Galáctica'];
    const level=pvpRankFromCups(cups).level;
    const text=$('pvpRankSummaryText'),bar=$('pvpRankProgress'),next=$('pvpRankNext');
    if(text)text.textContent=names[level]+' · 🏆 '+Math.floor(cups)+' copas';
    if(level>=thresholds.length-1){
      if(bar)bar.style.width='100%';
      if(next)next.textContent='Rango máximo alcanzado';
      return;
    }
    const floor=thresholds[level],target=thresholds[level+1];
    const progress=Math.max(0,Math.min(100,((cups-floor)/(target-floor))*100));
    if(bar)bar.style.width=progress+'%';
    if(next)next.textContent=Math.floor(cups)+' / '+target+' → '+names[level+1];
  }
  async function syncPvpRankSummary(){
    renderPvpRankSummary();
    try{
      const r=await fetch(PVP_HTTP_BASE+'/ranking?playerId='+encodeURIComponent(playerId())+'&t='+Date.now(),{cache:'no-store'});
      const data=await r.json();
      if(data?.record){
        const cups=Math.max(0,Number(data.record.cups)||0);
        localStorage.setItem(PVP_CUPS_KEY,String(cups));
        renderPvpRankSummary(cups);
      }
    }catch{}
  }
  function pvpRankName(cups){
    cups=Number(cups||0);
    if(cups>=12000)return '🌌 Leyenda Galáctica';
    if(cups>=7000)return '🚀 Maestro Cósmico';
    if(cups>=3000)return '💎 Diamante';
    if(cups>=1000)return '🥇 Oro';
    if(cups>=500)return '🥈 Plata';
    if(cups>=200)return '🥉 Bronce';
    return '🥚 Novato';
  }
  function endArena(text,result='none',placement=0){
    if(matchFinished)return; matchFinished=true;
    stopArena();
    const resultEl=$('pvpResultText');
    resultEl.textContent=text+'\n☠️ Eliminaciones: '+matchKills+(result==='win'||result==='loss'?'\n🏆 Guardando copas…':'');
    $('pvpResult').style.display='flex';
    if(!matchCupsSettled && (result==='win'||result==='loss')){
      matchCupsSettled=true;
      const cupsBefore=getPvpCups();
      settlePvpRecord(result,'',placement).then(saved=>{
        const oldRank=pvpRankName(cupsBefore), newRank=pvpRankName(saved.cups);
        const rankUp=newRank!==oldRank && saved.cups>cupsBefore ? '\n🎉 ¡Subiste de rango a '+newRank+'!' : '';
        resultEl.textContent=text+'\n☠️ Eliminaciones: '+matchKills+'\n🏆 Copas: '+saved.cups+(saved.delta?' ('+(saved.delta>0?'+':'')+saved.delta+')':'')+rankUp;
      });
    }
  }
  const killFeed=[];
  let matchKills=0, matchBotKills=0, matchHumanKills=0, matchCupsSettled=false;
  function playerName(slot){
    const p=players.find(x=>Number(x.slot)===Number(slot));
    return p?.name||('Jugador '+slot);
  }
  function addKillFeed(text){
    killFeed.push({text:String(text||''),until:performance.now()+4200});
    while(killFeed.length>4)killFeed.shift();
  }
  function markEliminated(slot){
    slot=Number(slot||0); if(!slot)return;
    const wasEliminated=eliminated.has(slot);
    eliminated.add(slot);
    if(!wasEliminated)addKillFeed('💥 '+playerName(slot)+' fue eliminado.');
    if(slot===mySlot)meEliminated=true;
    const s=peerStates.get(slot);if(s)s.lives=0;
    updateLives();
  }
  function checkTeamResult(){
    if(matchFinished||pvpMode!=='2v2'||!myTeam)return;
    const teams=[1,2];
    const dead=team=>players.filter(p=>Number(p.team)===team).length>=2 &&
      players.filter(p=>Number(p.team)===team).every(p=>eliminated.has(Number(p.slot)));
    const myDead=dead(myTeam), enemyTeam=teams.find(t=>t!==myTeam), enemyDead=dead(enemyTeam);
    if(enemyDead)return endArena('🏆 ¡Victoria de tu equipo!','win');
    if(myDead)return endArena('💥 Tu equipo fue eliminado.','loss');
    if(meEliminated)showStatus('👀 Nave eliminada · tu compañero sigue luchando.',true);
  }
  function updateLives(){
    $('pvpMyLives').textContent='❤️ x'+Math.max(0,meState.lives);
    const enemies=players.filter(p=>Number(p.slot)!==mySlot && !eliminated.has(Number(p.slot)) && (pvpMode!=='2v2'||Number(p.team)!==myTeam));
    const enemyLives=enemies.map(p=>'❤️ x'+Math.max(0,peerFor(p.slot).lives)).join(' · ');
    $('pvpRivalLives').textContent=enemyLives||'Esperando…';
    const label=$('pvpRivalLabel');if(label)label.textContent=pvpMode==='2v2'?'RIVALES':'RIVAL';
  }
  function handlePeer(p,fromSlot=0,fromTeam=0){
    if(!fromSlot || fromSlot===mySlot)return;
    const remote=peerFor(fromSlot);
    if(eliminated.has(Number(fromSlot)) && (p.type==='state'||p.type==='shot'||p.type==='missile')) return;
    if(pvpMode==='2v2' && fromTeam && fromTeam===myTeam && (p.type==='shot'||p.type==='missile')) return; // fuego amigo: ni daño ni efecto visual
    // El servidor reenvía las coordenadas en el sistema local del emisor.
    // El jugador 2 ve la arena rotada 180°, así ambos juegan desde abajo.
    const mirrorX = x => pvpMode==='1v1' && mySlot === 2 ? worldWidth - x : x;
    const mirrorY = y => pvpMode==='1v1' && mySlot === 2 ? worldHeight - y : y;
    const mirrorAngle = a => pvpMode==='1v1' && mySlot === 2 ? a + Math.PI : a;
    if(p.type==='defeat'){
      // En 1v1 el peer defeat cierra la partida; acredita la eliminación si este cliente fue el atacante final.
      if(pvpMode==='1v1'){
        if(Number(p.killerSlot||0)===mySlot && !eliminated.has(Number(fromSlot))){matchKills++;const victim=players.find(x=>Number(x.slot)===fromSlot);if(victim?.bot)matchBotKills++;else matchHumanKills++;}
        endArena('🏆 ¡VICTORIA!\n⚔️ '+playerName(mySlot)+' derrotó a '+playerName(fromSlot),'win');
      }
      return;
    }
    if(p.type==='bot-state'&&botMatch&&(pvpMode==='2v2'||(pvpMode==='arena'||pvpMode==='arena10')||pvpMode==='arena10')){
      const slot=Number(p.slot||0), bp=players.find(x=>x.bot&&Number(x.slot)===slot);
      if(!bp)return;
      const st=peerFor(slot);
      if(Number.isFinite(Number(p.x)))st.targetX=Number(p.x);
      if(Number.isFinite(Number(p.y)))st.targetY=Number(p.y);
      if(Number.isFinite(Number(p.angle)))st.targetAngle=Number(p.angle);
      if(Number.isFinite(Number(p.visualAngle)))st.targetVisualAngle=Number(p.visualAngle);
      // No sobrescribir vidas aquí: en 2H vs 2B cada humano es autoridad de
      // sus propios impactos contra bots. La eliminación oficial la confirma el servidor.
      updateLives(); return;
    } else if(p.type==='bot-shot'&&botMatch&&(pvpMode==='2v2'||(pvpMode==='arena'||pvpMode==='arena10')||pvpMode==='arena10')){
      const bp=players.find(x=>x.bot&&Number(x.slot)===Number(p.slot||0));if(!bp)return;
      spawnRemoteShot(Number(p.x),Number(p.y),Number(p.angle),bp.ship,bp.slot,Number(bp.team||0),Number(p.targetSlot||0));return;
    } else if(p.type==='bot-missile'&&botMatch&&(pvpMode==='2v2'||(pvpMode==='arena'||pvpMode==='arena10')||pvpMode==='arena10')){
      const bp=players.find(x=>x.bot&&Number(x.slot)===Number(p.slot||0));if(!bp)return;
      spawnRemoteMissile(Number(p.x),Number(p.y),bp.ship,p.missileType,false,bp.slot,Number(bp.team||0),Number(p.targetSlot||0));return;
    }
    if(p.type==='state'){
      const px=Number(p.x), py=Number(p.y), pa=Number(p.angle);
      if(Number.isFinite(px)) remote.targetX=mirrorX(px);
      if(Number.isFinite(py)) remote.targetY=mirrorY(py);
      if(Number.isFinite(pa)) remote.targetAngle=mirrorAngle(pa);
      const pva=Number(p.visualAngle);
      if(Number.isFinite(pva)) remote.targetVisualAngle=mirrorAngle(pva);
      remote.lives=Number.isFinite(Number(p.lives))?Number(p.lives):remote.lives;updateLives();
    } else if(p.type==='evade'){
      remoteEvadeUntil.set(Number(fromSlot),performance.now()+PVP_EVADE_DURATION);
      if(selectedTargetSlot===Number(fromSlot))selectedTargetSlot=0;
      return;
    } else if(p.type==='shot'){
      spawnRemoteShot(mirrorX(Number(p.x)),mirrorY(Number(p.y)),mirrorAngle(Number(p.angle)),p.ship,fromSlot,fromTeam);
    } else if(p.type==='missile'){
      spawnRemoteMissile(mirrorX(Number(p.x)),mirrorY(Number(p.y)),p.ship,p.missileType,p.isPro,fromSlot,fromTeam,Number(p.targetSlot||0));
    }
  }

  function shoot(){
    const now=performance.now(), myStats=pvpShipStats((players.find(p=>Number(p.slot)===mySlot)||{ship:shipLabel()}).ship);if(!running||meEliminated||now-lastShot<myStats.shotCooldown)return;
    const targetPlayer=players.find(p=>Number(p.slot)===selectedTargetSlot&&!eliminated.has(Number(p.slot))&&(pvpMode!=='2v2'||Number(p.team)!==myTeam)&&performance.now()>=Number(remoteEvadeUntil.get(Number(p.slot))||0));
    if(!targetPlayer){showStatus('🎯 Toca una nave enemiga para seleccionarla.');return;}
    const target=peerFor(targetPlayer.slot);
    if(!inAttackRange(meState,target)){showStatus('📡 Objetivo fuera de alcance.');return;}
    const a=Math.atan2(target.y-meState.y,target.x-meState.x), sideX=Math.cos(a+Math.PI/2)*9, sideY=Math.sin(a+Math.PI/2)*9;
    meState.angle=a;lastShot=now;
    const myShip=(players.find(p=>Number(p.slot)===mySlot)||{ship:shipLabel()}).ship;
    // Mismo láser del juego normal: 4x20 y velocidad equivalente a 14 px/frame a 60 FPS.
    [-1,1].forEach(s=>{const bx=meState.x+sideX*s,by=meState.y+sideY*s;bullets.push({x:bx,y:by,prevX:bx,prevY:by,vx:Math.cos(a)*840,vy:Math.sin(a)*840,angle:a,ship:myShip,own:true,ownerSlot:mySlot,ownerTeam:myTeam,life:1.5});});
    const sx=pvpMode==='1v1'&&mySlot===2?worldWidth-meState.x:meState.x;
    const sy=pvpMode==='1v1'&&mySlot===2?worldHeight-meState.y:meState.y;
    const sa=pvpMode==='1v1'&&mySlot===2?a+Math.PI:a;
    send({type:'shot',x:sx,y:sy,angle:sa,ship:myShip});
  }
  function spawnRemoteShot(x,y,a,ship,ownerSlot=0,ownerTeam=0,targetSlot=0){
    if(!Number.isFinite(x+y+a))return;
    const sideX=Math.cos(a+Math.PI/2)*9,sideY=Math.sin(a+Math.PI/2)*9;
    [-1,1].forEach(s=>{const bx=x+sideX*s,by=y+sideY*s;bullets.push({x:bx,y:by,prevX:bx,prevY:by,vx:Math.cos(a)*840,vy:Math.sin(a)*840,angle:a,ship:ship||'Gallina',own:false,ownerSlot,ownerTeam,targetSlot:Number(targetSlot||0),life:1.5});});
  }
  function fireMissile(){
    const now=performance.now();
    if(!running||meEliminated)return;
    // La misma constante controla tanto el HUD como el disparo para que LISTO siempre signifique que puede disparar.
    if(now-lastMissile<PVP_MISSILE_COOLDOWN)return;
    const myShip=(players.find(p=>Number(p.slot)===mySlot)||{ship:shipLabel()}).ship;
    const info=shipCombatInfo(myShip), stats=currentGameStats();
    // Igual que el modo normal: el misil Pro sólo se usa si la nave es Pro y ese misil fue desbloqueado.
    const usePro=info.isPro && !!stats.proMissiles?.[info.index];
    const targetPlayer=players.find(p=>Number(p.slot)===selectedTargetSlot&&!eliminated.has(Number(p.slot))&&(pvpMode!=='2v2'||Number(p.team)!==myTeam)&&performance.now()>=Number(remoteEvadeUntil.get(Number(p.slot))||0));
    if(!targetPlayer){showStatus('🎯 Selecciona un enemigo antes de lanzar el misil.');return;}
    const targetState=peerFor(targetPlayer.slot);
    if(!inAttackRange(meState,targetState)){showStatus('📡 Objetivo fuera de alcance para misil.');return;}
    lastMissile=now;
    const a=Math.atan2(targetState.y-meState.y,targetState.x-meState.x);
    meState.angle=a;
    const speed=450, initialSpeed=300;
    const targetSlot=Number(targetPlayer.slot);
    missiles.push({x:meState.x,y:meState.y,prevX:meState.x,prevY:meState.y,own:true,ownerSlot:mySlot,ownerTeam:myTeam,targetSlot,ship:myShip,missileType:info.missileType,isPro:usePro,life:6,vx:Math.cos(a)*initialSpeed,vy:Math.sin(a)*initialSpeed,speed});
    const sx=pvpMode==='1v1'&&mySlot===2?worldWidth-meState.x:meState.x;
    const sy=pvpMode==='1v1'&&mySlot===2?worldHeight-meState.y:meState.y;
    send({type:'missile',x:sx,y:sy,ship:myShip,missileType:info.missileType,isPro:usePro,targetSlot});
  }
  function spawnRemoteMissile(x,y,ship,missileType,isPro,ownerSlot=0,ownerTeam=0,targetSlot=0){
    if(!Number.isFinite(x+y))return;
    const info=shipCombatInfo(ship||'Gallina');
    // En la vista remota el rival parte apuntando hacia abajo.
    missiles.push({x,y,prevX:x,prevY:y,own:false,ship:ship||'Gallina',missileType:missileType||info.missileType,isPro:!!isPro,ownerSlot,ownerTeam,targetSlot,life:6,vx:0,vy:300,speed:450});
  }
  function updateMissileButton(now=performance.now()){
    const btn=$('pvpMissileBtn'), label=$('pvpMissileCooldown'); if(!btn||!label)return;
    const left=Math.max(0,PVP_MISSILE_COOLDOWN-(now-lastMissile));
    label.textContent=left>0?(Math.ceil(left/1000)+'s'):'LISTO';
    btn.style.opacity=left>0?'.55':'1';
  }
  function loop(now){
    if(!running)return; const dt=Math.min(.04,(now-lastFrame)/1000);lastFrame=now; update(dt,now);draw();raf=requestAnimationFrame(loop);
  }
  // requestAnimationFrame se pausa cuando la pestaña/app queda en segundo plano.
  // Un pulso liviano mantiene el combate local avanzando para que la nave siga
  // recibiendo daño aun cuando el jugador cambie temporalmente de aplicación.
  let backgroundCombatTimer=0;
  function syncBackgroundCombat(){
    if(document.hidden && running && !backgroundCombatTimer){
      backgroundCombatTimer=setInterval(()=>{
        if(!running||!document.hidden)return;
        const now=performance.now();
        const dt=Math.min(.1,Math.max(.016,(now-lastFrame)/1000));
        lastFrame=now;
        update(dt,now);
      },50);
    } else if((!document.hidden||!running) && backgroundCombatTimer){
      clearInterval(backgroundCombatTimer);backgroundCombatTimer=0;
      lastFrame=performance.now();
    }
  }
  document.addEventListener('visibilitychange',syncBackgroundCombat);
  function update(dt,now){
    // Regeneración PvP: tras 5 s sin recibir daño, recupera 1 vida cada 2 s
    // hasta el máximo de 20. Cada impacto reinicia el temporizador.
    const myRegen=pvpShipStats((players.find(p=>Number(p.slot)===mySlot)||{ship:shipLabel()}).ship);
    if(running&&!matchFinished&&!meEliminated&&meState.lives>0&&meState.lives<myRegen.maxLives&&now-lastHitAt>=myRegen.regenDelay&&now-lastRegenAt>=myRegen.regenEvery){
      meState.lives++;lastRegenAt=now;updateLives();
    }
    const zone=cosmicZoneState(dt);
    if(zone?.active&&!meEliminated&&Math.hypot(meState.x-zone.cx,meState.y-zone.cy)>zone.radius&&now-lastZoneDamageAt>=1000){
      lastZoneDamageAt=now;lastHitAt=now;lastRegenAt=now;
      meState.lives=Math.max(0,meState.lives-2);updateLives();
      hitFlashUntil=now+180;
      if(meState.lives<=0){
        send({type:'defeat',slot:mySlot,team:myTeam,killerSlot:0,attackKind:'zone',reason:'zone'});
        markEliminated(mySlot);showStatus('🌌 La Zona Cósmica destruyó tu nave.',true);
      }
    }
    if(botMatch&&(pvpMode==='1v1'||pvpMode==='2v2'||(pvpMode==='arena'||pvpMode==='arena10')||pvpMode==='arena10')){
      for(const bp of players.filter(p=>p.bot&&!eliminated.has(Number(p.slot)))){
        const slot=Number(bp.slot),st=peerFor(slot),hit=Number(botHitTimes.get(slot)||0);
        let regen=Number(botRegenTimes.get(slot)||hit);
        if(!regen){regen=now;botRegenTimes.set(slot,regen);}
        if(st.lives>0&&st.lives<20&&now-hit>=5000&&now-regen>=2000){
          st.lives++;botRegenTimes.set(slot,now);if(pvpMode==='1v1')botLives=st.lives;updateLives();
        }
      }
    }
    // Suaviza únicamente la representación de las naves remotas entre los
    // paquetes de red (~20 Hz). La nave local y la lógica de combate conservan
    // su respuesta inmediata.
    const smooth=1-Math.pow(0.000001,dt);
    const angleLerp=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
    for(const state of peerStates.values()){
      if(Number.isFinite(state.targetX)) state.x+=(state.targetX-state.x)*smooth;
      if(Number.isFinite(state.targetY)) state.y+=(state.targetY-state.y)*smooth;
      if(Number.isFinite(state.targetAngle)) state.angle=angleLerp(state.angle,state.targetAngle,smooth);
      if(Number.isFinite(state.targetVisualAngle)) state.visualAngle=angleLerp(state.visualAngle,state.targetVisualAngle,smooth);
    }
    let mx=meEliminated?0:moveStick.x,my=meEliminated?0:moveStick.y;
    if(keys.has('ArrowLeft')||keys.has('a'))mx-=1;if(keys.has('ArrowRight')||keys.has('d'))mx+=1;
    if(keys.has('ArrowUp')||keys.has('w'))my-=1;if(keys.has('ArrowDown')||keys.has('s'))my+=1;
    const len=Math.hypot(mx,my);if(len>1){mx/=len;my/=len;}
    if(Math.hypot(mx,my)>.12) meState.visualAngle=Math.atan2(my,mx);
    const nextX=Math.max(30,Math.min(worldWidth-30,meState.x+mx*190*dt));
    const nextY=Math.max(55,Math.min(worldHeight-55,meState.y+my*190*dt));
    if(!positionBlockedByAsteroid(nextX,meState.y,24))meState.x=nextX;
    if(!positionBlockedByAsteroid(meState.x,nextY,24))meState.y=nextY;
    const selectedPlayer=players.find(p=>Number(p.slot)===selectedTargetSlot&&!eliminated.has(Number(p.slot))&&(pvpMode!=='2v2'||Number(p.team)!==myTeam)&&performance.now()>=Number(remoteEvadeUntil.get(Number(p.slot))||0));
    if(!selectedPlayer)selectedTargetSlot=0;
    else {const target=peerFor(selectedTargetSlot);if(!inLockRange(meState,target))selectedTargetSlot=0;else meState.angle=Math.atan2(target.y-meState.y,target.x-meState.x);}
    if(!meEliminated&&keys.has(' '))shoot();

    // IA básica de bots. En 2v2 esta primera prueba mueve y hace disparar
    // a los tres bots; cada uno sólo apunta a integrantes del equipo contrario.
    if(botMatch&&(pvpMode==='1v1'||pvpMode==='2v2'||(pvpMode==='arena'||pvpMode==='arena10')||pvpMode==='arena10')&&running&&!matchFinished){
      const humanSlots=players.filter(p=>!p.bot).map(p=>Number(p.slot)).filter(Boolean);
      const botSimAuthority=(pvpMode!=='2v2'&&pvpMode!=='arena'&&pvpMode!=='arena10')||humanSlots.length===0||mySlot===Math.min(...humanSlots);
      const activeBots=botSimAuthority?players.filter(p=>p.bot&&!eliminated.has(Number(p.slot))):[];
      for(const botPlayer of activeBots){
        const bot=peerFor(botPlayer.slot);
        const ai=botAiFor(botPlayer.slot);
        const enemyPlayers=players.filter(p=>Number(p.slot)!==Number(botPlayer.slot)&&!eliminated.has(Number(p.slot))&&(pvpMode!=='2v2'||Number(p.team)!==Number(botPlayer.team))&&(Number(p.slot)!==mySlot||now>=evadeUntil)&&now>=Number(remoteEvadeUntil.get(Number(p.slot))||0));
        const enemyTargets=enemyPlayers.map(p=>({p,state:Number(p.slot)===mySlot?meState:peerFor(p.slot)}));
        const rankLevel=Math.max(0,Math.min(6,Number(botPlayer.rankLevel||0)));
        // Rangos altos eligen mejor sus objetivos: desde Diamante ponderan vida además de distancia.
        const targetScore=t=>{
          const d=Math.hypot(t.state.x-bot.x,t.state.y-bot.y);
          if(rankLevel<4)return d;
          const max=pvpShipStats(t.p.ship||'Gallina').maxLives;
          const life=Math.max(0,Number(t.state.lives||max))/max;
          return d+(life*90)-(rankLevel>=6?(1-life)*80:0);
        };
        const nearest=enemyTargets.sort((a,b)=>targetScore(a)-targetScore(b))[0];
        if(!nearest)continue;
        const nearestDist=Math.hypot(nearest.state.x-bot.x,nearest.state.y-bot.y);
        // Fuera del radio de búsqueda el bot patrulla su propio sector en vez de
        // conocer mágicamente la posición de todos. Así los bots se dispersan,
        // exploran el mapa y sólo persiguen cuando encuentran a alguien cerca.
        // Todos los modos PvP usan ahora la misma base de percepción táctica de
        // Arena 10. El tamaño del mapa sigue definiendo cómo patrullan, pero 1v1,
        // 2v2 y Arena 5 ya no quedan limitados al antiguo radio corto de 390 px.
        const arena10Patrol=pvpMode==='arena10';
        const searchRadius=Math.min(700,Math.hypot(worldWidth,worldHeight));
        if(!ai.patrolX||!ai.patrolY||Math.hypot(ai.patrolX-bot.x,ai.patrolY-bot.y)<65||now>=Number(ai.nextPatrolAt||0)){
          if(arena10Patrol){
            // Arena 10: divide el mundo 5×5 en zonas. Cada bot explora primero
            // una zona distinta y cambia de destino dentro de ella, evitando que
            // todos converjan al centro del mapa gigante.
            const zone=(Number(botPlayer.slot)-1)%25;
            const col=zone%5,row=Math.floor(zone/5);
            const cellW=worldWidth/5,cellH=worldHeight/5;
            const marginX=Math.min(90,cellW*.18),marginY=Math.min(90,cellH*.18);
            ai.patrolX=col*cellW+marginX+Math.random()*Math.max(1,cellW-marginX*2);
            ai.patrolY=row*cellH+marginY+Math.random()*Math.max(1,cellH-marginY*2);
            // De vez en cuando salta a una zona vecina para que la Arena siga
            // mezclándose y los encuentros no dependan sólo del spawn inicial.
            if(Math.random()<.30){
              const dc=Math.floor(Math.random()*3)-1,dr=Math.floor(Math.random()*3)-1;
              const nc=Math.max(0,Math.min(4,col+dc)),nr=Math.max(0,Math.min(4,row+dr));
              ai.patrolX=nc*cellW+marginX+Math.random()*Math.max(1,cellW-marginX*2);
              ai.patrolY=nr*cellH+marginY+Math.random()*Math.max(1,cellH-marginY*2);
            }
            ai.nextPatrolAt=now+4500+Math.random()*4500;
          }else{
            const sector=(Number(botPlayer.slot)-1)%5;
            const a=(sector/5)*Math.PI*2+(Math.random()-.5)*1.05;
            const radius=180+Math.random()*260;
            ai.patrolX=Math.max(65,Math.min(worldWidth-65,worldWidth/2+Math.cos(a)*radius));
            ai.patrolY=Math.max(85,Math.min(worldHeight-85,worldHeight/2+Math.sin(a)*radius));
            ai.nextPatrolAt=now+2800+Math.random()*3200;
          }
        }
        const chosen=nearestDist<=searchRadius?nearest:null;
        // Arena 5 y Arena 10 comparten también la conciencia de Zona Cósmica.
        // 1v1/2v2 mantienen la misma IA de combate sin inventar una zona donde no existe.
        const botZone=(pvpMode==='arena'||pvpMode==='arena10')?cosmicZoneState(0):null;
        const botOutsideZone=!!botZone?.active&&Math.hypot(bot.x-botZone.cx,bot.y-botZone.cy)>Math.max(80,botZone.radius-70);
        const navTarget=botOutsideZone?{x:botZone.cx,y:botZone.cy}:(chosen?chosen.state:{x:ai.patrolX,y:ai.patrolY});
        const dx=navTarget.x-bot.x,dy=navTarget.y-bot.y,dist=Math.hypot(dx,dy)||1;
        const trueAim=chosen?Math.atan2(chosen.state.y-bot.y,chosen.state.x-bot.x):Math.atan2(dy,dx);
        bot.targetAngle=trueAim;bot.targetVisualAngle=trueAim;

        // Navegación táctica imperfecta: perseguir, orbitar, retirarse con
        // poca vida y hacer esquivas ocasionales. Mantiene oportunidades claras
        // para jugadores nuevos en vez de reaccionar perfectamente a cada tiro.
        let desiredX=dx/dist,desiredY=dy/dist;
        const botStats=pvpShipStats(botPlayer.ship||'Gallina');
        const lifeRatio=Math.max(0,Number(bot.lives||0))/botStats.maxLives;
        // La frecuencia de esquiva escala por rango. Maestro/Leyenda reaccionan además
        // a proyectiles cercanos, pero sin superar la velocidad máxima de un jugador.
        const dodgeBase=[1800,1550,1300,1050,850,650,480][rankLevel];
        const incomingThreat=rankLevel>=4&&bullets.some(b=>{
          if(Number(b.ownerSlot)===Number(botPlayer.slot))return false;
          const rx=bot.x-b.x,ry=bot.y-b.y,rvx=Number(b.vx||0),rvy=Number(b.vy||0);
          const v2=rvx*rvx+rvy*rvy||1,t=Math.max(0,Math.min(.45,(rx*rvx+ry*rvy)/v2));
          return Math.hypot((b.x+rvx*t)-bot.x,(b.y+rvy*t)-bot.y)<(rankLevel>=6?72:55);
        });
        if(!ai.nextDodgeAt)ai.nextDodgeAt=now+dodgeBase+Math.random()*700;
        if(now>=ai.nextDodgeAt||incomingThreat){
          ai.nextDodgeAt=now+dodgeBase+Math.random()*(rankLevel>=5?450:900);
          ai.dodgeUntil=now+(rankLevel>=5?650:420)+Math.random()*300;
          ai.dodgeSide=Math.random()<.5?-1:1;
        }
        const dodging=now<Number(ai.dodgeUntil||0);
        const retreating=rankLevel>=4&&lifeRatio<=(rankLevel>=6?.35:.30);
        if(retreating&&chosen){
          // Con poca vida corta el duelo, abre distancia a máxima velocidad y
          // sigue derivando lateralmente para no convertirse en un blanco recto.
          const side=Number(ai.dodgeSide||ai.orbitSide||((Number(botPlayer.slot)%2)?1:-1));
          desiredX=(-dx/dist)*1.18+(-dy/dist)*side*.58;
          desiredY=(-dy/dist)*1.18+( dx/dist)*side*.58;
        }else if(dist<135){
          desiredX=-dx/dist;desiredY=-dy/dist;
        }else if(rankLevel>=4&&chosen&&dist<=PVP_LOCK_RANGE){
          // Desde Diamante la persecución ya es una órbita continua: incluso cuando
          // sale momentáneamente de los 250 px sigue avanzando de forma tangencial
          // mientras recupera la distancia de disparo.
          // corre lateralmente alrededor del rival mientras corrige suavemente
          // hacia ~235 px. Maestro/Leyenda cambian de sentido ocasionalmente.
          {
            if(!ai.orbitSide)ai.orbitSide=(Number(botPlayer.slot)%2)?1:-1;
            if(rankLevel>=5&&(!ai.nextOrbitFlipAt||now>=ai.nextOrbitFlipAt)){
              ai.nextOrbitFlipAt=now+(rankLevel>=6?1800:2800)+Math.random()*(rankLevel>=6?1700:2400);
              if(Math.random()<(rankLevel>=6?.70:.45))ai.orbitSide*=-1;
            }
            const side=Number(ai.orbitSide||1);
            const targetRadius=rankLevel>=6?225:rankLevel===5?230:238;
            // Perpendicular casi puro. La corrección radial sólo mantiene la distancia,
            // evitando que la persecución frontal diluya la órbita.
            const radial=Math.max(-.24,Math.min(.24,(dist-targetRadius)/70));
            const tangent=rankLevel>=6?1.28:rankLevel===5?1.16:1.04;
            desiredX=(-dy/dist)*side*tangent+(dx/dist)*radial;
            desiredY=( dx/dist)*side*tangent+(dy/dist)*radial;
          }
        }else if(dist<=250){
          const side=(Number(botPlayer.slot)%2)?1:-1;
          desiredX=(-dy/dist)*side*.90+(dx/dist)*.12;
          desiredY=( dx/dist)*side*.90+(dy/dist)*.12;
        }
        if(dodging){
          const side=Number(ai.dodgeSide||1);
          const keep=rankLevel>=5?.18:.42,burst=rankLevel>=6?1.45:rankLevel===5?1.25:.90;
          desiredX=desiredX*keep+(-dy/dist)*side*burst;
          desiredY=desiredY*keep+( dx/dist)*side*burst;
        }
        // Si un asteroide corta el camino inmediato, elegir el lado libre.
        const aheadX=bot.targetX+desiredX*70,aheadY=bot.targetY+desiredY*70;
        const obstacle=asteroids.find(a=>Math.hypot(aheadX-a.x,aheadY-a.y)<a.r+34);
        if(obstacle){
          const ox=bot.targetX-obstacle.x,oy=bot.targetY-obstacle.y,olen=Math.hypot(ox,oy)||1;
          const side=(Number(botPlayer.slot)%2)?1:-1;
          desiredX=(-oy/olen)*side;desiredY=(ox/olen)*side;
        }
        // Pequeña variación individual para evitar formaciones robóticas.
        if(!ai.nextMoveAt||now>=ai.nextMoveAt){
          ai.nextMoveAt=now+(rankLevel>=5?550:850)+Math.random()*(rankLevel>=5?350:700);
          ai.wander=(Math.random()-.5)*(rankLevel>=5?.12:.42);
        }
        const wa=Number(ai.wander||0),ca=Math.cos(wa),sa=Math.sin(wa);
        ai.moveX=desiredX*ca-desiredY*sa;ai.moveY=desiredX*sa+desiredY*ca;
        // Normalizar evita que la mezcla radial+tangencial cambie accidentalmente
        // la velocidad. Leyenda mantiene 190 px/s durante órbita, esquiva y retirada.
        const moveLen=Math.hypot(ai.moveX,ai.moveY)||1;
        ai.moveX/=moveLen;ai.moveY/=moveLen;
        const baseSpeed=[108,116,124,150,170,185,190][rankLevel];
        const highRankCombat=rankLevel>=6&&!!chosen;
        const speed=highRankCombat?190:(retreating?190:(dist>250?baseSpeed:(dodging?190:(rankLevel>=5?baseSpeed:Math.max(104,baseSpeed-6)))));
        const botNextX=Math.max(45,Math.min(worldWidth-45,bot.targetX+ai.moveX*speed*dt));
        const botNextY=Math.max(70,Math.min(worldHeight-70,bot.targetY+ai.moveY*speed*dt));
        if(!positionBlockedByAsteroid(botNextX,bot.targetY,24))bot.targetX=botNextX;
        else{ai.wander=(Number(ai.wander||0)>=0?-1:1)*.8;ai.nextMoveAt=0;}
        if(!positionBlockedByAsteroid(bot.targetX,botNextY,24))bot.targetY=botNextY;
        else{ai.wander=(Number(ai.wander||0)>=0?-1:1)*.8;ai.nextMoveAt=0;}
        if(botZone?.active&&Math.hypot(bot.x-botZone.cx,bot.y-botZone.cy)>botZone.radius){
          const lastZone=Number(ai.lastZoneDamageAt||0);
          if(now-lastZone>=1000){
            ai.lastZoneDamageAt=now;botHitTimes.set(Number(botPlayer.slot),now);botRegenTimes.set(Number(botPlayer.slot),now);
            bot.lives=Math.max(0,Number(bot.lives||20)-2);updateLives();
            if(bot.lives<=0&&!eliminated.has(Number(botPlayer.slot))&&!pendingBotDefeats.has(Number(botPlayer.slot))){
              pendingBotDefeats.add(Number(botPlayer.slot));
              send({type:'bot-defeat',slot:Number(botPlayer.slot),team:0,killerSlot:0,attackKind:'zone'});
            }
          }
        }
        const targetInAttackRange=!!chosen&&Math.hypot(chosen.state.x-bot.x,chosen.state.y-bot.y)<=PVP_ATTACK_RANGE;
        // Desde Oro usa la cadencia humana base (330 ms). El Aniquilador conserva
        // exactamente su ventaja real de 247,5 ms; los rangos bajos dejan más ventanas.
        const rankShotCooldown=[850,650,480,330,330,330,330][rankLevel];
        const botShotCooldown=botPlayer.ship==='Toro Aniquilador'?Math.min(rankShotCooldown,247.5):rankShotCooldown;
        if(targetInAttackRange&&now-ai.lastShot>botShotCooldown){
          ai.lastShot=now;
          const aim=trueAim;
          spawnRemoteShot(bot.x,bot.y,aim,botPlayer.ship,botPlayer.slot,Number(botPlayer.team||0),Number(chosen.p.slot));
          if(pvpMode==='2v2'||(pvpMode==='arena'||pvpMode==='arena10')||pvpMode==='arena10')send({type:'bot-shot',slot:Number(botPlayer.slot),x:bot.x,y:bot.y,angle:aim,targetSlot:Number(chosen.p.slot)});
        }
        // Los rangos altos reservan menos el misil cuando ya tienen un blanco válido.
        if(targetInAttackRange&&now>=ai.nextMissileAt){
          const missileMin=rankLevel>=6?8000:rankLevel>=5?8500:rankLevel>=4?9000:10000;
          const missileJitter=rankLevel>=5?1200:2500;
          ai.nextMissileAt=now+missileMin+Math.random()*missileJitter;
          const info=shipCombatInfo(botPlayer.ship||'Gallina');
          spawnRemoteMissile(bot.x,bot.y,botPlayer.ship,info.missileType,false,botPlayer.slot,Number(botPlayer.team||0),Number(chosen.p.slot));
          if(pvpMode==='2v2'||(pvpMode==='arena'||pvpMode==='arena10')||pvpMode==='arena10')send({type:'bot-missile',slot:Number(botPlayer.slot),x:bot.x,y:bot.y,missileType:info.missileType,targetSlot:Number(chosen.p.slot)});
        }
      }
    }

    for(const b of bullets){
      if(b.ownerSlot && eliminated.has(Number(b.ownerSlot))){b.life=0;continue;}
      b.prevX=b.x;b.prevY=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
    }
    for(const m of missiles){
      if(m.ownerSlot && eliminated.has(Number(m.ownerSlot))){m.life=0;continue;}
      m.prevX=m.x;m.prevY=m.y;
      let target;
      if(m.own){
        let targetSlot=Number(m.targetSlot||0);
        if(targetSlot && eliminated.has(targetSlot)){ m.targetSlot=0; targetSlot=0; }
        target=targetSlot?peerStates.get(targetSlot):null;
        if(!target){
          const candidates=players.filter(p=>Number(p.slot)!==mySlot&&!eliminated.has(Number(p.slot))&&(pvpMode!=='2v2'||Number(p.team)!==myTeam));
          const nearest=candidates.map(p=>({slot:Number(p.slot),state:peerFor(p.slot)})).sort((a,b)=>Math.hypot(a.state.x-m.x,a.state.y-m.y)-Math.hypot(b.state.x-m.x,b.state.y-m.y))[0];
          if(nearest){ m.targetSlot=nearest.slot; target=nearest.state; }
          else { m.life=0; continue; }
        }
      }else{
        // Si el objetivo ya fue eliminado, el misil deja de perseguir su última
        // posición. Los misiles propios se redirigen; los remotos desaparecen
        // hasta recibir el nuevo objetivo del dueño.
        const targetSlot=Number(m.targetSlot||0);
        if(targetSlot && eliminated.has(targetSlot)){m.life=0;continue;}
        target=targetSlot===mySlot?meState:(targetSlot?peerStates.get(targetSlot):meState);
        if(!target){m.life=0;continue;}
      }
      // Misma persecución del modo normal: la velocidad se interpola 8% por frame hacia el objetivo.
      const angle=Math.atan2(target.y-m.y,target.x-m.x);
      const follow=1-Math.pow(0.92,dt*60);
      m.vx+=(Math.cos(angle)*m.speed-m.vx)*follow;
      m.vy+=(Math.sin(angle)*m.speed-m.vy)*follow;
      m.x+=m.vx*dt;m.y+=m.vy*dt;m.life-=dt;
    }
    // Los asteroides bloquean láseres y misiles para crear cobertura real.
    for(const b of bullets){
      if(b.life<=0)continue;
      const ax=Number.isFinite(b.prevX)?b.prevX:b.x,ay=Number.isFinite(b.prevY)?b.prevY:b.y;
      if(asteroids.some(a=>segmentCircleHit(ax,ay,b.x,b.y,a.x,a.y,a.r+3))){
        b.life=0;addAsteroidImpact(b.x,b.y);
      }
    }
    for(const m of missiles){
      if(m.life<=0)continue;
      const ax=Number.isFinite(m.prevX)?m.prevX:m.x,ay=Number.isFinite(m.prevY)?m.prevY:m.y;
      if(asteroids.some(a=>segmentCircleHit(ax,ay,m.x,m.y,a.x,a.y,a.r+7))){
        m.life=0;addAsteroidImpact(m.x,m.y);
      }
    }
    updateMissileButton(now);updateEvadeButton(now);
    for(const fx of impactFx)fx.life-=dt;
    for(const fx of asteroidFx){fx.x+=fx.vx*dt;fx.y+=fx.vy*dt;fx.vx*=Math.pow(.92,dt*60);fx.vy*=Math.pow(.92,dt*60);fx.life-=dt;}
    asteroidFx=asteroidFx.filter(fx=>fx.life>0);
    impactFx=impactFx.filter(fx=>fx.life>0);
    // Impacto del disparo propio contra la nave rival. Antes el cliente sólo
    // comprobaba los proyectiles recibidos contra SU propia nave; por eso en
    // la pantalla del tirador la bala podía dibujarse atravesando al rival.
    // Ahora el proyectil propio se corta visualmente al cruzar la nave rival.
    for(const b of bullets){
      if(!b.own||b.life<=0)continue;
      const ax=Number.isFinite(b.prevX)?b.prevX:b.x, ay=Number.isFinite(b.prevY)?b.prevY:b.y;
      const dx=b.x-ax,dy=b.y-ay,den=dx*dx+dy*dy;
      // El disparo propio atraviesa al compañero y sólo se corta visualmente
      // cuando alcanza una nave enemiga.
      const targets=players.filter(p=>Number(p.slot)!==mySlot && !eliminated.has(Number(p.slot)) && (pvpMode!=='2v2'||Number(p.team)!==myTeam));
      let best=null;
      for(const p of targets){
        const target=peerFor(p.slot);
        const t=den>0?Math.max(0,Math.min(1,((target.x-ax)*dx+(target.y-ay)*dy)/den)):0;
        const hitX=ax+dx*t,hitY=ay+dy*t;
        if(Math.hypot(hitX-target.x,hitY-target.y)<30 && (!best||t<best.t))best={t,hitX,hitY};
      }
      if(best){
        // Contra otro humano no fingimos un impacto en la pantalla del atacante:
        // el defensor sigue siendo autoridad del daño. El proyectil continúa
        // hasta recibir su trayectoria normal, reduciendo los falsos impactos
        // causados por una posición remota ligeramente atrasada.
        const bestPlayer=players.find(p=>Number(p.slot)!==mySlot&&!eliminated.has(Number(p.slot))&&Math.hypot(peerFor(p.slot).x-best.hitX,peerFor(p.slot).y-best.hitY)<31);
        if(bestPlayer && !bestPlayer.bot) continue;
        // En partidas con bots 2v2/Arena, el bloque específico de daño que
        // viene a continuación debe consumir el proyectil y descontar la vida.
        // Si lo anulamos aquí, sólo queda el efecto visual y nunca llega daño.
        const deferBotDamage=!!(botMatch&&(pvpMode==='2v2'||(pvpMode==='arena'||pvpMode==='arena10')||pvpMode==='arena10')&&bestPlayer?.bot);
        if(!deferBotDamage){
          b.life=0;b.x=best.hitX;b.y=best.hitY;
          impactFx.push({x:best.hitX,y:best.hitY,life:.32,maxLife:.32});
        }
        if(botMatch&&pvpMode==='1v1'&&now-lastBotHitAt>180){
          const botPlayer=players.find(p=>p.bot);
          if(botPlayer){
            lastBotHitAt=now;botLives=Math.max(0,botLives-1);
            const bot=peerFor(botPlayer.slot);bot.lives=botLives;updateLives();
            if(botLives<=0){
              if(!pendingBotDefeats.has(Number(botPlayer.slot))){pendingBotDefeats.add(Number(botPlayer.slot));send({type:'bot-defeat',slot:Number(botPlayer.slot),team:0,killerSlot:mySlot,attackKind:'laser'});}
              eliminated.add(Number(botPlayer.slot));matchKills++;matchBotKills++;
              endArena('🏆 ¡VICTORIA!\n⚔️ '+playerName(mySlot)+' derrotó a '+playerName(botPlayer.slot),'win');
              return;
            }
          }
        }
      }
    }

    // En partidas 2v2 con bots, este cliente simula las vidas de las naves
    // sintéticas. Sólo el cliente del humano con slot más bajo procesa este daño,
    // evitando que dos dispositivos descuenten el mismo impacto.
    if(botMatch&&(pvpMode==='2v2'||(pvpMode==='arena'||pvpMode==='arena10')||pvpMode==='arena10')){
      const humanSlots=players.filter(p=>!p.bot).map(p=>Number(p.slot)).filter(Boolean);
      // Cada humano procesa sus propios impactos contra bots. Los proyectiles
      // creados por bots se procesan sólo en el humano de menor slot para no
      // duplicar el daño bot-vs-bot.
      const botAuthority=humanSlots.length===0||mySlot===Math.min(...humanSlots);
      {
        const damageBot=(targetPlayer,kind,killerSlot,hitX,hitY)=>{
          const slot=Number(targetPlayer.slot), last=Number(botHitTimes.get(slot)||0);
          if(now-last<=180)return false;
          botHitTimes.set(slot,now);botRegenTimes.set(slot,now);
          const st=peerFor(slot);st.lives=Math.max(0,Number(st.lives??20)-1);
          impactFx.push({x:hitX,y:hitY,life:.32,maxLife:.32});updateLives();
          if(st.lives<=0&&!eliminated.has(slot)&&!pendingBotDefeats.has(slot)){
            // Esperar la confirmación oficial del servidor antes de marcarlo
            // eliminado. Antes se añadía aquí a "eliminated", por lo que cuando
            // llegaba player-eliminated parecía duplicado y no sumaba la baja.
            pendingBotDefeats.add(slot);
            send({type:'bot-defeat',slot,team:Number(targetPlayer.team||0),killerSlot:Number(killerSlot||0),attackKind:kind});
          }
          return true;
        };
        for(const b of bullets){
          if(b.life<=0)continue;
          const owner=players.find(p=>Number(p.slot)===Number(b.ownerSlot));
          if(!owner)continue;
          // Disparos humanos: sólo el propio dispositivo. Disparos de bot:
          // únicamente el cliente autoridad.
          if(owner.bot ? !botAuthority : Number(b.ownerSlot)!==mySlot)continue;
          let targets=players.filter(p=>p.bot&&!eliminated.has(Number(p.slot))&&Number(p.slot)!==Number(b.ownerSlot)&&(pvpMode!=='2v2'||Number(p.team)!==Number(owner.team)));
          // Para disparos bot, priorizar el objetivo que el propio bot eligió.
          // Evita inconsistencias entre la simulación del movimiento y la detección
          // bot-vs-bot cuando hay varios bots moviéndose e interpolándose a la vez.
          if(owner.bot&&Number(b.targetSlot||0)){
            const intended=targets.find(p=>Number(p.slot)===Number(b.targetSlot));
            if(intended)targets=[intended,...targets.filter(p=>p!==intended)];
          }
          const ax=Number.isFinite(b.prevX)?b.prevX:b.x,ay=Number.isFinite(b.prevY)?b.prevY:b.y,dx=b.x-ax,dy=b.y-ay,den=dx*dx+dy*dy;
          let best=null;
          for(const p of targets){const st=peerFor(p.slot),t=den>0?Math.max(0,Math.min(1,((st.x-ax)*dx+(st.y-ay)*dy)/den)):0,hx=ax+dx*t,hy=ay+dy*t;if(Math.hypot(hx-st.x,hy-st.y)<30&&(!best||t<best.t))best={p,t,hx,hy};}
          if(best){b.life=0;b.x=best.hx;b.y=best.hy;damageBot(best.p,'laser',b.ownerSlot,best.hx,best.hy);}
        }
        for(const m of missiles){
          if(m.life<=0)continue;
          const targetPlayer=players.find(p=>p.bot&&Number(p.slot)===Number(m.targetSlot)&&!eliminated.has(Number(p.slot)));
          const owner=players.find(p=>Number(p.slot)===Number(m.ownerSlot));
          if(!targetPlayer||!owner||(pvpMode==='2v2'&&Number(targetPlayer.team)===Number(owner.team)))continue;
          if(owner.bot ? !botAuthority : Number(m.ownerSlot)!==mySlot)continue;
          const st=peerFor(targetPlayer.slot);
          if(Math.hypot(m.x-st.x,m.y-st.y)<31){m.life=0;damageBot(targetPlayer,'missile',m.ownerSlot,m.x,m.y);}
        }
      }
    }

    // Daño real: cada dispositivo sigue siendo autoridad de sus propias vidas.
    // La comprobación continua evita que una bala recibida salte la nave entre frames.
    for(const b of bullets){
      if(b.own||b.life<=0)continue;
      if(pvpMode==='2v2' && b.ownerTeam && b.ownerTeam===myTeam)continue;
      const ax=Number.isFinite(b.prevX)?b.prevX:b.x, ay=Number.isFinite(b.prevY)?b.prevY:b.y;
      const dx=b.x-ax,dy=b.y-ay,den=dx*dx+dy*dy;
      const t=den>0?Math.max(0,Math.min(1,((meState.x-ax)*dx+(meState.y-ay)*dy)/den)):0;
      const hitX=ax+dx*t,hitY=ay+dy*t;
      if(Math.hypot(hitX-meState.x,hitY-meState.y)<30){
        if(now<evadeUntil){b.life=0;continue;}
        b.life=0;b.x=hitX;b.y=hitY;
        impactFx.push({x:hitX,y:hitY,life:.32,maxLife:.32});
        hitFlashUntil=performance.now()+220;
        hitShakeUntil=performance.now()+150;
        // Las dos balas de una misma ráfaga cuentan como un solo impacto.
        if(now-lastHitAt>180){
          lastHitAt=now;lastRegenAt=now;
          lastAttackerSlot=Number(b.ownerSlot||0);lastAttackKind='laser';
          meState.lives=Math.max(0,meState.lives-1);updateLives();
          if(meState.lives<=0){send({type:'defeat',slot:mySlot,team:myTeam,killerSlot:lastAttackerSlot||0,attackKind:lastAttackKind||'laser'});if(pvpMode==='2v2'||(pvpMode==='arena'||pvpMode==='arena10')||pvpMode==='arena10'){markEliminated(mySlot);showStatus((pvpMode==='arena'||pvpMode==='arena10')?'👀 Eliminado · observa hasta conocer al ganador.':'👀 Nave eliminada · tu compañero sigue luchando.',true);}else endArena('💥 Tu nave fue destruida.','loss');return;}
        }
      }
    }
    for(const m of missiles){
      if(m.life<=0)continue;
      const targetSlot=Number(m.targetSlot||0);
      let target=m.own?(targetSlot?peerStates.get(targetSlot):null):(targetSlot===mySlot?meState:(targetSlot?peerStates.get(targetSlot):meState));
      if(!target)continue;
      if(Math.hypot(m.x-target.x,m.y-target.y)<31){
        m.life=0; impactFx.push({x:m.x,y:m.y,life:.4,maxLife:.4});
        // En una partida contra bot no existe un segundo cliente que descuente
        // sus vidas, así que el dispositivo local debe aplicar el impacto del
        // misil propio al Bot Cósmico.
        if(m.own&&botMatch&&pvpMode==='1v1'&&targetSlot&&now-lastBotHitAt>180){
          const botPlayer=players.find(p=>p.bot&&Number(p.slot)===targetSlot);
          if(botPlayer){
            lastBotHitAt=now;botLives=Math.max(0,botLives-1);
            const bot=peerFor(botPlayer.slot);bot.lives=botLives;updateLives();
            if(botLives<=0){
              if(!pendingBotDefeats.has(Number(botPlayer.slot))){pendingBotDefeats.add(Number(botPlayer.slot));send({type:'bot-defeat',slot:Number(botPlayer.slot),team:0,killerSlot:mySlot,attackKind:'missile'});}
              eliminated.add(Number(botPlayer.slot));matchKills++;matchBotKills++;
              endArena('🏆 ¡VICTORIA!\n🚀 '+playerName(mySlot)+' derrotó a '+playerName(botPlayer.slot),'win');
              return;
            }
          }
        }
        if(!m.own && (!targetSlot||targetSlot===mySlot) && now<evadeUntil){m.life=0;continue;}
        if(!m.own && (!targetSlot||targetSlot===mySlot) && !(pvpMode==='2v2'&&m.ownerTeam&&m.ownerTeam===myTeam) && now-lastHitAt>180){
          lastHitAt=now;lastRegenAt=now;lastAttackerSlot=Number(m.ownerSlot||0);lastAttackKind='missile';meState.lives=Math.max(0,meState.lives-1);updateLives();
          hitFlashUntil=performance.now()+260;hitShakeUntil=performance.now()+180;
          if(meState.lives<=0){send({type:'defeat',slot:mySlot,team:myTeam,killerSlot:lastAttackerSlot||0,attackKind:lastAttackKind||'laser'});if(pvpMode==='2v2'||(pvpMode==='arena'||pvpMode==='arena10')||pvpMode==='arena10'){markEliminated(mySlot);showStatus((pvpMode==='arena'||pvpMode==='arena10')?'👀 Eliminado · observa hasta conocer al ganador.':'👀 Nave eliminada · tu compañero sigue luchando.',true);}else endArena('💥 Tu nave fue destruida.','loss');return;}
        }
      }
    }
    bullets=bullets.filter(b=>b.life>0&&b.x>-20&&b.x<worldWidth+20&&b.y>-20&&b.y<worldHeight+20);
    missiles=missiles.filter(m=>m.life>0&&m.x>-40&&m.x<worldWidth+40&&m.y>-40&&m.y<worldHeight+40);
    // Frecuencia adaptativa: 20 Hz mientras la nave cambia de posición/ángulo
    // y 2 Hz cuando está quieta. Un cambio desde reposo se envía inmediatamente,
    // para conservar la respuesta de las esquivas sin gastar mensajes innecesarios.
    const sx=pvpMode==='1v1'&&mySlot===2?worldWidth-meState.x:meState.x;
    const sy=pvpMode==='1v1'&&mySlot===2?worldHeight-meState.y:meState.y;
    const sa=pvpMode==='1v1'&&mySlot===2?meState.angle+Math.PI:meState.angle;
    const sva=pvpMode==='1v1'&&mySlot===2?meState.visualAngle+Math.PI:meState.visualAngle;
    const stateNow={x:Math.round(sx),y:Math.round(sy),angle:sa,visualAngle:sva,lives:meState.lives};
    const angleDiff=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
    const stateChanged=!lastSentState||Math.abs(stateNow.x-lastSentState.x)>=1||Math.abs(stateNow.y-lastSentState.y)>=1||angleDiff(stateNow.angle,lastSentState.angle)>.015||angleDiff(stateNow.visualAngle,lastSentState.visualAngle)>.015||stateNow.lives!==lastSentState.lives;
    const sendInterval=stateChanged?50:500;
    if((stateChanged&&now-lastStateSend>=16)||now-lastStateSend>=sendInterval){
      lastStateSend=now;lastSentState=stateNow;
      send({type:'state',...stateNow});
      if(botMatch&&(pvpMode==='2v2'||(pvpMode==='arena'||pvpMode==='arena10')||pvpMode==='arena10')){
        const humanSlots=players.filter(p=>!p.bot).map(p=>Number(p.slot)).filter(Boolean);
        if(humanSlots.length===0||mySlot===Math.min(...humanSlots)){
          for(const bp of players.filter(p=>p.bot&&!eliminated.has(Number(p.slot)))){
            const st=peerFor(bp.slot);
            send({type:'bot-state',slot:Number(bp.slot),x:Math.round(st.x),y:Math.round(st.y),angle:st.angle,visualAngle:st.visualAngle});
          }
        }
      }
    }
  }
  const imageCache=new Map();
  function cachedImage(src){if(!imageCache.has(src)){const im=new Image();im.src=src;imageCache.set(src,im);}return imageCache.get(src);}
  function imageFor(label){return cachedImage(shipSrc(label));}
  function drawShip(state,label){
    const im=imageFor(label);arenaCtx.save();arenaCtx.translate(state.x,state.y);arenaCtx.rotate((Number.isFinite(state.visualAngle)?state.visualAngle:state.angle)+Math.PI/2);
    if(im.complete&&im.naturalWidth)arenaCtx.drawImage(im,-26,-26,52,52);else{arenaCtx.fillStyle='#7dd3fc';arenaCtx.beginPath();arenaCtx.arc(0,0,22,0,Math.PI*2);arenaCtx.fill();}
    arenaCtx.restore();
  }
  function cameraPosition(){
    const w=arenaCanvas.width,h=arenaCanvas.height;
    return {
      x:Math.max(0,Math.min(worldWidth-w,meState.x-w/2)),
      y:Math.max(0,Math.min(worldHeight-h,meState.y-h/2))
    };
  }
  function draw(){
    const w=arenaCanvas.width,h=arenaCanvas.height,cam=cameraPosition();
    arenaCtx.clearRect(0,0,w,h);
    arenaCtx.save();
    if(performance.now()<hitShakeUntil) arenaCtx.translate((Math.random()-.5)*7,(Math.random()-.5)*7);
    arenaCtx.translate(-cam.x,-cam.y);
    // El fondo cubre todo el mundo lógico; la cámara sólo muestra la ventana visible.
    if(pvpBackground.complete&&pvpBackground.naturalWidth)arenaCtx.drawImage(pvpBackground,0,0,worldWidth,worldHeight);else{arenaCtx.fillStyle='#020617';arenaCtx.fillRect(0,0,worldWidth,worldHeight);}
    arenaCtx.strokeStyle='rgba(167,139,250,.35)';arenaCtx.setLineDash([8,10]);arenaCtx.beginPath();arenaCtx.moveTo(0,worldHeight/2);arenaCtx.lineTo(worldWidth,worldHeight/2);arenaCtx.stroke();arenaCtx.setLineDash([]);
    // Zona Cósmica de Arena 10: borde visible sobre el mundo y sombreado exterior.
    const drawZoneState=pvpMode==='arena10'?cosmicZoneState(0):null;
    if(drawZoneState?.active){
      arenaCtx.save();
      arenaCtx.fillStyle='rgba(88,28,135,.20)';
      arenaCtx.beginPath();arenaCtx.rect(0,0,worldWidth,worldHeight);
      arenaCtx.arc(drawZoneState.cx,drawZoneState.cy,drawZoneState.radius,0,Math.PI*2,true);
      arenaCtx.fill('evenodd');
      arenaCtx.strokeStyle='rgba(192,132,252,.95)';arenaCtx.lineWidth=7;
      arenaCtx.beginPath();arenaCtx.arc(drawZoneState.cx,drawZoneState.cy,drawZoneState.radius,0,Math.PI*2);arenaCtx.stroke();
      arenaCtx.restore();
    }
    // Asteroides de cobertura usando el PNG del juego.
    const asteroidImage=cachedImage('assets/asteroide_pvp.png');
    for(const a of asteroids){
      if(asteroidImage.complete&&asteroidImage.naturalWidth)arenaCtx.drawImage(asteroidImage,a.x-a.r*1.25,a.y-a.r*1.25,a.r*2.5,a.r*2.5);
      else{arenaCtx.save();arenaCtx.fillStyle='#64748b';arenaCtx.beginPath();arenaCtx.arc(a.x,a.y,a.r,0,Math.PI*2);arenaCtx.fill();arenaCtx.restore();}
    }
    const mine=players.find(p=>Number(p.slot)===mySlot)||{ship:shipLabel()};
    for(const p of players){
      if(Number(p.slot)===mySlot)continue;
      const state=peerFor(p.slot);
      if(eliminated.has(Number(p.slot))) continue;
      if(Number(p.slot)===selectedTargetSlot){
        arenaCtx.save();arenaCtx.strokeStyle='#ef4444';arenaCtx.lineWidth=3;arenaCtx.setLineDash([7,5]);arenaCtx.beginPath();arenaCtx.arc(state.x,state.y,36,0,Math.PI*2);arenaCtx.stroke();arenaCtx.setLineDash([]);arenaCtx.fillStyle='#fecaca';arenaCtx.font='bold 10px sans-serif';arenaCtx.textAlign='center';arenaCtx.fillText('OBJETIVO',state.x,state.y-43);arenaCtx.restore();
      }
      drawShip(state,p.ship||'Gallina');
      // Mostrar también a los rivales el campo de interferencia mientras está activo.
      const remoteEvadeEnd=Number(remoteEvadeUntil.get(Number(p.slot))||0);
      if(performance.now()<remoteEvadeEnd){
        const phase=(performance.now()%700)/700;
        arenaCtx.save();
        for(let i=0;i<3;i++){const q=(phase+i/3)%1;arenaCtx.globalAlpha=.75*(1-q);arenaCtx.strokeStyle='#67e8f9';arenaCtx.lineWidth=3;arenaCtx.beginPath();arenaCtx.arc(state.x,state.y,30+q*34,0,Math.PI*2);arenaCtx.stroke();}
        arenaCtx.restore();
      }
      arenaCtx.save();arenaCtx.font='bold 10px sans-serif';arenaCtx.textAlign='center';
      arenaCtx.fillStyle=pvpMode==='2v2'&&Number(p.team)===myTeam?'#86efac':'#fca5a5';
      arenaCtx.fillText((pvpMode==='2v2'&&Number(p.team)===myTeam?'🤝 ':'⚔️ ')+(p.name||('J'+p.slot)),state.x,state.y-34);arenaCtx.restore();
    }
    if(performance.now()<hitFlashUntil){arenaCtx.save();arenaCtx.globalAlpha=.42;arenaCtx.fillStyle='#fff';arenaCtx.beginPath();arenaCtx.arc(meState.x,meState.y,30,0,Math.PI*2);arenaCtx.fill();arenaCtx.restore();}
    if(!meEliminated) drawShip(meState,mine.ship);
    if(!meEliminated&&performance.now()<evadeUntil){
      const phase=(performance.now()%700)/700;
      arenaCtx.save();
      for(let i=0;i<3;i++){const q=(phase+i/3)%1;arenaCtx.globalAlpha=.75*(1-q);arenaCtx.strokeStyle='#67e8f9';arenaCtx.lineWidth=3;arenaCtx.beginPath();arenaCtx.arc(meState.x,meState.y,30+q*34,0,Math.PI*2);arenaCtx.stroke();}
      arenaCtx.restore();
    }
    if(meEliminated && !matchFinished && (pvpMode==='2v2'||(pvpMode==='arena'||pvpMode==='arena10')||pvpMode==='arena10')){
      arenaCtx.save();arenaCtx.translate(cam.x,cam.y);
      arenaCtx.fillStyle='rgba(2,6,23,.72)';
      arenaCtx.fillRect(45,h/2-48,w-90,96);
      arenaCtx.fillStyle='#ffffff';
      arenaCtx.font='bold 20px sans-serif';
      arenaCtx.textAlign='center';
      arenaCtx.fillText('💥 Has sido eliminado',w/2,h/2-8);
      arenaCtx.font='14px sans-serif';
      arenaCtx.fillStyle='#cbd5e1';
      arenaCtx.fillText((pvpMode==='arena'||pvpMode==='arena10')?'Observa hasta que quede un sobreviviente':'Espera a que termine la partida',w/2,h/2+22);
      arenaCtx.restore();
    }
    for(const b of bullets){
      // Dibujo del láser copiado del modo normal, adaptado a cualquier ángulo del PvP.
      const colors=laserColors(b.ship||'Gallina'), bw=4, bh=20;
      arenaCtx.save();arenaCtx.translate(b.x,b.y);arenaCtx.rotate((Number.isFinite(b.angle)?b.angle:Math.atan2(b.vy,b.vx))+Math.PI/2);
      arenaCtx.fillStyle=colors.inner;arenaCtx.shadowColor=colors.outer;arenaCtx.shadowBlur=8;
      arenaCtx.fillRect(-bw/2,-bh/2,bw,bh);
      arenaCtx.strokeStyle=colors.outer;arenaCtx.lineWidth=1.5;arenaCtx.strokeRect(-bw/2,-bh/2,bw,bh);
      arenaCtx.shadowBlur=0;arenaCtx.restore();
    }
    for(const m of missiles){
      arenaCtx.save();arenaCtx.translate(m.x,m.y);
      const angle=Math.atan2(m.vy,m.vx)+Math.PI/2;arenaCtx.rotate(angle);
      const im=missileImage(m.missileType,m.isPro);
      if(im?.complete&&im.naturalWidth) arenaCtx.drawImage(im,-12,-12,24,24);
      else{
        const icon={chick:'🐥',wool:'🧶',horseshoe:'🧲',milk:'🥛'}[m.missileType]||'🐥';
        arenaCtx.font='22px sans-serif';arenaCtx.textAlign='center';arenaCtx.textBaseline='middle';arenaCtx.fillText(icon,0,0);
      }
      arenaCtx.restore();
    }
    for(const fx of impactFx){
      const t=Math.max(0,fx.life/fx.maxLife),r=7+(1-t)*30;
      arenaCtx.save();arenaCtx.globalAlpha=Math.min(1,t*1.7);
      arenaCtx.fillStyle='#fff';arenaCtx.beginPath();arenaCtx.arc(fx.x,fx.y,7*t+3,0,Math.PI*2);arenaCtx.fill();
      arenaCtx.strokeStyle='#fff';arenaCtx.lineWidth=4;arenaCtx.beginPath();arenaCtx.arc(fx.x,fx.y,r,0,Math.PI*2);arenaCtx.stroke();
      for(let i=0;i<8;i++){const a=i*Math.PI/4,len=10+(1-t)*24;arenaCtx.beginPath();arenaCtx.moveTo(fx.x+Math.cos(a)*8,fx.y+Math.sin(a)*8);arenaCtx.lineTo(fx.x+Math.cos(a)*len,fx.y+Math.sin(a)*len);arenaCtx.stroke();}
      arenaCtx.restore();
    }
    for(const fx of asteroidFx){
      arenaCtx.save();arenaCtx.globalAlpha=Math.max(0,fx.life/fx.maxLife);
      arenaCtx.fillStyle='#94a3b8';arenaCtx.fillRect(fx.x-fx.size/2,fx.y-fx.size/2,fx.size,fx.size);
      arenaCtx.restore();
    }
    // Minimapa completo en todos los modos. En Arena 10 se ve todo el mundo
    // y la posición propia, pero sólo se revelan rivales dentro de 500 unidades.
    arenaCtx.save();arenaCtx.translate(cam.x,cam.y);
    const mapW=112,mapH=112,mapX=w-mapW-12,mapY=12,sx=mapW/worldWidth,sy=mapH/worldHeight;
    const limitedEnemies=pvpMode==='arena10', radarRadius=700;
    arenaCtx.fillStyle='rgba(2,6,23,.78)';arenaCtx.fillRect(mapX,mapY,mapW,mapH);
    arenaCtx.strokeStyle='rgba(148,163,184,.75)';arenaCtx.lineWidth=1;arenaCtx.strokeRect(mapX,mapY,mapW,mapH);
    arenaCtx.save();arenaCtx.beginPath();arenaCtx.rect(mapX,mapY,mapW,mapH);arenaCtx.clip();
    // El mapa y sus asteroides permanecen visibles completos.
    arenaCtx.fillStyle='rgba(148,163,184,.8)';
    for(const a of asteroids){arenaCtx.beginPath();arenaCtx.arc(mapX+a.x*sx,mapY+a.y*sy,2.2,0,Math.PI*2);arenaCtx.fill();}
    if(drawZoneState?.active){
      arenaCtx.strokeStyle='rgba(216,180,254,.95)';arenaCtx.lineWidth=1.5;
      arenaCtx.beginPath();arenaCtx.ellipse(mapX+drawZoneState.cx*sx,mapY+drawZoneState.cy*sy,drawZoneState.radius*sx,drawZoneState.radius*sy,0,0,Math.PI*2);arenaCtx.stroke();
    }
    // Posición real del jugador dentro del mapa completo.
    const mx=mapX+meState.x*sx,my=mapY+meState.y*sy;
    arenaCtx.fillStyle='#ffffff';arenaCtx.beginPath();arenaCtx.arc(mx,my,3.5,0,Math.PI*2);arenaCtx.fill();
    for(const p of players){
      const slot=Number(p.slot);if(slot===mySlot||eliminated.has(slot))continue;
      const st=peerFor(slot);
      const ally=pvpMode==='2v2'&&Number(p.team)===myTeam;
      // Arena 10: los puntos enemigos sólo se revelan dentro de 500 unidades.
      if(limitedEnemies&&!ally&&Math.hypot(st.x-meState.x,st.y-meState.y)>radarRadius)continue;
      const px=mapX+st.x*sx,py=mapY+st.y*sy;
      arenaCtx.fillStyle=ally?'#3b82f6':'#ef4444';
      arenaCtx.beginPath();arenaCtx.arc(px,py,3.2,0,Math.PI*2);arenaCtx.fill();
      if(slot===selectedTargetSlot){arenaCtx.strokeStyle='#ffffff';arenaCtx.lineWidth=1.5;arenaCtx.beginPath();arenaCtx.arc(px,py,5.5,0,Math.PI*2);arenaCtx.stroke();}
    }
    arenaCtx.restore();
    arenaCtx.fillStyle='rgba(255,255,255,.85)';arenaCtx.font='bold 8px sans-serif';arenaCtx.textAlign='left';
    const zoneWait=Math.max(0,Math.ceil(COSMIC_ZONE_GRACE-cosmicZoneElapsed));
    arenaCtx.fillText(limitedEnemies?(drawZoneState?.active?'RADAR 700 · ZONA':'RADAR 700'+(zoneWait>0?' · ZONA '+zoneWait+'s':'')):'RADAR',mapX+5,mapY+10);
    arenaCtx.restore();

    // Kill Feed visual: sólo informa eventos confirmados; no modifica combate ni resultados.
    const feedNow=performance.now();
    while(killFeed.length&&killFeed[0].until<=feedNow)killFeed.shift();
    if(killFeed.length){
      arenaCtx.save();arenaCtx.translate(cam.x,cam.y);
      arenaCtx.font='bold 11px sans-serif';
      arenaCtx.textAlign='left';arenaCtx.textBaseline='middle';
      killFeed.forEach((item,i)=>{
        const y=58+i*27,wBox=Math.min(w-24,Math.max(180,arenaCtx.measureText(item.text).width+24));
        arenaCtx.fillStyle='rgba(2,6,23,.78)';arenaCtx.fillRect(10,y-11,wBox,22);
        arenaCtx.strokeStyle='rgba(125,211,252,.45)';arenaCtx.strokeRect(10,y-11,wBox,22);
        arenaCtx.fillStyle='#fff';arenaCtx.fillText(item.text,20,y);
      });
      arenaCtx.restore();
    }
    arenaCtx.restore();
  }

  function stickSetup(el,stick,fire){
    const knob=el?.querySelector('.pvp-stick-knob'); if(!el||!knob)return;
    const move=e=>{if(!stick.active||e.pointerId!==stick.id)return;const r=el.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),m=Math.min(r.width*.34,Math.hypot(dx,dy)),a=Math.atan2(dy,dx);stick.x=Math.cos(a)*(m/(r.width*.34));stick.y=Math.sin(a)*(m/(r.width*.34));knob.style.transform=`translate(${stick.x*30}px,${stick.y*30}px)`;if(fire&&Math.hypot(stick.x,stick.y)>.25)shoot();};
    el.addEventListener('pointerdown',e=>{stick.active=true;stick.id=e.pointerId;el.setPointerCapture(e.pointerId);move(e);});
    el.addEventListener('pointermove',move);
    const end=e=>{if(e.pointerId!==stick.id)return;stick.active=false;stick.id=null;stick.x=stick.y=0;knob.style.transform='translate(0,0)';};
    el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
  }
  const PVP_CONTROL_IDS=['pvpMoveStick','pvpFireBtn','pvpMissileBtn','pvpEvadeBtn'];
  const PVP_CONTROLS_KEY='gallina_pvp_controls_v1';
  const defaultControlStyle={
    pvpMoveStick:{left:'22px',right:'auto',top:'auto',bottom:'max(24px,env(safe-area-inset-bottom))'},
    pvpFireBtn:{left:'auto',right:'22px',top:'auto',bottom:'max(24px,env(safe-area-inset-bottom))'},
    pvpMissileBtn:{left:'auto',right:'28px',top:'auto',bottom:'max(145px,calc(env(safe-area-inset-bottom) + 145px))'},
    pvpEvadeBtn:{left:'auto',right:'31px',top:'auto',bottom:'max(225px,calc(env(safe-area-inset-bottom) + 225px))'}
  };
  function applyPvpControlLayout(layout){PVP_CONTROL_IDS.forEach(id=>{const el=$(id),p=layout?.[id];if(!el||!p)return;el.style.left=p.left;el.style.top=p.top;el.style.right='auto';el.style.bottom='auto';});}
  function loadPvpControlLayout(){try{const v=JSON.parse(localStorage.getItem(PVP_CONTROLS_KEY)||'null');if(v)applyPvpControlLayout(v);}catch{}}
  function savePvpControlLayout(){const a=arena.getBoundingClientRect(),layout={};PVP_CONTROL_IDS.forEach(id=>{const el=$(id);if(!el)return;const r=el.getBoundingClientRect();layout[id]={left:Math.max(0,r.left-a.left)+'px',top:Math.max(0,r.top-a.top)+'px'};});localStorage.setItem(PVP_CONTROLS_KEY,JSON.stringify(layout));applyPvpControlLayout(layout);}
  function resetPvpControlLayout(){localStorage.removeItem(PVP_CONTROLS_KEY);PVP_CONTROL_IDS.forEach(id=>{const el=$(id),p=defaultControlStyle[id];if(el)Object.assign(el.style,p);});}
  let controlsEditing=false,controlDrag=null;
  function openControlsEditor(){
    // No abrir el editor mientras matchmaking está activo. Desconectarlo aquí
    // podía dejar al jugador dentro de una sala sin forma de volver a la partida.
    if(queueStartedAt || socket?.readyState===WebSocket.OPEN){
      showStatus(queueStartedAt?'🔒 Cancela la búsqueda antes de ajustar los controles.':'🔒 No puedes ajustar controles mientras estás conectado a una partida.');
      return;
    }
    disconnect(true);lobby.style.display='none';arena.style.display='flex';controlsEditing=true;$('pvpControlsEditor').style.display='block';$('pvpLeaveArenaBtn').style.display='none';$('pvpEvadeBtn').style.display=gameStats?.pvpEvade?'block':'none';loadPvpControlLayout();
  }
  function closeControlsEditor(save=true){if(save)savePvpControlLayout();controlsEditing=false;controlDrag=null;$('pvpControlsEditor').style.display='none';$('pvpLeaveArenaBtn').style.display='block';arena.style.display='none';lobby.style.display='flex';}
  PVP_CONTROL_IDS.forEach(id=>{const el=$(id);if(!el)return;el.addEventListener('pointerdown',e=>{if(!controlsEditing)return;e.preventDefault();e.stopImmediatePropagation();const a=arena.getBoundingClientRect(),r=el.getBoundingClientRect();controlDrag={el,id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top,a};try{el.setPointerCapture(e.pointerId);}catch{};},{capture:true});el.addEventListener('pointermove',e=>{if(!controlsEditing||!controlDrag||controlDrag.el!==el||controlDrag.id!==e.pointerId)return;e.preventDefault();const a=arena.getBoundingClientRect(),w=el.offsetWidth,h=el.offsetHeight;const left=Math.max(0,Math.min(a.width-w,e.clientX-a.left-controlDrag.dx)),top=Math.max(0,Math.min(a.height-h,e.clientY-a.top-controlDrag.dy));el.style.left=left+'px';el.style.top=top+'px';el.style.right='auto';el.style.bottom='auto';},{capture:true});const end=e=>{if(controlDrag?.el===el&&controlDrag.id===e.pointerId)controlDrag=null;};el.addEventListener('pointerup',end,{capture:true});el.addEventListener('pointercancel',end,{capture:true});});
  loadPvpControlLayout();
  stickSetup($('pvpMoveStick'),moveStick,false);
  const fireBtn=$('pvpFireBtn');
  if(fireBtn){fireBtn.style.touchAction='none';fireBtn.addEventListener('pointerdown',e=>{e.preventDefault();shoot();});}
  arenaCanvas?.addEventListener('pointerdown',e=>{
    if(!running||meEliminated)return;
    const r=arenaCanvas.getBoundingClientRect(),cam=cameraPosition();
    const x=cam.x+(e.clientX-r.left)*arenaCanvas.width/r.width,y=cam.y+(e.clientY-r.top)*arenaCanvas.height/r.height;
    const enemies=players.filter(p=>Number(p.slot)!==mySlot&&!eliminated.has(Number(p.slot))&&(pvpMode!=='2v2'||Number(p.team)!==myTeam));
    const hit=enemies.map(p=>({p,state:peerFor(p.slot),d:Math.hypot(peerFor(p.slot).x-x,peerFor(p.slot).y-y)})).filter(v=>v.d<=48&&performance.now()>=Number(remoteEvadeUntil.get(Number(v.p.slot))||0)).sort((a,b)=>a.d-b.d)[0];
    if(hit){
      if(!inLockRange(meState,hit.state)){showStatus('📡 Enemigo fuera del alcance de fijación.');return;}
      selectedTargetSlot=Number(hit.p.slot);showStatus('🎯 Objetivo: '+playerName(selectedTargetSlot),true);
    }
  });
  function updateEvadeButton(now=performance.now()){
    const btn=$('pvpEvadeBtn'),label=$('pvpEvadeCooldown');if(!btn||!label)return;
    const owned=!!gameStats?.pvpEvade;btn.style.display=owned?'block':'none';if(!owned)return;
    const left=Math.max(0,PVP_EVADE_COOLDOWN-(now-lastEvade));btn.disabled=!running||meEliminated||left>0;
    label.textContent=left>0?Math.ceil(left/1000)+'s':'EVADIR';
  }
  function activateEvade(){
    const now=performance.now();if(!gameStats?.pvpEvade||!running||meEliminated||now-lastEvade<PVP_EVADE_COOLDOWN)return;
    lastEvade=now;evadeUntil=now+PVP_EVADE_DURATION;
    // El campo corta inmediatamente cualquier ataque de bot que ya estuviera fijado.
    for(const b of bullets){if(!b.own&&Number(b.targetSlot||0)===mySlot)b.life=0;}
    for(const m of missiles){if(!m.own&&(!Number(m.targetSlot||0)||Number(m.targetSlot)===mySlot))m.life=0;}
    send({type:'evade'});showStatus('🌀 Campo de interferencia activo · 2 s sin fijación.',true);updateEvadeButton(now);
  }
  const evadeBtn=$('pvpEvadeBtn');if(evadeBtn){evadeBtn.style.touchAction='none';evadeBtn.addEventListener('pointerdown',e=>{e.preventDefault();activateEvade();});}
  const missileBtn=$('pvpMissileBtn');
  if(missileBtn){
    // En móvil pointerdown responde inmediatamente y evita que un pequeño arrastre cancele el click.
    missileBtn.style.touchAction='none';
    missileBtn.addEventListener('pointerdown',e=>{
      if(missilePointerLock)return;
      missilePointerLock=true;
      e.preventDefault();
      try{missileBtn.setPointerCapture?.(e.pointerId);}catch{}
      fireMissile();
    });
    const releaseMissilePointer=()=>{missilePointerLock=false;};
    missileBtn.addEventListener('pointerup',releaseMissilePointer);
    missileBtn.addEventListener('pointercancel',releaseMissilePointer);
    missileBtn.addEventListener('lostpointercapture',releaseMissilePointer);
  }
  window.addEventListener('keydown',e=>{keys.add(e.key);if(e.key===' ')e.preventDefault();});
  window.addEventListener('keyup',e=>keys.delete(e.key));

  $('openPvpBtn')?.addEventListener('click',()=>{
    document.querySelectorAll('.screen-overlay').forEach(el=>el.style.display='none');lobby.style.display='flex';
    const me=identity();$('pvpPlayerName').textContent=me.name||'Jugador';$('pvpShipName').textContent=shipLabel();syncPvpRankSummary();showStatus('Modo 2v2 seleccionado · se necesitan 4 jugadores.');
  });
  document.querySelectorAll('.pvp-mode-btn').forEach(btn=>btn.addEventListener('click',()=>{
    // No permitir cambiar de modo mientras la cola está activa: antes este click
    // reemplazaba el contador de matchmaking por "Modo 2v2..." aunque la búsqueda
    // seguía corriendo (botón todavía decía Cancelar búsqueda).
    if(queueStartedAt){
      updateQueueStatus();
      return;
    }
    pvpMode=btn.dataset.mode||'1v1';
    document.querySelectorAll('.pvp-mode-btn').forEach(b=>b.style.background=b===btn?'#7c3aed':'#475569');
    const find=$('pvpFindMatchBtn');
    if(find) find.textContent=queueButtonLabel();
    showStatus(pvpMode==='2v2'?'Modo 2v2 · 4 jugadores, sin fuego amigo.':pvpMode==='arena10'?'Modo Arena 10 · mapa 5×5, todos contra todos.':pvpMode==='arena'?'Modo Arena 5 · todos contra todos.':'Modo 1v1.');
  }));
  function pvpRank(cups){
    cups=Math.max(0,Number(cups)||0);
    if(cups>=12000)return '🌌 Leyenda Galáctica';
    if(cups>=7000)return '🚀 Maestro Cósmico';
    if(cups>=3000)return '💎 Diamante';
    if(cups>=1000)return '🥇 Oro';
    if(cups>=500)return '🥈 Plata';
    if(cups>=200)return '🥉 Bronce';
    return '🥚 Novato';
  }
  async function showPvpRanking(){
    const panel=$('pvpRankingPanel'),list=$('pvpRankingList'),mine=$('pvpMyRecord');
    if(!panel||!list||!mine)return;
    panel.style.display='block';list.textContent='Cargando…';mine.textContent='Cargando tu récord…';
    const rewardBox=$('pvpRankingReward'); if(rewardBox)rewardBox.style.display='none';
    try{
      const r=await fetch(PVP_HTTP_BASE+'/ranking?playerId='+encodeURIComponent(playerId()),{cache:'no-store'}),data=await r.json();
      if(!data?.ok||!Array.isArray(data.ranking))throw new Error('ranking');
      const ranking=data.ranking,meId=playerId(),myIndex=ranking.findIndex(x=>String(x.playerId)===meId),my=myIndex>=0?ranking[myIndex]:data.record;
      mine.textContent=my?'🏆 #'+(myIndex>=0?myIndex+1:'—')+' · '+Number(my.cups||0)+' copas · '+pvpRank(my.cups)+'\n☠️ '+Number(my.kills||0)+' · ✅ '+Number(my.wins||0)+' / ❌ '+Number(my.losses||0):'🏆 Aún no tienes partidas PvP.';
      list.replaceChildren();
      if(!ranking.length){list.textContent='Todavía no hay jugadores en el ranking.';return;}
      ranking.slice(0,100).forEach((p,i)=>{
        const row=document.createElement('div');
        row.style.cssText='display:grid;grid-template-columns:32px 1fr auto;gap:6px;padding:7px 3px;border-top:1px solid rgba(148,163,184,.18);align-items:center;';
        const pos=document.createElement('span'),name=document.createElement('span'),cups=document.createElement('span');
        pos.textContent=i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1);
        name.textContent=String(p.name||'Jugador')+' · '+pvpRank(p.cups);
        cups.textContent='🏆 '+Number(p.cups||0);
        if(String(p.playerId)===meId)row.style.fontWeight='bold';
        row.append(pos,name,cups);list.appendChild(row);
      });
    }catch{mine.textContent='No se pudo cargar el récord.';list.textContent='Intenta nuevamente en unos segundos.';}
  }
  window.openPvpRankingMenu = showPvpRanking;
  $('pvpRankingBtn')?.addEventListener('click',showPvpRanking);
  $('pvpRankingCloseBtn')?.addEventListener('click',()=>{const p=$('pvpRankingPanel');if(p)p.style.display='none';});
  $('pvpControlsBtn')?.addEventListener('click',openControlsEditor);
  $('pvpControlsSaveBtn')?.addEventListener('click',()=>closeControlsEditor(true));
  $('pvpControlsResetBtn')?.addEventListener('click',()=>{resetPvpControlLayout();});
  $('pvpFindMatchBtn')?.addEventListener('click',()=>{unlockPvpMusic();findMatch();});
  $('pvpCreateRoomBtn')?.addEventListener('click',()=>{unlockPvpMusic();const c=randomCode();roomInput.value=c;connect(c,true);});
  $('pvpJoinRoomBtn')?.addEventListener('click',()=>{unlockPvpMusic();connect(roomInput.value,false);});
  roomInput?.addEventListener('input',()=>roomInput.value=String(roomInput.value||'').replace(/\D/g,'').slice(0,6));
  $('pvpCloseBtn')?.addEventListener('click',()=>{disconnect(true);lobby.style.display='none';$('startScreen').style.display='flex';});
  $('pvpLeaveArenaBtn')?.addEventListener('click',()=>{
    // Abandono voluntario: penalizacion inmediata de -15 copas, una sola vez por sala.
    const inBattle=running||countdownActive,forfeitMatchId=currentRoom+'-'+pvpMode;
    if(socket?.readyState===WebSocket.OPEN && inBattle) send({type:'defeat',reason:'forfeit',slot:mySlot,team:myTeam,rewardEligible:false});
    if(inBattle&&!matchCupsSettled){matchCupsSettled=true;settlePvpRecord('forfeit',forfeitMatchId);}
    disconnect(true);arena.style.display='none';$('startScreen').style.display='flex';
  });
  $('pvpResultBackBtn')?.addEventListener('click',()=>{disconnect(true);arena.style.display='none';$('startScreen').style.display='flex';});

  window.GallinaPvp={get connected(){return socket?.readyState===WebSocket.OPEN;},get roomCode(){return currentRoom;},get slot(){return mySlot;},send,disconnect};
})();

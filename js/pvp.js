/* PvP experimental 0.3: lobby + arena 1v1 sincronizada por WebSocket. */
(() => {
  const PVP_TEST_MODE = true;
  const PVP_WS_BASE = 'wss://gallina-cosmica-pvp.jairog940.workers.dev';
  if (!PVP_TEST_MODE) return;

  const $ = id => document.getElementById(id);
  const lobby = $('pvpLobbyScreen');
  const arena = $('pvpArenaScreen');
  const arenaCanvas = $('pvpCanvas');
  const arenaCtx = arenaCanvas?.getContext('2d');
  const status = $('pvpLobbyStatus');
  const roomInput = $('pvpRoomCode');

  let socket = null, queueSocket = null, currentRoom = '', mySlot = 0, players = [];
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
  let running = false, countdownActive = false, countdownTimer = 0, raf = 0, lastFrame = 0, lastStateSend = 0, lastShot = 0, lastHitAt = 0, lastMissile = -Infinity, missilePointerLock = false;
  const keys = new Set();
  const meState = { x: 210, y: 560, lives: 10, angle: -Math.PI / 2, visualAngle: -Math.PI / 2 };
  const peerState = { x: 210, y: 80, lives: 10, angle: Math.PI / 2, visualAngle: Math.PI / 2 };
  let bullets = [];
  let missiles = [];
  let impactFx = [];
  let hitFlashUntil = 0;
  let hitShakeUntil = 0;
  const moveStick = { active:false, id:null, x:0, y:0 };
  const aimStick = { active:false, id:null, x:0, y:0 };

  function identity(){ return window.GallinaPlayerIdentity?.getCurrent?.() || {id:null,name:'Jugador'}; }
  function currentGameStats(){
    // gameStats se declara con let en estado.js y no es propiedad de window.
    // Acceder directamente permite que PvP use la nave realmente equipada.
    try { return gameStats || {}; } catch { return {}; }
  }
  function shipLabel(){
    const names=['Gallina','Oveja','Caballo','Vaca'];
    const stats=currentGameStats();
    const i=Number(stats.selectedShip ?? 0);
    if(stats.useGallinaChile) return 'Gallina Chile';
    return (names[i]||'Gallina')+(stats.useProShip?' Pro':'');
  }
  function shipSrc(label){
    if(label==='Gallina Chile') return 'assets/gallina_chile.png';
    const pro=/ Pro$/.test(label);
    const base=label.replace(/ Pro$/,'').toLowerCase();
    return 'assets/'+base+(pro?'_pro':'')+'_1.png';
  }
  function shipCombatInfo(label){
    const base=String(label||'Gallina').replace(/ Pro$/,'');
    const index={Gallina:0,'Gallina Chile':0,Oveja:1,Caballo:2,Vaca:3}[base] ?? 0;
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
  function showStatus(text,ok=false){ if(status){status.textContent=text;status.style.color=ok?'#86efac':'#cbd5e1';} }
  function stopQueueTimer(){
    if(queueTimer){clearInterval(queueTimer);queueTimer=0;}
    queueStartedAt=0;
    const btn=$('pvpFindMatchBtn'); if(btn)btn.textContent='⚔️ Buscar rival';
  }
  function updateQueueStatus(){
    if(!queueSocket||!queueStartedAt)return;
    const sec=Math.max(0,Math.floor((Date.now()-queueStartedAt)/1000));
    const mm=String(Math.floor(sec/60)).padStart(2,'0'), ss=String(sec%60).padStart(2,'0');
    showStatus('🔎 Buscando rival… '+mm+':'+ss,true);
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
    stopArena();
    if(queueSocket){const q=queueSocket;queueSocket=null;try{q.close(1000,'leaving');}catch{}}
    stopQueueTimer();
    if(socket){const old=socket;socket=null;try{old.close(1000,'leaving');}catch{}}
    currentRoom='';mySlot=0;players=[];
    if(!silent)showStatus('Desconectado de la sala.');
  }

  function findMatch(){
    if(queueSocket){cancelMatch();return;}
    disconnect(true);
    const me=identity();
    const params=new URLSearchParams({playerId:playerId(),name:me.name||'Jugador',ship:shipLabel()});
    const ws=new WebSocket(`${PVP_WS_BASE}/matchmake?${params}`);
    queueSocket=ws;
    queueStartedAt=Date.now();
    const findBtn=$('pvpFindMatchBtn'); if(findBtn)findBtn.textContent='✖️ Cancelar búsqueda';
    updateQueueStatus(); queueTimer=setInterval(updateQueueStatus,1000);
    ws.addEventListener('message',event=>{
      if(queueSocket!==ws)return;
      let m;try{m=JSON.parse(event.data);}catch{return;}
      if(m.type==='queue-waiting'){
        updateQueueStatus();
      } else if(m.type==='match-found' && /^\d{6}$/.test(String(m.roomCode||''))){
        const code=String(m.roomCode);
        queueSocket=null;
        stopQueueTimer();
        try{ws.close(1000,'matched');}catch{}
        showStatus('⚔️ ¡Rival encontrado! Entrando a la partida…',true);
        setTimeout(()=>connect(code,false),120);
      }
    });
    ws.addEventListener('close',e=>{
      if(queueSocket===ws){
        queueSocket=null;
        stopQueueTimer();
        if(e.code!==1000)showStatus('La búsqueda se interrumpió. Intenta nuevamente.');
      }
    });
    ws.addEventListener('error',()=>{if(queueSocket===ws)showStatus('No se pudo conectar a la cola PvP.');});
  }

  function connect(code,creating=false){
    code=String(code||'').replace(/\D/g,'').slice(0,6); roomInput.value=code;
    if(code.length!==6)return showStatus('Escribe un código de sala de 6 dígitos.');
    disconnect(true);
    const me=identity();
    const params=new URLSearchParams({playerId:playerId(),name:me.name||'Jugador',ship:shipLabel()});
    const ws=new WebSocket(`${PVP_WS_BASE}/room/${code}?${params}`);
    socket=ws;currentRoom=code;
    showStatus((creating?'Creando':'Entrando a')+' sala '+code+'…');
    ws.addEventListener('open',()=>{if(socket===ws)showStatus('Conectado a sala '+code+'. Esperando rival…',true);});
    ws.addEventListener('message',event=>{
      if(socket!==ws)return;
      let m;try{m=JSON.parse(event.data);}catch{return;}
      if(m.type==='joined'){
        players=m.players||[]; const mine=players.find(p=>String(p.playerId)===playerId());
        mySlot=Number(mine?.slot||0);
        showStatus('Sala '+code+' · Jugador '+(mySlot||'?')+(players.length<2?' · esperando rival…':''),true);
      } else if(m.type==='player-joined') {
        showStatus('¡Rival conectado! Preparando partida…',true);
      } else if(m.type==='ready') {
        players=m.players||players;
        const rival=players.find(p=>Number(p.slot)!==mySlot);
        showStatus('⚔️ ¡Sala lista! Rival: '+(rival?.name||'Jugador')+' · '+(rival?.ship||'Nave'),true);
        setTimeout(()=>startArena(),450);
      } else if(m.type==='player-left') {
        if(running) endArena('El rival salió de la partida.');
        else showStatus('El rival salió. Esperando otro jugador…');
      } else if(m.type==='peer-message') {
        handlePeer(m.payload||{});
      }
    });
    ws.addEventListener('close',e=>{if(socket===ws){socket=null;if(e.code!==1000){if(running)endArena('Se perdió la conexión.');else showStatus('Se perdió la conexión con la sala.');}}});
    ws.addEventListener('error',()=>{if(socket===ws)showStatus('No se pudo conectar al servidor PvP.');});
  }

  function resetArena(){
    const h=arenaCanvas.height,w=arenaCanvas.width;
    // Cada dispositivo juega desde abajo. El slot 2 se transforma al enviar/recibir.
    meState.x=w/2; meState.y=h-90; meState.lives=10; meState.angle=-Math.PI/2; meState.visualAngle=-Math.PI/2;
    peerState.x=w/2;peerState.y=90;peerState.lives=10;peerState.angle=Math.PI/2;peerState.visualAngle=Math.PI/2;
    bullets=[]; missiles=[]; lastMissile=-Infinity; impactFx=[]; hitFlashUntil=0; hitShakeUntil=0; lastHitAt=0; $('pvpResult').style.display='none';
    $('pvpRoomHud').textContent='Sala '+currentRoom;
    updateLives();
  }
  function startArena(){
    if(!arenaCanvas||!arenaCtx||running||countdownActive)return;
    lobby.style.display='none'; arena.style.display='flex'; resetArena(); startPvpMusic();
    const overlay=$('pvpCountdown'), label=$('pvpCountdownText');
    countdownActive=true; let count=3;
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
    running=false;countdownActive=false; stopPvpMusic();
    if(countdownTimer){clearInterval(countdownTimer);countdownTimer=0;}
    const overlay=$('pvpCountdown');if(overlay)overlay.style.display='none';
    if(raf)cancelAnimationFrame(raf);raf=0;moveStick.active=false;aimStick.active=false;
  }
  function endArena(text){
    stopArena(); $('pvpResultText').textContent=text; $('pvpResult').style.display='flex';
  }
  function updateLives(){
    $('pvpMyLives').textContent='❤️ x'+Math.max(0,meState.lives);
    $('pvpRivalLives').textContent='❤️ x'+Math.max(0,peerState.lives);
  }
  function handlePeer(p){
    // El servidor reenvía las coordenadas en el sistema local del emisor.
    // El jugador 2 ve la arena rotada 180°, así ambos juegan desde abajo.
    const mirrorX = x => mySlot === 2 ? arenaCanvas.width - x : x;
    const mirrorY = y => mySlot === 2 ? arenaCanvas.height - y : y;
    const mirrorAngle = a => mySlot === 2 ? a + Math.PI : a;
    if(p.type==='state'){
      const px=Number(p.x), py=Number(p.y), pa=Number(p.angle);
      if(Number.isFinite(px)) peerState.x=mirrorX(px);
      if(Number.isFinite(py)) peerState.y=mirrorY(py);
      if(Number.isFinite(pa)) peerState.angle=mirrorAngle(pa);
      const pva=Number(p.visualAngle);
      if(Number.isFinite(pva)) peerState.visualAngle=mirrorAngle(pva);
      peerState.lives=Number.isFinite(Number(p.lives))?Number(p.lives):peerState.lives;updateLives();
    } else if(p.type==='shot'){
      spawnRemoteShot(mirrorX(Number(p.x)),mirrorY(Number(p.y)),mirrorAngle(Number(p.angle)),p.ship);
    } else if(p.type==='missile'){
      spawnRemoteMissile(mirrorX(Number(p.x)),mirrorY(Number(p.y)),p.ship,p.missileType,p.isPro);
    } else if(p.type==='defeat') {
      endArena('🏆 ¡Victoria! Destruiste la nave rival.');
    }
  }

  function shoot(){
    const now=performance.now();if(!running||now-lastShot<330)return;lastShot=now;
    const a=meState.angle,sideX=Math.cos(a+Math.PI/2)*9,sideY=Math.sin(a+Math.PI/2)*9;
    const myShip=(players.find(p=>Number(p.slot)===mySlot)||{ship:shipLabel()}).ship;
    // Mismo láser del juego normal: 4x20 y velocidad equivalente a 14 px/frame a 60 FPS.
    [-1,1].forEach(s=>bullets.push({x:meState.x+sideX*s,y:meState.y+sideY*s,vx:Math.cos(a)*840,vy:Math.sin(a)*840,angle:a,ship:myShip,own:true,life:1.5}));
    const sx=mySlot===2?arenaCanvas.width-meState.x:meState.x;
    const sy=mySlot===2?arenaCanvas.height-meState.y:meState.y;
    const sa=mySlot===2?a+Math.PI:a;
    send({type:'shot',x:sx,y:sy,angle:sa,ship:myShip});
  }
  function spawnRemoteShot(x,y,a,ship){
    if(!Number.isFinite(x+y+a))return;
    const sideX=Math.cos(a+Math.PI/2)*9,sideY=Math.sin(a+Math.PI/2)*9;
    [-1,1].forEach(s=>{const bx=x+sideX*s,by=y+sideY*s;bullets.push({x:bx,y:by,prevX:bx,prevY:by,vx:Math.cos(a)*840,vy:Math.sin(a)*840,angle:a,ship:ship||'Gallina',own:false,life:1.5});});
  }
  function fireMissile(){
    const now=performance.now();
    if(!running)return;
    // La misma constante controla tanto el HUD como el disparo para que LISTO siempre signifique que puede disparar.
    if(now-lastMissile<PVP_MISSILE_COOLDOWN)return;
    lastMissile=now;
    const myShip=(players.find(p=>Number(p.slot)===mySlot)||{ship:shipLabel()}).ship;
    const info=shipCombatInfo(myShip), stats=currentGameStats();
    // Igual que el modo normal: el misil Pro sólo se usa si la nave es Pro y ese misil fue desbloqueado.
    const usePro=info.isPro && !!stats.proMissiles?.[info.index];
    const speed=450, initialSpeed=300, a=meState.angle;
    missiles.push({x:meState.x,y:meState.y,prevX:meState.x,prevY:meState.y,own:true,ship:myShip,missileType:info.missileType,isPro:usePro,life:6,vx:Math.cos(a)*initialSpeed,vy:Math.sin(a)*initialSpeed,speed});
    const sx=mySlot===2?arenaCanvas.width-meState.x:meState.x;
    const sy=mySlot===2?arenaCanvas.height-meState.y:meState.y;
    send({type:'missile',x:sx,y:sy,ship:myShip,missileType:info.missileType,isPro:usePro});
  }
  function spawnRemoteMissile(x,y,ship,missileType,isPro){
    if(!Number.isFinite(x+y))return;
    const info=shipCombatInfo(ship||'Gallina');
    // En la vista remota el rival parte apuntando hacia abajo.
    missiles.push({x,y,prevX:x,prevY:y,own:false,ship:ship||'Gallina',missileType:missileType||info.missileType,isPro:!!isPro,life:6,vx:0,vy:300,speed:450});
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
  function update(dt,now){
    let mx=moveStick.x,my=moveStick.y;
    if(keys.has('ArrowLeft')||keys.has('a'))mx-=1;if(keys.has('ArrowRight')||keys.has('d'))mx+=1;
    if(keys.has('ArrowUp')||keys.has('w'))my-=1;if(keys.has('ArrowDown')||keys.has('s'))my+=1;
    const len=Math.hypot(mx,my);if(len>1){mx/=len;my/=len;}
    if(Math.hypot(mx,my)>.12) meState.visualAngle=Math.atan2(my,mx);
    meState.x=Math.max(30,Math.min(arenaCanvas.width-30,meState.x+mx*190*dt));
    meState.y=Math.max(55,Math.min(arenaCanvas.height-55,meState.y+my*190*dt));
    if(aimStick.active&&Math.hypot(aimStick.x,aimStick.y)>.25){meState.angle=Math.atan2(aimStick.y,aimStick.x);shoot();}
    if(keys.has(' '))shoot();

    for(const b of bullets){b.prevX=b.x;b.prevY=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;}
    for(const m of missiles){
      m.prevX=m.x;m.prevY=m.y;
      const target=m.own?peerState:meState;
      // Misma persecución del modo normal: la velocidad se interpola 8% por frame hacia el objetivo.
      const angle=Math.atan2(target.y-m.y,target.x-m.x);
      const follow=1-Math.pow(0.92,dt*60);
      m.vx+=(Math.cos(angle)*m.speed-m.vx)*follow;
      m.vy+=(Math.sin(angle)*m.speed-m.vy)*follow;
      m.x+=m.vx*dt;m.y+=m.vy*dt;m.life-=dt;
    }
    updateMissileButton(now);
    for(const fx of impactFx)fx.life-=dt;
    impactFx=impactFx.filter(fx=>fx.life>0);
    // Impacto del disparo propio contra la nave rival. Antes el cliente sólo
    // comprobaba los proyectiles recibidos contra SU propia nave; por eso en
    // la pantalla del tirador la bala podía dibujarse atravesando al rival.
    // Ahora el proyectil propio se corta visualmente al cruzar la nave rival.
    for(const b of bullets){
      if(!b.own||b.life<=0)continue;
      const ax=Number.isFinite(b.prevX)?b.prevX:b.x, ay=Number.isFinite(b.prevY)?b.prevY:b.y;
      const dx=b.x-ax,dy=b.y-ay,den=dx*dx+dy*dy;
      const t=den>0?Math.max(0,Math.min(1,((peerState.x-ax)*dx+(peerState.y-ay)*dy)/den)):0;
      const hitX=ax+dx*t,hitY=ay+dy*t;
      if(Math.hypot(hitX-peerState.x,hitY-peerState.y)<30){
        b.life=0;b.x=hitX;b.y=hitY;
        impactFx.push({x:hitX,y:hitY,life:.32,maxLife:.32});
      }
    }

    // Daño real: cada dispositivo sigue siendo autoridad de sus propias vidas.
    // La comprobación continua evita que una bala recibida salte la nave entre frames.
    for(const b of bullets){
      if(b.own||b.life<=0)continue;
      const ax=Number.isFinite(b.prevX)?b.prevX:b.x, ay=Number.isFinite(b.prevY)?b.prevY:b.y;
      const dx=b.x-ax,dy=b.y-ay,den=dx*dx+dy*dy;
      const t=den>0?Math.max(0,Math.min(1,((meState.x-ax)*dx+(meState.y-ay)*dy)/den)):0;
      const hitX=ax+dx*t,hitY=ay+dy*t;
      if(Math.hypot(hitX-meState.x,hitY-meState.y)<30){
        b.life=0;b.x=hitX;b.y=hitY;
        impactFx.push({x:hitX,y:hitY,life:.32,maxLife:.32});
        hitFlashUntil=performance.now()+220;
        hitShakeUntil=performance.now()+150;
        // Las dos balas de una misma ráfaga cuentan como un solo impacto.
        if(now-lastHitAt>180){
          lastHitAt=now;
          meState.lives=Math.max(0,meState.lives-1);updateLives();
          if(meState.lives<=0){send({type:'defeat'});endArena('💥 Tu nave fue destruida.');return;}
        }
      }
    }
    for(const m of missiles){
      if(m.life<=0)continue;
      const target=m.own?peerState:meState;
      if(Math.hypot(m.x-target.x,m.y-target.y)<31){
        m.life=0; impactFx.push({x:m.x,y:m.y,life:.4,maxLife:.4});
        if(!m.own&&now-lastHitAt>180){
          lastHitAt=now;meState.lives=Math.max(0,meState.lives-1);updateLives();
          hitFlashUntil=performance.now()+260;hitShakeUntil=performance.now()+180;
          if(meState.lives<=0){send({type:'defeat'});endArena('💥 Tu nave fue destruida.');return;}
        }
      }
    }
    bullets=bullets.filter(b=>b.life>0&&b.x>-20&&b.x<arenaCanvas.width+20&&b.y>-20&&b.y<arenaCanvas.height+20);
    missiles=missiles.filter(m=>m.life>0&&m.x>-40&&m.x<arenaCanvas.width+40&&m.y>-40&&m.y<arenaCanvas.height+40);
    if(now-lastStateSend>50){
      lastStateSend=now;
      const sx=mySlot===2?arenaCanvas.width-meState.x:meState.x;
      const sy=mySlot===2?arenaCanvas.height-meState.y:meState.y;
      const sa=mySlot===2?meState.angle+Math.PI:meState.angle;
      const sva=mySlot===2?meState.visualAngle+Math.PI:meState.visualAngle;
      send({type:'state',x:Math.round(sx),y:Math.round(sy),angle:sa,visualAngle:sva,lives:meState.lives});
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
  function draw(){
    const w=arenaCanvas.width,h=arenaCanvas.height;
    arenaCtx.clearRect(0,0,w,h);
    arenaCtx.save();
    if(performance.now()<hitShakeUntil) arenaCtx.translate((Math.random()-.5)*7,(Math.random()-.5)*7);
    if(pvpBackground.complete&&pvpBackground.naturalWidth)arenaCtx.drawImage(pvpBackground,0,0,w,h);else{arenaCtx.fillStyle='#020617';arenaCtx.fillRect(0,0,w,h);}
    arenaCtx.strokeStyle='rgba(167,139,250,.35)';arenaCtx.setLineDash([8,10]);arenaCtx.beginPath();arenaCtx.moveTo(0,h/2);arenaCtx.lineTo(w,h/2);arenaCtx.stroke();arenaCtx.setLineDash([]);
    const mine=players.find(p=>Number(p.slot)===mySlot)||{ship:shipLabel()};
    const rival=players.find(p=>Number(p.slot)!==mySlot)||{ship:'Gallina'};
    drawShip(peerState,rival.ship);
    if(performance.now()<hitFlashUntil){arenaCtx.save();arenaCtx.globalAlpha=.42;arenaCtx.fillStyle='#fff';arenaCtx.beginPath();arenaCtx.arc(meState.x,meState.y,30,0,Math.PI*2);arenaCtx.fill();arenaCtx.restore();}
    drawShip(meState,mine.ship);
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
  stickSetup($('pvpMoveStick'),moveStick,false);stickSetup($('pvpAimStick'),aimStick,true);
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
    const me=identity();$('pvpPlayerName').textContent=me.name||'Jugador';$('pvpShipName').textContent=shipLabel();showStatus('Listo para crear o unirse a una sala.');
  });
  $('pvpFindMatchBtn')?.addEventListener('click',()=>{unlockPvpMusic();findMatch();});
  $('pvpCreateRoomBtn')?.addEventListener('click',()=>{unlockPvpMusic();const c=randomCode();roomInput.value=c;connect(c,true);});
  $('pvpJoinRoomBtn')?.addEventListener('click',()=>{unlockPvpMusic();connect(roomInput.value,false);});
  roomInput?.addEventListener('input',()=>roomInput.value=String(roomInput.value||'').replace(/\D/g,'').slice(0,6));
  $('pvpCloseBtn')?.addEventListener('click',()=>{disconnect(true);lobby.style.display='none';$('startScreen').style.display='flex';});
  $('pvpLeaveArenaBtn')?.addEventListener('click',()=>{
    // Abandonar una batalla cuenta como derrota: avisamos al rival antes de cerrar el WebSocket.
    if(socket?.readyState===WebSocket.OPEN && (running||countdownActive)) send({type:'defeat',reason:'forfeit'});
    disconnect(true);arena.style.display='none';$('startScreen').style.display='flex';
  });
  $('pvpResultBackBtn')?.addEventListener('click',()=>{disconnect(true);arena.style.display='none';$('startScreen').style.display='flex';});

  window.GallinaPvp={get connected(){return socket?.readyState===WebSocket.OPEN;},get roomCode(){return currentRoom;},get slot(){return mySlot;},send,disconnect};
})();

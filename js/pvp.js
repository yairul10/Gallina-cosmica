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

  let socket = null, currentRoom = '', mySlot = 0, players = [];
  let running = false, countdownActive = false, countdownTimer = 0, raf = 0, lastFrame = 0, lastStateSend = 0, lastShot = 0;
  const keys = new Set();
  const meState = { x: 210, y: 560, lives: 3, angle: -Math.PI / 2, visualAngle: -Math.PI / 2 };
  const peerState = { x: 210, y: 80, lives: 3, angle: Math.PI / 2, visualAngle: Math.PI / 2 };
  let bullets = [];
  const moveStick = { active:false, id:null, x:0, y:0 };
  const aimStick = { active:false, id:null, x:0, y:0 };

  function identity(){ return window.GallinaPlayerIdentity?.getCurrent?.() || {id:null,name:'Jugador'}; }
  function shipLabel(){
    const names=['Gallina','Oveja','Caballo','Vaca'];
    const i=Number(window.gameStats?.selectedShip ?? 0);
    if(window.gameStats?.useGallinaChile) return 'Gallina Chile';
    return (names[i]||'Gallina')+(window.gameStats?.useProShip?' Pro':'');
  }
  function shipSrc(label){
    if(label==='Gallina Chile') return 'assets/gallina_chile.png';
    const pro=/ Pro$/.test(label);
    const base=label.replace(/ Pro$/,'').toLowerCase();
    return 'assets/'+base+(pro?'_pro':'')+'_1.png';
  }
  function projectileSrc(label){
    const pro=/ Pro$/.test(label), base=label.replace(/ Pro$/,'');
    const files={
      'Gallina':['assets/bala_pollito.png','assets/bala_pollito_pro.png'],
      'Gallina Chile':['assets/bala_pollito.png','assets/bala_pollito.png'],
      'Oveja':['assets/bala_lana.png','assets/bala_lana_pro.png'],
      'Caballo':['assets/bala_herradura.png','assets/bala_herradura_pro.png'],
      'Vaca':['assets/bala_leche.png','assets/bala_leche_pro.png']
    };
    const pair=files[base]||files.Gallina; return pair[pro?1:0];
  }
  function showStatus(text,ok=false){ if(status){status.textContent=text;status.style.color=ok?'#86efac':'#cbd5e1';} }
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
    if(socket){const old=socket;socket=null;try{old.close(1000,'leaving');}catch{}}
    currentRoom='';mySlot=0;players=[];
    if(!silent)showStatus('Desconectado de la sala.');
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
    meState.x=w/2; meState.y=h-90; meState.lives=3; meState.angle=-Math.PI/2; meState.visualAngle=-Math.PI/2;
    peerState.x=w/2;peerState.y=90;peerState.lives=3;peerState.angle=Math.PI/2;peerState.visualAngle=Math.PI/2;
    bullets=[]; $('pvpResult').style.display='none';
    $('pvpRoomHud').textContent='Sala '+currentRoom;
    updateLives();
  }
  function startArena(){
    if(!arenaCanvas||!arenaCtx||running||countdownActive)return;
    lobby.style.display='none'; arena.style.display='flex'; resetArena();
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
    running=false;countdownActive=false;
    if(countdownTimer){clearInterval(countdownTimer);countdownTimer=0;}
    const overlay=$('pvpCountdown');if(overlay)overlay.style.display='none';
    if(raf)cancelAnimationFrame(raf);raf=0;moveStick.active=false;aimStick.active=false;
  }
  function endArena(text){
    stopArena(); $('pvpResultText').textContent=text; $('pvpResult').style.display='flex';
  }
  function updateLives(){
    $('pvpMyLives').textContent='❤️'.repeat(Math.max(0,meState.lives));
    $('pvpRivalLives').textContent='❤️'.repeat(Math.max(0,peerState.lives));
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
    } else if(p.type==='defeat') {
      endArena('🏆 ¡Victoria! Destruiste la nave rival.');
    }
  }

  function shoot(){
    const now=performance.now();if(!running||now-lastShot<330)return;lastShot=now;
    const a=meState.angle,sideX=Math.cos(a+Math.PI/2)*9,sideY=Math.sin(a+Math.PI/2)*9;
    const myShip=(players.find(p=>Number(p.slot)===mySlot)||{ship:shipLabel()}).ship;
    [-1,1].forEach(s=>bullets.push({x:meState.x+sideX*s,y:meState.y+sideY*s,vx:Math.cos(a)*330,vy:Math.sin(a)*330,angle:a,ship:myShip,own:true,life:1.5}));
    const sx=mySlot===2?arenaCanvas.width-meState.x:meState.x;
    const sy=mySlot===2?arenaCanvas.height-meState.y:meState.y;
    const sa=mySlot===2?a+Math.PI:a;
    send({type:'shot',x:sx,y:sy,angle:sa,ship:myShip});
  }
  function spawnRemoteShot(x,y,a,ship){
    if(!Number.isFinite(x+y+a))return;
    const sideX=Math.cos(a+Math.PI/2)*9,sideY=Math.sin(a+Math.PI/2)*9;
    [-1,1].forEach(s=>bullets.push({x:x+sideX*s,y:y+sideY*s,vx:Math.cos(a)*330,vy:Math.sin(a)*330,angle:a,ship:ship||'Gallina',own:false,life:1.5}));
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

    for(const b of bullets){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;}
    for(const b of bullets){
      if(!b.own&&b.life>0&&Math.hypot(b.x-meState.x,b.y-meState.y)<24){
        b.life=0; meState.lives=Math.max(0,meState.lives-1);updateLives();
        if(meState.lives<=0){send({type:'defeat'});endArena('💥 Tu nave fue destruida.');return;}
      }
    }
    bullets=bullets.filter(b=>b.life>0&&b.x>-20&&b.x<arenaCanvas.width+20&&b.y>-20&&b.y<arenaCanvas.height+20);
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
  function imageFor(label){const src=shipSrc(label);if(!imageCache.has(src)){const im=new Image();im.src=src;imageCache.set(src,im);}return imageCache.get(src);}
  function drawShip(state,label){
    const im=imageFor(label);arenaCtx.save();arenaCtx.translate(state.x,state.y);arenaCtx.rotate((Number.isFinite(state.visualAngle)?state.visualAngle:state.angle)+Math.PI/2);
    if(im.complete&&im.naturalWidth)arenaCtx.drawImage(im,-26,-26,52,52);else{arenaCtx.fillStyle='#7dd3fc';arenaCtx.beginPath();arenaCtx.arc(0,0,22,0,Math.PI*2);arenaCtx.fill();}
    arenaCtx.restore();
  }
  function draw(){
    const w=arenaCanvas.width,h=arenaCanvas.height;
    arenaCtx.clearRect(0,0,w,h);
    const bg=window.assets?.fondoRonda3;if(bg?.complete&&bg.naturalWidth)arenaCtx.drawImage(bg,0,0,w,h);else{arenaCtx.fillStyle='#020617';arenaCtx.fillRect(0,0,w,h);}
    arenaCtx.strokeStyle='rgba(167,139,250,.35)';arenaCtx.setLineDash([8,10]);arenaCtx.beginPath();arenaCtx.moveTo(0,h/2);arenaCtx.lineTo(w,h/2);arenaCtx.stroke();arenaCtx.setLineDash([]);
    const mine=players.find(p=>Number(p.slot)===mySlot)||{ship:shipLabel()};
    const rival=players.find(p=>Number(p.slot)!==mySlot)||{ship:'Gallina'};
    drawShip(peerState,rival.ship);drawShip(meState,mine.ship);
    for(const b of bullets){arenaCtx.fillStyle=b.own?'#fde047':'#fb7185';arenaCtx.beginPath();arenaCtx.arc(b.x,b.y,4,0,Math.PI*2);arenaCtx.fill();}
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
  window.addEventListener('keydown',e=>{keys.add(e.key);if(e.key===' ')e.preventDefault();});
  window.addEventListener('keyup',e=>keys.delete(e.key));

  $('openPvpBtn')?.addEventListener('click',()=>{
    document.querySelectorAll('.screen-overlay').forEach(el=>el.style.display='none');lobby.style.display='flex';
    const me=identity();$('pvpPlayerName').textContent=me.name||'Jugador';$('pvpShipName').textContent=shipLabel();showStatus('Listo para crear o unirse a una sala.');
  });
  $('pvpCreateRoomBtn')?.addEventListener('click',()=>{const c=randomCode();roomInput.value=c;connect(c,true);});
  $('pvpJoinRoomBtn')?.addEventListener('click',()=>connect(roomInput.value,false));
  roomInput?.addEventListener('input',()=>roomInput.value=String(roomInput.value||'').replace(/\D/g,'').slice(0,6));
  $('pvpCloseBtn')?.addEventListener('click',()=>{disconnect(true);lobby.style.display='none';$('startScreen').style.display='flex';});
  $('pvpLeaveArenaBtn')?.addEventListener('click',()=>{disconnect(true);arena.style.display='none';$('startScreen').style.display='flex';});
  $('pvpResultBackBtn')?.addEventListener('click',()=>{disconnect(true);arena.style.display='none';$('startScreen').style.display='flex';});

  window.GallinaPvp={get connected(){return socket?.readyState===WebSocket.OPEN;},get roomCode(){return currentRoom;},get slot(){return mySlot;},send,disconnect};
})();

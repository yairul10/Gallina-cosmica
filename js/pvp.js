/* PvP experimental 0.2: lobby conectado al Worker Cloudflare por WebSocket. */
(() => {
  const PVP_TEST_MODE = true;
  const PVP_WS_BASE = 'wss://gallina-cosmica-pvp.jairog940.workers.dev';
  if (!PVP_TEST_MODE) return;

  const $ = (id) => document.getElementById(id);
  const screen = $('pvpLobbyScreen');
  const open = $('openPvpBtn');
  const status = $('pvpLobbyStatus');
  const roomInput = $('pvpRoomCode');
  let socket = null;
  let currentRoom = '';
  let mySlot = 0;

  function identity() {
    return window.GallinaPlayerIdentity?.getCurrent?.() || { id: null, name: 'Jugador' };
  }

  function shipLabel() {
    const names = ['Gallina', 'Oveja', 'Caballo', 'Vaca'];
    const i = Number(window.gameStats?.selectedShip ?? 0);
    if (window.gameStats?.useGallinaChile) return 'Gallina Chile';
    return (names[i] || 'Gallina') + (window.gameStats?.useProShip ? ' Pro' : '');
  }

  function showStatus(text, ok = false) {
    if (!status) return;
    status.textContent = text;
    status.style.color = ok ? '#86efac' : '#cbd5e1';
  }

  function randomCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  function playerId() {
    const me = identity();
    if (me.id) return String(me.id);
    let id = sessionStorage.getItem('gallina_pvp_guest_id');
    if (!id) {
      id = 'guest-' + crypto.randomUUID();
      sessionStorage.setItem('gallina_pvp_guest_id', id);
    }
    return id;
  }

  function disconnect(silent = false) {
    if (socket) {
      const old = socket;
      socket = null;
      try { old.close(1000, 'leaving'); } catch {}
    }
    currentRoom = '';
    mySlot = 0;
    if (!silent) showStatus('Desconectado de la sala.');
  }

  function connect(code, creating = false) {
    code = String(code || '').replace(/\D/g, '').slice(0, 6);
    roomInput.value = code;
    if (code.length !== 6) {
      showStatus('Escribe un código de sala de 6 dígitos.');
      return;
    }

    disconnect(true);
    const me = identity();
    const params = new URLSearchParams({
      playerId: playerId(),
      name: me.name || 'Jugador',
      ship: shipLabel()
    });
    const ws = new WebSocket(`${PVP_WS_BASE}/room/${code}?${params.toString()}`);
    socket = ws;
    currentRoom = code;
    showStatus((creating ? 'Creando' : 'Entrando a') + ' sala ' + code + '…');

    ws.addEventListener('open', () => {
      if (socket !== ws) return;
      showStatus('Conectado a sala ' + code + '. Esperando rival…', true);
    });

    ws.addEventListener('message', (event) => {
      if (socket !== ws) return;
      let message;
      try { message = JSON.parse(event.data); } catch { return; }

      if (message.type === 'joined') {
        const mine = (message.players || []).find(p => String(p.playerId) === playerId());
        mySlot = Number(mine?.slot || 0);
        const count = (message.players || []).length;
        showStatus('Sala ' + code + ' · conectado como Jugador ' + (mySlot || '?') +
          (count < 2 ? ' · esperando rival…' : ''), true);
      } else if (message.type === 'player-joined') {
        showStatus('¡Rival conectado! Preparando partida…', true);
      } else if (message.type === 'ready') {
        const players = message.players || [];
        const rival = players.find(p => Number(p.slot) !== mySlot);
        showStatus('⚔️ ¡Sala lista! Rival: ' + (rival?.name || 'Jugador') +
          ' · ' + (rival?.ship || 'Nave') + '. Próximo paso: abrir la arena.', true);
        window.dispatchEvent(new CustomEvent('gallina-pvp-ready', {
          detail: { roomCode: code, slot: mySlot, players }
        }));
      } else if (message.type === 'player-left') {
        showStatus('El rival salió. Esperando otro jugador…');
      }
    });

    ws.addEventListener('close', (event) => {
      if (socket !== ws) return;
      socket = null;
      if (event.code === 1000) return;
      showStatus('Se perdió la conexión con la sala. Intenta nuevamente.');
    });

    ws.addEventListener('error', () => {
      if (socket !== ws) return;
      showStatus('No se pudo conectar al servidor PvP.');
    });
  }

  open?.addEventListener('click', () => {
    document.querySelectorAll('.screen-overlay').forEach(el => el.style.display = 'none');
    screen.style.display = 'flex';
    const me = identity();
    $('pvpPlayerName').textContent = me.name || 'Jugador';
    $('pvpShipName').textContent = shipLabel();
    showStatus('Listo para crear o unirse a una sala.');
  });

  $('pvpCreateRoomBtn')?.addEventListener('click', () => {
    const code = randomCode();
    roomInput.value = code;
    connect(code, true);
  });

  $('pvpJoinRoomBtn')?.addEventListener('click', () => {
    connect(roomInput.value, false);
  });

  roomInput?.addEventListener('input', () => {
    roomInput.value = String(roomInput.value || '').replace(/\D/g, '').slice(0, 6);
  });

  $('pvpCloseBtn')?.addEventListener('click', () => {
    disconnect(true);
    screen.style.display = 'none';
    $('startScreen').style.display = 'flex';
  });

  window.GallinaPvp = {
    get connected() { return socket?.readyState === WebSocket.OPEN; },
    get roomCode() { return currentRoom; },
    get slot() { return mySlot; },
    send(payload) {
      if (socket?.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify(payload));
      return true;
    },
    disconnect
  };
})();

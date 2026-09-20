/* PvP experimental 0.1: lobby local. La red WebSocket se conecta en la fase Cloudflare. */
(() => {
  const PVP_TEST_MODE = true;
  if (!PVP_TEST_MODE) return;

  const $ = (id) => document.getElementById(id);
  const screen = $('pvpLobbyScreen');
  const open = $('openPvpBtn');
  const status = $('pvpLobbyStatus');
  const roomInput = $('pvpRoomCode');

  function identity() {
    return window.GallinaPlayerIdentity?.getCurrent?.() || { id: null, name: 'Jugador' };
  }
  function shipLabel() {
    const names = ['Gallina', 'Oveja', 'Caballo', 'Vaca'];
    const i = Number(window.gameStats?.selectedShip ?? 0);
    if (window.gameStats?.useGallinaChile) return 'Gallina Chile';
    return (names[i] || 'Gallina') + (window.gameStats?.useProShip ? ' Pro' : '');
  }
  function showStatus(text, ok=false) {
    if (!status) return;
    status.textContent = text;
    status.style.color = ok ? '#86efac' : '#cbd5e1';
  }
  function randomCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
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
    showStatus('Sala ' + code + ' preparada. Falta conectar Cloudflare para recibir al rival.', true);
  });

  $('pvpJoinRoomBtn')?.addEventListener('click', () => {
    const code = String(roomInput.value || '').replace(/\D/g, '').slice(0, 6);
    roomInput.value = code;
    if (code.length !== 6) return showStatus('Escribe un código de sala de 6 dígitos.');
    showStatus('Sala ' + code + ' preparada. La conexión online se activa en la siguiente fase.', true);
  });

  $('pvpCloseBtn')?.addEventListener('click', () => {
    screen.style.display = 'none';
    $('startScreen').style.display = 'flex';
  });
})();

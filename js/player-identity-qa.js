/* Identidad simulada para probar torneos desde GitHub Pages.
   No se activa dentro de la app Android. */
(() => {
    const isNativeApp = !!(window.Capacitor && typeof window.Capacitor.getPlatform === 'function' && window.Capacitor.getPlatform() !== 'web');
    if (isNativeApp) return;

    // Este archivo se usa solo en GitHub Pages. Si una versión antigua del
    // perfil quedó guardada, el premio se reconcilia en cada carga para QA.

    const KEY = 'gallina_qa_player_identity';
    const PLAYERS = [
        { id: 'QA-PLAYER-001', name: 'Jugador 1' },
        { id: 'QA-PLAYER-002', name: 'Jugador 2' },
        { id: 'QA-PLAYER-003', name: 'Jugador 3' }
    ];

    const read = () => {
        try {
            const saved = JSON.parse(localStorage.getItem(KEY));
            return PLAYERS.find(p => p.id === saved?.id) || PLAYERS[0];
        } catch (_) {
            return PLAYERS[0];
        }
    };
    const save = (player) => localStorage.setItem(KEY, JSON.stringify(player));

    let current = read();
    save(current);

    // Las claves de progreso QA se separan por Player ID. Las claves visuales
    // (por ejemplo, posición del HUD) pueden seguir siendo comunes.
    const PROFILE_KEYS = new Set([
        'farm_space_stats',
        'farm_space_achievements',
        'farm_space_leaderboard',
        'farm_space_trophies'
    ]);
    window.gallinaPlayerStorageKey = (baseKey) =>
        PROFILE_KEYS.has(baseKey) ? baseKey + '__' + current.id : baseKey;

    // Premio QA de prueba: solo Jugador 1 recibe Gallina Pro, una vez.
    // Esto prueba que un premio puede pertenecer a una identidad concreta.
    const TEST_REWARD_PLAYER = 'QA-PLAYER-001';
    if (current.id === TEST_REWARD_PLAYER) {
        const statsKey = window.gallinaPlayerStorageKey('farm_space_stats');
        let stats = {};
        try { stats = JSON.parse(localStorage.getItem(statsKey)) || {}; } catch (_) {}
        if (!Array.isArray(stats.proSkins)) stats.proSkins = [false, false, false, false];
        // Reconciliar el premio en cada carga evita que un flag antiguo marque
        // "entregado" aunque el perfil no tenga realmente la nave.
        if (stats.proSkins[0] !== true) {
            stats.proSkins[0] = true; // Gallina Pro
            localStorage.setItem(statsKey, JSON.stringify(stats));
        }
    }

    window.GallinaPlayerIdentity = {
        getCurrent: () => ({ ...current }),
        getId: () => current.id,
        getName: () => current.name,
        isQA: true,
        setPlayer: (id) => {
            const found = PLAYERS.find(p => p.id === id);
            if (!found) return false;
            current = found;
            save(current);
            render();
            window.dispatchEvent(new CustomEvent('gallina-player-changed', { detail: { ...current } }));
            // El juego mantiene parte del perfil en variables globales. Recargar
            // al cambiar de jugador evita mezclar datos entre dos identidades.
            window.location.reload();
            return true;
        }
    };

    function render() {
        let panel = document.getElementById('qaIdentityPanel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'qaIdentityPanel';
            Object.assign(panel.style, {
                position: 'absolute', left: '12px', top: '78px', zIndex: '105',
                background: 'rgba(2, 6, 23, .94)', color: '#fff',
                border: '1px solid #38bdf8', borderRadius: '10px',
                padding: '7px', fontSize: '11px', maxWidth: '175px',
                boxShadow: '0 3px 12px rgba(0,0,0,.45)'
            });
            const container = document.getElementById('game-container');
            (container || document.body).appendChild(panel);
        }

        const startScreen = document.getElementById('startScreen');
        const menuVisible = startScreen && getComputedStyle(startScreen).display !== 'none';
        panel.style.display = menuVisible ? 'block' : 'none';
        if (!menuVisible) return;

        panel.innerHTML = '';
        const title = document.createElement('div');
        title.textContent = '🧪 IDENTIDAD QA';
        title.style.fontWeight = '800';
        title.style.color = '#67e8f9';
        panel.appendChild(title);

        const status = document.createElement('div');
        status.textContent = current.name + ' · ' + current.id;
        status.style.margin = '4px 0';
        panel.appendChild(status);

        const select = document.createElement('select');
        select.setAttribute('aria-label', 'Jugador QA');
        select.style.width = '100%';
        select.style.fontSize = '12px';
        PLAYERS.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.name;
            option.selected = p.id === current.id;
            select.appendChild(option);
        });
        select.addEventListener('change', () => window.GallinaPlayerIdentity.setPlayer(select.value));
        panel.appendChild(select);
    }

    const watchMenu = () => {
        render();
        const startScreen = document.getElementById('startScreen');
        if (startScreen) new MutationObserver(render).observe(startScreen, { attributes: true, attributeFilter: ['style', 'class'] });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchMenu);
    else watchMenu();
})();
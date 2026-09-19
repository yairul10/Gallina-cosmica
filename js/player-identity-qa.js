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

    // Torneo QA compartido entre los tres perfiles de este navegador.
    // El primer Player ID que complete Superjefes queda registrado como ganador.
    const TOURNAMENT_KEY = 'gallina_qa_tournament_superboss_v1';
    const TOURNAMENT_REWARD = 500000;

    const readTournament = () => {
        try { return JSON.parse(localStorage.getItem(TOURNAMENT_KEY)) || {}; }
        catch (_) { return {}; }
    };
    const saveTournament = (data) => localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(data));

    function applyTournamentRewardIfWinner() {
        const tournament = readTournament();
        if (tournament.winnerId !== current.id || tournament.rewardClaimedBy === current.id) return false;
        const statsKey = window.gallinaPlayerStorageKey('farm_space_stats');
        let stats = {};
        try { stats = JSON.parse(localStorage.getItem(statsKey)) || {}; } catch (_) {}
        stats.savedCoins = Number(stats.savedCoins || 0) + TOURNAMENT_REWARD;
        stats.totalCoins = Number(stats.totalCoins || 0) + TOURNAMENT_REWARD;
        localStorage.setItem(statsKey, JSON.stringify(stats));
        tournament.rewardClaimedBy = current.id;
        saveTournament(tournament);
        return true;
    }

    window.GallinaQATournament = {
        getStatus: () => ({ ...readTournament() }),
        join: () => {
            const tournament = readTournament();
            if (tournament.winnerId) return { joined: false, finished: true, tournament };
            if (!Array.isArray(tournament.participants)) tournament.participants = [];
            if (!tournament.participants.some(p => p.id === current.id)) {
                tournament.participants.push({ id: current.id, name: current.name });
                saveTournament(tournament);
            }
            render();
            return { joined: true, tournament };
        },
        isJoined: () => {
            const tournament = readTournament();
            return Array.isArray(tournament.participants) && tournament.participants.some(p => p.id === current.id);
        },
        completeSuperBoss: () => {
            const tournament = readTournament();
            const joined = Array.isArray(tournament.participants) && tournament.participants.some(p => p.id === current.id);
            if (!joined) return { won: false, rewarded: false, notJoined: true, winnerId: tournament.winnerId, winnerName: tournament.winnerName };
            if (!tournament.winnerId) {
                tournament.winnerId = current.id;
                tournament.winnerName = current.name;
                tournament.completedAt = new Date().toISOString();
                saveTournament(tournament);
            }
            const won = tournament.winnerId === current.id;
            const rewarded = won ? applyTournamentRewardIfWinner() : false;
            return { won, rewarded, winnerId: readTournament().winnerId, winnerName: readTournament().winnerName };
        },
        reset: () => {
            localStorage.removeItem(TOURNAMENT_KEY);
            return true;
        }
    };

    // Si el ganador vuelve a cargar antes de cobrar, reconciliamos el premio.
    applyTournamentRewardIfWinner();

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

        const tournament = readTournament();
        const joined = Array.isArray(tournament.participants) && tournament.participants.some(p => p.id === current.id);
        const joinBtn = document.createElement('button');
        joinBtn.textContent = tournament.winnerId ? '🏁 Torneo finalizado' : (joined ? '✅ Participando' : '🏆 Participar');
        joinBtn.disabled = !!tournament.winnerId || joined;
        Object.assign(joinBtn.style, {
            width: '100%', marginTop: '6px', padding: '5px', borderRadius: '7px',
            border: '0', fontWeight: '700', cursor: joinBtn.disabled ? 'default' : 'pointer'
        });
        joinBtn.addEventListener('click', () => window.GallinaQATournament.join());
        panel.appendChild(joinBtn);

        const participants = Array.isArray(tournament.participants) ? tournament.participants : [];
        if (participants.length) {
            const list = document.createElement('div');
            list.style.marginTop = '6px';
            list.innerHTML = '<b>Participantes (' + participants.length + ')</b><br>' +
                participants.map(p => '🟢 ' + p.name).join('<br>');
            panel.appendChild(list);
        }

        if (tournament.winnerName) {
            const winner = document.createElement('div');
            winner.style.marginTop = '6px';
            winner.style.color = '#fbbf24';
            winner.style.fontWeight = '800';
            winner.textContent = '🥇 ' + tournament.winnerName;
            panel.appendChild(winner);
        }
    }

    const watchMenu = () => {
        render();
        const startScreen = document.getElementById('startScreen');
        if (startScreen) new MutationObserver(render).observe(startScreen, { attributes: true, attributeFilter: ['style', 'class'] });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchMenu);
    else watchMenu();
})();
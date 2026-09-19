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

    let tournamentExpanded = false;

    function render() {
        let identityPanel = document.getElementById('qaIdentityPanel');
        if (!identityPanel) {
            identityPanel = document.createElement('div');
            identityPanel.id = 'qaIdentityPanel';
            Object.assign(identityPanel.style, {
                position: 'absolute', left: '12px', top: '78px', zIndex: '105',
                background: 'rgba(2, 6, 23, .94)', color: '#fff',
                border: '1px solid #38bdf8', borderRadius: '10px',
                padding: '7px', fontSize: '11px', maxWidth: '175px',
                boxShadow: '0 3px 12px rgba(0,0,0,.45)'
            });
            const container = document.getElementById('game-container');
            (container || document.body).appendChild(identityPanel);
        }

        const startScreen = document.getElementById('startScreen');
        const menuVisible = startScreen && getComputedStyle(startScreen).display !== 'none';
        identityPanel.style.display = menuVisible ? 'block' : 'none';

        let tournamentIcon = document.getElementById('qaTournamentIcon');
        if (!tournamentIcon) {
            tournamentIcon = document.createElement('button');
            tournamentIcon.id = 'qaTournamentIcon';
            tournamentIcon.type = 'button';
            tournamentIcon.textContent = '🏆';
            tournamentIcon.setAttribute('aria-label', 'Abrir torneo');
            Object.assign(tournamentIcon.style, {
                position: 'absolute', right: '12px', top: '78px', zIndex: '107',
                width: '42px', height: '42px', borderRadius: '50%',
                border: '2px solid #fbbf24', background: 'rgba(15,23,42,.96)',
                fontSize: '21px', boxShadow: '0 3px 12px rgba(0,0,0,.45)',
                cursor: 'pointer'
            });
            tournamentIcon.addEventListener('click', (event) => {
                event.stopPropagation();
                tournamentExpanded = !tournamentExpanded;
                render();
            });
            const container = document.getElementById('game-container');
            (container || document.body).appendChild(tournamentIcon);
        }
        tournamentIcon.style.display = menuVisible ? 'block' : 'none';

        let tournamentPanel = document.getElementById('qaTournamentPanel');
        if (!tournamentPanel) {
            tournamentPanel = document.createElement('div');
            tournamentPanel.id = 'qaTournamentPanel';
            Object.assign(tournamentPanel.style, {
                position: 'absolute', right: '12px', top: '126px', zIndex: '106',
                width: '230px', maxWidth: 'calc(100% - 24px)',
                background: 'rgba(2, 6, 23, .97)', color: '#fff',
                border: '1px solid #fbbf24', borderRadius: '12px',
                padding: '11px', fontSize: '12px',
                boxShadow: '0 6px 20px rgba(0,0,0,.55)'
            });
            tournamentPanel.addEventListener('click', event => event.stopPropagation());
            const container = document.getElementById('game-container');
            (container || document.body).appendChild(tournamentPanel);
        }
        tournamentPanel.style.display = menuVisible && tournamentExpanded ? 'block' : 'none';

        if (!menuVisible) return;

        identityPanel.innerHTML = '';
        const title = document.createElement('div');
        title.textContent = '🧪 IDENTIDAD QA';
        title.style.fontWeight = '800';
        title.style.color = '#67e8f9';
        identityPanel.appendChild(title);

        const status = document.createElement('div');
        status.textContent = current.name + ' · ' + current.id;
        status.style.margin = '4px 0';
        identityPanel.appendChild(status);

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
        identityPanel.appendChild(select);

        const tournament = readTournament();
        const participants = Array.isArray(tournament.participants) ? tournament.participants : [];
        const joined = participants.some(p => p.id === current.id);

        tournamentPanel.innerHTML = '';
        const heading = document.createElement('div');
        heading.textContent = '🏆 TORNEO QA';
        heading.style.cssText = 'font-size:16px;font-weight:900;color:#fbbf24;text-align:center;margin-bottom:8px;';
        tournamentPanel.appendChild(heading);

        const challenge = document.createElement('div');
        challenge.innerHTML = '<b>🎯 Desafío</b><br>Ser el primero en destruir un enemigo en Superjefes.';
        challenge.style.marginBottom = '8px';
        tournamentPanel.appendChild(challenge);

        const prize = document.createElement('div');
        prize.innerHTML = '<b>🎁 Premio</b><br>🪙 500.000 monedas';
        prize.style.marginBottom = '9px';
        tournamentPanel.appendChild(prize);

        const joinBtn = document.createElement('button');
        joinBtn.textContent = tournament.winnerId ? '🏁 Torneo finalizado' : (joined ? '✅ Participando' : '🏆 Participar');
        joinBtn.disabled = !!tournament.winnerId || joined;
        Object.assign(joinBtn.style, {
            width: '100%', padding: '8px', borderRadius: '8px',
            border: '0', fontWeight: '800', cursor: joinBtn.disabled ? 'default' : 'pointer',
            marginBottom: '9px'
        });
        joinBtn.addEventListener('click', () => window.GallinaQATournament.join());
        tournamentPanel.appendChild(joinBtn);

        const list = document.createElement('div');
        list.innerHTML = '<b>👥 Participantes (' + participants.length + ')</b>' +
            (participants.length ? '<br>' + participants.map(p => '🟢 ' + p.name).join('<br>') : '<br><span style="opacity:.7">Aún no hay participantes.</span>');
        tournamentPanel.appendChild(list);

        if (tournament.winnerName) {
            const winner = document.createElement('div');
            winner.style.cssText = 'margin-top:9px;color:#fbbf24;font-weight:900;';
            winner.textContent = '🥇 Ganador: ' + tournament.winnerName;
            tournamentPanel.appendChild(winner);
        }
    }

    document.addEventListener('click', (event) => {
        if (!tournamentExpanded) return;
        const panel = document.getElementById('qaTournamentPanel');
        const icon = document.getElementById('qaTournamentIcon');
        if ((panel && panel.contains(event.target)) || (icon && icon.contains(event.target))) return;
        tournamentExpanded = false;
        render();
    });

    const watchMenu = () => {
        render();
        const startScreen = document.getElementById('startScreen');
        if (startScreen) new MutationObserver(render).observe(startScreen, { attributes: true, attributeFilter: ['style', 'class'] });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchMenu);
    else watchMenu();
})();
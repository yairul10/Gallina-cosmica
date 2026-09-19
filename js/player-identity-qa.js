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

    // Torneo QA conectado a Cloudflare D1.
    const TOURNAMENT_API = 'https://gallina-cosmica-api.jairog940.workers.dev/api/tournaments/active';
    const TOURNAMENT_BASE = 'https://gallina-cosmica-api.jairog940.workers.dev/api/tournaments';
    const REWARDS_BASE = 'https://gallina-cosmica-api.jairog940.workers.dev/api/rewards';
    let cloudRewardsBusy = false;
    let cloudTournament = null;
    let cloudParticipants = [];
    let cloudTournamentError = false;
    let cloudJoinBusy = false;
    let cloudCompleteBusy = false;

    async function loadCloudTournament() {
        try {
            const response = await fetch(TOURNAMENT_API, { cache: 'no-store' });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const data = await response.json();
            cloudTournament = data && data.success ? data.tournament : null;
            cloudTournamentError = false;
            await loadCloudParticipants();
        } catch (error) {
            console.warn('[Torneo] No se pudo leer Cloudflare.', error);
            cloudTournamentError = true;
        }
        render();
    }

    async function loadCloudParticipants() {
        if (!cloudTournament?.id) {
            cloudParticipants = [];
            return;
        }
        try {
            const response = await fetch(
                TOURNAMENT_BASE + '/participants?tournament_id=' + encodeURIComponent(cloudTournament.id),
                { cache: 'no-store' }
            );
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const data = await response.json();
            cloudParticipants = data && data.success && Array.isArray(data.participants)
                ? data.participants : [];
        } catch (error) {
            console.warn('[Torneo] No se pudieron leer participantes de D1.', error);
            cloudParticipants = [];
            cloudTournamentError = true;
        }
    }

    async function joinCloudTournament() {
        if (!cloudTournament?.id || cloudJoinBusy) return;
        cloudJoinBusy = true;
        render();
        try {
            const response = await fetch(TOURNAMENT_BASE + '/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tournament_id: cloudTournament.id,
                    player_id: current.id,
                    player_name: current.name
                })
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || ('HTTP ' + response.status));
            await loadCloudTournament();
        } catch (error) {
            console.warn('[Torneo] No se pudo registrar la participación en D1.', error);
            alert('No se pudo registrar la participación. Inténtalo nuevamente.');
        } finally {
            cloudJoinBusy = false;
            render();
        }
    }

    async function completeCloudTournament() {
        if (!cloudTournament?.id || cloudCompleteBusy) return { success: false, busy: true };
        const joined = cloudParticipants.some(p => p.player_id === current.id);
        if (!joined) return { success: false, notJoined: true };

        cloudCompleteBusy = true;
        try {
            const response = await fetch(TOURNAMENT_BASE + '/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tournament_id: cloudTournament.id,
                    player_id: current.id
                })
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || ('HTTP ' + response.status));
            await loadCloudTournament();
            if (data.won) {
                showTrophyToast('🏆', null, '¡Primer lugar del torneo!');
            }
            return data;
        } catch (error) {
            console.warn('[Torneo] No se pudo reportar el desafío a D1.', error);
            return { success: false, error: error.message };
        } finally {
            cloudCompleteBusy = false;
            render();
        }
    }

    async function claimCloudReward(rewardId) {
        const response = await fetch(REWARDS_BASE + '/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reward_id: rewardId,
                player_id: current.id
            })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || ('HTTP ' + response.status));
        }
        return data;
    }

    async function processPendingCloudRewards() {
        if (cloudRewardsBusy || typeof window.gallinaApplyCloudCoinReward !== 'function') return;
        cloudRewardsBusy = true;
        let coinsDelivered = 0;
        let shouldReload = false;
        let itemDelivered = false;

        try {
            const response = await fetch(
                REWARDS_BASE + '/pending?player_id=' + encodeURIComponent(current.id),
                { cache: 'no-store' }
            );
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || ('HTTP ' + response.status));

            const rewards = Array.isArray(data.rewards) ? data.rewards : [];
            for (const reward of rewards) {
                let applied = null;
                if (reward.reward_type === 'COINS') {
                    applied = window.gallinaApplyCloudCoinReward?.(reward.id, reward.reward_value);
                } else if (reward.reward_type === 'ITEM' && reward.reward_value === 'gallina_chile') {
                    applied = window.gallinaApplyCloudItemReward?.(reward.id, reward.reward_value);
                } else {
                    continue;
                }
                if (!applied?.success) continue;

                // El ID queda persistido localmente antes del ACK para evitar
                // duplicar la entrega si la conexión falla entre ambos pasos.
                await claimCloudReward(reward.id);
                if (applied.applied) {
                    if (reward.reward_type === 'COINS') coinsDelivered += Number(reward.reward_value) || 0;
                    if (reward.reward_type === 'ITEM') itemDelivered = true;
                    shouldReload = true;
                }
            }

            if (coinsDelivered > 0 || itemDelivered) {
                const parts = [];
                if (coinsDelivered > 0) parts.push('+' + formatCoins(coinsDelivered) + ' monedas');
                if (itemDelivered) parts.push('🇨🇱 Gallina Chile');
                alert('🏆 Premio del torneo recibido: ' + parts.join(' + '));
            }
        } catch (error) {
            console.warn('[Premios] No se pudieron sincronizar los premios pendientes.', error);
        } finally {
            cloudRewardsBusy = false;
        }

        if (shouldReload) window.location.reload();
    }

    const formatCoins = (value) => Number(value || 0).toLocaleString('es-CL');

    window.GallinaQATournament = {
        getStatus: () => ({
            tournament: cloudTournament ? { ...cloudTournament } : null,
            participants: cloudParticipants.map(p => ({ ...p }))
        }),
        join: joinCloudTournament,
        isJoined: () => cloudParticipants.some(p => p.player_id === current.id),
        completeSuperBoss: completeCloudTournament,
        reset: () => false
    };

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

        const participants = cloudParticipants.map(p => ({ id: p.player_id, name: p.player_name || p.player_id }));
        const joined = participants.some(p => p.id === current.id);

        tournamentPanel.innerHTML = '';
        const heading = document.createElement('div');
        heading.textContent = cloudTournament?.name ? '🏆 ' + cloudTournament.name : '🏆 TORNEO QA';
        heading.style.cssText = 'font-size:16px;font-weight:900;color:#fbbf24;text-align:center;margin-bottom:8px;';
        tournamentPanel.appendChild(heading);

        const challenge = document.createElement('div');
        challenge.innerHTML = '<b>🎯 Desafío</b><br>' + (cloudTournament?.description || 'Ser el primero en destruir un enemigo en Superjefes.');
        challenge.style.marginBottom = '8px';
        tournamentPanel.appendChild(challenge);

        const prize = document.createElement('div');
        const cloudPrize = cloudTournament
            ? '🪙 ' + formatCoins(cloudTournament.reward_coins) + ' monedas' +
              (cloudTournament.reward_item ? '<br>🚀 Premio exclusivo: ' + cloudTournament.reward_item : '')
            : '🪙 500.000 monedas';
        prize.innerHTML = '<b>🎁 Premio</b><br>' + cloudPrize;
        prize.style.marginBottom = '9px';
        tournamentPanel.appendChild(prize);

        if (cloudTournamentError) {
            const cloudStatus = document.createElement('div');
            cloudStatus.textContent = '⚠️ Sin conexión al torneo en la nube · modo QA local';
            cloudStatus.style.cssText = 'margin-bottom:8px;font-size:10px;opacity:.75;';
            tournamentPanel.appendChild(cloudStatus);
        }

        const joinBtn = document.createElement('button');
        const cloudFinished = !!cloudTournament?.winner_player_id;
        joinBtn.textContent = cloudFinished
            ? '🏁 Torneo finalizado'
            : (joined ? '✅ Participando' : (cloudJoinBusy ? '⏳ Registrando...' : '🏆 Participar'));
        joinBtn.disabled = cloudFinished || joined || cloudJoinBusy;
        Object.assign(joinBtn.style, {
            width: '100%', padding: '8px', borderRadius: '8px',
            border: '0', fontWeight: '800', cursor: joinBtn.disabled ? 'default' : 'pointer',
            marginBottom: '9px'
        });
        joinBtn.addEventListener('click', joinCloudTournament);
        tournamentPanel.appendChild(joinBtn);

        const list = document.createElement('div');
        list.innerHTML = '<b>👥 Participantes (' + participants.length + ')</b>' +
            (participants.length ? '<br>' + participants.map(p => '🟢 ' + p.name).join('<br>') : '<br><span style="opacity:.7">Aún no hay participantes.</span>');
        tournamentPanel.appendChild(list);

        if (cloudTournament?.winner_player_id) {
            const winnerPlayer = participants.find(p => p.id === cloudTournament.winner_player_id);
            const winner = document.createElement('div');
            winner.style.cssText = 'margin-top:9px;color:#fbbf24;font-weight:900;';
            winner.textContent = '🥇 Ganador: ' + (winnerPlayer?.name || cloudTournament.winner_player_id);
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

    // Torneo QA: datos, participantes y ganador se leen/escriben en D1.
    loadCloudTournament();

    // estado.js se carga después de este archivo. Al terminar de cargar la
    // página ya existe la función que aplica monedas al perfil correcto.
    window.addEventListener('load', () => {
        processPendingCloudRewards();
    }, { once: true });
})();
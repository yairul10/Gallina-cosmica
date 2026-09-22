/* Acceso y diagnóstico visible de Google Play Games en Android. */
(() => {
    const button = document.getElementById('playGamesBtn');
    if (!button) return;

    let noticeTimer;
    const showNotice = (message, success = false) => {
        let notice = document.getElementById('playGamesStatusNotice');
        if (!notice) {
            notice = document.createElement('div');
            notice.id = 'playGamesStatusNotice';
            notice.setAttribute('role', 'status');
            document.body.appendChild(notice);
        }
        notice.textContent = message;
        Object.assign(notice.style, {
            position: 'fixed',
            top: 'calc(env(safe-area-inset-top, 0px) + 86px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: '500',
            maxWidth: '82vw',
            padding: '9px 12px',
            borderRadius: '10px',
            color: '#fff',
            textAlign: 'center',
            fontSize: '0.78rem',
            fontWeight: '700',
            background: success ? 'rgba(5, 110, 74, 0.96)' : 'rgba(127, 29, 29, 0.96)',
            border: success ? '1px solid #86efac' : '1px solid #fca5a5',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.45)',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            maxHeight: '68vh',
            overflowY: 'auto',
            fontSize: '0.67rem',
            lineHeight: '1.28'
        });
        notice.style.display = 'block';
        clearTimeout(noticeTimer);
        noticeTimer = setTimeout(() => { notice.style.display = 'none'; }, 7000);
    };

    const setStatus = (authenticated, message) => {
        button.textContent = authenticated ? '🎮✓' : '🎮';
        button.title = message || (authenticated
            ? 'Google Play Games conectado'
            : 'Conectar con Google Play Games');
        button.style.display = 'inline-flex';
        button.style.color = authenticated ? '#86efac' : '#dffcff';
    };

    const isAndroidApp = () => {
        const capacitor = window.Capacitor;
        const platform = capacitor && typeof capacitor.getPlatform === 'function'
            ? capacitor.getPlatform()
            : '';
        return platform === 'android' || /Android/i.test(navigator.userAgent);
    };

    const getPlayGames = () => {
        const capacitor = window.Capacitor;
        if (!capacitor) return null;
        return capacitor.Plugins?.PlayGames
            || (typeof capacitor.registerPlugin === 'function'
                ? capacitor.registerPlugin('PlayGames')
                : null);
    };

    const PLAY_GAMES_SERVER_CLIENT_ID = '672762312251-iub1fld742850kn1v637dvhle7e0mdv4.apps.googleusercontent.com';
    const PLAY_GAMES_IDENTITY_KEY = 'gallina_play_games_identity';
    const PROFILE_KEYS = new Set([
        'farm_space_stats',
        'farm_space_achievements',
        'farm_space_leaderboard',
        'farm_space_trophies',
        'farm_space_cloud_pending'
    ]);
    let playGamesIdentity = null;

    const installIdentityStorage = () => {
        window.gallinaPlayerStorageKey = (baseKey) =>
            PROFILE_KEYS.has(baseKey) && playGamesIdentity?.id
                ? baseKey + '__' + playGamesIdentity.id
                : baseKey;
    };

    // Solo usamos la identidad cacheada para elegir las claves locales del perfil.
    // No la enviamos a la nube hasta que Play Games confirme quién está conectado.
    try {
        const cached = JSON.parse(localStorage.getItem(PLAY_GAMES_IDENTITY_KEY) || 'null');
        if (cached?.id) {
            playGamesIdentity = {
                id: String(cached.id),
                name: String(cached.name || 'Jugador').slice(0, 50)
            };
            installIdentityStorage();
            window.GallinaPlayerIdentity = {
                getCurrent: () => playGamesIdentity ? { ...playGamesIdentity } : null,
                getId: () => playGamesIdentity?.id || null,
                getName: () => playGamesIdentity?.name || null,
                isQA: false,
                source: 'play-games'
            };
        }
    } catch (_) {}

    const publishPlayGamesIdentity = (playerStatus) => {
        if (!playerStatus?.playerAvailable || !playerStatus.playerId) return null;
        const identity = {
            id: String(playerStatus.playerId),
            name: String(playerStatus.displayName || 'Jugador').slice(0, 50)
        };
        const previousId = playGamesIdentity?.id || null;
        playGamesIdentity = identity;
        installIdentityStorage();
        try { localStorage.setItem(PLAY_GAMES_IDENTITY_KEY, JSON.stringify(identity)); } catch (_) {}

        window.GallinaPlayerIdentity = {
            getCurrent: () => playGamesIdentity ? { ...playGamesIdentity } : null,
            getId: () => playGamesIdentity?.id || null,
            getName: () => playGamesIdentity?.name || null,
            isQA: false,
            source: 'play-games'
        };

        // estado.js ya cargó las variables del perfil que estaba activo al abrir
        // la WebView. Si Play Games confirma otra cuenta, recargamos una sola vez
        // para que TODO el estado se lea desde las claves del nuevo Player ID.
        if (previousId && previousId !== identity.id) {
            const reloadKey = 'gallina_pgs_reload_for_' + identity.id;
            if (sessionStorage.getItem(reloadKey) !== '1') {
                sessionStorage.setItem(reloadKey, '1');
                window.location.reload();
                return identity;
            }
        }

        window.dispatchEvent(new CustomEvent('gallina-player-identity-ready', {
            detail: { ...identity, source: 'play-games' }
        }));
        return identity;
    };

    const refreshPlayerIdentity = async () => {
        const playGames = getPlayGames();
        if (!playGames) return null;
        try {
            const status = await playGames.getAuthStatus();
            if (!status?.authenticated) return null;
            const playerStatus = await playGames.getPlayerStatus();
            return publishPlayGamesIdentity(playerStatus);
        } catch (error) {
            console.warn('No se pudo obtener la identidad de Play Games:', error);
            return null;
        }
    };

    if (!isAndroidApp()) return;
    setStatus(false);

    // Solicita un código OAuth de un solo uso para que el backend pueda
    // verificar la identidad con Google. No se guarda en localStorage.
    window.requestPlayGamesServerAuthCode = async () => {
        const playGames = getPlayGames();
        if (!playGames) throw new Error('Google Play Games no está disponible');
        const status = await playGames.getAuthStatus();
        if (!status?.authenticated) throw new Error('Google Play Games no está autenticado');
        const result = await playGames.requestServerSideAccess({
            serverClientId: PLAY_GAMES_SERVER_CLIENT_ID
        });
        if (!result?.authCode) throw new Error('Google Play Games no entregó autorización de servidor');
        return result.authCode;
    };

    // Diagnóstico seguro para builds instaladas desde Google Play.
    // El código OAuth de un solo uso sólo existe en memoria durante esta llamada:
    // nunca se muestra, registra ni guarda.
    let serverAuthDiagnosticRan = false;
    const runSafePlayGamesDiagnostic = async ({ visible = false } = {}) => {
        if (serverAuthDiagnosticRan && !visible) return window.GallinaPlayGamesDiagnostic || null;
        serverAuthDiagnosticRan = true;
        const report = { playGames: false, identity: false, identityConsistent: false, serverAuth: false };
        try {
            const playGames = getPlayGames();
            if (!playGames) throw new Error('Play Games no disponible');
            const auth = await playGames.getAuthStatus();
            report.playGames = !!auth?.authenticated;
            if (!report.playGames) throw new Error('Play Games no autenticado');
            const player = await playGames.getPlayerStatus();
            const nativeId = player?.playerAvailable && player?.playerId ? String(player.playerId) : '';
            report.identity = !!nativeId;
            const published = nativeId ? publishPlayGamesIdentity(player) : null;
            report.identityConsistent = !!(nativeId && published?.id === nativeId && window.GallinaPlayerIdentity?.getId?.() === nativeId);
            // Solicitar y descartar de inmediato: jamás exponer el authCode al informe.
            const result = await playGames.requestServerSideAccess({ serverClientId: PLAY_GAMES_SERVER_CLIENT_ID });
            report.serverAuth = !!result?.authCode;
            result && (result.authCode = '');
        } catch (error) {
            report.error = String(error?.message || 'Error de diagnóstico').slice(0, 160);
        }
        window.GallinaPlayGamesDiagnostic = { ...report };
        if (visible) {
            const lines = [
                'Diagnóstico Play Games',
                '🎮 Conexión: ' + (report.playGames ? 'OK ✓' : 'ERROR'),
                '🆔 Identidad: ' + (report.identity ? 'OK ✓' : 'ERROR'),
                '🔗 Coherencia de identidad: ' + (report.identityConsistent ? 'OK ✓' : 'ERROR'),
                '🔐 Autorización de servidor: ' + (report.serverAuth ? 'OK ✓' : 'ERROR')
            ];
            if (report.error) lines.push('Detalle: ' + report.error);
            showNotice(lines.join('\\n'), report.playGames && report.identity && report.identityConsistent && report.serverAuth);
        }
        window.dispatchEvent(new CustomEvent('gallina-play-games-diagnostic', { detail: { ...report } }));
        return report;
    };
    window.runPlayGamesDiagnostic = () => runSafePlayGamesDiagnostic({ visible: true });

    window.unlockPlayGamesAchievement = async (achievementId) => {
        const playGames = getPlayGames();
        if (!playGames || !achievementId) return false;
        try {
            const status = await playGames.getAuthStatus();
            if (!status.authenticated) return false;
            await playGames.unlockAchievement({ achievementId });
            return true;
        } catch (error) {
            const detail = error?.message || String(error);
            console.warn('No se pudo desbloquear el logro de Play Games:', error);
            showNotice('Error al desbloquear logro: ' + detail);
            return false;
        }
    };

    const refreshStatus = async () => {
        const playGames = getPlayGames();
        if (!playGames) return null;
        try {
            const result = await playGames.getAuthStatus();
            setStatus(!!result.authenticated, result.detail);
            return result;
        } catch (error) {
            setStatus(false, 'Google Play Games no está disponible');
            return { authenticated: false, detail: error?.message || 'No se pudo consultar Play Games' };
        }
    };

    button.addEventListener('click', async () => {
        const playGames = getPlayGames();
        if (!playGames) {
            setStatus(false, 'Google Play Games se está inicializando');
            showNotice('Play Games aún se está inicializando');
            return;
        }

        button.disabled = true;
        button.textContent = '…';
        button.title = 'Conectando con Google Play Games…';
        try {
            const signedIn = await playGames.signIn();
            let status = null;
            for (let attempt = 0; attempt < 4; attempt += 1) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                status = await refreshStatus();
                if (status?.authenticated) break;
            }
            if (status?.authenticated) {
                const identity = await refreshPlayerIdentity();
                showNotice(identity
                    ? 'Google Play Games conectado ✓\n' + identity.name
                    : 'Google Play Games conectado ✓', true);
                await runSafePlayGamesDiagnostic({ visible: true });
            } else {
                const details = [
                    'signIn:\n' + (signedIn?.diagnostic || signedIn?.detail || 'Sin resultado'),
                    'isAuthenticated:\n' + (status?.diagnostic || status?.detail || 'Sin resultado')
                ];
                try {
                    const playerStatus = await playGames.getPlayerStatus();
                    details.push('getCurrentPlayer:\n' + (playerStatus?.diagnostic || playerStatus?.detail || 'Sin resultado'));
                } catch (playerError) {
                    details.push('getCurrentPlayer:\n' + (playerError?.message || String(playerError)));
                }
                showNotice('Diagnóstico Play Games\n\n' + details.join('\n\n'));
            }
        } catch (error) {
            const detail = error?.message || 'No se pudo iniciar sesión';
            setStatus(false, detail);
            showNotice('Play Games: ' + detail);
        } finally {
            button.disabled = false;
        }
    });

    refreshStatus().then((status) => {
        if (status?.authenticated) refreshPlayerIdentity().then(() => runSafePlayGamesDiagnostic({ visible: true }));
    });
    setTimeout(() => refreshStatus().then((status) => {
        if (status?.authenticated) refreshPlayerIdentity();
    }), 500);
    setTimeout(() => refreshStatus().then((status) => {
        if (status?.authenticated) refreshPlayerIdentity();
    }), 1500);
})();
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
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.45)'
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

    if (!isAndroidApp()) return;
    setStatus(false);

    window.unlockPlayGamesAchievement = async (achievementId) => {
        const playGames = getPlayGames();
        if (!playGames || !achievementId) return false;
        try {
            const status = await playGames.getAuthStatus();
            if (!status.authenticated) return false;
            await playGames.unlockAchievement({ achievementId });
            return true;
        } catch (error) {
            console.warn('No se pudo desbloquear el logro de Play Games:', error);
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
                showNotice('Google Play Games conectado ✓', true);
            } else {
                let detail = status?.detail || signedIn?.detail || 'Google no confirmó la sesión';
                try {
                    const playerStatus = await playGames.getPlayerStatus();
                    if (playerStatus?.detail) detail = playerStatus.detail;
                } catch (playerError) {
                    detail = playerError?.message || detail;
                }
                showNotice('Play Games: ' + detail);
            }
        } catch (error) {
            const detail = error?.message || 'No se pudo iniciar sesión';
            setStatus(false, detail);
            showNotice('Play Games: ' + detail);
        } finally {
            button.disabled = false;
        }
    });

    refreshStatus();
    setTimeout(refreshStatus, 500);
    setTimeout(refreshStatus, 1500);
})();
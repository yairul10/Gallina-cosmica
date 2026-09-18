/* Acceso a Google Play Games: visible en Android y seguro ante cargas tardías de Capacitor. */
(() => {
    const button = document.getElementById('playGamesBtn');
    if (!button) return;

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
    // Debe verse incluso mientras el puente nativo termina de inicializar.
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
        if (!playGames) return;
        try {
            const result = await playGames.getAuthStatus();
            setStatus(!!result.authenticated);
        } catch (_) {
            setStatus(false, 'Google Play Games no está disponible');
        }
    };

    button.addEventListener('click', async () => {
        const playGames = getPlayGames();
        if (!playGames) {
            setStatus(false, 'Google Play Games se está inicializando');
            return;
        }

        button.disabled = true;
        button.textContent = '…';
        button.title = 'Conectando con Google Play Games…';
        try {
            await playGames.signIn();
            // El SDK puede tardar un instante en publicar el estado de sesión.
            await new Promise((resolve) => setTimeout(resolve, 700));
            await refreshStatus();
        } catch (_) {
            setStatus(false, 'No se pudo conectar a Google Play Games');
        } finally {
            button.disabled = false;
        }
    });

    refreshStatus();
    // Reintento breve: evita que una carga lenta del WebView oculte el botón.
    setTimeout(refreshStatus, 500);
    setTimeout(refreshStatus, 1500);
})();
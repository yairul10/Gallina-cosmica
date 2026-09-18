/* Botón de acceso visible solo en Android mediante Capacitor. */
(() => {
    const button = document.getElementById('playGamesBtn');
    const capacitor = window.Capacitor;
    const setStatus = (authenticated, message) => {
        button.textContent = authenticated ? '🎮✓' : '🎮';
        button.title = message || (authenticated ? 'Google Play Games conectado' : 'Conectar con Google Play Games');
        button.style.display = 'inline-flex';
        button.style.color = authenticated ? '#86efac' : '#dffcff';
    };
    const isNativeAndroid = () => {
        if (!capacitor) return false;
        const platform = typeof capacitor.getPlatform === 'function'
            ? capacitor.getPlatform()
            : '';
        return platform === 'android'
            || (typeof capacitor.isNativePlatform === 'function'
                && capacitor.isNativePlatform() && /Android/i.test(navigator.userAgent));
    };

    if (!button || !isNativeAndroid()) return;
    // El icono debe quedar disponible aunque la consulta de estado falle.
    setStatus(false);
    // Capacitor puede exponer los plugins nativos por Plugins o por registerPlugin.
    const playGames = capacitor.Plugins?.PlayGames
        || (typeof capacitor.registerPlugin === 'function'
            ? capacitor.registerPlugin('PlayGames')
            : null);
    if (!playGames) {
        button.title = 'Google Play Games no está disponible';
        return;
    }
    const refreshStatus = async () => {
        try {
            const result = await playGames.getAuthStatus();
            setStatus(!!result.authenticated);
        } catch (_) {
            setStatus(false, 'Google Play Games no está disponible');
        }
    };

    button.addEventListener('click', async () => {
        button.disabled = true;
        button.textContent = '…';
        button.title = 'Conectando con Google Play Games…';
        try {
            const result = await playGames.signIn();
            setStatus(!!result.authenticated, result.authenticated
                ? 'Google Play Games conectado'
                : 'No se pudo conectar a Google Play Games');
        } catch (_) {
            setStatus(false, 'No se pudo conectar a Google Play Games');
        } finally {
            button.disabled = false;
        }
    });
    refreshStatus();
})();
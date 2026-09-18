/* Botón de acceso visible solo en Android mediante Capacitor. */
(() => {
    const button = document.getElementById('playGamesBtn');
    const capacitor = window.Capacitor;
    if (!button || !capacitor || capacitor.getPlatform?.() !== 'android' || !capacitor.registerPlugin) return;

    const playGames = capacitor.registerPlugin('PlayGames');
    const setStatus = (authenticated, message) => {
        button.textContent = authenticated ? '🎮✓' : '🎮';
        button.title = message || (authenticated ? 'Google Play Games conectado' : 'Conectar con Google Play Games');
        button.style.display = 'inline-flex';
        button.style.color = authenticated ? '#86efac' : '#dffcff';
    };
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
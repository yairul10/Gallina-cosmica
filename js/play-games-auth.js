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
    // Puente reutilizable para logros oficiales de Google Play Games.\n    window.unlockPlayGamesAchievement = async (achievementId) => {\n        if (!achievementId) return false;\n        try {\n            const status = await playGames.getAuthStatus();\n            if (!status.authenticated) return false;\n            await playGames.unlockAchievement({ achievementId });\n            return true;\n        } catch (error) {\n            console.warn('No se pudo desbloquear el logro de Play Games:', error);\n            return false;\n        }\n    };\n\n    const refreshStatus = async () => {
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
            // El resultado de signIn puede llegar antes de que el SDK actualice
            // su estado interno; se consulta de nuevo antes de mostrarlo.
            await playGames.signIn();
            await new Promise((resolve) => setTimeout(resolve, 700));
            const status = await playGames.getAuthStatus();
            setStatus(!!status.authenticated, status.authenticated
                ? 'Google Play Games conectado'
                : 'Google Play Games no confirmó la sesión');
        } catch (_) {
            setStatus(false, 'No se pudo conectar a Google Play Games');
        } finally {
            button.disabled = false;
        }
    });
    refreshStatus();
})();
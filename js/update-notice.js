/* Aviso opcional de actualizaciones. No bloquea el modo offline. */
(() => {
    const CURRENT_VERSION = '1.4.13';
    const VERSION_URL = 'https://yairul10.github.io/Gallina-cosmica/version.json';

    const versionParts = (version) => String(version || '')
        .replace(/^v/i, '')
        .split('.')
        .map((part) => Number.parseInt(part, 10) || 0);

    const isNewer = (remoteVersion, localVersion) => {
        const remote = versionParts(remoteVersion);
        const local = versionParts(localVersion);
        const length = Math.max(remote.length, local.length);
        for (let index = 0; index < length; index += 1) {
            if ((remote[index] || 0) !== (local[index] || 0)) {
                return (remote[index] || 0) > (local[index] || 0);
            }
        }
        return false;
    };

    const openStore = (url) => {
        try {
            const browser = window.Capacitor?.Plugins?.Browser;
            if (browser?.open) {
                browser.open({ url });
                return;
            }
        } catch (_) {}
        window.open(url, '_blank', 'noopener');
    };

    const showUpdateNotice = (data) => {
        const version = String(data.latestVersion || '').trim();
        if (!version || !isNewer(version, CURRENT_VERSION)) return;

        const dismissedKey = `gallina_update_notice_dismissed_${version}`;
        if (sessionStorage.getItem(dismissedKey)) return;

        const overlay = document.createElement('div');
        overlay.id = 'updateNoticeOverlay';
        Object.assign(overlay.style, {
            position: 'fixed', inset: '0', zIndex: '1000', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '22px',
            background: 'rgba(2, 6, 23, 0.72)', backdropFilter: 'blur(4px)'
        });

        const card = document.createElement('section');
        Object.assign(card.style, {
            width: 'min(360px, 100%)', padding: '22px', borderRadius: '20px',
            textAlign: 'center', color: '#f8fafc', background: 'linear-gradient(145deg, #172554, #1e1b4b)',
            border: '1px solid #60a5fa', boxShadow: '0 16px 42px rgba(0, 0, 0, 0.55)'
        });

        const title = document.createElement('h2');
        title.textContent = '🚀 Nueva actualización';
        title.style.cssText = 'margin:0 0 9px;font:800 1.25rem/1.2 sans-serif;color:#fbbf24;';
        const text = document.createElement('p');
        text.textContent = data.message || 'Hay una nueva versión de Gallina Cósmica disponible.';
        text.style.cssText = 'margin:0 0 7px;font:600 .92rem/1.45 sans-serif;';
        const versionText = document.createElement('p');
        versionText.textContent = `Versión disponible: ${version}`;
        versionText.style.cssText = 'margin:0 0 18px;font:700 .78rem/1.35 sans-serif;color:#bfdbfe;';

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:10px;justify-content:center;';
        const later = document.createElement('button');
        later.type = 'button';
        later.textContent = 'Más tarde';
        later.style.cssText = 'flex:1;border:1px solid #64748b;border-radius:11px;padding:11px 8px;background:#334155;color:#fff;font:800 .85rem sans-serif;';
        later.addEventListener('click', () => {
            sessionStorage.setItem(dismissedKey, '1');
            overlay.remove();
        });
        const update = document.createElement('button');
        update.type = 'button';
        update.textContent = 'Actualizar';
        update.style.cssText = 'flex:1;border:1px solid #fde68a;border-radius:11px;padding:11px 8px;background:#d97706;color:#fff;font:800 .85rem sans-serif;box-shadow:0 0 16px rgba(251,191,36,.3);';
        update.addEventListener('click', () => openStore(data.playStoreUrl || 'https://play.google.com/store/apps/details?id=com.gallinacosmica.app'));

        actions.append(later, update);
        card.append(title, text, versionText, actions);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
    };

    const checkForUpdate = async () => {
        if (!navigator.onLine) return;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        try {
            const response = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
                cache: 'no-store', signal: controller.signal
            });
            if (response.ok) showUpdateNotice(await response.json());
        } catch (_) {
            // Sin red, portal cautivo o servidor no disponible: el juego continúa igual.
        } finally {
            clearTimeout(timeout);
        }
    };

    window.GallinaUpdateNotice = { checkForUpdate, currentVersion: CURRENT_VERSION };
    window.addEventListener('load', () => setTimeout(checkForUpdate, 1200), { once: true });
})();

(() => {
'use strict';
const config = window.GallinaAdConfig || {};
const isTestMode = config.mode !== 'production';
const rewardedId = isTestMode ? 'ca-app-pub-3940256099942544/5224354917' : config.rewardedId;
const DAILY_REVIVES = 3, DAILY_COINS = 3, COIN_REWARD = 5000, SHIP_ADS = 3;
let initialized = false, busy = false;
const plugin = () => window.Capacitor?.Plugins?.AdMob || null;
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
function progress() {
    if (!gameStats.adRewards || typeof gameStats.adRewards !== 'object') gameStats.adRewards = {};
    const p = gameStats.adRewards;
    if (p.day !== today()) { p.day = today(); p.revives = 0; p.coins = 0; }
    p.revives = Math.max(0, Math.floor(Number(p.revives) || 0));
    p.coins = Math.max(0, Math.floor(Number(p.coins) || 0));
    p.ship = Math.max(0, Math.floor(Number(p.ship) || 0));
    return p;
}
function refreshUI() {
    const p = progress();
    const revive = document.getElementById('reviveAdBtn');
    if (revive) {
        revive.disabled = busy || p.revives >= DAILY_REVIVES;
        revive.style.opacity = revive.disabled ? .55 : 1;
        revive.textContent = p.revives >= DAILY_REVIVES
            ? '📺 Límite diario de anuncios para revivir'
            : `📺 Ver anuncio${isTestMode ? " de prueba" : ""} y revivir (${DAILY_REVIVES - p.revives}/${DAILY_REVIVES} hoy)`;
    }
    const coinButton = document.getElementById('adCoinsBtn');
    if (coinButton) coinButton.disabled = busy || p.coins >= DAILY_COINS;
    document.getElementById('adCoinsCount')?.replaceChildren(`${p.coins}/${DAILY_COINS} anuncios de monedas hoy`);
    const owned = !!gameStats.skins?.[1];
    const shipButton = document.getElementById('adShipBtn');
    if (shipButton) { shipButton.disabled = busy || owned; shipButton.textContent = owned ? 'Nave desbloqueada' : isTestMode ? '📺 Ver anuncio de prueba' : '📺 Ver anuncio'; }
    document.getElementById('adShipCount')?.replaceChildren(owned ? 'Ya tienes Oveja Base.' : `${Math.min(p.ship, SHIP_ADS)}/${SHIP_ADS} anuncios completos`);
}
async function init() {
    const ad = plugin();
    if (!ad) return false;
    if (initialized && isTestMode) return true;
    try {
        if (!isTestMode && !/^ca-app-pub-[0-9]{16}[/][0-9]{10}$/.test(rewardedId || '')) return false;
        if (!initialized) {
            await ad.initialize(isTestMode ? { initializeForTesting: true } : {});
            initialized = true;
        }
        if (isTestMode) return true;
        let consent = await ad.requestConsentInfo();
        const privacyRequired = consent?.privacyOptionsRequirementStatus === 'REQUIRED';
        if (consent?.isConsentFormAvailable && consent.status === 'REQUIRED') {
            consent = await ad.showConsentForm();
        }
        const privacy = document.getElementById('adPrivacyBtn');
        if (privacy) privacy.style.display =
            privacyRequired ? 'block' : 'none';
        return consent?.canRequestAds === true;
    } catch (e) {
        console.warn('[AdMob] init/consent', e);
        return false;
    }
}
async function showRewardedAd(onReward, status) {
    if (busy) return false;
    busy = true; refreshUI();
    const ad = plugin();
    if (!ad) { status?.('Los anuncios solo están disponibles en la app Android.'); busy = false; refreshUI(); return false; }
    let rewardHandle, dismissHandle, failHandle, finished = false, rewarded = false;
    const cleanup = async () => {
        if (finished) return;
        finished = true;
        await Promise.allSettled([rewardHandle, dismissHandle, failHandle].map(h => h?.remove?.()));
        busy = false; refreshUI();
    };
    try {
        if (!await init()) throw new Error('No se pudo iniciar AdMob');
        status?.('📺 Cargando anuncio…');
        rewardHandle = await ad.addListener('onRewardedVideoAdReward', async () => {
            if (rewarded || finished) return;
            rewarded = true;
            try { onReward?.(); }
            catch (e) { console.error('[AdMob TEST] reward', e); status?.('No se pudo entregar la recompensa.'); }
            finally { await cleanup(); }
        });
        dismissHandle = await ad.addListener('onRewardedVideoAdDismissed', () => {
            setTimeout(async () => {
                if (!rewarded && !finished) { status?.('Anuncio cerrado antes de obtener la recompensa.'); await cleanup(); }
            }, 500);
        });
        failHandle = await ad.addListener('onRewardedVideoAdFailedToShow', async () => {
            status?.('No se pudo mostrar el anuncio. Intenta nuevamente.'); await cleanup();
        });
        await ad.prepareRewardVideoAd({ adId: rewardedId, isTesting: isTestMode });
        status?.('📺 Anuncio listo…');
        ad.showRewardVideoAd().catch(async e => {
            console.warn('[AdMob TEST] show', e);
            if (!rewarded && !finished) { status?.('No se pudo completar el anuncio.'); await cleanup(); }
        });
        return true;
    } catch (e) {
        console.warn('[AdMob TEST]', e);
        status?.('No se pudo cargar el anuncio. Comprueba tu conexión y la configuración de privacidad.');
        await cleanup();
        return false;
    }
}
function canRevive() { return progress().revives < DAILY_REVIVES; }
function showReviveAd(revive, status) {
    if (!canRevive()) { status?.('Ya usaste los 3 anuncios para revivir de hoy.'); refreshUI(); return Promise.resolve(false); }
    return showRewardedAd(() => {
        if (!canRevive()) return;
        if (revive?.() === false) return;
        progress().revives++;
        saveStats();
        status?.('✅ Reviviste con un anuncio.');
        refreshUI();
    }, status);
}
function watchCoins() {
    if (progress().coins >= DAILY_COINS) return;
    const status = text => document.getElementById('adShopStatus')?.replaceChildren(text);
    return showRewardedAd(() => {
        const p = progress();
        if (p.coins >= DAILY_COINS) return;
        p.coins++;
        gameStats.savedCoins = (Number(gameStats.savedCoins) || 0) + COIN_REWARD;
        gameStats.totalCoins = (Number(gameStats.totalCoins) || 0) + COIN_REWARD;
        coins = gameStats.savedCoins;
        saveStats();
        document.getElementById('coinVal')?.replaceChildren(String(coins));
        window.refreshGallinaEquipmentUI?.();
        status('✅ Recibiste 5.000 monedas.');
    }, status);
}
function watchShip() {
    if (gameStats.skins?.[1]) return;
    const status = text => document.getElementById('adShopStatus')?.replaceChildren(text);
    return showRewardedAd(() => {
        if (gameStats.skins?.[1]) return;
        const p = progress();
        p.ship = Math.min(SHIP_ADS, p.ship + 1);
        if (p.ship >= SHIP_ADS) gameStats.skins[1] = true;
        saveStats();
        window.refreshGallinaEquipmentUI?.();
        status(p.ship >= SHIP_ADS ? '✅ Oveja Base desbloqueada.' : `✅ Anuncio completado: ${p.ship}/${SHIP_ADS} para Oveja Base.`);
    }, status);
}
async function openPrivacyOptions() {
    try { await plugin()?.showPrivacyOptionsForm?.(); }
    catch (e) { console.warn('[AdMob] privacy options', e); }
}
window.GallinaAds = { init, showReviveAd, showRewardedAd, watchCoins, watchShip, canRevive, refreshUI, openPrivacyOptions, isTestMode };
})();

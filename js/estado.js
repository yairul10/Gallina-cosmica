const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 420;
// En móviles altos ampliamos el área lógica vertical en vez de estirar el
// lienzo de 420x640. Así el fondo y los controles ocupan toda la pantalla sin
// deformar naves, enemigos ni sus colisiones.
const mobileViewportRatio = window.innerHeight / Math.max(1, window.innerWidth);
canvas.height = window.innerWidth <= 600
    ? Math.max(640, Math.round(canvas.width * mobileViewportRatio))
    : 640;

let gameStats = JSON.parse(localStorage.getItem((typeof window.gallinaPlayerStorageKey === 'function' ? window.gallinaPlayerStorageKey('farm_space_stats') : 'farm_space_stats'))) || {};

if (gameStats.totalGames === undefined) gameStats.totalGames = 0;
if (gameStats.totalKills === undefined) gameStats.totalKills = 0;
if (gameStats.totalCoins === undefined) gameStats.totalCoins = 0;
if (gameStats.totalLivesBought === undefined) gameStats.totalLivesBought = 0;
if (gameStats.savedCoins === undefined) gameStats.savedCoins = 0;
if (gameStats.tutorialCompleted === undefined) gameStats.tutorialCompleted = false;
if (gameStats.lastLoginDate === undefined) gameStats.lastLoginDate = 0;
if (gameStats.loginStreak === undefined) gameStats.loginStreak = 0;
if (!gameStats.controlMode) gameStats.controlMode = 'drag';
if (!gameStats.pendingBooster) gameStats.pendingBooster = 1.0;

// Variables de Módulos (Auto-Vida)
if (gameStats.extraModule === undefined) gameStats.extraModule = false;
if (gameStats.equipExtraModule === undefined) gameStats.equipExtraModule = false;
let moduleActiveInMatch = false;
let moduleUsed = false;

if (!gameStats.skins) gameStats.skins = [true, false, false, false]; 
if (!gameStats.proSkins) gameStats.proSkins = [false, false, false, false]; 
if (gameStats.selectedShip === undefined) gameStats.selectedShip = 0; 
if (gameStats.useProShip === undefined) gameStats.useProShip = false;
if (gameStats.gallinaChile === undefined) gameStats.gallinaChile = false;
if (gameStats.useGallinaChile === undefined) gameStats.useGallinaChile = false;

if (!gameStats.proMissiles) gameStats.proMissiles = [false, false, false, false];

function saveStats() {
    localStorage.setItem((typeof window.gallinaPlayerStorageKey === 'function' ? window.gallinaPlayerStorageKey('farm_space_stats') : 'farm_space_stats'), JSON.stringify(gameStats));
    scheduleCloudProgressSave();
}

// Premios de torneo confirmados por el servidor.
// Guardamos también el ID del premio aplicado para que una recarga o un fallo
// de red entre la entrega local y el ACK del servidor no duplique monedas.
if (!Array.isArray(gameStats.cloudRewardIds)) gameStats.cloudRewardIds = [];

window.gallinaApplyCloudCoinReward = (rewardId, amount) => {
    const id = String(rewardId);
    const coins = Number(amount);
    if (!id || !Number.isFinite(coins) || coins <= 0) {
        return { success: false, invalid: true };
    }
    if (gameStats.cloudRewardIds.includes(id)) {
        return { success: true, alreadyApplied: true, amount: coins };
    }

    gameStats.savedCoins += coins;
    gameStats.totalCoins += coins;
    gameStats.cloudRewardIds.push(id);
    saveStats();
    return { success: true, applied: true, amount: coins };
};

window.gallinaApplyCloudItemReward = (rewardId, itemId) => {
    const id = String(rewardId);
    if (!id || itemId !== 'gallina_chile') return { success: false, invalid: true };
    if (gameStats.cloudRewardIds.includes(id)) return { success: true, alreadyApplied: true, itemId };
    gameStats.gallinaChile = true;
    gameStats.cloudRewardIds.push(id);
    saveStats();
    return { success: true, applied: true, itemId };
};

const achievData = { 
    'a1': { title: 'Acrobacia Táctil', desc: 'Personaliza la interfaz moviendo los botones.' }, 
    'a2': { title: 'Primer Despegue', desc: 'Completa tu primera partida.' }, 
    'a3': { title: 'Cosecha Estelar', desc: 'Destruye 50 maíces malvados.' }, 
    'a4': { title: 'Coleccionista de Chatarra', desc: 'Recoge 3,000 monedas en total.' },
    'a5': { title: 'Fase 2 Alcanzada', desc: 'Sube a Fase 2 con cualquier nave.' }, 
    'a6': { title: 'Fase 3 Alcanzada', desc: 'Sube a Fase 3 con cualquier nave.' }, 
    'a7': { title: 'Fase Máxima', desc: 'Sube a Fase 4 (Máximo Poder).' }, 
    'a8': { title: 'Poder de Fuego I', desc: 'Sube los disparos al máximo.' }, 
    'a9': { title: 'Piloto Veloz', desc: 'Sube la velocidad al máximo.' }, 
    'a10': { title: 'El Terror del Maizal', desc: 'Derrota a tu primer Jefe Maíz.' }, 
    'a11': { title: 'Puntería de Granjero', desc: 'Destruye 30 enemigos sin perder vida.' }, 
    'a12': { title: 'As del Espejo', desc: 'Derrota a un Jefe con 1 corazón.' }, 
    'a13': { title: 'Vuelo Limpio', desc: '100 segundos sin perder vida.' }, 
    'a14': { title: 'Sobreviviente del Espacio', desc: 'Aguanta 5 minutos sin perder.' }, 
    'a15': { title: 'Cliente Frecuente', desc: 'Compra 10 vidas extras (histórico).' }, 
    'a16': { title: 'Inversión Saludable', desc: 'Compra 10 vidas en una partida.' }, 
    'a18': { title: 'Veterano del Pollo', desc: 'Juega 25 partidas.' }, 
    'a19': { title: 'Leyenda del Vacío', desc: '200,000 puntos en una partida.' }, 
    'a20': { title: 'Dios del Infinito', desc: '500,000 puntos en una partida.' },
    'a21': { title: 'Venciste lo invencible', desc: 'Vence a la dupla Súper Jefe.' },
    'a22': { title: 'Millonario', desc: 'Consigue 100,000 monedas en total.' },
    'a23': { title: 'Multimillonario', desc: 'Reúne 100,000 monedas sin gastarlas.' }
};

let pAchiev = JSON.parse(localStorage.getItem((typeof window.gallinaPlayerStorageKey === 'function' ? window.gallinaPlayerStorageKey('farm_space_achievements') : 'farm_space_achievements'))) || {};
let leaderboard = JSON.parse(localStorage.getItem((typeof window.gallinaPlayerStorageKey === 'function' ? window.gallinaPlayerStorageKey('farm_space_leaderboard') : 'farm_space_leaderboard'))) || [{ name: 'PRO', score: 200000 }, { name: 'ANA', score: 100000 }, { name: 'BOB', score: 50000 }];


function saveLeaderboard() { localStorage.setItem((typeof window.gallinaPlayerStorageKey === 'function' ? window.gallinaPlayerStorageKey('farm_space_leaderboard') : 'farm_space_leaderboard'), JSON.stringify(leaderboard)); }

const CLOUD_PROGRESS_API = 'https://gallina-cosmica-api.jairog940.workers.dev/api/progress';
let cloudProgressReady = false;
let cloudProgressTimer = null;
let cloudProgressSaving = false;

function getOwnedShipIds() {
    const dirs = ['gallina', 'oveja', 'caballo', 'vaca'];
    const owned = [];
    dirs.forEach((dir, i) => {
        if (gameStats.skins[i]) owned.push(dir + '_normal');
        if (gameStats.proSkins[i]) owned.push(dir + '_pro');
    });
    if (gameStats.gallinaChile) owned.push('gallina_chile');
    return [...new Set(owned)];
}

function getEquippedShipId() {
    const dirs = ['gallina', 'oveja', 'caballo', 'vaca'];
    if (gameStats.useGallinaChile) return 'gallina_chile';
    const dir = dirs[gameStats.selectedShip] || 'gallina';
    return dir + (gameStats.useProShip ? '_pro' : '_normal');
}

function getOwnedExtraIds() {
    return gameStats.extraModule ? ['auto_life'] : [];
}

function applyCloudShipId(id) {
    const dirs = ['gallina', 'oveja', 'caballo', 'vaca'];
    if (id === 'gallina_chile') {
        gameStats.gallinaChile = true;
        return;
    }
    const match = /^(gallina|oveja|caballo|vaca)_(normal|pro)$/.exec(String(id || ''));
    if (!match) return;
    const index = dirs.indexOf(match[1]);
    if (index < 0) return;
    if (match[2] === 'pro') gameStats.proSkins[index] = true;
    else gameStats.skins[index] = true;
}

function applyEquippedShipId(id) {
    const dirs = ['gallina', 'oveja', 'caballo', 'vaca'];
    if (id === 'gallina_chile' && gameStats.gallinaChile) {
        gameStats.selectedShip = 0;
        gameStats.useProShip = false;
        gameStats.useGallinaChile = true;
        return;
    }
    const match = /^(gallina|oveja|caballo|vaca)_(normal|pro)$/.exec(String(id || ''));
    if (!match) return;
    const index = dirs.indexOf(match[1]);
    if (index < 0) return;
    const isPro = match[2] === 'pro';
    if ((isPro && !gameStats.proSkins[index]) || (!isPro && !gameStats.skins[index])) return;
    gameStats.selectedShip = index;
    gameStats.useProShip = isPro;
    gameStats.useGallinaChile = false;
}

function localBestScore() {
    return Math.max(Number(gameStats.bestScore || 0), 0);
}

async function saveCloudProgressNow() {
    const identity = window.GallinaPlayerIdentity?.getCurrent?.();
    if (!cloudProgressReady || !identity?.id || cloudProgressSaving) return;
    cloudProgressSaving = true;
    try {
        await fetch(CLOUD_PROGRESS_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                player_id: identity.id,
                player_name: identity.name,
                coins: Number(gameStats.savedCoins || 0),
                high_score: localBestScore(),
                owned_ships: getOwnedShipIds(),
                equipped_ship: getEquippedShipId(),
                owned_extras: getOwnedExtraIds(),
                equipped_extra: gameStats.extraModule && gameStats.equipExtraModule ? 'auto_life' : null
            })
        });
    } catch (error) {
        console.warn('[Progreso] No se pudo guardar en D1.', error);
    } finally {
        cloudProgressSaving = false;
    }
}

function scheduleCloudProgressSave() {
    if (!cloudProgressReady) return;
    clearTimeout(cloudProgressTimer);
    cloudProgressTimer = setTimeout(saveCloudProgressNow, 700);
}

async function loadCloudProgress() {
    const identity = window.GallinaPlayerIdentity?.getCurrent?.();
    if (!identity?.id) return;
    try {
        const response = await fetch(CLOUD_PROGRESS_API + '?player_id=' + encodeURIComponent(identity.id), { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || ('HTTP ' + response.status));
        const progress = data.progress || {};

        // Durante la migración QA conservamos el mayor saldo para no borrar
        // monedas locales antiguas antes de que D1 haya sido inicializado.
        gameStats.savedCoins = Math.max(Number(gameStats.savedCoins || 0), Number(progress.coins || 0));
        coins = gameStats.savedCoins;
        gameStats.bestScore = Math.max(Number(gameStats.bestScore || 0), Number(progress.high_score || 0));

        (Array.isArray(progress.owned_ships) ? progress.owned_ships : []).forEach(applyCloudShipId);
        (Array.isArray(progress.owned_extras) ? progress.owned_extras : []).forEach(id => {
            if (id === 'auto_life') gameStats.extraModule = true;
        });

        if (progress.equipped_ship) applyEquippedShipId(progress.equipped_ship);
        if (progress.equipped_extra === 'auto_life' && gameStats.extraModule) gameStats.equipExtraModule = true;

        localStorage.setItem((typeof window.gallinaPlayerStorageKey === 'function' ? window.gallinaPlayerStorageKey('farm_space_stats') : 'farm_space_stats'), JSON.stringify(gameStats));
        cloudProgressReady = true;
        window.dispatchEvent(new CustomEvent('gallina-cloud-progress-loaded'));
        await saveCloudProgressNow();
    } catch (error) {
        console.warn('[Progreso] No se pudo cargar desde D1.', error);
        cloudProgressReady = true;
    }
}

window.addEventListener('load', loadCloudProgress, { once: true });

let score = 0; let coins = gameStats.savedCoins || 0;
let lives = 3; let gameTime = 0; let gameState = 'START'; let previousState = 'PLAYING';
let currentMatchBooster = 1.0;
let gotTrophy20k = false; let gotTrophy50k = false; let gotTrophy100k = false; let gotTrophy200k = false; let gotTrophy300k = false;
let toastIcon = ""; let toastImg = null; let toastTimer = 0; let toastSubtitle = "";
let evolutionStage = 0; let maxUpgradeLimit = 3; let nextBossScoreThreshold = 5000;
let upgrades = { bullets: 0, speed: 1, armor: 0, dmgBoost: 0, superDmgBoost: 0 };
const player = { x: canvas.width / 2 - 25, y: canvas.height - 110, width: 50, height: 50, baseSpeed: 5.5 };

let bullets = []; let homingMissiles = []; let enemies = []; let bossBullets = []; let bosses = []; let stars = [];
let missileCooldownTimer = 0; const MISSILE_COOLDOWN = 480;

let timeAt40k = 0; let shieldUnlocked = false; let shieldActive = false; let gameRound = 1; let goingToRound = 1;
let sessionKillsNoHit = 0; let sessionTimeNoHit = 0; let sessionLivesBought = 0; let sessionCoinsEarned = 0;
let partialHit = false; let transitionTimer = 0; let doubleBossSpawned = false; let doubleBossDefeated = false;
let evolutionTimer = 0;

let tutorialStep = 0; let bgScrollY = 0;
let joystick = { active: false, baseX: 0, baseY: 0, dx: 0, dy: 0, pointerId: null };

const starColors = ['#ffffff', '#fde047', '#38bdf8', '#f472b6', '#a78bfa'];
for (let i = 0; i < 50; i++) { stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, size: Math.random() * 2.5 + 1, speed: Math.random() * 1.5 + 0.3, color: starColors[Math.floor(Math.random() * starColors.length)], opacity: Math.random() * 0.6 + 0.4 }); }

export const canvas = document.getElementById('gameCanvas');
export const ctx = canvas.getContext('2d');
canvas.width = 420; canvas.height = 640;

export let gameStats = JSON.parse(localStorage.getItem('farm_space_stats')) || { totalGames: 0, totalKills: 0, totalCoins: 0, totalLivesBought: 0, savedCoins: 0, skins: [false, false, false, false], equippedSkins: [false, false, false, false], missiles: [false, false, false, false], equippedMissiles: [false, false, false, false], pendingBooster: 1.0, tutorialCompleted: false };
if (gameStats.tutorialCompleted === undefined) gameStats.tutorialCompleted = false;
if (!gameStats.skins) gameStats.skins = [false, false, false, false];
if (!gameStats.equippedSkins) gameStats.equippedSkins = [false, false, false, false];
if (!gameStats.missiles) gameStats.missiles = [false, false, false, false];
if (!gameStats.equippedMissiles) gameStats.equippedMissiles = [false, false, false, false];
if (!gameStats.pendingBooster) gameStats.pendingBooster = 1.0;

export function saveStats() { localStorage.setItem('farm_space_stats', JSON.stringify(gameStats)); }

export const player = { x: canvas.width / 2 - 25, y: canvas.height - 110, width: 50, height: 50, baseSpeed: 5.5 };

export let score = 0;
export function setScore(val) { score = val; }
export function addScore(val) { score += val; }

export let coins = gameStats.savedCoins || 0;
export function setCoins(val) { coins = val; }
export function addCoins(val) { coins += val; }

export let lives = 3;
export function setLives(val) { lives = val; }

export let gameTime = 0;
export function setGameTime(val) { gameTime = val; }

export let gameState = 'START';
export function setGameState(val) { gameState = val; }

export let previousState = 'PLAYING';
export function setPreviousState(val) { previousState = val; }

export let currentMatchBooster = 1.0;
export function setCurrentMatchBooster(val) { currentMatchBooster = val; }

export let evolutionStage = 0;
export function setEvolutionStage(val) { evolutionStage = val; }

export let maxUpgradeLimit = 3;
export function setMaxUpgradeLimit(val) { maxUpgradeLimit = val; }

export let nextBossScoreThreshold = 5000;
export function setNextBossScoreThreshold(val) { nextBossScoreThreshold = val; }

export let upgrades = { bullets: 0, speed: 1, armor: 0, dmgBoost: 0, superDmgBoost: 0 };

export let bullets = [];
export let homingMissiles = [];
export let missileCooldownTimer = 0;
export function setMissileCooldownTimer(val) { missileCooldownTimer = val; }

export let enemies = [];
export let bossBullets = [];
export let bosses = [];

export let gameRound = 1;
export function setGameRound(val) { gameRound = val; }

export let goingToRound = 1;
export function setGoingToRound(val) { goingToRound = val; }

export let timeAt40k = 0;
export function setTimeAt40k(val) { timeAt40k = val; }

export let shieldUnlocked = false;
export function setShieldUnlocked(val) { shieldUnlocked = val; }

export let shieldActive = false;
export function setShieldActive(val) { shieldActive = val; }

export let partialHit = false;
export function setPartialHit(val) { partialHit = val; }

export let transitionTimer = 0;
export function setTransitionTimer(val) { transitionTimer = val; }

export let sessionKillsNoHit = 0;
export function setSessionKillsNoHit(val) { sessionKillsNoHit = val; }

export let sessionTimeNoHit = 0;
export function setSessionTimeNoHit(val) { sessionTimeNoHit = val; }

export let sessionLivesBought = 0;
export function setSessionLivesBought(val) { sessionLivesBought = val; }

export let sessionCoinsEarned = 0;
export function setSessionCoinsEarned(val) { sessionCoinsEarned = val; }

export let gotTrophy20k = false, gotTrophy50k = false, gotTrophy100k = false, gotTrophy200k = false, gotTrophy300k = false;
export function setGotTrophy20k(val) { gotTrophy20k = val; }
export function setGotTrophy50k(val) { gotTrophy50k = val; }
export function setGotTrophy100k(val) { gotTrophy100k = val; }
export function setGotTrophy200k(val) { gotTrophy200k = val; }
export function setGotTrophy300k(val) { gotTrophy300k = val; }

export let doubleBossSpawned = false;
export function setDoubleBossSpawned(val) { doubleBossSpawned = val; }

export let doubleBossDefeated = false;
export function setDoubleBossDefeated(val) { doubleBossDefeated = val; }

export let toastIcon = "", toastImg = null, toastTimer = 0, toastSubtitle = "";
export function setToastData(icon, img, sub, timer) {
    toastIcon = icon; toastImg = img; toastSubtitle = sub; toastTimer = timer;
}
export function decrementToastTimer() { if (toastTimer > 0) toastTimer--; }

export let tutorialStep = 0;
export function setTutorialStep(val) { tutorialStep = val; }

export let bgScrollY = 0;
export function addBgScrollY(val) { bgScrollY += val; }

export const assets = { 
    fondoGalaxia: new Image(),
    fondoRonda2: new Image(),
    gallina: new Image(), oveja: new Image(), caballo: new Image(), vaca: new Image(), 
    gallinaPro: new Image(), ovejaPro: new Image(), caballoPro: new Image(), vacaPro: new Image(),
    maiz: new Image(), maizFuerte: new Image(), jefeMaiz: new Image(), superJefeMaiz: new Image(),
    lechuga: new Image(), lechugaFuerte: new Image(), jefeLechuga: new Image(), superJefeLechuga: new Image(),
    balaPollito: new Image(), balaLana: new Image(), balaHerradura: new Image(), balaLeche: new Image(),
    balaPollitoPro: new Image(), balaLanaPro: new Image(), balaHerraduraPro: new Image(), balaLechePro: new Image(),
    balaJefe: new Image(), balaLechuga: new Image(),
    trofeoPollito: new Image(), trofeoLana: new Image(), trofeoHerradura: new Image(), trofeoLeche: new Image(), trofeoDiamante: new Image()
};

assets.fondoGalaxia.src = 'assets/fondo_galaxia.png';
assets.fondoRonda2.src = 'assets/fondo_ronda2.png';
assets.gallina.src = 'assets/gallina.png'; assets.oveja.src = 'assets/oveja.png'; assets.caballo.src = 'assets/caballo.png'; assets.vaca.src = 'assets/vaca.png'; 
assets.gallinaPro.src = 'assets/gallina_pro.png'; assets.ovejaPro.src = 'assets/oveja_pro.png'; assets.caballoPro.src = 'assets/caballo_pro.png'; assets.vacaPro.src = 'assets/vaca_pro.png'; 
assets.maiz.src = 'assets/maiz.png'; assets.maizFuerte.src = 'assets/maiz_fuerte.png'; assets.jefeMaiz.src = 'assets/jefe_maiz.png'; assets.superJefeMaiz.src = 'assets/super_jefe_maiz.png';
assets.lechuga.src = 'assets/lechuga.png'; assets.lechugaFuerte.src = 'assets/lechuga_fuerte.png'; assets.jefeLechuga.src = 'assets/lechuga_jefe.png'; assets.superJefeLechuga.src = 'assets/super_jefe_lechuga.png';
assets.balaPollito.src = 'assets/bala_pollito.png'; assets.balaLana.src = 'assets/bala_lana.png'; assets.balaHerradura.src = 'assets/bala_herradura.png'; assets.balaLeche.src = 'assets/bala_leche.png';
assets.balaPollitoPro.src = 'assets/bala_pollito_pro.png'; assets.balaLanaPro.src = 'assets/bala_lana_pro.png'; assets.balaHerraduraPro.src = 'assets/bala_herradura_pro.png'; assets.balaLechePro.src = 'assets/bala_leche_pro.png';
assets.balaJefe.src = 'assets/bala_jefe.png'; assets.balaLechuga.src = 'assets/bala_lechuga.png';
assets.trofeoPollito.src = 'assets/trofeo_pollito.png'; assets.trofeoLana.src = 'assets/trofeo_lana.png'; assets.trofeoHerradura.src = 'assets/trofeo_herradura.png'; assets.trofeoLeche.src = 'assets/trofeo_leche.png'; assets.trofeoDiamante.src = 'assets/trofeo_diamante.png';

export const stars = [];
const starColors = ['#ffffff', '#fde047', '#38bdf8', '#f472b6', '#a78bfa'];
for (let i = 0; i < 50; i++) { 
    stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, size: Math.random() * 2.5 + 1, speed: Math.random() * 1.5 + 0.3, color: starColors[Math.floor(Math.random() * starColors.length)], opacity: Math.random() * 0.6 + 0.4 }); 
}

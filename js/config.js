const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 420; canvas.height = 640;

let gameStats = JSON.parse(localStorage.getItem('farm_space_stats')) || { totalGames: 0, totalKills: 0, totalCoins: 0, totalLivesBought: 0, savedCoins: 0, skins: [false, false, false, false], equippedSkins: [false, false, false, false], missiles: [false, false, false, false], equippedMissiles: [false, false, false, false], pendingBooster: 1.0, tutorialCompleted: false };
if (gameStats.tutorialCompleted === undefined) gameStats.tutorialCompleted = false;
if (!gameStats.skins) gameStats.skins = [false, false, false, false];
if (!gameStats.equippedSkins) gameStats.equippedSkins = [false, false, false, false];
if (!gameStats.missiles) gameStats.missiles = [false, false, false, false];
if (!gameStats.equippedMissiles) gameStats.equippedMissiles = [false, false, false, false];
if (!gameStats.pendingBooster) gameStats.pendingBooster = 1.0;

function saveStats() { localStorage.setItem('farm_space_stats', JSON.stringify(gameStats)); }

let pAchiev = JSON.parse(localStorage.getItem('farm_space_achievements')) || {};
const playlist = ['assets/musica_1.mp3', 'assets/musica_2.mp3', 'assets/musica_3.mp3'];
let currentTrackIndex = 0; 
const bgMusic = new Audio(playlist[currentTrackIndex]); bgMusic.volume = 0.4; 
bgMusic.addEventListener('ended', () => { currentTrackIndex++; if (currentTrackIndex >= playlist.length) currentTrackIndex = 0; bgMusic.src = playlist[currentTrackIndex]; bgMusic.play().catch(e => console.log(e)); });

const baseNames = ['Gallina', 'Oveja', 'Caballo', 'Vaca'];
const misNames = ['Misil Pollito', 'Misil Lana', 'Misil Herradura', 'Misil Lácteo'];
const skinSrc = ['assets/gallina.png', 'assets/oveja.png', 'assets/caballo.png', 'assets/vaca.png'];
const skinProSrc = ['assets/gallina_pro.png', 'assets/oveja_pro.png', 'assets/caballo_pro.png', 'assets/vaca_pro.png'];
const misSrc = ['assets/bala_pollito.png', 'assets/bala_lana.png', 'assets/bala_herradura.png', 'assets/bala_leche.png'];
const misProSrc = ['assets/bala_pollito_pro.png', 'assets/bala_lana_pro.png', 'assets/bala_herradura_pro.png', 'assets/bala_leche_pro.png'];

const assets = { 
    fondoGalaxia: new Image(),
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
assets.gallina.src = 'assets/gallina.png'; assets.oveja.src = 'assets/oveja.png'; assets.caballo.src = 'assets/caballo.png'; assets.vaca.src = 'assets/vaca.png'; 
assets.gallinaPro.src = 'assets/gallina_pro.png'; assets.ovejaPro.src = 'assets/oveja_pro.png'; assets.caballoPro.src = 'assets/caballo_pro.png'; assets.vacaPro.src = 'assets/vaca_pro.png'; 
assets.maiz.src = 'assets/maiz.png'; assets.maizFuerte.src = 'assets/maiz_fuerte.png'; assets.jefeMaiz.src = 'assets/jefe_maiz.png'; assets.superJefeMaiz.src = 'assets/super_jefe_maiz.png';
assets.lechuga.src = 'assets/lechuga.png'; assets.lechugaFuerte.src = 'assets/lechuga_fuerte.png'; assets.jefeLechuga.src = 'assets/lechuga_jefe.png'; assets.superJefeLechuga.src = 'assets/super_jefe_lechuga.png';
assets.balaPollito.src = 'assets/bala_pollito.png'; assets.balaLana.src = 'assets/bala_lana.png'; assets.balaHerradura.src = 'assets/bala_herradura.png'; assets.balaLeche.src = 'assets/bala_leche.png';
assets.balaPollitoPro.src = 'assets/bala_pollito_pro.png'; assets.balaLanaPro.src = 'assets/bala_lana_pro.png'; assets.balaHerraduraPro.src = 'assets/bala_herradura_pro.png'; assets.balaLechePro.src = 'assets/bala_leche_pro.png';
assets.balaJefe.src = 'assets/bala_jefe.png'; assets.balaLechuga.src = 'assets/bala_lechuga.png';
assets.trofeoPollito.src = 'assets/trofeo_pollito.png'; assets.trofeoLana.src = 'assets/trofeo_lana.png'; assets.trofeoHerradura.src = 'assets/trofeo_herradura.png'; assets.trofeoLeche.src = 'assets/trofeo_leche.png'; assets.trofeoDiamante.src = 'assets/trofeo_diamante.png';

let score = 0; let coins = gameStats.savedCoins || 0;
let lives = 3; let gameTime = 0; let gameState = 'START'; let previousState = 'PLAYING';
let currentMatchBooster = 1.0;
let gotTrophy20k = false; let gotTrophy50k = false; let gotTrophy100k = false; let gotTrophy200k = false; let gotTrophy300k = false;
let toastIcon = ""; let toastImg = null; let toastTimer = 0; let toastSubtitle = "";
let evolutionStage = 0; let maxUpgradeLimit = 3; let nextBossScoreThreshold = 5000;
let upgrades = { bullets: 0, speed: 1, armor: 0, dmgBoost: 0, superDmgBoost: 0 };
const player = { x: canvas.width / 2 - 25, y: canvas.height - 110, width: 50, height: 50, baseSpeed: 5.5 };

let bullets = []; 
let homingMissiles = [];
let missileCooldownTimer = 0; const MISSILE_COOLDOWN = 480;
let enemies = []; let bossBullets = []; let bosses = [];
let leaderboard = JSON.parse(localStorage.getItem('farm_space_leaderboard')) || [{ name: 'PRO', score: 200000 }, { name: 'ANA', score: 100000 }, { name: 'BOB', score: 50000 }];

let timeAt40k = 0; let shieldUnlocked = false; let shieldActive = false; let gameRound = 1; let goingToRound = 1;
let sessionKillsNoHit = 0; let sessionTimeNoHit = 0; let sessionLivesBought = 0; let sessionCoinsEarned = 0;
let partialHit = false; let transitionTimer = 0; 
let doubleBossSpawned = false; let doubleBossDefeated = false;

let bgScrollY = 0;
let stars = [];
const starColors = ['#ffffff', '#fde047', '#38bdf8', '#f472b6', '#a78bfa'];
for (let i = 0; i < 50; i++) { stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, size: Math.random() * 2.5 + 1, speed: Math.random() * 1.5 + 0.3, color: starColors[Math.floor(Math.random() * starColors.length)], opacity: Math.random() * 0.6 + 0.4 }); }

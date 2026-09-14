const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 420; canvas.height = 640;

let gameStats = JSON.parse(localStorage.getItem('farm_space_stats')) || {};

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

if (!gameStats.skins) gameStats.skins = [true, false, false, false]; 
if (!gameStats.proSkins) gameStats.proSkins = [false, false, false, false]; 
if (gameStats.selectedShip === undefined) gameStats.selectedShip = 0; 
if (gameStats.useProShip === undefined) gameStats.useProShip = false;

// Los misiles base ahora vienen incluidos con la nave, por lo que solo guardamos los Pro
if (!gameStats.proMissiles) gameStats.proMissiles = [false, false, false, false];

function saveStats() { localStorage.setItem('farm_space_stats', JSON.stringify(gameStats)); }

const achievData = { 
    'a1': { title: 'Acrobacia Táctil', desc: 'Personaliza la interfaz moviendo los botones.' }, 
    'a2': { title: 'Primer Despegue', desc: 'Completa tu primera partida.' }, 
    'a3': { title: 'Cosecha Estelar', desc: 'Destruye 50 maíces malvados.' }, 
    'a4': { title: 'Coleccionista de Chatarra', desc: 'Recoge 300 monedas en total.' }, 
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
    'a22': { title: 'Millonario', desc: 'Consigue 10,000 monedas en total.' },
    'a23': { title: 'Multimillonario', desc: 'Reúne 10,000 monedas sin gastarlas.' }
};

let pAchiev = JSON.parse(localStorage.getItem('farm_space_achievements')) || {};
let leaderboard = JSON.parse(localStorage.getItem('farm_space_leaderboard')) || [{ name: 'PRO', score: 200000 }, { name: 'ANA', score: 100000 }, { name: 'BOB', score: 50000 }];

function saveLeaderboard() { localStorage.setItem('farm_space_leaderboard', JSON.stringify(leaderboard)); }

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

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 420; canvas.height = 640;

// SISTEMA DE GUARDADO ACTUALIZADO
let gameStats = JSON.parse(localStorage.getItem('farm_space_stats')) || { totalGames: 0, totalKills: 0, totalCoins: 0, totalLivesBought: 0, savedCoins: 0, skins: [false, false, false, false], equippedSkins: [false, false, false, false], missiles: [false, false, false, false], equippedMissiles: [false, false, false, false], pendingBooster: 1.0 };
if (!gameStats.skins) gameStats.skins = [false, false, false, false];
if (!gameStats.equippedSkins) gameStats.equippedSkins = [false, false, false, false];
if (!gameStats.missiles) gameStats.missiles = [false, false, false, false];
if (!gameStats.equippedMissiles) gameStats.equippedMissiles = [false, false, false, false];
if (!gameStats.pendingBooster) gameStats.pendingBooster = 1.0;

function saveStats() { localStorage.setItem('farm_space_stats', JSON.stringify(gameStats)); }

// LOGROS ACTUALIZADOS (Se eliminó Multimillonario Épico a17 y se actualizó a4)
const achievData = { 
    'a1': { title: 'Acrobacia Táctil', desc: 'Personaliza la interfaz moviendo los botones.' }, 
    'a2': { title: 'Primer Despegue', desc: 'Completa tu primera partida.' }, 
    'a3': { title: 'Cosecha Estelar', desc: 'Destruye 50 maíces malvados.' }, 
    'a4': { title: 'Coleccionista de Chatarra', desc: 'Recoge 300 monedas en total.' }, 
    'a5': { title: 'Alas de Lana', desc: 'Evoluciona a la Oveja Espacial.' }, 
    'a6': { title: 'Galope Galáctico', desc: 'Alcanza la Nave Caballo.' }, 
    'a7': { title: 'La Vaca Sagrada', desc: 'Desbloquea la Vaca Espacial.' }, 
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

function renderAchievementsList() {
    const listUI = document.getElementById('achievListUI'); listUI.innerHTML = '';
    Object.keys(achievData).forEach(key => { let isUnlocked = pAchiev[key]; let div = document.createElement('div'); div.className = 'achiev-item ' + (isUnlocked ? 'unlocked' : ''); div.innerHTML = (isUnlocked ? '✅ ' : '🔒 ') + achievData[key].title; div.onclick = () => { document.querySelectorAll('.achiev-item').forEach(el => el.classList.remove('selected')); div.classList.add('selected'); document.getElementById('achievNameUI').textContent = achievData[key].title + (isUnlocked ? '' : ' 🔒'); document.getElementById('achievNameUI').style.color = isUnlocked ? '#fbbf24' : '#94a3b8'; document.getElementById('achievDescUI').textContent = achievData[key].desc; }; listUI.appendChild(div); });
}

function unlockAchievement(key) { if (!pAchiev[key]) { pAchiev[key] = true; localStorage.setItem('farm_space_achievements', JSON.stringify(pAchiev)); document.getElementById('achievToastName').textContent = achievData[key].title; const toast = document.getElementById('achievToast'); toast.classList.add('show'); setTimeout(() => { toast.classList.remove('show'); }, 3500); } }

function loadHudPositions() {
    const saved = JSON.parse(localStorage.getItem('farm_space_hud_v7'));
    if (saved) { ['hud-bullets', 'hud-speed', 'hud-life-evolve', 'hud-armor', 'hud-damage', 'hud-super-damage', 'fireBtn'].forEach(id => { if(saved[id] && document.getElementById(id)) { document.getElementById(id).style.left = saved[id].left; document.getElementById(id).style.top = saved[id].top; } }); } 
    else { document.getElementById('hud-bullets').style.left = '16px'; document.getElementById('hud-bullets').style.top = '340px'; document.getElementById('hud-speed').style.left = '16px'; document.getElementById('hud-speed').style.top = '400px'; document.getElementById('hud-life-evolve').style.left = '16px'; document.getElementById('hud-life-evolve').style.top = '460px'; document.getElementById('hud-armor').style.left = '16px'; document.getElementById('hud-armor').style.top = '220px'; document.getElementById('hud-damage').style.left = '16px'; document.getElementById('hud-damage').style.top = '280px'; document.getElementById('hud-super-damage').style.left = '16px'; document.getElementById('hud-super-damage').style.top = '160px'; document.getElementById('fireBtn').style.left = '334px'; document.getElementById('fireBtn').style.top = '540px'; }
}
function saveHudPositions() { const positions = {}; ['hud-bullets', 'hud-speed', 'hud-life-evolve', 'hud-armor', 'hud-damage', 'hud-super-damage', 'fireBtn'].forEach(id => { const el = document.getElementById(id); if(el) positions[id] = { left: el.style.left, top: el.style.top }; }); localStorage.setItem('farm_space_hud_v7', JSON.stringify(positions)); }
loadHudPositions();

const playlist = ['assets/musica_1.mp3', 'assets/musica_2.mp3', 'assets/musica_3.mp3'];
let currentTrackIndex = 0; const bgMusic = new Audio(playlist[currentTrackIndex]); bgMusic.volume = 0.4; 
bgMusic.addEventListener('ended', () => { currentTrackIndex++; if (currentTrackIndex >= playlist.length) currentTrackIndex = 0; bgMusic.src = playlist[currentTrackIndex]; bgMusic.play().catch(e => console.log(e)); });

function pauseGame() { 
    if (gameState === 'PLAYING' || gameState === 'TRANSITION') { 
        previousState = gameState;
        gameState = 'PAUSED'; bgMusic.pause(); document.getElementById('pauseScreen').style.display = 'flex'; document.querySelectorAll('.draggable-btn').forEach(b => b.classList.add('paused')); isDraggingShip = false; dragPointerId = null; 
    } 
}
document.getElementById('muteMenuBtn').addEventListener('click', (e) => { e.stopPropagation(); bgMusic.muted = !bgMusic.muted; e.target.textContent = bgMusic.muted ? '🔇 Activar Música' : '🔊 Silenciar Música'; });
document.getElementById('pauseBtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); pauseGame(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) pauseGame(); });
document.getElementById('resumeBtn').addEventListener('click', (e) => { 
    e.stopPropagation(); 
    if (gameState === 'PAUSED') { 
        gameState = previousState; 
        if (!bgMusic.muted) bgMusic.play().catch(e => console.log(e)); 
        document.getElementById('pauseScreen').style.display = 'none'; document.querySelectorAll('.draggable-btn').forEach(b => b.classList.remove('paused')); 
    } 
});

function closeScreen(id) { document.getElementById(id).style.display = 'none'; document.getElementById('startScreen').style.display = 'flex'; }

// 🛸 LÓGICA DEL HANGAR DINÁMICO
const baseNames = ['Gallina', 'Oveja', 'Caballo', 'Vaca'];
const misNames = ['Misil Pollito', 'Misil Lana', 'Misil Herradura', 'Misil Lácteo'];
const skinSrc = ['assets/gallina.png', 'assets/oveja.png', 'assets/caballo.png', 'assets/vaca.png'];
const skinProSrc = ['assets/gallina_pro.png', 'assets/oveja_pro.png', 'assets/caballo_pro.png', 'assets/vaca_pro.png'];
const misSrc = ['assets/bala_pollito.png', 'assets/bala_lana.png', 'assets/bala_herradura.png', 'assets/bala_leche.png'];
const misProSrc = ['assets/bala_pollito_pro.png', 'assets/bala_lana_pro.png', 'assets/bala_herradura_pro.png', 'assets/bala_leche_pro.png'];

document.getElementById('openHangarBtn').addEventListener('click', () => { updateHangarUI(); document.getElementById('startScreen').style.display = 'none'; document.getElementById('hangarScreen').style.display = 'flex'; });

window.switchHangarTab = function(tab) {
    document.getElementById('tabHangarSkins').classList.remove('active');
    document.getElementById('tabHangarMissiles').classList.remove('active');
    document.getElementById('hangarSkins').style.display = 'none';
    document.getElementById('hangarMissiles').style.display = 'none';
    if (tab === 'skins') { document.getElementById('tabHangarSkins').classList.add('active'); document.getElementById('hangarSkins').style.display = 'grid'; }
    else { document.getElementById('tabHangarMissiles').classList.add('active'); document.getElementById('hangarMissiles').style.display = 'grid'; }
}

function updateHangarUI() {
    for(let i=0; i<4; i++) {
        let btn = document.getElementById('btn-hangar-skin-'+i); 
        let img = document.getElementById('img-hangar-skin-'+i); 
        let name = document.getElementById('name-hangar-skin-'+i); 
        let desc = document.getElementById('desc-hangar-skin-'+i);
        
        if (gameStats.skins[i]) {
            if (gameStats.equippedSkins[i]) { 
                btn.textContent = 'Usar Normal'; 
                btn.style.background = '#f59e0b'; 
                img.src = skinProSrc[i]; 
                name.textContent = baseNames[i] + ' Pro'; 
                desc.innerHTML = '<b style="color:#fbbf24;">+30% Daño</b>'; 
            } else { 
                btn.textContent = 'Equipar Pro'; 
                btn.style.background = '#10b981'; 
                img.src = skinSrc[i]; 
                name.textContent = baseNames[i]; 
                desc.innerHTML = 'Normal'; 
            }
            btn.disabled = false;
        } else {
            btn.textContent = 'Pro Bloqueada'; 
            btn.style.background = '#475569'; 
            img.src = skinSrc[i]; 
            name.textContent = baseNames[i]; 
            desc.innerHTML = 'Normal'; 
            btn.disabled = true;
        }
    }
    
    for(let i=0; i<4; i++) {
        let btn = document.getElementById('btn-hangar-missile-'+i); 
        let img = document.getElementById('img-hangar-missile-'+i); 
        let name = document.getElementById('name-hangar-missile-'+i); 
        let desc = document.getElementById('desc-hangar-missile-'+i);
        
        if (gameStats.missiles[i]) {
            if (gameStats.equippedMissiles[i]) { 
                btn.textContent = 'Usar Normal'; 
                btn.style.background = '#f59e0b'; 
                img.src = misProSrc[i]; 
                name.textContent = misNames[i] + ' Pro'; 
                desc.innerHTML = '<b style="color:#38bdf8;">+20% Daño</b>'; 
            } else { 
                btn.textContent = 'Equipar Pro'; 
                btn.style.background = '#10b981'; 
                img.src = misSrc[i]; 
                name.textContent = misNames[i]; 
                desc.innerHTML = 'Normal'; 
            }
            btn.disabled = false;
        } else {
            btn.textContent = '🔒 Gana el trofeo'; 
            btn.style.background = '#475569'; 
            img.src = misSrc[i]; 
            name.textContent = misNames[i]; 
            desc.innerHTML = 'Normal'; 
            btn.disabled = true;
        }
    }
}

window.toggleHangarSkin = function(index) { gameStats.equippedSkins[index] = !gameStats.equippedSkins[index]; saveStats(); updateHangarUI(); }
window.toggleHangarMissile = function(index) { gameStats.equippedMissiles[index] = !gameStats.equippedMissiles[index]; saveStats(); updateHangarUI(); }

// 🛒 LÓGICA DE TIENDA
document.getElementById('openShopBtn').addEventListener('click', () => { updateShopUI(); document.getElementById('startScreen').style.display = 'none'; document.getElementById('shopScreen').style.display = 'flex'; });
document.getElementById('openRecordsBtn').addEventListener('click', () => { document.getElementById('startScreen').style.display = 'none'; document.getElementById('recordsScreen').style.display = 'flex'; });
document.getElementById('openTrophiesBtn').addEventListener('click', () => { updateTrophyMenu(); document.getElementById('startScreen').style.display = 'none'; document.getElementById('trophiesScreen').style.display = 'flex'; });
document.getElementById('openAchievBtn').addEventListener('click', () => { renderAchievementsList(); document.getElementById('startScreen').style.display = 'none'; document.getElementById('achievScreen').style.display = 'flex'; });
document.getElementById('mainMenuBtn').addEventListener('click', () => { 
    document.getElementById('gameOverScreen').style.display = 'none'; 
    document.getElementById('startScreen').style.display = 'flex'; 
    gameState = 'START'; previousState = 'START';
    document.querySelectorAll('.draggable-btn').forEach(b => b.style.display = 'none'); 
});

window.switchShopTab = function(tab) {
    document.getElementById('tabSkins').classList.remove('active');
    document.getElementById('tabBoosters').classList.remove('active');
    document.getElementById('shopSkins').style.display = 'none';
    document.getElementById('shopBoosters').style.display = 'none';
    if (tab === 'skins') { document.getElementById('tabSkins').classList.add('active'); document.getElementById('shopSkins').style.display = 'grid'; }
    else { document.getElementById('tabBoosters').classList.add('active'); document.getElementById('shopBoosters').style.display = 'grid'; }
}

function updateShopUI() {
    document.getElementById('shopCoinsVal').textContent = coins;
    let skinCosts = [1000, 2000, 4000, 8000];
    for(let i=0; i<4; i++) {
        let btn = document.getElementById('btn-skin-'+i);
        if (gameStats.skins[i]) { 
            btn.textContent = 'Adquirido'; 
            btn.style.background = '#475569'; 
            btn.disabled = true; 
        } else { 
            btn.textContent = `🪙 ${skinCosts[i].toLocaleString()}`; 
            btn.style.background = '#10b981'; 
            btn.disabled = (coins < skinCosts[i]); 
        }
    }
    
    let b20 = document.getElementById('btn-boost-20'); let b50 = document.getElementById('btn-boost-50'); let b100 = document.getElementById('btn-boost-100');
    [b20, b50, b100].forEach(b => { b.textContent = '🪙 ' + b.getAttribute('data-cost'); b.style.background = '#10b981'; b.disabled = false; });
    if (coins < 500) b20.disabled = true; if (coins < 2000) b50.disabled = true; if (coins < 10000) b100.disabled = true;
    
    if (gameStats.pendingBooster === 1.2) { b20.textContent = 'ACTIVADO'; b20.style.background = '#3b82f6'; [b50, b100].forEach(b=>b.disabled=true); }
    else if (gameStats.pendingBooster === 1.5) { b50.textContent = 'ACTIVADO'; b50.style.background = '#3b82f6'; [b20, b100].forEach(b=>b.disabled=true); }
    else if (gameStats.pendingBooster === 2.0) { b100.textContent = 'ACTIVADO'; b100.style.background = '#3b82f6'; [b20, b50].forEach(b=>b.disabled=true); }
}

window.buySkin = function(index, cost) {
    if (!gameStats.skins[index] && coins >= cost) {
        coins -= cost; gameStats.savedCoins = coins; 
        gameStats.skins[index] = true; gameStats.equippedSkins[index] = true;
        saveStats(); updateShopUI();
    }
}

window.buyBooster = function(mult, cost) {
    if (gameStats.pendingBooster === 1.0 && coins >= cost) {
        coins -= cost; gameStats.savedCoins = coins; gameStats.pendingBooster = mult;
        saveStats(); updateShopUI();
    }
}

const trophyData = { 
    '20k': { name: '🥉 Pollito de Bronce', lock: 'Consigue 20,000 pts', unlock: 'Lograste 20,000 pts.', key: 't20k' }, 
    '50k': { name: '🥈 Lana de Plata', lock: 'Consigue 50,000 pts', unlock: 'Lograste 50,000 pts.', key: 't50k' }, 
    '100k': { name: '🏅 Herradura de Oro', lock: 'Consigue 100,000 pts', unlock: 'Lograste 100,000 pts.', key: 't100k' }, 
    '200k': { name: '🏆 Leche Legendaria', lock: 'Consigue 200,000 pts', unlock: 'Lograste 200,000 pts.', key: 't200k' },
    '300k': { name: '💎 Gallina de Diamante', lock: 'Consigue 300,000 pts', unlock: 'Lograste 300,000 pts.', key: 't300k' }
};

function updateTrophyMenu() { 
    let pTrophies = JSON.parse(localStorage.getItem('farm_space_trophies')) || {}; 
    ['20k', '50k', '100k', '200k', '300k'].forEach(id => { 
        let img = document.getElementById(`img-t${id}`); let emoji = document.getElementById(`fall-${id}`); 
        if(img && emoji) {
            if(pTrophies[trophyData[id].key]) { img.className = 'trophy-img trophy-unlocked'; emoji.style.filter = 'none'; emoji.style.opacity = '1'; } 
            else { img.className = 'trophy-img trophy-locked'; emoji.style.filter = 'grayscale(100%)'; emoji.style.opacity = '0.3'; } 
        }
    }); 
}

window.showTrophyInfo = function(id) { 
    document.querySelectorAll('.trophy-item').forEach(el => el.classList.remove('selected')); 
    document.querySelector(`.trophy-item[data-id="${id}"]`).classList.add('selected'); 
    let pT = JSON.parse(localStorage.getItem('farm_space_trophies')) || {}; 
    let tName = document.getElementById('trophyName'); let tDesc = document.getElementById('trophyDesc'); 
    if(pT[trophyData[id].key]) { tName.textContent = trophyData[id].name; tName.style.color = '#fbbf24'; tDesc.textContent = `¡Felicidades! ${trophyData[id].unlock}`; } 
    else { tName.textContent = trophyData[id].name + ' 🔒'; tName.style.color = '#94a3b8'; tDesc.textContent = `Meta: ${trophyData[id].lock}`; } 
}
function savePersistentTrophy(key) { let pT = JSON.parse(localStorage.getItem('farm_space_trophies')) || {}; if (!pT[key]) { pT[key] = true; localStorage.setItem('farm_space_trophies', JSON.stringify(pT)); } }

const assets = { 
    gallina: new Image(), oveja: new Image(), caballo: new Image(), vaca: new Image(), 
    gallinaPro: new Image(), ovejaPro: new Image(), caballoPro: new Image(), vacaPro: new Image(),
    maiz: new Image(), maizFuerte: new Image(), jefeMaiz: new Image(), superJefeMaiz: new Image(),
    lechuga: new Image(), lechugaFuerte: new Image(), jefeLechuga: new Image(), superJefeLechuga: new Image(),
    balaPollito: new Image(), balaLana: new Image(), balaHerradura: new Image(), balaLeche: new Image(),
    balaPollitoPro: new Image(), balaLanaPro: new Image(), balaHerraduraPro: new Image(), balaLechePro: new Image(),
    balaJefe: new Image(), balaLechuga: new Image(),
    trofeoPollito: new Image(), trofeoLana: new Image(), trofeoHerradura: new Image(), trofeoLeche: new Image(), trofeoDiamante: new Image()
};
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
let bullets = []; let enemies = []; let bossBullets = []; let stars = [];
let bosses = [];
let leaderboard = JSON.parse(localStorage.getItem('farm_space_leaderboard')) || [{ name: 'PRO', score: 200000 }, { name: 'ANA', score: 100000 }, { name: 'BOB', score: 50000 }];

let timeAt40k = 0; let shieldUnlocked = false; let shieldActive = false; let gameRound = 1; let goingToRound = 1;
let sessionKillsNoHit = 0; let sessionTimeNoHit = 0; let sessionLivesBought = 0; let sessionCoinsEarned = 0;
let partialHit = false; let transitionTimer = 0; 
let doubleBossSpawned = false; let doubleBossDefeated = false;

function saveLeaderboard() { localStorage.setItem('farm_space_leaderboard', JSON.stringify(leaderboard)); }
function renderLeaderboard(elementId) { const container = document.getElementById(elementId); container.innerHTML = ''; if (leaderboard.length === 0) { container.innerHTML = '<div class="lb-row"><span>Sin récords</span><span></span></div>'; return; } leaderboard.forEach((item, index) => { const row = document.createElement('div'); row.className = 'lb-row'; row.innerHTML = `<span>#${index + 1} ${item.name}</span> <span>${item.score} pts</span>`; container.appendChild(row); }); }

for (let i = 0; i < 40; i++) { stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, size: Math.random() * 2 + 1, speed: Math.random() * 0.8 + 0.3 }); }

let keys = { ArrowLeft: false, ArrowRight: false, KeyA: false, KeyD: false };
window.addEventListener('keydown', (e) => { if (e.code in keys) keys[e.code] = true; if (e.code === 'Space' && (gameState === 'PLAYING' || gameState === 'TRANSITION')) shootBullet(); });
window.addEventListener('keyup', (e) => { if (e.code in keys) keys[e.code] = false; });

let dragObj = null; let dragOffX = 0; let dragOffY = 0;
document.querySelectorAll('.draggable-btn').forEach(btn => {
    btn.addEventListener('pointerdown', (e) => {
        e.stopPropagation(); e.preventDefault();
        if (gameState === 'PLAYING' || gameState === 'TRANSITION') {
            const type = btn.getAttribute('data-type');
            if (type === 'fire') shootBullet(); else if (type === 'btn3') { (upgrades.bullets >= maxUpgradeLimit && upgrades.speed >= maxUpgradeLimit && evolutionStage < 3) ? buyUpgrade('evolve') : buyUpgrade('life'); } else buyUpgrade(type);
        } else if (gameState === 'PAUSED') { dragObj = btn; const rect = btn.getBoundingClientRect(); dragOffX = e.clientX - rect.left; dragOffY = e.clientY - rect.top; }
    });
});
document.addEventListener('pointermove', (e) => { if (dragObj && gameState === 'PAUSED') { const containerRect = document.getElementById('game-container').getBoundingClientRect(); let newX = e.clientX - containerRect.left - dragOffX; let newY = e.clientY - containerRect.top - dragOffY; if (newX < 0) newX = 0; if (newY < 0) newY = 0; if (newX > containerRect.width - dragObj.offsetWidth) newX = containerRect.width - dragObj.offsetWidth; if (newY > containerRect.height - dragObj.offsetHeight) newY = containerRect.height - dragObj.offsetHeight; dragObj.style.left = newX + 'px'; dragObj.style.top = newY + 'px'; } });
document.addEventListener('pointerup', (e) => { if (dragObj && gameState === 'PAUSED') { dragObj = null; saveHudPositions(); unlockAchievement('a1'); } });

let isDraggingShip = false; let dragPointerId = null; let lastTouchX = 0;
canvas.addEventListener('pointerdown', (e) => { if (dragPointerId === null && (gameState === 'PLAYING' || gameState === 'TRANSITION')) { dragPointerId = e.pointerId; isDraggingShip = true; lastTouchX = (e.clientX - canvas.getBoundingClientRect().left) * (canvas.width / canvas.getBoundingClientRect().width); } });
canvas.addEventListener('pointermove', (e) => { if (!isDraggingShip || (gameState !== 'PLAYING' && gameState !== 'TRANSITION') || e.pointerId !== dragPointerId) return; const currentTouchX = (e.clientX - canvas.getBoundingClientRect().left) * (canvas.width / canvas.getBoundingClientRect().width); player.x += (currentTouchX - lastTouchX) * (1 + (upgrades.speed * 0.15)); if (player.x < 10) player.x = 10; if (player.x > canvas.width - player.width - 10) player.x = canvas.width - player.width - 10; lastTouchX = currentTouchX; });
window.addEventListener('pointerup', (e) => { if (e.pointerId === dragPointerId) { isDraggingShip = false; dragPointerId = null; } }); window.addEventListener('pointercancel', (e) => { if (e.pointerId === dragPointerId) { isDraggingShip = false; dragPointerId = null; } });

function shootBullet() {
    let bType = 'chick'; if (evolutionStage === 1) bType = 'wool'; if (evolutionStage === 2) bType = 'horseshoe'; if (evolutionStage === 3) bType = 'milk';
    let bulletCount = Math.min((evolutionStage === 3) ? 4 : 3, upgrades.bullets + 1);
    let baseDmg = upgrades.bullets === 0 ? 1 : upgrades.bullets;
    
    let finalDamage = (upgrades.dmgBoost > 0 ? baseDmg * 1.5 : baseDmg) * currentMatchBooster;
    if (upgrades.superDmgBoost > 0) finalDamage *= 1.5; 
    
    let isProMissile = gameStats.equippedMissiles[evolutionStage];
    
    if (gameStats.equippedSkins[evolutionStage]) {
        finalDamage *= 1.30; 
    }
    if (isProMissile) {
        finalDamage *= 1.20; 
    }
    
    const patterns = { 1: [{ dx: 0, offX: player.width / 2 - 8, offY: -10 }], 2: [{ dx: 0, offX: 8, offY: -10 }, { dx: 0, offX: player.width - 24, offY: -10 }], 3: [{ dx: -1.2, offX: 4, offY: -10 }, { dx: 0, offX: player.width / 2 - 8, offY: -14 }, { dx: 1.2, offX: player.width - 20, offY: -10 }], 4: [{ dx: -2.0, offX: 2, offY: -8 }, { dx: -0.6, offX: 12, offY: -14 }, { dx: 0.6, offX: player.width - 28, offY: -14 }, { dx: 2.0, offX: player.width - 18, offY: -8 }] };
    for (let p of (patterns[bulletCount] || patterns[3])) { 
        bullets.push({ x: player.x + p.offX, y: player.y + p.offY, width: 16, height: 16, speed: 10, dx: p.dx, type: bType, damage: finalDamage, isPro: isProMissile }); 
    }
}

window.buyUpgrade = function(type) {
    if (type === 'bullets' && upgrades.bullets < maxUpgradeLimit && coins >= 10) { coins -= 10; gameStats.savedCoins = coins; saveStats(); upgrades.bullets++; if (upgrades.bullets === maxUpgradeLimit) unlockAchievement('a8'); }
    else if (type === 'speed' && upgrades.speed < maxUpgradeLimit && coins >= 10) { coins -= 10; gameStats.savedCoins = coins; saveStats(); upgrades.speed++; if (upgrades.speed === maxUpgradeLimit) unlockAchievement('a9'); }
    else if (type === 'life' && coins >= 15 && lives < 10) { coins -= 15; gameStats.savedCoins = coins; saveStats(); lives++; partialHit = false; updateLivesUI(); gameStats.totalLivesBought++; saveStats(); sessionLivesBought++; if (gameStats.totalLivesBought >= 10) unlockAchievement('a15'); if (sessionLivesBought >= 10) unlockAchievement('a16'); }
    else if (type === 'evolve') { 
        if (upgrades.bullets >= maxUpgradeLimit && upgrades.speed >= maxUpgradeLimit) {
            if (evolutionStage === 0) { evolutionStage = 1; maxUpgradeLimit = 6; unlockAchievement('a5'); } 
            else if (evolutionStage === 1) { evolutionStage = 2; maxUpgradeLimit = 10; unlockAchievement('a6'); } 
            else if (evolutionStage === 2) { evolutionStage = 3; maxUpgradeLimit = 10; unlockAchievement('a7'); }
        }
    }
    else if (type === 'armor' && gameRound >= 2 && coins >= 300 && upgrades.armor === 0) { coins -= 300; gameStats.savedCoins = coins; saveStats(); upgrades.armor = 1; }
    else if (type === 'damage' && gameRound >= 2 && coins >= 200 && upgrades.dmgBoost === 0) { coins -= 200; gameStats.savedCoins = coins; saveStats(); upgrades.dmgBoost = 1; }
    else if (type === 'superDamage' && (gameRound === 3 || goingToRound === 3) && coins >= 1000 && upgrades.superDmgBoost === 0) { coins -= 1000; gameStats.savedCoins = coins; saveStats(); upgrades.superDmgBoost = 1; }
    updateUpgradesHUD();
}

function updateUpgradesHUD() {
    document.getElementById('coinVal').textContent = coins;
    const btnBullets = document.getElementById('hud-bullets'); if (upgrades.bullets >= maxUpgradeLimit) { btnBullets.querySelector('.hud-lvl').textContent = 'MÁX'; btnBullets.querySelector('.hud-cost').style.display = 'none'; } else { btnBullets.querySelector('.hud-lvl').textContent = `Lv.${upgrades.bullets}`; btnBullets.querySelector('.hud-cost').style.display = 'block'; }
    const btnSpeed = document.getElementById('hud-speed'); if (upgrades.speed >= maxUpgradeLimit) { btnSpeed.querySelector('.hud-lvl').textContent = 'MÁX'; btnSpeed.querySelector('.hud-cost').style.display = 'none'; } else { btnSpeed.querySelector('.hud-lvl').textContent = `Lv.${upgrades.speed}`; btnSpeed.querySelector('.hud-cost').style.display = 'block'; }
    const btnLifeEvolve = document.getElementById('hud-life-evolve'); 
    
    if (upgrades.bullets >= maxUpgradeLimit && upgrades.speed >= maxUpgradeLimit && evolutionStage < 3) { 
        btnLifeEvolve.querySelector('.hud-emoji').textContent = '🌟'; btnLifeEvolve.querySelector('.hud-lvl').textContent = 'EVOL.'; btnLifeEvolve.querySelector('.hud-cost').style.display = 'none'; btnLifeEvolve.style.borderColor = '#fbbf24'; 
    } else { 
        btnLifeEvolve.querySelector('.hud-emoji').textContent = '❤️'; 
        if (lives >= 10) { btnLifeEvolve.querySelector('.hud-lvl').textContent = 'MÁX'; btnLifeEvolve.querySelector('.hud-cost').style.display = 'none'; } 
        else { btnLifeEvolve.querySelector('.hud-lvl').textContent = '+1'; btnLifeEvolve.querySelector('.hud-cost').style.display = 'block'; }
        btnLifeEvolve.style.borderColor = 'rgba(56, 189, 248, 0.5)'; 
    }
    
    document.getElementById('pauseBulletsLvl').textContent = upgrades.bullets >= maxUpgradeLimit ? 'MÁX' : `🪙10`;
    document.getElementById('pauseSpeedLvl').textContent = upgrades.speed >= maxUpgradeLimit ? 'MÁX' : `🪙10`;
    
    const pauseEv = document.getElementById('pauseEvolveBtn');
    if (evolutionStage >= 3) pauseEv.style.display = 'none'; else pauseEv.style.display = 'flex';

    const armorBtn = document.getElementById('hud-armor'); const damageBtn = document.getElementById('hud-damage'); const superDmgBtn = document.getElementById('hud-super-damage'); const pauseSuperDmg = document.getElementById('pauseSuperDmgBtn');
    if (gameRound >= 2) { 
        armorBtn.style.display = 'flex'; damageBtn.style.display = 'flex'; 
        if (upgrades.armor > 0) { armorBtn.querySelector('.hud-lvl').textContent = 'MÁX'; armorBtn.querySelector('.hud-cost').style.display = 'none'; } 
        if (upgrades.dmgBoost > 0) { damageBtn.querySelector('.hud-lvl').textContent = 'MÁX'; damageBtn.querySelector('.hud-cost').style.display = 'none'; } 
    } else { armorBtn.style.display = 'none'; damageBtn.style.display = 'none'; }
    
    if (gameRound === 3 || goingToRound === 3) {
        superDmgBtn.style.display = 'flex'; pauseSuperDmg.style.display = 'flex';
        if (upgrades.superDmgBoost > 0) { superDmgBtn.querySelector('.hud-lvl').textContent = 'MÁX'; superDmgBtn.querySelector('.hud-cost').style.display = 'none'; document.getElementById('pauseSuperDmgLvl').textContent = 'MÁX'; }
    } else { superDmgBtn.style.display = 'none'; pauseSuperDmg.style.display = 'none'; }
}

function showTrophyToast(icon, imgObj, subtitle = "") { toastIcon = icon; toastImg = imgObj; toastSubtitle = subtitle; toastTimer = 200; }
function getTrophyHTML(imgObj, emoji) { return (imgObj.complete && imgObj.naturalWidth > 0) ? `<img src="${imgObj.src}" style="height:18px; margin-left:4px; filter: drop-shadow(0 0 2px rgba(255,255,255,0.5));">` : `<span style="margin-left:4px;">${emoji}</span>`; }
function updateTrophiesHUD() { 
    let html = ""; 
    if (gotTrophy20k) html += getTrophyHTML(assets.trofeoPollito, "🥉🐥"); 
    if (gotTrophy50k) html += getTrophyHTML(assets.trofeoLana, "🥈🧶"); 
    if (gotTrophy100k) html += getTrophyHTML(assets.trofeoHerradura, "🏅🧲"); 
    if (gotTrophy200k) html += getTrophyHTML(assets.trofeoLeche, "🏆🥛"); 
    if (gotTrophy300k) html += getTrophyHTML(assets.trofeoDiamante, "💎🐔");
    document.getElementById('trophiesVal').innerHTML = html; 
}

function spawnEnemy() {
    if (bosses.length > 0) return; 
    let difficultyTime = score >= 40000 ? timeAt40k : gameTime;
    let speedMultiplier = 1 + ((difficultyTime / 70) * 0.3); 
    let lastCornHp = 1 + Math.floor((timeAt40k > 0 ? timeAt40k : gameTime) / 12) + (evolutionStage * 5);
    if (lastCornHp < 1) lastCornHp = 1;

    if (gameRound === 3) {
        let scale = Math.floor((score - 250000) / 2000); 
        if (scale < 0) scale = 0;
        let eType = Math.random() > 0.5 ? 'maiz_jefe' : 'lechuga_fuerte';
        let eHp = eType === 'maiz_jefe' ? Math.ceil(lastCornHp * 2.5) + scale : Math.ceil(lastCornHp * 2.0) + scale;
        let ePts = eType === 'maiz_jefe' ? 1200 : 1000;
        let eCoin = eType === 'maiz_jefe' ? 3 : 4;
        enemies.push({ x: Math.random() * (canvas.width - 56 - 20) + 10, y: -60, width: 56, height: 56, hp: eHp, maxHp: eHp, speed: (1.2 + Math.random() * 0.5) * speedMultiplier, wobble: Math.random() * Math.PI, type: eType, pts: ePts, coin: eCoin, shootCooldown: 0 });
        return;
    }

    let eType = 'corn'; let eHp = 1; let ePts = 150; let eCoin = 1;

    if (gameRound === 2) {
        let baseLechugaHp = Math.ceil(lastCornHp * 1.2); let fuerteLechugaHp = Math.ceil(lastCornHp * 1.5); let jefeLechugaHp = Math.ceil(lastCornHp * 2.0);
        if (score >= 100000) { eType = 'lechuga_jefe'; eHp = jefeLechugaHp; ePts = 600; eCoin = 3; }
        else if (score >= 85000) { eType = Math.random() < 0.5 ? 'lechuga_fuerte' : 'lechuga_jefe'; eHp = eType === 'lechuga_jefe' ? jefeLechugaHp : fuerteLechugaHp; ePts = eType === 'lechuga_jefe' ? 600 : 300; eCoin = eType === 'lechuga_jefe' ? 3 : 2; }
        else if (score >= 70000) { eType = 'lechuga_fuerte'; eHp = fuerteLechugaHp; ePts = 300; eCoin = 2; }
        else if (score >= 60000) { eType = Math.random() < 0.5 ? 'lechuga' : 'lechuga_fuerte'; eHp = eType === 'lechuga_fuerte' ? fuerteLechugaHp : baseLechugaHp; ePts = eType === 'lechuga_fuerte' ? 300 : 150; eCoin = eType === 'lechuga_fuerte' ? 2 : 1; }
        else { eType = 'lechuga'; eHp = baseLechugaHp; ePts = 150; eCoin = 1; }
    } else {
        eHp = lastCornHp; 
        if (eHp > 1) { eType = 'corn_strong'; eCoin = 2; } 
        else { eType = 'corn'; eCoin = 1; }
    }
    enemies.push({ x: Math.random() * (canvas.width - 48 - 20) + 10, y: -60, width: 48, height: 48, hp: eHp, maxHp: eHp, speed: (1.2 + Math.random() * 1.0) * speedMultiplier, wobble: Math.random() * Math.PI, type: eType, pts: ePts, coin: eCoin, shootCooldown: 0 });
}

function spawnBoss() { 
    if (nextBossScoreThreshold === 250000 && gameRound === 3) {
        let bossHpM = 1680 * 2; let bossHpL = 6720 * 2; 
        bosses.push({ x: 20, y: -120, width: 140, height: 110, maxHp: bossHpM, hp: bossHpM, speed: 1.5, direction: 1, shootCooldown: 0, minionCooldown: 0, isSuperBoss: true, type: 'corn' });
        bosses.push({ x: canvas.width - 160, y: -180, width: 140, height: 110, maxHp: bossHpL, hp: bossHpL, speed: 1.3, direction: -1, shootCooldown: 20, minionCooldown: 40, isSuperBoss: true, type: 'lechuga' });
        doubleBossSpawned = true;
    }
    else if (nextBossScoreThreshold === 150000 && gameRound === 2) {
        let bossHp = 6720; 
        bosses.push({ x: canvas.width / 2 - 80, y: -120, width: 160, height: 130, maxHp: bossHp, hp: bossHp, speed: 1.4, direction: 1, shootCooldown: 0, minionCooldown: 0, isSuperBoss: true, type: 'lechuga' });
    }
    else if (nextBossScoreThreshold === 50000 && gameRound === 1) {
        let bossHp = 1680; 
        bosses.push({ x: canvas.width / 2 - 80, y: -120, width: 160, height: 130, maxHp: bossHp, hp: bossHp, speed: 1.2, direction: 1, shootCooldown: 0, minionCooldown: 0, isSuperBoss: true, type: 'corn' });
    } 
    else if (gameRound === 1) {
        let bossLevel = Math.floor(score / 5000); let bossHp = Math.floor((60 + (bossLevel * 45)) * 1.5); 
        bosses.push({ x: canvas.width / 2 - 60, y: -100, width: 120, height: 100, maxHp: bossHp, hp: bossHp, speed: 1.5 + (bossLevel * 0.1), direction: 1, shootCooldown: 0, minionCooldown: 0, isSuperBoss: false, type: 'corn' }); 
    }
}

function handleDamage() { 
    if (shieldActive) { shieldActive = false; sessionTimeNoHit = 0; return; }
    if (upgrades.armor > 0) { if (!partialHit) { partialHit = true; sessionTimeNoHit = 0; return; } else { partialHit = false; } }
    lives--; sessionKillsNoHit = 0; sessionTimeNoHit = 0; updateLivesUI(); if (lives <= 0) gameOver(); 
}

function handleCoinEarned(amount) { 
    coins += amount; gameStats.savedCoins = coins; sessionCoinsEarned += amount; gameStats.totalCoins += amount; saveStats(); 
    if (gameStats.totalCoins >= 300) unlockAchievement('a4'); 
    if (gameStats.totalCoins >= 10000) unlockAchievement('a22'); 
    if (coins >= 10000) unlockAchievement('a23'); 
}

document.getElementById('startBtn').addEventListener('click', startGame); document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('saveScoreBtn').addEventListener('click', () => { let initials = document.getElementById('playerInitials').value.toUpperCase().slice(0, 3); if (!initials) initials = 'ABC'; leaderboard.push({ name: initials, score: score }); leaderboard.sort((a, b) => b.score - a.score); if (leaderboard.length > 5) leaderboard = leaderboard.slice(0, 5); saveLeaderboard(); document.getElementById('saveScoreSection').style.display = 'none'; renderLeaderboard('endLeaderboardList'); });

document.getElementById('reviveBtn').addEventListener('click', () => {
    if (coins >= 500) {
        coins -= 500; gameStats.savedCoins = coins; saveStats(); lives = 3; enemies = []; bossBullets = []; shieldActive = true; partialHit = false; 
        updateLivesUI(); updateUpgradesHUD(); document.getElementById('gameOverScreen').style.display = 'none'; 
        document.querySelectorAll('.draggable-btn').forEach(b => { b.style.display = 'flex'; });
        updateUpgradesHUD();
        gameState = 'PLAYING'; previousState = 'PLAYING'; if (!bgMusic.muted) bgMusic.play().catch(e => console.log(e));
        if (window.gameTimerInterval) clearInterval(window.gameTimerInterval);
        window.gameTimerInterval = setInterval(() => { if (gameState === 'PLAYING') { gameTime++; sessionTimeNoHit++; if (sessionTimeNoHit >= 100) unlockAchievement('a13'); if (gameTime >= 300) unlockAchievement('a14'); } }, 1000);
    }
});

function startGame() {
    if (!bgMusic.muted) bgMusic.play().catch(e => console.log(e));
    currentMatchBooster = gameStats.pendingBooster || 1.0;
    gameStats.pendingBooster = 1.0; 
    saveStats();
    
    score = 0; coins = gameStats.savedCoins || 0; lives = 3; gameTime = 0; gameRound = 1; goingToRound = 1; timeAt40k = 0; shieldUnlocked = false; shieldActive = false; partialHit = false;
    sessionKillsNoHit = 0; sessionTimeNoHit = 0; sessionLivesBought = 0; sessionCoinsEarned = 0;
    bullets = []; enemies = []; bossBullets = []; bosses = [];
    evolutionStage = 0; maxUpgradeLimit = 3; nextBossScoreThreshold = 5000; upgrades.bullets = 0; upgrades.speed = 1; upgrades.armor = 0; upgrades.dmgBoost = 0; upgrades.superDmgBoost = 0;
    gotTrophy20k = false; gotTrophy50k = false; gotTrophy100k = false; gotTrophy200k = false; gotTrophy300k = false;
    doubleBossSpawned = false; doubleBossDefeated = false;
    updateTrophiesHUD();
    player.x = canvas.width / 2 - player.width / 2; isDraggingShip = false; dragPointerId = null; document.getElementById('gameCanvas').style.background = '#090d16';
    document.getElementById('scoreVal').textContent = score; document.getElementById('saveScoreSection').style.display = 'block'; document.getElementById('playerInitials').value = 'AAA';
    updateLivesUI(); updateUpgradesHUD(); document.getElementById('startScreen').style.display = 'none'; document.getElementById('gameOverScreen').style.display = 'none';
    
    document.querySelectorAll('.draggable-btn').forEach(b => { b.style.display = 'flex'; });
    updateUpgradesHUD(); 
    
    gameState = 'PLAYING'; previousState = 'PLAYING';
    if (window.gameTimerInterval) clearInterval(window.gameTimerInterval);
    window.gameTimerInterval = setInterval(() => { if (gameState === 'PLAYING') { gameTime++; sessionTimeNoHit++; if (sessionTimeNoHit >= 100) unlockAchievement('a13'); if (gameTime >= 300) unlockAchievement('a14'); } }, 1000);
}

function gameOver() { 
    gameState = 'GAMEOVER'; bgMusic.pause(); clearInterval(window.gameTimerInterval); 
    unlockAchievement('a2'); gameStats.totalGames++; saveStats(); if (gameStats.totalGames >= 25) unlockAchievement('a18'); 
    document.getElementById('finalScore').textContent = score; renderLeaderboard('endLeaderboardList'); 
    document.getElementById('coinsStatus').textContent = `Tienes: 🪙 ${coins}`;
    const reviveBtn = document.getElementById('reviveBtn');
    if (coins >= 500) { reviveBtn.disabled = false; reviveBtn.style.opacity = 1; } else { reviveBtn.disabled = true; reviveBtn.style.opacity = 0.5; }
    document.getElementById('gameOverScreen').style.display = 'flex'; document.querySelectorAll('.draggable-btn').forEach(b => b.style.display = 'none'); 
}

let enemySpawnInterval = 0;
function update() {
    if (gameState === 'TRANSITION') {
        transitionTimer--;
        bullets = []; bossBullets = []; enemies = [];
        for (let s of stars) { s.y += s.speed; if (s.y > canvas.height) s.y = 0; }
        let currentSpeed = player.baseSpeed + (upgrades.speed - 1) * 0.5;
        if (keys.ArrowLeft || keys.KeyA) player.x -= currentSpeed; if (keys.ArrowRight || keys.KeyD) player.x += currentSpeed;
        if (player.x < 10) player.x = 10; if (player.x > canvas.width - player.width - 10) player.x = canvas.width - player.width - 10;
        
        if (transitionTimer <= 0) {
            gameRound = goingToRound;
            if (gameRound === 2) nextBossScoreThreshold = 150000;
            else if (gameRound === 3) nextBossScoreThreshold = 250000;
            
            document.getElementById('gameCanvas').style.background = gameRound === 3 ? '#1f0d0d' : '#06170d';
            document.querySelectorAll('.draggable-btn').forEach(b => { b.style.display = 'flex'; });
            updateUpgradesHUD(); bgMusic.volume = 0.4; gameState = 'PLAYING'; previousState = 'PLAYING';
        }
        return;
    }

    if (gameState !== 'PLAYING') return;

    if (score >= 20000 && !gotTrophy20k) { 
        gotTrophy20k = true; let isNew = !gameStats.missiles[0]; 
        if (isNew) { gameStats.missiles[0] = true; gameStats.equippedMissiles[0] = true; saveStats(); } 
        showTrophyToast("🥉🐥", assets.trofeoPollito, isNew ? "¡Skin Misil Desbloqueada!" : ""); 
        updateTrophiesHUD(); savePersistentTrophy('t20k'); unlockAchievement('a19'); 
    }
    if (score >= 50000 && !gotTrophy50k) { 
        gotTrophy50k = true; let isNew = !gameStats.missiles[1]; 
        if (isNew) { gameStats.missiles[1] = true; gameStats.equippedMissiles[1] = true; saveStats(); } 
        showTrophyToast("🥈🧶", assets.trofeoLana, isNew ? "¡Skin Misil Desbloqueada!" : ""); 
        updateTrophiesHUD(); savePersistentTrophy('t50k'); 
    }
    if (score >= 100000 && !gotTrophy100k) { 
        gotTrophy100k = true; let isNew = !gameStats.missiles[2]; 
        if (isNew) { gameStats.missiles[2] = true; gameStats.equippedMissiles[2] = true; saveStats(); } 
        showTrophyToast("🏅🧲", assets.trofeoHerradura, isNew ? "¡Skin Misil Desbloqueada!" : ""); 
        updateTrophiesHUD(); savePersistentTrophy('t100k'); 
    }
    if (score >= 200000 && !gotTrophy200k) { 
        gotTrophy200k = true; let isNew = !gameStats.missiles[3]; 
        if (isNew) { gameStats.missiles[3] = true; gameStats.equippedMissiles[3] = true; saveStats(); } 
        showTrophyToast("🏆🥛", assets.trofeoLeche, isNew ? "¡Skin Misil Desbloqueada!" : ""); 
        updateTrophiesHUD(); savePersistentTrophy('t200k'); unlockAchievement('a19'); 
    }
    if (score >= 300000 && !gotTrophy300k) { 
        gotTrophy300k = true; let pTrophies = JSON.parse(localStorage.getItem('farm_space_trophies')) || {};
        let sub = "";
        if (!pTrophies['t300k']) {
            if (gameStats.skins[3]) { coins += 4000; gameStats.savedCoins = coins; sub = "Vaca Pro Reembolsada (+4,000🪙)"; } 
            else { gameStats.skins[3] = true; gameStats.equippedSkins[3] = true; sub = "¡Skin Vaca Pro Desbloqueada!"; }
        }
        saveStats(); showTrophyToast("💎🐔", assets.trofeoDiamante, sub); updateTrophiesHUD(); savePersistentTrophy('t300k'); 
    }
    
    if (score >= 500000) unlockAchievement('a20');
    
    if (doubleBossSpawned && !doubleBossDefeated && bosses.length === 0 && score >= 250000) { doubleBossDefeated = true; unlockAchievement('a21'); }

    if (score >= 40000 && !shieldUnlocked) { shieldUnlocked = true; shieldActive = true; timeAt40k = gameTime; }
    if (shieldUnlocked && !shieldActive && sessionTimeNoHit >= 5) { shieldActive = true; }

    if (score >= nextBossScoreThreshold && bosses.length === 0) { 
        let currentThreshold = nextBossScoreThreshold; spawnBoss(); 
        if (gameRound === 1) nextBossScoreThreshold += 5000; 
        else if (gameRound === 2 && currentThreshold === 150000) nextBossScoreThreshold = 9999999; 
        else if (gameRound === 3 && currentThreshold === 250000) nextBossScoreThreshold = 9999999; 
    }

    let currentSpeed = player.baseSpeed + (upgrades.speed - 1) * 0.5;
    if (keys.ArrowLeft || keys.KeyA) player.x -= currentSpeed; if (keys.ArrowRight || keys.KeyD) player.x += currentSpeed;
    if (player.x < 10) player.x = 10; if (player.x > canvas.width - player.width - 10) player.x = canvas.width - player.width - 10;
    for (let s of stars) { s.y += s.speed; if (s.y > canvas.height) s.y = 0; }
    
    for (let i = bullets.length - 1; i >= 0; i--) { bullets[i].y -= bullets[i].speed; if (bullets[i].dx) bullets[i].x += bullets[i].dx; if (bullets[i].y < -20 || bullets[i].x < -30 || bullets[i].x > canvas.width + 30) bullets.splice(i, 1); }
    for (let i = bossBullets.length - 1; i >= 0; i--) {
        bossBullets[i].y += bossBullets[i].speed; if (bossBullets[i].dx) bossBullets[i].x += bossBullets[i].dx;
        if (bossBullets[i].y > canvas.height + 20 || bossBullets[i].x < -20 || bossBullets[i].x > canvas.width + 20) { bossBullets.splice(i, 1); continue; }
        if (player.x < bossBullets[i].x + bossBullets[i].width && player.x + player.width > bossBullets[i].x && player.y < bossBullets[i].y + bossBullets[i].height && player.y + player.height > bossBullets[i].y) { bossBullets.splice(i, 1); handleDamage(); }
    }

    if (bosses.length === 0) { 
        if (gameRound === 3 && score < 250000 && nextBossScoreThreshold === 250000) {
            let hasMaiz = false, hasLechuga = false;
            for (let e of enemies) { if (e.type === 'maiz_jefe') hasMaiz = true; if (e.type === 'lechuga_jefe') hasLechuga = true; }
            let baseHp = 1 + Math.floor(timeAt40k / 12) + (evolutionStage * 5); 
            let eHpM = Math.ceil(baseHp * 2.5); let eHpL = Math.ceil(baseHp * 3.5);
            if (!hasMaiz) enemies.push({ x: Math.random() * (canvas.width - 76) + 10, y: -60, width: 56, height: 56, hp: eHpM, maxHp: eHpM, speed: 1.2, wobble: Math.random() * Math.PI, type: 'maiz_jefe', pts: 800, coin: 3, shootCooldown: 0 });
            if (!hasLechuga) enemies.push({ x: Math.random() * (canvas.width - 76) + 10, y: -60, width: 56, height: 56, hp: eHpL, maxHp: eHpL, speed: 1.0, wobble: Math.random() * Math.PI, type: 'lechuga_jefe', pts: 1000, coin: 3, shootCooldown: 0 });
        } else {
            enemySpawnInterval++; let spawnRate = 40;
            if (gameRound === 3) { spawnRate = Math.max(15, 30 - Math.floor((score - 250000) / 10000)); } 
            else { let diffTime = score >= 40000 ? timeAt40k : gameTime; spawnRate = gameRound >= 2 ? Math.max(25, 50 - Math.floor(diffTime / 10)) : Math.max(20, 45 - Math.floor(diffTime / 10)); }
            if (enemySpawnInterval > spawnRate) { spawnEnemy(); enemySpawnInterval = 0; } 
        }
    }
    
    for (let bIndex = bosses.length - 1; bIndex >= 0; bIndex--) {
        let boss = bosses[bIndex];
        if (boss.y < 50) boss.y += 1; boss.x += boss.speed * boss.direction; if (boss.x < 10 || boss.x + boss.width > canvas.width - 10) boss.direction *= -1;
        boss.shootCooldown++;
        if (boss.isSuperBoss) {
            boss.minionCooldown++;
            if (boss.type === 'corn' && boss.shootCooldown >= 55) {
                boss.shootCooldown = 0;
                bossBullets.push({ x: boss.x + boss.width / 2 - 40, y: boss.y + boss.height - 10, width: 16, height: 16, speed: 6.5, dx: -2.5 }); bossBullets.push({ x: boss.x + boss.width / 2 - 15, y: boss.y + boss.height - 10, width: 16, height: 16, speed: 6.5, dx: -0.8 }); bossBullets.push({ x: boss.x + boss.width / 2 + 15, y: boss.y + boss.height - 10, width: 16, height: 16, speed: 6.5, dx: 0.8 }); bossBullets.push({ x: boss.x + boss.width / 2 + 40, y: boss.y + boss.height - 10, width: 16, height: 16, speed: 6.5, dx: 2.5 });
            }
            if (boss.type === 'corn' && boss.minionCooldown >= 110) {
                boss.minionCooldown = 0; enemies.push({ x: boss.x + 20, y: boss.y + boss.height - 30, width: 48, height: 48, hp: 3, maxHp: 3, speed: 2, wobble: 0, type: 'corn_strong', pts: 150, coin: 2, shootCooldown: 0 }); enemies.push({ x: boss.x + boss.width - 68, y: boss.y + boss.height - 30, width: 48, height: 48, hp: 3, maxHp: 3, speed: 2, wobble: Math.PI, type: 'corn_strong', pts: 150, coin: 2, shootCooldown: 0 });
            }
            if (boss.type === 'lechuga' && boss.shootCooldown >= 45) {
                boss.shootCooldown = 0;
                bossBullets.push({ x: boss.x + boss.width / 2 - 30, y: boss.y + boss.height, width: 16, height: 16, speed: 7, dx: -2.0, isLechugaBala: true });
                bossBullets.push({ x: boss.x + boss.width / 2 - 10, y: boss.y + boss.height, width: 16, height: 16, speed: 7, dx: -0.6, isLechugaBala: true });
                bossBullets.push({ x: boss.x + boss.width / 2 + 10, y: boss.y + boss.height, width: 16, height: 16, speed: 7, dx: 0.6, isLechugaBala: true });
                bossBullets.push({ x: boss.x + boss.width / 2 + 30, y: boss.y + boss.height, width: 16, height: 16, speed: 7, dx: 2.0, isLechugaBala: true });
            }
            if (boss.type === 'lechuga' && boss.minionCooldown >= 90) { boss.minionCooldown = 0; enemies.push({ x: boss.x + boss.width / 2 - 24, y: boss.y + boss.height, width: 48, height: 48, hp: 5, maxHp: 5, type: 'lechuga_fuerte', speed: 1.5, wobble: 0, pts: 300, coin: 2, shootCooldown: 0 }); }
        } else {
            if (boss.shootCooldown >= 40) {
                boss.shootCooldown = 0; let bc = Math.min(4, Math.max(1, score >= 20000 ? 2 + Math.floor((score - 20000) / 20000) : 1));
                let isLB = boss.type === 'lechuga';
                if (bc === 1) { bossBullets.push({ x: boss.x + boss.width / 2 - 6, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: 0, isLechugaBala: isLB }); }
                else if (bc === 2) { bossBullets.push({ x: boss.x + boss.width / 2 - 16, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: -1.2, isLechugaBala: isLB }); bossBullets.push({ x: boss.x + boss.width / 2 + 4, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: 1.2, isLechugaBala: isLB }); }
                else if (bc === 3) { bossBullets.push({ x: boss.x + boss.width / 2 - 24, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: -2, isLechugaBala: isLB }); bossBullets.push({ x: boss.x + boss.width / 2 - 6, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: 0, isLechugaBala: isLB }); bossBullets.push({ x: boss.x + boss.width / 2 + 12, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: 2, isLechugaBala: isLB }); }
                else { bossBullets.push({ x: boss.x + boss.width / 2 - 30, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: -2.5, isLechugaBala: isLB }); bossBullets.push({ x: boss.x + boss.width / 2 - 12, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: -0.8, isLechugaBala: isLB }); bossBullets.push({ x: boss.x + boss.width / 2, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: 0.8, isLechugaBala: isLB }); bossBullets.push({ x: boss.x + boss.width / 2 + 18, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: 2.5, isLechugaBala: isLB }); }
            }
        }

        for (let j = bullets.length - 1; j >= 0; j--) {
            if (bullets[j] && bullets[j].x < boss.x + boss.width && bullets[j].x + bullets[j].width > boss.x && bullets[j].y < boss.y + boss.height && bullets[j].y + bullets[j].height > boss.y) {
                boss.hp -= bullets[j].damage; bullets.splice(j, 1);
                if (boss.hp <= 0) { 
                    score += boss.isSuperBoss ? 4500 : 2250; handleCoinEarned(boss.isSuperBoss ? 6 : 3); 
                    document.getElementById('scoreVal').textContent = score; updateUpgradesHUD(); 
                    if (boss.isSuperBoss && boss.type === 'corn' && gameRound === 1) { gameState = 'TRANSITION'; previousState = 'TRANSITION'; goingToRound = 2; transitionTimer = 300; bgMusic.volume = 0.15; document.querySelectorAll('.draggable-btn').forEach(b => b.style.display = 'none'); updateUpgradesHUD(); } 
                    else if (boss.isSuperBoss && boss.type === 'lechuga' && gameRound === 2) { gameState = 'TRANSITION'; previousState = 'TRANSITION'; goingToRound = 3; transitionTimer = 300; bgMusic.volume = 0.15; document.querySelectorAll('.draggable-btn').forEach(b => b.style.display = 'none'); updateUpgradesHUD(); }
                    bosses.splice(bIndex, 1); unlockAchievement('a10'); if (lives === 1) unlockAchievement('a12'); break; 
                }
            }
        }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        enemies[i].y += enemies[i].speed; enemies[i].wobble += 0.06; enemies[i].x += Math.sin(enemies[i].wobble) * 2.2; 
        
        if (enemies[i].type.includes('jefe') || enemies[i].type === 'lechuga_fuerte') {
            enemies[i].shootCooldown++;
            if (enemies[i].shootCooldown >= 60) {
                enemies[i].shootCooldown = 0; let isL = enemies[i].type.includes('lechuga');
                bossBullets.push({ x: enemies[i].x + enemies[i].width/2 - 6, y: enemies[i].y + enemies[i].height - 10, width: 12, height: 12, speed: 4.5, dx: 0, isLechugaBala: isL });
                if (enemies[i].type === 'lechuga_jefe' && gameRound < 3) { enemies.push({ x: enemies[i].x, y: enemies[i].y + 40, width: 48, height: 48, hp: 3, maxHp: 3, type: 'lechuga', speed: enemies[i].speed * 1.1, wobble: 0, pts: 150, coin: 1, shootCooldown: 0 }); }
                if (enemies[i].type === 'maiz_jefe') { enemies.push({ x: enemies[i].x, y: enemies[i].y + 40, width: 48, height: 48, hp: 4, maxHp: 4, type: 'corn_strong', speed: enemies[i].speed * 1.1, wobble: 0, pts: 150, coin: 2, shootCooldown: 0 }); }
            }
        }

        if (enemies[i].y > canvas.height) { enemies.splice(i, 1); handleDamage(); continue; }
        if (player.x < enemies[i].x + enemies[i].width && player.x + player.width > enemies[i].x && player.y < enemies[i].y + enemies[i].height && player.y + player.height > enemies[i].y) { enemies.splice(i, 1); handleDamage(); continue; }
        for (let j = bullets.length - 1; j >= 0; j--) {
            if (bullets[j] && bullets[j].x < enemies[i].x + enemies[i].width && bullets[j].x + bullets[j].width > enemies[i].x && bullets[j].y < enemies[i].y + enemies[i].height && bullets[j].y + bullets[j].height > enemies[i].y) {
                enemies[i].hp -= bullets[j].damage; bullets.splice(j, 1);
                if (enemies[i].hp <= 0) { 
                    score += enemies[i].pts; handleCoinEarned(enemies[i].coin); document.getElementById('scoreVal').textContent = score; updateUpgradesHUD(); 
                    enemies.splice(i, 1); gameStats.totalKills++; saveStats(); sessionKillsNoHit++;
                    if (gameStats.totalKills >= 50) unlockAchievement('a3'); if (sessionKillsNoHit >= 30) unlockAchievement('a11');
                } break;
            }
        }
    }
}

function updateLivesUI() { 
    document.getElementById('livesVal').textContent = `❤️ x${lives}`; 
}

function drawPlayerShip(x, y) {
    let currentImg;
    if (evolutionStage === 3) currentImg = gameStats.equippedSkins[3] ? assets.vacaPro : assets.vaca; 
    else if (evolutionStage === 2) currentImg = gameStats.equippedSkins[2] ? assets.caballoPro : assets.caballo; 
    else if (evolutionStage === 1) currentImg = gameStats.equippedSkins[1] ? assets.ovejaPro : assets.oveja;
    else currentImg = gameStats.equippedSkins[0] ? assets.gallinaPro : assets.gallina;

    let isPro = gameStats.equippedSkins[evolutionStage] || gameStats.equippedMissiles[evolutionStage];

    if (shieldActive) { ctx.save(); ctx.beginPath(); ctx.arc(x + player.width / 2, y + player.height / 2, 38, 0, Math.PI * 2); ctx.fillStyle = 'rgba(56, 189, 248, 0.2)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)'; ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 10; ctx.stroke(); ctx.restore(); }
    if (upgrades.armor > 0 && !shieldActive) { ctx.save(); ctx.beginPath(); ctx.arc(x + player.width / 2, y + player.height / 2, 34, 0, Math.PI * 2); ctx.fillStyle = partialHit ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.1)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = partialHit ? 'rgba(239, 68, 68, 0.8)' : 'rgba(37, 99, 235, 0.8)'; ctx.stroke(); ctx.restore(); }
    
    if (currentImg.complete && currentImg.naturalWidth > 0) { ctx.drawImage(currentImg, x, y, player.width, player.height); } else {
        ctx.save(); ctx.translate(x, y);
        if (isPro) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 15; }
        if (evolutionStage === 3) { ctx.fillStyle = '#f1f5f9'; ctx.beginPath(); ctx.ellipse(25, 26, 22, 18, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#0f172a'; ctx.fillRect(15, 20, 8, 8); ctx.fillRect(30, 28, 6, 6); } 
        else if (evolutionStage === 2) { ctx.fillStyle = '#a855f7'; ctx.beginPath(); ctx.ellipse(25, 26, 18, 22, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#c084fc'; ctx.fillRect(20, -4, 10, 16); } 
        else if (evolutionStage === 1) { ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.ellipse(25, 26, 20, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(25, 10, 10, 0, Math.PI * 2); ctx.fill(); } 
        else { ctx.fillStyle = '#38bdf8'; ctx.fillRect(16, 42, 6, 10); ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.ellipse(25, 26, 16, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#cbd5e1'; ctx.stroke(); ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.arc(25, 17, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.moveTo(21, 8); ctx.lineTo(29, 8); ctx.lineTo(25, 0); ctx.fill(); ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(22, 2, 3.5, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
    }
}

function drawEnemy(e) {
    let img = null;
    if (e.type === 'corn') img = assets.maiz; else if (e.type === 'corn_strong') img = assets.maizFuerte; else if (e.type === 'maiz_jefe') img = assets.jefeMaiz; else if (e.type === 'lechuga') img = assets.lechuga; else if (e.type === 'lechuga_fuerte') img = assets.lechugaFuerte; else if (e.type === 'lechuga_jefe') img = assets.jefeLechuga;
    if (img && img.complete && img.naturalWidth > 0) { ctx.drawImage(img, e.x, e.y, e.width, e.height); } else {
        ctx.save(); ctx.translate(e.x, e.y); 
        if (e.type.includes('lechuga')) { ctx.fillStyle = e.type === 'lechuga' ? '#22c55e' : (e.type === 'lechuga_fuerte' ? '#166534' : '#14532d'); ctx.beginPath(); ctx.arc(e.width/2, e.height/2, e.width/2 - 4, 0, Math.PI*2); ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle='#052e16'; ctx.stroke(); if(e.type !== 'lechuga') { ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(e.width/2, 10, 10, 0, Math.PI*2); ctx.fill(); }
        } else { ctx.fillStyle = e.type === 'maiz_jefe' ? '#ca8a04' : '#eab308'; ctx.beginPath(); ctx.roundRect(4, 6, e.width-8, e.height-8, [12, 12, 18, 18]); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#854d0e'; ctx.stroke(); if (e.maxHp > 1) { ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.arc(e.width/2, 10, 16, Math.PI, 0, false); ctx.fill(); } }
        ctx.restore();
    }
}

function drawBoss(b) {
    ctx.save(); ctx.translate(b.x, b.y);
    if (b.isSuperBoss) { ctx.shadowColor = b.type==='lechuga' ? 'rgba(34, 197, 94, 0.9)' : 'rgba(220, 38, 38, 0.9)'; ctx.shadowBlur = 20; }
    let bImg = null;
    if (b.type === 'corn') bImg = b.isSuperBoss ? assets.superJefeMaiz : assets.jefeMaiz; else bImg = b.isSuperBoss ? assets.superJefeLechuga : assets.jefeLechuga;
    if (bImg && bImg.complete && bImg.naturalWidth > 0) { ctx.drawImage(bImg, 0, 0, b.width, b.height); } else { ctx.fillStyle = b.type==='corn' ? (b.isSuperBoss ? '#991b1b' : '#ca8a04') : (b.isSuperBoss ? '#064e3b' : '#166534'); ctx.beginPath(); ctx.roundRect(0, 0, b.width, b.height, [20, 20, 30, 30]); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#020617'; ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = '#334155'; ctx.fillRect(b.x + 10, b.y - 15, b.width - 20, 8); ctx.fillStyle = b.isSuperBoss ? '#ef4444' : '#22c55e'; ctx.fillRect(b.x + 10, b.y - 15, (b.width - 20) * (b.hp / b.maxHp), 8);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#334155'; for (let s of stars) { ctx.fillRect(s.x, s.y, s.size, s.size); }
    for (let b of bosses) drawBoss(b); 
    drawPlayerShip(player.x, player.y);
    
    for (let b of bullets) {
        let img; 
        if (b.type === 'milk') img = b.isPro ? assets.balaLechePro : assets.balaLeche; 
        else if (b.type === 'horseshoe') img = b.isPro ? assets.balaHerraduraPro : assets.balaHerradura; 
        else if (b.type === 'wool') img = b.isPro ? assets.balaLanaPro : assets.balaLana; 
        else img = b.isPro ? assets.balaPollitoPro : assets.balaPollito;
        
        if (img.complete && img.naturalWidth > 0) { ctx.drawImage(img, b.x, b.y, b.width, b.height); } 
        else { ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; let icon = '🐥'; if (b.type === 'wool') icon = '🧶'; if (b.type === 'horseshoe') icon = '🧲'; if (b.type === 'milk') icon = '🥛'; ctx.fillText(icon, b.x + b.width / 2, b.y + b.height / 2); }
    }
    
    for (let bb of bossBullets) {
        let imgB = bb.isLechugaBala ? assets.balaLechuga : assets.balaJefe;
        if (imgB.complete && imgB.naturalWidth > 0) { ctx.drawImage(imgB, bb.x, bb.y, bb.width, bb.height); } else { ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(bb.isLechugaBala ? '🥬' : '🌽', bb.x + bb.width / 2, bb.y + bb.height / 2); }
    }
    for (let e of enemies) drawEnemy(e);

    if (toastTimer > 0 && gameState === 'PLAYING') {
        ctx.save(); ctx.globalAlpha = Math.min(1, toastTimer / 30); let floatY = 180 - ((180 - toastTimer) * 0.3); 
        if (toastImg && toastImg.complete && toastImg.naturalWidth > 0) { 
            ctx.shadowColor = 'rgba(255, 215, 0, 0.8)'; ctx.shadowBlur = 20; 
            ctx.drawImage(toastImg, canvas.width / 2 - 40, floatY - 40, 80, 80); 
        } else { 
            ctx.font = '80px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; 
            ctx.shadowColor = 'rgba(255, 215, 0, 0.8)'; ctx.shadowBlur = 20; 
            ctx.fillText(toastIcon, canvas.width / 2, floatY); 
        }
        if (toastSubtitle) {
            ctx.shadowBlur = 4; ctx.shadowColor = 'black';
            ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = '#fbbf24'; ctx.textAlign = 'center';
            ctx.fillText(toastSubtitle, canvas.width / 2, floatY + 60);
        }
        ctx.restore(); toastTimer--;
    }

    if (gameState === 'TRANSITION') {
        ctx.save(); ctx.fillStyle = 'rgba(2, 6, 23, 0.85)'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.textAlign = 'center';
        if (goingToRound === 2) {
            ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 26px sans-serif'; ctx.fillText('¡SÚPER MAZORCA DERROTADA!', canvas.width / 2, canvas.height / 2 - 50);
            ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif'; ctx.fillText('LISTO PARA LA SIGUIENTE RONDA', canvas.width / 2, canvas.height / 2 - 10);
        } else if (goingToRound === 3) {
            ctx.fillStyle = '#ef4444'; ctx.font = 'bold 36px sans-serif'; ctx.shadowColor = '#b91c1c'; ctx.shadowBlur = 10;
            ctx.fillText('¡MUERTE SÚBITA!', canvas.width / 2, canvas.height / 2 - 50);
            ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.shadowBlur = 0;
            ctx.fillText('¿CUÁL ES EL MÁXIMO PUNTAJE QUE PUEDES HACER?', canvas.width / 2, canvas.height / 2 - 10);
        }
        let seconds = Math.ceil(transitionTimer / 60); ctx.fillStyle = '#38bdf8'; ctx.font = 'bold 64px sans-serif'; ctx.fillText(seconds, canvas.width / 2, canvas.height / 2 + 70);
        ctx.restore();
    }
}

let lastFrameTime = 0; const fpsInterval = 1000 / 60; 
function loop(timestamp) {
    requestAnimationFrame(loop);
    if (!lastFrameTime) lastFrameTime = timestamp; let elapsed = timestamp - lastFrameTime;
    if (elapsed > 200) { lastFrameTime = timestamp; elapsed = 0; }
    if (elapsed >= fpsInterval) { lastFrameTime = timestamp - (elapsed % fpsInterval); update(); draw(); }
}

renderLeaderboard('startLeaderboardList'); requestAnimationFrame(loop);

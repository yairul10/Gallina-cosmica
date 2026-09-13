const achievData = { 
    'a1': { title: 'Acrobacia Táctil', desc: 'Personaliza la interfaz moviendo los botones.' }, 'a2': { title: 'Primer Despegue', desc: 'Completa tu primera partida.' }, 'a3': { title: 'Cosecha Estelar', desc: 'Destruye 50 maíces malvados.' }, 'a4': { title: 'Coleccionista de Chatarra', desc: 'Recoge 300 monedas en total.' }, 'a5': { title: 'Alas de Lana', desc: 'Evoluciona a la Oveja Espacial.' }, 'a6': { title: 'Galope Galáctico', desc: 'Alcanza la Nave Caballo.' }, 'a7': { title: 'La Vaca Sagrada', desc: 'Desbloquea la Vaca Espacial.' }, 'a8': { title: 'Poder de Fuego I', desc: 'Sube los disparos al máximo.' }, 'a9': { title: 'Piloto Veloz', desc: 'Sube la velocidad al máximo.' }, 'a10': { title: 'El Terror del Maizal', desc: 'Derrota a tu primer Jefe Maíz.' }, 'a11': { title: 'Puntería de Granjero', desc: 'Destruye 30 enemigos sin perder vida.' }, 'a12': { title: 'As del Espejo', desc: 'Derrota a un Jefe con 1 corazón.' }, 'a13': { title: 'Vuelo Limpio', desc: '100 segundos sin perder vida.' }, 'a14': { title: 'Sobreviviente del Espacio', desc: 'Aguanta 5 minutos sin perder.' }, 'a15': { title: 'Cliente Frecuente', desc: 'Compra 10 vidas extras (histórico).' }, 'a16': { title: 'Inversión Saludable', desc: 'Compra 10 vidas en una partida.' }, 'a18': { title: 'Veterano del Pollo', desc: 'Juega 25 partidas.' }, 'a19': { title: 'Leyenda del Vacío', desc: '200,000 puntos en una partida.' }, 'a20': { title: 'Dios del Infinito', desc: '500,000 puntos en una partida.' }, 'a21': { title: 'Venciste lo invencible', desc: 'Vence a la dupla Súper Jefe.' }, 'a22': { title: 'Millonario', desc: 'Consigue 10,000 monedas en total.' }, 'a23': { title: 'Multimillonario', desc: 'Reúne 10,000 monedas sin gastarlas.' }
};

function renderAchievementsList() {
    const listUI = document.getElementById('achievListUI'); listUI.innerHTML = '';
    Object.keys(achievData).forEach(key => { let isUnlocked = pAchiev[key]; let div = document.createElement('div'); div.className = 'achiev-item ' + (isUnlocked ? 'unlocked' : ''); div.innerHTML = (isUnlocked ? '✅ ' : '🔒 ') + achievData[key].title; div.onclick = () => { document.querySelectorAll('.achiev-item').forEach(el => el.classList.remove('selected')); div.classList.add('selected'); document.getElementById('achievNameUI').textContent = achievData[key].title + (isUnlocked ? '' : ' 🔒'); document.getElementById('achievNameUI').style.color = isUnlocked ? '#fbbf24' : '#94a3b8'; document.getElementById('achievDescUI').textContent = achievData[key].desc; }; listUI.appendChild(div); });
}

function unlockAchievement(key) { if (!pAchiev[key]) { pAchiev[key] = true; localStorage.setItem('farm_space_achievements', JSON.stringify(pAchiev)); document.getElementById('achievToastName').textContent = achievData[key].title; const toast = document.getElementById('achievToast'); toast.classList.add('show'); setTimeout(() => { toast.classList.remove('show'); }, 3500); } }

function loadHudPositions() {
    const saved = JSON.parse(localStorage.getItem('farm_space_hud_v11'));
    if (saved) { ['hud-bullets', 'hud-speed', 'hud-life-evolve', 'hud-armor', 'hud-damage', 'hud-super-damage', 'fireBtn', 'missileBtn'].forEach(id => { if(saved[id] && document.getElementById(id)) { document.getElementById(id).style.left = saved[id].left; document.getElementById(id).style.top = saved[id].top; } }); } 
    else { document.getElementById('hud-super-damage').style.left = '4%'; document.getElementById('hud-super-damage').style.top = '25%'; document.getElementById('hud-armor').style.left = '4%'; document.getElementById('hud-armor').style.top = '35%'; document.getElementById('hud-damage').style.left = '4%'; document.getElementById('hud-damage').style.top = '45%'; document.getElementById('hud-bullets').style.left = '4%'; document.getElementById('hud-bullets').style.top = '55%'; document.getElementById('hud-speed').style.left = '4%'; document.getElementById('hud-speed').style.top = '65%'; document.getElementById('hud-life-evolve').style.left = '4%'; document.getElementById('hud-life-evolve').style.top = '75%'; document.getElementById('fireBtn').style.left = '78%'; document.getElementById('fireBtn').style.top = '82%'; document.getElementById('missileBtn').style.left = '60%'; document.getElementById('missileBtn').style.top = '84%'; }
}

function saveHudPositions() { const positions = {}; ['hud-bullets', 'hud-speed', 'hud-life-evolve', 'hud-armor', 'hud-damage', 'hud-super-damage', 'fireBtn', 'missileBtn'].forEach(id => { const el = document.getElementById(id); if(el) positions[id] = { left: el.style.left, top: el.style.top }; }); localStorage.setItem('farm_space_hud_v11', JSON.stringify(positions)); }
loadHudPositions();

function pauseGame() { if (gameState === 'PLAYING' || gameState === 'TRANSITION') { previousState = gameState; gameState = 'PAUSED'; bgMusic.pause(); document.getElementById('pauseScreen').style.display = 'flex'; document.querySelectorAll('.draggable-btn').forEach(b => b.classList.add('paused')); isDraggingShip = false; dragPointerId = null; } }
document.getElementById('muteMenuBtn').addEventListener('click', (e) => { e.stopPropagation(); bgMusic.muted = !bgMusic.muted; e.target.textContent = bgMusic.muted ? '🔇 Activar Música' : '🔊 Silenciar Música'; });
document.getElementById('pauseBtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); pauseGame(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) pauseGame(); });
document.getElementById('resumeBtn').addEventListener('click', (e) => { e.stopPropagation(); if (gameState === 'PAUSED') { gameState = previousState; if (!bgMusic.muted) bgMusic.play().catch(e => console.log(e)); document.getElementById('pauseScreen').style.display = 'none'; document.querySelectorAll('.draggable-btn').forEach(b => b.classList.remove('paused')); } });

function closeScreen(id) { document.getElementById(id).style.display = 'none'; document.getElementById('startScreen').style.display = 'flex'; }
document.getElementById('openTutorialBtn').addEventListener('click', () => { document.getElementById('startScreen').style.display = 'none'; document.getElementById('tutorialScreen').style.display = 'flex'; });
document.getElementById('openHangarBtn').addEventListener('click', () => { updateHangarUI(); document.getElementById('startScreen').style.display = 'none'; document.getElementById('hangarScreen').style.display = 'flex'; });

window.switchHangarTab = function(tab) {
    document.getElementById('tabHangarSkins').classList.remove('active'); document.getElementById('tabHangarMissiles').classList.remove('active');
    document.getElementById('hangarSkins').style.display = 'none'; document.getElementById('hangarMissiles').style.display = 'none';
    if (tab === 'skins') { document.getElementById('tabHangarSkins').classList.add('active'); document.getElementById('hangarSkins').style.display = 'grid'; }
    else { document.getElementById('tabHangarMissiles').classList.add('active'); document.getElementById('hangarMissiles').style.display = 'grid'; }
}

function updateHangarUI() {
    for(let i=0; i<4; i++) {
        let btn = document.getElementById('btn-hangar-skin-'+i); let img = document.getElementById('img-hangar-skin-'+i); let name = document.getElementById('name-hangar-skin-'+i); let desc = document.getElementById('desc-hangar-skin-'+i);
        if (gameStats.skins[i]) {
            if (gameStats.equippedSkins[i]) { btn.textContent = 'Usar Normal'; btn.style.background = '#f59e0b'; img.src = skinProSrc[i]; name.textContent = baseNames[i] + ' Pro'; desc.innerHTML = '<b style="color:#fbbf24;">+30% Daño Láser</b>'; } 
            else { btn.textContent = 'Equipar Pro'; btn.style.background = '#10b981'; img.src = skinSrc[i]; name.textContent = baseNames[i]; desc.innerHTML = 'Normal'; }
            btn.disabled = false;
        } else { btn.textContent = 'Pro Bloqueada'; btn.style.background = '#475569'; img.src = skinSrc[i]; name.textContent = baseNames[i]; desc.innerHTML = 'Normal'; btn.disabled = true; }
    }
    for(let i=0; i<4; i++) {
        let btn = document.getElementById('btn-hangar-missile-'+i); let img = document.getElementById('img-hangar-missile-'+i); let name = document.getElementById('name-hangar-missile-'+i); let desc = document.getElementById('desc-hangar-missile-'+i);
        if (gameStats.missiles[i]) {
            if (gameStats.equippedMissiles[i]) { btn.textContent = 'Usar Normal'; btn.style.background = '#f59e0b'; img.src = misProSrc[i]; img.onerror = function() { this.src = misSrc[i]; }; name.textContent = misNames[i] + ' Pro'; desc.innerHTML = '<b style="color:#38bdf8;">+20% Daño Misil</b>'; } 
            else { btn.textContent = 'Equipar Pro'; btn.style.background = '#10b981'; img.src = misSrc[i]; name.textContent = misNames[i]; desc.innerHTML = 'Normal'; }
            btn.disabled = false;
        } else { btn.textContent = '🔒 Gana el trofeo'; btn.style.background = '#475569'; img.src = misSrc[i]; name.textContent = misNames[i]; desc.innerHTML = 'Normal'; btn.disabled = true; }
    }
}

window.toggleHangarSkin = function(index) { gameStats.equippedSkins[index] = !gameStats.equippedSkins[index]; saveStats(); updateHangarUI(); }
window.toggleHangarMissile = function(index) { gameStats.equippedMissiles[index] = !gameStats.equippedMissiles[index]; saveStats(); updateHangarUI(); }

document.getElementById('openShopBtn').addEventListener('click', () => { updateShopUI(); document.getElementById('startScreen').style.display = 'none'; document.getElementById('shopScreen').style.display = 'flex'; });
document.getElementById('openRecordsBtn').addEventListener('click', () => { document.getElementById('startScreen').style.display = 'none'; document.getElementById('recordsScreen').style.display = 'flex'; });
document.getElementById('openTrophiesBtn').addEventListener('click', () => { updateTrophyMenu(); document.getElementById('startScreen').style.display = 'none'; document.getElementById('trophiesScreen').style.display = 'flex'; });
document.getElementById('openAchievBtn').addEventListener('click', () => { renderAchievementsList(); document.getElementById('startScreen').style.display = 'none'; document.getElementById('achievScreen').style.display = 'flex'; });
document.getElementById('mainMenuBtn').addEventListener('click', () => { document.getElementById('gameOverScreen').style.display = 'none'; document.getElementById('startScreen').style.display = 'flex'; gameState = 'START'; previousState = 'START'; document.querySelectorAll('.draggable-btn').forEach(b => b.style.display = 'none'); });

window.switchShopTab = function(tab) {
    document.getElementById('tabSkins').classList.remove('active'); document.getElementById('tabBoosters').classList.remove('active');
    document.getElementById('shopSkins').style.display = 'none'; document.getElementById('shopBoosters').style.display = 'none';
    if (tab === 'skins') { document.getElementById('tabSkins').classList.add('active'); document.getElementById('shopSkins').style.display = 'grid'; }
    else { document.getElementById('tabBoosters').classList.add('active'); document.getElementById('shopBoosters').style.display = 'grid'; }
}

function updateShopUI() {
    document.getElementById('shopCoinsVal').textContent = coins; let skinCosts = [1000, 2000, 4000, 8000];
    for(let i=0; i<4; i++) {
        let btn = document.getElementById('btn-skin-'+i);
        if (gameStats.skins[i]) { btn.textContent = 'Adquirido'; btn.style.background = '#475569'; btn.disabled = true; } 
        else { btn.textContent = `🪙 ${skinCosts[i].toLocaleString()}`; btn.style.background = '#10b981'; btn.disabled = (coins < skinCosts[i]); }
    }
    let b20 = document.getElementById('btn-boost-20'); let b50 = document.getElementById('btn-boost-50'); let b100 = document.getElementById('btn-boost-100');
    [b20, b50, b100].forEach(b => { b.textContent = '🪙 ' + b.getAttribute('data-cost'); b.style.background = '#10b981'; b.disabled = false; });
    if (coins < 500) b20.disabled = true; if (coins < 2000) b50.disabled = true; if (coins < 10000) b100.disabled = true;
    if (gameStats.pendingBooster === 1.2) { b20.textContent = 'ACTIVADO'; b20.style.background = '#3b82f6'; [b50, b100].forEach(b=>b.disabled=true); }
    else if (gameStats.pendingBooster === 1.5) { b50.textContent = 'ACTIVADO'; b50.style.background = '#3b82f6'; [b20, b100].forEach(b=>b.disabled=true); }
    else if (gameStats.pendingBooster === 2.0) { b100.textContent = 'ACTIVADO'; b100.style.background = '#3b82f6'; [b20, b50].forEach(b=>b.disabled=true); }
}

window.buySkin = function(index, cost) { if (!gameStats.skins[index] && coins >= cost) { coins -= cost; gameStats.savedCoins = coins; gameStats.skins[index] = true; gameStats.equippedSkins[index] = true; saveStats(); updateShopUI(); } }
window.buyBooster = function(mult, cost) { if (gameStats.pendingBooster === 1.0 && coins >= cost) { coins -= cost; gameStats.savedCoins = coins; gameStats.pendingBooster = mult; saveStats(); updateShopUI(); } }

const trophyData = { '20k': { name: '🥉 Pollito de Bronce', lock: 'Consigue 20,000 pts', unlock: 'Lograste 20,000 pts.', key: 't20k' }, '50k': { name: '🥈 Lana de Plata', lock: 'Consigue 50,000 pts', unlock: 'Lograste 50,000 pts.', key: 't50k' }, '100k': { name: '🏅 Herradura de Oro', lock: 'Consigue 100,000 pts', unlock: 'Lograste 100,000 pts.', key: 't100k' }, '200k': { name: '🏆 Leche Legendaria', lock: 'Consigue 200,000 pts', unlock: 'Lograste 200,000 pts.', key: 't200k' }, '300k': { name: '💎 Gallina de Diamante', lock: 'Consigue 300,000 pts', unlock: 'Lograste 300,000 pts.', key: 't300k' } };

function updateTrophyMenu() { let pTrophies = JSON.parse(localStorage.getItem('farm_space_trophies')) || {}; ['20k', '50k', '100k', '200k', '300k'].forEach(id => { let img = document.getElementById(`img-t${id}`); let emoji = document.getElementById(`fall-${id}`); if(img && emoji) { if(pTrophies[trophyData[id].key]) { img.className = 'trophy-img trophy-unlocked'; emoji.style.filter = 'none'; emoji.style.opacity = '1'; } else { img.className = 'trophy-img trophy-locked'; emoji.style.filter = 'grayscale(100%)'; emoji.style.opacity = '0.3'; } } }); }
window.showTrophyInfo = function(id) { document.querySelectorAll('.trophy-item').forEach(el => el.classList.remove('selected')); document.querySelector(`.trophy-item[data-id="${id}"]`).classList.add('selected'); let pT = JSON.parse(localStorage.getItem('farm_space_trophies')) || {}; let tName = document.getElementById('trophyName'); let tDesc = document.getElementById('trophyDesc'); if(pT[trophyData[id].key]) { tName.textContent = trophyData[id].name; tName.style.color = '#fbbf24'; tDesc.textContent = `¡Felicidades! ${trophyData[id].unlock}`; } else { tName.textContent = trophyData[id].name + ' 🔒'; tName.style.color = '#94a3b8'; tDesc.textContent = `Meta: ${trophyData[id].lock}`; } }
function savePersistentTrophy(key) { let pT = JSON.parse(localStorage.getItem('farm_space_trophies')) || {}; if (!pT[key]) { pT[key] = true; localStorage.setItem('farm_space_trophies', JSON.stringify(pT)); } }
function showTrophyToast(icon, imgObj, subtitle = "") { toastIcon = icon; toastImg = imgObj; toastSubtitle = subtitle; toastTimer = 200; }
function getTrophyHTML(imgObj, emoji) { return (imgObj.complete && imgObj.naturalWidth > 0) ? `<img src="${imgObj.src}" style="height:18px; margin-left:4px; filter: drop-shadow(0 0 2px rgba(255,255,255,0.5));">` : `<span style="margin-left:4px;">${emoji}</span>`; }
function updateTrophiesHUD() { let html = ""; if (gotTrophy20k) html += getTrophyHTML(assets.trofeoPollito, "🥉🐥"); if (gotTrophy50k) html += getTrophyHTML(assets.trofeoLana, "🥈🧶"); if (gotTrophy100k) html += getTrophyHTML(assets.trofeoHerradura, "🏅🧲"); if (gotTrophy200k) html += getTrophyHTML(assets.trofeoLeche, "🏆🥛"); if (gotTrophy300k) html += getTrophyHTML(assets.trofeoDiamante, "💎🐔"); document.getElementById('trophiesVal').innerHTML = html; }

function saveLeaderboard() { localStorage.setItem('farm_space_leaderboard', JSON.stringify(leaderboard)); }
function renderLeaderboard(elementId) { const container = document.getElementById(elementId); container.innerHTML = ''; if (leaderboard.length === 0) { container.innerHTML = '<div class="lb-row"><span>Sin récords</span><span></span></div>'; return; } leaderboard.forEach((item, index) => { const row = document.createElement('div'); row.className = 'lb-row'; row.innerHTML = `<span>#${index + 1} ${item.name}</span> <span>${item.score} pts</span>`; container.appendChild(row); }); }
function updateLivesUI() { document.getElementById('livesVal').textContent = `❤️ x${lives}`; }

window.updateUpgradesHUD = function() {
    document.getElementById('coinVal').textContent = coins;
    const btnBullets = document.getElementById('hud-bullets'); 
    if (upgrades.bullets >= maxUpgradeLimit) { btnBullets.querySelector('.hud-lvl').textContent = 'MÁX'; btnBullets.querySelector('.hud-cost').style.display = 'none'; } else { btnBullets.querySelector('.hud-lvl').textContent = `Lv.${upgrades.bullets}`; btnBullets.querySelector('.hud-cost').style.display = 'block'; }
    btnBullets.classList.toggle('can-upgrade', upgrades.bullets < maxUpgradeLimit && coins >= 10);
    const btnSpeed = document.getElementById('hud-speed'); 
    if (upgrades.speed >= maxUpgradeLimit) { btnSpeed.querySelector('.hud-lvl').textContent = 'MÁX'; btnSpeed.querySelector('.hud-cost').style.display = 'none'; } else { btnSpeed.querySelector('.hud-lvl').textContent = `Lv.${upgrades.speed}`; btnSpeed.querySelector('.hud-cost').style.display = 'block'; }
    btnSpeed.classList.toggle('can-upgrade', upgrades.speed < maxUpgradeLimit && coins >= 10);
    const btnLifeEvolve = document.getElementById('hud-life-evolve'); 
    if (upgrades.bullets >= maxUpgradeLimit && upgrades.speed >= maxUpgradeLimit && evolutionStage < 3) { btnLifeEvolve.querySelector('.hud-emoji').textContent = '🌟'; btnLifeEvolve.querySelector('.hud-lvl').textContent = 'EVOL.'; btnLifeEvolve.querySelector('.hud-cost').style.display = 'none'; btnLifeEvolve.style.borderColor = '#fbbf24'; btnLifeEvolve.classList.toggle('can-upgrade', true); } else { btnLifeEvolve.querySelector('.hud-emoji').textContent = '❤️'; if (lives >= 10) { btnLifeEvolve.querySelector('.hud-lvl').textContent = 'MÁX'; btnLifeEvolve.querySelector('.hud-cost').style.display = 'none'; } else { btnLifeEvolve.querySelector('.hud-lvl').textContent = '+1'; btnLifeEvolve.querySelector('.hud-cost').style.display = 'block'; } btnLifeEvolve.style.borderColor = 'rgba(56, 189, 248, 0.5)'; btnLifeEvolve.classList.toggle('can-upgrade', lives < 10 && coins >= 15); }
    document.getElementById('pauseBulletsLvl').textContent = upgrades.bullets >= maxUpgradeLimit ? 'MÁX' : `🪙10`; document.getElementById('pauseSpeedLvl').textContent = upgrades.speed >= maxUpgradeLimit ? 'MÁX' : `🪙10`;
    const pauseEv = document.getElementById('pauseEvolveBtn'); if (evolutionStage >= 3) pauseEv.style.display = 'none'; else pauseEv.style.display = 'flex';
    const armorBtn = document.getElementById('hud-armor'); const damageBtn = document.getElementById('hud-damage'); const superDmgBtn = document.getElementById('hud-super-damage'); const pauseSuperDmg = document.getElementById('pauseSuperDmgBtn');
    if (gameRound >= 2) { armorBtn.style.display = 'flex'; damageBtn.style.display = 'flex'; if (upgrades.armor > 0) { armorBtn.querySelector('.hud-lvl').textContent = 'MÁX'; armorBtn.querySelector('.hud-cost').style.display = 'none'; } if (upgrades.dmgBoost > 0) { damageBtn.querySelector('.hud-lvl').textContent = 'MÁX'; damageBtn.querySelector('.hud-cost').style.display = 'none'; } armorBtn.classList.toggle('can-upgrade', upgrades.armor === 0 && coins >= 300); damageBtn.classList.toggle('can-upgrade', upgrades.dmgBoost === 0 && coins >= 200); } else { armorBtn.style.display = 'none'; damageBtn.style.display = 'none'; }
    if (gameRound === 3 || goingToRound === 3) { superDmgBtn.style.display = 'flex'; pauseSuperDmg.style.display = 'flex'; if (upgrades.superDmgBoost > 0) { superDmgBtn.querySelector('.hud-lvl').textContent = 'MÁX'; superDmgBtn.querySelector('.hud-cost').style.display = 'none'; document.getElementById('pauseSuperDmgLvl').textContent = 'MÁX'; } superDmgBtn.classList.toggle('can-upgrade', upgrades.superDmgBoost === 0 && coins >= 1000); } else { superDmgBtn.style.display = 'none'; pauseSuperDmg.style.display = 'none'; }
}

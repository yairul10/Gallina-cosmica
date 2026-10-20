function renderAchievementsList() {
    const listUI = document.getElementById('achievListUI'); listUI.innerHTML = '';
    Object.keys(achievData).forEach(key => { let isUnlocked = pAchiev[key]; let div = document.createElement('div'); div.className = 'achiev-item ' + (isUnlocked ? 'unlocked' : ''); div.innerHTML = (isUnlocked ? '✅ ' : '🔒 ') + achievData[key].title; div.onclick = () => { document.querySelectorAll('.achiev-item').forEach(el => el.classList.remove('selected')); div.classList.add('selected'); document.getElementById('achievNameUI').textContent = achievData[key].title + (isUnlocked ? '' : ' 🔒'); document.getElementById('achievNameUI').style.color = isUnlocked ? '#fbbf24' : '#94a3b8'; document.getElementById('achievDescUI').textContent = achievData[key].desc; }; listUI.appendChild(div); });
}

function unlockAchievement(key) { if (!pAchiev[key]) { pAchiev[key] = true; localStorage.setItem('farm_space_achievements', JSON.stringify(pAchiev)); document.getElementById('achievToastName').textContent = achievData[key].title; const toast = document.getElementById('achievToast'); toast.classList.add('show'); setTimeout(() => { toast.classList.remove('show'); }, 3500); } }

function loadHudPositions() {
    const saved = JSON.parse(localStorage.getItem('farm_space_hud_v11'));
    if (saved) { ['hud-bullets', 'hud-speed', 'hud-life-evolve', 'hud-armor', 'hud-damage', 'hud-super-damage', 'fireBtn', 'missileBtn', 'hud-joystick'].forEach(id => { if(saved[id] && document.getElementById(id)) { document.getElementById(id).style.left = saved[id].left; document.getElementById(id).style.top = saved[id].top; } else if (id === 'hud-joystick' && document.getElementById(id)) { document.getElementById(id).style.left = '8%'; document.getElementById(id).style.top = '75%'; } }); } 
    else { document.getElementById('hud-super-damage').style.left = '4%'; document.getElementById('hud-super-damage').style.top = '25%'; document.getElementById('hud-armor').style.left = '4%'; document.getElementById('hud-armor').style.top = '35%'; document.getElementById('hud-damage').style.left = '4%'; document.getElementById('hud-damage').style.top = '45%'; document.getElementById('hud-bullets').style.left = '4%'; document.getElementById('hud-bullets').style.top = '55%'; document.getElementById('hud-speed').style.left = '4%'; document.getElementById('hud-speed').style.top = '65%'; document.getElementById('hud-life-evolve').style.left = '4%'; document.getElementById('hud-life-evolve').style.top = '75%'; document.getElementById('fireBtn').style.left = '78%'; document.getElementById('fireBtn').style.top = '82%'; document.getElementById('missileBtn').style.left = '60%'; document.getElementById('missileBtn').style.top = '84%'; document.getElementById('hud-joystick').style.left = '8%'; document.getElementById('hud-joystick').style.top = '75%'; }
}
function saveHudPositions() { const positions = {}; ['hud-bullets', 'hud-speed', 'hud-life-evolve', 'hud-armor', 'hud-damage', 'hud-super-damage', 'fireBtn', 'missileBtn', 'hud-joystick'].forEach(id => { const el = document.getElementById(id); if(el) positions[id] = { left: el.style.left, top: el.style.top }; }); localStorage.setItem('farm_space_hud_v11', JSON.stringify(positions)); }
loadHudPositions();

window.toggleControlMode = function() { gameStats.controlMode = gameStats.controlMode === 'drag' ? 'joystick' : 'drag'; saveStats(); document.getElementById('toggleControlBtn').innerHTML = gameStats.controlMode === 'drag' ? '🕹️ Control: Arrastrar' : '🕹️ Control: Joystick'; document.getElementById('hud-joystick').style.display = gameStats.controlMode === 'drag' ? 'none' : 'flex'; };

window.toggleAutoLifeMatch = function() {
    if (!gameStats.equipExtraModule) return; 
    moduleActiveInMatch = !moduleActiveInMatch;
    document.getElementById('toggleAutoLifeBtn').innerHTML = moduleActiveInMatch ? '❤️ Auto-Vida: ON' : '🖤 Auto-Vida: OFF';
};

function pauseGame() { 
    if (gameState === 'PLAYING' || gameState === 'TRANSITION') { 
        previousState = gameState; gameState = 'PAUSED'; bgMusic.pause(); 
        document.getElementById('pauseScreen').style.display = 'flex'; 
        document.querySelectorAll('.draggable-btn').forEach(b => b.classList.add('paused')); 
        isDraggingShip = false; 
        document.getElementById('toggleControlBtn').innerHTML = gameStats.controlMode === 'drag' ? '🕹️ Control: Arrastrar' : '🕹️ Control: Joystick'; 
        
        if (gameStats.equipExtraModule) {
            document.getElementById('toggleAutoLifeBtn').style.display = 'block';
            document.getElementById('toggleAutoLifeBtn').innerHTML = moduleActiveInMatch ? '❤️ Auto-Vida: ON' : '🖤 Auto-Vida: OFF';
        } else {
            document.getElementById('toggleAutoLifeBtn').style.display = 'none';
        }
    } 
}
document.getElementById('muteMenuBtn').addEventListener('click', (e) => { e.stopPropagation(); bgMusic.muted = !bgMusic.muted; e.target.textContent = bgMusic.muted ? '🔇 Activar Música' : '🔊 Silenciar Música'; });
document.getElementById('pauseBtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); pauseGame(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) pauseGame(); });
document.getElementById('resumeBtn').addEventListener('click', (e) => { e.stopPropagation(); if (gameState === 'PAUSED') { gameState = previousState; if (!bgMusic.muted) bgMusic.play().catch(e => console.log(e)); document.getElementById('pauseScreen').style.display = 'none'; document.querySelectorAll('.draggable-btn').forEach(b => b.classList.remove('paused')); } });

document.getElementById('quitMatchBtn').addEventListener('click', (e) => { 
    e.stopPropagation(); 
    if (window.gameTimerInterval) clearInterval(window.gameTimerInterval);
    bgMusic.pause(); bgMusic.currentTime = 0;
    document.getElementById('pauseScreen').style.display = 'none'; 
    document.getElementById('startScreen').style.display = 'flex'; 
    gameState = 'START'; previousState = 'START'; 
    document.querySelectorAll('.draggable-btn').forEach(b => b.style.display = 'none'); 
});

function closeScreen(id) { document.getElementById(id).style.display = 'none'; document.getElementById('startScreen').style.display = 'flex'; }
document.getElementById('openTutorialBtn').addEventListener('click', () => { document.getElementById('startScreen').style.display = 'none'; document.getElementById('tutorialScreen').style.display = 'flex'; });
document.getElementById('openHangarBtn').addEventListener('click', () => { updateHangarUI(); document.getElementById('startScreen').style.display = 'none'; document.getElementById('hangarScreen').style.display = 'flex'; });
document.getElementById('openShopBtn').addEventListener('click', () => { updateShopUI(); document.getElementById('startScreen').style.display = 'none'; document.getElementById('shopScreen').style.display = 'flex'; });
document.getElementById('openRecordsBtn').addEventListener('click', () => { document.getElementById('startScreen').style.display = 'none'; document.getElementById('recordsScreen').style.display = 'flex'; });
document.getElementById('openTrophiesBtn').addEventListener('click', () => { updateTrophyMenu(); document.getElementById('startScreen').style.display = 'none'; document.getElementById('trophiesScreen').style.display = 'flex'; });
document.getElementById('openAchievBtn').addEventListener('click', () => { renderAchievementsList(); document.getElementById('startScreen').style.display = 'none'; document.getElementById('achievScreen').style.display = 'flex'; });
document.getElementById('mainMenuBtn').addEventListener('click', () => { document.getElementById('gameOverScreen').style.display = 'none'; document.getElementById('startScreen').style.display = 'flex'; gameState = 'START'; previousState = 'START'; document.querySelectorAll('.draggable-btn').forEach(b => b.style.display = 'none'); });

window.switchHangarTab = function(tab) {
    document.getElementById('tabHangarSkins').classList.remove('active'); document.getElementById('tabHangarExtras').classList.remove('active');
    document.getElementById('hangarSkins').style.display = 'none'; document.getElementById('hangarExtras').style.display = 'none';
    if (tab === 'skins') { document.getElementById('tabHangarSkins').classList.add('active'); document.getElementById('hangarSkins').style.display = 'grid'; }
    else { document.getElementById('tabHangarExtras').classList.add('active'); document.getElementById('hangarExtras').style.display = 'grid'; }
}

function updateHangarUI() {
    const animalDirs = ['gallina', 'oveja', 'caballo', 'vaca'];
    const passives = ['+20% a Maíz', '+20% a Jefes Maíz', '+20% a Lechuga', '+20% a Jefes Lech.'];
    
    for(let i=0; i<4; i++) { 
        let card = document.getElementById('hangar-ship-card-'+i);
        if(card) {
            if (gameStats.skins[i]) {
                card.style.display = 'flex'; 
                let bNorm = document.getElementById('btn-hs-'+i+'-norm'); let bPro = document.getElementById('btn-hs-'+i+'-pro'); 
                let img = document.getElementById('img-hs-'+i); let desc = document.getElementById('desc-hs-'+i);
                
                bNorm.style.background = (gameStats.selectedShip === i && !gameStats.useProShip) ? '#f59e0b' : '#334155';
                bPro.style.background = (gameStats.selectedShip === i && gameStats.useProShip) ? '#f59e0b' : '#334155';
                bPro.disabled = !gameStats.proSkins[i]; if(!gameStats.proSkins[i]) bPro.style.background = '#1e293b';
                
                let isPro = (gameStats.selectedShip === i && gameStats.useProShip);
                if(img) img.src = isPro ? `assets/${animalDirs[i]}_pro_1.png` : `assets/${animalDirs[i]}_1.png`;
                
                if(desc) {
                    if (isPro) {
                        desc.innerHTML = `<span style="color:#fbbf24; font-weight:bold;">+30% Daño Extra</span><span>${passives[i]}</span>`;
                    } else {
                        desc.innerHTML = `<span>${passives[i]}</span>`;
                    }
                }
            } else { card.style.display = 'none'; }
        }
    }
    
    let btnExtra = document.getElementById('btn-equip-autolife');
    if (btnExtra) {
        if (!gameStats.extraModule) { btnExtra.textContent = 'Bloqueado'; btnExtra.style.background = '#1e293b'; btnExtra.disabled = true; }
        else if (gameStats.equipExtraModule) { btnExtra.textContent = 'Equipado'; btnExtra.style.background = '#f59e0b'; btnExtra.disabled = false; }
        else { btnExtra.textContent = 'Equipar'; btnExtra.style.background = '#334155'; btnExtra.disabled = false; }
    }
}

window.equipShip = function(index, isPro) { if ((isPro && gameStats.proSkins[index]) || (!isPro && gameStats.skins[index])) { gameStats.selectedShip = index; gameStats.useProShip = isPro; saveStats(); updateHangarUI(); } }
window.equipExtra = function() { if (gameStats.extraModule) { gameStats.equipExtraModule = !gameStats.equipExtraModule; saveStats(); updateHangarUI(); } }

window.switchShopTab = function(tab) {
    document.getElementById('tabSkins').classList.remove('active'); document.getElementById('tabBoosters').classList.remove('active');
    document.getElementById('shopSkins').style.display = 'none'; document.getElementById('shopBoosters').style.display = 'none';
    if (tab === 'skins') { document.getElementById('tabSkins').classList.add('active'); document.getElementById('shopSkins').style.display = 'grid'; }
    else { document.getElementById('tabBoosters').classList.add('active'); document.getElementById('shopBoosters').style.display = 'grid'; }
}

function updateShopUI() {
    document.getElementById('shopCoinsVal').textContent = coins; 
    let bCosts = [0, 1000, 2000, 4000]; let pCosts = [3000, 3000, 6000, 10000]; 
    for(let i=0; i<4; i++) { 
        let btnB = document.getElementById('btn-skin-base-'+i); let imgB = document.getElementById('shop-img-base-'+i);
        if (btnB && imgB) { if (gameStats.skins[i]) { btnB.textContent = 'Comprado'; btnB.style.background = '#475569'; btnB.disabled = true; imgB.style.filter = 'none'; imgB.style.opacity = '1'; } else { btnB.textContent = `🪙 ${bCosts[i].toLocaleString()}`; btnB.style.background = '#10b981'; btnB.disabled = (coins < bCosts[i]); imgB.style.filter = 'grayscale(100%)'; imgB.style.opacity = '0.6'; } }
        let btnP = document.getElementById('btn-skin-pro-'+i); let imgP = document.getElementById('shop-img-pro-'+i);
        if (btnP && imgP) { if (gameStats.proSkins[i]) { btnP.textContent = 'Comprado'; btnP.style.background = '#475569'; btnP.disabled = true; imgP.style.filter = 'none'; imgP.style.opacity = '1'; } else { btnP.textContent = `🪙 ${pCosts[i].toLocaleString()}`; btnP.style.background = '#10b981'; btnP.disabled = (coins < pCosts[i]); imgP.style.filter = 'grayscale(100%)'; imgP.style.opacity = '0.6'; } }
    }
    
    let bAuto = document.getElementById('btn-buy-autolife');
    if (bAuto) {
        if (gameStats.extraModule) { bAuto.textContent = 'Comprado'; bAuto.style.background = '#475569'; bAuto.disabled = true; }
        else { bAuto.textContent = '🪙 5,000'; bAuto.style.background = '#10b981'; bAuto.disabled = (coins < 5000); }
    }
    
    let b20 = document.getElementById('btn-boost-20'); let b50 = document.getElementById('btn-boost-50'); let b100 = document.getElementById('btn-boost-100');
    if(b20 && b50 && b100) { [b20, b50, b100].forEach(b => { b.textContent = '🪙 ' + b.getAttribute('data-cost'); b.style.background = '#10b981'; b.disabled = false; }); if (coins < 500) b20.disabled = true; if (coins < 2000) b50.disabled = true; if (coins < 10000) b100.disabled = true; if (gameStats.pendingBooster === 1.2) { b20.textContent = 'ACTIVO'; b20.style.background = '#3b82f6'; [b50, b100].forEach(b=>b.disabled=true); } else if (gameStats.pendingBooster === 1.5) { b50.textContent = 'ACTIVO'; b50.style.background = '#3b82f6'; [b20, b100].forEach(b=>b.disabled=true); } else if (gameStats.pendingBooster === 2.0) { b100.textContent = 'ACTIVO'; b100.style.background = '#3b82f6'; [b20, b50].forEach(b=>b.disabled=true); } }
}

window.buyShip = function(index, isPro, cost) { if (isPro) { if (!gameStats.proSkins[index] && coins >= cost) { coins -= cost; gameStats.savedCoins = coins; gameStats.proSkins[index] = true; saveStats(); updateShopUI(); } } else { if (!gameStats.skins[index] && coins >= cost) { coins -= cost; gameStats.savedCoins = coins; gameStats.skins[index] = true; saveStats(); updateShopUI(); } } }
window.buyBooster = function(mult, cost) { if (gameStats.pendingBooster === 1.0 && coins >= cost) { coins -= cost; gameStats.savedCoins = coins; gameStats.pendingBooster = mult; saveStats(); updateShopUI(); } }
window.buyAutoLife = function() { if (!gameStats.extraModule && coins >= 5000) { coins -= 5000; gameStats.savedCoins = coins; gameStats.extraModule = true; gameStats.equipExtraModule = true; saveStats(); updateShopUI(); } }

const trophyData = { '20k': { name: '🥉 Pollito de Bronce', lock: 'Consigue 20,000 pts', unlock: 'Lograste 20,000 pts.', key: 't20k' }, '50k': { name: '🥈 Lana de Plata', lock: 'Consigue 50,000 pts', unlock: 'Lograste 50,000 pts.', key: 't50k' }, '100k': { name: '🏅 Herradura de Oro', lock: 'Consigue 100,000 pts', unlock: 'Lograste 100,000 pts.', key: 't100k' }, '200k': { name: '🏆 Leche Legendaria', lock: 'Consigue 200,000 pts', unlock: 'Lograste 200,000 pts.', key: 't200k' }, '300k': { name: '💎 Gallina de Diamante', lock: 'Consigue 300,000 pts', unlock: 'Lograste 300,000 pts.', key: 't300k' } };
function updateTrophyMenu() { let pTrophies = JSON.parse(localStorage.getItem('farm_space_trophies')) || {}; ['20k', '50k', '100k', '200k', '300k'].forEach(id => { let img = document.getElementById(`img-t${id}`); let emoji = document.getElementById(`fall-${id}`); if(img && emoji) { if(pTrophies[trophyData[id].key]) { img.className = 'trophy-img trophy-unlocked'; emoji.style.filter = 'none'; emoji.style.opacity = '1'; } else { img.className = 'trophy-img trophy-locked'; emoji.style.filter = 'grayscale(100%)'; emoji.style.opacity = '0.3'; } } }); }
window.showTrophyInfo = function(id) { document.querySelectorAll('.trophy-item').forEach(el => el.classList.remove('selected')); document.querySelector(`.trophy-item[data-id="${id}"]`).classList.add('selected'); let pT = JSON.parse(localStorage.getItem('farm_space_trophies')) || {}; let tName = document.getElementById('trophyName'); let tDesc = document.getElementById('trophyDesc'); if(pT[trophyData[id].key]) { tName.textContent = trophyData[id].name; tName.style.color = '#fbbf24'; tDesc.textContent = `¡Felicidades! ${trophyData[id].unlock}`; } else { tName.textContent = trophyData[id].name + ' 🔒'; tName.style.color = '#94a3b8'; tDesc.textContent = `Meta: ${trophyData[id].lock}`; } }
function savePersistentTrophy(key) { let pT = JSON.parse(localStorage.getItem('farm_space_trophies')) || {}; if (!pT[key]) { pT[key] = true; localStorage.setItem('farm_space_trophies', JSON.stringify(pT)); } }
function showTrophyToast(icon, imgObj, subtitle = "") { toastIcon = icon; toastImg = imgObj; toastSubtitle = subtitle; toastTimer = 200; }
function getTrophyHTML(imgObj, emoji) { return (imgObj.complete && imgObj.naturalWidth > 0) ? `<img src="${imgObj.src}" style="height:18px; margin-left:4px; filter: drop-shadow(0 0 2px rgba(255,255,255,0.5));">` : `<span style="margin-left:4px;">${emoji}</span>`; }
function updateTrophiesHUD() { let html = ""; if (gotTrophy20k) html += getTrophyHTML(assets.trofeoPollito, "🥉🐥"); if (gotTrophy50k) html += getTrophyHTML(assets.trofeoLana, "🥈🧶"); if (gotTrophy100k) html += getTrophyHTML(assets.trofeoHerradura, "🏅🧲"); if (gotTrophy200k) html += getTrophyHTML(assets.trofeoLeche, "🏆🥛"); if (gotTrophy300k) html += getTrophyHTML(assets.trofeoDiamante, "💎🐔"); document.getElementById('trophiesVal').innerHTML = html; }

function renderLeaderboard(elementId) { const container = document.getElementById(elementId); container.innerHTML = ''; if (leaderboard.length === 0) { container.innerHTML = '<div class="lb-row"><span>Sin récords</span><span></span></div>'; return; } leaderboard.forEach((item, index) => { const row = document.createElement('div'); row.className = 'lb-row'; row.innerHTML = `<span>#${index + 1} ${item.name}</span> <span>${item.score} pts</span>`; container.appendChild(row); }); }

function activateTutorial(text, targetBtnId) {
    gameState = 'TUTORIAL'; let overlay = document.getElementById('activeTutorialOverlay'); overlay.style.display = 'flex'; document.getElementById('activeTutorialText').innerHTML = text;
    if (targetBtnId === 'none') { document.getElementById('tutorialOkBtn').style.display = 'none'; overlay.style.pointerEvents = 'none'; } 
    else if (targetBtnId) { if (Array.isArray(targetBtnId)) { targetBtnId.forEach(id => document.getElementById(id).classList.add('tutorial-highlight')); } else { document.getElementById(targetBtnId).classList.add('tutorial-highlight'); } document.getElementById('tutorialOkBtn').style.display = 'none'; overlay.style.pointerEvents = 'auto'; } 
    else { document.getElementById('tutorialOkBtn').style.display = 'block'; overlay.style.pointerEvents = 'auto'; }
}

function completeTutorialStep(step) {
    if (tutorialStep !== step) return;
    document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
    let overlay = document.getElementById('activeTutorialOverlay'); overlay.style.display = 'none'; overlay.style.pointerEvents = 'auto'; gameState = 'PLAYING';
    if (step === 0.5) { tutorialStep = 1; activateTutorial("¡Excelente!<br><br>Ahora toca el botón rojo de Disparo (🚀) para atacar.", 'fireBtn'); return; }
    
    // CORRECCIÓN: El maíz del tutorial ahora da 10 monedas.
    if (step === 1) { tutorialStep = 1.1; enemies.push({ x: canvas.width / 2 - 24, y: 80, width: 48, height: 48, hp: 1, maxHp: 1, speed: 0.2, wobble: 0, type: 'corn', pts: 150, coin: 10, shootCooldown: 0 }); activateTutorial("¡Buen tiro!<br><br>Ahora prueba el <b>Misil Rastreador</b> tocando el botón amarillo.", 'missileBtn'); return; }
    
    if (step === 1.1) tutorialStep = 1.5; if (step === 2) tutorialStep = 2.5; if (step === 3) tutorialStep = 3.5;
    if (step === 4.5) { 
        // El tutorial espera aquí y NO avanza hasta que la cámara termine
    }
}

window.finishTutorial = function() { document.getElementById('activeTutorialOverlay').style.display = 'none'; document.getElementById('activeTutorialOverlay').style.pointerEvents = 'auto'; tutorialStep = 0; gameStats.tutorialCompleted = true; saveStats(); gameState = 'PLAYING'; }

let dragObj = null; let dragOffX = 0; let dragOffY = 0;
document.querySelectorAll('.draggable-btn').forEach(btn => {
    btn.addEventListener('pointerdown', (e) => {
        e.stopPropagation(); e.preventDefault();
        if (gameState === 'PLAYING' || gameState === 'TRANSITION' || gameState === 'TUTORIAL') {
            const type = btn.getAttribute('data-type');
            if (type === 'joystick') { joystick.active = true; joystick.pointerId = e.pointerId; const rect = btn.getBoundingClientRect(); joystick.baseX = rect.left + rect.width / 2; joystick.baseY = rect.top + rect.height / 2; document.getElementById('joystick-knob').style.transition = 'none'; return; }
            if (gameState === 'TUTORIAL') {
                if (tutorialStep === 1 && type === 'fire') { completeTutorialStep(1); shootBullet(); }
                else if (tutorialStep === 1.1 && type === 'missile') { completeTutorialStep(1.1); shootMissile(); }
                else if (tutorialStep === 2 && type === 'bullets') { completeTutorialStep(2); buyUpgrade(type); }
                else if (tutorialStep === 3 && type === 'speed') { completeTutorialStep(3); buyUpgrade(type); }
                else if (tutorialStep === 4 && (type === 'bullets' || type === 'speed')) buyUpgrade(type);
                else if (tutorialStep === 4.5 && type === 'btn3') { completeTutorialStep(4.5); buyUpgrade('evolve'); }
                return;
            }
            if (type === 'fire') shootBullet(); else if (type === 'missile') shootMissile(); else if (type === 'btn3') { (upgrades.bullets >= maxUpgradeLimit && upgrades.speed >= maxUpgradeLimit && evolutionStage < 3) ? buyUpgrade('evolve') : buyUpgrade('life'); } else buyUpgrade(type);
        } else if (gameState === 'PAUSED') { dragObj = btn; const rect = btn.getBoundingClientRect(); dragOffX = e.clientX - rect.left; dragOffY = e.clientY - rect.top; }
    });
});

document.addEventListener('pointermove', (e) => { 
    if (joystick.active && e.pointerId === joystick.pointerId && (gameState === 'PLAYING' || gameState === 'TRANSITION' || gameState === 'TUTORIAL')) {
        if (gameState === 'TUTORIAL' && tutorialStep === 0.5) { completeTutorialStep(0.5); }
        let dx = e.clientX - joystick.baseX; let dy = e.clientY - joystick.baseY; let dist = Math.hypot(dx, dy); let maxDist = 35; if (dist > maxDist) { dx = (dx / dist) * maxDist; dy = (dy / dist) * maxDist; }
        document.getElementById('joystick-knob').style.transform = `translate(${dx}px, ${dy}px)`; joystick.dx = dx / maxDist; joystick.dy = dy / maxDist; return;
    }
    if (dragObj && gameState === 'PAUSED') { const containerRect = document.getElementById('game-container').getBoundingClientRect(); let newX = e.clientX - containerRect.left - dragOffX; let newY = e.clientY - containerRect.top - dragOffY; if (newX < 0) newX = 0; if (newY < 0) newY = 0; if (newX > containerRect.width - dragObj.offsetWidth) newX = containerRect.width - dragObj.offsetWidth; if (newY > containerRect.height - dragObj.offsetHeight) newY = containerRect.height - dragObj.offsetHeight; let pctX = (newX / containerRect.width) * 100; let pctY = (newY / containerRect.height) * 100; dragObj.style.left = pctX + '%'; dragObj.style.top = pctY + '%'; } 
});

const endJoystick = (e) => { if (joystick.active && e.pointerId === joystick.pointerId) { joystick.active = false; joystick.pointerId = null; joystick.dx = 0; joystick.dy = 0; let knob = document.getElementById('joystick-knob'); if(knob) { knob.style.transition = 'transform 0.2s ease-out'; knob.style.transform = `translate(0px, 0px)`; } } };
document.addEventListener('pointerup', (e) => { endJoystick(e); if (dragObj && gameState === 'PAUSED') { dragObj = null; saveHudPositions(); unlockAchievement('a1'); } }); document.addEventListener('pointercancel', endJoystick);

window.updateUpgradesHUD = function() {
    document.getElementById('coinVal').textContent = coins; const btnBullets = document.getElementById('hud-bullets'); 
    if (upgrades.bullets >= maxUpgradeLimit) { btnBullets.querySelector('.hud-lvl').textContent = 'MÁX'; btnBullets.querySelector('.hud-cost').style.display = 'none'; } else { btnBullets.querySelector('.hud-lvl').textContent = `Lv.${upgrades.bullets}`; btnBullets.querySelector('.hud-cost').style.display = 'block'; } btnBullets.classList.toggle('can-upgrade', upgrades.bullets < maxUpgradeLimit && coins >= 10);
    const btnSpeed = document.getElementById('hud-speed'); if (upgrades.speed >= maxUpgradeLimit) { btnSpeed.querySelector('.hud-lvl').textContent = 'MÁX'; btnSpeed.querySelector('.hud-cost').style.display = 'none'; } else { btnSpeed.querySelector('.hud-lvl').textContent = `Lv.${upgrades.speed}`; btnSpeed.querySelector('.hud-cost').style.display = 'block'; } btnSpeed.classList.toggle('can-upgrade', upgrades.speed < maxUpgradeLimit && coins >= 10);
    const btnLifeEvolve = document.getElementById('hud-life-evolve'); if (upgrades.bullets >= maxUpgradeLimit && upgrades.speed >= maxUpgradeLimit && evolutionStage < 3) { btnLifeEvolve.querySelector('.hud-emoji').textContent = '🌟'; btnLifeEvolve.querySelector('.hud-lvl').textContent = 'F.'+(evolutionStage+2); btnLifeEvolve.querySelector('.hud-cost').style.display = 'none'; btnLifeEvolve.style.borderColor = '#fbbf24'; btnLifeEvolve.classList.toggle('can-upgrade', true); } else { btnLifeEvolve.querySelector('.hud-emoji').textContent = '❤️'; if (lives >= 10) { btnLifeEvolve.querySelector('.hud-lvl').textContent = 'MÁX'; btnLifeEvolve.querySelector('.hud-cost').style.display = 'none'; } else { btnLifeEvolve.querySelector('.hud-lvl').textContent = '+1'; btnLifeEvolve.querySelector('.hud-cost').style.display = 'block'; } btnLifeEvolve.style.borderColor = 'rgba(56, 189, 248, 0.5)'; btnLifeEvolve.classList.toggle('can-upgrade', lives < 10 && coins >= 15); }
    document.getElementById('pauseBulletsLvl').textContent = upgrades.bullets >= maxUpgradeLimit ? 'MÁX' : `🪙10`; document.getElementById('pauseSpeedLvl').textContent = upgrades.speed >= maxUpgradeLimit ? 'MÁX' : `🪙10`;
    const pauseEv = document.getElementById('pauseEvolveBtn'); if (evolutionStage >= 3) pauseEv.style.display = 'none'; else pauseEv.style.display = 'flex';
    const armorBtn = document.getElementById('hud-armor'); const damageBtn = document.getElementById('hud-damage'); const superDmgBtn = document.getElementById('hud-super-damage'); const pauseSuperDmg = document.getElementById('pauseSuperDmgBtn');
    if (gameRound >= 2) { armorBtn.style.display = 'flex'; damageBtn.style.display = 'flex'; if (upgrades.armor > 0) { armorBtn.querySelector('.hud-lvl').textContent = 'MÁX'; armorBtn.querySelector('.hud-cost').style.display = 'none'; } if (upgrades.dmgBoost > 0) { damageBtn.querySelector('.hud-lvl').textContent = 'MÁX'; damageBtn.querySelector('.hud-cost').style.display = 'none'; } armorBtn.classList.toggle('can-upgrade', upgrades.armor === 0 && coins >= 300); damageBtn.classList.toggle('can-upgrade', upgrades.dmgBoost === 0 && coins >= 200); } else { armorBtn.style.display = 'none'; damageBtn.style.display = 'none'; }
    if (gameRound === 3 || goingToRound === 3) { superDmgBtn.style.display = 'flex'; pauseSuperDmg.style.display = 'flex'; if (upgrades.superDmgBoost > 0) { superDmgBtn.querySelector('.hud-lvl').textContent = 'MÁX'; superDmgBtn.querySelector('.hud-cost').style.display = 'none'; document.getElementById('pauseSuperDmgLvl').textContent = 'MÁX'; } superDmgBtn.classList.toggle('can-upgrade', upgrades.superDmgBoost === 0 && coins >= 1000); } else { superDmgBtn.style.display = 'none'; pauseSuperDmg.style.display = 'none'; }
    
    let mBtn = document.getElementById('missileBtn');
    if (mBtn) { 
        let emojiDiv = mBtn.querySelector('.hud-emoji'); 
        if (emojiDiv) { 
            let mIndex = gameStats.selectedShip; 
            let mIcons = ['🐥', '🧶', '🧲', '🥛'];
            let isProM = gameStats.useProShip && gameStats.proMissiles[mIndex];
            let mSrcBase = ['assets/bala_pollito.png', 'assets/bala_lana.png', 'assets/bala_herradura.png', 'assets/bala_leche.png'];
            let mSrcPro = ['assets/bala_pollito_pro.png', 'assets/bala_lana_pro.png', 'assets/bala_herradura_pro.png', 'assets/bala_leche_pro.png'];
            let imgSrc = isProM ? mSrcPro[mIndex] : mSrcBase[mIndex];
            if(imgSrc) { emojiDiv.innerHTML = `<img src="${imgSrc}" onerror="this.style.display='none'; this.parentNode.textContent='${mIcons[mIndex]}';" style="width: 26px; height: 26px; object-fit: contain; filter: drop-shadow(0px 2px 2px rgba(0,0,0,0.8)); vertical-align: middle;">`; } else { emojiDiv.textContent = mIcons[mIndex]; }
        } 
    }
}

function updateLivesUI() { document.getElementById('livesVal').textContent = `❤️ x${lives}`; }

window.buyUpgrade = function(type) {
    if (type === 'bullets' && upgrades.bullets < maxUpgradeLimit && coins >= 10) { coins -= 10; gameStats.savedCoins = coins; saveStats(); upgrades.bullets++; if (upgrades.bullets === maxUpgradeLimit) unlockAchievement('a8'); }
    else if (type === 'speed' && upgrades.speed < maxUpgradeLimit && coins >= 10) { coins -= 10; gameStats.savedCoins = coins; saveStats(); upgrades.speed++; if (upgrades.speed === maxUpgradeLimit) unlockAchievement('a9'); }
    else if (type === 'life' && coins >= 15 && lives < 10) { coins -= 15; gameStats.savedCoins = coins; saveStats(); lives++; partialHit = false; updateLivesUI(); gameStats.totalLivesBought++; saveStats(); sessionLivesBought++; if (gameStats.totalLivesBought >= 10) unlockAchievement('a15'); if (sessionLivesBought >= 10) unlockAchievement('a16'); }
    else if (type === 'evolve') { 
        if (upgrades.bullets >= maxUpgradeLimit && upgrades.speed >= maxUpgradeLimit) { 
            if (evolutionStage < 3) { 
                gameState = 'EVOLVING'; evolutionTimer = 150; 
                if (!gameStats.tutorialCompleted && tutorialStep === 4.5) { document.getElementById('activeTutorialOverlay').style.display = 'none'; document.getElementById('activeTutorialOverlay').style.pointerEvents = 'none'; }
                if (document.getElementById('pauseScreen').style.display === 'flex') { document.getElementById('pauseScreen').style.display = 'none'; document.querySelectorAll('.draggable-btn').forEach(b => b.classList.remove('paused')); }
                return; 
            } 
        } 
    }
    else if (type === 'armor' && gameRound >= 2 && coins >= 300 && upgrades.armor === 0) { coins -= 300; gameStats.savedCoins = coins; saveStats(); upgrades.armor = 1; }
    else if (type === 'damage' && gameRound >= 2 && coins >= 200 && upgrades.dmgBoost === 0) { coins -= 200; gameStats.savedCoins = coins; saveStats(); upgrades.dmgBoost = 1; }
    else if (type === 'superDamage' && (gameRound === 3 || goingToRound === 3) && coins >= 1000 && upgrades.superDmgBoost === 0) { coins -= 1000; gameStats.savedCoins = coins; saveStats(); upgrades.superDmgBoost = 1; }
    
    updateUpgradesHUD();
    if (!gameStats.tutorialCompleted && gameState !== 'EVOLVING') {
        if (tutorialStep === 4 || tutorialStep === 3.5) {
            if (upgrades.bullets >= maxUpgradeLimit) document.getElementById('hud-bullets').classList.remove('tutorial-highlight');
            if (upgrades.speed >= maxUpgradeLimit) document.getElementById('hud-speed').classList.remove('tutorial-highlight');
            if (upgrades.bullets >= maxUpgradeLimit && upgrades.speed >= maxUpgradeLimit) { tutorialStep = 4.5; activateTutorial("¡Excelente!<br><br>Ahora toca el botón de <b>Evolución</b> (🌟) para ascender a tu siguiente Fase.", 'hud-life-evolve'); } 
            else if (tutorialStep === 4 && coins < 10) { tutorialStep = 3.5; document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight')); document.getElementById('activeTutorialOverlay').style.display = 'none'; document.getElementById('activeTutorialOverlay').style.pointerEvents = 'auto'; gameState = 'PLAYING'; }
        }
    }
}

const dailyRewards = [100, 250, 500, 1000, 2000, 4000, 10000];
function checkDailyReward() {
    let now = new Date(); let today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(); let lastLogin = gameStats.lastLoginDate || 0; let oneDay = 24 * 60 * 60 * 1000; let diffDays = Math.round((today - lastLogin) / oneDay);
    if (diffDays > 0 || lastLogin === 0) { if (diffDays === 1) { gameStats.loginStreak++; if (gameStats.loginStreak > 7) gameStats.loginStreak = 1; } else { gameStats.loginStreak = 1; } showDailyRewardScreen(); }
}
function showDailyRewardScreen() {
    document.getElementById('startScreen').style.display = 'none'; document.getElementById('dailyRewardScreen').style.display = 'flex'; let grid = document.getElementById('dailyRewardsGrid'); grid.innerHTML = '';
    for (let i = 0; i < 7; i++) { let dayNum = i + 1; let reward = dailyRewards[i]; let isToday = (dayNum === gameStats.loginStreak); let isClaimed = (dayNum < gameStats.loginStreak); let boxColor = isToday ? '#f59e0b' : (isClaimed ? '#10b981' : '#1e293b'); let textColor = isToday ? '#000' : '#fff'; let opacity = isClaimed ? '0.6' : '1'; let icon = isClaimed ? '✅' : '🪙'; if (dayNum === 7 && !isClaimed) icon = '💎'; let extraStyle = (dayNum === 7) ? 'grid-column: span 3; font-size: 1.1rem; padding: 12px;' : 'padding: 8px;'; grid.innerHTML += `<div style="background: ${boxColor}; color: ${textColor}; ${extraStyle} border-radius: 8px; text-align: center; opacity: ${opacity}; box-shadow: ${isToday ? '0 0 12px #fbbf24' : 'none'}; border: 2px solid ${isToday ? '#fff' : 'transparent'};"><div style="font-size: 0.75rem; font-weight: bold; opacity: 0.9;">DÍA ${dayNum}</div><div style="font-size: ${dayNum===7 ? '1.8rem' : '1.3rem'}; margin: 2px 0;">${icon}</div><div style="font-size: 0.9rem; font-weight: 900;">+${reward.toLocaleString()}</div></div>`; }
}
document.getElementById('claimRewardBtn').addEventListener('click', () => { let now = new Date(); let today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(); let rewardIndex = gameStats.loginStreak - 1; let earned = dailyRewards[rewardIndex]; coins += earned; gameStats.savedCoins = coins; gameStats.totalCoins += earned; gameStats.lastLoginDate = today; saveStats(); document.getElementById('coinVal').textContent = coins; document.getElementById('dailyRewardScreen').style.display = 'none'; document.getElementById('startScreen').style.display = 'flex'; showTrophyToast("🎁", null, `¡+${earned.toLocaleString()} Monedas!`); }); setTimeout(checkDailyReward, 300);

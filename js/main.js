import { 
    canvas, ctx, gameStats, saveStats, player, score, setScore, coins, setCoins, 
    lives, setLives, gameTime, setGameTime, gameState, setGameState, previousState, setPreviousState, 
    currentMatchBooster, setCurrentMatchBooster, evolutionStage, setEvolutionStage, maxUpgradeLimit, setMaxUpgradeLimit, 
    nextBossScoreThreshold, setNextBossScoreThreshold, upgrades, bullets, homingMissiles, missileCooldownTimer, setMissileCooldownTimer, 
    enemies, bossBullets, bosses, gameRound, setGameRound, goingToRound, setGoingToRound, 
    timeAt40k, setTimeAt40k, shieldUnlocked, setShieldUnlocked, shieldActive, setShieldActive, 
    partialHit, setPartialHit, transitionTimer, setTransitionTimer, sessionKillsNoHit, setSessionKillsNoHit, 
    sessionTimeNoHit, setSessionTimeNoHit, sessionLivesBought, setSessionLivesBought, sessionCoinsEarned, 
    gotTrophy20k, setGotTrophy20k, gotTrophy50k, setGotTrophy50k, gotTrophy100k, setGotTrophy100k, 
    gotTrophy200k, setGotTrophy200k, gotTrophy300k, setGotTrophy300k, doubleBossSpawned, setDoubleBossSpawned, 
    doubleBossDefeated, setDoubleBossDefeated, toastIcon, toastImg, toastTimer, toastSubtitle, 
    setToastData, decrementToastTimer, tutorialStep, setTutorialStep, bgScrollY, addBgScrollY, assets, stars 
} from './config.js';

import { activateTutorial, completeTutorialStep } from './tutorial.js';
import { shootBullet, shootMissile } from './player.js';
import { spawnEnemy, spawnBoss, handleDamage, handleCoinEarned, damageBoss, damageEnemy } from './enemies.js';
import { loadHudPositions, saveHudPositions, updateHangarUI, updateShopUI, updateTrophyMenu, unlockAchievement, savePersistentTrophy, renderAchievementsList } from './ui.js';

loadHudPositions();

const playlist = ['assets/musica_1.mp3', 'assets/musica_2.mp3', 'assets/musica_3.mp3'];
let currentTrackIndex = 0; const bgMusic = new Audio(playlist[currentTrackIndex]); bgMusic.volume = 0.4; 
bgMusic.addEventListener('ended', () => { currentTrackIndex++; if (currentTrackIndex >= playlist.length) currentTrackIndex = 0; bgMusic.src = playlist[currentTrackIndex]; bgMusic.play().catch(e => console.log(e)); });

function pauseGame() { 
    if (gameState === 'PLAYING' || gameState === 'TRANSITION') { 
        setPreviousState(gameState);
        setGameState('PAUSED'); bgMusic.pause(); document.getElementById('pauseScreen').style.display = 'flex'; document.querySelectorAll('.draggable-btn').forEach(b => b.classList.add('paused')); isDraggingShip = false; dragPointerId = null; 
    } 
}
document.getElementById('muteMenuBtn').addEventListener('click', (e) => { e.stopPropagation(); bgMusic.muted = !bgMusic.muted; e.target.textContent = bgMusic.muted ? '🔇 Activar Música' : '🔊 Silenciar Música'; });
document.getElementById('pauseBtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); pauseGame(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) pauseGame(); });
document.getElementById('resumeBtn').addEventListener('click', (e) => { 
    e.stopPropagation(); 
    if (gameState === 'PAUSED') { 
        setGameState(previousState); 
        if (!bgMusic.muted) bgMusic.play().catch(e => console.log(e)); 
        document.getElementById('pauseScreen').style.display = 'none'; document.querySelectorAll('.draggable-btn').forEach(b => b.classList.remove('paused')); 
    } 
});

window.closeScreen = function(id) { document.getElementById(id).style.display = 'none'; document.getElementById('startScreen').style.display = 'flex'; }

document.getElementById('openTutorialBtn').addEventListener('click', () => { document.getElementById('startScreen').style.display = 'none'; document.getElementById('tutorialScreen').style.display = 'flex'; });
document.getElementById('openHangarBtn').addEventListener('click', () => { updateHangarUI(); document.getElementById('startScreen').style.display = 'none'; document.getElementById('hangarScreen').style.display = 'flex'; });
document.getElementById('openShopBtn').addEventListener('click', () => { updateShopUI(); document.getElementById('startScreen').style.display = 'none'; document.getElementById('shopScreen').style.display = 'flex'; });
document.getElementById('openRecordsBtn').addEventListener('click', () => { document.getElementById('startScreen').style.display = 'none'; document.getElementById('recordsScreen').style.display = 'flex'; });
document.getElementById('openTrophiesBtn').addEventListener('click', () => { updateTrophyMenu(); document.getElementById('startScreen').style.display = 'none'; document.getElementById('trophiesScreen').style.display = 'flex'; });
document.getElementById('openAchievBtn').addEventListener('click', () => { renderAchievementsList(); document.getElementById('startScreen').style.display = 'none'; document.getElementById('achievScreen').style.display = 'flex'; });
document.getElementById('mainMenuBtn').addEventListener('click', () => { 
    document.getElementById('gameOverScreen').style.display = 'none'; 
    document.getElementById('startScreen').style.display = 'flex'; 
    setGameState('START'); setPreviousState('START');
    document.querySelectorAll('.draggable-btn').forEach(b => b.style.display = 'none'); 
});

let leaderboard = JSON.parse(localStorage.getItem('farm_space_leaderboard')) || [{ name: 'PRO', score: 200000 }, { name: 'ANA', score: 100000 }, { name: 'BOB', score: 50000 }];
function saveLeaderboard() { localStorage.setItem('farm_space_leaderboard', JSON.stringify(leaderboard)); }
function renderLeaderboard(elementId) { const container = document.getElementById(elementId); container.innerHTML = ''; if (leaderboard.length === 0) { container.innerHTML = '<div class="lb-row"><span>Sin récords</span><span></span></div>'; return; } leaderboard.forEach((item, index) => { const row = document.createElement('div'); row.className = 'lb-row'; row.innerHTML = `<span>#${index + 1} ${item.name}</span> <span>${item.score} pts</span>`; container.appendChild(row); }); }

let keys = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false, KeyA: false, KeyD: false, KeyW: false, KeyS: false };
window.addEventListener('keydown', (e) => { 
    if (e.code in keys) keys[e.code] = true; 
    if (e.code === 'Space') {
        if (gameState === 'TUTORIAL' && tutorialStep === 1) { completeTutorialStep(1); shootBullet(); }
        else if (gameState === 'PLAYING' || gameState === 'TRANSITION') shootBullet();
    }
    if (e.code === 'KeyM') {
        if (gameState === 'TUTORIAL' && tutorialStep === 1.1) { completeTutorialStep(1.1); shootMissile(); }
        else if (gameState === 'PLAYING' || gameState === 'TRANSITION') shootMissile(); 
    }
});
window.addEventListener('keyup', (e) => { if (e.code in keys) keys[e.code] = false; });

let dragObj = null; let dragOffX = 0; let dragOffY = 0;
document.querySelectorAll('.draggable-btn').forEach(btn => {
    btn.addEventListener('pointerdown', (e) => {
        e.stopPropagation(); e.preventDefault();
        
        if (gameState === 'PLAYING' || gameState === 'TRANSITION' || gameState === 'TUTORIAL') {
            const type = btn.getAttribute('data-type');
            
            if (gameState === 'TUTORIAL') {
                if (tutorialStep === 1 && type === 'fire') { completeTutorialStep(1); shootBullet(); }
                else if (tutorialStep === 1.1 && type === 'missile') { completeTutorialStep(1.1); shootMissile(); }
                else if (tutorialStep === 2 && type === 'bullets') { completeTutorialStep(2); buyUpgrade(type); }
                else if (tutorialStep === 3 && type === 'speed') { completeTutorialStep(3); buyUpgrade(type); }
                else if (tutorialStep === 4 && (type === 'bullets' || type === 'speed')) buyUpgrade(type);
                else if (tutorialStep === 4.5 && type === 'btn3') { completeTutorialStep(4.5); buyUpgrade('evolve'); }
                return;
            }
            
            if (type === 'fire') shootBullet(); 
            else if (type === 'missile') shootMissile();
            else if (type === 'btn3') { (upgrades.bullets >= maxUpgradeLimit && upgrades.speed >= maxUpgradeLimit && evolutionStage < 3) ? buyUpgrade('evolve') : buyUpgrade('life'); } 
            else buyUpgrade(type);
        } else if (gameState === 'PAUSED') { dragObj = btn; const rect = btn.getBoundingClientRect(); dragOffX = e.clientX - rect.left; dragOffY = e.clientY - rect.top; }
    });
});

document.addEventListener('pointermove', (e) => { 
    if (dragObj && gameState === 'PAUSED') { 
        const containerRect = document.getElementById('game-container').getBoundingClientRect(); 
        let newX = e.clientX - containerRect.left - dragOffX; let newY = e.clientY - containerRect.top - dragOffY; 
        if (newX < 0) newX = 0; if (newY < 0) newY = 0; if (newX > containerRect.width - dragObj.offsetWidth) newX = containerRect.width - dragObj.offsetWidth; if (newY > containerRect.height - dragObj.offsetHeight) newY = containerRect.height - dragObj.offsetHeight; 
        let pctX = (newX / containerRect.width) * 100; let pctY = (newY / containerRect.height) * 100;
        dragObj.style.left = pctX + '%'; dragObj.style.top = pctY + '%'; 
    } 
});
document.addEventListener('pointerup', (e) => { if (dragObj && gameState === 'PAUSED') { dragObj = null; saveHudPositions(); unlockAchievement('a1'); } });

let isDraggingShip = false; let dragPointerId = null; let lastTouchX = 0; let lastTouchY = 0;
canvas.addEventListener('pointerdown', (e) => { 
    if (dragPointerId === null && (gameState === 'PLAYING' || gameState === 'TRANSITION')) { 
        dragPointerId = e.pointerId; isDraggingShip = true; 
        lastTouchX = (e.clientX - canvas.getBoundingClientRect().left) * (canvas.width / canvas.getBoundingClientRect().width); 
        lastTouchY = (e.clientY - canvas.getBoundingClientRect().top) * (canvas.height / canvas.getBoundingClientRect().height);
    } 
});
canvas.addEventListener('pointermove', (e) => { 
    if (!isDraggingShip || (gameState !== 'PLAYING' && gameState !== 'TRANSITION') || e.pointerId !== dragPointerId) return; 
    const currentTouchX = (e.clientX - canvas.getBoundingClientRect().left) * (canvas.width / canvas.getBoundingClientRect().width); 
    const currentTouchY = (e.clientY - canvas.getBoundingClientRect().top) * (canvas.height / canvas.getBoundingClientRect().height);
    
    player.x += (currentTouchX - lastTouchX) * (1 + (upgrades.speed * 0.15)); player.y += (currentTouchY - lastTouchY) * (1 + (upgrades.speed * 0.15)); 
    if (player.x < 10) player.x = 10; if (player.x > canvas.width - player.width - 10) player.x = canvas.width - player.width - 10; 
    if (player.y < canvas.height / 2) player.y = canvas.height / 2; if (player.y > canvas.height - player.height - 10) player.y = canvas.height - player.height - 10; 
    lastTouchX = currentTouchX; lastTouchY = currentTouchY;
});
window.addEventListener('pointerup', (e) => { if (e.pointerId === dragPointerId) { isDraggingShip = false; dragPointerId = null; } }); 
window.addEventListener('pointercancel', (e) => { if (e.pointerId === dragPointerId) { isDraggingShip = false; dragPointerId = null; } });

window.buyUpgrade = function(type) {
    if (type === 'bullets' && upgrades.bullets < maxUpgradeLimit && coins >= 10) { setCoins(coins - 10); gameStats.savedCoins = coins; saveStats(); upgrades.bullets++; if (upgrades.bullets === maxUpgradeLimit) unlockAchievement('a8'); }
    else if (type === 'speed' && upgrades.speed < maxUpgradeLimit && coins >= 10) { setCoins(coins - 10); gameStats.savedCoins = coins; saveStats(); upgrades.speed++; if (upgrades.speed === maxUpgradeLimit) unlockAchievement('a9'); }
    else if (type === 'life' && coins >= 15 && lives < 10) { setCoins(coins - 15); gameStats.savedCoins = coins; saveStats(); setLives(lives + 1); setPartialHit(false); updateLivesUI(); gameStats.totalLivesBought++; saveStats(); setSessionLivesBought(sessionLivesBought + 1); if (gameStats.totalLivesBought >= 10) unlockAchievement('a15'); if (sessionLivesBought >= 10) unlockAchievement('a16'); }
    else if (type === 'evolve') { 
        if (upgrades.bullets >= maxUpgradeLimit && upgrades.speed >= maxUpgradeLimit) {
            if (evolutionStage === 0) { setEvolutionStage(1); setMaxUpgradeLimit(6); unlockAchievement('a5'); } 
            else if (evolutionStage === 1) { setEvolutionStage(2); setMaxUpgradeLimit(10); unlockAchievement('a6'); } 
            else if (evolutionStage === 2) { setEvolutionStage(3); setMaxUpgradeLimit(10); unlockAchievement('a7'); }
        }
    }
    else if (type === 'armor' && gameRound >= 2 && coins >= 300 && upgrades.armor === 0) { setCoins(coins - 300); gameStats.savedCoins = coins; saveStats(); upgrades.armor = 1; }
    else if (type === 'damage' && gameRound >= 2 && coins >= 200 && upgrades.dmgBoost === 0) { setCoins(coins - 200); gameStats.savedCoins = coins; saveStats(); upgrades.dmgBoost = 1; }
    else if (type === 'superDamage' && (gameRound === 3 || goingToRound === 3) && coins >= 1000 && upgrades.superDmgBoost === 0) { setCoins(coins - 1000); gameStats.savedCoins = coins; saveStats(); upgrades.superDmgBoost = 1; }
    
    updateUpgradesHUD();

    if (!gameStats.tutorialCompleted) {
        if ((tutorialStep === 3.5 || tutorialStep === 4) && upgrades.bullets >= maxUpgradeLimit && upgrades.speed >= maxUpgradeLimit) {
            document.getElementById('hud-bullets').classList.remove('tutorial-highlight');
            document.getElementById('hud-speed').classList.remove('tutorial-highlight');
            setTutorialStep(4.5);
            activateTutorial("¡Excelente!<br><br>Ahora toca el botón de <b>Evolución</b> (🌟) para transformar tu nave.", 'hud-life-evolve');
        } else if (tutorialStep === 4) {
            if (upgrades.bullets >= maxUpgradeLimit) document.getElementById('hud-bullets').classList.remove('tutorial-highlight');
            if (upgrades.speed >= maxUpgradeLimit) document.getElementById('hud-speed').classList.remove('tutorial-highlight');
        }
    }
}

function updateUpgradesHUD() {
    document.getElementById('coinVal').textContent = coins;
    const btnBullets = document.getElementById('hud-bullets'); 
    if (upgrades.bullets >= maxUpgradeLimit) { btnBullets.querySelector('.hud-lvl').textContent = 'MÁX'; btnBullets.querySelector('.hud-cost').style.display = 'none'; } else { btnBullets.querySelector('.hud-lvl').textContent = `Lv.${upgrades.bullets}`; btnBullets.querySelector('.hud-cost').style.display = 'block'; }
    btnBullets.classList.toggle('can-upgrade', upgrades.bullets < maxUpgradeLimit && coins >= 10);
    const btnSpeed = document.getElementById('hud-speed'); 
    if (upgrades.speed >= maxUpgradeLimit) { btnSpeed.querySelector('.hud-lvl').textContent = 'MÁX'; btnSpeed.querySelector('.hud-cost').style.display = 'none'; } else { btnSpeed.querySelector('.hud-lvl').textContent = `Lv.${upgrades.speed}`; btnSpeed.querySelector('.hud-cost').style.display = 'block'; }
    btnSpeed.classList.toggle('can-upgrade', upgrades.speed < maxUpgradeLimit && coins >= 10);
    const btnLifeEvolve = document.getElementById('hud-life-evolve'); 
    if (upgrades.bullets >= maxUpgradeLimit && upgrades.speed >= maxUpgradeLimit && evolutionStage < 3) { 
        btnLifeEvolve.querySelector('.hud-emoji').textContent = '🌟'; btnLifeEvolve.querySelector('.hud-lvl').textContent = 'EVOL.'; btnLifeEvolve.querySelector('.hud-cost').style.display = 'none'; btnLifeEvolve.style.borderColor = '#fbbf24'; btnLifeEvolve.classList.toggle('can-upgrade', true); 
    } else { 
        btnLifeEvolve.querySelector('.hud-emoji').textContent = '❤️'; 
        if (lives >= 10) { btnLifeEvolve.querySelector('.hud-lvl').textContent = 'MÁX'; btnLifeEvolve.querySelector('.hud-cost').style.display = 'none'; } else { btnLifeEvolve.querySelector('.hud-lvl').textContent = '+1'; btnLifeEvolve.querySelector('.hud-cost').style.display = 'block'; }
        btnLifeEvolve.style.borderColor = 'rgba(56, 189, 248, 0.5)'; btnLifeEvolve.classList.toggle('can-upgrade', lives < 10 && coins >= 15);
    }
    document.getElementById('pauseBulletsLvl').textContent = upgrades.bullets >= maxUpgradeLimit ? 'MÁX' : `🪙10`; document.getElementById('pauseSpeedLvl').textContent = upgrades.speed >= maxUpgradeLimit ? 'MÁX' : `🪙10`;
    const pauseEv = document.getElementById('pauseEvolveBtn'); if (evolutionStage >= 3) pauseEv.style.display = 'none'; else pauseEv.style.display = 'flex';
    const armorBtn = document.getElementById('hud-armor'); const damageBtn = document.getElementById('hud-damage'); const superDmgBtn = document.getElementById('hud-super-damage'); const pauseSuperDmg = document.getElementById('pauseSuperDmgBtn');
    if (gameRound >= 2) { 
        armorBtn.style.display = 'flex'; damageBtn.style.display = 'flex'; 
        if (upgrades.armor > 0) { armorBtn.querySelector('.hud-lvl').textContent = 'MÁX'; armorBtn.querySelector('.hud-cost').style.display = 'none'; } 
        if (upgrades.dmgBoost > 0) { damageBtn.querySelector('.hud-lvl').textContent = 'MÁX'; damageBtn.querySelector('.hud-cost').style.display = 'none'; } 
        armorBtn.classList.toggle('can-upgrade', upgrades.armor === 0 && coins >= 300); damageBtn.classList.toggle('can-upgrade', upgrades.dmgBoost === 0 && coins >= 200);
    } else { armorBtn.style.display = 'none'; damageBtn.style.display = 'none'; }
    if (gameRound === 3 || goingToRound === 3) {
        superDmgBtn.style.display = 'flex'; pauseSuperDmg.style.display = 'flex';
        if (upgrades.superDmgBoost > 0) { superDmgBtn.querySelector('.hud-lvl').textContent = 'MÁX'; superDmgBtn.querySelector('.hud-cost').style.display = 'none'; document.getElementById('pauseSuperDmgLvl').textContent = 'MÁX'; }
        superDmgBtn.classList.toggle('can-upgrade', upgrades.superDmgBoost === 0 && coins >= 1000);
    } else { superDmgBtn.style.display = 'none'; pauseSuperDmg.style.display = 'none'; }
}

function updateTrophiesHUD() { 
    let html = ""; 
    function getTrophyHTML(imgObj, emoji) { return (imgObj.complete && imgObj.naturalWidth > 0) ? `<img src="${imgObj.src}" style="height:18px; margin-left:4px; filter: drop-shadow(0 0 2px rgba(255,255,255,0.5));">` : `<span style="margin-left:4px;">${emoji}</span>`; }
    if (gotTrophy20k) html += getTrophyHTML(assets.trofeoPollito, "🥉🐥"); 
    if (gotTrophy50k) html += getTrophyHTML(assets.trofeoLana, "🥈🧶"); 
    if (gotTrophy100k) html += getTrophyHTML(assets.trofeoHerradura, "🏅🧲"); 
    if (gotTrophy200k) html += getTrophyHTML(assets.trofeoLeche, "🏆🥛"); 
    if (gotTrophy300k) html += getTrophyHTML(assets.trofeoDiamante, "💎🐔");
    document.getElementById('trophiesVal').innerHTML = html; 
}

let enemySpawnInterval = 0;
function update() {
    if (gameState === 'TUTORIAL') return;

    if (gameState === 'TRANSITION') {
        if (transitionTimer === 300) {
            const container = document.getElementById('game-container');
            if (container) {
                container.classList.add('shake-effect');
                setTimeout(() => container.classList.remove('shake-effect'), 400);
            }
        }

        setTransitionTimer(transitionTimer - 1);
        bullets.splice(0, bullets.length); homingMissiles.splice(0, homingMissiles.length); bossBullets.splice(0, bossBullets.length); enemies.splice(0, enemies.length);
        for (let s of stars) { s.y += s.speed; if (s.y > canvas.height) s.y = 0; }
        
        let currentSpeed = player.baseSpeed + (upgrades.speed - 1) * 0.5;
        if (keys.ArrowLeft || keys.KeyA) player.x -= currentSpeed; if (keys.ArrowRight || keys.KeyD) player.x += currentSpeed;
        if (keys.ArrowUp || keys.KeyW) player.y -= currentSpeed; if (keys.ArrowDown || keys.KeyS) player.y += currentSpeed;
        
        if (player.x < 10) player.x = 10; if (player.x > canvas.width - player.width - 10) player.x = canvas.width - player.width - 10;
        if (player.y < canvas.height / 2) player.y = canvas.height / 2; if (player.y > canvas.height - player.height - 10) player.y = canvas.height - player.height - 10;
        
        if (transitionTimer <= 0) {
            setGameRound(goingToRound);
            if (gameRound === 2) setNextBossScoreThreshold(150000);
            else if (gameRound === 3) setNextBossScoreThreshold(250000);
            
            document.querySelectorAll('.draggable-btn').forEach(b => { b.style.display = 'flex'; });
            updateUpgradesHUD(); bgMusic.volume = 0.4; setGameState('PLAYING'); setPreviousState('PLAYING');
        }
        return;
    }

    if (gameState !== 'PLAYING') return;

    if (missileCooldownTimer > 0) {
        setMissileCooldownTimer(missileCooldownTimer - 1);
        let sec = Math.ceil(missileCooldownTimer / 60);
        document.getElementById('missileCooldown').textContent = sec + 's';
        document.getElementById('missileBtn').classList.remove('missile-ready');
    } else {
        document.getElementById('missileCooldown').textContent = 'LISTO';
        document.getElementById('missileBtn').classList.add('missile-ready');
    }

    if (score >= 20000 && !gotTrophy20k) { setGotTrophy20k(true); let isNew = !gameStats.missiles[0]; if (isNew) { gameStats.missiles[0] = true; gameStats.equippedMissiles[0] = true; saveStats(); } setToastData("🥉🐥", assets.trofeoPollito, isNew ? "¡Skin Misil Desbloqueada!" : "", 200); updateTrophiesHUD(); savePersistentTrophy('t20k'); }
    if (score >= 50000 && !gotTrophy50k) { setGotTrophy50k(true); let isNew = !gameStats.missiles[1]; if (isNew) { gameStats.missiles[1] = true; gameStats.equippedMissiles[1] = true; saveStats(); } setToastData("🥈🧶", assets.trofeoLana, isNew ? "¡Skin Misil Desbloqueada!" : "", 200); updateTrophiesHUD(); savePersistentTrophy('t50k'); }
    if (score >= 100000 && !gotTrophy100k) { setGotTrophy100k(true); let isNew = !gameStats.missiles[2]; if (isNew) { gameStats.missiles[2] = true; gameStats.equippedMissiles[2] = true; saveStats(); } setToastData("🏅🧲", assets.trofeoHerradura, isNew ? "¡Skin Misil Desbloqueada!" : "", 200); updateTrophiesHUD(); savePersistentTrophy('t100k'); }
    if (score >= 200000 && !gotTrophy200k) { setGotTrophy200k(true); let isNew = !gameStats.missiles[3]; if (isNew) { gameStats.missiles[3] = true; gameStats.equippedMissiles[3] = true; saveStats(); } setToastData("🏆🥛", assets.trofeoLeche, isNew ? "¡Skin Misil Desbloqueada!" : "", 200); updateTrophiesHUD(); savePersistentTrophy('t200k'); unlockAchievement('a19'); }
    if (score >= 300000 && !gotTrophy300k) { setGotTrophy300k(true); let pTrophies = JSON.parse(localStorage.getItem('farm_space_trophies')) || {}; let sub = ""; if (!pTrophies['t300k']) { if (gameStats.skins[3]) { setCoins(coins + 4000); gameStats.savedCoins = coins; sub = "Vaca Pro Reembolsada (+4,000🪙)"; } else { gameStats.skins[3] = true; gameStats.equippedSkins[3] = true; sub = "¡Skin Vaca Pro Desbloqueada!"; } } saveStats(); setToastData("💎🐔", assets.trofeoDiamante, sub, 200); updateTrophiesHUD(); savePersistentTrophy('t300k'); }
    if (score >= 500000) unlockAchievement('a20');
    if (doubleBossSpawned && !doubleBossDefeated && bosses.length === 0 && score >= 250000) { setDoubleBossDefeated(true); unlockAchievement('a21'); }
    if (score >= 40000 && !shieldUnlocked) { setShieldUnlocked(true); setShieldActive(true); setTimeAt40k(gameTime); }
    if (shieldUnlocked && !shieldActive && sessionTimeNoHit >= 5) { setShieldActive(true); }

    if (score >= nextBossScoreThreshold && bosses.length === 0) { 
        let currentThreshold = nextBossScoreThreshold; spawnBoss(); 
        if (gameRound === 1) setNextBossScoreThreshold(nextBossScoreThreshold + 5000); 
        else if (gameRound === 2 && currentThreshold === 150000) setNextBossScoreThreshold(9999999); 
        else if (gameRound === 3 && currentThreshold === 250000) setNextBossScoreThreshold(9999999); 
    }

    let currentSpeed = player.baseSpeed + (upgrades.speed - 1) * 0.5;
    if (keys.ArrowLeft || keys.KeyA) player.x -= currentSpeed; if (keys.ArrowRight || keys.KeyD) player.x += currentSpeed;
    if (keys.ArrowUp || keys.KeyW) player.y -= currentSpeed; if (keys.ArrowDown || keys.KeyS) player.y += currentSpeed;
    
    if (player.x < 10) player.x = 10; if (player.x > canvas.width - player.width - 10) player.x = canvas.width - player.width - 10;
    if (player.y < canvas.height / 2) player.y = canvas.height / 2; if (player.y > canvas.height - player.height - 10) player.y = canvas.height - player.height - 10;
    
    for (let s of stars) { s.y += s.speed; if (s.y > canvas.height) s.y = 0; }
    
    for (let i = bullets.length - 1; i >= 0; i--) { 
        bullets[i].y -= bullets[i].speed; if (bullets[i].dx) bullets[i].x += bullets[i].dx; 
        if (bullets[i].y < -20 || bullets[i].x < -30 || bullets[i].x > canvas.width + 30) bullets.splice(i, 1); 
    }

    for (let i = homingMissiles.length - 1; i >= 0; i--) {
        let m = homingMissiles[i];
        let target = null;
        
        if (bosses.length > 0) { target = bosses[0]; } 
        else if (enemies.length > 0) { target = enemies.reduce((prev, curr) => (prev.hp > curr.hp) ? prev : curr); }
        
        if (target) {
            let tx = target.x + target.width / 2;
            let ty = target.y + target.height / 2;
            let angle = Math.atan2(ty - (m.y + m.height / 2), tx - (m.x + m.width / 2));
            m.vx += (Math.cos(angle) * m.speed - m.vx) * 0.08;
            m.vy += (Math.sin(angle) * m.speed - m.vy) * 0.08;
        } else {
            m.vy -= 0.2; 
        }
        
        m.x += m.vx; m.y += m.vy;
        
        if (m.y < -50 || m.x < -50 || m.x > canvas.width + 50 || m.y > canvas.height + 50) { homingMissiles.splice(i, 1); continue; }
        
        let hit = false;
        for (let j = bosses.length - 1; j >= 0; j--) {
            if (m.x < bosses[j].x + bosses[j].width && m.x + m.width > bosses[j].x && m.y < bosses[j].y + bosses[j].height && m.y + m.height > bosses[j].y) {
                hit = true; damageBoss(j, m.damage, bgMusic); break;
            }
        }
        if (hit) { homingMissiles.splice(i, 1); continue; }
        
        for (let j = enemies.length - 1; j >= 0; j--) {
            if (m.x < enemies[j].x + enemies[j].width && m.x + m.width > enemies[j].x && m.y < enemies[j].y + enemies[j].height && m.y + m.height > enemies[j].y) {
                hit = true; damageEnemy(j, m.damage); break;
            }
        }
        if (hit) { homingMissiles.splice(i, 1); continue; }
    }

    for (let i = bossBullets.length - 1; i >= 0; i--) { bossBullets[i].y += bossBullets[i].speed; if (bossBullets[i].dx) bossBullets[i].x += bossBullets[i].dx; if (bossBullets[i].y > canvas.height + 20 || bossBullets[i].x < -20 || bossBullets[i].x > canvas.width + 20) { bossBullets.splice(i, 1); continue; } if (player.x < bossBullets[i].x + bossBullets[i].width && player.x + player.width > bossBullets[i].x && player.y < bossBullets[i].y + bossBullets[i].height && player.y + player.height > bossBullets[i].y) { bossBullets.splice(i, 1); handleDamage(updateLivesUI, gameOver); } }

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
        
        if (!boss.entered) {
            boss.y += 1.5;
            if (boss.y >= 50) boss.entered = true;
        } else {
            boss.x += boss.speed * boss.direction;
            boss.y += (boss.speed * 0.4) * boss.dirY;
            if (boss.x < 10 || boss.x + boss.width > canvas.width - 10) boss.direction *= -1;
            if (boss.y < 50 || boss.y + boss.height > canvas.height / 2 - 20) boss.dirY *= -1;
        }
        
        boss.shootCooldown++;
        if (boss.isSuperBoss) {
            boss.minionCooldown++;
            if (boss.type === 'corn' && boss.shootCooldown >= 55) { boss.shootCooldown = 0; bossBullets.push({ x: boss.x + boss.width / 2 - 40, y: boss.y + boss.height - 10, width: 16, height: 16, speed: 6.5, dx: -2.5 }); bossBullets.push({ x: boss.x + boss.width / 2 - 15, y: boss.y + boss.height - 10, width: 16, height: 16, speed: 6.5, dx: -0.8 }); bossBullets.push({ x: boss.x + boss.width / 2 + 15, y: boss.y + boss.height - 10, width: 16, height: 16, speed: 6.5, dx: 0.8 }); bossBullets.push({ x: boss.x + boss.width / 2 + 40, y: boss.y + boss.height - 10, width: 16, height: 16, speed: 6.5, dx: 2.5 }); }
            if (boss.type === 'corn' && boss.minionCooldown >= 110) { boss.minionCooldown = 0; enemies.push({ x: boss.x + 20, y: boss.y + boss.height - 30, width: 48, height: 48, hp: 3, maxHp: 3, speed: 2, wobble: 0, type: 'corn_strong', pts: 150, coin: 2, shootCooldown: 0 }); enemies.push({ x: boss.x + boss.width - 68, y: boss.y + boss.height - 30, width: 48, height: 48, hp: 3, maxHp: 3, speed: 2, wobble: Math.PI, type: 'corn_strong', pts: 150, coin: 2, shootCooldown: 0 }); }
            if (boss.type === 'lechuga' && boss.shootCooldown >= 45) { boss.shootCooldown = 0; bossBullets.push({ x: boss.x + boss.width / 2 - 30, y: boss.y + boss.height, width: 16, height: 16, speed: 7, dx: -2.0, isLechugaBala: true }); bossBullets.push({ x: boss.x + boss.width / 2 - 10, y: boss.y + boss.height, width: 16, height: 16, speed: 7, dx: -0.6, isLechugaBala: true }); bossBullets.push({ x: boss.x + boss.width / 2 + 10, y: boss.y + boss.height, width: 16, height: 16, speed: 7, dx: 0.6, isLechugaBala: true }); bossBullets.push({ x: boss.x + boss.width / 2 + 30, y: boss.y + boss.height, width: 16, height: 16, speed: 7, dx: 2.0, isLechugaBala: true }); }
            if (boss.type === 'lechuga' && boss.minionCooldown >= 90) { boss.minionCooldown = 0; enemies.push({ x: boss.x + boss.width / 2 - 24, y: boss.y + boss.height, width: 48, height: 48, hp: 5, maxHp: 5, type: 'lechuga_fuerte', speed: 1.5, wobble: 0, pts: 300, coin: 2, shootCooldown: 0 }); }
        } else {
            if (boss.shootCooldown >= 40) {
                boss.shootCooldown = 0; let bc = Math.min(4, Math.max(1, score >= 20000 ? 2 + Math.floor((score - 20000) / 20000) : 1)); let isLB = boss.type === 'lechuga';
                if (bc === 1) { bossBullets.push({ x: boss.x + boss.width / 2 - 6, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: 0, isLechugaBala: isLB }); }
                else if (bc === 2) { bossBullets.push({ x: boss.x + boss.width / 2 - 16, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: -1.2, isLechugaBala: isLB }); bossBullets.push({ x: boss.x + boss.width / 2 + 4, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: 1.2, isLechugaBala: isLB }); }
                else if (bc === 3) { bossBullets.push({ x: boss.x + boss.width / 2 - 24, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: -2, isLechugaBala: isLB }); bossBullets.push({ x: boss.x + boss.width / 2 - 6, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: 0, isLechugaBala: isLB }); bossBullets.push({ x: boss.x + boss.width / 2 + 12, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: 2, isLechugaBala: isLB }); }
                else { bossBullets.push({ x: boss.x + boss.width / 2 - 30, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: -2.5, isLechugaBala: isLB }); bossBullets.push({ x: boss.x + boss.width / 2 - 12, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: -0.8, isLechugaBala: isLB }); bossBullets.push({ x: boss.x + boss.width / 2, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: 0.8, isLechugaBala: isLB }); bossBullets.push({ x: boss.x + boss.width / 2 + 18, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: 2.5, isLechugaBala: isLB }); }
            }
        }

        for (let j = bullets.length - 1; j >= 0; j--) {
            if (bullets[j] && bullets[j].x < boss.x + boss.width && bullets[j].x + bullets[j].width > boss.x && bullets[j].y < boss.y + boss.height && bullets[j].y + bullets[j].height > boss.y) {
                let dmg = bullets[j].damage; bullets.splice(j, 1);
                damageBoss(bIndex, dmg, bgMusic);
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

        if (enemies[i].y > canvas.height) { enemies.splice(i, 1); handleDamage(updateLivesUI, gameOver); continue; }
        if (player.x < enemies[i].x + enemies[i].width && player.x + player.width > enemies[i].x && player.y < enemies[i].y + enemies[i].height && player.y + player.height > enemies[i].y) { enemies.splice(i, 1); handleDamage(updateLivesUI, gameOver); continue; }
        for (let j = bullets.length - 1; j >= 0; j--) {
            if (bullets[j] && bullets[j].x < enemies[i].x + enemies[i].width && bullets[j].x + bullets[j].width > enemies[i].x && bullets[j].y < enemies[i].y + enemies[i].height && bullets[j].y + bullets[j].height > enemies[i].y) {
                let dmg = bullets[j].damage; bullets.splice(j, 1);
                damageEnemy(i, dmg); break;
            }
        }
    }
}

function updateLivesUI() { document.getElementById('livesVal').textContent = `❤️ x${lives}`; }

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
    
    // CAMBIO DE FONDO DINÁMICO SEGÚN LA RONDA
    let activeBg = assets.fondoGalaxia;
    if (gameRound >= 2 && assets.fondoRonda2.complete && assets.fondoRonda2.naturalWidth > 0) {
        activeBg = assets.fondoRonda2;
    }

    if (activeBg.complete && activeBg.naturalWidth > 0) {
        addBgScrollY(0.5); 
        if (bgScrollY >= canvas.height) addBgScrollY(-canvas.height);
        ctx.drawImage(activeBg, 0, bgScrollY, canvas.width, canvas.height);
        ctx.drawImage(activeBg, 0, bgScrollY - canvas.height, canvas.width, canvas.height);
    }
    
    let bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    if (gameRound === 1) { bgGradient.addColorStop(0, 'rgba(9, 11, 20, 0.7)'); bgGradient.addColorStop(1, 'rgba(30, 27, 75, 0.8)'); } 
    else if (gameRound === 2) { bgGradient.addColorStop(0, 'rgba(26, 11, 46, 0.7)'); bgGradient.addColorStop(1, 'rgba(74, 20, 75, 0.8)'); } 
    else { bgGradient.addColorStop(0, 'rgba(42, 8, 8, 0.7)'); bgGradient.addColorStop(1, 'rgba(5, 0, 0, 0.9)'); }
    ctx.fillStyle = bgGradient; ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let s of stars) { ctx.globalAlpha = s.opacity; ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1.0;

    for (let b of bosses) drawBoss(b); 
    drawPlayerShip(player.x, player.y);
    
    for (let b of bullets) {
        ctx.fillStyle = '#38bdf8'; ctx.shadowColor = '#0ea5e9'; ctx.shadowBlur = 8;
        ctx.fillRect(b.x, b.y, b.width, b.height); ctx.shadowBlur = 0;
    }
    
    for (let m of homingMissiles) {
        ctx.save();
        ctx.translate(m.x + m.width/2, m.y + m.height/2);
        let angle = Math.atan2(m.vy, m.vx) + Math.PI/2; 
        ctx.rotate(angle);
        
        let imgNormal, imgPro; 
        if (m.type === 'milk') { imgNormal = assets.balaLeche; imgPro = assets.balaLechePro; }
        else if (m.type === 'horseshoe') { imgNormal = assets.balaHerradura; imgPro = assets.balaHerraduraPro; }
        else if (m.type === 'wool') { imgNormal = assets.balaLana; imgPro = assets.balaLanaPro; }
        else { imgNormal = assets.balaPollito; imgPro = assets.balaPollitoPro; }
        
        let imgToDraw = (m.isPro && imgPro.complete && imgPro.naturalWidth > 0) ? imgPro : imgNormal;
        
        if (imgToDraw.complete && imgToDraw.naturalWidth > 0) { ctx.drawImage(imgToDraw, -m.width/2, -m.height/2, m.width, m.height); } 
        else { ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; let icon = '🐥'; if (m.type === 'wool') icon = '🧶'; if (m.type === 'horseshoe') icon = '🧲'; if (m.type === 'milk') icon = '🥛'; ctx.fillText(icon, 0, 0); }
        ctx.restore();
    }
    
    for (let bb of bossBullets) {
        let imgB = bb.isLechugaBala ? assets.balaLechuga : assets.balaJefe;
        if (imgB.complete && imgB.naturalWidth > 0) { ctx.drawImage(imgB, bb.x, bb.y, bb.width, bb.height); } else { ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(bb.isLechugaBala ? '🥬' : '🌽', bb.x + bb.width / 2, bb.y + bb.height / 2); }
    }
    for (let e of enemies) drawEnemy(e);

    if (tutorialStep === 3.5 && !gameStats.tutorialCompleted && gameState === 'PLAYING') {
        let needed = (maxUpgradeLimit - upgrades.bullets) * 10 + (maxUpgradeLimit - upgrades.speed) * 10;
        ctx.save();
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 6;
        ctx.fillText(`Faltan para ascender: 🪙 ${coins} / ${needed}`, canvas.width / 2, 80);
        ctx.restore();
    }

    if (toastTimer > 0 && gameState === 'PLAYING') {
        ctx.save(); ctx.globalAlpha = Math.min(1, toastTimer / 30); let floatY = 180 - ((180 - toastTimer) * 0.3); 
        if (toastImg && toastImg.complete && toastImg.naturalWidth > 0) { ctx.shadowColor = 'rgba(255, 215, 0, 0.8)'; ctx.shadowBlur = 20; ctx.drawImage(toastImg, canvas.width / 2 - 40, floatY - 40, 80, 80); } 
        else { ctx.font = '80px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = 'rgba(255, 215, 0, 0.8)'; ctx.shadowBlur = 20; ctx.fillText(toastIcon, canvas.width / 2, floatY); }
        if (toastSubtitle) { ctx.shadowBlur = 4; ctx.shadowColor = 'black'; ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = '#fbbf24'; ctx.textAlign = 'center'; ctx.fillText(toastSubtitle, canvas.width / 2, floatY + 60); }
        ctx.restore(); decrementToastTimer();
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

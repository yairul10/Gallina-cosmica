let keys = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false, KeyA: false, KeyD: false, KeyW: false, KeyS: false };

window.addEventListener('keydown', (e) => { 
    if (e.code in keys) { 
        keys[e.code] = true; 
        if (gameState === 'TUTORIAL' && tutorialStep === 0.5 && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) { 
            completeTutorialStep(0.5); 
        }
    } 
    if (e.code === 'Space') { if (gameState === 'TUTORIAL' && tutorialStep === 1) { completeTutorialStep(1); shootBullet(); } else if (gameState === 'PLAYING' || gameState === 'TRANSITION') shootBullet(); }
    if (e.code === 'KeyM') { if (gameState === 'TUTORIAL' && tutorialStep === 1.1) { completeTutorialStep(1.1); shootMissile(); } else if (gameState === 'PLAYING' || gameState === 'TRANSITION') shootMissile(); }
});

window.addEventListener('keyup', (e) => { if (e.code in keys) keys[e.code] = false; });

document.getElementById('saveScoreBtn').addEventListener('click', () => { 
    let initials = document.getElementById('playerInitials').value.toUpperCase().slice(0, 3); 
    if (!initials) initials = 'ABC'; 
    leaderboard.push({ name: initials, score: score }); 
    leaderboard.sort((a, b) => b.score - a.score); 
    if (leaderboard.length > 5) leaderboard = leaderboard.slice(0, 5); 
    saveLeaderboard(); 
    document.getElementById('saveScoreSection').style.display = 'none'; 
    renderLeaderboard('endLeaderboardList'); 
});

document.getElementById('reviveBtn').addEventListener('click', () => {
    if (coins >= 500) {
        coins -= 500; gameStats.savedCoins = coins; saveStats(); lives = 3; 
        enemies.length = 0; bossBullets.length = 0; 
        shieldActive = true; partialHit = false; 
        updateLivesUI(); updateUpgradesHUD(); document.getElementById('gameOverScreen').style.display = 'none'; 
        document.querySelectorAll('.draggable-btn').forEach(b => { b.style.display = 'flex'; }); 
        if (gameStats.controlMode === 'drag') { document.getElementById('hud-joystick').style.display = 'none'; }
        updateUpgradesHUD();
        gameState = 'PLAYING'; previousState = 'PLAYING'; 
        if (!bgMusic.muted) bgMusic.play().catch(e => console.log(e));
        if (window.gameTimerInterval) clearInterval(window.gameTimerInterval);
        window.gameTimerInterval = setInterval(() => { 
            if (gameState === 'PLAYING') { gameTime++; sessionTimeNoHit++; if (sessionTimeNoHit >= 100) unlockAchievement('a13'); if (gameTime >= 300) unlockAchievement('a14'); } 
        }, 1000);
    }
});

window.startGame = function() {
    if (!bgMusic.muted) bgMusic.play().catch(e => console.log(e)); 
    currentMatchBooster = gameStats.pendingBooster || 1.0; gameStats.pendingBooster = 1.0; saveStats();
    score = 0; coins = gameStats.savedCoins || 0; lives = 3; gameTime = 0; gameRound = 1; goingToRound = 1; timeAt40k = 0; shieldUnlocked = false; shieldActive = false; partialHit = false; sessionKillsNoHit = 0; sessionTimeNoHit = 0; sessionLivesBought = 0; sessionCoinsEarned = 0;
    
    // Auto-Vida Reset
    moduleUsed = false; moduleActiveInMatch = gameStats.equipExtraModule;
    
    bullets.length = 0; homingMissiles.length = 0; enemies.length = 0; bossBullets.length = 0; bosses.length = 0; 
    
    evolutionStage = 0; evolutionTimer = 0; maxUpgradeLimit = 3; nextBossScoreThreshold = 5000; upgrades.bullets = 0; upgrades.speed = 1; upgrades.armor = 0; upgrades.dmgBoost = 0; upgrades.superDmgBoost = 0; missileCooldownTimer = 0; gotTrophy20k = false; gotTrophy50k = false; gotTrophy100k = false; gotTrophy200k = false; gotTrophy300k = false; doubleBossSpawned = false; doubleBossDefeated = false;
    updateTrophiesHUD(); player.x = canvas.width / 2 - player.width / 2; player.y = canvas.height - 110; isDraggingShip = false; dragPointerId = null; 
    
    joystick.active = false; joystick.dx = 0; joystick.dy = 0;
    
    document.getElementById('scoreVal').textContent = score; document.getElementById('saveScoreSection').style.display = 'none'; document.getElementById('playerInitials').value = 'AAA';
    updateLivesUI(); updateUpgradesHUD(); document.getElementById('startScreen').style.display = 'none'; document.getElementById('gameOverScreen').style.display = 'none';
    
    document.querySelectorAll('.draggable-btn').forEach(b => { b.style.display = 'flex'; }); 
    if (gameStats.controlMode === 'drag') { document.getElementById('hud-joystick').style.display = 'none'; }
    updateUpgradesHUD(); 
    gameState = 'PLAYING'; previousState = 'PLAYING';
    
    if (!gameStats.tutorialCompleted) { 
        tutorialStep = 0.5; 
        activateTutorial("¡Bienvenido Granero Espacial!<br><br>Muévete por la pantalla con tu dedo 👆, o usa las flechas / W,A,S,D ⌨️ en PC.", 'none'); 
    } else { tutorialStep = 0; }
    
    if (window.gameTimerInterval) clearInterval(window.gameTimerInterval); 
    window.gameTimerInterval = setInterval(() => { 
        if (gameState === 'PLAYING') { gameTime++; sessionTimeNoHit++; if (sessionTimeNoHit >= 100) unlockAchievement('a13'); if (gameTime >= 300) unlockAchievement('a14'); } 
    }, 1000);
};

window.gameOver = function() { 
    gameState = 'GAMEOVER'; bgMusic.pause(); clearInterval(window.gameTimerInterval); unlockAchievement('a2'); gameStats.totalGames++; saveStats(); if (gameStats.totalGames >= 25) unlockAchievement('a18'); 
    document.getElementById('finalScore').textContent = score; renderLeaderboard('endLeaderboardList'); document.getElementById('coinsStatus').textContent = `Tienes: 🪙 ${coins}`;
    const reviveBtn = document.getElementById('reviveBtn'); if (coins >= 500) { reviveBtn.disabled = false; reviveBtn.style.opacity = 1; } else { reviveBtn.disabled = true; reviveBtn.style.opacity = 0.5; }
    let isTop5 = false; if (leaderboard.length < 5) { isTop5 = true; } else { isTop5 = score > leaderboard[leaderboard.length - 1].score; }
    if (isTop5 && score > 0) { document.getElementById('saveScoreSection').style.display = 'block'; } else { document.getElementById('saveScoreSection').style.display = 'none'; }
    document.getElementById('gameOverScreen').style.display = 'flex'; document.querySelectorAll('.draggable-btn').forEach(b => b.style.display = 'none'); 
};

let enemySpawnInterval = 0;
function update() {
    if (gameState === 'TUTORIAL') return;
    
    if (gameState === 'EVOLVING') {
        evolutionTimer--;
        for (let s of stars) { let dx = (player.x + player.width/2) - s.x; let dy = (player.y + player.height/2) - s.y; s.x += dx * 0.05; s.y += dy * 0.05; }
        
        if (evolutionTimer === 75) {
            if (evolutionStage === 0) { evolutionStage = 1; maxUpgradeLimit = 6; unlockAchievement('a5'); } 
            else if (evolutionStage === 1) { evolutionStage = 2; maxUpgradeLimit = 10; unlockAchievement('a6'); } 
            else if (evolutionStage === 2) { evolutionStage = 3; maxUpgradeLimit = 10; unlockAchievement('a7'); }
            updateUpgradesHUD(); 
        }
        
        if (evolutionTimer <= 0) { 
            gameState = 'PLAYING'; 
            for (let s of stars) { s.x = Math.random() * canvas.width; s.y = Math.random() * canvas.height; } 
            
            // LA CORRECCIÓN: El mensaje final se dispara únicamente tras terminar la cinemática
            if (!gameStats.tutorialCompleted && tutorialStep === 4.5) { 
                tutorialStep = 5; 
                activateTutorial("¡Genial! Ya tienes tu primera evolución.<br><br>💡 <b>TIP EXTRA:</b> Si quieres cambiar los botones de posición, puedes <b>PAUSAR</b> el juego y moverlos libremente donde quieras.", null); 
            }
        }
        return; 
    }

    if (gameState === 'TRANSITION') { 
        transitionTimer--; 
        bullets.length = 0; homingMissiles.length = 0; bossBullets.length = 0; enemies.length = 0; 
        
        for (let s of stars) { s.y += s.speed * 25; if (s.y > canvas.height) s.y = 0; } 
        
        let currentSpeed = player.baseSpeed + (upgrades.speed - 1) * 0.5; 
        if (keys.ArrowLeft || keys.KeyA) player.x -= currentSpeed; if (keys.ArrowRight || keys.KeyD) player.x += currentSpeed; if (keys.ArrowUp || keys.KeyW) player.y -= currentSpeed; if (keys.ArrowDown || keys.KeyS) player.y += currentSpeed; 
        if (gameStats.controlMode === 'joystick' && joystick.active) { player.x += joystick.dx * currentSpeed * 1.5; player.y += joystick.dy * currentSpeed * 1.5; }
        if (player.x < 10) player.x = 10; if (player.x > canvas.width - player.width - 10) player.x = canvas.width - player.width - 10; if (player.y < canvas.height / 2) player.y = canvas.height / 2; if (player.y > canvas.height - player.height - 10) player.y = canvas.height - player.height - 10; 
        
        if (transitionTimer <= 0) { 
            gameRound = goingToRound; 
            if (gameRound === 2) nextBossScoreThreshold = 75000; 
            else if (gameRound === 3) nextBossScoreThreshold = 175000; 
            else if (gameRound === 4) nextBossScoreThreshold = 9999999; 
            
            document.querySelectorAll('.draggable-btn').forEach(b => { b.style.display = 'flex'; }); 
            if (gameStats.controlMode === 'drag') { document.getElementById('hud-joystick').style.display = 'none'; }
            updateUpgradesHUD(); bgMusic.volume = 0.4; gameState = 'PLAYING'; previousState = 'PLAYING'; 
        } 
        return; 
    }
    
    if (gameState !== 'PLAYING') return;

    let currentSpeed = player.baseSpeed + (upgrades.speed - 1) * 0.5; 
    if (keys.ArrowLeft || keys.KeyA) player.x -= currentSpeed; if (keys.ArrowRight || keys.KeyD) player.x += currentSpeed; if (keys.ArrowUp || keys.KeyW) player.y -= currentSpeed; if (keys.ArrowDown || keys.KeyS) player.y += currentSpeed; 
    if (gameStats.controlMode === 'joystick' && joystick.active) { player.x += joystick.dx * currentSpeed * 1.5; player.y += joystick.dy * currentSpeed * 1.5; }
    if (player.x < 10) player.x = 10; if (player.x > canvas.width - player.width - 10) player.x = canvas.width - player.width - 10; if (player.y < canvas.height / 2) player.y = canvas.height / 2; if (player.y > canvas.height - player.height - 10) player.y = canvas.height - player.height - 10; 

    if (missileCooldownTimer > 0) { missileCooldownTimer--; let sec = Math.ceil(missileCooldownTimer / 60); document.getElementById('missileCooldown').textContent = sec + 's'; document.getElementById('missileBtn').classList.remove('missile-ready'); } else { document.getElementById('missileCooldown').textContent = 'LISTO'; document.getElementById('missileBtn').classList.add('missile-ready'); }
    
    if (score >= 20000 && !gotTrophy20k) { gotTrophy20k = true; let isNew = !gameStats.proMissiles[0]; if (isNew) { gameStats.proMissiles[0] = true; saveStats(); } showTrophyToast("🥉🐥", assets.trofeoPollito, isNew ? "¡Misil Pro Desbloqueado!" : ""); updateTrophiesHUD(); savePersistentTrophy('t20k'); } 
    if (score >= 50000 && !gotTrophy50k) { gotTrophy50k = true; let isNew = !gameStats.proMissiles[1]; if (isNew) { gameStats.proMissiles[1] = true; saveStats(); } showTrophyToast("🥈🧶", assets.trofeoLana, isNew ? "¡Misil Pro Desbloqueado!" : ""); updateTrophiesHUD(); savePersistentTrophy('t50k'); } 
    if (score >= 100000 && !gotTrophy100k) { gotTrophy100k = true; let isNew = !gameStats.proMissiles[2]; if (isNew) { gameStats.proMissiles[2] = true; saveStats(); } showTrophyToast("🏅🧲", assets.trofeoHerradura, isNew ? "¡Misil Pro Desbloqueado!" : ""); updateTrophiesHUD(); savePersistentTrophy('t100k'); } 
    if (score >= 200000 && !gotTrophy200k) { gotTrophy200k = true; let isNew = !gameStats.proMissiles[3]; if (isNew) { gameStats.proMissiles[3] = true; saveStats(); } showTrophyToast("🏆🥛", assets.trofeoLeche, isNew ? "¡Misil Pro Desbloqueado!" : ""); updateTrophiesHUD(); savePersistentTrophy('t200k'); unlockAchievement('a19'); } 
    if (score >= 300000 && !gotTrophy300k) { gotTrophy300k = true; let pTrophies = JSON.parse(localStorage.getItem('farm_space_trophies')) || {}; let sub = ""; if (!pTrophies['t300k']) { if (gameStats.proSkins[0]) { coins += 4000; gameStats.savedCoins = coins; sub = "Gallina Pro Reembolsada (+4,000🪙)"; } else { gameStats.proSkins[0] = true; sub = "¡Licencia Gallina Pro Desbloqueada!"; } } saveStats(); showTrophyToast("💎🐔", assets.trofeoDiamante, sub); updateTrophiesHUD(); savePersistentTrophy('t300k'); } 
    if (score >= 500000) unlockAchievement('a20'); if (score >= 40000 && !shieldUnlocked) { shieldUnlocked = true; shieldActive = true; timeAt40k = gameTime; } if (shieldUnlocked && !shieldActive && sessionTimeNoHit >= 5) { shieldActive = true; }
    
    if (score >= nextBossScoreThreshold && bosses.length === 0) { 
        let currentThreshold = nextBossScoreThreshold; spawnBoss(); 
        if (gameRound === 1) { if (currentThreshold < 50000) nextBossScoreThreshold += 5000; else nextBossScoreThreshold = 9999999; } 
        else if (gameRound === 2) { if (currentThreshold < 150000) nextBossScoreThreshold += 25000; else nextBossScoreThreshold = 9999999; } 
        else if (gameRound === 3) { if (currentThreshold < 250000) nextBossScoreThreshold += 25000; else nextBossScoreThreshold = 9999999; } 
        else if (gameRound === 4) { nextBossScoreThreshold = 9999999; }
    }
    
    for (let s of stars) { s.y += s.speed; if (s.y > canvas.height) s.y = 0; }
    for (let i = bullets.length - 1; i >= 0; i--) { bullets[i].y -= bullets[i].speed; if (bullets[i].dx) bullets[i].x += bullets[i].dx; if (bullets[i].y < -20 || bullets[i].x < -30 || bullets[i].x > canvas.width + 30) bullets.splice(i, 1); }
    for (let i = homingMissiles.length - 1; i >= 0; i--) {
        let m = homingMissiles[i]; let target = null;
        if (bosses.length > 0) { target = bosses[0]; } else if (enemies.length > 0) { target = enemies.reduce((prev, curr) => (prev.hp > curr.hp) ? prev : curr); }
        if (target) { let tx = target.x + target.width / 2; let ty = target.y + target.height / 2; let angle = Math.atan2(ty - (m.y + m.height / 2), tx - (m.x + m.width / 2)); m.vx += (Math.cos(angle) * m.speed - m.vx) * 0.08; m.vy += (Math.sin(angle) * m.speed - m.vy) * 0.08; } else { m.vy -= 0.2; } m.x += m.vx; m.y += m.vy;
        if (m.y < -50 || m.x < -50 || m.x > canvas.width + 50 || m.y > canvas.height + 50) { homingMissiles.splice(i, 1); continue; }
        let hit = false;
        for (let j = bosses.length - 1; j >= 0; j--) { if (m.x < bosses[j].x + bosses[j].width && m.x + m.width > bosses[j].x && m.y < bosses[j].y + bosses[j].height && m.y + m.height > bosses[j].y) { hit = true; damageBoss(j, m.damage); break; } }
        if (hit) { homingMissiles.splice(i, 1); continue; }
        for (let j = enemies.length - 1; j >= 0; j--) { if (m.x < enemies[j].x + enemies[j].width && m.x + m.width > enemies[j].x && m.y < enemies[j].y + enemies[j].height && m.y + m.height > enemies[j].y) { hit = true; damageEnemy(j, m.damage); break; } }
        if (hit) { homingMissiles.splice(i, 1); continue; }
    }
    for (let i = bossBullets.length - 1; i >= 0; i--) { bossBullets[i].y += bossBullets[i].speed; if (bossBullets[i].dx) bossBullets[i].x += bossBullets[i].dx; if (bossBullets[i].y > canvas.height + 20 || bossBullets[i].x < -20 || bossBullets[i].x > canvas.width + 20) { bossBullets.splice(i, 1); continue; } if (player.x < bossBullets[i].x + bossBullets[i].width && player.x + player.width > bossBullets[i].x && player.y < bossBullets[i].y + bossBullets[i].height && player.y + player.height > bossBullets[i].y) { bossBullets.splice(i, 1); handleDamage(); } }

    if (bosses.length === 0) { 
        enemySpawnInterval++; 
        let spawnRate = 40; 
        if (gameRound >= 4) { spawnRate = Math.max(15, 30 - Math.floor((score - 250000) / 10000)); } 
        else { let diffTime = score >= 40000 ? timeAt40k : gameTime; spawnRate = gameRound >= 2 ? Math.max(25, 50 - Math.floor(diffTime / 10)) : Math.max(20, 45 - Math.floor(diffTime / 10)); } 
        if (enemySpawnInterval > spawnRate) { spawnEnemy(); enemySpawnInterval = 0; } 
    }
    
    for (let bIndex = bosses.length - 1; bIndex >= 0; bIndex--) {
        let boss = bosses[bIndex];
        if (!boss.entered) { boss.y += 1.5; if (boss.y >= 50) boss.entered = true; } else { boss.x += boss.speed * boss.direction; boss.y += (boss.speed * 0.4) * boss.dirY; if (boss.x < 10 || boss.x + boss.width > canvas.width - 10) boss.direction *= -1; if (boss.y < 50 || boss.y + boss.height > canvas.height / 2 - 20) boss.dirY *= -1; }
        boss.shootCooldown++;
        
        if (boss.isSuperBoss) { 
            boss.minionCooldown++; 
            if (boss.type === 'corn' && boss.shootCooldown >= 55) { boss.shootCooldown = 0; bossBullets.push({ x: boss.x + boss.width / 2 - 40, y: boss.y + boss.height - 10, width: 16, height: 16, speed: 6.5, dx: -2.5 }); bossBullets.push({ x: boss.x + boss.width / 2 - 15, y: boss.y + boss.height - 10, width: 16, height: 16, speed: 6.5, dx: -0.8 }); bossBullets.push({ x: boss.x + boss.width / 2 + 15, y: boss.y + boss.height - 10, width: 16, height: 16, speed: 6.5, dx: 0.8 }); bossBullets.push({ x: boss.x + boss.width / 2 + 40, y: boss.y + boss.height - 10, width: 16, height: 16, speed: 6.5, dx: 2.5 }); } 
            if (boss.type === 'corn' && boss.minionCooldown >= 110) { 
                boss.minionCooldown = 0; 
                let mCoin = 1000; 
                enemies.push({ x: boss.x + 20, y: boss.y + boss.height - 30, width: 48, height: 48, hp: 3, maxHp: 3, speed: 2, wobble: 0, type: 'corn_strong', pts: 150, coin: mCoin, shootCooldown: 0 }); 
                enemies.push({ x: boss.x + boss.width - 68, y: boss.y + boss.height - 30, width: 48, height: 48, hp: 3, maxHp: 3, speed: 2, wobble: Math.PI, type: 'corn_strong', pts: 150, coin: mCoin, shootCooldown: 0 }); 
            } 
            if (boss.type === 'lechuga' && boss.shootCooldown >= 45) { boss.shootCooldown = 0; bossBullets.push({ x: boss.x + boss.width / 2 - 30, y: boss.y + boss.height, width: 16, height: 16, speed: 7, dx: -2.0, isLechugaBala: true }); bossBullets.push({ x: boss.x + boss.width / 2 - 10, y: boss.y + boss.height, width: 16, height: 16, speed: 7, dx: -0.6, isLechugaBala: true }); bossBullets.push({ x: boss.x + boss.width / 2 + 10, y: boss.y + boss.height, width: 16, height: 16, speed: 7, dx: 0.6, isLechugaBala: true }); bossBullets.push({ x: boss.x + boss.width / 2 + 30, y: boss.y + boss.height, width: 16, height: 16, speed: 7, dx: 2.0, isLechugaBala: true }); } 
            if (boss.type === 'lechuga' && boss.minionCooldown >= 90) { 
                boss.minionCooldown = 0; 
                let mCoin = gameRound >= 2 ? 3 : 2;
                enemies.push({ x: boss.x + boss.width / 2 - 24, y: boss.y + boss.height, width: 48, height: 48, hp: 5, maxHp: 5, type: 'lechuga_fuerte', speed: 1.5, wobble: 0, pts: 300, coin: mCoin, shootCooldown: 0 }); 
            } 
        } else { 
            if (boss.shootCooldown >= 40) { 
                boss.shootCooldown = 0; let bc = Math.min(4, Math.max(1, score >= 20000 ? 2 + Math.floor((score - 20000) / 20000) : 1)); let isLB = boss.type === 'lechuga'; 
                if (bc === 1) { bossBullets.push({ x: boss.x + boss.width / 2 - 6, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: 0, isLechugaBala: isLB }); } 
                else if (bc === 2) { bossBullets.push({ x: boss.x + boss.width / 2 - 16, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: -1.2, isLechugaBala: isLB }); bossBullets.push({ x: boss.x + boss.width / 2 + 4, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: 1.2, isLechugaBala: isLB }); } 
                else if (bc === 3) { bossBullets.push({ x: boss.x + boss.width / 2 - 24, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: -2, isLechugaBala: isLB }); bossBullets.push({ x: boss.x + boss.width / 2 - 6, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: 0, isLechugaBala: isLB }); bossBullets.push({ x: boss.x + boss.width / 2 + 12, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: 2, isLechugaBala: isLB }); } 
                else { bossBullets.push({ x: boss.x + boss.width / 2 - 30, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: -2.5, isLechugaBala: isLB }); bossBullets.push({ x: boss.x + boss.width / 2 - 12, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: -0.8, isLechugaBala: isLB }); bossBullets.push({ x: boss.x + boss.width / 2, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: 0.8, isLechugaBala: isLB }); bossBullets.push({ x: boss.x + boss.width / 2 + 18, y: boss.y + boss.height, width: 12, height: 12, speed: 5.5, dx: 2.5, isLechugaBala: isLB }); } 
            } 
        }
        for (let j = bullets.length - 1; j >= 0; j--) { if (bullets[j] && bullets[j].x < boss.x + boss.width && bullets[j].x + bullets[j].width > boss.x && bullets[j].y < boss.y + boss.height && bullets[j].y + bullets[j].height > boss.y) { let dmg = bullets[j].damage; bullets.splice(j, 1); damageBoss(bIndex, dmg); } }
    }
    for (let i = enemies.length - 1; i >= 0; i--) {
        enemies[i].y += enemies[i].speed; enemies[i].wobble += 0.06; enemies[i].x += Math.sin(enemies[i].wobble) * 2.2; 
        if (enemies[i].type.includes('jefe') || enemies[i].type === 'lechuga_fuerte') { 
            enemies[i].shootCooldown++; 
            if (enemies[i].shootCooldown >= 60) { 
                enemies[i].shootCooldown = 0; let isL = enemies[i].type.includes('lechuga'); 
                bossBullets.push({ x: enemies[i].x + enemies[i].width/2 - 6, y: enemies[i].y + enemies[i].height - 10, width: 12, height: 12, speed: 4.5, dx: 0, isLechugaBala: isL }); 
                if (enemies[i].type === 'lechuga_jefe' && gameRound < 3) { 
                    enemies.push({ x: enemies[i].x, y: enemies[i].y + 40, width: 48, height: 48, hp: 3, maxHp: 3, type: 'lechuga', speed: enemies[i].speed * 1.1, wobble: 0, pts: 150, coin: (gameRound >= 2 ? 2 : 1), shootCooldown: 0 }); 
                } 
                if (enemies[i].type === 'maiz_jefe') { 
                    enemies.push({ x: enemies[i].x, y: enemies[i].y + 40, width: 48, height: 48, hp: 4, maxHp: 4, type: 'corn_strong', speed: enemies[i].speed * 1.1, wobble: 0, pts: 150, coin: 1000, shootCooldown: 0 }); 
                } 
            } 
        }
        if (enemies[i].y > canvas.height) { enemies.splice(i, 1); handleDamage(); continue; } if (player.x < enemies[i].x + enemies[i].width && player.x + player.width > enemies[i].x && player.y < enemies[i].y + enemies[i].height && player.y + player.height > enemies[i].y) { enemies.splice(i, 1); handleDamage(); continue; }
        for (let j = bullets.length - 1; j >= 0; j--) { if (bullets[j] && bullets[j].x < enemies[i].x + enemies[i].width && bullets[j].x + bullets[j].width > enemies[i].x && bullets[j].y < enemies[i].y + enemies[i].height && bullets[j].y + bullets[j].height > enemies[i].y) { let dmg = bullets[j].damage; bullets.splice(j, 1); damageEnemy(i, dmg); break; } }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); 
    ctx.save();
    
    if (gameState === 'EVOLVING') {
        let cx = player.x + player.width / 2; let cy = player.y + player.height / 2;
        let progress = (150 - evolutionTimer) / 150; let zoom = 1 + Math.sin(progress * Math.PI) * 1.3; 
        ctx.translate(canvas.width / 2, canvas.height / 2); ctx.scale(zoom, zoom); ctx.translate(-cx, -cy);
    }
    
    if (gameState === 'TRANSITION' && transitionTimer > 100) { let shake = (transitionTimer - 100) / 15; ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake); }
    
    let warpSpeed = (gameState === 'TRANSITION') ? 40 : 0.5;
    bgScrollY += warpSpeed; if (bgScrollY >= canvas.height) bgScrollY = 0; let y = Math.floor(bgScrollY); 
    
    let bgImg = null;
    if (gameRound >= 3 && assets.fondoRonda3 && assets.fondoRonda3.complete && assets.fondoRonda3.naturalWidth > 0) bgImg = assets.fondoRonda3;
    else if (gameRound === 2 && assets.fondoRonda2.complete && assets.fondoRonda2.naturalWidth > 0) bgImg = assets.fondoRonda2;
    else if (assets.fondoGalaxia.complete && assets.fondoGalaxia.naturalWidth > 0) bgImg = assets.fondoGalaxia;
    
    if (bgImg) { ctx.drawImage(bgImg, 0, y, canvas.width, canvas.height); ctx.drawImage(bgImg, 0, y - canvas.height + 2, canvas.width, canvas.height); }
    
    let bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    if (gameRound === 1) { bgGradient.addColorStop(0, 'rgba(9, 11, 20, 0.7)'); bgGradient.addColorStop(1, 'rgba(30, 27, 75, 0.8)'); } 
    else if (gameRound === 2) { bgGradient.addColorStop(0, 'rgba(26, 11, 46, 0.7)'); bgGradient.addColorStop(1, 'rgba(74, 20, 75, 0.8)'); } 
    else if (gameRound === 3) { bgGradient.addColorStop(0, 'rgba(10, 30, 10, 0.7)'); bgGradient.addColorStop(1, 'rgba(20, 60, 20, 0.8)'); } 
    else { bgGradient.addColorStop(0, 'rgba(42, 8, 8, 0.7)'); bgGradient.addColorStop(1, 'rgba(5, 0, 0, 0.9)'); }
    ctx.fillStyle = bgGradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (let s of stars) { ctx.globalAlpha = s.opacity; ctx.fillStyle = s.color; if (gameState === 'TRANSITION') { ctx.fillRect(s.x, s.y, s.size / 2, s.size * 20); } else { ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill(); } } ctx.globalAlpha = 1.0;
    for (let b of bosses) drawBoss(b); 

    if (gameState === 'TRANSITION') {
        ctx.save(); ctx.globalCompositeOperation = "screen"; let beamWidth = player.width * 1.8; let beamGradient = ctx.createLinearGradient(0, player.y + player.height, 0, 0); beamGradient.addColorStop(0, 'rgba(56, 189, 248, 0.9)'); beamGradient.addColorStop(1, 'rgba(167, 139, 250, 0)'); ctx.fillStyle = beamGradient; ctx.fillRect(player.x - (beamWidth - player.width)/2, 0, beamWidth, player.y + player.height); ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(player.x + 8, player.y + player.height); ctx.lineTo(player.x + 8, 0); ctx.moveTo(player.x + player.width - 8, player.y + player.height); ctx.lineTo(player.x + player.width - 8, 0); ctx.stroke(); ctx.restore();
    }

    drawPlayerShip(player.x, player.y);
    
    for (let b of bullets) { 
        let outerColor = '#38bdf8'; 
        let innerColor = '#ffffff'; 

        if (b.isPro) {
            if (b.shipType === 0) { innerColor = '#ffffff'; outerColor = '#a855f7'; }      
            else if (b.shipType === 1) { innerColor = '#ffffff'; outerColor = '#fbbf24'; } 
            else if (b.shipType === 2) { innerColor = '#fbbf24'; outerColor = '#a855f7'; } 
            else if (b.shipType === 3) { innerColor = '#fbbf24'; outerColor = '#a855f7'; } 
        } else {
            if (b.shipType === 0) outerColor = '#ef4444';      
            else if (b.shipType === 1) outerColor = '#a855f7'; 
            else if (b.shipType === 2) outerColor = '#fbbf24'; 
            else if (b.shipType === 3) outerColor = '#3b82f6'; 
        }
        
        ctx.fillStyle = innerColor; 
        ctx.shadowColor = outerColor; 
        ctx.shadowBlur = 8; 
        ctx.fillRect(b.x, b.y, b.width, b.height); 
        ctx.strokeStyle = outerColor; 
        ctx.lineWidth = 1.5; 
        ctx.strokeRect(b.x, b.y, b.width, b.height); 
        ctx.shadowBlur = 0; 
    }

    for (let m of homingMissiles) { ctx.save(); ctx.translate(m.x + m.width/2, m.y + m.height/2); let angle = Math.atan2(m.vy, m.vx) + Math.PI/2; ctx.rotate(angle); let imgNormal, imgPro; if (m.type === 'milk') { imgNormal = assets.balaLeche; imgPro = assets.balaLechePro; } else if (m.type === 'horseshoe') { imgNormal = assets.balaHerradura; imgPro = assets.balaHerraduraPro; } else if (m.type === 'wool') { imgNormal = assets.balaLana; imgPro = assets.balaLanaPro; } else { imgNormal = assets.balaPollito; imgPro = assets.balaPollitoPro; } let imgToDraw = (m.isPro && imgPro.complete && imgPro.naturalWidth > 0) ? imgPro : imgNormal; if (imgToDraw.complete && imgToDraw.naturalWidth > 0) { ctx.drawImage(imgToDraw, -m.width/2, -m.height/2, m.width, m.height); } else { ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; let icon = '🐥'; if (m.type === 'wool') icon = '🧶'; if (m.type === 'horseshoe') icon = '🧲'; if (m.type === 'milk') icon = '🥛'; ctx.fillText(icon, 0, 0); } ctx.restore(); }
    for (let bb of bossBullets) { let imgB = bb.isLechugaBala ? assets.balaLechuga : assets.balaJefe; if (imgB.complete && imgB.naturalWidth > 0) { ctx.drawImage(imgB, bb.x, bb.y, bb.width, bb.height); } else { ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(bb.isLechugaBala ? '🥬' : '🌽', bb.x + bb.width / 2, bb.y + bb.height / 2); } }
    for (let e of enemies) drawEnemy(e);
    
    if (gameStats.controlMode === 'joystick' && joystick.active) { ctx.save(); ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(joystick.baseX, joystick.baseY, 40, 0, Math.PI*2); ctx.fillStyle = '#0f172a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#38bdf8'; ctx.stroke(); ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(joystick.x, joystick.y, 18, 0, Math.PI*2); ctx.fillStyle = '#38bdf8'; ctx.fill(); ctx.restore(); }
    
    ctx.restore();

    if (gameState === 'EVOLVING') {
        let flashAlpha = 0; if (evolutionTimer <= 100 && evolutionTimer >= 50) { flashAlpha = 1 - (Math.abs(evolutionTimer - 75) / 25); }
        if (flashAlpha > 0) { ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
        ctx.fillStyle = `rgba(251, 191, 36, ${Math.sin(((150 - evolutionTimer) / 150) * Math.PI)})`;
        ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center'; ctx.shadowColor = '#000'; ctx.shadowBlur = 10;
        ctx.fillText('¡EVOLUCIONANDO!', canvas.width / 2, canvas.height / 4); ctx.shadowBlur = 0;
    }
    
    if ((tutorialStep === 3.5 || tutorialStep === 4) && !gameStats.tutorialCompleted && gameState === 'PLAYING') { let needed = (maxUpgradeLimit - upgrades.bullets) * 10 + (maxUpgradeLimit - upgrades.speed) * 10; if (needed > 0) { ctx.save(); ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.shadowColor = '#000'; ctx.shadowBlur = 6; ctx.fillText(`Faltan para ascender: 🪙 ${coins} / ${needed}`, canvas.width / 2, 80); ctx.restore(); } }
    if (toastTimer > 0 && gameState === 'PLAYING') { ctx.save(); ctx.globalAlpha = Math.min(1, toastTimer / 30); let floatY = 180 - ((180 - toastTimer) * 0.3); if (toastImg && toastImg.complete && toastImg.naturalWidth > 0) { ctx.shadowColor = 'rgba(255, 215, 0, 0.8)'; ctx.shadowBlur = 20; ctx.drawImage(toastImg, canvas.width / 2 - 40, floatY - 40, 80, 80); } else { ctx.font = '80px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = 'rgba(255, 215, 0, 0.8)'; ctx.shadowBlur = 20; ctx.fillText(toastIcon, canvas.width / 2, floatY); } if (toastSubtitle) { ctx.shadowBlur = 4; ctx.shadowColor = 'black'; ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = '#fbbf24'; ctx.textAlign = 'center'; ctx.fillText(toastSubtitle, canvas.width / 2, floatY + 60); } ctx.restore(); toastTimer--; }
    
    if (gameState === 'TRANSITION') { 
        ctx.save(); ctx.textAlign = 'center'; 
        if (goingToRound === 2) { 
            ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 26px sans-serif'; ctx.shadowColor = '#000'; ctx.shadowBlur = 8; ctx.fillText('¡SÚPER MAZORCA DERROTADA!', canvas.width / 2, canvas.height / 2 - 50); 
            ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif'; ctx.fillText('VIAJE ESTELAR ACTIVADO', canvas.width / 2, canvas.height / 2 - 10); 
        } else if (goingToRound === 3) { 
            ctx.fillStyle = '#22c55e'; ctx.font = 'bold 24px sans-serif'; ctx.shadowColor = '#000'; ctx.shadowBlur = 8; ctx.fillText('¡SÚPER LECHUGA DERROTADA!', canvas.width / 2, canvas.height / 2 - 50); 
            ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif'; ctx.fillText('ENTRANDO AL NÚCLEO ENEMIGO...', canvas.width / 2, canvas.height / 2 - 10); 
        } else if (goingToRound === 4) { 
            ctx.fillStyle = '#ef4444'; ctx.font = 'bold 32px sans-serif'; ctx.shadowColor = '#000'; ctx.shadowBlur = 10; ctx.fillText('¡AMENAZA ELIMINADA!', canvas.width / 2, canvas.height / 2 - 50); 
            ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.shadowBlur = 0; ctx.fillText('¡MODO SUPERVIVENCIA INFINITA!', canvas.width / 2, canvas.height / 2 - 10); 
        }
        let seconds = Math.ceil(transitionTimer / 60); ctx.fillStyle = '#38bdf8'; ctx.font = 'bold 64px sans-serif'; ctx.fillText(seconds, canvas.width / 2, canvas.height / 2 + 70); 
        if (transitionTimer < 30) { ctx.shadowBlur = 0; ctx.fillStyle = `rgba(255, 255, 255, ${ (30 - transitionTimer) / 30 })`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
        ctx.restore(); 
    }
}

document.getElementById('startBtn').addEventListener('click', window.startGame); 
document.getElementById('restartBtn').addEventListener('click', window.startGame);

let lastFrameTime = 0; const fpsInterval = 1000 / 60; 
function loop(timestamp) { requestAnimationFrame(loop); if (!lastFrameTime) lastFrameTime = timestamp; let elapsed = timestamp - lastFrameTime; if (elapsed > 200) { lastFrameTime = timestamp; elapsed = 0; } if (elapsed >= fpsInterval) { lastFrameTime = timestamp - (elapsed % fpsInterval); update(); draw(); } }

renderLeaderboard('startLeaderboardList'); 
requestAnimationFrame(loop);

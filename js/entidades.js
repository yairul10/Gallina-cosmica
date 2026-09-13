let isDraggingShip = false; let dragPointerId = null; let lastTouchX = 0; let lastTouchY = 0;

canvas.addEventListener('pointerdown', (e) => { 
    if (dragPointerId === null && (gameState === 'PLAYING' || gameState === 'TRANSITION' || gameState === 'TUTORIAL')) { 
        dragPointerId = e.pointerId; 
        const touchX = (e.clientX - canvas.getBoundingClientRect().left) * (canvas.width / canvas.getBoundingClientRect().width); 
        const touchY = (e.clientY - canvas.getBoundingClientRect().top) * (canvas.height / canvas.getBoundingClientRect().height); 
        
        if (gameStats.controlMode === 'joystick') {
            joystick.active = true;
            joystick.baseX = touchX;
            joystick.baseY = touchY;
            joystick.x = touchX;
            joystick.y = touchY;
            joystick.dx = 0; 
            joystick.dy = 0;
        } else {
            isDraggingShip = true; 
            lastTouchX = touchX;
            lastTouchY = touchY;
        }
    } 
});

canvas.addEventListener('pointermove', (e) => { 
    if ((gameState !== 'PLAYING' && gameState !== 'TRANSITION' && gameState !== 'TUTORIAL') || e.pointerId !== dragPointerId) return; 
    
    if (gameState === 'TUTORIAL' && tutorialStep === 0.5) { completeTutorialStep(0.5); }
    
    const currentTouchX = (e.clientX - canvas.getBoundingClientRect().left) * (canvas.width / canvas.getBoundingClientRect().width); 
    const currentTouchY = (e.clientY - canvas.getBoundingClientRect().top) * (canvas.height / canvas.getBoundingClientRect().height); 
    
    if (gameStats.controlMode === 'joystick' && joystick.active) {
        let dx = currentTouchX - joystick.baseX;
        let dy = currentTouchY - joystick.baseY;
        let dist = Math.hypot(dx, dy);
        let maxDist = 40; 
        if (dist > maxDist) { dx = (dx / dist) * maxDist; dy = (dy / dist) * maxDist; }
        
        joystick.x = joystick.baseX + dx;
        joystick.y = joystick.baseY + dy;
        joystick.dx = dx / maxDist; 
        joystick.dy = dy / maxDist;
    } else if (isDraggingShip) {
        player.x += (currentTouchX - lastTouchX) * (1 + (upgrades.speed * 0.15)); 
        player.y += (currentTouchY - lastTouchY) * (1 + (upgrades.speed * 0.15)); 
        if (player.x < 10) player.x = 10; if (player.x > canvas.width - player.width - 10) player.x = canvas.width - player.width - 10; if (player.y < canvas.height / 2) player.y = canvas.height / 2; if (player.y > canvas.height - player.height - 10) player.y = canvas.height - player.height - 10; 
        lastTouchX = currentTouchX; lastTouchY = currentTouchY; 
    }
});

const endPointer = (e) => { 
    if (e.pointerId === dragPointerId) { 
        isDraggingShip = false; 
        joystick.active = false; 
        joystick.dx = 0; 
        joystick.dy = 0; 
        dragPointerId = null; 
    } 
};
window.addEventListener('pointerup', endPointer); 
window.addEventListener('pointercancel', endPointer);

window.shootBullet = function() {
    let bulletCount = Math.min((evolutionStage === 3) ? 4 : 3, upgrades.bullets + 1); let baseDmg = upgrades.bullets === 0 ? 1 : upgrades.bullets; let bonusPro = gameStats.equippedSkins[evolutionStage] ? 0.30 : 0; baseDmg = baseDmg + (baseDmg * bonusPro); let finalDamage = (upgrades.dmgBoost > 0 ? baseDmg * 1.5 : baseDmg) * currentMatchBooster; if (upgrades.superDmgBoost > 0) finalDamage *= 1.5; 
    const patterns = { 1: [{ dx: 0, offX: player.width / 2 - 2, offY: -10 }], 2: [{ dx: 0, offX: 8, offY: -10 }, { dx: 0, offX: player.width - 12, offY: -10 }], 3: [{ dx: -1.2, offX: 4, offY: -10 }, { dx: 0, offX: player.width / 2 - 2, offY: -14 }, { dx: 1.2, offX: player.width - 8, offY: -10 }], 4: [{ dx: -2.0, offX: 2, offY: -8 }, { dx: -0.6, offX: 12, offY: -14 }, { dx: 0.6, offX: player.width - 16, offY: -14 }, { dx: 2.0, offX: player.width - 6, offY: -8 }] };
    for (let p of (patterns[bulletCount] || patterns[3])) { bullets.push({ x: player.x + p.offX, y: player.y + p.offY, width: 4, height: 20, speed: 14, dx: p.dx, type: 'laser', damage: finalDamage }); }
}

window.shootMissile = function() {
    if (missileCooldownTimer > 0) return;
    let bType = 'chick'; if (evolutionStage === 1) bType = 'wool'; if (evolutionStage === 2) bType = 'horseshoe'; if (evolutionStage === 3) bType = 'milk';
    let bulletCount = evolutionStage + 1; if (bulletCount > 4) bulletCount = 4;
    let baseDmg = (upgrades.bullets === 0 ? 1 : upgrades.bullets) * 15; let bonusPro = gameStats.equippedMissiles[evolutionStage] ? 0.20 : 0; baseDmg = baseDmg + (baseDmg * bonusPro); let finalDamage = (upgrades.dmgBoost > 0 ? baseDmg * 1.5 : baseDmg) * currentMatchBooster; if (upgrades.superDmgBoost > 0) finalDamage *= 1.5; 
    const patterns = { 1: [{ dx: 0, offX: player.width / 2 - 12, offY: -10 }], 2: [{ dx: -2, offX: 0, offY: -10 }, { dx: 2, offX: player.width - 24, offY: -10 }], 3: [{ dx: -3, offX: -5, offY: -10 }, { dx: 0, offX: player.width / 2 - 12, offY: -14 }, { dx: 3, offX: player.width - 19, offY: -10 }], 4: [{ dx: -4, offX: -10, offY: -8 }, { dx: -1.5, offX: 5, offY: -14 }, { dx: 1.5, offX: player.width - 29, offY: -14 }, { dx: 4, offX: player.width - 14, offY: -8 }] };
    let currentPattern = patterns[bulletCount] || patterns[1];
    for (let p of currentPattern) { homingMissiles.push({ x: player.x + p.offX, y: player.y + p.offY, width: 24, height: 24, speed: 7.5, vx: p.dx, vy: -5, type: bType, damage: finalDamage, isPro: gameStats.equippedMissiles[evolutionStage] }); }
    missileCooldownTimer = MISSILE_COOLDOWN;
}

window.spawnEnemy = function() {
    if (bosses.length > 0) return; 
    let difficultyTime = score >= 40000 ? timeAt40k : gameTime; let speedMultiplier = 1 + ((difficultyTime / 70) * 0.3); let lastCornHp = 1 + Math.floor((timeAt40k > 0 ? timeAt40k : gameTime) / 12) + (evolutionStage * 5); if (lastCornHp < 1) lastCornHp = 1;
    if (gameRound === 3) {
        let scale = Math.floor((score - 250000) / 2000); if (scale < 0) scale = 0; let eType = Math.random() > 0.5 ? 'maiz_jefe' : 'lechuga_fuerte'; let eHp = eType === 'maiz_jefe' ? Math.ceil(lastCornHp * 2.5) + scale : Math.ceil(lastCornHp * 2.0) + scale; let ePts = eType === 'maiz_jefe' ? 1200 : 1000; let eCoin = eType === 'maiz_jefe' ? 3 : 4;
        enemies.push({ x: Math.random() * (canvas.width - 56 - 20) + 10, y: -60, width: 56, height: 56, hp: eHp, maxHp: eHp, speed: (1.2 + Math.random() * 0.5) * speedMultiplier, wobble: Math.random() * Math.PI, type: eType, pts: ePts, coin: eCoin, shootCooldown: 0 }); return;
    }
    let eType = 'corn'; let eHp = 1; let ePts = 150; let eCoin = 1;
    if (gameRound === 2) {
        let baseLechugaHp = Math.ceil(lastCornHp * 1.2); let fuerteLechugaHp = Math.ceil(lastCornHp * 1.5); let jefeLechugaHp = Math.ceil(lastCornHp * 2.0);
        if (score >= 100000) { eType = 'lechuga_jefe'; eHp = jefeLechugaHp; ePts = 600; eCoin = 3; } else if (score >= 85000) { eType = Math.random() < 0.5 ? 'lechuga_fuerte' : 'lechuga_jefe'; eHp = eType === 'lechuga_jefe' ? jefeLechugaHp : fuerteLechugaHp; ePts = eType === 'lechuga_jefe' ? 600 : 300; eCoin = eType === 'lechuga_jefe' ? 3 : 2; } else if (score >= 70000) { eType = 'lechuga_fuerte'; eHp = fuerteLechugaHp; ePts = 300; eCoin = 2; } else if (score >= 60000) { eType = Math.random() < 0.5 ? 'lechuga' : 'lechuga_fuerte'; eHp = eType === 'lechuga_fuerte' ? fuerteLechugaHp : baseLechugaHp; ePts = eType === 'lechuga_fuerte' ? 300 : 150; eCoin = eType === 'lechuga_fuerte' ? 2 : 1; } else { eType = 'lechuga'; eHp = baseLechugaHp; ePts = 150; eCoin = 1; }
    } else { eHp = lastCornHp; if (eHp > 1) { eType = 'corn_strong'; eCoin = 2; } else { eType = 'corn'; eCoin = 1; } }
    enemies.push({ x: Math.random() * (canvas.width - 48 - 20) + 10, y: -60, width: 48, height: 48, hp: eHp, maxHp: eHp, speed: (1.2 + Math.random() * 1.0) * speedMultiplier, wobble: Math.random() * Math.PI, type: eType, pts: ePts, coin: eCoin, shootCooldown: 0 });
}

window.spawnBoss = function() { 
    if (nextBossScoreThreshold === 150000 && gameRound === 2) {
        let bossHpM = 1680 * 2; let bossHpL = 6720 * 2; 
        bosses.push({ x: 20, y: -120, width: 140, height: 110, maxHp: bossHpM, hp: bossHpM, speed: 1.5, direction: 1, shootCooldown: 0, minionCooldown: 0, isSuperBoss: true, type: 'corn', entered: false, dirY: 1 });
        bosses.push({ x: canvas.width - 160, y: -180, width: 140, height: 110, maxHp: bossHpL, hp: bossHpL, speed: 1.3, direction: -1, shootCooldown: 20, minionCooldown: 40, isSuperBoss: true, type: 'lechuga', entered: false, dirY: 1 });
        doubleBossSpawned = true;
    } else if (nextBossScoreThreshold === 50000 && gameRound === 1) {
        let bossHp = 1680; bosses.push({ x: canvas.width / 2 - 80, y: -120, width: 160, height: 130, maxHp: bossHp, hp: bossHp, speed: 1.2, direction: 1, shootCooldown: 0, minionCooldown: 0, isSuperBoss: true, type: 'corn', entered: false, dirY: 1 });
    } else if (gameRound === 1) {
        let bossLevel = Math.floor(score / 5000); let bossHp = Math.floor((60 + (bossLevel * 45)) * 1.5); bosses.push({ x: canvas.width / 2 - 60, y: -100, width: 120, height: 100, maxHp: bossHp, hp: bossHp, speed: 1.5 + (bossLevel * 0.1), direction: 1, shootCooldown: 0, minionCooldown: 0, isSuperBoss: false, type: 'corn', entered: false, dirY: 1 }); 
    }
}

window.handleDamage = function() { 
    if (shieldActive) { shieldActive = false; sessionTimeNoHit = 0; return; }
    if (upgrades.armor > 0) { if (!partialHit) { partialHit = true; sessionTimeNoHit = 0; return; } else { partialHit = false; } }
    lives--; sessionKillsNoHit = 0; sessionTimeNoHit = 0; updateLivesUI(); if (lives <= 0) gameOver(); 
}

window.handleCoinEarned = function(amount) { 
    coins += amount; gameStats.savedCoins = coins; sessionCoinsEarned += amount; gameStats.totalCoins += amount; saveStats(); 
    if (gameStats.totalCoins >= 300) unlockAchievement('a4'); if (gameStats.totalCoins >= 10000) unlockAchievement('a22'); if (coins >= 10000) unlockAchievement('a23'); 
    if (tutorialStep === 1.5 && coins >= 10) { tutorialStep = 2; activateTutorial("¡Conseguiste 10 monedas!<br><br>Toca el botón brillante para <b>Mejorar el Daño</b> (⚔️).", 'hud-bullets'); } 
    else if (tutorialStep === 2.5 && coins >= 10) { tutorialStep = 3; activateTutorial("¡Otras 10 monedas!<br><br>Toca el botón para <b>Mejorar Velocidad</b> (⚡).", 'hud-speed'); } 
    else if (tutorialStep === 3.5) { let needed = (maxUpgradeLimit - upgrades.bullets) * 10 + (maxUpgradeLimit - upgrades.speed) * 10; if (coins >= needed && needed > 0) { tutorialStep = 4; let targets = []; if (upgrades.bullets < maxUpgradeLimit) targets.push('hud-bullets'); if (upgrades.speed < maxUpgradeLimit) targets.push('hud-speed'); activateTutorial("¡Tienes las monedas necesarias!<br><br>Mejora al <b>MÁXIMO</b> el Daño y Velocidad para ascender.", targets); } }
    updateUpgradesHUD();
}

window.damageBoss = function(bIndex, dmg) {
    let boss = bosses[bIndex]; boss.hp -= dmg;
    if (boss.hp <= 0) { 
        score += boss.isSuperBoss ? 4500 : 2250; handleCoinEarned(boss.isSuperBoss ? 6 : 3); document.getElementById('scoreVal').textContent = score; updateUpgradesHUD(); 
        if (boss.isSuperBoss && boss.type === 'corn' && gameRound === 1) { gameState = 'TRANSITION'; previousState = 'TRANSITION'; goingToRound = 2; transitionTimer = 300; bgMusic.volume = 0.15; document.querySelectorAll('.draggable-btn').forEach(b => b.style.display = 'none'); updateUpgradesHUD(); } 
        else if (boss.isSuperBoss && gameRound === 2 && bosses.length === 1) { gameState = 'TRANSITION'; previousState = 'TRANSITION'; goingToRound = 3; transitionTimer = 300; bgMusic.volume = 0.15; document.querySelectorAll('.draggable-btn').forEach(b => b.style.display = 'none'); updateUpgradesHUD(); doubleBossDefeated = true; unlockAchievement('a21'); }
        bosses.splice(bIndex, 1); unlockAchievement('a10'); if (lives === 1) unlockAchievement('a12'); return true; 
    } return false;
}

window.damageEnemy = function(eIndex, dmg) {
    let e = enemies[eIndex]; e.hp -= dmg;
    if (e.hp <= 0) { score += e.pts; handleCoinEarned(e.coin); document.getElementById('scoreVal').textContent = score; updateUpgradesHUD(); enemies.splice(eIndex, 1); gameStats.totalKills++; saveStats(); sessionKillsNoHit++; if (gameStats.totalKills >= 50) unlockAchievement('a3'); if (sessionKillsNoHit >= 30) unlockAchievement('a11'); return true; } return false;
}

window.drawPlayerShip = function(x, y) {
    let currentImg; if (evolutionStage === 3) currentImg = gameStats.equippedSkins[3] ? assets.vacaPro : assets.vaca; else if (evolutionStage === 2) currentImg = gameStats.equippedSkins[2] ? assets.caballoPro : assets.caballo; else if (evolutionStage === 1) currentImg = gameStats.equippedSkins[1] ? assets.ovejaPro : assets.oveja; else currentImg = gameStats.equippedSkins[0] ? assets.gallinaPro : assets.gallina;
    let isPro = gameStats.equippedSkins[evolutionStage] || gameStats.equippedMissiles[evolutionStage];
    if (shieldActive) { ctx.save(); ctx.beginPath(); ctx.arc(x + player.width / 2, y + player.height / 2, 38, 0, Math.PI * 2); ctx.fillStyle = 'rgba(56, 189, 248, 0.2)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)'; ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 10; ctx.stroke(); ctx.restore(); }
    if (upgrades.armor > 0 && !shieldActive) { ctx.save(); ctx.beginPath(); ctx.arc(x + player.width / 2, y + player.height / 2, 34, 0, Math.PI * 2); ctx.fillStyle = partialHit ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.1)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = partialHit ? 'rgba(239, 68, 68, 0.8)' : 'rgba(37, 99, 235, 0.8)'; ctx.stroke(); ctx.restore(); }
    if (currentImg.complete && currentImg.naturalWidth > 0) { ctx.drawImage(currentImg, x, y, player.width, player.height); } else { ctx.save(); ctx.translate(x, y); if (isPro) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 15; } if (evolutionStage === 3) { ctx.fillStyle = '#f1f5f9'; ctx.beginPath(); ctx.ellipse(25, 26, 22, 18, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#0f172a'; ctx.fillRect(15, 20, 8, 8); ctx.fillRect(30, 28, 6, 6); } else if (evolutionStage === 2) { ctx.fillStyle = '#a855f7'; ctx.beginPath(); ctx.ellipse(25, 26, 18, 22, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#c084fc'; ctx.fillRect(20, -4, 10, 16); } else if (evolutionStage === 1) { ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.ellipse(25, 26, 20, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(25, 10, 10, 0, Math.PI * 2); ctx.fill(); } else { ctx.fillStyle = '#38bdf8'; ctx.fillRect(16, 42, 6, 10); ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.ellipse(25, 26, 16, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#cbd5e1'; ctx.stroke(); ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.arc(25, 17, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.moveTo(21, 8); ctx.lineTo(29, 8); ctx.lineTo(25, 0); ctx.fill(); ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(22, 2, 3.5, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
}

window.drawEnemy = function(e) {
    let img = null; if (e.type === 'corn') img = assets.maiz; else if (e.type === 'corn_strong') img = assets.maizFuerte; else if (e.type === 'maiz_jefe') img = assets.jefeMaiz; else if (e.type === 'lechuga') img = assets.lechuga; else if (e.type === 'lechuga_fuerte') img = assets.lechugaFuerte; else if (e.type === 'lechuga_jefe') img = assets.jefeLechuga;
    if (img && img.complete && img.naturalWidth > 0) { ctx.drawImage(img, e.x, e.y, e.width, e.height); } else { ctx.save(); ctx.translate(e.x, e.y); if (e.type.includes('lechuga')) { ctx.fillStyle = e.type === 'lechuga' ? '#22c55e' : (e.type === 'lechuga_fuerte' ? '#166534' : '#14532d'); ctx.beginPath(); ctx.arc(e.width/2, e.height/2, e.width/2 - 4, 0, Math.PI*2); ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle='#052e16'; ctx.stroke(); if(e.type !== 'lechuga') { ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(e.width/2, 10, 10, 0, Math.PI*2); ctx.fill(); } } else { ctx.fillStyle = e.type === 'maiz_jefe' ? '#ca8a04' : '#eab308'; ctx.beginPath(); ctx.roundRect(4, 6, e.width-8, e.height-8, [12, 12, 18, 18]); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#854d0e'; ctx.stroke(); if (e.maxHp > 1) { ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.arc(e.width/2, 10, 16, Math.PI, 0, false); ctx.fill(); } } ctx.restore(); }
}

window.drawBoss = function(b) {
    ctx.save(); ctx.translate(b.x, b.y);
    if (b.isSuperBoss) { ctx.shadowColor = b.type==='lechuga' ? 'rgba(34, 197, 94, 0.9)' : 'rgba(220, 38, 38, 0.9)'; ctx.shadowBlur = 20; }
    let bImg = null; if (b.type === 'corn') bImg = b.isSuperBoss ? assets.superJefeMaiz : assets.jefeMaiz; else bImg = b.isSuperBoss ? assets.superJefeLechuga : assets.jefeLechuga;
    if (bImg && bImg.complete && bImg.naturalWidth > 0) { ctx.drawImage(bImg, 0, 0, b.width, b.height); } else { ctx.fillStyle = b.type==='corn' ? (b.isSuperBoss ? '#991b1b' : '#ca8a04') : (b.isSuperBoss ? '#064e3b' : '#166534'); ctx.beginPath(); ctx.roundRect(0, 0, b.width, b.height, [20, 20, 30, 30]); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#020617'; ctx.stroke(); }
    ctx.restore(); ctx.fillStyle = '#334155'; ctx.fillRect(b.x + 10, b.y - 15, b.width - 20, 8); ctx.fillStyle = b.isSuperBoss ? '#ef4444' : '#22c55e'; ctx.fillRect(b.x + 10, b.y - 15, (b.width - 20) * (b.hp / b.maxHp), 8);
}

let isDraggingShip = false; let dragPointerId = null; let lastTouchX = 0; let lastTouchY = 0;

canvas.addEventListener('pointerdown', (e) => { 
    if (gameStats.controlMode === 'joystick') return; 
    if (dragPointerId === null && (gameState === 'PLAYING' || gameState === 'TRANSITION' || gameState === 'TUTORIAL')) { 
        dragPointerId = e.pointerId; isDraggingShip = true; 
        lastTouchX = (e.clientX - canvas.getBoundingClientRect().left) * (canvas.width / canvas.getBoundingClientRect().width); 
        lastTouchY = (e.clientY - canvas.getBoundingClientRect().top) * (canvas.height / canvas.getBoundingClientRect().height); 
    } 
});

canvas.addEventListener('pointermove', (e) => { 
    if (gameStats.controlMode === 'joystick') return; 
    if (!isDraggingShip || (gameState !== 'PLAYING' && gameState !== 'TRANSITION' && gameState !== 'TUTORIAL') || e.pointerId !== dragPointerId) return; 
    
    if (gameState === 'TUTORIAL' && tutorialStep === 0.5) { completeTutorialStep(0.5); }
    
    const currentTouchX = (e.clientX - canvas.getBoundingClientRect().left) * (canvas.width / canvas.getBoundingClientRect().width); const currentTouchY = (e.clientY - canvas.getBoundingClientRect().top) * (canvas.height / canvas.getBoundingClientRect().height); 
    player.x += (currentTouchX - lastTouchX) * (1 + (upgrades.speed * 0.15)); player.y += (currentTouchY - lastTouchY) * (1 + (upgrades.speed * 0.15)); 
    if (player.x < 10) player.x = 10; if (player.x > canvas.width - player.width - 10) player.x = canvas.width - player.width - 10; if (player.y < canvas.height / 2) player.y = canvas.height / 2; if (player.y > canvas.height - player.height - 10) player.y = canvas.height - player.height - 10; 
    lastTouchX = currentTouchX; lastTouchY = currentTouchY; 
});

const endCanvasPointer = (e) => { if (e.pointerId === dragPointerId) { isDraggingShip = false; dragPointerId = null; } };
window.addEventListener('pointerup', endCanvasPointer); window.addEventListener('pointercancel', endCanvasPointer);

window.shootBullet = function() {
    let bulletCount = Math.min((evolutionStage === 3) ? 4 : 3, upgrades.bullets + 1); 
    let baseDmg = upgrades.bullets === 0 ? 1 : upgrades.bullets; 
    let finalDamage = baseDmg * currentMatchBooster; 
    if (upgrades.dmgBoost > 0) finalDamage *= 1.5;
    if (upgrades.superDmgBoost > 0) finalDamage *= 1.5; 
    
    const patterns = { 1: [{ dx: 0, offX: player.width / 2 - 2, offY: -10 }], 2: [{ dx: 0, offX: 8, offY: -10 }, { dx: 0, offX: player.width - 12, offY: -10 }], 3: [{ dx: -1.2, offX: 4, offY: -10 }, { dx: 0, offX: player.width / 2 - 2, offY: -14 }, { dx: 1.2, offX: player.width - 8, offY: -10 }], 4: [{ dx: -2.0, offX: 2, offY: -8 }, { dx: -0.6, offX: 12, offY: -14 }, { dx: 0.6, offX: player.width - 16, offY: -14 }, { dx: 2.0, offX: player.width - 6, offY: -8 }] };
    for (let p of (patterns[bulletCount] || patterns[3])) { bullets.push({ x: player.x + p.offX, y: player.y + p.offY, width: 4, height: 20, speed: 14, dx: p.dx, type: 'laser', damage: finalDamage, shipType: gameStats.selectedShip, isPro: gameStats.useProShip }); }
}

window.shootMissile = function() {
    if (missileCooldownTimer > 0) return;
    const missileIndex = gameStats.selectedShip;
    const bType = ['chick', 'wool', 'horseshoe', 'milk'][missileIndex];
    const useProMissile = gameStats.useProShip && gameStats.proMissiles[missileIndex];
    let bulletCount = evolutionStage + 1; if (bulletCount > 4) bulletCount = 4;
    let baseDmg = (upgrades.bullets === 0 ? 1 : upgrades.bullets) * 15; 
    let finalDamage = baseDmg * currentMatchBooster; 
    if (upgrades.dmgBoost > 0) finalDamage *= 1.5;
    if (upgrades.superDmgBoost > 0) finalDamage *= 1.5; 
    
    const patterns = { 1: [{ dx: 0, offX: player.width / 2 - 12, offY: -10 }], 2: [{ dx: -2, offX: 0, offY: -10 }, { dx: 2, offX: player.width - 24, offY: -10 }], 3: [{ dx: -3, offX: -5, offY: -10 }, { dx: 0, offX: player.width / 2 - 12, offY: -14 }, { dx: 3, offX: player.width - 19, offY: -10 }], 4: [{ dx: -4, offX: -10, offY: -8 }, { dx: -1.5, offX: 5, offY: -14 }, { dx: 1.5, offX: player.width - 29, offY: -14 }, { dx: 4, offX: player.width - 14, offY: -8 }] };
    let currentPattern = patterns[bulletCount] || patterns[1];
    for (let p of currentPattern) { homingMissiles.push({ x: player.x + p.offX, y: player.y + p.offY, width: 24, height: 24, speed: 7.5, vx: p.dx, vy: -5, type: bType, damage: finalDamage, isPro: useProMissile }); }
    missileCooldownTimer = MISSILE_COOLDOWN;
}

window.spawnEnemy = function() {
    if (bosses.length > 0) return; 
    let difficultyTime = score >= 40000 ? timeAt40k : gameTime; let speedMultiplier = 1 + ((difficultyTime / 70) * 0.3); let lastCornHp = 1 + Math.floor((timeAt40k > 0 ? timeAt40k : gameTime) / 12) + (evolutionStage * 5); if (lastCornHp < 1) lastCornHp = 1;
    
    let eType = 'corn'; let eHp = 1; let ePts = 150; let eCoin = 10;
    if (gameRound >= 4) {
        let scale = Math.floor((score - 250000) / 2000); if (scale < 0) scale = 0; eType = Math.random() > 0.5 ? 'maiz_jefe' : 'lechuga_fuerte'; eHp = eType === 'maiz_jefe' ? Math.ceil(lastCornHp * 2.5) + scale : Math.ceil(lastCornHp * 2.0) + scale; ePts = eType === 'maiz_jefe' ? 1200 : 1000; eCoin = eType === 'maiz_jefe' ? 30 : 40;
    } else if (gameRound === 2 || gameRound === 3) {
        let baseLechugaHp = Math.ceil(lastCornHp * 1.2); let fuerteLechugaHp = Math.ceil(lastCornHp * 1.5); 
        let jefeLechugaHp = Math.ceil(lastCornHp * 3.5);
        
        if (score >= 200000) { eType = 'lechuga_jefe'; eHp = jefeLechugaHp; ePts = 600; eCoin = 60; } 
        else if (score >= 120000) { eType = Math.random() < 0.5 ? 'lechuga_fuerte' : 'lechuga_jefe'; eHp = eType === 'lechuga_jefe' ? jefeLechugaHp : fuerteLechugaHp; ePts = eType === 'lechuga_jefe' ? 600 : 300; eCoin = eType === 'lechuga_jefe' ? 60 : 40; } 
        else if (score >= 80000) { eType = 'lechuga_fuerte'; eHp = fuerteLechugaHp; ePts = 300; eCoin = 40; } 
        else if (score >= 60000) { eType = Math.random() < 0.5 ? 'lechuga' : 'lechuga_fuerte'; eHp = eType === 'lechuga_fuerte' ? fuerteLechugaHp : baseLechugaHp; ePts = eType === 'lechuga_fuerte' ? 300 : 150; eCoin = eType === 'lechuga_fuerte' ? 40 : 20; } 
        else { eType = 'lechuga'; eHp = baseLechugaHp; ePts = 150; eCoin = 20; }
    } else { 
        eHp = lastCornHp; 
        if (eHp > 1) { eType = 'corn_strong'; eCoin = 20; } 
        else { eType = 'corn'; eCoin = 10; } 
    }
    
    if (gameRound >= 2) eCoin += 10;
    
    enemies.push({ x: Math.random() * (canvas.width - 48 - 20) + 10, y: -60, width: 48, height: 48, hp: eHp, maxHp: eHp, speed: (1.2 + Math.random() * 1.0) * speedMultiplier, wobble: Math.random() * Math.PI, type: eType, pts: ePts, coin: eCoin, shootCooldown: 0 });
}

window.spawnBoss = function() { 
    if (nextBossScoreThreshold === 250000 && gameRound === 3) {
        let bossHpM = 1680 * 2.5; let bossHpL = 6720 * 3.5;
        bosses.push({ x: 20, y: -120, width: 140, height: 110, maxHp: bossHpM, hp: bossHpM, speed: 1.5, direction: 1, shootCooldown: 0, minionCooldown: 0, isSuperBoss: true, type: 'corn', entered: false, dirY: 1 });
        bosses.push({ x: canvas.width - 160, y: -180, width: 140, height: 110, maxHp: bossHpL, hp: bossHpL, speed: 1.3, direction: -1, shootCooldown: 20, minionCooldown: 40, isSuperBoss: true, type: 'lechuga', entered: false, dirY: 1 });
        doubleBossSpawned = true;
    } else if (nextBossScoreThreshold === 150000 && gameRound === 2) {
        let bossHpL = 6720 * 3.0; 
        bosses.push({ x: canvas.width / 2 - 80, y: -120, width: 160, height: 130, maxHp: bossHpL, hp: bossHpL, speed: 1.3, direction: 1, shootCooldown: 20, minionCooldown: 40, isSuperBoss: true, type: 'lechuga', entered: false, dirY: 1 });
    } else if (nextBossScoreThreshold === 50000 && gameRound === 1) {
        let bossHp = 1680; bosses.push({ x: canvas.width / 2 - 80, y: -120, width: 160, height: 130, maxHp: bossHp, hp: bossHp, speed: 1.2, direction: 1, shootCooldown: 0, minionCooldown: 0, isSuperBoss: true, type: 'corn', entered: false, dirY: 1 });
    } else if (gameRound === 1) {
        let bossLevel = Math.floor(score / 5000); let bossHp = Math.floor((60 + (bossLevel * 45)) * 1.5); bosses.push({ x: canvas.width / 2 - 60, y: -100, width: 120, height: 100, maxHp: bossHp, hp: bossHp, speed: 1.5 + (bossLevel * 0.1), direction: 1, shootCooldown: 0, minionCooldown: 0, isSuperBoss: false, type: 'corn', entered: false, dirY: 1 }); 
    } else if (gameRound === 2) {
        let bossLevel = Math.floor((score - 50000) / 25000); let bossHp = Math.floor((200 + (bossLevel * 100)) * 3.0); bosses.push({ x: canvas.width / 2 - 60, y: -100, width: 120, height: 100, maxHp: bossHp, hp: bossHp, speed: 1.2 + (bossLevel * 0.1), direction: 1, shootCooldown: 0, minionCooldown: 0, isSuperBoss: false, type: 'lechuga', entered: false, dirY: 1 });
    } else if (gameRound === 3) {
        let bossLevel = Math.floor((score - 150000) / 25000); let bossHp = Math.floor((400 + (bossLevel * 150)) * 2.5); let type = Math.random() > 0.5 ? 'corn' : 'lechuga'; bosses.push({ x: canvas.width / 2 - 60, y: -100, width: 120, height: 100, maxHp: bossHp, hp: bossHp, speed: 1.4 + (bossLevel * 0.1), direction: 1, shootCooldown: 0, minionCooldown: 0, isSuperBoss: false, type: type, entered: false, dirY: 1 });
    }
}

window.handleDamage = function() { 
    if (shieldActive) { shieldActive = false; sessionTimeNoHit = 0; return; }
    if (upgrades.armor > 0) { if (!partialHit) { partialHit = true; sessionTimeNoHit = 0; return; } else { partialHit = false; } }
    lives--; sessionKillsNoHit = 0; sessionTimeNoHit = 0; 
    
    if (lives === 1 && gameStats.equipExtraModule && moduleActiveInMatch) {
        if (coins >= 300) {
            coins -= 300; gameStats.savedCoins = coins; saveStats();
            lives += 2;
            showTrophyToast("❤️", null, "Auto-Vida: -300🪙");
            updateUpgradesHUD();
        } else {
            showTrophyToast("💔", null, "Sin monedas para Auto-Vida");
        }
    }
    
    updateLivesUI(); if (lives <= 0) gameOver(); 
}

window.handleCoinEarned = function(amount) { 
    coins += amount; gameStats.savedCoins = coins; sessionCoinsEarned += amount; gameStats.totalCoins += amount; saveStats(); 
    if (gameStats.totalCoins >= 3000) unlockAchievement('a4'); if (gameStats.totalCoins >= 100000) unlockAchievement('a22'); if (coins >= 100000) unlockAchievement('a23'); 
    if (tutorialStep === 1.5 && coins >= 100) { tutorialStep = 2; activateTutorial("¡Conseguiste 100 monedas!<br><br>Toca el botón brillante para <b>Mejorar el Daño</b> (⚔️).", 'hud-bullets'); } 
    else if (tutorialStep === 2.5 && coins >= 100) { tutorialStep = 3; activateTutorial("¡Otras 100 monedas!<br><br>Toca el botón para <b>Mejorar Velocidad</b> (⚡).", 'hud-speed'); } 
    else if (tutorialStep === 3.5) { let needed = (maxUpgradeLimit - upgrades.bullets) * 100 + (maxUpgradeLimit - upgrades.speed) * 100; if (coins >= needed && needed > 0) { tutorialStep = 4; let targets = []; if (upgrades.bullets < maxUpgradeLimit) targets.push('hud-bullets'); if (upgrades.speed < maxUpgradeLimit) targets.push('hud-speed'); activateTutorial("¡Tienes las monedas necesarias!<br><br>Mejora al <b>MÁXIMO</b> el Daño y Velocidad para ascender.", targets); } }
    updateUpgradesHUD();
}

window.damageBoss = function(bIndex, dmg) {
    let boss = bosses[bIndex]; 
    let ship = gameStats.selectedShip;
    let passiveMult = 1.0;
    if (!gameStats.selectedPvpShip && ship === 1 && boss.type === 'corn') passiveMult = 1.2; 
    if (!gameStats.selectedPvpShip && ship === 3 && boss.type === 'lechuga') passiveMult = 1.2; 
    
    let proMult = (!gameStats.selectedPvpShip && gameStats.useProShip) ? 1.3 : 1.0;
    boss.hp -= (dmg * passiveMult * proMult);

    if (boss.hp <= 0) { 
        // Logros oficiales de Google Play Games relacionados con jefes.
        if (typeof window.unlockPlayGamesAchievement === 'function') {
            if (!boss.isSuperBoss) {
                window.unlockPlayGamesAchievement('CgkIu-yInsoTEAIQBA'); // Destructor de jefes
            }
            if (boss.isSuperBoss) {
                window.unlockPlayGamesAchievement('CgkIu-yInsoTEAIQBQ'); // Más allá de la jefatura
                if (boss.type === 'lechuga') {
                    window.unlockPlayGamesAchievement('CgkIu-yInsoTEAIQBg'); // Imponiendo respeto
                }
            }
        }
        score += boss.isSuperBoss ? 4500 : 2250; 
        
        let bCoin = boss.type === 'lechuga' ? 60 : 30;
        if (boss.isSuperBoss) {
            bCoin = boss.type === 'lechuga' ? 500 : 60;
        }
        
        if (gameRound >= 2 && !(boss.isSuperBoss && boss.type === 'lechuga')) bCoin += 10;
        if (gameRound >= 4) bCoin *= 2; 
        
        handleCoinEarned(bCoin); 
        
        document.getElementById('scoreVal').textContent = score; updateUpgradesHUD(); 
        if (boss.isSuperBoss && boss.type === 'corn' && gameRound === 1) { gameState = 'TRANSITION'; previousState = 'TRANSITION'; goingToRound = 2; transitionTimer = 300; bgMusic.volume = 0.15; document.querySelectorAll('.draggable-btn').forEach(b => b.style.display = 'none'); updateUpgradesHUD(); } 
        else if (boss.isSuperBoss && boss.type === 'lechuga' && gameRound === 2 && !doubleBossSpawned) { gameState = 'TRANSITION'; previousState = 'TRANSITION'; goingToRound = 3; transitionTimer = 300; bgMusic.volume = 0.15; document.querySelectorAll('.draggable-btn').forEach(b => b.style.display = 'none'); updateUpgradesHUD(); }
        else if (boss.isSuperBoss && gameRound === 3 && doubleBossSpawned && bosses.length === 1) { gameState = 'TRANSITION'; previousState = 'TRANSITION'; goingToRound = 4; transitionTimer = 300; bgMusic.volume = 0.15; document.querySelectorAll('.draggable-btn').forEach(b => b.style.display = 'none'); updateUpgradesHUD(); doubleBossDefeated = true; unlockAchievement('a21'); }
        bosses.splice(bIndex, 1); unlockAchievement('a10'); if (lives === 1) unlockAchievement('a12'); return true; 
    } return false;
}

window.damageEnemy = function(eIndex, dmg) {
    let e = enemies[eIndex]; 
    let ship = gameStats.selectedShip;
    let passiveMult = 1.0;
    if (!gameStats.selectedPvpShip && ship === 0 && (e.type === 'corn' || e.type === 'corn_strong')) passiveMult = 1.2;
    if (!gameStats.selectedPvpShip && ship === 1 && e.type === 'maiz_jefe') passiveMult = 1.2;
    if (!gameStats.selectedPvpShip && ship === 2 && (e.type === 'lechuga' || e.type === 'lechuga_fuerte')) passiveMult = 1.2;
    if (!gameStats.selectedPvpShip && ship === 3 && e.type === 'lechuga_jefe') passiveMult = 1.2;

    let proMult = (!gameStats.selectedPvpShip && gameStats.useProShip) ? 1.3 : 1.0;
    e.hp -= (dmg * passiveMult * proMult);

    if (e.hp <= 0) { 
        score += e.pts; 
        let finalCoin = e.coin;
        if (gameRound >= 4) finalCoin *= 2; 
        
        handleCoinEarned(finalCoin); 
        document.getElementById('scoreVal').textContent = score; updateUpgradesHUD(); enemies.splice(eIndex, 1); gameStats.totalKills++; saveStats(); sessionKillsNoHit++;
        // Logro oficial de Google Play Games: Primer enemigo derrotado.
        if (typeof window.unlockPlayGamesAchievement === 'function') {
            window.unlockPlayGamesAchievement('CgkIu-yInsoTEAIQAw');
        }
        if (gameStats.totalKills >= 50) unlockAchievement('a3'); if (sessionKillsNoHit >= 30) unlockAchievement('a11'); return true; 
    } return false;
}

window.drawPlayerShip = function(x, y) {
    let ship = gameStats.selectedShip;
    let isPro = gameStats.useProShip ? 1 : 0;
    let stage = evolutionStage;
    
    let currentImg;
    if (gameStats.selectedPvpShip && gameStats.pvpShips?.[gameStats.selectedPvpShip]) {
        currentImg = new Image(); currentImg.src = `assets/${gameStats.selectedPvpShip}.png`;
        isPro = 0;
    } else currentImg = gameStats.useGallinaChile && gameStats.gallinaChile ? assets.gallinaChile : assets.ships[ship][isPro][stage];
    
    if (shieldActive) { ctx.save(); ctx.beginPath(); ctx.arc(x + player.width / 2, y + player.height / 2, 38, 0, Math.PI * 2); ctx.fillStyle = 'rgba(56, 189, 248, 0.2)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)'; ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 10; ctx.stroke(); ctx.restore(); }
    if (upgrades.armor > 0 && !shieldActive) { ctx.save(); ctx.beginPath(); ctx.arc(x + player.width / 2, y + player.height / 2, 34, 0, Math.PI * 2); ctx.fillStyle = partialHit ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.1)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = partialHit ? 'rgba(239, 68, 68, 0.8)' : 'rgba(37, 99, 235, 0.8)'; ctx.stroke(); ctx.restore(); }
    
    if (currentImg && currentImg.complete && currentImg.naturalWidth > 0) {
        const cosmetic=window.gallinaGetShipCosmetic?.()||'normal';
        if(cosmetic==='fantasma'){
            // Silueta espectral + núcleo celeste: no modifica colisiones ni estadísticas.
            const cx=x+player.width/2,cy=y+player.height/2;
            ctx.save();const glow=ctx.createRadialGradient(cx,cy,4,cx,cy,48);glow.addColorStop(0,'rgba(224,250,255,.48)');glow.addColorStop(.40,'rgba(34,211,238,.24)');glow.addColorStop(1,'rgba(34,211,238,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(cx,cy,48,0,Math.PI*2);ctx.fill();
            ctx.globalAlpha=.18;ctx.filter='brightness(0) saturate(100%) invert(88%) sepia(34%) saturate(920%) hue-rotate(140deg) brightness(105%)';
            [[-2,0],[2,0],[0,-2],[0,2]].forEach(([ox,oy])=>ctx.drawImage(currentImg,x+ox,y+oy,player.width,player.height));
            ctx.globalAlpha=.64;ctx.filter='grayscale(1) sepia(1) hue-rotate(128deg) saturate(3.2) brightness(1.48) contrast(.82)';ctx.drawImage(currentImg,x,y,player.width,player.height);
            ctx.globalCompositeOperation='screen';ctx.globalAlpha=.17;ctx.fillStyle='#dffcff';ctx.fillRect(x,y,player.width,player.height);ctx.restore();
        }else if(cosmetic==='halloween'){
            ctx.save();ctx.filter='sepia(.48) hue-rotate(265deg) saturate(1.65) contrast(1.12)';ctx.drawImage(currentImg,x,y,player.width,player.height);ctx.restore();
        }else if(cosmetic==='navidad'){
            ctx.drawImage(currentImg,x,y,player.width,player.height);
            window.gallinaDrawSantaHat?.(ctx,x+player.width/2,y+player.height/2,player.width);
        }else ctx.drawImage(currentImg, x, y, player.width, player.height);
    } else { 
        ctx.save(); ctx.translate(x + player.width/2, y + player.height/2); 
        if (isPro) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 15; } 
        let emojis = [['🥚', '🐣', '🐤', '🐔'], ['☁️', '🐑', '🐏', '🐐'], ['🐴', '🐎', '🎠', '🦄'], ['🥛', '🐄', '🐂', '🐃']];
        ctx.font = `${30 + (stage * 5)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(emojis[ship][stage], 0, 0); ctx.restore(); 
    }
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

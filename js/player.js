let keys = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false, KeyA: false, KeyD: false, KeyW: false, KeyS: false };
window.addEventListener('keydown', (e) => { 
    if (e.code in keys) keys[e.code] = true; 
    if (e.code === 'Space') { if (gameState === 'TUTORIAL' && tutorialStep === 1) { completeTutorialStep(1); shootBullet(); } else if (gameState === 'PLAYING' || gameState === 'TRANSITION') shootBullet(); }
    if (e.code === 'KeyM') { if (gameState === 'TUTORIAL' && tutorialStep === 1.1) { completeTutorialStep(1.1); shootMissile(); } else if (gameState === 'PLAYING' || gameState === 'TRANSITION') shootMissile(); }
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
            if (type === 'fire') shootBullet(); else if (type === 'missile') shootMissile(); else if (type === 'btn3') { (upgrades.bullets >= maxUpgradeLimit && upgrades.speed >= maxUpgradeLimit && evolutionStage < 3) ? buyUpgrade('evolve') : buyUpgrade('life'); } else buyUpgrade(type);
        } else if (gameState === 'PAUSED') { dragObj = btn; const rect = btn.getBoundingClientRect(); dragOffX = e.clientX - rect.left; dragOffY = e.clientY - rect.top; }
    });
});
document.addEventListener('pointermove', (e) => { if (dragObj && gameState === 'PAUSED') { const containerRect = document.getElementById('game-container').getBoundingClientRect(); let newX = e.clientX - containerRect.left - dragOffX; let newY = e.clientY - containerRect.top - dragOffY; if (newX < 0) newX = 0; if (newY < 0) newY = 0; if (newX > containerRect.width - dragObj.offsetWidth) newX = containerRect.width - dragObj.offsetWidth; if (newY > containerRect.height - dragObj.offsetHeight) newY = containerRect.height - dragObj.offsetHeight; let pctX = (newX / containerRect.width) * 100; let pctY = (newY / containerRect.height) * 100; dragObj.style.left = pctX + '%'; dragObj.style.top = pctY + '%'; } });
document.addEventListener('pointerup', (e) => { if (dragObj && gameState === 'PAUSED') { dragObj = null; saveHudPositions(); unlockAchievement('a1'); } });

let isDraggingShip = false; let dragPointerId = null; let lastTouchX = 0; let lastTouchY = 0;
canvas.addEventListener('pointerdown', (e) => { if (dragPointerId === null && (gameState === 'PLAYING' || gameState === 'TRANSITION')) { dragPointerId = e.pointerId; isDraggingShip = true; lastTouchX = (e.clientX - canvas.getBoundingClientRect().left) * (canvas.width / canvas.getBoundingClientRect().width); lastTouchY = (e.clientY - canvas.getBoundingClientRect().top) * (canvas.height / canvas.getBoundingClientRect().height); } });
canvas.addEventListener('pointermove', (e) => { if (!isDraggingShip || (gameState !== 'PLAYING' && gameState !== 'TRANSITION') || e.pointerId !== dragPointerId) return; const currentTouchX = (e.clientX - canvas.getBoundingClientRect().left) * (canvas.width / canvas.getBoundingClientRect().width); const currentTouchY = (e.clientY - canvas.getBoundingClientRect().top) * (canvas.height / canvas.getBoundingClientRect().height); player.x += (currentTouchX - lastTouchX) * (1 + (upgrades.speed * 0.15)); player.y += (currentTouchY - lastTouchY) * (1 + (upgrades.speed * 0.15)); if (player.x < 10) player.x = 10; if (player.x > canvas.width - player.width - 10) player.x = canvas.width - player.width - 10; if (player.y < canvas.height / 2) player.y = canvas.height / 2; if (player.y > canvas.height - player.height - 10) player.y = canvas.height - player.height - 10; lastTouchX = currentTouchX; lastTouchY = currentTouchY; });
window.addEventListener('pointerup', (e) => { if (e.pointerId === dragPointerId) { isDraggingShip = false; dragPointerId = null; } }); window.addEventListener('pointercancel', (e) => { if (e.pointerId === dragPointerId) { isDraggingShip = false; dragPointerId = null; } });

window.shootBullet = function() {
    let bulletCount = Math.min((evolutionStage === 3) ? 4 : 3, upgrades.bullets + 1);
    let baseDmg = upgrades.bullets === 0 ? 1 : upgrades.bullets;
    let bonusPro = gameStats.equippedSkins[evolutionStage] ? 0.30 : 0;
    baseDmg = baseDmg + (baseDmg * bonusPro);
    let finalDamage = (upgrades.dmgBoost > 0 ? baseDmg * 1.5 : baseDmg) * currentMatchBooster;
    if (upgrades.superDmgBoost > 0) finalDamage *= 1.5; 
    const patterns = { 1: [{ dx: 0, offX: player.width / 2 - 2, offY: -10 }], 2: [{ dx: 0, offX: 8, offY: -10 }, { dx: 0, offX: player.width - 12, offY: -10 }], 3: [{ dx: -1.2, offX: 4, offY: -10 }, { dx: 0, offX: player.width / 2 - 2, offY: -14 }, { dx: 1.2, offX: player.width - 8, offY: -10 }], 4: [{ dx: -2.0, offX: 2, offY: -8 }, { dx: -0.6, offX: 12, offY: -14 }, { dx: 0.6, offX: player.width - 16, offY: -14 }, { dx: 2.0, offX: player.width - 6, offY: -8 }] };
    for (let p of (patterns[bulletCount] || patterns[3])) { bullets.push({ x: player.x + p.offX, y: player.y + p.offY, width: 4, height: 20, speed: 14, dx: p.dx, type: 'laser', damage: finalDamage }); }
}

window.shootMissile = function() {
    if (missileCooldownTimer > 0) return;
    let bType = 'chick'; if (evolutionStage === 1) bType = 'wool'; if (evolutionStage === 2) bType = 'horseshoe'; if (evolutionStage === 3) bType = 'milk';
    let bulletCount = evolutionStage + 1;
    if (bulletCount > 4) bulletCount = 4;
    let baseDmg = (upgrades.bullets === 0 ? 1 : upgrades.bullets) * 15;
    let bonusPro = gameStats.equippedMissiles[evolutionStage] ? 0.20 : 0;
    baseDmg = baseDmg + (baseDmg * bonusPro);
    let finalDamage = (upgrades.dmgBoost > 0 ? baseDmg * 1.5 : baseDmg) * currentMatchBooster;
    if (upgrades.superDmgBoost > 0) finalDamage *= 1.5; 
    const patterns = { 1: [{ dx: 0, offX: player.width / 2 - 12, offY: -10 }], 2: [{ dx: -2, offX: 0, offY: -10 }, { dx: 2, offX: player.width - 24, offY: -10 }], 3: [{ dx: -3, offX: -5, offY: -10 }, { dx: 0, offX: player.width / 2 - 12, offY: -14 }, { dx: 3, offX: player.width - 19, offY: -10 }], 4: [{ dx: -4, offX: -10, offY: -8 }, { dx: -1.5, offX: 5, offY: -14 }, { dx: 1.5, offX: player.width - 29, offY: -14 }, { dx: 4, offX: player.width - 14, offY: -8 }] };
    let currentPattern = patterns[bulletCount] || patterns[1];
    for (let p of currentPattern) { homingMissiles.push({ x: player.x + p.offX, y: player.y + p.offY, width: 24, height: 24, speed: 7.5, vx: p.dx, vy: -5, type: bType, damage: finalDamage, isPro: gameStats.equippedMissiles[evolutionStage] }); }
    missileCooldownTimer = MISSILE_COOLDOWN;
}

window.buyUpgrade = function(type) {
    if (type === 'bullets' && upgrades.bullets < maxUpgradeLimit && coins >= 10) { coins -= 10; gameStats.savedCoins = coins; saveStats(); upgrades.bullets++; if (upgrades.bullets === maxUpgradeLimit) unlockAchievement('a8'); }
    else if (type === 'speed' && upgrades.speed < maxUpgradeLimit && coins >= 10) { coins -= 10; gameStats.savedCoins = coins; saveStats(); upgrades.speed++; if (upgrades.speed === maxUpgradeLimit) unlockAchievement('a9'); }
    else if (type === 'life' && coins >= 15 && lives < 10) { coins -= 15; gameStats.savedCoins = coins; saveStats(); lives++; partialHit = false; updateLivesUI(); gameStats.totalLivesBought++; saveStats(); sessionLivesBought++; if (gameStats.totalLivesBought >= 10) unlockAchievement('a15'); if (sessionLivesBought >= 10) unlockAchievement('a16'); }
    else if (type === 'evolve') { if (upgrades.bullets >= maxUpgradeLimit && upgrades.speed >= maxUpgradeLimit) { if (evolutionStage === 0) { evolutionStage = 1; maxUpgradeLimit = 6; unlockAchievement('a5'); } else if (evolutionStage === 1) { evolutionStage = 2; maxUpgradeLimit = 10; unlockAchievement('a6'); } else if (evolutionStage === 2) { evolutionStage = 3; maxUpgradeLimit = 10; unlockAchievement('a7'); } } }
    else if (type === 'armor' && gameRound >= 2 && coins >= 300 && upgrades.armor === 0) { coins -= 300; gameStats.savedCoins = coins; saveStats(); upgrades.armor = 1; }
    else if (type === 'damage' && gameRound >= 2 && coins >= 200 && upgrades.dmgBoost === 0) { coins -= 200; gameStats.savedCoins = coins; saveStats(); upgrades.dmgBoost = 1; }
    else if (type === 'superDamage' && (gameRound === 3 || goingToRound === 3) && coins >= 1000 && upgrades.superDmgBoost === 0) { coins -= 1000; gameStats.savedCoins = coins; saveStats(); upgrades.superDmgBoost = 1; }
    
    updateUpgradesHUD();

    if (!gameStats.tutorialCompleted) {
        if (tutorialStep === 4 || tutorialStep === 3.5) {
            if (upgrades.bullets >= maxUpgradeLimit) document.getElementById('hud-bullets').classList.remove('tutorial-highlight');
            if (upgrades.speed >= maxUpgradeLimit) document.getElementById('hud-speed').classList.remove('tutorial-highlight');
            if (upgrades.bullets >= maxUpgradeLimit && upgrades.speed >= maxUpgradeLimit) {
                tutorialStep = 4.5;
                activateTutorial("¡Excelente!<br><br>Ahora toca el botón de <b>Evolución</b> (🌟) para transformar tu nave.", 'hud-life-evolve');
            } else if (tutorialStep === 4 && coins < 10) {
                tutorialStep = 3.5;
                document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
                document.getElementById('activeTutorialOverlay').style.display = 'none';
                gameState = 'PLAYING';
            }
        }
    }
}

window.handleCoinEarned = function(amount) { 
    coins += amount; gameStats.savedCoins = coins; sessionCoinsEarned += amount; gameStats.totalCoins += amount; saveStats(); 
    if (gameStats.totalCoins >= 300) unlockAchievement('a4'); if (gameStats.totalCoins >= 10000) unlockAchievement('a22'); if (coins >= 10000) unlockAchievement('a23'); 
    
    if (tutorialStep === 1.5 && coins >= 10) { tutorialStep = 2; activateTutorial("¡Conseguiste 10 monedas!<br><br>Toca el botón brillante para <b>Mejorar el Daño</b> (⚔️).", 'hud-bullets'); } 
    else if (tutorialStep === 2.5 && coins >= 10) { tutorialStep = 3; activateTutorial("¡Otras 10 monedas!<br><br>Toca el botón para <b>Mejorar Velocidad</b> (⚡).", 'hud-speed'); } 
    else if (tutorialStep === 3.5) {
        let needed = (maxUpgradeLimit - upgrades.bullets) * 10 + (maxUpgradeLimit - upgrades.speed) * 10;
        if (coins >= needed && needed > 0) {
            tutorialStep = 4;
            let targets = [];
            if (upgrades.bullets < maxUpgradeLimit) targets.push('hud-bullets');
            if (upgrades.speed < maxUpgradeLimit) targets.push('hud-speed');
            activateTutorial("¡Tienes las monedas necesarias!<br><br>Mejora al <b>MÁXIMO</b> el Daño y Velocidad para ascender.", targets);
        }
    }
    updateUpgradesHUD();
}

window.handleDamage = function() { 
    if (shieldActive) { shieldActive = false; sessionTimeNoHit = 0; return; }
    if (upgrades.armor > 0) { if (!partialHit) { partialHit = true; sessionTimeNoHit = 0; return; } else { partialHit = false; } }
    lives--; sessionKillsNoHit = 0; sessionTimeNoHit = 0; updateLivesUI(); if (lives <= 0) gameOver(); 
}

window.drawPlayerShip = function(x, y) {
    let currentImg;
    if (evolutionStage === 3) currentImg = gameStats.equippedSkins[3] ? assets.vacaPro : assets.vaca; else if (evolutionStage === 2) currentImg = gameStats.equippedSkins[2] ? assets.caballoPro : assets.caballo; else if (evolutionStage === 1) currentImg = gameStats.equippedSkins[1] ? assets.ovejaPro : assets.oveja; else currentImg = gameStats.equippedSkins[0] ? assets.gallinaPro : assets.gallina;
    let isPro = gameStats.equippedSkins[evolutionStage] || gameStats.equippedMissiles[evolutionStage];
    if (shieldActive) { ctx.save(); ctx.beginPath(); ctx.arc(x + player.width / 2, y + player.height / 2, 38, 0, Math.PI * 2); ctx.fillStyle = 'rgba(56, 189, 248, 0.2)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)'; ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 10; ctx.stroke(); ctx.restore(); }
    if (upgrades.armor > 0 && !shieldActive) { ctx.save(); ctx.beginPath(); ctx.arc(x + player.width / 2, y + player.height / 2, 34, 0, Math.PI * 2); ctx.fillStyle = partialHit ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.1)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = partialHit ? 'rgba(239, 68, 68, 0.8)' : 'rgba(37, 99, 235, 0.8)'; ctx.stroke(); ctx.restore(); }
    if (currentImg.complete && currentImg.naturalWidth > 0) { ctx.drawImage(currentImg, x, y, player.width, player.height); } else {
        ctx.save(); ctx.translate(x, y);
        if (isPro) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 15; }
        if (evolutionStage === 3) { ctx.fillStyle = '#f1f5f9'; ctx.beginPath(); ctx.ellipse(25, 26, 22, 18, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#0f172a'; ctx.fillRect(15, 20, 8, 8); ctx.fillRect(30, 28, 6, 6); } else if (evolutionStage === 2) { ctx.fillStyle = '#a855f7'; ctx.beginPath(); ctx.ellipse(25, 26, 18, 22, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#c084fc'; ctx.fillRect(20, -4, 10, 16); } else if (evolutionStage === 1) { ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.ellipse(25, 26, 20, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(25, 10, 10, 0, Math.PI * 2); ctx.fill(); } else { ctx.fillStyle = '#38bdf8'; ctx.fillRect(16, 42, 6, 10); ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.ellipse(25, 26, 16, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#cbd5e1'; ctx.stroke(); ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.arc(25, 17, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.moveTo(21, 8); ctx.lineTo(29, 8); ctx.lineTo(25, 0); ctx.fill(); ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(22, 2, 3.5, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
    }
}

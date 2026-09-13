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
    if (nextBossScoreThreshold === 250000 && gameRound === 3) { let bossHpM = 1680 * 2; let bossHpL = 6720 * 2; bosses.push({ x: 20, y: -120, width: 140, height: 110, maxHp: bossHpM, hp: bossHpM, speed: 1.5, direction: 1, shootCooldown: 0, minionCooldown: 0, isSuperBoss: true, type: 'corn', entered: false, dirY: 1 }); bosses.push({ x: canvas.width - 160, y: -180, width: 140, height: 110, maxHp: bossHpL, hp: bossHpL, speed: 1.3, direction: -1, shootCooldown: 20, minionCooldown: 40, isSuperBoss: true, type: 'lechuga', entered: false, dirY: 1 }); doubleBossSpawned = true; }
    else if (nextBossScoreThreshold === 150000 && gameRound === 2) { let bossHp = 6720; bosses.push({ x: canvas.width / 2 - 80, y: -120, width: 160, height: 130, maxHp: bossHp, hp: bossHp, speed: 1.4, direction: 1, shootCooldown: 0, minionCooldown: 0, isSuperBoss: true, type: 'lechuga', entered: false, dirY: 1 }); }
    else if (nextBossScoreThreshold === 50000 && gameRound === 1) { let bossHp = 1680; bosses.push({ x: canvas.width / 2 - 80, y: -120, width: 160, height: 130, maxHp: bossHp, hp: bossHp, speed: 1.2, direction: 1, shootCooldown: 0, minionCooldown: 0, isSuperBoss: true, type: 'corn', entered: false, dirY: 1 }); } 
    else if (gameRound === 1) { let bossLevel = Math.floor(score / 5000); let bossHp = Math.floor((60 + (bossLevel * 45)) * 1.5); bosses.push({ x: canvas.width / 2 - 60, y: -100, width: 120, height: 100, maxHp: bossHp, hp: bossHp, speed: 1.5 + (bossLevel * 0.1), direction: 1, shootCooldown: 0, minionCooldown: 0, isSuperBoss: false, type: 'corn', entered: false, dirY: 1 }); }
}

window.damageBoss = function(bIndex, dmg) {
    let boss = bosses[bIndex]; boss.hp -= dmg;
    if (boss.hp <= 0) { 
        score += boss.isSuperBoss ? 4500 : 2250; handleCoinEarned(boss.isSuperBoss ? 6 : 3); document.getElementById('scoreVal').textContent = score; updateUpgradesHUD(); 
        if (boss.isSuperBoss && boss.type === 'corn' && gameRound === 1) { gameState = 'TRANSITION'; previousState = 'TRANSITION'; goingToRound = 2; transitionTimer = 300; bgMusic.volume = 0.15; document.querySelectorAll('.draggable-btn').forEach(b => b.style.display = 'none'); updateUpgradesHUD(); } 
        else if (boss.isSuperBoss && boss.type === 'lechuga' && gameRound === 2) { gameState = 'TRANSITION'; previousState = 'TRANSITION'; goingToRound = 3; transitionTimer = 300; bgMusic.volume = 0.15; document.querySelectorAll('.draggable-btn').forEach(b => b.style.display = 'none'); updateUpgradesHUD(); }
        bosses.splice(bIndex, 1); unlockAchievement('a10'); if (lives === 1) unlockAchievement('a12'); return true; 
    } return false;
}

window.damageEnemy = function(eIndex, dmg) {
    let e = enemies[eIndex]; e.hp -= dmg;
    if (e.hp <= 0) { score += e.pts; handleCoinEarned(e.coin); document.getElementById('scoreVal').textContent = score; updateUpgradesHUD(); enemies.splice(eIndex, 1); gameStats.totalKills++; saveStats(); sessionKillsNoHit++; if (gameStats.totalKills >= 50) unlockAchievement('a3'); if (sessionKillsNoHit >= 30) unlockAchievement('a11'); return true; } return false;
}

window.drawEnemy = function(e) {
    let img = null;
    if (e.type === 'corn') img = assets.maiz; else if (e.type === 'corn_strong') img = assets.maizFuerte; else if (e.type === 'maiz_jefe') img = assets.jefeMaiz; else if (e.type === 'lechuga') img = assets.lechuga; else if (e.type === 'lechuga_fuerte') img = assets.lechugaFuerte; else if (e.type === 'lechuga_jefe') img = assets.jefeLechuga;
    if (img && img.complete && img.naturalWidth > 0) { ctx.drawImage(img, e.x, e.y, e.width, e.height); } else { ctx.save(); ctx.translate(e.x, e.y); if (e.type.includes('lechuga')) { ctx.fillStyle = e.type === 'lechuga' ? '#22c55e' : (e.type === 'lechuga_fuerte' ? '#166534' : '#14532d'); ctx.beginPath(); ctx.arc(e.width/2, e.height/2, e.width/2 - 4, 0, Math.PI*2); ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle='#052e16'; ctx.stroke(); if(e.type !== 'lechuga') { ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(e.width/2, 10, 10, 0, Math.PI*2); ctx.fill(); } } else { ctx.fillStyle = e.type === 'maiz_jefe' ? '#ca8a04' : '#eab308'; ctx.beginPath(); ctx.roundRect(4, 6, e.width-8, e.height-8, [12, 12, 18, 18]); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#854d0e'; ctx.stroke(); if (e.maxHp > 1) { ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.arc(e.width/2, 10, 16, Math.PI, 0, false); ctx.fill(); } } ctx.restore(); }
}

window.drawBoss = function(b) {
    ctx.save(); ctx.translate(b.x, b.y);
    if (b.isSuperBoss) { ctx.shadowColor = b.type==='lechuga' ? 'rgba(34, 197, 94, 0.9)' : 'rgba(220, 38, 38, 0.9)'; ctx.shadowBlur = 20; }
    let bImg = null; if (b.type === 'corn') bImg = b.isSuperBoss ? assets.superJefeMaiz : assets.jefeMaiz; else bImg = b.isSuperBoss ? assets.superJefeLechuga : assets.jefeLechuga;
    if (bImg && bImg.complete && bImg.naturalWidth > 0) { ctx.drawImage(bImg, 0, 0, b.width, b.height); } else { ctx.fillStyle = b.type==='corn' ? (b.isSuperBoss ? '#991b1b' : '#ca8a04') : (b.isSuperBoss ? '#064e3b' : '#166534'); ctx.beginPath(); ctx.roundRect(0, 0, b.width, b.height, [20, 20, 30, 30]); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#020617'; ctx.stroke(); }
    ctx.restore(); ctx.fillStyle = '#334155'; ctx.fillRect(b.x + 10, b.y - 15, b.width - 20, 8); ctx.fillStyle = b.isSuperBoss ? '#ef4444' : '#22c55e'; ctx.fillRect(b.x + 10, b.y - 15, (b.width - 20) * (b.hp / b.maxHp), 8);
}

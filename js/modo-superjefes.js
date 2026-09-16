/* Coordina el modo de Superjefes con 4 rondas personalizadas, aumento de vida en lechugas, reaparición y 50k monedas al finalizar. */
(() => {
    let active = false;
    let hitCooldown = 0;
    let currentWave = 1;
    const normalUpdate = update;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x &&
        a.y < b.y + b.height && a.y + b.height > b.y;

    function updateScore() {
        document.getElementById('scoreVal').textContent = score;
    }

    function damagePlayer(amount) {
        if (hitCooldown || gameState !== 'PLAYING') return;
        hitCooldown = 45;
        shieldActive = false;
        partialHit = false;
        lives -= amount;
        sessionKillsNoHit = 0;
        sessionTimeNoHit = 0;
        if (lives === 1 && gameStats.equipExtraModule && moduleActiveInMatch) {
            if (coins >= 300) {
                coins -= 300;
                gameStats.savedCoins = coins;
                saveStats();
                lives += 2;
                showTrophyToast('❤️', null, 'Auto-Vida: -300🪙');
            } else {
                showTrophyToast('💔', null, 'Sin monedas para Auto-Vida');
            }
        }
        updateLivesUI();
        updateUpgradesHUD();
        if (lives <= 0) gameOver();
    }

    function createCustomSuperBoss(index, type = 'corn') {
        const baseBoss = SuperJefeMaiz.create(index, type);
        if (type === 'lechuga') {
            baseBoss.maxHp = Math.floor(baseBoss.maxHp * 1.5);
            baseBoss.hp = baseBoss.maxHp;
        }
        return baseBoss;
    }

    function damageBoss(index, damage) {
        const boss = bosses[index];
        if (!boss) return;
        let multiplier = gameStats.selectedShip === 1 ? 1.2 : 1;
        if (gameStats.useProShip) multiplier *= 1.3;
        boss.hp -= damage * multiplier;
        if (boss.hp > 0) return;

        bosses.splice(index, 1);
        score += 10000;
        handleCoinEarned(250);
        updateScore();

        if (!bosses.length) {
            if (currentWave === 1) startWave(2);
            else if (currentWave === 2) startWave(3);
            else if (currentWave === 3) startWave(4);
            else finishMode();
        }
    }

    function spawnMinionForCurrentWave() {
        if (bosses.length === 0) return;
        const side = Math.floor(Math.random() * 4);
        let x = 0, y = 0;
        let types = [];

        if (currentWave === 1) {
            types = [
                { width: 60, height: 60, maxHp: 350, hp: 350, type: 'maiz_jefe', pts: 1200, coin: 40 },
                { width: 48, height: 48, maxHp: 150, hp: 150, type: 'corn_strong', pts: 1500, coin: 50 },
                { width: 40, height: 40, maxHp: 60, hp: 60, type: 'corn', pts: 150, coin: 20 }
            ];
        } else if (currentWave === 2) {
            types = [
                { width: 60, height: 60, maxHp: 350, hp: 350, type: 'maiz_jefe', pts: 1200, coin: 40 },
                { width: 48, height: 48, maxHp: 150, hp: 150, type: 'corn_strong', pts: 1500, coin: 50 },
                { width: 48, height: 48, maxHp: 280, hp: 280, type: 'lechuga_fuerte', pts: 400, coin: 30 },
                { width: 56, height: 56, maxHp: 500, hp: 500, type: 'lechuga_jefe', pts: 800, coin: 50 }
            ];
        } else if (currentWave === 3) {
            types = [
                { width: 56, height: 56, maxHp: 500, hp: 500, type: 'lechuga_jefe', pts: 800, coin: 50 },
                { width: 48, height: 48, maxHp: 280, hp: 280, type: 'lechuga_fuerte', pts: 400, coin: 30 },
                { width: 60, height: 60, maxHp: 350, hp: 350, type: 'maiz_jefe', pts: 1200, coin: 40 }
            ];
        } else if (currentWave === 4) {
            types = [
                { width: 56, height: 56, maxHp: 500, hp: 500, type: 'lechuga_jefe', pts: 800, coin: 50 },
                { width: 48, height: 48, maxHp: 280, hp: 280, type: 'lechuga_fuerte', pts: 400, coin: 30 }
            ];
        }

        if (types.length === 0) return;
        const cfg = types[Math.floor(Math.random() * types.length)];

        if (side === 0) { x = Math.random() * (canvas.width - cfg.width); y = -60; }
        else if (side === 1) { x = Math.random() * (canvas.width - cfg.width); y = canvas.height + 20; }
        else if (side === 2) { x = -60; y = Math.random() * (canvas.height - cfg.height); }
        else { x = canvas.width + 20; y = Math.random() * (canvas.height - cfg.height); }

        enemies.push({ ...cfg, x, y, speed: 1.1, wobble: Math.random() * Math.PI });
    }

    function startWave(waveNum) {
        currentWave = waveNum;
        bosses.length = 0;
        enemies.length = 0;
        bossBullets.length = 0;

        if (waveNum === 1) {
            bosses.push(createCustomSuperBoss(0, 'corn'));
            enemies.push(
                { width: 60, height: 60, maxHp: 350, hp: 350, type: 'maiz_jefe', pts: 1200, coin: 40, x: canvas.width / 2 - 30, y: 40, speed: 0.9 },
                { width: 48, height: 48, maxHp: 150, hp: 150, type: 'corn_strong', pts: 1500, coin: 50, x: canvas.width * 0.15, y: 70, speed: 1.1 },
                { width: 48, height: 48, maxHp: 150, hp: 150, type: 'corn_strong', pts: 1500, coin: 50, x: canvas.width * 0.5, y: 80, speed: 1.0 },
                { width: 48, height: 48, maxHp: 150, hp: 150, type: 'corn_strong', pts: 1500, coin: 50, x: canvas.width * 0.85, y: 70, speed: 1.1 },
                { width: 40, height: 40, maxHp: 60, hp: 60, type: 'corn', pts: 150, coin: 20, x: canvas.width * 0.3, y: 100, speed: 1.2 },
                { width: 40, height: 40, maxHp: 60, hp: 60, type: 'corn', pts: 150, coin: 20, x: canvas.width * 0.6, y: 100, speed: 1.2 },
                { width: 40, height: 40, maxHp: 60, hp: 60, type: 'corn', pts: 150, coin: 20, x: canvas.width * 0.5, y: 120, speed: 1.3 }
            );
        } else if (waveNum === 2) {
            bosses.push(createCustomSuperBoss(0, 'corn'), createCustomSuperBoss(1, 'corn'));
            enemies.push(
                { width: 60, height: 60, maxHp: 350, hp: 350, type: 'maiz_jefe', pts: 1200, coin: 40, x: canvas.width / 2 - 30, y: 40, speed: 0.9 },
                { width: 48, height: 48, maxHp: 150, hp: 150, type: 'corn_strong', pts: 1500, coin: 50, x: canvas.width * 0.2, y: 70, speed: 1.1 },
                { width: 48, height: 48, maxHp: 150, hp: 150, type: 'corn_strong', pts: 1500, coin: 50, x: canvas.width * 0.8, y: 70, speed: 1.0 },
                { width: 48, height: 48, maxHp: 280, hp: 280, type: 'lechuga_fuerte', pts: 400, coin: 30, x: canvas.width * 0.35, y: 90, speed: 1.2 },
                { width: 48, height: 48, maxHp: 280, hp: 280, type: 'lechuga_fuerte', pts: 400, coin: 30, x: canvas.width * 0.65, y: 90, speed: 1.2 },
                { width: 56, height: 56, maxHp: 500, hp: 500, type: 'lechuga_jefe', pts: 800, coin: 50, x: canvas.width / 2 - 28, y: 110, speed: 1.0 }
            );
        } else if (waveNum === 3) {
            bosses.push(createCustomSuperBoss(2, 'lechuga'), createCustomSuperBoss(0, 'corn'));
            enemies.push(
                { width: 56, height: 56, maxHp: 500, hp: 500, type: 'lechuga_jefe', pts: 800, coin: 50, x: canvas.width * 0.25, y: 60, speed: 1.0 },
                { width: 56, height: 56, maxHp: 500, hp: 500, type: 'lechuga_jefe', pts: 800, coin: 50, x: canvas.width * 0.75, y: 60, speed: 1.0 },
                { width: 48, height: 48, maxHp: 280, hp: 280, type: 'lechuga_fuerte', pts: 400, coin: 30, x: canvas.width * 0.2, y: 90, speed: 1.2 },
                { width: 48, height: 48, maxHp: 280, hp: 280, type: 'lechuga_fuerte', pts: 400, coin: 30, x: canvas.width * 0.8, y: 90, speed: 1.2 },
                { width: 60, height: 60, maxHp: 350, hp: 350, type: 'maiz_jefe', pts: 1200, coin: 40, x: canvas.width / 2 - 30, y: 70, speed: 0.9 }
            );
        } else if (waveNum === 4) {
            bosses.push(
                createCustomSuperBoss(2, 'lechuga'),
                createCustomSuperBoss(3, 'lechuga'),
                createCustomSuperBoss(4, 'lechuga')
            );
            enemies.push(
                { width: 56, height: 56, maxHp: 500, hp: 500, type: 'lechuga_jefe', pts: 800, coin: 50, x: canvas.width * 0.3, y: 60, speed: 1.1 },
                { width: 56, height: 56, maxHp: 500, hp: 500, type: 'lechuga_jefe', pts: 800, coin: 50, x: canvas.width * 0.7, y: 60, speed: 1.1 },
                { width: 48, height: 48, maxHp: 280, hp: 280, type: 'lechuga_fuerte', pts: 400, coin: 30, x: canvas.width * 0.2, y: 90, speed: 1.2 },
                { width: 48, height: 48, maxHp: 280, hp: 280, type: 'lechuga_fuerte', pts: 400, coin: 30, x: canvas.width * 0.5, y: 100, speed: 1.2 },
                { width: 48, height: 48, maxHp: 280, hp: 280, type: 'lechuga_fuerte', pts: 400, coin: 30, x: canvas.width * 0.8, y: 90, speed: 1.2 }
            );
        }
    }

    function damageEnemyInMode(index, damage) {
        const enemy = enemies[index];
        if (!enemy) return;
        let multiplier = gameStats.selectedShip === 1 ? 1.2 : 1;
        if (gameStats.useProShip) multiplier *= 1.3;
        enemy.hp -= damage * multiplier;
        if (enemy.hp > 0) return;

        enemies.splice(index, 1);
        score += enemy.pts;
        handleCoinEarned(enemy.coin);
        updateScore();

        if (bosses.length > 0) {
            spawnMinionForCurrentWave();
        }
    }

    function updateEnemiesInMode() {
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            const dx = player.x + player.width / 2 - (enemy.x + enemy.width / 2);
            const dy = player.y + player.height / 2 - (enemy.y + enemy.height / 2);
            const distance = Math.max(1, Math.hypot(dx, dy));
            enemy.x = clamp(enemy.x + (dx / distance) * enemy.speed, 10, canvas.width - enemy.width - 10);
            enemy.y = clamp(enemy.y + (dy / distance) * enemy.speed, 10, canvas.height - enemy.height - 10);
            if (overlaps(player, enemy)) {
                enemies.splice(i, 1);
                damagePlayer(1);
                if (bosses.length > 0) {
                    spawnMinionForCurrentWave();
                }
            }
        }
    }

    function finishMode() {
        active = false;
        window.isSuperBossModeActive = false;
        bossBullets.length = 0;
        
        coins += 50000;
        gameStats.savedCoins = coins;
        gameStats.totalCoins += 50000;
        saveStats();
        updateUpgradesHUD();

        document.querySelectorAll('.draggable-btn').forEach((button) => {
            button.style.display = 'none';
        });
        document.querySelector('#startScreen h1').textContent = '🏆 ¡Superjefes derrotados!';
        document.getElementById('startScreen').style.display = 'flex';
    }

    function movePlayer() {
        const speed = player.baseSpeed + (upgrades.speed - 1) * 0.5;
        if (keys.ArrowLeft || keys.KeyA) player.x -= speed;
        if (keys.ArrowRight || keys.KeyD) player.x += speed;
        if (keys.ArrowUp || keys.KeyW) player.y -= speed;
        if (keys.ArrowDown || keys.KeyS) player.y += speed;
        if (gameStats.controlMode === 'joystick' && joystick.active) {
            player.x += joystick.dx * speed * 1.5;
            player.y += joystick.dy * speed * 1.5;
        }
        player.x = clamp(player.x, 10, canvas.width - player.width - 10);
        player.y = clamp(player.y, 10, canvas.height - player.height - 10);
    }

    function closestTargetTo(entity) {
        let closest = null;
        let closestDistance = Infinity;
        const originX = entity.x + entity.width / 2;
        const originY = entity.y + entity.height / 2;

        for (const group of [bosses, enemies]) {
            for (const target of group) {
                const distance = Math.hypot(
                    target.x + target.width / 2 - originX,
                    target.y + target.height / 2 - originY
                );
                if (distance < closestDistance) {
                    closest = target;
                    closestDistance = distance;
                }
            }
        }
        return closest;
    }

    function aimAtClosestTarget(projectile) {
        const target = closestTargetTo(projectile);
        if (!target) return false;
        const originX = projectile.x + projectile.width / 2;
        const originY = projectile.y + projectile.height / 2;
        const angle = Math.atan2(
            target.y + target.height / 2 - originY,
            target.x + target.width / 2 - originX
        );
        const speed = projectile.speed || 8;
        projectile.angle = angle + Math.PI / 2;
        projectile.x += Math.cos(angle) * speed;
        projectile.y += Math.sin(angle) * speed;
        return true;
    }

    function updatePlayerAim() {
        const target = closestTargetTo(player);
        if (!target) return;
        const desiredAngle = Math.atan2(
            target.y + target.height / 2 - (player.y + player.height / 2),
            target.x + target.width / 2 - (player.x + player.width / 2)
        ) + Math.PI / 2;
        const currentAngle = player.autoAimAngle || 0;
        const difference = Math.atan2(
            Math.sin(desiredAngle - currentAngle),
            Math.cos(desiredAngle - currentAngle)
        );
        player.autoAimAngle = currentAngle + difference * 0.18;
    }

    function updatePlayerShots() {
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            if (!aimAtClosestTarget(bullet)) {
                bullet.y -= bullet.speed;
                if (bullet.dx) bullet.x += bullet.dx;
            }
            if (bullet.y < -30 || bullet.x < -30 || bullet.x > canvas.width + 30) {
                bullets.splice(i, 1);
                continue;
            }
            let hitBoss = false;
            for (let j = bosses.length - 1; j >= 0; j--) {
                if (overlaps(bullet, bosses[j])) {
                    bullets.splice(i, 1);
                    damageBoss(j, bullet.damage);
                    hitBoss = true;
                    break;
                }
            }
            if (hitBoss) continue;
            for (let j = enemies.length - 1; j >= 0; j--) {
                if (overlaps(bullet, enemies[j])) {
                    bullets.splice(i, 1);
                    damageEnemyInMode(j, bullet.damage);
                    break;
                }
            }
        }
    }

    function updatePlayerMissiles() {
        for (let i = homingMissiles.length - 1; i >= 0; i--) {
            const missile = homingMissiles[i];
            const target = closestTargetTo(missile);
            if (target) {
                const angle = Math.atan2(target.y + target.height / 2 - (missile.y + missile.height / 2),
                    target.x + target.width / 2 - (missile.x + missile.width / 2));
                missile.vx += (Math.cos(angle) * missile.speed - missile.vx) * 0.08;
                missile.vy += (Math.sin(angle) * missile.speed - missile.vy) * 0.08;
            } else missile.vy -= 0.2;
            missile.x += missile.vx;
            missile.y += missile.vy;
            if (missile.y < -50 || missile.x < -50 || missile.x > canvas.width + 50 || missile.y > canvas.height + 50) {
                homingMissiles.splice(i, 1);
                continue;
            }
            let hitBoss = false;
            for (let j = bosses.length - 1; j >= 0; j--) {
                if (overlaps(missile, bosses[j])) {
                    homingMissiles.splice(i, 1);
                    damageBoss(j, missile.damage);
                    hitBoss = true;
                    break;
                }
            }
            if (hitBoss) continue;
            for (let j = enemies.length - 1; j >= 0; j--) {
                if (overlaps(missile, enemies[j])) {
                    homingMissiles.splice(i, 1);
                    damageEnemyInMode(j, missile.damage);
                    break;
                }
            }
        }
    }

    function updateBossShots() {
        for (let i = bossBullets.length - 1; i >= 0; i--) {
            const bullet = bossBullets[i];
            bullet.x += bullet.vx || 0;
            bullet.y += bullet.vy || 0;
            if (bullet.x < -25 || bullet.x > canvas.width + 25 || bullet.y < -25 || bullet.y > canvas.height + 25) {
                bossBullets.splice(i, 1);
                continue;
            }
            if (overlaps(player, bullet)) {
                bossBullets.splice(i, 1);
                damagePlayer(bullet.damage || 1);
            }
        }
    }

    update = function () {
        if (!active) return normalUpdate();
        if (gameState === 'EVOLVING') return normalUpdate();
        if (gameState !== 'PLAYING') return;
        if (hitCooldown) hitCooldown--;

        if (missileCooldownTimer > 0) {
            missileCooldownTimer--;
            let sec = Math.ceil(missileCooldownTimer / 60);
            const cooldownEl = document.getElementById('missileCooldown');
            if (cooldownEl) cooldownEl.textContent = sec + 's';
            const missileBtnEl = document.getElementById('missileBtn');
            if (missileBtnEl) missileBtnEl.classList.remove('missile-ready');
        } else {
            const cooldownEl = document.getElementById('missileCooldown');
            if (cooldownEl) cooldownEl.textContent = 'LISTO';
            const missileBtnEl = document.getElementById('missileBtn');
            if (missileBtnEl) missileBtnEl.classList.add('missile-ready');
        }

        for (const star of stars) {
            star.y += star.speed;
            if (star.y > canvas.height) star.y = 0;
        }
        movePlayer();
        updateEnemiesInMode();
        updatePlayerAim();
        updatePlayerShots();
        updatePlayerMissiles();
        updateBossShots();
        for (const boss of bosses) {
            if (SuperJefeMaiz.update(boss)) damagePlayer(2);
        }
    };

    window.startSuperBossMode = function () {
        window.startGame();
        active = true;
        window.isSuperBossModeActive = true;
        gameState = 'PLAYING';
        previousState = 'PLAYING';
        gameRound = 4;
        
        upgrades.armor = 0;
        upgrades.dmgBoost = 0;
        upgrades.superDmgBoost = 0;

        nextBossScoreThreshold = Number.MAX_SAFE_INTEGER;
        score = 0;
        enemies.length = bullets.length = homingMissiles.length = bossBullets.length = bosses.length = 0;
        hitCooldown = 0;
        player.autoAimAngle = 0;
        shieldActive = partialHit = false;
        player.x = canvas.width / 2 - player.width / 2;
        player.y = canvas.height - player.height - 20;
        document.getElementById('activeTutorialOverlay').style.display = 'none';
        
        startWave(1);
        updateScore();
        updateUpgradesHUD();
    };

    const missileBtnElement = document.getElementById('missileBtn');
    if (missileBtnElement) {
        missileBtnElement.addEventListener('pointerdown', (event) => {
            if (!active || gameState !== 'PLAYING') return;
            window.shootMissile();
            event.stopImmediatePropagation();
        }, true);
    }

    canvas.addEventListener('pointerdown', (event) => {
        if (!active || gameState !== 'PLAYING') return;
        dragPointerId = event.pointerId;
        isDraggingShip = true;
        const rect = canvas.getBoundingClientRect();
        lastTouchX = (event.clientX - rect.left) * (canvas.width / rect.width);
        lastTouchY = (event.clientY - rect.top) * (canvas.height / rect.height);
        event.stopImmediatePropagation();
    }, true);
    canvas.addEventListener('pointermove', (event) => {
        if (!active || !isDraggingShip || event.pointerId !== dragPointerId) return;
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) * (canvas.width / rect.width);
        const y = (event.clientY - rect.top) * (canvas.height / rect.height);
        player.x = clamp(player.x + (x - lastTouchX) * (1 + upgrades.speed * 0.15), 10, canvas.width - player.width - 10);
        player.y = clamp(player.y + (y - lastTouchY) * (1 + upgrades.speed * 0.15), 10, canvas.height - player.height - 10);
        lastTouchX = x;
        lastTouchY = y;
        event.stopImmediatePropagation();
    }, true);

    function requestGameFullscreen() {
        const game = document.getElementById('game-container');
        if (!document.fullscreenElement && game.requestFullscreen) {
            game.requestFullscreen().catch(() => {});
        }
    }

    function installMobileFullscreenLayout() {
        const style = document.createElement('style');
        style.textContent = `
            #game-container {
                width: min(100vw, 65.625dvh);
                height: min(100dvh, 152.38095vw);
                max-width: none;
                max-height: none;
                aspect-ratio: 420 / 640;
            }
            @media (max-width: 600px) {
                body { width: 100vw; min-height: 100dvh; height: 100dvh; padding: 0; }
                #game-container {
                    border: 0; border-radius: 0; box-shadow: none;
                }
            }
        `;
        document.head.appendChild(style);
    }

    const normalDrawPlayerShip = window.drawPlayerShip;
    window.drawPlayerShip = function (x, y) {
        if (!active || !player.autoAimAngle) return normalDrawPlayerShip(x, y);
        ctx.save();
        ctx.translate(x + player.width / 2, y + player.height / 2);
        ctx.rotate(player.autoAimAngle);
        ctx.translate(-x - player.width / 2, -y - player.height / 2);
        normalDrawPlayerShip(x, y);
        ctx.restore();
    };

    document.getElementById('startBtn').addEventListener('click', () => {
        active = false;
        window.isSuperBossModeActive = false;
        player.autoAimAngle = 0;
    }, true);
    document.getElementById('restartBtn').addEventListener('click', (event) => {
        if (!active) return;
        event.stopImmediatePropagation();
        window.startSuperBossMode();
    }, true);
    installMobileFullscreenLayout();

    const button = document.createElement('button');
    button.className = 'btn btn-secondary';
    button.id = 'superBossModeBtn';
    button.textContent = '🌽⚡ Duelo: Superjefes y Hordas';
    button.addEventListener('click', () => {
        requestGameFullscreen();
        window.startSuperBossMode();
    });
    document.getElementById('startScreen').insertBefore(button, document.getElementById('openTutorialBtn'));
})();

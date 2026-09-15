/* Coordina el modo seleccionable de dos Superjefes de Maíz. */
(() => {
    let active = false;
    let hitCooldown = 0;
    const normalUpdate = update;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x &&
        a.y < b.y + b.height && a.y + a.height > b.y;

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
        updateLivesUI();
        if (lives <= 0) gameOver();
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
        if (!bosses.length) finishMode();
    }

    function finishMode() {
        active = false;
        bossBullets.length = 0;
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

    function updatePlayerShots() {
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            bullet.y -= bullet.speed;
            if (bullet.dx) bullet.x += bullet.dx;
            if (bullet.y < -30 || bullet.x < -30 || bullet.x > canvas.width + 30) {
                bullets.splice(i, 1);
                continue;
            }
            for (let j = bosses.length - 1; j >= 0; j--) {
                if (overlaps(bullet, bosses[j])) {
                    bullets.splice(i, 1);
                    damageBoss(j, bullet.damage);
                    break;
                }
            }
        }

        for (let i = homingMissiles.length - 1; i >= 0; i--) {
            const missile = homingMissiles[i];
            const target = bosses[0];
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
            for (let j = bosses.length - 1; j >= 0; j--) {
                if (overlaps(missile, bosses[j])) {
                    homingMissiles.splice(i, 1);
                    damageBoss(j, missile.damage);
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
        if (gameState !== 'PLAYING') return;
        if (hitCooldown) hitCooldown--;
        for (const star of stars) {
            star.y += star.speed;
            if (star.y > canvas.height) star.y = 0;
        }
        movePlayer();
        updatePlayerShots();
        updateBossShots();
        for (const boss of bosses) {
            if (SuperJefeMaiz.update(boss)) damagePlayer(2);
        }
    };

    window.startSuperBossMode = function () {
        window.startGame();
        active = true;
        gameState = 'PLAYING';
        previousState = 'PLAYING';
        gameRound = 4;
        nextBossScoreThreshold = Number.MAX_SAFE_INTEGER;
        score = 0;
        enemies.length = bullets.length = homingMissiles.length = bossBullets.length = bosses.length = 0;
        hitCooldown = 0;
        shieldActive = partialHit = false;
        player.x = canvas.width / 2 - player.width / 2;
        player.y = canvas.height - player.height - 20;
        document.getElementById('activeTutorialOverlay').style.display = 'none';
        bosses.push(SuperJefeMaiz.create(0), SuperJefeMaiz.create(1));
        updateScore();
    };

    // El arrastre ignora el límite inferior que usan las rondas normales.
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

    const button = document.createElement('button');
    button.className = 'btn btn-secondary';
    button.id = 'superBossModeBtn';
    button.textContent = '🌽⚡ Duelo: 2 Superjefes';
    button.addEventListener('click', window.startSuperBossMode);
    document.getElementById('startScreen').insertBefore(button, document.getElementById('openTutorialBtn'));
})();

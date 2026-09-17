/*
 * Modo QA interno. Mantener en false para la versión normal.
 * Cambiar a true solo en una compilación o publicación de pruebas.
 */
const QA_MODE = true;
window.QA_MODE = QA_MODE;

if (QA_MODE) {
    let qaBotActive = false;
    let qaFireCooldown = 0;
    let qaPurchaseCooldown = 0;

    const setHorizontalInput = (direction) => {
        keys.ArrowLeft = direction < 0;
        keys.ArrowRight = direction > 0;
        keys.KeyA = false;
        keys.KeyD = false;
    };

    const centerX = (entity) => entity.x + entity.width / 2;
    const nearestBy = (items, scoreFor) => items.reduce((best, item) =>
        !best || scoreFor(item) < scoreFor(best) ? item : best, null);

    const isNearPlayer = (entity, distance) =>
        entity.y > player.y - distance && entity.y < player.y + player.height + 45;

    // Cada compra pasa por la misma función del jugador: costos, límites y requisitos no se duplican aquí.
    const qaBuy = (type) => {
        const coinsBefore = coins;
        window.buyUpgrade(type);
        return coins !== coinsBefore || gameState === 'EVOLVING';
    };

    const qaBuyNextUpgrade = (imminentThreat, pressure) => {
        if (qaPurchaseCooldown > 0) {
            qaPurchaseCooldown--;
            return;
        }

        // Sobrevivir tiene prioridad solo cuando realmente hay peligro; así no consume las monedas de mejoras.
        const needsLife = lives <= 1 ||
            (lives <= 2 && imminentThreat) ||
            (lives <= 3 && pressure);
        if (needsLife && qaBuy('life')) {
            qaPurchaseCooldown = 24;
            return;
        }

        // Primero potencia de láser, después movilidad; al completar ambas, usa la evolución normal.
        if (upgrades.bullets < maxUpgradeLimit && qaBuy('bullets')) {
            qaPurchaseCooldown = 18;
            return;
        }
        if (upgrades.speed < maxUpgradeLimit && qaBuy('speed')) {
            qaPurchaseCooldown = 18;
            return;
        }
        if (upgrades.bullets >= maxUpgradeLimit && upgrades.speed >= maxUpgradeLimit && evolutionStage < 3 && qaBuy('evolve')) {
            qaPurchaseCooldown = 36;
            return;
        }

        // Mejoras de ronda: solo se intenta la mejora disponible. buyUpgrade conserva sus requisitos reales.
        if (upgrades.armor === 0 && (imminentThreat || gameRound >= 2) && qaBuy('armor')) {
            qaPurchaseCooldown = 24;
            return;
        }
        if (upgrades.dmgBoost === 0 && qaBuy('damage')) {
            qaPurchaseCooldown = 24;
            return;
        }
        if (upgrades.superDmgBoost === 0 && qaBuy('superDamage')) {
            qaPurchaseCooldown = 24;
        }
    };

    window.qaBotUpdate = function () {
        if (!qaBotActive) return;
        if (gameState !== 'PLAYING') {
            if (gameState === 'GAMEOVER' || gameState === 'START') qaBotActive = false;
            setHorizontalInput(0);
            return;
        }

        const playerCenter = centerX(player);
        const approachingEnemies = enemies.filter((enemy) => isNearPlayer(enemy, 285));
        const approachingBullets = bossBullets.filter((bullet) => isNearPlayer(bullet, 240));
        const imminentEnemy = nearestBy(approachingEnemies, (enemy) => player.y - enemy.y);
        const danger = nearestBy(
            approachingBullets.concat(approachingEnemies),
            (threat) => Math.abs(centerX(threat) - playerCenter) + Math.abs(threat.y - player.y)
        );
        const activeBoss = bosses.find((boss) => !boss.isDead && boss.y >= -boss.height / 2);
        // Un enemigo que ya se acerca al borde inferior pasa delante del jefe como objetivo.
        const target = imminentEnemy || activeBoss || nearestBy(enemies, (enemy) =>
            Math.abs(centerX(enemy) - playerCenter) + Math.abs(enemy.y - player.y)
        );

        let desiredX = target ? centerX(target) : canvas.width / 2;
        const directDanger = danger && Math.abs(centerX(danger) - playerCenter) < 92;
        if (directDanger) {
            desiredX = centerX(danger) <= playerCenter ? canvas.width - player.width - 38 : 38;
        }
        desiredX = Math.max(30, Math.min(canvas.width - 30, desiredX));
        const difference = desiredX - playerCenter;
        setHorizontalInput(Math.abs(difference) < 10 ? 0 : Math.sign(difference));

        const imminentThreat = !!danger && danger.y > player.y - 145;
        const pressure = approachingEnemies.length + approachingBullets.length >= 3;
        qaBuyNextUpgrade(imminentThreat, pressure);

        if (qaFireCooldown <= 0) {
            window.shootBullet();
            qaFireCooldown = 8;
        } else {
            qaFireCooldown--;
        }
        // Reserva el misil para un jefe ya visible o una amenaza que se aproxima al borde inferior.
        const urgentEnemy = imminentEnemy && imminentEnemy.y > player.y - 180;
        if (missileCooldownTimer <= 0 && (activeBoss || urgentEnemy)) {
            window.shootMissile();
        }
    };

    const panel = document.createElement('div');
    panel.id = 'qaModePanel';
    panel.style.cssText = 'position:absolute;right:8px;top:76px;z-index:150;pointer-events:auto;background:rgba(2,11,39,.88);border:1px solid #fbbf24;border-radius:10px;padding:6px;box-shadow:0 3px 10px rgba(0,0,0,.45)';
    const startButton = document.createElement('button');
    startButton.type = 'button';
    startButton.textContent = '🤖 QA: iniciar bot';
    startButton.style.cssText = 'border:0;border-radius:7px;padding:6px 8px;background:#fbbf24;color:#172033;font-weight:800;font-size:.7rem;cursor:pointer';
    startButton.addEventListener('click', () => {
        qaBotActive = true;
        qaFireCooldown = 0;
        qaPurchaseCooldown = 0;
        window.startGame();
        startButton.textContent = '🤖 QA: bot activo';
    });
    panel.appendChild(startButton);
    document.getElementById('game-container').appendChild(panel);
}

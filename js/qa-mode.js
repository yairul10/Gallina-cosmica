/*
 * Modo QA interno. Mantener en false para la versión normal.
 * Cambiar a true solo en una compilación o publicación de pruebas.
 */
const QA_MODE = true;
window.QA_MODE = QA_MODE;

if (QA_MODE) {
    let qaBotActive = false;
    let qaFireCooldown = 0;

    const setHorizontalInput = (direction) => {
        keys.ArrowLeft = direction < 0;
        keys.ArrowRight = direction > 0;
        keys.KeyA = false;
        keys.KeyD = false;
    };

    const centerX = (entity) => entity.x + entity.width / 2;
    const nearestBy = (items, scoreFor) => items.reduce((best, item) =>
        !best || scoreFor(item) < scoreFor(best) ? item : best, null);

    window.qaBotUpdate = function () {
        if (!qaBotActive) return;
        if (gameState !== 'PLAYING') {
            if (gameState === 'GAMEOVER' || gameState === 'START') qaBotActive = false;
            setHorizontalInput(0);
            return;
        }

        const playerCenter = centerX(player);
        const danger = nearestBy(
            bossBullets.filter((bullet) => bullet.y > player.y - 190 && bullet.y < player.y + player.height + 45)
                .concat(enemies.filter((enemy) => enemy.y > player.y - 160 && enemy.y < player.y + player.height + 40)),
            (threat) => Math.abs(centerX(threat) - playerCenter) + Math.abs(threat.y - player.y)
        );
        const target = bosses.find((boss) => !boss.isDead) || nearestBy(enemies, (enemy) =>
            Math.abs(centerX(enemy) - playerCenter) + Math.abs(enemy.y - player.y)
        );

        let desiredX = target ? centerX(target) : canvas.width / 2;
        if (danger && Math.abs(centerX(danger) - playerCenter) < 90) {
            desiredX = centerX(danger) <= playerCenter ? canvas.width - player.width - 38 : 38;
        }
        desiredX = Math.max(30, Math.min(canvas.width - 30, desiredX));
        const difference = desiredX - playerCenter;
        setHorizontalInput(Math.abs(difference) < 10 ? 0 : Math.sign(difference));

        if (qaFireCooldown <= 0) {
            window.shootBullet();
            qaFireCooldown = 8;
        } else {
            qaFireCooldown--;
        }
        if (missileCooldownTimer <= 0 && (target || enemies.length || bosses.length)) {
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
        window.startGame();
        startButton.textContent = '🤖 QA: bot activo';
    });
    panel.appendChild(startButton);
    document.getElementById('game-container').appendChild(panel);
}

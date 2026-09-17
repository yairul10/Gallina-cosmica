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
    let qaSeriesRunning = false;
    let qaSeriesTarget = 1;
    let qaRestartTimer = null;
    let qaCurrentMatch = null;
    const qaResults = [];

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
    const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const formatDuration = (seconds) => {
        const total = Math.max(0, Math.round(seconds));
        return `${Math.floor(total / 60)}m ${total % 60}s`;
    };

    const panel = document.createElement('div');
    panel.id = 'qaModePanel';
    panel.style.cssText = 'position:absolute;right:8px;top:76px;z-index:150;pointer-events:auto;width:min(230px,calc(100vw - 16px));max-height:calc(100vh - 92px);overflow:auto;background:rgba(2,11,39,.92);border:1px solid #fbbf24;border-radius:10px;padding:7px;box-shadow:0 3px 10px rgba(0,0,0,.45);color:#e2e8f0;font:700 11px/1.25 sans-serif';
    const title = document.createElement('div');
    title.textContent = '🤖 QA interno';
    title.style.cssText = 'color:#fbbf24;font-size:12px;margin-bottom:5px';
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;gap:4px;align-items:center;margin-bottom:5px';
    const seriesSelect = document.createElement('select');
    [1, 5, 10, 20].forEach((count) => {
        const option = document.createElement('option');
        option.value = count;
        option.textContent = `${count} partida${count === 1 ? '' : 's'}`;
        seriesSelect.appendChild(option);
    });
    seriesSelect.style.cssText = 'flex:1;border-radius:6px;border:1px solid #64748b;background:#0f172a;color:#fff;padding:5px;font-weight:700;font-size:11px';
    const startButton = document.createElement('button');
    startButton.type = 'button';
    startButton.textContent = '▶ Iniciar';
    startButton.style.cssText = 'border:0;border-radius:6px;padding:5px 7px;background:#fbbf24;color:#172033;font-weight:800;font-size:11px;cursor:pointer';
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = '■ Cancelar';
    cancelButton.style.cssText = 'border:0;border-radius:6px;padding:5px 7px;background:#ef4444;color:#fff;font-weight:800;font-size:11px;cursor:pointer';
    const status = document.createElement('div');
    status.style.cssText = 'color:#bae6fd;margin:4px 0';
    const summary = document.createElement('div');
    summary.style.cssText = 'font-weight:600;color:#cbd5e1';
    const resultList = document.createElement('div');
    resultList.style.cssText = 'margin-top:5px;font-size:10px;color:#94a3b8';
    controls.append(seriesSelect, startButton, cancelButton);
    panel.append(title, controls, status, summary, resultList);
    document.getElementById('game-container').appendChild(panel);

    const renderSummary = () => {
        const completed = qaResults.length;
        const rounds = [1, 2, 3, 4].map((round) => qaResults.filter((result) => result.maxRound >= round).length);
        if (!completed) {
            summary.textContent = 'Aún no hay resultados en esta sesión.';
            resultList.textContent = '';
            return;
        }
        const scores = qaResults.map((result) => result.score);
        summary.innerHTML = `Completadas: <b>${completed}/${qaSeriesTarget}</b><br>` +
            `Puntaje: prom. <b>${Math.round(average(scores)).toLocaleString()}</b> · máx. <b>${Math.max(...scores).toLocaleString()}</b> · mín. <b>${Math.min(...scores).toLocaleString()}</b><br>` +
            `Ronda máxima: <b>${Math.max(...qaResults.map((result) => result.maxRound))}</b> · duración prom.: <b>${formatDuration(average(qaResults.map((result) => result.duration)))}</b><br>` +
            `Vidas compradas prom.: <b>${average(qaResults.map((result) => result.livesBought)).toFixed(1)}</b> · evoluciones prom.: <b>${average(qaResults.map((result) => result.evolutions)).toFixed(1)}</b><br>` +
            `Llegaron a rondas: R1 ${rounds[0]} · R2 ${rounds[1]} · R3 ${rounds[2]} · R4 ${rounds[3]}`;
        resultList.innerHTML = qaResults.slice(-5).map((result, index) => {
            const number = completed - Math.min(5, completed) + index + 1;
            return `#${number}: ${result.score.toLocaleString()} pts · R${result.maxRound} · ${formatDuration(result.duration)} · ❤️${result.livesBought} · 🌟${result.evolutions} · 🎯${result.missiles} · 🪙${result.upgradeSpent.toLocaleString()}${result.survival ? ' · supervivencia' : ''}`;
        }).join('<br>');
    };

    const resetCurrentMatch = () => { qaCurrentMatch = { upgradeSpent: 0, missiles: 0 }; };
    const startQaMatch = () => {
        if (!qaSeriesRunning) return;
        qaBotActive = true;
        qaFireCooldown = 0;
        qaPurchaseCooldown = 0;
        resetCurrentMatch();
        window.startGame();
        status.textContent = `Jugando ${qaResults.length + 1}/${qaSeriesTarget}…`;
    };
    const cancelSeries = () => {
        qaSeriesRunning = false;
        qaBotActive = false;
        setHorizontalInput(0);
        if (qaRestartTimer) window.clearTimeout(qaRestartTimer);
        qaRestartTimer = null;
        status.textContent = `Serie cancelada: ${qaResults.length}/${qaSeriesTarget} registradas.`;
        renderSummary();
    };

    // Cada compra pasa por la misma función del jugador: costos, límites y requisitos no se duplican aquí.
    const qaBuy = (type) => {
        const coinsBefore = coins;
        window.buyUpgrade(type);
        return coins !== coinsBefore || gameState === 'EVOLVING';
    };
    const qaBuyNextUpgrade = (imminentThreat, pressure) => {
        if (qaPurchaseCooldown > 0) { qaPurchaseCooldown--; return; }
        const needsLife = lives <= 1 || (lives <= 2 && imminentThreat) || (lives <= 3 && pressure);
        if (needsLife && qaBuy('life')) { qaPurchaseCooldown = 24; return; }
        if (upgrades.bullets < maxUpgradeLimit && qaBuy('bullets')) { qaPurchaseCooldown = 18; return; }
        if (upgrades.speed < maxUpgradeLimit && qaBuy('speed')) { qaPurchaseCooldown = 18; return; }
        if (upgrades.bullets >= maxUpgradeLimit && upgrades.speed >= maxUpgradeLimit && evolutionStage < 3 && qaBuy('evolve')) { qaPurchaseCooldown = 36; return; }
        if (upgrades.armor === 0 && (imminentThreat || gameRound >= 2) && qaBuy('armor')) { qaPurchaseCooldown = 24; return; }
        if (upgrades.dmgBoost === 0 && qaBuy('damage')) { qaPurchaseCooldown = 24; return; }
        if (upgrades.superDmgBoost === 0 && qaBuy('superDamage')) qaPurchaseCooldown = 24;
    };

    window.qaBotUpdate = function () {
        if (!qaBotActive) return;
        if (gameState !== 'PLAYING') { setHorizontalInput(0); return; }
        const playerCenter = centerX(player);
        const approachingEnemies = enemies.filter((enemy) => isNearPlayer(enemy, 285));
        const approachingBullets = bossBullets.filter((bullet) => isNearPlayer(bullet, 240));
        const imminentEnemy = nearestBy(approachingEnemies, (enemy) => player.y - enemy.y);
        const danger = nearestBy(approachingBullets.concat(approachingEnemies), (threat) =>
            Math.abs(centerX(threat) - playerCenter) + Math.abs(threat.y - player.y));
        const activeBoss = bosses.find((boss) => !boss.isDead && boss.y >= -boss.height / 2);
        const target = imminentEnemy || activeBoss || nearestBy(enemies, (enemy) =>
            Math.abs(centerX(enemy) - playerCenter) + Math.abs(enemy.y - player.y));
        let desiredX = target ? centerX(target) : canvas.width / 2;
        if (danger && Math.abs(centerX(danger) - playerCenter) < 92) {
            desiredX = centerX(danger) <= playerCenter ? canvas.width - player.width - 38 : 38;
        }
        desiredX = Math.max(30, Math.min(canvas.width - 30, desiredX));
        setHorizontalInput(Math.abs(desiredX - playerCenter) < 10 ? 0 : Math.sign(desiredX - playerCenter));
        const imminentThreat = !!danger && danger.y > player.y - 145;
        qaBuyNextUpgrade(imminentThreat, approachingEnemies.length + approachingBullets.length >= 3);
        if (qaFireCooldown <= 0) { window.shootBullet(); qaFireCooldown = 8; } else qaFireCooldown--;
        const urgentEnemy = imminentEnemy && imminentEnemy.y > player.y - 180;
        if (missileCooldownTimer <= 0 && (activeBoss || urgentEnemy)) window.shootMissile();
    };

    // Los envoltorios solo existen dentro de QA y contabilizan acciones que sí fueron aceptadas por el juego.
    const originalBuyUpgrade = window.buyUpgrade;
    window.buyUpgrade = function (type) {
        const coinsBefore = coins;
        originalBuyUpgrade(type);
        const spent = Math.max(0, coinsBefore - coins);
        if (qaBotActive && qaCurrentMatch && type !== 'life') qaCurrentMatch.upgradeSpent += spent;
    };
    const originalShootMissile = window.shootMissile;
    window.shootMissile = function () {
        const missilesBefore = homingMissiles.length;
        originalShootMissile();
        if (qaBotActive && qaCurrentMatch && homingMissiles.length > missilesBefore) qaCurrentMatch.missiles++;
    };
    const originalGameOver = window.gameOver;
    window.gameOver = function () {
        originalGameOver();
        if (!qaBotActive || !qaSeriesRunning || !qaCurrentMatch) return;
        qaResults.push({
            score,
            maxRound: Math.max(gameRound, goingToRound),
            duration: gameTime,
            livesBought: sessionLivesBought,
            evolutions: evolutionStage,
            upgradeSpent: qaCurrentMatch.upgradeSpent,
            survival: gameRound >= 4 || goingToRound >= 4,
            missiles: qaCurrentMatch.missiles
        });
        qaBotActive = false;
        setHorizontalInput(0);
        renderSummary();
        if (qaResults.length >= qaSeriesTarget) {
            qaSeriesRunning = false;
            status.textContent = `Serie terminada: ${qaResults.length}/${qaSeriesTarget} partidas.`;
            return;
        }
        status.textContent = `Resultado registrado. Iniciando ${qaResults.length + 1}/${qaSeriesTarget}…`;
        qaRestartTimer = window.setTimeout(() => {
            qaRestartTimer = null;
            startQaMatch();
        }, 450);
    };

    startButton.addEventListener('click', () => {
        if (qaRestartTimer) window.clearTimeout(qaRestartTimer);
        qaResults.length = 0;
        qaSeriesTarget = Number(seriesSelect.value);
        qaSeriesRunning = true;
        renderSummary();
        startQaMatch();
    });
    cancelButton.addEventListener('click', cancelSeries);
    status.textContent = 'Selecciona una serie y presiona Iniciar.';
    renderSummary();
}

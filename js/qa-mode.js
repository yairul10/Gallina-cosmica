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
    let qaSelectedMode = 'normal';
    let qaSpeedMultiplier = 1;
    let qaSimulationElapsedMs = 0;
    let qaGameTimeFrames = 0;
    let qaMatchPlan = [];
    let qaRestartTimer = null;
    let qaCurrentMatch = null;
    const qaResults = [];
    const qaSessionAnomalies = [];
    const qaBossZeroSince = new Map();
    const qaOutsideSince = new Map();

    const setHorizontalInput = (direction) => {
        keys.ArrowLeft = direction < 0;
        keys.ArrowRight = direction > 0;
        keys.KeyA = false;
        keys.KeyD = false;
    };
    const setVerticalInput = (direction) => {
        keys.ArrowUp = direction < 0;
        keys.ArrowDown = direction > 0;
        keys.KeyW = false;
        keys.KeyS = false;
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
    const modeSelect = document.createElement('select');
    [['normal', 'Normal'], ['superboss', 'Superjefes/Hordas'], ['both', 'Ambos']].forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        modeSelect.appendChild(option);
    });
    modeSelect.style.cssText = 'width:100%;border-radius:6px;border:1px solid #64748b;background:#0f172a;color:#fff;padding:5px;font-weight:700;font-size:11px';
    const speedSelect = document.createElement('select');
    [[1, 'Velocidad x1'], [2, 'Velocidad x2'], [4, 'Velocidad x4'], [8, 'Velocidad x8 (experimental)']].forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        speedSelect.appendChild(option);
    });
    speedSelect.style.cssText = 'width:100%;margin-top:4px;border-radius:6px;border:1px solid #64748b;background:#0f172a;color:#fff;padding:5px;font-weight:700;font-size:11px';
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
    const anomalyList = document.createElement('div');
    anomalyList.style.cssText = 'margin-top:6px;padding-top:5px;border-top:1px solid #334155;font-size:10px;color:#fca5a5';
    controls.append(seriesSelect, startButton, cancelButton);
    panel.append(title, controls, status, summary, resultList, anomalyList);
    panel.insertBefore(modeSelect, status);
    panel.insertBefore(speedSelect, status);
    document.getElementById('game-container').appendChild(panel);

    const renderSummary = () => {
        const completed = qaResults.length;
        const rounds = [1, 2, 3, 4].map((round) => qaResults.filter((result) => result.maxRound >= round).length);
        const normalMatches = qaResults.filter((result) => result.mode === 'normal').length;
        const superBossMatches = qaResults.filter((result) => result.mode === 'superboss').length;
        const jsErrors = qaSessionAnomalies.filter((anomaly) => anomaly.type === 'error_javascript').length;
        const affectedMatches = new Set(qaSessionAnomalies.map((anomaly) => anomaly.match)).size;
        const renderAnomalies = () => {
            if (!qaSessionAnomalies.length) {
                anomalyList.textContent = '✓ Sin anomalías detectadas en esta serie.';
                anomalyList.style.color = '#86efac';
                return;
            }
            anomalyList.style.color = '#fca5a5';
            anomalyList.innerHTML = `⚠ Anomalías: <b>${qaSessionAnomalies.length}</b> · errores JS: <b>${jsErrors}</b> · partidas afectadas: <b>${affectedMatches}</b><br>` +
                qaSessionAnomalies.slice(-5).map((anomaly) => `P${anomaly.match} [${anomaly.mode === 'superboss' ? 'Superjefes' : 'Normal'}] — ${anomaly.description}`).join('<br>');
        };
        if (!completed) {
            summary.textContent = 'Aún no hay resultados en esta sesión.';
            resultList.textContent = '';
            renderAnomalies();
            return;
        }
        const scores = qaResults.map((result) => result.score);
        summary.innerHTML = `Completadas: <b>${completed}/${qaSeriesTarget}</b><br>` +
            `Modos: Normal <b>${normalMatches}</b> · Superjefes <b>${superBossMatches}</b><br>` +
            `Puntaje: prom. <b>${Math.round(average(scores)).toLocaleString()}</b> · máx. <b>${Math.max(...scores).toLocaleString()}</b> · mín. <b>${Math.min(...scores).toLocaleString()}</b><br>` +
            `Ronda máxima: <b>${Math.max(...qaResults.map((result) => result.maxRound))}</b> · duración prom.: <b>${formatDuration(average(qaResults.map((result) => result.duration)))}</b><br>` +
            `Vidas compradas prom.: <b>${average(qaResults.map((result) => result.livesBought)).toFixed(1)}</b> · evoluciones prom.: <b>${average(qaResults.map((result) => result.evolutions)).toFixed(1)}</b><br>` +
            `Llegaron a rondas: R1 ${rounds[0]} · R2 ${rounds[1]} · R3 ${rounds[2]} · R4 ${rounds[3]}`;
        resultList.innerHTML = qaResults.slice(-5).map((result, index) => {
            const number = completed - Math.min(5, completed) + index + 1;
            const modeLabel = result.mode === 'superboss' ? `Superjefes W${result.maxWave || 1}` : 'Normal';
            return `#${number} [${modeLabel} · x${result.speed}]: ${result.score.toLocaleString()} pts · R${result.maxRound} · ${formatDuration(result.duration)} · ❤️${result.livesBought} · 🌟${result.evolutions} · 🎯${result.missiles} · 🪙${result.upgradeSpent.toLocaleString()}${result.completedSuperBoss ? ' · victoria' : ''}${result.survival ? ' · supervivencia' : ''}`;
        }).join('<br>');
        renderAnomalies();
    };

    const qaRecordAnomaly = (type, description, relevant = {}, key = type) => {
        if (!qaSeriesRunning || !qaCurrentMatch || qaCurrentMatch.anomalyKeys.has(key)) return;
        const anomaly = {
            match: qaResults.length + 1,
            type,
            round: gameRound,
            score,
            time: gameTime,
            state: gameState,
            mode: qaCurrentMatch.mode,
            description,
            relevant
        };
        qaCurrentMatch.anomalyKeys.add(key);
        qaCurrentMatch.anomalies.push(anomaly);
        qaSessionAnomalies.push(anomaly);
        renderSummary();
    };

    const qaIsFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
    const qaCheckEntity = (entity, collection, index, now) => {
        const values = ['x', 'y', 'width', 'height'].concat(Object.prototype.hasOwnProperty.call(entity, 'hp') ? ['hp'] : []);
        if (values.some((key) => !qaIsFiniteNumber(entity[key]))) {
            qaRecordAnomaly('valor_invalido', `${collection}[${index}] tiene un valor inválido.`, { collection, index, entity }, `invalid-${collection}-${index}`);
            return;
        }
        const outside = entity.x < -220 || entity.x > canvas.width + 220 || entity.y < -220 || entity.y > canvas.height + 220;
        if (!outside) { qaOutsideSince.delete(entity); return; }
        const since = qaOutsideSince.get(entity) || now;
        qaOutsideSince.set(entity, since);
        if (now - since >= 5000) {
            qaRecordAnomaly('entidad_fuera_de_area', `${collection}[${index}] permanece fuera del área válida por más de 5 s.`, { collection, index, x: entity.x, y: entity.y }, `outside-${collection}-${index}`);
        }
    };

    const qaMonitorTick = () => {
        if (!qaBotActive || !qaSeriesRunning || !qaCurrentMatch) return;
        // Los umbrales del detector se basan en tiempo simulado, también en x2/x4/x8.
        const now = qaSimulationElapsedMs;
        const importantValues = { score, coins, lives, gameTime, gameRound, goingToRound, evolutionStage, playerX: player.x, playerY: player.y };
        if (Object.values(importantValues).some((value) => !qaIsFiniteNumber(value))) {
            qaRecordAnomaly('valor_invalido', 'Una variable importante es NaN, undefined o Infinity.', importantValues, 'invalid-important');
        }
        if (lives < 0 || lives > 10) qaRecordAnomaly('vidas_invalidas', `Vidas fuera del rango permitido: ${lives}.`, { lives }, 'invalid-lives');
        if (coins < 0) qaRecordAnomaly('monedas_negativas', `Monedas negativas: ${coins}.`, { coins }, 'negative-coins');
        if (gameRound < 1 || gameRound > 4 || goingToRound < 1 || goingToRound > 4) {
            qaRecordAnomaly('ronda_invalida', `Ronda inválida (${gameRound}/${goingToRound}).`, { gameRound, goingToRound }, 'invalid-round');
        }

        bosses.forEach((boss, index) => {
            qaCheckEntity(boss, 'jefe', index, now);
            if (!qaIsFiniteNumber(boss.hp)) return;
            if (boss.hp > 0) { qaBossZeroSince.delete(boss); return; }
            const since = qaBossZeroSince.get(boss) || now;
            qaBossZeroSince.set(boss, since);
            if (now - since >= 5000) qaRecordAnomaly('jefe_hp_invalido', `Jefe activo con HP ${boss.hp} durante más de 5 s.`, { index, hp: boss.hp, maxHp: boss.maxHp }, `boss-hp-${index}`);
        });
        enemies.forEach((entity, index) => qaCheckEntity(entity, 'enemigo', index, now));
        bullets.forEach((entity, index) => qaCheckEntity(entity, 'bala', index, now));
        homingMissiles.forEach((entity, index) => qaCheckEntity(entity, 'misil', index, now));
        bossBullets.forEach((entity, index) => qaCheckEntity(entity, 'proyectil_jefe', index, now));

        const allowedStates = ['START', 'PLAYING', 'EVOLVING', 'TRANSITION', 'PAUSED', 'GAMEOVER', 'TUTORIAL'];
        if (!allowedStates.includes(gameState)) qaRecordAnomaly('estado_invalido', `Estado principal inesperado: ${gameState}.`, { gameState }, 'invalid-state');
        const stateLimit = gameState === 'TRANSITION' ? 7000 : gameState === 'EVOLVING' ? 6000 : 0;
        if (stateLimit) {
            if (qaCurrentMatch.stateSince !== gameState) {
                qaCurrentMatch.stateSince = gameState;
                qaCurrentMatch.stateSinceAt = now;
            } else if (now - qaCurrentMatch.stateSinceAt >= stateLimit) {
                qaRecordAnomaly('transicion_bloqueada', `${gameState} supera el tiempo esperado.`, { gameState, transitionTimer, evolutionTimer }, `blocked-${gameState}`);
            }
        } else {
            qaCurrentMatch.stateSince = gameState;
            qaCurrentMatch.stateSinceAt = now;
        }

        const progress = `${score}|${gameRound}|${enemies.length}|${bosses.length}|${gameState}`;
        if (gameState === 'PLAYING') {
            if (qaCurrentMatch.lastProgress !== progress) {
                qaCurrentMatch.lastProgress = progress;
                qaCurrentMatch.lastProgressAt = now;
            } else if (now - qaCurrentMatch.lastProgressAt >= 60000) {
                qaRecordAnomaly('sin_progreso', `Posible bloqueo: 60 s sin progreso en ronda ${gameRound}.`, { score, enemies: enemies.length, bosses: bosses.length, gameState }, 'no-progress');
            }
        } else {
            qaCurrentMatch.lastProgress = progress;
            qaCurrentMatch.lastProgressAt = now;
        }
    };

    const resetCurrentMatch = (mode) => {
        qaBossZeroSince.clear();
        qaOutsideSince.clear();
        qaSimulationElapsedMs = 0;
        qaGameTimeFrames = 0;
        qaCurrentMatch = { mode, maxWave: 0, speed: qaSpeedMultiplier, upgradeSpent: 0, missiles: 0, anomalies: [], anomalyKeys: new Set(), lastProgress: null, lastProgressAt: 0, stateSince: null, stateSinceAt: 0 };
    };
    const startQaMatch = () => {
        if (!qaSeriesRunning) return;
        const mode = qaMatchPlan[qaResults.length] || 'normal';
        qaBotActive = true;
        qaFireCooldown = 0;
        qaPurchaseCooldown = 0;
        resetCurrentMatch(mode);
        if (mode === 'superboss') window.startSuperBossMode();
        else window.startGame();
        const leftovers = { enemies: enemies.length, bullets: bullets.length, missiles: homingMissiles.length, bossBullets: bossBullets.length, bosses: bosses.length };
        const normalRestartInvalid = mode === 'normal' && (gameState !== 'PLAYING' || score !== 0 || gameRound !== 1 || Object.values(leftovers).some((count) => count !== 0));
        const superRestartInvalid = mode === 'superboss' && (gameState !== 'PLAYING' || score !== 0 || gameRound !== 4 || (enemies.length + bosses.length) === 0);
        if (normalRestartInvalid || superRestartInvalid) {
            qaRecordAnomaly('reinicio_incorrecto', 'La nueva partida QA no comenzó limpia.', { gameState, score, gameRound, ...leftovers }, 'restart-not-clean');
        }
        status.textContent = `Jugando ${mode === 'superboss' ? 'Superjefes/Hordas' : 'Normal'} x${qaSpeedMultiplier} ${qaResults.length + 1}/${qaSeriesTarget}…`;
    };
    const cancelSeries = () => {
        qaSeriesRunning = false;
        qaBotActive = false;
        setHorizontalInput(0);
        setVerticalInput(0);
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

    // Reutiliza compras y requisitos del jugador, con prioridades propias de las oleadas.
    const qaBuySuperBossUpgrade = (imminentThreat, minionPressure, bossCount) => {
        if (qaPurchaseCooldown > 0) { qaPurchaseCooldown--; return; }
        const needsLife = lives <= 1 || (lives <= 2 && (imminentThreat || minionPressure)) || (lives <= 3 && bossCount >= 2 && imminentThreat);
        if (needsLife && qaBuy('life')) { qaPurchaseCooldown = 24; return; }
        if (upgrades.armor === 0 && evolutionStage >= 1 && bossCount > 0 && qaBuy('armor')) { qaPurchaseCooldown = 24; return; }
        if (upgrades.dmgBoost === 0 && evolutionStage >= 1 && bossCount > 0 && qaBuy('damage')) { qaPurchaseCooldown = 24; return; }
        if (upgrades.superDmgBoost === 0 && evolutionStage >= 1 && bossCount >= 2 && qaBuy('superDamage')) { qaPurchaseCooldown = 24; return; }
        if (upgrades.bullets < maxUpgradeLimit && qaBuy('bullets')) { qaPurchaseCooldown = 18; return; }
        if (upgrades.speed < maxUpgradeLimit && qaBuy('speed')) { qaPurchaseCooldown = 18; return; }
        if (upgrades.bullets >= maxUpgradeLimit && upgrades.speed >= maxUpgradeLimit && evolutionStage < 3 && qaBuy('evolve')) { qaPurchaseCooldown = 36; return; }
    };

    const qaBotUpdateSuperBoss = () => {
        const playerCenter = centerX(player);
        const playerCenterY = player.y + player.height / 2;
        const liveBosses = bosses.filter((boss) => !boss.isDead);
        const liveEnemies = enemies.filter((enemy) => !enemy.isDead);
        const waveLeader = liveEnemies.find((enemy) => enemy.waveLeader);
        const distanceToPlayer = (entity) => Math.hypot(centerX(entity) - playerCenter, (entity.y + entity.height / 2) - playerCenterY);
        const focusedBoss = nearestBy(liveBosses, distanceToPlayer);
        const closeEnemy = nearestBy(liveEnemies.filter((enemy) => distanceToPlayer(enemy) < 165), distanceToPlayer);
        // La oleada 1 avanza con su líder. Después, el objetivo real son los
        // superjefes; la supervivencia y el espacio libre siempre tienen prioridad.
        const phaseTarget = waveLeader || focusedBoss || closeEnemy || nearestBy(liveEnemies, distanceToPlayer);
        const margin = 46;
        const minX = margin + player.width / 2;
        const maxX = canvas.width - margin - player.width / 2;
        const minY = margin + player.height / 2;
        const maxY = canvas.height - margin - player.height / 2;
        const candidateXs = [0.22, 0.5, 0.78].map((ratio) => minX + (maxX - minX) * ratio);
        const candidateYs = [0.2, 0.5, 0.8].map((ratio) => minY + (maxY - minY) * ratio);
        const candidates = candidateXs.flatMap((x) => candidateYs.map((y) => ({ x, y })));
        const edgeDistance = (x, y) => Math.min(x - minX, maxX - x, y - minY, maxY - y);
        const scoreZone = (zone) => {
            let score = edgeDistance(zone.x, zone.y) * 4 - Math.hypot(zone.x - canvas.width / 2, zone.y - canvas.height / 2) * 0.22;
            for (const enemy of liveEnemies) {
                const distance = Math.max(18, Math.hypot(centerX(enemy) - zone.x, enemy.y + enemy.height / 2 - zone.y));
                score -= 26000 / distance;
            }
            for (const boss of liveBosses) {
                const distance = Math.max(24, Math.hypot(centerX(boss) - zone.x, boss.y + boss.height / 2 - zone.y));
                score -= 42000 / distance;
            }
            for (const bullet of bossBullets) {
                const bx = centerX(bullet);
                const by = bullet.y + bullet.height / 2;
                const vx = bullet.vx || 0;
                const vy = bullet.vy || 0;
                const velocitySq = vx * vx + vy * vy;
                const future = velocitySq ? Math.max(0, Math.min(42, ((zone.x - bx) * vx + (zone.y - by) * vy) / velocitySq)) : 0;
                const distance = Math.max(12, Math.hypot(bx + vx * future - zone.x, by + vy * future - zone.y));
                score -= 36000 / distance;
            }
            // Solo una preferencia leve de alineación: no sacrifica una zona segura por disparar.
            if (phaseTarget) score -= Math.min(75, Math.abs(centerX(phaseTarget) - zone.x) * 0.18);
            return score;
        };
        let safeZone = candidates.reduce((best, zone) => !best || scoreZone(zone) > scoreZone(best) ? zone : best, null);
        const currentEdgeDistance = edgeDistance(playerCenter, playerCenterY);
        const nearEdge = currentEdgeDistance < 26;
        const match = qaCurrentMatch;
        if (nearEdge) {
            const anchor = match.superBossEdgeAnchor;
            if (!anchor || Math.hypot(playerCenter - anchor.x, playerCenterY - anchor.y) > 22) {
                match.superBossEdgeAnchor = { x: playerCenter, y: playerCenterY, since: qaSimulationElapsedMs };
            } else if (qaSimulationElapsedMs - anchor.since >= 1200) {
                // Anti-atasco: tras 1.2 s pegado al mismo borde/corner, fuerza la
                // ruta hacia la mejor zona interior en vez de seguir al objetivo.
                safeZone = candidates.filter((zone) => edgeDistance(zone.x, zone.y) > 50)
                    .reduce((best, zone) => !best || scoreZone(zone) > scoreZone(best) ? zone : best, safeZone);
            }
        } else {
            match.superBossEdgeAnchor = null;
        }

        const desiredX = safeZone.x - player.width / 2;
        const desiredY = safeZone.y - player.height / 2;
        setHorizontalInput(Math.abs(desiredX - player.x) < 8 ? 0 : Math.sign(desiredX - player.x));
        setVerticalInput(Math.abs(desiredY - player.y) < 8 ? 0 : Math.sign(desiredY - player.y));

        const imminentThreat = !!closeEnemy || bossBullets.some((bullet) => Math.hypot(centerX(bullet) - playerCenter, bullet.y + bullet.height / 2 - playerCenterY) < 145);
        qaBuySuperBossUpgrade(imminentThreat, !!closeEnemy, liveBosses.length);
        if (qaFireCooldown <= 0) { window.shootBullet(); qaFireCooldown = 8; } else qaFireCooldown--;
        const targetAligned = phaseTarget && Math.abs(centerX(phaseTarget) - playerCenter) < 135 && distanceToPlayer(phaseTarget) < 440;
        if (missileCooldownTimer <= 0 && (closeEnemy || targetAligned)) window.shootMissile();
    };

    window.qaBotUpdate = function () {
        if (!qaBotActive) return;
        if (gameState !== 'PLAYING') { setHorizontalInput(0); return; }
        if (qaCurrentMatch && qaCurrentMatch.mode === 'superboss') {
            qaBotUpdateSuperBoss();
            return;
        }
        // La estrategia normal conserva su movimiento exclusivamente horizontal.
        setVerticalInput(0);
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
    const completeQaMatch = (completedSuperBoss = false) => {
        if (!qaBotActive || !qaSeriesRunning || !qaCurrentMatch) return;
        qaResults.push({
            mode: qaCurrentMatch.mode,
            speed: qaCurrentMatch.speed,
            score,
            maxRound: Math.max(gameRound, goingToRound),
            maxWave: qaCurrentMatch.maxWave,
            duration: gameTime,
            livesBought: sessionLivesBought,
            evolutions: evolutionStage,
            upgradeSpent: qaCurrentMatch.upgradeSpent,
            survival: gameRound >= 4 || goingToRound >= 4,
            missiles: qaCurrentMatch.missiles,
            completedSuperBoss
        });
        qaBotActive = false;
        setHorizontalInput(0);
        setVerticalInput(0);
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
    const originalGameOver = window.gameOver;
    window.gameOver = function () {
        originalGameOver();
        completeQaMatch(false);
    };
    window.qaBotOnSuperBossWaveStart = function (wave) {
        if (qaBotActive && qaCurrentMatch && qaCurrentMatch.mode === 'superboss') {
            qaCurrentMatch.maxWave = Math.max(qaCurrentMatch.maxWave, wave);
        }
    };
    window.qaBotOnSuperBossComplete = function (wave) {
        if (qaCurrentMatch && qaCurrentMatch.mode === 'superboss') {
            qaCurrentMatch.maxWave = Math.max(qaCurrentMatch.maxWave, wave);
        }
        completeQaMatch(true);
    };

    window.addEventListener('error', (event) => {
        const message = event && event.message ? event.message : 'Error JavaScript sin mensaje.';
        qaRecordAnomaly('error_javascript', `Error JS: ${message}`, { message, source: event && event.filename, line: event && event.lineno }, `js-error-${message}`);
    });
    window.addEventListener('unhandledrejection', (event) => {
        const reason = event && event.reason;
        const message = reason && reason.message ? reason.message : String(reason || 'Promesa rechazada sin detalle.');
        qaRecordAnomaly('error_javascript', `Promesa no controlada: ${message}`, { message }, `promise-error-${message}`);
    });
    // Interfaces públicas consumidas por el bucle central. No existen cuando QA_MODE es false.
    window.qaIsSimulationClockActive = () => qaBotActive && qaSeriesRunning;
    window.qaGetSimulationSteps = () => qaBotActive && qaSeriesRunning ? qaSpeedMultiplier : 1;
    window.qaOnSimulationStep = () => {
        if (!qaBotActive || !qaSeriesRunning) return;
        // El reloj de anomalías también avanza durante transición/evolución; así conserva sus límites reales.
        if (gameState === 'PLAYING' || gameState === 'TRANSITION' || gameState === 'EVOLVING') qaSimulationElapsedMs += 1000 / 60;
        // El tiempo de partida se comporta igual que antes: solo avanza mientras se juega.
        if (gameState !== 'PLAYING') return;
        qaGameTimeFrames++;
        if (qaGameTimeFrames >= 60) {
            const seconds = Math.floor(qaGameTimeFrames / 60);
            qaGameTimeFrames -= seconds * 60;
            for (let second = 0; second < seconds; second++) {
                gameTime++;
                sessionTimeNoHit++;
                if (sessionTimeNoHit >= 100) unlockAchievement('a13');
                if (gameTime >= 300) unlockAchievement('a14');
            }
        }
    };
    window.setInterval(qaMonitorTick, 250);

    startButton.addEventListener('click', () => {
        if (qaRestartTimer) window.clearTimeout(qaRestartTimer);
        qaResults.length = 0;
        qaSessionAnomalies.length = 0;
        qaSelectedMode = modeSelect.value;
        qaSpeedMultiplier = Number(speedSelect.value);
        const gamesPerMode = Number(seriesSelect.value);
        qaMatchPlan = qaSelectedMode === 'both'
            ? Array(gamesPerMode).fill('normal').concat(Array(gamesPerMode).fill('superboss'))
            : Array(gamesPerMode).fill(qaSelectedMode);
        qaSeriesTarget = qaMatchPlan.length;
        qaSeriesRunning = true;
        renderSummary();
        startQaMatch();
    });
    cancelButton.addEventListener('click', cancelSeries);
    status.textContent = 'Selecciona una serie y presiona Iniciar.';
    renderSummary();
}

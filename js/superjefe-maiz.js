/* Comportamiento reutilizable de un Superjefe de Maíz. */
(() => {
    const PADDING = 12;
    const TELEPORT_FRAMES = 300; // 5 segundos a 60 FPS.
    const SHOT_FRAMES = 72;

    function clamp(value, minimum, maximum) {
        return Math.max(minimum, Math.min(maximum, value));
    }

    function overlapsPlayer(boss) {
        return player.x < boss.x + boss.width && player.x + player.width > boss.x &&
            player.y < boss.y + boss.height && player.y + player.height > boss.y;
    }

    function randomPosition(boss) {
        let attempts = 0;
        do {
            boss.x = PADDING + Math.random() * (canvas.width - boss.width - PADDING * 2);
            boss.y = PADDING + Math.random() * (canvas.height - boss.height - PADDING * 2);
            attempts++;
        } while (attempts < 12 && Math.hypot(
            boss.x + boss.width / 2 - (player.x + player.width / 2),
            boss.y + boss.height / 2 - (player.y + player.height / 2)
        ) < 150);
    }

    function fireAtPlayer(boss) {
        const originX = boss.x + boss.width / 2;
        const originY = boss.y + boss.height / 2;
        const targetX = player.x + player.width / 2;
        const targetY = player.y + player.height / 2;
        const angle = Math.atan2(targetY - originY, targetX - originX);
        const speed = 5.7;

        bossBullets.push({
            x: originX - 8,
            y: originY - 8,
            width: 16,
            height: 16,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            damage: 1,
            isLechugaBala: false
        });
    }

    function create(index, type = 'corn') {
        const isLettuce = type === 'lechuga';
        const boss = {
            x: 0,
            y: 0,
            // Más pequeños para conservar espacio de maniobra en el duelo.
            width: isLettuce ? 100 : 92,
            height: isLettuce ? 80 : 74,
            maxHp: isLettuce ? 3600 : 2600,
            hp: isLettuce ? 3600 : 2600,
            // Más lentos que los jefes de las rondas normales.
            speed: isLettuce ? 0.74 : 0.88 + index * 0.08,
            type,
            isSuperBoss: true,
            shootCooldown: 35 + index * 40,
            teleportCooldown: index * 150
        };
        randomPosition(boss);
        return boss;
    }

    // Devuelve true cuando el jefe toca la nave; el modo decide cuánto daño aplicar.
    function update(boss) {
        const targetX = player.x + player.width / 2;
        const targetY = player.y + player.height / 2;
        const dx = targetX - (boss.x + boss.width / 2);
        const dy = targetY - (boss.y + boss.height / 2);
        const distance = Math.max(1, Math.hypot(dx, dy));

        boss.x += (dx / distance) * boss.speed;
        boss.y += (dy / distance) * boss.speed;
        boss.x = clamp(boss.x, PADDING, canvas.width - boss.width - PADDING);
        boss.y = clamp(boss.y, PADDING, canvas.height - boss.height - PADDING);

        boss.shootCooldown++;
        if (boss.shootCooldown >= SHOT_FRAMES) {
            boss.shootCooldown = 0;
            fireAtPlayer(boss);
        }

        boss.teleportCooldown++;
        if (boss.teleportCooldown >= TELEPORT_FRAMES) {
            boss.teleportCooldown = 0;
            randomPosition(boss);
        }

        return overlapsPlayer(boss);
    }

    window.SuperJefeMaiz = { create, update };
})();

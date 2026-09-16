function drawBoss(boss) {
    ctx.save();
    // Aplicar la opacidad suave de aparición o desvanecimiento
    ctx.globalAlpha = typeof boss.alpha !== 'undefined' ? boss.alpha : 1.0;

    let imgBoss = boss.type === 'lechuga' ? assets.jefeLechuga : assets.jefeMaiz;
    if (boss.isSuperBoss) {
        imgBoss = boss.type === 'lechuga' ? assets.superJefeLechuga : assets.superJefeMaiz;
    }

    if (imgBoss && imgBoss.complete && imgBoss.naturalWidth > 0) {
        ctx.drawImage(imgBoss, boss.x, boss.y, boss.width, boss.height);
    } else {
        ctx.fillStyle = boss.type === 'lechuga' ? '#22c55e' : '#eab308';
        ctx.fillRect(boss.x, boss.y, boss.width, boss.height);
    }

    // Barra de vida del jefe
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(boss.x, boss.y - 10, boss.width, 6);
    ctx.fillStyle = boss.type === 'lechuga' ? '#22c55e' : '#ef4444';
    ctx.fillRect(boss.x, boss.y - 10, boss.width * Math.max(0, boss.hp / boss.maxHp), 6);
    
    ctx.restore();
}

function drawEnemy(e) {
    ctx.save();
    // Aplicar la opacidad suave de aparición o desvanecimiento para súbditos
    ctx.globalAlpha = typeof e.alpha !== 'undefined' ? e.alpha : 1.0;

    let imgE = assets.enemigoMaiz;
    if (e.type === 'corn_strong') imgE = assets.cornStrong || assets.enemigoMaiz;
    else if (e.type === 'lechuga') imgE = assets.enemigoLechuga;
    else if (e.type === 'lechuga_fuerte') imgE = assets.lechugaFuerte || assets.enemigoLechuga;
    else if (e.type === 'maiz_jefe') imgE = assets.jefeMaiz;
    else if (e.type === 'lechuga_jefe') imgE = assets.jefeLechuga;

    if (imgE && imgE.complete && imgE.naturalWidth > 0) {
        ctx.drawImage(imgE, e.x, e.y, e.width, e.height);
    } else {
        ctx.fillStyle = e.type.includes('lechuga') ? '#10b981' : '#f59e0b';
        ctx.fillRect(e.x, e.y, e.width, e.height);
    }

    if (e.maxHp && e.maxHp > 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(e.x, e.y - 6, e.width, 4);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(e.x, e.y - 6, e.width * Math.max(0, e.hp / e.maxHp), 4);
    }

    ctx.restore();
}

import { canvas, player, upgrades, evolutionStage, gameStats, currentMatchBooster, bullets, homingMissiles, missileCooldownTimer, setMissileCooldownTimer, bosses, enemies } from './config.js';

export function shootBullet() {
    let bulletCount = Math.min((evolutionStage === 3) ? 4 : 3, upgrades.bullets + 1);
    let baseDmg = upgrades.bullets === 0 ? 1 : upgrades.bullets;
    
    let bonusPro = gameStats.equippedSkins[evolutionStage] ? 0.30 : 0;
    baseDmg = baseDmg + (baseDmg * bonusPro);
    
    let finalDamage = (upgrades.dmgBoost > 0 ? baseDmg * 1.5 : baseDmg) * currentMatchBooster;
    if (upgrades.superDmgBoost > 0) finalDamage *= 1.5; 
    
    const patterns = { 
        1: [{ dx: 0, offX: player.width / 2 - 2, offY: -10 }], 
        2: [{ dx: 0, offX: 8, offY: -10 }, { dx: 0, offX: player.width - 12, offY: -10 }], 
        3: [{ dx: -1.2, offX: 4, offY: -10 }, { dx: 0, offX: player.width / 2 - 2, offY: -14 }, { dx: 1.2, offX: player.width - 8, offY: -10 }], 
        4: [{ dx: -2.0, offX: 2, offY: -8 }, { dx: -0.6, offX: 12, offY: -14 }, { dx: 0.6, offX: player.width - 16, offY: -14 }, { dx: 2.0, offX: player.width - 6, offY: -8 }] 
    };
    for (let p of (patterns[bulletCount] || patterns[3])) { 
        bullets.push({ x: player.x + p.offX, y: player.y + p.offY, width: 4, height: 20, speed: 14, dx: p.dx, type: 'laser', damage: finalDamage }); 
    }
}

export function shootMissile() {
    if (missileCooldownTimer > 0) return;
    
    let bType = 'chick'; if (evolutionStage === 1) bType = 'wool'; if (evolutionStage === 2) bType = 'horseshoe'; if (evolutionStage === 3) bType = 'milk';
    
    let bulletCount = evolutionStage + 1;
    if (bulletCount > 4) bulletCount = 4;
    
    let baseDmg = (upgrades.bullets === 0 ? 1 : upgrades.bullets) * 15;
    let bonusPro = gameStats.equippedMissiles[evolutionStage] ? 0.20 : 0;
    baseDmg = baseDmg + (baseDmg * bonusPro);
    
    let finalDamage = (upgrades.dmgBoost > 0 ? baseDmg * 1.5 : baseDmg) * currentMatchBooster;
    if (upgrades.superDmgBoost > 0) finalDamage *= 1.5; 
    
    const patterns = {
        1: [{ dx: 0, offX: player.width / 2 - 12, offY: -10 }],
        2: [{ dx: -2, offX: 0, offY: -10 }, { dx: 2, offX: player.width - 24, offY: -10 }],
        3: [{ dx: -3, offX: -5, offY: -10 }, { dx: 0, offX: player.width / 2 - 12, offY: -14 }, { dx: 3, offX: player.width - 19, offY: -10 }],
        4: [{ dx: -4, offX: -10, offY: -8 }, { dx: -1.5, offX: 5, offY: -14 }, { dx: 1.5, offX: player.width - 29, offY: -14 }, { dx: 4, offX: player.width - 14, offY: -8 }]
    };

    for (let p of (patterns[bulletCount] || patterns[3])) {
        homingMissiles.push({ 
            x: player.x + p.offX, y: player.y + p.offY, 
            width: 24, height: 24, speed: 7.5, vx: p.dx, vy: -5, 
            type: bType, damage: finalDamage, isPro: gameStats.equippedMissiles[evolutionStage] 
        });
    }
    
    setMissileCooldownTimer(480);
}
 

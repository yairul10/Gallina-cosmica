const assets = {
    fondoGalaxia: new Image(), fondoRonda2: new Image(), fondoRonda3: new Image(),
    balaPollito: new Image(), balaPollitoPro: new Image(), balaLana: new Image(), balaLanaPro: new Image(),
    balaHerradura: new Image(), balaHerraduraPro: new Image(), balaLeche: new Image(), balaLechePro: new Image(),
    maiz: new Image(), maizFuerte: new Image(), jefeMaiz: new Image(), superJefeMaiz: new Image(),
    lechuga: new Image(), lechugaFuerte: new Image(), jefeLechuga: new Image(), superJefeLechuga: new Image(), balaJefe: new Image(), balaLechuga: new Image(),
    trofeoPollito: new Image(), trofeoLana: new Image(), trofeoHerradura: new Image(), trofeoLeche: new Image(), trofeoDiamante: new Image(),
    ships: []
};

assets.fondoGalaxia.src = 'assets/fondo_galaxia.png'; 
assets.fondoRonda2.src = 'assets/fondo_ronda2.png'; 
assets.fondoRonda3.src = 'assets/fondo_ronda3.png';

const animalDirs = ['gallina', 'oveja', 'caballo', 'vaca'];
for(let i=0; i<4; i++) {
    let normalSkins = []; let proSkins = [];
    for(let j=1; j<=4; j++) {
        let imgN = new Image(); imgN.src = `assets/${animalDirs[i]}_${j}.png`;
        let imgP = new Image(); imgP.src = `assets/${animalDirs[i]}_pro_${j}.png`;
        normalSkins.push(imgN);
        proSkins.push(imgP);
    }
    assets.ships.push([normalSkins, proSkins]); 
}

assets.balaPollito.src = 'assets/bala_pollito.png'; assets.balaPollitoPro.src = 'assets/bala_pollito_pro.png';
assets.balaLana.src = 'assets/bala_lana.png'; assets.balaLanaPro.src = 'assets/bala_lana_pro.png';
assets.balaHerradura.src = 'assets/bala_herradura.png'; assets.balaHerraduraPro.src = 'assets/bala_herradura_pro.png';
assets.balaLeche.src = 'assets/bala_leche.png'; assets.balaLechePro.src = 'assets/bala_leche_pro.png';

assets.maiz.src = 'assets/maiz.png'; assets.maizFuerte.src = 'assets/maiz_fuerte.png';
assets.jefeMaiz.src = 'assets/jefe_maiz.png'; assets.superJefeMaiz.src = 'assets/super_jefe_maiz.png';

// CORRECCIÓN DE NOMBRES Y CACHÉ
assets.lechuga.src = 'assets/lechuga.png'; 
assets.lechugaFuerte.src = 'assets/lechuga_fuerte.png?v=2'; 
assets.jefeLechuga.src = 'assets/lechuga_jefe.png?v=2'; 
assets.superJefeLechuga.src = 'assets/super_jefe_lechuga.png';

assets.balaJefe.src = 'assets/bala_jefe.png'; assets.balaLechuga.src = 'assets/bala_lechuga.png';
assets.trofeoPollito.src = 'assets/trofeo_pollito.png'; assets.trofeoLana.src = 'assets/trofeo_lana.png';
assets.trofeoHerradura.src = 'assets/trofeo_herradura.png'; assets.trofeoLeche.src = 'assets/trofeo_leche.png'; assets.trofeoDiamante.src = 'assets/trofeo_diamante.png';

const bgMusic = new Audio('assets/bg_music.mp3'); bgMusic.loop = true; bgMusic.volume = 0.4;

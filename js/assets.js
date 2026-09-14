const assets = {
    fondoGalaxia: new Image(), fondoRonda2: new Image(), fondoRonda3: new Image(),
    gallina: new Image(), gallinaPro: new Image(), oveja: new Image(), ovejaPro: new Image(),
    caballo: new Image(), caballoPro: new Image(), vaca: new Image(), vacaPro: new Image(),
    balaPollito: new Image(), balaPollitoPro: new Image(), balaLana: new Image(), balaLanaPro: new Image(),
    balaHerradura: new Image(), balaHerraduraPro: new Image(), balaLeche: new Image(), balaLechePro: new Image(),
    maiz: new Image(), maizFuerte: new Image(), jefeMaiz: new Image(), superJefeMaiz: new Image(),
    lechuga: new Image(), lechugaFuerte: new Image(), jefeLechuga: new Image(), superJefeLechuga: new Image(), balaJefe: new Image(), balaLechuga: new Image(),
    trofeoPollito: new Image(), trofeoLana: new Image(), trofeoHerradura: new Image(), trofeoLeche: new Image(), trofeoDiamante: new Image()
};

assets.fondoGalaxia.src = 'assets/fondo_galaxia.png'; 
assets.fondoRonda2.src = 'assets/fondo_ronda2.png'; 
assets.fondoRonda3.src = 'assets/fondo_ronda3.png'; // <- NUEVO FONDO

assets.gallina.src = 'assets/gallina.png'; assets.gallinaPro.src = 'assets/gallina_pro.png';
assets.oveja.src = 'assets/oveja.png'; assets.ovejaPro.src = 'assets/oveja_pro.png';
assets.caballo.src = 'assets/caballo.png'; assets.caballoPro.src = 'assets/caballo_pro.png';
assets.vaca.src = 'assets/vaca.png'; assets.vacaPro.src = 'assets/vaca_pro.png';
assets.balaPollito.src = 'assets/bala_pollito.png'; assets.balaPollitoPro.src = 'assets/bala_pollito_pro.png';
assets.balaLana.src = 'assets/bala_lana.png'; assets.balaLanaPro.src = 'assets/bala_lana_pro.png';
assets.balaHerradura.src = 'assets/bala_herradura.png'; assets.balaHerraduraPro.src = 'assets/bala_herradura_pro.png';
assets.balaLeche.src = 'assets/bala_leche.png'; assets.balaLechePro.src = 'assets/bala_leche_pro.png';
assets.maiz.src = 'assets/maiz.png'; assets.maizFuerte.src = 'assets/maiz_fuerte.png';
assets.jefeMaiz.src = 'assets/jefe_maiz.png'; assets.superJefeMaiz.src = 'assets/super_jefe_maiz.png';
assets.lechuga.src = 'assets/lechuga.png'; assets.lechugaFuerte.src = 'assets/lechuga_fuerte.png';
assets.jefeLechuga.src = 'assets/jefe_lechuga.png'; assets.superJefeLechuga.src = 'assets/super_jefe_lechuga.png';
assets.balaJefe.src = 'assets/bala_jefe.png'; assets.balaLechuga.src = 'assets/bala_lechuga.png';
assets.trofeoPollito.src = 'assets/trofeo_pollito.png'; assets.trofeoLana.src = 'assets/trofeo_lana.png';
assets.trofeoHerradura.src = 'assets/trofeo_herradura.png'; assets.trofeoLeche.src = 'assets/trofeo_leche.png'; assets.trofeoDiamante.src = 'assets/trofeo_diamante.png';

const bgMusic = new Audio('assets/bg_music.mp3'); bgMusic.loop = true; bgMusic.volume = 0.4;

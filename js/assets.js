const playlist = ['assets/musica_1.mp3', 'assets/musica_2.mp3', 'assets/musica_3.mp3'];
let currentTrackIndex = 0; 
const bgMusic = new Audio(playlist[currentTrackIndex]); 
bgMusic.volume = 0.4; 

bgMusic.addEventListener('ended', () => { 
    currentTrackIndex++; 
    if (currentTrackIndex >= playlist.length) currentTrackIndex = 0; 
    bgMusic.src = playlist[currentTrackIndex]; 
    bgMusic.play().catch(e => console.log(e)); 
});

const assets = { 
    fondoGalaxia: new Image(),
    fondoRonda2: new Image(),
    gallina: new Image(), oveja: new Image(), caballo: new Image(), vaca: new Image(), 
    gallinaPro: new Image(), ovejaPro: new Image(), caballoPro: new Image(), vacaPro: new Image(),
    maiz: new Image(), maizFuerte: new Image(), jefeMaiz: new Image(), superJefeMaiz: new Image(),
    lechuga: new Image(), lechugaFuerte: new Image(), jefeLechuga: new Image(), superJefeLechuga: new Image(),
    balaPollito: new Image(), balaLana: new Image(), balaHerradura: new Image(), balaLeche: new Image(),
    balaPollitoPro: new Image(), balaLanaPro: new Image(), balaHerraduraPro: new Image(), balaLechePro: new Image(),
    balaJefe: new Image(), balaLechuga: new Image(),
    trofeoPollito: new Image(), trofeoLana: new Image(), trofeoHerradura: new Image(), trofeoLeche: new Image(), trofeoDiamante: new Image()
};

assets.fondoGalaxia.src = 'assets/fondo_galaxia.png';
assets.fondoRonda2.src = 'assets/fondo_ronda2.png';
assets.gallina.src = 'assets/gallina.png'; assets.oveja.src = 'assets/oveja.png'; assets.caballo.src = 'assets/caballo.png'; assets.vaca.src = 'assets/vaca.png'; 
assets.gallinaPro.src = 'assets/gallina_pro.png'; assets.ovejaPro.src = 'assets/oveja_pro.png'; assets.caballoPro.src = 'assets/caballo_pro.png'; assets.vacaPro.src = 'assets/vaca_pro.png'; 
assets.maiz.src = 'assets/maiz.png'; assets.maizFuerte.src = 'assets/maiz_fuerte.png'; assets.jefeMaiz.src = 'assets/jefe_maiz.png'; assets.superJefeMaiz.src = 'assets/super_jefe_maiz.png';
assets.lechuga.src = 'assets/lechuga.png'; assets.lechugaFuerte.src = 'assets/lechuga_fuerte.png'; assets.jefeLechuga.src = 'assets/lechuga_jefe.png'; assets.superJefeLechuga.src = 'assets/super_jefe_lechuga.png';
assets.balaPollito.src = 'assets/bala_pollito.png'; assets.balaLana.src = 'assets/bala_lana.png'; assets.balaHerradura.src = 'assets/bala_herradura.png'; assets.balaLeche.src = 'assets/bala_leche.png';
assets.balaPollitoPro.src = 'assets/bala_pollito_pro.png'; assets.balaLanaPro.src = 'assets/bala_lana_pro.png'; assets.balaHerraduraPro.src = 'assets/bala_herradura_pro.png'; assets.balaLechePro.src = 'assets/bala_leche_pro.png';
assets.balaJefe.src = 'assets/bala_jefe.png'; assets.balaLechuga.src = 'assets/bala_lechuga.png';
assets.trofeoPollito.src = 'assets/trofeo_pollito.png'; assets.trofeoLana.src = 'assets/trofeo_lana.png'; assets.trofeoHerradura.src = 'assets/trofeo_herradura.png'; assets.trofeoLeche.src = 'assets/trofeo_leche.png'; assets.trofeoDiamante.src = 'assets/trofeo_diamante.png';

(()=>{
'use strict';
const TEST_REWARDED_ID='ca-app-pub-3940256099942544/5224354917';
let initialized=false,busy=false,rewarded=false;
const plugin=()=>window.Capacitor?.Plugins?.AdMob||null;
async function init(){
 const ad=plugin(); if(!ad)return false;
 if(initialized)return true;
 try{await ad.initialize({initializeForTesting:true});initialized=true;return true;}
 catch(e){console.warn('[AdMob TEST] init',e);return false;}
}
async function showReviveAd(onReward,status){
 if(busy)return false;busy=true;rewarded=false;
 const ad=plugin();
 if(!ad){status?.('Los anuncios de prueba solo están disponibles en la app Android.');busy=false;return false;}
 try{
   if(!await init())throw new Error('No se pudo iniciar AdMob');
   status?.('📺 Cargando anuncio de prueba…');
   let rewardHandle=null,dismissHandle=null,failHandle=null;
   const cleanup=async()=>{for(const h of [rewardHandle,dismissHandle,failHandle])try{await h?.remove?.()}catch(_){}};
   rewardHandle=await ad.addListener('onRewardedVideoAdReward',async()=>{
     if(rewarded)return;rewarded=true;status?.('✅ Recompensa obtenida. Reviviendo…');
     try{onReward?.();}finally{await cleanup();busy=false;}
   });
   dismissHandle=await ad.addListener('onRewardedVideoAdDismissed',async()=>{
     setTimeout(async()=>{if(!rewarded){status?.('Anuncio cerrado antes de obtener la recompensa.');await cleanup();busy=false;}},250);
   });
   failHandle=await ad.addListener('onRewardedVideoAdFailedToShow',async()=>{
     status?.('No se pudo mostrar el anuncio. Intenta nuevamente.');await cleanup();busy=false;
   });
   await ad.prepareRewardVideoAd({adId:TEST_REWARDED_ID,isTesting:true});
   status?.('📺 Anuncio listo…');
   // No usamos la resolución de show como recompensa: solo el evento Rewarded concede el revive.
   ad.showRewardVideoAd().catch(async e=>{console.warn('[AdMob TEST] show',e);if(!rewarded){status?.('No se pudo completar el anuncio.');await cleanup();busy=false;}});
   return true;
 }catch(e){console.warn('[AdMob TEST]',e);status?.('No se pudo cargar el anuncio de prueba.');busy=false;return false;}
}
window.GallinaAds={init,showReviveAd,isTestMode:true};
})();
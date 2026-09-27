/* Google Play Billing: paquete consumible de 500.000 monedas. */
(() => {
  const PRODUCT_ID='monedas_500000', AMOUNT=500000;
  const plugin=()=>window.Capacitor?.Plugins?.GallinaBilling;
  const status=(t)=>{const e=document.getElementById('playCoinsStatus');if(e)e.textContent=t||'';};
  async function buy500k(){
    const btn=document.getElementById('buyPlayCoins500k');
    if(btn?.disabled)return;
    if(!plugin()){status('Disponible en la app Android instalada desde Google Play.');return;}
    if(btn){btn.disabled=true;btn.style.opacity='.65';}
    status('Conectando con Google Play…');
    try{
      const r=await plugin().buy({productId:PRODUCT_ID});
      if(!r?.purchaseToken) throw new Error('Compra sin token');
      const applied=window.gallinaApplyPlayCoinPurchase?.(r.purchaseToken,AMOUNT);
      if(!applied?.success) throw new Error('No se pudo guardar la recompensa');
      status(applied.alreadyApplied?'Esta compra ya había sido acreditada.':'✅ ¡500.000 monedas recibidas!');
      // Consumir solo después de guardar la recompensa local/cloud.
      await plugin().consume({purchaseToken:r.purchaseToken});
    }catch(e){
      const msg=String(e?.message||e||'');
      status(/cancel/i.test(msg)?'Compra cancelada.':'No se completó la compra. Inténtalo nuevamente.');
      console.warn('[Billing]',e);
    }finally{if(btn){btn.disabled=false;btn.style.opacity='1';}}
  }
  window.GallinaBilling={buy500k};
})();

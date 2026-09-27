/* Google Play Billing: paquetes consumibles de monedas. */
(() => {
  const PRODUCTS = {
    monedas_500000:   { amount:500000,   label:'500.000' },
    monedas_1000000:  { amount:1000000,  label:'1.000.000' },
    monedas_5000000:  { amount:5000000,  label:'5.000.000' },
    monedas_15000000: { amount:15000000, label:'15.000.000' },
    monedas_50000000: { amount:50000000, label:'50.000.000', cosmetic:'fantasma' }
  };
  const plugin=()=>window.Capacitor?.Plugins?.GallinaBilling;
  const status=(t)=>{const e=document.getElementById('playCoinsStatus');if(e)e.textContent=t||'';};
  const button=(id)=>document.querySelector('[data-play-product="'+id+'"]');
  const setBusy=(id,busy)=>{const b=button(id);if(b){b.disabled=busy;b.style.opacity=busy?'.65':'1';}};

  function applyPurchase(productId, token){
    const item=PRODUCTS[productId];
    if(!item) return {success:false};
    const applied=window.gallinaApplyPlayCoinPurchase?.(token,item.amount);
    if(!applied?.success) return applied;
    if(item.cosmetic){
      window.gallinaApplyPvpCosmeticReward?.(token+':cosmetic',item.cosmetic);
    }
    return applied;
  }

  async function consumeAfterReward(token){
    await plugin().consume({purchaseToken:token});
  }

  async function buy(productId){
    const item=PRODUCTS[productId];
    if(!item || button(productId)?.disabled)return;
    if(!plugin()){status('Disponible en la app Android instalada desde Google Play.');return;}
    setBusy(productId,true);
    status('Conectando con Google Play…');
    try{
      const r=await plugin().buy({productId});
      if(!r?.purchaseToken) throw new Error('Compra sin token');
      const returned=Array.isArray(r.products)?r.products:[];
      if(returned.length && !returned.includes(productId)) throw new Error('El producto devuelto no coincide');
      const applied=applyPurchase(productId,r.purchaseToken);
      if(!applied?.success) throw new Error('No se pudo guardar la recompensa');
      status(applied.alreadyApplied?'Esta compra ya había sido acreditada.':('✅ ¡'+item.label+' monedas recibidas!'+(item.cosmetic?' 👻 Diseño Fantasma desbloqueado.':'')));
      await consumeAfterReward(r.purchaseToken);
    }catch(e){
      const msg=String(e?.message||e||'');
      status(/cancel/i.test(msg)?'Compra cancelada.':'No se completó la compra. Inténtalo nuevamente.');
      console.warn('[Billing]',e);
    }finally{setBusy(productId,false);}
  }

  async function loadPrices(){
    if(!plugin()?.getProducts)return;
    try{
      const r=await plugin().getProducts({productIds:Object.keys(PRODUCTS)});
      (r?.products||[]).forEach(p=>{
        const el=document.querySelector('[data-play-price="'+p.productId+'"]');
        if(el && p.formattedPrice) el.textContent=p.formattedPrice;
      });
    }catch(e){console.warn('[Billing prices]',e);}
  }

  // Recupera compras PURCHASED que Google Play conserve sin consumir, por ejemplo
  // si la app se cerró entre la aprobación, la entrega y el consume().
  async function recoverPurchases(){
    if(!plugin()?.getPurchases)return;
    try{
      const r=await plugin().getPurchases();
      for(const p of (r?.purchases||[])){
        const productId=(p.products||[]).find(id=>PRODUCTS[id]);
        if(!productId || !p.purchaseToken)continue;
        const applied=applyPurchase(productId,p.purchaseToken);
        if(applied?.success) await consumeAfterReward(p.purchaseToken);
      }
    }catch(e){console.warn('[Billing recovery]',e);}
  }

  async function init(){
    await loadPrices();
    await recoverPurchases();
  }
  window.GallinaBilling={buy,loadPrices,recoverPurchases,init,products:PRODUCTS};
  window.addEventListener('load',()=>setTimeout(init,900),{once:true});
})();

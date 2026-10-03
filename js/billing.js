/* Google Play Billing: paquetes consumibles de monedas. */
(() => {
  const PRODUCTS = {
    monedas_500000:   { amount:500000,   label:'500.000' },
    monedas_1000000:  { amount:1000000,  label:'1.000.000' },
    monedas_5000000:  { amount:5000000,  label:'5.000.000' },
    monedas_15000000: { amount:15000000, label:'15.000.000' },
    monedas_50000000: { amount:50000000, label:'50.000.000', cosmetic:'fantasma' },
    pack_inicial:      { label:'Pack Inicial', pack:true, consumable:false },
    pack_pvp:          { label:'Pack PvP', pack:true, consumable:false }
  };
  const plugin=()=>window.Capacitor?.Plugins?.GallinaBilling;
  const PURCHASE_API='https://gallina-cosmica-api.jairog940.workers.dev/api/purchases/verify';
  const status=(t)=>{const e=document.getElementById('playCoinsStatus');if(e)e.textContent=t||'';};
  const button=(id)=>document.querySelector('[data-play-product="'+id+'"]');
  const setBusy=(id,busy)=>{const b=button(id);if(b){b.disabled=busy;b.style.opacity=busy?'.65':'1';}};

  async function finishPurchase(item, token){
    if(item.consumable===false) await plugin().acknowledge({purchaseToken:token});
    else await plugin().consume({purchaseToken:token});
  }

  async function verifyOnServer(productId, token){
    const authCode=await window.requestPlayGamesServerAuthCode?.();
    if(!authCode) throw new Error('PLAY_GAMES_AUTH_REQUIRED');
    const response=await fetch(PURCHASE_API,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({auth_code:authCode,purchase_token:token,product_id:productId})
    });
    const result=await response.json().catch(()=>null);
    if(!response.ok || !result?.success) throw new Error(result?.error||'PURCHASE_VERIFICATION_FAILED');
    if(result.player_id!==window.GallinaPlayerIdentity?.getCurrent?.()?.id) throw new Error('PLAYER_ID_MISMATCH');
    return result;
  }

  async function deliverPurchase(productId, token){
    const grant=await verifyOnServer(productId,token);
    window.gallinaApplyVerifiedPlayEntitlement?.(token,productId);
    if(!await window.gallinaRefreshCloudProgress?.()) throw new Error('CLOUD_REFRESH_PENDING');
    window.updatePackOffers?.();
    return grant;
  }

  async function buy(productId){
    const item=PRODUCTS[productId];
    if(!item || button(productId)?.disabled)return;
    if(!plugin()){status('Disponible en la app Android instalada desde Google Play.');return;}
    setBusy(productId,true);
    status('Conectando con Google Play…');
    try{
      if(!await window.gallinaFlushCloudProgressBeforePurchase?.())
        throw new Error('CLOUD_SYNC_REQUIRED');
      const r=await plugin().buy({productId});
      if(!r?.purchaseToken) throw new Error('Compra sin token');
      const returned=Array.isArray(r.products)?r.products:[];
      if(returned.length && !returned.includes(productId)) throw new Error('El producto devuelto no coincide');
      const grant=await deliverPurchase(productId,r.purchaseToken);
      try { await finishPurchase(item,r.purchaseToken); }
      catch(e) { console.warn('[Billing confirmation]',e); status('✅ Recompensa guardada. Google Play aún debe confirmar la compra; volveremos a intentarlo al abrir la app.'); return; }
      status(!grant.newlyCredited?'Esta compra ya había sido acreditada.':(item.pack?'✅ '+item.label+' desbloqueado.':('✅ ¡'+item.label+' monedas recibidas!'+(item.cosmetic?' 👻 Diseño Fantasma desbloqueado.':''))));
    }catch(e){
      const msg=String(e?.message||e||'');
      status(/cancel/i.test(msg)?'Compra cancelada.':(msg==='CLOUD_SYNC_REQUIRED'?'Conéctate y sincroniza tu progreso antes de comprar.':'No se pudo verificar la compra. Se reintentará al abrir el juego.'));
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
        await deliverPurchase(productId,p.purchaseToken);
        await finishPurchase(PRODUCTS[productId],p.purchaseToken);
      }
    }catch(e){console.warn('[Billing recovery]',e);}
  }

  async function init(){
    await loadPrices();
    await recoverPurchases();
  }
  window.GallinaBilling={buy,loadPrices,recoverPurchases,init,products:PRODUCTS};
  window.addEventListener('load',()=>setTimeout(init,900),{once:true});
  window.addEventListener('gallina-player-identity-ready',recoverPurchases);
})();

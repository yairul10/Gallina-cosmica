/* Bandeja del jugador: temporadas PvP y comprobantes de compras verificadas. */
(() => {
  const base='https://gallina-cosmica-pvp-test.jairog940.workers.dev';
  const purchaseApi='https://gallina-cosmica-api.jairog940.workers.dev/api/purchases/receipts';
  const $=id=>document.getElementById(id);
  const screen=$('inboxScreen'),list=$('inboxMessages'),status=$('inboxStatus'),badge=$('inboxUnreadBadge');
  let messages=[],receipts=[],busy=false,pvpUnread=0,receiptPlayer='';
  const products={monedas_500000:'500.000 monedas',monedas_1000000:'1.000.000 monedas',monedas_5000000:'5.000.000 monedas',monedas_15000000:'15.000.000 monedas',monedas_50000000:'50.000.000 monedas',pack_inicial:'Pack Inicial',pack_pvp:'Pack PvP'};
  const label=period=>{
    const [year,month]=String(period||'').split('-').map(Number);
    if(!year||!month)return String(period||'');
    return new Intl.DateTimeFormat('es-CL',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,month-1,1)));
  };
  const format=n=>Math.max(0,Number(n)||0).toLocaleString('es-CL');
  const setBadge=count=>{
    if(!badge)return;
    badge.textContent=count>0?'('+count+')':'';
    badge.style.display=count>0?'inline':'none';
  };
  async function session(){
    const result=await window.getPlayGamesPvpSession?.();
    if(!result?.token)throw new Error('Inicia sesión en Play Games para ver tus mensajes.');
    return result.token;
  }
  async function fetchInbox(){
    const token=await session();
    const r=await fetch(base+'/inbox?session='+encodeURIComponent(token),{cache:'no-store'});
    const data=await r.json().catch(()=>({}));
    if(!r.ok||!data.ok)throw new Error('No se pudieron cargar los mensajes.');
    messages=Array.isArray(data.messages)?data.messages:[];
    pvpUnread=Number(data.unread)||0;
    updateBadge();
    return token;
  }
  const seenKey=()=>receiptPlayer?'gallina-purchase-receipts-seen:'+receiptPlayer:'';
  function readSeen(){
    try { return new Set(JSON.parse(localStorage.getItem(seenKey())||'[]')); }
    catch { return new Set(); }
  }
  function updateBadge(){
    const seen=readSeen();
    setBadge(pvpUnread+receipts.filter(r=>r.id&&!seen.has(r.id)).length);
  }
  async function fetchReceipts(){
    const authCode=await window.requestPlayGamesServerAuthCode?.();
    if(!authCode)throw new Error('Inicia sesión en Play Games para ver tus compras.');
    const r=await fetch(purchaseApi,{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({auth_code:authCode}),cache:'no-store'
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok||!data.success||!Array.isArray(data.receipts))throw new Error('No se pudieron cargar las compras.');
    const current=window.GallinaPlayerIdentity?.getCurrent?.()?.id;
    if(!current||current!==data.player_id)throw new Error('La cuenta de Play Games cambió. Vuelve a abrir Mensajes.');
    receiptPlayer=current;
    receipts=data.receipts;
    updateBadge();
  }
  function markReceiptsRead(){
    if(!receiptPlayer)return;
    try {
      const seen=readSeen();
      for(const receipt of receipts)if(receipt.id)seen.add(receipt.id);
      localStorage.setItem(seenKey(),JSON.stringify([...seen].slice(-500)));
      updateBadge();
    }catch{}
  }
  const purchaseDate=value=>{
    if(!value)return '';
    const date=new Date(String(value).replace(' ','T')+'Z');
    return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat('es-CL',{dateStyle:'medium',timeStyle:'short'}).format(date);
  };
  function render(){
    list.replaceChildren();
    if(!messages.length&&!receipts.length){status.textContent='Todavía no tienes mensajes.';return;}
    status.textContent='Temporadas PvP y compras acreditadas.';
    for(const receipt of receipts){
      const card=document.createElement('article');
      card.style.cssText='padding:13px;border:1px solid #38bdf8;border-radius:12px;background:#0c2943;color:#f8fafc;font-size:.82rem;line-height:1.5;';
      const title=document.createElement('b');
      title.style.color='#7dd3fc';
      title.textContent='🧾 '+(receipt.is_test?'Compra de prueba':'Compra acreditada')+' · '+(products[receipt.product_id]||'Google Play');
      const detail=document.createElement('div');
      detail.textContent='Monedas acreditadas: '+format(receipt.coins)+'.'+(receipt.entitlement==='fantasma'?' Incluye Diseño Fantasma.':receipt.entitlement==='pack_inicial'?' Incluye Oveja, Auto Vida y potenciador de daño.':receipt.entitlement==='pack_pvp'?' Incluye los premios del Pack PvP.':'');
      const date=document.createElement('small');
      date.textContent=purchaseDate(receipt.credited_at);
      card.append(title,detail,date);
      list.appendChild(card);
    }
    for(const message of messages){
      if(message.type!=='pvp-season')continue;
      const card=document.createElement('article');
      card.style.cssText='padding:13px;border:1px solid #a78bfa;border-radius:12px;background:#1e1b4b;color:#f8fafc;font-size:.82rem;line-height:1.5;';
      const title=document.createElement('b');
      title.style.color='#fde68a';title.textContent='🏆 Temporada PvP · '+label(message.period);
      const position=document.createElement('div');
      position.textContent='Quedaste en el puesto #'+message.position+' de '+message.totalParticipants+'.';
      const rewards=[];
      if(Number(message.coins)>0)rewards.push(format(message.coins)+' monedas');
      if(message.shipName)rewards.push('nave '+message.shipName);
      if(message.cosmeticName)rewards.push('diseño '+message.cosmeticName);
      const prize=document.createElement('div');
      prize.textContent=rewards.length?'Premio: '+rewards.join(' + ')+'.':'Esta temporada no te correspondió un premio.';
      card.append(title,position,prize);
      if(rewards.length){
        const button=document.createElement('button');
        button.className='btn';button.type='button';button.style.cssText='margin:9px 0 0;padding:7px 12px;background:#b45309;';
        button.textContent=message.claimed?'✅ Premio reclamado':'🎁 Reclamar premio';
        button.disabled=!!message.claimed;
        button.addEventListener('click',async()=>{
          if(busy)return;busy=true;button.disabled=true;button.textContent='Procesando…';
          try{
            if(typeof window.claimMonthlyPvpReward!=='function')throw new Error('Abre PvP e inténtalo otra vez.');
            await window.claimMonthlyPvpReward({period:message.period});
            message.claimed=true;status.textContent='Premio entregado. ¡Felicitaciones!';
            render();
          }catch(e){button.disabled=false;button.textContent='🎁 Reclamar premio';status.textContent=String(e?.message||'No se pudo reclamar el premio.');}
          finally{busy=false;}
        });
        card.appendChild(button);
      }
      list.appendChild(card);
    }
  }
  async function open(){
    if(!screen)return;
    screen.style.display='flex';list.replaceChildren();status.textContent='Cargando…';
    const [pvp,purchases]=await Promise.allSettled([fetchInbox(),fetchReceipts()]);
    if(pvp.status==='rejected'){messages=[];pvpUnread=0;}
    if(purchases.status==='rejected'){receipts=[];receiptPlayer='';}
    updateBadge();
    if(pvp.status==='rejected'&&purchases.status==='rejected'){
      status.textContent='No se pudieron cargar los mensajes. Comprueba la conexión e inicia sesión en Play Games.';
      return;
    }
    render();
    if(pvp.status==='rejected'||purchases.status==='rejected'){
      status.textContent='Algunos mensajes no se pudieron cargar. Vuelve a abrir la bandeja para reintentarlo.';
    }
    if(purchases.status==='fulfilled')markReceiptsRead();
    if(pvp.status==='fulfilled'){
      const unread=messages.filter(m=>!m.read);
      if(unread.length){
        try {
          const r=await fetch(base+'/inbox/read?session='+encodeURIComponent(pvp.value),{
            method:'POST',headers:{'content-type':'application/json'},
            body:JSON.stringify({periods:unread.map(m=>m.period)})
          });
          if(r.ok){unread.forEach(m=>m.read=true);pvpUnread=0;updateBadge();}
        }catch{}
      }
    }
  }
  $('openInboxBtn')?.addEventListener('click',open);
  $('closeInboxBtn')?.addEventListener('click',()=>{screen.style.display='none';});
  async function refreshBadge(){
    if(!navigator.onLine)return;
    const current=window.GallinaPlayerIdentity?.getCurrent?.()?.id;
    if(receiptPlayer&&receiptPlayer!==current){receiptPlayer='';receipts=[];updateBadge();}
    await Promise.allSettled([fetchInbox(),fetchReceipts()]);
  }
  window.gallinaRefreshInbox=refreshBadge;
  window.addEventListener('gallina-player-identity-ready',()=>setTimeout(refreshBadge,500));
  window.addEventListener('load',()=>setTimeout(refreshBadge,2500),{once:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshBadge();});
})();

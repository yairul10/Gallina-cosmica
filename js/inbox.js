/* Mensajes persistentes del jugador: resultados de temporadas PvP. */
(() => {
  const base='https://gallina-cosmica-pvp-test.jairog940.workers.dev';
  const $=id=>document.getElementById(id);
  const screen=$('inboxScreen'),list=$('inboxMessages'),status=$('inboxStatus'),badge=$('inboxUnreadBadge');
  let messages=[],busy=false;
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
    setBadge(Number(data.unread)||0);
    return token;
  }
  function render(){
    list.replaceChildren();
    if(!messages.length){status.textContent='Todavía no tienes mensajes.';return;}
    status.textContent='Resultados y premios de tus temporadas PvP.';
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
    try{
      const token=await fetchInbox();render();
      const unread=messages.filter(m=>!m.read);
      if(unread.length){
        const r=await fetch(base+'/inbox/read?session='+encodeURIComponent(token),{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({periods:unread.map(m=>m.period)})
        });
        if(r.ok){unread.forEach(m=>m.read=true);setBadge(0);}
      }
    }catch(e){status.textContent=String(e?.message||'No se pudieron cargar los mensajes.');}
  }
  $('openInboxBtn')?.addEventListener('click',open);
  $('closeInboxBtn')?.addEventListener('click',()=>{screen.style.display='none';});
  async function refreshBadge(){
    if(!navigator.onLine)return;
    try{await fetchInbox();}catch{}
  }
  window.addEventListener('gallina-player-identity-ready',()=>setTimeout(refreshBadge,500));
  window.addEventListener('load',()=>setTimeout(refreshBadge,2500),{once:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshBadge();});
})();

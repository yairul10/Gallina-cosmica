(() => {
  async function init(){
    if(document.getElementById('qaAdminPanel'))return;
    const status=await window.getQaAdminStatus?.();
    if(!status?.isAdmin)return;
    const panel=document.getElementById('qaModePanel');
    if(!panel)return;
    const box=document.createElement('div'); box.id='qaAdminPanel';
    box.style.cssText='margin-top:10px;padding:9px;border:1px solid rgba(250,204,21,.65);border-radius:10px;background:rgba(66,32,6,.32)';
    box.innerHTML='<div style="font-weight:900;margin-bottom:6px">🔐 Administrador QA</div><div style="font-size:.72rem;margin-bottom:6px">Tu Player ID: <span id="qaAdminMyId"></span></div><input id="qaAdminId" placeholder="Player ID a autorizar" inputmode="numeric" style="width:100%;box-sizing:border-box;margin-bottom:6px;padding:7px;border-radius:7px"><div style="display:flex;gap:6px;flex-wrap:wrap"><button id="qaAdminAdd">➕ Autorizar</button><button id="qaAdminRemove">🗑️ Quitar</button><button id="qaAdminRefresh">↻</button></div><button id="qaAdminMonthly" style="width:100%;margin-top:7px;padding:7px;border-radius:7px;border:1px solid #f59e0b;background:#78350f;color:#fde68a;font-weight:800">🏆 Fijar premios del mes ahora</button><div style="font-size:.66rem;color:#fcd34d;margin-top:4px">Crea los premios con el ranking actual sin terminar la temporada ni reiniciar copas.</div><div id="qaAdminMsg" style="font-size:.72rem;margin-top:6px"></div><div id="qaAdminList" style="font-size:.7rem;margin-top:6px;max-height:120px;overflow:auto"></div>';
    panel.appendChild(box);
    box.querySelector('#qaAdminMyId').textContent=status.playerId||'—';
    const input=box.querySelector('#qaAdminId'), msg=box.querySelector('#qaAdminMsg'), list=box.querySelector('#qaAdminList');
    const refresh=async()=>{try{const d=await window.qaAdminRequest('list'); const ids=d.playerIds||[]; list.textContent=ids.length?'QA autorizados:\n'+ids.join('\n'):'No hay cuentas QA adicionales.';}catch(e){msg.textContent='⚠️ '+e.message;}};
    const act=async(action)=>{const id=input.value.trim();if(!id){msg.textContent='⚠️ Ingresa un Player ID.';return;}try{await window.qaAdminRequest(action,id);msg.textContent=action==='add'?'✅ QA autorizado.':'✅ QA retirado.';input.value='';await refresh();}catch(e){msg.textContent='⚠️ '+e.message;}};
    box.querySelector('#qaAdminAdd').onclick=()=>act('add');
    box.querySelector('#qaAdminRemove').onclick=()=>act('remove');
    box.querySelector('#qaAdminRefresh').onclick=refresh;
    box.querySelector('#qaAdminMonthly').onclick=async()=>{
      const btn=box.querySelector('#qaAdminMonthly');
      if(!confirm('¿Fijar ahora los premios mensuales usando el ranking actual? La temporada seguirá activa hasta fin de mes.'))return;
      btn.disabled=true;msg.textContent='⏳ Calculando premios…';
      try{
        const session=await window.getPlayGamesPvpSession?.();
        if(!session?.token)throw new Error('Inicia sesión en Play Games.');
        const response=await fetch('https://gallina-cosmica-pvp-test.jairog940.workers.dev/qa/monthly-close?session='+encodeURIComponent(session.token),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({})});
        const data=await response.json().catch(()=>({}));
        if(!response.ok||!data?.ok)throw new Error(data?.error||'No se pudieron fijar los premios.');
        msg.textContent='✅ Premios fijados para '+data.participants+' participantes · '+data.shipName+'.';
      }catch(e){msg.textContent='⚠️ '+e.message;}finally{btn.disabled=false;}
    };
    refresh();
  }
  if(window.QA_MODE)init(); else window.addEventListener('gallina-qa-ready',init,{once:true});
})();
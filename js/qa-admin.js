(() => {
  async function init(){
    if(document.getElementById('qaAdminPanel'))return;
    const status=await window.getQaAdminStatus?.();
    if(!status?.isAdmin)return;
    const panel=document.getElementById('qaModePanel');
    if(!panel)return;
    const box=document.createElement('div'); box.id='qaAdminPanel';
    box.style.cssText='margin-top:10px;padding:9px;border:1px solid rgba(250,204,21,.65);border-radius:10px;background:rgba(66,32,6,.32)';
    box.innerHTML='<div style="font-weight:900;margin-bottom:6px">🔐 Administrador QA</div><div style="font-size:.72rem;margin-bottom:6px">Tu Player ID: <span id="qaAdminMyId"></span></div><input id="qaAdminId" placeholder="Player ID a autorizar" inputmode="numeric" style="width:100%;box-sizing:border-box;margin-bottom:6px;padding:7px;border-radius:7px"><div style="display:flex;gap:6px"><button id="qaAdminAdd">➕ Autorizar</button><button id="qaAdminRemove">🗑️ Quitar</button><button id="qaAdminRefresh">↻</button></div><div id="qaAdminMsg" style="font-size:.72rem;margin-top:6px"></div><div id="qaAdminList" style="font-size:.7rem;margin-top:6px;max-height:120px;overflow:auto"></div>';
    panel.appendChild(box);
    box.querySelector('#qaAdminMyId').textContent=status.playerId||'—';
    const input=box.querySelector('#qaAdminId'), msg=box.querySelector('#qaAdminMsg'), list=box.querySelector('#qaAdminList');
    const refresh=async()=>{try{const d=await window.qaAdminRequest('list'); const ids=d.playerIds||[]; list.textContent=ids.length?'QA autorizados:\n'+ids.join('\n'):'No hay cuentas QA adicionales.';}catch(e){msg.textContent='⚠️ '+e.message;}};
    const act=async(action)=>{const id=input.value.trim();if(!id){msg.textContent='⚠️ Ingresa un Player ID.';return;}try{await window.qaAdminRequest(action,id);msg.textContent=action==='add'?'✅ QA autorizado.':'✅ QA retirado.';input.value='';await refresh();}catch(e){msg.textContent='⚠️ '+e.message;}};
    box.querySelector('#qaAdminAdd').onclick=()=>act('add');
    box.querySelector('#qaAdminRemove').onclick=()=>act('remove');
    box.querySelector('#qaAdminRefresh').onclick=refresh;
    refresh();
  }
  if(window.QA_MODE)init(); else window.addEventListener('gallina-qa-ready',init,{once:true});
})();
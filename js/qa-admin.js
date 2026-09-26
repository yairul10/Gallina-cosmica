(() => {
  const BASE='https://gallina-cosmica-pvp-test.jairog940.workers.dev';
  const PRIZES=[
    ['','🚫 Sin premio especial'],['toro_aniquilador','🚀 Toro Aniquilador'],['toro_blindado','🚀 Toro Blindado'],['toro_baliza','🚀 Toro Baliza'],
    ['toro_oscuro','🚀 Toro Oscuro'],['toro_luz','🚀 Toro Luz'],['toro_maoma','🚀 Toro Maoma'],['toro_mayor','🚀 Toro Mayor'],
    ['cosmetic_fantasma','👻 Diseño Fantasma'],['cosmetic_halloween','🎃 Diseño Halloween'],['cosmetic_navidad','🎄 Diseño Navidad']
  ];
  const GROUPS=[
    ['first','🥇 1.º puesto','qaM1'],['secondThird','🥈 2.º–3.º','qaM23'],['fourthFifth','🏅 4.º–5.º','qaM45'],
    ['sixthTenth','🏆 6.º–10.º','qaM610'],['upperHalf','📈 Mitad superior restante','qaM50'],['rest','🎮 Resto de participantes','qaMRest']
  ];
  async function sessionToken(){
    const session=await window.getPlayGamesPvpSession?.();
    if(!session?.token)throw new Error('Inicia sesión en Play Games.');
    return session.token;
  }
  async function monthlyRequest(method,body){
    const token=await sessionToken();
    const r=await fetch(BASE+'/qa/monthly-config?session='+encodeURIComponent(token),{
      method,headers:{'content-type':'application/json'},body:method==='POST'?JSON.stringify(body):undefined,cache:'no-store'
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d?.ok)throw new Error(d?.error==='MONTHLY_PRIZES_LOCKED'?'Los premios ya están bloqueados desde el día 16.':(d?.error||'No se pudo actualizar la temporada.'));
    return d;
  }
  async function eventThemeRequest(method,body){
    const token=await sessionToken();
    const r=await fetch(BASE+'/qa/event-theme?session='+encodeURIComponent(token),{method,headers:{'content-type':'application/json'},body:method==='POST'?JSON.stringify(body):undefined,cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d?.ok)throw new Error(d?.error||'No se pudo actualizar el evento visual.');
    return d;
  }
  async function menuThemeRequest(method,body){
    const token=await sessionToken();
    const r=await fetch(BASE+'/qa/menu-theme?session='+encodeURIComponent(token),{method,headers:{'content-type':'application/json'},body:method==='POST'?JSON.stringify(body):undefined,cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d?.ok)throw new Error(d?.error||'No se pudo actualizar el tema del menú.');
    return d;
  }
  async function init(){
    if(document.getElementById('qaAdminPanel'))return;
    const status=await window.getQaAdminStatus?.();
    if(!status?.isAdmin)return;
    const dock=window.GallinaQaPanelDock?.dock||document.getElementById('qaPanelDock');
    if(!dock)return;
    const box=document.createElement('section'); box.id='qaAdminPanel';
    box.style.cssText='width:min(310px,calc(100vw - 16px));box-sizing:border-box;padding:7px;background:rgba(2,11,39,.94);border:1px solid rgba(250,204,21,.75);border-radius:10px;box-shadow:0 3px 10px rgba(0,0,0,.45);color:#e2e8f0;font:700 11px/1.25 sans-serif';
    const header=document.createElement('div');
    header.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:6px;color:#fbbf24;font-size:12px';
    const headerText=document.createElement('span');headerText.textContent='🔐 QA administrador';
    const toggle=document.createElement('button');toggle.type='button';toggle.textContent='🔐 QA administrador';toggle.title='Abrir QA administrador';
    toggle.style.cssText='border:1px solid #fbbf24;border-radius:6px;background:#0f172a;color:#fde68a;min-width:27px;height:26px;padding:0 8px;font:800 11px/1 sans-serif;cursor:pointer';
    header.append(headerText,toggle);
    const body=document.createElement('div');body.id='qaAdminPanelBody';body.style.cssText='margin-top:7px;max-height:calc(100dvh - 145px);overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding-right:3px';
    body.innerHTML='<div style="font-weight:900;margin-bottom:6px">🔐 Administrador QA</div>'+
      '<div style="font-size:.72rem;margin-bottom:6px">Tu Player ID: <span id="qaAdminMyId"></span></div>'+
      '<input id="qaAdminId" placeholder="Player ID a autorizar" inputmode="numeric" style="width:100%;box-sizing:border-box;margin-bottom:6px;padding:7px;border-radius:7px">'+
      '<div style="display:flex;gap:6px;flex-wrap:wrap"><button id="qaAdminAdd">➕ Autorizar</button><button id="qaAdminRemove">🗑️ Quitar</button><button id="qaAdminRefresh">↻</button></div>'+
      '<div style="margin-top:9px;padding-top:8px;border-top:1px solid rgba(250,204,21,.35)"><button id="qaMenuThemeToggle" type="button" style="width:100%;padding:7px;border:1px solid #38bdf8;border-radius:7px;background:#082f49;color:#cffafe;font-weight:900;text-align:left">🎨 Temas del menú ▸</button><div id="qaMenuThemeBody" style="display:none;padding-top:7px"><div style="font-size:.66rem;color:#cffafe;margin-bottom:6px">Decoración global del menú para todos. No cambia naves ni premios.</div><label style="display:block;margin:4px 0">Tema<select id="qaMenuTheme" style="float:right;width:145px"><option value="normal">🚫 Sin tema</option><option value="halloween">🎃 Halloween</option><option value="navidad">🎄 Navidad</option></select></label><button id="qaMenuThemeSave" type="button" style="width:100%;margin-top:9px;padding:7px;border:1px solid #38bdf8;border-radius:7px;background:#075985;color:#ecfeff;font-weight:900">💾 Activar / guardar tema</button><div id="qaMenuThemeState" style="font-size:.66rem;color:#cffafe;margin-top:5px"></div></div></div>'+
      '<div style="margin-top:9px;padding-top:8px;border-top:1px solid rgba(250,204,21,.35)"><button id="qaThemeToggle" type="button" style="width:100%;padding:7px;border:1px solid #a855f7;border-radius:7px;background:#24104f;color:#e9d5ff;font-weight:900;text-align:left">🚀 Diseños temporales de naves ▸</button><div id="qaThemeBody" style="display:none;padding-top:7px"><div style="font-size:.66rem;color:#ddd6fe;margin-bottom:6px">Reemplaza temporalmente el diseño personal de las naves y vuelve al terminar.</div><label style="display:block;margin:4px 0">Diseño<select id="qaEventTheme" style="float:right;width:145px"><option value="normal">🚫 Desactivar diseño</option><option value="fantasma">👻 Fantasma</option><option value="halloween">🎃 Halloween</option><option value="navidad">🎄 Navidad</option></select></label><label style="display:block;clear:both;margin:8px 0 4px">Alcance<select id="qaEventScope" style="float:right;width:145px"><option value="all">Todos los jugadores</option><option value="ids">Solo estos Player IDs</option></select></label><textarea id="qaEventIds" rows="3" placeholder="Un Player ID por línea o separado por comas" style="clear:both;width:100%;box-sizing:border-box;margin-top:6px;padding:6px"></textarea><label style="display:block;margin-top:6px">Duración en horas <input id="qaEventHours" type="number" min="0" max="720" value="24" inputmode="numeric" style="float:right;width:70px"> <span style="font-size:.62rem;color:#cbd5e1">0 = hasta desactivar</span></label><button id="qaEventSave" type="button" style="width:100%;margin-top:9px;padding:7px;border:1px solid #a855f7;border-radius:7px;background:#581c87;color:#f3e8ff;font-weight:900">✨ Activar / guardar diseño</button><div id="qaEventState" style="font-size:.66rem;color:#ddd6fe;margin-top:5px"></div></div></div>'+
      '<div style="margin-top:9px;padding-top:8px;border-top:1px solid rgba(250,204,21,.35);font-weight:900">🏆 Premios PvP del mes</div>'+
      '<div id="qaMonthlyState" style="font-size:.68rem;color:#fde68a;margin:4px 0"></div>'+
      '<div style="font-size:.72rem;font-weight:800;margin:7px 0 5px">🎁 Premio especial y monedas por grupo</div>'+
      '<div id="qaMonthlyGroups"></div>'+
      '<div style="font-size:.64rem;color:#fde68a;margin-top:5px">Cada grupo puede recibir monedas, una nave, un diseño o solo monedas. Los diseños son visuales y no alteran las estadísticas.</div>'+
      '<button id="qaMonthlySave" style="width:100%;margin-top:7px;padding:7px;border-radius:7px;border:1px solid #f59e0b;background:#78350f;color:#fde68a;font-weight:800">💾 Guardar premios del mes</button>'+
      '<div style="font-size:.66rem;color:#fcd34d;margin-top:4px">Regla normal: puedes cambiarlos del día 1 al 15; desde el 16 quedan bloqueados. Septiembre 2026 tiene una excepción de lanzamiento y permanece editable hasta fin de mes.</div>'+
      '<div id="qaAdminMsg" style="font-size:.72rem;margin-top:6px"></div><div id="qaAdminList" style="font-size:.7rem;margin-top:6px;max-height:120px;overflow:auto"></div>';
    box.append(header,body);dock.appendChild(box);
    let collapsed=true;
    const setCollapsed=value=>{
      collapsed=!!value;body.style.display=collapsed?'none':'';
      headerText.style.display=collapsed?'none':'';
      toggle.textContent=collapsed?'🔐 QA administrador':'−';
      toggle.title=collapsed?'Abrir QA administrador':'Minimizar QA administrador';
      toggle.style.fontSize=collapsed?'11px':'16px';
      box.style.width=collapsed?'auto':'min(310px,calc(100vw - 16px))';
    };
    toggle.addEventListener('click',()=>{
      if(collapsed)window.GallinaQaPanelDock?.collapseBot?.();
      setCollapsed(!collapsed);
    });
    window.GallinaQaPanelDock?.registerAdmin({collapse:()=>setCollapsed(true)});
    setCollapsed(true);
    box.querySelector('#qaAdminMyId').textContent=status.playerId||'—';
    const input=box.querySelector('#qaAdminId'),msg=box.querySelector('#qaAdminMsg'),list=box.querySelector('#qaAdminList');
    const state=box.querySelector('#qaMonthlyState'),save=box.querySelector('#qaMonthlySave'),groupsBox=box.querySelector('#qaMonthlyGroups');
    const menuThemeToggle=box.querySelector('#qaMenuThemeToggle'),menuThemeBody=box.querySelector('#qaMenuThemeBody'),menuTheme=box.querySelector('#qaMenuTheme'),menuThemeSave=box.querySelector('#qaMenuThemeSave'),menuThemeState=box.querySelector('#qaMenuThemeState');
    const eventToggle=box.querySelector('#qaThemeToggle'),eventBody=box.querySelector('#qaThemeBody'),eventTheme=box.querySelector('#qaEventTheme'),eventScope=box.querySelector('#qaEventScope'),eventIds=box.querySelector('#qaEventIds'),eventHours=box.querySelector('#qaEventHours'),eventSave=box.querySelector('#qaEventSave'),eventState=box.querySelector('#qaEventState');
    GROUPS.forEach(([key,label,coinsId])=>{
      const row=document.createElement('div');row.style.cssText='padding:6px 0;border-top:1px solid rgba(148,163,184,.2)';
      row.innerHTML='<label style="display:block;font-size:.7rem;margin-bottom:3px" for="qaMonthlyPrize-'+key+'">'+label+'</label><div style="display:grid;grid-template-columns:minmax(0,1fr) 82px;gap:5px"><select id="qaMonthlyPrize-'+key+'" style="width:100%;box-sizing:border-box;padding:6px"></select><input id="'+coinsId+'" type="number" min="0" inputmode="numeric" style="width:100%;box-sizing:border-box" placeholder="Monedas" aria-label="Monedas '+label+'"></div>';
      groupsBox.appendChild(row);
      const select=row.querySelector('select');PRIZES.forEach(([id,name])=>{const o=document.createElement('option');o.value=id;o.textContent=name;select.appendChild(o);});
    });
    const ids=GROUPS.map(([, ,id])=>box.querySelector('#'+id));
    const prizes=GROUPS.map(([key])=>box.querySelector('#qaMonthlyPrize-'+key));
    const refresh=async()=>{try{const d=await window.qaAdminRequest('list');const arr=d.playerIds||[];list.textContent=arr.length?'QA autorizados:\n'+arr.join('\n'):'No hay cuentas QA adicionales.';}catch(e){msg.textContent='⚠️ '+e.message;}};
    const act=async(action)=>{const id=input.value.trim();if(!id){msg.textContent='⚠️ Ingresa un Player ID.';return;}try{await window.qaAdminRequest(action,id);msg.textContent=action==='add'?'✅ QA autorizado.':'✅ QA retirado.';input.value='';await refresh();}catch(e){msg.textContent='⚠️ '+e.message;}};
    const updateEventIds=()=>{eventIds.disabled=eventScope.value!=='ids';eventIds.style.opacity=eventIds.disabled?'.5':'1';};
    const loadEventTheme=async()=>{try{const d=await eventThemeRequest('GET'),c=d.config||{};eventTheme.value=c.theme||'normal';eventScope.value=c.scope||'all';eventIds.value=(c.playerIds||[]).join('\n');eventHours.value=c.expiresAt&&c.expiresAt>Date.now()?Math.max(1,Math.ceil((c.expiresAt-Date.now())/3600000)):24;updateEventIds();eventState.textContent=c.active?'✅ Activo: '+c.theme+(c.scope==='ids'?' para '+(c.playerIds||[]).length+' ID(s)':' para todos')+(c.expiresAt?' · termina '+new Date(c.expiresAt).toLocaleString('es-CL'):' · sin término automático'):'Sin evento visual activo.';}catch(e){eventState.textContent='⚠️ '+e.message;}};
    const loadMenuTheme=async()=>{try{const d=await menuThemeRequest('GET'),c=d.config||{};menuTheme.value=c.theme||'normal';menuThemeState.textContent=c.active?'✅ Tema global activo: '+c.theme+'.':'Sin tema global activo.';}catch(e){menuThemeState.textContent='⚠️ '+e.message;}};
    const loadMonthly=async()=>{try{const d=await monthlyRequest('GET'),c=d.config||{};GROUPS.forEach(([key],i)=>{prizes[i].value=c[key+'Prize']||'';ids[i].value=Number(c[key]||0);});const locked=!!c.locked;prizes.forEach(x=>x.disabled=locked);ids.forEach(x=>x.disabled=locked);save.disabled=locked;state.textContent=(locked?'🔒 Premios definitivos':(c.period==='2026-09'?'✏️ Premios editables · excepción de lanzamiento hasta fin de septiembre':'✏️ Premios editables hasta el día 15'))+' · Participantes actuales: '+Number(d.participants||0);}catch(e){state.textContent='⚠️ '+e.message;}};
    box.querySelector('#qaAdminAdd').onclick=()=>act('add');
    box.querySelector('#qaAdminRemove').onclick=()=>act('remove');
    box.querySelector('#qaAdminRefresh').onclick=refresh;
    menuThemeToggle.onclick=()=>{const open=menuThemeBody.style.display==='none';menuThemeBody.style.display=open?'':'none';menuThemeToggle.textContent='🎨 Temas del menú '+(open?'▾':'▸');if(open)loadMenuTheme();};
    menuThemeSave.onclick=async()=>{menuThemeSave.disabled=true;menuThemeState.textContent='⏳ Guardando tema…';try{const d=await menuThemeRequest('POST',{theme:menuTheme.value});menuThemeState.textContent=d.config?.theme==='normal'?'✅ Tema global desactivado.':'✅ Tema global activado.';await loadMenuTheme();await window.refreshPvpSpecialShipAccess?.();}catch(e){menuThemeState.textContent='⚠️ '+e.message;}finally{menuThemeSave.disabled=false;}};
    eventToggle.onclick=()=>{const open=eventBody.style.display==='none';eventBody.style.display=open?'':'none';eventToggle.textContent='🚀 Diseños temporales de naves '+(open?'▾':'▸');if(open)loadEventTheme();};
    eventScope.onchange=updateEventIds;
    eventSave.onclick=async()=>{eventSave.disabled=true;eventState.textContent='⏳ Guardando evento…';try{const playerIds=eventIds.value.split(/[\s,;]+/).map(x=>x.trim()).filter(Boolean);const d=await eventThemeRequest('POST',{theme:eventTheme.value,scope:eventScope.value,playerIds,durationHours:Number(eventHours.value)||0});eventState.textContent=d.config?.theme==='normal'?'✅ Evento desactivado.':'✅ Evento activado.';await loadEventTheme();await window.refreshPvpSpecialShipAccess?.();}catch(e){eventState.textContent='⚠️ '+e.message;}finally{eventSave.disabled=false;}};
    save.onclick=async()=>{save.disabled=true;msg.textContent='⏳ Guardando premios…';try{const vals=ids.map(x=>Math.max(0,Math.floor(Number(x.value)||0))),body={};GROUPS.forEach(([key],i)=>{body[key]=vals[i];body[key+'Prize']=prizes[i].value;});const d=await monthlyRequest('POST',body);msg.textContent='✅ Premios actualizados para todos los jugadores.';state.textContent=(d.config?.period==='2026-09'?'✏️ Premios editables · excepción de lanzamiento hasta fin de septiembre':'✏️ Premios editables hasta el día 15')+' · Participantes actuales: '+Number(d.participants||0);}catch(e){msg.textContent='⚠️ '+e.message;}finally{await loadMonthly();}};
    refresh();loadMonthly();
  }
  if(window.QA_MODE)init(); else window.addEventListener('gallina-qa-ready',init,{once:true});
})();

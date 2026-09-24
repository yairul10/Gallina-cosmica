(() => {
  const BASE='https://gallina-cosmica-pvp-test.jairog940.workers.dev';
  const SHIPS=[
    ['toro_aniquilador','Toro Aniquilador'],['toro_blindado','Toro Blindado'],['toro_baliza','Toro Baliza'],
    ['toro_oscuro','Toro Oscuro'],['toro_luz','Toro Luz'],['toro_maoma','Toro Maoma'],['toro_mayor','Toro Mayor']
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
  async function init(){
    if(document.getElementById('qaAdminPanel'))return;
    const status=await window.getQaAdminStatus?.();
    if(!status?.isAdmin)return;
    const panel=document.getElementById('qaModePanel');
    if(!panel)return;
    const box=document.createElement('div'); box.id='qaAdminPanel';
    box.style.cssText='margin-top:10px;padding:9px;border:1px solid rgba(250,204,21,.65);border-radius:10px;background:rgba(66,32,6,.32)';
    box.innerHTML='<div style="font-weight:900;margin-bottom:6px">🔐 Administrador QA</div>'+
      '<div style="font-size:.72rem;margin-bottom:6px">Tu Player ID: <span id="qaAdminMyId"></span></div>'+
      '<input id="qaAdminId" placeholder="Player ID a autorizar" inputmode="numeric" style="width:100%;box-sizing:border-box;margin-bottom:6px;padding:7px;border-radius:7px">'+
      '<div style="display:flex;gap:6px;flex-wrap:wrap"><button id="qaAdminAdd">➕ Autorizar</button><button id="qaAdminRemove">🗑️ Quitar</button><button id="qaAdminRefresh">↻</button></div>'+
      '<div style="margin-top:9px;padding-top:8px;border-top:1px solid rgba(250,204,21,.35);font-weight:900">🏆 Premios PvP del mes</div>'+
      '<div id="qaMonthlyState" style="font-size:.68rem;color:#fde68a;margin:4px 0"></div>'+
      '<div style="font-size:.72rem;font-weight:800;margin:7px 0 3px">🚀 Nave para puestos 1.º–5.º</div><select id="qaMonthlyShip" style="width:100%;box-sizing:border-box;padding:7px;margin:3px 0 8px"></select>'+
      '<div style="font-size:.72rem;font-weight:800;margin-bottom:5px">🪙 Monedas por posición</div>'+
      '<div style="display:grid;grid-template-columns:minmax(120px,1fr) minmax(145px,1fr);gap:6px;align-items:center;min-width:290px">'+
      '<label for="qaM1">🥇 1.º puesto</label><input id="qaM1" type="number" min="0" inputmode="numeric" style="width:100%;box-sizing:border-box" placeholder="Monedas">'+
      '<label for="qaM23">🥈 2.º–3.º</label><input id="qaM23" type="number" min="0" inputmode="numeric" style="width:100%;box-sizing:border-box" placeholder="Monedas">'+
      '<label for="qaM45">🏅 4.º–5.º</label><input id="qaM45" type="number" min="0" inputmode="numeric" style="width:100%;box-sizing:border-box" placeholder="Monedas">'+
      '<label for="qaM610">🏆 6.º–10.º</label><input id="qaM610" type="number" min="0" inputmode="numeric" style="width:100%;box-sizing:border-box" placeholder="Monedas">'+
      '<label for="qaM50">📈 Mitad superior restante</label><input id="qaM50" type="number" min="0" inputmode="numeric" style="width:100%;box-sizing:border-box" placeholder="Monedas">'+
      '<label for="qaMRest">🎮 Resto de participantes</label><input id="qaMRest" type="number" min="0" inputmode="numeric" style="width:100%;box-sizing:border-box" placeholder="Monedas"></div>'+
      '<div style="font-size:.64rem;color:#fde68a;margin-top:5px">Puedes subir, bajar o dejar en 0 cualquier premio de monedas antes del bloqueo. La nave elegida se entrega a los puestos 1.º–5.º.</div>'+
      '<button id="qaMonthlySave" style="width:100%;margin-top:7px;padding:7px;border-radius:7px;border:1px solid #f59e0b;background:#78350f;color:#fde68a;font-weight:800">💾 Guardar premios del mes</button>'+
      '<div style="font-size:.66rem;color:#fcd34d;margin-top:4px">Regla normal: puedes cambiarlos del día 1 al 15; desde el 16 quedan bloqueados. Septiembre 2026 tiene una excepción de lanzamiento y permanece editable hasta fin de mes.</div>'+
      '<div id="qaAdminMsg" style="font-size:.72rem;margin-top:6px"></div><div id="qaAdminList" style="font-size:.7rem;margin-top:6px;max-height:120px;overflow:auto"></div>';
    panel.appendChild(box);
    box.querySelector('#qaAdminMyId').textContent=status.playerId||'—';
    const input=box.querySelector('#qaAdminId'),msg=box.querySelector('#qaAdminMsg'),list=box.querySelector('#qaAdminList');
    const ship=box.querySelector('#qaMonthlyShip'),state=box.querySelector('#qaMonthlyState'),save=box.querySelector('#qaMonthlySave');
    SHIPS.forEach(([id,name])=>{const o=document.createElement('option');o.value=id;o.textContent=name;ship.appendChild(o);});
    const ids=['qaM1','qaM23','qaM45','qaM610','qaM50','qaMRest'].map(id=>box.querySelector('#'+id));
    const refresh=async()=>{try{const d=await window.qaAdminRequest('list');const arr=d.playerIds||[];list.textContent=arr.length?'QA autorizados:\n'+arr.join('\n'):'No hay cuentas QA adicionales.';}catch(e){msg.textContent='⚠️ '+e.message;}};
    const act=async(action)=>{const id=input.value.trim();if(!id){msg.textContent='⚠️ Ingresa un Player ID.';return;}try{await window.qaAdminRequest(action,id);msg.textContent=action==='add'?'✅ QA autorizado.':'✅ QA retirado.';input.value='';await refresh();}catch(e){msg.textContent='⚠️ '+e.message;}};
    const loadMonthly=async()=>{try{const d=await monthlyRequest('GET'),c=d.config||{};ship.value=c.shipId||'toro_aniquilador';[c.first,c.secondThird,c.fourthFifth,c.sixthTenth,c.upperHalf,c.rest].forEach((v,i)=>ids[i].value=Number(v||0));const locked=!!c.locked;ship.disabled=locked;ids.forEach(x=>x.disabled=locked);save.disabled=locked;state.textContent=(locked?'🔒 Premios definitivos':(c.period==='2026-09'?'✏️ Premios editables · excepción de lanzamiento hasta fin de septiembre':'✏️ Premios editables hasta el día 15'))+' · Participantes actuales: '+Number(d.participants||0);}catch(e){state.textContent='⚠️ '+e.message;}};
    box.querySelector('#qaAdminAdd').onclick=()=>act('add');
    box.querySelector('#qaAdminRemove').onclick=()=>act('remove');
    box.querySelector('#qaAdminRefresh').onclick=refresh;
    save.onclick=async()=>{save.disabled=true;msg.textContent='⏳ Guardando premios…';try{const vals=ids.map(x=>Math.max(0,Math.floor(Number(x.value)||0)));const d=await monthlyRequest('POST',{shipId:ship.value,first:vals[0],secondThird:vals[1],fourthFifth:vals[2],sixthTenth:vals[3],upperHalf:vals[4],rest:vals[5]});msg.textContent='✅ Premios actualizados para todos los jugadores.';state.textContent=(d.config?.period==='2026-09'?'✏️ Premios editables · excepción de lanzamiento hasta fin de septiembre':'✏️ Premios editables hasta el día 15')+' · Participantes actuales: '+Number(d.participants||0);}catch(e){msg.textContent='⚠️ '+e.message;}finally{await loadMonthly();}};
    refresh();loadMonthly();
  }
  if(window.QA_MODE)init(); else window.addEventListener('gallina-qa-ready',init,{once:true});
})();

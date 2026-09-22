/*
 * Extensión QA exclusiva para PvP.
 * No altera el bot QA original: sólo añade controles al panel existente cuando QA_MODE=true.
 */
(() => {
  if (!window.QA_MODE) return;
  const panel=document.getElementById('qaModePanel');
  if(!panel||!window.GallinaPvp)return;

  const box=document.createElement('div');
  box.style.cssText='margin-top:7px;padding-top:7px;border-top:1px solid #475569';
  box.innerHTML='<div style="color:#67e8f9;margin-bottom:5px">⚔️ QA PvP</div>';

  const row=document.createElement('div');row.style.cssText='display:flex;gap:4px';
  const mode=document.createElement('select');
  [['1v1','1v1 · 1 bot'],['2v2','2v2 · 3 bots'],['arena','Arena 5 · 4 bots'],['arena10','Arena 10 · 9 bots']].forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;mode.appendChild(o);});
  const count=document.createElement('select');[1,5,10,20].forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v+' partida'+(v===1?'':'s');count.appendChild(o);});
  const speed=document.createElement('select');[[1,'x1'],[2,'x2'],[4,'x4'],[8,'x8']].forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;speed.appendChild(o);});
  for(const el of [mode,count,speed])el.style.cssText='min-width:0;flex:1;border-radius:6px;border:1px solid #64748b;background:#0f172a;color:#fff;padding:4px;font:700 10px sans-serif';
  row.append(mode,count,speed);

  const actions=document.createElement('div');actions.style.cssText='display:flex;gap:4px;margin-top:4px';
  const start=document.createElement('button');start.textContent='▶ PvP QA';
  const cancel=document.createElement('button');cancel.textContent='■ Detener';
  start.style.cssText='flex:1;border:0;border-radius:6px;padding:5px;background:#22d3ee;color:#082f49;font-weight:800';
  cancel.style.cssText='border:0;border-radius:6px;padding:5px;background:#ef4444;color:#fff;font-weight:800';
  actions.append(start,cancel);

  const status=document.createElement('div');status.style.cssText='margin-top:5px;color:#bae6fd';
  const results=document.createElement('div');results.style.cssText='margin-top:4px;font-size:10px;color:#94a3b8';
  box.append(row,actions,status,results);panel.appendChild(box);

  let running=false,target=0,series=[],anomalies=[],monitor=0;
  const fmt=ms=>(Math.max(0,ms)/1000).toFixed(1)+'s';
  function render(){
    const wins=series.filter(x=>x.result==='win').length;
    status.textContent=running?`🤖 PvP QA ${series.length+1}/${target} · ${mode.value} · ${speed.value}x`:`PvP QA: ${series.length}/${target||0} completadas`;
    results.innerHTML=(series.length?`✓ Resultados: ${series.length} · victorias: ${wins} · anomalías: ${anomalies.length}<br>`:'')+
      series.slice(-4).map((r,i)=>`#${series.length-Math.min(4,series.length)+i+1} [${r.mode} x${r.speed||speed.value}] ${r.result} · ☠️${r.kills} · real ${fmt(r.realDurationMs)} · sim ${fmt(r.simulatedDurationMs)}`).join('<br>')+
      (anomalies.length?'<br><span style="color:#fca5a5">⚠ '+anomalies.slice(-3).join('<br>⚠ ')+'</span>':'');
  }
  function check(){
    if(!running)return;
    const s=window.GallinaPvp.getQaSnapshot();
    if(!s.active)return;
    if(!Number.isFinite(s.lives)||s.lives<0)anomalies.push('Vidas PvP inválidas: '+s.lives);
    if(!Number.isFinite(s.simulatedMs))anomalies.push('Reloj PvP inválido');
    if(s.players<2)anomalies.push('Partida PvP sin rivales');
    if(anomalies.length>30)anomalies=anomalies.slice(-30);
  }
  function launch(){
    if(!running)return;
    try{window.GallinaPvp.startQaMatch(mode.value,Number(speed.value));render();}
    catch(e){anomalies.push('No se pudo iniciar: '+(e?.message||e));running=false;render();}
  }
  window.addEventListener('gallina-qa-pvp-result',e=>{
    if(!running)return;
    const r={...e.detail,speed:Number(speed.value)};series.push(r);render();
    if(series.length>=target||r.result==='cancelled'){running=false;render();return;}
    setTimeout(launch,350);
  });
  window.addEventListener('error',e=>{if(running){anomalies.push('Error JS PvP: '+(e.message||'sin detalle'));render();}});
  window.addEventListener('unhandledrejection',e=>{if(running){anomalies.push('Promesa PvP: '+(e.reason?.message||String(e.reason||'sin detalle')));render();}});
  monitor=setInterval(check,250);

  start.addEventListener('click',()=>{
    if(running)window.GallinaPvp.stopQaMatch();
    series=[];anomalies=[];target=Number(count.value);running=true;render();launch();
  });
  cancel.addEventListener('click',()=>{if(!running)return;running=false;window.GallinaPvp.stopQaMatch();render();});
  render();
})();
/*
 * Extensión QA exclusiva para PvP.
 * No altera el bot QA original: sólo añade controles al panel existente cuando QA_MODE=true.
 */
(() => {
  function initQaPvp(){
  if(document.getElementById('qaPvpPanelExtension'))return;
  if (!window.QA_MODE) return;
  const panel=document.getElementById('qaBotPanelBody');
  if(!panel||!window.GallinaPvp)return;

  const box=document.createElement('div');box.id='qaPvpPanelExtension';
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

  let running=false,target=0,series=[],anomalies=[],monitor=0,lastProgressKey='',lastProgressAt=0,matchAnomalyKeys=new Set();
  const fmt=ms=>(Math.max(0,ms)/1000).toFixed(1)+'s';
  const avg=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
  function addAnomaly(key,message,snapshot={}){
    if(!running||matchAnomalyKeys.has(key))return;
    matchAnomalyKeys.add(key);
    anomalies.push({match:series.length+1,key,message,mode:mode.value,simulatedMs:Number(snapshot.simulatedMs)||0});
    if(anomalies.length>60)anomalies=anomalies.slice(-60);
    render();
  }
  function render(){
    const wins=series.filter(x=>x.result==='win').length,losses=series.filter(x=>x.result==='loss').length;
    const affected=new Set(anomalies.map(x=>x.match)).size;
    status.textContent=running?`🤖 PvP QA ${series.length+1}/${target} · ${mode.value} · ${speed.value}x`:`PvP QA: ${series.length}/${target||0} completadas`;
    const summary=series.length?`✓ Partidas: ${series.length} · 🏆 ${wins} · 💥 ${losses} · ⚠ ${anomalies.length} (${affected} partidas)<br>⏱ sim prom. ${fmt(avg(series.map(r=>Number(r.simulatedDurationMs)||0)))} · ☠️ bajas prom. ${avg(series.map(r=>Number(r.kills)||0)).toFixed(1)}<br>`:'';
    results.innerHTML=summary+
      series.slice(-4).map((r,i)=>`#${series.length-Math.min(4,series.length)+i+1} [${r.mode} x${r.speed||speed.value}] ${r.result}${r.placement?' · #'+r.placement:''} · ☠️${r.kills} · ❤️${r.lives} · real ${fmt(r.realDurationMs)} · sim ${fmt(r.simulatedDurationMs)}`).join('<br>')+
      (anomalies.length?'<br><span style="color:#fca5a5">⚠ '+anomalies.slice(-5).map(a=>`P${a.match} [${a.mode}] ${a.message}`).join('<br>⚠ ')+'</span>':'<br><span style="color:#86efac">✓ Sin anomalías detectadas.</span>');
  }
  function check(){
    if(!running)return;
    let s;
    try{s=window.GallinaPvp.getQaSnapshot();}catch(e){addAnomaly('snapshot-error','No se pudo leer el estado PvP: '+(e?.message||e));return;}
    if(!s.active)return;
    const finite=v=>typeof v==='number'&&Number.isFinite(v);
    const localMax=Math.max(1,Number(s.maxLives||s.me?.maxLives)||20);\n    if(!finite(s.lives)||s.lives<0||s.lives>localMax)addAnomaly('lives','Vidas PvP inválidas: '+s.lives+' / '+localMax,s);
    if(!finite(s.simulatedMs)||s.simulatedMs<0)addAnomaly('clock','Reloj PvP inválido',s);
    const expected=s.mode==='1v1'?2:s.mode==='2v2'?4:s.mode==='arena'?5:10;
    if(s.players!==expected)addAnomaly('players',`Cantidad de jugadores incorrecta: ${s.players}/${expected}`,s);
    if(!s.world||!finite(s.world.width)||!finite(s.world.height)||s.world.width<=0||s.world.height<=0)addAnomaly('world','Dimensiones del mundo PvP inválidas',s);
    const entities=[s.me,...(Array.isArray(s.peers)?s.peers:[])].filter(Boolean);
    entities.forEach(e=>{
      if(!finite(e.x)||!finite(e.y)||!finite(e.lives))addAnomaly('entity-'+e.slot,'Nave con posición/vidas NaN o Infinity',s);
      else if(s.world&&(e.x<-100||e.x>s.world.width+100||e.y<-100||e.y>s.world.height+100))addAnomaly('outside-'+e.slot,'Nave fuera del área válida (slot '+(e.slot||'local')+')',s);
      const maxLives=Math.max(1,Number(e.maxLives)||20);\n      if(e.lives<0||e.lives>maxLives)addAnomaly('peer-lives-'+e.slot,'Vidas fuera de rango en slot '+(e.slot||'local')+': '+e.lives+' / '+maxLives,s);
    });
    if(s.bullets>500)addAnomaly('bullet-leak','Acumulación anormal de proyectiles: '+s.bullets,s);
    if(s.missiles>100)addAnomaly('missile-leak','Acumulación anormal de misiles: '+s.missiles,s);
    if(s.mode==='arena10'&&s.zone&&(!finite(Number(s.zone.progress))||Number(s.zone.progress)<0||Number(s.zone.progress)>1.001))addAnomaly('zone','Progreso inválido de Zona Cósmica',s);
    const progressKey=[s.lives,s.kills,s.botKills,(s.eliminated||[]).length,...entities.map(e=>e.lives)].join('|');
    if(progressKey!==lastProgressKey){lastProgressKey=progressKey;lastProgressAt=Number(s.simulatedMs)||0;}
    else if((Number(s.simulatedMs)||0)-lastProgressAt>=45000)addAnomaly('no-progress','45 s simulados sin daño, bajas ni cambios de vida',s);
    if((Number(s.simulatedMs)||0)>600000)addAnomaly('too-long','La partida supera 10 min simulados sin finalizar',s);
  }
  function launch(){
    if(!running)return;
    matchAnomalyKeys=new Set();lastProgressKey='';lastProgressAt=0;
    try{window.GallinaPvp.startQaMatch(mode.value,Number(speed.value));render();}
    catch(e){addAnomaly('start','No se pudo iniciar: '+(e?.message||e));running=false;render();}
  }
  window.addEventListener('gallina-qa-pvp-result',e=>{
    if(!running)return;
    const r={...e.detail,speed:Number(speed.value)};series.push(r);render();
    if(series.length>=target||r.result==='cancelled'){running=false;render();return;}
    setTimeout(launch,350);
  });
  window.addEventListener('error',e=>{if(running)addAnomaly('js-'+(e.message||'sin-detalle'),'Error JS PvP: '+(e.message||'sin detalle'));});
  window.addEventListener('unhandledrejection',e=>{if(running){const m=e.reason?.message||String(e.reason||'sin detalle');addAnomaly('promise-'+m,'Promesa PvP: '+m);}});
  monitor=setInterval(check,250);

  start.addEventListener('click',()=>{
    if(running)window.GallinaPvp.stopQaMatch();
    series=[];anomalies=[];target=Number(count.value);running=true;render();launch();
  });
  cancel.addEventListener('click',()=>{if(!running)return;running=false;window.GallinaPvp.stopQaMatch();render();});
  render();
  }
  if(window.QA_MODE)initQaPvp();
  else window.addEventListener('gallina-qa-ready',initQaPvp,{once:true});
})();

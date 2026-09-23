/*
 * Plegado coordinado del QA. Las extensiones PvP y Administrador se agregan
 * dinámicamente dentro de #qaModePanel, por lo que se ocultan/restauran juntas.
 * No pausa ni cancela ninguna simulación en curso.
 */
(() => {
  function initQaPanelToggle(){
    if(!window.QA_MODE)return;
    const panel=document.getElementById('qaModePanel');
    if(!panel||document.getElementById('qaModeRestoreTab'))return;

    // qa-mode.js moderno ya trae su propio botón de plegado interno.
    // Lo reutilizamos y además mantenemos una pestaña externa para que TODO
    // el panel (incluidas extensiones añadidas después) pueda desaparecer.
    const title=panel.firstElementChild;
    const internalButton=title?.querySelector?.('button')||null;
    const restoreTab=document.createElement('button');
    restoreTab.id='qaModeRestoreTab';
    restoreTab.type='button';
    restoreTab.textContent='🤖 QA';
    restoreTab.title='Restaurar panel QA';
    restoreTab.setAttribute('aria-label','Restaurar panel QA');
    restoreTab.style.cssText='display:none;position:absolute;right:8px;top:76px;z-index:151;pointer-events:auto;border:1px solid #fbbf24;border-radius:999px;padding:7px 10px;background:rgba(2,11,39,.96);box-shadow:0 3px 10px rgba(0,0,0,.45);color:#fbbf24;font:800 11px/1 sans-serif;cursor:pointer';

    const setMinimized=minimized=>{
      panel.style.display=minimized?'none':'block';
      restoreTab.style.display=minimized?'block':'none';
    };
    if(internalButton){
      // Sustituye sólo la acción visual del botón; la prueba QA continúa.
      internalButton.addEventListener('click',()=>setMinimized(true));
      internalButton.title='Minimizar todo el QA';
    }else{
      const button=document.createElement('button');
      button.type='button';button.textContent='−';button.title='Minimizar todo el QA';
      button.style.cssText='position:absolute;right:7px;top:6px;width:24px;height:22px;border:1px solid #64748b;border-radius:5px;background:#172554;color:#f8fafc;font:800 16px/16px sans-serif;cursor:pointer';
      button.addEventListener('click',()=>setMinimized(true));
      panel.appendChild(button);
    }
    restoreTab.addEventListener('click',()=>setMinimized(false));
    panel.parentElement.appendChild(restoreTab);
  }
  if(window.QA_MODE)initQaPanelToggle();
  else window.addEventListener('gallina-qa-ready',initQaPanelToggle,{once:true});
})();

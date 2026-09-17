/*
 * Control visual del panel QA. Solo se carga cuando QA_MODE está activo.
 * No modifica la simulación ni las acciones del bot.
 */
if (window.QA_MODE) {
    const panel = document.getElementById('qaModePanel');
    if (panel && !document.getElementById('qaModeRestoreTab')) {
        const minimizeButton = document.createElement('button');
        minimizeButton.type = 'button';
        minimizeButton.textContent = '−';
        minimizeButton.title = 'Minimizar panel QA';
        minimizeButton.setAttribute('aria-label', 'Minimizar panel QA');
        minimizeButton.style.cssText = 'position:absolute;right:7px;top:6px;width:22px;height:20px;border:1px solid #64748b;border-radius:5px;background:#172554;color:#f8fafc;font:800 16px/16px sans-serif;cursor:pointer';
        const title = panel.firstElementChild;
        if (title) title.style.paddingRight = '27px';

        const restoreTab = document.createElement('button');
        restoreTab.id = 'qaModeRestoreTab';
        restoreTab.type = 'button';
        restoreTab.textContent = '🤖 QA';
        restoreTab.title = 'Restaurar panel QA';
        restoreTab.setAttribute('aria-label', 'Restaurar panel QA');
        restoreTab.style.cssText = 'display:none;position:absolute;right:8px;top:76px;z-index:150;pointer-events:auto;border:1px solid #fbbf24;border-radius:999px;padding:6px 9px;background:rgba(2,11,39,.94);box-shadow:0 3px 10px rgba(0,0,0,.45);color:#fbbf24;font:800 11px/1 sans-serif;cursor:pointer';

        const setMinimized = (minimized) => {
            panel.style.display = minimized ? 'none' : 'block';
            restoreTab.style.display = minimized ? 'block' : 'none';
        };
        minimizeButton.addEventListener('click', () => setMinimized(true));
        restoreTab.addEventListener('click', () => setMinimized(false));
        panel.appendChild(minimizeButton);
        panel.parentElement.appendChild(restoreTab);
    }
}

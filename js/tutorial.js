import { canvas, ctx, gameStats, saveStats, tutorialStep, setTutorialStep, gameState, setGameState } from './config.js';

export function activateTutorial(text, targetBtnId) {
    setGameState('TUTORIAL');
    document.getElementById('activeTutorialOverlay').style.display = 'flex';
    document.getElementById('activeTutorialText').innerHTML = text;
    if (targetBtnId) {
        if (Array.isArray(targetBtnId)) {
            targetBtnId.forEach(id => document.getElementById(id).classList.add('tutorial-highlight'));
        } else {
            document.getElementById(targetBtnId).classList.add('tutorial-highlight');
        }
        document.getElementById('tutorialOkBtn').style.display = 'none';
    } else {
        document.getElementById('tutorialOkBtn').style.display = 'block';
    }
}

export function completeTutorialStep(step) {
    if (tutorialStep !== step) return;
    document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
    document.getElementById('activeTutorialOverlay').style.display = 'none';
    setGameState('PLAYING');

    if (step === 1) {
        setTutorialStep(1.1);
        activateTutorial("¡Buen tiro!<br><br>Ahora prueba el <b>Misil Rastreador</b> tocando el botón amarillo (🎯).", 'missileBtn');
        return; 
    }
    if (step === 1.1) setTutorialStep(1.5);
    if (step === 2) setTutorialStep(2.5);
    if (step === 3) setTutorialStep(3.5);
    if (step === 4.5) {
        setTutorialStep(5);
        activateTutorial("¡Genial! Ya tienes tu primera evolución.<br><br>💡 <b>TIP EXTRA:</b> Si quieres cambiar los botones de posición, puedes <b>PAUSAR</b> el juego y moverlos libremente donde quieras.", null);
    }
}

window.finishTutorial = function() {
    document.getElementById('activeTutorialOverlay').style.display = 'none';
    setTutorialStep(0);
    gameStats.tutorialCompleted = true;
    saveStats();
    setGameState('PLAYING');
}

// LÓGICA DEL TUTORIAL INTERACTIVO
function activateTutorial(text, targetBtnId) {
    gameState = 'TUTORIAL';
    document.getElementById('activeTutorialOverlay').style.display = 'flex';
    document.getElementById('activeTutorialText').innerHTML = text;
    if (targetBtnId) {
        // Permite iluminar uno o varios botones a la vez
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

function completeTutorialStep(step) {
    if (tutorialStep !== step) return;
    document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
    document.getElementById('activeTutorialOverlay').style.display = 'none';
    gameState = 'PLAYING';

    if (step === 1) tutorialStep = 1.5; 
    if (step === 2) tutorialStep = 2.5;
    if (step === 3) tutorialStep = 3.5;
    if (step === 4.5) { // Nuevo final del tutorial
        tutorialStep = 5;
        activateTutorial("¡Genial! Ya tienes tu primera evolución.<br><br>💡 <b>TIP EXTRA:</b> Si quieres cambiar los botones de posición, puedes <b>PAUSAR</b> el juego y moverlos libremente donde quieras.", null);
    }
}

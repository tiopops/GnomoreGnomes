/* Gnomore Gnomes — estado inicial del menú principal.
   Regla de oro: cada mecánica en su propio archivo. La navegación de "Nueva Partida"
   vive en newgame-flow.js; este archivo solo prepara el estado del menú al cargar. */

function refreshResumeButton() {
  const resumeBtn = document.getElementById("btn-resume-game");
  resumeBtn.disabled = !SaveGame.hasSavedMatch();
}

document.addEventListener("DOMContentLoaded", refreshResumeButton);

// El botón de multijugador queda deshabilitado a propósito: sin backend todavía.

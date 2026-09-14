/* Gnomore Gnomes — lógica del menú principal.
   Regla de oro: cada mecánica en su propio archivo. Este solo gestiona el menú;
   el motor de juego (mapa, gnomos, turnos) vivirá en sus propios archivos aparte. */

function showFeedback(message) {
  let el = document.getElementById("menu-feedback");
  if (!el) {
    el = document.createElement("p");
    el.id = "menu-feedback";
    el.className = "menu-feedback";
    document.getElementById("main-menu").appendChild(el);
  }
  el.textContent = message;
  el.classList.remove("menu-feedback--show");
  // Forzar reflow para reiniciar la animación de aparición.
  void el.offsetWidth;
  el.classList.add("menu-feedback--show");
}

function refreshResumeButton() {
  const resumeBtn = document.getElementById("btn-resume-game");
  resumeBtn.disabled = !SaveGame.hasSavedMatch();
}

function initMenu() {
  refreshResumeButton();

  document.getElementById("btn-new-game").addEventListener("click", () => {
    // Placeholder hasta que exista el motor de juego real.
    SaveGame.save({ createdAt: Date.now(), status: "placeholder" });
    refreshResumeButton();
    showFeedback("Partida creada — el tablero de juego llegará en la próxima entrega.");
  });

  document.getElementById("btn-resume-game").addEventListener("click", () => {
    const match = SaveGame.load();
    if (!match) return;
    showFeedback("Reanudando partida — el tablero de juego llegará en la próxima entrega.");
  });

  // El botón de multijugador queda deshabilitado a propósito: sin backend todavía.
}

document.addEventListener("DOMContentLoaded", initMenu);

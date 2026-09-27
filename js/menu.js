/* Gnomore Gnomes — estado inicial del menú principal.
   Regla de oro: cada mecánica en su propio archivo. La navegación de "Nueva Partida"
   vive en newgame-flow.js; este archivo solo prepara el estado del menú al cargar. */

function refreshResumeButton() {
  const resumeBtn = document.getElementById("btn-resume-game");
  resumeBtn.disabled = !SaveGame.hasSavedMatch();
}

document.addEventListener("DOMContentLoaded", refreshResumeButton);

// El botón de multijugador queda deshabilitado a propósito: sin backend todavía.

// Easter egg — pedido explícito: "me gustaria que si le hicieras clic al
// gnomo que aparece en el logotipo de gnomoregnomes del menu principal el
// logo reaccionase como si le estuvieras pegando y un sonido de quejido de
// gnomo se reprodujera" — ver .main-logo--punched/@keyframes
// main-logo-punch (style.css) y SFX.gnomeOuch (sfx.js).
document.addEventListener("DOMContentLoaded", () => {
  const logo = document.querySelector(".main-logo");
  if (!logo) return;
  logo.addEventListener("click", () => {
    logo.classList.remove("main-logo--punched");
    void logo.offsetWidth; // reflow: reinicia la animación aunque se haga clic varias veces seguidas
    logo.classList.add("main-logo--punched");
    if (typeof SFX !== "undefined") SFX.gnomeOuch();
    setTimeout(() => logo.classList.remove("main-logo--punched"), 400);
  });
});

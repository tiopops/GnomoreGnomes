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
//
// CORRECCIÓN (pedido explícito, pasada posterior): "puedes hacer que el clic
// solo tenga efecto sobre la zona donde esta el gnomo en el logo y no sobre
// todo el logo?" — el listener ya NO va en .main-logo (la imagen entera),
// sino en .main-logo-hit, el botón invisible superpuesto solo sobre esa
// zona (ver su posición en %, css/style.css). La animación se sigue
// aplicando sobre .main-logo (la imagen) para que sea ESA la que se
// deforme, aunque el clic se haya escuchado en el botón de encima.
document.addEventListener("DOMContentLoaded", () => {
  const logo = document.querySelector(".main-logo");
  const hitEl = document.querySelector(".main-logo-hit");
  if (!logo || !hitEl) return;

  // Pedido explícito: "la deformacion al pulsar esta bien, pero dentro de
  // esos parametros puede ser aleatoria para que no siempre sea igual?" —
  // cada clic sortea una intensidad (0.75-1.3, la fuerza del golpe) y una
  // dirección (izquierda o derecha) que escalan los mismos valores de
  // siempre @keyframes main-logo-punch usaba fijos, aplicados como
  // variables CSS inline (ver esa regla en style.css) justo antes de lanzar
  // la animación — mismo golpe de siempre, nunca exactamente igual dos
  // veces seguidas.
  const BASE = {
    sx1: 0.08, sy1: 0.08, rot1: -4, tx1: -10,
    sx2: 0.06, sy2: 0.06, rot2: 3, tx2: 6,
    sx3: 0.02, sy3: 0.02, rot3: -1, tx3: -2,
  };
  function applyRandomPunchVars() {
    const intensity = 0.75 + Math.random() * 0.55; // 0.75 – 1.3
    const dir = Math.random() < 0.5 ? 1 : -1; // izquierda o derecha, al azar
    logo.style.setProperty("--punch-sx1", (1 - BASE.sx1 * intensity).toFixed(3));
    logo.style.setProperty("--punch-sy1", (1 + BASE.sy1 * intensity).toFixed(3));
    logo.style.setProperty("--punch-rot1", `${(BASE.rot1 * intensity * dir).toFixed(1)}deg`);
    logo.style.setProperty("--punch-tx1", `${(BASE.tx1 * intensity * dir).toFixed(1)}px`);
    logo.style.setProperty("--punch-sx2", (1 + BASE.sx2 * intensity).toFixed(3));
    logo.style.setProperty("--punch-sy2", (1 - BASE.sy2 * intensity).toFixed(3));
    logo.style.setProperty("--punch-rot2", `${(BASE.rot2 * intensity * dir).toFixed(1)}deg`);
    logo.style.setProperty("--punch-tx2", `${(BASE.tx2 * intensity * dir).toFixed(1)}px`);
    logo.style.setProperty("--punch-sx3", (1 - BASE.sx3 * intensity).toFixed(3));
    logo.style.setProperty("--punch-sy3", (1 + BASE.sy3 * intensity).toFixed(3));
    logo.style.setProperty("--punch-rot3", `${(BASE.rot3 * intensity * dir).toFixed(1)}deg`);
    logo.style.setProperty("--punch-tx3", `${(BASE.tx3 * intensity * dir).toFixed(1)}px`);
  }

  hitEl.addEventListener("click", () => {
    applyRandomPunchVars();
    logo.classList.remove("main-logo--punched");
    void logo.offsetWidth; // reflow: reinicia la animación aunque se haga clic varias veces seguidas
    logo.classList.add("main-logo--punched");
    if (typeof SFX !== "undefined") SFX.gnomeOuch();
    setTimeout(() => logo.classList.remove("main-logo--punched"), 400);
  });
});

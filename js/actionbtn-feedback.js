/* Respuesta al clic de los botones de acción de la unidad (habilidad propia,
   golpear gnomo, lanzar gnomo): sonido de selección + pequeño "pop" elástico.
   Va delegado en document para no tocar la mecánica de cada botón, y vale
   igual para ratón, táctil y mando (el mando lanza un click). */
const ActionBtnFeedback = {
  SEL: ".ability-btn, .gnome-action-btn",
  init() {
    document.addEventListener(
      "click",
      (e) => {
        const b = e.target.closest && e.target.closest(this.SEL);
        if (!b || b.disabled) return;
        if (typeof SFX !== "undefined") SFX.click();
        b.classList.remove("action-btn--pop");
        void b.offsetWidth; // reinicia la animación aunque se pulse seguido
        b.classList.add("action-btn--pop");
        clearTimeout(b._popT);
        b._popT = setTimeout(() => b.classList.remove("action-btn--pop"), 360);
      },
      true
    );
  },
};
ActionBtnFeedback.init();

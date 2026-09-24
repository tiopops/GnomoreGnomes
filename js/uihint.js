/* Gnomore Gnomes — aviso central de "esperando una acción del jugador"
   (UiHint). Pedido explícito: "cuando algo se queda esperando una accion
   por parte del usuario (por ejemplo: elige una zona) estos mensajes deben
   mostrarse en pantalla en una zona donde no entorpezca y donde sea
   claramente visible".

   Antes cada modo de "esperando algo" (colocar una unidad reclutada,
   apuntar una habilidad...) no avisaba de nada en texto — como mucho un
   cursor especial o unos marcadores en el tablero, fáciles de pasar por
   alto si el jugador no mira justo ahí. Este módulo da un único punto
   central, reutilizable desde cualquier archivo (obelisks.js, abilities.js,
   gnome.js...), para mostrar/ocultar ese aviso: "crear una vez, reutilizar"
   (mismo patrón que #epic-smash-flash/.shop-restock-msg), banner fijo,
   arriba y centrado — fuera del glory-hud (arriba-izquierda) y del engranaje
   de ajustes (arriba-derecha), así nunca tapa nada importante. */
const UiHint = {
  el: null,

  _ensure() {
    if (this.el) return;
    const el = document.createElement("div");
    el.className = "ui-hint";
    // Pedido explícito: "las interfaces con texto de instrucciones deben
    // ser cuadradas con las esquinas irregulares como el resto de las
    // interfaces...ahora tienen los bordes redondeados" — este aviso
    // migra al mismo doble-capa recortado en diagonal que el resto (ver
    // .ui-hint en style.css), así que el texto necesita vivir en su PROPIO
    // hijo con position:relative+z-index:2 (igual que .end-turn-btn__label
    // o cualquier otro contenido dentro de un banderín), nunca directamente
    // como textContent del contenedor — si no, el ::after (relleno) lo
    // taparía.
    const label = document.createElement("span");
    label.className = "ui-hint__label";
    el.appendChild(label);
    document.body.appendChild(el);
    this.el = el;
    this._labelEl = label;
  },

  // Muestra el aviso con el texto dado. Llamar de nuevo con otro texto
  // mientras ya está visible simplemente lo actualiza (no hay que ocultarlo
  // y volver a mostrarlo).
  show(text) {
    this._ensure();
    this._labelEl.textContent = text;
    this.el.classList.add("ui-hint--visible");
  },

  hide() {
    if (this.el) this.el.classList.remove("ui-hint--visible");
  },
};

/* Gnomore Gnomes — número de versión e historial de cambios.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - GG_VERSION: la versión actual (formato v.AABBCC: AA = fase, BB = bloque de
       contenido, CC = revisión dentro del bloque).
     - GG_CHANGELOG: lista de versiones, la más nueva primero.
     - La ventanita que se abre al pulsar el número del menú principal.
   MANTENIMIENTO: con cada mejora, contenido o corrección, subir GG_VERSION y
   añadir arriba una entrada (o ampliar la actual) con lo más relevante. */

const GG_VERSION = "v.001514";

const GG_CHANGELOG = [
  { v: "v.001514", date: "21/10/2026", title: "Recursos", items: [
    "Al poder recolectar un recurso, el puntero es un hacha amarilla",
  ] },
  { v: "v.001513", date: "21/10/2026", title: "Equipo", items: [
    "El recuadro de virtudes/debilidades y de unidades mide siempre exactamente lo mismo, sea cual sea el equipo o la unidad elegida",
  ] },
  { v: "v.001512", date: "21/10/2026", title: "Equipo", items: [
    "Nuevo diseño de virtudes y debilidades: dos tarjetas con cinta de título, iconos y una viñeta por frase",
  ] },
  { v: "v.001511", date: "21/10/2026", title: "Móvil", items: [
    "Equipo: el recuadro de virtudes y debilidades y el de la ficha de unidad miden siempre lo mismo y no recortan el texto en el móvil",
    "APK: la comprobación de versión se hace siempre al abrir la app (también con datos móviles), prueba varias vías de lectura y el aviso de advertencia ya no se queda fijo",
  ] },
  { v: "v.001510", date: "21/10/2026", title: "Sonido", items: [
    "El pitido de «¡Todos listos!» y la música se silencian al perder el foco la ventana (segundo plano) y vuelven al regresar",
  ] },
  { v: "v.001508", date: "21/10/2026", title: "Sacrificios", items: [
    "Al lanzar un gnomo contra una seta ya no se voltea boca abajo en el aire",
  ] },
  { v: "v.001507", date: "21/10/2026", title: "Sacrificios", items: [
    "Seta explosiva: el gnomo se carboniza en el sitio y se hunde en el suelo dejando un círculo de ceniza",
    "Al poder coger un gnomo, el puntero es la mano amarilla",
    "Los gnomos cargados valen más al sacrificarlos: +4 con 5 a 9 puntos y +5 con 10 o más",
  ] },
  { v: "v.001506", date: "21/10/2026", title: "Sacrificios", items: [
    "El botón Lanzar está siempre disponible cuando una unidad lleva un gnomo, aunque no haya más aliados",
    "Las casillas de sacrificio vuelven a mostrar el círculo habitual; la calavera aparece solo en el puntero",
  ] },
  { v: "v.001505", date: "21/10/2026", title: "Sacrificios", items: [
    "Las casillas de sacrificio muestran la calavera y el puntero cambia a una calavera al apuntar",
  ] },
  { v: "v.001504", date: "21/10/2026", title: "Sacrificios de gnomos", items: [
    "Nueva forma de ganar Gloria al instante: sacrificar gnomos. Cada sacrificio da +3 de Gloria",
    "Se pueden lanzar gnomos al volcán, a charcos de lava, al agua, a setas explosivas y a cepos",
    "Una piedra de Rock'n Troll o un cohete KataPum! contra un gnomo suelto también lo sacrifica",
    "Cuando un gnomo muere así, aparece otro enseguida en una zona aleatoria del escenario",
  ] },
  { v: "v.001503", date: "21/10/2026", title: "Tutoriales", items: [
    "Ya se puede abandonar un tutorial desde Ajustes: la confirmación de salir ya no queda tapada por Nizak ni bloqueada",
    "Con Ajustes o la confirmación abiertos, la viñeta, el puntero y el contador del tutorial se esconden",
  ] },
  { v: "v.001502", date: "21/10/2026", title: "Actualización de la APK", items: [
    "La comprobación de versión al abrir la app reintenta si GitHub tarda en responder",
    "El historial de versiones muestra, dentro de la APK, el paquete instalado y el resultado de la última comprobación",
    "Recuadro de información de escenario con el mismo tamaño en los tres niveles",
  ] },
  { v: "v.001501", date: "20/10/2026", title: "Móvil y APK", items: [
    "Menú principal nuevo: botones con cinta de color, logo más grande en móvil y sin scroll en escritorio",
    "Interfaz del móvil revisada en vertical y horizontal: ventanas, selección de equipo, perfil, amigos y ajustes",
    "Zoom con pellizco y doble toque corregidos en el tablero",
    "La música se pausa al salir de la app y el modo rendimiento se activa solo en móviles",
    "Iconos incluidos en la app, sin necesidad de conexión",
    "Reanudar partida retirado: abandonar cuenta como rendirse",
    "HurryCrane Village pasa a llamarse Poblado HurryCrane, con colores de recursos más integrados",
  ] },
  { v: "v.001500", date: "19/10/2026", title: "Progreso y partidas online", items: [
    "Nivel y experiencia de cuenta, y misiones diarias con racha",
    "Partida Rápida online: emparejamiento por nivel de habilidad, elección de equipo y ruleta de escenario",
    "Multijugador y Mi cuenta rediseñados",
    "Pantalla de actualización de la APK al abrir la app",
    "Tutorial más ligero",
  ] },
  { v: "v.001400", date: "18/10/2026", title: "App Android y rendimiento", items: [
    "APK de Android con actualización automática",
    "Suelo y niebla profunda dibujados en canvas, y modo rendimiento",
    "Ventanas de reclutar, armería y habilidades con tamaño fijo; tamaños de unidades ajustados",
    "La grulla se queda 2 turnos en cada obelisco; aterrizaje y plumas nuevos",
  ] },
  { v: "v.001300", date: "15/10/2026", title: "Pinball de HurryCrane", items: [
    "Bumpers repartidos por el mapa con turbo, luces y teledirigido; combos y ruleta de jackpot",
    "Huevo estilo pinball con guía de trayectoria, rebotes y premio tipo tragaperras",
    "La IA aprovecha bumpers y combos; tutorial del nivel y música propia",
  ] },
  { v: "v.001200", date: "13/10/2026", title: "Equipo SurcaNubes", items: [
    "Nuevo equipo SurcaNubes: ManosLargas, AlaFugaz y NidoBot con sus habilidades",
    "Nuevo nivel con el Huevo de Grulla",
    "La IA rival usa las habilidades de todos los equipos",
  ] },
  { v: "v.001100", date: "11/10/2026", title: "Oráculo y mando", items: [
    "Casa del Oráculo: cartas, beneficios y maldición",
    "Soporte de mando con teclado en pantalla; tutoriales adaptados al mando",
    "Tienda goblin con vendedor animado y moneda",
    "Partidas de 50 rondas con desempate por puntos y gloria máxima de 30",
    "Estadísticas de jugador y cambio de nombre cada 7 días",
  ] },
  { v: "v.001000", date: "08/10/2026", title: "Multijugador y tutoriales", items: [
    "Multijugador 1 contra 1 con invitaciones de amigos y sala",
    "Tutoriales de MushBoom y Rock'n Troll con su propio submenú",
    "Efectos de goma al pegar, lanzar y ahogarse",
  ] },
  { v: "v.000900", date: "05/10/2026", title: "Colinas Rock'n Troll", items: [
    "Volcán con erupción, gnomos en llamas, lava y piedras",
    "Tambores de guerra con lluvia de rocas",
    "Reliquias nuevas y pantalla final con el emblema del equipo ganador",
  ] },
  { v: "v.000800", date: "Septiembre 2026", title: "Base del juego", items: [
    "Mapa, niebla de guerra, obeliscos, tótems, combate y tutorial de Nizak",
    "Equipos de MushBoom y cuentas de jugador",
  ] },
];

const VersionInfo = {
  _overlay: null,

  init() {
    const btn = document.getElementById("btn-version");
    if (!btn) return;
    btn.textContent = GG_VERSION;
    btn.addEventListener("click", () => this.open());
  },

  _build() {
    const overlay = document.createElement("div");
    overlay.className = "settings-overlay version-overlay";
    overlay.addEventListener("click", () => this.close());
    const panel = document.createElement("div");
    panel.className = "p5-banner version-panel";
    panel.addEventListener("click", (e) => e.stopPropagation());
    const close = document.createElement("button");
    close.type = "button";
    close.className = "backpack-close-btn";
    close.setAttribute("aria-label", "Cerrar");
    close.innerHTML = '<i class="ph ph-x backpack-close-btn__icon"></i>';
    close.addEventListener("click", (e) => { e.stopPropagation(); this.close(); });
    panel.appendChild(close);
    const title = document.createElement("div");
    title.className = "p5-banner__label settings-panel__title version-panel__title";
    title.textContent = "HISTORIAL DE VERSIONES";
    panel.appendChild(title);
    const list = document.createElement("div");
    list.className = "version-list";
    list.innerHTML = GG_CHANGELOG.map((e, i) =>
      '<section class="version-entry' + (i === 0 ? " version-entry--current" : "") + '">' +
        '<div class="version-entry__head"><span class="version-entry__tag">' + e.v + "</span>" +
        '<span class="version-entry__title">' + e.title + "</span>" +
        '<span class="version-entry__date">' + e.date + "</span></div>" +
        "<ul>" + e.items.map((t) => "<li>" + t + "</li>").join("") + "</ul></section>"
    ).join("");
    panel.appendChild(list);
    // Dentro de la APK: versión del paquete instalado y resultado de la última comprobación.
    if (typeof AppUpdate !== "undefined" && AppUpdate.isNative()) {
      const dbg = document.createElement("div");
      dbg.className = "version-build";
      let st = AppUpdate.status || "";
      if (!st) { try { st = (localStorage.getItem("gg_update_status") || "").split("|").slice(1).join("|"); } catch (e) {} }
      dbg.textContent = "Paquete " + (AppUpdate.localVersion || "?") + " · " + (st || "sin comprobar");
      panel.appendChild(dbg);
    }
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    this._overlay = overlay;
  },

  open() {
    if (!this._overlay) this._build();
    if (typeof SFX !== "undefined" && SFX.click) SFX.click();
    this._overlay.querySelector(".version-list").scrollTop = 0;
    requestAnimationFrame(() => this._overlay.classList.add("settings-overlay--visible"));
  },

  close() {
    if (this._overlay) this._overlay.classList.remove("settings-overlay--visible");
  },
};

document.addEventListener("DOMContentLoaded", () => VersionInfo.init());

/* Gnomore Gnomes — indicador opcional de equipo (pedido explícito: "otro
   chekbox, llamado mostrar equipos. esta opcion por defecto viene
   desabilitada, si se habilita muestra un circulo azul bajo los aliados y
   uno rojo bajo los enemigos en la casilla en la que estan").
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe leer/
   guardar la preferencia (mismo patrón que js/shadows.js / js/sfx.js:
   localStorage propio, deshabilitado no es lo mismo que "sin guardar
   todavía") y alternar una única clase en <body> — el círculo en sí es un
   hijo más de cada .unit (ver Units.spawnUnit en units.js), ya coloreado
   por equipo (.unit__team-marker--player azul / --enemy rojo) y oculto por
   defecto en CSS, así que activar/desactivar no necesita tocar unidad por
   unidad, un solo toggle de clase basta para todas a la vez, incluso las
   que se generen después de activarlo (el rival de la IA, por ejemplo). */
const TeamMarkers = {
  _STORAGE_KEY: "gnomoregnomes_teammarkers",
  enabled: false,

  init() {
    const saved = localStorage.getItem(this._STORAGE_KEY);
    // "por defecto viene desabilitada" — a diferencia de Sombras/SFX (que
    // por defecto SÍ están activas), aquí null también significa false.
    this.enabled = saved === "1";
    document.body.classList.toggle("team-markers--visible", this.enabled);
  },

  setEnabled(enabled) {
    this.enabled = !!enabled;
    localStorage.setItem(this._STORAGE_KEY, this.enabled ? "1" : "0");
    document.body.classList.toggle("team-markers--visible", this.enabled);
  },
};

document.addEventListener("DOMContentLoaded", () => TeamMarkers.init());

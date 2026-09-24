/* Gnomore Gnomes — modo de rendimiento ("resolución adaptada").
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Activar/desactivar el modo, persistiendo la preferencia en
       localStorage — ver el checkbox correspondiente en js/settingsmenu.js.
     - Alternar UNA clase en <body>; el trabajo real lo hace CSS (ver
       "body.perf-mode *" en style.css).

   Pedido explícito: "tampoco veo la opcion de la configuracion de la
   resolucion dinamiga paara mejorar el rendimiento... de ser asi continua
   con la tanda". No hay un <canvas> ni un motor 3D aquí — todo el juego se
   pinta con DOM+CSS — así que "resolución dinámica" en el sentido estricto
   de un juego con render 3D (bajar la resolución interna del framebuffer)
   no aplica. Lo que SÍ es equivalente, y lo que de verdad cuesta caro de
   componer en un móvil de gama baja en un juego 100% CSS, son
   filter:drop-shadow(...) y backdrop-filter:blur(...): recalculan una
   máscara de alpha píxel a píxel bajo el elemento en cada fotograma, y
   aparecen por TODO el juego (el "banderín" .p5-banner que usan decenas de
   paneles, los overlays con blur, el halo del cursor de ataque...). Igual
   que Shadows/Fog ya hacen con sus propios efectos caros, este modo
   desactiva esos dos de golpe con una única regla CSS con !important en
   vez de tocar cada regla suelta — no cambia ninguna FORMA (los banderines
   siguen recortados por su clip-path de siempre, ver la nota de .p5-banner
   en style.css), así que no hay ningún "fallo gráfico" posible, solo una
   interfaz más plana y barata de pintar. Por defecto DESACTIVADO (igual
   que "Mostrar equipos"): es un ajuste de compromiso visual a cambio de
   rendimiento, así que debe pedirse a propósito, no imponerse solo. */

const PerfMode = {
  _STORAGE_KEY: "gnomoregnomes_perfmode",
  enabled: false,

  init() {
    const saved = localStorage.getItem(this._STORAGE_KEY);
    this.enabled = saved === "1";
    this._applyGlobalToggle();
  },

  setEnabled(enabled) {
    this.enabled = !!enabled;
    localStorage.setItem(this._STORAGE_KEY, this.enabled ? "1" : "0");
    this._applyGlobalToggle();
  },

  _applyGlobalToggle() {
    document.body.classList.toggle("perf-mode", this.enabled);
  },
};

document.addEventListener("DOMContentLoaded", () => PerfMode.init());

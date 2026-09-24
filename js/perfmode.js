/* Gnomore Gnomes — modo de rendimiento ("resolución adaptada").
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Activar/desactivar el modo, persistiendo la preferencia en
       localStorage — ver el checkbox correspondiente en js/settingsmenu.js.
     - Alternar UNA clase en <body>; el trabajo real lo hace CSS (ver
       "body.perf-mode *" en style.css).
     - Al activarse, apagar de paso Shadows y la animación de niebla (ver
       más abajo) — el resto de su estado (checkboxes propios) lo sigue
       llevando cada uno.

   Pedido explícito: "tampoco veo la opcion de la configuracion de la
   resolucion dinamiga paara mejorar el rendimiento... de ser asi continua
   con la tanda". No hay un <canvas> ni un motor 3D aquí — todo el juego se
   pinta con DOM+CSS — así que "resolución dinámica" en el sentido estricto
   de un juego con render 3D (bajar la resolución interna del framebuffer)
   no aplica. Lo que SÍ es equivalente en un juego 100% CSS es apagar de
   golpe los efectos más caros de recomponer en un móvil de gama baja:
   backdrop-filter:blur (los overlays), el filter:drop-shadow puramente
   decorativo del "banderín" .p5-banner y del halo del cursor de ataque
   (ver la nota larga junto a "body.perf-mode" en style.css — la regla es
   quirúrgica a propósito, nunca toca un filter con significado de estado
   como el de .unit--exhausted), y las sombras proyectadas (Shadows) + la
   animación de niebla (Fog), que YA eran ajustes de rendimiento propios
   con su checkbox.

   Segundo pedido explícito, encima del anterior: "el modo rendimiento
   deberia desactivar por defecto las sombras y la niebla animada" — así
   que activar este modo llama también a Shadows.setEnabled(false) y
   Fog.setAnimEnabled(false) (cada uno persiste lo suyo en su propia
   localStorage, como si el jugador hubiera destocado esos dos checkboxes
   a mano); DESACTIVAR el modo rendimiento NO los vuelve a encender solo —
   quedan como el jugador los deje, para no deshacerle una elección suya
   sin pedirlo. */

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
    if (this.enabled) {
      if (typeof Shadows !== "undefined") Shadows.setEnabled(false);
      if (typeof Fog !== "undefined" && typeof Fog.setAnimEnabled === "function") Fog.setAnimEnabled(false);
    }
  },

  _applyGlobalToggle() {
    document.body.classList.toggle("perf-mode", this.enabled);
  },
};

document.addEventListener("DOMContentLoaded", () => PerfMode.init());

/* Gnomore Gnomes — precarga de los assets más pesados antes de empezar una
   partida.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Qué imágenes son lo bastante pesadas como para notarse un tirón la
       primera vez que aparecen en pantalla (recursos de escenario,
       hierbajos, arbustos, objetos de mochila — universales, no dependen
       de la raza elegida ni del modo) y adelantar su descarga+
       decodificado ANTES de que el jugador las vea aparecer de golpe al
       explorar.
     - Pintar una barra de carga fija (mismo estilo p5-banner del resto de
       interfaces) mientras dura esa precarga.

   Pedido explícito: "crees que si precargasemos en local los elementos
   mas pesados que hacen que se relentice el juego iria todo mejor? si es
   necesario poner una barrita de loading (respetando nuestro estilo
   visual)...siempre y cuando no dure demasiado, pocos segundos". Sí:
   hasta ahora estas imágenes (varias de 1-1.7MB, PNG sin comprimir a
   fondo) se pedían la PRIMERA vez que Resources/Bushes/Hierbajos/Backpack
   las necesitaban de verdad — normalmente revelando niebla o abriendo la
   mochila en plena partida, así que la descarga+decodificado (con
   imágenes de este tamaño el decodificado en sí ya pesa, no solo la red)
   se notaba como un tirón justo en mitad de jugar. Adelantarlas TODAS DE
   GOLPE con un <img> nuevo antes de mostrar el tablero mueve ese coste a
   un momento controlado y avisado, en vez de sufrirlo sin avisar a media
   exploración.

   Tope de espera FIJO (_MAX_WAIT_MS): pedido explícito "que no dure
   demasiado, pocos segundos" — si la conexión es lenta, se deja de
   esperar y se entra a la partida igual; las imágenes que no llegaran a
   tiempo simplemente se piden más tarde como pasaba antes (nunca rompe
   nada, solo mejora el caso favorable). Solo se ejecuta UNA VEZ por
   sesión de página (_done): una vez descargadas y decodificadas, el
   propio navegador ya las tiene en caché el resto de la sesión, así que
   repetir la espera en la segunda partida no aportaría nada. */

const Preload = {
  _done: false,
  _overlayEl: null,
  _fillEl: null,

  _MAX_WAIT_MS: 3500,

  // Los más pesados y universales del proyecto (ver du -h assets/), nunca
  // dependen de la raza ni del modo elegido:
  _HEAVY_ASSETS: [
    // Recursos de escenario (js/resources.js) — nodo en el tablero + icono
    // de HUD/mochila de cada uno, 1.2-1.7MB cada uno.
    "assets/iconos/recurso_roca_nodo.png",
    "assets/iconos/recurso_pino_nodo.png",
    "assets/iconos/recurso_mena_nodo.png",
    "assets/iconos/recurso_madera.png",
    "assets/iconos/recurso_roca.png",
    "assets/iconos/recurso_metal.png",
    // Decoración de escenario (js/hierbajos.js/bushes.js) — igual de
    // universal, se revela con la niebla en cualquier mapa.
    "assets/escenario/hierbajos.png",
    "assets/iconos/arbusto.png",
    // Objetos de mochila (js/backpack.js) — universales, no dependen de
    // la raza ni del mapa.
    "assets/iconos/atrapapinreles.png",
    "assets/iconos/katapum.png",
  ],

  // Se llama justo ANTES de construir una partida nueva o reanudada (ver
  // startMatch/resumeMatch en js/newgame-flow.js) — async a propósito,
  // quien la llame debe esperarla (await) antes de seguir con el resto de
  // la construcción de la partida.
  async run() {
    if (this._done) return;
    this._done = true; // una sola vez por sesión de página, pase lo que pase abajo
    this._ensureOverlay();
    this._show();
    let loaded = 0;
    const total = this._HEAVY_ASSETS.length;
    this._updateProgress(0, total);
    const loadAll = Promise.all(
      this._HEAVY_ASSETS.map(
        (url) =>
          new Promise((resolve) => {
            const img = new Image();
            img.decoding = "async";
            // onerror también resuelve (nunca bloquea la partida por un
            // asset que falle en cargar) — el mismo <img> descartado no
            // deja nada a medias, solo no llegó a precargarse.
            img.onload = img.onerror = () => {
              loaded++;
              this._updateProgress(loaded, total);
              resolve();
            };
            img.src = url;
          })
      )
    );
    await Promise.race([loadAll, new Promise((resolve) => setTimeout(resolve, this._MAX_WAIT_MS))]);
    this._hide();
  },

  _ensureOverlay() {
    if (this._overlayEl) return;
    const overlay = document.createElement("div");
    overlay.className = "match-loading-overlay";
    overlay.innerHTML = `
      <div class="p5-banner match-loading-panel">
        <div class="match-loading-panel__content">
          <div class="match-loading-panel__title">Preparando el escenario…</div>
          <div class="match-loading-panel__track">
            <div class="match-loading-panel__fill"></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    this._overlayEl = overlay;
    this._fillEl = overlay.querySelector(".match-loading-panel__fill");
  },

  _updateProgress(loaded, total) {
    if (!this._fillEl) return;
    const pct = total ? Math.round((loaded / total) * 100) : 100;
    this._fillEl.style.width = `${pct}%`;
  },

  _show() {
    if (this._overlayEl) this._overlayEl.classList.add("match-loading-overlay--visible");
  },

  _hide() {
    if (this._overlayEl) this._overlayEl.classList.remove("match-loading-overlay--visible");
  },
};

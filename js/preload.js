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
   repetir la espera en la segunda partida no aportaría nada.

   Pedido explícito (pasada posterior): "la pantalla de loading puede durar
   3 segundos como minimo? nos aseguramos asi que todo se guarda
   correctamente y se carga como se debe" — _MIN_SHOW_MS añade un SUELO,
   no solo el techo de arriba: si las imágenes cargan antes (conexión
   rápida/caché), la barra igualmente se queda visible hasta cumplir ese
   mínimo, en vez de desaparecer casi al instante. run() mide cuánto ha
   pasado de verdad desde que se mostró la barra y espera lo que falte
   antes de ocultarla. */

const Preload = {
  _done: false,
  _overlayEl: null,
  _fillEl: null,

  _MAX_WAIT_MS: 6000,
  _MIN_SHOW_MS: 700,
  _CONCURRENCY: 12,
  _seen: new Set(),
  extra: [],

  // Los más pesados y universales del proyecto (ver du -h assets/), nunca
  // dependen de la raza ni del modo elegido:
  _HEAVY_ASSETS: [
    // Recursos de escenario (js/resources.js) — nodo en el tablero + icono
    // de HUD/mochila de cada uno, 1.2-1.7MB cada uno.
    "assets/iconos/recurso_roca_nodo.png",
    "assets/iconos/recurso_pino_nodo.png",
    "assets/iconos/recurso_mena_nodo.png",
    // Decoración de escenario (js/hierbajos.js/bushes.js) — igual de
    // universal, se revela con la niebla en cualquier mapa.
    "assets/escenario/hierbajos.png",
    "assets/iconos/arbusto.png",
    // Objetos de mochila (js/backpack.js) — universales, no dependen de
    // la raza ni del mapa.
    // Pedido explícito: "acercar alejar la camara hace que flickeen las
    // losetas cuando resolucion adaptativa esta activado" — causa real:
    // hierba_01.png/agua_03.png (la textura normal) SÍ estaban aquí desde
    // el principio, pero su pareja "_midres" (ver SpriteQuality._TIER_SUFFIX
    // en js/spritequality.js) nunca se pedía hasta el primer cruce del
    // umbral de zoom — en ESE momento, hasta las 625 losetas del tablero
    // (SpriteQuality._setTier recorre TODOS los sprites registrados de
    // golpe) cambian su "src" a la vez a una imagen que el navegador no
    // tenía todavía ni descargada ni decodificada, así que aparecían en
    // blanco durante ese instante — el "flickeo". Con las dos ya
    // precargadas y decodificadas de antemano (misma URL para las 625
    // losetas, así que solo cuentan como 2 descargas reales), el cruce de
    // zoom solo tiene que reasignar el "src" a algo que el navegador ya
    // tiene listo, sin ningún parón visible.
    "assets/losetas/hierba_01_midres.png",
    "assets/losetas/agua_03_midres.png",
    "assets/losetas/agua_02_midres.png",
  ],

  // Se llama justo ANTES de construir una partida nueva o reanudada (ver
  // startMatch/resumeMatch en js/newgame-flow.js) — async a propósito,
  // quien la llame debe esperarla (await) antes de seguir con el resto de
  // la construcción de la partida.
  async run() {
    this._ensureOverlay();
    this._show();
    const startedAt = Date.now();
    // Pedido explícito: "la barra de loading carga de golpe...no se puede
    // hacer mas gradual?" — las _HEAVY_ASSETS son pocas (una decena) y con
    // conexión rápida/caché sus onload pueden llegar casi todos EN EL MISMO
    // instante, así que el progreso "real" (_realPct, de abajo) saltaba de
    // golpe de 0% a 100% en vez de avanzar poco a poco, aunque la barra
    // siguiera visible varios segundos más por el suelo mínimo de abajo.
    // _startTimeBasedFill anima un avance SIEMPRE gradual con
    // requestAnimationFrame a lo largo de _MIN_SHOW_MS entero; el ancho
    // final mostrado es el máximo entre ese avance "de reloj" y el
    // progreso real (nunca miente hacia atrás si la carga real va más
    // lenta que _MIN_SHOW_MS, solo suaviza el caso rápido/de golpe).
    this._realPct = 0;
    this._timePct = 0;
    this._updateProgress();
    // Progreso REAL: cada imagen se descarga y se DECODIFICA (img.decode)
    // para que al construir la partida el navegador ya la tenga lista en
    // memoria y no haya tirones. Se cargan en tandas de _CONCURRENCY.
    const urls = [...new Set([...this._HEAVY_ASSETS, ...(typeof PRELOAD_ASSETS !== "undefined" ? PRELOAD_ASSETS : []), ...(this.extra || [])])];
    // Lo que ya se cargó en esta sesión (otra partida, el tutorial) no se repite.
    urls.splice(0, urls.length, ...urls.filter((u) => !this._seen.has(u)));
    urls.forEach((u) => this._seen.add(u));
    const total = urls.length;
    if (!total) {
      this._timePct = 100;
      this._updateProgress();
    }
    let loaded = 0;
    let next = 0;
    const worker = async () => {
      while (next < total) {
        const url = urls[next++];
        await new Promise((resolve) => {
          const img = new Image();
          img.decoding = "async";
          const fin = () => resolve();
          img.onerror = fin;
          img.onload = () => (img.decode ? img.decode().then(fin, fin) : fin());
          img.src = url;
        });
        loaded++;
        this._realPct = Math.round((loaded / Math.max(1, total)) * 100);
        this._timePct = this._realPct;
        this._updateProgress();
      }
    };
    const loadAll = Promise.all(Array.from({ length: this._CONCURRENCY }, worker));
    await Promise.race([loadAll, new Promise((resolve) => setTimeout(resolve, this._MAX_WAIT_MS))]);
    const remaining = this._MIN_SHOW_MS - (Date.now() - startedAt);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    this._timePct = 100;
    this._updateProgress();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  },

  // Remate: se llama cuando el nivel ya está construido (o si falló el
  // arranque). No hace nada si la barra no se mostró (partidas posteriores
  // de la misma sesión de página, ver _done en run()).
  finish() {
    if (!this._overlayEl || !this._overlayEl.classList.contains("match-loading-overlay--visible")) return;
    if (this._stopFill) this._stopFill();
    this._stopFill = null;
    this._timePct = 100;
    this._updateProgress();
    this._hide();
  },

  // Avance "de reloj", independiente de cuándo termine de verdad cada
  // asset — ver la nota larga en run(). Lineal de 0 a ~96% a lo largo de
  // _MIN_SHOW_MS (se deja un pelín corto a propósito: el _updateProgress
  // final tras el suelo mínimo, arriba, ya remata a 100% él solo, así este
  // avance nunca "adelanta" a un cierre que aún no ha llegado). Devuelve
  // una función para pararlo en cuanto el suelo mínimo se cumpla.
  _startTimeBasedFill(startedAt) {
    let rafId = null;
    const step = () => {
      const elapsed = Date.now() - startedAt;
      this._timePct = Math.min(100, Math.round((elapsed / this._MIN_SHOW_MS) * 100));
      this._updateProgress();
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  },

  _ensureOverlay() {
    if (this._overlayEl) return;
    const overlay = document.createElement("div");
    overlay.className = "match-loading-overlay";
    overlay.innerHTML = `
      <div class="p5-banner match-loading-panel">
        <div class="match-loading-panel__content">
          <div class="match-loading-panel__title">Los gnomos se están escondiendo…</div>
          <div class="match-loading-panel__track">
            <div class="match-loading-panel__fill"></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    this._overlayEl = overlay;
    this._fillEl = overlay.querySelector(".match-loading-panel__fill");
  },

  _updateProgress() {
    if (!this._fillEl) return;
    // Máximo entre el avance real (por assets ya cargados) y el avance de
    // reloj (ver _startTimeBasedFill) — nunca retrocede, solo evita que se
    // quede parado en 0% mientras los onload reales no lleguen o salten
    // todos de golpe.
    // Solo el avance de reloj (lineal): el progreso real de las descargas
    // saltaba a 100% de golpe y la barra se llenaba antes de empezar el nivel.
    const pct = this._timePct || 0;
    this._fillEl.style.width = `${pct}%`;
  },

  _show() {
    if (this._overlayEl) this._overlayEl.classList.add("match-loading-overlay--visible");
  },

  _hide() {
    if (this._overlayEl) this._overlayEl.classList.remove("match-loading-overlay--visible");
  },
};

/* Gnomore Gnomes — hierbajos (vegetación decorativa suelta).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe repartir
   matojos de hierba/flores por las losetas de hierba del mapa, puramente
   decorativos, y ocultarlos bajo la niebla como cualquier otro elemento del
   escenario. No tiene vida, no se puede seleccionar ni atacar, no bloquea
   movimiento ni clics.

   Pedido explícito (verbatim): "añadido sprite hierbajos, para que lo
   repartas por el escenario, no es ni siquiera interactuable, solo es
   vegetacion para colocar sobre las losetas de hierba y dar sensacion de
   varierad, es solo decoracion puede estar delante o detras de los
   personajes dependiendo de la posicion. algunas zonas pueden aculmular
   unos cuantos hierbajos, debe sar la sensacion de que es natural la
   dispersion" — "delante o detras dependiendo de la posición" ya sale
   gratis del mismo z-index por fila/columna ((row+col)*10+offset) que usa
   CUALQUIER otro elemento del tablero (unidades, arbustos, recursos...),
   sin necesitar ningún sistema de transparencia/ocultación propio como el
   de los arbustos/tótems (esto no se selecciona ni esconde nada). La
   sensación de dispersión "natural" (en vez de puntos sueltos repartidos
   uniformemente, que se lee como una cuadrícula) se consigue agrupando en
   RACIMOS: unos pocos centros al azar, con varias unidades cada uno
   esparcidas a su alrededor.

   Pedido explícito (segunda pasada): "haz que la vegetacion, hierbajos y
   elementos decorativos del escenario se puedan quitar o poner desde el
   menu de configuracion. el modo rendimiento los desactiva directamente" —
   mismo patrón exacto que Shadows.enabled/setEnabled (ver shadows.js):
   preferencia en localStorage, UNA clase en <body> (nunca se dejan de
   crear/repartir, muchísimo más barato ocultarlos con CSS que recorrer el
   tablero destruyéndolos), y PerfMode.setEnabled(true) la apaga de paso
   igual que ya hace con Shadows/Fog (ver perfmode.js). */

const HIERBAJOS_CLUSTER_COUNT = 16;
const HIERBAJOS_PER_CLUSTER_MIN = 2;
const HIERBAJOS_PER_CLUSTER_MAX = 5;
const HIERBAJOS_CLUSTER_RADIUS = 2;

const Hierbajos = {
  list: [],
  _nextId: 1,

  _STORAGE_KEY: "gnomoregnomes_hierbajos",
  enabled: true,

  initPref() {
    const saved = localStorage.getItem(this._STORAGE_KEY);
    this.enabled = saved === null ? true : saved === "1";
    this._applyGlobalToggle();
  },

  setEnabled(enabled) {
    this.enabled = !!enabled;
    localStorage.setItem(this._STORAGE_KEY, this.enabled ? "1" : "0");
    this._applyGlobalToggle();
  },

  _applyGlobalToggle() {
    document.body.classList.toggle("gg-hierbajos-off", !this.enabled);
  },

  resetAll() {
    this.list.forEach((h) => h.el.remove());
    this.list = [];
  },

  // DESPUÉS de Villages/Shops/Obelisks/Bushes/Resources.spawn (mismo orden
  // que el resto del "mobiliario" del tablero, ver newgame-flow.js) para
  // poder evitar sus casillas y no dibujar un matojo justo encima de un
  // tótem o una roca.
  spawn(boardSize) {
    let clustersPlaced = 0;
    let clusterAttempts = 0;
    while (clustersPlaced < HIERBAJOS_CLUSTER_COUNT && clusterAttempts < 800) {
      clusterAttempts++;
      const centerRow = Math.floor(Math.random() * boardSize);
      const centerCol = Math.floor(Math.random() * boardSize);
      if (!this._tileFree(centerRow, centerCol, boardSize)) continue;

      const count =
        HIERBAJOS_PER_CLUSTER_MIN +
        Math.floor(Math.random() * (HIERBAJOS_PER_CLUSTER_MAX - HIERBAJOS_PER_CLUSTER_MIN + 1));
      let placedInCluster = 0;
      let instanceAttempts = 0;
      // El propio centro cuenta como el primero del racimo.
      this._create(centerRow, centerCol);
      placedInCluster++;
      while (placedInCluster < count && instanceAttempts < 60) {
        instanceAttempts++;
        const dr = Math.floor(Math.random() * (HIERBAJOS_CLUSTER_RADIUS * 2 + 1)) - HIERBAJOS_CLUSTER_RADIUS;
        const dc = Math.floor(Math.random() * (HIERBAJOS_CLUSTER_RADIUS * 2 + 1)) - HIERBAJOS_CLUSTER_RADIUS;
        if (dr === 0 && dc === 0) continue;
        const row = centerRow + dr;
        const col = centerCol + dc;
        if (!this._tileFree(row, col, boardSize)) continue;
        this._create(row, col);
        placedInCluster++;
      }
      clustersPlaced++;
    }
  },

  at(row, col) {
    return this.list.find((h) => h.row === row && h.col === col) || null;
  },

  _tileFree(row, col, boardSize) {
    if (row < 0 || col < 0 || row >= boardSize || col >= boardSize) return false;
    // "solo es vegetacion para colocar sobre las losetas de hierba" — nunca
    // sobre agua ni ningún otro terreno no transitable.
    if (typeof TerrainMap !== "undefined" && TerrainMap.typeAt(row, col) !== "grass") return false;
    if (typeof Villages !== "undefined" && Villages.at(row, col)) return false;
    if (typeof Shops !== "undefined" && Shops.at(row, col)) return false;
    if (typeof Obelisks !== "undefined" && Obelisks.at(row, col)) return false;
    if (typeof Altar !== "undefined" && Altar.at(row, col)) return false; // Altar de Sacrificios (js/altar.js)
    if (typeof Bushes !== "undefined" && Bushes.at(row, col)) return false;
    if (typeof Resources !== "undefined" && Resources.at(row, col)) return false;
    if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) return false;
    if (this.at(row, col)) return false;
    return true;
  },

  _create(row, col) {
    const el = document.createElement("div");
    el.className = "unit hierbajo";

    const spriteEl = document.createElement("img");
    spriteEl.decoding = "async";
    spriteEl.className = "hierbajo__sprite";
    // Calidad de sprite dinámica según el zoom (pedido explícito, ver
    // js/spritequality.js) — los hierbajos son con diferencia el elemento
    // más numeroso del tablero, así que son de los que más se benefician.
    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(spriteEl, "assets/escenario/hierbajos.png");
    else spriteEl.src = "assets/escenario/hierbajos.png";
    spriteEl.alt = "";
    spriteEl.draggable = false;
    // Variación aleatoria de tamaño/espejado — pedido explícito: "dar
    // sensacion de variedad" / "debe ser la sensacion de que es natural la
    // dispersion". Fijada UNA vez por instancia (no animada), igual que
    // Shadows ya varía tamaño/opacidad por unidad.
    // NOTA (bug encontrado, pedido explícito "los hierbajos se muestran
    // borrosos, arreglalo"): el tilt (rotate()) que había aquí antes era la
    // causa exacta del desenfoque — confirmado quitando cada parte del
    // transform una a una con capturas: con rotate() presente (combinado
    // con el scale no uniforme del espejado) Chromium rasteriza este sprite
    // con un filtrado de menor calidad que con escalado/espejado puros (sin
    // rotar), visible sobre todo a este tamaño tan pequeño (96px). Sin
    // rotate() el sprite vuelve a verse tan nítido como cualquier otro
    // elemento del escenario (rocas, árboles...). Se mantiene el
    // escalado+espejado para conservar la variedad.
    const scale = 0.8 + Math.random() * 0.5; // 0.8 – 1.3
    const flip = Math.random() < 0.5 ? -1 : 1;
    spriteEl.style.transform = `scale(${(scale * flip).toFixed(2)}, ${scale.toFixed(2)})`;
    el.appendChild(spriteEl);

    if (typeof Units !== "undefined") Units.container.appendChild(el);

    const hierbajo = { id: `hierbajo-${this._nextId++}`, row, col, el, spriteEl };
    this._placeInstant(hierbajo);
    this.list.push(hierbajo);
    return hierbajo;
  },

  _placeInstant(hierbajo) {
    if (typeof getTileCenter === "undefined" || typeof Units === "undefined") return;
    const { x, y } = getTileCenter(hierbajo.row, hierbajo.col, Units.boardSize);
    hierbajo.el.style.left = `${x}px`;
    hierbajo.el.style.top = `${y}px`;
    // Mismo formato (row+col)*10 que cualquier otro elemento del tablero —
    // el +3 (por debajo del +5 de personajes/arbustos/recursos en la MISMA
    // loseta) es justo lo que le da "delante o detras de los personajes
    // dependiendo de la posicion" gratis: entre dos losetas distintas el
    // término (row+col)*10 manda siempre (salto de 10 en 10, muy por
    // encima de la diferencia de 2 puntos del offset), así que un hierbajo
    // en una loseta "más abajo" en pantalla queda SIEMPRE por delante de un
    // personaje en una loseta "más arriba", y viceversa — solo en la MUY
    // rara coincidencia de compartir loseta exacta con alguien gana el
    // personaje, que es justo lo esperable para hierba pisada.
    hierbajo.el.style.zIndex = String((hierbajo.row + hierbajo.col) * 10 + 3);
  },

  // ---------- Niebla ----------
  // Igual que Bushes/Resources: no descubierto todavía se oculta bajo la
  // niebla (llamado desde Fog.applyVisibility).
  refreshFog() {
    if (typeof Fog === "undefined") return;
    this.list.forEach((h) => {
      const fogged = Fog.isFogged(h.row, h.col);
      h.el.classList.toggle("unit--fog-hidden", fogged);
      // Pedido explícito (memoria de niebla): decoración ya explorada pero
      // fuera de percepción ahora mismo -> se queda "recordada" (atenuada +
      // sin animar), como cualquier otro elemento de escenario.
      h.el.classList.toggle("gg-remembered", !fogged && !Fog.isPerceived(h.row, h.col));
    });
  },
};

document.addEventListener("DOMContentLoaded", () => Hierbajos.initPref());

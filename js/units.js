/* Gnomore Gnomes — unidades sobre el tablero: modelo de datos, pintado,
   selección y las utilidades compartidas (desplazamiento paso a paso, giro,
   marcadores, barra de vida, texto flotante, eliminación) que CUALQUIER
   mecánica puede reutilizar.

   Regla de oro: un archivo por mecánica. Este archivo es el "núcleo" de las
   unidades — sabe cómo crearlas, pintarlas, seleccionarlas y moverlas de una
   loseta a otra, pero NO sabe nada de reglas de movimiento ni de combate:
   eso vive en js/movement.js y js/combat.js, cada uno en su propio archivo,
   y se registran aquí sin que este archivo tenga que conocerlos.

   Por qué está organizado así (para cuando haya que tocarlo más adelante):
   cada mecánica que se pueda usar sobre la unidad del jugador seleccionada
   (moverse, atacar, y lo que se añada después: construir, curar, una
   habilidad especial...) se registra con Units.registerRangeProvider(...)
   como un "proveedor de rango": un objeto con
     showFor(unit)   -> pinta sus propios marcadores/indicadores para `unit`
     onClear()       -> (opcional) limpia cualquier estado propio que no sean
                         marcadores (p.ej. las clases "objetivo" de combate)
   Este archivo se encarga de la selección, de vaciar los marcadores
   compartidos y de pedirle a CADA proveedor registrado que se repinte
   cuando algo cambia (tras moverse, tras atacar...). Así:
     - Se puede reescribir por completo cómo funciona el movimiento sin
       tocar el combate, y viceversa: cada uno vive en su archivo y solo
       habla con Units a través de esta API pública.
     - Añadir una mecánica nueva es crear un archivo, registrar un proveedor
       y usar las utilidades de aquí abajo — nunca hace falta editar este
       archivo ni los de las otras mecánicas.
   La partida en sí (turnos, cómo se gana/pierde) todavía no existe — eso
   irá en su propio archivo (p.ej. js/match.js) el día que se defina, y
   debería poder construirse sobre esta misma API sin reestructurar nada de
   aquí. Lo mismo vale para tableros más complejos (varios tipos de loseta,
   obstáculos): mientras sigan siendo una cuadrícula row/col, esta capa no
   necesita cambios.

   Regla de oro: escalabilidad — UNIT_TYPES sigue el mismo patrón que
   TILE_TYPES/RACES: añadir una unidad nueva es añadir una entrada aquí, sin
   tocar el resto del motor; lo mismo para añadir más equipos/bandos: basta
   con pasar otro "team" al spawnear.
   Regla de oro: nivel Triple A / feedback — seleccionar, ver el radio de
   cualquier mecánica, desplazarse y recibir texto flotante deben sentirse
   satisfactorios: saltos con rebote, giro hacia la dirección real y sonido
   en cada paso — ver también js/movement.js y js/combat.js. */

// Estadísticas de cada tipo de unidad — las 4 que ve el jugador (en el popup
// de js/unitinfo.js) están todas sobre una escala común de 1 a 5:
//   aguante    -> vida máxima de la unidad (Units.spawnUnit la usa como hp/maxHp)
//   movimiento -> casillas por turno (lo usa js/movement.js)
//   fuerza     -> daño que hace al golpear (lo usa js/combat.js)
//   agilidad   -> probabilidad de acertar habilidades tipo "pasar al gnomo"
//                 (todavía no existe esa mecánica — el dato ya está aquí
//                 preparado para cuando se implemente, sin tener que tocar
//                 UNIT_TYPES otra vez)
// attackRange no es una de las 4 estadísticas del jugador (es una regla de
// combate interna, de momento igual para todas: cuerpo a cuerpo, 1 casilla).
// raceId liga cada tipo de unidad a una de las razas de js/races.js — así
// cualquier pantalla que necesite "solo los personajes de este equipo"
// (p.ej. el selector de debug/calibrar-gnomo.html) puede filtrar por él sin
// tener que mantener una segunda lista por separado.
const UNIT_TYPES = {
  hombre_arbol: {
    name: "GolemCorteza",
    raceId: "mushboom_forest",
    spriteUrl: "assets/equipos/MushboomForest/unidad_01.png",
    aguante: 5,
    movimiento: 1,
    fuerza: 3,
    agilidad: 1,
    attackRange: 1,
    defaultFacing: "right", // la imagen viene dibujada mirando hacia la derecha por defecto
  },
  // Sustituye a Goblin Lanzador en el Reino Mushboom Forest (ver más abajo:
  // el goblin ahora vive en Colinas Rock'n Troll) — mismas estadísticas
  // exactas, solo cambia el personaje y su sprite.
  surcabosques: {
    name: "Surcabosques",
    raceId: "mushboom_forest",
    spriteUrl: "assets/equipos/MushboomForest/unidad_02.png",
    aguante: 1,
    movimiento: 3,
    fuerza: 1,
    agilidad: 5,
    attackRange: 1,
    defaultFacing: "right",
  },
  seta_artificiero: {
    name: "TruenoEspora",
    raceId: "mushboom_forest",
    spriteUrl: "assets/equipos/MushboomForest/unidad_03.png",
    aguante: 2,
    movimiento: 2,
    fuerza: 2,
    agilidad: 2,
    attackRange: 1,
    defaultFacing: "right",
  },
  goblin_lanzador: {
    name: "Goblin Lanzador",
    raceId: "colinas_rockntroll",
    spriteUrl: "assets/equipos/ColinasRockNTroll/unidad_01.png",
    aguante: 1,
    movimiento: 3,
    fuerza: 1,
    agilidad: 5,
    attackRange: 1,
    defaultFacing: "right",
  },
  // Mismas estadísticas EXACTAS que TruenoEspora/seta_artificiero (pedido
  // explícito: "con las características de esporas de MushBoom") — solo
  // cambia el personaje, su sprite y su equipo.
  urgamentes: {
    name: "UrgaMentes",
    raceId: "colinas_rockntroll",
    spriteUrl: "assets/equipos/ColinasRockNTroll/unidad_02.png",
    aguante: 2,
    movimiento: 2,
    fuerza: 2,
    agilidad: 2,
    attackRange: 1,
    defaultFacing: "right",
  },
  // Mismas estadísticas EXACTAS que GolemCorteza/hombre_arbol (pedido
  // explícito: "con los stats de golemcorteza") — solo cambia el personaje,
  // su sprite y su equipo.
  punoroca: {
    name: "PuñoRoca",
    raceId: "colinas_rockntroll",
    spriteUrl: "assets/equipos/ColinasRockNTroll/unidad_03.png",
    aguante: 5,
    movimiento: 1,
    fuerza: 3,
    agilidad: 1,
    attackRange: 1,
    defaultFacing: "right",
  },
};

// Tamaño visual de cada personaje EN EL TABLERO (multiplica el ancho base de
// 120px, ver .unit__sprite en style.css) — vive separado de UNIT_TYPES, no
// dentro de cada entrada, porque es puramente estético/de calibración (a
// diferencia de las estadísticas de juego) y así debug/calibrar-tamano.html
// puede generar de una este objeto completo listo para pegar, igual que
// FACE_OFFSETS (unitinfo.js) o GNOME_SIZES/GNOME_ATTACH_OFFSETS (gnome.js).
// "default" es el que usa cualquier tipo nuevo sin calibrar todavía — así
// un personaje recién añadido nunca aparece invisible ni gigante, solo con
// el tamaño base hasta que se afine el suyo.
const SPRITE_SCALES = {
  default: 1,
  hombre_arbol: 1.5,
  surcabosques: 1,
  seta_artificiero: 1,
  goblin_lanzador: 1,
  urgamentes: 1,
  punoroca: 1.5,
};

const Units = {
  boardSize: 0,
  container: null,
  list: [], // { id, typeId, team, row, col, facing, hp, maxHp, el, flipEl, spriteEl, hpBarEl, hpFillEl }
  selectedId: null,
  markerEls: [],
  rangeProviders: [], // mecánicas registradas (movimiento, combate, futuras) — ver cabecera del archivo
  selectionListeners: [], // UI no ligada al tablero (ver registerSelectionListener), p.ej. js/unitinfo.js
  _nextId: 1,

  init(container, boardSize) {
    this.container = container;
    this.boardSize = boardSize;
    this.list = [];
    this.selectedId = null;
    this.markerEls = [];
  },

  // Cualquier mecánica que quiera mostrar marcadores/indicadores cuando el
  // jugador selecciona una de sus unidades llama a esto UNA vez al cargar su
  // archivo (ver el final de movement.js/combat.js). El orden de registro
  // decide el orden en que se pintan (y por tanto el orden de su animación
  // escalonada si comparten índice de aparición).
  registerRangeProvider(provider) {
    this.rangeProviders.push(provider);
  },

  // Crea una unidad de cualquier tipo/bando. spawnTestUnit/spawnRandomEnemy
  // (más abajo) son atajos sobre esta para los dos casos que usa el juego
  // ahora mismo, pero cualquier futuro tercer bando (u otro tipo de unidad)
  // solo necesita llamar a esto con otros parámetros.
  spawnUnit({ typeId, row, col, team }) {
    const type = UNIT_TYPES[typeId];
    const id = `unit-${this._nextId++}`;

    const el = document.createElement("div");
    el.className = `unit unit--${team}`;
    el.dataset.unitId = id;

    const flipEl = document.createElement("div");
    flipEl.className = "unit__flip";

    const spriteEl = document.createElement("img");
    spriteEl.className = "unit__sprite";
    spriteEl.src = type.spriteUrl;
    spriteEl.draggable = false;
    spriteEl.alt = "";
    // El ancho base (120px) vive en CSS (.unit__sprite); los tipos que
    // necesitan verse más grandes/pequeños (ver SPRITE_SCALES más arriba)
    // lo escalan aquí en vez de tener su propia regla CSS — así un tipo
    // nuevo con escala distinta no necesita tocar el CSS, solo su entrada
    // en SPRITE_SCALES.
    const scale = SPRITE_SCALES[typeId] ?? SPRITE_SCALES.default;
    if (scale !== 1) {
      spriteEl.style.width = `${Math.round(120 * scale)}px`;
    }

    flipEl.appendChild(spriteEl);
    el.appendChild(flipEl);

    const hpBarEl = document.createElement("div");
    hpBarEl.className = "unit__hpbar";
    const hpFillEl = document.createElement("div");
    hpFillEl.className = "unit__hpbar-fill";
    hpBarEl.appendChild(hpFillEl);
    el.appendChild(hpBarEl);

    this.container.appendChild(el);

    const unit = {
      id,
      typeId,
      team,
      row,
      col,
      facing: type.defaultFacing,
      hp: type.aguante,
      maxHp: type.aguante,
      el,
      flipEl,
      spriteEl,
      hpBarEl,
      hpFillEl,
    };
    this.list.push(unit);

    this._placeInstant(unit);
    this.updateHpBar(unit);

    el.addEventListener("click", (e) => {
      e.stopPropagation();
      this._onUnitClick(unit);
    });

    return unit;
  },

  // typeId es parámetro (no fijo) para poder colocar los 3 tipos de prueba
  // a la vez y comparar sus estadísticas en acción — ver spawnTestUnits en
  // newgame-flow.js.
  spawnTestUnit(row, col, typeId = "hombre_arbol") {
    return this.spawnUnit({ typeId, row, col, team: "player" });
  },

  // Coloca un rival en una casilla libre al azar del tablero — de momento
  // solo para pruebas (mismo tipo de unidad por defecto, con tinte rojo vía
  // CSS hasta que haya arte propio para el bando rival).
  spawnRandomEnemy(typeId = "hombre_arbol") {
    const empty = [];
    for (let row = 0; row < this.boardSize; row++) {
      for (let col = 0; col < this.boardSize; col++) {
        if (!this.unitAt(row, col)) empty.push({ row, col });
      }
    }
    if (empty.length === 0) return null;
    const spot = empty[Math.floor(Math.random() * empty.length)];
    return this.spawnUnit({ typeId, row: spot.row, col: spot.col, team: "enemy" });
  },

  unitAt(row, col) {
    return this.list.find((u) => u.row === row && u.col === col);
  },

  _placeInstant(unit) {
    const { x, y } = getTileCenter(unit.row, unit.col, this.boardSize);
    unit.el.style.left = `${x}px`;
    unit.el.style.top = `${y}px`;
    unit.el.style.zIndex = String((unit.row + unit.col) * 10 + 5);
    this._applyFacing(unit);
  },

  // El giro en sí es SIEMPRE instantáneo (nunca con transition sobre
  // transform, ver .unit__flip en style.css) — una transition suave entre
  // scaleX(1) y scaleX(-1) pasa por scaleX(0) a mitad de camino, que es
  // literalmente aplastar el sprite hasta una línea y expandirlo por el
  // otro lado: se lee como un cartón de papel girando, no como un
  // personaje dándose la vuelta. En su lugar, cuando el sentido REALMENTE
  // cambia (no en la colocación inicial), se dispara un "pop" con
  // rebote — un breve encogido/estirado elástico (unit-turn-pop, ver CSS)
  // que convive con el mismo scaleX porque ambos leen la variable CSS
  // --facing-scale en vez de competir por la propiedad transform.
  _applyFacing(unit) {
    const newScale = unit.facing === "left" ? "-1" : "1";
    const prevScale = unit.flipEl.dataset.facingScale;
    unit.flipEl.style.setProperty("--facing-scale", newScale);
    unit.flipEl.dataset.facingScale = newScale;
    if (prevScale !== undefined && prevScale !== newScale) {
      unit.flipEl.classList.remove("unit__flip--turning");
      void unit.flipEl.offsetWidth; // fuerza reflow para poder repetir el pop si gira varias veces seguidas
      unit.flipEl.classList.add("unit__flip--turning");
    }
  },

  // Gira `unit` para encararse hacia una loseta destino según su posición
  // REAL en pantalla (no basta con comparar fila/columna en isométrico) —
  // lo usan tanto los saltos de movimiento como encararse al atacar, así
  // que vive aquí en vez de duplicarse en cada mecánica.
  faceTowardsTile(unit, row, col) {
    const from = getTileCenter(unit.row, unit.col, this.boardSize);
    const to = getTileCenter(row, col, this.boardSize);
    if (to.x > from.x + 0.5) unit.facing = "right";
    else if (to.x < from.x - 0.5) unit.facing = "left";
    this._applyFacing(unit);
  },

  _onUnitClick(unit) {
    // Si esta unidad es un rival "marcado como objetivo" ahora mismo (ver
    // unit--targeted, lo pone Combat.showFor para cada rival al alcance de
    // la unidad seleccionada), un clic sobre EL PROPIO PERSONAJE ataca
    // directamente en vez de solo seleccionarlo/deseleccionarlo — antes de
    // que la mira de ataque pasara a pintarse por detrás de su sprite (a
    // petición expresa) bastaba con acertar en cualquier punto del rival
    // para atacar; ahora que la mira solo asoma por los bordes, sin esto
    // el jugador puede quedarse sin poder atacar aunque haga clic justo
    // encima del rival. Vive aquí (no en combat.js) porque es el propio
    // manejador de clic de la unidad el que necesita desviarse, y así
    // combat.js sigue sin saber nada de cómo se selecciona una unidad.
    if (unit.el.classList.contains("unit--targeted") && this.selectedId) {
      const attacker = this.list.find((u) => u.id === this.selectedId);
      if (attacker && typeof Combat !== "undefined") {
        Combat.approachAndAttack(attacker, unit);
        return;
      }
    }
    if (this.selectedId === unit.id) {
      this.deselect();
      return;
    }
    this.select(unit);
  },

  select(unit) {
    this.deselect();
    this.selectedId = unit.id;
    unit.el.classList.add("unit--selected");
    SFX.click();
    // El radio de cualquier mecánica solo se calcula para las unidades del
    // jugador — seleccionar un rival solo sirve para verle la vida, de
    // momento no se puede actuar con él.
    if (unit.team === "player") {
      this.rangeProviders.forEach((p) => p.showFor(unit));
      this._resolveMarkerOverlaps();
    }
    // Los "oyentes de selección" (ver registerSelectionListener) sí se
    // avisan para CUALQUIER unidad, amiga o rival — a diferencia del radio
    // de acción, no son una capacidad de actuar sobre el tablero, así que
    // no tiene sentido limitarlos al equipo del jugador (p.ej. el panel de
    // estadísticas de js/unitinfo.js también sirve para consultar a un
    // rival).
    this.selectionListeners.forEach((l) => l.onSelect && l.onSelect(unit));
  },

  deselect() {
    if (!this.selectedId) return;
    const prev = this.list.find((u) => u.id === this.selectedId);
    if (prev) prev.el.classList.remove("unit--selected");
    this.selectedId = null;
    this.clearRangeOverlays();
    this.selectionListeners.forEach((l) => l.onDeselect && l.onDeselect());
  },

  // Igual que registerRangeProvider pero para UI que no pinta sobre el
  // tablero (paneles, botones fijos en pantalla...) y que quiere enterarse
  // de cada selección/deselección sin que units.js tenga que conocerla.
  registerSelectionListener(listener) {
    this.selectionListeners.push(listener);
  },

  // Vuelve a calcular y pintar el radio de TODAS las mecánicas registradas
  // para `unit` (si sigue siendo la seleccionada) — se llama tras cualquier
  // acción que pueda cambiarlo (moverse, atacar...). Centralizarlo aquí es
  // lo que permite que una mecánica no tenga que saber nada de las demás:
  // movement.js no sabe que combat.js existe, y viceversa.
  refreshRange(unit) {
    if (this.selectedId !== unit.id) return;
    this.clearRangeOverlays();
    this.rangeProviders.forEach((p) => p.showFor(unit));
    this._resolveMarkerOverlaps();
  },

  // Igual que refreshRange, pero SOLO borra y vuelve a pintar los
  // marcadores de UNA mecánica (identificada por `ownerKey`, ver el
  // parámetro `owner` de addMarker) en vez de las de todas. Pensado para
  // cuando algo externo a la propia selección deja desactualizado un
  // marcador puntual (p.ej. la mira de "coger" del gnomo cuando este se
  // mueve solo por su cuenta, sin que la unidad del jugador haya hecho
  // nada) — así esa actualización no reinicia también el radio de
  // movimiento/ataque de las demás mecánicas, que seguía siendo válido y no
  // necesitaba volver a animarse desde cero.
  refreshProviderFor(unit, provider, ownerKey) {
    if (this.selectedId !== unit.id) return;
    this.markerEls = this.markerEls.filter((m) => {
      if (m._owner !== ownerKey) return true;
      m.remove();
      return false;
    });
    if (provider.onClear) provider.onClear();
    provider.showFor(unit);
    this._resolveMarkerOverlaps();
  },

  clearRangeOverlays() {
    this.markerEls.forEach((m) => m.remove());
    this.markerEls = [];
    this.rangeProviders.forEach((p) => {
      if (p.onClear) p.onClear();
    });
  },

  // Crea, posiciona y anima la aparición de un marcador interactivo sobre
  // una loseta (círculo de movimiento, mira de ataque, o cualquier
  // indicador que añada una futura mecánica). Centraliza aquí el patrón de
  // posición/animación/registro para que cada mecánica solo tenga que
  // decidir SU contenido y SU clase CSS, nunca reimplementar esto — y para
  // que el "clic fuera para deseleccionar" de más abajo detecte cualquier
  // marcador presente o futuro sin tener que conocer sus clases concretas
  // (por eso siempre lleva también la clase genérica "board-marker").
  //
  // La aparición se dispara con una clase (transition), no con una
  // @keyframes animation: mezclar una animation con fill:forwards y una
  // transition sobre la misma propiedad "transform" (p.ej. la de :hover)
  // hace que el navegador las siga disputando entre sí en cada hover, lo
  // que se ve como parpadeos (ver nota de rendimiento en style.css). El rAF
  // asegura que el navegador registre primero el estado inicial antes de
  // pasar al visible, y el setTimeout escalona la aparición de varios
  // marcadores seguidos.
  addMarker({
    className,
    row,
    col,
    zOffset = 0,
    delayIndex = 0,
    delayMs,
    alwaysOnTop = false,
    visibleClass,
    onClick,
    buildContent,
    owner,
  }) {
    const marker = document.createElement("div");
    marker.className = `board-marker ${className}`;
    if (buildContent) buildContent(marker);

    // Etiqueta opcional (una simple cadena, p.ej. "gnome") para que
    // refreshProviderFor pueda borrar y repintar SOLO los marcadores de esta
    // mecánica sin tocar los de las demás — ver esa función más abajo. Una
    // propiedad JS normal, no dataset, porque no necesita reflejarse en el
    // DOM ni ser una cadena forzosamente serializable.
    if (owner) marker._owner = owner;

    // Guarda su loseta (no solo la posición en pantalla) para que
    // _resolveMarkerOverlaps pueda detectar cuándo dos marcadores de
    // mecánicas distintas caen en la misma loseta, sin que ninguna mecánica
    // tenga que saber de la existencia de la otra.
    marker.dataset.row = row;
    marker.dataset.col = col;

    const { x, y } = getTileCenter(row, col, this.boardSize);
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    // alwaysOnTop: por encima de CUALQUIER unidad, sea cual sea su fila/
    // columna — lo usa el círculo de movimiento (ver movement.js) para que
    // un personaje grande (p.ej. el GolemCorteza, más alto que su propia
    // loseta) nunca lo tape aunque esté en la loseta "de detrás" en el
    // orden isométrico normal. El resto de marcadores (mira de ataque,
    // captura del gnomo...) siguen con el z-index relativo a su loseta,
    // porque esos sí necesitan una relación concreta (por delante/detrás)
    // con una unidad concreta.
    marker.style.zIndex = alwaysOnTop ? String(5000 + zOffset) : String((row + col) * 10 + zOffset);

    if (onClick) {
      marker.addEventListener("click", (e) => {
        e.stopPropagation();
        onClick();
      });
    }

    this.container.appendChild(marker);
    this.markerEls.push(marker);

    if (visibleClass) {
      // delayMs (si se da) sustituye al escalonado fijo de 18ms por
      // marcador: con muchas losetas a la vez (una unidad con mucho
      // movimiento puede alcanzar más de 100) ese fijo tardaría segundos en
      // terminar de aparecer — ver Units.staggerDelay, que lo comprime para
      // que el radio completo tarde siempre más o menos lo mismo en
      // revelarse, sea cual sea su tamaño.
      const delay = delayMs !== undefined ? delayMs : delayIndex * 18;
      requestAnimationFrame(() => {
        setTimeout(() => marker.classList.add(visibleClass), delay);
      });
    }

    return marker;
  },

  // Retraso (ms) para el elemento `index` de `total` en una aparición
  // escalonada: como antes (18ms por elemento) mientras el conjunto es
  // pequeño, pero comprimido para que el conjunto ENTERO nunca tarde más de
  // `maxTotalMs` en terminar de aparecer — así una unidad con movimiento 5
  // (que puede iluminar más de 100 losetas) no tarda proporcionalmente más
  // que una con movimiento 1 (unas 8 losetas).
  staggerDelay(index, total, maxTotalMs = 200) {
    if (total <= 1) return 0;
    const perStep = Math.min(18, maxTotalMs / total);
    return index * perStep;
  },

  // Cuando dos marcadores de mecánicas distintas caen en la misma loseta
  // (p.ej. la mira de ataque coincide con un círculo de movimiento porque el
  // rival está dentro del propio radio de movimiento del jugador), el de
  // ataque es siempre el que manda visualmente: el círculo de debajo no debe
  // verse, para no leerse como "una loseta cualquiera de movimiento" en vez
  // de "aquí se puede atacar". Se resuelve aquí, DESPUÉS de que todas las
  // mecánicas hayan pintado las suyas, precisamente para que ninguna
  // mecánica (movement.js, combat.js) necesite saber de la existencia de
  // las demás — es una regla de composición visual del núcleo, no de una
  // mecánica concreta.
  _resolveMarkerOverlaps() {
    const attackTiles = new Set(
      this.markerEls
        .filter((m) => m.classList.contains("attack-marker"))
        .map((m) => `${m.dataset.row},${m.dataset.col}`)
    );
    if (attackTiles.size === 0) return;
    this.markerEls = this.markerEls.filter((m) => {
      const hidden =
        m.classList.contains("range-marker") && attackTiles.has(`${m.dataset.row},${m.dataset.col}`);
      if (hidden) m.remove();
      return !hidden;
    });
  },

  // ---------- Desplazamiento paso a paso: lo usa cualquier mecánica que
  // necesite mover una unidad de una loseta a otra (movimiento normal,
  // acercarse antes de atacar, y lo que se añada después). Vive aquí y no
  // en movement.js para que combat.js pueda reutilizarlo tal cual, sin
  // duplicar la animación ni arriesgarse a que las dos copias diverjan. ----

  // Camino recto en línea, paso a paso por casilla (como mucho tantos pasos
  // como la distancia Chebyshev al destino) — de momento no hay obstáculos
  // en el tablero, así que un camino recto es siempre válido.
  stepPath(fromRow, fromCol, toRow, toCol) {
    const steps = Math.max(Math.abs(toRow - fromRow), Math.abs(toCol - fromCol));
    const path = [];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      path.push({
        row: Math.round(fromRow + (toRow - fromRow) * t),
        col: Math.round(fromCol + (toCol - fromCol) * t),
      });
    }
    return path;
  },

  // Recorre un camino ya calculado (ver stepPath), salto a salto, con el
  // giro/animación/sonido de cada paso. Encapsula también la limpieza que
  // hay que hacer al terminar: si no se quita a mano la clase del último
  // salto, se queda pegada para siempre y "tapa" la animación de
  // respiración (misma especificidad que unit__sprite pero declarada
  // después en el CSS) — al vivir en un único sitio, ninguna mecánica que
  // reutilice esto puede reintroducir ese bug por accidente.
  async walkPath(unit, path) {
    unit.el.classList.add("unit--moving");
    for (const step of path) {
      await this.hopTo(unit, step.row, step.col);
    }
    unit.el.classList.remove("unit--moving");
    unit.spriteEl.classList.remove("unit__sprite--hop");
  },

  hopTo(unit, row, col) {
    return new Promise((resolve) => {
      this.faceTowardsTile(unit, row, col);

      unit.row = row;
      unit.col = col;
      const { x, y } = getTileCenter(row, col, this.boardSize);
      unit.el.style.left = `${x}px`;
      unit.el.style.top = `${y}px`;
      unit.el.style.zIndex = String((row + col) * 10 + 5);

      // Reinicia la animación de salto en cada paso (aunque sea la misma clase).
      unit.spriteEl.classList.remove("unit__sprite--hop");
      void unit.spriteEl.offsetWidth; // fuerza reflow para poder repetir la animación
      unit.spriteEl.classList.add("unit__sprite--hop");

      SFX.hop();

      const HOP_MS = 220;
      setTimeout(resolve, HOP_MS);
    });
  },

  // ---------- Vida / feedback genérico: cualquier mecánica puede tocar la
  // vida de una unidad o darle feedback visual — quién decide CUÁNDO
  // hacerlo (p.ej. combat.js al golpear) no tiene por qué reimplementar
  // CÓMO se ve. ----

  updateHpBar(unit) {
    const pct = Math.max(0, unit.hp / unit.maxHp) * 100;
    unit.hpFillEl.style.width = `${pct}%`;
    unit.hpFillEl.classList.toggle("unit__hpbar-fill--low", unit.hp <= 1);
  },

  // Pequeño temblor de reacción (golpe recibido, y en el futuro cualquier
  // otro impacto/bloqueo) sobre `unit`.
  playShake(unit) {
    unit.el.classList.remove("unit--hit");
    void unit.el.offsetWidth; // fuerza reflow para poder repetir el temblor
    unit.el.classList.add("unit--hit");
  },

  // Texto flotante sobre la cabeza de una unidad (daño, y en el futuro
  // curación u otros mensajes) — se autodestruye solo al acabar su propia
  // animación de subida y desvanecido (ver style.css).
  spawnFloatingText(unit, text, { className = "dmg-popup" } = {}) {
    const { x, y } = getTileCenter(unit.row, unit.col, this.boardSize);
    const popup = document.createElement("div");
    popup.className = className;
    popup.textContent = text;
    popup.style.left = `${x}px`;
    popup.style.top = `${y - 108}px`; // por encima de la cabeza
    popup.style.zIndex = String((unit.row + unit.col) * 10 + 9);
    this.container.appendChild(popup);
    popup.addEventListener("animationend", () => popup.remove());
  },

  // Elimina una unidad del juego (0 de vida, o cualquier otra razón futura)
  // con su propia animación antes de quitarla del DOM y de la lista.
  async removeUnit(unit) {
    if (this.selectedId === unit.id) this.deselect();
    unit.el.classList.add("unit--dying");
    SFX.death();
    await new Promise((resolve) => setTimeout(resolve, 420));
    unit.el.remove();
    this.list = this.list.filter((u) => u.id !== unit.id);
  },
};

// Al hacer clic en cualquier punto del tablero que no sea una unidad ni un
// marcador de cualquier mecánica (clase genérica "board-marker", ver
// addMarker), se deselecciona (comportamiento esperado/cómodo).
document.addEventListener("DOMContentLoaded", () => {
  const viewport = document.getElementById("board-viewport");
  if (!viewport) return;
  viewport.addEventListener("click", (e) => {
    if (e.target.closest(".unit") || e.target.closest(".board-marker")) return;
    Units.deselect();
  });
});

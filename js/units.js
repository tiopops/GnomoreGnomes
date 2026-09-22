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

// Estadísticas de cada tipo de unidad — las 5 que ve el jugador (en el popup
// de js/unitinfo.js) están todas sobre una escala común de 1 a 5:
//   aguante    -> vida máxima de la unidad (Units.spawnUnit la usa como hp/maxHp)
//   movimiento -> casillas por turno (lo usa js/movement.js)
//   fuerza     -> daño que hace al golpear (lo usa js/combat.js)
//   agilidad   -> probabilidad de acertar habilidades tipo "pasar al gnomo"
//                 (también aplica al éxito del pase, ver Gnome.computePassSuccess)
//   percepcion -> radio (en casillas, distancia Chebyshev) de niebla que se
//                 revela alrededor de la unidad AL TERMINAR de moverse a una
//                 casilla nueva — la usa js/fog.js (Fog.revealForUnit). El
//                 revelado inicial al empezar la partida es un radio FIJO de
//                 2 para todos, independiente de esta estadística (pedido
//                 explícito) — percepcion solo entra en juego a partir del
//                 primer movimiento.
// attackRange no es una de las 5 estadísticas del jugador (es una regla de
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
    // Sprite opcional para la animación épica de un golpe mortal a un
    // poblado (ver Villages._playEpicSmash, js/villages.js) — pedido
    // explícito: "esta animacion tiene un sprite con el nombre
    // machacagnomos en su nombre". Es opcional a propósito (la mayoría de
    // personajes todavía no lo tienen): Units.machacaSpriteFor es la única
    // función que sabe hacer el relleno "usa el normal de iddle" cuando
    // falta, así que este campo puede quedar sin definir sin más.
    machacaUrl: "assets/equipos/MushboomForest/machacagnomos_hombre_arbol.png",
    // Sprite opcional para el INSTANTE del impacto contra el suelo, dentro
    // de esa misma animación (ver Villages._playEpicSmash) — pedido
    // explícito: pose distinta a la de "machaca" (el salto/windup) justo en
    // el momento en que tiembla la cámara y el gnomo se desintegra. Igual
    // de opcional que machacaUrl: Units.impactSpriteFor rellena con el de
    // machaca (y ese a su vez con el de iddle) cuando un personaje no lo
    // tiene todavía.
    machacaImpactUrl: "assets/equipos/MushboomForest/machacagnomos_hombre_arbol_impacto.png",
    aguante: 4,
    movimiento: 1,
    fuerza: 3,
    agilidad: 1,
    percepcion: 1,
    attackRange: 1,
    defaultFacing: "right", // la imagen viene dibujada mirando hacia la derecha por defecto
  },
  // Sustituye a LanzaGnomos en el Reino Mushboom Forest (ver más abajo: el
  // goblin ahora vive en Colinas Rock'n Troll) — mismo personaje que ese
  // reemplazó, pero cada uno con sus propias estadísticas ya calibradas por
  // separado en debug/configurar-personajes.html.
  surcabosques: {
    name: "SurcaBosques",
    raceId: "mushboom_forest",
    spriteUrl: "assets/equipos/MushboomForest/unidad_02.png",
    aguante: 1,
    movimiento: 4,
    fuerza: 1,
    agilidad: 3,
    percepcion: 3,
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
    agilidad: 3,
    percepcion: 2,
    attackRange: 1,
    defaultFacing: "right",
  },
  goblin_lanzador: {
    name: "LanzaGnomos",
    raceId: "colinas_rockntroll",
    spriteUrl: "assets/equipos/ColinasRockNTroll/unidad_01.png",
    aguante: 2,
    movimiento: 3,
    fuerza: 1,
    agilidad: 5,
    percepcion: 3,
    attackRange: 1,
    defaultFacing: "right",
  },
  urgamentes: {
    name: "UrgaMentes",
    raceId: "colinas_rockntroll",
    spriteUrl: "assets/equipos/ColinasRockNTroll/unidad_02.png",
    aguante: 2,
    movimiento: 3,
    fuerza: 2,
    agilidad: 2,
    percepcion: 2,
    attackRange: 1,
    defaultFacing: "right",
  },
  // Mismo personaje al que sustituyó GolemCorteza/hombre_arbol (pedido
  // explícito original: "con los stats de golemcorteza"), ya con sus
  // propias estadísticas calibradas por separado en
  // debug/configurar-personajes.html.
  punoroca: {
    name: "Puñorroca",
    raceId: "colinas_rockntroll",
    spriteUrl: "assets/equipos/ColinasRockNTroll/unidad_03.png",
    aguante: 5,
    movimiento: 3,
    fuerza: 5,
    agilidad: 1,
    percepcion: 1,
    attackRange: 1,
    defaultFacing: "right",
  },
};

// Tamaño visual de cada personaje EN EL TABLERO (multiplica el ancho base de
// 120px, ver .unit__sprite en style.css) — vive separado de UNIT_TYPES, no
// dentro de cada entrada, porque es puramente estético/de calibración (a
// diferencia de las estadísticas de juego) y así debug/configurar-personajes.html
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
  urgamentes: 0.8,
  punoroca: 1.5,
};

const Units = {
  boardSize: 0,
  container: null,
  list: [], // { id, typeId, team, row, col, facing, hp, maxHp, el, flipEl, spriteEl, hpBarEl, hpSegmentEls }
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

    // Indicador opcional de equipo (js/teammarkers.js, apagado por
    // defecto) — círculo en el suelo, bajo el personaje: se inserta como
    // PRIMER hijo (antes que flipEl) para que quede pintado por detrás del
    // sprite sin necesitar ningún z-index especial, mismo truco que ya usa
    // el resto de "capas de suelo" de este archivo (orden de inserción, no
    // apilamiento explícito). Su visibilidad la decide un único toggle de
    // clase en <body> (ver TeamMarkers), nunca JS por unidad.
    const teamMarkerEl = document.createElement("div");
    teamMarkerEl.className = `unit__team-marker unit__team-marker--${team}`;
    el.appendChild(teamMarkerEl);

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
    // Sombra proyectada (js/shadows.js) — se sincroniza sola con
    // salto/cambios de src futuros, no hace falta guardar su referencia
    // aquí.
    if (typeof Shadows !== "undefined") Shadows.attach(spriteEl);
    el.appendChild(flipEl);

    // Icono de "a punto de morir" — pedido explícito: "puedes mostrar un
    // icono phosphor sobre el sprite del jugador que tiembla porque el
    // proximo ataque le va a matar?" — sustituido después (séptima pasada)
    // por un PNG propio ("tambien te adjunto el icono de una calavera para
    // que lo sustituyas por el phosphor de temblar de miedo", ver
    // assets/iconos/calavera_miedo.png) en vez del glifo de Phosphor: ya no
    // depende de que la webfont de iconos cargue bien. Vive fuera de
    // unit__flip (que ya se gira/escala con la unidad) para que el icono se
    // quede siempre mirando de frente, sin girarse con el personaje — solo
    // se muestra/oculta y tiembla vía CSS (.unit--doomed .unit__doom-icon,
    // ver style.css), igual que el resto del estado "doomed" ya hace con el
    // sprite/glow.
    const doomIconEl = document.createElement("img");
    doomIconEl.className = "unit__doom-icon";
    doomIconEl.src = "assets/iconos/calavera_miedo.png";
    doomIconEl.alt = "";
    el.appendChild(doomIconEl);

    // Barra de vida SECCIONADA — pedido explícito: "las barras de vida
    // pueden estar seccionadas? creo que así sería más visible a la hora de
    // ver cuántos puntos de vida quedan... implementa un diseño digno de un
    // juego triple A". Un segmento por punto de aguante (maxHp) en vez de un
    // único relleno continuo — así "cuántos puntos le quedan" se lee de un
    // vistazo, número exacto de casillas iluminadas, no hay que estimar un
    // porcentaje de barra a ojo. Nivel Triple A: cada segmento es su propio
    // elemento (permite iluminarse/apagarse con su propio pop elástico, ver
    // .unit__hpbar-segment en style.css) separados por un hueco real (gap),
    // no una simple división pintada con gradiente.
    const hpBarEl = document.createElement("div");
    hpBarEl.className = "unit__hpbar";
    const hpSegmentEls = [];
    for (let i = 0; i < type.aguante; i++) {
      const seg = document.createElement("div");
      seg.className = "unit__hpbar-segment";
      hpBarEl.appendChild(seg);
      hpSegmentEls.push(seg);
    }
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
      doomIconEl,
      hpBarEl,
      hpSegmentEls,
      _fearTimer: null, // ver startFearLoop/stopFearLoop más abajo
      // Habilidades especiales de un solo uso (js/abilities.js) — pedido
      // explícito: "si el personaje lo consume, este desaparece", así que
      // basta un booleano por unidad, nunca se vuelve a poner a false.
      abilityUsed: false,
      // "Golem de Espinas" (GolemCorteza) — una vez activada, PERMANENTE
      // para el resto de la partida (no caduca por turno): cualquiera que
      // golpee a esta unidad se hace 1 punto de daño a sí mismo (ver
      // combat.js, Combat.attack).
      thorny: false,
      // "Nudillos Rocosos" (PuñoRoca) y la trampa de TruenoEspora dejan a
      // su víctima agotada DESDE EL PRINCIPIO de su turno siguiente en vez
      // de con las 2 acciones normales — ver Turns._resetTeamActions, que
      // consume esta marca la primera vez que le toca su turno.
      forcedRestNextTurn: false,
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
        if (this.unitAt(row, col)) continue;
        // Terreno (js/mapgen.js, TerrainMap) — un rival tampoco puede
        // aparecer sobre agua, mismo motivo que Movement.reachableTiles.
        if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) continue;
        empty.push({ row, col });
      }
    }
    if (empty.length === 0) return null;
    const spot = empty[Math.floor(Math.random() * empty.length)];
    return this.spawnUnit({ typeId, row: spot.row, col: spot.col, team: "enemy" });
  },

  unitAt(row, col) {
    return this.list.find((u) => u.row === row && u.col === col);
  },

  // Sprite de "machacagnomos" para la animación épica de un golpe mortal
  // contra un poblado (ver Villages._playEpicSmash, js/villages.js) — con
  // relleno automático cuando el tipo de personaje no tiene uno propio
  // todavía: "para los que no tengan el sprite de machaganomos usa el
  // normal de iddle" (pedido explícito). Único sitio que conoce este
  // relleno, igual que spriteFor(owner) en villages.js con su propia tabla.
  machacaSpriteFor(typeId) {
    const def = UNIT_TYPES[typeId];
    if (!def) return "";
    return def.machacaUrl || def.spriteUrl || "";
  },

  // Sprite del INSTANTE del impacto contra el suelo, dentro de esa misma
  // animación épica (ver Villages._playEpicSmash) — relleno en cascada
  // igual de explícito que machacaSpriteFor: si el personaje no tiene un
  // sprite propio de impacto, se queda con el de "machaca" (windup/salto),
  // y si tampoco tiene ese, con el de iddle de siempre.
  impactSpriteFor(typeId) {
    const def = UNIT_TYPES[typeId];
    if (!def) return "";
    return def.machacaImpactUrl || def.machacaUrl || def.spriteUrl || "";
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
    // momento no se puede actuar con él. Turnos (js/turns.js) — pedido
    // explícito: fuera del turno del jugador (mientras la IA rival resuelve
    // el suyo) tampoco se puede actuar con las propias unidades, aunque
    // sigan siendo del equipo "player" — cada mecánica (Movement/Combat/
    // Gnome) ya se blinda por su cuenta con Turns.canAct, pero así ni
    // siquiera se intenta pintar nada.
    if (unit.team === "player" && (typeof Turns === "undefined" || Turns.activeTeam === "player")) {
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
  // de colisión en el tablero (aparte del agua, ver pathIsWalkable justo
  // debajo), así que un camino recto es siempre válido.
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

  // Pedido explícito: "bajo ningun concepto un personaje puede moverse a
  // traves de una casilla de agua a no ser que algo definido por mi rompa
  // esa regla" — hasta ahora cada mecánica (Movement.reachableTiles,
  // Combat._approachTile, GnomeInstance varias) solo comprobaba que la
  // casilla DE DESTINO fuera transitable (TerrainMap.isWalkable), pero el
  // camino en sí (stepPath, línea recta con hasta `movimiento` pasos) nunca
  // se validaba paso a paso — así que una unidad con alcance >=2 SÍ podía
  // "saltar" en línea recta sobre una casilla de agua intermedia y aterrizar
  // en tierra firme al otro lado, cruzándola de hecho aunque el destino
  // fuera válido. Este helper comprueba TODO el camino (incluido el
  // destino, ya cubierto pero sin coste comprobarlo dos veces) para que
  // ninguna mecánica pueda ofrecer una casilla como alcanzable si el camino
  // recto hasta ella pisa agua en cualquier punto intermedio. El día que
  // "algo definido por él rompa esa regla" (nadar, un barco...) este es el
  // único sitio que hay que tocar: añadir esa excepción aquí, no en cada
  // mecánica por separado.
  pathIsWalkable(fromRow, fromCol, toRow, toCol) {
    if (typeof TerrainMap === "undefined") return true;
    return this.stepPath(fromRow, fromCol, toRow, toCol).every((step) =>
      TerrainMap.isWalkable(step.row, step.col)
    );
  },

  // Recorre un camino ya calculado (ver stepPath), salto a salto, con el
  // giro/animación/sonido de cada paso. Encapsula también la limpieza que
  // hay que hacer al terminar: si no se quita a mano la clase del último
  // salto, se queda pegada para siempre y "tapa" la animación de
  // respiración (misma especificidad que unit__sprite pero declarada
  // después en el CSS) — al vivir en un único sitio, ninguna mecánica que
  // reutilice esto puede reintroducir ese bug por accidente.
  async walkPath(unit, path) {
    // PuñoRoca (pedido explícito: "el troll puñoroca mueve mucho para su
    // fuerza...tienes que cambiar su movimiento") — sin un UrgaMentes
    // aliado justo a su lado ANTES de arrancar el movimiento, el primer
    // paso sale bien pero del segundo en adelante da tumbos al azar. Único
    // punto de paso de CUALQUIER desplazamiento paso a paso del proyecto
    // (ver comentario de más abajo), así que esto cubre moverse normal,
    // acercarse a atacar/coger el gnomo/un tótem/abrir la tienda... sin
    // tener que tocar cada mecánica por separado.
    if (unit.typeId === "punoroca") path = this._applyPunorocaWobble(unit, path);
    unit.el.classList.add("unit--moving");
    for (const step of path) {
      await this.hopTo(unit, step.row, step.col);
    }
    unit.el.classList.remove("unit--moving");
    unit.spriteEl.classList.remove("unit__sprite--hop");
    // Niebla de guerra (js/fog.js) — quien acaba de moverse (rival o gnomo
    // huyendo) puede haber entrado en una loseta sin revelar (o salido de
    // una): reevalúa aquí, en el ÚNICO sitio por el que pasa cualquier
    // desplazamiento paso a paso del proyecto (movimiento normal, acercarse
    // antes de atacar o de coger al gnomo, huida del gnomo...), en vez de
    // repetirlo en cada mecánica que llame a esto.
    if (typeof Fog !== "undefined") Fog.applyVisibility();
    // Un personaje puede haber quedado escondido detrás de un totem (o
    // haber dejado de estarlo): ver Villages.refreshOcclusion en
    // js/villages.js, que reusa este mismo punto único de paso.
    if (typeof Villages !== "undefined") Villages.refreshOcclusion();
    // Tienda Goblin (js/shops.js) — quien acaba de moverse puede haber
    // quedado junto a una tienda (o haberse alejado de una): este es el
    // ÚNICO punto de paso de cualquier desplazamiento del proyecto
    // (movimiento normal, acercarse a atacar/coger el gnomo/un tótem,
    // huida del gnomo...), así que basta con recalcularlo aquí una vez en
    // vez de repetir la llamada en cada mecánica que use walkPath.
    if (typeof Shops !== "undefined") Shops.refreshAll();
  },

  // "el jugador indica a donde quiere moverse, pero el segundo y tercer
  // paso lo hace hacia una direccion aleatoria. la unica manera de que de
  // los 3 pasos en la direccion indicada es teniendo a un aliado
  // cualquiera a su lado" (pedido explícito, habilidad de Puñorroca) — el
  // aliado se comprueba ANTES de arrancar (su posición de origen, no la de
  // cada paso intermedio): si está al lado, el camino se respeta tal cual;
  // si no, el primer paso es siempre el indicado, y desde el segundo cada
  // paso elige un vecino libre al azar encadenado desde el anterior,
  // deteniéndose antes de tiempo si no queda ningún vecino válido (nunca
  // "salta" a uno lejano). Vive en Units (no en Movement) porque es el
  // único punto de paso real de CUALQUIER desplazamiento del proyecto (ver
  // walkPath) — así cubre moverse normal, acercarse a atacar, acercarse al
  // gnomo/tótem/tienda, todo por igual, sin tocar cada mecánica.
  _applyPunorocaWobble(unit, path) {
    if (path.length < 2) return path;
    // Pedido explícito: "para que puñorroca ande bien obedeciendo tiene que
    // estar adyacente a un aliado en el momento en el que empieza a andar
    // ... a cualquier aliado, creo que ahora solo era el urgamente, pero
    // debe ser cualquier aliado" — ya NO se exige que sea un UrgaMentes en
    // concreto, basta con cualquier compañero de equipo a su lado.
    const hasAlly = this.list.some(
      (u) =>
        u.team === unit.team &&
        u.id !== unit.id &&
        Math.max(Math.abs(u.row - unit.row), Math.abs(u.col - unit.col)) <= 1
    );
    if (hasAlly) return path;

    const wobbled = [path[0]];
    let curRow = path[0].row;
    let curCol = path[0].col;
    for (let i = 1; i < path.length; i++) {
      const neighbors = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const r = curRow + dr;
          const c = curCol + dc;
          if (r < 0 || c < 0 || r >= this.boardSize || c >= this.boardSize) continue;
          if (this.unitAt(r, c)) continue;
          if (typeof Gnome !== "undefined" && Gnome.isAt(r, c)) continue;
          if (typeof Villages !== "undefined" && Villages.at(r, c)) continue;
          if (typeof Shops !== "undefined" && Shops.at(r, c)) continue;
          if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(r, c)) continue;
          neighbors.push({ row: r, col: c });
        }
      }
      if (neighbors.length === 0) break; // ya no puede seguir dando tumbos, se queda donde llegó
      const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
      wobbled.push(pick);
      curRow = pick.row;
      curCol = pick.col;
    }
    return wobbled;
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

      // Trampa de TruenoEspora (js/abilities.js) — se comprueba en CADA
      // paso, no solo al final del camino, para que explote en el instante
      // exacto en que un enemigo pisa esa casilla (aunque solo sea de paso
      // hacia otra).
      if (typeof Abilities !== "undefined") Abilities.checkTrigger(unit);

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
    const hp = Math.max(0, unit.hp);
    unit.hpSegmentEls.forEach((seg, i) => {
      const wasFilled = seg.classList.contains("unit__hpbar-segment--filled");
      const filled = i < hp;
      // Último punto de vida en rojo (mismo umbral que antes, unit.hp<=1) —
      // se lee como "cuidado, un golpe más y muere" solo en el segmento que
      // sigue en pie, no en toda la barra.
      seg.classList.toggle("unit__hpbar-segment--filled", filled);
      seg.classList.toggle("unit__hpbar-segment--low", filled && hp <= 1);
      // Segmento recién APAGADO (perdió ese punto justo ahora, no al
      // crear la barra) -> un pop de "rotura" en vez de apagarse sin más,
      // nivel Triple A pedido explícito. void...offsetWidth fuerza reflow
      // para poder repetirlo aunque el segmento ya tuviera la clase de una
      // vez anterior (mismo patrón que playShake/_applyFacing de aquí abajo).
      if (wasFilled && !filled) {
        seg.classList.remove("unit__hpbar-segment--pop");
        void seg.offsetWidth;
        seg.classList.add("unit__hpbar-segment--pop");
      }
    });
  },

  // Pequeño temblor de reacción (golpe recibido, y en el futuro cualquier
  // otro impacto/bloqueo) sobre `unit`.
  playShake(unit) {
    unit.el.classList.remove("unit--hit");
    void unit.el.offsetWidth; // fuerza reflow para poder repetir el temblor
    unit.el.classList.add("unit--hit");
  },

  // ---------- Miedo a morir (ver js/combat.js, Combat.showFor) ----------
  // Pedido explícito: "si un enemigo está al alcance y ese enemigo moriría
  // por el ataque del personaje seleccionado, dicho enemigo empiece a
  // temblar de miedo y que se gire de un lado a otro como hace el gnomo".
  // El temblor en sí es puro CSS (.unit--doomed, ver style.css, sustituye a
  // la respiración normal igual que unit--punching/unit--moving); lo único
  // que hace falta en JS es el mismo bucle que ya usa Gnome._startIdleFlipLoop
  // para "girarse de un lado a otro" solo — se referencia como el
  // comportamiento a imitar en el propio pedido — reescrito aquí en vez de
  // reutilizado porque Gnome._startIdleFlipLoop vive dentro de una instancia
  // de gnomo concreta (this.facing/this.el propios), no de una `unit`
  // normal; misma idea, cadencia random propia. Pedido explícito tras
  // probarlo en el juego: "los que tienen miedo se giran demasiadas veces...
  // queda muy exagerado, temblar bien pero no girarse tan de seguido" — el
  // temblor (puro CSS, ver arriba) se queda igual de intenso, solo se alarga
  // el intervalo entre giros (antes 260-520ms, ahora 1400-2200ms: parecido
  // al ritmo de girarse del gnomo en reposo, GNOME_IDLE_BASE_S en gnome.js,
  // en vez de mucho más rápido que él).
  startFearLoop(unit) {
    if (unit._fearTimer) return; // ya en marcha (p.ej. varias unidades pueden matarlo este turno)
    const tick = () => {
      unit._fearTimer = setTimeout(() => {
        if (!unit.el || !unit.el.classList.contains("unit--doomed")) return;
        unit.facing = unit.facing === "left" ? "right" : "left";
        this._applyFacing(unit);
        tick();
      }, 1400 + Math.random() * 800);
    };
    tick();
  },

  stopFearLoop(unit) {
    if (unit._fearTimer) clearTimeout(unit._fearTimer);
    unit._fearTimer = null;
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
    this.stopFearLoop(unit); // no dejar temblando/girando de miedo a una unidad que ya no existe
    unit.el.classList.add("unit--dying");
    SFX.death();
    await new Promise((resolve) => setTimeout(resolve, 420));
    unit.el.remove();
    this.list = this.list.filter((u) => u.id !== unit.id);
    // Tienda Goblin (js/shops.js) — si el personaje que acaba de morir era
    // el único que mantenía una tienda accesible, deja de estarlo (y su
    // popup, si estaba abierto, se cierra solo — ver Shops.refreshAll).
    if (typeof Shops !== "undefined") Shops.refreshAll();
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
    // Clic en casilla vacía también cierra cualquier placa de puntos de
    // gnomo abierta (ver js/gnome.js) — igual que deseleccionar, es el
    // comportamiento esperado al "hacer clic fuera".
    if (typeof Gnome !== "undefined") Gnome.hideAllBadges();
  });
});

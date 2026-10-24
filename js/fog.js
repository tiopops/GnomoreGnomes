/* Gnomore Gnomes — niebla de guerra (fog of war).
   Regla de oro: un archivo por mecánica. Este archivo solo sabe QUÉ losetas
   están reveladas y CUÁNDO revelar más — no pinta la niebla en sí (eso lo
   hace js/fogcanvas.js, un único lienzo) ni decide a qué casillas puede
   moverse una unidad (eso lo sigue decidiendo js/movement.js, que consulta
   Fog.isFogged para excluir de su rango las que aún no se han revelado —
   pedido explícito: "un personaje no puede moverse a una zona que esté
   cubierta por niebla, pero sí a una adyacente a la misma").

   Pedido explícito: "el mapa se genera oculto bajo estas losetas hasta que
   se revelan y dejan ver realmente lo que hay debajo" — el mapa (terreno,
   enemigos...) YA existe entero desde el principio (generateMap/
   spawnRandomEnemy no cambian), la niebla solo lo tapa visualmente hasta
   que este archivo decide revelar cada loseta.

   Mantiene Fog.revealedGrid/perceivedGrid y avisa a FogCanvas de cada loseta
   que se revela; applyVisibility oculta/muestra a quien quede bajo la niebla. */

// Radio (casillas, distancia Chebyshev) revelado alrededor de cada
// personaje AL EMPEZAR la partida — pedido explícito: FIJO, no depende de
// la PERCEPCION de cada uno (esa estadística solo entra en juego a partir
// del primer movimiento, ver Fog.revealForUnit).
// Pedido explícito (pasada posterior): "al principio del juego se despejan
// 3 casillas alrededor de tu obelisco en lugar de 2" — subido de 2 a 3.
// Además de lo puramente visual, esto arregla una inconsistencia real: el
// Obelisco propio (único "personaje" que usa este radio inicial, ver
// playerSpawnSpots en newgame-flow.js — en este modo se empieza con 0
// unidades reclutadas) ya tenía percepción PERMANENTE de radio 3
// (FOG_OBELISK_PERCEPTION_RADIUS, ver más abajo), pero con el revelado
// inicial en radio 2 ese tercer anillo quedaba "percibido" sin haber sido
// nunca "revelado" (revealedGrid) — Fog.applyVisibility esconde una
// entidad si CUALQUIERA de las dos cosas falla (isFogged || !isPerceived,
// ver más abajo), así que esa nube nunca llegaba a disiparse aunque el
// Obelisco ya la estuviera vigilando desde el primer fotograma. Con los
// dos radios iguales, el aro que el Obelisco perciba siempre corresponde
// al aro que se ve despejado.
const FOG_INITIAL_RADIUS = 3;

// Pedido explícito: "añade un checkbox para desactivar/activar la animacion
// de la niebla en configuracion. en la interfaz movil por defecto estara
// desactivada" — mismo patrón EXACTO que Shadows.enabled/setEnabled
// (js/shadows.js): una sola clase en <body>, nunca se recorren las 289
// losetas al tocar el checkbox. La animación en sí (fog-idle-drift) y el
// will-change que promociona cada loseta a su propia capa de composición
// viven en la regla base .tile__fog de style.css; con animEnabled=false se
// anulan ambos con "body.gg-fog-anim-off .tile__fog" (ver style.css) — no
// solo se para la animación, también se quita will-change, que si no
// seguiría reservando una capa GPU por loseta aunque no se moviera nada.
// Umbral de "interfaz móvil" — el mismo que ya usan gnome.js/abilities.js
// para elegir entre UI_LAYOUT.infoCircle/infoCircleMobile.
const FOG_ANIM_STORAGE_KEY = "gnomoregnomes_fog_anim";
const FOG_ANIM_MOBILE_BREAKPOINT = 480;

// Pedido explícito: "ademas de disiparse la niebla, haz zonas que no podran
// verse porque no estan dentro del alcance de percepcion de nuestras
// unidades... las casillas dentro de la percepcion de las unidades de los
// jugadores, 2 casillas alrededor de los totems capturados y 3 alreddor de
// los obeliscos, son siempre visibles mientras esten bajo tu dominio" — dos
// radios fijos, nada que ver con FOG_INITIAL_RADIUS (ese es el revelado
// PERMANENTE de arranque; esto es percepción EN DIRECTO, recalculada en
// cada pasada, ver _recomputePerception).
const FOG_VILLAGE_PERCEPTION_RADIUS = 2;
const FOG_OBELISK_PERCEPTION_RADIUS = 3;

const Fog = {
  size: 0,
  revealedGrid: null, // boolean[row][col], o null si todavía no se ha inicializado esta partida — PERMANENTE, "¿ha llegado a verse alguna vez?"
  // boolean[row][col] — EFÍMERO, recalculado en cada applyVisibility():
  // "¿hay ahora mismo algo mío (unidad, tótem o Obelisco propios) que vea
  // esta casilla EN DIRECTO?". Una casilla puede estar revelada (memoria)
  // sin estar percibida ahora mismo — ese es justo el estado "recordado"
  // que pidió el usuario (ver isPerceived/_recomputePerception más abajo).
  perceivedGrid: null,
  animEnabled: true,

  // Se llama UNA vez al cargar la página (igual que Shadows.init), no por
  // partida — el propio checkbox de configuración vive fuera de cualquier
  // partida concreta (ver js/settingsmenu.js) y su preferencia debe
  // aplicarse ANTES de que exista ninguna loseta de niebla todavía (a la
  // primera partida nueva ya le toca crear sus <img> de niebla con la
  // clase de <body> ya puesta, sin parpadeo).
  // Interfaz móvil (mismo criterio que css/mobile.css): la niebla NUNCA se anima, no es una opción.
  _mobileUI() {
    try { return window.matchMedia("(max-width: 720px), (max-height: 560px)").matches; } catch (e) { return false; }
  },

  initAnimPref() {
    if (this._mobileUI()) { this.animEnabled = false; this._applyAnimToggle(); return; }
    const saved = localStorage.getItem(FOG_ANIM_STORAGE_KEY);
    if (saved === null) {
      // Sin preferencia guardada todavía: activada en escritorio, apagada
      // por defecto en móvil (pedido explícito) — se decide una sola vez
      // aquí; a partir de la primera vez que el jugador toque el
      // checkbox, su elección se respeta siempre, sea cual sea el ancho
      // de pantalla en partidas futuras.
      this.animEnabled = window.innerWidth > FOG_ANIM_MOBILE_BREAKPOINT;
    } else {
      this.animEnabled = saved === "1";
    }
    this._applyAnimToggle();
  },

  setAnimEnabled(enabled) {
    if (this._mobileUI()) {
      // En móvil siempre apagada y sin guardar nada: así al volver a escritorio se respeta su preferencia.
      this.animEnabled = false;
      this._applyAnimToggle();
      if (typeof FogCanvas !== "undefined") FogCanvas.onAnimToggle();
      return;
    }
    this.animEnabled = !!enabled;
    localStorage.setItem(FOG_ANIM_STORAGE_KEY, this.animEnabled ? "1" : "0");
    this._applyAnimToggle();
    if (typeof FogCanvas !== "undefined") FogCanvas.onAnimToggle();
  },

  _applyAnimToggle() {
    document.body.classList.toggle("gg-fog-anim-off", !this.animEnabled);
  },

  // Se llama UNA vez al generar/pintar cada mapa nuevo (spawnTestUnits en
  // newgame-flow.js), DESPUÉS de renderMap — necesita que los .tile ya
  // existan en el DOM para poder cachear sus .tile__fog. Todo el mapa
  // arranca oculto; el revelado inicial lo hace quien llama a esto,
  // personaje a personaje, con revealInitial.
  init(size, container) {
    this.size = size;
    this.revealedGrid = Array.from({ length: size }, () => new Array(size).fill(false));
    this.perceivedGrid = Array.from({ length: size }, () => new Array(size).fill(false));
    // Pedido explícito: "cuando la surcabosques usa vision lejana, la zona
    // se revela sin niebla durante 4 segundos, despues la niebla se
    // apodera de la zona de nuevo" — ver _tempPerceptionSources/
    // addTemporaryPerception más abajo. Se reinicia en cada partida nueva
    // (cualquier timeout pendiente de una partida anterior ya no debe
    // tocar el revealedGrid/perceivedGrid recién creados de arriba).
    this._tempPerceptionSources = [];
    // Pedido explícito: "el color de las losetas del terreno que esten
    // dentro de niebla de guerra tambien debe desaturarse". Lista simple
    // (no todo revealedGrid) de las losetas YA reveladas — solo esas
    // necesitan comprobar su percepción en cada applyVisibility (ver más
    // abajo), evitando recorrer el tablero entero (hasta 625 losetas) en
    // cada movimiento cuando, sobre todo al principio de la partida, la
    // inmensa mayoría siguen sin descubrir.
    this._revealedPositions = [];
    // La niebla se pinta en UN solo lienzo (js/fogcanvas.js); aquí solo vive el estado.
    this._container = container;
    if (typeof FogCanvas !== "undefined") FogCanvas.setup(size);
    // Modo rendimiento: el terreno de losetas sin explorar (y sin vecinas exploradas) no se pinta
    // debajo de la niebla (ver "tile--unexplored" en style.css; solo actúa con body.perf-mode).
    if (typeof TerrainMap !== "undefined") TerrainMap.markAllUnexplored();
  },

  // false si no hay niebla activa todavía (p.ej. una herramienta de debug
  // que no llama a Fog.init) — así ningún otro archivo necesita comprobar
  // "typeof Fog" Y "Fog.revealedGrid" a la vez, con esto basta.
  // Niebla REAL del jugador, sin la excepción del turno de la IA: para el
  // escenario estático (pinos, rocas, arbustos, hierbajos, tambores), que
  // durante el turno rival asomaba sobre la niebla porque isFogged() devuelve
  // false mientras juega la IA.
  isFoggedReal(row, col) {
    if (!this.revealedGrid || this._lifted) return false; // _lifted: El Vigilante (js/oracle.js)
    if (row < 0 || col < 0 || row >= this.size || col >= this.size) return false;
    return !this.revealedGrid[row][col];
  },

  isFogged(row, col) {
    if (!this.revealedGrid || this._lifted) return false; // _lifted: El Vigilante (js/oracle.js)
    // La IA no está limitada por la niebla del jugador
    // (si no, quedarían encerrados en su esquina).
    if (typeof Teams !== "undefined" && typeof Turns !== "undefined" && Turns._aiRunning && Turns.activeTeam !== "player") return false;
    if (row < 0 || col < 0 || row >= this.size || col >= this.size) return false;
    return !this.revealedGrid[row][col];
  },

  // true si esta loseta está viéndose EN DIRECTO ahora mismo (percepción de
  // unidades propias, o dentro del radio fijo de un tótem/Obelisco
  // propios) — false si nunca se ha visto (sigue tapada del todo por
  // isFogged) o si ya se vio alguna vez pero ahora mismo queda fuera de
  // percepción ("recordada", ver gg-remembered en style.css). Sin niebla
  // activa (debug) se considera todo percibido, igual que hace isFogged
  // devolviendo "no hay niebla" con false.
  isPerceived(row, col) {
    if (this._lifted) return true; // El Vigilante (js/oracle.js)
    if (typeof Tutorial !== "undefined" && Tutorial.active) return true; // tutorial: todo a la vista
    if (!this.perceivedGrid) return true;
    if (row < 0 || col < 0 || row >= this.size || col >= this.size) return false;
    return !!this.perceivedGrid[row][col];
  },

  // Recalcula perceivedGrid de cero cada vez que se llama (barato: como
  // mucho unas pocas decenas de unidades/tótems/Obeliscos propios, nada que
  // ver con recorrer las 289 losetas del tablero para cada una — el radio
  // de cada fuente es pequeño). Se llama SIEMPRE al principio de
  // applyVisibility (ver más abajo) para no tener que acordarse de tocar
  // cada sitio que hoy dispara un revelado o un cambio de dueño por
  // separado — el mismo punto único de paso de siempre en este archivo.
  _recomputePerception() {
    if (!this.revealedGrid) return;
    const grid = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
    const markAround = (row, col, radius) => {
      for (let r = Math.max(0, row - radius); r <= Math.min(this.size - 1, row + radius); r++) {
        for (let c = Math.max(0, col - radius); c <= Math.min(this.size - 1, col + radius); c++) {
          if (Math.max(Math.abs(r - row), Math.abs(c - col)) > radius) continue;
          grid[r][c] = true;
        }
      }
    };
    // Percepción de cada unidad propia (misma estadística que ya usa
    // revealForUnit para el revelado permanente, ver UNIT_TYPES[...].percepcion).
    // Centinela (js/skills.js): +1 de percepción a unidades, tótems y Obelisco.
    const sentinel = typeof Skills !== "undefined" ? Skills.perceptionBonus("player") : 0;
    if (typeof Units !== "undefined") {
      Units.list.forEach((u) => {
        if (u.team !== "player") return;
        const type = UNIT_TYPES[u.typeId];
        markAround(u.row, u.col, (type ? type.percepcion : 1) + sentinel);
      });
    }
    // Pedido explícito: "2 casillas alrededor de los totems capturados...
    // son siempre visibles mientras esten bajo tu dominio".
    if (typeof Villages !== "undefined") {
      Villages.list.forEach((v) => {
        if (v.owner === "player") markAround(v.row, v.col, FOG_VILLAGE_PERCEPTION_RADIUS + sentinel);
      });
    }
    // Pedido explícito: "3 alreddor de los obeliscos" — un Obelisco nunca
    // cambia de dueño en esta versión (confirmado: ningún sitio del
    // proyecto reasigna o.team), así que esto es en la práctica un radio
    // fijo permanente alrededor de la base de cada equipo desde el
    // arranque de la partida.
    if (typeof Obelisks !== "undefined") {
      Obelisks.list.forEach((o) => {
        if (o.team === "player") markAround(o.row, o.col, FOG_OBELISK_PERCEPTION_RADIUS + sentinel);
      });
    }
    // TotemVision (js/totemvision.js) — pedido explícito: "otorga vision
    // como si tuviera percepcion 3", mismo mecanismo fijo que un tótem/
    // Obelisco propio justo arriba, mientras siga en pie (un tótem roto ya
    // no está en TotemVision.list).
    if (typeof TotemVision !== "undefined") TotemVision.markPerception(markAround);
    // GnomOgro (js/gnomogro.js) — pedido explícito: "el gnomogro es visible
    // con un radio alrededor de el de 1 para todos los jugadores de la
    // partida". Sin distinguir equipo (a diferencia de Units/Villages/
    // Obelisks de arriba, que solo cuentan si son "player"): sea cual sea
    // su bando, sigue percibido para el jugador humano — es la única
    // fuente de percepción de este archivo que no filtra por team.
    if (typeof GnomOgro !== "undefined" && GnomOgro.current) {
      markAround(GnomOgro.current.row, GnomOgro.current.col, GNOMOGRO_PERCEPTION_RADIUS);
    }
    // Pedido explícito: "cuando la surcabosques usa vision lejana...la
    // zona se revela...durante 4 segundos" — fuentes de percepción
    // temporales (ver addTemporaryPerception), que expiran solas. Un
    // filtro por si acaso (el propio setTimeout de addTemporaryPerception
    // ya las quita de la lista al expirar) para no depender ÚNICAMENTE de
    // que ese timeout dispare a tiempo si esta función se llama justo en
    // el instante límite.
    const now = Date.now();
    this._tempPerceptionSources.forEach((src) => {
      if (src.expiresAt > now) markAround(src.row, src.col, src.radius);
    });
    this.perceivedGrid = grid;
  },

  // Pedido explícito: "cuando la surcabosques usa vision lejana, la zona
  // se revela sin niebla de guerra durante 4 segundos, despues la niebla
  // se apodera de la zona de nuevo" — hasta ahora Visión Lejana solo
  // llamaba a revealAround (arriba: revela el TERRENO para siempre, ver su
  // comentario) pero nunca tocaba perceivedGrid, así que cualquier rival
  // de pie en esa zona seguía invisible del todo (unit--fog-hidden, ver
  // applyVisibility) incluso en el instante de usar la habilidad — la
  // "exploración" solo enseñaba el paisaje, nunca a quién había en él, que
  // es justo lo que se espera de una habilidad de reconocimiento. Esto
  // añade una fuente de percepción EFÍMERA (igual que la de una unidad/
  // tótem/Obelisco propios en _recomputePerception, pero con caducidad):
  // durante `durationMs` cualquier rival dentro del radio se ve con
  // normalidad, y al expirar vuelve a ocultarse — el terreno en sí (ver
  // revealAround, llamado aparte por quien use esto) se queda revelado
  // para siempre, solo la percepción EN DIRECTO es temporal.
  addTemporaryPerception(row, col, radius, durationMs) {
    if (!this.revealedGrid) return;
    const source = { row, col, radius, expiresAt: Date.now() + durationMs };
    this._tempPerceptionSources.push(source);
    this.applyVisibility();
    setTimeout(() => {
      const idx = this._tempPerceptionSources.indexOf(source);
      if (idx !== -1) this._tempPerceptionSources.splice(idx, 1);
      // Puede que la partida ya haya terminado / se haya reiniciado
      // (revealedGrid nuevo) para cuando este timeout dispare — nada que
      // limpiar en ese caso, applyVisibility ya comprueba revealedGrid.
      this.applyVisibility();
    }, durationMs);
  },

  // Revela todas las losetas dentro de `radius` (incluida la propia). No
  // hace nada con las que ya estaban reveladas — idempotente, se puede
  // llamar tantas veces como haga falta sin animación repetida ni coste
  // extra en las que no cambian.
  // `instant`: sin animación de disipado (la niebla desaparece ya, sin 'ZAS' visible;
  // lo usa el tutorial para dejar su escenario despejado DURANTE la pantalla de carga).
  revealAround(row, col, radius, instant) {
    if (!this.revealedGrid) return;
    for (let r = Math.max(0, row - radius); r <= Math.min(this.size - 1, row + radius); r++) {
      for (let c = Math.max(0, col - radius); c <= Math.min(this.size - 1, col + radius); c++) {
        if (Math.max(Math.abs(r - row), Math.abs(c - col)) > radius) continue;
        this._reveal(r, c, instant);
      }
    }
    // Puede que este revelado acabe de dejar a la vista a algún rival o
    // gnomo que ya estaba ahí de pie (ver applyVisibility más abajo) — una
    // sola pasada al final del radio entero, no una por loseta individual.
    this.applyVisibility();
  },

  // El Vigilante (js/oracle.js) levanta/baja toda la niebla.
  _onLiftChanged(on) {
    if (typeof FogCanvas !== "undefined") FogCanvas.setLifted(on);
  },


  _reveal(row, col, instant) {
    if (this.revealedGrid[row][col]) return;
    this.revealedGrid[row][col] = true;
    this._revealedPositions.push({ row, col });
    if (typeof TerrainMap !== "undefined") {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) TerrainMap.markExplored(row + dr, col + dc);
    }
    // Terreno real (js/mapgen.js, TerrainMap): "la loseta de agua sustituye a las de hierba, pero
    // inicialmente bajo la niebla todas son de hierba hasta que se revelan". Se dispara cuando
    // empieza a disiparse la nube, para que el cambio de textura quede disimulado detrás de ella.
    if (typeof TerrainMap !== "undefined") TerrainMap.revealTile(row, col);
    if (!instant) this._watchEntityReveal();
    // La nube se disipa en el lienzo de niebla (js/fogcanvas.js).
    if (typeof FogCanvas !== "undefined") FogCanvas.onReveal(row, col, !!instant);
  },

  // Fallo de revelado: al revelar una loseta, applyVisibility quita
  // unit--fog-hidden de árboles/rocas/unidades EN EL ACTO, mientras su nube
  // aún está opaca (se disipa 1.2 s) -> aparecían de golpe ("pop"), y en
  // móvil (perf-mode usa display:none) sin ningún fundido. Durante la
  // ventana de un revelado se observan los cambios de clase y a cada
  // elemento que deja de estar oculto se le da unit--fog-in: fundido
  // retrasado hasta que la nube ya se ha aclarado (ver style.css).
  _watchEntityReveal() {
    clearTimeout(this._werT);
    this._werT = setTimeout(() => {
      if (this._wer) { this._wer.disconnect(); this._wer = null; }
    }, 1700);
    if (this._wer || typeof MutationObserver === "undefined") return;
    this._wer = new MutationObserver((muts) => {
      for (const m of muts) {
        const el = m.target;
        if (!el.classList || el.classList.contains("unit--fog-in")) continue;
        if ((m.oldValue || "").indexOf("unit--fog-hidden") < 0) continue;
        if (el.classList.contains("unit--fog-hidden")) continue;
        el.classList.add("unit--fog-in");
        el.addEventListener("animationend", (e) => {
          if (e.target === el) el.classList.remove("unit--fog-in");
        }, { once: true });
        setTimeout(() => el.classList.remove("unit--fog-in"), 1500);
      }
    });
    this._wer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true });
  },

  // Revelado FIJO al empezar la partida — ver FOG_INITIAL_RADIUS arriba.
  revealInitial(row, col) {
    this.revealAround(row, col, FOG_INITIAL_RADIUS, true); // la partida ya empieza despejada: sin disipado
  },

  // Revelado tras moverse — SÍ según la PERCEPCION de quien se ha movido
  // (pedido explícito: "se revelarán según su percepción al terminar el
  // desplazamiento... para casillas más lejanas..."; ver js/movement.js,
  // que llama a esto justo después de terminar el desplazamiento paso a
  // paso, antes de que el gnomo reaccione).
  revealForUnit(unit) {
    if (unit.team !== "player") return; // cada jugador tiene SU niebla (también en multijugador)
    const type = UNIT_TYPES[unit.typeId];
    this.revealAround(unit.row, unit.col, type.percepcion + (typeof Skills !== "undefined" && unit.team === "player" ? Skills.perceptionBonus("player") : 0));
  },

  // Pedido explícito: "los elementos de debajo de la niebla no deben
  // renderizarse para el jugador que está jugando... no puedo ver asomar
  // por una esquina de la niebla la cabeza de un personaje enemigo... solo
  // se renderiza para mí, cuando esa niebla no está" — hasta ahora la niebla
  // solo TAPABA visualmente (z-index por encima) sin impedir que el rival o
  // el gnomo se siguieran pintando debajo de verdad; como la nube de niebla
  // no es un rectángulo perfecto pegado a cada loseta (tiene bordes suaves y
  // sobresale por encima con FOG_OVERHANG, ver mapgen.js) ni cubre toda la
  // altura de un personaje de pie (más alto que su propia loseta), quedaban
  // huecos por los que se veía asomar quien estuviera debajo. La solución de
  // verdad no es "tapar mejor" (seguiría dependiendo del arte concreto de la
  // nube) sino no pintar en absoluto lo que el jugador no debería poder ver
  // todavía — oculta con la clase "unit--fog-hidden" (ver style.css,
  // visibility:hidden: conserva su sitio en el DOM sin más lógica especial,
  // y de paso dejan de poder recibir clics) a cualquier rival o gnomo suelto
  // que esté de pie sobre una loseta sin revelar. Las unidades del propio
  // jugador NUNCA se ocultan (nunca deberían poder estar sobre niebla suya,
  // ver la exclusión en Movement.reachableTiles, pero se excluyen aquí
  // también por seguridad) y un gnomo COGIDO no se toca directamente — su
  // sprite ya vive dentro del personaje que lo lleva (gnome-attach, ver
  // GnomeInstance.attachTo) así que hereda la visibilidad de ese personaje
  // sin necesitar su propia comprobación.
  applyVisibility() {
    if (!this.revealedGrid) return;
    // Punto único de paso (ver cabecera del archivo) — así ningún sitio que
    // dispara applyVisibility (movimiento, aparición, muerte, captura de
    // tótem...) necesita acordarse de recalcular esto por su cuenta.
    this._recomputePerception();
    // Pedido explícito: "el color de las losetas del terreno que esten
    // dentro de niebla de guerra tambien debe desaturarse como el resto de
    // elementos" — mismo criterio "recordado" que tótems/Obeliscos/
    // tiendas/recursos más abajo: una loseta YA revelada (isFogged=false)
    // se queda a color completo mientras algo mío la perciba EN DIRECTO
    // ahora mismo, y se atenúa (gg-remembered) en cuanto deja de estarlo —
    // nunca vuelve a estar fogged, solo "recordada". Solo recorre las
    // losetas de _revealedPositions (ver _reveal), nunca el tablero
    // entero.
    if (typeof TerrainMap !== "undefined" && TerrainMap.setRemembered) {
      this._revealedPositions.forEach(({ row, col }) => {
        TerrainMap.setRemembered(row, col, !this.isPerceived(row, col));
      });
    }
    if (typeof Units !== "undefined") {
      Units.list.forEach((u) => {
        if (!u.el) return;
        // Arbustos (js/bushes.js) — pedido explícito (afinado en una pasada
        // posterior): "los personajes que estan ocultos en un arbusto deben
        // situarse detras del sprite del arbusto...el personaje se
        // oscurecera un poco simulando que esta oculto en la sombra" — a
        // diferencia de la ocultación total de un rival bajo niebla
        // (unit--fog-hidden, visibility:hidden), el propio dueño SIGUE
        // viendo a su personaje escondido, solo que atenuado y con un icono
        // propio (unit--in-bush, ver style.css/Units.spawnUnit) — así que
        // esto no puede vivir en el mismo toggle que unit--fog-hidden de
        // abajo (ese sigue excluyendo SIEMPRE a "player").
        const inBush = typeof Bushes !== "undefined" && Bushes.isHidingUnit(u);
        u.el.classList.toggle("unit--in-bush", inBush);
        // Por debajo del propio arbusto (mismo z-index de loseta que ya usa
        // Units.hopTo/spawnUnit, -1 para perder el empate con el del
        // arbusto, ver Bushes._placeInstant: misma fórmula +5) mientras dure
        // escondido; en cuanto deja de estarlo, el próximo hopTo/spawn ya
        // vuelve a fijar el +5 normal, así que no hace falta "restaurar"
        // nada aquí explícitamente.
        if (inBush) u.el.style.zIndex = String((u.row + u.col) * 10 + 4);

        if (u.team === "player") return; // el jugador nunca oculta del todo a los suyos (niebla normal)
        // Un rival escondido en un arbusto (a ojos del jugador, que es quien
        // ve esta pantalla) sigue totalmente invisible, igual que bajo
        // niebla sin revelar — reutiliza tal cual la misma clase
        // unit--fog-hidden en vez de inventar un segundo sistema de
        // ocultación, y NO depende de si la loseta ya está explorada: un
        // arbusto en zona ya revelada sigue ocultando a quien esté dentro
        // hasta que se le emboque (ver Bushes._springAmbush) o se mueva.
        // Pedido explícito (memoria de niebla): "las casillas desactivadas
        // visualmente por estar fuera del alcance de percepcion de mis
        // unidades..." — a diferencia de un tótem/recurso/arbusto (que se
        // quedan visibles pero atenuados, ver gg-remembered más abajo), la
        // posición EN DIRECTO de una unidad (propia o rival) nunca debe
        // "recordarse": fuera de percepción se oculta del todo, igual que
        // bajo niebla sin descubrir, para no filtrar dónde está de verdad
        // AHORA MISMO alguien que se mueve.
        u.el.classList.toggle(
          "unit--fog-hidden",
          this.isFoggedReal(u.row, u.col) || !this.isPerceived(u.row, u.col) || inBush
        );
      });
      // Arbustos (js/bushes.js) — mismo criterio sin excepción que un
      // tótem/obelisco enemigo: "NADA debe verse si tiene niebla encima".
      if (typeof Bushes !== "undefined") {
        Bushes.list.forEach((b) => {
          if (!b.el) return;
          const fogged = this.isFoggedReal(b.row, b.col);
          b.el.classList.toggle("unit--fog-hidden", fogged);
          // Pedido explícito: elemento estático de escenario ya explorado
          // pero fuera de percepción ahora mismo -> se queda a la vista,
          // "recordado" (atenuado + sin animar, ver .gg-remembered en
          // style.css), no se oculta del todo como una unidad.
          b.el.classList.toggle("gg-remembered", !fogged && !this.isPerceived(b.row, b.col));
        });
      }
      // Recursos de escenario (js/resources.js) — pedido explícito: "los
      // arbustos deben ocultarse bajo la niebla si aun no han sido
      // descubiertos" aplicado igual a rocas/mena/pinos.
      if (typeof Resources !== "undefined") Resources.refreshFog();
      // Pedido explícito: "las barras de vida de los recursos solo deben
      // mostrarse cuando un personaje esta en una casilla adyacente a
      // ellos" — mismo punto único de paso que refreshFog, ver su
      // comentario en js/resources.js (Resources.refreshHpVisibility).
      if (typeof Resources !== "undefined") Resources.refreshHpVisibility();
      // Hierbajos (js/hierbajos.js) — vegetación decorativa, mismo criterio
      // que arbustos/recursos: oculta bajo niebla sin descubrir todavía.
      if (typeof Hierbajos !== "undefined") Hierbajos.refreshFog();
      if (typeof Drums !== "undefined") Drums.refreshFog();
      if (typeof Egg !== "undefined") Egg.refreshFog();
      if (typeof Crane !== "undefined") Crane.refreshFog();
      if (typeof Bumpers !== "undefined") Bumpers.refreshFog();
      if (typeof Volcano !== "undefined") Volcano.refreshFog();
    }
    if (typeof Gnome !== "undefined") {
      const veo = Gnome.veoGnomes("player"); // GnomeVeo: gnomos siempre visibles
      Gnome.list.forEach((g) => {
        if (g.el) {
          const was = g.el.classList.contains("gnome--veo");
          g.el.classList.toggle("gnome--veo", veo.has(g));
          // Por encima de TODA la niebla ("como si andase sobre ella"); al perder el
          // efecto se restaura el z-index normal de su loseta.
          if (veo.has(g)) g.el.style.zIndex = "3000";
          else if (was) g.el.style.zIndex = String((g.row + g.col) * 10 + 5);
        }
        if (g.heldBy || !g.el) return;
        if (veo.has(g)) { g.el.classList.remove("unit--fog-hidden"); return; }
        // Mismo criterio que una unidad: un gnomo suelto se mueve por su
        // cuenta cada turno, así que fuera de percepción se oculta del todo
        // en vez de "recordarse" en su última posición vista (eso filtraría
        // dónde sigue estando ahora mismo).
        g.el.classList.toggle("unit--fog-hidden", this.isFoggedReal(g.row, g.col) || !this.isPerceived(g.row, g.col));
      });
    }
    // "los totems no deben verse a traves de la niebla, realmente NADA debe
    // verse si tiene niebla encima" (pedido explícito) — a diferencia de
    // las unidades de arriba, un poblado/tótem se oculta SIEMPRE que su
    // loseta esté sin revelar, sea de quien sea (no hay excepción para
    // "player" como con las unidades: un tótem no se mueve ni until ahora
    // se sabía nada de esta regla, así que ni siquiera el propio tótem del
    // jugador debía quedar visible antes de haber explorado su loseta).
    if (typeof Villages !== "undefined") {
      Villages.list.forEach((v) => {
        if (!v.el) return;
        const fogged = this.isFoggedReal(v.row, v.col); // sin la excepción del turno rival (multijugador: no delatar edificios)
        v.el.classList.toggle("unit--fog-hidden", fogged);
        // Pedido explícito: mientras el tótem sea del jugador, su radio fijo
        // de percepción (FOG_VILLAGE_PERCEPTION_RADIUS) lo mantiene siempre
        // percibido, así que esto solo entra en juego para un tótem neutral
        // o enemigo ya explorado que quede fuera del alcance real de las
        // unidades propias.
        v.el.classList.toggle("gg-remembered", !fogged && !this.isPerceived(v.row, v.col));
        // Niebla = solo lo último visto: al volver a percibirlo se pone al día
        // lo que cambió mientras estaba fuera de vista (ver Villages.syncVisual).
        if (!fogged && this.isPerceived(v.row, v.col) && Villages.syncVisual) Villages.syncVisual(v);
      });
    }
    // Objetos colocados en el tablero (js/backpack.js, p.ej. la
    // Setarcoiris) — mismo criterio sin excepción que un tótem: "NADA debe
    // verse si tiene niebla encima", nunca colocan uno sobre niebla propia
    // pero sí puede quedar oculto si la niebla vuelve a cerrarse encima.
    if (typeof Backpack !== "undefined") {
      Backpack.placedItems.forEach((item) => {
        if (!item.el) return;
        const fogged = this.isFoggedReal(item.row, item.col); // sin la excepción del turno rival (multijugador: no delatar edificios)
        item.el.classList.toggle("unit--fog-hidden", fogged);
        item.el.classList.toggle("gg-remembered", !fogged && !this.isPerceived(item.row, item.col));
      });
    }
    // Tienda Goblin (js/shops.js) — mismo criterio sin excepción que un
    // tótem: "NADA debe verse si tiene niebla encima", aunque sea neutral.
    if (typeof Shops !== "undefined") {
      Shops.list.forEach((shop) => {
        if (!shop.el) return;
        const fogged = this.isFoggedReal(shop.row, shop.col); // sin la excepción del turno rival (multijugador: no delatar edificios)
        shop.el.classList.toggle("unit--fog-hidden", fogged);
        shop.el.classList.toggle("gg-remembered", !fogged && !this.isPerceived(shop.row, shop.col));
      });
    }
    if (typeof Oracle !== "undefined") {
      Oracle.list.forEach((o) => {
        if (!o.el) return;
        const fogged = this.isFoggedReal(o.row, o.col); // sin la excepción del turno rival (multijugador: no delatar edificios)
        o.el.classList.toggle("unit--fog-hidden", fogged);
        o.el.classList.toggle("gg-remembered", !fogged && !this.isPerceived(o.row, o.col));
      });
    }
    // Altar de Sacrificios (js/altar.js) — pedido explícito: "el altar
    // tambien debe oscurecerse en la niebla de guerra". Mismo criterio que
    // una Tienda Goblin: oculto si su loseta sigue sin explorar y atenuado
    // ("recordado") si ya se vio pero ahora queda fuera de percepción.
    if (typeof Mushrooms !== "undefined") Mushrooms.refreshFog();
    if (typeof Altar !== "undefined") {
      Altar.list.forEach((a) => {
        if (!a.el) return;
        const fogged = this.isFoggedReal(a.row, a.col); // sin la excepción del turno rival (multijugador: no delatar edificios)
        a.el.classList.toggle("unit--fog-hidden", fogged);
        a.el.classList.toggle("gg-remembered", !fogged && !this.isPerceived(a.row, a.col));
      });
    }
    // Obeliscos Ancestrales (js/obelisks.js) — pedido explícito: "los
    // obeliscos enemigos deben estar ocultos en la niebla hasta que se
    // descubran". A diferencia de un tótem (siempre oculto bajo niebla, sea
    // de quien sea), aquí SÍ hay excepción para "player" — mismo criterio
    // que las unidades de arriba: el jugador siempre sabe dónde está el
    // suyo propio, solo el del rival puede quedar sin descubrir todavía.
    // El propio Obelisco del jugador nunca "se recuerda": su radio fijo
    // (FOG_OBELISK_PERCEPTION_RADIUS) lo mantiene siempre percibido, ver
    // _recomputePerception.
    if (typeof Obelisks !== "undefined") {
      Obelisks.list.forEach((o) => {
        if (!o.el) return;
        if (o.team === "player") {
          o.el.classList.remove("gg-remembered");
          return;
        }
        const fogged = this.isFoggedReal(o.row, o.col); // sin la excepción del turno rival (multijugador: no delatar edificios)
        o.el.classList.toggle("unit--fog-hidden", fogged);
        o.el.classList.toggle("gg-remembered", !fogged && !this.isPerceived(o.row, o.col));
        if (typeof Units !== "undefined" && Units.updateHpBar) Units.updateHpBar(o);
      });
    }
    // TotemVision (js/totemvision.js) — mismo criterio que un tótem/tienda:
    // "NADA debe verse si tiene niebla encima" para el del rival, nunca
    // para el propio (ver TotemVision.refreshFogVisibility).
    if (typeof TotemVision !== "undefined") TotemVision.refreshFogVisibility();
    // Un sprite visible puede solaparse con nubes de losetas vecinas sin revelar: ya lo resuelve el
    // propio lienzo (js/fogcanvas.js), que va por encima de los sprites; solo hay que avisarle.
    if (typeof FogCanvas !== "undefined") FogCanvas.onVisibilityChanged();
  },

};

document.addEventListener("DOMContentLoaded", () => Fog.initAnimPref());

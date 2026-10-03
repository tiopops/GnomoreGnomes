/* Gnomore Gnomes — niebla de guerra (fog of war).
   Regla de oro: un archivo por mecánica. Este archivo solo sabe QUÉ losetas
   están reveladas y CUÁNDO revelar más — no pinta la niebla en sí (eso lo
   hace js/mapgen.js, que crea SIEMPRE la capa .tile__fog en cada loseta al
   generar el mapa, visible por defecto) ni decide a qué casillas puede
   moverse una unidad (eso lo sigue decidiendo js/movement.js, que consulta
   Fog.isFogged para excluir de su rango las que aún no se han revelado —
   pedido explícito: "un personaje no puede moverse a una zona que esté
   cubierta por niebla, pero sí a una adyacente a la misma").

   Pedido explícito: "el mapa se genera oculto bajo estas losetas hasta que
   se revelan y dejan ver realmente lo que hay debajo" — el mapa (terreno,
   enemigos...) YA existe entero desde el principio (generateMap/
   spawnRandomEnemy no cambian), la niebla solo lo tapa visualmente hasta
   que este archivo decide revelar cada loseta.

   Se apoya en los atributos data-row/data-col que mapgen.js ya deja en cada
   `.tile` (y en su `.tile__fog` hijo) para encontrar qué elemento ocultar
   sin tener que mantener su propio índice DOM aparte. */

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
  _fogEls: null, // Map "row,col" -> elemento .tile__fog de esa loseta
  animEnabled: true,

  // Se llama UNA vez al cargar la página (igual que Shadows.init), no por
  // partida — el propio checkbox de configuración vive fuera de cualquier
  // partida concreta (ver js/settingsmenu.js) y su preferencia debe
  // aplicarse ANTES de que exista ninguna loseta de niebla todavía (a la
  // primera partida nueva ya le toca crear sus <img> de niebla con la
  // clase de <body> ya puesta, sin parpadeo).
  initAnimPref() {
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
    this.animEnabled = !!enabled;
    localStorage.setItem(FOG_ANIM_STORAGE_KEY, this.animEnabled ? "1" : "0");
    this._applyAnimToggle();
    // Pedido explícito: "¿se podrían desactivar las losetas de niebla que
    // no aparecen en pantalla hasta que la cámara se mueva?" — el culling
    // de abajo (updateCulling) solo merece la pena cuando hay animación
    // que ahorrar (medido: con la animación desactivada, recorrer las 289
    // losetas en cada frame de cámara cuesta MÁS de lo que ahorra). Al
    // apagar la animación hay que devolver a visibles las que estuvieran
    // "culled" (si no, se quedarían ocultas para siempre, porque
    // BoardView deja de llamar a updateCulling con animEnabled=false); al
    // activarla, calcular el culling YA MISMO en vez de esperar al
    // siguiente movimiento de cámara.
    this._refreshIdle();
    if (!this.animEnabled) {
      this.clearCulling();
    } else if (typeof BoardView !== "undefined" && BoardView.viewportEl) {
      this.updateCulling(BoardView.panX, BoardView.panY, BoardView.scale, BoardView.viewportEl.clientWidth, BoardView.viewportEl.clientHeight);
    }
  },

  _applyAnimToggle() {
    document.body.classList.toggle("gg-fog-anim-off", !this.animEnabled);
  },

  // Pedido explícito: "¿se podrían desactivar las losetas de niebla que no
  // aparecen en pantalla hasta que la cámara se mueva y sea visible? ¿o
  // habría popping?" — comprobado con pruebas antes de implementar (ver
  // conversación): con un margen de 1.5 losetas SÍ llegaba a fallar en el
  // peor caso posible (un arrastre que cubra de golpe todo el rango de la
  // cámara en una sola ráfaga, quedaba a solo 3.4px de mostrar un hueco).
  // x3 TILE_WIDTH deja margen de sobra incluso en ese caso límite, medido
  // con el mismo peor-caso synthetic (sobran ~270px). Con margen x1.5 la
  // mejora de fps era mayor, pero no merece la pena arriesgarse a un
  // parpadeo visible por ese margen extra de rendimiento.
  _cullCount: 0,
  clearCulling() {
    if (!this._fogEls) return;
    this._fogEls.forEach((fogEl) => fogEl.classList.remove("tile__fog--culled"));
    this._cullCount = 0;
  },
  updateCulling(panX, panY, scale, viewportW, viewportH) {
    if (!this._fogEls) return;
    const margin = TILE_WIDTH * 3 * scale;
    let visibleCount = 0;
    this._fogEls.forEach((fogEl, key) => {
      if (fogEl.style.display === "none") return; // ya revelada y oculta del todo
      if (fogEl.classList.contains("tile__fog--revealed")) return; // disipándose, no tocar
      const commaIdx = key.indexOf(",");
      const row = Number(key.slice(0, commaIdx));
      const col = Number(key.slice(commaIdx + 1));
      const c = getTileCenter(row, col, this.size);
      const screenX = panX + c.x * scale;
      const screenY = panY + c.y * scale;
      const visible = screenX > -margin && screenX < viewportW + margin && screenY > -margin && screenY < viewportH + margin;
      if (visible) visibleCount++;
      fogEl.classList.toggle("tile__fog--culled", !visible);
    });
    this._cullCount = visibleCount;
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
    this._fogEls = new Map();
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
    // .tile__fog ya no vive DENTRO de su .tile (ver comentario de FOG_SRC en
    // mapgen.js) — es un elemento hermano con su propio data-row/data-col,
    // así que se busca directamente en vez de a través de la loseta.
    container.querySelectorAll(".tile__fog").forEach((fogEl) => {
      this._fogEls.set(`${fogEl.dataset.row},${fogEl.dataset.col}`, fogEl);
    });
  },

  // false si no hay niebla activa todavía (p.ej. una herramienta de debug
  // que no llama a Fog.init) — así ningún otro archivo necesita comprobar
  // "typeof Fog" Y "Fog.revealedGrid" a la vez, con esto basta.
  isFogged(row, col) {
    if (!this.revealedGrid) return false;
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

  _reveal(row, col, instant) {
    if (this.revealedGrid[row][col]) return;
    this.revealedGrid[row][col] = true;
    this._revealedPositions.push({ row, col });
    const fogEl = this._fogEls.get(`${row},${col}`);
    if (!fogEl) return;
    if (instant) {
      fogEl.classList.add("tile__fog--revealed");
      fogEl.style.display = "none";
      if (typeof TerrainMap !== "undefined") TerrainMap.revealTile(row, col);
      return;
    }
    // BUG encontrado y corregido: mapgen.js pone a cada niebla un
    // animation-delay NEGATIVO aleatorio inline (0 a -9s) para desincronizar
    // la respiración de reposo (fog-idle-drift, 8s de ciclo) entre losetas.
    // Ese estilo inline pesa más que la propiedad "animation" del CSS de
    // .tile__fog--revealed, así que si no se limpia aquí se queda puesto al
    // cambiar de animación — y como fog-dissipate dura solo 1.1s, un delay
    // heredado de p.ej. -7s hace que arranque ya "7s dentro" de un ciclo de
    // 1.1s, es decir prácticamente en su último fotograma: la niebla
    // desaparece de golpe (el "POP!" que reportaste) en vez de disiparse. Con
    // delays pequeños casi no se notaba, de ahí que unas veces se viera bien
    // y otras no — no era una carrera ni una regla CSS duplicada, era este
    // resto de estilo inline. Se limpia justo antes de cambiar de animación.
    fogEl.style.animationDelay = "0s";
    // Terreno real (js/mapgen.js, TerrainMap) — pedido explícito: "la loseta
    // de agua sustituye a las de hierba, pero inicialmente bajo la niebla
    // todas son de hierba hasta que se revelan". Se dispara en el MISMO
    // instante en que empieza a disiparse la niebla de esta loseta (no al
    // terminar) para que el cambio de textura quede disimulado detrás de la
    // propia nube durante su 1.2s de disipado en vez de dar un salto brusco.
    if (typeof TerrainMap !== "undefined") TerrainMap.revealTile(row, col);
    // Se disipa con su propia animación (@keyframes fog-dissipate, ver
    // style.css: crece, se difumina y se desvanece, no un simple fundido de
    // opacidad) en vez de desaparecer de golpe — nivel Triple A / feedback
    // (regla de oro del proyecto): explorar debe sentirse como un
    // descubrimiento, no como un interruptor on/off.
    fogEl.classList.add("tile__fog--revealed");
    // Al terminar la animación de disipado se saca del flujo de pintado por
    // completo (display:none) — ya es invisible (opacity:0 al final del
    // keyframe) pero sin esto seguiría "animando en reposo" para siempre sin
    // coste visible; con esto no vuelve a costar nada.
    fogEl.addEventListener(
      "animationend",
      () => {
        fogEl.style.display = "none";
      },
      { once: true }
    );
  },

  // Revelado FIJO al empezar la partida — ver FOG_INITIAL_RADIUS arriba.
  revealInitial(row, col) {
    this.revealAround(row, col, FOG_INITIAL_RADIUS);
  },

  // Revelado tras moverse — SÍ según la PERCEPCION de quien se ha movido
  // (pedido explícito: "se revelarán según su percepción al terminar el
  // desplazamiento... para casillas más lejanas..."; ver js/movement.js,
  // que llama a esto justo después de terminar el desplazamiento paso a
  // paso, antes de que el gnomo reaccione).
  revealForUnit(unit) {
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
          this.isFogged(u.row, u.col) || !this.isPerceived(u.row, u.col) || inBush
        );
      });
      // Arbustos (js/bushes.js) — mismo criterio sin excepción que un
      // tótem/obelisco enemigo: "NADA debe verse si tiene niebla encima".
      if (typeof Bushes !== "undefined") {
        Bushes.list.forEach((b) => {
          if (!b.el) return;
          const fogged = this.isFogged(b.row, b.col);
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
        g.el.classList.toggle("unit--fog-hidden", this.isFogged(g.row, g.col) || !this.isPerceived(g.row, g.col));
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
        const fogged = this.isFogged(v.row, v.col);
        v.el.classList.toggle("unit--fog-hidden", fogged);
        // Pedido explícito: mientras el tótem sea del jugador, su radio fijo
        // de percepción (FOG_VILLAGE_PERCEPTION_RADIUS) lo mantiene siempre
        // percibido, así que esto solo entra en juego para un tótem neutral
        // o enemigo ya explorado que quede fuera del alcance real de las
        // unidades propias.
        v.el.classList.toggle("gg-remembered", !fogged && !this.isPerceived(v.row, v.col));
      });
    }
    // Objetos colocados en el tablero (js/backpack.js, p.ej. la
    // Setarcoiris) — mismo criterio sin excepción que un tótem: "NADA debe
    // verse si tiene niebla encima", nunca colocan uno sobre niebla propia
    // pero sí puede quedar oculto si la niebla vuelve a cerrarse encima.
    if (typeof Backpack !== "undefined") {
      Backpack.placedItems.forEach((item) => {
        if (!item.el) return;
        const fogged = this.isFogged(item.row, item.col);
        item.el.classList.toggle("unit--fog-hidden", fogged);
        item.el.classList.toggle("gg-remembered", !fogged && !this.isPerceived(item.row, item.col));
      });
    }
    // Tienda Goblin (js/shops.js) — mismo criterio sin excepción que un
    // tótem: "NADA debe verse si tiene niebla encima", aunque sea neutral.
    if (typeof Shops !== "undefined") {
      Shops.list.forEach((shop) => {
        if (!shop.el) return;
        const fogged = this.isFogged(shop.row, shop.col);
        shop.el.classList.toggle("unit--fog-hidden", fogged);
        shop.el.classList.toggle("gg-remembered", !fogged && !this.isPerceived(shop.row, shop.col));
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
        const fogged = this.isFogged(a.row, a.col);
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
        const fogged = this.isFogged(o.row, o.col);
        o.el.classList.toggle("unit--fog-hidden", fogged);
        o.el.classList.toggle("gg-remembered", !fogged && !this.isPerceived(o.row, o.col));
      });
    }
    // TotemVision (js/totemvision.js) — mismo criterio que un tótem/tienda:
    // "NADA debe verse si tiene niebla encima" para el del rival, nunca
    // para el propio (ver TotemVision.refreshFogVisibility).
    if (typeof TotemVision !== "undefined") TotemVision.refreshFogVisibility();
    // Pedido explícito: "algunas unidades asoman por la niebla a veces...
    // asegurate de que se arregla eso" — lo de arriba oculta del todo a
    // quien esté DE PIE sobre su propia loseta sin revelar, pero un
    // personaje visible (su loseta YA revelada) tiene un sprite más alto
    // que su propia loseta, así que puede asomar por encima dentro del
    // hueco de pantalla de una loseta VECINA que sigue sin revelar (mismo
    // solapamiento por FOG_OVERHANG que ya se investigó para el z-index de
    // la niebla, ver mapgen.js). Se arregla aparte (_refreshFogCoverZ) en
    // vez de aquí mismo.
    this._refreshFogCoverZ();
    this._refreshIdle();
  },

  // Animación de reposo SOLO en la frontera de la niebla: la nube interior
  // es una masa uniforme que nadie ve moverse, y cada nube animada cuesta una
  // capa GPU (causa de las losetas que desaparecen). Frontera = sin revelar
  // con una revelada a <=2 casillas; una de cada dos, tope 28.
  _refreshIdle() {
    if (!this._fogEls || !this.revealedGrid) return;
    const n = this.size;
    let count = 0;
    this._fogEls.forEach((el, key) => {
      const i = key.indexOf(",");
      const r = +key.slice(0, i), c = +key.slice(i + 1);
      let on = false;
      if (this.animEnabled && count < 28 && !this.revealedGrid[r][c] && (r + c) % 2 === 0) {
        outer: for (let dr = -2; dr <= 2; dr++) {
          const rr = r + dr;
          if (rr < 0 || rr >= n) continue;
          for (let dc = -2; dc <= 2; dc++) {
            const cc = c + dc;
            if (cc >= 0 && cc < n && this.revealedGrid[rr][cc]) { on = true; break outer; }
          }
        }
      }
      if (on) count++;
      el.classList.toggle("tile__fog--idle", on);
    });
  },

  // z-index "de reposo" de una nube de niebla — mismo cálculo que pone
  // mapgen.js al crearla (ver ese archivo, comentario del bug de z-index ya
  // arreglado antes): (fila+columna)*10+6, +1 por encima de una unidad de
  // pie en ESA MISMA loseta (+5) pero sin llegar al rango de la loseta
  // siguiente, que es lo que deja que el orden normal por fila+columna
  // decida el resto del tablero sin tocarlo.
  _fogRestZ(row, col) {
    return (row + col) * 10 + 6;
  },

  // Sube el z-index de SOLO las nubes vecinas "de arriba" que todavía
  // sigan sin revelar y estén junto a una unidad (o gnomo suelto) visible
  // — justo lo justo para taparla (su propio z-index +1), nunca más. No es
  // un z-index fijo y enorme para TODA la niebla sin revelar (esa fue
  // justo la solución equivocada de antes, ver comentario de mapgen.js: una
  // nube lejana no debe tapar por delante a un personaje que en realidad
  // está más cerca de cámara) — solo se sube la nube exacta que un sprite
  // concreto necesita tener delante, y vuelve sola a su z-index de reposo
  // en cuanto ya no haga falta (la unidad se aleja, o esa loseta se
  // revela), porque cada llamada empieza reseteando todo antes de volver a
  // subir lo que siga haciendo falta.
  // Pedido explícito (pasada posterior, con capturas): "algunas unidades se
  // siguen asomando a traves de la niebla" — investigado con un barrido
  // real (comparando el rectángulo en pantalla de cada candidato contra el
  // de cada nube de niebla vecina). Dos intentos previos, los dos
  // descartados tras medir en vivo:
  //   1) Lista fija de 4 vecinos ("justo arriba", las dos adyacentes y "2
  //      casillas arriba" en diagonal): cubría de sobra una unidad normal
  //      o el GolemCorteza, pero un Obelisco (mucho MÁS ANCHO que una sola
  //      loseta) se salía por los LADOS — hasta 5 columnas más allá de su
  //      propia loseta.
  //   2) "Cuántas filas/columnas de loseta ocupa" (alto y ancho del sprite
  //      entre alto y ancho de una loseta, redondeando hacia arriba):
  //      parecía razonable pero seguía quedándose corto con el Obelisco
  //      (el barrido en vivo lo confirmó). El motivo real: en isométrico,
  //      "una fila más arriba en pantalla" no es un simple desplazamiento
  //      vertical — es diagonal, cambia fila Y columna del tablero a la
  //      vez (ver getTileCenter en mapgen.js) — así que convertir un alto
  //      en píxeles a "N filas" con una simple división no encaja con la
  //      geometría real del rombo; hacía falta mucho más margen del que
  //      ese cálculo daba, distinto además según cada combinación de alto
  //      Y ancho, no solo el alto.
  //
  // La única manera de acertar SIEMPRE, sea cual sea el tamaño y la forma
  // del sprite (sin tener que volver a ajustar nada a mano el día que se
  // añada uno nuevo, incluso mucho más grande — regla de oro de
  // escalabilidad), es comprobar el solape en pantalla de verdad: el
  // rectángulo real del candidato contra el rectángulo real de CADA nube
  // todavía sin revelar, exactamente igual que hace un ojo humano mirando
  // la pantalla. _refreshFogCoverZ mide cada nube sin revelar UNA sola vez
  // (nunca más de una vez por nube, aunque haya varios candidatos) y
  // reutiliza esos rectángulos para todos los candidatos — sigue sin
  // ejecutarse en cada frame de cámara (solo cuando cambia la niebla, ver
  // los sitios que llaman a applyVisibility), así que el coste de más
  // rectángulos no se nota.
  _OVERLAP_MIN_AREA_PX: 30, // ruido de subpíxel/redondeo, no una superposición real

  // Pedido explícito (con capturas): "el obelisco y sus iconos y otros
  // elementos...no se asoman por la niebla, esto deberia tenerse en cuenta
  // para los objetos que estan a la vista o en niebla de guerra" — hasta
  // ahora coverFrom media SOLO el rect del propio contenedor (.unit/
  // .obelisk/...), pero varias "insignias" flotantes (la barra de vida,
  // .unit__hpbar; el indicador de población del Obelisco,
  // .obelisk__pop-badge...) son hijos con position:absolute y un top/right
  // NEGATIVO que las saca del propio cuadro del contenedor — un hijo
  // posicionado así NUNCA agranda el getBoundingClientRect() de su padre,
  // así que esa insignia podía asomar por encima de una nube vecina sin
  // que coverFrom se enterara. En vez de enumerar a mano cada insignia de
  // cada tipo de objeto (frágil: el día de mañana se añade una nueva y hay
  // que acordarse de venir aquí), se mide la UNIÓN del propio rect más el
  // de TODOS sus descendientes con tamaño real — mismo "acierta siempre,
  // sea cual sea la forma" que ya se investigó para el propio solape (ver
  // la nota larga de _refreshFogCoverZ más abajo): cualquier sprite/icono
  // nuevo que se añada a cualquier objeto queda cubierto solo, sin tocar
  // este archivo otra vez.
  // Pedido explícito (con captura): "a veces hay gnomos que se ven por
  // encima de la niebla" — el margen de arriba ya cubría la forma EN
  // REPOSO de cada sprite/insignia, pero _refreshFogCoverZ solo se llama en
  // eventos puntuales (mover, empezar turno...), nunca en cada fotograma.
  // El salto de idle de un gnomo suelto (unit__sprite--hop, reutilizado
  // igual en el paso de un personaje normal, ver @keyframes unit-hop en
  // style.css) sube el sprite hasta 18px con un transform CSS que dispara
  // solo, sin avisar a JS — así que casi nunca coincide el instante exacto
  // en que _refreshFogCoverZ mide con el pico del salto, y esa cresta se
  // queda sin contar en el rect medido, asomando un instante por encima de
  // la niebla vecina hasta el siguiente evento que sí recalcule. En vez de
  // perseguir el salto con un segundo sistema (costoso: forzaría medir en
  // cada fotograma), se añade un margen de seguridad fijo por ARRIBA a
  // cualquier rect medido aquí, algo mayor que el pico real (18px) para
  // tener colchón: nunca hace falta que sea exacto, un margen de más solo
  // sube un pelín antes de la cuenta el z-index de la nube vecina (nunca al
  // revés), así que siempre pasa por "de más" nunca por "de menos".
  _HOP_SAFETY_MARGIN_PX: 22,

  _expandedRect(el) {
    const base = el.getBoundingClientRect();
    let left = base.left,
      top = base.top,
      right = base.right,
      bottom = base.bottom;
    el.querySelectorAll("*").forEach((child) => {
      const r = child.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.left < left) left = r.left;
      if (r.top < top) top = r.top;
      if (r.right > right) right = r.right;
      if (r.bottom > bottom) bottom = r.bottom;
    });
    top -= this._HOP_SAFETY_MARGIN_PX;
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  },

  _refreshFogCoverZ() {
    if (!this.revealedGrid || !this._fogEls) return;
    // Rectángulos reales de TODAS las nubes que sigan sin revelar (a la vez
    // que se las resetea a su z-index de reposo) — una sola lectura por
    // nube, reutilizada abajo para cualquier candidato. Una nube culleada
    // (fuera de pantalla, ver Fog.updateCulling) mide 0x0 aquí y
    // simplemente nunca solapará con nada — correcto: si no se pinta, no
    // hay nada que tapar.
    const unrevealed = [];
    this._fogEls.forEach((fogEl, key) => {
      const [r, c] = key.split(",").map(Number);
      if (this.revealedGrid[r][c]) return;
      fogEl.style.zIndex = String(this._fogRestZ(r, c));
      const rect = fogEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) unrevealed.push({ row: r, col: c, el: fogEl, rect });
    });

    const coverFrom = (row, col, el) => {
      if (!el || el.classList.contains("unit--fog-hidden")) return;
      const rect = this._expandedRect(el);
      if (rect.width === 0 || rect.height === 0) return;
      const z = (row + col) * 10 + 5;
      unrevealed.forEach((tile) => {
        if (tile.row === row && tile.col === col) return; // la propia loseta no cuenta como "vecina"
        const overlapX = Math.max(0, Math.min(rect.right, tile.rect.right) - Math.max(rect.left, tile.rect.left));
        const overlapY = Math.max(0, Math.min(rect.bottom, tile.rect.bottom) - Math.max(rect.top, tile.rect.top));
        if (overlapX * overlapY < this._OVERLAP_MIN_AREA_PX) return;
        const current = parseInt(tile.el.style.zIndex, 10) || 0;
        tile.el.style.zIndex = String(Math.max(current, z + 1));
      });
    };
    if (typeof Units !== "undefined") {
      Units.list.forEach((u) => coverFrom(u.row, u.col, u.el));
    }
    if (typeof Gnome !== "undefined") {
      Gnome.list.forEach((g) => {
        if (g.heldBy) return; // vive dentro del personaje que lo lleva, hereda su cobertura
        coverFrom(g.row, g.col, g.el);
      });
    }
    // Pedido explícito: "a veces el indicador de poblacion y la barra de
    // vida del obelisco se queda por debajo de la niebla, no debe ser asi".
    // El obelisco (y el resto de objetos grandes y fijos del tablero: aldeas,
    // tiendas, arbustos y nodos de recursos) tiene exactamente el mismo
    // problema geométrico que ya se resolvía arriba solo para Units/Gnome:
    // su sprite (con la barra de vida y el indicador de población flotando
    // encima) es más alto que su propia loseta, así que puede asomar dentro
    // del hueco de pantalla de una loseta VECINA todavía sin revelar. Antes
    // de este arreglo estos objetos no pasaban nunca por coverFrom(), así
    // que esa loseta vecina se quedaba en su z-index de "descanso" y el
    // trozo asomado del obelisco/aldea/tienda/arbusto/recurso se veía POR
    // ENCIMA de su niebla en vez de tapado por ella.
    if (typeof Obelisks !== "undefined") {
      Obelisks.list.forEach((o) => {
        if (!o.el) return;
        // Pedido explícito (con captura): "el obelisco del jugador y sus
        // iconos, deben sobresalir siempre por encima de la niebla" — el
        // Obelisco PROPIO nunca está realmente bajo niebla (más arriba en
        // este mismo archivo ni siquiera se le pone la clase
        // unit--fog-hidden, team==="player" corta antes), así que su punta
        // asomando por encima de una nube VECINA todavía sin revelar no es
        // el mismo bug que la barra de vida/insignia "hundiéndose" bajo su
        // propia niebla (ese sí se arregla con coverFrom, y sigue
        // aplicándose tal cual al Obelisco rival): aquí es justo lo
        // contrario, una base altísima que sobresale por encima del
        // horizonte de niebla vecina sin explorar, algo normal y esperado
        // visualmente, no un fallo. Se salta coverFrom solo para el propio,
        // dejándolo siempre a su z-index natural (por encima de cualquier
        // nube vecina); el del rival sigue pasando por aquí como siempre.
        if (o.team === "player") return;
        coverFrom(o.row, o.col, o.el);
      });
    }
    if (typeof Villages !== "undefined") {
      Villages.list.forEach((v) => {
        if (!v.el) return;
        coverFrom(v.row, v.col, v.el);
      });
    }
    if (typeof Shops !== "undefined") {
      Shops.list.forEach((s) => {
        if (!s.el) return;
        coverFrom(s.row, s.col, s.el);
      });
    }
    // Setas explosivas (js/mushrooms.js): faltaban aquí y asomaban por la niebla vecina.
    if (typeof Mushrooms !== "undefined") {
      Mushrooms.list.forEach((m) => {
        if (!m.el || m.heldBy) return;
        coverFrom(m.row, m.col, m.el);
      });
    }
    if (typeof Bushes !== "undefined") {
      Bushes.list.forEach((b) => {
        if (!b.el) return;
        coverFrom(b.row, b.col, b.el);
      });
    }
    if (typeof Resources !== "undefined") {
      Resources.list.forEach((r) => {
        if (!r.el) return;
        coverFrom(r.row, r.col, r.el);
      });
    }
    if (typeof TotemVision !== "undefined") {
      TotemVision.list.forEach((t) => {
        if (!t.el) return;
        coverFrom(t.row, t.col, t.el);
      });
    }
    // Altar de Sacrificios (js/altar.js) — mismo "objeto grande y fijo del
    // tablero" que un tótem/tienda/Obelisco de arriba.
    if (typeof Altar !== "undefined") {
      Altar.list.forEach((a) => {
        if (!a.el) return;
        coverFrom(a.row, a.col, a.el);
      });
    }
    // GnomOgro (js/gnomogro.js) — la única de estas fuentes que SE MUEVE
    // (todas las demás son mobiliario fijo), pero geométricamente es el
    // mismo problema: un sprite colosal más alto que su propia loseta que
    // puede asomar dentro de una nube vecina todavía sin revelar.
    if (typeof GnomOgro !== "undefined" && GnomOgro.current && GnomOgro.current.el) {
      coverFrom(GnomOgro.current.row, GnomOgro.current.col, GnomOgro.current.el);
    }
  },
};

document.addEventListener("DOMContentLoaded", () => Fog.initAnimPref());

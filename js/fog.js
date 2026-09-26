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
const FOG_INITIAL_RADIUS = 2;

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

const Fog = {
  size: 0,
  revealedGrid: null, // boolean[row][col], o null si todavía no se ha inicializado esta partida
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
    this._fogEls = new Map();
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
    if (row < 0 || col < 0 || row >= this.size || col >= this.size) return false;
    return !this.revealedGrid[row][col];
  },

  // Revela todas las losetas dentro de `radius` (incluida la propia). No
  // hace nada con las que ya estaban reveladas — idempotente, se puede
  // llamar tantas veces como haga falta sin animación repetida ni coste
  // extra en las que no cambian.
  revealAround(row, col, radius) {
    if (!this.revealedGrid) return;
    for (let r = Math.max(0, row - radius); r <= Math.min(this.size - 1, row + radius); r++) {
      for (let c = Math.max(0, col - radius); c <= Math.min(this.size - 1, col + radius); c++) {
        if (Math.max(Math.abs(r - row), Math.abs(c - col)) > radius) continue;
        this._reveal(r, c);
      }
    }
    // Puede que este revelado acabe de dejar a la vista a algún rival o
    // gnomo que ya estaba ahí de pie (ver applyVisibility más abajo) — una
    // sola pasada al final del radio entero, no una por loseta individual.
    this.applyVisibility();
  },

  _reveal(row, col) {
    if (this.revealedGrid[row][col]) return;
    this.revealedGrid[row][col] = true;
    const fogEl = this._fogEls.get(`${row},${col}`);
    if (!fogEl) return;
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
    this.revealAround(unit.row, unit.col, type.percepcion);
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
    if (typeof Units !== "undefined") {
      Units.list.forEach((u) => {
        if (u.team === "player" || !u.el) return;
        u.el.classList.toggle("unit--fog-hidden", this.isFogged(u.row, u.col));
      });
    }
    if (typeof Gnome !== "undefined") {
      Gnome.list.forEach((g) => {
        if (g.heldBy || !g.el) return;
        g.el.classList.toggle("unit--fog-hidden", this.isFogged(g.row, g.col));
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
        v.el.classList.toggle("unit--fog-hidden", this.isFogged(v.row, v.col));
      });
    }
    // Objetos colocados en el tablero (js/backpack.js, p.ej. la
    // Setarcoiris) — mismo criterio sin excepción que un tótem: "NADA debe
    // verse si tiene niebla encima", nunca colocan uno sobre niebla propia
    // pero sí puede quedar oculto si la niebla vuelve a cerrarse encima.
    if (typeof Backpack !== "undefined") {
      Backpack.placedItems.forEach((item) => {
        if (!item.el) return;
        item.el.classList.toggle("unit--fog-hidden", this.isFogged(item.row, item.col));
      });
    }
    // Tienda Goblin (js/shops.js) — mismo criterio sin excepción que un
    // tótem: "NADA debe verse si tiene niebla encima", aunque sea neutral.
    if (typeof Shops !== "undefined") {
      Shops.list.forEach((shop) => {
        if (!shop.el) return;
        shop.el.classList.toggle("unit--fog-hidden", this.isFogged(shop.row, shop.col));
      });
    }
    // Obeliscos Ancestrales (js/obelisks.js) — pedido explícito: "los
    // obeliscos enemigos deben estar ocultos en la niebla hasta que se
    // descubran". A diferencia de un tótem (siempre oculto bajo niebla, sea
    // de quien sea), aquí SÍ hay excepción para "player" — mismo criterio
    // que las unidades de arriba: el jugador siempre sabe dónde está el
    // suyo propio, solo el del rival puede quedar sin descubrir todavía.
    if (typeof Obelisks !== "undefined") {
      Obelisks.list.forEach((o) => {
        if (o.team === "player" || !o.el) return;
        o.el.classList.toggle("unit--fog-hidden", this.isFogged(o.row, o.col));
      });
    }
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
  },

  // Casillas vecinas "hacia arriba en pantalla" de una unidad que pueden
  // llevarse por delante parte de su sprite si siguen sin revelar — misma
  // geometría exacta que Villages.refreshOcclusion (ver ese archivo para la
  // explicación de por qué (fila-1,col-1) es "justo arriba" en pantalla) y
  // el mismo conjunto de casillas que pidió extender la petición de los
  // tótems/obeliscos: justo arriba, arriba-derecha adyacente, arriba-
  // izquierda adyacente y 2 casillas arriba del todo (para sprites más
  // altos, como el GolemCorteza).
  _UP_NEIGHBOR_OFFSETS: [
    [-1, -1], // justo arriba
    [-1, 0], // arriba-derecha (adyacente)
    [0, -1], // arriba-izquierda (adyacente)
    [-2, -2], // 2 casillas arriba
  ],

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
  _refreshFogCoverZ() {
    if (!this.revealedGrid || !this._fogEls) return;
    this._fogEls.forEach((fogEl, key) => {
      const [r, c] = key.split(",").map(Number);
      if (!this.revealedGrid[r][c]) fogEl.style.zIndex = String(this._fogRestZ(r, c));
    });
    const coverFrom = (row, col, el) => {
      if (!el || el.classList.contains("unit--fog-hidden")) return;
      const z = (row + col) * 10 + 5;
      this._UP_NEIGHBOR_OFFSETS.forEach(([dr, dc]) => {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || c < 0 || r >= this.size || c >= this.size) return;
        if (this.revealedGrid[r][c]) return;
        const fogEl = this._fogEls.get(`${r},${c}`);
        if (!fogEl) return;
        const current = parseInt(fogEl.style.zIndex, 10) || 0;
        fogEl.style.zIndex = String(Math.max(current, z + 1));
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
  },
};

document.addEventListener("DOMContentLoaded", () => Fog.initAnimPref());

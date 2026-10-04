/* Gnomore Gnomes — recursos de escenario (rocas, mena de hierro y pinos).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Repartir fuentes de recursos por el mapa (rocas y pinos, comunes;
       mena de hierro, limitada) — mismo sistema de transparencia por solape
       que tótems/Obeliscos/arbustos para poder seleccionar a quien quede
       detrás.
     - Dejar que CUALQUIER unidad las golpee (2 puntos de vida) igual que un
       Obelisco/tótem, sin distinguir equipo (son neutrales) — al llegar a 0
       desaparecen con una animación y sueltan su recurso.
     - Transportar ese recurso hasta la mochila con su propia animación
       (aparece en la fuente -> espera 1s -> vuela hasta el icono de la
       mochila -> pulso al llegar) y llevar la cuenta de cuántos tiene el
       jugador de cada tipo (madera/roca/metal), consultada después por
       js/armory.js para pagar las mejoras.

   Pedido explícito (verbatim): "añadimos elementos de escenario de rocas,
   mena de hierro y pinos que ocupan algunas casillas. el sistema de
   transparencias es el mismo que el de los totems para personajes y
   enemigos que se colocan detras de ellos. ambos tienen 2 de vida, si se
   les pega hasta eliminarlos el usuario recibira +1 de madera o +1 de roca
   o +1 de metal (estos recursos se utilizaran mas tarde) en una nueva
   opcion del obelisco llamada armeria, desde la que el usuario podra
   actualizar su ataque y defensa base" + "Tambien he añadido 3 imagenes de
   'recurso_X' para cada uno de los recursos al recogerlos de sus
   respectivas fuentes, roca, mena de hierro, arboles. al quitar 2 puntos de
   vida de sus fuentes, estas desaparecen con una animacion y el icono del
   recurso aparece donde estaba la fuente. un segundo despues una animacion
   transporta el recurso hasta nuestra mochila, que genera una animacion de
   pulsacion en el momento recibir el recurso. EN la mochila se mostrara el
   recurso recogido. TODOS los recursos, son stackeables y se mostrara la
   cantidad de cada uno con una etiqueta igual que la que muestra los puntos
   de gloria que cuestan las unidades o los precios de la tienda goblin." +
   "Los fuentes de recursos de arbol y de roca seran bastante comunes y
   estaran repartidos por el escenario, pero el de metal sera limitado, ya
   que se usara para subir a nivel 3 en la armeria." */

const RESOURCE_NODE_MAX_HP = 2;

// Cuántas fuentes de cada tipo se reparten por partida — roca/pino comunes,
// mena limitada a propósito (pedido explícito, ver cabecera).
const RESOURCE_NODE_TYPES = {
  roca: {
    name: "Roca",
    spriteUrl: "assets/iconos/recurso_roca_nodo.png",
    resourceId: "roca",
    count: 10,
  },
  pino: {
    name: "Pino",
    spriteUrl: "assets/iconos/recurso_pino_nodo.png",
    resourceId: "madera",
    count: 10,
  },
  mena: {
    name: "Mena de Hierro",
    spriteUrl: "assets/iconos/recurso_mena_nodo.png",
    resourceId: "metal",
    count: 4,
  },
};

// Cofre de Reliquias (js/relics.js): se interactúa como un recurso, pero un
// solo toque lo abre y suelta una reliquia. Hay 1 por jugador, en lugares
// apartados. No va en RESOURCE_NODE_TYPES (que se reparte por cantidad fija).
const CHEST_SPRITE_CLOSED = "assets/iconos/cofre_cerrado.png";
const CHEST_SPRITE_OPEN = "assets/iconos/cofre_abierto.png";
const CHEST_MIN_OBELISK_DIST = 6; // lejos de las bases
const CHEST_MIN_CHEST_DIST = 7; // y lejos entre sí

// Recursos ya recolectados (icono de la mochila + trofeo de la fuente) —
// distinto catálogo de RESOURCE_NODE_TYPES porque uno es "lo que hay plantado
// en el mapa" y el otro "lo que se lleva en la mochila", con su propio icono.
const RESOURCE_TYPES = {
  madera: { name: "Madera", iconUrl: "assets/iconos/recurso_madera.png" },
  roca: { name: "Roca", iconUrl: "assets/iconos/recurso_roca.png" },
  metal: { name: "Metal", iconUrl: "assets/iconos/recurso_metal.png" },
  // Rock'n Troll: astillas de las rocas de los Tambores de Guerra. Sin uso
  // por ahora (se apilan en la mochila).
  fragmento: { name: "Fragmento de roca", iconUrl: "assets/niveles/rockntroll/fragmento.png" },
};

// Pedido explícito: "los recursos ocupan espacio en la mochila...son como un
// objeto mas que se consume como moneda en la armeria, pero deben ocupar
// espacio" — descripción mostrada en el hueco de la mochila cuando un
// recurso está resaltado, mismo patrón que ITEM_DESCRIPTIONS (backpack.js).
const RESOURCE_DESCRIPTIONS = {
  madera: "Madera recogida de los pinos. No se usa por sí sola: se gasta como moneda para mejorar arma y armadura en la Armería.",
  roca: "Roca recogida de las canteras. No se usa por sí sola: se gasta como moneda para mejorar arma y armadura en la Armería.",
  fragmento: "Un trocito de roca caída del cielo. Aún no sirve para nada, pero queda monísimo en la mochila.",
  metal: "Mena de hierro, mucho más escasa que la madera o la roca. Solo hace falta para el nivel 3 de mejoras en la Armería.",
};

const RESOURCE_MIN_SEPARATION = 2; // entre dos fuentes, para que no se amontonen

// Pedido explícito: "en un radio de 2 casillas alrededor de los obeliscos
// no puede haber recursos" / "en un radio de 1 casillas alrededor de los
// totems no puede haber recursos, pero si arbustos" — distancia Chebyshev
// (misma métrica que RESOURCE_MIN_SEPARATION, <= en vez de < porque aquí
// "radio de N casillas" incluye la casilla justo a N de distancia).
const RESOURCE_OBELISK_EXCLUSION_RADIUS = 2;
const RESOURCE_VILLAGE_EXCLUSION_RADIUS = 1;

const Resources = {
  list: [],
  _nextId: 1,
  // Fuentes destruidas por un rival mientras la loseta estaba fuera de la
  // percepción real del jugador — ver _destroy()/resolveGhosts(). Cada
  // entrada: { row, col, el }.
  _ghosts: [],

  // Recursos recolectados por el jugador esta partida — leído por
  // js/armory.js para saber qué se puede pagar, y por Backpack para pintar
  // las etiquetas.
  counts: { madera: 0, roca: 0, metal: 0 },
  // Pedido explícito: "los enemigos tambien pueden recoger recursos e
  // invertirlos en la armeria" — mismo pozo, pero SEPARADO del del
  // jugador (nunca comparten inventario/Armería, ver Armory.state.enemy),
  // leído por Turns._aiRunEconomyPhase (js/turns.js) para las mejoras
  // automáticas del rival.
  enemyCounts: { madera: 0, roca: 0, metal: 0 },
  aiCounts: {},
  countsFor(team) {
    if (team === "player") return this.counts;
    return (this.aiCounts[team] = this.aiCounts[team] || { madera: 0, roca: 0, metal: 0 });
  },

  init() {
    this._initMouseTracking();
  },

  resetAll() {
    this.list.forEach((n) => n.el.remove());
    this.list = [];
    // Pedido explícito (memoria de niebla): una nueva partida no debe
    // arrastrar fantasmas pendientes de la anterior.
    this._ghosts.forEach((g) => g.el.remove());
    this._ghosts = [];
    this.counts = { madera: 0, roca: 0, metal: 0 };
    this.aiCounts = {};
    this.enemyCounts = this.countsFor("enemy");
    if (typeof Backpack !== "undefined") Backpack.refreshResourceBadges && Backpack.refreshResourceBadges();
  },

  // Repartidas por todo el mapa (a diferencia de los arbustos, que buscan
  // estar CERCA de un punto de interés, aquí no hace falta: "estaran
  // repartidos por el escenario" a secas) — losetas al azar, con tolerancia
  // de separación entre ellas para que no se amontonen todas juntas.
  spawn(boardSize) {
    Object.keys(RESOURCE_NODE_TYPES).forEach((kind) => {
      const def = RESOURCE_NODE_TYPES[kind];
      let placed = 0;
      let attempts = 0;
      while (placed < def.count && attempts < 3000) {
        attempts++;
        const row = Math.floor(Math.random() * boardSize);
        const col = Math.floor(Math.random() * boardSize);
        if (!this._tileFree(row, col, boardSize)) continue;
        this._create(kind, row, col);
        placed++;
      }
    });
    this._spawnChests(boardSize);
    // Estado inicial de las barras de vida (ver refreshHpVisibility) —
    // normalmente basta con que Fog.applyVisibility la recalcule tras el
    // primer movimiento, pero esto cubre el instante justo después de
    // repartir el mapa, antes de que nadie se haya movido todavía.
    this.refreshHpVisibility();
  },

  // Cofres de Reliquias: 1 por jugador, en sitios apartados e impredecibles
  // (lejos de las bases y entre sí; si no cabe, se van relajando las distancias).
  _spawnChests(boardSize) {
    const count = (typeof Teams !== "undefined" ? Teams.all.length : 2) + 1; // jugadores + 1
    // Distancia ANDANDO desde el Obelisco más cercano (BFS por casillas
    // caminables): un cofre "escondido" es el que cuesta llegar, no el que
    // simplemente queda lejos en línea recta (p.ej. al otro lado de un río).
    const dist = Array.from({ length: boardSize }, () => new Array(boardSize).fill(-1));
    const queue = [];
    if (typeof Obelisks !== "undefined") {
      Obelisks.list.forEach((o) => { dist[o.row][o.col] = 0; queue.push([o.row, o.col]); });
    }
    for (let h = 0; h < queue.length; h++) {
      const [r, c] = queue[h];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if ((!dr && !dc) || nr < 0 || nc < 0 || nr >= boardSize || nc >= boardSize) continue;
        if (dist[nr][nc] !== -1) continue;
        if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(nr, nc)) continue;
        dist[nr][nc] = dist[r][c] + 1;
        queue.push([nr, nc]);
      }
    }
    const openNeighbours = (row, col) => {
      let n = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const r = row + dr, c = col + dc;
        if (r >= 0 && c >= 0 && r < boardSize && c < boardSize &&
            (typeof TerrainMap === "undefined" || TerrainMap.isWalkable(r, c))) n++;
      }
      return n; // 8 = campo abierto; pocos = rincón, orilla o borde del mapa
    };
    const minPath = Math.max(CHEST_MIN_OBELISK_DIST, Math.round(boardSize * 0.45));
    for (let i = 0; i < count; i++) {
      let best = null;
      for (let relax = 0; relax <= 4 && !best; relax++) {
        const needPath = Math.max(4, minPath - relax * 2);
        const minCh = Math.max(3, CHEST_MIN_CHEST_DIST - relax * 2);
        for (let attempts = 0; attempts < 500; attempts++) {
          const row = Math.floor(Math.random() * boardSize);
          const col = Math.floor(Math.random() * boardSize);
          if (!this._tileFree(row, col, boardSize)) continue;
          const d = dist[row][col];
          if (d < needPath) continue; // -1 (inalcanzable) también se descarta
          const cd = (o) => Math.max(Math.abs(o.row - row), Math.abs(o.col - col));
          if (this.list.some((n) => n.kind === "cofre" && cd(n) < minCh)) continue;
          // Más puntos = más escondido: lejos de las bases, en rincones/orillas.
          const score = d + (8 - openNeighbours(row, col)) * 1.5 + Math.random() * 3;
          if (!best || score > best.score) best = { row, col, score };
        }
      }
      if (best) this._create("cofre", best.row, best.col);
    }
  },

  _tileFree(row, col, boardSize) {
    if (row < 0 || col < 0 || row >= boardSize || col >= boardSize) return false;
    if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) return false;
    if (typeof Units !== "undefined" && Units.unitAt(row, col)) return false;
    if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) return false;
    if (typeof Villages !== "undefined" && Villages.at(row, col)) return false;
    if (typeof Shops !== "undefined" && Shops.at(row, col)) return false;
    if (typeof Obelisks !== "undefined" && Obelisks.at(row, col)) return false;
    if (typeof Altar !== "undefined" && Altar.at(row, col)) return false; // Altar de Sacrificios (js/altar.js)
    if (typeof Drums !== "undefined" && Drums.at(row, col)) return false;
    if (typeof GnomOgro !== "undefined" && GnomOgro.at(row, col)) return false; // GnomOgro (js/gnomogro.js): casilla ocupada
    if (typeof Bushes !== "undefined" && Bushes.at(row, col)) return false;
    if (this.at(row, col)) return false;
    // Pedido explícito: "en un radio de 2 casillas alrededor de los
    // obeliscos no puede haber recursos" — despeja el entorno inmediato de
    // la base de cada equipo (y de la Armería, que vive en el Obelisco)
    // para que no aparezca un pino/roca pegado a la entrada.
    if (typeof Obelisks !== "undefined") {
      const tooCloseToObelisk = Obelisks.list.some(
        (o) => Math.max(Math.abs(o.row - row), Math.abs(o.col - col)) <= RESOURCE_OBELISK_EXCLUSION_RADIUS
      );
      if (tooCloseToObelisk) return false;
    }
    // Pedido explícito: "en un radio de 1 casillas alrededor de los totems
    // no puede haber recursos, pero si arbustos" — solo afecta a este
    // archivo (Bushes.js sigue colocándose igual, sin ningún cambio, así
    // que los arbustos siguen apareciendo junto a un tótem con total
    // normalidad).
    if (typeof Villages !== "undefined") {
      const tooCloseToTotem = Villages.list.some(
        (v) => Math.max(Math.abs(v.row - row), Math.abs(v.col - col)) <= RESOURCE_VILLAGE_EXCLUSION_RADIUS
      );
      if (tooCloseToTotem) return false;
    }
    const tooClose = this.list.some(
      (n) => Math.max(Math.abs(n.row - row), Math.abs(n.col - col)) < RESOURCE_MIN_SEPARATION
    );
    if (tooClose) return false;
    return true;
  },

  at(row, col) {
    return this.list.find((n) => n.row === row && n.col === col) || null;
  },

  _create(kind, row, col) {
    const def = kind === "cofre" ? { spriteUrl: CHEST_SPRITE_CLOSED } : RESOURCE_NODE_TYPES[kind];
    const el = document.createElement("div");
    el.className = `unit resource-node resource-node--${kind}`;

    const spriteEl = document.createElement("img");
    spriteEl.decoding = "async";
    spriteEl.className = "resource-node__sprite";
    // Calidad de sprite dinámica según el zoom (pedido explícito, ver
    // js/spritequality.js).
    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(spriteEl, def.spriteUrl);
    else spriteEl.src = def.spriteUrl;
    spriteEl.alt = "";
    spriteEl.draggable = false;
    if (kind !== "cofre" && Math.random() < 0.5) spriteEl.style.scale = "-1 1"; // volteo aleatorio
    // Pedido explícito: "todo en el escenario se mueve al compas...pon
    // delays en las animaciones de los elementos del escenario para que no
    // todos los arboles se muevan igual" — .resource-node__sprite comparte
    // el mismo @keyframes unit-idle-breathe (misma duración, 4s) para
    // TODAS las instancias (todos los pinos/rocas/menas), así que sin esto
    // laten perfectamente sincronizados. Delay negativo aleatorio: adelanta
    // el reloj de la animación de cada instancia a un punto distinto del
    // ciclo desde el primer fotograma (con uno positivo se verían todos
    // quietos un rato antes de arrancar, que no es lo que queremos).
    spriteEl.style.animationDelay = `-${(Math.random() * 4).toFixed(2)}s`;
    el.appendChild(spriteEl);
    if (typeof Shadows !== "undefined") Shadows.attach(spriteEl);

    // Barra de vida SIEMPRE visible (2 segmentos), mismo patrón que
    // Villages (.village .unit__hpbar en style.css) — una fuente nunca se
    // "selecciona", así que no tiene sentido ocultarla hasta apuntar.
    const hpBarEl = document.createElement("div");
    hpBarEl.className = "unit__hpbar resource-node__hpbar";
    const hpSegmentEls = [];
    for (let i = 0; i < RESOURCE_NODE_MAX_HP; i++) {
      const seg = document.createElement("div");
      seg.className = "unit__hpbar-segment";
      hpBarEl.appendChild(seg);
      hpSegmentEls.push(seg);
    }
    el.appendChild(hpBarEl);

    if (typeof Units !== "undefined") Units.container.appendChild(el);

    const node = {
      id: `resource-${this._nextId++}`,
      kind,
      row,
      col,
      hp: kind === "cofre" ? 1 : RESOURCE_NODE_MAX_HP,
      maxHp: kind === "cofre" ? 1 : RESOURCE_NODE_MAX_HP,
      el,
      spriteEl,
      hpBarEl,
      hpSegmentEls,
    };
    this._placeInstant(node);
    if (typeof Units !== "undefined") Units.updateHpBar(node);
    this.list.push(node);
    return node;
  },

  _placeInstant(node) {
    if (typeof getTileCenter === "undefined" || typeof Units === "undefined") return;
    const { x, y } = getTileCenter(node.row, node.col, Units.boardSize);
    node.el.style.left = `${x}px`;
    node.el.style.top = `${y}px`;
    node.el.style.zIndex = String((node.row + node.col) * 10 + 5);
  },

  // ---------- Niebla ----------
  // Igual que Bushes: una fuente no descubierta se oculta bajo la niebla
  // (llamado desde Fog.applyVisibility).
  refreshFog() {
    if (typeof Fog === "undefined") return;
    this.list.forEach((n) => {
      const fogged = Fog.isFoggedReal(n.row, n.col);
      n.el.classList.toggle("unit--fog-hidden", fogged);
      // Pedido explícito (memoria de niebla): ya explorada pero fuera de la
      // percepción real de las unidades/tótems/Obeliscos propios ahora
      // mismo -> se queda a la vista "recordada" (atenuada + sin animar).
      n.el.classList.toggle("gg-remembered", !fogged && !Fog.isPerceived(n.row, n.col));
    });
    this.resolveGhosts();
  },

  // Pedido explícito (memoria de niebla): "si luego vuelvo y resulta que un
  // enemigo talo ese arbol, al estar dentro de la percepcion de mis
  // unidades... debera actualizarse a su estado actual" — un "fantasma" es
  // una fuente que un RIVAL destruyó mientras la loseta quedaba fuera de la
  // percepción real del jugador (ver _destroy): su sprite se queda tal cual
  // (la última versión vista, ya atenuada por refreshFog de arriba) hasta
  // que el jugador vuelve a percibir esa casilla, momento en el que recién
  // aquí se completa de verdad su desaparición. Se llama desde el mismo
  // punto único de paso que refreshFog.
  resolveGhosts() {
    if (!this._ghosts.length || typeof Fog === "undefined") return;
    this._ghosts = this._ghosts.filter((ghost) => {
      if (!Fog.isPerceived(ghost.row, ghost.col)) return true; // sigue pendiente
      ghost.el.classList.add("resource-node--destroyed");
      if (typeof SFX !== "undefined") SFX.death();
      setTimeout(() => ghost.el.remove(), 320);
      return false;
    });
  },

  // Pedido explícito: "las barras de vida de los recursos solo deben
  // mostrarse cuando un personaje esta en una casilla adyacente a ellos" —
  // se llama desde el mismo punto único que refreshFog (Fog.applyVisibility,
  // que ya se dispara tras CUALQUIER movimiento/aparición/muerte del
  // proyecto, ver el comentario de walkPath en js/units.js), así que no
  // hace falta añadir ganchos nuevos en cada mecánica de movimiento por
  // separado. "Personaje" = Units.list (no cuenta Gnome, que no es un
  // personaje jugable), de cualquier equipo (una fuente es neutral, la
  // pueden golpear ambos bandos).
  refreshHpVisibility() {
    if (typeof Units === "undefined") return;
    this.list.forEach((node) => {
      const adjacent = Units.list.some(
        (u) => Math.max(Math.abs(u.row - node.row), Math.abs(u.col - node.col)) <= 1
      );
      node.el.classList.toggle("resource-node--hp-visible", adjacent);
    });
  },

  // ---------- Transparencia por solape (igual que Villages/Obelisks/Bushes) ----------
  _OCCLUSION_OFFSETS: [
    [-1, -1],
    [-1, 0],
    [0, -1],
    [-2, -2],
  ],
  _behindElsFor(node) {
    const els = [];
    if (typeof Units === "undefined") return els;
    Units.list.forEach((unit) => {
      if (!unit.el || unit.el.classList.contains("unit--fog-hidden")) return;
      if (this._OCCLUSION_OFFSETS.some(([dr, dc]) => unit.row === node.row + dr && unit.col === node.col + dc)) {
        els.push(unit.el);
      }
    });
    Units.markerEls.forEach((m) => {
      if (!m || !m.isConnected) return;
      const r = Number(m.dataset.row);
      const c = Number(m.dataset.col);
      if (Number.isNaN(r) || Number.isNaN(c)) return;
      if (this._OCCLUSION_OFFSETS.some(([dr, dc]) => r === node.row + dr && c === node.col + dc)) {
        els.push(m);
      }
    });
    return els;
  },

  refreshOcclusion(mouseX, mouseY) {
    if (typeof Units === "undefined") return;
    const mx = typeof mouseX === "number" ? mouseX : this._lastMouseX;
    const my = typeof mouseY === "number" ? mouseY : this._lastMouseY;
    this.list.forEach((node) => {
      if (!node.spriteEl) return;
      if (node.el.classList.contains("unit--fog-hidden") || mx === null || my === null) {
        node.el.classList.remove("resource-node--occluding");
        return;
      }
      const behindEls = this._behindElsFor(node);
      let occluding = false;
      if (behindEls.length) {
        const nRect = node.spriteEl.getBoundingClientRect();
        const mouseOverNode = mx >= nRect.left && mx <= nRect.right && my >= nRect.top && my <= nRect.bottom;
        const mouseOverBehind = behindEls.some((el) => {
          const r = el.getBoundingClientRect();
          return mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom;
        });
        occluding = mouseOverNode || mouseOverBehind;
      }
      node.el.classList.toggle("resource-node--occluding", occluding);
    });
  },

  _lastMouseX: null,
  _lastMouseY: null,
  _mouseTrackingReady: false,
  _initMouseTracking() {
    if (this._mouseTrackingReady) return;
    this._mouseTrackingReady = true;
    window.addEventListener("mousemove", (e) => {
      this._lastMouseX = e.clientX;
      this._lastMouseY = e.clientY;
      this.refreshOcclusion(e.clientX, e.clientY);
    });
    const handleTouch = (e) => {
      const t = e.touches && e.touches[0];
      if (!t) return;
      this._lastMouseX = t.clientX;
      this._lastMouseY = t.clientY;
      this.refreshOcclusion(t.clientX, t.clientY);
    };
    window.addEventListener("touchstart", handleTouch, { passive: true });
    window.addEventListener("touchmove", handleTouch, { passive: true });
  },

  // ---------- Proveedor de rango (mira de ataque) ----------
  // Igual que Obelisks.showFor, pero sin distinguir equipo (son neutrales:
  // cualquier unidad, propia o rival, puede golpearlas) y con daño simple
  // (fuerza del atacante + bonus de Armería si ya se compró) en vez del
  // "golpe con el gnomo" de un tótem.
  showFor(unit) {
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    this.list.forEach((node, i) => {
      if (node.opened) return; // cofre ya abierto
      if (typeof Fog !== "undefined" && Fog.isFogged(node.row, node.col)) return;
      const approach = this.findApproachTile(unit, node);
      if (!approach) return;
      const needsMove = approach.row !== unit.row || approach.col !== unit.col;
      if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return; // mover + golpear el recurso = 1 sola acción
      Units.addMarker({
        className: "attack-marker resource-node-attack-marker",
        row: node.row,
        col: node.col,
        zOffset: 2,
        delayIndex: i,
        visibleClass: "attack-marker--visible",
        owner: "resources",
        alwaysOnTop: true,
        onClick: () => this.approachAndAttack(unit, node),
        buildContent: (marker) => {
          const icon = document.createElement("i");
          icon.className = "ph ph-crosshair-simple attack-marker__icon";
          marker.appendChild(icon);
        },
      });
    });
  },

  onClear() {},

  findApproachTile(unit, node) {
    const type = UNIT_TYPES[unit.typeId];
    const moveRange = Units.moveRangeOf(unit);
    const attackRange = type.attackRange;

    const distToNode = (row, col) => Math.max(Math.abs(row - node.row), Math.abs(col - node.col));

    if (distToNode(unit.row, unit.col) <= attackRange) {
      return { row: unit.row, col: unit.col };
    }

    let best = null;
    let bestDist = Infinity;
    for (let row = 0; row < Units.boardSize; row++) {
      for (let col = 0; col < Units.boardSize; col++) {
        if (row === unit.row && col === unit.col) continue;
        if (distToNode(row, col) > attackRange) continue;
        if (Units.unitAt(row, col)) continue;
        if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) continue;
        if (typeof Villages !== "undefined" && Villages.at(row, col)) continue;
        if (typeof Shops !== "undefined" && Shops.at(row, col)) continue;
        if (typeof Obelisks !== "undefined" && Obelisks.at(row, col)) continue;
        if (typeof Altar !== "undefined" && Altar.at(row, col)) continue; // Altar de Sacrificios (js/altar.js)
        if (typeof GnomOgro !== "undefined" && GnomOgro.at(row, col)) continue; // GnomOgro (js/gnomogro.js): casilla ocupada
        if (this.at(row, col)) continue;
        if (typeof TerrainMap !== "undefined" && !(typeof Skills !== "undefined" ? Skills.walkableFor(unit.team, row, col) : TerrainMap.isWalkable(row, col))) continue;
        const moveDist = Math.max(Math.abs(row - unit.row), Math.abs(col - unit.col));
        if (moveDist > moveRange || (typeof Skills !== "undefined" && Skills.moveCost(unit, row, col) > moveRange)) continue;
        if (!Units.pathIsWalkable(unit.row, unit.col, row, col, unit.team)) continue;
        if (moveDist < bestDist) {
          bestDist = moveDist;
          best = { row, col };
        }
      }
    }
    return best;
  },

  async approachAndAttack(unit, node) {
    Units.clearRangeOverlays();
    const approach = this.findApproachTile(unit, node);
    if (!approach || !this.list.includes(node)) return;
    if (approach.row !== unit.row || approach.col !== unit.col) {
      if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
      const path = Units.stepPath(unit.row, unit.col, approach.row, approach.col);
      await Units.walkPath(unit, path); // acercarse no gasta acción: la gasta el golpe
      if (typeof Fog !== "undefined" && unit.team === "player") Fog.revealForUnit(unit);
    }
    const type = UNIT_TYPES[unit.typeId];
    const distNow = Math.max(Math.abs(unit.row - node.row), Math.abs(unit.col - node.col));
    if (distNow > type.attackRange) return;
    await this.attack(unit, node);
  },

  async attack(unit, node) {
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    if (!this.list.includes(node) || node.opened) return;
    if (node.kind === "cofre") {
      // La reliquia del jugador necesita sitio en la mochila.
      if (unit.team === "player" && typeof Backpack !== "undefined" && !Backpack.hasFreeSlot()) {
        if (typeof SFX !== "undefined") SFX.dropFail();
        Units.spawnFloatingText(unit, "¡MOCHILA LLENA!", { className: "dmg-popup" });
        return;
      }
      Units.faceTowardsTile(unit, node.row, node.col);
      if (typeof Turns !== "undefined") Turns.useAction(unit);
      await this._openChest(node, unit);
      Units.refreshRange(unit);
      return;
    }
    Units.faceTowardsTile(unit, node.row, node.col);
    if (typeof Turns !== "undefined") Turns.useAction(unit);

    const bonus = typeof Armory !== "undefined" ? Armory.attackBonus(unit.team) : 0;
    const damage = UNIT_TYPES[unit.typeId].fuerza + bonus;
    node.hp = Math.max(0, node.hp - damage);
    if (typeof Units !== "undefined") Units.updateHpBar(node);
    Units.spawnFloatingText(node, `-${damage}`, { className: "dmg-popup" });
    Units.playShake(node);
    SFX.hit();

    if (unit.el) {
      unit.el.classList.remove("unit--punching");
      void unit.spriteEl.offsetWidth;
      unit.el.classList.add("unit--punching");
      setTimeout(() => unit.el.classList.remove("unit--punching"), 320);
    }

    if (node.hp <= 0) {
      await this._destroy(node, unit);
      Units.refreshRange(unit); // sigue seleccionada con sus marcadores si le quedan acciones
    } else {
      Units.refreshRange(unit);
    }
  },

  // ---------- Cofre de Reliquias ----------
  // El cofre cambia (con animación y sonido) a su sprite abierto, la reliquia
  // aparece sobre él y, si la abre el jugador, viaja hasta la mochila.
  async _openChest(node, unit) {
    node.opened = true;
    // En el tutorial siempre toca la misma reliquia (Botas TrotaMontes), para poder explicarla.
    const relicId = typeof Tutorial !== "undefined" && Tutorial.active && Tutorial._ctx && Tutorial._ctx.chest === node ? "trotamontes" : Relics.randomId();
    const relicDef = RELIC_TYPES[relicId];
    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(node.spriteEl, CHEST_SPRITE_OPEN);
    else node.spriteEl.src = CHEST_SPRITE_OPEN;
    node.el.classList.remove("resource-node--chest-open");
    void node.el.offsetWidth;
    node.el.classList.add("resource-node--chest-open");
    if (typeof SFX !== "undefined") {
      SFX.glory();
      setTimeout(() => SFX.captureVillage && SFX.captureVillage(), 160);
    }
    const team = unit.team;
    if (team === "player") {
      setTimeout(() => {
        this._spawnPickupAt(node.row, node.col, null, {
          iconUrl: relicDef.iconUrl,
          big: true,
          onArrive: () => {
            Relics.grant("player", relicId);
            this._fadeChest(node);
            if (typeof SFX !== "undefined") SFX.itemEaten();
            if (typeof Backpack !== "undefined" && Backpack._btnEl) {
              const btn = Backpack._btnEl;
              btn.classList.remove("backpack-btn--pulse");
              void btn.offsetWidth;
              btn.classList.add("backpack-btn--pulse");
              setTimeout(() => btn.classList.remove("backpack-btn--pulse"), 380);
            }
          },
        });
      }, 450);
    } else {
      Relics.grant(team, relicId); // el rival la recoge en silencio
      setTimeout(() => this._fadeChest(node), 1200);
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  },

  // El cofre se desvanece una vez la reliquia ha llegado a su dueño.
  _fadeChest(node) {
    this.list = this.list.filter((n) => n.id !== node.id);
    node.el.classList.add("resource-node--destroyed");
    setTimeout(() => node.el.remove(), 340);
  },

  // ---------- Destrucción + recolección ----------
  // "estas desaparecen con una animacion y el icono del recurso aparece
  // donde estaba la fuente. un segundo despues una animacion transporta el
  // recurso hasta nuestra mochila" (pedido explícito, ver cabecera).
  async _destroy(node, destroyer) {
    this.list = this.list.filter((n) => n.id !== node.id);
    const def = RESOURCE_NODE_TYPES[node.kind];

    // Solo el jugador tiene mochila en esta versión, así que solo él
    // recibe la animación de recolección (vuelo hasta la mochila). Pedido
    // explícito: "los enemigos tambien pueden recoger recursos e
    // invertirlos en la armeria" — el rival SÍ recolecta ahora, pero de
    // forma silenciosa (sin mochila a la que volar, ver
    // enemyCounts/_collectSilently más abajo).
    const isPlayerCollecting = destroyer && destroyer.team === "player";
    const isEnemyCollecting = destroyer && destroyer.team !== "player";

    // Pedido explícito (memoria de niebla): "si yo en algun momento vi un
    // arbol en una casilla y me alejo de el... pero si luego vuelvo y
    // resulta que un enemigo talo ese arbol... debera actualizarse a su
    // estado actual" — si es el RIVAL quien destruye la fuente (nunca el
    // jugador: eso solo puede pasar con la loseta bajo su propia
    // percepción, atacando en persona) y la loseta queda fuera de la
    // percepción real del jugador ahora mismo, no la hacemos desaparecer
    // todavía: se queda como "fantasma" (última versión vista, atenuada
    // igual que cualquier otro elemento recordado) hasta que el jugador
    // vuelva a percibir esa casilla — ver resolveGhosts(). El rival sigue
    // recolectando su recurso de verdad aunque el jugador no lo vea
    // desaparecer todavía (su economía no depende de la niebla DEL
    // JUGADOR).
    if (isEnemyCollecting) { const _c = this.countsFor(destroyer.team); _c[def.resourceId] = (_c[def.resourceId] || 0) + 1 + (typeof Skills !== "undefined" ? Skills.rank(destroyer.team, "recolector") : 0); }
    if (!isPlayerCollecting && typeof Fog !== "undefined" && Fog.perceivedGrid && !Fog.isPerceived(node.row, node.col)) {
      this._ghosts.push({ row: node.row, col: node.col, el: node.el });
      return;
    }

    node.el.classList.add("resource-node--destroyed");
    if (typeof SFX !== "undefined") SFX.death();

    if (isPlayerCollecting) this._spawnPickupAt(node.row, node.col, def.resourceId);

    await new Promise((resolve) => setTimeout(resolve, 320));
    node.el.remove();
  },

  // Icono del recurso sobre la propia loseta (misma capa/transform que
  // cualquier otro elemento del tablero, Units.container) — se queda ahí un
  // segundo, tal y como se pidió, antes de echar a volar hacia la mochila.
  _spawnPickupAt(row, col, resourceId, custom = null) {
    if (typeof getTileCenter === "undefined" || typeof Units === "undefined") return;
    const def = custom ? { iconUrl: custom.iconUrl } : RESOURCE_TYPES[resourceId];
    const { x, y } = getTileCenter(row, col, Units.boardSize);

    const el = document.createElement("div");
    el.className = "resource-pickup" + (custom && custom.big ? " resource-pickup--big" : "");
    const img = document.createElement("img");
    img.decoding = "async";
    img.className = "resource-pickup__sprite";
    img.src = def.iconUrl;
    img.draggable = false;
    img.alt = "";
    el.appendChild(img);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.zIndex = String((row + col) * 10 + 7);
    Units.container.appendChild(el);

    setTimeout(() => this._flyPickupToBackpack(el, resourceId, custom), custom ? 900 : 1000);
  },

  // Convierte el icono (hasta ahora en el espacio del tablero, sujeto al
  // pan/zoom de la cámara) en un elemento "position:fixed" en coordenadas
  // reales de pantalla, y lo anima en línea recta hasta el icono de la
  // mochila — mismo espíritu que Backpack._animateKatapumThrow, pero de
  // tablero A INTERFAZ FIJA en vez de tablero a tablero, así que hace falta
  // el cambio de espacio de coordenadas primero (via getBoundingClientRect,
  // que ya da la posición real en pantalla tenga la cámara el pan/zoom que
  // tenga).
  _flyPickupToBackpack(boardEl, resourceId, custom = null) {
    const arrive = () => (custom ? custom.onArrive() : this._collect(resourceId));
    if (typeof Backpack === "undefined" || !Backpack._btnEl) {
      boardEl.remove();
      arrive();
      return;
    }
    const startRect = boardEl.getBoundingClientRect();
    boardEl.remove();

    const endRect = Backpack._btnEl.getBoundingClientRect();
    const startX = startRect.left + startRect.width / 2;
    const startY = startRect.top + startRect.height / 2;
    const endX = endRect.left + endRect.width / 2;
    const endY = endRect.top + endRect.height / 2;

    const def = custom ? { iconUrl: custom.iconUrl } : RESOURCE_TYPES[resourceId];
    const flyEl = document.createElement("div");
    flyEl.className = "resource-pickup resource-pickup--flying" + (custom && custom.big ? " resource-pickup--big" : "");
    const img = document.createElement("img");
    img.className = "resource-pickup__sprite";
    img.src = def.iconUrl;
    img.draggable = false;
    img.alt = "";
    flyEl.appendChild(img);
    document.body.appendChild(flyEl);

    const duration = 550;
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      // Suavizado tipo "ease-in" — arranca despacio y acelera hacia la
      // mochila, se lee más como "aspirado" que un movimiento lineal frío.
      const eased = t * t;
      flyEl.style.left = `${startX + (endX - startX) * eased}px`;
      flyEl.style.top = `${startY + (endY - startY) * eased}px`;
      flyEl.style.transform = `translate(-50%, -50%) scale(${1 - 0.5 * eased})`;
      flyEl.style.opacity = String(1 - 0.6 * eased);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        flyEl.remove();
        arrive();
      }
    };
    requestAnimationFrame(step);
  },

  _collect(resourceId) {
    // Pedido explícito: "los recursos ocupan espacio en la mochila...son
    // como un objeto mas que se consume como moneda en la armeria, pero
    // deben ocupar espacio, por eso tenemos 8 huecos" — un recurso del que
    // aún no se tiene NINGUNA unidad reclama un hueco propio (stackeable a
    // partir de ahí, igual que cualquier objeto comprado en la Tienda
    // Goblin, ver Backpack.hasFreeSlot/Shops._buySelected); si ya se tiene
    // alguno, sumar más no gasta hueco nuevo, ya tiene el suyo reclamado.
    const isNewType = !this.counts[resourceId];
    if (isNewType && typeof Backpack !== "undefined" && !Backpack.hasFreeSlot()) {
      if (typeof SFX !== "undefined") SFX.dropFail();
      return; // mochila llena: el recurso se pierde, igual que rechazar una compra sin sitio
    }
    this.counts[resourceId] = (this.counts[resourceId] || 0) + 1 + (typeof Skills !== "undefined" ? Skills.rank("player", "recolector") : 0);
    if (typeof SFX !== "undefined") SFX.itemEaten();
    // "que genera una animacion de pulsacion en el momento recibir el
    // recurso" (pedido explícito) — mismo mecanismo de "quitar clase, forzar
    // reflow, volver a ponerla" que el resto del proyecto (ver
    // main-logo--punched en menu.js).
    if (typeof Backpack !== "undefined" && Backpack._btnEl) {
      const btn = Backpack._btnEl;
      btn.classList.remove("backpack-btn--pulse");
      void btn.offsetWidth;
      btn.classList.add("backpack-btn--pulse");
      setTimeout(() => btn.classList.remove("backpack-btn--pulse"), 380);
    }
    if (typeof Backpack !== "undefined" && Backpack.refreshResourceBadges) Backpack.refreshResourceBadges();
  },
};

Units.registerRangeProvider(Resources);

/* Gnomore Gnomes — poblados neutrales.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Colocar N poblados neutrales al empezar cada partida, en losetas
       transitables y libres.
     - Pintarlos (sprite + barra de vida, reutilizando las piezas visuales
       de js/units.js) y cambiar su sprite/dueño al conquistarse.
     - Ofrecer la mira de ataque a un poblado (solo si la unidad seleccionada
       lleva un gnomo cogido) y resolver el golpe: resta los puntos del
       gnomo a la vida del poblado, el gnomo muere y desaparece del juego
       (Gnome.destroyInstance, ver ese archivo), y si la vida llega a 0 el
       poblado pasa a ser del equipo atacante.
     - Contar cuántos poblados posee cada equipo (Villages.ownedCount), que
       es lo único que necesita saber js/glory.js para sumar el bonus de
       gloria persistente por poblado — ni Glory sabe cómo son los poblados
       ni Villages sabe cómo se generan los puntos de gloria, cada uno habla
       con el otro a través de esta única función.

   Pedido explícito: "añadimos poblados neutrales, los poblados neutrales
   aparecen desperdigados por el mapa, de momento puedes poner 2. los
   poblados neutrales tienen 10 puntos de vida, puedes atacarlos solo si
   tienes un gnomo en la mano. de ser asi los puntos acumulados del gnomo se
   restan a los puntos de vida del poblado. si un equipo consigue destruir
   un poblado neutral por completo, el sprite del poblado cambiara al del de
   su equipo. tener un poblado otorga +1 punto de gloria persistentes a
   todos los turnos. cuando se pega con un gnomo a un poblado el gnomo muere
   y desaparece del juego"

   Se registra como "proveedor de rango" igual que Movement/Combat/Gnome
   (ver cabecera de units.js) — ninguno de esos archivos sabe que este
   existe, todos hablan solo con Units. */

const VILLAGE_GLORY_PER_TURN = 2; // puntos de victoria fijos por turno de cada tótem propio


const VILLAGE_MAX_HP = 10;
// Pedido explícito (segunda pasada): "tambien habran 5 totems normales" —
// de 2 a 5, junto con el escenario 25x25 (ver BOARD_SIZE_BY_OPPONENTS en
// matchsetup.js) que ahora hay sitio de sobra para repartirlos.
const VILLAGE_COUNT = 5;
const VILLAGE_ATTACK_RANGE = 1; // cuerpo a cuerpo, igual que Combat.attackRange

// Sprite de cada poblado según su dueño — "neutral" al generarse, y el de
// la RAZA del equipo que lo conquista (no el team "player"/"enemy" en sí,
// para que dos partidas con razas distintas en el mismo bando se vean
// distintas, igual que ya hace el resto de arte del juego, ver races.js).
const VILLAGE_SPRITES = {
  neutral: "assets/iconos/poblado_neutral.png",
  mushboom_forest: "assets/iconos/poblado_mushboom_forest.png",
  colinas_rockntroll: "assets/iconos/poblado_colinas_rockntroll.png",
};

const Villages = {
  list: [],
  _raceIds: { player: null, enemy: null },
  _nextId: 1,
  _flashEl: null,
  _targetedIds: [],

  // Se llama junto a Glory.init (newgame-flow.js) para que Villages sepa
  // qué sprite de raza usar cuando cada equipo conquiste uno — mismo patrón
  // que Glory._raceIds, cada archivo con su propia copia en vez de leer la
  // del otro directamente (regla de oro: un archivo por mecánica).
  init(playerRaceId, enemyRaceId) {
    this._raceIds = Object.assign({}, Teams.raceIds);
    this._initMouseTracking();
  },

  // Se llama ANTES de spawn() al empezar cada partida nueva (igual que
  // Gnome.resetAll) — quita del DOM los poblados de la partida anterior y
  // vacía la lista.
  resetAll() {
    this.list.forEach((v) => v.el.remove());
    this.list = [];
    this._targetedIds = [];
  },

  // Coloca VILLAGE_COUNT poblados en losetas transitables, libres (sin
  // unidad, gnomo NI otro poblado) y no demasiado cerca unas de otras (para
  // que no aparezcan las dos pegadas por pura casualidad). Pedido
  // explícito: "lo mismo ocurre con los totems, se intentara repartirlos
  // de la manera mas equitativa posible, separandolos de ambos jugadores
  // el mismo numero de casillas para que ninguno tenga ventaja" — mismo
  // criterio de equidistancia (Chebyshev) a los Obeliscos de ambos equipos
  // que Shops.spawn (js/shops.js), con la misma tolerancia creciente si el
  // mapa está muy lleno para encontrar sitio perfectamente equidistante.
  spawn(boardSize) {
    if (typeof Teams !== "undefined" && Teams.rivalCount >= 2) return this._spawnSpread(boardSize);
    const MIN_SEPARATION = 3;
    const obeliskSpots = typeof Obelisks !== "undefined" ? Obelisks.list.map((o) => ({ row: o.row, col: o.col })) : [];
    let maxImbalance = 1;
    let attempts = 0;
    while (this.list.length < VILLAGE_COUNT && attempts < 1500) {
      attempts++;
      if (attempts % 150 === 0) maxImbalance++;
      const row = Math.floor(Math.random() * boardSize);
      const col = Math.floor(Math.random() * boardSize);
      if (obeliskSpots.length) {
        const dists = obeliskSpots.map((o) => Math.max(Math.abs(row - o.row), Math.abs(col - o.col)));
        const imbalance = Math.max(...dists) - Math.min(...dists);
        if (imbalance > maxImbalance) continue;
      }
      if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) continue;
      if (typeof Units !== "undefined" && Units.unitAt(row, col)) continue;
      if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) continue;
      if (typeof Obelisks !== "undefined" && Obelisks.at(row, col)) continue; // Obelisco Ancestral (js/obelisks.js)
      if (typeof Obelisks !== "undefined" && Obelisks.isAdjacent(row, col)) continue; // el anillo del Obelisco debe quedar libre para reclutar
      // Altar.isNear (no solo Altar.at) — el Altar da paso a un GnomOgro
      // mucho más alto que un poblado normal, ver la nota larga en
      // Altar.isNear (js/altar.js): sin este margen de 1 casilla un poblado
      // recién colocado podría acabar tapándolo visualmente.
      if (typeof Altar !== "undefined" && Altar.isNear(row, col)) continue; // Altar de Sacrificios (js/altar.js)
      if ((typeof Resources !== "undefined" && Resources.at(row, col)) || (typeof Drums !== "undefined" && Drums.at(row, col))) continue; // Recursos de escenario (js/resources.js)
      if (this.at(row, col)) continue;
      const tooClose = this.list.some(
        (v) => Math.max(Math.abs(v.row - row), Math.abs(v.col - col)) < MIN_SEPARATION
      );
      if (tooClose) continue;
      this._create(row, col);
    }
  },

  // Varios rivales: la regla de equidistancia a TODOS los obeliscos solo
  // admite el centro del mapa, así que se reparten por todo el tablero con
  // "mejor candidato" (cada nuevo tótem = el punto de entre varios al azar
  // más alejado de los obeliscos y de los tótems ya puestos).
  _spawnSpread(boardSize) {
    const count = 4 + 2 * Teams.rivalCount; // 8 con 2 rivales, 10 con 3
    const obeliskSpots = typeof Obelisks !== "undefined" ? Obelisks.list.map((o) => ({ row: o.row, col: o.col })) : [];
    const minFromObelisk = Math.max(4, Math.floor(boardSize / 6));
    const dist = (a, b) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
    const valid = (row, col) => {
      if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) return false;
      if (typeof Units !== "undefined" && Units.unitAt(row, col)) return false;
      if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) return false;
      if (typeof Obelisks !== "undefined" && Obelisks.at(row, col)) return false;
      if (typeof Obelisks !== "undefined" && Obelisks.isAdjacent(row, col)) return false; // el anillo del Obelisco debe quedar libre para reclutar
      if (typeof Altar !== "undefined" && Altar.isNear(row, col)) return false;
      if ((typeof Resources !== "undefined" && Resources.at(row, col)) || (typeof Drums !== "undefined" && Drums.at(row, col))) return false;
      if (this.at(row, col)) return false;
      if (obeliskSpots.some((o) => dist(o, { row, col }) < minFromObelisk)) return false;
      return true;
    };
    for (let n = 0; n < count; n++) {
      let best = null;
      let bestScore = -1;
      for (let k = 0; k < 60; k++) {
        const row = Math.floor(Math.random() * boardSize);
        const col = Math.floor(Math.random() * boardSize);
        if (!valid(row, col)) continue;
        const others = obeliskSpots.concat(this.list.map((v) => ({ row: v.row, col: v.col })));
        const score = Math.min(...others.map((o) => dist(o, { row, col })));
        if (score > bestScore) { bestScore = score; best = { row, col }; }
      }
      if (!best || bestScore < 3) break;
      this._create(best.row, best.col);
    }
  },

  at(row, col) {
    return this.list.find((v) => v.row === row && v.col === col) || null;
  },

  // Cuántos poblados posee `team` ahora mismo — se mantiene tal cual (ya no
  // la usa Glory, ver gloryBonusFor más abajo) porque sigue siendo útil como
  // dato simple por si algo más adelante solo necesita el recuento.
  ownedCount(team) {
    return this.list.filter((v) => v.owner === team).length;
  },

  // Lo que SÍ necesita saber js/glory.js (Glory.grantTurnStart) para el
  // bonus persistente: la suma del bonus de CADA poblado que posee `team`,
  // no solo el recuento — pedido explícito: "si se destuye un poblado...en
  // un turno de un solo golpe...otorga +2 puntos persistentes para todos
  // los turnos en vez de +1" (ver _capture, gloryBonus se fija ahí al
  // conquistarlo y no cambia después, así que sumarlos basta).
  gloryBonusFor(team) {
    // Abundancia (js/skills.js): +1 de gloria extra por cada tótem propio, pero solo
    // cuentan tantos tótems como el nivel de la habilidad (máx. +3).
    const rank = typeof Skills !== "undefined" ? Skills.rank(team, "abundancia") : 0;
    const owned = this.list.filter((v) => v.owner === team).length;
    return owned * VILLAGE_GLORY_PER_TURN + Math.min(owned, rank);
  },

  spriteFor(owner) {
    if (owner === "neutral") return VILLAGE_SPRITES.neutral;
    const raceId = this._raceIds[owner];
    return VILLAGE_SPRITES[raceId] || VILLAGE_SPRITES.neutral;
  },

  _create(row, col) {
    // Reutiliza la clase "unit" (ver style.css) SOLO por su posicionamiento
    // base (translate(-50%,-92%), el mismo cálculo de loseta que cualquier
    // personaje) y el temblor .unit--hit al recibir un golpe — el poblado
    // nunca entra en Units.list, así que Units.unitAt/combate/movimiento
    // jamás lo confunden con una unidad de verdad.
    const el = document.createElement("div");
    el.className = "unit village village--neutral";

    const spriteEl = document.createElement("img");
    spriteEl.decoding = "async"; // pedido de rendimiento: no bloquear el hilo principal decodificando
    spriteEl.className = "village__sprite";
    // Calidad de sprite dinámica según el zoom (pedido explícito, ver
    // js/spritequality.js). El cambio de textura al conquistarlo
    // (_capture, más abajo) reutiliza el mismo registro, no hace falta
    // volver a registrar el elemento.
    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(spriteEl, VILLAGE_SPRITES.neutral);
    else spriteEl.src = VILLAGE_SPRITES.neutral;
    spriteEl.alt = "";
    spriteEl.draggable = false;
    // Pedido explícito: "todo en el escenario se mueve al compas...pon
    // delays en las animaciones" — mismo arreglo que Bushes/Resources._create
    // (ver esas notas): sin esto, con varios tótems en la misma partida,
    // todos respiran (unit-idle-breathe) exactamente a la vez.
    spriteEl.style.animationDelay = `-${(Math.random() * 2.6).toFixed(2)}s`;
    el.appendChild(spriteEl);
    // Sombra proyectada (js/shadows.js) — se sincroniza sola si el sprite
    // cambia de raza propietaria (spriteFor, más abajo).
    if (typeof Shadows !== "undefined") Shadows.attach(spriteEl);

    // Barra de vida — mismas piezas/clases que Units.updateHpBar espera
    // (unit__hpbar-segment / --filled / --low / --pop), así se reutiliza esa
    // función tal cual en vez de reescribir la lógica de segmentos aquí.
    // Siempre visible (a diferencia de la de una unidad, que solo aparece
    // seleccionada/con el cursor encima — ver .village .unit__hpbar en
    // style.css): un poblado no se selecciona nunca, así que sin esto su
    // vida no se vería jamás.
    const hpBarEl = document.createElement("div");
    hpBarEl.className = "unit__hpbar village__hpbar";
    const hpSegmentEls = [];
    for (let i = 0; i < VILLAGE_MAX_HP; i++) {
      const seg = document.createElement("div");
      seg.className = "unit__hpbar-segment";
      hpBarEl.appendChild(seg);
      hpSegmentEls.push(seg);
    }
    el.appendChild(hpBarEl);
    // Franja inferior siempre clicable (igual que .obelisk__base-hit): con el
    // tótem semitransparente (village--occluding, pointer-events:none) su
    // base sigue pudiéndose pulsar para seleccionarlo/atacarlo.
    const baseHitEl = document.createElement("div");
    baseHitEl.className = "village__base-hit";
    el.appendChild(baseHitEl);

    // "cuando el totem este dentro del alcance de ataque de un personaje se
    // debe poder atacar simplemente con pulsar sobre el, no solo sobre el
    // circulo" (pedido explícito) — mismo patrón que Units._onUnitClick con
    // "unit--targeted" para un rival atacable: si este tótem está marcado
    // como objetivo ahora mismo (ver showFor, "village--targeted" más abajo)
    // y hay una unidad seleccionada, un clic sobre el propio tótem ataca
    // directamente en vez de no hacer nada (los poblados nunca se
    // seleccionan, así que no hay que desviar ningún otro comportamiento).
    el.addEventListener("click", (e) => {
      if (!el.classList.contains("village--targeted")) {
        // Punto Estratégico (js/skills.js): un tótem propio se puede
        // "abrir" como el Obelisco para reclutar desde él.
        if (this.canRecruitFrom(village)) {
          e.stopPropagation();
          this.toggleSelect(village);
        }
        return;
      }
      if (typeof Units === "undefined" || !Units.selectedId) return;
      e.stopPropagation();
      const attacker = Units.list.find((u) => u.id === Units.selectedId);
      if (attacker) this.attack(attacker, village);
    });

    // Menú de reclutar (solo se muestra al seleccionar un tótem propio con
    // Punto Estratégico) — reutiliza el estilo del menú del Obelisco.
    const menuEl = document.createElement("div");
    menuEl.className = "obelisk__menu";
    const recruitBtn = document.createElement("button");
    recruitBtn.className = "obelisk__menu-btn obelisk__menu-btn--recruit";
    recruitBtn.setAttribute("aria-label", "Reclutar");
    recruitBtn.innerHTML = '<img src="assets/iconos/obelisco_reclutar.png" class="obelisk__menu-icon" alt="">';
    recruitBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openRecruit(village);
    });
    if (typeof Tooltip !== "undefined") Tooltip.attach(recruitBtn, "Reclutar");
    menuEl.appendChild(recruitBtn);
    el.appendChild(menuEl);

    if (typeof Units !== "undefined") Units.container.appendChild(el);

    const village = {
      id: `village-${this._nextId++}`,
      row,
      col,
      owner: "neutral",
      hp: VILLAGE_MAX_HP,
      maxHp: VILLAGE_MAX_HP,
      gloryBonus: 1, // se fija de verdad al conquistarse, ver _capture()
      el,
      spriteEl,
      hpBarEl,
      hpSegmentEls,
      menuEl,
    };
    this._placeInstant(village);
    if (typeof Units !== "undefined") Units.updateHpBar(village);
    this.list.push(village);
    return village;
  },

  _placeInstant(village) {
    if (typeof getTileCenter === "undefined" || typeof Units === "undefined") return;
    const { x, y } = getTileCenter(village.row, village.col, Units.boardSize);
    village.el.style.left = `${x}px`;
    village.el.style.top = `${y}px`;
    village.el.style.zIndex = String((village.row + village.col) * 10 + 5);
  },

  // ---------- Consultas para la IA del rival (js/turns.js) ----------
  // "ahora el equipo enemigo tambien intenta capturar los totems" (pedido
  // explícito) — turns.js no sabe nada de rango/niebla/dueño de un tótem
  // (regla de oro: un archivo por mecánica), así que le basta con
  // preguntarle a este archivo en vez de duplicar esa lógica.

  // Mismo criterio que showFor() de más abajo (alcance, dueño distinto, sin
  // niebla) pero sin pintar ningún marcador, solo responde "¿hay algún
  // tótem que esta unidad podría atacar ya mismo?". El primero que
  // encuentra, o null.
  attackableBy(unit) {
    return (
      this.list.find((village) => {
        if (village.owner === unit.team) return false;
        const dist = Math.max(Math.abs(village.row - unit.row), Math.abs(village.col - unit.col));
        if (dist > VILLAGE_ATTACK_RANGE) return false;
        if (typeof Fog !== "undefined" && Fog.isFogged(village.row, village.col)) return false;
        return true;
      }) || null
    );
  },

  // El tótem que no sea ya suyo más cercano a `unit` — para que la IA
  // pueda ir ACERCÁNDOSE turno a turno cuando ninguno está todavía al
  // alcance (ver attackableBy de arriba). No filtra por niebla a propósito
  // (la IA "sabe" dónde está el mapa, simplifica bastante y de todas formas
  // nunca llega a atacar uno todavía con niebla real gracias al filtro de
  // attackableBy). Devuelve { row, col, village } o null si no queda
  // ninguno por conquistar.
  nearestUnowned(unit) {
    return (
      this.list
        .filter((v) => v.owner !== unit.team)
        .reduce((best, v) => {
          const d = Math.max(Math.abs(v.row - unit.row), Math.abs(v.col - unit.col));
          return !best || d < best.d ? { row: v.row, col: v.col, d, village: v } : best;
        }, null) || null
    );
  },

  // ---------- Ocultar personajes propios escondidos detrás de un totem ----------
  // Pedido explícito (v1): "Si alguien se esconde detras de un totem y no
  // deja seleccionarlo. arreglaremos esto haciendo semitransparente el
  // totem y clicable el personaje en la zona en la que se encuentra
  // solapado con el personaje". Pedido explícito (v2, afina el anterior):
  // "la transparencia del totem solo debe ocurrir cuando un jugador de tu
  // equipo esta detras y el raton esta tocando la zona comprendida de la
  // casilla donde se encuentra dicho jugador" — dos condiciones a la vez,
  // no basta con el solapamiento:
  //   1) el personaje escondido tiene que ser del equipo "player" (nunca
  //      un rival: no ayudamos a "encontrar" tropas enemigas escondidas).
  //   2) el puntero del ratón tiene que estar realmente encima de SU
  //      rectángulo (no de cualquier punto del tótem) — así el tótem solo
  //      se atenúa cuando el jugador está intentando señalar justo ahí.
  //
  // Se recalcula en cada movimiento del ratón (ver _initMouseTracking) y
  // también tras cualquier desplazamiento/al empezar la partida (por si un
  // personaje termina justo bajo el puntero sin que este se haya movido).
  // Pedido explícito (afina la v2 anterior, que valía para CUALQUIER
  // personaje propio que solapara en pantalla): "lo de la transparencia
  // del totem solo funciona cuando un jugador esta en la casilla de
  // detras del mismo, es decir la adyacente hacia arriba a la que esta
  // plantado el totem". Solo UNA loseta cuenta como "detrás" — no
  // cualquier solape visual.
  // Pedido explícito (v3, revierte la exclusión de rivales de la v2): "si
  // un enemigo esta detras de un totem...debe hacerse transparente de la
  // misma manera que ya lo hace para los jugadores aliados, para poder
  // interactuar con el, por ejemplo para pegarle" — ya no importa el
  // equipo de quien se esconde, solo que sea una unidad YA VISIBLE (no
  // oculta por niebla, ver el filtro de abajo): un rival visible detrás de
  // un tótem debe poder atacarse igual que uno propio debe poder
  // seleccionarse. En la proyección isométrica de este proyecto
  // (ver getTileTopLeft en mapgen.js: x=(col-row)*halfW, y=(col+row)*halfH)
  // la loseta que queda justo ARRIBA en pantalla, sin desplazamiento
  // horizontal, es (row-1, col-1) — la fila Y la columna bajan a la vez
  // (restar solo a una de las dos da una diagonal hacia un lado, no hacia
  // arriba). Se calcula así en vez de comparar rectángulos en pantalla
  // porque es justo esa relación de LOSETAS la que importa aquí, no cuánto
  // se solapen los sprites (que ya se sabía por la versión anterior).
  // Pedido explícito (v4): "la transparencia tambien funciona cuando el
  // personaje esta en la casilla de arriba a la derecha adyacente y arriba
  // a la izquierda adyacente y arriba 2 casillas del propio totem, ya que
  // se solapa sobre los personajes" — un tótem es más ancho y alto que su
  // propia loseta, así que no solo la loseta "justo arriba" (row-1,col-1)
  // puede quedar tapada por su sprite: también arriba-derecha (row-1,col),
  // arriba-izquierda (row,col-1) y 2 casillas arriba del todo (row-2,
  // col-2, para los tótems más altos) — misma geometría que usa
  // Fog._UP_NEIGHBOR_OFFSETS (js/fog.js) para el mismo problema con la
  // niebla, así que se reutiliza esa lista en vez de duplicarla.
  _OCCLUSION_OFFSETS: [
    [-1, -1],
    [-1, 0],
    [0, -1],
    [-2, -2],
  ],
  // Pedido explícito: "si una zona seleccionable del terreno o personaje
  // adyacente o algo asi por un objeto o habilidad cae en una casilla de
  // las que hemos nombrado de transparencia de totem u obelisco, este
  // tambien debe comportarse con el sistema de transparencia" — mismo
  // mecanismo que Obelisks._behindElsFor (js/obelisks.js): además de una
  // unidad, cualquier marcador de zona seleccionable (movimiento, ataque,
  // alcance de habilidad/objeto, lanzar/pasar gnomo... todos pasan por
  // Units.addMarker) en esas 4 casillas también activa la transparencia.
  _behindElsFor(village) {
    const els = [];
    Units.list.forEach((unit) => {
      if (!unit.el || unit.el.classList.contains("unit--fog-hidden")) return;
      if (this._OCCLUSION_OFFSETS.some(([dr, dc]) => unit.row === village.row + dr && unit.col === village.col + dc)) {
        els.push(unit.el);
      }
    });
    Units.markerEls.forEach((m) => {
      if (!m || !m.isConnected) return;
      const r = Number(m.dataset.row);
      const c = Number(m.dataset.col);
      if (Number.isNaN(r) || Number.isNaN(c)) return;
      if (this._OCCLUSION_OFFSETS.some(([dr, dc]) => r === village.row + dr && c === village.col + dc)) {
        els.push(m);
      }
    });
    return els;
  },

  refreshOcclusion(mouseX, mouseY) {
    if (typeof Units === "undefined") return;
    const mx = typeof mouseX === "number" ? mouseX : this._lastMouseX;
    const my = typeof mouseY === "number" ? mouseY : this._lastMouseY;
    this.list.forEach((village) => {
      if (!village.spriteEl) return;
      // Un tótem ya oculto por niebla no necesita además hacerse
      // semitransparente por ocultar a alguien.
      if (village.el.classList.contains("unit--fog-hidden") || mx === null || my === null) {
        village.el.classList.remove("village--occluding");
        return;
      }
      const behindEls = this._behindElsFor(village);
      let occluding = false;
      if (behindEls.length) {
        const vRect = village.spriteEl.getBoundingClientRect();
        const mouseOverVillage = mx >= vRect.left && mx <= vRect.right && my >= vRect.top && my <= vRect.bottom;
        const mouseOverBehind = behindEls.some((el) => {
          const r = el.getBoundingClientRect();
          return mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom;
        });
        occluding = mouseOverVillage || mouseOverBehind;
      }
      village.el.classList.toggle("village--occluding", occluding);
    });
  },

  // Última posición conocida del ratón en coordenadas de pantalla (clientX/
  // clientY) — null hasta el primer movimiento. Un único listener para
  // toda la partida en vez de uno por tótem.
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
    // Pedido explícito: "el obelisco y los totems han dejado de ponerse
    // transparentes para permitir seleccionar un personaje que este detras
    // de ellos" — mismo arreglo que Obelisks._initMouseTracking (ver ahí
    // el porqué): este mecanismo dependía solo de "mousemove", que un
    // móvil no dispara al tocar, así que se alimenta también con las
    // coordenadas reales del dedo.
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

  // Igual que Combat.findApproachTile/GnomeInstance.findApproachTile: la
  // loseta libre más cercana a `unit` desde la que `village` ya esté dentro
  // de VILLAGE_ATTACK_RANGE, sea cual sea su alcance de movimiento; si
  // `unit` ya está a esa distancia, devuelve su propia casilla (no hace
  // falta moverse). null si ni quedándose quieta ni moviéndose se puede
  // llegar a pegarle.
  //
  // Pedido explícito (bug reportado): "me quedaba un turno con un
  // personaje que tenia el gnomo, el totem estaba dentro de mi rango de
  // movimiento pero no pude pegarle" — showFor (más abajo) solo comprobaba
  // la distancia YA existente entre unidad y tótem, sin contemplar
  // acercarse primero (a diferencia de Combat/GnomeInstance, que sí lo
  // hacen); un tótem fuera de VILLAGE_ATTACK_RANGE pero dentro del
  // movimiento de la unidad nunca ofrecía la mira de ataque.
  findApproachTile(unit, village) {
    const type = UNIT_TYPES[unit.typeId];
    const moveRange = Units.moveRangeOf(unit);

    const distToVillage = (row, col) =>
      Math.max(Math.abs(row - village.row), Math.abs(col - village.col));

    if (distToVillage(unit.row, unit.col) <= VILLAGE_ATTACK_RANGE) {
      return { row: unit.row, col: unit.col };
    }

    let best = null;
    let bestDist = Infinity;
    for (let row = 0; row < Units.boardSize; row++) {
      for (let col = 0; col < Units.boardSize; col++) {
        if (row === unit.row && col === unit.col) continue;
        if (distToVillage(row, col) > VILLAGE_ATTACK_RANGE) continue;
        if (Units.unitAt(row, col)) continue;
        if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) continue;
        if (this.at(row, col)) continue; // poblado (el mismo u otro)
        if (typeof Shops !== "undefined" && Shops.at(row, col)) continue; // Tienda Goblin (js/shops.js)
        if (typeof Obelisks !== "undefined" && Obelisks.at(row, col)) continue; // Obelisco Ancestral (js/obelisks.js)
        if (typeof Altar !== "undefined" && Altar.at(row, col)) continue; // Altar de Sacrificios (js/altar.js)
        if (typeof GnomOgro !== "undefined" && GnomOgro.at(row, col)) continue; // GnomOgro (js/gnomogro.js): casilla ocupada
        if ((typeof Resources !== "undefined" && Resources.at(row, col)) || (typeof Drums !== "undefined" && Drums.at(row, col))) continue; // Recursos de escenario (js/resources.js)
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

  // ---------- Punto Estratégico: reclutar desde un tótem propio ----------
  _selectedId: null,
  canRecruitFrom(village) {
    if (typeof Skills === "undefined" || !Skills.has("player", "punto_estrategico")) return false;
    if (village.owner !== "player") return false;
    if (typeof Obelisks !== "undefined" && Obelisks.gameOver) return false;
    if (typeof Turns !== "undefined" && (Turns.activeTeam !== "player" || Turns._aiRunning)) return false;
    return true;
  },
  toggleSelect(village) {
    if (this._selectedId === village.id) {
      this.deselect();
      return;
    }
    this.deselect();
    if (typeof Units !== "undefined") Units.deselect();
    if (typeof Obelisks !== "undefined") Obelisks.deselect();
    SFX.click();
    this._selectedId = village.id;
    village.el.classList.add("village--selected");
  },
  deselect() {
    if (!this._selectedId) return;
    const prev = this.list.find((v) => v.id === this._selectedId);
    if (prev) prev.el.classList.remove("village--selected");
    this._selectedId = null;
  },
  openRecruit(village) {
    if (!this.canRecruitFrom(village) || typeof Obelisks === "undefined") return;
    const home = Obelisks.byTeam("player");
    if (!home) return;
    // "Ancla" con la misma forma que espera el popup del Obelisco.
    Obelisks.openRecruitPopup({ team: "player", raceId: home.raceId, row: village.row, col: village.col });
    this.deselect();
  },

  // ---------- Proveedor de rango (ver cabecera de units.js) ----------
  // Pedido explícito: "puedes atacarlos solo si tienes un gnomo en la
  // mano" — a diferencia de Combat (que se apaga MIENTRAS se lleva un
  // gnomo cogido, ver Gnome.isHeldBy en combat.js), esta mecánica es
  // exactamente la contraria: solo se activa CUANDO se lleva uno.
  showFor(unit) {
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    if (typeof Gnome === "undefined" || !Gnome.isHeldBy(unit.id)) return;
    this.list.forEach((village, i) => {
      if (village.owner === unit.team) return; // no se ataca el propio poblado
      // Niebla de guerra — mismo criterio que Combat/Gnome: no se ofrece
      // atacar algo que todavía no se ha revelado.
      if (typeof Fog !== "undefined" && Fog.isFogged(village.row, village.col)) return;
      // Ahora contempla acercarse (ver findApproachTile arriba), no solo la
      // distancia ya existente — así un tótem dentro del movimiento de la
      // unidad, aunque no esté ya a 1 casilla, sí ofrece la mira de ataque.
      const approach = this.findApproachTile(unit, village);
      if (!approach) return;
      // Pedido explícito: "si un enemigo esta dentro del area de
      // movimiento y pulso atacar, el personaje se mueve y ataca, eso son
      // dos acciones" — mismo criterio que Combat.attackableEnemies: si
      // hace falta moverse primero y solo queda 1 acción, no llegaría para
      // las dos (mover + machacar), así que no se ofrece la mira.
      const needsMove = approach.row !== unit.row || approach.col !== unit.col;
      if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return; // mover + estampar = 1 sola acción
      // Pedido explícito: "si un totem o el obelisco esta dentro del rango
      // de movimiento del personaje seleccionado se puede machacar el
      // gnomo contra el" — mismo bug/arreglo que Obelisks.showFor: el clic
      // directo sobre el propio tótem solo funciona ya adyacente
      // ("village--targeted" más abajo); si hace falta moverse primero,
      // esta mira es el ÚNICO sitio donde se puede pulsar, pero
      // village.el se pinta con z-index (row+col)*10+5 (ver _create) y sin
      // alwaysOnTop esta mira se quedaba en (row+col)*10+2 — por debajo del
      // propio tótem en su misma loseta, que la tapaba entera y se comía
      // el clic. alwaysOnTop la sube muy por encima de cualquier loseta.
      Units.addMarker({
        className: "attack-marker village-attack-marker",
        row: village.row,
        col: village.col,
        zOffset: 2,
        delayIndex: i,
        visibleClass: "attack-marker--visible",
        owner: "villages",
        alwaysOnTop: true,
        onClick: () => this.approachAndAttack(unit, village),
        buildContent: (marker) => {
          const icon = document.createElement("i");
          icon.className = "ph ph-crosshair-simple attack-marker__icon";
          marker.appendChild(icon);
        },
      });

      // "village--targeted" — mismo patrón que "unit--targeted" en
      // combat.js: marca el tótem como atacable ahora mismo, para que el
      // clic directo sobre su sprite (ver el listener en _create) y el
      // cursor de diana (ver style.css) sepan cuándo activarse. Solo
      // cuando ya está a distancia SIN moverse — el clic directo sobre el
      // sprite (a diferencia del marcador de arriba) nunca ha movido a la
      // unidad, así que solo tiene sentido si ya puede golpear desde donde
      // está (mismo criterio que .unit--targeted en combat.js, que tampoco
      // se activa si hay que acercarse primero).
      const dist = Math.max(Math.abs(village.row - unit.row), Math.abs(village.col - unit.col));
      if (dist <= VILLAGE_ATTACK_RANGE) {
        village.el.classList.add("village--targeted");
        this._targetedIds.push(village.id);
      }
    });
  },

  // Igual que Combat.approachAndAttack/GnomeInstance.catchBy: se acerca (si
  // hace falta) a la loseta desde la que ya puede golpear y resuelve el
  // golpe desde ahí, todo en un único clic sobre la mira.
  async approachAndAttack(unit, village) {
    Units.clearRangeOverlays();
    const approach = this.findApproachTile(unit, village);
    if (!approach) return; // se movieron/perdió el gnomo justo antes del clic
    if (approach.row !== unit.row || approach.col !== unit.col) {
      // Pedido explícito: "eso son dos acciones" — ver la misma nota en
      // Combat.approachAndAttack; el movimiento gasta su propia acción
      // aquí, la segunda la gasta attack() más abajo, en el machacón.
      if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
      const path = Units.stepPath(unit.row, unit.col, approach.row, approach.col);
      await Units.walkPath(unit, path);
      // Embestir (js/skills.js): mover + golpear por una sola acción, 1 vez por turno.
      // acercarse no gasta acción: la gasta la estampada
      // Mismo bug ya corregido en GnomeInstance.catchBy/Combat.approachAndAttack:
      // acercarse a pie tiene que revelar niebla nueva al detenerse.
      if (typeof Fog !== "undefined" && unit.team === "player") Fog.revealForUnit(unit);
    }
    await this.attack(unit, village);
  },

  onClear() {
    this._targetedIds.forEach((id) => {
      const village = this.list.find((v) => v.id === id);
      if (village) village.el.classList.remove("village--targeted");
    });
    this._targetedIds = [];
  },

  async attack(unit, village) {
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    if (village.owner === unit.team) return;
    const gnome = typeof Gnome !== "undefined" ? Gnome.list.find((g) => g.heldBy === unit.id) : null;
    if (!gnome) return; // se lo quitaron/lo soltó justo antes del clic

    Units.clearRangeOverlays();
    Units.faceTowardsTile(unit, village.row, village.col);

    // "los puntos acumulados del gnomo se restan a los puntos de vida del
    // poblado" — el daño es exactamente los puntos que llevaba encima, sin
    // ninguna fórmula extra (a diferencia de Combat.attack, que usa la
    // fuerza del atacante: aquí lo que importa es lo cargado que iba el
    // gnomo, no quién lo llevaba).
    const damage = gnome.points;
    // "si se destuye un poblado neutral o enemigo...en un turno de un solo
    // golpe" — solo cuenta si el poblado seguía a su vida MÁXIMA justo antes
    // de este golpe concreto (nunca dañado antes, ni en este turno ni en
    // otro anterior) Y este golpe por sí solo lo deja a 0 o menos. Un
    // poblado ya dañado en un golpe previo que se remata después NO cuenta,
    // aunque ese golpe final sí sea el que lo destruye. Calculado ANTES de
    // gastar la acción del turno (más abajo) porque el propio aviso visual
    // de "sin acciones" depende de saber ya si esto va a ser un golpe
    // mortal en un solo golpe o no.
    const wasFullHp = village.hp >= village.maxHp;
    village.hp = Math.max(0, village.hp - damage);
    const oneHitKill = wasFullHp && village.hp <= 0;

    // Golpear a un poblado cuenta como UNA de las 2 acciones del turno,
    // igual que cualquier otra acción (moverse, golpear a un rival...).
    if (typeof Turns !== "undefined") Turns.useAction(unit);
    // "cuando se machaca a un gnomo el personaje no debe tener los colores
    // de inactivo hasta que se haya capturado el propio totem" (pedido
    // explícito) — Turns.useAction ya cuenta la acción de verdad (para que
    // canAct/el resto de reglas sigan siendo correctas durante todo el
    // salto), pero el aviso VISUAL de "sin acciones" (unit--exhausted, ver
    // turns.js) se quita otra vez aquí y no vuelve hasta el final de
    // _playEpicSmash — así el personaje se ve a toda saturación durante su
    // propio momento de gloria, no desteñido a media animación.
    if (oneHitKill && unit.el) unit.el.classList.remove("unit--exhausted");

    // Pedido explícito: "el salto de machacar gnomo se realizara siempre,
    // solo que cuando sea eliminar de golpe todos los puntos de un totem,
    // el salto sera el doble de alto y el temblor el doble de grande" — ya
    // no hay una rama alternativa "sin salto" (el viejo unit--punching +
    // daño normal): CUALQUIER golpe contra un tótem hace el salto épico;
    // `big` (oneHitKill) es lo único que decide si es la versión doblada
    // (con destello, texto "¡GOLPE MORTAL!" y 2 de bonus de gloria) o la
    // normal. La animación épica se encarga ella sola de la
    // retroalimentación de impacto (barra de vida, texto flotante,
    // temblor, sonido, destruir el gnomo) EN EL MOMENTO justo del golpe
    // contra el suelo, no antes — ver _playEpicSmash más abajo.
    await this._playEpicSmash(unit, village, damage, oneHitKill);

    if (village.hp <= 0) {
      this._capture(village, unit.team, oneHitKill ? 2 : 1);
    }

    // Ahora que el tótem YA está capturado (si tocaba), toca reaplicar el
    // aviso visual de "sin acciones" que se suprimió arriba durante el
    // machacón épico — Turns.useAction ya había contado la acción de verdad
    // desde el principio, esto solo pone al día el propio classList.
    if (oneHitKill && typeof Turns !== "undefined") Turns.refreshExhaustedClass(unit);

    Units.refreshRange(unit);
  },

  // "si se destuye un poblado neutral o enemigo...en un turno de un solo
  // golpe, se activara una animacion donde el personaje en cuestion que
  // ataque saltara haciendo una parabola epica a camara lenta y machacara
  // el gnomo contra el suelo, la camara debe temblar al impactar contra el
  // suelo" (pedido explícito). Devuelve una promesa que no se resuelve hasta
  // que toda la secuencia termina, así attack() espera a que acabe antes de
  // seguir con la captura — igual de bloqueante para el resto del turno que
  // cualquier otra acción, no hace falta más sincronización.
  async _playEpicSmash(unit, village, damage, big) {
    const typeId = unit.typeId;
    const idleSrc = (typeof UNIT_TYPES !== "undefined" && UNIT_TYPES[typeId] && UNIT_TYPES[typeId].spriteUrl) || "";
    const machacaSrc = typeof Units !== "undefined" ? Units.machacaSpriteFor(typeId) : idleSrc;
    const gnome = typeof Gnome !== "undefined" ? Gnome.list.find((g) => g.heldBy === unit.id) : null;

    // Sube al personaje por encima de todo lo demás mientras dura el salto
    // (ver .unit--epic-smash en style.css) y le pone la pose "machaca" —
    // tanto el sprite del propio personaje como, si sigue con el gnomo
    // enganchado en este instante, la posición calibrada de esa pose (ver
    // GnomeInstance.setAttachPose, gnome.js).
    if (unit.spriteEl && machacaSrc) {
      unit.spriteEl.src = machacaSrc;
      // Cada pose puede tener su propio tamaño calibrado por separado (ver
      // SPRITE_SCALES_MACHACA/Units.machacaScaleFor, js/units.js y pedido
      // explícito en debug/configurar-personajes.html) — sin eso, un
      // personaje con el recorte de esta pose más grande/pequeño que el de
      // iddle se vería mal encajado en el tablero.
      unit.spriteEl.style.width = Math.round(120 * Units.machacaScaleFor(typeId)) + "px";
    }
    if (gnome) gnome.setAttachPose(unit, "machaca");
    unit.el.classList.remove("unit--epic-smash", "unit--epic-smash--big");
    void unit.spriteEl.offsetWidth;
    unit.el.classList.add("unit--epic-smash");
    // `big` (golpe mortal de un solo tiro) dobla la altura del salto — ver
    // .unit--epic-smash--big / @keyframes unit-epic-smash-big en style.css.
    if (big) unit.el.classList.add("unit--epic-smash--big");
    if (typeof SFX !== "undefined") SFX.hit();

    // Sincronizado a mano con @keyframes unit-epic-smash (style.css).
    // Pedido explícito: "la animacion de estamparlo al final debe aparecer
    // justo cuando empieza a caer de golpe, no cuando contacta con el
    // suelo" — antes disparaba en el 85% (contacto real), ahora en el 68%
    // (el instante justo en que arranca la caída en picado desde el punto
    // más alto): 0.68 * 1300ms = 884ms. TOTAL_MS mantiene el mismo margen
    // de gracia de 150ms tras el final de la animación CSS (ahora 1300ms)
    // que ya tenía antes con la de 1100ms.
    const IMPACT_DELAY_MS = 884;
    const TOTAL_MS = 1450;

    await new Promise((resolve) => setTimeout(resolve, IMPACT_DELAY_MS));

    // ---- Momento del impacto ----
    // Pose de impacto propia (distinta a la de "machaca"/salto de arriba)
    // justo en el instante en que tiembla la cámara — pedido explícito: "el
    // gnomo se desintegra asi que cuando se muestre este sprite el gnomo no
    // tiene que aparecer", por eso este cambio de sprite va JUSTO ANTES de
    // Gnome.destroyInstance(gnome) más abajo, no después.
    const impactSrc = typeof Units !== "undefined" ? Units.impactSpriteFor(typeId) : machacaSrc;
    if (unit.spriteEl && impactSrc) {
      unit.spriteEl.src = impactSrc;
      unit.spriteEl.style.width = Math.round(120 * Units.impactScaleFor(typeId)) + "px";
    }
    Units.updateHpBar(village);
    Units.spawnFloatingText(village, `-${damage}`, { className: "dmg-popup" });
    // "¡GOLPE MORTAL!" solo tiene sentido cuando de verdad lo es (golpe que
    // elimina de golpe TODOS los puntos de un tótem a plena vida) — un
    // golpe normal (ahora también con salto, pero sin remate) solo muestra
    // el número de daño de siempre.
    if (big) Units.spawnFloatingText(village, "¡GOLPE MORTAL!", { className: "dmg-popup gnome-points-popup" });
    Units.playShake(village);
    if (typeof SFX !== "undefined") (big ? SFX.glory() : SFX.hit());
    // "la camara debe temblar al impactar contra el suelo...el temblor sera
    // el doble de grande" (en el golpe mortal) — sobre board-viewport (nunca
    // board-camera: ese ya lleva su propio transform de paneo/zoom puesto
    // por JS en boardview.js, y una animación CSS ahí lo pisaría durante el
    // temblor) para que se note en todo el tablero visible sin pelearse con
    // el paneo/zoom del jugador. board-viewport--shake es ahora el temblor
    // NORMAL (cualquier golpe a un tótem); --big lo dobla para el golpe
    // mortal de un solo tiro.
    const viewportEl = document.getElementById("board-viewport");
    if (viewportEl) {
      const shakeClass = big ? "board-viewport--shake--big" : "board-viewport--shake";
      viewportEl.classList.remove("board-viewport--shake", "board-viewport--shake--big");
      void viewportEl.offsetWidth;
      viewportEl.classList.add(shakeClass);
      setTimeout(() => viewportEl.classList.remove(shakeClass), 420);
    }
    // "cuando se pega con un gnomo a un poblado el gnomo muere y desaparece
    // del juego" — en CUALQUIER golpe a un tótem (ya no solo el golpe
    // mortal, ahora que el salto siempre pasa por este mismo punto de
    // impacto), desaparece justo en el instante del machacón contra el
    // suelo, no al principio del salto.
    if (gnome) Gnome.destroyInstance(gnome);
    // Charco de sangre (js/bloodsplat.js) — pedido explícito: "se aplasta
    // un gnomo" también deja charco, sobre la loseta del personaje que lo
    // estampa (ahí es donde cae el golpe), mismo instante que el resto del
    // feedback de impacto.
    if (gnome && typeof BloodSplat !== "undefined") BloodSplat.spawnAt(village.row, village.col, { scale: 1.7 });
    // "un pequeño destello blanco puede iluminar la pantalla un instante"
    // (pedido explícito) — reservado para el golpe mortal, que es el
    // momento realmente "épico"; un golpe normal (ahora con salto pero sin
    // remate) no lo dispara para no deslumbrar en cada golpe cualquiera.
    if (big) this._flashScreen();

    await new Promise((resolve) => setTimeout(resolve, TOTAL_MS - IMPACT_DELAY_MS));

    // ---- Fin de la animación: vuelve todo a la normalidad ----
    unit.el.classList.remove("unit--epic-smash", "unit--epic-smash--big");
    if (unit.spriteEl && idleSrc) {
      unit.spriteEl.src = idleSrc;
      // Devuelve también el tamaño de la pose iddle (SPRITE_SCALES de
      // siempre) — las dos poses de arriba pueden haber dejado un ancho
      // distinto puesto a mano.
      const idleScale = (typeof SPRITE_SCALES !== "undefined" && (SPRITE_SCALES[typeId] ?? SPRITE_SCALES.default)) || 1;
      unit.spriteEl.style.width = Math.round(120 * idleScale) + "px";
    }
  },

  // Destello blanco de pantalla completa en el instante del impacto — mismo
  // patrón que el resto del proyecto para elementos globales creados una
  // sola vez y reutilizados (ver settingsmenu.js/turns.js: se crea la
  // primera vez que hace falta y se guarda la referencia). Reinicia la
  // clase en cada llamada (remove/reflow/add) por si dos machacones épicos
  // se solaparan, igual que el resto de animaciones de "un solo tiro" de
  // este archivo (unit--epic-smash, board-viewport--shake).
  _flashScreen() {
    if (!this._flashEl) {
      const el = document.createElement("div");
      el.id = "epic-smash-flash";
      document.body.appendChild(el);
      this._flashEl = el;
    }
    this._flashEl.classList.remove("epic-smash-flash--active");
    void this._flashEl.offsetWidth;
    this._flashEl.classList.add("epic-smash-flash--active");
  },

  // "si un equipo consigue destruir un poblado neutral por completo, el
  // sprite del poblado cambiara al del de su equipo. tener un poblado
  // otorga +1 punto de gloria persistentes a todos los turnos" — el bonus
  // en sí no se "concede" aquí: Glory.grantTurnStart (glory.js) pregunta en
  // cada inicio de turno cuánto suma gloryBonusFor() de cada equipo, así
  // que basta con cambiar `owner`/`gloryBonus` para que el próximo turno de
  // ese equipo ya lo tenga en cuenta, sin que este archivo necesite saber
  // nada de puntos de gloria. `gloryBonus` (1 normal, 2 si fue un golpe
  // mortal en un solo golpe, ver attack()/_playEpicSmash) queda fijado aquí
  // para siempre — un poblado no "pierde" el bonus con el que se conquistó
  // hasta que alguien vuelva a conquistarlo.
  _capture(village, team, gloryBonus) {
    this.deselect();
    // "cuando pierdes el control de un totem los puntos de gloria
    // persistentes que te otorgaban tambien se pierden" (pedido explícito)
    // — Villages.gloryBonusFor ya recalcula esto solo en cuanto cambia
    // `owner` (filtra por dueño ACTUAL, así que el antiguo dueño deja de
    // contar este tótem en su próximo cálculo sin que este archivo tenga
    // que hacer nada más); lo que faltaba era avisar al HUD del antiguo
    // dueño para que su "+X / turno" no se quede enseñando el bonus viejo
    // hasta su próximo turno — se guarda ANTES de pisar `village.owner`.
    const previousOwner = village.owner;
    village.owner = team;
    // Pedido explícito: capturar un tótem da SIEMPRE 2 puntos de victoria fijos por turno,
    // sea cual sea la forma de capturarlo (antes 1 o 2 según el golpe).
    village.gloryBonus = VILLAGE_GLORY_PER_TURN;
    village.hp = VILLAGE_MAX_HP; // un poblado recién conquistado vuelve a estar sano
    // Muralla (js/skills.js): su vida máxima depende del NUEVO dueño; un
    // tótem recién conquistado empieza a plena vida.
    if (typeof Skills !== "undefined") {
      Skills.refreshWalls();
      Skills.refreshRoots();
      village.hp = village.maxHp;
    }
    village.el.classList.remove("village--neutral");
    village.el.classList.remove("team-variant-1", "team-variant-2", "team-variant-3");
    village.el.classList.add(...Teams.cls("village", team));
    if (Teams.variantClass(team)) village.el.classList.add(Teams.variantClass(team));
    // Registrar de nuevo (no solo asignar .src): así SpriteQuality (ver
    // js/spritequality.js) actualiza qué imagen "normal" recordar para
    // este tótem — si no, un cambio de calidad posterior por zoom lo haría
    // volver a la textura NEUTRAL antigua en vez de a la del nuevo dueño.
    // El cambio de textura de la conquista es instantáneo a propósito (sin
    // fundido): es el propio contenido lo que cambia, no una cuestión de
    // calidad, y el pop de conquista de aquí abajo ya es su feedback visual.
    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(village.spriteEl, this.spriteFor(team));
    else village.spriteEl.src = this.spriteFor(team);
    Units.updateHpBar(village);
    // Quita el temblor de "golpe recibido" (Units.playShake, ver attack()
    // más arriba) ANTES de añadir el pop de conquista: los dos animan la
    // misma propiedad (transform) sobre el mismo elemento, así que dejarlos
    // solapados un instante se vería a tirones — el pop de conquista es el
    // que manda en este momento, más grande y con más sentido que el golpe.
    village.el.classList.remove("unit--hit");
    village.el.classList.remove("village--captured");
    void village.el.offsetWidth;
    village.el.classList.add("village--captured");
    // "Al conseguir un totem debe escucharse un sonido de satisfaccion"
    // (pedido explícito) — sonido propio y más "grande" que el genérico de
    // gloria (SFX.glory, ese sigue sonando aparte en el impacto del golpe
    // mortal, ver _playEpicSmash), justo en el instante de la conquista.
    if (typeof SFX !== "undefined") SFX.captureVillage();
    Units.spawnFloatingText(village, "¡Conquistado!", { className: "dmg-popup gnome-points-popup" });
    // El indicador discreto "+X / turno" del HUD de gloria (solo se pinta
    // el del jugador, ver glory.js) debe reflejar el nuevo poblado ya
    // mismo, no esperar al próximo inicio de turno — y lo mismo para quien
    // lo tenía antes (si tenía dueño de verdad, no "neutral": ese nunca
    // tuvo bonus que perder), que ahora mismo pierde ese +1/+2 de golpe.
    if (typeof Glory !== "undefined") {
      Glory.refreshPreview(team);
      if (previousOwner !== "neutral" && previousOwner !== team) Glory.refreshPreview(previousOwner);
    }
    // Pedido explícito: "cuando un jugador cualquiera captura o pierde un
    // totem, automaticamente deben actualizarse todos los marcadores de
    // poblacion de los obeliscos" — Obelisks.populationFor ya se recalcula
    // en vivo a partir de Villages.ownedCount (ver ese archivo), pero el
    // TEXTO del badge en pantalla solo se repintaba en eventos propios de
    // obelisks.js (reclutar...), nunca al cambiar de dueño un tótem, así
    // que se quedaba desactualizado hasta el siguiente reclutamiento.
    // refreshAllPopBadges repinta los DOS obeliscos a la vez (quien gana Y
    // quien pierde el tótem, según corresponda).
    if (typeof Obelisks !== "undefined" && typeof Obelisks.refreshAllPopBadges === "function") {
      Obelisks.refreshAllPopBadges();
    }
    // Pedido explícito (memoria de niebla): "las casillas dentro de la
    // percepcion de las unidades de los jugadores, 2 casillas alrededor de
    // los totems capturados... son siempre visibles mientras esten bajo tu
    // dominio" — Fog._recomputePerception solo se recalcula al arrancar
    // applyVisibility (ver fog.js), así que un cambio de dueño necesita
    // pedir explícitamente ese recálculo aquí mismo para que el nuevo radio
    // de percepción (o la pérdida del que tenía el dueño anterior) se note
    // ya mismo, no en el próximo movimiento de una unidad cualquiera.
    if (typeof Fog !== "undefined" && typeof Fog.applyVisibility === "function") Fog.applyVisibility();
  },
};

Units.registerRangeProvider(Villages);

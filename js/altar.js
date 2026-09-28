/* Gnomore Gnomes — Altar de Sacrificios.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Colocar el Altar (uno solo, de momento) centrado en el mapa, la misma
       casilla para los dos equipos por definición ("equidistante a todas
       las bases enemigas" — con un único punto de partida humano y uno
       rival, el CENTRO del tablero es, por construcción, el punto más
       equidistante posible de los dos, igual que Shops.spawn ya resuelve
       "alejado de la zona de inicio" buscando el punto más lejano dentro
       del mapa).
     - Pintarlo (dos sprites: vacío/medio lleno, ver ALTAR_SPRITES) y
       bloquear su casilla para cualquier unidad, gnomo u objeto — igual que
       un poblado/Obelisco/Tienda Goblin.
     - Llevar su barra especial de 30 espacios, que en vez de vaciarse se
       RELLENA cada vez que un personaje con un gnomo cogido lo estampa
       contra el altar (misma animación "machacón épico" que ya usa
       Villages._playEpicSmash contra un tótem, adaptada aquí: ver
       _playSacrificeSmash).
     - Al llegar a sus 30 espacios: desaparecer (con temblor de pantalla) y
       avisar a Gnome OgroManager (js/gnomogro.js, GnomOgro.spawn) para que
       nazca en su sitio — ese archivo aparte es quien sabe moverse/atacar/
       terminar la partida, este no sabe nada de eso (regla de oro).

   Pedido explícito: "Añadimos una nueva mecanica. El altar de sacrificios y
   el GnomOgro. El altar de sacrificios aparece centrado en el mapa,
   equidistante a todas las bases enemigas. tiene una barra de vida
   especial... todas sus casillas son de color rojo y tiene 30 espacios.
   pero en vez de vaciarse, se rellena. se rellena estampando gnomos contra
   el altar de sacrificio. inicialmente el altar esta vacio, pero cuando
   pasa del 50% de su capacidad el sprite despues de una animacion de
   pulsacion cambia a mediolleno. cuando toda la barra esta llena, es decir
   sus 30 espacios, el altar desaparece...todo tiembla y aparece el
   GnomOgro."

   Decisión de diseño (sin pedido explícito exacto sobre "cuánto rellena
   cada gnomo"): cada gnomo estampado cuenta como UN espacio relleno, sin
   importar los puntos que llevara encima — "30 espacios" se lee como 30
   sacrificios, igual que las 30 casillas de vida de un Obelisco son 30
   golpes, no 30 puntos de una fórmula aparte. Si el día de mañana se
   prefiere que pese más un gnomo muy cargado de puntos, este es el único
   sitio que hay que tocar (ver ALTAR_FILL_PER_SACRIFICE más abajo). */

const ALTAR_MAX_FILL = 30;
// "cuando pasa del 50% de su capacidad" — estrictamente MÁS de la mitad
// (15 de 30 es exactamente el 50%, todavía no "pasado"), así que el sprite
// cambia al entrar en el espacio 16.
const ALTAR_HALF_THRESHOLD = ALTAR_MAX_FILL / 2;
const ALTAR_FILL_PER_SACRIFICE = 1;
const ALTAR_INTERACT_RANGE = 1; // cuerpo a cuerpo, igual que VILLAGE_ATTACK_RANGE/Combat.attackRange

const ALTAR_SPRITES = {
  vacio: "assets/edificios/altar_sacrificios_vacio.png",
  medio: "assets/edificios/altar_sacrificios_medio.png",
};

const Altar = {
  list: [], // como mucho un elemento, mismo patrón de array que Shops (SHOP_COUNT)

  // ---------- Ciclo de vida de la partida ----------
  resetAll() {
    this.list.forEach((a) => a.el && a.el.remove());
    this.list = [];
  },

  // Único punto de partida humano/rival de momento (ver newgame-flow.js,
  // SAFE_RADIUS/spawnSpots) -> el centro exacto del tablero es, por
  // construcción, el punto más alejado por igual de las dos bases. El
  // "al azar" de la especificación de GnomOgro no aplica aquí (el Altar en
  // sí no elige bando, solo posición).
  spawn(size) {
    const center = { row: Math.floor(size / 2), col: Math.floor(size / 2) };
    const spot = this._findFreeTileNear(center.row, center.col, size);
    if (spot) this._create(spot.row, spot.col);
  },

  _tileFree(row, col) {
    if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) return false;
    if (typeof Units !== "undefined" && Units.unitAt(row, col)) return false;
    if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) return false;
    if (typeof Villages !== "undefined" && Villages.at(row, col)) return false;
    if (typeof Shops !== "undefined" && Shops.at(row, col)) return false;
    if (typeof Obelisks !== "undefined" && Obelisks.at(row, col)) return false;
    if (this.at(row, col)) return false;
    // Un tile extra de margen con cualquier otro "mobiliario" del tablero
    // (no solo la propia casilla) — decisión de diseño sin pedido explícito
    // exacto: el Altar/GnomOgro son mucho más grandes que un tótem/Obelisco
    // normal (300px de sprite, ver .gnomogro__sprite en style.css) y, al
    // ser tan alto, si naciera pegado a un vecino cuya loseta cae "delante"
    // en la profundidad isométrica (misma fórmula z-index=(fila+columna)*10
    // que usa el resto del tablero), ese vecino le taparía buena parte del
    // cuerpo. El resto del mobiliario no necesita este margen extra (son
    // más bajos), así que se resuelve aquí, sin tocar el criterio general
    // de colocación de nadie más.
    if (typeof Villages !== "undefined" || typeof Shops !== "undefined" || typeof Obelisks !== "undefined") {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const r = row + dr;
          const c = col + dc;
          if (typeof Villages !== "undefined" && Villages.at(r, c)) return false;
          if (typeof Shops !== "undefined" && Shops.at(r, c)) return false;
          if (typeof Obelisks !== "undefined" && Obelisks.at(r, c)) return false;
        }
      }
    }
    return true;
  },

  // Espiral saliente desde (row, col) — mismo patrón que
  // Obelisks._findFreeTileNear/GnomeInstance.spawnNear.
  _findFreeTileNear(row, col, size) {
    if (this._tileFree(row, col)) return { row, col };
    for (let radius = 1; radius <= size; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const r = row + dr;
          const c = col + dc;
          if (r < 0 || c < 0 || r >= size || c >= size) continue;
          if (this._tileFree(r, c)) return { row: r, col: c };
        }
      }
    }
    return null;
  },

  at(row, col) {
    return this.list.some((a) => a.row === row && a.col === col);
  },

  // Igual que `at`, pero con un tile de margen alrededor (radio 1 por
  // defecto) — pensado para que Villages.spawn/Shops.spawn (los únicos que
  // colocan "mobiliario" TODAVÍA por decidir cuando el Altar ya existe, ver
  // el orden de newgame-flow.js) puedan darle un poco de aire además de
  // evitar su misma casilla. Motivo: el Altar da paso al GnomOgro, una
  // criatura mucho más alta que cualquier otra pieza del tablero (300px,
  // ver .gnomogro__sprite en style.css) — si algo nace pegado justo debajo/
  // a la derecha (la loseta que en la profundidad isométrica se pinta
  // "delante", ver la fórmula z-index=(fila+columna)*10 que usa todo el
  // tablero), le taparía buena parte del cuerpo. Nadie más necesita este
  // margen extra (son más bajos), así que se resuelve solo para quien
  // coloca ALREDEDOR del Altar, no al revés (ver Altar._tileFree, que ya
  // hace lo mismo mirando hacia fuera).
  isNear(row, col, radius = 1) {
    return this.list.some((a) => Math.max(Math.abs(a.row - row), Math.abs(a.col - col)) <= radius);
  },

  // El único Altar de la partida (de momento, ver cabecera) o null si ya se
  // llenó/todavía no se ha creado.
  current() {
    return this.list[0] || null;
  },

  _create(row, col) {
    // Reutiliza "unit" solo por el posicionamiento base (translate/left/top,
    // ver _placeInstant) igual que Obelisks/Villages/Shops — nunca entra en
    // Units.list, así que combate/movimiento normales no lo confunden con
    // una unidad de verdad.
    const el = document.createElement("div");
    el.className = "unit altar";

    const spriteEl = document.createElement("img");
    spriteEl.decoding = "async";
    spriteEl.className = "altar__sprite";
    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(spriteEl, ALTAR_SPRITES.vacio);
    else spriteEl.src = ALTAR_SPRITES.vacio;
    spriteEl.alt = "";
    spriteEl.draggable = false;
    el.appendChild(spriteEl);
    if (typeof Shadows !== "undefined") Shadows.attach(spriteEl);

    // Barra especial de 30 espacios, TODOS rojos (pedido explícito) — misma
    // pieza que Units.updateHpBar espera (unit__hpbar-segment), reutilizada
    // por su estructura/clip-path, pero pintada aparte a mano (ver
    // _refreshBar) en vez de con Units.updateHpBar: esa función interpreta
    // "el índice i está por debajo de unit.hp" (SE VACÍA), justo la lógica
    // contraria a la que necesita esta barra (SE RELLENA). Siempre visible,
    // igual que la de un Obelisco/poblado/tienda (nunca se selecciona).
    const barEl = document.createElement("div");
    barEl.className = "unit__hpbar altar__bar";
    const segmentEls = [];
    for (let i = 0; i < ALTAR_MAX_FILL; i++) {
      const seg = document.createElement("div");
      seg.className = "unit__hpbar-segment";
      barEl.appendChild(seg);
      segmentEls.push(seg);
    }
    el.appendChild(barEl);

    // Clic directo sobre el propio altar cuando está "marcado" (ver showFor
    // más abajo) — mismo patrón que Villages/Resources: no hace falta
    // acertar justo en el círculo flotante, el propio dibujo también sirve
    // de blanco.
    el.addEventListener("click", (e) => {
      if (!el.classList.contains("altar--targeted")) return;
      if (typeof Units === "undefined" || !Units.selectedId) return;
      e.stopPropagation();
      const unit = Units.list.find((u) => u.id === Units.selectedId);
      if (unit) this.approachAndSacrifice(unit, altar);
    });

    if (typeof Units !== "undefined") Units.container.appendChild(el);

    const altar = {
      row,
      col,
      fill: 0,
      el,
      spriteEl,
      barEl,
      segmentEls,
    };
    this._placeInstant(altar);
    this._refreshBar(altar);
    this.list.push(altar);
    return altar;
  },

  _placeInstant(altar) {
    if (typeof getTileCenter === "undefined" || typeof Units === "undefined") return;
    const { x, y } = getTileCenter(altar.row, altar.col, Units.boardSize);
    altar.el.style.left = `${x}px`;
    altar.el.style.top = `${y}px`;
    altar.el.style.zIndex = String((altar.row + altar.col) * 10 + 5);
  },

  _refreshBar(altar) {
    altar.segmentEls.forEach((seg, i) => {
      seg.classList.toggle("unit__hpbar-segment--filled", i < altar.fill);
    });
  },

  // ---------- Alcance/marcador (mismo patrón que Villages.showFor) ----------
  // Solo tiene sentido ofrecerlo cuando `unit` lleva un gnomo cogido encima
  // (nada que sacrificar si no) — mismo gate que Villages.attackableBy
  // exige implícitamente desde quien la llama (turns.js/backpack no hace
  // falta tocarlos: la propia Gnome.showFor de un personaje seleccionado ya
  // sigue enseñando su mira de "golpear/pasar" de siempre; esto es un
  // marcador ADICIONAL sobre el altar, no sustituye a nada existente).
  showFor(unit) {
    const altar = this.current();
    if (!altar) return;
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    const held = typeof Gnome !== "undefined" ? Gnome.list.find((g) => g.heldBy === unit.id) : null;
    if (!held) return;
    const approach = this.findApproachTile(unit, altar);
    if (!approach) return;
    altar.el.classList.add("altar--targeted");
    Units.addMarker({
      className: "range-marker range-marker--item-target",
      row: approach.row,
      col: approach.col,
      visibleClass: "range-marker--visible",
      owner: "altar",
      onClick: () => this.approachAndSacrifice(unit, altar),
    });
  },

  onClear() {
    this.list.forEach((a) => a.el.classList.remove("altar--targeted"));
  },

  // Misma idea que Villages.findApproachTile: si `unit` ya está a
  // ALTAR_INTERACT_RANGE, esa es la loseta; si no, la libre más cercana
  // dentro de su propio movimiento.
  findApproachTile(unit, altar) {
    const dist = (row, col) => Math.max(Math.abs(row - altar.row), Math.abs(col - altar.col));
    if (dist(unit.row, unit.col) <= ALTAR_INTERACT_RANGE) return { row: unit.row, col: unit.col };
    const range = UNIT_TYPES[unit.typeId].movimiento;
    let best = null;
    let bestDist = Infinity;
    for (let row = 0; row < Units.boardSize; row++) {
      for (let col = 0; col < Units.boardSize; col++) {
        if (dist(row, col) > ALTAR_INTERACT_RANGE) continue;
        if (Units.unitAt(row, col)) continue;
        if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) continue;
        if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) continue;
        const moveDist = Math.max(Math.abs(row - unit.row), Math.abs(col - unit.col));
        if (moveDist > range) continue;
        if (!Units.pathIsWalkable(unit.row, unit.col, row, col)) continue;
        if (moveDist < bestDist) {
          bestDist = moveDist;
          best = { row, col };
        }
      }
    }
    return best;
  },

  async approachAndSacrifice(unit, altar) {
    Units.clearRangeOverlays();
    const target = altar || this.current();
    if (!target) return;
    const approach = this.findApproachTile(unit, target);
    if (!approach) return;
    if (approach.row !== unit.row || approach.col !== unit.col) {
      if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
      const path = Units.stepPath(unit.row, unit.col, approach.row, approach.col);
      await Units.walkPath(unit, path);
      if (typeof Turns !== "undefined") Turns.useAction(unit);
      if (typeof Fog !== "undefined" && unit.team === "player") Fog.revealForUnit(unit);
    }
    await this.sacrifice(unit, target);
  },

  async sacrifice(unit, altar) {
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    const gnome = typeof Gnome !== "undefined" ? Gnome.list.find((g) => g.heldBy === unit.id) : null;
    if (!gnome) return; // se lo quitaron/lo soltó justo antes del clic
    Units.clearRangeOverlays();
    Units.faceTowardsTile(unit, altar.row, altar.col);
    if (typeof Turns !== "undefined") Turns.useAction(unit);
    await this._playSacrificeSmash(unit, altar, gnome);
    Units.refreshRange(unit);
  },

  // Mismo "machacón épico" que Villages._playEpicSmash (salto en parábola +
  // pose de impacto + Gnome.destroyInstance en el instante justo del golpe)
  // pero contra el Altar en vez de un tótem: aquí no hay vida que restar,
  // lo que cambia es altar.fill (ver ALTAR_FILL_PER_SACRIFICE arriba). Si
  // este sacrificio llena la barra del todo, el Altar desaparece y nace el
  // GnomOgro (ver _collapse más abajo) justo después del impacto, con el
  // mismo temblor de cámara que ya dispara cualquier golpe contra un tótem.
  async _playSacrificeSmash(unit, altar, gnome) {
    const typeId = unit.typeId;
    const idleSrc = (typeof UNIT_TYPES !== "undefined" && UNIT_TYPES[typeId] && UNIT_TYPES[typeId].spriteUrl) || "";
    const machacaSrc = typeof Units !== "undefined" ? Units.machacaSpriteFor(typeId) : idleSrc;

    if (unit.spriteEl && machacaSrc) {
      unit.spriteEl.src = machacaSrc;
      unit.spriteEl.style.width = Math.round(120 * Units.machacaScaleFor(typeId)) + "px";
    }
    if (gnome) gnome.setAttachPose(unit, "machaca");
    unit.el.classList.remove("unit--epic-smash", "unit--epic-smash--big");
    void unit.spriteEl.offsetWidth;
    unit.el.classList.add("unit--epic-smash");
    if (typeof SFX !== "undefined") SFX.hit();

    // Mismo timing que Villages._playEpicSmash (ver esa nota larga): el
    // instante justo en que arranca la caída en picado desde el punto más
    // alto, no cuando "toca" el suelo.
    const IMPACT_DELAY_MS = 884;
    const TOTAL_MS = 1450;

    await new Promise((resolve) => setTimeout(resolve, IMPACT_DELAY_MS));

    // ---- Momento del impacto ----
    const impactSrc = typeof Units !== "undefined" ? Units.impactSpriteFor(typeId) : machacaSrc;
    if (unit.spriteEl && impactSrc) {
      unit.spriteEl.src = impactSrc;
      unit.spriteEl.style.width = Math.round(120 * Units.impactScaleFor(typeId)) + "px";
    }

    altar.fill = Math.min(ALTAR_MAX_FILL, altar.fill + ALTAR_FILL_PER_SACRIFICE);
    this._refreshBar(altar);
    Units.spawnFloatingText(altar, "+1", { className: "dmg-popup" });
    Units.playShake(altar);
    if (typeof SFX !== "undefined") SFX.hit();

    // Pulso visual del propio altar (mismo patrón de "reflow para poder
    // repetir la animación" que unit--hit/unit__hpbar-segment--pop) + el
    // cambio de sprite a "medio lleno" al PASAR de la mitad — pedido
    // explícito: "cuando pasa del 50% de su capacidad el sprite despues de
    // una animacion de pulsacion cambia a mediolleno".
    altar.el.classList.remove("altar--pulse");
    void altar.el.offsetWidth;
    altar.el.classList.add("altar--pulse");
    if (altar.fill > ALTAR_HALF_THRESHOLD && !altar.el.classList.contains("altar--medio")) {
      altar.el.classList.add("altar--medio");
      if (typeof SpriteQuality !== "undefined") SpriteQuality.register(altar.spriteEl, ALTAR_SPRITES.medio);
      else altar.spriteEl.src = ALTAR_SPRITES.medio;
    }

    const viewportEl = document.getElementById("board-viewport");
    if (viewportEl) {
      viewportEl.classList.remove("board-viewport--shake");
      void viewportEl.offsetWidth;
      viewportEl.classList.add("board-viewport--shake");
      setTimeout(() => viewportEl.classList.remove("board-viewport--shake"), 420);
    }

    // "cuando se pega con un gnomo a un tótem el gnomo muere y desaparece
    // del juego" — mismo criterio aquí: se consume SIEMPRE, llene o no del
    // todo la barra.
    if (gnome) Gnome.destroyInstance(gnome);

    if (altar.fill >= ALTAR_MAX_FILL) {
      await this._collapse(altar, unit.team);
    }

    await new Promise((resolve) => setTimeout(resolve, Math.max(0, TOTAL_MS - IMPACT_DELAY_MS)));
    unit.el.classList.remove("unit--epic-smash", "unit--epic-smash--big");
    if (unit.spriteEl) {
      unit.spriteEl.src = idleSrc;
      unit.spriteEl.style.width = "";
    }
    if (gnome) gnome.setAttachPose(unit, "idle");
  },

  // "cuando toda la barra esta llena...el altar desaparece...todo tiembla y
  // aparece el GnomOgro" — `team` es quien dio el golpe de gracia (el 30º
  // sacrificio), y por tanto el bando del GnomOgro (pedido explícito: "el
  // gnomogro es del bando de la persona que le dio el golpe de gracia al
  // altar para que saliera el gnomo").
  async _collapse(altar, team) {
    if (typeof SFX !== "undefined") SFX.explosion();
    if (typeof Villages !== "undefined" && Villages._flashScreen) Villages._flashScreen();
    const viewportEl = document.getElementById("board-viewport");
    if (viewportEl) {
      viewportEl.classList.remove("board-viewport--shake--big");
      void viewportEl.offsetWidth;
      viewportEl.classList.add("board-viewport--shake--big");
      setTimeout(() => viewportEl.classList.remove("board-viewport--shake--big"), 420);
    }
    altar.el.classList.add("altar--collapsing");
    await new Promise((resolve) => setTimeout(resolve, 420));
    const row = altar.row;
    const col = altar.col;
    altar.el.remove();
    this.list = this.list.filter((a) => a !== altar);
    if (typeof GnomOgro !== "undefined") GnomOgro.spawn(team, row, col);
  },
};

// Mismo patrón que Movement/Combat/Gnome/Villages (ver cabecera de
// units.js): se registra UNA vez al cargar este archivo para que un
// personaje seleccionado que lleve un gnomo cogido también ofrezca la mira
// de "sacrificar en el altar" sin que units.js necesite saber que el Altar
// existe.
if (typeof Units !== "undefined") Units.registerRangeProvider(Altar);

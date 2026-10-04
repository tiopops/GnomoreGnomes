/* Gnomore Gnomes — Altar de Sacrificios.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Colocar el Altar (uno solo, de momento) centrado en el mapa, la misma
       casilla para los dos equipos por definición ("equidistante a todas
       las bases enemigas" — con un único punto de partida humano y uno
       rival, el CENTRO del tablero es, por construcción, el punto más
       equidistante posible de los dos, igual que Shops.spawn ya resuelve
       "alejado de la zona de inicio" buscando el punto más lejano dentro
       del mapa).
     - Pintarlo (tres sprites: vacío/medio lleno/lleno, ver ALTAR_SPRITES) y
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

   Pedido explícito (pasada posterior, corrige la decisión de diseño
   anterior): "debe llenarse con cada punto que tenga el gnomo al
   estamparlo contra el" — cada sacrificio rellena la barra con los PUNTOS
   que llevaba encima el gnomo en ese momento, no un espacio fijo. Mismo
   criterio que Villages._playEpicSmash ya usa contra un tótem (`const
   damage = gnome.points`, js/villages.js) — un gnomo muy cargado pesa más
   también aquí. Se recorta al máximo de la barra (Math.min) por si el
   último sacrificio se pasa de los espacios que quedan libres. */

const ALTAR_MAX_FILL = 30;
// Pedido explícito (pasada posterior, sustituye al "50%" original): "el
// sprite inicial sera vacio, cambiara a mediolleno cuando su barra alcance
// un 30% y cambiara a lleno cuando llegue a 70%" — "alcanzar" = >= (9 de 30
// ya es el 30%, 21 de 30 ya es el 70%).
const ALTAR_MEDIO_THRESHOLD = ALTAR_MAX_FILL * 0.3;
const ALTAR_LLENO_THRESHOLD = ALTAR_MAX_FILL * 0.7;
const MUSHROOM_ALTAR_POINTS = 10; // puntos de la barra que da una seta explosiva ofrecida
const ALTAR_INTERACT_RANGE = 1; // cuerpo a cuerpo, igual que VILLAGE_ATTACK_RANGE/Combat.attackRange

const ALTAR_SPRITES = {
  vacio: "assets/edificios/altar_sacrificios_vacio.png",
  medio: "assets/edificios/altar_sacrificios_medio.png",
  lleno: "assets/edificios/altar_sacrificios_lleno.png",
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
    // Al reaparecer, una unidad que ocupe la casilla no la descarta: se la
    // desplaza (ver _clearTileFor).
    const spot = this._findFreeTileNear(center.row, center.col, size, true);
    if (spot) {
      this._create(spot.row, spot.col);
      this._clearTileFor(spot.row, spot.col);
    }
  },

  _unitTileFree(r, c, evicted) {
    if (r < 0 || c < 0 || r >= Units.boardSize || c >= Units.boardSize) return false;
    if (typeof TerrainMap !== "undefined" && !(typeof Skills !== "undefined" ? Skills.walkableFor(evicted.team, r, c) : TerrainMap.isWalkable(r, c))) return false;
    const other = Units.unitAt(r, c);
    if (other && other.id !== evicted.id) return false;
    if (typeof Gnome !== "undefined" && Gnome.isAt(r, c)) return false;
    if (typeof Villages !== "undefined" && Villages.at(r, c)) return false;
    if (typeof Shops !== "undefined" && Shops.at(r, c)) return false;
    if (typeof Obelisks !== "undefined" && Obelisks.at(r, c)) return false;
    if (this.at(r, c)) return false;
    if ((typeof Resources !== "undefined" && Resources.at(r, c)) || (typeof Drums !== "undefined" && Drums.at(r, c))) return false;
    if (typeof GnomOgro !== "undefined" && GnomOgro.at(r, c)) return false;
    return true;
  },

  // Deja libre la casilla del Altar recién reaparecido (pedido explícito):
  // la unidad que estuviera encima va a una casilla libre al azar de al
  // lado; si no hay, empuja hacia fuera (con el Altar de epicentro) a las
  // unidades vecinas para hacerle hueco; si lo que lo impide es el agua, cae
  // a ella y se ahoga.
  async _clearTileFor(row, col) {
    const unit = Units.unitAt(row, col);
    if (!unit) return;
    const ring = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) ring.push({ row: row + dr, col: col + dc });
    const shuffle = (a) => a.sort(() => Math.random() - 0.5);
    const move = async (u, r, c) => {
      if (typeof Bushes !== "undefined") Bushes.clearHiddenUnit(u.id);
      await Units.hopTo(u, r, c);
    };

    let free = shuffle(ring.filter((t) => this._unitTileFree(t.row, t.col, unit)));
    if (free.length === 0) {
      // Empujar hacia fuera a un vecino ocupado para hacer hueco.
      const dist = (t) => Math.max(Math.abs(t.row - row), Math.abs(t.col - col));
      const neighbours = shuffle(ring.filter((t) => Units.unitAt(t.row, t.col) && Units.unitAt(t.row, t.col).id !== unit.id));
      for (const n of neighbours) {
        const other = Units.unitAt(n.row, n.col);
        const outward = [];
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const t = { row: n.row + dr, col: n.col + dc };
          if (dist(t) > dist(n) && this._unitTileFree(t.row, t.col, other)) outward.push(t);
        }
        if (outward.length) {
          const t = shuffle(outward)[0];
          await move(other, t.row, t.col);
          free = [{ row: n.row, col: n.col }];
          break;
        }
      }
    }
    if (free.length > 0) {
      await move(unit, free[0].row, free[0].col);
    } else {
      // Sin hueco posible: si hay agua alrededor, cae a ella.
      const water = shuffle(ring.filter((t) => t.row >= 0 && t.col >= 0 && t.row < Units.boardSize && t.col < Units.boardSize && typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(t.row, t.col)));
      if (water.length > 0) {
        await Units.hopTo(unit, water[0].row, water[0].col);
        if (!(typeof Skills !== "undefined" && Skills.has(unit.team, "anfibio"))) {
          if (typeof SFX !== "undefined" && SFX.splash) SFX.splash();
          if (typeof Combat !== "undefined" && Combat._spawnSplash) Combat._spawnSplash(unit.row, unit.col);
          const heldRow = unit.row;
          const heldCol = unit.col;
          await Units.removeUnit(unit, { drowned: true });
          if (typeof Gnome !== "undefined" && Gnome.isHeldBy && Gnome.isHeldBy(unit.id)) {
            const land = typeof Combat !== "undefined" && Combat._findDryTileNear ? Combat._findDryTileNear(heldRow, heldCol) : null;
            await Gnome.dropHeldBy(land ? { id: unit.id, row: land.row, col: land.col } : unit);
          }
        }
      }
    }
    if (typeof Fog !== "undefined") Fog.applyVisibility();
    if (typeof Units.refreshUnitOcclusion === "function") Units.refreshUnitOcclusion();
  },

  _tileFree(row, col, ignoreUnits = false) {
    if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) return false;
    if (!ignoreUnits && typeof Units !== "undefined" && Units.unitAt(row, col)) return false;
    if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) return false;
    if (typeof Villages !== "undefined" && Villages.at(row, col)) return false;
    if (typeof Shops !== "undefined" && Shops.at(row, col)) return false;
    if (typeof Obelisks !== "undefined" && Obelisks.at(row, col)) return false;
    if (this.at(row, col)) return false;
    // Un tile extra de margen con cualquier otro "mobiliario" del tablero
    // (no solo la propia casilla) — decisión de diseño sin pedido explícito
    // exacto: el Altar/GnomOgro son mucho más grandes que un tótem/Obelisco
    // normal (200px de sprite, ver .gnomogro__sprite en style.css) y, al
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
  _findFreeTileNear(row, col, size, ignoreUnits = false) {
    if (this._tileFree(row, col, ignoreUnits)) return { row, col };
    for (let radius = 1; radius <= size; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const r = row + dr;
          const c = col + dc;
          if (r < 0 || c < 0 || r >= size || c >= size) continue;
          if (this._tileFree(r, c, ignoreUnits)) return { row: r, col: c };
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
    // Segunda barra independiente (el rival): cada jugador tiene SU propia
    // barra de ofrendas (pedido explícito) — la del jugador va abajo (roja),
    // la del rival justo encima (violeta).
    const barEnemyEl = document.createElement("div");
    barEnemyEl.className = "unit__hpbar altar__bar altar__bar--enemy";
    const segmentEnemyEls = [];
    for (let i = 0; i < ALTAR_MAX_FILL; i++) {
      const seg = document.createElement("div");
      seg.className = "unit__hpbar-segment";
      barEnemyEl.appendChild(seg);
      segmentEnemyEls.push(seg);
    }
    el.appendChild(barEnemyEl);
    const extraBars = {}; // sin barras visibles para los rivales: cada jugador solo ve la suya

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
      fills: Teams.keyed(0),
      el,
      spriteEl,
      barEl,
      segmentEls,
      barEnemyEl,
      segmentEnemyEls,
      extraBars,
    };
    altar.state = "vacio";
    this._placeInstant(altar);
    this._refreshBar(altar);
    this.list.push(altar);
    this._initMouseTracking();
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
      seg.classList.toggle("unit__hpbar-segment--filled", i < altar.fills.player);
    });
    altar.segmentEnemyEls.forEach((seg, i) => {
      seg.classList.toggle("unit__hpbar-segment--filled", i < altar.fills.enemy);
    });
    Object.keys(altar.extraBars || {}).forEach((t) => {
      altar.extraBars[t].forEach((seg, i) => seg.classList.toggle("unit__hpbar-segment--filled", i < altar.fills[t]));
    });
  },

  // Llenado del equipo con la barra MÁS llena (el sprite del altar y la IA
  // miran el "peor caso").
  maxFill(altar) {
    return Math.max(...Teams.all.map((t) => altar.fills[t] || 0));
  },

  // Sprite según el llenado (ver ALTAR_MEDIO_THRESHOLD/ALTAR_LLENO_THRESHOLD):
  // vacío -> medio (30%) -> lleno (70%). Solo toca el DOM cuando cambia de
  // estado, no en cada sacrificio.
  _stateFor(fill) {
    if (fill >= ALTAR_LLENO_THRESHOLD) return "lleno";
    if (fill >= ALTAR_MEDIO_THRESHOLD) return "medio";
    return "vacio";
  },

  _refreshSprite(altar) {
    const state = this._stateFor(this.maxFill(altar));
    if (altar.state === state) return;
    altar.state = state;
    altar.el.classList.toggle("altar--medio", state === "medio");
    altar.el.classList.toggle("altar--lleno", state === "lleno");
    const src = ALTAR_SPRITES[state];
    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(altar.spriteEl, src);
    else altar.spriteEl.src = src;
  },

  // ---------- Transparencia cuando alguien queda detrás (mismo sistema que
  // Obelisks.refreshOcclusion, js/obelisks.js — pedido explícito: "el altar
  // tambien tiene el sistema de transparencias para cuando un jugador o
  // enemigo esta detras de el"). Cualquier unidad ya visible o marcador de
  // zona seleccionable en las 4 losetas de detrás cuenta, sea del equipo
  // que sea; con el ratón/dedo sobre el altar o sobre quien está detrás, el
  // altar se vuelve semitransparente y deja pasar los clics. ----------
  _OCCLUSION_OFFSETS: [
    [-1, -1],
    [-1, 0],
    [0, -1],
    [-2, -2],
  ],
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

  _behindElsFor(altar) {
    const els = [];
    const behind = (r, c) => this._OCCLUSION_OFFSETS.some(([dr, dc]) => r === altar.row + dr && c === altar.col + dc);
    Units.list.forEach((unit) => {
      if (!unit.el || unit.el.classList.contains("unit--fog-hidden")) return;
      if (behind(unit.row, unit.col)) els.push(unit.el);
    });
    (Units.markerEls || []).forEach((m) => {
      if (!m || !m.isConnected) return;
      const r = Number(m.dataset.row);
      const c = Number(m.dataset.col);
      if (Number.isNaN(r) || Number.isNaN(c)) return;
      if (behind(r, c)) els.push(m);
    });
    return els;
  },

  refreshOcclusion(mouseX, mouseY) {
    if (typeof Units === "undefined") return;
    const mx = typeof mouseX === "number" ? mouseX : this._lastMouseX;
    const my = typeof mouseY === "number" ? mouseY : this._lastMouseY;
    this.list.forEach((altar) => {
      if (!altar.spriteEl) return;
      if (altar.el.classList.contains("unit--fog-hidden") || mx === null || my === null) {
        altar.el.classList.remove("altar--occluding");
        return;
      }
      const behindEls = this._behindElsFor(altar);
      let occluding = false;
      if (behindEls.length) {
        const aRect = altar.spriteEl.getBoundingClientRect();
        const overAltar = mx >= aRect.left && mx <= aRect.right && my >= aRect.top && my <= aRect.bottom;
        const overBehind = behindEls.some((el) => {
          const r = el.getBoundingClientRect();
          return mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom;
        });
        occluding = overAltar || overBehind;
      }
      altar.el.classList.toggle("altar--occluding", occluding);
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
    const held =
      (typeof Gnome !== "undefined" ? Gnome.list.find((g) => g.heldBy === unit.id) : null) ||
      (typeof Mushrooms !== "undefined" ? Mushrooms.carriedBy(unit) : null);
    if (!held) return;
    if (typeof Fog !== "undefined" && Fog.isFogged(altar.row, altar.col)) return;
    const approach = this.findApproachTile(unit, altar);
    if (!approach) return;
    // Igual que Villages/Obelisks.showFor: moverse + machacar son 2 acciones.
    const needsMove = approach.row !== unit.row || approach.col !== unit.col;
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return; // mover + estampar = 1 sola acción
    // Mira de ataque SOBRE el propio altar (antes se ponía en la loseta de
    // aproximación, a menudo oculta bajo la propia unidad) y por encima de
    // todo (alwaysOnTop) para que el sprite grande no se coma el clic — mismo
    // patrón que los tótems y el obelisco.
    Units.addMarker({
      className: "attack-marker altar-attack-marker",
      row: altar.row,
      col: altar.col,
      zOffset: 2,
      visibleClass: "attack-marker--visible",
      owner: "altar",
      alwaysOnTop: true,
      onClick: () => this.approachAndSacrifice(unit, altar),
      buildContent: (marker) => {
        const icon = document.createElement("i");
        icon.className = "ph ph-crosshair-simple attack-marker__icon";
        marker.appendChild(icon);
      },
    });
    const dist = Math.max(Math.abs(altar.row - unit.row), Math.abs(altar.col - unit.col));
    if (dist <= ALTAR_INTERACT_RANGE) altar.el.classList.add("altar--targeted");
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
    const range = Units.moveRangeOf(unit);
    let best = null;
    let bestDist = Infinity;
    for (let row = 0; row < Units.boardSize; row++) {
      for (let col = 0; col < Units.boardSize; col++) {
        if (dist(row, col) > ALTAR_INTERACT_RANGE) continue;
        if (Units.unitAt(row, col)) continue;
        if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) continue;
        if (typeof TerrainMap !== "undefined" && !(typeof Skills !== "undefined" ? Skills.walkableFor(unit.team, row, col) : TerrainMap.isWalkable(row, col))) continue;
        const moveDist = Math.max(Math.abs(row - unit.row), Math.abs(col - unit.col));
        if (moveDist > range || (typeof Skills !== "undefined" && Skills.moveCost(unit, row, col) > range)) continue;
        if (!Units.pathIsWalkable(unit.row, unit.col, row, col, unit.team)) continue;
        if (moveDist < bestDist) {
          bestDist = moveDist;
          best = { row, col };
        }
      }
    }
    return best;
  },

  // Ofrenda de una seta explosiva: SIN machacón y SIN gastar acción (solo
  // estar en una casilla adyacente al altar), pero siempre con feedback: la
  // seta vuela del marcador al altar, suena, el altar pulsa, "+10" y un
  // pequeño temblor. Si llena la barra de su equipo, el altar se derrumba.
  async offerMushroom(unit, altar, mush) {
    if (!mush || mush.offering) return;
    mush.offering = true;
    Units.clearRangeOverlays();
    Units.faceTowardsTile(unit, altar.row, altar.col);
    const from = mush.markerEl ? mush.markerEl.getBoundingClientRect() : unit.el.getBoundingClientRect();
    const to = altar.spriteEl.getBoundingClientRect();
    const fly = document.createElement("img");
    fly.src = "assets/iconos/seta_trampa.png";
    fly.draggable = false;
    const size = 56;
    fly.style.cssText = `position:fixed;left:0;top:0;width:${size}px;z-index:99998;pointer-events:none;filter:drop-shadow(0 4px 6px rgba(0,0,0,.5))`;
    document.body.appendChild(fly);
    if (mush.markerEl) mush.markerEl.style.visibility = "hidden";
    const x0 = from.left + from.width / 2 - size / 2;
    const y0 = from.top + from.height / 2 - size / 2;
    const x1 = to.left + to.width / 2 - size / 2;
    const y1 = to.top + to.height * 0.45 - size / 2;
    if (typeof SFX !== "undefined") SFX.catch();
    const anim = fly.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) scale(1)`, offset: 0 },
        { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 70}px) scale(1.25) rotate(180deg)`, offset: 0.5 },
        { transform: `translate(${x1}px, ${y1}px) scale(0.6) rotate(360deg)`, offset: 1 },
      ],
      { duration: 620, easing: "ease-in", fill: "forwards" }
    );
    await anim.finished.catch(() => {});
    fly.remove();

    const team = unit.team;
    altar.fills[team] = Math.min(ALTAR_MAX_FILL, altar.fills[team] + MUSHROOM_ALTAR_POINTS);
    this._refreshBar(altar);
    Units.spawnFloatingText(altar, `+${MUSHROOM_ALTAR_POINTS}`, { className: "dmg-popup" });
    Units.playShake(altar);
    if (typeof SFX !== "undefined") {
      SFX.hit();
      if (SFX.passSuccess) setTimeout(() => SFX.passSuccess(), 90);
    }
    altar.el.classList.remove("altar--pulse");
    void altar.el.offsetWidth;
    altar.el.classList.add("altar--pulse");
    this._refreshSprite(altar);
    const viewportEl = document.getElementById("board-viewport");
    if (viewportEl) {
      viewportEl.classList.remove("board-viewport--shake");
      void viewportEl.offsetWidth;
      viewportEl.classList.add("board-viewport--shake");
      setTimeout(() => viewportEl.classList.remove("board-viewport--shake"), 420);
    }
    Mushrooms.consume(mush);
    if (altar.fills[team] >= ALTAR_MAX_FILL) await this._collapse(altar, team);
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
      await Units.walkPath(unit, path); // acercarse no gasta acción: la gasta la ofrenda
      if (typeof Fog !== "undefined" && unit.team === "player") Fog.revealForUnit(unit);
    }
    await this.sacrifice(unit, target);
  },

  async sacrifice(unit, altar) {
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    const gnome = typeof Gnome !== "undefined" ? Gnome.list.find((g) => g.heldBy === unit.id) : null;
    // Seta explosiva (js/mushrooms.js): también vale como ofrenda (10 puntos).
    const mush = !gnome && typeof Mushrooms !== "undefined" ? Mushrooms.carriedBy(unit) : null;
    if (!gnome && !mush) return; // se lo quitaron/lo soltó justo antes del clic
    // Seta explosiva: basta con estar junto al altar, sin machacón y sin
    // gastar acción (ver offerMushroom).
    if (mush) {
      await this.offerMushroom(unit, altar, mush);
      Units.refreshRange(unit);
      return;
    }
    Units.clearRangeOverlays();
    Units.faceTowardsTile(unit, altar.row, altar.col);
    if (typeof Turns !== "undefined") Turns.useAction(unit);
    await this._playSacrificeSmash(unit, altar, gnome, mush);
    Units.refreshRange(unit);
  },

  // Mismo "machacón épico" que Villages._playEpicSmash (salto en parábola +
  // pose de impacto + Gnome.destroyInstance en el instante justo del golpe)
  // pero contra el Altar en vez de un tótem: aquí no hay vida que restar,
  // lo que cambia es altar.fill, y por la misma cantidad de puntos que el
  // gnomo llevara encima (ver la nota de cabecera, "debe llenarse con cada
  // punto que tenga el gnomo") en vez de un espacio fijo. Si este
  // sacrificio llena la barra del todo, el Altar desaparece y nace el
  // GnomOgro (ver _collapse más abajo) justo después del impacto, con el
  // mismo temblor de cámara que ya dispara cualquier golpe contra un tótem.
  async _playSacrificeSmash(unit, altar, gnome, mush) {
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

    // "debe llenarse con cada punto que tenga el gnomo al estamparlo contra
    // el" — mismos puntos que Villages._playEpicSmash resta de la vida de un
    // tótem (`const damage = gnome.points`), aquí sumados a la barra en vez
    // de restados. gnome.points ya viene fijado más arriba (antes de que
    // Gnome.destroyInstance lo borre del todo), así que se lee de una vez.
    const fillAmount = gnome ? gnome.points : MUSHROOM_ALTAR_POINTS;
    const team = unit.team;
    altar.fills[team] = Math.min(ALTAR_MAX_FILL, altar.fills[team] + fillAmount);
    this._refreshBar(altar);
    Units.spawnFloatingText(altar, `+${fillAmount}`, { className: "dmg-popup" });
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
    this._refreshSprite(altar);

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
    if (mush) Mushrooms.consume(mush);
    // Charco de sangre (js/bloodsplat.js) — pedido explícito: "se aplasta
    // un gnomo" también deja charco, sobre la loseta de quien lo estampa
    // contra el Altar (mismo criterio que Villages._playEpicSmash).
    if (gnome && typeof BloodSplat !== "undefined") BloodSplat.spawnAt(unit.row, unit.col);

    if (altar.fills[team] >= ALTAR_MAX_FILL) {
      await this._collapse(altar, unit.team);
    }

    await new Promise((resolve) => setTimeout(resolve, Math.max(0, TOTAL_MS - IMPACT_DELAY_MS)));
    unit.el.classList.remove("unit--epic-smash", "unit--epic-smash--big");
    if (unit.spriteEl) {
      unit.spriteEl.src = idleSrc;
      // Devuelve el tamaño de la pose iddle (SPRITE_SCALES) — vaciarlo dejaba
      // a los personajes con escala distinta de 1 (p. ej. el GolemCorteza)
      // más pequeños tras el sacrificio (mismo criterio que Villages._playEpicSmash).
      const idleScale = (typeof SPRITE_SCALES !== "undefined" && (SPRITE_SCALES[typeId] ?? SPRITE_SCALES.default)) || 1;
      unit.spriteEl.style.width = Math.round(120 * idleScale) + "px";
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

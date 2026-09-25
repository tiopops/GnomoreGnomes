/* Gnomore Gnomes — Obeliscos Ancestrales.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Colocar UN Obelisco Ancestral por equipo al empezar cada partida (uno
       para "player", otro para "enemy"), más grande y llamativo que un
       tótem neutral (js/villages.js), con el sprite de la raza de su dueño.
     - Pintarlo (sprite + barra de vida de 30 segmentos) y resolver los
       golpes que reciba, reutilizando el mismo salto épico que un tótem
       (Villages._playEpicSmash) — a diferencia de un tótem, NO hace falta
       llevar un gnomo cogido para golpearlo, cualquier ataque cuerpo a
       cuerpo normal sirve, y su daño es la FUERZA del atacante (igual que
       Combat.attack), no los puntos de un gnomo.
     - Si un Obelisco llega a 0 de vida, ese equipo queda ELIMINADO de la
       partida: si con eso solo queda un equipo en pie, ese gana la partida
       (pantalla de victoria/derrota, ver _endGame más abajo).
     - El menú propio de cada Obelisco (solo se abre con un clic del dueño,
       en SU turno, sin necesitar tener ninguna unidad al lado): "Reclutar"
       (comprar una unidad nueva de su raza con Puntos de Gloria y elegir en
       qué loseta adyacente aparece) y "Habilidades" (de momento un simple
       "Próximamente", el propio pedido lo deja para más adelante).
     - Cuántas unidades puede tener cada equipo A LA VEZ sobre el tablero
       ("población"): empieza en 3 y sube +1 por cada tótem que posea ese
       equipo (Villages.ownedCount) — perder un tótem nunca elimina
       unidades ya reclutadas, solo bloquea reclutar una nueva mientras la
       población esté al límite.
     - Una unidad recién reclutada aparece con 1 SOLA acción disponible en
       el turno en el que se recluta (Turns.actionsUsed se deja ya en 1),
       recuperando las 2 normales a partir de su siguiente turno.

   Pedido explícito: "vamos a añadir una nueva mecanica, los Obeliscos
   Ancestrales. cada equipo tiene un obelisco ancestral, es como los
   totems pero mas grande y vistoso...cuando se hace clic en el aparece un
   menu (arriba del obelisco, desaparece al deseleccionar) con la opcion de
   reclutar unidades de dicho equipo, y otro menu de habilidades (este
   ultimo lo definiremos mas adelante)...cada obelisco tiene un indicador de
   poblacion (solo lo ve su propio jugador) iniciado en 3, +1 por cada totem
   capturado, si pierdes un totem no se eliminan las unidades ya
   reclutadas, solo no puedes reclutar mas si estas al limite...el obelisco
   tiene 30 puntos de vida, al llegar a 0 se destruye y ese jugador queda
   eliminado de la partida, cuando solo quede un jugador ese gana...cada
   unidad a reclutar tiene un precio, configurable desde el debug de
   configurar personajes (ver RECRUIT_PRICES/Units.recruitPriceFor en
   js/units.js)...cada equipo empieza en su obelisco sin ninguna unidad
   reclutada todavía, la unidad recién reclutada aparece en una casilla
   adyacente elegida por el jugador, y solo tiene 1 accion en su primer
   turno."

   Se registra como "proveedor de rango" igual que Movement/Combat/Villages/
   Shops (ver cabecera de units.js) para ofrecer la mira de ataque, y como
   oyente de inicio de turno (js/turns.js) para la IA rival (auto-reclutar de
   forma simple) — ninguno de esos archivos sabe que este existe. */

const OBELISK_MAX_HP = 30;
const OBELISK_BASE_POPULATION = 3; // "iniciado en 3"
const OBELISK_ATTACK_RANGE = 1; // cuerpo a cuerpo, igual que Combat/Villages

// Sprite de cada Obelisco según la raza de su dueño — mismas dos razas que
// Villages.VILLAGE_SPRITES (js/villages.js), pero su propio arte "más
// grande y vistoso" (pedido explícito), nunca comparte archivo con un tótem.
const OBELISK_SPRITES = {
  mushboom_forest: "assets/edificios/obelisco_mushboom_forest.png",
  colinas_rockntroll: "assets/edificios/obelisco_colinas_rockntroll.png",
};

// Iconos de los dos botones que asoman sobre el Obelisco al seleccionarlo
// (pedido explícito, imágenes adjuntas) — "respetaremos el tamaño y medidas
// del icono de habilidad especial", ver Abilities._refreshButton/CSS.
const OBELISK_MENU_ICONS = {
  recruit: "assets/iconos/obelisco_reclutar.png",
  abilities: "assets/iconos/obelisco_habilidades.png",
};

const Obelisks = {
  list: [],
  _raceIds: { player: null, enemy: null },
  _nextId: 1,
  _selectedId: null, // id del Obelisco PROPIO con el menú abierto ahora mismo, o null
  _targetedIds: [], // mismo patrón que Villages._targetedIds (mira de ataque al alcance)
  _pendingRecruit: null, // { obelisk, typeId, price } mientras se elige loseta de aparición
  _placementMarkers: [],
  gameOver: false,

  // ---------- Popup de reclutar (mismas clases .backpack-* que Shops) ----------
  _overlayEl: null,
  _slotsEl: null,
  _descEl: null,
  _recruitBtnEl: null,
  _activeRecruitObelisk: null,
  _selectedTypeId: null,

  // ---------- Popup de habilidades (placeholder) ----------
  _abilitiesOverlayEl: null,

  // ---------- Pantalla de fin de partida ----------
  _gameOverEl: null,

  // Estadísticas para el resumen comparativo de fin de partida (pedido
  // explícito: "TOTEMS CAPTURADOS, NUMERO DE PASES, MUERTES...ETC") — los
  // totems capturados se leen en vivo de Villages.ownedCount (nunca hace
  // falta llevar la cuenta aparte), pero pases/muertes no viven en ningún
  // sitio todavía, así que se cuentan aquí (Gnome.executePass/
  // Units.removeUnit avisan vía recordPass/recordDeath).
  _passes: { player: 0, enemy: 0 },
  _deaths: { player: 0, enemy: 0 },

  recordPass(team) {
    if (this._passes[team] != null) this._passes[team]++;
  },

  recordDeath(team) {
    if (this._deaths[team] != null) this._deaths[team]++;
  },

  // Se llama junto a Villages.init/Glory.init (newgame-flow.js) — mismo
  // patrón que esos dos: guarda qué raza pinta cada equipo.
  init(playerRaceId, enemyRaceId) {
    this._raceIds = { player: playerRaceId, enemy: enemyRaceId };
    this.gameOver = false;
    this._initMouseTracking();
  },

  resetAll() {
    this.closeRecruitPopup();
    this.closeAbilitiesPopup();
    this._hideGameOverOverlay();
    this._cancelPlacementMode();
    this.list.forEach((o) => o.el.remove());
    this.list = [];
    this._selectedId = null;
    this._targetedIds = [];
    this.gameOver = false;
    this._passes = { player: 0, enemy: 0 };
    this._deaths = { player: 0, enemy: 0 };
  },

  at(row, col) {
    return this.list.find((o) => o.row === row && o.col === col) || null;
  },

  byTeam(team) {
    return this.list.find((o) => o.team === team) || null;
  },

  spriteFor(raceId) {
    return OBELISK_SPRITES[raceId] || OBELISK_SPRITES.mushboom_forest;
  },

  // "iniciado en 3, +1 por cada totem capturado" — se recalcula siempre en
  // vivo a partir de Villages.ownedCount (nunca se "descuenta" nada al
  // perder un tótem: si baja, simplemente deja de sumar, ver cabecera).
  populationFor(team) {
    const owned = typeof Villages !== "undefined" ? Villages.ownedCount(team) : 0;
    return OBELISK_BASE_POPULATION + owned;
  },

  // Población EN USO ahora mismo — con el roster inicial vacío (pedido
  // explícito: "cada equipo empieza sin ninguna unidad reclutada"), toda
  // unidad de `team` sobre el tablero es, por definición, una reclutada
  // desde su Obelisco, así que basta con contar Units.list.
  recruitedCountFor(team) {
    return typeof Units !== "undefined" ? Units.list.filter((u) => u.team === team).length : 0;
  },

  // Coloca los DOS Obeliscos: el del jugador cerca del centro del mapa (la
  // loseta libre más próxima al centro exacto, buscando en espiral igual
  // que Gnome.spawnNear) y el del rival tan lejos de él como sea posible
  // (mismo espíritu "relaja la exigencia poco a poco" que Shops.spawn).
  spawn(size, playerRaceId, enemyRaceId) {
    const mid = Math.floor(size / 2);
    const playerSpot = this._findFreeTileNear(mid, mid, size);
    if (playerSpot) this._create("player", playerSpot.row, playerSpot.col, playerRaceId);

    let targetDist = Math.max(2, Math.floor(size / 2));
    let attempts = 0;
    let enemySpot = null;
    while (!enemySpot && attempts < 800) {
      attempts++;
      if (attempts % 200 === 0) targetDist = Math.max(1, targetDist - 1);
      const row = Math.floor(Math.random() * size);
      const col = Math.floor(Math.random() * size);
      const playerObelisk = this.byTeam("player");
      const dist = playerObelisk
        ? Math.max(Math.abs(row - playerObelisk.row), Math.abs(col - playerObelisk.col))
        : Math.max(Math.abs(row - mid), Math.abs(col - mid));
      if (dist < targetDist) continue;
      if (!this._tileFree(row, col)) continue;
      enemySpot = { row, col };
    }
    if (!enemySpot) enemySpot = this._findFreeTileNear(size - 1 - mid, size - 1 - mid, size);
    if (enemySpot) this._create("enemy", enemySpot.row, enemySpot.col, enemyRaceId);
  },

  _tileFree(row, col) {
    if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) return false;
    if (typeof Units !== "undefined" && Units.unitAt(row, col)) return false;
    if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) return false;
    if (typeof Villages !== "undefined" && Villages.at(row, col)) return false;
    if (typeof Shops !== "undefined" && Shops.at(row, col)) return false;
    if (this.at(row, col)) return false;
    return true;
  },

  // Espiral saliente desde (row, col) hasta encontrar la primera loseta
  // libre — mismo patrón que GnomeInstance.spawnNear (gnome.js).
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

  _create(team, row, col, raceId) {
    // Reutiliza "unit" solo por el posicionamiento base, igual que
    // Villages/Shops — nunca entra en Units.list.
    const el = document.createElement("div");
    el.className = `unit obelisk obelisk--${team}`;

    const spriteEl = document.createElement("img");
    spriteEl.className = "obelisk__sprite";
    spriteEl.src = this.spriteFor(raceId);
    spriteEl.alt = "";
    spriteEl.draggable = false;
    el.appendChild(spriteEl);
    if (typeof Shadows !== "undefined") Shadows.attach(spriteEl);

    // Pedido explícito: "si hago clic en la parte baja del obelisco,
    // deberia dejarme seleccionarlo. se hace transparente cuando hay un
    // personaje/enemigo detras y no me deja hacerlo. pueden coexistir
    // ambas cosas?" — .obelisk--occluding pone pointer-events:none en TODO
    // el .obelisk para que los clics atraviesen hasta la unidad escondida
    // (ver esa regla en style.css), pero eso también bloqueaba clicar el
    // propio obelisco por su base, que casi nunca tapa a nadie (la unidad
    // se esconde detrás de la parte ALTA/tallada, no de la peana). Esta
    // franja invisible cubre solo el tramo inferior del sprite, por
    // encima de él en z-index, con pointer-events:auto explícito — un
    // valor propio en un hijo siempre gana al "none" heredado del
    // contenedor (ver .obelisk__base-hit en style.css), así que sigue
    // pudiendo pulsarse (y el clic sigue burbujeando hasta el listener de
    // `el` de más abajo, sin tocarlo) aunque el resto del obelisco esté
    // atravesándose por la transparencia.
    const baseHitEl = document.createElement("div");
    baseHitEl.className = "obelisk__base-hit";
    el.appendChild(baseHitEl);

    // Barra de vida — mismas piezas que Units.updateHpBar espera, 30
    // segmentos (VILLAGE_MAX_HP tenía 10; el marco/segmentos se encogen por
    // CSS para que quepan sin desbordar, ver .obelisk .unit__hpbar).
    const hpBarEl = document.createElement("div");
    hpBarEl.className = "unit__hpbar obelisk__hpbar";
    const hpSegmentEls = [];
    for (let i = 0; i < OBELISK_MAX_HP; i++) {
      const seg = document.createElement("div");
      seg.className = "unit__hpbar-segment";
      hpBarEl.appendChild(seg);
      hpSegmentEls.push(seg);
    }
    el.appendChild(hpBarEl);

    // Indicador de población — SOLO existe/se pinta para el equipo "player"
    // (pedido explícito: "solo lo ve su propio jugador"); el del rival ni
    // siquiera se crea, así nunca hay riesgo de que un cambio de CSS futuro
    // lo deje visible sin querer.
    let popEl = null;
    if (team === "player") {
      popEl = document.createElement("div");
      popEl.className = "obelisk__pop-badge";
      el.appendChild(popEl);
    }

    // Los dos iconos de menú (reclutar/habilidades) — "aparecen arriba del
    // obelisco al seleccionarlo, desaparecen al deseleccionar" (pedido
    // explícito); viven siempre en el DOM, su visibilidad la decide
    // "obelisk--selected" en el propio `el` (ver CSS), nunca se crean/
    // destruyen en cada clic.
    const menuEl = document.createElement("div");
    menuEl.className = "obelisk__menu";

    const recruitBtn = document.createElement("button");
    recruitBtn.className = "obelisk__menu-btn obelisk__menu-btn--recruit";
    recruitBtn.setAttribute("aria-label", "Reclutar");
    recruitBtn.innerHTML = `<img src="${OBELISK_MENU_ICONS.recruit}" class="obelisk__menu-icon" alt="">`;
    recruitBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openRecruitPopup(obelisk);
    });
    menuEl.appendChild(recruitBtn);

    const abilitiesBtn = document.createElement("button");
    abilitiesBtn.className = "obelisk__menu-btn obelisk__menu-btn--abilities";
    abilitiesBtn.setAttribute("aria-label", "Habilidades");
    abilitiesBtn.innerHTML = `<img src="${OBELISK_MENU_ICONS.abilities}" class="obelisk__menu-icon" alt="">`;
    abilitiesBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openAbilitiesPopup(obelisk);
    });
    menuEl.appendChild(abilitiesBtn);

    el.appendChild(menuEl);

    // Clic sobre el propio sprite: ataca directamente si está marcado como
    // objetivo (mismo patrón que Villages._create), o si no, y es el dueño
    // en su propio turno, abre/cierra su menú — sin exigir ninguna unidad
    // adyacente (a propósito: un equipo con 0 unidades en juego tiene que
    // poder reclutar la primera desde cero, ver cabecera del archivo).
    el.addEventListener("click", (e) => {
      if (el.classList.contains("obelisk--targeted") && typeof Units !== "undefined" && Units.selectedId) {
        e.stopPropagation();
        const attacker = Units.list.find((u) => u.id === Units.selectedId);
        if (attacker) this.approachAndAttack(attacker, obelisk);
        return;
      }
      if (this.gameOver) return;
      if (obelisk.team !== "player") return; // solo se "abre" el propio, nunca el del rival
      if (typeof Turns !== "undefined" && Turns.activeTeam !== obelisk.team) return;
      e.stopPropagation();
      this.toggleSelect(obelisk);
    });

    if (typeof Units !== "undefined") Units.container.appendChild(el);

    const obelisk = {
      id: `obelisk-${this._nextId++}`,
      team,
      raceId,
      row,
      col,
      hp: OBELISK_MAX_HP,
      maxHp: OBELISK_MAX_HP,
      el,
      spriteEl,
      hpBarEl,
      hpSegmentEls,
      popEl,
      menuEl,
    };
    this._placeInstant(obelisk);
    if (typeof Units !== "undefined") Units.updateHpBar(obelisk);
    this.list.push(obelisk);
    this._refreshEmptyPulse(obelisk);
    this._refreshPopBadge(obelisk);
    return obelisk;
  },

  _placeInstant(obelisk) {
    if (typeof getTileCenter === "undefined" || typeof Units === "undefined") return;
    const { x, y } = getTileCenter(obelisk.row, obelisk.col, Units.boardSize);
    obelisk.el.style.left = `${x}px`;
    obelisk.el.style.top = `${y}px`;
    obelisk.el.style.zIndex = String((obelisk.row + obelisk.col) * 10 + 5);
  },

  // ---------- Ocultar personajes propios/rivales escondidos detrás de un
  // Obelisco (mismo mecanismo que Villages.refreshOcclusion, js/villages.js
  // — pedido explícito: "cuando un personaje esta detras de un obelisco,
  // este debe hacerse transparente al igual que ocurre con los totems").
  // Los tótems ya funcionan para AMBOS equipos, no solo el propio (ver la
  // nota "v3" en Villages.refreshOcclusion: cualquier unidad ya VISIBLE
  // cuenta, sea aliada o rival, para poder interactuar con ella igual —
  // seleccionarla o atacarla) — aquí se replica exactamente ese mismo
  // criterio, sin distinción de equipo. ----------
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
    // de ellos" — este mecanismo dependía SOLO de "mousemove", que un
    // móvil nunca dispara al tocar (no hay "ratón sobrevolando"). Antes
    // colaba porque, sin ningún listener de touchstart registrado, iOS/
    // Android generan eventos de ratón "de compatibilidad" tras cada
    // toque — pero el arreglo del doble-toque (ver el touchstart vacío en
    // index.html) cambió esa heurística y esos eventos sintéticos dejaron
    // de llegar. Arreglo: alimentar refreshOcclusion también con las
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

  refreshOcclusion(mouseX, mouseY) {
    if (typeof Units === "undefined") return;
    const mx = typeof mouseX === "number" ? mouseX : this._lastMouseX;
    const my = typeof mouseY === "number" ? mouseY : this._lastMouseY;
    this.list.forEach((obelisk) => {
      if (!obelisk.spriteEl) return;
      if (obelisk.el.classList.contains("unit--fog-hidden") || mx === null || my === null) {
        obelisk.el.classList.remove("obelisk--occluding");
        return;
      }
      const behindUnit = Units.list.find(
        (unit) =>
          unit.row === obelisk.row - 1 &&
          unit.col === obelisk.col - 1 &&
          unit.el &&
          !unit.el.classList.contains("unit--fog-hidden")
      );
      let occluding = false;
      if (behindUnit) {
        const oRect = obelisk.spriteEl.getBoundingClientRect();
        const uRect = behindUnit.el.getBoundingClientRect();
        const mouseOverObelisk = mx >= oRect.left && mx <= oRect.right && my >= oRect.top && my <= oRect.bottom;
        const mouseOverUnit = mx >= uRect.left && mx <= uRect.right && my >= uRect.top && my <= uRect.bottom;
        occluding = mouseOverObelisk || mouseOverUnit;
      }
      obelisk.el.classList.toggle("obelisk--occluding", occluding);
    });
  },

  // ---------- Selección propia (menú reclutar/habilidades) ----------

  toggleSelect(obelisk) {
    if (this._selectedId === obelisk.id) {
      this.deselect();
      return;
    }
    this.select(obelisk);
  },

  select(obelisk) {
    this.deselect();
    if (typeof Units !== "undefined") Units.deselect();
    SFX.click();
    this._selectedId = obelisk.id;
    obelisk.el.classList.add("obelisk--selected");
    this._refreshPopBadge(obelisk);
  },

  deselect() {
    if (!this._selectedId) return;
    const prev = this.list.find((o) => o.id === this._selectedId);
    if (prev) prev.el.classList.remove("obelisk--selected");
    this._selectedId = null;
  },

  // ---------- Población / pulso de "obelisco vacío" ----------
  // Se llama tras cualquier cambio que pueda afectar a alguno de los dos: un
  // reclutamiento, una baja (ver el hook en Units.removeUnit), perder/ganar
  // un tótem (Villages._capture ya avisa a Glory; aquí basta con refrescar
  // en cada inicio de turno, ver onTurnStart más abajo) o al arrancar la
  // partida.
  refreshAll() {
    this.list.forEach((o) => {
      this._refreshEmptyPulse(o);
      this._refreshPopBadge(o);
    });
  },

  // "el obelisco debe palpitar cuando su equipo tiene 0 unidades reclutadas
  // en juego" — feedback visual nivel Triple A del proyecto (mismo espíritu
  // que end-turn-btn--ready), para que un equipo recién eliminado de
  // unidades sepa de un vistazo que le urge reclutar.
  _refreshEmptyPulse(obelisk) {
    const empty = this.recruitedCountFor(obelisk.team) === 0;
    obelisk.el.classList.toggle("obelisk--empty", empty);
  },

  _refreshPopBadge(obelisk) {
    if (!obelisk.popEl) return; // solo existe para "player" (ver _create)
    const used = this.recruitedCountFor(obelisk.team);
    const max = this.populationFor(obelisk.team);
    obelisk.popEl.textContent = `${used} / ${max}`;
  },

  // Pedido explícito: "cuando un jugador cualquiera captura o pierde un
  // totem, automaticamente deben actualizarse todos los marcadores de
  // poblacion de los obeliscos" — lo llama Villages._capture cada vez que
  // un tótem cambia de dueño (conquistado o destruido), para los DOS
  // obeliscos a la vez; _refreshPopBadge ya no hace nada si el obelisco no
  // tiene badge propio (el rival, ver cabecera de ese método), así que
  // recorrer this.list entero es seguro sin comprobación extra.
  refreshAllPopBadges() {
    this.list.forEach((o) => this._refreshPopBadge(o));
  },

  // ---------- Proveedor de rango (mira de ataque) ----------
  // Igual que Villages.showFor, pero SIN exigir llevar un gnomo cogido —
  // cualquier unidad puede atacar un Obelisco rival con un golpe normal.
  showFor(unit) {
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    this.list.forEach((obelisk, i) => {
      if (obelisk.team === unit.team) return;
      if (typeof Fog !== "undefined" && Fog.isFogged(obelisk.row, obelisk.col)) return;
      const approach = this.findApproachTile(unit, obelisk);
      if (!approach) return;
      // Pedido explícito: "eso son dos acciones" — mismo criterio que
      // Combat.attackableEnemies/Villages.showFor.
      const needsMove = approach.row !== unit.row || approach.col !== unit.col;
      if (needsMove && typeof Turns !== "undefined" && Turns.remainingActions(unit) < 2) return;
      Units.addMarker({
        className: "attack-marker obelisk-attack-marker",
        row: obelisk.row,
        col: obelisk.col,
        zOffset: 2,
        delayIndex: i,
        visibleClass: "attack-marker--visible",
        owner: "obelisks",
        onClick: () => this.approachAndAttack(unit, obelisk),
        buildContent: (marker) => {
          const icon = document.createElement("i");
          icon.className = "ph ph-crosshair-simple attack-marker__icon";
          marker.appendChild(icon);
        },
      });

      const dist = Math.max(Math.abs(obelisk.row - unit.row), Math.abs(obelisk.col - unit.col));
      if (dist <= OBELISK_ATTACK_RANGE) {
        obelisk.el.classList.add("obelisk--targeted");
        this._targetedIds.push(obelisk.id);
      }
    });
  },

  onClear() {
    this._targetedIds.forEach((id) => {
      const obelisk = this.list.find((o) => o.id === id);
      if (obelisk) obelisk.el.classList.remove("obelisk--targeted");
    });
    this._targetedIds = [];
  },

  // Igual que Villages.findApproachTile/Shops.findApproachTile.
  findApproachTile(unit, obelisk) {
    const type = UNIT_TYPES[unit.typeId];
    const moveRange = type.movimiento;

    const distToObelisk = (row, col) =>
      Math.max(Math.abs(row - obelisk.row), Math.abs(col - obelisk.col));

    if (distToObelisk(unit.row, unit.col) <= OBELISK_ATTACK_RANGE) {
      return { row: unit.row, col: unit.col };
    }

    let best = null;
    let bestDist = Infinity;
    for (let row = 0; row < Units.boardSize; row++) {
      for (let col = 0; col < Units.boardSize; col++) {
        if (row === unit.row && col === unit.col) continue;
        if (distToObelisk(row, col) > OBELISK_ATTACK_RANGE) continue;
        if (Units.unitAt(row, col)) continue;
        if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) continue;
        if (this.at(row, col)) continue;
        if (typeof Villages !== "undefined" && Villages.at(row, col)) continue;
        if (typeof Shops !== "undefined" && Shops.at(row, col)) continue;
        if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) continue;
        const moveDist = Math.max(Math.abs(row - unit.row), Math.abs(col - unit.col));
        if (moveDist > moveRange) continue;
        if (!Units.pathIsWalkable(unit.row, unit.col, row, col)) continue;
        if (moveDist < bestDist) {
          bestDist = moveDist;
          best = { row, col };
        }
      }
    }
    return best;
  },

  async approachAndAttack(unit, obelisk) {
    if (this.gameOver) return;
    Units.clearRangeOverlays();
    const approach = this.findApproachTile(unit, obelisk);
    if (!approach) return;
    if (approach.row !== unit.row || approach.col !== unit.col) {
      // Pedido explícito: "eso son dos acciones" — ver la misma nota en
      // Combat.approachAndAttack.
      if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
      const path = Units.stepPath(unit.row, unit.col, approach.row, approach.col);
      await Units.walkPath(unit, path);
      if (typeof Turns !== "undefined") Turns.useAction(unit);
      if (typeof Fog !== "undefined" && unit.team === "player") Fog.revealForUnit(unit);
    }
    await this.attack(unit, obelisk);
  },

  // Igual que Combat.attack pero contra un Obelisco: por defecto daño =
  // FUERZA del atacante (un Obelisco no exige llevar un gnomo cogido para
  // golpearlo, a diferencia de un tótem, ver cabecera). Reutiliza el mismo
  // salto épico que un tótem (Villages._playEpicSmash) para no duplicar la
  // animación.
  //
  // Pedido explícito: "no se puede atacar, se tiene que descontar sus
  // puntos de vida como ocurre con los tótems, machacando el gnomo" —
  // _playEpicSmash ya destruye CUALQUIER gnomo que lleve encima quien
  // ataca, sea contra un tótem o un Obelisco (busca por unit.id sin
  // distinguir el objetivo, ver esa función en villages.js). Sin este
  // cambio, un portador que atacaba un Obelisco perdía su gnomo igualmente
  // pero solo a cambio de su fuerza — en vez del valor que llevaba
  // acumulado, como sí ocurre correctamente contra un tótem. Ahora, si
  // quien ataca lleva un gnomo cogido, el daño pasa a ser sus PUNTOS
  // acumulados (igual que Villages.attack); sin gnomo cogido, sigue siendo
  // la fuerza del atacante, como siempre.
  async attack(unit, obelisk) {
    if (this.gameOver) return;
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    if (obelisk.team === unit.team) return;

    Units.clearRangeOverlays();
    Units.faceTowardsTile(unit, obelisk.row, obelisk.col);

    const carriedGnome = typeof Gnome !== "undefined" ? Gnome.list.find((g) => g.heldBy === unit.id) : null;
    const damage = carriedGnome ? carriedGnome.points : UNIT_TYPES[unit.typeId].fuerza;
    const wasFullHp = obelisk.hp >= obelisk.maxHp;
    obelisk.hp = Math.max(0, obelisk.hp - damage);
    const oneHitKill = wasFullHp && obelisk.hp <= 0;

    if (typeof Turns !== "undefined") Turns.useAction(unit);
    if (oneHitKill && unit.el) unit.el.classList.remove("unit--exhausted");

    await Villages._playEpicSmash(unit, obelisk, damage, oneHitKill);

    if (oneHitKill && typeof Turns !== "undefined") Turns.refreshExhaustedClass(unit);

    if (obelisk.hp <= 0) {
      await this._destroy(obelisk);
    } else {
      Units.refreshRange(unit);
    }
  },

  // El Obelisco llega a 0: ese equipo queda eliminado de la partida —
  // pedido explícito. Se quita del tablero con el mismo "destello" que
  // Villages/Shops reutilizan (Villages._flashScreen ya sonó dentro de
  // _playEpicSmash si fue un golpe mortal de un solo tiro) y se comprueba
  // si con esto ya solo queda un equipo en pie.
  async _destroy(obelisk) {
    obelisk.el.classList.add("obelisk--destroyed");
    if (typeof SFX !== "undefined") SFX.death();
    await new Promise((resolve) => setTimeout(resolve, 420));
    obelisk.el.remove();
    this.list = this.list.filter((o) => o.id !== obelisk.id);
    this._checkWinLose();
  },

  // Con el motor actual estrictamente a 2 bandos ("player"/"enemy", ver
  // cabecera de turns.js) basta con mirar si queda solo un Obelisco en pie:
  // ese equipo es el ganador. Escrito para poder crecer el día que haya más
  // de 2 equipos (cuenta cuántos siguen vivos, no asume "el otro" a ciegas).
  _checkWinLose() {
    if (this.gameOver) return;
    const alive = ["player", "enemy"].filter((team) => this.byTeam(team));
    if (alive.length <= 1) {
      this._endGame(alive[0] || null);
    }
  },

  _endGame(winnerTeam, reason) {
    this.gameOver = true;
    this.closeRecruitPopup();
    this.closeAbilitiesPopup();
    this._cancelPlacementMode();
    if (typeof Units !== "undefined") Units.deselect();
    if (typeof Turns !== "undefined") Turns.hideButton();
    this._showGameOverOverlay(winnerTeam, reason || "destroyed");
  },

  // Pedido explícito: "de momento habran un maximo de 30 turnos por
  // partida...cuando acaben los turnos el equipo con mas vida en su
  // obelisco gana la partida, en caso de empate se tendran en cuenta
  // tambien el numero de totems conquistados y en caso de empate, la vida
  // de los mismos" — se llama desde Turns.endTurn justo después de subir
  // roundNumber (ver turns.js); si ninguno de los 3 criterios desempata de
  // verdad, es un EMPATE de verdad (winnerTeam = null, ver _showGameOverOverlay).
  checkTurnLimit(roundNumber) {
    if (this.gameOver) return;
    if (roundNumber <= TURNS_MAX_ROUNDS) return;

    const hpOf = (team) => {
      const o = this.byTeam(team);
      return o ? o.hp : 0;
    };
    const totemsOf = (team) => (typeof Villages !== "undefined" ? Villages.ownedCount(team) : 0);
    const totemHpOf = (team) =>
      typeof Villages !== "undefined"
        ? Villages.list.filter((v) => v.owner === team).reduce((sum, v) => sum + v.hp, 0)
        : 0;

    let winner = null;
    const hpDiff = hpOf("player") - hpOf("enemy");
    if (hpDiff > 0) winner = "player";
    else if (hpDiff < 0) winner = "enemy";
    else {
      const totemDiff = totemsOf("player") - totemsOf("enemy");
      if (totemDiff > 0) winner = "player";
      else if (totemDiff < 0) winner = "enemy";
      else {
        const totemHpDiff = totemHpOf("player") - totemHpOf("enemy");
        if (totemHpDiff > 0) winner = "player";
        else if (totemHpDiff < 0) winner = "enemy";
        // si sigue empatado en los 3 criterios, winner se queda en null: empate de verdad
      }
    }
    this._endGame(winner, "turnLimit");
  },

  // Tabla comparativa (pedido explícito: "un popup...resumiendo los datos
  // mas relevantes de la partida comparando un equipo con el otro. (ejemplo:
  // TOTEMS CAPTURADOS, NUMERO DE PASES, MUERTES...ETC)") — se muestra en
  // CUALQUIER final de partida, no solo por límite de turnos, así el
  // jugador siempre ve el mismo resumen sea cual sea el motivo.
  _statsRowsHtml() {
    const rows = [
      ["Vida del Obelisco", (t) => `${Math.max(0, this.byTeam(t)?.hp ?? 0)} / ${OBELISK_MAX_HP}`],
      ["Totems capturados", (t) => (typeof Villages !== "undefined" ? Villages.ownedCount(t) : 0)],
      ["Unidades reclutadas", (t) => this.recruitedCountFor(t)],
      ["Pases de gnomo logrados", (t) => this._passes[t] || 0],
      ["Bajas sufridas", (t) => this._deaths[t] || 0],
    ];
    return rows
      .map(
        ([label, fn]) => `
        <div class="obelisk-gameover-stats__row">
          <span class="obelisk-gameover-stats__value obelisk-gameover-stats__value--player">${fn("player")}</span>
          <span class="obelisk-gameover-stats__label">${label}</span>
          <span class="obelisk-gameover-stats__value obelisk-gameover-stats__value--enemy">${fn("enemy")}</span>
        </div>`
      )
      .join("");
  },

  // Pantalla central de fin de partida — mismo lenguaje visual que
  // .start-error-banner (banderín .p5-banner grande) pero a pantalla
  // completa (bloquea cualquier clic sobre el tablero con su propio fondo,
  // ver CSS), con un único botón para volver al menú principal.
  _showGameOverOverlay(winnerTeam, reason) {
    if (this._gameOverEl) this._gameOverEl.remove();

    const won = winnerTeam === "player";
    const draw = winnerTeam == null;
    const variantClass = draw ? "obelisk-gameover-panel--draw" : won ? "obelisk-gameover-panel--win" : "obelisk-gameover-panel--lose";
    const icon = draw ? "ph-scales" : won ? "ph-trophy" : "ph-skull";
    const title = draw ? "EMPATE" : won ? "¡VICTORIA!" : "DERROTA";
    let msg;
    if (reason === "turnLimit") {
      msg = draw
        ? "Se acabaron los 30 turnos y todo sigue exactamente igualado."
        : "Se acabaron los 30 turnos — gana quien más resistió.";
    } else {
      msg = won ? "Has destruido el Obelisco Ancestral rival." : "Tu Obelisco Ancestral ha sido destruido.";
    }

    const overlay = document.createElement("div");
    overlay.className = "obelisk-gameover-overlay";
    overlay.innerHTML = `
      <div class="p5-banner obelisk-gameover-panel ${variantClass}">
        <i class="ph ${icon} obelisk-gameover-panel__icon"></i>
        <div class="p5-banner__label obelisk-gameover-panel__title">${title}</div>
        <div class="obelisk-gameover-panel__msg">${msg}</div>
        <div class="obelisk-gameover-stats">
          <div class="obelisk-gameover-stats__row obelisk-gameover-stats__row--header">
            <span class="obelisk-gameover-stats__value obelisk-gameover-stats__value--player">TÚ</span>
            <span class="obelisk-gameover-stats__label"></span>
            <span class="obelisk-gameover-stats__value obelisk-gameover-stats__value--enemy">RIVAL</span>
          </div>
          ${this._statsRowsHtml()}
        </div>
        <button type="button" class="p5-banner p5-banner--action obelisk-gameover-panel__btn">
          <span class="p5-banner__label">VOLVER AL MENÚ</span>
        </button>
      </div>
    `;
    overlay.querySelector(".obelisk-gameover-panel__btn").addEventListener("click", () => {
      this._hideGameOverOverlay();
      if (typeof Glory !== "undefined") Glory.hideHud();
      if (typeof SettingsMenu !== "undefined") SettingsMenu.hideButton();
      if (typeof Backpack !== "undefined") Backpack.hideButton();
      if (typeof showScreen === "function") showScreen("main-menu");
      if (typeof screenHistory !== "undefined") {
        screenHistory.length = 0;
        screenHistory.push("main-menu");
      }
    });
    document.body.appendChild(overlay);
    this._gameOverEl = overlay;
    requestAnimationFrame(() => overlay.classList.add("obelisk-gameover-overlay--visible"));
  },

  _hideGameOverOverlay() {
    if (!this._gameOverEl) return;
    const el = this._gameOverEl;
    this._gameOverEl = null;
    el.remove();
  },

  // ---------- Popup de reclutar (mismas clases .backpack-* que Shops) ----------

  openRecruitPopup(obelisk) {
    if (this.gameOver || this._overlayEl) return;
    if (typeof Turns !== "undefined" && Turns.activeTeam !== obelisk.team) return;
    SFX.click();
    this._activeRecruitObelisk = obelisk;
    this._selectedTypeId = null;

    const overlay = document.createElement("div");
    overlay.className = "backpack-overlay";
    overlay.addEventListener("click", () => this.closeRecruitPopup());

    const panel = document.createElement("div");
    panel.className = "backpack-panel";
    panel.addEventListener("click", (e) => e.stopPropagation());

    const panelBg = document.createElement("div");
    panelBg.className = "p5-banner backpack-panel__bg";
    panel.appendChild(panelBg);

    const closeBtn = document.createElement("button");
    closeBtn.className = "backpack-close-btn";
    closeBtn.setAttribute("aria-label", "Cerrar");
    closeBtn.innerHTML = '<i class="ph ph-x backpack-close-btn__icon"></i>';
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.closeRecruitPopup();
    });
    panel.appendChild(closeBtn);

    const title = document.createElement("div");
    title.className = "p5-banner__label backpack-panel__title";
    title.textContent = "RECLUTAR";
    panelBg.appendChild(title);

    const slots = document.createElement("div");
    // Pedido explícito: "La interfaz de reclutar debe ajustar el ancho
    // total del numero de unidades al del texbox donde se muestra la
    // descripcion...si decidimos añadir una nueva se ajustara
    // automaticamente tambien" — a diferencia de la mochila/tienda (rejilla
    // fija de 4 columnas, con huecos vacíos de relleno), aquí NUNCA hay
    // huecos vacíos (un hueco por unidad de la raza, ver _renderRecruitSlots
    // más abajo), así que un modificador propio (ver .backpack-slots--recruit
    // en style.css) cambia a auto-fit: siempre reparte el ancho disponible
    // (el mismo que .backpack-desc, ambos hijos directos de .backpack-panel__bg
    // con align-items:stretch) entre las columnas que hagan falta, ni una
    // fila a medias ni límite fijo si el roster crece.
    slots.className = "backpack-slots backpack-slots--recruit";
    panelBg.appendChild(slots);
    this._slotsEl = slots;

    const desc = document.createElement("div");
    desc.className = "backpack-desc";
    desc.innerHTML = '<p class="backpack-desc__text"></p>';
    panelBg.appendChild(desc);
    this._descEl = desc.querySelector(".backpack-desc__text");

    const recruitBtn = document.createElement("button");
    recruitBtn.className = "p5-banner p5-banner--action shop-buy-btn";
    recruitBtn.innerHTML = '<span class="p5-banner__label">RECLUTAR</span>';
    recruitBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._confirmRecruit();
    });
    panelBg.appendChild(recruitBtn);
    this._recruitBtnEl = recruitBtn;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    this._overlayEl = overlay;

    this._renderRecruitSlots();
    requestAnimationFrame(() => overlay.classList.add("backpack-overlay--visible"));
  },

  closeRecruitPopup() {
    if (!this._overlayEl) return;
    const el = this._overlayEl;
    this._overlayEl = null;
    this._slotsEl = null;
    this._descEl = null;
    this._recruitBtnEl = null;
    this._activeRecruitObelisk = null;
    this._selectedTypeId = null;
    el.classList.remove("backpack-overlay--visible");
    setTimeout(() => el.remove(), 220);
  },

  // Un hueco por tipo de unidad de la raza de este Obelisco — a diferencia
  // de Shops (existencias limitadas que se agotan), aquí siempre hay las
  // mismas opciones disponibles, solo cambia si se puede pagar/hay sitio.
  _renderRecruitSlots() {
    if (!this._slotsEl || !this._activeRecruitObelisk) return;
    const obelisk = this._activeRecruitObelisk;
    const roster = Object.keys(UNIT_TYPES).filter((typeId) => UNIT_TYPES[typeId].raceId === obelisk.raceId);
    this._slotsEl.innerHTML = "";
    roster.forEach((typeId) => {
      const def = UNIT_TYPES[typeId];
      const price = Units.recruitPriceFor(typeId);
      const slotEl = document.createElement("button");
      slotEl.className = "backpack-slot";
      slotEl.innerHTML =
        `<img src="${def.spriteUrl}" class="backpack-slot__icon" alt="${def.name}">` +
        `<span class="shop-slot__price"><span class="shop-slot__price__num">${price}</span></span>`;
      slotEl.classList.toggle("backpack-slot--selected", typeId === this._selectedTypeId);
      slotEl.addEventListener("click", (e) => {
        e.stopPropagation();
        this._onRecruitSlotClick(typeId);
      });
      this._slotsEl.appendChild(slotEl);
    });
    this._updateRecruitDescAndButton();
  },

  _onRecruitSlotClick(typeId) {
    SFX.click();
    this._selectedTypeId = this._selectedTypeId === typeId ? null : typeId;
    this._renderRecruitSlots();
  },

  _updateRecruitDescAndButton() {
    if (!this._descEl || !this._activeRecruitObelisk) return;
    const obelisk = this._activeRecruitObelisk;
    const typeId = this._selectedTypeId;
    const def = typeId ? UNIT_TYPES[typeId] : null;
    const price = typeId ? Units.recruitPriceFor(typeId) : 0;

    if (def) {
      // Pedido explícito: "el texto de la descripcion...no habla sobre las
      // habilidades de los personajes ni nada...le falta 'chicha'" — antes
      // solo mostraba las estadísticas en crudo. Ahora reutiliza el mismo
      // texto de sabor que ya existe para el popup de información
      // (UNIT_DESCRIPTIONS, js/unitinfo.js) y añade el nombre de la
      // habilidad especial (ABILITIES, js/abilities.js) cuando la tiene, así
      // sí se habla de verdad de sus habilidades antes de reclutarlo.
      const flavor = typeof UNIT_DESCRIPTIONS !== "undefined" ? UNIT_DESCRIPTIONS[typeId] : null;
      const ability = typeof ABILITIES !== "undefined" ? ABILITIES[typeId] : null;
      this._descEl.innerHTML =
        `<strong>${def.name}</strong><br>` +
        (flavor ? `${flavor}<br>` : "") +
        (ability ? `<em class="recruit-desc__ability">Habilidad especial: ${ability.name}</em><br>` : "") +
        `<span class="recruit-desc__stats">Aguante ${def.aguante} · Movimiento ${def.movimiento} · Fuerza ${def.fuerza} · Agilidad ${def.agilidad} · Percepción ${def.percepcion}</span>` +
        `<br><strong class="shop-desc__price-line">Reclutar cuesta ${price} puntos de gloria.</strong>`;
    } else {
      this._descEl.textContent = "";
    }

    if (this._recruitBtnEl) {
      const points = typeof Glory !== "undefined" ? Glory.points[obelisk.team] : 0;
      const canAfford = !!def && points >= price;
      const used = this.recruitedCountFor(obelisk.team);
      const max = this.populationFor(obelisk.team);
      const hasRoom = used < max;
      this._recruitBtnEl.disabled = !def || !canAfford || !hasRoom;
      if (!def) this._recruitBtnEl.title = "";
      else if (!hasRoom) this._recruitBtnEl.title = "Población al límite";
      else if (!canAfford) this._recruitBtnEl.title = "No tienes suficientes Puntos de Gloria";
      else this._recruitBtnEl.title = "";
    }
  },

  // Confirma la elección y pasa al modo "elegir casilla adyacente" — el
  // Glory/población todavía no se gastan aquí (pueden cambiar mientras el
  // jugador elige dónde colocar la unidad si algo más ocurre entre medias),
  // se comprueban y descuentan de verdad al hacer clic en la loseta elegida
  // (ver _spawnRecruit más abajo).
  _confirmRecruit() {
    const obelisk = this._activeRecruitObelisk;
    const typeId = this._selectedTypeId;
    if (!obelisk || !typeId || !this._recruitBtnEl || this._recruitBtnEl.disabled) return;
    const price = Units.recruitPriceFor(typeId);
    this.closeRecruitPopup();
    this._startPlacementMode(obelisk, typeId, price);
  },

  // ---------- Modo "elegir casilla adyacente" para la unidad reclutada ----------

  _startPlacementMode(obelisk, typeId, price) {
    this._cancelPlacementMode();
    this._pendingRecruit = { obelisk, typeId, price };
    if (typeof UiHint !== "undefined") UiHint.show("Elige una casilla para colocar tu nueva unidad");
    const tiles = this._adjacentFreeTiles(obelisk);
    tiles.forEach((tile, i) => {
      const marker = Units.addMarker({
        className: "range-marker obelisk-placement-marker",
        row: tile.row,
        col: tile.col,
        zOffset: 2,
        alwaysOnTop: true,
        delayIndex: i,
        visibleClass: "range-marker--visible",
        onClick: () => this._spawnRecruit(tile.row, tile.col),
      });
      this._placementMarkers.push(marker);
    });
  },

  _cancelPlacementMode() {
    this._placementMarkers.forEach((m) => m.remove());
    this._placementMarkers = [];
    this._pendingRecruit = null;
    if (typeof UiHint !== "undefined") UiHint.hide();
  },

  _adjacentFreeTiles(obelisk) {
    const tiles = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const row = obelisk.row + dr;
        const col = obelisk.col + dc;
        if (row < 0 || col < 0 || row >= Units.boardSize || col >= Units.boardSize) continue;
        if (!this._tileFree(row, col)) continue;
        tiles.push({ row, col });
      }
    }
    return tiles;
  },

  _spawnRecruit(row, col) {
    const pending = this._pendingRecruit;
    if (!pending) return;
    const { obelisk, typeId, price } = pending;
    // Se reconfirma todo justo antes de gastar nada (pudo cambiar mientras
    // el jugador elegía casilla: otra unidad murió/nació, se gastó gloria
    // en la tienda, etc.) — mismo criterio defensivo que el resto del
    // proyecto (ver Combat.attack, Villages.approachAndAttack).
    const points = typeof Glory !== "undefined" ? Glory.points[obelisk.team] : 0;
    const used = this.recruitedCountFor(obelisk.team);
    const max = this.populationFor(obelisk.team);
    if (points < price || used >= max || !this._tileFree(row, col)) {
      this._cancelPlacementMode();
      return;
    }

    if (typeof Glory !== "undefined") Glory.spend(obelisk.team, price);
    const unit = Units.spawnUnit({ typeId, row, col, team: obelisk.team });
    // "solo tiene 1 accion en su primer turno en juego" — se deja ya
    // gastada 1 de las TURNS_MAX_ACTIONS (2) de este turno; Turns
    // ._resetTeamActions la devolverá a las 2 normales en su PRÓXIMO turno,
    // sin que este archivo necesite saber nada de esa mecánica.
    if (typeof Turns !== "undefined") {
      Turns.actionsUsed[unit.id] = 1;
      Turns.refreshExhaustedClass(unit);
    }
    SFX.captureVillage();
    this._cancelPlacementMode();
    this.refreshAll();
  },

  // ---------- Popup de habilidades (placeholder) ----------
  // "este ultimo lo definiremos mas adelante" — pedido explícito: de momento
  // solo un aviso de "Próximamente", mismo lenguaje visual que el resto de
  // popups (.p5-banner) pero sin ninguna interacción real todavía.
  openAbilitiesPopup(obelisk) {
    if (this.gameOver || this._abilitiesOverlayEl) return;
    if (typeof Turns !== "undefined" && Turns.activeTeam !== obelisk.team) return;
    SFX.click();

    const overlay = document.createElement("div");
    overlay.className = "backpack-overlay";
    overlay.addEventListener("click", () => this.closeAbilitiesPopup());

    const panel = document.createElement("div");
    panel.className = "backpack-panel obelisk-abilities-panel";
    panel.addEventListener("click", (e) => e.stopPropagation());

    const panelBg = document.createElement("div");
    panelBg.className = "p5-banner backpack-panel__bg";
    panel.appendChild(panelBg);

    const closeBtn = document.createElement("button");
    closeBtn.className = "backpack-close-btn";
    closeBtn.setAttribute("aria-label", "Cerrar");
    closeBtn.innerHTML = '<i class="ph ph-x backpack-close-btn__icon"></i>';
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.closeAbilitiesPopup();
    });
    panel.appendChild(closeBtn);

    const title = document.createElement("div");
    title.className = "p5-banner__label backpack-panel__title";
    title.textContent = "HABILIDADES";
    panelBg.appendChild(title);

    const msg = document.createElement("div");
    msg.className = "obelisk-abilities-panel__soon";
    msg.innerHTML = '<i class="ph ph-hourglass-simple"></i><span>Próximamente</span>';
    panelBg.appendChild(msg);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    this._abilitiesOverlayEl = overlay;
    requestAnimationFrame(() => overlay.classList.add("backpack-overlay--visible"));
  },

  closeAbilitiesPopup() {
    if (!this._abilitiesOverlayEl) return;
    const el = this._abilitiesOverlayEl;
    this._abilitiesOverlayEl = null;
    el.classList.remove("backpack-overlay--visible");
    setTimeout(() => el.remove(), 220);
  },

  // ---------- IA rival: auto-reclutar de forma simple ----------
  // Pedido implícito (sin esto la IA rival, ahora sin roster inicial,
  // jamás pondría una sola unidad en juego): en cada inicio de SU turno, si
  // tiene sitio y puntos, recluta al azar UN tipo de unidad que pueda
  // pagar, en una loseta adyacente libre al azar — deliberadamente simple,
  // mismo espíritu que Turns._aiActOnce ("con el tiempo definiremos una IA
  // más compleja").
  onTurnStart(team) {
    if (this.gameOver || team !== "enemy") return;
    const obelisk = this.byTeam("enemy");
    if (!obelisk) return;
    const used = this.recruitedCountFor("enemy");
    const max = this.populationFor("enemy");
    if (used >= max) return;
    const points = typeof Glory !== "undefined" ? Glory.points.enemy : 0;
    const roster = Object.keys(UNIT_TYPES).filter((typeId) => UNIT_TYPES[typeId].raceId === obelisk.raceId);
    const affordable = roster.filter((typeId) => Units.recruitPriceFor(typeId) <= points);
    if (affordable.length === 0) return;
    const typeId = affordable[Math.floor(Math.random() * affordable.length)];
    const tiles = this._adjacentFreeTiles(obelisk);
    if (tiles.length === 0) return;
    const tile = tiles[Math.floor(Math.random() * tiles.length)];
    const price = Units.recruitPriceFor(typeId);

    if (typeof Glory !== "undefined") Glory.spend("enemy", price);
    const unit = Units.spawnUnit({ typeId, row: tile.row, col: tile.col, team: "enemy" });
    if (typeof Turns !== "undefined") {
      Turns.actionsUsed[unit.id] = 1;
      Turns.refreshExhaustedClass(unit);
    }
    this.refreshAll();
  },
};

Units.registerRangeProvider(Obelisks);
if (typeof Turns !== "undefined") Turns.registerTurnStartListener(Obelisks);

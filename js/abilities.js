/* Gnomore Gnomes — habilidades especiales de personaje, un solo uso por
   partida (pedido explícito: "vayamos a darles habilidades exclusivas de un
   solo uso... la diferencia es que si el personaje lo consume, este
   desaparece" — el ICONO de la habilidad desaparece para siempre en cuanto
   se activa, nunca vuelve a estar disponible esa misma partida).
   Regla de oro: un archivo por mecánica. Este archivo sabe:
     - Qué habilidad tiene cada tipo de personaje (ABILITIES) y su icono/
       descripción, mostrados también en el popup de estadísticas (ver
       js/unitinfo.js).
     - El botón fijo de "usar habilidad" (mismo patrón que Gnome._hitBtn/
       _passBtn, colocado con UI_LAYOUT en vez de números sueltos) que
       aparece cuando la unidad seleccionada tiene una habilidad sin gastar
       y todavía puede actuar.
     - Cada habilidad en sí — ver cada bloque más abajo, uno por personaje.

   Se registra como "oyente de selección" (Units.registerSelectionListener,
   igual que js/unitinfo.js) en vez de "proveedor de rango"
   (Units.registerRangeProvider, como movement.js/combat.js): una habilidad
   no pinta losetas alcanzables sobre el tablero, es un botón fijo aparte,
   igual que golpear/pasar el gnomo. */

const ABILITIES = {
  hombre_arbol: {
    name: "Golem de Espinas",
    icon: "ph-shield",
    // Icono real (pedido explícito: "tambien tienes adjunto los iconos para
    // las habilidades de todos los personajes") — `icon` (Phosphor) se deja
    // como respaldo, ver _ensureButton/_refreshButton más abajo y
    // js/unitinfo.js, que usan iconImg si existe y si no caen a `icon`.
    iconImg: "assets/iconos/golem_espinas.png",
    description:
      "Se cura hasta su vida máxima de base y se envuelve de espinas para el resto de la partida: a partir de ahora, cualquiera que lo golpee se hace 1 punto de daño a sí mismo. Gasta 1 acción. Un solo uso por partida.",
  },
  surcabosques: {
    name: "Visión Lejana",
    icon: "ph-eye",
    iconImg: "assets/iconos/vision_lejana.png",
    description:
      "Revela una zona cualquiera del mapa (3 casillas alrededor del punto elegido), esté donde esté. Tras activarla, el cursor se convierte en un ojo: el siguiente clic sobre el mapa la usa ahí mismo. Gasta 1 acción. Un solo uso por partida.",
  },
  seta_artificiero: {
    name: "Hongo Trampa",
    icon: "ph-bomb",
    iconImg: "assets/iconos/hongo_trampa.png",
    description:
      "Coloca una seta-trampa invisible para el enemigo en una casilla adyacente libre. Si una unidad enemiga la pisa, explota: le quita 1 punto de vida y la deja inactiva hasta su siguiente turno. Gasta 1 acción. Un solo uso por partida.",
  },
  urgamentes: {
    name: "Voluntad Quebrada",
    icon: "ph-brain",
    iconImg: "assets/iconos/voluntad_quebrada.png",
    description:
      "Toma el control total de un personaje enemigo adyacente durante el resto de este turno: se puede mover, atacar, coger/golpear/pasar su gnomo o incluso usar su propia habilidad, como si fuera propio. Gasta 1 acción. Un solo uso por partida.",
  },
  punoroca: {
    name: "Nudillos Rocosos",
    icon: "ph-hand-fist",
    // Icono real recibido en esta pasada (antes solo llegaron 5 de los 6 —
    // ver el resto de comentarios "iconImg" de este archivo).
    iconImg: "assets/iconos/nudillos_rocosos.png",
    description:
      "Golpea y empuja 4 casillas en línea recta a un enemigo adyacente (se detiene en el primer obstáculo); el golpeado queda agotado el siguiente turno. Gasta 1 acción. Un solo uso por partida. PuñoRroca es tan bruto que, si no tiene un aliado (cualquiera) justo al lado nada más empezar a andar, da tumbos al azar en vez de ir donde se le indica.",
  },
  goblin_lanzador: {
    name: "Resorte Goblin",
    icon: "ph-hand-grabbing",
    iconImg: "assets/iconos/resorte_goblin.png",
    description:
      "Agarra a un personaje adyacente (amigo o enemigo, incluso si lleva el gnomo cogido) y lo lanza a cualquier casilla libre dentro de su propia área de movimiento. Gasta 1 acción. Un solo uso por partida.",
  },
};

const Abilities = {
  _btn: null,
  _iconEl: null,
  _currentUnit: null,

  // ---------- Selección (Units.registerSelectionListener) ----------

  onSelect(unit) {
    this._currentUnit = unit;
    this._refreshButton();
  },

  onDeselect() {
    this._currentUnit = null;
    this._cancelTargeting();
    this._cancelUnitPicking();
    this._hideButton();
  },

  // Turns.js llama aquí cada vez que cambian las acciones de CUALQUIER
  // unidad (ver _applyExhaustedClass) — así el botón aparece/desaparece
  // solo si afecta a la unidad seleccionada ahora mismo, sin que cada
  // mecánica tenga que acordarse de avisar por separado.
  refresh() {
    this._refreshButton();
  },

  // ---------- Botón fijo "usar habilidad" ----------

  _ensureButton() {
    if (this._btn) return;
    const btn = document.createElement("button");
    btn.className = "ability-btn";
    // Icono real (imagen) cuando la habilidad tiene uno (ver ABILITIES
    // arriba); el Phosphor <i> se queda siempre en el DOM como respaldo
    // (p.ej. Nudillos Rocosos, que no tiene iconImg) — _refreshButton
    // decide cuál de los dos se ve.
    btn.innerHTML =
      '<i class="ph ability-btn__icon"></i><img class="ability-btn__icon-img" alt="" draggable="false">';
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._activate();
    });
    document.body.appendChild(btn);
    this._btn = btn;
    this._iconEl = btn.querySelector(".ability-btn__icon");
    this._iconImgEl = btn.querySelector(".ability-btn__icon-img");
    this._positionButton();
    // Pedido explícito: "en la interfaz de navegador de escritorio al
    // colocar el raton y dejarlo quieto...sobre cualquier habilidad de un
    // personaje, debe aparecer al lado del puntero un texto con el nombre
    // de esa habilidad" — se lee dinámicamente del aria-label ya calculado
    // en _refreshButton (siempre al día, sin duplicar el nombre aquí).
    if (typeof Tooltip !== "undefined") {
      Tooltip.attach(btn, () => (btn.getAttribute("aria-label") || "").replace(/^Usar habilidad: /, ""));
    }
  },

  // Colocado con su propio ángulo en UI_LAYOUT.abilityButton (js/uiconfig.js)
  // — más arriba que golpear/pasar el gnomo (esos usan UI_LAYOUT.actionButtons,
  // siempre a la derecha del círculo de información), así nunca compiten
  // por el mismo hueco aunque un personaje lleve el gnomo cogido Y tenga
  // además una habilidad sin gastar a la vez.
  _positionButton() {
    const info = window.innerWidth <= 480 ? UI_LAYOUT.infoCircleMobile : UI_LAYOUT.infoCircle;
    const layout = UI_LAYOUT.abilityButton;
    const centerX = info.left + info.size / 2;
    const centerY = info.bottom + info.size / 2;
    const rad = (layout.angle * Math.PI) / 180;
    const bx = centerX + layout.radius * Math.cos(rad);
    const by = centerY - layout.radius * Math.sin(rad);
    this._btn.style.left = `${bx - layout.size / 2}px`;
    this._btn.style.bottom = `${by - layout.size / 2}px`;
    this._btn.style.width = `${layout.size}px`;
    this._btn.style.height = `${layout.size}px`;
  },

  _refreshButton() {
    const unit = this._currentUnit;
    const ability = unit ? ABILITIES[unit.typeId] : null;
    const canShow =
      unit &&
      ability &&
      !unit.abilityUsed &&
      unit.team === "player" &&
      (typeof Turns === "undefined" || Turns.canAct(unit));
    if (!canShow) {
      this._hideButton();
      return;
    }
    this._ensureButton();
    // Pedido explícito: "el icono...de la habilidad vision de la
    // surcabosques un poquito mas grande y de color azul turquesa" — se
    // identifica el botón con la habilidad concreta que muestra ahora mismo
    // (data-ability) para poder afinar SOLO ese icono por CSS sin tocar el
    // resto (ver .ability-btn[data-ability="surcabosques"] en style.css).
    this._btn.dataset.ability = unit.typeId;
    // Imagen real si la habilidad tiene una (ver ABILITIES); si no, se queda
    // con el icono Phosphor de siempre (p.ej. Nudillos Rocosos).
    if (ability.iconImg) {
      this._iconImgEl.src = ability.iconImg;
      this._iconImgEl.classList.add("ability-btn__icon-img--visible");
      this._iconEl.className = "ability-btn__icon";
    } else {
      this._iconImgEl.classList.remove("ability-btn__icon-img--visible");
      this._iconImgEl.removeAttribute("src");
      this._iconEl.className = `ph ${ability.icon} ability-btn__icon`;
    }
    this._btn.setAttribute("aria-label", `Usar habilidad: ${ability.name}`);
    this._btn.classList.add("ability-btn--visible");
  },

  _hideButton() {
    if (this._btn) this._btn.classList.remove("ability-btn--visible");
  },

  // Gasta la acción y marca la habilidad como usada PARA SIEMPRE (pedido
  // explícito) — el único sitio que hace esto de verdad, cada habilidad de
  // abajo lo llama justo cuando su efecto YA se ha confirmado (nunca si el
  // jugador cancela algo a medio camino, ver _cancelTargeting).
  _consume(unit) {
    unit.abilityUsed = true;
    if (typeof Turns !== "undefined") Turns.useAction(unit);
    this._refreshButton();
  },

  _activate() {
    const unit = this._currentUnit;
    if (!unit || unit.abilityUsed) return;
    if (!ABILITIES[unit.typeId]) return;
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;

    switch (unit.typeId) {
      case "hombre_arbol":
        this._activateThorns(unit);
        break;
      case "surcabosques":
        this._startVisionTargeting(unit);
        break;
      case "seta_artificiero":
        this._activateMine(unit);
        break;
      case "urgamentes":
        this._activateMindControl(unit);
        break;
      case "punoroca":
        this._activateKnockback(unit);
        break;
      case "goblin_lanzador":
        this._activateThrow(unit);
        break;
      default:
        break;
    }
  },

  // ---------- GolemCorteza: Golem de Espinas ----------
  // "el golem se envuelve de espinas, se cura hasta su vida maxima de base,
  // si un enemigo le golpea se hace un punto de daño a si mismo tambien"
  // (pedido explícito, reemplaza a la antigua Corteza Milenaria) — a
  // diferencia de la anterior, esto NO caduca solo al empezar su siguiente
  // turno: unit.thorny se queda a true el resto de la partida en cuanto se
  // activa (ver combat.js, target.thorny, que es quien de verdad aplica el
  // punto de daño reflejado cada vez que le golpean).

  _activateThorns(unit) {
    const type = UNIT_TYPES[unit.typeId];
    unit.hp = type.aguante;
    unit.maxHp = type.aguante;
    Units.updateHpBar(unit);
    unit.thorny = true;
    unit.el.classList.add("unit--thorny");

    // Pedido explícito: "el sprite de la transformacion del golemcorteza a
    // golem de espinas, ahora no hace falta que se vuelva de color gris,
    // solo cambia el sprite, pero anima el personaje cuando se transforme
    // para que quede epico" — sustituye el sprite normal por el de Golem de
    // Espinas (sin ningún recolor CSS) y reutiliza el MISMO lenguaje visual
    // de "impacto grande" que ya usa Villages._playEpicSmash/
    // Abilities._playExplosionFeedback (temblor de cámara + destello blanco
    // + mensaje grande), en vez de inventar un tercer sistema de feedback
    // épico por separado.
    if (type.espinasUrl) unit.spriteEl.src = type.espinasUrl;
    const viewportEl = document.getElementById("board-viewport");
    if (viewportEl) {
      viewportEl.classList.remove("board-viewport--shake");
      void viewportEl.offsetWidth;
      viewportEl.classList.add("board-viewport--shake");
      setTimeout(() => viewportEl.classList.remove("board-viewport--shake"), 420);
    }
    this._flashScreen();
    // Pop de escala/brillo de un solo uso sobre el propio sprite (mismo
    // patrón toggle-de-clase que .unit__flip--turning, ver css/style.css) —
    // vive separado del resplandor permanente de .unit--thorny, que no debe
    // tocarse aquí.
    unit.el.classList.remove("unit--transforming");
    void unit.spriteEl.offsetWidth;
    unit.el.classList.add("unit--transforming");
    setTimeout(() => unit.el.classList.remove("unit--transforming"), 650);

    SFX.glory();
    Units.playShake(unit);
    Units.spawnFloatingText(unit, "¡ESPINAS!", { className: "dmg-popup gnome-points-popup" });
    this._consume(unit);
  },

  // ---------- SurcaBosques: Visión Lejana ----------
  // Modo de apuntado con cursor propio (ojo) — un clic en cualquier punto
  // del mapa revela 3 casillas alrededor. Pedido explícito: un clic sobre
  // CUALQUIER elemento de interfaz fija (icono de cara, otro botón de
  // habilidad, otra unidad propia, cualquier icono) cancela el apuntado SIN
  // gastar la habilidad — se puede volver a intentar después.

  _startVisionTargeting(unit) {
    if (this._targetingUnit) return; // ya hay un apuntado en marcha
    this._targetingUnit = unit;
    // Pedido explícito: "cuando se da a elegir casillas para habilidades,
    // las de movimiento se ocultan, esto ocurre para todos" — el radio de
    // movimiento/ataque normal de la unidad (Movement/Combat/Gnome/
    // Villages/Shops, todos vía registerRangeProvider) se queda pintado
    // por debajo del cursor-ojo si no se limpia aquí, y confunde con el
    // punto que de verdad se va a revelar. Se restaura en _cancelTargeting
    // si se cancela, y tras usarla con éxito en _onVisionClick (la unidad
    // sigue seleccionada, puede que le quede la otra acción).
    Units.clearRangeOverlays();
    document.body.classList.add("ability-targeting--eye");
    if (typeof UiHint !== "undefined") UiHint.show("Elige un punto del mapa para revelarlo");
    // capture:true para interceptar el clic ANTES que cualquier otro
    // listener del tablero (seleccionar/deseleccionar unidades, marcadores,
    // clic-en-vacío...) — mientras se apunta, ningún otro sistema debe
    // reaccionar a ese clic.
    this._visionClickHandler = (e) => this._onVisionClick(e);
    window.addEventListener("click", this._visionClickHandler, { capture: true });
  },

  _cancelTargeting() {
    if (!this._targetingUnit) return;
    const unit = this._targetingUnit;
    this._targetingUnit = null;
    document.body.classList.remove("ability-targeting--eye");
    if (typeof UiHint !== "undefined") UiHint.hide();
    if (this._visionClickHandler) {
      window.removeEventListener("click", this._visionClickHandler, { capture: true });
      this._visionClickHandler = null;
    }
    // Se canceló sin gastar la habilidad (ver nota de cabecera de esta
    // sección) — devuelve el radio de movimiento normal que se ocultó al
    // empezar a apuntar, o la unidad se queda sin ningún círculo hasta que
    // se deselecciona y se vuelve a seleccionar.
    this._restoreNormalRange(unit);
  },

  _onVisionClick(e) {
    const isOwnUnit = e.target.closest(".unit--player");
    const isFixedUi = e.target.closest(
      ".unit-info-btn, .ability-btn, .gnome-action-btn, .end-turn-btn, .settings-gear-btn, .backpack-btn, .backpack-close-btn, .glory-counter, .unit-info-overlay, .settings-panel"
    );
    if (isOwnUnit || isFixedUi) {
      // "se quita el uso de la habilidad pero no se ha gastado, por lo que
      // se puede usar de nuevo" — cancela sin más, el botón sigue ahí.
      e.preventDefault();
      e.stopPropagation();
      this._cancelTargeting();
      return;
    }

    const viewportEl = document.getElementById("board-viewport");
    if (!viewportEl || !viewportEl.contains(e.target)) return; // clic fuera del tablero del todo, se ignora sin cancelar (deja seguir arrastrando/apuntando)
    e.preventDefault();
    e.stopPropagation();

    const unit = this._targetingUnit;
    this._cancelTargeting();
    if (!unit || unit.abilityUsed) return;

    const rect = viewportEl.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const { x: contentX, y: contentY } = BoardView.clientToContent(cx, cy);
    const { row, col } = getTileFromPoint(contentX, contentY, Units.boardSize);

    if (typeof Fog !== "undefined") Fog.revealAround(row, col, 3);
    SFX.click();
    Units.spawnFloatingText(unit, "¡VISIÓN!", { className: "dmg-popup gnome-points-popup" });
    this._consume(unit);
    // La unidad sigue seleccionada tras usarla (puede que le quede la otra
    // acción) — vuelve a mostrar su radio normal, oculto al empezar a
    // apuntar (ver _startVisionTargeting).
    this._restoreNormalRange(unit);
  },

  // Devuelve el radio de movimiento/ataque normal (Movement/Combat/Gnome/
  // Villages/Shops) que cualquier modo de apuntado de habilidad oculta al
  // empezar (pedido explícito: "cuando se da a elegir casillas para
  // habilidades, las de movimiento se ocultan, esto ocurre para todos") —
  // solo si esa unidad sigue siendo la seleccionada ahora mismo (pudo
  // deseleccionarse sola mientras tanto, p.ej. al gastar su última acción).
  _restoreNormalRange(unit) {
    if (unit && unit.el && Units.selectedId === unit.id) Units.refreshRange(unit);
  },

  // ---------- TruenoEspora: seta-trampa ----------
  // "coloca una seta explosiva invisible para los enemigos...si un enemigo
  // la pisa, EXPLOTA, resta un punto de vida y deja el jugador enemigo
  // inactivo hasta el siguiente turno" — se dispara desde Units.hopTo (ver
  // checkTrigger más abajo), el único punto de paso real de cualquier
  // desplazamiento del proyecto.
  //
  // ACTUALIZADO — pedido explícito: "la seta bomba...debe dejar colocarla
  // en una casilla adyacente a el a eleccion del jugador" — antes se
  // colocaba sola en la primera casilla libre que encontraba; ahora pinta
  // una mira en CADA casilla adyacente libre (mismo patrón que los
  // círculos de destino de Lanzamiento, ver _startThrowDestination) y
  // espera un clic. Cancelar sigue siendo gratis: un clic en vacío
  // deselecciona a TruenoEspora (ver units.js) y eso ya limpia estos
  // marcadores solo, vía Units.clearRangeOverlays.

  _mines: [], // { row, col, ownerTeam, el }

  _activateMine(unit) {
    const tiles = this._adjacentFreeTiles(unit);
    if (tiles.length === 0) return; // no queda ninguna casilla libre alrededor, no se gasta la habilidad
    this._startMinePlacement(unit, tiles);
  },

  _adjacentFreeTiles(unit) {
    const offsets = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    const tiles = [];
    for (const [dr, dc] of offsets) {
      const r = unit.row + dr;
      const c = unit.col + dc;
      if (r < 0 || c < 0 || r >= Units.boardSize || c >= Units.boardSize) continue;
      if (Units.unitAt(r, c)) continue;
      if (typeof Gnome !== "undefined" && Gnome.isAt(r, c)) continue;
      if (typeof Villages !== "undefined" && Villages.at(r, c)) continue;
      if (typeof Shops !== "undefined" && Shops.at(r, c)) continue;
      if (typeof Obelisks !== "undefined" && Obelisks.at(r, c)) continue; // Obelisco Ancestral (js/obelisks.js)
      if (this._mines.some((m) => m.row === r && m.col === c)) continue;
      if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(r, c)) continue;
      tiles.push({ row: r, col: c });
    }
    return tiles;
  },

  // Mismo patrón exacto que _startThrowDestination: marcadores de rango
  // reutilizados (Units.addMarker) sobre cada casilla válida, con un tinte
  // propio (rojizo, "trampa") para no confundirse con el radio normal de
  // movimiento ni con el dorado de Lanzamiento — ver .ability-mine-marker
  // en style.css.
  _startMinePlacement(unit, tiles) {
    Units.clearRangeOverlays();
    tiles.forEach((tile, i) => {
      Units.addMarker({
        className: "range-marker ability-mine-marker",
        row: tile.row,
        col: tile.col,
        zOffset: 2,
        alwaysOnTop: true,
        delayMs: Units.staggerDelay(i, tiles.length),
        visibleClass: "range-marker--visible",
        onClick: () => this._resolveMinePlacement(unit, tile.row, tile.col),
      });
    });
  },

  _resolveMinePlacement(unit, row, col) {
    Units.clearRangeOverlays();
    this._placeMineAt(unit, row, col);
    this._consume(unit);
    // La unidad sigue seleccionada tras colocar la mina (puede que le
    // quede la otra acción) — recupera su radio normal.
    this._restoreNormalRange(unit);
  },

  _placeMineAt(unit, row, col) {
    const el = document.createElement("div");
    el.className = "ability-mine";
    const img = document.createElement("img");
    img.className = "ability-mine__sprite";
    // Sprite real de la seta-trampa (pedido explícito, ya no hace falta el
    // tinte rojo provisional sobre Setarcoiris — ver css/style.css, donde se
    // ha quitado el filter de recolor).
    img.src = "assets/iconos/seta_trampa.png";
    img.alt = "";
    el.appendChild(img);
    Units.container.appendChild(el);
    const { x, y } = getTileCenter(row, col, Units.boardSize);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.zIndex = String((row + col) * 10 + 4);
    this._mines.push({ row, col, ownerTeam: unit.team, el });
    SFX.click();
  },

  // Llamado desde Units.hopTo (js/units.js) cada vez que CUALQUIER unidad
  // termina de pisar una casilla nueva — así movement.js/combat.js/gnome.js
  // no necesitan saber que las minas existen.
  checkTrigger(unit) {
    if (this._mines.length === 0) return;
    const idx = this._mines.findIndex(
      (m) => m.row === unit.row && m.col === unit.col && m.ownerTeam !== unit.team
    );
    if (idx === -1) return;
    const mine = this._mines[idx];
    this._mines.splice(idx, 1);
    mine.el.remove();

    // Feedback nivel Triple A (pedido explícito): "temblor de camara y la
    // pantalla blanca un instante y un mensaje para dar feedback de lo que
    // ha ocurrido" — mismo lenguaje visual que ya usa el golpe mortal a un
    // poblado (Villages._playEpicSmash: board-viewport--shake + destello
    // blanco global #epic-smash-flash + mensaje grande), reutilizado tal
    // cual (mismas clases CSS) en vez de inventar un segundo sistema de
    // "impacto grande" por separado.
    this._playExplosionFeedback(unit);

    unit.hp = Math.max(0, unit.hp - 1);
    Units.updateHpBar(unit);
    Units.spawnFloatingText(unit, "-1", { className: "dmg-popup" });
    Units.playShake(unit);
    if (typeof SFX !== "undefined") SFX.hit();
    // "deja el jugador enemigo inactivo hasta el siguiente turno" — mismo
    // mecanismo que Nudillos Rocosos (ver turns.js, _resetTeamActions):
    // no le quita las acciones que le quedaran YA, solo le fuerza a
    // empezar agotada su PRÓXIMA vez.
    unit.forcedRestNextTurn = true;

    if (unit.hp <= 0) {
      Units.removeUnit(unit);
      if (typeof Gnome !== "undefined") Gnome.dropHeldBy(unit);
    }
  },

  // Temblor de cámara + destello blanco + mensaje grande — se llama ANTES
  // de resolver el daño en sí, para que el jugador entienda de un vistazo
  // "algo grande acaba de explotar" antes de fijarse en el "-1" concreto.
  _playExplosionFeedback(unit) {
    const viewportEl = document.getElementById("board-viewport");
    if (viewportEl) {
      viewportEl.classList.remove("board-viewport--shake");
      void viewportEl.offsetWidth;
      viewportEl.classList.add("board-viewport--shake");
      setTimeout(() => viewportEl.classList.remove("board-viewport--shake"), 420);
    }
    this._flashScreen();
    if (typeof SFX !== "undefined") SFX.glory(); // mismo "impacto grande" que usa Villages para su golpe mortal
    Units.spawnFloatingText(unit, "¡BOOM!", { className: "dmg-popup gnome-points-popup" });
  },

  // Reutiliza el MISMO elemento global de destello blanco que ya crea
  // Villages._flashScreen (id="epic-smash-flash") en vez de crear uno
  // propio — si Villages lo creó primero se reusa tal cual, y si esta
  // habilidad se dispara antes, lo crea ella; cualquiera de los dos vale,
  // es un único destello de pantalla completa, no algo propio de cada
  // mecánica.
  _flashScreen() {
    let el = document.getElementById("epic-smash-flash");
    if (!el) {
      el = document.createElement("div");
      el.id = "epic-smash-flash";
      document.body.appendChild(el);
    }
    el.classList.remove("epic-smash-flash--active");
    void el.offsetWidth;
    el.classList.add("epic-smash-flash--active");
  },

  // ---------- UrgaMentes: Voluntad Quebrada ----------
  // Truco central: en vez de reimplementar "mover/atacar/coger el gnomo/
  // atacar un tótem" para una unidad ajena, se le cambia el team AL DEL
  // JUGADOR mientras dura el control — TODO lo demás (movement.js/
  // combat.js/gnome.js/villages.js/shops.js) ya gatea en unit.team==="player",
  // así que empieza a funcionar solo, sin tocar ni una línea de esos
  // archivos. Vuelve a su equipo original en Turns.endTurn (ver turns.js).

  _mindControlled: null, // { unitId, originalTeam }

  _activateMindControl(unit) {
    // Pedido explícito: "todas las habilidades deben dejar hacer esto"
    // (elegir objetivo cuando hay varios) — antes se tomaba siempre el
    // PRIMER rival adyacente encontrado (Units.list.find), sin dejar elegir.
    const isValidTarget = (u) =>
      u.team !== unit.team &&
      Math.max(Math.abs(u.row - unit.row), Math.abs(u.col - unit.col)) <= 1 &&
      (typeof Fog === "undefined" || !Fog.isFogged(u.row, u.col));
    const targets = Units.list.filter(isValidTarget);
    if (targets.length === 0) return; // no hay ningún rival adyacente visible, no se gasta la habilidad
    if (targets.length === 1) {
      this._resolveMindControl(unit, targets[0]);
    } else {
      this._startUnitPicking(unit, {
        cursorClass: "ability-targeting--mind",
        filter: isValidTarget,
        hint: "Elige a qué rival controlar",
        onPick: (target) => this._resolveMindControl(unit, target),
      });
    }
  },

  _resolveMindControl(unit, target) {
    this._mindControlled = { unitId: target.id, originalTeam: target.team };
    target.el.classList.remove(`unit--${target.team}`);
    target.team = unit.team;
    target.el.classList.add(`unit--${unit.team}`);
    target.el.classList.add("unit--mind-controlled");
    // Pedido explícito: "la habilidad del urgamentes maneja una unica
    // accion del enemigo, no dos...imagina que el enemigo tiene el
    // gnomo...el urgamentes se hacerca y le hace control mental. entonces
    // hace que el enemigo le pase el gnomo a uno del equipo amigo" — antes
    // se le daban las 2 acciones normales de un turno entero
    // (Turns.actionsUsed = 0); ahora se le deja solo con UNA disponible,
    // suficiente para una sola orden (mover, atacar, coger/golpear/pasar el
    // gnomo o su propia habilidad), marcándolo como si ya hubiera gastado
    // la primera de las dos.
    if (typeof Turns !== "undefined") {
      Turns.actionsUsed[target.id] = TURNS_MAX_ACTIONS - 1;
      Turns._applyExhaustedClass(target);
    }

    SFX.click();
    Units.spawnFloatingText(target, "¡CONTROLADO!", { className: "dmg-popup gnome-points-popup" });

    this._consume(unit);
    Units.deselect();
    Units.select(target);
  },

  // "durante el resto de este turno" — termina aquí, llamado desde
  // Turns.endTurn justo antes de que empiece el turno rival de verdad,
  // tanto si el jugador llegó a gastar sus 2 acciones como si no.
  releaseMindControl() {
    if (!this._mindControlled) return;
    const target = Units.list.find((u) => u.id === this._mindControlled.unitId);
    if (target) {
      const original = this._mindControlled.originalTeam;
      target.el.classList.remove(`unit--${target.team}`, "unit--mind-controlled");
      target.team = original;
      target.el.classList.add(`unit--${original}`);
      if (typeof Turns !== "undefined") {
        Turns.actionsUsed[target.id] = TURNS_MAX_ACTIONS;
        Turns._applyExhaustedClass(target);
      }
      if (Units.selectedId === target.id) Units.deselect();
    }
    this._mindControlled = null;
  },

  // ---------- PuñoRoca: Nudillos Rocosos ----------
  // Empuje a distancia FIJA (a diferencia de Combat.pushBack, que depende
  // de la diferencia de fuerza) — mismo patrón de pararse en el primer
  // obstáculo, ver Combat.pushBack para más detalle de por qué se hace
  // paso a paso en vez de en bloque.

  _activateKnockback(unit) {
    // Pedido explícito: "la habilidad especial de puño roca debe dejar
    // elegir al objetivo, si hay varios...todas las habilidades deben
    // dejar hacer esto en este caso en concreto" — antes se tomaba siempre
    // el PRIMER rival adyacente encontrado, sin dejar elegir.
    const isValidTarget = (u) =>
      u.team !== unit.team && Math.max(Math.abs(u.row - unit.row), Math.abs(u.col - unit.col)) <= 1;
    const targets = Units.list.filter(isValidTarget);
    if (targets.length === 0) return; // no hay ningún rival adyacente, no se gasta la habilidad
    if (targets.length === 1) {
      this._resolveKnockback(unit, targets[0]);
    } else {
      this._startUnitPicking(unit, {
        cursorClass: "ability-targeting--punch",
        filter: isValidTarget,
        hint: "Elige a qué rival golpear",
        onPick: (target) => this._resolveKnockback(unit, target),
      });
    }
  },

  async _resolveKnockback(unit, target) {
    Units.clearRangeOverlays();
    Units.faceTowardsTile(unit, target.row, target.col);
    this._consume(unit);
    // "el que queda agotado el siguiente turno no es puñorroca, si no al
    // que le pega" (pedido explícito, corrección) — el agotamiento recae
    // sobre el OBJETIVO golpeado, no sobre quien usa la habilidad. Mismo
    // mecanismo que la trampa de TruenoEspora (ver turns.js, _resetTeamActions).
    target.forcedRestNextTurn = true;

    if (unit.el) {
      unit.el.classList.remove("unit--punching");
      void unit.spriteEl.offsetWidth;
      unit.el.classList.add("unit--punching");
      setTimeout(() => unit.el.classList.remove("unit--punching"), 320);
    }
    Units.playShake(target);
    SFX.hit();

    await this._pushBackFixed(target, unit, 4);
    Units.refreshRange(unit);
  },

  async _pushBackFixed(target, attacker, distance) {
    const dRow = Math.sign(target.row - attacker.row);
    const dCol = Math.sign(target.col - attacker.col);
    if (dRow === 0 && dCol === 0) return;

    const path = [];
    let row = target.row;
    let col = target.col;
    for (let i = 0; i < distance; i++) {
      const nextRow = row + dRow;
      const nextCol = col + dCol;
      if (nextRow < 0 || nextCol < 0 || nextRow >= Units.boardSize || nextCol >= Units.boardSize) break;
      if (Units.unitAt(nextRow, nextCol)) break;
      if (typeof Gnome !== "undefined" && Gnome.isAt(nextRow, nextCol)) break;
      if (typeof Villages !== "undefined" && Villages.at(nextRow, nextCol)) break;
      if (typeof Shops !== "undefined" && Shops.at(nextRow, nextCol)) break;
      if (typeof Obelisks !== "undefined" && Obelisks.at(nextRow, nextCol)) break; // Obelisco Ancestral (js/obelisks.js)
      if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(nextRow, nextCol)) break;
      path.push({ row: nextRow, col: nextCol });
      row = nextRow;
      col = nextCol;
    }
    if (path.length === 0) return;

    target.el.classList.add("unit--moving");
    for (const step of path) {
      await new Promise((resolve) => {
        target.row = step.row;
        target.col = step.col;
        const { x, y } = getTileCenter(step.row, step.col, Units.boardSize);
        target.el.style.left = `${x}px`;
        target.el.style.top = `${y}px`;
        target.el.style.zIndex = String((step.row + step.col) * 10 + 5);
        target.spriteEl.classList.remove("unit__sprite--hop");
        void target.spriteEl.offsetWidth;
        target.spriteEl.classList.add("unit__sprite--hop");
        SFX.hop();
        setTimeout(resolve, 140);
      });
    }
    target.el.classList.remove("unit--moving");
    target.spriteEl.classList.remove("unit__sprite--hop");
    if (typeof Fog !== "undefined") Fog.applyVisibility();
  },

  // ---------- LanzaGnomos: Lanzamiento ----------
  // "puede lanzar un personaje adyacente amigo o enemigo a una casilla
  // dentro de su area de movimiento. incluyendo a un personaje con un
  // gnomo" (pedido explícito) — dos pasos: 1) elegir A QUIÉN se agarra
  // (automático si solo hay un adyacente, si no se pide un clic more) y 2)
  // elegir DÓNDE se lanza (círculos de rango, igual que un movimiento
  // normal, pero centrados en el propio LanzaGnomos, no en quien se lanza).
  // Un personaje con el gnomo cogido se puede lanzar sin más: el gnomo vive
  // como hijo DOM de unit.flipEl (ver GnomeInstance.attachTo, gnome.js), así
  // que viaja solo con él sin que esta habilidad tenga que saber que existe.

  _activateThrow(unit) {
    const isAdjacent = (u) => u.id !== unit.id && Math.max(Math.abs(u.row - unit.row), Math.abs(u.col - unit.col)) <= 1;
    const adjacent = Units.list.filter(isAdjacent);
    if (adjacent.length === 0) return; // no hay nadie al lado, no se gasta la habilidad
    if (adjacent.length === 1) {
      this._startThrowDestination(unit, adjacent[0]);
    } else {
      this._startUnitPicking(unit, {
        cursorClass: "ability-targeting--throw",
        filter: isAdjacent,
        hint: "Elige a quién lanzar",
        onPick: (target) => this._startThrowDestination(unit, target),
      });
    }
  },

  // ---------- Elegir A QUIÉN se aplica una habilidad, cuando hay más de un
  // objetivo posible ----------
  // Pedido explícito: "todas las habilidades deben dejar hacer esto" (elegir
  // el objetivo cuando hay varios) — antes solo Resorte Goblin (Lanzamiento)
  // lo hacía, con su propio código; ahora es un único mecanismo compartido
  // (mismo patrón que _startVisionTargeting: cursor propio + clic-en-
  // cualquier-parte con capture:true) parametrizado con un filtro (quién
  // cuenta como objetivo válido para ESA habilidad en concreto: cualquier
  // adyacente para Lanzamiento, solo rivales adyacentes para Nudillos
  // Rocosos/Voluntad Quebrada) y un callback (qué hacer con el objetivo
  // elegido). Mismas reglas de cancelado que Visión Lejana: un clic en
  // icono/UI fija o en una unidad que no cumple el filtro cancela sin
  // gastar la habilidad, se puede reintentar.
  _startUnitPicking(unit, { cursorClass, filter, onPick, hint }) {
    if (this._targetingUnit) return;
    this._targetingUnit = unit;
    // "cuando se da a elegir casillas para habilidades, las de movimiento
    // se ocultan, esto ocurre para todos" — aplica igual eligiendo una
    // UNIDAD objetivo, no solo una casilla: el radio normal confundiría con
    // quién se puede elegir.
    Units.clearRangeOverlays();
    document.body.classList.add(cursorClass);
    if (hint && typeof UiHint !== "undefined") UiHint.show(hint);
    this._pickCursorClass = cursorClass;
    this._pickHandler = (e) => this._onUnitPickClick(e, unit, filter, onPick);
    window.addEventListener("click", this._pickHandler, { capture: true });
    // Pedido explícito: "cuando se use una habilidad y esta este esperando
    // a que el usuario haga algo (por ejemplo: selecciona a un personaje)"
    // — resaltar las casillas/objetivos válidos. Un marcador puramente
    // visual (pointer-events:none, ver .ability-pick-marker en style.css)
    // bajo cada objetivo elegible ahora mismo; el clic en sí lo sigue
    // resolviendo _onUnitPickClick por delegación (arriba), este marcador
    // nunca lo intercepta.
    this._pickMarkerEls = Units.list.filter(filter).map((target) =>
      Units.addMarker({
        className: "ability-pick-marker",
        row: target.row,
        col: target.col,
        zOffset: 1,
        visibleClass: "ability-pick-marker--visible",
      })
    );
  },

  _cancelUnitPicking() {
    if (!this._pickHandler) return;
    const unit = this._targetingUnit;
    this._targetingUnit = null;
    if (this._pickCursorClass) document.body.classList.remove(this._pickCursorClass);
    this._pickCursorClass = null;
    if (typeof UiHint !== "undefined") UiHint.hide();
    window.removeEventListener("click", this._pickHandler, { capture: true });
    this._pickHandler = null;
    if (this._pickMarkerEls) {
      this._pickMarkerEls.forEach((m) => m.remove());
      this._pickMarkerEls = null;
    }
    this._restoreNormalRange(unit);
  },

  _onUnitPickClick(e, unit, filter, onPick) {
    const isFixedUi = e.target.closest(
      ".unit-info-btn, .ability-btn, .gnome-action-btn, .end-turn-btn, .settings-gear-btn, .backpack-btn, .backpack-close-btn, .glory-counter, .unit-info-overlay, .settings-panel"
    );
    const unitEl = e.target.closest(".unit");
    e.preventDefault();
    e.stopPropagation();
    this._cancelUnitPicking();
    if (isFixedUi || !unitEl) return; // cancela sin gastar, se puede reintentar

    // dataset.unitId solo lo llevan las unidades DE VERDAD (Units.spawnUnit)
    // — un tótem/tienda reutiliza la clase "unit" solo para su
    // posicionamiento (ver villages.js/shops.js) pero nunca vive en
    // Units.list, así que el find() de abajo ya los descarta solo.
    const target = Units.list.find((u) => u.id === unitEl.dataset.unitId);
    if (!target || !filter(target)) return;
    onPick(target);
  },

  // Círculos de destino (mismo estilo que Movement.showFor) dentro del
  // propio alcance de movimiento del LanzaGnomos, centrados en SU posición
  // (no en la de quien se lanza) — pedido explícito: "a una casilla dentro
  // de su area de movimiento".
  _startThrowDestination(goblin, thrown) {
    Units.clearRangeOverlays();
    const range = UNIT_TYPES[goblin.typeId].movimiento;
    const tiles = [];
    for (let row = 0; row < Units.boardSize; row++) {
      for (let col = 0; col < Units.boardSize; col++) {
        if (row === thrown.row && col === thrown.col) continue; // misma casilla, no tiene sentido lanzarlo ahí
        const dist = Math.max(Math.abs(row - goblin.row), Math.abs(col - goblin.col));
        if (dist > range) continue;
        if (Units.unitAt(row, col)) continue;
        if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) continue;
        if (typeof Villages !== "undefined" && Villages.at(row, col)) continue;
        if (typeof Shops !== "undefined" && Shops.at(row, col)) continue;
        if (typeof Obelisks !== "undefined" && Obelisks.at(row, col)) continue; // Obelisco Ancestral (js/obelisks.js)
        if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) continue;
        if (typeof Fog !== "undefined" && Fog.isFogged(row, col)) continue;
        tiles.push({ row, col });
      }
    }
    if (tiles.length === 0) return; // no hay ninguna casilla válida, no se gasta la habilidad

    if (typeof UiHint !== "undefined") UiHint.show("Elige dónde lanzarlo");
    tiles.forEach((tile, i) => {
      Units.addMarker({
        className: "range-marker ability-throw-marker",
        row: tile.row,
        col: tile.col,
        zOffset: 2,
        alwaysOnTop: true,
        delayMs: Units.staggerDelay(i, tiles.length),
        visibleClass: "range-marker--visible",
        onClick: () => this._resolveThrow(goblin, thrown, tile.row, tile.col),
      });
    });
    // Cancelar es gratis: un clic en vacío deselecciona al LanzaGnomos (ver
    // units.js) y eso ya limpia estos marcadores solo, vía
    // Units.clearRangeOverlays — no hace falta un cancelador aparte aquí.
  },

  async _resolveThrow(goblin, thrown, destRow, destCol) {
    Units.clearRangeOverlays();
    this._consume(goblin);
    await this._throwUnitTo(thrown, destRow, destCol);
  },

  // Vuelo en parábola (nivel Triple A: un lanzamiento no debería sentirse
  // como un simple teletransporte) — interpola left/top fotograma a
  // fotograma con un arco añadido encima, en vez de reutilizar
  // Units.walkPath (ese es para caminar casilla a casilla en línea recta,
  // esto es un único salto largo por el aire).
  async _throwUnitTo(unit, destRow, destCol) {
    const start = getTileCenter(unit.row, unit.col, Units.boardSize);
    const end = getTileCenter(destRow, destCol, Units.boardSize);
    unit.el.classList.add("unit--thrown");
    const DURATION_MS = 460;
    await new Promise((resolve) => {
      const t0 = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - t0) / DURATION_MS);
        const x = start.x + (end.x - start.x) * t;
        const y = start.y + (end.y - start.y) * t;
        const arc = -70 * 4 * t * (1 - t); // parábola, pico en t=0.5, negativo = hacia arriba en pantalla
        unit.el.style.left = `${x}px`;
        unit.el.style.top = `${y + arc}px`;
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });

    unit.row = destRow;
    unit.col = destCol;
    const { x, y } = getTileCenter(destRow, destCol, Units.boardSize);
    unit.el.style.left = `${x}px`;
    unit.el.style.top = `${y}px`;
    unit.el.style.zIndex = String((destRow + destCol) * 10 + 5);
    unit.el.classList.remove("unit--thrown");

    SFX.hop();
    Units.playShake(unit);
    // Trampa de TruenoEspora (ver checkTrigger arriba) — un lanzamiento
    // también puede hacer aterrizar a alguien justo encima de una mina.
    this.checkTrigger(unit);
    if (typeof Fog !== "undefined" && unit.team === "player") Fog.revealForUnit(unit);
    if (typeof Villages !== "undefined") Villages.refreshOcclusion();
    if (typeof Shops !== "undefined") Shops.refreshAll();
    Units.refreshRange(unit);
  },

  // ---------- Partida nueva ----------

  resetAll() {
    this._mines.forEach((m) => m.el.remove());
    this._mines = [];
    this._mindControlled = null;
    this._currentUnit = null;
    this._cancelTargeting();
    this._cancelUnitPicking();
    Units.clearRangeOverlays();
    this._hideButton();
  },
};

Units.registerSelectionListener(Abilities);

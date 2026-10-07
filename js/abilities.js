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
      "Se cura hasta su vida máxima de base y se envuelve de espinas hasta su próximo turno: mientras dure, cualquiera que lo golpee se hace 1 punto de daño a sí mismo. Gasta 1 acción. Un uso por partida: se recarga si empiezas el turno junto a un tótem propio.",
  },
  surcabosques: {
    name: "Visión Lejana",
    icon: "ph-eye",
    iconImg: "assets/iconos/vision_lejana.png",
    description:
      "Revela una zona cualquiera del mapa (3 casillas alrededor del punto elegido), esté donde esté. Tras activarla, el cursor se convierte en un ojo: el siguiente clic sobre el mapa la usa ahí mismo. Gasta 1 acción. Un uso por partida: se recarga si empiezas el turno junto a un tótem propio.",
  },
  seta_artificiero: {
    name: "Hongo Trampa",
    icon: "ph-bomb",
    iconImg: "assets/iconos/hongo_trampa.png",
    description:
      "Coloca una seta-trampa invisible para el enemigo en una casilla adyacente libre. Si una unidad enemiga la pisa, explota: le quita 1 punto de vida y la deja inactiva hasta su siguiente turno. Gasta 1 acción. Un uso por partida: se recarga si empiezas el turno junto a un tótem propio.",
  },
  urgamentes: {
    name: "Voluntad Quebrada",
    icon: "ph-brain",
    iconImg: "assets/iconos/voluntad_quebrada.png",
    description:
      "Toma el control total de una unidad enemiga adyacente durante el resto de este turno: se puede mover, atacar, coger/golpear/pasar su gnomo o incluso usar su propia habilidad, como si fuera propio. Gasta 1 acción. Un uso por partida: se recarga si empiezas el turno junto a un tótem propio.",
  },
  punoroca: {
    name: "Nudillos Rocosos",
    icon: "ph-hand-fist",
    // Icono real recibido en esta pasada (antes solo llegaron 5 de los 6 —
    // ver el resto de comentarios "iconImg" de este archivo).
    iconImg: "assets/iconos/nudillos_rocosos.png",
    description:
      "Golpea y empuja 4 casillas en línea recta a un enemigo adyacente (se detiene en el primer obstáculo); el golpeado queda agotado el siguiente turno. Gasta 1 acción. Un uso por partida: se recarga si empiezas el turno junto a un tótem propio. PuñoRroca es tan bruto que, si no tiene un aliado (cualquiera) justo al lado nada más empezar a andar, da tumbos al azar en vez de ir donde se le indica.",
  },
  goblin_lanzador: {
    name: "Resorte Goblin",
    icon: "ph-hand-grabbing",
    iconImg: "assets/iconos/resorte_goblin.png",
    description:
      "Agarra a una unidad adyacente (amiga o enemiga, incluso si lleva el gnomo cogido) y la lanza a cualquier casilla libre dentro de su propia área de movimiento, también al agua (quien no sea anfibio se ahoga). Gasta 1 acción. Un uso por partida: se recarga si empiezas el turno junto a un tótem propio.",
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
  // (pedido explícito, reemplaza a la antigua Corteza Milenaria) —
  // unit.thorny se pone a true en cuanto se activa (ver combat.js,
  // target.thorny, que es quien de verdad aplica el punto de daño
  // reflejado cada vez que le golpean) y caduca solo al llegar su PROPIO
  // siguiente turno (pedido explícito, segunda pasada: "la habilidad del
  // golem de espinas no es para toda la partida, si no hasta su proximo
  // turno") — ver onTurnStart más abajo, que es quien la revierte.

  _activateThorns(unit) {
    const type = UNIT_TYPES[unit.typeId];
    const bonus = typeof Armory !== "undefined" ? Armory.defenseBonus(unit.team) : 0;
    unit.hp = type.aguante + bonus + (unit.cohesionBonus || 0);
    unit.maxHp = type.aguante + bonus + (unit.cohesionBonus || 0);
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
    // Calidad de sprite dinámica (pedido explícito: "cada Sprite que entre
    // nuevo tendrá que adaptarse...como la resolución dinámica") — esto NO
    // es una pose momentánea (a diferencia de machaca/impacto en
    // Villages._playEpicSmash, que sí se dejan sin registrar a propósito):
    // el Golem se queda así hasta que caduque en onTurnStart, así que hace
    // falta re-registrar (no solo asignar .src) para que la textura de
    // reposo que recuerda SpriteQuality sea la de Espinas, no la vieja de
    // GolemCorteza — si no, el próximo cruce de zoom la devolvería sola al
    // sprite equivocado.
    if (type.espinasUrl) {
      if (typeof SpriteQuality !== "undefined") SpriteQuality.register(unit.spriteEl, type.espinasUrl);
      else unit.spriteEl.src = type.espinasUrl;
    }
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
    Units.spawnFloatingText(unit, "¡ESPINAS!", { className: "dmg-popup popup--good" });
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
      ".unit-info-btn, .ability-btn, .gnome-action-btn, .end-turn-btn, .settings-gear-btn, .backpack-btn, .backpack-close-btn, .glory-hud, .glory-popup-overlay, .unit-info-overlay, .settings-panel"
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

    if (typeof Fog !== "undefined") {
      Fog.revealAround(row, col, 3);
      // Pedido explícito: "la zona se revela sin niebla de guerra durante
      // 4 segundos, despues la niebla se apodera de la zona de nuevo" —
      // el terreno de revealAround, justo arriba, se queda revelado para
      // siempre (memoria, como el resto del proyecto); esto añade 4s de
      // percepción EN DIRECTO sobre esa misma zona, así que cualquier
      // rival que hubiera ahí se ve de verdad durante esa ventana, no solo
      // el paisaje vacío (ver la nota larga en Fog.addTemporaryPerception).
      Fog.addTemporaryPerception(row, col, 3, 4000);
    }
    // Pedido explícito: "vision lejana al usarse debe reproducir un
    // efecto de sonido agradable como de magia reveladora" — en vez del
    // click genérico de UI de antes.
    SFX.visionReveal();
    this._visionWave(row, col);
    Units.spawnFloatingText(unit, "¡VISIÓN!", { className: "dmg-popup popup--good" });
    this._consume(unit);
    // La unidad sigue seleccionada tras usarla (puede que le quede la otra
    // acción) — vuelve a mostrar su radio normal, oculto al empezar a
    // apuntar (ver _startVisionTargeting).
    this._restoreNormalRange(unit);
  },

  // Efecto de Visión Lejana: onda circular azul turquesa (color del icono)
  // que nace en la casilla pulsada y se expande por toda la zona revelada
  // (7x7), tres anillos seguidos que se desvanecen. Solo visual.
  _visionWave(row, col) {
    if (!Units.container) return;
    const n = Units.boardSize;
    const c0 = getTileCenter(row, col, n);
    const c1 = getTileCenter(row, col + 1, n);
    const tileW = Math.abs(c1.x - c0.x) * 2;
    const tileH = Math.abs(c1.y - c0.y) * 2;
    const R = 3;
    const W = (2 * R + 1) * tileW * 0.95;
    const H = (2 * R + 1) * tileH * 0.95;
    for (let k = 0; k < 3; k++) {
      const ring = document.createElement("div");
      ring.className = "vision-wave";
      ring.style.left = `${c0.x}px`;
      ring.style.top = `${c0.y}px`;
      Units.container.appendChild(ring);
      const anim = ring.animate(
        [
          { width: "30px", height: "18px", opacity: 1, borderWidth: "5px" },
          { width: `${W}px`, height: `${H}px`, opacity: 0, borderWidth: "1px" },
        ],
        { duration: 1400, delay: k * 320, easing: "cubic-bezier(.15,.7,.3,1)", fill: "both" }
      );
      anim.onfinish = () => ring.remove();
    }
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
      if (typeof Altar !== "undefined" && Altar.at(r, c)) continue; // Altar de Sacrificios (js/altar.js)
      if (typeof GnomOgro !== "undefined" && GnomOgro.at(r, c)) continue; // GnomOgro (js/gnomogro.js): casilla ocupada
      if ((typeof Resources !== "undefined" && Resources.at(r, c)) || (typeof Drums !== "undefined" && Drums.at(r, c))) continue; // Recursos de escenario (js/resources.js)
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
    img.decoding = "async"; // pedido de rendimiento: no bloquear el hilo principal decodificando
    img.className = "ability-mine__sprite";
    // Sprite real de la seta-trampa (pedido explícito, ya no hace falta el
    // tinte rojo provisional sobre Setarcoiris — ver css/style.css, donde se
    // ha quitado el filter de recolor).
    // Calidad de sprite dinámica (pedido explícito: "cada Sprite que entre
    // nuevo tendrá que adaptarse a estas mejoras...como la resolución
    // dinámica") — mismo patrón que cualquier otra mecánica del tablero,
    // ver js/spritequality.js.
    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(img, "assets/iconos/seta_trampa.png");
    else img.src = "assets/iconos/seta_trampa.png";
    img.alt = "";
    el.appendChild(img);
    Units.container.appendChild(el);
    const { x, y } = getTileCenter(row, col, Units.boardSize);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    // Pedido explícito: "si un personaje aliado se coloca encima de un cepo
    // u otro objeto aliado...el sprite del personaje siempre debe estar por
    // debajo del objeto" — antes +4 (por debajo del +5 de una unidad de pie
    // en la misma loseta, ver Units.spawnUnit/hopTo); ahora +6, mismo valor
    // que ya usan el cepo AtrapaPinreles/Setarcoiris (ver backpack.js) para
    // que el objeto se vea siempre por encima de quien lo pise.
    el.style.zIndex = String(typeof Bushes !== "undefined" ? Bushes.trapZ(row, col) : (row + col) * 10 + 6);
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
      (typeof Fog === "undefined" || !Fog.isFogged(u.row, u.col)) &&
      // Arbustos (js/bushes.js) — mismo criterio que la niebla: no se puede
      // elegir como objetivo a un rival escondido dentro de uno.
      !(typeof Bushes !== "undefined" && Bushes.isHiddenFromTeam(u.row, u.col, unit.team));
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
    target.el.classList.remove(...Teams.cls("unit", target.team));
    target.team = unit.team;
    target.el.classList.add(...Teams.cls("unit", unit.team));
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

    this._mindTint(unit, target, true);
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
      target.el.classList.remove(...Teams.cls("unit", target.team), "unit--mind-controlled");
      target.team = original;
      target.el.classList.add(...Teams.cls("unit", original));
      if (typeof Turns !== "undefined") {
        Turns.actionsUsed[target.id] = TURNS_MAX_ACTIONS;
        Turns._applyExhaustedClass(target);
      }
      if (Units.selectedId === target.id) Units.deselect();
      this._mindTint(null, target, false);
    } else {
      this._mindTint(null, null, false);
    }
    this._mindControlled = null;
  },

  // Tinte morado de todo el tablero mientras dura el control mental, salvo
  // el Urgamentes y la unidad controlada (que se mantienen por encima de la
  // capa gracias a .unit--mc-keep, ver style.css). Entra y sale con fundido.
  _mindTint(caster, target, on) {
    const old = document.getElementById("mind-tint");
    if (on) {
      if (old) old.remove();
      if (!Units.container) return;
      const ov = document.createElement("div");
      ov.id = "mind-tint";
      ov.className = "mind-tint";
      Units.container.appendChild(ov);
      void ov.offsetWidth;
      ov.classList.add("mind-tint--on");
      [caster, target].forEach((u) => u && u.el && u.el.classList.add("unit--mc-keep"));
      this._mindKeep = [caster && caster.id, target && target.id];
    } else {
      (this._mindKeep || []).forEach((id) => {
        const u = Units.list.find((x) => x.id === id);
        if (u && u.el) u.el.classList.remove("unit--mc-keep");
      });
      this._mindKeep = null;
      if (old) {
        old.classList.remove("mind-tint--on");
        setTimeout(() => old.remove(), 700);
      }
    }
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
    this._punchImpactFx(target.row, target.col);

    await this._pushBackFixed(target, unit, 4);
    this._dizzyStars(target);
    Units.refreshRange(unit);
  },

  // Efecto de Nudillos Rocosos (aprobado con demo): destello circular de luz,
  // onda de choque marrón en el suelo, fragmentos de roca, polvo y un
  // temblor corto del tablero. Solo visual.
  _punchImpactFx(row, col) {
    if (!Units.container) return;
    const c = getTileCenter(row, col, Units.boardSize);
    const add = (cls, x, y, z) => {
      const e = document.createElement("div");
      e.className = cls;
      e.style.left = `${x}px`;
      e.style.top = `${y}px`;
      e.style.zIndex = String(z);
      Units.container.appendChild(e);
      return e;
    };
    const done = (a, e) => { a.onfinish = () => e.remove(); };
    const flash = add("punch-flash", c.x, c.y - 40, 2900);
    done(flash.animate([
      { transform: "translate(-50%,-50%) scale(.2)", opacity: 1 },
      { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: 0.35 },
      { transform: "translate(-50%,-50%) scale(1.5)", opacity: 0 },
    ], { duration: 420, easing: "ease-out", fill: "both" }), flash);
    const ring = add("punch-ring", c.x, c.y + 4, 2800);
    done(ring.animate([
      { width: "40px", height: "22px", opacity: 1, borderWidth: "6px" },
      { width: "360px", height: "200px", opacity: 0, borderWidth: "1px" },
    ], { duration: 620, easing: "cubic-bezier(.15,.7,.3,1)", fill: "both" }), ring);
    const cols = ["#8b7355", "#6b5a43", "#a08a68", "#575049"];
    for (let i = 0; i < 14; i++) {
      const sz = 8 + Math.random() * 10;
      const f = add("punch-rock", c.x, c.y - 10, 2910);
      f.style.width = f.style.height = `${sz}px`;
      f.style.background = cols[i % 4];
      const ang = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
      const v = 70 + Math.random() * 90;
      const tx = Math.cos(ang) * v, ty = Math.sin(ang) * v * 0.5;
      done(f.animate([
        { transform: "translate(-50%,-50%) rotate(0)", opacity: 1 },
        { transform: `translate(calc(-50% + ${tx * 0.6}px),calc(-50% + ${ty - 90 - Math.random() * 50}px)) rotate(${180 + Math.random() * 200}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(calc(-50% + ${tx}px),calc(-50% + ${ty + 30}px)) rotate(${360 + Math.random() * 300}deg)`, opacity: 0 },
      ], { duration: 800 + Math.random() * 300, easing: "cubic-bezier(.3,.6,.5,1)", fill: "both" }), f);
    }
    for (let i = 0; i < 7; i++) {
      const d = add("punch-dust", c.x + (Math.random() - 0.5) * 30, c.y + 10 + (Math.random() - 0.5) * 10, 2850);
      done(d.animate([
        { transform: "translate(-50%,-50%) scale(.4)", opacity: 0.9 },
        { transform: `translate(${(Math.random() - 0.5) * 60 - 10}px,${-20 - Math.random() * 30}px) scale(2)`, opacity: 0 },
      ], { duration: 650 + Math.random() * 250, easing: "ease-out", fill: "both" }), d);
    }
    // Temblor del tablero con la propiedad `translate` (no pisa el transform).
    const amp = 7, frames = [];
    for (let i = 0; i < 9; i++) {
      const a = amp * (1 - i / 9);
      frames.push({ translate: `${(Math.random() - 0.5) * 2 * a}px ${(Math.random() - 0.5) * 2 * a}px` });
    }
    frames.push({ translate: "0px 0px" });
    Units.container.animate(frames, { duration: 380 });
  },

  // Estrellas de cómic (irregulares, un solo color) que orbitan la cabeza
  // del golpeado durante unos segundos: marca de "aturdido/agotado".
  _dizzyStars(target) {
    if (!Units.container || !target.el) return;
    const c = getTileCenter(target.row, target.col, Units.boardSize);
    const stars = [];
    for (let i = 0; i < 4; i++) {
      const sz = 36 + Math.random() * 10;
      const pts = [];
      for (let k = 0; k < 10; k++) {
        const ang = (k / 10) * Math.PI * 2 - Math.PI / 2 + (Math.random() - 0.5) * 0.25;
        const r = (k % 2 ? 4.2 : 10) * (0.8 + Math.random() * 0.4);
        pts.push(`${(12 + Math.cos(ang) * r).toFixed(1)},${(12 + Math.sin(ang) * r).toFixed(1)}`);
      }
      const e = document.createElement("div");
      e.className = "punch-star";
      e.innerHTML = `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24"><polygon points="${pts.join(" ")}" fill="#fbbf24"/></svg>`;
      Units.container.appendChild(e);
      stars.push({ e, ph: (i / 4) * Math.PI * 2, rot: Math.random() * 360 });
    }
    const t0 = performance.now(), DUR = 2700;
    const frame = (t) => {
      const k = (t - t0) / DUR;
      if (k >= 1 || !target.el.isConnected) { stars.forEach((o) => o.e.remove()); return; }
      const fade = k > 0.85 ? (1 - k) / 0.15 : 1;
      stars.forEach((o) => {
        const a = o.ph + (t - t0) / 380;
        const x = Math.cos(a) * 52, y = Math.sin(a) * 15;
        o.e.style.left = `${c.x + x}px`;
        o.e.style.top = `${c.y - 70 + y}px`;
        o.e.style.zIndex = y > 0 ? "2950" : "1";
        o.e.style.opacity = String(fade);
        o.e.style.transform = `translate(-50%,-50%) rotate(${o.rot + (t - t0) / 3}deg) scale(${0.85 + 0.2 * Math.sin(a)})`;
      });
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
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
      if (typeof Altar !== "undefined" && Altar.at(nextRow, nextCol)) break; // Altar de Sacrificios (js/altar.js)
      if (typeof GnomOgro !== "undefined" && GnomOgro.at(nextRow, nextCol)) break; // GnomOgro (js/gnomogro.js): casilla ocupada
      if ((typeof Resources !== "undefined" && Resources.at(nextRow, nextCol)) || (typeof Drums !== "undefined" && Drums.at(nextRow, nextCol))) break; // Recursos de escenario (js/resources.js)
      if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(nextRow, nextCol)) break;
      path.push({ row: nextRow, col: nextCol });
      row = nextRow;
      col = nextCol;
    }
    if (path.length === 0) return;

    // Pedido explícito (con capturas): "algunas unidades se siguen
    // asomando a traves de la niebla" — mismo empujón que
    // Combat.pushBack, con el mismo problema de fondo (un setTimeout
    // adivinando la duración real de la transición CSS de left/top, ver la
    // nota larga junto a Units.awaitPositionSettle) y reutiliza el mismo
    // arreglo.
    const PUSH_MS = 140;
    target.el.classList.add("unit--moving");
    for (const step of path) {
      const prevLeft = target.el.style.left;
      const prevTop = target.el.style.top;
      if (typeof Bushes !== "undefined") Bushes.clearHiddenUnit(target.id); // empujado fuera del arbusto
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
      await Units.awaitPositionSettle(target.el, prevLeft, prevTop, PUSH_MS);
    }
    target.el.classList.remove("unit--moving");
    target.spriteEl.classList.remove("unit__sprite--hop");
    if (typeof Fog !== "undefined") Fog.applyVisibility();
    // Mismo refresco final que Units.walkPath/Combat.pushBack — ver la
    // nota larga en Combat.pushBack.
    if (typeof Villages !== "undefined") Villages.refreshOcclusion();
    if (typeof Obelisks !== "undefined") Obelisks.refreshOcclusion();
    if (typeof Altar !== "undefined") Altar.refreshOcclusion();
    if (typeof Bushes !== "undefined") Bushes.refreshOcclusion();
    if (typeof Units !== "undefined") Units.refreshUnitOcclusion();
    if (typeof Shops !== "undefined") Shops.refreshAll();
    if (typeof Skills !== "undefined") Skills.refreshCohesion();
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
      ".unit-info-btn, .ability-btn, .gnome-action-btn, .end-turn-btn, .settings-gear-btn, .backpack-btn, .backpack-close-btn, .glory-hud, .glory-popup-overlay, .unit-info-overlay, .settings-panel"
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
    const range = Units.moveRangeOf(goblin);
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
        if (typeof Altar !== "undefined" && Altar.at(row, col)) continue; // Altar de Sacrificios (js/altar.js)
        if (typeof GnomOgro !== "undefined" && GnomOgro.at(row, col)) continue; // GnomOgro (js/gnomogro.js): casilla ocupada
        if ((typeof Resources !== "undefined" && Resources.at(row, col)) || (typeof Drums !== "undefined" && Drums.at(row, col))) continue; // Recursos de escenario (js/resources.js)
        // Resorte Goblin también puede lanzar al AGUA (si está dentro del rango):
        // sin Anfibio, quien cae se ahoga (ver _resolveThrow).
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
    await this._slingTension(goblin, thrown, destRow, destCol);
    await this._throwUnitTo(thrown, destRow, destCol);
    // Aterriza en agua: sin Anfibio se ahoga (mismo chapuzón que un empujón).
    if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(destRow, destCol) && thrown.el) {
      const amphibious = typeof Skills !== "undefined" && Skills.has(thrown.team, "anfibio");
      if (!amphibious && typeof Combat !== "undefined") await Combat._drown(goblin, thrown);
    }
  },

  // ---------- Efectos del Lanzamiento (aprobados con demo) ----------
  // Tensión de tirachinas: dos gomas del LanzaGnomos al lanzado, que se
  // tensan; el lanzado se encoge y se echa atrás; aro de carga; al soltar,
  // la goma restalla. Solo visual (usa las propiedades `translate` y el
  // transform del sprite, sin tocar left/top de las unidades).
  async _slingTension(goblin, thrown, destRow, destCol) {
    if (!Units.container || !goblin.el || !thrown.el) return;
    const n = Units.boardSize;
    const G = getTileCenter(goblin.row, goblin.col, n);
    const T = getTileCenter(thrown.row, thrown.col, n);
    const Dd = getTileCenter(destRow, destCol, n);
    let vx = Dd.x - T.x, vy = Dd.y - T.y;
    const L = Math.hypot(vx, vy) || 1;
    vx /= L; vy /= L;
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "sling-svg");
    svg.setAttribute("width", "1"); svg.setAttribute("height", "1");
    Units.container.appendChild(svg);
    const ring = document.createElement("div");
    ring.className = "sling-ring";
    Units.container.appendChild(ring);
    const hand = { x: G.x - 2, y: G.y - 28 };
    const CH = 900;
    const ease = (k) => k * k * (3 - 2 * k);
    const gS = goblin.spriteEl, tS = thrown.spriteEl;
    await new Promise((resolve) => {
      const t0 = performance.now();
      const f = (now) => {
        if (!thrown.el.isConnected) return resolve();
        const k = Math.min(1, (now - t0) / CH), e = ease(k);
        const tx = -vx * 26 * e, ty = -vy * 26 * e;
        const tremT = k > 0.5 ? (k - 0.5) * 2 * 2.2 : 0, tremG = k * 2.4;
        thrown.el.style.translate = `${tx + (Math.random() - 0.5) * tremT}px ${ty + (Math.random() - 0.5) * tremT}px`;
        goblin.el.style.translate = `${-vx * 14 * e + (Math.random() - 0.5) * tremG}px ${(Math.random() - 0.5) * tremG}px`;
        if (tS) tS.style.transform = `scale(${1 + 0.16 * e}, ${1 - 0.26 * e})`;
        if (gS) gS.style.transform = `scale(${1 + 0.04 * e}, ${1 - 0.07 * e})`;
        const bx = T.x + tx - vx * 10, by = T.y + ty - 26;
        const sag = (1 - e) * 26 + Math.sin(now / 38) * e * 2.2;
        const w = 7 - 4.2 * e;
        const col = `rgb(${Math.round(150 + 80 * e)},${Math.round(95 - 40 * e)},40)`;
        const mx = (hand.x + bx) / 2, my = (hand.y + by) / 2 + sag;
        let h = `<path d="M${hand.x - 6} ${hand.y} Q${mx} ${my} ${bx} ${by - 8}" stroke="${col}" stroke-width="${w}" fill="none" stroke-linecap="round"/>` +
          `<path d="M${hand.x + 6} ${hand.y + 6} Q${mx} ${my + 8} ${bx} ${by + 8}" stroke="${col}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
        if (e > 0.3) {
          for (let i = 0; i < 3; i++) {
            const m = 0.25 + i * 0.25;
            const px = hand.x + (bx - hand.x) * m;
            const py = hand.y + (by - hand.y) * m + sag * (1 - (2 * m - 1) ** 2) * 0.5;
            const o = (Math.random() - 0.5) * 8;
            h += `<line x1="${px - 5}" y1="${py - 8 + o}" x2="${px + 5}" y2="${py - 14 + o}" stroke="#fff4c2" stroke-width="2" stroke-linecap="round" opacity="${e * 0.9}"/>`;
          }
        }
        svg.innerHTML = h;
        const rs = 1 - e;
        ring.style.left = `${T.x + tx}px`;
        ring.style.top = `${T.y + ty + 6}px`;
        ring.style.width = `${30 + 170 * rs}px`;
        ring.style.height = `${16 + 95 * rs}px`;
        ring.style.opacity = String(k < 0.97 ? 0.2 + 0.8 * e : 0);
        if (k < 1) requestAnimationFrame(f); else resolve();
      };
      requestAnimationFrame(f);
    });
    // Soltar: la goma restalla en un destello y desaparece.
    ring.remove();
    const bx0 = T.x - vx * 36, by0 = T.y - vy * 26 - 26;
    svg.innerHTML = `<line x1="${hand.x}" y1="${hand.y + 3}" x2="${bx0}" y2="${by0}" stroke="#fff" stroke-width="9" stroke-linecap="round"/>`;
    const snap = document.createElement("div");
    snap.className = "sling-snap";
    snap.style.left = `${bx0}px`; snap.style.top = `${by0}px`;
    Units.container.appendChild(snap);
    snap.animate([{ transform: "translate(-50%,-50%) scale(.3)", opacity: 1 }, { transform: "translate(-50%,-50%) scale(1.6)", opacity: 0 }], { duration: 300, fill: "both" }).onfinish = () => snap.remove();
    svg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" }).onfinish = () => svg.remove();
    if (gS) {
      gS.style.transform = "";
      gS.animate([{ transform: "rotate(0)" }, { transform: "rotate(5deg) scale(.96,1.08)", offset: 0.3 }, { transform: "rotate(0)" }], { duration: 320, easing: "ease-out" });
    }
    goblin.el.style.translate = "";
    thrown.el.style.translate = "";
    if (tS) tS.style.transform = "";
    this._throwDust(T.x, T.y + 10, 6, 28);
  },

  _throwDust(x, y, n, sz) {
    for (let i = 0; i < n; i++) {
      const d = document.createElement("div");
      d.className = "punch-dust";
      d.style.width = `${sz}px`; d.style.height = `${sz * 0.7}px`;
      d.style.left = `${x + (Math.random() - 0.5) * 30}px`;
      d.style.top = `${y + (Math.random() - 0.5) * 10}px`;
      d.style.zIndex = "2850";
      Units.container.appendChild(d);
      d.animate([
        { transform: "translate(-50%,-50%) scale(.4)", opacity: 0.9 },
        { transform: `translate(${(Math.random() - 0.5) * 60 - 10}px,${-20 - Math.random() * 30}px) scale(2)`, opacity: 0 },
      ], { duration: 650 + Math.random() * 250, easing: "ease-out", fill: "both" }).onfinish = () => d.remove();
    }
  },

  // Doble semitransparente del lanzado, que se desvanece: estela del vuelo.
  _throwGhost(unit) {
    if (!Units.container || !unit.el) return;
    const g = unit.el.cloneNode(true);
    g.removeAttribute("id");
    g.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
    g.classList.add("throw-ghost");
    g.style.pointerEvents = "none";
    g.style.zIndex = "2850";
    g.style.translate = "";
    Units.container.appendChild(g);
    g.animate([{ opacity: 0.5 }, { opacity: 0 }], { duration: 360, fill: "both" }).onfinish = () => g.remove();
  },

  // Aterrizaje: aro de polvo + rebote de goma amortiguado del sprite.
  _throwLandFx(unit, row, col) {
    if (!Units.container) return;
    const c = getTileCenter(row, col, Units.boardSize);
    this._throwDust(c.x, c.y + 10, 7, 32);
    const ring = document.createElement("div");
    ring.className = "punch-ring";
    ring.style.left = `${c.x}px`; ring.style.top = `${c.y + 4}px`; ring.style.zIndex = "2800";
    Units.container.appendChild(ring);
    ring.animate([
      { width: "40px", height: "22px", opacity: 1, borderWidth: "4px" },
      { width: "220px", height: "120px", opacity: 0, borderWidth: "1px" },
    ], { duration: 520, easing: "ease-out", fill: "both" }).onfinish = () => ring.remove();
    if (unit.spriteEl) {
      unit.spriteEl.animate([
        { transform: "scale(1.28,.68)", offset: 0 },
        { transform: "translateY(-14px) scale(.9,1.14)", offset: 0.28 },
        { transform: "scale(1.12,.86)", offset: 0.52 },
        { transform: "translateY(-4px) scale(.97,1.04)", offset: 0.74 },
        { transform: "scale(1.03,.97)", offset: 0.9 },
        { transform: "scale(1,1)", offset: 1 },
      ], { duration: 620, easing: "ease-out" });
    }
  },

  // Vuelo en parábola (nivel Triple A: un lanzamiento no debería sentirse
  // como un simple teletransporte) — interpola left/top fotograma a
  // fotograma con un arco añadido encima, en vez de reutilizar
  // Units.walkPath (ese es para caminar casilla a casilla en línea recta,
  // esto es un único salto largo por el aire).
  // Pedido explícito (segunda pasada): "la animacion de los personajes al
  // ser lanzados por resorte goblin es cuanto menos lamentable...da un giro
  // raro en el aire...mejorala digno de un triple A" — el giro raro era un
  // spin COMPLETO de 360° a velocidad constante (ver el antiguo
  // ability-throw-spin en style.css), que en un sprite plano se lee como
  // una moneda girando sin parar, totalmente desacoplado del propio arco
  // (una animation CSS con su propio timing, corriendo en paralelo sin
  // saber nada de en qué punto del salto iba el personaje). Ahora la
  // rotación y el squash&stretch se calculan fotograma a fotograma DENTRO
  // de este mismo bucle, en función de la altura real del arco: sin giro
  // en el despegue/aterrizaje, tumba limitada (nunca una vuelta completa)
  // en el punto más alto, y una compresión de impacto en los dos extremos
  // con un ligero estiramiento en el aire — el lenguaje visual clásico de
  // animación (squash & stretch) en vez de un giro plano sin motivo.
  async _throwUnitTo(unit, destRow, destCol) {
    const start = getTileCenter(unit.row, unit.col, Units.boardSize);
    const end = getTileCenter(destRow, destCol, Units.boardSize);
    unit.el.classList.add("unit--thrown");
    if (Units.faceTowardsTile) Units.faceTowardsTile(unit, destRow, destCol);
    const spriteEl = unit.spriteEl;
    // Sentido del giro: hacia donde viaja horizontalmente (una vuelta "hacia
    // adelante" se lee mejor que una dirección aleatoria/siempre igual).
    const spinSign = end.x >= start.x ? 1 : -1;
    const DURATION_MS = 460;
    let lastGhost = 0;
    await new Promise((resolve) => {
      const t0 = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - t0) / DURATION_MS);
        const x = start.x + (end.x - start.x) * t;
        const y = start.y + (end.y - start.y) * t;
        const heightFactor = 4 * t * (1 - t); // 0 en los extremos, 1 en el pico (t=0.5)
        const arc = -70 * heightFactor; // parábola, negativo = hacia arriba en pantalla
        unit.el.style.left = `${x}px`;
        unit.el.style.top = `${y + arc}px`;

        // Tumba proporcional a la altura (máx. ~140°, nunca una vuelta
        // entera) — el personaje "vuela" en el aire sin dar volteretas
        // imposibles para su tamaño.
        const rotateDeg = 0; // sin giro: el personaje vuela encarado hacia donde va
        // Squash&stretch: comprimido justo al despegar/aterrizar (impacto),
        // ligeramente estirado en el punto más alto (vuelo libre).
        const edgeCompress = t < 0.12 ? 1 - t / 0.12 : t > 0.88 ? (t - 0.88) / 0.12 : 0;
        const scaleY = 1 + heightFactor * 0.12 - edgeCompress * 0.22;
        const scaleX = 1 + edgeCompress * 0.16 - heightFactor * 0.05;
        if (spriteEl) spriteEl.style.transform = `scale(${scaleX}, ${scaleY})`;
        if (now - lastGhost > 38) { lastGhost = now; this._throwGhost(unit); }

        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });

    if (spriteEl) spriteEl.style.transform = "";
    if (typeof Bushes !== "undefined") Bushes.clearHiddenUnit(unit.id); // ya no está en el arbusto
    unit.row = destRow;
    unit.col = destCol;
    const { x, y } = getTileCenter(destRow, destCol, Units.boardSize);
    unit.el.style.left = `${x}px`;
    unit.el.style.top = `${y}px`;
    unit.el.style.zIndex = String((destRow + destCol) * 10 + 5);
    unit.el.classList.remove("unit--thrown");

    SFX.hop();
    Units.playShake(unit);
    this._throwLandFx(unit, destRow, destCol);
    // Trampa de TruenoEspora (ver checkTrigger arriba) — un lanzamiento
    // también puede hacer aterrizar a alguien justo encima de una mina.
    this.checkTrigger(unit);
    if (typeof Skills !== "undefined") Skills.refreshCohesion(); // Codo con Codo
    // "puede lanzar un personaje adyacente amigo o enemigo" (ver
    // _activateThrow más arriba) — Fog.revealForUnit SOLO revela terreno
    // nuevo para el equipo del jugador (un rival no "explora" nada para
    // nosotros), así que lanzar a un ALIADO seguía sin problema por esa
    // rama, pero lanzar a un ENEMIGO no llamaba a NADA de niebla — ni
    // siquiera el recálculo genérico de a quién tapa qué nube (ver
    // Fog._refreshFogCoverZ), que no depende de ningún equipo en concreto.
    // Bug real encontrado con capturas ("algunas unidades se siguen
    // asomando a traves de la niebla"): un rival lanzado a una loseta
    // nueva se quedaba con la cobertura de niebla de ANTES de volar por
    // los aires, nunca recalculada. Fog.applyVisibility() (sin condición
    // de equipo, mismo criterio que Units.walkPath) cubre los dos casos.
    if (typeof Fog !== "undefined" && unit.team === "player") Fog.revealForUnit(unit);
    if (typeof Fog !== "undefined") Fog.applyVisibility();
    // Pedido explícito: "con habilidades como lanza el gnomo los totems y
    // el obelisco no se hacen transparentes si estan detras" — mismo
    // arreglo que Units.walkPath (js/units.js): faltaba Obelisks aquí,
    // solo se recalculaba la transparencia de los tótems normales.
    if (typeof Villages !== "undefined") Villages.refreshOcclusion();
    if (typeof Obelisks !== "undefined") Obelisks.refreshOcclusion();
    if (typeof Altar !== "undefined") Altar.refreshOcclusion();
    if (typeof Bushes !== "undefined") Bushes.refreshOcclusion();
    if (typeof Units !== "undefined") Units.refreshUnitOcclusion();
    if (typeof Shops !== "undefined") Shops.refreshAll();
    Units.refreshRange(unit);
  },

  // ---------- GolemCorteza: caducidad de Golem de Espinas ----------
  // Pedido explícito: "la habilidad del golem de espinas no es para toda
  // la partida, si no hasta su proximo turno" — mismo mecanismo que
  // Obelisks.onTurnStart/Shops.onTurnStart (registerTurnStartListener,
  // js/turns.js): se dispara UNA vez por equipo al empezar SU turno.
  // Recorre solo las unidades de ESE equipo (nunca las del rival, cuyo
  // turno todavía no ha llegado) y a quien siga con las espinas puestas le
  // quita tanto el flag (target.thorny, comprobado en cada golpe recibido,
  // ver combat.js) como el sprite/aura visual — vuelve a su aspecto e
  // interacción normal de GolemCorteza. La curación de _activateThorns no
  // se toca aquí: esa parte del pedido original SÍ era permanente ("se cura
  // hasta su vida máxima de base"), solo la protección de espinas caduca.
  // Efecto de recarga sobre la propia unidad: aro dorado en el suelo que se
  // expande, columna de luz, destellos que suben y un brillo en el sprite.
  _rechargeFx(unit) {
    if (!unit.el) return;
    if (typeof SFX !== "undefined" && SFX.recharge) SFX.recharge();
    const fx = document.createElement("div");
    fx.className = "recharge-fx";
    fx.innerHTML = '<i class="recharge-fx__ring"></i><i class="recharge-fx__ring recharge-fx__ring--2"></i><i class="recharge-fx__beam"></i>';
    for (let i = 0; i < 14; i++) {
      const sp = document.createElement("i");
      sp.className = "recharge-fx__spark";
      sp.style.setProperty("--x", `${(Math.random() - 0.5) * 100}px`);
      sp.style.setProperty("--d", `${Math.random() * 0.35}s`);
      sp.style.setProperty("--h", `${90 + Math.random() * 90}px`);
      fx.appendChild(sp);
    }
    unit.el.appendChild(fx);
    setTimeout(() => { fx.remove(); }, 1800);
  },

  onTurnStart(team) {
    // Recarga: quien empieza su turno pegado a un tótem de su propio equipo
    // recupera la habilidad gastada (incentivo para capturar tótems).
    if (typeof Villages !== "undefined") {
      Units.list.forEach((unit) => {
        if (unit.team !== team || !unit.abilityUsed || !ABILITIES[unit.typeId]) return;
        const near = Villages.list.some((v) => v.owner === team && Math.max(Math.abs(v.row - unit.row), Math.abs(v.col - unit.col)) <= 1);
        if (!near) return;
        unit.abilityUsed = false;
        if (typeof Units.spawnFloatingText === "function") Units.spawnFloatingText(unit, "¡Habilidad recargada!", { className: "dmg-popup popup--good" });
        this._rechargeFx(unit);
      });
      this._refreshButton();
    }
    Units.list.forEach((unit) => {
      if (unit.team !== team || !unit.thorny) return;
      unit.thorny = false;
      if (unit.el) unit.el.classList.remove("unit--thorny");
      const type = UNIT_TYPES[unit.typeId];
      // Misma razón que en _activateThorns más arriba: re-registrar, no solo
      // asignar .src, para que SpriteQuality recuerde de nuevo la textura
      // normal de GolemCorteza como reposo.
      if (type && unit.spriteEl) {
        if (typeof SpriteQuality !== "undefined") SpriteQuality.register(unit.spriteEl, type.spriteUrl);
        else unit.spriteEl.src = type.spriteUrl;
      }
    });
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
if (typeof Turns !== "undefined") Turns.registerTurnStartListener(Abilities);

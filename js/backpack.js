/* Gnomore Gnomes — mochila del jugador.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Llevar el inventario del jugador (de momento un único hueco ocupado
       de fábrica: la Setarcoiris) y pintar el icono circular + el popup
       para verlo/usarlo.
     - Colocar objetos sobre el tablero cuando se usan, y resolver lo que
       hace cada uno (de momento solo la Setarcoiris) — no delega en ningún
       otro archivo la lógica de "qué hace cada objeto", pero SÍ pide
       prestadas piezas ya existentes de otras mecánicas en vez de
       reimplementarlas (Units.addMarker para las casillas de colocación,
       Gnome.spawnNear para hacer aparecer al gnomo, Turns.registerTurnEndListener
       para contar rondas).

   Pedido explícito (versión original): "la mochila se representa como un
   icono circular situado arriba de donde aparecen las caras de los
   personajes al seleccionarlos. Solo se mostrará al tener un personaje
   seleccionado...al pulsar la mochila se abrira una interfaz popup...Esta
   interfaz se puede cerrar haciendo clic fuera de ella o desde una X en la
   esquina superior derecha...La mochila mostrara huecos como un
   inventario de juego triple A que se iran comprando en la tienda
   goblin...si pulsas sobre un icono en la mochila, este se resalta, si se
   pulsa otro se deselecciona. si se pulsa otra vez sobre un icono
   resaltado, se cerrar el popup y se usara dicho objeto...un objeto
   resaltado debe mostrar una descripcion en la parte de abajo...de
   momento los objetos de la mochila no son stackeables...inicialmente la
   mochila aparece vacia salvo con una seta arcoiris".

   ACTUALIZADO — pedido explícito: "El icono de la mochila, como es comun
   para todos...siempre debe mostrarse" + decisión de diseño acordada tras
   valorar las dos opciones ("hazlo lo mas profesional posible"): a
   diferencia de la cara del personaje o de la habilidad (ligadas a UNA
   unidad concreta), la mochila es un recurso compartido por todo el
   equipo — de hecho _adjacentToPlayerTiles ya mira TODAS las unidades del
   jugador, no solo la seleccionada — así que esconderla sin selección era
   una herencia arbitraria del icono de la cara, no algo propio de ella.
   Ahora el icono está SIEMPRE visible durante la partida (igual que
   end-turn-btn/settings-gear-btn, ver showButton/hideButton más abajo),
   sin depender de si hay inventario o selección.

   Para evitar el hueco muerto que dejaría bajo un icono fijo pequeño
   cuando no hay cara que mostrar debajo, la mochila migra de "ancla":
   sin ningún personaje propio seleccionado ocupa el hueco GRANDE de la
   esquina (mismo tamaño/posición que .unit-info-btn, que en ese momento
   no se muestra), y en cuanto se selecciona una unidad propia encoge y
   sube a su hueco pequeño de siempre, cediéndole el grande a la cara
   (ver .backpack-btn--anchor-large en style.css, misma curva de aparición
   que ya usaban unit-info-btn/backpack-btn para no introducir un timing
   nuevo). onSelect/onDeselect (más abajo) ya no tocan la visibilidad,
   solo este ancla.

   Colocación de la Setarcoiris: "el jugador podra colocar en una casilla
   adyacente a uno de sus jugadores...se coloca sobre una casilla
   disponible y hace aparecer un gnomo en una casilla adyacente a la seta
   en 2 turnos. entonces el gnomo se la come y la seta desaparece...si
   cuando se da la opcion de seleccionar la casilla donde colocar la seta,
   el jugador pulsa sobre la mochila, la seta se guardara de nuevo". */

const BACKPACK_SLOT_COUNT = 8; // huecos totales del inventario (el resto, vacíos, se "comprarán" en la futura tienda goblin)

// Catálogo de objetos — igual que UNIT_TYPES en units.js: SOLO datos de
// juego (nombre, icono, cuántas rondas tarda en eclosionar...). La
// descripción de flavor vive aparte, en ITEM_DESCRIPTIONS (ver más abajo),
// mismo patrón que UNIT_DESCRIPTIONS en unitinfo.js, para poder editarla
// desde un debug sin tocar datos de juego.
const ITEM_TYPES = {
  setarcoiris: {
    name: "Setarcoiris",
    iconUrl: "assets/iconos/setarcoiris.png",
    hatchRounds: 2, // "hace aparecer un gnomo...en 2 turnos"
  },
  // Pedido explícito: "añadimos un nuevo objeto a la tienda 'BeVida'.
  // restaura los puntos de salud al maximo de base del personaje aliado al
  // que se le da. Cuesta 5 puntos de Gloria" — a diferencia de la
  // Setarcoiris (se coloca sobre una CASILLA), la BeVida se usa
  // directamente sobre un PERSONAJE aliado (ver _startGivingBevida más
  // abajo), así que no tiene hatchRounds ni nada relacionado con el tablero.
  bevida: {
    name: "BeVida",
    iconUrl: "assets/iconos/bevida.png",
  },
};

// Editable desde debug/objetos-mochila.html (genera el bloque listo para
// pegar aquí, igual que configurar-personajes.html hace con
// UNIT_DESCRIPTIONS) — un itemId sin entrada simplemente no muestra
// ningún texto bajo el hueco resaltado.
const ITEM_DESCRIPTIONS = {
  setarcoiris: "La comida favorita de los gnomos. Colócala junto a uno de tus personajes: en dos turnos atraerá a un gnomo hambriento.",
  bevida: "Un brebaje revitalizante. Dáselo a un personaje aliado (pulsa sobre él en el tablero) para restaurar toda su vida hasta su máximo de base.",
};

const Backpack = {
  // Inventario del jugador — de momento uno solo, compartido por todo el
  // equipo (no por personaje individual: cualquier unidad propia
  // seleccionada da acceso al mismo hueco). { uid, itemId }[]
  inventory: [],
  _nextUid: 1,

  // Objetos ya colocados sobre el tablero (la Setarcoiris a la espera de
  // eclosionar, y cualquier objeto futuro con lógica parecida).
  // { uid, itemId, row, col, roundsLeft, el }[]
  placedItems: [],

  // uid del hueco resaltado dentro del popup (null si ninguno).
  _selectedUid: null,
  // uid del objeto en curso de colocación (null si no se está colocando
  // nada ahora mismo) — mientras no sea null, el icono de la mochila
  // cancela la colocación en vez de abrir el popup normal.
  _placingUid: null,

  // uid de la BeVida en curso de "dárselo a alguien" (null si no hay
  // ninguna en curso) — mismo espíritu que _placingUid pero para un objeto
  // que se usa sobre un PERSONAJE en vez de sobre una casilla (ver
  // _startGivingBevida más abajo).
  _givingUid: null,
  _bevidaGiveHandler: null,

  _hasPlayerSelection: false,

  _btnEl: null,
  _btnIconEl: null,
  _overlayEl: null,
  _slotsEl: null,
  _descEl: null,

  // ---------- Ciclo de vida de la partida ----------
  // Mismo patrón que Villages.resetAll/Gnome.resetAll: se llama al empezar
  // cada partida nueva, ANTES de Turns.reset() (ver newgame-flow.js), para
  // dejar el inventario limpio y volver a dar la Setarcoiris inicial.
  resetAll() {
    this.placedItems.forEach((item) => item.el && item.el.remove());
    this.placedItems = [];
    this.inventory = [];
    this._nextUid = 1;
    this._selectedUid = null;
    this._placingUid = null;
    this._givingUid = null;
    this._hasPlayerSelection = false;
    this.closePopup();
    // "inicialmente la mochila aparece vacia salvo con una seta arcoiris,
    // la comida favorita de los gnomos."
    this.inventory.push({ uid: this._nextUid++, itemId: "setarcoiris" });
    this._ensureButton();
    this._updateAnchor();
    if (typeof Turns !== "undefined" && !this._turnListenerRegistered) {
      Turns.registerTurnEndListener(this);
      this._turnListenerRegistered = true;
    }
  },

  // ---------- Icono circular ----------
  _ensureButton() {
    if (this._btnEl) return;
    const btn = document.createElement("button");
    btn.className = "backpack-btn";
    btn.setAttribute("aria-label", "Mochila");
    btn.innerHTML = '<img src="assets/iconos/mochila.png" class="backpack-btn__icon" alt="">';
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._onButtonClick();
    });
    document.body.appendChild(btn);
    this._btnEl = btn;
  },

  _onButtonClick() {
    SFX.click();
    if (this._placingUid !== null) {
      this._cancelPlacing();
      return;
    }
    if (this._givingUid !== null) {
      this._cancelGivingBevida();
      return;
    }
    if (this._overlayEl) return; // ya abierto, nada que hacer (se cierra con la X o clic fuera)
    this.openPopup();
  },

  // ---------- Conectado a la selección de unidades (Units.registerSelectionListener) ----------
  onSelect(unit) {
    this._hasPlayerSelection = unit.team === "player";
    this._updateAnchor();
  },

  onDeselect() {
    this._hasPlayerSelection = false;
    // Si se estaba colocando un objeto, la selección ya se ha perdido (ver
    // Units.deselect -> clearRangeOverlays, que ya habrá borrado las
    // casillas amarillas) — así que se cancela también por este lado,
    // devolviendo el objeto al inventario en vez de dejarlo "colgado".
    if (this._placingUid !== null) {
      this._placingUid = null;
    }
    // Mismo motivo que la colocación de arriba: si se estaba a medio dar
    // una BeVida y se pierde la selección, se cancela devolviendo el
    // objeto en vez de dejarlo "colgado" a mitad de camino.
    if (this._givingUid !== null) {
      this._cancelGivingBevida();
    }
    this._updateAnchor();
    this.closePopup();
  },

  // Alterna entre los dos "huecos" de la esquina inferior izquierda — ver
  // la nota de cabecera de este archivo. Sin selección propia: ancla
  // grande, ocupando el sitio de la cara (esté o no en curso una
  // colocación — sin unidad seleccionada tampoco hay cara que mostrar
  // debajo, así que el hueco grande sigue siendo el correcto). Con
  // selección propia: ancla pequeña de siempre, encima de la cara.
  _updateAnchor() {
    if (!this._btnEl) return;
    this._btnEl.classList.toggle("backpack-btn--anchor-large", !this._hasPlayerSelection);
  },

  // ---------- Visibilidad durante la partida ----------
  // Mismo patrón que SettingsMenu.showButton/hideButton y
  // Turns.showButton/hideButton — el icono vive fuera de #screen-board
  // (para no desaparecer solo al volver al menú desde el propio tablero),
  // así que su visibilidad se controla a mano: visible mientras hay una
  // partida en curso (llamado desde newgame-flow.js, junto al resto del
  // HUD de partida), oculto al salir (ver SettingsMenu._exitMatch).
  showButton() {
    this._ensureButton();
    this._btnEl.classList.add("backpack-btn--visible");
    this._updateAnchor();
  },

  hideButton() {
    if (this._btnEl) this._btnEl.classList.remove("backpack-btn--visible");
  },

  // ---------- Popup ----------
  openPopup() {
    if (this._overlayEl) return;
    SFX.click();
    this._selectedUid = null;

    const overlay = document.createElement("div");
    overlay.className = "backpack-overlay";
    overlay.addEventListener("click", () => this.closePopup());

    // Pedido explícito (con mockup de aprobación previo, ver captura): "la
    // x de cerrar...puede sobresalir por la esquina" — para que el rombo
    // pueda asomar de verdad medio fuera del panel, el clip-path en
    // banderín (p5-banner) ya NO vive en `panel` (el contenedor exterior,
    // sin recorte) sino en un hijo aparte (`panelBg`); el botón de cerrar
    // es HERMANO de panelBg, no su hijo, así el clip-path de panelBg no
    // llega a recortarlo. Mismo truco que .end-turn-btn separa su rombo
    // del reloj en su propia capa (ver ese comentario en style.css).
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
      this.closePopup();
    });
    panel.appendChild(closeBtn);

    const title = document.createElement("div");
    title.className = "p5-banner__label backpack-panel__title";
    title.textContent = "MOCHILA";
    panelBg.appendChild(title);

    const slots = document.createElement("div");
    slots.className = "backpack-slots";
    panelBg.appendChild(slots);
    this._slotsEl = slots;

    const desc = document.createElement("div");
    desc.className = "backpack-desc";
    desc.innerHTML = '<p class="backpack-desc__text"></p>';
    panelBg.appendChild(desc);
    this._descEl = desc.querySelector(".backpack-desc__text");

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    this._overlayEl = overlay;

    this._renderSlots();
    requestAnimationFrame(() => overlay.classList.add("backpack-overlay--visible"));
  },

  closePopup() {
    if (!this._overlayEl) return;
    const el = this._overlayEl;
    this._overlayEl = null;
    this._slotsEl = null;
    this._descEl = null;
    this._selectedUid = null;
    el.classList.remove("backpack-overlay--visible");
    setTimeout(() => el.remove(), 220);
  },

  // Pinta los BACKPACK_SLOT_COUNT huecos — los primeros con un objeto real
  // (en el orden del inventario), el resto vacíos ("huecos como un
  // inventario triple A que se irán comprando en la tienda goblin").
  _renderSlots() {
    if (!this._slotsEl) return;
    this._slotsEl.innerHTML = "";
    for (let i = 0; i < BACKPACK_SLOT_COUNT; i++) {
      const entry = this.inventory[i];
      const slotEl = document.createElement("button");
      slotEl.className = "backpack-slot" + (entry ? "" : " backpack-slot--empty");
      if (entry) {
        const def = ITEM_TYPES[entry.itemId];
        slotEl.innerHTML = `<img src="${def.iconUrl}" class="backpack-slot__icon" alt="${def.name}">`;
        slotEl.classList.toggle("backpack-slot--selected", entry.uid === this._selectedUid);
        slotEl.addEventListener("click", (e) => {
          e.stopPropagation();
          this._onSlotClick(entry.uid);
        });
      } else {
        slotEl.disabled = true;
      }
      this._slotsEl.appendChild(slotEl);
    }
    this._updateDescText();
  },

  _onSlotClick(uid) {
    if (this._selectedUid === uid) {
      // "si se pulsa otra vez sobre un icono resaltado, se cerrará el
      // popup y se usará dicho objeto"
      this._useItem(uid);
      return;
    }
    SFX.click();
    this._selectedUid = uid;
    this._renderSlots();
  },

  _updateDescText() {
    if (!this._descEl) return;
    const entry = this.inventory.find((it) => it.uid === this._selectedUid);
    this._descEl.textContent = entry ? ITEM_DESCRIPTIONS[entry.itemId] || "" : "";
  },

  // Hueco libre en la mochila ahora mismo — lo consulta Shops (js/shops.js)
  // antes de dejar comprar nada: "la Tienda Goblin...el objeto pasa a la
  // mochila del jugador que lo compró" da por hecho que hay sitio.
  hasFreeSlot() {
    return this.inventory.length < BACKPACK_SLOT_COUNT;
  },

  // Añade un objeto directamente al inventario sin pasar por el tablero —
  // a diferencia de _placeSetarcoirisAt (que coloca sobre una loseta), esto
  // es para cualquier objeto que entra YA guardado, como una compra en la
  // Tienda Goblin (js/shops.js). No comprueba hueco libre por su cuenta
  // (quien llama a esto ya lo hizo con hasFreeSlot, para poder avisar ANTES
  // de gastar el recurso que sea) — simplemente añade y refresca el icono.
  addItem(itemId) {
    this.inventory.push({ uid: this._nextUid++, itemId });
  },

  _useItem(uid) {
    const entry = this.inventory.find((it) => it.uid === uid);
    if (!entry) return;
    this.closePopup();
    if (entry.itemId === "setarcoiris") this._startPlacingSetarcoiris(uid);
    else if (entry.itemId === "bevida") this._startGivingBevida(uid);
  },

  // ---------- BeVida: dársela a un personaje aliado ----------
  // "restaura los puntos de salud al maximo de base del personaje aliado al
  // que se le da" (pedido explícito) — a diferencia de la Setarcoiris, esto
  // no se coloca sobre una casilla: se elige directamente A QUÉ PERSONAJE se
  // le da, con el mismo patrón de "modo de apuntado + clic en cualquier
  // parte con capture:true" que ya usa Abilities._startUnitPicking
  // (js/abilities.js) para elegir objetivo cuando hay varios candidatos —
  // aquí vive su propia copia porque Backpack es un archivo aparte y el
  // candidato no tiene por qué estar adyacente a nadie.
  _startGivingBevida(uid) {
    this._givingUid = uid;
    Units.clearRangeOverlays();
    document.body.classList.add("backpack-giving--bevida");
    Units.list
      .filter((u) => u.team === "player")
      .forEach((u) => u.el.classList.add("unit--giveable-target"));
    this._bevidaGiveHandler = (e) => this._onBevidaGiveClick(e);
    window.addEventListener("click", this._bevidaGiveHandler, { capture: true });
  },

  _cancelGivingBevida() {
    if (this._givingUid === null) return;
    this._givingUid = null;
    document.body.classList.remove("backpack-giving--bevida");
    Units.list.forEach((u) => u.el.classList.remove("unit--giveable-target"));
    if (this._bevidaGiveHandler) {
      window.removeEventListener("click", this._bevidaGiveHandler, { capture: true });
      this._bevidaGiveHandler = null;
    }
    this._restoreNormalRange();
  },

  _onBevidaGiveClick(e) {
    const isFixedUi = e.target.closest(
      ".unit-info-btn, .ability-btn, .gnome-action-btn, .end-turn-btn, .settings-gear-btn, .backpack-btn, .backpack-close-btn, .glory-hud, .glory-popup-overlay, .unit-info-overlay, .settings-panel"
    );
    const unitEl = e.target.closest(".unit");
    e.preventDefault();
    e.stopPropagation();
    const uid = this._givingUid;
    this._cancelGivingBevida();
    if (isFixedUi || !unitEl) return; // cancela sin gastar, se puede reintentar

    const target = Units.list.find((u) => u.id === unitEl.dataset.unitId);
    if (!target || target.team !== "player") return;
    this._giveBevidaTo(uid, target);
  },

  _giveBevidaTo(uid, target) {
    this.inventory = this.inventory.filter((it) => it.uid !== uid);
    const type = UNIT_TYPES[target.typeId];
    target.hp = type.aguante;
    target.maxHp = type.aguante;
    Units.updateHpBar(target);
    SFX.itemEaten();
    Units.spawnFloatingText(target, "¡BEVIDA!", { className: "dmg-popup gnome-points-popup" });
  },

  // ---------- Colocación sobre el tablero ----------
  // Casillas adyacentes (Chebyshev, igual que el resto del proyecto — ver
  // movement.js) a CUALQUIERA de los personajes del jugador, no solo el
  // seleccionado ahora mismo — "el jugador podra colocar en una casilla
  // adyacente a uno de sus jugadores", sin especificar cuál.
  // CORRECCIÓN (pedido explícito): "los objetos que se usan en una casilla
  // adyacente a un personaje solo pueden ser personajes activos, si alguno
  // termino sus 2 acciones no mostrara sus casillas donde colocar" — antes
  // se ofrecían las casillas de CUALQUIER personaje propio, incluido uno
  // ya sin acciones (unit--exhausted); mismo criterio que ya usa cualquier
  // otra mecánica del proyecto (Movement/Combat/Villages/Shops, todas se
  // blindan con Turns.canAct antes de ofrecer nada).
  _adjacentToPlayerTiles() {
    if (typeof Units === "undefined") return [];
    const seen = new Set();
    const tiles = [];
    Units.list
      .filter((u) => u.team === "player" && (typeof Turns === "undefined" || Turns.canAct(u)))
      .forEach((u) => {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const row = u.row + dr;
            const col = u.col + dc;
            if (row < 0 || col < 0 || row >= Units.boardSize || col >= Units.boardSize) continue;
            if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) continue;
            // Pedido explícito: "no se pueden colocar setas en lugares
            // donde hay totems o edificios" — mismo criterio que ya usan
            // Combat/GnomeInstance/Villages al buscar casilla libre
            // (Villages.at, ver js/villages.js) para no ofrecer un tótem
            // como destino válido de movimiento/ataque.
            if (typeof Villages !== "undefined" && Villages.at(row, col)) continue;
            // Pedido explícito (Tienda Goblin, js/shops.js): "no se pueden
            // colocar objetos sobre ella" — mismo criterio que un tótem,
            // justo arriba.
            if (typeof Shops !== "undefined" && Shops.at(row, col)) continue;
            if (typeof Obelisks !== "undefined" && Obelisks.at(row, col)) continue; // Obelisco Ancestral (js/obelisks.js)
            // Igual que cualquier otra mecánica del proyecto: no se ofrece
            // colocar nada sobre una loseta que ni siquiera se ha revelado.
            if (typeof Fog !== "undefined" && Fog.isFogged(row, col)) continue;
            const key = `${row},${col}`;
            if (seen.has(key)) continue;
            seen.add(key);
            tiles.push({ row, col });
          }
        }
      });
    return tiles;
  },

  _startPlacingSetarcoiris(uid) {
    this._placingUid = uid;
    // Pedido explícito: "cuando se va a colocar objetos, solo se muestran
    // los circulos amarillos donde se puede colocar, los de movimiento no
    // deben aparecer" — hasta ahora esto solo AÑADÍA las casillas amarillas
    // de colocación sin quitar las de movimiento/ataque que ya estuvieran
    // pintadas de la unidad seleccionada (Units.refreshRange las repinta
    // tras cualquier acción). Se limpian aquí para que durante la
    // colocación solo se vea lo que de verdad es clicable ahora mismo.
    Units.clearRangeOverlays();
    const tiles = this._adjacentToPlayerTiles();
    tiles.forEach((tile, i) => {
      Units.addMarker({
        className: "range-marker range-marker--item-target",
        row: tile.row,
        col: tile.col,
        delayIndex: i,
        visibleClass: "range-marker--visible",
        owner: "backpack",
        onClick: () => this._placeSetarcoirisAt(uid, tile.row, tile.col),
      });
    });
  },

  // Al salir del modo colocación (cancelado o completado) la unidad sigue
  // seleccionada — hay que devolverle sus círculos normales de
  // movimiento/ataque/coger, que Units.clearRangeOverlays() quitó al
  // entrar en _startPlacingSetarcoiris (ver nota ahí).
  _restoreNormalRange() {
    const unit = typeof Units !== "undefined" ? Units.list.find((u) => u.id === Units.selectedId) : null;
    if (unit) Units.refreshRange(unit);
  },

  _cancelPlacing() {
    if (this._placingUid === null) return;
    SFX.back();
    this._placingUid = null;
    Units.markerEls = Units.markerEls.filter((m) => {
      if (m._owner !== "backpack") return true;
      m.remove();
      return false;
    });
    this._restoreNormalRange();
  },

  _placeSetarcoirisAt(uid, row, col) {
    // Quita SOLO los marcadores propios (igual que _cancelPlacing) sin
    // devolver el objeto al inventario, porque esta vez sí se ha usado.
    this._placingUid = null;
    Units.markerEls = Units.markerEls.filter((m) => {
      if (m._owner !== "backpack") return true;
      m.remove();
      return false;
    });
    this.inventory = this.inventory.filter((it) => it.uid !== uid);
    this._restoreNormalRange();

    const el = document.createElement("div");
    el.className = "unit board-item board-item--setarcoiris";
    const img = document.createElement("img");
    img.decoding = "async"; // pedido de rendimiento: no bloquear el hilo principal decodificando
    img.className = "board-item__sprite";
    img.src = ITEM_TYPES.setarcoiris.iconUrl;
    img.draggable = false;
    img.alt = "";
    el.appendChild(img);
    Units.container.appendChild(el);

    if (typeof getTileCenter !== "undefined") {
      const { x, y } = getTileCenter(row, col, Units.boardSize);
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }
    // +6 (por encima de una unidad normal, que usa +5, ver Units._placeInstant)
    // para que se muestre "por delante del jugador que ocupe su misma
    // casilla" (pedido explícito) sin tocar el z-index de las unidades.
    el.style.zIndex = String((row + col) * 10 + 6);

    if (typeof Fog !== "undefined") el.classList.toggle("unit--fog-hidden", Fog.isFogged(row, col));

    SFX.itemPlace();
    this.placedItems.push({
      uid,
      itemId: "setarcoiris",
      row,
      col,
      roundsLeft: ITEM_TYPES.setarcoiris.hatchRounds,
      el,
    });
  },

  // ---------- Cuenta de rondas (Turns.registerTurnEndListener) ----------
  // Se llama una vez por RONDA COMPLETA (jugador + rival, un único pulso
  // del botón "pasar turno"), no una vez por equipo — "hace aparecer un
  // gnomo...en 2 turnos" se cuenta así: colocarla en la ronda N hace que
  // el gnomo aparezca justo después de que termine la ronda N+2.
  onRoundEnd() {
    if (this.placedItems.length === 0) return;
    const stillPending = [];
    this.placedItems.forEach((item) => {
      item.roundsLeft -= 1;
      if (item.roundsLeft > 0) {
        stillPending.push(item);
        return;
      }
      this._hatchSetarcoiris(item);
    });
    this.placedItems = stillPending;
  },

  // "entonces el gnomo se la come y la seta desaparece" — aparece el
  // gnomo junto a la seta (Gnome.spawnNear ya busca la loseta libre más
  // cercana por su cuenta) y, un instante después (para que se lea como
  // "se la come", no como un simple borrado), la seta se desvanece.
  _hatchSetarcoiris(item) {
    if (typeof Gnome !== "undefined") Gnome.spawnNear(item.row, item.col);
    SFX.itemEaten();
    if (item.el) {
      const el = item.el;
      el.classList.add("board-item--eaten");
      setTimeout(() => el.remove(), 420);
    }
  },
};

Units.registerSelectionListener(Backpack);

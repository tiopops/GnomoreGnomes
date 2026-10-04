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
    name: "BebeVida",
    iconUrl: "assets/iconos/bevida.png",
  },
  // Pedido explícito: "añadimos a la tienda goblin el cepo llamado
  // 'AtrapaPinreles'...se coloca en una casilla adyacente a un personaje
  // aun activo. Si un enemigo cae en la misma casilla o pasa sobre ella,
  // pierde automaticamente el turno y si tuviera un gnomo cogido se le
  // cae al suelo y hace su tipica huida. ademas hace un punto de daño" —
  // a diferencia de la Setarcoiris (eclosiona sola tras N rondas) esta se
  // queda quieta indefinidamente hasta que un enemigo la activa (ver
  // Backpack.traps/checkTrapAt), así que tampoco tiene hatchRounds.
  atrapapinreles: {
    name: "AtrapaPinreles",
    iconUrl: "assets/iconos/atrapapinreles.png",
  },
  // Pedido explícito: "añadimos a la tienda goblin un cohete llamado
  // 'KataPum!'...eliges un jugador enemigo cualquiera a la vista...el
  // misil va teledirigido hasta el enemigo causandole de 1 a 2 puntos de
  // daño" — tampoco tiene hatchRounds (se resuelve al instante en cuanto
  // se elige objetivo, ver Backpack._launchKatapum/_animateKatapumThrow).
  katapum: {
    name: "KataPum!",
    iconUrl: "assets/iconos/katapum.png",
  },
  // Pedido explícito: "nuevo objeto para la tienda goblin TotemVision. Se
  // coloca sobre una casilla libre (no de agua) del escenario y otorga
  // vision como si tuviera percepcion 3. tiene 1 punto de vida, un enemigo
  // puede golpearlo. se pueden ocultar dentro de un arbusto, pero si un
  // personaje enemigo entra dentro del arbusto, el totem se rompe" — la
  // mecánica de verdad (percepción/HP/ataque/rotura en arbusto) vive en su
  // propio archivo (js/totemvision.js, regla de oro: un archivo por
  // mecánica); aquí solo su ficha de catálogo, igual que el resto de
  // objetos. Pedido explícito (con arte adjunto): "el icono de totemvision
  // es el que te paso no ese que esta" — arte propio definitivo (mazo de
  // madera con un ojo tallado, recortado a su contenido real con un margen
  // pequeño), ya no reutiliza el icono de Visión Lejana. Registrado por
  // SpriteQuality igual que cualquier otro sprite colocado en el tablero
  // (ver js/totemvision.js), así que también lleva su pareja "_midres".
  totemvision: {
    name: "TotemVision",
    iconUrl: "assets/iconos/totemvision.png",
  },
  // Pedido explícito: "nuevo item al la tienda goblin item_señuelo, es un
  // señuelo explosivo de madera con aspecto de gnomo. al usarlo se puede
  // colocar sobre una loseta libre de terreno...no puede ser en un
  // arbusto. para el jugador que lo coloca el diseño es el del sprite
  // nuevo, pero el enemigo lo ve con el sprite normal del gnomo...al
  // cogerlo...PUM! explota" — igual que TotemVision, la ficha de catálogo
  // vive aquí (icono de mochila: SIEMPRE el arte real, es el jugador
  // consultando su propio inventario) pero la mecánica de verdad —
  // hacerse pasar por un gnomo suelto de verdad ante el rival, explotar
  // al intentar cogerlo— reutiliza directamente el sistema de Gnome (ver
  // Gnome.spawnDecoy en js/gnome.js): así hereda gratis toda su lógica ya
  // existente de niebla, aproximación y detección de la IA rival, sin
  // duplicarla.
  senuelo: {
    name: "Señuelo Explosivo",
    iconUrl: "assets/iconos/senuelo_clavado.png",
  },
};

// Editable desde debug/objetos-mochila.html (genera el bloque listo para
// pegar aquí, igual que configurar-personajes.html hace con
// UNIT_DESCRIPTIONS) — un itemId sin entrada simplemente no muestra
// ningún texto bajo el hueco resaltado.
const ITEM_DESCRIPTIONS = {
  setarcoiris: "La comida favorita de los gnomos. Colócala junto a uno de tus personajes: en dos turnos atraerá a un gnomo hambriento.",
  bevida: "Un brebaje revitalizante. Dáselo a un personaje aliado (pulsa sobre él en el tablero) para restaurar toda su vida hasta su máximo de base, o úsalo sobre uno de tus tótems para repararlo por completo. No sirve con el Obelisco.",
  atrapapinreles: "Un cepo goblin oxidado. Colócalo junto a uno de tus personajes: el enemigo que caiga en su casilla o pase por encima pierde el turno, suelta cualquier gnomo que llevara encima y recibe 1 punto de daño.",
  katapum: "Un cohete goblin casero. Elige a un rival a la vista: el misil vuela teledirigido hasta él y tira un dado de 6 al explotar: con 1-3 le hace 1 punto de daño, con 4-5 le hace 2 y con 6 le hace 3.",
  totemvision: "Un tótem tallado con un ojo tallado en su punta. Colócalo sobre una casilla libre: otorga visión permanente en un radio de 3 casillas. Tiene 1 punto de vida (cualquier golpe lo destruye) y, si se esconde dentro de un arbusto, se rompe en cuanto un rival entra en él.",
  senuelo: "Un muñeco de madera con forma de gnomo, cargado de pólvora. Colócalo sobre una casilla libre de terreno (nunca en un arbusto): tú lo ves como lo que es, pero el rival lo confunde con un gnomo suelto de verdad. En cuanto intente cogerlo... ¡PUM! Explota y le quita 2 puntos de vida.",
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

  // Cepos colocados sobre el tablero (de momento solo la AtrapaPinreles) —
  // aparte de placedItems porque no tienen "roundsLeft" ni eclosionan con
  // el paso de rondas: se quedan ahí tal cual hasta que alguien cae en
  // ellos (ver checkTrapAt, comprobado desde Units.walkPath). { uid,
  // itemId, row, col, el }[]
  traps: [],

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

  // uid del KataPum! en curso de "elegir a qué rival dispararlo" (null si
  // no hay ninguno en curso) — mismo espíritu que _givingUid, pero el
  // filtro de objetivos válidos es "cualquier rival a la vista", no "solo
  // adyacentes" (ver _startTargetingKatapum más abajo).
  _katapumUid: null,
  _katapumPickHandler: null,

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
    this.traps.forEach((trap) => trap.el && trap.el.remove());
    this.traps = [];
    this.inventory = [];
    this._nextUid = 1;
    this._selectedUid = null;
    this._placingUid = null;
    this._givingUid = null;
    this._katapumUid = null;
    this._hasPlayerSelection = false;
    this.closePopup();
    // "inicialmente la mochila aparece vacia salvo con una seta arcoiris,
    // la comida favorita de los gnomos."
    this.inventory.push({ uid: this._nextUid++, itemId: "setarcoiris" });
    // Pedido explícito: "ahora los jugadores empiezan tambien con un
    // TotemVision en la mochila al comienzo del juego" — mismo patrón que
    // la Setarcoiris de arriba, un segundo item de regalo en cada partida
    // nueva (solo para el jugador: esto es la mochila real, la del rival
    // se simula aparte en Shops.attemptAutoBuy/Armory.attemptAutoUpgrade).
    this.inventory.push({ uid: this._nextUid++, itemId: "totemvision" });
    this._ensureButton();
    this._updateAnchor();
    if (typeof Turns !== "undefined" && !this._turnListenerRegistered) {
      Turns.registerTurnEndListener(this);
      this._turnListenerRegistered = true;
    }
  },

  // ---------- Recursos (js/resources.js) ----------
  // Pinta una etiqueta por recurso (icono + número, mismo estilo que
  // .shop-slot__price) dentro de `container` — usado tanto por el popup de
  // la mochila como por el de la Armería (js/armory.js), cada uno con su
  // propia fila. El número vive marcado con data-resource-id para que
  // refreshResourceBadges pueda encontrar y actualizar TODAS las copias
  // pintadas ahora mismo (puede haber más de una si, aunque no debería
  // pasar en la práctica, hubiera dos popups a la vez) sin que cada archivo
  // tenga que llevar su propia lista de referencias.
  buildResourceBadges(container) {
    container.innerHTML = "";
    const counts = typeof Resources !== "undefined" ? Resources.counts : { madera: 0, roca: 0, metal: 0 };
    Object.keys(RESOURCE_TYPES).filter((id) => id !== "fragmento").forEach((resourceId) => {
      const def = RESOURCE_TYPES[resourceId];
      const badge = document.createElement("div");
      badge.className = "resource-badge";
      badge.innerHTML = `
        <img src="${def.iconUrl}" class="resource-badge__icon" alt="${def.name}">
        <span class="resource-badge__count" data-resource-id="${resourceId}">${counts[resourceId] || 0}</span>`;
      if (typeof Tooltip !== "undefined") Tooltip.attach(badge, def.name);
      container.appendChild(badge);
    });
  },

  refreshResourceBadges() {
    const counts = typeof Resources !== "undefined" ? Resources.counts : { madera: 0, roca: 0, metal: 0 };
    document.querySelectorAll(".resource-badge__count[data-resource-id]").forEach((el) => {
      el.textContent = counts[el.dataset.resourceId] || 0;
    });
    // CORRECCIÓN (pedido explícito): "los recursos ocupan espacio en la
    // mochila...deben ocupar espacio, por eso tenemos 8 huecos" — a
    // diferencia de la fila de etiquetas de la Armería (solo números que
    // actualizar), el POPUP PROPIO de la mochila ahora enseña los recursos
    // como huecos reales dentro de la rejilla (ver _allSlotEntries más
    // abajo), así que una cantidad que pasa de 0 a 1 (o de 1 a 0, gastado
    // del todo en la Armería) hace aparecer/desaparecer un hueco entero, no
    // solo cambiar un número — necesita repintar la rejilla completa, no
    // basta con actualizar texto.
    if (this._slotsEl) this._renderSlots();
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
    if (this._katapumUid !== null) {
      this._cancelTargetingKatapum();
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
    // KataPum! no depende de tener seleccionado a quien lo lanza (si no hay
    // ninguno, _launchKatapum ya elige el más cercano al objetivo por su
    // cuenta) — pero se cancela igual por seguridad/consistencia con los
    // otros dos objetos de arriba, para no dejar el listener de clic ni el
    // resaltado de objetivos colgados de una selección que ya no existe.
    if (this._katapumUid !== null) {
      this._cancelTargetingKatapum();
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

  // ---------- Recursos como huecos de mochila ----------
  // Pedido explícito (pasada posterior): "los recursos ocupan espacio en la
  // mochila. no los colores a parte, son como un objeto mas que se consume
  // como moneda en la armeria, pero deben ocupar espacio, por eso tenemos 8
  // huecos" — antes vivían en su propia fila aparte (ver el historial de
  // buildResourceBadges), fuera de los BACKPACK_SLOT_COUNT huecos reales;
  // ahora cada TIPO de recurso con cantidad > 0 ocupa uno de esos huecos,
  // apilado con su cantidad (mismo rombo amarillo que ya usan los puntos de
  // gloria/precios de tienda, ver .shop-slot__price en style.css — pedido
  // original: "se mostrara la cantidad de cada uno con una etiqueta igual
  // que la que muestra los puntos de gloria"), sin ocupar un hueco por cada
  // UNIDAD recogida (son stackeables: 6 de madera siguen siendo un único
  // hueco). buildResourceBadges/refreshResourceBadges (arriba) se quedan tal
  // cual para la fila de existencias aparte que sigue usando el popup de la
  // Armería (js/armory.js) — no es el mismo sitio ni el mismo criterio.
  _resourceSlotEntries() {
    if (typeof Resources === "undefined") return [];
    const counts = Resources.counts;
    return Object.keys(RESOURCE_TYPES)
      .filter((id) => (counts[id] || 0) > 0)
      .map((id) => ({ uid: `resource-${id}`, kind: "resource", resourceId: id, count: counts[id] }));
  },

  // Lista combinada de TODO lo que ocupa un hueco ahora mismo (recursos +
  // objetos reales), en ese orden — usada tanto para pintar la rejilla como
  // para saber cuántos huecos quedan libres (ver hasFreeSlot más abajo).
  _allSlotEntries() {
    const relics = typeof Relics !== "undefined"
      ? Relics.list("player").map((r) => ({ uid: `relic-${r.uid}`, kind: "relic", relic: r }))
      : [];
    return [...relics, ...this._resourceSlotEntries(), ...this.inventory.map((it) => ({ ...it, kind: "item" }))];
  },

  // Pinta los BACKPACK_SLOT_COUNT huecos — los primeros con recursos/objetos
  // reales (en ese orden, ver _allSlotEntries), el resto vacíos ("huecos
  // como un inventario triple A que se irán comprando en la tienda goblin").
  _renderSlots() {
    if (!this._slotsEl) return;
    this._slotsEl.innerHTML = "";
    const entries = this._allSlotEntries();
    for (let i = 0; i < BACKPACK_SLOT_COUNT; i++) {
      const entry = entries[i];
      const slotEl = document.createElement("button");
      slotEl.className = "backpack-slot" + (entry ? "" : " backpack-slot--empty");
      if (entry) {
        if (entry.kind === "resource") {
          const def = RESOURCE_TYPES[entry.resourceId];
          slotEl.className += " backpack-slot--resource";
          slotEl.innerHTML =
            `<img src="${def.iconUrl}" class="backpack-slot__icon" alt="${def.name}">` +
            `<span class="shop-slot__price"><span class="shop-slot__price__num">${entry.count}</span></span>`;
        } else if (entry.kind === "relic") {
          const def = RELIC_TYPES[entry.relic.relicId];
          slotEl.className += " backpack-slot--relic";
          slotEl.innerHTML =
            `<img src="${def.iconUrl}" class="backpack-slot__icon" alt="${def.name}">` +
            `<span class="skills-node__rank"><span class="skills-node__rank-num">${entry.relic.durability}/${entry.relic.max}</span></span>`;
        } else {
          const def = ITEM_TYPES[entry.itemId];
          slotEl.innerHTML = `<img src="${def.iconUrl}" class="backpack-slot__icon" alt="${def.name}">`;
        }
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
    if (this._selectedUid === uid && String(uid).startsWith("relic-")) return; // las reliquias son pasivas
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
    const entry = this._allSlotEntries().find((it) => it.uid === this._selectedUid);
    this._descEl.textContent = "";
    if (!entry) return;
    // Nombre resaltado en amarillo + descripción corta debajo (pedido
    // explícito: "debe aparecer su nombre resaltado en amarillo").
    const nameEl = document.createElement("span");
    nameEl.className = "backpack-desc__name";
    const textEl = document.createElement("span");
    let note = null;
    if (entry.kind === "relic") {
      const def = RELIC_TYPES[entry.relic.relicId];
      nameEl.textContent = def.name;
      const dur = document.createElement("span");
      dur.className = "backpack-desc__dur";
      dur.textContent = ` ${entry.relic.durability}/${entry.relic.max}`;
      nameEl.appendChild(dur);
      textEl.textContent = def.description;
      note = "Pierde 1 de durabilidad cuando muere un aliado.";
    } else if (entry.kind === "resource") {
      nameEl.textContent = RESOURCE_TYPES[entry.resourceId].name;
      textEl.textContent = (typeof RESOURCE_DESCRIPTIONS !== "undefined" && RESOURCE_DESCRIPTIONS[entry.resourceId]) || "";
    } else {
      nameEl.textContent = ITEM_TYPES[entry.itemId].name;
      textEl.textContent = ITEM_DESCRIPTIONS[entry.itemId] || "";
    }
    this._descEl.appendChild(nameEl);
    this._descEl.appendChild(document.createElement("br"));
    this._descEl.appendChild(textEl);
    if (note) {
      this._descEl.appendChild(document.createTextNode(" "));
      const noteEl = document.createElement("span");
      noteEl.className = "backpack-desc__note";
      noteEl.textContent = note;
      this._descEl.appendChild(noteEl);
    }
  },

  // Hueco libre en la mochila ahora mismo — lo consulta Shops (js/shops.js)
  // antes de dejar comprar nada ("la Tienda Goblin...el objeto pasa a la
  // mochila del jugador que lo compró" da por hecho que hay sitio) y
  // Resources (js/resources.js) antes de dejar recoger un TIPO de recurso
  // nuevo (ver Resources._collect). CORRECCIÓN (pedido explícito): "los
  // recursos ocupan espacio en la mochila...por eso tenemos 8 huecos" —
  // cuenta también los huecos que ocupan los recursos, no solo
  // this.inventory (ver _allSlotEntries).
  hasFreeSlot() {
    return this._allSlotEntries().length < BACKPACK_SLOT_COUNT;
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
    if (uid === "resource-fragmento") { this.closePopup(); this._startTargetingRock(); return; }
    const entry = this.inventory.find((it) => it.uid === uid);
    if (!entry) return;
    this.closePopup();
    if (entry.itemId === "setarcoiris") this._startPlacingSetarcoiris(uid);
    else if (entry.itemId === "bevida") this._startGivingBevida(uid);
    else if (entry.itemId === "atrapapinreles") this._startPlacingAtrapaPinreles(uid);
    else if (entry.itemId === "katapum") this._startTargetingKatapum(uid);
    else if (entry.itemId === "totemvision") this._startPlacingTotemVision(uid);
    else if (entry.itemId === "senuelo") this._startPlacingSenuelo(uid);
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
    // También tus tótems (reparables); el Obelisco no.
    if (typeof Villages !== "undefined") {
      Villages.list.filter((v) => v.owner === "player").forEach((v) => v.el.classList.add("unit--giveable-target"));
    }
    this._bevidaGiveHandler = (e) => this._onBevidaGiveClick(e);
    window.addEventListener("click", this._bevidaGiveHandler, { capture: true });
  },

  _cancelGivingBevida() {
    if (this._givingUid === null) return;
    this._givingUid = null;
    document.body.classList.remove("backpack-giving--bevida");
    Units.list.forEach((u) => u.el.classList.remove("unit--giveable-target"));
    if (typeof Villages !== "undefined") Villages.list.forEach((v) => v.el.classList.remove("unit--giveable-target"));
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
    const totem = typeof Villages !== "undefined" ? Villages.list.find((v) => v.el.contains(e.target)) : null;
    e.preventDefault();
    e.stopPropagation();
    const uid = this._givingUid;
    this._cancelGivingBevida();
    if (isFixedUi || !unitEl) return; // cancela sin gastar, se puede reintentar
    if (totem) {
      if (totem.owner === "player") this._repairTotemWith(uid, totem);
      return;
    }

    const target = Units.list.find((u) => u.id === unitEl.dataset.unitId);
    if (!target || target.team !== "player") return;
    this._giveBevidaTo(uid, target);
  },

  _repairTotemWith(uid, totem) {
    this.inventory = this.inventory.filter((it) => it.uid !== uid);
    totem.hp = totem.maxHp;
    Units.updateHpBar(totem);
    SFX.itemEaten();
    Units.spawnFloatingText(totem, "¡REPARADO!", { className: "dmg-popup gnome-points-popup" });
  },

  _giveBevidaTo(uid, target) {
    this.inventory = this.inventory.filter((it) => it.uid !== uid);
    const type = UNIT_TYPES[target.typeId];
    const bonus = typeof Armory !== "undefined" ? Armory.defenseBonus(target.team) : 0;
    target.hp = type.aguante + bonus + (target.cohesionBonus || 0);
    target.maxHp = type.aguante + bonus + (target.cohesionBonus || 0);
    Units.updateHpBar(target);
    SFX.itemEaten();
    Units.spawnFloatingText(target, "¡BEBEVIDA!", { className: "dmg-popup gnome-points-popup" });
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
  // Pedido explícito (pasada posterior): "cuando lo seleccionas dos
  // veces, el juego te tiene que permitir colocarlos en una casilla
  // adyacente a un jugador que aun este activo" — en el modo actual la
  // partida arranca con CERO unidades reclutadas (solo el Obelisco, ver
  // spawnTestUnits en newgame-flow.js), así que antes de reclutar al
  // primer personaje esta función devolvía siempre una lista vacía (no
  // había ninguna unidad de la que colgar casillas adyacentes) y ningún
  // objeto de la mochila se podía colocar todavía, aunque el Obelisco
  // propio —el "jugador" en el sentido amplio, tu base, siempre activa—
  // ya estuviera en pie. Se añade el Obelisco propio como una fuente más
  // de casillas adyacentes, con exactamente las mismas comprobaciones que
  // ya usaba cada unidad (mismo bucle, extraído a _tilesAroundSource para
  // no duplicar las ocho comprobaciones dos veces).
  _tilesAroundSource(row, col, seen, tiles) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || c < 0 || r >= Units.boardSize || c >= Units.boardSize) continue;
        if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(r, c)) continue;
        // Pedido explícito: "no se pueden colocar setas en lugares
        // donde hay totems o edificios" — mismo criterio que ya usan
        // Combat/GnomeInstance/Villages al buscar casilla libre
        // (Villages.at, ver js/villages.js) para no ofrecer un tótem
        // como destino válido de movimiento/ataque.
        if (typeof Villages !== "undefined" && Villages.at(r, c)) continue;
        // Pedido explícito (Tienda Goblin, js/shops.js): "no se pueden
        // colocar objetos sobre ella" — mismo criterio que un tótem,
        // justo arriba.
        if (typeof Shops !== "undefined" && Shops.at(r, c)) continue;
        if (typeof Obelisks !== "undefined" && Obelisks.at(r, c)) continue; // Obelisco Ancestral (js/obelisks.js)
        if (typeof Altar !== "undefined" && Altar.at(r, c)) continue; // Altar de Sacrificios (js/altar.js)
        if (typeof GnomOgro !== "undefined" && GnomOgro.at(r, c)) continue; // GnomOgro (js/gnomogro.js): casilla ocupada
        if ((typeof Resources !== "undefined" && Resources.at(r, c)) || (typeof Drums !== "undefined" && Drums.at(r, c))) continue; // Recursos de escenario (js/resources.js)
        if (typeof TotemVision !== "undefined" && TotemVision.at(r, c)) continue; // TotemVision (js/totemvision.js)
        // Igual que cualquier otra mecánica del proyecto: no se ofrece
        // colocar nada sobre una loseta que ni siquiera se ha revelado.
        if (typeof Fog !== "undefined" && Fog.isFogged(r, c)) continue;
        const key = `${r},${c}`;
        if (seen.has(key)) continue;
        seen.add(key);
        tiles.push({ row: r, col: c });
      }
    }
  },

  _adjacentToPlayerTiles() {
    if (typeof Units === "undefined") return [];
    const seen = new Set();
    const tiles = [];
    Units.list
      .filter((u) => u.team === "player" && (typeof Turns === "undefined" || Turns.canAct(u)))
      .forEach((u) => this._tilesAroundSource(u.row, u.col, seen, tiles));
    if (typeof Obelisks !== "undefined") {
      Obelisks.list
        .filter((o) => o.team === "player")
        .forEach((o) => this._tilesAroundSource(o.row, o.col, seen, tiles));
    }
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
    // Calidad de sprite dinámica (pedido explícito: "cada Sprite que entre
    // nuevo tendrá que adaptarse a estas mejoras...como la resolución
    // dinámica"), ver js/spritequality.js.
    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(img, ITEM_TYPES.setarcoiris.iconUrl);
    else img.src = ITEM_TYPES.setarcoiris.iconUrl;
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
    el.style.zIndex = String(typeof Bushes !== "undefined" ? Bushes.trapZ(row, col) : (row + col) * 10 + 6);

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

  // ---------- Cepo "AtrapaPinreles" ----------
  // "se coloca en una casilla adyacente a un personaje aun activo" — misma
  // condición ("aún activo" = Turns.canAct) que ya calcula
  // _adjacentToPlayerTiles para la Setarcoiris, así que se reutiliza tal
  // cual en vez de duplicar el bucle.
  _startPlacingAtrapaPinreles(uid) {
    this._placingUid = uid;
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
        onClick: () => this._placeAtrapaPinrelesAt(uid, tile.row, tile.col),
      });
    });
  },

  _placeAtrapaPinrelesAt(uid, row, col) {
    this._placingUid = null;
    Units.markerEls = Units.markerEls.filter((m) => {
      if (m._owner !== "backpack") return true;
      m.remove();
      return false;
    });
    this.inventory = this.inventory.filter((it) => it.uid !== uid);
    this._restoreNormalRange();

    const el = document.createElement("div");
    el.className = "unit board-item board-item--atrapapinreles";
    const img = document.createElement("img");
    img.decoding = "async"; // pedido de rendimiento: no bloquear el hilo principal decodificando
    img.className = "board-item__sprite";
    // Calidad de sprite dinámica (ver nota junto a Setarcoiris más arriba).
    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(img, ITEM_TYPES.atrapapinreles.iconUrl);
    else img.src = ITEM_TYPES.atrapapinreles.iconUrl;
    img.draggable = false;
    img.alt = "";
    el.appendChild(img);
    Units.container.appendChild(el);

    if (typeof getTileCenter !== "undefined") {
      const { x, y } = getTileCenter(row, col, Units.boardSize);
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }
    // Mismo criterio de z-index que la Setarcoiris (+6, por encima de una
    // unidad normal que use la misma casilla) — un cepo tirado en el suelo
    // debe verse, no quedar tapado por quien pise encima.
    el.style.zIndex = String(typeof Bushes !== "undefined" ? Bushes.trapZ(row, col) : (row + col) * 10 + 6);

    if (typeof Fog !== "undefined") el.classList.toggle("unit--fog-hidden", Fog.isFogged(row, col));

    SFX.itemPlace();
    this.traps.push({ uid, itemId: "atrapapinreles", row, col, el });
  },

  // ---------- TotemVision ----------
  // Mismo flujo de colocación exacto que la Setarcoiris/AtrapaPinreles
  // (casilla libre adyacente a un personaje propio aún activo) — la ficha
  // solo dice "casilla libre del escenario", pero para mantener el mismo
  // lenguaje de interacción que el resto de objetos colocables (y no tener
  // que barrer el tablero entero buscando "cualquier" casilla libre) se
  // reutiliza _adjacentToPlayerTiles tal cual. La creación de verdad del
  // tótem (percepción, HP, ataque, rotura en arbusto) vive en su propio
  // archivo — ver js/totemvision.js, regla de oro: un archivo por mecánica.
  _startPlacingTotemVision(uid) {
    this._placingUid = uid;
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
        onClick: () => this._placeTotemVisionAt(uid, tile.row, tile.col),
      });
    });
  },

  _placeTotemVisionAt(uid, row, col) {
    this._placingUid = null;
    Units.markerEls = Units.markerEls.filter((m) => {
      if (m._owner !== "backpack") return true;
      m.remove();
      return false;
    });
    this.inventory = this.inventory.filter((it) => it.uid !== uid);
    this._restoreNormalRange();

    const unit = Units.list.find((u) => u.id === Units.selectedId);
    const team = unit ? unit.team : "player";
    if (typeof TotemVision !== "undefined") TotemVision.place(team, row, col);
    SFX.itemPlace();
  },

  // ---------- Señuelo Explosivo: colocarlo como un gnomo falso ----------
  // Pedido explícito: "se puede colocar sobre una loseta libre de terreno...
  // no puede ser en un arbusto" — reutiliza _adjacentToPlayerTiles (mismo
  // criterio que cualquier otro objeto colocable: junto a un personaje o al
  // propio Obelisco activos) pero descarta además cualquier casilla con
  // arbusto encima (Bushes.at), algo que TotemVision sí permite pero el
  // señuelo no.
  _senueloPlacementTiles() {
    return this._adjacentToPlayerTiles().filter((tile) => {
      if (typeof Bushes !== "undefined" && Bushes.at(tile.row, tile.col)) return false;
      // Un señuelo ES un GnomeInstance más (ver Gnome.spawnDecoy) — a
      // diferencia del resto de objetos colocables, que nunca comprueban
      // esto, aquí hace falta explícitamente: colocarlo encima de un gnomo
      // suelto de verdad (o de otro señuelo ya puesto) los solaparía en la
      // misma casilla.
      if (typeof Gnome !== "undefined" && Gnome.isAt(tile.row, tile.col)) return false;
      return true;
    });
  },

  _startPlacingSenuelo(uid) {
    this._placingUid = uid;
    Units.clearRangeOverlays();
    const tiles = this._senueloPlacementTiles();
    tiles.forEach((tile, i) => {
      Units.addMarker({
        className: "range-marker range-marker--item-target",
        row: tile.row,
        col: tile.col,
        delayIndex: i,
        visibleClass: "range-marker--visible",
        owner: "backpack",
        onClick: () => this._placeSenueloAt(uid, tile.row, tile.col),
      });
    });
  },

  _placeSenueloAt(uid, row, col) {
    this._placingUid = null;
    Units.markerEls = Units.markerEls.filter((m) => {
      if (m._owner !== "backpack") return true;
      m.remove();
      return false;
    });
    this.inventory = this.inventory.filter((it) => it.uid !== uid);
    this._restoreNormalRange();

    const unit = Units.list.find((u) => u.id === Units.selectedId);
    const team = unit ? unit.team : "player";
    // La mecánica de verdad (hacerse pasar por un gnomo suelto, explotar al
    // intentar cogerlo) vive en Gnome.spawnDecoy — ver js/gnome.js, reutiliza
    // TODO el sistema de gnomos sueltos (niebla, aproximación, detección de
    // la IA rival) en vez de duplicarlo.
    if (typeof Gnome !== "undefined") Gnome.spawnDecoy(team, row, col);
    SFX.itemPlace();
  },

  // Llamado desde Units.walkPath (js/units.js), EL único punto de paso de
  // cualquier desplazamiento del proyecto, paso a paso — así "caer en la
  // misma casilla O PASAR SOBRE ELLA" cuentan exactamente igual: se
  // comprueba en CADA salto del camino, no solo en el destino final.
  // Devuelve true si el cepo se ha disparado (para que walkPath corte el
  // resto del camino: "pierde automaticamente el turno" no tendría sentido
  // si el personaje pudiera seguir andando después).
  checkTrapAt(unit, row, col) {
    if (!unit || unit.team === "player") return false; // el jugador nunca activa su propio cepo
    const trap = this.traps.find((t) => t.row === row && t.col === col);
    if (!trap) return false;
    this._springTrap(trap, unit);
    return true;
  },

  // Temblor de cámara + destello blanco global + mensaje grande — mismo
  // trío exacto que usa la seta-trampa de TruenoEspora (Abilities.
  // _playExplosionFeedback, js/abilities.js) y que KataPum ya reutiliza
  // parcialmente aquí mismo (Villages._flashScreen). Se llama ANTES de
  // resolver el daño, para que "algo ha activado el cepo" se lea de un
  // vistazo antes de fijarse en el "-1" concreto.
  _playTrapFeedback(unit) {
    const viewportEl = document.getElementById("board-viewport");
    if (viewportEl) {
      viewportEl.classList.remove("board-viewport--shake");
      void viewportEl.offsetWidth;
      viewportEl.classList.add("board-viewport--shake");
      setTimeout(() => viewportEl.classList.remove("board-viewport--shake"), 420);
    }
    if (typeof Villages !== "undefined") Villages._flashScreen();
    if (typeof SFX !== "undefined") SFX.glory();
    Units.spawnFloatingText(unit, "¡ATRAPADO!", { className: "dmg-popup gnome-points-popup" });
  },

  _springTrap(trap, unit) {
    // Cepo de un solo uso — igual que cualquier trampa física, se "gasta"
    // al atrapar a su primera víctima en vez de quedarse ahí para siempre.
    this.traps = this.traps.filter((t) => t.uid !== trap.uid);
    if (trap.el) trap.el.remove();

    // Pedido explícito: "si cae en ella aparece por pantalla para todos un
    // mensaje informativo igual que el de la seta explosiva" — mismo
    // lenguaje visual que Abilities._playExplosionFeedback (temblor de
    // cámara + destello blanco global + mensaje grande) para la seta-trampa
    // de TruenoEspora, reutilizado aquí tal cual (mismas clases CSS/
    // Villages._flashScreen) en vez de un segundo sistema de feedback.
    this._playTrapFeedback(unit);

    SFX.hit();
    Units.playShake(unit);
    Units.spawnFloatingText(unit, "-1", { className: "dmg-popup" });

    // "ademas hace un punto de daño" — mismo patrón que Combat.attack: si
    // ese punto deja al personaje a 0, se resuelve como cualquier otra
    // baja (Units.removeUnit + Gnome.dropHeldBy) y NO además con la huida
    // de abajo (que ya habría saltado justo antes si llevaba gnomo, y
    // dropHeldBy no hace nada si ya no lleva ninguno) — perder el turno
    // tampoco tiene sentido para una unidad que ya no existe.
    unit.hp = Math.max(0, unit.hp - 1);
    Units.updateHpBar(unit);
    if (unit.hp <= 0) {
      if (typeof Glory !== "undefined") Glory.queueKillBonus("player"); // el cepo es del jugador, el enemigo siempre es quien cae en él
      Units.removeUnit(unit).then(() => {
        if (typeof Gnome !== "undefined") Gnome.dropHeldBy(unit);
      });
      return;
    }

    // "pierde automaticamente el turno"
    if (typeof Turns !== "undefined") Turns.forceOutOfActions(unit);

    // "si tuviera un gnomo cogido se le cae al suelo y hace su tipica huida"
    if (typeof Gnome !== "undefined") {
      const held = Gnome.list.find((g) => g.heldBy === unit.id);
      if (held) held.dropFromStunnedUnit(unit);
    }
  },

  // ---------- Cohete "KataPum!" ----------
  // "Al seleccionarlo eliges un jugador enemigo cualquiera a la vista
  // (dentro de la niebla no)" — mismo patrón de apuntado que
  // Abilities._startUnitPicking (ver js/abilities.js), con su propia copia
  // aquí porque Backpack es un archivo aparte (misma razón que
  // _startGivingBevida/_onBevidaGiveClick ya documentan arriba) y porque
  // el filtro es distinto: CUALQUIER rival visible en todo el tablero, sin
  // límite de distancia (a diferencia de las habilidades, todas cuerpo a
  // cuerpo o adyacentes).
  _startTargetingKatapum(uid) {
    if (typeof Units === "undefined") return;
    const isValidTarget = (u) =>
      u.team !== "player" && u.el && !u.el.classList.contains("unit--fog-hidden");
    const targets = Units.list.filter(isValidTarget);
    if (targets.length === 0) return; // no hay ningún rival a la vista, no se gasta el cohete

    this._katapumUid = uid;
    Units.clearRangeOverlays();
    document.body.classList.add("backpack-giving--katapum");
    targets.forEach((u) => u.el.classList.add("unit--katapum-target"));
    this._katapumPickHandler = (e) => this._onKatapumPickClick(e);
    window.addEventListener("click", this._katapumPickHandler, { capture: true });
  },

  _cancelTargetingKatapum() {
    if (this._katapumUid === null) return;
    this._katapumUid = null;
    document.body.classList.remove("backpack-giving--katapum");
    Units.list.forEach((u) => u.el && u.el.classList.remove("unit--katapum-target"));
    document.querySelectorAll(".unit--katapum-target").forEach((el) => el.classList.remove("unit--katapum-target"));
    this._rockMode = false;
    if (this._katapumPickHandler) {
      window.removeEventListener("click", this._katapumPickHandler, { capture: true });
      this._katapumPickHandler = null;
    }
    this._restoreNormalRange();
  },

  _onKatapumPickClick(e) {
    const isFixedUi = e.target.closest(
      ".unit-info-btn, .ability-btn, .gnome-action-btn, .end-turn-btn, .settings-gear-btn, .backpack-btn, .backpack-close-btn, .glory-hud, .glory-popup-overlay, .unit-info-overlay, .settings-panel"
    );
    const unitEl = e.target.closest(".unit");
    e.preventDefault();
    e.stopPropagation();
    const uid = this._katapumUid;
    const rockMode = this._rockMode;
    this._cancelTargetingKatapum();
    if (isFixedUi || !unitEl) return; // cancela sin gastar, se puede reintentar
    if (rockMode) {
      const t = this._rockTargetFromEl(unitEl);
      if (t) this._launchRock(t);
      return;
    }

    const target = Units.list.find((u) => u.id === unitEl.dataset.unitId);
    if (
      !target ||
      target.team === "player" ||
      (typeof Fog !== "undefined" && Fog.isFogged(target.row, target.col))
    ) {
      return;
    }
    this._launchKatapum(uid, target);
  },

  // ---------- Lanzar roca (fragmentos de los Tambores de Guerra) ----------
  // Misma mecánica de apuntado que el KataPum!, pero el objetivo puede ser
  // un rival, un tótem rival o un Obelisco rival a la vista. Gasta 1
  // fragmento por lanzamiento y quita 1 de vida.
  _rockTargets() {
    const visible = (e) => e.el && !e.el.classList.contains("unit--fog-hidden") && !(typeof Fog !== "undefined" && Fog.isFogged(e.row, e.col));
    const out = [];
    Units.list.filter((u) => u.team !== "player" && visible(u)).forEach((u) => out.push({ kind: "unit", ref: u, row: u.row, col: u.col, el: u.el }));
    if (typeof Villages !== "undefined") Villages.list.filter((v) => v.owner !== "player" && v.owner !== "neutral" && visible(v)).forEach((v) => out.push({ kind: "village", ref: v, row: v.row, col: v.col, el: v.el }));
    if (typeof Obelisks !== "undefined") Obelisks.list.filter((o) => o.team !== "player" && visible(o)).forEach((o) => out.push({ kind: "obelisk", ref: o, row: o.row, col: o.col, el: o.el }));
    if (typeof Volcano !== "undefined") Volcano.rockTargets("player").forEach((t) => out.push(t)); // volcán y lava (js/volcano.js)
    return out;
  },

  _rockTargetFromEl(el) {
    return this._rockTargets().find((t) => t.el === el) || null;
  },

  _startTargetingRock() {
    if (typeof Units === "undefined" || !((Resources.counts.fragmento || 0) > 0)) return;
    const targets = this._rockTargets();
    if (targets.length === 0) return; // nada a la vista: no se gasta
    this._katapumUid = "rock";
    this._rockMode = true;
    Units.clearRangeOverlays();
    document.body.classList.add("backpack-giving--katapum");
    targets.forEach((t) => t.el.classList.add("unit--katapum-target"));
    this._katapumPickHandler = (e) => this._onKatapumPickClick(e);
    window.addEventListener("click", this._katapumPickHandler, { capture: true });
  },

  _launchRock(target) {
    if (!((Resources.counts.fragmento || 0) > 0)) return;
    Resources.counts.fragmento--;
    if (Resources.counts.fragmento <= 0) delete Resources.counts.fragmento;
    this._renderSlots();
    if (this.refreshResourceBadges) this.refreshResourceBadges();
    const selected = Units.list.find((u) => u.id === Units.selectedId && u.team === "player");
    if (selected) Units.faceTowardsTile(selected, target.row, target.col);
    this._animateRockThrow(target);
  },

  _animateRockThrow(target) {
    const btnEl = this._btnEl;
    const startRect = btnEl ? btnEl.getBoundingClientRect() : { left: 40, top: 700, width: 60, height: 60 };
    const endRect = target.el.getBoundingClientRect();
    const start = { x: startRect.left + startRect.width / 2, y: startRect.top + startRect.height / 2 };
    // Se apunta al centro del cuerpo del objetivo.
    const end = { x: endRect.left + endRect.width / 2, y: endRect.top + endRect.height * 0.55 };
    if (btnEl) {
      btnEl.classList.remove("backpack-btn--launch");
      void btnEl.offsetWidth;
      btnEl.classList.add("backpack-btn--launch");
      setTimeout(() => btnEl.classList.remove("backpack-btn--launch"), 380);
    }
    const dx = end.x - start.x, dy = end.y - start.y;
    const dist = Math.hypot(dx, dy);
    const duration = Math.min(1000, 360 + dist * 0.6);
    const arc = Math.min(160, 40 + dist * 0.12);
    const el = document.createElement("div");
    el.className = "rock-projectile";
    const img = document.createElement("img");
    img.src = "assets/niveles/rockntroll/fragmento.png";
    img.className = "rock-projectile__sprite";
    img.draggable = false;
    img.alt = "";
    el.appendChild(img);
    document.body.appendChild(el);
    if (typeof SFX !== "undefined" && SFX.rockThrow) SFX.rockThrow(duration / 1000);
    const spin = (Math.random() < 0.5 ? -1 : 1) * (540 + Math.random() * 360);
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      const x = start.x + dx * t;
      const y = start.y + dy * t - Math.sin(Math.PI * t) * arc;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      img.style.transform = `rotate(${spin * t}deg) scale(${1 - 0.25 * t})`;
      if (t < 1) requestAnimationFrame(step);
      else {
        el.remove();
        this._rockImpact(target);
      }
    };
    requestAnimationFrame(step);
  },

  _rockImpact(target) {
    if (typeof SFX !== "undefined" && SFX.rockHit) SFX.rockHit();
    if (target.kind === "volcano") { Volcano.onRockHit(target.ref, "player"); return; }
    if (target.kind === "lava") { Volcano.extinguish(target.ref); return; }
    if (typeof Drums !== "undefined") {
      const c = getTileCenter(target.row, target.col, Units.boardSize);
      Drums._impact(c.x, c.y, target, true);
      const unit = target.kind === "unit" ? target.ref : null;
      Drums._applyDamage(target, 1, "player");
      if (unit && unit.hp <= 0 && typeof Glory !== "undefined") Glory.queueKillBonus("player");
    }
  },

  // Lanzador: "desde el personaje que lo lanza" (pedido explícito) — el
  // personaje propio seleccionado ahora mismo si lo hay (la mochila ya
  // "ancla" su icono a la cara de quien esté seleccionado, así que es el
  // criterio más natural de "quién lo está usando"); si no hay ninguno
  // seleccionado, el personaje propio más cercano al objetivo elegido —
  // un cohete necesita salir de algún sitio del tablero.
  _launchKatapum(uid, target) {
    this.inventory = this.inventory.filter((it) => it.uid !== uid);

    const selected = Units.list.find((u) => u.id === Units.selectedId && u.team === "player");
    let launcher = selected;
    if (!launcher) {
      const best = Units.list
        .filter((u) => u.team === "player")
        .reduce((acc, u) => {
          const d = Math.max(Math.abs(u.row - target.row), Math.abs(u.col - target.col));
          return !acc || d < acc.d ? { u, d } : acc;
        }, null);
      launcher = best ? best.u : null;
    }
    if (!launcher) return; // caso límite: no queda ningún personaje propio en pie

    Units.faceTowardsTile(launcher, target.row, target.col);
    this._animateKatapumThrow(launcher, target);
  },

  // Vuelo del cohete: JS fotograma a fotograma en línea recta (a
  // diferencia del arco de GnomeInstance.animateThrowTo, un misil
  // teledirigido no bota, va derecho al blanco), con la imagen rotada para
  // que la punta encare siempre la dirección real del trayecto — "asegurate
  // de que el sprite se encara bien en su viaje hasta el enemigo".
  //
  // Pedido explícito (pasada posterior): "el misil goblin cuando se
  // dispara, ahora tiene el punto de origen desde el icono de la mochila.
  // la mochila hara una pequeña animacion cuando salga de ella." — el icono
  // de la mochila vive en la interfaz fija, no en una loseta del tablero,
  // así que hace falta el mismo cambio de espacio de coordenadas que ya usa
  // Resources._flyPickupToBackpack (pero al revés: aquí SALE de la mochila
  // en vez de llegar a ella): todo el vuelo pasa a hacerse con
  // position:fixed en coordenadas reales de pantalla (getBoundingClientRect)
  // en vez de las coordenadas de tablero (getTileCenter) de antes.
  _animateKatapumThrow(launcher, target) {
    return new Promise((resolve) => {
      if (typeof Units === "undefined" || !target.el) return resolve();
      const btnEl = typeof Backpack !== "undefined" ? Backpack._btnEl : null;
      const startRect = btnEl ? btnEl.getBoundingClientRect() : launcher.el.getBoundingClientRect();
      const endRect = target.el.getBoundingClientRect();
      const start = { x: startRect.left + startRect.width / 2, y: startRect.top + startRect.height / 2 };
      const end = { x: endRect.left + endRect.width / 2, y: endRect.top + endRect.height / 2 };

      // "la mochila hara una pequeña animacion cuando salga de ella" —
      // mismo mecanismo de "quitar clase, forzar reflow, volver a
      // ponerla" que el resto del proyecto (ver Resources._collect /
      // .backpack-btn--pulse, usado ahí para RECIBIR un recurso; aquí un
      // "retroceso" propio, .backpack-btn--launch, para LANZAR algo).
      if (btnEl) {
        btnEl.classList.remove("backpack-btn--launch");
        void btnEl.offsetWidth;
        btnEl.classList.add("backpack-btn--launch");
        setTimeout(() => btnEl.classList.remove("backpack-btn--launch"), 380);
      }

      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const distPx = Math.hypot(dx, dy);
      // Mismo idioma que antes (320ms base + más lejos, más tarde, tope en
      // 1100ms) pero ahora en píxeles de pantalla reales en vez de casillas
      // de tablero, ya que el origen ya no es una loseta.
      const duration = Math.min(1100, 320 + distPx * 0.7);

      const el = document.createElement("div");
      el.className = "katapum-projectile katapum-projectile--flying";
      const img = document.createElement("img");
      img.decoding = "async"; // pedido de rendimiento: no bloquear el hilo principal decodificando
      img.className = "katapum-projectile__sprite";
      img.src = ITEM_TYPES.katapum.iconUrl;
      img.draggable = false;
      img.alt = "";
      el.appendChild(img);
      document.body.appendChild(el);

      // La ilustración original ya apunta de fábrica hacia arriba-derecha
      // (45° sobre la horizontal, ver assets/iconos/katapum.png) — se suma
      // ese desfase de fábrica al ángulo real del trayecto (atan2 en
      // coordenadas de pantalla, donde Y crece hacia abajo) para que la
      // punta siempre encare la dirección de vuelo, salga hacia donde
      // salga en el tablero.
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 45;
      img.style.transform = `rotate(${angle}deg)`;

      SFX.gnomeFly(duration / 1000, 1.35); // "el mismo sonido de lanzamiento del gnomo algo mas agudo"

      // Pedido explícito: "el misil puede dejar un trail que se desvanezca
      // en su parte mas lejana al origen mientras vuela? estaria
      // interesante ese efecto" — una franja con gradiente que crece desde
      // el origen (mochila) hasta la posición actual del misil, opaca junto
      // al misil y transparente hacia atrás (el efecto "cometa" habitual:
      // se apaga según se aleja de la punta en vuelo), por encima del
      // rastro de partículas cuadradas ya existente, no en vez de él.
      const trailEl = document.createElement("div");
      trailEl.className = "katapum-trail";
      trailEl.style.left = `${start.x}px`;
      trailEl.style.top = `${start.y}px`;
      trailEl.style.transform = `rotate(${angle - 45}deg)`;
      document.body.appendChild(trailEl);

      let lastParticleAt = 0;
      const PARTICLE_INTERVAL_MS = 45;

      const t0 = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - t0) / duration);
        const x = start.x + dx * t;
        const y = start.y + dy * t;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        trailEl.style.width = `${Math.hypot(x - start.x, y - start.y)}px`;
        // Rastro de partículas cuadradas (pedido explícito: "particulas
        // cuadradas de color amarillo y rojo pequeñas para simular el
        // rastro que deja el cohete") — se dejan quietas en el punto exacto
        // donde iba el cohete en ese instante, no siguen volando con él.
        if (now - lastParticleAt >= PARTICLE_INTERVAL_MS && t < 0.96) {
          lastParticleAt = now;
          this._spawnKatapumTrailParticle(x, y);
        }
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          el.remove();
          trailEl.classList.add("katapum-trail--fadeout");
          setTimeout(() => trailEl.remove(), 220);
          this._explodeKatapum(target);
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  },

  _spawnKatapumTrailParticle(x, y) {
    const el = document.createElement("div");
    el.className =
      "katapum-particle katapum-particle--flying" + (Math.random() < 0.5 ? " katapum-particle--red" : " katapum-particle--yellow");
    el.style.left = `${x + (Math.random() * 16 - 8)}px`;
    el.style.top = `${y + (Math.random() * 16 - 8)}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 420);
  },

  // Pedido explícito (pasada posterior, sustituye al 1-2 original): "el misil
  // katapum goblin ahora hace de 1 a 3 de daño, siendo 1 lo mas comun
  // seguido por un resultado menos comun de 2 y menos comun aun de 3" —
  // 60% / 28% / 12% (daño esperado ~1.52, frente a ~1.25 del reparto
  // 75/25 anterior: de ahí la subida de precio, ver SHOP_STOCK_TEMPLATE en
  // js/shops.js).
  // Pedido explícito: "el misil katapum su daño debería funcionar como un
  // dado de 6: tirada de 1-3 = 1 punto de daño, 4-5 = 2 puntos, 6 = 3 puntos".
  _rollKatapumDamage() {
    const roll = 1 + Math.floor(Math.random() * 6);
    this._lastKatapumRoll = roll;
    return roll <= 3 ? 1 : roll <= 5 ? 2 : 3;
  },

  _explodeKatapum(target) {
    const damage = this._rollKatapumDamage();
    // Se enseña la tirada del dado sobre el objetivo.
    Units.spawnFloatingText(target, `Dado: ${this._lastKatapumRoll}`, { className: "dmg-popup gnome-points-popup" });
    // Escudo/Piel de Roca (js/skills.js) también valen contra el misil; la
    // Evasión no (es teledirigido, no es un golpe cuerpo a cuerpo).
    if (typeof Skills !== "undefined") Skills.resolveDamage(target, damage, { melee: false });
    else {
      target.hp = Math.max(0, target.hp - damage);
      Units.updateHpBar(target);
      Units.spawnFloatingText(target, `-${damage}`, { className: "dmg-popup" });
      Units.playShake(target);
    }
    SFX.explosion();

    // "en el momento del impacto suena una explosion, la camara de la
    // pantalla tiembla y se ilumina de blanco un pequeño instante" — mismo
    // temblor GRANDE y mismo destello blanco de pantalla completa que ya
    // usa Villages._playEpicSmash para su golpe más dramático (un tótem
    // destruido de un solo golpe, ver ese archivo): un impacto de cohete
    // se merece exactamente esa misma categoría de "esto es gordo", así
    // que se reutilizan tal cual en vez de duplicar la animación/el
    // elemento de destello.
    const viewportEl = document.getElementById("board-viewport");
    if (viewportEl) {
      viewportEl.classList.remove("board-viewport--shake--big");
      void viewportEl.offsetWidth;
      viewportEl.classList.add("board-viewport--shake--big");
      setTimeout(() => viewportEl.classList.remove("board-viewport--shake--big"), 420);
    }
    if (typeof Villages !== "undefined") Villages._flashScreen();
    this._spawnKatapumBlast(target.row, target.col);

    if (target.hp <= 0) {
      if (typeof Glory !== "undefined") Glory.queueKillBonus("player"); // el cohete es del jugador, el objetivo siempre es rival
      Units.removeUnit(target).then(() => {
        if (typeof Gnome !== "undefined") Gnome.dropHeldBy(target);
      });
    }
  },

  // Anillo de explosión sobre la propia casilla del objetivo — puramente
  // visual, se desvanece solo (ver @keyframes katapum-blast en style.css).
  _spawnKatapumBlast(row, col) {
    if (typeof getTileCenter === "undefined" || typeof Units === "undefined") return;
    const { x, y } = getTileCenter(row, col, Units.boardSize);
    const el = document.createElement("div");
    el.className = "katapum-blast";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    Units.container.appendChild(el);
    setTimeout(() => el.remove(), 520);
  },
};

Units.registerSelectionListener(Backpack);

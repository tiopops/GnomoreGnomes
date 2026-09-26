/* Gnomore Gnomes — Tienda Goblin.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Colocar la Tienda Goblin (de momento una única) al empezar cada
       partida, en una loseta transitable y libre, lejos de donde arranca
       el jugador.
     - Pintarla (sprite propio, sin barra de vida: nunca se ataca) y
       bloquear su casilla para cualquier unidad, gnomo u objeto — igual
       que un poblado (js/villages.js), del que copia el patrón "unit"
       reutilizado solo por su posicionamiento.
     - Saber, en todo momento, si algún personaje del jugador está justo
       al lado de cada tienda (Shops.refreshAll, llamado desde el único
       punto de paso de cualquier desplazamiento del proyecto, ver
       Units.walkPath) — de eso depende el cursor de moneda y si se puede
       hacer clic para abrir su interfaz.
     - Esa interfaz: un popup igual que el de la mochila (reutiliza sus
       mismas clases CSS) con sus propias 4 casillas de existencias, un
       precio por objeto y un botón COMPRAR que gasta Puntos de Gloria
       (js/glory.js) y manda el objeto comprado a Backpack.inventory
       (js/backpack.js).

   Pedido explícito: "vamos a implementar la nueva mecanica LA TIENDA
   GOBLIN. -es un edificio neutral que aparece en un sitio alejado a la
   misma distancia que la zona donde empiezan los jugadores, en un
   principio solo habra una, pero puede que hayan mas de una en el futuro,
   ya lo decidire -un jugador o enemigo no puede ocupar esta casilla ni se
   pueden colocar objetos sobre ella -cuando el personaje de un jugador
   esta en una casilla adyacente a la tienda goblin, el puntero cambia
   phospor coins de color amarillo fill al pasar el raton por encima de
   ella. al hacer clic sobre ella se habre una interfaz igual que la de la
   mochila, pero es una tienda, el usuario puede hacer clic para ver la
   descripcion de un objeto a la venta y pulsar un boton amarillo en la
   interfaz llamado COMPRAR para gastar puntos de victoria y comprar
   objetos por el valor indicado, de momento pondremos a la venta 2 setas
   (la Tienda Goblin a diferencia de la mochila solo tiene 4 casillas de
   inventario). Cuando se compra un objeto, se descuentan los puntos de
   gloria y el objeto pasa a la mochila del jugador que lo compro".

   Sobre "a la misma distancia que la zona donde empiezan los jugadores":
   de momento solo hay un punto de partida humano (el centro del mapa, ver
   SAFE_RADIUS/spawnSpots en newgame-flow.js), así que "alejado" se
   traduce aquí en "lo más lejos posible de ese centro dentro del mapa" —
   ver targetDist en spawn() más abajo, el único sitio que habría que
   tocar si el día de mañana hay varias tiendas o varios puntos de
   partida y hace falta repartirlas de otra forma ("ya lo decidire",
   pedido explícito). */

const SHOP_COUNT = 1; // "en un principio solo habra una"
const SHOP_SLOT_COUNT = 4; // "a diferencia de la mochila solo tiene 4 casillas"
const SHOP_SPRITE = "assets/edificios/tienda_goblin.png";
const SHOP_INTERACT_RANGE = 1; // cuerpo a cuerpo, igual que VILLAGE_ATTACK_RANGE/Combat.attackRange

// Lo que vende la tienda — mismo itemId que ITEM_TYPES (js/backpack.js),
// con el precio en Puntos de Gloria propio de ESTA tienda (el día de
// mañana con varias tiendas cada una podría cobrar distinto). "de momento
// pondremos a la venta 2 setas": dos entradas independientes del mismo
// itemId (cada una su propio hueco/uid), no una sola con "cantidad: 2".
const SHOP_STOCK_TEMPLATE = [
  { itemId: "setarcoiris", price: 5 },
  { itemId: "setarcoiris", price: 5 },
  // Pedido explícito: "añadimos un nuevo objeto a la tienda 'BeVida'...
  // Cuesta 5 puntos de Gloria" (ver ITEM_TYPES.bevida/ITEM_DESCRIPTIONS.bevida
  // en js/backpack.js).
  { itemId: "bevida", price: 5 },
  // Pedido explícito: "añadimos a la tienda goblin el cepo llamado
  // 'AtrapaPinreles'" (ver ITEM_TYPES.atrapapinreles en js/backpack.js) —
  // cuesta algo más que una Setarcoiris/BeVida al ser un objeto ofensivo de
  // un solo uso garantizado (turno perdido + gnomo caído + daño), no solo
  // utilidad.
  { itemId: "atrapapinreles", price: 6 },
];

// Pedido explícito: "Las tiendas goblin reponen existencias cada 5 turnos,
// con objetos aleatorios de su stock (ahora mismo solo tenemos pociones y
// setas arcoiris pero habran mas)". Fondo del que se sortea CADA hueco al
// reponer — separado de SHOP_STOCK_TEMPLATE (que solo describe la primera
// tienda al empezar la partida): mismos itemId/precio de momento, pero es
// aquí donde habrá que añadir cualquier objeto nuevo el día de mañana para
// que también pueda salir en una reposición.
const SHOP_RESTOCK_POOL = [
  { itemId: "setarcoiris", price: 5 },
  { itemId: "bevida", price: 5 },
  { itemId: "atrapapinreles", price: 6 },
  // Pedido explícito: "añadimos a la tienda goblin un cohete llamado
  // 'KataPum!'" (ver ITEM_TYPES.katapum en js/backpack.js) — el más caro
  // de todos: daño a distancia teledirigido, sin ni siquiera tener que
  // acercarse al objetivo.
  { itemId: "katapum", price: 8 },
];
const SHOP_RESTOCK_INTERVAL = 5; // turnos

const Shops = {
  list: [],
  _nextId: 1,
  _nextStockUid: 1,

  // ---------- Estado del popup abierto ----------
  _activeShop: null, // la tienda cuyo popup está abierto ahora mismo, o null
  _selectedUid: null, // uid del hueco resaltado dentro de ESA tienda
  _overlayEl: null,
  _slotsEl: null,
  _descEl: null,
  _buyBtnEl: null,

  // ---------- Ciclo de vida de la partida ----------
  // Mismo patrón que Villages.resetAll/Gnome.resetAll: se llama al
  // empezar cada partida nueva, antes de spawn().
  resetAll() {
    this.closePopup();
    this.list.forEach((s) => s.el.remove());
    this.list = [];
    // ---------- Reposición cada 5 turnos (ver más abajo) ----------
    this._teamTurnCounts = {};
    this._restockPool = [];
    this._pickNextRestockTarget();
  },

  // Coloca SHOP_COUNT tiendas en losetas transitables, libres (sin unidad,
  // gnomo, poblado NI otra tienda) y alejadas del centro del mapa (donde
  // arranca el jugador, ver cabecera de este archivo) — mismo espíritu que
  // Villages.spawn: intenta unas cuantas veces al azar, primero exigiendo
  // estar lejos de verdad y, si el mapa es demasiado pequeño o está muy
  // lleno para encontrar sitio así, relaja la exigencia poco a poco en vez
  // de no colocar ninguna tienda.
  spawn(boardSize) {
    const mid = Math.floor(boardSize / 2);
    let targetDist = Math.max(1, Math.floor(boardSize / 2) - 2);
    let attempts = 0;
    while (this.list.length < SHOP_COUNT && attempts < 800) {
      attempts++;
      // Cada 200 intentos sin suerte, se acerca un poco el umbral de
      // "lejos" en vez de rendirse — un mapa pequeño con pocos rivales
      // puede no tener ninguna loseta libre tan al borde.
      if (attempts % 200 === 0) targetDist = Math.max(1, targetDist - 1);
      const row = Math.floor(Math.random() * boardSize);
      const col = Math.floor(Math.random() * boardSize);
      const dist = Math.max(Math.abs(row - mid), Math.abs(col - mid));
      if (dist < targetDist) continue;
      if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) continue;
      if (typeof Units !== "undefined" && Units.unitAt(row, col)) continue;
      if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) continue;
      if (typeof Villages !== "undefined" && Villages.at(row, col)) continue;
      if (typeof Obelisks !== "undefined" && Obelisks.at(row, col)) continue; // Obelisco Ancestral (js/obelisks.js)
      if (this.at(row, col)) continue;
      this._create(row, col);
    }
  },

  at(row, col) {
    return this.list.find((s) => s.row === row && s.col === col) || null;
  },

  _create(row, col) {
    // Reutiliza la clase "unit" SOLO por su posicionamiento base
    // (translate(-50%,-92%)) — mismo motivo que .village/.board-item:
    // nunca entra en Units.list, así que nada del motor de
    // combate/movimiento la confunde con una unidad real.
    const el = document.createElement("div");
    el.className = "unit shop";

    const spriteEl = document.createElement("img");
    spriteEl.decoding = "async"; // pedido de rendimiento: no bloquear el hilo principal decodificando
    spriteEl.className = "shop__sprite";
    spriteEl.src = SHOP_SPRITE;
    spriteEl.alt = "";
    spriteEl.draggable = false;
    el.appendChild(spriteEl);
    // Sombra proyectada (js/shadows.js) — la tienda no se mueve/salta, así
    // que la sombra se queda estática, siempre en su tamaño normal.
    if (typeof Shadows !== "undefined") Shadows.attach(spriteEl);

    const shop = {
      id: `shop-${this._nextId++}`,
      row,
      col,
      el,
      spriteEl,
      // Copia propia de la plantilla (cada tienda lleva sus propias
      // existencias/uids, nunca comparte array con otra).
      stock: SHOP_STOCK_TEMPLATE.map((entry) => ({
        uid: this._nextStockUid++,
        itemId: entry.itemId,
        price: entry.price,
      })),
    };

    // "al hacer clic sobre ella se habre una interfaz" — con un personaje
    // del jugador YA al lado (.shop--interactive, actualizada por
    // refreshAll más abajo) esto sigue abriendo gratis, sin gastar ninguna
    // acción; mismo patrón que el clic directo sobre un tótem atacable
    // (Villages._create).
    el.addEventListener("click", (e) => {
      if (el.classList.contains("shop--interactive")) {
        e.stopPropagation();
        // Pedido explícito: "al hacer clic sobre... la tienda goblin este
        // debe reaccionar al clic como ocurre con los personajes" — mismo
        // pulso que Units.select (.unit--selected/unit-select-pulse, ver
        // style.css); la tienda no tiene un estado "seleccionada" propio, así
        // que se dispara como una clase de un solo uso, reiniciando la
        // animación con un reflow forzado por si se pulsa varias veces.
        el.classList.remove("shop--click-pulse");
        void el.offsetWidth;
        el.classList.add("shop--click-pulse");
        this.openPopup(shop);
        return;
      }
      // Segundo pedido explícito: "si la tienda goblin esta dentro del
      // rango de movimiento de un personaje y la pulso deberia moverse
      // hasta la casilla adyacente mas cercana y abrirse la tienda al
      // pulsar sobre el" — hasta ahora esto SOLO se podía hacer con la mira
      // amarilla aparte (Shops.showFor/approachAndOpen, más abajo en este
      // mismo archivo — esa mira ya existía y ya funcionaba), nunca
      // pulsando la propia tienda directamente. Un jugador que pulsa la
      // tienda esperando que su personaje seleccionado se acerque solo es
      // exactamente ese mismo caso, así que si hay una unidad propia
      // seleccionada que puede llegar este turno, el clic directo hace
      // AHORA lo mismo que pulsar esa mira — sin duplicar la lógica de
      // acercarse/abrir, reutiliza approachAndOpen tal cual.
      const unit = typeof Units !== "undefined" ? Units.list.find((u) => u.id === Units.selectedId) : null;
      if (!unit || unit.team !== "player") return;
      if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
      if (!this.findApproachTile(unit, shop)) return;
      e.stopPropagation();
      this.approachAndOpen(unit, shop);
    });

    if (typeof Units !== "undefined") Units.container.appendChild(el);

    this._placeInstant(shop);
    this.list.push(shop);
    return shop;
  },

  _placeInstant(shop) {
    if (typeof getTileCenter === "undefined" || typeof Units === "undefined") return;
    const { x, y } = getTileCenter(shop.row, shop.col, Units.boardSize);
    shop.el.style.left = `${x}px`;
    shop.el.style.top = `${y}px`;
    shop.el.style.zIndex = String((shop.row + shop.col) * 10 + 5);
  },

  // ---------- Interactividad ----------
  // "cuando el personaje de un jugador esta en una casilla adyacente a la
  // tienda goblin, el puntero cambia...al hacer clic sobre ella se habre
  // una interfaz" — se llama desde Units.walkPath (único punto de paso de
  // CUALQUIER desplazamiento del proyecto: movimiento normal, acercarse a
  // atacar/coger el gnomo/un tótem, huida del gnomo...) y también tras
  // colocar el escenario inicial (ver newgame-flow.js), así nunca hace
  // falta llamarlo a mano desde cada mecánica por separado.
  refreshAll() {
    if (typeof Units === "undefined") return;
    this.list.forEach((shop) => {
      const adjacent = Units.list.some(
        (u) =>
          u.team === "player" &&
          Math.max(Math.abs(u.row - shop.row), Math.abs(u.col - shop.col)) <= 1
      );
      shop.el.classList.toggle("shop--interactive", adjacent);
      // Si deja de ser accesible justo con su popup abierto (el personaje
      // que la desbloqueaba se movió, o murió) se cierra sola en vez de
      // dejar comprar a través de una tienda ya fuera de alcance.
      if (!adjacent && this._activeShop === shop) this.closePopup();
    });
  },

  // ---------- Popup (misma interfaz que la mochila, ver js/backpack.js y
  // las clases .backpack-* reutilizadas tal cual en style.css) ----------
  openPopup(shop) {
    if (this._overlayEl) return;
    SFX.click();
    this._activeShop = shop;
    this._selectedUid = null;

    const overlay = document.createElement("div");
    overlay.className = "backpack-overlay";
    overlay.addEventListener("click", () => this.closePopup());

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
    title.textContent = "TIENDA GOBLIN";
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

    const buyBtn = document.createElement("button");
    buyBtn.className = "p5-banner p5-banner--action shop-buy-btn";
    // CORRECCIÓN (misma pasada que el resto de botones, ver notas en
    // style.css): el texto ya NO puede ser un textContent suelto — con el
    // contorno de doble capa (::before/::after), un nodo de texto normal
    // (sin position/z-index propios) se pinta POR DEBAJO de esas capas
    // posicionadas y quedaría invisible. Necesita vivir en su propio
    // <span class="p5-banner__label">, igual que el resto de textos de
    // esta familia de botones.
    buyBtn.innerHTML = '<span class="p5-banner__label">COMPRAR</span>';
    buyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._buySelected();
    });
    panelBg.appendChild(buyBtn);
    this._buyBtnEl = buyBtn;

    // Pedido explícito: "en la tienda goblin si intentas comprar un objeto
    // y tienes insuficientes puntos, debe avisarte con un mensaje en rojo
    // en la misma interfaz" — antes solo había un title (tooltip nativo,
    // hay que dejar el ratón quieto encima para verlo). Este mensaje vive
    // siempre en el DOM (igual que .obelisk__menu) y solo se hace visible
    // desde _buySelected cuando el intento de compra falla por falta de
    // Puntos de Gloria.
    const warning = document.createElement("div");
    warning.className = "shop-warning";
    warning.textContent = "No tienes suficientes Puntos de Gloria";
    panelBg.appendChild(warning);
    this._warningEl = warning;

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
    this._buyBtnEl = null;
    this._warningEl = null;
    this._selectedUid = null;
    this._activeShop = null;
    el.classList.remove("backpack-overlay--visible");
    setTimeout(() => el.remove(), 220);
  },

  // Pinta los SHOP_SLOT_COUNT huecos — los primeros con las existencias
  // reales de esta tienda, el resto (o los que se han ido comprando)
  // vacíos, exactamente igual que _renderSlots en backpack.js.
  _renderSlots() {
    if (!this._slotsEl || !this._activeShop) return;
    const shop = this._activeShop;
    this._slotsEl.innerHTML = "";
    for (let i = 0; i < SHOP_SLOT_COUNT; i++) {
      const entry = shop.stock[i];
      const slotEl = document.createElement("button");
      slotEl.className = "backpack-slot" + (entry ? "" : " backpack-slot--empty");
      if (entry) {
        const def = ITEM_TYPES[entry.itemId];
        // Pedido explícito: "me gustaria que el precio estuviera en una
        // esquina de la casilla sobre un rombo irregular como el de
        // cerrar la interfaz, pero de color amarillo con el numero del
        // precio en negro" — mismo rombo/silueta compartida
        // (--gg-badge-clip/--gg-badge-tilt) que .backpack-close-btn/
        // .settings-gear-btn, ver .shop-slot__price en style.css.
        slotEl.innerHTML =
          `<img src="${def.iconUrl}" class="backpack-slot__icon" alt="${def.name}">` +
          `<span class="shop-slot__price"><span class="shop-slot__price__num">${entry.price}</span></span>`;
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
    this._updateDescAndPrice();
  },

  // A diferencia de la mochila (donde un segundo clic sobre el mismo hueco
  // resaltado USA el objeto), aquí un clic siempre resalta/quita el
  // resaltado sin más — comprar tiene su propio botón dedicado (COMPRAR),
  // así el jugador puede mirar la descripción con calma antes de decidir.
  _onSlotClick(uid) {
    SFX.click();
    this._selectedUid = this._selectedUid === uid ? null : uid;
    if (this._warningEl) this._warningEl.classList.remove("shop-warning--visible");
    this._renderSlots();
  },

  _updateDescAndPrice() {
    if (!this._descEl || !this._activeShop) return;
    const shop = this._activeShop;
    const entry = shop.stock.find((it) => it.uid === this._selectedUid);
    // Pedido explícito: "en la descripcion de cada objeto debe indicarse
    // 'Este objeto cuesta X puntos de gloria.' en color amarillo en
    // negrita" — misma caja de descripción que la mochila
    // (.backpack-desc__text), con esta línea añadida aparte al final
    // (nunca reemplaza el texto de sabor de ITEM_DESCRIPTIONS). Los
    // textos de ambas partes son siempre datos fijos del propio código
    // (nunca contenido del jugador), así que innerHTML aquí es seguro.
    if (entry) {
      const flavor = ITEM_DESCRIPTIONS[entry.itemId] || "";
      this._descEl.innerHTML =
        `${flavor}<br><br><strong class="shop-desc__price-line">Este objeto cuesta ${entry.price} puntos de gloria.</strong>`;
    } else {
      this._descEl.textContent = "";
    }

    if (this._buyBtnEl) {
      const playerPoints = typeof Glory !== "undefined" ? Glory.points.player : 0;
      const canAfford = !!entry && playerPoints >= entry.price;
      const hasRoom = typeof Backpack === "undefined" || Backpack.hasFreeSlot();
      // Pedido explícito: "si intentas comprar un objeto y tienes
      // insuficientes puntos, debe avisarte con un mensaje en rojo en la
      // misma interfaz" — el botón se deja PULSABLE cuando lo único que
      // falta son Puntos de Gloria (para que el clic llegue a
      // _buySelected y muestre el aviso en rojo); solo se deshabilita de
      // verdad cuando no hay nada seleccionado o no hay sitio en la
      // mochila, casos donde comprar no tiene ningún sentido posible.
      this._buyBtnEl.disabled = !entry || !hasRoom;
      if (!entry) this._buyBtnEl.title = "";
      else if (!hasRoom) this._buyBtnEl.title = "La mochila está llena";
      else if (!canAfford) this._buyBtnEl.title = "No tienes suficientes Puntos de Gloria";
      else this._buyBtnEl.title = "";
    }
    if (this._warningEl) this._warningEl.classList.remove("shop-warning--visible");
  },

  _buySelected() {
    const shop = this._activeShop;
    if (!shop || this._selectedUid === null) return;
    const entry = shop.stock.find((it) => it.uid === this._selectedUid);
    if (!entry) return;
    if (typeof Backpack === "undefined" || !Backpack.hasFreeSlot()) return;
    const playerPoints = typeof Glory !== "undefined" ? Glory.points.player : 0;
    if (playerPoints < entry.price) {
      // Pedido explícito: aviso en rojo DENTRO de la interfaz, no solo un
      // title nativo — reutiliza el mismo golpe de "shake" que ya usa el
      // resto del proyecto para feedback de rechazo (ver
      // .shop-warning--visible en style.css).
      if (this._warningEl) {
        this._warningEl.classList.remove("shop-warning--visible");
        // Fuerza un reflow para poder reiniciar la animación de shake si
        // el aviso ya estaba visible (dos intentos seguidos).
        void this._warningEl.offsetWidth;
        this._warningEl.classList.add("shop-warning--visible");
      }
      // Reutiliza el sonido de "fallo" que ya existe (Gnome.dropFail no
      // aplica aquí — SFX.dropFail es genérico, un sawtooth grave que
      // lee claramente como "no" sin necesitar un sonido nuevo).
      SFX.dropFail();
      return;
    }
    if (typeof Glory === "undefined" || !Glory.spend("player", entry.price)) return;

    // "el objeto pasa a la mochila del jugador que lo compro"
    Backpack.addItem(entry.itemId);
    // "de momento pondremos a la venta 2 setas" — sin reposición todavía:
    // el hueco queda vacío para siempre tras comprarlo (mismo aspecto que
    // uno ya vacío de la mochila, ver .backpack-slot--empty).
    shop.stock = shop.stock.filter((it) => it.uid !== entry.uid);
    this._selectedUid = null;
    SFX.buy();
    this._renderSlots();
  },

  // ---------- Proveedor de rango (ver cabecera de units.js) ----------
  // Pedido explícito: "si el movimiento del personaje permite llegar a la
  // tienda para abrirla, el personaje se movera hasta la casilla adyacente
  // mas cercana y la tienda se abrira" — hasta ahora solo se podía abrir
  // con un personaje YA de pie junto a la tienda (shop--interactive/
  // refreshAll, más arriba); eso sigue funcionando tal cual (un clic
  // directo la abre gratis, sin gastar ninguna acción, aunque no haya
  // nada seleccionado). Esto añade el caso que faltaba: con una unidad
  // SELECCIONADA que todavía no está al lado pero SÍ puede llegar
  // moviéndose este turno, aparece una mira (mismo patrón que
  // Villages/Combat) que la acerca sola y abre la tienda en un único
  // clic. Mismo findApproachTile que Villages.findApproachTile, adaptado
  // aquí (SHOP_INTERACT_RANGE en vez de VILLAGE_ATTACK_RANGE y sin la
  // condición de llevar un gnomo cogido: cualquier personaje puede
  // comprar).
  findApproachTile(unit, shop) {
    const type = UNIT_TYPES[unit.typeId];
    const moveRange = type.movimiento;

    const distToShop = (row, col) => Math.max(Math.abs(row - shop.row), Math.abs(col - shop.col));

    if (distToShop(unit.row, unit.col) <= SHOP_INTERACT_RANGE) {
      return { row: unit.row, col: unit.col };
    }

    let best = null;
    let bestDist = Infinity;
    for (let row = 0; row < Units.boardSize; row++) {
      for (let col = 0; col < Units.boardSize; col++) {
        if (row === unit.row && col === unit.col) continue;
        if (distToShop(row, col) > SHOP_INTERACT_RANGE) continue;
        if (Units.unitAt(row, col)) continue;
        if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) continue;
        if (typeof Villages !== "undefined" && Villages.at(row, col)) continue;
        if (this.at(row, col)) continue; // la tienda (la misma u otra)
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

  // Solo pinta una mira de "ir y abrir" para las tiendas que TODAVÍA no
  // están al alcance directo (esas ya se abren con un simple clic, ver
  // refreshAll/el listener de _create) pero sí se puede llegar a ellas
  // moviéndose este turno — evita un marcador redundante encima de una
  // tienda que ya se podía abrir sin él.
  showFor(unit) {
    if (unit.team !== "player") return;
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    this.list.forEach((shop, i) => {
      const dist = Math.max(Math.abs(shop.row - unit.row), Math.abs(shop.col - unit.col));
      if (dist <= SHOP_INTERACT_RANGE) return;
      if (typeof Fog !== "undefined" && Fog.isFogged(shop.row, shop.col)) return;
      if (!this.findApproachTile(unit, shop)) return;
      Units.addMarker({
        className: "attack-marker shop-open-marker",
        row: shop.row,
        col: shop.col,
        zOffset: 2,
        delayIndex: i,
        visibleClass: "attack-marker--visible",
        owner: "shops",
        onClick: () => this.approachAndOpen(unit, shop),
        buildContent: (marker) => {
          const icon = document.createElement("i");
          icon.className = "ph ph-storefront attack-marker__icon";
          marker.appendChild(icon);
        },
      });
    });
  },

  onClear() {
    // Nada que limpiar aparte de los propios marcadores (ya los borra
    // Units.clearRangeOverlays/refreshProviderFor por su cuenta) — a
    // diferencia de Villages, esta mecánica no marca la propia tienda con
    // ninguna clase "--targeted" (el clic directo sobre su sprite sigue
    // dependiendo solo de shop--interactive, no de la selección actual).
  },

  // Igual que Combat.approachAndAttack/Villages.approachAndAttack: se
  // acerca (si hace falta) a la loseta desde la que ya se puede abrir y
  // abre el popup desde ahí, todo en un único clic sobre la mira. Mismo
  // criterio que Movement.moveTo para gastar la acción del turno: SOLO si
  // de verdad hizo falta moverse (si ya estaba al lado, esta mira ni
  // siquiera se pinta, ver showFor) — abrir/comprar en sí nunca ha
  // costado una acción (mismo comportamiento de siempre al abrir con un
  // clic directo estando ya al lado).
  async approachAndOpen(unit, shop) {
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    Units.clearRangeOverlays();
    const approach = this.findApproachTile(unit, shop);
    if (!approach) return; // se movieron/ya no cabe justo antes del clic
    if (approach.row !== unit.row || approach.col !== unit.col) {
      const path = Units.stepPath(unit.row, unit.col, approach.row, approach.col);
      await Units.walkPath(unit, path);
      // Mismo bug ya corregido en Combat/Gnome/Villages.approachAndAttack:
      // acercarse a pie tiene que revelar niebla nueva al detenerse.
      if (typeof Fog !== "undefined" && unit.team === "player") Fog.revealForUnit(unit);
      if (typeof Turns !== "undefined") Turns.useAction(unit);
    }
    this.openPopup(shop);
    Units.refreshRange(unit);
  },

  // ---------- Reposición cada 5 turnos ----------
  // Pedido explícito: "Las tiendas goblin reponen existencias cada 5
  // turnos, con objetos aleatorios de su stock...Cuando esto ocurra se
  // avisara con un mensaje en pantalla al empezar el turno. (el turno
  // donde se reponen las existencias no siempre sera el del mismo
  // jugador, sera cada 5 turnos pero el juego hara de forma aleatoria que
  // quinto turno pertenece, de manera que el proximo 5 turno sera uno de
  // los otros jugadores restantes y asi hasta que todos hayan sido
  // beneficiados. una vez todos hayan tenido esto, se reiniciara la
  // seleccion aleatoria). los objetos son comunes para todos los
  // jugadores, si un jugaor compra todos, se gastan hasta que repongan."
  //
  // Se cuentan los turnos DE CADA EQUIPO por separado (this._teamTurnCounts,
  // incrementado desde Turns.registerTurnStartListener más abajo). El
  // "quinto turno" que dispara la reposición no es siempre el mismo
  // equipo: this._restockPool es una baraja (orden al azar) de los equipos
  // en juego que se va vaciando un equipo cada vez que le toca beneficiarse
  // de una reposición — cuando se vacía del todo (todos ya se han
  // beneficiado una vez) se vuelve a barajar entera para el siguiente
  // ciclo. Motor actual = siempre 2 equipos (jugador/rival, ver
  // js/turns.js), pero está escrito para poder crecer sin tocar esta lógica
  // el día que haya más.
  _teamTurnCounts: {},
  _restockPool: [],
  _nextRestockTeam: null,
  _nextRestockAt: null,
  _restockMsgEl: null,

  _activeTeams() {
    return ["player", "enemy"];
  },

  _shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  // Elige a qué equipo le "toca" la próxima reposición (this._nextRestockTeam)
  // y en qué turno SUYO ocurrirá (this._nextRestockAt = su contador actual
  // + 5) — sacando el siguiente nombre de this._restockPool (rebarajando
  // una baraja nueva si estaba vacía).
  _pickNextRestockTarget() {
    if (this._restockPool.length === 0) this._restockPool = this._shuffled(this._activeTeams());
    this._nextRestockTeam = this._restockPool.shift();
    const current = this._teamTurnCounts[this._nextRestockTeam] || 0;
    this._nextRestockAt = current + SHOP_RESTOCK_INTERVAL;
  },

  // Registrado como oyente de "inicio de turno" (ver Turns.registerTurnStartListener,
  // js/turns.js) — se llama con CADA turno individual, del jugador y del
  // rival, nunca una vez por ronda.
  onTurnStart(team) {
    this._teamTurnCounts[team] = (this._teamTurnCounts[team] || 0) + 1;
    if (team === this._nextRestockTeam && this._teamTurnCounts[team] >= this._nextRestockAt) {
      this._restock();
      this._pickNextRestockTarget();
    }
  },

  // Reposición de verdad: cada tienda vuelve a tener SHOP_SLOT_COUNT
  // huecos llenos, cada uno un objeto al azar de SHOP_RESTOCK_POOL (con
  // repetición — nada impide que salgan dos iguales, como ya pasaba con
  // las "2 setas" iniciales).
  _restock() {
    if (this.list.length === 0) return; // nada que reponer sin tiendas en el mapa
    this.list.forEach((shop) => {
      shop.stock = [];
      for (let i = 0; i < SHOP_SLOT_COUNT; i++) {
        const pick = SHOP_RESTOCK_POOL[Math.floor(Math.random() * SHOP_RESTOCK_POOL.length)];
        shop.stock.push({ uid: this._nextStockUid++, itemId: pick.itemId, price: pick.price });
      }
    });
    // Si el popup de una tienda está abierto ahora mismo, refresca sus
    // huecos en el sitio — no tiene sentido dejar viendo unas existencias
    // ya viejas mientras el aviso de reposición está en pantalla.
    if (this._activeShop) {
      this._selectedUid = null;
      this._renderSlots();
    }
    SFX.captureVillage(); // mismo "sonido de satisfacción" que conquistar un tótem — encaja igual aquí
    this._showRestockMessage();
  },

  // Aviso central en pantalla (mismo patrón "crear una vez, reutilizar" que
  // Villages._flashScreen/#epic-smash-flash) — pedido explícito: "se
  // avisara con un mensaje en pantalla al empezar el turno".
  _showRestockMessage() {
    if (!this._restockMsgEl) {
      const el = document.createElement("div");
      el.className = "shop-restock-msg";
      el.innerHTML =
        '<i class="ph ph-storefront shop-restock-msg__icon"></i>' +
        '<span class="p5-banner__label">¡La Tienda Goblin ha repuesto existencias!</span>';
      document.body.appendChild(el);
      this._restockMsgEl = el;
    }
    this._restockMsgEl.classList.remove("shop-restock-msg--visible");
    void this._restockMsgEl.offsetWidth;
    this._restockMsgEl.classList.add("shop-restock-msg--visible");
  },
};

Units.registerRangeProvider(Shops);
if (typeof Turns !== "undefined") Turns.registerTurnStartListener(Shops);

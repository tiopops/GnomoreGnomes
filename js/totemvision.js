/* Gnomore Gnomes — objeto de tienda "TotemVision".
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Colocar un tótem propio (colocación real en js/backpack.js, esto
       solo crea el objeto de tablero) que otorga percepción permanente en
       un radio de 3 casillas a su equipo, mientras siga en pie.
     - Tener 1 punto de vida y poder ser atacado (solo por el equipo
       RIVAL, nunca por su propio dueño), rompiéndose con cualquier golpe.
     - Romperse también si un personaje enemigo entra en el mismo arbusto
       donde esté escondido, aunque no llegue a atacarlo (ver
       checkBushEntry, llamado desde Bushes.checkStepInto).

   Pedido explícito (verbatim): "nuevo objeto para la tienda goblin
   TotemVision. Se coloca sobre una casilla libre (no de agua) del
   escenario y otorga vision como si tuviera percepcion 3. tiene 1 punto de
   vida, un enemigo puede golpearlo. se pueden ocultar dentro de un
   arbusto, pero si un personaje enemigo entra dentro del arbusto, el
   totem se rompe, dejado de hacer efecto." */

const TOTEM_VISION_PERCEPTION_RADIUS = 3;
const TOTEM_VISION_MAX_HP = 1;

const TotemVision = {
  list: [],
  _nextId: 1,

  resetAll() {
    this.list.forEach((t) => t.el && t.el.remove());
    this.list = [];
  },

  at(row, col) {
    return this.list.find((t) => t.row === row && t.col === col) || null;
  },

  // Crea el objeto de tablero de verdad — llamado desde
  // Backpack._placeTotemVisionAt tras elegir la casilla.
  place(team, row, col) {
    const el = document.createElement("div");
    el.className = "unit board-item board-item--totemvision";

    const spriteEl = document.createElement("img");
    spriteEl.decoding = "async"; // pedido de rendimiento: no bloquear el hilo principal decodificando
    spriteEl.className = "board-item__sprite totemvision__sprite";
    // Calidad de sprite dinámica (pedido explícito, "cada Sprite que entre
    // nuevo tendrá que adaptarse a estas mejoras"), ver js/spritequality.js.
    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(spriteEl, ITEM_TYPES.totemvision.iconUrl);
    else spriteEl.src = ITEM_TYPES.totemvision.iconUrl;
    spriteEl.alt = "";
    spriteEl.draggable = false;
    el.appendChild(spriteEl);
    if (typeof Shadows !== "undefined") Shadows.attach(spriteEl);

    // Barra de vida de un único segmento (1 punto de vida) — mismo
    // lenguaje visual que cualquier otra unidad/nodo de recurso.
    const hpBarEl = document.createElement("div");
    hpBarEl.className = "unit__hpbar totemvision__hpbar";
    const seg = document.createElement("div");
    seg.className = "unit__hpbar-segment";
    hpBarEl.appendChild(seg);
    el.appendChild(hpBarEl);

    if (typeof Units !== "undefined") Units.container.appendChild(el);

    const totem = {
      id: `totemvision-${this._nextId++}`,
      team,
      row,
      col,
      el,
      spriteEl,
      hpBarEl,
      hpSegmentEls: [seg],
      hp: TOTEM_VISION_MAX_HP,
      maxHp: TOTEM_VISION_MAX_HP,
    };

    if (typeof getTileCenter !== "undefined" && typeof Units !== "undefined") {
      const { x, y } = getTileCenter(row, col, Units.boardSize);
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }
    el.style.zIndex = String((row + col) * 10 + 5);
    if (typeof Units !== "undefined" && Units.updateHpBar) Units.updateHpBar(totem);

    this.list.push(totem);
    // La percepción nueva puede revelar/ocultar cosas de golpe (o hacer
    // que el propio tótem, si es rival, deje de estar oculto para el
    // jugador) — mismo punto único de paso que cualquier otra mecánica.
    if (typeof Fog !== "undefined") Fog.applyVisibility();
    return totem;
  },

  // ---------- Percepción ----------
  // Llamado desde Fog._recomputePerception (mismo patrón que
  // Villages/Obelisks, ver ese archivo) — un tótem roto ya no está en
  // this.list, así que deja de aportar nada solo con desaparecer de aquí.
  markPerception(markAround) {
    this.list.forEach((t) => {
      if (t.team === "player") markAround(t.row, t.col, TOTEM_VISION_PERCEPTION_RADIUS);
    });
  },

  // ---------- Visibilidad bajo niebla ----------
  // Llamado desde Fog.applyVisibility (mismo patrón que Villages/Shops):
  // "NADA debe verse si tiene niebla encima" — el tótem del propio jugador
  // nunca se oculta a sus propios ojos (igual que su Obelisco), solo el
  // del rival sigue las reglas normales de niebla/percepción.
  refreshFogVisibility() {
    this.list.forEach((t) => {
      if (!t.el) return;
      if (t.team === "player") {
        t.el.classList.remove("unit--fog-hidden", "gg-remembered");
        return;
      }
      const fogged = typeof Fog !== "undefined" && Fog.isFogged(t.row, t.col);
      const perceived = typeof Fog === "undefined" || Fog.isPerceived(t.row, t.col);
      t.el.classList.toggle("unit--fog-hidden", fogged || !perceived);
      t.el.classList.toggle("gg-remembered", !fogged && !perceived);
    });
  },

  // ---------- Ataque (solo el equipo RIVAL, 1 punto de vida) ----------
  showFor(unit) {
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    this.list.forEach((totem, i) => {
      if (totem.team === unit.team) return; // nunca atacable por su propio dueño
      if (!totem.el || totem.el.classList.contains("unit--fog-hidden")) return;
      const approach = this.findApproachTile(unit, totem);
      if (!approach) return;
      const needsMove = approach.row !== unit.row || approach.col !== unit.col;
      if (needsMove && typeof Turns !== "undefined" && Turns.remainingActions(unit) < 2) return;
      Units.addMarker({
        className: "attack-marker totemvision-attack-marker",
        row: totem.row,
        col: totem.col,
        zOffset: 2,
        delayIndex: i,
        visibleClass: "attack-marker--visible",
        owner: "totemvision",
        alwaysOnTop: true,
        onClick: () => this.approachAndAttack(unit, totem),
        buildContent: (marker) => {
          const icon = document.createElement("i");
          icon.className = "ph ph-crosshair-simple attack-marker__icon";
          marker.appendChild(icon);
        },
      });
    });
  },

  onClear() {},

  // Mismo cálculo exacto que Resources.findApproachTile (ver ese archivo):
  // ya a distancia de ataque se queda quieto, si no busca la casilla libre
  // de alcance más cercana dentro de su propio movimiento.
  findApproachTile(unit, totem) {
    const type = UNIT_TYPES[unit.typeId];
    const moveRange = type.movimiento;
    const attackRange = type.attackRange;
    const distToTotem = (row, col) => Math.max(Math.abs(row - totem.row), Math.abs(col - totem.col));

    if (distToTotem(unit.row, unit.col) <= attackRange) {
      return { row: unit.row, col: unit.col };
    }

    let best = null;
    let bestDist = Infinity;
    for (let row = 0; row < Units.boardSize; row++) {
      for (let col = 0; col < Units.boardSize; col++) {
        if (row === unit.row && col === unit.col) continue;
        if (distToTotem(row, col) > attackRange) continue;
        if (Units.unitAt(row, col)) continue;
        if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) continue;
        if (typeof Villages !== "undefined" && Villages.at(row, col)) continue;
        if (typeof Shops !== "undefined" && Shops.at(row, col)) continue;
        if (typeof Obelisks !== "undefined" && Obelisks.at(row, col)) continue;
        if (typeof Altar !== "undefined" && Altar.at(row, col)) continue; // Altar de Sacrificios (js/altar.js)
        if (typeof GnomOgro !== "undefined" && GnomOgro.at(row, col)) continue; // GnomOgro (js/gnomogro.js): casilla ocupada
        if (typeof Resources !== "undefined" && Resources.at(row, col)) continue;
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

  async approachAndAttack(unit, totem) {
    Units.clearRangeOverlays();
    const approach = this.findApproachTile(unit, totem);
    if (!approach || !this.list.includes(totem)) return;
    if (approach.row !== unit.row || approach.col !== unit.col) {
      if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
      const path = Units.stepPath(unit.row, unit.col, approach.row, approach.col);
      await Units.walkPath(unit, path);
      if (typeof Turns !== "undefined") Turns.useAction(unit);
      if (typeof Fog !== "undefined" && unit.team === "player") Fog.revealForUnit(unit);
    }
    const type = UNIT_TYPES[unit.typeId];
    const distNow = Math.max(Math.abs(unit.row - totem.row), Math.abs(unit.col - totem.col));
    if (distNow > type.attackRange) return;
    await this.attack(unit, totem);
  },

  async attack(unit, totem) {
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    if (!this.list.includes(totem)) return;
    if (typeof Units !== "undefined" && Units.faceTowardsTile) Units.faceTowardsTile(unit, totem.row, totem.col);
    if (typeof Turns !== "undefined") Turns.useAction(unit);

    // 1 punto de vida siempre: cualquier golpe (sea cual sea la fuerza del
    // atacante) lo destruye de un solo toque, "un enemigo puede golpearlo"
    // no distingue de cuánto daño.
    totem.hp = 0;
    if (typeof Units !== "undefined" && Units.updateHpBar) Units.updateHpBar(totem);
    if (typeof Units !== "undefined" && Units.spawnFloatingText) Units.spawnFloatingText(totem, "-1", { className: "dmg-popup" });
    if (typeof Units !== "undefined" && Units.playShake) Units.playShake(totem);
    if (typeof SFX !== "undefined") SFX.hit();

    if (unit.el && unit.spriteEl) {
      unit.el.classList.remove("unit--punching");
      void unit.spriteEl.offsetWidth;
      unit.el.classList.add("unit--punching");
      setTimeout(() => unit.el.classList.remove("unit--punching"), 320);
    }

    await this._destroy(totem);
  },

  async _destroy(totem) {
    this.list = this.list.filter((t) => t.id !== totem.id);
    if (typeof Fog !== "undefined") Fog.applyVisibility(); // pierde su radio de percepción al instante
    if (!totem.el) return;
    totem.el.classList.add("resource-node--destroyed"); // misma animación de rotura que un nodo de recurso
    if (typeof SFX !== "undefined") SFX.death();
    await new Promise((resolve) => setTimeout(resolve, 320));
    totem.el.remove();
  },

  // ---------- Rotura al entrar un rival en su arbusto ----------
  // Llamado desde Bushes.checkStepInto (js/bushes.js), en el mismo punto
  // de entrada que la emboscada de unidades — pedido explícito: "si un
  // personaje enemigo entra dentro del arbusto, el totem se rompe,
  // dejando de hacer efecto", incluso si ese enemigo no llega a atacarlo
  // directamente (basta con pisar la misma casilla).
  checkBushEntry(enteringUnit, row, col) {
    const totem = this.at(row, col);
    if (!totem || totem.team === enteringUnit.team) return;
    this._destroy(totem);
  },
};

Units.registerRangeProvider(TotemVision);

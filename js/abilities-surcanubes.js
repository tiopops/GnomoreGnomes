/* Gnomore Gnomes — habilidades del Equipo SurcaNubes (Hurrycrane Village).
   Regla de oro: un archivo por mecánica. Se carga DESPUÉS de js/abilities.js y
   se engancha a él sin tocar su lógica: añade las 3 entradas a ABILITIES y
   envuelve Abilities._activate / onTurnStart / _refreshButton y
   Units.moveRangeOf.
     - ManosLargas · Dedos Largos: con un rival adyacente, abre SU mochila
       (recursos con toda la pila + objetos de la tienda goblin que compró) y
       roba una cosa, que vuela hasta la mochila del jugador.
     - AlaFugaz · Aterrizaje Forzoso: sale disparada hacia arriba y cae desde
       el cielo en una casilla libre a máx. 7 casillas. Siempre se hace 1-3 de
       daño (puede morir) y hace 1 de daño a los rivales adyacentes. Si lleva
       un gnomo, se le cae al aterrizar.
     - NidoBot · Incubar: 1.ª pulsación empieza a incubar; cada turno propio
       acumula carga (más rojo y vibrando más rápido, menos movimiento). 2.ª
       pulsación libera la explosión: daño y empuje a TODOS (aliados incluidos)
       en un radio de 1/2/3 casillas, y daño propio de 1/2/5 (a 3+ turnos muere).
   Animaciones aprobadas con el demo (demo_surcanubes_habilidades.html). */

Object.assign(ABILITIES, {
  manos_largas: {
    name: "Dedos Largos",
    icon: "ph-hand-grabbing",
    iconImg: "assets/iconos/dedos_largos.png",
    description:
      "Con un rival adyacente, abre su mochila y roba un recurso (con toda su pila) o un objeto de la tienda goblin: pasa a tu mochila. Gasta 1 acción. Un uso por partida: se recarga si empiezas el turno junto a un tótem propio.",
  },
  ala_fugaz: {
    name: "Aterrizaje Forzoso",
    icon: "ph-airplane-landing",
    iconImg: "assets/iconos/aterrizaje_forzoso.png",
    description:
      "Sale disparada hacia el cielo y cae sobre una casilla libre a un máximo de 7 casillas. Siempre recibe entre 1 y 3 puntos de daño (puede morir) y hace 1 punto de daño a los rivales adyacentes a la casilla de aterrizaje. Si lleva un gnomo, se le cae al aterrizar. Gasta 1 acción. Un uso por partida: se recarga si empiezas el turno junto a un tótem propio.",
  },
  nidobot: {
    name: "Incubar",
    icon: "ph-egg",
    iconImg: "assets/iconos/incubar.png",
    description:
      "Púlsala para empezar a incubar y vuelve a pulsarla cuando quieras para liberar la explosión. Cada turno incubando se pone más rojo y vibra más rápido, y se mueve menos (-1, -2 y, a 3 o más turnos, solo una casilla). Al liberar: tras 1 turno, 1 de daño a rivales y aliados a 1 casilla y 1 de daño propio; tras 2 turnos, 2 de daño a 2 casillas y 2 de daño propio; tras 3 o más, 3 de daño a 3 casillas y 5 de daño propio (no sobrevive). La explosión empuja 1, 2 o 3 casillas en dirección contraria a NidoBot. Un uso por partida: se recarga si empiezas el turno junto a un tótem propio.",
  },
});

// ---------- Lista de objetos del rival (la IA no tiene mochila: se apunta aquí lo que compra) ----------
if (typeof Backpack !== "undefined") {
  Backpack.aiItems = Backpack.aiItems || {};
  const _origReset = Backpack.resetAll;
  Backpack.resetAll = function () {
    this.aiItems = {};
    return _origReset.apply(this, arguments);
  };
}

const SurcaNubes = {
  _popupEl: null,
  _popupSelUid: null,

  cheb(a, b) {
    return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
  },

  sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  },

  // Daño genérico de una habilidad (mismo tratamiento que una baja normal).
  async hurt(unit, dmg, causerTeam, { minHp = 0 } = {}) {
    unit.hp = Math.max(minHp, unit.hp - dmg);
    Units.updateHpBar(unit);
    Units.spawnFloatingText(unit, `-${dmg}`, { className: "dmg-popup" });
    Units.playShake(unit);
    if (typeof SFX !== "undefined") SFX.hit();
    if (unit.hp <= 0) {
      if (causerTeam && unit.team !== causerTeam && typeof Glory !== "undefined") Glory.queueKillBonus(causerTeam);
      await Units.removeUnit(unit);
      if (typeof Gnome !== "undefined") await Gnome.dropHeldBy(unit);
    }
  },

  // Recalcula todo lo que depende de dónde está una unidad tras moverla a la fuerza.
  settle(unit) {
    if (typeof Bushes !== "undefined") Bushes.clearHiddenUnit(unit.id);
    Abilities.checkTrigger(unit);
    if (typeof Skills !== "undefined") Skills.refreshCohesion();
    if (typeof Fog !== "undefined" && unit.team === "player") Fog.revealForUnit(unit);
    if (typeof Fog !== "undefined") Fog.applyVisibility();
    if (typeof Villages !== "undefined") Villages.refreshOcclusion();
    if (typeof Obelisks !== "undefined") Obelisks.refreshOcclusion();
    if (typeof Altar !== "undefined") Altar.refreshOcclusion();
    if (typeof Bushes !== "undefined") Bushes.refreshOcclusion();
    Units.refreshUnitOcclusion();
    if (typeof Shops !== "undefined") Shops.refreshAll();
    Units.refreshRange(unit);
  },

  tileIsFree(row, col) {
    if (Units.unitAt(row, col)) return false;
    if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) return false;
    if (typeof Villages !== "undefined" && Villages.at(row, col)) return false;
    if (typeof Shops !== "undefined" && Shops.at(row, col)) return false;
    if (typeof Obelisks !== "undefined" && Obelisks.at(row, col)) return false;
    if (typeof Altar !== "undefined" && Altar.at(row, col)) return false;
    if (typeof GnomOgro !== "undefined" && GnomOgro.at(row, col)) return false;
    if ((typeof Resources !== "undefined" && Resources.at(row, col)) || (typeof Drums !== "undefined" && Drums.at(row, col))) return false;
    if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) return false;
    if (typeof Fog !== "undefined" && Fog.isFogged(row, col)) return false;
    return true;
  },

  // =====================================================================
  // ManosLargas · Dedos Largos
  // =====================================================================
  activateLongFingers(unit) {
    const valid = (u) => u.team !== unit.team && this.cheb(u, unit) <= 1;
    const targets = Units.list.filter(valid);
    if (targets.length === 0) return; // sin rival adyacente no se gasta
    if (targets.length === 1) this.openRivalBackpack(unit, targets[0]);
    else
      Abilities._startUnitPicking(unit, {
        cursorClass: "ability-targeting--punch",
        filter: valid,
        hint: "Elige a qué rival robar",
        onPick: (t) => this.openRivalBackpack(unit, t),
      });
  },

  // Contenido de la mochila de un equipo: recursos (pila entera) + objetos. El jugador
  // local usa su mochila real; los demás (IA o rival online) llevan la cuenta en
  // Backpack.aiItems (ver Shops.attemptAutoBuy / Shops.purchase).
  rivalEntries(team) {
    const out = [];
    const counts = typeof Resources !== "undefined" ? Resources.countsFor(team) : {};
    Object.keys(typeof RESOURCE_TYPES !== "undefined" ? RESOURCE_TYPES : {}).forEach((id) => {
      if ((counts[id] || 0) > 0) out.push({ uid: `resource-${id}`, kind: "resource", resourceId: id, count: counts[id] });
    });
    const items = team === "player" ? Backpack.inventory : (Backpack.aiItems && Backpack.aiItems[team]) || [];
    items.forEach((it) => out.push({ uid: `item-${it.uid}`, kind: "item", itemId: it.itemId, itemUid: it.uid }));
    return out;
  },

  openRivalBackpack(unit, target) {
    if (this._popupEl) return;
    Units.clearRangeOverlays();
    Units.faceTowardsTile(unit, target.row, target.col);
    this.stretchToward(unit, target);
    if (this.rivalEntries(target.team).length === 0) {
      Units.spawnFloatingText(target, "¡Mochila vacía!", { className: "dmg-popup" });
      return; // no se gasta
    }
    SFX.click();
    this._popupSelUid = null;
    const overlay = document.createElement("div");
    overlay.className = "backpack-overlay";
    overlay.addEventListener("click", () => this.closeRivalBackpack());
    const panel = document.createElement("div");
    panel.className = "backpack-panel";
    panel.addEventListener("click", (e) => e.stopPropagation());
    const bg = document.createElement("div");
    bg.className = "p5-banner backpack-panel__bg";
    panel.appendChild(bg);
    const closeBtn = document.createElement("button");
    closeBtn.className = "backpack-close-btn";
    closeBtn.setAttribute("aria-label", "Cerrar");
    closeBtn.innerHTML = '<i class="ph ph-x backpack-close-btn__icon"></i>';
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.closeRivalBackpack();
    });
    panel.appendChild(closeBtn);
    const title = document.createElement("div");
    title.className = "p5-banner__label backpack-panel__title";
    title.textContent = "MOCHILA RIVAL";
    bg.appendChild(title);
    const slots = document.createElement("div");
    slots.className = "backpack-slots";
    bg.appendChild(slots);
    const desc = document.createElement("div");
    desc.className = "backpack-desc";
    desc.innerHTML = '<p class="backpack-desc__text"></p>';
    bg.appendChild(desc);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    this._popupEl = { overlay, slots, desc: desc.querySelector(".backpack-desc__text"), unit, target };
    this.renderRivalSlots();
    requestAnimationFrame(() => overlay.classList.add("backpack-overlay--visible"));
  },

  closeRivalBackpack(stolen) {
    if (!this._popupEl) return;
    const el = this._popupEl.overlay;
    const u = this._popupEl.unit;
    if (!stolen && u && u.spriteEl) u.spriteEl.getAnimations().forEach((a) => a.cancel()); // sin robar: deja de estar estirado
    this._popupEl = null;
    this._popupSelUid = null;
    el.classList.remove("backpack-overlay--visible");
    setTimeout(() => el.remove(), 220);
  },

  renderRivalSlots() {
    const p = this._popupEl;
    if (!p) return;
    const entries = this.rivalEntries(p.target.team);
    p.slots.innerHTML = "";
    for (let i = 0; i < BACKPACK_SLOT_COUNT; i++) {
      const entry = entries[i];
      const b = document.createElement("button");
      b.className = "backpack-slot" + (entry ? "" : " backpack-slot--empty");
      if (entry) {
        if (entry.kind === "resource") {
          const def = RESOURCE_TYPES[entry.resourceId];
          b.className += " backpack-slot--resource";
          b.innerHTML = `<img src="${def.iconUrl}" class="backpack-slot__icon" alt="${def.name}"><span class="shop-slot__price"><span class="shop-slot__price__num">${entry.count}</span></span>`;
        } else {
          const def = ITEM_TYPES[entry.itemId];
          b.innerHTML = `<img src="${def.iconUrl}" class="backpack-slot__icon" alt="${def.name}">`;
        }
        b.classList.toggle("backpack-slot--selected", entry.uid === this._popupSelUid);
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          this.onRivalSlot(entry);
        });
      } else b.disabled = true;
      p.slots.appendChild(b);
    }
    this.describeRivalSlot(entries.find((e) => e.uid === this._popupSelUid));
  },

  describeRivalSlot(entry, note) {
    const d = this._popupEl && this._popupEl.desc;
    if (!d) return;
    d.textContent = "";
    if (!entry) {
      d.textContent = "Elige qué robar. Un recurso se lleva toda su pila.";
      return;
    }
    const name = document.createElement("span");
    name.className = "backpack-desc__name";
    const text = document.createElement("span");
    if (entry.kind === "resource") {
      name.textContent = `${RESOURCE_TYPES[entry.resourceId].name} x${entry.count}`;
      text.textContent = (typeof RESOURCE_DESCRIPTIONS !== "undefined" && RESOURCE_DESCRIPTIONS[entry.resourceId]) || "";
    } else {
      name.textContent = ITEM_TYPES[entry.itemId].name;
      text.textContent = ITEM_DESCRIPTIONS[entry.itemId] || "";
    }
    d.appendChild(name);
    d.appendChild(document.createElement("br"));
    d.appendChild(text);
    const n = document.createElement("span");
    n.className = "backpack-desc__note";
    n.textContent = ` ${note || "Púlsalo otra vez para robarlo."}`;
    d.appendChild(n);
  },

  onRivalSlot(entry) {
    if (this._popupSelUid !== entry.uid) {
      SFX.click();
      this._popupSelUid = entry.uid;
      this.renderRivalSlots();
      return;
    }
    // Segunda pulsación: robar (si cabe en TU mochila)
    const mine = Resources.counts;
    const fits = entry.kind === "resource" ? (mine[entry.resourceId] || 0) > 0 || Backpack.hasFreeSlot() : Backpack.hasFreeSlot();
    if (!fits) {
      this.describeRivalSlot(entry, "Tu mochila está llena.");
      return;
    }
    this.steal(entry);
  },

  // Paso 1 (solo quien juega): lee la selección del popup y lanza el robo.
  steal(entry) {
    const { unit, target } = this._popupEl;
    const slotEl = [...this._popupEl.slots.querySelectorAll(".backpack-slot")].find((b) => b.classList.contains("backpack-slot--selected"));
    const from = slotEl ? slotEl.getBoundingClientRect() : null;
    const iconSrc = slotEl && slotEl.querySelector("img") ? slotEl.querySelector("img").src : "";
    this.closeRivalBackpack(true);
    return this.stealFrom(unit, target, entry.kind, entry.kind === "resource" ? entry.resourceId : entry.itemId, from, iconSrc);
  },

  // Paso 2 (hook multijugador "ab.steal"): traspasa el botín de la mochila de `target`
  // a la de `unit`. kind: "resource" (id = recurso, pila entera) | "item" (id = itemId).
  async stealFrom(unit, target, kind, id, from, iconSrc) {
    const tTeam = target.team, uTeam = unit.team;
    let label = "";
    if (kind === "resource") {
      const src = Resources.countsFor(tTeam);
      const amount = src[id] || 0;
      src[id] = 0;
      const dst = Resources.countsFor(uTeam);
      dst[id] = (dst[id] || 0) + amount;
      label = `+${amount} ${RESOURCE_TYPES[id].name}`;
    } else {
      if (tTeam === "player") {
        const i = Backpack.inventory.findIndex((it) => it.itemId === id);
        if (i >= 0) Backpack.inventory.splice(i, 1);
      } else if (Backpack.aiItems && Backpack.aiItems[tTeam]) {
        const i = Backpack.aiItems[tTeam].findIndex((it) => it.itemId === id);
        if (i >= 0) Backpack.aiItems[tTeam].splice(i, 1);
      }
      if (uTeam === "player") Backpack.addItem(id);
      else (Backpack.aiItems[uTeam] = Backpack.aiItems[uTeam] || []).push({ uid: "st" + Date.now() + Math.floor(Math.random() * 1e6), itemId: id });
      label = `+${ITEM_TYPES[id].name}`;
    }
    Abilities._consume(unit);
    if (typeof Backpack.refreshResourceBadges === "function") Backpack.refreshResourceBadges();
    if (Backpack._overlayEl && Backpack._renderSlots) Backpack._renderSlots();
    if (typeof SFX !== "undefined" && SFX.itemPlace) SFX.itemPlace();
    if (uTeam === "player" && from) {
      await this.flyToBackpack(iconSrc, from);
      this.floatText(label);
    }
    Units.spawnFloatingText(unit, uTeam === "player" ? "¡Robado!" : "¡Te ha robado!", { className: "dmg-popup popup--good" });
    this.recoil(unit);
    Units.refreshRange(unit);
  },

  // El objeto robado vuela desde la mochila rival hasta TU icono de mochila.
  async flyToBackpack(src, from) {
    const dest = document.querySelector(".backpack-btn");
    const hr = dest ? dest.getBoundingClientRect() : { left: 20, top: innerHeight - 100, width: 60, height: 60 };
    const fl = document.createElement("img");
    fl.src = src;
    fl.className = "surcanubes-fly-item";
    fl.style.left = `${from.left + from.width / 2 - 24}px`;
    fl.style.top = `${from.top + from.height / 2 - 24}px`;
    document.body.appendChild(fl);
    const ex = hr.left + hr.width / 2 - (from.left + from.width / 2);
    const ey = hr.top + hr.height / 2 - (from.top + from.height / 2);
    await fl.animate(
      [
        { transform: "translate(0,0) scale(1.1)", opacity: 1 },
        { transform: `translate(${ex * 0.5}px,${ey * 0.5 - 70}px) scale(1.4) rotate(12deg)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${ex}px,${ey}px) scale(.5)`, opacity: 0.9 },
      ],
      { duration: 650, easing: "cubic-bezier(.4,0,.2,1)" }
    ).finished;
    fl.remove();
    if (dest) dest.animate([{ transform: "scale(1)" }, { transform: "scale(1.3,.8)" }, { transform: "scale(.9,1.15)" }, { transform: "scale(1)" }], { duration: 420, easing: "ease-out" });
  },

  floatText(text) {
    const dest = document.querySelector(".backpack-btn");
    const hr = dest ? dest.getBoundingClientRect() : { left: 20, top: innerHeight - 100, width: 60 };
    const el = document.createElement("div");
    el.className = "surcanubes-float-text";
    el.textContent = text;
    el.style.left = `${hr.left + hr.width + 8}px`;
    el.style.top = `${hr.top + 12}px`;
    document.body.appendChild(el);
    el.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, offset: 0.2 }, { opacity: 0, transform: "translateY(-30px)" }], { duration: 1500 }).onfinish = () => el.remove();
  },

  // Estirón elástico hacia el rival (sin brazos dibujados).
  stretchToward(unit, target) {
    const s = unit.spriteEl;
    if (!s) return;
    const a = getTileCenter(unit.row, unit.col, Units.boardSize);
    const b = getTileCenter(target.row, target.col, Units.boardSize);
    const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = ((b.x - a.x) / L) * 14, uy = ((b.y - a.y) / L) * 14;
    s.animate(
      [
        { transform: "scale(1,1)", translate: "0 0" },
        { transform: "scale(1.12,.84)", translate: "0 0", offset: 0.25 },
        { transform: "scale(.88,1.18)", translate: "0 0", offset: 0.45 },
        { transform: "scale(1.2,.9)", translate: `${ux}px ${uy}px`, offset: 0.8 },
        { transform: "scale(1.2,.9)", translate: `${ux}px ${uy}px` },
      ],
      { duration: 700, fill: "forwards" }
    );
    this._stretchEl = s;
  },
  recoil(unit) {
    const s = unit.spriteEl;
    if (!s) return;
    s.getAnimations().forEach((a) => a.cancel());
    s.animate([{ transform: "scale(1.2,.9)" }, { transform: "scale(.82,1.25)", offset: 0.4 }, { transform: "scale(1,1)" }], { duration: 460, easing: "cubic-bezier(.3,1.8,.5,1)" });
    s.animate([{ translate: "0 0" }, { translate: "0 -26px" }, { translate: "0 0" }], { duration: 420, easing: "ease-out" });
  },

  // =====================================================================
  // AlaFugaz · Aterrizaje Forzoso
  // =====================================================================
  LAND_RANGE: 7,
  SKY: 1200,

  activateForcedLanding(unit) {
    Units.clearRangeOverlays();
    const tiles = [];
    for (let row = 0; row < Units.boardSize; row++)
      for (let col = 0; col < Units.boardSize; col++) {
        if (row === unit.row && col === unit.col) continue;
        if (Math.max(Math.abs(row - unit.row), Math.abs(col - unit.col)) > this.LAND_RANGE) continue;
        if (!this.tileIsFree(row, col)) continue;
        tiles.push({ row, col });
      }
    if (tiles.length === 0) {
      Units.refreshRange(unit);
      return;
    }
    if (typeof UiHint !== "undefined") UiHint.show("Elige dónde aterrizar (máx. 7 casillas)");
    tiles.forEach((t, i) =>
      Units.addMarker({
        className: "range-marker ability-throw-marker",
        row: t.row,
        col: t.col,
        zOffset: 2,
        alwaysOnTop: true,
        delayMs: Units.staggerDelay(i, tiles.length),
        visibleClass: "range-marker--visible",
        onClick: () => this.resolveForcedLanding(unit, t.row, t.col),
      })
    );
  },

  async resolveForcedLanding(unit, row, col) {
    Units.clearRangeOverlays();
    if (typeof UiHint !== "undefined") UiHint.hide();
    Abilities._consume(unit);
    const el = unit.el, sp = unit.spriteEl, S = Units.boardSize;
    const p0 = getTileCenter(unit.row, unit.col, S);
    Units.faceTowardsTile(unit, row, col);
    // 1) sale disparada hacia arriba, fuera de pantalla
    Abilities._throwDust(p0.x, p0.y + 10, 7, 30);
    if (typeof SFX !== "undefined") SFX.slingWhoosh(0.5);
    if (sp) sp.animate([{ transform: "scale(1.25,.72)" }, { transform: "scale(.7,1.6)", offset: 0.25 }, { transform: "scale(.6,1.8)" }], { duration: 520, fill: "forwards", easing: "ease-in" });
    const ghostTimer = setInterval(() => Abilities._throwGhost(unit), 70);
    await el.animate([{ translate: "0 0" }, { translate: `0 -${this.SKY}px` }], { duration: 520, easing: "cubic-bezier(.5,0,.9,.5)", fill: "forwards" }).finished;
    clearInterval(ghostTimer);
    el.getAnimations().forEach((a) => a.cancel());
    if (sp) sp.getAnimations().forEach((a) => a.cancel());
    el.style.visibility = "hidden";
    // 2) cambia de casilla estando fuera de la vista y marca dónde va a caer
    if (typeof Bushes !== "undefined") Bushes.clearHiddenUnit(unit.id);
    unit.row = row;
    unit.col = col;
    Units._placeInstant(unit);
    const mark = Units.addMarker({ className: "ability-pick-marker", row, col, zOffset: 1, visibleClass: "ability-pick-marker--visible" });
    await this.sleep(450);
    // 3) reaparece arriba del todo y cae en picado
    el.style.visibility = "";
    if (sp) sp.animate([{ transform: "scale(.7,1.6)" }, { transform: "scale(.75,1.5)" }], { duration: 520, easing: "ease-in" });
    const fall = setInterval(() => Abilities._throwGhost(unit), 90);
    await el.animate([{ translate: `0 -${this.SKY}px` }, { translate: "0 0" }], { duration: 520, easing: "cubic-bezier(.5,0,1,.6)" }).finished;
    clearInterval(fall);
    if (mark && mark.remove) mark.remove();
    // 4) impacto
    if (sp) sp.animate([{ transform: "scale(1.35,.62)" }, { transform: "scale(.9,1.12)", offset: 0.55 }, { transform: "scale(1,1)" }], { duration: 480, easing: "ease-out" });
    SFX.hop();
    SFX.slingLand();
    Units.playShake(unit);
    Abilities._throwLandFx(unit, row, col);
    Abilities._punchImpactFx(row, col);
    const held = typeof Gnome !== "undefined" ? Gnome.list.find((g) => g.heldBy === unit.id) : null;
    if (held) {
      Units.spawnFloatingText(unit, "¡Se le cae el gnomo!", { className: "dmg-popup" });
      held.dropFromStunnedUnit(unit);
    }
    this.settle(unit);
    // daño a los rivales adyacentes (1) y daño propio aleatorio 1-3
    const near = Units.list.filter((u) => u !== unit && u.team !== unit.team && this.cheb(u, unit) <= 1);
    for (const u of near) await this.hurt(u, 1, unit.team);
    const self = 1 + Math.floor(Math.random() * 3); // azar de reglas: Math.random (GGRand en multijugador), nunca NR
    await this.sleep(150);
    await this.hurt(unit, self, null);
    if (Units.list.includes(unit)) Units.refreshRange(unit);
  },

  // =====================================================================
  // NidoBot · Incubar
  // =====================================================================
  heatOf(unit) {
    return Math.min(3, unit.incubTurns || 0) / 3;
  },

  applyIncubateVisuals(unit) {
    if (!unit.el) return;
    const on = !!unit.incubating;
    unit.el.classList.toggle("unit--incubating", on);
    unit.el.style.setProperty("--heat", String(this.heatOf(unit)));
  },

  activateIncubate(unit) {
    if (!unit.incubating) {
      this.startIncubate(unit);
      return;
    }
    if ((unit.incubTurns || 0) < 1) {
      Units.spawnFloatingText(unit, "Aún no ha incubado", { className: "dmg-popup" });
      if (typeof UiHint !== "undefined") UiHint.show("Espera al menos un turno antes de liberar la explosión");
      setTimeout(() => typeof UiHint !== "undefined" && UiHint.hide(), 2200);
      return;
    }
    this.releaseIncubate(unit);
  },

  // 1.ª pulsación: empieza a incubar (gasta la acción, pero NO la habilidad).
  startIncubate(unit) {
    {
      unit.incubating = true;
      unit.incubTurns = 0;
      this.applyIncubateVisuals(unit);
      Units.spawnFloatingText(unit, "¡Incubando!", { className: "dmg-popup popup--good" });
      unit.el.classList.remove("unit--transforming");
      void unit.spriteEl.offsetWidth;
      unit.el.classList.add("unit--transforming");
      setTimeout(() => unit.el.classList.remove("unit--transforming"), 650);
      SFX.glory();
      if (typeof Turns !== "undefined") Turns.useAction(unit);
      Abilities._refreshButton();
      Units.refreshRange(unit);
    }
  },

  async releaseIncubate(unit) {
    const turns = unit.incubTurns || 0;
    const n = Math.min(3, turns);
    Units.clearRangeOverlays();
    Abilities._consume(unit);
    unit.incubating = false;
    unit.incubTurns = 0;
    const sp = unit.spriteEl;
    // carga: se encoge y se estira
    if (sp) {
      await sp.animate([{ transform: "scale(1,1)" }, { transform: "scale(1.25,.7)" }], { duration: 200, fill: "forwards" }).finished;
      sp.animate([{ transform: "scale(1.25,.7)" }, { transform: "scale(.8,1.4)" }], { duration: 140, fill: "forwards" });
      await this.sleep(140);
    }
    const col = ["#ffd86b", "#ff8a3a", "#e8453c"][n - 1];
    const c = getTileCenter(unit.row, unit.col, Units.boardSize);
    this.blastFx(unit, c, n, col);
    Abilities._playExplosionFeedback(unit);
    if (typeof SFX !== "undefined" && SFX.explosion) SFX.explosion();
    const victims = Units.list
      .filter((u) => u !== unit && this.cheb(u, unit) <= n)
      .sort((a, b) => this.cheb(b, unit) - this.cheb(a, unit)); // los más lejanos primero: el camino de empuje queda libre
    const causer = unit.team;
    for (const v of victims) await this.hurt(v, n, causer);
    for (const v of victims) {
      if (!Units.list.includes(v)) continue;
      await Abilities._pushBackFixed(v, unit, n);
      this.settle(v);
    }
    // daño propio: 1 / 2 / 5 (a 3+ turnos muere)
    const self = [1, 2, 5][n - 1];
    await this.sleep(250);
    if (n >= 3) unit.hp = Math.min(unit.hp, self);
    if (sp) sp.getAnimations().forEach((a) => a.cancel());
    if (unit.el) unit.el.classList.remove("unit--incubating");
    await this.hurt(unit, self, null);
    if (Units.list.includes(unit)) {
      if (sp) sp.animate([{ transform: "scale(1.25,.7)" }, { transform: "scale(.9,1.12)", offset: 0.5 }, { transform: "scale(1,1)" }], { duration: 400, easing: "ease-out" });
      this.applyIncubateVisuals(unit);
      Units.refreshRange(unit);
    }
  },

  // Onda expansiva: anillo del tamaño del radio, destello y trozos.
  blastFx(unit, c, n, col) {
    const ring = document.createElement("div");
    ring.className = "incubar-ring";
    const w = (2 * n + 1) * 188;
    const h = (2 * n + 1) * 117;
    ring.style.cssText = `left:${c.x}px;top:${c.y}px;width:${w}px;height:${h}px;margin:${-h / 2}px 0 0 ${-w / 2}px;border-color:${col};background:${col}33`;
    ring.style.zIndex = "2800";
    Units.container.appendChild(ring);
    ring.animate([{ transform: "scale(.15)", opacity: 1 }, { transform: "scale(1)", opacity: 0.9, offset: 0.35 }, { transform: "scale(1)", opacity: 0 }], { duration: 520 + n * 120, easing: "ease-out" }).onfinish = () => ring.remove();
    Abilities._punchImpactFx(unit.row, unit.col);
  },

  // ---------- Enganches con el resto del juego ----------
  onTurnStart(team) {
    Units.list.forEach((u) => {
      if (u.team !== team || !u.incubating) return;
      u.incubTurns = (u.incubTurns || 0) + 1;
      this.applyIncubateVisuals(u);
      Units.spawnFloatingText(u, `Incubando: ${u.incubTurns}`, { className: "dmg-popup popup--good" });
    });
  },
};

// Rango de movimiento de NidoBot mientras incuba: -1, -2 y, a 3+ turnos, una casilla.
(function () {
  const orig = Units.moveRangeOf;
  Units.moveRangeOf = function (unit) {
    const base = orig.call(this, unit);
    if (unit && unit.incubating && unit.incubTurns > 0) return unit.incubTurns >= 3 ? 1 : Math.max(1, base - unit.incubTurns);
    return base;
  };
})();

// Despacho de las 3 habilidades desde el botón común.
(function () {
  const orig = Abilities._activate;
  Abilities._activate = function () {
    const unit = this._currentUnit;
    if (unit && !unit.abilityUsed && ABILITIES[unit.typeId] && (typeof Turns === "undefined" || Turns.canAct(unit))) {
      if (unit.typeId === "manos_largas") return SurcaNubes.activateLongFingers(unit);
      if (unit.typeId === "ala_fugaz") return SurcaNubes.activateForcedLanding(unit);
      if (unit.typeId === "nidobot") return SurcaNubes.activateIncubate(unit);
    }
    return orig.apply(this, arguments);
  };
  const origTurn = Abilities.onTurnStart;
  Abilities.onTurnStart = function (team) {
    origTurn.apply(this, arguments);
    SurcaNubes.onTurnStart(team);
  };
  // NidoBot incubando: el botón pasa a ser "liberar" (nombre y marca propios).
  const origRefresh = Abilities._refreshButton;
  Abilities._refreshButton = function () {
    origRefresh.apply(this, arguments);
    const u = this._currentUnit;
    if (!this._btn) return;
    const releasing = !!(u && u.typeId === "nidobot" && u.incubating);
    this._btn.classList.toggle("ability-btn--releasing", releasing);
    if (releasing) this._btn.setAttribute("aria-label", "Usar habilidad: Liberar Incubar");
  };
})();

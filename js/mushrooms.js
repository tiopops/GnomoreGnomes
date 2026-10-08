/* Gnomore Gnomes — Setas explosivas del Bosque MushBoom.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Hacer aparecer setas sueltas por el mapa de vez en cuando (máx.
       MUSHROOM_MAX a la vez, una nueva cada MUSHROOM_SPAWN_EVERY rondas, en
       una casilla libre lejos de las bases) — solo en el nivel
       "mushboom_forest".
     - Dejar que un personaje la coja con el mismo sistema que un gnomo
       (marca de mano -> se acerca -> la lleva), mostrándola como un
       marcador arriba a la derecha del personaje, visible para todos, con
       el nº de turnos que le quedan en un recuadro irregular.
     - La cuenta atrás: -1 al FINALIZAR el turno del equipo de quien la
       porta. A 0 explota: 5 de daño al portador y a las losetas
       adyacentes (quien muere deja charco), sonido de explosión, temblor de
       cámara y destello blanco. Cuanto menos le queda, más rápido pulsa y
       más roja se pone.
     - Ofrecerla en el Altar de Sacrificios (la lógica de la barra es de
       js/altar.js, que llama a Mushrooms.carriedBy/consume). */

const MUSHROOM_MAX = 4;
const MUSHROOM_SPAWN_EVERY = 3;
const MUSHROOM_INITIAL = 2;
const MUSHROOM_RELOCATE_EVERY = 4; // rondas que una seta suelta permanece en su sitio antes de desaparecer y reaparecer en otro
const MUSHROOM_FUSE = 3;
const MUSHROOM_DAMAGE = 5;
const MUSHROOM_MIN_BASE_DIST = 6;
const MUSHROOM_SPRITE = "assets/iconos/seta_trampa.png";
const MUSHROOM_GROUND_SIZE = 90;

const Mushrooms = {
  list: [], // { id, row, col, el, heldBy, fuse, markerEl, badgeEl }
  active: false,
  _nextId: 1,

  resetAll() {
    this.list.forEach((m) => {
      if (m.el) m.el.remove();
      if (m.markerEl) m.markerEl.remove();
    });
    this.list = [];
    this.active = false;
  },

  // ---------- Aparición ----------
  spawnInitial(size) {
    let levelId = "mushboom_forest";
    try {
      const saved = typeof SaveGame !== "undefined" ? SaveGame.load() : null;
      if (saved && saved.levelId) levelId = saved.levelId;
    } catch (e) {}
    this.active = levelId === "mushboom_forest";
    if (!this.active) return;
    for (let i = 0; i < MUSHROOM_INITIAL; i++) this._spawnOne(size);
  },

  _tileFree(row, col) {
    if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) return false;
    if (Units.unitAt(row, col)) return false;
    if (this.looseAt(row, col)) return false;
    if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) return false;
    if (typeof Villages !== "undefined" && Villages.at(row, col)) return false;
    if (typeof Shops !== "undefined" && Shops.at(row, col)) return false;
    if (typeof Obelisks !== "undefined" && Obelisks.at(row, col)) return false;
    if (typeof Altar !== "undefined" && Altar.at(row, col)) return false;
    if (typeof Bushes !== "undefined" && Bushes.at(row, col)) return false;
    if ((typeof Resources !== "undefined" && Resources.at(row, col)) || (typeof Drums !== "undefined" && Drums.at(row, col))) return false;
    if (typeof GnomOgro !== "undefined" && GnomOgro.at(row, col)) return false;
    return true;
  },

  _spawnOne(size) {
    size = size || Units.boardSize;
    const bases = typeof Obelisks !== "undefined" ? Obelisks.list : [];
    const cands = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!this._tileFree(r, c)) continue;
        const near = bases.some((o) => Math.max(Math.abs(o.row - r), Math.abs(o.col - c)) < MUSHROOM_MIN_BASE_DIST);
        if (near) continue;
        cands.push({ row: r, col: c });
      }
    }
    if (cands.length === 0) return null;
    const spot = cands[Math.floor(Math.random() * cands.length)];
    return this._create(spot.row, spot.col);
  },

  _pickSpot(size) {
    size = size || Units.boardSize;
    const bases = typeof Obelisks !== "undefined" ? Obelisks.list : [];
    const cands = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!this._tileFree(r, c)) continue;
        if (bases.some((o) => Math.max(Math.abs(o.row - r), Math.abs(o.col - c)) < MUSHROOM_MIN_BASE_DIST)) continue;
        cands.push({ row: r, col: c });
      }
    }
    return cands.length ? cands[Math.floor(Math.random() * cands.length)] : null;
  },

  // Desaparece (fundido) y reaparece en otra casilla libre.
  _relocate(m) {
    const spot = this._pickSpot();
    m.age = 0;
    if (!spot || !m.el) return;
    const el = m.el;
    el.style.transition = "opacity 0.35s ease";
    el.style.opacity = "0";
    setTimeout(() => {
      if (m.heldBy || !m.el) return; // la cogieron justo entonces
      m.row = spot.row;
      m.col = spot.col;
      const { x, y } = getTileCenter(spot.row, spot.col, Units.boardSize);
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.zIndex = String((spot.row + spot.col) * 10 + 6);
      this.refreshFog();
      el.style.opacity = ""; // sin inline: no pisar el opacity:0 de unit--fog-hidden
      setTimeout(() => { if (m.el) el.style.transition = ""; }, 400);
    }, 380);
  },

  _create(row, col) {
    const el = document.createElement("div");
    el.className = "mushroom-loose";
    const img = document.createElement("img");
    img.decoding = "async";
    img.className = "mushroom-loose__sprite";
    img.alt = "";
    img.draggable = false;
    img.style.width = `${MUSHROOM_GROUND_SIZE}px`;
    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(img, MUSHROOM_SPRITE);
    else img.src = MUSHROOM_SPRITE;
    el.appendChild(img);
    Units.container.appendChild(el);
    const m = { id: this._nextId++, row, col, el, spriteEl: img, heldBy: null, age: 0, fuse: MUSHROOM_FUSE, markerEl: null, badgeEl: null };
    const { x, y } = getTileCenter(row, col, Units.boardSize);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.zIndex = String((row + col) * 10 + 6);
    this.list.push(m);
    this.refreshFog();
    return m;
  },

  looseAt(row, col) {
    return this.list.find((m) => !m.heldBy && m.row === row && m.col === col) || null;
  },

  carriedBy(unit) {
    return this.list.find((m) => m.heldBy === unit.id) || null;
  },

  isHeldBy(unitId) {
    return this.list.some((m) => m.heldBy === unitId);
  },

  refreshFog() {
    this.list.forEach((m) => {
      if (!m.el || m.heldBy) return;
      // isFoggedReal: isFogged() devuelve false durante el turno de la IA y las setas
      // asomaban sobre la niebla (captura del usuario en Mushboom).
      const fogged = typeof Fog !== "undefined" && (Fog.isFoggedReal ? Fog.isFoggedReal(m.row, m.col) : Fog.isFogged(m.row, m.col));
      m.el.classList.toggle("unit--fog-hidden", !!fogged);
      const remembered = typeof Fog !== "undefined" && !fogged && !Fog.isPerceived(m.row, m.col);
      m.el.classList.toggle("gg-remembered", !!remembered);
    });
  },

  // ---------- Coger ----------
  _dist(a, b) {
    return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
  },

  findApproachTile(unit, m) {
    if (!m.el || m.heldBy) return null;
    if (this._dist(unit, m) <= 1) return { row: unit.row, col: unit.col };
    const moveRange = Units.moveRangeOf(unit);
    let best = null;
    let bestDist = Infinity;
    for (let row = 0; row < Units.boardSize; row++) {
      for (let col = 0; col < Units.boardSize; col++) {
        if (row === unit.row && col === unit.col) continue;
        if (row === m.row && col === m.col) continue;
        if (this._dist({ row, col }, m) > 1) continue;
        if (Units.unitAt(row, col)) continue;
        if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) continue;
        if (typeof Villages !== "undefined" && Villages.at(row, col)) continue;
        if (typeof Shops !== "undefined" && Shops.at(row, col)) continue;
        if (typeof Obelisks !== "undefined" && Obelisks.at(row, col)) continue;
        if (typeof Altar !== "undefined" && Altar.at(row, col)) continue;
        if (typeof GnomOgro !== "undefined" && GnomOgro.at(row, col)) continue;
        if ((typeof Resources !== "undefined" && Resources.at(row, col)) || (typeof Drums !== "undefined" && Drums.at(row, col))) continue;
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

  canCatch(unit, m) {
    if (this.isHeldBy(unit.id)) return false;
    if (typeof Gnome !== "undefined" && Gnome.isHeldBy(unit.id)) return false;
    if (m.el.classList.contains("unit--fog-hidden")) return false;
    return !!this.findApproachTile(unit, m);
  },

  // Proveedor de rango (mismo patrón que Gnome.showFor).
  showFor(unit) {
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    if (this.isHeldBy(unit.id)) return; // el altar lo ofrece Altar.showFor
    if (typeof Gnome !== "undefined" && Gnome.isHeldBy(unit.id)) return;
    this.list.forEach((m) => {
      if (m.heldBy || !this.canCatch(unit, m)) return;
      Units.addMarker({
        className: "catch-marker",
        row: m.row,
        col: m.col,
        zOffset: 7,
        visibleClass: "catch-marker--visible",
        owner: "mushroom",
        buildContent: (marker) => {
          const icon = document.createElement("i");
          icon.className = "ph ph-hand-grabbing catch-marker__icon";
          marker.appendChild(icon);
        },
        onClick: () => this.catchBy(unit, m),
      });
    });
  },
  onClear() {},

  async catchBy(unit, m) {
    if (m.heldBy || !m.el) return;
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    Units.clearRangeOverlays();
    const approach = this.findApproachTile(unit, m);
    if (!approach) return;
    // Coger NO gasta acción (pedido explícito): solo cuesta la acción del
    // desplazamiento si hace falta acercarse primero (mover + coger).
    if (approach.row !== unit.row || approach.col !== unit.col) {
      const path = Units.stepPath(unit.row, unit.col, approach.row, approach.col);
      await Units.walkPath(unit, path);
      if (typeof Turns !== "undefined") Turns.useAction(unit); // mover + coger = 1 acción (coger no gasta)
      if (typeof Fog !== "undefined" && unit.team === "player") Fog.revealForUnit(unit);
    }
    if (m.heldBy || !m.el) return;
    Units.faceTowardsTile(unit, m.row, m.col);
    this._attachTo(unit, m);
    if (typeof SFX !== "undefined") SFX.catch();
    await this.autoOffer(unit);
    Units.refreshRange(unit);
  },

  _attachTo(unit, m) {
    m.heldBy = unit.id;
    m.fuse = MUSHROOM_FUSE;
    m.el.style.display = "none";
    const marker = document.createElement("div");
    marker.className = "mushroom-marker";
    const img = document.createElement("img");
    img.className = "mushroom-marker__sprite";
    img.alt = "";
    img.draggable = false;
    img.src = MUSHROOM_SPRITE;
    marker.appendChild(img);
    const badge = document.createElement("b");
    badge.className = "mushroom-marker__badge";
    marker.appendChild(badge);
    unit.el.appendChild(marker);
    m.markerEl = marker;
    m.badgeEl = badge;
    this._refreshMarker(m);
    requestAnimationFrame(() => marker.classList.add("mushroom-marker--visible"));
  },

  _refreshMarker(m) {
    if (!m.markerEl) return;
    m.badgeEl.textContent = String(m.fuse);
    m.markerEl.dataset.fuse = String(Math.max(1, Math.min(3, m.fuse)));
  },

  // Basta con quedar en una casilla adyacente al Altar para ofrecerla (sin
  // acción ni machacón, ver Altar.offerMushroom). Lo llama Units.walkPath al
  // terminar cualquier desplazamiento y catchBy al cogerla.
  async autoOffer(unit) {
    const m = this.carriedBy(unit);
    if (!m || typeof Altar === "undefined") return;
    const altar = Altar.current();
    if (!altar || !unit.el) return;
    if (Math.max(Math.abs(altar.row - unit.row), Math.abs(altar.col - unit.col)) > 1) return;
    await Altar.offerMushroom(unit, altar, m);
  },

  // El altar (u otra mecánica) se la queda: desaparece sin explotar.
  consume(m) {
    if (m.markerEl) m.markerEl.remove();
    if (m.el) m.el.remove();
    this.list = this.list.filter((x) => x !== m);
  },

  // ---------- Cuenta atrás / explosión ----------
  async onTurnEnd(team) {
    const due = this.list.filter((m) => {
      if (!m.heldBy) return false;
      const u = Units.list.find((x) => x.id === m.heldBy);
      return u && u.team === team;
    });
    for (const m of due) {
      m.fuse--;
      this._refreshMarker(m);
    }
    for (const m of due) {
      if (m.fuse <= 0) await this._explode(m);
    }
  },

  onTurnStart(team) {
    if (team !== Teams.all[0] || !this.active) return; // una vez por ronda (1.er bando de la ronda)
    const round = typeof Turns !== "undefined" ? Turns.roundNumber : 0;
    // Las setas sueltas van desapareciendo y reapareciendo en otro sitio
    // cada MUSHROOM_RELOCATE_EVERY rondas (pedido explícito).
    this.list.filter((m) => !m.heldBy).forEach((m) => {
      m.age = (m.age || 0) + 1;
      if (m.age >= MUSHROOM_RELOCATE_EVERY) this._relocate(m);
    });
    if (round > 1 && round % MUSHROOM_SPAWN_EVERY === 0 && this.list.length < MUSHROOM_MAX) {
      this._spawnOne();
    }
  },

  // Lo llama Units.removeUnit: si el portador muere por otra causa, la seta
  // estalla igualmente en su casilla (juego kamikaze).
  onUnitDying(unit) {
    const m = this.carriedBy(unit);
    if (!m) return;
    m.fuse = 0;
    this._explode(m, unit);
  },

  async _explode(m, dyingUnit) {
    const carrier = dyingUnit || Units.list.find((x) => x.id === m.heldBy);
    if (!carrier) {
      this.consume(m);
      return;
    }
    const row = carrier.row;
    const col = carrier.col;
    if (m.markerEl) m.markerEl.remove();
    if (m.el) m.el.remove();
    this.list = this.list.filter((x) => x !== m);

    if (typeof SFX !== "undefined") SFX.explosion();
    const viewportEl = document.getElementById("board-viewport");
    if (viewportEl) {
      viewportEl.classList.remove("board-viewport--shake--big");
      void viewportEl.offsetWidth;
      viewportEl.classList.add("board-viewport--shake--big");
      setTimeout(() => viewportEl.classList.remove("board-viewport--shake--big"), 420);
    }
    if (typeof Villages !== "undefined" && Villages._flashScreen) Villages._flashScreen();
    if (typeof Backpack !== "undefined" && Backpack._spawnKatapumBlast) Backpack._spawnKatapumBlast(row, col);

    const victims = Units.list.filter(
      (u) => u.id !== (dyingUnit && dyingUnit.id) && Math.max(Math.abs(u.row - row), Math.abs(u.col - col)) <= 1
    );
    const toRemove = [];
    for (const u of victims) {
      if (typeof Skills !== "undefined") Skills.resolveDamage(u, MUSHROOM_DAMAGE, { melee: false });
      else {
        u.hp = Math.max(0, u.hp - MUSHROOM_DAMAGE);
        Units.updateHpBar(u);
        Units.spawnFloatingText(u, `-${MUSHROOM_DAMAGE}`, { className: "dmg-popup" });
        Units.playShake(u);
      }
      if (u.hp <= 0) toRemove.push(u);
    }
    for (const u of toRemove) {
      await Units.removeUnit(u);
      if (typeof Gnome !== "undefined") Gnome.dropHeldBy(u);
    }
    await this._damageStructures(row, col, carrier.team);
    if (typeof Obelisks !== "undefined" && Obelisks.refreshAll) Obelisks.refreshAll();
  },

  // La explosión también daña tótems y Obeliscos adyacentes, sea cual sea su
  // bando (incluido el propio). Un tótem que llega a 0 pasa a ser del equipo
  // que provocó la explosión (quien llevaba la seta); un Obelisco a 0 es destruido.
  async _damageStructures(row, col, team) {
    const near = (e) => Math.max(Math.abs(e.row - row), Math.abs(e.col - col)) <= 1;
    const hit = (e) => {
      e.hp = Math.max(0, e.hp - MUSHROOM_DAMAGE);
      Units.updateHpBar(e);
      Units.spawnFloatingText(e, `-${MUSHROOM_DAMAGE}`, { className: "dmg-popup" });
      Units.playShake(e);
    };
    if (typeof Villages !== "undefined") {
      for (const v of Villages.list.filter(near)) {
        hit(v);
        if (v.hp <= 0) {
          // A 0 de vida pasa a ser del equipo que provocó la explosión.
          Villages._capture(v, team, 1);
        }
      }
    }
    if (typeof Obelisks !== "undefined") {
      for (const o of Obelisks.list.filter(near)) {
        hit(o);
        if (o.hp <= 0) await Obelisks._destroy(o);
      }
    }
  },
};

if (typeof Units !== "undefined") Units.registerRangeProvider(Mushrooms);
if (typeof Turns !== "undefined") Turns.registerTurnStartListener(Mushrooms);

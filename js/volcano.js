/* Gnomore Gnomes — Volcán (nivel Colinas Rock'n Troll).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Colocar UN volcán en el centro del mapa (solo en ese nivel), bloquea su
       casilla igual que el Altar (Altar.at/isNear lo consultan).
     - Su carga compartida de 0 a 20 puntos: estampar un gnomo (puntos del
       gnomo), lanzarle un gnomo (idem) o tirarle un fragmento de roca (+1).
       Apagado (<10) -> encendido (>=10) -> erupción (20).
     - La erupción dura 5 turnos del equipo que la provocó (el último que
       aportó puntos). Cada turno suyo, los rivales quedan rodeados de charcos
       de lava (solo donde falten; nunca en agua ni sobre obstáculos) y sus
       estructuras sufren 1 punto bajo su propio charco.
     - Quien pisa lava (o empieza el turno sobre ella) pierde 1 punto por
       ronda. Un fragmento de roca apaga una casilla de lava cercana.
     - Pasados los 5 turnos: la lava se enfría, el volcán se apaga y el
       contador vuelve a 0. */

const VOLCANO_ON_AT = 10;
const VOLCANO_MAX = 20;
const VOLCANO_ERUPT_TURNS = 5;
const VOLCANO_DIR = "assets/niveles/rockntroll/";
const VOLCANO_SPRITES = {
  apagado: VOLCANO_DIR + "volcan_apagado.png",
  encendido: VOLCANO_DIR + "volcan_encendido.png",
  erupcion: VOLCANO_DIR + "volcan_erupcion.png",
};
const VOLCANO_LAVA_SPRITES = [VOLCANO_DIR + "lava_1.png", VOLCANO_DIR + "lava_2.png"];
const VOLCANO_TEAM_COLORS = { player: "#3aa0ff", enemy: "#ff5148", enemy2: "#52d66a", enemy3: "#c067ff" };
const VOLCANO_INTERACT_RANGE = 1;
const VOLCANO_EXTINGUISH_RANGE = 3; // distancia máxima (a alguna unidad propia) para apagar una casilla

const Volcano = {
  list: [], // como mucho uno
  lava: [], // { row, col, el }
  eruption: null, // { owner, left }

  isActive() {
    return typeof LevelAssets !== "undefined" && LevelAssets.current === "colinas_rockntroll";
  },

  current() {
    return this.list[0] || null;
  },

  resetAll() {
    this.list.forEach((v) => v.el && v.el.remove());
    this.lava.forEach((l) => l.el.remove());
    this.list = [];
    this.lava = [];
    this.eruption = null;
  },

  at(row, col) {
    return this.list.some((v) => v.row === row && v.col === col);
  },

  isNear(row, col, radius = 1) {
    return this.list.some((v) => Math.max(Math.abs(v.row - row), Math.abs(v.col - col)) <= radius);
  },

  lavaAt(row, col) {
    return this.lava.find((l) => l.row === row && l.col === col) || null;
  },

  // ---------- Reparto ----------
  spawn(size) {
    if (!this.isActive()) return;
    const c = { row: Math.floor(size / 2), col: Math.floor(size / 2) };
    const spot = typeof Altar !== "undefined" ? Altar._findFreeTileNear(c.row, c.col, size, true) : c;
    if (!spot) return;
    this._create(spot.row, spot.col);
    if (typeof Altar !== "undefined" && Altar._clearTileFor) Altar._clearTileFor(spot.row, spot.col);
  },

  _create(row, col) {
    const el = document.createElement("div");
    el.className = "unit volcano";
    const spriteEl = document.createElement("img");
    spriteEl.className = "volcano__sprite";
    spriteEl.decoding = "async";
    spriteEl.alt = "";
    spriteEl.draggable = false;
    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(spriteEl, VOLCANO_SPRITES.apagado);
    else spriteEl.src = VOLCANO_SPRITES.apagado;
    el.appendChild(spriteEl);
    if (typeof Shadows !== "undefined") Shadows.attach(spriteEl);

    const barEl = document.createElement("div");
    barEl.className = "unit__hpbar altar__bar volcano__bar";
    const segmentEls = [];
    for (let i = 0; i < VOLCANO_MAX; i++) {
      const seg = document.createElement("div");
      seg.className = "unit__hpbar-segment" + (i === VOLCANO_ON_AT - 1 ? " volcano__seg--mark" : "");
      barEl.appendChild(seg);
      segmentEls.push(seg);
    }
    el.appendChild(barEl);

    const badgeEl = document.createElement("div");
    badgeEl.className = "volcano__badge";
    badgeEl.style.display = "none";
    el.appendChild(badgeEl);

    Units.container.appendChild(el);
    const v = { row, col, el, spriteEl, barEl, segmentEls, badgeEl, points: 0, lastTeam: null, state: "apagado" };
    const { x, y } = getTileCenter(row, col, Units.boardSize);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.zIndex = String((row + col) * 10 + 3);
    el.addEventListener("click", (e) => {
      if (!el.classList.contains("volcano--targeted")) return;
      if (typeof Units === "undefined" || !Units.selectedId) return;
      e.stopPropagation();
      const unit = Units.list.find((u) => u.id === Units.selectedId);
      if (unit) this.approachAndSmash(unit, v);
    });
    this.list.push(v);
    this._refreshBar(v);
    return v;
  },

  _accepts(v) {
    return !!v && !this.eruption && v.points < VOLCANO_MAX;
  },

  // ---------- Visual ----------
  _refreshBar(v) {
    const color = VOLCANO_TEAM_COLORS[v.lastTeam] || "#ff9a1f";
    v.barEl.style.setProperty("--hp-fill", color);
    v.segmentEls.forEach((seg, i) => seg.classList.toggle("unit__hpbar-segment--filled", i < v.points));
    if (this.eruption) {
      v.badgeEl.style.display = "";
      v.badgeEl.innerHTML =
        '<svg viewBox="0 0 24 28" width="18" height="21" aria-hidden="true"><path d="M12 1c1 5 7 7 7 14a7 7 0 0 1-14 0c0-3 2-4 3-7 1 1 2 2 2 4 2-3 2-7 2-11z" fill="#ffcf3d" stroke="#000" stroke-width="2" stroke-linejoin="round"/></svg>' +
        `<b>${this.eruption.left + 1}</b>`;
      v.badgeEl.style.setProperty("--vb", VOLCANO_TEAM_COLORS[this.eruption.owner] || "#ff5148");
    } else {
      v.badgeEl.style.display = "none";
    }
  },

  _stateFor(v) {
    if (this.eruption) return "erupcion";
    return v.points >= VOLCANO_ON_AT ? "encendido" : "apagado";
  },

  _refreshSprite(v) {
    const state = this._stateFor(v);
    if (v.state === state) return;
    v.state = state;
    v.el.classList.toggle("volcano--on", state === "encendido");
    v.el.classList.toggle("volcano--erupting", state === "erupcion");
    const src = VOLCANO_SPRITES[state];
    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(v.spriteEl, src);
    else v.spriteEl.src = src;
  },

  _pulse(v) {
    v.el.classList.remove("volcano--pulse");
    void v.el.offsetWidth;
    v.el.classList.add("volcano--pulse");
    const vp = document.getElementById("board-viewport");
    if (vp) {
      vp.classList.remove("board-viewport--shake");
      void vp.offsetWidth;
      vp.classList.add("board-viewport--shake");
      setTimeout(() => vp.classList.remove("board-viewport--shake"), 420);
    }
  },

  // ---------- Puntos ----------
  // Devuelve true si se aceptaron. Si llena la barra, provoca la erupción.
  async addPoints(v, team, n) {
    if (!this._accepts(v) || n <= 0) return false;
    const before = v.points;
    v.points = Math.min(VOLCANO_MAX, v.points + n);
    v.lastTeam = team;
    Units.spawnFloatingText(v, `+${v.points - before}`, { className: "dmg-popup" });
    Units.playShake(v);
    if (typeof SFX !== "undefined") SFX.hit();
    this._refreshBar(v);
    this._refreshSprite(v);
    this._pulse(v);
    if (before < VOLCANO_ON_AT && v.points >= VOLCANO_ON_AT && v.points < VOLCANO_MAX && typeof Banners !== "undefined") Banners.text("¡El volcán se enciende!", 0);
    if (v.points >= VOLCANO_MAX) await this._erupt(v, team);
    return true;
  },

  async _erupt(v, team) {
    this.eruption = { owner: team, left: VOLCANO_ERUPT_TURNS };
    this._refreshSprite(v);
    this._refreshBar(v);
    if (typeof SFX !== "undefined" && SFX.explosion) SFX.explosion();
    if (typeof Villages !== "undefined" && Villages._flashScreen) Villages._flashScreen();
    const vp = document.getElementById("board-viewport");
    if (vp) {
      vp.classList.remove("board-viewport--shake--big");
      void vp.offsetWidth;
      vp.classList.add("board-viewport--shake--big");
      setTimeout(() => vp.classList.remove("board-viewport--shake--big"), 420);
    }
    if (typeof Banners !== "undefined") Banners.text("¡El volcán entra en erupción!", 0);
    await new Promise((r) => setTimeout(r, 700));
    await this._wave();
  },

  // ---------- Oleada de lava ----------
  _enemyTeams() {
    const owner = this.eruption && this.eruption.owner;
    return Teams.all.filter((t) => t !== owner && (typeof Obelisks === "undefined" || Obelisks.byTeam(t)));
  },

  _lavaTileOk(r, c) {
    const size = Units.boardSize;
    if (r < 0 || c < 0 || r >= size || c >= size) return false;
    if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(r, c)) return false; // nunca en agua
    if (this.lavaAt(r, c)) return false;
    if (this.at(r, c)) return false;
    if (typeof Villages !== "undefined" && Villages.at(r, c)) return false;
    if (typeof Shops !== "undefined" && Shops.at(r, c)) return false;
    if (typeof Obelisks !== "undefined" && Obelisks.at(r, c)) return false;
    if (typeof Altar !== "undefined" && Altar.list.some((a) => a.row === r && a.col === c)) return false;
    if (typeof Resources !== "undefined" && Resources.at(r, c)) return false;
    if (typeof Drums !== "undefined" && Drums.at(r, c)) return false;
    if (typeof Bushes !== "undefined" && Bushes.at && Bushes.at(r, c)) return false;
    if (typeof TotemVision !== "undefined" && TotemVision.at && TotemVision.at(r, c)) return false;
    return true;
  },

  async _wave() {
    if (!this.eruption) return;
    const enemies = this._enemyTeams();
    const owner = this.eruption.owner;
    const spots = [];
    Units.list.filter((u) => enemies.includes(u.team)).forEach((u) => {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const r = u.row + dr, c = u.col + dc;
        if (this._lavaTileOk(r, c) && !spots.some((s) => s.row === r && s.col === c)) spots.push({ row: r, col: c });
      }
    });
    spots.sort(() => Math.random() - 0.5);
    spots.forEach((s, i) => setTimeout(() => this._placeLava(s.row, s.col), i * 70));

    // Estructuras rivales: charco bajo ellas y 1 de daño por ronda.
    const hits = [];
    if (typeof Villages !== "undefined") Villages.list.filter((x) => x.owner !== owner && x.owner !== "neutral" && enemies.includes(x.owner)).forEach((x) => hits.push({ kind: "village", ref: x, row: x.row, col: x.col }));
    if (typeof Obelisks !== "undefined") Obelisks.list.filter((x) => enemies.includes(x.team)).forEach((x) => hits.push({ kind: "obelisk", ref: x, row: x.row, col: x.col }));
    hits.forEach((t, i) => setTimeout(() => {
      if (!this.lavaAt(t.row, t.col)) this._placeLava(t.row, t.col, true);
    }, (spots.length + i) * 70));
    await new Promise((r) => setTimeout(r, Math.min(1400, (spots.length + hits.length) * 70 + 250)));
    for (const t of hits) {
      if (!this.eruption) break;
      this._burn(t, owner);
      await new Promise((r) => setTimeout(r, 160));
    }
    if (this.eruption) {
      this.eruption.left--;
      const v = this.current();
      if (v) this._refreshBar(v);
    }
    if (typeof Fog !== "undefined") Fog.applyVisibility();
  },

  _placeLava(row, col, force) {
    if (!this.eruption) return;
    if (this.lavaAt(row, col)) return;
    if (!force && !this._lavaTileOk(row, col)) return;
    const el = document.createElement("div");
    el.className = "unit lava-puddle";
    const img = document.createElement("img");
    img.className = "lava-puddle__sprite";
    img.draggable = false;
    img.alt = "";
    const src = VOLCANO_LAVA_SPRITES[Math.floor(Math.random() * VOLCANO_LAVA_SPRITES.length)];
    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(img, src);
    else img.src = src;
    const flip = Math.random() < 0.5 ? -1 : 1;
    const sc = 0.92 + Math.random() * 0.22;
    img.style.setProperty("--lv-s", `${flip * sc} ${sc}`);
    el.appendChild(img);
    const { x, y } = getTileCenter(row, col, Units.boardSize);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.zIndex = String((row + col) * 10 + 1);
    Units.container.appendChild(el);
    const l = { row, col, el };
    this.lava.push(l);
    if (typeof Fog !== "undefined" && Fog.isFoggedReal) {
      const fogged = Fog.isFoggedReal(row, col);
      el.classList.toggle("unit--fog-hidden", fogged);
      el.classList.toggle("gg-remembered", !fogged && !Fog.isPerceived(row, col));
    }
  },

  // 1 de daño (unidad, tótem u obelisco). `owner` cobra la muerte.
  _burn(t, owner, dmg = 1) {
    const unit = t.kind === "unit" ? t.ref : null;
    if (unit && !unit.el) return;
    if (typeof SFX !== "undefined") SFX.hit();
    const c = getTileCenter(t.row, t.col, Units.boardSize);
    this._flame(c.x, c.y, t.row, t.col);
    if (typeof Drums !== "undefined") Drums._applyDamage(t, dmg, owner);
    if (unit && unit.hp <= 0 && typeof Glory !== "undefined" && unit.team !== owner) Glory.queueKillBonus(owner);
  },

  _flame(x, y, row, col) {
    const p = document.createElement("div");
    p.className = "lava-burst";
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.zIndex = String((row + col) * 10 + 14);
    Units.container.appendChild(p);
    p.animate(
      [{ transform: "translate(-50%,-70%) scale(.3)", opacity: 0.95 }, { transform: "translate(-50%,-130%) scale(1.3)", opacity: 0 }],
      { duration: 650, easing: "ease-out" }
    ).onfinish = () => p.remove();
  },

  // ---------- Quemaduras de unidades ----------
  // Pisar lava durante un desplazamiento (Units.walkPath): se marca; el daño
  // (como mucho 1 por ronda) se aplica al terminar el desplazamiento.
  // Cada casilla de lava pisada = 1 de daño.
  onUnitStep(unit, row, col) {
    if (this.eruption && this.lavaAt(row, col)) unit._lavaSteps = (unit._lavaSteps || 0) + 1;
  },

  async afterWalk(unit) {
    const n = unit._lavaSteps || 0;
    unit._lavaSteps = 0;
    if (!n || !this.eruption || !unit.el) return;
    this._burn({ kind: "unit", ref: unit, row: unit.row, col: unit.col }, this.eruption.owner, n);
    await new Promise((r) => setTimeout(r, 250));
  },

  // Lava que pisaría un camino (para que la IA lo evite).
  lavaOnPath(path) {
    if (!this.eruption) return 0;
    return path.reduce((n, s) => n + (this.lavaAt(s.row, s.col) ? 1 : 0), 0);
  },

  // Inicio de turno de `team`.
  async onTurnStart(team) {
    if (!this.eruption) return;
    if (team === this.eruption.owner) {
      if (this.eruption.left <= 0) {
        await this._end();
        return;
      }
      await this._wave();
    }
    // Quien empieza su turno sobre lava se quema (1 por ronda).
    const burning = Units.list.filter((u) => u.team === team && this.lavaAt(u.row, u.col));
    for (const u of burning) {
      if (!this.eruption) break;
      this._burn({ kind: "unit", ref: u, row: u.row, col: u.col }, this.eruption.owner);
      await new Promise((r) => setTimeout(r, 300));
    }
  },

  async _end() {
    const v = this.current();
    this.eruption = null;
    const gone = this.lava.splice(0);
    gone.forEach((l) => {
      l.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 900, easing: "ease-in" }).onfinish = () => l.el.remove();
    });
    if (v) {
      v.points = 0;
      v.lastTeam = null;
      this._refreshBar(v);
      this._refreshSprite(v);
      this._pulse(v);
    }
    if (typeof Banners !== "undefined") Banners.text("El volcán se apaga", 0);
    await new Promise((r) => setTimeout(r, 700));
  },

  // ---------- Apagar lava con una piedra ----------
  extinguish(l) {
    if (!l || !this.lava.includes(l)) return;
    this.lava = this.lava.filter((x) => x !== l);
    const c = getTileCenter(l.row, l.col, Units.boardSize);
    if (typeof SFX !== "undefined" && SFX.splash) SFX.splash();
    for (let i = 0; i < 5; i++) {
      const p = document.createElement("div");
      p.className = "lava-steam";
      p.style.left = `${c.x + (Math.random() - 0.5) * 70}px`;
      p.style.top = `${c.y}px`;
      p.style.zIndex = String((l.row + l.col) * 10 + 14);
      Units.container.appendChild(p);
      p.animate(
        [{ transform: "translate(-50%,-30%) scale(.4)", opacity: 0.8 }, { transform: `translate(-50%,${-120 - Math.random() * 60}%) scale(1.5)`, opacity: 0 }],
        { duration: 800 + Math.random() * 300, easing: "ease-out", delay: i * 60 }
      ).onfinish = () => p.remove();
    }
    l.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350 }).onfinish = () => l.el.remove();
  },

  // ---------- Objetivos para el lanzamiento de rocas (Backpack) ----------
  rockTargets(team) {
    const out = [];
    const visible = (e) => e.el && !e.el.classList.contains("unit--fog-hidden") && !(typeof Fog !== "undefined" && Fog.isFogged(e.row, e.col));
    const v = this.current();
    if (v && this._accepts(v) && visible(v)) out.push({ kind: "volcano", ref: v, row: v.row, col: v.col, el: v.el });
    if (this.eruption) {
      const mine = Units.list.filter((u) => u.team === team);
      this.lava.forEach((l) => {
        if (!visible(l)) return;
        if (mine.some((u) => Math.max(Math.abs(u.row - l.row), Math.abs(u.col - l.col)) <= VOLCANO_EXTINGUISH_RANGE)) {
          out.push({ kind: "lava", ref: l, row: l.row, col: l.col, el: this._hitEl(l) });
        }
      });
    }
    return out;
  },

  // Recuadro romboidal clicable por casilla de lava (aunque haya una unidad
  // o un edificio encima o delante): evita que el clic lo intercepte otro
  // elemento.
  _hitEl(l) {
    if (l.hitEl && l.hitEl.isConnected) return l.hitEl;
    const el = document.createElement("div");
    el.className = "unit lava-hit";
    const { x, y } = getTileCenter(l.row, l.col, Units.boardSize);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.zIndex = "9000"; // por encima de cualquier sprite alto (volcán, árboles, obelisco)
    Units.container.appendChild(el);
    l.hitEl = el;
    return el;
  },

  clearHitEls() {
    const els = Array.from(document.querySelectorAll(".lava-hit"));
    this.lava.forEach((l) => { l.hitEl = null; });
    // Se quitan con un pequeño retraso: el lanzamiento mide su rect justo después.
    els.forEach((e) => { e.style.pointerEvents = "none"; e.style.visibility = "hidden"; setTimeout(() => e.remove(), 300); });
  },

  async onRockHit(v, team) {
    await this.addPoints(v, team, 1);
  },

  // ---------- Estampar un gnomo (mismo patrón que el Altar) ----------
  showFor(unit) {
    const v = this.current();
    if (!v || !this._accepts(v)) return;
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    const held = typeof Gnome !== "undefined" ? Gnome.list.find((g) => g.heldBy === unit.id) : null;
    if (!held) return;
    if (typeof Fog !== "undefined" && Fog.isFogged(v.row, v.col)) return;
    if (!this.findApproachTile(unit, v)) return;
    Units.addMarker({
      className: "attack-marker altar-attack-marker",
      row: v.row,
      col: v.col,
      zOffset: 2,
      visibleClass: "attack-marker--visible",
      owner: "volcano",
      alwaysOnTop: true,
      onClick: () => this.approachAndSmash(unit, v),
      buildContent: (marker) => {
        const icon = document.createElement("i");
        icon.className = "ph ph-crosshair-simple attack-marker__icon";
        marker.appendChild(icon);
      },
    });
    const dist = Math.max(Math.abs(v.row - unit.row), Math.abs(v.col - unit.col));
    if (dist <= VOLCANO_INTERACT_RANGE) v.el.classList.add("volcano--targeted");
  },

  onClear() {
    this.list.forEach((v) => v.el.classList.remove("volcano--targeted"));
  },

  findApproachTile(unit, v) {
    const dist = (row, col) => Math.max(Math.abs(row - v.row), Math.abs(col - v.col));
    if (dist(unit.row, unit.col) <= VOLCANO_INTERACT_RANGE) return { row: unit.row, col: unit.col };
    const range = Units.moveRangeOf(unit);
    let best = null;
    let bestDist = Infinity;
    for (let row = 0; row < Units.boardSize; row++) {
      for (let col = 0; col < Units.boardSize; col++) {
        if (dist(row, col) > VOLCANO_INTERACT_RANGE) continue;
        if (Units.unitAt(row, col)) continue;
        if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) continue;
        if (typeof TerrainMap !== "undefined" && !(typeof Skills !== "undefined" ? Skills.walkableFor(unit.team, row, col) : TerrainMap.isWalkable(row, col))) continue;
        if ((typeof Resources !== "undefined" && Resources.at(row, col)) || (typeof Drums !== "undefined" && Drums.at(row, col))) continue;
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

  async approachAndSmash(unit, v) {
    Units.clearRangeOverlays();
    const target = v || this.current();
    if (!target || !this._accepts(target)) return;
    const approach = this.findApproachTile(unit, target);
    if (!approach) return;
    if (approach.row !== unit.row || approach.col !== unit.col) {
      if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
      const path = Units.stepPath(unit.row, unit.col, approach.row, approach.col);
      await Units.walkPath(unit, path);
      if (typeof Fog !== "undefined" && unit.team === "player") Fog.revealForUnit(unit);
      if (!unit.el) return;
    }
    await this.smash(unit, target);
  },

  async smash(unit, v) {
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    const gnome = typeof Gnome !== "undefined" ? Gnome.list.find((g) => g.heldBy === unit.id) : null;
    if (!gnome || !this._accepts(v)) return;
    Units.clearRangeOverlays();
    Units.faceTowardsTile(unit, v.row, v.col);
    if (typeof Turns !== "undefined") Turns.useAction(unit);

    const typeId = unit.typeId;
    const idleSrc = (typeof UNIT_TYPES !== "undefined" && UNIT_TYPES[typeId] && UNIT_TYPES[typeId].spriteUrl) || "";
    const machacaSrc = Units.machacaSpriteFor(typeId);
    if (unit.spriteEl && machacaSrc) {
      unit.spriteEl.src = machacaSrc;
      unit.spriteEl.style.width = Math.round(120 * Units.machacaScaleFor(typeId)) + "px";
    }
    gnome.setAttachPose(unit, "machaca");
    unit.el.classList.remove("unit--epic-smash", "unit--epic-smash--big");
    void unit.spriteEl.offsetWidth;
    unit.el.classList.add("unit--epic-smash");
    if (typeof SFX !== "undefined") SFX.hit();
    const IMPACT_DELAY_MS = 884;
    const TOTAL_MS = 1450;
    await new Promise((r) => setTimeout(r, IMPACT_DELAY_MS));

    const impactSrc = Units.impactSpriteFor(typeId);
    if (unit.spriteEl && impactSrc) {
      unit.spriteEl.src = impactSrc;
      unit.spriteEl.style.width = Math.round(120 * Units.impactScaleFor(typeId)) + "px";
    }
    const amount = gnome.points;
    const team = unit.team;
    Gnome.destroyInstance(gnome);
    if (typeof BloodSplat !== "undefined") BloodSplat.spawnAt(unit.row, unit.col);
    const erupted = this.addPoints(v, team, amount);

    await new Promise((r) => setTimeout(r, Math.max(0, TOTAL_MS - IMPACT_DELAY_MS)));
    if (unit.el) unit.el.classList.remove("unit--epic-smash", "unit--epic-smash--big");
    if (unit.spriteEl) {
      unit.spriteEl.src = idleSrc;
      const idleScale = (typeof SPRITE_SCALES !== "undefined" && (SPRITE_SCALES[typeId] ?? SPRITE_SCALES.default)) || 1;
      unit.spriteEl.style.width = Math.round(120 * idleScale) + "px";
    }
    await erupted;
    Units.refreshRange(unit);
  },

  // ---------- Lanzar un gnomo al volcán (habilidad "lanzar") ----------
  addThrowMarker(unit, gnome) {
    const v = this.current();
    if (!v || !this._accepts(v)) return;
    if (typeof Fog !== "undefined" && Fog.isFogged(v.row, v.col)) return;
    const dist = Math.max(Math.abs(v.row - unit.row), Math.abs(v.col - unit.col));
    if (dist < 1 || dist > GNOME_THROW_MAX_RANGE) return;
    Units.addMarker({
      className: "pass-marker",
      row: v.row,
      col: v.col,
      zOffset: 12,
      visibleClass: "pass-marker--visible",
      owner: "gnome",
      alwaysOnTop: true,
      buildContent: (marker) => {
        const icon = document.createElement("i");
        icon.className = "ph ph-paper-plane-tilt pass-marker__icon";
        marker.appendChild(icon);
      },
      onClick: () => this.throwGnome(unit, gnome, v),
    });
  },

  async throwGnome(holder, gnome, v) {
    if (gnome.heldBy !== holder.id || gnome.busy || !this._accepts(v)) return;
    if (typeof Turns !== "undefined" && !Turns.canAct(holder)) return;
    if (typeof Turns !== "undefined") Turns.useAction(holder);
    Units.clearRangeOverlays();
    gnome.passing = false;
    gnome.busy = true;
    gnome.hideBadge();
    Units.faceTowardsTile(holder, v.row, v.col);
    gnome.row = holder.row;
    gnome.col = holder.col;
    Units.faceTowardsTile(gnome, v.row, v.col);
    if (holder.el) {
      holder.el.classList.remove("unit--throwing");
      void holder.spriteEl.offsetWidth;
      holder.el.classList.add("unit--throwing");
      setTimeout(() => holder.el && holder.el.classList.remove("unit--throwing"), 380);
    }
    const amount = gnome.points;
    gnome.detachFrom();
    gnome.spriteEl.src = GNOME_ASSETS.grita;
    await gnome.animateThrowTo(holder.row, holder.col, v.row, v.col);
    Gnome.destroyInstance(gnome);
    await this.addPoints(v, holder.team, amount);
    if (holder.el) Units.refreshRange(holder);
  },

  // ---------- IA (la CPU conoce la lava y el volcán) ----------
  // Casillas de lava que pisaría ir en línea recta de `unit` a `tile`.
  aiTileLava(unit, tile) {
    if (!this.eruption) return 0;
    return this.lavaOnPath(Units.stepPath(unit.row, unit.col, tile.row, tile.col));
  },

  // Guardia central (Units.walkPath, solo rivales): si el camino los mataría,
  // se detienen justo antes de la primera casilla de lava.
  aiGuardPath(unit, path) {
    if (!this.eruption || !path.length) return path;
    const n = this.lavaOnPath(path);
    if (n < unit.hp) return path;
    const i = path.findIndex((s) => this.lavaAt(s.row, s.col));
    return i <= 0 ? [] : path.slice(0, i);
  },

  _aiRocks(team) {
    const c = typeof Resources !== "undefined" && Resources.countsFor ? Resources.countsFor(team) : null;
    return c ? c.fragmento || 0 : 0;
  },

  _aiCanThrow(team) {
    return this._aiRocks(team) > 0 && typeof Backpack !== "undefined" && Backpack.canThrowRock(team);
  },

  _aiSpendRock(team) {
    Resources.countsFor(team).fragmento--;
    Backpack.markRockThrown(team);
  },

  // ¿Qué hace la CPU con esta unidad frente a la lava? Devuelve true si
  // ya usó una acción (movimiento) y no debe hacer nada más con ella.
  async aiHandleLava(unit) {
    if (!this.eruption || !unit.el) return false;
    const reach = typeof Movement !== "undefined" ? Movement.reachableTiles(unit) : [];
    const safe = () => (typeof Movement !== "undefined" ? Movement.reachableTiles(unit) : []).filter((t) => !this.lavaAt(t.row, t.col) && this.aiTileLava(unit, t) === 0);
    const nearestRival = () => Units.list.filter((u) => u.team !== unit.team).reduce((b, u) => {
      const d = Math.max(Math.abs(u.row - unit.row), Math.abs(u.col - unit.col));
      return !b || d < b.d ? { u, d } : b;
    }, null);
    const goal = nearestRival();
    const distGoal = (t) => (goal ? Math.max(Math.abs(t.row - goal.u.row), Math.abs(t.col - goal.u.col)) : 0);
    const onLava = !!this.lavaAt(unit.row, unit.col);
    let exits = safe();
    // Apagar una casilla de lava adyacente con una piedra para abrir salida
    // (una sola piedra por turno).
    if ((onLava || (exits.length === 0 && this.lava.some((l) => Math.max(Math.abs(l.row - unit.row), Math.abs(l.col - unit.col)) <= 1))) && exits.length === 0 && this._aiCanThrow(unit.team)) {
      const adj = this.lava
        .filter((l) => Math.max(Math.abs(l.row - unit.row), Math.abs(l.col - unit.col)) === 1)
        .filter((l) => this._lavaTileFreeToStand(unit, l))
        .sort((a, b) => distGoal(a) - distGoal(b));
      if (adj.length) {
        this._aiSpendRock(unit.team);
        if (typeof SFX !== "undefined" && SFX.rockThrow) SFX.rockThrow(0.35);
        await new Promise((r) => setTimeout(r, 350));
        this.extinguish(adj[0]);
        await new Promise((r) => setTimeout(r, 300));
        exits = safe();
      }
    }
    if (onLava && Turns.canAct(unit)) {
      // Sobre lava: salir a la casilla segura que más le acerque a un rival.
      if (exits.length) {
        exits.sort((a, b) => distGoal(a) - distGoal(b));
        await Movement.moveTo(unit, exits[0].row, exits[0].col);
        return true;
      }
      // Sin salida limpia: el camino que menos lava cruce (sin morir) hasta una casilla sin lava.
      const out = reach
        .filter((t) => !this.lavaAt(t.row, t.col))
        .map((t) => ({ t, n: this.aiTileLava(unit, t) }))
        .filter((x) => x.n < unit.hp)
        .sort((a, b) => a.n - b.n || distGoal(a.t) - distGoal(b.t));
      if (out.length) {
        await Movement.moveTo(unit, out[0].t.row, out[0].t.col);
        return true;
      }
    }
    return false;
  },

  _lavaTileFreeToStand(unit, l) {
    if (Units.unitAt(l.row, l.col)) return false;
    if (typeof Villages !== "undefined" && Villages.at(l.row, l.col)) return false;
    if (typeof Obelisks !== "undefined" && Obelisks.at(l.row, l.col)) return false;
    return true;
  },

  // Puntuación (para el plan de la IA) de usar el volcán.
  aiPlanScore(team) {
    const v = this.current();
    if (!v || !this._accepts(v)) return -9;
    const rivals = Teams.all.filter((t) => t !== team && (typeof Obelisks === "undefined" || Obelisks.byTeam(t)));
    if (!rivals.length) return -9;
    const losing = typeof Turns !== "undefined" && Turns.losingTeam() === team ? 0.4 : 0;
    return 0.45 + (v.points >= VOLCANO_ON_AT ? 0.5 : 0) + losing + (v.lastTeam === team ? 0.2 : 0);
  },

  // ¿Le conviene a `unit` (con `held` en la mano) usar el volcán ahora?
  _aiWantsFeed(unit, held) {
    const v = this.current();
    if (!v || !this._accepts(v) || held.points <= 0) return false;
    const after = v.points + held.points;
    if (after >= VOLCANO_MAX) return true; // remate: la erupción es suya
    const plan = Turns._aiPlan[unit.team];
    if (!plan || plan.mode !== "volcano") return false;
    // No dejárselo al rival a tiro: si tras sumar quedan pocos puntos y un rival
    // con gnomo puede rematar, mejor no regalarlo.
    const left = VOLCANO_MAX - after;
    const rivalCarrier = Units.list.some((u) => u.team !== unit.team && typeof Gnome !== "undefined" && Gnome.isHeldBy(u.id) && Math.max(Math.abs(u.row - v.row), Math.abs(u.col - v.col)) <= 7);
    return !(left <= 9 && rivalCarrier);
  },

  async aiFeed(unit, held) {
    const v = this.current();
    if (!this._aiWantsFeed(unit, held)) return false;
    if (this.findApproachTile(unit, v)) {
      await this.approachAndSmash(unit, v);
      return true;
    }
    const dest = Turns._aiPickMoveTileToward(unit, { row: v.row, col: v.col });
    if (dest) {
      await Movement.moveTo(unit, dest.row, dest.col);
      return true;
    }
    return false;
  },

  // Piedra de remate (sin gastar acción): si una piedra completa la erupción.
  async aiRockFinisher(team) {
    const v = this.current();
    if (!v || !this._accepts(v) || v.points + 1 < VOLCANO_MAX || !this._aiCanThrow(team)) return false;
    this._aiSpendRock(team);
    if (typeof SFX !== "undefined" && SFX.rockThrow) SFX.rockThrow(0.4);
    await new Promise((r) => setTimeout(r, 400));
    await this.addPoints(v, team, 1);
    return true;
  },

  // ---------- Niebla ----------
  refreshFog() {
    if (typeof Fog === "undefined") return;
    this.list.forEach((v) => {
      const fogged = Fog.isFoggedReal(v.row, v.col);
      v.el.classList.toggle("unit--fog-hidden", fogged);
      v.el.classList.toggle("gg-remembered", !fogged && !Fog.isPerceived(v.row, v.col));
    });
    this.lava.forEach((l) => {
      const fogged = Fog.isFoggedReal(l.row, l.col);
      l.el.classList.toggle("unit--fog-hidden", fogged);
      l.el.classList.toggle("gg-remembered", !fogged && !Fog.isPerceived(l.row, l.col));
    });
  },
};

if (typeof Units !== "undefined") Units.registerRangeProvider(Volcano);
if (typeof Turns !== "undefined") Turns.registerTurnStartListener(Volcano);

/* Gnomore Gnomes — Huevo de Grulla (nivel Hurrycrane Village).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Colocar un huevo sobre una NUBE en el centro del mapa (solo en ese nivel).
     - GNOMAZO: lanzarle un gnomo carga el huevo (+EGG_CHARGE_PER_HIT, máx. 30)
       y lo manda EN LA DIRECCIÓN del golpe (se aleja de quien lo lanza;
       EGG_PUSH_AWAY = -1 lo invierte). Cuanto más cargado, más casillas
       avanza (1 + carga/5). Rebota en los límites del tablero como la bola
       del Arkanoid. Mientras se apunta, un fantasma enseña dónde acabará.
     - Atropella unidades (amigas o enemigas): 1 de daño y las aparta 1
       casilla de lado. Contra un OBELISCO rebota como la bola de un pinball
       (le quita 1 de vida, sea amigo o enemigo) y sigue su camino.
     - Con la carga al máximo, EGG_BREAK_HITS golpes más lo rompen (sprites
       agrietado / muy agrietado) y también reaparece en el turno siguiente.
     - La carga se consulta manteniendo pulsado sobre el huevo, como un gnomo.
   La vista previa dibuja toda la trayectoria con sus rebotes.
   Mientras sea visible, el huevo bloquea su casilla (se engancha a Drums.at). */

const EGG_DIR = "assets/niveles/hurrycrane/";
const EGG_MAX_CHARGE = 30;
const EGG_CHARGE_PER_HIT = 5; // carga que suma cada gnomazo
const EGG_BREAK_HITS = 5; // golpes con la carga al máximo hasta romperse
const EGG_PUSH_AWAY = 1; // 1 = en la dirección del golpe; -1 = hacia quien lanza
const EGG_GNOME_POINTS = 5; // puntos que carga el gnomo al estamparse
const EGG_STEP_MS = 210; // tiempo por casilla durante el vuelo
const EGG_PULSE = [4, 2.8, 1.8, 1.05, 0.55]; // segundos por latido según carga
const EGG_AMP = [0.012, 0.02, 0.03, 0.045, 0.06];
const EGG_DIRS = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];

const Egg = {
  egg: null, // { id,row,col,el,spriteEl,badgeEl,badgeValueEl,charge,hitsMax,exploded,... }
  nests: {}, // sin uso (compatibilidad con fog.js / net.js)
  _respawnPending: false,
  _busy: false,
  _pressed: false,

  isActive() {
    return typeof LevelAssets !== "undefined" && LevelAssets.current === "hurrycrane_village";
  },

  resetAll() {
    if (this.egg) { this.egg.el.remove(); if (this.egg.badgeEl) this.egg.badgeEl.remove(); }
    this.egg = null;
    this._respawnPending = false;
    this._busy = false;
    this._pressed = false;
  },

  cheb(a, b) {
    return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
  },

  blocks(row, col) {
    const e = this.egg;
    if (e && !e.exploded && e.row === row && e.col === col) return e;
    return null;
  },

  // ---------- Reparto ----------
  spawn(size) {
    if (!this.isActive()) return;
    const best = this._centerTile(size, 6);
    if (best) this._createEgg(best.row, best.col);
  },

  _centerTile(size, openMin) {
    const mid = (size - 1) / 2;
    let best = null;
    for (let row = 1; row < size - 1; row++) for (let col = 1; col < size - 1; col++) {
      if (!this._free(row, col, size, openMin)) continue;
      if (typeof Obelisks !== "undefined" && Obelisks.list.some((o) => this.cheb(o, { row, col }) < 4)) continue;
      const s = Math.hypot(row - mid, col - mid);
      if (!best || s < best.s) best = { row, col, s };
    }
    return best;
  },

  _tileObjectAt(row, col) {
    const mods = [
      typeof Villages !== "undefined" ? Villages : null,
      typeof Shops !== "undefined" ? Shops : null,
      typeof Obelisks !== "undefined" ? Obelisks : null,
      typeof Altar !== "undefined" ? Altar : null,
      typeof Oracle !== "undefined" ? Oracle : null,
      typeof Bushes !== "undefined" ? Bushes : null,
      typeof Resources !== "undefined" ? Resources : null,
      typeof TotemVision !== "undefined" ? TotemVision : null,
      typeof GnomOgro !== "undefined" ? GnomOgro : null,
      typeof Mushrooms !== "undefined" ? Mushrooms : null,
    ];
    return mods.some((m) => m && typeof m.at === "function" && m.at(row, col));
  },

  _free(row, col, size, openMin) {
    if (row < 0 || col < 0 || row >= size || col >= size) return false;
    if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) return false;
    if (typeof Units !== "undefined" && Units.unitAt(row, col)) return false;
    if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) return false;
    if (this._tileObjectAt(row, col)) return false;
    if (typeof Obelisks !== "undefined" && Obelisks.isAdjacent && Obelisks.isAdjacent(row, col)) return false;
    if (typeof Drums !== "undefined" && Drums.at(row, col)) return false;
    if (typeof Volcano !== "undefined" && Volcano.isNear && Volcano.isNear(row, col, 2)) return false;
    let open = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if ((dr || dc) && (typeof TerrainMap === "undefined" || TerrainMap.isWalkable(row + dr, col + dc))) open++;
    }
    return open >= (openMin || 5);
  },

  // ¿Puede posarse aquí? Firme, libre (salvo unidades que se apartarán) y dentro.
  _canRest(row, col, ignoreUnit) {
    const size = Units.boardSize;
    if (row < 0 || col < 0 || row >= size || col >= size) return false;
    const u = Units.unitAt(row, col);
    if (u && u !== ignoreUnit) return false;
    if (Gnome.isAt(row, col)) return false;
    if (this._tileObjectAt(row, col)) return false;
    if (typeof Drums !== "undefined" && Drums.list.some((d) => d.row === row && d.col === col)) return false;
    return typeof TerrainMap === "undefined" || TerrainMap.isWalkable(row, col);
  },

  _setSprite(img, file) {
    const src = EGG_DIR + file;
    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(img, src);
    else img.src = src;
  },

  _place(el, row, col, zExtra) {
    const { x, y } = getTileCenter(row, col, Units.boardSize);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.zIndex = String((row + col) * 10 + (zExtra || 5));
  },

  _createEgg(row, col) {
    const el = document.createElement("div");
    el.className = "unit egg";
    const cloud = document.createElement("div");
    cloud.className = "egg__cloud";
    for (let i = 0; i < 5; i++) {
      const p = document.createElement("i");
      p.className = "egg__puff egg__puff--" + i;
      cloud.appendChild(p);
    }
    el.appendChild(cloud);
    const spriteEl = document.createElement("img");
    spriteEl.className = "egg__sprite";
    spriteEl.decoding = "async";
    spriteEl.alt = "";
    spriteEl.draggable = false;
    el.appendChild(spriteEl);
    Units.container.appendChild(el);
    this._place(el, row, col, 6);

    // Mantener pulsado sobre el huevo -> muestra su carga (igual que un gnomo).
    el.addEventListener("pointerdown", (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      this.showBadge();
    });
    el.addEventListener("contextmenu", (ev) => ev.preventDefault());

    this.egg = { id: "egg-1", row, col, el, spriteEl, badgeEl: null, badgeValueEl: null, charge: 0, hitsMax: 0, exploded: false, lastTeam: null };
    this._applyStage();
    this.refreshFog();
    return this.egg;
  },

  // ---------- Carga: sprite, latido y contador ----------
  _stageFile(hitsMax) {
    return hitsMax >= 3 ? "huevo_muy_agrietado.png" : hitsMax >= 1 ? "huevo_agrietado.png" : "huevo.png";
  },

  _applyStage() {
    const e = this.egg;
    if (!e) return;
    const f = this._stageFile(e.hitsMax);
    if (e._stage !== f) {
      e._stage = f;
      this._setSprite(e.spriteEl, f);
    }
    const h = Math.min(EGG_PULSE.length - 1, Math.floor(e.charge / 6));
    e.spriteEl.style.setProperty("--egg-pulse", `${EGG_PULSE[h]}s`);
    e.spriteEl.style.setProperty("--egg-amp", String(EGG_AMP[h]));
    if (e.badgeValueEl) e.badgeValueEl.textContent = String(e.charge);
  },

  _ensureBadge() {
    const e = this.egg;
    if (!e || e.badgeEl) return;
    const badge = document.createElement("div");
    badge.className = "gnome-points-badge egg-points-badge";
    badge.addEventListener("click", (ev) => ev.stopPropagation());
    const value = document.createElement("span");
    value.className = "gnome-points-badge__value";
    value.textContent = String(e.charge);
    badge.appendChild(value);
    Units.container.appendChild(badge);
    e.badgeEl = badge;
    e.badgeValueEl = value;
  },

  _placeBadge() {
    const e = this.egg;
    if (!e || !e.badgeEl) return;
    const { x, y } = getTileCenter(e.row, e.col, Units.boardSize);
    e.badgeEl.style.left = `${x}px`;
    e.badgeEl.style.top = `${y - 215}px`;
    e.badgeEl.style.zIndex = String((e.row + e.col) * 10 + 20);
  },

  showBadge() {
    const e = this.egg;
    if (!e || e.exploded || this._hidden()) return;
    this._ensureBadge();
    this._placeBadge();
    this._pressed = true;
    e.badgeEl.classList.add("gnome-points-badge--visible");
  },

  hideBadge() {
    this._pressed = false;
    if (this.egg && this.egg.badgeEl) this.egg.badgeEl.classList.remove("gnome-points-badge--visible");
  },

  _live() {
    return this.isActive() && this.egg && !this.egg.exploded;
  },

  _hidden() {
    const e = this.egg;
    if (!e) return true;
    return typeof Fog !== "undefined" && (Fog.isFoggedReal(e.row, e.col) || !!e._unseen);
  },

  // ---------- Plan del vuelo ----------
  _dirFrom(holder, e) {
    const k = Math.round(Math.atan2(e.row - holder.row, e.col - holder.col) / (Math.PI / 4));
    const d = EGG_DIRS[((k % 8) + 8) % 8];
    return [d[0] * EGG_PUSH_AWAY, d[1] * EGG_PUSH_AWAY];
  },

  _distFor(charge) {
    return 1 + Math.floor(charge / EGG_CHARGE_PER_HIT);
  },

  // Casilla a la que se aparta una unidad atropellada (perpendicular al vuelo).
  _shoveTile(unit, dr, dc, avoid) {
    const size = Units.boardSize;
    for (const [pr, pc] of [[dc, -dr], [-dc, dr]]) {
      const row = unit.row + pr, col = unit.col + pc;
      if (row < 0 || col < 0 || row >= size || col >= size) continue;
      if (avoid.some((t) => t.row === row && t.col === col)) continue;
      if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) continue;
      if (Units.unitAt(row, col) || Gnome.isAt(row, col) || this._tileObjectAt(row, col)) continue;
      if (typeof Drums !== "undefined" && Drums.list.some((d) => d.row === row && d.col === col)) continue;
      return { row, col };
    }
    return null;
  },

  // Simula el vuelo de `dist` casillas desde el huevo en la dirección `dir`
  // con rebotes en los límites del tablero y en los obeliscos (pinball).
  _simulate(dir, dist, holderTeam, holder) {
    const e = this.egg;
    const size = Units.boardSize;
    const obAt = (r, c) => (typeof Obelisks !== "undefined" && r >= 0 && c >= 0 && r < size && c < size ? Obelisks.at(r, c) : null);
    const wall = (r, c) => r < 0 || c < 0 || r >= size || c >= size || !!obAt(r, c);
    let r = e.row, c = e.col, dr = dir[0], dc = dir[1];
    const steps = [];
    for (let i = 0; i < dist; i++) {
      let nr = r + dr, nc = c + dc;
      let bounced = false, ob = null;
      if (wall(nr, nc)) {
        bounced = true;
        ob = obAt(nr, nc);
        const wr = wall(r + dr, c), wc = wall(r, c + dc);
        if (dr && dc) {
          if (wr && !wc) dr = -dr;
          else if (wc && !wr) dc = -dc;
          else { dr = -dr; dc = -dc; }
        } else if (dr) dr = -dr;
        else dc = -dc;
        nr = r + dr; nc = c + dc;
        if (wall(nr, nc)) { nr = r; nc = c; } // atrapado: se queda en su casilla
      }
      r = nr; c = nc;
      const step = { row: r, col: c, dr, dc, bounced, unit: null, shove: null, ob: ob || null };
      steps.push(step);
      const u = Units.unitAt(r, c);
      if (u && u !== holder && !(r === e.row && c === e.col)) step.unit = u;
    }
    // Posarse: hacia atrás hasta una casilla válida (una unidad atropellada se aparta).
    const avoid = steps.map((s) => ({ row: s.row, col: s.col }));
    for (let k = steps.length - 1; k >= 0; k--) {
      const s = steps[k];
      const own = s.row === e.row && s.col === e.col;
      if (s.unit) {
        const sh = this._shoveTile(s.unit, s.dr, s.dc, avoid);
        if (!sh || !this._canRest(s.row, s.col, s.unit)) continue;
      } else if (!own && !this._canRest(s.row, s.col)) continue;
      steps.length = k + 1;
      steps.forEach((x) => { if (x.unit) x.shove = this._shoveTile(x.unit, x.dr, x.dc, avoid); });
      return { steps, explode: null, dest: { row: s.row, col: s.col }, dir };
    }
    return { steps: [], explode: null, dest: null, dir };
  },

  // Qué pasaría si `holder` le lanzase un gnomo ahora mismo.
  _plan(holder) {
    const e = this.egg;
    const newCharge = Math.min(EGG_MAX_CHARGE, e.charge + EGG_CHARGE_PER_HIT);
    const breaks = e.charge >= EGG_MAX_CHARGE && e.hitsMax + 1 >= EGG_BREAK_HITS;
    const dir = this._dirFrom(holder, e);
    const sim = breaks ? { steps: [], explode: null, dest: null, dir } : this._simulate(dir, this._distFor(newCharge), holder.team, holder);
    sim.newCharge = newCharge;
    sim.breaks = breaks;
    return sim;
  },

  // ---------- Lanzar gnomos contra el huevo ----------
  _targetable() {
    return this._live() && !this._hidden() && !this._busy;
  },

  _interceptor(holder) {
    const e = this.egg;
    const d = this.cheb(holder, e);
    for (let i = 1; i < d; i++) {
      const r = Math.round(holder.row + ((e.row - holder.row) * i) / d);
      const c = Math.round(holder.col + ((e.col - holder.col) * i) / d);
      const u = Units.unitAt(r, c);
      if (u && u !== holder) return u;
    }
    return null;
  },

  addThrowMarker(unit, gnome) {
    if (!this._targetable()) return;
    const e = this.egg;
    const dist = this.cheb(unit, e);
    if (dist < 1 || dist > GNOME_THROW_MAX_RANGE) return;
    const blocked = !!this._interceptor(unit);
    Units.addMarker({
      className: "pass-marker egg-throw-marker" + (blocked ? " egg-throw-marker--blocked" : ""),
      row: e.row,
      col: e.col,
      zOffset: 12,
      visibleClass: "pass-marker--visible",
      owner: "gnome",
      alwaysOnTop: true,
      buildContent: (marker) => {
        const icon = document.createElement("i");
        icon.className = "ph ph-paper-plane-tilt pass-marker__icon";
        marker.appendChild(icon);
      },
      onClick: () => this.throwGnome(unit, gnome),
    });
    this._addPreview(unit);
  },

  // Fantasma del huevo donde acabará + casillas de paso + avisos, para poder rectificar.
  _addPreview(holder) {
    const plan = this._plan(holder);
    const hot = "";
    const mk = (row, col, build, zOffset) =>
      Units.addMarker({
        className: "pass-marker egg-preview-marker" + hot,
        row, col,
        zOffset: zOffset || 8,
        visibleClass: "pass-marker--visible",
        owner: "gnome",
        alwaysOnTop: true,
        buildContent: build,
      });
    const lab = (m, text, cls) => {
      const l = document.createElement("div");
      l.className = "egg-preview__label" + (cls ? " " + cls : "");
      l.textContent = text;
      m.appendChild(l);
    };
    // Trayectoria: un punto por casilla (los rebotes, en amarillo; los
    // atropellos y los golpes a obeliscos, en rojo con su "-1").
    const marks = new Map();
    plan.steps.forEach((t, idx) => {
      const key = t.row + "," + t.col;
      const m0 = marks.get(key) || { row: t.row, col: t.col, bounce: false, unit: false, ob: false, nums: [] };
      m0.nums.push(idx + 1);
      m0.bounce = m0.bounce || t.bounced;
      m0.unit = m0.unit || !!t.unit;
      m0.ob = m0.ob || !!t.ob;
      marks.set(key, m0);
    });
    marks.forEach((t) => {
      if (plan.dest && t.row === plan.dest.row && t.col === plan.dest.col && !t.ob && !t.unit) return;
      mk(t.row, t.col, (m) => {
        const dot = document.createElement("div");
        dot.className = "egg-preview__dot" + (t.unit || t.ob ? " egg-preview__dot--hit" : "") + (t.bounce ? " egg-preview__dot--bounce" : "");
        dot.textContent = t.nums.slice(0, 2).join("/");
        m.appendChild(dot);
        if (t.unit) lab(m, "-1");
      }, 6);
    });
    // Los obeliscos golpeados se marcan sobre el propio obelisco.
    const obs = new Set();
    plan.steps.forEach((t) => {
      if (!t.ob || obs.has(t.ob)) return;
      obs.add(t.ob);
      mk(t.ob.row, t.ob.col, (m) => lab(m, "-1"), 14);
    });
    if (plan.breaks) {
      mk(this.egg.row, this.egg.col, (m) => lab(m, "¡SE ROMPE!", "egg-preview__label--blocked"), 9);
    } else if (plan.dest) {
      mk(plan.dest.row, plan.dest.col, (m) => {
        const ring = document.createElement("div");
        ring.className = "egg-preview__ring";
        m.appendChild(ring);
        const img = document.createElement("img");
        img.className = "egg-preview__ghost";
        img.alt = "";
        img.draggable = false;
        img.src = EGG_DIR + "huevo_lowres.png";
        m.appendChild(img);
        if (plan.steps.length && plan.steps[plan.steps.length - 1].unit) lab(m, "-1");
      }, 9);
    } else {
      mk(this.egg.row, this.egg.col, (m) => lab(m, "Sin sitio", "egg-preview__label--blocked"), 9);
    }
  },

  async throwGnome(holder, gnome) {
    const e = this.egg;
    if (!this._targetable() || gnome.heldBy !== holder.id || gnome.busy) return;
    if (typeof Turns !== "undefined" && !Turns.canAct(holder)) return;
    if (typeof Turns !== "undefined") Turns.useAction(holder);
    Units.clearRangeOverlays();
    gnome.passing = false;
    gnome.busy = true;
    gnome.hideBadge();

    const dist = this.cheb(holder, e);
    const type = UNIT_TYPES[holder.typeId];
    const success = Math.random() < gnome.computePassSuccess(type.agilidad, dist, type.movimiento);
    Units.faceTowardsTile(holder, e.row, e.col);
    gnome.row = holder.row;
    gnome.col = holder.col;
    Units.faceTowardsTile(gnome, e.row, e.col);
    if (holder.el) {
      holder.el.classList.remove("unit--throwing");
      void holder.spriteEl.offsetWidth;
      holder.el.classList.add("unit--throwing");
      setTimeout(() => holder.el && holder.el.classList.remove("unit--throwing"), 380);
    }
    gnome.detachFrom();
    gnome.spriteEl.src = GNOME_ASSETS.grita;

    const blocker = success ? this._interceptor(holder) : null;
    if (!success) {
      const end = gnome.findDropTile(holder, GNOME_THROW_MAX_RANGE);
      await gnome.animateThrowTo(holder.row, holder.col, end.row, end.col);
      await gnome.landAt(end);
    } else if (blocker) {
      await gnome.animateThrowTo(holder.row, holder.col, blocker.row, blocker.col);
      if (!Gnome.isHeldBy(blocker.id)) {
        gnome.row = blocker.row;
        gnome.col = blocker.col;
        gnome.attachTo(blocker);
        const gained = gnome.computePassPoints(dist, type.movimiento);
        gnome._addPoints(gained);
        Units.spawnFloatingText(blocker, `+${gained}`, { className: "dmg-popup gnome-points-popup" });
        SFX.passSuccess();
      } else {
        const end = gnome.findDropTile(blocker);
        await gnome.landAt({ row: end.row, col: end.col });
      }
    } else {
      this._busy = true;
      try { await this._gnomazo(holder, gnome); } finally { this._busy = false; }
    }

    gnome.busy = false;
    if (holder.el) Units.refreshRange(holder);
    if (gnome._refreshSelectedUnitRange) gnome._refreshSelectedUnitRange();
  },

  async _gnomazo(holder, gnome) {
    const e = this.egg;
    e.lastTeam = holder.team;
    const plan = this._plan(holder); // ANTES de que cambie nada
    const from = { row: e.row, col: e.col };
    await gnome.animateThrowTo(holder.row, holder.col, e.row, e.col);
    gnome.row = e.row;
    gnome.col = e.col;
    gnome._addPoints(EGG_GNOME_POINTS);
    Units.spawnFloatingText({ row: e.row, col: e.col, team: "player" }, `+${EGG_GNOME_POINTS}`, { className: "dmg-popup gnome-points-popup" });
    if (typeof SFX !== "undefined") { try { SFX.hit(); if (SFX.rockHit) SFX.rockHit(); } catch (er) {} }
    if (gnome.spriteEl && gnome.spriteEl.animate) {
      gnome.spriteEl.animate(
        [{ transform: "scale(1,1)" }, { transform: "scale(1.35,.6)", offset: 0.3 }, { transform: "scale(.85,1.2)", offset: 0.7 }, { transform: "scale(1,1)" }],
        { duration: 300, easing: "ease-out" }
      );
    }
    if (e.charge >= EGG_MAX_CHARGE) e.hitsMax++;
    e.charge = plan.newCharge;
    this._applyStage();
    this._pulseFx();
    this._flash();
    Units.spawnFloatingText({ row: e.row, col: e.col, team: "player" }, `Carga ${e.charge}`, { className: "dmg-popup popup--good" });
    await new Promise((r) => setTimeout(r, 280));

    const eggFlight = plan.breaks ? this._break() : this._fly(plan, holder);
    const tile = this._bounceTile(from, holder, gnome, plan);
    if (tile) {
      await gnome.animateThrowTo(from.row, from.col, tile.row, tile.col);
      await gnome.landAt(tile, { sound: () => SFX.gnomeLandSoft() });
    } else {
      const end = gnome.findDropTile(holder, GNOME_THROW_MAX_RANGE);
      await gnome.animateThrowTo(from.row, from.col, end.row, end.col);
      await gnome.landAt(end);
    }
    await eggFlight;
    await gnome._fleeAwayFrom(from.row, from.col, 3);
  },

  _bounceTile(from, holder, gnome, plan) {
    let best = null;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const row = from.row + dr, col = from.col + dc;
      if (row < 0 || col < 0 || row >= Units.boardSize || col >= Units.boardSize) continue;
      if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) continue;
      if (Units.unitAt(row, col) || Gnome._otherGnomeAt(gnome, row, col) || this._tileObjectAt(row, col)) continue;
      if (plan.steps.some((t) => t.row === row && t.col === col)) continue;
      const score = this.cheb({ row, col }, holder) * 10 + Math.hypot(row - holder.row, col - holder.col);
      if (!best || score < best.score) best = { row, col, score };
    }
    return best;
  },

  // ---------- Vuelo del huevo ----------
  async _fly(plan, holder) {
    const e = this.egg;
    if (!plan.steps.length) {
      if (!this._hidden()) Units.spawnFloatingText({ row: e.row, col: e.col, team: "player" }, "Sin sitio", { className: "dmg-popup" });
      return;
    }
    const avoid = plan.steps.map((s) => ({ row: s.row, col: s.col }));
    e.el.style.setProperty("--egg-step", `${EGG_STEP_MS}ms`);
    e.el.classList.add("egg--moving");
    let prev = plan.dir;
    for (const s of plan.steps) {
      e.row = s.row;
      e.col = s.col;
      this._place(e.el, s.row, s.col, 6);
      this._placeBadge();
      if (s.bounced || s.dr !== prev[0] || s.dc !== prev[1]) this._bounceFx();
      prev = [s.dr, s.dc];
      await new Promise((r) => setTimeout(r, EGG_STEP_MS));
      if (s.ob) this._hitObelisk(s.ob, holder.team);
      if (s.unit && s.unit.el && s.unit.hp > 0) await this._trample(s, holder.team, avoid);
      if (typeof Fog !== "undefined") Fog.applyVisibility();
    }
    e.el.classList.remove("egg--moving");
    if (typeof Fog !== "undefined") Fog.applyVisibility();
    this.refreshFog();
  },

  // Atropello: 1 de daño y se aparta 1 casilla de lado.
  async _trample(step, causer, avoid) {
    const u = step.unit;
    if (typeof SFX !== "undefined") { try { SFX.hit(); } catch (er) {} }
    if (typeof Drums !== "undefined" && Drums._applyDamage) Drums._applyDamage({ kind: "unit", ref: u, row: u.row, col: u.col }, 1, causer);
    if (!u.el || u.hp <= 0) return;
    const to = step.shove || this._shoveTile(u, step.dr, step.dc, avoid);
    if (!to) return;
    const prevLeft = u.el.style.left, prevTop = u.el.style.top;
    u.el.classList.add("unit--moving");
    u.row = to.row;
    u.col = to.col;
    const { x, y } = getTileCenter(to.row, to.col, Units.boardSize);
    u.el.style.left = `${x}px`;
    u.el.style.top = `${y}px`;
    u.el.style.zIndex = String((to.row + to.col) * 10 + 5);
    if (u.spriteEl) {
      u.spriteEl.classList.remove("unit__sprite--hop");
      void u.spriteEl.offsetWidth;
      u.spriteEl.classList.add("unit__sprite--hop");
    }
    await Units.awaitPositionSettle(u.el, prevLeft, prevTop, 160);
    u.el.classList.remove("unit--moving");
    if (u.spriteEl) u.spriteEl.classList.remove("unit__sprite--hop");
    if (typeof Villages !== "undefined") Villages.refreshOcclusion();
    if (typeof Obelisks !== "undefined") Obelisks.refreshOcclusion();
    if (typeof Units !== "undefined" && Units.refreshUnitOcclusion) Units.refreshUnitOcclusion();
  },

  _shake(big) {
    const vp = document.getElementById("board-viewport");
    if (!vp) return;
    const cls = big ? "board-viewport--shake--big" : "board-viewport--shake";
    vp.classList.remove(cls);
    void vp.offsetWidth;
    vp.classList.add(cls);
    setTimeout(() => vp.classList.remove(cls), 420);
  },

  // Rebote contra un obelisco: 1 de daño (sea amigo o enemigo), temblor y destello.
  _hitObelisk(ob, causer) {
    this._shake(false);
    this._flash();
    if (typeof SFX !== "undefined") { try { SFX.rockHit(); } catch (er) {} }
    if (typeof Drums !== "undefined" && Drums._applyDamage) Drums._applyDamage({ kind: "obelisk", ref: ob, row: ob.row, col: ob.col }, 1, causer);
  },

  // Se rompe por exceso de golpes (sin explosión ni daño).
  async _break() {
    const e = this.egg;
    e.exploded = true;
    this._respawnPending = true;
    this.hideBadge();
    this._shake(false);
    if (typeof SFX !== "undefined") { try { SFX.rockHit(); } catch (er) {} }
    this._shatter();
    if (typeof Banners !== "undefined") Banners.text("¡El huevo se ha roto!", 1, "yellow");
    await new Promise((r) => setTimeout(r, 500));
    e.el.style.opacity = "0";
  },

  _shatter() {
    const e = this.egg;
    const { x, y } = getTileCenter(e.row, e.col, Units.boardSize);
    for (let i = 0; i < 14; i++) {
      const s = document.createElement("div");
      s.className = "egg-shard";
      s.style.left = `${x}px`;
      s.style.top = `${y - 60}px`;
      s.style.zIndex = String((e.row + e.col) * 10 + 22);
      Units.container.appendChild(s);
      const a = (i / 14) * Math.PI * 2 + NR() * 0.4;
      const d = 80 + NR() * 90;
      s.animate(
        [
          { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d - 60}px)) rotate(${NR() * 360}deg) scale(.6)`, opacity: 1, offset: 0.6 },
          { transform: `translate(calc(-50% + ${Math.cos(a) * d * 1.1}px), calc(-50% + ${Math.sin(a) * d + 40}px)) rotate(${NR() * 540}deg) scale(.3)`, opacity: 0 },
        ],
        { duration: 950, easing: "ease-out" }
      ).onfinish = () => s.remove();
    }
    if (e.spriteEl.animate) {
      e.spriteEl.animate(
        [{ transform: "scale(1,1)", opacity: 1 }, { transform: "scale(1.3,.8)", opacity: 1, offset: 0.25 }, { transform: "scale(.4,1.5)", opacity: 0 }],
        { duration: 520, easing: "ease-in", fill: "forwards" }
      );
    }
  },

  // ---------- Efectos ----------
  _bounceFx() {
    const e = this.egg;
    if (!e || !e.spriteEl.animate) return;
    if (typeof SFX !== "undefined") { try { SFX.rockHit(); } catch (er) {} }
    e.spriteEl.animate(
      [{ scale: "1 1" }, { scale: "1.25 0.78", offset: 0.3 }, { scale: "0.9 1.12", offset: 0.65 }, { scale: "1 1" }],
      { duration: 240, easing: "ease-out" }
    );
  },

  _pulseFx() {
    const e = this.egg;
    if (!e || !e.spriteEl.animate) return;
    e.spriteEl.animate(
      [{ scale: "1 1" }, { scale: "1.08 0.9", offset: 0.2 }, { scale: "0.96 1.07", offset: 0.5 }, { scale: "1 1" }],
      { duration: 420, easing: "ease-out" }
    );
  },

  _flash() {
    const e = this.egg;
    if (!e) return;
    const { x, y } = getTileCenter(e.row, e.col, Units.boardSize);
    const f = document.createElement("div");
    f.className = "egg-flash";
    f.style.left = `${x}px`;
    f.style.top = `${y - 60}px`;
    f.style.zIndex = String((e.row + e.col) * 10 + 20);
    Units.container.appendChild(f);
    f.animate(
      [{ transform: "translate(-50%,-50%) scale(.2)", opacity: 1 }, { transform: "translate(-50%,-50%) scale(1.3)", opacity: 0 }],
      { duration: 420, easing: "ease-out" }
    ).onfinish = () => f.remove();
  },

  // ---------- Turnos: reaparición ----------
  onTurnStart() {
    if (this._respawnPending) this._respawn();
  },

  _respawn() {
    const e = this.egg;
    this._respawnPending = false;
    if (!e) return;
    const best = this._centerTile(Units.boardSize, 5) || { row: e.row, col: e.col };
    e.row = best.row;
    e.col = best.col;
    e.charge = 0;
    e.hitsMax = 0;
    e.exploded = false;
    e._stage = null;
    e.el.classList.add("egg--respawn");
    e.el.style.opacity = "0";
    if (e.spriteEl.getAnimations) e.spriteEl.getAnimations().forEach((a) => { if (!a.animationName) a.cancel(); });
    this._place(e.el, e.row, e.col, 6);
    this._placeBadge();
    this._applyStage();
    void e.el.offsetWidth;
    e.el.style.opacity = "1";
    setTimeout(() => e.el.classList.remove("egg--respawn"), 1400);
    if (typeof Fog !== "undefined") Fog.applyVisibility();
    this.refreshFog();
    if (!this._hidden()) {
      this._flash();
      if (typeof Banners !== "undefined") Banners.text("¡El huevo reaparece!", 1, "yellow");
    }
  },

  // ---------- Niebla ----------
  refreshFog() {
    if (typeof Fog === "undefined") return;
    const e = this.egg;
    if (!e) return;
    if (e._unseen && Fog.isPerceived(e.row, e.col) && !Fog.isFoggedReal(e.row, e.col)) e._unseen = false;
    const fogged = Fog.isFoggedReal(e.row, e.col) || !!e._unseen;
    e.el.classList.toggle("unit--fog-hidden", fogged);
    e.el.classList.toggle("gg-remembered", !fogged && !Fog.isPerceived(e.row, e.col));
    if (fogged && this._pressed) this.hideBadge();
  },
};

// ---------- IA rival ----------
// Lanza si el golpe rebota en obeliscos ENEMIGOS o atropella a más enemigos que aliados.
Egg.aiAct = async function (unit) {
  if (!this._live() || this._busy || !unit.el || unit.team === "player") return false;
  if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return false;
  const held = typeof Gnome !== "undefined" ? Gnome.list.find((g) => g.heldBy === unit.id) : null;
  if (!held || held.busy) return false;
  const e = this.egg;
  const dist = this.cheb(unit, e);
  if (dist < 1 || dist > GNOME_THROW_MAX_RANGE) return false;
  if (this._interceptor(unit)) return false;
  const plan = this._plan(unit);
  if (plan.breaks) return false;
  let score = 0;
  plan.steps.forEach((s) => { if (s.ob) score += s.ob.team !== unit.team ? 4 : -4; });
  plan.steps.forEach((s) => { if (s.unit) score += s.unit.team !== unit.team ? 3 : -3; });
  if (score <= 0) return false;
  await this.throwGnome(unit, held);
  return true;
};
(function () {
  if (typeof Turns === "undefined" || !Turns._aiActOnce) return;
  const orig = Turns._aiActOnce;
  Turns._aiActOnce = async function (unit) {
    try {
      if (await Egg.aiAct(unit)) return true;
    } catch (er) {
      console.warn("[IA] huevo", er);
    }
    return orig.apply(this, arguments);
  };
})();

// Soltar el dedo/ratón en cualquier sitio cierra el contador de carga.
window.addEventListener("pointerup", () => { if (Egg._pressed) Egg.hideBadge(); });
window.addEventListener("pointercancel", () => { if (Egg._pressed) Egg.hideBadge(); });

// El huevo ocupa su casilla igual que un tambor.
if (typeof Drums !== "undefined" && !Drums._eggPatched) {
  Drums._eggPatched = true;
  const _drumsAt = Drums.at;
  Drums.at = function (row, col) {
    return _drumsAt.call(this, row, col) || Egg.blocks(row, col);
  };
}

if (typeof Turns !== "undefined") Turns.registerTurnStartListener(Egg);

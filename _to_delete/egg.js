/* Gnomore Gnomes — Huevo de Grulla (nivel Hurrycrane Village).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Colocar un huevo flotante en el centro del mapa y un nido junto a la
       base de cada equipo (solo en ese nivel). De momento los nidos son
       decorado: ocupan su casilla y nada más.
     - LANZAR UN GNOMO CONTRA EL HUEVO ("gnomazo"): el gnomo se estampa (+5
       puntos), el huevo gana +1 de CARGA y sale despedido 2 casillas EN LA
       DIRECCIÓN del lanzamiento (se aleja de quien lo lanza; cambiar
       EGG_PUSH_AWAY a -1 lo invierte). Mientras se apunta, un fantasma del
       huevo enseña dónde acabará (y avisa del impacto) para poder rectificar.
     - Si en su vuelo el huevo atraviesa una base ENEMIGA de quien lo lanzó
       (obelisco o tótem), impacta: temblor de cámara, destello blanco y
       tanto daño como carga lleve. Después estalla y reaparece suavemente en
       el centro al empezar el siguiente turno, descargado.
     - La carga se consulta manteniendo pulsado sobre el huevo, igual que los
       puntos de un gnomo.
     - Si hay una unidad en la trayectoria del lanzamiento, el gnomo cae en
       SUS manos. Un lanzamiento fallido cae lejos, como cualquier pase.
   Mientras sea visible, el huevo y los nidos bloquean su casilla como
   cualquier objeto de escenario (se engancha a Drums.at, que ya consultan
   todas las mecánicas). */

const EGG_DIR = "assets/niveles/hurrycrane/";
const EGG_PUSH = 2; // casillas que sale despedido por gnomazo
const EGG_PUSH_AWAY = 1; // 1 = en la dirección del lanzamiento; -1 = hacia quien lanza
const EGG_GNOME_POINTS = 5; // puntos que carga el gnomo al estamparse
const EGG_PULSE = [4, 2.8, 1.8, 1.05, 0.55]; // segundos por latido según carga
const EGG_AMP = [0.012, 0.02, 0.03, 0.045, 0.06];
const EGG_DIRS = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];

const Egg = {
  egg: null, // { id,row,col,el,spriteEl,badgeEl,badgeValueEl,charge,exploded,... }
  nests: {}, // team -> { team,row,col,el,spriteEl }
  _respawnPending: false,
  _busy: false,
  _pressed: false,

  isActive() {
    return typeof LevelAssets !== "undefined" && LevelAssets.current === "hurrycrane_village";
  },

  resetAll() {
    if (this.egg) { this.egg.el.remove(); if (this.egg.badgeEl) this.egg.badgeEl.remove(); }
    Object.values(this.nests).forEach((n) => n.el.remove());
    this.egg = null;
    this.nests = {};
    this._respawnPending = false;
    this._busy = false;
    this._pressed = false;
  },

  cheb(a, b) {
    return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
  },

  // ---------- Casillas ocupadas por el huevo y los nidos ----------
  blocks(row, col) {
    const e = this.egg;
    if (e && !e.exploded && e.row === row && e.col === col) return e;
    for (const n of Object.values(this.nests)) if (n.row === row && n.col === col) return n;
    return null;
  },

  // ---------- Reparto ----------
  spawn(size) {
    if (!this.isActive()) return;
    const teams = (typeof Teams !== "undefined" ? Teams.all : ["player", "enemy"]).filter((t) => typeof Obelisks !== "undefined" && Obelisks.byTeam(t));
    const mid = (size - 1) / 2;
    teams.forEach((t) => {
      const o = Obelisks.byTeam(t);
      const cands = [];
      for (let dr = -3; dr <= 3; dr++) for (let dc = -3; dc <= 3; dc++) {
        const d = Math.max(Math.abs(dr), Math.abs(dc));
        if (d < 2) continue;
        const row = o.row + dr, col = o.col + dc;
        if (!this._free(row, col, size, 5)) continue;
        cands.push({ row, col, score: Math.hypot(row - mid, col - mid) + (d === 3 ? 0.6 : 0) });
      }
      cands.sort((a, b) => a.score - b.score || a.row - b.row || a.col - b.col);
      if (cands.length) this._createNest(t, cands[0].row, cands[0].col);
    });
    const cands = [];
    for (let row = 2; row < size - 2; row++) for (let col = 2; col < size - 2; col++) {
      if (!this._free(row, col, size, 6)) continue;
      if (Object.values(this.nests).some((n) => this.cheb(n, { row, col }) < 4)) continue;
      if (typeof Obelisks !== "undefined" && Obelisks.list.some((o) => this.cheb(o, { row, col }) < 5)) continue;
      cands.push({ row, col, score: Math.hypot(row - mid, col - mid) });
    }
    cands.sort((a, b) => a.score - b.score || a.row - b.row || a.col - b.col);
    if (cands.length) this._createEgg(cands[0].row, cands[0].col);
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

  _blockedForEgg(row, col) {
    if (Units.unitAt(row, col)) return true;
    if (Gnome.isAt(row, col)) return true;
    if (this._tileObjectAt(row, col)) return true;
    if (Object.values(this.nests).some((n) => n.row === row && n.col === col)) return true;
    if (typeof Drums !== "undefined" && Drums.list.some((d) => d.row === row && d.col === col)) return true;
    return false;
  },

  // ¿Puede posarse aquí? Casilla firme, libre y dentro del tablero.
  _canRest(row, col) {
    const size = Units.boardSize;
    if (row < 0 || col < 0 || row >= size || col >= size) return false;
    return !this._blockedForEgg(row, col) && (typeof TerrainMap === "undefined" || TerrainMap.isWalkable(row, col));
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

  _createNest(team, row, col) {
    const el = document.createElement("div");
    el.className = "unit egg-nest";
    const spriteEl = document.createElement("img");
    spriteEl.className = "egg-nest__sprite";
    spriteEl.decoding = "async";
    spriteEl.alt = "";
    spriteEl.draggable = false;
    this._setSprite(spriteEl, "nido_vacio.png");
    el.appendChild(spriteEl);
    if (typeof Shadows !== "undefined") Shadows.attach(spriteEl);
    Units.container.appendChild(el);
    this._place(el, row, col, 4);
    const nest = { team, row, col, el, spriteEl };
    this.nests[team] = nest;
    return nest;
  },

  _createEgg(row, col) {
    const el = document.createElement("div");
    el.className = "unit egg";
    const spriteEl = document.createElement("img");
    spriteEl.className = "egg__sprite";
    spriteEl.decoding = "async";
    spriteEl.alt = "";
    spriteEl.draggable = false;
    el.appendChild(spriteEl);
    if (typeof Shadows !== "undefined") Shadows.attach(spriteEl);
    Units.container.appendChild(el);
    this._place(el, row, col, 6);

    // Mantener pulsado sobre el huevo -> muestra su carga (igual que un gnomo).
    el.addEventListener("pointerdown", (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      this.showBadge();
    });
    el.addEventListener("contextmenu", (ev) => ev.preventDefault());

    this.egg = { id: "egg-1", row, col, el, spriteEl, badgeEl: null, badgeValueEl: null, charge: 0, exploded: false, lastTeam: null };
    this._applyStage();
    this.refreshFog();
    return this.egg;
  },

  // ---------- Carga: sprite, latido y contador ----------
  _stageFile(charge) {
    return charge >= 4 ? "huevo_muy_agrietado.png" : charge >= 2 ? "huevo_agrietado.png" : "huevo.png";
  },

  _applyStage() {
    const e = this.egg;
    if (!e) return;
    const f = this._stageFile(e.charge);
    if (e._stage !== f) {
      e._stage = f;
      this._setSprite(e.spriteEl, f);
    }
    const h = Math.min(EGG_PULSE.length - 1, e.charge);
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

  // ---------- Plan del empujón ----------
  _dirFrom(holder, e) {
    const k = Math.round(Math.atan2(e.row - holder.row, e.col - holder.col) / (Math.PI / 4));
    const d = EGG_DIRS[((k % 8) + 8) % 8];
    return [d[0] * EGG_PUSH_AWAY, d[1] * EGG_PUSH_AWAY];
  },

  // Base enemiga (de `team`) en esa casilla: obelisco o tótem.
  _enemyBaseAt(row, col, team) {
    const o = typeof Obelisks !== "undefined" ? Obelisks.at(row, col) : null;
    if (o && o.team !== team) return { kind: "obelisk", ref: o, row, col };
    const v = typeof Villages !== "undefined" ? Villages.at(row, col) : null;
    if (v && v.owner !== team) return { kind: "village", ref: v, row, col };
    return null;
  },

  // Dónde acabaría el huevo si `holder` le lanzase un gnomo ahora mismo.
  _pushPlan(holder) {
    const e = this.egg;
    const d = this._dirFrom(holder, e);
    const size = Units.boardSize;
    const path = [];
    let impact = null;
    let r = e.row, c = e.col;
    for (let i = 0; i < EGG_PUSH; i++) {
      r += d[0];
      c += d[1];
      if (r < 0 || c < 0 || r >= size || c >= size) break;
      path.push({ row: r, col: c });
      const b = this._enemyBaseAt(r, c, holder.team);
      if (b) { impact = b; break; }
    }
    let rest = null;
    if (!impact) {
      for (let k = path.length; k >= 1; k--) {
        if (this._canRest(path[k - 1].row, path[k - 1].col)) { rest = path[k - 1]; break; }
      }
    }
    return { dir: d, path, impact, rest, dest: impact ? { row: impact.row, col: impact.col } : rest };
  },

  // ---------- Lanzar gnomos contra el huevo ----------
  _targetable() {
    return this._live() && !this._hidden() && !this._busy;
  },

  // Unidad en la trayectoria (cualquiera, sin contar a quien lanza).
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

  // Fantasma del huevo donde acabará + casilla de paso + aviso de impacto,
  // para que el jugador pueda rectificar antes de lanzar.
  _addPreview(holder) {
    const plan = this._pushPlan(holder);
    const impactCls = plan.impact ? " egg-preview--impact" : "";
    const mk = (row, col, build, zOffset) =>
      Units.addMarker({
        className: "pass-marker egg-preview-marker" + impactCls,
        row, col,
        zOffset: zOffset || 8,
        visibleClass: "pass-marker--visible",
        owner: "gnome",
        alwaysOnTop: true,
        buildContent: build,
      });
    plan.path.forEach((t) => {
      if (plan.dest && t.row === plan.dest.row && t.col === plan.dest.col) return;
      if (plan.impact && t.row === plan.impact.row && t.col === plan.impact.col) return;
      mk(t.row, t.col, (m) => {
        const dot = document.createElement("div");
        dot.className = "egg-preview__dot";
        m.appendChild(dot);
      }, 6);
    });
    if (plan.dest) {
      const dmg = (this.egg.charge || 0) + 1;
      mk(plan.dest.row, plan.dest.col, (m) => {
        const ring = document.createElement("div");
        ring.className = "egg-preview__ring";
        m.appendChild(ring);
        const img = document.createElement("img");
        img.className = "egg-preview__ghost";
        img.alt = "";
        img.draggable = false;
        img.src = EGG_DIR + (plan.impact ? "huevo_muy_agrietado_lowres.png" : "huevo_lowres.png");
        m.appendChild(img);
        if (plan.impact) {
          const lab = document.createElement("div");
          lab.className = "egg-preview__label";
          lab.textContent = `¡IMPACTO! -${dmg}`;
          m.appendChild(lab);
        }
      }, 9);
    } else {
      mk(this.egg.row, this.egg.col, (m) => {
        const lab = document.createElement("div");
        lab.className = "egg-preview__label egg-preview__label--blocked";
        lab.textContent = "Sin sitio";
        m.appendChild(lab);
      }, 9);
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
    const plan = this._pushPlan(holder); // se calcula ANTES de que cambie nada
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
    e.charge++;
    this._applyStage();
    this._pulseFx();
    this._flash();
    Units.spawnFloatingText({ row: e.row, col: e.col, team: "player" }, `Carga ${e.charge}`, { className: "dmg-popup popup--good" });
    await new Promise((r) => setTimeout(r, 280));

    const eggFlight = this._launch(plan, holder);
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
      if (Object.values(this.nests).some((n) => n.row === row && n.col === col)) continue;
      if (plan.path.some((t) => t.row === row && t.col === col)) continue;
      const score = this.cheb({ row, col }, holder) * 10 + Math.hypot(row - holder.row, col - holder.col);
      if (!best || score < best.score) best = { row, col, score };
    }
    return best;
  },

  // ---------- Vuelo del huevo ----------
  async _launch(plan, holder) {
    const e = this.egg;
    if (!plan.dest) {
      if (!this._hidden()) Units.spawnFloatingText({ row: e.row, col: e.col, team: "player" }, "Sin sitio", { className: "dmg-popup" });
      return;
    }
    const color = (typeof DRUM_TEAM_COLORS !== "undefined" && DRUM_TEAM_COLORS[holder.team]) || "#fff";
    const from = getTileCenter(e.row, e.col, Units.boardSize);
    const to = getTileCenter(plan.dest.row, plan.dest.col, Units.boardSize);
    if (!this._hidden()) await this._windFx(from, to, color);
    e.row = plan.dest.row;
    e.col = plan.dest.col;
    e.el.classList.add("egg--moving");
    this._place(e.el, e.row, e.col, 6);
    this._placeBadge();
    await new Promise((r) => setTimeout(r, 950));
    e.el.classList.remove("egg--moving");
    if (plan.impact) await this._impact(plan.impact, holder.team);
    if (typeof Fog !== "undefined") Fog.applyVisibility();
    this.refreshFog();
  },

  // Choque contra una base enemiga: temblor, destello blanco y daño = carga.
  async _impact(target, causer) {
    const e = this.egg;
    const dmg = e.charge;
    e.exploded = true;
    this._respawnPending = true;
    this.hideBadge();
    const vp = document.getElementById("board-viewport");
    if (vp) {
      vp.classList.remove("board-viewport--shake--big");
      void vp.offsetWidth;
      vp.classList.add("board-viewport--shake--big");
      setTimeout(() => vp.classList.remove("board-viewport--shake--big"), 420);
    }
    if (typeof Abilities !== "undefined" && Abilities._flashScreen) Abilities._flashScreen();
    if (typeof SFX !== "undefined") { try { SFX.explosion(); } catch (er) {} }
    this._shatter();
    if (typeof Banners !== "undefined") Banners.text("¡El huevo estalla!", 1, causer === "player" ? "yellow" : "red");
    if (typeof Drums !== "undefined" && Drums._applyDamage && dmg > 0) Drums._applyDamage(target, dmg, causer);
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
  _windFx(from, to, color) {
    return new Promise((resolve) => {
      const dx = to.x - from.x, dy = to.y - from.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      const nx = -dy / len, ny = dx / len;
      const n = 10;
      for (let i = 0; i < n; i++) {
        const s = document.createElement("div");
        s.className = "egg-wind";
        const off = (i - n / 2) * 15 + ((i * 37) % 7) * 2;
        s.style.left = `${from.x - (dx / len) * 150 + nx * off}px`;
        s.style.top = `${from.y - 40 - (dy / len) * 150 + ny * off}px`;
        s.style.zIndex = "9000";
        s.style.background = `linear-gradient(90deg, transparent, ${color}, #fff)`;
        Units.container.appendChild(s);
        const travel = len + 320;
        s.animate(
          [
            { transform: `rotate(${ang}deg) translateX(0px) scaleX(.4)`, opacity: 0 },
            { transform: `rotate(${ang}deg) translateX(${travel * 0.35}px) scaleX(1)`, opacity: 0.95, offset: 0.35 },
            { transform: `rotate(${ang}deg) translateX(${travel}px) scaleX(.6)`, opacity: 0 },
          ],
          { duration: 780, delay: i * 45, easing: "ease-in" }
        ).onfinish = () => s.remove();
      }
      if (this.egg && this.egg.spriteEl.animate) {
        const tilt = Math.max(-14, Math.min(14, dx / 18));
        this.egg.spriteEl.animate(
          [{ rotate: "0deg" }, { rotate: `${tilt}deg`, offset: 0.4 }, { rotate: "0deg" }],
          { duration: 1100, easing: "ease-in-out" }
        );
      }
      setTimeout(resolve, 450);
    });
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
    const size = Units.boardSize;
    const mid = (size - 1) / 2;
    let best = null;
    for (let row = 1; row < size - 1; row++) for (let col = 1; col < size - 1; col++) {
      if (!this._free(row, col, size, 5)) continue;
      if (Object.values(this.nests).some((n) => this.cheb(n, { row, col }) < 3)) continue;
      const s = Math.hypot(row - mid, col - mid);
      if (!best || s < best.s) best = { row, col, s };
    }
    if (!best) best = { row: e.row, col: e.col };
    e.row = best.row;
    e.col = best.col;
    e.charge = 0;
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
    if (e) {
      if (e._unseen && Fog.isPerceived(e.row, e.col) && !Fog.isFoggedReal(e.row, e.col)) e._unseen = false;
      const fogged = Fog.isFoggedReal(e.row, e.col) || !!e._unseen;
      e.el.classList.toggle("unit--fog-hidden", fogged);
      e.el.classList.toggle("gg-remembered", !fogged && !Fog.isPerceived(e.row, e.col));
      if (fogged && this._pressed) this.hideBadge();
    }
    Object.values(this.nests).forEach((n) => {
      const fogged = Fog.isFoggedReal(n.row, n.col);
      n.el.classList.toggle("unit--fog-hidden", fogged);
      n.el.classList.toggle("gg-remembered", !fogged && !Fog.isPerceived(n.row, n.col));
    });
  },
};

// ---------- IA rival ----------
Egg.aiAct = async function (unit) {
  if (!this._live() || this._busy || !unit.el || unit.team === "player") return false;
  if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return false;
  const held = typeof Gnome !== "undefined" ? Gnome.list.find((g) => g.heldBy === unit.id) : null;
  if (!held || held.busy) return false;
  const e = this.egg;
  const dist = this.cheb(unit, e);
  if (dist < 1 || dist > GNOME_THROW_MAX_RANGE) return false;
  if (this._interceptor(unit)) return false;
  const plan = this._pushPlan(unit);
  if (!plan.dest) return false;
  const rivals = (typeof Obelisks !== "undefined" ? Obelisks.list : []).filter((o) => o.team !== unit.team);
  if (!rivals.length) return false;
  const near = (p) => Math.min(...rivals.map((o) => this.cheb(o, p)));
  if (!plan.impact && near(plan.dest) >= near(e)) return false;
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

// El huevo y los nidos ocupan su casilla igual que un tambor.
if (typeof Drums !== "undefined" && !Drums._eggPatched) {
  Drums._eggPatched = true;
  const _drumsAt = Drums.at;
  Drums.at = function (row, col) {
    return _drumsAt.call(this, row, col) || Egg.blocks(row, col);
  };
}

if (typeof Turns !== "undefined") Turns.registerTurnStartListener(Egg);

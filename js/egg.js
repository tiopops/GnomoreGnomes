/* Gnomore Gnomes — Huevo de Grulla (nivel Hurrycrane Village).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Colocar un nido junto a la base de cada equipo y un huevo flotante
       en el centro del mapa (solo en ese nivel).
     - La BALANZA: unidades de cada equipo pegadas al huevo (1 por unidad)
       + 1 por cada golpe a un gnomo dado junto al huevo + 1 por cada
       gnomo lanzado contra él. Se dibuja encima del huevo como un
       diagrama de queso irregular (un color por equipo) con una flecha
       hacia el nido del equipo que manda.
     - Al FINAL de cada turno: el equipo con mayoría ESTRICTA atrae el
       huevo 2 casillas hacia SU nido (el viento sopla hacia ese nido);
       empate = el huevo no se mueve. Después la balanza se vacía.
     - Al llegar a un nido, el huevo se queda en él (nido lleno). De
       momento sin premio: la recompensa se ampliará más adelante.
     - Lanzar un gnomo contra el huevo ("acción desesperada"): el gnomo
       se estampa (+5 puntos), el huevo se agrieta, la balanza se inclina
       a favor de quien lo lanza (+1), el gnomo rebota, cae y huye. Si
       hay una unidad en la trayectoria, el gnomo cae en SUS manos. A los
       5 golpes el huevo se rompe y al empezar el siguiente turno
       reaparece suavemente en el centro.
   Mientras sea visible, el huevo y los nidos bloquean su casilla como
   cualquier objeto de escenario (se engancha a Drums.at, que ya
   consultan todas las mecánicas). */

const EGG_DIR = "assets/niveles/hurrycrane/";
const EGG_MAX_HITS = 5;
const EGG_PULL = 2; // casillas por turno hacia el nido de quien manda
const EGG_GNOME_POINTS = 5; // puntos que carga el gnomo al estamparse
const EGG_PULSE = [4, 2.8, 1.8, 1.05, 0.55]; // segundos por latido según golpes
const EGG_AMP = [0.012, 0.02, 0.03, 0.045, 0.06];

const Egg = {
  egg: null,
  nests: {}, // team -> { team,row,col,el,spriteEl,full }
  bonus: {}, // team -> puntos de balanza de ESTE turno
  delivered: null, // team cuyo nido recibió el huevo
  _respawnPending: false,
  _busy: false,

  isActive() {
    return typeof LevelAssets !== "undefined" && LevelAssets.current === "hurrycrane_village";
  },

  resetAll() {
    if (this.egg) { this.egg.el.remove(); this.egg.markerEl.remove(); }
    Object.values(this.nests).forEach((n) => n.el.remove());
    this.egg = null;
    this.nests = {};
    this.bonus = {};
    this.delivered = null;
    this._respawnPending = false;
    this._busy = false;
  },

  cheb(a, b) {
    return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
  },

  // ---------- Casillas ocupadas por el huevo y los nidos ----------
  blocks(row, col) {
    const e = this.egg;
    if (e && !e.broken && !this.delivered && e.row === row && e.col === col) return e;
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
    const nest = { team, row, col, el, spriteEl, full: false };
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

    const markerEl = document.createElement("div");
    markerEl.className = "egg-marker";
    Units.container.appendChild(markerEl);

    this.egg = { id: "egg-1", row, col, el, spriteEl, markerEl, hits: 0, broken: false, _key: null };
    this._applyStage();
    this._placeMarker();
    this.refreshFog();
    return this.egg;
  },

  _stageFile(hits) {
    return hits >= 4 ? "huevo_muy_agrietado.png" : hits >= 2 ? "huevo_agrietado.png" : "huevo.png";
  },

  // Sprite según los golpes + latido cada vez más rápido.
  _applyStage() {
    const e = this.egg;
    if (!e) return;
    const h = Math.min(EGG_MAX_HITS - 1, e.hits);
    if (e._stage !== this._stageFile(h)) {
      e._stage = this._stageFile(h);
      this._setSprite(e.spriteEl, e._stage);
    }
    e.spriteEl.style.setProperty("--egg-pulse", `${EGG_PULSE[h]}s`);
    e.spriteEl.style.setProperty("--egg-amp", String(EGG_AMP[h]));
  },

  _placeMarker() {
    const e = this.egg;
    if (!e) return;
    const { x, y } = getTileCenter(e.row, e.col, Units.boardSize);
    e.markerEl.style.left = `${x}px`;
    e.markerEl.style.top = `${y - 262}px`;
    e.markerEl.style.zIndex = String((e.row + e.col) * 10 + 45);
  },

  // ---------- Balanza ----------
  weights() {
    const e = this.egg;
    const w = {};
    if (!e) return w;
    Units.list.forEach((u) => {
      if (this.cheb(u, e) <= 1) w[u.team] = (w[u.team] || 0) + 1;
    });
    Object.keys(this.bonus).forEach((t) => { if (this.bonus[t] > 0) w[t] = (w[t] || 0) + this.bonus[t]; });
    return w;
  },

  // Equipo con mayoría ESTRICTA (o null).
  leader(w) {
    let best = null, bestN = 0, tie = false;
    Object.keys(w).forEach((t) => {
      if (w[t] > bestN) { best = t; bestN = w[t]; tie = false; }
      else if (w[t] === bestN) tie = true;
    });
    return tie ? null : best;
  },

  _live() {
    return this.isActive() && this.egg && !this.egg.broken && !this.delivered;
  },

  _hidden() {
    const e = this.egg;
    if (!e) return true;
    return typeof Fog !== "undefined" && (Fog.isFoggedReal(e.row, e.col) || !!e._unseen);
  },

  // Llamado desde Gnome.hit: golpe de una unidad pegada al huevo.
  onGnomeHit(unit) {
    if (!this._live() || this.cheb(unit, this.egg) > 1) return;
    this.bonus[unit.team] = (this.bonus[unit.team] || 0) + 1;
    this._pulseFx();
    this.refreshMarker();
    if (!this._hidden() && typeof Units !== "undefined") Units.spawnFloatingText(unit, "¡+1 balanza!", { className: "dmg-popup popup--good" });
  },

  // ---------- Fin / inicio de turno ----------
  async onTurnEnd(team) {
    if (!this._live() || this._busy) { this.bonus = {}; return; }
    this._busy = true;
    try { await this._resolveTurnEnd(); } finally { this._busy = false; }
  },

  onTurnStart() {
    if (this._respawnPending) this._respawn();
  },

  async _resolveTurnEnd() {
    const e = this.egg;
    const w = this.weights();
    const lead = this.leader(w);
    const nest = lead ? this.nests[lead] : null;
    this.bonus = {};
    if (!lead || !nest) { this.refreshMarker(); return; }
    const path = this._pullPath(nest);
    if (!path.length) {
      this.refreshMarker();
      if (!this._hidden()) Units.spawnFloatingText({ row: e.row, col: e.col, team: "player" }, "Bloqueado", { className: "dmg-popup" });
      return;
    }
    const from = getTileCenter(e.row, e.col, Units.boardSize);
    const last = path[path.length - 1];
    const to = getTileCenter(last.row, last.col, Units.boardSize);
    e.markerEl.classList.remove("egg-marker--visible");
    if (!this._hidden()) await this._windFx(from, to, DRUM_TEAM_COLORS[lead] || "#fff");
    e.row = last.row;
    e.col = last.col;
    e.el.classList.add("egg--moving");
    this._place(e.el, e.row, e.col, 6);
    await new Promise((r) => setTimeout(r, 950));
    e.el.classList.remove("egg--moving");
    this._placeMarker();
    if (last.row === nest.row && last.col === nest.col) await this._deliver(nest);
    if (typeof Fog !== "undefined") Fog.applyVisibility();
    this.refreshFog();
  },

  // Hasta EGG_PULL pasos hacia el nido. El huevo FLOTA: sobrevuela unidades,
  // agua y objetos, pero debe posarse en una casilla firme y libre (si la
  // de destino no lo es, busca una vecina igual de cerca o retrocede).
  _pullPath(nest) {
    const e = this.egg;
    const size = Units.boardSize;
    const ideal = [];
    let cur = { row: e.row, col: e.col };
    for (let i = 0; i < EGG_PULL; i++) {
      const next = this._nextStep(cur, nest, size);
      if (!next) break;
      ideal.push(next);
      cur = next;
      if (next.row === nest.row && next.col === nest.col) break;
    }
    const dist = (a) => Math.max(Math.abs(a.row - nest.row), Math.abs(a.col - nest.col));
    for (let k = ideal.length; k >= 1; k--) {
      const c = ideal[k - 1];
      if (this._canRest(c.row, c.col, nest)) return ideal.slice(0, k);
      let alt = null;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const t = { row: c.row + dr, col: c.col + dc };
        if (!this._canRest(t.row, t.col, nest)) continue;
        if (dist(t) > dist(c) || dist(t) >= dist({ row: e.row, col: e.col })) continue; // siempre acercarse al nido
        const sc = dist(t) * 10 + Math.hypot(t.row - nest.row, t.col - nest.col);
        if (!alt || sc < alt.sc) alt = { row: t.row, col: t.col, sc };
      }
      if (alt) return ideal.slice(0, k - 1).concat([{ row: alt.row, col: alt.col }]);
    }
    return [];
  },

  _canRest(row, col, nest) {
    const size = Units.boardSize;
    if (row < 0 || col < 0 || row >= size || col >= size) return false;
    if (row === nest.row && col === nest.col) return true;
    return !this._blockedForEgg(row, col) && (typeof TerrainMap === "undefined" || TerrainMap.isWalkable(row, col));
  },

  // Paso ideal hacia el nido en línea recta (sin mirar obstáculos: vuela).
  _nextStep(cur, nest, size) {
    const dr = Math.sign(nest.row - cur.row), dc = Math.sign(nest.col - cur.col);
    if (!dr && !dc) return null;
    return { row: cur.row + dr, col: cur.col + dc };
  },

  _blockedForEgg(row, col) {
    if (Units.unitAt(row, col)) return true;
    if (Gnome.isAt(row, col)) return true;
    if (this._tileObjectAt(row, col)) return true;
    if (Object.values(this.nests).some((n) => n.row === row && n.col === col)) return true;
    if (typeof Drums !== "undefined" && Drums.list.some((d) => d.row === row && d.col === col)) return true;
    return false;
  },

  async _deliver(nest) {
    const e = this.egg;
    this.delivered = nest.team;
    nest.full = true;
    this._setSprite(nest.spriteEl, "nido_lleno.png");
    e.el.style.opacity = "0";
    e.markerEl.classList.remove("egg-marker--visible");
    nest.spriteEl.animate(
      [{ transform: "scale(1,1)" }, { transform: "scale(1.12,0.9)", offset: 0.25 }, { transform: "scale(0.96,1.06)", offset: 0.55 }, { transform: "scale(1,1)" }],
      { duration: 700, easing: "ease-out" }
    );
    if (typeof SFX !== "undefined") { try { SFX.glory(); } catch (er) {} }
    if (typeof Banners !== "undefined") {
      const mine = nest.team === "player";
      await Banners.text(mine ? "¡El huevo llega a tu nido!" : "¡El huevo llega al nido rival!", 1, mine ? "yellow" : "red").ended;
    }
  },

  // ---------- Efectos ----------
  _windFx(from, to, color) {
    return new Promise((resolve) => {
      const dx = to.x - from.x, dy = to.y - from.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      const ang = Math.atan2(dy, dx) * 180 / Math.PI;
      const nx = -dy / len, ny = dx / len;
      const n = 10;
      for (let i = 0; i < n; i++) {
        const s = document.createElement("div");
        s.className = "egg-wind";
        const off = (i - n / 2) * 15 + ((i * 37) % 7) * 2;
        const x0 = from.x - (dx / len) * 150 + nx * off, y0 = from.y - 40 - (dy / len) * 150 + ny * off;
        s.style.left = `${x0}px`;
        s.style.top = `${y0}px`;
        s.style.zIndex = "9000";
        s.style.background = `linear-gradient(90deg, transparent, ${color}, #fff)`;
        Units.container.appendChild(s);
        const travel = len + 320;
        const a = s.animate(
          [
            { transform: `rotate(${ang}deg) translateX(0px) scaleX(.4)`, opacity: 0 },
            { transform: `rotate(${ang}deg) translateX(${travel * 0.35}px) scaleX(1)`, opacity: 0.95, offset: 0.35 },
            { transform: `rotate(${ang}deg) translateX(${travel}px) scaleX(.6)`, opacity: 0 },
          ],
          { duration: 780, delay: i * 45, easing: "ease-in" }
        );
        a.onfinish = () => s.remove();
      }
      if (this.egg && this.egg.spriteEl.animate) {
        const tilt = Math.max(-14, Math.min(14, dx / 18));
        this.egg.spriteEl.animate(
          [{ rotate: "0deg" }, { rotate: `${tilt}deg`, offset: 0.4 }, { rotate: "0deg" }],
          { duration: 1100, easing: "ease-in-out" }
        );
      }
      setTimeout(resolve, 650);
    });
  },

  _pulseFx() {
    const e = this.egg;
    if (!e || !e.spriteEl.animate) return;
    e.spriteEl.animate(
      [{ scale: "1 1" }, { scale: "1.06 0.93", offset: 0.2 }, { scale: "0.97 1.05", offset: 0.5 }, { scale: "1 1" }],
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

  // ---------- Golpes de gnomo contra el huevo ----------
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
      // Pase fallido: cae lejos, como cualquier lanzamiento que falla.
      const end = gnome.findDropTile(holder, GNOME_THROW_MAX_RANGE);
      await gnome.animateThrowTo(holder.row, holder.col, end.row, end.col);
      await gnome.landAt(end);
    } else if (blocker) {
      // Alguien se interpone: el gnomo cae en sus manos.
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
      await this._hitEgg(holder, gnome);
    }

    gnome.busy = false;
    if (holder.el) Units.refreshRange(holder);
    if (gnome._refreshSelectedUnitRange) gnome._refreshSelectedUnitRange();
  },

  // El gnomo llega al huevo: golpe, grieta, rebote, caída y huida.
  async _hitEgg(holder, gnome) {
    const e = this.egg;
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
    this._crack(holder.team);
    await new Promise((r) => setTimeout(r, 300));

    const tile = this._bounceTile(e, holder, gnome);
    if (tile) {
      await gnome.animateThrowTo(e.row, e.col, tile.row, tile.col);
      await gnome.landAt(tile, { sound: () => SFX.gnomeLandSoft() });
    } else {
      const end = gnome.findDropTile(holder, GNOME_THROW_MAX_RANGE);
      await gnome.animateThrowTo(e.row, e.col, end.row, end.col);
      await gnome.landAt(end);
    }
    await gnome._fleeAwayFrom(e.row, e.col, 3);
  },

  _bounceTile(e, holder, gnome) {
    let best = null;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const row = e.row + dr, col = e.col + dc;
      if (row < 0 || col < 0 || row >= Units.boardSize || col >= Units.boardSize) continue;
      if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) continue;
      if (Units.unitAt(row, col) || Gnome._otherGnomeAt(gnome, row, col) || this._tileObjectAt(row, col)) continue;
      if (Object.values(this.nests).some((n) => n.row === row && n.col === col)) continue;
      const score = this.cheb({ row, col }, holder) * 10 + Math.hypot(row - holder.row, col - holder.col);
      if (!best || score > best.score) best = { row, col, score };
    }
    return best;
  },

  _crack(team) {
    const e = this.egg;
    e.hits++;
    this.bonus[team] = (this.bonus[team] || 0) + 1;
    this._applyStage();
    this._pulseFx();
    this._flash();
    this.refreshMarker();
    if (e.hits >= EGG_MAX_HITS) this._break();
  },

  _break() {
    const e = this.egg;
    e.broken = true;
    this._respawnPending = true;
    this.bonus = {};
    e.markerEl.classList.remove("egg-marker--visible");
    const { x, y } = getTileCenter(e.row, e.col, Units.boardSize);
    for (let i = 0; i < 12; i++) {
      const s = document.createElement("div");
      s.className = "egg-shard";
      s.style.left = `${x}px`;
      s.style.top = `${y - 60}px`;
      s.style.zIndex = String((e.row + e.col) * 10 + 22);
      Units.container.appendChild(s);
      const a = (i / 12) * Math.PI * 2 + NR() * 0.4;
      const d = 70 + NR() * 70;
      s.animate(
        [
          { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d - 50}px)) rotate(${NR() * 360}deg) scale(.6)`, opacity: 1, offset: 0.6 },
          { transform: `translate(calc(-50% + ${Math.cos(a) * d * 1.1}px), calc(-50% + ${Math.sin(a) * d + 40}px)) rotate(${NR() * 540}deg) scale(.3)`, opacity: 0 },
        ],
        { duration: 900, easing: "ease-out" }
      ).onfinish = () => s.remove();
    }
    if (e.spriteEl.animate) {
      e.spriteEl.animate(
        [{ transform: "scale(1,1)", opacity: 1 }, { transform: "scale(1.25,.8)", opacity: 1, offset: 0.25 }, { transform: "scale(.4,1.4)", opacity: 0 }],
        { duration: 520, easing: "ease-in", fill: "forwards" }
      );
    }
    if (typeof SFX !== "undefined") { try { SFX.rockHit(); } catch (er) {} }
    if (!this._hidden() && typeof Banners !== "undefined") Banners.text("¡El huevo se ha roto!", 1, "yellow");
    setTimeout(() => { if (e.broken) e.el.style.opacity = "0"; }, 540);
  },

  // Al empezar el siguiente turno: reaparece suavemente en el centro.
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
    if (!best) { best = { row: e.row, col: e.col }; }
    e.row = best.row;
    e.col = best.col;
    e.hits = 0;
    e.broken = false;
    e._stage = null;
    e.el.classList.add("egg--respawn");
    e.el.style.opacity = "0";
    if (e.spriteEl.getAnimations) e.spriteEl.getAnimations().forEach((a) => { if (!a.animationName) a.cancel(); });
    this._place(e.el, e.row, e.col, 6);
    this._placeMarker();
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
    }
    Object.values(this.nests).forEach((n) => {
      const fogged = Fog.isFoggedReal(n.row, n.col);
      n.el.classList.toggle("unit--fog-hidden", fogged);
      n.el.classList.toggle("gg-remembered", !fogged && !Fog.isPerceived(n.row, n.col));
    });
    this.refreshMarker();
  },

  // ---------- Diagrama de queso ----------
  refreshMarker() {
    const e = this.egg;
    if (!e) return;
    const w = this.weights();
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    const show = this._live() && total > 0 && !this._hidden() && !(typeof Obelisks !== "undefined" && Obelisks.gameOver);
    e.markerEl.classList.toggle("egg-marker--visible", !!show);
    if (!show) return;
    const lead = this.leader(w);
    const key = JSON.stringify([w, this.bonus, lead, e.row, e.col]);
    if (e._key === key) return;
    e._key = key;
    e.markerEl.innerHTML = this._markerSvg(w, lead);
  },

  _markerSvg(w, lead) {
    const e = this.egg;
    const cx = 70, cy = 70, rIn = 27, rOut = 54, gap = 0.07;
    const pt = (r, a) => `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
    const order = Object.keys(w).sort((a, b) => (a === lead ? -1 : b === lead ? 1 : w[b] - w[a] || (a < b ? -1 : 1)));
    const slices = [];
    order.forEach((t) => {
      const b = Math.min(this.bonus[t] || 0, w[t]);
      for (let i = 0; i < w[t]; i++) slices.push({ team: t, bonus: i >= w[t] - b });
    });
    const n = slices.length;
    let paths = "";
    slices.forEach((s, i) => {
      const a0 = -Math.PI / 2 + (i / n) * Math.PI * 2 + gap;
      const a1 = -Math.PI / 2 + ((i + 1) / n) * Math.PI * 2 - gap;
      const rO = rOut * (1 + ((i * 37) % 5) * 0.025);
      const steps = Math.max(2, Math.ceil((a1 - a0) / 0.45));
      const pts = [];
      for (let k = 0; k <= steps; k++) {
        const a = a0 + ((a1 - a0) * k) / steps;
        // borde exterior irregular: pequeña astilla en cada punto
        pts.push(pt(rO * (1 + (k % 2 ? 0.035 : 0)), a));
      }
      for (let k = steps; k >= 0; k--) {
        const a = a0 + ((a1 - a0) * k) / steps;
        pts.push(pt(rIn * (1 - (k % 2 ? 0.05 : 0)), a));
      }
      const d = "M" + pts.join(" L") + " Z";
      const col = (typeof DRUM_TEAM_COLORS !== "undefined" && DRUM_TEAM_COLORS[s.team]) || "#bbb";
      paths += `<path class="egg-slice${s.bonus ? " egg-slice--bonus" : ""}" d="${d}" fill="${col}"/>`;
    });
    const plate = Array.from({ length: 14 }, (_, k) => {
      const a = (k / 14) * Math.PI * 2;
      return pt(62 + ((k * 53) % 4) * 1.6, a);
    }).join(" ");
    // Flecha de viento hacia el nido de quien manda.
    let center = `<text class="egg-count" x="70" y="79" text-anchor="middle">=</text>`;
    const nest = lead ? this.nests[lead] : null;
    if (nest) {
      const a = getTileCenter(e.row, e.col, Units.boardSize), b = getTileCenter(nest.row, nest.col, Units.boardSize);
      const deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 90;
      const col = (typeof DRUM_TEAM_COLORS !== "undefined" && DRUM_TEAM_COLORS[lead]) || "#fff";
      center = `<g transform="rotate(${deg.toFixed(1)} 70 70)"><path class="egg-arrow" fill="${col}" d="M70 50 L83 68 L74 68 L74 90 L66 90 L66 68 L57 68 Z"/></g>`;
    }
    return (
      `<svg viewBox="0 0 140 140" width="112" height="112" xmlns="http://www.w3.org/2000/svg">` +
      `<polygon class="egg-plate" points="${plate}"/>` + paths + center + `</svg>`
    );
  },
};

// El huevo y los nidos ocupan su casilla igual que un tambor: se engancha a
// Drums.at, que ya consultan todas las mecánicas al buscar casillas libres.
if (typeof Drums !== "undefined" && !Drums._eggPatched) {
  Drums._eggPatched = true;
  const _drumsAt = Drums.at;
  Drums.at = function (row, col) {
    return _drumsAt.call(this, row, col) || Egg.blocks(row, col);
  };
}

if (typeof Turns !== "undefined") Turns.registerTurnStartListener(Egg);

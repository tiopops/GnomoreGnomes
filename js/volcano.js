/* Gnomore Gnomes — Volcán (nivel Colinas Rock'n Troll).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Colocar UN volcán en el centro del mapa (solo en ese nivel); bloquea su
       casilla igual que el Altar (Altar.at/isNear lo consultan).
     - Su carga compartida de 0 a 20 puntos. SOLO se alimenta sacrificando
       gnomos (suman sus puntos, estampados o lanzados) o lanzándole piedras
       (de 1 en 1). Apagado (<10) -> encendido (>=10) -> erupción (20).
     - Erupción: las acciones se pausan un instante y del volcán sale un
       gnomo en llamas por cada unidad rival, corriendo hacia ella (más
       deprisa cuanto más lejos esté), saltando y agarrándose a ella.
     - Gnomo agarrado: palpita ardiendo sobre la unidad. Una piedra lanzada a
       la unidad propia lo hace desaparecer (sin lava). Si no, al acabar el
       turno de su dueño explota: -1 de vida a la unidad y lava en todas las
       casillas adyacentes posibles. Si la unidad muere con el gnomo
       agarrado, también suelta la lava.
     - Lava: pisarla quita 1 de vida por pisada. Permanece hasta el final del
       SIGUIENTE turno del jugador al que le explotó el gnomo; una piedra
       puede apagar una casilla antes.
     - Cuando no quedan gnomos ni lava, el volcán se apaga con la barra a 0 y
       vuelve a estar disponible.
   Nada de piedras contra unidades/estructuras rivales (ver Backpack). */

const VOLCANO_ON_AT = 10;
const VOLCANO_MAX = 20;
const VOLCANO_DIR = "assets/niveles/rockntroll/";
const VOLCANO_SPRITES = {
  apagado: VOLCANO_DIR + "volcan_apagado.png",
  encendido: VOLCANO_DIR + "volcan_encendido.png",
  erupcion: VOLCANO_DIR + "volcan_erupcion.png",
};
const VOLCANO_FIRE_SPRITES = {
  corre: VOLCANO_DIR + "gnomo_fuego_corre.png",
  agarrado: VOLCANO_DIR + "gnomo_fuego_agarrado.png",
};
const VOLCANO_LAVA_SPRITES = [VOLCANO_DIR + "lava_1.png", VOLCANO_DIR + "lava_2.png"];
const VOLCANO_TEAM_COLORS = { player: "#3aa0ff", enemy: "#ff5148", enemy2: "#52d66a", enemy3: "#c067ff" };
const VOLCANO_INTERACT_RANGE = 1;
const VOLCANO_EXTINGUISH_RANGE = 3; // distancia máxima (a alguna unidad propia) para apagar una casilla

const Volcano = {
  list: [], // como mucho uno
  lava: [], // { row, col, el }
  eruption: null, // { owner } mientras haya gnomos en llamas o lava en el suelo
  burners: [], // gnomos en llamas agarrados: { unit, el }
  _busy: 0, // >0 mientras se anima una erupción/explosión (no se apaga a medias)

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
    this.burners.forEach((b) => b.el && b.el.remove());
    this.burners = [];
    this.eruption = null;
    this._busy = 0;
    this._lock(false);
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
    // Prefiere el punto más cercano al centro cuyo cuadrado de 5x5 (el volcán
    // + 2 anillos) sea todo hierba y sin Obeliscos ni Altar; si no hay ninguno,
    // el sitio libre más cercano de siempre.
    const clear = (r, cc) => {
      for (let dr = -2; dr <= 2; dr++)
        for (let dc = -2; dc <= 2; dc++) {
          const rr = r + dr, c2 = cc + dc;
          if (rr < 0 || c2 < 0 || rr >= size || c2 >= size) return false;
          if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(rr, c2)) return false;
          if (typeof Obelisks !== "undefined" && Obelisks.at(rr, c2)) return false;
          if (typeof Altar !== "undefined" && Altar.at(rr, c2)) return false;
        }
      return true;
    };
    let spot = null;
    for (let radius = 0; radius <= size && !spot; radius++) {
      for (let dr = -radius; dr <= radius && !spot; dr++) {
        for (let dc = -radius; dc <= radius && !spot; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
          if (clear(c.row + dr, c.col + dc)) spot = { row: c.row + dr, col: c.col + dc };
        }
      }
    }
    if (!spot) spot = typeof Altar !== "undefined" ? Altar._findFreeTileNear(c.row, c.col, size, true) : c;
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
    this._initMouseTracking();
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
    // (Sin contador de gnomos en llamas sobre el volcán: se quitó a petición.)
    v.badgeEl.style.display = "none";
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
    this.eruption = { owner: team };
    this._busy++;
    this._lock(true);
    this._refreshSprite(v);
    this._refreshBar(v);
    if (typeof SFX !== "undefined") { SFX.volcanoRumble && SFX.volcanoRumble(); SFX.explosion && SFX.explosion(); }
    if (typeof Villages !== "undefined" && Villages._flashScreen) Villages._flashScreen();
    const vp = document.getElementById("board-viewport");
    if (vp) {
      vp.classList.remove("board-viewport--shake--big");
      void vp.offsetWidth;
      vp.classList.add("board-viewport--shake--big");
      setTimeout(() => vp.classList.remove("board-viewport--shake--big"), 420);
    }
    if (typeof Banners !== "undefined") Banners.text("¡El volcán entra en erupción!", 0);
    this._embers(v);
    await new Promise((r) => setTimeout(r, 1100)); // pausa de todas las acciones
    const rivals = this._enemyTeams();
    const victims = Units.list.filter((u) => rivals.includes(u.team) && u.el && !u._fireGnome);
    if (typeof SFX !== "undefined" && SFX.fireScream) SFX.fireScream();
    await Promise.all(victims.map((u, i) => new Promise((r) => setTimeout(r, i * 160)).then(() => this._launch(v, u))));
    this._lock(false);
    this._busy--;
    this._refreshBar(v);
    this._checkReset();
  },

  // Bloquea los clics mientras dura la erupción (las acciones de todos se pausan).
  _lock(on) {
    let el = document.getElementById("volcano-lock");
    if (!on) { if (el) el.remove(); return; }
    if (el) return;
    el = document.createElement("div");
    el.id = "volcano-lock";
    el.className = "volcano-lock";
    document.body.appendChild(el);
  },

  _embers(v) {
    const base = getTileCenter(v.row, v.col, Units.boardSize);
    for (let i = 0; i < 26; i++) {
      const e = document.createElement("div");
      e.className = "volcano-ember";
      e.style.left = `${base.x + (NR() - 0.5) * 120}px`;
      e.style.top = `${base.y - 110}px`;
      e.style.zIndex = "8000";
      Units.container.appendChild(e);
      const dx = (NR() - 0.5) * 320, up = 160 + NR() * 220;
      e.animate(
        [{ transform: "translate(0,0) scale(1)", opacity: 1 }, { transform: `translate(${dx * 0.6}px,${-up}px) scale(1)`, opacity: 1, offset: 0.45 }, { transform: `translate(${dx}px,${-up + 260}px) scale(.4)`, opacity: 0 }],
        { duration: 1100 + NR() * 800, easing: "ease-out", delay: NR() * 300 }
      ).onfinish = () => e.remove();
    }
  },

  _enemyTeams() {
    const owner = this.eruption && this.eruption.owner;
    return Teams.all.filter((t) => t !== owner && (typeof Obelisks === "undefined" || Obelisks.byTeam(t)));
  },

  // ---------- Gnomos en llamas ----------
  // Sale del cráter, salta al suelo, corre en línea recta hasta la unidad
  // (más deprisa cuanto más lejos esté) y se le agarra.
  async _launch(v, unit) {
    if (!unit.el || unit._fireGnome) return;
    const entry = { unit, el: null };
    unit._fireGnome = entry;
    this.burners.push(entry);
    this._refreshBar(v);
    const hidden = typeof Fog !== "undefined" && Fog.isFogged(unit.row, unit.col);
    await this._runTo(v, unit, hidden); // en la niebla corre y se pierde entre la bruma
    if (!unit.el || unit._fireGnome !== entry) return;
    this._attach(entry);
  },

  _runTo(v, unit, hidden) {
    return new Promise((resolve) => {
      const size = Units.boardSize;
      const vc = getTileCenter(v.row, v.col, size);
      const uc = getTileCenter(unit.row, unit.col, size);
      const tiles = Math.max(Math.abs(v.row - unit.row), Math.abs(v.col - unit.col));
      const el = document.createElement("div");
      el.className = "fire-runner";
      const img = document.createElement("img");
      img.src = VOLCANO_FIRE_SPRITES.corre;
      img.draggable = false;
      img.alt = "";
      el.appendChild(img);
      el.style.zIndex = "8000";
      Units.container.appendChild(el);
      const dir = uc.x >= vc.x ? 1 : -1; // el sprite mira a la derecha
      const put = (x, y, sx, sy, rot) => {
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.transform = `translate(-50%,-90%) scale(${dir * sx},${sy}) rotate(${rot * dir}deg)`;
      };
      // 1) salto desde el cráter hasta el suelo, junto al volcán
      const sx0 = vc.x, sy0 = vc.y - 120;
      const ang = Math.atan2(uc.y - vc.y, uc.x - vc.x);
      const ex = vc.x + Math.cos(ang) * 130, ey = vc.y + 40 + Math.sin(ang) * 40;
      // 2) carrera: la velocidad crece con la distancia (nunca se hace eterna)
      const runDist = Math.hypot(uc.x - dir * 50 - ex, uc.y - ey);
      const speed = 480 + 70 * tiles; // px/s
      const runMs = Math.max(380, Math.min(1500, (runDist / speed) * 1000));
      const t0 = performance.now();
      const JUMP = 520, JUMP2 = 360;
      const ax = uc.x, ay = uc.y - 62;
      if (typeof SFX !== "undefined" && SFX.fireWhoosh) SFX.fireWhoosh();
      let lastStep = -1;
      const frame = (now) => {
        const t = now - t0;
        if (t < JUMP) {
          const k = t / JUMP;
          put(sx0 + (ex - sx0) * k, sy0 + (ey - sy0) * k - Math.sin(k * Math.PI) * 110, 1, 1, k * 25);
        } else if (t < JUMP + runMs) {
          const k = (t - JUMP) / runMs;
          const x = ex + (uc.x - dir * 50 - ex) * k, y = ey + (uc.y - ey) * k;
          const ph = (t - JUMP) / 62; // zancada rápida
          if (hidden) el.style.opacity = String(Math.max(0, 1 - k * 1.15)); // se desvanece en la niebla
          put(x, y - Math.abs(Math.sin(ph)) * 24, 1 + 0.07 * Math.sin(ph * 2), 1 - 0.07 * Math.sin(ph * 2), 9 * Math.sin(ph));
          const st = Math.floor(ph / Math.PI);
          if (st !== lastStep) { lastStep = st; if (st % 2 === 0 && typeof SFX !== "undefined" && SFX.fireStep) SFX.fireStep(); }
        } else if (hidden) {
          el.remove();
          return resolve();
        } else if (t < JUMP + runMs + JUMP2) {
          const k = (t - JUMP - runMs) / JUMP2;
          const x0 = uc.x - dir * 50, y0 = uc.y;
          put(x0 + (ax - x0) * k, y0 + (ay - y0) * k - Math.sin(k * Math.PI) * 80, 1, 1, -k * 25);
        } else {
          el.remove();
          return resolve();
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  },

  // Gnomo ya agarrado: un hijo de la propia unidad (la sigue al moverse).
  _attach(entry) {
    const unit = entry.unit;
    const el = document.createElement("div");
    el.className = "fire-gnome";
    const img = document.createElement("img");
    img.draggable = false;
    img.alt = "";
    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(img, VOLCANO_FIRE_SPRITES.agarrado);
    else img.src = VOLCANO_FIRE_SPRITES.agarrado;
    el.appendChild(img);
    unit.el.appendChild(el);
    entry.el = el;
    if (typeof SFX !== "undefined") { SFX.fireGrab && SFX.fireGrab(); }
    const v = this.current();
    if (v) this._refreshBar(v);
  },

  _detach(unit) {
    const entry = unit._fireGnome;
    if (!entry) return null;
    unit._fireGnome = null;
    this.burners = this.burners.filter((b) => b !== entry);
    return entry;
  },

  // Una piedra contra tu propia unidad: el gnomo desaparece sin dejar lava.
  removeGnome(unit) {
    const entry = this._detach(unit);
    if (!entry) return;
    const c = getTileCenter(unit.row, unit.col, Units.boardSize);
    this._steam(c.x, c.y - 40, unit.row, unit.col, 4);
    if (typeof SFX !== "undefined" && SFX.splash) SFX.splash();
    if (entry.el) entry.el.animate([{ opacity: 1, transform: "translate(-50%,-50%) scale(1)" }, { opacity: 0, transform: "translate(-50%,-50%) scale(.2)" }], { duration: 300 }).onfinish = () => entry.el.remove();
    const v = this.current();
    if (v) this._refreshBar(v);
    this._checkReset();
  },

  // Fin del turno de `team`: caduca SU lava anterior y explotan sus gnomos.
  async onTurnEnd(team) {
    if (!this.eruption) return;
    this._busy++;
    // 1) la lava que le dejó una explosión anterior desaparece ahora
    const old = this.lava.filter((l) => l.team === team);
    const held = old.filter((l) => l.skip > 0); // lava nacida durante su propio turno: aguanta un turno más
    held.forEach((l) => l.skip--);
    const gone = old.filter((l) => !held.includes(l));
    if (gone.length) {
      this.lava = this.lava.filter((l) => !gone.includes(l));
      gone.forEach((l) => l.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, easing: "ease-in" }).onfinish = () => l.el.remove());
    }
    // 2) explotan los gnomos agarrados a sus unidades
    for (const b of this.burners.filter((x) => x.unit.team === team)) {
      if (!b.unit.el || b.unit._fireGnome !== b) continue;
      await this._explode(b);
    }
    this._busy--;
    this._checkReset();
  },

  async _explode(b) {
    const unit = b.unit;
    this._detach(unit);
    const row = unit.row, col = unit.col, team = unit.team;
    const c = getTileCenter(row, col, Units.boardSize);
    if (typeof SFX !== "undefined" && SFX.fireBoom) SFX.fireBoom();
    if (b.el) b.el.remove();
    const fl = document.createElement("div");
    fl.className = "volcano-flash";
    fl.style.left = `${c.x}px`;
    fl.style.top = `${c.y - 50}px`;
    fl.style.zIndex = String((row + col) * 10 + 15);
    Units.container.appendChild(fl);
    fl.animate([{ transform: "translate(-50%,-50%) scale(.3)", opacity: 1 }, { transform: "translate(-50%,-50%) scale(1.6)", opacity: 0 }], { duration: 480, easing: "ease-out" }).onfinish = () => fl.remove();
    this._lavaAround(row, col, team, 0);
    await new Promise((r) => setTimeout(r, 260));
    // la explosión del gnomo quita 1 de vida
    if (unit.el) this._burn({ kind: "unit", ref: unit, row, col }, (this.eruption || {}).owner);
    await new Promise((r) => setTimeout(r, 520));
    const v = this.current();
    if (v) this._refreshBar(v);
  },

  // Lava en TODAS las casillas adyacentes posibles de (row, col).
  _lavaAround(row, col, team, skip) {
    let n = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = row + dr, c = col + dc;
      if (!this._lavaTileOk(r, c)) continue;
      setTimeout(() => this._placeLava(r, c, false, team, skip), n++ * 45);
    }
  },

  // Una unidad con gnomo agarrado muere: también suelta la lava.
  onUnitDying(unit) {
    const b = this._detach(unit);
    if (!b || !this.eruption) return;
    if (b.el) b.el.remove();
    const mine = typeof Turns !== "undefined" && Turns.activeTeam === unit.team;
    this._lavaAround(unit.row, unit.col, unit.team, mine ? 1 : 0);
    const v = this.current();
    if (v) this._refreshBar(v);
    setTimeout(() => this._checkReset(), 600);
  },

  // Sin gnomos ni lava (y sin animaciones en curso): el volcán se apaga y
  // vuelve a estar disponible con la barra reiniciada.
  _checkReset() {
    if (!this.eruption || this._busy > 0 || this.burners.length || this.lava.length) return;
    this._end();
  },

  _steam(x, y, row, col, n) {
    for (let i = 0; i < n; i++) {
      const p = document.createElement("div");
      p.className = "lava-steam";
      p.style.left = `${x + (NR() - 0.5) * 70}px`;
      p.style.top = `${y}px`;
      p.style.zIndex = String((row + col) * 10 + 14);
      Units.container.appendChild(p);
      p.animate(
        [{ transform: "translate(-50%,-30%) scale(.4)", opacity: 0.8 }, { transform: `translate(-50%,${-120 - NR() * 60}%) scale(1.5)`, opacity: 0 }],
        { duration: 800 + NR() * 300, easing: "ease-out", delay: i * 60 }
      ).onfinish = () => p.remove();
    }
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

  _placeLava(row, col, force, team, skip) {
    if (!this.eruption) return;
    if (this.lavaAt(row, col)) return;
    if (!force && !this._lavaTileOk(row, col)) return;
    const el = document.createElement("div");
    el.className = "unit lava-puddle";
    const img = document.createElement("img");
    img.className = "lava-puddle__sprite";
    img.draggable = false;
    img.alt = "";
    const src = VOLCANO_LAVA_SPRITES[Math.floor(NR() * VOLCANO_LAVA_SPRITES.length)];
    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(img, src);
    else img.src = src;
    const flip = NR() < 0.5 ? -1 : 1;
    const sc = 0.92 + NR() * 0.22;
    img.style.setProperty("--lv-s", `${flip * sc} ${sc}`);
    el.appendChild(img);
    const { x, y } = getTileCenter(row, col, Units.boardSize);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.zIndex = String((row + col) * 10 + 1);
    Units.container.appendChild(el);
    const l = { row, col, el, team: team || null, skip: skip || 0 };
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

  // Inicio de turno de `team`: quien empieza sobre lava se quema (1 por turno).
  async onTurnStart(team) {
    if (!this.eruption) return;
    const burning = Units.list.filter((u) => u.team === team && this.lavaAt(u.row, u.col));
    for (const u of burning) {
      if (!this.eruption) break;
      this._burn({ kind: "unit", ref: u, row: u.row, col: u.col }, this.eruption.owner);
      await new Promise((r) => setTimeout(r, 300));
    }
  },

  // El volcán vuelve a estar disponible (sin gnomos ni lava): barra a 0.
  _end() {
    const v = this.current();
    this.eruption = null;
    if (v) {
      v.points = 0;
      v.lastTeam = null;
      this._refreshBar(v);
      this._refreshSprite(v);
      this._pulse(v);
    }
    if (typeof Banners !== "undefined") Banners.text("El volcán se apaga: vuelve a estar disponible", 0);
  },

  // ---------- Apagar lava con una piedra ----------
  extinguish(l) {
    if (!l || !this.lava.includes(l)) return;
    this.lava = this.lava.filter((x) => x !== l);
    const c = getTileCenter(l.row, l.col, Units.boardSize);
    if (typeof SFX !== "undefined" && SFX.splash) SFX.splash();
    this._steam(c.x, c.y, l.row, l.col, 5);
    l.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350 }).onfinish = () => l.el.remove();
    this._checkReset();
  },

  // ---------- Objetivos para el lanzamiento de rocas (Backpack) ----------
  rockTargets(team) {
    const out = [];
    const visible = (e) => e.el && !e.el.classList.contains("unit--fog-hidden") && !(typeof Fog !== "undefined" && Fog.isFogged(e.row, e.col));
    const v = this.current();
    if (v && this._accepts(v) && visible(v)) out.push({ kind: "volcano", ref: v, row: v.row, col: v.col, el: v.el });
    if (this.eruption) {
      // Tus unidades con un gnomo en llamas agarrado: la piedra lo apaga.
      Units.list.filter((u) => u.team === team && u._fireGnome && visible(u)).forEach((u) => out.push({ kind: "firegnome", ref: u, row: u.row, col: u.col, el: u.el }));
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
    if (typeof BloodSplat !== "undefined") BloodSplat.spawnAt(v.row, v.col, { scale: 1.7 }); // bajo el volcán, grande
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

  // La CPU apaga con una piedra el gnomo en llamas de una de sus unidades
  // (sin gastar acción): si la unidad corre peligro de morir, o le sobran piedras.
  async aiDouseGnome(team) {
    if (!this.eruption || !this._aiCanThrow(team)) return false;
    const mine = Units.list.filter((u) => u.team === team && u._fireGnome && u.el);
    if (!mine.length) return false;
    const risky = mine.filter((u) => u.hp <= 2).sort((a, b) => a.hp - b.hp)[0];
    const pick = risky || (this._aiRocks(team) >= 2 ? mine.sort((a, b) => a.hp - b.hp)[0] : null);
    if (!pick) return false;
    this._aiSpendRock(team);
    if (typeof SFX !== "undefined" && SFX.rockThrow) SFX.rockThrow(0.4);
    await new Promise((r) => setTimeout(r, 400));
    if (typeof SFX !== "undefined" && SFX.rockHit) SFX.rockHit();
    this.removeGnome(pick);
    await new Promise((r) => setTimeout(r, 300));
    return true;
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
  // ---------- Transparencia cuando alguien queda detrás (mismo sistema que
  // Altar/Obelisks.refreshOcclusion) — pedido explícito: "el volcán debe
  // tener el sistema de transparencias si alguien se coloca en un sitio que
  // lo tapa". Como el sprite es enorme, en vez de 4 losetas fijas cuenta
  // cualquier unidad visible o marcador de zona más atrasado (fila+col
  // menor) cuyo recuadro se solape con el del volcán. Con el ratón/dedo
  // sobre el volcán o sobre quien está detrás, se vuelve semitransparente
  // y deja pasar los clics. ----------
  _lastMouseX: null,
  _lastMouseY: null,
  _mouseTrackingReady: false,
  _initMouseTracking() {
    if (this._mouseTrackingReady) return;
    this._mouseTrackingReady = true;
    window.addEventListener("mousemove", (e) => {
      this._lastMouseX = e.clientX;
      this._lastMouseY = e.clientY;
      this.refreshOcclusion(e.clientX, e.clientY);
    });
    const touch = (e) => {
      const t = e.touches && e.touches[0];
      if (!t) return;
      this._lastMouseX = t.clientX;
      this._lastMouseY = t.clientY;
      this.refreshOcclusion(t.clientX, t.clientY);
    };
    window.addEventListener("touchstart", touch, { passive: true });
    window.addEventListener("touchmove", touch, { passive: true });
  },

  _behindElsFor(v, rect) {
    const els = [];
    const depth = v.row + v.col;
    const overlaps = (r) => r.right > rect.left && r.left < rect.right && r.bottom > rect.top && r.top < rect.bottom;
    Units.list.forEach((unit) => {
      if (!unit.el || unit.el.classList.contains("unit--fog-hidden")) return;
      if (unit.row + unit.col >= depth) return;
      if (overlaps(unit.el.getBoundingClientRect())) els.push(unit.el);
    });
    (Units.markerEls || []).forEach((m) => {
      if (!m || !m.isConnected) return;
      const r = Number(m.dataset.row), c = Number(m.dataset.col);
      if (Number.isNaN(r) || Number.isNaN(c) || r + c >= depth) return;
      if (overlaps(m.getBoundingClientRect())) els.push(m);
    });
    return els;
  },

  refreshOcclusion(mouseX, mouseY) {
    if (typeof Units === "undefined") return;
    this._initMouseTracking();
    const mx = typeof mouseX === "number" ? mouseX : this._lastMouseX;
    const my = typeof mouseY === "number" ? mouseY : this._lastMouseY;
    this.list.forEach((v) => {
      if (!v.spriteEl) return;
      if (v.el.classList.contains("unit--fog-hidden") || mx === null || my === null) {
        v.el.classList.remove("volcano--occluding");
        return;
      }
      const rect = v.spriteEl.getBoundingClientRect();
      const behindEls = this._behindElsFor(v, rect);
      let occluding = false;
      if (behindEls.length) {
        const overVolcano = mx >= rect.left && mx <= rect.right && my >= rect.top && my <= rect.bottom;
        const overBehind = behindEls.some((el) => {
          const r = el.getBoundingClientRect();
          return mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom;
        });
        occluding = overVolcano || overBehind;
      }
      v.el.classList.toggle("volcano--occluding", occluding);
    });
  },

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

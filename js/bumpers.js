/* Gnomore Gnomes — Bumpers del pinball (nivel Hurrycrane Village).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Colocar los bumpers del tablero (posiciones fijas y simétricas, sin
       azar, para que los dos clientes online coincidan) y bloquear su casilla.
     - Reaccionar cuando el huevo los golpea (rebote elástico + onda en
       perspectiva + sonido que sube de tono con cada carambola).
     - El COMBO de cada vuelo del huevo (a partir del 2.º golpe seguido contra
       bumpers/tótems/obeliscos/unidades), la RULETA de cada equipo (10
       porciones, estética de los tambores) y el JACKPOT al romperse el huevo.
   Cómo rebota el huevo lo decide js/egg.js (_simulate); aquí solo se pinta. */

const BUMPER_SLICES_MAX = 10;
const GNOME_BUMP_POINTS = 5; // puntos que se carga el gnomo al rebotar en un bumper
const BUMPER_SPRITE_W = 205;
const BUMPER_SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26];

const Bumpers = {
  list: [],
  slices: { player: 0, enemy: 0 },
  combo: 0, // golpes seguidos en el vuelo actual
  _comboEl: null,
  _rouletteEl: null,
  _rouletteTimer: null,

  resetAll() {
    this.list.forEach((b) => b.el && b.el.remove());
    this.list = [];
    this.resetRoulettes();
    this.combo = 0;
    this._hideCombo();
    this.hideRoulette();
  },

  resetRoulettes() {
    this.slices = { player: 0, enemy: 0 };
  },

  at(row, col) {
    return this.list.find((b) => b.row === row && b.col === col) || null;
  },

  // Posiciones simétricas respecto al centro: 4 ortogonales a ±4 y 2 en la
  // antidiagonal a ±3 (carambolas entre ellos, los tótems y los bordes).
  spawn(size) {
    this.resetAll();
    if (typeof Egg === "undefined" || !Egg.isActive()) return;
    const mid = Math.floor((size - 1) / 2);
    // Reparto estratégico por TODO el mapa (proporcional al tamaño): anillo ortogonal,
    // diagonales y pares laterales, todo simétrico, para encadenar carambolas desde
    // cualquier zona. Separación mínima entre bumpers para que sean alcanzables.
    const k = (f) => Math.max(2, Math.round(size * f));
    const offs = [[k(0.32), 0], [0, k(0.32)], [k(0.2), k(0.2)], [k(0.38), k(0.14)], [k(0.14), k(0.38)]];
    const want = [];
    offs.forEach(([dr, dc]) => {
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sr, sc]) => {
        const r = mid + sr * dr, c = mid + sc * dc;
        if (!want.some((w) => w[0] === r && w[1] === c)) want.push([r, c]);
      });
    });
    want.forEach(([r, c]) => {
      let spot = null;
      for (let rad = 0; rad <= 2 && !spot; rad++) {
        for (let dr = -rad; dr <= rad && !spot; dr++) for (let dc = -rad; dc <= rad && !spot; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
          const rr = r + dr, cc = c + dc;
          if (rr < 1 || cc < 1 || rr >= size - 1 || cc >= size - 1) continue;
          if (this.list.some((o) => Math.max(Math.abs(o.row - rr), Math.abs(o.col - cc)) < 3)) continue;
          if (Egg._free(rr, cc, size, 3)) spot = { row: rr, col: cc };
        }
      }
      if (spot) this._create(spot.row, spot.col);
    });
  },

  _create(row, col) {
    const el = document.createElement("div");
    el.className = "unit board-item bumper";
    const img = document.createElement("img");
    img.className = "bumper__sprite";
    img.decoding = "async";
    img.alt = "";
    img.draggable = false;
    const src = "assets/niveles/hurrycrane/bumper.png";
    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(img, src);
    else img.src = src;
    img.style.animationDelay = `-${(NR() * 4).toFixed(2)}s`; // respiración desfasada por bumper
    el.appendChild(img);
    Units.container.appendChild(el);
    const { x, y } = getTileCenter(row, col, Units.boardSize);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.zIndex = String((row + col) * 10 + 5);
    const b = { id: `bumper-${this.list.length + 1}`, row, col, el, spriteEl: img };
    this.list.push(b);
    this.refreshFog();
    return b;
  },

  // Niebla de guerra: igual que el resto de objetos del escenario (oculto bajo niebla,
  // oscurecido si está explorado pero fuera de percepción).
  refreshFog() {
    if (typeof Fog === "undefined") return;
    this.list.forEach((b) => {
      const fogged = Fog.isFoggedReal(b.row, b.col);
      b.el.classList.toggle("unit--fog-hidden", fogged);
      b.el.classList.toggle("gg-remembered", !fogged && !Fog.isPerceived(b.row, b.col));
    });
    if (this._rouletteEl && this._rouletteFor && Fog.isFoggedReal(this._rouletteFor.row, this._rouletteFor.col)) this.hideRoulette();
  },

  // Sistema de transparencias del escenario (igual que tótems/obeliscos, ver
  // Villages.refreshOcclusion en js/villages.js): si hay alguien (unidad o zona
  // seleccionable) detrás y el ratón está sobre el objeto o sobre ese alguien,
  // el objeto se vuelve semitransparente. Vale para los bumpers y para el huevo.
  refreshOcclusion(mouseX, mouseY) {
    if (typeof Villages === "undefined" || !Villages._behindElsFor) return;
    const mx = typeof mouseX === "number" ? mouseX : Villages._lastMouseX;
    const my = typeof mouseY === "number" ? mouseY : Villages._lastMouseY;
    const objs = this.list.map((b) => ({ row: b.row, col: b.col, el: b.el, spriteEl: b.spriteEl }));
    if (typeof Egg !== "undefined" && Egg.egg && !Egg.egg.exploded) objs.push({ row: Egg.egg.row, col: Egg.egg.col, el: Egg.egg.el, spriteEl: Egg.egg.spriteEl });
    objs.forEach((o) => {
      if (!o.el || !o.spriteEl) return;
      if (o.el.classList.contains("unit--fog-hidden") || mx == null || my == null) {
        o.el.classList.remove("village--occluding");
        return;
      }
      const behind = Villages._behindElsFor(o).filter((el) => el !== o.el);
      let occluding = false;
      if (behind.length) {
        const r0 = o.spriteEl.getBoundingClientRect();
        const overObj = mx >= r0.left && mx <= r0.right && my >= r0.top && my <= r0.bottom;
        const overBehind = behind.some((el) => {
          const r = el.getBoundingClientRect();
          return mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom;
        });
        occluding = overObj || overBehind;
      }
      o.el.classList.toggle("village--occluding", occluding);
    });
  },

  // Los bumpers no capturan el ratón (como el resto del escenario: nada se
  // "levanta" al pasar por encima); al pulsar sobre uno se detecta por su caja.
  _onPointerDown(ev) {
    if (!this.list.length || ev.button > 0) return;
    const hit = this.list.find((b) => {
      if (b.el.classList.contains("unit--fog-hidden")) return false;
      const r = b.spriteEl.getBoundingClientRect();
      const w = r.width * 0.5, h = r.height * 0.6;
      const cx = r.left + r.width / 2, cy = r.top + r.height * 0.55;
      return Math.abs(ev.clientX - cx) <= w / 2 && Math.abs(ev.clientY - cy) <= h / 2;
    });
    if (hit) this.showRoulette(hit);
  },

  // La ruleta sale en el último bumper golpeado que siga visible (si no hay, en el indicado).
  _rouletteBumper(fallback) {
    const l = this._lastHit;
    if (l && this.list.includes(l) && !(typeof Fog !== "undefined" && Fog.isFoggedReal(l.row, l.col))) return l;
    return fallback || this.list.find((x) => !(typeof Fog !== "undefined" && Fog.isFoggedReal(x.row, x.col))) || this.list[0];
  },

  // ---------- Golpes y combo ----------
  beginFlight() {
    this.combo = 0;
    this._hideCombo();
    this.resetLit();
  },

  // ---------- Bumpers con luces y teledirigido ----------
  // Cada bumper se enciende al golpearlo en el vuelo; si se encienden todos los visibles
  // (sin niebla), +3 porciones a la ruleta del equipo (NO suman al número del combo).
  resetLit() {
    (this.lit || new Set()).forEach((b) => b.el && b.el.classList.remove("bumper--lit"));
    this.lit = new Set();
    this.setLock(null);
  },

  setLock(b) {
    if (this._lock === (b || null)) return;
    if (this._lock && this._lock.el) this._lock.el.classList.remove("bumper--lock");
    this._lock = b || null;
    if (b && b.el) b.el.classList.add("bumper--lock");
  },

  markLit(b, team) {
    if (!b || !b.el) return;
    if (!this.lit) this.lit = new Set();
    if (!(typeof Fog !== "undefined" && Fog.isFoggedReal(b.row, b.col))) this._lastHit = b;
    if (this.lit.has(b)) return;
    this.lit.add(b);
    b.el.classList.add("bumper--lit");
    if (typeof SFX !== "undefined" && SFX.bumperLit) { try { SFX.bumperLit(); } catch (er) {} }
    const vis = this.list.filter((x) => !(typeof Fog !== "undefined" && Fog.isFoggedReal(x.row, x.col)));
    if (vis.length >= 2 && vis.every((x) => this.lit.has(x))) this._boardLit(team, vis);
  },

  _boardLit(team, vis) {
    const t = team === "enemy" ? "enemy" : "player";
    this.slices[t] = Math.min(BUMPER_SLICES_MAX, this.slices[t] + 3);
    if (typeof SFX !== "undefined" && SFX.boardLit) { try { SFX.boardLit(); } catch (er) {} }
    if (typeof Egg !== "undefined" && Egg._flash) Egg._flash();
    vis.forEach((x) => this.reactAt(x, 1));
    const hidden = typeof Egg !== "undefined" && Egg._hidden && Egg._hidden();
    if (!hidden && t === "player") this.showRoulette(this._rouletteBumper(vis[0]), 2200);
    setTimeout(() => this.resetLit(), 700);
  },


  // ---------- Lanzar un gnomo contra un bumper (rebote de billar) ----------
  // Si el huevo está a la vista y el camino bumper -> huevo está libre, el gnomo rebota
  // en línea recta hasta quedar junto al huevo y lo golpea. Si no, cae sentado a 2 casillas
  // del bumper. En todos los casos el gnomo se carga +5 y queda mareado hasta acabar el turno.
  _free(r, c, b) {
    const size = Units.boardSize;
    if (r < 0 || c < 0 || r >= size || c >= size) return false;
    if (typeof Egg !== "undefined" && Egg.egg && !Egg.egg.exploded && Egg.egg.row === r && Egg.egg.col === c) return false;
    return Egg._canRest(r, c) && !(b && b.row === r && b.col === c);
  },

  // Casilla libre al azar (determinista por semilla, para que el multijugador coincida) a 1 o 2 de distancia.
  _landCell(b, holder) {
    this._throwN = (this._throwN || 0) + 1;
    let sd = ((b.row * 73856093) ^ (b.col * 19349663) ^ (holder.row * 83492791) ^ (holder.col * 2654435) ^ (this._throwN * 1013)) >>> 0;
    const rng = () => { sd = (sd + 0x6d2b79f5) >>> 0; let x = sd; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    const cands = [];
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      if (!dr && !dc) continue;
      const r = b.row + dr, c = b.col + dc;
      if (this._free(r, c, b)) { cands.push({ row: r, col: c }); continue; }
      // Si cae sobre una unidad, esa unidad coge al gnomo directamente.
      const u = r >= 0 && c >= 0 && r < Units.boardSize && c < Units.boardSize ? Units.unitAt(r, c) : null;
      if (u && !Gnome.isHeldBy(u.id) && !(b.row === r && b.col === c) && !Egg._tileObjectAt(r, c)
        && !(Egg.egg && !Egg.egg.exploded && Egg.egg.row === r && Egg.egg.col === c)) cands.push({ row: r, col: c, unit: u });
    }
    if (cands.length) return cands[Math.floor(rng() * cands.length)];
    return { row: holder.row, col: holder.col };
  },

  _outcome(b, holder) {
    const e = typeof Egg !== "undefined" && Egg._live() && !Egg._hidden() ? Egg.egg : null;
    if (e) {
      const d = Math.max(Math.abs(e.row - b.row), Math.abs(e.col - b.col));
      const cells = [];
      for (let i = 1; i < d; i++) cells.push({ row: b.row + Math.round(((e.row - b.row) * i) / d), col: b.col + Math.round(((e.col - b.col) * i) / d) });
      const bad = cells.findIndex((q) => !this._free(q.row, q.col, b));
      if (bad < 0 && cells.length) {
        const last = cells[cells.length - 1];
        return { kind: "egg", cell: last, dir: [Math.sign(e.row - last.row), Math.sign(e.col - last.col)] };
      }
      if (bad > 0) return { kind: "blocked", cell: cells[bad - 1], blocker: cells[bad] };
    }
    return { kind: "sit", cell: this._landCell(b, holder) };
  },

  addThrowMarker(unit, gnome) {
    if (!this.list.length || typeof Egg === "undefined" || !Egg.isActive()) return;
    this.list.forEach((b) => {
      if (typeof Fog !== "undefined" && Fog.isFoggedReal(b.row, b.col)) return;
      const dist = Math.max(Math.abs(b.row - unit.row), Math.abs(b.col - unit.col));
      if (dist < 1 || dist > GNOME_THROW_MAX_RANGE) return;
      Units.addMarker({
        className: "pass-marker bumper-throw-marker",
        row: b.row, col: b.col, zOffset: 12,
        visibleClass: "pass-marker--visible",
        owner: "gnome", alwaysOnTop: true,
        buildContent: (marker) => {
          const icon = document.createElement("i");
          icon.className = "ph ph-paper-plane-tilt pass-marker__icon";
          marker.appendChild(icon);
        },
        onClick: () => this.throwGnome(unit, gnome, b),
      });
    });
  },

  async throwGnome(holder, gnome, b) {
    if (!b || !this.list.includes(b) || gnome.heldBy !== holder.id || gnome.busy) return;
    if (typeof Egg === "undefined" || !Egg.isActive() || Egg._busy) return;
    if (typeof Turns !== "undefined" && !Turns.canAct(holder)) return;
    if (typeof Turns !== "undefined") Turns.useAction(holder);
    Units.clearRangeOverlays();
    gnome.passing = false;
    gnome.busy = true;
    gnome.hideBadge();
    Egg._busy = true;
    try {
      const out = this._outcome(b, holder);
      Units.faceTowardsTile(holder, b.row, b.col);
      gnome.row = holder.row;
      gnome.col = holder.col;
      Units.faceTowardsTile(gnome, b.row, b.col);
      if (holder.el) {
        holder.el.classList.remove("unit--throwing");
        void holder.spriteEl.offsetWidth;
        holder.el.classList.add("unit--throwing");
        setTimeout(() => holder.el && holder.el.classList.remove("unit--throwing"), 380);
      }
      gnome.detachFrom();
      gnome.spriteEl.src = GNOME_ASSETS.grita;
      await gnome.animateThrowTo(holder.row, holder.col, b.row, b.col);
      // Impacto en el bumper: golpe de combo, se enciende.
      this.beginFlight();
      const n = this.registerHit();
      this.reactAt(b, n);
      this.markLit(b, holder.team);
      await new Promise((r) => setTimeout(r, 160));
      // Rebote hacia su casilla (junto al huevo, junto al obstáculo o a 2 casillas del bumper).
      await gnome.animateThrowTo(b.row, b.col, out.cell.row, out.cell.col);
      const catcher = out.cell.unit && Units.list.includes(out.cell.unit) && !Gnome.isHeldBy(out.cell.unit.id) ? out.cell.unit : null;
      if (catcher) {
        // Cae en los brazos de una unidad: la coge directamente (sin mareo).
        gnome.row = catcher.row;
        gnome.col = catcher.col;
        gnome.attachTo(catcher);
        gnome._addPoints(GNOME_BUMP_POINTS);
        Units.spawnFloatingText(catcher, `+${GNOME_BUMP_POINTS}`, { className: "dmg-popup gnome-points-popup" });
        if (typeof SFX !== "undefined" && SFX.passSuccess) SFX.passSuccess();
      } else {
        await gnome.landAt(out.cell, { sound: () => { if (typeof SFX !== "undefined") SFX.gnomeLandSoft(); } });
        gnome._addPoints(GNOME_BUMP_POINTS);
        Units.spawnFloatingText(gnome, `+${GNOME_BUMP_POINTS}`, { className: "dmg-popup gnome-points-popup" });
        gnome.setDizzy();
      }
      let flight = null;
      if (out.kind === "egg") {
        this._keepCombo = true;
        flight = Egg._ricochetHit(holder, out.dir);
      } else {
        if (out.kind === "blocked" && Units.unitAt(out.blocker.row, out.blocker.col)) {
          const u = Units.unitAt(out.blocker.row, out.blocker.col);
          if (typeof Units.playShake === "function") Units.playShake(u);
        }
        flight = this.endFlight(holder.team);
      }
      await flight;
    } finally {
      Egg._busy = false;
      this._keepCombo = false;
      gnome.busy = false;
      if (holder.el) Units.refreshRange(holder);
    }
  },

  // Registra un golpe (bumper, tótem, obelisco o unidad). Devuelve el nº de golpes del vuelo.
  registerHit() {
    this.combo++;
    if (this.combo >= 2) this._showCombo(this.combo);
    return this.combo;
  },

  // Reacción visual + sonora de un objeto golpeado (bumper o tótem): rebote elástico y onda.
  reactAt(obj, n) {
    const sp = obj && (obj.spriteEl || obj.el);
    if (sp && sp.animate) {
      sp.animate(
        [
          { scale: "1 1" },
          { scale: "1.22 0.78", offset: 0.18 },
          { scale: "0.9 1.14", offset: 0.45 },
          { scale: "1.05 0.97", offset: 0.7 },
          { scale: "1 1" },
        ],
        { duration: 480, easing: "cubic-bezier(.2,1.5,.4,1)" }
      );
    }
    if (typeof Drums !== "undefined" && Drums._wave) Drums._wave({ row: obj.row, col: obj.col }, true);
    if (typeof SFX !== "undefined" && SFX.bumper) { try { SFX.bumper(n); } catch (er) {} }
  },

  // Fin del vuelo: el COMBO se suma UNA vez a la ruleta del equipo que golpeó.
  async endFlight(team) {
    this.resetLit();
    const n = this.combo;
    this.combo = 0;
    const t = team === "enemy" ? "enemy" : "player";
    const hidden = typeof Egg !== "undefined" && Egg._hidden && Egg._hidden();
    if (n < 2) {
      this._hideCombo();
      if (n >= 1 && !hidden && t === "player" && this.list.length) this.showRoulette(this._rouletteBumper(), 1600);
    } else {
      const before = this.slices[t];
      this.slices[t] = Math.min(BUMPER_SLICES_MAX, before + n);
      if (hidden) this._hideCombo();
      else {
        await this._flyComboToRoulette(n);
        if (typeof SFX !== "undefined" && SFX.comboFill) { try { SFX.comboFill(n); } catch (er) {} }
        if (this.list.length) this.showRoulette(this._rouletteBumper(), 1600);
      }
    }
    // 10 de ruleta antes de que se rompa el huevo: se llevan los 10 puntos, solo quien los alcanza.
    const w = this._winner(t);
    if (w) await this._win(w);
  },

  _winner(pref) {
    const a = this.slices.player >= BUMPER_SLICES_MAX, b = this.slices.enemy >= BUMPER_SLICES_MAX;
    if (a && b) return pref;
    return a ? "player" : b ? "enemy" : null;
  },

  // Premio de 10: reinicia todas las ruletas y la puntuación del huevo; el resto no recibe nada.
  async _win(t) {
    this.resetRoulettes();
    this.hideRoulette();
    this._grant(t, BUMPER_SLICES_MAX);
    if (typeof Egg !== "undefined" && Egg.resetScore) Egg.resetScore();
    await this._pop(t === "player" ? BUMPER_SLICES_MAX : 0);
  },

  _grant(t, g) {
    if (g > 0 && typeof Glory !== "undefined" && t in Glory.points) {
      const room = Math.max(0, (typeof GLORY_CAP !== "undefined" ? GLORY_CAP : 999) - Glory.points[t]);
      const add = Math.min(g, room);
      Glory.points[t] += add;
      Glory._render(t, { bump: add > 0, gained: add });
    }
  },

  async _pop(mine) {
    const hidden = typeof Egg !== "undefined" && Egg._hidden && Egg._hidden();
    if (hidden) return;
    if (typeof SFX !== "undefined" && SFX.jackpot) { try { SFX.jackpot(); } catch (er) {} }
    const el = document.createElement("div");
    el.className = "jackpot-pop";
    el.innerHTML = `<b>JACKPOT</b><span>+${mine}!</span>`;
    document.body.appendChild(el);
    this._coins();
    await new Promise((r) => setTimeout(r, 2200));
    el.remove();
  },

  // ---------- JACKPOT ----------
  async jackpot() {
    const w = this._winner("player");
    if (w) { await this._win(w); return; }
    const gains = { player: this.slices.player, enemy: this.slices.enemy };
    this.resetRoulettes();
    this.hideRoulette();
    const total = gains.player + gains.enemy;
    ["player", "enemy"].forEach((t) => this._grant(t, gains[t]));
    if (total <= 0) return;
    await this._pop(gains.player);
  },

  _coins() {
    for (let i = 0; i < 30; i++) {
      const c = document.createElement("div");
      c.className = "jackpot-coin";
      c.style.left = "50%";
      c.style.top = "40%";
      document.body.appendChild(c);
      const a = NR() * Math.PI * 2;
      const d = 200 + NR() * 360;
      const dx = Math.cos(a) * d, dy = Math.sin(a) * d * 0.6 - 100;
      const an = c.animate(
        [
          { transform: "translate(-50%,-50%)", opacity: 1 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`, opacity: 1, offset: 0.55 },
          { transform: `translate(calc(-50% + ${dx * 1.1}px), calc(-50% + ${dy + 240}px)) scale(.7)`, opacity: 0 },
        ],
        { duration: 1300 + NR() * 600, delay: NR() * 200, easing: "cubic-bezier(.2,.7,.4,1)" }
      );
      an.onfinish = () => c.remove();
    }
  },

  // ---------- Indicador COMBO (se queda hasta que el huevo para) ----------
  _showCombo(n) {
    if (typeof Egg !== "undefined" && Egg._hidden && Egg._hidden()) return;
    let el = this._comboEl;
    if (!el) {
      el = document.createElement("div");
      el.className = "combo-indicator";
      document.body.appendChild(el);
      this._comboEl = el;
    }
    el.textContent = `COMBO X${n}!`;
    el.style.fontSize = `${Math.min(46 + n * 5, 96)}px`;
    el.classList.remove("combo-indicator--hit");
    void el.offsetWidth;
    el.classList.add("combo-indicator--on", "combo-indicator--hit");
    if (typeof SFX !== "undefined" && SFX.comboChime) { try { SFX.comboChime(n); } catch (er) {} }
  },

  _hideCombo() {
    if (this._comboEl) { this._comboEl.remove(); this._comboEl = null; }
  },

  async _flyComboToRoulette(n) {
    const el = this._comboEl;
    const b = this.list[0];
    if (!el || !b) { this._hideCombo(); return; }
    const vp = document.getElementById("board-viewport");
    const er = el.getBoundingClientRect();
    let tx = er.left + er.width / 2, ty = er.top + 200;
    const be = b.el.getBoundingClientRect();
    tx = be.left + be.width / 2;
    ty = be.top - 40;
    const dx = tx - (er.left + er.width / 2), dy = ty - er.top;
    el.classList.remove("combo-indicator--hit");
    try {
      await el.animate(
        [
          { transform: "translate(-50%,0) scale(1)", opacity: 1 },
          { transform: `translate(calc(-50% + ${dx}px), ${dy}px) scale(.3)`, opacity: 1 },
        ],
        { duration: 520, easing: "cubic-bezier(.5,0,.8,.4)", fill: "forwards" }
      ).finished;
    } catch (er2) {}
    this._hideCombo();
  },

  // ---------- Ruleta (estética de los tambores) ----------
  _plateSvg(have, color) {
    const R = 46, cx = 50, cy = 50, N = BUMPER_SLICES_MAX;
    let s = "";
    for (let i = 0; i < N; i++) {
      const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / N + 0.03;
      const a1 = -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / N - 0.03;
      const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0);
      const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
      s += `<path d="M${cx} ${cy} L${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1} Z" fill="${i < have ? color : "#4a3f52"}" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>`;
    }
    return `<svg width="104" height="104" viewBox="0 0 100 100"><circle cx="50" cy="50" r="49" fill="#1d1814" stroke="#000" stroke-width="3"/>${s}<circle cx="50" cy="50" r="13" fill="#1d1814" stroke="#000" stroke-width="2.5"/><text x="50" y="58" text-anchor="middle" font-family="Russo One, sans-serif" font-size="22" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${have}</text></svg>`;
  },

  showRoulette(b, ms) {
    this.hideRoulette();
    if (!b) return;
    const el = document.createElement("div");
    el.className = "bumper-roulette";
    // Cada jugador ve solo SU ruleta (la del rival no se enseña).
    el.innerHTML = `<div>${this._plateSvg(this.slices.player, "#ffd23f")}</div>`;
    const { x, y } = getTileCenter(b.row, b.col, Units.boardSize);
    el.style.left = `${x}px`;
    el.style.top = `${y - 230}px`;
    el.style.zIndex = "9000";
    Units.container.appendChild(el);
    this._rouletteEl = el;
    this._rouletteFor = b;
    if (this._tutHook) this._tutHook();
    clearTimeout(this._rouletteTimer);
    this._rouletteTimer = setTimeout(() => this.hideRoulette(), ms || 2600);
  },

  _tutHook: null,

  // Hover de los bumpers y del huevo: se amplían un poco al pasar el ratón por encima y
  // vuelven a su tamaño al salir, como el resto de elementos. Se detecta por la caja del
  // sprite (no por :hover) para que no reaccione el hueco transparente ni la nube del huevo.
  _hoverEl: null,
  _hoverAt(ev) {
    const cands = this.list.map((b) => ({ el: b.el, spriteEl: b.spriteEl, w: 0.5, h: 0.6, cy: 0.55 }));
    const e = typeof Egg !== "undefined" ? Egg.egg : null;
    if (e && !e.exploded && e.spriteEl) cands.push({ el: e.el, spriteEl: e.spriteEl, w: 0.34, h: 0.6, cy: 0.5 });
    let best = null;
    cands.forEach((c) => {
      if (!c.el || !c.el.isConnected || c.el.classList.contains("unit--fog-hidden")) return;
      const r = c.spriteEl.getBoundingClientRect();
      const w = r.width * c.w, h = r.height * c.h;
      const cx = r.left + r.width / 2, cy = r.top + r.height * c.cy;
      if (Math.abs(ev.clientX - cx) <= w / 2 && Math.abs(ev.clientY - cy) <= h / 2) {
        const z = parseInt(c.el.style.zIndex, 10) || 0;
        if (!best || z > best.z) best = { sp: c.spriteEl, z };
      }
    });
    return best ? best.sp : null;
  },
  _onPointerMove(ev) {
    const sp = ev && ev.target && ev.target.closest && !ev.target.closest("#board-viewport") ? null : this._hoverAt(ev);
    if (sp === this._hoverEl) return;
    if (this._hoverEl) this._hoverEl.classList.remove("gg-hover");
    this._hoverEl = sp;
    if (sp) sp.classList.add("gg-hover");
    document.body.classList.toggle("gg-pinball-hover", !!sp);
  },
  clearHover() {
    if (this._hoverEl) this._hoverEl.classList.remove("gg-hover");
    this._hoverEl = null;
    document.body.classList.remove("gg-pinball-hover");
  },

  hideRoulette() {
    clearTimeout(this._rouletteTimer);
    if (this._rouletteEl) { this._rouletteEl.remove(); this._rouletteEl = null; }
  },
};

if (typeof document !== "undefined") {
  document.addEventListener("pointermove", (ev) => {
    if (ev.pointerType && ev.pointerType !== "mouse") return;
    if (typeof Bumpers !== "undefined") Bumpers._onPointerMove(ev);
  });
  document.addEventListener("pointerdown", (ev) => {
    const vp = document.getElementById("board-viewport");
    if (vp && vp.contains(ev.target) && typeof Bumpers !== "undefined") Bumpers._onPointerDown(ev);
  });
}

// Se engancha a la actualización de transparencias de los tótems para no depender de otro listener de ratón.
if (typeof Villages !== "undefined" && Villages.refreshOcclusion && !Villages._bumpersPatched) {
  Villages._bumpersPatched = true;
  const _vOcc = Villages.refreshOcclusion;
  Villages.refreshOcclusion = function (mx, my) {
    const r = _vOcc.call(this, mx, my);
    if (typeof Bumpers !== "undefined") Bumpers.refreshOcclusion(mx, my);
    return r;
  };
}

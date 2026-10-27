/* Gnomore Gnomes — La Reliquia Paranoica (nivel Fortaleza WallForge).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - El Altar de la Reliquia (centro del mapa, sellado con cadenas) y sus 3 guardias inmortales.
     - Los guardias: patrullan el altar al unísono en círculo; se mueven 1 casilla al FINAL de cada turno
       (el de cada bando), pegan 1 de daño y solo se aturden (3 turnos) con un gnomazo: pegar a un guardia
       con un gnomo en la mano lo aturde y carga el gnomo con +5 puntos (el gnomo se queda).
     - Abrir el altar: lanzarle un gnomo cargado con 10 puntos rompe las cadenas (con menos, solo rebota).
       Atacar el altar manda a los guardias tras el atacante hasta que se aleje más de 4 casillas.
     - La Reliquia: quien la coge del altar la lleva sobre la cabeza y acumula 1 punto por cada turno que la
       lleva; los guardias van a por él (siempre al portador, sea del bando que sea). Si llega a una casilla
       pegada a su obelisco cobra todos los puntos de Gloria y el minijuego se reinicia (Reliquia al altar,
       sellado). Si la pierde (muere), cae al suelo y pierde los puntos: cualquier unidad que la pise la coge;
       si la pisa un guardia, vuelve al altar y se resella.
   Solo existe en el nivel "wallforge" (experimental, sin multijugador). El resto del juego solo la ve a través
   de Reliquia.blocks (casillas ocupadas, vía Drums.at), Reliquia.addThrowMarker (js/gnome.js), Reliquia.refreshFog
   (js/fog.js) y el oyente de turnos. */

const RELIQUIA_DIR = "assets/niveles/wallforge/";
const RELIQUIA_SRC = {
  guardia: RELIQUIA_DIR + "guardia.png",
  mareado: RELIQUIA_DIR + "guardia_mareado.png",
  sellado: RELIQUIA_DIR + "altar_sellado.png",
  rompiendo: RELIQUIA_DIR + "altar_rompiendo.png",
  abierto: RELIQUIA_DIR + "altar_abierto.png",
  vacio: RELIQUIA_DIR + "altar_vacio.png",
  icono: RELIQUIA_DIR + "reliquia.png",
};
const RELIQUIA_HITS_TO_OPEN = 3; // gnomos que hay que estrellar contra el altar: rompen una cadena, la otra y, el tercero, desencadena la Reliquia
const RELIQUIA_WAVE_MS = [2400, 1600, 1000, 620]; // cada cuánto sale una onda naranja según los golpes recibidos (más rápido con menos cadenas)
const RELIQUIA_HIT_CHARGE = 5; // puntos que gana el gnomo al pegar a un guardia
const RELIQUIA_STUN_TURNS = 3; // turnos (de cualquier bando) que dura el aturdimiento
const RELIQUIA_GUARD_DAMAGE = 1;
const RELIQUIA_LEASH = 4; // si el atacante del altar se aleja más de estas casillas, los guardias vuelven a patrullar
const RELIQUIA_RING = 2; // radio (Chebyshev) del círculo de patrulla
const RELIQUIA_GUARD_OFFSETS = [0, 5, 11]; // posiciones de los 3 guardias en el círculo de 16 casillas
const RELIQUIA_ALTAR_W = 262; // ancho del altar en pantalla (px)
const RELIQUIA_ALTAR_H = (638 / 560) * RELIQUIA_ALTAR_W;
const RELIQUIA_RELIC_Y = 93; // altura (px sobre el centro de la casilla) a la que flota la Reliquia sobre el altar

const Reliquia = {
  altar: null, // { row, col, el, imgEl, state: "sellado" | "abierto" | "vacio" }
  guards: [],
  relic: null, // { state: "altar" | "carried" | "floor", carrier, team, points, row, col, el }
  alert: null, // { unitId }
  base: 0, // giro actual de la patrulla
  busy: false,

  isActive() {
    return typeof LevelAssets !== "undefined" && LevelAssets.current === "wallforge";
  },

  resetAll() {
    if (this.altar && this.altar.el) this.altar.el.remove();
    this.guards.forEach((g) => g.el && g.el.remove());
    if (this.relic && this.relic.el) this.relic.el.remove();
    this.altar = null;
    this.guards = [];
    this.relic = null;
    this.alert = null;
    this.base = 0;
    this.busy = false;
  },

  // Percepción: quien lleve la Reliquia (de cualquier bando) y lo que él ve es visible para TODOS.
  markPerception(markAround) {
    const c = this._carrier();
    if (!c) return;
    const type = typeof UNIT_TYPES !== "undefined" ? UNIT_TYPES[c.typeId] : null;
    markAround(c.row, c.col, (type ? type.percepcion : 1) + 1);
  },

  _revealCarrier() {
    const c = this._carrier();
    if (!c || typeof Fog === "undefined" || !Fog.revealAround) return;
    const type = typeof UNIT_TYPES !== "undefined" ? UNIT_TYPES[c.typeId] : null;
    Fog.revealAround(c.row, c.col, (type ? type.percepcion : 1) + 1);
  },

  // Casilla ocupada por el altar o por un guardia (Drums.at lo consulta, ver el final del archivo).
  blocks(row, col) {
    if (!this.altar) return null;
    if (this.altar.row === row && this.altar.col === col) return this.altar;
    return this.guards.find((g) => g.row === row && g.col === col) || null;
  },

  _sfx(name, ...args) {
    try {
      if (typeof SFX !== "undefined" && typeof SFX[name] === "function") SFX[name](...args);
    } catch (e) {}
  },

  _shake(big) {
    const v = document.getElementById("board-viewport");
    if (!v) return;
    const cls = big ? "board-viewport--shake--big" : "board-viewport--shake";
    v.classList.remove("board-viewport--shake", "board-viewport--shake--big");
    void v.offsetWidth;
    v.classList.add(cls);
    setTimeout(() => v.classList.remove(cls), 420);
  },

  // Resolución adaptativa (js/spritequality.js): todo sprite del tablero se asigna por aquí.
  _src(img, src) {
    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(img, src);
    else img.src = src;
  },

  // Ondas naranjas en perspectiva detrás del altar: más rápidas cuanto menos cadenas quedan; cesan al coger la Reliquia.
  _startWaves() {
    this._stopWaves();
    const a = this.altar;
    if (!a || !a.wavesEl) return;
    const tick = () => {
      a._waveT = null;
      if (!this.altar || a !== this.altar || this.relic.state !== "altar" || a.state === "vacio") return;
      if (!document.hidden && a.el.isConnected && !a.el.classList.contains("unit--fog-hidden")) this._wave();
      a._waveT = setTimeout(tick, RELIQUIA_WAVE_MS[Math.min(a.hits, RELIQUIA_WAVE_MS.length - 1)]);
    };
    tick();
  },

  _stopWaves() {
    const a = this.altar;
    if (a && a._waveT) clearTimeout(a._waveT);
    if (a) a._waveT = null;
  },

  _wave() {
    const a = this.altar;
    const w = document.createElement("div");
    w.className = "reliquia-wave";
    a.wavesEl.appendChild(w);
    const fast = RELIQUIA_WAVE_MS[Math.min(a.hits, RELIQUIA_WAVE_MS.length - 1)];
    const an = w.animate(
      [{ width: "90px", height: "50px", opacity: 0.95, borderWidth: "7px" }, { width: "470px", height: "260px", opacity: 0, borderWidth: "2px" }],
      { duration: 1500 + fast * 0.4, easing: "ease-out", fill: "forwards" }
    );
    an.onfinish = () => w.remove();
  },

  _wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  },

  _cheb(a, b) {
    return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
  },

  // ---------- Reparto ----------
  spawn(size) {
    this.resetAll();
    if (!this.isActive()) return;
    if (typeof Net !== "undefined" && Net.active) return; // de momento solo partidas locales
    Object.values(RELIQUIA_SRC).forEach((s) => {
      const i = new Image();
      i.src = s;
      if (i.decode) i.decode().catch(() => {});
    });
    // Como el Volcán: el punto más cercano al centro cuyo cuadrado de 5x5 sea todo transitable.
    const c = { row: Math.floor(size / 2), col: Math.floor(size / 2) };
    const clear = (r, cc) => {
      for (let dr = -RELIQUIA_RING; dr <= RELIQUIA_RING; dr++)
        for (let dc = -RELIQUIA_RING; dc <= RELIQUIA_RING; dc++) {
          const rr = r + dr, c2 = cc + dc;
          if (rr < 0 || c2 < 0 || rr >= size || c2 >= size) return false;
          if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(rr, c2)) return false;
          if (typeof Obelisks !== "undefined" && Obelisks.at(rr, c2)) return false;
        }
      return true;
    };
    let spot = null;
    for (let radius = 0; radius <= size && !spot; radius++)
      for (let dr = -radius; dr <= radius && !spot; dr++)
        for (let dc = -radius; dc <= radius && !spot; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
          if (clear(c.row + dr, c.col + dc)) spot = { row: c.row + dr, col: c.col + dc };
        }
    if (!spot) return;
    this._createAltar(spot.row, spot.col);
    this.relic = { state: "altar", carrier: null, team: null, points: 0, row: spot.row, col: spot.col, el: null };
    this._startWaves();
    const ring = this._ring();
    RELIQUIA_GUARD_OFFSETS.forEach((off, i) => this._createGuard(i, off, ring[off % ring.length]));
    this.refreshFog();
  },

  _px(row, col) {
    return getTileCenter(row, col, Units.boardSize);
  },

  _createAltar(row, col) {
    const el = document.createElement("div");
    el.className = "unit board-item reliquia-altar";
    const img = document.createElement("img");
    img.className = "reliquia-altar__sprite";
    img.alt = "";
    img.draggable = false;
    img.decoding = "async";
    const waves = document.createElement("div");
    waves.className = "reliquia-waves";
    el.appendChild(waves);
    this._src(img, RELIQUIA_SRC.sellado);
    el.appendChild(img);
    Units.container.appendChild(el);
    if (typeof Shadows !== "undefined") Shadows.attach(img);
    const { x, y } = this._px(row, col);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.zIndex = String((row + col) * 10 + 5);
    this.altar = { row, col, el, imgEl: img, wavesEl: waves, state: "sellado", hits: 0 };
  },

  _setAltar(state) {
    if (!this.altar) return;
    this.altar.state = state;
    this._src(this.altar.imgEl, RELIQUIA_SRC[state]);
  },

  _ring() {
    const a = this.altar, R = RELIQUIA_RING, cells = [];
    for (let c = -R; c <= R; c++) cells.push([-R, c]);
    for (let r = -R + 1; r <= R; r++) cells.push([r, R]);
    for (let c = R - 1; c >= -R; c--) cells.push([R, c]);
    for (let r = R - 1; r > -R; r--) cells.push([r, -R]);
    return cells.map(([dr, dc]) => ({ row: a.row + dr, col: a.col + dc }));
  },

  _createGuard(i, off, cell) {
    const el = document.createElement("div");
    el.className = "unit board-item reliquia-guard";
    const img = document.createElement("img");
    img.className = "reliquia-guard__sprite";
    img.alt = "";
    img.draggable = false;
    img.decoding = "async";
    this._src(img, RELIQUIA_SRC.guardia);
    el.appendChild(img);
    Units.container.appendChild(el);
    if (typeof Shadows !== "undefined") Shadows.attach(img);
    const g = { id: `guardia-${i + 1}`, team: "guardia", row: cell.row, col: cell.col, off, el, imgEl: img, stun: 0, flip: false, starsEl: null, hp: 99, maxHp: 99 };
    this._place(g);
    this.guards.push(g);
  },

  _place(g) {
    const { x, y } = this._px(g.row, g.col);
    g.el.style.left = `${x}px`;
    g.el.style.top = `${y}px`;
    g.el.style.zIndex = String((g.row + g.col) * 10 + 6);
  },

  _face(g, row, col) {
    const dx = col - row - (g.col - g.row);
    if (dx === 0) return;
    g.flip = dx < 0;
    g.imgEl.style.scale = g.flip ? "-1 1" : "1 1";
  },

  refreshFog() {
    if (typeof Fog === "undefined" || !this.altar) return;
    const f = (o) => Fog.isFoggedReal(o.row, o.col) || !Fog.isPerceived(o.row, o.col);
    this.altar.el.classList.toggle("unit--fog-hidden", f(this.altar));
    this.guards.forEach((g) => g.el.classList.toggle("unit--fog-hidden", f(g)));
    const r = this.relic;
    if (r && r.state === "floor" && r.el) r.el.classList.toggle("unit--fog-hidden", f(r));
  },

  _visible(o) {
    return !(typeof Fog !== "undefined" && (Fog.isFoggedReal(o.row, o.col) || !Fog.isPerceived(o.row, o.col)));
  },

  // ---------- Casillas libres para los guardias y búsqueda de camino ----------
  _freeFor(g, r, c) {
    const size = Units.boardSize;
    if (r < 0 || c < 0 || r >= size || c >= size) return false;
    if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(r, c)) return false;
    if (this.altar.row === r && this.altar.col === c) return false;
    if (this.guards.some((o) => o !== g && o.row === r && o.col === c)) return false;
    if (Units.unitAt(r, c)) return false;
    if (typeof Gnome !== "undefined" && Gnome.isAt(r, c)) return false;
    if (typeof Villages !== "undefined" && Villages.at(r, c)) return false;
    if (typeof Shops !== "undefined" && Shops.at(r, c)) return false;
    if (typeof Obelisks !== "undefined" && Obelisks.at(r, c)) return false;
    if (typeof Resources !== "undefined" && Resources.at(r, c)) return false;
    if (typeof Oracle !== "undefined" && Oracle.at && Oracle.at(r, c)) return false;
    if (typeof Bushes !== "undefined" && Bushes.at && Bushes.at(r, c)) return false;
    return true;
  },

  // Primer paso de un camino más corto (8 direcciones) hasta una casilla que cumpla goalFn.
  _bfs(g, goalFn) {
    const size = Units.boardSize, key = (r, c) => r * size + c;
    const prev = new Map([[key(g.row, g.col), null]]);
    const q = [[g.row, g.col]];
    let found = null;
    while (q.length && !found) {
      const [r, c] = q.shift();
      for (let dr = -1; dr <= 1 && !found; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nr = r + dr, nc = c + dc, k = key(nr, nc);
          if (nr < 0 || nc < 0 || nr >= size || nc >= size || prev.has(k)) continue;
          if (!this._freeFor(g, nr, nc)) continue;
          prev.set(k, [r, c]);
          if (goalFn(nr, nc)) { found = [nr, nc]; break; }
          q.push([nr, nc]);
        }
    }
    if (!found) return null;
    let cur = found;
    for (;;) {
      const p = prev.get(key(cur[0], cur[1]));
      if (p[0] === g.row && p[1] === g.col) break;
      cur = p;
    }
    return { row: cur[0], col: cur[1] };
  },

  // ---------- Turnos: los guardias actúan al FINAL de cada turno ----------
  async onTurnEnd(team) {
    if (!this.altar || !this.relic) return;
    if (typeof Obelisks !== "undefined" && Obelisks.gameOver) return;
    try {
      const r = this.relic;
      if (r.state === "carried" && r.team === team) {
        r.points += 1;
        this._updateBadge();
        const u = this._carrier();
        if (u) Units.spawnFloatingText(u, `+1`, { className: "dmg-popup gnome-points-popup" });
        if (u) await this.checkDelivery(u);
      }
      this._revealCarrier();
      await this._guardsTurn();
    } catch (e) {
      console.warn("[Reliquia] turno", e);
    }
  },

  _carrier() {
    const r = this.relic;
    return r && r.state === "carried" ? Units.list.find((u) => u.id === r.carrier) || null : null;
  },

  _chaseTarget() {
    const c = this._carrier();
    if (c) return c;
    if (this.alert) {
      const u = Units.list.find((x) => x.id === this.alert.unitId);
      if (u && this._cheb(u, this.altar) <= RELIQUIA_LEASH) return u;
      this.alert = null;
    }
    return null;
  },

  async _guardsTurn() {
    if (this.busy) return;
    const target = this._chaseTarget();
    const r = this.relic;
    const anims = [];
    // Los aturdidos descuentan turno y no hacen nada.
    const awake = [];
    this.guards.forEach((g) => {
      if (g.stun > 0) {
        g.stun--;
        if (g.stun === 0) this._clearStun(g);
      } else awake.push(g);
    });
    if (target) {
      for (const g of awake) {
        if (!Units.list.includes(target)) break;
        if (this._cheb(g, target) <= 1) anims.push(this._guardHit(g, target));
        else {
          const step = this._bfs(g, (rr, cc) => Math.max(Math.abs(rr - target.row), Math.abs(cc - target.col)) <= 1);
          if (step) anims.push(this._guardStep(g, step));
        }
      }
    } else if (r.state === "floor") {
      for (const g of awake) {
        const step = this._bfs(g, (rr, cc) => rr === r.row && cc === r.col);
        if (step) anims.push(this._guardStep(g, step));
      }
    } else {
      this._patrol(awake, anims);
    }
    // Marcha de soldados: solo suena si el jugador ve a algún guardia moverse.
    if (anims.length && this.guards.some((g) => g.stun <= 0 && this._visible(g))) this._sfx("reliquiaMarch");
    await Promise.all(anims);
    if (typeof Fog !== "undefined") Fog.applyVisibility();
  },

  _slot(g, base) {
    const ring = this._ring();
    return ring[(base + g.off) % ring.length];
  },

  _patrol(awake, anims) {
    const inFormation = this.guards.every((g) => {
      const s = this._slot(g, this.base);
      return g.row === s.row && g.col === s.col && g.stun === 0;
    });
    if (!inFormation) {
      // Reagrupar: cada guardia despierto camina hacia su sitio del círculo (el círculo no gira mientras tanto).
      awake.forEach((g) => {
        const s = this._slot(g, this.base);
        if (g.row === s.row && g.col === s.col) return;
        const step = this._bfs(g, (rr, cc) => rr === s.row && cc === s.col);
        if (step) anims.push(this._guardStep(g, step));
      });
      return;
    }
    // Todos en formación: el círculo gira una casilla. Quien se cruce en el camino de un guardia se lleva un golpe.
    const next = this.guards.map((g) => this._slot(g, this.base + 1));
    const blocked = next.map((s, i) => !this._freeFor(this.guards[i], s.row, s.col));
    if (blocked.some(Boolean)) {
      this.guards.forEach((g, i) => {
        if (!blocked[i]) return;
        const u = Units.unitAt(next[i].row, next[i].col);
        if (u) anims.push(this._guardHit(g, u));
      });
      return;
    }
    this.base++;
    this.guards.forEach((g, i) => anims.push(this._guardStep(g, next[i])));
  },

  async _guardStep(g, cell) {
    this._face(g, cell.row, cell.col);
    g.row = cell.row;
    g.col = cell.col;
    this._place(g);
    if (typeof Fog !== "undefined" && Fog.applyVisibility) Fog.applyVisibility();
    if (g.imgEl.animate)
      g.imgEl.animate(
        [{ transform: "translateY(0) scale(1,1)" }, { transform: "translateY(-14px) scale(.96,1.06)", offset: 0.45 }, { transform: "translateY(0) scale(1.08,.9)", offset: 0.8 }, { transform: "translateY(0) scale(1,1)" }],
        { duration: 300, easing: "ease-out" }
      );
    await this._wait(260);
    const r = this.relic;
    if (r && r.state === "floor" && r.row === g.row && r.col === g.col) await this._recover(g);
  },

  async _guardHit(g, unit) {
    this._face(g, unit.row, unit.col);
    const dir = g.flip ? -1 : 1;
    if (g.imgEl.animate)
      await g.imgEl.animate(
        [{ transform: "translate(0,0) scale(1,1)" }, { transform: `translate(${-8 * dir}px,2px) scale(.94,1.08)`, offset: 0.35 }, { transform: `translate(${18 * dir}px,-4px) scale(1.12,.9)`, offset: 0.6 }, { transform: "translate(0,0) scale(1,1)" }],
        { duration: 420, easing: "ease-out" }
      ).finished.catch(() => {});
    if (!Units.list.includes(unit)) return;
    if (typeof Enmurallado !== "undefined" && Enmurallado.hurt) await Enmurallado.hurt(unit, RELIQUIA_GUARD_DAMAGE, null);
    else {
      unit.hp = Math.max(0, unit.hp - RELIQUIA_GUARD_DAMAGE);
      Units.updateHpBar(unit);
      Units.spawnFloatingText(unit, `-${RELIQUIA_GUARD_DAMAGE}`, { className: "dmg-popup" });
      Units.playShake(unit);
      this._sfx("hit");
      if (unit.hp <= 0) {
        await Units.removeUnit(unit);
        if (typeof Gnome !== "undefined") await Gnome.dropHeldBy(unit);
      }
    }
  },

  _stun(g) {
    g.stun = RELIQUIA_STUN_TURNS;
    g.el.classList.add("reliquia-guard--stun");
    this._src(g.imgEl, RELIQUIA_SRC.mareado);
    this._stars(g);
  },

  _clearStun(g) {
    g.el.classList.remove("reliquia-guard--stun");
    this._src(g.imgEl, RELIQUIA_SRC.guardia);
  },

  // Estrellitas girando sobre la cabeza mientras dura el aturdimiento (mismas que Abilities._dizzyStars).
  _stars(g) {
    if (g.starsOn) return;
    g.starsOn = true;
    const R = () => Math.random();
    const stars = [];
    for (let i = 0; i < 4; i++) {
      const sz = 36 + R() * 10, pts = [];
      for (let k = 0; k < 10; k++) {
        const ang = (k / 10) * Math.PI * 2 - Math.PI / 2 + (R() - 0.5) * 0.25;
        const r = (k % 2 ? 4.2 : 10) * (0.8 + R() * 0.4);
        pts.push(`${(12 + Math.cos(ang) * r).toFixed(1)},${(12 + Math.sin(ang) * r).toFixed(1)}`);
      }
      const e = document.createElement("div");
      e.className = "punch-star";
      e.innerHTML = `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24"><polygon points="${pts.join(" ")}" fill="#fbbf24"/></svg>`;
      Units.container.appendChild(e);
      stars.push({ e, ph: (i / 4) * Math.PI * 2, rot: R() * 360 });
    }
    const t0 = performance.now();
    const frame = (t) => {
      if (g.stun <= 0 || !g.el.isConnected) {
        stars.forEach((o) => o.e.remove());
        g.starsOn = false;
        return;
      }
      const c = this._px(g.row, g.col), hidden = g.el.classList.contains("unit--fog-hidden");
      stars.forEach((o) => {
        const a = o.ph + (t - t0) / 380;
        const x = Math.cos(a) * 52, y = Math.sin(a) * 15;
        o.e.style.left = `${c.x + x}px`;
        o.e.style.top = `${c.y - 92 + y}px`;
        o.e.style.zIndex = y > 0 ? "2950" : "1";
        o.e.style.opacity = hidden ? "0" : "1";
        o.e.style.transform = `translate(-50%,-50%) rotate(${o.rot + (t - t0) / 3}deg) scale(${0.85 + 0.2 * Math.sin(a)})`;
      });
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  },

  // ---------- Pegar a un guardia con un gnomo ----------
  _heldGnome(unit) {
    return typeof Gnome !== "undefined" ? Gnome.list.find((x) => x.heldBy === unit.id) || null : null;
  },

  async hitGuard(unit, g) {
    const gnome = this._heldGnome(unit);
    if (!gnome || g.stun > 0 || (typeof Turns !== "undefined" && !Turns.canAct(unit))) return;
    Units.clearRangeOverlays();
    Units.faceTowardsTile(unit, g.row, g.col);
    if (typeof Turns !== "undefined") Turns.useAction(unit);
    if (unit.el) {
      unit.el.classList.remove("unit--punching");
      void unit.spriteEl.offsetWidth;
      unit.el.classList.add("unit--punching");
      setTimeout(() => unit.el && unit.el.classList.remove("unit--punching"), 320);
    }
    this._sfx("hit");
    this._shake(false);
    this._face(g, unit.row, unit.col);
    if (g.imgEl.animate)
      g.imgEl.animate([{ transform: "scale(1,1)" }, { transform: "scale(1.2,.78)", offset: 0.25 }, { transform: "scale(.92,1.1)", offset: 0.6 }, { transform: "scale(1,1)" }], { duration: 420, easing: "cubic-bezier(.2,1.5,.4,1)" });
    this._stun(g);
    if (gnome._addPoints) gnome._addPoints(RELIQUIA_HIT_CHARGE);
    Units.spawnFloatingText(unit, `+${RELIQUIA_HIT_CHARGE}`, { className: "dmg-popup gnome-points-popup" });
    await this._wait(380);
  },

  // ---------- Acercarse y actuar (mismo patrón que GnomOgro) ----------
  _tileOpenForUnit(unit, r, c) {
    if (r < 0 || c < 0 || r >= Units.boardSize || c >= Units.boardSize) return false;
    if (Units.unitAt(r, c)) return false;
    if (typeof Gnome !== "undefined" && Gnome.isAt(r, c)) return false;
    if (typeof Villages !== "undefined" && Villages.at(r, c)) return false;
    if (typeof Shops !== "undefined" && Shops.at(r, c)) return false;
    if (typeof Obelisks !== "undefined" && Obelisks.at(r, c)) return false;
    if (typeof Resources !== "undefined" && Resources.at(r, c)) return false;
    if (typeof Drums !== "undefined" && Drums.at(r, c)) return false;
    if (typeof TerrainMap !== "undefined" && !(typeof Skills !== "undefined" ? Skills.walkableFor(unit.team, r, c) : TerrainMap.isWalkable(r, c))) return false;
    return true;
  },

  _approachTile(unit, tgt) {
    const dist = (r, c) => Math.max(Math.abs(r - tgt.row), Math.abs(c - tgt.col));
    if (dist(unit.row, unit.col) <= 1) return { row: unit.row, col: unit.col };
    const range = Units.moveRangeOf(unit);
    let best = null, bd = Infinity;
    for (let r = tgt.row - 1; r <= tgt.row + 1; r++)
      for (let c = tgt.col - 1; c <= tgt.col + 1; c++) {
        if (dist(r, c) !== 1 || (r === unit.row && c === unit.col)) continue;
        if (!this._tileOpenForUnit(unit, r, c)) continue;
        const md = Math.max(Math.abs(r - unit.row), Math.abs(c - unit.col));
        if (md > range || (typeof Skills !== "undefined" && Skills.moveCost(unit, r, c) > range)) continue;
        if (!Units.pathIsWalkable(unit.row, unit.col, r, c, unit.team)) continue;
        if (md < bd) { bd = md; best = { row: r, col: c }; }
      }
    return best;
  },

  _canReach(unit, tgt) {
    const ap = this._approachTile(unit, tgt);
    if (!ap) return false;
    const needsMove = ap.row !== unit.row || ap.col !== unit.col;
    if (needsMove && typeof Turns !== "undefined" && !(typeof Skills !== "undefined" ? Skills.canApproachAttack(unit) : Turns.remainingActions(unit) >= 2)) return false;
    return true;
  },

  async _approachAnd(unit, tgt, fn) {
    Units.clearRangeOverlays();
    const ap = this._approachTile(unit, tgt);
    if (!ap) return;
    if (ap.row !== unit.row || ap.col !== unit.col) {
      if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
      const path = Units.stepPath(unit.row, unit.col, ap.row, ap.col);
      await Units.walkPath(unit, path);
      if (typeof Skills !== "undefined") Skills.spendApproach(unit);
      else if (typeof Turns !== "undefined") Turns.useAction(unit);
      if (typeof Fog !== "undefined" && unit.team === "player") Fog.revealForUnit(unit);
    }
    if (!Units.list.includes(unit)) return;
    await fn();
    if (Units.list.includes(unit)) Units.refreshRange(unit);
  },

  _marker(row, col, icon, onClick) {
    Units.addMarker({
      className: "attack-marker reliquia-marker",
      row, col, zOffset: 2,
      visibleClass: "attack-marker--visible",
      owner: "reliquia",
      alwaysOnTop: true,
      onClick,
      buildContent: (m) => {
        const i = document.createElement("i");
        i.className = `ph ${icon} attack-marker__icon`;
        m.appendChild(i);
      },
    });
  },

  // Proveedor de rango (Units.registerRangeProvider): marcas sobre los guardias (con un gnomo en la mano)
  // y sobre el altar abierto (para coger la Reliquia).
  showFor(unit) {
    if (!this.altar || !this.relic || this.busy) return;
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    if (this._heldGnome(unit)) {
      this.guards.forEach((g) => {
        if (g.stun > 0 || !this._visible(g) || !this._canReach(unit, g)) return;
        this._marker(g.row, g.col, "ph-crosshair-simple", () => this._approachAnd(unit, g, () => this.hitGuard(unit, g)));
      });
    }
    if (this.relic.state === "altar" && this.altar.hits >= RELIQUIA_HITS_TO_OPEN && !this._carrier() && this._visible(this.altar) && this._canReach(unit, this.altar)) {
      this._marker(this.altar.row, this.altar.col, "ph-hand-grabbing", () => this._approachAnd(unit, this.altar, () => this.takeRelic(unit)));
    }
  },

  // ---------- Lanzar un gnomo al altar ----------
  canThrowAt(unit) {
    if (!this.altar || !this.relic || this.busy || this.altar.hits >= RELIQUIA_HITS_TO_OPEN || !this._visible(this.altar)) return false;
    const d = this._cheb(unit, this.altar);
    return d >= 1 && d <= GNOME_THROW_MAX_RANGE;
  },

  addThrowMarker(unit, gnome) {
    if (!this.canThrowAt(unit)) return;
    Units.addMarker({
      className: "pass-marker reliquia-throw-marker",
      row: this.altar.row, col: this.altar.col, zOffset: 12,
      visibleClass: "pass-marker--visible",
      owner: "gnome", alwaysOnTop: true,
      buildContent: (m) => {
        const i = document.createElement("i");
        i.className = "ph ph-paper-plane-tilt pass-marker__icon";
        i.style.transform = "translateY(-60px)";
        m.appendChild(i);
      },
      onClick: () => this.throwGnome(unit, gnome),
    });
  },

  _landCell(holder) {
    const a = this.altar, cands = [];
    for (let dr = -3; dr <= 3; dr++)
      for (let dc = -3; dc <= 3; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== 3) continue;
        const r = a.row + dr, c = a.col + dc;
        if (r < 0 || c < 0 || r >= Units.boardSize || c >= Units.boardSize) continue;
        const u = Units.unitAt(r, c);
        if (u) {
          if (!Gnome.isHeldBy(u.id)) cands.push({ row: r, col: c, unit: u });
          continue;
        }
        if (this._tileOpenForUnit(holder, r, c)) cands.push({ row: r, col: c });
      }
    if (cands.length) return cands[Math.floor(Math.random() * cands.length)];
    return { row: holder.row, col: holder.col };
  },

  async throwGnome(holder, gnome) {
    if (!this.canThrowAt(holder) || gnome.heldBy !== holder.id || gnome.busy) return;
    if (typeof Turns !== "undefined" && !Turns.canAct(holder)) return;
    const a = this.altar;
    if (typeof Turns !== "undefined") Turns.useAction(holder);
    Units.clearRangeOverlays();
    gnome.passing = false;
    gnome.busy = true;
    gnome.hideBadge();
    this.busy = true;
    try {
      Units.faceTowardsTile(holder, a.row, a.col);
      gnome.row = holder.row;
      gnome.col = holder.col;
      Units.faceTowardsTile(gnome, a.row, a.col);
      if (holder.el) {
        holder.el.classList.remove("unit--throwing");
        void holder.spriteEl.offsetWidth;
        holder.el.classList.add("unit--throwing");
        setTimeout(() => holder.el && holder.el.classList.remove("unit--throwing"), 380);
      }
      gnome.detachFrom();
      gnome.spriteEl.src = GNOME_ASSETS.grita;
      await gnome.animateThrowTo(holder.row, holder.col, a.row, a.col);
      this._sfx("hit");
      this._clang(a);
      await this._hitAltar();
      // Atacar el altar manda a los guardias tras el atacante.
      this.alert = { unitId: holder.id };
      // El gnomo cae cerca del altar (y se queda).
      const cell = this._landCell(holder);
      await gnome.animateThrowTo(a.row, a.col, cell.row, cell.col);
      const catcher = cell.unit && Units.list.includes(cell.unit) && !Gnome.isHeldBy(cell.unit.id) ? cell.unit : null;
      if (catcher) {
        gnome.row = catcher.row;
        gnome.col = catcher.col;
        gnome.attachTo(catcher);
        this._sfx("passSuccess");
      } else {
        await gnome.landAt(cell, { sound: () => this._sfx("gnomeLandSoft") });
        gnome.setDizzy();
      }
    } finally {
      this.busy = false;
      gnome.busy = false;
      if (holder.el && Units.list.includes(holder)) Units.refreshRange(holder);
    }
  },

  _clang(a) {
    if (a.imgEl.animate)
      a.imgEl.animate([{ transform: "scale(1,1)" }, { transform: "scale(1.05,.95)", offset: 0.3 }, { transform: "scale(.98,1.03)", offset: 0.65 }, { transform: "scale(1,1)" }], { duration: 360, easing: "ease-out" });
  },

  // Cada gnomo estrellado rompe una cadena; el tercero desencadena la Reliquia y se puede coger.
  async _hitAltar() {
    const a = this.altar;
    if (a.hits >= RELIQUIA_HITS_TO_OPEN) return;
    a.hits++;
    const { x, y } = this._px(a.row, a.col);
    this._shake(a.hits >= 2);
    if (a.hits === 1) this._setAltar("rompiendo");
    else if (a.hits === 2) this._setAltar("abierto");
    else this._sfx("explosion");
    if (typeof Enmurallado !== "undefined" && Enmurallado.shards) Enmurallado.shards(x, y - 70, a.hits >= 3 ? 16 : 8, { speed: 100, lift: 60, size: 11 });
    if (a.hits >= 2 && a.imgEl.animate)
      a.imgEl.animate([{ transform: "scale(.94,1.06)" }, { transform: "scale(1.07,.93)", offset: 0.4 }, { transform: "scale(1,1)" }], { duration: 480, easing: "cubic-bezier(.2,1.5,.4,1)" });
    this._startWaves(); // las ondas se aceleran
    await this._wait(a.hits >= 3 ? 420 : 260);
  },

  // ---------- Coger y llevar la Reliquia ----------
  _relicAnchor() {
    const { x, y } = this._px(this.altar.row, this.altar.col);
    return { x, y: y - RELIQUIA_RELIC_Y };
  },

  _fly(from, to, ms) {
    const el = document.createElement("img");
    el.src = RELIQUIA_SRC.icono;
    el.className = "reliquia-fly";
    el.style.left = `${from.x}px`;
    el.style.top = `${from.y}px`;
    el.style.zIndex = "6000";
    Units.container.appendChild(el);
    const dx = to.x - from.x, dy = to.y - from.y;
    const a = el.animate(
      [{ transform: "translate(-50%,-50%) scale(1)" }, { transform: `translate(calc(-50% + ${dx / 2}px),calc(-50% + ${dy / 2 - 50}px)) scale(1.2)`, offset: 0.5 }, { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.85)` }],
      { duration: ms, easing: "ease-in-out", fill: "forwards" }
    );
    return a.finished.catch(() => {}).then(() => el.remove());
  },

  async takeRelic(unit) {
    const r = this.relic;
    if (!r || r.state !== "altar" || this.altar.hits < RELIQUIA_HITS_TO_OPEN || this.busy) return;
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    if (this._carrier()) return;
    if (typeof Turns !== "undefined") Turns.useAction(unit);
    Units.clearRangeOverlays();
    this.busy = true;
    try {
      Units.faceTowardsTile(unit, this.altar.row, this.altar.col);
      this._setAltar("vacio");
      this._stopWaves();
      this._sfx("itemPlace");
      const u = this._px(unit.row, unit.col);
      await this._fly(this._relicAnchor(), { x: u.x, y: u.y - 120 }, 520);
      r.state = "carried";
      r.carrier = unit.id;
      r.team = unit.team;
      r.points = 0;
      this._attach(unit);
      this._sfx("passSuccess");
      // Los guardias van a por el portador (ver _chaseTarget).
    } finally {
      this.busy = false;
      if (Units.list.includes(unit)) Units.refreshRange(unit);
    }
  },

  _attach(unit) {
    const r = this.relic;
    if (r.el) r.el.remove();
    const el = document.createElement("div");
    el.className = "reliquia-carried";
    el.innerHTML = `<img src="${RELIQUIA_SRC.icono}" alt="" draggable="false"><b>${r.points}</b>`;
    unit.el.appendChild(el);
    r.el = el;
    r.row = unit.row;
    r.col = unit.col;
  },

  _updateBadge() {
    const r = this.relic;
    if (!r || !r.el) return;
    const b = r.el.querySelector("b");
    if (b) {
      b.textContent = r.points;
      if (b.animate) b.animate([{ transform: "scale(1.5)" }, { transform: "scale(1)" }], { duration: 260, easing: "cubic-bezier(.2,1.6,.4,1)" });
    }
  },

  // Al morir el portador (o perderla por cualquier otro motivo): cae al suelo y pierde los puntos.
  dropAt(row, col) {
    const r = this.relic;
    if (!r || r.state !== "carried") return;
    if (r.el) r.el.remove();
    if (typeof Combat !== "undefined" && Combat._findDryTileNear && typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) {
      const dry = Combat._findDryTileNear(row, col);
      if (dry) { row = dry.row; col = dry.col; }
    }
    r.state = "floor";
    r.carrier = null;
    r.team = null;
    r.points = 0;
    r.row = row;
    r.col = col;
    const el = document.createElement("div");
    el.className = "unit board-item reliquia-floor";
    el.innerHTML = `<img src="${RELIQUIA_SRC.icono}" alt="" draggable="false">`;
    Units.container.appendChild(el);
    const { x, y } = this._px(row, col);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.zIndex = String((row + col) * 10 + 7);
    r.el = el;
    if (el.animate) el.animate([{ scale: "0.3" }, { scale: "1.25", offset: 0.5 }, { scale: "1" }], { duration: 420, easing: "ease-out" });
    this._sfx("hit");
    this.alert = null;
    this.refreshFog();
  },

  // Una unidad pisa una casilla (Units.walkPath, ver el final del archivo): coge la Reliquia del suelo
  // y, si ya la lleva, comprueba la entrega.
  onUnitStep(unit, row, col) {
    const r = this.relic;
    if (!r || !this.altar) return;
    if (r.state === "floor" && r.row === row && r.col === col && !this._carrier()) {
      if (r.el) r.el.remove();
      r.state = "carried";
      r.carrier = unit.id;
      r.team = unit.team;
      r.points = 0;
      this._attach(unit);
      this._sfx("passSuccess");
      Units.spawnFloatingText(unit, "0", { className: "dmg-popup gnome-points-popup" });
    }
    if (r.state === "carried" && r.carrier === unit.id) {
      if (unit.team !== "player" && typeof Fog !== "undefined" && Fog.revealAround) {
        const type = typeof UNIT_TYPES !== "undefined" ? UNIT_TYPES[unit.typeId] : null;
        Fog.revealAround(row, col, (type ? type.percepcion : 1) + 1);
      }
      this.checkDelivery(unit, row, col);
    }
  },

  async checkDelivery(unit, row, col) {
    const r = this.relic;
    if (!r || r.state !== "carried" || r.carrier !== unit.id || r.points < 1 || this._delivering) return;
    const ob = typeof Obelisks !== "undefined" ? Obelisks.byTeam(unit.team) : null;
    if (!ob) return;
    const pr = row == null ? unit.row : row, pc = col == null ? unit.col : col;
    if (Math.max(Math.abs(ob.row - pr), Math.abs(ob.col - pc)) > 1) return;
    this._delivering = true;
    try {
      const pts = r.points;
      if (typeof Glory !== "undefined") Glory.addNow(unit.team, pts);
      Units.spawnFloatingText(unit, `+${pts}`, { className: "dmg-popup gnome-points-popup" });
      this._sfx("glory");
      await this._returnToAltar(unit);
    } finally {
      this._delivering = false;
    }
  },

  // Reinicia el minijuego: la Reliquia vuelve al altar (que se resella) y los guardias se recomponen.
  async _returnToAltar(fromUnit) {
    const r = this.relic;
    const from = fromUnit && fromUnit.el ? (() => { const u = this._px(fromUnit.row, fromUnit.col); return { x: u.x, y: u.y - 120 }; })() : (() => { const u = this._px(r.row, r.col); return { x: u.x, y: u.y - 30 }; })();
    if (r.el) { r.el.remove(); r.el = null; }
    r.state = "altar";
    r.carrier = null;
    r.team = null;
    r.points = 0;
    this.alert = null;
    await this._fly(from, this._relicAnchor(), 700);
    this.altar.hits = 0;
    this._setAltar("sellado");
    this._startWaves();
    this._sfx("itemPlace");
    this._clang(this.altar);
    this._shake(false);
  },

  // Un guardia pisa la Reliquia del suelo: vuelve al altar y se resella.
  async _recover(g) {
    if (this._recovering) return;
    this._recovering = true;
    try {
      this._sfx("passSuccess");
      await this._returnToAltar(null);
    } finally {
      this._recovering = false;
    }
  },
};

// ---------- Enganches con el resto del juego (todos opcionales, sin tocar su código) ----------
if (typeof Units !== "undefined" && Units.registerRangeProvider) Units.registerRangeProvider(Reliquia);
if (typeof Turns !== "undefined") Turns.registerTurnStartListener(Reliquia);

// El altar y los guardias ocupan su casilla igual que un tambor (mismo patrón que el huevo, js/egg.js).
if (typeof Drums !== "undefined" && !Drums._reliquiaPatched) {
  Drums._reliquiaPatched = true;
  const _at = Drums.at;
  Drums.at = function (row, col) {
    return _at.call(this, row, col) || Reliquia.blocks(row, col);
  };
}

// Pisar la casilla de la Reliquia (o llegar junto al obelisco llevándola).
if (typeof Drums !== "undefined" && !Drums._reliquiaStepPatched) {
  Drums._reliquiaStepPatched = true;
  const _step = Drums.onUnitStep;
  Drums.onUnitStep = function (unit, row, col) {
    const r = _step ? _step.apply(this, arguments) : undefined;
    try { Reliquia.onUnitStep(unit, row, col); } catch (e) { console.warn("[Reliquia] paso", e); }
    return r;
  };
}

// Si muere el portador, la Reliquia cae al suelo.
if (typeof Units !== "undefined" && !Units._reliquiaPatched) {
  Units._reliquiaPatched = true;
  const _remove = Units.removeUnit;
  Units.removeUnit = function (unit, opts) {
    try {
      if (Reliquia.relic && Reliquia.relic.state === "carried" && Reliquia.relic.carrier === unit.id) Reliquia.dropAt(unit.row, unit.col);
    } catch (e) { console.warn("[Reliquia] muerte", e); }
    return _remove.apply(this, arguments);
  };
}

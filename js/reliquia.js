/* Gnomore Gnomes — La Reliquia Paranoica (nivel Fortaleza WallForge).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - El Altar de la Reliquia (centro del mapa, sellado con cadenas) y sus 3 guardias inmortales.
     - Los guardias: patrullan el altar al unísono en círculo; se mueven 1 casilla al FINAL de cada turno
       (el de cada bando), pegan 1 de daño y solo se aturden (3 turnos) con un gnomazo: lanzarle un gnomo
       a un guardia lo aturde y carga el gnomo con +5 puntos (no se les puede pegar directamente).
     - Abrir el altar: lanzarle un gnomo cargado con 10 puntos rompe las cadenas (con menos, solo rebota).
       Atacar el altar manda a los guardias tras el atacante hasta que se aleje más de 4 casillas.
     - La Reliquia: quien la coge del altar la lleva sobre la cabeza con 0 puntos; al desencadenarla salen 15
       PÁGINAS flotando en casillas libres al azar (cuando se recoge una sale otra, hasta 30 en total) y cada
       página que pisa el portador le suma +2 puntos. Los guardias van a por él (siempre al portador, sea del
       bando que sea). Si llega a una casilla pegada a su obelisco cobra todos los puntos de Gloria, las
       páginas se desvanecen y el minijuego se reinicia (Reliquia al altar, sellado). Si la pierde (muere), cae al suelo y pierde los puntos: cualquier unidad que la pise la coge;
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
  pagina: RELIQUIA_DIR + "pagina.png",
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
const RELIQUIA_MAX_POINTS = 30; // tope de puntos acumulables
const RELIQUIA_PAGES_MIN = 20; // mínimo de páginas que salen al desencadenar la Reliquia (en mapas grandes salen más, ver _pagesStart)
const RELIQUIA_PAGES_PER_TILES = 9; // una página por cada tantas casillas libres del mapa
const RELIQUIA_PAGES_TOTAL_MULT = 2; // páginas totales = iniciales x esto (al recoger/sacrificar una sale otra hasta llegar a este número)
const RELIQUIA_PAGE_OBELISK_RADIUS = 1; // las páginas nunca salen en casillas adyacentes a un obelisco (Chebyshev)
const RELIQUIA_PAGE_POINTS = 2; // puntos que suma al portador cada página que pisa
const RELIQUIA_FLOAT_Y = 150; // altura de la Reliquia flotando sobre el altar vacío (ya sin cadenas)
const RELIQUIA_RELIC_Y = 93; // altura (px sobre el centro de la casilla) a la que flota la Reliquia sobre el altar

const Reliquia = {
  altar: null, // { row, col, el, imgEl, state: "sellado" | "abierto" | "vacio" }
  guards: [],
  pages: [], // páginas flotando por el mapa: { row, col, el }
  pagesTotal: 40, // tope de páginas de esta partida (se recalcula al liberar la Reliquia)
  pagesSpawned: 0, // páginas que han salido desde que se desencadenó la Reliquia
  relic: null, // { state: "altar" | "carried" | "guard" | "floor", carrier, guard, team, points, row, col, el }
  alert: null, // { unitId }
  base: 0, // giro actual de la patrulla
  busy: false,

  isActive() {
    return typeof LevelAssets !== "undefined" && LevelAssets.current === "wallforge";
  },

  resetAll() {
    if (this.altar && this.altar.el) this.altar.el.remove();
    this.guards.forEach((g) => g.el && g.el.remove());
    this.pages.forEach((p) => p.el && p.el.remove());
    this.pages = [];
    this.pagesSpawned = 0;
    if (this.relic && this.relic.el) this.relic.el.remove();
    this._stopCarrierWaves();
    this._hideFloat();
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
    img.style.animationDelay = `-${(Math.random() * 4).toFixed(2)}s`; // idle desfasado
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
    img.style.animationDelay = `-${(Math.random() * 4).toFixed(2)}s`; // idle desfasado
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
    this._occTrack();
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
    if (this.altar.floatEl) this.altar.floatEl.classList.toggle("unit--fog-hidden", f(this.altar));
    this.guards.forEach((g) => g.el.classList.toggle("unit--fog-hidden", f(g)));
    this.pages.forEach((p) => p.el.classList.toggle("unit--fog-hidden", f(p)));
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
    if (this.relic && (this.relic.state === "floor" || this.relic.state === "guard")) return null; // los guardias van a por la Reliquia
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
    } else if (r.state === "floor" || r.state === "guard") {
      this._relicMission(awake, anims);
    } else {
      this._patrol(awake, anims);
    }
    // Marcha de soldados: solo suena si el jugador ve a algún guardia moverse.
    if (anims.length && this.guards.some((g) => g.stun <= 0 && this._visible(g))) this._sfx("reliquiaMarch");
    await Promise.all(anims);
    if (typeof Fog !== "undefined") Fog.applyVisibility();
  },

  // La Reliquia está en manos de un guardia o en el suelo: el guardia más cercano la recoge y la lleva al altar
  // mientras los otros dos le cubren (y golpean a quien se acerque).
  _relicMission(awake, anims) {
    const r = this.relic;
    let leader = null;
    if (r.state === "guard") leader = awake.includes(r.guard) ? r.guard : null;
    else {
      let bd = Infinity;
      awake.forEach((g) => {
        const d = this._cheb(g, r);
        if (d < bd) { bd = d; leader = g; }
      });
    }
    // Si el portador está aturdido no se mueve (al aturdirse suelta la Reliquia, ver _stun).
    const ref = r.state === "guard" ? r.guard : leader;
    if (leader) {
      if (r.state === "guard") {
        if (this._cheb(leader, this.altar) <= 1) anims.push(this._guardDeliver(leader));
        else {
          const step = this._bfs(leader, (rr, cc) => Math.max(Math.abs(rr - this.altar.row), Math.abs(cc - this.altar.col)) <= 1);
          if (step) anims.push(this._guardStep(leader, step));
        }
      } else {
        const step = this._bfs(leader, (rr, cc) => rr === r.row && cc === r.col);
        if (step) anims.push(this._guardStep(leader, step));
      }
    }
    awake.forEach((g) => {
      if (g === leader || !ref) return;
      if (this._cheb(g, ref) <= 1) {
        const foe = Units.list.find((u) => this._cheb(g, u) <= 1);
        if (foe) anims.push(this._guardHit(g, foe));
        return;
      }
      const step = this._bfs(g, (rr, cc) => Math.max(Math.abs(rr - ref.row), Math.abs(cc - ref.col)) <= 1);
      if (step) anims.push(this._guardStep(g, step));
    });
  },

  // Un guardia pisa la Reliquia del suelo: se la echa a la cabeza y la lleva de vuelta al altar.
  _guardTake(g) {
    const r = this.relic;
    if (!r || r.state !== "floor") return;
    if (r.el) { r.el.remove(); r.el = null; }
    r.state = "guard";
    r.guard = g;
    r.carrier = null;
    r.team = null;
    r.points = 0;
    const el = document.createElement("div");
    el.className = "reliquia-carried reliquia-carried--guard";
    el.innerHTML = `<img src="${RELIQUIA_SRC.icono}" alt="" draggable="false">`;
    g.el.appendChild(el);
    r.el = el;
    r.row = g.row;
    r.col = g.col;
    this._sfx("passSuccess");
  },

  // El guardia portador llega al altar: la Reliquia vuelve, el altar se resella y la patrulla se recompone.
  async _guardDeliver(g) {
    const r = this.relic;
    if (!r || r.state !== "guard" || r.guard !== g || this._recovering) return;
    this._recovering = true;
    try {
      r.guard = null;
      await this._returnToAltar(g);
    } finally {
      this._recovering = false;
    }
  },

  // Reinicio del minijuego: cada guardia se desvanece, reaparece en su puesto inicial del círculo (sin aturdimiento).
  async _resetGuards() {
    const fade = (g, to, ms) => g.el.animate && g.el.animate([{ opacity: to ? 0 : 1, scale: to ? "0.6" : "1" }, { opacity: to ? 1 : 0, scale: to ? "1" : "0.6" }], { duration: ms, easing: "ease-in-out", fill: "forwards" }).finished.catch(() => {});
    await Promise.all(this.guards.map((g) => fade(g, false, 360)));
    this.base = 0;
    const ring = this._ring();
    this.guards.forEach((g) => {
      const c = ring[g.off % ring.length];
      g.row = c.row;
      g.col = c.col;
      if (g.stun > 0) { g.stun = 0; this._clearStun(g); }
      g.imgEl.style.scale = "1 1";
      g.flip = false;
      this._place(g);
    });
    if (typeof Fog !== "undefined" && Fog.applyVisibility) Fog.applyVisibility();
    await Promise.all(this.guards.map((g) => fade(g, true, 420)));
    this.guards.forEach((g) => g.el.getAnimations && g.el.getAnimations().forEach((a) => a.cancel()));
    this.refreshFog();
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
    if (r && r.state === "floor" && r.row === g.row && r.col === g.col && !this._carrier()) this._guardTake(g);
    else if (r && r.state === "guard" && r.guard === g) {
      r.row = g.row;
      r.col = g.col;
      if (this._cheb(g, this.altar) <= 1) await this._guardDeliver(g);
    }
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
    // Un guardia portador mareado suelta la Reliquia (a los jugadores portadores no les pasa).
    if (this.relic && this.relic.state === "guard" && this.relic.guard === g) this.dropAt(g.row, g.col);
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
        o.e.style.top = `${c.y - 112 + y}px`;
        o.e.style.zIndex = y > 0 ? "2950" : "1";
        o.e.style.opacity = hidden ? "0" : "1";
        o.e.style.transform = `translate(-50%,-50%) rotate(${o.rot + (t - t0) / 3}deg) scale(${0.85 + 0.2 * Math.sin(a)})`;
      });
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  },

  _heldGnome(unit) {
    return typeof Gnome !== "undefined" ? Gnome.list.find((x) => x.heldBy === unit.id) || null : null;
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

  _marker(row, col, icon, onClick, overlayEl, extraClass) {
    const mk = Units.addMarker({
      className: "attack-marker reliquia-marker" + (extraClass ? " " + extraClass : ""),
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
    if (overlayEl) {
      mk._overlayFor = overlayEl; // icono también sobre el sprite (Units._addAttackOverlays)
      if (extraClass) { mk._overlayIcon = icon; mk._overlayClass = extraClass + "-overlay"; mk._overlayY = RELIQUIA_FLOAT_Y; } // el icono va pegado a la Reliquia flotante
    }
  },

  // Proveedor de rango (Units.registerRangeProvider): marcas sobre los guardias (con un gnomo en la mano)
  // y sobre el altar abierto (para coger la Reliquia).
  showFor(unit) {
    if (!this.altar || !this.relic || this.busy) return;
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    // A los guardias NO se les pega: solo se marean lanzándoles un gnomo (ver _throwTargets).
    if (this.relic.state === "altar" && this.altar.hits >= RELIQUIA_HITS_TO_OPEN && !this._carrier() && this._visible(this.altar) && this._canReach(unit, this.altar)) {
      // Mano de coger AMARILLA (como el pico de recolectar) en la loseta y sobre la Reliquia que flota.
      this._marker(this.altar.row, this.altar.col, "ph-hand-grabbing", () => this._approachAnd(unit, this.altar, () => this.takeRelic(unit)), this.altar.el, "reliquia-grab-marker");
    }
  },

  // ---------- IA (js/turns.js la llama al principio de _aiActOnce) ----------
  // Devuelve true si la unidad hizo algo. Solo unos pocos de cada equipo se ocupan de la Reliquia
  // para que el resto siga con su economía: el más cercano al altar/Reliquia y, si lleva un gnomo, el que lo lanza.
  _aiGoer(unit) {
    const r = this.relic;
    const tgt = r.state === "carried" ? this._carrier() : r.state === "floor" ? r : this.altar;
    if (!tgt) return false;
    const mates = Units.list.filter((u) => u.team === unit.team && u.el);
    mates.sort((a, b) => this._cheb(a, tgt) - this._cheb(b, tgt) || String(a.id).localeCompare(String(b.id)));
    const n = r.state === "carried" && r.team !== unit.team ? 2 : 1; // cazar al portador rival: dos unidades
    return mates.slice(0, n).some((u) => u.id === unit.id);
  },

  async aiAct(unit) {
    const r = this.relic;
    if (!this.altar || !r || this.busy || !this.isActive()) return false;
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return false;
    const T = Turns;
    const go = async (target, byPath) => {
      const d = (byPath && T._aiPickMoveTileByPath(unit, target)) || T._aiPickMoveTileToward(unit, target);
      if (!d) return false;
      await Movement.moveTo(unit, d.row, d.col);
      return true;
    };
    const held = this._heldGnome(unit);

    // 1) Portador: recoger páginas cercanas y entregar en su obelisco.
    if (r.state === "carried" && r.carrier === unit.id) {
      const ob = typeof Obelisks !== "undefined" ? Obelisks.byTeam(unit.team) : null;
      if (ob && this._cheb(unit, ob) <= 1 && r.points >= 1) { await this.checkDelivery(unit, unit.row, unit.col); return true; }
      const near = this.pages
        .filter((p) => this._cheb(unit, p) <= 5)
        .sort((a, b) => this._cheb(unit, a) - this._cheb(unit, b))[0];
      if (near && r.points < 6 && (await go(near, true))) return true;
      if (ob && r.points >= 1 && (await go(ob, true))) return true;
      const any = this.pages.slice().sort((a, b) => this._cheb(unit, a) - this._cheb(unit, b))[0];
      if (any && (await go(any, true))) return true;
      return false;
    }
    if (!this._aiGoer(unit)) return false;

    // 2) Reliquia libre en el altar: cogerla.
    if (r.state === "altar" && this.altar.hits >= RELIQUIA_HITS_TO_OPEN && !this._carrier()) {
      if (this._canReach(unit, this.altar)) { await this._approachAnd(unit, this.altar, () => this.takeRelic(unit)); return true; }
      return go(this.altar, true);
    }
    // 3) Reliquia en el suelo: ir a por ella.
    if (r.state === "floor" && !this._carrier()) return go(r, true);
    // 4) Portador rival: ir a por él (el ataque normal lo remata al llegar).
    const carrier = this._carrier();
    if (carrier && carrier.team !== unit.team) {
      if (typeof Combat !== "undefined" && Combat.attackableEnemies(unit).some((e) => e.target === carrier)) {
        await Combat.approachAndAttack(unit, carrier);
        return true;
      }
      return go(carrier, true);
    }
    // 5) Altar sellado: llevar un gnomo y lanzarlo para romper las cadenas.
    if (r.state === "altar" && this.altar.hits < RELIQUIA_HITS_TO_OPEN) {
      if (held) {
        if (this._throwTargets(unit).includes(this.altar)) { await this.throwGnome(unit, held, this.altar); return true; }
        return go(this.altar, true);
      }
    }
    return false;
  },

  // ---------- Lanzar un gnomo al altar ----------
  // Objetivos a los que se puede lanzar un gnomo: el altar (mientras queden cadenas) y los guardias despiertos.
  _throwTargets(unit) {
    if (!this.altar || !this.relic || this.busy) return [];
    const inRange = (o) => {
      const d = this._cheb(unit, o);
      return d >= 1 && d <= GNOME_THROW_MAX_RANGE && this._visible(o);
    };
    const out = [];
    if (this.altar.hits < RELIQUIA_HITS_TO_OPEN && inRange(this.altar)) out.push(this.altar);
    this.guards.forEach((g) => { if (g.stun <= 0 && inRange(g)) out.push(g); });
    // Páginas: se pueden sacrificar gnomos en ellas mientras alguien lleve la Reliquia (ver _sacrificeOnPage).
    if (this._carrier()) this.pages.forEach((pg) => { if (inRange(pg)) out.push(pg); });
    return out;
  },

  canThrowAt(unit) {
    return this._throwTargets(unit).length > 0;
  },

  addThrowMarker(unit, gnome) {
    this._throwTargets(unit).forEach((t) => {
      Units.addMarker({
        className: "pass-marker reliquia-throw-marker",
        row: t.row, col: t.col, zOffset: 12,
        visibleClass: "pass-marker--visible",
        owner: "gnome", alwaysOnTop: true,
        buildContent: (m) => {
          const i = document.createElement("i");
          i.className = "ph ph-paper-plane-tilt pass-marker__icon";
          // El icono va en el CENTRO del sprite (altar: ancla al 82,5 % de su alto; guardia: al 88 %).
          // La mira normal está centrada 45 px por encima del centro de la casilla.
          if (this.pages.includes(t)) { i.style.transform = "translateY(-6px)"; } // la página flota ~50 px sobre la casilla
          else {
          const h = t.el.offsetHeight || (t === this.altar ? RELIQUIA_ALTAR_H : 170);
          i.style.transform = `translateY(${Math.round(45 - ((t === this.altar ? 0.825 : 0.88) - 0.5) * h)}px)`;
          }
          m.appendChild(i);
        },
        onClick: () => this.throwGnome(unit, gnome, t),
      });
    });
  },

  _landCell(holder, center) {
    const a = center || this.altar, cands = [];
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

  async throwGnome(holder, gnome, target) {
    target = target || this.altar;
    if (!this._throwTargets(holder).includes(target) || gnome.heldBy !== holder.id || gnome.busy) return;
    if (typeof Turns !== "undefined" && !Turns.canAct(holder)) return;
    const a = target;
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
      if (this.pages.includes(a)) {
        await this._sacrificeOnPage(holder, gnome, a);
        return;
      }
      if (a === this.altar) {
        this._clang(a);
        await this._hitAltar();
        // Atacar el altar manda a los guardias tras el atacante.
        this.alert = { unitId: holder.id };
      } else {
        // Gnomazo a un guardia: se queda aturdido y el gnomo se carga.
        this._shake(false);
        if (a.imgEl.animate) a.imgEl.animate([{ transform: "scale(1,1)" }, { transform: "scale(1.2,.78)", offset: 0.25 }, { transform: "scale(.92,1.1)", offset: 0.6 }, { transform: "scale(1,1)" }], { duration: 420, easing: "cubic-bezier(.2,1.5,.4,1)" });
        this._stun(a);
        if (gnome._addPoints) gnome._addPoints(RELIQUIA_HIT_CHARGE);
        Units.spawnFloatingText(holder, `+${RELIQUIA_HIT_CHARGE}`, { className: "dmg-popup gnome-points-popup" });
        await this._wait(300);
      }
      // El gnomo cae cerca del altar (y se queda).
      const cell = this._landCell(holder, a);
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

  // ---------- Sacrificio en una página ----------
  // El gnomo lanzado se deshace en ceniza sobre la página (desaparece entero); la página se consume y el portador de la
  // Reliquia gana +2 si es de tu bando (el de quien lanza) o pierde 2 si es rival. Sale otra página en otro sitio.
  async _sacrificeOnPage(holder, gnome, page) {
    const carrier = this._carrier(), r = this.relic;
    const ally = !!carrier && carrier.team === holder.team;
    this.pages = this.pages.filter((p) => p !== page);
    const img = await this._loadImg(GNOME_ASSETS.grita);
    const { x, y } = this._px(page.row, page.col);
    gnome.el.style.display = "none";
    const W = 93, H = Math.round(W * (img.naturalHeight / img.naturalWidth));
    const cx = x - W / 2, cy = y - 50 - H / 2;
    this._shake(false);
    if (page.el.animate) page.el.animate([{ scale: "1" }, { scale: "1.35 .7", offset: 0.25 }, { scale: ".92 1.12", offset: 0.55 }, { scale: "1" }], { duration: 480, easing: "cubic-bezier(.2,1.5,.4,1)" });
    await this._ashGnome(img, cx, cy, W, H, (y + 20));
    if (carrier && r && r.state === "carried") {
      const before = r.points;
      r.points = Math.max(0, Math.min(RELIQUIA_MAX_POINTS, before + (ally ? RELIQUIA_PAGE_POINTS : -RELIQUIA_PAGE_POINTS)));
      this._updateBadge();
      const d = r.points - before;
      if (d) Units.spawnFloatingText(carrier, d > 0 ? `+${d}` : `${d}`, { className: "dmg-popup gnome-points-popup" });
      this._sfx(ally ? "passSuccess" : "hit");
    }
    const el = page.el;
    if (el.animate) el.animate([{ scale: "1", opacity: 1 }, { scale: "1.5", opacity: 0 }], { duration: 260, easing: "ease-out", fill: "forwards" }).finished.catch(() => {}).then(() => el.remove());
    else el.remove();
    if (typeof Gnome !== "undefined" && Gnome.list.includes(gnome)) Gnome.destroyInstance(gnome);
    if (this.pagesSpawned < this.pagesTotal) setTimeout(() => { if (this.altar && this.relic && this.relic.state !== "altar") this._spawnPages(1); }, 450);
  },

  _loadImg(src) {
    return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(im); im.src = src; });
  },

  // Ceniza: el sprite del gnomo se deshace de izquierda a derecha en el viento, sin dejar nada.
  _ashGnome(img, left, top, W, H, z) {
    const CW = 252, CH = Math.round(CW * (img.naturalHeight / img.naturalWidth)), B = 3;
    const sc = document.createElement("canvas");
    sc.width = CW; sc.height = CH;
    const sx = sc.getContext("2d", { willReadFrequently: true });
    sx.drawImage(img, 0, 0, CW, CH);
    const data = sx.getImageData(0, 0, CW, CH).data;
    const px = [];
    for (let y = 0; y < CH; y += B) for (let x = 0; x < CW; x += B) {
      const i = ((y + 1) * CW + x + 1) * 4;
      if (data[i + 3] > 140) px.push({ x, y, c: `rgb(${data[i]},${data[i + 1]},${data[i + 2]})` });
    }
    const rnd = (a, b) => a + Math.random() * (b - a);
    px.forEach((p) => { p.t = (p.x / CW) * 0.62 + rnd(0, 0.16); p.vx = rnd(70, 200); p.vy = rnd(-110, 20); p.s = rnd(0.5, 1); });
    const cv = document.createElement("canvas");
    cv.width = CW; cv.height = CH;
    cv.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${W}px;height:${H}px;pointer-events:none;z-index:${5000}`;
    Units.container.appendChild(cv);
    const x = cv.getContext("2d");
    return new Promise((resolve) => {
      const t0 = performance.now(), D = 2400;
      const f = (now) => {
        const k = Math.min(1, (now - t0) / D), T = k * 1.55;
        x.clearRect(0, 0, CW, CH);
        px.forEach((p) => {
          if (T < p.t) { x.fillStyle = p.c; x.fillRect(p.x, p.y, B, B); return; }
          const q = T - p.t;
          if (q > 1) return;
          x.globalAlpha = Math.max(0, 1 - q);
          x.fillStyle = q < 0.25 ? p.c : "#8d8478";
          const sz = B * p.s * (1 - q * 0.5) + 1;
          x.fillRect(p.x + p.vx * q * 0.9, p.y + p.vy * q + q * q * 40, sz, sz);
          x.globalAlpha = 1;
        });
        if (k < 1) requestAnimationFrame(f);
        else { cv.remove(); resolve(); }
      };
      requestAnimationFrame(f);
    });
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
    else {
      this._sfx("explosion");
      this._setAltar("vacio"); // sin cadenas: altar vacío y la Reliquia flotando encima
      this._stopWaves();
      this._showFloat();
      this._spawnPages(this._pagesStart()); // la Reliquia se libera: salen las páginas por todo el mapa
    }
    if (typeof Enmurallado !== "undefined" && Enmurallado.shards) Enmurallado.shards(x, y - 70, a.hits >= 3 ? 16 : 8, { speed: 100, lift: 60, size: 11 });
    if (a.hits >= 2 && a.imgEl.animate)
      a.imgEl.animate([{ transform: "scale(.94,1.06)" }, { transform: "scale(1.07,.93)", offset: 0.4 }, { transform: "scale(1,1)" }], { duration: 480, easing: "cubic-bezier(.2,1.5,.4,1)" });
    if (a.hits < RELIQUIA_HITS_TO_OPEN) this._startWaves(); // las ondas se aceleran
    await this._wait(a.hits >= 3 ? 420 : 260);
  },

  // ---------- Páginas de la Reliquia ----------
  _pageAt(row, col) {
    return this.pages.find((p) => p.row === row && p.col === col) || null;
  },

  _pageTileOk(r, c) {
    const size = Units.boardSize;
    if (r < 0 || c < 0 || r >= size || c >= size) return false;
    if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(r, c)) return false;
    if (this.altar && Math.max(Math.abs(r - this.altar.row), Math.abs(c - this.altar.col)) <= RELIQUIA_RING) return false;
    if (typeof Obelisks !== "undefined" && Obelisks.list.some((o) => Math.max(Math.abs(r - o.row), Math.abs(c - o.col)) <= RELIQUIA_PAGE_OBELISK_RADIUS)) return false;
    if (this._pageAt(r, c)) return false;
    if (Units.unitAt(r, c)) return false;
    if (typeof Gnome !== "undefined" && Gnome.isAt(r, c)) return false;
    if (typeof Villages !== "undefined" && Villages.at(r, c)) return false;
    if (typeof Shops !== "undefined" && Shops.at(r, c)) return false;
    if (typeof Obelisks !== "undefined" && Obelisks.at(r, c)) return false;
    if (typeof Resources !== "undefined" && Resources.at(r, c)) return false;
    if (typeof Oracle !== "undefined" && Oracle.at && Oracle.at(r, c)) return false;
    if (typeof Bushes !== "undefined" && Bushes.at && Bushes.at(r, c)) return false;
    if (typeof Drums !== "undefined" && Drums.at(r, c)) return false;
    return true;
  },

  // Cuántas páginas salen al empezar: crece con el tamaño del mapa (casillas libres de páginas).
  _pagesStart() {
    const size = Units.boardSize;
    let free = 0;
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (this._pageTileOk(r, c)) free++;
    const n = Math.max(RELIQUIA_PAGES_MIN, Math.round(free / RELIQUIA_PAGES_PER_TILES));
    this.pagesTotal = n * RELIQUIA_PAGES_TOTAL_MULT;
    return n;
  },

  // Hace salir n páginas en casillas libres al azar (sin pasarse de las 30 totales).
  _spawnPages(n) {
    const size = Units.boardSize, cells = [];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (this._pageTileOk(r, c)) cells.push({ row: r, col: c });
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    const count = Math.min(n, this.pagesTotal - this.pagesSpawned, cells.length);
    // Repartidas por todo el mapa: se prefieren casillas lejos de las demás páginas (separación 4, 3, 2...).
    const chosen = [];
    const all = this.pages.concat(chosen);
    for (const sep of [4, 3, 2, 1, 0]) {
      for (const cl of cells) {
        if (chosen.length >= count) break;
        if (chosen.includes(cl)) continue;
        if (all.concat(chosen).some((p) => Math.max(Math.abs(p.row - cl.row), Math.abs(p.col - cl.col)) < sep)) continue;
        chosen.push(cl);
      }
      if (chosen.length >= count) break;
    }
    chosen.forEach((cl, i) => this._createPage(cl.row, cl.col, i * 70));
    const made = chosen.length;
    this.pagesSpawned += made;
    this.refreshFog();
  },

  _createPage(row, col, delay) {
    const el = document.createElement("div");
    el.className = "unit board-item reliquia-page";
    el.style.setProperty("--pd", `-${(Math.random() * 2.8).toFixed(2)}s`); // cada página va desfasada
    el.innerHTML = '<div class="reliquia-page__floor"></div><div class="reliquia-page__ring"></div><div class="reliquia-page__ring"></div><div class="reliquia-page__ring"></div>' +
      '<div class="reliquia-page__fly"><div class="reliquia-page__halo"></div><img alt="" draggable="false"></div>';
    this._src(el.querySelector("img"), RELIQUIA_SRC.pagina);
    Units.container.appendChild(el);
    const { x, y } = this._px(row, col);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.zIndex = String((row + col) * 10 + 7);
    this.pages.push({ row, col, el });
    if (el.animate) el.animate([{ scale: "0.2", opacity: 0 }, { scale: "1.25", opacity: 1, offset: 0.6 }, { scale: "1", opacity: 1 }], { duration: 420, delay: delay || 0, easing: "ease-out", fill: "backwards" });
  },

  // El portador pisa una casilla: si hay una página, la recoge (+2 puntos) y sale otra en otro sitio.
  _collectPageAt(unit, row, col) {
    const r = this.relic, page = this._pageAt(row, col);
    if (!page || !r || r.state !== "carried" || r.carrier !== unit.id) return;
    this.pages = this.pages.filter((p) => p !== page);
    const gain = Math.min(RELIQUIA_PAGE_POINTS, RELIQUIA_MAX_POINTS - r.points);
    r.points += gain;
    this._updateBadge();
    Units.spawnFloatingText(unit, `+${gain}`, { className: "dmg-popup gnome-points-popup" });
    this._sfx("passSuccess");
    const el = page.el;
    if (el.animate) el.animate([{ scale: "1", opacity: 1 }, { scale: "1.5", opacity: 0 }], { duration: 260, easing: "ease-out", fill: "forwards" }).finished.catch(() => {}).then(() => el.remove());
    else el.remove();
    if (this.pagesSpawned < this.pagesTotal) setTimeout(() => { if (this.altar && this.relic && this.relic.state !== "altar") this._spawnPages(1); }, 450);
  },

  _clearPages() {
    const old = this.pages;
    this.pages = [];
    this.pagesSpawned = 0;
    old.forEach((p) => {
      const el = p.el;
      if (el.animate) el.animate([{ scale: "1", opacity: 1 }, { scale: "0.3", opacity: 0 }], { duration: 380, easing: "ease-in", fill: "forwards" }).finished.catch(() => {}).then(() => el.remove());
      else el.remove();
    });
  },

  // ---------- Coger y llevar la Reliquia ----------
  _relicAnchor(open) {
    const { x, y } = this._px(this.altar.row, this.altar.col);
    return { x, y: y - (open ? RELIQUIA_FLOAT_Y : RELIQUIA_RELIC_Y) };
  },

  // Altar sin cadenas: la Reliquia flota sobre el altar vacío esperando a que alguien la coja.
  _showFloat() {
    this._hideFloat();
    const a = this.altar;
    if (!a) return;
    const el = document.createElement("div");
    el.className = "unit board-item reliquia-floatrelic";
    el.innerHTML = `<img src="${RELIQUIA_SRC.icono}" alt="" draggable="false">`;
    const { x, y } = this._px(a.row, a.col);
    el.style.left = `${x}px`;
    el.style.top = `${y - RELIQUIA_FLOAT_Y}px`;
    el.style.zIndex = String((a.row + a.col) * 10 + 8);
    Units.container.appendChild(el);
    a.floatEl = el;
    if (el.animate) el.animate([{ scale: "0.4", opacity: 0 }, { scale: "1.15", opacity: 1, offset: 0.55 }, { scale: "1", opacity: 1 }], { duration: 520, easing: "ease-out" });
    this.refreshFog();
  },

  _hideFloat() {
    const a = this.altar;
    if (a && a.floatEl) { a.floatEl.remove(); a.floatEl = null; }
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
      this._hideFloat();
      this._sfx("itemPlace");
      const u = this._px(unit.row, unit.col);
      await this._fly(this._relicAnchor(true), { x: u.x, y: u.y - 120 }, 520);
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

  // ---------- Transparencia de los guardias (igual que rocas, árboles, tótems...) ----------
  // Si una unidad queda detrás de un guardia, este se vuelve semitransparente (y deja pasar el ratón) mientras el puntero esté
  // sobre él o sobre quien hay detrás, para poder seleccionarla.
  _GUARD_OCC_OFFSETS: [[-1, -1], [-1, 0], [0, -1], [-2, -2]],
  _occTrack() {
    if (this._occReady) return;
    this._occReady = true;
    window.addEventListener("mousemove", (e) => { this._mx = e.clientX; this._my = e.clientY; this.refreshOcclusion(e.clientX, e.clientY); });
    const tc = (e) => { const t = e.touches && e.touches[0]; if (!t) return; this._mx = t.clientX; this._my = t.clientY; this.refreshOcclusion(t.clientX, t.clientY); };
    window.addEventListener("touchstart", tc, { passive: true });
    window.addEventListener("touchmove", tc, { passive: true });
  },
  refreshOcclusion(mouseX, mouseY) {
    this._occTrack();
    const mx = typeof mouseX === "number" ? mouseX : this._mx, my = typeof mouseY === "number" ? mouseY : this._my;
    this.guards.forEach((g) => {
      if (!g.el) return;
      if (g.el.classList.contains("unit--fog-hidden") || mx == null || my == null) { g.el.classList.remove("reliquia-guard--occluding"); return; }
      const behind = Units.list.filter((u) => u.el && !u.el.classList.contains("unit--fog-hidden") && this._GUARD_OCC_OFFSETS.some(([dr, dc]) => u.row === g.row + dr && u.col === g.col + dc));
      let occ = false;
      if (behind.length) {
        const r0 = (g.imgEl || g.el).getBoundingClientRect();
        const overG = mx >= r0.left && mx <= r0.right && my >= r0.top && my <= r0.bottom;
        const overB = behind.some((u) => { const r = (u.spriteEl || u.el).getBoundingClientRect(); return mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom; });
        occ = overG || overB;
      }
      g.el.classList.toggle("reliquia-guard--occluding", occ);
    });
  },

  _attach(unit) {
    const r = this.relic;
    if (r.el) r.el.remove();
    const el = document.createElement("div");
    el.className = "reliquia-carried";
    el.innerHTML = `<img src="${RELIQUIA_SRC.icono}" alt="" draggable="false"><b><span>${r.points}</span></b>`;
    unit.el.appendChild(el);
    r.el = el;
    r.row = unit.row;
    r.col = unit.col;
    this._startCarrierWaves(unit);
  },

  // Ondas en los pies del portador (detrás del sprite): se ve a simple vista quién lleva la Reliquia.
  _startCarrierWaves(unit) {
    this._stopCarrierWaves();
    if (!unit.el) return;
    const box = document.createElement("div");
    box.className = "reliquia-waves reliquia-waves--carrier";
    unit.el.appendChild(box);
    this._cwBox = box;
    const tick = () => {
      if (!box.isConnected || this._carrier() !== unit) { this._stopCarrierWaves(); return; }
      if (document.hidden) return;
      const w = document.createElement("div");
      w.className = "reliquia-wave";
      box.appendChild(w);
      const an = w.animate(
        [{ width: "110px", height: "60px", opacity: 0.95, borderWidth: "7px" }, { width: "560px", height: "310px", opacity: 0, borderWidth: "2px" }],
        { duration: 2100, easing: "ease-out", fill: "forwards" }
      );
      an.onfinish = () => w.remove();
    };
    tick();
    this._cwT = setInterval(tick, 1300);
  },

  _stopCarrierWaves() {
    if (this._cwT) clearInterval(this._cwT);
    this._cwT = 0;
    if (this._cwBox) this._cwBox.remove();
    this._cwBox = null;
  },

  _updateBadge() {
    const r = this.relic;
    if (!r || !r.el) return;
    const b = r.el.querySelector("b span");
    if (b) {
      b.textContent = r.points;
      if (b.animate) b.animate([{ transform: "scale(1.5)" }, { transform: "scale(1)" }], { duration: 260, easing: "cubic-bezier(.2,1.6,.4,1)" });
    }
  },

  // Al morir el portador (o perderla por cualquier otro motivo): cae al suelo y pierde los puntos.
  dropAt(row, col) {
    const r = this.relic;
    if (!r || (r.state !== "carried" && r.state !== "guard")) return;
    if (r.el) r.el.remove();
    if (typeof Combat !== "undefined" && Combat._findDryTileNear && typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) {
      const dry = Combat._findDryTileNear(row, col);
      if (dry) { row = dry.row; col = dry.col; }
    }
    r.state = "floor";
    r.carrier = null;
    r.guard = null;
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
      this._collectPageAt(unit, row, col);
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
      if (typeof Glory !== "undefined") {
        Glory.addNow(unit.team, pts);
        if (Glory.stealNow) Glory.stealNow(unit.team, pts); // los rivales pierden lo mismo
      }
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
    r.guard = null;
    r.team = null;
    r.points = 0;
    this.alert = null;
    this._hideFloat();
    this._clearPages(); // el minijuego se reinicia: las páginas se desvanecen
    const guardsBack = this._resetGuards(); // los soldados se desvanecen y vuelven a sus posiciones iniciales
    await this._fly(from, this._relicAnchor(), 700);
    await guardsBack;
    this.altar.hits = 0;
    this._setAltar("sellado");
    this._startWaves();
    this._sfx("itemPlace");
    this._clang(this.altar);
    this._shake(false);
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

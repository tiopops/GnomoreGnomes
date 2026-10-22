/* Gnomore Gnomes — Sacrificios de gnomos.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe: matar a un
   gnomo de una de estas 8 formas, con su animación (todas aprobadas con demo,
   humor negro, sin textos de gritos, sprites a su tamaño real), cobrar la
   Gloria instantánea y hacer aparecer un gnomo nuevo en una zona aleatoria.

     1. Volcán         — lanzar el gnomo al cráter (js/volcano.js delega aquí).
     2. Charco de lava — lanzarlo a un charco de lava de una erupción.
     3. Agua           — lanzarlo a una casilla de agua.
     4. Seta explosiva — lanzarlo a una seta suelta.
     5. Piedra         — piedra de Rock'n Troll desde la mochila contra un gnomo suelto.
     6. Cepo           — lanzarlo contra un cepo AtrapaPinreles colocado en el tablero.
     7. Cohete         — KataPum! contra un gnomo suelto.
     8. Bumper         — lanzarlo al agujero de un bumper del pinball (HurryCrane): sangre a presión y humo.

   Gloria: SACRIFICE_GLORY (3) al instante (Glory.addNow). Ver el razonamiento
   del 3 frente al 5 junto a la constante.

   Todo se dibuja en Units.container con coordenadas de tablero (getTileCenter),
   así que se mueve y hace zoom con la cámara. Las medidas de las demos (960×540)
   se pasan a píxeles de juego con SAC_K. */

// 3 y no 5: el gnomo es un recurso que se regenera solo (siempre vuelve a aparecer
// uno suelto), así que un sacrificio cuesta como mucho 2 acciones (coger + lanzar)
// y aun así sale gratis. Con 3 vale lo mismo que el objeto más barato de la
// Tienda Goblin y 1,5 turnos de ingreso base (2/turno): una buena jugada, no una
// máquina de dinero. Con 5 un solo gnomo por turno pagaría casi cualquier compra
// (3–6) y haría inútil el resto de fuentes de Gloria.
const SACRIFICE_GLORY = 3;
// Un gnomo "cargado" (con puntos acumulados) vale más al sacrificarlo, sin exagerar:
// 10 o más puntos: +5; 5 a 9: +4; el resto: +3.
function sacrificeValue(gnome) {
  const p = gnome && gnome.points ? gnome.points : 0;
  if (p >= 10) return 5;
  if (p >= 5) return 4;
  return SACRIFICE_GLORY;
}
const SAC_K = 74 / 165; // gnomo en el suelo: 74 px en el juego, 165 px en las demos
const SAC_W = { ground: 74, fly: 93, sit: 78, fire: 110 };
// Gorro: esquina superior izquierda del sprite en reposo (mismas proporciones que la demo).
const SAC_HAT = { w: 74 * (83 / 165), h: 74 * (45 / 165), bg: 74 * (113 / 165) };

const Sacrifice = {
  busy: 0,
  _els: [],
  _vals: [],

  resetAll() {
    this._els.forEach((e) => e.isConnected && e.remove());
    this._els = [];
    this._vals = [];
    this.busy = 0;
  },

  // ---------- utilidades ----------
  _sleep(ms) { return new Promise((r) => setTimeout(r, ms)); },
  _raf(dur, fn) {
    return new Promise((res) => {
      const t0 = performance.now();
      const f = (n) => {
        const t = Math.min(1, (n - t0) / dur);
        fn(t);
        if (t < 1) requestAnimationFrame(f); else res();
      };
      requestAnimationFrame(f);
    });
  },
  _ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
  _snd(name, ...a) { if (typeof SFX !== "undefined" && typeof SFX[name] === "function") SFX[name](...a); },
  _add(el, z) {
    el.style.zIndex = String(z);
    el.style.pointerEvents = "none";
    Units.container.appendChild(el);
    this._els.push(el);
    return el;
  },
  _rm(el) { if (el) el.remove(); this._els = this._els.filter((e) => e !== el && e.isConnected); },
  _tile(row, col) { return getTileCenter(row, col, Units.boardSize); },
  _z(row, col) { return (row + col) * 10 + 12; },

  // Actor: el gnomo (o la pieza) que se anima. div anclado a los pies + img.
  _actor(z, src, w, cx, bottom) {
    const d = document.createElement("div");
    d.className = "sac-actor";
    const img = document.createElement("img");
    img.draggable = false;
    img.alt = "";
    d.appendChild(img);
    this._add(d, z);
    const a = {
      d, img,
      put: (s, ww, x, b) => {
        if (s) img.src = s;
        if (ww) img.style.width = `${ww}px`;
        d.style.left = `${x}px`;
        d.style.top = `${b}px`;
      },
      tf: (t, origin) => { if (origin) img.style.transformOrigin = origin; img.style.transform = t; },
      anim: (kf, o) => img.animate(kf, o),
      remove: () => this._rm(d),
    };
    if (src) a.put(src, w, cx, bottom);
    return a;
  },

  _hat(z, x, y) {
    const d = document.createElement("div");
    d.className = "sac-hat";
    d.style.width = `${SAC_HAT.w}px`;
    d.style.height = `${SAC_HAT.h}px`;
    d.style.backgroundImage = `url(${GNOME_ASSETS.idle})`;
    d.style.backgroundSize = `${SAC_HAT.bg}px ${SAC_HAT.bg}px`;
    d.style.left = `${x}px`;
    d.style.top = `${y}px`;
    return this._add(d, z);
  },

  _p(cls, x, y, w, z) {
    const e = document.createElement("div");
    e.className = `sac-p ${cls}`;
    e.style.cssText = `left:${x - w / 2}px;top:${y - w / 2}px;width:${w}px;height:${w}px`;
    return this._add(e, z);
  },

  // Chorro de partículas (valores en unidades de demo; se escalan con SAC_K).
  _burst(x, y, n, cls, z, o = {}) {
    const K = SAC_K;
    for (let i = 0; i < n; i++) {
      const s = o.s || [8, 18];
      const w = (s[0] + Math.random() * (s[1] - s[0])) * K;
      const e = this._p(cls, x, y, w, z);
      if (o.bg) e.style.background = o.bg();
      const a = (o.dir === undefined ? -Math.PI / 2 : o.dir) + (Math.random() - 0.5) * (o.spread || 1.6);
      const v = (o.v || 300) * (0.5 + Math.random() * 0.7) * K;
      const dx = Math.cos(a) * v, dy = Math.sin(a) * v;
      const G = (o.g === undefined ? 900 : o.g) * K;
      const T = o.t || 900;
      const sec = (k) => (T * k) / 1000;
      e.animate(
        [
          { transform: "translate(0,0) scale(1)", opacity: 1 },
          { transform: `translate(${dx * sec(0.5)}px,${dy * sec(0.5) + (G * sec(0.5) ** 2) / 2}px) scale(${o.sc || 1})`, opacity: 1, offset: 0.5 },
          { transform: `translate(${dx * sec(1)}px,${dy * sec(1) + (G * sec(1) ** 2) / 2}px) scale(.2)`, opacity: 0 },
        ],
        { duration: T }
      ).onfinish = () => this._rm(e);
    }
  },

  _ring(x, y, w, h, d, z, cls) {
    const r = document.createElement("div");
    r.className = `sac-ring ${cls || ""}`;
    const W = w * SAC_K, H = h * SAC_K;
    r.style.cssText = `left:${x - W / 2}px;top:${y - H / 2}px;width:${W}px;height:${H}px`;
    this._add(r, z);
    r.animate([{ transform: "scale(.2)", opacity: 0.95 }, { transform: "scale(1.5)", opacity: 0 }], { duration: d || 700, easing: "ease-out" }).onfinish = () => this._rm(r);
  },

  _shake(big) {
    const v = document.getElementById("board-viewport");
    if (!v) return;
    const c = big ? "board-viewport--shake--big" : "board-viewport--shake";
    v.classList.remove(c);
    void v.offsetWidth;
    v.classList.add(c);
    setTimeout(() => v.classList.remove(c), 440);
  },

  _flash() { if (typeof Villages !== "undefined" && Villages._flashScreen) Villages._flashScreen(); },

  _bubbles(x, y, n, z, amber) {
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        const w = (10 + Math.random() * 10) * SAC_K * 1.6;
        const b = this._p("sac-bubble" + (amber ? " sac-bubble--amber" : ""), x + (Math.random() - 0.5) * 50 * SAC_K * 1.6, y, w, z);
        b.animate([{ transform: "translateY(0) scale(.5)", opacity: 1 }, { transform: "translateY(-18px) scale(1.5)", opacity: 0 }], { duration: 700 }).onfinish = () => this._rm(b);
      }, i * 90);
    }
  },

  _bloodBurst(x, y, z) {
    const bg = () => "radial-gradient(circle at 35% 30%,#e0434d,#b81f2a 55%,#7d1019)";
    this._burst(x, y, 34, "", z, { v: 620, spread: 6.28, dir: 0, s: [8, 22], t: 1000, g: 1500, bg });
    this._burst(x, y, 22, "", z, { v: 360, spread: 6.28, dir: 0, s: [6, 14], t: 900, g: 1200, bg });
    this._burst(x, y, 14, "", z, { v: 900, spread: 2.4, s: [4, 9], t: 700, g: 900, bg });
    this._burst(x, y, 6, "sac-smoke sac-smoke--red", z - 1, { v: 120, spread: 6.28, dir: 0, s: [50, 90], t: 900, g: 0, sc: 2.4 });
  },

  _stain(x, y, w, h, kind, life) {
    const e = document.createElement("div");
    e.className = `sac-stain sac-stain--${kind}`;
    e.style.cssText = `left:${x - w / 2}px;top:${y - h / 2}px;width:${w}px;height:${h}px`;
    this._add(e, 3);
    e.animate([{ transform: "scale(.3,.2)", opacity: 0 }, { transform: "scale(1.1)", opacity: 1, offset: 0.5 }, { transform: "scale(1)", opacity: 1 }], { duration: 480, easing: "ease-out", fill: "forwards" });
    setTimeout(() => {
      e.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, fill: "forwards" }).onfinish = () => this._rm(e);
    }, life || 4000);
  },

  // Marcador "+N" de Gloria con el marco irregular de doble capa del juego.
  async _pts(x, y, z, value) {
    const e = document.createElement("div");
    e.className = "sac-pts";
    e.textContent = `+${value}`;
    e.style.left = `${x}px`;
    e.style.top = `${y}px`;
    this._add(e, z + 40);
    e.animate(
      [
        { transform: "translate(-50%,-100%) scale(0) rotate(-14deg)", opacity: 0 },
        { transform: "translate(-50%,-100%) scale(1.4,.8) rotate(4deg)", opacity: 1, offset: 0.35 },
        { transform: "translate(-50%,-100%) scale(.9,1.15) rotate(-3deg)", opacity: 1, offset: 0.6 },
        { transform: "translate(-50%,-100%) scale(1) rotate(-2deg) translateY(-8px)", opacity: 1 },
      ],
      { duration: 520, easing: "ease-out", fill: "forwards" }
    );
    this._burst(x + 20, y - 14, 14, "sac-em", z + 41, { v: 340, spread: 3.4, s: [4, 9], t: 900, g: 700 });
    await this._sleep(1500);
    await e.animate(
      [{ opacity: 1, transform: "translate(-50%,-100%) scale(1) rotate(-2deg) translateY(-8px)" }, { opacity: 0, transform: "translate(-50%,-100%) scale(1) rotate(-2deg) translateY(-44px)" }],
      { duration: 450, fill: "forwards" }
    ).finished;
    this._rm(e);
  },

  // ---------- Gloria y reaparición ----------
  _award(team, x, y, z) {
    // el valor se fijó al morir el gnomo (_kill), en orden
    const value = this._vals.length ? this._vals.shift() : SACRIFICE_GLORY;
    if (typeof Glory !== "undefined" && Glory.addNow) Glory.addNow(team, value);
    this._snd("glory");
    return this._pts(x, y, z, value);
  },

  // Un gnomo nuevo en una zona aleatoria del escenario, con un "pop" de aparición.
  _respawn() {
    if (typeof Gnome === "undefined" || !Gnome.spawnRandom) return;
    const g = Gnome.spawnRandom();
    if (g && g.el) {
      g.el.animate(
        [{ opacity: 0, scale: "0" }, { opacity: 1, scale: "1.15 .85", offset: 0.5 }, { opacity: 1, scale: "1" }],
        { duration: 420, easing: "ease-out" }
      );
    }
  },

  // El gnomo muere de verdad: se borra la instancia y llega otro.
  _kill(gnome) {
    this._vals.push(sacrificeValue(gnome));
    if (gnome && typeof Gnome !== "undefined" && Gnome.list.includes(gnome)) Gnome.destroyInstance(gnome);
    this._respawn();
  },

  // ---------- Objetivos de lanzamiento ----------
  _inRange(unit, r, c) {
    const d = Math.max(Math.abs(r - unit.row), Math.abs(c - unit.col));
    return d >= 1 && d <= GNOME_THROW_MAX_RANGE;
  },
  _visible(r, c) { return !(typeof Fog !== "undefined" && Fog.isFogged(r, c)); },

  throwTargets(unit) {
    const out = [];
    const free = (r, c) => !Units.unitAt(r, c) && !(typeof Gnome !== "undefined" && Gnome.isAt(r, c));
    // Agua
    if (typeof TerrainMap !== "undefined" && TerrainMap.grid) {
      for (let r = 0; r < Units.boardSize; r++) {
        for (let c = 0; c < Units.boardSize; c++) {
          if (TerrainMap.typeAt(r, c) !== "water" || !this._inRange(unit, r, c) || !this._visible(r, c) || !free(r, c)) continue;
          out.push({ kind: "water", row: r, col: c });
        }
      }
    }
    // Charcos de lava
    if (typeof Volcano !== "undefined" && Volcano.lava) {
      Volcano.lava.forEach((l) => {
        if (this._inRange(unit, l.row, l.col) && this._visible(l.row, l.col) && free(l.row, l.col)) out.push({ kind: "lava", row: l.row, col: l.col, ref: l });
      });
    }
    // Setas explosivas sueltas
    if (typeof Mushrooms !== "undefined") {
      Mushrooms.list.forEach((m) => {
        if (m.heldBy || !m.el) return;
        if (this._inRange(unit, m.row, m.col) && this._visible(m.row, m.col) && free(m.row, m.col)) out.push({ kind: "mushroom", row: m.row, col: m.col, ref: m });
      });
    }
    // Cepos (los tuyos, o los que se ven)
    if (typeof Backpack !== "undefined" && Backpack.traps) {
      Backpack.traps.forEach((t) => {
        if (!t.el || (t.ownerTeam !== unit.team && t.el.style.display === "none")) return;
        if (this._inRange(unit, t.row, t.col) && this._visible(t.row, t.col) && free(t.row, t.col)) out.push({ kind: "cepo", row: t.row, col: t.col, ref: t });
      });
    }
    // Bumpers del pinball (nivel Poblado HurryCrane)
    if (typeof Bumpers !== "undefined" && Bumpers.list && Bumpers.list.length && typeof Egg !== "undefined" && Egg.isActive && Egg.isActive()) {
      Bumpers.list.forEach((b) => {
        if (b.el && this._inRange(unit, b.row, b.col) && !(typeof Fog !== "undefined" && Fog.isFoggedReal(b.row, b.col))) out.push({ kind: "bumper", row: b.row, col: b.col, ref: b });
      });
    }
    return out;
  },

  addThrowMarkers(unit, gnome) {
    // Mismo círculo habitual de lanzar (con su color de dificultad); solo el
    // puntero cambia a la calavera al pasar por encima.
    const movimiento = Units.moveRangeOf(unit);
    this.throwTargets(unit).forEach((t, i) => {
      const dist = Math.max(Math.abs(t.row - unit.row), Math.abs(t.col - unit.col));
      const diff = gnome._throwDifficultyClass(unit, dist, movimiento);
      Units.addMarker({
        className: `range-marker range-marker--pass-target range-marker--sacrifice ${diff}`,
        row: t.row,
        col: t.col,
        delayIndex: i % 12,
        visibleClass: "range-marker--visible",
        owner: "gnome",
        // el bumper pasa por Bumpers.throwGnome (js/net-hooks.js lo sincroniza en multijugador)
        onClick: () => (t.kind === "bumper" && typeof Bumpers !== "undefined" ? Bumpers.throwGnome(unit, gnome, t.ref) : this.perform(unit, gnome, t.kind, t)),
      });
    });
  },

  isSacrificeTile(unit, row, col) {
    return this.throwTargets(unit).some((t) => t.row === row && t.col === col);
  },

  // Gnomos sueltos a la vista (objetivos de piedra y de KataPum!).
  looseTargets() {
    if (typeof Gnome === "undefined") return [];
    return Gnome.list
      .filter((g) => g.el && !g.heldBy && !g.busy && !g.isDecoy && g.el.style.display !== "none" && !g.el.classList.contains("unit--fog-hidden") && this._visible(g.row, g.col))
      .map((g) => ({ kind: "gnome", ref: g, row: g.row, col: g.col, el: g.el }));
  },

  // ---------- Lanzar al gnomo (volcán, charco, agua, seta, cepo) ----------
  async perform(holder, gnome, kind, tgt) {
    if (gnome.heldBy !== holder.id || gnome.busy) return;
    if (typeof Turns !== "undefined" && !Turns.canAct(holder)) return;
    if (typeof Turns !== "undefined") Turns.useAction(holder);
    Units.clearRangeOverlays();
    gnome.passing = false;
    gnome.busy = true;
    gnome.hideBadge();
    Units.faceTowardsTile(holder, tgt.row, tgt.col);
    if (holder.el) {
      holder.el.classList.remove("unit--throwing");
      void holder.spriteEl.offsetWidth;
      holder.el.classList.add("unit--throwing");
      setTimeout(() => holder.el && holder.el.classList.remove("unit--throwing"), 380);
    }
    gnome.row = holder.row;
    gnome.col = holder.col;
    gnome.detachFrom();
    gnome.el.style.display = "none";
    this.busy++;
    try {
      await this._play(kind, holder, gnome, tgt);
    } finally {
      this.busy--;
      if (holder.el) Units.refreshRange(holder);
    }
  },

  async _play(kind, holder, gnome, tgt) {
    const team = holder.team;
    if (kind === "volcano") return this._volcano(holder, gnome, tgt, team);
    if (kind === "lava") return this._puddle(holder, gnome, tgt, team);
    if (kind === "water") return this._water(holder, gnome, tgt, team);
    if (kind === "mushroom") return this._mushroom(holder, gnome, tgt, team);
    if (kind === "cepo") return this._cepo(holder, gnome, tgt, team);
    if (kind === "bumper") return this._bumper(holder, gnome, tgt.ref, team);
  },

  // Vuelo en arco con giros desde quien lo lanza hasta (tx, bottom). Devuelve el actor.
  async _fly(holder, tx, tbottom, z, opts = {}) {
    const from = this._tile(holder.row, holder.col);
    const sx = from.x, sb = from.y - 30;
    const dist = Math.max(1, Math.max(Math.abs(tx - sx), Math.abs(tbottom - sb)) / (typeof TILE_W !== "undefined" ? TILE_W : 188));
    const dur = Math.min(1000, 420 + dist * 160);
    const peak = (opts.peak || 70) + dist * 22;
    const a = this._actor(z + 5, GNOME_ASSETS.grita, opts.w || SAC_W.fly, sx, sb);
    a.tf("rotate(-20deg)", "50% 50%");
    const sh = document.createElement("div");
    sh.className = "sac-shadow";
    this._add(sh, 2);
    this._snd("gnomeFly", dur / 1000);
    await this._raf(dur, (t) => {
      const x = sx + (tx - sx) * t;
      const y = sb + (tbottom - sb) * t - Math.sin(Math.PI * t) * peak;
      a.put(null, null, x, y);
      a.tf(`rotate(${opts.noSpin ? -20 + t * 20 : -20 + t * 560}deg)`);
      const gy = sb + 30 + (tbottom + 8 - sb - 30) * t;
      sh.style.left = `${x}px`;
      sh.style.top = `${gy}px`;
      sh.style.transform = `translate(-50%,-50%) scale(${1 - 0.5 * Math.sin(Math.PI * t)})`;
    });
    this._rm(sh);
    return a;
  },

  // Estampa en el suelo tras aterrizar (aplastón de goma).
  _land(a, rot) {
    return a.anim(
      [{ transform: `${rot || ""} scale(1.3,.65)` }, { transform: `${rot || ""} scale(.92,1.12)` }, { transform: `${rot || ""} scale(1)` }],
      { duration: 380, easing: "ease-out" }
    ).finished;
  },

  // ---------- 1. Volcán ----------
  async _volcano(holder, gnome, v, team) {
    const z = this._z(v.row, v.col) + 4;
    const ax = parseFloat(v.el.style.left), ay = parseFloat(v.el.style.top);
    const vh = 330 * (453 / 560);
    const cx = ax, cy = ay - 0.194 * vh; // boca del cráter
    const a = await this._fly(holder, cx, cy + 22, z, { w: SAC_W.fly });
    // Capa delantera del volcán: el gnomo se hunde "dentro" de la boca.
    const front = document.createElement("div");
    front.className = "unit volcano sac-volcano-front";
    const fimg = document.createElement("img");
    fimg.className = "volcano__sprite";
    const vs = v.el.querySelector(".volcano__sprite");
    fimg.src = vs ? vs.currentSrc || vs.src : "";
    fimg.style.clipPath = "polygon(0 56%,100% 56%,100% 100%,0 100%)";
    front.appendChild(fimg);
    front.style.left = `${ax}px`;
    front.style.top = `${ay}px`;
    this._add(front, z + 6);
    // Impacto: salpicadura de lava y llama
    this._snd("fireBoom");
    a.put(GNOME_FIRE.corre, SAC_W.fire, cx, cy + 22);
    a.tf("rotate(0deg)", "50% 100%");
    this._burst(cx, cy - 6, 22, "sac-lv", z + 8, { v: 520, spread: 2, s: [10, 22], t: 1100, g: 1400 });
    this._burst(cx, cy - 6, 14, "sac-em", z + 8, { v: 420, spread: 2.4, s: [4, 8], t: 1300, g: 500 });
    this._ring(cx, cy + 6, 260, 90, 650, z + 7);
    setTimeout(() => this._ring(cx, cy + 6, 200, 70, 650, z + 7), 150);
    this._shake(false);
    let flip = false;
    const fl = setInterval(() => { flip = !flip; a.img.src = flip ? GNOME_FIRE.agarrado : GNOME_FIRE.corre; }, 150);
    const be = setInterval(() => this._burst(cx + (Math.random() - 0.5) * 30, cy - 20, 2, "sac-em", z + 8, { v: 140, spread: 1, s: [4, 9], t: 700, g: -200 }), 70);
    // se hunde ardiendo, dando bandazos
    await this._raf(1050, (t) => {
      const e = this._ease(t);
      a.put(null, null, cx + Math.sin(t * 14) * 4, cy + 22 + e * 62);
      a.tf(`rotate(${Math.sin(t * 16) * 16}deg) scale(${1 - 0.28 * e},${1 - 0.5 * e})`, "50% 100%");
      a.d.style.opacity = t > 0.9 ? 1 - (t - 0.9) * 10 : 1;
    });
    clearInterval(fl);
    clearInterval(be);
    a.remove();
    this._kill(gnome);
    this._bubbles(cx, cy + 4, 4, z + 7, true);
    await this._sleep(600);
    // solo queda el gorro flotando... y se prende y se hunde
    const hat = this._hat(z + 8, cx - SAC_HAT.w / 2, cy - SAC_HAT.h - 2);
    hat.animate([{ transform: "translateY(10px) scale(.2)", opacity: 0 }, { transform: "translateY(-12px) rotate(-10deg) scale(1.15)", opacity: 1, offset: 0.5 }, { transform: "translateY(0) rotate(4deg)", opacity: 1 }], { duration: 520, easing: "ease-out", fill: "forwards" });
    await this._sleep(1400);
    const hb = setInterval(() => this._burst(cx + (Math.random() - 0.5) * 24, cy - SAC_HAT.h, 2, "sac-em", z + 9, { v: 110, spread: 1, s: [4, 9], t: 600, g: -150 }), 60);
    hat.animate([{ transform: "translateY(0) rotate(4deg) scale(1)", filter: "brightness(1)" }, { transform: "translateY(3px) rotate(10deg) scale(.9)", filter: "brightness(2.2) sepia(1) saturate(4) hue-rotate(-20deg)", offset: 0.45 }, { transform: "translateY(22px) rotate(40deg) scale(.4)", filter: "brightness(.3)", opacity: 0 }], { duration: 900, easing: "ease-in", fill: "forwards" });
    await this._sleep(950);
    clearInterval(hb);
    this._rm(hat);
    // el volcán eructa, satisfecho
    this._burst(cx, cy - 10, 6, "sac-smoke", z + 9, { v: 160, spread: 0.7, s: [26, 44], t: 1300, g: -120, sc: 2.2 });
    const belch = [{ transform: "scale(1)" }, { transform: "scale(1.05,.95)" }, { transform: "scale(.97,1.04)" }, { transform: "scale(1)" }];
    if (vs) vs.animate(belch, { duration: 520, easing: "ease-out" });
    fimg.animate(belch, { duration: 520, easing: "ease-out" });
    this._ring(cx, cy + 6, 240, 80, 600, z + 7);
    await this._sleep(380);
    this._rm(front);
    await this._award(team, cx, cy - 30, z);
  },

  // ---------- 8. Bumper del pinball: se lo traga y escupe sangre a presión ----------
  async _bumper(holder, gnome, b, team) {
    const z = this._z(b.row, b.col) + 6;
    const bx = parseFloat(b.el.style.left), by = parseFloat(b.el.style.top);
    const sw = 205, sh = 205 * (922 / 990), k = sw / 990;
    const ox = bx - sw / 2, oy = by - 0.92 * sh + 30;
    const vx = ox + 520 * k, vy = oy + 125 * k; // rejilla de arriba
    const chx = ox + 172 * k, chy = oy + 50 * k; // chimenea
    const lite = typeof PerfMode !== "undefined" && PerfMode.enabled;
    const a = await this._fly(holder, vx, vy + 24, z, { w: SAC_W.fly, noSpin: true, peak: 90 });
    // golpe de bumper (combo, luces, onda de tambores) y de golpe al agujero
    let n = 1;
    if (typeof Bumpers !== "undefined") {
      Bumpers.beginFlight();
      n = Bumpers.registerHit();
      Bumpers.reactAt(b, n);
      Bumpers.markLit(b, team);
    }
    await this._raf(130, (t) => {
      a.put(null, null, vx, vy + 24 + t * t * 30);
      a.d.style.clipPath = `inset(0 0 ${Math.round(t * 70)}% 0)`;
    });
    a.remove();
    this._kill(gnome);
    // glup: la máquina se hincha un instante
    this._shake(false);
    const sp = b.spriteEl;
    if (sp && sp.animate) sp.animate([{ scale: "1 1" }, { scale: ".94 1.08" }, { scale: "1.07 .93" }, { scale: "1 1" }], { duration: 420, easing: "ease-out" });
    await this._sleep(640);
    // sangre a presión por el agujero (solo gotitas) + humo negro por el agujero y la chimenea
    this._snd("explosion");
    const bg = () => "radial-gradient(circle at 35% 30%,#e8353d,#b0121a 55%,#6a090e)";
    const dir = -Math.PI / 2;
    if (sp && sp.animate) sp.animate([{ scale: "1 1" }, { scale: "1.04 .96" }, { scale: ".97 1.04" }, { scale: "1 1" }], { duration: 200, iterations: 7 });
    const every = lite ? 60 : 30, c1 = lite ? 3 : 5, c2 = lite ? 1 : 2;
    const spray = setInterval(() => {
      this._burst(vx, vy - 3, c1, "", z + 8, { dir, spread: 0.8, v: 760, s: [7, 15], t: 1200, g: 1500, bg });
      this._burst(vx, vy - 3, c2, "", z + 8, { dir, spread: 1.7, v: 480, s: [8, 18], t: 1100, g: 1500, bg });
    }, every);
    const smoke = setInterval(() => {
      this._burst(vx, vy - 2, 1, "sac-smoke", z + 9, { dir, spread: 0.7, v: 140, s: [30, 58], t: 1700, g: -110, sc: 2.4 });
      this._burst(chx, chy - 2, 1, "sac-smoke", z + 9, { dir, spread: 0.6, v: 110, s: [26, 46], t: 1600, g: -100, sc: 2.2 });
    }, 90);
    // charcos de sangre del juego alrededor de la base, de golpe
    const size = Units.boardSize;
    [[1, 1], [1, 0], [0, 1]].forEach(([dr, dc], i) => {
      setTimeout(() => {
        const r = b.row + dr, c = b.col + dc;
        if (typeof BloodSplat !== "undefined" && r < size && c < size) BloodSplat.spawnAt(r, c, { lifetime: 3200, scale: 1.1 });
      }, 1300 + i * 160);
    });
    await this._sleep(1300);
    clearInterval(spray);
    for (let i = 0; i < 6; i++) {
      this._burst(vx, vy - 3, 3, "", z + 8, { dir, spread: 1, v: 320 - i * 30, s: [6, 13], t: 900, g: 1500, bg });
      await this._sleep(110);
    }
    setTimeout(() => clearInterval(smoke), 1800);
    await this._sleep(500);
    if (typeof Bumpers !== "undefined") Bumpers.endFlight(team);
    await this._award(team, vx, vy - 30, z);
  },

  // ---------- 2. Charco de lava ----------
  async _puddle(holder, gnome, tgt, team) {
    const c = this._tile(tgt.row, tgt.col);
    const z = this._z(tgt.row, tgt.col) + 4;
    const cx = c.x, cy = c.y + 8;
    const a = await this._fly(holder, cx, cy, z);
    // aterriza DE PIE sobre el charco: chof, y se prende
    a.put(GNOME_FIRE.corre, SAC_W.fire, cx, cy);
    a.anim([{ transform: "scale(1.3,.65)" }, { transform: "scale(.9,1.15)" }, { transform: "scale(1)" }], { duration: 380, easing: "ease-out" });
    this._snd("fireBoom");
    this._burst(cx, cy - 6, 12, "sac-lv", z + 8, { v: 380, spread: 2, s: [8, 16], t: 900, g: 1300 });
    this._ring(cx, cy + 2, 300, 100, 650, z + 7);
    this._shake(false);
    const spr = tgt.ref && tgt.ref.el ? tgt.ref.el.querySelector(".lava-puddle__sprite") : null;
    if (spr) spr.animate([{ transform: "scale(1.12,.9)" }, { transform: "scale(1)" }], { duration: 500, easing: "ease-out" });
    await this._sleep(250);
    // corre en círculos en llamas, ¡pero el suelo ES lava!
    let flip = false;
    const fl = setInterval(() => { flip = !flip; a.img.src = flip ? GNOME_FIRE.agarrado : GNOME_FIRE.corre; }, 120);
    let px = cx, py = cy;
    const be = setInterval(() => this._burst(px + (Math.random() - 0.5) * 24, py - 50, 2, "sac-em", z + 8, { v: 150, spread: 1.2, s: [4, 9], t: 700, g: -200 }), 70);
    await this._raf(1900, (t) => {
      const ang = t * Math.PI * 5;
      const r = 130 * SAC_K * (1 - 0.45 * t) * 1.2;
      const x = cx + Math.cos(ang) * r * 1.1, y = cy - 4 + Math.sin(ang) * r * 0.38;
      const dir = Math.cos(ang + Math.PI / 2) > 0;
      a.put(null, null, x, y);
      a.tf(`scaleX(${dir ? 1 : -1}) translateY(${-Math.abs(Math.sin(t * 50)) * 6}px) rotate(${Math.sin(t * 50) * 6}deg)`, "50% 100%");
      a.d.style.zIndex = y > cy - 4 ? z + 7 : z + 1;
      px = x; py = y;
      if (Math.random() < 0.12) this._ring(x, y + 2, 70, 26, 420, z + 6);
    });
    clearInterval(fl);
    clearInterval(be);
    // se detiene, completamente chamuscado
    a.put(GNOME_ASSETS.idle, SAC_W.ground, px, py);
    a.tf("none", "50% 100%");
    a.anim([{ filter: "brightness(1) saturate(1)" }, { filter: "brightness(.12) saturate(0) contrast(1.2)" }], { duration: 420, fill: "forwards" });
    a.anim([{ transform: "scale(1.1,.9)" }, { transform: "scale(1)" }], { duration: 300 });
    for (let i = 0; i < 5; i++) setTimeout(() => this._burst(px + (Math.random() - 0.5) * 14, py - 55, 1, "sac-smoke", z + 9, { v: 60, spread: 0.5, s: [18, 30], t: 1400, g: -80, sc: 2.2 }), i * 160);
    await this._sleep(1300);
    a.anim([{ transform: "translateY(0)" }, { transform: "translateY(-4px) scale(1.04,.96)" }, { transform: "translateY(0)" }, { transform: "translateY(-4px) scale(1.04,.96)" }, { transform: "translateY(0)" }], { duration: 520 });
    this._burst(px + 14, py - 52, 5, "sac-smoke", z + 9, { v: 140, spread: 1, s: [14, 24], t: 900, g: -30, sc: 2 });
    await this._sleep(750);
    // se deshace en cenizas
    this._kill(gnome);
    const hat = this._hat(z + 8, px - SAC_HAT.w / 2, py - SAC_W.ground);
    hat.style.filter = "brightness(.2) grayscale(1)";
    a.anim([{ transform: "scale(1,1)", opacity: 1 }, { transform: "scale(1.05,.9)", opacity: 1, offset: 0.25 }, { transform: "scale(1,.12)", opacity: 0 }], { duration: 650, fill: "forwards", easing: "ease-in" });
    this._burst(px, py - 30, 16, "sac-smoke", z + 9, { v: 120, spread: 2.6, s: [14, 30], t: 1500, g: -60, sc: 2 });
    this._burst(px, py - 28, 18, "sac-smoke", z + 9, { v: 260, spread: 2.8, s: [8, 14], t: 1300, g: 200, sc: 1.3 });
    hat.animate([{ transform: "translateY(0)" }, { transform: `translateY(${SAC_W.ground - SAC_HAT.h}px) rotate(12deg)` }], { duration: 650, fill: "forwards", easing: "cubic-bezier(.5,0,1,.6)" });
    await this._sleep(700);
    this._shake(false);
    const hb = setInterval(() => this._burst(px + (Math.random() - 0.5) * 20, py - 10, 2, "sac-em", z + 9, { v: 110, spread: 1, s: [4, 9], t: 600, g: -150 }), 60);
    hat.style.filter = "";
    hat.animate([{ opacity: 1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], { duration: 1000, fill: "forwards" });
    if (spr) spr.animate([{ transform: "scale(1)" }, { transform: "scale(1.05,.93)" }, { transform: "scale(.97,1.04)" }, { transform: "scale(1)" }], { duration: 520, easing: "ease-out" });
    await this._sleep(800);
    clearInterval(hb);
    a.remove();
    this._rm(hat);
    await this._award(team, px, py - 70, z);
  },

  // ---------- 3. Agua ----------
  async _water(holder, gnome, tgt, team) {
    const c = this._tile(tgt.row, tgt.col);
    const z = this._z(tgt.row, tgt.col) + 4;
    const wx = c.x, wy = c.y; // línea de agua
    const a = await this._fly(holder, wx, wy + 8, z);
    const clip = (bottom) => { a.img.style.clipPath = `inset(-400px -400px ${Math.max(0, bottom - wy)}px -400px)`; };
    const splash = (x, y, k) => {
      this._burst(x, y, Math.round(26 * k), "sac-wd", z + 8, { v: 520, spread: 1.5, s: [8, 20], t: 1100, g: 1500 });
      this._burst(x, y, Math.round(10 * k), "sac-wd", z + 8, { v: 260, spread: 2.8, s: [6, 12], t: 800, g: 1100 });
      this._ring(x, y + 4, 300 * k, 100 * k, 700, z + 7, "sac-ring--w");
      setTimeout(() => this._ring(x, y + 4, 210 * k, 70 * k, 700, z + 7, "sac-ring--w"), 140);
    };
    this._snd("splash");
    splash(wx, wy, 1.2);
    this._shake(false);
    a.tf("none", "50% 100%");
    // sale a flote y patalea; cada vez con menos fuerza
    const cyc = [{ up: 46, sink: 26, n: 520 }, { up: 34, sink: 44, n: 480 }, { up: 22, sink: 66, n: 440 }];
    for (let i = 0; i < cyc.length; i++) {
      const cy = cyc[i];
      this._snd("drownFlail");
      await this._raf(cy.n, (t) => {
        const e = Math.sin(Math.PI * t);
        const bottom = wy + (cy.sink - e * cy.up) * SAC_K * 1.6;
        a.put(null, null, wx + Math.sin(t * 20) * 3, bottom);
        clip(bottom);
        a.tf(`rotate(${Math.sin(t * 26) * (14 - 3 * i)}deg)`, "50% 100%");
      });
      this._burst(wx, wy - 10, 6, "sac-wd", z + 8, { v: 230, spread: 2, s: [5, 10], t: 600, g: 800 });
      this._ring(wx, wy + 4, 140, 46, 500, z + 7, "sac-ring--w");
      this._bubbles(wx, wy, 3, z + 7);
    }
    // se hunde del todo
    this._snd("drownBubbles");
    await this._raf(900, (t) => {
      const e = this._ease(t);
      const bottom = wy + (66 + e * 140) * SAC_K * 1.6;
      a.put(null, null, wx + Math.sin(t * 10) * 2, bottom);
      clip(bottom);
      a.tf(`rotate(${Math.sin(t * 14) * 10}deg)`, "50% 100%");
      if (Math.random() < 0.25) this._bubbles(wx, wy, 1, z + 7);
    });
    a.remove();
    this._kill(gnome);
    this._bubbles(wx, wy, 6, z + 7);
    this._ring(wx, wy + 4, 120, 40, 600, z + 7, "sac-ring--w");
    this._snd("drownPlop");
    await this._sleep(500);
    // solo queda el gorro flotando
    const hat = this._hat(z + 8, wx - SAC_HAT.w / 2, wy - SAC_HAT.h + 4);
    hat.animate([{ transform: "translateY(10px) scale(.2)", opacity: 0 }, { transform: "translateY(-12px) rotate(-10deg) scale(1.15)", opacity: 1, offset: 0.5 }, { transform: "translateY(0) rotate(4deg)", opacity: 1 }], { duration: 520, easing: "ease-out", fill: "forwards" });
    await this._sleep(560);
    hat.animate([{ transform: "translateY(0) rotate(4deg)" }, { transform: "translateY(-3px) rotate(-5deg)" }, { transform: "translateY(0) rotate(4deg)" }], { duration: 900, iterations: 2 });
    this._ring(wx, wy + 6, 110, 36, 1200, z + 7, "sac-ring--w");
    setTimeout(() => this._ring(wx, wy + 6, 110, 36, 1200, z + 7, "sac-ring--w"), 600);
    await this._sleep(1500);
    // tirón desde abajo: se lo llevan de golpe
    hat.getAnimations().forEach((an) => an.cancel());
    await hat.animate([{ transform: "translateY(0) scale(1,1)" }, { transform: "translateY(-6px) scale(.9,1.25)" }, { transform: "translateY(16px) scale(1.1,.5)", opacity: 1, offset: 0.7 }, { transform: "translateY(24px) scale(.3)", opacity: 0 }], { duration: 420, fill: "forwards", easing: "ease-in" }).finished;
    this._rm(hat);
    splash(wx, wy + 4, 0.45);
    await this._sleep(250);
    await this._award(team, wx, wy - 50, z);
  },

  // ---------- 4. Seta explosiva ----------
  async _mushroom(holder, gnome, tgt, team) {
    const m = tgt.ref;
    const c = this._tile(tgt.row, tgt.col);
    const z = this._z(tgt.row, tgt.col) + 4;
    const mx = c.x, my = c.y + 10; // pie de la seta
    const gx = mx - 80, gy = my + 6;
    const a = await this._fly(holder, gx, gy, z, { noSpin: true }); // sin voltearse boca abajo
    a.put(GNOME_ASSETS.idle, SAC_W.ground, gx, gy);
    await this._land(a);
    await this._sleep(700);
    // la mecha se enciende sola: chispas, la seta se hincha y se pone roja
    const fuse = { x: mx + 10, y: my - 78 };
    const sp = setInterval(() => this._burst(fuse.x, fuse.y, 2, "sac-em", z + 8, { v: 150, spread: 3, s: [4, 8], t: 450, g: 300 }), 50);
    a.anim([{ transform: "translateX(0) rotate(0)" }, { transform: "translateX(-2px) rotate(-3deg)" }, { transform: "translateX(2px) rotate(3deg)" }, { transform: "translateX(0)" }], { duration: 170, iterations: 7 });
    if (m.spriteEl) {
      await m.spriteEl.animate([{ transform: "scale(1)", filter: "brightness(1)" }, { transform: "scale(1.1,.92)", filter: "brightness(1.4) saturate(1.5)" }, { transform: "scale(.95,1.08)", filter: "brightness(1)" }, { transform: "scale(1.2,.88)", filter: "brightness(1.8) saturate(2)" }, { transform: "scale(1.0,1.2)", filter: "brightness(1)" }, { transform: "scale(1.4,1.1)", filter: "brightness(2.4) saturate(2.5)" }], { duration: 1200, fill: "forwards", easing: "ease-in" }).finished;
    } else await this._sleep(1200);
    clearInterval(sp);
    // BOOM
    if (typeof Mushrooms !== "undefined") Mushrooms.consume(m);
    this._snd("explosion");
    this._flash();
    this._shake(true);
    const bx = mx, by = my - 34;
    const fire = (r, col, d, delay) => setTimeout(() => {
      const e = this._p("", bx, by, r * 2 * SAC_K * 1.4, z + 9);
      e.style.background = col;
      e.animate([{ transform: "scale(.1)", opacity: 1 }, { transform: "scale(1.05)", opacity: 0.95, offset: 0.35 }, { transform: "scale(1.3)", opacity: 0 }], { duration: d, easing: "ease-out" }).onfinish = () => this._rm(e);
    }, delay || 0);
    fire(150, "radial-gradient(circle,#fff,#ffe17a 35%,#ff8a1f 70%,rgba(255,60,0,0))", 520, 0);
    fire(100, "radial-gradient(circle,#fff6c0,#ffb21e 50%,rgba(255,70,0,0))", 460, 90);
    this._ring(bx, by + 8, 420, 150, 700, z + 8);
    setTimeout(() => this._ring(bx, by + 8, 320, 110, 700, z + 8), 120);
    this._burst(bx, by, 26, "sac-lv", z + 10, { v: 700, spread: 3, s: [8, 18], t: 1200, g: 1400 });
    for (let i = 0; i < 16; i++) {
      const col = i % 2 ? "#d73b3b" : "#f3ead8";
      this._burst(bx, by, 1, "sac-chunk", z + 10, { v: 650, spread: 3.2, s: [10, 20], t: 1300, g: 1500, bg: () => col });
    }
    this._burst(bx, by, 10, "sac-smoke", z + 9, { v: 300, spread: 3, s: [40, 80], t: 1700, g: -80, sc: 2.4 });
    const soot = document.createElement("div");
    soot.className = "sac-soot";
    soot.style.cssText = `left:${mx - 70}px;top:${my - 22}px;width:140px;height:48px`;
    this._add(soot, 3);
    soot.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, fill: "forwards" });
    setTimeout(() => { soot.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 800, fill: "forwards" }).onfinish = () => this._rm(soot); }, 4500);
    // la onda lo alcanza: se carboniza ahí mismo, sin moverse ni darse la vuelta
    const K = SAC_K;
    a.img.getAnimations().forEach((x) => x.cancel());
    a.anim([{ filter: "brightness(1)" }, { filter: "brightness(4) saturate(0)", offset: 0.2 }, { filter: "brightness(.12) saturate(0) contrast(1.2)" }], { duration: 520, fill: "forwards", easing: "ease-out" });
    a.anim([{ transform: "scale(1)" }, { transform: "scale(1.08,.94)", offset: 0.2 }, { transform: "scale(1)" }], { duration: 420, easing: "ease-out" });
    this._burst(gx, gy - 80 * K, 14, "sac-em", z + 9, { v: 300, spread: 3.4, s: [4, 9], t: 800, g: 500 });
    await this._sleep(560);
    // humeando, negro como el carbón, quieto un momento
    const wisp = setInterval(() => this._burst(gx + (Math.random() - 0.5) * 40 * K, gy - 110 * K, 1, "sac-smoke", z + 9, { v: 60, spread: 0.6, s: [18, 30], t: 1400, g: -80, sc: 2.2 }), 130);
    await this._sleep(1200);
    // ...y se hunde en el suelo, puf. Debajo queda un círculo de ceniza.
    const D = SAC_W.ground * 0.9;
    const ash = document.createElement("div");
    ash.className = "sac-ash";
    ash.style.cssText = `left:${gx - 95 * K}px;top:${gy - 32 * K}px;width:${190 * K}px;height:${60 * K}px;transform:scale(0)`;
    this._add(ash, 3);
    const flecks = [];
    for (let i = 0; i < 9; i++) {
      const f = document.createElement("div");
      f.className = "sac-ash-fleck";
      const w = (8 + Math.random() * 14) * K;
      f.style.cssText = `left:${gx + (Math.random() - 0.5) * 140 * K - w / 2}px;top:${gy - 2 + (Math.random() - 0.5) * 10 * K}px;width:${w}px;height:${w * 0.4}px;transform:scale(0)`;
      this._add(f, 3);
      flecks.push(f);
      setTimeout(() => { f.style.transform = "scale(1)"; }, 300 + i * 80);
    }
    const dust = setInterval(() => this._burst(gx + (Math.random() - 0.5) * 70 * K, gy - 4, 1, "sac-dust", z + 9, { v: 110, spread: 2.2, s: [8, 16], t: 600, g: 260 }), 70);
    await this._raf(900, (t) => {
      const d = D * (t * t * (3 - 2 * t) * 0.2 + t * t * 0.8);
      ash.style.transform = `scale(${Math.min(1, t * 1.6)})`;
      a.d.style.top = `${gy + d}px`;
      a.d.style.clipPath = `inset(0 0 ${d}px 0)`;
      a.img.style.transform = `translateX(${Math.sin(t * 40) * (1 - t) * 2}px)`;
    });
    clearInterval(dust);
    clearInterval(wisp);
    a.d.style.opacity = 0;
    this._shake(false);
    this._kill(gnome);
    this._burst(gx, gy - 10 * K, 18, "sac-smoke", z + 9, { v: 200, spread: 3.0, s: [26, 54], t: 1500, g: -90, sc: 2.4 });
    this._burst(gx, gy - 6 * K, 10, "sac-dust", z + 9, { v: 260, spread: 3.0, s: [12, 22], t: 800, g: 300 });
    a.remove();
    await this._sleep(500);
    await this._award(team, gx, gy - 80, z);
    [ash, ...flecks].forEach((e) => e.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, fill: "forwards" }).onfinish = () => this._rm(e));
  },

  // ---------- 6. Cepo ----------
  async _cepo(holder, gnome, tgt, team) {
    const trap = tgt.ref;
    const c = this._tile(tgt.row, tgt.col);
    const z = this._z(tgt.row, tgt.col) + 4;
    const cx = c.x, cy = c.y + 14;
    // El cepo real se sustituye por dos copias (fondo y mandíbula delantera) para que el gnomo quede en medio.
    const mk = (front) => {
      const e = trap.el.cloneNode(true);
      e.style.display = "";
      e.classList.remove("unit--fog-hidden");
      e.style.scale = "1.3";
      const img = e.querySelector("img");
      if (img) { img.style.transformOrigin = "50% 100%"; if (front) img.style.clipPath = "polygon(0 55%,100% 55%,100% 100%,0 100%)"; }
      this._add(e, front ? z + 6 : z - 1);
      return img || e;
    };
    const back = mk(false), frontJaw = mk(true);
    const both = [back, frontJaw];
    trap.el.style.visibility = "hidden";
    const W = 100; // sprite de lanzado, mismo tamaño en todo el recorrido
    const a = await this._fly(holder, cx, cy - 26, z, { w: W });
    // cae en medio del cepo, todavía con la postura de lanzado
    a.put(GNOME_ASSETS.grita, W, cx, cy - 8);
    a.tf("rotate(-8deg)", "50% 100%");
    await a.anim([{ transform: "rotate(-8deg) scale(1.2,.8)" }, { transform: "rotate(-8deg) scale(.96,1.06)" }, { transform: "rotate(-8deg) scale(1)" }], { duration: 200, fill: "forwards" }).finished;
    a.tf("rotate(-8deg)");
    await this._sleep(220);
    // ¡golpe seco! el cepo se cierra de un latigazo de goma
    this._snd("hit");
    both.forEach((e) => e.animate([{ transform: "scale(1,1)" }, { transform: "scale(1.08,.62)", offset: 0.3 }, { transform: "scale(.96,.84)", offset: 0.55 }, { transform: "scale(1.03,.74)", offset: 0.8 }, { transform: "scale(1,.78)" }], { duration: 300, fill: "forwards", easing: "ease-out" }));
    this._shake(false);
    this._burst(cx, cy - 10, 10, "sac-dust", z + 9, { v: 280, spread: 3.2, s: [10, 18], t: 600, g: 150 });
    await this._sleep(300);
    // atrapado, patalea con rabia en el sprite de lanzado
    const fl = [];
    for (let i = 0; i < 22; i++) {
      const k = i % 2 ? -1 : 1;
      fl.push({ transform: `rotate(-8deg) translate(${k * 3}px,${-2 - (i % 3) * 2}px) rotate(${k * (14 + (i % 3) * 5)}deg) scale(${1 + 0.07 * k},${1 - 0.07 * k})` });
    }
    await a.anim(fl, { duration: 1700, easing: "linear" }).finished;
    // el cepo aprieta de golpe: el gnomo EXPLOTA en una lluvia de sangre
    both.forEach((e) => e.animate([{ transform: "scale(1,.78)" }, { transform: "scale(1.05,.6)", offset: 0.4 }, { transform: "scale(1,.66)" }], { duration: 260, fill: "forwards" }));
    a.anim([{ transform: "rotate(-8deg) scale(1,1)", opacity: 1 }, { transform: "rotate(-8deg) scale(1.25,.75)", opacity: 1, offset: 0.7 }, { transform: "rotate(-8deg) scale(1.5,.4)", opacity: 0 }], { duration: 130, fill: "forwards", easing: "ease-in" });
    this._snd("death");
    this._shake(true);
    this._bloodBurst(cx, cy - 30, z + 10);
    this._stain(cx, cy - 6, 126, 42, "blood", 5000);
    this._kill(gnome);
    // el cepo, de un solo uso, se gasta
    if (typeof Backpack !== "undefined") Backpack.traps = Backpack.traps.filter((t) => t !== trap);
    await this._sleep(500);
    a.remove();
    await this._award(team, cx, cy - 90, z);
    this._rm(back.closest(".board-item") || back);
    this._rm(frontJaw.closest(".board-item") || frontJaw);
    trap.el.remove();
  },

  // ---------- 5. Piedra de Rock'n Troll (desde la mochila) ----------
  async rockOnGnome(gnome, team) {
    if (!gnome || !gnome.el || !Gnome.list.includes(gnome)) return;
    gnome.busy = true;
    this.busy++;
    try {
      const c = this._tile(gnome.row, gnome.col);
      const z = this._z(gnome.row, gnome.col) + 4;
      const gx = c.x, gy = c.y + 6;
      gnome.el.style.display = "none";
      const a = this._actor(z, GNOME_ASSETS.idle, SAC_W.ground, gx, gy);
      // ¡PLAF! la piedra cae encima
      a.anim([{ transform: "scale(1)" }, { transform: "scale(1.7,.2)" }], { duration: 90, fill: "forwards" });
      const rock = this._actor(z + 3, "assets/niveles/rockntroll/fragmento.png", 48, gx, gy - 14);
      this._burst(gx, gy - 2, 16, "sac-dust", z + 8, { v: 360, spread: 3.2, s: [14, 30], t: 900, g: 200 });
      this._burst(gx, gy - 14, 8, "sac-chunk", z + 8, { v: 320, spread: 3, s: [8, 14], t: 800, g: 1200, bg: () => "#a97b4e" });
      this._shake(true);
      await this._sleep(500);
      // la piedra rebota y se aleja rodando
      await this._raf(1100, (t) => {
        const bounce = Math.abs(Math.sin(t * Math.PI * 3)) * (1 - t) * 32;
        rock.put(null, null, gx + 118 * t, gy - 8 - bounce);
        rock.tf(`rotate(${t * 900}deg)`, "50% 50%");
      });
      rock.anim([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" }).onfinish = () => rock.remove();
      // se queda plano un segundito...
      a.anim([{ transform: "scale(1.7,.2)" }, { transform: "scale(1.7,.2) translateX(2px)" }, { transform: "scale(1.7,.2) translateX(-2px)" }, { transform: "scale(1.7,.2)" }], { duration: 200, iterations: 3 });
      await this._sleep(650);
      // ...y se levanta como si nada, con un hinchazo de goma
      await a.anim([{ transform: "scale(1.7,.2)" }, { transform: "scale(.85,1.2)", offset: 0.55 }, { transform: "scale(1.08,.94)", offset: 0.8 }, { transform: "scale(1)" }], { duration: 520, easing: "ease-out", fill: "forwards" }).finished;
      a.tf("none");
      // mira a un lado, mira al otro: aquí no ha pasado nada
      await a.anim([{ transform: "translate(0,0) rotate(0)" }, { transform: "translate(0,0) rotate(0)", offset: 0.12 }, { transform: "translate(-4px,0) rotate(-5deg)", offset: 0.3 }, { transform: "translate(-4px,0) rotate(-5deg)", offset: 0.45 }, { transform: "translate(4px,0) rotate(5deg)", offset: 0.65 }, { transform: "translate(4px,0) rotate(5deg)", offset: 0.78 }, { transform: "translate(0,-3px) rotate(0)", offset: 0.88 }, { transform: "translate(0,0) rotate(0)" }], { duration: 1900, easing: "ease-in-out" }).finished;
      // ...y de repente se acuerda: PLAF, aplastado de golpe, con sangre
      a.tf("scale(1.7,.2)");
      this._burst(gx, gy - 4, 14, "sac-dust", z + 8, { v: 300, spread: 3.2, s: [12, 24], t: 700, g: 200 });
      this._shake(false);
      this._snd("death");
      if (typeof BloodSplat !== "undefined") BloodSplat.spawnAt(gnome.row, gnome.col, { lifetime: 4500 });
      this._burst(gx, gy - 8, 14, "", z + 9, { v: 380, spread: 3, s: [6, 12], t: 800, g: 1200, bg: () => "#b81f2a" });
      a.anim([{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], { duration: 600, fill: "forwards" });
      this._kill(gnome);
      await this._sleep(900);
      a.remove();
      await this._award(team, gx, gy - 70, z);
    } finally {
      this.busy--;
    }
  },

  // ---------- 7. Cohete KataPum! ----------
  async rocketOnGnome(gnome, team) {
    if (!gnome || !gnome.el || !Gnome.list.includes(gnome)) return;
    gnome.busy = true;
    this.busy++;
    try {
      const c = this._tile(gnome.row, gnome.col);
      const z = this._z(gnome.row, gnome.col) + 4;
      const gx = c.x, gy = c.y + 6, by = gy - 30;
      gnome.el.style.display = "none";
      this._snd("explosion");
      this._flash();
      this._shake(true);
      const fire = (r, col, d, delay) => setTimeout(() => {
        const e = this._p("", gx, by, r * 2 * SAC_K * 1.4, z + 9);
        e.style.background = col;
        e.animate([{ transform: "scale(.1)", opacity: 1 }, { transform: "scale(1.05)", opacity: 0.95, offset: 0.35 }, { transform: "scale(1.3)", opacity: 0 }], { duration: d, easing: "ease-out" }).onfinish = () => this._rm(e);
      }, delay || 0);
      fire(150, "radial-gradient(circle,#fff,#ffe17a 35%,#ff8a1f 70%,rgba(255,60,0,0))", 520, 0);
      fire(100, "radial-gradient(circle,#fff6c0,#ffb21e 50%,rgba(255,70,0,0))", 460, 90);
      this._ring(gx, by + 8, 420, 150, 700, z + 8);
      setTimeout(() => this._ring(gx, by + 8, 320, 110, 700, z + 8), 120);
      this._burst(gx, by, 24, "sac-lv", z + 10, { v: 700, spread: 3, s: [8, 18], t: 1200, g: 1400 });
      this._burst(gx, by, 16, "sac-em", z + 10, { v: 520, spread: 3.2, s: [4, 8], t: 1100, g: 600 });
      this._burst(gx, by, 10, "sac-smoke", z + 9, { v: 300, spread: 3, s: [40, 80], t: 1700, g: -80, sc: 2.4 });
      this._burst(gx, gy, 12, "sac-dust", z + 9, { v: 340, spread: 3.2, s: [14, 28], t: 900, g: 150 });
      const soot = document.createElement("div");
      soot.className = "sac-soot";
      soot.style.cssText = `left:${gx - 68}px;top:${gy - 22}px;width:136px;height:44px`;
      this._add(soot, 3);
      soot.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, fill: "forwards" });
      setTimeout(() => { soot.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 800, fill: "forwards" }).onfinish = () => this._rm(soot); }, 4500);
      this._kill(gnome);
      await this._sleep(1500);
      for (let i = 0; i < 4; i++) setTimeout(() => this._burst(gx + (Math.random() - 0.5) * 14, gy - 30, 1, "sac-smoke", z + 9, { v: 70, spread: 0.4, s: [22, 34], t: 1500, g: -90, sc: 2 }), i * 220);
      await this._sleep(900);
      await this._award(team, gx, gy - 80, z);
    } finally {
      this.busy--;
    }
  },
};

const GNOME_FIRE = {
  corre: "assets/niveles/rockntroll/gnomo_fuego_corre.png",
  agarrado: "assets/niveles/rockntroll/gnomo_fuego_agarrado.png",
};

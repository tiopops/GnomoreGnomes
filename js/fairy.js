/* Gnomore Gnomes — el Hada de la campaña.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe lo del hada:
   dónde se esconde, cómo se escabulle, cómo se coge, qué pasa si matan a quien
   la lleva, cómo suena y cómo se ve. Se conecta con el resto igual que
   gnome.js/movement.js/combat.js:

     Units.registerRangeProvider(Fairy)  -> la mira de "coger" (la misma mano que el gnomo) al seleccionar una
                                            unidad del jugador que pueda alcanzarla.
     Gnome.isAt / Gnome.reactToPlayerMove -> una línea cada uno: el hada ocupa su casilla (nadie pisa donde ella
                                            está) y reacciona cuando una unidad del jugador se mueve cerca.
     Units.removeUnit                    -> Fairy.onUnitDying(unit): si moría quien la llevaba, se libera y huye.
     Fog.applyVisibility                 -> Fairy.refreshFog(): bajo la niebla no se ve.
     Campaign                            -> la coloca (Fairy.place), la reinicia (Fairy.resetAll) y al extraer
                                            pregunta Fairy.carrierAlive() para darla por rescatada.

   Comportamiento (pedido explícito): hay UNA por fase, escondida en un sitio distinto cada vez (detrás de un
   arbusto, apartada o junto a enemigos). Está quieta, pero su campo de visión es enorme (FAIRY_VISION casillas) y
   en cuanto una unidad del jugador se acerca sale volando a toda velocidad (FAIRY_HOPS saltos de 1-2 casillas, en
   zigzag): hay que acorralarla contra un borde o pillarla despistada. Los enemigos la ignoran y ella a ellos.
   Quien la lleva brilla en dorado, pulsando, con una hadita encima; si lo matan se libera y escapa corriendo. */

const FAIRY_ASSETS = {
  idle: "assets/campana/hada_idle_midres.png",
  corre: "assets/campana/hada_corre_midres.png",
};
const FAIRY_VISION = 6; // casillas a las que ya se ha fijado en una unidad del jugador (muy grande a propósito)
const FAIRY_HOPS = 4; // saltos que da al escapar cada vez
const FAIRY_HOP_MS = 150; // lo que dura cada salto (rapidísima)
const FAIRY_FREEZE_CHANCE = 0.4; // probabilidad de quedarse petrificada un instante si la tienes JUSTO al lado y aún no has actuado
const FAIRY_SIZES = { idle: 58, run: 72 }; // ancho (px) del sprite posada / corriendo
const FAIRY_LIFT = 30; // px que flota por encima del suelo (la sombra se queda en la loseta)

// ---------------------------------------------------------------------------------------------------------------
// Sonido: todo sintetizado (Web Audio) con la misma cadena que SFX (master + compresor), con un eco brillante
// propio para que suene a "polvo de hada": campanitas con parciales inarmónicos, destellos y aleteo filtrado.
// Todo a volumen bajo y envolventes suaves (sin clics) — agradable, nunca estridente.
// ---------------------------------------------------------------------------------------------------------------
const FairySFX = {
  _echo: null,
  _ctx() {
    try {
      if (typeof SFX === "undefined") return null;
      const c = SFX.ensureCtx();
      if (!c || !SFX.master) return null;
      if (c.state === "suspended" && !(SFX._inBg && SFX._inBg())) c.resume();
      // (MatchCleanup sustituye SFX.master al empezar/salir de una partida: el eco se reconecta al nuevo, si no sonaría al vacío)
      if (!this._echo || this._echo.ctx !== c || this._echo.master !== SFX.master) {
        const input = c.createGain(), dly = c.createDelay(0.6), fb = c.createGain(), lp = c.createBiquadFilter(), wet = c.createGain();
        dly.delayTime.value = 0.19; fb.gain.value = 0.34; lp.type = "lowpass"; lp.frequency.value = 4200; wet.gain.value = 0.42;
        input.connect(dly); dly.connect(lp); lp.connect(fb); fb.connect(dly); lp.connect(wet); wet.connect(SFX.master);
        input.connect(SFX.master);
        this._echo = { ctx: c, input, master: SFX.master };
      }
      return c;
    } catch (e) { return null; }
  },
  _noise(c, dur) {
    const n = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  },
  // Campanita de cristal: fundamental + dos parciales inarmónicos que se apagan antes; ataque de 6 ms y caída exponencial.
  bell(f, at, dur, vol) {
    const c = this._ctx(); if (!c) return;
    const t0 = c.currentTime + at;
    [[1, 1], [2.76, 0.34], [5.4, 0.12]].forEach(([m, g], i) => {
      const o = c.createOscillator(), a = c.createGain();
      o.type = "sine"; o.frequency.value = f * m * (1 + (i ? 0.0015 * i : 0));
      const d = dur / (1 + i * 0.9);
      a.gain.setValueAtTime(0.0001, t0); a.gain.linearRampToValueAtTime(vol * g, t0 + 0.006); a.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(a).connect(this._echo.input); o.start(t0); o.stop(t0 + d + 0.05);
    });
  },
  // Destello: seno que sube (o baja) de tono muy rápido, como una chispa.
  glint(f0, f1, at, dur, vol) {
    const c = this._ctx(); if (!c) return;
    const t0 = c.currentTime + at, o = c.createOscillator(), a = c.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.8);
    a.gain.setValueAtTime(0.0001, t0); a.gain.linearRampToValueAtTime(vol, t0 + 0.01); a.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(a).connect(this._echo.input); o.start(t0); o.stop(t0 + dur + 0.03);
  },
  // Aleteo: ruido de banda estrecha modulado en amplitud (~30 Hz), con barrido de frecuencia.
  flutter(at, dur, vol, f0 = 2200, f1 = 3400) {
    const c = this._ctx(); if (!c) return;
    const t0 = c.currentTime + at, s = c.createBufferSource(), bp = c.createBiquadFilter(), a = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    s.buffer = this._noise(c, dur + 0.05); bp.type = "bandpass"; bp.Q.value = 5.5; bp.frequency.setValueAtTime(f0, t0); bp.frequency.linearRampToValueAtTime(f1, t0 + dur);
    a.gain.setValueAtTime(0.0001, t0); a.gain.linearRampToValueAtTime(vol, t0 + dur * 0.25); a.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    lfo.frequency.value = 30; lg.gain.value = vol * 0.55; lfo.connect(lg).connect(a.gain);
    s.connect(bp).connect(a).connect(this._echo.input); s.start(t0); lfo.start(t0); s.stop(t0 + dur + 0.05); lfo.stop(t0 + dur + 0.05);
  },
  // Pad cálido (acorde de triángulos con ataque lento) para dar cuerpo a las recompensas.
  pad(freqs, at, dur, vol) {
    const c = this._ctx(); if (!c) return;
    const t0 = c.currentTime + at;
    freqs.forEach((f) => {
      const o = c.createOscillator(), a = c.createGain(), lp = c.createBiquadFilter();
      o.type = "triangle"; o.frequency.value = f; lp.type = "lowpass"; lp.frequency.value = 1800;
      a.gain.setValueAtTime(0.0001, t0); a.gain.linearRampToValueAtTime(vol, t0 + dur * 0.3); a.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(lp).connect(a).connect(this._echo.input); o.start(t0); o.stop(t0 + dur + 0.05);
    });
  },

  // --- Eventos ---
  spot() { this.glint(1568, 2349, 0, 0.12, 0.05); this.bell(1976, 0.05, 0.5, 0.07); this.bell(2637, 0.13, 0.6, 0.06); this.flutter(0.02, 0.16, 0.05); },
  wing() { this.flutter(0, 0.11, 0.04, 2600, 3800); },
  flee() { this.flutter(0, 0.34, 0.09, 1800, 4200); this.glint(2093, 4186, 0.02, 0.18, 0.05); [3136, 2637, 2093].forEach((f, i) => this.bell(f, 0.06 + i * 0.07, 0.4, 0.05)); },
  freeze() { this.bell(1760, 0, 0.4, 0.06); this.glint(2200, 1500, 0.02, 0.16, 0.04); },
  catch() {
    [523.25, 659.25, 783.99].forEach((f, i) => this.bell(f, i * 0.045, 1.1, 0.13));
    this.bell(1046.5, 0.14, 1.2, 0.1); this.bell(1568, 0.2, 1.3, 0.07);
    this.glint(1200, 3600, 0, 0.32, 0.06); this.flutter(0.02, 0.3, 0.06);
    this.pad([261.63, 329.63, 392], 0.04, 1.2, 0.035);
  },
  release() { [1318.5, 987.77, 783.99, 587.33].forEach((f, i) => this.bell(f, i * 0.09, 0.7, 0.09)); this.flutter(0.25, 0.3, 0.08, 3600, 1800); },
  rescue() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093].forEach((f, i) => this.bell(f, i * 0.085, 1.5, 0.11 - i * 0.004));
    this.pad([261.63, 329.63, 392, 523.25], 0.1, 1.9, 0.05);
    for (let i = 0; i < 7; i++) this.glint(1800 + Math.random() * 1600, 3200 + Math.random() * 2400, 0.35 + i * 0.12, 0.2, 0.035);
  },
  twinkle() { this.bell(2349, 0, 0.5, 0.05); this.bell(3136, 0.09, 0.5, 0.04); },
};

// ---------------------------------------------------------------------------------------------------------------
const Fairy = {
  inst: null, // el hada de la fase: { el, flipEl, floatEl, spriteEl, shadowEl, row, col, facing, carrier, busy }
  discovered: false,

  // ---------- Ciclo de vida ----------
  resetAll() {
    if (this.inst && this.inst.el) this.inst.el.remove();
    this.inst = null;
    this._releaseCarrierFx();
  },

  // Crea el hada escondida. `free(r, c)` lo da la campaña (casilla sin escenario/edificios). Una sola por fase,
  // en un sitio distinto cada vez: detrás de un arbusto, apartada (borde del mapa) o cerca de enemigos.
  place(size, obelisk, free) {
    this.resetAll();
    const near = (r, c, list, d) => list.some((u) => Math.max(Math.abs(u.row - r), Math.abs(u.col - c)) <= d);
    const enemies = Units.list.filter((u) => u.team === "enemy");
    const cands = { bush: [], remote: [], foe: [], any: [] };
    for (let r = 1; r < size - 1; r++) {
      for (let c = 1; c < size - 1; c++) {
        if (!free(r, c) || Units.unitAt(r, c) || Gnome.isAt(r, c)) continue;
        if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(r, c)) continue;
        if (this._shore(r, c)) continue; // ni en el agua ni pegada a ella: que nunca parezca flotar sobre un lago
        if (obelisk && Math.max(Math.abs(obelisk.row - r), Math.abs(obelisk.col - c)) < 6) continue;
        // "Detrás" de un arbusto = hacia el fondo de la pantalla: el arbusto la tapa por orden isométrico.
        if (typeof Bushes !== "undefined" && [[1, 1], [1, 0], [0, 1]].some(([dr, dc]) => Bushes.at(r + dr, c + dc))) cands.bush.push({ row: r, col: c });
        if (Math.min(r, c, size - 1 - r, size - 1 - c) <= 2) cands.remote.push({ row: r, col: c });
        if (near(r, c, enemies, 2) && !near(r, c, enemies, 0)) cands.foe.push({ row: r, col: c });
        cands.any.push({ row: r, col: c });
      }
    }
    const roll = Math.random(), order = roll < 0.4 ? ["bush", "remote", "foe", "any"] : roll < 0.75 ? ["remote", "bush", "foe", "any"] : ["foe", "bush", "remote", "any"];
    const key = order.find((k) => cands[k].length), pool = key ? cands[key] : null;
    if (!pool) return null;
    const spot = pool[Math.floor(Math.random() * pool.length)];
    this._spawn(spot.row, spot.col);
    return this.inst;
  },

  _spawn(row, col) {
    const el = document.createElement("div");
    el.className = "unit fairy";
    const shadowEl = document.createElement("div");
    shadowEl.className = "fairy__shadow";
    const flipEl = document.createElement("div");
    flipEl.className = "unit__flip fairy__flip";
    const floatEl = document.createElement("div");
    floatEl.className = "fairy__float";
    const spriteEl = document.createElement("img");
    spriteEl.className = "fairy__sprite";
    spriteEl.src = FAIRY_ASSETS.idle;
    spriteEl.alt = "";
    spriteEl.draggable = false;
    spriteEl.style.width = FAIRY_SIZES.idle + "px";
    floatEl.appendChild(spriteEl);
    flipEl.appendChild(floatEl);
    el.appendChild(shadowEl);
    el.appendChild(flipEl);
    Units.container.appendChild(el);
    const inst = { el, flipEl, floatEl, spriteEl, shadowEl, row, col, facing: "right", carrier: null, busy: false, isFairy: true };
    this.inst = inst;
    el.addEventListener("pointerdown", (e) => e.stopPropagation());
    const marker = () => document.querySelector(`.catch-marker--visible[data-row="${inst.row}"][data-col="${inst.col}"]`);
    const sync = () => el.classList.toggle("fairy--catchable", !!marker() && !inst.carrier);
    el.addEventListener("mouseover", sync);
    el.addEventListener("mousemove", sync);
    el.addEventListener("mouseleave", () => el.classList.remove("fairy--catchable"));
    el.addEventListener("click", (e) => {
      if (inst.carrier || e.target.closest(".catch-marker")) return;
      const m = marker();
      if (!m) return;
      e.stopPropagation();
      m.click();
      el.classList.remove("fairy--catchable");
    });
    Units._placeInstant(inst);
    this.refreshFog();
  },

  // ---------- Consultas ----------
  isAt(row, col) { const i = this.inst; return !!i && !!i.el && !i.carrier && i.row === row && i.col === col; },
  isHeldBy(unitId) { return !!this.inst && this.inst.carrier === unitId; },
  carrierAlive() { const i = this.inst; return !!(i && i.carrier && Units.list.some((u) => u.id === i.carrier)); },
  visible() { const i = this.inst; return !!i && (!!i.carrier || (!!i.el && !i.el.closest(".unit--fog-hidden") && !i.el.classList.contains("unit--fog-hidden"))); },

  refreshFog() {
    const i = this.inst;
    if (!i || !i.el || i.carrier || typeof Fog === "undefined") return;
    const hidden = Fog.isFoggedReal(i.row, i.col) || (Fog.isPerceived && !Fog.isPerceived(i.row, i.col));
    const was = i.el.classList.contains("unit--fog-hidden");
    i.el.classList.toggle("unit--fog-hidden", hidden);
    if (was && !hidden) this._onSeen();
  },
  _onSeen() { FairySFX.spot(); },

  // true si la casilla o alguna de sus vecinas es agua (el hada vuela, pero no debe verse sobre el agua).
  _shore(r, c) {
    if (typeof TerrainMap === "undefined") return false;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (!TerrainMap.isWalkable(r + dr, c + dc) && TerrainMap.typeAt(r + dr, c + dc) === "water") return true;
    return false;
  },

  _blocked(r, c, selfUnit) {
    if (r < 0 || c < 0 || r >= Units.boardSize || c >= Units.boardSize) return true;
    if (Units.unitAt(r, c) && (!selfUnit || Units.unitAt(r, c) !== selfUnit)) return true;
    if (typeof Gnome !== "undefined" && Gnome.list.some((g) => g.isAt(r, c))) return true;
    if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(r, c)) return true;
    const mods = [typeof Villages !== "undefined" && Villages, typeof Shops !== "undefined" && Shops, typeof Obelisks !== "undefined" && Obelisks, typeof Altar !== "undefined" && Altar,
      typeof GnomOgro !== "undefined" && GnomOgro, typeof Resources !== "undefined" && Resources, typeof Drums !== "undefined" && Drums, typeof Bushes !== "undefined" && Bushes,
      typeof Oracle !== "undefined" && Oracle, typeof Bumpers !== "undefined" && Bumpers];
    return mods.some((m) => m && m.at && m.at(r, c));
  },

  // ---------- Coger (mira con la mano, igual que el gnomo) ----------
  showFor(unit) {
    const i = this.inst;
    if (!i || !i.el || i.carrier || i.busy || unit.team !== "player") return;
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    if (this.isHeldBy(unit.id) || i.el.classList.contains("unit--fog-hidden")) return;
    if (typeof Mushrooms !== "undefined" && Mushrooms.isHeldBy && Mushrooms.isHeldBy(unit.id)) return;
    if (!this._approach(unit)) return;
    Units.addMarker({
      className: "catch-marker",
      row: i.row, col: i.col, zOffset: 6, visibleClass: "catch-marker--visible", owner: "fairy",
      buildContent: (m) => { const ic = document.createElement("i"); ic.className = "ph ph-hand-grabbing catch-marker__icon"; m.appendChild(ic); },
      onClick: () => this.catchBy(unit),
    });
  },

  // Casilla desde la que `unit` alcanza al hada (adyacente a ella, dentro de su movimiento y sin cruzar agua).
  _approach(unit) {
    const i = this.inst;
    const dist = (r, c) => Math.max(Math.abs(r - i.row), Math.abs(c - i.col));
    if (dist(unit.row, unit.col) <= 1) return { row: unit.row, col: unit.col };
    const range = Units.moveRangeOf(unit);
    let best = null, bd = Infinity;
    for (let r = 0; r < Units.boardSize; r++) {
      for (let c = 0; c < Units.boardSize; c++) {
        if (dist(r, c) > 1 || (r === i.row && c === i.col) || (r === unit.row && c === unit.col)) continue;
        if (this._blocked(r, c)) continue;
        const md = Math.max(Math.abs(r - unit.row), Math.abs(c - unit.col));
        if (md > range || (typeof Skills !== "undefined" && Skills.moveCost && Skills.moveCost(unit, r, c) > range)) continue;
        if (!Units.pathIsWalkable(unit.row, unit.col, r, c, unit.team)) continue;
        if (md < bd) { bd = md; best = { row: r, col: c }; }
      }
    }
    return best;
  },

  async catchBy(unit) {
    const i = this.inst;
    if (!i || i.carrier || i.busy) return;
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    Units.clearRangeOverlays();
    const ap = this._approach(unit);
    if (!ap) return;
    i.busy = true;
    if (ap.row !== unit.row || ap.col !== unit.col) {
      await Units.walkPath(unit, Units.stepPath(unit.row, unit.col, ap.row, ap.col), { noGnomeReact: true });
      if (typeof Fog !== "undefined" && unit.team === "player") Fog.revealForUnit(unit);
    }
    Units.faceTowardsTile(unit, i.row, i.col);
    await this._attach(unit);
    i.busy = false;
    if (typeof Turns !== "undefined") Turns.useAction(unit);
    if (typeof Gnome !== "undefined") await Gnome.reactToStop(unit);
    Units.refreshRange(unit);
  },

  // El hada vuela a la cabeza de la unidad y se queda con ella; la unidad se pone a brillar en dorado.
  async _attach(unit) {
    const i = this.inst, from = getTileCenter(i.row, i.col, Units.boardSize);
    FairySFX.catch();
    this._burst(from.x, from.y - 70, 13, "#ffcf3d", 100, 650);
    i.carrier = unit.id;
    const to = getTileCenter(unit.row, unit.col, Units.boardSize);
    i.el.style.transition = "left .28s ease-in, top .28s ease-in";
    i.el.style.left = to.x + "px"; i.el.style.top = to.y + "px";
    await new Promise((r) => setTimeout(r, 270));
    i.el.style.display = "none";
    i.el.style.transition = "";
    this._markCarrier(unit, true);
    this._burst(to.x, to.y - 90, 10, "#fff1a8", 72, 520);
    this._ring(to.x, to.y);
    unit.el.animate([{ translate: "0 0" }, { translate: "0 -14px" }, { translate: "0 0" }], { duration: 320, easing: "ease-out" });
    if (typeof Gnomoteca !== "undefined" && Gnomoteca.discover) Gnomoteca.discover("u:hada");
  },

  _markCarrier(unit, on) {
    if (!unit || !unit.el) return;
    unit.el.classList.toggle("unit--fairy", on);
    let badge = unit.el.querySelector(".fairy-carry");
    if (on && !badge) {
      badge = document.createElement("img");
      badge.className = "fairy-carry";
      badge.src = FAIRY_ASSETS.idle; badge.alt = ""; badge.draggable = false;
      unit.el.appendChild(badge);
    } else if (!on && badge) badge.remove();
  },
  _releaseCarrierFx() {
    if (typeof Units === "undefined" || !Units.list) return;
    Units.list.forEach((u) => { if (u.el && u.el.classList.contains("unit--fairy")) this._markCarrier(u, false); });
  },

  // ---------- Escabullirse ----------
  async reactToPlayerMove(mover) {
    const i = this.inst;
    if (!i || !i.el || i.carrier || i.busy) return;
    if (!mover || mover.team !== "player" || !Units.list.includes(mover)) return;
    // Una unidad escondida en un arbusto es invisible para el hada (igual que para los neutrales y los gnomos).
    const hid = (u) => typeof Bushes !== "undefined" && Bushes.isHidingUnit(u);
    if (hid(mover)) return;
    const players = Units.list.filter((u) => u.team === "player" && !hid(u));
    if (!players.length) return;
    const d = Math.min(...players.map((u) => Math.max(Math.abs(u.row - i.row), Math.abs(u.col - i.col))));
    if (d > FAIRY_VISION) return;
    // Si la tienes JUSTO al lado y esa unidad aún puede actuar, a veces se queda petrificada un instante (ventana para cogerla).
    const dm = Math.max(Math.abs(mover.row - i.row), Math.abs(mover.col - i.col));
    if (dm <= 1 && (typeof Turns === "undefined" || Turns.canAct(mover)) && Math.random() < FAIRY_FREEZE_CHANCE) {
      FairySFX.freeze();
      i.spriteEl.animate([{ translate: "0 0" }, { translate: "-3px 0" }, { translate: "3px 0" }, { translate: "0 0" }], { duration: 240, iterations: 2 });
      return;
    }
    await this._flee(players);
  },

  async _flee(players) {
    const i = this.inst;
    if (!i || i.busy) return;
    i.busy = true;
    this._setRun(true);
    FairySFX.flee();
    const dmin = (r, c) => Math.min(...players.map((u) => Math.max(Math.abs(u.row - r), Math.abs(u.col - c))));
    const size = Units.boardSize;
    for (let h = 0; h < FAIRY_HOPS; h++) {
      const opts = [];
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const r = i.row + dr, c = i.col + dc;
          if (!(dr || dc) || this._blocked(r, c) || this._shore(r, c) || !Units.pathIsWalkable(i.row, i.col, r, c, "player")) continue;
          const edge = Math.min(r, c, size - 1 - r, size - 1 - c) <= 0;
          opts.push({ r, c, s: dmin(r, c) * 1.5 + Math.random() * 2.4 - (edge ? 1.2 : 0) });
        }
      }
      opts.sort((a, b) => b.s - a.s);
      const best = opts[0];
      if (!best || dmin(best.r, best.c) < Math.min(dmin(i.row, i.col), 3)) break; // arrinconada: ya no puede alejarse más
      await this._hop(best.r, best.c);
    }
    this._setRun(false);
    i.busy = false;
    this.refreshFog();
    // Si quien selecciona una unidad tiene la mira de coger a la vista, se actualiza con la nueva posición.
    const sel = Units.list.find((u) => u.id === Units.selectedId);
    if (sel && typeof Units.refreshProviderFor === "function") Units.refreshProviderFor(sel, this, "fairy");
  },

  _hop(row, col) {
    const i = this.inst;
    Units.faceTowardsTile(i, row, col);
    i.row = row; i.col = col;
    const { x, y } = getTileCenter(row, col, Units.boardSize);
    i.el.style.transition = `left ${FAIRY_HOP_MS}ms linear, top ${FAIRY_HOP_MS}ms linear, opacity .3s ease`;
    i.el.style.left = x + "px"; i.el.style.top = y + "px";
    i.el.style.zIndex = String((row + col) * 10 + 5);
    FairySFX.wing();
    this.refreshFog();
    return new Promise((r) => setTimeout(r, FAIRY_HOP_MS + 10));
  },

  _setRun(on) {
    const i = this.inst;
    if (!i || !i.spriteEl) return;
    i.spriteEl.src = on ? FAIRY_ASSETS.corre : FAIRY_ASSETS.idle;
    i.spriteEl.style.width = (on ? FAIRY_SIZES.run : FAIRY_SIZES.idle) + "px";
    i.el.classList.toggle("fairy--run", on);
  },

  // ---------- Si matan a quien la lleva ----------
  async onUnitDying(unit) {
    const i = this.inst;
    if (!i || i.carrier !== unit.id) return;
    i.carrier = null;
    this._markCarrier(unit, false);
    // Aparece junto a la unidad caída (una casilla libre cercana) y sale corriendo.
    let spot = { row: unit.row, col: unit.col };
    for (let r = 1; r <= 3; r++) {
      const ring = [];
      for (let dr = -r; dr <= r; dr++) for (let dc = -r; dc <= r; dc++) if (Math.max(Math.abs(dr), Math.abs(dc)) === r && !this._blocked(unit.row + dr, unit.col + dc, unit)) ring.push({ row: unit.row + dr, col: unit.col + dc });
      if (ring.length) { spot = ring[Math.floor(Math.random() * ring.length)]; break; }
    }
    i.row = spot.row; i.col = spot.col;
    Units._placeInstant(i);
    i.el.style.display = "";
    FairySFX.release();
    const p = getTileCenter(i.row, i.col, Units.boardSize);
    this._burst(p.x, p.y - 70, 9, "#ffcf3d", 80, 520);
    const players = Units.list.filter((u) => u.team === "player" && u !== unit);
    await new Promise((r) => setTimeout(r, 260));
    await this._flee(players.length ? players : [unit]);
  },

  // ---------- Efectos (colores planos, sin brillos) ----------
  _burst(x, y, n, col, d0, dur) {
    const root = Units.container;
    for (let k = 0; k < n; k++) {
      const e = document.createElement("i"), a = (k / n) * Math.PI * 2 + Math.random() * 0.4, d = d0 * (0.6 + Math.random() * 0.6), sz = 7 + Math.random() * 7;
      e.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${sz}px;height:${sz}px;background:${col};border:2px solid #14121a;z-index:4800;pointer-events:none`;
      root.appendChild(e);
      e.animate([{ transform: "translate(-50%,-50%) rotate(45deg) scale(1)", opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) rotate(225deg) scale(.2)`, opacity: 0 }], { duration: dur, easing: "ease-out" }).onfinish = () => e.remove();
    }
  },
  _ring(x, y) {
    const e = document.createElement("i");
    e.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:30px;height:16px;border:5px solid #ffcf3d;border-radius:50%;z-index:4700;pointer-events:none`;
    Units.container.appendChild(e);
    e.animate([{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 }, { transform: "translate(-50%,-50%) scale(9)", opacity: 0 }], { duration: 600, easing: "ease-out" }).onfinish = () => e.remove();
  },
};

if (typeof Units !== "undefined") Units.registerRangeProvider(Fairy);

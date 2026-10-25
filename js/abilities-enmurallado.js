/* Gnomore Gnomes — habilidades del Equipo Enmurallado.
   Regla de oro: un archivo por mecánica. Se carga DESPUÉS de js/abilities.js y se
   engancha a él sin tocar su lógica: añade las 3 entradas a ABILITIES y envuelve
   Abilities._activate / onTurnStart, Fog._recomputePerception y Turns (fin de turno).
     - TrazaFlechas · Flecha Rastreadora: flecha a un rival visible a máx. 3 casillas.
       Le quita 1 de vida y lo MARCA: mientras siga vivo, su dueño ve dónde está y
       todo lo que ve esa unidad (su percepción), aunque esté lejos.
     - MagoNífico · Cambiazo: intercambia su posición con un rival que estés viendo.
       Al final del turno de quien lo usa, cada uno vuelve a la casilla donde estaba
       cuando se produjo el intercambio.
     - PortaMuros · Muro Aplastante: aplasta a un rival adyacente: 1 de daño y lo deja
       inactivo durante una ronda (su dueño no puede manejarlo, pero sí se le puede
       atacar o lanzarle habilidades — mismo mecanismo que Nudillos Rocosos).
   Efectos: colores naranja del equipo, formas planas con sombra dura (sin brillos
   difusos), sonidos propios en js/sfx.js. */

Object.assign(ABILITIES, {
  trazaflechas: {
    name: "Flecha Rastreadora",
    icon: "ph-crosshair",
    iconImg: "assets/iconos/flecha_rastreadora.png",
    description:
      "Dispara una flecha a un rival que veas a un máximo de 3 casillas: le quita 1 punto de vida y lo marca. Mientras siga vivo, ves dónde está y todo lo que ve esa unidad. Gasta 1 acción. Un uso por partida: se recarga si empiezas el turno junto a un tótem propio.",
  },
  magonifico: {
    name: "Cambiazo",
    icon: "ph-arrows-left-right",
    iconImg: "assets/iconos/intercambio_magico.png",
    description:
      "Intercambia su posición con la de un rival que estés viendo. Al final del turno, cada uno vuelve a la casilla donde estaba cuando se produjo el intercambio. Gasta 1 acción. Un uso por partida: se recarga si empiezas el turno junto a un tótem propio.",
  },
  portamuros: {
    name: "Muro Aplastante",
    icon: "ph-wall",
    iconImg: "assets/iconos/muro_aplastante.png",
    description:
      "Aplasta a un rival adyacente: le hace 1 punto de daño y lo deja inactivo durante una ronda. Su dueño no puede manejarlo hasta que termine el efecto, pero puedes seguir atacándolo o lanzándole habilidades. Gasta 1 acción. Un uso por partida: se recarga si empiezas el turno junto a un tótem propio.",
  },
});

const Enmurallado = {
  ORANGE: ["#ff8a1f", "#ffb347", "#ffd27a"],
  BLUE: "#4cc3ff",
  ARROW_RANGE: 3,

  cheb(a, b) {
    return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
  },
  sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  },
  rnd() {
    return typeof NR === "function" ? NR() : Math.random();
  },
  // ¿Lo está viendo el jugador local ahora mismo? (los rivales bajo niebla/arbusto llevan esta clase)
  visible(u) {
    return !!u && !!u.el && !u.el.classList.contains("unit--fog-hidden");
  },

  // ---------- Utilidades compartidas ----------
  async hurt(unit, dmg, causerTeam) {
    unit.hp = Math.max(0, unit.hp - dmg);
    Units.updateHpBar(unit);
    Units.spawnFloatingText(unit, `-${dmg}`, { className: "dmg-popup" });
    Units.playShake(unit);
    if (typeof SFX !== "undefined") SFX.hit();
    if (unit.hp <= 0) {
      if (causerTeam && unit.team !== causerTeam && typeof Glory !== "undefined") Glory.queueKillBonus(causerTeam);
      await Units.removeUnit(unit);
      if (typeof Gnome !== "undefined") await Gnome.dropHeldBy(unit);
    }
  },

  // Recalcula todo lo que depende de dónde está una unidad tras moverla a la fuerza.
  settle(unit) {
    if (typeof Bushes !== "undefined") Bushes.clearHiddenUnit(unit.id);
    Abilities.checkTrigger(unit);
    if (typeof Skills !== "undefined") Skills.refreshCohesion();
    if (typeof Fog !== "undefined" && unit.team === "player") Fog.revealForUnit(unit);
    if (typeof Fog !== "undefined") Fog.applyVisibility();
    if (typeof Villages !== "undefined") Villages.refreshOcclusion();
    if (typeof Obelisks !== "undefined") Obelisks.refreshOcclusion();
    if (typeof Altar !== "undefined") Altar.refreshOcclusion();
    if (typeof Bushes !== "undefined") Bushes.refreshOcclusion();
    Units.refreshUnitOcclusion();
    if (typeof Shops !== "undefined") Shops.refreshAll();
    if (Units.list.includes(unit)) Units.refreshRange(unit);
  },

  fxEl(cls, x, y, z) {
    const e = document.createElement("div");
    e.className = cls;
    e.style.left = `${x}px`;
    e.style.top = `${y}px`;
    e.style.zIndex = String(z);
    Units.container.appendChild(e);
    return e;
  },
  done(anim, e) {
    anim.onfinish = () => e.remove();
    anim.oncancel = () => e.remove();
  },

  // Anillo plano que se expande por el suelo de una casilla.
  ring(x, y, { color = "#ff8a1f", w = 330, h = 180, ms = 600, bw = 6, z = 2800, delay = 0 } = {}) {
    const e = this.fxEl("ew-ring", x, y, z);
    e.style.borderColor = color;
    this.done(
      e.animate(
        [
          { width: "30px", height: "17px", opacity: 1, borderWidth: `${bw}px` },
          { width: `${w}px`, height: `${h}px`, opacity: 0, borderWidth: "1px" },
        ],
        { duration: ms, delay, easing: "cubic-bezier(.15,.7,.3,1)", fill: "both" }
      ),
      e
    );
  },

  // Esquirlas planas (rombos/triángulos) que salen disparadas.
  shards(x, y, n, { colors = this.ORANGE, speed = 90, lift = 60, ms = 650, z = 2910, size = 12 } = {}) {
    for (let i = 0; i < n; i++) {
      const e = this.fxEl("ew-shard", x, y, z);
      const sz = size * (0.6 + this.rnd() * 0.9);
      e.style.width = e.style.height = `${sz}px`;
      e.style.background = colors[i % colors.length];
      const ang = (i / n) * Math.PI * 2 + this.rnd() * 0.5;
      const v = speed * (0.6 + this.rnd() * 0.8);
      const tx = Math.cos(ang) * v, ty = Math.sin(ang) * v * 0.55;
      this.done(
        e.animate(
          [
            { transform: "translate(-50%,-50%) rotate(45deg) scale(1)", opacity: 1 },
            { transform: `translate(calc(-50% + ${tx * 0.7}px),calc(-50% + ${ty - lift}px)) rotate(${180 + this.rnd() * 200}deg) scale(1)`, opacity: 1, offset: 0.5 },
            { transform: `translate(calc(-50% + ${tx}px),calc(-50% + ${ty + 12}px)) rotate(${360 + this.rnd() * 240}deg) scale(.3)`, opacity: 0 },
          ],
          { duration: ms * (0.8 + this.rnd() * 0.5), easing: "cubic-bezier(.3,.6,.5,1)", fill: "both" }
        ),
        e
      );
    }
  },

  shakeBoard(amp = 6) {
    if (!Units.container) return;
    const frames = [];
    for (let i = 0; i < 9; i++) {
      const a = amp * (1 - i / 9);
      frames.push({ translate: `${(this.rnd() - 0.5) * 2 * a}px ${(this.rnd() - 0.5) * 2 * a}px` });
    }
    frames.push({ translate: "0px 0px" });
    Units.container.animate(frames, { duration: 360 });
  },

  // Elegir objetivo: un marcador clicable en la casilla de cada rival válido (no depende de
  // acertar con el sprite, que puede quedar tapado por árboles, rocas u otras unidades).
  // También vale pulsar el propio sprite. Un clic en cualquier otro sitio cancela sin gastar.
  pickTarget(unit, valid, hint, onPick) {
    const targets = Units.list.filter(valid);
    Units.clearRangeOverlays();
    if (typeof UiHint !== "undefined") UiHint.show(hint);
    targets.forEach((t, i) =>
      Units.addMarker({
        className: "range-marker ability-throw-marker ew-target-marker",
        row: t.row,
        col: t.col,
        zOffset: 2,
        alwaysOnTop: true,
        delayMs: Units.staggerDelay(i, targets.length),
        visibleClass: "range-marker--visible",
        onClick: () => {
          if (typeof UiHint !== "undefined") UiHint.hide();
          onPick(t);
        },
      })
    );
  },

  // =====================================================================
  // TrazaFlechas · Flecha Rastreadora
  // =====================================================================
  trackValid(unit) {
    return (u) => u.team !== unit.team && this.cheb(u, unit) <= this.ARROW_RANGE && (unit.team !== "player" || this.visible(u));
  },

  activateTrackerArrow(unit) {
    const valid = this.trackValid(unit);
    const targets = Units.list.filter(valid);
    if (targets.length === 0) {
      if (typeof SFX !== "undefined") SFX.back();
      return; // sin rival a la vista y al alcance, no se gasta
    }
    if (targets.length === 1) return this.resolveTrackerArrow(unit, targets[0]);
    this.pickTarget(unit, valid, "Elige a quién disparar", (t) => this.resolveTrackerArrow(unit, t));
  },

  async resolveTrackerArrow(unit, target) {
    Units.clearRangeOverlays();
    if (typeof UiHint !== "undefined") UiHint.hide();
    Units.faceTowardsTile(unit, target.row, target.col);
    Abilities._consume(unit);
    const S = Units.boardSize;
    const a = getTileCenter(unit.row, unit.col, S);
    const b = getTileCenter(target.row, target.col, S);
    const dist = this.cheb(unit, target);

    // 1) tensa el arco: se encoge hacia atrás y se estira al soltar
    if (typeof SFX !== "undefined") SFX.arrowDraw();
    const sp = unit.spriteEl;
    if (sp)
      sp.animate(
        [
          { transform: "scale(1,1)" },
          { transform: "scale(1.1,.88)", offset: 0.55 },
          { transform: "scale(.9,1.14)", offset: 0.8 },
          { transform: "scale(1,1)" },
        ],
        { duration: 520, easing: "ease-out" }
      );
    await this.sleep(430);

    // 2) vuelo de la flecha por una parábola, con estela de chispas planas
    const x0 = a.x, y0 = a.y - 62, x1 = b.x, y1 = b.y - 56;
    const arc = 26 + dist * 14;
    const dur = 330 + dist * 70;
    const P = (t) => ({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t - arc * 4 * t * (1 - t) });
    const frames = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10, p = P(t), q = P(Math.min(1, t + 0.02)), p0 = P(Math.max(0, t - 0.02));
      const ang = (Math.atan2(q.y - p0.y, q.x - p0.x) * 180) / Math.PI;
      frames.push({ transform: `translate(${p.x - x0}px,${p.y - y0}px) translate(-50%,-50%) rotate(${ang}deg)`, offset: t });
    }
    const arrow = this.fxEl("ew-arrow", x0, y0, 2950);
    arrow.innerHTML =
      '<svg width="78" height="20" viewBox="0 0 78 20"><polygon points="0,3 14,3 18,10 14,17 0,17 5,10" fill="#ff8a1f" stroke="#1b1208" stroke-width="2" stroke-linejoin="round"/><rect x="14" y="8" width="42" height="4" fill="#8a5a2b" stroke="#1b1208" stroke-width="1.5"/><polygon points="54,2 78,10 54,18 58,10" fill="#d7dbe2" stroke="#1b1208" stroke-width="2" stroke-linejoin="round"/></svg>';
    if (typeof SFX !== "undefined") SFX.arrowRelease(dur / 1000);
    const tFly = performance.now();
    const trail = setInterval(() => {
      const t = Math.min(1, (performance.now() - tFly) / dur), p = P(t);
      const s = this.fxEl("ew-spark", p.x, p.y, 2940);
      s.style.background = this.ORANGE[Math.floor(this.rnd() * 3)];
      this.done(s.animate([{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 }, { transform: `translate(-50%,calc(-50% + ${6 + this.rnd() * 10}px)) scale(.1)`, opacity: 0 }], { duration: 380, fill: "both" }), s);
    }, 28);
    await arrow.animate(frames, { duration: dur, easing: "linear", fill: "forwards" }).finished;
    clearInterval(trail);
    arrow.remove();

    // 3) impacto: ráfaga de esquirlas, anillo y daño
    if (typeof SFX !== "undefined") SFX.arrowImpact();
    this.shards(b.x, b.y - 52, 10, { speed: 80, lift: 40, size: 11 });
    this.ring(b.x, b.y + 4, { w: 200, h: 112, ms: 420 });
    this.shakeBoard(3);
    await this.hurt(target, 1, unit.team);
    if (!Units.list.includes(target)) return;

    // 4) marca de rastreo: sonar naranja por el suelo + retícula sobre la cabeza
    this.markTracked(target, unit.team);
    if (typeof SFX !== "undefined") SFX.trackPing();
    this.ring(b.x, b.y + 4, { w: 520, h: 290, ms: 900, bw: 5, delay: 120 });
    this.ring(b.x, b.y + 4, { w: 520, h: 290, ms: 900, bw: 3, color: "#ffd27a", delay: 380 });
    if (typeof Fog !== "undefined") Fog.applyVisibility();
    if (Units.list.includes(unit)) Units.refreshRange(unit);
  },

  markTracked(target, byTeam) {
    target.trackedBy = byTeam;
    if (!target.el || target.el.querySelector(".ew-track-mark")) return;
    const m = document.createElement("div");
    m.className = "ew-track-mark";
    m.innerHTML =
      '<svg viewBox="0 0 48 48" width="46" height="46"><circle cx="24" cy="24" r="14" fill="none" stroke="#1b1208" stroke-width="7"/><circle cx="24" cy="24" r="14" fill="none" stroke="#ff8a1f" stroke-width="3.5"/><path d="M24 2v12M24 34v12M2 24h12M34 24h12" stroke="#1b1208" stroke-width="7" stroke-linecap="round"/><path d="M24 3v10M24 35v10M3 24h10M35 24h10" stroke="#ffd27a" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="24" r="3" fill="#ff8a1f"/></svg>';
    target.el.appendChild(m);
  },

  // Fuente de percepción de las unidades marcadas por el jugador (ver envoltorio de Fog más abajo).
  trackedSources() {
    return Units.list.filter((u) => u.trackedBy === "player" && u.team !== "player" && Units.list.includes(u));
  },

  // =====================================================================
  // MagoNífico · Cambiazo
  // =====================================================================
  swapValid(unit) {
    return (u) => u.team !== unit.team && u !== unit && (unit.team !== "player" || this.visible(u));
  },

  activateSwap(unit) {
    if (unit.swapBond) return; // ya hay un intercambio en curso
    const valid = this.swapValid(unit);
    if (Units.list.filter(valid).length === 0) {
      if (typeof SFX !== "undefined") SFX.back();
      return;
    }
    this.pickTarget(unit, valid, "Elige con quién intercambiar sitio", (t) => this.resolveSwap(unit, t));
  },

  // Círculo mágico plano bajo una casilla + runas que orbitan.
  magicCircle(row, col, ms = 640) {
    const c = getTileCenter(row, col, Units.boardSize);
    const e = this.fxEl("ew-circle", c.x, c.y + 4, 2790);
    this.done(
      e.animate(
        [
          { transform: "translate(-50%,-50%) scale(.2)", opacity: 0 },
          { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: 0.25 },
          { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: 0.75 },
          { transform: "translate(-50%,-50%) scale(1.25)", opacity: 0 },
        ],
        { duration: ms, easing: "ease-out", fill: "both" }
      ),
      e
    );
    const runes = [];
    for (let i = 0; i < 6; i++) {
      const r = this.fxEl("ew-rune", c.x, c.y, 2960);
      r.style.background = i % 2 ? "#ffd27a" : "#ff8a1f";
      runes.push({ r, ph: (i / 6) * Math.PI * 2 });
    }
    const t0 = performance.now();
    const step = (t) => {
      const k = (t - t0) / ms;
      if (k >= 1) { runes.forEach((o) => o.r.remove()); return; }
      const rad = 62 * Math.sin(Math.min(1, k * 1.4) * Math.PI * 0.5) * (1 - Math.max(0, k - 0.7) / 0.3);
      runes.forEach((o) => {
        const a = o.ph + (t - t0) / 150;
        o.r.style.transform = `translate(${Math.cos(a) * rad - 6}px,${Math.sin(a) * rad * 0.55 - 6 - 30 * k}px) rotate(45deg) scale(${1 - k * 0.4})`;
      });
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },

  // Hilo de chispas que viaja de una casilla a otra (en arco).
  sparkStream(from, to, color) {
    const S = Units.boardSize;
    const a = getTileCenter(from.row, from.col, S), b = getTileCenter(to.row, to.col, S);
    for (let i = 0; i < 16; i++) {
      const e = this.fxEl("ew-shard", a.x, a.y - 50, 2955);
      const sz = 8 + this.rnd() * 8;
      e.style.width = e.style.height = `${sz}px`;
      e.style.background = i % 3 === 0 ? this.BLUE : color;
      const side = (i % 2 ? 1 : -1) * (30 + this.rnd() * 40);
      const dx = b.x - a.x, dy = b.y - a.y;
      const L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L, ny = dx / L;
      const mid = { x: dx / 2 + nx * side, y: dy / 2 + ny * side * 0.6 - 40 };
      this.done(
        e.animate(
          [
            { transform: "translate(-50%,-50%) rotate(45deg) scale(1)", opacity: 1 },
            { transform: `translate(calc(-50% + ${mid.x}px),calc(-50% + ${mid.y}px)) rotate(200deg) scale(1.1)`, opacity: 1, offset: 0.5 },
            { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) rotate(400deg) scale(.4)`, opacity: 0.2 },
          ],
          { duration: 460, delay: i * 18, easing: "cubic-bezier(.4,0,.6,1)", fill: "both" }
        ),
        e
      );
    }
  },

  // Desaparece en espiral y reaparece con un "pop" (el cambio de casilla ocurre en medio).
  async vanish(unit) {
    const s = unit.spriteEl, el = unit.el;
    if (s)
      s.animate(
        [{ transform: "scale(1,1)", opacity: 1 }, { transform: "scale(1.2,.8)", opacity: 1, offset: 0.25 }, { transform: "scale(.05,2.1)", opacity: 0 }],
        { duration: 340, easing: "ease-in", fill: "forwards" }
      );
    await el.animate([{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 340, fill: "forwards" }).finished;
  },
  appear(unit) {
    const s = unit.spriteEl, el = unit.el;
    el.getAnimations().forEach((a) => a.cancel());
    if (s) {
      s.getAnimations().forEach((a) => a.cancel());
      s.animate(
        [{ transform: "scale(.05,2.1)", opacity: 0 }, { transform: "scale(1.25,.8)", opacity: 1, offset: 0.55 }, { transform: "scale(.92,1.1)", offset: 0.8 }, { transform: "scale(1,1)", opacity: 1 }],
        { duration: 420, easing: "ease-out" }
      );
    }
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
  },

  async doSwapMove(a, b, aTo, bTo, { quick = false } = {}) {
    // a y b son unidades; aTo/bTo, {row,col} destino de cada una.
    const S = Units.boardSize;
    this.magicCircle(a.row, a.col);
    this.magicCircle(b.row, b.col);
    if (typeof SFX !== "undefined") SFX.swapCharge();
    await this.sleep(quick ? 300 : 460);
    this.sparkStream(a, b, this.ORANGE[0]);
    this.sparkStream(b, a, this.ORANGE[1]);
    if (typeof SFX !== "undefined") SFX.swapZap();
    await Promise.all([this.vanish(a), this.vanish(b)]);
    if (typeof Bushes !== "undefined") {
      Bushes.clearHiddenUnit(a.id);
      Bushes.clearHiddenUnit(b.id);
    }
    a.row = aTo.row; a.col = aTo.col;
    b.row = bTo.row; b.col = bTo.col;
    Units._placeInstant(a);
    Units._placeInstant(b);
    await this.sleep(120);
    this.appear(a);
    this.appear(b);
    if (typeof SFX !== "undefined") SFX.swapIn();
    [a, b].forEach((u) => {
      const c = getTileCenter(u.row, u.col, S);
      this.ring(c.x, c.y + 4, { w: 300, h: 168, ms: 560 });
      this.shards(c.x, c.y - 50, 8, { speed: 70, lift: 50, size: 10, colors: [this.ORANGE[0], this.ORANGE[2], this.BLUE] });
    });
    this.shakeBoard(3);
    await this.sleep(300);
  },

  // Tras un cambio de sitio: quien acaba en agua sin Anfibio se ahoga (ver Combat._drown).
  async drownIfWater(u, other) {
    if (!Units.list.includes(u) || typeof TerrainMap === "undefined" || typeof Combat === "undefined") return;
    if (TerrainMap.isWalkable(u.row, u.col)) return;
    if (typeof Skills !== "undefined" && Skills.has(u.team, "anfibio")) return;
    await Combat._drown(other, u);
  },

  async resolveSwap(unit, target) {
    Units.clearRangeOverlays();
    if (typeof UiHint !== "undefined") UiHint.hide();
    if (unit.swapBond || !Units.list.includes(target)) return;
    Units.faceTowardsTile(unit, target.row, target.col);
    Abilities._consume(unit);
    const bond = { a: unit, b: target, aHome: { row: unit.row, col: unit.col }, bHome: { row: target.row, col: target.col }, team: unit.team };
    unit.swapBond = target.swapBond = bond;
    unit.el.classList.add("ew-bound");
    target.el.classList.add("ew-bound");
    // Brazo en alto antes del conjuro.
    if (unit.spriteEl)
      unit.spriteEl.animate([{ transform: "scale(1,1)" }, { transform: "scale(.9,1.16)", offset: 0.5 }, { transform: "scale(1,1)" }], { duration: 480, easing: "ease-out" });
    await this.doSwapMove(unit, target, bond.bHome, bond.aHome);
    await this.drownIfWater(unit, target);
    await this.drownIfWater(target, unit);
    if (Units.list.includes(unit)) this.settle(unit);
    if (Units.list.includes(target)) this.settle(target);
  },

  // Fin del turno de quien lanzó el cambiazo: cada uno vuelve a su casilla.
  async onTurnEnd(team) {
    const bonds = [];
    Units.list.forEach((u) => {
      if (u.swapBond && u.swapBond.team === team && !bonds.includes(u.swapBond)) bonds.push(u.swapBond);
    });
    for (const bond of bonds) await this.returnBond(bond);
  },

  clearBond(bond) {
    [bond.a, bond.b].forEach((u) => {
      if (u.swapBond === bond) u.swapBond = null;
      if (u.el) u.el.classList.remove("ew-bound");
    });
  },

  async returnBond(bond) {
    const { a, b } = bond;
    const aLive = Units.list.includes(a), bLive = Units.list.includes(b);
    if (!aLive || !bLive) return this.clearBond(bond); // si uno ha muerto, el otro se queda donde esté
    // Una casilla de vuelta ocupada por un tercero bloquea ese regreso.
    const blocked = (home, other) => {
      const occ = Units.unitAt(home.row, home.col);
      return !!occ && occ !== other && occ !== a && occ !== b;
    };
    const aTo = blocked(bond.aHome, b) ? { row: a.row, col: a.col } : bond.aHome;
    const bTo = blocked(bond.bHome, a) ? { row: b.row, col: b.col } : bond.bHome;
    if (aTo.row === a.row && aTo.col === a.col && bTo.row === b.row && bTo.col === b.col) return this.clearBond(bond);
    this.clearBond(bond);
    await this.doSwapMove(a, b, aTo, bTo, { quick: true });
    await this.drownIfWater(a, b);
    await this.drownIfWater(b, a);
    if (Units.list.includes(a)) this.settle(a);
    if (Units.list.includes(b)) this.settle(b);
  },

  // =====================================================================
  // PortaMuros · Muro Aplastante
  // =====================================================================
  activateCrush(unit) {
    const valid = (u) => u.team !== unit.team && this.cheb(u, unit) <= 1;
    const targets = Units.list.filter(valid);
    if (targets.length === 0) return; // sin rival adyacente no se gasta
    if (targets.length === 1) return this.resolveCrush(unit, targets[0]);
    Abilities._startUnitPicking(unit, {
      cursorClass: "ability-targeting--punch",
      filter: valid,
      hint: "Elige a quién aplastar",
      onPick: (t) => this.resolveCrush(unit, t),
    });
  },

  slabSvg() {
    return (
      '<svg width="96" height="132" viewBox="0 0 96 132"><rect x="5" y="5" width="86" height="122" rx="6" fill="#8d93a0" stroke="#1b1208" stroke-width="5"/>' +
      '<path d="M5 44H91M5 86H91M48 5V44M26 44V86M70 44V86M48 86V127" stroke="#1b1208" stroke-width="3.5" fill="none"/>' +
      '<rect x="5" y="5" width="86" height="12" fill="#b4b9c4"/>' +
      '<polygon points="30,52 66,52 66,98 48,112 30,98" fill="#ff8a1f" stroke="#1b1208" stroke-width="4" stroke-linejoin="round"/>' +
      '<polygon points="42,60 56,60 50,74 58,74 44,94 47,78 39,78" fill="#fff3d6"/></svg>'
    );
  },

  async resolveCrush(unit, target) {
    Units.clearRangeOverlays();
    if (typeof UiHint !== "undefined") UiHint.hide();
    Units.faceTowardsTile(unit, target.row, target.col);
    Abilities._consume(unit);
    const S = Units.boardSize;
    const a = getTileCenter(unit.row, unit.col, S);
    const b = getTileCenter(target.row, target.col, S);
    const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = ((b.x - a.x) / L) * 22, uy = ((b.y - a.y) / L) * 22;

    // 1) el PortaMuros se echa atrás y levanta el muro
    if (typeof SFX !== "undefined") SFX.wallLift();
    if (unit.spriteEl)
      unit.spriteEl.animate(
        [{ transform: "scale(1,1)" }, { transform: "scale(1.08,.9)", offset: 0.3 }, { transform: "scale(.88,1.22)", offset: 0.75 }, { transform: "scale(.88,1.22)" }],
        { duration: 480, easing: "ease-out", fill: "forwards" }
      );
    unit.el.animate([{ translate: "0 0" }, { translate: `${-ux * 0.4}px ${-uy * 0.4 - 8}px` }], { duration: 480, easing: "ease-out", fill: "forwards" });
    await this.sleep(470);

    // 2) el muro cae del cielo sobre el rival
    const slab = this.fxEl("ew-slab", b.x, b.y + 6, 2960);
    slab.innerHTML = this.slabSvg();
    if (typeof SFX !== "undefined") SFX.wallFall(0.3);
    const shadow = this.fxEl("ew-slab-shadow", b.x, b.y + 4, 2780);
    shadow.animate([{ transform: "translate(-50%,-50%) scale(.2)", opacity: 0.1 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 0.55 }], { duration: 300, easing: "ease-in", fill: "forwards" });
    unit.el.animate([{ translate: `${-ux * 0.4}px ${-uy * 0.4 - 8}px` }, { translate: `${ux}px ${uy}px` }, { translate: "0 0" }], { duration: 300, easing: "ease-in" });
    if (unit.spriteEl) {
      unit.spriteEl.getAnimations().forEach((x) => x.cancel());
      unit.spriteEl.animate([{ transform: "scale(.88,1.22)" }, { transform: "scale(1.2,.84)", offset: 0.7 }, { transform: "scale(1,1)" }], { duration: 300, easing: "ease-in" });
    }
    await slab.animate([{ transform: "translate(-50%,-420px)" }, { transform: "translate(-50%,-100%)" }], { duration: 300, easing: "cubic-bezier(.5,0,1,.7)", fill: "forwards" }).finished;

    // 3) impacto: el rival queda aplastado bajo el muro
    if (typeof SFX !== "undefined") SFX.wallSlam();
    Abilities._punchImpactFx(target.row, target.col);
    this.ring(b.x, b.y + 4, { w: 420, h: 236, ms: 640, color: "#ffb347" });
    this.shakeBoard(9);
    slab.animate([{ transform: "translate(-50%,-100%) scale(1,1)" }, { transform: "translate(-50%,-96%) scale(1.06,.92)", offset: 0.3 }, { transform: "translate(-50%,-100%) scale(1,1)" }], { duration: 320 });
    if (target.spriteEl) {
      target.spriteEl.getAnimations().forEach((x) => x.cancel());
      target.spriteEl.animate([{ transform: "scale(1,1)" }, { transform: "scale(1.45,.12)", offset: 0.12 }, { transform: "scale(1.4,.14)" }], { duration: 760, fill: "forwards" });
    }
    // El aplastado suelta el gnomo que llevara cogido.
    const held = typeof Gnome !== "undefined" ? Gnome.list.find((g) => g.heldBy === target.id) : null;
    if (held && Units.list.includes(target)) held.dropFromStunnedUnit(target);
    await this.hurt(target, 1, unit.team);
    await this.sleep(650);

    // 4) el muro se hunde en el suelo y el rival se despega como una pegatina, mareado
    const gone = !Units.list.includes(target);
    slab.animate([{ opacity: 1, transform: "translate(-50%,-100%)" }, { opacity: 0, transform: "translate(-50%,-62%)" }], { duration: 420, easing: "ease-in", fill: "forwards" }).onfinish = () => slab.remove();
    shadow.animate([{ opacity: 0.55 }, { opacity: 0 }], { duration: 420, fill: "forwards" }).onfinish = () => shadow.remove();
    if (typeof SFX !== "undefined") SFX.wallSink();
    if (!gone) {
      target.forcedRestNextTurn = true;
      target.crushedRound = 1;
      this.addCrushBadge(target);
      if (target.spriteEl) {
        target.spriteEl.getAnimations().forEach((x) => x.cancel());
        target.spriteEl.animate(
          [{ transform: "scale(1.4,.14)" }, { transform: "scale(.8,1.3)", offset: 0.5 }, { transform: "scale(1.08,.94)", offset: 0.78 }, { transform: "scale(1,1)" }],
          { duration: 620, easing: "cubic-bezier(.3,1.6,.5,1)" }
        );
      }
      Abilities._dizzyStars(target);
    }
    if (Units.list.includes(unit)) Units.refreshRange(unit);
  },

  addCrushBadge(target) {
    if (!target.el || target.el.querySelector(".ew-crush-badge")) return;
    const m = document.createElement("img");
    m.className = "ew-crush-badge";
    m.src = "assets/iconos/muro_aplastante.png";
    m.alt = "";
    m.draggable = false;
    target.el.appendChild(m);
  },
  removeCrushBadge(target) {
    target.crushedRound = 0;
    if (target.el) target.el.querySelectorAll(".ew-crush-badge").forEach((n) => n.remove());
  },

  // ---------- Enganches con el motor de turnos ----------
  onTurnStart(team) {
    Units.list.forEach((u) => {
      if (u.team === team && u.crushedRound === 1) u.crushedRound = 2; // empieza su ronda inactiva
    });
  },
  async onTurnEndCrush(team) {
    Units.list.forEach((u) => {
      if (u.team === team && u.crushedRound === 2) this.removeCrushBadge(u); // la ronda inactiva ha terminado
    });
  },
};

// Despacho de las 3 habilidades desde el botón común + enganche del turno.
(function () {
  const orig = Abilities._activate;
  Abilities._activate = function () {
    const unit = this._currentUnit;
    if (unit && !unit.abilityUsed && ABILITIES[unit.typeId] && (typeof Turns === "undefined" || Turns.canAct(unit))) {
      if (unit.typeId === "trazaflechas") return Enmurallado.activateTrackerArrow(unit);
      if (unit.typeId === "magonifico") return Enmurallado.activateSwap(unit);
      if (unit.typeId === "portamuros") return Enmurallado.activateCrush(unit);
    }
    return orig.apply(this, arguments);
  };
  const origTurn = Abilities.onTurnStart;
  Abilities.onTurnStart = function (team) {
    origTurn.apply(this, arguments);
    Enmurallado.onTurnStart(team);
  };
})();

// Fin de turno: el cambiazo del MagoNífico se deshace y el aplastado deja de estar inactivo.
if (typeof Turns !== "undefined") {
  Turns.registerTurnStartListener({
    async onTurnEnd(team) {
      await Enmurallado.onTurnEnd(team);
      await Enmurallado.onTurnEndCrush(team);
    },
  });
}

// Fog: las unidades rivales marcadas por el jugador se ven y revelan el mapa que ellas ven.
if (typeof Fog !== "undefined") {
  const origPerc = Fog._recomputePerception;
  Fog._recomputePerception = function () {
    if (this.revealedGrid && typeof Units !== "undefined" && typeof Enmurallado !== "undefined") {
      Enmurallado.trackedSources().forEach((u) => {
        const type = UNIT_TYPES[u.typeId];
        const r = (type ? type.percepcion : 1) + (typeof Skills !== "undefined" ? Skills.perceptionBonus(u.team) : 0);
        for (let rr = Math.max(0, u.row - r); rr <= Math.min(this.size - 1, u.row + r); rr++)
          for (let cc = Math.max(0, u.col - r); cc <= Math.min(this.size - 1, u.col + r); cc++) this._reveal(rr, cc, false);
      });
    }
    origPerc.apply(this, arguments);
    if (!this.perceivedGrid || typeof Enmurallado === "undefined") return;
    Enmurallado.trackedSources().forEach((u) => {
      const type = UNIT_TYPES[u.typeId];
      const r = (type ? type.percepcion : 1) + (typeof Skills !== "undefined" ? Skills.perceptionBonus(u.team) : 0);
      for (let rr = Math.max(0, u.row - r); rr <= Math.min(this.size - 1, u.row + r); rr++)
        for (let cc = Math.max(0, u.col - r); cc <= Math.min(this.size - 1, u.col + r); cc++) this.perceivedGrid[rr][cc] = true;
    });
  };
}

// Partida nueva: sin marcas ni vínculos (las unidades se recrean, pero por si acaso).
if (typeof Abilities !== "undefined") {
  const origReset = Abilities.resetAll;
  Abilities.resetAll = function () {
    Units.list.forEach((u) => {
      u.trackedBy = null;
      u.swapBond = null;
      u.crushedRound = 0;
    });
    return origReset.apply(this, arguments);
  };
}

// Un rival marcado se ve siempre, aunque esté escondido en un arbusto.
if (typeof Fog !== "undefined") {
  const origVis = Fog.applyVisibility;
  Fog.applyVisibility = function () {
    const r = origVis.apply(this, arguments);
    if (typeof Enmurallado !== "undefined" && this.revealedGrid) {
      Enmurallado.trackedSources().forEach((u) => {
        if (u.el) u.el.classList.remove("unit--fog-hidden");
      });
    }
    return r;
  };
}

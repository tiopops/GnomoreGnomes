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
     - PortaMuros · Muro Aplastante: clava su escudo en el suelo y la onda aplasta a TODOS los
       rivales de las 8 casillas que lo rodean: 1 de daño y los deja inactivos durante una ronda
       (su dueño no puede manejarlos, pero sí se les puede atacar o lanzarles habilidades — mismo
       mecanismo que Nudillos Rocosos).
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
      "Clava su escudo en el suelo y la onda aplasta a todos los rivales de las casillas que lo rodean: les hace 1 punto de daño y los deja inactivos durante una ronda. Su dueño no puede manejarlos hasta que termine el efecto, pero puedes seguir atacándolos o lanzándoles habilidades. Gasta 1 acción. Un uso por partida: se recarga si empiezas el turno junto a un tótem propio.",
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
    // El círculo va POR DEBAJO del sprite del rival, así que pulsar el propio sprite también elige.
    if (this._pickCleanup) this._pickCleanup();
    const subs = targets.map((t) => {
      const h = (e) => {
        if (!Units.markerEls.some((m) => m.classList.contains("ew-target-marker"))) return;
        e.stopPropagation();
        e.preventDefault();
        this._pickCleanup();
        if (typeof UiHint !== "undefined") UiHint.hide();
        Units.clearRangeOverlays();
        onPick(t);
      };
      if (t.el) t.el.addEventListener("click", h, true);
      return () => t.el && t.el.removeEventListener("click", h, true);
    });
    this._pickCleanup = () => { subs.forEach((f) => f()); this._pickCleanup = null; };
    targets.forEach((t, i) =>
      Units.addMarker({
        className: "range-marker ability-throw-marker ew-target-marker",
        row: t.row,
        col: t.col,
        zOffset: 1, // por debajo del sprite del rival (su z-index es +5)
        delayMs: Units.staggerDelay(i, targets.length),
        visibleClass: "range-marker--visible",
        onClick: () => {
          if (this._pickCleanup) this._pickCleanup();
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

  // Flecha del sprite de la TrazaFlechas: vara crema, punta plateada con púas, emplumado naranja y crema,
  // contorno negro irregular (filtro de desplazamiento, sin desenfoque).
  arrowSvg() {
    return '<svg width="78" height="20" viewBox="-1 -1 80 22" style="overflow:visible"><defs><filter id="ew-irr" x="-20%" y="-60%" width="140%" height="220%"><feMorphology in="SourceAlpha" operator="dilate" radius="1.9" result="d"/><feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="1" seed="7" result="n"/><feDisplacementMap in="d" in2="n" scale="3.5" result="w"/><feFlood flood-color="#1b1208"/><feComposite in2="w" operator="in" result="o"/><feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g filter="url(#ew-irr)"><rect x="7" y="8" width="55" height="4" fill="#efe3d5"/><polygon points="55,1.5 78,10 55,18.5 59,10" fill="#b9bcc2"/><polygon points="55,1.5 78,10 59,10" fill="#dfe1e5"/><polygon points="6,2 15,2 19,10 15,18 6,18 10,10" fill="#efe3d5"/><polygon points="0,2 6,2 10,10 6,18 0,18 4,10" fill="#f07a1e"/></g></svg>';
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
    arrow.innerHTML = this.arrowSvg();
    if (typeof SFX !== "undefined") SFX.arrowRelease(dur / 1000);
    const tFly = performance.now();
    const trail = setInterval(() => {
      const t = Math.min(1, (performance.now() - tFly) / dur), p = P(t), q = P(Math.min(1, t + 0.02)), p0 = P(Math.max(0, t - 0.02));
      const ang = (Math.atan2(q.y - p0.y, q.x - p0.x) * 180) / Math.PI;
      const st = this.fxEl("ew-fx", p.x - 17, p.y - 3.5, 2940);
      st.innerHTML = '<svg width="34" height="7" viewBox="0 0 34 7"><polygon points="0,3.5 34,0 34,7" fill="' + (this.rnd() < 0.5 ? "#ff8a1f" : "#ffd27a") + '"/></svg>';
      st.style.transformOrigin = "100% 50%";
      this.done(st.animate([{ transform: `rotate(${ang}deg) scaleX(1)`, opacity: 1 }, { transform: `rotate(${ang}deg) scaleX(.15)`, opacity: 0 }], { duration: 260, easing: "ease-out", fill: "both" }), st);
      if (this.rnd() < 0.5) {
        const s2 = this.fxEl("ew-spark", p.x, p.y, 2940);
        s2.style.background = this.ORANGE[Math.floor(this.rnd() * 3)];
        this.done(s2.animate([{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 }, { transform: `translate(calc(-50% + ${(this.rnd() - 0.5) * 32}px),calc(-50% + ${4 + this.rnd() * 18}px)) scale(.1)`, opacity: 0 }], { duration: 250 + this.rnd() * 170, fill: "both" }), s2);
      }
    }, 28);
    await arrow.animate(frames, { duration: dur, easing: "linear", fill: "forwards" }).finished;
    clearInterval(trail);
    const hitAng = (Math.atan2(P(1).y - P(0.98).y, P(1).x - P(0.98).x) * 180) / Math.PI;
    arrow.remove();

    // 3) impacto: ráfaga de esquirlas, anillo y daño
    if (typeof SFX !== "undefined") SFX.arrowImpact();
    this.shards(b.x, b.y - 52, 10, { speed: 80, lift: 40, size: 11 });
    this.ring(b.x, b.y + 4, { w: 200, h: 112, ms: 420 });
    this.shakeBoard(3);
    await this.hurt(target, 1, unit.team);
    if (!Units.list.includes(target)) return;

    // 4) marca de rastreo: sonar naranja por el suelo + retícula sobre la cabeza
    this.markTracked(target, unit.team, hitAng);
    if (typeof SFX !== "undefined") SFX.trackPing();
    this.ring(b.x, b.y + 4, { w: 520, h: 290, ms: 900, bw: 5, delay: 120 });
    this.ring(b.x, b.y + 4, { w: 520, h: 290, ms: 900, bw: 3, color: "#ffd27a", delay: 380 });
    if (typeof Fog !== "undefined") Fog.applyVisibility();
    if (Units.list.includes(unit)) Units.refreshRange(unit);
  },

  markTracked(target, byTeam, hitAng) {
    target.trackedBy = byTeam;
    if (!target.el || target.el.querySelector(".ew-track-arrow")) return;
    const ang = hitAng == null ? 20 : hitAng;
    // Dos ondas naranjas concéntricas en bucle bajo sus pies (detrás del sprite).
    ["ew-track-wave ew-track-wave--a", "ew-track-wave ew-track-wave--b"].forEach((c) => {
      const w = document.createElement("div");
      w.className = c;
      target.el.appendChild(w);
    });
    // La flecha se queda clavada en el rival (se mueve con él) y vibra al clavarse y de vez en cuando.
    const st = document.createElement("div");
    st.className = "ew-track-arrow";
    st.style.transform = `translate(-85%,-50%) rotate(${ang}deg)`;
    st.innerHTML = this.arrowSvg();
    target.el.appendChild(st);
    const R = (d) => `translate(-85%,-50%) rotate(${ang + d}deg)`;
    const vib = (m) => st.animate([{ transform: R(0) }, { transform: R(m) }, { transform: R(-m * 0.75) }, { transform: R(m * 0.5) }, { transform: R(-m * 0.25) }, { transform: R(0) }], { duration: 520, easing: "ease-out" });
    vib(11);
    const loop = () => {
      if (!st.isConnected) return;
      vib(6);
      setTimeout(loop, 2200 + Math.random() * 900);
    };
    setTimeout(loop, 2600);
  },

  // Quita la marca: la flecha se desvanece y las ondas dejan de repetirse.
  unmarkTracked(target) {
    target.trackedBy = null;
    if (!target.el) return;
    target.el.querySelectorAll(".ew-track-wave").forEach((w) => w.remove());
    target.el.querySelectorAll(".ew-track-arrow").forEach((a) => {
      a.getAnimations().forEach((x) => x.cancel());
      a.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, easing: "ease-out", fill: "forwards" }).onfinish = () => a.remove();
    });
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

  // Pedacito de chispa irregular (círculo, triángulo o esquirla), de color plano y sin contorno.
  bit(x, y, sz, color, z = 2960) {
    const e = this.fxEl("ew-bit", x, y, z);
    e.style.width = e.style.height = `${sz}px`;
    e.style.background = color;
    const k = Math.random();
    e.style.clipPath =
      k < 0.3 ? "circle(50%)" : k < 0.55 ? "polygon(50% 0,100% 100%,0 100%)" : k < 0.8 ? "polygon(8% 12%,92% 28%,68% 96%,0 66%)" : "polygon(20% 0,100% 40%,60% 100%,0 55%)";
    return e;
  },
  bitColor() {
    const c = [this.ORANGE[0], this.ORANGE[1], this.ORANGE[2], this.BLUE, this.ORANGE[0]];
    return c[(Math.random() * c.length) | 0];
  },
  rr(a, b) {
    return a + Math.random() * (b - a);
  },

  // Chispas que brotan desordenadas de los pies y suben a la deriva (cada una a su ritmo).
  // Nacen transparentes y pequeñas para no quedarse paradas esperando su turno.
  embers(x, y, n, spreadMs) {
    for (let i = 0; i < n; i++) {
      const e = this.bit(0, 0, this.rr(5, 12), this.bitColor());
      const x0 = x + this.rr(-55, 55), y0 = y + this.rr(-14, 16), h = this.rr(50, 140);
      const w1 = this.rr(-26, 26), w2 = this.rr(-30, 30), w3 = this.rr(-22, 22), r = this.rr(-200, 200);
      this.done(
        e.animate(
          [
            { transform: `translate(${x0}px,${y0}px) scale(.3) rotate(0)`, opacity: 0 },
            { transform: `translate(${x0 + w1}px,${y0 - h * 0.3}px) scale(1) rotate(${r * 0.3}deg)`, opacity: 1, offset: 0.15 },
            { transform: `translate(${x0 + w2}px,${y0 - h * 0.65}px) scale(.85) rotate(${r * 0.6}deg)`, opacity: 1, offset: 0.55 },
            { transform: `translate(${x0 + w3}px,${y0 - h}px) scale(.2) rotate(${r}deg)`, opacity: 0 },
          ],
          { duration: this.rr(650, 1150), delay: Math.random() * spreadMs, easing: "ease-out", fill: "both" }
        ),
        e
      );
    }
  },

  // Cargando el hechizo: ondas expansivas bajo los pies (DETRÁS del sprite) + chispas caóticas.
  magicCircle(row, col, ms = 640) {
    const c = getTileCenter(row, col, Units.boardSize);
    this.ring(c.x, c.y, { color: "#ff8a1f", w: 330, h: 185, ms: 620, bw: 12, z: 2 });
    this.ring(c.x, c.y, { color: "#ffd27a", w: 330, h: 185, ms: 620, bw: 9, z: 2, delay: 150 });
    this.ring(c.x, c.y, { color: "#ff8a1f", w: 330, h: 185, ms: 620, bw: 7, z: 2, delay: 300 });
    this.embers(c.x, c.y, 26, ms * 0.8);
  },

  // Chispas que viajan de una casilla a otra, dispersas y cada una por su camino.
  sparkStream(from, to, color) {
    const S = Units.boardSize;
    const a = getTileCenter(from.row, from.col, S), b = getTileCenter(to.row, to.col, S);
    const dx = b.x - a.x, dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    for (let i = 0; i < 30; i++) {
      const e = this.bit(0, 0, this.rr(5, 13), this.bitColor(), 2955);
      const sx = a.x + this.rr(-26, 26), sy = a.y - this.rr(20, 70);
      const pts = [0, 1, 2, 3].map((k) => {
        const t = (k + 1) / 5;
        return { x: sx + dx * t + nx * this.rr(-60, 60), y: sy + dy * t + ny * this.rr(-40, 40) - Math.sin(Math.PI * t) * this.rr(20, 90) };
      });
      const end = { x: b.x + this.rr(-20, 20), y: b.y - this.rr(20, 60) };
      const rot = this.rr(-300, 300);
      this.done(
        e.animate(
          [
            { transform: `translate(${sx}px,${sy}px) scale(.2) rotate(0)`, opacity: 0 },
            { transform: `translate(${pts[0].x}px,${pts[0].y}px) scale(1.1) rotate(${rot * 0.25}deg)`, opacity: 1, offset: 0.25 },
            { transform: `translate(${pts[1].x}px,${pts[1].y}px) scale(.9) rotate(${rot * 0.5}deg)`, opacity: 1, offset: 0.5 },
            { transform: `translate(${pts[2].x}px,${pts[2].y}px) scale(1) rotate(${rot * 0.75}deg)`, opacity: 1, offset: 0.75 },
            { transform: `translate(${end.x}px,${end.y}px) scale(.3) rotate(${rot}deg)`, opacity: 0 },
          ],
          { duration: this.rr(420, 640), delay: Math.random() * 380, easing: "cubic-bezier(.4,0,.6,1)", fill: "both" }
        ),
        e
      );
    }
  },

  // Estallido al reaparecer: trozos de distinto tamaño que salen despedidos y caen.
  bitsBurst(x, y, n) {
    for (let i = 0; i < n * 2; i++) {
      const e = this.bit(0, 0, this.rr(5, 14), this.bitColor(), 2960);
      const an = Math.random() * Math.PI * 2, v = this.rr(30, 110);
      const tx = Math.cos(an) * v, ty = Math.sin(an) * v * 0.55, up = this.rr(30, 90), r = this.rr(-360, 360);
      this.done(
        e.animate(
          [
            { transform: `translate(${x}px,${y}px) scale(.2) rotate(0)`, opacity: 0 },
            { transform: `translate(${x + tx * 0.7}px,${y + ty - up}px) scale(1) rotate(${r * 0.5}deg)`, opacity: 1, offset: 0.45 },
            { transform: `translate(${x + tx}px,${y + ty + 14}px) scale(.3) rotate(${r}deg)`, opacity: 0 },
          ],
          { duration: this.rr(450, 950), delay: Math.random() * 120, easing: "cubic-bezier(.3,.6,.5,1)", fill: "both" }
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
      this.ring(c.x, c.y, { color: "#ff8a1f", w: 400, h: 225, ms: 640, bw: 12, z: 2 });
      this.ring(c.x, c.y, { color: "#ffd27a", w: 400, h: 225, ms: 640, bw: 8, z: 2, delay: 130 });
      this.bitsBurst(c.x, c.y - 50, 8);
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
  // PortaMuros · Muro Aplastante (en área: las 8 casillas que lo rodean)
  // =====================================================================
  SHIELD_SRC: "assets/equipos/EquipoEnmurallado/escudo_muro.png",
  SHIELD_W: 132, // ancho en pantalla del escudo (px del tablero)
  SHIELD_RATIO: 409 / 380, // alto / ancho de la imagen
  SHIELD_DX: 54, // dónde clava el escudo respecto a sus pies

  crushVictims(unit) {
    return Units.list.filter((u) => u.team !== unit.team && this.cheb(u, unit) <= 1);
  },

  activateCrush(unit) {
    if (this.crushVictims(unit).length === 0) {
      if (typeof SFX !== "undefined") SFX.back();
      return; // sin rivales alrededor no se gasta
    }
    return this.resolveCrush(unit);
  },

  // Elemento plano centrado en (x,y) con tamaño propio (polvo, estrella de impacto...).
  flatFx(x, y, w, h, z, html) {
    const e = this.fxEl("ew-fx", x, y, z);
    e.style.width = `${w}px`;
    e.style.height = `${h}px`;
    e.style.marginLeft = `${-w / 2}px`;
    e.style.marginTop = `${-h / 2}px`;
    e.innerHTML = html;
    return e;
  },

  // Nubes de polvo planas que salen disparadas por el suelo.
  dust(x, y, n, spread, big) {
    for (let i = 0; i < n; i++) {
      const s = (big ? 26 : 16) + Math.random() * 14, a = Math.random() * Math.PI * 2;
      const e = this.flatFx(x, y, s, s, 2940, `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2 - 1}" fill="#efe3cd"/></svg>`);
      this.done(
        e.animate(
          [
            { transform: "translate(0,0) scale(.3)", opacity: 1 },
            { transform: `translate(${Math.cos(a) * spread}px,${Math.sin(a) * spread * 0.45 - 14}px) scale(1.15)`, opacity: 1, offset: 0.6 },
            { transform: `translate(${Math.cos(a) * spread * 1.25}px,${Math.sin(a) * spread * 0.55 - 24}px) scale(.9)`, opacity: 0 },
          ],
          { duration: 520 + Math.random() * 180, easing: "cubic-bezier(.2,.8,.3,1)", fill: "both" }
        ),
        e
      );
    }
  },

  // Estrella de impacto plana.
  burst(x, y) {
    const s = 96, pts = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, r = i % 2 ? s * 0.24 : s * 0.5;
      pts.push(`${(s / 2 + Math.cos(a) * r).toFixed(1)},${(s / 2 + Math.sin(a) * r * 0.7).toFixed(1)}`);
    }
    const e = this.flatFx(x, y - 30, s, s, 2960, `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><polygon points="${pts.join(" ")}" fill="#ffd84a" stroke="#1b1208" stroke-width="4" stroke-linejoin="round"/></svg>`);
    this.done(
      e.animate(
        [{ transform: "scale(.2)" }, { transform: "scale(1.15)", offset: 0.45 }, { transform: "scale(1)", offset: 0.7 }, { transform: "scale(.9)", opacity: 0 }],
        { duration: 380, easing: "cubic-bezier(.2,.8,.3,1)", fill: "both" }
      ),
      e
    );
  },

  // Trozos de piedra (grises, sin contorno): salen disparados, caen y REBOTAN por el suelo
  // (cada rebote más bajo y corto) hasta quedarse quietos y desvanecerse.
  rockChips(x, y, n) {
    for (let i = 0; i < n; i++) {
      const s = 14 + Math.random() * 16, a = Math.random() * Math.PI * 2, dist = 90 + Math.random() * 190;
      const e = this.flatFx(x, y, s, s, 2950, `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><polygon points="${s * 0.1},${s * 0.9} ${s * 0.3},${s * 0.1} ${s * 0.9},${s * 0.35} ${s * 0.7},${s * 0.95}" fill="${i % 3 ? "#6f7786" : "#9aa2b0"}"/></svg>`);
      const dirx = Math.cos(a), diry = Math.sin(a) * 0.5;
      const first = { x0: 0, y0: 0, x1: dirx * dist, y1: diry * dist, h: 70 + Math.random() * 110, t: 520 };
      const segs = [first];
      let cx = first.x1, cy = first.y1, hh = first.h, dd = dist * 0.32;
      for (let k = 0; k < 4; k++) {
        hh *= 0.45;
        const nx = cx + dirx * dd, ny = cy + diry * dd;
        segs.push({ x0: cx, y0: cy, x1: nx, y1: ny, h: hh, t: 300 - k * 45 });
        cx = nx; cy = ny; dd *= 0.5;
      }
      const total = segs.reduce((q, z) => q + z.t, 0);
      const rot0 = Math.random() * 60, spin = (Math.random() < 0.5 ? -1 : 1) * (500 + Math.random() * 500);
      const kf = [{ transform: `translate(0px,0px) rotate(${rot0}deg)`, opacity: 1, offset: 0 }];
      let acc = 0;
      segs.forEach((sg) => {
        for (let j = 1; j <= 8; j++) {
          const u = j / 8;
          const off = (acc + sg.t * u) / total;
          kf.push({
            transform: `translate(${sg.x0 + (sg.x1 - sg.x0) * u}px,${sg.y0 + (sg.y1 - sg.y0) * u - 4 * sg.h * u * (1 - u)}px) rotate(${rot0 + spin * off}deg)`,
            opacity: 1,
            offset: off,
          });
        }
        acc += sg.t;
      });
      e.animate(kf, { duration: total, easing: "linear", fill: "forwards" }).onfinish = () => {
        const f = e.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, delay: 350, fill: "forwards" });
        f.onfinish = () => e.remove();
      };
    }
  },

  async resolveCrush(unit) {
    Units.clearRangeOverlays();
    if (typeof UiHint !== "undefined") UiHint.hide();
    Abilities._consume(unit);
    const S = Units.boardSize;
    const c = getTileCenter(unit.row, unit.col, S);
    const sw = this.SHIELD_W, sh = Math.round(sw * this.SHIELD_RATIO), dx = this.SHIELD_DX;
    const footY = c.y + 20, plantY = c.y + 48;
    const unitH = unit.spriteEl ? unit.spriteEl.offsetHeight : 160;
    const headDy = footY - unitH + sh * 0.45 - plantY; // sobre su cabeza, relativo al punto donde se clava
    const H = `${-dx}px ${headDy}px`;
    const up = `${-dx}px ${headDy - 100}px`;
    const OUT = "cubic-bezier(.2,.8,.3,1)", IN = "cubic-bezier(.6,0,.9,.4)";
    const spr = unit.spriteEl;
    const squash = (from, to, ms, easing, hold) => {
      if (!spr) return;
      spr.getAnimations().forEach((x) => x.cancel());
      spr.animate([{ transform: from }, { transform: to }], { duration: ms, easing, fill: hold ? "forwards" : "none" });
    };

    // Escudo: el contenedor (con la sombra dura) se queda quieto; solo se mueve la imagen.
    const wrap = this.fxEl("ew-shield", c.x + dx, plantY, 2990);
    wrap.style.width = `${sw}px`;
    wrap.style.height = `${sh}px`;
    const img = document.createElement("img");
    img.src = this.SHIELD_SRC;
    img.alt = "";
    img.draggable = false;
    img.style.translate = H;
    img.style.transform = "scale(0)";
    wrap.appendChild(img);

    // 1) se agacha y el escudo aparece de golpe sobre su cabeza (goma)
    if (typeof SFX !== "undefined") SFX.wallLift();
    squash("scale(1,1)", "scale(1.12,.84)", 300, OUT, true);
    img.animate(
      [
        { translate: H, transform: "scale(0)" },
        { translate: H, transform: "scale(1.3)", offset: 0.55 },
        { translate: H, transform: "scale(.94)", offset: 0.8 },
        { translate: H, transform: "scale(1)" },
      ],
      { duration: 420, delay: 140, easing: "ease-out", fill: "both" }
    );
    await this.sleep(560);

    // 2) se estira y lo sube bien alto
    squash("scale(1.12,.84)", "scale(.9,1.16)", 200, OUT, true);
    img.animate([{ translate: H, transform: "scale(1)" }, { translate: up, transform: "scale(1.15)" }], { duration: 220, easing: OUT, fill: "both" });
    await this.sleep(300);

    // 3) cae recto y lo clava en el suelo, a sus pies
    if (typeof SFX !== "undefined") SFX.wallFall(0.13);
    squash("scale(.9,1.16)", "scale(1.18,.78)", 130, IN, true);
    img.animate([{ translate: up, transform: "scale(1.15)" }, { translate: "0px 0px", transform: "scale(1.12)" }], { duration: 130, easing: IN, fill: "both" });
    await this.sleep(130);

    // ---- IMPACTO ----
    const ip = { x: c.x + dx, y: c.y + 34 };
    if (typeof SFX !== "undefined") SFX.wallSlam();
    this.shakeBoard(9);
    this.burst(ip.x, ip.y);
    this.ring(c.x, c.y, { color: "#ff9a2e", w: 620, h: 386, ms: 640, bw: 14 });
    this.ring(c.x, c.y, { color: "#ffd84a", w: 620, h: 386, ms: 640, bw: 9, delay: 120 });
    this.dust(ip.x, ip.y, 10, 120, true);
    this.rockChips(ip.x, ip.y, 16);
    if (spr) {
      spr.getAnimations().forEach((x) => x.cancel());
      spr.animate([{ transform: "scale(1.18,.78)" }, { transform: "scale(.94,1.1)", offset: 0.5 }, { transform: "scale(1,1)" }], { duration: 520, easing: "cubic-bezier(.34,1.6,.64,1)" });
    }
    const T = (sx, sy, r) => ({ translate: "0px 0px", transform: `scale(${sx},${sy}) rotate(${r}deg)` });
    img.animate([T(1.12, 1.12, 0), T(1.04, 1.14, 0), T(1.1, 0.95, 0), T(1.06, 1.04, 0), T(1.08, 1.08, 0)], { duration: 620, easing: "ease-out", fill: "both" });

    // Onda por las 8 casillas: primero las de los lados, luego las diagonales.
    const victims = this.crushVictims(unit);
    const jobs = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const r = unit.row + dr, cc = unit.col + dc;
        if (r < 0 || cc < 0 || r >= S || cc >= S) continue;
        const d = 130 + (dr && dc ? 120 : 0);
        if (typeof TerrainCanvas !== "undefined") TerrainCanvas.hopTile(r, cc, 22, 420, d);
        const tc = getTileCenter(r, cc, S);
        jobs.push(this.sleep(d + 60).then(() => this.dust(tc.x, tc.y, 4, 70, false)));
        const v = victims.find((u) => u.row === r && u.col === cc);
        if (v) jobs.push(this.crushVictim(unit, v, d));
      }
    }
    jobs.push(this.sleep(1250));
    await Promise.all(jobs);

    // 4) el escudo vuelve a las manos del PortaMuros
    if (typeof SFX !== "undefined") SFX.wallSink();
    const back = img.animate(
      [
        { translate: "0px 0px", transform: "scale(1.08)", opacity: 1 },
        { translate: "0px -30px", transform: "scale(.8,1.15)", opacity: 1, offset: 0.3 },
        { translate: H, transform: "scale(.35)", opacity: 1, offset: 0.85 },
        { translate: H, transform: "scale(0)", opacity: 0 },
      ],
      { duration: 520, easing: IN, fill: "both" }
    );
    if (spr && Units.list.includes(unit)) {
      spr.getAnimations().forEach((x) => x.cancel());
      spr.animate([{ transform: "scale(1,1)" }, { transform: "scale(1.1,.9)", offset: 0.7 }, { transform: "scale(1,1)" }], { duration: 520 });
    }
    await this.sleep(560);
    wrap.remove();
    if (Units.list.includes(unit)) Units.refreshRange(unit);
  },

  // Un rival de las casillas de alrededor: salta, cae hecho una tortita, pierde 1 de vida y
  // queda inactivo (aplastado) hasta que termine su ronda.
  async crushVictim(unit, v, delay) {
    await this.sleep(delay);
    if (!Units.list.includes(v)) return;
    const spr = v.spriteEl;
    v.el.animate([{ translate: "0 0" }, { translate: "0 -24px", offset: 0.45 }, { translate: "0 0" }], { duration: 420, easing: "ease-out" });
    const held = typeof Gnome !== "undefined" ? Gnome.list.find((g) => g.heldBy === v.id) : null;
    if (held) held.dropFromStunnedUnit(v); // suelta el gnomo que llevara cogido
    let anim = null;
    if (spr) {
      spr.getAnimations().forEach((x) => x.cancel());
      anim = spr.animate(
        [
          { transform: "translateY(0) scale(1,1)", easing: "cubic-bezier(.2,.8,.3,1)" },
          { transform: "translateY(0) scale(.86,1.2)", offset: 0.29, easing: "cubic-bezier(.2,.8,.3,1)" },
          { transform: "translateY(-70px) scale(.92,1.12)", offset: 0.61, easing: "cubic-bezier(.6,0,.9,.4)" },
          { transform: "translateY(0) scale(1.1,.9)", offset: 0.8 },
          { transform: "translateY(0) scale(1.5,.2)", offset: 0.92 },
          { transform: "translateY(0) scale(1.3,.27)" },
        ],
        { duration: 680, fill: "forwards" }
      );
    }
    await this.sleep(640);
    const c = getTileCenter(v.row, v.col, Units.boardSize);
    this.shakeBoard(5);
    this.dust(c.x, c.y + 14, 7, 90, false);
    await this.hurt(v, 1, unit.team);
    if (Units.list.includes(v)) {
      v.forcedRestNextTurn = true;
      v.crushedRound = 1;
      v.crushAnim = anim; // se queda aplastado hasta que acabe su ronda inactiva
      this.addCrushBadge(v);
      Abilities._dizzyStars(v);
    } else if (anim) anim.cancel();
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
  // Fin de su ronda inactiva: se infla de vuelta (goma) y quita el icono.
  removeCrushBadge(target) {
    target.crushedRound = 0;
    if (target.el) target.el.querySelectorAll(".ew-crush-badge").forEach((n) => n.remove());
    if (target.crushAnim) {
      target.crushAnim.cancel();
      target.crushAnim = null;
      if (target.spriteEl && Units.list.includes(target)) {
        target.spriteEl.animate(
          [{ transform: "scale(1.3,.27)" }, { transform: "scale(.8,1.3)", offset: 0.5 }, { transform: "scale(1.08,.94)", offset: 0.78 }, { transform: "scale(1,1)" }],
          { duration: 620, easing: "cubic-bezier(.3,1.6,.5,1)" }
        );
        if (typeof SFX !== "undefined" && SFX.wallRecover) SFX.wallRecover();
      }
    }
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

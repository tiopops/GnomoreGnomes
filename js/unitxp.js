/* Gnomore Gnomes — Experiencia de unidad (solo Campaña).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Llevar la experiencia de CADA unidad propia: barra de 3 tramos (uno por nivel) bajo su barra de vida.
     - Dar XP por una baja de neutral (a quien le dio el último golpe) y por estampar un gnomo (a quien lo llevaba).
     - Al subir de nivel, dejar elegir UNA estadística que no esté al máximo para +1 (ventana con teclado, ratón, táctil y mando).
     - Exponer UnitXP.bonus(unit, stat) para que quien calcula esa estadística lo sume (combat, fog, movimiento...).
   No conoce las demás mecánicas: ellas llaman a UnitXP; nunca al revés (salvo refrescar rango/niebla/vida al aplicar el +1). */

const UNITXP_LEVELS = [4, 10, 18]; // XP acumulada para llegar a cada nivel (3 niveles)
const UNITXP_KILL = 3;             // XP por baja de neutral
const UNITXP_STAMP = 2;            // XP por estampar un gnomo
const UNITXP_CAP = 5;              // una estadística (base + subidas) no pasa de 5
const UNITXP_STATS = [
  { id: "aguante", icon: "ph-shield" },
  { id: "movimiento", icon: "ph-footprints" },
  { id: "fuerza", icon: "ph-boxing-glove" },
  { id: "agilidad", icon: "ph-wind" },
  { id: "percepcion", icon: "ph-eye" },
];

(function registerUnitXpStrings() {
  const es = {
    uxp_title: "¡NIVEL {n}!", uxp_pick: "Elige una estadística: +1", uxp_go: "SUBIR", uxp_choose: "Elegir", uxp_confirm: "Confirmar", uxp_max: "MÁX",
    uxp_aguante: "AGUANTE", uxp_movimiento: "MOVIMIENTO", uxp_fuerza: "FUERZA", uxp_agilidad: "AGILIDAD", uxp_percepcion: "PERCEPCIÓN",
  };
  const en = {
    uxp_title: "LEVEL {n}!", uxp_pick: "Pick a stat: +1", uxp_go: "LEVEL UP", uxp_choose: "Choose", uxp_confirm: "Confirm", uxp_max: "MAX",
    uxp_aguante: "TOUGHNESS", uxp_movimiento: "MOVEMENT", uxp_fuerza: "STRENGTH", uxp_agilidad: "AGILITY", uxp_percepcion: "PERCEPTION",
  };
  Object.assign(STRINGS.es, es);
  Object.assign(STRINGS.en, en);
})();

const UnitXP = {
  _queue: [],
  _ov: null,
  _raf: 0,

  enabled() { return typeof Campaign !== "undefined" && Campaign.active && Campaign.run && !Campaign.run.tutorial && !Campaign.run.over; },
  t(k, v) { return I18N.t(k, v); },

  // Bonus acumulado de una estadística (0 para quien no tenga XP: enemigos, otros modos...).
  bonus(unit, stat) { return (unit && unit.xpStats && unit.xpStats[stat]) || 0; },

  // Una unidad recién creada: si es del jugador y estamos en campaña, recibe su barra.
  attach(unit) {
    if (!unit || unit.team !== "player" || !this.enabled() || unit.xpStats) return;
    unit.xp = 0; unit.lvl = 0; unit.xpHp = 0;
    unit.xpStats = { aguante: 0, movimiento: 0, fuerza: 0, agilidad: 0, percepcion: 0 };
    const bar = document.createElement("div");
    bar.className = "unit__xpbar";
    unit.xpSegs = UNITXP_LEVELS.map(() => {
      const s = document.createElement("div"); s.className = "unit__xpbar-seg";
      const f = document.createElement("i"); s.appendChild(f); bar.appendChild(s); return f;
    });
    unit.el.appendChild(bar);
    unit.xpBarEl = bar;
    this._paint(unit);
  },

  _paint(unit) {
    if (!unit.xpSegs) return;
    unit.xpSegs.forEach((f, i) => {
      const lo = i ? UNITXP_LEVELS[i - 1] : 0, hi = UNITXP_LEVELS[i];
      f.style.width = Math.max(0, Math.min(1, (unit.xp - lo) / (hi - lo))) * 100 + "%";
    });
    unit.xpBarEl.classList.toggle("unit__xpbar--has", unit.xp > 0);
  },

  addXp(unit, n) {
    if (!unit || !unit.xpStats || !this.enabled() || unit.lvl >= UNITXP_LEVELS.length) return;
    unit.xp = Math.min(UNITXP_LEVELS[UNITXP_LEVELS.length - 1], unit.xp + n);
    if (typeof Units !== "undefined" && Units.spawnFloatingText) Units.spawnFloatingText(unit, `+${n} XP`, { className: "xp-popup" });
    this._paint(unit);
    while (unit.lvl < UNITXP_LEVELS.length && unit.xp >= UNITXP_LEVELS[unit.lvl]) { unit.lvl++; this._queue.push({ unit, lvl: unit.lvl }); }
    this._next();
  },

  onKill(killerId) {
    if (typeof Units === "undefined") return;
    const k = Units.list.find((u) => u.id === killerId);
    if (k) this.addXp(k, UNITXP_KILL);
  },

  _total(unit, stat) { return (UNIT_TYPES[unit.typeId][stat] || 0) + this.bonus(unit, stat); },
  _open(unit) { return UNITXP_STATS.filter((s) => this._total(unit, s.id) < UNITXP_CAP); },

  _next() {
    if (this._ov || !this._queue.length || !this.enabled()) return;
    const job = this._queue.shift();
    if (!job.unit || !Units.list.includes(job.unit)) return this._next();
    if (!this._open(job.unit).length) return this._next(); // todo al máximo: nada que elegir
    this._show(job);
  },

  _show({ unit, lvl }) {
    const type = UNIT_TYPES[unit.typeId];
    const ov = document.createElement("div");
    ov.className = "uxp";
    const need = UNITXP_LEVELS[Math.max(0, lvl - 1)];
    const btns = UNITXP_STATS.map((s) => {
      const cur = this._total(unit, s.id), full = cur >= UNITXP_CAP;
      const seg = Array.from({ length: UNITXP_CAP }, (_, k) => `<i class="${k < cur ? "on" : !full && k === cur ? "next" : ""}"></i>`).join("");
      return `<button type="button" class="uxp__btn${full ? " uxp__btn--max" : ""}" data-stat="${s.id}" ${full ? "disabled" : ""}>
        <i class="ph-fill ${s.icon} uxp__icon"></i><span class="uxp__name">${this.t("uxp_" + s.id)}</span><span class="uxp__seg">${seg}</span>
        <span class="uxp__val">${full ? this.t("uxp_max") : `<s>${cur}</s><em>→</em>${cur + 1}`}</span></button>`;
    }).join("");
    const pips = UNITXP_LEVELS.map((_, k) => `<i class="uxp__pip${k < lvl ? " uxp__pip--on" : ""}${k === lvl - 1 ? " uxp__pip--new" : ""}"></i>`).join("");
    ov.innerHTML = `<div class="p5-banner uxp__card"><div class="uxp__body">
      <div class="uxp__head"><h2 class="uxp__title">${this.t("uxp_title", { n: lvl })}</h2><div class="uxp__pips">${pips}</div></div>
      <div class="uxp__unit"><div class="uxp__portrait"><img src="${type.spriteUrl}" alt=""></div>
        <div class="uxp__uinfo"><span class="uxp__uname">${type.name}</span><div class="uxp__xp"><div class="uxp__xpbar"><div class="uxp__xpfill"></div></div><span class="uxp__xptxt">${need}/${need} XP</span></div></div></div>
      <p class="uxp__hint">${this.t("uxp_pick")}</p>
      <div class="uxp__grid">${btns}</div>
      <div class="uxp__foot"><button type="button" class="p5-banner p5-banner--action uxp__go"><span class="p5-banner__label"><i class="ph-fill ph-arrow-fat-line-up"></i> ${this.t("uxp_go")}</span></button>
        <div class="uxp__keys"><span><kbd>↑</kbd><kbd>↓</kbd> ${this.t("uxp_choose")}</span><span><kbd>A</kbd> / <kbd>Enter</kbd> ${this.t("uxp_confirm")}</span></div></div></div></div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add("uxp--on"));
    this._ov = ov; this._sel = 0;
    if (typeof SFX !== "undefined" && SFX.passSuccess) { try { SFX.passSuccess(); } catch (e) {} }
    const btnEls = [...ov.querySelectorAll(".uxp__btn")];
    const focus = (i) => {
      const open = btnEls.map((b, k) => (b.disabled ? -1 : k)).filter((k) => k >= 0);
      if (!open.length) return;
      this._sel = open.includes(i) ? i : open[0];
      btnEls.forEach((b, k) => b.classList.toggle("uxp__btn--sel", k === this._sel));
    };
    const move = (d) => {
      const open = btnEls.map((b, k) => (b.disabled ? -1 : k)).filter((k) => k >= 0);
      const at = open.indexOf(this._sel);
      focus(open[(at + d + open.length) % open.length]);
    };
    const pick = (id) => {
      if (!this._ov) return;
      cleanup();
      this._apply(unit, id);
      this._next();
    };
    const kd = (e) => {
      if (e.code === "ArrowRight" || e.code === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.code === "ArrowLeft" || e.code === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.code === "Enter" || e.code === "Space") { e.preventDefault(); pick(UNITXP_STATS[this._sel].id); }
      else if (/^Digit[1-5]$/.test(e.code)) { const k = +e.code.slice(5) - 1; if (!btnEls[k].disabled) focus(k); }
    };
    document.addEventListener("keydown", kd, true);
    // Mando: cruceta/stick para moverse, A para elegir.
    let padLock = true, lastDir = 0;
    const poll = () => {
      this._raf = requestAnimationFrame(poll);
      let pads = []; try { pads = navigator.getGamepads ? [...navigator.getGamepads()] : []; } catch (e) {}
      const g = pads.find((p) => p);
      if (!g) return;
      const b = (i) => g.buttons[i] && g.buttons[i].pressed;
      const ax = g.axes[0] || 0, ay = g.axes[1] || 0;
      const dir = (b(15) || ax > 0.6 || b(13) || ay > 0.6) ? 1 : (b(14) || ax < -0.6 || b(12) || ay < -0.6) ? -1 : 0;
      if (dir && dir !== lastDir) move(dir);
      lastDir = dir;
      const a = b(0);
      if (a && !padLock) pick(UNITXP_STATS[this._sel].id);
      if (!a) padLock = false;
    };
    poll();
    const cleanup = () => {
      document.removeEventListener("keydown", kd, true); cancelAnimationFrame(this._raf);
      ov.classList.remove("uxp--on"); setTimeout(() => ov.remove(), 180); this._ov = null;
    };
    btnEls.forEach((b, k) => {
      b.addEventListener("click", () => { if (typeof Campaign !== "undefined") Campaign._click(); focus(k); });
    });
    ov.querySelector(".uxp__go").addEventListener("click", () => { if (typeof Campaign !== "undefined") Campaign._click(); pick(UNITXP_STATS[this._sel].id); });
    focus(0);
  },

  _apply(unit, stat) {
    if (!unit.xpStats || this._total(unit, stat) >= UNITXP_CAP) return;
    unit.xpStats[stat]++;
    if (stat === "aguante") {
      const seg = document.createElement("div");
      seg.className = "unit__hpbar-segment";
      unit.hpBarEl.appendChild(seg); unit.hpSegmentEls.push(seg);
      unit.xpHp++; unit.maxHp++; unit.hp++;
      Units.updateHpBar(unit);
    } else if (stat === "percepcion" && typeof Fog !== "undefined" && Fog.revealForUnit) {
      try { Fog.revealForUnit(unit); } catch (e) {}
    } else if (stat === "movimiento" && typeof Units !== "undefined" && Units.refreshRange) {
      try { Units.refreshRange(unit); } catch (e) {}
    }
    if (typeof SFX !== "undefined" && SFX.buy) { try { SFX.buy(); } catch (e) {} }
    Units.spawnFloatingText(unit, "+1 " + this.t("uxp_" + stat), { className: "xp-popup" });
  },
};

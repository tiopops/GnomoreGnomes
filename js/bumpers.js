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

  // ---------- Golpes y combo ----------
  beginFlight() {
    this.combo = 0;
    this._hideCombo();
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
    const n = this.combo;
    this.combo = 0;
    if (n < 2) { this._hideCombo(); return; }
    const t = team === "enemy" ? "enemy" : "player";
    const before = this.slices[t];
    this.slices[t] = Math.min(BUMPER_SLICES_MAX, before + n);
    const hidden = typeof Egg !== "undefined" && Egg._hidden && Egg._hidden();
    if (hidden) { this._hideCombo(); return; }
    await this._flyComboToRoulette(n);
    if (typeof SFX !== "undefined" && SFX.comboFill) { try { SFX.comboFill(n); } catch (er) {} }
    if (this.list.length) this.showRoulette(this.list[0], 1600);
  },

  // ---------- JACKPOT ----------
  async jackpot() {
    const gains = { player: this.slices.player, enemy: this.slices.enemy };
    this.resetRoulettes();
    this.hideRoulette();
    const total = gains.player + gains.enemy;
    ["player", "enemy"].forEach((t) => {
      const g = gains[t];
      if (g > 0 && typeof Glory !== "undefined" && t in Glory.points) {
        const room = Math.max(0, (typeof GLORY_CAP !== "undefined" ? GLORY_CAP : 999) - Glory.points[t]);
        const add = Math.min(g, room);
        Glory.points[t] += add;
        Glory._render(t, { bump: add > 0, gained: add });
      }
    });
    if (total <= 0) return;
    const hidden = typeof Egg !== "undefined" && Egg._hidden && Egg._hidden();
    if (hidden) return;
    if (typeof SFX !== "undefined" && SFX.jackpot) { try { SFX.jackpot(); } catch (er) {} }
    const mine = gains.player;
    const el = document.createElement("div");
    el.className = "jackpot-pop";
    el.innerHTML = `<b>JACKPOT</b><span>+${mine}!</span>`;
    document.body.appendChild(el);
    this._coins();
    await new Promise((r) => setTimeout(r, 2200));
    el.remove();
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

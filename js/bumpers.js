/* Gnomore Gnomes — Bumpers del pinball (nivel Poblado HurryCrane).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Colocar los bumpers del tablero (posiciones fijas y simétricas, sin
       azar, para que los dos clientes online coincidan) y bloquear su casilla.
     - Reaccionar cuando el huevo los golpea (rebote elástico + onda en
       perspectiva + sonido que sube de tono con cada carambola).
     - El COMBO de cada vuelo del huevo (a partir del 2.º golpe seguido contra
       bumpers/tótems/obeliscos/unidades) y qué bumpers ya rebotaron en este turno
       (un bumper solo rebota una vez por turno).
   Cómo rebota el huevo lo decide js/egg.js (_simulate); aquí solo se pinta. */

const GNOME_BUMP_POINTS = 5; // puntos que se carga el gnomo al rebotar en un bumper
const BUMPER_SPRITE_W = 205;
const BUMPER_SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26];

const Bumpers = {
  list: [],
  used: new Set(), // bumpers que ya rebotaron en este turno (no vuelven a rebotar)
  combo: 0, // golpes seguidos en el vuelo actual
  _comboEl: null,

  resetAll() {
    this.list.forEach((b) => b.el && b.el.remove());
    this.list = [];
    this.used = new Set();
    this.combo = 0;
    this._hideCombo();
  },

  markUsed(b) { if (b) this.used.add(b); },
  resetUsed() { this.used = new Set(); },

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
    if (typeof Crane !== "undefined" && Crane.occlusionObj) { const co = Crane.occlusionObj(); if (co) objs.push(co); }
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

  // Los bumpers no capturan el ratón (como el resto del escenario). Ya no hay ruleta que abrir.
  _onPointerDown() {},

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
    if (this.lit.has(b)) return;
    this.lit.add(b);
    b.el.classList.add("bumper--lit");
    if (typeof SFX !== "undefined" && SFX.bumperLit) { try { SFX.bumperLit(); } catch (er) {} }
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

  // Lanzar un gnomo a un bumper es un SACRIFICIO (js/sacrifice.js, _bumper): se lo traga y escupe sangre a presión.
  // Se mantiene este punto de entrada porque js/net-hooks.js lo sincroniza en multijugador.
  async throwGnome(holder, gnome, b) {
    if (!b || !this.list.includes(b) || gnome.heldBy !== holder.id || gnome.busy) return;
    if (typeof Sacrifice === "undefined") return;
    return Sacrifice.perform(holder, gnome, "bumper", { kind: "bumper", row: b.row, col: b.col, ref: b });
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

  // Fin del vuelo: el COMBO se apaga (ya no alimenta ninguna ruleta: la carga la dan los rebotes del huevo).
  async endFlight(team) {
    this.resetLit();
    this.combo = 0;
    await new Promise((r) => setTimeout(r, 500));
    this._hideCombo();
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

  // Hover de los bumpers y del huevo: se amplían un poco al pasar el ratón por encima y
  // vuelven a su tamaño al salir, como el resto de elementos. Se detecta por la caja del
  // sprite (no por :hover) para que no reaccione el hueco transparente ni la nube del huevo.
  _hoverEl: null,
  _hoverAt(ev) {
    const cands = this.list.map((b) => ({ el: b.el, spriteEl: b.spriteEl, w: 0.5, h: 0.6, cy: 0.55 }));
    const e = typeof Egg !== "undefined" ? Egg.egg : null;
    if (e && !e.exploded && e.spriteEl) cands.push({ el: e.el, spriteEl: e.spriteEl, w: 0.34, h: 0.6, cy: 0.5 });
    if (typeof Crane !== "undefined" && Crane.el && Crane.imgEl && Crane.landed()) cands.push({ el: Crane.el, spriteEl: Crane.imgEl, w: 0.5, h: 0.6, cy: 0.55 });
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
    if (sp === this._hoverEl && this._skullCheckedFor === sp) return;
    if (this._hoverEl && sp !== this._hoverEl) this._hoverEl.classList.remove("gg-hover");
    this._hoverEl = sp;
    this._skullCheckedFor = sp;
    if (sp) sp.classList.add("gg-hover");
    // Si con ese gnomo se puede sacrificar en este bumper (hay círculo de lanzar encima), el puntero es la calavera.
    const b = sp ? this.list.find((x) => x.spriteEl === sp) : null;
    const skull = !!(b && document.querySelector(`.range-marker--sacrifice[data-row="${b.row}"][data-col="${b.col}"]`));
    document.body.classList.toggle("gg-skull-hover", skull);
    document.body.classList.toggle("gg-pinball-hover", !!sp && !skull);
  },
  clearHover() {
    if (this._hoverEl) this._hoverEl.classList.remove("gg-hover");
    this._hoverEl = null;
    this._skullCheckedFor = null;
    document.body.classList.remove("gg-pinball-hover", "gg-skull-hover");
  },

};

if (typeof document !== "undefined") {
  document.addEventListener("pointermove", (ev) => {
    if (ev.pointerType && ev.pointerType !== "mouse") return;
    if (typeof Bumpers !== "undefined") Bumpers._onPointerMove(ev);
  });
  // Clic sobre el cuerpo del bumper con un gnomo en mano: es el sacrificio (la calavera), aunque el
  // puntero esté sobre el hueco de la casilla de arriba. Se intercepta antes de que lo reciba otro círculo.
  document.addEventListener("click", (ev) => {
    if (typeof Bumpers === "undefined") return;
    const vp = document.getElementById("board-viewport");
    if (!vp || !vp.contains(ev.target) || ev.target.closest(".range-marker--sacrifice")) return;
    const sp = Bumpers._hoverAt(ev);
    if (sp && typeof Crane !== "undefined" && sp === Crane.imgEl) {
      const cm = document.querySelector(".crane-throw-marker");
      if (cm) { ev.stopPropagation(); ev.preventDefault(); cm.click(); }
      return;
    }
    const b = sp ? Bumpers.list.find((x) => x.spriteEl === sp) : null;
    const m = b && document.querySelector(`.range-marker--sacrifice[data-row="${b.row}"][data-col="${b.col}"]`);
    if (!m) return;
    ev.stopPropagation(); ev.preventDefault();
    m.click();
  }, true);
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

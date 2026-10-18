/* Gnomore Gnomes — La Grulla (nivel Hurrycrane Village).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Aparecer cuando el huevo explota (Egg._explode → Crane.arrive) para EQUILIBRAR la partida:
       se posa en el obelisco del equipo que más puntos ganó con el huevo (desempate: quien vaya
       mejor en la partida, y si siguen igual, al azar) y se queda CRANE_STAY_ROUNDS turnos.
       Mientras está posada, ese obelisco no puede reclutar, ni mejorar habilidades, ni usar la herrería.
     - Si un jugador le LANZA UN GNOMO, se asusta y vuela al siguiente obelisco (otros 2 turnos), y así
       hasta haberlos visitado todos; entonces se va y el huevo reaparece en el centro.
     - Animación: vuelo con aleteo (alas abiertas/plegadas con estirones suaves), aterrizaje con las patas
       sobre la cima, reposo con idle, contracción al recibir el gnomo y lluvia de plumas.
       El sprite NUNCA gira ni se pone del revés: solo se voltea de golpe hacia donde mira.
     - Transparencia como el resto del escenario (se atenúa si tapa a alguien, ver Bumpers.refreshOcclusion).
   El orden y la duración dependen solo del estado (rondas y puntos), no de las animaciones, para que
   los dos clientes online coincidan. */

const CRANE_DIR = "assets/niveles/hurrycrane/";
const CRANE_SRC = { fly: CRANE_DIR + "grulla_vuelo.png", fold: CRANE_DIR + "grulla_plegada.png", perch: CRANE_DIR + "grulla_posada.png" };
const CRANE_W = 250; // ancho del sprite sobre el tablero (px)
const CRANE_STAY_ROUNDS = 2; // turnos que se queda en cada obelisco
const CRANE_H = { fly: 466 / 640, fold: 428 / 640, perch: 585 / 640 }; // alto relativo de cada sprite
const CRANE_FEET = { x: 0.63, y: 0.93 }; // dónde están las patas en el sprite posado
const CRANE_BODY = { x: 0.5, y: 0.5 }; // centro del cuerpo (los sprites de vuelo se anclan aquí)

const Crane = {
  st: null, // { team, until, queue, landed }
  el: null,
  imgEl: null,
  _pos: null,
  _flip: false,
  _busy: false,
  _chirp: 0,

  isActive() {
    return typeof LevelAssets !== "undefined" && LevelAssets.current === "hurrycrane_village";
  },

  resetAll() {
    clearInterval(this._chirp);
    this._chirp = 0;
    if (this.el) this.el.remove();
    this.el = this.imgEl = null;
    this._pos = null;
    this._busy = false;
    if (typeof Obelisks !== "undefined") Obelisks.list.forEach((o) => this._setBlocked(o, false));
    this.st = null;
  },

  // ¿Está la grulla en este obelisco? (bloquea reclutar / habilidades / herrería)
  blocks(obelisk) {
    return !!(this.st && obelisk && this.st.team === obelisk.team);
  },

  landed() {
    return !!(this.st && this.st.landed);
  },

  syncStr() {
    return this.st ? [this.st.team, this.st.until, (this.st.queue || []).join(".")].join("|") : "";
  },

  _ob(team) {
    return typeof Obelisks !== "undefined" ? Obelisks.byTeam(team) : null;
  },

  _hiddenAt(ob) {
    return !ob || (typeof Fog !== "undefined" && Fog.isFoggedReal(ob.row, ob.col));
  },

  _setBlocked(ob, on) {
    if (!ob || !ob.el) return;
    ob.el.classList.toggle("obelisk--perched", !!on);
    ob.el.querySelectorAll(".obelisk__menu-btn").forEach((b) => { b.disabled = !!on; });
  },

  // Intento de usar un botón bloqueado: pequeño sacudón de la grulla.
  deny(ob) {
    if (typeof SFX !== "undefined" && SFX.craneChirp) { try { SFX.craneChirp(); } catch (e) {} }
    if (this.imgEl && this.imgEl.animate) this.imgEl.animate([{ transform: "scale(1,1)" }, { transform: "scale(1.1,.9)" }, { transform: "scale(1,1)" }], { duration: 240 });
  },

  // ---------- Entrada: el huevo acaba de explotar ----------
  // bn = rebotes de cada equipo en esa ronda de huevo.
  async arrive(bn) {
    const egg = typeof Egg !== "undefined" ? Egg : null;
    const teams = (typeof Obelisks !== "undefined" ? Obelisks.list : []).filter((o) => o && (o.hp === undefined || o.hp > 0)).map((o) => o.team);
    if (!this.isActive() || !teams.length) { if (egg) egg._respawn(); return; }
    const rnd = {};
    teams.forEach((t) => { rnd[t] = Math.random(); });
    const glory = (t) => (typeof Glory !== "undefined" && Glory.points[t]) || 0;
    // Más puntos con el huevo → mejor en la partida (Gloria) → azar.
    const order = teams.slice().sort((a, b) => (bn[b] || 0) - (bn[a] || 0) || glory(b) - glory(a) || rnd[a] - rnd[b]);
    this.st = { team: null, until: 0, queue: order, landed: false };
    await this._goTo(order.shift());
  },

  // ---------- Turnos ----------
  onTurnStart() {
    if (!this.st || !this.st.landed || this._busy) return null;
    if (typeof Turns !== "undefined" && Turns.roundNumber >= this.st.until) return this._next();
    return null;
  },

  // Pasa al siguiente obelisco o, si ya los visitó todos, se va (y el huevo reaparece).
  async _next() {
    if (!this.st || this._busy) return;
    const cur = this._ob(this.st.team);
    this._setBlocked(cur, false);
    this.st.landed = false;
    clearInterval(this._chirp);
    this._chirp = 0;
    const next = this.st.queue.shift();
    if (next !== undefined) await this._goTo(next, cur);
    else await this._leave(cur);
  },

  async _goTo(team, fromOb) {
    const ob = this._ob(team);
    if (!ob) { this.st.team = null; await this._leave(null); return; }
    this.st.team = team;
    this.st.until = (typeof Turns !== "undefined" ? Turns.roundNumber : 0) + CRANE_STAY_ROUNDS;
    this.st.landed = false;
    this._busy = true;
    try {
      this._ensureEl();
      const hidden = this._hiddenAt(ob);
      this.el.classList.toggle("unit--fog-hidden", hidden);
      const to = this._perch(ob);
      if (hidden || !this.el.isConnected) {
        this._setPose(to.x, to.y, to.x > this._center().x, "perch");
      } else {
        const side = to.x > this._center().x ? 1 : -1;
        const from = fromOb && this._pos ? { x: this._pos.bx, y: this._pos.by } : { x: to.x + side * 1100, y: to.y - 900 };
        const flip = to.x < from.x; // mira hacia donde va
        const bt = this._bodyTarget(to, flip);
        const lift = fromOb ? { x: from.x, y: from.y - 40 } : null;
        this.el.style.zIndex = "9000";
        if (lift) await this._glide(from, lift, 260, this._flip, 0);
        const hi = { x: bt.x, y: bt.y - 100 };
        await this._glide(lift || from, hi, fromOb ? 1300 : 1700, flip, 120);
        await this._glide(hi, bt, 520, flip, 0, true);
        this._setPose(to.x, to.y, flip, "perch");
        this._landFx(ob, to);
      }
      this.el.style.zIndex = String((parseInt(ob.el.style.zIndex, 10) || (ob.row + ob.col) * 10) + 2);
      this._setBlocked(ob, true);
      this.st.landed = true;
      this._pos = { bx: to.x, by: to.y, feet: to };
      this.imgEl.style.transform = "";
      this.el.classList.add("crane--perched");
      clearInterval(this._chirp);
      this._chirp = setInterval(() => {
        if (this.landed() && !this.el.classList.contains("unit--fog-hidden") && typeof SFX !== "undefined" && SFX.craneChirp) { try { SFX.craneChirp(); } catch (e) {} }
      }, 5200);
    } finally {
      this._busy = false;
    }
  },

  async _leave(fromOb) {
    this._busy = true;
    try {
      if (this.el && this._pos && fromOb && !this.el.classList.contains("unit--fog-hidden")) {
        const from = { x: this._pos.bx, y: this._pos.by };
        const flip = from.x < this._center().x; // se va hacia fuera del tablero
        this.el.classList.remove("crane--perched");
        this.el.style.zIndex = "9000";
        const lift = { x: from.x, y: from.y - 40 };
        await this._glide(from, lift, 260, this._flip, 0);
        await this._glide(lift, { x: from.x + (flip ? -1100 : 1100), y: from.y - 900 }, 1700, flip, 100);
      }
    } finally {
      if (this.el) this.el.remove();
      this.el = this.imgEl = null;
      this._pos = null;
      this.st = null;
      this._busy = false;
    }
    if (typeof Egg !== "undefined") Egg._respawn();
  },

  // ---------- Posición ----------
  _center() {
    const c = Units.container;
    return { x: (c && c.offsetWidth ? c.offsetWidth : 0) / 2, y: 0 };
  },

  // Punto de la cima del obelisco (donde se posan las patas), en coordenadas del tablero.
  _perch(ob) {
    const c = Units.container;
    const cr = c.getBoundingClientRect();
    const sc = (c.offsetWidth ? cr.width / c.offsetWidth : 1) || 1;
    const sp = ob.spriteEl || ob.el;
    const r = sp.getBoundingClientRect();
    return { x: (r.left + r.width / 2 - cr.left) / sc, y: (r.top - cr.top) / sc + (r.height / sc) * 0.07 };
  },

  _bodyTarget(feet, flip) {
    return { x: feet.x + (flip ? 1 : -1) * (CRANE_FEET.x - CRANE_BODY.x) * CRANE_W, y: feet.y - (CRANE_FEET.y - CRANE_BODY.y) * CRANE_W * CRANE_H.perch };
  },

  _ensureEl() {
    if (this.el && this.el.isConnected) return;
    const el = document.createElement("div");
    el.className = "crane";
    // Tres imágenes superpuestas (una por pose) y solo se alterna cuál se ve: cambiar el src en cada
    // aleteo provocaba parpadeos y saltos de decodificación.
    const img = document.createElement("div");
    img.className = "crane__img";
    img.poses = {};
    Object.keys(CRANE_SRC).forEach((k) => {
      const im = document.createElement("img");
      im.alt = "";
      im.draggable = false;
      im.src = CRANE_SRC[k];
      im.style.display = k === "fly" ? "block" : "none";
      img.appendChild(im);
      img.poses[k] = im;
    });
    el.appendChild(img);
    Units.container.appendChild(el);
    this.el = el;
    this.imgEl = img;
  },

  // pose: "perch" ancla las patas en (x,y); "fly"/"fold" ancla el centro del cuerpo.
  _setPose(x, y, flip, pose) {
    if (!this.el) return;
    if (this.imgEl.pose !== pose) {
      this.imgEl.pose = pose;
      Object.keys(this.imgEl.poses).forEach((k) => { this.imgEl.poses[k].style.display = k === pose ? "block" : "none"; });
    }
    const h = CRANE_W * CRANE_H[pose];
    const perched = pose === "perch";
    const ax = perched ? (flip ? 1 - CRANE_FEET.x : CRANE_FEET.x) : 0.5;
    this.el.style.width = CRANE_W + "px";
    this.el.style.left = x - CRANE_W * ax + "px";
    this.el.style.top = y - h * (perched ? CRANE_FEET.y : 0.5) + "px";
    this.el.style.transform = flip ? "scaleX(-1)" : "none"; // se voltea de golpe, sin girar
    this._flip = flip;
  },

  // Vuela entre dos puntos (centro del cuerpo) batiendo las alas; los sprites se alternan y se
  // estiran/contraen sutilmente con el aleteo. Nunca rota.
  async _glide(from, to, ms, flip, arc, endFold) {
    if (!this.el) return;
    const visible = !this.el.classList.contains("unit--fog-hidden");
    let flapT = 0, phase = 0;
    await new Promise((res) => {
      const t0 = performance.now();
      const f = (t) => {
        if (!this.el) { res(); return; }
        const k = Math.min(1, (t - t0) / ms);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        if (t - flapT > 222) { flapT = t; phase ^= 1; if (visible && typeof SFX !== "undefined" && SFX.craneFlap) { try { SFX.craneFlap(); } catch (er) {} } }
        if (endFold && k > 0.75) phase = 1;
        const bob = Math.sin(t / 110) * 5;
        const x = from.x + (to.x - from.x) * e, y = from.y + (to.y - from.y) * e - Math.sin(k * Math.PI) * arc + bob;
        this._setPose(x, y, flip, phase ? "fold" : "fly");
        this._pos = { bx: x, by: y };
        const w = Math.cos(((t - flapT) / 444) * Math.PI * 2 + Math.PI * phase);
        this.imgEl.style.transform = `scale(${1 + 0.045 * w},${1 - 0.045 * w})`;
        if (k < 1) requestAnimationFrame(f); else res();
      };
      requestAnimationFrame(f);
    });
  },

  _landFx(ob, to) {
    if (typeof SFX !== "undefined" && SFX.craneLand) { try { SFX.craneLand(); } catch (e) {} }
    if (this.imgEl.animate) this.imgEl.animate([{ transform: "scale(1.08,.88)" }, { transform: "scale(.97,1.05)", offset: 0.5 }, { transform: "scale(1)" }], { duration: 380, easing: "ease-out" });
    const z = (ob.row + ob.col) * 10 + 7;
    for (let i = 0; i < 6; i++) {
      const p = document.createElement("div");
      p.className = "crane-puff";
      p.style.left = to.x + (i - 2.5) * 16 + "px";
      p.style.top = to.y + 8 + "px";
      p.style.zIndex = String(z);
      Units.container.appendChild(p);
      p.animate([{ transform: "translate(-50%,-50%) scale(.3)", opacity: 0.9 }, { transform: `translate(calc(-50% + ${(i - 2.5) * 14}px),calc(-50% - 14px)) scale(1.6)`, opacity: 0 }], { duration: 700 }).onfinish = () => p.remove();
    }
  },

  // Lluvia de plumas pequeñas y sin borde que planean de lado a lado.
  _feathers(x, y) {
    const svg = (c) => `<svg viewBox="0 0 24 64" width="12" height="32"><path d="M12 62 C11 40 12 22 12 3 C4 14 2 30 6 44 C8 52 11 57 12 62Z" fill="${c[0]}"/><path d="M12 3 C19 12 22 28 18 42 C16 50 13 57 12 62Z" fill="${c[1]}"/></svg>`;
    const cols = [["#2e63c9", "#4a86ee"], ["#f1e6cc", "#fff8e6"], ["#1f47a0", "#2e63c9"], ["#e0c98f", "#f1e6cc"]];
    const flash = document.createElement("div");
    flash.className = "crane-flash";
    flash.style.left = x + "px";
    flash.style.top = y + "px";
    Units.container.appendChild(flash);
    flash.animate([{ transform: "translate(-50%,-50%) scale(.2)", opacity: 1 }, { transform: "translate(-50%,-50%) scale(1.5)", opacity: 0 }], { duration: 300, easing: "ease-out" }).onfinish = () => flash.remove();
    for (let i = 0; i < 11; i++) {
      const el = document.createElement("div");
      el.className = "crane-feather";
      el.innerHTML = svg(cols[i % 4]);
      el.style.left = x + "px";
      el.style.top = y + "px";
      Units.container.appendChild(el);
      const ang = -Math.PI / 2 + (NR() - 0.5) * 2.6, sp = 140 + NR() * 190;
      const vx0 = Math.cos(ang) * sp, vy0 = Math.sin(ang) * sp * 0.9 - 60;
      const rot0 = NR() * 360, rs = (NR() - 0.5) * 540, sw = 1.5 + NR() * 2, ph = NR() * 6.3, life = 1700 + NR() * 900, sc = 0.6 + NR() * 0.5;
      const t0 = performance.now();
      const f = (t) => {
        const k = (t - t0) / 1000, d = (t - t0) / life;
        if (d >= 1) { el.remove(); return; }
        const drag = Math.exp(-2.6 * k);
        const px = (vx0 * (1 - drag)) / 2.6 + Math.sin(k * sw + ph) * 26 * Math.min(1, k);
        const py = (vy0 * (1 - drag)) / 2.6 + Math.max(0, k - 0.15) * 70 * Math.min(1, k);
        const flip = Math.cos(k * sw * 1.6 + ph);
        el.style.transform = `translate(${px}px,${py}px) translate(-50%,-50%) rotate(${rot0 + rs * k * drag + Math.sin(k * sw + ph) * 40}deg) scale(${sc * (0.35 + 0.65 * Math.abs(flip))},${sc})`;
        el.style.opacity = String(d > 0.7 ? (1 - d) / 0.3 : 1);
        requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    }
  },

  // ---------- Niebla y transparencias ----------
  refreshFog() {
    if (!this.el || !this.st || !this.st.landed) return;
    const ob = this._ob(this.st.team);
    this.el.classList.toggle("unit--fog-hidden", this._hiddenAt(ob));
  },

  // Objeto para el sistema de transparencias del escenario (Bumpers.refreshOcclusion).
  occlusionObj() {
    if (!this.el || !this.landed()) return null;
    const ob = this._ob(this.st.team);
    return ob ? { row: ob.row, col: ob.col, el: this.el, spriteEl: this.imgEl } : null;
  },

  // ---------- Lanzarle un gnomo para espantarla ----------
  addThrowMarker(unit, gnome) {
    if (!this.landed() || this._busy || (typeof Egg !== "undefined" && Egg._busy)) return;
    const ob = this._ob(this.st.team);
    if (!ob || this._hiddenAt(ob)) return;
    const dist = Math.max(Math.abs(ob.row - unit.row), Math.abs(ob.col - unit.col));
    if (dist < 1 || dist > GNOME_THROW_MAX_RANGE) return;
    Units.addMarker({
      className: "pass-marker crane-throw-marker",
      row: ob.row, col: ob.col, zOffset: 12,
      visibleClass: "pass-marker--visible",
      owner: "gnome", alwaysOnTop: true,
      buildContent: (marker) => {
        const icon = document.createElement("i");
        icon.className = "ph ph-paper-plane-tilt pass-marker__icon";
        marker.appendChild(icon);
      },
      onClick: () => this.throwGnome(unit, gnome),
    });
  },

  async throwGnome(holder, gnome) {
    if (!this.landed() || this._busy || gnome.heldBy !== holder.id || gnome.busy) return;
    if (typeof Egg !== "undefined" && Egg._busy) return;
    if (typeof Turns !== "undefined" && !Turns.canAct(holder)) return;
    const ob = this._ob(this.st.team);
    if (!ob) return;
    if (typeof Turns !== "undefined") Turns.useAction(holder);
    Units.clearRangeOverlays();
    gnome.passing = false;
    gnome.busy = true;
    gnome.hideBadge();
    if (typeof Egg !== "undefined") Egg._busy = true;
    try {
      Units.faceTowardsTile(holder, ob.row, ob.col);
      gnome.row = holder.row;
      gnome.col = holder.col;
      Units.faceTowardsTile(gnome, ob.row, ob.col);
      if (holder.el) {
        holder.el.classList.remove("unit--throwing");
        void holder.spriteEl.offsetWidth;
        holder.el.classList.add("unit--throwing");
        setTimeout(() => holder.el && holder.el.classList.remove("unit--throwing"), 380);
      }
      gnome.detachFrom();
      gnome.spriteEl.src = GNOME_ASSETS.grita;
      await gnome.animateThrowTo(holder.row, holder.col, ob.row, ob.col);
      // Impacto: la grulla se contrae (sin girar), suelta plumas y sale volando.
      if (this.el && !this.el.classList.contains("unit--fog-hidden")) {
        if (typeof SFX !== "undefined") { try { SFX.hit(); if (SFX.craneScare) SFX.craneScare(); } catch (e) {} }
        if (this.imgEl && this.imgEl.animate) this.imgEl.animate([{ transform: "scale(1,1)" }, { transform: "scale(1.14,.8)", offset: 0.28 }, { transform: "scale(.95,1.06)", offset: 0.62 }, { transform: "scale(1,1)" }], { duration: 300, easing: "ease-out" });
        const f = this._pos && this._pos.feet ? this._pos.feet : this._perch(ob);
        this._feathers(f.x, f.y - CRANE_W * CRANE_H.perch * 0.45);
      }
      // El gnomo cae cerca (como al rebotar en un bumper): +5 de carga y mareado.
      const cell = typeof Bumpers !== "undefined" && Bumpers._landCell ? Bumpers._landCell({ row: ob.row, col: ob.col }, holder) : { row: holder.row, col: holder.col };
      await gnome.animateThrowTo(ob.row, ob.col, cell.row, cell.col);
      const catcher = cell.unit && Units.list.includes(cell.unit) && !Gnome.isHeldBy(cell.unit.id) ? cell.unit : null;
      if (catcher) {
        gnome.row = catcher.row;
        gnome.col = catcher.col;
        gnome.attachTo(catcher);
        gnome._addPoints(GNOME_BUMP_POINTS);
        Units.spawnFloatingText(catcher, `+${GNOME_BUMP_POINTS}`, { className: "dmg-popup gnome-points-popup" });
        if (typeof SFX !== "undefined" && SFX.passSuccess) SFX.passSuccess();
      } else {
        await gnome.landAt(cell, { sound: () => { if (typeof SFX !== "undefined") SFX.gnomeLandSoft(); } });
        gnome._addPoints(GNOME_BUMP_POINTS);
        Units.spawnFloatingText(gnome, `+${GNOME_BUMP_POINTS}`, { className: "dmg-popup gnome-points-popup" });
        gnome.setDizzy();
      }
      await this._next();
    } finally {
      if (typeof Egg !== "undefined") Egg._busy = false;
      gnome.busy = false;
      if (holder.el) Units.refreshRange(holder);
    }
  },

  // IA: si la grulla bloquea su obelisco y puede alcanzarla con un gnomo, la espanta.
  async aiAct(unit) {
    if (!this.landed() || this._busy || !unit.el || unit.team === "player") return false;
    if (this.st.team !== unit.team) return false;
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return false;
    const held = typeof Gnome !== "undefined" ? Gnome.list.find((g) => g.heldBy === unit.id) : null;
    if (!held || held.busy) return false;
    const ob = this._ob(this.st.team);
    if (!ob) return false;
    const d = Math.max(Math.abs(ob.row - unit.row), Math.abs(ob.col - unit.col));
    if (d < 1 || d > GNOME_THROW_MAX_RANGE) return false;
    await this.throwGnome(unit, held);
    return true;
  },
};

if (typeof Turns !== "undefined") {
  Turns.registerTurnStartListener(Crane);
  if (Turns._aiActOnce) {
    const orig = Turns._aiActOnce;
    Turns._aiActOnce = async function (unit) {
      try {
        if (await Crane.aiAct(unit)) return true;
      } catch (er) {
        console.warn("[IA] grulla", er);
      }
      return orig.apply(this, arguments);
    };
  }
}

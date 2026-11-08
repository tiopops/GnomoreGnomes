/* Gnomore Gnomes — artefactos de la cuenta.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - El catálogo de artefactos (ART_DEFS) y qué hace cada uno. Para añadir uno nuevo:
       una entrada en ART_DEFS, su sprite en assets/artefactos/ y, si tiene un efecto nuevo,
       su gancho (los ganchos son los métodos de la sección EFECTOS de abajo).
     - Cuántos cofres tiene ganados el jugador: floor(nivel × nº de artefactos / NIVEL_MAX), así
       el último artefacto llega siempre al nivel máximo aunque el catálogo crezca. Los cofres de
       niveles ya superados se dan con efecto retroactivo (cofres ganados − artefactos en poder).
     - El cofre obligatorio del menú principal (3 golpes, recompensa, "RECOGER").
     - Qué artefactos se poseen y cuáles van en cada vitrina (1 al inicio, 2º en el nivel 20, 3º en el 30).
     - La pestaña ARTEFACTOS del perfil (la pinta aquí, la monta js/stats.js).
     - Aplicar los efectos en cada partida (también en multijugador: cada cliente manda los suyos
       en el mensaje "ready" de js/net.js y se aplican por equipo cuando ambos están listos).
   Datos: artifacts/{uid} en Firestore (reglas en firebase/firestore.rules) con copia en localStorage. */

const ART_LEVEL_MAX = 30;
const ART_SLOT_LEVELS = [1, 20, 30]; // nivel en que se desbloquea cada vitrina

// Para sumar artefactos: añade aquí una línea (id = nombre del sprite en assets/artefactos/).
const ART_DEFS = [
  { id: "guantes", es: ["Guantes PielResina", "Todos los pases de tu equipo aciertan siempre."], en: ["PielResina Gloves", "Every pass your team makes always lands."] },
  { id: "botas", es: ["Botas AgarraSuelos", "Tus unidades no pueden ser empujadas durante toda la partida."], en: ["AgarraSuelos Boots", "Your units can't be pushed back for the whole match."] },
  { id: "espada", es: ["Espada FiloAureo", "Empiezas cada partida con el nivel 1 de Armas de la armería ya desbloqueado."], en: ["FiloAureo Sword", "You start every match with Armory Weapons level 1 already unlocked."] },
  { id: "armadura", es: ["Armadura CotaAurea", "Empiezas cada partida con el nivel 1 de Armaduras de la armería ya desbloqueado."], en: ["CotaAurea Armor", "You start every match with Armory Armor level 1 already unlocked."] },
  { id: "tomo_guerra", es: ["Tomo MarcaNudillos", "Empiezas cada partida con la primera habilidad de la rama de Guerra ya activada."], en: ["MarcaNudillos Tome", "You start every match with the first skill of the War branch already active."] },
  { id: "tomo_prot", es: ["Tomo Remachado", "Empiezas cada partida con la primera habilidad de la rama de Protección ya activada."], en: ["Remachado Tome", "You start every match with the first skill of the Protection branch already active."] },
  { id: "tomo_super", es: ["Tomo FogataFacil", "Empiezas cada partida con la primera habilidad de la rama de Supervivencia ya activada."], en: ["FogataFacil Tome", "You start every match with the first skill of the Survival branch already active."] },
  { id: "espavila", es: ["Guantes EspavilaGnomos", "Una vez por turno, pegar a un gnomo no gasta acción. Es una vez por turno en total, no una por unidad."], en: ["EspavilaGnomos Gloves", "Once per turn, hitting a gnome costs no action. It's once per turn in total, not once per unit."] },
  { id: "hacha", es: ["Hacha PelaBosques", "Cada árbol da 1 madera extra."], en: ["PelaBosques Axe", "Every tree gives 1 extra wood."] },
  { id: "pico", es: ["Pico QuiebraRocas", "Cada roca da 1 roca extra."], en: ["QuiebraRocas Pickaxe", "Every rock gives 1 extra rock."] },
  { id: "maza", es: ["Maza MuchaMena", "Cada mena de metal da 1 metal extra."], en: ["MuchaMena Hammer", "Every metal ore gives 1 extra metal."] },
];

(function registerArtStrings() {
  const es = {
    art_tab: "ARTEFACTOS", art_chest_lv: "COFRE DE NIVEL {n}", art_new: "ARTEFACTO NUEVO", art_take: "RECOGER",
    art_tap: "Pulsa el cofre para abrirlo", art_next: "Próximo cofre: nivel {n}", art_all: "¡Tienes todos los artefactos!",
    art_slot_lock: "NIV {n}", art_unknown: "???", art_locked_desc: "Aún no lo tienes. Se consigue en un cofre.",
    art_equipped: "EQUIPADO", art_help: "Pulsa un artefacto para ponerlo en la vitrina marcada (otra vez para quitarlo).",
    art_count: "{a} / {b}", art_open_aria: "Abrir cofre",
  };
  const en = {
    art_tab: "ARTIFACTS", art_chest_lv: "LEVEL {n} CHEST", art_new: "NEW ARTIFACT", art_take: "COLLECT",
    art_tap: "Tap the chest to open it", art_next: "Next chest: level {n}", art_all: "You have every artifact!",
    art_slot_lock: "LV {n}", art_unknown: "???", art_locked_desc: "You don't have it yet. Find it in a chest.",
    art_equipped: "EQUIPPED", art_help: "Tap an artifact to put it in the selected display case (again to remove it).",
    art_count: "{a} / {b}", art_open_aria: "Open chest",
  };
  ART_DEFS.forEach((d) => { es["art_" + d.id + "_n"] = d.es[0]; es["art_" + d.id + "_d"] = d.es[1]; en["art_" + d.id + "_n"] = d.en[0]; en["art_" + d.id + "_d"] = d.en[1]; });
  Object.assign(STRINGS.es, es);
  Object.assign(STRINGS.en, en);
})();

const Artifacts = {
  _uid: null,
  _loaded: false,
  _s: { own: [], eq: [null, null, null] },
  _saveT: null,
  _open: false,
  _slot: 0, // vitrina seleccionada en la pestaña
  _focus: null, // artefacto cuya ficha se enseña en la pestaña
  _teams: {}, // equipo -> [ids] activos en la partida en curso
  _freeKey: {}, // equipo -> "ronda|equipo" del turno en que ya usó el golpe gratis a un gnomo

  get _db() { return typeof Account !== "undefined" ? Account._db : null; },
  t(k, v) { return I18N.t(k, v); },
  def(id) { return ART_DEFS.find((d) => d.id === id) || null; },
  img(id) { return "assets/artefactos/" + id + ".webp"; },
  name(id) { return this.t("art_" + id + "_n"); },
  desc(id) { return this.t("art_" + id + "_d"); },

  init() {
    document.addEventListener("gg:authchange", (e) => this._onAuth(e.detail && e.detail.user));
    setInterval(() => this._tick(), 1000);
  },

  // ---------- Sesión y almacenamiento ----------
  _onAuth(user) {
    this._uid = user ? user.uid : null;
    this._loaded = false;
    this._s = { own: [], eq: [null, null, null] };
    this._slot = 0;
    this._focus = null;
    if (this._uid) this.load();
  },

  _key(uid) { return "gg_artifacts_" + uid; },

  _normalize(d) {
    const ids = (v) => (typeof v === "string" ? v.split(",") : Array.isArray(v) ? v : []);
    const own = [];
    ids(d && d.own).forEach((id) => { if (this.def(id) && !own.includes(id)) own.push(id); });
    const eq = ids(d && d.eq).slice(0, 3).map((id) => (own.includes(id) ? id : null));
    while (eq.length < 3) eq.push(null);
    eq.forEach((id, i) => { if (id && eq.indexOf(id) !== i) eq[i] = null; });
    return { own, eq };
  },

  _pack() { return { v: 1, own: this._s.own.join(","), eq: this._s.eq.map((x) => x || "").join(",") }; },

  async load() {
    const uid = this._uid;
    if (!uid) return;
    let local = null;
    try { local = JSON.parse(localStorage.getItem(this._key(uid)) || "null"); } catch (e) {}
    local = local ? this._normalize(local) : null;
    let remote = null;
    const db = this._db;
    if (db) {
      try {
        const snap = await db.collection("artifacts").doc(uid).get();
        if (snap.exists) remote = this._normalize(snap.data());
      } catch (e) { console.warn("artifacts:", e && e.code); }
    }
    if (uid !== this._uid) return;
    // Gana quien tenga más artefactos (el otro pudo quedarse sin subir por falta de red / reglas sin publicar).
    const s = remote && (!local || remote.own.length >= local.own.length) ? remote : local || { own: [], eq: [null, null, null] };
    this._s = s;
    this._loaded = true;
    this._persist(!remote || (local && local.own.length > remote.own.length));
    document.dispatchEvent(new CustomEvent("gg:artifacts"));
  },

  _persist(remoteToo) {
    const uid = this._uid;
    if (!uid) return;
    try { localStorage.setItem(this._key(uid), JSON.stringify(this._pack())); } catch (e) {}
    if (remoteToo === false) return;
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => this._push(), 400);
  },

  async _push() {
    const db = this._db, uid = this._uid;
    if (!db || !uid) return;
    try { await db.collection("artifacts").doc(uid).set(this._pack()); } catch (e) { console.warn("artifacts:", e && e.code); }
  },

  // ---------- Reglas de cofres y vitrinas ----------
  level() { return typeof Progress !== "undefined" && Progress._loaded ? Math.min(ART_LEVEL_MAX, Progress.level) : 1; },
  chestsEarned() { const n = ART_DEFS.length; return Math.min(n, Math.floor((this.level() * n) / ART_LEVEL_MAX)); },
  pending() { return Math.max(0, this.chestsEarned() - this._s.own.length); },
  // Nivel con el que se gana el cofre nº `k` (1, 2, 3...).
  chestLevel(k) { return Math.max(1, Math.ceil((k * ART_LEVEL_MAX) / ART_DEFS.length)); },
  slotCount(level) { const lv = level == null ? this.level() : level; return ART_SLOT_LEVELS.filter((l) => lv >= l).length; },
  owns(id) { return this._s.own.includes(id); },
  equippedIds() { return this._s.eq.slice(0, this.slotCount()).filter((id) => id && this.owns(id)); },

  equip(slot, id) {
    if (slot < 0 || slot >= this.slotCount() || !this.owns(id)) return false;
    const eq = this._s.eq;
    if (eq[slot] === id) { eq[slot] = null; } else { const o = eq.indexOf(id); if (o >= 0) eq[o] = null; eq[slot] = id; }
    this._persist();
    return true;
  },

  // ---------- Cofre obligatorio ----------
  _tick() {
    if (this._open || !this._uid || !this._loaded || typeof Progress === "undefined" || !Progress._loaded) return;
    if (this.pending() <= 0) return;
    const scr = document.querySelector(".screen.screen--active");
    if (!scr || scr.id !== "main-menu") return;
    if (document.querySelector(".match-loading-overlay--visible")) return;
    const cur = document.getElementById("scene-curtain");
    if (cur && parseFloat(cur.style.opacity || "0") > 0.05) return;
    this.openChest();
  },

  _imgs() { return ["chest", "chestopen", "cushion"].concat(ART_DEFS.map((d) => d.id)).map((k) => this.img(k)); },

  async _loadImgs(list) {
    await Promise.all(list.map((src) => new Promise((res) => {
      const im = new Image();
      im.onload = () => (im.decode ? im.decode().then(res, res) : res());
      im.onerror = res;
      im.src = src;
    })));
  },

  // Elige al azar un artefacto que aún no se tiene (null si ya están todos).
  _pickNew() {
    const left = ART_DEFS.filter((d) => !this.owns(d.id));
    return left.length ? left[Math.floor(Math.random() * left.length)].id : null;
  },

  async openChest(force) {
    if (this._open) return;
    this._open = true;
    try {
      await this._loadImgs([this.img("chest"), this.img("chestopen"), this.img("cushion")]);
      let guard = 0;
      do {
        const k = this._s.own.length + 1;
        await this._chestScene(this._pickNew(), this.chestLevel(k));
      } while (!force && this.pending() > 0 && ++guard < 40);
    } catch (e) { console.warn("artifacts chest:", e); }
    this._open = false;
    document.dispatchEvent(new CustomEvent("gg:artifacts"));
  },

  // Cofre de prueba desde la consola: Artifacts.debugChest("hacha")  (no guarda nada).
  debugChest(id) {
    if (this._open) return;
    this._open = true;
    this._chestScene(id || this._pickNew() || ART_DEFS[0].id, this.level(), true).catch((e) => console.warn(e)).then(() => { this._open = false; });
  },

  // Toda la animación del cofre (portada de la demo aprobada). Devuelve una promesa que se cumple al pulsar RECOGER.
  _chestScene(artId, lvl, dry) {
    return new Promise((resolve) => {
      const T = (k, v) => this.t(k, v);
      const root = document.createElement("div");
      root.className = "achest";
      root.innerHTML = `
        <div class="achest__dim"></div>
        <div class="achest__rays"></div>
        <div class="achest__badge banner"><span>${T("art_chest_lv", { n: lvl })}</span></div>
        <div class="achest__scene">
          <div class="achest__chestshadow abs"></div>
          <div class="achest__cush abs"><img alt=""></div>
          <div class="achest__artshadow abs"></div>
          <div class="achest__art abs"><div class="achest__artfloat"><img alt=""></div></div>
          <div class="achest__chest abs" role="button" tabindex="0" aria-label="${T("art_open_aria")}">
            <div class="achest__chestinner"><img class="achest__closed" alt=""><img class="achest__opened" alt=""></div>
          </div>
        </div>
        <canvas class="achest__fx"></canvas>
        <div class="achest__flash"></div>
        <div class="achest__hint">${T("art_tap")}</div>
        <div class="achest__card banner">
          <div class="achest__kicker">${T("art_new")}</div>
          <div class="achest__name"></div>
          <div class="achest__desc"></div>
          <button class="achest__btn banner" type="button"><span>${T("art_take")}</span></button>
        </div>`;
      const q = (s) => root.querySelector(s);
      const stage = root, chest = q(".achest__chest"), inner = q(".achest__chestinner"), cv = q(".achest__fx"), ctx = cv.getContext("2d");
      const rays = q(".achest__rays"), dim = q(".achest__dim"), wrap = q(".achest__art"), cush = q(".achest__cush"), sh = q(".achest__artshadow"), card = q(".achest__card"), btn = q(".achest__btn"), hint = q(".achest__hint");
      q(".achest__closed").src = this.img("chest");
      q(".achest__opened").src = this.img("chestopen");
      q(".achest__cush img").src = this.img("cushion");
      q(".achest__name").textContent = artId ? this.name(artId) : "";
      q(".achest__desc").textContent = artId ? this.desc(artId) : "";
      document.body.appendChild(root);
      // Capa superior del navegador (top layer): queda por encima de TODA la interfaz, tenga el z-index que tenga.
      try { if (root.showPopover) { root.setAttribute("popover", "manual"); root.showPopover(); } } catch (e) {}

      // ---------- Sonido (sintetizado; respeta el volumen y el silencio del juego) ----------
      let AC = null, master = null;
      const audio = () => {
        if (typeof SFX !== "undefined" && SFX.enabled === false) return null;
        if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 0.7 * (typeof SFX !== "undefined" && typeof SFX.volume === "number" ? SFX.volume : 1); master.connect(AC.destination); } catch (e) {} }
        if (AC && AC.state === "suspended") AC.resume();
        return AC;
      };
      const tone = (f0, f1, dur, type = "sine", vol = 0.5, delay = 0) => {
        if (!audio()) return;
        const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
        o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
      };
      const noise = (dur, vol = 0.4, hp = 800, delay = 0) => {
        if (!audio()) return;
        const t = AC.currentTime + delay, n = Math.floor(AC.sampleRate * dur), b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
        const s = AC.createBufferSource(); s.buffer = b;
        const f = AC.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp;
        const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(master); s.start(t);
      };
      const SND = {
        hit(n) {
          tone(150 + n * 20, 48, 0.22, "sine", 0.75); noise(0.09 + n * 0.03, 0.35 + n * 0.08, 1400); tone(300 + n * 90, 160 + n * 30, 0.09, "triangle", 0.25);
          [0, 0.07, 0.13].slice(0, n).forEach((d, i) => tone(1400 + i * 400 + n * 200, 1400 + i * 400 + n * 200, 0.09, "square", 0.08, 0.05 + d));
          if (n >= 2) tone(90, 60, 0.35, "sawtooth", 0.08, 0.02);
        },
        wind() { tone(200, 900, 0.16, "sawtooth", 0.18); noise(0.16, 0.22, 2500); },
        open() { tone(120, 40, 0.5, "sine", 0.9); noise(0.55, 0.55, 600); tone(900, 3200, 0.35, "sawtooth", 0.14); },
        fanfare() {
          [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => { tone(f, f, 0.34, "triangle", 0.3, 0.08 + i * 0.085); tone(f * 2, f * 2, 0.22, "square", 0.06, 0.08 + i * 0.085); });
          tone(1046.5, 1046.5, 1.1, "triangle", 0.26, 0.52); tone(1318.5, 1318.5, 1.1, "triangle", 0.2, 0.52); tone(1568, 1568, 1.1, "triangle", 0.16, 0.52);
          for (let i = 0; i < 9; i++) tone(2200 + Math.random() * 2200, 3000 + Math.random() * 2000, 0.07, "sine", 0.1, 0.55 + i * 0.07);
        },
        coin(p = 1) { tone(1318 * p, 1318 * p, 0.07, "square", 0.09); tone(1975 * p, 1975 * p, 0.16, "square", 0.09, 0.06); },
        land() { tone(220, 70, 0.18, "sine", 0.45); },
        get() { tone(660, 990, 0.09, "square", 0.14); tone(990, 1320, 0.12, "square", 0.14, 0.08); noise(0.1, 0.2, 3000, 0.02); },
      };

      // ---------- Partículas planas ----------
      let W = 0, H = 0, DPR = 1, parts = [], raf = 0, lastT = 0, dead = false;
      const resize = () => { DPR = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); };
      addEventListener("resize", resize); resize();
      const COL = ["#f0c850", "#ffd95a", "#e0262a", "#4cc3ff", "#8fbf4d", "#b9a6dc", "#ff8a1f"];
      const rnd = (a, b) => a + Math.random() * (b - a);
      const spawn = (o) => parts.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: 1500, rot: 0, vr: 0, life: 1.6, age: 0, size: 10, kind: "conf", col: "#f0c850", bounce: 0, floor: 0, drag: 0 }, o));
      const center = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; };
      const sparks = (x, y, n, speed = 520) => { for (let i = 0; i < n; i++) { const a = rnd(-Math.PI, 0) + rnd(-0.3, 0.3), v = rnd(0.4, 1) * speed; spawn({ kind: "spark", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: rnd(9, 20) * (W > 700 ? 1 : 0.8), col: COL[i % 2], life: rnd(0.45, 0.8), vr: rnd(-6, 6), g: 1200 }); } };
      const coins = (x, y, n, speed = 900) => { const floor = H * 0.93; for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + rnd(-0.85, 0.85), v = rnd(0.55, 1) * speed; spawn({ kind: "coin", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: rnd(14, 22) * (W > 700 ? 1 : 0.8), life: rnd(1.6, 2.4), g: 1900, bounce: 0.55, floor, vr: rnd(6, 12) }); } };
      const confetti = (n) => { for (let i = 0; i < n; i++) spawn({ kind: "conf", x: rnd(0, W), y: rnd(-H * 0.5, -10), vx: rnd(-90, 90), vy: rnd(120, 420), g: 120, size: rnd(9, 17), col: COL[i % COL.length], rot: rnd(0, 6), vr: rnd(-8, 8), life: rnd(2.2, 3.6), drag: 0.4 }); };
      const burstConfetti = (x, y, n) => { for (let i = 0; i < n; i++) { const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05), v = rnd(500, 1300); spawn({ kind: "conf", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 1500, size: rnd(9, 17), col: COL[i % COL.length], rot: rnd(0, 6), vr: rnd(-10, 10), life: rnd(1.8, 3), drag: 1.1 }); } };
      const frame = (t) => {
        if (dead) return;
        const dt = Math.min(0.05, (t - lastT) / 1000 || 0); lastT = t;
        ctx.clearRect(0, 0, W, H);
        parts = parts.filter((p) => p.age < p.life);
        for (const p of parts) {
          p.age += dt; p.vy += p.g * dt; if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt * 0.5; }
          p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
          if (p.floor && p.y > p.floor) { p.y = p.floor; p.vy *= -p.bounce; p.vx *= 0.8; if (Math.abs(p.vy) < 60) p.vy = 0; }
          const left = 1 - p.age / p.life, fade = left < 0.25 ? left / 0.25 : 1;
          ctx.globalAlpha = fade; ctx.fillStyle = p.col; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.kind === "coin" ? 0 : p.rot);
          if (p.kind === "conf") { ctx.scale(1, Math.cos(p.age * 9 + p.rot)); ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66); }
          else if (p.kind === "spark") { const s = p.size; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.28, -s * 0.28); ctx.lineTo(s, 0); ctx.lineTo(s * 0.28, s * 0.28); ctx.lineTo(0, s); ctx.lineTo(-s * 0.28, s * 0.28); ctx.lineTo(-s, 0); ctx.lineTo(-s * 0.28, -s * 0.28); ctx.closePath(); ctx.fill(); }
          else if (p.kind === "coin") { const sx = Math.abs(Math.cos(p.age * p.vr)); ctx.scale(Math.max(0.15, sx), 1); ctx.beginPath(); ctx.arc(0, 0, p.size, 0, 7); ctx.fill(); ctx.fillStyle = "#d9902a"; ctx.beginPath(); ctx.arc(0, 0, p.size * 0.62, 0, 7); ctx.fill(); }
          ctx.restore();
        }
        ctx.globalAlpha = 1;
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);

      // ---------- Animaciones ----------
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const anim = (el, kf, opt) => el.animate(kf, Object.assign({ fill: "forwards" }, opt)).finished.catch(() => {});
      const shake = (px = 6, ms = 260) => { const k = []; for (let i = 0; i < 8; i++) k.push({ transform: `translate(${rnd(-px, px)}px, ${rnd(-px, px)}px)` }); k.push({ transform: "translate(0,0)" }); stage.animate(k, { duration: ms }); };
      const flash = (op = 0.9, ms = 260) => q(".achest__flash").animate([{ opacity: op }, { opacity: 0 }], { duration: ms, easing: "steps(5, end)" });
      const sq = (x, y) => `scale(${x}, ${y})`;

      let hits = 0, busy = true, state = "idle", lastHit = 0;

      const hit = async () => {
        audio();
        if (state !== "idle" || busy) return;
        const now = performance.now(); if (now - lastHit < 170) return; lastHit = now;
        hits++; hint.style.opacity = 0;
        const c = center(inner);
        if (hits < 3) {
          const n = hits;
          SND.hit(n); shake(3 + n * 3, 220 + n * 40); sparks(c.x, c.y - c.h * 0.2, 7 + n * 6, 480 + n * 120);
          if (n >= 2) coins(c.x, c.y - c.h * 0.15, 3, 700);
          anim(inner, [{ transform: "none" }, { transform: sq(1 + 0.1 * n, 1 - 0.13 * n), offset: 0.22 }, { transform: sq(1 - 0.07 * n, 1 + 0.1 * n), offset: 0.5 }, { transform: `rotate(${n * 2.4}deg) ${sq(1.03, 0.98)}`, offset: 0.7 }, { transform: `rotate(${-n * 1.8}deg)`, offset: 0.85 }, { transform: "none" }], { duration: 420, easing: "ease-out" });
          return;
        }
        busy = true; state = "opening";
        SND.wind();
        await anim(inner, [{ transform: "none" }, { transform: sq(1.34, 0.64), offset: 1 }], { duration: 150, easing: "ease-in" });
        SND.open(); flash(0.95, 380); shake(16, 520);
        q(".achest__closed").style.visibility = "hidden"; q(".achest__opened").style.visibility = "visible";
        const cc = center(inner), top = { x: cc.x, y: cc.y - cc.h * 0.1 };
        burstConfetti(top.x, top.y, 90); coins(top.x, top.y, 22, 1250); sparks(top.x, top.y, 26, 900); confetti(70);
        rays.classList.add("achest__rays--on"); dim.style.opacity = 0.12;
        anim(inner, [{ transform: sq(1.34, 0.64) }, { transform: sq(0.76, 1.4), offset: 0.3 }, { transform: sq(1.14, 0.88), offset: 0.58 }, { transform: sq(0.96, 1.05), offset: 0.8 }, { transform: "none" }], { duration: 640, easing: "ease-out" });
        for (let i = 0; i < 7; i++) setTimeout(() => SND.coin(1 + i * 0.06), 260 + i * 90);
        setTimeout(SND.fanfare, 120);
        // El artefacto pasa a ser tuyo en cuanto se abre el cofre (aunque se cierre el juego en la ficha).
        if (!dry && artId && !this.owns(artId)) { this._s.own.push(artId); this._persist(); }
        await wait(260);
        await reveal(top);
        busy = false; state = "revealed";
      };

      const reveal = async (from) => {
        const art = q(".achest__art img");
        art.src = this.img(artId);
        anim(chest, [{ transform: "none", opacity: 1 }, { transform: "translateY(26vmin) scale(.7)", opacity: 0 }], { duration: 480, easing: "cubic-bezier(.5,0,.9,.4)", delay: 380 });
        anim(q(".achest__chestshadow"), [{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 380 });
        cush.style.display = "block"; wrap.style.display = "block"; sh.style.display = "block";
        cush.style.transform = "scale(0)";
        const rect = wrap.getBoundingClientRect(), dx = from.x - (rect.left + rect.width / 2), dy = from.y - (rect.top + rect.height / 2);
        anim(wrap, [
          { transform: `translate(${dx}px, ${dy}px) scale(.15)`, opacity: 0 },
          { transform: `translate(${dx * 0.3}px, ${dy * 0.3 - 150}px) scale(1.55, 1.8)`, opacity: 1, offset: 0.4 },
          { transform: "translateY(-5vmin) scale(1.25, .86)", offset: 0.62 },
          { transform: "scale(.9, 1.12)", offset: 0.78 },
          { transform: "scale(1.04, .97)", offset: 0.9 },
          { transform: "scale(1)" },
        ], { duration: 1000, easing: "ease-out" });
        await wait(700);
        SND.land();
        cush.animate([{ transform: "scale(0)" }, { transform: "scale(1.18, .8)", offset: 0.55 }, { transform: "scale(.96, 1.05)", offset: 0.8 }, { transform: "scale(1)" }], { duration: 420, easing: "ease-out", fill: "forwards" });
        sh.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: "forwards" });
        const lp = center(wrap); sparks(lp.x, lp.y + lp.h * 0.35, 14, 560); shake(8, 280);
        setTimeout(() => { rays.classList.remove("achest__rays--on"); }, 700);
        await wait(380);
        card.animate([{ transform: "translate(-50%, 140%)" }, { transform: "translate(-50%, -6%) scale(1.05, .94)", offset: 0.7 }, { transform: "translate(-50%, 0) scale(1)" }], { duration: 520, easing: "ease-out", fill: "forwards" });
        SND.coin(1.2);
        try { btn.focus({ preventScroll: true }); } catch (e) {}
      };

      const finish = () => {
        dead = true; cancelAnimationFrame(raf); clearInterval(padTimer);
        removeEventListener("resize", resize); removeEventListener("keydown", onKey, true);
        try { if (AC) AC.close(); } catch (e) {}
        root.remove();
        resolve();
      };

      const collect = async () => {
        if (state !== "revealed") return;
        state = "closing"; SND.get();
        const c = center(wrap), tx = W - c.x - 60, ty = -(c.y - 50);
        card.animate([{ transform: "translate(-50%, 0)" }, { transform: "translate(-50%, 160%)" }], { duration: 320, easing: "ease-in", fill: "forwards" });
        anim(wrap, [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.25, .8)", offset: 0.18 }, { transform: `translate(${tx}px, ${ty}px) scale(.15)`, opacity: 0 }], { duration: 520, easing: "cubic-bezier(.6,0,.9,.5)" });
        anim(cush, [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(0)", opacity: 0 }], { duration: 380, delay: 120, easing: "ease-in" });
        sh.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: "forwards" });
        dim.style.opacity = 0;
        await wait(560);
        root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" });
        await wait(170);
        finish();
      };

      // ---------- Controles: clic / toque / teclado / botón A del mando (el cofre no se puede saltar) ----------
      chest.addEventListener("pointerdown", (e) => { e.preventDefault(); hit(); });
      btn.addEventListener("click", () => collect());
      const onKey = (e) => {
        e.stopPropagation();
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (state === "revealed") collect(); else hit(); }
        else if (e.key === "Escape" || e.key === "Backspace" || e.key === "Tab") e.preventDefault();
      };
      addEventListener("keydown", onKey, true);
      let padA = false;
      const padTimer = setInterval(() => {
        let gp = null;
        try { gp = navigator.getGamepads && [...navigator.getGamepads()].find(Boolean); } catch (e) { return; }
        const a = !!(gp && gp.buttons[0] && gp.buttons[0].pressed);
        if (a && !padA) { if (state === "revealed") collect(); else hit(); }
        padA = a;
      }, 30);
      setInterval(function hintWobble() {
        if (dead) return clearInterval(hintWobble);
        if (state === "idle" && !busy && hits === 0) anim(inner, [{ transform: "none" }, { transform: "rotate(-3deg)" }, { transform: "rotate(3deg)" }, { transform: "rotate(-2deg)" }, { transform: "none" }], { duration: 480 });
      }, 2800);

      // Carga de las imágenes del artefacto ya (para que no haya "pop" al salir) y entrada del cofre.
      this._loadImgs(artId ? [this.img(artId)] : []).then(async () => {
        root.classList.add("achest--in");
        anim(chest, [{ transform: "translateY(-70vmin) scale(.9, 1.2)", opacity: 0 }, { transform: "translateY(0) scale(1.18, .8)", opacity: 1, offset: 0.55 }, { transform: "translateY(-3vmin) scale(.94, 1.08)", offset: 0.75 }, { transform: "translateY(0) scale(1)" }], { duration: 760, easing: "ease-in" });
        await wait(420); SND.land(); const c = center(inner); sparks(c.x, c.y + c.h * 0.35, 10, 400); shake(7, 260);
        await wait(340); busy = false; hint.style.opacity = 1;
      });
    });
  },

  // ---------- Pestaña ARTEFACTOS del perfil ----------
  tabHtml() {
    const T = (k, v) => this.t(k, v);
    const lvl = this.level(), slots = this.slotCount(lvl);
    if (this._slot >= slots) this._slot = 0;
    const cush = ART_SLOT_LEVELS.map((need, i) => {
      const open = i < slots, id = open ? this._s.eq[i] : null;
      return `<div class="art-slot${open ? "" : " art-slot--lock"}${open && i === this._slot ? " art-slot--sel" : ""}" data-slot="${i}" ${open ? 'role="button" tabindex="0"' : ""}>
        <img class="art-slot__cush" src="${this.img("cushion")}" alt="" draggable="false">
        ${id ? `<img class="art-slot__art" src="${this.img(id)}" alt="${this._esc(this.name(id))}" draggable="false">` : ""}
        ${open ? "" : `<span class="art-slot__lock"><i class="ph-fill ph-lock"></i><b>${T("art_slot_lock", { n: need })}</b></span>`}
      </div>`;
    }).join("");
    const foc = this._focus && this.def(this._focus) ? this._focus : null;
    const info = foc
      ? `<b>${this.owns(foc) ? this._esc(this.name(foc)) : T("art_unknown")}</b><span>${this.owns(foc) ? this._esc(this.desc(foc)) : T("art_locked_desc")}</span>`
      : `<span>${T("art_help")}</span>`;
    const eqIds = this._s.eq.slice(0, slots);
    const tiles = ART_DEFS.map((d) => {
      const own = this.owns(d.id), on = eqIds.includes(d.id);
      return `<div class="av-tile art-tile${own ? "" : " av-tile--lock art-tile--lock"}${on ? " av-tile--sel" : ""}${foc === d.id ? " art-tile--foc" : ""}" data-art="${d.id}" role="button" tabindex="0" aria-label="${this._esc(own ? this.name(d.id) : T("art_unknown"))}">
        <span class="av-tile__img"><img src="${this.img(d.id)}" alt="" draggable="false"></span>
        ${own ? "" : '<span class="av-tile__lock"><i class="ph-bold ph-lock-simple"></i></span>'}
        ${on ? `<span class="art-tile__on">${T("art_equipped")}</span>` : ""}
      </div>`;
    }).join("");
    const have = this._s.own.length, total = ART_DEFS.length;
    const next = have < total ? T("art_next", { n: this.chestLevel(Math.max(have, this.chestsEarned()) + 1) }) : T("art_all");
    return `<div class="art-tab">
      <div class="art-shelf">${cush}</div>
      <div class="art-info">${info}</div>
      <div class="art-count">${T("art_count", { a: have, b: total })}</div>
      <div class="av-grid art-grid">${tiles}</div>
      <div class="art-next">${next}</div>
    </div>`;
  },

  _esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); },

  // js/stats.js llama a esto tras pintar la pestaña; `repaint` vuelve a pintarla.
  bindTab(el, repaint) {
    const click = () => { if (typeof SFX !== "undefined" && SFX.click) { try { SFX.click(); } catch (e) {} } };
    el.querySelectorAll(".art-slot:not(.art-slot--lock)").forEach((s) => s.addEventListener("click", () => {
      click(); this._slot = Number(s.dataset.slot) || 0;
      const id = this._s.eq[this._slot]; if (id) this._focus = id;
      repaint();
    }));
    el.querySelectorAll(".art-tile").forEach((t) => {
      const id = t.dataset.art;
      t.addEventListener("click", () => {
        click(); this._focus = id;
        if (this.owns(id)) this.equip(this._slot, id);
        repaint();
      });
      t.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); t.click(); } });
    });
  },

  // ---------- EFECTOS ----------
  // Parte: reinicio al empezar/reanudar una partida y "ganchos" que consultan el resto de archivos.
  reset() { this._teams = {}; this._freeKey = {}; },

  _isTutorial() { return typeof Tutorial !== "undefined" && Tutorial.active; },

  // Partida nueva. En local se aplica ya; en multijugador espera al "ready" del rival (ver Net).
  begin(mp) {
    this.reset();
    if (this._isTutorial()) return;
    const me = mp && typeof Net !== "undefined" && Net.active ? Net.myTeam : "player";
    this._teams[me] = this.equippedIds();
    if (!mp) this.applyStart();
  },

  // Partida reanudada desde el guardado: los efectos "de inicio" ya están en el guardado.
  resume() {
    this.reset();
    if (this._isTutorial()) return;
    this._teams.player = this.equippedIds();
  },

  netPayload() { return (this._teams[typeof Net !== "undefined" ? Net.myTeam : "player"] || []).join(","); },
  netApply(str) {
    if (typeof Net === "undefined") return;
    const ids = typeof str === "string" ? str.split(",").filter((id) => this.def(id)).slice(0, 3) : [];
    this._teams[Net.otherTeam] = ids.filter((id, i) => ids.indexOf(id) === i);
  },

  has(team, id) { return !!(this._teams[team] && this._teams[team].includes(id)); },

  // Efectos que se aplican una sola vez al comenzar la partida.
  applyStart() {
    Object.keys(this._teams).forEach((team) => {
      try {
        if (typeof Armory !== "undefined" && Armory.state && Armory.state[team]) {
          if (this.has(team, "espada")) Armory.state[team].arma = Math.max(Armory.state[team].arma, 1);
          if (this.has(team, "armadura")) { Armory.state[team].armadura = Math.max(Armory.state[team].armadura, 1); if (Armory.applyDefenseBonusToTeam) Armory.applyDefenseBonusToTeam(team); }
        }
        if (typeof Skills !== "undefined" && Skills.ranks) {
          [["tomo_guerra", "embestir"], ["tomo_prot", "raices"], ["tomo_super", "centinela"]].forEach(([art, sk]) => {
            if (!this.has(team, art)) return;
            if (!Skills.ranks[team]) Skills.ranks[team] = {};
            Skills.ranks[team][sk] = Math.max(Skills.ranks[team][sk] || 0, 1);
            if (Skills._applyPurchase) Skills._applyPurchase(team, sk);
          });
          if (typeof SkillsUI !== "undefined" && SkillsUI.refresh) SkillsUI.refresh();
        }
      } catch (e) { console.warn("artifacts applyStart:", e); }
    });
  },

  // Guantes PielResina: los pases del equipo no fallan.
  passSure(team) { return this.has(team, "guantes"); },
  // Botas AgarraSuelos: la unidad no se deja empujar.
  blocksPush(unit) { return !!unit && this.has(unit.team, "botas"); },
  // Hacha / Pico / Maza: recurso extra por cada recogida.
  resourceBonus(team, resId) {
    return (resId === "madera" && this.has(team, "hacha")) || (resId === "roca" && this.has(team, "pico")) || (resId === "metal" && this.has(team, "maza")) ? 1 : 0;
  },
  // Guantes EspavilaGnomos: una vez por turno (por equipo), pegar a un gnomo no gasta acción.
  freeGnomeHit(unit) {
    if (!unit || !this.has(unit.team, "espavila") || typeof Turns === "undefined") return false;
    const key = Turns.roundNumber + "|" + Turns.activeTeam;
    if (this._freeKey[unit.team] === key) return false;
    this._freeKey[unit.team] = key;
    return true;
  },
};
document.addEventListener("DOMContentLoaded", () => Artifacts.init());

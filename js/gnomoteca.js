/* Gnomore Gnomes — Gnomoteca: el libro del saber del juego.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Recordar qué ha visto el jugador (localStorage) y apuntarlo cuando algo aparece en pantalla durante una partida.
     - Reunir las fichas de unidades, equipos, escenarios, recursos, edificios y objetos a partir de los datos del propio
       juego (UNIT_TYPES, RACES, LEVELS...), así que lo que cambie en esos archivos se refleja aquí solo.
     - Pintar el libro (pantalla #screen-gnomoteca, abierta desde el botón del menú principal).
   Lo que aún no se ha visto sale como "???", con la descripción en blanco y el sprite convertido en una sombra oscura de un
   solo color; en cuanto se ve en partida, se desvela. Todo el texto es español literal: el traductor del juego
   (js/translate.js, EN_DICT) se ocupa del inglés. Estética: la misma "irregular" de todo el juego. */

const GNOMOTECA_KEY = "gnomoregnomes_gnomoteca";

const Gnomoteca = {
  seen: new Set(),
  cat: "unidades",
  sel: 0,
  _watchT: 0,
  _ready: false,
  _uid: null,
  _synced: 0, // cuántos descubrimientos ya están en la nube
  _pushT: 0,

  CATS: [
    { id: "unidades", label: "Unidades" },
    { id: "recursos", label: "Recursos" },
    { id: "edificios", label: "Edificios" },
    { id: "objetos", label: "Objetos" },
    { id: "equipos", label: "Equipos" },
    { id: "mecanicas", label: "Mecánicas" },
    { id: "escenarios", label: "Escenarios" },
  ],

  init() {
    try {
      const raw = localStorage.getItem(GNOMOTECA_KEY);
      if (raw) JSON.parse(raw).forEach((id) => this.seen.add(id));
    } catch (e) {}
    const btn = document.getElementById("btn-gnomoteca");
    if (btn) btn.addEventListener("click", () => this.open());
    this._startWatching();
    // Nube (Firestore gnomoteca/{uid}): UN documento con todos los ids en un texto. Una lectura al iniciar sesión y
    // escrituras solo cuando hay descubrimientos nuevos: agrupadas (90 s después del último) o al salir de la pestaña.
    document.addEventListener("gg:authchange", (e) => this._onAuth(e.detail && e.detail.user));
    document.addEventListener("visibilitychange", () => { if (document.hidden) this._push(); });
    window.addEventListener("pagehide", () => this._push());
  },

  get _db() { return typeof Account !== "undefined" ? Account._db : null; },

  async _onAuth(user) {
    this._uid = user ? user.uid : null;
    this._synced = 0;
    clearTimeout(this._pushT);
    const db = this._db, uid = this._uid;
    if (!db || !uid) return;
    try {
      const snap = await db.collection("gnomoteca").doc(uid).get();
      if (uid !== this._uid) return;
      let remote = 0;
      if (snap.exists) {
        const txt = snap.data().ids;
        if (typeof txt === "string" && txt) txt.split(",").forEach((id) => { if (id && !this.seen.has(id)) this.seen.add(id); remote++; });
      }
      this._synced = remote;
      try { localStorage.setItem(GNOMOTECA_KEY, JSON.stringify([...this.seen])); } catch (e) {}
      if (this.seen.size > remote) this._push(); // lo que tenía solo en este navegador sube de una vez
      if (this._ready && typeof this._render === "function" && document.getElementById("screen-gnomoteca").classList.contains("screen--active")) this._render();
    } catch (e) { console.warn("gnomoteca:", e && e.code); }
  },

  async _push() {
    clearTimeout(this._pushT);
    const db = this._db, uid = this._uid;
    if (!db || !uid || this.seen.size <= this._synced) return;
    const n = this.seen.size;
    try {
      await db.collection("gnomoteca").doc(uid).set({ v: 1, ids: [...this.seen].join(",") });
      if (uid === this._uid) this._synced = n;
    } catch (e) { console.warn("gnomoteca:", e && e.code); }
  },

  // ---------- Descubrimiento ----------
  discover(id) {
    if (!id || this.seen.has(id)) return false;
    this.seen.add(id);
    try { localStorage.setItem(GNOMOTECA_KEY, JSON.stringify([...this.seen])); } catch (e) {}
    if (this._uid) { clearTimeout(this._pushT); this._pushT = setTimeout(() => this._push(), 90000); }
    return true;
  },

  // Mientras hay una partida en pantalla, cada 1,5 s se apunta lo que se ve (nada de trabajo por fotograma).
  _startWatching() {
    if (this._watchT) return;
    this._watchT = setInterval(() => {
      const board = document.getElementById("screen-board");
      if (!board || !board.classList.contains("screen--active") || document.hidden) return;
      this._scanBoard();
    }, 1500);
  },

  _visible(el) {
    return !!el && !el.closest(".unit--fog-hidden");
  },

  _scanBoard() {
    // Escenario y equipo elegidos, y las mecánicas propias del escenario.
    if (typeof LevelAssets !== "undefined" && LevelAssets.current) { this.discover("l:" + LevelAssets.current); this.discover("m:" + LevelAssets.current); }
    if (typeof matchDraft !== "undefined" && matchDraft.raceId) this.discover("t:" + matchDraft.raceId);
    // Unidades (de cualquier bando) mientras no estén en la niebla.
    if (typeof Units !== "undefined" && Units.list) {
      Units.list.forEach((u) => {
        if (!u.el || !this._visible(u.el)) return;
        this.discover("u:" + u.typeId);
        const t = typeof UNIT_TYPES !== "undefined" ? UNIT_TYPES[u.typeId] : null;
        if (t && t.raceId) this.discover("t:" + t.raceId);
      });
    }
    if (typeof Gnome !== "undefined" && Gnome.list && Gnome.list.some((g) => g.el && this._visible(g.el))) this.discover("u:gnomo");
    // Recursos de escenario.
    if (typeof Resources !== "undefined" && Resources.list) {
      Resources.list.forEach((n) => { if (n.el && this._visible(n.el)) this.discover("r:" + n.kind); });
    }
    // Edificios y estructuras.
    const q = (sel, id) => { const e = document.querySelector(sel); if (e && this._visible(e)) this.discover(id); };
    q(".obelisk__sprite", "b:obelisco");
    q(".village__sprite", "b:totem");
    q(".altar__sprite", "b:altar");
    q(".shop__sprite:not(.oracle__sprite)", "b:tienda");
    q(".oracle__sprite", "b:oraculo");
    q(".reliquia-altar", "b:camara");
    q(".reliquia-guard", "u:guardia");
    // Objetos: reliquias de la mochila y la Reliquia Paranoica.
    if (typeof Relics !== "undefined" && Relics.byTeam && Relics.byTeam.player) Relics.byTeam.player.forEach((r) => this.discover("o:" + r.relicId));
    if (typeof Reliquia !== "undefined" && Reliquia.relic && Reliquia.relic.state && Reliquia.relic.state !== "altar") this.discover("o:reliquia_paranoica");
  },

  // ---------- Datos ----------
  _race(raceId) {
    return typeof RACES !== "undefined" ? RACES.find((r) => r.id === raceId) : null;
  },
  _tr(key) {
    return typeof I18N !== "undefined" ? I18N.t(key) : key;
  },

  entries(cat) {
    const out = [];
    if (cat === "unidades") {
      out.push({
        id: "u:gnomo", name: "Gnomo", type: "Unidad básica", img: "assets/equipos/MushboomForest/gnomo_idle.png",
        desc: "Pequeño, barbudo y sorprendentemente útil como proyectil. Se lanza contra recursos, guardias y páginas, y se carga de puntos al golpear.",
        chips: ["Se puede lanzar", "Una unidad solo carga un gnomo"],
      });
      if (typeof UNIT_TYPES !== "undefined") {
        const maxOf = (k) => Math.max(5, ...Object.values(UNIT_TYPES).map((t) => t[k] || 0));
        Object.keys(UNIT_TYPES).forEach((id) => {
          const t = UNIT_TYPES[id];
          const race = this._race(t.raceId);
          const ab = typeof ABILITIES !== "undefined" ? ABILITIES[id] : null;
          out.push({
            id: "u:" + id, name: t.name, type: race ? this._tr(race.nameKey) : "Unidad", img: t.spriteUrl,
            desc: typeof UNIT_DESCRIPTIONS !== "undefined" ? UNIT_DESCRIPTIONS[id] || "" : "",
            stats: [["Aguante", t.aguante, maxOf("aguante")], ["Movimiento", t.movimiento, maxOf("movimiento")], ["Fuerza", t.fuerza, maxOf("fuerza")], ["Agilidad", t.agilidad, maxOf("agilidad")], ["Percepción", t.percepcion, maxOf("percepcion")]],
            extra: ab ? [[ab.name, ab.description]] : [],
          });
        });
      }
      out.push({
        id: "u:guardia", name: "Guardia de la Reliquia", type: "Neutral · Fortaleza WallForge", img: "assets/niveles/wallforge/guardia.png",
        desc: "Paranoico profesional. Vigila la cámara sellada y persigue sin descanso a quien lleve la Reliquia, sea del equipo que sea.",
        chips: ["Inmortal", "Solo se marea con un gnomo lanzado"],
      });
    } else if (cat === "recursos") {
      const R = typeof RESOURCE_NODE_TYPES !== "undefined" ? RESOURCE_NODE_TYPES : {};
      const txt = {
        roca: "Fuente de roca. Con dos golpes se rompe y suelta roca para la mochila.",
        pino: "Árbol de madera. Con dos golpes cae y suelta madera para la mochila.",
        mena: "Mena de metal, escasa a propósito. Con dos golpes suelta metal, necesario para subir la armería al máximo.",
      };
      Object.keys(R).forEach((k) => out.push({
        id: "r:" + k, name: k === "pino" ? "Árbol" : k === "mena" ? "Mena de Hierro" : "Roca", type: "Recurso · neutral",
        img: R[k].spriteUrl.replace(/\.png$/, "_midres.png"), desc: txt[k] || "", chips: ["Bloquea el paso", "Se rompe con dos golpes"],
      }));
    } else if (cat === "edificios") {
      out.push(
        { id: "b:obelisco", name: "Obelisco", type: "Estructura · base", img: "assets/edificios/obelisco_mushboom_forest_midres.png", desc: "Tu base. Desde él reclutas unidades, eliges habilidades y mejoras en la armería. Si cae, pierdes la partida.", chips: ["Reclutar", "Habilidades", "Armería"] },
        { id: "b:totem", name: "Tótem", type: "Estructura · capturable", img: "assets/iconos/poblado_neutral_midres.png", desc: "Capturarlo da Puntos de Gloria cada turno. Se defiende con flechas y no sufre daño de ataques normales.", chips: ["Da Gloria", "Capturable"] },
        { id: "b:altar", name: "Altar de Sacrificios", type: "Estructura · MushBoom", img: "assets/edificios/altar_sacrificios_lleno_midres.png", desc: "Aquí se ofrecen gnomos para ganar Gloria al instante.", chips: ["Sacrificio"] },
        { id: "b:tienda", name: "Tienda Goblin", type: "Estructura · comercio", img: "assets/edificios/tienda_goblin_midres.png", desc: "Un goblin con muy mala leche y buenos precios. Se repone cada cierto número de turnos.", chips: ["Compra con Gloria"] },
        { id: "b:oraculo", name: "Oráculo", type: "Estructura · cartas", img: "assets/edificios/oraculo_midres.png", desc: "Ocho cartas boca abajo, las mismas para todos. Paga para girar dos; si coinciden, ganas su beneficio.", chips: ["Cartas", "Coste creciente"] },
        { id: "b:camara", name: "Cámara de la Reliquia", type: "Estructura · WallForge", img: "assets/niveles/wallforge/altar_sellado.png", desc: "Cámara sellada con cadenas en el centro del mapa. Las cadenas ceden cuando se lanza contra ella un gnomo cargado.", chips: ["Centro del mapa", "Se resella al devolver la Reliquia"] },
      );
    } else if (cat === "objetos") {
      const RT = typeof RELIC_TYPES !== "undefined" ? RELIC_TYPES : {};
      Object.keys(RT).forEach((id) => out.push({ id: "o:" + id, name: RT[id].name, type: "Reliquia de la mochila", img: RT[id].iconUrl, desc: RT[id].description, chips: ["Aguanta " + RT[id].durability + " bajas"] }));
      out.push({ id: "o:reliquia_paranoica", name: "Reliquia Paranoica", type: "Objeto único · WallForge", img: "assets/niveles/wallforge/reliquia.png", desc: "Quien la lleva deja ondas en los pies y todos lo ven, a él y lo que ve. Gana puntos con las páginas y los cobra al llegar junto a su obelisco.", chips: ["Visible para todos", "Si el portador cae, queda en el suelo"] });
    } else if (cat === "equipos") {
      (typeof RACES !== "undefined" ? RACES : []).forEach((r) => out.push({
        id: "t:" + r.id, name: this._tr(r.nameKey), type: "Equipo", img: r.iconImg, desc: this._tr(r.flavorKey),
        extra: [["Virtudes", this._tr(r.virtuesKey)], ["Debilidades", this._tr(r.weaknessesKey)]],
      }));
    } else if (cat === "mecanicas") {
      out.push(
        { id: "m:mushboom_forest", name: "Hongos explosivos y GnomOgro", type: "Mecánica · MushBoom Forest", img: "assets/niveles/logo_mushboom_forest.png", desc: "Las setas explosivas sacuden el campo de batalla y el GnomOgro castiga a cualquiera que se acerque demasiado. Las explosiones no distinguen bandos.", chips: ["Setas explosivas", "GnomOgro"] },
        { id: "m:colinas_rockntroll", name: "Volcán y tambores", type: "Mecánica · Colinas Rock'n Troll", img: "assets/niveles/logo_colinas_rockntroll.png", desc: "Sacrifica gnomos o lanza rocas al volcán: al llenarse, entra en erupción. Los tambores neutrales marcan el ritmo de la lluvia de piedras.", chips: ["Volcán", "Lava", "Tambores"] },
        { id: "m:hurrycrane_village", name: "Huevo de grulla y la grulla", type: "Mecánica · Poblado HurryCrane", img: "assets/niveles/logo_hurrycrane_village.png", desc: "El huevo rebota entre bumpers como una bola de pinball y, al explotar, reparte premio. La grulla se posa en los obeliscos y los bloquea hasta que se marcha.", chips: ["Huevo", "Bumpers", "Grulla"] },
        { id: "m:wallforge", name: "Reliquia Paranoica", type: "Mecánica · Fortaleza WallForge", img: "assets/niveles/wallforge/reliquia.png", desc: "Abre la cámara con un gnomo cargado, coge la Reliquia y pisa páginas para sumar puntos. Llévala junto a tu obelisco para cobrar; tu rival pierde lo mismo.", chips: ["Páginas", "Guardias", "Obelisco"] },
      );
    } else if (cat === "escenarios") {
      (typeof LEVELS !== "undefined" ? LEVELS : []).filter((l) => l.available !== false).forEach((l) => out.push({
        id: "l:" + l.id, name: this._tr(l.nameKey), type: "Escenario", img: l.islandImg, desc: this._tr(l.flavorKey),
        chips: (l.featureKeys || []).map((k) => this._tr(k)),
      }));
    }
    return out;
  },

  // ---------- Interfaz ----------
  open() {
    this._build();
    this.cat = "unidades";
    this.sel = 0;
    this._render(false);
    if (typeof goToScreen === "function") goToScreen("screen-gnomoteca");
  },

  _build() {
    const root = document.getElementById("gnomoteca-root");
    if (!root || this._ready) return;
    this._ready = true;
    root.innerHTML = `
      <div class="gnomo-stage">
        <div class="gnomo-tabs" id="gt-tabs"></div>
        <div class="gnomo-ribbon dl"></div>
        <div class="gnomo-title dl"><span>Gnomoteca</span></div>
        <div class="gnomo-book dl">
          <div class="gnomo-pages">
            <section class="gnomo-pg gnomo-pg--l dl"><h3 class="gnomo-h" id="gt-cat"></h3><div class="gnomo-list" id="gt-list"></div><span class="gnomo-pn gnomo-pn--l" id="gt-pl"></span></section>
            <section class="gnomo-pg gnomo-pg--r dl" id="gt-right"><h3 class="gnomo-h" id="gt-name"></h3>
              <div class="gnomo-plate dl"><span class="gnomo-tag" id="gt-tag"></span><img id="gt-img" alt="" draggable="false" /></div>
              <div class="gnomo-scroll"><p class="gnomo-desc" id="gt-desc"></p><div id="gt-stats"></div><div id="gt-extra"></div><div class="gnomo-chips" id="gt-chips"></div></div>
              <span class="gnomo-pn gnomo-pn--r" id="gt-pr"></span></section>
          </div>
        </div>
      </div>`;
    root.querySelector("#gt-tabs").addEventListener("click", (e) => {
      const t = e.target.closest(".gnomo-tab");
      if (t) { this.cat = t.dataset.c; this.sel = 0; this._render(true); }
    });
    root.querySelector("#gt-list").addEventListener("click", (e) => {
      const it = e.target.closest(".gnomo-it");
      if (it) { this.sel = +it.dataset.k; this._render(true); }
    });
    root.querySelector("#gt-list").addEventListener("keydown", (e) => {
      const it = e.target.closest(".gnomo-it");
      if (it && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); this.sel = +it.dataset.k; this._render(true); }
    });
    // Teclado: ◂ ▸ cambian de categoría, ▴ ▾ de entrada (mientras el libro está abierto).
    document.addEventListener("keydown", (e) => {
      const scr = document.getElementById("screen-gnomoteca");
      if (!scr || !scr.classList.contains("screen--active")) return;
      const ci = this.CATS.findIndex((c) => c.id === this.cat), n = this.entries(this.cat).length;
      if (e.key === "ArrowLeft") { this.cat = this.CATS[(ci + this.CATS.length - 1) % this.CATS.length].id; this.sel = 0; this._render(true); }
      else if (e.key === "ArrowRight") { this.cat = this.CATS[(ci + 1) % this.CATS.length].id; this.sel = 0; this._render(true); }
      else if (e.key === "ArrowUp") { this.sel = Math.max(0, this.sel - 1); this._render(true); }
      else if (e.key === "ArrowDown") { this.sel = Math.min(n - 1, this.sel + 1); this._render(true); }
    });
  },

  _esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  },

  _render(flip) {
    const $ = (id) => document.getElementById(id);
    if (!$("gt-tabs")) return;
    const list = this.entries(this.cat);
    if (this.sel >= list.length) this.sel = 0;
    $("gt-tabs").innerHTML = this.CATS.map((c) => `<button type="button" class="gnomo-tab dl ${c.id === this.cat ? "gnomo-tab--active" : ""}" data-c="${c.id}">${c.label}</button>`).join("");
    $("gt-cat").textContent = this.CATS.find((c) => c.id === this.cat).label;
    $("gt-list").innerHTML = list.map((e, k) => {
      const lock = !this.seen.has(e.id);
      return `<div class="gnomo-it dl ${k === this.sel ? "gnomo-it--on" : ""} ${lock ? "gnomo-it--lock" : ""}" data-k="${k}" role="button" tabindex="0"><img src="${this._esc(e.img)}" alt="" draggable="false"><span>${lock ? "???" : this._esc(e.name)}</span></div>`;
    }).join("");
    const e = list[this.sel];
    if (!e) return;
    const lock = !this.seen.has(e.id);
    $("gt-name").textContent = lock ? "???" : e.name;
    $("gt-tag").textContent = lock ? "" : e.type || "";
    $("gt-tag").style.display = lock ? "none" : "";
    $("gt-img").src = e.img;
    $("gt-img").classList.toggle("gnomo-shadow", lock);
    $("gt-desc").textContent = lock ? "" : e.desc || "";
    $("gt-stats").innerHTML = lock || !e.stats ? "" : e.stats.map((s) => `<div class="gnomo-st"><span>${s[0]}</span><div class="gnomo-bar"><i style="width:${Math.min(100, Math.round((s[1] / s[2]) * 100))}%"></i></div><b>${s[1]}</b></div>`).join("");
    $("gt-extra").innerHTML = lock || !e.extra ? "" : e.extra.filter((x) => x[1]).map((x) => `<div class="gnomo-ex"><b>${this._esc(x[0])}</b><p>${this._esc(x[1])}</p></div>`).join("");
    $("gt-chips").innerHTML = lock || !e.chips ? "" : e.chips.map((c) => `<span class="gnomo-chip">${this._esc(c)}</span>`).join("");
    const ci = this.CATS.findIndex((c) => c.id === this.cat);
    $("gt-pl").textContent = ci * 2 + 1;
    $("gt-pr").textContent = ci * 2 + 2;
    if (flip) {
      const r = $("gt-right");
      r.classList.remove("gnomo-flip");
      void r.offsetWidth;
      r.classList.add("gnomo-flip");
      if (typeof SFX !== "undefined" && SFX.uiClick) { try { SFX.uiClick(); } catch (er) {} }
    }
  },
};

document.addEventListener("DOMContentLoaded", () => Gnomoteca.init());

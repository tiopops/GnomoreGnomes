/* Gnomore Gnomes — Imágenes de perfil (retratos desbloqueables).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Qué retratos existen (todas las unidades, Nizak y el guardia de WallForge, tomados de la Gnomoteca) y cómo se desbloquea cada uno.
     - Recordar los desbloqueados y el elegido (localStorage + Firestore avatars/{uid}, un documento por usuario).
     - Pintar el selector (clic en el recuadro de la foto del perfil) y el retrato pequeño que usan el lobby y el final de partida.
   Desbloqueos:
     - Una unidad: aniquilar una unidad rival de ese tipo (Units.removeUnit avisa con onRivalDied).
     - Nizak: completar los 5 tutoriales.
     - Guardia de WallForge: marearlo lanzándole un gnomo (Reliquia._stun avisa con onGuardStunned).
     - El gnomo viene desbloqueado de serie. */

const AVATARS_KEY = "gnomoregnomes_avatars_";
const AVATAR_DEFAULT = "u:gnomo";
// Encuadre de la cara de cada retrato: [desplazamiento X %, desplazamiento Y %, zoom] sobre el recuadro.
// Se ajusta a mano con debug/editar-retratos.html y se pega aquí el resultado.
const AVATAR_CROPS = {
  "u:gnomo": [-8, 23.4, 1.8],
  "u:hombre_arbol": [-21.8, 32.8, 1.9],
  "u:surcabosques": [-25.7, 19.3, 1.9],
  "u:seta_artificiero": [-15.4, 18.7, 1.8],
  "u:goblin_lanzador": [-15.2, 22.9, 1.8],
  "u:urgamentes": [-13.5, 41.3, 1.8],
  "u:punoroca": [-31.6, 35.9, 1.8],
  "u:manos_largas": [-22.3, 18.9, 1.8],
  "u:ala_fugaz": [-58.1, 17.4, 2.1],
  "u:nidobot": [-13.1, 28.5, 2],
  "u:magonifico": [-17.7, -10.8, 1.7],
  "u:trazaflechas": [-5.9, 18.8, 2],
  "u:portamuros": [-14.3, 22.8, 1.8],
  "u:guardia": [-3.4, 13.7, 1.8],
  "u:nizak": [15.6, 8.2, 1.8],
};
const AVATAR_TUTORIALS = ["basic", "mush", "rock", "crane", "wall"];

const Avatars = {
  u: new Set([AVATAR_DEFAULT]),
  sel: AVATAR_DEFAULT,
  _uid: null,
  _cloud: false,
  _dirty: false,
  _pushT: 0,
  _focus: 0,

  // ---------- Catálogo ----------
  list() {
    if (typeof Gnomoteca === "undefined" || !Gnomoteca.entries) return [];
    const ok = new Set(["u:gnomo", "u:nizak", "u:guardia"]);
    if (typeof UNIT_TYPES !== "undefined") Object.keys(UNIT_TYPES).forEach((id) => ok.add("u:" + id));
    return Gnomoteca.entries("unidades").filter((e) => ok.has(e.id)).map((e) => ({ id: e.id, name: e.name, img: e.img }));
  },
  get(id) { return this.list().find((a) => a.id === id) || null; },
  _tr(s) { return typeof I18N !== "undefined" && I18N.tr ? I18N.tr(s) : s; },
  _esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); },
  hint(a) {
    if (a.id === AVATAR_DEFAULT) return this._tr("El gnomo viene de serie. Es lo mínimo que se le puede pedir.");
    if (a.id === "u:nizak") return this._tr("Completa todos los tutoriales de Nizak.");
    if (a.id === "u:guardia") return this._tr("Marea a un guardia de WallForge lanzándole un gnomo.");
    return this._tr("Aniquila a un {0} rival.").replace("{0}", this._tr(a.name));
  },
  has(id) { return this.u.has(id); },
  // Ajuste del recorte de cara por retrato (origen y zoom); los que no figuran usan el recorte estándar.
  _crop(id) {
    const c = AVATAR_CROPS[id];
    return c ? ` style="--tx:${c[0]}%;--ty:${c[1]}%;--s:${c[2]}"` : "";
  },

  // ---------- Estado ----------
  init() {
    this._loadLocal();
    document.addEventListener("gg:authchange", (e) => this._onAuth(e.detail && e.detail.user));
    document.addEventListener("visibilitychange", () => { if (document.hidden) this._push(); });
    window.addEventListener("pagehide", () => this._push());
  },
  get _db() { return typeof Account !== "undefined" ? Account._db : null; },
  _key() { return AVATARS_KEY + (this._uid || "guest"); },
  _loadLocal() {
    this.u = new Set([AVATAR_DEFAULT]);
    this.sel = AVATAR_DEFAULT;
    try {
      const o = JSON.parse(localStorage.getItem(this._key()) || "null");
      if (o) { (o.u || []).forEach((id) => this.u.add(id)); if (o.sel && this.u.has(o.sel)) this.sel = o.sel; }
    } catch (e) {}
  },
  _saveLocal() { try { localStorage.setItem(this._key(), JSON.stringify({ u: [...this.u], sel: this.sel })); } catch (e) {} },
  _touch() {
    this._dirty = true;
    this._saveLocal();
    if (this._uid) { clearTimeout(this._pushT); this._pushT = setTimeout(() => this._push(), 8000); }
  },
  async _onAuth(user) {
    this._uid = user ? user.uid : null;
    this._cloud = false;
    clearTimeout(this._pushT);
    this._loadLocal();
    const db = this._db, uid = this._uid;
    if (!uid || !db) { this._refreshProfile(); return; }
    try {
      const snap = await db.collection("avatars").doc(uid).get();
      if (uid !== this._uid) return;
      let need = false;
      if (snap.exists) {
        const d = snap.data();
        const ids = typeof d.u === "string" && d.u ? d.u.split(",") : [];
        const rem = new Set(ids);
        ids.forEach((id) => { if (id) this.u.add(id); });
        if ([...this.u].some((id) => !rem.has(id))) need = true; // lo que solo tenía este navegador, sube
        if (typeof d.sel === "string" && this.u.has(d.sel)) this.sel = d.sel;
      } else need = true;
      this._dirty = need;
      this._saveLocal();
      this._cloud = true;
      if (need) this._touch();
      this._refreshProfile();
    } catch (e) { console.warn("avatars:", e && e.code); }
  },
  async _push() {
    clearTimeout(this._pushT);
    const db = this._db, uid = this._uid;
    if (!db || !uid || !this._cloud || !this._dirty) return;
    this._dirty = false;
    try {
      await db.collection("avatars").doc(uid).set({ v: 1, u: [...this.u].join(","), sel: this.sel });
    } catch (e) { this._dirty = true; console.warn("avatars:", e && e.code); }
  },

  // ---------- Desbloqueos ----------
  unlock(id) {
    if (!id || this.u.has(id)) return false;
    const a = this.get(id);
    if (!a) return false;
    this.u.add(id);
    this._touch();
    if (typeof Gnomoteca !== "undefined" && Gnomoteca._toast) {
      try { Gnomoteca._toast({ icon: "user-circle", name: this._tr("Imagen de perfil") + ": " + this._tr(a.name) }); } catch (e) {}
    }
    if (this._overlay && this._overlay.classList.contains("av-overlay--visible")) this._renderPicker();
    return true;
  },
  onRivalDied(unit) {
    if (unit && unit.typeId) this.unlock("u:" + unit.typeId);
  },
  onGuardStunned() { this.unlock("u:guardia"); },
  // Nizak: al completar los 5 tutoriales (se revisa al abrir el selector, el perfil y desde la Gnomoteca).
  check() {
    const T = typeof Tutorial !== "undefined" && Tutorial.isDone ? Tutorial : null;
    if (T && AVATAR_TUTORIALS.every((id) => T.isDone(id))) this.unlock("u:nizak");
  },

  // ---------- Retrato ----------
  // Recorte de "cara": la parte alta del sprite, ampliada. Se usa tal cual en el selector, el lobby y el final.
  faceHtml(id, cls) {
    const a = this.get(id || this.sel) || this.get(AVATAR_DEFAULT);
    if (!a) return `<i class="ph-fill ph-user"></i>`;
    return `<span class="av-face ${cls || ""}"${this._crop(a.id)}><img src="${this._esc(a.img)}" alt="" draggable="false"></span>`;
  },
  currentId() { return this.has(this.sel) ? this.sel : AVATAR_DEFAULT; },
  // Retrato válido venido de la red: solo ids que existen en el catálogo.
  safeId(id) { return typeof id === "string" && this.get(id) ? id : AVATAR_DEFAULT; },
  _refreshProfile() {
    const av = document.querySelector(".pf-av");
    if (!av) return;
    const lv = av.querySelector(".pf-av__lv");
    [...av.children].forEach((n) => { if (n.tagName === "I" || n.classList.contains("av-face")) n.remove(); });
    av.insertAdjacentHTML("afterbegin", this.faceHtml(this.currentId(), "av-face--profile"));
    av.classList.add("pf-av--pick");
    if (!av._avBound) {
      av._avBound = true;
      // Directo sobre el recuadro: el panel de Mi Cuenta corta la propagación de los clics.
      av.addEventListener("click", (e) => { e.stopPropagation(); this.open(); });
      av.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.open(); } });
    }
    av.setAttribute("role", "button");
    av.setAttribute("tabindex", "0");
    av.setAttribute("title", this._tr("Cambiar imagen de perfil"));
    if (lv && lv.parentNode === av) av.appendChild(lv);
  },

  // ---------- Selector ----------
  _build() {
    if (this._overlay) return;
    const o = document.createElement("div");
    o.className = "av-overlay";
    o.innerHTML = `<div class="av-panel" role="dialog" aria-modal="true">
      <div class="av-title">${this._tr("Imagen de perfil")}</div>
      <div class="av-count" id="av-count"></div>
      <div class="av-grid" id="av-grid"></div>
      <div class="av-info" id="av-info"></div>
      <button type="button" class="p5-banner p5-banner--action av-close" id="av-close" style="--p5-tone:#2b2733"><span class="p5-banner__label">${this._tr("Cerrar")}</span></button>
    </div>`;
    document.body.appendChild(o);
    this._overlay = o;
    o.addEventListener("click", (e) => { if (e.target === o) this.close(); });
    o.querySelector("#av-close").addEventListener("click", () => { this._click(); this.close(); });
    o.querySelector("#av-grid").addEventListener("click", (e) => {
      const t = e.target.closest(".av-tile");
      if (t) this._pick(t.dataset.id);
    });
    o.querySelector("#av-grid").addEventListener("keydown", (e) => {
      const t = e.target.closest(".av-tile");
      if (!t) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this._pick(t.dataset.id); }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this._overlay.classList.contains("av-overlay--visible")) { e.stopPropagation(); this.close(); }
    }, true);
  },
  _click() { try { if (typeof SFX !== "undefined" && SFX.click) SFX.click(); else if (typeof SFX !== "undefined" && SFX.uiClick) SFX.uiClick(); } catch (e) {} },
  open() {
    this._build();
    this.check();
    this._focusId = this.currentId();
    this._renderPicker();
    this._overlay.classList.add("av-overlay--visible");
    const f = this._overlay.querySelector(".av-tile--sel") || this._overlay.querySelector(".av-tile");
    if (f && f.focus) f.focus({ preventScroll: true });
  },
  close() {
    if (this._overlay) this._overlay.classList.remove("av-overlay--visible");
  },
  _renderPicker() {
    const list = this.list();
    const got = list.filter((a) => this.has(a.id)).length;
    const cur = this.currentId();
    this._overlay.querySelector("#av-count").textContent = `${got} / ${list.length}`;
    this._overlay.querySelector("#av-grid").innerHTML = list.map((a) => {
      const lock = !this.has(a.id);
      return `<div class="av-tile ${lock ? "av-tile--lock" : ""} ${a.id === cur ? "av-tile--sel" : ""}" data-id="${this._esc(a.id)}" role="button" tabindex="0" aria-label="${this._esc(this._tr(a.name))}">
        <span class="av-tile__img"${this._crop(a.id)}><img src="${this._esc(a.img)}" alt="" draggable="false"></span>
        ${lock ? '<span class="av-tile__lock"><i class="ph-bold ph-lock-simple"></i></span>' : ""}
      </div>`;
    }).join("");
    this._info(this._focusId || cur);
  },
  _info(id) {
    this._focusId = id;
    const a = this.get(id);
    const el = this._overlay.querySelector("#av-info");
    if (!a) { el.innerHTML = ""; return; }
    const lock = !this.has(a.id);
    el.innerHTML = `<b>${this._esc(this._tr(a.name))}</b><span>${lock ? this._esc(this.hint(a)) : this._esc(this._tr("Desbloqueada"))}</span>`;
  },
  _pick(id) {
    this._click();
    this._info(id);
    this._overlay.querySelectorAll(".av-tile").forEach((t) => t.classList.toggle("av-tile--focus", t.dataset.id === id));
    if (!this.has(id)) {
      const t = this._overlay.querySelector(`.av-tile[data-id="${CSS.escape(id)}"]`);
      if (t && t.animate) t.animate([{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(5px)" }, { transform: "translateX(0)" }], { duration: 220 });
      return;
    }
    this.sel = id;
    this._touch();
    this._renderPicker();
    this._refreshProfile();
    const t = this._overlay.querySelector(".av-tile--sel img");
    if (t && t.animate) t.animate([{ transform: "scale(.8,1.18)" }, { transform: "scale(1.1,.9)", offset: 0.4 }, { transform: "scale(1)" }], { duration: 340, easing: "ease-out" });
  },
};

document.addEventListener("DOMContentLoaded", () => Avatars.init());

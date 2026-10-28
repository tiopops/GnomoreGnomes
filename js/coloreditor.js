/* Gnomore Gnomes — editor de colores de equipo (pantalla del menú principal).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Pintar la pantalla del editor: personaje, sus poses, una fila por zona de color (muestras + selector).
     - Dejar elegir colores y enseñar el resultado al momento sobre el sprite real.
     - Guardar (TeamColors.saveChar) o volver a los colores originales.
   Qué zonas tiene cada personaje, cómo se recolorea y dónde se guarda: js/teamcolors.js.
   El color que se guarda es el que se usa en la partida (propia y, en online, también la ve el rival). */

const ColorEditor = {
  _char: null,
  _colors: {}, // { zona: "#hex" } — lo que se ve ahora en pantalla
  _base: {}, // { zona: "#hex" } — colores originales del personaje
  _segs: [], // una segmentación por pose
  _pose: 0,
  _hot: null,
  _busy: false,
  _ready: false,
  _els: {},

  init() {
    const btn = document.getElementById("btn-colors");
    if (btn) btn.addEventListener("click", () => this.open());
    document.addEventListener("gg:langchange", () => { if (this._isOpen()) this._build(); });
  },

  _isOpen() {
    const s = document.getElementById("screen-colors");
    return !!(s && s.classList.contains("screen--active"));
  },

  _t(k) { return typeof I18N !== "undefined" ? I18N.t(k) : k; },
  _list() { return Object.keys(TeamColors.chars()); },

  async open() {
    if (typeof SFX !== "undefined") SFX.click();
    if (!this._char || !TeamColors.hasChar(this._char)) this._char = this._list()[0];
    goToScreen("screen-colors");
    await this._load(this._char);
  },

  async _load(typeId) {
    this._char = typeId;
    this._busy = true;
    this._build();
    const paths = TeamColors.spritePaths(typeId);
    this._segs = [];
    for (const p of paths) {
      try {
        const im = await TeamColors._load(p);
        this._segs.push({ url: p, seg: TeamColors.analyse(typeId, im) });
      } catch (e) {}
    }
    const first = this._segs[0];
    const ch = TeamColors.chars()[typeId];
    this._base = {};
    ch.zones.forEach((z) => { this._base[z.id] = first && first.seg.stats[z.id] ? TeamColors.baseHex(first.seg, z.id) : "#888888"; });
    const sv = TeamColors.saved[typeId] || {};
    this._colors = {};
    ch.zones.forEach((z) => { this._colors[z.id] = sv[z.id] || this._base[z.id]; });
    this._pose = 0;
    this._busy = false;
    this._build();
    this._render();
  },

  // Solo las zonas que difieren del original (lo que de verdad se recolorea y se guarda).
  _diff() {
    const out = {};
    Object.keys(this._colors).forEach((id) => {
      if (this._colors[id].toLowerCase() !== (this._base[id] || "").toLowerCase()) out[id] = this._colors[id].toLowerCase();
    });
    return out;
  },

  // ---------- Pantalla ----------
  _build() {
    const root = document.getElementById("screen-colors");
    if (!root) return;
    const typeId = this._char;
    if (!typeId) return;
    const ch = TeamColors.chars()[typeId];
    const def = typeof UNIT_TYPES !== "undefined" ? UNIT_TYPES[typeId] : null;
    const list = this._list();
    const multi = list.length > 1;
    const zoneRows = ch.zones.map((z) => {
      const sw = [this._base[z.id] || "#888888"].concat(z.sw).map((c, i) => `<button type="button" class="ce-sw${i === 0 ? " ce-sw--orig" : ""}" data-z="${z.id}" data-c="${c}" style="--c:${c}" aria-label="${c}"></button>`).join("");
      return `<div class="ce-row" data-z="${z.id}"><span class="ce-row__name">${this._t("ce_zone_" + z.id)}</span><span class="ce-sws">${sw}</span><label class="ce-pick" style="--c:${this._colors[z.id] || "#888"}"><i class="ph-fill ph-eyedropper"></i><input type="color" data-z="${z.id}" value="${this._colors[z.id] || "#888888"}"></label></div>`;
    }).join("");
    root.innerHTML = `
      <button class="back-btn" data-back><i class="ph ph-arrow-left"></i> <span>${this._t("back")}</span></button>
      <div class="ce-root">
        <div class="ce-fr ce-stage">
          <div class="ce-head">
            ${multi ? `<button type="button" class="ce-arrow" data-dir="-1" aria-label="‹"><i class="ph-bold ph-caret-left"></i></button>` : ""}
            <h2 class="ce-title">${def ? def.name : typeId}</h2>
            ${multi ? `<button type="button" class="ce-arrow" data-dir="1" aria-label="›"><i class="ph-bold ph-caret-right"></i></button>` : ""}
          </div>
          <div class="ce-canvas-wrap"><canvas class="ce-canvas" id="ce-canvas"></canvas></div>
          <div class="ce-poses" id="ce-poses"></div>
        </div>
        <div class="ce-fr ce-side">
          <div class="ce-rows" id="ce-rows">${zoneRows}</div>
          <div class="ce-actions">
            <button type="button" class="ce-btn" id="ce-random"><i class="ph-bold ph-dice-five"></i><span>${this._t("ce_random")}</span></button>
            <button type="button" class="ce-btn" id="ce-reset"><i class="ph-bold ph-arrow-counter-clockwise"></i><span>${this._t("ce_reset")}</span></button>
            <button type="button" class="ce-btn ce-btn--main" id="ce-save" data-primary><i class="ph-bold ph-floppy-disk"></i><span>${this._t("ce_save")}</span></button>
          </div>
        </div>
      </div>`;
    const back = root.querySelector("[data-back]");
    if (back) back.addEventListener("click", goBack);
    root.querySelectorAll(".ce-arrow").forEach((b) => b.addEventListener("click", () => this._step(+b.dataset.dir)));
    root.querySelectorAll(".ce-sw").forEach((b) => b.addEventListener("click", () => this._set(b.dataset.z, b.dataset.c, true)));
    root.querySelectorAll(".ce-row").forEach((r) => {
      const z = r.dataset.z;
      r.addEventListener("mouseenter", () => { this._hot = z; this._render(); });
      r.addEventListener("mouseleave", () => { this._hot = null; this._render(); });
      r.addEventListener("focusin", () => { this._hot = z; this._render(); });
      r.addEventListener("focusout", () => { this._hot = null; this._render(); });
    });
    root.querySelectorAll('input[type="color"]').forEach((i) => i.addEventListener("input", () => this._set(i.dataset.z, i.value, false)));
    root.querySelector("#ce-random").addEventListener("click", () => this._random());
    root.querySelector("#ce-reset").addEventListener("click", () => this._resetAll());
    root.querySelector("#ce-save").addEventListener("click", () => this._save());
    this._els = { canvas: root.querySelector("#ce-canvas"), poses: root.querySelector("#ce-poses") };
    this._buildPoses();
  },

  _buildPoses() {
    const box = this._els.poses;
    if (!box) return;
    box.innerHTML = "";
    this._segs.forEach((s, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ce-pose" + (i === this._pose ? " ce-pose--on" : "");
      const cv = document.createElement("canvas");
      cv.width = s.seg.W; cv.height = s.seg.H;
      b.appendChild(cv);
      b.addEventListener("click", () => { this._pose = i; if (typeof SFX !== "undefined") SFX.click(); this._buildPoses(); this._render(); });
      box.appendChild(b);
    });
  },

  _step(d) {
    const list = this._list();
    const i = (list.indexOf(this._char) + d + list.length) % list.length;
    if (typeof SFX !== "undefined") SFX.click();
    this._load(list[i]);
  },

  _set(zone, hex, fromSwatch) {
    this._colors[zone] = hex.toLowerCase();
    const root = document.getElementById("screen-colors");
    const row = root && root.querySelector(`.ce-row[data-z="${zone}"]`);
    if (row) {
      const pick = row.querySelector(".ce-pick");
      if (pick) pick.style.setProperty("--c", hex);
      const inp = row.querySelector('input[type="color"]');
      if (inp && inp.value !== hex) inp.value = hex;
    }
    if (fromSwatch && typeof SFX !== "undefined") SFX.click();
    this._render();
  },

  _random() {
    const ch = TeamColors.chars()[this._char];
    ch.zones.forEach((z) => {
      const pool = z.sw.slice();
      const rnd = () => TeamColors.hex(TeamColors._rgb(Math.random() * 360, 0.45 + Math.random() * 0.4, 0.3 + Math.random() * 0.35));
      const c = Math.random() < 0.5 ? pool[Math.floor(Math.random() * pool.length)] : rnd();
      this._set(z.id, z.id === "eyewhite" ? "#ffffff" : c, false);
    });
    if (typeof SFX !== "undefined") SFX.click();
  },

  _resetAll() {
    Object.keys(this._base).forEach((id) => this._set(id, this._base[id], false));
    if (typeof SFX !== "undefined") SFX.click();
  },

  async _save() {
    if (this._busy) return;
    this._busy = true;
    const diff = this._diff();
    const btn = document.querySelector("#ce-save");
    try {
      await TeamColors.saveChar(this._char, Object.keys(diff).length ? diff : null);
      if (typeof SFX !== "undefined") SFX.passSuccess ? SFX.passSuccess() : SFX.click();
      if (btn) {
        const i = btn.querySelector("i");
        if (i) { const old = i.className; i.className = "ph-bold ph-check"; setTimeout(() => { i.className = old; }, 1100); }
        btn.classList.remove("ce-btn--pop"); void btn.offsetWidth; btn.classList.add("ce-btn--pop");
      }
    } finally {
      this._busy = false;
    }
  },

  // ---------- Dibujo ----------
  _render() {
    if (!this._segs.length) return;
    const diff = this._diff();
    const cvMain = this._els.canvas;
    const cur = this._segs[this._pose] || this._segs[0];
    if (cvMain && cur) {
      const out = TeamColors.paint(cur.seg, diff, { hot: this._hot });
      cvMain.width = out.width; cvMain.height = out.height;
      cvMain.getContext("2d").drawImage(out, 0, 0);
    }
    const thumbs = this._els.poses ? this._els.poses.querySelectorAll("canvas") : [];
    thumbs.forEach((cv, i) => {
      const s = this._segs[i];
      if (!s) return;
      const out = TeamColors.paint(s.seg, diff, {});
      cv.getContext("2d").clearRect(0, 0, cv.width, cv.height);
      cv.getContext("2d").drawImage(out, 0, 0);
    });
  },
};

document.addEventListener("DOMContentLoaded", () => ColorEditor.init());

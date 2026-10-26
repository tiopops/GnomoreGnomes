/* Gnomore Gnomes — pantallas de selección de partida: RAZA -> ESCENARIO -> RIVALES.
   Regla de oro: un archivo por mecánica — este solo pinta las 3 pantallas de selección
   (diseño aprobado en debug/demo_seleccion_raza_escenario) y guarda la elección en
   matchDraft; la navegación entre pantallas y el arranque de la partida siguen siendo de
   js/newgame-flow.js.
   - RAZA: emblema grande con flechas, nombre, panel integrado de virtudes/debilidades que
     se cambia por la ficha de la unidad pulsada, y las 3 unidades de la raza (de menor a
     mayor coste, a su escala real) sobresaliendo de su recuadro.
   - ESCENARIO: carrusel rotatorio; la isla elegida pasa al frente, más grande.
   - RIVALES: tarjetas de 1/2/3 rivales con los emblemas de las razas que te tocarán. */

const SelectScreens = {
  ST: { ri: 0, front: 0, nr: 1, selU: null },
  SCREENS: ["screen-race-select", "screen-level-select", "screen-opponent-select"],

  // Altura (px) a la que se dibuja cada unidad: más grande = criatura más grande.
  UNIT_H: {
    hombre_arbol: 135, surcabosques: 95, seta_artificiero: 112,
    goblin_lanzador: 102, urgamentes: 112, punoroca: 142,
    manos_largas: 90, ala_fugaz: 112, nidobot: 135,
    magonifico: 100, trazaflechas: 120, portamuros: 140,
  },
  LEVEL_TEXT_COLOR: { colinas_rockntroll: "#c9ced8" },
  STAT_ROWS: [["aguante", "sel_stat_aguante"], ["fuerza", "sel_stat_fuerza"], ["movimiento", "sel_stat_movimiento"], ["agilidad", "sel_stat_agilidad"], ["percepcion", "sel_stat_percepcion"]],

  _raf: 0,
  _ang: 0,
  _bound: false,

  t(k) { return I18N.t(k); },
  races() { return RACES.filter((r) => r.available); },
  accent(r) { return r.titleColor || r.color; },

  // Estado por defecto al empezar una partida nueva: Guardabosques + Bosque Mushboom + 1 rival.
  reset() {
    this.ST.ri = 0;
    this.ST.front = 0;
    this.ST.nr = 1;
    this.ST.selU = null;
  },

  _bind() {
    if (this._bound) return;
    this._bound = true;
    window.addEventListener("resize", () => { if (this._active("screen-level-select")) this._place(); });
    document.addEventListener("keydown", (e) => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      const dir = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
      if (!dir) return;
      this._sfx("click");
      if (this._active("screen-race-select")) this.setRace(this.ST.ri + dir, true);
      else if (this._active("screen-level-select")) this.rotate(this.ST.front + dir);
      else if (this._active("screen-opponent-select")) this.setRivals(this.ST.nr + dir);
    });
  },
  _active(id) {
    const el = document.getElementById(id);
    return !!(el && el.classList.contains("screen--active"));
  },
  // Deslizar con el dedo (móvil): izquierda/derecha cambia de opción sin molestar al scroll vertical.
  _swipe(el, fn) {
    if (!el || el._swipeOn) return;
    el._swipeOn = true;
    let x0 = 0, y0 = 0, on = false;
    el.addEventListener("touchstart", (e) => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; on = true; }, { passive: true });
    el.addEventListener("touchend", (e) => {
      if (!on) return;
      on = false;
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        this._swAt = performance.now();
        this._sfx("click");
        fn(dx < 0 ? 1 : -1);
      }
    }, { passive: true });
  },
  _sfx(name) { try { if (typeof SFX !== "undefined" && SFX[name]) SFX[name](); } catch (e) {} },

  // ---------- piezas comunes ----------
  stepsHtml(n) {
    const names = [this.t("sel_step_race"), this.t("sel_step_level"), this.t("sel_step_rivals")];
    return `<div class="sel-steps">${names
      .map((s, i) => `<button type="button" class="sel-fr sel-step${i + 1 === n ? " sel-step--on" : ""}${i + 1 < n ? " sel-step--done" : ""}" data-step="${i + 1}"><b>${i + 1}</b>${s}</button>`)
      .join("")}</div>`;
  },
  chev(dir) {
    const d = dir < 0 ? "M53 3 L9 41 L49 89 L61 79 L31 43 L59 15Z" : "M11 3 L55 41 L15 89 L3 79 L33 43 L5 15Z";
    return `<svg viewBox="0 0 64 90"><path d="${d}" fill="#ffd23f" stroke="#000" stroke-width="5" stroke-linejoin="round"/></svg>`;
  },
  _bindSteps(root) {
    root.querySelectorAll(".sel-step").forEach((b) => b.addEventListener("click", () => this.goStep(+b.dataset.step)));
  },
  goStep(n) {
    const d = matchDraft;
    if (n === 2 && !d.raceId) return;
    if (n === 3 && !(d.raceId && d.levelId)) return;
    screenHistory.length = 0;
    screenHistory.push("main-menu", ...this.SCREENS.slice(0, n));
    if (n === 1) this.renderRace();
    if (n === 2) this.renderLevel();
    if (n === 3) this.renderRivals();
    showScreen(this.SCREENS[n - 1]);
  },
  _prepScreen(id, cls) {
    const el = document.getElementById(id);
    el.classList.add("sel-screen");
    return el;
  },
  _setAcc(el, color) { el.style.setProperty("--acc", color); },

  // ---------- Ajuste sin scroll en móvil ----------
  // Pedido explícito: "que las interfaces de equipo y escenario se muestren
  // completas sin necesidad de hacer scroll". En pantallas pequeñas la CSS deja
  // el contenido desplazable; aquí se mide cuánto sobra y, si no cabe, se
  // reduce todo el conjunto (transform) lo justo para que entre en pantalla.
  // El hueco superior (Volver / ajustes) no se reduce. No toca pantallas donde
  // el contenido ya cabe (ordenador).
  _FIT_MQ: "(max-width: 720px), (max-height: 560px)",
  _fitInit(root) {
    if (!root || root._fitInit) return;
    root._fitInit = true;
    const run = () => { root._fitRaf = 0; this._fit(root); };
    const soon = () => { if (!root._fitRaf) root._fitRaf = requestAnimationFrame(run); };
    new MutationObserver(soon).observe(root, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", soon);
    const scr = root.closest(".screen");
    if (scr) new MutationObserver(soon).observe(scr, { attributes: true, attributeFilter: ["class"] });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(soon);
    soon();
  },
  _fit(root) {
    ["width", "height", "left", "right", "bottom", "top", "transform", "transform-origin", "--f", "--clear", "--vw100"]
      .forEach((k) => root.style.removeProperty(k));
    root.removeAttribute("data-fit");
    if (!window.matchMedia(this._FIT_MQ).matches) return;
    const H = root.clientHeight, W = root.clientWidth;
    if (!H || !W) return; // pantalla oculta
    const natural = root.scrollHeight;
    if (natural <= H + 1) return;
    const steps = root.querySelector(".sel-steps");
    const stepsRel = steps && getComputedStyle(steps).position === "relative";
    const clear = stepsRel ? parseFloat(getComputedStyle(steps).marginTop) || 0 : parseFloat(getComputedStyle(root).paddingTop) || 0;
    const hc = natural - clear;
    const f = Math.max(0.5, Math.min(1, ((H - clear) / hc) * 0.99));
    if (f >= 1) return;
    root.setAttribute("data-fit", stepsRel ? "steps" : "pad");
    root.style.setProperty("--f", f.toFixed(4));
    root.style.setProperty("--clear", clear + "px");
    root.style.setProperty("--vw100", (W / f).toFixed(1) + "px");
    root.style.top = "0";
    root.style.left = "50%";
    root.style.right = "auto";
    root.style.bottom = "auto";
    root.style.width = (W / f).toFixed(1) + "px";
    root.style.height = (H / f).toFixed(1) + "px";
    root.style.transformOrigin = "50% 0";
    root.style.transform = `translateX(-50%) scale(${f.toFixed(4)})`;
    if (this._place) this._place();
  },

  // ---------- 1. RAZA ----------
  units(race) {
    const list = Object.keys(UNIT_TYPES)
      .filter((id) => UNIT_TYPES[id].raceId === race.id)
      .map((id, i) => ({ id, i, price: Units.recruitPriceFor(id) }));
    list.sort((a, b) => a.price - b.price || a.i - b.i); // menor -> mayor puntos de gloria
    return list;
  },

  renderRace() {
    this._bind();
    const scr = this._prepScreen("screen-race-select");
    const root = document.getElementById("race-list");
    const races = this.races();
    const S = this.ST;
    S.ri = Math.max(0, Math.min(S.ri, races.length - 1));
    root.className = "sel-root";
    root.innerHTML = `
      ${this.stepsHtml(1)}
      <div class="sel-title">${this.t("sel_title_race")}</div>
      <div class="sel-hero">
        <button type="button" class="sel-arrow" id="sel-aL" aria-label="‹">${this.chev(-1)}</button>
        <div class="sel-emblem" id="sel-emblem"><img id="sel-eimg" alt=""></div>
        <button type="button" class="sel-arrow" id="sel-aR" aria-label="›">${this.chev(1)}</button>
      </div>
      <div class="sel-pips" id="sel-pips"></div>
      <div class="sel-rname" id="sel-rname"></div>
      <div class="sel-rflav" id="sel-rflav"></div>
      <div class="sel-fr sel-info2" id="sel-info2"></div>
      <div class="sel-team" id="sel-team"></div>
      <div class="sel-hintu">${this.t("sel_hint_unit")}</div>
      <button type="button" class="sel-fr sel-btn" id="sel-bRace" data-primary><span>${this.t("sel_btn_race")}</span></button>`;
    this._bindSteps(root);
    const pips = root.querySelector("#sel-pips");
    races.forEach((r, i) => {
      const p = document.createElement("div");
      p.className = "sel-pip";
      p.addEventListener("click", () => this.setRace(i, true));
      pips.appendChild(p);
    });
    root.querySelector("#sel-emblem").addEventListener("click", () => {
      if (typeof SFX !== "undefined" && SFX.click) { try { SFX.click(); } catch (er) {} }
      if (S.selU === null) return;
      S.selU = null;
      this.renderInfo();
      this.markTeam();
    });
    this._swipe(root.querySelector(".sel-hero"), (d) => this.setRace(S.ri + d, true));
    root.querySelector("#sel-aL").addEventListener("click", () => this.setRace(S.ri - 1, true));
    root.querySelector("#sel-aR").addEventListener("click", () => this.setRace(S.ri + 1, true));
    root.querySelector("#sel-bRace").addEventListener("click", () => {
      matchDraft.raceId = races[S.ri].id;
      this.goStep(2);
    });
    this.setRace(S.ri, false);
    this._fitInit(root);
  },

  setRace(i, anim) {
    const races = this.races(), S = this.ST;
    S.ri = (i + races.length) % races.length;
    S.selU = null;
    const r = races[S.ri];
    const scr = document.getElementById("screen-race-select");
    const root = document.getElementById("race-list");
    this._setAcc(scr, this.accent(r));
    root.querySelector("#sel-eimg").src = r.iconImg;
    const rn = root.querySelector("#sel-rname");
    rn.textContent = this.t(r.nameKey);
    root.querySelector("#sel-rflav").textContent = this.t(r.flavorKey);
    [...root.querySelector("#sel-pips").children].forEach((p, k) => p.classList.toggle("sel-pip--on", k === S.ri));
    const team = root.querySelector("#sel-team");
    team.innerHTML = this.units(r)
      .map((u, k) => {
        const T = UNIT_TYPES[u.id];
        const h = this.UNIT_H[u.id] || 110;
        return `<button type="button" class="sel-un sel-unit" data-k="${k}" data-t="${u.id}"><span class="sel-fr sel-un__box"></span><img class="sel-un__sp" style="--h:${h}px" src="${T.spriteUrl}" alt=""><span class="sel-un__nm">${T.name}</span></button>`;
      })
      .join("");
    const units = this.units(r);
    [...team.children].forEach((e) =>
      e.addEventListener("click", () => {
        const k = +e.dataset.k;
        S.selU = S.selU === k ? null : k;
        this.renderInfo();
        this.markTeam();
      })
    );
    this.renderInfo();
    if (anim) {
      ["sel-emblem", "sel-rname", "sel-rflav", "sel-team"].forEach((id) => {
        const e = root.querySelector("#" + id);
        e.classList.remove("sel-swap");
        void e.offsetWidth;
        e.classList.add("sel-swap");
      });
    }
  },

  abilityText(desc) {
    const sents = String(desc || "").split(/(?<=\.) /);
    let out = "";
    for (const s of sents) {
      if (s.includes("Un uso por partida") || s.startsWith("Gasta 1 acci")) continue;
      if (out.length + s.length > 300) break;
      out += (out ? " " : "") + s;
    }
    return out || String(desc || "").slice(0, 280);
  },

  // Tarjetas de virtudes/debilidades de una raza.
  _virtHtml(r) {
    const CHECK = '<svg class="sel-card__ic" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#1a1020" stroke="#000" stroke-width="2"/><path d="M9 16.5l4.8 4.8L23.5 11" fill="none" stroke="#7ee08a" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const CROSS = '<svg class="sel-card__ic" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#1a1020" stroke="#000" stroke-width="2"/><path d="M10.5 10.5l11 11M21.5 10.5l-11 11" fill="none" stroke="#ff8a7a" stroke-width="4.2" stroke-linecap="round"/></svg>';
    const lis = (txt) => String(txt).split(/(?<=\.) /).map((x) => `<li>${x}</li>`).join("");
    const card = (cls, ic, title, txt) => `<div class="sel-card sel-card--${cls}"><div class="sel-card__hd">${ic}<b>${title}</b></div><ul>${lis(txt)}</ul><i class="sel-card__glow"></i></div>`;
    return `<div class="sel-cols">${card("v", CHECK, this.t("sel_virtues"), this.t(r.virtuesKey))}${card("w", CROSS, this.t("sel_weaknesses"), this.t(r.weaknessesKey))}</div>`;
  },
  // Ficha de una unidad (idBtn solo en la real: el botón de cerrar).
  _unitHtml(r, u, idBtn) {
    const T = UNIT_TYPES[u.id], A = (typeof ABILITIES !== "undefined" && ABILITIES[u.id]) || null;
    const seg = (n) => `<span class="sel-seg">${[1, 2, 3, 4, 5].map((k) => `<i class="${k <= n ? "sel-seg--f" : ""}"></i>`).join("")}</span>`;
    const icon = A ? (A.iconImg ? `<img src="${A.iconImg}" alt="">` : `<i class="ph-fill ${A.icon}"></i>`) : "";
    const gl = r.gloryIcon ? `<img class="sel-glory" src="${r.gloryIcon}" alt="">` : "★";
    return `<div class="sel-ud"><div class="sel-ud__hd">${icon}<div><div class="sel-ud__n">${T.name}</div><div class="sel-ud__a">${this.t("sel_ability")} · ${A ? A.name : "—"}</div></div><button type="button" class="sel-ud__x"${idBtn ? ' id="sel-ux"' : ""}>✕ ${this.t("sel_close")}</button></div>
      <div class="sel-stats">${this.STAT_ROWS.map(([k, lk]) => `<span>${this.t(lk)}</span>${seg(T[k] || 0)}`).join("")}<span class="sel-price">${this.t("sel_cost")}</span><span class="sel-price sel-price--v">${gl}${u.price}</span></div>
      <p>${A ? this.abilityText(A.description) : ""}</p></div>`;
  },

  renderInfo() {
    const races = this.races(), S = this.ST, r = races[S.ri];
    const b = document.getElementById("sel-info2");
    // Todas las fichas se apilan en la misma celda y el recuadro mide SIEMPRE lo que mide la
    // mayor de todas (virtudes y unidades de TODOS los equipos): nunca cambia de tamaño, ni al
    // alternar entre virtudes y unidad ni al cambiar de equipo.
    const unit = S.selU !== null ? this._unitHtml(r, this.units(r)[S.selU], true) : "";
    b.classList.toggle("sel-info2--unit", S.selU !== null);
    const ghosts = [];
    races.forEach((r2) => {
      ghosts.push(this._virtHtml(r2));
      this.units(r2).forEach((u) => ghosts.push(this._unitHtml(r2, u, false)));
    });
    b.innerHTML = `<div class="sel-stack"><div class="sel-pane sel-pane--v">${this._virtHtml(r)}</div><div class="sel-pane sel-pane--u">${unit}</div>${ghosts.map((g) => `<div class="sel-pane sel-pane--ghost" aria-hidden="true">${g}</div>`).join("")}</div>`;
    const x = b.querySelector("#sel-ux");
    if (x) x.addEventListener("click", () => {
      this.ST.selU = null;
      this.renderInfo();
      this.markTeam();
    });
  },
  markTeam() {
    [...document.getElementById("sel-team").children].forEach((e, k) => e.classList.toggle("sel-un--sel", k === this.ST.selU));
  },

  // ---------- 2. ESCENARIO: carrusel rotatorio ----------
  renderLevel() {
    this._bind();
    this._prepScreen("screen-level-select");
    const root = document.getElementById("level-list");
    const S = this.ST;
    const race = RACES.find((r) => r.id === matchDraft.raceId) || this.races()[S.ri];
    root.className = "sel-root";
    root.innerHTML = `
      ${this.stepsHtml(2)}
      <div class="sel-title">${this.t("sel_title_level")}</div>
      <div class="sel-summ"><b>${this.t(race.nameKey)}</b></div>
      <div class="sel-orbit" id="sel-orbit">
        <button type="button" class="sel-arrow sel-arrow--nav sel-arrow--l" id="sel-nL" aria-label="‹">${this.chev(-1)}</button>
        <button type="button" class="sel-arrow sel-arrow--nav sel-arrow--r" id="sel-nR" aria-label="›">${this.chev(1)}</button>
      </div>
      <div class="sel-fr sel-info" id="sel-info"><div class="sel-info__live"><h2 id="sel-iname"></h2><div class="sel-fl" id="sel-ifl"></div><div class="sel-feat" id="sel-feat"></div></div>${this._levelGhosts()}</div>
      <button type="button" class="sel-fr sel-btn" id="sel-bLvl" data-primary><span>${this.t("sel_btn_level")}</span></button>`;
    this._bindSteps(root);
    this._setAcc(document.getElementById("screen-level-select"), this.accent(race));
    const orbit = root.querySelector("#sel-orbit");
    this._isl = LEVELS.map((l, i) => {
      const d = document.createElement("button");
      d.type = "button";
      d.className = "sel-isl";
      d.style.setProperty("--c", this.LEVEL_TEXT_COLOR[l.id] || l.color);
      d.style.setProperty("--d", `-${(NR() * 5).toFixed(2)}s`);
      d.setAttribute("aria-label", this.t(l.nameKey));
      d.innerHTML = `<span class="sel-isl__sh"></span><img class="sel-isl__im" src="${l.islandImg}" alt=""><span class="sel-isl__lbl">${this.t(l.nameKey)}</span>`;
      d.addEventListener("click", () => { if (performance.now() - (this._swAt || 0) < 350) return; this.rotate(i); });
      orbit.appendChild(d);
      return d;
    });
    this._swipe(orbit, (d) => this.rotate(S.front + d));
    root.querySelector("#sel-nL").addEventListener("click", () => this.rotate(S.front - 1));
    root.querySelector("#sel-nR").addEventListener("click", () => this.rotate(S.front + 1));
    root.querySelector("#sel-bLvl").addEventListener("click", () => {
      const lv = LEVELS[S.front];
      if (!lv || !lv.available) return;
      matchDraft.levelId = lv.id;
      this.goStep(3);
    });
    this._showLevelInfo();
    this._ang = S.front;
    this._place();
    requestAnimationFrame(() => this._place()); // por si el tamaño final llega tras el fade
    this._fitInit(root);
  },

  // Contenido de TODOS los niveles, invisible y apilado en la misma celda que el texto real:
  // así el recuadro siempre mide lo que el más largo y es idéntico en los tres niveles,
  // sea cual sea el ancho de pantalla (el texto se acopla dentro).
  _featHtml(l) {
    return (l.featureKeys || [])
      .map((k, i) => {
        const txt = this.t(k), at = txt.indexOf(": ");
        const body = at > 0 ? `<b>${txt.slice(0, at)}</b>${txt.slice(at)}` : txt;
        return `<div class="sel-ft"><span class="sel-ft__ib"><i class="ph-fill ${l.featureIcons[i] || "ph-check-circle"}"></i></span><div>${body}</div></div>`;
      })
      .join("");
  },

  _levelGhosts() {
    return LEVELS.map((l) =>
      `<div class="sel-info__ghost" aria-hidden="true"><h2>${this.t(l.nameKey)}</h2><div class="sel-fl">${this.t(l.flavorKey)}</div><div class="sel-feat">${this._featHtml(l)}</div></div>`
    ).join("");
  },

  _showLevelInfo() {
    const l = LEVELS[this.ST.front];
    const inf = document.getElementById("sel-info");
    inf.style.setProperty("--c", this.LEVEL_TEXT_COLOR[l.id] || l.color);
    document.getElementById("sel-iname").textContent = this.t(l.nameKey);
    document.getElementById("sel-ifl").textContent = this.t(l.flavorKey);
    document.getElementById("sel-feat").innerHTML = this._featHtml(l);
    const go = document.getElementById("sel-bLvl");
    if (go) {
      go.disabled = !l.available;
      const lb = go.querySelector("span");
      if (lb) lb.textContent = this.t(l.available ? "sel_btn_level" : "level_coming_soon").toUpperCase();
    }
  },

  _place() {
    const o = document.getElementById("sel-orbit");
    if (!o || !this._isl) return;
    const W = o.clientWidth, H = o.clientHeight, N = LEVELS.length;
    if (!W || !H) return;
    const ang = this._ang;
    const narrow = W < 640;
    const base = Math.min(H * 0.8, W * (narrow ? 0.6 : 0.44), 470);
    const cx = W / 2, rx = narrow ? W * 0.36 : Math.min(W * 0.37, base * 1.05 + 120);
    this._isl.forEach((el, i) => {
      let t = (((i - ang) % N) + N) % N;
      if (t > N / 2) t -= N;
      const th = (t / N) * Math.PI * 2, z = Math.cos(th), sx = Math.sin(th);
      const f = (z + 1) / 2;
      const w = base * (0.42 + 0.58 * Math.pow(f, 1.2));
      const x = cx + sx * rx, yB = H * 0.8 - (1 - z) * H * 0.17 - 34;
      el.style.width = w + "px";
      el.style.transform = `translate(${x - w / 2}px,${yB - w * 0.82}px)`;
      el.style.zIndex = Math.round((z + 1) * 50);
      el.style.filter = `brightness(${0.55 + 0.45 * f}) saturate(${0.6 + 0.4 * f})`;
      el.querySelector(".sel-isl__lbl").style.opacity = Math.max(0, (z - 0.55) / 0.45);
      el.classList.toggle("sel-isl--front", Math.abs(t) < 0.5);
    });
  },

  rotate(i) {
    const N = LEVELS.length, S = this.ST;
    const to = ((i % N) + N) % N;
    if (to === S.front && Math.abs(this._ang - to) < 0.001) return;
    S.front = to;
    this._showLevelInfo();
    cancelAnimationFrame(this._raf);
    const from = this._ang, t0 = performance.now(), dur = 800;
    let d = (((to - from) % N) + N) % N;
    if (d > N / 2) d -= N;
    const target = from + d;
    const step = (now) => {
      const u = Math.min(1, (now - t0) / dur), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      this._ang = from + (target - from) * e;
      this._place();
      if (u < 1) this._raf = requestAnimationFrame(step);
      else { this._ang = ((target % N) + N) % N; this._place(); }
    };
    this._raf = requestAnimationFrame(step);
  },

  // ---------- 3. RIVALES: selector con flechas, silueta de cada rival y número grande ----------
  renderRivals() {
    this._bind();
    this._prepScreen("screen-opponent-select");
    const root = document.getElementById("opponent-list");
    root.className = "sel-root";
    root.innerHTML = `
      ${this.stepsHtml(3)}
      <div class="sel-title">${this.t("sel_title_rivals")}</div>
      <div class="sel-summ" id="sel-summ"></div>
      <div class="sel-rivrow" id="sel-rivrow">
        <button type="button" class="sel-arrow" id="sel-rL" aria-label="‹">${this.chev(-1)}</button>
        <div class="sel-fr sel-rivbox" id="sel-rivbox"><div class="sel-rivbox__fig" id="sel-rfig"></div><div class="sel-rivbox__num" id="sel-rnum"></div><div class="sel-rivbox__tx" id="sel-rtx"></div></div>
        <button type="button" class="sel-arrow" id="sel-rR" aria-label="›">${this.chev(1)}</button>
      </div>
      <div class="sel-pips" id="sel-rpips"></div>
      <button type="button" class="sel-fr sel-btn" id="sel-bPlay" data-primary><i class="ph-fill ph-sword"></i><span>${this.t("sel_btn_play")}</span></button>`;
    this._bindSteps(root);
    const pips = root.querySelector("#sel-rpips");
    OPPONENT_OPTIONS.forEach((n, i) => {
      const pp = document.createElement("div");
      pp.className = "sel-pip";
      pp.addEventListener("click", () => this.setRivals(i + 1));
      pips.appendChild(pp);
    });
    root.querySelector("#sel-rL").addEventListener("click", () => this.setRivals(this.ST.nr - 1));
    root.querySelector("#sel-rR").addEventListener("click", () => this.setRivals(this.ST.nr + 1));
    this._swipe(root.querySelector("#sel-rivrow"), (d) => this.setRivals(this.ST.nr + d));
    root.querySelector("#sel-bPlay").addEventListener("click", () => {
      matchDraft.opponents = OPPONENT_OPTIONS[Math.max(0, Math.min(OPPONENT_OPTIONS.length - 1, this.ST.nr - 1))] || 1;
      startMatch(matchDraft);
    });
    this.setRivals(this.ST.nr, false);
  },

  setRivals(n, anim = true) {
    const opts = OPPONENT_OPTIONS, S = this.ST;
    const old = S.nr;
    S.nr = Math.max(1, Math.min(opts.length, n));
    const cnt = opts[S.nr - 1];
    const root = document.getElementById("opponent-list");
    if (!root || !root.querySelector("#sel-rfig")) return;
    root.querySelector("#sel-rfig").innerHTML = Array.from({ length: cnt }, (_, i) => `<i class="ph-fill ph-user" style="--i:${i}"></i>`).join("");
    root.querySelector("#sel-rnum").textContent = cnt;
    root.querySelector("#sel-rtx").textContent = this.t(cnt === 1 ? "sel_rival_one" : "sel_rival_many");
    [...root.querySelector("#sel-rpips").children].forEach((p, k) => p.classList.toggle("sel-pip--on", k === S.nr - 1));
    root.querySelector("#sel-rL").classList.toggle("sel-arrow--off", S.nr === 1);
    root.querySelector("#sel-rR").classList.toggle("sel-arrow--off", S.nr === opts.length);
    const race = RACES.find((r) => r.id === matchDraft.raceId), lv = LEVELS.find((l) => l.id === matchDraft.levelId);
    const sm = root.querySelector("#sel-summ");
    if (race && lv) sm.innerHTML = `<b>${this.t(race.nameKey)}</b> · <b>${this.t(lv.nameKey)}</b>`;
    if (race) this._setAcc(document.getElementById("screen-opponent-select"), this.accent(race));
    if (anim && old !== S.nr) {
      const b = root.querySelector("#sel-rivbox");
      b.classList.remove("sel-swap"); void b.offsetWidth; b.classList.add("sel-swap");
    }
  },
};

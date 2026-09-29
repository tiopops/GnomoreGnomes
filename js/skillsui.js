/* Gnomore Gnomes — interfaz del árbol de Habilidades del Obelisco.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe pintar el
   popup (pestañas GUERRA/PROTECCIÓN/SUPERVIVENCIA, árbol de nodos conectado,
   caja de descripción con el botón de mejora) y llamar a Skills
   (js/skills.js) para consultar el estado y comprar. Toda la lógica de las
   habilidades vive allí.

   Pedido explícito: "una interfaz como las que hemos hecho hasta ahora...con
   su X en la esquina superior derecha desplazada, y todos sus elementos
   seran cuadros distorsionados...en la parte de arriba 3 pestañas
   diferenciadas: GUERRA (colores rojos), PROTECCIÓN (colores azules),
   SUPERVIVENCIA (colores verdes)...Cuando seleccionas una habilidad en el
   textbox de abajo aparece su descripcion." + "las otras dos ramas tienen
   el mismo esquema de nodos, pero de momento estan vacias" (se pintan los
   mismos 6 huecos, sin habilidad, no seleccionables para comprar).

   Iconos: cada nodo busca assets/iconos/habilidades/<id>.png (ver
   SKILL_ICON_DIR en skills.js); si el archivo aún no existe, muestra el
   glifo Phosphor de la habilidad. */

const SkillsUI = {
  _overlayEl: null,
  _team: null,
  _branch: "proteccion",
  _selectedId: null, // id de habilidad, o "empty-<rama>-<nivel>-<slot>" para huecos vacíos
  _els: {},

  build(obelisk, closeFn) {
    this._team = obelisk.team;
    this._selectedId = null;
    this._closeFn = closeFn;

    const overlay = document.createElement("div");
    overlay.className = "backpack-overlay";
    overlay.addEventListener("click", () => closeFn());

    const panel = document.createElement("div");
    panel.className = "backpack-panel skills-panel";
    panel.addEventListener("click", (e) => e.stopPropagation());

    const panelBg = document.createElement("div");
    panelBg.className = "p5-banner backpack-panel__bg";
    panel.appendChild(panelBg);

    const closeBtn = document.createElement("button");
    closeBtn.className = "backpack-close-btn";
    closeBtn.setAttribute("aria-label", "Cerrar");
    closeBtn.innerHTML = '<i class="ph ph-x backpack-close-btn__icon"></i>';
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeFn();
    });
    panel.appendChild(closeBtn);

    const title = document.createElement("div");
    title.className = "p5-banner__label backpack-panel__title";
    title.textContent = "HABILIDADES";
    panelBg.appendChild(title);

    // Pestañas
    const tabs = document.createElement("div");
    tabs.className = "skills-tabs";
    this._els.tabs = {};
    SKILL_BRANCHES.forEach((b, i) => {
      const tab = document.createElement("button");
      tab.className = `skills-tab skills-tab--v${i}`;
      tab.style.setProperty("--sk-accent", b.accent);
      tab.innerHTML = `<span class="skills-tab__label">${b.label}</span>`;
      tab.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this._branch === b.id) return;
        SFX.click();
        this._branch = b.id;
        this._selectedId = null;
        this._render();
      });
      tabs.appendChild(tab);
      this._els.tabs[b.id] = tab;
    });
    panelBg.appendChild(tabs);

    // Puntos de Gloria disponibles
    const points = document.createElement("div");
    points.className = "skills-points";
    panelBg.appendChild(points);
    this._els.points = points;

    // Árbol
    const tree = document.createElement("div");
    tree.className = "skills-tree";
    panelBg.appendChild(tree);
    this._els.tree = tree;

    // Descripción + comprar
    const desc = document.createElement("div");
    desc.className = "backpack-desc skills-desc";
    panelBg.appendChild(desc);
    this._els.desc = desc;

    const buyBtn = document.createElement("button");
    buyBtn.className = "p5-banner p5-banner--action shop-buy-btn";
    buyBtn.innerHTML = '<span class="p5-banner__label">MEJORAR</span>';
    buyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._tryBuy();
    });
    panelBg.appendChild(buyBtn);
    this._els.buy = buyBtn;

    const warning = document.createElement("div");
    warning.className = "shop-warning";
    warning.textContent = "No tienes suficientes Puntos de Gloria";
    panelBg.appendChild(warning);
    this._els.warning = warning;

    overlay.appendChild(panel);
    this._overlayEl = overlay;
    this._render();
    return overlay;
  },

  // Tras insertar el overlay en el documento: los enlaces se dibujan con
  // medidas reales de los nodos.
  afterMount() {
    requestAnimationFrame(() => this._drawLinks());
    // segunda pasada por si la webfont/imágenes cambian el tamaño
    setTimeout(() => this._drawLinks(), 260);
  },

  onClose() {
    this._overlayEl = null;
    this._els = {};
    this._selectedId = null;
  },

  onReset() {
    this._selectedId = null;
  },

  // ---------- Pintado ----------
  _render() {
    if (!this._overlayEl) return;
    const team = this._team;
    SKILL_BRANCHES.forEach((b) => this._els.tabs[b.id].classList.toggle("skills-tab--active", b.id === this._branch));
    const branch = SKILL_BRANCHES.find((b) => b.id === this._branch);
    this._els.tree.style.setProperty("--sk-accent", branch.accent);
    this._els.desc.style.setProperty("--sk-accent", branch.accent);

    const raceIcon =
      typeof RACES !== "undefined" && typeof Glory !== "undefined" && Glory._raceIds && RACES[Glory._raceIds[team]]
        ? RACES[Glory._raceIds[team]].gloryIcon
        : null;
    const pts = typeof Glory !== "undefined" ? Glory.points[team] : 0;
    this._els.points.innerHTML =
      (raceIcon ? `<img src="${raceIcon}" class="skills-points__icon" alt="">` : "") +
      `<span class="skills-points__num">${pts}</span><span class="skills-points__label">Puntos de Gloria</span>`;

    const tree = this._els.tree;
    tree.innerHTML = '<svg class="skills-links" xmlns="http://www.w3.org/2000/svg"></svg>';
    const layout = Skills.layout(this._branch);
    layout.forEach((row, ri) => {
      const rowEl = document.createElement("div");
      rowEl.className = "skills-row" + (row.length > 1 ? " skills-row--fork" : "");
      row.forEach((def, slot) => rowEl.appendChild(this._makeNode(def, ri + 1, slot)));
      tree.appendChild(rowEl);
    });
    this._updateDesc();
    this._drawLinks();
  },

  _emptyId(level, slot) {
    return `empty-${this._branch}-${level}-${slot}`;
  },

  _makeNode(def, level, slot) {
    const team = this._team;
    const btn = document.createElement("button");
    btn.dataset.level = String(level);
    btn.dataset.slot = String(slot);

    if (!def) {
      const uid = this._emptyId(level, slot);
      btn.className = "skills-node skills-node--empty" + (this._selectedId === uid ? " skills-node--selected" : "");
      btn.innerHTML = '<i class="ph ph-question skills-node__glyph"></i>';
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        SFX.click();
        this._selectedId = this._selectedId === uid ? null : uid;
        this._render();
      });
      return btn;
    }

    const st = Skills.status(team, def);
    const rank = Skills.rank(team, def.id);
    btn.dataset.skill = def.id;
    btn.className =
      "skills-node" +
      ` skills-node--${st}` +
      (this._selectedId === def.id ? " skills-node--selected" : "");
    btn.innerHTML =
      `<img src="${SKILL_ICON_DIR}${def.id}.png" class="skills-node__icon" alt="">` +
      `<span class="skills-node__rank"><span class="skills-node__rank-num">${rank}/${def.maxRank}</span></span>` +
      (st === "maxed" ? '<i class="ph-fill ph-check-circle skills-node__check"></i>' : "") +
      (st === "blocked" ? '<i class="ph-fill ph-lock-simple skills-node__lock"></i>' : "") +
      (st === "locked" ? '<i class="ph-fill ph-lock-simple skills-node__lock"></i>' : "");
    // Sin icono real todavía -> glifo de Phosphor.
    const img = btn.querySelector(".skills-node__icon");
    img.addEventListener("error", () => {
      const glyph = document.createElement("i");
      glyph.className = `ph-fill ${def.fallbackIcon} skills-node__glyph`;
      img.replaceWith(glyph);
    });
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      SFX.click();
      this._selectedId = this._selectedId === def.id ? null : def.id;
      this._render();
    });
    return btn;
  },

  // Líneas entre filas consecutivas (todos los nodos de una fila con todos
  // los de la siguiente). Iluminadas si el nodo de origen está al máximo y
  // el de destino no está bloqueado por la otra rama de una bifurcación.
  _drawLinks() {
    const tree = this._els && this._els.tree;
    if (!tree || !tree.isConnected) return; // aún no montado: lo repinta afterMount()
    const svg = tree.querySelector(".skills-links");
    if (!svg) return;
    svg.setAttribute("width", tree.offsetWidth);
    svg.setAttribute("height", tree.offsetHeight);
    svg.innerHTML = "";
    const team = this._team;
    const layout = Skills.layout(this._branch);
    const nodeAt = (level, slot) => tree.querySelector(`.skills-node[data-level="${level}"][data-slot="${slot}"]`);
    // Cada fila es position:relative (offsetParent de sus nodos), así que se
    // suma el desplazamiento de la fila al del nodo. Se usan offsets (no
    // getBoundingClientRect) porque el panel está ligeramente rotado.
    const center = (el) => ({
      x: el.offsetParent.offsetLeft + el.offsetLeft + el.offsetWidth / 2,
      y: el.offsetParent.offsetTop + el.offsetTop + el.offsetHeight / 2,
    });

    for (let ri = 0; ri < layout.length - 1; ri++) {
      layout[ri].forEach((fromDef, fs) => {
        layout[ri + 1].forEach((toDef, ts) => {
          const a = nodeAt(ri + 1, fs);
          const b = nodeAt(ri + 2, ts);
          if (!a || !b) return;
          const p = center(a);
          const q = center(b);
          let lit = false;
          if (fromDef && toDef) {
            const fromMaxed = Skills.rank(team, fromDef.id) >= fromDef.maxRank;
            lit = fromMaxed && Skills.status(team, toDef) !== "blocked";
          }
          const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("x1", p.x);
          line.setAttribute("y1", p.y);
          line.setAttribute("x2", q.x);
          line.setAttribute("y2", q.y);
          line.setAttribute("class", "skills-link" + (lit ? " skills-link--lit" : ""));
          svg.appendChild(line);
        });
      });
    }
  },

  _selectedDef() {
    return this._selectedId && !String(this._selectedId).startsWith("empty-") ? Skills.def(this._selectedId) : null;
  },

  _updateDesc() {
    const desc = this._els.desc;
    const buy = this._els.buy;
    if (this._els.warning) this._els.warning.classList.remove("shop-warning--visible");
    buy.disabled = true;
    buy.classList.remove("shop-buy-btn--active");
    buy.querySelector(".p5-banner__label").textContent = "MEJORAR";

    if (!this._selectedId) {
      desc.innerHTML = '<p class="backpack-desc__text skills-desc__hint">Selecciona una habilidad para ver su descripción.</p>';
      return;
    }
    const def = this._selectedDef();
    if (!def) {
      desc.innerHTML = '<p class="backpack-desc__text skills-desc__hint">Habilidad por definir — esta rama todavía está vacía.</p>';
      return;
    }
    const team = this._team;
    const rank = Skills.rank(team, def.id);
    const st = Skills.status(team, def);
    const nextRank = Math.min(def.maxRank, rank + 1);
    const cost = Skills.cost(def);
    const reason = Skills.lockReason(team, def);

    desc.innerHTML =
      `<div class="skills-desc__body">` +
      `<div class="skills-desc__head">` +
      `<span class="skills-desc__name">${def.name}</span>` +
      `<span class="skills-desc__rank">Nivel ${rank}/${def.maxRank}</span>` +
      (st !== "maxed" ? `<span class="skills-desc__cost">Coste: ${cost} <small>por nivel</small></span>` : `<span class="skills-desc__cost skills-desc__cost--done">Completada</span>`) +
      `</div>` +
      `<p class="backpack-desc__text">${def.describe(st === "maxed" ? def.maxRank : nextRank)}</p>` +
      (reason ? `<p class="skills-desc__lock">${reason}</p>` : "") +
      `</div>`;

    const can = Skills.canBuy(team, def);
    buy.querySelector(".p5-banner__label").textContent = rank === 0 ? "COMPRAR" : "MEJORAR";
    buy.disabled = !can.ok;
    buy.classList.toggle("shop-buy-btn--active", can.ok);
  },

  _tryBuy() {
    const def = this._selectedDef();
    if (!def) return;
    const team = this._team;
    const can = Skills.canBuy(team, def);
    if (!can.ok) {
      if (can.reason === "points") {
        SFX.back();
        const w = this._els.warning;
        if (w) {
          w.classList.remove("shop-warning--visible");
          void w.offsetWidth;
          w.classList.add("shop-warning--visible");
        }
      }
      return;
    }
    if (Skills.buy(team, def.id)) {
      SFX.itemEaten();
      this._render();
    }
  },
};

/* Gnomore Gnomes — encuadre de la cámara durante los tutoriales.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Calcular la "zona libre" de la pantalla: lo que queda sin la viñeta
       de Nizak ni los botones fijos de la interfaz (gloria, ajustes, mochila,
       info de unidad, habilidad, pasar turno, botones del gnomo...).
     - Mover (suavemente) la cámara del tablero para que lo que hay que
       mirar o pulsar —el objetivo del puntero y sus acompañantes: la unidad
       seleccionada, el gnomo, el rival de práctica...— quede dentro de esa
       zona libre, alejando el zoom si de otro modo no cabe.
   Lo usa tutorial.js desde _avoidOverlap/_updatePointer; fuera del tutorial
   no hace nada. */

const TutorialFrame = {
  // Elementos fijos de la interfaz que NO deben tapar la acción.
  HUD_SELECTORS: [
    ".glory-hud",
    ".settings-gear-btn",
    ".backpack-btn",
    ".unit-info-btn",
    ".end-turn-btn",
    ".ability-btn",
    ".gnome-action-btn",
  ],
  MARGIN: 10,
  _lastMove: 0,
  _lastKey: "",
  _userUntil: 0,
  _focus: [], // entidades que el paso actual quiere SIEMPRE a la vista (unidad + tambor, etc.)

  _visible(el) {
    if (!el || !el.isConnected) return null;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.05) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return null;
    return r;
  },

  // Rectángulos ocupados por la interfaz fija (sin la viñeta).
  hudRects() {
    const out = [];
    this.HUD_SELECTORS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        const r = this._visible(el);
        if (r) out.push(r);
      });
    });
    return out;
  },

  // Zona libre: el mayor rectángulo de pantalla que no pisa ningún elemento de la interfaz
  // (ni la viñeta). Con pocos obstáculos se prueban todas las combinaciones de bordes.
  // `panel` = rect de la viñeta (con el rótulo SALTAR), o null.
  safeRect(panel) {
    const now = performance.now();
    if (!panel && this._safeCache && now - this._safeAt < 120) return this._safeCache;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const m = this.MARGIN;
    const obs = this.hudRects().map((r) => ({ left: r.left - 4, right: r.right + 4, top: r.top - 4, bottom: r.bottom + 4 }));
    if (panel) obs.push({ left: panel.left - 2, right: panel.right + 2, top: panel.top - 2, bottom: panel.bottom + 2 });
    const xs = new Set([0, vw]);
    const ys = new Set([0, vh]);
    obs.forEach((o) => {
      xs.add(Math.max(0, Math.min(vw, o.left)));
      xs.add(Math.max(0, Math.min(vw, o.right)));
      ys.add(Math.max(0, Math.min(vh, o.top)));
      ys.add(Math.max(0, Math.min(vh, o.bottom)));
    });
    const X = [...xs].sort((a, b) => a - b);
    const Y = [...ys].sort((a, b) => a - b);
    let best = null;
    let bestScore = -1;
    for (let a = 0; a < X.length; a++) {
      for (let b = a + 1; b < X.length; b++) {
        const w = X[b] - X[a];
        if (w < 110) continue;
        for (let c = 0; c < Y.length; c++) {
          for (let d = c + 1; d < Y.length; d++) {
            const h = Y[d] - Y[c];
            if (h < 90) continue;
            const hit = obs.some((o) => o.left < X[b] - 1 && o.right > X[a] + 1 && o.top < Y[d] - 1 && o.bottom > Y[c] + 1);
            if (hit) continue;
            // Más área, y se prefieren zonas que no sean tiras estrechas.
            const score = w * h * Math.min(1, Math.min(w, h) / 220);
            if (score > bestScore) {
              bestScore = score;
              best = { left: X[a], right: X[b], top: Y[c], bottom: Y[d] };
            }
          }
        }
      }
    }
    if (!best) best = { left: 0, right: vw, top: vh * 0.3, bottom: vh * 0.7 };
    const rect = { left: best.left + m, right: best.right - m, top: best.top + m, bottom: best.bottom - m };
    rect.w = rect.right - rect.left;
    rect.h = rect.bottom - rect.top;
    rect.cx = (rect.left + rect.right) / 2;
    rect.cy = (rect.top + rect.bottom) / 2;
    if (!panel) {
      this._safeCache = rect;
      this._safeAt = now;
    }
    return rect;
  },

  _elOf(x) {
    if (!x) return null;
    if (x.el) return x.el;
    return x.nodeType === 1 ? x : null;
  },

  // Acompañantes de lo que se señala: la acción casi nunca es un solo elemento.
  companions(target) {
    const list = [];
    try {
      if (typeof Units !== "undefined" && Units.selectedId) {
        const u = Units.list.find((x) => x.id === Units.selectedId);
        if (u && u.el) list.push(u.el);
      }
      if (typeof Tutorial !== "undefined" && Tutorial._ctx) {
        const c = Tutorial._ctx;
        const ids = [c.dummyId, c.fighterId, c.holderId, c.captorId, c.moverId, c.cutterId, c.hiderId, c.unitId, c.otherId];
        ids.forEach((id) => {
          const u = id && Units.list.find((x) => x.id === id);
          if (u && u.el) list.push(u.el);
        });
      }
      if (typeof Gnome !== "undefined") Gnome.list.forEach((g) => g.el && list.push(g.el));
      const mgrs = [
        typeof Drums !== "undefined" ? Drums : null,
        typeof Villages !== "undefined" ? Villages : null,
        typeof Altar !== "undefined" ? Altar : null,
        typeof Volcano !== "undefined" ? Volcano : null,
        typeof Obelisks !== "undefined" ? Obelisks : null,
        typeof Shops !== "undefined" ? Shops : null,
      ];
      mgrs.forEach((o) => {
        if (o && Array.isArray(o.list)) o.list.forEach((x) => x && x.el && list.push(x.el));
      });
      document.querySelectorAll(".board-marker:not(.obelisk-placement-marker)").forEach((m) => list.push(m));
    } catch (e) {}
    return list;
  },

  // Unión de rects. Cada elemento se recorta a su rect visible en pantalla.
  _union(rects) {
    if (!rects.length) return null;
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    rects.forEach((q) => {
      l = Math.min(l, q.left);
      t = Math.min(t, q.top);
      r = Math.max(r, q.right);
      b = Math.max(b, q.bottom);
    });
    return { left: l, top: t, right: r, bottom: b, w: r - l, h: b - t, cx: (l + r) / 2, cy: (t + b) / 2 };
  },

  // Rect de lo que debe verse: el objetivo (si está en el tablero), las entidades de foco del paso
  // y los acompañantes cercanos que quepan.
  focusRect(target, safe) {
    const onBoard = target && target.isConnected && (!target.closest || target.closest(".board-camera"));
    const maxZoomOut = typeof BoardView !== "undefined" && BoardView.scale ? BoardView.scale / BoardView.minScale : 1;
    const room = Math.max(1, maxZoomOut) * 0.96; // lo máximo que se puede alejar la cámara
    const fitsRoom = (u) => u.w <= safe.w * room && u.h <= safe.h * room;
    const foc = this._focusRects();
    // Lo imprescindible: el objetivo (o, si no hay, el primer foco).
    let acc = onBoard ? this._union([target.getBoundingClientRect()]) : foc.length ? this._union([foc.shift()]) : null;
    if (!acc) return null;
    const dist = (r) => Math.hypot(r.left + (r.right - r.left) / 2 - acc.cx, r.top + (r.bottom - r.top) / 2 - acc.cy);
    // Primero el foco que pide el paso (unidad + tambor...), luego los acompañantes cercanos:
    // se añade cada uno mientras el conjunto siga cabiendo; si no cabe, se prioriza el objetivo.
    foc.sort((a, b) => dist(a) - dist(b)).forEach((r) => {
      const u = this._union([acc, r]);
      if (fitsRoom(u)) acc = u;
    });
    const radius = Math.max(300, Math.min(window.innerWidth, window.innerHeight) * 0.9);
    const cands = this.companions(target)
      .filter((el) => el !== target && !(target && (target.contains(el) || el.contains(target))))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter((c) => c.r.width > 6 && c.r.height > 6)
      .filter((c) => dist(c.r) < radius)
      .sort((a, b) => dist(a.r) - dist(b.r));
    const roomC = 0.96; // los acompañantes son opcionales: solo si caben SIN alejar la cámara
    for (const c of cands) {
      const u = this._union([acc, c.r]);
      if (u.w <= safe.w * roomC && u.h <= safe.h * roomC) acc = u;
    }
    return acc;
  },

  // ¿Está el rect completo dentro de la zona libre (con tolerancia)?
  _inside(r, safe, tol = 6) {
    return r.left >= safe.left - tol && r.right <= safe.right + tol && r.top >= safe.top - tol && r.bottom <= safe.bottom + tol;
  },

  // Llamado cada frame desde Tutorial._updatePointer con el elemento señalado.
  // `force`: reencuadrar aunque ya esté "más o menos" dentro (inicio de paso).
  update(target, panelRect, force) {
    if (typeof BoardView === "undefined" || !BoardView.viewportEl) return;
    const now = performance.now();
    // El jugador está arrastrando/pellizcando: no pelear con él.
    if (BoardView._dragState || BoardView._touchState) this._userUntil = now + 2500;
    if (!force && now < this._userUntil) return;
    if (!force && now - this._lastMove < 450) return;
    if (Math.abs(BoardView.scale - BoardView.targetScale) > 0.004) return; // zoom en curso
    if (this._forceNext) {
      force = true;
    }
    const safe = this.safeRect(panelRect);
    const fr = this.focusRect(target, safe);
    if (!fr) {
      this._forceNext = false;
      return;
    }
    // Basta con que el conjunto (objetivo + foco) esté dentro de la zona libre y razonablemente centrado.
    const fits = this._inside(fr, safe, 24);
    const centered = Math.abs(fr.cx - safe.cx) < safe.w * 0.32 && Math.abs(fr.cy - safe.cy) < safe.h * 0.32;
    if (fits && (!force || centered)) {
      this._forceNext = false;
      return;
    }
    this._forceNext = false;
    this._lastMove = now;
    // 1) Zoom: si el conjunto no cabe, se aleja lo justo.
    let factor = Math.min(safe.w / Math.max(fr.w, 60), safe.h / Math.max(fr.h, 60)) * 0.94;
    const willZoom = factor < 1 && BoardView.targetScale > BoardView.minScale + 0.01;
    if (willZoom) {
      factor = Math.max(factor, BoardView.minScale / BoardView.targetScale);
      BoardView._zoomAt(fr.cx, fr.cy, factor);
      this._forceNext = true; // tras el zoom, se recoloca en la zona libre
      return;
    }
    // 2) Desplazamiento: el centro de lo importante, al centro de la zona libre.
    BoardView._zoomAnchor = null;
    BoardView.targetPanX = BoardView.panX + (safe.cx - fr.cx);
    BoardView.targetPanY = BoardView.panY + (safe.cy - fr.cy);
    if (BoardView._clampTargetPan) BoardView._clampTargetPan();
    if (BoardView._startLoop) BoardView._startLoop();
  },

  // Móvil vertical: la viñeta va arriba, justo debajo de la gloria/ajustes (no los tapa).
  // Móvil horizontal y escritorio se resuelven solo con CSS.
  isPortraitPhone() {
    return window.innerWidth <= 600 && window.innerHeight > window.innerWidth;
  },
  layoutPanel(panel) {
    if (!panel) return;
    if (!this.isPortraitPhone()) {
      if (panel.style.top) panel.style.top = "";
      return;
    }
    let bottom = 0;
    document.querySelectorAll(".glory-hud, .glory-hud *, .settings-gear-btn").forEach((el) => {
      const r = this._visible(el);
      if (r && r.top < window.innerHeight * 0.3) bottom = Math.max(bottom, r.bottom);
    });
    const top = Math.round(Math.max(112, bottom + 26));
    const cur = parseInt(panel.style.top || "0", 10);
    if (cur !== top) panel.style.top = `${top}px`;
  },

  setFocus(list) {
    this._focus = (list || []).filter(Boolean);
    this._forceNext = true;
  },
  clearFocus() {
    this._focus = [];
  },

  // Rects en pantalla de las entidades de foco (con .el, o simples casillas {row,col}).
  _focusRects() {
    const out = [];
    this._focus.forEach((e) => {
      let r = null;
      if (e.el && e.el.isConnected) {
        r = e.el.getBoundingClientRect();
        if (!r.width && !r.height) r = null;
      } else if (e.row != null && typeof getTileCenter === "function" && typeof BoardView !== "undefined" && BoardView.viewportEl) {
        const c = getTileCenter(e.row, e.col, Units.boardSize);
        const vp = BoardView.viewportEl.getBoundingClientRect();
        const x = vp.left + c.x * BoardView.scale + BoardView.panX;
        const y = vp.top + c.y * BoardView.scale + BoardView.panY;
        const h = 60 * BoardView.scale;
        r = { left: x - h, right: x + h, top: y - h * 1.6, bottom: y + h * 0.6, width: h * 2, height: h * 2.2 };
      }
      if (r) out.push(r);
    });
    return out;
  },

  // Nuevo paso: se fuerza un encuadre en cuanto el objetivo exista.
  reset() {
    this._lastMove = 0;
    this._lastKey = "";
    this._userUntil = 0;
    this._forceNext = true;
  },
};

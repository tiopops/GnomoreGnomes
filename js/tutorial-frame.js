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
    const tr = onBoard ? this._elRect(target) : null;
    let acc = tr ? this._union([tr]) : foc.length ? this._union([foc.shift()]) : null;
    if (!acc) return null;
    const dist = (r) => Math.hypot(r.left + (r.right - r.left) / 2 - acc.cx, r.top + (r.bottom - r.top) / 2 - acc.cy);
    // Primero el foco que pide el paso (unidad + tambor...), luego los acompañantes cercanos:
    // se añade cada uno mientras el conjunto siga cabiendo; si no cabe, se prioriza el objetivo.
    foc.sort((a, b) => dist(a) - dist(b)).forEach((r) => {
      const u = this._union([acc, r]);
      if (fitsRoom(u)) acc = u;
    });
    const core = acc; // lo imprescindible (objetivo + foco del paso), sin acompañantes opcionales
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
    acc.core = core;
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
    if (!force && now - this._lastMove < 700) return;
    // Un solo movimiento a la vez: mientras la cámara sigue yendo a su destino (zoom o
    // desplazamiento) no se vuelve a decidir nada, así nunca se persigue a sí misma.
    if (Math.abs(BoardView.scale - BoardView.targetScale) > 0.004) return;
    if (Math.hypot(BoardView.targetPanX - BoardView.panX, BoardView.targetPanY - BoardView.panY) > 3) return;
    // Inicio de paso (o un objetivo que acaba de aparecer): se busca el PLANO PERFECTO. Durante el
    // paso la cámara solo se corrige si lo importante se sale de la zona libre.
    const start = !!(this._forceNext || force);
    // La viñeta cambia de alto dentro de un mismo paso (aparece la barra de misión, el texto
    // se alarga...): se encuadra contra la MAYOR que ha tenido en el paso, para que la cámara
    // no reaccione a cada cambio de tamaño.
    const pr = this._stablePanel(panelRect);
    const safe = this.safeRect(pr);
    const fr = this.focusRect(target, safe);
    if (!fr) return; // sin objetivo todavía: se espera (el encuadre de inicio sigue pendiente)
    this._forceNext = false;
    const core = fr.core || fr;
    // Zona muerta, como en los juegos profesionales: si lo importante ya se ve bien, la cámara NO
    // se toca. Al empezar un paso "bien" es estar dentro de la zona central de la zona libre (con
    // aire alrededor); durante el paso basta con que no se salga de ella.
    if (start) {
      const kx = safe.w * 0.14;
      const ky = safe.h * 0.14;
      const comfy = { left: safe.left + kx, right: safe.right - kx, top: safe.top + ky, bottom: safe.bottom - ky };
      if (this._inside(core, comfy, 0)) return;
    } else if (this._inside(core, safe, 24)) {
      return;
    }
    this._lastMove = now;
    // Un único movimiento que combina zoom y desplazamiento: si el conjunto no cabe se aleja lo
    // justo (nunca se acerca) y a la vez se lleva al centro de la zona libre.
    const sc0 = BoardView.targetScale;
    let factor = Math.min(safe.w / Math.max(fr.w, 60), safe.h / Math.max(fr.h, 60)) * 0.94;
    factor = factor < 1 ? Math.max(factor, BoardView.minScale / sc0) : 1;
    const sc1 = BoardView._clampScale ? BoardView._clampScale(sc0 * factor) : sc0 * factor;
    const vp = BoardView.viewportEl.getBoundingClientRect();
    // Punto del contenido que hay bajo el centro de lo importante (con la cámara quieta).
    const ccx = (fr.cx - vp.left - BoardView.panX) / BoardView.scale;
    const ccy = (fr.cy - vp.top - BoardView.panY) / BoardView.scale;
    let tx = safe.cx - vp.left - ccx * sc1;
    let ty = safe.cy - vp.top - ccy * sc1;
    if (!start && sc1 === sc0) {
      // Corrección a mitad de paso sin zoom: si el centro ya está dentro, el mínimo desplazamiento.
      const centerIn = fr.cx > safe.left && fr.cx < safe.right && fr.cy > safe.top && fr.cy < safe.bottom;
      if (centerIn && fr.w <= safe.w - 40 && fr.h <= safe.h - 40) {
        const pad = 20;
        const dx = fr.left < safe.left + pad ? safe.left + pad - fr.left : fr.right > safe.right - pad ? safe.right - pad - fr.right : 0;
        const dy = fr.top < safe.top + pad ? safe.top + pad - fr.top : fr.bottom > safe.bottom - pad ? safe.bottom - pad - fr.bottom : 0;
        tx = BoardView.panX + dx;
        ty = BoardView.panY + dy;
      }
    }
    BoardView._zoomAnchor = null;
    const c = BoardView._clampPanFor ? BoardView._clampPanFor(tx, ty, sc1) : { x: tx, y: ty };
    BoardView.targetScale = sc1;
    BoardView.targetPanX = c.x;
    BoardView.targetPanY = c.y;
    if (BoardView._startLoop) BoardView._startLoop();
  },

  // Mayor rect de viñeta visto en el paso actual (se reinicia en reset()).
  _stablePanel(pr) {
    if (!pr) return pr;
    let m = this._panelMax;
    // La viñeta cambió de sitio (se va arriba con una ventana abierta, o vuelve abajo): otro encuadre.
    if (m && Math.abs(pr.top - m.top) > 80 && Math.abs(pr.bottom - m.bottom) > 80) m = this._panelMax = null;
    if (!m) {
      this._panelMax = { left: pr.left, right: pr.right, top: pr.top, bottom: pr.bottom };
    } else {
      m.left = Math.min(m.left, pr.left);
      m.right = Math.max(m.right, pr.right);
      m.top = Math.min(m.top, pr.top);
      m.bottom = Math.max(m.bottom, pr.bottom);
    }
    return this._panelMax;
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

  // Caja en pantalla de una casilla (para entidades que el motor oculta fuera de pantalla).
  _tileBox(row, col) {
    if (typeof getTileCenter !== "function" || typeof BoardView === "undefined" || !BoardView.viewportEl) return null;
    const c = getTileCenter(row, col, Units.boardSize);
    const vp = BoardView.viewportEl.getBoundingClientRect();
    const x = vp.left + c.x * BoardView.scale + BoardView.panX;
    const y = vp.top + c.y * BoardView.scale + BoardView.panY;
    const h = 60 * BoardView.scale;
    return { left: x - h, right: x + h, top: y - h * 1.6, bottom: y + h * 0.6, width: h * 2, height: h * 2.2 };
  },

  // Fila/columna lógicas de un elemento del tablero (marcadores, unidades, gnomos, edificios...).
  _rowCol(el) {
    if (el.dataset && el.dataset.row != null && el.dataset.col != null) return { row: +el.dataset.row, col: +el.dataset.col };
    const lists = [typeof Units !== "undefined" ? Units.list : null, typeof Gnome !== "undefined" ? Gnome.list : null,
      typeof Drums !== "undefined" ? Drums.list : null, typeof Villages !== "undefined" ? Villages.list : null,
      typeof Altar !== "undefined" ? Altar.list : null, typeof Volcano !== "undefined" ? Volcano.list : null,
      typeof Obelisks !== "undefined" ? Obelisks.list : null, typeof Shops !== "undefined" ? Shops.list : null];
    for (const l of lists) {
      const f = Array.isArray(l) && l.find((x) => x && x.el === el);
      if (f && f.row != null) return { row: f.row, col: f.col };
    }
    return null;
  },

  // Rect en pantalla de un elemento. Las entidades lejanas se ocultan (display:none) y no miden
  // nada: en ese caso se usa su casilla, para que el encuadre no dependa de lo que se ve YA y no
  // haya que corregirlo cuando la cámara las vaya descubriendo.
  _elRect(el) {
    if (!el || !el.isConnected) return null;
    const r = el.getBoundingClientRect();
    if (r.width > 2 && r.height > 2) return r;
    const rc = this._rowCol(el);
    return rc ? this._tileBox(rc.row, rc.col) : null;
  },

  // Rects en pantalla de las entidades de foco (con .el, o simples casillas {row,col}).
  _focusRects() {
    const out = [];
    this._focus.forEach((e) => {
      let r = null;
      if (e.el && e.el.isConnected) {
        r = this._elRect(e.el);
        if (!r && e.row != null) r = this._tileBox(e.row, e.col);
      } else if (e.row != null) {
        r = this._tileBox(e.row, e.col);
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
    this._panelMax = null;
  },
};

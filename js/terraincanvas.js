/* Gnomore Gnomes — suelo del tablero dibujado en un <canvas> (fase 1 de la
   migración a render por GPU).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe pintar el
   suelo (losetas de hierba/agua) en un canvas: no genera el mapa (mapgen.js),
   ni la niebla (fog.js), ni la cámara (boardview.js).

   Por qué: cada loseta eran 2-3 elementos del DOM (div + img base + img de
   revelado) — con un mapa de 25x25 eran más de 1.800 nodos solo de suelo, y
   el navegador tenía que componerlos y filtrarlos uno a uno. Ahora el suelo
   es UN canvas del tamaño del viewport que se redibuja en cada frame de
   cámara con solo las losetas visibles (el culling sale gratis).

   Replica EXACTAMENTE lo que hacía el DOM:
     - Orden de pintado: (fila+columna) ascendente, y a igualdad, fila
       ascendente (= orden de inserción en el DOM, que era fila-columna).
     - Base de hierba SIEMPRE, y overlay con la textura real (agua) que
       aparece con fundido de 0.9s (curva "ease") al revelarse; la hierba de
       base se quita en el acto al revelar (ver TerrainMap.revealTile).
     - Calidad dinámica: la misma textura que habría elegido
       SpriteQuality para losetas (shift 1).
     - Losetas "recordadas" (fuera de percepción): filter saturate(.25)
       brightness(.65), instantáneo — aquí con una versión pre-procesada de
       la textura (misma fórmula de los filtros CSS).
     - Resaltado de la loseta bajo el ratón: rombo blanco al 16% con
       fundido de 0.1s, igual que el antiguo .tile::after.
     - Modo rendimiento: las losetas sin explorar no se pintan. */

const TerrainCanvas = {
  canvas: null,
  ctx: null,
  viewportEl: null,
  cameraEl: null,
  size: 0,
  tiles: null, // índice row*size+col -> estado de la loseta
  baseRect: null, // {ox, oy, w, h} de la textura base (hierba) — compartido
  _imgs: new Map(), // url -> HTMLImageElement (cargado o cargando)
  _gray: new Map(), // url -> canvas con la versión "recordada" (o false si falló)
  _active: new Set(), // índices con alguna transición en curso (fundido / resaltado)
  _raf: 0,
  _lastCam: null, // {panX, panY, scale} del último render
  _mouse: null, // {x, y, ok} última posición del ratón (px de cliente)
  _hoverIdx: -1,
  _bw: 0,
  _bh: 0,
  _dpr: 1,

  // Mismas constantes que el CSS de .tile::after (rombo 188x117, 16% blanco)
  QUALITY: "high",
  HOVER_ALPHA: 0.16,
  HOVER_MS: 100,
  REVEAL_MS: 900,

  setup(defs, baseRect, size, viewportEl, cameraEl) {
    this.viewportEl = viewportEl;
    this.cameraEl = cameraEl;
    this.size = size;
    this.baseRect = baseRect;
    this._active.clear();
    this._hoverIdx = -1;
    this.tiles = new Array(size * size);
    defs.forEach((d) => {
      this.tiles[d.row * size + d.col] = {
        row: d.row,
        col: d.col,
        x: d.x,
        y: d.y,
        baseSrc: d.baseSrc,
        reveal: d.reveal, // {src, ox, oy, w, h} | null
        baseHidden: false,
        revealFrom: 0,
        revealTo: 0,
        revealT0: 0,
        remembered: false,
        unexplored: false,
        fogDeep: false,
        hFrom: 0,
        hTo: 0,
        hT0: 0,
      };
    });
    this._ensureCanvas();
    this._bindMouse();
    // Precarga de las texturas de todas las losetas (todas las variantes de
    // calidad que puedan hacer falta) para que nunca falte una al pintar.
    const seen = new Set();
    this.tiles.forEach((t) => {
      if (!t) return;
      [t.baseSrc, t.reveal && t.reveal.src].forEach((s) => {
        if (!s || seen.has(s)) return;
        seen.add(s);
        for (let tier = 0; tier < 3; tier++) this._load(this._urlFor(s, tier));
      });
    });
  },

  _ensureCanvas() {
    if (!this.viewportEl) return;
    let c = document.getElementById("board-terrain");
    if (!c) {
      c = document.createElement("canvas");
      c.id = "board-terrain";
      c.className = "board-terrain";
      this.viewportEl.insertBefore(c, this.viewportEl.firstChild);
    }
    this.canvas = c;
    this.ctx = c.getContext("2d");
    this._bw = 0; // fuerza redimensionado en el próximo render
  },

  // ---------- Texturas ----------
  _urlFor(orig, tier) {
    if (typeof SpriteQuality !== "undefined" && SpriteQuality._srcForTier) return SpriteQuality._srcForTier(orig, tier, 1);
    return orig;
  },

  _load(url) {
    let im = this._imgs.get(url);
    if (im) return im;
    im = new Image();
    im.decoding = "async";
    im.onload = () => this.requestDraw();
    im.onerror = () => { im._failed = true; };
    im.src = url;
    this._imgs.set(url, im);
    return im;
  },

  _fogTex() {
    const url = typeof lowResTileSrc === "function" ? lowResTileSrc(FOG_SRC) : FOG_SRC;
    const im = this._load(url);
    return im.complete && im.naturalWidth > 0 && !im._failed ? im : null;
  },

  // Textura lista para el nivel de calidad actual (o la mejor disponible).
  _tex(orig) {
    const sq = typeof SpriteQuality !== "undefined" ? SpriteQuality : null;
    const tier = sq && sq.enabled !== false ? sq.tier || 0 : 0;
    const order = [tier, 0, 1, 2];
    for (let i = 0; i < order.length; i++) {
      const im = this._load(this._urlFor(orig, order[i]));
      if (im.complete && im.naturalWidth > 0 && !im._failed) return im;
    }
    return null;
  },

  // Versión "recordada" de una textura: mismos cálculos que los filtros CSS
  // saturate(0.25) y brightness(0.65), aplicados en ese orden.
  _grayOf(im) {
    const key = im.src;
    let g = this._gray.get(key);
    if (g !== undefined) return g;
    try {
      const cv = document.createElement("canvas");
      cv.width = im.naturalWidth;
      cv.height = im.naturalHeight;
      const cx = cv.getContext("2d");
      cx.drawImage(im, 0, 0);
      const data = cx.getImageData(0, 0, cv.width, cv.height);
      const d = data.data;
      const s = 0.25;
      const b = 0.65;
      const m = [
        0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
        0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
        0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
      ];
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], gg = d[i + 1], bl = d[i + 2];
        let nr = (m[0] * r + m[1] * gg + m[2] * bl) * b;
        let ng = (m[3] * r + m[4] * gg + m[5] * bl) * b;
        let nb = (m[6] * r + m[7] * gg + m[8] * bl) * b;
        d[i] = nr < 0 ? 0 : nr > 255 ? 255 : nr;
        d[i + 1] = ng < 0 ? 0 : ng > 255 ? 255 : ng;
        d[i + 2] = nb < 0 ? 0 : nb > 255 ? 255 : nb;
      }
      cx.putImageData(data, 0, 0);
      g = cv;
    } catch (e) {
      g = false; // lienzo "tainted" (p.ej. file://): se usará ctx.filter
    }
    this._gray.set(key, g);
    return g;
  },

  // ---------- Estado de cada loseta (lo llaman TerrainMap/Fog/Oracle) ----------
  _t(row, col) {
    return this.tiles && this.tiles[row * this.size + col];
  },

  // Fundido del overlay de revelado (0 <-> 1, 0.9s ease) + hierba de base.
  setRevealed(row, col, on) {
    const t = this._t(row, col);
    if (!t || !t.reveal) return;
    const to = on ? 1 : 0;
    if (t.revealTo === to) return;
    const now = performance.now();
    t.revealFrom = this._revealAlpha(t, now);
    t.revealTo = to;
    t.revealT0 = now;
    t.baseHidden = !!on;
    this._active.add(row * this.size + col);
    this.requestDraw();
  },

  setRemembered(row, col, on) {
    const t = this._t(row, col);
    if (!t || t.remembered === !!on) return;
    t.remembered = !!on;
    this.requestDraw();
  },

  setUnexplored(row, col, on) {
    const t = this._t(row, col);
    if (!t || t.unexplored === !!on) return;
    t.unexplored = !!on;
    this.requestDraw();
  },

  setAllUnexplored(on) {
    if (!this.tiles) return;
    this.tiles.forEach((t) => { if (t) t.unexplored = !!on; });
    this.requestDraw();
  },

  // Niebla "profunda" (lejos de lo explorado): se pinta aquí, encima de todo
  // el suelo, en vez de como elemento del DOM (ver Fog._enterDom en fog.js).
  setFogDeep(row, col, on) {
    const t = this._t(row, col);
    if (!t || t.fogDeep === !!on) return;
    t.fogDeep = !!on;
    this.requestDraw();
  },

  setAllFogDeep(on) {
    if (!this.tiles) return;
    this.tiles.forEach((t) => { if (t) t.fogDeep = !!on; });
    this.requestDraw();
  },

  // ---------- Curvas ----------
  // cubic-bezier(.25,.1,.25,1) = "ease" de CSS
  _ease(x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bez = (a, b, tt) => 3 * a * tt * (1 - tt) * (1 - tt) + 3 * b * tt * tt * (1 - tt) + tt * tt * tt;
    let lo = 0, hi = 1, tt = x;
    for (let i = 0; i < 20; i++) {
      tt = (lo + hi) / 2;
      if (bez(0.25, 0.25, tt) < x) lo = tt; else hi = tt;
    }
    return bez(0.1, 1, tt);
  },

  _revealAlpha(t, now) {
    if (!t.reveal) return 0;
    const p = (now - t.revealT0) / this.REVEAL_MS;
    if (p >= 1) return t.revealTo;
    return t.revealFrom + (t.revealTo - t.revealFrom) * this._ease(p);
  },

  _hoverAlpha(t, now) {
    const p = (now - t.hT0) / this.HOVER_MS;
    if (p >= 1) return t.hTo;
    return t.hFrom + (t.hTo - t.hFrom) * this._ease(p);
  },

  // ---------- Resaltado bajo el ratón ----------
  _bindMouse() {
    if (this._bound || !this.viewportEl) return;
    this._bound = true;
    const vp = this.viewportEl;
    vp.addEventListener("mousemove", (e) => {
      const tg = e.target;
      // Solo cuenta si no hay nada (unidad, tótem, botón...) entre el ratón y el suelo
      const ok = tg === vp || tg === this.cameraEl || (tg && tg.id === "board-tiles") || tg === this.canvas;
      this._mouse = { x: e.clientX, y: e.clientY, ok };
      this._updateHover();
    }, { passive: true });
    vp.addEventListener("mouseleave", () => {
      this._mouse = null;
      this._updateHover();
    }, { passive: true });
  },

  _pickHover() {
    const m = this._mouse;
    if (!m || !m.ok || !this._lastCam || !this.tiles) return -1;
    const rect = this.viewportEl.getBoundingClientRect();
    const cam = this._lastCam;
    const cx = (m.x - rect.left - cam.panX) / cam.scale;
    const cy = (m.y - rect.top - cam.panY) / cam.scale;
    const c0 = getTileFromPoint(cx, cy, this.size);
    const br = this.baseRect;
    let best = -1, bestKey = -1;
    for (let dr = -3; dr <= 3; dr++) {
      for (let dc = -3; dc <= 3; dc++) {
        const r = c0.row + dr, c = c0.col + dc;
        if (r < 0 || c < 0 || r >= this.size || c >= this.size) continue;
        const t = this.tiles[r * this.size + c];
        if (!t || t.baseHidden) continue; // sin hierba base ya no era "pasable" por el ratón
        if (cx < t.x + br.ox || cx >= t.x + br.ox + br.w || cy < t.y + br.oy || cy >= t.y + br.oy + br.h) continue;
        const key = (r + c) * 1000 + r;
        if (key > bestKey) { bestKey = key; best = r * this.size + c; }
      }
    }
    return best;
  },

  _updateHover() {
    const idx = this._pickHover();
    if (idx === this._hoverIdx) return;
    const now = performance.now();
    if (this._hoverIdx >= 0) {
      const o = this.tiles[this._hoverIdx];
      o.hFrom = this._hoverAlpha(o, now); o.hTo = 0; o.hT0 = now;
      this._active.add(this._hoverIdx);
    }
    if (idx >= 0) {
      const n = this.tiles[idx];
      n.hFrom = this._hoverAlpha(n, now); n.hTo = 1; n.hT0 = now;
      this._active.add(idx);
    }
    this._hoverIdx = idx;
    this.requestDraw();
  },

  // ---------- Pintado ----------
  requestDraw() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this.render();
    });
  },

  // Lo llama BoardView._apply en cada frame de cámara (síncrono, para que
  // el canvas y el transform del DOM salgan siempre del mismo frame).
  render(panX, panY, scale) {
    if (!this.canvas || !this.tiles || !this.viewportEl) return;
    if (panX === undefined) {
      if (!this._lastCam) return;
      ({ panX, panY, scale } = this._lastCam);
    }
    this._lastCam = { panX, panY, scale };
    const vw = this.viewportEl.clientWidth;
    const vh = this.viewportEl.clientHeight;
    if (!vw || !vh) return;
    const dpr = window.devicePixelRatio || 1;
    if (this._bw !== vw || this._bh !== vh || this._dpr !== dpr) {
      this._bw = vw; this._bh = vh; this._dpr = dpr;
      this.canvas.width = Math.round(vw * dpr);
      this.canvas.height = Math.round(vh * dpr);
    }
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * panX, dpr * panY);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = this.QUALITY;

    const now = performance.now();
    const range = getVisibleTileRange(panX, panY, scale, vw, vh, this.size);
    const body = document.body;
    const perf = body.classList.contains("perf-mode") && !body.classList.contains("oracle-fog-lifted");
    const br = this.baseRect;
    const size = this.size;
    const minD = range.minRow + range.minCol;
    const maxD = range.maxRow + range.maxCol;
    for (let d = minD; d <= maxD; d++) {
      const rLo = Math.max(range.minRow, d - range.maxCol);
      const rHi = Math.min(range.maxRow, d - range.minCol);
      for (let r = rLo; r <= rHi; r++) {
        const t = this.tiles[r * size + (d - r)];
        if (!t) continue;
        if (perf && t.unexplored) continue;
        const rem = t.remembered;
        if (!t.baseHidden) this._blit(ctx, t.baseSrc, t.x + br.ox, t.y + br.oy, br.w, br.h, rem, 1);
        if (t.reveal) {
          const a = this._revealAlpha(t, now);
          if (a > 0) this._blit(ctx, t.reveal.src, t.x + t.reveal.ox, t.y + t.reveal.oy, t.reveal.w, t.reveal.h, rem, a);
        }
        if (t.hTo > 0 || t.hFrom > 0) {
          const ha = this._hoverAlpha(t, now);
          if (ha > 0.001) {
            ctx.globalAlpha = ha * this.HOVER_ALPHA;
            ctx.fillStyle = rem ? "rgb(166,166,166)" : "#fff";
            ctx.beginPath();
            ctx.moveTo(t.x + 94, t.y);
            ctx.lineTo(t.x + 188, t.y + 58.5);
            ctx.lineTo(t.x + 94, t.y + 117);
            ctx.lineTo(t.x, t.y + 58.5);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      }
    }

    // Pasada 2: nubes de niebla profunda, siempre POR ENCIMA de todo el suelo
    // (igual que en el DOM: su z-index era mayor que el de cualquier loseta) y
    // en el mismo orden (fila+columna, luego fila) que tenían los <img>.
    if (typeof FOG_SRC !== "undefined") {
      const fim = this._fogTex();
      if (fim) {
        const fw = Math.round(TILE_WIDTH * FOG_OVERHANG);
        const fh = Math.round((fw * FOG_NATIVE_HEIGHT) / FOG_NATIVE_WIDTH);
        ctx.globalAlpha = 0.96;
        for (let d = minD; d <= maxD; d++) {
          const rLo = Math.max(range.minRow, d - range.maxCol);
          const rHi = Math.min(range.maxRow, d - range.minCol);
          for (let r = rLo; r <= rHi; r++) {
            const t = this.tiles[r * size + (d - r)];
            if (!t || !t.fogDeep) continue;
            ctx.drawImage(fim, t.x + TILE_WIDTH / 2 - fw / 2, t.y + TILE_TOP_HEIGHT / 2 - fh / 2, fw, fh);
          }
        }
        ctx.globalAlpha = 1;
      }
    }

    // ¿Queda alguna transición en curso? -> otro frame
    if (this._active.size) {
      this._active.forEach((idx) => {
        const t = this.tiles[idx];
        const revDone = !t.reveal || now - t.revealT0 >= this.REVEAL_MS;
        const hovDone = now - t.hT0 >= this.HOVER_MS;
        if (revDone && hovDone) this._active.delete(idx);
      });
      if (this._active.size) this.requestDraw();
    }
  },

  _blit(ctx, orig, x, y, w, h, remembered, alpha) {
    const im = this._tex(orig);
    if (!im) return;
    if (alpha !== 1) ctx.globalAlpha = alpha;
    if (remembered) {
      const g = this._grayOf(im);
      if (g) {
        ctx.drawImage(g, x, y, w, h);
      } else if ("filter" in ctx) {
        ctx.filter = "saturate(0.25) brightness(0.65)";
        ctx.drawImage(im, x, y, w, h);
        ctx.filter = "none";
      } else {
        ctx.drawImage(im, x, y, w, h);
      }
    } else {
      ctx.drawImage(im, x, y, w, h);
    }
    if (alpha !== 1) ctx.globalAlpha = 1;
  },

  // Calidad dinámica / modo rendimiento / niebla levantada: repintar.
  refresh() { this.requestDraw(); },

  clear() {
    this.tiles = null;
    this._active.clear();
    if (this.canvas && this.ctx) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  },
};

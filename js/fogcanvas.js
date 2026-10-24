/* Gnomore Gnomes — niebla de guerra dibujada en UN solo <canvas> (sustituye a
   las nubes <img class="tile__fog"> del DOM).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe PINTAR la
   niebla (nubes en reposo, disipado al revelar, objetos que asoman por
   encima); QUÉ losetas están reveladas lo decide js/fog.js (Fog.revealedGrid).

   Por qué: con las nubes en el DOM había que mantener decenas de capas de
   composición con animaciones CSS, un z-index calculado por nube y por
   sprite (Fog._refreshFogCoverZ medía el rectángulo de cada objeto en cada
   revelado) y el revelado necesitaba blur() (muy caro en móvil). Aquí todo
   sale de un único lienzo que se redibuja en el MISMO fotograma que mueve la
   cámara (BoardView._apply), sin capas, sin z-index por nube y sin blur.

   Capa: el lienzo vive DENTRO de la cámara (#board-camera) con z-index 2000,
   así que sigue el sistema de z-index del tablero: por encima de todos los
   sprites (que van de (fila+columna)*10+5 hasta ~600) y de los marcadores
   normales, y por DEBAJO de lo que ya iba "sobre la niebla" (gnomos
   visibles 3000, marcadores siempre-arriba 5000, anillos de habilidades
   2800-2900, volcán/grúa 8000-9000). Para que el lienzo (que mide lo que el
   viewport) coincida con la pantalla 1:1, se le aplica la transformación
   INVERSA de la cámara (ver render).

   Objetos que asoman (pedido explícito: "podrían asomarse los árboles y
   algunas estructuras reveladas por encima de la niebla"): los recursos y
   edificios ya revelados que tienen niebla cerca se redibujan encima, solo
   su parte alta (la base se desvanece), así se ve la copa/torre por encima
   de la nube mientras la base queda "enterrada" en ella. */

const FogCanvas = {
  canvas: null, // capa superior (objetos enterrados)
  back: null, // capa de fondo (toda la niebla)
  ctx: null,
  size: 0,
  _cam: null, // {panX, panY, scale} del último render
  _raf: 0,
  _bw: 0,
  _bh: 0,
  _dpr: 1,
  _dis: new Map(), // índice -> instante de inicio del disipado (solo las que se están disipando)
  _anim: null, // Uint8Array: 1 = nube de frontera que respira
  _phase: null, // Float32Array: fase de la respiración (0-1) por loseta
  _liftA: 1, // opacidad global de la niebla (El Vigilante la levanta)
  _liftFrom: 1,
  _liftTo: 1,
  _liftT0: 0,
  _edges: [], // objetos que asoman: {el, row, col, kind, rect, key}
  _edgeDirty: true,
  _peekSpr: new Map(), // src -> canvas con la parte alta del sprite y la base desvanecida
  _stats: { drawn: 0, peeks: 0 },
  _busy: false,
  _fw: 0,
  _fh: 0,
  _off: null,
  _dynT: 0,

  ALPHA: 0.96,
  IDLE_MS: 8000, // mismo ciclo que fog-idle-drift
  DISSIPATE_MS: 1200, // mismo tiempo que fog-dissipate
  PEEK_ON: true,
  BREATHE: true, // respiración de las nubes del borde (solo en escritorio y con "Niebla de alta calidad")
  MAX_ANIMATED: 28,

  // ---------- Ciclo de vida ----------
  setup(size) {
    this.size = size;
    this._dis.clear();
    this._anim = new Uint8Array(size * size);
    this._phase = new Float32Array(size * size);
    for (let i = 0; i < size * size; i++) {
      // Fase repartida de forma estable (sin Math.random: mismo mapa = misma niebla).
      this._phase[i] = ((i * 2654435761) % 1000) / 1000;
    }
    this._liftA = this._liftFrom = this._liftTo = 1;
    this._edges = [];
    this._edgeDirty = true;
    this._ensureCanvas();
    this.requestDraw();
  },

  clear() {
    this.size = 0;
    this._dis.clear();
    this._edges = [];
    [this.back, this.canvas].forEach((cv) => {
      if (!cv) return;
      const g = cv.getContext("2d");
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cv.width, cv.height);
    });
  },

  _ensureCanvas() {
    if (typeof BoardView === "undefined" || !BoardView.cameraEl) return false;
    if (this.canvas && this.back && this.canvas.parentNode === BoardView.cameraEl && this.back.parentNode === BoardView.cameraEl) return true;
    const mk = (id, cls) => {
      let c = document.getElementById(id);
      if (!c) {
        c = document.createElement("canvas");
        c.id = id;
        c.className = cls;
        BoardView.cameraEl.appendChild(c);
      }
      return c;
    };
    // Fondo (z-index 2): toda la niebla, por debajo de sprites y de su interfaz.
    this.back = mk("board-fog-back", "board-fog board-fog--back");
    // Superior (z-index 2000): solo repinta la base de objetos con niebla delante.
    this.canvas = mk("board-fog", "board-fog");
    this.ctx = this.canvas.getContext("2d");
    this._bw = 0;
    return true;
  },

  // ---------- Eventos de Fog ----------
  // Una loseta se acaba de revelar: arranca su disipado (o nada, si es instantáneo).
  onReveal(row, col, instant) {
    if (!this.size) return;
    if (!instant) this._dis.set(row * this.size + col, performance.now());
    this._animDirty = true;
    this._edgeDirty = true;
    this.requestDraw();
  },

  onVisibilityChanged() {
    this._edgeDirty = true;
    this.requestDraw();
  },

  // El Vigilante levanta/baja toda la niebla con un fundido.
  setLifted(on) {
    const now = performance.now();
    this._liftFrom = this._liftA;
    this._liftTo = on ? 0 : 1;
    this._liftT0 = now;
    this._edgeDirty = true;
    this.requestDraw();
  },

  onAnimToggle() {
    this._animDirty = true;
    this._edgeDirty = true;
    this.requestDraw();
  },

  // ---------- Nubes que respiran ----------
  // Misma regla que el DOM: una de cada dos losetas (fila+columna par), sin
  // revelar y a menos de 2 casillas de lo revelado, con tope de 28 a la vez.
  _recomputeAnim() {
    this._animDirty = false;
    const n = this.size;
    const A = this._anim;
    A.fill(0);
    const F = typeof Fog !== "undefined" ? Fog : null;
    if (!F || !F.revealedGrid || !F.animEnabled || !this.BREATHE) return;
    let count = 0;
    for (let r = 0; r < n && count < this.MAX_ANIMATED; r++) {
      for (let c = 0; c < n && count < this.MAX_ANIMATED; c++) {
        if (F.revealedGrid[r][c] || (r + c) % 2 !== 0) continue;
        let near = false;
        for (let dr = -2; dr <= 2 && !near; dr++) {
          const rr = r + dr;
          if (rr < 0 || rr >= n) continue;
          for (let dc = -2; dc <= 2; dc++) {
            const cc = c + dc;
            if (cc >= 0 && cc < n && F.revealedGrid[rr][cc]) { near = true; break; }
          }
        }
        if (near) { A[r * n + c] = 1; count++; }
      }
    }
  },

  // cubic-bezier(.22,.61,.36,1) (la curva del disipado CSS), resuelta por bisección.
  _ease(x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bez = (a, b, t) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 16; i++) {
      t = (lo + hi) / 2;
      if (bez(0.22, 0.36, t) < x) lo = t; else hi = t;
    }
    return bez(0.61, 1, t);
  },

  // ---------- Pintado ----------
  requestDraw() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this.render();
    });
  },

  _mobile() {
    return typeof Fog !== "undefined" && Fog._mobileUI && Fog._mobileUI();
  },

  // Parámetros de la nube (r,c) en este instante, o null si no se pinta.
  _cloud(F, r, c, now, mobile, animOn) {
    const n = this.size, idx = r * n + c, fh = this._fh;
    let a = this.ALPHA, sc = 1, dy = 0, rot = 0;
    if (F.revealedGrid[r][c]) {
      const t0 = this._dis.get(idx);
      if (t0 === undefined) return null;
      // Calidad baja: un simple fundido (0,7 s), sin crecer ni subir; alta calidad: se disipa con la animación completa.
      const lq = !F.animEnabled;
      const t = (now - t0) / (lq ? 700 : this.DISSIPATE_MS);
      if (t >= 1) { this._dis.delete(idx); return null; }
      if (lq) {
        a = this.ALPHA * (1 - (1 - (1 - t) * (1 - t)));
      } else {
        const e = this._ease(t);
        a = this.ALPHA * (1 - e);
        sc = 1 + (mobile ? 0.4 : 0.6) * e;
        dy = -(mobile ? 0.22 : 0.24) * fh * e;
      }
      this._busy = true;
    } else if (animOn && this._anim[idx]) {
      // fog-idle-drift: 0%,100% reposo; 50% translate(-50%,-42%) scale(1.09) rotate(1.6deg); ease-in-out
      const k = ((now / this.IDLE_MS) + this._phase[idx]) % 1;
      const q = 0.5 - 0.5 * Math.cos(k * Math.PI * 2);
      sc = 1 + 0.09 * q;
      dy = -0.08 * fh * q;
      rot = (1.6 * q * Math.PI) / 180;
      this._busy = true;
    }
    return { a: a * this._liftA, sc, dy, rot };
  },

  // Dibuja una nube en coordenadas de contenido (ctx ya transformado).
  _paintCloud(ctx, tex, r, c, p) {
    const fw = this._fw, fh = this._fh;
    const ctr = getTileCenter(r, c, this.size);
    ctx.globalAlpha = p.a;
    if (p.rot === 0 && p.sc === 1) {
      ctx.drawImage(tex, ctr.x - fw / 2, ctr.y + p.dy - fh / 2, fw, fh);
    } else {
      ctx.save();
      ctx.translate(ctr.x, ctr.y + p.dy);
      if (p.rot) ctx.rotate(p.rot);
      ctx.scale(p.sc, p.sc);
      ctx.drawImage(tex, -fw / 2, -fh / 2, fw, fh);
      ctx.restore();
    }
  },

  render(panX, panY, scale) {
    if (!this.size || !this._ensureCanvas()) return;
    const vp = BoardView.viewportEl;
    if (!vp) return;
    if (panX === undefined) {
      if (!this._cam) return;
      ({ panX, panY, scale } = this._cam);
    }
    this._cam = { panX, panY, scale };
    const vw = vp.clientWidth, vh = vp.clientHeight;
    if (!vw || !vh) return;
    const F = typeof Fog !== "undefined" ? Fog : null;
    if (!F || !F.revealedGrid) return;

    let dpr = window.devicePixelRatio || 1;
    if (typeof PerfMode !== "undefined" && PerfMode._isPhone && PerfMode._isPhone()) dpr = Math.min(dpr, 2);
    if (this._bw !== vw || this._bh !== vh || this._dpr !== dpr) {
      this._bw = vw; this._bh = vh; this._dpr = dpr;
      [this.back, this.canvas].forEach((cv) => {
        cv.width = Math.round(vw * dpr);
        cv.height = Math.round(vh * dpr);
        cv.style.width = vw + "px";
        cv.style.height = vh + "px";
      });
    }
    // Inversa de la cámara: los lienzos (hijos de la cámara) quedan clavados a la pantalla.
    const inv = `translate(${-panX / scale}px, ${-panY / scale}px) scale(${1 / scale})`;
    this.back.style.transform = inv;
    this.canvas.style.transform = inv;

    const now = performance.now();
    if (this._animDirty !== false) this._recomputeAnim();

    // Fundido global (El Vigilante).
    if (this._liftA !== this._liftTo) {
      const p = Math.min(1, (now - this._liftT0) / 600);
      this._liftA = this._liftFrom + (this._liftTo - this._liftFrom) * p;
    }

    const bctx = this.back.getContext("2d");
    const octx = this.ctx;
    for (const g of [bctx, octx]) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this._busy = this._liftA !== this._liftTo;

    const tex = typeof TerrainCanvas !== "undefined" && TerrainCanvas._fogTex ? TerrainCanvas._fogTex() : null;
    if (!tex) { this.requestDraw(); return; } // la textura aún está cargando
    const n = this.size;
    this._fw = Math.round(TILE_WIDTH * FOG_OVERHANG);
    this._fh = Math.round((this._fw * FOG_NATIVE_HEIGHT) / FOG_NATIVE_WIDTH);
    const mobile = this._mobile();
    const animOn = this.BREATHE && F.animEnabled && !mobile;
    let drawn = 0;

    if (this._liftA > 0.003) {
      // Capa de fondo: TODA la niebla, POR DEBAJO de sprites, barras, insignias y marcadores.
      bctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * panX, dpr * panY);
      bctx.imageSmoothingEnabled = true;
      bctx.imageSmoothingQuality = "high";
      const range = getVisibleTileRange(panX, panY, scale, vw, vh, n);
      const r0 = Math.max(0, range.minRow - 1), r1 = Math.min(n - 1, range.maxRow + 1);
      const c0 = Math.max(0, range.minCol - 1), c1 = Math.min(n - 1, range.maxCol + 1);
      for (let d = r0 + c0; d <= r1 + c1; d++) {
        const rLo = Math.max(r0, d - c1), rHi = Math.min(r1, d - c0);
        for (let r = rLo; r <= rHi; r++) {
          const c = d - r;
          const p = this._cloud(F, r, c, now, mobile, animOn);
          if (!p) continue;
          this._paintCloud(bctx, tex, r, c, p);
          drawn++;
        }
      }
      bctx.globalAlpha = 1;
      // Capa superior: solo la parte baja de los objetos con niebla DELANTE (ver _drawBuried).
      if (this.PEEK_ON && this._liftA > 0.5) {
        octx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * panX, dpr * panY);
        octx.imageSmoothingEnabled = true;
        this._drawBuried(octx, F, tex, panX, panY, scale, vw, vh, dpr, now, mobile, animOn);
      }
    }
    this._stats.drawn = drawn;
    if (this._busy || this._dis.size) this.requestDraw();
    else if (this._edges.some((e) => e.dyn) && !this._dynT) this._dynT = setTimeout(() => { this._dynT = 0; this.requestDraw(); }, 120); // unidades/gnomos junto a la niebla: repasa su silueta
  },

  // ---------- Objetos enterrados / que asoman ----------
  _entityLists() {
    const out = [];
    const add = (kind, list) => { if (list && list.length) out.push([kind, list]); };
    if (typeof Resources !== "undefined") add("res", Resources.list);
    if (typeof Villages !== "undefined") add("village", Villages.list);
    if (typeof Obelisks !== "undefined") add("obelisk", Obelisks.list);
    if (typeof Shops !== "undefined") add("shop", Shops.list);
    if (typeof Oracle !== "undefined") add("oracle", Oracle.list);
    if (typeof Altar !== "undefined") add("altar", Altar.list);
    if (typeof Bushes !== "undefined") add("bush", Bushes.list);
    if (typeof Hierbajos !== "undefined") add("hier", Hierbajos.list);
    if (typeof Mushrooms !== "undefined") add("mush", Mushrooms.list.filter((m) => !m.heldBy));
    if (typeof Drums !== "undefined") add("drum", Drums.list);
    if (typeof Bumpers !== "undefined") add("bumper", Bumpers.list);
    if (typeof TotemVision !== "undefined") add("totem", TotemVision.list);
    if (typeof BloodSplat !== "undefined") add("blood", BloodSplat.list);
    if (typeof Egg !== "undefined" && Egg.egg && !Egg.egg.exploded) add("egg", [Egg.egg]);
    if (typeof Backpack !== "undefined") { add("item", Backpack.placedItems); add("trap", Backpack.traps); }
    // Móviles (se vuelven a medir en cada repintado): unidades y gnomos
    if (typeof Units !== "undefined") add("unit", Units.list);
    if (typeof Gnome !== "undefined") add("gnome", Gnome.list);
    return out;
  },

  _spriteOf(el) {
    return el.querySelector('img[class*="sprite"]:not(.gg-cast-shadow):not(.sq-ghost)') || el.querySelector("img:not(.gg-cast-shadow):not(.sq-ghost)");
  },

  // Objetos ya revelados con alguna loseta sin revelar a 3 casillas o menos.
  _recomputeEdges() {
    this._edgeDirty = false;
    const F = Fog;
    const n = this.size;
    const prev = new Set(this._edges.map((e) => e.el));
    const next = [];
    if (F.revealedGrid && !F._lifted && F.animEnabled) { // solo con "Niebla de alta calidad"
      for (const [kind, list] of this._entityLists()) {
        for (const o of list) {
          if (!o || !o.el || !o.el.isConnected) continue;
          if (o.row < 0 || o.col < 0 || o.row >= n || o.col >= n) continue;
          if (!F.revealedGrid[o.row][o.col]) continue;
          let edge = false;
          for (let dr = -4; dr <= 4 && !edge; dr++) {
            const rr = o.row + dr;
            if (rr < 0 || rr >= n) continue;
            for (let dc = -4; dc <= 4; dc++) {
              const cc = o.col + dc;
              if (cc >= 0 && cc < n && !F.revealedGrid[rr][cc]) { edge = true; break; }
            }
          }
          if (edge) next.push({ el: o.el, row: o.row, col: o.col, kind, rect: null, src: "", flip: false, dyn: kind === "unit" || kind === "gnome" });
        }
      }
    }
    const nextSet = new Set(next.map((e) => e.el));
    prev.forEach((el) => { if (!nextSet.has(el)) el.classList.remove("gg-peek"); });
    this._edges = next;
    this._geomDirty = true;
  },

  _measure(e, panX, panY, scale) {
    const sp = this._spriteOf(e.el);
    if (!sp || !sp.complete || !sp.naturalWidth) { e.rect = null; return; }
    const r = sp.getBoundingClientRect();
    if (!r.width || !r.height) { e.rect = null; return; }
    const vpr = BoardView.viewportEl.getBoundingClientRect();
    e.rect = { x: (r.left - vpr.left - panX) / scale, y: (r.top - vpr.top - panY) / scale, w: r.width / scale, h: r.height / scale };
    e.sp = sp;
    e.src = sp.currentSrc || sp.src;
    // Sprites espejados (hierbajos, giros): la silueta también.
    let flip = false;
    try {
      const t = getComputedStyle(sp).transform;
      const m = /^matrix\(([^,]+),/.exec(t || "");
      if (m && parseFloat(m[1]) < 0) flip = true;
    } catch (err) {}
    e.flip = flip;
  },

  // Silueta del sprite con peso vertical: 0 en el 42% de arriba (la parte alta asoma por encima de
  // la niebla), subiendo a 1 en el 78% (la base queda tapada por la nube de delante).
  _baseMask(sp, flip) {
    const key = (sp.currentSrc || sp.src) + (flip ? "|f" : "");
    let m = this._peekSpr.get(key);
    if (m) return m;
    const W = Math.min(sp.naturalWidth, 320);
    const H = Math.max(1, Math.round((W * sp.naturalHeight) / sp.naturalWidth));
    m = document.createElement("canvas");
    m.width = W; m.height = H;
    const g = m.getContext("2d");
    if (flip) { g.translate(W, 0); g.scale(-1, 1); }
    // Silueta ligeramente engordada (±2 px): cubre el borde oscuro antialiasado del sprite.
    const d = Math.max(1.5, W / 160);
    for (const [ox, oy] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, d], [d, -d], [-d, -d]]) g.drawImage(sp, ox, oy, W, H);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "destination-in";
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, "rgba(0,0,0,0)");
    gr.addColorStop(0.5, "rgba(0,0,0,0)");
    gr.addColorStop(0.8, "rgba(0,0,0,1)");
    gr.addColorStop(1, "rgba(0,0,0,1)");
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    this._peekSpr.set(key, m);
    if (this._peekSpr.size > 80) this._peekSpr.delete(this._peekSpr.keys().next().value);
    return m;
  },

  // Por cada objeto revelado cerca de la niebla: las nubes que están DELANTE de él (fila+columna
  // igual o mayor, el mismo criterio de z-index de siempre) se repintan encima SOLO sobre su
  // silueta y sobre su parte baja. Así la base queda enterrada en la nube, la parte alta asoma, y
  // las nubes de DETRÁS no lo tapan. La interfaz (barras, insignias, marcadores) queda por encima
  // de la niebla de fondo, que va por debajo de todo.
  // Pinta, sobre un objeto, la niebla que tiene DELANTE (o toda la que cubre su sombra) en un lienzo
  // auxiliar y la estampa en el lienzo superior con los bordes difuminados (sin rectángulos visibles).
  //   mode "sprite": solo nubes por delante (fila+columna >= la del objeto); la parte alta queda libre,
  //                  la base se hunde. La caja se amplía por los lados y por abajo con un fundido.
  //   mode "shadow": cualquier nube que cubra la sombra del suelo (la sombra siempre va bajo la niebla).
  _patch(octx, g, F, tex, e, mode, R, scale, dpr, now, mobile, animOn) {
    const n = this.size;
    const sprite = mode === "sprite";
    const mxs = sprite ? 0.2 : 0.12, bot = sprite ? 0.3 : 0.12, top = sprite ? 0 : 0.12;
    const B = { x: R.x - R.w * mxs, y: R.y - R.h * top, w: R.w * (1 + 2 * mxs), h: R.h * (1 + top + bot) };
    const de = e.row + e.col;
    const cand = [];
    const rad = sprite ? 3 : 4;
    for (let r = Math.max(0, e.row - rad); r <= Math.min(n - 1, e.row + rad); r++) {
      for (let c = Math.max(0, e.col - rad); c <= Math.min(n - 1, e.col + rad); c++) {
        if (sprite && r + c < de) continue; // la niebla de DETRÁS nunca tapa al objeto
        if (F.revealedGrid[r][c] && !this._dis.has(r * n + c)) continue;
        const ctr = getTileCenter(r, c, n);
        const hw = this._fw * 0.85, hh = this._fh * 0.85;
        if (ctr.x + hw < B.x || ctr.x - hw > B.x + B.w || ctr.y + hh < B.y || ctr.y - hh > B.y + B.h) continue;
        cand.push([r + c, r, c]);
      }
    }
    if (!cand.length) return false;
    cand.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let k = scale * dpr;
    const maxK = Math.min(640 / B.w, 640 / B.h);
    if (k > maxK) k = maxK;
    const W = Math.max(1, Math.ceil(B.w * k)), H = Math.max(1, Math.ceil(B.h * k));
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, W, H);
    g.setTransform(k, 0, 0, k, -B.x * k, -B.y * k);
    g.imageSmoothingEnabled = true;
    let any = false;
    for (const [, r, c] of cand) {
      const p = this._cloud(F, r, c, now, mobile, animOn);
      if (!p) continue;
      this._paintCloud(g, tex, r, c, p);
      any = true;
    }
    g.globalAlpha = 1;
    if (!any) return false;
    // Se recortan (destination-out) los objetos que están DELANTE del que se está pintando y se solapan con
    // la caja: la niebla de este parche nunca debe tapar a lo que tiene delante (en la misma fila+columna
    // gana el de mayor fila). En modo sombra también se recorta el propio objeto (la sombra va detrás).
    {
      const d = 1.5 / scale;
      g.setTransform(k, 0, 0, k, -B.x * k, -B.y * k);
      g.globalCompositeOperation = "destination-out";
      const cut = (S, sp, flip) => {
        for (const [ox, oy] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]]) {
          g.save();
          g.translate(S.x + S.w / 2 + ox, S.y + oy);
          if (flip) g.scale(-1, 1);
          g.drawImage(sp, -S.w / 2, 0, S.w, S.h);
          g.restore();
        }
      };
      if (!sprite && e.sp && e.rect) cut(e.rect, e.sp, e.flip);
      for (const o of this._edges) {
        if (o === e || !o.rect || !o.sp || !o.sp.complete) continue;
        if (o.el.classList.contains("unit--fog-hidden") || o.el.classList.contains("gg-viewport-culled")) continue;
        const dO = o.row + o.col;
        if (dO < de || (dO === de && o.row <= e.row)) continue; // detrás o a la par: lo tapa la niebla igual
        const S = o.rect;
        if (S.x + S.w < B.x || S.x > B.x + B.w || S.y + S.h < B.y || S.y > B.y + B.h) continue;
        cut(S, o.sp, o.flip);
      }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "destination-in";
    // Horizontal: fundido en los márgenes laterales.
    const hf = mxs / (1 + 2 * mxs);
    let gr = g.createLinearGradient(0, 0, W, 0);
    gr.addColorStop(0, "rgba(0,0,0,0)");
    gr.addColorStop(hf, "rgba(0,0,0,1)");
    gr.addColorStop(1 - hf, "rgba(0,0,0,1)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    // Vertical.
    const tot = 1 + top + bot;
    gr = g.createLinearGradient(0, 0, 0, H);
    if (sprite) {
      // la parte alta del objeto queda libre; la niebla de delante sube suavemente por su base
      gr.addColorStop(0, "rgba(0,0,0,0)");
      gr.addColorStop(0.5 / tot, "rgba(0,0,0,0)");
      gr.addColorStop(0.82 / tot, "rgba(0,0,0,1)");
      gr.addColorStop(1 / tot, "rgba(0,0,0,1)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
    } else {
      gr.addColorStop(0, "rgba(0,0,0,0)");
      gr.addColorStop(top / tot, "rgba(0,0,0,1)");
      gr.addColorStop((top + 1) / tot, "rgba(0,0,0,1)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
    }
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over";
    octx.globalAlpha = 1;
    octx.drawImage(this._off, 0, 0, W, H, B.x, B.y, B.w, B.h);
    return true;
  },

  _drawBuried(octx, F, tex, panX, panY, scale, vw, vh, dpr, now, mobile, animOn) {
    if (this._edgeDirty) this._recomputeEdges();
    if (!this._off) { this._off = document.createElement("canvas"); this._off.width = 640; this._off.height = 640; }
    const g = this._off.getContext("2d");
    const vpr = BoardView.viewportEl.getBoundingClientRect();
    let count = 0;
    for (const e of this._edges) {
      if (!e.el.isConnected) continue;
      if (this._geomDirty || !e.rect || e.dyn) this._measure(e, panX, panY, scale);
    }
    for (const e of this._edges) {
      const el = e.el;
      if (!el.isConnected) { this._edgeDirty = true; continue; }
      if (el.classList.contains("unit--fog-hidden") || el.classList.contains("gg-viewport-culled")) continue;
      if (this._geomDirty || !e.rect || e.dyn) this._measure(e, panX, panY, scale);
      if (!e.rect) continue;
      if (!e.sp.complete || (e.sp.currentSrc || e.sp.src) !== e.src) { this._measure(e, panX, panY, scale); if (!e.rect) continue; }
      const R = e.rect;
      const sx = R.x * scale + panX, sy = R.y * scale + panY;
      if (sx > vw + 80 || sy > vh + 80 || sx + R.w * scale < -80 || sy + R.h * scale < -80) continue;
      if (this._patch(octx, g, F, tex, e, "sprite", R, scale, dpr, now, mobile, animOn)) count++;
      // La sombra proyectada del objeto también queda bajo la niebla.
      const sh = el.querySelector(".gg-cast-shadow");
      if (sh && sh.dataset.ok) {
        const r = sh.getBoundingClientRect();
        if (r.width > 2 && r.height > 2 && getComputedStyle(sh).visibility !== "hidden") {
          const SR = { x: (r.left - vpr.left - panX) / scale, y: (r.top - vpr.top - panY) / scale, w: r.width / scale, h: r.height / scale };
          this._patch(octx, g, F, tex, e, "shadow", SR, scale, dpr, now, mobile, animOn);
        }
      }
    }
    this._geomDirty = false;
    this._stats.peeks = count;
  },

  // Repintado desde cero (zoom/rotación/cambio de calidad): también se vuelve a medir.
  refresh() {
    this._geomDirty = true;
    this._edgeDirty = true;
    this.requestDraw();
  },

  hardRefresh() {
    if (!this.canvas) return;
    this._bw = 0;
    this._geomDirty = true;
    this.render();
  },
};

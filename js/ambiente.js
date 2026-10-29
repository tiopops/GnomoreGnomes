/* Gnomore Gnomes — efectos ambientales de cada escenario (tono, rayos de luz,
   partículas en suspensión...). Pedido explícito: "un efecto sutil de este tipo
   para cada escenario... debe poder desactivarse desde opciones gráficas, se
   llamará efectos ambientales, en modo rendimiento se desactiva
   automáticamente... que consuman lo mínimo de recursos".
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe construir y
   quitar las capas de ambiente; QUÉ escenario es lo dice LevelAssets.current.

   Coste mínimo:
     - Cero JavaScript por fotograma: se construyen ~25 elementos UNA vez al
       empezar la partida y las animaciones son CSS de solo transform/opacity
       (las lleva la tarjeta gráfica, sin recalcular el diseño).
     - Sin mix-blend-mode ni filtros: el tono es una sola capa de color con
       transparencia normal.
     - Nada depende del tamaño de la ventana: las capas ocupan todo el
       viewport (inset:0) y sus posiciones/recorridos van en % / vw / vh.
     - Se apaga del todo (se quitan los elementos) con la opción o con el modo
       rendimiento; si el tablero deja de verse, el navegador no anima nada.
   Cada escenario tiene el suyo (ver AMBIENT_LEVELS y los métodos de abajo). */

const AMBIENT_LEVELS = {
  // tono: color con transparencia (equivale a multiplicar por el tono aprobado en la demo)
  mushboom_forest: { tint: "rgba(17,91,0,.15)" },
  colinas_rockntroll: { tint: "rgba(103,13,0,.18)" },
  hurrycrane_village: { tint: null }, // sin tono plano: lleva el degradado amarillo/celeste que se desplaza
  wallforge: { tint: "rgba(112,132,166,.13)" }, // acero frío, apenas perceptible
};

const Ambient = {
  _STORAGE_KEY: "gnomoregnomes_ambient",
  enabled: true,
  layer: null, // capa de pantalla dentro de #board-viewport
  worldEls: [], // elementos en el mundo del tablero (brasas del volcán)

  init() {
    const saved = localStorage.getItem(this._STORAGE_KEY);
    this.enabled = saved === null ? true : saved === "1";
  },

  // Activo solo si el jugador lo quiere y el modo rendimiento no está encendido.
  isOn() {
    return this.enabled && !(typeof PerfMode !== "undefined" && PerfMode.enabled);
  },

  setEnabled(enabled) {
    this.enabled = !!enabled;
    localStorage.setItem(this._STORAGE_KEY, this.enabled ? "1" : "0");
    this.refresh();
  },

  // Vuelve a montar (o quita) el ambiente de la partida en curso.
  refresh() {
    if (!this._started) return; // aún no hay partida montada
    this.start();
  },

  stop() {
    if (this.layer) this.layer.remove();
    this.layer = null;
    this.worldEls.forEach((e) => e.remove());
    this.worldEls = [];
  },

  _r(a, b) {
    return a + Math.random() * (b - a);
  },

  // Una partícula: posición inicial en % del viewport, recorrido en vw/vh (no depende de la ventana).
  _p(parent, o) {
    const e = document.createElement("div");
    e.className = "amb-p";
    e.style.cssText =
      `left:${o.x}%;top:${o.y}%;width:${o.s}px;height:${o.s}px;background:${o.c};` +
      `--a:${o.a};--d:${o.d}s;--l:-${o.l}s;--dx:${o.dx};--dy:${o.dy};--sw:${o.sw}px`;
    parent.appendChild(e);
  },

  start() {
    this.stop();
    this._started = true;
    if (!this.isOn()) return;
    const vp = document.getElementById("board-viewport");
    const cfg = AMBIENT_LEVELS[typeof LevelAssets !== "undefined" ? LevelAssets.current : ""];
    if (!vp || !cfg) return;
    const L = document.createElement("div");
    L.className = "amb-layer";
    if (cfg.tint) {
      const tint = document.createElement("div");
      tint.className = "amb-tint";
      tint.style.background = cfg.tint;
      L.appendChild(tint);
    }
    const id = LevelAssets.current;
    if (id === "mushboom_forest") this._mushboom(L);
    else if (id === "colinas_rockntroll") this._rock(L);
    else if (id === "hurrycrane_village") this._hurry(L);
    vp.appendChild(L);
    this.layer = L;
    if (id === "colinas_rockntroll") this._volcanoEmbers();
    else if (id === "wallforge") this._steelGlints();
  },

  // MushBoom: rayos de luz diagonales entre las copas y polen/esporas que lleva el viento.
  _mushboom(L) {
    // Rayos fijos a la pantalla (pedido: "mejor sticky"): nacen, derivan despacio, se esfuman del todo y reaparecen en otro sitio.
    for (let i = 0; i < 5; i++) {
      const e = document.createElement("div");
      e.className = "amb-ray";
      const place = () => {
        e.style.left = `${this._r(2, 88).toFixed(1)}%`;
        e.style.width = `${this._r(6, 12).toFixed(1)}vw`;
      };
      place();
      const d = this._r(11, 16);
      e.style.setProperty("--rd", `${d.toFixed(1)}s`);
      e.style.setProperty("--rl", `-${(i * d / 5).toFixed(1)}s`);
      e.addEventListener("animationiteration", place);
      L.appendChild(e);
    }
    for (let i = 0; i < 22; i++) {
      this._p(L, { x: this._r(0, 80), y: this._r(30, 100), s: Math.random() < 0.3 ? 4 : 3, c: Math.random() < 0.5 ? "#f7f3b0" : "#cfe98a", a: this._r(0.5, 0.9).toFixed(2), d: this._r(14, 26).toFixed(1), l: this._r(0, 26).toFixed(1), dx: `${this._r(22, 38).toFixed(0)}vw`, dy: `-${this._r(8, 22).toFixed(0)}vh`, sw: this._r(-20, 20).toFixed(0) });
    }
  },

  // Rock'n Troll: ceniza que cae en diagonal y velos bajos de humo.
  _rock(L) {
    for (let i = 0; i < 26; i++) {
      this._p(L, { x: this._r(-10, 90), y: this._r(-8, 20), s: Math.random() < 0.35 ? 5 : 3, c: Math.random() < 0.5 ? "#9a8f86" : "#c9bdb2", a: this._r(0.45, 0.8).toFixed(2), d: this._r(9, 16).toFixed(1), l: this._r(0, 16).toFixed(1), dx: `${this._r(10, 22).toFixed(0)}vw`, dy: `${this._r(55, 80).toFixed(0)}vh`, sw: this._r(-30, 30).toFixed(0) });
    }
    for (let i = 0; i < 3; i++) {
      const e = document.createElement("div");
      e.className = "amb-smoke";
      e.style.cssText = `left:${this._r(0, 30)}%;top:${this._r(20, 60)}%;width:${this._r(34, 46)}vw;height:${this._r(12, 18)}vh;--d:${this._r(22, 34).toFixed(0)}s;--l:-${this._r(0, 30).toFixed(0)}s;--dx:${this._r(30, 45).toFixed(0)}vw;--dy:${this._r(-4, 4).toFixed(0)}vh`;
      L.appendChild(e);
    }
  },

  // HurryCrane: degradado amarillo cálido -> celeste que se desplaza muy despacio y puntitos de viento en suspensión.
  _hurry(L) {
    const sky = document.createElement("div");
    sky.className = "amb-sky";
    L.appendChild(sky);
    for (let i = 0; i < 22; i++) {
      this._p(L, { x: this._r(-10, 60), y: this._r(4, 96), s: Math.random() < 0.3 ? 3 : 2, c: "#fff", a: this._r(0.5, 0.85).toFixed(2), d: this._r(10, 18).toFixed(1), l: this._r(0, 18).toFixed(1), dx: `${this._r(45, 70).toFixed(0)}vw`, dy: `${this._r(-9, 6).toFixed(0)}vh`, sw: this._r(-20, 20).toFixed(0) });
    }
  },

  // WallForge: pequeños destellos de sol, suaves, sobre el metal: suelo metálico, menas, árboles y rocas
  // (nunca en tótems ni obeliscos). Los del suelo viven en el mundo del tablero; los de menas/árboles/rocas
  // cuelgan de su recurso (posiciones en fracción de su sprite), así siguen a la cámara y desaparecen con él.
  _steelGlints() {
    if (typeof Units === "undefined" || !Units.container) return;
    let n = 0;
    const add = (parent, left, top, z) => {
      const e = document.createElement("div");
      e.className = "amb-gl";
      const u = (v) => (typeof v === "number" ? `${v}px` : v);
      e.style.cssText = `left:${u(left)};top:${u(top)};--s:${(13 + Math.random() * 7).toFixed(0)}px;--d:${(6 + (n * 1.37) % 5).toFixed(1)}s;--l:-${(n * 1.9).toFixed(1)}s` + (z != null ? `;z-index:${z}` : "");
      parent.appendChild(e);
      this.worldEls.push(e);
      n++;
    };
    // Suelo metálico: casillas libres de la zona de metal (fuera del anillo del altar).
    const size = Units.boardSize, alt = typeof Reliquia !== "undefined" ? Reliquia.altar : null;
    const cand = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (typeof TerrainMap !== "undefined" && TerrainMap.grid && TerrainMap.grid[r] && TerrainMap.grid[r][c] !== "grass") continue;
        if (typeof LevelAssets === "undefined" || LevelAssets.zoneIndex(r, c) !== 1) continue;
        if (alt && Math.max(Math.abs(r - alt.row), Math.abs(c - alt.col)) <= 2) continue;
        cand.push({ r, c });
      }
    }
    for (let i = cand.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cand[i], cand[j]] = [cand[j], cand[i]];
    }
    cand.slice(0, 10).forEach(({ r, c }) => {
      const t = getTileCenter(r, c, size);
      add(Units.container, t.x + this._r(-34, 34), t.y + this._r(-12, 14), (r + c) * 10 + 3);
    });
    // Menas, árboles y rocas: destellos sobre sus placas de hierro. Van en % del propio recurso (su caja mide lo que
    // su sprite), así no dependen de que la imagen ya esté cargada ni de que el tablero ya se vea al montarlos.
    const spots = { mena: [[0.4, 0.35], [0.62, 0.52]], pino: [[0.5, 0.36]], roca: [[0.46, 0.4]] };
    if (typeof Resources !== "undefined" && Resources.list) {
      Resources.list.forEach((nd) => {
        const list = spots[nd.kind];
        if (!list || !nd.el) return;
        list.forEach(([fx, fy]) => add(nd.el, `${(fx * 100).toFixed(0)}%`, `${(fy * 100).toFixed(0)}%`));
      });
    }
  },

  // Brasas que suben desde el volcán (en el mundo del tablero: la cámara las mueve y escala con él).
  _volcanoEmbers() {
    if (typeof Volcano === "undefined" || !Volcano.list || !Volcano.list.length || !Units.container) return;
    Volcano.list.forEach((v) => {
      const c = getTileCenter(v.row, v.col, Units.boardSize);
      for (let i = 0; i < 10; i++) {
        const e = document.createElement("div");
        e.className = "amb-p amb-ember";
        const dx = this._r(-40, 80), dy = this._r(180, 300), s = 4;
        e.style.cssText =
          `left:${c.x + this._r(-50, 50)}px;top:${c.y + 30}px;width:${s}px;height:${s}px;z-index:2100;` +
          `background:${Math.random() < 0.5 ? "#ff9a2b" : "#ffe27a"};--a:1;--d:${this._r(3.5, 6).toFixed(1)}s;--l:-${this._r(0, 6).toFixed(1)}s;` +
          `--dx:${dx.toFixed(0)}px;--dy:-${dy.toFixed(0)}px;--sw:${this._r(-14, 14).toFixed(0)}px`;
        Units.container.appendChild(e);
        this.worldEls.push(e);
      }
    });
  },
};

document.addEventListener("DOMContentLoaded", () => Ambient.init());

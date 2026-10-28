/* Gnomore Gnomes — sprites propios de cada nivel (suelo, agua, vegetación y
   recursos). Pedido explícito: "cada nivel tiene sus propios sprites de
   vegetacion y recursos". LevelAssets.apply(levelId) se llama ANTES de
   generateMap/renderMap/spawn en startMatch y resumeMatch. */
const LevelAssets = {
  current: "mushboom_forest",
  _defaults: null,
  _sets: {
    mushboom_forest: null, // valores originales (se guardan en la primera llamada)
    colinas_rockntroll: {
      dir: "assets/niveles/rockntroll/",
      grassZones: ["tierra.png", "piedra.png"],
      water: ["agua_1.png", "agua_2.png"],
      nodes: { roca: "roca.png", pino: "pino.png", mena: "mena.png" },
      bush: "arbusto.png",
      hierbajos: "hierbajos.png",
    },
    // Fortaleza WallForge: suelo propio por zonas (empedrado de base, metal alrededor de la Reliquia, tierra junto al agua) y dos aguas; vegetación de MushBoom hasta tener la propia.
    wallforge: {
      dir: "assets/niveles/wallforge/",
      grassZones: ["piedra.png", "metal.png", "tierra.png"],
      water: ["agua_1.png", "agua_2.png"],
      nodes: null,
      bush: null,
      hierbajos: null,
    },
    hurrycrane_village: {
      dir: "assets/niveles/hurrycrane/",
      grassZones: ["madera.png", "piedra.png"],
      water: ["agua_1.png", "agua_2.png"],
      nodes: { roca: "roca.png", pino: "pino.png", mena: "mena.png" },
      bush: "arbusto.png",
      hierbajos: "hierbajos.png",
    },
  },

  apply(levelId) {
    const id = this._sets[levelId] !== undefined ? levelId : "mushboom_forest";
    if (!this._defaults) {
      this._defaults = {
        grass: TILE_TYPES.grass.variants.slice(),
        water: TILE_TYPES.water.variants.slice(),
        nodes: {},
      };
      Object.keys(RESOURCE_NODE_TYPES).forEach((k) => (this._defaults.nodes[k] = RESOURCE_NODE_TYPES[k].spriteUrl));
    }
    this.current = id;
    const set = this._sets[id];
    const d = this._defaults;
    if (!set) {
      TILE_TYPES.grass.variants = d.grass.slice();
      TILE_TYPES.grass.zones = null;
      TILE_TYPES.water.variants = d.water.slice();
      Object.keys(d.nodes).forEach((k) => (RESOURCE_NODE_TYPES[k].spriteUrl = d.nodes[k]));
      return;
    }
    const full = (f) => set.dir + f;
    TILE_TYPES.grass.variants = set.grassZones.map(full);
    TILE_TYPES.grass.zones = set.grassZones.map(full);
    this.newZoneSeed();
    TILE_TYPES.water.variants = set.water.map(full);
    if (set.nodes) Object.keys(set.nodes).forEach((k) => (RESOURCE_NODE_TYPES[k].spriteUrl = full(set.nodes[k])));
    else Object.keys(d.nodes).forEach((k) => (RESOURCE_NODE_TYPES[k].spriteUrl = d.nodes[k]));
  },

  bushSprite() {
    const s = this._sets[this.current];
    return s && s.bush ? s.dir + s.bush : "assets/iconos/arbusto.png";
  },
  hierbajosSprite() {
    const s = this._sets[this.current];
    return s && s.hierbajos ? s.dir + s.hierbajos : "assets/escenario/hierbajos.png";
  },

  // Ruido de valor suave: zonas de tierra y piedra concentradas, otras
  // dispersas ("combinalos para crear zonas donde se concentren, otras mas
  // dispersas").
  _seed: 1,
  newZoneSeed() { this._seed = Math.floor(Math.random() * 100000); },
  _h(x, y) {
    let h = (x * 374761393 + y * 668265263 + this._seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  },
  _vn(x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = this._h(x0, y0), b = this._h(x0 + 1, y0), c = this._h(x0, y0 + 1), d = this._h(x0 + 1, y0 + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  },
  // WallForge: suelo por ZONAS (no por ruido). 0 empedrado (base), 1 metal
  // (alrededor del Altar de la Reliquia, en el centro), 2 tierra (junto al agua).
  // prepareTerrain se llama desde generateMap y renderMap con el mapa ya decidido.
  _ctx: null,
  prepareTerrain(size, isWater) {
    const zs = TILE_TYPES.grass.zones;
    if (!zs || zs.length !== 3) { this._ctx = null; return; }
    const INF = 99, d = Array.from({ length: size }, () => new Array(size).fill(INF));
    const q = [];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (isWater(r, c)) { d[r][c] = 0; q.push([r, c]); }
    for (let i = 0; i < q.length; i++) { // distancia (Chebyshev) al agua más cercana
      const [r, c] = q[i];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= size || nc >= size || d[nr][nc] <= d[r][c] + 1) continue;
        d[nr][nc] = d[r][c] + 1; q.push([nr, nc]);
      }
    }
    this._ctx = { size, d };
  },
  _zone3(row, col) {
    const c = this._ctx;
    if (!c) return 0;
    const mid = Math.floor(c.size / 2);
    const dc = Math.max(Math.abs(row - mid), Math.abs(col - mid));
    // Metal: cuadrado irregular alrededor del altar (radio 2.5–3.8).
    if (dc <= 2.5 + 1.3 * this._vn(row / 2.5 + 30, col / 2.5 + 30)) return 1;
    // Tierra: pegada al agua; a 2 casillas, solo a veces para que la orilla no sea una línea recta.
    const dw = c.d[row] ? c.d[row][col] : 99;
    if (dw <= 1 || (dw === 2 && this._h(row, col) < 0.2)) return 2;
    return 0;
  },
  // Devuelve 0 (tierra) o 1 (piedra) para la loseta.
  zoneIndex(row, col) {
    const zs = TILE_TYPES.grass.zones;
    if (zs && zs.length === 3) return this._zone3(row, col);
    // El "bioma" grande decide cuánto se mezcla: en zonas con valor bajo
    // manda un solo material, en las medias se dispersan.
    const big = this._vn(row / 9, col / 9);
    const mid = this._vn(row / 3.2 + 50, col / 3.2 + 50);
    const fine = this._h(row, col);
    const mix = Math.abs(big - 0.5) * 2; // 0 = zona mezclada, 1 = zona pura
    const v = (big - 0.5) * (0.6 + mix) + (mid - 0.5) * (0.9 - 0.5 * mix) + (fine - 0.5) * (0.5 - 0.4 * mix);
    return v > 0 ? 1 : 0;
  },
};

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
    Object.keys(set.nodes).forEach((k) => (RESOURCE_NODE_TYPES[k].spriteUrl = full(set.nodes[k])));
  },

  bushSprite() {
    const s = this._sets[this.current];
    return s ? s.dir + s.bush : "assets/iconos/arbusto.png";
  },
  hierbajosSprite() {
    const s = this._sets[this.current];
    return s ? s.dir + s.hierbajos : "assets/escenario/hierbajos.png";
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
  // Devuelve 0 (tierra) o 1 (piedra) para la loseta.
  zoneIndex(row, col) {
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

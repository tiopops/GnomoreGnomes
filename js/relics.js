/* Gnomore Gnomes — Reliquias (mecánica global, todos los niveles).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - El catálogo de reliquias y las que posee cada equipo (con su
       durabilidad X/X).
     - Aplicar sus efectos (de momento: +1 de movimiento a todas las
       unidades del equipo, Botas TrotaMontes).
     - Gastar durabilidad cuando muere una unidad del equipo: al llegar a 0
       la reliquia se destruye y deja de tener efecto.
   Los Cofres de Reliquias viven en js/resources.js (se interactúan como un
   recurso); la mochila (js/backpack.js) pinta las reliquias del jugador. */

const RELIC_TYPES = {
  trotamontes: {
    name: "Botas TrotaMontes",
    iconUrl: "assets/iconos/reliquia_trotamontes.png",
    durability: 5,
    description:
      "Unas botas hechas para recorrer montañas. Todas tus unidades ganan +1 de Movimiento. Pierden 1 punto de durabilidad cada vez que muere una de tus unidades; al llegar a 0 se destruyen y dejan de tener efecto.",
  },
  acariciagnomos: {
    name: "AcariciaGnomos",
    iconUrl: "assets/iconos/reliquia_acariciagnomos.png",
    durability: 5,
    description:
      "Un puño americano con pinchos dorados. Cada vez que pegas a un gnomo, le haces +3 de daño. Pierde 1 punto de durabilidad cada vez que muere una de tus unidades; al llegar a 0 se destruye y deja de tener efecto.",
  },
  ferognomas: {
    name: "FeroGnomas",
    iconUrl: "assets/iconos/reliquia_ferognomas.png",
    durability: 5,
    description:
      "Perfume hecho a base de feromonas de barba gnoma. Mientras lo lleves en la mochila, los gnomos no huyen al verte, y los que estén a 3 casillas o menos de una unidad tuya se acercarán a ella antes de empezar tu turno. Cada perfume extra multiplica el radio (2 perfumes = 6 casillas, 3 = 9...). Pierde 1 punto de durabilidad cada vez que muere una de tus unidades; al llegar a 0 se destruye y deja de tener efecto.",
  },
  gnomeveo: {
    name: "GnomeVeo",
    iconUrl: "assets/iconos/reliquia_gnomeveo.png",
    durability: 5,
    description:
      "Unas gafas con nariz y bigote. Si miras directamente al sol te queman la sombra. Revelan en el mapa un gnomo libre, aunque esté bajo la niebla, hasta que lo capturas; entonces te muestran otro distinto. Cada par extra muestra un gnomo más (2 gafas = 2 gnomos, 3 = 3...). Pierden 1 punto de durabilidad cada vez que muere una de tus unidades; al llegar a 0 se destruyen y dejan de tener efecto.",
  },
};

const Relics = {
  byTeam: {},
  _nextUid: 1,

  resetAll() {
    this.byTeam = {};
    this._nextUid = 1;
    if (typeof Backpack !== "undefined" && Backpack._slotsEl) Backpack._renderSlots();
  },

  list(team) {
    return (this.byTeam[team] = this.byTeam[team] || []);
  },

  // Reliquia aleatoria del catálogo (hoy solo hay una).
  randomId() {
    const ids = Object.keys(RELIC_TYPES);
    return ids[Math.floor(Math.random() * ids.length)];
  },

  grant(team, relicId) {
    const def = RELIC_TYPES[relicId];
    if (!def) return null;
    const relic = { uid: this._nextUid++, relicId, durability: def.durability, max: def.durability };
    this.list(team).push(relic);
    this._refreshUi(team);
    return relic;
  },

  // +1 de movimiento por cada par de Botas TrotaMontes activo.
  moveBonus(team) {
    return this.list(team).filter((r) => r.relicId === "trotamontes" && r.durability > 0).length;
  },

  // FeroGnomas: los gnomos no huyen y se acercan a las unidades del equipo.
  feroCount(team) {
    return this.list(team).filter((r) => r.relicId === "ferognomas" && r.durability > 0).length;
  },
  hasFeroGnomas(team) {
    return this.feroCount(team) > 0;
  },
  // Radio de olfato: 3 casillas por cada perfume (2 perfumes = 6, 3 = 9...).
  feroRadius(team) {
    return 3 * this.feroCount(team);
  },

  // GnomeVeo: nº de gnomos sueltos que se muestran siempre (1 por gafas).
  gnomeVeoCount(team) {
    return this.list(team).filter((r) => r.relicId === "gnomeveo" && r.durability > 0).length;
  },

  // AcariciaGnomos: +3 al daño (puntos) de cada golpe a un gnomo.
  gnomeHitBonus(team) {
    return 3 * this.list(team).filter((r) => r.relicId === "acariciagnomos" && r.durability > 0).length;
  },

  // Una unidad de `unit.team` ha muerto: cada reliquia del equipo pierde 1.
  onUnitDied(unit) {
    const relics = this.list(unit.team);
    if (relics.length === 0) return;
    relics.forEach((r) => r.durability--);
    const broken = relics.filter((r) => r.durability <= 0);
    this.byTeam[unit.team] = relics.filter((r) => r.durability > 0);
    if (broken.length > 0 && unit.team === "player" && typeof SFX !== "undefined") SFX.death();
    this._refreshUi(unit.team);
  },

  _refreshUi(team) {
    if (team === "player" && typeof Backpack !== "undefined" && Backpack._slotsEl) Backpack._renderSlots();
    if (typeof Units !== "undefined" && Units.selectedId) {
      const sel = Units.list.find((u) => u.id === Units.selectedId);
      if (sel && sel.team === team) Units.refreshRange(sel);
    }
    if (typeof UnitInfo !== "undefined" && UnitInfo.refreshActionDots) UnitInfo.refreshActionDots();
  },
};

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
      "Botas hechas para escalar montañas, no para mirar atrás. Todas tus unidades ganan +1 de Movimiento.",
  },
  acariciagnomos: {
    name: "AcariciaGnomos",
    iconUrl: "assets/iconos/reliquia_acariciagnomos.png",
    durability: 5,
    description:
      "Un puño americano con pinchos dorados, para acariciar gnomos. Tus unidades hacen +1 de daño al pegarles (cada puño suma otro +1).",
  },
  ferognomas: {
    name: "FeroGnomas",
    iconUrl: "assets/iconos/reliquia_ferognomas.png",
    durability: 5,
    description:
      "Perfume de feromonas de barba gnoma. Los gnomos a 3 casillas o menos vienen solos hacia ti y no huyen (cada frasco extra suma 3 casillas).",
  },
  gnomeveo: {
    name: "GnomeVeo",
    iconUrl: "assets/iconos/reliquia_gnomeveo.png",
    durability: 5,
    description:
      "Gafas con nariz y bigote. Mirar al sol te quema la sombra; mirar gnomos, no. Te muestran un gnomo libre aunque haya niebla (cada par extra, uno más).",
  },
  gnomeda: {
    name: "Gnomeda de la Suerte",
    iconUrl: "assets/iconos/reliquia_gnomeda.png",
    durability: 3,
    description:
      "Oro puro de Rock'n'Troll, estampado contra un gnomo (sin querer). Te da +2 Puntos de Gloria por turno (cada moneda extra suma otros +2).",
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

  // Gnomeda de la Suerte: +2 de gloria por turno por cada moneda activa.
  gloryBonus(team) {
    return 2 * this.list(team).filter((r) => r.relicId === "gnomeda" && r.durability > 0).length;
  },

  // AcariciaGnomos: +1 al daño base de la unidad, SOLO al pegar a un gnomo.
  gnomeHitBonus(team) {
    return 1 * this.list(team).filter((r) => r.relicId === "acariciagnomos" && r.durability > 0).length;
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
    if (typeof Glory !== "undefined" && Glory._renderPreview) Glory._renderPreview(team);
    if (team === "player" && typeof Backpack !== "undefined" && Backpack._slotsEl) Backpack._renderSlots();
    if (typeof Units !== "undefined" && Units.selectedId) {
      const sel = Units.list.find((u) => u.id === Units.selectedId);
      if (sel && sel.team === team) Units.refreshRange(sel);
    }
    if (typeof UnitInfo !== "undefined" && UnitInfo.refreshActionDots) UnitInfo.refreshActionDots();
  },
};

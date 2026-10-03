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

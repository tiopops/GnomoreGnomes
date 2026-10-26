/* Gnomore Gnomes — la IA rival usa las habilidades especiales de TODAS las razas.
   Regla de oro: un archivo por mecánica. Este archivo SOLO decide CUÁNDO y SOBRE
   QUIÉN usa cada unidad rival su habilidad; el CÓMO (efectos, daño, animaciones)
   es el mismo código que ya usa el jugador (js/abilities.js y
   js/abilities-surcanubes.js: _resolve*). Se engancha a Turns._aiActOnce: antes de
   la lógica normal de cada acción, la unidad prueba su habilidad (heurísticas
   deliberadamente sencillas, igual que el resto de la IA). Una unidad que usa su
   habilidad gasta una acción; las recargas ya las gestiona Abilities.onTurnStart
   para cualquier equipo.
   Visión Lejana (SurcaBosques) no se usa: solo revela niebla al equipo del jugador. */

const AIAbilities = {
  cheb(a, b) {
    return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
  },

  // Rivales que la unidad "ve" (no escondidos en arbustos).
  enemiesOf(unit) {
    return Units.list.filter(
      (u) => u.team !== unit.team && !(typeof Bushes !== "undefined" && Bushes.isHiddenFromTeam(u.row, u.col, unit.team))
    );
  },
  alliesOf(unit) {
    return Units.list.filter((u) => u !== unit && u.team === unit.team);
  },

  tileFree(row, col, { water = false } = {}) {
    if (row < 0 || col < 0 || row >= Units.boardSize || col >= Units.boardSize) return false;
    if (Units.unitAt(row, col)) return false;
    if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) return false;
    if (typeof Villages !== "undefined" && Villages.at(row, col)) return false;
    if (typeof Shops !== "undefined" && Shops.at(row, col)) return false;
    if (typeof Obelisks !== "undefined" && Obelisks.at(row, col)) return false;
    if (typeof Altar !== "undefined" && Altar.at(row, col)) return false;
    if (typeof GnomOgro !== "undefined" && GnomOgro.at(row, col)) return false;
    if ((typeof Resources !== "undefined" && Resources.at(row, col)) || (typeof Drums !== "undefined" && Drums.at(row, col))) return false;
    const walk = typeof TerrainMap === "undefined" || TerrainMap.isWalkable(row, col);
    return water ? !walk : walk;
  },

  // ¿Acabaría al agua (y se ahogaría) tras un empuje de `dist` casillas en línea desde `from`?
  pushEndsInWater(from, target, dist) {
    if (typeof TerrainMap === "undefined") return false;
    if (typeof Skills !== "undefined" && Skills.has(target.team, "anfibio")) return false;
    const dr = Math.sign(target.row - from.row), dc = Math.sign(target.col - from.col);
    let r = target.row, c = target.col;
    for (let i = 0; i < dist; i++) {
      r += dr;
      c += dc;
      if (r < 0 || c < 0 || r >= Units.boardSize || c >= Units.boardSize) return false;
      if (Units.unitAt(r, c)) return false;
      if (!TerrainMap.isWalkable(r, c)) return true;
    }
    return false;
  },

  async tryUse(unit) {
    if (!unit || !unit.el || !ABILITIES[unit.typeId]) return false;
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return false;
    const fn = this[unit.typeId];
    if (!fn) return false;
    if (unit.abilityUsed) return false;
    return !!(await fn.call(this, unit));
  },

  // ---------- GolemCorteza · Golem de Espinas: cura + espinas si está herido y hay rivales cerca ----------
  async hombre_arbol(unit) {
    const type = UNIT_TYPES[unit.typeId];
    const base = type.aguante + (typeof Armory !== "undefined" ? Armory.defenseBonus(unit.team) : 0) + (unit.cohesionBonus || 0);
    if (unit.hp >= base) return false;
    const near = this.enemiesOf(unit).some((u) => this.cheb(u, unit) <= 3);
    if (!(near || unit.hp <= base - 2)) return false;
    Abilities._activateThorns(unit);
    return true;
  },

  // ---------- PuñoRroca · Nudillos Rocosos: golpea a un adyacente; mejor si cae al agua ----------
  async punoroca(unit) {
    const adj = this.enemiesOf(unit).filter((u) => this.cheb(u, unit) <= 1);
    if (adj.length === 0) return false;
    const score = (u) => (this.pushEndsInWater(unit, u, 4) ? 100 : 0) + UNIT_TYPES[u.typeId].fuerza * 2 + u.hp;
    const target = adj.sort((a, b) => score(b) - score(a))[0];
    await Abilities._resolveKnockback(unit, target);
    return true;
  },

  // ---------- LanzaGnomos · Resorte Goblin: lanza a un rival al agua si hay alguna a su alcance ----------
  async goblin_lanzador(unit) {
    const adj = this.enemiesOf(unit).filter((u) => this.cheb(u, unit) <= 1 && !(typeof Skills !== "undefined" && Skills.has(u.team, "anfibio")));
    if (adj.length === 0) return false;
    const range = Units.moveRangeOf(unit);
    for (const t of adj) {
      let best = null;
      for (let r = unit.row - range; r <= unit.row + range; r++)
        for (let c = unit.col - range; c <= unit.col + range; c++) {
          if (!this.tileFree(r, c, { water: true })) continue;
          if (typeof Fog !== "undefined" && unit.team === "player" && Fog.isFogged(r, c)) continue;
          const d = Math.abs(r - unit.row) + Math.abs(c - unit.col);
          if (!best || d < best.d) best = { r, c, d };
        }
      if (best) {
        await Abilities._resolveThrow(unit, t, best.r, best.c);
        return true;
      }
    }
    return false;
  },

  // ---------- TruenoEspora · Seta: granada si pilla a varios rivales sin tocar aliados; si no, trampa ----------
  async seta_artificiero(unit) {
    const foes = this.enemiesOf(unit);
    const near = foes.filter((u) => this.cheb(u, unit) <= 6);
    if (near.length === 0) return false;
    const allies = this.alliesOf(unit).concat([unit]);
    const tiles = Abilities._mineTargetTiles(unit);
    let best = null;
    tiles.forEach((t) => {
      if (this.cheb(t, unit) <= 1) return;
      const hit = foes.filter((u) => this.cheb(u, t) <= 1).length;
      const hurtMine = allies.filter((u) => this.cheb(u, t) <= 1).length;
      const sc = hit - 2 * hurtMine;
      if (sc >= 1 && (!best || sc > best.sc)) best = { t, sc };
    });
    if (best) {
      await Abilities._resolveMinePlacement(unit, best.t.row, best.t.col);
      return true;
    }
    // Trampa: casilla adyacente libre lo más cerca posible del rival más cercano.
    const nearest = near.sort((a, b) => this.cheb(a, unit) - this.cheb(b, unit))[0];
    if (this.cheb(nearest, unit) <= 1) return false; // ya está encima: mejor pelear
    const adjTiles = tiles.filter((t) => this.cheb(t, unit) === 1);
    if (adjTiles.length === 0) return false;
    adjTiles.sort((a, b) => this.cheb(a, nearest) - this.cheb(b, nearest));
    await Abilities._resolveMinePlacement(unit, adjTiles[0].row, adjTiles[0].col);
    return true;
  },

  // ---------- UrgaMentes · Voluntad Quebrada: controla al rival más fuerte y le hace atacar a los suyos ----------
  async urgamentes(unit) {
    const adj = this.enemiesOf(unit).filter((u) => this.cheb(u, unit) <= 1);
    if (adj.length === 0) return false;
    const power = (u) => UNIT_TYPES[u.typeId].fuerza * 2 + u.hp;
    const target = adj.sort((a, b) => power(b) - power(a))[0];
    Abilities._resolveMindControl(unit, target);
    Units.deselect(); // la IA no "selecciona" nada
    await new Promise((r) => setTimeout(r, 500));
    // Una sola orden del controlado: atacar al rival más débil que alcance (los suyos de antes).
    const options = Combat.attackableEnemies(target).filter((o) => o.target.team !== target.team);
    if (options.length > 0) {
      options.sort((a, b) => a.target.hp - b.target.hp);
      await Combat.approachAndAttack(target, options[0].target);
    }
    return true; // Abilities.releaseMindControl() lo suelta al acabar el turno rival (ver abajo)
  },

  // ---------- ManosLargas · Dedos Largos: roba un objeto (o la pila de recurso más grande) ----------
  async manos_largas(unit) {
    const adj = this.enemiesOf(unit).filter((u) => this.cheb(u, unit) <= 1);
    for (const t of adj) {
      const entries = SurcaNubes.rivalEntries(t.team);
      if (entries.length === 0) continue;
      const item = entries.find((e) => e.kind === "item");
      const res = entries.filter((e) => e.kind === "resource").sort((a, b) => b.count - a.count)[0];
      const pick = item || res;
      if (!pick) continue;
      Units.faceTowardsTile(unit, t.row, t.col);
      SurcaNubes.stretchToward(unit, t);
      await new Promise((r) => setTimeout(r, 650));
      await SurcaNubes.stealFrom(unit, t, pick.kind, pick.kind === "resource" ? pick.resourceId : pick.itemId, null, null);
      return true;
    }
    return false;
  },

  // ---------- AlaFugaz · Aterrizaje Forzoso: cae junto a varios rivales (cuidado: se hace 1-3 de daño) ----------
  async ala_fugaz(unit) {
    const foes = this.enemiesOf(unit);
    if (foes.length === 0) return false;
    let best = null;
    for (let r = unit.row - 7; r <= unit.row + 7; r++)
      for (let c = unit.col - 7; c <= unit.col + 7; c++) {
        if (r === unit.row && c === unit.col) continue;
        if (!this.tileFree(r, c)) continue;
        const n = foes.filter((u) => this.cheb(u, { row: r, col: c }) <= 1).length;
        if (n > 0 && (!best || n > best.n)) best = { r, c, n };
      }
    if (!best) return false;
    // Se hará 1-3 de daño: solo si sobrevive seguro (>3) o si compensa el riesgo (2+ rivales con 2 de vida).
    const safe = unit.hp > 3;
    const worth = unit.hp > 1 && best.n >= 2 && Math.random() < 0.6;
    if (!safe && !worth) return false;
    await SurcaNubes.resolveForcedLanding(unit, best.r, best.c);
    return true;
  },

  // ---------- TrazaFlechas · Flecha Rastreadora: marca al rival más débil a su alcance ----------
  async trazaflechas(unit) {
    const foes = this.enemiesOf(unit).filter((u) => this.cheb(u, unit) <= Enmurallado.ARROW_RANGE);
    if (foes.length === 0) return false;
    foes.sort((a, b) => a.hp - b.hp);
    await Enmurallado.resolveTrackerArrow(unit, foes[0]);
    return true;
  },

  // ---------- MagoNífico · Cambiazo: se planta junto a un gnomo suelto o un tótem ajeno ----------
  async magonifico(unit) {
    if (unit.swapBond) return false;
    const foes = this.enemiesOf(unit).filter((u) => this.cheb(u, unit) >= 2);
    let best = null;
    for (const f of foes) {
      let score = 0;
      if (typeof Gnome !== "undefined") score += 2 * Gnome.list.filter((g) => !g.heldBy && Math.max(Math.abs(g.row - f.row), Math.abs(g.col - f.col)) <= 1).length;
      if (typeof Villages !== "undefined") score += 2 * Villages.list.filter((v) => v.owner !== unit.team && Math.max(Math.abs(v.row - f.row), Math.abs(v.col - f.col)) <= 1).length;
      score += this.enemiesOf(f).filter((u) => u !== f && this.cheb(u, f) <= 1).length === 0 ? 0 : 1;
      if (score >= 2 && (!best || score > best.score)) best = { f, score };
    }
    if (!best) return false;
    await Enmurallado.resolveSwap(unit, best.f);
    return true;
  },

  // ---------- PortaMuros · Muro Aplastante (área): con 2+ rivales alrededor, o uno al que remata ----------
  async portamuros(unit) {
    const adj = this.enemiesOf(unit).filter((u) => this.cheb(u, unit) <= 1);
    if (adj.length === 0) return false;
    if (adj.length < 2 && adj[0].hp > 1) return false; // un solo rival que no muere: se guarda el muro
    await Enmurallado.resolveCrush(unit);
    return true;
  },

  // ---------- NidoBot · Incubar: empieza a incubar con rivales cerca; suelta la explosión si compensa ----------
  async nidobot(unit) {
    const foes = this.enemiesOf(unit);
    if (!unit.incubating) {
      if (!foes.some((u) => this.cheb(u, unit) <= 7) || unit.hp < 3) return false;
      SurcaNubes.startIncubate(unit);
      return true;
    }
    const turns = unit.incubTurns || 0;
    if (turns < 1) return false;
    const n = Math.min(3, turns);
    const inR = (u) => this.cheb(u, unit) <= n;
    const hitFoes = foes.filter(inR).length;
    const hitAllies = this.alliesOf(unit).filter(inR).length;
    const selfDmg = [1, 2, 5][n - 1];
    const worth = hitFoes - hitAllies >= 1 && (selfDmg < unit.hp || hitFoes >= 2);
    // Ya cargado al máximo y nadie cerca: no malgasta la vida esperando para siempre.
    if (!worth) return false;
    await SurcaNubes.releaseIncubate(unit);
    return true;
  },
};

// Engancha con la IA: primero la habilidad, luego lo de siempre.
(function () {
  if (typeof Turns === "undefined") return;
  const orig = Turns._aiActOnce;
  Turns._aiActOnce = async function (unit) {
    try {
      if (await AIAbilities.tryUse(unit)) return true;
    } catch (e) {
      console.warn("[IA] habilidad", e);
    }
    return orig.call(this, unit);
  };
  const run = Turns._runEnemyTurn;
  Turns._runEnemyTurn = async function () {
    try {
      return await run.apply(this, arguments);
    } finally {
      if (typeof Abilities !== "undefined") Abilities.releaseMindControl(); // el control mental dura solo el turno de quien lo usa
    }
  };
})();

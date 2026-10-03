/* Gnomore Gnomes — Habilidades del Obelisco (árbol de mejoras permanentes).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Qué habilidades existen (SKILL_DEFS), cómo se conectan (3 ramas con el
       MISMO esquema de 5 niveles, ver SKILL_TREE_ROWS) y cuánto cuestan.
     - Qué ha comprado cada equipo (Skills.ranks) y qué se puede comprar
       ahora (Skills.status/Skills.buy), gastando Puntos de Gloria.
     - El EFECTO en el juego de cada habilidad: los ganchos que llaman
       combat.js/movement.js/etc. (moveCost, resolveDamage, refreshCohesion,
       refreshWalls, escudos...). Su interfaz vive aparte, en
       js/skillsui.js.

   Pedido explícito: "vamos a implementar ahora el boton de Habilidades del
   obelisco...3 pestañas: GUERRA (rojos), PROTECCIÓN (azules), SUPERVIVENCIA
   (verdes)...el jugador podra gastar puntos de victoria [Puntos de Gloria]
   para comprar habilidades que dan mejoras permanentes para esa partida...
   algunas tienen un unico nivel, otras hasta 3...conectadas por nodos igual
   que en la armeria...en algunos niveles hay bifurcaciones, el jugador solo
   puede elegir una rama, elegir una hara inaccesible la otra y para acceder
   al siguiente nivel de nodo la habilidad anterior debera tener todos sus
   niveles al maximo...Cada nivel cuesta 1 punto mas que el anterior" —
   el coste de CADA rango de una habilidad es el número de su nivel de nodos
   (nivel 1 = 1 punto, nivel 2 = 2 puntos por rango, ...). "las otras dos
   ramas tienen el mismo esquema de nodos, pero de momento estan vacias". */

// Nº de nodos por nivel del árbol, de arriba a abajo (1 = nodo único, 2 =
// bifurcación). Igual en las tres ramas.
const SKILL_TREE_ROWS = [1, 2, 1, 2, 1];

const SKILL_BRANCHES = [
  { id: "guerra", label: "GUERRA", accent: "#e6302f" },
  { id: "proteccion", label: "PROTECCIÓN", accent: "#2f7fe6" },
  { id: "supervivencia", label: "SUPERVIVENCIA", accent: "#3fb95a" },
];

// Los iconos reales llegarán después: se esperan en
// assets/iconos/habilidades/<id>.png (ver SKILL_ICON_DIR). Mientras no
// existan, la interfaz cae sola al glifo de Phosphor de `fallbackIcon`.
const SKILL_ICON_DIR = "assets/iconos/habilidades/";
const SKILL_SHIELD_ICON = "assets/iconos/escudo_activo.png";
const SKILL_ARROW_SPRITE = "assets/iconos/flecha.png"; // flecha de las Torretas

// level = fila del árbol (1-5), slot = columna dentro de esa fila (0/1).
const SKILL_DEFS = [
  {
    id: "raices",
    branch: "proteccion",
    level: 1,
    slot: 0,
    name: "Raíces",
    maxRank: 1,
    fallbackIcon: "ph-tree",
    describe: () =>
      "Tus tótems y tu Obelisco Ancestral echan raíces: a los personajes enemigos les cuesta 1 punto de movimiento extra por cada paso que den entrando, saliendo o moviéndose por las casillas adyacentes a ellos.",
  },
  {
    id: "piel_roca",
    branch: "proteccion",
    level: 2,
    slot: 0,
    name: "Piel de Roca",
    maxRank: 1,
    fallbackIcon: "ph-mountains",
    describe: () =>
      "Si un ataque fuese a matar a uno de tus personajes y llevas al menos 1 Roca en la mochila, se consume esa Roca y el personaje se queda con 1 punto de vida. Cada personaje solo puede usarlo una vez por turno.",
  },
  {
    id: "codo_con_codo",
    branch: "proteccion",
    level: 2,
    slot: 1,
    name: "Codo con Codo",
    maxRank: 3,
    fallbackIcon: "ph-users-three",
    describe: (rank) =>
      `Tus personajes ganan +1 de Aguante por cada aliado en una casilla adyacente, hasta un máximo de +${rank || 1} (+1 por nivel, hasta +3). El bonus desaparece en cuanto se separan.`,
  },
  {
    id: "evasion",
    branch: "proteccion",
    level: 3,
    slot: 0,
    name: "Evasión",
    maxRank: 3,
    fallbackIcon: "ph-wind",
    describe: (rank) =>
      `Tus personajes tienen un +${(rank || 1) * 10}% de probabilidad de esquivar un ataque enemigo cuerpo a cuerpo (+10% por nivel, hasta +30%).`,
  },
  {
    id: "muralla",
    branch: "proteccion",
    level: 4,
    slot: 0,
    name: "Muralla",
    maxRank: 3,
    fallbackIcon: "ph-castle-turret",
    describe: (rank) =>
      `Aumenta la vida máxima de tu Obelisco Ancestral y de los tótems bajo tu control en un +${(rank || 1) * 10}% (+10% por nivel, hasta +30%).`,
  },
  {
    id: "espinas",
    branch: "proteccion",
    level: 4,
    slot: 1,
    name: "Armadura de Espinas",
    maxRank: 1,
    fallbackIcon: "ph-spiral",
    describe: () =>
      "Cada vez que un enemigo golpea cuerpo a cuerpo a uno de tus personajes, recibe 1 punto de daño.",
  },
  {
    id: "escudos",
    branch: "proteccion",
    level: 5,
    slot: 0,
    name: "Escudos en Alto",
    maxRank: 1,
    fallbackIcon: "ph-shield-check",
    describe: () =>
      "Tus personajes ganan un escudo que anula el próximo ataque que reciban y después desaparece. Si empiezas tu turno con un personaje sin escudo en una casilla adyacente a uno de tus tótems o a tu Obelisco, el escudo se rearma.",
  },
  // ---------- Rama GUERRA ----------
  {
    id: "embestir",
    branch: "guerra",
    level: 1,
    slot: 0,
    name: "Embestir",
    maxRank: 1,
    fallbackIcon: "ph-lightning",
    describe: () =>
      "Una vez por turno, uno de tus personajes puede moverse y atacar a la vez gastando una única acción en lugar de dos. Se aplica solo al acercarse a un enemigo, a un tótem o a un Obelisco para golpearlo.",
  },
  {
    id: "camaradas",
    branch: "guerra",
    level: 2,
    slot: 0,
    name: "Camaradas",
    maxRank: 3,
    fallbackIcon: "ph-handshake",
    describe: (rank) =>
      `Tus ataques hacen +${rank || 1} de daño por cada aliado tuyo situado en una casilla adyacente al enemigo que vas a golpear (+1 por nivel, hasta +3 por aliado). El propio atacante no cuenta.`,
  },
  {
    id: "torretas",
    branch: "guerra",
    level: 2,
    slot: 1,
    name: "Torretas",
    maxRank: 1,
    fallbackIcon: "ph-crosshair",
    describe: () =>
      "Al final de tu turno, cada tótem bajo tu control dispara una flecha a los enemigos situados en casillas adyacentes a él y les hace 1 punto de daño.",
  },
  {
    id: "sed_sangre",
    branch: "guerra",
    level: 3,
    slot: 0,
    name: "Sed de Sangre",
    maxRank: 3,
    fallbackIcon: "ph-drop",
    describe: (rank) =>
      `Cada vez que un personaje mata a un enemigo, gana +1 de ataque durante su próximo turno. Se acumula hasta ${rank || 1} ${(rank || 1) === 1 ? "vez" : "veces"} (+1 por nivel, hasta 3) y el personaje se va tiñendo de rojo. Un turno sin matar reinicia la sed de sangre.`,
  },
  {
    id: "ultimo_aliento",
    branch: "guerra",
    level: 4,
    slot: 0,
    name: "Último Aliento",
    maxRank: 1,
    fallbackIcon: "ph-heartbeat",
    describe: () =>
      "Un personaje tuyo que se ha quedado con 1 punto de vida por haber recibido daño gana +1 de ataque. No se aplica a los personajes que tienen 1 de vida como vida máxima.",
  },
  {
    id: "emboscada",
    branch: "guerra",
    level: 4,
    slot: 1,
    name: "Emboscada",
    maxRank: 3,
    fallbackIcon: "ph-eye-slash",
    describe: (rank) =>
      `Un personaje tuyo que ataca desde dentro de un arbusto (se haya movido hasta él o no) gana +${rank || 1} de ataque en ese golpe (+1 por nivel, hasta +3).`,
  },
  {
    id: "punto_estrategico",
    branch: "guerra",
    level: 5,
    slot: 0,
    name: "Punto Estratégico",
    maxRank: 1,
    fallbackIcon: "ph-flag-banner",
    describe: () =>
      "Los tótems bajo tu control te permiten reclutar aliados como si fueran el Obelisco Ancestral: pulsa un tótem tuyo y aparecerá el icono de reclutar; el nuevo aliado aparece en una casilla adyacente al tótem. La población máxima sigue siendo la que marca el Obelisco.",
  },
  // ---------- Rama SUPERVIVENCIA ----------
  {
    id: "centinela",
    branch: "supervivencia",
    level: 1,
    slot: 0,
    name: "Centinela",
    maxRank: 1,
    fallbackIcon: "ph-eye",
    describe: () =>
      "Todas tus unidades, tus tótems y tu Obelisco Ancestral aumentan en 1 su percepción: ven una casilla más lejos y revelan más mapa.",
  },
  {
    id: "refuerzos",
    branch: "supervivencia",
    level: 2,
    slot: 0,
    name: "Refuerzos",
    maxRank: 3,
    fallbackIcon: "ph-users-four",
    describe: (rank) =>
      `Aumenta en +${rank || 1} la población máxima de tu ejército, es decir, cuántos personajes puedes tener a la vez (+1 por nivel, hasta +3).`,
  },
  {
    id: "anfibio",
    branch: "supervivencia",
    level: 2,
    slot: 1,
    name: "Anfibio",
    maxRank: 1,
    fallbackIcon: "ph-waves",
    describe: () =>
      "Tus personajes pueden caminar sobre las casillas de agua como si fueran de tierra: podrán moverse por ellas y atravesarlas.",
  },
  {
    id: "abundancia",
    branch: "supervivencia",
    level: 3,
    slot: 0,
    name: "Abundancia",
    maxRank: 3,
    fallbackIcon: "ph-coins",
    describe: (rank) =>
      `Cada tótem bajo tu control te da +${rank || 1} punto${(rank || 1) === 1 ? "" : "s"} de gloria extra al empezar tu turno (+1 por nivel, hasta +3 por tótem).`,
  },
  {
    id: "regateo",
    branch: "supervivencia",
    level: 4,
    slot: 0,
    name: "Regateo",
    maxRank: 1,
    fallbackIcon: "ph-tag",
    describe: () =>
      "Todos los productos de la Tienda Goblin cuestan la mitad, redondeando hacia abajo (nunca menos de 1 punto de gloria).",
  },
  {
    id: "recolector",
    branch: "supervivencia",
    level: 4,
    slot: 1,
    name: "Recolector",
    maxRank: 3,
    fallbackIcon: "ph-basket",
    describe: (rank) =>
      `Todas las fuentes de recursos te dan +${rank || 1} unidad${(rank || 1) === 1 ? "" : "es"} extra al recogerlas (+1 por nivel, hasta +3).`,
  },
  {
    id: "uno_con_la_tierra",
    branch: "supervivencia",
    level: 5,
    slot: 0,
    name: "Uno con la Tierra",
    maxRank: 1,
    fallbackIcon: "ph-plant",
    describe: () =>
      "Al comienzo de cada uno de tus turnos, todas tus unidades se curan 1 punto de vida por cada tótem bajo tu control (sin superar su vida máxima).",
  },
];

const Skills = {
  // ranks[team][skillId] = rango comprado (0..maxRank)
  ranks: { player: {}, enemy: {} },

  resetAll() {
    this.ranks = Teams.keyed(() => ({}));
    this.chargeUsed = Teams.keyed(false);
    if (typeof SkillsUI !== "undefined") SkillsUI.onReset();
  },

  // ---------- Consulta del árbol ----------
  def(id) {
    return SKILL_DEFS.find((d) => d.id === id) || null;
  },

  // Matriz [nivel][slot] de la rama: SKILL_DEFS o null (hueco vacío).
  layout(branchId) {
    return SKILL_TREE_ROWS.map((count, i) =>
      Array.from({ length: count }, (_, slot) =>
        SKILL_DEFS.find((d) => d.branch === branchId && d.level === i + 1 && d.slot === slot) || null
      )
    );
  },

  rank(team, id) {
    return (this.ranks[team] && this.ranks[team][id]) || 0;
  },

  has(team, id) {
    return this.rank(team, id) > 0;
  },

  cost(def) {
    return def.level + 1; // nivel 1 = 2 puntos, nivel 2 = 3...
  },

  // Estado de un nodo para `team`:
  //   maxed     — todos sus rangos comprados
  //   partial   — comprado alguno pero no todos (sigue siendo comprable)
  //   available — se puede empezar a comprar
  //   blocked   — el jugador eligió la otra rama de la bifurcación
  //   locked    — falta llevar al máximo la habilidad anterior
  status(team, def) {
    const rank = this.rank(team, def.id);
    if (rank >= def.maxRank) return "maxed";
    const rows = this.layout(def.branch);
    const siblings = rows[def.level - 1].filter((d) => d && d.id !== def.id);
    if (rank === 0 && siblings.some((s) => this.rank(team, s.id) > 0)) return "blocked";
    if (def.level > 1) {
      const prevRow = rows[def.level - 2].filter(Boolean);
      // "para acceder al siguiente nivel de nodo la habilidad anterior debera
      // tener todos sus niveles al maximo": basta con que UNA del nivel
      // anterior (la elegida en una bifurcación) esté al máximo.
      const prevOk = prevRow.some((p) => this.rank(team, p.id) >= p.maxRank);
      if (!prevOk) return "locked";
    }
    return rank > 0 ? "partial" : "available";
  },

  // Texto que explica por qué un nodo no se puede comprar (para la caja de
  // descripción).
  lockReason(team, def) {
    const st = this.status(team, def);
    const rows = this.layout(def.branch);
    if (st === "blocked") {
      const chosen = rows[def.level - 1].find((d) => d && d.id !== def.id && this.rank(team, d.id) > 0);
      return `Bloqueada: has elegido ${chosen ? chosen.name : "la otra rama"}.`;
    }
    if (st === "locked") {
      const prev = rows[def.level - 2].filter(Boolean).map((p) => p.name).join(" o ");
      return `Bloqueada: lleva ${prev} al máximo primero.`;
    }
    return "";
  },

  // ---------- Compra ----------
  canBuy(team, def) {
    const st = this.status(team, def);
    if (st !== "available" && st !== "partial") return { ok: false, reason: "locked" };
    const points = typeof Glory !== "undefined" ? Glory.points[team] : 0;
    if (points < this.cost(def)) return { ok: false, reason: "points" };
    return { ok: true };
  },

  buy(team, id) {
    const def = this.def(id);
    if (!def) return false;
    if (!this.canBuy(team, def).ok) return false;
    Glory.spend(team, this.cost(def));
    this.ranks[team][id] = this.rank(team, id) + 1;
    this._applyPurchase(team, id);
    return true;
  },

  // La IA invierte la gloria sobrante en habilidades (se llama al final de su
  // turno, después de reclutar y comprar en la tienda). Prefiere terminar la
  // que ya tiene empezada; si no, la de menor nivel. Devuelve true si compró.
  attemptAutoBuy(team) {
    const options = SKILL_DEFS.filter((d) => this.canBuy(team, d).ok);
    if (options.length === 0) return false;
    const partial = options.filter((d) => this.rank(team, d.id) > 0);
    const pool = partial.length ? partial : options;
    const minLevel = Math.min(...pool.map((d) => d.level));
    const best = pool.filter((d) => d.level === minLevel);
    const pick = best[Math.floor(Math.random() * best.length)];
    return this.buy(team, pick.id);
  },

  _applyPurchase(team, id) {
    if (id === "centinela") this._refreshPerception(team);
    if (id === "refuerzos" && typeof Obelisks !== "undefined") Obelisks.refreshAll();
    if (id === "codo_con_codo" || id === "raices") this.refreshCohesion();
    if (typeof Glory !== "undefined") Glory.refreshPreview(team);
    if (id === "muralla") this.refreshWalls();
    if (id === "escudos") {
      Units.list.filter((u) => u.team === team).forEach((u) => this.setShield(u, true));
    }
  },

  // ---------- RAÍCES: coste de movimiento ----------
  // Puntos "ancla" (tótems y Obelisco) de los equipos que tienen Raíces y
  // son RIVALES de `team`.
  _rootAnchorsAgainst(team) {
    const anchors = [];
    Teams.all.forEach((owner) => {
      if (owner === team || !this.has(owner, "raices")) return;
      if (typeof Obelisks !== "undefined") {
        const o = Obelisks.byTeam(owner);
        if (o) anchors.push(o);
      }
      if (typeof Villages !== "undefined") Villages.list.filter((v) => v.owner === owner).forEach((v) => anchors.push(v));
    });
    return anchors;
  },

  // Coste total en puntos de movimiento de llegar en línea recta a
  // (row, col): 1 por casilla (distancia Chebyshev) + 1 extra por cada paso
  // cuya casilla de origen o de destino sea adyacente a un ancla enemiga
  // con Raíces.
  moveCost(unit, row, col) {
    const dist = Math.max(Math.abs(row - unit.row), Math.abs(col - unit.col));
    const anchors = this._rootAnchorsAgainst(unit.team);
    if (anchors.length === 0) return dist;
    const rooted = (r, c) => anchors.some((a) => Math.max(Math.abs(a.row - r), Math.abs(a.col - c)) <= 1);
    let extra = 0;
    let prev = { row: unit.row, col: unit.col };
    Units.stepPath(unit.row, unit.col, row, col).forEach((step) => {
      if (rooted(prev.row, prev.col) || rooted(step.row, step.col)) extra++;
      prev = step;
    });
    return dist + extra;
  },

  // Sprite de raíces palpitando bajo cada unidad que sufre el efecto
  // (está en una casilla adyacente a un tótem/Obelisco rival con Raíces).
  refreshRoots() {
    if (typeof Units === "undefined") return;
    Units.list.forEach((unit) => {
      if (!unit.el) return;
      const anchors = this._rootAnchorsAgainst(unit.team);
      const on = anchors.some((a) => Math.max(Math.abs(a.row - unit.row), Math.abs(a.col - unit.col)) <= 1);
      if (on && !unit.rootsEl) {
        const img = document.createElement("img");
        img.className = "unit__roots";
        img.src = "assets/decals/raices.png";
        img.alt = "";
        img.draggable = false;
        unit.el.insertBefore(img, unit.el.firstChild);
        unit.rootsEl = img;
      } else if (!on && unit.rootsEl) {
        unit.rootsEl.remove();
        unit.rootsEl = null;
      }
    });
  },

  // ---------- CODO CON CODO: aguante por vecinos aliados ----------
  refreshCohesion() {
    if (typeof Units === "undefined") return;
    this.refreshRoots();
    Units.list.forEach((unit) => {
      let bonus = 0;
      const rank = this.rank(unit.team, "codo_con_codo");
      if (rank > 0) {
        const adjacent = Units.list.filter(
          (o) =>
            o.id !== unit.id &&
            o.team === unit.team &&
            Math.max(Math.abs(o.row - unit.row), Math.abs(o.col - unit.col)) <= 1
        ).length;
        bonus = Math.min(adjacent, rank);
      }
      const prev = unit.cohesionBonus || 0;
      if (bonus === prev) return;
      // "+1" AZUL sobre cada aliado adyacente que aporta el aguante extra.
      if (bonus > prev && this._cohesionAnnounce !== false) {
        Units.list
          .filter((o) => o.id !== unit.id && o.team === unit.team &&
            Math.max(Math.abs(o.row - unit.row), Math.abs(o.col - unit.col)) <= 1)
          .slice(0, bonus - prev)
          .filter((o) => !o.el.classList.contains("unit--fog-hidden"))
          .forEach((o) => Units.spawnFloatingText(o, "+1", { className: "dmg-popup skill-popup--codo" }));
      }
      unit.cohesionBonus = bonus;
      this.setMaxHp(unit, unit.maxHp + (bonus - prev), { minHp: 1 });
    });
  },

  // Cambia la vida máxima de cualquier entidad con barra seccionada
  // (personaje, tótem, Obelisco): crea/quita segmentos, cura lo ganado y
  // recorta la vida si la nueva máxima es menor.
  setMaxHp(ent, newMax, { minHp = 1 } = {}) {
    const delta = newMax - ent.maxHp;
    if (delta === 0 || !ent.hpBarEl || !ent.hpSegmentEls) return;
    if (delta > 0) {
      for (let i = 0; i < delta; i++) {
        const seg = document.createElement("div");
        seg.className = "unit__hpbar-segment";
        ent.hpBarEl.appendChild(seg);
        ent.hpSegmentEls.push(seg);
      }
      ent.maxHp = newMax;
      if (ent.hp > 0) ent.hp += delta;
    } else {
      for (let i = 0; i < -delta; i++) {
        const seg = ent.hpSegmentEls.pop();
        if (seg) seg.remove();
      }
      ent.maxHp = newMax;
      if (ent.hp > 0) ent.hp = Math.max(minHp, Math.min(ent.hp, newMax));
    }
    Units.updateHpBar(ent);
  },

  // ---------- MURALLA: vida del Obelisco y los tótems ----------
  _wallMax(baseMax, team) {
    const rank = team && team !== "neutral" ? this.rank(team, "muralla") : 0;
    return baseMax + (rank > 0 ? Math.max(1, Math.round(baseMax * 0.1 * rank)) : 0);
  },

  refreshWalls() {
    if (typeof Obelisks !== "undefined") {
      Obelisks.list.forEach((o) => this.setMaxHp(o, this._wallMax(OBELISK_MAX_HP, o.team)));
    }
    if (typeof Villages !== "undefined") {
      Villages.list.forEach((v) => this.setMaxHp(v, this._wallMax(VILLAGE_MAX_HP, v.owner)));
    }
  },

  // ---------- ESCUDOS EN ALTO ----------
  setShield(unit, on) {
    unit.shielded = !!on;
    if (on && !unit.shieldEl && unit.el) {
      const img = document.createElement("img");
      img.className = "unit__shield-icon";
      img.src = SKILL_SHIELD_ICON;
      img.alt = "";
      img.draggable = false;
      unit.el.appendChild(img);
      unit.shieldEl = img;
    }
    if (unit.shieldEl) unit.shieldEl.classList.toggle("unit__shield-icon--on", !!on);
  },

  // Personaje recién creado (Units.spawnUnit): hereda lo que ya tenga
  // comprado su equipo.
  // ---------- Rama GUERRA ----------

  // Embestir: una vez por turno (por equipo) un personaje se mueve y ataca
  // gastando UNA sola acción en total.
  chargeUsed: { player: false, enemy: false },
  chargeReady(unit) {
    return this.has(unit.team, "embestir") && !this.chargeUsed[unit.team];
  },
  // ¿Puede `unit` acercarse a un objetivo y golpearlo este turno? Sin
  // Embestir hacen falta 2 acciones (mover + golpear); con ella basta 1.
  canApproachAttack(unit) {
    if (typeof Turns === "undefined") return true;
    const left = Turns.remainingActions(unit);
    return left >= 2 || (left >= 1 && this.chargeReady(unit));
  },
  // Paga el desplazamiento previo al golpe: gratis si Embestir está
  // disponible (y se marca como usado este turno), una acción si no.
  spendApproach(unit) {
    if (typeof Turns === "undefined") return;
    if (this.chargeReady(unit)) {
      this.chargeUsed[unit.team] = true;
      if (typeof Units !== "undefined") Units.spawnFloatingText(unit, "¡Embestida!", { className: "dmg-popup" });
      return;
    }
    Turns.useAction(unit);
  },

  // Ataque extra de `attacker` contra `target` (unidad, tótem u obelisco).
  attackBonus(attacker, target, { announce = false } = {}) {
    if (!attacker || typeof Units === "undefined") return 0;
    const team = attacker.team;
    let bonus = 0;
    const camaradas = this.rank(team, "camaradas");
    if (camaradas > 0 && target) {
      const allyUnits = Units.list.filter(
        (u) =>
          u.team === team &&
          u.id !== attacker.id &&
          Math.max(Math.abs(u.row - target.row), Math.abs(u.col - target.col)) <= 1
      );
      const allies = allyUnits.length;
      bonus += camaradas * allies;
      // "+N" ROJO sobre cada aliado que aporta el daño extra (solo al golpear de verdad).
      if (announce) allyUnits.filter((u) => !u.el.classList.contains("unit--fog-hidden")).forEach((u) => Units.spawnFloatingText(u, `+${camaradas}`, { className: "dmg-popup skill-popup--camaradas" }));
    }
    if (this.rank(team, "sed_sangre") > 0) bonus += attacker.bloodStacks || 0;
    if (this.has(team, "ultimo_aliento") && attacker.hp === 1 && (attacker.maxHp || 1) > 1) bonus += 1;
    if (this.has(team, "emboscada") && typeof Bushes !== "undefined" && Bushes.isHidingUnit(attacker)) bonus += this.rank(team, "emboscada");
    return bonus;
  },

  // Sed de Sangre: se anota la baja; al empezar el siguiente turno de su
  // equipo se convierte en un punto de ataque (o se reinicia si no hubo).
  onKill(attacker) {
    if (!attacker || !this.has(attacker.team, "sed_sangre")) return;
    attacker.bloodPending = (attacker.bloodPending || 0) + 1;
  },
  _tickBloodlust(team) {
    if (typeof Units === "undefined") return;
    const max = this.rank(team, "sed_sangre");
    Units.list
      .filter((u) => u.team === team)
      .forEach((u) => {
        const before = u.bloodStacks || 0;
        if (max > 0 && u.bloodPending) u.bloodStacks = Math.min(max, before + u.bloodPending);
        else u.bloodStacks = 0;
        u.bloodPending = 0;
        this.refreshBloodTint(u);
      });
  },
  refreshBloodTint(unit) {
    if (!unit.el) return;
    for (let i = 1; i <= 3; i++) unit.el.classList.toggle(`unit--bloodlust-${i}`, (unit.bloodStacks || 0) === i);
  },

  // Torretas: al terminar el turno de `team`, sus tótems disparan una
  // flecha (1 de daño) a cada enemigo adyacente.
  async onTurnEnd(team) {
    if (!this.has(team, "torretas") || typeof Villages === "undefined" || typeof Units === "undefined") return;
    const totems = Villages.list.filter((v) => v.owner === team);
    for (const totem of totems) {
      const targets = Units.list.filter(
        (u) =>
          u.team !== team &&
          Math.max(Math.abs(u.row - totem.row), Math.abs(u.col - totem.col)) <= 1 &&
          !(typeof Bushes !== "undefined" && Bushes.isHiddenFromTeam(u.row, u.col, team))
      );
      for (const target of targets) {
        if (!Units.list.includes(target)) continue;
        await this._fireArrow(team, totem, target);
      }
    }
  },
  async _fireArrow(team, totem, target) {
    Units.faceTowardsTile(target, totem.row, totem.col);
    // Retroceso sutil del tótem al disparar
    if (totem.spriteEl && totem.spriteEl.animate) {
      totem.spriteEl.animate(
        [{ transform: "scale(1,1)" }, { transform: "scale(1.08,0.94)" }, { transform: "scale(1,1)" }],
        { duration: 260, easing: "ease-out" }
      );
    }
    await this._flyArrow(totem, target);
    const outcome = this.resolveDamage(target, 1, { melee: false });
    if (!outcome.prevented && target.hp <= 0) {
      if (typeof Glory !== "undefined") Glory.queueKillBonus(team);
      await Units.removeUnit(target);
      if (typeof Gnome !== "undefined") await Gnome.dropHeldBy(target);
    }
    await new Promise((r) => setTimeout(r, 160));
  },
  _flyArrow(totem, target) {
    return new Promise((resolve) => {
      if (!totem.el || !target.el) return resolve();
      const a = totem.spriteEl.getBoundingClientRect();
      const b = target.el.getBoundingClientRect();
      const start = { x: a.left + a.width / 2, y: a.top + a.height * 0.35 };
      const end = { x: b.left + b.width / 2, y: b.top + b.height * 0.45 };
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const dist = Math.hypot(dx, dy);
      const duration = Math.min(700, 260 + dist * 0.9);
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const el = document.createElement("img");
      el.src = SKILL_ARROW_SPRITE;
      el.className = "torreta-arrow";
      el.draggable = false;
      el.alt = "";
      document.body.appendChild(el);
      if (typeof SFX !== "undefined") SFX.gnomeFly(duration / 1000, 1.9);
      const arc = Math.min(40, dist * 0.18);
      const t0 = performance.now();
      let px = start.x;
      let py = start.y;
      let rot = angle;
      const step = (now) => {
        const t = Math.min(1, (now - t0) / duration);
        const x = start.x + dx * t;
        const y = start.y + dy * t - Math.sin(t * Math.PI) * arc;
        // La flecha encara siempre su dirección real de vuelo (con la parábola)
        if (Math.hypot(x - px, y - py) > 0.5) rot = (Math.atan2(y - py, x - px) * 180) / Math.PI;
        px = x;
        py = y;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.transform = `translate(-50%, -50%) rotate(${rot}deg)`;
        if (t < 1) requestAnimationFrame(step);
        else {
          el.remove();
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  },

  // ---------- Rama SUPERVIVENCIA ----------

  // Centinela: +1 de percepción (unidades, tótems y Obelisco).
  perceptionBonus(team) {
    return this.has(team, "centinela") ? 1 : 0;
  },
  // Al comprarlo se revela ya el terreno extra alrededor de todo lo propio.
  _refreshPerception(team) {
    if (team !== "player" || typeof Fog === "undefined") return;
    if (typeof Units !== "undefined") Units.list.filter((u) => u.team === team).forEach((u) => Fog.revealForUnit(u));
    if (typeof Villages !== "undefined") {
      Villages.list.filter((v) => v.owner === team).forEach((v) => Fog.revealAround(v.row, v.col, FOG_VILLAGE_PERCEPTION_RADIUS + 1));
    }
    if (typeof Obelisks !== "undefined") {
      const o = Obelisks.byTeam(team);
      if (o) Fog.revealAround(o.row, o.col, FOG_OBELISK_PERCEPTION_RADIUS + 1);
    }
    Fog.applyVisibility();
  },

  // Anfibio: el agua cuenta como suelo transitable para ese equipo.
  walkableFor(team, row, col) {
    if (typeof TerrainMap === "undefined") return true;
    return TerrainMap.isWalkable(row, col) || this.has(team, "anfibio");
  },

  // Regateo: mitad de precio redondeando por abajo (mínimo 1).
  shopPrice(team, price) {
    return this.has(team, "regateo") ? Math.max(1, Math.floor(price / 2)) : price;
  },

  // Uno con la Tierra: al empezar el turno, cada unidad se cura 1 punto por
  // cada tótem propio.
  _healFromTotems(team) {
    if (!this.has(team, "uno_con_la_tierra") || typeof Units === "undefined" || typeof Villages === "undefined") return;
    const n = Villages.ownedCount(team);
    if (n <= 0) return;
    Units.list
      .filter((u) => u.team === team && u.hp < (u.maxHp || u.hp))
      .forEach((u) => {
        const gained = Math.min(n, u.maxHp - u.hp);
        u.hp += gained;
        Units.updateHpBar(u);
        Units.spawnFloatingText(u, `+${gained}`, { className: "dmg-popup gnome-points-popup" });
      });
  },

  onUnitSpawn(unit) {
    if (this.has(unit.team, "escudos")) this.setShield(unit, true);
    this.refreshCohesion();
  },

  onUnitRemoved() {
    this.refreshCohesion();
  },

  // Al empezar el turno de `team`: rearma el escudo de quien esté junto a
  // uno de sus tótems o su Obelisco.
  onTurnStart(team) {
    this.chargeUsed[team] = false;
    this._tickBloodlust(team);
    this._healFromTotems(team);
    if (!this.has(team, "escudos") || typeof Units === "undefined") return;
    const anchors = [];
    if (typeof Obelisks !== "undefined") {
      const o = Obelisks.byTeam(team);
      if (o) anchors.push(o);
    }
    if (typeof Villages !== "undefined") Villages.list.filter((v) => v.owner === team).forEach((v) => anchors.push(v));
    Units.list
      .filter((u) => u.team === team && !u.shielded)
      .forEach((u) => {
        if (anchors.some((a) => Math.max(Math.abs(a.row - u.row), Math.abs(a.col - u.col)) <= 1)) {
          this.setShield(u, true);
          Units.spawnFloatingText(u, "¡Escudo!", { className: "dmg-popup" });
        }
      });
  },

  hasThorns(unit) {
    return this.has(unit.team, "espinas");
  },

  // ---------- Daño recibido por un personaje ----------
  // Único punto por el que pasa el daño de ataques/misiles/explosiones a
  // personajes, para aplicar en el mismo orden: Evasión (solo cuerpo a
  // cuerpo) -> Escudo -> Piel de Roca (si el golpe fuese mortal) -> daño.
  // Devuelve { prevented, reason }: si prevented es true, el golpe NO ha
  // hecho daño (ya se ha dado el feedback visual/sonoro).
  resolveDamage(target, damage, { melee = false } = {}) {
    const team = target.team;

    const evasion = this.rank(team, "evasion");
    if (melee && evasion > 0 && Math.random() < evasion * 0.1) {
      Units.spawnFloatingText(target, "¡Esquiva!", { className: "dmg-popup" });
      if (typeof SFX !== "undefined" && SFX.hover) SFX.hover();
      return { prevented: true, reason: "evasion" };
    }

    if (target.shielded) {
      this.setShield(target, false);
      Units.spawnFloatingText(target, "¡Bloqueado!", { className: "dmg-popup" });
      Units.playShake(target);
      if (typeof SFX !== "undefined") SFX.hit();
      return { prevented: true, reason: "shield" };
    }

    const round = typeof Turns !== "undefined" ? Turns.roundNumber : 0;
    if (
      target.hp - damage <= 0 &&
      this.has(team, "piel_roca") &&
      target.stoneSkinRound !== round &&
      this._spendRock(team)
    ) {
      target.stoneSkinRound = round;
      target.hp = 1;
      Units.updateHpBar(target);
      Units.spawnFloatingText(target, "¡Piel de Roca!", { className: "dmg-popup" });
      Units.playShake(target);
      if (typeof SFX !== "undefined") SFX.hit();
      return { prevented: true, reason: "stone" };
    }

    target.hp = Math.max(0, target.hp - damage);
    Units.updateHpBar(target);
    Units.spawnFloatingText(target, `-${damage}`, { className: "dmg-popup" });
    Units.playShake(target);
    if (typeof SFX !== "undefined") SFX.hit();
    return { prevented: false };
  },

  // "Si llevas una piedra en la mochila": el recurso "roca" del equipo.
  _spendRock(team) {
    if (typeof Resources === "undefined") return false;
    const counts = Resources.countsFor(team);
    if (!counts || (counts.roca || 0) < 1) return false;
    counts.roca -= 1;
    if (team === "player" && typeof Backpack !== "undefined" && Backpack.refreshResourceBadges) {
      Backpack.refreshResourceBadges();
    }
    return true;
  },
};

if (typeof Turns !== "undefined") Turns.registerTurnStartListener(Skills);

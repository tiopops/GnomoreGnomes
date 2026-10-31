/* Gnomore Gnomes — Tutoriales de nivel (Bosque MushBoom y Colinas Rock'n Troll)
   y submenú del botón Tutorial.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - El submenú que se abre al pulsar "Tutorial" en el menú principal
       (Primeros pasos / Tutorial Bosque MushBoom / Tutorial Colinas Rock'n Troll).
     - La escena de práctica de cada nivel y su guion de misiones, con el
       mismo motor de js/tutorial.js (Nizak, misiones, puntero, bloqueo...).
   Cada guion arranca con una breve historia de la zona (con el humor de
   Nizak) y luego explica y hace practicar las 3 mecánicas especiales del
   nivel. Los textos están en español; js/translate.js los pasa al inglés. */

Object.assign(Tutorial, {
  _scenario: "basic",

  // ---------- Selección de tutorial (pantalla propia, como nivel/raza/rivales) ----------
  _CARDS: [
    {
      id: "basic",
      name: "Primeros pasos",
      color: "#e8b33a",
      island: "assets/niveles/isla_mushboom_forest.png",
      flavor: "Lo básico del juego, paso a paso, con Nizak como guía.",
      feats: [
        ["ph-users-three", "Reclutar: tu Obelisco, tus unidades y los Puntos de Gloria"],
        ["ph-sneaker-move", "Mover y esconderte: casillas, acciones y arbustos"],
        ["ph-boxing-glove", "Gnomos y combate: coger, golpear, lanzar y conquistar un tótem"],
      ],
    },
    {
      id: "mush",
      name: "Bosque MushBoom",
      color: "#8fbf4d",
      island: "assets/niveles/isla_mushboom_forest.png",
      flavor: "Las reglas propias del Bosque MushBoom.",
      feats: [
        ["ph-bomb", "Setas explosivas: cógelas antes de que exploten"],
        ["ph-skull", "Altar de Sacrificios: ofrece setas y gnomos"],
        ["ph-sword", "GnomOgro: el gigante que despierta bajo el altar"],
      ],
    },
    {
      id: "rock",
      name: "Colinas Rock'n Troll",
      color: "#8a8f99",
      island: "assets/niveles/isla_colinas_rockntroll.png",
      flavor: "Las reglas propias de las Colinas Rock'n Troll.",
      feats: [
        ["ph-music-notes", "Tambores de Guerra: llena tu ruleta y haz llover rocas"],
        ["ph-cube", "Fragmentos: recógelos y lánzalos"],
        ["ph-fire", "El Volcán: aliméntalo y haz que entre en erupción"],
      ],
    },
    {
      id: "crane",
      name: "Poblado HurryCrane",
      color: "#7fc8e8",
      island: "assets/niveles/isla_hurrycrane_village.png?v=2",
      flavor: "Las reglas propias del Poblado HurryCrane.",
      feats: [
        ["ph-egg", "Huevo de Grulla: cada rebote lo carga hasta explotar"],
        ["ph-target", "Bumpers, tótems y obeliscos: rebotes de pinball y carambolas"],
        ["ph-trophy", "La Grulla: equilibra la partida y bloquea un obelisco"],
      ],
    },
    {
      id: "wall",
      name: "Fortaleza WallForge",
      color: "#ff8a1f",
      island: "assets/niveles/isla_wallforge.png",
      flavor: "Las reglas propias de la Fortaleza WallForge.",
      feats: [
        ["ph-lock-key", "Cámara sellada: mareando guardias y rompiendo cadenas"],
        ["ph-scroll", "Reliquia Paranoica: coge la Reliquia y pisa páginas"],
        ["ph-flag-checkered", "Entrega y sacrificio: cobra junto a tu obelisco"],
      ],
    },
  ],

  // ---------- Tutoriales completados (check verde en la selección; se pueden repetir siempre) ----------
  _DONE_KEY: "gg_tutorials_done",
  _doneMap() {
    try {
      return JSON.parse(localStorage.getItem(this._DONE_KEY) || "{}") || {};
    } catch (e) {
      return {};
    }
  },
  isDone(id) {
    return !!this._doneMap()[id];
  },
  // Solo al llegar al final del guion (saltar el tutorial no lo marca).
  _markDone() {
    try {
      const m = this._doneMap();
      m[this._scenario] = true;
      localStorage.setItem(this._DONE_KEY, JSON.stringify(m));
    } catch (e) {}
  },

  showMenu() {
    if (this.active) return;
    const list = document.getElementById("tutorial-list");
    if (!list) return;
    const tr = (t) => (typeof I18N !== "undefined" && I18N.tr ? I18N.tr(t) : t);
    const items = [
      { id: "basic", icon: "ph-graduation-cap", title: "Primeros pasos", sub: "Lo básico: reclutar, mover, gnomos y combate" },
      { id: "mush", icon: "ph-tree", title: "Tutorial Bosque MushBoom", sub: "Setas explosivas, Altar de Sacrificios y GnomOgro" },
      { id: "rock", icon: "ph-mountains", title: "Tutorial Colinas Rock'n Troll", sub: "Tambores de Guerra, fragmentos y Volcán" },
      { id: "crane", icon: "ph-egg", title: "Tutorial Poblado HurryCrane", sub: "Huevo de Grulla, bumpers y la Grulla" },
      { id: "wall", icon: "ph-castle-turret", title: "Tutorial Fortaleza WallForge", sub: "Guardias, cámara sellada y Reliquia Paranoica" },
    ];
    list.innerHTML = items
      .map(
        (it) => {
          const done = this.isDone(it.id);
          return `<button type="button" class="menu-btn tut-menu__item${done ? " tut-menu__item--done" : ""}" data-scenario="${it.id}">
          <i class="ph ${it.icon}"></i>
          <span class="tut-menu__text"><span class="tut-menu__name">${tr(it.title)}</span><span class="tut-menu__sub">${tr(it.sub)}</span></span>
          ${done ? `<span class="tut-menu__done" title="${tr("Completado")}" aria-label="${tr("Completado")}"><i class="ph-bold ph-check"></i></span>` : ""}
        </button>`;
        }
      )
      .join("");
    list.querySelectorAll(".tut-menu__item").forEach((b) =>
      b.addEventListener("click", () => {
        if (typeof SFX !== "undefined") SFX.click();
        this.start(b.dataset.scenario);
      })
    );
    goToScreen("screen-tutorial-select");
  },

  // ---------- Escena de práctica (todos los tutoriales de nivel) ----------
  _myUnit() {
    return Units.list.find((u) => u.id === this._ctx.unitId) || this._my()[0] || null;
  },

  _setupLevelScene() {
    // Sin tótems de práctica: aquí no se usan.
    if (typeof Villages !== "undefined") {
      Villages.list.forEach((v) => v.el && v.el.remove());
      Villages.list = [];
    }
    this._ctx.villageId = null;
    if (this._scenario === "wall") {
      this._buildWallScene();
      if (typeof Fog !== "undefined") Fog.applyVisibility();
      this._refill();
      return;
    }
    // Una unidad propia ya lista junto al Obelisco (en estos tutoriales no se recluta).
    const spot = this._spotAt(2, [[1, 1], [1, 0], [0, 1], [1, -1], [-1, 1]]);
    const u = Units.spawnUnit({ typeId: "seta_artificiero", row: spot.row, col: spot.col, team: "player" });
    this._ctx.unitId = u.id;
    if (typeof Fog !== "undefined") Fog.revealForUnit(u);
    if (this._scenario === "mush") this._buildMushScene();
    else if (this._scenario === "crane") this._buildCraneScene();
    else this._buildRockScene();
    if (typeof Fog !== "undefined") Fog.applyVisibility();
    this._refill();
  },

  // Casilla libre lo más cercana posible a origin+(dr,dc). Mover en diagonal
  // (dr=-dc) abre el escenario en horizontal en pantalla, para que todo quepa.
  _around(origin, dr, dc) {
    let best = null;
    for (let r = 0; r < Units.boardSize; r++) {
      for (let c = 0; c < Units.boardSize; c++) {
        if (!this._tileOk(r, c) || this._entityNear(r, c, 0)) continue;
        const d = Math.hypot(r - (origin.row + dr), c - (origin.col + dc));
        if (!best || d < best.d) best = { row: r, col: c, d };
      }
    }
    return best;
  },

  _buildMushScene() {
    const u = this._myUnit();
    if (typeof Mushrooms !== "undefined") {
      Mushrooms.resetAll();
      Mushrooms.active = false; // sin setas nuevas por su cuenta: solo las que pone el guion
    }
    Altar.resetAll();
    const s = this._around(u, -2, 2);
    if (s) {
      this._ctx.altar = Altar._create(s.row, s.col);
      if (Altar._clearTileFor) Altar._clearTileFor(s.row, s.col);
    }
  },

  _buildRockScene() {
    const u = this._myUnit();
    Drums.resetAll();
    Volcano.resetAll();
    const ds = this._around(u, -2, 2);
    if (ds) this._ctx.drum = Drums._create(ds.row, ds.col);
    const vs = this._around(u, 3, -3);
    if (vs) this._ctx.volcano = Volcano._create(vs.row, vs.col);
    this._ctx.drumRef = this._ctx.drum;
  },

  _buildCraneScene() {
    const u = this._myUnit();
    if (typeof Drums !== "undefined") Drums.resetAll();
    if (typeof Volcano !== "undefined") Volcano.resetAll();
    if (typeof Bumpers !== "undefined") Bumpers.resetAll();
    Egg.resetAll();
    // Huevo en línea recta con la unidad (misma fila): el vuelo es ortogonal y rebota de frente contra los bumpers.
    const es = this._around(u, 0, 2);
    if (es) {
      this._ctx.eggDir = [es.row - u.row > 0 ? 1 : -1, es.col - u.col > 0 ? 1 : -1];
      Egg.egg = Egg._createEgg(es.row, es.col);
      this._ctx.eggSpot = { row: es.row, col: es.col };
    }
  },

  // Fortaleza WallForge: cámara sellada con sus guardias en el centro y una unidad propia a tiro (3 casillas del altar).
  _buildWallScene() {
    if (typeof Drums !== "undefined") Drums.resetAll();
    if (typeof Volcano !== "undefined") Volcano.resetAll();
    Reliquia.resetAll();
    Reliquia.spawn(Units.boardSize);
    const a = Reliquia.altar;
    const ob = Obelisks.byTeam("player");
    let best = null, any = null;
    for (let r = 0; r < Units.boardSize; r++) {
      for (let c = 0; c < Units.boardSize; c++) {
        if (!a || !this._tileOk(r, c) || Reliquia._cheb({ row: r, col: c }, a) !== 3) continue;
        const d = Math.hypot(r - ob.row, c - ob.col);
        const gd = Math.min(...Reliquia.guards.map((g) => Reliquia._cheb({ row: r, col: c }, g)));
        if (!any || d < any.d) any = { row: r, col: c, d };
        if (gd >= 2 && gd <= 4 && (!best || d < best.d)) best = { row: r, col: c, d };
      }
    }
    const spot = best || any || this._spotAt(2);
    const u = Units.spawnUnit({ typeId: "portamuros", row: spot.row, col: spot.col, team: "player" });
    this._ctx.unitId = u.id;
    if (typeof Fog !== "undefined") {
      Fog.revealForUnit(u);
      if (a && Fog.revealAround) Fog.revealAround(a.row, a.col, 5, true);
    }
  },

  // Crea una página flotante a minD..maxD casillas de la unidad (para que la misión siempre se alcance).
  _wallPageNear(unit, minD, maxD) {
    if (!unit) return null;
    let best = null;
    for (let r = 0; r < Units.boardSize; r++) {
      for (let c = 0; c < Units.boardSize; c++) {
        const d = Math.max(Math.abs(r - unit.row), Math.abs(c - unit.col));
        if (d < minD || d > maxD || !Reliquia._pageTileOk(r, c)) continue;
        if (!best || d < best.d || (d === best.d && Math.random() < 0.3)) best = { row: r, col: c, d };
      }
    }
    if (!best) return null;
    Reliquia._createPage(best.row, best.col, 0);
    Reliquia.pagesSpawned++;
    if (typeof Fog !== "undefined") Fog.applyVisibility();
    return { row: best.row, col: best.col };
  },

  // Charco de práctica: convierte una loseta de hierba en agua REAL (terreno,
  // textura y mapa de tipos) y la deja ya revelada.
  _makeWater(row, col) {
    if (typeof TerrainMap === "undefined" || !TerrainMap.grid) return;
    TerrainMap.grid[row][col] = "water";
    const info = TILE_TYPES.water;
    const t = typeof TerrainCanvas !== "undefined" && TerrainCanvas._t(row, col);
    if (t) {
      const w = Math.floor(TILE_WIDTH * (info.scale != null ? info.scale : TILE_DEFAULT_ADJUST.scale));
      t.reveal = {
        src: info.variants[0],
        ox: info.offsetX != null ? info.offsetX : TILE_DEFAULT_ADJUST.offsetX,
        oy: info.offsetY != null ? info.offsetY : TILE_DEFAULT_ADJUST.offsetY,
        w,
        h: Math.floor(Math.round((w * (info.nativeHeight || TILE_NATIVE_HEIGHT)) / (info.nativeWidth || TILE_NATIVE_WIDTH))),
      };
      TerrainCanvas._load(TerrainCanvas._urlFor(t.reveal.src, 0));
      TerrainCanvas._load(TerrainCanvas._urlFor(t.reveal.src, 1));
      TerrainCanvas._load(TerrainCanvas._urlFor(t.reveal.src, 2));
      TerrainCanvas.setRevealed(row, col, true);
    }
  },

  // Entrega a la unidad un gnomo nuevo ya cogido (para repetir lanzamientos sin volver a andar).
  _giveGnome(unit) {
    if (!unit) return null;
    Gnome.spawnNear(unit.row, unit.col);
    const g = Gnome.list[Gnome.list.length - 1];
    if (g) {
      g.attachTo(unit);
      g.row = unit.row;
      g.col = unit.col;
    }
    // Si la unidad ya estaba seleccionada, refresca sus iconos (golpear/lanzar) con el gnomo nuevo.
    if (typeof Gnome !== "undefined" && Gnome.showFor && Units.selectedId === unit.id) Gnome.showFor(unit);
    return g;
  },

  // Devuelve el huevo a su sitio de práctica (tras el vuelo del primer lanzamiento).
  _eggHome() {
    const e = Egg.egg;
    const s = this._ctx.eggSpot;
    if (!e || !s) return;
    e.row = s.row;
    e.col = s.col;
    Egg._place(e.el, s.row, s.col, 6);
    Egg._placeBadge();
    if (typeof Fog !== "undefined") Fog.applyVisibility();
  },

  // Dos bumpers sobre la línea del vuelo (uno por delante del huevo y otro por detrás de la unidad).
  // frontOnly: solo el de delante del huevo (para el primer lanzamiento: sin un rebote el
  // huevo nunca se carga y la misión "Lánzale a Tinkle contra el huevo" no se podía completar).
  _placeCraneBumpers(frontOnly) {
    const e = Egg.egg;
    const u = this._myUnit();
    if (!e || !u) return;
    const d = [e.row - u.row, e.col - u.col];
    const dr = Math.sign(d[0]), dc = Math.sign(d[1]);
    Bumpers.resetAll();
    (frontOnly ? [[3, 0]] : [[3, 0], [-4, 0]]).forEach(([k]) => {
      const r = e.row + dr * k, c = e.col + dc * k;
      if (this._tileOk(r, c)) Bumpers._create(r, c);
    });
  },

  // ---------- Utilidades ----------
  _nearestRange(row, col) {
    const ms = [...document.querySelectorAll(".board-marker.range-marker:not(.obelisk-placement-marker)")];
    if (!ms.length) return null;
    const d = (m) => Math.max(Math.abs(m.dataset.row - row), Math.abs(m.dataset.col - col));
    ms.sort((a, b) => d(a) - d(b));
    return ms[0];
  },

  // Pide a la cámara (TutorialFrame, js/tutorial-frame.js) que estas entidades o casillas
  // queden SIEMPRE a la vista en la zona libre, sin que la viñeta ni los botones las tapen.
  _focus(...ents) {
    if (typeof TutorialFrame !== "undefined") TutorialFrame.setFocus(ents);
  },

  // Acerca el volcán a la unidad (como el tótem en "Primeros pasos"): así la
  // misión siempre se alcanza sin tener que cruzar medio mapa.
  _volcanoNear(unit) {
    const v = this._ctx.volcano;
    if (!v || !unit) return;
    const dist = Math.max(Math.abs(v.row - unit.row), Math.abs(v.col - unit.col));
    if (dist <= 4) return;
    const spot = this._findSpot(unit, { minD: 3, maxD: 3, side: "center", minOb: 2 }) || this._around(unit, -3, 0);
    if (!spot) return;
    v.row = spot.row;
    v.col = spot.col;
    const { x, y } = getTileCenter(v.row, v.col, Units.boardSize);
    v.el.style.left = `${x}px`;
    v.el.style.top = `${y}px`;
    v.el.style.zIndex = String((v.row + v.col) * 10 + 3);
    if (typeof Fog !== "undefined") Fog.applyVisibility();
  },

  _endTurnBtn() {
    return Turns._btn || document.querySelector(".end-turn-btn");
  },

  _turnIdle() {
    return Turns.activeTeam === "player" && !Turns._aiRunning;
  },

  // Gnomo de práctica pegado a la unidad (para cogerlo sin andar).
  _gnomeBeside(unit) {
    const g = this._gnome();
    if (!g || !unit) return;
    let best = null;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const r = unit.row + dr;
        const c = unit.col + dc;
        if (!this._tileOk(r, c)) continue;
        // Lo más lejos posible del Obelisco (más despejado); nunca bajo el diálogo.
        const ob = this._ob();
        const score = Math.hypot(r - ob.row, c - ob.col) - (dr && dc ? 0.3 : 0);
        if (!best || score > best.score) best = { row: r, col: c, score };
      }
    }
    if (!best) return;
    g.row = best.row;
    g.col = best.col;
    Units._placeInstant(g);
    if (typeof Fog !== "undefined") Fog.applyVisibility();
  },

  // ---------- Guion: Bosque MushBoom ----------
  _stepsMush() {
    const T = this;
    const unit = () => T._myUnit();
    return [
      {
        mood: "grunon",
        say: `Bienvenido al Bosque MushBoom, antes llamado «Bosque de la Paz y la Armonía». Cambiaron el nombre el día que alguien descubrió que las setas de por aquí explotan. Desde entonces el turismo ha bajado bastante, y los gnomos, todavía más. Yo soy de los pocos que quedan: el último con ganas de hablar.`,
        button: "Qué simpático",
      },
      {
        mood: "normal",
        say: `Es un sitio precioso, si te gusta el olor a humo, a hongo chamuscado y a gnomo a la brasa. Dicen que, de vez en cuando, la tierra tiembla. No es un terremoto: es el hambre de un gigante que duerme bajo un altar. Hoy te enseñaré las tres cosas que hacen especial este bosque: las setas explosivas, el Altar de Sacrificios y el GnomOgro.`,
        button: "Estoy deseando",
      },
      {
        mood: "normal",
        say: `Primera atracción: las setas explosivas. Aparecen sueltas por el bosque y se cogen igual que un gnomo, con la manita (coger no gasta acción). Pero ojo: en cuanto la llevas encima empieza una cuenta atrás, y al llegar a 0 explota, con 5 de daño para quien la lleva y para todo lo que tenga alrededor. Te he dejado una cerquita de tu unidad. ¡Cógela!`,
        mission: "Coge la seta explosiva",
        onStart: () => {
          T._refill();
          T._focus(unit(), T._ctx.altar);
          const u = unit();
          const spot = T._around(u, 2, -2);
          if (spot) T._ctx.mush = Mushrooms._create(spot.row, spot.col);
          Mushrooms.active = false;
          if (typeof Fog !== "undefined") Fog.applyVisibility();
        },
        target: () => {
          const u = unit();
          const m = T._ctx.mush;
          if (!u || !m) return null;
          return T._unitThen(u, () => T._marker("catch-marker", m.row, m.col));
        },
        done: () => Mushrooms.isHeldBy(unit().id),
        ok: "¡Ya la tienes! Fíjate en el número que lleva encima: son los turnos que le quedan antes de estallar. Sí, la has cogido tú. Yo no me hago responsable.",
      },
      {
        mood: "grunon",
        say: `Ese número baja en uno cada vez que TÚ terminas tu turno (empieza en 3). Si llega a 0, adiós seta y adiós portador. Pulsa PASAR TURNO y compruébalo: tranquilo, aún te queda margen. Mientras no te lo pienses demasiado...`,
        mission: "Pasa turno y mira la cuenta atrás",
        target: () => T._endTurnBtn(),
        done: () => {
          const m = Mushrooms.carriedBy(unit());
          return !!m && m.fuse <= 2 && T._turnIdle();
        },
        ok: "Ahora le quedan 2 turnos. Si fueras listo, ya estarías pensando en cómo deshacerte de ella. Tranquilo, que te lo cuento.",
      },
      {
        mood: "normal",
        say: `¿Ves ese altar tan acogedor? Es el Altar de Sacrificios y siempre tiene hambre: su barra tiene 30 espacios y, en vez de vaciarse, se llena con ofrendas. Una seta explosiva le da 10 puntos y, además, se desactiva sin explotar. Basta con que tu unidad con la seta acabe junto al altar, o con que pulses su diana, para ofrecérsela.`,
        mission: "Ofrece la seta al altar",
        onStart: () => {
          T._refill();
          T._focus(unit(), T._ctx.altar);
        },
        target: () => {
          const u = unit();
          if (!u) return null;
          if (Units.selectedId !== u.id) return T._unitEl(u);
          return T._anyMarker("altar-attack-marker") || T._unitEl(u);
        },
        refillFor: () => unit() && unit().id,
        done: () => !!T._ctx.altar && (T._ctx.altar.fills.player || 0) >= 10,
        ok: "Diez puntos para el altar y cero heridos. Es el trato más justo que ha hecho nadie en este bosque.",
      },
      {
        mood: "grunon",
        say: `Pero el altar es un glotón y también se alimenta de gnomos. Si estampas a un gnomo contra él (con la diana, como contra un tótem), la barra se llena con TODOS los puntos que lleve encima el gnomo: cuantos más golpes haya recibido, más ofrenda. Tinkle, ven aquí… No te asustes, esto va a ser rápido. Para ti, claro. Coge a Tinkle.`,
        mission: "Coge a Tinkle",
        onStart: () => {
          T._refill();
          if (Units.selectedId) Units.deselect();
          T._gnomeBeside(unit());
        },
        target: () => {
          const g = T._gnome();
          const u = unit();
          if (!g || !u) return null;
          return T._unitThen(u, () => T._marker("catch-marker", g.row, g.col));
        },
        refillFor: () => unit() && unit().id,
        done: () => Gnome.isHeldBy(unit().id),
        ok: "Tinkle, ya sabes que te quiero. Lo suficiente como para que sufras pronto.",
      },
      {
        mood: "normal",
        say: `Tinkle se ha puesto muy nervioso y ya acumula 20 puntos. No me preguntes cómo: hay cosas que es mejor no saber. Con los 10 de la seta, 20 más dejan el altar en 30: lleno del todo. Selecciona a tu unidad y pulsa la diana del altar. Y ruega por su alma.`,
        mission: "Estampa a Tinkle contra el altar",
        onStart: () => {
          T._refill();
          T._focus(unit(), T._ctx.altar);
          const g = T._gnome();
          if (g && g._setPoints) g._setPoints(20);
        },
        target: () => {
          const u = unit();
          if (!u) return null;
          // Ya estampado: el gnomo deja de estar en sus manos y la guía se apaga.
          if (!Gnome.isHeldBy(u.id)) return null;
          if (Units.selectedId !== u.id) return T._unitEl(u);
          return T._anyMarker("altar-attack-marker") || T._unitEl(u);
        },
        refillFor: () => unit() && unit().id,
        done: () => !!GnomOgro.current,
        ok: "¡Altar lleno! Ha desaparecido en medio de un temblor. ¿Has oído eso? Sí, ese crujido. Corre. Bueno, corre tú, que yo ya soy mayor.",
      },
      {
        mood: "grunon",
        say: `Ese es el GnomOgro: un gigante que no obedece a nadie. Es del bando de quien llenó el altar (tú), pero va por su cuenta: al principio de CADA turno da un paso hacia el Obelisco rival y, si tiene a un enemigo al lado, lo mata de un golpe en vez de andar. Tiene 30 de vida, y si llega a la base rival la destruye de un solo golpe y se acaba la partida. Pasa turno y míralo caminar.`,
        mission: "Pasa turno y mira al GnomOgro",
        onStart: () => {
          T._focus(GnomOgro.current, unit());
          const g = GnomOgro.current;
          T._ctx.ogroFrom = g ? { row: g.row, col: g.col } : null;
        },
        target: () => T._endTurnBtn(),
        done: () => {
          const g = GnomOgro.current;
          const f = T._ctx.ogroFrom;
          return !!g && !!f && (g.row !== f.row || g.col !== f.col) && T._turnIdle();
        },
        ok: "Un paso más cerca de la victoria. Y fíjate qué temblor al caminar: da gusto verlo, mientras no vaya a por ti.",
      },
      {
        mood: "aplaude",
        say: `Y eso es todo del Bosque MushBoom. Resumen: coge setas pero no te las quedes, llena el altar con setas y gnomos, y deja que el GnomOgro haga el trabajo sucio. Ojo: si el que llena el altar es el rival, el gigante irá a por TU Obelisco. Entonces ataca al gigante con todas tus unidades, o corre a llenar tú el altar antes. ¡Suerte, la vas a necesitar!`,
        button: "TERMINAR TUTORIAL",
        final: true,
      },
    ];
  },

  // ---------- Guion: Colinas Rock'n Troll ----------
  _stepsRock() {
    const T = this;
    const unit = () => T._myUnit();
    const drum = () => T._ctx.drum;
    const vol = () => T._ctx.volcano;
    return [
      {
        mood: "grunon",
        say: `Colinas Rock'n Troll. Hace siglos, unos trols dieron aquí un concierto de rock tan ruidoso que las colinas se echaron a temblar... y nunca pararon. Los trols se quedaron a vivir, para los coros. Nadie se atreve a decirles que ya no cantan nada bien.`,
        button: "Qué ambiente",
      },
      {
        mood: "normal",
        say: `Aquí lo oirás todo: tambores que retumban, rocas que caen del cielo y un volcán de muy mal carácter, harto de tanto ruido. Yo, que tengo buen oído, prefiero no acercarme. Hoy te enseñaré las tres cosas que hacen especial este sitio: los Tambores de Guerra, los Fragmentos de roca y el Volcán.`,
        button: "A por ellos",
      },
      {
        mood: "normal",
        say: `Primero, los Tambores de Guerra. Si tienes MÁS unidades pegadas a un tambor que cualquier otro bando, al acabar tu turno llenas una porción de tu ruleta (la que flota sobre el tambor). Con empate o minoría, nada. Cuando tu ruleta llega al máximo, ¡llueven rocas sobre tus rivales! Acerca tu unidad al tambor.`,
        mission: "Acerca tu unidad al tambor",
        onStart: () => {
          T._refill();
          T._focus(unit(), drum());
        },
        target: () => {
          const u = unit();
          const d = drum();
          if (!u || !d) return null;
          if (Units.selectedId !== u.id) return T._unitEl(u);
          return T._nearestRange(d.row, d.col) || T._unitEl(u);
        },
        allow: () => {
          const u = unit();
          return [T._unitEl(u), ...document.querySelectorAll(".board-marker.range-marker:not(.obelisk-placement-marker)")];
        },
        refillFor: () => unit() && unit().id,
        done: () => {
          const u = unit();
          const d = drum();
          return !!u && !!d && Math.max(Math.abs(u.row - d.row), Math.abs(u.col - d.col)) <= 1 && !u.moving;
        },
        ok: "Ahí está, bien pegadito. Si el rival trae a un colega, será empate y no puntuará nadie. Como en las mejores reuniones de familia.",
      },
      {
        mood: "grunon",
        say: `Hay un truco para que los tambores suenen más deprisa: cada golpe que des a un gnomo estando pegado a un tambor suma una porción extra. Tinkle viene justo hacia aquí, con la ilusión de siempre. Cógelo.`,
        mission: "Coge a Tinkle",
        onStart: () => {
          T._refill();
          if (Units.selectedId) Units.deselect();
          T._gnomeBeside(unit());
        },
        target: () => {
          const g = T._gnome();
          const u = unit();
          if (!g || !u) return null;
          return T._unitThen(u, () => T._marker("catch-marker", g.row, g.col));
        },
        refillFor: () => unit() && unit().id,
        done: () => Gnome.isHeldBy(unit().id),
        ok: "Tinkle, esta vez haz de baquetas. Mejor no te explico lo que significa.",
      },
      {
        mood: "normal",
        say: `Ahora golpéalo, con el puño, mientras sigues pegado al tambor. Cada golpe hace retumbar el cuero y deja pendiente una porción más para el final de tu turno.`,
        mission: "Golpea a Tinkle junto al tambor",
        onStart: () => {
          T._refill();
        },
        target: () => {
          const u = unit();
          if (u && Units.selectedId !== u.id) return T._unitEl(u);
          return Gnome._hitBtn || T._unitEl(u);
        },
        refillFor: () => unit() && unit().id,
        done: () => {
          const d = drum();
          return !!d && (d.hits.player || 0) >= 1;
        },
        ok: "¡Rum-pum-pum! Y Tinkle ha puesto el compás. Qué talento desaprovechado.",
      },
      {
        mood: "normal",
        say: `Para no hacerte esperar, he dejado tu ruleta casi llena: con la porción del tambor y la del golpe, al acabar el turno se completa. También he puesto a un rival ahí cerquita, para que vea el espectáculo de cerca. Pulsa PASAR TURNO.`,
        mission: "Pasa turno y mira la lluvia de rocas",
        onStart: () => {
          T._focus(unit(), drum());
          Drums.slices.player = Math.max(0, Drums.maxSlices("player") - 2);
          Drums.refreshMarkers();
          const d = drum();
          const enemyType = Object.keys(UNIT_TYPES).find((k) => UNIT_TYPES[k].raceId !== "mushboom_forest");
          const spot = d && T._findSpot(d, { minD: 2, maxD: 3, side: "center", minOb: 3 });
          if (spot && enemyType) {
            const e = Units.spawnUnit({ typeId: enemyType, row: spot.row, col: spot.col, team: "enemy" });
            e.hp = Math.min(e.hp, 2);
            Units.updateHpBar(e);
            if (typeof Fog !== "undefined") Fog.applyVisibility();
          }
          T._ctx.rains = Drums.rains;
        },
        target: () => T._endTurnBtn(),
        done: () => Drums.rains > T._ctx.rains && !Drums._busy && T._turnIdle(),
        ok: "¡Lluvia de rocas! La primera hace 2 de daño y sube 1 cada vez que la consigues. Y fíjate: los tambores, avergonzados, se han mudado a otro sitio.",
      },
      {
        mood: "normal",
        say: `Cada roca que cae se rompe y suelta Fragmentos. Se recogen al pisarlos: van a tu mochila y se apilan. Cualquier bando puede cogerlos, así que date prisa antes de que se los lleve el rival. Te he dejado unos cuantos cerca. Pisa uno.`,
        mission: "Recoge un fragmento",
        onStart: () => {
          T._refill();
          T._focus(unit(), vol());
          const u = unit();
          const near = Drums.frags.some((f) => Math.max(Math.abs(f.row - u.row), Math.abs(f.col - u.col)) <= 3);
          if (!near) {
            const spot = T._findSpot(u, { minD: 2, maxD: 2, side: "center", minOb: 1 });
            if (spot) Drums._fragments({ row: spot.row, col: spot.col }, false);
          }
        },
        target: () => {
          const u = unit();
          if (!u) return null;
          if (Units.selectedId !== u.id) return T._unitEl(u);
          const fs = Drums.frags.slice().sort((a, b) => Math.max(Math.abs(a.row - u.row), Math.abs(a.col - u.col)) - Math.max(Math.abs(b.row - u.row), Math.abs(b.col - u.col)));
          if (!fs.length) return T._unitEl(u);
          return T._marker("range-marker", fs[0].row, fs[0].col) || T._nearestRange(fs[0].row, fs[0].col) || T._unitEl(u);
        },
        allow: () => [T._unitEl(unit()), ...document.querySelectorAll(".board-marker.range-marker:not(.obelisk-placement-marker)")],
        refillFor: () => unit() && unit().id,
        done: () => (Resources.counts.fragmento || 0) > 0,
        ok: "Una piedra en la mochila. Como tu carrera, pero más útil.",
      },
      {
        mood: "grunon",
        say: `Las piedras valen para tres cosas, y NUNCA contra unidades rivales: alimentar al volcán (+1), apagar una casilla de lava y quitar un gnomo en llamas agarrado a una de tus unidades. Puedes lanzar todas las que tengas, sin límite por turno. Abre la mochila, pulsa el fragmento dos veces (una elige, otra lo usa) y apunta al volcán, el de ahí enfrente.`,
        mission: "Lanza el fragmento al volcán",
        onStart: () => {
          T._volcanoNear(unit());
          T._focus(unit(), vol());
          const v = vol();
          if (v) {
            v.points = 9; // casi encendido: la piedra lo enciende
            Volcano._refreshBar(v);
            Volcano._refreshSprite(v);
          }
        },
        target: () => {
          const v = vol();
          if (!v) return null;
          if (Backpack._rockMode) return v.el.querySelector(".volcano__sprite") || v.el;
          if (Backpack._overlayEl && Backpack._slotsEl) {
            const slot = [...Backpack._slotsEl.querySelectorAll(".backpack-slot--resource")].find((s) => {
              const img = s.querySelector("img");
              return img && /Fragmento/i.test(img.alt || "");
            });
            return slot || Backpack._slotsEl.querySelector(".backpack-slot--resource");
          }
          return Backpack._btnEl;
        },
        done: () => !!vol() && vol().points >= 10,
        ok: "El volcán ha subido a 10 y se ha encendido. Desde 10 está «encendido»; a 20, entra en erupción. No hace falta que lo mires con esa cara de interés.",
      },
      {
        mood: "normal",
        say: `El volcán también se alimenta de gnomos, estampados o lanzados: suman sus puntos. Al llegar a 20 entra en erupción y suelta un gnomo en llamas por cada unidad rival, que corre hasta ella y se le agarra. Al acabar tu turno el gnomo explota: -1 de vida y lava en las casillas de alrededor. Tinkle ya trae 10 puntos de casa. Estámpalo contra el volcán. Y de paso, tienes a un rival justo para la ocasión.`,
        mission: "Estampa a Tinkle contra el volcán",
        onStart: () => {
          T._refill();
          T._focus(unit(), vol());
          const g = T._gnome();
          if (g && g._setPoints) g._setPoints(10);
          const v = vol();
          const enemyType = Object.keys(UNIT_TYPES).find((k) => UNIT_TYPES[k].raceId !== "mushboom_forest");
          const spot = v && T._findSpot(v, { minD: 3, maxD: 4, side: "center", minOb: 3 });
          if (spot && enemyType) {
            const e = Units.spawnUnit({ typeId: enemyType, row: spot.row, col: spot.col, team: "enemy" });
            e.hp = Math.max(e.hp, 6);
            Units.updateHpBar(e);
            if (typeof Fog !== "undefined") Fog.applyVisibility();
          }
        },
        target: () => {
          const u = unit();
          if (!u) return null;
          if (!Gnome.isHeldBy(u.id)) return null; // ya estampado: sin guía durante la erupción
          if (Units.selectedId !== u.id) return T._unitEl(u);
          const v = vol();
          return T._anyMarker("altar-attack-marker") || (v && T._nearestRange(v.row, v.col)) || T._unitEl(u);
        },
        refillFor: () => unit() && unit().id,
        done: () => {
          const v = vol();
          if (v && (v.points >= 20 || Volcano.eruption)) T._ctx.erupted = true;
          return !!T._ctx.erupted && !Volcano._busy;
        },
        ok: "¡Erupción! Mira cómo corre ese gnomo en llamas hacia el pobre desgraciado. La vida del rival es dura.",
      },
      {
        mood: "grunon",
        say: `Pasa turno: el gnomo en llamas explotará y dejará lava, que quita 1 de vida por pisada hasta que desaparece. Una piedra puede apagar una casilla antes, o librar a una de tus unidades del gnomo en llamas antes de que estalle.`,
        mission: "Pasa turno y mira la explosión",
        onStart: () => {
          T._focus(unit(), vol());
          T._ctx.round = Turns.roundNumber;
        },
        target: () => T._endTurnBtn(),
        done: () => Turns.roundNumber > T._ctx.round && T._turnIdle() && !Volcano._busy,
        ok: "Lava por todas partes. Hogar, dulce hogar... de los trols.",
      },
      {
        mood: "aplaude",
        say: `Y eso es todo de las Colinas Rock'n Troll. Resumen: pega gnomos junto a los tambores para que llueva roca, recoge los fragmentos antes que el rival y úsalos con cabeza: al volcán, a la lava o contra un gnomo en llamas. Cuando alguien llegue a 20 en el volcán, prepárate: o corres, o te agarras a una piedra. ¡Suerte, la vas a necesitar!`,
        button: "TERMINAR TUTORIAL",
        final: true,
      },
    ];
  },

  // ---------- Guion: Poblado HurryCrane ----------
  _stepsCrane() {
    const T = this;
    const unit = () => T._myUnit();
    const aimTarget = () => {
      const u = unit();
      if (!u) return null;
      // Lanzamiento hecho (el gnomo ya vuela o se ha ido): la guía se apaga.
      if (!Gnome.isHeldBy(u.id)) return null;
      if (Units.selectedId !== u.id) return T._unitEl(u);
      const g = Gnome.list.find((x) => x.passing);
      if (g) return T._anyMarker("egg-throw-marker") || T._anyMarker("pass-marker");
      return Gnome._passBtn || T._unitEl(u);
    };
    return [
      {
        mood: "grunon",
        say: "Poblado HurryCrane. Un lugar flotando sobre las nubes que lleva siglos esperando a que eclosione un huevo de grulla gigante. Todavía no ha pasado, pero los vecinos ya han apostado qué saldrá, cuánto pesará... y a quién le tocará limpiar el nido.",
        button: "Qué emoción",
      },
      {
        mood: "normal",
        say: "Aquí no hay setas ni volcanes: hay un huevo con muy mala leche y unos bumpers. Hoy jugaremos al pinball con el huevo, como en aquel deporte de balón explosivo: cada rebote lo CARGA (lo notarás en el destello, que va cambiando de color, y en que cada rebote suena más agudo; y si mantienes pulsado el huevo, una pastilla te dice tus rebotes y la carga X/10). Sí, el huevo es la bola. Y los gnomos, la fuerza motriz.",
        button: "A jugar",
      },
      {
        mood: "normal",
        say: "Al huevo se le da con un gnomo, y adivina quién es el gnomo. Tinkle viene hacia aquí, con la ilusión de siempre. Cógelo.",
        mission: "Coge a Tinkle",
        onStart: () => {
          T._refill();
          T._focus(unit(), Egg.egg);
          if (Units.selectedId) Units.deselect();
          T._gnomeBeside(unit());
        },
        target: () => {
          const g = T._gnome();
          const u = unit();
          if (!g || !u) return null;
          return T._unitThen(u, () => T._marker("catch-marker", g.row, g.col));
        },
        refillFor: () => unit() && unit().id,
        done: () => Gnome.isHeldBy(unit().id),
        ok: "Tinkle, hoy vuelas. Y mejor no preguntes dónde aterrizas.",
      },
      {
        mood: "normal",
        say: "Pulsa el icono de lanzar y apunta al huevo: verás varias flechas, y alguna se ayuda sola hacia un bumper cercano para que no tengas que ser Robin Hood. El gnomo estampado empuja el huevo en la dirección elegida. Con el mando, elige la flecha con la cruceta.",
        mission: "Lánzale a Tinkle contra el huevo",
        onStart: () => {
          T._refill();
          T._placeCraneBumpers(true);
          T._focus(unit(), Egg.egg, ...Bumpers.list);
          if (typeof Fog !== "undefined") Fog.applyVisibility();
        },
        target: aimTarget,
        refillFor: () => unit() && unit().id,
        done: () => !!Egg.egg && Egg.egg.charge >= 1 && !Egg._busy,
        ok: "¡Zas! El huevo sale despedido y Tinkle, tras caerse de culo, se levanta y se va corriendo. Todo un profesional.",
      },
      {
        mood: "grunon",
        say: "Ahora lo bueno: los bumpers. El huevo salta de un bumper a otro si están cerca y el camino está despejado (sin niebla), pero cada bumper solo rebota UNA vez por turno: nada de ping-pong. Cada rebote lo carga un nivel y hasta el borde del mapa cuenta. Mientras haya bumpers cerca a la vista, el huevo seguirá rebotando de uno a otro, y al final frena suavemente. Te he puesto dos bumpers. Lanza otro gnomo y mira la carambola.",
        mission: "Lanza otro gnomo y provoca una carambola",
        onStart: () => {
          T._refill();
          T._eggHome();
          T._placeCraneBumpers();
          if (Egg.egg) {
            Egg.egg.charge = 2;
            Egg._applyStage();
          }
          T._giveGnome(unit());
          T._focus(unit(), Egg.egg, ...Bumpers.list);
          if (typeof Fog !== "undefined") Fog.applyVisibility();
        },
        target: aimTarget,
        refillFor: () => unit() && unit().id,
        done: () => !!Egg.egg && Egg.egg.charge >= 4 && !Egg._busy,
        ok: "¡Carambola! Y fíjate cómo suena cada golpe más agudo que el anterior. Como una discoteca, pero con más daño.",
      },
      {
        mood: "normal",
        say: "Los obeliscos y los tótems también hacen rebotar al huevo, pero ellos lo pagan: según la carga, el golpe quita 2, 5 o 10 de vida. Y ojo con la carga: cada turno sin rebotar le resta un nivel, así que no lo dejes enfriar. Desde el nivel 6 tiembla y se tiñe de rojo; con el 9 se le ven hasta las grietas.",
        button: "Entendido",
        onStart: () => {
          T._focus(unit(), Egg.egg);
        },
      },
      {
        mood: "grunon",
        say: "Si lo rebotas con la carga al máximo, EXPLOTA. Cada equipo cobra tanta Gloria como rebotes haya dado, con lluvia de monedas y hasta 3 estrellas de premio según la cantidad. Lo he dejado listo: casi al máximo y con tus rebotes de ventaja. Lanza el último gnomo y que sea lo que Dios quiera.",
        mission: "Haz estallar el huevo",
        onStart: () => {
          T._refill();
          T._eggHome();
          if (typeof Bumpers !== "undefined" && Bumpers.resetUsed) Bumpers.resetUsed();
          if (Egg.egg) {
            Egg.egg.charge = 9;
            Egg.egg.bn = { player: 4, enemy: 1 };
            Egg._applyStage();
          }
          T._giveGnome(unit());
          T._focus(unit(), Egg.egg);
        },
        target: aimTarget,
        refillFor: () => unit() && unit().id,
        done: () => Crane.landed(),
        ok: "¡BOOM! Plumas, luces y un huevo hecho añicos. Y mira quién viene a poner orden...",
      },
      {
        mood: "normal",
        say: "La grulla aparece para equilibrar la partida: se posa en el obelisco del que más puntos ganó con el huevo y se queda dos turnos completos de su dueño. Mientras tanto, ese obelisco no puede reclutar, ni mejorar habilidades, ni usar la herrería. Si quedas el último, te tocará a ti. Y como es un objeto del escenario, se vuelve transparente si te tapa.",
        button: "Vaya con la grulla",
        onStart: () => {
          T._focus(unit(), Crane.landed() ? { row: Obelisks.byTeam(Crane.st.team).row, col: Obelisks.byTeam(Crane.st.team).col } : null);
        },
      },
      {
        mood: "grunon",
        say: "¿Tu obelisco bloqueado? Solución clásica: lánzale un gnomo a la grulla. Se asusta, se contrae y vuela al siguiente obelisco (el del siguiente que más puntos ganó), y así hasta visitarlos todos. Entonces se va y el huevo vuelve a nacer en el centro. Dale un gnomazo.",
        mission: "Espanta a la grulla con un gnomo",
        onStart: () => {
          T._refill();
          T._giveGnome(unit());
          T._ctx.craneTeam = Crane.st && Crane.st.team;
          T._focus(unit());
        },
        target: () => {
          const u = unit();
          if (!u) return null;
          if (!Gnome.isHeldBy(u.id)) return null;
          if (Units.selectedId !== u.id) return T._unitEl(u);
          const g = Gnome.list.find((x) => x.passing);
          if (g) return T._anyMarker("crane-throw-marker") || T._anyMarker("pass-marker");
          return Gnome._passBtn || T._unitEl(u);
        },
        refillFor: () => unit() && unit().id,
        done: () => !Crane._busy && (!Crane.st || Crane.st.team !== T._ctx.craneTeam),
        ok: "¡Plumas por todas partes! Dos turnos en cada obelisco, a menos que alguien le dé un susto.",
      },
      {
        mood: "aplaude",
        say: "Y eso es todo del Poblado HurryCrane. Resumen: cada rebote carga el huevo; obeliscos y tótems pagan el golpe según la carga; con la carga al máximo, explota; entonces la grulla se posa donde más puntos se ganaron y bloquea ese obelisco hasta que se vaya. ¡Suerte, la vas a necesitar!",
        button: "TERMINAR TUTORIAL",
        final: true,
      },
    ];
  },

  // ---------- Guion: Fortaleza WallForge ----------
  _stepsWall() {
    const T = this;
    const unit = () => T._myUnit();
    // Señala primero al lanzador, luego el icono de lanzar y por último el marcador del objetivo.
    const aim = (markerFn) => () => {
      const u = unit();
      if (!u || !Gnome.isHeldBy(u.id)) return null;
      if (Units.selectedId !== u.id) return T._unitEl(u);
      const g = Gnome.list.find((x) => x.passing);
      if (g) return markerFn() || T._anyMarker("pass-marker");
      return Gnome._passBtn || T._unitEl(u);
    };
    return [
      {
        mood: "grunon",
        say: "Fortaleza WallForge. Una isla blindada de arriba abajo, habitada por gente tan obsesionada con proteger su gran Reliquia que hasta las paredes llevan armadura. Lo gracioso es que nadie sabe qué es.",
        button: "Qué paranoia",
        onStart: () => { T._focus(unit(), Reliquia.altar); },
      },
      {
        mood: "normal",
        say: "En el centro duerme la Reliquia, sellada con cadenas y vigilada por tres guardias paranoicos. A los guardias no se les pega: se les lanza un gnomo, y ya. Para variar, coge a Tinkle.",
        mission: "Coge a Tinkle",
        onStart: () => {
          T._refill();
          T._focus(unit(), Reliquia.altar);
          if (Units.selectedId) Units.deselect();
          T._gnomeBeside(unit());
        },
        target: () => {
          const g = T._gnome();
          const u = unit();
          if (!g || !u) return null;
          return T._unitThen(u, () => T._marker("catch-marker", g.row, g.col));
        },
        refillFor: () => unit() && unit().id,
        done: () => Gnome.isHeldBy(unit().id),
        ok: "Tinkle, hoy te toca ser munición. Otra vez.",
      },
      {
        mood: "normal",
        say: "Pulsa lanzar y apunta a un guardia. El gnomo lo deja mareado un buen rato y, de paso, se lleva puntos encima. Mareado, el guardia es una estatua blindada. Muy decorativa.",
        mission: "Lánzale a Tinkle contra un guardia",
        onStart: () => {
          T._ctx.wallOnlyGuards = true; // en esta misión la cámara no se puede atacar: solo guardias
          T._refill();
          T._focus(unit(), ...Reliquia.guards);
        },
        target: aim(() => {
          // La señal va al marcador de un GUARDIA (no al primero que haya, que podía ser el de la cámara).
          for (const g of Reliquia.guards) { const m = T._marker("reliquia-throw-marker", g.row, g.col); if (m) return m; }
          return null;
        }),
        refillFor: () => unit() && unit().id,
        done: () => Reliquia.guards.some((g) => g.stun > 0) && !Reliquia.busy,
        ok: "Mareado y sin dignidad. El guardia, digo. Tinkle hace tiempo que no tiene.",
      },
      {
        mood: "grunon",
        say: "Ahora la cámara sellada. Cada gnomo que le estampes rompe una cadena, y cuando no queden, suelta la Reliquia. Te presto los gnomos necesarios: Tinkle tiene muchos primos.",
        mission: "Rompe las cadenas de la cámara",
        onStart: () => {
          T._ctx.wallOnlyGuards = false;
          T._refill();
          T._focus(unit(), Reliquia.altar);
          T._giveGnome(unit());
        },
        target: aim(() => { const a = Reliquia.altar; return a && T._marker("reliquia-throw-marker", a.row, a.col); }),
        refillFor: () => unit() && unit().id,
        done: () => {
          const u = unit();
          const open = Reliquia.altar.hits >= RELIQUIA_HITS_TO_OPEN;
          // Un gnomo nuevo en la mano tras cada estampada, hasta que ceda la última cadena.
          if (!open && u && !Reliquia.busy && !Gnome.isHeldBy(u.id) && !Gnome.list.some((x) => x.busy || x.passing)) {
            T._giveGnome(u);
            T._refill();
          }
          return open && !Reliquia.busy;
        },
        ok: "Libre. Y por el estruendo, ya lo sabe toda la isla.",
      },
      {
        mood: "normal",
        say: "Ahí flota. Acércate y cógela: ahora eres el portador, y eso trae responsabilidades. Y enemigos. Muchos enemigos.",
        mission: "Coge la Reliquia",
        onStart: () => {
          T._refill();
          T._focus(unit(), Reliquia.altar);
        },
        // Sin mano de coger a la vista, la unidad aún no está pegada a la cámara: señala la casilla de movimiento más cercana a ella.
        target: () => T._unitThen(unit(), () => T._anyMarker("reliquia-grab-marker") || T._nearestRange(Reliquia.altar.row, Reliquia.altar.col)),
        refillFor: () => unit() && unit().id,
        done: () => !!Reliquia.relic && Reliquia.relic.state === "carried" && !Reliquia.busy,
        ok: "Es tuya. Mientras la lleves, claro.",
      },
      {
        mood: "grunon",
        say: "Quien lleva la Reliquia deja ondas en los pies, y todos lo ven: a él y todo lo que él ve. Esconderse no vale. Los guardias van a por el portador, sea del equipo que sea, y si cae, la Reliquia queda en el suelo para quien la quiera. Los puntos se ganan pisando páginas: pisa esa de ahí.",
        mission: "Pisa una página",
        onStart: () => {
          T._refill();
          T._ctx.page = T._wallPageNear(unit(), 1, 2);
          T._focus(unit(), T._ctx.page);
        },
        target: () => {
          const pg = T._ctx.page;
          if (!pg) return null;
          return T._unitThen(unit(), () => T._nearestRange(pg.row, pg.col));
        },
        refillFor: () => unit() && unit().id,
        done: () => !!Reliquia.relic && Reliquia.relic.state === "carried" && Reliquia.relic.points >= RELIQUIA_PAGE_POINTS,
        ok: "Puntos. Pocos, pero tuyos.",
      },
      {
        mood: "normal",
        say: "Y si te sobra un gnomo: lánzalo contra una página y se convierte en ceniza, con página y todo. Suma puntos al portador de tu equipo y se los resta al del rival. Humor negro con propósito, mi especialidad.",
        mission: "Convierte a Tinkle en ceniza",
        onStart: () => {
          T._refill();
          T._ctx.page2 = T._wallPageNear(unit(), 2, 3);
          T._ctx.pts = Reliquia.relic ? Reliquia.relic.points : 0;
          T._giveGnome(unit());
          T._focus(unit(), T._ctx.page2);
        },
        target: aim(() => { const p = T._ctx.page2; return p && T._marker("reliquia-throw-marker", p.row, p.col); }),
        refillFor: () => unit() && unit().id,
        done: () => !!Reliquia.relic && !Reliquia.busy && (Reliquia.relic.points >= T._ctx.pts + RELIQUIA_PAGE_POINTS || Reliquia.relic.points >= RELIQUIA_MAX_POINTS),
        ok: "Ceniza al viento. Tinkle siempre quiso volar.",
      },
      {
        mood: "grunon",
        say: "Para cobrar, llévala junto a tu obelisco: se te abonan todos los puntos y tu rival pierde los mismos. La Reliquia vuelve a su cámara, que se resella, y vuelta a empezar.",
        mission: "Entrega la Reliquia en tu obelisco",
        onStart: () => {
          T._refill();
          T._focus(unit(), Obelisks.byTeam("player"));
        },
        target: () => {
          const ob = Obelisks.byTeam("player");
          return T._unitThen(unit(), () => T._nearestRange(ob.row + 1, ob.col + 1) || T._nearestRange(ob.row, ob.col));
        },
        refillFor: () => unit() && unit().id,
        done: () => !!Reliquia.relic && Reliquia.relic.state === "altar" && !Reliquia.busy && !Reliquia._delivering,
        ok: "¡Cobrado! Y el rival, un poco más pobre.",
      },
      {
        mood: "aplaude",
        say: "Y eso es todo de la Fortaleza WallForge. Resumen: marea guardias con gnomos, rompe las cadenas, coge la Reliquia, pisa páginas, sacrifica gnomos para sumar o restar, y cobra junto a tu obelisco. ¡Suerte, la vas a necesitar!",
        button: "TERMINAR TUTORIAL",
        final: true,
      },
    ];
  },
});

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
  ],

  showMenu() {
    if (this.active) return;
    const list = document.getElementById("tutorial-list");
    if (!list) return;
    list.innerHTML = "";
    this._CARDS.forEach((c) => {
      const card = document.createElement("button");
      card.className = "race-card level-card";
      card.style.setProperty("--card-accent", c.color);
      card.style.setProperty("--float-delay", `-${(NR() * 5).toFixed(2)}s`);
      const tr = (t) => (typeof I18N !== "undefined" && I18N.tr ? I18N.tr(t) : t);
      const nameTx = tr(c.name);
      card.setAttribute("aria-label", nameTx);
      const feats = c.feats
        .map(([icon, raw]) => {
          const txt = tr(raw);
          const at = txt.indexOf(": ");
          const html = at > 0 ? `<b>${txt.slice(0, at)}</b>${txt.slice(at)}` : txt;
          return `<span class="race-card__stat race-card__stat--virtue"><i class="ph ${icon} race-card__stat-icon"></i><span>${html}</span></span>`;
        })
        .join("");
      card.innerHTML = `
        <span class="level-card__stage">
          <img src="${c.island}" alt="" class="level-card__island" />
          <span class="level-card__name">${nameTx}</span>
        </span>
        <span class="race-card__body level-card__body">
          <span class="race-card__flavor">${tr(c.flavor)}</span>
          ${feats}
        </span>`;
      card.addEventListener("click", () => {
        if (typeof SFX !== "undefined") SFX.click();
        this.start(c.id);
      });
      list.appendChild(card);
    });
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
    // Una unidad propia ya lista junto al Obelisco (en estos tutoriales no se recluta).
    const spot = this._spotAt(2, [[1, 1], [1, 0], [0, 1], [1, -1], [-1, 1]]);
    const u = Units.spawnUnit({ typeId: "seta_artificiero", row: spot.row, col: spot.col, team: "player" });
    this._ctx.unitId = u.id;
    if (typeof Fog !== "undefined") Fog.revealForUnit(u);
    if (this._scenario === "mush") this._buildMushScene();
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
});

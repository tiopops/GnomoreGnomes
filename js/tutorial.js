/* Gnomore Gnomes — Tutorial interactivo (nivel Bosque MushBoom).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Montar una escena de práctica controlada (Tutorial.start): mismo
       tablero/mobiliario que una partida real de MushBoom pero con el rival
       pasivo, un gnomo suelto, un tótem frágil y Puntos de Gloria de sobra.
     - Llevar al jugador paso a paso por "misiones" (STEPS): cada una dice qué
       hacer (con la voz del gnomo guía), señala con un puntero animado el
       elemento exacto a pulsar y espera —comprobando el estado real del
       juego— a que se cumpla antes de pasar a la siguiente.
     - La interfaz propia del tutorial (viñeta del gnomo, misión, puntero) y
       el final (felicitación + TERMINAR TUTORIAL).
   Ninguna mecánica conoce este archivo salvo por tres guardas mínimas
   (Tutorial.active) en turns.js (rival pasivo) y gnome.js (el gnomo del
   tutorial no huye / los pases no fallan). */

// Retratos de Nizak: mismo lienzo y escala los tres, se cambian según el diálogo.
const TUTORIAL_GUIDE_IMGS = {
  normal: "assets/tutorial/nizak_normal.png",
  grunon: "assets/tutorial/nizak_grunon.png",
  aplaude: "assets/tutorial/nizak_aplaude.png",
};
const TUTORIAL_GUIDE_NAME = "Nizak";

const Tutorial = {
  active: false,
  stepIndex: -1,
  _timer: null,
  _raf: null,
  _typeTimer: null,
  _ctx: {}, // memoria entre pasos (ids de unidades, posiciones...)
  _els: {},

  // ---------- Arranque / salida ----------
  async start(scenario = "basic") {
    if (this.active) return;
    this._scenario = scenario;
    try {
      if (typeof Preload !== "undefined") await Preload.run();
      if (typeof LevelAssets !== "undefined") LevelAssets.apply(scenario === "rock" ? "colinas_rockntroll" : "mushboom_forest");
      if (typeof Music !== "undefined" && Music._refresh) Music._refresh(); // pista del nivel
      const size = getBoardSize(1);
      const map = generateMap(size, { rivers: false });
      // Escena de tutorial: el centro del mapa es SIEMPRE hierba despejada.
      const mid = Math.floor(size / 2);
      map.tiles.forEach((t) => {
        if (Math.max(Math.abs(t.row - mid), Math.abs(t.col - mid)) <= 8 && t.type !== "grass") {
          t.type = "grass";
          t.src = pickVariant(TILE_TYPES.grass, t.row, t.col);
        }
      });
      // NO se guarda partida: el tutorial no debe pisar "Reanudar partida".
      renderMap(map, document.getElementById("board-tiles"));
      if (typeof TerrainMap !== "undefined") TerrainMap.init(map);
      const { playerSpawnSpots } = spawnTestUnits(size, "mushboom_forest");
      // Sin Altar de Sacrificios; el Obelisco propio, en el centro del escenario.
      if (typeof Altar !== "undefined") Altar.resetAll();
      const po = Obelisks.byTeam("player");
      if (po) {
        po.row = mid - 2;
        po.col = mid - 2;
        Obelisks._placeInstant(po);
        playerSpawnSpots[0] = { row: po.row, col: po.col };
      }
      this.active = true;
      document.body.classList.add("tut-on");
      this._ctx = {};
      showScreen("screen-board");
      screenHistory.length = 0;
      screenHistory.push("main-menu", "screen-board");
      syncBoardCamera(playerSpawnSpots[0]);
      _playInitialFogReveal(playerSpawnSpots);
      this._setupScene();
      if (scenario !== "basic" && this._setupLevelScene) this._setupLevelScene();
      if (typeof Preload !== "undefined") Preload.finish();
      this._buildUI();
      // Pequeña pausa para que acabe el fundido y el revelado de niebla.
      setTimeout(() => this._goto(0), 900);
    } catch (err) {
      this.active = false;
      console.error("[Tutorial]", err);
      if (typeof _recoverFromFailedMatchStart === "function") _recoverFromFailedMatchStart();
      if (typeof _showStartMatchError === "function") _showStartMatchError(err);
    }
  },

  stop() {
    this.active = false;
    document.body.classList.remove("tut-on");
    this.stepIndex = -1;
    clearInterval(this._timer);
    clearTimeout(this._typeTimer);
    clearTimeout(this._okTimer);
    cancelAnimationFrame(this._okRaf);
    this._advance = null;
    if (this._keyHandler) document.removeEventListener("keydown", this._keyHandler);
    cancelAnimationFrame(this._raf);
    cancelAnimationFrame(this._holdRaf);
    this._hold = null;
    this._removeGuard();
    Object.values(this._els).forEach((e) => e && e.remove());
    this._els = {};
    if (typeof refreshResumeButton === "function") refreshResumeButton();
  },

  finish() {
    this.stop();
    if (typeof SettingsMenu !== "undefined") SettingsMenu._exitMatch();
  },

  // ---------- Escena de práctica ----------
  _tileOk(r, c) {
    if (r < 0 || c < 0 || r >= Units.boardSize || c >= Units.boardSize) return false;
    if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(r, c)) return false;
    if (Units.unitAt(r, c)) return false;
    if (typeof Gnome !== "undefined" && Gnome.isAt(r, c)) return false;
    if (typeof Villages !== "undefined" && Villages.at(r, c)) return false;
    if (typeof Shops !== "undefined" && Shops.at(r, c)) return false;
    if (typeof Obelisks !== "undefined" && Obelisks.at(r, c)) return false;
    if (typeof Altar !== "undefined" && Altar.at(r, c)) return false;
    if (typeof Bushes !== "undefined" && Bushes.at(r, c)) return false;
    if ((typeof Resources !== "undefined" && Resources.at(r, c)) || (typeof Drums !== "undefined" && Drums.at(r, c))) return false;
    return true;
  },

  // Loseta libre a distancia (Chebyshev) `dist` del Obelisco propio; prueba
  // direcciones hasta dar con una válida.
  _spotAt(dist, prefer) {
    const o = Obelisks.byTeam("player");
    // "Hacia dentro" del mapa: el Obelisco suele estar en una esquina.
    const sr = o.row > Units.boardSize / 2 ? -1 : 1;
    const sc = o.col > Units.boardSize / 2 ? -1 : 1;
    const base = prefer || [[1, 1], [1, 0], [0, 1], [1, -1], [-1, 1]];
    const dirs = base.map(([a, b]) => [a * sr, b * sc]).concat([[0, -sc], [-sr, 0], [-sr, -sc]]);
    for (const d of [dist, dist + 1, dist - 1, dist + 2]) {
      for (const [dr, dc] of dirs) {
        const r = o.row + dr * d;
        const c = o.col + dc * d;
        if (this._tileOk(r, c)) return { row: r, col: c };
      }
    }
    return null;
  },

  _setupScene() {
    const o = Obelisks.byTeam("player");
    // Sin setas explosivas ni gnomos ajenos: escena limpia.
    if (typeof Mushrooms !== "undefined") Mushrooms.resetAll();
    if (typeof Gnome !== "undefined") Gnome.resetAll();
    if (typeof Resources !== "undefined") Resources.resetAll();
    if (typeof Bushes !== "undefined") Bushes.resetAll();
    if (typeof Shops !== "undefined" && Shops.resetAll) Shops.resetAll();
    // Un único tótem (el de práctica); los demás fuera de escena.
    if (Villages.list.length > 1) {
      Villages.list.slice(1).forEach((x) => x.el && x.el.remove());
      Villages.list = Villages.list.slice(0, 1);
    }
    // Gnomo de práctica, cerca pero no pegado a la base.
    const gSpot = this._spotAt(3, [[1, 0], [0, 1], [1, 1], [-1, 1], [1, -1]]);
    if (gSpot) Gnome.spawnNear(gSpot.row, gSpot.col);
    // Tótem frágil (3 de vida) a una distancia alcanzable.
    const v = Villages.list[0];
    const vSpot = this._spotAt(4, [[0, 1], [1, 0], [1, 1], [-1, 1], [1, -1]]);
    if (v && vSpot) {
      v.row = vSpot.row;
      v.col = vSpot.col;
      Villages._placeInstant(v);
      v.hp = 3;
      Units.updateHpBar(v);
    }
    if (typeof Glory !== "undefined") Glory.points.player = 60;
    if (typeof Glory !== "undefined" && Glory.refresh) Glory.refresh();
    // Revela toda la zona de práctica YA (durante la pantalla de carga, sin
    // animación): así al abrirse el tutorial no hay un "ZAS" de niebla.
    if (typeof Fog !== "undefined" && Fog.revealAround) {
      Fog.revealAround(o.row, o.col, 8, true);
      Fog.applyVisibility();
    }
    this._ctx.villageId = v && v.id;
  },

  // ---------- Utilidades de estado ----------
  _my() {
    return Units.list.filter((u) => u.team === "player");
  },
  _ob() {
    return Obelisks.byTeam("player");
  },
  _village() {
    return Villages.list.find((v) => v.id === this._ctx.villageId) || Villages.list[0];
  },
  _gnome() {
    return Gnome.list[0] || null;
  },
  _refill() {
    if (typeof Turns === "undefined") return;
    Turns._resetTeamActions("player");
    Turns._updateButtonState && Turns._updateButtonState();
  },
  _marker(cls, row, col) {
    return [...document.querySelectorAll(`.board-marker.${cls}`)].find(
      (m) => Number(m.dataset.row) === row && Number(m.dataset.col) === col
    );
  },
  _anyMarker(cls) {
    return document.querySelector(`.board-marker.${cls}`);
  },
  // El Obelisco: el sprite entero (la señal se centra en él).
  _obTop() {
    return this._ob().el.querySelector(".obelisk__sprite") || this._ob().el;
  },
  // Hueco de TruenoEspora en el popup de reclutar.
  _trueno() {
    const slots = Obelisks._slotsEl;
    if (!slots) return null;
    return (
      [...slots.querySelectorAll(".backpack-slot")].find((s) => {
        const img = s.querySelector("img");
        return img && img.alt === "TruenoEspora";
      }) || slots.querySelector(".backpack-slot")
    );
  },
  // Ventana (popup) cerrada tras abrirla: paso de "abre y cierra".
  _openClose(flagKey, isOpen, menuCls) {
    const T = this;
    return {
      quick: true,
      target: () => {
        const ov = isOpen();
        if (ov) return ov.querySelector(".backpack-close-btn");
        if (Obelisks._selectedId === T._ob().id) return T._ob().el.querySelector(menuCls);
        return T._obTop();
      },
      done: () => {
        if (isOpen()) T._ctx[flagKey] = true;
        return !!T._ctx[flagKey] && !isOpen();
      },
    };
  },
  _unitEl(u) {
    return u && (u.spriteEl || u.el);
  },
  // Señala primero a `unit` (si no está seleccionada) y luego al marcador.
  _unitThen(unit, markerFn) {
    if (!unit || !unit.el) return null;
    if (Units.selectedId !== unit.id) return this._unitEl(unit);
    return markerFn() || this._unitEl(unit);
  },

  // ---------- Pasos ----------
  // Estado de ánimo de Nizak en el diálogo de cada paso (la réplica al
  // completar la misión siempre es "aplaude", con desinterés).
  _MOODS: ["grunon", "normal", "normal", "normal", "grunon", "normal", "normal", "grunon", "normal", "grunon", "normal", "grunon", "grunon", "normal", "normal", "normal", "normal", "grunon", "normal", "normal", "grunon", "aplaude"],

  _setMood(m) {
    const P = this._els.portrait;
    if (!P) return;
    P.querySelectorAll(".tut-portrait__img").forEach((img) => {
      const on = img.dataset.mood === m;
      if (on && !img.classList.contains("tut-portrait__img--on")) {
        img.classList.remove("tut-portrait__img--on");
        void img.offsetWidth;
      }
      img.classList.toggle("tut-portrait__img--on", on);
    });
  },

  // Pasos con los textos de js/tutorial-texts.js (o los del borrador del debug
  // de diálogos, solo si se activó allí "usar mis cambios en el juego").
  _steps() {
    const steps = this._stepsRaw();
    const tx = this._textsFor(this._scenario);
    if (tx) {
      steps.forEach((s, i) => {
        const t = tx[i];
        if (!t) return;
        ["say", "mission", "ok", "button"].forEach((k) => {
          if (s[k] && t[k]) {
            s[k] = t[k];
            if (t.en && t.en[k] && typeof I18N !== "undefined" && I18N.addTr) I18N.addTr(t[k], t.en[k]);
          }
        });
        if (t.mood) s.mood = t.mood;
      });
    }
    return steps;
  },

  _textsFor(scenario) {
    try {
      if (localStorage.getItem("gg_tutorial_debug") === "1") {
        const draft = JSON.parse(localStorage.getItem("gg_tutorial_texts_draft") || "null");
        if (draft && draft[scenario]) return draft[scenario];
      }
    } catch (e) {}
    return typeof TUTORIAL_TEXTS !== "undefined" ? TUTORIAL_TEXTS[scenario] : null;
  },

  _stepsRaw() {
    const T = this;
    if (this._scenario === "mush" && this._stepsMush) return this._stepsMush();
    if (this._scenario === "rock" && this._stepsRock) return this._stepsRock();
    return [
      {
        say: `Vaya, otro verdugo. Perdón, «jugador»: así os llamamos antes de que nos aplastéis. Soy ${TUTORIAL_GUIDE_NAME}, llevo media vida dedicándome a ser vuestra pelota en este deporte de majaras. Siempre digo que de algo hay que vivir. Bueno, vivir, vivir... Te enseñaré lo básico para que, al menos, me aplastes con cierta elegancia.`,
        button: "Vale, viejales",
      },
      {
        say: `Esa roca mugrienta de 2 metros es tu Obelisco Ancestral: hogar, fábrica de reclutas y retrete, todo en uno. Pulsa sobre él. No muerde (nosotros los gnomos sí, pero de eso hablaremos en otro momento).`,
        mission: "Pulsa tu Obelisco",
        quick: true,
        target: () => T._obTop(),
        done: () => Obelisks._selectedId === T._ob().id || !!Obelisks._overlayEl || T._my().length > 0,
        ok: "Muy bien. Has tocado una piedra. Han dado diplomas por menos.",
      },
      {
        say: `Ahora pulsa sobre el icono de Reclutar, el primero de los tres. El de la izquierda… ¿Sabes cuál te digo, no?`,
        mission: "Pulsa el icono de Reclutar",
        quick: true,
        target: () => T._ob().el.querySelector(".obelisk__menu-btn--recruit") || T._ob().el.querySelector(".obelisk__menu-btn"),
        done: () => !!Obelisks._overlayEl || !!Obelisks._pendingRecruit || T._my().length > 0,
        ok: "Perfecto. Ya estás en la sala de entrenamiento. La idea era reunir a los mejores, pero se nos iba el presupuesto.",
      },
      {
        say: `Elige a TruenoEspora, el del sombrero de seta: no está nada mal, es bastante versátil y esconde una seta-trampa bajo la manga. Cada uno cuesta Puntos de Gloria, ese número amarillo y reluciente de arriba, lo único bonito de todo este asunto.`,
        mission: "Elige a TruenoEspora",
        quick: true,
        target: () => T._trueno(),
        done: () => !!Obelisks._selectedTypeId || !!Obelisks._pendingRecruit || T._my().length > 0,
        ok: "Mira qué sonrisa, ya sabe a lo que ha venido. Una lástima que los míos no estén tan contentos.",
      },
      {
        say: `Ahora pulsa RECLUTAR. Un clic más y tendrás bajo tus órdenes a otro pobre diablo que firma sin haber leído la letra pequeña.`,
        mission: "Pulsa RECLUTAR",
        quick: true,
        target: () => Obelisks._recruitBtnEl || null,
        done: () => !!Obelisks._pendingRecruit || T._my().length > 0,
        ok: "¡Estupendo! Veo que has encontrado el botón. No despediremos al diseñador de interfaces… de momento.",
      },
      {
        say: `Las casillas destacadas te indican los sitios disponibles donde colocarlo junto al Obelisco. Elige una y tu unidad aparecerá ahí, como un champiñón, pero con peor carácter.`,
        mission: "Elige una casilla para colocarlo",
        target: () => T._placeMarker(),
        done: () => T._my().length >= 1,
        ok: "¡Ya tienes un compañero leal! A ver si la lealtad le dura mucho cuando empiece a salpicar la sangre.",
        onStart: () => T._refill(),
      },
      {
        say: `Antes de seguir, un truco útil: selecciona a TruenoEspora y mantén pulsada la cara de tu unidad, abajo a la izquierda, y verás todas sus estadísticas. Con las unidades enemigas funciona igual: selecciónalas y mira de qué pasta están hechas… antes de que te hagan pasta a ti.`,
        mission: "Mantén pulsada su cara (3 s)",
        hold: true,
        onStart: () => {
          T._ctx.infoSeen = false;
        },
        target: () => {
          const u = T._my()[0];
          if (!u) return null;
          if (Units.selectedId !== u.id) return T._unitEl(u);
          return document.getElementById("unit-info-btn") || T._unitEl(u);
        },
        done: () => !!T._ctx.infoSeen,
        ok: "Ahora sabes cuánto aguanta, cuánto pega y cuánto le queda. Información de oro, y gratis.",
      },
      {
        say: `Uno solo se aburre, y yo me aburro con él. Recluta otro igual: Obelisco, Reclutar, unidad, RECLUTAR y casilla. Necesitarás a alguien a quien lanzar cosas (sí, cosas: yo soy una de ellas).`,
        mission: "Recluta un segunda unidad",
        target: () => {
          if (Obelisks._pendingRecruit) return T._placeMarker();
          if (Obelisks._overlayEl) {
            if (Obelisks._selectedTypeId) return Obelisks._recruitBtnEl;
            return T._trueno();
          }
          if (Obelisks._selectedId === T._ob().id) return T._ob().el.querySelector(".obelisk__menu-btn--recruit");
          return T._obTop();
        },
        done: () => T._my().length >= 2,
        ok: "Dos pardillos mejor que uno. Así la culpa y los remordimientos se repartirán.",
        onStart: () => {
          T._refill();
          // Sin unidad seleccionada para que sus círculos no tapen el Obelisco.
          if (Units.selectedId) Units.deselect();
        },
      },
      {
        say: `Para dar instrucciones a una unidad hay que seleccionarla: pulsa sobre uno de tus aliados. Con cariño, no vayas a clavarle esa flecha puntiaguda voladora en el ojo.`,
        mission: "Selecciona una unidad",
        target: () => T._unitEl(T._my()[0]),
        allow: () => T._my().map((u) => T._unitEl(u)),
        done: () => !!Units.selectedId,
        ok: "¡Eso es! Qué sensación de poder, ¿verdad? Pues no te acostumbres.",
        onStart: () => T._refill(),
      },
      {
        say: `Esos círculos del suelo te indican las zonas a donde puede moverse. Pulsa el que parpadea y se moverá. Ojo: andar gasta una de sus 2 acciones por turno; aquí hasta caminar tiene precio, como en la vida.`,
        mission: "Mueve la unidad hasta la zona marcada.",
        onStart: () => {
          T._refill();
          const u = T._my().find((x) => x.id === Units.selectedId) || T._my()[0];
          T._ctx.moverId = u.id;
          T._ctx.moverFrom = { row: u.row, col: u.col };
        },
        target: () => {
          const u = Units.list.find((x) => x.id === T._ctx.moverId);
          if (!u) return null;
          if (Units.selectedId !== u.id) return T._unitEl(u);
          const g = T._gnome();
          const ms = [...document.querySelectorAll(".board-marker.range-marker:not(.obelisk-placement-marker)")];
          if (!ms.length) return T._unitEl(u);
          if (!g) return ms[0];
          // El círculo más cercano al gnomo.
          ms.sort(
            (a, b) =>
              Math.max(Math.abs(a.dataset.row - g.row), Math.abs(a.dataset.col - g.col)) -
              Math.max(Math.abs(b.dataset.row - g.row), Math.abs(b.dataset.col - g.col))
          );
          return ms[0];
        },
        allow: () => [
          T._unitEl(Units.list.find((x) => x.id === T._ctx.moverId)),
          ...document.querySelectorAll(".board-marker.range-marker:not(.obelisk-placement-marker)"),
        ],
        done: () => {
          const u = Units.list.find((x) => x.id === T._ctx.moverId);
          return u && (u.row !== T._ctx.moverFrom.row || u.col !== T._ctx.moverFrom.col);
        },
        ok: "¡Está andando! Un milagro de la ingeniería orgánica, y sin tropezarse. Bueno, casi.",
      },
      {
        say: `Ese arbusto tan mono no es decoración: es un escondite. Métete dentro y el rival dejará de verte (tú sí te ves, qué detalle). Eso sí: si alguien entra en un arbusto donde ya hay alguien escondido, se llevará un golpe y perderá sus acciones. Esconderse: el arte de no estar donde te buscan.`,
        mission: "Escóndete en el arbusto",
        onStart: () => {
          T._refill();
          const u = T._my().find((x) => x.id === T._ctx.moverId) || T._my()[0];
          T._ctx.hiderId = u && u.id;
          const spot = T._spotAtNear(u, 1);
          if (spot && typeof Bushes !== "undefined") {
            T._ctx.bush = Bushes._create(spot.row, spot.col);
            if (typeof Fog !== "undefined") Fog.applyVisibility();
          }
        },
        target: () => {
          const u = Units.list.find((x) => x.id === T._ctx.hiderId);
          const b = T._ctx.bush;
          if (!u || !b) return null;
          return T._unitThen(u, () => T._marker("range-marker", b.row, b.col)) || T._unitEl(u);
        },
        done: () => {
          const u = Units.list.find((x) => x.id === T._ctx.hiderId);
          const b = T._ctx.bush;
          return !b || (u && u.row === b.row && u.col === b.col);
        },
        ok: "Invisible. Como mi cuenta bancaria.",
      },
      {
        say: `¿Ves ese gnomo de ahí? El que tiembla como un flan. Es Tinkle, mi primo segundo. Aquí lo llamamos «balón». Acércate y pulsa la manita para cogerlo. Si hace falta, tu unidad caminará solo hasta él.`,
        mission: "Coge a Tinkle",
        onStart: () => {
          T._refill();
          const holder = T._my().find((u) => u.id === T._ctx.moverId) || T._my()[0];
          // Sin selección: los iconos de "coger" se crean de cero con Tinkle ya en su sitio.
          if (Units.selectedId) Units.deselect();
          // El personaje sale solo del arbusto (a una casilla libre de al lado).
          const b = T._ctx.bush;
          if (holder && b && holder.row === b.row && holder.col === b.col) {
            const out = T._spotAtNear(holder, 1);
            if (out) {
              holder.row = out.row;
              holder.col = out.col;
              Units._placeInstant(holder);
            }
          }
          // Tinkle se acerca al personaje para que el alcance nunca sea un problema.
          const g = T._gnome();
          const spot = holder && T._spotAtNear(holder);
          if (g && spot) {
            g.row = spot.row;
            g.col = spot.col;
            Units._placeInstant(g);
          }
          if (typeof Fog !== "undefined") Fog.applyVisibility();
        },
        target: () => {
          const g = T._gnome();
          const holder = T._my().find((u) => u.id === T._ctx.moverId) || T._my()[0];
          if (!g || !holder) return null;
          return T._unitThen(holder, () => T._marker("catch-marker", g.row, g.col));
        },
        done: () => T._my().some((u) => Gnome.isHeldBy(u.id)),
        ok: "Tinkle, perdóname. Eras tú o yo.",
      },
      {
        say: `Y ahora lo MÁS ingenioso del juego: ¡Golpéalo! Cada golpe le suma puntos (cuanta más fuerza, más puntos) y esos puntos serán el daño de tu “estampada”. Nuestro deporte nacional, ¡yupi! Sí, ya sé que suena a locura. De hecho lo es.`,
        mission: "Golpea al gnomo (icono del puño)",
        onStart: () => {
          T._refill();
          const h = T._my().find((u) => Gnome.isHeldBy(u.id));
          T._ctx.holderId = h && h.id;
        },
        target: () => {
          const h = Units.list.find((u) => u.id === T._ctx.holderId);
          if (h && Units.selectedId !== h.id) return T._unitEl(h);
          return Gnome._hitBtn || T._unitEl(h);
        },
        done: () => {
          const g = T._gnome();
          return g && g.points >= 3;
        },
        ok: "¡Puntos! Tinkle, de toda la familia, tú siempre fuiste quien mejor encajaba los golpes. Bueno, el tío Klink era mejor, pero el tío Klink solo es un recuerdo, un recuerdo disperso sobre el césped...",
      },
      {
        say: `Noticia: pasarse el balón también da puntos, por si en algún momento te duelen los nudillos. Pulsa el icono de lanzar y luego selecciona a tu amigo. Quien lanza gasta acción; quien recibe, no. Es lo más parecido a la justicia que verás por aquí.`,
        mission: "Lánzale el gnomo a otra unidad.",
        onStart: () => T._refill(),
        target: () => {
          const h = Units.list.find((u) => u.id === T._ctx.holderId);
          if (h && Units.selectedId !== h.id) return T._unitEl(h);
          const g = T._gnome();
          if (g && g.passing) return T._anyMarker("pass-marker");
          return Gnome._passBtn || T._unitEl(h);
        },
        done: () => {
          const h = T._my().find((u) => Gnome.isHeldBy(u.id));
          return h && h.id !== T._ctx.holderId;
        },
        ok: "¡Buen lanzamiento! Tinkle, ¿todo bien? Se te ve mareado.",
      },
      {
        say: `Mientras uno carga con el gnomo no puede atacar, así que el que tenga las manos libres que se encargue de ese que te mira raro. Tranquilo, no devolverá el golpe (ni siquiera sabe, al pobre lo han programado para que no lo haga). Selecciona a tu unidad libre y pulsa al enemigo.`,
        mission: "Ataca al enemigo",
        onStart: () => {
          // Espera a que el pase termine para saber quién lleva a Tinkle.
          const me = T._ctx.step;
          const spawn = (tries) => {
            if (!T.active || T._ctx.step !== me) return;
            const holder = T._my().find((u) => Gnome.isHeldBy(u.id));
            if (!holder && tries < 12) return setTimeout(() => spawn(tries + 1), 300);
            T._refill();
            const free = T._my().find((u) => !Gnome.isHeldBy(u.id)) || T._my()[0];
            T._ctx.fighterId = free && free.id;
            const spot = T._findSpot(free, { minD: 2, maxD: 3, side: "center" });
            const enemyType = Object.keys(UNIT_TYPES).find((k) => UNIT_TYPES[k].raceId !== "mushboom_forest");
            if (spot && enemyType) {
              const d = Units.spawnUnit({ typeId: enemyType, row: spot.row, col: spot.col, team: "enemy" });
              d.hp = Math.min(d.hp, 3);
              Units.updateHpBar(d);
              T._ctx.dummyId = d.id;
              T._ctx.dummyHp = d.hp;
              if (typeof Fog !== "undefined") Fog.applyVisibility();
            }
          };
          spawn(0);
        },
        target: () => {
          const f = Units.list.find((u) => u.id === T._ctx.fighterId);
          const d = Units.list.find((u) => u.id === T._ctx.dummyId);
          if (!f) return null;
          if (!d) return T._unitEl(f);
          // Si el luchador se desplazó, el rival de práctica se recoloca a su lado.
          if (!f.moving && Math.max(Math.abs(f.row - d.row), Math.abs(f.col - d.col)) > 3) {
            const spot = T._findSpot(f, { minD: 2, maxD: 3, side: "center" });
            if (spot) {
              d.row = spot.row;
              d.col = spot.col;
              Units._placeInstant(d);
              if (typeof Fog !== "undefined") Fog.applyVisibility();
            }
          }
          return T._unitThen(f, () => T._marker("attack-marker", d.row, d.col)) || T._unitEl(d);
        },
        refillFor: () => T._ctx.fighterId,
        done: () => {
          const d = Units.list.find((u) => u.id === T._ctx.dummyId);
          return !d || d.hp < T._ctx.dummyHp;
        },
        ok: "Muy bien. Ahora seguro que le duele algo, y mañana también.",
      },
      {
        say: `¿Ves ese pino? Y las rocas, y la mena de hierro: también se golpean. Tienen 2 puntos de resistencia y, al romperse, sueltan un recurso que vuela solito hasta tu mochila (abajo a la izquierda). Selecciona a tu unidad libre y pulsa el pino. Ojalá salga todo bien, toquemos madera.`,
        mission: "Tala el pino (2 golpes)",
        onStart: () => {
          T._refill();
          const f = T._my().find((u) => !Gnome.isHeldBy(u.id)) || T._my()[0];
          T._ctx.cutterId = f && f.id;
          const spot = T._findSpot(f, { minD: 2, maxD: 3, side: "center", minOb: 3 });
          if (spot && typeof Resources !== "undefined") {
            T._ctx.pine = Resources._create("pino", spot.row, spot.col);
            if (typeof Fog !== "undefined") Fog.applyVisibility();
          }
        },
        target: () => {
          const f = Units.list.find((u) => u.id === T._ctx.cutterId);
          const p = T._ctx.pine;
          if (!f) return null;
          if (!p || !Resources.list.includes(p)) return T._unitEl(f);
          return T._unitThen(f, () => T._marker("resource-node-attack-marker", p.row, p.col)) || T._unitEl(p);
        },
        refillFor: () => T._ctx.cutterId,
        done: () => (Resources.counts.madera || 0) > 0,
        ok: "¡Madera conseguida! Ya puedes fabricarme un ataúd... o una mejora de armadura, que queda más elegante. En la armería de tu obelisco tienes las mejoras de equipo.",
      },
      {
        say: `Por si no te parecía suficientemente satisfactorio reventar gnomos... ¿ves ese cofre escondido en un rincón? En las partidas de verdad hay un buen puñado repartidos por el mapa. Se abren haciendo clic sobre ellos y esconden reliquias, de las que dan ventajas de las buenas… Cuando las consigas, cada vez que muera una unidad tuya, perderán 1 punto de durabilidad, y cuando lleguen a 0 se rompen. Como la clavícula de mi tío Klink.`,
        mission: "Abre el cofre de reliquias",
        onStart: () => {
          T._refill();
          const f = T._my().find((u) => !Gnome.isHeldBy(u.id)) || T._my()[0];
          T._ctx.cutterId = f && f.id;
          const spot = T._findSpot(f, { minD: 2, maxD: 3, side: "center", minOb: 3 });
          if (spot && typeof Resources !== "undefined") {
            T._ctx.chest = Resources._create("cofre", spot.row, spot.col);
            if (typeof Fog !== "undefined") Fog.applyVisibility();
          }
        },
        target: () => {
          const f = Units.list.find((u) => u.id === T._ctx.cutterId);
          const c = T._ctx.chest;
          if (!f) return null;
          if (!c || !Resources.list.includes(c)) return T._unitEl(f);
          return T._unitThen(f, () => T._marker("resource-node-attack-marker", c.row, c.col)) || T._unitEl(c);
        },
        refillFor: () => T._ctx.cutterId,
        done: () => typeof Relics !== "undefined" && Relics.list("player").length > 0,
        ok: "¡Reliquia en la mochila! Son las Botas TrotaMontes: +1 de Movimiento para todas tus unidades. Fíjate en su marcador, ese 5/5 que tiene al lado: esa es su durabilidad. Cuida de tus unidades o las botas se gastarán antes de tiempo. Y no, no guardo el ticket de compra, así que olvídate de la garantía.",
      },
      {
        say: `No hay nada mejor que conquistar un tótem con un gnomo cargado de puntos. Tu unidad lo estampa contra él y le resta tanta vida como puntos lleve. Si se queda sin puntos, el tótem es tuyo y te da +2 Puntos de Gloria cada turno. Siempre dos, se capture como se capture. Sí, dos, ya puedes ir pensando en la jubilación. ¿Por qué me miras a mí y al tótem de esa manera? Acércate con quien lleva el gnomo y pulsa la diana. Lo que la gente del gremio conoce como “estampada”.`,
        mission: "Haz una “estampada” con el gnomo contra el tótem",
        onStart: () => {
          T._refill();
          const h = T._my().find((u) => Gnome.isHeldBy(u.id));
          T._ctx.captorId = h && h.id;
          // El tótem se acerca al portador para que baste un clic de estampada.
          const v = T._village();
          const spot = h && v && T._findSpot(h, { minD: 2, maxD: 3, side: "center", minOb: 3 });
          if (v && spot) {
            v.row = spot.row;
            v.col = spot.col;
            Villages._placeInstant(v);
            if (typeof Fog !== "undefined") Fog.applyVisibility();
          }
        },
        target: () => {
          const h = Units.list.find((u) => u.id === T._ctx.captorId);
          const v = T._village();
          if (!h || !v) return null;
          if (Units.selectedId !== h.id) return T._unitEl(h);
          const m = T._marker("attack-marker", v.row, v.col) || T._anyMarker("village-attack-marker");
          if (m) return m;
          // Aún no llega: señala el tótem y el círculo de movimiento más cercano.
          const ms = [...document.querySelectorAll(".board-marker.range-marker:not(.obelisk-placement-marker)")];
          if (ms.length) {
            ms.sort(
              (a, b) =>
                Math.max(Math.abs(a.dataset.row - v.row), Math.abs(a.dataset.col - v.col)) -
                Math.max(Math.abs(b.dataset.row - v.row), Math.abs(b.dataset.col - v.col))
            );
            return ms[0];
          }
          return v.el.querySelector(".village__sprite") || v.el;
        },
        refillFor: () => T._ctx.captorId,
        done: () => {
          const v = T._village();
          return v && v.owner === "player";
        },
        ok: "¡Un tótem conquistado! ¿Tinkle? ¿Alguien puede llamar a emergencias? O a una funeraria... Y un truco: si una de tus unidades empieza el turno pegada a un tótem tuyo, recarga su habilidad especial. Capturar tótems también sirve para eso.",
      },
      {
        say: `Tu Obelisco guarda más trucos. Selecciónalo y abre Habilidades: tres ramas (Guerra, Protección y Supervivencia) con mejoras permanentes que se compran con Puntos de Gloria. Échale un vistazo y ciérrala con la X. No te pido que entiendas nada, de momento con que sepas que está ahí, es suficiente.`,
        mission: "Abre Habilidades y ciérrala",
        onStart: () => {
          T._ctx.skOpened = false;
        },
        ...T._openClose("skOpened", () => Obelisks._abilitiesOverlayEl, ".obelisk__menu-btn--abilities"),
        ok: "Demasiado árbol de habilidades para tan poco bosque.",
      },
      {
        say: `Y por último, la Armería: aquí gastas esa madera, roca y metal en subir el Arma y la Armadura de todas tus unidades, nivel a nivel (el 1 cuesta una madera y una roca). Es el único sitio de este juego donde la madera sirve para algo bueno. Ábrela y ciérrala.`,
        mission: "Abre la Armería y ciérrala",
        onStart: () => {
          T._ctx.arOpened = false;
        },
        ...T._openClose("arOpened", () => (typeof Armory !== "undefined" && Armory._overlayEl) || null, ".obelisk__menu-btn--armory"),
        ok: "Ahora sabes dónde gastar los restos de la deforestación.",
      },
      {
        say: `Cuando tus unidades se queden sin acciones (o sin ganas), pulsa PASAR TURNO. Luego jugará el rival y luego vuelves tú… Y así sucesivamente. Es como la vida: esperas tu turno, esperas, esperas, estampas un gnomo contra el césped, vuelves a esperar...`,
        mission: "Pulsa PASAR TURNO",
        onStart: () => {
          T._ctx.round = Turns.roundNumber;
        },
        target: () => Turns._btn || document.querySelector(".end-turn-btn"),
        done: () => Turns.roundNumber > T._ctx.round && Turns.activeTeam === "player" && !Turns._aiRunning,
        ok: "Y el rival... no hizo nada. Era de esperar, esto es un tutorial.",
      },
      {
        say: `Lo has conseguido. Ya sabes reclutar, mover, esconderte, coger gnomos, lanzarlos, estamparlos, atacar, talar, abrir cofres de reliquias, mejorar y conquistar. ¡Enhorabuena! Oficialmente ya eres todo un asesino de gnomos... aunque me parta lo poco que me queda de corazón o de lomo, según transcurra la partida. Y recuerda: si algún gnomo te mira raro, es que ya conoce tus intenciones.`,
        button: "TERMINAR TUTORIAL",
        final: true,
      },
    ];
  },

  // ¿Hay algo (unidad, tótem, arbusto, recurso, gnomo, Obelisco...) a menos de `rad` casillas?
  _entityNear(r, c, rad) {
    const near = (e) => e && Math.max(Math.abs(e.row - r), Math.abs(e.col - c)) <= rad;
    const lists = [
      Units.list,
      typeof Villages !== "undefined" ? Villages.list : [],
      typeof Bushes !== "undefined" ? Bushes.list : [],
      typeof Resources !== "undefined" ? Resources.list : [],
      typeof Gnome !== "undefined" ? Gnome.list : [],
      typeof Obelisks !== "undefined" ? Obelisks.list : [],
      typeof Shops !== "undefined" ? Shops.list : [],
    ];
    return lists.some((l) => (l || []).some(near));
  },

  // Loseta libre a `minD`..`maxD` casillas de `origin`, hacia la derecha (o
  // abajo) en pantalla y con aire alrededor: nada de apelotonar.
  _findSpot(origin, { minD = 2, maxD = 3, side = "right", minOb = 2 } = {}) {
    if (!origin) return null;
    const ob = this._ob();
    const cheb = (a, b, c, d) => Math.max(Math.abs(a - c), Math.abs(b - d));
    let best = null;
    for (const rad of [1, 0]) {
      for (let r = 0; r < Units.boardSize; r++) {
        for (let c = 0; c < Units.boardSize; c++) {
          const d = cheb(r, c, origin.row, origin.col);
          if (d < minD || d > maxD) continue;
          if (ob && cheb(r, c, ob.row, ob.col) < minOb) continue;
          if (!this._tileOk(r, c)) continue;
          if (this._entityNear(r, c, rad) && rad > 0) continue;
          if (rad === 0 && this._entityNear(r, c, 0)) continue;
          const p = getTileCenter(r, c, Units.boardSize);
          // "center": hacia el centro del mapa (el Obelisco puede estar en cualquier lado).
          const mid = getTileCenter(Math.floor(Units.boardSize / 2), Math.floor(Units.boardSize / 2), Units.boardSize);
          const score = (side === "below" ? p.y : side === "right" ? p.x : -Math.hypot(p.x - mid.x, p.y - mid.y)) - d * 4;
          if (!best || score > best.score) best = { row: r, col: c, score };
        }
      }
      if (best) return best;
    }
    return null;
  },

  // Casilla de colocación destacada, siempre bien visible (el Obelisco puede
  // estar en cualquier parte del mapa): nunca detrás del Obelisco, en el lado
  // con más sitio; la 2.ª, la de más abajo (por delante del Obelisco).
  _placeMarker() {
    const ms = [...document.querySelectorAll(".board-marker.obelisk-placement-marker")];
    if (!ms.length) {
      this._pmEl = null;
      return null;
    }
    // Elección estable: antes se recalculaba cada fotograma según la posición en
    // pantalla (que cambia al mover la cámara) y el puntero saltaba entre dos casillas.
    if (this._pmEl && this._pmEl.isConnected && ms.includes(this._pmEl)) return this._pmEl;
    const rc = (m) => {
      const r = m.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const sp = (this._ob().el.querySelector(".obelisk__sprite") || this._ob().el).getBoundingClientRect();
    const ox = sp.left + sp.width / 2;
    // Tapada = dentro del recuadro del sprite y por encima de su base.
    const covered = (m) => {
      const c = rc(m);
      return c.x > sp.left + 30 && c.x < sp.right - 30 && c.y < sp.bottom - 40;
    };
    const free = ms.filter((m) => !covered(m));
    const pool = free.length ? free : ms;
    if (this._my().length === 0) {
      // Lado con más espacio hacia el centro de la pantalla.
      const dir = ox < window.innerWidth / 2 ? 1 : -1;
      this._pmEl = pool.sort((a, b) => (rc(b).x - rc(a).x) * dir)[0];
      return this._pmEl;
    }
    this._pmEl = pool.sort((a, b) => rc(b).y - rc(a).y)[0];
    return this._pmEl;
  },

  // Casilla libre junto a `unit`, la más cercana al Obelisco (el centro de la
  // escena): así lo nuevo nunca queda pegado a los bordes ni bajo la interfaz.
  _spotAtNear(unit, maxD = 2) {
    if (!unit) return null;
    const ob = this._ob();
    // Primero lo más despejado (a 3+ casillas del Obelisco); si no hay
    // hueco, se va relajando para que NUNCA falte el sitio (y el paso no se salte).
    for (const minOb of [3, 2, 1]) {
      for (const reach of maxD === 1 ? [1, 2] : [maxD]) {
        let best = null;
        for (let dr = -reach; dr <= reach; dr++) {
          for (let dc = -reach; dc <= reach; dc++) {
            if (!dr && !dc) continue;
            const r = unit.row + dr;
            const c = unit.col + dc;
            if (!this._tileOk(r, c)) continue;
            if (this._entityNear(r, c, 0)) continue;
            if (Math.max(Math.abs(r - ob.row), Math.abs(c - ob.col)) < minOb) continue;
            const score = Math.hypot(r - ob.row, c - ob.col) + Math.max(Math.abs(dr), Math.abs(dc)) * 0.8;
            if (!best || score < best.score) best = { row: r, col: c, score };
          }
        }
        if (best) return best;
      }
    }
    return null;
  },

  // ---------- Motor de pasos ----------
  _goto(i) {
    const steps = this._steps();
    clearInterval(this._timer);
    if (!this.active) return;
    this.stepIndex = i;
    const s = steps[i];
    if (!s) return this.finish();
    this._ctx.step = s;
    if (typeof TutorialFrame !== "undefined") TutorialFrame.clearFocus();
    if (s.onStart) s.onStart();
    this._renderStep(s, i, steps.length);
    if (s.done) {
      this._timer = setInterval(() => {
        if (!this.active) return clearInterval(this._timer);
        let ok = false;
        try {
          ok = s.done();
        } catch (e) {}
        // Pasos que gastan varios turnos de acciones: se recargan solas.
        if (!ok && s.refillFor) {
          try {
            const u = Units.list.find((x) => x.id === s.refillFor());
            if (u && Turns.remainingActions(u) <= 0 && !u.moving && !(typeof Gnome !== "undefined" && Gnome.list.some((g) => g.busy))) this._refill();
          } catch (e) {}
        }
        if (ok) {
          clearInterval(this._timer);
          this._onDone(s, i);
        }
      }, 150);
    }
  },

  _onDone(s, i) {
    clearTimeout(this._okTimer);
    this._ctx.pointerTarget = null;
    if (typeof SFX !== "undefined") SFX.passSuccess && SFX.passSuccess();
    const m = this._els.mission;
    if (m) m.classList.add("tut-mission--done");
    const go = () => {
      clearTimeout(this._okTimer);
      cancelAnimationFrame(this._okRaf);
      this._advance = null;
      if (this.active && this.stepIndex === i) this._goto(i + 1);
    };
    if (s.ok) {
      this._setMood("aplaude");
      this._typeText(s.ok);
    }
    // Avance automático y cómodo: la frase se lee a su ritmo y el botón
    // CONTINUAR se va "llenando". Pasar el ratón por la viñeta pausa la
    // espera; pulsar la viñeta/botón, Enter o Espacio adelanta al instante.
    const E = this._els;
    E.btn.style.display = "";
    E.btn.textContent = "Continuar ▸";
    E.btn.classList.remove("tut-btn--final");
    E.btn.style.setProperty("--p", "0%");
    const len = s.ok ? s.ok.length : 0;
    const typeMs = (len / 2) * 24;
    // Tiempo de lectura generoso (antes los pasos "quick" saltaban sin dar tiempo a leer).
    const total = typeMs + (s.quick ? 1800 + len * 60 : 2400 + len * 70);
    let elapsed = 0;
    let last = performance.now();
    cancelAnimationFrame(this._okRaf);
    const tick = (now) => {
      if (!this.active || this.stepIndex !== i) return;
      const paused = E.panel.matches(":hover");
      if (!paused) elapsed += now - last;
      last = now;
      E.btn.style.setProperty("--p", `${Math.min(100, (elapsed / total) * 100)}%`);
      if (elapsed >= total) return go();
      this._okRaf = requestAnimationFrame(tick);
    };
    this._okRaf = requestAnimationFrame(tick);
    this._advance = () => {
      if (typeof SFX !== "undefined") SFX.click();
      go();
    };
    E.btn.onclick = this._advance;
  },

  _renderStep(s, i, total) {
    const E = this._els;
    cancelAnimationFrame(this._okRaf);
    this._advance = null;
    this._setMood(s.mood || (this._scenario === "basic" ? this._MOODS[i] : null) || "normal");
    this._typeText(s.say);
    E.mission.classList.remove("tut-mission--done");
    E.mission.style.display = s.mission ? "" : "none";
    if (s.mission) {
      E.missionLabel.textContent = `MISIÓN ${this._missionNumber(i)}`;
      E.missionText.textContent = s.mission;
    }
    E.btn.style.display = s.button ? "" : "none";
    if (s.button) {
      E.btn.textContent = s.button;
      E.btn.classList.toggle("tut-btn--final", !!s.final);
      E.btn.onclick = () => {
        if (typeof SFX !== "undefined") SFX.click();
        if (s.final) this.finish();
        else this._goto(i + 1);
      };
    }
    E.skip.style.display = s.final ? "none" : "";
    const done = this._steps().slice(0, i).filter((x) => x.mission).length;
    const totalMissions = this._steps().filter((x) => x.mission).length;
    E.progressBar.style.width = `${Math.round((done / totalMissions) * 100)}%`;
    this._ctx.pointerTarget = s.target || null;
    if (typeof TutorialFrame !== "undefined") TutorialFrame.reset();
    E.panel.classList.add("tut-panel--pop");
    setTimeout(() => E.panel.classList.remove("tut-panel--pop"), 400);
  },

  _missionNumber(i) {
    return this._steps().slice(0, i + 1).filter((x) => x.mission).length;
  },

  _typeText(text) {
    if (typeof I18N !== "undefined" && I18N.tr) text = I18N.tr(text);
    clearTimeout(this._typeTimer);
    const el = this._els.text;
    let n = 0;
    el.textContent = "";
    this._fullText = text;
    const tick = () => {
      n += 2;
      el.textContent = text.slice(0, n);
      // Murmullo suave y agradable mientras habla (una nota cada pocas letras).
      if (typeof SFX !== "undefined" && SFX.talk && (n / 2) % 2 === 1 && text[n - 1] !== " ") SFX.talk();
      if (n < text.length) this._typeTimer = setTimeout(tick, 24);
      else if (this._els.portrait) this._els.portrait.classList.remove("tut-portrait--talk");
    };
    tick();
    this._els.portrait.classList.add("tut-portrait--talk");
  },

  // Texto puntual de Nizak fuera del guion (p. ej. "inténtalo otra vez").
  _say(text, mood) {
    this._setMood(mood || "grunon");
    this._typeText(text);
  },

  // ---------- Bloqueo: solo se puede hacer lo que pide la misión ----------
  _allowedEls() {
    const s = this._ctx.step;
    let list = [];
    try {
      if (s && s.allow) list = s.allow();
      else if (this._ctx.pointerTarget) list = [this._ctx.pointerTarget()];
    } catch (e) {}
    return (Array.isArray(list) ? list : [list]).filter(Boolean);
  },

  _installGuard() {
    if (this._guard) return;
    const handler = (e) => {
      if (!this.active || this._bypass) return;
      const t = e.target;
      if (!t || !t.closest) return;
      // Interfaz propia del tutorial y ajustes: siempre disponibles.
      if (t.closest(".tut-panel, .tut-skip, .tut-hold, [class*='settings']")) return;
      const x = e.clientX;
      const y = e.clientY;
      const obEl = this._ob() && this._ob().el;
      const obSprite = obEl && obEl.querySelector(".obelisk__sprite");
      for (const a of this._allowedEls()) {
        try {
          if (a.contains && a.contains(t)) return;
          const u = a.closest && a.closest(".unit");
          if (u && u.contains(t)) return;
          const r = a.getBoundingClientRect();
          if (r.width && x >= r.left - 4 && x <= r.right + 4 && y >= r.top - 4 && y <= r.bottom + 4) {
            // Clic sobre el Obelisco señalado aunque una unidad (o el suelo) quede
            // justo encima: se redirige al Obelisco para que nunca falle.
            if (e.type === "click" && a === obSprite && !obEl.contains(t)) {
              e.stopPropagation();
              e.preventDefault();
              this._bypass = true;
              try {
                obEl.click();
              } finally {
                this._bypass = false;
              }
              return;
            }
            return;
          }
        } catch (err) {}
      }
      // Arrastrar el mapa (pulsar sobre el suelo) sigue permitido.
      if (e.type !== "click" && e.type !== "dblclick" && !t.closest("button, .board-marker, .unit, .backpack-overlay, .obelisk")) return;
      e.stopPropagation();
      e.preventDefault();
    };
    const types = ["click", "dblclick", "pointerdown", "mousedown"];
    types.forEach((ty) => document.addEventListener(ty, handler, true));
    this._guard = { handler, types };
  },

  _removeGuard() {
    if (!this._guard) return;
    this._guard.types.forEach((ty) => document.removeEventListener(ty, this._guard.handler, true));
    this._guard = null;
  },

  // ---------- Contador: mantener pulsada la cara (3 s) ----------
  _installHold() {
    if (this._holdInstalled) return;
    this._holdInstalled = true;
    document.addEventListener(
      "pointerdown",
      (e) => {
        const s = this._ctx && this._ctx.step;
        if (!this.active || !s || !s.hold || this._ctx.infoSeen) return;
        if (e.target && e.target.closest && e.target.closest("#unit-info-btn")) this._holdStart();
      },
      true
    );
    const end = () => this._holdEnd();
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  },

  _holdStart() {
    const H = this._els.hold;
    if (!H || this._hold) return;
    this._hold = { t0: performance.now() };
    H.classList.remove("tut-hold--fail");
    H.classList.add("tut-hold--on");
    this._els.holdLabel.textContent = "Sigue pulsando";
    const loop = () => {
      if (!this._hold || !this.active) return;
      const el = performance.now() - this._hold.t0;
      const left = Math.max(0, 3000 - el);
      this._els.holdNum.textContent = String(Math.ceil(left / 1000) || 0);
      this._els.holdFill.style.width = `${Math.min(100, (el / 3000) * 100)}%`;
      if (el >= 3000) {
        this._hold.ok = true;
        this._els.holdNum.textContent = "✔";
        this._els.holdLabel.textContent = "¡Listo!";
        this._ctx.infoSeen = true;
        if (typeof SFX !== "undefined") SFX.passSuccess && SFX.passSuccess();
        setTimeout(() => this._els.hold && this._els.hold.classList.remove("tut-hold--on"), 900);
        return;
      }
      this._holdRaf = requestAnimationFrame(loop);
    };
    this._holdRaf = requestAnimationFrame(loop);
  },

  _holdEnd() {
    const h = this._hold;
    if (!h) return;
    cancelAnimationFrame(this._holdRaf);
    this._hold = null;
    if (h.ok) return;
    const H = this._els.hold;
    if (H) {
      H.classList.add("tut-hold--fail");
      this._els.holdLabel.textContent = "Demasiado pronto";
      setTimeout(() => H.classList.remove("tut-hold--on", "tut-hold--fail"), 700);
    }
    if (typeof SFX !== "undefined") SFX.dropFail && SFX.dropFail();
    this._say(
      "¡Eso no ha sido ni un segundo! Mantén pulsada la cara hasta que el contador llegue a cero, sin soltar. Tranquilo, yo no tengo prisa: es lo único que me sobra.",
      "grunon"
    );
  },

  // ---------- Interfaz ----------
  _buildUI() {
    const E = this._els;
    const panel = document.createElement("div");
    panel.className = "tut-panel";
    panel.innerHTML = `
      <div class="tut-portrait">${Object.keys(TUTORIAL_GUIDE_IMGS).map((k) => `<img class="tut-portrait__img" data-mood="${k}" src="${TUTORIAL_GUIDE_IMGS[k]}" alt="${TUTORIAL_GUIDE_NAME}">`).join("")}</div>
      <div class="tut-main">
        <div class="tut-bubble">
          <div class="tut-name">${TUTORIAL_GUIDE_NAME}</div>
          <p class="tut-text"></p>
          <button type="button" class="tut-btn"></button>
        </div>
        <div class="tut-mission">
          <span class="tut-mission__label"></span>
          <span class="tut-mission__text"></span>
          <span class="tut-mission__check">✔</span>
        </div>
        <div class="tut-progress"><div class="tut-progress__bar"></div></div>
      </div>
      <button type="button" class="tut-skip">Saltar tutorial</button>`;
    document.body.appendChild(panel);
    const hold = document.createElement("div");
    hold.className = "tut-hold";
    hold.innerHTML = '<span class="tut-hold__num">3</span><span class="tut-hold__label">Sigue pulsando</span><div class="tut-hold__bar"><div class="tut-hold__fill"></div></div>';
    document.body.appendChild(hold);
    E.hold = hold;
    E.holdNum = hold.querySelector(".tut-hold__num");
    E.holdLabel = hold.querySelector(".tut-hold__label");
    E.holdFill = hold.querySelector(".tut-hold__fill");
    this._installGuard();
    this._installHold();
    E.panel = panel;
    E.portrait = panel.querySelector(".tut-portrait");
    E.text = panel.querySelector(".tut-text");
    E.btn = panel.querySelector(".tut-btn");
    E.mission = panel.querySelector(".tut-mission");
    E.missionLabel = panel.querySelector(".tut-mission__label");
    E.missionText = panel.querySelector(".tut-mission__text");
    E.progressBar = panel.querySelector(".tut-progress__bar");
    E.skip = panel.querySelector(".tut-skip");
    // Pulsar la viñeta salta la escritura animada.
    panel.querySelector(".tut-bubble").addEventListener("click", () => {
      if (E.text.textContent !== (this._fullText || "")) {
        clearTimeout(this._typeTimer);
        E.text.textContent = this._fullText || "";
      } else if (this._advance) this._advance();
    });
    this._keyHandler = (e) => {
      if (!this.active || !this._advance) return;
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
        e.preventDefault();
        this._advance();
      }
    };
    document.addEventListener("keydown", this._keyHandler);
    // Dos pulsaciones para salir: un clic suelto nunca cierra el tutorial.
    E.skip.addEventListener("click", () => {
      if (!this._skipArmed) {
        this._skipArmed = true;
        E.skip.textContent = "¿Seguro? Pulsa otra vez";
        clearTimeout(this._skipTimer);
        this._skipTimer = setTimeout(() => {
          this._skipArmed = false;
          E.skip.textContent = "Saltar tutorial";
        }, 3000);
        return;
      }
      if (typeof SFX !== "undefined") SFX.back && SFX.back();
      this.finish();
    });

    const pointer = document.createElement("div");
    pointer.className = "tut-pointer";
    pointer.innerHTML = '<span class="tut-pointer__ring"></span><span class="tut-pointer__ring tut-pointer__ring--2"></span><span class="tut-pointer__arrow"></span>';
    document.body.appendChild(pointer);
    E.pointer = pointer;
    const loop = () => {
      if (!this.active) return;
      this._updatePointer();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  },

  // Mantiene a la vista lo que hay que pulsar: la viñeta de Nizak y los botones fijos
  // de la interfaz definen una "zona libre" y TutorialFrame (js/tutorial-frame.js) lleva
  // la cámara para que el objetivo y la acción de alrededor queden dentro de ella.
  _avoidOverlap(r, el) {
    const panel = this._els.panel;
    // Si el rótulo SALTAR queda sobre lo que hay que pulsar, se vuelve
    // transparente al ratón (el clic pasa al objetivo).
    if (this._els.skip) {
      const k = this._els.skip.getBoundingClientRect();
      const over = k.left < r.right + 8 && k.right > r.left - 8 && k.top < r.bottom + 8 && k.bottom > r.top - 8;
      this._els.skip.style.pointerEvents = over ? "none" : "";
      this._els.skip.style.opacity = over ? "0.25" : "";
    }
    if (!panel || this._popupOpen || r.isPopup || !el || typeof TutorialFrame === "undefined") return;
    // La viñeta incluye el rótulo SALTAR TUTORIAL, que sobresale por encima.
    let pr = panel.getBoundingClientRect();
    const sk = this._els.skip && this._els.skip.getBoundingClientRect();
    if (sk && sk.width) pr = { left: Math.min(pr.left, sk.left), right: Math.max(pr.right, sk.right), top: Math.min(pr.top, sk.top), bottom: Math.max(pr.bottom, sk.bottom) };
    TutorialFrame.update(el, pr, false);
  },

  // Con una ventana abierta la viñeta de Nizak se queda arriba, con su texto
  // normal, y la ventana se encoge/baja lo justo para caber DEBAJO de ella.
  _fitPopup(el) {
    if (this._fitEl && this._fitEl !== el && this._fitEl.isConnected) {
      this._fitEl.style.scale = "";
      this._fitEl.style.translate = "";
    }
    this._fitEl = el;
    if (!el) return;
    const P = this._els.panel;
    let bottom = 0;
    [...P.children].forEach((c) => {
      const r = c.getBoundingClientRect();
      if (r.height > 0 && !c.classList.contains("tut-skip")) bottom = Math.max(bottom, r.bottom);
    });
    el.style.transformOrigin = "50% 0";
    const top0 = el.offsetTop;
    const h = el.offsetHeight || 1;
    const ty = Math.max(0, bottom + 10 - top0);
    const avail = window.innerHeight - 8 - (top0 + ty);
    const sc = Math.max(window.innerHeight < 520 ? 0.36 : 0.55, Math.min(1, avail / h));
    el.style.translate = `0 ${ty.toFixed(1)}px`;
    el.style.scale = sc.toFixed(3);
  },

  _frameDefault() {
    if (typeof TutorialFrame === "undefined" || this._popupOpen || !this._els.panel) return;
    let el = null;
    try {
      const sel = Units.selectedId && Units.list.find((x) => x.id === Units.selectedId);
      el = (sel && sel.el) || (this._my()[0] && this._my()[0].el) || (Obelisks.byTeam("player") || {}).el || null;
    } catch (e) {}
    if (!el || !el.isConnected) return;
    const panel = this._els.panel;
    let pr = panel.getBoundingClientRect();
    const sk = this._els.skip && this._els.skip.getBoundingClientRect();
    if (sk && sk.width) pr = { left: Math.min(pr.left, sk.left), right: Math.max(pr.right, sk.right), top: Math.min(pr.top, sk.top), bottom: Math.max(pr.bottom, sk.bottom) };
    TutorialFrame.update(el, pr, false);
  },

  _updatePointer() {
    const P = this._els.pointer;
    if (!P) return;
    if (typeof TutorialFrame !== "undefined") TutorialFrame.layoutPanel(this._els.panel);
    // Con una ventana (reclutar, habilidades...) abierta la viñeta se hace
    // compacta y sube arriba para no tapar sus botones.
    const popupEl = document.querySelector(".backpack-overlay .backpack-panel");
    const popup = !!popupEl;
    if (popup !== this._popupOpen) {
      this._popupOpen = popup;
      this._els.panel.classList.toggle("tut-panel--compact", popup);
      if (!popup) this._fitPopup(null);
    }
    if (popup) this._fitPopup(popupEl);
    let el = null;
    try {
      el = this._ctx.pointerTarget ? this._ctx.pointerTarget() : null;
    } catch (e) {}
    if (!el || !el.isConnected) {
      P.classList.remove("tut-pointer--on");
      // Sin objetivo (pasos de solo texto): se encuadra lo principal (unidad elegida u Obelisco)
      // para que la viñeta y los botones no lo tapen.
      this._frameDefault();
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) {
      P.classList.remove("tut-pointer--on");
      return;
    }
    // Elementos fijos de la interfaz (cara del personaje, botones...) nunca mueven la cámara.
    this._noPan = !!(el.closest && !el.closest(".board-camera"));
    this._avoidOverlap(r, el);
    const size = Math.max(54, Math.min(120, Math.max(r.width, r.height) + 14));
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    P.style.width = P.style.height = `${size}px`;
    P.style.transform = `translate(${cx - size / 2}px, ${cy - size / 2}px)`;
    // Flecha encima salvo que se salga por arriba.
    P.classList.toggle("tut-pointer--below", cy - size / 2 < 90);
    P.classList.add("tut-pointer--on");
  },
};

// Menú principal.
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btn-tutorial");
  if (btn) btn.addEventListener("click", () => (Tutorial.showMenu ? Tutorial.showMenu() : Tutorial.start()));
  // Salir de la partida desde ajustes también cierra el tutorial.
  if (typeof SettingsMenu !== "undefined" && SettingsMenu._exitMatch) {
    const orig = SettingsMenu._exitMatch;
    SettingsMenu._exitMatch = function () {
      if (Tutorial.active) Tutorial.stop();
      return orig.apply(this, arguments);
    };
  }
});

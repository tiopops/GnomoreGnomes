/* Gnomore Gnomes — Tutorial del Modo Campaña (modo extracción).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - La escena de práctica del tutorial de campaña (campamento de Rastreadores
       con su jaula, el Obelisco como zona de extracción) y su guion de misiones,
       con el mismo motor de js/tutorial.js (Nizak, misiones, puntero, bloqueo...).
     - La lógica del modo vive en js/campaign.js (Campaign.beginTutorial); aquí solo
       se orquesta. Los diálogos (ES/EN) también están en js/tutorial-texts.js
       ("campaign") y se editan desde debug/editar-dialogos-nizak.html. */

Object.assign(Tutorial, {
  _buildCampaignScene() {
    Campaign.beginTutorial();
    // Una unidad propia lista junto al Obelisco.
    const spot = this._spotAt(2, [[1, 1], [1, 0], [0, 1], [1, -1], [-1, 1]]);
    const u = Units.spawnUnit({ typeId: "seta_artificiero", row: spot.row, col: spot.col, team: "player" });
    this._ctx.unitId = u.id;
    if (typeof Fog !== "undefined") Fog.revealForUnit(u);
    // Campamento: un Rastreador guardando un gnomo enjaulado, a 2-3 casillas de la unidad.
    if (typeof Gnome !== "undefined" && Gnome.resetAll) Gnome.resetAll();
    const cs = this._around(u, -2, 2) || this._around(u, 2, -2);
    if (!cs) return;
    const guard = Units.spawnUnit({ typeId: "rastreador", row: cs.row, col: cs.col, team: "enemy" });
    const gn = Gnome.spawnNear(cs.row, cs.col);
    Campaign._cage(gn);
    Campaign._camps.push({ row: cs.row, col: cs.col, guards: [guard.id], gnomes: [gn], open: false });
    this._ctx.guard = guard;
    this._ctx.cage = gn;
    if (typeof Fog !== "undefined" && Fog.revealAround) Fog.revealAround(cs.row, cs.col, 4, true);
  },

  _stepsCampaign() {
    const T = this;
    const unit = () => T._myUnit();
    return [
      {
        mood: "grunon",
        say: "Modo Campaña. Aquí no se conquista nada: se EXTRAE. Entras en el bosque, revientas gnomos, rapiñas recursos y sales por patas antes de que alguien se ofenda. Lo que traigas, es tuyo; lo que dejes, es de los lobos.",
        button: "Qué optimista",
        onStart: () => { T._refill(); T._focus(unit(), T._ctx.guard); },
      },
      {
        mood: "normal",
        say: "Esos lobos con lanza son Rastreadores. Se dedican a meter gnomos en jaulas —cada uno se entretiene como quiere— y la jaula no se abre mientras quede un guardia en pie. Ahí tienes un campamento de práctica.",
        button: "Entendido",
        onStart: () => { T._focus(unit(), T._ctx.guard, T._ctx.cage); },
      },
      {
        mood: "normal",
        say: "Para abrir la jaula hay que ablandar a su guardia. Selecciona a tu unidad y pulsa al Rastreador: aguanta dos golpes y no guarda rencor. Cada baja te da 3 puntos.",
        mission: "Derrota al Rastreador",
        ok: "Un lobo menos y 3 puntos más. Las cuentas salen.",
        onStart: () => { T._refill(); T._focus(unit(), T._ctx.guard); },
        target: () => {
          const u = unit(), d = T._ctx.guard;
          if (!u) return null;
          if (!d || !Units.list.includes(d)) return T._unitEl(u);
          // Si la unidad se movió y el Rompeobeliscos quedó lejos (o encima de ella), se recoloca a su lado.
          const dist = Math.max(Math.abs(u.row - d.row), Math.abs(u.col - d.col));
          if (!u.moving && (dist > 3 || dist === 0)) {
            const spot = T._findSpot(u, { minD: 2, maxD: 3, side: "center", minOb: 2 }) || T._around(u, 2, 1);
            if (spot) { d.row = spot.row; d.col = spot.col; Units._placeInstant(d); if (typeof Fog !== "undefined") Fog.applyVisibility(); }
          }
          return T._unitThen(u, () => T._marker("attack-marker", d.row, d.col) || T._nearestRange(d.row, d.col)) || T._unitEl(d);
        },
        refillFor: () => T._ctx.unitId,
        done: () => !!T._ctx.guard && !Units.list.includes(T._ctx.guard),
      },
      {
        mood: "normal",
        say: "¡Jaula abierta! El gnomo liberado es un gnomo de toda la vida: huye, chilla y tiene opiniones sobre cómo lo agarras. Cógelo antes de que se le ocurra algo.",
        mission: "Coge a Tinkle",
        ok: "El famoso Tinkle. Que no se te escape: a veces correr detrás de los gnomos es más cansado de lo que parece.",
        onStart: () => {
          T._refill();
          if (Units.selectedId) Units.deselect();
          T._gnomeBeside(unit());
          T._focus(unit(), T._gnome());
        },
        target: () => {
          const g = T._gnome(), u = unit();
          if (!g || !u) return null;
          return T._unitThen(u, () => T._marker("catch-marker", g.row, g.col));
        },
        refillFor: () => T._ctx.unitId,
        done: () => Gnome.isHeldBy(unit().id),
      },
      {
        mood: "grunon",
        say: "Como en las partidas normales, pegar al gnomo le carga puntos. Eso sí: en la campaña cada gnomo puede acumular 5 golpes. Con uno nos vale.",
        mission: "Golpea a Tinkle",
        ok: "Un puñado de puntos al bolsillo. Tinkle ya no se sienta bien.",
        onStart: () => { T._refill(); T._focus(unit()); },
        target: () => {
          const u = unit();
          if (u && Units.selectedId !== u.id) return T._unitEl(u);
          return Gnome._hitBtn || T._unitEl(u);
        },
        refillFor: () => T._ctx.unitId,
        done: () => { const g = T._gnome(); return !!g && g.points >= 1; },
      },
      {
        mood: "normal",
        say: "Y ahora lo importante: aquí no hay obelisco enemigo, así que el gnomo se ESTAMPA contra el tuyo. Tranquilo, tu obelisco no pierde vida: es un sacrificio. Cada gnomo estampado cuenta para el objetivo del capítulo y se queda contigo.",
        mission: "Estampa a Tinkle contra tu obelisco",
        ok: "Estampado y contabilizado. Tinkle ya no tiene queja.",
        onStart: () => {
          T._refill();
          const u = unit(), ob = T._ob(), g = T._gnome();
          if (u && g && Gnome.isHeldBy(u.id) && Math.max(Math.abs(u.row - ob.row), Math.abs(u.col - ob.col)) > 3) {
            const s = T._spotAt(2, [[1, 1], [1, 0], [0, 1], [1, -1], [-1, 1]]);
            if (s) {
              u.row = s.row; u.col = s.col; Units._placeInstant(u);
              g.row = s.row; g.col = s.col;
              if (typeof Fog !== "undefined") Fog.applyVisibility();
            }
          }
          T._focus(unit(), ob);
        },
        target: () => {
          const u = unit(), ob = T._ob();
          if (!u || !Gnome.isHeldBy(u.id)) return null;
          return T._unitThen(u, () => T._anyMarker("obelisk-attack-marker") || T._nearestRange(ob.row, ob.col));
        },
        refillFor: () => T._ctx.unitId,
        done: () => !!Campaign.run && Campaign.run.delivered >= 1,
      },
      {
        mood: "normal",
        say: "Las cuentas: empiezas con 4 puntos y una unidad, tu población máxima es 5 y no ganas puntos por turno. Los puntos salen de las bajas (+3) y de golpear gnomos. Y lo que extraigas —los gnomos, los puntos que te sobren, madera, roca y metal— lo inviertes luego en mejoras desde el menú de campaña.",
        button: "Anotado",
        onStart: () => { T._focus(T._ob()); },
      },
      {
        mood: "normal",
        say: "Hablando de extraer: los pinos, las rocas y las menas también se golpean y sueltan recursos. Con ellos compras mejoras en el menú de campaña. Selecciona a tu unidad y tala ese pino.",
        mission: "Tala el pino (2 golpes)",
        ok: "Madera. Con esto se compra mucho en el mapa de la campaña.",
        onStart: () => {
          T._refill();
          const f = unit();
          const spot = f && T._findSpot(f, { minD: 2, maxD: 3, side: "center", minOb: 2 });
          if (spot && typeof Resources !== "undefined") {
            T._ctx.pine = Resources._create("pino", spot.row, spot.col);
            if (typeof Fog !== "undefined") Fog.applyVisibility();
          }
          T._focus(f, T._ctx.pine);
        },
        target: () => {
          const f = unit(), p = T._ctx.pine;
          if (!f) return null;
          if (!p || !Resources.list.includes(p)) return T._unitEl(f);
          return T._unitThen(f, () => T._marker("resource-node-attack-marker", p.row, p.col)) || T._unitEl(p);
        },
        refillFor: () => T._ctx.unitId,
        done: () => (Resources.counts.madera || 0) > 0,
      },
      {
        mood: "grunon",
        say: "Ojo: de vez en cuando aparecen Rompeobeliscos, goblins furtivos con un garrote y mucho tiempo libre. Tienen 1 de vida y 1 de daño, pero se acercan despacio a tu obelisco para mellarlo, o a ti para estorbarte. Este viene de práctica: acaba con él.",
        mission: "Detén al Rompeobeliscos",
        ok: "Has eliminado a esa pequeña alimaña... valía menos que el garrote que llevaba en la mano.",
        onStart: () => {
          T._refill();
          const f = unit();
          const spot = f && (T._findSpot(f, { minD: 2, maxD: 3, side: "center", minOb: 2 }) || T._around(f, 2, 1));
          if (spot) {
            T._ctx.sneak = Units.spawnUnit({ typeId: "rompeobeliscos", row: spot.row, col: spot.col, team: "enemy" });
            if (typeof Fog !== "undefined") Fog.applyVisibility();
          }
          T._focus(f, T._ctx.sneak);
        },
        target: () => {
          const u = unit(), d = T._ctx.sneak;
          if (!u) return null;
          if (!d || !Units.list.includes(d)) return T._unitEl(u);
          // Si la unidad se movió y el Rompeobeliscos quedó lejos (o encima de ella), se recoloca a su lado.
          const dist = Math.max(Math.abs(u.row - d.row), Math.abs(u.col - d.col));
          if (!u.moving && (dist > 3 || dist === 0)) {
            const spot = T._findSpot(u, { minD: 2, maxD: 3, side: "center", minOb: 2 }) || T._around(u, 2, 1);
            if (spot) { d.row = spot.row; d.col = spot.col; Units._placeInstant(d); if (typeof Fog !== "undefined") Fog.applyVisibility(); }
          }
          return T._unitThen(u, () => T._marker("attack-marker", d.row, d.col) || T._nearestRange(d.row, d.col)) || T._unitEl(d);
        },
        refillFor: () => T._ctx.unitId,
        done: () => !!T._ctx.sneak && !Units.list.includes(T._ctx.sneak),
      },
      {
        mood: "normal",
        say: "Cuando tengas lo que quieras, o cuando la cosa se ponga fea, reúne a todas tus unidades a 2 casillas o menos del obelisco, selecciónalo y pulsa el icono de salida. Si aceptas, te llevas los gnomos y los recursos. Si caes antes, te quedas sin nada. Y vigila el reloj: si se acaban los turnos sin reunir a todos los gnomos, solo conservas la mitad de los recursos.",
        mission: "Extrae con el obelisco",
        ok: "Fuera por la puerta grande. O por la de atrás, que es más rápida.",
        onStart: () => { T._refill(); if (Units.selectedId) Units.deselect(); T._focus(T._ob()); },
        target: () => {
          if (Campaign._askEl) return Campaign._askEl.querySelector(".camp-ask__btn--yes");
          if (Obelisks._selectedId === T._ob().id) return T._ob().el.querySelector(".obelisk__menu-btn--extract") || T._obTop();
          return T._obTop();
        },
        done: () => !!Campaign.run && !!Campaign.run.tutExtracted,
      },
      {
        mood: "normal",
        say: "Ya fuera del nivel, en el menú de campaña: lo que has extraído se invierte en mejoras. ¡Más gnomos traídos, más capítulos abiertos!",
        button: "Vale",
        onStart: () => { T._focus(T._ob()); },
      },
      {
        mood: "aplaude",
        say: "Y eso es la Campaña. Resumen: derrota guardias, abre jaulas, coge gnomos, golpéalos y estámpalos contra tu obelisco, recoge recursos, vigila a los Rompeobeliscos y extrae a tiempo. ¡Suerte, la vas a necesitar!",
        button: "TERMINAR TUTORIAL",
        final: true,
      }
    ];
  },
});

/* Gnomore Gnomes — Puntos de Gloria.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Cuántos Puntos de Gloria tiene cada equipo ("player" | "enemy").
     - Pintar el marcador de la esquina superior izquierda para cada equipo,
       con el icono de SU raza (RACES[].gloryIcon, ver js/races.js).
     - Sumar puntos al empezar cada turno (Glory.grantTurnStart, llamado
       desde js/turns.js — ver Turns.reset/Turns.endTurn), incluyendo el
       bonus por bajas conseguidas durante el turno anterior
       (Glory.queueKillBonus, llamado desde js/combat.js al matar).

   Pedido explícito: "Vamos a introducir la mecanica de PUNTOS DE GLORIA, un
   marcador situado arriba la izquierda con un icono distinto para cada raza
   indicara los puntos de gloria, estos puntos permitiran construir
   unidades/edificios desde la base principal cuando las haya y comprar
   mejoras en el arbol de talentos, de momento vamos a implementar el icono
   qye muestre los puntos en una interfaz con un diseño espectacular, lo
   demas lo haremos mas tarde" — así que, DE MOMENTO, este archivo es
   puramente de visualización + generación automática; gastar puntos
   (construir, mejorar) se añadirá más adelante en otra pasada.

   Pedido explícito: "al comienzo de cada turno se generan automaticamente 2
   puntos de gloria... luego añadiremos mecanicas que van sumando mas puntos
   de gloria al comienzo del turno" — GLORY_PER_TURN_START vive como
   constante aparte a propósito, para que sumar más fuentes en el futuro sea
   tocar esto, no reescribir la lógica de turno.

   Pedido explícito (segunda pasada): "matar a 1 enemigo genera +1 punto de
   gloria al comienzo del turno" — el bonus se ACUMULA en cuanto se
   confirma la baja (queueKillBonus, llamado desde Combat.attack) pero no
   se suma a los puntos "de verdad" hasta que empieza el turno de ese
   equipo (grantTurnStart), exactamente igual que el resto de fuentes de
   este archivo: todo pasa por el mismo grifo del inicio de turno.

   Los puntos se llevan la cuenta para LOS DOS equipos (el rival también los
   necesitará el día que su IA construya/mejore algo), pero el marcador en
   pantalla ("un marcador situado arriba la izquierda", en singular) es solo
   el del JUGADOR — como el resto de HUD de este juego, no se le enseña al
   jugador el recurso del rival. */

const GLORY_PER_TURN_START = 2;
const GLORY_PER_KILL = 1;

const Glory = {
  points: { player: 0, enemy: 0 },
  // Bonus ya "ganado" (bajas conseguidas) pero todavía sin sumar a points —
  // se vuelca entero en el próximo grantTurnStart de ESE equipo y se vacía.
  pendingBonus: { player: 0, enemy: 0 },
  _els: { player: null, enemy: null },
  _valueEls: { player: null, enemy: null },
  _previewEls: { player: null, enemy: null },

  // Se llama al empezar cada partida nueva (spawnTestUnits, ver
  // newgame-flow.js), justo después de Turns.reset() — recibe la raza de
  // cada equipo para poder pintar el icono correcto de cada uno.
  init(playerRaceId, enemyRaceId) {
    this.points = { player: 0, enemy: 0 };
    this.pendingBonus = { player: 0, enemy: 0 };
    this._raceIds = { player: playerRaceId, enemy: enemyRaceId };
    // Solo el marcador del JUGADOR se pinta en pantalla (ver nota de
    // cabecera) — el del rival se lleva por dentro sin HUD propio.
    this._ensureHud("player", playerRaceId);
    this._els.player.style.display = "flex";
    this._render("player");
    this._renderPreview("player");
  },

  // Se llama desde js/settingsmenu.js al salir de la partida — mismo motivo
  // que Turns.hideButton() (ver ese archivo): el marcador vive fuera del
  // tablero y persiste entre partidas (se reutiliza el mismo elemento, ver
  // _ensureHud), así que hay que ocultarlo a mano al volver al menú en vez
  // de esperar a que se destruya solo con el resto del tablero.
  hideHud() {
    if (this._els.player) this._els.player.style.display = "none";
  },

  // Pedido explícito: "matar a 1 enemigo genera +1 punto de gloria al
  // comienzo del turno" — se llama desde Combat.attack en el momento exacto
  // en que se confirma la baja (target.hp <= 0), con el equipo de QUIEN
  // MATA (no de la víctima). No toca `points` todavía, solo la reserva que
  // grantTurnStart recogerá para ese equipo en su próximo turno — y refresca
  // el indicador discreto de "próximo turno" al momento, para que el
  // jugador vea reflejada la baja enseguida aunque los puntos de verdad
  // tarden hasta el inicio del turno en aparecer.
  queueKillBonus(team) {
    if (!(team in this.pendingBonus)) return;
    this.pendingBonus[team] += GLORY_PER_KILL;
    this._renderPreview(team);
  },

  // Pedido explícito: "+2 al comienzo de cada turno" (ahora +2 y lo que se
  // haya acumulado en pendingBonus, ver cabecera) — lo llama Turns.js en
  // cada cambio de equipo activo (incluida la primera vez que empieza el
  // jugador). `team` es "player" | "enemy".
  grantTurnStart(team) {
    if (!(team in this.points)) return;
    const gained = GLORY_PER_TURN_START + this.pendingBonus[team];
    this.points[team] += gained;
    this.pendingBonus[team] = 0;
    this._render(team, { bump: true, gained });
    this._renderPreview(team);
  },

  _raceFor(raceId) {
    const list = typeof RACES !== "undefined" ? RACES : [];
    return list.find((r) => r.id === raceId) || null;
  },

  // Pedido explícito (quinta pasada): "puedes poner el icono de puntos de
  // gloria directamente sin estar dentro de un circulo y la barra de la
  // derecha saliendo desde la mitad del icono por detras hacia la derecha
  // para integrarla" — fuera el medallón circular de antes: ahora el PNG
  // de la raza (RACES[].gloryIcon) se pinta suelto, sin fondo/borde propio,
  // y el banderín de número queda DETRÁS suyo en el z-index (ver
  // glory-hud__icon/__main en style.css), con un margen negativo para que
  // nazca justo a la mitad del icono y se lea como una sola pieza, no dos
  // pegadas.
  _ensureHud(team, raceId) {
    if (this._els[team]) return;
    const race = this._raceFor(raceId);

    const el = document.createElement("div");
    el.className = `glory-hud glory-hud--${team}`;
    if (!race || !race.gloryIcon) el.classList.add("glory-hud--no-icon");

    if (race && race.gloryIcon) {
      const icon = document.createElement("img");
      icon.className = "glory-hud__icon";
      icon.src = race.gloryIcon;
      icon.alt = "";
      el.appendChild(icon);
    }

    const main = document.createElement("div");
    main.className = "glory-hud__main";

    const value = document.createElement("span");
    value.className = "glory-hud__value";
    value.textContent = "0";

    // Indicador discreto — pedido explícito: "debe haber algun indicador que
    // diga cuando puntos de gloria se generan por turno (algo mas
    // discreto)" — a diferencia de __value (el total actual, el que "hay
    // que destacar más"), este va pequeño y apagado, justo debajo.
    const preview = document.createElement("span");
    preview.className = "glory-hud__preview";
    preview.textContent = `+${GLORY_PER_TURN_START} / turno`;

    main.appendChild(value);
    main.appendChild(preview);

    el.appendChild(main);
    document.body.appendChild(el);

    this._els[team] = el;
    this._valueEls[team] = value;
    this._previewEls[team] = preview;
  },

  _render(team, { bump = false, gained = 0 } = {}) {
    const valueEl = this._valueEls[team];
    if (!valueEl) return;
    valueEl.textContent = String(this.points[team]);
    if (bump) {
      const el = this._els[team];
      el.classList.remove("glory-hud--bump");
      void el.offsetWidth;
      el.classList.add("glory-hud--bump");
      // Sonido de recompensa — pedido explícito: "cuando alguna cosa genera
      // +X puntos de gloria... debe escucharse un sonido de recompensa".
      // Solo aquí (no en queueKillBonus): la baja en sí ya suena a golpe/
      // victoria con SFX.death(), este chime específico de gloria es para
      // el momento en que los puntos de verdad "entran en la cuenta".
      if (gained > 0 && typeof SFX !== "undefined") SFX.glory();
    }
  },

  _renderPreview(team) {
    const previewEl = this._previewEls[team];
    if (!previewEl) return;
    const next = GLORY_PER_TURN_START + this.pendingBonus[team];
    previewEl.textContent = `+${next} / turno`;
  },
};

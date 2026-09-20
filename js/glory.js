/* Gnomore Gnomes — Puntos de Gloria.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Cuántos Puntos de Gloria tiene cada equipo ("player" | "enemy").
     - Pintar el marcador de la esquina superior izquierda para cada equipo,
       con el icono de SU raza (RACES[].gloryIcon, ver js/races.js).
     - Sumar puntos al empezar cada turno (Glory.grantTurnStart, llamado
       desde js/turns.js — ver Turns.reset/Turns.endTurn).

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

   Los puntos se llevan la cuenta para LOS DOS equipos (el rival también los
   necesitará el día que su IA construya/mejore algo), pero el marcador en
   pantalla ("un marcador situado arriba la izquierda", en singular) es solo
   el del JUGADOR — como el resto de HUD de este juego, no se le enseña al
   jugador el recurso del rival. */

const GLORY_PER_TURN_START = 2;

const Glory = {
  points: { player: 0, enemy: 0 },
  _els: { player: null, enemy: null },
  _valueEls: { player: null, enemy: null },

  // Se llama al empezar cada partida nueva (spawnTestUnits, ver
  // newgame-flow.js), justo después de Turns.reset() — recibe la raza de
  // cada equipo para poder pintar el icono correcto de cada uno.
  init(playerRaceId, enemyRaceId) {
    this.points = { player: 0, enemy: 0 };
    this._raceIds = { player: playerRaceId, enemy: enemyRaceId };
    // Solo el marcador del JUGADOR se pinta en pantalla (ver nota de
    // cabecera) — el del rival se lleva por dentro sin HUD propio.
    this._ensureHud("player", playerRaceId);
    this._render("player");
  },

  // Pedido explícito: "+2 al comienzo de cada turno" — lo llama Turns.js en
  // cada cambio de equipo activo (incluida la primera vez que empieza el
  // jugador). `team` es "player" | "enemy".
  grantTurnStart(team) {
    if (!(team in this.points)) return;
    this.points[team] += GLORY_PER_TURN_START;
    this._render(team, { bump: true });
  },

  _raceFor(raceId) {
    const list = typeof RACES !== "undefined" ? RACES : [];
    return list.find((r) => r.id === raceId) || null;
  },

  _ensureHud(team, raceId) {
    if (this._els[team]) return;
    const race = this._raceFor(raceId);

    const el = document.createElement("div");
    el.className = `glory-hud glory-hud--${team}`;

    const iconWrap = document.createElement("div");
    iconWrap.className = "glory-hud__icon";
    if (race && race.gloryIcon) {
      const img = document.createElement("img");
      img.src = race.gloryIcon;
      img.alt = "";
      iconWrap.appendChild(img);
    }

    const value = document.createElement("span");
    value.className = "glory-hud__value";
    value.textContent = "0";

    el.appendChild(iconWrap);
    el.appendChild(value);
    document.body.appendChild(el);

    this._els[team] = el;
    this._valueEls[team] = value;
  },

  _render(team, { bump = false } = {}) {
    const valueEl = this._valueEls[team];
    if (!valueEl) return;
    valueEl.textContent = String(this.points[team]);
    if (bump) {
      const el = this._els[team];
      el.classList.remove("glory-hud--bump");
      void el.offsetWidth;
      el.classList.add("glory-hud--bump");
    }
  },
};

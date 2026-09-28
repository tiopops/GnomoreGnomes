/* Gnomore Gnomes — GnomOgro.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Nacer donde estaba el Altar de Sacrificios (js/altar.js, Altar._collapse
       lo llama) cuando su barra de 30 espacios se llena del todo.
     - Moverse él solo, sin que ningún jugador lo controle, una casilla cada
       DOS turnos (rondas completas, ver GNOMOGRO_MOVE_EVERY_N_ROUNDS) hacia
       el Obelisco del equipo CONTRARIO al suyo.
     - Atacar en vez de moverse si tiene a un enemigo adyacente, y destruir
       de un solo golpe el Obelisco rival en cuanto llega a su lado —
       reutiliza Obelisks._destroy tal cual (mismo "fin de partida" que ya
       dispara cualquier Obelisco al llegar a 0 de vida por combate normal,
       ver obelisks.js), así este archivo no necesita saber nada de pantallas
       de victoria.
     - Ser siempre visible (radio 1 de percepción/revelado permanente,
       pedido explícito) y sonar/temblar como la criatura colosal que es.

   Pedido explícito: "una criatura colosal que hace temblar el suelo cuando
   anda, se mueve una casilla cada turno en direccion a una base enemiga al
   azar, un turno si y un turno no, en vez de moverse intenta atacar a una
   unidad adyacente enemiga a el, si no hay nadie anda (el gnomogro es del
   bando de la persona que le dio el golpe de gracia al altar para que
   saliera el gnomo, pero no se puede controlar por nigun jugador, va por su
   cuenta). el gnomogro tiene 50 puntos de vida y 30 puntos de ataque. por
   lo que cuando llegue a la base enemiga la destruira de un golpe y acabara
   la partida. cuando el gnomogro ataca despues de una leve animacion de
   sprite pasa a 'gnomo_ogro_ataque' y un instante despues a
   'gnomo_ogro_ataque' el suelo/camara tiembla con el impacto. Añade sonidos
   para el gnomogro. El Gnomogro es visible con un radio alrededor de el de
   1 para todos los jugadores de la partida."

   Decisiones de diseño (sin pedido explícito exacto):
   - "una base enemiga al azar": con el motor actual estrictamente a 2
     bandos (ver cabecera de turns.js) solo existe UN posible objetivo — el
     Obelisco del equipo contrario al suyo — así que "al azar" no tiene
     nada entre lo que elegir todavía; se deja resuelto con
     Obelisks.byTeam(otherTeam) para que, el día que haya más de 2 equipos,
     este sea el único sitio que haga falta tocar (elegir entre varios en
     vez de "el único que hay").
   - "un turno si y un turno no" se cuenta en RONDAS completas (mismo
     vocabulario que ya usa todo el proyecto para "turno" en el contexto de
     30 turnos por partida/reposición de la tienda cada 5 turnos, ver
     Turns.registerTurnEndListener) — actúa en una ronda de cada dos, nunca
     en las intermedias.
   - El GnomOgro es imparable de verdad: no se ha añadido ninguna forma de
     que las unidades del jugador le hagan daño (el pedido nunca lo pide,
     solo describe SUS 50 de vida y 30 de ataque como cifras de la
     criatura, no un combate bidireccional) — sus 50 de vida quedan
     guardados en el dato y se pintan en su barra por si el día de mañana
     se añade esa mecánica, pero de momento nada la reduce. Tampoco se
     detiene ante terreno intransitable (agua) ni "pisa" con cuidado
     alrededor de poblados/recursos/arbustos: es una criatura colosal
     avanzando en línea recta hacia una base entera, no un personaje más
     sujeto a las reglas normales de movimiento. */

const GNOMOGRO_MAX_HP = 50;
const GNOMOGRO_ATTACK = 30;
const GNOMOGRO_MOVE_EVERY_N_ROUNDS = 2; // "un turno si y un turno no"
const GNOMOGRO_PERCEPTION_RADIUS = 1;
const GNOMOGRO_ATTACK_RANGE = 1;

const GNOMOGRO_SPRITES = {
  idle: "assets/gnomogro/gnomogro_idle.png",
  cargaAtaque: "assets/gnomogro/gnomogro_ataque_carga.png",
  impacto: "assets/gnomogro/gnomogro_ataque_impacto.png",
};

const GnomOgro = {
  // Como mucho una criatura viva a la vez en toda la partida (nace de un
  // único Altar, y si destruye un Obelisco la partida termina antes de que
  // pueda hacer falta un segundo).
  current: null,
  _roundTicks: 0,

  resetAll() {
    if (this.current && this.current.el) this.current.el.remove();
    this.current = null;
    this._roundTicks = 0;
  },

  // Llamado desde Altar._collapse justo cuando su barra llega a 30/30.
  // `team` es el bando de quien dio el golpe de gracia (pedido explícito).
  spawn(team, row, col) {
    if (this.current) return; // ya hay uno vivo (no debería poder pasar, defensivo)
    const otherTeam = team === "player" ? "enemy" : "player";

    const el = document.createElement("div");
    el.className = "unit gnomogro";

    // .unit__flip (igual que Gnome/las unidades normales, ver gnome.js) —
    // hace falta para poder girarse hacia su objetivo con
    // Units.faceTowardsTile/_applyFacing (esa función espera unit.flipEl).
    const flipEl = document.createElement("div");
    flipEl.className = "unit__flip gnomogro__flip";

    const spriteEl = document.createElement("img");
    spriteEl.decoding = "async";
    spriteEl.className = "gnomogro__sprite";
    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(spriteEl, GNOMOGRO_SPRITES.idle);
    else spriteEl.src = GNOMOGRO_SPRITES.idle;
    spriteEl.alt = "";
    spriteEl.draggable = false;
    flipEl.appendChild(spriteEl);
    if (typeof Shadows !== "undefined") Shadows.attach(spriteEl);
    el.appendChild(flipEl);

    // Barra de vida — ver la nota larga de arriba: de momento nada la
    // reduce de verdad, pero se pinta a plena vida igual que la de
    // cualquier estructura siempre visible (poblado/Obelisco/tienda).
    const hpBarEl = document.createElement("div");
    hpBarEl.className = "unit__hpbar gnomogro__hpbar";
    const hpSegmentEls = [];
    for (let i = 0; i < GNOMOGRO_MAX_HP; i++) {
      const seg = document.createElement("div");
      seg.className = "unit__hpbar-segment unit__hpbar-segment--filled";
      hpBarEl.appendChild(seg);
      hpSegmentEls.push(seg);
    }
    el.appendChild(hpBarEl);

    if (typeof Units !== "undefined") Units.container.appendChild(el);

    this.current = {
      team,
      otherTeam,
      row,
      col,
      facing: "right",
      hp: GNOMOGRO_MAX_HP,
      maxHp: GNOMOGRO_MAX_HP,
      el,
      flipEl,
      spriteEl,
      hpBarEl,
      hpSegmentEls,
    };
    this._placeInstant(this.current);
    if (typeof Fog !== "undefined") Fog.revealAround(row, col, GNOMOGRO_PERCEPTION_RADIUS);

    // "todo tiembla y aparece el GnomOgro" — el temblor de la desaparición
    // del Altar ya lo dispara Altar._collapse justo antes de llamar aquí;
    // esto añade el propio sonido de nacimiento de la criatura.
    if (typeof SFX !== "undefined") SFX.explosion();
    el.classList.add("gnomogro--spawn");

    if (typeof Turns !== "undefined" && !this._registered) {
      Turns.registerTurnEndListener(this);
      this._registered = true;
    }
  },

  _placeInstant(g) {
    if (typeof getTileCenter === "undefined" || typeof Units === "undefined") return;
    const { x, y } = getTileCenter(g.row, g.col, Units.boardSize);
    g.el.style.left = `${x}px`;
    g.el.style.top = `${y}px`;
    g.el.style.zIndex = String((g.row + g.col) * 10 + 6);
  },

  // Oyente de Turns (ver registerTurnEndListener) — se llama UNA vez por
  // ronda completa (jugador + rival), justo cuando vuelve a ser el turno
  // del jugador. "un turno sí y un turno no": actúa en una de cada dos.
  onRoundEnd() {
    if (!this.current) return;
    this._roundTicks++;
    if (this._roundTicks % GNOMOGRO_MOVE_EVERY_N_ROUNDS !== 0) return;
    this._act();
  },

  async _act() {
    const g = this.current;
    if (!g) return;
    const targetObelisk = typeof Obelisks !== "undefined" ? Obelisks.byTeam(g.otherTeam) : null;
    if (!targetObelisk) return; // ya no queda base rival en pie (partida terminando/terminada por otra vía)

    // "en vez de moverse intenta atacar a una unidad adyacente enemiga a
    // el, si no hay nadie anda" — prioridad: un enemigo adyacente primero,
    // el Obelisco rival adyacente después (golpe final), mover si no hay
    // nada al alcance.
    const distTo = (row, col) => Math.max(Math.abs(row - g.row), Math.abs(col - g.col));
    const adjacentEnemy =
      typeof Units !== "undefined"
        ? Units.list.find((u) => u.team === g.otherTeam && u.el && distTo(u.row, u.col) <= GNOMOGRO_ATTACK_RANGE)
        : null;

    if (distTo(targetObelisk.row, targetObelisk.col) <= GNOMOGRO_ATTACK_RANGE) {
      await this._attackObelisk(targetObelisk);
      return;
    }
    if (adjacentEnemy) {
      await this._attackUnit(adjacentEnemy);
      return;
    }
    await this._moveToward(targetObelisk);
  },

  // Un paso recto (como mucho 1 casilla en cada eje) hacia el objetivo —
  // ver la nota larga de cabecera: ignora agua/poblados/recursos/arbustos a
  // propósito, es una criatura colosal arrasando en línea recta, no sujeta
  // a las reglas normales de movimiento de un personaje.
  async _moveToward(targetObelisk) {
    const g = this.current;
    const dr = Math.sign(targetObelisk.row - g.row);
    const dc = Math.sign(targetObelisk.col - g.col);
    if (dr === 0 && dc === 0) return;
    const nextRow = Math.max(0, Math.min(Units.boardSize - 1, g.row + dr));
    const nextCol = Math.max(0, Math.min(Units.boardSize - 1, g.col + dc));
    if (nextRow === g.row && nextCol === g.col) return;

    g.el.classList.add("gnomogro--stepping");
    g.row = nextRow;
    g.col = nextCol;
    this._placeInstant(g);
    if (typeof Fog !== "undefined") {
      Fog.revealAround(g.row, g.col, GNOMOGRO_PERCEPTION_RADIUS);
      Fog.applyVisibility();
    }
    if (typeof SFX !== "undefined") SFX.gnomogroStep();
    this._shakeViewport(false);
    await new Promise((resolve) => setTimeout(resolve, 260));
    g.el.classList.remove("gnomogro--stepping");
  },

  _shakeViewport(big) {
    const viewportEl = document.getElementById("board-viewport");
    if (!viewportEl) return;
    const cls = big ? "board-viewport--shake--big" : "board-viewport--shake";
    viewportEl.classList.remove("board-viewport--shake", "board-viewport--shake--big");
    void viewportEl.offsetWidth;
    viewportEl.classList.add(cls);
    setTimeout(() => viewportEl.classList.remove(cls), 420);
  },

  // "cuando el gnomogro ataca despues de una leve animacion de sprite pasa
  // a gnomo_ogro_ataque y un instante despues [al impacto] a
  // gnomo_ogro_ataque [de impacto]. el suelo/camara tiembla con el
  // impacto" — dos poses (carga/impacto, ver GNOMOGRO_SPRITES) en vez de
  // una sola, mismo espíritu que el salto/machacón de Villages._playEpicSmash
  // pero con arte propio de la criatura en vez de reutilizar la pose de un
  // personaje normal.
  async _playAttackAnim() {
    const g = this.current;
    g.el.classList.add("gnomogro--attacking");
    // Fotogramas de acción momentáneos (carga/impacto) -> .src directo, NUNCA
    // vía SpriteQuality.register (mismo criterio que Units.machacaSpriteFor/
    // impactSpriteFor en Villages._playEpicSmash: un fundido de calidad
    // encima de una pose de golpe ya de por sí rápida se vería raro). Solo
    // la pose "de reposo" (idle, al final) vuelve a registrarse para que
    // siga respondiendo al zoom con normalidad el resto del tiempo.
    g.spriteEl.src = GNOMOGRO_SPRITES.cargaAtaque;
    await new Promise((resolve) => setTimeout(resolve, 320));

    g.spriteEl.src = GNOMOGRO_SPRITES.impacto;
    if (typeof SFX !== "undefined") SFX.gnomogroAttack();
    this._shakeViewport(true);
    await new Promise((resolve) => setTimeout(resolve, 380));

    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(g.spriteEl, GNOMOGRO_SPRITES.idle);
    else g.spriteEl.src = GNOMOGRO_SPRITES.idle;
    g.el.classList.remove("gnomogro--attacking");
  },

  async _attackUnit(target) {
    const g = this.current;
    Units.faceTowardsTile(g, target.row, target.col);
    await this._playAttackAnim();
    target.hp = Math.max(0, target.hp - GNOMOGRO_ATTACK);
    Units.updateHpBar(target);
    Units.spawnFloatingText(target, `-${GNOMOGRO_ATTACK}`, { className: "dmg-popup" });
    Units.playShake(target);
    if (target.hp <= 0) {
      if (typeof Glory !== "undefined") Glory.queueKillBonus(g.team);
      await Units.removeUnit(target);
      if (typeof Gnome !== "undefined") Gnome.dropHeldBy(target);
    }
  },

  // "cuando llegue a la base enemiga la destruira de un golpe y acabara la
  // partida" — reutiliza Obelisks._destroy tal cual (mismo "apagón" visual
  // que un Obelisco destruido por combate normal, que ya comprueba solo
  // queda un equipo en pie y muestra la pantalla de fin de partida).
  async _attackObelisk(obelisk) {
    const g = this.current;
    Units.faceTowardsTile(g, obelisk.row, obelisk.col);
    await this._playAttackAnim();
    if (typeof Obelisks !== "undefined") await Obelisks._destroy(obelisk);
  },
};

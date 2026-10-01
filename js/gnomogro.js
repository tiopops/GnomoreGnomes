/* Gnomore Gnomes — GnomOgro.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Nacer donde estaba el Altar de Sacrificios (js/altar.js, Altar._collapse
       lo llama) cuando su barra de 30 espacios se llena del todo.
     - Moverse él solo, sin que ningún jugador lo controle, UNA casilla al
       principio de CADA turno (el de un bando y el del otro, ver onTurnStart)
       hacia el Obelisco de un rival elegido al azar.
     - Matar de un solo golpe a un personaje enemigo adyacente EN VEZ de
       moverse (su única acción por turno), y destruir
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
   cuenta). el gnomogro tiene 30 puntos de vida y 10 puntos de ataque (pedido posterior). por
   lo que cuando llegue a la base enemiga la destruira de un golpe y acabara
   la partida. cuando el gnomogro ataca despues de una leve animacion de
   sprite pasa a 'gnomo_ogro_ataque' y un instante despues a
   'gnomo_ogro_ataque' el suelo/camara tiembla con el impacto. Añade sonidos
   para el gnomogro. El Gnomogro es visible con un radio alrededor de el de
   1 para todos los jugadores de la partida."

   Pedido explícito (pasada posterior, SUSTITUYE al "un turno sí y otro
   no" de arriba): "al principio de cada turno amigo/enemigo avanza una
   casilla en direccion a la de un enemigo (cualquier jugador que no lo
   invoco, elige uno al azar y se centra en ese). se mueve de una casilla
   en una casilla. su mision es avanzar una casilla por turno en direccion
   al obelisco enemigo, para destruirlo. el gnomogro gasta su unica accion
   por turno para moverse, al menos que tenga un personaje enemigo en una
   casilla adyacente, en cuyo caso usara su accion por turno para matarlo
   de un golpe." — así que: (1) actúa al inicio de CADA turno individual
   (Turns.registerTurnStartListener, dos veces por ronda), no una de cada
   dos rondas; (2) elige UN rival al azar al nacer y se queda con él
   (g.targetTeam) hasta que ese Obelisco cae; (3) el golpe a un personaje
   es de muerte instantánea, no "30 de daño".

   Decisiones de diseño (sin pedido explícito exacto; las de "una casilla
   cada dos turnos" de más abajo quedan sustituidas por lo de arriba):
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

const GNOMOGRO_MAX_HP = 30;
const GNOMOGRO_ATTACK = 10; // daño real de su golpe (unidades y Obelisco)
const GNOMOGRO_PERCEPTION_RADIUS = 1;
const GNOMOGRO_ATTACK_RANGE = 1;

const GNOMOGRO_SPRITES = {
  idle: "assets/gnomogro/gnomo_ogro.png", // sprite base (las poses de ataque solo se usan al atacar)
  // Poses de ataque (pedido explícito): levanta los brazos con
  // "gnomo_ogro_preparaataque" y efectúa el golpe con "gnomo_ogro_ataque".
  // Se usan en su versión _midres (momentáneas, se asignan por .src directo):
  // el sprite completo mide 1306 px y solo se pinta a 200 px de ancho.
  preparaAtaque: "assets/gnomogro/gnomo_ogro_preparaataque_midres.png",
  ataque: "assets/gnomogro/gnomo_ogro_ataque_midres.png",
};

const GnomOgro = {
  // Como mucho una criatura viva a la vez en toda la partida (nace de un
  // único Altar, y si destruye un Obelisco la partida termina antes de que
  // pueda hacer falta un segundo).
  current: null,

  // true si el GnomOgro vivo ocupa la casilla (row,col) — pedido explícito:
  // "no se puede ocupar la misma casilla que un gnomogro, al igual que
  // ocurre entre personajes y enemigos". Consultado junto a Altar.at en
  // todos los sitios que comprueban casillas libres.
  at(row, col) {
    const g = this.current;
    return !!g && g.row === row && g.col === col;
  },

  resetAll() {
    if (this.current && this.current.el) this.current.el.remove();
    this.current = null;
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

    // Clic directo sobre la criatura cuando está marcada como objetivo (ver
    // showFor): mismo patrón que Obelisks/Villages.
    el.addEventListener("click", (e) => {
      if (!el.classList.contains("gnomogro--targeted")) return;
      if (typeof Units === "undefined" || !Units.selectedId) return;
      e.stopPropagation();
      const attacker = Units.list.find((u) => u.id === Units.selectedId);
      if (attacker && this.current) this.approachAndAttack(attacker, this.current);
    });

    if (typeof Units !== "undefined") Units.container.appendChild(el);

    this.current = {
      team,
      otherTeam,
      row,
      col,
      facing: "right",
      hp: GNOMOGRO_MAX_HP,
      maxHp: GNOMOGRO_MAX_HP,
      targetTeam: null,
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
      Turns.registerTurnStartListener(this);
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

  // Oyente de Turns (ver registerTurnStartListener) — se llama al inicio de
  // CADA turno (jugador y rival). Devuelve la promesa de la acción para que
  // Turns.endTurn espere a que termine antes de seguir (así el GnomOgro nunca
  // pisa la animación de la IA rival ni la del jugador).
  onTurnStart(team) {
    if (!this.current) return null;
    // Una sola acción por RONDA (pedido explícito: "solo puede moverse 1
    // casilla cada turno, le he visto moverse 2"): antes actuaba al empezar
    // el turno de cada bando, es decir dos veces por ronda. Ahora solo al
    // empezar el turno de su dueño.
    if (team !== this.current.team) return null;
    if (typeof Obelisks !== "undefined" && Obelisks.gameOver) return null;
    return this._act();
  },

  // "cualquier jugador que no lo invoco, elige uno al azar y se centra en
  // ese" — se sortea una sola vez y se recuerda en g.targetTeam; si ese
  // Obelisco ya no existe, se sortea otro rival entre los que quedan.
  _pickTarget(g) {
    if (typeof Obelisks === "undefined") return null;
    let obelisk = g.targetTeam ? Obelisks.byTeam(g.targetTeam) : null;
    if (obelisk) return obelisk;
    const rivals = Obelisks.list.filter((o) => o.team !== g.team);
    if (rivals.length === 0) return null;
    obelisk = rivals[Math.floor(Math.random() * rivals.length)];
    g.targetTeam = obelisk.team;
    return obelisk;
  },

  async _act() {
    const g = this.current;
    if (!g) return;
    const targetObelisk = this._pickTarget(g);
    if (!targetObelisk) return; // ya no queda base rival en pie

    // Una sola acción por turno: si tiene el Obelisco objetivo al lado lo
    // destruye (golpe final); si no, mata a un personaje enemigo adyacente
    // si lo hay; si no, avanza una casilla.
    const distTo = (row, col) => Math.max(Math.abs(row - g.row), Math.abs(col - g.col));
    const adjacentEnemy =
      typeof Units !== "undefined"
        ? Units.list.find((u) => u.team !== g.team && u.el && distTo(u.row, u.col) <= GNOMOGRO_ATTACK_RANGE)
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
    // Pedido explícito: "no se puede ocupar la misma casilla que un
    // gnomogro, al igual que ocurre entre personajes y enemigos" — vale
    // también al revés: el GnomOgro no pisa una casilla con un personaje
    // (ni propio ni rival). Se prueba el paso ideal y, si está ocupado,
    // los dos pasos "laterales" que también acercan al objetivo.
    const clamp = (v) => Math.max(0, Math.min(Units.boardSize - 1, v));
    const candidates = [[dr, dc]];
    if (dr !== 0 && dc !== 0) candidates.push([dr, 0], [0, dc]);
    else if (dr !== 0) candidates.push([dr, 1], [dr, -1]);
    else candidates.push([1, dc], [-1, dc]);
    let nextRow = g.row;
    let nextCol = g.col;
    for (const [sr, sc] of candidates) {
      const r = clamp(g.row + sr);
      const c = clamp(g.col + sc);
      if (r === g.row && c === g.col) continue;
      if (typeof Units !== "undefined" && Units.unitAt(r, c)) continue;
      nextRow = r;
      nextCol = c;
      break;
    }
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
  // Precarga y decodifica las dos poses de ataque (solo la primera vez) para
  // que el cambio de sprite sea instantáneo y no haya un fotograma en blanco.
  async _preloadAttackFrames() {
    if (!this._attackFrames) {
      this._attackFrames = [GNOMOGRO_SPRITES.preparaAtaque, GNOMOGRO_SPRITES.ataque].map((src) => {
        const img = new Image();
        img.src = src;
        return img;
      });
    }
    await Promise.all(this._attackFrames.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())));
  },

  // Ataque en 3 tiempos con deformación del sprite (squash & stretch, pivote
  // en los pies): 1) se agacha (anticipación) 2) se estira levantando los
  // brazos (preparaataque) y tiembla de rabia 3) golpe: cae aplastándose
  // (ataque) -> sonido + temblor de cámara -> rebote -> vuelve a reposo.
  async _playAttackAnim() {
    const g = this.current;
    const el = g.spriteEl;
    g.el.classList.add("gnomogro--attacking");
    await this._preloadAttackFrames();
    const anims = [];
    const play = (frames, ms, easing = "ease-out") => {
      if (!el.animate) return new Promise((resolve) => setTimeout(resolve, ms));
      const a = el.animate(frames, { duration: ms, easing, fill: "forwards" });
      anims.push(a);
      return a.finished.catch(() => {});
    };
    // Fotogramas de acción momentáneos -> .src directo, NUNCA vía
    // SpriteQuality.register (un fundido de calidad encima de una pose tan
    // rápida se vería raro); solo el reposo final se vuelve a registrar.
    await play([{ transform: "scale(1,1)" }, { transform: "scale(1.1,0.88)" }], 150, "ease-in");

    el.src = GNOMOGRO_SPRITES.preparaAtaque;
    await play(
      [{ transform: "scale(1.1,0.88)" }, { transform: "scale(0.94,1.13)" }],
      190,
      "cubic-bezier(0.2, 1.5, 0.4, 1)"
    );
    await play(
      [
        { transform: "scale(0.94,1.13) translateX(0)" },
        { transform: "scale(0.95,1.14) translateX(-4px)" },
        { transform: "scale(0.94,1.13) translateX(4px)" },
        { transform: "scale(0.95,1.14) translateX(-3px)" },
        { transform: "scale(0.94,1.13) translateX(0)" },
      ],
      220,
      "linear"
    );

    el.src = GNOMOGRO_SPRITES.ataque;
    await play(
      [
        { transform: "scale(0.94,1.13) translateY(-22px)" },
        { transform: "scale(1.16,0.82) translateY(3px)" },
      ],
      95,
      "cubic-bezier(0.6, 0, 1, 1)"
    );
    if (typeof SFX !== "undefined") SFX.gnomogroAttack();
    this._shakeViewport(true);
    await play(
      [
        { transform: "scale(1.16,0.82)" },
        { transform: "scale(0.97,1.06)", offset: 0.55 },
        { transform: "scale(1.02,0.98)", offset: 0.8 },
        { transform: "scale(1,1)" },
      ],
      320,
      "ease-out"
    );
    await new Promise((resolve) => setTimeout(resolve, 260));

    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(el, GNOMOGRO_SPRITES.idle);
    else el.src = GNOMOGRO_SPRITES.idle;
    anims.forEach((a) => a.cancel());
    g.el.classList.remove("gnomogro--attacking");
  },

  async _attackUnit(target) {
    const g = this.current;
    Units.faceTowardsTile(g, target.row, target.col);
    await this._playAttackAnim();
    // "usara su accion por turno para matarlo de un golpe" — muerte
    // instantánea sea cual sea la vida que le quedara (GNOMOGRO_ATTACK queda
    // como cifra de referencia de la criatura).
    const dealt = Math.min(target.hp, GNOMOGRO_ATTACK);
    target.hp = Math.max(0, target.hp - GNOMOGRO_ATTACK);
    Units.updateHpBar(target);
    Units.spawnFloatingText(target, `-${dealt}`, { className: "dmg-popup" });
    Units.playShake(target);
    if (target.hp > 0) return; // sobrevivió (más de 15 de vida)
    if (typeof Glory !== "undefined") Glory.queueKillBonus(g.team);
    await Units.removeUnit(target);
    if (typeof Gnome !== "undefined") Gnome.dropHeldBy(target);
  },

  // "cuando llegue a la base enemiga la destruira (ahora con 15 de daño por golpe) y acabara la
  // partida" — reutiliza Obelisks._destroy tal cual (mismo "apagón" visual
  // que un Obelisco destruido por combate normal, que ya comprueba solo
  // queda un equipo en pie y muestra la pantalla de fin de partida).
  async _attackObelisk(obelisk) {
    const g = this.current;
    Units.faceTowardsTile(g, obelisk.row, obelisk.col);
    await this._playAttackAnim();
    // Ataque 15: resta 15 de vida al Obelisco y solo lo destruye si llega a 0.
    obelisk.hp = Math.max(0, obelisk.hp - GNOMOGRO_ATTACK);
    Units.updateHpBar(obelisk);
    Units.spawnFloatingText(obelisk, `-${GNOMOGRO_ATTACK}`, { className: "dmg-popup" });
    Units.playShake(obelisk);
    if (obelisk.hp <= 0 && typeof Obelisks !== "undefined") await Obelisks._destroy(obelisk);
  },

  // ---------- Se le puede hacer daño ----------
  // Pedido explícito: "al gnomogro se le puede bajar la vida con ataques
  // normales o machacandole gnomos sobre el si el portador de un gnomo lo
  // hace". Proveedor de rango (Units.registerRangeProvider): igual que
  // Obelisks.showFor — mira de ataque sobre la criatura para los personajes
  // del bando contrario a quien la invocó. Con un gnomo cogido el golpe es
  // un machacón (daño = puntos del gnomo); sin él, un ataque normal.
  showFor(unit) {
    const g = this.current;
    if (!g || g.team === unit.team) return;
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    if (typeof Fog !== "undefined" && Fog.isFogged(g.row, g.col)) return;
    const approach = this.findApproachTile(unit, g);
    if (!approach) return;
    const needsMove = approach.row !== unit.row || approach.col !== unit.col;
    if (needsMove && typeof Turns !== "undefined" && !(typeof Skills !== "undefined" ? Skills.canApproachAttack(unit) : Turns.remainingActions(unit) >= 2)) return;
    Units.addMarker({
      className: "attack-marker gnomogro-attack-marker",
      row: g.row,
      col: g.col,
      zOffset: 2,
      visibleClass: "attack-marker--visible",
      owner: "gnomogro",
      alwaysOnTop: true,
      onClick: () => this.approachAndAttack(unit, g),
      buildContent: (marker) => {
        const icon = document.createElement("i");
        icon.className = "ph ph-crosshair-simple attack-marker__icon";
        marker.appendChild(icon);
      },
    });
    if (Math.max(Math.abs(g.row - unit.row), Math.abs(g.col - unit.col)) <= GNOMOGRO_ATTACK_RANGE) {
      g.el.classList.add("gnomogro--targeted");
    }
  },

  onClear() {
    if (this.current && this.current.el) this.current.el.classList.remove("gnomogro--targeted");
  },

  findApproachTile(unit, g) {
    const moveRange = UNIT_TYPES[unit.typeId].movimiento;
    const distToG = (row, col) => Math.max(Math.abs(row - g.row), Math.abs(col - g.col));
    if (distToG(unit.row, unit.col) <= GNOMOGRO_ATTACK_RANGE) return { row: unit.row, col: unit.col };
    let best = null;
    let bestDist = Infinity;
    for (let row = 0; row < Units.boardSize; row++) {
      for (let col = 0; col < Units.boardSize; col++) {
        if (row === unit.row && col === unit.col) continue;
        if (row === g.row && col === g.col) continue;
        if (distToG(row, col) > GNOMOGRO_ATTACK_RANGE) continue;
        if (Units.unitAt(row, col)) continue;
        if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) continue;
        if (typeof Villages !== "undefined" && Villages.at(row, col)) continue;
        if (typeof Shops !== "undefined" && Shops.at(row, col)) continue;
        if (typeof Obelisks !== "undefined" && Obelisks.at(row, col)) continue;
        if (typeof Altar !== "undefined" && Altar.at(row, col)) continue;
        if (this.at(row, col)) continue;
        if (typeof Resources !== "undefined" && Resources.at(row, col)) continue;
        if (typeof TerrainMap !== "undefined" && !(typeof Skills !== "undefined" ? Skills.walkableFor(unit.team, row, col) : TerrainMap.isWalkable(row, col))) continue;
        const moveDist = Math.max(Math.abs(row - unit.row), Math.abs(col - unit.col));
        if (moveDist > moveRange || (typeof Skills !== "undefined" && Skills.moveCost(unit, row, col) > moveRange)) continue;
        if (!Units.pathIsWalkable(unit.row, unit.col, row, col, unit.team)) continue;
        if (moveDist < bestDist) {
          bestDist = moveDist;
          best = { row, col };
        }
      }
    }
    return best;
  },

  async approachAndAttack(unit, g) {
    Units.clearRangeOverlays();
    if (!this.current || this.current !== g) return;
    const approach = this.findApproachTile(unit, g);
    if (!approach) return;
    if (approach.row !== unit.row || approach.col !== unit.col) {
      if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
      const path = Units.stepPath(unit.row, unit.col, approach.row, approach.col);
      await Units.walkPath(unit, path);
      if (typeof Skills !== "undefined") Skills.spendApproach(unit);
      else if (typeof Turns !== "undefined") Turns.useAction(unit);
      if (typeof Fog !== "undefined" && unit.team === "player") Fog.revealForUnit(unit);
    }
    await this.attackedBy(unit, g);
  },

  // Golpe contra la criatura: machacón si `unit` lleva un gnomo, ataque
  // normal si no. Sin empujón ni contraataque (la criatura solo actúa en su
  // propio turno).
  async attackedBy(unit, g) {
    if (!this.current || this.current !== g || g.team === unit.team) return;
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    const gnome = typeof Gnome !== "undefined" ? Gnome.list.find((x) => x.heldBy === unit.id) : null;
    Units.clearRangeOverlays();
    Units.faceTowardsTile(unit, g.row, g.col);

    if (gnome) {
      const damage = gnome.points;
      g.hp = Math.max(0, g.hp - damage);
      if (typeof Turns !== "undefined") Turns.useAction(unit);
      await Villages._playEpicSmash(unit, g, damage, false);
    } else {
      const damage =
        UNIT_TYPES[unit.typeId].fuerza +
        (typeof Armory !== "undefined" ? Armory.attackBonus(unit.team) : 0) +
        (typeof Skills !== "undefined" ? Skills.attackBonus(unit, g) : 0);
      if (typeof Turns !== "undefined") Turns.useAction(unit);
      g.hp = Math.max(0, g.hp - damage);
      Units.updateHpBar(g);
      Units.spawnFloatingText(g, `-${damage}`, { className: "dmg-popup" });
      Units.playShake(g);
      if (typeof SFX !== "undefined") SFX.hit();
      if (unit.el) {
        unit.el.classList.remove("unit--punching");
        void unit.spriteEl.offsetWidth;
        unit.el.classList.add("unit--punching");
        setTimeout(() => unit.el.classList.remove("unit--punching"), 320);
      }
    }

    if (g.hp <= 0) await this._die(unit.team);
    Units.refreshRange(unit);
  },

  async _die(killerTeam) {
    const g = this.current;
    if (!g) return;
    this.current = null;
    if (typeof Glory !== "undefined") Glory.queueKillBonus(killerTeam);
    if (typeof SFX !== "undefined") {
      SFX.explosion();
      SFX.death();
    }
    this._shakeViewport(true);
    g.el.classList.remove("gnomogro--targeted");
    g.el.style.transition = "opacity 0.6s ease, transform 0.6s ease";
    g.el.style.opacity = "0";
    await new Promise((resolve) => setTimeout(resolve, 650));
    g.el.remove();
    if (typeof Fog !== "undefined") Fog.applyVisibility();
  },
};

if (typeof Units !== "undefined" && Units.registerRangeProvider) Units.registerRangeProvider(GnomOgro);

/* Gnomore Gnomes — poblados neutrales.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Colocar N poblados neutrales al empezar cada partida, en losetas
       transitables y libres.
     - Pintarlos (sprite + barra de vida, reutilizando las piezas visuales
       de js/units.js) y cambiar su sprite/dueño al conquistarse.
     - Ofrecer la mira de ataque a un poblado (solo si la unidad seleccionada
       lleva un gnomo cogido) y resolver el golpe: resta los puntos del
       gnomo a la vida del poblado, el gnomo muere y desaparece del juego
       (Gnome.destroyInstance, ver ese archivo), y si la vida llega a 0 el
       poblado pasa a ser del equipo atacante.
     - Contar cuántos poblados posee cada equipo (Villages.ownedCount), que
       es lo único que necesita saber js/glory.js para sumar el bonus de
       gloria persistente por poblado — ni Glory sabe cómo son los poblados
       ni Villages sabe cómo se generan los puntos de gloria, cada uno habla
       con el otro a través de esta única función.

   Pedido explícito: "añadimos poblados neutrales, los poblados neutrales
   aparecen desperdigados por el mapa, de momento puedes poner 2. los
   poblados neutrales tienen 10 puntos de vida, puedes atacarlos solo si
   tienes un gnomo en la mano. de ser asi los puntos acumulados del gnomo se
   restan a los puntos de vida del poblado. si un equipo consigue destruir
   un poblado neutral por completo, el sprite del poblado cambiara al del de
   su equipo. tener un poblado otorga +1 punto de gloria persistentes a
   todos los turnos. cuando se pega con un gnomo a un poblado el gnomo muere
   y desaparece del juego"

   Se registra como "proveedor de rango" igual que Movement/Combat/Gnome
   (ver cabecera de units.js) — ninguno de esos archivos sabe que este
   existe, todos hablan solo con Units. */

const VILLAGE_MAX_HP = 10;
const VILLAGE_COUNT = 2; // "de momento puedes poner 2"
const VILLAGE_ATTACK_RANGE = 1; // cuerpo a cuerpo, igual que Combat.attackRange

// Sprite de cada poblado según su dueño — "neutral" al generarse, y el de
// la RAZA del equipo que lo conquista (no el team "player"/"enemy" en sí,
// para que dos partidas con razas distintas en el mismo bando se vean
// distintas, igual que ya hace el resto de arte del juego, ver races.js).
const VILLAGE_SPRITES = {
  neutral: "assets/iconos/poblado_neutral.png",
  mushboom_forest: "assets/iconos/poblado_mushboom_forest.png",
  colinas_rockntroll: "assets/iconos/poblado_colinas_rockntroll.png",
};

const Villages = {
  list: [],
  _raceIds: { player: null, enemy: null },
  _nextId: 1,
  _flashEl: null,
  _targetedIds: [],

  // Se llama junto a Glory.init (newgame-flow.js) para que Villages sepa
  // qué sprite de raza usar cuando cada equipo conquiste uno — mismo patrón
  // que Glory._raceIds, cada archivo con su propia copia en vez de leer la
  // del otro directamente (regla de oro: un archivo por mecánica).
  init(playerRaceId, enemyRaceId) {
    this._raceIds = { player: playerRaceId, enemy: enemyRaceId };
  },

  // Se llama ANTES de spawn() al empezar cada partida nueva (igual que
  // Gnome.resetAll) — quita del DOM los poblados de la partida anterior y
  // vacía la lista.
  resetAll() {
    this.list.forEach((v) => v.el.remove());
    this.list = [];
    this._targetedIds = [];
  },

  // Coloca VILLAGE_COUNT poblados en losetas transitables, libres (sin
  // unidad, gnomo NI otro poblado) y no demasiado cerca unas de otras (para
  // que no aparezcan las dos pegadas por pura casualidad) — mismo espíritu
  // que Units.spawnRandomEnemy: intenta unas cuantas veces al azar antes de
  // rendirse, nunca bloquea la partida si el mapa está muy lleno.
  spawn(boardSize) {
    const MIN_SEPARATION = 3;
    let attempts = 0;
    while (this.list.length < VILLAGE_COUNT && attempts < 500) {
      attempts++;
      const row = Math.floor(Math.random() * boardSize);
      const col = Math.floor(Math.random() * boardSize);
      if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) continue;
      if (typeof Units !== "undefined" && Units.unitAt(row, col)) continue;
      if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) continue;
      if (this.at(row, col)) continue;
      const tooClose = this.list.some(
        (v) => Math.max(Math.abs(v.row - row), Math.abs(v.col - col)) < MIN_SEPARATION
      );
      if (tooClose) continue;
      this._create(row, col);
    }
  },

  at(row, col) {
    return this.list.find((v) => v.row === row && v.col === col) || null;
  },

  // Cuántos poblados posee `team` ahora mismo — se mantiene tal cual (ya no
  // la usa Glory, ver gloryBonusFor más abajo) porque sigue siendo útil como
  // dato simple por si algo más adelante solo necesita el recuento.
  ownedCount(team) {
    return this.list.filter((v) => v.owner === team).length;
  },

  // Lo que SÍ necesita saber js/glory.js (Glory.grantTurnStart) para el
  // bonus persistente: la suma del bonus de CADA poblado que posee `team`,
  // no solo el recuento — pedido explícito: "si se destuye un poblado...en
  // un turno de un solo golpe...otorga +2 puntos persistentes para todos
  // los turnos en vez de +1" (ver _capture, gloryBonus se fija ahí al
  // conquistarlo y no cambia después, así que sumarlos basta).
  gloryBonusFor(team) {
    return this.list
      .filter((v) => v.owner === team)
      .reduce((sum, v) => sum + (v.gloryBonus || 1), 0);
  },

  spriteFor(owner) {
    if (owner === "neutral") return VILLAGE_SPRITES.neutral;
    const raceId = this._raceIds[owner];
    return VILLAGE_SPRITES[raceId] || VILLAGE_SPRITES.neutral;
  },

  _create(row, col) {
    // Reutiliza la clase "unit" (ver style.css) SOLO por su posicionamiento
    // base (translate(-50%,-92%), el mismo cálculo de loseta que cualquier
    // personaje) y el temblor .unit--hit al recibir un golpe — el poblado
    // nunca entra en Units.list, así que Units.unitAt/combate/movimiento
    // jamás lo confunden con una unidad de verdad.
    const el = document.createElement("div");
    el.className = "unit village village--neutral";

    const spriteEl = document.createElement("img");
    spriteEl.className = "village__sprite";
    spriteEl.src = VILLAGE_SPRITES.neutral;
    spriteEl.alt = "";
    spriteEl.draggable = false;
    el.appendChild(spriteEl);

    // Barra de vida — mismas piezas/clases que Units.updateHpBar espera
    // (unit__hpbar-segment / --filled / --low / --pop), así se reutiliza esa
    // función tal cual en vez de reescribir la lógica de segmentos aquí.
    // Siempre visible (a diferencia de la de una unidad, que solo aparece
    // seleccionada/con el cursor encima — ver .village .unit__hpbar en
    // style.css): un poblado no se selecciona nunca, así que sin esto su
    // vida no se vería jamás.
    const hpBarEl = document.createElement("div");
    hpBarEl.className = "unit__hpbar village__hpbar";
    const hpSegmentEls = [];
    for (let i = 0; i < VILLAGE_MAX_HP; i++) {
      const seg = document.createElement("div");
      seg.className = "unit__hpbar-segment";
      hpBarEl.appendChild(seg);
      hpSegmentEls.push(seg);
    }
    el.appendChild(hpBarEl);

    // "cuando el totem este dentro del alcance de ataque de un personaje se
    // debe poder atacar simplemente con pulsar sobre el, no solo sobre el
    // circulo" (pedido explícito) — mismo patrón que Units._onUnitClick con
    // "unit--targeted" para un rival atacable: si este tótem está marcado
    // como objetivo ahora mismo (ver showFor, "village--targeted" más abajo)
    // y hay una unidad seleccionada, un clic sobre el propio tótem ataca
    // directamente en vez de no hacer nada (los poblados nunca se
    // seleccionan, así que no hay que desviar ningún otro comportamiento).
    el.addEventListener("click", (e) => {
      if (!el.classList.contains("village--targeted")) return;
      if (typeof Units === "undefined" || !Units.selectedId) return;
      e.stopPropagation();
      const attacker = Units.list.find((u) => u.id === Units.selectedId);
      if (attacker) this.attack(attacker, village);
    });

    if (typeof Units !== "undefined") Units.container.appendChild(el);

    const village = {
      id: `village-${this._nextId++}`,
      row,
      col,
      owner: "neutral",
      hp: VILLAGE_MAX_HP,
      maxHp: VILLAGE_MAX_HP,
      gloryBonus: 1, // se fija de verdad al conquistarse, ver _capture()
      el,
      spriteEl,
      hpBarEl,
      hpSegmentEls,
    };
    this._placeInstant(village);
    if (typeof Units !== "undefined") Units.updateHpBar(village);
    this.list.push(village);
    return village;
  },

  _placeInstant(village) {
    if (typeof getTileCenter === "undefined" || typeof Units === "undefined") return;
    const { x, y } = getTileCenter(village.row, village.col, Units.boardSize);
    village.el.style.left = `${x}px`;
    village.el.style.top = `${y}px`;
    village.el.style.zIndex = String((village.row + village.col) * 10 + 5);
  },

  // ---------- Proveedor de rango (ver cabecera de units.js) ----------
  // Pedido explícito: "puedes atacarlos solo si tienes un gnomo en la
  // mano" — a diferencia de Combat (que se apaga MIENTRAS se lleva un
  // gnomo cogido, ver Gnome.isHeldBy en combat.js), esta mecánica es
  // exactamente la contraria: solo se activa CUANDO se lleva uno.
  showFor(unit) {
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    if (typeof Gnome === "undefined" || !Gnome.isHeldBy(unit.id)) return;
    this.list.forEach((village, i) => {
      if (village.owner === unit.team) return; // no se ataca el propio poblado
      const dist = Math.max(Math.abs(village.row - unit.row), Math.abs(village.col - unit.col));
      if (dist > VILLAGE_ATTACK_RANGE) return;
      // Niebla de guerra — mismo criterio que Combat/Gnome: no se ofrece
      // atacar algo que todavía no se ha revelado.
      if (typeof Fog !== "undefined" && Fog.isFogged(village.row, village.col)) return;
      Units.addMarker({
        className: "attack-marker village-attack-marker",
        row: village.row,
        col: village.col,
        zOffset: 2,
        delayIndex: i,
        visibleClass: "attack-marker--visible",
        owner: "villages",
        buildContent: (marker) => {
          const icon = document.createElement("i");
          icon.className = "ph ph-crosshair-simple attack-marker__icon";
          marker.appendChild(icon);
        },
        onClick: () => this.attack(unit, village),
      });

      // "village--targeted" — mismo patrón que "unit--targeted" en
      // combat.js: marca el tótem como atacable ahora mismo, para que el
      // clic directo sobre su sprite (ver el listener en _create) y el
      // cursor de diana (ver style.css) sepan cuándo activarse.
      village.el.classList.add("village--targeted");
      this._targetedIds.push(village.id);
    });
  },

  onClear() {
    this._targetedIds.forEach((id) => {
      const village = this.list.find((v) => v.id === id);
      if (village) village.el.classList.remove("village--targeted");
    });
    this._targetedIds = [];
  },

  async attack(unit, village) {
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    if (village.owner === unit.team) return;
    const gnome = typeof Gnome !== "undefined" ? Gnome.list.find((g) => g.heldBy === unit.id) : null;
    if (!gnome) return; // se lo quitaron/lo soltó justo antes del clic

    Units.clearRangeOverlays();
    Units.faceTowardsTile(unit, village.row, village.col);

    // "los puntos acumulados del gnomo se restan a los puntos de vida del
    // poblado" — el daño es exactamente los puntos que llevaba encima, sin
    // ninguna fórmula extra (a diferencia de Combat.attack, que usa la
    // fuerza del atacante: aquí lo que importa es lo cargado que iba el
    // gnomo, no quién lo llevaba).
    const damage = gnome.points;
    // "si se destuye un poblado neutral o enemigo...en un turno de un solo
    // golpe" — solo cuenta si el poblado seguía a su vida MÁXIMA justo antes
    // de este golpe concreto (nunca dañado antes, ni en este turno ni en
    // otro anterior) Y este golpe por sí solo lo deja a 0 o menos. Un
    // poblado ya dañado en un golpe previo que se remata después NO cuenta,
    // aunque ese golpe final sí sea el que lo destruye. Calculado ANTES de
    // gastar la acción del turno (más abajo) porque el propio aviso visual
    // de "sin acciones" depende de saber ya si esto va a ser un golpe
    // mortal en un solo golpe o no.
    const wasFullHp = village.hp >= village.maxHp;
    village.hp = Math.max(0, village.hp - damage);
    const oneHitKill = wasFullHp && village.hp <= 0;

    // Golpear a un poblado cuenta como UNA de las 2 acciones del turno,
    // igual que cualquier otra acción (moverse, golpear a un rival...).
    if (typeof Turns !== "undefined") Turns.useAction(unit);
    // "cuando se machaca a un gnomo el personaje no debe tener los colores
    // de inactivo hasta que se haya capturado el propio totem" (pedido
    // explícito) — Turns.useAction ya cuenta la acción de verdad (para que
    // canAct/el resto de reglas sigan siendo correctas durante todo el
    // salto), pero el aviso VISUAL de "sin acciones" (unit--exhausted, ver
    // turns.js) se quita otra vez aquí y no vuelve hasta el final de
    // _playEpicSmash — así el personaje se ve a toda saturación durante su
    // propio momento de gloria, no desteñido a media animación.
    if (oneHitKill && unit.el) unit.el.classList.remove("unit--exhausted");

    if (oneHitKill) {
      // La animación épica se encarga ella sola de la retroalimentación de
      // impacto (barra de vida, texto flotante, temblor, sonido, destruir
      // el gnomo) EN EL MOMENTO justo del golpe contra el suelo, no antes —
      // ver _playEpicSmash más abajo.
      await this._playEpicSmash(unit, village, damage);
    } else {
      Units.updateHpBar(village);
      Units.spawnFloatingText(village, `-${damage}`, { className: "dmg-popup" });
      Units.playShake(village);
      SFX.hit();

      // Retroalimentación en quien golpea, mismo gesto que Combat.attack.
      if (unit.el) {
        unit.el.classList.remove("unit--punching");
        void unit.spriteEl.offsetWidth;
        unit.el.classList.add("unit--punching");
        setTimeout(() => unit.el.classList.remove("unit--punching"), 320);
      }

      // "cuando se pega con un gnomo a un poblado el gnomo muere y
      // desaparece del juego" — a diferencia de un pase fallido o de
      // soltarlo al morir quien lo llevaba, aquí NO huye ni queda suelto:
      // desaparece del todo.
      Gnome.destroyInstance(gnome);
    }

    if (village.hp <= 0) {
      this._capture(village, unit.team, oneHitKill ? 2 : 1);
    }

    // Ahora que el tótem YA está capturado (si tocaba), toca reaplicar el
    // aviso visual de "sin acciones" que se suprimió arriba durante el
    // machacón épico — Turns.useAction ya había contado la acción de verdad
    // desde el principio, esto solo pone al día el propio classList.
    if (oneHitKill && typeof Turns !== "undefined") Turns.refreshExhaustedClass(unit);

    Units.refreshRange(unit);
  },

  // "si se destuye un poblado neutral o enemigo...en un turno de un solo
  // golpe, se activara una animacion donde el personaje en cuestion que
  // ataque saltara haciendo una parabola epica a camara lenta y machacara
  // el gnomo contra el suelo, la camara debe temblar al impactar contra el
  // suelo" (pedido explícito). Devuelve una promesa que no se resuelve hasta
  // que toda la secuencia termina, así attack() espera a que acabe antes de
  // seguir con la captura — igual de bloqueante para el resto del turno que
  // cualquier otra acción, no hace falta más sincronización.
  async _playEpicSmash(unit, village, damage) {
    const typeId = unit.typeId;
    const idleSrc = (typeof UNIT_TYPES !== "undefined" && UNIT_TYPES[typeId] && UNIT_TYPES[typeId].spriteUrl) || "";
    const machacaSrc = typeof Units !== "undefined" ? Units.machacaSpriteFor(typeId) : idleSrc;
    const gnome = typeof Gnome !== "undefined" ? Gnome.list.find((g) => g.heldBy === unit.id) : null;

    // Sube al personaje por encima de todo lo demás mientras dura el salto
    // (ver .unit--epic-smash en style.css) y le pone la pose "machaca" —
    // tanto el sprite del propio personaje como, si sigue con el gnomo
    // enganchado en este instante, la posición calibrada de esa pose (ver
    // GnomeInstance.setAttachPose, gnome.js).
    if (unit.spriteEl && machacaSrc) unit.spriteEl.src = machacaSrc;
    if (gnome) gnome.setAttachPose(unit, "machaca");
    unit.el.classList.remove("unit--epic-smash");
    void unit.spriteEl.offsetWidth;
    unit.el.classList.add("unit--epic-smash");
    if (typeof SFX !== "undefined") SFX.hit();

    // Sincronizado a mano con @keyframes unit-epic-smash (style.css): el
    // impacto contra el suelo cae sobre el 85% de esa animación de 1.1s.
    const IMPACT_DELAY_MS = 935;
    const TOTAL_MS = 1250;

    await new Promise((resolve) => setTimeout(resolve, IMPACT_DELAY_MS));

    // ---- Momento del impacto ----
    // Pose de impacto propia (distinta a la de "machaca"/salto de arriba)
    // justo en el instante en que tiembla la cámara — pedido explícito: "el
    // gnomo se desintegra asi que cuando se muestre este sprite el gnomo no
    // tiene que aparecer", por eso este cambio de sprite va JUSTO ANTES de
    // Gnome.destroyInstance(gnome) más abajo, no después.
    const impactSrc = typeof Units !== "undefined" ? Units.impactSpriteFor(typeId) : machacaSrc;
    if (unit.spriteEl && impactSrc) unit.spriteEl.src = impactSrc;
    Units.updateHpBar(village);
    Units.spawnFloatingText(village, `-${damage}`, { className: "dmg-popup" });
    Units.spawnFloatingText(village, "¡GOLPE MORTAL!", { className: "dmg-popup gnome-points-popup" });
    Units.playShake(village);
    if (typeof SFX !== "undefined") SFX.glory();
    // "la camara debe temblar al impactar contra el suelo" — sobre
    // board-viewport (nunca board-camera: ese ya lleva su propio transform
    // de paneo/zoom puesto por JS en boardview.js, y una animación CSS ahí
    // lo pisaría durante el temblor) para que se note en todo el tablero
    // visible sin pelearse con el paneo/zoom del jugador.
    const viewportEl = document.getElementById("board-viewport");
    if (viewportEl) {
      viewportEl.classList.remove("board-viewport--shake");
      void viewportEl.offsetWidth;
      viewportEl.classList.add("board-viewport--shake");
      setTimeout(() => viewportEl.classList.remove("board-viewport--shake"), 420);
    }
    // "cuando se pega con un gnomo a un poblado el gnomo muere y desaparece
    // del juego" — en el golpe mortal, desaparece justo en el instante del
    // machacón contra el suelo, no al principio del salto.
    if (gnome) Gnome.destroyInstance(gnome);
    // "un pequeño destello blanco puede iluminar la pantalla un instante"
    // (pedido explícito) — mismo instante que el temblor de cámara de
    // arriba, ver _flashScreen().
    this._flashScreen();

    await new Promise((resolve) => setTimeout(resolve, TOTAL_MS - IMPACT_DELAY_MS));

    // ---- Fin de la animación: vuelve todo a la normalidad ----
    unit.el.classList.remove("unit--epic-smash");
    if (unit.spriteEl && idleSrc) unit.spriteEl.src = idleSrc;
  },

  // Destello blanco de pantalla completa en el instante del impacto — mismo
  // patrón que el resto del proyecto para elementos globales creados una
  // sola vez y reutilizados (ver settingsmenu.js/turns.js: se crea la
  // primera vez que hace falta y se guarda la referencia). Reinicia la
  // clase en cada llamada (remove/reflow/add) por si dos machacones épicos
  // se solaparan, igual que el resto de animaciones de "un solo tiro" de
  // este archivo (unit--epic-smash, board-viewport--shake).
  _flashScreen() {
    if (!this._flashEl) {
      const el = document.createElement("div");
      el.id = "epic-smash-flash";
      document.body.appendChild(el);
      this._flashEl = el;
    }
    this._flashEl.classList.remove("epic-smash-flash--active");
    void this._flashEl.offsetWidth;
    this._flashEl.classList.add("epic-smash-flash--active");
  },

  // "si un equipo consigue destruir un poblado neutral por completo, el
  // sprite del poblado cambiara al del de su equipo. tener un poblado
  // otorga +1 punto de gloria persistentes a todos los turnos" — el bonus
  // en sí no se "concede" aquí: Glory.grantTurnStart (glory.js) pregunta en
  // cada inicio de turno cuánto suma gloryBonusFor() de cada equipo, así
  // que basta con cambiar `owner`/`gloryBonus` para que el próximo turno de
  // ese equipo ya lo tenga en cuenta, sin que este archivo necesite saber
  // nada de puntos de gloria. `gloryBonus` (1 normal, 2 si fue un golpe
  // mortal en un solo golpe, ver attack()/_playEpicSmash) queda fijado aquí
  // para siempre — un poblado no "pierde" el bonus con el que se conquistó
  // hasta que alguien vuelva a conquistarlo.
  _capture(village, team, gloryBonus) {
    village.owner = team;
    village.gloryBonus = gloryBonus || 1;
    village.hp = VILLAGE_MAX_HP; // un poblado recién conquistado vuelve a estar sano
    village.el.classList.remove("village--neutral");
    village.el.classList.add(`village--${team}`);
    village.spriteEl.src = this.spriteFor(team);
    Units.updateHpBar(village);
    // Quita el temblor de "golpe recibido" (Units.playShake, ver attack()
    // más arriba) ANTES de añadir el pop de conquista: los dos animan la
    // misma propiedad (transform) sobre el mismo elemento, así que dejarlos
    // solapados un instante se vería a tirones — el pop de conquista es el
    // que manda en este momento, más grande y con más sentido que el golpe.
    village.el.classList.remove("unit--hit");
    village.el.classList.remove("village--captured");
    void village.el.offsetWidth;
    village.el.classList.add("village--captured");
    // "Al conseguir un totem debe escucharse un sonido de satisfaccion"
    // (pedido explícito) — sonido propio y más "grande" que el genérico de
    // gloria (SFX.glory, ese sigue sonando aparte en el impacto del golpe
    // mortal, ver _playEpicSmash), justo en el instante de la conquista.
    if (typeof SFX !== "undefined") SFX.captureVillage();
    Units.spawnFloatingText(village, "¡Conquistado!", { className: "dmg-popup gnome-points-popup" });
    // El indicador discreto "+X / turno" del HUD de gloria (solo se pinta
    // el del jugador, ver glory.js) debe reflejar el nuevo poblado ya
    // mismo, no esperar al próximo inicio de turno.
    if (typeof Glory !== "undefined") Glory.refreshPreview(team);
  },
};

Units.registerRangeProvider(Villages);

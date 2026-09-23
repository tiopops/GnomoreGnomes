/* Gnomore Gnomes — "el gnomo": el personaje neutral que hace de pelota.
   Regla de oro: un archivo por mecánica. Este archivo sabe todo lo suyo
   (huir, dejarse coger, llevarse cogido, recibir golpes, ser pasado) y no
   toca directamente el resto del motor — se conecta con él exactamente
   igual que movement.js/combat.js:

     Units.registerRangeProvider(Gnome) — mismo patrón que Movement/Combat:
     showFor(unit) solo se llama para unidades del JUGADOR seleccionadas, y
     es donde este archivo decide si mostrar la mira de "coger" (si algún
     gnomo anda suelto y está a su alcance) o los botones de "golpear" /
     "pasar" (si esa unidad lleva alguno cogido ahora mismo).

   PUEDE HABER VARIOS GNOMOS A LA VEZ (pedido explícito) — por eso el
   archivo se organiza en dos niveles:
     - `Gnome` es el GESTOR: la única cosa que el resto del motor conoce
       (Units.registerRangeProvider(Gnome), movement.js/combat.js llaman a
       Gnome.isAt/Gnome.reactToPlayerMove/Gnome.isHeldBy, newgame-flow.js
       llama a Gnome.spawnNear). Mantiene `Gnome.list` (un GnomeInstance por
       gnomo en juego) y los DOS botones de acción compartidos
       (golpear/pasar, ver más abajo por qué son compartidos y no uno por
       gnomo).
     - Cada elemento de `Gnome.list` es un GnomeInstance (ver
       createGnomeInstance) con TODO su propio estado — posición, si lo
       llevan cogido, sus puntos acumulados — creado con la MISMA forma que
       una unidad normal (row/col/facing/el/flipEl/spriteEl) a propósito,
       para poder reutilizar tal cual las utilidades de Units pensadas para
       cualquier "unidad": el giro (Units._applyFacing), la colocación
       (Units._placeInstant), el desplazamiento paso a paso con salto y
       sonido (Units.walkPath/hopTo). Ninguno vive en Units.list (no son
       unidades "de verdad": no tienen equipo, no atacan, no tienen vida)
       así que las mecánicas que sí recorren esa lista (áreas de
       movimiento, aproximación al atacar...) siguen excluyendo sus losetas
       a mano llamando a Gnome.isAt(row, col) — ver esas líneas en
       movement.js y combat.js, sin cambios: ese método sigue existiendo
       igual en el gestor, ahora comprobando TODOS los gnomos en vez de uno
       solo, así que ningún otro archivo del proyecto necesita saber que
       ahora hay varios.

   Los botones de golpear/pasar SÍ son compartidos (uno solo de cada, no uno
   por gnomo): solo puede haber una unidad seleccionada a la vez, y esa
   unidad como mucho lleva UN gnomo cogido, así que basta con que el gestor
   recuerde "qué gnomo lleva cogido la unidad seleccionada ahora mismo"
   (Gnome._currentHeldGnome/_currentHolderUnit) y los botones actúen sobre
   ese — exactamente la misma lógica de antes, solo que ahora ese gnomo
   concreto se busca en vez de asumir que solo existe uno. */

const GNOME_ASSETS = {
  idle: "assets/equipos/MushboomForest/gnomo_idle.png",
  grita: "assets/equipos/MushboomForest/gnomo_grita.png",
};

// Ancho (px) del sprite del gnomo en el suelo (parado/huyendo), en pleno
// vuelo (ver GnomeInstance.animateThrowTo) y mientras lo llevan cogido —
// calibrados con debug/calibrar-gnomo.html. "held" es UN ÚNICO valor
// compartido por TODOS los personajes Y TODOS los gnomos (a diferencia de
// right/bottom en GNOME_ATTACH_OFFSETS, que sí varían según el personaje):
// cualquier gnomo debe verse siempre del mismo tamaño mientras lo llevan,
// solo cambia dónde se engancha.
const GNOME_SIZES = {
  ground: 69,
  flying: 86,
  held: 85,
};

// Duración (ms) del aplastón + rebote al caer tras un pase fallido — debe
// coincidir con la de @keyframes gnome-land-impact en style.css.
const GNOME_LAND_IMPACT_MS = 480;

// Duración BASE (segundos) de las dos animaciones de "idle" del gnomo — la
// respiración mientras anda suelto (.gnome__sprite, animation-duration en
// style.css) y el temblor mientras lo llevan cogido (.gnome-attach__sprite,
// @keyframes gnome-nervous-tremble) — deben coincidir con esos valores en
// style.css. GnomeInstance._applyNervousness() las acorta según los puntos
// que lleve acumulados (pedido explícito: "en función de la cantidad de
// puntos que llevan acumulados, sus animaciones de idle son más rápidas...
// más nerviosos tienen que parecer"), así que estos dos números son el
// punto de partida a 0 puntos, no un valor fijo.
const GNOME_IDLE_BASE_S = { loose: 0.87, held: 0.45 };

// Umbral de puntos (a partir de aquí) y puntos necesarios para llegar al
// tope de intensidad de los DOS efectos "exagerados" de muchos puntos
// acumulados (pedido explícito: "los movimientos y animaciones de los
// gnomos con muchos puntos acumulados deben ser más exagerados... pueden ir
// tiñéndose de rojo o dar pequeños saltitos por la superficie de su propia
// loseta"):
//   - GNOME_RED_TINT_MAX_POINTS: puntos en los que el tinte rojo (filtro
//     CSS, ver _applyNervousness) llega a su máximo — empieza a notarse
//     desde el primer punto, no hay umbral mínimo para este efecto.
//   - GNOME_HOP_MIN_POINTS / GNOME_HOP_MAX_CHANCE: por debajo del mínimo
//     nunca da saltitos él solo; a partir de ahí la probabilidad de saltar
//     en cada ciclo de idle sube con los puntos hasta un tope (nunca un
//     salto continuo, sigue siendo "de vez en cuando").
const GNOME_RED_TINT_MAX_POINTS = 20;
const GNOME_HOP_MIN_POINTS = 6;
const GNOME_HOP_MAX_CHANCE = 0.6;

// Posición del gnomo "amarrado" al brazo de quien lo lleva cogido, UNA POR
// TIPO DE PERSONAJE — hace falta porque no todos los personajes tienen el
// mismo tamaño en pantalla (ver SPRITE_SCALES en units.js): el
// mismo offset que queda bien en un personaje normal se ve descolocado en
// uno más grande como el GolemCorteza. "default" es el que se usa para
// cualquier tipo nuevo que todavía no se haya calibrado a mano — así un
// personaje añadido más adelante nunca se queda sin gnomo visible, solo con
// un ajuste genérico hasta que se afine el suyo propio.
// El TAMAÑO mientras está cogido, en cambio, NO vive aquí — es el mismo
// para todos los personajes (ver GNOME_SIZES.held más arriba).
// Calibrados arrastrando dentro del propio juego (?calibrarGnomo, ver
// js/gnomecalib.js) y con debug/calibrar-gnomo.html.
const GNOME_ATTACH_OFFSETS = {
  default: { right: -14, bottom: 6 },
  hombre_arbol: { right: 72, bottom: 17 },
  surcabosques: { right: 38, bottom: 6 },
  seta_artificiero: { right: 33, bottom: 6 },
  goblin_lanzador: { right: 35, bottom: 61 },
  urgamentes: { right: 55, bottom: 16 },
  punoroca: { right: 86, bottom: 7 },
};

// Misma idea que GNOME_ATTACH_OFFSETS de arriba, pero para la pose
// "machacagnomos" (ver Villages._playEpicSmash, js/villages.js): el brazo
// que golpea queda levantado/adelantado de forma distinta al de sujetar en
// reposo, así que el gnomo cogido necesita su PROPIO ajuste por personaje
// durante esos instantes, no el mismo que en "iddle" — pedido explícito:
// "tambien debe poder ajustarse desde calibrar gnomo en esta posicion
// concreta ademas de en la de iddle para cada personaje" (ver
// js/gnomecalib.js, GnomeCalib.pose). Sin calibrar todavía a mano para
// ningún personaje: usa "default" para todos hasta que se ajuste desde
// ?calibrarGnomo.
const GNOME_ATTACH_OFFSETS_MACHACA = {
  default: { right: -14, bottom: 40 },
  hombre_arbol: { right: -21, bottom: 71 },
  surcabosques: { right: -14, bottom: 40 },
  seta_artificiero: { right: -14, bottom: 40 },
  goblin_lanzador: { right: -14, bottom: 40 },
  urgamentes: { right: -14, bottom: 40 },
  punoroca: { right: -14, bottom: 40 },
};

// ---------- Cada gnomo individual ----------
//
// Fábrica en vez de clase por consistencia con el resto del proyecto (todo
// vive en objetos literales, ver Units/Movement/Combat) — cada llamada
// crea un objeto nuevo con su propio estado, pero comparten los mismos
// métodos por closure (todos leen las constantes de arriba y, cuando
// necesitan algo del GESTOR — los botones compartidos, o comprobar la
// loseta de OTROS gnomos — llaman a `Gnome` directamente por nombre, ver
// nota en la cabecera del archivo).
function createGnomeInstance() {
  return {
    el: null,
    flipEl: null,
    spriteEl: null,
    row: 0,
    col: 0,
    facing: "right",

    heldBy: null, // id de la unidad que lo lleva cogido, o null si anda suelto
    points: 0,
    busy: false, // true durante una animación propia (huida, vuelo...) para no solaparse
    passing: false, // true mientras están visibles las miras de destino de un pase

    attachEl: null,
    attachSpriteEl: null,
    _badgeEl: null,
    _badgeValueEl: null,
    _badgeVisible: false,
    _flipTimer: null,

    // ---------- Colocación en el tablero ----------

    // Busca la loseta libre (sin ninguna unidad NI otro gnomo) más cercana a
    // (row, col) en espiral y coloca ahí a este gnomo — así spawnTestUnits
    // (newgame-flow.js) puede pedir "cerca del centro" sin tener que
    // calcular a mano qué losetas están ya ocupadas, ni por personajes de
    // prueba ni por otro gnomo ya colocado antes que este.
    spawnNear(row, col) {
      const walkable = (r, c) => typeof TerrainMap === "undefined" || TerrainMap.isWalkable(r, c);
      const noVillage = (r, c) => typeof Villages === "undefined" || !Villages.at(r, c);
      // Tienda Goblin (js/shops.js) — tampoco aparece encima de una.
      const noShop = (r, c) => typeof Shops === "undefined" || !Shops.at(r, c);
      if (
        !Units.unitAt(row, col) &&
        !Gnome._otherGnomeAt(this, row, col) &&
        walkable(row, col) &&
        noVillage(row, col) &&
        noShop(row, col)
      ) {
        this.spawn(row, col);
        return;
      }
      for (let radius = 1; radius <= Units.boardSize; radius++) {
        for (let dr = -radius; dr <= radius; dr++) {
          for (let dc = -radius; dc <= radius; dc++) {
            const r = row + dr;
            const c = col + dc;
            if (r < 0 || c < 0 || r >= Units.boardSize || c >= Units.boardSize) continue;
            if (Units.unitAt(r, c)) continue;
            if (Gnome._otherGnomeAt(this, r, c)) continue;
            // Terreno (js/mapgen.js, TerrainMap) — un gnomo tampoco aparece
            // sobre agua; la propia espiral ya sigue buscando hacia afuera
            // hasta encontrar la loseta transitable libre más cercana.
            if (!walkable(r, c)) continue;
            // Poblados (js/villages.js) — tampoco aparece encima de uno.
            if (!noVillage(r, c)) continue;
            // Tienda Goblin (js/shops.js) — tampoco aparece encima de una.
            if (!noShop(r, c)) continue;
            this.spawn(r, c);
            return;
          }
        }
      }
    },

    spawn(row, col) {
      const el = document.createElement("div");
      el.className = "unit gnome";

      const flipEl = document.createElement("div");
      flipEl.className = "unit__flip gnome__flip";

      const spriteEl = document.createElement("img");
      spriteEl.className = "unit__sprite gnome__sprite";
      spriteEl.src = GNOME_ASSETS.idle;
      spriteEl.draggable = false;
      spriteEl.alt = "";
      spriteEl.style.width = `${GNOME_SIZES.ground}px`;

      flipEl.appendChild(spriteEl);
      // Sombra proyectada (js/shadows.js) — se sincroniza sola con los
      // cambios de src/ancho que hace este mismo archivo más abajo (idle
      // <-> grita, ground <-> flying).
      if (typeof Shadows !== "undefined") Shadows.attach(spriteEl);
      el.appendChild(flipEl);
      Units.container.appendChild(el);

      // Mantener pulsado sobre el propio gnomo (cuando anda suelto, sin mira
      // de "coger" tapándolo) -> muestra su contador de puntos justo encima
      // MIENTRAS se mantiene pulsado, igual que el botón de info de
      // js/unitinfo.js (pointerdown abre / pointerup-en-cualquier-sitio
      // cierra, no es un toggle) — pedido explícito: "los puntos de cada
      // gnomo se muestran solo al mantenerlos pulsados sobre ellos".
      // stopPropagation para no disparar también el deseleccionar-al-hacer-
      // clic-fuera de units.js (mismo patrón que Units.spawnUnit con las
      // unidades normales).
      el.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.showBadge();
      });
      // Evita que un long-press dispare además el menú contextual táctil
      // (mismo motivo que unit-info-btn en unitinfo.js).
      el.addEventListener("contextmenu", (e) => e.preventDefault());

      this.el = el;
      this.flipEl = flipEl;
      this.spriteEl = spriteEl;
      this.row = row;
      this.col = col;
      this.facing = "right";

      Units._placeInstant(this);
      this._startIdleFlipLoop();
    },

    // Detiene los temporizadores propios de este gnomo — lo llama el
    // GESTOR (Gnome.resetAll) al empezar una partida nueva, ANTES de
    // descartar la lista vieja de gnomos: sin esto, el bucle de
    // _startIdleFlipLoop de cada gnomo de la partida anterior seguiría
    // reprogramándose a sí mismo para siempre en segundo plano (un
    // temporizador zombi más por cada partida nueva que se empieza), aunque
    // su elemento del DOM ya no exista.
    reset() {
      if (this._flipTimer) clearTimeout(this._flipTimer);
      this._flipTimer = null;
    },

    // Pedido explícito (js/villages.js, mecánica de poblados neutrales):
    // "cuando se pega con un gnomo a un poblado el gnomo muere y desaparece
    // del juego" — a diferencia de dropFromDyingUnit (que SUELTA el gnomo
    // pero lo deja huyendo, sigue existiendo) esto lo borra del todo: para
    // el gestor (Gnome.destroyInstance más abajo), que además lo saca de
    // Gnome.list. Reutiliza reset() para los temporizadores propios (mismo
    // motivo que ahí: no dejar un temporizador zombi reprogramándose para
    // siempre) y quita TODO su rastro del DOM, tanto si iba suelto (this.el)
    // como si lo llevaba cogido alguien (this.attachEl) o tenía el contador
    // de puntos abierto (this._badgeEl).
    destroy() {
      this.reset();
      if (this.attachEl) {
        this.attachEl.remove();
        this.attachEl = null;
        this.attachSpriteEl = null;
      }
      if (this._badgeEl) {
        this._badgeEl.remove();
        this._badgeEl = null;
        this._badgeValueEl = null;
      }
      if (this.el) {
        this.el.remove();
        this.el = null;
      }
      this.heldBy = null;
    },

    isAt(row, col) {
      return !!this.el && !this.heldBy && this.row === row && this.col === col;
    },

    _startIdleFlipLoop() {
      const tick = () => {
        // Mismo factor que _applyNervousness (respiración/temblor) aplicado
        // ahora también al RITMO de girarse en la loseta — pedido explícito:
        // "lo que tienen que hacer es que sus animaciones de respirar y de
        // girarse en la loseta sean más rápidas" (cuantos más puntos lleve
        // encima, antes vuelve a cambiar de sentido, no solo respira más
        // deprisa). Se recalcula en cada vuelta del bucle, no una vez al
        // crear el gnomo, para que ya vaya más rápido el turno siguiente
        // aunque los puntos hayan subido a media espera.
        const factor = this._nervousnessFactor();
        const delay = (1500 + Math.random() * 2500) * factor;
        this._flipTimer = setTimeout(() => {
          if (this.el && !this.heldBy && !this.busy) {
            this.facing = this.facing === "left" ? "right" : "left";
            Units._applyFacing(this);
            this._maybeIdleHop();
          }
          tick();
        }, delay);
      };
      tick();
    },

    // Salta un instante EN SU PROPIA LOSETA (sin cambiar de fila/columna)
    // cuando lleva muchos puntos encima — pedido explícito: "...pueden...
    // dar pequeños saltitos por la superficie de su propia loseta". Solo
    // mientras anda SUELTO (no cogido — mientras lo llevan ya tiembla con
    // gnome-nervous-tremble, ver style.css, y "la superficie de su propia
    // loseta" no aplica). Reutiliza el mismo salto que un paso de
    // movimiento normal (unit__sprite--hop, ver units.js/style.css) en vez
    // de una animación nueva — ya se lee como "salto corto", basta con
    // dispararlo sin mover row/col.
    //
    // BUG encontrado y corregido: esta función AÑADÍA la clase
    // "unit__sprite--hop" pero nunca la quitaba — a diferencia de un paso de
    // movimiento normal (Units.hopTo la limpia en el siguiente paso, y
    // Units.walkPath al terminar del todo), aquí no había ningún sitio que
    // lo hiciera. Esa clase, en CSS (.unit__sprite--hop, ver style.css), fija
    // "animation" por completo — sustituyendo a la respiración continua, no
    // sumándose a ella — así que un gnomo con muchos puntos (más probabilidad
    // de saltar en cada ciclo de idle, ver GNOME_HOP_MAX_CHANCE) acababa
    // saltando tan seguido que casi nunca le daba tiempo a "soltar" esa clase
    // antes del siguiente salto: se quedaba con la respiración apagada para
    // siempre, pareciendo "sin animar" — justo el bug que reportó Jesús. Se
    // arregla quitándola a mano en cuanto termina su propia animación
    // (220ms, igual que @keyframes unit-hop en style.css) para que la
    // respiración vuelva a mandar entre salto y salto.
    //
    // Pedido explícito: "mientras están en iddle los gnomos no deben hacer
    // sonidos" — antes sonaba SFX.hop() aquí igual que en un paso de
    // movimiento de verdad; se quita del todo, este salto es solo visual.
    _maybeIdleHop() {
      if (this.points < GNOME_HOP_MIN_POINTS) return;
      const chance = Math.min(GNOME_HOP_MAX_CHANCE, (this.points - GNOME_HOP_MIN_POINTS) * 0.05);
      if (Math.random() > chance) return;
      this.spriteEl.classList.remove("unit__sprite--hop");
      void this.spriteEl.offsetWidth;
      this.spriteEl.classList.add("unit__sprite--hop");
      setTimeout(() => {
        // Por si en esos 220ms ha empezado a llevarlo cogido alguien (el
        // sprite suelto ya ni se ve) o el gnomo ha sido destruido/reiniciado
        // (nueva partida) — no tocar nada que ya no exista.
        if (this.spriteEl) this.spriteEl.classList.remove("unit__sprite--hop");
      }, 220);
    },

    // ---------- Coger al gnomo ----------

    // Misma idea que Combat.findApproachTile: si `unit` ya está a distancia
    // 1 de este gnomo no hace falta moverse; si no, busca la loseta libre
    // más cercana a `unit` (dentro de su movimiento) desde la que sí lo
    // esté — sin pisar ninguna unidad NI ningún otro gnomo suelto.
    findApproachTile(unit) {
      if (!this.el || this.heldBy) return null;
      const moveRange = UNIT_TYPES[unit.typeId].movimiento;
      const distToGnome = (row, col) => Math.max(Math.abs(row - this.row), Math.abs(col - this.col));

      if (distToGnome(unit.row, unit.col) <= 1) {
        return { row: unit.row, col: unit.col };
      }

      let best = null;
      let bestDist = Infinity;
      for (let row = 0; row < Units.boardSize; row++) {
        for (let col = 0; col < Units.boardSize; col++) {
          if (row === unit.row && col === unit.col) continue;
          if (row === this.row && col === this.col) continue; // no se puede pisar su propia loseta
          if (distToGnome(row, col) > 1) continue;
          if (Units.unitAt(row, col)) continue;
          if (Gnome._otherGnomeAt(this, row, col)) continue;
          if (typeof Villages !== "undefined" && Villages.at(row, col)) continue; // poblado (js/villages.js)
          if (typeof Shops !== "undefined" && Shops.at(row, col)) continue; // Tienda Goblin (js/shops.js)
          if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) continue;
          const moveDist = Math.max(Math.abs(row - unit.row), Math.abs(col - unit.col));
          if (moveDist > moveRange) continue;
          // Pedido explícito: "bajo ningun concepto un personaje puede
          // moverse a traves de una casilla de agua" — ver Units.pathIsWalkable.
          if (!Units.pathIsWalkable(unit.row, unit.col, row, col)) continue;
          if (moveDist < bestDist) {
            bestDist = moveDist;
            best = { row, col };
          }
        }
      }
      return best;
    },

    _showCatchMarkerFor(unit) {
      // Niebla de guerra (js/fog.js) — pedido explícito: "puede que haya un
      // enemigo o gnomos, pero hasta que no se despeje no se sabrá". Un
      // gnomo suelto sobre una loseta todavía sin revelar no se puede coger
      // aunque esté a distancia — ya queda oculto visualmente por la propia
      // niebla; esto evita además "cogerlo a ciegas" haciendo clic donde en
      // teoría no se ve nada.
      if (typeof Fog !== "undefined" && Fog.isFogged(this.row, this.col)) return;
      const approach = this.findApproachTile(unit);
      if (!approach) return;
      Units.addMarker({
        className: "catch-marker",
        row: this.row,
        col: this.col,
        // Por ENCIMA del propio sprite del gnomo (z-index (row+col)*10+5, ver
        // Units._placeInstant) a propósito, a diferencia de la mira de
        // ataque sobre el rival: aquí no hay ningún requisito de que se vea
        // "por detrás", así que se prioriza que sea siempre clicable sin más
        // vueltas.
        zOffset: 6,
        visibleClass: "catch-marker--visible",
        owner: "gnome",
        buildContent: (marker) => {
          const icon = document.createElement("i");
          icon.className = "ph ph-hand-grabbing catch-marker__icon";
          marker.appendChild(icon);
        },
        onClick: () => this.catchBy(unit),
      });
    },

    async catchBy(unit) {
      if (this.heldBy || this.busy) return;
      // Turnos (js/turns.js) — coger un gnomo suelto cuenta como UNA acción
      // del turno (se agrupa con "moverse": no hay una acción "coger"
      // separada en la lista pedida explícitamente, y acercarse + agarrar es
      // un único gesto, igual que acercarse + golpear en Combat.attack).
      if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
      Units.clearRangeOverlays();
      const approach = this.findApproachTile(unit);
      if (!approach) return; // se alejó / lo cogieron justo antes del clic
      this.hideBadge();
      if (approach.row !== unit.row || approach.col !== unit.col) {
        const path = Units.stepPath(unit.row, unit.col, approach.row, approach.col);
        await Units.walkPath(unit, path);
        // Pedido explícito: "si cojo a un gnomo, el personaje avanza lo
        // coge y para, pero al parar no se revelan las casillas de niebla
        // que deberian" — Units.walkPath solo reevalúa visibilidad sobre lo
        // YA revelado (Fog.applyVisibility), no revela loseta nueva. El
        // desplazamiento normal (js/movement.js) sí llama a esto tras
        // moverse; acercarse a coger un gnomo usa walkPath directamente y
        // se había quedado sin este paso.
        if (typeof Fog !== "undefined" && unit.team === "player") Fog.revealForUnit(unit);
      }
      Units.faceTowardsTile(unit, this.row, this.col);
      this.attachTo(unit);
      SFX.catch();
      if (typeof Turns !== "undefined") Turns.useAction(unit);
      Units.refreshRange(unit);
    },

    attachTo(unit) {
      this.heldBy = unit.id;
      this.el.style.display = "none";
      this.spriteEl.src = GNOME_ASSETS.grita;

      if (!this.attachEl) {
        const attachEl = document.createElement("div");
        attachEl.className = "gnome-attach";
        const img = document.createElement("img");
        img.className = "gnome-attach__sprite";
        img.draggable = false;
        img.alt = "";
        attachEl.appendChild(img);
        // Igual que mantener pulsado el gnomo suelto (ver spawn()): mientras
        // lo llevan cogido, mantener pulsado el propio gnomo amarrado
        // también muestra su contador de puntos MIENTRAS se mantiene
        // pulsado — normalmente es cuando MÁS interesa consultarlo, con los
        // puntos ya subiendo a base de golpearlo. stopPropagation para no
        // reseleccionar por debajo a quien lo lleva.
        attachEl.addEventListener("pointerdown", (e) => {
          e.stopPropagation();
          e.preventDefault();
          this.showBadge();
        });
        attachEl.addEventListener("contextmenu", (e) => e.preventDefault());
        this.attachEl = attachEl;
        this.attachSpriteEl = img;
      }
      this.attachSpriteEl.src = GNOME_ASSETS.grita;

      // Posición inicial: siempre la pose "iddle" (ver setAttachPose más
      // abajo) — la pose "machaca" solo se aplica momentáneamente durante la
      // animación épica de un golpe mortal (Villages._playEpicSmash).
      this.setAttachPose(unit, "idle");
      // Por si ya llevaba puntos acumulados antes de cogerlo (p.ej. tras un
      // pase exitoso, ver executePass): el temblor del sprite recién
      // enganchado debe arrancar ya a la velocidad "nerviosa" que le toca,
      // no a la base (ver GNOME_IDLE_BASE_S/_applyNervousness arriba).
      this._applyNervousness();

      unit.flipEl.appendChild(this.attachEl);
      this.attachEl.classList.remove("gnome-attach--visible");
      // Comprobación defensiva: si este gnomo se destruye del todo
      // (Gnome.destroyInstance, ver villages.js) en el intervalo entre este
      // requestAnimationFrame y el siguiente frame real, this.attachEl ya
      // sería null (GnomeInstance.destroy lo limpia) y el callback rompería
      // con un TypeError al intentar leer su classList.
      const attachEl = this.attachEl;
      requestAnimationFrame(() => {
        if (attachEl.isConnected) attachEl.classList.add("gnome-attach--visible");
      });

      if (typeof GnomeCalib !== "undefined") GnomeCalib.onAttach(unit, this);
    },

    // Reposiciona el gnomo YA enganchado (this.attachEl) según la pose de
    // quien lo lleva — "idle" (reposo normal, la de siempre) o "machaca"
    // (brazo en alto/golpeando, ver Villages._playEpicSmash) — sin tener
    // que desenganchar/re-enganchar nada. En modo de calibración
    // (?calibrarGnomo, js/gnomecalib.js) se usa el ajuste guardado a mano
    // para ESTA pose y este personaje en vez del valor fijo del código,
    // igual que ya hacía attachTo antes de este refactor.
    setAttachPose(unit, pose) {
      if (!this.attachEl) return;
      const table = pose === "machaca" ? GNOME_ATTACH_OFFSETS_MACHACA : GNOME_ATTACH_OFFSETS;
      let offset = table[unit.typeId] || table.default;
      let heldWidth = GNOME_SIZES.held;
      if (typeof GnomeCalib !== "undefined" && GnomeCalib.active) {
        offset = GnomeCalib.getOffset(unit.typeId, pose) || offset;
        heldWidth = GnomeCalib.getHeldWidth();
      }
      this.attachEl.style.right = `${offset.right}px`;
      this.attachEl.style.bottom = `${offset.bottom}%`;
      this.attachEl.style.width = `${heldWidth}px`;
    },

    detachFrom() {
      this.heldBy = null;
      if (this.attachEl) {
        this.attachEl.classList.remove("gnome-attach--visible");
        this.attachEl.remove();
      }
      if (typeof GnomeCalib !== "undefined") GnomeCalib.onDetach();
    },

    // ---------- Golpear ----------

    hit(unit) {
      if (this.heldBy !== unit.id || this.busy) return;
      // Turnos (js/turns.js) — pedido explícito: "pegar al gnomo una vez"
      // es una de las 2 acciones del turno.
      if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
      if (typeof Turns !== "undefined") Turns.useAction(unit);
      const dmg = UNIT_TYPES[unit.typeId].fuerza;
      this._addPoints(dmg);
      SFX.hit();
      // Retroalimentación de animación en AMBOS lados del golpe, no solo en
      // el gnomo (regla de oro del proyecto: todo necesita sonido y/o
      // animación coherente con la acción) — quien golpea da un puñetazo
      // corto (unit--punching, mismo patrón de swap de clase que
      // unit--moving/unit__sprite--hop: sustituye a la respiración continua
      // mientras dura, nunca se mezcla con ella) sincronizado con el temblor
      // ya existente del gnomo (gnome-attach--hit).
      if (unit.el) {
        unit.el.classList.remove("unit--punching");
        void unit.spriteEl.offsetWidth;
        unit.el.classList.add("unit--punching");
        setTimeout(() => unit.el.classList.remove("unit--punching"), 320);
      }
      if (this.attachEl) {
        this.attachEl.classList.remove("gnome-attach--hit");
        void this.attachEl.offsetWidth;
        this.attachEl.classList.add("gnome-attach--hit");
      }
      Units.spawnFloatingText(unit, `+${dmg}`, { className: "dmg-popup gnome-points-popup" });
    },

    // ---------- Pasar ----------

    _startPassAim(unit) {
      Units.clearRangeOverlays();
      this.passing = true;
      Gnome._passBtn.classList.add("gnome-action-btn--aiming");

      Units.list
        .filter((u) => u.team === "player" && u.id !== unit.id)
        .forEach((ally, i) => {
          Units.addMarker({
            className: "pass-marker",
            row: ally.row,
            col: ally.col,
            zOffset: 12,
            delayIndex: i,
            visibleClass: "pass-marker--visible",
            owner: "gnome",
            buildContent: (marker) => {
              const icon = document.createElement("i");
              icon.className = "ph ph-paper-plane-tilt pass-marker__icon";
              marker.appendChild(icon);
            },
            onClick: () => this.executePass(unit, ally),
          });
        });

      // Además de a un aliado, también se puede lanzar a una loseta VACÍA
      // dentro del propio alcance de movimiento de quien lo lleva (pedido
      // explícito) — se reutiliza el mismo círculo de rango normal
      // (.range-marker) en vez de un icono nuevo por casilla ("no seas tan
      // cafre de ponerme el icono de pasar en todos los recuadros de mi
      // movimiento"), solo teñido con el color del icono de pasar
      // (--pass-target en style.css usa color-mix con var(--accent-hover),
      // la misma variable que .pass-marker__icon, así que si ese color
      // cambia algún día los círculos lo siguen automáticamente).
      if (typeof Movement !== "undefined") {
        Movement.reachableTiles(unit).forEach((tile, i) => {
          Units.addMarker({
            className: "range-marker range-marker--pass-target",
            row: tile.row,
            col: tile.col,
            delayIndex: i,
            visibleClass: "range-marker--visible",
            owner: "gnome",
            onClick: () => this.executeThrowToTile(unit, tile.row, tile.col),
          });
        });
      }
    },

    _cancelPassAim() {
      this.passing = false;
      if (Gnome._passBtn) Gnome._passBtn.classList.remove("gnome-action-btn--aiming");
      Units.markerEls = Units.markerEls.filter((m) => {
        const isPass = m.classList.contains("pass-marker") || m.classList.contains("range-marker--pass-target");
        if (isPass) m.remove();
        return !isPass;
      });
    },

    // Probabilidad de éxito del pase.
    //   - A 1 casilla (adyacente) es prácticamente un "dar la mano" más que
    //     un lanzamiento real — pedido explícito: NUNCA debe fallar, así que
    //     es el único caso con 100% fijo, sea cual sea la agilidad.
    //   - Más allá de 1 casilla, pero DENTRO del propio alcance de
    //     movimiento de quien pasa, el pase sigue siendo fiable para
    //     cualquiera — incluso un personaje de agilidad baja domina un pase
    //     corto.
    //   - MÁS ALLÁ de ese alcance ("overreach" = casillas de distancia por
    //     encima del propio movimiento) es donde la agilidad de verdad tiene
    //     que notarse: un personaje de agilidad baja (p. ej. GolemCorteza,
    //     agilidad 1) NO puede pasar el gnomo con normalidad a 3+ casillas
    //     de más — pedido explícito, "eso no puede ser" — así que ahí la
    //     fórmula ya no parte de una base alta común, sino de una base baja
    //     que la propia agilidad tiene que levantar: con poca agilidad casi
    //     nunca sale, con mucha sigue siendo un tiro arriesgado pero jugable.
    // Acotado entre 5% y 98% fuera del caso adyacente, para que ahí nunca
    // sea ni un fallo ni un éxito garantizados.
    computePassSuccess(agilidad, distance, movimiento) {
      if (distance <= 1) return 1;
      const overreach = Math.max(0, distance - movimiento);
      if (overreach === 0) return Math.min(98, 90 + agilidad * 3) / 100;
      const pct = 15 + agilidad * 15 - overreach * 11;
      return Math.min(98, Math.max(5, pct)) / 100;
    },

    // Puntos que gana un pase EXITOSO — pedido explícito: "tiene que tener
    // en cuenta la distancia, para casillas más lejanas a la adyacente
    // deben dar puntos extra conforme más lejos se ejecute un pase con
    // éxito". Un pase adyacente (distancia 1, garantizado según
    // computePassSuccess) vale el mínimo posible — es casi "dar la mano",
    // no un lanzamiento de verdad. Más allá de ahí, la base sube con la
    // propia distancia, y encima el "overreach" (casillas por encima del
    // propio alcance de movimiento de quien pasa — la parte realmente
    // arriesgada, la que puede fallar según computePassSuccess) se premia
    // con un extra por casilla en vez de contar como una más: así un pase
    // largo y arriesgado da más que uno igual de largo pero fácil porque
    // cabía dentro del propio movimiento.
    computePassPoints(distance, movimiento) {
      if (distance <= 1) return 1;
      const overreach = Math.max(0, distance - movimiento);
      return distance + overreach * 2;
    },

    async executePass(holder, target) {
      if (this.heldBy !== holder.id || this.busy) return;
      // Turnos (js/turns.js) — pedido explícito: "pasar el gnomo una vez"
      // es una de las 2 acciones del turno (de QUIEN LANZA — recibirlo no
      // gasta ninguna acción de quien lo recibe, por eso Turns.useAction se
      // llama con `holder`, nunca con `target`).
      if (typeof Turns !== "undefined" && !Turns.canAct(holder)) return;
      if (typeof Turns !== "undefined") Turns.useAction(holder);
      Units.clearRangeOverlays();
      this.passing = false;
      this.busy = true;
      this.hideBadge();

      const distance = Math.max(Math.abs(target.row - holder.row), Math.abs(target.col - holder.col));
      const holderType = UNIT_TYPES[holder.typeId];
      const success = Math.random() < this.computePassSuccess(holderType.agilidad, distance, holderType.movimiento);

      // Encararse hacia quien recibe el pase ANTES de soltarlo — tanto quien
      // lanza como el propio gnomo — para que el lanzamiento se lea como
      // dirigido a propósito, no como si saliera disparado a ciegas.
      // Units.faceTowardsTile funciona también con el gnomo porque tiene la
      // misma forma que una unidad normal (ver cabecera del archivo), así
      // que se reutiliza en vez de duplicar la lógica de girar.
      Units.faceTowardsTile(holder, target.row, target.col);
      this.row = holder.row;
      this.col = holder.col;
      Units.faceTowardsTile(this, target.row, target.col);

      // Animación de lanzamiento sobre quien pasa (armado + soltar), en
      // paralelo al vuelo del propio gnomo — retroalimentación en los dos
      // lados de la acción, no solo en quien vuela (misma idea que el
      // puñetazo de hit()). Mismo patrón de swap de clase que
      // unit--moving/unit__sprite--hop: sustituye a la respiración continua
      // mientras dura, nunca se mezcla con ella.
      if (holder.el) {
        holder.el.classList.remove("unit--throwing");
        void holder.spriteEl.offsetWidth;
        holder.el.classList.add("unit--throwing");
        setTimeout(() => holder.el.classList.remove("unit--throwing"), 380);
      }

      this.detachFrom();
      this.spriteEl.src = GNOME_ASSETS.grita;

      const end = success ? { row: target.row, col: target.col } : this.findDropTile(holder);
      await this.animateThrowTo(holder.row, holder.col, end.row, end.col);

      if (success) {
        this.row = target.row;
        this.col = target.col;
        this.attachTo(target);
        const gained = this.computePassPoints(distance, holderType.movimiento);
        this._addPoints(gained);
        // Mismo feedback que un golpe (regla de oro: toda acción necesita
        // sonido Y texto/animación) — antes un pase con éxito no mostraba
        // nada más que el sonido, así que los puntos ganados pasaban
        // desapercibidos sin abrir el contador a mano.
        Units.spawnFloatingText(target, `+${gained}`, { className: "dmg-popup gnome-points-popup" });
        SFX.passSuccess();
      } else {
        await this.landAt(end);
      }

      this.busy = false;
      // Vuelve a pintar el radio de quien lanzaba (ya no lleva al gnomo, así
      // que recupera la posibilidad de atacar) Y el de quien esté
      // seleccionada ahora mismo si es otra unidad — ver el porqué en
      // _refreshSelectedUnitRange: la mira de "coger" puede haberse quedado
      // apuntando a la loseta vieja si el gnomo acaba de aparecer en otra.
      Units.refreshRange(holder);
      this._refreshSelectedUnitRange();
    },

    // Lanzar el gnomo a una loseta VACÍA dentro del propio alcance de
    // movimiento de quien lo lleva (pedido explícito: "que la habilidad
    // lanzar al gnomo tambien te permita lanzarlo a una zona dentro de tu
    // rango de movimiento") — mismo formulario de éxito/puntos que un pase a
    // un aliado (computePassSuccess/computePassPoints), pero contra la
    // LOSETA en vez de contra una unidad. Como el destino siempre sale de
    // Movement.reachableTiles(holder) (ver _startPassAim), la distancia
    // nunca supera el propio movimiento de quien lanza — overreach siempre
    // 0 — así que este lanzamiento es casi siempre un éxito, coherente con
    // "está dentro de tu alcance, deberías poder hacerlo bien".
    async executeThrowToTile(holder, destRow, destCol) {
      if (this.heldBy !== holder.id || this.busy) return;
      // Turnos (js/turns.js) — igual que executePass, esto gasta una acción
      // de QUIEN LANZA.
      if (typeof Turns !== "undefined" && !Turns.canAct(holder)) return;
      if (typeof Turns !== "undefined") Turns.useAction(holder);
      Units.clearRangeOverlays();
      this.passing = false;
      this.busy = true;
      this.hideBadge();

      const distance = Math.max(Math.abs(destRow - holder.row), Math.abs(destCol - holder.col));
      const holderType = UNIT_TYPES[holder.typeId];
      const success = Math.random() < this.computePassSuccess(holderType.agilidad, distance, holderType.movimiento);

      Units.faceTowardsTile(holder, destRow, destCol);
      this.row = holder.row;
      this.col = holder.col;
      Units.faceTowardsTile(this, destRow, destCol);

      if (holder.el) {
        holder.el.classList.remove("unit--throwing");
        void holder.spriteEl.offsetWidth;
        holder.el.classList.add("unit--throwing");
        setTimeout(() => holder.el.classList.remove("unit--throwing"), 380);
      }

      this.detachFrom();
      this.spriteEl.src = GNOME_ASSETS.grita;

      const end = success ? { row: destRow, col: destCol } : this.findDropTile(holder);
      await this.animateThrowTo(holder.row, holder.col, end.row, end.col);

      if (success) {
        const gained = this.computePassPoints(distance, holderType.movimiento);
        this._addPoints(gained);
        await this.landAt(end, { sound: () => SFX.gnomeLandSoft() });
        Units.spawnFloatingText(this, `+${gained}`, { className: "dmg-popup gnome-points-popup" });
      } else {
        await this.landAt(end);
      }

      // Pedido explícito: al caer sobre una CASILLA (no sobre un aliado),
      // el gnomo se aleja 3 casillas de los jugadores — mismo patrón que
      // dropFromDyingUnit: el jugador vivo más cercano como referencia.
      const nearestPlayer = Units.list
        .filter((u) => u.team === "player")
        .reduce((best, u) => {
          const d = Math.max(Math.abs(u.row - this.row), Math.abs(u.col - this.col));
          return !best || d < best.d ? { u, d } : best;
        }, null);
      if (nearestPlayer) {
        await this._fleeAwayFrom(nearestPlayer.u.row, nearestPlayer.u.col, 3);
      }

      this.busy = false;
      Units.refreshRange(holder);
      this._refreshSelectedUnitRange();
    },

    // Loseta a la que cae este gnomo si el pase falla: se aleja de TODOS los
    // personajes (no solo de quien lanzaba) Y de cualquier otro gnomo suelto
    // (para no caer encima de otro y solaparse), buscando quedar lo más
    // cerca posible de 5 casillas de distancia de cada uno sin salirse del
    // tablero ni caer sobre una unidad u otro gnomo.
    findDropTile(fromUnit) {
      let best = null;
      let bestScore = -Infinity;
      for (let row = 0; row < Units.boardSize; row++) {
        for (let col = 0; col < Units.boardSize; col++) {
          if (Units.unitAt(row, col)) continue;
          if (Gnome._otherGnomeAt(this, row, col)) continue;
          if (typeof Villages !== "undefined" && Villages.at(row, col)) continue; // poblado (js/villages.js)
          if (typeof Shops !== "undefined" && Shops.at(row, col)) continue; // Tienda Goblin (js/shops.js)
          if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) continue;
          const minDist = Units.list.reduce(
            (min, u) => Math.min(min, Math.max(Math.abs(u.row - row), Math.abs(u.col - col))),
            Infinity
          );
          const distFromThrower = Math.max(Math.abs(fromUnit.row - row), Math.abs(fromUnit.col - col));
          const score = Math.min(minDist, 5) * 100 - Math.abs(distFromThrower - 5);
          if (score > bestScore) {
            bestScore = score;
            best = { row, col };
          }
        }
      }
      return best || { row: fromUnit.row, col: fromUnit.col };
    },

    // Aterrizaje tras un pase fallido: el golpe contra el suelo es lo primero
    // que se ve — SIGUE con el sprite de "lanzado" (grita) mientras se
    // aplasta y rebota, como si el propio impacto fuera lo que lo asusta — y
    // solo cuando el rebote termina de asentarse (ya con su forma normal)
    // vuelve al sprite de reposo. gnome--landing sustituye temporalmente a la
    // respiración continua (misma idea que unit--moving en units.js: dos
    // animaciones no pueden compartir la propiedad "transform" a la vez, así
    // que una sustituye a la otra mientras dura en vez de sumarse).
    async landAt(tile, { sound } = {}) {
      this.row = tile.row;
      this.col = tile.col;
      this.el.classList.remove("gnome--flying");
      this.el.style.display = "";
      Units._placeInstant(this);
      if (sound) sound();
      else SFX.dropFail();

      this.el.classList.remove("gnome--landing");
      void this.spriteEl.offsetWidth; // fuerza reflow para poder repetir la animación en aterrizajes seguidos
      this.el.classList.add("gnome--landing");
      await new Promise((resolve) => setTimeout(resolve, GNOME_LAND_IMPACT_MS));
      this.el.classList.remove("gnome--landing");

      this.spriteEl.src = GNOME_ASSETS.idle;
      this.spriteEl.style.width = `${GNOME_SIZES.ground}px`;
    },

    // Arco de lanzamiento: la posición la controla JS fotograma a fotograma
    // (no encaja en el desplazamiento paso a paso por loseta de
    // Units.hopTo/walkPath, pensado para saltos sobre el propio tablero, no
    // para un vuelo libre en línea recta) — ver .gnome--flying en style.css
    // para por qué hace falta desactivar la transition normal mientras dura.
    animateThrowTo(fromRow, fromCol, toRow, toCol) {
      return new Promise((resolve) => {
        const start = getTileCenter(fromRow, fromCol, Units.boardSize);
        const end = getTileCenter(toRow, toCol, Units.boardSize);
        const dist = Math.max(Math.abs(toRow - fromRow), Math.abs(toCol - fromCol), 1);
        const duration = Math.min(900, 260 + dist * 90);
        const peakHeight = 40 + dist * 14;

        this.el.classList.add("gnome--flying");
        this.el.style.display = "";
        this.el.style.zIndex = "900";
        this.spriteEl.style.width = `${GNOME_SIZES.flying}px`;

        // Grito mientras vuela por el aire (pedido explícito: "un sonido...
        // como iiiiiiiiu o que den un gritito") — dura lo mismo que el propio
        // vuelo (duration, ya calculado arriba) para que se apague justo al
        // aterrizar, tanto si el pase sale bien como si no (esto se dispara
        // ANTES de saber el resultado: el propio Gnome.executePass ya decide
        // el sonido de éxito/fallo aparte, al aterrizar).
        SFX.gnomeFly(duration / 1000);

        const t0 = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - t0) / duration);
          const x = start.x + (end.x - start.x) * t;
          const yLinear = start.y + (end.y - start.y) * t;
          const arc = -Math.sin(t * Math.PI) * peakHeight;
          this.el.style.left = `${x}px`;
          this.el.style.top = `${yLinear + arc}px`;
          if (t < 1) {
            requestAnimationFrame(step);
          } else {
            this.el.classList.remove("gnome--flying");
            // Niebla de guerra (js/fog.js) — un pase fallido (landAt) puede
            // dejar caer al gnomo sobre una loseta sin revelar; el vuelo en
            // sí (animateThrowTo) no pasa por Units.walkPath (tiene su
            // propio bucle de fotogramas, ver comentario de arriba), así que
            // no se reevalúa solo — se hace aquí, al aterrizar.
            if (typeof Fog !== "undefined") Fog.applyVisibility();
            resolve();
          }
        };
        requestAnimationFrame(step);
      });
    },

    // ---------- Huir cuando se mueve un jugador ----------

    // Lo llama el GESTOR (Gnome.reactToPlayerMove) tras cada desplazamiento
    // de una unidad del jugador (ver esa línea en movement.js) — este gnomo
    // se aleja 2 casillas de quien se acaba de mover, salvo que esté cogido
    // o ya esté ocupado en otra animación propia.
    //
    // Async a propósito: el orden pedido es personaje se mueve → LUEGO se
    // mueven TODOS los gnomos sueltos → LUEGO se actualizan las casillas de
    // movimiento, así que el gestor necesita poder esperar (con
    // Promise.all) a que la huida de cada gnomo termine del todo antes de
    // refrescar el radio.
    async reactToPlayerMove(mover) {
      if (!this.el || this.heldBy || this.busy) return;
      await this._fleeAwayFrom(mover.row, mover.col, 2);
    },

    // Núcleo compartido de "huir N casillas alejándose de un punto" — lo
    // usaba solo reactToPlayerMove (2 casillas, alejándose de quien se
    // acaba de mover); se extrae aquí tal cual para que dropFromDyingUnit
    // pueda reutilizar EXACTAMENTE la misma lógica de evitar rincones
    // (_bestFleeStep/_tileOpenness) con otro punto de referencia y otro
    // número de casillas, en vez de duplicarla.
    async _fleeAwayFrom(fromRow, fromCol, steps) {
      let dRow = Math.sign(this.row - fromRow);
      let dCol = Math.sign(this.col - fromCol);
      if (dRow === 0 && dCol === 0) {
        dRow = Math.random() < 0.5 ? 1 : -1;
        dCol = Math.random() < 0.5 ? 1 : -1;
      }

      const path = [];
      let r = this.row;
      let c = this.col;
      for (let i = 0; i < steps; i++) {
        const step = this._bestFleeStep(r, c, dRow, dCol);
        if (!step) break;
        path.push(step);
        r = step.row;
        c = step.col;
      }
      if (path.length === 0) return;

      this.busy = true;
      await Units.walkPath(this, path);
      this.busy = false;
      // Este gnomo acaba de cambiar de loseta: si hay una unidad
      // seleccionada ahora mismo (sea o no la que se acaba de mover), su
      // mira de "coger" puede haberse quedado apuntando a la loseta vieja
      // — ver _refreshSelectedUnitRange.
      this._refreshSelectedUnitRange();
    },

    // Pedido explícito: "si un personaje con el gnomo cogido muere, este cae
    // a la loseta actual y huye en una dirección alejándose de los jugadores
    // 3 casillas" — Y, sobre el ORDEN: "primero, el enemigo muere, luego el
    // gnomo aparece... y luego el gnomo huye". Lo llama el GESTOR
    // (Gnome.dropHeldBy) DESPUÉS de que Units.removeUnit ya haya terminado
    // su animación de muerte y haya quitado a `deadUnit` del DOM/de
    // Units.list (ver combat.js) — por eso deadUnit sigue haciendo falta
    // como parámetro (su row/col), en vez de leerlo de Units.list, que para
    // cuando esto corre ya no lo contiene.
    async dropFromDyingUnit(deadUnit) {
      this.detachFrom();
      this.row = deadUnit.row;
      this.col = deadUnit.col;
      this.el.style.display = "";
      Units._placeInstant(this);
      this.spriteEl.src = GNOME_ASSETS.idle;
      this.spriteEl.style.width = `${GNOME_SIZES.ground}px`;
      SFX.dropFail();

      // Pedido explícito (bug reportado): "el jugador muere, el gnomo
      // aparece en la casilla donde estaba el jugador, el gnomo corre los
      // pasos pertinentes a la huida — ahora el gnomo directamente
      // aparecia en una casilla a la que se alejaba, pero no se le veia
      // andar hacia ella ni aparecer inicialmente en la casilla donde
      // murio el jugador o enemigo". Entre desocultar el gnomo aquí arriba
      // (estaba con display:none mientras iba cogido, ver attachTo) y el
      // primer paso de la huida (_fleeAwayFrom más abajo, cuyo primer
      // hopTo también reposiciona el elemento) no había NINGÚN punto en el
      // que el navegador tuviera ocasión de pintar — todo, desde
      // Units._placeInstant de arriba hasta el primer hopTo de la huida,
      // corre en el mismo tick de JS sin ceder el control ni una vez
      // (walkPath/hopTo solo ceden DESPUÉS de fijar la nueva posición, vía
      // setTimeout). El navegador se saltaba directamente al primer
      // fotograma que sí llegaba a pintarse: la posición YA tras el primer
      // paso de la huida, nunca la de "recién aparecido en la casilla
      // donde murió". Dos requestAnimationFrame anidados (el primero solo
      // garantiza "antes del próximo repintado", el segundo ya se dispara
      // DESPUÉS de que ese repintado haya ocurrido de verdad) fuerzan a
      // que el navegador pinte primero al gnomo quieto ahí, y la pausa
      // corta que sigue le da tiempo al jugador a leer la escena antes de
      // que arranque a correr.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await new Promise((resolve) => setTimeout(resolve, 260));

      // "alejándose de los jugadores" (plural, no solo de quien lo llevaba,
      // que ya no está) — se usa como referencia el personaje del JUGADOR
      // vivo más cercano a donde ha caído; si no queda ninguno (partida ya
      // ganada, o quien murió no era del jugador) se huye desde la propia
      // loseta donde ha caído en una dirección al azar (_fleeAwayFrom ya lo
      // resuelve así cuando from == la posición actual del gnomo).
      const nearestPlayer = Units.list
        .filter((u) => u.team === "player")
        .reduce((best, u) => {
          const d = Math.max(Math.abs(u.row - this.row), Math.abs(u.col - this.col));
          return !best || d < best.d ? { u, d } : best;
        }, null);
      const ref = nearestPlayer ? nearestPlayer.u : { row: this.row, col: this.col };
      await this._fleeAwayFrom(ref.row, ref.col, 3);
    },

    // Elige la mejor loseta vecina para huir. No basta con "la primera
    // dirección libre parecida a la deseada": eso podía llevar al gnomo,
    // paso a paso, hacia una esquina o un rincón cerrado de unidades sin
    // darse cuenta, porque cada paso individual parecía válido aunque lo
    // dejara cada vez con menos salidas. Se puntúan TODAS las 8 losetas
    // vecinas válidas (libres de unidades Y de cualquier otro gnomo suelto)
    // con dos criterios:
    //   - alineación: cuánto se acerca esa dirección a la deseada (alejarse
    //     de quien se movió) — sigue siendo lo que más pesa.
    //   - amplitud (_tileOpenness): cuántas de las 8 casillas alrededor de
    //     ESA loseta quedarían libres — una loseta con poca amplitud es un
    //     callejón o una esquina, aunque ahora mismo esté libre. Sirve de
    //     desempate y evita dead-ends.
    _bestFleeStep(row, col, dRow, dCol) {
      let best = null;
      let bestScore = -Infinity;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const r = row + dr;
          const c = col + dc;
          if (r < 0 || c < 0 || r >= Units.boardSize || c >= Units.boardSize) continue;
          if (Units.unitAt(r, c)) continue;
          if (Gnome._otherGnomeAt(this, r, c)) continue;
          if (typeof Villages !== "undefined" && Villages.at(r, c)) continue; // poblado (js/villages.js)
          if (typeof Shops !== "undefined" && Shops.at(r, c)) continue; // Tienda Goblin (js/shops.js)
          if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(r, c)) continue;
          const alignment = dr * dRow + dc * dCol;
          const openness = this._tileOpenness(r, c);
          const score = alignment * 3 + openness;
          if (score > bestScore) {
            bestScore = score;
            best = { row: r, col: c };
          }
        }
      }
      return best;
    },

    // Cuántas de las 8 casillas alrededor de (row, col) están libres (sin
    // unidades ni otros gnomos) y dentro del tablero — una medida simple de
    // "cuántas salidas tendría este gnomo si estuviera aquí", usada por
    // _bestFleeStep para no elegir una loseta que hoy está libre pero mañana
    // lo deja sin escapatoria.
    _tileOpenness(row, col) {
      let free = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const r = row + dr;
          const c = col + dc;
          if (r < 0 || c < 0 || r >= Units.boardSize || c >= Units.boardSize) continue;
          if (Units.unitAt(r, c)) continue;
          if (Gnome._otherGnomeAt(this, r, c)) continue;
          if (typeof Villages !== "undefined" && Villages.at(r, c)) continue; // poblado (js/villages.js)
          if (typeof Shops !== "undefined" && Shops.at(r, c)) continue; // Tienda Goblin (js/shops.js)
          if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(r, c)) continue;
          free++;
        }
      }
      return free;
    },

    // Vuelve a pintar SOLO lo del gnomo (mira de "coger", o las de "pasar"
    // si se está apuntando un pase) para la unidad del JUGADOR que esté
    // seleccionada ahora mismo (si hay alguna) — se llama cada vez que este
    // gnomo cambia de loseta por cualquier motivo (huida, aterrizaje tras un
    // pase fallido...) para que esa mira, que podía haberse quedado
    // apuntando a la loseta vieja, se refresque. Usa Units.refreshProviderFor
    // en vez de refreshRange a propósito: repintar TODO el radio (movimiento,
    // ataque) solo porque un gnomo se ha movido por su cuenta reiniciaría
    // también esas casillas sin necesidad. El proveedor registrado es
    // SIEMPRE el gestor (Gnome), no esta instancia — es él quien decide qué
    // pintar para la unidad (recorre this.list) — ver Gnome.showFor.
    _refreshSelectedUnitRange() {
      if (!Units.selectedId) return;
      const unit = Units.list.find((u) => u.id === Units.selectedId);
      if (unit && unit.team === "player") Units.refreshProviderFor(unit, Gnome, "gnome");
    },

    // ---------- Puntos acumulados ----------

    _addPoints(n) {
      this._setPoints(this.points + n);
    },

    // Pedido explícito: "los gnomos que están sueltos sin ser cogidos
    // pierden 5 puntos cada vez que alguien pulsa el botón PASAR TURNO...
    // un -5 deberá salir de sus sprites como cuando se les pega... si
    // pierden puntos, se van relajando... pierden la tonalidad roja y no se
    // mueven tan rápido" — lo llama el GESTOR (Gnome.applyTurnPassDecay,
    // desde js/turns.js) en cada cambio de turno, nunca mientras lo llevan
    // cogido (eso lo decide el gestor filtrando por heldBy antes de
    // llamar) ni mientras está en medio de una animación propia (huida,
    // vuelo, aterrizaje...) para no interrumpirla ni tocar puntos/posición a
    // mitad de otra cosa. "Se van relajando" (tonalidad roja + velocidad de
    // idle) no necesita código aparte: _setPoints ya llama a
    // _applyNervousness, que recalcula ambas cosas a partir de this.points
    // cada vez — al bajar los puntos, bajan solas.
    _loseCooldownPoints(amount) {
      if (this.heldBy || this.busy) return;
      if (this.points <= 0) return; // nada que perder — no repetir el popup "-0" sin sentido
      const lost = Math.min(amount, this.points);
      this._setPoints(this.points - lost);
      // Mismo popup que un golpe de verdad (pedido explícito: "como cuando
      // se les pega"), con el signo ya incluido en el propio texto en vez de
      // depender de una clase CSS distinta para el signo.
      Units.spawnFloatingText(this, `-${lost}`, { className: "dmg-popup gnome-points-popup" });
      Units.playShake(this);
      SFX.gnomeCooldown();
    },

    _setPoints(value) {
      this.points = value;
      this._applyNervousness();
      if (!this._badgeValueEl) return;
      this._badgeValueEl.textContent = String(this.points);
      this._badgeValueEl.classList.remove("gnome-points-badge__value--bump");
      void this._badgeValueEl.offsetWidth;
      this._badgeValueEl.classList.add("gnome-points-badge__value--bump");
    },

    // Acorta la animación de "idle" que esté activa ahora mismo (respiración
    // suelto / temblor cogido, ver GNOME_IDLE_BASE_S arriba) en proporción a
    // los puntos acumulados, Y le va aplicando un tinte rojo creciente
    // (pedido explícito: "más exagerados... pueden ir tiñéndose de rojo") —
    // cuantos más puntos, más nervioso y más "al rojo vivo" se ve. Se aplica
    // sobre AMBOS sprites (this.spriteEl y this.attachSpriteEl, si ya
    // existe) en vez de solo el visible ahora mismo, para que el que
    // corresponda ya esté al nivel correcto en cuanto se muestre (p.ej. al
    // recogerlo justo después de que sus puntos hayan cambiado). La
    // duración se reduce de forma proporcional (no resta fija) para que
    // siga habiendo cambio perceptible incluso con pocos puntos, con un
    // suelo (35% de la base) para que muchos puntos nunca lo vuelvan un
    // parpadeo ilegible.
    //
    // El tinte usa sepia()+hue-rotate() en vez de hue-rotate() solo (como el
    // tinte de "rival", ver .unit--enemy en style.css): el gnomo es
    // mayormente blanco/gris, y hue-rotate() no afecta a colores sin
    // saturación (blanco/gris no tienen "tono" que rotar) — sepia() sí
    // introduce color incluso ahí, y el hue-rotate() posterior empuja ese
    // tono cálido hacia el rojo.
    // Factor de velocidad (< 1 = más rápido) compartido por LAS TRES cosas
    // que se aceleran con los puntos acumulados: la respiración/temblor
    // (_applyNervousness) y ahora también el ritmo de girarse en la loseta
    // (_startIdleFlipLoop) — antes cada uno calculaba su propia fórmula por
    // separado (girarse ni siquiera lo tenía en cuenta); vive aquí para que
    // los tres lean siempre el mismo número, sin poder desincronizarse.
    _nervousnessFactor() {
      return Math.max(0.35, 1 / (1 + this.points * 0.15));
    },

    _applyNervousness() {
      const factor = this._nervousnessFactor();
      const t = Math.min(1, this.points / GNOME_RED_TINT_MAX_POINTS); // 0 (sin tinte) .. 1 (máximo)
      const tint = t > 0 ? `sepia(${t.toFixed(2)}) saturate(${(1 + t * 3).toFixed(2)}) hue-rotate(-40deg)` : "";
      if (this.spriteEl) {
        this.spriteEl.style.animationDuration = `${(GNOME_IDLE_BASE_S.loose * factor).toFixed(3)}s`;
        this.spriteEl.style.filter = tint;
      }
      if (this.attachSpriteEl) {
        this.attachSpriteEl.style.animationDuration = `${(GNOME_IDLE_BASE_S.held * factor).toFixed(3)}s`;
        // .gnome-attach__sprite trae su propia sombra por CSS (drop-shadow) —
        // fijar el filtro inline la pisaría por completo, así que cuando hay
        // tinte se repite aquí esa misma sombra a mano; sin tinte se limpia
        // el inline entero para que la regla del CSS vuelva a mandar sola.
        this.attachSpriteEl.style.filter = tint ? `${tint} drop-shadow(0 3px 4px rgba(0, 0, 0, 0.45))` : "";
      }
    },

    // ---------- Contador de puntos flotante (al hacer clic) ----------
    //
    // Reemplaza al antiguo HUD fijo de la esquina (siempre visible, uno
    // solo): con varios gnomos en juego no tiene sentido un único contador
    // fijo, así que cada gnomo lleva el suyo propio, oculto por defecto, y
    // aparece JUSTO ENCIMA de él (o de quien lo lleva cogido) al hacer clic
    // sobre el propio gnomo — ver los listeners de clic en spawn()/attachTo.

    _ensureBadge() {
      if (this._badgeEl) return;
      const badge = document.createElement("div");
      badge.className = "gnome-points-badge";
      // Por si el clic cae justo sobre el propio contador (p.ej. al volver
      // a mostrarlo bajo el dedo en pantallas táctiles): que no burbujee
      // hasta el listener de deseleccionar del tablero.
      badge.addEventListener("click", (e) => e.stopPropagation());

      // Rediseño pedido explícito: "interfaz circular simple sin iconos
      // donde se muestre el numero con un tamaño correcto" — fuera el
      // icono del gnomo, círculo simple, solo el número (más grande).
      const value = document.createElement("span");
      value.className = "gnome-points-badge__value";
      value.textContent = String(this.points);

      badge.appendChild(value);
      Units.container.appendChild(badge);

      this._badgeEl = badge;
      this._badgeValueEl = value;
    },

    // Loseta sobre la que se debe anclar el contador: la suya propia si
    // anda suelto, o la de quien lo lleva si está cogido — así el contador
    // sigue apareciendo "sobre el gnomo" tenga quien lo tenga.
    _badgeAnchorTile() {
      const holder = this.heldBy ? Units.list.find((u) => u.id === this.heldBy) : null;
      return holder ? { row: holder.row, col: holder.col } : { row: this.row, col: this.col };
    },

    _positionBadge() {
      if (!this._badgeEl) return;
      const { row, col } = this._badgeAnchorTile();
      const { x, y } = getTileCenter(row, col, Units.boardSize);
      this._badgeEl.style.left = `${x}px`;
      // Mismo criterio que Units.spawnFloatingText: por encima de la
      // cabeza, no sobre el centro de la loseta.
      this._badgeEl.style.top = `${y - 118}px`;
      this._badgeEl.style.zIndex = String((row + col) * 10 + 20);
    },

    // Mantener-pulsado, no toggle (ver pointerdown en spawn()/attachTo()):
    // se abre aquí y se cierra en el pointerup/pointercancel global
    // registrado por el GESTOR más abajo (window.addEventListener), igual
    // que UnitInfo.openPopup/closePopup en js/unitinfo.js — soltar en
    // CUALQUIER punto de la pantalla cierra el contador, incluso si el
    // dedo/ratón se ha desplazado fuera del gnomo antes de soltar.
    showBadge() {
      this._ensureBadge();
      this._positionBadge();
      this._badgeVisible = true;
      this._badgeEl.classList.add("gnome-points-badge--visible");
      Gnome._pressedGnome = this;
    },

    hideBadge() {
      this._badgeVisible = false;
      if (this._badgeEl) this._badgeEl.classList.remove("gnome-points-badge--visible");
      if (Gnome._pressedGnome === this) Gnome._pressedGnome = null;
    },
  };
}

// ---------- El gestor ----------

const Gnome = {
  list: [], // un GnomeInstance por gnomo en juego (ver createGnomeInstance)

  // Botones de golpear/pasar — COMPARTIDOS por todos los gnomos a propósito
  // (ver cabecera del archivo): actúan sobre el que lleve cogido la unidad
  // seleccionada ahora mismo, guardado aquí mientras esos botones estén
  // visibles.
  _hitBtn: null,
  _passBtn: null,
  _currentHeldGnome: null,
  _currentHolderUnit: null,

  // Qué gnomo tiene su contador de puntos abierto por "mantener pulsado"
  // ahora mismo (ver GnomeInstance.showBadge/hideBadge) — lo escribe el
  // propio gnomo al abrirse y lo lee el listener global de
  // pointerup/pointercancel de más abajo para saber a cuál cerrarle el
  // contador al soltar, sin que cada gnomo tenga que registrar su propio
  // listener en window (uno solo para todos, igual que UnitInfo en
  // unitinfo.js hace con un único botón).
  _pressedGnome: null,

  // Se llama UNA vez al empezar cada partida nueva (spawnTestUnits,
  // newgame-flow.js), ANTES de crear los gnomos de esa partida — detiene
  // los temporizadores de los gnomos de la partida anterior (ver
  // GnomeInstance.reset) y vacía la lista; el DOM viejo ya lo habrá borrado
  // renderMap (mapgen.js) al pintar el escenario nuevo.
  resetAll() {
    this.list.forEach((g) => g.reset());
    this.list = [];
    this._hideHoldingActions();
  },

  spawnNear(row, col) {
    const instance = createGnomeInstance();
    instance.spawnNear(row, col);
    this.list.push(instance);
    return instance;
  },

  // true si (row, col) la ocupa CUALQUIER gnomo suelto que no sea `except`
  // (el propio gnomo que está preguntando, para no chocar consigo mismo) —
  // usado desde dentro de cada GnomeInstance para no solaparse entre ellos
  // al colocarse, huir, o elegir dónde cae un pase fallido.
  _otherGnomeAt(except, row, col) {
    return this.list.some((g) => g !== except && g.isAt(row, col));
  },

  // Igual que antes (misma firma), pero ahora comprueba TODOS los gnomos —
  // movement.js y combat.js siguen llamando a esto tal cual, sin saber que
  // puede haber más de uno.
  isAt(row, col) {
    return this.list.some((g) => g.isAt(row, col));
  },

  // true si algún gnomo lo lleva cogido esta unidad — usado por
  // combat.js para quitarle la posibilidad de atacar mientras carga con uno.
  isHeldBy(unitId) {
    return this.list.some((g) => g.heldBy === unitId);
  },

  // Pedido explícito (js/villages.js): "cuando se pega con un gnomo a un
  // poblado el gnomo muere y desaparece del juego" — lo llama Villages.attack
  // sobre el gnomo que se acaba de estrellar contra el poblado. Cierra
  // primero sus botones de golpear/pasar si era el que los tenía abiertos
  // (mismo motivo que _hideHoldingActions en cualquier otro sitio: no dejar
  // esos botones apuntando a un gnomo que ya no existe) y lo saca de la
  // lista después de que GnomeInstance.destroy limpie su propio DOM.
  destroyInstance(gnomeInstance) {
    if (this._currentHeldGnome === gnomeInstance) this._hideHoldingActions();
    gnomeInstance.destroy();
    this.list = this.list.filter((g) => g !== gnomeInstance);
  },

  // Lo llama Combat.attack justo antes de eliminar del todo a una unidad con
  // 0 de vida (ver esa línea en combat.js) — si esa unidad llevaba un gnomo
  // cogido, lo suelta ahí mismo y lo hace huir (ver
  // GnomeInstance.dropFromDyingUnit). Si no llevaba ninguno no hace nada, así
  // que combat.js puede llamar a esto siempre sin comprobar antes si hacía
  // falta.
  dropHeldBy(deadUnit) {
    const g = this.list.find((g) => g.heldBy === deadUnit.id);
    if (g) return g.dropFromDyingUnit(deadUnit);
    return Promise.resolve();
  },

  // ---------- Proveedor de rango (ver cabecera del archivo) ----------

  showFor(unit) {
    // Turnos (js/turns.js) — pedido explícito: "pegar al gnomo"/"pasar el
    // gnomo"/coger un gnomo suelto cuentan como acciones del turno; si ya no
    // puede actuar no se ofrece ni la mira de "coger" ni los botones de
    // golpear/pasar.
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) {
      this._hideHoldingActions();
      return;
    }
    const held = this.list.find((g) => g.heldBy === unit.id);
    if (held) {
      this._showHoldingActions(unit, held);
      return;
    }
    this._hideHoldingActions();
    // Ningún gnomo lo lleva esta unidad: se ofrece la mira de "coger" de
    // CADA gnomo suelto que esté a su alcance (puede haber más de uno).
    this.list.forEach((g) => {
      if (!g.heldBy) g._showCatchMarkerFor(unit);
    });
  },

  onClear() {
    this._hideHoldingActions();
    this.list.forEach((g) => {
      g.passing = false;
    });
  },

  // Se llama desde Movement.moveTo tras cada desplazamiento de una unidad
  // del jugador (ver esa línea en movement.js) — TODOS los gnomos sueltos
  // reaccionan a la vez (en paralelo, no importa el orden entre ellos), y
  // el orden pedido explícitamente — personaje se mueve → LUEGO se mueven
  // los gnomos → LUEGO se actualizan las casillas de movimiento — se
  // consigue esperando aquí a que todos terminen (Promise.all) antes de
  // devolver el control a Movement.moveTo, que es quien de verdad refresca
  // el radio después.
  async reactToPlayerMove(mover) {
    await Promise.all(this.list.filter((g) => !g.heldBy).map((g) => g.reactToPlayerMove(mover)));
  },

  hideAllBadges() {
    this.list.forEach((g) => g.hideBadge());
  },

  // Lo llama js/turns.js cada vez que se pulsa PASAR TURNO (tanto el propio
  // jugador como la pulsación automática del ordenador al terminar su turno
  // — pedido explícito: "cada vez que alguien pulsa el botón", sin
  // distinguir quién) — pierden puntos TODOS los gnomos sueltos a la vez,
  // cada uno con su propio popup/temblor/sonido (ver
  // GnomeInstance._loseCooldownPoints), nunca los que estén cogidos ahora
  // mismo (esos ya están "en juego", ganando puntos, no relajándose solos).
  applyTurnPassDecay(amount = 5) {
    this.list.forEach((g) => {
      if (!g.heldBy) g._loseCooldownPoints(amount);
    });
  },

  // ---------- Botones de "lo llevo cogido": golpear / pasar ----------
  // (compartidos por todos los gnomos, ver cabecera del archivo)

  _ensureHoldingButtons() {
    if (this._hitBtn) return;

    const hitBtn = document.createElement("button");
    hitBtn.className = "gnome-action-btn gnome-action-btn--hit";
    hitBtn.setAttribute("aria-label", "Golpear al gnomo");
    // Pedido explícito: "el nuevo icono para la habilidad pegar gnomo que
    // tienen todos los personajes, habra que sustiruirla por el icono
    // phospor, respetarmos el tamaño y medidas del icono de habilidad
    // especial" — mismo patrón que .ability-btn__icon-img (js/abilities.js):
    // la imagen ocupa el 100% del botón circular en vez del glifo Phosphor
    // pequeño de antes (ver .gnome-action-btn__icon-img en style.css).
    hitBtn.innerHTML = '<img class="gnome-action-btn__icon-img" src="assets/iconos/pegar_gnomo.png" alt="">';
    hitBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this._currentHeldGnome && this._currentHolderUnit) {
        this._currentHeldGnome.hit(this._currentHolderUnit);
      }
    });
    document.body.appendChild(hitBtn);
    this._hitBtn = hitBtn;

    const passBtn = document.createElement("button");
    passBtn.className = "gnome-action-btn gnome-action-btn--pass";
    passBtn.setAttribute("aria-label", "Pasar el gnomo");
    // Pedido explícito: "el icono para la habilidad comun lanzar gnomo,
    // habra que sustiruirla por el icono phospor correspondiente,
    // respetarmos el tamaño y medidas del icono de habilidad especial" —
    // mismo patrón que hitBtn de arriba.
    passBtn.innerHTML = '<img class="gnome-action-btn__icon-img" src="assets/iconos/lanzar_gnomo.png" alt="">';
    passBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!this._currentHeldGnome || !this._currentHolderUnit) return;
      const gnomeInstance = this._currentHeldGnome;
      if (gnomeInstance.passing) gnomeInstance._cancelPassAim();
      else gnomeInstance._startPassAim(this._currentHolderUnit);
    });
    document.body.appendChild(passBtn);
    this._passBtn = passBtn;

    this._positionActionButtons();
  },

  // Coloca golpear/pasar en semicírculo a la derecha del círculo de
  // información (ver UI_LAYOUT en js/uiconfig.js) — se calcula una sola
  // vez al crear los botones porque ni el círculo de información ni el
  // propio layout se mueven después. Repartidos a ángulos iguales entre
  // startAngle y endAngle: con los dos botones actuales queda golpear
  // arriba-derecha y pasar abajo-derecha; si se añadiera un tercer botón
  // el mismo cálculo lo intercalaría entre ambos sin tocar nada más.
  _positionActionButtons() {
    const info = window.innerWidth <= 480 ? UI_LAYOUT.infoCircleMobile : UI_LAYOUT.infoCircle;
    const layout = UI_LAYOUT.actionButtons;
    const centerX = info.left + info.size / 2;
    const centerY = info.bottom + info.size / 2; // medido "desde abajo", como el bottom de CSS

    // Cada botón con su propio tamaño (UI_LAYOUT.actionButtons.hitSize/
    // passSize, pedido explícito: "ajustar de manera individual el tamaño
    // de los botones de habilidades normales... desde debug") — el ángulo
    // de cada uno se sigue calculando por POSICIÓN en el reparto (i / n-1
    // entre startAngle y endAngle), no por tamaño, así que se guarda el
    // tamaño junto al botón en vez de asumir que todos miden lo mismo.
    const entries = [
      { btn: this._hitBtn, size: layout.hitSize },
      { btn: this._passBtn, size: layout.passSize },
    ].filter((e) => e.btn);
    const n = entries.length;
    entries.forEach(({ btn, size }, i) => {
      const angleDeg =
        n === 1 ? (layout.startAngle + layout.endAngle) / 2 : layout.startAngle + (i * (layout.endAngle - layout.startAngle)) / (n - 1);
      const angleRad = (angleDeg * Math.PI) / 180;
      const bx = centerX + layout.radius * Math.cos(angleRad);
      // ángulo negativo = "hacia arriba" → más bottom, de ahí el signo menos.
      const by = centerY - layout.radius * Math.sin(angleRad);
      btn.style.left = `${bx - size / 2}px`;
      btn.style.bottom = `${by - size / 2}px`;
      btn.style.width = `${size}px`;
      btn.style.height = `${size}px`;
    });
  },

  _showHoldingActions(unit, gnomeInstance) {
    this._currentHeldGnome = gnomeInstance;
    this._currentHolderUnit = unit;
    this._ensureHoldingButtons();
    this._hitBtn.classList.add("gnome-action-btn--visible");
    const hasAllies = Units.list.some((u) => u.team === "player" && u.id !== unit.id);
    this._passBtn.classList.toggle("gnome-action-btn--visible", hasAllies);
  },

  _hideHoldingActions() {
    this._currentHeldGnome = null;
    this._currentHolderUnit = null;
    if (this._hitBtn) this._hitBtn.classList.remove("gnome-action-btn--visible");
    if (this._passBtn) {
      this._passBtn.classList.remove("gnome-action-btn--visible");
      this._passBtn.classList.remove("gnome-action-btn--aiming");
    }
  },
};

Units.registerRangeProvider(Gnome);

// Cierra el contador de puntos de "mantener pulsado" (ver
// GnomeInstance.showBadge) al soltar en CUALQUIER punto de la pantalla, no
// solo sobre el propio gnomo — mismo patrón que UnitInfo.closePopup en
// unitinfo.js. Un único listener para todos los gnomos (Gnome._pressedGnome
// dice a cuál cerrarle el suyo) en vez de uno por instancia.
window.addEventListener("pointerup", () => {
  if (Gnome._pressedGnome) Gnome._pressedGnome.hideBadge();
});
window.addEventListener("pointercancel", () => {
  if (Gnome._pressedGnome) Gnome._pressedGnome.hideBadge();
});

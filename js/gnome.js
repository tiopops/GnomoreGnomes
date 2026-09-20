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
  flying: 87,
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
      if (!Units.unitAt(row, col) && !Gnome._otherGnomeAt(this, row, col)) {
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

    isAt(row, col) {
      return !!this.el && !this.heldBy && this.row === row && this.col === col;
    },

    _startIdleFlipLoop() {
      const tick = () => {
        const delay = 1500 + Math.random() * 2500;
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
    _maybeIdleHop() {
      if (this.points < GNOME_HOP_MIN_POINTS) return;
      const chance = Math.min(GNOME_HOP_MAX_CHANCE, (this.points - GNOME_HOP_MIN_POINTS) * 0.05);
      if (Math.random() > chance) return;
      this.spriteEl.classList.remove("unit__sprite--hop");
      void this.spriteEl.offsetWidth;
      this.spriteEl.classList.add("unit__sprite--hop");
      SFX.hop();
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
          const moveDist = Math.max(Math.abs(row - unit.row), Math.abs(col - unit.col));
          if (moveDist > moveRange) continue;
          if (moveDist < bestDist) {
            bestDist = moveDist;
            best = { row, col };
          }
        }
      }
      return best;
    },

    _showCatchMarkerFor(unit) {
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
      Units.clearRangeOverlays();
      const approach = this.findApproachTile(unit);
      if (!approach) return; // se alejó / lo cogieron justo antes del clic
      this.hideBadge();
      if (approach.row !== unit.row || approach.col !== unit.col) {
        const path = Units.stepPath(unit.row, unit.col, approach.row, approach.col);
        await Units.walkPath(unit, path);
      }
      Units.faceTowardsTile(unit, this.row, this.col);
      this.attachTo(unit);
      SFX.catch();
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

      // En modo de calibración (js/gnomecalib.js, activo solo con
      // ?calibrarGnomo en la URL) se usa el último ajuste guardado a mano
      // para este personaje en vez del valor fijo del código, para poder
      // seguir arrastrando desde donde se dejó la vez anterior — fuera de ese
      // modo esta llamada no hace nada (GnomeCalib.active es false) y se usa
      // siempre GNOME_ATTACH_OFFSETS tal cual.
      let offset = GNOME_ATTACH_OFFSETS[unit.typeId] || GNOME_ATTACH_OFFSETS.default;
      let heldWidth = GNOME_SIZES.held;
      if (typeof GnomeCalib !== "undefined" && GnomeCalib.active) {
        offset = GnomeCalib.getOffset(unit.typeId) || offset;
        heldWidth = GnomeCalib.getHeldWidth();
      }
      this.attachEl.style.right = `${offset.right}px`;
      this.attachEl.style.bottom = `${offset.bottom}%`;
      this.attachEl.style.width = `${heldWidth}px`;
      // Por si ya llevaba puntos acumulados antes de cogerlo (p.ej. tras un
      // pase exitoso, ver executePass): el temblor del sprite recién
      // enganchado debe arrancar ya a la velocidad "nerviosa" que le toca,
      // no a la base (ver GNOME_IDLE_BASE_S/_applyNervousness arriba).
      this._applyNervousness();

      unit.flipEl.appendChild(this.attachEl);
      this.attachEl.classList.remove("gnome-attach--visible");
      requestAnimationFrame(() => this.attachEl.classList.add("gnome-attach--visible"));

      if (typeof GnomeCalib !== "undefined") GnomeCalib.onAttach(unit, this);
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
    },

    _cancelPassAim() {
      this.passing = false;
      if (Gnome._passBtn) Gnome._passBtn.classList.remove("gnome-action-btn--aiming");
      Units.markerEls = Units.markerEls.filter((m) => {
        const isPass = m.classList.contains("pass-marker");
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
    async landAt(tile) {
      this.row = tile.row;
      this.col = tile.col;
      this.el.classList.remove("gnome--flying");
      this.el.style.display = "";
      Units._placeInstant(this);
      SFX.dropFail();

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

      let dRow = Math.sign(this.row - mover.row);
      let dCol = Math.sign(this.col - mover.col);
      if (dRow === 0 && dCol === 0) {
        dRow = Math.random() < 0.5 ? 1 : -1;
        dCol = Math.random() < 0.5 ? 1 : -1;
      }

      const path = [];
      let r = this.row;
      let c = this.col;
      for (let i = 0; i < 2; i++) {
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
    _applyNervousness() {
      const factor = Math.max(0.35, 1 / (1 + this.points * 0.15));
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

      const icon = document.createElement("div");
      icon.className = "gnome-points-badge__icon";
      const img = document.createElement("img");
      img.src = GNOME_ASSETS.idle;
      img.alt = "";
      icon.appendChild(img);

      const value = document.createElement("span");
      value.className = "gnome-points-badge__value";
      value.textContent = String(this.points);

      badge.appendChild(icon);
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

  // ---------- Proveedor de rango (ver cabecera del archivo) ----------

  showFor(unit) {
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

  // ---------- Botones de "lo llevo cogido": golpear / pasar ----------
  // (compartidos por todos los gnomos, ver cabecera del archivo)

  _ensureHoldingButtons() {
    if (this._hitBtn) return;

    const hitBtn = document.createElement("button");
    hitBtn.className = "gnome-action-btn gnome-action-btn--hit";
    hitBtn.setAttribute("aria-label", "Golpear al gnomo");
    hitBtn.innerHTML = '<i class="ph ph-boxing-glove"></i>';
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
    passBtn.innerHTML = '<i class="ph ph-paper-plane-tilt"></i>';
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

    const buttons = [this._hitBtn, this._passBtn].filter(Boolean);
    const n = buttons.length;
    buttons.forEach((btn, i) => {
      const angleDeg =
        n === 1 ? (layout.startAngle + layout.endAngle) / 2 : layout.startAngle + (i * (layout.endAngle - layout.startAngle)) / (n - 1);
      const angleRad = (angleDeg * Math.PI) / 180;
      const bx = centerX + layout.radius * Math.cos(angleRad);
      // ángulo negativo = "hacia arriba" → más bottom, de ahí el signo menos.
      const by = centerY - layout.radius * Math.sin(angleRad);
      btn.style.left = `${bx - layout.size / 2}px`;
      btn.style.bottom = `${by - layout.size / 2}px`;
      btn.style.width = `${layout.size}px`;
      btn.style.height = `${layout.size}px`;
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

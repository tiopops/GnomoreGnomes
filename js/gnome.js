/* Gnomore Gnomes — "el gnomo": el personaje neutral que hace de pelota.
   Regla de oro: un archivo por mecánica. Este archivo sabe todo lo suyo
   (huir, dejarse coger, llevarse cogido, recibir golpes, ser pasado) y no
   toca directamente el resto del motor — se conecta con él exactamente
   igual que movement.js/combat.js:

     Units.registerRangeProvider(Gnome) — mismo patrón que Movement/Combat:
     showFor(unit) solo se llama para unidades del JUGADOR seleccionadas, y
     es donde este archivo decide si mostrar la mira de "coger" (si el
     gnomo anda suelto y está a su alcance) o los botones de "golpear" /
     "pasar" (si esa unidad es quien lo lleva cogido ahora mismo).

   El propio gnomo se construye con la MISMA forma que una unidad normal
   (row/col/facing/el/flipEl/spriteEl) a propósito, para poder reutilizar
   tal cual las utilidades de Units pensadas para cualquier "unidad": el
   giro (Units._applyFacing), la colocación (Units._placeInstant), el
   desplazamiento paso a paso con salto y sonido (Units.walkPath/hopTo). No
   vive en Units.list (no es una unidad "de verdad": no tiene equipo, no
   ataca, no tiene vida) así que las mecánicas que sí recorren esa lista
   (áreas de movimiento, aproximación al atacar...) tienen que excluir su
   loseta a mano llamando a Gnome.isAt(row, col) — ver esas dos líneas en
   movement.js y combat.js. */

const GNOME_ASSETS = {
  idle: "assets/equipos/MushboomForest/gnomo_idle.png",
  grita: "assets/equipos/MushboomForest/gnomo_grita.png",
};

// Ancho (px) del sprite del gnomo en el suelo (parado/huyendo), en pleno
// vuelo (ver Gnome.animateThrowTo) y mientras lo llevan cogido — calibrados
// con debug/calibrar-gnomo.html. "held" es UN ÚNICO valor compartido por
// TODOS los personajes (a diferencia de right/bottom en
// GNOME_ATTACH_OFFSETS, que sí varían según el personaje): el gnomo debe
// verse siempre del mismo tamaño mientras está cogido, solo cambia dónde se
// engancha.
const GNOME_SIZES = {
  ground: 69,
  flying: 87,
  held: 85,
};

// Duración (ms) del aplastón + rebote al caer tras un pase fallido — debe
// coincidir con la de @keyframes gnome-land-impact en style.css.
const GNOME_LAND_IMPACT_MS = 480;

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

const Gnome = {
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
  _pointsHudEl: null,
  _pointsValueEl: null,
  _hitBtn: null,
  _passBtn: null,
  _flipTimer: null,

  // ---------- Colocación en el tablero ----------

  // Busca la loseta libre (sin ninguna unidad) más cercana a (row, col) en
  // espiral y coloca ahí al gnomo — así spawnTestUnits (newgame-flow.js)
  // puede pedir "cerca del centro" sin tener que calcular a mano qué
  // losetas están ya ocupadas por los personajes de prueba.
  spawnNear(row, col) {
    if (!Units.unitAt(row, col)) {
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
          this.spawn(r, c);
          return;
        }
      }
    }
  },

  spawn(row, col) {
    this.reset();

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

    this.el = el;
    this.flipEl = flipEl;
    this.spriteEl = spriteEl;
    this.row = row;
    this.col = col;
    this.facing = "right";

    Units._placeInstant(this);
    this._ensurePointsHud();
    this._setPoints(0);
    this._startIdleFlipLoop();
  },

  // Limpia cualquier estado/temporizador de una partida anterior antes de
  // volver a crear el gnomo (Units.init/renderMap ya habrán vaciado el DOM
  // del tablero al empezar una partida nueva, ver newgame-flow.js).
  reset() {
    if (this._flipTimer) clearTimeout(this._flipTimer);
    this._flipTimer = null;
    this.el = null;
    this.attachEl = null;
    this.attachSpriteEl = null;
    this.heldBy = null;
    this.busy = false;
    this.passing = false;
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
        }
        tick();
      }, delay);
    };
    tick();
  },

  // ---------- Proveedor de rango (ver cabecera del archivo) ----------

  showFor(unit) {
    if (this.heldBy === unit.id) {
      this._showHoldingActions(unit);
      return;
    }
    this._hideHoldingActions();
    if (this.heldBy) return; // lo lleva otra unidad — nada que ofrecer aquí
    this._showCatchMarkerFor(unit);
  },

  onClear() {
    this._hideHoldingActions();
    this.passing = false;
  },

  // ---------- Coger al gnomo ----------

  // Misma idea que Combat.findApproachTile: si `unit` ya está a distancia 1
  // del gnomo no hace falta moverse; si no, busca la loseta libre más
  // cercana a `unit` (dentro de su movimiento) desde la que sí lo esté.
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
      // Units._placeInstant) a propósito, a diferencia de la mira de ataque
      // sobre el rival: aquí no hay ningún requisito de que se vea "por
      // detrás", así que se prioriza que sea siempre clicable sin más vueltas.
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

  // ---------- Botones de "lo llevo cogido": golpear / pasar ----------

  _ensureHoldingButtons() {
    if (this._hitBtn) return;

    const hitBtn = document.createElement("button");
    hitBtn.className = "gnome-action-btn gnome-action-btn--hit";
    hitBtn.setAttribute("aria-label", "Golpear al gnomo");
    hitBtn.innerHTML = '<i class="ph ph-boxing-glove"></i>';
    hitBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const holder = Units.list.find((u) => u.id === this.heldBy);
      if (holder) this.hit(holder);
    });
    document.body.appendChild(hitBtn);
    this._hitBtn = hitBtn;

    const passBtn = document.createElement("button");
    passBtn.className = "gnome-action-btn gnome-action-btn--pass";
    passBtn.setAttribute("aria-label", "Pasar el gnomo");
    passBtn.innerHTML = '<i class="ph ph-paper-plane-tilt"></i>';
    passBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const holder = Units.list.find((u) => u.id === this.heldBy);
      if (!holder) return;
      if (this.passing) this._cancelPassAim();
      else this._startPassAim(holder);
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

  _showHoldingActions(unit) {
    this._ensureHoldingButtons();
    this._hitBtn.classList.add("gnome-action-btn--visible");
    const hasAllies = Units.list.some((u) => u.team === "player" && u.id !== unit.id);
    this._passBtn.classList.toggle("gnome-action-btn--visible", hasAllies);
  },

  _hideHoldingActions() {
    if (this._hitBtn) this._hitBtn.classList.remove("gnome-action-btn--visible");
    if (this._passBtn) {
      this._passBtn.classList.remove("gnome-action-btn--visible");
      this._passBtn.classList.remove("gnome-action-btn--aiming");
    }
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
    this._passBtn.classList.add("gnome-action-btn--aiming");

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
    if (this._passBtn) this._passBtn.classList.remove("gnome-action-btn--aiming");
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

  async executePass(holder, target) {
    if (this.heldBy !== holder.id || this.busy) return;
    Units.clearRangeOverlays();
    this.passing = false;
    this.busy = true;

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
    // puñetazo de Gnome.hit). Mismo patrón de swap de clase que
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
      this._addPoints(distance);
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

  // Loseta a la que cae el gnomo si el pase falla: se aleja de TODOS los
  // personajes (no solo de quien lanzaba), buscando quedar lo más cerca
  // posible de 5 casillas de distancia de cada uno sin salirse del tablero
  // ni caer sobre una unidad.
  findDropTile(fromUnit) {
    let best = null;
    let bestScore = -Infinity;
    for (let row = 0; row < Units.boardSize; row++) {
      for (let col = 0; col < Units.boardSize; col++) {
        if (Units.unitAt(row, col)) continue;
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

  // Se llama desde Movement.moveTo tras cada desplazamiento de una unidad
  // del jugador (ver esa línea en movement.js) — el gnomo se aleja 2
  // casillas de quien se acaba de mover, salvo que esté cogido o ya esté
  // ocupado en otra animación propia.
  //
  // Async A PROPÓSITO (antes no lo era, y Movement.moveTo la llamaba sin
  // esperarla): el orden pedido es personaje se mueve → LUEGO se mueve el
  // gnomo → LUEGO se actualizan las casillas de movimiento, así que
  // Movement.moveTo tiene que poder esperar a que esta función termine del
  // todo (incluida la huida del gnomo) antes de refrescar el radio —
  // devolver una promesa aquí es lo que se lo permite.
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
    // El gnomo acaba de cambiar de loseta: si hay una unidad seleccionada
    // ahora mismo (sea o no la que se acaba de mover), su mira de
    // "coger" puede haberse quedado apuntando a la loseta vieja — ver
    // _refreshSelectedUnitRange.
    this._refreshSelectedUnitRange();
  },

  // Elige la mejor loseta vecina para huir. No basta con "la primera
  // dirección libre parecida a la deseada" (lo que hacía antes): eso podía
  // llevar al gnomo, paso a paso, hacia una esquina o un rincón cerrado de
  // unidades sin darse cuenta, porque cada paso individual parecía válido
  // aunque lo dejara cada vez con menos salidas. Ahora se puntúan TODAS las
  // 8 loselas vecinas válidas con dos criterios:
  //   - alineación: cuánto se acerca esa dirección a la deseada (alejarse
  //     de quien se movió) — sigue siendo lo que más pesa.
  //   - amplitud (_tileOpenness): cuántas de las 8 casillas alrededor de
  //     ESA loseta quedarían libres — una loseta con poca amplitud es un
  //     callejón o una esquina, aunque ahora mismo esté libre. Sirve de
  //     desempate y evita dead-ends: entre dos direcciones parecidas de
  //     alejamiento, se prefiere la que deja más salidas para el próximo
  //     movimiento en vez de la que acorrala más rápido.
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

  // Cuántas de las 8 casillas alrededor de (row, col) están libres y
  // dentro del tablero — una medida simple de "cuántas salidas tendría el
  // gnomo si estuviera aquí", usada por _bestFleeStep para no elegir una
  // loseta que hoy está libre pero mañana lo deja sin escapatoria.
  _tileOpenness(row, col) {
    let free = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || c < 0 || r >= Units.boardSize || c >= Units.boardSize) continue;
        if (Units.unitAt(r, c)) continue;
        free++;
      }
    }
    return free;
  },

  // Vuelve a pintar SOLO lo del gnomo (mira de "coger", o las de "pasar" si
  // se está apuntando un pase) para la unidad del JUGADOR que esté
  // seleccionada ahora mismo (si hay alguna) — se llama cada vez que el
  // gnomo cambia de loseta por cualquier motivo (huida, aterrizaje tras un
  // pase fallido...) para que esa mira, que podía haberse quedado apuntando
  // a la loseta vieja, se refresque a la nueva. Usa
  // Units.refreshProviderFor en vez de refreshRange a propósito: repintar
  // TODO el radio (movimiento, ataque) solo porque el gnomo se ha movido
  // por su cuenta reiniciaría también esas casillas sin necesidad,
  // haciéndolas parpadear/reaparecer aunque seguían siendo válidas — aquí
  // solo hace falta actualizar la casilla del gnomo.
  _refreshSelectedUnitRange() {
    if (!Units.selectedId) return;
    const unit = Units.list.find((u) => u.id === Units.selectedId);
    if (unit && unit.team === "player") Units.refreshProviderFor(unit, this, "gnome");
  },

  // ---------- Puntos acumulados ----------

  _addPoints(n) {
    this._setPoints(this.points + n);
  },

  _setPoints(value) {
    this.points = value;
    if (!this._pointsValueEl) return;
    this._pointsValueEl.textContent = String(this.points);
    this._pointsValueEl.classList.remove("gnome-points-hud__value--bump");
    void this._pointsValueEl.offsetWidth;
    this._pointsValueEl.classList.add("gnome-points-hud__value--bump");
  },

  _ensurePointsHud() {
    if (this._pointsHudEl) {
      this._pointsHudEl.classList.add("gnome-points-hud--visible");
      return;
    }
    const hud = document.createElement("div");
    hud.className = "gnome-points-hud";

    const icon = document.createElement("div");
    icon.className = "gnome-points-hud__icon";
    const img = document.createElement("img");
    img.src = GNOME_ASSETS.idle;
    img.alt = "";
    icon.appendChild(img);

    const value = document.createElement("span");
    value.className = "gnome-points-hud__value";
    value.textContent = "0";

    hud.appendChild(icon);
    hud.appendChild(value);
    document.body.appendChild(hud);
    requestAnimationFrame(() => hud.classList.add("gnome-points-hud--visible"));

    this._pointsHudEl = hud;
    this._pointsValueEl = value;
  },
};

Units.registerRangeProvider(Gnome);

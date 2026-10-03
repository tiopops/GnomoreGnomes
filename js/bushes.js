/* Gnomore Gnomes — arbustos (mecánica de emboscada).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Repartir arbustos por el mapa cerca de tótems, tiendas Goblin y
       Obeliscos (puntos de interés) — pedido explícito: "no hay demasiados
       pero los suficientes para hacer enboscadas en zonas cercanas a totems,
       tiendas goblin y algunos puntos de interes". A diferencia de
       Villages/Shops/Obelisks (que buscan equidistancia/lejanía), aquí se
       busca justo lo contrario: CERCA de un punto de interés al azar.
     - Dejar que una unidad se esconda dentro al moverse hacia su casilla:
       queda oculta a ojos del rival (misma clase unit--fog-hidden que ya usa
       Fog.js) pero el propio dueño la sigue viendo siempre.
     - Resolver la emboscada: si otra unidad intenta entrar en un arbusto ya
       ocupado por un rival escondido, ese rival se revela, el intruso recibe
       1 de daño y pierde el resto de sus acciones de este turno.
     - El mismo sistema de transparencia por solape que Villages/Obelisks
       (_behindElsFor/refreshOcclusion) para poder seleccionar/atacar a quien
       esté justo detrás en pantalla.

   Pedido explícito (verbatim): "introducimos nueva mecanica, los arbustos,
   estan repartidos por el mapa, no hay demasiados pero los suficientes para
   hacer enboscadas en zonas cercanas a totems, tiendas goblin y algunos
   puntos de interes. te adjunto el sprite. puedes intentar esconderte dentro
   si te mueves hacia su casilla. el personaje queda ocultos a ojos del
   rival, el jugador dueño del personaje lo ve tras del arbusto, el arbusto
   tiene el mismo sistema de transparencia que los totems y obeliscos para
   que el jugador pueda seleccionarlo. Si un jugador intenta meterse dentro
   del arbusto, pero ya habia un enemigo dentro, el enemigo revela su
   posicion a ojos del enemigo y el enemigo que intento meterse recibe un
   punto de daño y acaba todas sus acciones. Se pueden ocultar setas
   explosivas y otros objetos tras los arbustos a modo de trampa, en cuyo
   caso se aplicaran las mecanicas de dicha trampa" — este último punto no
   necesita código propio aquí: las trampas (Abilities._mines/
   Backpack.traps) ya se disparan por coordenada EXACTA desde
   Units.hopTo/Units.walkPath sin mirar qué hay pintado encima de esa
   loseta, así que colocar una encima de un arbusto ya "las esconde" (de
   hecho ya nacen invisibles para el rival) y ya se disparan igual si
   alguien entra ahí — no hace falta que este archivo sepa que existen. */

// Pedido explícito (segunda pasada): "puedes repartir algun arbusto mas por
// el escenario" — de 8 a 12.
const BUSH_COUNT = 12;
const BUSH_MIN_SEPARATION = 3; // entre dos arbustos, para que no se amontonen
const BUSH_POI_RADIUS_START = 2;
const BUSH_POI_RADIUS_MAX = 4;

const Bushes = {
  list: [],
  _nextId: 1,

  init() {
    this._initMouseTracking();
  },

  // Se llama ANTES de spawn() al empezar cada partida nueva (igual que
  // Villages.resetAll) — quita del DOM los arbustos de la partida anterior.
  resetAll() {
    this.list.forEach((b) => b.el.remove());
    this.list = [];
  },

  // Coloca BUSH_COUNT arbustos cerca (radio Chebyshev, con tolerancia
  // creciente si hace falta, mismo idioma que Shops.spawn/Villages.spawn)
  // de un tótem, tienda Goblin u Obelisco elegido al azar cada intento —
  // pedido explícito: "en zonas cercanas a totems, tiendas goblin y algunos
  // puntos de interes". Debe llamarse DESPUÉS de Obelisks/Villages/Shops.spawn
  // (para tener puntos de interés ya colocados de los que partir).
  spawn(boardSize) {
    const pois = [];
    if (typeof Villages !== "undefined") Villages.list.forEach((v) => pois.push({ row: v.row, col: v.col }));
    if (typeof Shops !== "undefined") Shops.list.forEach((s) => pois.push({ row: s.row, col: s.col }));
    if (typeof Obelisks !== "undefined") Obelisks.list.forEach((o) => pois.push({ row: o.row, col: o.col }));
    if (pois.length === 0) return;

    let radius = BUSH_POI_RADIUS_START;
    let attempts = 0;
    while (this.list.length < BUSH_COUNT && attempts < 1200) {
      attempts++;
      if (attempts % 150 === 0) radius = Math.min(BUSH_POI_RADIUS_MAX, radius + 1);
      const poi = pois[Math.floor(Math.random() * pois.length)];
      const dr = Math.floor(Math.random() * (radius * 2 + 1)) - radius;
      const dc = Math.floor(Math.random() * (radius * 2 + 1)) - radius;
      if (dr === 0 && dc === 0) continue; // nunca justo encima del propio punto de interés
      const row = poi.row + dr;
      const col = poi.col + dc;
      if (row < 0 || col < 0 || row >= boardSize || col >= boardSize) continue;
      if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) continue;
      if (typeof Units !== "undefined" && Units.unitAt(row, col)) continue;
      if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) continue;
      if (typeof Villages !== "undefined" && Villages.at(row, col)) continue;
      if (typeof Shops !== "undefined" && Shops.at(row, col)) continue;
      if (typeof Obelisks !== "undefined" && Obelisks.at(row, col)) continue;
      if (typeof Altar !== "undefined" && Altar.at(row, col)) continue; // Altar de Sacrificios (js/altar.js)
      if (typeof GnomOgro !== "undefined" && GnomOgro.at(row, col)) continue; // GnomOgro (js/gnomogro.js): casilla ocupada
      if (typeof Resources !== "undefined" && Resources.at(row, col)) continue; // Recursos de escenario (js/resources.js)
      if (this.at(row, col)) continue;
      const tooClose = this.list.some(
        (b) => Math.max(Math.abs(b.row - row), Math.abs(b.col - col)) < BUSH_MIN_SEPARATION
      );
      if (tooClose) continue;
      this._create(row, col);
    }
  },

  at(row, col) {
    return this.list.find((b) => b.row === row && b.col === col) || null;
  },

  _create(row, col) {
    const el = document.createElement("div");
    el.className = "unit bush";

    const spriteEl = document.createElement("img");
    spriteEl.decoding = "async"; // pedido de rendimiento: no bloquear el hilo principal decodificando
    spriteEl.className = "bush__sprite";
    // Calidad de sprite dinámica según el zoom (pedido explícito, ver
    // js/spritequality.js).
    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(spriteEl, "assets/iconos/arbusto.png");
    else spriteEl.src = "assets/iconos/arbusto.png";
    spriteEl.alt = "";
    spriteEl.draggable = false;
    // Pedido explícito: "todo en el escenario se mueve al compas...pon
    // delays en las animaciones de los elementos del escenario para que no
    // todos los arbustos se muevan igual" — .bush__sprite comparte el mismo
    // @keyframes unit-idle-breathe (misma duración) para TODAS las
    // instancias, así que sin esto laten perfectamente sincronizados. Un
    // delay negativo aleatorio adelanta el reloj de cada instancia a un
    // punto distinto del ciclo desde el primer fotograma (sin negativo se
    // verían todos quietos un rato antes de arrancar, ver el mismo truco en
    // Resources._create).
    spriteEl.style.animationDelay = `-${(Math.random() * 3).toFixed(2)}s`;
    el.appendChild(spriteEl);
    if (typeof Shadows !== "undefined") Shadows.attach(spriteEl);

    if (typeof Units !== "undefined") Units.container.appendChild(el);

    const bush = { id: `bush-${this._nextId++}`, row, col, el, spriteEl, hiddenUnitId: null };
    this._placeInstant(bush);
    this.list.push(bush);
    return bush;
  },

  _placeInstant(bush) {
    if (typeof getTileCenter === "undefined" || typeof Units === "undefined") return;
    const { x, y } = getTileCenter(bush.row, bush.col, Units.boardSize);
    bush.el.style.left = `${x}px`;
    bush.el.style.top = `${y}px`;
    bush.el.style.zIndex = String((bush.row + bush.col) * 10 + 5);
  },

  // ---------- Ocultación ----------
  // true si hay alguien escondido en la casilla (row,col) y ese alguien es
  // de un equipo distinto a `viewerTeam` — usado por Movement.reachableTiles
  // (para dejar que se pueda intentar entrar de todos modos, disparando la
  // emboscada) y por Combat/Abilities (para que no se pueda seleccionar como
  // objetivo hasta que se revele).
  // z-index de una trampa/objeto en (row, col): +6 normalmente (por encima de
  // quien lo pise), pero +4 si hay un arbusto encima — queda oculta DETRÁS del
  // arbusto (z +5) y solo se ve cuando el arbusto se vuelve transparente.
  trapZ(row, col) {
    return (row + col) * 10 + (this.at(row, col) ? 4 : 6);
  },

  isHiddenFromTeam(row, col, viewerTeam) {
    const bush = this.at(row, col);
    if (!bush || !bush.hiddenUnitId) return false;
    const hiddenUnit = typeof Units !== "undefined" ? Units.list.find((u) => u.id === bush.hiddenUnitId) : null;
    if (!hiddenUnit) {
      bush.hiddenUnitId = null; // la unidad ya no existe (murió/se quitó) — limpia la referencia sola
      return false;
    }
    if (hiddenUnit.row !== bush.row || hiddenUnit.col !== bush.col) {
      bush.hiddenUnitId = null; // ya no está dentro (lo sacaron sin caminar)
      return false;
    }
    return hiddenUnit.team !== viewerTeam;
  },

  // true si `unit` está ahora mismo escondida dentro de cualquier arbusto —
  // usado por Fog.applyVisibility para ocultarla visualmente al rival.
  isHidingUnit(unit) {
    // Pedido explícito: "la elfa aparece como que está oculta sin estar en
    // un arbusto" — si un personaje escondido sale del arbusto SIN pasar
    // por Units.walkPath (empujón de un golpe o habilidad, salto/embestida
    // de una habilidad...) el arbusto seguía marcándolo como escondido
    // aunque ya estuviera en otra casilla. Solo cuenta como escondido si
    // SIGUE en la casilla del arbusto; si no, se libera aquí mismo.
    const bush = this.list.find((b) => b.hiddenUnitId === unit.id);
    if (!bush) return false;
    if (bush.row !== unit.row || bush.col !== unit.col) {
      bush.hiddenUnitId = null;
      return false;
    }
    return true;
  },

  // Se llama al ARRANCAR cualquier desplazamiento (ver Units.walkPath) —
  // moverse a cualquier sitio implica siempre dejar de estar escondido en el
  // arbusto que se ocupara hasta ahora, si había alguno.
  clearHiddenUnit(unitId) {
    const bush = this.list.find((b) => b.hiddenUnitId === unitId);
    if (!bush) return;
    bush.hiddenUnitId = null;
    if (typeof Fog !== "undefined") Fog.applyVisibility();
    this.refreshOcclusion();
  },

  // Llamado desde Units.walkPath (js/units.js), el único punto de paso de
  // cualquier desplazamiento del proyecto — mismo patrón exacto que
  // Backpack.checkTrapAt/Abilities.checkTrigger. Devuelve true si se ha
  // disparado una emboscada (para que walkPath corte el resto del camino,
  // igual que un cepo: "acaba todas sus acciones" no pegaría con seguir
  // andando después de esto).
  checkStepInto(unit, row, col) {
    const bush = this.at(row, col);
    if (!bush) return false;
    // TotemVision (js/totemvision.js) — pedido explícito: "se pueden
    // ocultar dentro de un arbusto, pero si un personaje enemigo entra
    // dentro del arbusto, el totem se rompe" — se comprueba aquí, en el
    // mismo punto de entrada a CUALQUIER arbusto, antes de la emboscada de
    // unidades de abajo: un rival que entra rompe el tótem siempre, aunque
    // además el arbusto estuviera escondiendo a alguien.
    if (typeof TotemVision !== "undefined") TotemVision.checkBushEntry(unit, row, col);
    if (bush.hiddenUnitId && bush.hiddenUnitId !== unit.id) {
      const hiddenUnit = typeof Units !== "undefined" ? Units.list.find((u) => u.id === bush.hiddenUnitId) : null;
      if (hiddenUnit && hiddenUnit.team !== unit.team) {
        this._springAmbush(bush, hiddenUnit, unit);
        // Si el intruso sobrevive, se queda con el arbusto y empuja fuera
        // al ocupante anterior (que queda a la vista).
        if (unit.hp > 0) this._takeOverBush(bush, unit, hiddenUnit);
        return true;
      }
    }
    // Arbusto libre — pedido explícito: "puedes intentar esconderte dentro
    // si te mueves hacia su casilla". Se esconde sin más, sin gastar ninguna
    // acción aparte del propio movimiento que ya lo ha traído hasta aquí.
    bush.hiddenUnitId = unit.id;
    if (typeof Fog !== "undefined") Fog.applyVisibility();
    this.refreshOcclusion();
    return false;
  },

  // "el enemigo revela su posicion a ojos del enemigo y el enemigo que
  // intento meterse recibe un punto de daño y acaba todas sus acciones"
  // (pedido explícito) — mismo lenguaje de feedback (temblor + destello +
  // mensaje) que Backpack._playTrapFeedback/Abilities._playExplosionFeedback,
  // reutilizado tal cual en vez de un tercer sistema de "impacto grande".
  _springAmbush(bush, hiddenUnit, intruder) {
    bush.hiddenUnitId = null; // se revela: deja de estar oculto
    if (typeof Fog !== "undefined") Fog.applyVisibility();
    this.refreshOcclusion();

    if (typeof Villages !== "undefined") Villages._flashScreen();
    const viewportEl = document.getElementById("board-viewport");
    if (viewportEl) {
      viewportEl.classList.remove("board-viewport--shake");
      void viewportEl.offsetWidth;
      viewportEl.classList.add("board-viewport--shake");
      setTimeout(() => viewportEl.classList.remove("board-viewport--shake"), 420);
    }
    if (typeof SFX !== "undefined") SFX.glory();
    Units.spawnFloatingText(intruder, "¡EMBOSCADA!", { className: "dmg-popup gnome-points-popup" });

    intruder.hp = Math.max(0, intruder.hp - 1);
    Units.updateHpBar(intruder);
    Units.spawnFloatingText(intruder, "-1", { className: "dmg-popup" });
    Units.playShake(intruder);
    if (typeof SFX !== "undefined") SFX.hit();
    // "acaba todas sus acciones" — mismo mecanismo ya usado por otras
    // trampas/habilidades para dejar a alguien sin nada que hacer ya este
    // turno (a diferencia de forcedRestNextTurn, esto es INMEDIATO).
    if (typeof Turns !== "undefined") Turns.forceOutOfActions(intruder);

    if (intruder.hp <= 0) {
      Units.removeUnit(intruder);
      if (typeof Gnome !== "undefined") Gnome.dropHeldBy(intruder);
    }
  },

  _takeOverBush(bush, intruder, evicted) {
    bush.hiddenUnitId = intruder.id;
    const dirs = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) dirs.push([dr, dc]);
    dirs.sort(() => Math.random() - 0.5);
    // _pushBackFixed empuja alejándose del "atacante": se le da un punto
    // ficticio justo en el lado contrario de cada dirección probada.
    (async () => {
      for (const [dr, dc] of dirs) {
        const fake = { row: evicted.row - dr, col: evicted.col - dc };
        const r0 = evicted.row;
        const c0 = evicted.col;
        if (typeof Abilities !== "undefined") await Abilities._pushBackFixed(evicted, fake, 1);
        if (evicted.row !== r0 || evicted.col !== c0) break;
      }
      bush.hiddenUnitId = intruder.id;
      if (typeof Fog !== "undefined") Fog.applyVisibility();
      this.refreshOcclusion();
    })();
  },

  // ---------- Ocultar personajes propios escondidos detrás de un arbusto ----------
  // Mismo mecanismo exacto que Villages._behindElsFor/refreshOcclusion (ver
  // ese archivo para la explicación completa de la geometría isométrica) —
  // pedido explícito: "el arbusto tiene el mismo sistema de transparencia
  // que los totems y obeliscos para que el jugador pueda seleccionarlo".
  _OCCLUSION_OFFSETS: [
    [-1, -1],
    [-1, 0],
    [0, -1],
    [-2, -2],
  ],
  _behindElsFor(bush) {
    const els = [];
    if (typeof Units === "undefined") return els;
    Units.list.forEach((unit) => {
      if (!unit.el || unit.el.classList.contains("unit--fog-hidden")) return;
      if (this._OCCLUSION_OFFSETS.some(([dr, dc]) => unit.row === bush.row + dr && unit.col === bush.col + dc)) {
        els.push(unit.el);
      }
    });
    Units.markerEls.forEach((m) => {
      if (!m || !m.isConnected) return;
      const r = Number(m.dataset.row);
      const c = Number(m.dataset.col);
      if (Number.isNaN(r) || Number.isNaN(c)) return;
      if (this._OCCLUSION_OFFSETS.some(([dr, dc]) => r === bush.row + dr && c === bush.col + dc)) {
        els.push(m);
      }
    });
    return els;
  },

  refreshOcclusion(mouseX, mouseY) {
    if (typeof Units === "undefined") return;
    const mx = typeof mouseX === "number" ? mouseX : this._lastMouseX;
    const my = typeof mouseY === "number" ? mouseY : this._lastMouseY;
    this.list.forEach((bush) => {
      if (!bush.spriteEl) return;
      if (bush.el.classList.contains("unit--fog-hidden") || mx === null || my === null) {
        bush.el.classList.remove("bush--occluding");
        return;
      }
      const behindEls = this._behindElsFor(bush);
      let occluding = false;
      if (behindEls.length) {
        const bRect = bush.spriteEl.getBoundingClientRect();
        const mouseOverBush = mx >= bRect.left && mx <= bRect.right && my >= bRect.top && my <= bRect.bottom;
        const mouseOverBehind = behindEls.some((el) => {
          const r = el.getBoundingClientRect();
          return mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom;
        });
        occluding = mouseOverBush || mouseOverBehind;
      }
      // Pedido explícito: "los arbustos deben tener el sistema de
      // transparencia para cuando un personaje esta sobre ellos escondido"
      // — lo de arriba solo cubre el solape isométrico con quien esté
      // JUNTO al arbusto (mismo mecanismo que Villages/Obelisks); un
      // personaje PROPIO escondido DENTRO de este mismo arbusto (misma
      // loseta, unit--in-bush, ver Fog.applyVisibility) queda por detrás
      // de su sprite (z-index -1, ver ese mismo comentario) y sin este
      // añadido solo se vería atenuado al pasar el ratón justo encima, en
      // vez de permanecer visible mientras siga escondido ahí.
      if (!occluding && bush.hiddenUnitId && typeof Units !== "undefined") {
        const hiddenUnit = Units.list.find((u) => u.id === bush.hiddenUnitId);
        if (hiddenUnit && hiddenUnit.team === "player") occluding = true;
      }
      bush.el.classList.toggle("bush--occluding", occluding);
    });
  },

  _lastMouseX: null,
  _lastMouseY: null,
  _mouseTrackingReady: false,
  _initMouseTracking() {
    if (this._mouseTrackingReady) return;
    this._mouseTrackingReady = true;
    window.addEventListener("mousemove", (e) => {
      this._lastMouseX = e.clientX;
      this._lastMouseY = e.clientY;
      this.refreshOcclusion(e.clientX, e.clientY);
    });
    // Mismo arreglo que Villages/Obelisks: "mousemove" no dispara en móvil,
    // así que se alimenta también con las coordenadas reales del dedo.
    const handleTouch = (e) => {
      const t = e.touches && e.touches[0];
      if (!t) return;
      this._lastMouseX = t.clientX;
      this._lastMouseY = t.clientY;
      this.refreshOcclusion(t.clientX, t.clientY);
    };
    window.addEventListener("touchstart", handleTouch, { passive: true });
    window.addEventListener("touchmove", handleTouch, { passive: true });
  },
};

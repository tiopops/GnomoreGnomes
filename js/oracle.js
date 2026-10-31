/* Gnomore Gnomes — Casa del Oráculo.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Colocar la Casa del Oráculo (una sola) al empezar la partida, en una
       loseta equidistante de los Obeliscos de todos los jugadores (igual que
       la Tienda Goblin, ver Shops.spawn) y NUNCA cerca de la Tienda Goblin.
     - Su estado compartido: 8 cartas boca abajo (4 parejas), mismo orden para
       todos los jugadores, las casillas ganadas por cada equipo, las malditas.
     - Las reglas de cada consulta: una por turno y jugador, cuesta Puntos de
       Gloria (2, 4, 6, 8... nunca se reinicia), acierto = beneficio,
       casilla "ganada" por otro = trampa maldita (un turno sin oráculo).
     - Los beneficios pasivos (Renacido, Afortunado, Eterno) y el Vigilante
       (levanta la niebla 3 s al cerrar la ventana).
     - Su ventana (misma interfaz que la Tienda Goblin) y todos sus efectos.

   Pedido explícito: "implementalo todo conforme esta [la demo aprobada]...
   la casa del oraculo aparezca en una casilla que no beneficie a ningun
   jugador por distancia, la tienda goblin y el oraculo nunca deben aparecer
   demasiado cerca" + "cuando todas las cartas esten reveladas ya no se podra
   acceder a la casa del oraculo" + "la forma de reaccionar del edificio debe
   ser igual que la de la tienda goblin". Por eso la casa reutiliza las clases
   "unit shop" (hover, cursor amarillo, pulso al clic, mira de acercarse). */

const ORACLE_SPRITE = "assets/edificios/oraculo.png";
const ORACLE_COST_STEP = 2; // coste = 2 * (consultas previas + 1)
const ORACLE_LOCK_TURNS = 2; // maldición: este turno ya gastado + el siguiente propio
const ORACLE_VIGILANTE_MS = 3000;

const ORACLE_IMG = {
  reverso: "assets/oraculo/carta_reverso.webp",
  afortunado: "assets/oraculo/carta_afortunado.webp",
  eterno: "assets/oraculo/carta_eterno.webp",
  renacido: "assets/oraculo/carta_renacido.webp",
  vigilante: "assets/oraculo/carta_vigilante.webp",
  maldicion: "assets/oraculo/carta_maldicion.webp",
  goblin: "assets/oraculo/oraculo_goblin.webp",
  bola: "assets/oraculo/bola_cristal.webp",
};
const ORACLE_KINDS = ["renacido", "vigilante", "afortunado", "eterno"];
const ORACLE_INFO = {
  renacido: { n: "El Renacido", d: "Cuando una de tus unidades muere, ganas tantos puntos de gloria como costaba reclutarla." },
  vigilante: { n: "El Vigilante", d: "Disipa la niebla de todo el mapa durante 3 segundos; después todo vuelve a cubrirse." },
  afortunado: { n: "El Afortunado", d: "Recibes 1 punto de gloria por turno por cada tótem que controlen tus rivales." },
  eterno: { n: "El Eterno", d: "Cuando una de tus unidades golpea a un gnomo, gana 1 punto de vida por golpe, hasta su vida máxima." },
};
// Valores finales aprobados en la demo (% del ancho de la ventana).
const ORACLE_CFG = { gx: -5.4, gy: -19.2, gs: 47.1, bx: 32.2, by: -6.4, bs: 9, bfloat: 3.3, bspeed: 0.7, bglow: 70, bsway: 6, gfloat: 0.25 };

const Oracle = {
  list: [],
  _nextId: 1,
  slots: [], // [{kind, won: team|null, burn: bool}]
  t: {}, // por equipo: {attempts, used, lock, pending}
  perks: {}, // por equipo: {renacido, afortunado, eterno}
  _queuedVigilante: false,
  _msgEl: null,

  // ---------- Ciclo de vida ----------
  resetAll() {
    this.closePopup(true);
    this.list.forEach((o) => o.el.remove());
    this.list = [];
    this.slots = [];
    this.t = {};
    this.perks = {};
    this._queuedVigilante = false;
  },

  _team(team) {
    return this.t[team] || (this.t[team] = { attempts: 0, used: false, lock: 0, pending: false });
  },
  _perk(team) {
    return this.perks[team] || (this.perks[team] = {});
  },
  has(team, perk) {
    return !!(this.perks[team] && this.perks[team][perk]);
  },
  costFor(team) {
    return ORACLE_COST_STEP * (this._team(team).attempts + 1);
  },
  isLocked(team) {
    return this._team(team).lock > 0;
  },
  // Todas las parejas ya reclamadas: la casa deja de estar disponible.
  depleted() {
    return this.slots.length > 0 && this.slots.every((s) => s.won);
  },
  selectable(team, i) {
    const s = this.slots[i];
    return !!s && s.won !== team && !s.burn;
  },
  canConsult(team) {
    const T = this._team(team);
    if (this.depleted()) return false;
    if (T.lock > 0) return false;
    if (T.used && !T.pending) return false;
    return this.slots.filter((_, i) => this.selectable(team, i)).length >= 2;
  },

  // ---------- Aparición ----------
  // Equidistante (Chebyshev) de los Obeliscos de todos los equipos, no pegada
  // a ninguno y a una distancia mínima de la Tienda Goblin.
  spawn(boardSize) {
    const obeliskSpots = typeof Obelisks !== "undefined" ? Obelisks.list.map((o) => ({ row: o.row, col: o.col })) : [];
    const shopSpots = typeof Shops !== "undefined" ? Shops.list.map((s) => ({ row: s.row, col: s.col })) : [];
    const important = [];
    ["Altar", "Volcano", "Villages", "Obelisks"].forEach((n) => {
      let mod = null;
      try { mod = eval(n); } catch (e) { mod = null; }
      if (mod && mod.list) mod.list.forEach((b) => important.push({ row: b.row, col: b.col }));
    });
    const chb = (a, b) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
    // Lo más equidistante posible de todas las bases. Las separaciones "ideales" de la Tienda y de los
    // edificios importantes cuestan puntos si no se cumplen, pero la equidad pesa más (con mínimos duros).
    const minDist = Math.max(2, Math.floor(boardSize / 6));
    const idealShop = Math.max(5, Math.floor(boardSize / 3)), hardShop = 4;
    const idealImp = 5, hardImp = 3;
    const nearest = (arr, row, col) => (arr.length ? Math.min(...arr.map((o) => chb(o, { row, col }))) : 99);
    const valid = (row, col) => {
      if (nearest(obeliskSpots, row, col) < minDist) return false;
      if (nearest(shopSpots, row, col) < hardShop) return false;
      if (nearest(important, row, col) < hardImp) return false;
      if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) return false;
      if (typeof Units !== "undefined" && Units.unitAt(row, col)) return false;
      if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) return false;
      if (typeof Villages !== "undefined" && Villages.at(row, col)) return false;
      if (typeof Obelisks !== "undefined" && (Obelisks.at(row, col) || Obelisks.isAdjacent(row, col))) return false;
      if (typeof Altar !== "undefined" && Altar.isNear(row, col)) return false;
      if ((typeof Resources !== "undefined" && Resources.at(row, col)) || (typeof Drums !== "undefined" && Drums.at(row, col))) return false;
      if (typeof Shops !== "undefined" && Shops.at(row, col)) return false;
      return true;
    };
    const penalty = (row, col) => {
      let p = 0;
      if (nearest(shopSpots, row, col) < idealShop) p += 12;
      if (nearest(important, row, col) < idealImp) p += 12;
      return p;
    };
    const spot = pickFairSpot(boardSize, valid, obeliskSpots, [], penalty);
    if (spot) this._create(spot.row, spot.col);
    if (this.list.length) {
      // Mismo orden para todos los jugadores: se baraja con el Math.random
      // sembrado (js/rand.js), idéntico en ambos clientes.
      const a = [...ORACLE_KINDS, ...ORACLE_KINDS];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      this.slots = a.map((kind) => ({ kind, won: null, burn: false }));
    }
  },

  at(row, col) {
    return this.list.find((o) => o.row === row && o.col === col) || null;
  },

  _create(row, col) {
    const el = document.createElement("div");
    el.className = "unit shop oracle";
    attachShopTouchFx(el, "Oráculo");
    const spriteEl = document.createElement("img");
    spriteEl.decoding = "async";
    spriteEl.className = "shop__sprite oracle__sprite";
    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(spriteEl, ORACLE_SPRITE);
    else spriteEl.src = ORACLE_SPRITE;
    spriteEl.alt = "";
    spriteEl.draggable = false;
    spriteEl.style.animationDelay = `-${(NR() * 2.6).toFixed(2)}s`;
    el.appendChild(spriteEl);
    if (typeof Shadows !== "undefined") Shadows.attach(spriteEl);
    const lock = document.createElement("i");
    lock.className = "ph-fill ph-lock oracle__lock";
    el.appendChild(lock);

    const oracle = { id: `oracle-${this._nextId++}`, row, col, el, spriteEl };

    el.addEventListener("click", (e) => {
      // Mismo comportamiento que la Tienda Goblin (ver Shops._create).
      if (el.classList.contains("shop--interactive")) {
        e.stopPropagation();
        this.tryOpen(oracle);
        return;
      }
      const unit = typeof Units !== "undefined" ? Units.list.find((u) => u.id === Units.selectedId) : null;
      if (!unit || unit.team !== "player") return;
      if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
      if (this.depleted()) return;
      if (!this.findApproachTile(unit, oracle)) return;
      e.stopPropagation();
      this.approachAndOpen(unit, oracle);
    });

    if (typeof Units !== "undefined") Units.container.appendChild(el);
    this._placeInstant(oracle);
    this.list.push(oracle);
    this.refreshAll();
    return oracle;
  },

  _placeInstant(o) {
    if (typeof getTileCenter === "undefined" || typeof Units === "undefined") return;
    const { x, y } = getTileCenter(o.row, o.col, Units.boardSize);
    o.el.style.left = `${x}px`;
    o.el.style.top = `${y}px`;
    o.el.style.zIndex = String((o.row + o.col) * 10 + 5);
  },

  // ---------- Interactividad (igual que Shops.refreshAll) ----------
  refreshAll() {
    if (typeof Units === "undefined") return;
    const depleted = this.depleted();
    const lockedMe = this.isLocked("player");
    this.list.forEach((o) => {
      const adjacent =
        !depleted &&
        Units.list.some((u) => u.team === "player" && Math.max(Math.abs(u.row - o.row), Math.abs(u.col - o.col)) <= 1);
      o.el.classList.toggle("shop--interactive", adjacent);
      o.el.classList.toggle("oracle--locked", lockedMe && !depleted);
      o.el.classList.toggle("oracle--depleted", depleted);
      if ((!adjacent || depleted) && this._active === o && this._state === "idle") this.closePopup();
    });
  },

  // Abre la ventana si se puede; si no, explica por qué.
  tryOpen(o) {
    if (this.depleted()) {
      if (typeof UiHint !== "undefined") UiHint.show("El Oráculo ya ha revelado todas sus cartas");
      return;
    }
    if (this.isLocked("player")) {
      SFX.back();
      if (typeof UiHint !== "undefined") {
        UiHint.show("El Oráculo te rechaza: estás maldito");
      }
      return;
    }
    this.openPopup(o);
  },

  // ---------- Proveedor de rango (mira de "ir y abrir", como Shops) ----------
  findApproachTile(unit, o) {
    const moveRange = Units.moveRangeOf(unit);
    const dist = (r, c) => Math.max(Math.abs(r - o.row), Math.abs(c - o.col));
    if (dist(unit.row, unit.col) <= 1) return { row: unit.row, col: unit.col };
    let best = null;
    let bestDist = Infinity;
    for (let row = 0; row < Units.boardSize; row++) {
      for (let col = 0; col < Units.boardSize; col++) {
        if (row === unit.row && col === unit.col) continue;
        if (dist(row, col) > 1) continue;
        if (Units.unitAt(row, col)) continue;
        if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) continue;
        if (typeof Villages !== "undefined" && Villages.at(row, col)) continue;
        if (typeof Shops !== "undefined" && Shops.at(row, col)) continue; // incluye la propia casa
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

  showFor(unit) {
    if (unit.team !== "player" || this.depleted()) return;
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    this.list.forEach((o, i) => {
      if (typeof Fog !== "undefined" && Fog.isFogged(o.row, o.col)) return;
      if (!this.findApproachTile(unit, o)) return;
      Units.addMarker({
        className: "attack-marker shop-open-marker",
        row: o.row,
        col: o.col,
        zOffset: 2,
        delayIndex: i,
        visibleClass: "attack-marker--visible",
        owner: "oracle",
        alwaysOnTop: true,
        onClick: () => this.approachAndOpen(unit, o),
        buildContent: (marker) => {
          const icon = document.createElement("i");
          icon.className = "ph ph-crosshair-simple attack-marker__icon";
          marker.appendChild(icon);
        },
      });
    });
  },
  onClear() {},

  async approachAndOpen(unit, o) {
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    Units.clearRangeOverlays();
    const approach = this.findApproachTile(unit, o);
    if (!approach) return;
    if (approach.row !== unit.row || approach.col !== unit.col) {
      const path = Units.stepPath(unit.row, unit.col, approach.row, approach.col);
      await Units.walkPath(unit, path);
      if (typeof Fog !== "undefined" && unit.team === "player") Fog.revealForUnit(unit);
      if (typeof Turns !== "undefined") Turns.useAction(unit);
    }
    this.tryOpen(o);
    Units.refreshRange(unit);
  },

  // ---------- Reglas (se replican en el cliente rival, ver net-hooks.js) ----------
  // Paga la consulta: gasta gloria, sube el contador y marca el turno como usado.
  pay(team) {
    if (!this.canConsult(team) || this._team(team).pending) return false;
    if (typeof Glory === "undefined" || !Glory.spend(team, this.costFor(team))) return false;
    const T = this._team(team);
    T.attempts++;
    T.used = true;
    T.pending = true;
    return true;
  },

  // Resuelve las dos cartas elegidas. Devuelve {res:"win"|"miss"|"curse", kind, trap:[idx]}.
  resolve(team, a, b) {
    const T = this._team(team);
    T.pending = false;
    if (a === b || !this.selectable(team, a) || !this.selectable(team, b)) return { res: "miss" };
    const A = this.slots[a];
    const B = this.slots[b];
    const traps = [a, b].filter((i) => {
      const s = this.slots[i];
      return s.won && s.won !== team;
    });
    if (traps.length) {
      traps.forEach((i) => (this.slots[i].burn = true));
      T.lock = ORACLE_LOCK_TURNS;
      this.refreshAll();
      return { res: "curse", trap: traps };
    }
    if (A.kind === B.kind) {
      A.won = team;
      B.won = team;
      if (A.kind !== "vigilante") this._perk(team)[A.kind] = true;
      if (team === "player" && A.kind !== "vigilante" && typeof Backpack !== "undefined") Backpack.addItem("oraculo_" + A.kind);
      this.refreshAll();
      return { res: "win", kind: A.kind };
    }
    return { res: "miss" };
  },

  // ---------- Beneficios pasivos ----------
  _gainGlory(team, n) {
    if (typeof Glory === "undefined" || n <= 0 || !(team in Glory.points)) return;
    const room = Math.max(0, GLORY_CAP - Glory.points[team]);
    const add = Math.min(room, n);
    if (add <= 0) return;
    Glory.points[team] += add;
    Glory._render(team, { bump: true, gained: add });
  },

  // El Renacido: lo llama Units.removeUnit.
  onUnitDied(unit) {
    if (!this.has(unit.team, "renacido")) return;
    const price = typeof Units !== "undefined" ? Units.recruitPriceFor(unit.typeId) : 0;
    this._gainGlory(unit.team, price);
  },

  // El Eterno: lo llama Gnome.hit.
  onGnomeHit(unit) {
    if (!this.has(unit.team, "eterno")) return;
    if (!(unit.hp < unit.maxHp)) return;
    unit.hp += 1;
    if (typeof Units !== "undefined") {
      Units.updateHpBar(unit);
      Units.spawnFloatingText(unit, "+1", { className: "dmg-popup popup--good" });
    }
  },

  // Inicio de turno de cada equipo (ver Turns.registerTurnStartListener).
  onTurnStart(team) {
    const T = this._team(team);
    T.used = false;
    T.pending = false;
    if (T.lock > 0) {
      T.lock--;
      if (T.lock === 0 && team === "player" && !this.depleted()) this._showAvailableMessage();
    }
    if (this.has(team, "afortunado") && typeof Villages !== "undefined") {
      const rival = Villages.list.filter((v) => v.owner && v.owner !== "neutral" && v.owner !== team).length;
      this._gainGlory(team, rival);
    }
    this.refreshAll();
  },

  _showAvailableMessage() {
    Banners.enqueue({
      priority: 1,
      duration: 2600,
      show: () => {
        if (!this._msgEl) {
          const el = document.createElement("div");
          el.className = "shop-restock-msg";
          el.innerHTML =
            '<i class="ph ph-eye shop-restock-msg__icon"></i>' +
            '<span class="p5-banner__label">El Oráculo vuelve a estar disponible</span>';
          document.body.appendChild(el);
          this._msgEl = el;
        }
        SFX.readyChime();
        this._msgEl.classList.remove("shop-restock-msg--visible");
        void this._msgEl.offsetWidth;
        this._msgEl.classList.add("shop-restock-msg--visible");
      },
    });
  },

  // ---------- El Vigilante: niebla fuera 3 s con la cámara alejada ----------
  fireVigilante() {
    if (typeof Fog === "undefined" || !Fog.revealedGrid) return;
    const bv = typeof BoardView !== "undefined" ? BoardView : null;
    const saved = bv ? { s: bv.targetScale, x: bv.targetPanX, y: bv.targetPanY } : null;
    if (bv && bv.viewportEl) {
      // Cámara al máximo alejada y centrada en el mapa.
      bv._zoomAnchor = null;
      bv.targetScale = bv.minScale;
      bv.targetPanX = (bv.viewportEl.clientWidth - bv.contentWidth * bv.targetScale) / 2;
      bv.targetPanY = (bv.viewportEl.clientHeight - bv.contentHeight * bv.targetScale) / 2;
      bv._clampTargetPan();
      bv._startLoop();
    }
    SFX.oracleLift(2);
    setTimeout(() => {
      this._setFogLifted(true);
      SFX.oracleWin();
      setTimeout(() => {
        this._setFogLifted(false);
        if (bv && saved) {
          bv._zoomAnchor = null;
          bv.targetScale = saved.s;
          bv.targetPanX = saved.x;
          bv.targetPanY = saved.y;
          bv._clampTargetPan();
          bv._startLoop();
        }
      }, ORACLE_VIGILANTE_MS);
    }, 900);
  },

  _liftedTiles: [],
  _setFogLifted(on) {
    Fog._lifted = on;
    document.body.classList.toggle("oracle-fog-lifted", on);
    if (typeof TerrainMap !== "undefined" && TerrainMap.liftUnrevealed) TerrainMap.liftUnrevealed(on, Fog.revealedGrid);
    if (typeof TerrainCanvas !== "undefined") TerrainCanvas.refresh();
    if (typeof Fog !== "undefined" && Fog._onLiftChanged) Fog._onLiftChanged(on);
    Fog.applyVisibility();
  },

  // ======================================================================
  // Ventana (misma interfaz que la Tienda Goblin) — ver demo aprobada.
  // ======================================================================
  _active: null,
  _ov: null,
  _ui: null,
  _state: "idle", // idle | picking | flip | busy
  _sel: [],
  _rev: [],
  _holdGray: false,
  _raf: null,

  _gloryIcon() {
    const race = typeof RACES !== "undefined" ? RACES.find((r) => r.id === Teams.raceIds.player) : null;
    return (race && race.gloryIcon) || "";
  },

  openPopup(o) {
    if (this._ov) return;
    if (typeof Net !== "undefined" && Net.active && Net._replaying) return;
    SFX.click();
    this._active = o;
    this._sel = [];
    this._rev = [];
    this._holdGray = false;
    this._state = this._team("player").pending ? "picking" : "idle";
    const icon = this._gloryIcon();
    const imgIcon = icon ? `<img src="${icon}" alt="">` : "";

    const overlay = document.createElement("div");
    overlay.className = "backpack-overlay shop-overlay oracle-overlay";
    overlay.addEventListener("click", () => this.requestClose());
    const panel = document.createElement("div");
    panel.className = "backpack-panel oracle-panel";
    panel.addEventListener("click", (e) => e.stopPropagation());
    panel.innerHTML =
      `<div class="p5-banner backpack-panel__bg">` +
      `<div class="p5-banner__label backpack-panel__title">ORÁCULO</div>` +
      `<div class="or-top">` +
      `<div class="or-cost or-chip"><span class="or-chip__in"><b>${imgIcon}<span class="mn">&minus;</span><span class="or-cost-v"></span></b></span></div>` +
      `<div class="p5-banner or-chip or-have"><span class="p5-banner__label or-chip__in"><b>${imgIcon}<span class="or-glo-v"></span><em>/${GLORY_CAP}</em></b></span></div>` +
      `</div>` +
      `<div class="or-cards"></div>` +
      `<div class="or-hint"></div>` +
      `<button class="p5-banner p5-banner--action shop-buy-btn or-pay"><span class="p5-banner__label">DESVELAR 2 CARTAS</span></button>` +
      `<div class="shop-warning"></div>` +
      `</div>` +
      `<div class="or-gob"><img src="${ORACLE_IMG.goblin}" alt="" draggable="false"></div>` +
      `<div class="or-ball"><div class="or-ball-in"><div class="or-halo"></div><img src="${ORACLE_IMG.bola}" alt="" draggable="false"></div></div>` +
      `<button class="backpack-close-btn" aria-label="Cerrar"><i class="ph ph-x backpack-close-btn__icon"></i></button>`;
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    this._ov = overlay;

    const q = (s) => panel.querySelector(s);
    const ui = (this._ui = {
      panel,
      cards: q(".or-cards"),
      hint: q(".or-hint"),
      pay: q(".or-pay"),
      warn: q(".shop-warning"),
      cost: q(".or-cost-v"),
      glo: q(".or-glo-v"),
      costChip: q(".or-cost"),
      haveChip: q(".or-have"),
      gob: q(".or-gob"),
      ball: q(".or-ball-in"),
      halo: q(".or-halo"),
      els: [],
      hot: 0,
      susp: 0,
      ph: 0,
    });
    ui.pay.addEventListener("click", (e) => {
      e.stopPropagation();
      this._onPay();
    });
    q(".backpack-close-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      this.requestClose();
    });
    this.slots.forEach((s, i) => {
      const d = document.createElement("div");
      d.className = "or-card";
      d.style.setProperty("--d", (3.4 + NR() * 1.4).toFixed(2) + "s");
      d.style.setProperty("--dl", (-NR() * 4).toFixed(2) + "s");
      d.innerHTML =
        `<div class="fw"><div class="in"><div class="f fb"><img src="${ORACLE_IMG.reverso}" alt="" draggable="false"></div>` +
        `<div class="f ff"><img alt="" draggable="false"></div></div></div><div class="tg"></div>`;
      d.addEventListener("click", () => this._pick(i));
      ui.cards.appendChild(d);
      ui.els.push(d);
    });
    this._render();
    this._startFloat();
    requestAnimationFrame(() => overlay.classList.add("backpack-overlay--visible"));
  },

  // La X / el fondo solo cierran con la ventana en reposo (si ya has pagado
  // tienes que elegir tus cartas: así no se puede curiosear gratis).
  requestClose() {
    if (this._state !== "idle") {
      if (this._state === "picking") this._warn("Elige tus 2 cartas antes de salir");
      return;
    }
    SFX.back();
    this.closePopup();
  },

  closePopup(silent) {
    if (!this._ov) return;
    this._stopFloat();
    const el = this._ov;
    this._ov = null;
    this._ui = null;
    this._active = null;
    this._state = "idle";
    el.classList.remove("backpack-overlay--visible");
    setTimeout(() => el.remove(), 220);
    if (!silent && this._queuedVigilante) {
      this._queuedVigilante = false;
      setTimeout(() => this.fireVigilante(), 260);
    } else if (silent) {
      this._queuedVigilante = false;
    }
    this.refreshAll();
  },

  _startFloat() {
    const ui = this._ui;
    let last = performance.now();
    const loop = (t) => {
      if (!this._ui || this._ui !== ui) return;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const c = ORACLE_CFG;
      ui.ph += dt * c.bspeed * (1 + ui.susp * 1.4);
      const ph = ui.ph;
      const pw = ui.panel.clientWidth / 100;
      ui.ball.style.transform = `translateY(${Math.sin(ph * 2) * c.bfloat * pw}px) rotate(${Math.sin(ph * 1.3) * c.bsway}deg) scale(${1 + Math.sin(ph * 3) * 0.025})`;
      ui.halo.style.transform = `scale(${1 + Math.sin(ph * 2.6) * 0.08 + ui.hot * 0.25 + ui.susp * 0.35})`;
      ui.gob.style.transform = `translateY(${Math.sin(ph * 2 - 0.9) * c.gfloat * pw}px) rotate(${Math.sin(ph * 1.3 - 0.9) * c.gfloat * 0.5}deg)`;
      ui.hot *= 0.97;
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  },
  _stopFloat() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  },

  _faceOf(i) {
    const s = this.slots[i];
    if (s.won && s.won !== "player") return "maldicion";
    return s.kind;
  },

  _render() {
    const ui = this._ui;
    if (!ui) return;
    const picking = this._state === "picking";
    this.slots.forEach((s, i) => {
      const d = ui.els[i];
      const mine = s.won === "player";
      const trap = !!s.won && !mine;
      const picked = this._sel.includes(i);
      const up = this._rev.includes(i) || mine || (trap && s.burn);
      d.querySelector(".ff img").src = ORACLE_IMG[this._faceOf(i)];
      d.classList.toggle("up", up);
      d.classList.toggle("gray", mine && !this._holdGray);
      d.classList.toggle("sel", picked);
      d.classList.toggle("burn", trap && s.burn);
      d.querySelector(".tg").textContent = trap && s.burn ? "MALDITA" : "";
      const can = picking && this.selectable("player", i) && !picked;
      d.classList.toggle("can", can);
      d.classList.toggle("dis", !can);
    });
    const T = this._team("player");
    ui.cost.textContent = this.costFor("player");
    ui.glo.textContent = Glory.points.player;
    ui.pay.disabled = this._state !== "idle" || !this.canConsult("player") || T.pending;
    ui.panel.classList.toggle("picking", picking);
    let h = "";
    if (picking) h = `Elige 2 cartas <b>(${this._sel.length}/2)</b>`;
    else if (this._state === "idle") h = T.used && !T.pending ? "Ya has consultado al oráculo este turno" : "";
    if (this._state !== "busy" && this._state !== "flip") ui.hint.innerHTML = h;
  },

  _warn(t) {
    const w = this._ui && this._ui.warn;
    if (!w) return;
    w.textContent = t;
    w.classList.remove("shop-warning--visible");
    void w.offsetWidth;
    w.classList.add("shop-warning--visible");
    setTimeout(() => w && w.classList.remove("shop-warning--visible"), 2200);
  },

  _onPay() {
    if (this._state !== "idle") return;
    const ui = this._ui;
    if (Glory.points.player < this.costFor("player")) {
      SFX.back();
      this._warn("No tienes suficientes Puntos de Gloria");
      return;
    }
    if (typeof Backpack !== "undefined" && !Backpack.hasFreeSlot()) {
      SFX.back();
      this._warn("No tienes espacio en la mochila");
      return;
    }
    if (!this.pay("player")) return;
    SFX.oracleCoin();
    [ui.costChip, ui.haveChip].forEach((c) => {
      c.classList.remove("bump");
      void c.offsetWidth;
      c.classList.add("bump");
    });
    ui.hot = 1;
    this._state = "picking";
    this._sel = [];
    this._rev = [];
    this._render();
  },

  _center(el) {
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  },

  _beats(total, i0, i1) {
    let x = 0;
    while (x < total) {
      const f = x / total;
      const iv = i0 + (i1 - i0) * f;
      setTimeout(() => {
        if (!this._ui) return;
        SFX.oracleBeat(0.6 + f * 0.7);
        this._ui.hot = Math.max(this._ui.hot, 1.3);
      }, x);
      x += iv;
    }
  },

  _ring(x, y, col, size, delay) {
    setTimeout(() => {
      const e = document.createElement("div");
      e.className = "or-ring";
      e.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-color:${col}`;
      document.body.appendChild(e);
      e.animate([{ transform: "scale(.15)", opacity: 0.95 }, { transform: "scale(1)", opacity: 0 }], {
        duration: 900,
        easing: "cubic-bezier(.1,.7,.3,1)",
      }).onfinish = () => e.remove();
    }, delay || 0);
  },

  _spark(x, y, col) {
    const e = document.createElement("div");
    e.className = "or-spark";
    e.style.left = x + "px";
    e.style.top = y + "px";
    e.style.background = col || ["#ffd25a", "#ff9d2e", "#fff", "#c58bff"][(NR() * 4) | 0];
    document.body.appendChild(e);
    const a = NR() * 6.28;
    const d = 60 + NR() * 130;
    e.animate(
      [
        { transform: "translate(0,0) rotate(45deg) scale(1)", opacity: 1 },
        { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) rotate(45deg) scale(.2)`, opacity: 0 },
      ],
      { duration: 800, easing: "ease-out" }
    ).onfinish = () => e.remove();
  },
  _burst(el, n, col) {
    const [x, y] = this._center(el);
    for (let k = 0; k < (n || 16); k++) this._spark(x, y, col);
  },

  _rays(x, y) {
    const e = document.createElement("div");
    e.className = "or-rays";
    e.style.left = x + "px";
    e.style.top = y + "px";
    document.body.appendChild(e);
    e.animate(
      [
        { transform: "translate(-50%,-50%) rotate(0deg) scale(.2)", opacity: 0 },
        { transform: "translate(-50%,-50%) rotate(40deg) scale(1)", opacity: 1, offset: 0.25 },
        { transform: "translate(-50%,-50%) rotate(110deg) scale(1.25)", opacity: 0 },
      ],
      { duration: 1900, easing: "ease-out" }
    ).onfinish = () => e.remove();
  },

  _fx(id) {
    let e = document.getElementById(id);
    if (!e) {
      e = document.createElement("div");
      e.id = id;
      document.body.appendChild(e);
    }
    return e;
  },
  _flash() {
    this._fx("or-flash").animate([{ opacity: 0 }, { opacity: 0.65, offset: 0.12 }, { opacity: 0 }], { duration: 650 });
  },
  _toast(t, d, red) {
    let e = document.getElementById("or-toast");
    if (!e) {
      e = document.createElement("div");
      e.id = "or-toast";
      e.className = "or-toast";
      e.innerHTML = "<div><span class='or-toast__t'></span><small class='or-toast__d'></small></div>";
      document.body.appendChild(e);
    }
    e.querySelector(".or-toast__t").textContent = t;
    e.querySelector(".or-toast__d").textContent = d || "";
    e.classList.toggle("red", !!red);
    e.classList.remove("on");
    void e.offsetWidth;
    e.classList.add("on");
  },

  // ---------- Elegir y destapar ----------
  _pick(i) {
    const ui = this._ui;
    if (!ui || this._state !== "picking") return;
    if (this._sel.includes(i) || !this.selectable("player", i)) return;
    this._sel.push(i);
    this._state = "flip";
    const n = this._sel.length;
    const d = ui.els[i];
    const A = n === 1 ? 800 : 1700;
    d.style.setProperty("--ad", A + "ms");
    d.classList.add("ant");
    if (n === 2) d.classList.add("ant2");
    SFX.oracleLift(n);
    this._render();
    ui.hot = n;
    ui.susp = n === 1 ? 0.6 : 1;
    if (n === 2) {
      this._beats(A, 640, 260);
      const [cx, cy] = this._center(d);
      [0.3, 0.55, 0.78].forEach((f, k) => this._ring(cx, cy, "#ffcf3f", 150 + k * 40, A * f));
    }
    setTimeout(() => {
      if (!this._ui) return;
      d.classList.remove("ant", "ant2");
      this._rev.push(i);
      ui.susp = 0;
      SFX.oracleFlip();
      this._render();
      setTimeout(() => {
        if (!this._ui) return;
        if (this._sel.length === 2) {
          this._state = "busy";
          this._render();
          this._suspense();
        } else {
          this._state = "picking";
          this._render();
        }
      }, 700);
    }, A);
  },

  _suspense() {
    const ui = this._ui;
    const [a, b] = this._sel;
    ui.susp = 1;
    ui.cards.classList.add("focus");
    [a, b].forEach((i) => ui.els[i].classList.add("breath"));
    ui.hint.textContent = "...";
    const T = 1500;
    this._beats(T, 420, 200);
    const [c1, c2] = [this._center(ui.els[a]), this._center(ui.els[b])];
    const mx = (c1[0] + c2[0]) / 2;
    const my = (c1[1] + c2[1]) / 2;
    [0.2, 0.5, 0.8].forEach((f) => this._ring(mx, my, "#fff3b0", 260, T * f));
    setTimeout(() => {
      if (!this._ui) return;
      ui.susp = 0;
      ui.cards.classList.remove("focus");
      [a, b].forEach((i) => ui.els[i].classList.remove("breath"));
      this._verdict();
    }, T);
  },

  _verdict() {
    const ui = this._ui;
    const [a, b] = this._sel;
    const out = this.resolve("player", a, b);
    const idle = () => {
      this._sel = [];
      this._rev = [];
      this._state = "idle";
      this._holdGray = false;
      this._render();
    };
    if (out.res === "curse") {
      out.trap.forEach((i) => {
        ui.els[i].classList.add("curs");
        this._burst(ui.els[i], 18, "#ff3040");
      });
      SFX.oracleCurse();
      const v = this._fx("or-vign");
      v.classList.add("on");
      setTimeout(() => v.classList.remove("on"), 500);
      ui.panel.classList.remove("shake");
      void ui.panel.offsetWidth;
      ui.panel.classList.add("shake");
      this._toast("¡MALDICIÓN!", "Quien la descubre queda un turno sin consultar al oráculo", true);
      // Las cartas malditas quedan boca arriba (burn); la otra se vuelve a tapar.
      setTimeout(() => {
        if (!this._ui) return;
        idle();
        this.requestCloseAfterCurse();
      }, 1500);
      return;
    }
    if (out.res === "win") {
      this._holdGray = true;
      [a, b].forEach((i) => {
        ui.els[i].classList.add("win");
        this._burst(ui.els[i], 34);
      });
      ui.hot = 5;
      SFX.oracleWin();
      this._flash();
      const [c1, c2] = [this._center(ui.els[a]), this._center(ui.els[b])];
      const mx = (c1[0] + c2[0]) / 2;
      const my = (c1[1] + c2[1]) / 2;
      this._rays(mx, my);
      this._ring(mx, my, "#ffffff", 420, 0);
      this._ring(mx, my, "#ffcf3f", 560, 160);
      this._ring(mx, my, "#ff9d2e", 700, 320);
      ui.panel.classList.remove("pop");
      void ui.panel.offsetWidth;
      ui.panel.classList.add("pop");
      const info = ORACLE_INFO[out.kind];
      this._toast("¡" + info.n.toUpperCase() + "!", out.kind === "vigilante" ? "Se activará al cerrar el oráculo" : "Va a tu mochila", false);
      setTimeout(() => this._flyToBag(out.kind, a), 1700);
      return;
    }
    // Fallo: rápido y sin florituras.
    SFX.oracleFail();
    [a, b].forEach((i) => ui.els[i].classList.add("miss"));
    setTimeout(() => {
      if (!this._ui) return;
      [a, b].forEach((i) => ui.els[i].classList.remove("miss"));
      idle();
      ui.hint.innerHTML = "Memoriza lo que has visto";
    }, 420);
  },

  // Tras una maldición la casa queda cerrada para ti: se cierra la ventana.
  requestCloseAfterCurse() {
    SFX.back();
    this.closePopup();
  },

  _flyToBag(kind, idx) {
    const ui = this._ui;
    if (!ui) return;
    SFX.oracleToBag();
    const btn = document.querySelector(".backpack-btn");
    const src = ui.els[idx];
    const r = src.getBoundingClientRect();
    const finish = () => {
      if (kind === "vigilante") this._queuedVigilante = true;
      this._sel = [];
      this._rev = [];
      this._state = "idle";
      this._holdGray = false;
      if (this._ui) {
        this._render();
        this._ui.hint.innerHTML = `<b>${ORACLE_INFO[kind].n}</b> ${kind === "vigilante" ? "listo: se activa al cerrar" : "añadido a tu mochila"}`;
      }
      if (this.depleted()) setTimeout(() => this.requestClose(), 1300);
      if (btn) {
        btn.classList.remove("or-bpbump");
        void btn.offsetWidth;
        btn.classList.add("or-bpbump");
        this._burst(btn, 14);
      }
    };
    if (!btn) return finish();
    const b = btn.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (r.left + r.width / 2);
    const dy = b.top + b.height / 2 - (r.top + r.height * 0.5);
    const f = document.createElement("div");
    f.className = "or-fly";
    f.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px`;
    f.innerHTML = `<img src="${ORACLE_IMG[kind]}" alt="">`;
    document.body.appendChild(f);
    src.style.visibility = "hidden";
    f.animate(
      [
        { transform: "translate(0,0) scale(1)", offset: 0 },
        { transform: "translate(0,-24px) scale(1.12,.92)", offset: 0.18 },
        { transform: `translate(${dx * 0.7}px,${dy * 0.7 - 60}px) scale(.6,.8) rotate(-12deg)`, offset: 0.7 },
        { transform: `translate(${dx}px,${dy}px) scale(.12) rotate(-30deg)`, opacity: 0.9, offset: 1 },
      ],
      { duration: 850, easing: "cubic-bezier(.5,0,.7,.6)", fill: "forwards" }
    ).onfinish = () => {
      f.remove();
      src.style.visibility = "";
      finish();
    };
  },

  // ---------- Diagnóstico multijugador ----------
  slotsStr() {
    return this.slots.map((s) => s.kind[0] + (s.won ? Net.canon(s.won) : "-") + (s.burn ? "x" : "")).join(",");
  },
  teamStr(team) {
    const T = this._team(team);
    return [T.attempts, T.used ? 1 : 0, T.lock, JSON.stringify(this._perk(team))].join("|");
  },
};

Units.registerRangeProvider(Oracle);
if (typeof Turns !== "undefined") Turns.registerTurnStartListener(Oracle);

/* Gnomore Gnomes — Armería (mejoras de ataque/aguante con recursos).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Llevar cuántos niveles de Arma y de Armadura ha comprado cada equipo
       (0 a 3 cada una) y cuánto suman de bonus a Fuerza/Aguante — consultado
       por combat.js/obelisks.js/gnome.js (daño) y units.js/abilities.js/
       backpack.js (vida máxima) vía Armory.attackBonus/defenseBonus.
     - Su propia interfaz: un popup abierto desde el Obelisco (mismo
       lenguaje visual que la Tienda Goblin/mochila) con dos "árboles de
       nodos" horizontales (Arma y Armadura), 3 niveles cada uno, que se
       compran EN ORDEN pagando con los recursos de js/resources.js.
     - Aplicar el bonus de Aguante recién comprado a las unidades YA
       reclutadas (las nuevas ya nacen con él, ver Units.spawnUnit).

   Pedido explícito (verbatim): "Añadimos icono de la armeria, en la armeria
   el jugador puede aumentar su ataque y aguante base de todas sus unidades
   (de momento solo eso). Habran 3 niveles distintos para Armadura y Armas.
   En esta interfaz con el mismo estilo visual que la de la tienda goblin y
   las demas que ya hemos implementado, apareceran en horizontal los 3
   niveles de cada cosa ordenados de izquierda a derecha y el usuario podra
   usar los recursos a modo de moneda para conseguir subir de nivel las
   habilidades, que estan bloqueadaas entre si...la primera que debe
   comprarse esla de nivel 1, hasta que eso no se ahga no se desbloqueara la
   compra de nivel 2, etc. Si con alguna de estas mejoras, las estadisticas
   de un personaje superase el maximo visualmente permitido de los
   personajes, esto se indicara con un +x en la derecha de la barra
   correspondiente. Las estadisticas que aumenten los huecos de la barra de
   estadisticas de un personaje gracias a mejoras de la armeria deben
   mostrarse de color amarillo." + "para nivel 1 hace falta un recurso de
   madera y otro de roca. Para nivel 2 dos de madera dos de roca y uno de
   metal. y para nivel 3 tres de madera, tres de roca y dos de metal." + "un
   boton MEJORAR aceptara la mejora...los iconos aparecieran conectados por
   una linea amarilla como en un arbol de nodos...Cuando no, esta de color
   gris apagado." + "añadisos los iconos para la interrfaz de la armeria con
   este formato 'armeria_armadura_lvlX' y 'armeria_arma_lvlX'". */

const ARMORY_MAX_LEVEL = 3;

// Coste ACUMULADO por nivel (índice 0 = nivel 1, etc.) — mismo coste para
// Arma y Armadura, pedido explícito con una única fórmula.
const ARMORY_LEVEL_COST = [
  { madera: 1, roca: 1, metal: 0 },
  { madera: 2, roca: 2, metal: 1 },
  { madera: 3, roca: 3, metal: 2 },
];

const ARMORY_ICONS = {
  arma: [
    "assets/iconos/armeria_arma_lvl1.png",
    "assets/iconos/armeria_arma_lvl2.png",
    "assets/iconos/armeria_arma_lvl3.png",
  ],
  armadura: [
    "assets/iconos/armeria_armadura_lvl1.png",
    "assets/iconos/armeria_armadura_lvl2.png",
    "assets/iconos/armeria_armadura_lvl3.png",
  ],
};

const ARMORY_TRACK_LABELS = { arma: "ARMA", armadura: "ARMADURA" };

const Armory = {
  state: { player: { arma: 0, armadura: 0 }, enemy: { arma: 0, armadura: 0 } },

  // uid de nodo seleccionado ahora mismo en el popup ("arma-2", "armadura-1"...)
  _selected: null,

  _overlayEl: null,
  _obelisk: null,
  _descEl: null,
  _upgradeBtnEl: null,
  _warningEl: null,
  _trackEls: { arma: null, armadura: null },

  resetAll() {
    this.state = { player: { arma: 0, armadura: 0 }, enemy: { arma: 0, armadura: 0 } };
    this._selected = null;
    this.closePopup();
  },

  attackBonus(team) {
    return (this.state[team] && this.state[team].arma) || 0;
  },

  defenseBonus(team) {
    return (this.state[team] && this.state[team].armadura) || 0;
  },

  // ---------- Popup ----------
  openPopup(obelisk) {
    if (this._overlayEl) return;
    if (typeof Turns !== "undefined" && Turns.activeTeam !== obelisk.team) return;
    SFX.click();
    this._obelisk = obelisk;
    this._selected = null;

    const overlay = document.createElement("div");
    overlay.className = "backpack-overlay";
    overlay.addEventListener("click", () => this.closePopup());

    const panel = document.createElement("div");
    panel.className = "backpack-panel armory-panel";
    panel.addEventListener("click", (e) => e.stopPropagation());

    const panelBg = document.createElement("div");
    panelBg.className = "p5-banner backpack-panel__bg";
    panel.appendChild(panelBg);

    const closeBtn = document.createElement("button");
    closeBtn.className = "backpack-close-btn";
    closeBtn.setAttribute("aria-label", "Cerrar");
    closeBtn.innerHTML = '<i class="ph ph-x backpack-close-btn__icon"></i>';
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.closePopup();
    });
    panel.appendChild(closeBtn);

    const title = document.createElement("div");
    title.className = "p5-banner__label backpack-panel__title";
    title.textContent = "ARMERÍA";
    panelBg.appendChild(title);

    // "TODOS los recursos, son stackeables y se mostrara la cantidad de
    // cada uno con una etiqueta igual que la que muestra los puntos de
    // gloria" — misma fila de existencias que Backpack.refreshResourceBadges
    // pinta en la mochila, reutilizada aquí tal cual para que el jugador
    // vea de un vistazo con cuánto cuenta mientras decide qué mejorar.
    const resourceRow = document.createElement("div");
    resourceRow.className = "armory-resource-row";
    if (typeof Backpack !== "undefined") Backpack.buildResourceBadges(resourceRow);
    panelBg.appendChild(resourceRow);
    this._resourceRowEl = resourceRow;

    const tracksWrap = document.createElement("div");
    tracksWrap.className = "armory-tracks";
    panelBg.appendChild(tracksWrap);

    ["arma", "armadura"].forEach((kind) => {
      const track = document.createElement("div");
      track.className = "armory-track";

      const label = document.createElement("div");
      label.className = "armory-track__label";
      label.textContent = ARMORY_TRACK_LABELS[kind];
      track.appendChild(label);

      const nodesEl = document.createElement("div");
      nodesEl.className = "armory-track__nodes";
      track.appendChild(nodesEl);
      this._trackEls[kind] = nodesEl;

      tracksWrap.appendChild(track);
    });

    const desc = document.createElement("div");
    desc.className = "backpack-desc";
    desc.innerHTML = '<p class="backpack-desc__text"></p>';
    panelBg.appendChild(desc);
    this._descEl = desc.querySelector(".backpack-desc__text");

    const upgradeBtn = document.createElement("button");
    upgradeBtn.className = "p5-banner p5-banner--action shop-buy-btn";
    upgradeBtn.innerHTML = '<span class="p5-banner__label">MEJORAR</span>';
    upgradeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._tryUpgrade();
    });
    panelBg.appendChild(upgradeBtn);
    this._upgradeBtnEl = upgradeBtn;

    const warning = document.createElement("div");
    warning.className = "shop-warning";
    warning.textContent = "No tienes suficientes recursos";
    panelBg.appendChild(warning);
    this._warningEl = warning;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    this._overlayEl = overlay;

    this._renderTracks();
    requestAnimationFrame(() => overlay.classList.add("backpack-overlay--visible"));
  },

  closePopup() {
    if (!this._overlayEl) return;
    const el = this._overlayEl;
    this._overlayEl = null;
    this._obelisk = null;
    this._descEl = null;
    this._upgradeBtnEl = null;
    this._warningEl = null;
    this._resourceRowEl = null;
    this._trackEls = { arma: null, armadura: null };
    this._selected = null;
    el.classList.remove("backpack-overlay--visible");
    setTimeout(() => el.remove(), 220);
  },

  // Nivel comprado (0-3) para `team`/`kind`.
  _levelOf(team, kind) {
    return (this.state[team] && this.state[team][kind]) || 0;
  },

  _renderTracks() {
    if (!this._overlayEl || !this._obelisk) return;
    const team = this._obelisk.team;
    ["arma", "armadura"].forEach((kind) => this._renderTrack(kind, team));
    this._updateDescAndButton();
  },

  // "apareceran en horizontal los 3 niveles de cada cosa...bloqueadaas
  // entre si...la primera que debe comprarse es la de nivel 1, hasta que
  // eso no se haga no se desbloqueara la compra de nivel 2" + "los iconos
  // aparecieran conectados por una linea amarilla...cuando no, esta de
  // color gris apagado".
  _renderTrack(kind, team) {
    const nodesEl = this._trackEls[kind];
    if (!nodesEl) return;
    nodesEl.innerHTML = "";
    const owned = this._levelOf(team, kind);

    for (let lvl = 1; lvl <= ARMORY_MAX_LEVEL; lvl++) {
      if (lvl > 1) {
        const link = document.createElement("div");
        // El tramo entre el nivel (lvl-1) y este está "desbloqueado" (amarillo)
        // solo si el nivel anterior ya se compró.
        link.className = "armory-link" + (owned >= lvl - 1 ? " armory-link--unlocked" : "");
        nodesEl.appendChild(link);
      }

      const uid = `${kind}-${lvl}`;
      const nodeEl = document.createElement("button");
      const boughtAlready = lvl <= owned;
      const isNext = lvl === owned + 1;
      nodeEl.className =
        "armory-node" +
        (boughtAlready ? " armory-node--owned" : "") +
        (isNext ? " armory-node--next" : "") +
        (!boughtAlready && !isNext ? " armory-node--locked" : "") +
        (this._selected === uid ? " armory-node--selected" : "");
      nodeEl.innerHTML = `<img src="${ARMORY_ICONS[kind][lvl - 1]}" class="armory-node__icon" alt="">`;
      // Solo el propio nodo comprado o el siguiente disponible se pueden
      // seleccionar (ver descripción) — uno todavía bloqueado más allá del
      // siguiente no muestra nada nuevo, "bloqueadas entre sí".
      if (boughtAlready || isNext) {
        nodeEl.addEventListener("click", (e) => {
          e.stopPropagation();
          SFX.click();
          this._selected = this._selected === uid ? null : uid;
          this._renderTracks();
        });
      } else {
        nodeEl.disabled = true;
      }
      nodesEl.appendChild(nodeEl);
    }
  },

  _describeLevel(kind, lvl) {
    const cost = ARMORY_LEVEL_COST[lvl - 1];
    const parts = [];
    if (cost.madera) parts.push(`${cost.madera} de madera`);
    if (cost.roca) parts.push(`${cost.roca} de roca`);
    if (cost.metal) parts.push(`${cost.metal} de metal`);
    const statLabel = kind === "arma" ? "Fuerza" : "Aguante";
    return `Nivel ${lvl} de ${ARMORY_TRACK_LABELS[kind]}: +${lvl} ${statLabel} acumulado. Cuesta ${parts.join(", ")}.`;
  },

  _updateDescAndButton() {
    if (this._warningEl) this._warningEl.classList.remove("shop-warning--visible");
    if (!this._descEl || !this._upgradeBtnEl) return;
    if (!this._selected) {
      this._descEl.textContent = "";
      this._upgradeBtnEl.disabled = true;
      this._upgradeBtnEl.classList.remove("shop-buy-btn--active");
      return;
    }
    const [kind, lvlStr] = this._selected.split("-");
    const lvl = Number(lvlStr);
    const team = this._obelisk.team;
    const owned = this._levelOf(team, kind);
    this._descEl.textContent = this._describeLevel(kind, lvl);

    // Solo el SIGUIENTE nivel por comprar activa el botón MEJORAR — mirar
    // uno ya comprado es solo consulta.
    const canBuy = lvl === owned + 1;
    this._upgradeBtnEl.disabled = !canBuy;
    this._upgradeBtnEl.classList.toggle("shop-buy-btn--active", canBuy);
  },

  _tryUpgrade() {
    if (!this._selected || !this._obelisk) return;
    const [kind, lvlStr] = this._selected.split("-");
    const lvl = Number(lvlStr);
    const team = this._obelisk.team;
    const owned = this._levelOf(team, kind);
    if (lvl !== owned + 1) return;

    const cost = ARMORY_LEVEL_COST[lvl - 1];
    const counts = typeof Resources !== "undefined" ? Resources.counts : { madera: 0, roca: 0, metal: 0 };
    const affordable =
      (counts.madera || 0) >= cost.madera && (counts.roca || 0) >= cost.roca && (counts.metal || 0) >= cost.metal;

    if (!affordable) {
      SFX.back();
      if (this._warningEl) {
        this._warningEl.classList.remove("shop-warning--visible");
        void this._warningEl.offsetWidth;
        this._warningEl.classList.add("shop-warning--visible");
      }
      return;
    }

    counts.madera -= cost.madera;
    counts.roca -= cost.roca;
    counts.metal -= cost.metal;
    if (typeof Backpack !== "undefined" && Backpack.refreshResourceBadges) Backpack.refreshResourceBadges();

    this.state[team][kind] = lvl;
    SFX.itemEaten();

    // La Armadura sube el AGUANTE de todas las unidades ya en juego de este
    // equipo, no solo las que se recluten después (pedido explícito: "de
    // todas sus unidades") — el Arma no necesita nada más aquí: su bonus se
    // lee en caliente en cada golpe (ver combat.js/obelisks.js/gnome.js).
    if (kind === "armadura") this.applyDefenseBonusToTeam(team);

    this._selected = `${kind}-${lvl}`;
    this._renderTracks();
  },

  // Sube hpSegmentEls (crea los huecos nuevos de barra que hagan falta) y
  // cura la diferencia — mismo patrón "quitar/forzar reflow/volver a poner"
  // que el resto del proyecto para el pop elástico del segmento nuevo.
  applyDefenseBonusToTeam(team) {
    if (typeof Units === "undefined") return;
    const bonus = this.defenseBonus(team);
    Units.list
      .filter((u) => u.team === team)
      .forEach((unit) => {
        const type = UNIT_TYPES[unit.typeId];
        const newMax = type.aguante + bonus;
        const delta = newMax - unit.maxHp;
        if (delta <= 0) return;
        for (let i = 0; i < delta; i++) {
          const seg = document.createElement("div");
          seg.className = "unit__hpbar-segment";
          unit.hpBarEl.appendChild(seg);
          unit.hpSegmentEls.push(seg);
        }
        unit.maxHp = newMax;
        unit.hp += delta;
        Units.updateHpBar(unit);
      });
  },
};

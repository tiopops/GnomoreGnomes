/* Gnomore Gnomes — modo CAMPAÑA (esqueleto jugable).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - El estado de la campaña (capítulos hechos, gnomos y puntos acumulados, mejoras compradas),
       guardado en localStorage por cuenta (gg_campaign_<uid>).
     - La pantalla del mapa de capítulos (bloqueado / disponible / hecho) y la tienda de mejoras.
     - La intro narrada por Nizak al empezar cada capítulo.
     - La partida de campaña: extracción de gnomos. El motor normal solo le avisa mediante ganchos
       mínimos protegidos por `Campaign.active` (ver units.js, obelisks.js, gnome.js, armory.js,
       newgame-flow.js, matchcleanup.js). Sin Campaña activa nada de esto cambia el juego normal.

   Pedido explícito (resumen): conseguir X gnomos por nivel "como en el último Splatoon"; gnomos en
   jaulas vigiladas por neutrales o en campamentos; los neutrales usan los sprites de WallForge;
   puntos por matar neutrales o entregar gnomos (1 a 1); el Obelisco solo es la zona de extracción
   (sin habilidades ni armería ni tótems ni obelisco enemigo) y un icono a la derecha de "reclutar"
   termina la partida con lo conseguido; mejoras exclusivas de campaña comprables en el mapa;
   capítulos 1-5 con candados y requisitos crecientes; cada capítulo más difícil.
   PENDIENTE (siguientes entregas): barra de experiencia y niveles de unidad, sincronizar en la nube,
   GnomOgro (capítulo 5), mapas propios de cada fase. */

const CAMPAIGN_CHAPTERS = [
  { n: 1, levelId: "mushboom_forest", img: "assets/niveles/isla_mushboom_forest.png", goal: 3, req: { gnomes: 0, points: 0 },
    camps: 2, guards: [1, 1], cages: 2, pool: ["magonifico", "trazaflechas"], aggro: 4 },
  { n: 2, levelId: "colinas_rockntroll", img: "assets/niveles/isla_colinas_rockntroll.png", goal: 4, req: { gnomes: 3, points: 12 },
    camps: 3, guards: [1, 2], cages: 2, pool: ["magonifico", "trazaflechas", "portamuros"], aggro: 5 },
  { n: 3, levelId: "hurrycrane_village", img: "assets/niveles/isla_hurrycrane_village.png", goal: 5, req: { gnomes: 8, points: 40 },
    camps: 4, guards: [2, 2], cages: 2, pool: ["trazaflechas", "portamuros", "magonifico"], aggro: 5 },
  { n: 4, levelId: "wallforge", img: "assets/niveles/isla_wallforge.png", goal: 6, req: { gnomes: 15, points: 90 },
    camps: 5, guards: [2, 3], cages: 2, pool: ["portamuros", "trazaflechas", "magonifico"], aggro: 6 },
  { n: 5, levelId: "mushboom_forest", img: null, boss: true, goal: 1, req: { gnomes: 24, points: 170 } },
];

// Mejoras exclusivas de campaña (se compran en el mapa con los puntos acumulados).
const CAMPAIGN_UPGRADES = [
  { id: "prov", icon: "ph-basket", max: 3, cost: [10, 20, 35] },
  { id: "arma", icon: "ph-sword", max: 2, cost: [25, 60] },
  { id: "armadura", icon: "ph-shield", max: 2, cost: [25, 60] },
];

const CAMPAIGN_REWARD = { kill: { magonifico: 2, trazaflechas: 2, portamuros: 4 }, deliver: 3 };
const CAMPAIGN_START_GLORY = 4; // + mejora "Provisiones" (+2 por nivel)

(function registerCampaignStrings() {
  const es = {
    menu_campaign: "Campaña", cmp_title: "CAMPAÑA", cmp_gnomes: "GNOMOS", cmp_points: "PUNTOS", cmp_goal: "Rescata {n} gnomos y llévalos al Obelisco.",
    cmp_play: "JUGAR", cmp_soon: "PRÓXIMAMENTE", cmp_locked: "BLOQUEADO", cmp_done: "COMPLETADO", cmp_chapter: "CAPÍTULO {n}",
    cmp_need: "Necesitas {g} gnomos y {p} puntos acumulados (tienes {hg} y {hp}).", cmp_need_prev: "Completa el capítulo anterior.",
    cmp_boss: "El GnomOgro te espera... pero aún no está listo.", cmp_shop: "MEJORAS DE CAMPAÑA", cmp_buy: "COMPRAR", cmp_max: "AL MÁXIMO",
    cmp_up_prov: "Provisiones", cmp_up_prov_d: "Empiezas cada nivel con +2 Puntos de Gloria por nivel de mejora.",
    cmp_up_arma: "Garrotes afilados", cmp_up_arma_d: "+1 de ataque a todas tus unidades.",
    cmp_up_armadura: "Cortezas duras", cmp_up_armadura_d: "+1 de aguante a todas tus unidades.",
    cmp_hud: "{a}/{b}", cmp_extract: "Extraer", cmp_extract_q: "¿EXTRAER Y TERMINAR?", cmp_extract_info: "Te llevas lo conseguido hasta ahora.",
    cmp_yes: "EXTRAER", cmp_no: "SEGUIR", cmp_res_ok: "¡CAPÍTULO SUPERADO!", cmp_res_part: "EXTRACCIÓN COMPLETADA", cmp_res_fail: "HAS CAÍDO",
    cmp_res_g: "Gnomos extraídos", cmp_res_p: "Puntos obtenidos", cmp_res_k: "Neutrales derrotados", cmp_res_goal: "Objetivo: {n} gnomos",
    cmp_back_map: "VOLVER AL MAPA", cmp_free: "¡GNOMOS LIBRES!", cmp_delivered: "+1 GNOMO", cmp_continue: "Toca para continuar", cmp_next: "CONTINUAR",
    cmp_ch1: "Capítulo 1 · Bosque MushBoom", cmp_ch2: "Capítulo 2 · Colinas Rock'n Troll", cmp_ch3: "Capítulo 3 · Poblado HurryCrane", cmp_ch4: "Capítulo 4 · WallForge", cmp_ch5: "Capítulo 5 · El GnomOgro",
    cmp_intro1: "Hubo un tiempo en que todo el reino de Gnomoria era feliz. Las razas vivían en guerra —ironías de la vida— matándose y torturándose sin problemas ni preocupaciones. Hasta que aparecieron ELLOS: los gnomos, con sus arcoíris y sus chuches sin gluten y bajas en azúcar, empeñados en mediar para conseguir la paz. ¡Están locos! ¡No se lo permitiremos! Guardabosques, reunid gnomos en el Bosque MushBoom.",
    cmp_intro2: "Los gnomos se extienden como una plaga de purpurina. Hasta en las Colinas Rock'n Troll se oyen sus cantos de hermandad por encima de los tambores. Esto es intolerable. Rescatad a los que están enjaulados antes de que sigan predicando la paz.",
    cmp_intro3: "En el Poblado HurryCrane hasta las grullas parecen conversar en lugar de picotearse. Algo huele a concordia, y ese olor nos revuelve el estómago. Traedme más gnomos: hay que saber dónde se esconden.",
    cmp_intro4: "WallForge, las murallas de la discordia. Sus soldados vigilan campamentos y jaulas por pura costumbre... y por un buen sueldo. Entrad, sacad a los gnomos y que nadie hable de abrazos.",
    cmp_intro5: "Se acerca el GnomOgro. Pero eso, mis queridos guardabosques, es otra historia.",
    cmp_nizak: "Nizak",
  };
  const en = {
    menu_campaign: "Campaign", cmp_title: "CAMPAIGN", cmp_gnomes: "GNOMES", cmp_points: "POINTS", cmp_goal: "Rescue {n} gnomes and bring them to the Obelisk.",
    cmp_play: "PLAY", cmp_soon: "COMING SOON", cmp_locked: "LOCKED", cmp_done: "COMPLETED", cmp_chapter: "CHAPTER {n}",
    cmp_need: "You need {g} gnomes and {p} total points (you have {hg} and {hp}).", cmp_need_prev: "Complete the previous chapter.",
    cmp_boss: "The GnomOgre awaits... but it isn't ready yet.", cmp_shop: "CAMPAIGN UPGRADES", cmp_buy: "BUY", cmp_max: "MAXED",
    cmp_up_prov: "Provisions", cmp_up_prov_d: "Start every level with +2 Glory Points per upgrade level.",
    cmp_up_arma: "Sharpened clubs", cmp_up_arma_d: "+1 attack for all your units.",
    cmp_up_armadura: "Hardened bark", cmp_up_armadura_d: "+1 toughness for all your units.",
    cmp_hud: "{a}/{b}", cmp_extract: "Extract", cmp_extract_q: "EXTRACT AND FINISH?", cmp_extract_info: "You keep what you've gathered so far.",
    cmp_yes: "EXTRACT", cmp_no: "KEEP GOING", cmp_res_ok: "CHAPTER CLEARED!", cmp_res_part: "EXTRACTION COMPLETE", cmp_res_fail: "YOU HAVE FALLEN",
    cmp_res_g: "Gnomes extracted", cmp_res_p: "Points earned", cmp_res_k: "Neutrals defeated", cmp_res_goal: "Goal: {n} gnomes",
    cmp_back_map: "BACK TO THE MAP", cmp_free: "GNOMES FREED!", cmp_delivered: "+1 GNOME", cmp_continue: "Tap to continue", cmp_next: "CONTINUE",
    cmp_ch1: "Chapter 1 · MushBoom Forest", cmp_ch2: "Chapter 2 · Rock'n Troll Hills", cmp_ch3: "Chapter 3 · HurryCrane Village", cmp_ch4: "Chapter 4 · WallForge", cmp_ch5: "Chapter 5 · The GnomOgre",
    cmp_intro1: "There was a time when the whole kingdom of Gnomoria was happy. The races lived at war — the irony! — killing and torturing each other without a care in the world. Until THEY showed up: the gnomes, with their rainbows and their gluten-free, low-sugar candy, set on mediating peace. They're mad! We won't allow it! Forest Rangers, gather gnomes in MushBoom Forest.",
    cmp_intro2: "The gnomes spread like a plague of glitter. Even in the Rock'n Troll Hills their songs of brotherhood rise above the drums. This is intolerable. Rescue the caged ones before they keep preaching peace.",
    cmp_intro3: "In HurryCrane Village even the cranes seem to chat instead of pecking at each other. Something smells of harmony, and it turns my stomach. Bring me more gnomes: we must learn where they hide.",
    cmp_intro4: "WallForge, the walls of discord. Its soldiers guard camps and cages out of habit... and for good pay. Go in, get the gnomes out, and let nobody mention hugs.",
    cmp_intro5: "The GnomOgre approaches. But that, my dear rangers, is another story.",
    cmp_nizak: "Nizak",
  };
  Object.assign(STRINGS.es, es);
  Object.assign(STRINGS.en, en);
})();

const Campaign = {
  active: false,
  run: null,
  s: null, // progreso guardado
  sel: 1, // capítulo seleccionado en el mapa
  _uid: null,
  _hud: null,
  _camps: [],

  t(k, v) { return I18N.t(k, v); },
  _sleep(ms) { return new Promise((r) => setTimeout(r, ms)); },
  ch(n) { return CAMPAIGN_CHAPTERS.find((c) => c.n === n); },

  // ---------- Progreso ----------
  _key() { return "gg_campaign_" + (this._uid || "guest"); },
  _defaults() { return { v: 1, gnomes: 0, points: 0, earnedPoints: 0, done: {}, up: {} }; },
  load() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(this._key()) || "null"); } catch (e) {}
    this.s = Object.assign(this._defaults(), raw && typeof raw === "object" ? raw : {});
    this.s.done = this.s.done || {};
    this.s.up = this.s.up || {};
  },
  persist() { try { localStorage.setItem(this._key(), JSON.stringify(this.s)); } catch (e) {} },
  upLevel(id) { return (this.s && this.s.up[id]) || 0; },
  bonus(id) { return this.active && this.s ? this.upLevel(id) : 0; },

  unlocked(n) {
    if (n === 1) return true;
    const c = this.ch(n);
    return !!(this.s.done[n - 1] && this.s.gnomes >= c.req.gnomes && this.s.earnedPoints >= c.req.points);
  },

  // ---------- Arranque ----------
  init() {
    document.addEventListener("gg:authchange", (e) => {
      this._uid = e.detail && e.detail.user ? e.detail.user.uid : null;
      this.load();
      this.render();
    });
    this.load();
    const btn = document.getElementById("btn-campaign");
    if (btn) btn.addEventListener("click", () => {
      if (typeof SFX !== "undefined" && SFX.click) SFX.click();
      this.render();
      goToScreen("screen-campaign");
    });
    if (typeof Turns !== "undefined") Turns.registerTurnStartListener(this);
    document.addEventListener("gg:langchange", () => { this.render(); this._refreshHud(); });
  },

  // El turno del jugador acaba: los neutrales reaccionan (Turns espera a esta promesa).
  async onTurnEnd(team) {
    if (!this.active || team !== "player" || !this.run || this.run.over) return;
    await this.neutralTurn();
    this._checkStuck();
  },

  // ---------- Pantalla del mapa ----------
  render() {
    const root = document.getElementById("camp-root");
    if (!root || !this.s) return;
    const t = (k, v) => this.t(k, v);
    const sel = this.ch(this.sel) || this.ch(1);
    const nodes = CAMPAIGN_CHAPTERS.map((c, i) => {
      const un = this.unlocked(c.n), done = !!this.s.done[c.n];
      const cls = ["camp-node", un ? "camp-node--open" : "camp-node--locked", done ? "camp-node--done" : "", c.n === sel.n ? "camp-node--sel" : ""].join(" ");
      const img = c.img ? `<img class="camp-node__img" src="${c.img}" alt="">` : `<i class="ph-fill ph-skull camp-node__skull"></i>`;
      const badge = !un ? `<i class="ph-fill ph-lock-simple camp-node__badge"></i>` : done ? `<i class="ph-fill ph-check-circle camp-node__badge camp-node__badge--ok"></i>` : "";
      return `<button type="button" class="${cls}" data-n="${c.n}" style="--i:${i}">${img}${badge}<span class="camp-node__n">${c.n}</span></button>`;
    }).join('<i class="camp-link"></i>');

    let status, action;
    if (sel.boss) { status = t("cmp_boss"); action = `<button class="p5-banner p5-banner--action camp-play" disabled><span class="p5-banner__label">${t("cmp_soon")}</span></button>`; }
    else if (!this.unlocked(sel.n)) {
      status = this.s.done[sel.n - 1] ? t("cmp_need", { g: sel.req.gnomes, p: sel.req.points, hg: this.s.gnomes, hp: this.s.earnedPoints }) : t("cmp_need_prev");
      action = `<button class="p5-banner p5-banner--action camp-play" disabled><span class="p5-banner__label"><i class="ph-fill ph-lock-simple"></i> ${t("cmp_locked")}</span></button>`;
    } else {
      status = this.s.done[sel.n] ? t("cmp_done") : "";
      action = `<button class="p5-banner p5-banner--action camp-play" data-play="${sel.n}"><span class="p5-banner__label">${t("cmp_play")}</span></button>`;
    }

    const shop = CAMPAIGN_UPGRADES.map((u) => {
      const lv = this.upLevel(u.id), max = lv >= u.max, cost = u.cost[lv], can = !max && this.s.points >= cost;
      const pips = Array.from({ length: u.max }, (_, i) => `<i class="camp-pip${i < lv ? " camp-pip--on" : ""}"></i>`).join("");
      return `<div class="camp-up"><i class="ph-fill ${u.icon} camp-up__icon"></i>
        <div class="camp-up__txt"><b>${t("cmp_up_" + u.id)}</b><span>${t("cmp_up_" + u.id + "_d")}</span><span class="camp-pips">${pips}</span></div>
        <button type="button" class="camp-up__buy" data-buy="${u.id}" ${can ? "" : "disabled"}>${max ? t("cmp_max") : `${t("cmp_buy")} · ${cost}`}</button></div>`;
    }).join("");

    root.innerHTML = `
      <div class="camp-top">
        <span class="camp-chip"><i class="ph-fill ph-users-three"></i> ${t("cmp_gnomes")} <b>${this.s.gnomes}</b></span>
        <span class="camp-chip"><i class="ph-fill ph-coins"></i> ${t("cmp_points")} <b>${this.s.points}</b></span>
      </div>
      <div class="camp-body">
        <div class="camp-map">${nodes}</div>
        <div class="camp-side">
          <div class="camp-detail">
            <div class="camp-detail__kicker">${t("cmp_chapter", { n: sel.n })}</div>
            <div class="camp-detail__name">${t("cmp_ch" + sel.n).replace(/^[^·]*· /, "")}</div>
            ${sel.boss ? "" : `<div class="camp-detail__goal">${t("cmp_goal", { n: sel.goal })}</div>`}
            <div class="camp-detail__status">${status}</div>
            ${action}
          </div>
          <div class="camp-shop"><div class="camp-shop__title">${t("cmp_shop")}</div>${shop}</div>
        </div>
      </div>`;
    root.querySelectorAll(".camp-node").forEach((b) => b.addEventListener("click", () => {
      if (typeof SFX !== "undefined" && SFX.click) SFX.click();
      this.sel = +b.dataset.n; this.render();
    }));
    const pb = root.querySelector("[data-play]");
    if (pb) pb.addEventListener("click", () => { if (typeof SFX !== "undefined" && SFX.click) SFX.click(); this.play(+pb.dataset.play); });
    root.querySelectorAll("[data-buy]").forEach((b) => b.addEventListener("click", () => this.buy(b.dataset.buy)));
  },

  buy(id) {
    const u = CAMPAIGN_UPGRADES.find((x) => x.id === id);
    if (!u) return;
    const lv = this.upLevel(id);
    if (lv >= u.max || this.s.points < u.cost[lv]) return;
    this.s.points -= u.cost[lv];
    this.s.up[id] = lv + 1;
    this.persist();
    if (typeof SFX !== "undefined" && SFX.buy) SFX.buy();
    this.render();
  },

  // ---------- Intro de Nizak ----------
  _intro(ch) {
    return new Promise((resolve) => {
      const ov = document.createElement("div");
      ov.className = "camp-intro";
      ov.innerHTML = `<div class="camp-intro__card">
        <img class="camp-intro__nizak" src="assets/tutorial/nizak_normal.png" alt="">
        <div class="camp-intro__box"><div class="camp-intro__name">${this.t("cmp_nizak")}</div>
        <div class="camp-intro__text">${this.t("cmp_intro" + ch.n)}</div>
        <div class="camp-intro__tap">${this.t("cmp_continue")} <i class="ph-fill ph-caret-right"></i></div></div></div>`;
      document.body.appendChild(ov);
      requestAnimationFrame(() => ov.classList.add("camp-intro--on"));
      let closed = false;
      const close = () => {
        if (closed) return; closed = true;
        if (typeof SFX !== "undefined" && SFX.click) SFX.click();
        ov.classList.remove("camp-intro--on");
        setTimeout(() => { ov.remove(); resolve(); }, 220);
      };
      ov.addEventListener("click", close);
    });
  },

  // ---------- Partida ----------
  async play(n) {
    const ch = this.ch(n);
    if (!ch || ch.boss || !this.unlocked(n)) return;
    await this._intro(ch);
    this.active = true;
    this.run = { n, goal: ch.goal, delivered: 0, kills: 0, earned: 0, over: false };
    this._camps = [];
    if (typeof matchDraft !== "undefined") matchDraft.modeId = "campaign";
    await startMatch({ modeId: "campaign", raceId: "mushboom_forest", levelId: ch.levelId, opponents: 1 });
    // Si el arranque falló, startMatch ya deshizo la pantalla: se limpia el estado.
    const board = document.getElementById("screen-board");
    if (!board || !board.classList.contains("screen--active")) this.onLeaveBoard();
  },

  _free(r, c, size) {
    if (r < 0 || c < 0 || r >= size || c >= size) return false;
    if (typeof Obelisks !== "undefined" && !Obelisks._tileFree(r, c)) return false;
    const mods = [typeof Resources !== "undefined" && Resources, typeof Bushes !== "undefined" && Bushes, typeof Oracle !== "undefined" && Oracle,
      typeof Drums !== "undefined" && Drums, typeof Altar !== "undefined" && Altar, typeof Bumpers !== "undefined" && Bumpers];
    return mods.every((m) => !(m && m.at && m.at(r, c)));
  },

  // Se llama desde spawnTestUnits con el tablero ya construido.
  onMatchBuilt(size) {
    const ch = this.ch(this.run.n);
    // Sin rival con Obelisco, sin tótems ni Altar (la Campaña solo tiene la zona de extracción).
    if (typeof Obelisks !== "undefined") {
      const eo = Obelisks.byTeam("enemy");
      if (eo) { eo.el.remove(); Obelisks.list = Obelisks.list.filter((o) => o !== eo); }
    }
    if (typeof Villages !== "undefined") Villages.resetAll();
    if (typeof Altar !== "undefined") Altar.resetAll();
    if (typeof Gnome !== "undefined") Gnome.resetAll();

    const ob = Obelisks.byTeam("player");
    this._setupObelisk(ob);

    // Puntos iniciales y dos unidades propias junto al Obelisco.
    if (typeof Glory !== "undefined") Glory.addNow("player", CAMPAIGN_START_GLORY + 2 * this.upLevel("prov"));
    const roster = Object.keys(UNIT_TYPES).filter((k) => UNIT_TYPES[k].raceId === "mushboom_forest");
    const adj = Obelisks._adjacentFreeTiles(ob);
    for (let i = 0; i < 2 && adj.length; i++) {
      const spot = adj.splice(Math.floor(Math.random() * adj.length), 1)[0];
      const u = Units.spawnUnit({ typeId: roster[i % roster.length], row: spot.row, col: spot.col, team: "player" });
      if (typeof Fog !== "undefined" && Fog.revealForUnit) Fog.revealForUnit(u);
    }

    // Campamentos: neutrales (soldados de WallForge) guardando gnomos enjaulados.
    const placed = [];
    const dist = (a, b) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
    for (let k = 0; k < ch.camps; k++) {
      let spot = null;
      for (let minD = 8; minD >= 3 && !spot; minD -= 1) {
        for (let a = 0; a < 300 && !spot; a++) {
          const r = 2 + Math.floor(Math.random() * (size - 4)), c = 2 + Math.floor(Math.random() * (size - 4));
          if (!this._free(r, c, size)) continue;
          if (dist({ row: r, col: c }, ob) < minD + 2) continue;
          if (placed.some((p) => dist(p, { row: r, col: c }) < minD)) continue;
          if (!Obelisks._hasFreeRing(r, c, size)) continue;
          spot = { row: r, col: c };
        }
      }
      if (!spot) continue;
      placed.push(spot);
      const camp = { row: spot.row, col: spot.col, guards: [], gnomes: [], open: false };
      const nG = ch.guards[0] + Math.floor(Math.random() * (ch.guards[1] - ch.guards[0] + 1));
      const ring = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if ((dr || dc) && this._free(spot.row + dr, spot.col + dc, size)) ring.push({ row: spot.row + dr, col: spot.col + dc });
      for (let g = 0; g < nG && ring.length; g++) {
        const p = ring.splice(Math.floor(Math.random() * ring.length), 1)[0];
        const typeId = ch.pool[Math.floor(Math.random() * ch.pool.length)];
        camp.guards.push(Units.spawnUnit({ typeId, row: p.row, col: p.col, team: "enemy" }).id);
      }
      for (let g = 0; g < ch.cages; g++) {
        // El primero va en el centro; los demás en la casilla libre más cercana.
        const gn = Gnome.spawnNear(spot.row, spot.col);
        this._cage(gn);
        camp.gnomes.push(gn);
      }
      this._camps.push(camp);
    }

    // Un gnomo suelto cerca del inicio para aprender a cogerlo y entregarlo.
    const near = Gnome.spawnNear(Math.min(size - 1, ob.row + (ob.row < size / 2 ? 4 : -4)), Math.min(size - 1, ob.col + (ob.col < size / 2 ? 3 : -3)));
    near.caged = false;
    this._showHud();
  },

  _cage(gn) {
    gn.caged = true;
    if (!gn.el) return;
    if (gn.spriteEl) gn.spriteEl.style.opacity = "0";
    const img = document.createElement("img");
    img.className = "camp-cage";
    img.src = "assets/campana/gnomoenjaula.png";
    img.alt = "";
    img.draggable = false;
    gn.el.appendChild(img);
    gn._cageEl = img;
  },

  _openCage(gn) {
    gn.caged = false;
    if (gn.spriteEl) gn.spriteEl.style.opacity = "";
    const img = gn._cageEl;
    if (img) {
      img.classList.add("camp-cage--open");
      setTimeout(() => img.remove(), 520);
      gn._cageEl = null;
    }
  },

  _setupObelisk(ob) {
    if (!ob || !ob.el) return;
    ob.el.classList.add("obelisk--campaign");
    const menu = ob.el.querySelector(".obelisk__menu");
    if (!menu || menu.querySelector(".obelisk__menu-btn--extract")) return;
    const btn = document.createElement("button");
    btn.className = "obelisk__menu-btn obelisk__menu-btn--extract";
    btn.setAttribute("aria-label", this.t("cmp_extract"));
    btn.innerHTML = '<i class="ph-fill ph-sign-out obelisk__menu-extract-icon"></i>';
    btn.addEventListener("click", (e) => { e.stopPropagation(); if (typeof SFX !== "undefined" && SFX.click) SFX.click(); this._askExtract(); });
    if (typeof Tooltip !== "undefined") Tooltip.attach(btn, this.t("cmp_extract"));
    menu.appendChild(btn);
  },

  // ---------- Marcador ----------
  _showHud() {
    if (!this._hud) {
      this._hud = document.createElement("div");
      this._hud.className = "camp-hud";
      document.body.appendChild(this._hud);
    }
    this._hud.style.display = "flex";
    this._refreshHud();
  },
  _refreshHud() {
    if (!this._hud || !this.run) return;
    const r = this.run, ok = r.delivered >= r.goal;
    this._hud.classList.toggle("camp-hud--ok", ok);
    this._hud.innerHTML = `<span class="camp-hud__item"><i class="ph-fill ph-users-three"></i> ${this.t("cmp_hud", { a: r.delivered, b: r.goal })}</span>
      <span class="camp-hud__item"><i class="ph-fill ph-coins"></i> ${r.earned}</span>`;
  },
  _bump() {
    if (!this._hud) return;
    this._hud.classList.remove("camp-hud--bump"); void this._hud.offsetWidth; this._hud.classList.add("camp-hud--bump");
  },

  // ---------- Eventos del motor ----------
  onUnitRemoved(unit) {
    const run = this.run;
    if (!run || run.over) return;
    if (unit.team === "enemy") {
      const pts = CAMPAIGN_REWARD.kill[unit.typeId] || 2;
      run.kills++; run.earned += pts;
      if (typeof Glory !== "undefined") Glory.addNow("player", pts);
      this._refreshHud(); this._bump();
      this._camps.forEach((camp) => {
        if (camp.open) return;
        if (camp.guards.every((id) => !Units.list.some((u) => u.id === id))) {
          camp.open = true;
          camp.gnomes.forEach((g) => this._openCage(g));
          if (typeof Turns !== "undefined" && Turns.showBanner) Turns.showBanner(this.t("cmp_free"));
          if (typeof SFX !== "undefined" && SFX.passSuccess) SFX.passSuccess();
        }
      });
    }
  },

  // Una unidad se detuvo: si lleva un gnomo y está junto al Obelisco, lo extrae.
  onUnitStopped(unit) {
    if (!unit || unit.team !== "player" || !this.run || this.run.over) return;
    setTimeout(() => this._tryDeliver(unit), 200);
  },
  async _tryDeliver(unit) {
    if (!this.run || this.run.over || !unit.el || !Units.list.includes(unit)) return;
    const ob = Obelisks.byTeam("player");
    const g = Gnome.list.find((x) => x.heldBy === unit.id);
    if (!ob || !g || Math.max(Math.abs(ob.row - unit.row), Math.abs(ob.col - unit.col)) > 1) return;
    if (g._delivering) return;
    g._delivering = true;
    this.run.delivered++; this.run.earned += CAMPAIGN_REWARD.deliver;
    if (typeof Glory !== "undefined") Glory.addFlying("player", CAMPAIGN_REWARD.deliver, unit.el);
    if (typeof Units.spawnFloatingText === "function") Units.spawnFloatingText(unit, this.t("cmp_delivered"), { className: "dmg-popup camp-popup" });
    if (typeof SFX !== "undefined") { if (SFX.captureVillage) SFX.captureVillage(); }
    ob.el.classList.add("obelisk--camp-pulse");
    setTimeout(() => ob.el.classList.remove("obelisk--camp-pulse"), 700);
    g.detachFrom();
    Gnome.destroyInstance(g);
    if (typeof Units.refreshRange === "function") Units.refreshRange(unit);
    this._refreshHud(); this._bump();
    if (typeof Gnome.showFor === "function") Gnome.showFor(unit);
  },

  // ---------- IA de los neutrales ----------
  async neutralTurn() {
    const guards = Units.list.filter((u) => u.team === "enemy");
    if (!guards.length) return;
    Turns._resetTeamActions("enemy");
    const prevTeam = Turns.activeTeam;
    Turns.activeTeam = "enemy"; // canAct/Movement solo dejan actuar al equipo activo
    const ep = typeof MatchCleanup !== "undefined" ? MatchCleanup.epoch : 0;
    try {
    for (const g of guards) {
      for (let i = 0; i < TURNS_MAX_ACTIONS; i++) {
        if ((typeof MatchCleanup !== "undefined" && MatchCleanup.epoch !== ep) || !g.el || !Units.list.includes(g)) break;
        if (!Turns.canAct(g)) break;
        let acted = false;
        try { acted = await this._guardAct(g); } catch (e) { console.warn("[Campaign] guard", e); }
        if (!acted) break;
        await this._sleep(240);
      }
    }
    } finally { Turns.activeTeam = prevTeam; }
  },
  async _guardAct(g) {
    const ch = this.ch(this.run.n);
    const players = Units.list.filter((u) => u.team === "player");
    let best = null;
    players.forEach((u) => {
      const d = Math.max(Math.abs(u.row - g.row), Math.abs(u.col - g.col));
      if (!best || d < best.d) best = { u, d };
    });
    if (!best || best.d > ch.aggro) return false;
    const opts = Combat.attackableEnemies(g);
    const pick = opts.find((o) => o.target === best.u) || opts[0];
    if (pick) { await Combat.approachAndAttack(g, pick.target); return true; }
    const dest = Turns._aiPickMoveTileToward(g, { row: best.u.row, col: best.u.col });
    if (!dest) return false;
    await Movement.moveTo(g, dest.row, dest.col);
    return true;
  },

  // Sin unidades ni puntos para reclutar: no hay forma de seguir.
  _checkStuck() {
    if (!this.run || this.run.over) return;
    const mine = Units.list.some((u) => u.team === "player");
    const cheapest = Math.min(...Object.keys(UNIT_TYPES).filter((k) => UNIT_TYPES[k].raceId === "mushboom_forest").map((k) => Units.recruitPriceFor(k)));
    if (!mine && Glory.points.player < cheapest) this.onGameEnd(false);
  },

  // ---------- Extracción y resultado ----------
  _askExtract() {
    if (!this.run || this.run.over) return;
    if (this._askEl) return;
    const ov = document.createElement("div");
    ov.className = "camp-ask";
    ov.innerHTML = `<div class="camp-ask__panel">
      <div class="camp-ask__q">${this.t("cmp_extract_q")}</div>
      <div class="camp-ask__info">${this.t("cmp_extract_info")}<br><b>${this.run.delivered}/${this.run.goal}</b> ${this.t("cmp_gnomes").toLowerCase()} · <b>${this.run.earned}</b> ${this.t("cmp_points").toLowerCase()}</div>
      <div class="camp-ask__row"><button class="camp-ask__btn camp-ask__btn--yes">${this.t("cmp_yes")}</button><button class="camp-ask__btn camp-ask__btn--no">${this.t("cmp_no")}</button></div></div>`;
    document.body.appendChild(ov);
    this._askEl = ov;
    const close = () => { ov.remove(); this._askEl = null; };
    ov.querySelector(".camp-ask__btn--no").addEventListener("click", () => { if (typeof SFX !== "undefined" && SFX.back) SFX.back(); close(); });
    ov.querySelector(".camp-ask__btn--yes").addEventListener("click", () => { if (typeof SFX !== "undefined" && SFX.click) SFX.click(); close(); this._finish("extract"); });
    ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  },

  onGameEnd(playerWon) { if (!this.run || this.run.over) return; this._finish(playerWon ? "extract" : "fallen"); },

  _finish(kind) {
    const r = this.run;
    if (!r || r.over) return;
    r.over = true;
    if (typeof Obelisks !== "undefined") Obelisks.gameOver = true;
    if (typeof Units !== "undefined") Units.deselect();
    if (typeof Turns !== "undefined") Turns.hideButton();
    const fallen = kind === "fallen";
    const gain = fallen ? Math.floor(r.earned / 2) : r.earned;
    const completed = !fallen && r.delivered >= r.goal;
    this.s.gnomes += r.delivered;
    this.s.points += gain;
    this.s.earnedPoints += gain;
    if (completed) this.s.done[r.n] = true;
    this.persist();
    if (typeof SFX !== "undefined") { if (fallen && SFX.defeat) SFX.defeat(); else if (SFX.victory) SFX.victory(); }
    this._showResult({ completed, fallen, gain });
  },

  _showResult({ completed, fallen, gain }) {
    const r = this.run;
    const title = fallen ? this.t("cmp_res_fail") : completed ? this.t("cmp_res_ok") : this.t("cmp_res_part");
    const ov = document.createElement("div");
    ov.className = "camp-result";
    ov.innerHTML = `<div class="camp-result__panel">
      <div class="camp-result__title${fallen ? " camp-result__title--bad" : ""}">${title}</div>
      <div class="camp-result__rows">
        <div><span>${this.t("cmp_res_g")}</span><b>${r.delivered}</b></div>
        <div><span>${this.t("cmp_res_p")}</span><b>+${gain}</b></div>
        <div><span>${this.t("cmp_res_k")}</span><b>${r.kills}</b></div>
        <div class="camp-result__goal">${this.t("cmp_res_goal", { n: r.goal })}</div></div>
      <button class="camp-result__btn">${this.t("cmp_back_map")}</button></div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add("camp-result--on"));
    ov.querySelector(".camp-result__btn").addEventListener("click", () => {
      if (typeof SFX !== "undefined" && SFX.click) SFX.click();
      ov.remove();
      this.leaveToMap();
    });
    this._resultEl = ov;
  },

  leaveToMap() {
    if (this._resultEl) { this._resultEl.remove(); this._resultEl = null; }
    if (typeof Glory !== "undefined") Glory.hideHud();
    if (typeof SettingsMenu !== "undefined") SettingsMenu.hideButton();
    if (typeof Backpack !== "undefined") Backpack.hideButton();
    this.render();
    if (typeof showScreen === "function") showScreen("screen-campaign");
    if (typeof screenHistory !== "undefined") { screenHistory.length = 0; screenHistory.push("main-menu", "screen-campaign"); }
  },

  // MatchCleanup.leave(): se sale del tablero (por el motivo que sea): se apaga todo el estado de la run.
  onLeaveBoard() {
    if (!this.active && !this._hud) return;
    this.active = false;
    if (this._hud) this._hud.style.display = "none";
    if (this._askEl) { this._askEl.remove(); this._askEl = null; }
    if (this._resultEl) { this._resultEl.remove(); this._resultEl = null; }
    if (typeof Obelisks !== "undefined") Obelisks.gameOver = false;
    this._camps = [];
  },
};

document.addEventListener("DOMContentLoaded", () => Campaign.init());

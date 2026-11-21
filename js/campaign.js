/* Gnomore Gnomes — modo CAMPAÑA (extracción).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - El estado de la campaña (capítulos hechos, gnomos y recursos extraídos, mejoras y reliquias
       compradas), guardado en localStorage por cuenta (gg_campaign_<uid>).
     - El mapa de capítulos, la tienda de mejoras y reliquias de campaña, y su tutorial.
     - La intro "La Guerra Eterna" narrada por Nizak al empezar cada capítulo.
     - La partida de campaña. El motor normal solo le avisa con ganchos mínimos protegidos por
       `Campaign.active` (units, obelisks, gnome, glory, armory, artifacts, newgame-flow, matchcleanup).
       Sin Campaña activa nada de esto cambia el juego normal.

   Reglas pedidas (resumen): conseguir X gnomos por nivel; gnomos enjaulados por neutrales
   (Rastreadores) o sueltos; los gnomos se ESTAMPAN contra el Obelisco propio, que no pierde vida (es un
   sacrificio) y solo sirve de zona de extracción; puntos de partida (propios de la partida, NO se
   extraen): empiezas con 4 y 1 unidad básica, +3 por baja de neutral y los puntos del gnomo al estamparlo
   (tope +5 por gnomo); sin puntos por turno; población máxima 5; se extraen gnomos, madera, roca y metal,
   que compran mejoras y reliquias de campaña (1 equipada, hasta 3 con una mejora); Rompeobeliscos
   furtivos (1 vida, 1 daño) aparecen lejos y se acercan a golpear el Obelisco; avisos al empezar turno.
   PENDIENTE: barras de experiencia/niveles de unidad, nube, GnomOgro (cap. 5), mapa de regiones. */

const CAMPAIGN_CHAPTERS = [
  { n: 1, levelId: "mushboom_forest", goal: 3, req: { gnomes: 0, res: 0 }, camps: 2, guards: [1, 1], cages: 2, pool: ["rastreador"], aggro: 4, sneak: { every: 4, max: 1 } },
  { n: 2, levelId: "mushboom_forest", goal: 4, req: { gnomes: 3, res: 8 }, camps: 3, guards: [1, 2], cages: 2, pool: ["rastreador"], aggro: 5, sneak: { every: 3, max: 2 } },
  { n: 3, levelId: "mushboom_forest", goal: 5, req: { gnomes: 8, res: 24 }, camps: 4, guards: [2, 2], cages: 2, pool: ["rastreador", "rastreador", "portamuros"], aggro: 5, sneak: { every: 3, max: 3 } },
  { n: 4, levelId: "mushboom_forest", goal: 6, req: { gnomes: 15, res: 50 }, camps: 5, guards: [2, 3], cages: 2, pool: ["rastreador", "portamuros"], aggro: 6, sneak: { every: 2, max: 4 } },
  { n: 5, levelId: "mushboom_forest", boss: true, goal: 1, req: { gnomes: 24, res: 90 } },
];

// Mejoras exclusivas de campaña: se pagan con los recursos extraídos.
const CAMPAIGN_UPGRADES = [
  { id: "prov", icon: "ph-basket", max: 3, cost: [{ madera: 3, roca: 2 }, { madera: 6, roca: 4 }, { madera: 9, roca: 7, metal: 1 }] },
  { id: "arma", icon: "ph-sword", max: 2, cost: [{ roca: 4, metal: 1 }, { roca: 8, metal: 3 }] },
  { id: "armadura", icon: "ph-shield", max: 2, cost: [{ madera: 4, metal: 1 }, { madera: 8, metal: 3 }] },
  { id: "pop", icon: "ph-users-three", max: 3, cost: [{ madera: 5, roca: 3 }, { madera: 8, roca: 6 }, { madera: 12, roca: 9, metal: 2 }] },
  { id: "carga", icon: "ph-hand-grabbing", max: 3, cost: [{ madera: 3, roca: 3, metal: 1 }, { madera: 6, roca: 6, metal: 2 }, { madera: 9, roca: 9, metal: 4 }] },
  { id: "slots", icon: "ph-diamonds-four", max: 1, cost: [{ madera: 20, roca: 20, metal: 8 }] },
];
const CAMPAIGN_RELIC_COST_CHEAP = { madera: 4, roca: 4, metal: 1 };
const CAMPAIGN_RELIC_COST_DEAR = { madera: 8, roca: 8, metal: 4 };
const CAMPAIGN_RELIC_DEAR = ["espada", "armadura", "tomo_guerra", "tomo_prot", "tomo_super"];
const CAMPAIGN_RES = ["madera", "roca", "metal"];
const CAMPAIGN_RES_ICON = { madera: "assets/iconos/recurso_madera.png", roca: "assets/iconos/recurso_roca.png", metal: "assets/iconos/recurso_metal.png" };

const CAMPAIGN_KILL_POINTS = 3;
const CAMPAIGN_START_GLORY = 4;
const CAMPAIGN_BASE_POP = 5;
const CAMPAIGN_BASE_CARRY = 5;

(function registerCampaignStrings() {
  const es = {
    menu_campaign: "Campaña", cmp_title: "CAMPAÑA", cmp_gnomes: "GNOMOS", cmp_goal: "Estampa {n} gnomos contra el Obelisco.",
    cmp_play: "JUGAR", cmp_soon: "PRÓXIMAMENTE", cmp_locked: "BLOQUEADO", cmp_done: "COMPLETADO", cmp_chapter: "CAPÍTULO {n}",
    cmp_need: "Necesitas {g} gnomos y {r} recursos extraídos (tienes {hg} y {hr}).", cmp_need_prev: "Completa el capítulo anterior.",
    cmp_boss: "El GnomOgro te espera... pero aún no está listo.", cmp_shop: "MEJORAS DE CAMPAÑA", cmp_relics: "RELIQUIAS DE CAMPAÑA",
    cmp_buy: "COMPRAR", cmp_max: "AL MÁXIMO", cmp_equip: "EQUIPAR", cmp_unequip: "QUITAR", cmp_equipped: "EQUIPADA",
    cmp_slots: "Equipadas {a}/{b}", cmp_relics_help: "Se compran con recursos extraídos. Las reliquias de tu cuenta no valen aquí.",
    cmp_up_prov: "Provisiones", cmp_up_prov_d: "Empiezas cada nivel con +2 puntos por nivel de mejora.",
    cmp_up_arma: "Garrotes afilados", cmp_up_arma_d: "+1 de ataque a todas tus unidades.",
    cmp_up_armadura: "Cortezas duras", cmp_up_armadura_d: "+1 de aguante a todas tus unidades.",
    cmp_up_pop: "Más barracones", cmp_up_pop_d: "+1 de población máxima.",
    cmp_up_carga: "Gnomos más cargables", cmp_up_carga_d: "Los gnomos aguantan +1 punto de golpes antes de estamparlos.",
    cmp_up_slots: "Maletín de reliquias", cmp_up_slots_d: "Puedes llevar hasta 3 reliquias a la vez en vez de 1.",
    cmp_how: "CÓMO SE JUEGA",
    cmp_hud: "{a}/{b}", cmp_extract: "Extraer", cmp_extract_q: "¿EXTRAER Y TERMINAR?", cmp_extract_info: "Te llevas los gnomos y los recursos conseguidos. Los puntos de la partida no se extraen.",
    cmp_yes: "EXTRAER", cmp_no: "SEGUIR", cmp_res_ok: "¡CAPÍTULO SUPERADO!", cmp_res_part: "EXTRACCIÓN COMPLETADA", cmp_res_fail: "HAS CAÍDO",
    cmp_res_g: "Gnomos estampados", cmp_res_k: "Neutrales derrotados", cmp_res_goal: "Objetivo: {n} gnomos", cmp_res_half: "Al caer solo te llevas la mitad de los recursos.",
    cmp_back_map: "VOLVER AL MAPA", cmp_free: "¡GNOMOS LIBRES!", cmp_done_banner: "¡OBJETIVO CUMPLIDO!", cmp_warn_ob: "¡ATACAN TU OBELISCO!", cmp_warn_none: "NO QUEDAN GNOMOS POR LIBERAR",
    cmp_skip: "SALTAR", cmp_start: "COMENZAR", cmp_war: "LA GUERRA ETERNA", cmp_next: "SIGUIENTE", cmp_ok: "ENTENDIDO", cmp_nizak: "Nizak",
    cmp_ch1: "Capítulo 1 · Claro de las Setas", cmp_ch2: "Capítulo 2 · Orilla Pantanosa", cmp_ch3: "Capítulo 3 · Espesura Profunda", cmp_ch4: "Capítulo 4 · Cumbre del Hongo", cmp_ch5: "Capítulo 5 · El GnomOgro",
    cmp_intro1: "Hace más de tres siglos, todo el reino de Gnomoria era feliz.|Las razas vivían en guerra —ironías de la vida— matándose y torturándose sin una sola preocupación.|Hasta que llegaron ELLOS: los gnomos, con sus arcoíris y sus chuches sin gluten y bajas en azúcar, empeñados en mediar para conseguir la paz.|¡Están locos! ¡No se lo permitiremos! Guardabosques, a por ellos.",
    cmp_intro2: "Los gnomos se extienden como una plaga de purpurina.|Hasta junto a la orilla se oyen ya sus cantos de hermandad.|Rescatad a los enjaulados antes de que sigan predicando la paz.",
    cmp_intro3: "Más adentro del bosque, hasta las setas parecen charlar en vez de explotar.|Algo huele a concordia, y ese olor me revuelve el estómago.|Traedme más gnomos: hay que saber dónde se esconden.",
    cmp_intro4: "En lo alto del bosque, los Rastreadores vigilan jaulas por costumbre... y por un buen sueldo.|Entrad, sacad a los gnomos y que nadie mencione la palabra abrazo.",
    cmp_intro5: "Se acerca el GnomOgro.|Pero eso, mis queridos guardabosques, es otra historia.",
    cmp_tut1_t: "El objetivo", cmp_tut1: "Cada capítulo te pide estampar un número de gnomos contra tu Obelisco. Empiezas con 1 unidad básica y 4 puntos de partida. Población máxima: 5.",
    cmp_tut2_t: "Jaulas y neutrales", cmp_tut2: "Los gnomos están enjaulados en campamentos vigilados por Rastreadores. Derrota a todos los guardias de un campamento y las jaulas se abren. Cada baja te da +3 puntos.",
    cmp_tut3_t: "Estampar gnomos", cmp_tut3: "Un gnomo libre huye de ti como siempre. Cógelo, pégale para cargarle puntos (hasta +5) y llévalo al Obelisco: aquí no le hace daño, es un sacrificio, y los puntos del gnomo pasan a tu bolsa.",
    cmp_tut4_t: "Puntos y recursos", cmp_tut4: "Los puntos son solo de la partida: úsalos para reclutar. Nadie te da puntos por turno. Recoge madera, roca y metal de los recursos del mapa: eso sí se extrae.",
    cmp_tut5_t: "Furtivos", cmp_tut5: "De vez en cuando aparecen Rompeobeliscos lejos de tu base y se acercan a golpear el Obelisco. Son débiles, pero si lo derriban, pierdes. Te avisaré al empezar tu turno.",
    cmp_tut6_t: "Extraer", cmp_tut6: "Con el Obelisco seleccionado, el icono de salida a la derecha de reclutar termina la partida. Te llevas los gnomos y los recursos; con ellos compras mejoras y reliquias en el mapa. Si caes, solo te llevas la mitad de los recursos.",
  };
  const en = {
    menu_campaign: "Campaign", cmp_title: "CAMPAIGN", cmp_gnomes: "GNOMES", cmp_goal: "Slam {n} gnomes into the Obelisk.",
    cmp_play: "PLAY", cmp_soon: "COMING SOON", cmp_locked: "LOCKED", cmp_done: "COMPLETED", cmp_chapter: "CHAPTER {n}",
    cmp_need: "You need {g} gnomes and {r} extracted resources (you have {hg} and {hr}).", cmp_need_prev: "Complete the previous chapter.",
    cmp_boss: "The GnomOgre awaits... but it isn't ready yet.", cmp_shop: "CAMPAIGN UPGRADES", cmp_relics: "CAMPAIGN RELICS",
    cmp_buy: "BUY", cmp_max: "MAXED", cmp_equip: "EQUIP", cmp_unequip: "REMOVE", cmp_equipped: "EQUIPPED",
    cmp_slots: "Equipped {a}/{b}", cmp_relics_help: "Bought with extracted resources. Your account relics don't count here.",
    cmp_up_prov: "Provisions", cmp_up_prov_d: "Start every level with +2 points per upgrade level.",
    cmp_up_arma: "Sharpened clubs", cmp_up_arma_d: "+1 attack for all your units.",
    cmp_up_armadura: "Hardened bark", cmp_up_armadura_d: "+1 toughness for all your units.",
    cmp_up_pop: "More barracks", cmp_up_pop_d: "+1 maximum population.",
    cmp_up_carga: "Sturdier gnomes", cmp_up_carga_d: "Gnomes can take +1 point of hits before the slam.",
    cmp_up_slots: "Relic case", cmp_up_slots_d: "Carry up to 3 relics at once instead of 1.",
    cmp_how: "HOW TO PLAY",
    cmp_hud: "{a}/{b}", cmp_extract: "Extract", cmp_extract_q: "EXTRACT AND FINISH?", cmp_extract_info: "You keep the gnomes and resources you gathered. Match points are not extracted.",
    cmp_yes: "EXTRACT", cmp_no: "KEEP GOING", cmp_res_ok: "CHAPTER CLEARED!", cmp_res_part: "EXTRACTION COMPLETE", cmp_res_fail: "YOU HAVE FALLEN",
    cmp_res_g: "Gnomes slammed", cmp_res_k: "Neutrals defeated", cmp_res_goal: "Goal: {n} gnomes", cmp_res_half: "When you fall you only keep half the resources.",
    cmp_back_map: "BACK TO THE MAP", cmp_free: "GNOMES FREED!", cmp_done_banner: "GOAL REACHED!", cmp_warn_ob: "YOUR OBELISK IS UNDER ATTACK!", cmp_warn_none: "NO GNOMES LEFT TO FREE",
    cmp_skip: "SKIP", cmp_start: "BEGIN", cmp_war: "THE ETERNAL WAR", cmp_next: "NEXT", cmp_ok: "GOT IT", cmp_nizak: "Nizak",
    cmp_ch1: "Chapter 1 · Mushroom Glade", cmp_ch2: "Chapter 2 · Boggy Shore", cmp_ch3: "Chapter 3 · Deep Thicket", cmp_ch4: "Chapter 4 · Fungus Peak", cmp_ch5: "Chapter 5 · The GnomOgre",
    cmp_intro1: "Over three centuries ago, the whole kingdom of Gnomoria was happy.|The races lived at war — the irony! — killing and torturing each other without a care in the world.|Until THEY showed up: the gnomes, with their rainbows and their gluten-free, low-sugar candy, set on mediating peace.|They're mad! We won't allow it! Forest Rangers, get them.",
    cmp_intro2: "The gnomes spread like a plague of glitter.|Even by the shore you can hear their songs of brotherhood.|Rescue the caged ones before they keep preaching peace.",
    cmp_intro3: "Deeper in the forest, even the mushrooms seem to chat instead of exploding.|Something smells of harmony, and it turns my stomach.|Bring me more gnomes: we must learn where they hide.",
    cmp_intro4: "High in the forest, Trackers guard cages out of habit... and for good pay.|Go in, get the gnomes out, and let nobody mention the word hug.",
    cmp_intro5: "The GnomOgre approaches.|But that, my dear rangers, is another story.",
    cmp_tut1_t: "The goal", cmp_tut1: "Every chapter asks you to slam a number of gnomes into your Obelisk. You start with 1 basic unit and 4 match points. Maximum population: 5.",
    cmp_tut2_t: "Cages and neutrals", cmp_tut2: "Gnomes are caged in camps guarded by Trackers. Defeat every guard of a camp and the cages open. Each kill gives you +3 points.",
    cmp_tut3_t: "Slamming gnomes", cmp_tut3: "A free gnome runs from you as usual. Grab it, hit it to charge points (up to +5) and take it to the Obelisk: it takes no damage here, it's a sacrifice, and the gnome's points go into your pool.",
    cmp_tut4_t: "Points and resources", cmp_tut4: "Points belong to the match only: spend them recruiting. Nobody gives you points per turn. Gather wood, rock and metal from the map: those do get extracted.",
    cmp_tut5_t: "Sneakers", cmp_tut5: "Now and then Obelisk Breakers appear far from your base and creep up to hit the Obelisk. They are weak, but if they bring it down, you lose. I'll warn you at the start of your turn.",
    cmp_tut6_t: "Extract", cmp_tut6: "With the Obelisk selected, the exit icon right of recruit ends the match. You keep the gnomes and resources; spend them on upgrades and relics on the map. If you fall, you only keep half the resources.",
  };
  Object.assign(STRINGS.es, es);
  Object.assign(STRINGS.en, en);
})();

const Campaign = {
  active: false,
  run: null,
  s: null,
  sel: 1,
  _uid: null,
  _hud: null,
  _camps: [],

  t(k, v) { return I18N.t(k, v); },
  _sleep(ms) { return new Promise((r) => setTimeout(r, ms)); },
  ch(n) { return CAMPAIGN_CHAPTERS.find((c) => c.n === n); },
  _click() { if (typeof SFX !== "undefined" && SFX.click) SFX.click(); },
  _cheb(a, b) { return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col)); },

  // ---------- Progreso ----------
  _key() { return "gg_campaign_" + (this._uid || "guest"); },
  _defaults() { return { v: 2, gnomes: 0, res: { madera: 0, roca: 0, metal: 0 }, earnedRes: 0, done: {}, up: {}, relics: [], eq: [], seenTut: false }; },
  load() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(this._key()) || "null"); } catch (e) {}
    const d = this._defaults();
    this.s = Object.assign(d, raw && typeof raw === "object" ? raw : {});
    this.s.res = Object.assign({ madera: 0, roca: 0, metal: 0 }, this.s.res || {});
    this.s.done = this.s.done || {}; this.s.up = this.s.up || {};
    this.s.relics = Array.isArray(this.s.relics) ? this.s.relics : []; this.s.eq = Array.isArray(this.s.eq) ? this.s.eq : [];
    this.s.v = 2;
  },
  persist() { try { localStorage.setItem(this._key(), JSON.stringify(this.s)); } catch (e) {} },
  upLevel(id) { return (this.s && this.s.up[id]) || 0; },
  bonus(id) { return this.active && this.s ? this.upLevel(id) : 0; },
  popLimit() { return CAMPAIGN_BASE_POP + this.upLevel("pop"); },
  gnomeCap() { return CAMPAIGN_BASE_CARRY + this.upLevel("carga"); },
  slots() { return this.upLevel("slots") ? 3 : 1; },
  equippedRelics() { return this.s.eq.filter((id) => this.s.relics.includes(id)).slice(0, this.slots()); },
  relicCost(id) { return CAMPAIGN_RELIC_DEAR.includes(id) ? CAMPAIGN_RELIC_COST_DEAR : CAMPAIGN_RELIC_COST_CHEAP; },
  canPay(cost) { return CAMPAIGN_RES.every((r) => (this.s.res[r] || 0) >= (cost[r] || 0)); },
  pay(cost) { CAMPAIGN_RES.forEach((r) => { this.s.res[r] -= cost[r] || 0; }); },
  totalRes() { return CAMPAIGN_RES.reduce((a, r) => a + (this.s.res[r] || 0), 0); },

  unlocked(n) {
    if (n === 1) return true;
    const c = this.ch(n);
    return !!(this.s.done[n - 1] && this.s.gnomes >= c.req.gnomes && this.s.earnedRes >= c.req.res);
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
      this._click();
      this.render();
      goToScreen("screen-campaign");
    });
    if (typeof Turns !== "undefined") Turns.registerTurnStartListener(this);
    document.addEventListener("gg:langchange", () => { this.render(); this._refreshHud(); });
  },

  // ---------- Pantalla del mapa ----------
  _costHtml(cost) {
    return CAMPAIGN_RES.filter((r) => cost[r]).map((r) => `<span class="camp-cost${(this.s.res[r] || 0) >= cost[r] ? "" : " camp-cost--no"}"><img src="${CAMPAIGN_RES_ICON[r]}" alt="">${cost[r]}</span>`).join("");
  },

  render() {
    const root = document.getElementById("camp-root");
    if (!root || !this.s) return;
    const t = (k, v) => this.t(k, v);
    const sel = this.ch(this.sel) || this.ch(1);
    const nodes = CAMPAIGN_CHAPTERS.map((c, i) => {
      const un = this.unlocked(c.n), done = !!this.s.done[c.n];
      const cls = ["camp-node", un ? "camp-node--open" : "camp-node--locked", done ? "camp-node--done" : "", c.n === sel.n ? "camp-node--sel" : ""].join(" ");
      const img = c.boss ? `<i class="ph-fill ph-skull camp-node__skull"></i>` : `<img class="camp-node__img" src="assets/niveles/isla_mushboom_forest.png" alt="">`;
      const badge = !un ? `<i class="ph-fill ph-lock-simple camp-node__badge"></i>` : done ? `<i class="ph-fill ph-check-circle camp-node__badge camp-node__badge--ok"></i>` : "";
      return `<button type="button" class="${cls}" data-n="${c.n}" style="--i:${i}">${img}${badge}<span class="camp-node__n">${c.n}</span></button>`;
    }).join('<i class="camp-link"></i>');

    let status, action;
    if (sel.boss) { status = t("cmp_boss"); action = `<button class="p5-banner p5-banner--action camp-play" disabled><span class="p5-banner__label">${t("cmp_soon")}</span></button>`; }
    else if (!this.unlocked(sel.n)) {
      status = this.s.done[sel.n - 1] ? t("cmp_need", { g: sel.req.gnomes, r: sel.req.res, hg: this.s.gnomes, hr: this.s.earnedRes }) : t("cmp_need_prev");
      action = `<button class="p5-banner p5-banner--action camp-play" disabled><span class="p5-banner__label"><i class="ph-fill ph-lock-simple"></i> ${t("cmp_locked")}</span></button>`;
    } else {
      status = this.s.done[sel.n] ? t("cmp_done") : "";
      action = `<button class="p5-banner p5-banner--action camp-play" data-play="${sel.n}"><span class="p5-banner__label">${t("cmp_play")}</span></button>`;
    }

    const shop = CAMPAIGN_UPGRADES.map((u) => {
      const lv = this.upLevel(u.id), max = lv >= u.max, cost = u.cost[lv], can = !max && this.canPay(cost);
      const pips = Array.from({ length: u.max }, (_, i) => `<i class="camp-pip${i < lv ? " camp-pip--on" : ""}"></i>`).join("");
      return `<div class="camp-up"><i class="ph-fill ${u.icon} camp-up__icon"></i>
        <div class="camp-up__txt"><b>${t("cmp_up_" + u.id)}</b><span>${t("cmp_up_" + u.id + "_d")}</span><span class="camp-pips">${pips}</span></div>
        <div class="camp-up__buyer">${max ? "" : `<span class="camp-costs">${this._costHtml(cost)}</span>`}<button type="button" class="camp-up__buy" data-buy="${u.id}" ${can ? "" : "disabled"}>${max ? t("cmp_max") : t("cmp_buy")}</button></div></div>`;
    }).join("");

    const eq = this.equippedRelics();
    const relics = (typeof ART_DEFS !== "undefined" ? ART_DEFS : []).map((d) => {
      const own = this.s.relics.includes(d.id), on = eq.includes(d.id), cost = this.relicCost(d.id);
      const btn = own ? `<button type="button" class="camp-up__buy${on ? " camp-up__buy--on" : ""}" data-eq="${d.id}">${on ? t("cmp_unequip") : t("cmp_equip")}</button>`
        : `<button type="button" class="camp-up__buy" data-relic="${d.id}" ${this.canPay(cost) ? "" : "disabled"}>${t("cmp_buy")}</button>`;
      return `<div class="camp-up${on ? " camp-up--on" : ""}"><img class="camp-up__img" src="assets/artefactos/${d.id}.webp" alt="">
        <div class="camp-up__txt"><b>${Artifacts.name(d.id)}</b><span>${Artifacts.desc(d.id)}</span></div>
        <div class="camp-up__buyer">${own ? (on ? `<span class="camp-costs camp-costs--on">${t("cmp_equipped")}</span>` : "") : `<span class="camp-costs">${this._costHtml(cost)}</span>`}${btn}</div></div>`;
    }).join("");

    const res = CAMPAIGN_RES.map((r) => `<span class="camp-chip"><img src="${CAMPAIGN_RES_ICON[r]}" alt=""><b>${this.s.res[r] || 0}</b></span>`).join("");
    root.innerHTML = `
      <div class="camp-top">
        <span class="camp-chip"><i class="ph-fill ph-users-three"></i> ${t("cmp_gnomes")} <b>${this.s.gnomes}</b></span>${res}
      </div>
      <div class="camp-body">
        <div class="camp-col">
          <div class="camp-map">${nodes}</div>
          <div class="camp-detail">
            <div class="camp-detail__kicker">${t("cmp_chapter", { n: sel.n })}</div>
            <div class="camp-detail__name">${t("cmp_ch" + sel.n).replace(/^[^·]*· /, "")}</div>
            ${sel.boss ? "" : `<div class="camp-detail__goal">${t("cmp_goal", { n: sel.goal })}</div>`}
            <div class="camp-detail__status">${status}</div>
            ${action}
          </div>
        </div>
        <div class="camp-side">
          <div class="camp-shop"><div class="camp-shop__title">${t("cmp_shop")}</div>${shop}</div>
          <div class="camp-shop"><div class="camp-shop__title">${t("cmp_relics")} <small>${t("cmp_slots", { a: eq.length, b: this.slots() })}</small></div><div class="camp-shop__help">${t("cmp_relics_help")}</div>${relics}</div>
        </div>
      </div>`;
    root.querySelectorAll(".camp-node").forEach((b) => b.addEventListener("click", () => { this._click(); this.sel = +b.dataset.n; this.render(); }));
    const pb = root.querySelector("[data-play]");
    if (pb) pb.addEventListener("click", () => { this._click(); this.play(+pb.dataset.play); });
    root.querySelectorAll("[data-buy]").forEach((b) => b.addEventListener("click", () => this.buy(b.dataset.buy)));
    root.querySelectorAll("[data-relic]").forEach((b) => b.addEventListener("click", () => this.buyRelic(b.dataset.relic)));
    root.querySelectorAll("[data-eq]").forEach((b) => b.addEventListener("click", () => this.toggleRelic(b.dataset.eq)));
  },

  buy(id) {
    const u = CAMPAIGN_UPGRADES.find((x) => x.id === id);
    if (!u) return;
    const lv = this.upLevel(id);
    if (lv >= u.max || !this.canPay(u.cost[lv])) return;
    this.pay(u.cost[lv]);
    this.s.up[id] = lv + 1;
    this.persist();
    if (typeof SFX !== "undefined" && SFX.buy) SFX.buy();
    this.render();
  },
  buyRelic(id) {
    const cost = this.relicCost(id);
    if (this.s.relics.includes(id) || !this.canPay(cost)) return;
    this.pay(cost);
    this.s.relics.push(id);
    if (this.equippedRelics().length < this.slots()) this.s.eq.push(id);
    this.persist();
    if (typeof SFX !== "undefined" && SFX.buy) SFX.buy();
    this.render();
  },
  toggleRelic(id) {
    this._click();
    const eq = this.equippedRelics();
    if (eq.includes(id)) this.s.eq = eq.filter((x) => x !== id);
    else if (eq.length < this.slots()) this.s.eq = eq.concat(id);
    else this.s.eq = eq.slice(0, this.slots() - 1).concat(id); // sustituye a la última
    this.persist();
    this.render();
  },

  // ---------- Tutorial (tarjetas de Nizak) ----------
  showTutorial() {
    if (document.querySelector(".camp-intro")) return;
    const pages = [1, 2, 3, 4, 5, 6].map((i) => ({ title: this.t("cmp_tut" + i + "_t"), text: this.t("cmp_tut" + i) }));
    const ov = document.createElement("div");
    ov.className = "camp-intro";
    ov.innerHTML = `<div class="camp-intro__card">
      <img class="camp-intro__nizak" src="assets/tutorial/nizak_aplaude.png" alt="">
      <div class="camp-intro__box"><div class="camp-intro__name">${this.t("cmp_nizak")} · <span class="camp-tut__title"></span> <small class="camp-tut__n"></small></div>
      <div class="camp-intro__text"></div>
      <button type="button" class="camp-intro__next"></button></div></div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add("camp-intro--on"));
    let i = 0;
    const paint = () => {
      ov.querySelector(".camp-tut__title").textContent = pages[i].title;
      ov.querySelector(".camp-tut__n").textContent = `${i + 1}/${pages.length}`;
      ov.querySelector(".camp-intro__text").textContent = pages[i].text;
      ov.querySelector(".camp-intro__next").textContent = i === pages.length - 1 ? this.t("cmp_ok") : this.t("cmp_next");
    };
    paint();
    ov.querySelector(".camp-intro__next").addEventListener("click", (e) => {
      e.stopPropagation(); this._click();
      if (i < pages.length - 1) { i++; paint(); return; }
      ov.classList.remove("camp-intro--on"); setTimeout(() => ov.remove(), 220);
    });
  },

  // ---------- Partida ----------
  async play(n) {
    const ch = this.ch(n);
    if (!ch || ch.boss || !this.unlocked(n)) return;
    this.active = true;
    this.run = { n, goal: ch.goal, delivered: 0, kills: 0, over: false, warnedNone: false, warnedDone: false, spawned: 0 };
    this._camps = [];
    if (typeof matchDraft !== "undefined") matchDraft.modeId = "campaign";
    await startMatch({ modeId: "campaign", raceId: "mushboom_forest", levelId: ch.levelId, opponents: 1 });
    const board = document.getElementById("screen-board");
    if (!board || !board.classList.contains("screen--active")) this.onLeaveBoard();
  },

  // Tras construir la partida: intro de Nizak antes de empezar a jugar.
  async afterStart() {
    const ch = this.ch(this.run.n);
    await this._warIntro(ch);
    if (!this.active || !this.run) return;
    if (typeof Turns !== "undefined") Turns.showTurnBanner();
  },

  _free(r, c, size) {
    if (r < 0 || c < 0 || r >= size || c >= size) return false;
    if (typeof Obelisks !== "undefined" && !Obelisks._tileFree(r, c)) return false;
    const mods = [typeof Resources !== "undefined" && Resources, typeof Bushes !== "undefined" && Bushes, typeof Oracle !== "undefined" && Oracle,
      typeof Drums !== "undefined" && Drums, typeof Altar !== "undefined" && Altar, typeof Bumpers !== "undefined" && Bumpers];
    return mods.every((m) => !(m && m.at && m.at(r, c)));
  },

  onMatchBuilt(size) {
    const ch = this.ch(this.run.n);
    if (typeof Obelisks !== "undefined") {
      const eo = Obelisks.byTeam("enemy");
      if (eo) { eo.el.remove(); Obelisks.list = Obelisks.list.filter((o) => o !== eo); }
    }
    if (typeof Villages !== "undefined") Villages.resetAll();
    if (typeof Altar !== "undefined") Altar.resetAll();
    if (typeof Gnome !== "undefined") Gnome.resetAll();

    const ob = Obelisks.byTeam("player");
    this._setupObelisk(ob);

    // Puntos de partida (no se extraen) y una unidad básica junto al Obelisco.
    if (typeof Glory !== "undefined") { Glory.points.player = 0; Glory.addNow("player", CAMPAIGN_START_GLORY + 2 * this.upLevel("prov")); }
    const roster = Object.keys(UNIT_TYPES).filter((k) => UNIT_TYPES[k].raceId === "mushboom_forest");
    roster.sort((a, b) => Units.recruitPriceFor(a) - Units.recruitPriceFor(b));
    const adj = Obelisks._adjacentFreeTiles(ob);
    if (adj.length) {
      const spot = adj[Math.floor(Math.random() * adj.length)];
      const u = Units.spawnUnit({ typeId: roster[0], row: spot.row, col: spot.col, team: "player" });
      if (typeof Fog !== "undefined" && Fog.revealForUnit) Fog.revealForUnit(u);
    }

    // Campamentos de Rastreadores con gnomos enjaulados.
    const placed = [];
    for (let k = 0; k < ch.camps; k++) {
      let spot = null;
      for (let minD = 8; minD >= 3 && !spot; minD -= 1) {
        for (let a = 0; a < 300 && !spot; a++) {
          const r = 2 + Math.floor(Math.random() * (size - 4)), c = 2 + Math.floor(Math.random() * (size - 4));
          if (!this._free(r, c, size)) continue;
          if (this._cheb({ row: r, col: c }, ob) < minD + 2) continue;
          if (placed.some((p) => this._cheb(p, { row: r, col: c }) < minD)) continue;
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
        const gn = Gnome.spawnNear(spot.row, spot.col);
        this._cage(gn);
        camp.gnomes.push(gn);
      }
      this._camps.push(camp);
    }

    // Un gnomo suelto cerca del inicio para aprender a cogerlo.
    Gnome.spawnNear(Math.min(size - 1, ob.row + (ob.row < size / 2 ? 4 : -4)), Math.min(size - 1, ob.col + (ob.col < size / 2 ? 3 : -3)));
    if (typeof Obelisks.refreshAll === "function") Obelisks.refreshAll();
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
    if (img) { img.classList.add("camp-cage--open"); setTimeout(() => img.remove(), 520); gn._cageEl = null; }
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
    btn.addEventListener("click", (e) => { e.stopPropagation(); this._click(); this._askExtract(); });
    if (typeof Tooltip !== "undefined") Tooltip.attach(btn, this.t("cmp_extract"));
    menu.appendChild(btn);
  },

  // ---------- Marcador ----------
  _showHud() {
    if (!this._hud) { this._hud = document.createElement("div"); this._hud.className = "camp-hud"; document.body.appendChild(this._hud); }
    this._hud.style.display = "flex";
    this._refreshHud();
  },
  _refreshHud() {
    if (!this._hud || !this.run) return;
    const r = this.run;
    this._hud.classList.toggle("camp-hud--ok", r.delivered >= r.goal);
    this._hud.innerHTML = `<span class="camp-hud__item"><i class="ph-fill ph-users-three"></i> ${this.t("cmp_hud", { a: r.delivered, b: r.goal })}</span>`;
  },
  _bump() { if (!this._hud) return; this._hud.classList.remove("camp-hud--bump"); void this._hud.offsetWidth; this._hud.classList.add("camp-hud--bump"); },
  _banner(txt) { if (typeof Turns !== "undefined" && Turns.showBanner) Turns.showBanner(txt); },

  // ---------- Eventos del motor ----------
  onUnitRemoved(unit) {
    const run = this.run;
    if (!run || run.over || unit.team !== "enemy") return;
    run.kills++;
    if (typeof Glory !== "undefined") Glory.addNow("player", CAMPAIGN_KILL_POINTS);
    this._camps.forEach((camp) => {
      if (camp.open) return;
      if (camp.guards.every((id) => !Units.list.some((u) => u.id === id))) {
        camp.open = true;
        camp.gnomes.forEach((g) => this._openCage(g));
        this._banner(this.t("cmp_free"));
        if (typeof SFX !== "undefined" && SFX.passSuccess) SFX.passSuccess();
      }
    });
  },

  // Un gnomo se ha estampado contra el Obelisco propio (js/obelisks.js): sacrificio, sin daño al Obelisco.
  onSacrifice(unit, pts) {
    const run = this.run;
    if (!run || run.over) return;
    run.delivered++;
    if (pts > 0 && typeof Glory !== "undefined") Glory.addFlying("player", pts, unit.el);
    this._refreshHud(); this._bump();
    if (run.delivered >= run.goal && !run.warnedDone) { run.warnedDone = true; this._banner(this.t("cmp_done_banner")); }
  },

  // Inicio de turno del jugador: avisos.
  onTurnStart(team) {
    const run = this.run;
    if (!this.active || !run || run.over || team !== "player") return;
    const ob = Obelisks.byTeam("player");
    if (ob && Units.list.some((u) => u.typeId === "rompeobeliscos" && this._cheb(u, ob) <= 1)) this._banner(this.t("cmp_warn_ob"));
    if (!run.warnedNone && Gnome.list.length && !Gnome.list.some((g) => g.caged)) { run.warnedNone = true; this._banner(this.t("cmp_warn_none")); }
  },

  // ---------- IA de los neutrales ----------
  async onTurnEnd(team) {
    if (!this.active || team !== "player" || !this.run || this.run.over) return;
    this._maybeSpawnSneaker();
    await this.neutralTurn();
    this._checkStuck();
  },

  _maybeSpawnSneaker() {
    const ch = this.ch(this.run.n), sn = ch.sneak;
    if (!sn || Turns.roundNumber % sn.every !== 0) return;
    if (Units.list.filter((u) => u.typeId === "rompeobeliscos").length >= sn.max) return;
    const ob = Obelisks.byTeam("player"), size = Units.boardSize;
    let best = null;
    for (let a = 0; a < 250; a++) {
      const r = Math.floor(Math.random() * size), c = Math.floor(Math.random() * size);
      if (!this._free(r, c, size)) continue;
      const d = this._cheb({ row: r, col: c }, ob);
      if (d < 10) continue;
      if (!best || d > best.d) best = { row: r, col: c, d };
      if (d >= 14) break;
    }
    if (best) Units.spawnUnit({ typeId: "rompeobeliscos", row: best.row, col: best.col, team: "enemy" });
  },

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
          if ((typeof MatchCleanup !== "undefined" && MatchCleanup.epoch !== ep) || !g.el || !Units.list.includes(g) || this.run.over) break;
          if (!Turns.canAct(g)) break;
          let acted = false;
          try { acted = g.typeId === "rompeobeliscos" ? await this._sneakAct(g) : await this._guardAct(g); } catch (e) { console.warn("[Campaign] neutral", e); }
          if (!acted) break;
          await this._sleep(240);
        }
      }
    } finally { Turns.activeTeam = prevTeam; }
  },

  async _guardAct(g) {
    const ch = this.ch(this.run.n);
    let best = null;
    Units.list.filter((u) => u.team === "player").forEach((u) => {
      const d = this._cheb(u, g);
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

  // Rompeobeliscos: golpean al jugador si lo tienen pegado; si no, se acercan poco a poco al Obelisco y le pegan.
  async _sneakAct(u) {
    const ob = Obelisks.byTeam("player");
    if (!ob) return false;
    const close = Combat.attackableEnemies(u).find((o) => o.approach.row === u.row && o.approach.col === u.col);
    if (close) { await Combat.attack(u, close.target); return true; }
    if (this._cheb(u, ob) <= 1) { await this._hitObelisk(u, ob); return true; }
    const dest = Turns._aiPickMoveTileToward(u, { row: ob.row, col: ob.col });
    if (!dest) return false;
    await Movement.moveTo(u, dest.row, dest.col);
    if (typeof Turns.forceOutOfActions === "function") Turns.forceOutOfActions(u); // solo avanzan una vez por turno: llegan poco a poco
    return true;
  },

  async _hitObelisk(u, ob) {
    Units.faceTowardsTile(u, ob.row, ob.col);
    Turns.useAction(u);
    ob.hp = Math.max(0, ob.hp - 1);
    if (typeof Units.updateHpBar === "function") Units.updateHpBar(ob);
    if (typeof SFX !== "undefined" && SFX.hit) SFX.hit();
    ob.el.classList.remove("obelisk--camp-hit"); void ob.el.offsetWidth; ob.el.classList.add("obelisk--camp-hit");
    await this._sleep(380);
    if (ob.hp <= 0) await Obelisks._destroy(ob);
  },

  _checkStuck() {
    if (!this.run || this.run.over) return;
    const mine = Units.list.some((u) => u.team === "player");
    const cheapest = Math.min(...Object.keys(UNIT_TYPES).filter((k) => UNIT_TYPES[k].raceId === "mushboom_forest").map((k) => Units.recruitPriceFor(k)));
    if (!mine && Glory.points.player < cheapest) this.onGameEnd(false);
  },

  // ---------- Extracción y resultado ----------
  _askExtract() {
    if (!this.run || this.run.over || this._askEl) return;
    const ov = document.createElement("div");
    ov.className = "camp-ask";
    const c = Resources.counts;
    ov.innerHTML = `<div class="camp-ask__panel">
      <div class="camp-ask__q">${this.t("cmp_extract_q")}</div>
      <div class="camp-ask__info">${this.t("cmp_extract_info")}<br><b>${this.run.delivered}/${this.run.goal}</b> ${this.t("cmp_gnomes").toLowerCase()}
        <span class="camp-costs">${CAMPAIGN_RES.map((r) => `<span class="camp-cost"><img src="${CAMPAIGN_RES_ICON[r]}" alt="">${c[r] || 0}</span>`).join("")}</span></div>
      <div class="camp-ask__row"><button class="camp-ask__btn camp-ask__btn--yes">${this.t("cmp_yes")}</button><button class="camp-ask__btn camp-ask__btn--no">${this.t("cmp_no")}</button></div></div>`;
    document.body.appendChild(ov);
    this._askEl = ov;
    const close = () => { ov.remove(); this._askEl = null; };
    ov.querySelector(".camp-ask__btn--no").addEventListener("click", () => { if (typeof SFX !== "undefined" && SFX.back) SFX.back(); close(); });
    ov.querySelector(".camp-ask__btn--yes").addEventListener("click", () => { this._click(); close(); this._finish("extract"); });
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
    const got = {};
    CAMPAIGN_RES.forEach((k) => { const n = (Resources.counts && Resources.counts[k]) || 0; got[k] = fallen ? Math.floor(n / 2) : n; });
    const completed = !fallen && r.delivered >= r.goal;
    this.s.gnomes += r.delivered;
    CAMPAIGN_RES.forEach((k) => { this.s.res[k] += got[k]; this.s.earnedRes += got[k]; });
    if (completed) this.s.done[r.n] = true;
    this.persist();
    if (typeof SFX !== "undefined") { if (fallen && SFX.defeat) SFX.defeat(); else if (SFX.victory) SFX.victory(); }
    this._showResult({ completed, fallen, got });
  },

  _showResult({ completed, fallen, got }) {
    const r = this.run;
    const title = fallen ? this.t("cmp_res_fail") : completed ? this.t("cmp_res_ok") : this.t("cmp_res_part");
    const ov = document.createElement("div");
    ov.className = "camp-result";
    ov.innerHTML = `<div class="camp-result__panel">
      <div class="camp-result__title${fallen ? " camp-result__title--bad" : ""}">${title}</div>
      <div class="camp-result__rows">
        <div><span>${this.t("cmp_res_g")}</span><b>${r.delivered}</b></div>
        <div class="camp-result__res">${CAMPAIGN_RES.map((k) => `<span class="camp-cost"><img src="${CAMPAIGN_RES_ICON[k]}" alt="">+${got[k]}</span>`).join("")}</div>
        <div><span>${this.t("cmp_res_k")}</span><b>${r.kills}</b></div>
        <div class="camp-result__goal">${this.t("cmp_res_goal", { n: r.goal })}${fallen ? "<br>" + this.t("cmp_res_half") : ""}</div></div>
      <button class="camp-result__btn">${this.t("cmp_back_map")}</button></div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add("camp-result--on"));
    ov.querySelector(".camp-result__btn").addEventListener("click", () => { this._click(); ov.remove(); this.leaveToMap(); });
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

  onLeaveBoard() {
    if (!this.active && !this._hud) return;
    this.active = false;
    if (this._hud) this._hud.style.display = "none";
    ["_askEl", "_resultEl", "_warEl"].forEach((k) => { if (this[k]) { this[k].remove(); this[k] = null; } });
    if (typeof Obelisks !== "undefined") Obelisks.gameOver = false;
    this._camps = [];
  },

  // ---------- Intro "La Guerra Eterna" (la escena vive en js/campaign-intro.js) ----------
  _warIntro(ch) {
    return CampaignIntro.play({
      lines: this.t("cmp_intro" + ch.n).split("|"),
      per: ch.n === 1 ? 6 : 4.8,
      seed: 7 + ch.n,
      title: this.t(ch.n === 1 ? "cmp_war" : "cmp_ch" + ch.n),
      nizak: this.t("cmp_nizak"), skip: this.t("cmp_skip"), start: this.t("cmp_start"),
      click: () => this._click(),
      onMount: (el) => { this._warEl = el; },
      onEnd: (el) => { if (this._warEl === el) this._warEl = null; },
    });
  },
};

document.addEventListener("DOMContentLoaded", () => Campaign.init());

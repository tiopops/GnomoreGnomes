/* Gnomore Gnomes — modo CAMPAÑA (extracción).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - El estado de la campaña (capítulos hechos, gnomos y recursos extraídos, mejoras
       compradas), guardado en localStorage por cuenta (gg_campaign_<uid>).
     - El mapa de capítulos, la tienda de mejoras de campaña, y su tutorial.
     - La intro "La Guerra Eterna" narrada por Nizak al empezar cada capítulo.
     - La partida de campaña. El motor normal solo le avisa con ganchos mínimos protegidos por
       `Campaign.active` (units, obelisks, gnome, glory, armory, artifacts, newgame-flow, matchcleanup).
       Sin Campaña activa nada de esto cambia el juego normal.

   Reglas pedidas (resumen): conseguir X gnomos por nivel; gnomos enjaulados por neutrales
   (Rastreadores) o sueltos; los gnomos se ESTAMPAN contra el Obelisco propio, que no pierde vida (es un
   sacrificio) y solo sirve de zona de extracción; puntos de partida (los sobrantes SÍ se extraen y compran mejoras): empiezas con 4 y 1 unidad básica, +3 por baja de neutral y los puntos del gnomo al estamparlo
   (tope +5 por gnomo); sin puntos por turno; población máxima 3 (mejorable); se extraen gnomos, madera, roca y metal,
   que compran mejoras de campaña; Rompeobeliscos
   furtivos (1 vida, 1 daño) aparecen lejos y se acercan a golpear el Obelisco; avisos al empezar turno.
   PENDIENTE: barras de experiencia/niveles de unidad, nube, GnomOgro (cap. 5), mapa de regiones. */

// Posición de cada isla en el mapa: [x, y, x móvil, y móvil, ancho, ancho móvil] (% del tablero / px)
const CAMPAIGN_MAP_POS = { 1: [12, 56, 32, 79, 150, 118], 2: [31, 32, 68, 66, 168, 128], 3: [50, 58, 32, 47, 176, 128], 4: [69, 30, 68, 28, 184, 134], 5: [88, 56, 44, 8, 200, 150] };

const CAMPAIGN_CHAPTERS = [
  { n: 1, levelId: "mushboom_forest", goal: 3, req: { gnomes: 0, res: 0 }, camps: 2, guards: [1, 1], cages: 2, pool: ["rastreador"], aggro: 4, sneak: { every: 4, max: 1 }, foe: { arma: 0, armadura: 0 }, tempo: 1 },
  { n: 2, levelId: "mushboom_forest", goal: 4, req: { gnomes: 3, res: 8 }, camps: 3, guards: [1, 2], cages: 2, pool: ["rastreador"], aggro: 5, sneak: { every: 3, max: 2 }, foe: { arma: 0, armadura: 0 }, tempo: 0.9 },
  { n: 3, levelId: "mushboom_forest", goal: 5, req: { gnomes: 8, res: 24 }, camps: 4, guards: [2, 2], cages: 2, pool: ["rastreador", "rastreador", "portamuros"], aggro: 5, sneak: { every: 3, max: 3 }, foe: { arma: 1, armadura: 0 }, tempo: 0.85 },
  { n: 4, levelId: "mushboom_forest", goal: 6, req: { gnomes: 15, res: 50 }, camps: 5, guards: [2, 3], cages: 2, pool: ["rastreador", "portamuros"], aggro: 6, sneak: { every: 2, max: 4 }, foe: { arma: 1, armadura: 1 }, tempo: 0.8 },
  { n: 5, levelId: "mushboom_forest", boss: true, goal: 1, req: { gnomes: 24, res: 90 } },
];

// Límite de turnos del nivel: se autoajusta con el objetivo (3 turnos por gnomo: abrir jaula, cogerlo, golpearlo y
// estamparlo), los campamentos (1 por campamento para llegar a ellos) y la dureza de sus guardias (medio turno
// por guardia), y se aprieta con el `tempo` del capítulo. Capítulo 1 → 18, 2 → 21, 3 → 25, 4 → 28; el jefe
// tiene un tope fijo.
// CURVA DE DIFICULTAD (pedida: que crezca para que compense gastar recursos en mejoras). Cada capítulo pide
// una mejora concreta: `tempo` aprieta los turnos (→ Reloj de arena / Prórroga) y `foe` da a TODOS los
// neutrales del capítulo +ataque / +defensa (→ Arma / Armadura). Se aplica en Armory vía Campaign.foeBonus.
function campaignTurnLimit(ch) {
  if (ch.boss) return 20;
  const avgGuards = ch.guards ? (ch.guards[0] + ch.guards[1]) / 2 : 1;
  return Math.round((6 + ch.goal * 3 + (ch.camps || 0) + (ch.camps || 0) * avgGuards * 0.5) * (ch.tempo || 1));
}

// Mejoras exclusivas de campaña: se pagan con los recursos extraídos.
// Categorías de mejoras (mismos colores que las ramas del árbol de habilidades de las partidas normales).
const CAMPAIGN_CATS = [
  { id: "combate", acc: "#d9566b", icon: "ph-sword" },
  { id: "ejercito", acc: "#5d93e0", icon: "ph-users-three" },
  { id: "extraccion", acc: "#5fa84a", icon: "ph-package" },
];
const CAMPAIGN_UPGRADES = [
  { id: "arma", cat: "combate", icon: "ph-sword", max: 2, cost: [{ roca: 4, metal: 1 }, { roca: 8, metal: 3 }] },
  { id: "armadura", cat: "combate", icon: "ph-shield", max: 2, cost: [{ madera: 4, metal: 1 }, { madera: 8, metal: 3 }] },
  { id: "cazador", cat: "combate", icon: "ph-coins", max: 3, cost: [{ metal: 2 }, { metal: 4 }, { metal: 6 }] },
  { id: "prov", cat: "ejercito", icon: "ph-basket", max: 3, cost: [{ madera: 3 }, { madera: 6 }, { madera: 9 }] },
  { id: "pop", cat: "ejercito", icon: "ph-users-three", max: 5, cost: [{ madera: 4, roca: 2 }, { madera: 6, roca: 4 }, { madera: 9, roca: 6 }, { madera: 12, roca: 9 }, { madera: 16, roca: 13 }] },
  { id: "carga", cat: "ejercito", icon: "ph-hand-grabbing", max: 3, cost: [{ roca: 3, metal: 1 }, { roca: 6, metal: 2 }, { roca: 9, metal: 4 }] },
  { id: "turnos", cat: "extraccion", icon: "ph-hourglass-high", max: 3, cost: [{ madera: 4, roca: 2 }, { madera: 7, roca: 5 }, { madera: 10, roca: 8 }] },
  { id: "vision", cat: "extraccion", icon: "ph-binoculars", max: 1, cost: [{ roca: 6, metal: 2 }] },
  { id: "recolector", cat: "extraccion", icon: "ph-hand-coins", max: 2, cost: [{ madera: 6, metal: 1 }, { madera: 12, metal: 3 }] },
  { id: "botin", cat: "extraccion", icon: "ph-package", max: 2, cost: [{ madera: 5, roca: 5 }, { madera: 10, roca: 10 }] },
  { id: "prorroga", cat: "extraccion", icon: "ph-timer", max: 3, cost: [{ roca: 4, metal: 1 }, { roca: 8, metal: 3 }, { roca: 12, metal: 6 }] },
  { id: "seguro", cat: "extraccion", icon: "ph-first-aid-kit", max: 2, cost: [{ madera: 5, metal: 1 }, { madera: 10, metal: 4 }] },
];
// Más exigentes (+30%, redondeado; lo que costaba 1 sigue costando 1).
CAMPAIGN_UPGRADES.forEach((u) => u.cost.forEach((c) => { ["madera", "roca", "metal"].forEach((k) => { if (c[k]) c[k] = Math.round(c[k] * 1.3); }); }));
// Coste en puntos de cada nivel de mejora (además de los recursos): 2, 4, 6... (vision cuesta el doble).
CAMPAIGN_UPGRADES.forEach((u) => u.cost.forEach((c, i) => { c.p = (u.id === "vision" ? 4 : 2) * (i + 1); }));
const CAMPAIGN_RES = ["madera", "roca", "metal"];
const CAMPAIGN_PTS_ICON = "assets/iconos/gloria_mushboom_forest.png"; // los puntos sobrantes de la partida también se extraen
// Gnomos que tiene cada capítulo en total: los de las jaulas de sus campamentos + 1 suelto. Los que ya estampaste NO vuelven a aparecer al rejugarlo.
function campaignChapterGnomes(ch) { return ch.boss ? 0 : (ch.camps || 0) * (ch.cages || 0) + 1; }
const CAMPAIGN_RES_ICON = { madera: "assets/iconos/recurso_madera.png", roca: "assets/iconos/recurso_roca.png", metal: "assets/iconos/recurso_metal.png" };

const CAMPAIGN_INTRO_VOICES = { es: "assets/campana/voz_intro_es.mp3?v=1", en: "assets/campana/voz_intro_en.mp3?v=1" };
// Tiempos de los 4 subtítulos de la intro por idioma (cada locución tiene su propio ritmo); sin entrada = los de español.
const CAMPAIGN_INTRO_SUB_TIMES = { es: [[0.3, 10.5], [10.9, 20.2], [20.4, 31.3], [31.6, 40.8]], en: [[0.3, 10.0], [10.4, 20.4], [20.7, 29.5], [31.5, 40.0]] }; // añadir aquí la voz de cada idioma nuevo
const CAMPAIGN_KILL_POINTS = 3;
const CAMPAIGN_START_GLORY = 4;
const CAMPAIGN_EXTRACT_ICON = "assets/iconos/extraccion.png?v=2";
const CAMPAIGN_EXTRACT_RADIUS = 2;
const CAMPAIGN_BASE_POP = 3;
const CAMPAIGN_BASE_CARRY = 5;

(function registerCampaignStrings() {
  const es = {
    cmp_abandon: "Abandonar campaña", cmp_abandon_q: "¿ABANDONAR LA CAMPAÑA?", cmp_abandon_info: "Perderás TODO el progreso: capítulos superados, gnomos, recursos y mejoras. La campaña empezará de cero y no se puede deshacer.", cmp_abandon_yes: "SÍ, ABANDONAR", cmp_abandon_no: "CANCELAR",
    cmp_stat_stamped: "ESTAMPADOS", cmp_star_hint: "Completa el capítulo · estampa a todos los gnomos · elimina todos los campamentos en una misma partida", cmp_res_stars: "ESTRELLAS", cmp_depleted: "Aquí ya no queda ni un gnomo. Todos estampados.", cmp_depleted_btn: "AGOTADO",
    menu_campaign: "Campaña", cmp_title: "CAMPAÑA", cmp_gnomes: "GNOMOS", cmp_goal: "Estampa {n} gnomos contra el Obelisco.",
    cmp_play: "JUGAR", cmp_soon: "PRÓXIMAMENTE", cmp_locked: "BLOQUEADO", cmp_done: "COMPLETADO", cmp_chapter: "CAPÍTULO {n}",
    cmp_need: "Necesitas {g} gnomos y {r} recursos extraídos (tienes {hg} y {hr}).", cmp_need_prev: "Completa el capítulo anterior.",
    cmp_boss: "El GnomOgro te espera... pero aún no está listo.", cmp_shop: "MEJORAS DE CAMPAÑA", cmp_tab_map: "MAPA", cmp_tab_up: "MEJORAS",
    cmp_buy: "COMPRAR", cmp_max: "AL MÁXIMO",
    cmp_up_prov: "Provisiones", cmp_up_prov_d: "Empiezas cada nivel con +2 puntos por nivel de mejora.",
    cmp_up_arma: "Garrotes afilados", cmp_up_arma_d: "+1 de ataque a todas tus unidades.",
    cmp_up_armadura: "Cortezas duras", cmp_up_armadura_d: "+1 de aguante a todas tus unidades.",
    cmp_up_pop: "Más barracones", cmp_up_pop_d: "+1 de población máxima.",
    cmp_cat_combate: "COMBATE", cmp_cat_ejercito: "EJÉRCITO", cmp_cat_extraccion: "EXTRACCIÓN", cmp_lvl: "NIVEL {a}/{b}",
    cmp_up_cazador: "Botín de guerra", cmp_up_cazador_d: "Cada neutral que derrotas te da +1 punto de gloria extra por nivel.",
    cmp_up_turnos: "Margen de turnos", cmp_up_turnos_d: "+2 turnos en el límite de cada nivel por nivel de mejora.",
    cmp_up_vision: "Catalejo", cmp_up_vision_d: "Todas tus unidades y tu Obelisco ven una casilla más lejos: campamentos y jaulas se descubren antes.",
    cmp_up_recolector: "Manos largas", cmp_up_recolector_d: "Cada fuente de recursos te da +1 unidad extra por nivel al recogerla.",
    cmp_up_botin: "Saco sin fondo", cmp_up_botin_d: "Al extraer te llevas +1 de cada recurso recogido (+2 en el nivel 2).",
    cmp_up_prorroga: "Prórroga", cmp_up_prorroga_d: "Si se acaba el tiempo conservas un 10% más de recursos por nivel (sobre la mitad).",
    cmp_up_seguro: "Red de seguridad", cmp_up_seguro_d: "Si caes, te salvas un 20% de los recursos por nivel (los gnomos se pierden igual).",
    cmp_res_ins: "Tu red de seguridad rescata el {p}% de los recursos.", cmp_res_tprc: "No reuniste a todos los gnomos a tiempo: conservas los gnomos y el {p}% de los recursos.",
    cmp_up_carga: "Gnomos más cargables", cmp_up_carga_d: "Los gnomos aguantan +1 punto de golpes antes de estamparlos.",
    cmp_how: "CÓMO SE JUEGA",
    cmp_hud: "{a}/{b}", cmp_extract: "Extraer", cmp_extract_q: "¿EXTRAER Y TERMINAR?", cmp_extract_far: "UNIDADES DEMASIADO LEJOS DEL OBELISCO", cmp_extract_info: "Te llevas los gnomos, los recursos y los puntos que te sobren.",
    cmp_yes: "EXTRAER", cmp_no: "SEGUIR", cmp_res_ok: "¡CAPÍTULO SUPERADO!", cmp_res_part: "EXTRACCIÓN COMPLETADA", cmp_res_fail: "HAS CAÍDO",
    cmp_res_loot: "BOTÍN", cmp_res_lost: "BOTÍN PERDIDO", cmp_res_g: "Gnomos estampados", cmp_res_k: "Neutrales derrotados", cmp_res_goal: "Objetivo: {n} gnomos", cmp_res_half: "Al caer te quedas sin nada: ni gnomos, ni recursos, ni puntos.", cmp_res_time: "¡SE ACABÓ EL TIEMPO!", cmp_res_timeup: "No reuniste a todos los gnomos a tiempo: conservas los gnomos, pero solo la mitad de los recursos.", cmp_hud_turns: "{a} turnos", cmp_stat_gnomes: "gnomos", cmp_stat_turns: "turnos", cmp_stat_camps: "campamentos", cmp_stat_foeatk: "ataque enemigo", cmp_stat_foedef: "defensa enemiga", cmp_warn_turns: "¡QUEDAN {n} TURNOS!",
    cmp_back_map: "VOLVER AL MAPA", cmp_free: "¡JAULA ABIERTA!", cmp_done_banner: "¡OBJETIVO CUMPLIDO!", cmp_warn_ob: "¡ATACAN TU OBELISCO!", cmp_warn_none: "YA NO QUEDAN GNOMOS EN LA ZONA",
    cmp_skip: "SALTAR", cmp_hold_skip: "MANTÉN PARA SALTAR", cmp_start: "COMENZAR", cmp_war: "LA GUERRA ETERNA", cmp_next: "SIGUIENTE", cmp_ok: "ENTENDIDO", cmp_nizak: "Nizak",
    cmp_ch1: "Capítulo 1 · Claro de las Setas", cmp_ch2: "Capítulo 2 · Orilla Pantanosa", cmp_ch3: "Capítulo 3 · Espesura Profunda", cmp_ch4: "Capítulo 4 · Cumbre del Hongo", cmp_ch5: "Capítulo 5 · El GnomOgro",
    cmp_intro1: "El reino de Gnomoria lleva felizmente en guerra más de tres siglos... Una felicidad que solo sus habitantes entienden, pero felicidad al fin y al cabo.|La llamaron: La Guerra Eterna, una tradición que pasó de padres a hijos. Para aquellos que pudieron llegar a tener descendencia, claro.|¡Hasta que llegaron ELLOS! Los gnomos, y mancharon todo con sus arcoíris, sus chuches sin gluten y su empeño en acabar... ¡CON NUESTRA GUERRA!|Así se fundó Gnomore Gnomes. Ahora nuestra guerra puede esperar, pero las ganas de exterminar a los gnomos, no.",
    cmp_intro2: "Los gnomos se extienden como una plaga de purpurina.|Hasta junto a la orilla se oyen ya sus cantos de hermandad.|Estampad a los enjaulados antes de que sigan predicando la paz.",
    cmp_intro3: "Más adentro del bosque, hasta las setas parecen charlar en vez de explotar.|Algo huele a concordia, y ese olor me revuelve el estómago.|Traedme más gnomos: hay que saber dónde se esconden.",
    cmp_intro4: "En lo alto del bosque, los Rastreadores vigilan jaulas por costumbre... y por un buen sueldo.|Entrad, sacad a los gnomos y que nadie mencione la palabra abrazo.",
    cmp_intro5: "Se acerca el GnomOgro.|Pero eso, mis queridos guardabosques, es otra historia.",
    cmp_tut1_t: "El objetivo", cmp_tut1: "Cada capítulo te pide estampar un número de gnomos contra tu Obelisco. Empiezas con 1 unidad básica y 4 puntos de partida. Población máxima: 3 (mejorable en MEJORAS).",
    cmp_tut2_t: "Jaulas y neutrales", cmp_tut2: "Los gnomos están enjaulados en campamentos vigilados por Rastreadores. Derrota a todos los guardias de un campamento y las jaulas se abren. Cada baja te da +3 puntos.",
    cmp_tut3_t: "Estampar gnomos", cmp_tut3: "Un gnomo libre huye de ti como siempre. Cógelo, pégale para cargarle puntos (hasta +5) y llévalo al Obelisco: aquí no le hace daño, es un sacrificio, y los puntos del gnomo pasan a tu bolsa.",
    cmp_tut4_t: "Puntos y recursos", cmp_tut4: "Usa los puntos para reclutar, pero ojo: los que te sobren al extraer te los llevas y también compran mejoras. Nadie te da puntos por turno. Recoge además madera, roca y metal.",
    cmp_tut5_t: "Furtivos", cmp_tut5: "De vez en cuando aparecen Rompeobeliscos lejos de tu base y se acercan a golpear el Obelisco. Son débiles, pero si lo derriban, pierdes. Te avisaré al empezar tu turno.",
    cmp_tut6_t: "Extraer", cmp_tut6: "Con el Obelisco seleccionado, el icono de salida a la derecha de reclutar termina la partida, pero solo si todas tus unidades vivas están junto al obelisco. Te llevas los gnomos, los recursos y los puntos que te sobren; se invierten en mejoras desde el menú de campaña. Si caes, te quedas sin nada.",
  };
  const en = {
    cmp_abandon: "Abandon campaign", cmp_abandon_q: "ABANDON THE CAMPAIGN?", cmp_abandon_info: "You will lose ALL progress: cleared chapters, gnomes, resources and upgrades. The campaign will start over and this cannot be undone.", cmp_abandon_yes: "YES, ABANDON", cmp_abandon_no: "CANCEL",
    cmp_stat_stamped: "SLAMMED", cmp_star_hint: "Finish the chapter · slam every gnome · wipe out every camp in a single match", cmp_res_stars: "STARS", cmp_depleted: "Not a single gnome left here. All slammed.", cmp_depleted_btn: "DEPLETED",
    menu_campaign: "Campaign", cmp_title: "CAMPAIGN", cmp_gnomes: "GNOMES", cmp_goal: "Slam {n} gnomes into the Obelisk.",
    cmp_play: "PLAY", cmp_soon: "COMING SOON", cmp_locked: "LOCKED", cmp_done: "COMPLETED", cmp_chapter: "CHAPTER {n}",
    cmp_need: "You need {g} gnomes and {r} extracted resources (you have {hg} and {hr}).", cmp_need_prev: "Complete the previous chapter.",
    cmp_boss: "The GnomOgre awaits... but it isn't ready yet.", cmp_shop: "CAMPAIGN UPGRADES", cmp_tab_map: "MAP", cmp_tab_up: "UPGRADES",
    cmp_buy: "BUY", cmp_max: "MAXED",
    cmp_up_prov: "Provisions", cmp_up_prov_d: "Start every level with +2 points per upgrade level.",
    cmp_up_arma: "Sharpened clubs", cmp_up_arma_d: "+1 attack for all your units.",
    cmp_up_armadura: "Hardened bark", cmp_up_armadura_d: "+1 toughness for all your units.",
    cmp_up_pop: "More barracks", cmp_up_pop_d: "+1 maximum population.",
    cmp_cat_combate: "COMBAT", cmp_cat_ejercito: "ARMY", cmp_cat_extraccion: "EXTRACTION", cmp_lvl: "LEVEL {a}/{b}",
    cmp_up_cazador: "War spoils", cmp_up_cazador_d: "Every neutral you defeat gives +1 extra glory point per level.",
    cmp_up_turnos: "Turn margin", cmp_up_turnos_d: "+2 turns on every level's limit per upgrade level.",
    cmp_up_vision: "Spyglass", cmp_up_vision_d: "All your units and your Obelisk see one tile further: camps and cages show up sooner.",
    cmp_up_recolector: "Long arms", cmp_up_recolector_d: "Every resource source gives +1 extra unit per level when collected.",
    cmp_up_botin: "Bottomless sack", cmp_up_botin_d: "When you extract you take +1 of every resource you collected (+2 at level 2).",
    cmp_up_prorroga: "Extension", cmp_up_prorroga_d: "If time runs out you keep 10% more resources per level (on top of half).",
    cmp_up_seguro: "Safety net", cmp_up_seguro_d: "If you fall, you save 20% of the resources per level (gnomes are still lost).",
    cmp_res_ins: "Your safety net rescues {p}% of the resources.", cmp_res_tprc: "You did not gather every gnome in time: you keep the gnomes and {p}% of the resources.",
    cmp_up_carga: "Sturdier gnomes", cmp_up_carga_d: "Gnomes can take +1 point of hits before the slam.",
    cmp_how: "HOW TO PLAY",
    cmp_hud: "{a}/{b}", cmp_extract: "Extract", cmp_extract_q: "EXTRACT AND FINISH?", cmp_extract_far: "UNITS TOO FAR FROM THE OBELISK", cmp_extract_info: "You keep the gnomes, the resources and the points you have left.",
    cmp_yes: "EXTRACT", cmp_no: "KEEP GOING", cmp_res_ok: "CHAPTER CLEARED!", cmp_res_part: "EXTRACTION COMPLETE", cmp_res_fail: "YOU HAVE FALLEN",
    cmp_res_loot: "LOOT", cmp_res_lost: "LOOT LOST", cmp_res_g: "Gnomes slammed", cmp_res_k: "Neutrals defeated", cmp_res_goal: "Goal: {n} gnomes", cmp_res_half: "When you fall you keep nothing: no gnomes, no resources, no points.", cmp_res_time: "TIME IS UP!", cmp_res_timeup: "You did not gather every gnome in time: you keep the gnomes, but only half the resources.", cmp_hud_turns: "{a} turns", cmp_stat_gnomes: "gnomes", cmp_stat_turns: "turns", cmp_stat_camps: "camps", cmp_stat_foeatk: "enemy attack", cmp_stat_foedef: "enemy armour", cmp_warn_turns: "{n} TURNS LEFT!",
    cmp_back_map: "BACK TO THE MAP", cmp_free: "CAGE OPEN!", cmp_done_banner: "GOAL REACHED!", cmp_warn_ob: "YOUR OBELISK IS UNDER ATTACK!", cmp_warn_none: "NO GNOMES LEFT IN THE AREA",
    cmp_skip: "SKIP", cmp_hold_skip: "HOLD TO SKIP", cmp_start: "BEGIN", cmp_war: "THE ETERNAL WAR", cmp_next: "NEXT", cmp_ok: "GOT IT", cmp_nizak: "Nizak",
    cmp_ch1: "Chapter 1 · Mushroom Glade", cmp_ch2: "Chapter 2 · Boggy Shore", cmp_ch3: "Chapter 3 · Deep Thicket", cmp_ch4: "Chapter 4 · Fungus Peak", cmp_ch5: "Chapter 5 · The GnomOgre",
    cmp_intro1: "The kingdom of Gnomoria has been happily at war for more than three centuries... A happiness only its inhabitants understand, but happiness all the same.|They called it The Eternal War, a tradition passed down from parents to children. For those who managed to have children, of course.|Until THEY came! The gnomes, who stained everything with their rainbows, gluten-free candy and their determination to end... OUR WAR!|Thus Gnomore Gnomes was founded. Our war can wait now, but our hunger to exterminate the gnomes cannot.",
    cmp_intro2: "The gnomes spread like a plague of glitter.|Even by the shore you can hear their songs of brotherhood.|Slam the caged ones before they keep preaching peace.",
    cmp_intro3: "Deeper in the forest, even the mushrooms seem to chat instead of exploding.|Something smells of harmony, and it turns my stomach.|Bring me more gnomes: we must learn where they hide.",
    cmp_intro4: "High in the forest, Trackers guard cages out of habit... and for good pay.|Go in, get the gnomes out, and let nobody mention the word hug.",
    cmp_intro5: "The GnomOgre approaches.|But that, my dear rangers, is another story.",
    cmp_tut1_t: "The goal", cmp_tut1: "Every chapter asks you to slam a number of gnomes into your Obelisk. You start with 1 basic unit and 4 match points. Maximum population: 3 (upgradeable in UPGRADES).",
    cmp_tut2_t: "Cages and neutrals", cmp_tut2: "Gnomes are caged in camps guarded by Trackers. Defeat every guard of a camp and the cages open. Each kill gives you +3 points.",
    cmp_tut3_t: "Slamming gnomes", cmp_tut3: "A free gnome runs from you as usual. Grab it, hit it to charge points (up to +5) and take it to the Obelisk: it takes no damage here, it's a sacrifice, and the gnome's points go into your pool.",
    cmp_tut4_t: "Points and resources", cmp_tut4: "Spend points on recruiting, but mind this: the ones you have left when you extract come with you and also buy upgrades. Nobody gives you points per turn. Gather wood, rock and metal too.",
    cmp_tut5_t: "Sneakers", cmp_tut5: "Now and then Obelisk Breakers appear far from your base and creep up to hit the Obelisk. They are weak, but if they bring it down, you lose. I'll warn you at the start of your turn.",
    cmp_tut6_t: "Extract", cmp_tut6: "With the Obelisk selected, the exit icon right of recruit ends the match, but only if all your living units are next to the obelisk. You keep the gnomes, the resources and any points left; invest them in upgrades from the campaign menu. If you fall, you keep nothing.",
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
  _defaults() { return { v: 2, t: 0, gnomes: 0, pts: 0, got: {}, camps: {}, res: { madera: 0, roca: 0, metal: 0 }, earnedRes: 0, done: {}, up: {}, seenTut: false }; },
  get _db() { return typeof Account !== "undefined" ? Account._db : null; },
  // Normaliza lo que llega de localStorage o de la base de datos (solo números y mapas de números/booleanos).
  _norm(raw) {
    const d = this._defaults();
    if (!raw || typeof raw !== "object") return d;
    const n = (v) => (typeof v === "number" && isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    const map = (m, bool) => { const o = {}; if (m && typeof m === "object") Object.keys(m).slice(0, 60).forEach((k) => { const v = bool ? !!m[k] : n(m[k]); if (v) o[k] = v; }); return o; };
    d.t = n(raw.t); d.gnomes = n(raw.gnomes); d.pts = n(raw.pts); d.earnedRes = n(raw.earnedRes); d.got = map(raw.got, false); d.camps = map(raw.camps, false);
    CAMPAIGN_RES.forEach((k) => { d.res[k] = n(raw.res && raw.res[k]); });
    d.done = map(raw.done, true); d.up = map(raw.up, false); d.seenTut = !!raw.seenTut;
    return d;
  },
  hasProgress() {
    const s = this.s;
    return !!(s && (s.gnomes > 0 || s.pts > 0 || s.earnedRes > 0 || s.seenTut || Object.keys(s.done).length || Object.keys(s.up).length || CAMPAIGN_RES.some((k) => s.res[k] > 0)));
  },
  load() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(this._key()) || "null"); } catch (e) {}
    this.s = this._norm(raw);
    this._pull();
  },
  // Base de datos (Firestore): campaign/{uid}. Gana la copia más reciente (t); sin red o sin sesión sigue en este navegador.
  async _pull() {
    const uid = this._uid, db = this._db;
    if (!uid || !db) return;
    try {
      const snap = await db.collection("campaign").doc(uid).get();
      if (uid !== this._uid) return;
      if (snap.exists) {
        const r = this._norm(snap.data());
        if (r.t >= (this.s.t || 0)) {
          this.s = r;
          try { localStorage.setItem(this._key(), JSON.stringify(this.s)); } catch (e) {}
          this.render();
        } else this._push();
      } else if (this.hasProgress()) this._push();
    } catch (e) { console.warn("campaign:", e && e.code); }
  },
  async _push() {
    const uid = this._uid, db = this._db;
    if (!uid || !db || !this.s) return;
    try { await db.collection("campaign").doc(uid).set(this._norm(this.s)); } catch (e) { console.warn("campaign:", e && e.code); }
  },
  persist(now) {
    if (!this.s) return;
    this.s.t = Date.now();
    try { localStorage.setItem(this._key(), JSON.stringify(this.s)); } catch (e) {}
    clearTimeout(this._pushT);
    if (now) this._push(); else this._pushT = setTimeout(() => this._push(), 400);
  },
  // ---------- Abandonar campaña (botón del menú principal) ----------
  _askAbandon() {
    if (this._askEl) return;
    const ov = document.createElement("div");
    ov.className = "camp-ask";
    ov.innerHTML = `<div class="camp-ask__panel">
      <div class="camp-ask__q">${this.t("cmp_abandon_q")}</div>
      <div class="camp-ask__info">${this.t("cmp_abandon_info")}</div>
      <div class="camp-ask__row"><button class="camp-ask__btn camp-ask__btn--yes camp-ask__btn--cancel">${this.t("cmp_abandon_no")}</button><button class="camp-ask__btn camp-ask__btn--no camp-ask__btn--danger">${this.t("cmp_abandon_yes")}</button></div></div>`;
    document.body.appendChild(ov);
    this._askEl = ov;
    const close = () => { ov.remove(); this._askEl = null; };
    ov.querySelector(".camp-ask__btn--cancel").addEventListener("click", () => { if (typeof SFX !== "undefined" && SFX.back) SFX.back(); close(); });
    ov.querySelector(".camp-ask__btn--danger").addEventListener("click", () => { this._click(); close(); this.abandon(); });
    ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  },
  abandon() {
    this.s = this._defaults();
    this.tab = "map"; this.sel = 1;
    this.persist(true);
    this.render();
    if (typeof SFX !== "undefined" && SFX.defeat) SFX.defeat();
  },
  upLevel(id) { return (this.s && this.s.up[id]) || 0; },
  bonus(id) { return this.active && this.s ? this.upLevel(id) : 0; },
  // Veteranía de los neutrales del capítulo en juego (arma / armadura); 0 fuera de Campaña y en el tutorial.
  foeBonus(id) { if (!this.active || !this.run) return 0; const ch = this.ch(this.run.n); return (ch && ch.foe && ch.foe[id]) || 0; },
  popLimit() { return CAMPAIGN_BASE_POP + this.upLevel("pop"); },
  gnomeCap() { return CAMPAIGN_BASE_CARRY + this.upLevel("carga"); },
  canPay(cost) { return (this.s.pts || 0) >= (cost.p || 0) && CAMPAIGN_RES.every((r) => (this.s.res[r] || 0) >= (cost[r] || 0)); },
  // Campamentos eliminados en la MEJOR partida de ese capítulo (no se acumula entre intentos).
  campsBest(n) { const ch = this.ch(n); return ch ? Math.min(ch.camps || 0, (this.s.camps && this.s.camps[n]) || 0) : 0; },
  // Estrellas: 1 = capítulo completado, 2 = todos los gnomos estampados, 3 = todos los campamentos eliminados en una misma partida.
  starFlags(n) {
    const ch = this.ch(n);
    if (!ch || ch.boss) return [false, false, false];
    return [!!this.s.done[n], this.remaining(n) <= 0, this.campsBest(n) >= (ch.camps || 0)];
  },
  stars(n) { return this.starFlags(n).filter(Boolean).length; },
  _starsHtml(n, cls) { return `<span class="camp-stars ${cls || ""}">${this.starFlags(n).map((on) => `<i class="ph-fill ph-star camp-star${on ? " camp-star--on" : ""}"></i>`).join("")}</span>`; },
  remaining(n) { const ch = this.ch(n); return ch ? Math.max(0, campaignChapterGnomes(ch) - ((this.s.got && this.s.got[n]) || 0)) : 0; },
  pay(cost) { CAMPAIGN_RES.forEach((r) => { this.s.res[r] -= cost[r] || 0; }); this.s.pts -= cost.p || 0; },
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
    const pts = cost.p ? `<span class="camp-cost camp-cost--pts${(this.s.pts || 0) >= cost.p ? "" : " camp-cost--no"}"><img src="${CAMPAIGN_PTS_ICON}" alt="">${cost.p}</span>` : "";
    return pts + CAMPAIGN_RES.filter((r) => cost[r]).map((r) => `<span class="camp-cost${(this.s.res[r] || 0) >= cost[r] ? "" : " camp-cost--no"}"><img src="${CAMPAIGN_RES_ICON[r]}" alt="">${cost[r]}</span>`).join("");
  },


  // ---------- Mapa: islas flotantes + franja de ficha ----------
  _mapPoints(mobile) { return CAMPAIGN_CHAPTERS.map((c) => { const p = CAMPAIGN_MAP_POS[c.n] || [50, 50, 50, 50]; return mobile ? [p[2], p[3]] : [p[0], p[1]]; }); },
  _mapRoutes(mobile) {
    const P = this._mapPoints(mobile).map(([x, y]) => [x * 10, y * 10]);
    return CAMPAIGN_CHAPTERS.slice(0, -1).map((c, i) => {
      const [x0, y0] = P[i], [x1, y1] = P[i + 1], my = Math.min(y0, y1) - 70;
      return `<path class="${this.s.done[c.n] ? "cmp-route cmp-route--done" : "cmp-route"}" d="M ${x0} ${y0} Q ${(x0 + x1) / 2} ${my} ${x1} ${y1}"/>`;
    }).join("");
  },
  _mapSky() {
    const rnd = (i) => { const v = Math.sin(i * 78.233) * 43758.5453; return v - Math.floor(v); };
    let h = "";
    for (let i = 0; i < 26; i++) h += `<i class="cmp-star" style="left:${(rnd(i) * 100).toFixed(1)}%;top:${(rnd(i + 50) * 100).toFixed(1)}%;opacity:${(.35 + rnd(i + 9) * .5).toFixed(2)}"></i>`;
    [[4, 78, 34, 16, 0], [30, 86, 40, 14, 1], [62, 80, 34, 18, 0], [84, 88, 30, 12, 1], [14, 14, 26, 10, 1], [46, 8, 24, 9, 0], [76, 10, 28, 10, 1]].forEach(([x, y, w, ht, k]) => { h += `<div class="cmp-cloud${k ? " cmp-cloud--b" : ""}" style="left:${x}%;top:${y}%;width:${w}%;height:${ht}%"></div>`; });
    return h;
  },
  _mapHtml(sel) {
    const t = (k, v) => this.t(k, v);
    const pop = !this._mapShown; this._mapShown = true;
    const isles = CAMPAIGN_CHAPTERS.map((c, i) => {
      const p = CAMPAIGN_MAP_POS[c.n] || [50, 50, 50, 50], un = this.unlocked(c.n), done = !!this.s.done[c.n];
      const cls = ["cmp-isle", un ? "cmp-isle--open" : "cmp-isle--locked", c.boss ? "cmp-isle--boss" : "", c.n === sel.n ? "cmp-isle--sel" : "", pop ? "cmp-isle--pop" : ""].join(" ");
      const badge = done ? `<span class="cmp-badge"><i class="ph-fill ph-check"></i></span>` : !un ? `<span class="cmp-badge"><i class="ph-fill ph-lock-simple"></i></span>` : "";
      const here = "";
      const stars = !c.boss && un ? this._starsHtml(c.n, "cmp-isle__stars") : "";
      const name = t("cmp_ch" + c.n).replace(/^[^·]*· /, "");
      return `<div class="${cls}" style="--x:${p[0]}%;--y:${p[1]}%;--mx:${p[2]}%;--my:${p[3]}%;--w:${p[4] || 170}px;--wm:${p[5] || 120}px;--d:${i * .1}s;--fd:${-i * 1.1}s">
        <button type="button" class="cmp-isle__btn" data-n="${c.n}" aria-label="${name}">
          <i class="ph-fill ph-caret-down cmp-arrow"></i>
          <span class="cmp-isle__float">${here}<img class="cmp-isle__img" src="assets/niveles/isla_mushboom_forest.png" alt="">${c.boss ? '<span class="cmp-skull"><i class="ph-fill ph-skull"></i></span>' : ""}<span class="cmp-num"><span>${c.n}</span></span>${badge}</span>
          <span class="cmp-shadow"></span><span class="cmp-name">${name}</span>${stars}
        </button></div>`;
    }).join("");
    return `<div class="p5-banner cmp-frame"><div class="cmp-board"><div class="cmp-band cmp-band--1"></div><div class="cmp-band cmp-band--2"></div><div class="cmp-band cmp-band--3"></div>${this._mapSky()}
      <svg class="cmp-svg cmp-svg--d" viewBox="0 0 1000 1000" preserveAspectRatio="none">${this._mapRoutes(false)}</svg>
      <svg class="cmp-svg cmp-svg--m" viewBox="0 0 1000 1000" preserveAspectRatio="none">${this._mapRoutes(true)}</svg>${isles}</div></div>`;
  },
  _stripHtml(sel) {
    const t = (k, v) => this.t(k, v);
    let status, action;
    if (sel.boss) { status = t("cmp_boss"); action = `<button class="p5-banner p5-banner--action camp-play" disabled><span class="p5-banner__label">${t("cmp_soon")}</span></button>`; }
    else if (!this.unlocked(sel.n)) {
      status = this.s.done[sel.n - 1] ? t("cmp_need", { g: sel.req.gnomes, r: sel.req.res, hg: this.s.gnomes, hr: this.s.earnedRes }) : t("cmp_need_prev");
      action = `<button class="p5-banner p5-banner--action camp-play" disabled><span class="p5-banner__label"><i class="ph-fill ph-lock-simple"></i> ${t("cmp_locked")}</span></button>`;
    } else {
      status = this.s.done[sel.n] ? t("cmp_done") : "";
      if (this.remaining(sel.n) <= 0) {
        status = t("cmp_depleted");
        action = `<button class="p5-banner p5-banner--action camp-play" disabled><span class="p5-banner__label"><i class="ph-fill ph-check-circle"></i> ${t("cmp_depleted_btn")}</span></button>`;
      } else action = `<button class="p5-banner p5-banner--action camp-play" data-play="${sel.n}"><span class="p5-banner__label">${t("cmp_play")}</span></button>`;
    }

    const tile = (ic, val, lb, cls) => `<span class="cmp-tile${cls ? " " + cls : ""}"><i class="ph-fill ${ic}"></i><b>${val}</b><small>${lb}</small></span>`;
    const tiles = sel.boss ? "" : `<div class="cmp-tiles">${tile("ph-users-three", sel.goal, t("cmp_stat_gnomes"))}${tile("ph-hammer", campaignChapterGnomes(sel) - this.remaining(sel.n) + "/" + campaignChapterGnomes(sel), t("cmp_stat_stamped"))}${tile("ph-hourglass-medium", campaignTurnLimit(sel), t("cmp_stat_turns"))}${tile("ph-tent", this.campsBest(sel.n) + "/" + sel.camps, t("cmp_stat_camps"))}${sel.foe && sel.foe.arma ? tile("ph-sword", "+" + sel.foe.arma, t("cmp_stat_foeatk"), "cmp-tile--foe") : ""}${sel.foe && sel.foe.armadura ? tile("ph-shield", "+" + sel.foe.armadura, t("cmp_stat_foedef"), "cmp-tile--foe") : ""}</div>`;
    const stars = sel.boss || !this.unlocked(sel.n) ? "" : this._starsHtml(sel.n, "cmp-strip__stars");
    return `<div class="cmp-strip__body">
      <div class="cmp-strip__id"><div class="cmp-strip__kicker">${t("cmp_chapter", { n: sel.n })}</div><div class="cmp-strip__name">${t("cmp_ch" + sel.n).replace(/^[^·]*· /, "")}</div>${stars}</div>
      ${tiles}
      <div class="cmp-strip__act">${action}</div>
      ${status ? `<p class="cmp-strip__status">${status}</p>` : ""}${sel.boss || !this.unlocked(sel.n) ? "" : `<p class="cmp-strip__hint">${t("cmp_star_hint")}</p>`}
    </div>`;
  },
  _selectChapter(n) {
    const root = document.getElementById("camp-root"), sel = this.ch(n);
    if (!root || !sel) return;
    this.sel = n;
    root.querySelectorAll(".cmp-isle").forEach((el) => el.classList.toggle("cmp-isle--sel", +el.querySelector(".cmp-isle__btn").dataset.n === n));
    const strip = root.querySelector("#cmp-strip");
    if (!strip) return this.render();
    strip.innerHTML = this._stripHtml(sel);
    strip.classList.remove("cmp-strip--in"); void strip.offsetWidth; strip.classList.add("cmp-strip--in");
    const pb = strip.querySelector("[data-play]");
    if (pb) pb.addEventListener("click", () => { this._click(); this.play(+pb.dataset.play); });
  },

  render() {
    const root = document.getElementById("camp-root");
    if (!root || !this.s) return;
    if (!this._pre && typeof Artifacts !== "undefined" && typeof ART_DEFS !== "undefined") { // precarga: nada aparece de golpe al abrir la pestaña
      this._pre = ["cushion"].concat(ART_DEFS.map((d) => d.id)).map((k) => { const im = new Image(); im.src = Artifacts.img(k); return im; }).concat([CAMPAIGN_EXTRACT_ICON, "assets/niveles/isla_mushboom_forest.png"].map((u) => { const im = new Image(); im.src = u; return im; }));
    }
    const t = (k, v) => this.t(k, v);
    const sel = this.ch(this.sel) || this.ch(1);
    const nodes = this._mapHtml(sel);

    const upCard = (u) => {
      const cat = CAMPAIGN_CATS.find((c) => c.id === u.cat) || CAMPAIGN_CATS[0];
      const lv = this.upLevel(u.id), max = lv >= u.max, cost = u.cost[lv], can = !max && this.canPay(cost);
      const pips = Array.from({ length: u.max }, (_, i) => `<i class="camp-pip${i < lv ? " camp-pip--on" : ""}"></i>`).join("");
      return `<div class="camp-card${max ? " camp-card--max" : ""}" style="--acc:${cat.acc}">
        <div class="camp-card__head"><span class="camp-card__badge"><i class="ph-fill ${u.icon} camp-card__icon"></i></span><div class="camp-card__txt"><b>${t("cmp_up_" + u.id)}</b><span>${t("cmp_up_" + u.id + "_d")}</span></div></div>
        <div class="camp-card__lvl"><span class="camp-pips">${pips}</span><em>${t("cmp_lvl", { a: lv, b: u.max })}</em></div>
        <div class="camp-card__foot">${max ? "<span class=\"camp-costs\"></span>" : `<span class="camp-costs">${this._costHtml(cost)}</span>`}
        <button type="button" class="camp-up__buy" data-buy="${u.id}" ${can ? "" : "disabled"}>${max ? t("cmp_max") : t("cmp_buy")}</button></div></div>`;
    };
    const upCards = CAMPAIGN_CATS.map((c) => `<section class="camp-sec" style="--acc:${c.acc}">
      <h3 class="camp-sec__h"><i class="ph-fill ${c.icon}"></i><span>${t("cmp_cat_" + c.id)}</span></h3>
      <div class="camp-grid">${CAMPAIGN_UPGRADES.filter((u) => u.cat === c.id).map(upCard).join("")}</div></section>`).join("");

    const tab = this.tab === "up" ? "up" : "map";
    const res = CAMPAIGN_RES.map((r) => `<span class="camp-chip"><img src="${CAMPAIGN_RES_ICON[r]}" alt=""><b>${this.s.res[r] || 0}</b></span>`).join("");
    const tabs = [["map", "ph-map-trifold", t("cmp_tab_map"), ""], ["up", "ph-hammer", t("cmp_tab_up"), ""]]
      .map(([id, ic, lb, sm]) => `<button type="button" class="camp-tab${tab === id ? " camp-tab--on" : ""}" data-tab="${id}"><i class="ph-fill ${ic}"></i><span>${lb}</span>${sm ? `<small>${sm}</small>` : ""}</button>`).join("");
    const pane = tab === "map"
      ? `<div class="camp-pane camp-pane--map">${nodes}<div class="p5-banner cmp-strip" id="cmp-strip">${this._stripHtml(sel)}</div></div>`
      : `<div class="camp-pane camp-pane--up">${upCards}</div>`;
    root.innerHTML = `
      <div class="camp-top"><span class="camp-chip"><i class="ph-fill ph-users-three"></i> ${t("cmp_gnomes")} <b>${this.s.gnomes}</b></span><span class="camp-chip camp-chip--pts"><img src="${CAMPAIGN_PTS_ICON}" alt=""><b>${this.s.pts || 0}</b></span>${res}</div>
      <div class="camp-tabs">${tabs}</div>
      ${pane}
      ${this.hasProgress() ? `<div class="camp-foot"><button type="button" class="p5-banner p5-banner--action camp-abandon" data-abandon><span class="p5-banner__label"><i class="ph ph-arrow-counter-clockwise"></i> ${t("cmp_abandon")}</span></button></div>` : ""}`;
    const abBtn = root.querySelector("[data-abandon]");
    if (abBtn) abBtn.addEventListener("click", () => { this._click(); this._askAbandon(); });
    root.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { this._click(); this.tab = b.dataset.tab; this.render(); }));
    root.querySelectorAll(".cmp-isle__btn").forEach((b) => b.addEventListener("click", () => { this._click(); this._selectChapter(+b.dataset.n); }));
    const pb = root.querySelector("[data-play]");
    if (pb) pb.addEventListener("click", () => { this._click(); this.play(+pb.dataset.play); });
    root.querySelectorAll("[data-buy]").forEach((b) => b.addEventListener("click", () => this.buy(b.dataset.buy)));
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

  // ---------- Tutorial (la escena y el guion viven en js/tutorial-campaign.js) ----------
  // Pone el motor en modo campaña dentro de la escena de práctica: sin guardado, sin avance de capítulos.
  beginTutorial() {
    this.active = true;
    this.run = { n: 0, goal: 2, delivered: 0, kills: 0, over: false, warnedNone: true, warnedDone: false, spawned: 0, tutorial: true };
    this._camps = [];
    const ob = Obelisks.byTeam("player");
    this._setupObelisk(ob);
    if (typeof Glory !== "undefined") { Glory.points.player = 0; Glory.addNow("player", CAMPAIGN_START_GLORY); }
    this._showHud();
  },

  // ---------- Partida ----------
  async play(n) {
    const ch = this.ch(n);
    if (!ch || ch.boss || !this.unlocked(n) || this.remaining(n) <= 0) return;
    this.active = true;
    // Objetivo: lo que falte para el del capítulo (si ya lo superaste, hasta lo que quede), nunca más de los gnomos que quedan.
    const left = this.remaining(n), had = (this.s.got && this.s.got[n]) || 0;
    const goal = this.s.done[n] ? Math.min(ch.goal, left) : Math.max(1, Math.min(ch.goal - had, left));
    this.run = { n, goal, total: left, maxTurns: campaignTurnLimit(ch) + 2 * this.upLevel("turnos"), delivered: 0, kills: 0, over: false, warnedNone: false, warnedDone: false, spawned: 0 };
    this._camps = [];
    if (typeof matchDraft !== "undefined") matchDraft.modeId = "campaign";
    // Capítulo 1: el vídeo aparece ANTES que nada (cortina negra encima) y el nivel se construye por debajo mientras suena.
    this._cinePre = null;
    if (ch.n === 1) {
      this._cinePre = this._cinematic(ch);
      await new Promise((r) => setTimeout(r, 450)); // deja que la cortina esté ya a la vista antes de montar el tablero
    }
    await startMatch({ modeId: "campaign", raceId: "mushboom_forest", levelId: ch.levelId, opponents: 1 });
    const board = document.getElementById("screen-board");
    if (!board || !board.classList.contains("screen--active")) this.onLeaveBoard();
  },

  // Tras construir la partida: intro de Nizak antes de empezar a jugar.
  async afterStart() {
    const ch = this.ch(this.run.n);
    if (ch.n === 1) {
      await (this._cinePre || this._cinematic(ch));
      this._cinePre = null;
      const c = CampaignIntro._cine;
      if (c) { CampaignIntro._cine = null; c.style.transition = "opacity .5s"; c.style.opacity = "0"; setTimeout(() => c.remove(), 520); }
    } else {
      if (!this.active || !this.run) return;
      await this._warIntro(ch);
    }
    if (!this.active || !this.run) return;
    this.run.ready = true; // a partir de aquí ya valen los avisos de turno
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
    this.run.startPts = (typeof Glory !== "undefined" && Glory.points && Glory.points.player) || 0; // fondos de partida: se devuelven, no se extraen
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
    // Solo aparecen los gnomos que aún no has estampado en este capítulo (el suelto solo en la primera visita completa).
    const leftG = Math.max(0, this.remaining(this.run.n)), fresh = leftG >= campaignChapterGnomes(ch);
    const toCage = leftG - (fresh ? 1 : 0), nCamps = Math.min(ch.camps, Math.ceil(toCage / ch.cages));
    for (let k = 0; k < nCamps; k++) {
      const cagesHere = Math.min(ch.cages, toCage - k * ch.cages);
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
      for (let g = 0; g < cagesHere; g++) {
        const gn = Gnome.spawnNear(spot.row, spot.col);
        this._cage(gn);
        camp.gnomes.push(gn);
      }
      this._camps.push(camp);
    }

    // Un gnomo suelto cerca del inicio para aprender a cogerlo.
    if (fresh) Gnome.spawnNear(Math.min(size - 1, ob.row + (ob.row < size / 2 ? 4 : -4)), Math.min(size - 1, ob.col + (ob.col < size / 2 ? 3 : -3)));
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
    // Como en la partida normal: al quedar libre, el gnomo sale huyendo de la unidad del jugador más cercana (si lo ve).
    setTimeout(() => {
      if (!this.run || this.run.over || !gn.el || gn.heldBy || gn.busy || typeof Units === "undefined") return;
      let best = null, bd = 99;
      Units.list.forEach((u) => { if (u.team !== "player") return; const d = this._cheb(u, gn); if (d < bd) { bd = d; best = u; } });
      if (best) gn.reactToPlayerMove(best);
    }, 560);
  },

  _setupObelisk(ob) {
    if (!ob || !ob.el) return;
    ob.el.classList.add("obelisk--campaign");
    const menu = ob.el.querySelector(".obelisk__menu");
    if (!menu || menu.querySelector(".obelisk__menu-btn--extract")) return;
    const btn = document.createElement("button");
    btn.className = "obelisk__menu-btn obelisk__menu-btn--extract";
    btn.setAttribute("aria-label", this.t("cmp_extract"));
    btn.innerHTML = `<img class="obelisk__menu-extract-icon" src="${CAMPAIGN_EXTRACT_ICON}" alt="" draggable="false">`;
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
    const left = r.maxTurns ? Math.max(0, r.maxTurns - ((typeof Turns !== "undefined" && Turns.roundNumber) || 1) + 1) : 0;
    this._hud.innerHTML = `<span class="camp-hud__item"><i class="ph-fill ph-users-three"></i> ${this.t("cmp_hud", { a: r.delivered, b: r.goal })}</span>` +
      (r.maxTurns ? `<span class="camp-hud__item${left <= 3 && r.delivered < r.goal ? " camp-hud__item--warn" : ""}"><i class="ph-fill ph-hourglass-medium"></i> ${this.t("cmp_hud_turns", { a: left })}</span>` : "");
  },
  _bump() { if (!this._hud) return; this._hud.classList.remove("camp-hud--bump"); void this._hud.offsetWidth; this._hud.classList.add("camp-hud--bump"); },
  _banner(txt) { if (typeof Turns !== "undefined" && Turns.showBanner) Turns.showBanner(txt); },

  // ---------- Eventos del motor ----------
  onUnitRemoved(unit) {
    const run = this.run;
    if (!run || run.over || unit.team !== "enemy") return;
    run.kills++;
    if (typeof UnitXP !== "undefined") UnitXP.onKill(unit.lastHitBy); // XP para quien dio el golpe final
    if (typeof Glory !== "undefined") Glory.addNow("player", CAMPAIGN_KILL_POINTS + this.upLevel("cazador"));
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
    if (typeof UnitXP !== "undefined") UnitXP.addXp(unit, UNITXP_STAMP); // XP para quien llevó el gnomo
    if (typeof SFX !== "undefined" && SFX.stampScore) { try { SFX.stampScore(); } catch (e) {} }
    if (pts > 0 && typeof Glory !== "undefined") Glory.addFlying("player", pts, unit.el);
    this._refreshHud(); this._bump();
    if (run.delivered >= run.goal && !run.warnedDone) { run.warnedDone = true; this._banner(this.t("cmp_done_banner")); }
  },

  // Inicio de turno del jugador: avisos.
  onTurnStart(team) {
    const run = this.run;
    if (!this.active || !run || run.over || team !== "player") return;
    this._refreshHud();
    if (run.maxTurns && !run.tutorial && run.delivered < run.goal) {
      const left = run.maxTurns - Turns.roundNumber + 1;
      if (left > 0 && left <= 3) this._banner(this.t("cmp_warn_turns", { n: left }));
    }
    const ob = Obelisks.byTeam("player");
    if (ob && Units.list.some((u) => u.typeId === "rompeobeliscos" && this._cheb(u, ob) <= 1)) this._banner(this.t("cmp_warn_ob"));
    if (run.ready && !run.warnedNone && Gnome.list.length && !Gnome.list.some((g) => g.caged)) { run.warnedNone = true; this._banner(this.t("cmp_warn_none")); }
  },

  // ---------- IA de los neutrales ----------
  async onTurnEnd(team) {
    if (!this.active || team !== "player" || !this.run || this.run.over || this.run.tutorial) return;
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
  // Extraer exige que TODAS las unidades vivas aliadas estén a ≤ CAMPAIGN_EXTRACT_RADIUS casillas del obelisco.
  _farUnits() {
    const ob = (typeof Obelisks !== "undefined" && Obelisks.byTeam) ? Obelisks.byTeam("player") : null;
    if (!ob) return [];
    return Units.list.filter((u) => u.team === "player" && this._cheb(u, ob) > CAMPAIGN_EXTRACT_RADIUS);
  },

  // Puntos extraíbles = lo ganado por encima de los fondos de partida (entrar y salir sin hacer nada no da nada).
  netPts() {
    const r = this.run, cur = (typeof Glory !== "undefined" && Glory.points && Glory.points.player) || 0;
    return r && !r.tutorial ? Math.max(0, cur - (r.startPts || 0)) : cur;
  },

  _askExtract() {
    if (!this.run || this.run.over || this._askEl) return;
    const far = this._farUnits();
    if (far.length) {
      this._banner(this.t("cmp_extract_far"));
      if (typeof SFX !== "undefined" && SFX.back) SFX.back();
      far.forEach((u) => { const el = u.el; if (!el) return; el.classList.remove("unit--far"); void el.offsetWidth; el.classList.add("unit--far"); setTimeout(() => el.classList.remove("unit--far"), 1600); });
      return;
    }
    const ov = document.createElement("div");
    ov.className = "camp-ask";
    const c = Resources.counts;
    ov.innerHTML = `<div class="camp-ask__panel">
      <div class="camp-ask__q">${this.t("cmp_extract_q")}</div>
      <div class="camp-ask__info">${this.t("cmp_extract_info")}<br><b>${this.run.delivered}/${this.run.goal}</b> ${this.t("cmp_gnomes").toLowerCase()}
        <span class="camp-costs"><span class="camp-cost camp-cost--pts"><img src="${CAMPAIGN_PTS_ICON}" alt="">${this.netPts()}</span>${CAMPAIGN_RES.map((r) => `<span class="camp-cost"><img src="${CAMPAIGN_RES_ICON[r]}" alt="">${c[r] || 0}</span>`).join("")}</span></div>
      <div class="camp-ask__row"><button class="camp-ask__btn camp-ask__btn--yes">${this.t("cmp_yes")}</button><button class="camp-ask__btn camp-ask__btn--no">${this.t("cmp_no")}</button></div></div>`;
    document.body.appendChild(ov);
    this._askEl = ov;
    const close = () => { ov.remove(); this._askEl = null; };
    ov.querySelector(".camp-ask__btn--no").addEventListener("click", () => { if (typeof SFX !== "undefined" && SFX.back) SFX.back(); close(); });
    ov.querySelector(".camp-ask__btn--yes").addEventListener("click", () => { this._click(); close(); if (this.run.tutorial) { this.run.tutExtracted = true; return; } this._finish("extract"); });
    ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  },

  // Se acabaron los turnos: si ya reuniste a todos los gnomos, se extrae normal; si no, conservas los gnomos y SOLO la mitad de los recursos.
  onTurnLimit(roundNumber) {
    const r = this.run;
    if (!r || r.over || r.tutorial || !r.maxTurns || roundNumber <= r.maxTurns) return;
    this._finish(r.delivered >= r.goal ? "extract" : "timeout");
  },

  onGameEnd(playerWon) { if (!this.run || this.run.over || this.run.tutorial) return; this._finish(playerWon ? "extract" : "fallen"); },

  _finish(kind) {
    const r = this.run;
    if (!r || r.over) return;
    r.over = true;
    if (typeof Obelisks !== "undefined") Obelisks.gameOver = true;
    if (typeof Units !== "undefined") Units.deselect();
    if (typeof Turns !== "undefined") Turns.hideButton();
    const fallen = kind === "fallen", timeout = kind === "timeout";
    const got = {};
    const lvB = this.upLevel("botin"), lvP = this.upLevel("prorroga"), lvS = this.upLevel("seguro");
    CAMPAIGN_RES.forEach((k) => {
      const n = (Resources.counts && Resources.counts[k]) || 0;
      got[k] = fallen ? Math.floor(n * 0.2 * lvS) : timeout ? Math.floor(n * (0.5 + 0.1 * lvP)) : (n > 0 ? n + lvB : 0);
    });
    // Puntos sobrantes de la partida: también se extraen (con las mismas reglas de prórroga y red de seguridad que los recursos).
    const leftPts = this.netPts();
    got.pts = fallen ? Math.floor(leftPts * 0.2 * lvS) : timeout ? Math.floor(leftPts * (0.5 + 0.1 * lvP)) : leftPts;
    this.s.pts = (this.s.pts || 0) + got.pts;
    // Campamentos de esta partida: los abiertos + los que no se montaron porque sus gnomos ya estaban estampados. Se guarda el MEJOR intento.
    const ch0 = this.ch(r.n), campsTotal = (ch0 && ch0.camps) || 0;
    const cleared = Math.min(campsTotal, this._camps.filter((c) => c.open).length + Math.max(0, campsTotal - this._camps.length));
    r.campsCleared = cleared;
    if (cleared > this.campsBest(r.n)) { this.s.camps = this.s.camps || {}; this.s.camps[r.n] = cleared; }
    const completed = !fallen && r.delivered >= r.goal;
    if (!fallen) {
      const n = Math.min(r.delivered, this.remaining(r.n));
      this.s.gnomes += n;
      this.s.got[r.n] = ((this.s.got && this.s.got[r.n]) || 0) + n; // los gnomos estampados no vuelven a aparecer en este capítulo
    }
    CAMPAIGN_RES.forEach((k) => { this.s.res[k] += got[k]; this.s.earnedRes += got[k]; });
    if (completed) this.s.done[r.n] = true;
    this.persist();
    if (typeof SFX !== "undefined") { if (fallen && SFX.defeat) SFX.defeat(); else if (SFX.victory) SFX.victory(); }
    this._showResult({ completed, fallen, timeout, got });
  },

  _showResult({ completed, fallen, timeout, got }) {
    const r = this.run;
    const title = fallen ? this.t("cmp_res_fail") : timeout ? this.t("cmp_res_time") : completed ? this.t("cmp_res_ok") : this.t("cmp_res_part");
    const ov = document.createElement("div");
    ov.className = "camp-result";
    const bad = fallen || timeout;
    const maxCamps = (this.ch(r.n) || {}).camps || 0;
    const note = fallen ? (this.upLevel("seguro") ? this.t("cmp_res_ins", { p: 20 * this.upLevel("seguro") }) : this.t("cmp_res_half"))
      : timeout ? (this.upLevel("prorroga") ? this.t("cmp_res_tprc", { p: 50 + 10 * this.upLevel("prorroga") }) : this.t("cmp_res_timeup")) : "";
    const row = (icon, label, val, small, i) => `<div class="res-row${bad ? " res-row--bad" : ""}" style="animation-delay:${0.1 + i * 0.12}s"><i class="ph-fill ${icon}"></i><span class="res-row__label">${label}</span><span class="res-row__val">${val}${small ? `<small> / ${small}</small>` : ""}</span></div>`;
    const loot = [[CAMPAIGN_PTS_ICON, got.pts || 0]].concat(CAMPAIGN_RES.map((k) => [CAMPAIGN_RES_ICON[k], got[k] || 0]));
    const lost = loot.every((x) => !x[1]);
    ov.innerHTML = `<div class="p5-banner res-card"><div class="res-body">
      <h2 class="res-title${bad ? " res-title--bad" : ""}">${title}</h2>
      <div class="res-stars">${this.starFlags(r.n).map((on) => `<i class="ph-fill ph-star res-star${on ? " res-star--on" : ""}"></i>`).join("")}</div>
      <div class="res-rows">${row("ph-flag-banner", this.t("cmp_res_g"), r.delivered, r.goal, 0)}${row("ph-skull", this.t("cmp_res_k"), r.kills, 0, 1)}${row("ph-tent", this.t("cmp_stat_camps"), r.campsCleared || 0, maxCamps, 2)}</div>
      <div class="res-loot-h">${this.t(lost && bad ? "cmp_res_lost" : "cmp_res_loot")}</div>
      <div class="res-loot">${loot.map((x, i) => `<div class="res-tile${x[1] ? "" : " res-tile--zero"}" style="animation-delay:${0.5 + i * 0.09}s"><img src="${x[0]}" alt=""><b>+${x[1]}</b></div>`).join("")}</div>
      ${note ? `<p class="res-note">${note}</p>` : ""}
      <div class="res-foot"><button type="button" class="p5-banner p5-banner--action res-go"><span class="p5-banner__label"><i class="ph-fill ph-map-trifold"></i> ${this.t("cmp_back_map")}</span></button></div></div></div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add("camp-result--on"));
    ov.querySelector(".res-go").addEventListener("click", () => { this._click(); ov.remove(); this.leaveToMap(); });
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

  // Escena de vídeo del capítulo 1 (3D con los sprites del juego, sin voces): subtítulos propios en el idioma elegido.
  _cinematic(ch) {
    const L = this.t("cmp_intro1").split("|");
    const lang = typeof I18N !== "undefined" ? I18N.currentLang : "es";
    const T = CAMPAIGN_INTRO_SUB_TIMES[lang] || CAMPAIGN_INTRO_SUB_TIMES.es;
    return CampaignIntro.playVideo({
      src: "assets/campana/intro_guerra.mp4?v=17",
      voice: CAMPAIGN_INTRO_VOICES[lang] || null, // locución aparte por idioma (sin entrada = sin voz)
      nizak: this.t("cmp_nizak"), hold: this.t("cmp_hold_skip"),
      subs: T.map((x, i) => ({ t0: x[0], t1: x[1], text: L[i] })),
      onStart: () => { if (typeof Music !== "undefined" && Music.duck) Music.duck(41500); },
    });
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

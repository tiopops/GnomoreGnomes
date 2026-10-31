/* Gnomore Gnomes — Gnomoteca: el libro del saber del juego.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Recordar qué ha visto el jugador (localStorage) y apuntarlo cuando algo aparece en pantalla durante una partida.
     - Reunir las fichas de unidades, equipos, escenarios, recursos, edificios y objetos a partir de los datos del propio
       juego (UNIT_TYPES, RACES, LEVELS...), así que lo que cambie en esos archivos se refleja aquí solo.
     - Pintar el libro (pantalla #screen-gnomoteca, abierta desde el botón del menú principal).
   Lo que aún no se ha visto sale como "???", con la descripción en blanco y el sprite convertido en una sombra oscura de un
   solo color; en cuanto se ve en partida, se desvela. Todo el texto es español literal: el traductor del juego
   (js/translate.js, EN_DICT) se ocupa del inglés. Estética: la misma "irregular" de todo el juego. */

const GNOMOTECA_KEY = "gnomoregnomes_gnomoteca";
const GNOMOTECA_ACH_KEY = "gnomoregnomes_gnomoteca_ach_";
const GNOMOTECA_XP_ENTRY = 10; // XP por cada entrada descubierta (se cobra una sola vez)

// Logros (coleccionables): icono Phosphor, explicación, XP que dan y cómo se mide el progreso.
//   kind: seen (entradas vistas) · all (todo el libro) · cat (una categoría completa) · st (contador de partidas)
//         lv (escenarios jugados) · tut (tutoriales hechos) · streak (racha de días) · level (nivel de cuenta)
const GNOMOTECA_ACH = [
{
"id": "c1",
"icon": "magnifying-glass",
"kind": "seen",
"arg": null,
"goal": 1,
"xp": 10,
"name": "Primer vistazo",
"desc": "Descubres tu primera entrada de la Gnomoteca. Has aprendido a mirar. Solo te falta entender lo que ves."
},
{
"id": "c10",
"icon": "binoculars",
"kind": "seen",
"arg": null,
"goal": 10,
"xp": 25,
"name": "Ojo de lince",
"desc": "Diez entradas descubiertas. Empiezas a fijarte en las cosas, que es el primer paso para que dejen de sorprenderte."
},
{
"id": "c25",
"icon": "books",
"kind": "seen",
"arg": null,
"goal": 25,
"xp": 50,
"name": "Rata de biblioteca",
"desc": "Veinticinco entradas. Ya sabes más de este mundo que la mayoría de sus habitantes, lo cual tampoco era muy difícil."
},
{
"id": "c50",
"icon": "scroll",
"kind": "seen",
"arg": null,
"goal": 50,
"xp": 100,
"name": "Cronista del caos",
"desc": "Cincuenta entradas descubiertas. Alguien tenía que apuntar todo esto, y has sido tú. Nadie te ha dado las gracias."
},
{
"id": "call",
"icon": "seal-check",
"kind": "all",
"arg": null,
"goal": 0,
"xp": 300,
"name": "Gnomoteca completa",
"desc": "Todo descubierto. Lo has visto, tocado y probablemente roto. El libro ya no tiene secretos, pero tú tampoco tienes vida social."
},
{
"id": "cu",
"icon": "users-three",
"kind": "cat",
"arg": "unidades",
"goal": 0,
"xp": 60,
"name": "Pasar lista",
"desc": "Conoces a todas las unidades del juego. Sabes quién pega, quién huye y quién se lanza solo a por una muerte heroica."
},
{
"id": "cr",
"icon": "tree",
"kind": "cat",
"arg": "recursos",
"goal": 0,
"xp": 30,
"name": "Saqueador profesional",
"desc": "Todos los recursos vistos. Roca, madera y hierro: el sueño de cualquier gnomo con ganas de romper cosas."
},
{
"id": "ce",
"icon": "castle-turret",
"kind": "cat",
"arg": "edificios",
"goal": 0,
"xp": 40,
"name": "Arquitecto de ruinas",
"desc": "Has visto todos los edificios. Algunos siguen en pie, y no por mucho tiempo."
},
{
"id": "co",
"icon": "backpack",
"kind": "cat",
"arg": "objetos",
"goal": 0,
"xp": 50,
"name": "Mochila de coleccionista",
"desc": "Todos los objetos descubiertos. Tu mochila pesa más que tú y aun así sigues pidiendo sitio."
},
{
"id": "ct",
"icon": "flag-banner",
"kind": "cat",
"arg": "equipos",
"goal": 0,
"xp": 40,
"name": "Fichaje de lujo",
"desc": "Conoces a todos los equipos. Sabes con quién aliarte y a quién ni mirar a los ojos."
},
{
"id": "cl",
"icon": "map-trifold",
"kind": "cat",
"arg": "escenarios",
"goal": 0,
"xp": 40,
"name": "Turista del caos",
"desc": "Has visto todos los escenarios. Ninguno es recomendable para las vacaciones, pero las vistas son geniales."
},
{
"id": "g1",
"icon": "game-controller",
"kind": "st",
"arg": "games",
"goal": 1,
"xp": 15,
"name": "Bautizo de barro",
"desc": "Tu primera partida. Lo importante es participar, dicen los que pierden."
},
{
"id": "g10",
"icon": "hourglass",
"kind": "st",
"arg": "games",
"goal": 10,
"xp": 40,
"name": "Vicio confirmado",
"desc": "Diez partidas jugadas. Ya no es curiosidad, es costumbre. Y de las malas."
},
{
"id": "g50",
"icon": "fire",
"kind": "st",
"arg": "games",
"goal": 50,
"xp": 100,
"name": "Esto ya es un estilo de vida",
"desc": "Cincuenta partidas. Tus gnomos te conocen por tu nombre. Y por tus gritos."
},
{
"id": "w1",
"icon": "trophy",
"kind": "st",
"arg": "wins",
"goal": 1,
"xp": 25,
"name": "Esto no estaba previsto",
"desc": "Tu primera victoria. Ni tú te lo esperabas, y tu rival mucho menos."
},
{
"id": "w10",
"icon": "medal",
"kind": "st",
"arg": "wins",
"goal": 10,
"xp": 75,
"name": "Racha de suerte",
"desc": "Diez victorias. Tú lo llamas talento; el resto del mundo, mucha suerte."
},
{
"id": "w50",
"icon": "crown",
"kind": "st",
"arg": "wins",
"goal": 50,
"xp": 200,
"name": "Leyenda de barrio",
"desc": "Cincuenta victorias. Hay gnomos que cuentan tu nombre para asustar a los pequeños. Y no es un cuento bonito."
},
{
"id": "k25",
"icon": "sword",
"kind": "st",
"arg": "kills",
"goal": 25,
"xp": 40,
"name": "Ni un gnomo a salvo",
"desc": "Veinticinco bajas enemigas. Alguien tenía que hacer el trabajo sucio y a ti se te da de maravilla."
},
{
"id": "k100",
"icon": "skull",
"kind": "st",
"arg": "kills",
"goal": 100,
"xp": 100,
"name": "Carnicería con estilo",
"desc": "Cien bajas enemigas. Lo haces con tanto estilo que casi da pena verlos caer. Casi."
},
{
"id": "t20",
"icon": "flag-banner",
"kind": "st",
"arg": "totems",
"goal": 20,
"xp": 40,
"name": "Coleccionista de tótems",
"desc": "Veinte tótems capturados. Los guardas en una estantería imaginaria, junto a tus remordimientos."
},
{
"id": "o1",
"icon": "users",
"kind": "st",
"arg": "online",
"goal": 1,
"xp": 40,
"name": "Hablando se entiende la gente",
"desc": "Tu primera partida online. Hablando se entiende la gente, pero con gnomos de por medio, mucho menos."
},
{
"id": "ow1",
"icon": "globe",
"kind": "st",
"arg": "onlineWins",
"goal": 1,
"xp": 80,
"name": "Gana a un humano",
"desc": "Una victoria online. Un humano de verdad ha perdido contra ti. Disfruta del momento, que dura poco."
},
{
"id": "mw1",
"icon": "skull",
"kind": "st",
"arg": "multiWin",
"goal": 1,
"xp": 60,
"name": "Uno contra todos",
"desc": "Ganas una partida contra varios rivales a la vez. Ahora a ver quién te invita a la próxima fiesta."
},
{
"id": "lv",
"icon": "compass",
"kind": "lv",
"arg": null,
"goal": 0,
"xp": 70,
"name": "Trotamundos",
"desc": "Has jugado en todos los escenarios. Conoces cada rincón del caos y ya no te queda sitio donde esconderte."
},
{
"id": "tut",
"icon": "graduation-cap",
"kind": "tut",
"arg": null,
"goal": 5,
"xp": 60,
"name": "Alumno de Nizak",
"desc": "Completas todos los tutoriales. Nizak no lo admitirá nunca, pero está orgulloso. Mucho. A su manera."
},
{
"id": "s3",
"icon": "calendar-check",
"kind": "streak",
"arg": null,
"goal": 3,
"xp": 30,
"name": "Constancia de gnomo",
"desc": "Tres días seguidos jugando. Tu familia empieza a echarte de menos."
},
{
"id": "s7",
"icon": "calendar-check",
"kind": "streak",
"arg": null,
"goal": 7,
"xp": 80,
"name": "Obsesión saludable",
"desc": "Una semana entera de racha. Es oficial: esto es más que una afición."
},
{
"id": "n5",
"icon": "arrow-fat-up",
"kind": "level",
"arg": null,
"goal": 5,
"xp": 50,
"name": "Subiendo escalones",
"desc": "Nivel 5 alcanzado. Poco a poco dejas de ser carne de cañón para ser carne de cañón con experiencia."
},
{
"id": "n10",
"icon": "diamond",
"kind": "level",
"arg": null,
"goal": 10,
"xp": 120,
"name": "Veterano",
"desc": "Nivel 10. Has sobrevivido a más partidas que la mayoría de gnomos a un martes."
},
{
"id": "n20",
"icon": "star",
"kind": "level",
"arg": null,
"goal": 20,
"xp": 250,
"name": "Gnomo de leyenda",
"desc": "Nivel 20. Los gnomos jóvenes te señalan por la calle. Y luego se esconden."
}
];

// Descripciones con el tono de Nizak (por id de entrada) y virtudes/debilidades de los equipos.
const GNOMOTECA_DESC = {
"u:gnomo": "Pequeño, barbudo y de una utilidad inmensa como proyectil. Nunca ha pedido que lo lancen, pero tampoco ha dicho que no. Cada golpe lo deja más cargado de puntos y más mareado de vida.",
"u:guardia": "Paranoico profesional, con armadura hasta en los pensamientos. Vigila la cámara sellada y persigue sin descanso a quien lleve la Reliquia, sea del equipo que sea. Lo único que lo detiene es un gnomo en la cara.",
"r:roca": "Una roca. Con dos golpes se rompe y suelta piedra para la mochila. Ni siente, ni padece, ni protesta: el recurso ideal.",
"r:pino": "Un árbol de los de toda la vida. Con dos golpes cae y suelta madera para la mochila. Tardó siglos en crecer y tú tardarás dos turnos en arreglarlo.",
"r:mena": "Mena de hierro, escasa a propósito para que te pelees por ella. Con dos golpes suelta metal, imprescindible para subir la armería al máximo.",
"b:obelisco": "Tu base y tu único motivo para seguir vivo. Desde él reclutas unidades, eliges habilidades y mejoras en la armería. Si cae, pierdes la partida, así que cuídalo como cuidas todo lo que no sabes defender.",
"b:totem": "Capturarlo da Puntos de Gloria cada turno. Se defiende a flechazos y los ataques normales le hacen cosquillas. Cae simpático a todo el mundo, hasta que se lo quedan.",
"b:altar": "Aquí se ofrecen gnomos para ganar Gloria al instante. Nadie pregunta a los gnomos si están de acuerdo.",
"b:tienda": "Un goblin con muy mala leche y precios discretos. Repone el género cada cierto número de turnos y no da las gracias jamás.",
"b:oraculo": "Ocho cartas boca abajo, las mismas para todos. Pagas para girar dos y, si coinciden, te llevas el premio. Si no, te llevas la lección.",
"b:camara": "Una cámara sellada con cadenas en el centro del mapa. Las cadenas ceden cuando le estampas un gnomo cargado. Sí, un gnomo. Sí, es lo que parece.",
"o:trotamontes": "Botas pensadas para escalar montañas y no mirar atrás. Quien las calza llega siempre antes... y con ampollas.",
"o:acariciagnomos": "Un puño americano con pinchos dorados, ideal para acariciar gnomos a fondo. Ellos no lo piden; tú lo disfrutas igualmente.",
"o:ferognomas": "Perfume de feromonas de barba gnoma. Huele fatal, pero los gnomos acuden a ti como polillas a una lámpara con patas.",
"o:gnomeveo": "Gafas con nariz y bigote incluidos. Mirar al sol te quema la sombra; mirar gnomos, por suerte, no. Un disfraz totalmente innecesario y totalmente imprescindible.",
"o:gnomeda": "Oro puro de Rock'n Troll estampado contra un gnomo, sin querer. El gnomo no lo vio venir y tú tampoco, pero la paga llega puntual.",
"o:reliquia_paranoica": "Nadie sabe qué es ni para qué sirve, pero todos matarían por ella. Quien la lleva deja ondas en los pies y lo ve media isla. Muy discreta.",
"t:mushboom_forest": "Gente de bosque, pegada a las setas explosivas y a sus propios dedos (de momento). Son tres: GolemCorteza, SurcaBosques y TruenoEspora.",
"t:colinas_rockntroll": "Trolls de las colinas rocosas, tan duros de roer como su música: LanzaGnomos, UrgaMentes y PuñoRroca. Sutileza, la justa: ninguna.",
"t:equipo_surcanubes": "Gente de las nubes y de manos ligeras: ManosLargas, AlaFugaz y NidoBot. Si echas algo en falta, probablemente lo tienen ellos.",
"t:equipo_enmurallado": "Soldados de la gran muralla, tan bien guardados como bien armados: MagoNífico, TrazaFlechas y PortaMuros. Se han leído el manual de guerra entero, y lo han subrayado.",
"l:mushboom_forest": "Un bosque de ríos y lagos donde cualquier seta puede ser una bomba. Dar un paseo es una decisión arriesgada.",
"l:colinas_rockntroll": "Colinas rocosas con tambores que hacen llover piedras y un volcán en el centro con muy mal carácter.",
"l:hurrycrane_village": "Un poblado sobre las nubes, azotado por vientos que no descansan, con un huevo que rebota y una grulla con poca paciencia.",
"l:wallforge": "Una fortaleza flotante de muros, torres y paranoia, donde una reliquia cautiva suelta páginas por todo el mapa. Recógelas y llévalas a tu obelisco antes de que alguien te las quite, que lo harán."
};
const GNOMOTECA_EXTRA = {
"t:mushboom_forest": [
"Los más ágiles con el gnomo: SurcaBosques y TruenoEspora lo pasan casi siempre. Ven más lejos y llevan herramientas de zona: visión lejana y setas trampa. GolemCorteza es el tanque: se cura del todo y devuelve el daño con sus espinas. Un bosque entero que quiere hacerte daño.",
"Plantilla de cristal: SurcaBosques tiene 1 de vida y GolemCorteza solo avanza 2 casillas y casi nunca acierta al pasar el gnomo. Cada habilidad se usa una vez hasta volver junto a un tótem propio."
],
"t:colinas_rockntroll": [
"Controlan el campo a la fuerza: PuñoRroca empuja 4 casillas (y ahoga en el agua), LanzaGnomos lanza a cualquier unidad por el mapa y UrgaMentes toma el mando de un rival durante un turno. PuñoRroca es un muro de 4 de vida y 3 de fuerza.",
"Todo pasa por estar pegados al objetivo: sus habilidades necesitan una unidad adyacente. PuñoRroca da tumbos al azar si no empieza a andar con un aliado al lado, y LanzaGnomos y UrgaMentes aguantan poco (2 de vida). Mucha pose y poca salud."
],
"t:equipo_surcanubes": [
"Los más rápidos (ManosLargas llega a 4 casillas) y con más vida en conjunto: NidoBot tiene 5. Sus trucos cambian la partida: roban mochilas, caen del cielo hasta a 7 casillas y NidoBot explota en área hasta 3 casillas. Ya se verá si a tu favor.",
"Sus trucos se pagan con sangre: AlaFugaz se hace 1-3 de daño al aterrizar y NidoBot hasta 5 si incuba 3 turnos. ManosLargas tiene 1 de vida, pegan flojo y ven poco (percepción 1-2). Mucho truco y poca resistencia."
],
"t:equipo_enmurallado": [
"Dominan la información y el espacio: TrazaFlechas marca a un rival a 3 casillas y ve lo que ve él hasta que muere, MagoNífico se cambia de sitio con cualquier rival que veas y PortaMuros aplasta y deja inactivo al que tenga al lado. Ven muy lejos (percepción 4) y PortaMuros es un muro de 4 de vida y 3 de fuerza.",
"Frágiles y de poco pegar: MagoNífico y TrazaFlechas solo aguantan 1 golpe y PortaMuros avanza despacio (2 casillas). Sus trucos solo se usan una vez hasta recargar en un tótem, y el cambiazo se deshace al acabar el turno. Mucha estrategia, poco aguante."
]
};

const Gnomoteca = {
  seen: new Set(),
  cat: "unidades",
  sel: 0,
  _watchT: 0,
  _ready: false,
  _uid: null,
  _uid: null,
  _cloud: false,   // true cuando ya se leyó la nube (hasta entonces no se cobra XP ni se desbloquea nada)
  _dirty: false,   // hay algo nuevo que subir
  _pushT: 0,
  ach: new Set(),  // logros desbloqueados
  st: {},          // contadores de logros (partidas, victorias...) y "dx" = entradas ya cobradas
  _sig: "",
  _toastQ: [],
  _toastBusy: false,

  CATS: [
    { id: "unidades", label: "Unidades" },
    { id: "recursos", label: "Recursos" },
    { id: "edificios", label: "Edificios" },
    { id: "objetos", label: "Objetos" },
    { id: "equipos", label: "Equipos" },
    { id: "escenarios", label: "Escenarios" },
    { id: "logros", label: "Logros" },
  ],

  init() {
    try {
      const raw = localStorage.getItem(GNOMOTECA_KEY);
      if (raw) JSON.parse(raw).forEach((id) => this.seen.add(id));
    } catch (e) {}
    const btn = document.getElementById("btn-gnomoteca");
    if (btn) btn.addEventListener("click", () => this.open());
    this._startWatching();
    this._hookProgress();
    // Nube (Firestore gnomoteca/{uid}): UN documento con todo (ids vistos, logros y contadores). Una lectura al iniciar
    // sesión y escrituras solo cuando hay algo nuevo: agrupadas (90 s después del último cambio) o al salir de la pestaña.
    document.addEventListener("gg:authchange", (e) => this._onAuth(e.detail && e.detail.user));
    document.addEventListener("visibilitychange", () => { if (document.hidden) this._push(); });
    window.addEventListener("pagehide", () => this._push());
  },

  get _db() { return typeof Account !== "undefined" ? Account._db : null; },

  _loadLocalAch() {
    this.ach = new Set();
    this.st = {};
    try {
      const o = JSON.parse(localStorage.getItem(GNOMOTECA_ACH_KEY + this._uid) || "null");
      if (o) { (o.a || []).forEach((id) => this.ach.add(id)); Object.assign(this.st, o.st || {}); }
    } catch (e) {}
  },
  _saveLocal() {
    try { localStorage.setItem(GNOMOTECA_KEY, JSON.stringify([...this.seen])); } catch (e) {}
    if (this._uid) { try { localStorage.setItem(GNOMOTECA_ACH_KEY + this._uid, JSON.stringify({ a: [...this.ach], st: this.st })); } catch (e) {} }
  },
  _touch() {
    this._dirty = true;
    this._saveLocal();
    if (this._uid) { clearTimeout(this._pushT); this._pushT = setTimeout(() => this._push(), 90000); }
  },

  async _onAuth(user) {
    this._uid = user ? user.uid : null;
    this._cloud = false;
    this._sig = "";
    clearTimeout(this._pushT);
    this.ach = new Set();
    this.st = {};
    const db = this._db, uid = this._uid;
    if (!uid) return;
    this._loadLocalAch();
    if (!db) { this._cloud = true; return this._afterCloud(); }
    try {
      const snap = await db.collection("gnomoteca").doc(uid).get();
      if (uid !== this._uid) return;
      let need = false;
      if (snap.exists) {
        const d = snap.data();
        const ids = typeof d.ids === "string" && d.ids ? d.ids.split(",") : [];
        const rem = new Set(ids);
        ids.forEach((id) => { if (id) this.seen.add(id); });
        if (this.seen.size > rem.size) need = true; // lo que solo tenía este navegador, sube
        const ra = typeof d.a === "string" && d.a ? d.a.split(",") : [];
        const remA = new Set(ra);
        ra.forEach((id) => this.ach.add(id));
        if (this.ach.size > remA.size) need = true;
        const rs = d.st && typeof d.st === "object" ? d.st : {};
        Object.keys(rs).forEach((k) => { const v = +rs[k] || 0; if ((this.st[k] || 0) < v) this.st[k] = v; });
        Object.keys(this.st).forEach((k) => { if ((+rs[k] || 0) < this.st[k]) need = true; });
      } else need = this.seen.size > 0 || this.ach.size > 0 || Object.keys(this.st).length > 0;
      this._dirty = need;
      this._saveLocal();
      this._cloud = true;
      if (need) this._touch();
      this._afterCloud();
    } catch (e) { console.warn("gnomoteca:", e && e.code); }
  },
  _afterCloud() {
    // Progress carga su documento a la vez: se reintenta unos instantes hasta que esté listo.
    [800, 2500, 6000, 12000].forEach((t) => setTimeout(() => this._check(), t));
    if (this._ready && document.getElementById("screen-gnomoteca").classList.contains("screen--active")) this._render();
  },

  async _push() {
    clearTimeout(this._pushT);
    const db = this._db, uid = this._uid;
    if (!db || !uid || !this._cloud || !this._dirty) return;
    this._dirty = false;
    try {
      await db.collection("gnomoteca").doc(uid).set({ v: 1, ids: [...this.seen].join(","), a: [...this.ach].join(","), st: this.st });
    } catch (e) { this._dirty = true; console.warn("gnomoteca:", e && e.code); }
  },

  // ---------- Descubrimiento ----------
  discover(id) {
    if (!id || this.seen.has(id)) return false;
    this.seen.add(id);
    this._touch();
    return true;
  },

  // ---------- Logros ----------
  _hookProgress() {
    if (typeof Progress === "undefined" || Progress._gnomoHooked) return;
    Progress._gnomoHooked = true;
    const orig = Progress.onMatch, self = this;
    Progress.onMatch = function (m) {
      const r = orig.apply(this, arguments);
      try { if (r) self._onMatch(m || {}); } catch (e) {}
      return r;
    };
  },
  _onMatch(m) {
    const st = this.st, win = m.result === "win";
    const add = (k, n) => { if (n > 0) st[k] = (st[k] || 0) + n; };
    add("games", 1);
    add("wins", win ? 1 : 0);
    add("kills", m.kills || 0);
    add("totems", m.totems || 0);
    add("online", m.online ? 1 : 0);
    add("onlineWins", m.online && win ? 1 : 0);
    add("multiWin", win && (m.rivals || 1) >= 2 ? 1 : 0);
    if (m.level) st["lv:" + m.level] = 1;
    this._touch();
    this._sig = "";
    this._check();
  },

  // Entradas del libro (todas las categorías de contenido) y cuántas llevas vistas.
  _bookCount(cat) {
    const cats = cat ? [cat] : this.CATS.filter((c) => c.id !== "logros").map((c) => c.id);
    let n = 0, tot = 0;
    cats.forEach((c) => this.entries(c).forEach((e) => { tot++; if (this.seen.has(e.id)) n++; }));
    return { n, tot };
  },
  _prog(a) {
    const g = a.goal;
    switch (a.kind) {
      case "seen": return { cur: Math.min(g, this._bookCount().n), goal: g };
      case "all": { const b = this._bookCount(); return { cur: b.n, goal: b.tot }; }
      case "cat": { const b = this._bookCount(a.arg); return { cur: b.n, goal: b.tot }; }
      case "st": return { cur: Math.min(g, this.st[a.arg] || 0), goal: g };
      case "lv": {
        const tot = (typeof LEVELS !== "undefined" ? LEVELS : []).filter((l) => l.available !== false).length || 4;
        return { cur: Math.min(tot, Object.keys(this.st).filter((k) => k.indexOf("lv:") === 0).length), goal: tot };
      }
      case "tut": {
        const T = typeof Tutorial !== "undefined" && Tutorial.isDone ? Tutorial : null;
        return { cur: T ? ["basic", "mush", "rock", "crane", "wall"].filter((id) => T.isDone(id)).length : 0, goal: g };
      }
      case "streak": return { cur: Math.min(g, typeof Progress !== "undefined" && Progress._s ? Progress.s.streak || 0 : 0), goal: g };
      case "level": return { cur: Math.min(g, typeof Progress !== "undefined" && Progress._s ? Progress.level : 0), goal: g };
    }
    return { cur: 0, goal: g || 1 };
  },
  // Cobra XP por entradas nuevas y desbloquea logros. Solo con sesión iniciada y la nube ya leída.
  _check() {
    if (!this._uid || !this._cloud || typeof Progress === "undefined" || !Progress._loaded || Progress._uid !== this._uid) return;
    let tut = 0;
    try { tut = typeof Tutorial !== "undefined" && Tutorial.isDone ? ["basic", "mush", "rock", "crane", "wall"].filter((id) => Tutorial.isDone(id)).length : 0; } catch (e) {}
    const sig = this.seen.size + "|" + JSON.stringify(this.st) + "|" + this.ach.size + "|" + Progress.level + "|" + (Progress.s.streak || 0) + "|" + tut;
    if (sig === this._sig) return;
    this._sig = sig;
    const owed = this.seen.size - (this.st.dx || 0);
    if (owed > 0 && Progress.addXp(owed * GNOMOTECA_XP_ENTRY)) {
      this.st.dx = this.seen.size;
      this._touch();
      this._toast({ icon: "book-open-text", xp: owed * GNOMOTECA_XP_ENTRY });
    }
    GNOMOTECA_ACH.forEach((a) => {
      if (this.ach.has(a.id)) return;
      const p = this._prog(a);
      if (p.goal > 0 && p.cur >= p.goal && Progress.addXp(a.xp)) {
        this.ach.add(a.id);
        this._touch();
        this._toast({ icon: a.icon, name: a.name, xp: a.xp, gold: true });
      }
    });
    this._sig = "";
  },

  // Aviso compacto arriba: icono, nombre del logro y XP. Se encolan para no pisarse.
  _toast(o) {
    this._toastQ.push(o);
    if (!this._toastBusy) this._nextToast();
  },
  _nextToast() {
    const o = this._toastQ.shift();
    if (!o) { this._toastBusy = false; return; }
    this._toastBusy = true;
    const el = document.createElement("div");
    el.className = "gnomo-toast" + (o.gold ? " gnomo-toast--gold" : "");
    el.innerHTML = `<i class="ph-bold ph-${this._esc(o.icon)} gnomo-toast__ico"></i><span class="gnomo-toast__tx"><small>${o.gold ? "Logro desbloqueado" : "Gnomoteca"}</small>${o.name ? `<strong>${this._esc(o.name)}</strong>` : ""}</span><em class="gnomo-toast__xp"><b>+${o.xp}</b> XP</em>`;
    document.body.appendChild(el);
    try { if (typeof SFX !== "undefined" && SFX.enabled) (SFX.missionDone || SFX.click).call(SFX); } catch (e) {}
    const done = () => { el.remove(); setTimeout(() => this._nextToast(), 250); };
    if (!el.animate) return setTimeout(done, 3600);
    el.animate([
      { transform: "translate(-50%,-140%) rotate(-3deg) scale(.9)", opacity: 0 },
      { transform: "translate(-50%,8%) rotate(1.5deg) scale(1.06,.94)", opacity: 1, offset: .5 },
      { transform: "translate(-50%,0) rotate(-0.8deg) scale(.98,1.03)", offset: .75 },
      { transform: "translate(-50%,0) rotate(-0.6deg) scale(1)" },
    ], { duration: 480, easing: "ease-out", fill: "forwards" }).onfinish = () => {
      setTimeout(() => {
        el.animate([{ transform: "translate(-50%,0) rotate(-0.6deg)", opacity: 1 }, { transform: "translate(-50%,-140%) rotate(2deg)", opacity: 0 }], { duration: 320, easing: "ease-in", fill: "forwards" }).onfinish = done;
      }, 3200);
    };
  },

  // Mientras hay una partida en pantalla, cada 1,5 s se apunta lo que se ve (nada de trabajo por fotograma).
  _startWatching() {
    if (this._watchT) return;
    this._watchT = setInterval(() => {
      const board = document.getElementById("screen-board");
      if (!board || !board.classList.contains("screen--active") || document.hidden) return;
      this._scanBoard();
    }, 1500);
  },

  _visible(el) {
    return !!el && !el.closest(".unit--fog-hidden");
  },

  _scanBoard() {
    // Escenario y equipo elegidos, y las mecánicas propias del escenario.
    if (typeof LevelAssets !== "undefined" && LevelAssets.current) { this.discover("l:" + LevelAssets.current); }
    if (typeof matchDraft !== "undefined" && matchDraft.raceId) this.discover("t:" + matchDraft.raceId);
    // Unidades (de cualquier bando) mientras no estén en la niebla.
    if (typeof Units !== "undefined" && Units.list) {
      Units.list.forEach((u) => {
        if (!u.el || !this._visible(u.el)) return;
        this.discover("u:" + u.typeId);
        const t = typeof UNIT_TYPES !== "undefined" ? UNIT_TYPES[u.typeId] : null;
        if (t && t.raceId) this.discover("t:" + t.raceId);
      });
    }
    if (typeof Gnome !== "undefined" && Gnome.list && Gnome.list.some((g) => g.el && this._visible(g.el))) this.discover("u:gnomo");
    // Recursos de escenario.
    if (typeof Resources !== "undefined" && Resources.list) {
      Resources.list.forEach((n) => { if (n.el && this._visible(n.el)) this.discover("r:" + n.kind); });
    }
    // Edificios y estructuras.
    const q = (sel, id) => { const e = document.querySelector(sel); if (e && this._visible(e)) this.discover(id); };
    q(".obelisk__sprite", "b:obelisco");
    q(".village__sprite", "b:totem");
    q(".altar__sprite", "b:altar");
    q(".shop__sprite:not(.oracle__sprite)", "b:tienda");
    q(".oracle__sprite", "b:oraculo");
    q(".reliquia-altar", "b:camara");
    q(".reliquia-guard", "u:guardia");
    // Objetos: reliquias de la mochila y la Reliquia Paranoica.
    if (typeof Relics !== "undefined" && Relics.byTeam && Relics.byTeam.player) Relics.byTeam.player.forEach((r) => this.discover("o:" + r.relicId));
    if (typeof Reliquia !== "undefined" && Reliquia.relic && Reliquia.relic.state && Reliquia.relic.state !== "altar") this.discover("o:reliquia_paranoica");    this._check();
  },

  // ---------- Datos ----------
  _race(raceId) {
    return typeof RACES !== "undefined" ? RACES.find((r) => r.id === raceId) : null;
  },
  _tr(key) {
    return typeof I18N !== "undefined" ? I18N.t(key) : key;
  },

  entries(cat) {
    const out = [];
    if (cat === "unidades") {
      out.push({
        id: "u:gnomo", name: "Gnomo", type: "Unidad básica", img: "assets/equipos/MushboomForest/gnomo_idle.png",
        desc: "Pequeño, barbudo y sorprendentemente útil como proyectil. Se lanza contra recursos, guardias y páginas, y se carga de puntos al golpear.",
        chips: ["Se puede lanzar", "Una unidad solo carga un gnomo"],
      });
      if (typeof UNIT_TYPES !== "undefined") {
        const maxOf = (k) => Math.max(5, ...Object.values(UNIT_TYPES).map((t) => t[k] || 0));
        Object.keys(UNIT_TYPES).forEach((id) => {
          const t = UNIT_TYPES[id];
          const race = this._race(t.raceId);
          const ab = typeof ABILITIES !== "undefined" ? ABILITIES[id] : null;
          out.push({
            id: "u:" + id, name: t.name, type: race ? this._tr(race.nameKey) : "Unidad", img: t.spriteUrl,
            desc: typeof UNIT_DESCRIPTIONS !== "undefined" ? UNIT_DESCRIPTIONS[id] || "" : "",
            stats: [["Aguante", t.aguante, maxOf("aguante")], ["Movimiento", t.movimiento, maxOf("movimiento")], ["Fuerza", t.fuerza, maxOf("fuerza")], ["Agilidad", t.agilidad, maxOf("agilidad")], ["Percepción", t.percepcion, maxOf("percepcion")]],
            extra: ab ? [[ab.name, ab.description]] : [],
          });
        });
      }
      out.push({
        id: "u:guardia", name: "Guardia de la Reliquia", type: "Neutral · Fortaleza WallForge", img: "assets/niveles/wallforge/guardia.png",
        desc: "Paranoico profesional. Vigila la cámara sellada y persigue sin descanso a quien lleve la Reliquia, sea del equipo que sea.",
        chips: ["Inmortal", "Solo se marea con un gnomo lanzado"],
      });
    } else if (cat === "recursos") {
      const R = typeof RESOURCE_NODE_TYPES !== "undefined" ? RESOURCE_NODE_TYPES : {};
      const txt = {
        roca: "Fuente de roca. Con dos golpes se rompe y suelta roca para la mochila.",
        pino: "Árbol de madera. Con dos golpes cae y suelta madera para la mochila.",
        mena: "Mena de metal, escasa a propósito. Con dos golpes suelta metal, necesario para subir la armería al máximo.",
      };
      Object.keys(R).forEach((k) => out.push({
        id: "r:" + k, name: k === "pino" ? "Árbol" : k === "mena" ? "Mena de Hierro" : "Roca", type: "Recurso · neutral",
        img: R[k].spriteUrl.replace(/\.png$/, "_midres.png"), desc: txt[k] || "", chips: ["Bloquea el paso", "Se rompe con dos golpes"],
      }));
    } else if (cat === "edificios") {
      out.push(
        { id: "b:obelisco", name: "Obelisco", type: "Estructura · base", img: "assets/edificios/obelisco_mushboom_forest_midres.png", desc: "Tu base. Desde él reclutas unidades, eliges habilidades y mejoras en la armería. Si cae, pierdes la partida.", chips: ["Reclutar", "Habilidades", "Armería"] },
        { id: "b:totem", name: "Tótem", type: "Estructura · capturable", img: "assets/iconos/poblado_neutral_midres.png", desc: "Capturarlo da Puntos de Gloria cada turno. Se defiende con flechas y no sufre daño de ataques normales.", chips: ["Da Gloria", "Capturable"] },
        { id: "b:altar", name: "Altar de Sacrificios", type: "Estructura · MushBoom", img: "assets/edificios/altar_sacrificios_lleno_midres.png", desc: "Aquí se ofrecen gnomos para ganar Gloria al instante.", chips: ["Sacrificio"] },
        { id: "b:tienda", name: "Tienda Goblin", type: "Estructura · comercio", img: "assets/edificios/tienda_goblin_midres.png", desc: "Un goblin con muy mala leche y buenos precios. Se repone cada cierto número de turnos.", chips: ["Compra con Gloria"] },
        { id: "b:oraculo", name: "Oráculo", type: "Estructura · cartas", img: "assets/edificios/oraculo_midres.png", desc: "Ocho cartas boca abajo, las mismas para todos. Paga para girar dos; si coinciden, ganas su beneficio.", chips: ["Cartas", "Coste creciente"] },
        { id: "b:camara", name: "Cámara de la Reliquia", type: "Estructura · WallForge", img: "assets/niveles/wallforge/altar_sellado.png", desc: "Cámara sellada con cadenas en el centro del mapa. Las cadenas ceden cuando se lanza contra ella un gnomo cargado.", chips: ["Centro del mapa", "Se resella al devolver la Reliquia"] },
      );
    } else if (cat === "objetos") {
      const RT = typeof RELIC_TYPES !== "undefined" ? RELIC_TYPES : {};
      Object.keys(RT).forEach((id) => out.push({ id: "o:" + id, name: RT[id].name, type: "Reliquia de la mochila", img: RT[id].iconUrl, desc: RT[id].description, chips: ["Aguanta " + RT[id].durability + " bajas"] }));
      out.push({ id: "o:reliquia_paranoica", name: "Reliquia Paranoica", type: "Objeto único · WallForge", img: "assets/niveles/wallforge/reliquia.png", desc: "Quien la lleva deja ondas en los pies y todos lo ven, a él y lo que ve. Gana puntos con las páginas y los cobra al llegar junto a su obelisco.", chips: ["Visible para todos", "Si el portador cae, queda en el suelo"] });
    } else if (cat === "equipos") {
      (typeof RACES !== "undefined" ? RACES : []).forEach((r) => out.push({
        id: "t:" + r.id, name: this._tr(r.nameKey), type: "Equipo", img: r.iconImg, desc: this._tr(r.flavorKey),
        extra: [["Virtudes", this._tr(r.virtuesKey)], ["Debilidades", this._tr(r.weaknessesKey)]],
      }));
    } else if (cat === "escenarios") {
      (typeof LEVELS !== "undefined" ? LEVELS : []).filter((l) => l.available !== false).forEach((l) => out.push({
        id: "l:" + l.id, name: this._tr(l.nameKey), type: "Escenario", img: l.islandImg, desc: this._tr(l.flavorKey),
        chips: (l.featureKeys || []).map((k) => this._tr(k)),
      }));
    } else if (cat === "logros") {
      GNOMOTECA_ACH.forEach((a) => {
        const p = this._prog(a);
        out.push({ id: "a:" + a.id, ach: true, icon: a.icon, name: a.name, type: "Logro", desc: a.desc, xp: a.xp, cur: p.cur, goal: p.goal, done: this.ach.has(a.id) });
      });
    }
    // Todas las descripciones con el tono de Nizak. Lo que era una regla seca (objetos) se conserva como "Efecto".
    out.forEach((e) => {
      const d = GNOMOTECA_DESC[e.id];
      if (d) {
        if (e.id.indexOf("o:") === 0 && e.desc) e.extra = [["Efecto", e.desc]].concat(e.extra || []);
        e.desc = d;
      }
      const x = GNOMOTECA_EXTRA[e.id];
      if (x) e.extra = [["Virtudes", x[0]], ["Debilidades", x[1]]];
    });
    return out;
  },

  // ---------- Interfaz ----------
  open() {
    this._build();
    this.cat = "unidades";
    this.sel = 0;
    this._check();
    this._render(false);
    if (typeof goToScreen === "function") goToScreen("screen-gnomoteca");
  },

  _build() {
    const root = document.getElementById("gnomoteca-root");
    if (!root || this._ready) return;
    this._ready = true;
    root.innerHTML = `
      <div class="gnomo-stage">
        <div class="gnomo-tabs" id="gt-tabs"></div>
        <div class="gnomo-ribbon dl"></div>
        <div class="gnomo-title dl"><span>Gnomoteca</span></div>
        <div class="gnomo-book dl">
          <div class="gnomo-pages">
            <section class="gnomo-pg gnomo-pg--l dl"><h3 class="gnomo-h" id="gt-cat"></h3><div class="gnomo-total" id="gt-total" hidden></div><div class="gnomo-list" id="gt-list"></div><span class="gnomo-pn gnomo-pn--l" id="gt-pl"></span></section>
            <section class="gnomo-pg gnomo-pg--r dl" id="gt-right"><h3 class="gnomo-h" id="gt-name"></h3>
              <div class="gnomo-plate dl"><span class="gnomo-tag" id="gt-tag"></span><img id="gt-img" alt="" draggable="false" /><i id="gt-ico" class="gnomo-bigico" hidden></i></div>
              <div class="gnomo-scroll"><p class="gnomo-desc" id="gt-desc"></p><div id="gt-stats"></div><div id="gt-extra"></div><div class="gnomo-chips" id="gt-chips"></div></div>
              <span class="gnomo-pn gnomo-pn--r" id="gt-pr"></span></section>
          </div>
        </div>
      </div>`;
    const back = document.querySelector("#screen-gnomoteca .back-btn");
    // Clic fuera del libro (ni libro, ni pestañas, ni título, ni el propio botón): se cierra, igual que Volver.
    const scr = document.getElementById("screen-gnomoteca");
    // Se decide al PULSAR (no al soltar): al hacer clic en una pestaña o ficha el libro se repinta y el elemento
    // pulsado ya no existe cuando llega el "click", así que mirar entonces cerraría el libro por error.
    let outDown = false;
    const inside = (t) => !!(t && t.closest && t.closest(".gnomo-stage, .back-btn, button, a, input, select, textarea, [role=button]"));
    if (scr) {
      scr.addEventListener("pointerdown", (e) => { outDown = !inside(e.target); });
      scr.addEventListener("click", (e) => {
        const wasOut = outDown && !inside(e.target) && e.target.isConnected;
        outDown = false;
        if (wasOut && back) back.click();
      });
    }
    if (back) { back.addEventListener("click", () => this._snd()); back.addEventListener("mouseenter", () => this._hov()); }
    ["#gt-tabs", "#gt-list"].forEach((sel) => root.querySelector(sel).addEventListener("mouseover", (e) => {
      const t = e.target.closest(".gnomo-tab, .gnomo-it");
      if (t && !t.contains(e.relatedTarget)) this._hov();
    }));
    root.querySelector("#gt-tabs").addEventListener("click", (e) => {
      const t = e.target.closest(".gnomo-tab");
      if (t) { this.cat = t.dataset.c; this.sel = 0; this._render(true); }
    });
    root.querySelector("#gt-list").addEventListener("click", (e) => {
      const it = e.target.closest(".gnomo-it");
      if (it) { this.sel = +it.dataset.k; this._render(true); }
    });
    root.querySelector("#gt-list").addEventListener("keydown", (e) => {
      const it = e.target.closest(".gnomo-it");
      if (it && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); this.sel = +it.dataset.k; this._render(true); }
    });
    // Teclado: ◂ ▸ cambian de categoría, ▴ ▾ de entrada (mientras el libro está abierto).
    document.addEventListener("keydown", (e) => {
      const scr = document.getElementById("screen-gnomoteca");
      if (!scr || !scr.classList.contains("screen--active")) return;
      const ci = this.CATS.findIndex((c) => c.id === this.cat), n = this.entries(this.cat).length;
      if (e.key === "ArrowLeft") { this.cat = this.CATS[(ci + this.CATS.length - 1) % this.CATS.length].id; this.sel = 0; this._render(true); }
      else if (e.key === "ArrowRight") { this.cat = this.CATS[(ci + 1) % this.CATS.length].id; this.sel = 0; this._render(true); }
      else if (e.key === "ArrowUp") { this.sel = Math.max(0, this.sel - 1); this._render(true); }
      else if (e.key === "ArrowDown") { this.sel = Math.min(n - 1, this.sel + 1); this._render(true); }
    });
  },

  _snd() { try { if (typeof SFX !== "undefined" && SFX.enabled) SFX.click(); } catch (e) {} },
  _hov() { try { if (typeof SFX !== "undefined" && SFX.enabled) SFX.hover(); } catch (e) {} },

  _esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  },

  _render(flip) {
    const $ = (id) => document.getElementById(id);
    if (!$("gt-tabs")) return;
    const list = this.entries(this.cat);
    if (this.sel >= list.length) this.sel = 0;
    const isAch = this.cat === "logros";
    $("gt-tabs").innerHTML = this.CATS.map((c) => `<button type="button" class="gnomo-tab dl ${c.id === "logros" ? "gnomo-tab--gold" : ""} ${c.id === this.cat ? "gnomo-tab--active" : ""}" data-c="${c.id}">${c.label}</button>`).join("");
    $("gt-cat").textContent = this.CATS.find((c) => c.id === this.cat).label;
    // Barra de logros conseguidos respecto al total.
    const tot = $("gt-total");
    if (isAch) {
      const got = list.filter((e) => e.done).length;
      tot.hidden = false;
      tot.innerHTML = `<div class="gnomo-bar gnomo-bar--gold"><i style="width:${list.length ? Math.round((got / list.length) * 100) : 0}%"></i></div><b>${got} / ${list.length}</b>`;
    } else { tot.hidden = true; tot.innerHTML = ""; }
    $("gt-list").classList.toggle("gnomo-list--ach", isAch);
    $("gt-list").innerHTML = list.map((e, k) => {
      if (e.ach) {
        return `<div class="gnomo-it gnomo-it--ach dl ${k === this.sel ? "gnomo-it--on" : ""} ${e.done ? "gnomo-it--got" : "gnomo-it--off"}" data-k="${k}" role="button" tabindex="0"><i class="ph-bold ph-${this._esc(e.icon)} gnomo-ico"></i><span>${this._esc(e.name)}</span><em class="gnomo-xp"><b>+${e.xp}</b> XP</em></div>`;
      }
      const lock = !this.seen.has(e.id);
      return `<div class="gnomo-it dl ${k === this.sel ? "gnomo-it--on" : ""} ${lock ? "gnomo-it--lock" : ""}" data-k="${k}" role="button" tabindex="0"><img src="${this._esc(e.img)}" alt="" draggable="false"><span>${lock ? "???" : this._esc(e.name)}</span></div>`;
    }).join("");
    const e = list[this.sel];
    if (!e) return;
    const plate = document.querySelector("#gt-right .gnomo-plate");
    if (e.ach) {
      plate.classList.add("gnomo-plate--gold");
      plate.classList.toggle("gnomo-plate--off", !e.done);
      $("gt-img").hidden = true;
      const ic = $("gt-ico");
      ic.hidden = false;
      ic.className = `ph-bold ph-${e.icon} gnomo-bigico`;
      $("gt-name").textContent = e.name;
      $("gt-tag").textContent = e.type;
      $("gt-tag").style.display = "";
      $("gt-desc").textContent = e.desc;
      const pct = e.goal ? Math.min(100, Math.round((e.cur / e.goal) * 100)) : 0;
      $("gt-stats").innerHTML = `<div class="gnomo-st gnomo-st--p"><span>Progreso</span><div class="gnomo-bar gnomo-bar--gold"><i style="width:${pct}%"></i></div><b>${e.cur} / ${e.goal}</b></div>`;
      $("gt-extra").innerHTML = "";
      $("gt-chips").innerHTML = `<span class="gnomo-chip gnomo-chip--gold"><b>+${e.xp}</b> XP</span><span class="gnomo-chip ${e.done ? "gnomo-chip--ok" : ""}">${e.done ? "Desbloqueado" : "Bloqueado"}</span>`;
    } else {
      plate.classList.remove("gnomo-plate--gold", "gnomo-plate--off");
      $("gt-ico").hidden = true;
      $("gt-img").hidden = false;
      const lock = !this.seen.has(e.id);
      $("gt-name").textContent = lock ? "???" : e.name;
      $("gt-tag").textContent = lock ? "" : e.type || "";
      $("gt-tag").style.display = lock ? "none" : "";
      $("gt-img").src = e.img;
      $("gt-img").classList.toggle("gnomo-shadow", lock);
      $("gt-desc").textContent = lock ? "" : e.desc || "";
      $("gt-stats").innerHTML = lock || !e.stats ? "" : e.stats.map((s) => `<div class="gnomo-st"><span>${s[0]}</span><div class="gnomo-bar"><i style="width:${Math.min(100, Math.round((s[1] / s[2]) * 100))}%"></i></div><b>${s[1]}</b></div>`).join("");
      $("gt-extra").innerHTML = lock || !e.extra ? "" : e.extra.filter((x) => x[1]).map((x) => `<div class="gnomo-ex"><b>${this._esc(x[0])}</b><p>${this._esc(x[1])}</p></div>`).join("");
      $("gt-chips").innerHTML = lock || !e.chips ? "" : e.chips.map((c) => `<span class="gnomo-chip">${this._esc(c)}</span>`).join("");
    }
    const ci = this.CATS.findIndex((c) => c.id === this.cat);
    $("gt-pl").textContent = ci * 2 + 1;
    $("gt-pr").textContent = ci * 2 + 2;
    if (flip) this._snd();
    if (flip && !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) {
      // Efecto de goma (el del demo): el sprite se estira y se aplasta al caer, y el texto sube con un pequeño rebote.
      const img = e.ach ? $("gt-ico") : $("gt-img"), sc = document.querySelector("#gt-right .gnomo-scroll");
      if (img && img.animate) img.animate([
        { transform: "scale(.8,1.18)", offset: 0 }, { transform: "scale(1.1,.9)", offset: .4 },
        { transform: "scale(.97,1.04)", offset: .7 }, { transform: "scale(1)", offset: 1 },
      ], { duration: 380, easing: "ease-out" });
      if (sc && sc.animate) sc.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 220, easing: "ease-out" });
    }
  },
};

document.addEventListener("DOMContentLoaded", () => Gnomoteca.init());

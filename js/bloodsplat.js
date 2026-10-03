/* Gnomore Gnomes — charcos de sangre.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe: pintar un
   charco decorativo sobre una loseta cuando algo muere/se aplasta ahí, y
   quitarlo solo a los pocos segundos. No tiene vida, no se selecciona, no
   bloquea movimiento ni clics — puramente estético, mismo espíritu que
   Hierbajos (vegetación decorativa), del que reutiliza el mismo patrón de
   posicionamiento (ver _placeInstant).

   Pedido explícito: "ahora en la casilla donde muere un peersonaje o se
   aplasta un gnomo aparecera un charquito de sangre de golpe, que
   desaparecera haciendo face [fade] a los 3 segundos. lo adjunto, habran
   varios para ponerlos de manera aleatoria cuando tenga que aparecer y de
   la sensacion de variedad. de momento solo tenemos uno" — "de golpe"
   (sin fundido de entrada, aparece ya puesto) contrasta a propósito con la
   desaparición, que SÍ es un fundido de opacidad de
   BLOOD_SPLAT_FADE_MS. BLOOD_SPLAT_SPRITES es una lista pensada para
   crecer: con un solo elemento hoy, Math.random() siempre cae en el mismo,
   pero añadir una segunda/tercera imagen el día de mañana no necesita
   tocar nada más que ese array.

   Quién llama a spawnAt(row, col) — los dos sitios que pide el usuario:
     - Units.removeUnit (js/units.js) — "muere un personaje", cualquier
       causa (combate normal, GnomOgro, Señuelo Explosivo...), ya que todas
       pasan por esa única función.
     - Villages._playEpicSmash / Altar._playSacrificeSmash — "se aplasta un
       gnomo", el instante exacto en que golpean con él contra un tótem/el
       Altar (mismo momento en que ya se dispara Gnome.destroyInstance),
       sobre la loseta del personaje que lo lleva (ahí es donde cae el
       golpe, no sobre la loseta del tótem/Altar en sí). El "gnomo se
       aplasta contra un enemigo escondido en un arbusto" (Bushes.
       checkStepInto) y el Señuelo Explosivo (que ya tiene su propia
       explosión) se dejan fuera a propósito: ninguno de los dos es
       "aplastar un gnomo contra algo", así que no encajan en el pedido. */

const BLOOD_SPLAT_SPRITES = [
  "assets/decals/efecto_sangre_01.png",
  "assets/decals/efecto_sangre_02.png",
  "assets/decals/efecto_sangre_03.png",
];
const BLOOD_SPLAT_LIFETIME_MS = 3000; // "desaparecera...a los 3 segundos"
const BLOOD_SPLAT_FADE_MS = 500;

const BloodSplat = {
  list: [],
  _nextId: 1,

  resetAll() {
    this.list.forEach((s) => {
      if (s.timeoutId) clearTimeout(s.timeoutId);
      if (s.el) s.el.remove();
    });
    this.list = [];
  },

  // Pedido explícito: "de golpe" — nace ya a plena opacidad, sin fundido de
  // entrada. Si la loseta está bajo niebla ahora mismo, ni se crea (nunca
  // se ha visto nada ahí, no hay nada que "recordar" luego — a diferencia
  // del mobiliario fijo, esto vive solo 3 segundos, no merece la pena
  // arrastrar todo el sistema de niebla/memoria para algo tan efímero).
  // opts.scale multiplica el tamaño (el GnomOgro deja un charco enorme) y
  // opts.lifetime alarga el tiempo en pantalla.
  spawnAt(row, col, opts = {}) {
    if (typeof Fog !== "undefined" && Fog.isFogged(row, col)) return null;

    const spriteUrl = BLOOD_SPLAT_SPRITES[Math.floor(Math.random() * BLOOD_SPLAT_SPRITES.length)];

    const el = document.createElement("div");
    el.className = "unit blood-splat";

    const spriteEl = document.createElement("img");
    spriteEl.decoding = "async";
    spriteEl.className = "blood-splat__sprite";
    spriteEl.alt = "";
    spriteEl.draggable = false;
    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(spriteEl, spriteUrl);
    else spriteEl.src = spriteUrl;
    // Variación barata aunque hoy solo haya una imagen (mismo espíritu que
    // Hierbajos._create: "dar sensación de variedad") — espejado + un
    // pelín de escala al azar, para que dos charcos seguidos en la misma
    // zona no se vean como calcados.
    const flip = Math.random() < 0.5 ? -1 : 1;
    const scale = (0.9 + Math.random() * 0.3) * (opts.scale || 1);
    spriteEl.style.transform = `scale(${(scale * flip).toFixed(2)}, ${scale.toFixed(2)})`;
    el.appendChild(spriteEl);

    if (typeof Units !== "undefined") Units.container.appendChild(el);

    const splat = { id: `bloodsplat-${this._nextId++}`, row, col, el, timeoutId: null };
    this._placeInstant(splat);
    this.list.push(splat);

    splat.timeoutId = setTimeout(() => {
      el.classList.add("blood-splat--fading");
      setTimeout(() => this._remove(splat), BLOOD_SPLAT_FADE_MS);
    }, opts.lifetime || BLOOD_SPLAT_LIFETIME_MS);

    return splat;
  },

  _placeInstant(splat) {
    if (typeof getTileCenter === "undefined" || typeof Units === "undefined") return;
    const { x, y } = getTileCenter(splat.row, splat.col, Units.boardSize);
    splat.el.style.left = `${x}px`;
    splat.el.style.top = `${y}px`;
    // Mismo criterio que Hierbajos (+3): un charco es aún más "pegado al
    // suelo" que la vegetación decorativa, así que se queda justo por
    // debajo de ella (+1) — entre dos losetas distintas manda igualmente
    // el (fila+columna)*10, esto solo decide el empate dentro de la MISMA
    // loseta.
    splat.el.style.zIndex = String((splat.row + splat.col) * 10 + 1);
  },

  _remove(splat) {
    if (splat.el) splat.el.remove();
    this.list = this.list.filter((s) => s !== splat);
  },
};

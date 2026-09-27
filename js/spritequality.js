/* Gnomore Gnomes — calidad de sprite dinámica según el zoom de cámara.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe: llevar la
   cuenta de qué sprites del tablero (unidades, recursos, hierbajos,
   arbustos, tótems, Obeliscos, tienda, gnomo...) hay que servir en su
   versión reducida cuando la cámara está lo bastante alejada, y cambiar la
   textura de golpe al cruzar cada umbral.

   Pedido explícito (propuesta del propio Jesús, evaluada y aceptada):
   "contra más lejos se ve la cámara, cambiar sprites por los mismos como
   resolución más baja... una calidad de sprite dinámica" + (segunda
   pasada) "¿hacemos una intermedia? Para que la transición no sea tan
   brusca" — con solo dos niveles TODA la escena pasaba de golpe de nítida
   a notablemente más blanda al cruzar el único umbral. Con un nivel
   intermedio ese salto se reparte en dos saltos más pequeños en dos puntos
   de zoom distintos — eso es lo que de verdad suaviza.

   Historial del MECANISMO del cambio en sí (probado en varias pasadas,
   viéndolo siempre en la demo antes de decidir): primero un fundido
   secuencial (opacity a 0, cambia el src, opacity de vuelta a 1) — se
   descartó porque dejaba un instante real con el sprite invisible del
   todo. Después un cruce de verdad (un "fantasma" con la textura vieja se
   solapaba con la nueva, las dos desvaneciéndose en paralelo) — arreglaba
   lo anterior, pero comparado en la propia demo con la opción sin ningún
   efecto ("mejor el cambio de calidad de sprite dinámica sin fundido...se
   nota menos el salto"), Jesús decidió que el cambio instantáneo es el que
   MENOS se nota de los tres. Así que la versión definitiva es la más
   simple: un solo assignment de imgEl.src, sin fundido ni cruce (ver
   _swap más abajo).

   Tres niveles (0 normal, 1 media, 2 baja) — ver TIER_SUFFIX más abajo
   para la convención de nombre de archivo de cada uno.

   Por qué esto (y no solo el culling de js/entitycull.js): el culling
   ahorra pintar lo que está fuera de cámara, pero lo que SÍ está en
   pantalla sigue pagando el coste de decodificar/subir a la GPU imágenes
   de origen grandes (la mayoría de sprites del proyecto rondan 1200x1200px
   reales) aunque se muestren pequeñas — más entidades caben en pantalla
   cuanto más se aleja la cámara, así que es justo ahí donde más pesa ese
   coste de memoria de textura. Misma idea que el mip-mapping del hardware
   3D, aplicada a mano porque HTML no lo hace solo con <img>.

   El nivel "baja" reutiliza TAL CUAL lowResTileSrc (js/mapgen.js) — misma
   convención de nombre de archivo ("nombre.png" -> "nombre_lowres.png")
   que ya usa el Modo Rendimiento para las losetas, así que una sola
   función sigue decidiendo esa regla en todo el proyecto. El nivel "media"
   añade su propia convención hermana ("_midres") solo aquí, porque ningún
   otro sitio del proyecto la necesita todavía.

   Cómo "se adapta todo sprite que entre" (pedido explícito): cualquier
   mecánica que cree un <img> de sprite en el tablero llama a
   SpriteQuality.register(imgEl, rutaOriginal) en vez de asignar imgEl.src
   a mano directamente — a partir de ahí este archivo decide solo qué
   versión mostrar y cuándo, sin que quien registró el sprite tenga que
   volver a tocarlo. Punto de entrada único: cualquier sprite nuevo que se
   añada en el futuro solo necesita pasar por register() para heredar esto
   gratis. Los que YA tenían assets "_lowres" (losetas, vía PerfMode) NO
   pasan por aquí — siguen su propio mecanismo, atado al checkbox de
   rendimiento, no al zoom.

   Las sombras proyectadas (Shadows.attach) no necesitan registrarse aparte:
   su propio MutationObserver ya vigila el atributo "src" del sprite real y
   copia el cambio solo (ver js/shadows.js), así que heredan el cambio de
   calidad gratis en cuanto el sprite del que dependen cambia. */

const SpriteQuality = {
  // Pedido explícito: "a esta opción la llamaremos resolución adaptativa.
  // Se podrá activar/desactivar desde configuración y estará activada por
  // defecto en el modo alto rendimiento" — interruptor propio (mismo
  // patrón que Shadows/Fog.animEnabled/Hierbajos: localStorage + checkbox
  // en js/settingsmenu.js), pero con un matiz distinto: a diferencia de
  // esos tres (que SON un compromiso visual a cambio de rendimiento, y por
  // eso empiezan en false hasta que el jugador los pida), esta no empeora
  // nada visualmente (el cambio de textura, decidido tras varias pruebas
  // en la demo, es instantáneo — ver _swap más abajo) así que empieza
  // ACTIVADA por defecto para cualquiera, no solo en modo
  // rendimiento — "activada por defecto en el modo alto rendimiento" se
  // resuelve en perfmode.js forzándola a true cada vez que ese modo se
  // enciende, igual que ya fuerza a false a Sombras/Niebla/Vegetación (ver
  // ese archivo).
  _STORAGE_KEY: "gnomoregnomes_spritequality",
  enabled: true,

  init() {
    const saved = localStorage.getItem(this._STORAGE_KEY);
    this.enabled = saved === null ? true : saved === "1";
  },

  setEnabled(enabled) {
    this.enabled = !!enabled;
    localStorage.setItem(this._STORAGE_KEY, this.enabled ? "1" : "0");
    if (!this.enabled) {
      // Desactivarla a mano devuelve TODO a la textura normal de golpe y
      // deja de reaccionar al zoom hasta que se vuelva a activar — ver el
      // "return" temprano de updateForScale más abajo.
      this._aboveMid = true;
      this._aboveLow = true;
      if (this.tier !== 0) {
        this.tier = 0;
        this._sprites.forEach((imgEl) => {
          if (!imgEl.isConnected) {
            this._sprites.delete(imgEl);
            return;
          }
          const orig = imgEl.dataset.srcOrig;
          if (orig) imgEl.src = orig;
        });
      }
    }
    // Al reactivarla no hace falta forzar nada: el próximo updateForScale
    // (cada frame de cámara, desde BoardView._apply) recalcula solo el
    // nivel que toque según el zoom actual.
  },

  // Dos fronteras, cada una con SU PROPIA histéresis (2 umbrales, subir y
  // bajar por separado) — 4 números en total, nunca uno solo, por la misma
  // razón que con dos niveles: sin margen entre subir y bajar, la cámara
  // oscilando justo en un punto de zoom dispararía el cambio una y otra
  // vez seguidas. Rango real de zoom del juego: 0.6 (más alejado) a 1.3
  // (más cercano) — ver BoardView.minScale/maxScale. Frontera normal<->media
  // más alta (cerca del zoom por defecto, 1) que la de media<->baja (cerca
  // del extremo más alejado) para que "media" sea la que más tiempo se ve
  // en un zoom intermedio normal, no un escalón que solo se cruza de paso.
  _MID_DOWN: 0.9, // normal -> media al bajar de aquí
  _MID_UP: 0.98, // media -> normal al subir de aquí
  _LOW_DOWN: 0.7, // media -> baja al bajar de aquí
  _LOW_UP: 0.78, // baja -> media al subir de aquí

  // Convención de nombre de archivo de cada nivel (ver cabecera) — null en
  // el 0 porque "normal" es la ruta original tal cual, sin sufijo.
  _TIER_SUFFIX: [null, "_midres", "_lowres"],

  tier: 0, // 0 normal, 1 media, 2 baja — nivel EFECTIVO ahora mismo
  // Histéresis de cada frontera por separado (ver arriba) — true = "todavía
  // no ha cruzado hacia abajo del todo" / "ya ha vuelto a subir del todo".
  // Independientes entre sí a propósito: así el nivel resultante (más
  // abajo, updateForScale) se recalcula bien pase lo que pase, incluso si
  // el zoom saltara de golpe más de una frontera en un mismo frame.
  _aboveMid: true,
  _aboveLow: true,
  _sprites: new Set(),

  _srcForTier(originalSrc, tier) {
    const suffix = this._TIER_SUFFIX[tier];
    if (!suffix) return originalSrc;
    // Nivel "baja": delega en lowResTileSrc (js/mapgen.js) para no duplicar
    // esa regla en dos sitios — ver cabecera.
    if (tier === 2 && typeof lowResTileSrc === "function") return lowResTileSrc(originalSrc);
    return originalSrc.replace(/(\.[a-zA-Z0-9]+)$/, `${suffix}$1`);
  },

  // Punto de entrada único (ver cabecera) — cualquier mecánica que cree un
  // sprite del tablero llama a esto en vez de asignar .src a mano.
  register(imgEl, originalSrc) {
    if (!imgEl || !originalSrc) return;
    imgEl.dataset.srcOrig = originalSrc;
    imgEl.src = this._srcForTier(originalSrc, this.tier);
    this._sprites.add(imgEl);
  },

  // Se llama desde BoardView._apply en cada frame de cámara — barato (un
  // puñado de comparaciones de número), solo actúa de verdad al cruzar
  // alguna de las cuatro fronteras.
  updateForScale(scale) {
    // Desactivada a mano (ver setEnabled) -- no reacciona al zoom hasta que
    // el jugador (o el modo rendimiento) la vuelva a activar.
    if (!this.enabled) return;
    if (this._aboveMid && scale < this._MID_DOWN) this._aboveMid = false;
    else if (!this._aboveMid && scale > this._MID_UP) this._aboveMid = true;

    if (this._aboveLow && scale < this._LOW_DOWN) this._aboveLow = false;
    else if (!this._aboveLow && scale > this._LOW_UP) this._aboveLow = true;

    const target = this._aboveMid ? 0 : this._aboveLow ? 1 : 2;
    if (target !== this.tier) this._setTier(target);
  },

  _setTier(tier) {
    if (this.tier === tier) return;
    this.tier = tier;
    this._sprites.forEach((imgEl) => {
      // Poda de sprites ya destruidos (un recurso consumido, una unidad
      // muerta...) en vez de llevar aparte un "unregister" que cada
      // mecánica tendría que acordarse de llamar en cada punto de
      // destrucción — más simple y, al ser esto un evento raro (cruzar una
      // frontera de zoom), igual de barato.
      if (!imgEl.isConnected) {
        this._sprites.delete(imgEl);
        return;
      }
      this._swap(imgEl, tier);
    });
  },

  // Cambio de textura instantáneo — pedido explícito (tras probar el cruce
  // en la demo): "mejor el cambio de calidad de sprite dinámica sin
  // fundido...se nota menos el salto en el demo que me has pasado". Se
  // probaron dos versiones con transición (fundido secuencial primero,
  // cruce con solape real después) y, viéndolas una al lado de la otra en
  // la propia demo, el cambio de golpe es el que menos se nota — así que
  // esta es la versión definitiva: sin fantasma, sin fundido, un solo
  // assignment de src.
  _swap(imgEl, tier) {
    const orig = imgEl.dataset.srcOrig;
    if (!orig) return;
    imgEl.src = this._srcForTier(orig, tier);
  },
};

// Lee la preferencia guardada ANTES de que ninguna partida pueda arrancar
// (register()/updateForScale() ya la consultan desde el primer sprite que
// se cree) — mismo patrón que PerfMode.init/Shadows.init.
document.addEventListener("DOMContentLoaded", () => SpriteQuality.init());

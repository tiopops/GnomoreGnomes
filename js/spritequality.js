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

   Dos niveles (0 normal, 1 media) — ver TIER_SUFFIX más abajo para la
   convención de nombre de archivo de cada uno.

   Pedido explícito (pasada posterior, tras ver la demo con los tres
   niveles en marcha): "creo que la resolucion baja es demasiado baja y
   entorpece la experiencia visual, dejamos solo 2 resoluciones? alta para
   cuando estas cerca y media para cuando estas lejos" — se retira el
   nivel "baja" (2) de este mecanismo general por completo: ya solo existe
   una frontera (_MID_DOWN/_MID_UP), no dos. La convención de archivo
   "_lowres" (antes el nivel 2 de aquí) sigue viva igual — la sigue usando
   lowResTileSrc (js/mapgen.js) y, aparte de este mecanismo, la propia
   niebla la usa SIEMPRE ahora (ver _FOG_ALWAYS_LOWRES más abajo).

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
   gratis. Las losetas de terreno (hierba/agua base + overlay de revelado)
   y la niebla también pasan por aquí (ver js/mapgen.js) — antes tenían su
   propio mecanismo aparte, atado solo al checkbox de Modo Rendimiento y
   no al zoom; pedido explícito posterior: "las losetas de terreno,
   todas...hierba, agua...tambien deben verse afectadas por resolucion
   dinamica, la de niebla tambien".

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
      // "return" temprano de updateForScale más abajo. La niebla NO forma
      // parte de este Set (ver register/_FOG_ALWAYS_LOWRES) así que sigue
      // en baja resolución pase lo que pase con este interruptor.
      this._aboveMid = true;
      if (this.tier !== 0) {
        this.tier = 0;
        this._sprites.forEach((imgEl) => {
          if (!imgEl.isConnected) {
            this._sprites.delete(imgEl);
            return;
          }
          const orig = imgEl.dataset.srcOrig;
          if (orig) imgEl.src = this._srcForTier(orig, 0, +imgEl.dataset.sqShift || 0);
        });
      }
    }
    // Al reactivarla no hace falta forzar nada: el próximo updateForScale
    // (cada frame de cámara, desde BoardView._apply) recalcula solo el
    // nivel que toque según el zoom actual.
  },

  // Una única frontera, con SU PROPIA histéresis (2 umbrales, subir y
  // bajar por separado) — sin margen entre subir y bajar, la cámara
  // oscilando justo en un punto de zoom dispararía el cambio una y otra
  // vez seguidas. Rango real de zoom del juego: 0.6 (más alejado) a 1.3
  // (más cercano) — ver BoardView.minScale/maxScale.
  _MID_DOWN: 0.9, // normal -> media al bajar de aquí
  _MID_UP: 0.98, // media -> normal al subir de aquí

  // Convención de nombre de archivo de cada nivel (ver cabecera) — null en
  // el 0 porque "normal" es la ruta original tal cual, sin sufijo.
  _TIER_SUFFIX: [null, "_midres", "_lowres"],

  tier: 0, // 0 normal, 1 media — nivel EFECTIVO ahora mismo
  // true = "todavía no ha cruzado hacia abajo del todo" / "ya ha vuelto a
  // subir del todo".
  _aboveMid: true,
  _sprites: new Set(),

  // Pedido explícito (pasada posterior): "la niebla puedes ponerla siempre
  // en baja resolucion estemos a la distancia que estemos? (quiero probar,
  // puede que me arrepienta asi que dejalo preparado por si quiero volver
  // a como estaba)" — la niebla YA NO sigue el zoom como el resto de
  // sprites (dos niveles arriba): se queda SIEMPRE en "_lowres",
  // independientemente de lo cerca o lejos que esté la cámara. Para volver
  // atrás (niebla siguiendo el zoom como cualquier otro sprite, con solo
  // normal/media) basta con poner esto a false — no hace falta tocar nada
  // más, register()/_swap() ya miran esta bandera antes que el tier normal.
  _FOG_ALWAYS_LOWRES: true,

  _isFogSprite(imgEl) {
    return imgEl.classList.contains("tile__fog");
  },

  // `shift`: las losetas de terreno (1254px de origen, se pintan a ~190-250px)
  // no necesitan nunca su imagen completa: su nivel "normal" ya usa la media
  // y el "lejano" la pequeña. Menos memoria de textura = menos descartes del
  // navegador = menos parpadeos negros al hacer zoom repetidamente.
  _srcForTier(originalSrc, tier, shift) {
    const suffix = this._TIER_SUFFIX[Math.min(tier + (shift || 0), this._TIER_SUFFIX.length - 1)];
    if (!suffix) return originalSrc;
    return originalSrc.replace(/(\.[a-zA-Z0-9]+)$/, `${suffix}$1`);
  },

  // Punto de entrada único (ver cabecera) — cualquier mecánica que cree un
  // sprite del tablero llama a esto en vez de asignar .src a mano.
  register(imgEl, originalSrc, opts) {
    if (!imgEl || !originalSrc) return;
    imgEl.dataset.srcOrig = originalSrc;
    if (opts && opts.shift) imgEl.dataset.sqShift = String(opts.shift);
    if (this._FOG_ALWAYS_LOWRES && this._isFogSprite(imgEl) && typeof lowResTileSrc === "function") {
      // La niebla no entra en el Set de sprites que siguen el zoom (ver
      // _isFogSprite) — se fija una vez aquí y ya no vuelve a cambiar de
      // textura nunca, ni al cruzar fronteras de zoom ni al activar/
      // desactivar Resolución Adaptativa.
      imgEl.src = lowResTileSrc(originalSrc);
      return;
    }
    // Un sprite que nace con la cámara alejada (p.ej. una loseta que vuelve
    // a montarse al desplazarse) NO debe pedir de golpe una versión reducida
    // que aún no se ha cargado: se queda en blanco hasta que llega. Si esa
    // calidad aún no está lista arranca con la original y se mejora (cambia)
    // en cuanto esté cargada y decodificada.
    const wanted = this._srcForTier(originalSrc, this.tier, +imgEl.dataset.sqShift || 0);
    if (this.tier !== 0 && !this._loaded.has(wanted)) {
      imgEl.src = this._srcForTier(originalSrc, 0, +imgEl.dataset.sqShift || 0);
      this._swap(imgEl, this.tier);
    } else {
      imgEl.src = wanted;
    }
    // Si la versión reducida no existe en disco, vuelve a la original en
    // vez de dejar el sprite roto/invisible.
    imgEl.addEventListener("error", () => {
      if (imgEl.dataset.srcOrig && !imgEl.src.endsWith(imgEl.dataset.srcOrig)) imgEl.src = imgEl.dataset.srcOrig;
    });
    this._sprites.add(imgEl);
  },

  // Se llama desde BoardView._apply en cada frame de cámara — barato (un
  // puñado de comparaciones de número), solo actúa de verdad al cruzar la
  // frontera.
  updateForScale(scale) {
    // Desactivada a mano (ver setEnabled) -- no reacciona al zoom hasta que
    // el jugador (o el modo rendimiento) la vuelva a activar.
    if (!this.enabled) return;
    if (this._aboveMid && scale < this._MID_DOWN) this._aboveMid = false;
    else if (!this._aboveMid && scale > this._MID_UP) this._aboveMid = true;

    // Nunca se cambian texturas MIENTRAS la cámara se mueve (eso provocaba
    // el parpadeo de sprites al acercar/alejar): se espera a que el zoom
    // lleve ~350ms quieto y entonces se reparte el cambio en lotes por frame.
    const target = this._aboveMid ? 0 : 1;
    clearTimeout(this._debounce);
    if (target === this.tier) return;
    this._debounce = setTimeout(() => this._setTierBatched(target), 350);
  },

  _setTierBatched(tier) {
    if (this.tier === tier || !this.enabled) return;
    this.tier = tier;
    const list = Array.from(this._sprites);
    const run = () => {
      if (this.tier !== tier) return; // llegó otro cambio: ese lo reemplaza
      const chunk = list.splice(0, 40);
      for (const imgEl of chunk) {
        if (!imgEl.isConnected) { this._sprites.delete(imgEl); continue; }
        this._swap(imgEl, tier);
      }
      if (list.length) requestAnimationFrame(run);
    };
    run();
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
    const url = this._srcForTier(orig, tier, +imgEl.dataset.sqShift || 0);
    // Pedido explícito: "cuando está activo el modo resolución dinámica hay
    // errores gráficos...al alejar y acercar la cámara a veces las losetas y
    // otros elementos desaparecen". Causa: asignar de golpe un src que el
    // navegador aún no ha descargado/decodificado deja el <img> en blanco
    // hasta que termina (y, si esa versión reducida NO existe en disco, se
    // queda en blanco para siempre). Ahora la nueva textura se carga y
    // decodifica APARTE y solo se asigna cuando ya está lista; si falla,
    // el sprite conserva la que tenía.
    if (imgEl.getAttribute("src") === url || imgEl.src.endsWith(url)) return;
    this._ready(url).then((ok) => {
      if (!ok) return; // esa calidad no existe: se queda como está
      // Por si mientras cargaba se cambió otra vez de nivel o de textura.
      if (this.tier !== tier) return;
      if (imgEl.dataset.srcOrig !== orig) return;
      imgEl.src = url;
    });
  },

  // url -> Promise<boolean>: carga + decodifica una vez y recuerda el
  // resultado (las 625 losetas comparten pocas URL, se piden una sola vez).
  _readyCache: new Map(),
  _loaded: new Set(),
  _ready(url) {
    let p = this._readyCache.get(url);
    if (p) return p;
    p = new Promise((resolve) => {
      const im = new Image();
      im.decoding = "async";
      im.onload = () => {
        const done = () => {
          this._loaded.add(url);
          resolve(true);
        };
        if (im.decode) im.decode().then(done, done);
        else done();
      };
      im.onerror = () => resolve(false);
      im.src = url;
    });
    this._readyCache.set(url, p);
    return p;
  },
};

// Lee la preferencia guardada ANTES de que ninguna partida pueda arrancar
// (register()/updateForScale() ya la consultan desde el primer sprite que
// se cree) — mismo patrón que PerfMode.init/Shadows.init.
document.addEventListener("DOMContentLoaded", () => SpriteQuality.init());

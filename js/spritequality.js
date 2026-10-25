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
   lowResTileSrc (js/mapgen.js), que también usa la niebla (js/fogcanvas.js).

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
      // "return" temprano de updateForScale más abajo.
      this._aboveMid = true;
      if (this.tier !== 0) {
        this.tier = 0;
        if (typeof TerrainCanvas !== "undefined") TerrainCanvas.refresh();
        this._sprites.forEach((imgEl) => {
          if (!imgEl.isConnected) {
            this._sprites.delete(imgEl);
            return;
          }
          const orig = imgEl.dataset.srcOrig;
          if (orig) this._nset(imgEl, this._srcForTier(orig, 0, +imgEl.dataset.sqShift || 0));
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

  // `shift`: las losetas de terreno (1254px de origen, se pintan a ~190-250px)
  // no necesitan nunca su imagen completa: su nivel "normal" ya usa la media
  // y el "lejano" la pequeña. Menos memoria de textura = menos descartes del
  // navegador = menos parpadeos negros al hacer zoom repetidamente.
  _srcForTier(originalSrc, tier, shift) {
    const suffix = this._TIER_SUFFIX[Math.min(tier + (shift || 0), this._TIER_SUFFIX.length - 1)];
    if (!suffix) return originalSrc;
    return originalSrc.replace(/(\.[a-zA-Z0-9]+)(\?.*)?$/, `${suffix}$1$2`);
  },

  // Punto de entrada único (ver cabecera) — cualquier mecánica que cree un
  // sprite del tablero llama a esto en vez de asignar .src a mano.
  register(imgEl, originalSrc, opts) {
    if (!imgEl || !originalSrc) return;
    imgEl.dataset.srcOrig = originalSrc;
    if (opts && opts.shift) imgEl.dataset.sqShift = String(opts.shift);
    // Un sprite que nace con la cámara alejada (p.ej. una loseta que vuelve
    // a montarse al desplazarse) NO debe pedir de golpe una versión reducida
    // que aún no se ha cargado: se queda en blanco hasta que llega. Si esa
    // calidad aún no está lista arranca con la original y se mejora (cambia)
    // en cuanto esté cargada y decodificada.
    const wanted = this._srcForTier(originalSrc, this.tier, +imgEl.dataset.sqShift || 0);
    if (this.tier !== 0 && !this._loaded.has(wanted)) {
      this._nset(imgEl, this._srcForTier(originalSrc, 0, +imgEl.dataset.sqShift || 0));
      this._swap(imgEl, this.tier, true);
    } else {
      this._nset(imgEl, wanted);
    }
    // Si la versión reducida no existe en disco, vuelve a la original en
    // vez de dejar el sprite roto/invisible.
    imgEl.addEventListener("error", () => {
      if (imgEl.dataset.srcOrig && !imgEl.src.endsWith(imgEl.dataset.srcOrig)) this._nset(imgEl, imgEl.dataset.srcOrig);
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
    if (target === this.tier) { clearTimeout(this._debounce); this._armed = null; return; }
    // Ya hay un cambio programado hacia ese nivel: NO se reinicia la cuenta en cada fotograma de
    // cámara (el suavizado del zoom dura ~2,5 s y, al reiniciarse el temporizador en cada uno, el
    // cambio no llegaba hasta que la cámara terminaba de asentarse: los sprites seguían en alta
    // resolución varios segundos después de alejar).
    if (this._armed === target) return;
    clearTimeout(this._debounce);
    this._armed = target;
    // Subir a calidad normal (target 0) es lo caro: repinta el suelo y recarga/decodifica
    // texturas grandes. Hacerlo A MITAD de un zoom rápido provocaba un tirón justo en medio del
    // gesto, así que ese cambio espera a que el zoom se asiente (la versión media sigue siendo
    // nítida durante esos instantes). Bajar de calidad es barato y se mantiene inmediato.
    const fire = () => {
      this._debounce = null;
      if (target === 0 && typeof BoardView !== "undefined" && (BoardView._zoomAnchor || Math.abs((BoardView.targetScale || 0) - (BoardView.scale || 0)) > 0.004)) {
        this._debounce = setTimeout(fire, 120); // el zoom sigue en marcha: se vuelve a mirar
        return;
      }
      this._armed = null;
      this._setTierBatched(target);
    };
    this._debounce = setTimeout(fire, target < this.tier ? 90 : 350);
  },

  _setTierBatched(tier) {
    if (this.tier === tier || !this.enabled) return;
    this.tier = tier;
    if (typeof TerrainCanvas !== "undefined") TerrainCanvas.refresh(); // el suelo ya no son <img>: se repinta con la nueva calidad
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
    if (typeof TerrainCanvas !== "undefined") TerrainCanvas.refresh();
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
  _swap(imgEl, tier, noFade) {
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
      this._pin(imgEl);
      if (noFade || imgEl.dataset.sqNoFade || !this._canFade(imgEl)) { this._nset(imgEl, url); return; }
      this._fadeTo(imgEl, url);
    });
  },

  // Mantiene la proporción EXACTA del sprite al cambiar de textura: la versión
  // reducida tiene el tamaño redondeado (p.ej. 243x300 -> 121x150), y con
  // height:auto esa diferencia de proporción movía la altura del sprite una
  // fracción de píxel al cambiar = el pequeño salto. Se fija una vez, desde la
  // textura original ya cargada.
  _pin(imgEl) {
    if (imgEl.style.aspectRatio || !imgEl.naturalWidth || !imgEl.naturalHeight) return;
    if (/_(midres|lowres)\.[a-z0-9]+/i.test(imgEl.currentSrc || imgEl.src)) return;
    imgEl.style.aspectRatio = imgEl.naturalWidth + " / " + imgEl.naturalHeight;
    imgEl.dataset.sqPin = "1";
  },

  // ---------- Fundido cruzado ----------
  // Pedido explícito (segunda decisión de Jesús, tras ver el cambio seco en
  // móvil/APK): "al alejar y acercar la cámara los sprites cambian de golpe,
  // si hacemos un fade cruzado para que no se pierda la imagen ni haya
  // parpadeos...". Coste real: SOLO los sprites que están en pantalla en ese
  // instante (los de fuera de cámara cambian de golpe, no se ven) llevan un
  // "fantasma" con la textura vieja encima durante ~240ms; la nueva ya está
  // decodificada antes de asignarse, y debajo siempre hay un sprite opaco, así
  // que nunca hay un fotograma vacío ni una bajada de opacidad en medio. Tope
  // de fantasmas simultáneos para que un cambio de nivel con mil sprites a la
  // vista no sume capas de más; los que sobren cambian de golpe.
  crossfade: true,
  FADE_MS: 140,
  MAX_GHOSTS: 70,
  _ghosts: 0,

  _canFade(imgEl) {
    if (!this.crossfade || this._ghosts >= this.MAX_GHOSTS) return false;
    if (typeof PerfMode !== "undefined" && PerfMode.enabled) return false;
    if (!imgEl.isConnected || !imgEl.parentElement || !imgEl.animate) return false;
    const r = imgEl.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    return r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
  },

  _fadeTo(imgEl, url) {
    const ghost = imgEl.cloneNode(false);
    ghost.removeAttribute("id");
    ghost.removeAttribute("data-src-orig");
    ghost.setAttribute("aria-hidden", "true");
    ghost.classList.add("sq-ghost");
    // Solución al "bum": el fantasma NO lleva la sombra difusa (drop-shadow) del sprite. Con ella,
    // durante el fundido se apilaban dos sombras (la del sprite nuevo y la del viejo) y aparecía
    // un halo oscuro alrededor que desaparecía de golpe al terminar. Así la sombra es siempre una
    // sola, la del sprite real, y no parpadea.
    // PERO sí conserva el resto del filtro del sprite real (brillo/saturación, p.ej. los
    // bumpers apagados van a brightness(.8) saturate(.5)): con "none" el fantasma nacía a todo
    // color y brillo y se fundía hacia el sprite apagado = un destello al cambiar de calidad.
    let gf = "none";
    try {
      const f = getComputedStyle(imgEl).filter;
      if (f && f !== "none") gf = f.replace(/drop-shadow\((?:[^()]|\([^()]*\))*\)/g, "").replace(/\s+/g, " ").trim() || "none";
    } catch (e) {}
    ghost.style.filter = gf;
    ghost.style.transition = "none";
    ghost.decoding = "sync";
    // Geometría EXACTA (sin redondeos): offsetLeft/Top/Width/Height son enteros y
    // el sprite real suele tener decimales (zoom, rem, %): el fantasma quedaba
    // medio píxel desplazado/más bajito y, al cambiar, se veía un pequeño salto
    // ("bum"). Aquí el fantasma conserva su posición estática de flujo (sin
    // left/top) y copia el ancho/alto calculados con decimales.
    const cs = getComputedStyle(imgEl);
    const st = ghost.style;
    st.position = "absolute";
    st.left = "auto";
    st.top = "auto";
    st.right = "auto";
    st.bottom = "auto";
    st.width = cs.width;
    st.height = cs.height;
    st.pointerEvents = "none";
    st.zIndex = "1";
    this._ghosts++;
    const drop = () => { this._ghosts = Math.max(0, this._ghosts - 1); ghost.remove(); };
    const go = () => {
      if (!imgEl.isConnected) return drop();
      // Animaciones de reposo (respiración, balanceo...): el fantasma nace con
      // ellas reiniciadas y el sprite real no; sin igualarlas, el fantasma se
      // veía en otra pose y el cambio "saltaba". Se copia el instante exacto de
      // cada animación del sprite real a la del fantasma.
      let real = [];
      try { real = imgEl.getAnimations ? imgEl.getAnimations() : []; } catch (e) {}
      // El fantasma va JUSTO ANTES del sprite real: al ser absoluto y sin left/top,
      // hereda la posición de flujo que tendría el sprite (fracciones incluidas), y
      // con z-index sube por encima de él. Así tampoco se mete entre el sprite y su
      // sombra proyectada (Shadows.attach), que debe seguir siendo su hermana
      // inmediata para que el CSS que la sincroniza con el salto funcione.
      imgEl.parentElement.insertBefore(ghost, imgEl);
      try {
        ghost.getAnimations().forEach((ga) => {
          const ra = real.find((x) => x.animationName && x.animationName === ga.animationName);
          if (!ra) return;
          // Mismo instante de inicio en la misma línea de tiempo = exactamente la misma fase.
          if (ra.startTime != null) ga.startTime = ra.startTime;
          else { ga.pause(); ga.currentTime = ra.currentTime; }
        });
      } catch (e) {}
      // Comprobación: si el fantasma no cae EXACTAMENTE sobre el sprite (contenedor
      // con otra alineación, transformaciones raras...), no se hace fundido: cambio
      // directo, mejor eso que un fantasma desplazado.
      try {
        const ra = imgEl.getBoundingClientRect(), rg = ghost.getBoundingClientRect();
        if (Math.abs(ra.left - rg.left) > 0.2 || Math.abs(ra.top - rg.top) > 0.2 || Math.abs(ra.width - rg.width) > 0.2 || Math.abs(ra.height - rg.height) > 0.2) {
          this._nset(imgEl, url);
          return drop();
        }
      } catch (e) {}
      this._nset(imgEl, url); // debajo del fantasma
      // El fantasma se queda OPACO hasta que el sprite real tenga SU textura decodificada y lista
      // para pintar (img.decode() de ESE elemento): la precarga aparte no basta, el navegador puede
      // haber descartado el bitmap decodificado y el <img> real se pintaba en blanco unos
      // fotogramas mientras el fantasma ya se desvanecía = el sprite "parpadeaba" (bumpers).
      let started = false;
      const start = () => {
        if (started) return;
        started = true;
        if (!ghost.isConnected) return drop();
        const a = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: this.FADE_MS, easing: "ease-out" });
        a.onfinish = drop;
        a.oncancel = drop;
      };
      if (imgEl.decode) {
        imgEl.decode().then(start, start);
        setTimeout(start, 900); // tope: nunca dejar un fantasma colgado
      } else start();
    };
    if (ghost.decode) ghost.decode().then(go, () => { this._nset(imgEl, url); drop(); });
    else go();
  },

  // Carga y decodifica de antemano la versión de `tier` de todos los sprites
  // registrados (la usa la pantalla de carga): al cruzar el umbral de zoom el
  // cambio encuentra las texturas ya listas y no hay que esperar a nada.
  preloadTier(tier) {
    const urls = new Set();
    this._sprites.forEach((im) => {
      const o = im.dataset && im.dataset.srcOrig;
      if (o) urls.add(this._srcForTier(o, tier, +im.dataset.sqShift || 0));
    });
    return Promise.all(Array.from(urls).map((u) => this._ready(u)));
  },

  // Asignación REAL de src (sin pasar por el gancho de abajo).
  _nset(imgEl, v) {
    _SQ_NATIVE_SRC.set.call(imgEl, v);
  },

  // Gancho para asignaciones sueltas: cualquier sitio del juego que haga
  // `sprite.src = "assets/..."` (cambiar de pose, de fase, de estado) sobre un
  // sprite ya registrado pasa por aquí y recibe la calidad que toque en vez
  // de la textura grande tal cual — así los sprites que cambian de imagen
  // (golpes, impactos, huevo, grulla...) no se saltan la resolución adaptativa.
  _onSet(imgEl, v) {
    const ds = imgEl.dataset;
    if (!ds || ds.srcOrig === undefined || typeof v !== "string" || v.indexOf("assets/") < 0 || /_(midres|lowres)\.[a-z0-9]+(\?.*)?$/i.test(v)) {
      return this._nset(imgEl, v);
    }
    // Otra imagen original (cambio de pose): la proporción fijada era de la anterior.
    if (ds.srcOrig !== v && ds.sqPin) { imgEl.style.aspectRatio = ""; delete ds.sqPin; }
    ds.srcOrig = v;
    const tier = this.enabled ? this.tier : 0;
    const shift = +ds.sqShift || 0;
    const wanted = this._srcForTier(v, tier, shift);
    if (tier !== 0 && !this._loaded.has(wanted)) {
      this._nset(imgEl, this._srcForTier(v, 0, shift));
      this._swap(imgEl, tier, true);
    } else {
      this._nset(imgEl, wanted);
    }
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

// Gancho sobre HTMLImageElement.src (ver SpriteQuality._onSet): se instala una
// sola vez al cargar el script, antes de que exista ningún sprite.
const _SQ_NATIVE_SRC = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
if (_SQ_NATIVE_SRC && _SQ_NATIVE_SRC.set && !HTMLImageElement.prototype.__sqHooked) {
  Object.defineProperty(HTMLImageElement.prototype, "src", {
    configurable: true,
    enumerable: _SQ_NATIVE_SRC.enumerable,
    get() { return _SQ_NATIVE_SRC.get.call(this); },
    set(v) { SpriteQuality._onSet(this, v); },
  });
  HTMLImageElement.prototype.__sqHooked = true;
}

// Lee la preferencia guardada ANTES de que ninguna partida pueda arrancar
// (register()/updateForScale() ya la consultan desde el primer sprite que
// se cree) — mismo patrón que PerfMode.init/Shadows.init.
document.addEventListener("DOMContentLoaded", () => SpriteQuality.init());

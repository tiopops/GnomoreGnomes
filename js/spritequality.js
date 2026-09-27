/* Gnomore Gnomes — calidad de sprite dinámica según el zoom de cámara.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe: llevar la
   cuenta de qué sprites del tablero (unidades, recursos, hierbajos,
   arbustos, tótems, Obeliscos, tienda, gnomo...) hay que servir en su
   versión reducida cuando la cámara está lo bastante alejada, y hacerlo
   con un fundido en vez de un cambio de golpe.

   Pedido explícito (propuesta del propio Jesús, evaluada y aceptada):
   "contra más lejos se ve la cámara, cambiar sprites por los mismos como
   resolución más baja... una calidad de sprite dinámica" + "si se cambia
   la calidad mediante un Fade en lugar de un pop para evitar efectos raros
   y esto no supone un cambio brusco de rendimiento, mejor así. Actualiza
   las fuentes para que todos los sprites que entren se adapten a eso" +
   (segunda pasada) "¿hacemos una intermedia? Para que la transición no sea
   tan brusca" — con solo dos niveles TODA la escena pasaba de golpe de
   nítida a notablemente más blanda al cruzar el único umbral. Con un nivel
   intermedio ese salto se reparte en dos saltos más pequeños en dos puntos
   de zoom distintos — eso es lo que de verdad suaviza.

   (tercera pasada, tras ver el resultado en la demo) "al cambiar de una
   calidad a otra...el objeto desaparece...deben solaparse en la transición
   para dar efecto de continuidad" — el cambio de textura YA no ocurre con
   el sprite en opacity:0 secuencial (eso SÍ dejaba un instante real sin
   nada pintado); ahora es un cruce de verdad entre la textura vieja y la
   nueva, las dos superpuestas y desvaneciéndose en paralelo — ver
   _crossfadeSwap más abajo para el porqué.

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
   copia el cambio solo (ver js/shadows.js), así que heredan el fundido de
   calidad gratis en cuanto el sprite del que dependen cambia. */

const SpriteQuality = {
  // Pedido explícito: "a esta opción la llamaremos resolución adaptativa.
  // Se podrá activar/desactivar desde configuración y estará activada por
  // defecto en el modo alto rendimiento" — interruptor propio (mismo
  // patrón que Shadows/Fog.animEnabled/Hierbajos: localStorage + checkbox
  // en js/settingsmenu.js), pero con un matiz distinto: a diferencia de
  // esos tres (que SON un compromiso visual a cambio de rendimiento, y por
  // eso empiezan en false hasta que el jugador los pida), esta no empeora
  // nada visualmente pedido (fundido/cruce ya cuidado aparte) así que
  // empieza ACTIVADA por defecto para cualquiera, no solo en modo
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
      // Desactivarla a mano devuelve TODO a la textura normal de golpe (sin
      // fundido/cruce: es una elección del jugador, no un cruce de zoom de
      // verdad) y deja de reaccionar al zoom hasta que se vuelva a activar
      // — ver el "return" temprano de updateForScale más abajo.
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
  // Duración del fundido de opacidad en cada sentido (ida + vuelta con el
  // cambio de src en medio, mientras está invisible del todo) — pedido
  // explícito: "un Fade en lugar de un pop". 180ms es lo bastante rápido
  // para no sentirse lento, y lo bastante lento para que el ojo nunca vea
  // el "salto" de nitidez, solo una transición suave de opacidad.
  _FADE_MS: 180,

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
    imgEl.classList.add("gg-adaptive-sprite");
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
      this._crossfadeSwap(imgEl, tier);
    });
  },

  // Cruce de verdad entre la textura vieja y la nueva — pedido explícito
  // tras ver el resultado del fundido secuencial anterior: "deben
  // solaparse en la transición para dar efecto de continuidad", porque con
  // opacity a 0 a mitad de camino el sprite "desaparecía" un instante.
  //
  // Idea: un "fantasma" — clon superficial del <img> real, con la textura
  // VIEJA que ya estaba pintada (cloneNode copia el src actual antes de
  // tocar nada, así que el fantasma nace ya decodificado, sin tirón) — se
  // superpone EXACTAMENTE encima del sprite real y empieza a desvanecerse
  // (1 -> 0) mientras, en paralelo, el sprite real YA tiene puesta la
  // textura nueva y se desvanece hacia dentro (0 -> 1). Las dos mitades
  // corren a la vez, no una detrás de otra, así que en cualquier instante
  // intermedio hay algo pintado (la mezcla de las dos), nunca opacidad 0
  // en ambas.
  //
  // Posicionamiento del fantasma: mismo criterio que Shadows._syncShape
  // (js/shadows.js) — offsetWidth/offsetLeft/offsetTop LOCALES, nunca
  // getBoundingClientRect, para no aplicar dos veces el zoom de la cámara
  // del tablero. Se coloca en píxeles exactos dentro del padre inmediato
  // del sprite en vez de con un "100%/0/0" en porcentaje, así funciona
  // igual sea cual sea el tamaño real de ese padre (para unidades/gnomo el
  // sprite vive un nivel más adentro, en .unit__flip, que no tiene por qué
  // medir lo mismo que la imagen).
  _crossfadeSwap(imgEl, tier) {
    const orig = imgEl.dataset.srcOrig;
    if (!orig) return;
    const newSrc = this._srcForTier(orig, tier);
    const parent = imgEl.parentElement;
    if (!parent) {
      imgEl.src = newSrc; // sin padre no hay dónde anclar un fantasma; mejor un pop que romper
      return;
    }

    // El fantasma necesita un ancestro posicionado del que colgar (position
    // absolute). La mayoría de sprites del tablero (recursos, hierbajos,
    // arbustos, tótems, tienda, Obeliscos) cuelgan directos de su .unit,
    // que YA es position:absolute — no hace falta tocar nada. Solo
    // unidades/gnomo, cuyo sprite vive dentro de .unit__flip (sin position
    // propia), necesitan que se la demos aquí, UNA sola vez y de forma
    // idempotente; .unit__flip no tiene más contenido que el propio sprite
    // (el icono de "a punto de morir" y el de "escondido en arbusto" viven
    // fuera, colgados directamente de .unit — ver units.js), así que esto
    // no reubica ningún otro elemento que dependiera de que fuera estático.
    if (getComputedStyle(parent).position === "static") {
      parent.style.position = "relative";
    }

    // Clon superficial (sin hijos que copiar, es un <img>) ANTES de tocar
    // imgEl.src — así el fantasma hereda tal cual la textura vieja que ya
    // estaba en pantalla.
    const ghost = imgEl.cloneNode(false);
    ghost.removeAttribute("id");
    ghost.classList.add("gg-sprite-quality-ghost");
    ghost.style.top = `${imgEl.offsetTop}px`;
    ghost.style.left = `${imgEl.offsetLeft}px`;
    ghost.style.width = `${imgEl.offsetWidth}px`;
    ghost.style.height = `${imgEl.offsetHeight}px`;
    ghost.style.opacity = "1";
    parent.insertBefore(ghost, imgEl.nextSibling);
    // Fuerza reflow del fantasma recién insertado ANTES de que nada le
    // toque la opacidad otra vez — si no, el navegador nunca llega a
    // "renderizar" su opacity:1 inicial como punto de partida real (se crea
    // y se le cambia la opacidad en el mismo turno de script, sin pintar
    // nada entre medias), y la transición no tendría de dónde partir: en
    // vez de animar salta directa al valor final. Mismo truco que ya usa
    // unit.js para poder relanzar animaciones repitiendo clase+reflow.
    void ghost.offsetWidth;

    // El sprite real cambia YA a la textura nueva, pero arranca invisible
    // (el fantasma, encima, sigue mostrando la vieja) — el salto a
    // opacity:0 se hace SIN transición (clase de arriba + forzar reflow),
    // si no la propia regla de fundido animaría también este primer salto
    // y el cruce no arrancaría limpio desde 0.
    imgEl.src = newSrc;
    imgEl.classList.add("gg-sprite-quality-no-transition");
    imgEl.style.opacity = "0";
    void imgEl.offsetWidth; // fuerza reflow, mismo truco que unit.js usa para relanzar animaciones
    imgEl.classList.remove("gg-sprite-quality-no-transition");

    // Un frame después (ya con el salto a 0 aplicado de verdad, no en
    // cola): arrancan las dos mitades del cruce A LA VEZ.
    requestAnimationFrame(() => {
      if (!imgEl.isConnected) {
        ghost.remove();
        return;
      }
      imgEl.style.opacity = "1";
      ghost.style.opacity = "0";
    });

    window.setTimeout(() => {
      ghost.remove();
      if (imgEl.isConnected) imgEl.style.opacity = "";
    }, this._FADE_MS + 40);
  },
};

// Lee la preferencia guardada ANTES de que ninguna partida pueda arrancar
// (register()/updateForScale() ya la consultan desde el primer sprite que
// se cree) — mismo patrón que PerfMode.init/Shadows.init.
document.addEventListener("DOMContentLoaded", () => SpriteQuality.init());

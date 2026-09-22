/* Gnomore Gnomes — sombras proyectadas de los sprites.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Crear la sombra de un sprite dado (Shadows.attach), como un <img>
       clon aplanado/inclinado del propio sprite, vivo detrás de él.
     - Activar/desactivar el sistema entero (Shadows.setEnabled),
       persistiendo la preferencia en localStorage — ver el checkbox
       correspondiente en js/settingsmenu.js.

   Pedido explícito: "crees que podriamos implementar un sistema de
   sombras proyectando los propios sprites de manera diagonal hacia
   arriba a la derecha?" — mockup aprobado en varias iteraciones ("no tan
   alargada ni tan ladeada", "la parte de abajo puede estar un poco
   difusa...que vaya de transparente a opaco", "se queda anclada y se
   hace mas pequeña gradualmente mientras sube el personaje y vuelve a su
   tamaño mientras baja") y confirmado con "vale, implementalas y haz que
   se puedan activar/desactivar con un checkbox del estilo que estamos
   haciendo".

   Cómo funciona la sombra en sí (ver .gg-cast-shadow en style.css):
   un <img> con el MISMO src que el sprite real (nunca se descarga nada
   nuevo, el navegador reutiliza el bitmap ya decodificado), aplanado e
   inclinado con transform (scaleY + skewX + translate, acelerado por
   GPU), ennegrecido con filter:brightness(0) (sin blur — pedido
   explícito "que consuma muy pocos recursos", blur es el filtro más caro
   de repintar) y con un degradado de transparencia vía mask-image (más
   barato que difuminar píxeles de verdad).

   El efecto de "salto" (la sombra se encoge/atenúa mientras el
   personaje sube y vuelve a su tamaño mientras baja, sin trasladarse
   nunca hacia arriba) es 100% CSS vía selector de hermano adyacente
   (".unit__sprite--hop + .gg-cast-shadow", ver style.css) — se
   sincroniza solo con cualquier mecánica que ya use esa clase
   (units.js/gnome.js/combat.js) sin tocar ni una línea de esos archivos. */

const Shadows = {
  _STORAGE_KEY: "gnomoregnomes_shadows",
  enabled: true,

  init() {
    const saved = localStorage.getItem(this._STORAGE_KEY);
    this.enabled = saved === null ? true : saved === "1";
    this._applyGlobalToggle();
  },

  setEnabled(enabled) {
    this.enabled = !!enabled;
    localStorage.setItem(this._STORAGE_KEY, this.enabled ? "1" : "0");
    this._applyGlobalToggle();
  },

  _applyGlobalToggle() {
    // Nunca se dejan de crear (attach sigue añadiendo el <img> siempre,
    // ver más abajo) — mucho más barato alternar UNA clase en <body> que
    // recorrer el tablero entero creando/destruyendo elementos cada vez
    // que se toca el checkbox.
    document.body.classList.toggle("gg-shadows-off", !this.enabled);
  },

  // Llamar justo después de insertar un spriteEl real (unit__sprite,
  // village__sprite, shop__sprite, gnome__sprite...) en su contenedor.
  // Crea su sombra como hermano SIGUIENTE inmediato (necesario para el
  // selector CSS de sincronización del salto, ver arriba) y la mantiene
  // sincronizada en src/ancho si el sprite cambia más adelante (gnomo
  // gritando, volando, tipo de unidad con escala propia...) con un
  // MutationObserver — barato: solo reacciona a cambios reales, nunca
  // sondea nada por su cuenta.
  attach(spriteEl) {
    if (!spriteEl || !spriteEl.parentElement) return null;

    const shadowEl = document.createElement("img");
    shadowEl.className = "gg-cast-shadow";
    shadowEl.src = spriteEl.src;
    shadowEl.alt = "";
    shadowEl.draggable = false;

    spriteEl.parentElement.insertBefore(shadowEl, spriteEl.nextSibling);

    // BUG encontrado: en varios sitios (js/shops.js sobre todo) Shadows.attach
    // se llama ANTES de que el propio contenedor (el "el" de turno) se
    // añada al DOM del tablero — con el sprite todavía desconectado del
    // documento, getComputedStyle(spriteEl).width no puede resolver un
    // valor en píxeles de verdad (layout no calculado), así que leer el
    // ancho aquí mismo, síncrono, se quedaba en "" y la sombra perdía su
    // tamaño. Un requestAnimationFrame difiere la lectura a después de que
    // quien llamó termine de insertar todo en el DOM en esta misma tarea
    // (siempre ocurre en el mismo lugar, síncrono, justo después). El
    // listener "load" cubre además el caso de que la imagen (incluso ya en
    // caché) no haya terminado de decodificar sus dimensiones naturales
    // todavía en ese primer frame.
    const sync = () => this._syncShape(shadowEl, spriteEl);
    requestAnimationFrame(sync);
    if (!spriteEl.complete) spriteEl.addEventListener("load", sync, { once: true });

    const observer = new MutationObserver(() => {
      if (shadowEl.src !== spriteEl.src) shadowEl.src = spriteEl.src;
      sync();
    });
    observer.observe(spriteEl, { attributes: true, attributeFilter: ["src", "style"] });

    return shadowEl;
  },

  // BUG encontrado al probar con los tótems (muy altos y estrechos,
  // 246x408 — ver assets/iconos/poblado_neutral.png): con un scaleY fijo,
  // el desplazamiento del skewX es proporcional a la ALTURA renderizada
  // del sprite, así que un tótem alto proyectaba una sombra desmedida
  // (varias losetas de largo) frente a la de un personaje o la tienda
  // (bajos y anchos). Se calcula un scaleY propio por sprite que apunta a
  // una altura "aplastada" objetivo (_TARGET_SQUASHED_HEIGHT) — nunca por
  // ENCIMA de _BASE_SCALE_Y (para no alargar sombras ya cortas, solo
  // acortar las desproporcionadas) — así la sombra se ve proporcionada
  // sea cual sea la forma real del sprite. Se aplica vía la custom
  // property --gg-shadow-scale-y que usa el transform en style.css.
  _TARGET_SQUASHED_HEIGHT: 80,
  _BASE_SCALE_Y: 0.68,

  // Ancho (copiado del sprite real, tal cual esté en ese momento) + el
  // scaleY proporcionado (ver nota más arriba) — las dos cosas dependen de
  // poder leer ya un ancho en píxeles de verdad, así que viven juntas en
  // una sola función en vez de dos sincronizaciones separadas que podrían
  // desincronizarse entre sí.
  _syncShape(shadowEl, spriteEl) {
    // offsetWidth, NO getBoundingClientRect — este último da el tamaño ya
    // en pantalla, DESPUÉS del zoom de la cámara del tablero (BoardView,
    // un transform:scale en un ancestro común a sprite y sombra); usar ese
    // valor como ancho en CSS aquí volvería a multiplicarlo por ese mismo
    // zoom una segunda vez. offsetWidth es el ancho ya en las unidades
    // "locales" de siempre (las de la hoja de estilos), igual que
    // spriteEl.style.width — exactamente lo que necesita la sombra, viva
    // en el mismo sistema de coordenadas que el sprite.
    const widthPx = parseFloat(spriteEl.style.width) || spriteEl.offsetWidth;
    if (!widthPx) return;
    shadowEl.style.width = `${widthPx}px`;

    const naturalW = spriteEl.naturalWidth;
    const naturalH = spriteEl.naturalHeight;
    if (!naturalW || !naturalH) return;
    const renderedHeight = (widthPx / naturalW) * naturalH;
    const scaleY = Math.min(this._BASE_SCALE_Y, this._TARGET_SQUASHED_HEIGHT / renderedHeight);
    shadowEl.style.setProperty("--gg-shadow-scale-y", scaleY.toFixed(3));
  },
};

document.addEventListener("DOMContentLoaded", () => Shadows.init());

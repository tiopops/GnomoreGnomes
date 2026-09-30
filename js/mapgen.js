/* Gnomore Gnomes — generación y render del escenario (perspectiva isométrica, estilo Polytopia).
   Regla de oro: un archivo por mecánica — este solo genera y pinta el tablero de losetas.
   Regla de oro: escalabilidad — TILE_TYPES está pensado para poder añadir nuevos tipos de
   terreno y variantes visuales dentro de un mismo tipo sin tocar el resto del motor: basta con
   añadir más rutas de imagen al array "variants" del tipo que corresponda.
   Regla de oro: nivel Triple A — las losetas usan el arte isométrico real del proyecto
   (assets/losetas/) en vez de placeholders generados, con un orden de dibujado (z-index)
   estable en función de su posición para que no "salten" visualmente al hacer hover. */

// scale/offsetX/offsetY (por tipo, ver también debug/calibrar-losetas.html):
// pedido explícito — "quiero que me deje ajustar todas las losetas al mismo
// tiempo para que pueda hacerlas coincidir... lo que quiero es poder
// ajustarlas entre ellas". El encaje de la CUADRÍCULA en sí sigue siendo
// SIEMPRE el mismo para todos los tipos (TILE_WIDTH/TILE_TOP_HEIGHT, más
// abajo — eso es lo que mantiene alineadas las filas/columnas); estos 3
// valores solo retocan la imagen DENTRO de su propia casilla — escala
// (1 = tamaño normal) y desplazamiento en píxeles desde la esquina de la
// casilla — para poder corregir a mano pequeños desajustes del propio arte
// (recortes con distinto margen, etc.) sin tocar el resto del motor. Los
// tres a 0/0/1 por defecto (sin efecto) hasta que se calibren con la
// herramienta de debug.
const TILE_DEFAULT_ADJUST = { scale: 1, offsetX: 0, offsetY: 0 };

const TILE_TYPES = {
  grass: {
    // Varias variantes por tipo = variedad visual sin duplicar lógica (regla de oro de escalabilidad).
    // De momento solo hay una loseta de hierba; Jesús irá añadiendo más aquí.
    variants: ["assets/losetas/hierba_01.png"],
  },
  // Pedido explícito: "añadimos loseta de agua deben formar lagos y rodear
  // la parte exterior del escenario... los jugadores no pueden pasar de
  // momento por ahi, salvo que alguna raza si pueda nadar o se use un
  // barco, eso lo decidire mas tarde". walkable:false es lo único que hace
  // falta declarar aquí para que TODO el motor (Movement.reachableTiles,
  // Units.spawnRandomEnemy, Gnome...) la trate como intransitable sin tener
  // que tocar cada mecánica por separado — ver TerrainMap.isWalkable más
  // abajo, que es lo único que consultan.
  //
  // nativeWidth/nativeHeight: por si algún día agua_03.png deja de
  // compartir la proporción exacta de hierba_01.png — de momento SÍ la
  // comparte (mismo recorte 1024x854, arte de sustitución provisional
  // pedido explícito: "vamos a sustituir las losetas hasta que las
  // mejore por estas"), pero se declaran igualmente para que este tipo
  // siga funcionando sin tocar nada el día que su arte definitivo tenga
  // otra proporción — renderMap las usa para escalar manteniendo SU
  // relación de aspecto real en vez de estirarla/aplastarla con la de
  // hierba.
  water: {
    // Pedido explícito: solo estas dos (lisa y con nenúfares), 50/50.
    variants: ["assets/losetas/agua_03.png", "assets/losetas/agua_02.png"],
    walkable: false,
    // Calibrado con debug/calibrar-losetas.html: escala 1, desplazamiento 1/3 px.
    offsetX: 1,
    offsetY: 3,
    nativeWidth: 1024,
    nativeHeight: 854,
    // Sin offsetX/offsetY/scale propios: al compartir exactamente el mismo
    // recorte que hierba_01.png ya encaja igual que ella por defecto — la
    // calibración anterior (offsetY:8) era para el arte de agua VIEJO y ya
    // no aplica a este. Si el arte definitivo lo necesita, se recalibra de
    // nuevo con debug/calibrar-losetas.html y se añade aquí.
  },
};

// Pedido explícito: "podrías crear una versión de niebla y las losetas de
// muy baja resolución que se cambia por las originales cuando modo alto
// rendimiento está activado? Todas las losetas que te adjunte a partir de
// ahora deberán tener esta versión low res" — convención de nombres: la
// versión ligera de "assets/losetas/nombre.png" vive en
// "assets/losetas/nombre_lowres.png" (mismo nombre + "_lowres" antes de la
// extensión). Con esta única función centralizada, añadir una loseta nueva
// en el futuro solo necesita el archivo normal + su pareja "_lowres" — no
// hace falta tocar ni esta función ni renderMap.
function lowResTileSrc(originalSrc) {
  return originalSrc.replace(/(\.[a-zA-Z0-9]+)$/, "_lowres$1");
}

// RETIRADO (pedido explícito, pasada posterior): "las losetas de terreno,
// todas...hierba, agua...tambien deben verse afectadas por resolucion
// dinamica, la de niebla tambien" — hasta ahora hierba/agua/niebla usaban
// este mecanismo PROPIO, ligado 1:1 al checkbox de Modo Rendimiento
// (on/off, sin relación con el zoom real de la cámara), mientras que TODO
// lo demás del tablero (unidades, recursos, hierbajos, arbustos, tótems,
// Obeliscos, tienda...) ya usaba SpriteQuality (js/spritequality.js, 3
// niveles según el zoom). Registrar también hierba/agua/niebla en
// SpriteQuality (ver renderMap más abajo) dejó este mecanismo separado sin
// ningún uso: un mismo <img> no puede obedecer a dos sistemas de golpe a
// la vez sin pisarse el "src" el uno al otro. lowResTileSrc (justo
// arriba) SIGUE viva — SpriteQuality._srcForTier la reutiliza tal cual
// para su propio nivel "baja", así que la convención de nombre de archivo
// no cambia en absoluto, solo quién decide CUÁNDO usarla.

// Consulta del terreno real por casilla — lo usa cualquier mecánica que
// necesite saber "¿se puede pisar/pasar por aquí?" (Movement, Combat,
// Gnome, spawns...) sin tener que conocer TILE_TYPES ni cómo se generó el
// mapa. Vive aquí (no en Fog ni en Units) porque el terreno es dato de
// ESTE archivo — misma idea que Fog solo sabe de niebla y Units solo de
// personajes (regla de oro: un archivo por mecánica).
const TerrainMap = {
  size: 0,
  grid: null, // grid[row][col] = "grass" | "water" (tipo REAL, no el visual bajo niebla)
  _revealEls: null, // Map "row,col" -> <img class="tile__terrain-reveal"> de esa loseta (si no es hierba)
  _tileEls: null, // Map "row,col" -> <div class="tile"> de esa loseta (ver updateCulling más abajo)
  // Última "ventana" (rango de filas/columnas) que se dejó SIN cull, o null
  // si todavía no se ha calculado ninguna (ver updateCulling). Se usa para
  // solo tener que tocar las losetas que CAMBIAN de estado entre un frame y
  // el siguiente, nunca las 289+ del mapa entero.
  _cullRange: null,

  // Se llama tras generar/pintar cada mapa nuevo (startMatch/resumeMatch en
  // newgame-flow.js), DESPUÉS de renderMap — igual que Fog.init, necesita
  // que las losetas ya existan en el DOM para cachear sus overlays.
  init(map) {
    this.size = map.size;
    this.grid = Array.from({ length: map.size }, () => new Array(map.size).fill("grass"));
    map.tiles.forEach((t) => {
      this.grid[t.row][t.col] = t.type;
    });
    this._revealEls = new Map();
    document.querySelectorAll(".tile__terrain-reveal").forEach((el) => {
      this._revealEls.set(`${el.dataset.row},${el.dataset.col}`, el);
    });
    this._tileEls = new Map();
    document.querySelectorAll(".tile").forEach((el) => {
      this._tileEls.set(`${el.dataset.row},${el.dataset.col}`, el);
    });
    // null: la primera llamada a updateCulling todavía no tiene "ventana
    // anterior" con la que comparar — ver ahí mismo cómo se trata ese caso.
    this._cullRange = null;
  },

  typeAt(row, col) {
    if (!this.grid || row < 0 || col < 0 || row >= this.size || col >= this.size) return "grass";
    return this.grid[row][col];
  },

  isWalkable(row, col) {
    const info = TILE_TYPES[this.typeAt(row, col)];
    return !info || info.walkable !== false;
  },

  // Pedido explícito: "la loseta de agua sustituye a las de hierba, pero
  // inicialmente bajo la niebla todas son de hierba hasta que se revelan" —
  // renderMap pinta SIEMPRE hierba de base (ver más abajo) y deja ya
  // preparado, oculto (opacity 0), un segundo <img> con la textura REAL de
  // cada loseta que no sea hierba; esto lo hace aparecer con un fundido —
  // js/fog.js llama a esto en el mismo momento en que empieza a disipar la
  // niebla de esa loseta (Fog._reveal), para que el cambio de textura quede
  // disimulado detrás de la propia nube en vez de dar un salto brusco.
  // Pedido explícito (bug reportado): "debajo de las casillas de agua hay
  // casillas de hierba? no deberia ser asi" — cierto: la hierba de base de
  // CADA loseta (ver renderMap, se pinta siempre, agua incluida, para la
  // ilusión de niebla de arriba) se queda montada en el DOM para siempre
  // por debajo, aunque ya no sirva de nada una vez revelada la textura
  // real. display:none aquí, justo al revelar (la nube de niebla sigue
  // tapando la loseta durante toda su transición de 1.2s, así que ocultar
  // la hierba de golpe en vez de esperar a que acabe el fundido de 0.9s de
  // .tile__terrain-reveal no se nota) — deja de existir una loseta de
  // hierba de verdad bajo el agua ya descubierta.
  revealTile(row, col) {
    if (!this._revealEls) return;
    const el = this._revealEls.get(`${row},${col}`);
    if (!el) return; // loseta de hierba de verdad: no tiene overlay, nada que ocultar debajo
    el.classList.add("tile__terrain-reveal--visible");
    const tileEl = this._tileEls && this._tileEls.get(`${row},${col}`);
    if (tileEl) {
      const baseImg = tileEl.querySelector("img:not(.tile__terrain-reveal)");
      if (baseImg) baseImg.style.display = "none";
    }
  },

  // Pedido explícito: "el color de las losetas del terreno que esten
  // dentro de niebla de guerra tambien debe desaturarse como el resto de
  // elementos" — hasta ahora solo tótems/Obeliscos/tiendas/recursos se
  // atenuaban al dejar de estar bajo percepción EN DIRECTO (gg-remembered,
  // ver Fog.applyVisibility); el propio SUELO revelado se quedaba siempre
  // a color completo, sin distinguir "lo veo ahora mismo" de "lo recuerdo
  // de antes". .gg-remembered (css/style.css) es genérica — filter+
  // transition sobre CUALQUIER elemento, no depende de la clase .unit — así
  // que basta con colgarla también del .tile entero (afecta a las dos
  // capas de imagen de dentro, hierba base + textura real, como una sola
  // unidad compuesta). Lo llama Fog.applyVisibility, nunca por su cuenta:
  // este archivo solo sabe de terreno, no de percepción (regla de oro).
  setRemembered(row, col, remembered) {
    if (!this._tileEls) return;
    const el = this._tileEls.get(`${row},${col}`);
    if (el) el.classList.toggle("gg-remembered", remembered);
  },

  // ---------- Virtualización del tablero (culling de losetas) ----------
  // Pedido explícito: "si alejo mucho la camara aparecen errores graficos,
  // como que le cuesta renderizar las losetas...tengo idea de hacer los
  // escenarios mucho mas grandes y detallados, asi que esto va a suponer
  // un problema grave...como lo arreglamos?" — investigado a fondo: cada
  // loseta del mapa entero se crea UNA vez en renderMap y se queda montada
  // en el DOM para siempre, se vea o no en pantalla (289 losetas en un
  // tablero de 17x17 ya son ~1000 <img>, niebla incluida). Al alejar la
  // cámara el navegador tiene que pintar/componer de golpe muchas más de
  // esas imágenes a la vez, y ahí aparecen los glitches — el modo alto
  // rendimiento lo disimula porque usa texturas mucho más ligeras, no
  // porque cambie cuántos elementos hay. Si el escenario crece mucho más,
  // el problema empeora aunque no se aleje la cámara.
  //
  // Solución (elegida junto con Jesús: "virtualizar el tablero"): dejar de
  // pintar lo que no se ve. Mismo mecanismo YA probado en este proyecto
  // para la niebla (Fog.updateCulling/clearCulling, js/fog.js: oculta con
  // display:none, ni siquiera se pinta, cualquier loseta fuera del
  // viewport + margen), extendido aquí a la loseta de terreno en sí (el
  // grueso de las imágenes, no solo la nube) — ocultar el .tile entero
  // (con display:none) esconde de un plumazo tanto su imagen base como su
  // overlay de revelado (ambos hijos), sin tocar ni un pixel de la lógica
  // de juego (todo lo demás sigue trabajando en coordenadas fila/columna,
  // nunca en si el elemento está o no montado/visible).
  //
  // A diferencia de Fog.updateCulling (que SÍ recorre las 289+ losetas
  // enteras en cada frame de cámara — asumible solo porque está atado a
  // cuándo la animación de niebla compensa el coste, ver esa función), este
  // culling tiene que escalar con "escenarios mucho mas grandes": recorrer
  // el mapa ENTERO en cada frame durante un pan/zoom dejaría de compensar
  // igual que le pasaría a la niebla sin esa salvedad. En su lugar,
  // getVisibleTileRange (más abajo) calcula por matemática directa (sin
  // recorrer nada) el rectángulo de filas/columnas que cae dentro del
  // viewport + margen, y updateCulling solo toca las losetas que CAMBIAN
  // de estado entre la ventana anterior (_cullRange) y la nueva — el
  // trabajo por frame queda acotado por cuántas losetas caben en pantalla
  // (siempre más o menos constante), nunca por el tamaño total del mapa.
  updateCulling(panX, panY, scale, viewportW, viewportH) {
    if (!this._tileEls) return;
    const range = getVisibleTileRange(panX, panY, scale, viewportW, viewportH, this.size);
    const prev = this._cullRange;
    // null solo en la primerísima llamada tras TerrainMap.init (todavía no
    // hay "ventana anterior" con la que comparar) — se trata como "todo el
    // mapa estaba fuera", una única pasada completa (igual de barata que el
    // propio renderMap, que ya recorre el mapa entero una vez al cargar) en
    // vez de asumir sin comprobar que ya estaba todo bien oculto.
    const prevRange = prev || { minRow: 0, maxRow: this.size - 1, minCol: 0, maxCol: this.size - 1 };
    const insideNew = (r, c) => r >= range.minRow && r <= range.maxRow && c >= range.minCol && c <= range.maxCol;
    const insidePrev = (r, c) => r >= prevRange.minRow && r <= prevRange.maxRow && c >= prevRange.minCol && c <= prevRange.maxCol;
    // Oculta lo que estaba dentro de la ventana anterior y ha dejado de
    // estar en la nueva.
    for (let r = prevRange.minRow; r <= prevRange.maxRow; r++) {
      for (let c = prevRange.minCol; c <= prevRange.maxCol; c++) {
        if (insideNew(r, c)) continue;
        const el = this._tileEls.get(`${r},${c}`);
        if (el) el.classList.add("tile--culled");
      }
    }
    // Muestra lo que entra nuevo en la ventana actual.
    for (let r = range.minRow; r <= range.maxRow; r++) {
      for (let c = range.minCol; c <= range.maxCol; c++) {
        if (prev && insidePrev(r, c)) continue;
        const el = this._tileEls.get(`${r},${c}`);
        if (el) el.classList.remove("tile--culled");
      }
    }
    this._cullRange = range;
  },

  // Vuelve a mostrar el mapa entero (p.ej. al desactivar por completo el
  // culling, o como limpieza defensiva) — mismo patrón que Fog.clearCulling.
  clearCulling() {
    if (!this._tileEls) return;
    this._tileEls.forEach((el) => el.classList.remove("tile--culled"));
    this._cullRange = { minRow: 0, maxRow: this.size - 1, minCol: 0, maxCol: this.size - 1 };
  },
};

// Rango de filas/columnas (inclusive, ya acotado a los límites del mapa)
// que cae dentro del viewport de pantalla + un margen de seguridad, en
// coordenadas de loseta — usado por TerrainMap.updateCulling (arriba) para
// decidir qué losetas ocultar sin tener que recorrer el mapa entero.
// Convierte las 4 ESQUINAS del viewport a espacio de "contenido" (el mismo
// que usa getTileFromPoint, antes de pan/zoom) y de ahí a fila/columna con
// esa misma función; el rectángulo fila/columna que las contiene a las 4
// SIEMPRE cubre de sobra el rombo isométrico realmente visible (nunca al
// revés, un rectángulo en pantalla mapea a un rombo en el espacio de
// fila/columna, nunca a un rectángulo más pequeño) — más barato que
// recorrer losetas y sin riesgo de dejar ninguna visible fuera del cálculo.
// MARGIN_TILES de seguridad extra (mismo espíritu que el x3 de
// Fog.updateCulling: cubrir incluso un arrastre/zoom brusco que mueva la
// cámara de golpe en un solo frame sin dejar un hueco visible un instante).
const TILE_CULL_MARGIN = 3;
function getVisibleTileRange(panX, panY, scale, viewportW, viewportH, size) {
  const corners = [
    { x: 0, y: 0 },
    { x: viewportW, y: 0 },
    { x: 0, y: viewportH },
    { x: viewportW, y: viewportH },
  ];
  let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
  corners.forEach(({ x, y }) => {
    const contentX = (x - panX) / scale;
    const contentY = (y - panY) / scale;
    const { row, col } = getTileFromPoint(contentX, contentY, size);
    if (row < minRow) minRow = row;
    if (row > maxRow) maxRow = row;
    if (col < minCol) minCol = col;
    if (col > maxCol) maxCol = col;
  });
  return {
    minRow: Math.max(0, minRow - TILE_CULL_MARGIN),
    maxRow: Math.min(size - 1, maxRow + TILE_CULL_MARGIN),
    minCol: Math.max(0, minCol - TILE_CULL_MARGIN),
    maxCol: Math.min(size - 1, maxCol + TILE_CULL_MARGIN),
  };
}

// Niebla de guerra (js/fog.js): NO es un TILE_TYPES más (no sustituye a la
// loseta real, que sigue existiendo debajo tal cual la genera generateMap) —
// es una nube que se pinta ENCIMA de cada loseta, más ancha que ella
// (FOG_OVERHANG) para que el borde entre lo revelado y lo que no se ha
// explorado todavía se lea como una nube continua en vez de un corte recto
// tile a tile. renderMap crea SIEMPRE esta capa para las 3 losetas — visible
// por defecto — y js/fog.js decide después, tras generar el mapa, para
// cuáles ocultarla (revelado inicial) y cuándo ir ocultando el resto (al
// moverse, ver Fog.revealForUnit). Así este archivo sigue sin saber nada de
// "qué está revelado", solo pinta la pieza visual que la otra mecánica
// necesita — mismo patrón que unit__hpbar en Units.spawnUnit (units.js).
//
// niebla_01.png es SOLO la nube (sin ninguna loseta dibujada dentro, a
// diferencia de una versión anterior) — precisamente para poder centrarla
// con las MISMAS coordenadas exactas que usa cualquier otra cosa sobre el
// tablero (getTileCenter, igual que unidades/marcadores) en vez de intentar
// adivinar dónde "encajaba" un dibujo de loseta ya incluido en la imagen
// (eso fue lo que causaba el desalineado que Jesús reportó). Por eso NO
// vive dentro de .tile (que se posiciona por su ESQUINA, getTileTopLeft) —
// se pinta como elemento propio, hermano de .tile, anclado por su CENTRO
// justo en getTileCenter(row,col) con transform: translate(-50%,-50%) —
// mismo patrón que un marcador (Units.addMarker) o el ancla de pies de una
// unidad, solo que centrada en vez de "de pie".
// Pedido explícito: "quiero sustituirlo por este [niebla_01.png nuevo],
// pero guarda una copia del otro por si me arrepiento" — la nube anterior
// queda guardada tal cual en assets/losetas/niebla_01_original.png, sin
// usarse en ningún sitio del código (si algún día Jesús quiere volver a
// ella, basta con copiarla de vuelta encima de niebla_01.png). El nuevo
// PNG conserva la misma proporción (700×600 = 1295×1110, mismo ratio
// ancho/alto) así que el resto de la fórmula de FOG_OVERHANG no cambia,
// solo estas dos medidas nativas.
const FOG_SRC = "assets/losetas/niebla_01.png";
const FOG_NATIVE_WIDTH = 700;
const FOG_NATIVE_HEIGHT = 600;
const FOG_OVERHANG = 1.7; // veces TILE_WIDTH — cuánto sobresale la nube de su loseta.

// Dimensiones nativas del archivo de imagen hierba_01.png (no cambian).
const TILE_NATIVE_WIDTH = 1024;
const TILE_NATIVE_HEIGHT = 854;

// Valores de encaje calibrados a mano por Jesús con debug/calibrar-losetas.html:
// TILE_WIDTH = ancho al que se renderiza cada loseta (también fija el espaciado
// horizontal); TILE_TOP_HEIGHT = separación vertical entre filas. La imagen se
// escala manteniendo su proporción real a partir de TILE_WIDTH.
// TILE_OVERLAP/TILE_FEATHER son los mismos ajustes "anti-costura" de la
// herramienta de calibración (agrandar un poco cada loseta desde su centro y/o
// difuminar su borde); de momento a 0 porque el encaje quedó perfecto sin ellos,
// pero se dejan aquí listos por si una futura loseta los necesita.
const TILE_WIDTH = 188;
const TILE_TOP_HEIGHT = 117;
const TILE_OVERLAP = 0; // % — 0 = desactivado
const TILE_FEATHER = 0; // px — 0 = desactivado
const TILE_RENDER_HEIGHT = Math.round((TILE_WIDTH * TILE_NATIVE_HEIGHT) / TILE_NATIVE_WIDTH);

// Posición en pantalla (esquina superior-izquierda) de una loseta según su
// fila/columna. Centralizado aquí para que cualquier otro archivo (unidades,
// gnomos, efectos...) que necesite saber "dónde cae" una loseta en pantalla
// use exactamente el mismo cálculo que el propio tablero, sin duplicar la
// fórmula ni arriesgarse a que se desincronicen (regla de oro de escalabilidad).
function getTileTopLeft(row, col, size) {
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_TOP_HEIGHT / 2;
  const centerX = (size - 1) * halfW;
  const x = (col - row) * halfW + centerX;
  const y = (col + row) * halfH;
  return { x, y };
}

// Centro de la cara superior de la loseta (donde "pisa" una unidad de pie sobre ella).
function getTileCenter(row, col, size) {
  const { x, y } = getTileTopLeft(row, col, size);
  return { x: x + TILE_WIDTH / 2, y: y + TILE_TOP_HEIGHT / 2 };
}

// Inversa de getTileCenter: dado un punto en el mismo espacio de coordenadas
// del tablero (el de "contenido" ANTES del pan/zoom de la cámara, ver
// BoardView.clientToContent en boardview.js), devuelve la loseta (row/col)
// más cercana a ese punto — lo usa cualquier mecánica que necesite saber "a
// qué loseta corresponde este clic" sin duplicar la fórmula (regla de oro de
// escalabilidad), p.ej. la habilidad Visión Lejana (js/abilities.js), que
// necesita saber dónde ha hecho clic el jugador en CUALQUIER punto del mapa,
// esté o no cubierto por otra unidad/tótem/tienda encima de la loseta.
// Misma fórmula que getTileFromPoint pero SIN redondear a entero ni recortar
// al tablero — devuelve la fila/columna "real" (con decimales, y pudiendo
// caer fuera de [0, size-1]) del punto dado. getTileFromPoint la usa para un
// clic concreto (donde SIEMPRE tiene sentido devolver la loseta válida más
// cercana), pero BoardView._clampPanForDiamond (boardview.js) necesita el
// valor sin recortar: para saber CUÁNTO se ha pasado la cámara del borde
// real del rombo, no solo que se ha pasado (ver la nota larga de ese método
// sobre el hueco negro en las esquinas al no estar maximizada la ventana).
function getTileFromPointRaw(x, y, size) {
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_TOP_HEIGHT / 2;
  // Mismo centerX que getTileTopLeft, más el propio medio-ancho/alto que
  // getTileCenter le suma encima — invertido aquí de una vez.
  const centerX = (size - 1) * halfW + halfW;
  const u = x - centerX;
  const v = y - halfH;
  return {
    row: (v / halfH - u / halfW) / 2,
    col: (u / halfW + v / halfH) / 2,
  };
}

function getTileFromPoint(x, y, size) {
  const { row, col } = getTileFromPointRaw(x, y, size);
  return {
    row: Math.min(size - 1, Math.max(0, Math.round(row))),
    col: Math.min(size - 1, Math.max(0, Math.round(col))),
  };
}

function pickVariant(typeInfo, row, col) {
  const variants = typeInfo.variants;
  if (variants.length === 1) return variants[0];
  // Selección determinista (misma partida = mismo mapa) en vez de aleatoria pura.
  // Hash entero simple (no lineal en fila/columna) para que no salgan
  // diagonales o tablero de ajedrez cuando hay varias variantes.
  let h = (row * 73856093) ^ (col * 19349663);
  h = (h ^ (h >>> 13)) * 1274126177;
  const idx = ((h ^ (h >>> 16)) >>> 0) % variants.length;
  return variants[idx];
}

// Hace crecer un lago orgánico desde (startRow, startCol): en cada paso
// elige un vecino libre al azar de entre los ya colocados (no siempre el
// mismo, de ahí el "frontier" e ir retirando celdas de vez en cuando) hasta
// alcanzar targetCount casillas o quedarse sin vecinos válidos — así el
// contorno sale irregular, como una orilla de verdad, en vez de un círculo
// o un cuadrado perfectos. `forbidden(row, col)` excluye del crecimiento las
// casillas demasiado cerca del borde (que ya es agua por su cuenta, ver
// generateMap) o de la zona segura donde spawnea el jugador.
function growLake(grid, size, startRow, startCol, targetCount, forbidden) {
  grid[startRow][startCol] = "water";
  const frontier = [{ row: startRow, col: startCol }];
  let placed = 1;
  const dirs = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [-1, 1], [1, -1], [1, 1],
  ];
  while (placed < targetCount && frontier.length > 0) {
    const idx = Math.floor(Math.random() * frontier.length);
    const cell = frontier[idx];
    const candidates = dirs
      .map(([dr, dc]) => ({ row: cell.row + dr, col: cell.col + dc }))
      .filter(({ row, col }) => row >= 0 && col >= 0 && row < size && col < size)
      .filter(({ row, col }) => grid[row][col] !== "water")
      .filter(({ row, col }) => !forbidden(row, col));
    if (candidates.length === 0) {
      frontier.splice(idx, 1);
      continue;
    }
    const next = candidates[Math.floor(Math.random() * candidates.length)];
    grid[next.row][next.col] = "water";
    frontier.push(next);
    placed++;
    // Retira la celda de partida de vez en cuando aunque aún tenga huecos
    // libres, para que el lago no crezca siempre pegado al mismo punto y
    // salga una mancha más repartida en vez de un solo brazo.
    if (Math.random() < 0.35) frontier.splice(idx, 1);
  }
}

// Pedido explícito: "el escenario contra un jugador debe ser de 25x25
// losetas. pueden haber rios que crucen el escenario, pero...deben haber
// zonas por las que poder cruzarlo sin loseta de agua, al menos 2 si hay
// un rio" — a diferencia de un lago (growLake, mancha orgánica sin
// dirección fija), un río nace en un borde del mapa y cruza HASTA el
// borde opuesto (arriba-abajo o izquierda-derecha, al azar) con una
// trayectoria serpenteante (deriva aleatoria de -1/0/+1 por fila o columna
// en cada paso, según toque) en vez de una línea recta de un tablero de
// ajedrez. 2 o 3 puntos a lo largo de su recorrido, bien repartidos (nunca
// los dos pegados ni los dos en la misma punta: uno por tercio/cuarto del
// trayecto), se quedan SIN pintar de agua — un vado por el que cruzar a
// pie — y cualquier casilla dentro de la zona segura de spawn (ver
// SAFE_RADIUS en generateMap) tampoco se pinta nunca de agua, aunque esa
// no cuenta como uno de los vados "oficiales" por si el río ni siquiera
// llega a pasar por esa zona.
function generateRiver(grid, size, inSafeZone) {
  const horizontal = Math.random() < 0.5;
  const path = [];
  if (horizontal) {
    let col = 3 + Math.floor(Math.random() * Math.max(1, size - 6));
    for (let row = 0; row < size; row++) {
      path.push({ row, col });
      col += Math.floor(Math.random() * 3) - 1;
      col = Math.max(1, Math.min(size - 2, col));
    }
  } else {
    let row = 3 + Math.floor(Math.random() * Math.max(1, size - 6));
    for (let col = 0; col < size; col++) {
      path.push({ row, col });
      row += Math.floor(Math.random() * 3) - 1;
      row = Math.max(1, Math.min(size - 2, row));
    }
  }

  const crossingCount = 2 + (Math.random() < 0.5 ? 0 : 1); // 2 o 3 vados
  const segment = Math.floor(path.length / crossingCount);
  const crossingIdx = new Set();
  for (let i = 0; i < crossingCount; i++) {
    const start = i * segment + Math.floor(segment * 0.25);
    const end = i * segment + Math.floor(segment * 0.75);
    const idx = start + Math.floor(Math.random() * Math.max(1, end - start));
    crossingIdx.add(Math.min(path.length - 1, Math.max(0, idx)));
  }

  path.forEach((p, i) => {
    if (crossingIdx.has(i)) return; // vado: se deja como tierra a propósito
    if (inSafeZone(p.row, p.col)) return; // zona segura de spawn: nunca agua
    grid[p.row][p.col] = "water";
    // Ancho variable (a veces también la loseta de al lado) para que la
    // orilla no se lea como una línea perfecta de 1 loseta — nunca en un
    // vado ni en la zona segura, por la misma razón de arriba.
    if (Math.random() < 0.45) {
      const extra = horizontal ? { row: p.row, col: p.col + 1 } : { row: p.row + 1, col: p.col };
      if (
        extra.row >= 0 &&
        extra.col >= 0 &&
        extra.row < size &&
        extra.col < size &&
        !inSafeZone(extra.row, extra.col)
      ) {
        grid[extra.row][extra.col] = "water";
      }
    }
  });
}

function generateMap(size, options) {
  const opts = options || {};
  const grid = Array.from({ length: size }, () => new Array(size).fill("grass"));
  const mid = Math.floor(size / 2);
  // Radio (Chebyshev) alrededor de CADA esquina donde NUNCA se genera agua
  // — pedido explícito: "ningun jugador debe aparecer en el centro del
  // mapa, siempre en las esquinas del mismo", así que Obelisks.spawn
  // (js/obelisks.js) ya no arranca cerca de mid/mid, sino cerca de una de
  // las 4 esquinas (CORNER_INSET/CORNER_SAFE_RADIUS aquí deben coincidir
  // con esos mismos valores en obelisks.js). Como el mapa se genera ANTES
  // de saber qué par de esquinas opuestas tocará esta partida, se protegen
  // las 4 por igual.
  const CORNER_INSET = Math.min(3, Math.max(1, Math.floor(size / 8)));
  const SAFE_RADIUS = 4;
  const corners = [
    { row: CORNER_INSET, col: CORNER_INSET },
    { row: CORNER_INSET, col: size - 1 - CORNER_INSET },
    { row: size - 1 - CORNER_INSET, col: CORNER_INSET },
    { row: size - 1 - CORNER_INSET, col: size - 1 - CORNER_INSET },
  ];
  const inSafeZone = (row, col) =>
    corners.some((c) => Math.max(Math.abs(row - c.row), Math.abs(col - c.col)) <= SAFE_RADIUS);
  const edgeDist = (row, col) => Math.min(row, col, size - 1 - row, size - 1 - col);

  // --- Borde exterior (pedido explícito: "rodear la parte exterior del
  // escenario") --- La orilla más externa es SIEMPRE agua; la segunda capa
  // hacia dentro lo es solo la mitad de las veces, para que el borde no se
  // lea como un marco geométrico perfecto sino como una costa irregular.
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const d = edgeDist(row, col);
      if (d === 0) grid[row][col] = "water";
      else if (d === 1 && Math.random() < 0.5) grid[row][col] = "water";
    }
  }

  // --- Lagos interiores ("a veces se acumulan formando lagos") --- Cantidad
  // proporcional al tamaño del mapa para que un tablero más grande (más
  // rivales) tenga más variedad de terreno, no siempre el mismo puñado fijo.
  const lakeCount = Math.max(1, Math.round(size / 9));
  for (let i = 0; i < lakeCount; i++) {
    let seed = null;
    for (let attempt = 0; attempt < 50 && !seed; attempt++) {
      const row = 2 + Math.floor(Math.random() * (size - 4));
      const col = 2 + Math.floor(Math.random() * (size - 4));
      if (edgeDist(row, col) < 3) continue; // lejos del borde, que ya es agua por su cuenta
      if (inSafeZone(row, col)) continue;
      if (grid[row][col] === "water") continue;
      seed = { row, col };
    }
    if (!seed) continue;
    const targetCount = 4 + Math.floor(Math.random() * 6);
    growLake(grid, size, seed.row, seed.col, targetCount, (row, col) => edgeDist(row, col) < 2 || inSafeZone(row, col));
  }

  // --- Río (pedido explícito, solo en el modo 1v1 por ahora, ver
  // newgame-flow.js) --- Va DESPUÉS de los lagos para que el trazado del
  // río gane siempre si por casualidad se cruzan (un río debe leerse como
  // una línea continua de orilla a orilla; un lago tapado a medias por
  // encima no se notaría).
  if (opts.rivers) generateRiver(grid, size, inSafeZone);

  const tiles = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const type = grid[row][col];
      const typeInfo = TILE_TYPES[type];
      tiles.push({ row, col, type, src: pickVariant(typeInfo, row, col) });
    }
  }
  return { size, tiles };
}

function renderMap(map, container) {
  container.innerHTML = "";

  const boardWidth = map.size * TILE_WIDTH;
  const boardHeight = map.size * TILE_TOP_HEIGHT + (TILE_RENDER_HEIGHT - TILE_TOP_HEIGHT);
  container.style.width = `${boardWidth}px`;
  container.style.height = `${boardHeight}px`;

  const fragment = document.createDocumentFragment();

  map.tiles.forEach((t) => {
    const el = document.createElement("div");
    el.className = "tile";

    // Base SIEMPRE hierba (pedido explícito: "la loseta de agua sustituye a
    // las de hierba, pero inicialmente bajo la niebla todas son de hierba
    // hasta que se revelan") — sea cual sea el tipo REAL de esta loseta
    // (t.type, ya decidido por generateMap y usado para la lógica de juego
    // vía TerrainMap), lo que se pinta de entrada es siempre la textura de
    // hierba; el tipo real solo aparece con el overlay de abajo, al
    // revelarse.
    const baseSrc = t.type === "grass" ? t.src : pickVariant(TILE_TYPES.grass, t.row, t.col);
    // Ajuste fino propio de la hierba (ver TILE_DEFAULT_ADJUST más arriba) —
    // se aplica aquí SIEMPRE, tanto si esta loseta es realmente hierba como
    // si de momento solo está ENSEÑANDO hierba a la espera de revelarse
    // (agua bajo niebla): lo que se ve es hierba, así que lleva el ajuste
    // de hierba.
    const grassAdjust = {
      scale: TILE_TYPES.grass.scale != null ? TILE_TYPES.grass.scale : TILE_DEFAULT_ADJUST.scale,
      offsetX: TILE_TYPES.grass.offsetX != null ? TILE_TYPES.grass.offsetX : TILE_DEFAULT_ADJUST.offsetX,
      offsetY: TILE_TYPES.grass.offsetY != null ? TILE_TYPES.grass.offsetY : TILE_DEFAULT_ADJUST.offsetY,
    };
    const img = document.createElement("img");
    img.decoding = "async"; // pedido de rendimiento: no bloquear el hilo principal decodificando
    if (typeof SpriteQuality !== "undefined") {
      SpriteQuality.register(img, baseSrc);
    } else {
      img.dataset.srcOrig = baseSrc;
      img.src = baseSrc;
    }
    img.width = TILE_WIDTH * grassAdjust.scale;
    img.height = TILE_RENDER_HEIGHT * grassAdjust.scale;
    img.style.left = `${grassAdjust.offsetX}px`;
    img.style.top = `${grassAdjust.offsetY}px`;
    img.draggable = false;
    img.alt = "";
    if (TILE_OVERLAP > 0) {
      el.style.transform = `scale(${1 + TILE_OVERLAP / 100})`;
      el.style.transformOrigin = "center center";
    }
    if (TILE_FEATHER > 0) {
      img.style.filter = `blur(${TILE_FEATHER}px)`;
    }
    el.appendChild(img);

    // Overlay con la textura REAL, oculto (opacity 0, ver
    // .tile__terrain-reveal en style.css) hasta que TerrainMap.revealTile
    // lo active — lo llama js/fog.js en el mismo instante en que esa loseta
    // empieza a disiparse, para que el cambio de hierba a agua quede
    // disimulado detrás de la propia niebla en vez de dar un salto brusco.
    // Solo se crea para losetas que NO sean hierba (para no duplicar de
    // más el DOM en un tablero grande sin necesidad — una de hierba ya
    // enseña su textura real desde el principio, no le hace falta overlay).
    if (t.type !== "grass") {
      const typeInfo = TILE_TYPES[t.type];
      const nativeW = typeInfo.nativeWidth || TILE_NATIVE_WIDTH;
      const nativeH = typeInfo.nativeHeight || TILE_NATIVE_HEIGHT;
      const adjust = {
        scale: typeInfo.scale != null ? typeInfo.scale : TILE_DEFAULT_ADJUST.scale,
        offsetX: typeInfo.offsetX != null ? typeInfo.offsetX : TILE_DEFAULT_ADJUST.offsetX,
        offsetY: typeInfo.offsetY != null ? typeInfo.offsetY : TILE_DEFAULT_ADJUST.offsetY,
      };
      const renderWidth = TILE_WIDTH * adjust.scale;
      const revealImg = document.createElement("img");
      revealImg.decoding = "async"; // pedido de rendimiento: no bloquear el hilo principal decodificando
      revealImg.className = "tile__terrain-reveal";
      if (typeof SpriteQuality !== "undefined") {
        SpriteQuality.register(revealImg, t.src);
      } else {
        revealImg.dataset.srcOrig = t.src;
        revealImg.src = t.src;
      }
      revealImg.width = renderWidth;
      revealImg.height = Math.round((renderWidth * nativeH) / nativeW);
      revealImg.style.left = `${adjust.offsetX}px`;
      revealImg.style.top = `${adjust.offsetY}px`;
      revealImg.draggable = false;
      revealImg.alt = "";
      revealImg.dataset.row = String(t.row);
      revealImg.dataset.col = String(t.col);
      el.appendChild(revealImg);
    }

    const { x, y } = getTileTopLeft(t.row, t.col, map.size);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.dataset.row = String(t.row);
    el.dataset.col = String(t.col);

    // Orden de dibujado estable: las losetas "más cercanas" a la cámara
    // (mayor fila+columna) siempre se pintan encima de las que tienen detrás,
    // sin depender del orden en el que se insertaron en el DOM.
    el.style.zIndex = String(t.row + t.col);

    fragment.appendChild(el);

    // Capa de niebla (ver comentario de FOG_SRC arriba) — visible por
    // defecto en TODAS las losetas; js/fog.js la oculta loseta a loseta
    // según se va revelando el mapa. Elemento HERMANO de .tile (no hijo:
    // ver el comentario de FOG_SRC de por qué se centra con sus propias
    // coordenadas en vez de heredar la caja de la loseta), con
    // data-row/data-col propios para que Fog.init la encuentre igual que
    // encontraría la de .tile.
    //
    // BUG encontrado y corregido: "el z-index de la niebla no funciona
    // correctamente, debería estar detrás de mi personaje" — antes CADA
    // nube usaba un z-index fijo y enorme (100000, en style.css) para
    // garantizar que quedara por encima de cualquier unidad de pie en SU
    // PROPIA loseta sin revelar. Pero FOG_OVERHANG hace que cada nube
    // sobresalga sobre losetas VECINAS ya reveladas — y ese valor fijo
    // ignoraba el orden normal (mayor fila+columna = más cerca de cámara),
    // así que una nube de una loseta que está DETRÁS del jugador en la
    // cuadrícula se seguía dibujando por delante de su propio personaje en
    // cuanto el solapamiento la hacía asomar sobre esa casilla. Ahora usa
    // el mismo patrón (fila+columna)*10 que unidades/marcadores (ver
    // Units.addMarker/_placeInstant) — +6 porque una unidad de pie en ESTA
    // MISMA loseta usa +5 (así la nube sigue tapándola mientras no se haya
    // revelado), pero sin sobrepasar el rango de la SIGUIENTE loseta
    // (arranca en +10), que es lo que ahora deja que el orden normal de
    // dibujado decida correctamente si una nube vecina queda delante o
    // detrás del jugador, según toque.
    const fogImg = document.createElement("img");
    fogImg.decoding = "async"; // pedido de rendimiento: no bloquear el hilo principal decodificando
    // Pedido explícito: "la animacion de la niebla consume una cantidad de
    // recursos ingente...optimiza esa caracteristica para que apenas
    // consuma recursos" — causa real: CADA nube de niebla en reposo
    // (fog-idle-drift, ver style.css) pide su propia capa de composición
    // GPU (will-change:transform), y con un tablero grande (hasta 25x25 =
    // 625 losetas, ver BOARD_SIZE_BY_OPPONENTS en js/matchsetup.js) puede
    // haber más de un centenar visibles a la vez incluso con el recorte de
    // fuera-de-pantalla (Fog.updateCulling) ya aplicado — ese es justo el
    // patrón que ya causó "errores gráficos" en móvil antes (ver la nota
    // larga de rendimiento móvil un poco más abajo en style.css), ahora
    // agravado por tableros más grandes. La animación en sí (un derivado
    // sutil, ver @keyframes) no es cara por fotograma; el coste real es
    // "cuántas capas GPU separadas hay que mantener a la vez". En vez de
    // animar TODAS las nubes en reposo, solo una fracción lleva la clase
    // tile__fog--idle con la animación real; la otra se queda completamente
    // estática (misma nube, mismo aspecto, cero coste de capa).
    // Pedido explícito (pasada posterior): "si animar niebla fuese una
    // animacion un poquito mas exagerada y afectase a menos losetas...en
    // vez de un 50, un 30%, ganariamos rendimiento?" — bajado de la mitad
    // (1 de cada 2) a 3 de cada 10 losetas, un 40% menos de capas GPU
    // simultáneas como techo respecto a la versión anterior. Para
    // compensar que se ve una nube animada menos a menudo al pasear la
    // vista por el mapa, el propio movimiento de cada una que SÍ anima se
    // sube un poco (ver @keyframes fog-idle-drift en style.css) — mismo
    // criterio de "lo mas fiel posible" al aspecto de campo de niebla vivo
    // que la vez anterior, con menos nubes pero cada una algo más notoria.
    // Patrón determinista (fila/columna, no al azar) para que ese 30% siga
    // repartido de forma pareja por todo el mapa, no en manchas —
    // coeficientes 7/3 en vez de simplemente row%10<3 (eso dejaría columnas
    // enteras iguales, un patrón de rayas verticales muy regular) para que
    // el reparto no se lea como una cuadrícula obvia.
    // Pedido explícito (tercera pasada): "la animacion de la niebla sigue
    // siendo lo que mas fps se come...otro metodo que visualmente quede
    // igual pero consuma muxhisimo menos?" — el tablero único de este
    // juego es fijo a 25x25 = 625 losetas (OPPONENT_OPTIONS solo tiene la
    // entrada "1", ver matchsetup.js), así que no hay forma de que esto
    // varíe partida a partida: el 30% de capas GPU simultáneas de la
    // pasada anterior (hasta ~187 losetas animando a la vez antes del
    // recorte fuera-de-pantalla) seguía siendo el techo real en este
    // tablero. Mismo criterio de siempre (nunca tocar la animación en sí,
    // solo CUÁNTAS losetas la llevan) bajado otra vez, de 3 de cada 10 a 2
    // de cada 10 — un tercio menos de capas GPU respecto a la versión
    // anterior — y la propia deriva de las que SÍ animan sube un poco más
    // (ver @keyframes fog-idle-drift) para que el campo de niebla se siga
    // leyendo igual de "vivo" con menos nubes en movimiento.
    fogImg.className = (t.row * 7 + t.col * 3) % 10 < 2 ? "tile__fog tile__fog--idle" : "tile__fog";
    // La niebla pasa por SpriteQuality.register igual que cualquier otro
    // sprite del tablero, pero NO sigue el zoom como el resto: pedido
    // explícito (pasada posterior) "la niebla puedes ponerla siempre en
    // baja resolucion estemos a la distancia que estemos?" — register()
    // reconoce la clase "tile__fog" (fijada justo arriba) y la deja fija en
    // "_lowres" para siempre, sin entrar en el Set que reacciona a cruces
    // de zoom (ver _FOG_ALWAYS_LOWRES en spritequality.js, con instrucciones
    // de cómo revertir esto si hiciera falta).
    if (typeof SpriteQuality !== "undefined") {
      SpriteQuality.register(fogImg, FOG_SRC);
    } else {
      fogImg.dataset.srcOrig = FOG_SRC;
      fogImg.src = FOG_SRC;
    }
    fogImg.style.zIndex = String((t.row + t.col) * 10 + 6);
    fogImg.draggable = false;
    fogImg.alt = "";
    fogImg.dataset.row = String(t.row);
    fogImg.dataset.col = String(t.col);
    const fogWidth = Math.round(TILE_WIDTH * FOG_OVERHANG);
    fogImg.width = fogWidth;
    fogImg.height = Math.round((fogWidth * FOG_NATIVE_HEIGHT) / FOG_NATIVE_WIDTH);
    const center = getTileCenter(t.row, t.col, map.size);
    fogImg.style.left = `${center.x}px`;
    fogImg.style.top = `${center.y}px`;
    // Fase de la animación de reposo (ver @keyframes fog-idle-drift en
    // style.css) desfasada al azar por loseta — nivel Triple A / feedback
    // (regla de oro del proyecto): un campo entero de nubes respirando
    // exactamente a la vez se lee como un efecto de pantalla, no como niebla
    // de verdad. Negativo para que arranque ya a mitad de ciclo en vez de
    // hacer esperar a la primera loseta hasta que empiece su turno.
    fogImg.style.animationDelay = `-${(Math.random() * 9).toFixed(2)}s`;
    fragment.appendChild(fogImg);
  });

  container.appendChild(fragment);
}

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
  // nativeWidth/nativeHeight: por si algún día agua_01.png deja de
  // compartir la proporción exacta de hierba_01.png — de momento SÍ la
  // comparte (mismo recorte 1024x854, arte de sustitución provisional
  // pedido explícito: "vamos a sustituir las losetas hasta que las
  // mejore por estas"), pero se declaran igualmente para que este tipo
  // siga funcionando sin tocar nada el día que su arte definitivo tenga
  // otra proporción — renderMap las usa para escalar manteniendo SU
  // relación de aspecto real en vez de estirarla/aplastarla con la de
  // hierba.
  water: {
    variants: ["assets/losetas/agua_01.png"],
    walkable: false,
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

// Alterna TODAS las losetas ya pintadas (hierba/agua base, overlay de
// revelado y niebla) entre su versión normal y su versión "_lowres", sin
// regenerar el mapa (evita perder el estado de niebla ya revelada). Cada
// <img> guarda su ruta original en data-src-orig al crearse (ver
// renderMap más abajo), así que esta función solo necesita leer ese dato y
// decidir qué mitad de la pareja mostrar. La llama PerfMode.setEnabled
// cada vez que el modo rendimiento se activa/desactiva a mitad de
// partida — si todavía no hay partida en curso, el querySelectorAll
// simplemente no encuentra nada y no pasa nada.
function applyPerfModeTileSprites(enabled) {
  const container = document.getElementById("board-tiles");
  if (!container) return;
  container.querySelectorAll("img[data-src-orig]").forEach((img) => {
    // Pedido explícito (bug reportado): "en el modo alto rendimiento la
    // niebla no tiene el efecto de disiparse" — ver la nota larga junto a
    // fogImg.dataset.skipLowres en renderMap: la niebla se queda SIEMPRE en
    // su resolución normal, nunca cambia con este toggle (a diferencia de
    // hierba/agua, que sí lo hacen).
    if (img.dataset.skipLowres) return;
    const orig = img.dataset.srcOrig;
    img.src = enabled ? lowResTileSrc(orig) : orig;
  });
}

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
  revealTile(row, col) {
    if (!this._revealEls) return;
    const el = this._revealEls.get(`${row},${col}`);
    if (el) el.classList.add("tile__terrain-reveal--visible");
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
const TILE_WIDTH = 178;
const TILE_TOP_HEIGHT = 115;
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
function getTileFromPoint(x, y, size) {
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_TOP_HEIGHT / 2;
  // Mismo centerX que getTileTopLeft, más el propio medio-ancho/alto que
  // getTileCenter le suma encima — invertido aquí de una vez.
  const centerX = (size - 1) * halfW + halfW;
  const u = x - centerX;
  const v = y - halfH;
  const col = Math.round((u / halfW + v / halfH) / 2);
  const row = Math.round((v / halfH - u / halfW) / 2);
  return {
    row: Math.min(size - 1, Math.max(0, row)),
    col: Math.min(size - 1, Math.max(0, col)),
  };
}

function pickVariant(typeInfo, row, col) {
  const variants = typeInfo.variants;
  if (variants.length === 1) return variants[0];
  // Selección determinista (misma partida = mismo mapa) en vez de aleatoria pura.
  const idx = (row * 31 + col * 17) % variants.length;
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

function generateMap(size) {
  const grid = Array.from({ length: size }, () => new Array(size).fill("grass"));
  const mid = Math.floor(size / 2);
  // Radio (Chebyshev) alrededor del centro donde NUNCA se genera agua —
  // ahí es donde spawnTestUnits (newgame-flow.js) coloca siempre a los
  // personajes del jugador (spawnSpots relativos a mid/mid), así que tiene
  // que quedar garantizado transitable pase lo que pase con el resto del
  // mapa.
  const SAFE_RADIUS = 4;
  const inSafeZone = (row, col) => Math.max(Math.abs(row - mid), Math.abs(col - mid)) <= SAFE_RADIUS;
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
    img.dataset.srcOrig = baseSrc;
    img.src = typeof PerfMode !== "undefined" && PerfMode.enabled ? lowResTileSrc(baseSrc) : baseSrc;
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
      revealImg.className = "tile__terrain-reveal";
      revealImg.dataset.srcOrig = t.src;
      revealImg.src = typeof PerfMode !== "undefined" && PerfMode.enabled ? lowResTileSrc(t.src) : t.src;
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
    fogImg.className = "tile__fog";
    // Pedido explícito (bug reportado): "en el modo alto rendimiento la
    // niebla no tiene el efecto de disiparse, simplemente desaparece
    // bruscamente" — investigado a fondo: la animación fog-dissipate (ver
    // style.css) SÍ se dispara igual en los dos modos (comprobado con
    // capturas y con la curva de opacity fotograma a fotograma, idéntica en
    // ambos) — lo que cambia es que ese efecto depende de que el propio
    // navegador ESTIRE (scale 1.6) y DESENFOQUE (blur hasta 7px) la textura
    // de la nube para que se lea como niebla disipándose; con la versión
    // "_lowres" (mucho más pequeña/pixelada, pensada para ahorrar memoria
    // de textura en losetas de terreno) ese estirado+desenfoque encima de
    // un original ya de baja resolución no deja ver ninguna transición
    // gradual real, solo un borrón que se desvanece de golpe. A diferencia
    // de una loseta de terreno (un rectángulo fijo, sin animación), la
    // niebla SIEMPRE depende de esa calidad de imagen para su propio
    // efecto, así que se deja SIEMPRE en su resolución normal (un único
    // archivo compartido por todas las nubes del mapa, igual de barato de
    // decodificar sea cual sea el modo — no multiplica coste por loseta
    // como si fuera una textura distinta cada vez) — applyPerfModeTileSprites
    // (más abajo) respeta esta misma exclusión al alternar el modo a mitad
    // de partida.
    fogImg.dataset.srcOrig = FOG_SRC;
    fogImg.dataset.skipLowres = "1";
    fogImg.src = FOG_SRC;
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

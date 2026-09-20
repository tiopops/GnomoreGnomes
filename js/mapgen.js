/* Gnomore Gnomes — generación y render del escenario (perspectiva isométrica, estilo Polytopia).
   Regla de oro: un archivo por mecánica — este solo genera y pinta el tablero de losetas.
   Regla de oro: escalabilidad — TILE_TYPES está pensado para poder añadir nuevos tipos de
   terreno y variantes visuales dentro de un mismo tipo sin tocar el resto del motor: basta con
   añadir más rutas de imagen al array "variants" del tipo que corresponda.
   Regla de oro: nivel Triple A — las losetas usan el arte isométrico real del proyecto
   (assets/losetas/) en vez de placeholders generados, con un orden de dibujado (z-index)
   estable en función de su posición para que no "salten" visualmente al hacer hover. */

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
  // nativeWidth/nativeHeight: agua_01.png NO comparte la proporción de
  // hierba_01.png (su bloque es más alto, con más pared lateral visible) —
  // TILE_NATIVE_WIDTH/HEIGHT de más abajo están pensados solo para hierba,
  // así que cualquier tipo cuya imagen tenga otra proporción declara aquí
  // las suyas propias; renderMap las usa para escalar manteniendo SU
  // relación de aspecto real en vez de estirarla/aplastarla con la de
  // hierba (más alto por su cuenta, igual que el overhang de la niebla, no
  // rompe el encaje en cuadrícula porque solo depende de TILE_WIDTH/
  // TILE_TOP_HEIGHT, no de la altura de la imagen).
  water: {
    variants: ["assets/losetas/agua_01.png"],
    walkable: false,
    nativeWidth: 627,
    nativeHeight: 514,
  },
};

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
};

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
const FOG_SRC = "assets/losetas/niebla_01.png";
const FOG_NATIVE_WIDTH = 1295;
const FOG_NATIVE_HEIGHT = 1110;
const FOG_OVERHANG = 1.7; // veces TILE_WIDTH — cuánto sobresale la nube de su loseta.

// Dimensiones nativas del archivo de imagen hierba_01.png (no cambian).
const TILE_NATIVE_WIDTH = 250;
const TILE_NATIVE_HEIGHT = 218;

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
    const img = document.createElement("img");
    img.src = baseSrc;
    img.width = TILE_WIDTH;
    img.height = TILE_RENDER_HEIGHT;
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
      const revealImg = document.createElement("img");
      revealImg.className = "tile__terrain-reveal";
      revealImg.src = t.src;
      revealImg.width = TILE_WIDTH;
      revealImg.height = Math.round((TILE_WIDTH * nativeH) / nativeW);
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
    // encontraría la de .tile. z-index enorme y fijo (no depende de row/col
    // como el resto) a propósito: tiene que quedar SIEMPRE por encima de
    // cualquier unidad/gnomo que pueda estar de pie sobre esa misma loseta
    // sin haberse revelado todavía — si dependiera de (row+col) como las
    // propias losetas, una unidad con z-index más alto (más cerca de la
    // cámara) se vería POR ENCIMA de la niebla que debería ocultarla.
    const fogImg = document.createElement("img");
    fogImg.className = "tile__fog";
    fogImg.src = FOG_SRC;
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

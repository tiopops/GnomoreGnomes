/* Gnomore Gnomes — generación y render del escenario (perspectiva isométrica, estilo Polytopia).
   Regla de oro: un archivo por mecánica — este solo genera y pinta el tablero de losetas.
   Regla de oro: escalabilidad — TILE_TYPES está pensado para poder sustituir el color plano
   por una imagen/sprite real de loseta en el futuro sin tocar el resto del motor.
   Regla de oro: nivel Triple A — cada loseta se dibuja como un pequeño bloque con cara
   superior + dos caras laterales (no un rombo plano), y con un orden de dibujado (z-index)
   estable en función de su posición, para que no "salten" visualmente al hacer hover. */

const TILE_TYPES = {
  grass: {
    top: ["#8fe06a", "#63c246"],   // cara superior (hierba), degradado claro
    left: "#3f7a2e",               // cara lateral izquierda (tierra, en sombra media)
    right: "#2f5f23",              // cara lateral derecha (tierra, en sombra más oscura)
    // spriteUrl: null  -> cuando haya losetas de imagen reales, se rellena aquí
  },
};

const TILE_WIDTH = 72;   // ancho de la cara superior (rombo)
const TILE_HEIGHT = 42;  // alto de la cara superior (rombo)
const TILE_DEPTH = 20;   // alto de las caras laterales (el "grosor" del bloque)

function generateMap(size) {
  const tiles = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      tiles.push({ row, col, type: "grass" });
    }
  }
  return { size, tiles };
}

function buildTileSVG(typeInfo) {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const d = TILE_DEPTH;
  const totalH = h + d;
  const [topA, topB] = typeInfo.top;

  return `
    <svg width="${w}" height="${totalH}" viewBox="0 0 ${w} ${totalH}" xmlns="http://www.w3.org/2000/svg">
      <polygon points="0,${h / 2} ${w / 2},${h} ${w / 2},${totalH} 0,${h / 2 + d}" fill="${typeInfo.left}" />
      <polygon points="${w},${h / 2} ${w / 2},${h} ${w / 2},${totalH} ${w},${h / 2 + d}" fill="${typeInfo.right}" />
      <polygon points="${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}" fill="url(#g)" />
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${topA}" />
          <stop offset="100%" stop-color="${topB}" />
        </linearGradient>
      </defs>
    </svg>
  `;
}

function renderMap(map, container) {
  container.innerHTML = "";

  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  const centerX = (map.size - 1) * halfW;

  const boardWidth = map.size * TILE_WIDTH;
  const boardHeight = map.size * TILE_HEIGHT + TILE_DEPTH;
  container.style.width = `${boardWidth}px`;
  container.style.height = `${boardHeight}px`;

  const fragment = document.createDocumentFragment();

  map.tiles.forEach((t) => {
    const typeInfo = TILE_TYPES[t.type] || TILE_TYPES.grass;

    const el = document.createElement("div");
    el.className = "tile";
    el.innerHTML = buildTileSVG(typeInfo);

    const x = (t.col - t.row) * halfW + centerX;
    const y = (t.col + t.row) * halfH;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    // Orden de dibujado estable: las losetas "más cercanas" a la cámara
    // (mayor fila+columna) siempre se pintan encima de las que tienen detrás,
    // sin depender del orden en el que se insertaron en el DOM.
    el.style.zIndex = String(t.row + t.col);

    fragment.appendChild(el);
  });

  container.appendChild(fragment);
}

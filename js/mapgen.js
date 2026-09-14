/* Gnomore Gnomes — generación y render del escenario (perspectiva isométrica, estilo Polytopia).
   Regla de oro: un archivo por mecánica — este solo genera y pinta el tablero de losetas.
   Regla de oro: escalabilidad — TILE_TYPES está pensado para poder sustituir el color plano
   por una imagen real de loseta en el futuro sin tocar el resto del motor. */

const TILE_TYPES = {
  grass: {
    className: "tile--grass",
    // spriteUrl: null  -> cuando haya losetas de imagen reales, se rellena aquí
  },
};

const TILE_WIDTH = 72;
const TILE_HEIGHT = 42;

function generateMap(size) {
  const tiles = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      tiles.push({ row, col, type: "grass" });
    }
  }
  return { size, tiles };
}

function renderMap(map, container) {
  container.innerHTML = "";

  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  const centerX = (map.size - 1) * halfW;

  const boardWidth = map.size * TILE_WIDTH;
  const boardHeight = map.size * TILE_HEIGHT;
  container.style.width = `${boardWidth}px`;
  container.style.height = `${boardHeight}px`;

  const fragment = document.createDocumentFragment();

  map.tiles.forEach((t) => {
    const el = document.createElement("div");
    const typeInfo = TILE_TYPES[t.type] || TILE_TYPES.grass;
    el.className = `tile ${typeInfo.className}`;

    const x = (t.col - t.row) * halfW + centerX;
    const y = (t.col + t.row) * halfH;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    // Ligera variación de tono por loseta para que la hierba no se vea plana/repetitiva.
    const shade = ((t.row * 7 + t.col * 13) % 5) - 2; // -2..+2
    el.style.filter = `brightness(${1 + shade * 0.03})`;

    fragment.appendChild(el);
  });

  container.appendChild(fragment);
}

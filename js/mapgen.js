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
};

// Dimensiones reales de la loseta base (hierba_01.png), en píxeles:
// ancho total = 250, alto de la cara superior (hierba) = 86, profundidad del bloque = 131.
const TILE_WIDTH = 250;
const TILE_TOP_HEIGHT = 86;
const TILE_DEPTH = 131;
const TILE_TOTAL_HEIGHT = TILE_TOP_HEIGHT + TILE_DEPTH;

function pickVariant(typeInfo, row, col) {
  const variants = typeInfo.variants;
  if (variants.length === 1) return variants[0];
  // Selección determinista (misma partida = mismo mapa) en vez de aleatoria pura.
  const idx = (row * 31 + col * 17) % variants.length;
  return variants[idx];
}

function generateMap(size) {
  const tiles = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const typeInfo = TILE_TYPES.grass;
      tiles.push({ row, col, type: "grass", src: pickVariant(typeInfo, row, col) });
    }
  }
  return { size, tiles };
}

function renderMap(map, container) {
  container.innerHTML = "";

  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_TOP_HEIGHT / 2;
  const centerX = (map.size - 1) * halfW;

  const boardWidth = map.size * TILE_WIDTH;
  const boardHeight = map.size * TILE_TOP_HEIGHT + TILE_DEPTH;
  container.style.width = `${boardWidth}px`;
  container.style.height = `${boardHeight}px`;

  const fragment = document.createDocumentFragment();

  map.tiles.forEach((t) => {
    const el = document.createElement("div");
    el.className = "tile";

    const img = document.createElement("img");
    img.src = t.src;
    img.width = TILE_WIDTH;
    img.height = TILE_TOTAL_HEIGHT;
    img.draggable = false;
    img.alt = "";
    el.appendChild(img);

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

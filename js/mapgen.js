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
const FOG_SRC = "assets/losetas/niebla_01.png";
const FOG_OVERHANG = 1.55; // veces TILE_WIDTH — cuánto sobresale la nube de su loseta.

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

  const boardWidth = map.size * TILE_WIDTH;
  const boardHeight = map.size * TILE_TOP_HEIGHT + (TILE_RENDER_HEIGHT - TILE_TOP_HEIGHT);
  container.style.width = `${boardWidth}px`;
  container.style.height = `${boardHeight}px`;

  const fragment = document.createDocumentFragment();

  map.tiles.forEach((t) => {
    const el = document.createElement("div");
    el.className = "tile";

    const img = document.createElement("img");
    img.src = t.src;
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

    const { x, y } = getTileTopLeft(t.row, t.col, map.size);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.dataset.row = String(t.row);
    el.dataset.col = String(t.col);

    // Orden de dibujado estable: las losetas "más cercanas" a la cámara
    // (mayor fila+columna) siempre se pintan encima de las que tienen detrás,
    // sin depender del orden en el que se insertaron en el DOM.
    el.style.zIndex = String(t.row + t.col);

    // Capa de niebla (ver comentario de FOG_SRC arriba) — visible por
    // defecto en TODAS las losetas; js/fog.js la oculta loseta a loseta
    // según se va revelando el mapa. z-index enorme y fijo (no depende de
    // row/col como el resto) a propósito: tiene que quedar SIEMPRE por
    // encima de cualquier unidad/gnomo que pueda estar de pie sobre esa
    // misma loseta sin haberse revelado todavía — si dependiera de
    // (row+col) como las propias losetas, una unidad con z-index más alto
    // (más cerca de la cámara) se vería POR ENCIMA de la niebla que debería
    // ocultarla.
    const fogImg = document.createElement("img");
    fogImg.className = "tile__fog";
    fogImg.src = FOG_SRC;
    fogImg.draggable = false;
    fogImg.alt = "";
    const fogWidth = Math.round(TILE_WIDTH * FOG_OVERHANG);
    fogImg.width = fogWidth;
    fogImg.height = fogWidth; // niebla_01.png es cuadrada — ver FOG_OVERHANG
    el.appendChild(fogImg);

    fragment.appendChild(el);
  });

  container.appendChild(fragment);
}

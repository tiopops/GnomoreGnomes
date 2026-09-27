/* Gnomore Gnomes — virtualización del tablero, parte 2: "mobiliario" y
   personajes. Regla de oro: un archivo por mecánica. Este archivo SOLO
   sabe: qué elementos de escenario/unidades caen fuera del viewport de la
   cámara (+ margen) y ocultarlos con display:none, ni siquiera se pintan.

   Pedido explícito: "¿al haber ahora niebla de guerra y zonas inactivas
   aumentará el rendimiento?...qué harías para mejorar el rendimiento al
   doble?" — investigado a fondo: el tablero YA tiene virtualización desde
   hace tiempo, pero SOLO cubre las losetas de terreno (TerrainMap.
   updateCulling, js/mapgen.js) y la niebla (Fog.updateCulling, js/fog.js).
   Todo lo demás — unidades, tótems, Obeliscos, tienda, arbustos, recursos
   (rocas/mena/pinos) y sobre todo los hierbajos decorativos (los más
   numerosos, ~50-60 de normal) — se queda SIEMPRE montado en el DOM,
   animando (unit-idle-breathe) y con su propia sombra proyectada como
   imagen hermana (Shadows.attach) sin importar si está fuera de cámara.
   En un mapa grande con la cámara acercada, eso es la inmensa mayoría del
   contenido pagando un coste que no sirve para nada visible — la misma
   causa raíz que ya se investigó y arregló para las losetas, sin más.

   Solución: exactamente el mismo mecanismo ya probado (display:none fuera
   del viewport + margen), extendido aquí al resto de listas del tablero.
   Reutiliza getVisibleTileRange (js/mapgen.js) tal cual — cada entidad
   vive en coordenadas fila/columna igual que una loseta, así que el mismo
   rectángulo ya calculado para el terreno sirve sin repetir esa
   matemática. A diferencia de Fog.updateCulling (recorre TODA su lista de
   nubes en cada frame), aquí las listas son cortas (unidades reclutadas +
   mobiliario fijo, nunca cientos), así que un recorrido directo por
   entidad — sin la optimización de "solo lo que cambia de ventana" que sí
   necesita TerrainMap para escalar a mapas enormes — es más que suficiente
   y más simple de mantener. */

const EntityCulling = {
  // Se llama desde BoardView._apply en cada frame de cámara (pan/zoom),
  // igual que Fog.updateCulling/TerrainMap.updateCulling — mismo punto
  // único de paso, ver ese archivo.
  updateCulling(panX, panY, scale, viewportW, viewportH) {
    if (typeof TerrainMap === "undefined" || !TerrainMap.size) return;
    if (typeof getVisibleTileRange !== "function") return;
    const range = getVisibleTileRange(panX, panY, scale, viewportW, viewportH, TerrainMap.size);
    const inRange = (row, col) =>
      row >= range.minRow && row <= range.maxRow && col >= range.minCol && col <= range.maxCol;

    // Un gnomo COGIDO no se cull por su cuenta — vive dentro del sprite
    // del personaje que lo lleva (gnome-attach), hereda su visibilidad sin
    // necesitar comprobación propia (mismo criterio que Fog._refreshFogCoverZ
    // y applyVisibility, ver fog.js).
    const cull = (list, opts) => {
      if (!list) return;
      list.forEach((e) => {
        if (!e || !e.el) return;
        if (opts && opts.skip && opts.skip(e)) return;
        e.el.classList.toggle("gg-viewport-culled", !inRange(e.row, e.col));
      });
    };

    cull(typeof Units !== "undefined" ? Units.list : null);
    cull(typeof Gnome !== "undefined" ? Gnome.list : null, { skip: (g) => g.heldBy });
    cull(typeof Villages !== "undefined" ? Villages.list : null);
    cull(typeof Obelisks !== "undefined" ? Obelisks.list : null);
    cull(typeof Shops !== "undefined" ? Shops.list : null);
    cull(typeof Bushes !== "undefined" ? Bushes.list : null);
    cull(typeof Resources !== "undefined" ? Resources.list : null);
    cull(typeof Hierbajos !== "undefined" ? Hierbajos.list : null);
    cull(typeof Backpack !== "undefined" ? Backpack.placedItems : null);
    // Pedido explícito (pasada posterior): "cada Sprite que entre nuevo
    // tendrá que adaptarse a estas mejoras" — auditando el resto del
    // proyecto se encontraron dos objetos de tablero que se habían quedado
    // fuera de esta lista por descuido (el cepo Atrapapinreles vive en su
    // propio array, Backpack.traps, separado de Backpack.placedItems; la
    // mina de Abilities ni siquiera tiene lista compartida con nada) —
    // mismo mobiliario fijo que el resto, mismo criterio.
    cull(typeof Backpack !== "undefined" ? Backpack.traps : null);
    cull(typeof Abilities !== "undefined" ? Abilities._mines : null);
  },

  // Vuelve a mostrar todo (p.ej. si algún día hiciera falta forzar un
  // repintado completo) — mismo patrón que Fog.clearCulling/TerrainMap.
  // showAll, aunque hoy nada lo llama todavía.
  clearAll() {
    document.querySelectorAll(".gg-viewport-culled").forEach((el) => el.classList.remove("gg-viewport-culled"));
  },
};

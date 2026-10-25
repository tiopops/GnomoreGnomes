/* Gnomore Gnomes — número de versión e historial de cambios.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - GG_VERSION: la versión actual (formato v.AABBCC: AA = fase, BB = bloque de
       contenido, CC = revisión dentro del bloque).
     - GG_CHANGELOG: lista de versiones, la más nueva primero.
     - La ventanita que se abre al pulsar el número del menú principal.
   MANTENIMIENTO: con cada mejora, contenido o corrección, subir GG_VERSION y
   añadir arriba una entrada (o ampliar la actual) con lo más relevante.
   REGLA: una sola entrada por día. Si ya hay una con la fecha de hoy, se le
   suben el número de versión y se le añaden los cambios nuevos (nunca dos
   entradas con la misma fecha).
   ORDEN: lo más reciente SIEMPRE arriba: las entradas de la más nueva a la más
   antigua y, dentro de una entrada, el último cambio el primero de la lista. */

const GG_VERSION = "v.001582";

const GG_CHANGELOG = [
  { v: "v.001582", date: "25/10/2026", title: "Tutoriales y rendimiento", items: [
    "Tutoriales: las réplicas de Nizak tras completar una misión ya NO se quitan solas — esperan a que pulses (clic, Enter, Espacio, flecha derecha o A del mando); las misiones que piden una acción siguen igual",
    "Tutoriales: se quita el botón «Releer»; el editor de diálogos de Nizak (debug) trae solo los textos nuevos del juego sin pisar tus ediciones",
    "Opciones gráficas: los interruptores (Vegetación, Sombras, Niebla, Resolución adaptativa) se refrescan al abrir el panel con su estado real — la Vegetación aparecía marcada estando desactivada",
    "Tutorial «Primeros pasos»: Nizak dice ahora que su tío Klink se esparció «por el césped»",
    "Tutoriales: las réplicas de Nizak ya se pueden leer con calma — un clic o tecla primero completa la frase y luego pasa",
    "Corregido: en el tutorial «Primeros pasos» no se podía talar el pino — la zona reservada del centro bloqueaba la casilla desde la que se golpea (ahora el tutorial la ignora)",
    "Coger un gnomo: además del icono de la mano sobre su base, el puntero de mano aparece también al pasar el ratón por su sprite, y se puede pulsar el sprite para cogerlo",
    "Una unidad solo puede cargar UN gnomo: ya no se le puede pasar otro si ya lleva uno (ni a mano ni por la IA rival), y el intento no gasta acción",
    "El Altar (MushBoom), el Volcán (Rock'n Troll) y el Huevo (HurryCrane) aparecen SIEMPRE en el centro exacto del mapa: el centro nunca lleva agua (ni con río) y tienda, oráculo, poblados, bumpers, arbustos y recursos respetan esa zona",
    "Corregido: las unidades y gnomos junto a la niebla (niebla de calidad baja) volvían a moverse sin deslizarse ni dar saltitos de loseta en loseta; el fundido al 66 % pisaba su animación de movimiento",
    "Tutoriales más ágiles y directos: Nizak escribe más rápido, «mantener pulsada la cara» dura la mitad y todos los textos son más cortos, con la acción primero y el humor intacto (español e inglés)",
    "Resolución adaptativa: corregido el parpadeo real de los bumpers (desaparecían unos fotogramas al cambiar de calidad con zoom rápido): el fundido espera a que la textura nueva esté lista para pintar",
    "Resolución adaptativa: los bumpers (y cualquier sprite con brillo/saturación propios) ya no parpadean al cambiar de calidad con zoom rápido — el fundido conserva su filtro",
    "Resolución adaptativa: la subida a calidad normal espera a que termine el zoom, eliminando el tirón a mitad de un acercamiento rápido",
    "Setas del escenario: ahora usan la misma animación idle que el resto de elementos (respiran), cada una desfasada para que no latan a la vez",
  ] },
  { v: "v.001569", date: "24/10/2026", title: "APK y rendimiento", items: [
    "Niebla de calidad baja: los objetos que quedan sobre la niebla (junto a casillas sin revelar o disipándose) se ven al 66 % de opacidad, con un fundido suave al aparecer y desaparecer",
    "Niebla de alta calidad: ahora TODOS los objetos del mapa junto al borde se hunden en la niebla, en todos los niveles (huevo, objetos y trampas del suelo, bumpers, tótems de visión, manchas de sangre, unidades y gnomos, además de los que ya lo hacían). La niebla de un objeto ya no tapa a los objetos que tiene delante, y se quita el congelado de animaciones de los objetos del borde",
    "Niebla: con «Niebla de alta calidad» desactivada, la niebla se disipa con un simple fundido (como antes), sin crecer ni subir. Con ella activada, las setas sueltas y los tambores junto al borde también quedan hundidos en la niebla (antes la seta se veía por encima)",
    "Configuración: la opción «Animación de niebla» pasa a llamarse «Niebla de alta calidad». Activada: niebla en dos capas (la base de los objetos junto al borde se hunde en la niebla, sombras cubiertas, y en escritorio las nubes del borde respiran). Desactivada: niebla en un único lienzo por debajo de los objetos, la más ligera. Ahora también aparece en móvil (por defecto activada en escritorio y desactivada en móvil)",
    "Niebla: la sombra proyectada de los objetos del borde ahora queda cubierta por la niebla (antes se veía por encima como un rectángulo gris), y se eliminan los bordes rectos y líneas horizontales que dejaba la niebla sobre la base de los objetos (ahora se difuminan por los lados y por abajo)",
    "Rendimiento: apagada la respiración (movimiento lento) de las nubes del borde de la niebla en escritorio; era lo que más fotogramas costaba y apenas se notaba",
    "Niebla: la niebla que queda DETRÁS de un objeto ya no lo tapa, y la de delante sube por su base con un degradado suave, sin recortes con la silueta del sprite ni contornos sueltos",
    "Niebla: al revelar una zona, los objetos del mapa aparecen al instante (antes la zona salía vacía y los objetos 'saltaban' un segundo después)",
    "Niebla: las bases de los objetos junto a la niebla se hunden en ella sin recortes ni bordes sueltos (antes se veían siluetas y contornos oscuros traspasando la niebla)",
    "Niebla: ya no tapa la interfaz de los objetos (indicador de población del obelisco, barras de vida, insignias, avisos y marcadores): la niebla va por debajo de todo eso, y solo la base de los objetos con nubes delante sigue quedando enterrada",
    "Mantenimiento: eliminado el código y el CSS de la niebla antigua (nubes del DOM, animaciones y desenfoque, pasada de niebla profunda del suelo, restos en la resolución adaptativa y funciones sin uso); sin cambios visibles ni de comportamiento",
    "Niebla rehecha: ahora se dibuja en UN solo lienzo en vez de decenas de nubes del DOM con animaciones CSS, z-index por nube y desenfoque. Menos consumo, sin parpadeos al revelar ni al hacer zoom, y la cámara, el suelo y la niebla se actualizan en el mismo fotograma. Los árboles, rocas y estructuras ya revelados junto a la niebla asoman por encima de ella (la base queda enterrada en la nube). Las nubes se disipan sin blur, y la respiración de las nubes de frontera se mantiene en escritorio y se apaga en móvil",
    "APK: el botón de descargar del menú principal solo aparece cuando hay una actualización disponible (antes se veía siempre)",
    "Hierbajos (vegetación): parpadeo al alejar/acercar la cámara — ya no llevan sombra difusa por sprite (decenas de capas que se re-rasterizaban en cada paso del zoom), se decodifican de forma síncrona (no quedan en blanco al reaparecer) y cambian de calidad de golpe y a la vez, sin fantasmas de fundido escalonados",
    "Mando: para salir del test hay que mantener START pulsado 3 segundos seguidos; junto al mando aparece un indicador circular con la cuenta atrás (se reinicia si sueltas el botón)",
    "Mando: el icono de acción (pico, hacha, mano, bandera, puño...) ahora es más grande y se dibuja sobre el propio sprite (árbol, roca, gnomo, tótem...) en vez de sobre la loseta, y se ignoran los cursores genéricos para que nunca salga una flecha por error",
    "Móvil: las sombras gigantes que no correspondían a los sprites estaban causadas por sprites que nacían ocultos (su sombra se quedaba sin ancho y se dibujaba a tamaño natural); ahora la sombra se oculta hasta ajustarse y se corrige sola en cuanto el sprite tiene tamaño",
    "Niebla: al revelarse, árboles, rocas, unidades y demás ya no aparecen de golpe sobre su nube opaca (ni sin fundido en móvil): se desvanecen hacia dentro cuando la nube ya se ha aclarado",
    "Mando: la leyenda muestra X = Mochila también sin unidad seleccionada y con el menú de la base abierto (y Acciones sin selección)",
    "Mando: la cruceta perdona mucho más las diagonales: ventana de 170 ms para pulsar los dos botones (arriba+derecha...) y, si el segundo llega tarde (hasta 260 ms), se deshace el movimiento recto y se hace la diagonal; un toque corto sigue moviendo; al soltar un solo botón de una diagonal no se hace el movimiento sobrante",
    "Mando: X abre directamente la Mochila (y sale en la leyenda como \"Mochila\"); el menú de Acciones pasa a L3 y \"Mi base\" (R3) pulsado otra vez centra la cámara en la unidad seleccionada (sustituye a \"Centrar cámara\"). Si tenías botones personalizados, X/L3/R3 toman los nuevos valores",
    "Errores gráficos al alejar la cámara (rectángulos de suelo sin pintar y trozos de niebla viejos): cuando la cámara queda quieta tras un zoom se renueva el lienzo del suelo/niebla profunda reasignándolo y repintándolo en el mismo fotograma",
    "APK: el texto de la pantalla de actualización disponible queda centrado (título, textos, versión y botones)",
    "Niebla: menos parpadeos al alejar/acercar la cámara: las nubes animadas se pausan mientras hay zoom y se reanudan en el mismo punto, las nubes fuera de pantalla ya no reinician su animación al reaparecer, y la capa de la cámara solo se renueva cuando ya está totalmente quieta",
    "Resolución adaptativa: los sprites (árboles, rocas, arbustos, edificios...) bajan de calidad ~0,35 s después de alejar la cámara; antes tardaban ~3 s porque el suavizado del zoom reiniciaba la cuenta en cada fotograma. Ahora se decide por el destino del zoom",
    "Mando: navegación por losetas rediseñada (como en los juegos de estrategia por casillas): elige la loseta vecina de ángulo REAL más cercano (las diagonales de stick y cruceta ya funcionan), desliza por los bordes del mapa en vez de quedarse parado, imán suave hacia losetas con unidad/recurso/edificio/objetivo y el stick va más rápido cuanto más se inclina",
    "Mando: el cursor amarillo del tablero va sobre las losetas pero por debajo de cualquier sprite; y sobre la casilla elegida aparece el icono de acción (pico, hacha, mano, bandera, calavera...) por encima de todos los sprites, igual que con el ratón",
    "Resolución adaptativa: el fundido entre calidades ya no duplica la sombra difusa del sprite (el halo oscuro del \"bum\" en arbustos, árboles y obelisco se reduce a menos de la mitad)",
    "Mando: atajo a la base principal (R3 por defecto, aparece en la leyenda como \"Mi base\"): lleva el cursor y selecciona el Obelisco para abrir su menú. En Habilidades, Armería, Reclutar y tiendas, resaltar con la cruceta ya selecciona (se ve la descripción) y A compra/mejora/recluta; LB/RB recorren los elementos y la leyenda indica la acción",
    "Mando: en Reclutar y en las tiendas, LB/RB cambian la unidad u objeto elegido, la cruceta izquierda/derecha también lo elige y A recluta/compra directamente; en Ajustes, derecha desde \"Buscar mando\" ya llega a \"Test\" (antes saltaba a \"Ayudas del mando\")",
    "APK: arreglada la actualización desde dentro del juego (\"No se pudo actualizar\"): el plugin exigía el checksum SHA-256 del paquete y no se le enviaba; ahora se calcula al generar la release y se pasa al descargar",
    "Resolución adaptativa: al acercar la cámara los sprites suben a calidad completa casi al instante y con un fundido más corto, eliminando el parpadeo con sombra oscura difusa (\"bum\") alrededor de arbustos, árboles y obeliscos",
    "Historial de versiones: lo más reciente siempre arriba (entradas y cambios de cada día, del último al primero)",
    "Resolución adaptativa: el sprite ya no da un pequeño salto al cambiar de calidad (se mantiene su proporción exacta y el fundido se alinea al milímetro con la animación de reposo)",
    "Fundido de resolución adaptativa: la sombra de los sprites ya no salta al cambiar de calidad",
    "Fundido de resolución adaptativa: las animaciones de reposo (respiración, balanceo) ya no hacen saltar el sprite al cambiar de calidad",
    "Historial de cambios unificado por día",
    "Armería: la marca de nivel comprado es ahora un cuadrado irregular",
    "APK: pantalla de aviso al abrir la app con «Existe una nueva actualización», la versión y el botón ACTUALIZAR; si falla, muestra el motivo",
    "Niebla animada: sin parpadeos al revelar una zona nueva",
    "Al revelar una zona, las nubes ya están preparadas desde la pantalla de carga y las texturas medias de los sprites también (menos tirones)",
    "Niebla: siempre en baja resolución, con cualquier zoom",
    "Resolución adaptativa: fundido cruzado al cambiar de calidad al alejar o acercar la cámara (solo en los sprites visibles)",
    "Resolución adaptativa en todos los sprites: nuevas versiones reducidas de las unidades al golpear, cofres, grulla y raíces, y los cambios de pose también respetan la calidad",
    "Actualización de la APK: el aviso de arranque correcto se envía al principio de la carga (antes la app volvía a la versión antigua si tardaba en cargar)"
  ] },
  { v: "v.001536", date: "23/10/2026", title: "Grulla y huevo · Fin de partida · Punteros · Sacrificios · Rendimiento móvil · Tutorial · Niebla inicial", items: [
    "La zona alrededor de tu Obelisco empieza ya despejada: la niebla inicial no se disipa, nunca llega a verse",
    "Primeros pasos: nueva misión de sacrificio (lanzar el gnomo al agua) con +Gloria instantánea, con su charco de práctica",
    "El suelo en canvas no pasa de 2x de resolución en teléfonos",
    "La capa de la cámara se vuelve a rasterizar tras cualquier cambio de zoom notable (menos losetas a medias al alejar)",
    "Cámara muy alejada: se quitan las sombras con desenfoque de unidades, tienda y huevo",
    "Con la animación de niebla desactivada (siempre en móvil), la niebla se disipa con un simple fundido",
    "Sacrificio en el volcán: el gnomo patalea en la lava y, al hundirse, asoma una mano con el pulgar arriba que también se hunde",
    "Estampar un gnomo contra un tótem usa una bandera roja como puntero",
    "Partículas según el resultado (confeti, brasas o polvo)",
    "Nueva pantalla de victoria, derrota y empate: más compacta, con el turno en que acabó la partida y barras comparativas",
    "Entrar en la Tienda Goblin o la casa de la adivina usa la mano amarilla que señala",
    "Abrir un cofre usa la mano amarilla de coger en vez del hacha",
    "El rebote del huevo lanzado por los rivales respeta su propia niebla (lo que ven sus unidades, aldeas y obelisco), no la del jugador",
    "El icono para lanzarle un gnomo a la grulla sale sobre ella (no en la base del obelisco) y se puede pulsar la propia grulla"
  ] },
  { v: "v.001528", date: "22/10/2026", title: "Carga · Recursos · Sonido · Móvil · Sacrificios", items: [
    "Al pulsar sobre el cuerpo del bumper con la calavera, se hace el sacrificio en vez de lanzar el gnomo a la casilla de arriba",
    "Al apuntar un lanzamiento, el puntero sobre un bumper donde se puede sacrificar al gnomo es la calavera",
    "Nuevo sacrificio: lanzar un gnomo al agujero de un bumper del pinball. Se lo traga de golpe y la máquina escupe sangre a presión y humo negro, dejando charcos de sangre alrededor (da Gloria como el resto de sacrificios; ya no rebota)",
    "Interfaz móvil: la niebla nunca está animada y la opción desaparece de los ajustes gráficos (en escritorio sigue igual)",
    "Con el juego en segundo plano (ventana tapada o app minimizada) no suena ningún efecto ni música hasta volver; antes los efectos podían reactivar el audio solos",
    "Con la cámara muy ampliada o alejada, las ventanas (ajustes, mochila, cuenta…) ya no se quedan oscuras: el tablero se oculta detrás mientras están abiertas",
    "Mi cuenta: la X de cerrar ya no se recorta (igual que en Ajustes)",
    "El hacha de recolectar es un poco más grande, para igualar al pico",
    "Puntero de recolectar: hacha amarilla para los árboles y pico amarillo para la piedra y la mena de metal (mismo tamaño)",
    "Pico de recolectar con trazo más fino, igual de delgado que el resto de punteros",
    "Al poder recolectar un recurso, el puntero es un pico amarillo (antes un hacha)",
    "Fundidos más suaves y largos entre menús, y la pantalla de carga se desvanece despacio",
    "La pantalla de carga espera a que todo el nivel (terreno, unidades, recursos, interfaz) esté cargado y listo antes de mostrarse, sin sprites que aparezcan tarde ni parpadeos",
    "Mi cuenta, Ajustes y demás ventanas en el móvil: la X de cerrar ya no se corta por arriba y los paneles caben en pantallas pequeñas o apaisadas",
    "APK: las imágenes se reducen al compilar (de unos 88 MB a unos 25 MB), para que las actualizaciones pesen mucho menos y el móvil use menos memoria"
  ] },
  { v: "v.001515", date: "21/10/2026", title: "Actualización de la APK · Tutoriales · Sacrificios de gnomos · Sacrificios · Sonido · Móvil · Equipo · Recursos · Combate", items: [
    "Al pasar el puntero sobre un enemigo (que se puede atacar) el puntero es un puño rojo",
    "Al poder recolectar un recurso, el puntero es un hacha amarilla",
    "El recuadro de virtudes/debilidades y de unidades mide siempre exactamente lo mismo, sea cual sea el equipo o la unidad elegida",
    "Nuevo diseño de virtudes y debilidades: dos tarjetas con cinta de título, iconos y una viñeta por frase",
    "APK: la comprobación de versión se hace siempre al abrir la app (también con datos móviles), prueba varias vías de lectura y el aviso de advertencia ya no se queda fijo",
    "Equipo: el recuadro de virtudes y debilidades y el de la ficha de unidad miden siempre lo mismo y no recortan el texto en el móvil",
    "El pitido de «¡Todos listos!» y la música se silencian al perder el foco la ventana (segundo plano) y vuelven al regresar",
    "Al lanzar un gnomo contra una seta ya no se voltea boca abajo en el aire",
    "Los gnomos cargados valen más al sacrificarlos: +4 con 5 a 9 puntos y +5 con 10 o más",
    "Al poder coger un gnomo, el puntero es la mano amarilla",
    "Seta explosiva: el gnomo se carboniza en el sitio y se hunde en el suelo dejando un círculo de ceniza",
    "Las casillas de sacrificio vuelven a mostrar el círculo habitual; la calavera aparece solo en el puntero",
    "El botón Lanzar está siempre disponible cuando una unidad lleva un gnomo, aunque no haya más aliados",
    "Las casillas de sacrificio muestran la calavera y el puntero cambia a una calavera al apuntar",
    "Cuando un gnomo muere así, aparece otro enseguida en una zona aleatoria del escenario",
    "Una piedra de Rock'n Troll o un cohete KataPum! contra un gnomo suelto también lo sacrifica",
    "Se pueden lanzar gnomos al volcán, a charcos de lava, al agua, a setas explosivas y a cepos",
    "Nueva forma de ganar Gloria al instante: sacrificar gnomos. Cada sacrificio da +3 de Gloria",
    "Con Ajustes o la confirmación abiertos, la viñeta, el puntero y el contador del tutorial se esconden",
    "Ya se puede abandonar un tutorial desde Ajustes: la confirmación de salir ya no queda tapada por Nizak ni bloqueada",
    "Recuadro de información de escenario con el mismo tamaño en los tres niveles",
    "El historial de versiones muestra, dentro de la APK, el paquete instalado y el resultado de la última comprobación",
    "La comprobación de versión al abrir la app reintenta si GitHub tarda en responder"
  ] },
  { v: "v.001501", date: "20/10/2026", title: "Móvil y APK", items: [
    "Menú principal nuevo: botones con cinta de color, logo más grande en móvil y sin scroll en escritorio",
    "Interfaz del móvil revisada en vertical y horizontal: ventanas, selección de equipo, perfil, amigos y ajustes",
    "Zoom con pellizco y doble toque corregidos en el tablero",
    "La música se pausa al salir de la app y el modo rendimiento se activa solo en móviles",
    "Iconos incluidos en la app, sin necesidad de conexión",
    "Reanudar partida retirado: abandonar cuenta como rendirse",
    "HurryCrane Village pasa a llamarse Poblado HurryCrane, con colores de recursos más integrados"
  ] },
  { v: "v.001500", date: "19/10/2026", title: "Progreso y partidas online", items: [
    "Nivel y experiencia de cuenta, y misiones diarias con racha",
    "Partida Rápida online: emparejamiento por nivel de habilidad, elección de equipo y ruleta de escenario",
    "Multijugador y Mi cuenta rediseñados",
    "Pantalla de actualización de la APK al abrir la app",
    "Tutorial más ligero"
  ] },
  { v: "v.001400", date: "18/10/2026", title: "App Android y rendimiento", items: [
    "APK de Android con actualización automática",
    "Suelo y niebla profunda dibujados en canvas, y modo rendimiento",
    "Ventanas de reclutar, armería y habilidades con tamaño fijo; tamaños de unidades ajustados",
    "La grulla se queda 2 turnos en cada obelisco; aterrizaje y plumas nuevos"
  ] },
  { v: "v.001300", date: "15/10/2026", title: "Pinball de HurryCrane", items: [
    "Bumpers repartidos por el mapa con turbo, luces y teledirigido; combos y ruleta de jackpot",
    "Huevo estilo pinball con guía de trayectoria, rebotes y premio tipo tragaperras",
    "La IA aprovecha bumpers y combos; tutorial del nivel y música propia"
  ] },
  { v: "v.001200", date: "13/10/2026", title: "Equipo SurcaNubes", items: [
    "Nuevo equipo SurcaNubes: ManosLargas, AlaFugaz y NidoBot con sus habilidades",
    "Nuevo nivel con el Huevo de Grulla",
    "La IA rival usa las habilidades de todos los equipos"
  ] },
  { v: "v.001100", date: "11/10/2026", title: "Oráculo y mando", items: [
    "Casa del Oráculo: cartas, beneficios y maldición",
    "Soporte de mando con teclado en pantalla; tutoriales adaptados al mando",
    "Tienda goblin con vendedor animado y moneda",
    "Partidas de 50 rondas con desempate por puntos y gloria máxima de 30",
    "Estadísticas de jugador y cambio de nombre cada 7 días"
  ] },
  { v: "v.001000", date: "08/10/2026", title: "Multijugador y tutoriales", items: [
    "Multijugador 1 contra 1 con invitaciones de amigos y sala",
    "Tutoriales de MushBoom y Rock'n Troll con su propio submenú",
    "Efectos de goma al pegar, lanzar y ahogarse"
  ] },
  { v: "v.000900", date: "05/10/2026", title: "Colinas Rock'n Troll", items: [
    "Volcán con erupción, gnomos en llamas, lava y piedras",
    "Tambores de guerra con lluvia de rocas",
    "Reliquias nuevas y pantalla final con el emblema del equipo ganador"
  ] },
  { v: "v.000800", date: "Septiembre 2026", title: "Base del juego", items: [
    "Mapa, niebla de guerra, obeliscos, tótems, combate y tutorial de Nizak",
    "Equipos de MushBoom y cuentas de jugador"
  ] },
];

const VersionInfo = {
  _overlay: null,

  init() {
    const btn = document.getElementById("btn-version");
    if (!btn) return;
    btn.textContent = GG_VERSION;
    btn.addEventListener("click", () => this.open());
  },

  _build() {
    const overlay = document.createElement("div");
    overlay.className = "settings-overlay version-overlay";
    overlay.addEventListener("click", () => this.close());
    const panel = document.createElement("div");
    panel.className = "p5-banner version-panel";
    panel.addEventListener("click", (e) => e.stopPropagation());
    const close = document.createElement("button");
    close.type = "button";
    close.className = "backpack-close-btn";
    close.setAttribute("aria-label", "Cerrar");
    close.innerHTML = '<i class="ph ph-x backpack-close-btn__icon"></i>';
    close.addEventListener("click", (e) => { e.stopPropagation(); this.close(); });
    panel.appendChild(close);
    const title = document.createElement("div");
    title.className = "p5-banner__label settings-panel__title version-panel__title";
    title.textContent = "HISTORIAL DE VERSIONES";
    panel.appendChild(title);
    const list = document.createElement("div");
    list.className = "version-list";
    list.innerHTML = GG_CHANGELOG.map((e, i) =>
      '<section class="version-entry' + (i === 0 ? " version-entry--current" : "") + '">' +
        '<div class="version-entry__head"><span class="version-entry__tag">' + e.v + "</span>" +
        '<span class="version-entry__title">' + e.title + "</span>" +
        '<span class="version-entry__date">' + e.date + "</span></div>" +
        "<ul>" + e.items.map((t) => "<li>" + t + "</li>").join("") + "</ul></section>"
    ).join("");
    panel.appendChild(list);
    // Dentro de la APK: versión del paquete instalado y resultado de la última comprobación.
    if (typeof AppUpdate !== "undefined" && AppUpdate.isNative()) {
      const dbg = document.createElement("div");
      dbg.className = "version-build";
      let st = AppUpdate.status || "";
      if (!st) { try { st = (localStorage.getItem("gg_update_status") || "").split("|").slice(1).join("|"); } catch (e) {} }
      dbg.textContent = "Paquete " + (AppUpdate.localVersion || "?") + " · " + (st || "sin comprobar");
      panel.appendChild(dbg);
    }
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    this._overlay = overlay;
  },

  open() {
    if (!this._overlay) this._build();
    if (typeof SFX !== "undefined" && SFX.click) SFX.click();
    this._overlay.querySelector(".version-list").scrollTop = 0;
    requestAnimationFrame(() => this._overlay.classList.add("settings-overlay--visible"));
  },

  close() {
    if (this._overlay) this._overlay.classList.remove("settings-overlay--visible");
  },
};

document.addEventListener("DOMContentLoaded", () => VersionInfo.init());

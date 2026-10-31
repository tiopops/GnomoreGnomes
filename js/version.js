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

const GG_VERSION = "v.001624";

const GG_CHANGELOG = [
  { v: "v.001624", date: "30/10/2026", title: "Gnomoteca", items: [
    "Gnomoteca: textos más grandes y legibles (también en móvil), fichas largas en bloque sin cortes, y la XP por descubrir (+10) visible en todas las entradas con una barra de progreso en cada categoría",
    "Gnomoteca: nueva pestaña dorada de Logros (30 coleccionables con icono, explicación y XP, y una barra con los que llevas respecto al total); descubrir entradas de la Gnomoteca también da experiencia; todas las descripciones con el tono de Nizak; la Gnomoteca ya no incluye Mecánicas; el tutorial de WallForge señala bien el guardia y la Reliquia",
    "Menú de tutoriales: Colinas Rock'n Troll en rojo y Fortaleza WallForge en naranja",
    "Gnomoteca: pulsar fuera del libro lo cierra; pasa a ser la última opción del menú principal, en morado como el libro, y al cambiar de pestaña o ficha el sprite rebota como de goma",
    "Gnomoteca: barra de scroll con el diseño irregular del juego, marcapáginas más ancho y sonido al pulsar pestañas, fichas y el botón de volver",
    "Gnomoteca: lo descubierto se guarda en tu cuenta (un solo documento, escrituras agrupadas) y te sigue a cualquier dispositivo",
    "Gnomoteca: nuevo libro del saber en el menú principal con unidades, recursos, edificios, objetos, equipos y escenarios; lo que aún no has visto sale como \"???\" con una sombra oscura y la descripción en blanco, y se desvela al verlo en partida",
    "Barra espaciadora: centra la vista en tu base principal",
    "Poblado HurryCrane: si lanzas un gnomo a la grulla y se marcha hacia un obelisco en la niebla, ahora se la ve despegar y alejarse volando hacia el siguiente jugador",
    "Reliquia Paranoica: el portador deja ondas en los pies, por detrás del sprite, más grandes que las del altar",
    "Fortaleza WallForge: los guardias de la Reliquia ya se vuelven semitransparentes cuando una unidad queda detrás, como las rocas y los árboles",
    "Recursos de escenario: el letrero de nombre también se mantiene (semitransparente) cuando una unidad queda detrás del recurso",
    "MushBoom: los rayos de luz nacen, derivan despacio, se esfuman del todo y reaparecen en otro sitio",
    "Fortaleza WallForge: nueva roca reforzada con placas de acero y remaches",
  ] },
  { v: "v.001618", date: "29/10/2026", title: "Páginas de la Reliquia", items: [
    "Botón de pasar turno: en \"¡Todos listos!\" el icono también gira al pasar el ratón y el botón vuelve a reaccionar al ratón y al pulsarlo mientras palpita",
    "Recursos de escenario: al pasar el puntero por un árbol, roca o mena aparece encima del sprite una pequeña etiqueta plana con su nombre (Árbol, Roca, Metal)",
    "Fortaleza WallForge: segunda variante de árbol (más alto y fino, con troncos retorcidos y rocas reforzadas); salen mezclados al azar",
    "Opciones gráficas reordenadas: modo rendimiento, sombras, efectos ambientales, vegetación, niebla, resolución adaptativa y mostrar FPS",
    "Efectos ambientales: cada escenario tiene su ambiente sutil (MushBoom: tono verdoso, rayos de luz y polen; Rock'n Troll: tono rojizo, ceniza, humo y brasas del volcán; HurryCrane: degradado amarillo/celeste que se desplaza con puntitos de viento; WallForge: tono de acero y pequeños destellos suaves sobre el suelo metálico, las menas, los árboles y las rocas). Se activan o desactivan en Opciones gráficas y el modo rendimiento los apaga solos",
    "Fortaleza WallForge: rocas, árboles y menas de metal propios, reforzados con placas de hierro y refuerzos de madera",
    "Fortaleza WallForge: ambiente de forja, con tono cálido y oscuro sobre el tablero, charcos de luz naranja bajo el altar y los obeliscos y brasas y humo planos (las brasas solo se ven donde hay visión y se apagan con el modo rendimiento); se adapta solo a cualquier tamaño de ventana",
    "Reliquia de WallForge: la IA ahora juega la Reliquia (rompe las cadenas del altar lanzando un gnomo, la coge, recoge páginas, la entrega en su obelisco y persigue al portador rival)",
    "Reliquia de WallForge: las páginas son más numerosas y crecen con el tamaño del mapa (el doble de ese número en total), repartidas con separación y nunca junto a un obelisco",
    "Reliquia de WallForge: lanzar un gnomo a una página lo deshace en ceniza; la página se consume (y sale otra) y el portador de la Reliquia gana 2 puntos si es de tu bando o pierde 2 si es rival",
    "Reliquia de WallForge: descripción del escenario y sus tres mecánicas en la selección de escenario",
    "Reliquia de WallForge: el icono de la mano amarilla se muestra siempre sobre la Reliquia libre; el icono de lanzar sale centrado sobre el sprite del objetivo; el soldado sentado es más grande",
    "Reliquia de WallForge: a los soldados ya no se les puede pegar (solo se marean lanzándoles un gnomo) y al volver la Reliquia al altar se desvanecen y regresan a su posición inicial",
    "Iconos de pegar y lanzar al gnomo recuperan su tamaño y posición anteriores, conservando la animación al pulsarlos",
  ] },
  { v: "v.001614", date: "28/10/2026", title: "Fortaleza WallForge", items: [
    "Reliquia de WallForge, nueva mecánica: al liberarla salen 15 páginas flotando por el mapa en casillas libres (al recoger una sale otra, hasta 30); el portador empieza con 0 puntos y cada página que pisa le suma +2; ya no suma puntos por turno. Al llegar junto a su obelisco cobra los puntos, se los resta a los rivales y las páginas se desvanecen",
    "Fortaleza WallForge: suelo propio por zonas (tierra junto al agua, empedrado como base y suelo metálico alrededor de la Reliquia), dos aguas nuevas y nuevo obelisco para el Equipo Reforjados",
    "Reliquia de WallForge: el indicador de puntos va en un cuadrado irregular como el resto de contadores y la Reliquia acumula como máximo 30 puntos",
    "Reliquia de WallForge: al entregarla, los rivales pierden la misma Gloria que gana quien la entrega (sin bajar de 0, con un \"-N\" junto a tu marcador)",
    "Reliquia de WallForge: lanzar un gnomo al soldado que lleva la Reliquia lo marea y la suelta; a los jugadores portadores no les afecta",
    "Reliquia de WallForge: si cae al suelo, el guardia más cercano la recoge y la lleva al altar mientras los otros dos le cubren; al llegar el altar se resella y el minijuego se reinicia",
    "Reliquia de WallForge: el tercer gnomo deja el altar vacío con la Reliquia flotando encima, más grande, lista para cogerla",
  ] },
  { v: "v.001612", date: "27/10/2026", title: "La Reliquia Paranoica de WallForge", items: [
    "Icono de pegar a una unidad: ahora también se muestra sobre el sprite del rival (salvo que estorbe a un círculo de movimiento); pulsarlo equivale a pulsar la mira del suelo",
    "TrazaFlechas: retrato del círculo de información recolocado y con el mismo encuadre que el resto de personajes",
    "Guardias de WallForge: se les puede lanzar un gnomo para aturdirlos (+5 al gnomo); animación idle de guardias y altar; la marcha de soldados suena sin fanfarria",
    "Equipo Reforjados: el círculo de selección de objetivo de la habilidad del MagoNífico (y de la flecha) ya no tiene borde negro y aparece por debajo del sprite del rival",
    "Reliquia de WallForge: más pequeña (2/3), con sombra, resolución adaptativa, reacción al ratón y niebla como el resto del escenario; solo se ve (junto a sus guardias) dentro del campo de visión; para abrirla hay que estrellar 3 gnomos contra ella (rompen una cadena, la otra y la desencadenan); emite ondas naranjas en perspectiva que se aceleran con cada golpe y cesan al cogerla; marcha de soldados al moverse los guardias; quien lleve la Reliquia, y lo que ve, es visible para todos",
    "Guardias de WallForge: nuevo sprite de guardia mareado, con estrellitas girando sobre su cabeza mientras dura el aturdimiento",
    "Fortaleza WallForge jugable (en pruebas, solo partida local) con su banda sonora y la mecánica La Reliquia Paranoica: tres guardias inmortales custodian el altar sellado; lanza un gnomo con 10 puntos para romper las cadenas, llévate la Reliquia hasta tu obelisco y sé el blanco de todos los guardias",
    "Fortaleza WallForge: nueva ilustración de la isla (con los estandartes naranjas de Reforjados) en la selección de escenario",
    "Poblado HurryCrane: nueva ilustración de la isla en la selección de escenario",
  ] },
  { v: "v.001605", date: "26/10/2026", title: "Muro Aplastante en área", items: [
    "Colores de escenario: Colinas Rock'n Troll en rojo y Fortaleza WallForge en naranja (el de Reforjados)",
    "El Equipo Forjamuros pasa a llamarse Equipo Reforjados",
    "Nuevo escenario Fortaleza WallForge en el selector de escenarios (aún bloqueado, con el botón en \"Próximamente\")",
    "Equipo Reforjados: nueva Flecha Rastreadora de la TrazaFlechas: la flecha es idéntica a la de su sprite (contorno negro irregular), sale con estela de rayas y chispas, se queda clavada en el rival vibrando de vez en cuando y deja dos ondas naranjas concéntricas en bucle bajo sus pies en lugar de la retícula",
    "Equipo Reforjados: TrazaFlechas un poco menos grande en el tablero",
    "Equipo Reforjados: nuevos efectos del Cambiazo: ondas expansivas bajo los pies (detrás de los sprites) y chispas caóticas que nacen transparentes; los intercambiados llevan dos ondas azules concéntricas en bucle hasta que vuelven a su sitio",
    "Equipo Reforjados: los efectos del Cambiazo (círculo mágico, runas, chispas y aro bajo los intercambiados), el humo del Muro Aplastante y las esquirlas de las habilidades ya no llevan borde negro",
    "Equipo Reforjados: el Muro Aplastante del PortaMuros ahora es en área: clava su nuevo escudo en el suelo y la onda aplasta a todos los rivales de las 8 casillas que lo rodean (1 de daño, sueltan el gnomo que lleven y quedan inactivos una ronda, tirados en el suelo hasta que se inflan de nuevo); el suelo salta en ondas y las piedras rebotan",
  ] },
  { v: "v.001599", date: "25/10/2026", title: "Tutoriales y rendimiento", items: [
    "El Equipo Enmurallado pasa a llamarse Equipo Forjamuros",
    "Móvil: atrás con el botón/gesto de Android y deslizando desde el borde izquierdo hacia el centro (cierra ventanas, vuelve en los menús, cancela la selección o abre la pausa; en el menú principal pide pulsar otra vez para salir)",
    "Móvil en horizontal: la partida empieza algo más alejada con el Obelisco entero a la vista y las tarjetas de unidad de la selección de equipo ya no quedan cortadas",
    "Equipo Enmurallado: nuevo sprite del obelisco",
    "Tutoriales: la cámara encuadra cada paso con un único movimiento (zoom y desplazamiento a la vez), deja el plano centrado en la zona libre y ya no se corrige a saltos al ir descubriendo unidades lejanas",
    "Tutoriales: el check de tutorial completado va dentro de un cuadrado irregular, y el indicador de gloria (30/30) no se anima durante el tutorial, así que ya no mueve la ventana de Nizak en móvil",
    "Calibración aplicada: recortes de cara (Enmurallado), botones de acción y posiciones del gnomo (idle, machaca y pegar) para todos los personajes",
    "Equipo Enmurallado: TrazaFlechas y PortaMuros algo menos grandes en el tablero",
    "Selección de equipo: la TrazaFlechas se dibuja por delante de MagoNífico y PortaMuros cuando no está seleccionada",
    "Equipo Enmurallado: el rival aplastado por el Muro Aplastante suelta el gnomo que llevara cogido",
    "Equipo Enmurallado: TrazaFlechas y PortaMuros mucho más grandes en el tablero; Flecha Rastreadora y Cambiazo dejan elegir objetivo pulsando la casilla de cada rival válido; si el Cambiazo deja a un rival en el agua sin Anfibio, se ahoga",
    "Nuevo equipo: Equipo Enmurallado (su logo es el trofeo de la muralla en la selección de equipo) (color naranja) con MagoNífico, TrazaFlechas y PortaMuros — Flecha Rastreadora (marca al rival y ves lo que ve), Cambiazo (intercambia sitio con un rival y al final del turno vuelven) y Muro Aplastante (1 de daño y deja inactivo al rival una ronda), con efectos y sonidos propios; también los usa la IA y se sincronizan en multijugador",
    "Tutorial Poblado HurryCrane: diálogos actualizados con tus textos nuevos y el inglés revisado",
    "Tutorial Colinas Rock'n Troll: diálogos actualizados con tus textos nuevos; el inglés de MushBoom y Rock'n Troll revisado para que coincida con el español (y las variantes con mando ajustadas)",
    "Tutoriales: la selección de tutoriales marca con un check verde en la esquina los que ya has completado (saltarlos no cuenta); se pueden repetir siempre que quieras",
    "Tutoriales: la cámara ya no se mueve entre diálogos sin necesidad — solo se desplaza cuando lo que hay que mirar queda tapado o fuera de pantalla, y entonces lo mínimo; ya no reacciona a que la viñeta cambie de tamaño ni a los marcadores que aparecen y desaparecen",
    "Tutorial Bosque MushBoom: diálogos actualizados con tus textos nuevos (y las variantes con mando ajustadas)",
    "Tutoriales MushBoom, Rock'n Troll y HurryCrane: se aplican las mejoras de «Primeros pasos» — la flecha de la guía se apaga en cuanto estampas o lanzas al gnomo, y las réplicas, el botón «Saltar tutorial» y las correcciones generales ya valen para los cuatro",
    "Tutorial HurryCrane: corregido que la misión «Lánzale a Tinkle contra el huevo» no se pudiera completar (sin un rebote el huevo no se cargaba); ahora hay un bumper delante del huevo",
    "Tutorial HurryCrane: textos con mando (cruceta y botón de confirmar) para los pasos de coger y lanzar gnomos",
    "Inglés: los nombres inventados de unidades y reliquias ahora tienen traducción con su juego de palabras (BarkGolem, ForestStrider, ThunderSpore, GnomeLauncher, BrainRummager, RockFist, StickyFingers, ShootingWing, NestBot, MountainTrotter Boots, GnomePetter, Pheromgnomes, Lucky Gnoin y el equipo CloudSailers); el español no cambia",
    "SurcaBosques: sprites con un poco menos de saturación (82 %) para que encaje mejor con el resto del equipo",
    "Corregido: una unidad podía quedarse para siempre con el sprite de «pegar al gnomo» estando en reposo (al cambiar la resolución adaptativa tras un golpe, la imagen de reposo no se restauraba bien)",
    "Los botones de habilidad propia, golpear gnomo y lanzar gnomo ahora reaccionan al clic: se hunden al pulsar, rebotan con una pequeña animación y suenan al seleccionarlos (también con el mando)",
    "Tutorial: al lanzar el gnomo (pase o sacrificio) la flecha que señalaba el icono de lanzar desaparece en cuanto sale volando, en vez de quedarse activa",
    "Tutoriales: el rótulo «Saltar tutorial» ahora queda pegado a la viñeta de Nizak (antes se quedaba lejos, anclado al retrato)",
    "Corregido: en el tutorial, al conquistar el tótem, el primer clic movía a la otra unidad (la del cofre seguía seleccionada); ahora el portador del gnomo entra ya seleccionado. Y el puntero del mazo de conquista ya es rojo de verdad",
    "Nuevo cartel central en el turno del rival: «TURNO DEL RIVAL» (con varios rivales, «TURNO DEL RIVAL 1», «2»... cada uno de su color: rojo, naranja y morado); en multijugador muestra el nombre del jugador que está en su turno, también cuando empieza él",
    "Tutorial «Primeros pasos»: el charco de agua del sacrificio ahora aparece a la altura de tus unidades, a su lado y bien a la vista, en vez de detrás de los iconos del Obelisco, para ver mejor la muerte del gnomo",
    "Corregido: en el tutorial «Primeros pasos» se saltaba el diálogo de elegir a TruenoEspora al abrir Reclutar (venía preseleccionado y la misión se daba por hecha); ahora espera a que lo pulses",
    "Corregido: en el tutorial «Primeros pasos», si pulsabas fuera mientras esperabas a continuar, se cancelaba la colocación del recluta y no aparecía ninguna casilla — ahora el tutorial no la cancela y, si ocurriera, te guía de nuevo por Reclutar",
    "Conquistar un tótem: el puntero pasa de la bandera roja a un mazo rojo (mismo grosor de trazo que el resto de punteros), también con el cursor del mando",
    "Tutorial «Primeros pasos»: diálogos actualizados con corrección ortográfica y de inglés, y los textos de las variantes con mando de los tres tutoriales vuelven a coincidir con los diálogos",
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

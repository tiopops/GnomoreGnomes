# Gnomore Gnomes — instrucciones de proyecto

Este archivo es para Claude: recoge cómo se trabaja en este proyecto para que cualquier sesión futura
siga el mismo flujo sin que Jesús tenga que volver a explicarlo. Es un documento operativo (el "cómo");
el diseño del juego en sí (el "qué") vive en `Claude outputs/documento_diseno_juego.pdf` — léelo primero
si necesitas contexto de diseño, y mantenlo actualizado cuando cambie algo relevante de la arquitectura
o el alcance (ver última sección).

## Quién es Jesús y cómo da feedback

Jesús no escribe código: todo el proyecto se construye a través de Claude. Da feedback casi siempre con
capturas de pantalla y mensajes cortos y directos ("el icono es demasiado pequeño", "esto no funciona
bien"), a veces varios seguidos mientras Claude sigue trabajando en otra cosa — hay que releer el hilo
antes de dar algo por terminado, por si ha mandado más de un mensaje. Prueba siempre en local antes de
confirmar que algo está arreglado.

## Reglas de oro (resumen operativo — la lista completa y con contexto está en el documento de diseño)

1. Un archivo por mecánica. Ninguna mecánica debe necesitar conocer el funcionamiento interno de otra.
2. Preparado para varios idiomas, fácil de exportar a APK/Steam, fácil de portar — pensarlo desde el
   principio, no añadirlo después.
3. Interfaz y controles cómodos e intuitivos en cualquier dispositivo (escritorio/móvil), con soporte de
   Gamepad contemplado desde el principio.
4. Retroalimentación constante: todo lo que ocurra en el juego necesita sonido y/o animación — es la
   regla que más se repite y la que Jesús más señala cuando falta.
5. Escalabilidad fácil en todas las mecánicas (añadir una raza, una unidad, un tipo de loseta nuevo no
   debería tocar código no relacionado).
6. Iconos Phosphor en toda la interfaz.
7. Nivel Triple A en todo — no hay atajos "de prototipo", ni siquiera en fase sandbox.

## Arquitectura de código

- Patrón concreto para mecánicas de unidad (movimiento, combate, y lo que se añada después): un archivo
  "núcleo" (`js/units.js`) que sabe crear/pintar/seleccionar/mover unidades y expone utilidades
  compartidas, y mecánicas sueltas (`js/movement.js`, `js/combat.js`, futuras) que se registran ante el
  núcleo como "proveedores de rango" (`Units.registerRangeProvider`). El núcleo nunca conoce las
  mecánicas concretas; las mecánicas nunca se conocen entre sí. Sigue este mismo patrón al añadir una
  mecánica nueva sobre unidades en vez de tocar units.js o los archivos de otras mecánicas.
- Las funciones de posicionamiento sobre el tablero (`getTileTopLeft`, `getTileCenter`, en
  `js/mapgen.js`) son la única fuente de verdad para "dónde cae una loseta en pantalla" — cualquier
  archivo nuevo que necesite esa posición las reutiliza, nunca duplica la fórmula.
- Nota de CSS ya aprendida dos veces en este proyecto: nunca mezclar una `@keyframes` con
  `fill:forwards` y una `transition` sobre la misma propiedad (normalmente `transform`) en el mismo
  elemento — el navegador las sigue disputando incluso después de terminar la animación, y se ve como
  parpadeos. Usar transición pura + toggle de clase para estados de aparición/hover.
- Nota de rendimiento ya aprendida: un `filter` (drop-shadow, etc.) sobre un elemento cuyo `transform`
  se anima constantemente (p. ej. la respiración de una unidad) fuerza repintado por software en cada
  frame y se ve como pérdida de calidad/blur al mover el ratón. El filtro debe vivir en un elemento
  padre estable que solo cambie de transform puntualmente.

## Entorno de trabajo y flujo de entrega

- El proyecto vive en el escritorio de Jesús (carpeta `Gnomore Gnomes`), conectado a la sesión de Claude
  vía el puente a su ordenador. Cuando esté conectado, escribe los archivos directamente ahí en vez de
  generar zips o pedirle que copie/pegue nada.
- Después de escribir o sobrescribir un archivo YA EXISTENTE en su carpeta, vuelve a leerlo (stage) y
  compara el contenido byte a byte contra lo que se acaba de enviar antes de confirmarle a Jesús que está
  hecho. Este proyecto ha sufrido reversiones silenciosas de archivos varias veces (probablemente por
  sincronización de OneDrive u otro proceso de fondo) — un "escrito con éxito" de la herramienta no es
  prueba suficiente de que el contenido se quedó así.
- Si el puente al ordenador está caído: no le digas que abra la app de escritorio (no ayuda). Dile
  claramente que no puedes llegar a su ordenador ahora mismo, y entrégale los archivos como descarga
  mientras tanto; ofrece aplicarlos directamente en cuanto la conexión vuelva.
- Entrega final a GitHub: Jesús hace doble clic en `subir.bat` (opción 2, "Gnomore Gnomes") y ese script
  hace el commit/push él mismo — Claude no hace push directo (el proxy de git de este entorno lo bloquea
  de todas formas).
- El repo es público: `tiopops/GnomoreGnomes`, servido por GitHub Pages en
  `https://tiopops.github.io/GnomoreGnomes/`.

## Verificación antes de dar algo por terminado

- Sirve el proyecto en local (`python3 -m http.server`) y pruébalo con Playwright antes de entregarlo:
  simula la interacción real (clics, hover, secuencias completas de juego), no solo una inspección
  visual. Comprueba también la consola del navegador (0 errores esperado).
- Para bugs de posicionamiento/CSS, verificar contra la fórmula real (p. ej. que la posición de un
  marcador coincide exactamente con `getTileCenter(...)`) es más fiable que "se ve bien" a ojo.
- Para cualquier reorganización de código sin cambio de comportamiento pretendido (un refactor), haz una
  pasada de regresión completa de todo lo que ya funcionaba antes, no solo de la parte tocada — el riesgo
  de romper algo existente es real aunque la intención sea no cambiar nada de cara al jugador.
- Limitación conocida de este entorno de pruebas: el CDN de iconos Phosphor (unpkg.com) está bloqueado en
  el sandbox de Claude, así que el propio glyph no se puede ver en una captura tomada aquí — para ese
  caso, verificar por estilos computados (tamaño/color/posición) en vez de por captura, y aclarárselo a
  Jesús si hace falta una comprobación visual real (por ejemplo generando una réplica HTML aparte con un
  icono sustituto, como se hizo para comprobar el centrado de la mira de ataque).

## Mantener este documento y el de diseño al día

Cuando se tome una decisión de diseño nueva, se cierre algo que estaba abierto, o se reorganice la
arquitectura de forma significativa (como el cambio a "proveedores de rango" de movimiento/combate),
actualiza `Claude outputs/documento_diseno_juego.pdf` (el script fuente está en
`gnomeball-doc/build_pdf.py` en el entorno de Claude) y este archivo si el cambio afecta a cómo se
trabaja, no solo a qué se ha construido.

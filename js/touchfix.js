/* Gnomore Gnomes — arreglos generales de tacto en móvil.
   Regla de oro: un archivo por mecánica. Este archivo no añade ninguna
   mecánica de juego, solo arreglos de comportamiento del NAVEGADOR en
   pantallas táctiles.

   Pedido explícito: "cuando dejo pulsado sobre un elemento en la interfaz
   del smartphone para ver el mensaje de mouseover, me aparecen las
   opciones del navegador para descargar o ver el png de la imagen entre
   otras opciones del propio navegador" — el menú contextual nativo
   (mantener pulsado sobre una imagen/sprite) se dispara durante el propio
   long-press que este juego usa para mostrar el tooltip (ver
   js/tooltip.js). Se desactiva por completo dentro del tablero y la
   interfaz de juego con -webkit-touch-callout (ver style.css) más este
   preventDefault sobre el evento "contextmenu" como red de seguridad para
   navegadores que no respeten esa propiedad CSS. */
document.addEventListener(
  "contextmenu",
  (e) => {
    if (e.target && e.target.closest && e.target.closest("#board-tiles, .screen")) {
      e.preventDefault();
    }
  },
  { capture: true }
);

/* NOTA sobre "sigo teniendo que hacer doble clic con mi dedo para casi todo
   en la interfaz desde el smartphone" (investigación): NO es el clásico
   "hover fantasma" de Safari/iOS — ese ya estaba arreglado desde antes con
   el listener de touchstart vacío al principio de index.html (ver el
   comentario de esa sección) y con touch-action:manipulation en
   html,body (ver style.css). La causa real, encontrada al fin, era otra:
   js/boardview.js usaba el mismo margen de tolerancia "¿esto es un
   arrastre de cámara o un clic quieto?" (antes 4px) tanto para ratón como
   para dedo. Un dedo sobre una pantalla capacitiva tiembla mucho más que
   un ratón al quedarse quieto, así que ese temblor normal de CUALQUIER
   toque superaba los 4px, se marcaba como "arrastre de cámara" y el
   propio guardia anti-arrastre anulaba el "click" de ESE MISMO toque
   (pensado para no deseleccionar al soltar tras arrastrar la cámara de
   verdad) — el jugador solo lo notaba como que hacía falta tocar dos
   veces. Arreglado en boardview.js con un margen propio y mayor para
   dedo (TOUCH_DRAG_THRESHOLD_PX), sin tocar el de ratón. Se deja esta nota
   aquí, en el archivo dedicado a arreglos táctiles, para que quien lea
   este archivo primero encuentre el rastro hasta la causa real. */

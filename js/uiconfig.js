/* Gnomore Gnomes — configuración compartida de la interfaz fija (círculo de
   información del personaje + botones de acción del gnomo).

   Un único sitio para estos números porque unos dependen de los otros: los
   botones de golpear/pasar (js/gnome.js) se reparten en semicírculo
   ALREDEDOR del círculo de información (js/unitinfo.js), así que si el
   tamaño o la posición de ese círculo cambian, la disposición de los
   botones de acción tiene que recalcularse a partir de esos mismos
   valores — de ahí que ambos archivos lean este objeto en vez de tener
   cada uno sus propios números sueltos.

   IMPORTANTE: infoCircle/infoCircleMobile deben coincidir a mano con las
   reglas .unit-info-btn (y su variante dentro de @media max-width:480px)
   en style.css — ese CSS sigue siendo quien de verdad posiciona el
   círculo; este objeto es solo la copia que gnome.js necesita en JS para
   poder calcular ángulos con trigonometría. Misma idea que
   GNOME_LAND_IMPACT_MS teniendo que coincidir con su @keyframes.

   Calibrado con debug/calibrar-char.html — esa herramienta genera el
   bloque de código listo para pegar aquí si hace falta reajustar tamaño,
   radio o ángulos. */

const UI_LAYOUT = {
  infoCircle: {
    left: 20,
    bottom: 20,
    size: 110,
  },
  infoCircleMobile: {
    left: 14,
    bottom: 14,
    size: 110,
  },
  // Botones de acción del gnomo (golpear / pasar), repartidos en
  // semicírculo a la derecha del círculo de información. Ángulos en
  // grados, medidos desde el centro del círculo principal: 0° = justo a
  // su derecha, negativo = hacia arriba, positivo = hacia abajo. Con más
  // de un botón se reparten a espacios iguales entre startAngle y
  // endAngle (ver Gnome._positionActionButtons).
  //
  // El reparto NO es simétrico a propósito: el círculo principal está a
  // solo "bottom: 20px" del borde de la pantalla, así que hacia abajo hay
  // muy poco margen antes de salirse de la ventana — un ángulo grande
  // hacia abajo (endAngle) deja el botón de pasar cortado por el borde.
  // Hacia arriba sobra pantalla de sobra, así que el abanico se inclina
  // más hacia arriba (startAngle más negativo) que hacia abajo (endAngle
  // pequeño), mientras se sigue viendo como un semicírculo a la derecha.
  // hitSize/passSize por separado (pedido explícito: "quiero que se pueda
  // ajustar de manera individual el tamaño de los botones de habilidades
  // normales y especiales desde debug") — antes un único "size" compartido
  // por golpear y pasar; radius/startAngle/endAngle (la POSICIÓN del
  // semicírculo) se quedan compartidos porque nadie pidió tocar eso, solo
  // el tamaño de cada botón por separado.
  actionButtons: {
    hitSize: 51,
    passSize: 51,
    radius: 94,
    startAngle: -22,
    endAngle: 18,
  },
  // Botón de habilidad especial (js/abilities.js) — mismo círculo de
  // información como centro y mismo radio que actionButtons, pero en su
  // PROPIO ángulo, bastante más arriba que el abanico de golpear/pasar
  // (-34°/11°, siempre a la derecha): así nunca colisiona con esos dos
  // botones aunque un personaje lleve el gnomo cogido Y tenga además una
  // habilidad sin gastar al mismo tiempo. Hacia arriba porque, como ya
  // explica actionButtons más arriba, hacia abajo apenas queda margen
  // antes del borde de la pantalla.
  // size a 64 (subido desde 51, pedido explícito: "los iconos de las
  // habilidades especiales siguen siendo pequeños respecto al de las
  // habilidades normales") — ahora calibrable a mano desde
  // debug/calibrar-char.html (sección "Botón de habilidad especial"), que
  // genera este mismo bloque listo para pegar si hace falta ajustarlo más.
  abilityButton: {
    size: 64,
    radius: 94,
    angle: -56,
  },
};

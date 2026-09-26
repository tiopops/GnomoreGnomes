/* Gnomore Gnomes — razas jugables.
   Regla de oro: escalabilidad fácil — añadir una raza nueva es añadir un objeto aquí,
   la pantalla de selección la pinta automáticamente. */

const RACES = [
  {
    id: "mushboom_forest",
    nameKey: "race_mushboom_forest",
    // Pedido explícito (segunda pasada): "te dije que ahora queria
    // CARTAS!!! formato carta de juego de rol donde aparezca en grande el
    // logo de cada raza y explicacion detallada de cada una de ellas" — el
    // antiguo descKey (una sola frase corta) se separa en 3 campos que la
    // carta pinta cada uno en su propio bloque (ver renderRaceCard en
    // js/newgame-flow.js): flavorKey (frase de ambientación/nombres de los
    // personajes), virtuesKey y weaknessesKey (explicación detallada de
    // cada uno, con su propio icono en la carta).
    flavorKey: "race_mushboom_forest_flavor",
    virtuesKey: "race_mushboom_forest_virtues",
    weaknessesKey: "race_mushboom_forest_weaknesses",
    // Pedido explícito: "elminiamos el icono cutre de phospor que havia y
    // colocamoes los botones con...una pequeña explicacion de las virtudes
    // y desventajas de cada equipo junto a su icono" — se sustituye el
    // icono de Phosphor (ph-leaf, un simple glifo genérico) por la
    // ilustración real de la mascota del equipo que subió el usuario.
    // icon se deja igualmente como respaldo por si algún día falta la imagen.
    icon: "ph-leaf",
    iconImg: "assets/iconos/equipo_mushboom.png",
    color: "#8fbf4d",
    available: true,
    // Icono de los Puntos de Gloria (ver js/glory.js) para ESTA raza en
    // concreto — pedido explícito: "un icono distinto para cada raza".
    gloryIcon: "assets/iconos/gloria_mushboom_forest.png",
  },
  {
    id: "colinas_rockntroll",
    nameKey: "race_colinas_rockntroll",
    flavorKey: "race_colinas_rockntroll_flavor",
    virtuesKey: "race_colinas_rockntroll_virtues",
    weaknessesKey: "race_colinas_rockntroll_weaknesses",
    icon: "ph-mountains",
    iconImg: "assets/iconos/equipo_rockntroll.png",
    color: "#8a8f99",
    available: true,
    gloryIcon: "assets/iconos/gloria_colinas_rockntroll.png",
  },
];

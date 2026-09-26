/* Gnomore Gnomes — razas jugables.
   Regla de oro: escalabilidad fácil — añadir una raza nueva es añadir un objeto aquí,
   la pantalla de selección la pinta automáticamente. */

const RACES = [
  {
    id: "mushboom_forest",
    nameKey: "race_mushboom_forest",
    descKey: "race_mushboom_forest_desc",
    // Pedido explícito: "elminiamos el icono cutre de phospor que havia y
    // colocamoes los botones con...una pequeña explicacion de las virtudes
    // y desventajas de cada equipo junto a su icono" — se sustituye el
    // icono de Phosphor (ph-leaf, un simple glifo genérico) por la
    // ilustración real de la mascota del equipo que subió el usuario.
    // iconImg tiene prioridad sobre icon en renderOptionCard (js/newgame-flow.js);
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
    descKey: "race_colinas_rockntroll_desc",
    icon: "ph-mountains",
    iconImg: "assets/iconos/equipo_rockntroll.png",
    color: "#8a8f99",
    available: true,
    gloryIcon: "assets/iconos/gloria_colinas_rockntroll.png",
  },
];

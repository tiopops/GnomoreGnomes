/* Gnomore Gnomes — razas jugables.
   Regla de oro: escalabilidad fácil — añadir una raza nueva es añadir un objeto aquí,
   la pantalla de selección la pinta automáticamente. */

const RACES = [
  {
    id: "mushboom_forest",
    nameKey: "race_mushboom_forest",
    descKey: "race_mushboom_forest_desc",
    // "ph-mushroom" no existe en el set de Phosphor que usamos (por eso no
    // salía ningún icono, solo el hueco vacío) — comprobado también que
    // "ph-tree" tampoco existe; ph-leaf sí está en el set y pega igual de
    // bien con un equipo de bosque.
    icon: "ph-leaf",
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
    color: "#8a8f99",
    available: true,
    gloryIcon: "assets/iconos/gloria_colinas_rockntroll.png",
  },
];

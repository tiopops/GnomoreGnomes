/* Gnomore Gnomes — niveles (fases) jugables.
   Regla de oro: escalabilidad fácil — añadir un nivel nuevo es añadir un objeto aquí;
   la pantalla de selección de nivel (js/newgame-flow.js) lo pinta automáticamente.
   Un nivel es el ESCENARIO/mecánicas donde se juega; la raza (js/races.js) es quién juegas.
   - Bosque MushBoom: setas explosivas, Altar de Sacrificios (barra de ofrendas
     por jugador) y GnomOgro. Los arbustos NO son exclusivos de un nivel: todos
     los niveles los tendrán, así que no se anuncian en la descripción.
   - Colinas Rock'n Troll: se desarrollará más adelante con otras mecánicas
     (available:false -> se muestra bloqueado como "Próximamente"). */

const LEVELS = [
  {
    id: "mushboom_forest",
    nameKey: "level_mushboom_forest",
    flavorKey: "level_mushboom_forest_flavor",
    featureKeys: ["level_mushboom_forest_f1", "level_mushboom_forest_f2", "level_mushboom_forest_f3"],
    featureIcons: ["ph-bomb", "ph-skull", "ph-sword"],
    islandImg: "assets/niveles/isla_mushboom_forest.png",
    logoImg: "assets/niveles/logo_mushboom_forest.png",
    color: "#8fbf4d",
    available: true,
  },
  {
    id: "colinas_rockntroll",
    nameKey: "level_colinas_rockntroll",
    flavorKey: "level_colinas_rockntroll_flavor",
    featureKeys: [],
    featureIcons: [],
    islandImg: "assets/niveles/isla_colinas_rockntroll.png",
    logoImg: "assets/niveles/logo_colinas_rockntroll.png",
    color: "#8a8f99",
    available: false,
  },
];

function getLevel(id) {
  return LEVELS.find((l) => l.id === id) || LEVELS[0];
}

/* Gnomore Gnomes — flujo de "Nueva Partida": modo -> raza -> nº de rivales -> escenario.
   Regla de oro: un archivo por mecánica — este solo gestiona la navegación entre pantallas
   y arranca la partida; el motor de juego real (turnos, gnomos, IA) irá en sus propios archivos. */

const screenHistory = ["main-menu"];

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => {
    s.classList.toggle("screen--active", s.id === id);
  });
}

function goToScreen(id) {
  screenHistory.push(id);
  showScreen(id);
}

function goBack() {
  if (screenHistory.length > 1) screenHistory.pop();
  showScreen(screenHistory[screenHistory.length - 1]);
}

const matchDraft = { modeId: null, raceId: null, opponents: null };

function renderOptionCard({ icon, title, desc, onClick, color }) {
  const card = document.createElement("button");
  card.className = "option-card";
  if (color) card.style.setProperty("--card-accent", color);
  card.innerHTML = `
    <i class="ph ${icon} option-card__icon"></i>
    <span class="option-card__title">${title}</span>
    ${desc ? `<span class="option-card__desc">${desc}</span>` : ""}
  `;
  card.addEventListener("click", onClick);
  return card;
}

function populateModeSelect() {
  const list = document.getElementById("mode-list");
  list.innerHTML = "";
  GAME_MODES.filter((m) => m.available).forEach((mode) => {
    list.appendChild(
      renderOptionCard({
        icon: mode.icon,
        title: I18N.t(mode.nameKey),
        desc: I18N.t(mode.descKey),
        onClick: () => {
          matchDraft.modeId = mode.id;
          populateRaceSelect();
          goToScreen("screen-race-select");
        },
      })
    );
  });
}

function populateRaceSelect() {
  const list = document.getElementById("race-list");
  list.innerHTML = "";
  RACES.filter((r) => r.available).forEach((race) => {
    list.appendChild(
      renderOptionCard({
        icon: race.icon,
        title: I18N.t(race.nameKey),
        desc: I18N.t(race.descKey),
        color: race.color,
        onClick: () => {
          matchDraft.raceId = race.id;
          populateOpponentSelect();
          goToScreen("screen-opponent-select");
        },
      })
    );
  });
}

function populateOpponentSelect() {
  const list = document.getElementById("opponent-list");
  list.innerHTML = "";
  OPPONENT_OPTIONS.forEach((n) => {
    const label = I18N.t(n === 1 ? "opponents_label" : "opponents_label_plural", { n });
    list.appendChild(
      renderOptionCard({
        icon: "ph-users-three",
        title: label,
        onClick: () => {
          matchDraft.opponents = n;
          startMatch(matchDraft);
        },
      })
    );
  });
}

function startMatch({ modeId, raceId, opponents }) {
  const size = getBoardSize(opponents);
  const map = generateMap(size);

  SaveGame.save({
    modeId,
    raceId,
    opponents,
    size,
    tiles: map.tiles,
    createdAt: Date.now(),
  });

  renderMap(map, document.getElementById("board-tiles"));
  // Terreno real (js/mapgen.js) — DESPUÉS de renderMap (necesita que los
  // overlays .tile__terrain-reveal ya existan en el DOM para cachearlos,
  // igual que Fog.init) y ANTES de spawnTestUnits (que ya necesita poder
  // consultar TerrainMap.isWalkable para no colocar rivales/gnomos sobre
  // agua).
  if (typeof TerrainMap !== "undefined") TerrainMap.init(map);
  spawnTestUnits(size, raceId);
  showScreen("screen-board");
  screenHistory.length = 0;
  screenHistory.push("main-menu", "screen-board");
  syncBoardCamera();

  const resumeBtn = document.getElementById("btn-resume-game");
  if (resumeBtn) resumeBtn.disabled = false;
}

function resumeMatch() {
  const saved = SaveGame.load();
  if (!saved || !saved.tiles) return;
  const map = { size: saved.size, tiles: saved.tiles };
  renderMap(map, document.getElementById("board-tiles"));
  if (typeof TerrainMap !== "undefined") TerrainMap.init(map);
  spawnTestUnits(saved.size, saved.raceId);
  showScreen("screen-board");
  screenHistory.length = 0;
  screenHistory.push("main-menu", "screen-board");
  syncBoardCamera();
}

// Coloca los 3 tipos de unidad del equipo de la raza elegida, uno junto a
// otro cerca del centro del tablero (ver UNIT_TYPES en units.js — el orden
// en el que aparecen ahí es el mismo con el que se colocan aquí), más el
// equipo RIVAL: la otra raza que el jugador NO escogió, con su propio arte
// (ya no hace falta el tinte rojo de antes, "de momento solo hay arte de un
// mismo tipo" — pedido explícito: "no pongas a mi mismo equipo con los
// colores cambiados... coloca al otro equipo que queda libre y no escogí").
// El roster se calcula filtrando UNIT_TYPES por raceId en vez de tener una
// lista fija: así un personaje nuevo que se añada a una raza aparece aquí
// solo, sin tocar este archivo.
function spawnTestUnits(size, raceId) {
  if (typeof Units === "undefined") return;
  const boardTiles = document.getElementById("board-tiles");
  Units.init(boardTiles, size);
  const mid = Math.floor(size / 2);

  const roster = Object.keys(UNIT_TYPES).filter((typeId) => UNIT_TYPES[typeId].raceId === raceId);
  // Si por lo que sea no hay raza válida (partida guardada antigua sin
  // raceId, etc.) se cae de vuelta al roster de Mushboom Forest de siempre
  // en vez de dejar el tablero sin personajes del jugador.
  const finalRaceId = roster.length > 0 ? raceId : "mushboom_forest";
  const finalRoster = roster.length > 0
    ? roster
    : Object.keys(UNIT_TYPES).filter((typeId) => UNIT_TYPES[typeId].raceId === "mushboom_forest");

  // La raza rival es la que "queda libre": cualquier otra disponible en
  // RACES que NO sea la que el jugador acaba de elegir — con solo 2 razas
  // ahora mismo siempre es "la otra", pero esto sigue funcionando igual el
  // día que haya una tercera (coge la primera libre en vez de asumir que
  // solo hay dos). Si por lo que sea no hay ninguna otra raza disponible
  // (partida con una sola raza cargada) se cae de vuelta a la MISMA raza del
  // jugador en vez de dejar el tablero sin rivales — único caso en el que
  // vuelve a tocar spawnear "la misma raza", y solo como último recurso.
  const enemyRace = (typeof RACES !== "undefined" ? RACES : []).find(
    (r) => r.available && r.id !== finalRaceId
  );
  const enemyRoster = enemyRace
    ? Object.keys(UNIT_TYPES).filter((typeId) => UNIT_TYPES[typeId].raceId === enemyRace.id)
    : finalRoster;

  // Mismas 3 casillas relativas al centro que se usaban antes — de momento
  // solo hay razas con 3 personajes, así que alcanza con 3 posiciones fijas.
  const spawnSpots = [
    { row: mid, col: mid },
    { row: mid, col: mid - 1 },
    { row: mid - 1, col: mid },
  ];
  // Niebla de guerra (js/fog.js): TODO el mapa arranca oculto — hay que
  // inicializarla ANTES de revelar nada, y DESPUÉS de renderMap (llamado
  // por quien invoque a esta función, ver startMatch/resumeMatch más
  // arriba), que es quien crea las losetas .tile/.tile__fog que Fog.init
  // necesita cachear.
  if (typeof Fog !== "undefined") Fog.init(size, boardTiles);

  finalRoster.forEach((typeId, i) => {
    const spot = spawnSpots[i] || spawnSpots[spawnSpots.length - 1];
    Units.spawnTestUnit(spot.row, spot.col, typeId);
    // Revelado inicial FIJO alrededor de cada personaje del jugador (pedido
    // explícito: "cuando inicia el juego 2 losetas alrededor de cada
    // personaje de radio están reveladas") — NO se revela nada alrededor
    // del rival: la niebla es la del jugador, no la suya.
    if (typeof Fog !== "undefined") Fog.revealInitial(spot.row, spot.col);
  });

  // El equipo rival se coloca en su propio bucle (roster independiente del
  // jugador: puede tener otro número de personajes el día que las razas no
  // tengan siempre 3) en casillas al azar del tablero, como ya hacía antes.
  enemyRoster.forEach((typeId) => {
    Units.spawnRandomEnemy(typeId);
  });

  // Los gnomos (js/gnome.js): PUEDE HABER VARIOS a la vez (pedido
  // explícito, "de echo para hacer pruebas pon 3 gnomos en la partida de
  // pruebas") — Gnome.resetAll() detiene primero los temporizadores de los
  // de la partida anterior (si los había) y vacía la lista antes de crear
  // los nuevos. spawnNear busca la loseta libre más próxima a cada punto si
  // esa ya está ocupada (por los personajes de arriba, por un rival o por
  // otro gnomo ya colocado — nunca pueden coincidir dos gnomos en la misma
  // casilla), así que basta con pedir puntos de partida sin calcular a mano
  // qué queda libre. Posiciones AL AZAR en todo el tablero (pedido
  // explícito: "al iniciar la fase de pruebas los gnomos aparecen en
  // posiciones aleatorias del mapa") — pueden caer bajo niebla sin
  // problema, es parte de la gracia de explorar: se descubren al revelarse
  // esa zona, igual que un rival.
  if (typeof Gnome !== "undefined") {
    Gnome.resetAll();
    for (let i = 0; i < 3; i++) {
      const row = Math.floor(Math.random() * size);
      const col = Math.floor(Math.random() * size);
      Gnome.spawnNear(row, col);
    }
  }

  // Turnos (js/turns.js) — se resetea AL FINAL, con todos los personajes y
  // gnomos ya colocados: siempre empieza el turno del jugador con las 2
  // acciones de cada uno intactas, y (re)aparece el botón de PASAR TURNO.
  // Puntos de Gloria (js/glory.js) — se inicializa ANTES de Turns.reset()
  // (justo debajo) para que el marcador ya exista cuando Turns.reset()
  // conceda el +2 inicial del primer turno del jugador (ver
  // Turns.reset -> Glory.grantTurnStart). La raza rival puede no existir
  // (ver nota de enemyRace más arriba) — Glory.init ya tolera un id sin
  // raza asociada (simplemente no pinta icono).
  if (typeof Glory !== "undefined") Glory.init(finalRaceId, enemyRace ? enemyRace.id : finalRaceId);

  if (typeof Turns !== "undefined") Turns.reset();
  // Icono de ajustes (js/settingsmenu.js) — sustituye al back-btn flotante
  // que tapaba el marcador de Puntos de Gloria (ver ese archivo) — visible
  // mientras dura la partida, oculto al salir por su propia opción.
  if (typeof SettingsMenu !== "undefined") SettingsMenu.showButton();

  // Niebla de guerra (js/fog.js) — estado de visibilidad inicial: con todos
  // los rivales y gnomos ya colocados y el revelado inicial de cada
  // personaje del jugador ya hecho (arriba), toca ocultar a quien haya
  // caído fuera de esas zonas reveladas. Va AL FINAL de todo a propósito
  // (después de spawnear rivales/gnomos, no antes) — pedido explícito: "los
  // elementos de debajo de la niebla no deben renderizarse para el jugador".
  if (typeof Fog !== "undefined") Fog.applyVisibility();
}

// Ajusta la cámara del tablero (zoom/desplazamiento) al tamaño real del
// escenario que se acaba de pintar, y lo centra en pantalla.
function syncBoardCamera() {
  const boardTiles = document.getElementById("board-tiles");
  if (!boardTiles || typeof BoardView === "undefined") return;
  // Espera a que la pantalla sea visible (fin de la transición de fade) para
  // que el viewport ya tenga su tamaño final antes de centrar el contenido.
  requestAnimationFrame(() => {
    BoardView.setContent(boardTiles.offsetWidth, boardTiles.offsetHeight);
  });
}

function initNewGameFlow() {
  document.getElementById("btn-new-game").addEventListener("click", () => {
    populateModeSelect();
    goToScreen("screen-mode-select");
  });

  document.getElementById("btn-resume-game").addEventListener("click", resumeMatch);

  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", goBack);
  });
}

document.addEventListener("DOMContentLoaded", initNewGameFlow);

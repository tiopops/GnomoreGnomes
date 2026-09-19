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
  renderMap({ size: saved.size, tiles: saved.tiles }, document.getElementById("board-tiles"));
  spawnTestUnits(saved.size, saved.raceId);
  showScreen("screen-board");
  screenHistory.length = 0;
  screenHistory.push("main-menu", "screen-board");
  syncBoardCamera();
}

// Coloca los 3 tipos de unidad del equipo de la raza elegida, uno junto a
// otro cerca del centro del tablero (ver UNIT_TYPES en units.js — el orden
// en el que aparecen ahí es el mismo con el que se colocan aquí), más un
// rival de cada uno de esos mismos tipos en casillas al azar (mismo tinte
// rojo vía CSS) para tener con quién interactuar. El roster se calcula
// filtrando UNIT_TYPES por raceId en vez de tener una lista fija: así un
// personaje nuevo que se añada a una raza aparece aquí solo, sin tocar este
// archivo (pedido explícito: "si elijo colinas rockn troll debe empezar la
// partida con los personajes del equipo elegido" — antes esto era siempre
// el roster de Mushboom Forest sin importar la raza escogida).
function spawnTestUnits(size, raceId) {
  if (typeof Units === "undefined") return;
  const boardTiles = document.getElementById("board-tiles");
  Units.init(boardTiles, size);
  const mid = Math.floor(size / 2);

  const roster = Object.keys(UNIT_TYPES).filter((typeId) => UNIT_TYPES[typeId].raceId === raceId);
  // Si por lo que sea no hay raza válida (partida guardada antigua sin
  // raceId, etc.) se cae de vuelta al roster de Mushboom Forest de siempre
  // en vez de dejar el tablero sin personajes del jugador.
  const finalRoster = roster.length > 0
    ? roster
    : Object.keys(UNIT_TYPES).filter((typeId) => UNIT_TYPES[typeId].raceId === "mushboom_forest");

  // Mismas 3 casillas relativas al centro que se usaban antes — de momento
  // solo hay razas con 3 personajes, así que alcanza con 3 posiciones fijas.
  const spawnSpots = [
    { row: mid, col: mid },
    { row: mid, col: mid - 1 },
    { row: mid - 1, col: mid },
  ];
  finalRoster.forEach((typeId, i) => {
    const spot = spawnSpots[i] || spawnSpots[spawnSpots.length - 1];
    Units.spawnTestUnit(spot.row, spot.col, typeId);
    Units.spawnRandomEnemy(typeId);
  });

  // Los gnomos (js/gnome.js): PUEDE HABER VARIOS a la vez (pedido
  // explícito, "de echo para hacer pruebas pon 3 gnomos en la partida de
  // pruebas") — Gnome.resetAll() detiene primero los temporizadores de los
  // de la partida anterior (si los había) y vacía la lista antes de crear
  // los nuevos. spawnNear busca la loseta libre más próxima a cada punto si
  // esa ya está ocupada (por los personajes de arriba o por otro gnomo ya
  // colocado), así que basta con pedir tres puntos de partida distintos
  // cerca del centro sin calcular a mano qué queda libre.
  if (typeof Gnome !== "undefined") {
    Gnome.resetAll();
    Gnome.spawnNear(mid, mid + 1);
    Gnome.spawnNear(mid + 1, mid + 2);
    Gnome.spawnNear(mid - 1, mid + 2);
  }
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

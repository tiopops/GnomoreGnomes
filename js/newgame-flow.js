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
  spawnTestUnits(size);
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
  spawnTestUnits(saved.size);
  showScreen("screen-board");
  screenHistory.length = 0;
  screenHistory.push("main-menu", "screen-board");
  syncBoardCamera();
}

// Coloca la unidad de pruebas del Mushboom Forest en el centro del tablero
// recién pintado. Solo para pruebas (ver js/units.js) — más adelante esto
// pasará a depender de la raza elegida y de una colocación real de inicio de partida.
function spawnTestUnits(size) {
  if (typeof Units === "undefined") return;
  const boardTiles = document.getElementById("board-tiles");
  Units.init(boardTiles, size);
  const mid = Math.floor(size / 2);
  Units.spawnTestUnit(mid, mid);
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

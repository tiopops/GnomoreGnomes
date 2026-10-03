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

const SKIP_MODE_SELECT = true;

const matchDraft = { modeId: null, raceId: null, levelId: null, opponents: null };

function renderOptionCard({ icon, iconImg, title, desc, onClick, color }) {
  const card = document.createElement("button");
  card.className = "option-card";
  if (color) card.style.setProperty("--card-accent", color);
  // iconImg (pedido explícito: "añado los iconos de los equipos de MushBoom
  // y RocknTroll...elminiamos el icono cutre de phospor que havia") tiene
  // prioridad sobre el glifo de Phosphor — de momento solo las tarjetas de
  // raza (js/races.js) traen iconImg; el resto (modo de juego, nº de
  // rivales) sigue usando el icono de fuente de siempre, sin cambios.
  const iconHtml = iconImg
    ? `<img src="${iconImg}" alt="" class="option-card__icon option-card__icon--img" />`
    : `<i class="ph ${icon} option-card__icon"></i>`;
  card.innerHTML = `
    ${iconHtml}
    <span class="option-card__title">${title}</span>
    ${desc ? `<span class="option-card__desc">${desc}</span>` : ""}
  `;
  card.addEventListener("click", onClick);
  return card;
}

// Pedido explícito (segunda pasada, tras ver la primera versión con
// .option-card): "enserio? te dije que ahora queria CARTAS!!! formato
// carta de juego de rol donde aparezca en grande el logo de cada raza y
// exppliucacion detallada de cad una de ellas con el estilo visual..." —
// tarjeta VERTICAL propia solo para razas (mode/rivales siguen usando
// renderOptionCard tal cual, no se han tocado): ilustración de la mascota
// grande arriba, nombre en banderín, y la explicación separada en 3
// bloques (ambientación/virtudes/desventajas, ver flavorKey/virtuesKey/
// weaknessesKey en js/races.js) en vez de una sola frase corrida — mismo
// lenguaje visual .p5-banner/doble-capa que el resto del juego.
function renderRaceCard({ iconImg, title, flavor, virtues, weaknesses, onClick, color }) {
  const card = document.createElement("button");
  card.className = "race-card";
  if (color) card.style.setProperty("--card-accent", color);
  // Pedido explícito: "las tarjetas de raza...deben flotar, cada una por su
  // cuenta, que no vayan al compas" — delay negativo aleatorio (mismo truco
  // que la niebla, ver mapgen.js) para desincronizar la animación
  // race-card-float (style.css) de cada tarjeta entre sí.
  card.style.setProperty("--float-delay", `-${(Math.random() * 4.2).toFixed(2)}s`);
  card.innerHTML = `
    <span class="race-card__art-wrap">
      <img src="${iconImg}" alt="" class="race-card__art" />
    </span>
    <span class="race-card__title">${title}</span>
    <span class="race-card__body">
      ${flavor ? `<span class="race-card__flavor">${flavor}</span>` : ""}
      <span class="race-card__stat race-card__stat--virtue">
        <i class="ph ph-check-circle race-card__stat-icon"></i>
        <span>${virtues}</span>
      </span>
      <span class="race-card__stat race-card__stat--weakness">
        <i class="ph ph-x-circle race-card__stat-icon"></i>
        <span>${weaknesses}</span>
      </span>
    </span>
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
      renderRaceCard({
        iconImg: race.iconImg,
        title: I18N.t(race.nameKey),
        flavor: I18N.t(race.flavorKey),
        virtues: I18N.t(race.virtuesKey),
        weaknesses: I18N.t(race.weaknessesKey),
        color: race.color,
        onClick: () => {
          matchDraft.raceId = race.id;
          populateLevelSelect();
          goToScreen("screen-level-select");
        },
      })
    );
  });
}

// Selección de nivel (fase) — después de la raza. Mismo diseño de carta que
// las razas (renderRaceCard); un nivel no disponible se pinta bloqueado
// ("Próximamente") y no se puede elegir.
function renderLevelCard(level) {
  const card = document.createElement("button");
  card.className = "race-card level-card" + (level.available ? "" : " level-card--locked");
  card.style.setProperty("--card-accent", level.color);
  // Isla y rótulo flotan cada uno por su cuenta (ritmos y desfases distintos).
  card.style.setProperty("--float-delay", `-${(Math.random() * 5).toFixed(2)}s`);
  card.style.setProperty("--logo-delay", `-${(Math.random() * 3.4).toFixed(2)}s`);
  const name = I18N.t(level.nameKey);
  const feats = (level.featureKeys || [])
    .map(
      (k, i) => `
      <span class="race-card__stat race-card__stat--virtue">
        <i class="ph ${level.featureIcons[i] || "ph-check-circle"} race-card__stat-icon"></i>
        <span>${I18N.t(k)}</span>
      </span>`
    )
    .join("");
  card.setAttribute("aria-label", name);
  card.innerHTML = `
    <span class="level-card__stage">
      <img src="${level.islandImg}" alt="" class="level-card__island" />
      ${level.available ? "" : '<i class="ph-fill ph-lock level-card__lock"></i>'}
      <span class="level-card__name">${name}</span>
    </span>
    <span class="race-card__body level-card__body">
      <span class="race-card__flavor">${I18N.t(level.flavorKey)}</span>
      ${feats}
      ${level.available ? "" : `<span class="level-card__soon">${I18N.t("level_coming_soon")}</span>`}
    </span>
  `;
  if (level.available) {
    card.addEventListener("click", () => {
      matchDraft.levelId = level.id;
      populateOpponentSelect();
      goToScreen("screen-opponent-select");
    });
  } else {
    card.setAttribute("aria-disabled", "true");
    card.tabIndex = -1;
  }
  return card;
}

function populateLevelSelect() {
  const list = document.getElementById("level-list");
  list.innerHTML = "";
  LEVELS.forEach((level) => list.appendChild(renderLevelCard(level)));
}

function populateOpponentSelect() {
  const list = document.getElementById("opponent-list");
  list.innerHTML = "";
  const opts = OPPONENT_OPTIONS;
  let idx = Math.max(0, opts.indexOf(matchDraft.opponents));
  const root = document.createElement("div");
  root.className = "opp-stepper";
  root.innerHTML =
    '<div class="opp-stepper__row">' +
    '<button type="button" class="p5-banner p5-banner--action opp-stepper__arrow" data-dir="-1" aria-label="-"><i class="ph-fill ph-caret-left"></i></button>' +
    '<div class="p5-banner opp-stepper__value"><div class="opp-stepper__icons"></div><div class="opp-stepper__label p5-banner__label"></div></div>' +
    '<button type="button" class="p5-banner p5-banner--action opp-stepper__arrow" data-dir="1" aria-label="+"><i class="ph-fill ph-caret-right"></i></button>' +
    "</div>" +
    '<button type="button" class="p5-banner p5-banner--action opp-stepper__go"><i class="ph-fill ph-sword"></i><span class="p5-banner__label">' + I18N.t("start_match") + "</span></button>";
  const iconsEl = root.querySelector(".opp-stepper__icons");
  const labelEl = root.querySelector(".opp-stepper__label");
  const arrows = root.querySelectorAll(".opp-stepper__arrow");
  const paint = () => {
    const n = opts[idx];
    iconsEl.innerHTML = '<i class="ph-fill ph-user"></i>'.repeat(n);
    labelEl.textContent = I18N.t(n === 1 ? "opponents_label" : "opponents_label_plural", { n });
    arrows[0].classList.toggle("opp-stepper__arrow--off", idx === 0);
    arrows[1].classList.toggle("opp-stepper__arrow--off", idx === opts.length - 1);
  };
  arrows.forEach((btn) =>
    btn.addEventListener("click", () => {
      const next = idx + Number(btn.dataset.dir);
      if (next < 0 || next >= opts.length) return;
      if (typeof SFX !== "undefined") SFX.click();
      idx = next;
      paint();
    })
  );
  root.querySelector(".opp-stepper__go").addEventListener("click", () => {
    if (typeof SFX !== "undefined") SFX.click();
    matchDraft.opponents = opts[idx];
    startMatch(matchDraft);
  });
  paint();
  list.appendChild(root);
}

async function startMatch({ modeId, raceId, levelId, opponents }) {
  // Bug reportado: "el juego no se abre....se queda asi" — al pulsar "1
  // rival" el marcador de Puntos de Gloria (Glory.init, dentro de
  // spawnTestUnits) llegaba a pintarse, pero la pantalla se quedaba
  // encallada en "elige el número de rivales": la única forma de que eso
  // pase es que algo lance una excepción a media construcción de la
  // partida, ANTES de llegar a showScreen("screen-board") — con el juego
  // así, el jugador se queda mirando una pantalla "congelada" sin ningún
  // aviso, y yo sin forma de saber qué línea ha fallado en su máquina. Todo
  // el cuerpo de la función va ahora en un try/catch: si algo revienta, en
  // vez de quedar a medias se deshace lo poco que se llegó a mostrar
  // (_recoverFromFailedMatchStart) y se enseña el error EN PANTALLA
  // (_showStartMatchError) para poder mandarlo por captura.
  // Pedido explícito: "si precargasemos en local los elementos mas
  // pesados...iria todo mejor?...barrita de loading...pocos segundos" —
  // async/await (la función entera, ver también resumeMatch más abajo)
  // justo para poder esperar aquí a Preload.run() (js/preload.js, con su
  // propio tope de espera fijo) ANTES de construir la partida — quien
  // llame a startMatch (un simple onClick) no necesita cambiar nada, un
  // click en un botón no espera a que la función async termine.
  try {
    if (typeof Preload !== "undefined") await Preload.run();
    const size = getBoardSize(opponents);
    // Ríos (pedido explícito) — de momento solo el modo 1v1 los pide, así
    // que se activan solo para "opponents === 1" en vez de para
    // cualquier tamaño de escenario; el día que haya un modo con más
    // rivales que también los quiera, basta con ampliar esta condición.
    const map = generateMap(size, { rivers: opponents === 1 });

    SaveGame.save({
      modeId,
      raceId,
      levelId: levelId || "mushboom_forest",
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
    const { playerSpawnSpots } = spawnTestUnits(size, raceId, opponents);
    showScreen("screen-board");
    screenHistory.length = 0;
    screenHistory.push("main-menu", "screen-board");
    syncBoardCamera(playerSpawnSpots[0]);
    _playInitialFogReveal(playerSpawnSpots);

    const resumeBtn = document.getElementById("btn-resume-game");
    if (resumeBtn) resumeBtn.disabled = false;
    if (typeof Preload !== "undefined") Preload.finish();
    setTimeout(() => { if (typeof Turns !== "undefined") Turns.showTurnBanner(); }, 900);
  } catch (err) {
    _recoverFromFailedMatchStart();
    _showStartMatchError(err);
  }
}

async function resumeMatch() {
  try {
    const saved = SaveGame.load();
    if (!saved || !saved.tiles) return;
    // Ver la nota larga de Preload en startMatch, justo arriba — mismo
    // criterio aquí.
    if (typeof Preload !== "undefined") await Preload.run();
    const map = { size: saved.size, tiles: saved.tiles };
    renderMap(map, document.getElementById("board-tiles"));
    if (typeof TerrainMap !== "undefined") TerrainMap.init(map);
    const { playerSpawnSpots } = spawnTestUnits(saved.size, saved.raceId, saved.opponents);
    showScreen("screen-board");
    screenHistory.length = 0;
    screenHistory.push("main-menu", "screen-board");
    syncBoardCamera(playerSpawnSpots[0]);
    _playInitialFogReveal(playerSpawnSpots);
    if (typeof Preload !== "undefined") Preload.finish();
  } catch (err) {
    _recoverFromFailedMatchStart();
    _showStartMatchError(err);
  }
}

// Deja la interfaz en un estado limpio tras un arranque de partida fallido
// — el HUD fijo (marcador de Gloria, botón de ajustes, mochila, pasar
// turno) vive fuera de #screen-board y se controla a mano (ver
// showButton/hideButton de cada uno), así que si la construcción de la
// partida revienta a medias hay que ocultarlo otra vez uno a uno o se
// queda flotando sobre el menú, como pasaba antes de esta red de
// seguridad.
function _recoverFromFailedMatchStart() {
  if (typeof Preload !== "undefined") Preload.finish();
  if (typeof Glory !== "undefined") Glory.hideHud();
  if (typeof Turns !== "undefined") Turns.hideButton();
  if (typeof SettingsMenu !== "undefined") SettingsMenu.hideButton();
  if (typeof Backpack !== "undefined") Backpack.hideButton();
}

// Aviso en pantalla del error — mismo lenguaje visual que el resto del
// juego (.p5-banner), pero SIN depender de ningún módulo de habilidades o
// combate (podrían ser justo los que han fallado), así que se construye
// aquí a mano con lo mínimo. Pensado para poder hacerle una captura y
// mandármela: el mensaje técnico (err.message + primera línea del stack)
// se queda visible hasta que se cierra a propósito, nunca desaparece solo.
function _showStartMatchError(err) {
  console.error("[Gnomore Gnomes] Error al crear la partida:", err);
  const existing = document.querySelector(".start-error-banner");
  if (existing) existing.remove();

  const banner = document.createElement("div");
  banner.className = "p5-banner start-error-banner";
  const stackLine = err && err.stack ? String(err.stack).split("\n")[1] || "" : "";
  banner.innerHTML = `
    <div class="p5-banner__label start-error-banner__title">No se ha podido crear la partida</div>
    <div class="start-error-banner__msg">${(err && err.message) || String(err)}</div>
    ${stackLine ? `<div class="start-error-banner__stack">${stackLine.trim()}</div>` : ""}
    <button class="start-error-banner__close" type="button">Cerrar</button>
  `;
  banner.querySelector(".start-error-banner__close").addEventListener("click", () => banner.remove());
  document.body.appendChild(banner);
}

// Ya NO coloca ningún personaje de partida (pedido explícito, mecánica de
// Obeliscos Ancestrales, ver js/obelisks.js): "cada equipo empieza en su
// obelisco con cero unidades reclutadas en juego". Esta función se queda
// con su mismo nombre/firma (la llaman startMatch/resumeMatch más abajo)
// para no tocar esos dos sitios, pero ahora solo prepara el tablero
// (tablero, niebla, gnomos, tótems, tienda, Obeliscos de cada equipo,
// Puntos de Gloria, turnos) — el roster de cada raza (UNIT_TYPES filtrado
// por raceId) ya no se usa aquí para colocar nada, lo consulta Obelisks al
// abrir su menú de "Reclutar".
function spawnTestUnits(size, raceId, opponents) {
  if (typeof Units === "undefined") return;
  const boardTiles = document.getElementById("board-tiles");
  Units.init(boardTiles, size);

  const roster = Object.keys(UNIT_TYPES).filter((typeId) => UNIT_TYPES[typeId].raceId === raceId);
  // Si por lo que sea no hay raza válida (partida guardada antigua sin
  // raceId, etc.) se cae de vuelta a Mushboom Forest de siempre en vez de
  // dejar al jugador sin raza asignada a su Obelisco.
  const finalRaceId = roster.length > 0 ? raceId : "mushboom_forest";

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
  const finalEnemyRaceId = enemyRace ? enemyRace.id : finalRaceId;
  // Bandos: rival 1 = otra raza; rival 2 = raza del jugador (con variante de
  // color); rival 3 = raza del rival 1 (con variante).
  const _rivals = Math.max(1, Math.min(3, opponents || 1));
  const _races = { player: finalRaceId, enemy: finalEnemyRaceId, enemy2: finalRaceId, enemy3: finalEnemyRaceId };
  Teams.setup(_rivals, _races);

  // Niebla de guerra (js/fog.js): TODO el mapa arranca oculto — hay que
  // inicializarla ANTES de revelar nada, y DESPUÉS de renderMap (llamado
  // por quien invoque a esta función, ver startMatch/resumeMatch más
  // arriba), que es quien crea las losetas .tile/.tile__fog que Fog.init
  // necesita cachear.
  if (typeof Fog !== "undefined") Fog.init(size, boardTiles);

  // Obeliscos Ancestrales (js/obelisks.js) — pedido explícito: "cada equipo
  // tiene un obelisco ancestral...cada equipo empieza en su obelisco con
  // cero unidades reclutadas en juego". Van PRIMERO de todo el "mobiliario"
  // del tablero (antes de gnomos/tótems/tienda) para que esos puedan evitar
  // sus casillas al colocarse (ver Obelisks.at, ya consultado desde
  // Villages.spawn/Shops.spawn/Gnome.spawnNear). El jugador arranca cerca
  // del centro del mapa (mismo punto que antes ocupaban sus personajes de
  // prueba) y el rival lo más lejos posible de él.
  if (typeof Obelisks !== "undefined") {
    Obelisks.resetAll();
    Obelisks.init(finalRaceId, finalEnemyRaceId);
    Obelisks.spawn(size, finalRaceId, finalEnemyRaceId);
  }

  // Altar de Sacrificios y GnomOgro (js/altar.js, js/gnomogro.js) — pedido
  // explícito: "el altar de sacrificios aparece centrado en el mapa,
  // equidistante a todas las bases enemigas". Justo DESPUÉS de
  // Obelisks.spawn (necesita conocer ya las bases para calcular ese punto
  // equidistante) y ANTES de Gnome/Villages/Shops (para que ellos puedan
  // evitar la casilla del altar al colocarse, ver los Altar.at(...) ya
  // añadidos en cada uno de esos módulos). GnomOgro.resetAll() solo limpia
  // el estado de la partida anterior (si la había) — el propio GnomOgro no
  // se coloca aquí, nace más adelante cuando el Altar se llena del todo.
  if (typeof Altar !== "undefined") {
    Altar.resetAll();
    Altar.spawn(size);
  }
  if (typeof GnomOgro !== "undefined") {
    GnomOgro.resetAll();
  if (typeof Plague !== "undefined") Plague.resetAll();
  }

  // Pedido explícito: "puedes hacer que se precargue la partida antes de
  // mostrarla?...la niebla ocupada por los jugadores desaparece de golpe"
  // — el revelado inicial (Fog.revealInitial) YA NO se dispara aquí, en el
  // mismo instante de JS en que se coloca cada cosa: solo se anota el
  // punto a revelar (el Obelisco del jugador, ahora que ya no hay
  // personajes de partida) y es quien llama a spawnTestUnits (startMatch/
  // resumeMatch) quien decide CUÁNDO revelarla de verdad, después de que
  // el tablero ya esté visible (ver _playInitialFogReveal más abajo).
  const playerObelisk = typeof Obelisks !== "undefined" ? Obelisks.byTeam("player") : null;
  const playerSpawnSpots = playerObelisk ? [{ row: playerObelisk.row, col: playerObelisk.col }] : [];

  // Los gnomos (js/gnome.js): PUEDE HABER VARIOS a la vez (pedido
  // explícito, "de echo para hacer pruebas pon 3 gnomos en la partida de
  // pruebas") — Gnome.resetAll() detiene primero los temporizadores de los
  // de la partida anterior (si los había) y vacía la lista antes de crear
  // los nuevos. spawnNear busca la loseta libre más próxima a cada punto si
  // esa ya está ocupada (por un Obelisco, un rival o por otro gnomo ya
  // colocado — nunca pueden coincidir dos gnomos en la misma casilla), así
  // que basta con pedir puntos de partida sin calcular a mano qué queda
  // libre. Posiciones AL AZAR en todo el tablero (pedido explícito: "al
  // iniciar la fase de pruebas los gnomos aparecen en posiciones aleatorias
  // del mapa") — pueden caer bajo niebla sin problema, es parte de la
  // gracia de explorar: se descubren al revelarse esa zona, igual que un
  // rival. La reaparición ambiental de gnomos sueltos (Gnome.ensureLooseGnome,
  // enganchada a cada inicio de turno) se encarga de mantener al menos uno
  // libre durante el resto de la partida, esto es solo el reparto inicial.
  if (typeof Gnome !== "undefined") {
    Gnome.resetAll();
    for (let i = 0; i < 3; i++) {
      const row = Math.floor(Math.random() * size);
      const col = Math.floor(Math.random() * size);
      Gnome.spawnNear(row, col);
    }
  }

  // Poblados neutrales (js/villages.js) — pedido explícito: "los poblados
  // neutrales aparecen desperdigados por el mapa, de momento puedes poner
  // 2". DESPUÉS de colocar los Obeliscos y los gnomos (para que
  // Villages.spawn pueda evitar sus casillas al elegir dónde aparecen) y
  // ANTES de Glory.init (para que el marcador de gloria, si algún día
  // arranca con un poblado ya conquistado, lo tenga en cuenta desde el
  // primer turno).
  if (typeof Villages !== "undefined") {
    Villages.resetAll();
    Villages.init(finalRaceId, finalEnemyRaceId);
    Villages.spawn(size);
  }

  // Tienda Goblin (js/shops.js) — DESPUÉS de Villages.spawn (para poder
  // evitar sus casillas al elegir dónde aparece, ver Shops.spawn) y ANTES
  // de Turns.reset por coherencia con el resto de "mobiliario" del
  // tablero de aquí arriba, aunque no le afecte directamente.
  if (typeof Shops !== "undefined") {
    Shops.resetAll();
    Shops.spawn(size);
  }

  // Arbustos (js/bushes.js) — pedido explícito: "los arbustos... reparti-
  // dos por el mapa... en zonas cercanas a totems, tiendas goblin y algunos
  // puntos de interes". DESPUÉS de Villages/Shops/Obelisks.spawn (necesita
  // esos puntos de interés ya colocados de los que partir).
  if (typeof Bushes !== "undefined") {
    Bushes.resetAll();
    Bushes.init();
    Bushes.spawn(size);
  }

  // Recursos de escenario (js/resources.js) — pedido explícito: "rocas,
  // mena de hierro y pinos...repartidos por el escenario". DESPUÉS de
  // Villages/Shops/Obelisks/Bushes.spawn (evita superponerse con cualquiera
  // de ellos, ver Resources._tileFree).
  if (typeof Resources !== "undefined") {
    Resources.resetAll();
    Resources.init();
    Resources.spawn(size);
  }
  // TotemVision (js/totemvision.js) — nunca se "spawnea" al empezar la
  // partida (solo aparece si alguien lo compra y lo coloca), pero sí hay
  // que vaciar la lista de la partida anterior, igual que el resto de
  // mecánicas de esta pantalla.
  if (typeof TotemVision !== "undefined") TotemVision.resetAll();

  // Hierbajos (js/hierbajos.js) — vegetación decorativa suelta, pedido
  // explícito: "para colocar sobre las losetas de hierba y dar sensacion de
  // varierad". DESPUÉS de Villages/Shops/Obelisks/Bushes/Resources.spawn
  // (evita superponerse con cualquiera de ellos, ver Hierbajos._tileFree) —
  // no le afecta el orden respecto a Armería/Turnos de aquí abajo, es pura
  // decoración sin ninguna mecánica de juego detrás.
  if (typeof Hierbajos !== "undefined") {
    Hierbajos.resetAll();
    Hierbajos.spawn(size);
  }

  // Charcos de sangre (js/bloodsplat.js) — nada que colocar al empezar
  // (nacen sobre la marcha con cada muerte/gnomo aplastado), solo hay que
  // limpiar los de la partida anterior si la había.
  if (typeof BloodSplat !== "undefined") BloodSplat.resetAll();

  // Armería (js/armory.js) — reinicia los niveles comprados de arma/armadura
  // de cada equipo al empezar una partida nueva.
  if (typeof Armory !== "undefined") {
    Armory.resetAll();
    if (typeof Skills !== "undefined") Skills.resetAll();
  }

  // Turnos (js/turns.js) — se resetea AL FINAL, con el resto del tablero ya
  // colocado: siempre empieza el turno del jugador, y (re)aparece el botón
  // de PASAR TURNO. Puntos de Gloria (js/glory.js) — se inicializa ANTES de
  // Turns.reset() (justo debajo) para que el marcador ya exista cuando
  // Turns.reset() conceda el +2 inicial del primer turno del jugador (ver
  // Turns.reset -> Glory.grantTurnStart). La raza rival puede no existir
  // (ver nota de enemyRace más arriba) — Glory.init ya tolera un id sin
  // raza asociada (simplemente no pinta icono).
  if (typeof Glory !== "undefined") Glory.init(finalRaceId, finalEnemyRaceId);

  // Mochila (js/backpack.js) — deja el inventario limpio con la Setarcoiris
  // inicial. ANTES de Turns.reset() (igual que Glory arriba) porque se
  // registra como oyente de Turns.registerTurnEndListener la primera vez
  // que se llama, y así queda listo antes de que el jugador pueda pasar
  // turno.
  if (typeof Backpack !== "undefined") Backpack.resetAll();

  // Setas explosivas (js/mushrooms.js) — Bosque MushBoom. DESPUÉS de todo el
  // mobiliario (necesita saber qué casillas están libres) y ANTES de
  // Turns.reset (que ya avisa a los oyentes de inicio de turno).
  if (typeof Mushrooms !== "undefined") {
    Mushrooms.resetAll();
    Mushrooms.spawnInitial(size);
  }

  if (typeof Turns !== "undefined") Turns.reset();
  // Icono de ajustes (js/settingsmenu.js) — sustituye al back-btn flotante
  // que tapaba el marcador de Puntos de Gloria (ver ese archivo) — visible
  // mientras dura la partida, oculto al salir por su propia opción.
  if (typeof SettingsMenu !== "undefined") SettingsMenu.showButton();
  // Mochila (js/backpack.js) — ahora SIEMPRE visible durante la partida
  // (recurso de equipo, no de una unidad concreta, ver cabecera de ese
  // archivo), igual que el resto de "mobiliario" fijo del HUD de arriba.
  if (typeof Backpack !== "undefined") Backpack.showButton();

  // Niebla de guerra (js/fog.js) — estado de visibilidad inicial: con el
  // rival y los gnomos ya colocados y el revelado inicial de la zona del
  // jugador ya hecho (arriba), toca ocultar lo que haya caído fuera de esas
  // zonas reveladas. Va AL FINAL de todo a propósito — pedido explícito:
  // "los elementos de debajo de la niebla no deben renderizarse para el
  // jugador".
  if (typeof Fog !== "undefined") Fog.applyVisibility();
  // Totems (js/villages.js) — comprueba de entrada si algún personaje ha
  // quedado colocado justo detrás de un totem (solapamiento en pantalla).
  if (typeof Villages !== "undefined") Villages.refreshOcclusion();
  // Obeliscos Ancestrales (js/obelisks.js) — mismo motivo que Villages
  // justo arriba: comprueba de entrada si algún personaje ha quedado
  // colocado justo detrás de uno.
  if (typeof Obelisks !== "undefined") Obelisks.refreshOcclusion();
    if (typeof Altar !== "undefined") Altar.refreshOcclusion();
  // Unidades propias (js/units.js) — mismo motivo, ahora entre personajes:
  // si un rival ha arrancado justo detrás de uno del jugador.
  if (typeof Units !== "undefined") Units.refreshUnitOcclusion();
  // Tienda Goblin (js/shops.js) — por si algún personaje ha arrancado ya
  // pegado a una (mapa pequeño), su cursor de moneda debe estar activo
  // desde el primer fotograma, no solo tras el primer movimiento.
  if (typeof Shops !== "undefined") Shops.refreshAll();
  // Obeliscos Ancestrales (js/obelisks.js) — indicador de población y pulso
  // de "vacío" ya al día desde el primer fotograma (ambos arrancan en 0
  // unidades reclutadas, así que el pulso debe verse ya mismo).
  if (typeof Obelisks !== "undefined") Obelisks.refreshAll();

  return { playerSpawnSpots };
}

// Dispara el revelado inicial de niebla alrededor de cada personaje del
// jugador DESPUÉS de que el tablero ya es visible (ver startMatch/
// resumeMatch) — pedido explícito: "que se precargue la partida antes de
// mostrarla...la niebla desaparece de golpe, un caos que no queda bonito".
// Un pequeño respiro inicial (deja notarse el tablero ya montado antes de
// que pase nada) y un personaje DETRÁS de otro, no los 3 a la vez, para
// que cada zona se sienta como su propio momento de descubrimiento en vez
// de una única nube gigante disipándose de golpe.
const FOG_REVEAL_START_DELAY_MS = 260;
const FOG_REVEAL_STAGGER_MS = 260;

function _playInitialFogReveal(playerSpawnSpots) {
  if (typeof Fog === "undefined" || !playerSpawnSpots) return;
  playerSpawnSpots.forEach((spot, i) => {
    setTimeout(() => {
      Fog.revealInitial(spot.row, spot.col);
    }, FOG_REVEAL_START_DELAY_MS + i * FOG_REVEAL_STAGGER_MS);
  });
}

// Ajusta la cámara del tablero (zoom/desplazamiento) al tamaño real del
// escenario que se acaba de pintar, y lo centra en pantalla. Pedido
// explícito: "al empezar la partida la camara debe centrarse lo maximo
// posible en la base del jugador" — `focusSpot` ({row, col}, normalmente
// playerSpawnSpots[0], el Obelisco propio) hace que se centre ahí en vez
// de en la mitad geométrica del mapa (ver BoardView.centerOnContentPoint).
function syncBoardCamera(focusSpot) {
  const boardTiles = document.getElementById("board-tiles");
  if (!boardTiles || typeof BoardView === "undefined") return;
  // Espera a que la pantalla sea visible (fin de la transición de fade) para
  // que el viewport ya tenga su tamaño final antes de centrar el contenido.
  requestAnimationFrame(() => {
    let focusPoint = null;
    if (focusSpot && typeof getTileCenter === "function" && typeof Units !== "undefined") {
      focusPoint = getTileCenter(focusSpot.row, focusSpot.col, Units.boardSize);
    }
    BoardView.setContent(boardTiles.offsetWidth, boardTiles.offsetHeight, focusPoint);
  });
}

function initNewGameFlow() {
  document.getElementById("btn-new-game").addEventListener("click", () => {
    // El paso de elegir MODO está desactivado de momento (pedido explícito:
    // "cada nivel tendrá sus reglas"): se salta directo a la raza con el
    // primer modo disponible (GnomeSmash). populateModeSelect y la pantalla
    // #screen-mode-select se conservan por si vuelve a hacer falta — para
    // reactivarlo basta con cambiar SKIP_MODE_SELECT a false.
    if (SKIP_MODE_SELECT) {
      const defaultMode = GAME_MODES.find((m) => m.available) || GAME_MODES[0];
      matchDraft.modeId = defaultMode.id;
      populateRaceSelect();
      goToScreen("screen-race-select");
    } else {
      populateModeSelect();
      goToScreen("screen-mode-select");
    }
  });

  document.getElementById("btn-resume-game").addEventListener("click", resumeMatch);

  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", goBack);
  });
}

document.addEventListener("DOMContentLoaded", initNewGameFlow);
// Al cambiar de idioma se repintan las listas ya construidas (raza, nivel...).
document.addEventListener("gg:langchange", () => {
  ["populateModeSelect", "populateRaceSelect", "populateLevelSelect", "populateOpponentSelect"].forEach((fn) => {
    try {
      const el = { populateModeSelect: "mode-list", populateRaceSelect: "race-list", populateLevelSelect: "level-list", populateOpponentSelect: "opponent-list" }[fn];
      if (document.getElementById(el) && document.getElementById(el).children.length && typeof window[fn] === "function") window[fn]();
    } catch (e) {}
  });
});

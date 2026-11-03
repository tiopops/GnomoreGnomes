/* Gnomore Gnomes — App de escritorio (Windows). Electron.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Abrir la ventana: primero el launcher (launcher.html), que comprueba la versión y descarga la última;
       hasta que el juego no está en la última versión NO se deja arrancar (igual que la APK).
     - Servir el juego instalado en https://localhost (el MISMO origen que usa la APK con Capacitor, así Firebase
       —cuentas, base de datos, modo online— se comporta igual) leyendo los archivos del disco, sin servidor ni puerto.
   El juego es el mismo código web de la carpeta del proyecto; esto solo lo ejecuta fuera del navegador. */
const { app, BrowserWindow, Menu, ipcMain, session, shell, net } = require("electron");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const { Updater } = require("./updater");

const ORIGIN_HOST = "localhost";
const GAME_URL = "https://" + ORIGIN_HOST + "/index.html";
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav",
  ".m4a": "audio/mp4", ".webm": "video/webm", ".mp4": "video/mp4", ".woff2": "font/woff2", ".woff": "font/woff",
  ".ttf": "font/ttf", ".wasm": "application/wasm",
};

let win = null;
let updater = null;
let gameDir = null; // carpeta de la versión instalada que se sirve en https://localhost
let busy = false;

if (!app.requestSingleInstanceLock()) { app.quit(); } else {
  app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(start);
}
app.on("window-all-closed", () => app.quit());

function send(s) { if (win && !win.isDestroyed()) win.webContents.send("status", s); }

// ---------- Pantalla: modo y resolución (se eligen en Ajustes > Opciones gráficas, ver js/settingsmenu.js) ----------
//   full  = pantalla completa · window = ventana SIN bordes · framed = ventana CON bordes (barra de título)
const RESOLUTIONS = [[1280, 720], [1366, 768], [1600, 900], [1920, 1080], [2560, 1440], [3840, 2160]];
// width/height = ventana (en píxeles de interfaz) · fw/fh = resolución REAL del monitor en pantalla completa (0 = la nativa)
// ls = dónde se eligió la última resolución ("win" = ventana, "full" = pantalla completa): al cambiar de modo se conserva.
let display = { mode: "framed", width: 1280, height: 720, fw: 0, fh: 0, ls: "win" };
let lastWindowMode = "framed"; // al salir de pantalla completa con F11 se vuelve a este
let displayFile = null;
const { DisplayMode } = require("./displaymode");
let dm = null;

function loadDisplay() {
  try {
    const d = JSON.parse(fs.readFileSync(displayFile, "utf8"));
    display = sanitize(d);
    lastWindowMode = display.mode === "full" ? "framed" : display.mode;
  } catch (e) {}
}
function saveDisplay() { try { fs.writeFileSync(displayFile, JSON.stringify(display)); } catch (e) {} }
// Tamaño NATIVO del monitor (se guarda al primer uso, antes de cambiar nunca la resolución del sistema).
let native = null;
function screenSize() {
  if (!native) { const d = require("electron").screen.getPrimaryDisplay(); native = { size: d.size, work: d.workAreaSize, sf: d.scaleFactor || 1 }; }
  return { full: native.size, work: native.work, sf: native.sf };
}
function sanitize(d) {
  const mode = ["full", "window", "framed"].includes(d && d.mode) ? d.mode : "framed";
  const sz = screenSize();
  let w = Math.round(+(d && d.width)) || 1280, h = Math.round(+(d && d.height)) || 720;
  // Una ventana nunca debe ser mayor que la pantalla (ni menor que lo jugable).
  w = Math.max(800, Math.min(w, sz.full.width)); h = Math.max(500, Math.min(h, sz.full.height));
  const fw = Math.max(0, Math.round(+(d && d.fw)) || 0), fh = Math.max(0, Math.round(+(d && d.fh)) || 0);
  return { mode, width: w, height: h, fw: fw && fh ? fw : 0, fh: fw && fh ? fh : 0, ls: d && d.ls === "full" ? "full" : "win" };
}
// Resoluciones que caben en la pantalla, más la nativa.
function resolutionList() {
  const sz = screenSize().full;
  const list = RESOLUTIONS.filter(([w, h]) => w <= sz.width && h <= sz.height);
  if (!list.some(([w, h]) => w === sz.width && h === sz.height)) list.push([sz.width, sz.height]);
  return list;
}
// Resoluciones REALES del monitor para pantalla completa (las que Windows admite con la misma proporción que la nativa).
function fullState() {
  if (!dm || !dm.cur) return { status: dm && dm.failed ? "unavailable" : "loading", resolutions: [], current: null };
  const asp = dm.cur.w / dm.cur.h, seen = new Set(), list = [];
  for (const m of dm.modes) {
    const k = m.w + "x" + m.h;
    if (m.w < 1024 || Math.abs(m.w / m.h - asp) > 0.02 || seen.has(k)) continue;
    seen.add(k); list.push([m.w, m.h]);
  }
  list.sort((a, b) => a[0] - b[0]);
  return { status: "ok", resolutions: list, current: display.fw ? [display.fw, display.fh] : [dm.cur.w, dm.cur.h] };
}
function displayState() { return { ...display, screen: screenSize().full, resolutions: resolutionList(), full: fullState() }; }
function dlog(m) { try { fs.appendFileSync(path.join(path.dirname(displayFile), "display.log"), new Date().toISOString() + " " + m + "\n"); } catch (e) {} }
// En pantalla completa se baja DE VERDAD la resolución del monitor (desktop/displaymode.js): menos píxeles que dibujar = más
// rendimiento y una imagen más basta. Al bajar los píxeles, Windows reduce también el tamaño de la interfaz (en píxeles de
// interfaz), así que se compensa con el zoom para que el juego mantenga la MISMA maquetación que a resolución nativa.
function applyScale() {
  if (!win || win.isDestroyed()) return;
  const sz = require("electron").screen.getPrimaryDisplay().size; // tamaño ACTUAL (puede ser menor que el nativo si se bajó la resolución)
  const nat = screenSize().full;
  const z = display.mode === "full" ? Math.min(sz.width / nat.width, sz.height / nat.height) : 1;
  win.webContents.setZoomFactor(Math.max(0.5, Math.min(z, 4)));
}
// Pone el monitor en la resolución pedida (solo en pantalla completa y en el monitor principal) o lo devuelve a la nativa.
let osSeq = 0, lastOs = "native";
async function applyOsResolution() {
  const seq = ++osSeq;
  const E = require("electron");
  const onPrimary = win && !win.isDestroyed() && E.screen.getDisplayMatching(win.getBounds()).id === E.screen.getPrimaryDisplay().id;
  if (display.mode !== "full" && !dm.changed) return;
  const started = await dm.start();
  dlog(`helper ${started ? "ok" : "FALLO " + String(dm.err || "").replace(/\s+/g, " ")} cur=${dm.cur ? dm.cur.w + "x" + dm.cur.h + "@" + dm.cur.f : "?"} modos=${dm.modes.length}`);
  if (!started) { dm.failed = true; notifyDisplay(); }
  if (!started || seq !== osSeq) return;
  const want = display.mode === "full" && onPrimary && display.fw ? dm.pick(display.fw, display.fh) : null;
  const key = want && !(want.w === dm.cur.w && want.h === dm.cur.h) ? `${want.w}x${want.h}@${want.f}` : "native";
  if (key === lastOs) return;
  const ok = key === "native" ? await dm.reset() : await dm.set(want);
  dlog(`aplicar ${key} -> ${ok ? "ok" : "ERROR"}`);
  if (seq !== osSeq) return;
  lastOs = ok ? key : "native";
  setTimeout(() => { applyScale(); notifyDisplay(); }, 900);
}
function notifyDisplay() { if (win && !win.isDestroyed()) win.webContents.send("display", displayState()); }

function makeWindow() {
  const framed = display.mode !== "window";
  const w = new BrowserWindow({
    width: display.width, height: display.height, useContentSize: true, minWidth: 800, minHeight: 500,
    frame: framed, resizable: display.mode === "framed", fullscreen: display.mode === "full",
    backgroundColor: "#14161f", show: false, autoHideMenuBar: true, title: "Gnomore Gnomes",
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, autoplayPolicy: "no-user-gesture-required", backgroundThrottling: false },
  });
  w.once("ready-to-show", () => w.show());
  w.webContents.on("did-finish-load", () => { applyScale(); if (display.mode === "full") applyOsResolution(); });
  w.webContents.on("did-navigate", applyScale);
  // F11 = pantalla completa y de vuelta al modo de ventana anterior.
  w.webContents.on("before-input-event", (e, input) => {
    if (input.type === "keyDown" && input.key === "F11") { e.preventDefault(); setDisplay({ mode: display.mode === "full" ? lastWindowMode : "full" }); }
  });
  // En ventana con bordes, lo que el jugador arrastra con el ratón también se recuerda como resolución.
  let rt = 0;
  w.on("resize", () => {
    if (display.mode !== "framed" || w.isFullScreen() || w.isMaximized() || w !== win) return;
    clearTimeout(rt);
    rt = setTimeout(() => { const [cw, ch] = w.getContentSize(); display.width = cw; display.height = ch; saveDisplay(); notifyDisplay(); }, 400);
  });
  // Lo externo (enlaces http/https que no son el juego) se abre en el navegador; el juego nunca navega fuera de sí mismo.
  w.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url) && !isGame(url)) shell.openExternal(url); return { action: "deny" }; });
  w.webContents.on("will-navigate", (e, url) => {
    if (isGame(url) || url.startsWith("file:")) return;
    e.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url);
  });
  return w;
}

// Aplica un cambio de pantalla. Una ventana sin bordes solo se puede crear así desde cero, por eso pasar a/desde "window"
// reabre la ventana (el juego se recarga); entre pantalla completa y ventana con bordes es inmediato.
// Resolución más parecida de una lista [[w,h],…] a la pedida.
function nearestRes(list, w, h) {
  let best = null, bd = Infinity;
  for (const [lw, lh] of list) { const d = Math.abs(lw - w) + Math.abs(lh - h); if (d < bd) { bd = d; best = [lw, lh]; } }
  return best;
}
// Pasa la última resolución elegida de un tipo (ventana ↔ pantalla completa) al otro, para que se conserve al cambiar de modo.
function carryResolution(nextMode) {
  const sf = screenSize().sf, nat = screenSize().full;
  if (nextMode === "full" && display.ls === "win") {
    const pw = Math.round(display.width * sf), ph = Math.round(display.height * sf);
    const best = nearestRes(fullState().resolutions, pw, ph) || [pw, ph];
    const isNat = dm && dm.cur && best[0] === dm.cur.w && best[1] === dm.cur.h;
    return { fw: isNat ? 0 : best[0], fh: isNat ? 0 : best[1] };
  }
  if (nextMode !== "full" && display.ls === "full") {
    const w = display.fw ? display.fw / sf : nat.width, h = display.fh ? display.fh / sf : nat.height;
    const best = nearestRes(resolutionList(), w, h) || [Math.round(w), Math.round(h)];
    return { width: best[0], height: best[1] };
  }
  return {};
}
function setDisplay(patch) {
  const prev = display;
  const nextMode = patch && patch.mode ? patch.mode : display.mode;
  const picked = patch && (Array.isArray(patch.full) || patch.width || patch.height);
  if (picked) patch = { ...patch, ls: Array.isArray(patch.full) ? "full" : "win" };
  else if (nextMode !== display.mode) patch = { ...patch, ...carryResolution(nextMode), ls: display.ls };
  // {full:[w,h]} = resolución real del monitor en pantalla completa (la nativa se guarda como 0).
  if (patch && Array.isArray(patch.full)) {
    const [w, h] = patch.full, nat = dm && dm.cur;
    patch = { ...patch, fw: nat && w === nat.w && h === nat.h ? 0 : w, fh: nat && w === nat.w && h === nat.h ? 0 : h };
  }
  display = sanitize({ ...display, ...(patch || {}) });
  if (display.mode !== "full") lastWindowMode = display.mode;
  if ((prev.mode === "window") !== (display.mode === "window")) {
    const url = win.webContents.getURL();
    const old = win;
    win = makeWindow();
    win.loadURL(url.startsWith("file:") ? url : GAME_URL);
    old.destroy();
  } else if (display.mode === "full") {
    win.setFullScreen(true);
  } else {
    // Maximizada o sin redimensionar (ventana sin bordes), Windows ignora el cambio de tamaño: se libera un instante.
    const resize = () => {
      if (win.isMaximized()) win.unmaximize();
      const was = win.isResizable(); win.setResizable(true);
      win.setContentSize(display.width, display.height); win.center();
      win.setResizable(was);
    };
    if (win.isFullScreen()) { win.once("leave-full-screen", () => setTimeout(resize, 60)); win.setFullScreen(false); } else resize();
  }
  saveDisplay();
  applyScale();
  applyOsResolution();
  win.webContents.once("did-finish-load", notifyDisplay);
  notifyDisplay();
  return displayState();
}

function start() {
  Menu.setApplicationMenu(null);
  updater = new Updater(path.join(app.getPath("userData"), "game"), process.env.GG_RELEASE_BASE); // GG_RELEASE_BASE: solo para pruebas
  displayFile = path.join(app.getPath("userData"), "display.json");
  dm = new DisplayMode(path.join(app.getPath("userData"), "helper"));
  app.on("will-quit", () => dm.shutdown());
  require("electron").screen.on("display-metrics-changed", () => { clearTimeout(start._mt); start._mt = setTimeout(applyScale, 500); });
  loadDisplay();
  serveGame();
  win = makeWindow();
  ipcMain.on("launcher-ready", () => runFlow());
  ipcMain.on("retry", () => runFlow());
  ipcMain.on("proceed", () => launch());
  ipcMain.on("quit", () => app.quit());
  ipcMain.handle("display:get", () => { if (dm && !dm.ready) dm.start().then((ok) => { if (!ok) { dm.failed = true; dlog("helper FALLO " + String(dm.err || "").replace(/\s+/g, " ")); } notifyDisplay(); }); return displayState(); });
  ipcMain.handle("display:set", (_e, patch) => setDisplay(patch));
  win.loadFile(path.join(__dirname, "launcher.html"));
}

function isGame(url) { try { return new URL(url).hostname === ORIGIN_HOST; } catch (e) { return false; } }

// https://localhost → archivos de la versión instalada. El resto de https (Firebase, etc.) pasa tal cual a la red.
function serveGame() {
  session.defaultSession.protocol.handle("https", async (req) => {
    let u;
    try { u = new URL(req.url); } catch (e) { return net.fetch(req, { bypassCustomProtocolHandlers: true }); }
    if (u.hostname !== ORIGIN_HOST) return net.fetch(req, { bypassCustomProtocolHandlers: true });
    if (!gameDir) return new Response("Juego no instalado", { status: 503 });
    let rel = decodeURIComponent(u.pathname);
    if (rel === "/" || rel === "") rel = "/index.html";
    const file = path.normalize(path.join(gameDir, rel));
    if (file !== gameDir && !file.startsWith(gameDir + path.sep)) return new Response("Prohibido", { status: 403 });
    let st;
    try { st = fs.statSync(file); } catch (e) { return new Response("No encontrado", { status: 404 }); }
    if (!st.isFile()) return new Response("No encontrado", { status: 404 });
    const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
    const headers = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "no-cache" };
    // Peticiones parciales (el audio las usa para saltar dentro del archivo).
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") || "");
    if (m && (m[1] || m[2])) {
      let start = m[1] ? parseInt(m[1], 10) : Math.max(0, st.size - parseInt(m[2], 10));
      let end = m[1] && m[2] ? Math.min(parseInt(m[2], 10), st.size - 1) : st.size - 1;
      if (start > end || start >= st.size) return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + st.size } });
      headers["Content-Range"] = "bytes " + start + "-" + end + "/" + st.size;
      headers["Content-Length"] = String(end - start + 1);
      return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })), { status: 206, headers });
    }
    headers["Content-Length"] = String(st.size);
    return new Response(Readable.toWeb(fs.createReadStream(file)), { status: 200, headers });
  });
}

// Comprueba la última versión y, si hace falta, la descarga. Solo arranca el juego con la última instalada.
async function runFlow() {
  if (busy) return;
  busy = true;
  try {
    const loc = updater.local();
    send({ state: "check", name: loc ? loc.name : "" });
    let rem;
    try { rem = await updater.remote(); } catch (e) {
      // Sin conexión con GitHub: si ya hay una versión instalada se puede continuar con ella; si no, solo reintentar.
      send({ state: "error", kind: "offline", canProceed: !!loc, detail: String((e && e.message) || e) });
      return;
    }
    if (loc && loc.version === rem.version) { gameDir = loc.dir; return launch(); }
    send({ state: "download", name: rem.name || "", done: 0, total: 0 });
    let last = 0;
    try {
      const now = await updater.install(rem, (p) => {
        const t = Date.now();
        if (p.phase === "install") return send({ state: "install", name: rem.name || "" });
        if (t - last > 120) { last = t; send({ state: "download", name: rem.name || "", done: p.done, total: p.total }); }
      });
      gameDir = now.dir;
      launch();
    } catch (e) {
      // Hay una versión nueva pendiente: no se puede jugar con la vieja, solo reintentar.
      console.error("[launcher] descarga:", e && (e.stack || e.message || e));
      send({ state: "error", kind: "download", canProceed: false, detail: String((e && e.message) || e) });
    }
  } finally { busy = false; }
}

function launch() {
  if (!gameDir) { const loc = updater.local(); if (!loc) return send({ state: "error", kind: "offline", canProceed: false, detail: "sin juego instalado" }); gameDir = loc.dir; }
  send({ state: "launch" });
  win.loadURL(GAME_URL);
}

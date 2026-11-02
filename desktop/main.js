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

function start() {
  Menu.setApplicationMenu(null);
  updater = new Updater(path.join(app.getPath("userData"), "game"), process.env.GG_RELEASE_BASE); // GG_RELEASE_BASE: solo para pruebas
  serveGame();
  win = new BrowserWindow({
    width: 1280, height: 720, minWidth: 800, minHeight: 500,
    backgroundColor: "#14161f", show: false, autoHideMenuBar: true, title: "Gnomore Gnomes",
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, autoplayPolicy: "no-user-gesture-required", backgroundThrottling: false },
  });
  win.once("ready-to-show", () => win.show());
  // F11 = pantalla completa (y F11 de nuevo para salir).
  win.webContents.on("before-input-event", (e, input) => {
    if (input.type === "keyDown" && input.key === "F11") { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  // Lo externo (enlaces http/https que no son el juego) se abre en el navegador; el juego nunca navega fuera de sí mismo.
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url) && !isGame(url)) shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => {
    if (isGame(url) || url.startsWith("file:")) return;
    e.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url);
  });
  ipcMain.on("launcher-ready", () => runFlow());
  ipcMain.on("retry", () => runFlow());
  ipcMain.on("proceed", () => launch());
  ipcMain.on("quit", () => app.quit());
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

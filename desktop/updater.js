/* Gnomore Gnomes — Launcher de escritorio: actualización del juego.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Qué versión del juego hay instalada en el PC (carpeta de datos del usuario) y cuál es la última publicada
       (GitHub Release "desktop-latest", generada sola en cada push, ver .github/workflows/desktop.yml).
     - Descargar el paquete del juego (bundle.zip), comprobar su SHA-256, extraerlo y dejarlo como versión activa.
   No sabe nada de ventanas: main.js lo usa y pinta el estado en launcher.html. Mismo esquema que la APK (js/appupdate.js). */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Readable, Transform } = require("stream");
const { pipeline } = require("stream/promises");
const extract = require("extract-zip");

const RELEASE_BASE = "https://github.com/tiopops/GnomoreGnomes/releases/download/desktop-latest/";

class Updater {
  // root: carpeta de datos del launcher (p. ej. %APPDATA%/Gnomore Gnomes/game). base: URL de la release (se cambia en pruebas).
  constructor(root, base) {
    this.root = root;
    this.base = base || RELEASE_BASE;
    this.gamesDir = path.join(root, "games");
    this.curFile = path.join(root, "current.json");
    fs.mkdirSync(this.gamesDir, { recursive: true });
  }

  // { version, name, dir } de lo instalado, o null si no hay nada (o está dañado).
  local() {
    try {
      const c = JSON.parse(fs.readFileSync(this.curFile, "utf8"));
      const dir = path.join(this.gamesDir, c.dir);
      if (c.version && fs.existsSync(path.join(dir, "index.html"))) return { version: c.version, name: c.name || "", dir };
    } catch (e) {}
    return null;
  }

  async remote() {
    const r = await fetch(this.base + "version.json?t=" + Date.now(), { cache: "no-store", signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    if (!j || !j.version) throw new Error("version.json inválido");
    return j;
  }

  // Descarga, verifica, extrae y activa la versión `rem`. onProgress({ phase, done, total }).
  async install(rem, onProgress) {
    const say = onProgress || (() => {});
    const tmpZip = path.join(this.root, "bundle.download");
    const safe = String(rem.version).replace(/[^A-Za-z0-9._-]/g, "_");
    const part = path.join(this.gamesDir, safe + ".part");
    const final = path.join(this.gamesDir, safe);
    try { fs.rmSync(tmpZip, { force: true }); fs.rmSync(part, { recursive: true, force: true }); } catch (e) {}

    // 1) Descarga con progreso.
    const res = await fetch(this.base + "bundle.zip?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok || !res.body) throw new Error("HTTP " + res.status);
    const total = +res.headers.get("content-length") || 0;
    let done = 0;
    const hash = crypto.createHash("sha256");
    const meter = new Transform({
      transform(chunk, _enc, cb) { done += chunk.length; hash.update(chunk); say({ phase: "download", done, total }); cb(null, chunk); },
    });
    await pipeline(Readable.fromWeb(res.body), meter, fs.createWriteStream(tmpZip));
    if (total && done !== total) throw new Error("descarga incompleta (" + done + "/" + total + ")");

    // 2) Comprobación de integridad (si la release la publica).
    if (rem.checksum && hash.digest("hex") !== rem.checksum) throw new Error("checksum");

    // 3) Extracción a una carpeta temporal y cambio atómico a la definitiva.
    say({ phase: "install", done: 0, total: 0 });
    await extract(tmpZip, { dir: part });
    if (!fs.existsSync(path.join(part, "index.html"))) throw new Error("paquete sin index.html");
    fs.rmSync(final, { recursive: true, force: true });
    fs.renameSync(part, final);
    fs.rmSync(tmpZip, { force: true });
    const cur = { version: rem.version, name: rem.name || "", dir: safe };
    fs.writeFileSync(this.curFile + ".tmp", JSON.stringify(cur));
    fs.renameSync(this.curFile + ".tmp", this.curFile);

    // 4) Limpieza de versiones antiguas.
    try {
      fs.readdirSync(this.gamesDir).forEach((d) => { if (d !== safe) fs.rmSync(path.join(this.gamesDir, d), { recursive: true, force: true }); });
    } catch (e) {}
    return this.local();
  }
}

module.exports = { Updater, RELEASE_BASE };

/* Gnomore Gnomes — Actualización de la app de Android (APK con Capacitor).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Detectar si el juego corre dentro de la APK (Capacitor nativo). En el
       navegador normal no hace nada y el botón del menú sigue oculto.
     - Botón "Actualizar juego" del menú principal: compara la versión
       empaquetada (version.json local) con la última publicada
       (GitHub Release "mobile-latest", generada sola en cada push, ver
       .github/workflows/mobile.yml), y si hay una nueva descarga el paquete
       del juego (bundle.zip) con el plugin nativo CapacitorUpdater y reinicia
       la app con él. Todo lo demás (online, Firebase, etc.) es el mismo código web. */
const AppUpdate = {
  RELEASE_BASE: "https://github.com/tiopops/GnomoreGnomes/releases/download/mobile-latest/",
  _busy: false,

  isNative() {
    return !!(window.Capacitor && typeof Capacitor.isNativePlatform === "function" && Capacitor.isNativePlatform());
  },

  _updater() {
    return window.Capacitor && Capacitor.Plugins ? Capacitor.Plugins.CapacitorUpdater : null;
  },

  async init() {
    if (!this.isNative()) { this._initPromo(); return; }
    const up = this._updater();
    // Obligatorio en cada arranque: si no, el plugin da por mala la versión
    // descargada y vuelve a la anterior.
    if (up) {
      try { await up.notifyAppReady(); } catch (e) {}
      this._cleanup(up);
    }
    this._ensureButton();
    // Al abrir la app, ANTES del menú: pantalla de actualización que comprueba la versión
    // y, si hay una nueva, la descarga (con barra de progreso) y reinicia sola.
    // Siempre al arrancar (también con datos móviles): el JSON de versión pesa unos bytes y la
    // descarga es lo que el jugador espera nada más abrir la app.
    await this.run(true);
  },

  // ---------- Pantalla de actualización al arrancar ----------
  _gateShow() {
    if (this._gate) return;
    const el = document.createElement("div");
    el.className = "au-overlay au-overlay--check";
    el.innerHTML = `<div class="au-box">
      <i class="ph-bold ph-circle-notch au-spin app-update-spin"></i>
      <div class="au-title">ACTUALIZANDO</div>
      <div class="au-bar"><i style="width:0%"></i></div>
      <b class="au-pct">0%</b>
      <button type="button" class="au-skip" hidden>SALTAR</button>
    </div>`;
    document.body.appendChild(el);
    this._gate = el;
    this._gateStart = Date.now();
    // Si la descarga se eterniza, aparece un botón para entrar con la versión actual.
    this._skipTimer = setTimeout(() => { const b = el.querySelector(".au-skip"); if (b) { b.hidden = false; b.addEventListener("click", () => { this._skipped = true; this._gateHide(); }); } }, 20000);
  },
  _gateProgress(pct) {
    if (!this._gate) return;
    const p = Math.max(0, Math.min(100, Math.round(pct)));
    const i = this._gate.querySelector(".au-bar i"), t = this._gate.querySelector(".au-pct");
    if (i) i.style.width = p + "%";
    if (t) t.textContent = p + "%";
  },
  _gateHide() {
    clearTimeout(this._skipTimer);
    const el = this._gate;
    if (!el) return;
    this._gate = null;
    el.classList.add("au-overlay--out");
    setTimeout(() => el.remove(), 350);
  },

  // Popup "DESCARGAR APP": solo en el navegador de un móvil Android (nunca en
  // ordenador ni dentro de la propia APK). Sale una vez al entrar al menú
  // principal; la APK la publica el workflow en la release "mobile-latest".
  APK_URL: "https://github.com/tiopops/GnomoreGnomes/releases/download/mobile-latest/GnomoreGnomes.apk",

  _initPromo() {
    if (!/Android/i.test(navigator.userAgent || "")) return;
    const menu = document.getElementById("main-menu");
    if (!menu) return;
    const check = () => {
      if (!menu.classList.contains("screen--active")) return false;
      this._showPromo();
      return true;
    };
    if (check()) return;
    const mo = new MutationObserver(() => { if (check()) mo.disconnect(); });
    mo.observe(menu, { attributes: true, attributeFilter: ["class"] });
  },

  _showPromo() {
    if (this._promoShown) return;
    this._promoShown = true;
    const overlay = document.createElement("div");
    overlay.className = "backpack-overlay";
    const close = () => {
      overlay.classList.remove("backpack-overlay--visible");
      setTimeout(() => overlay.remove(), 220);
    };
    overlay.addEventListener("click", close);

    const panel = document.createElement("div");
    panel.className = "backpack-panel";
    panel.addEventListener("click", (e) => e.stopPropagation());

    const bg = document.createElement("div");
    bg.className = "p5-banner backpack-panel__bg";
    panel.appendChild(bg);

    const x = document.createElement("button");
    x.className = "backpack-close-btn";
    x.setAttribute("aria-label", "Cerrar");
    x.innerHTML = '<i class="ph ph-x backpack-close-btn__icon"></i>';
    x.addEventListener("click", (e) => { e.stopPropagation(); close(); });
    panel.appendChild(x);

    const title = document.createElement("div");
    title.className = "p5-banner__label backpack-panel__title";
    title.textContent = "DESCARGAR APP";
    bg.appendChild(title);

    const slots = document.createElement("div");
    slots.className = "backpack-slots app-promo__slots";
    slots.innerHTML = '<img class="app-promo__img" src="assets/tutorial/nizak_normal.png" alt="">';
    bg.appendChild(slots);

    const desc = document.createElement("div");
    desc.className = "backpack-desc";
    desc.innerHTML = '<p class="backpack-desc__text">Para una mejor experiencia descarga la app de Gnomore Gnomes en tu móvil</p>';
    bg.appendChild(desc);

    // Enlace de verdad (no window.location): en el móvil un toque sobre un
    // <a href> es la forma más fiable de que el navegador empiece la descarga.
    const btn = document.createElement("a");
    btn.className = "p5-banner p5-banner--action shop-buy-btn app-promo__btn";
    btn.href = this.APK_URL;
    btn.setAttribute("download", "GnomoreGnomes.apk");
    btn.rel = "noopener";
    btn.innerHTML = '<span class="p5-banner__label">DESCARGAR APK</span>';
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      setTimeout(close, 400);
    });
    bg.appendChild(btn);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    if (typeof Obelisks !== "undefined" && Obelisks._fitGeneric) Obelisks._fitGeneric(overlay, panel);
    else panel.style.marginTop = "12vh";
    requestAnimationFrame(() => overlay.classList.add("backpack-overlay--visible"));
  },

  // Botón redondo junto a perfil/ajustes (solo en el menú principal y solo en
  // la APK). Sin textos: el icono cambia según el estado.
  _ensureButton() {
    const btn = document.createElement("button");
    btn.id = "btn-app-update";
    btn.className = "settings-gear-btn settings-gear-btn--update settings-gear-btn--visible";
    btn.setAttribute("aria-label", "Actualizar juego");
    btn.innerHTML = '<i class="ph ph-download-simple settings-gear-btn__icon"></i>';
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.run();
    });
    document.body.appendChild(btn);
    this._btn = btn;
    const menu = document.getElementById("main-menu");
    const sync = () => { btn.hidden = !(menu && menu.classList.contains("screen--active")); };
    sync();
    if (menu) new MutationObserver(sync).observe(menu, { attributes: true, attributeFilter: ["class"] });
  },

  // Borra las versiones descargadas antiguas (cada una pesa ~90 MB).
  async _cleanup(up) {
    try {
      const cur = await up.current();
      const list = await up.list();
      for (const b of list.bundles || []) {
        if (b.id !== (cur.bundle && cur.bundle.id) && b.status !== "pending") await up.delete({ id: b.id });
      }
    } catch (e) {}
  },

  _icon(name) {
    const el = this._btn && this._btn.querySelector("i");
    if (el) el.className = "ph ph-" + name + " settings-gear-btn__icon" + (name === "circle-notch" ? " app-update-spin" : "");
  },

  // Varias vías para leer el JSON de versión: cada móvil/WebView falla por un sitio distinto
  // (redirección de GitHub, CORS, tiempo de espera...), así que se prueban en cadena.
  async _getJson(url) {
    const errs = [];
    const http = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.CapacitorHttp;
    const parse = (d) => (typeof d === "string" ? JSON.parse(d) : d);
    const tries = [];
    if (http && http.get) {
      tries.push(["nativo", async () => {
        const r = await http.get({ url, responseType: "text", connectTimeout: 10000, readTimeout: 10000 });
        if (r.status && r.status >= 400) throw new Error("HTTP " + r.status);
        return parse(r.data);
      }]);
    }
    tries.push(["web", async () => {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }]);
    tries.push(["api", async () => {
      const rel = await (await fetch("https://api.github.com/repos/tiopops/GnomoreGnomes/releases/tags/mobile-latest", { cache: "no-store" })).json();
      const as = (rel.assets || []).find((x) => x.name === "version.json");
      if (!as) throw new Error("sin version.json en la release");
      const r = await fetch(as.url, { headers: { Accept: "application/octet-stream" }, cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }]);
    for (const [name, fn] of tries) {
      try {
        const out = await fn();
        if (out && out.version) return out;
        errs.push(name + ": respuesta vacía");
      } catch (e) {
        errs.push(name + ": " + ((e && (e.message || e.errorMessage)) || e));
      }
    }
    throw new Error(errs.join(" | "));
  },

  // Estado de la última comprobación (se muestra en el historial de versiones, dentro de la APK).
  _setStatus(txt) {
    this.status = txt;
    try { localStorage.setItem("gg_update_status", Date.now() + "|" + txt); } catch (e) {}
  },

  // Pide la versión publicada con reintentos: en el móvil la primera petición a GitHub
  // (redirección a su CDN) a veces tarda más de 6 s o falla, y antes eso dejaba la
  // comprobación en silencio sin actualizar.
  async _getRemote() {
    let lastErr = null;
    for (let i = 0; i < 3; i++) {
      try {
        return await Promise.race([
          this._getJson(this.RELEASE_BASE + "version.json?_=" + Date.now()),
          new Promise((_, rej) => setTimeout(() => rej(new Error("tiempo agotado")), 25000)),
        ]);
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 1200));
      }
    }
    throw lastErr || new Error("sin respuesta");
  },

  async run(auto) {
    if (this._busy) return;
    this._busy = true;
    const idle = "download-simple";
    if (auto) this._gateShow(); // tapa el menú mientras se comprueba la versión
    try {
      this._icon("circle-notch");
      const local = await (await fetch("version.json?_=" + Date.now(), { cache: "no-store" })).json();
      this.localVersion = local && local.version;
      const remote = await this._getRemote();
      if (!remote || !remote.version) throw new Error("respuesta vacía");
      if (remote.version === local.version) {
        this._setStatus("al día (" + local.version + ")");
        if (!auto) {
          this._icon("check");
          setTimeout(() => this._icon(idle), 2500);
        } else this._icon(idle);
        return;
      }
      this._setStatus("descargando " + remote.version);
      this._icon("circle-notch");
      const up = this._updater();
      if (!up) throw new Error("sin plugin de actualización");
      if (this._gate) this._gate.classList.remove("au-overlay--check");
      let h = null;
      try { h = await up.addListener("download", (e) => this._gateProgress(e && e.percent)); } catch (e) {}
      let bundle;
      try {
        bundle = await up.download({ url: this.RELEASE_BASE + "bundle.zip", version: remote.version });
      } finally {
        try { if (h && h.remove) h.remove(); } catch (e) {}
      }
      if (this._skipped) { this._setStatus("omitida por el jugador"); return; } // entra con la versión actual
      this._gateProgress(100);
      this._setStatus("instalando " + remote.version);
      await up.set(bundle); // reinicia la app con la versión nueva
    } catch (e) {
      this._setStatus("error: " + ((e && (e.message || e.errorMessage)) || e));
      // Sin avisos en el arranque; el botón del menú queda con el aviso hasta la próxima comprobación buena.
      this._icon("warning");
      // El aviso nunca se queda fijo: vuelve al icono normal y, si fue en el arranque,
      // se reintenta una vez en silencio por si solo era un fallo de red momentáneo.
      setTimeout(() => this._icon(idle), 3000);
      if (auto && !this._retried) { this._retried = true; setTimeout(() => this.run(false), 4000); }
    } finally {
      this._busy = false;
      if (auto) this._gateHide();
    }
  },
};

document.addEventListener("DOMContentLoaded", () => AppUpdate.init());

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
    // Al abrir la app: comprueba y, si hay versión nueva, la instala sola
    // (se salta con datos móviles; ahí queda el botón manual).
    const net = navigator.connection;
    if (!(net && net.type === "cellular")) setTimeout(() => this.run(true), 1200);
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

  async _getJson(url) {
    const http = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.CapacitorHttp;
    if (http && http.get) {
      const r = await http.get({ url, responseType: "json" });
      return typeof r.data === "string" ? JSON.parse(r.data) : r.data;
    }
    const r = await fetch(url, { cache: "no-store" });
    return r.json();
  },

  async run(auto) {
    if (this._busy) return;
    this._busy = true;
    const idle = "download-simple";
    try {
      this._icon("circle-notch");
      const local = await (await fetch("version.json?_=" + Date.now(), { cache: "no-store" })).json();
      const remote = await this._getJson(this.RELEASE_BASE + "version.json?_=" + Date.now());
      if (!remote || !remote.version || remote.version === local.version) {
        if (!auto) {
          this._icon("check");
          setTimeout(() => this._icon(idle), 2500);
        } else this._icon(idle);
        return;
      }
      this._icon("circle-notch");
      const up = this._updater();
      const bundle = await up.download({ url: this.RELEASE_BASE + "bundle.zip", version: remote.version });
            await up.set(bundle); // reinicia la app con la versión nueva
    } catch (e) {
      if (auto) this._icon(idle); // sin avisos en el arranque; queda el botón manual
      else {
        this._icon("warning");
        setTimeout(() => this._icon(idle), 3000);
      }
    } finally {
      this._busy = false;
    }
  },
};

document.addEventListener("DOMContentLoaded", () => AppUpdate.init());

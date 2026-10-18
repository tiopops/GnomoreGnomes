/* Gnomore Gnomes — contador de FPS.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe mostrar los fps reales del juego.
   - Opción «Mostrar FPS» del menú de gráficos (FpsMeter.setEnabled): por defecto DESACTIVADA, se recuerda
     en localStorage. Se muestra justo encima del botón de la mochila (si no está visible, en su sitio).
   - Con ?fps en la URL (index.html?fps) además aparece, abajo a la izquierda, la versión de depuración:
     peor fotograma, elementos del tablero, niebla visible y zoom, para pasarle capturas a Claude.
   Con la opción apagada y sin ?fps el bucle de medición NO corre (coste cero). */
const FpsMeter = {
  _KEY: "gg_show_fps",
  enabled: false,
  _debug: /[?&]fps\b/.test(location.search),
  _el: null,
  _dbgEl: null,
  _raf: 0,
  _frames: 0,
  _worst: 0,
  _t0: 0,
  _last: 0,

  init() {
    try { this.enabled = localStorage.getItem(this._KEY) === "1"; } catch (e) { this.enabled = false; }
    this._sync();
  },

  setEnabled(on) {
    this.enabled = !!on;
    try { localStorage.setItem(this._KEY, this.enabled ? "1" : "0"); } catch (e) {}
    this._sync();
  },

  _sync() {
    const run = this.enabled || this._debug;
    if (this._el) this._el.style.display = this.enabled ? "" : "none";
    if (run && !this._raf) {
      if (!this._el) {
        this._el = document.createElement("div");
        this._el.className = "fps-meter";
        document.body.appendChild(this._el);
      }
      this._el.style.display = this.enabled ? "" : "none";
      if (this._debug && !this._dbgEl) {
        this._dbgEl = document.createElement("div");
        this._dbgEl.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:2147483647;padding:6px 9px;background:rgba(0,0,0,.72);color:#9f9;font:12px/1.35 monospace;white-space:pre;pointer-events:none;border-radius:4px";
        document.body.appendChild(this._dbgEl);
      }
      this._last = this._t0 = performance.now();
      this._frames = 0;
      this._worst = 0;
      this._raf = requestAnimationFrame((t) => this._tick(t));
    } else if (!run && this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = 0;
    }
  },

  _place() {
    const el = this._el;
    const bp = document.querySelector(".backpack-btn--visible") || document.querySelector(".backpack-btn");
    const r = bp ? bp.getBoundingClientRect() : null;
    if (r && r.width > 0 && bp.classList.contains("backpack-btn--visible")) {
      el.style.left = Math.round(r.left + r.width / 2) + "px";
      el.style.bottom = Math.round(window.innerHeight - r.top + 4) + "px";
    } else {
      el.style.left = "62px";
      el.style.bottom = "20px";
    }
  },

  _tick(now) {
    this._raf = requestAnimationFrame((t) => this._tick(t));
    const dt = now - this._last;
    this._last = now;
    this._frames++;
    if (dt > this._worst) this._worst = dt;
    if (now - this._t0 < 1000) return;
    const fps = Math.round((this._frames * 1000) / (now - this._t0));
    if (this.enabled && this._el) {
      this._el.textContent = fps + " FPS";
      this._el.style.color = fps >= 50 ? "#9f9" : fps >= 30 ? "#ffd23f" : "#ff6b5a";
      this._place();
    }
    if (this._dbgEl) {
      const bt = document.getElementById("board-tiles");
      const nodes = bt ? bt.getElementsByTagName("*").length : 0;
      const fogVis = document.querySelectorAll(".tile__fog:not(.tile__fog--culled):not(.tile__fog--revealed)").length;
      const sc = typeof BoardView !== "undefined" ? BoardView.scale.toFixed(2) : "-";
      this._dbgEl.textContent = "fps " + fps + "   peor " + Math.round(this._worst) + " ms\nnodos " + nodes + "   niebla visible " + fogVis + "\nzoom " + sc +
        (document.body.classList.contains("perf-mode") ? "   modo rendimiento" : "");
    }
    this._frames = 0;
    this._worst = 0;
    this._t0 = now;
  },
};
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => FpsMeter.init());
else FpsMeter.init();

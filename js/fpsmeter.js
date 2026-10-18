/* Gnomore Gnomes — medidor de rendimiento SOLO para depuración.
   Regla de oro: un archivo por mecánica. No hace nada salvo que la URL lleve
   ?fps (p.ej. index.html?fps): entonces muestra, abajo a la izquierda, los
   fps reales, el peor fotograma del último segundo, los elementos vivos del
   tablero y cuánto tarda el suelo en pintarse. Sirve para pasarle capturas a
   Claude con números reales de tu equipo. Sin ?fps no se carga nada. */
(function () {
  if (!/[?&]fps\b/.test(location.search)) return;
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:2147483647;padding:6px 9px;background:rgba(0,0,0,.72);color:#9f9;font:12px/1.35 monospace;white-space:pre;pointer-events:none;border-radius:4px";
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(el));
  let last = performance.now(), frames = 0, worst = 0, t0 = last;
  function tick(now) {
    const dt = now - last; last = now; frames++; if (dt > worst) worst = dt;
    if (now - t0 >= 1000) {
      const fps = Math.round((frames * 1000) / (now - t0));
      const bt = document.getElementById("board-tiles");
      const nodes = bt ? bt.getElementsByTagName("*").length : 0;
      const fogVis = document.querySelectorAll(".tile__fog:not(.tile__fog--culled):not(.tile__fog--revealed)").length;
      const sc = typeof BoardView !== "undefined" ? BoardView.scale.toFixed(2) : "-";
      el.textContent = "fps " + fps + "   peor " + Math.round(worst) + " ms\nnodos " + nodes + "   niebla visible " + fogVis + "\nzoom " + sc +
        (document.body.classList.contains("perf-mode") ? "   modo rendimiento" : "");
      frames = 0; worst = 0; t0 = now;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

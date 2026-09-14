/* Gnomore Gnomes — retroalimentación sonora de la interfaz.
   Regla de oro: toda interacción debe dar feedback (sonido y/o animación).
   Sonidos generados por código (Web Audio API) como placeholder, hasta que existan
   efectos de sonido reales — así no depende de ningún archivo de audio todavía. */

const SFX = {
  ctx: null,
  lastHovered: null,

  ensureCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    return this.ctx;
  },

  playTone(freq, duration = 0.08, type = "sine", volume = 0.12) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = volume;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Audio no disponible (autoplay bloqueado, etc.) — se ignora, no debe romper la UI.
    }
  },

  hover() { this.playTone(620, 0.05, "sine", 0.05); },
  click() { this.playTone(880, 0.08, "triangle", 0.12); },
  back() { this.playTone(320, 0.08, "sine", 0.1); },
};

const SFX_TARGETS = ".menu-btn:not(:disabled), .option-card, .back-btn";

document.addEventListener("mouseover", (e) => {
  const el = e.target.closest(SFX_TARGETS);
  if (el && el !== SFX.lastHovered) {
    SFX.hover();
    SFX.lastHovered = el;
  }
});

document.addEventListener("mouseout", (e) => {
  const el = e.target.closest(SFX_TARGETS);
  if (el === SFX.lastHovered) SFX.lastHovered = null;
});

document.addEventListener("click", (e) => {
  if (e.target.closest(".back-btn")) {
    SFX.back();
    return;
  }
  if (e.target.closest(".menu-btn:not(:disabled), .option-card")) {
    SFX.click();
  }
});

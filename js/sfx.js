/* Gnomore Gnomes — retroalimentación sonora de la interfaz.
   Regla de oro: toda interacción debe dar feedback (sonido y/o animación).
   Sonidos generados por código (Web Audio API) como placeholder, hasta que existan
   efectos de sonido reales — así no depende de ningún archivo de audio todavía.

   Cada sonido (hover/click/back) usa una única voz persistente (un oscilador
   que arranca una sola vez y se queda sonando en silencio) en vez de crear un
   oscilador nuevo cada vez. Así, al pasar el ratón muy rápido por varios
   botones seguidos, no se acumulan decenas de osciladores solapándose (lo que
   sonaba "roto"/como un error): cada toque solo reinicia la envolvente de
   volumen de esa misma voz, con una pequeña transición para no hacer clics. */

const SFX = {
  ctx: null,
  master: null,
  voices: {},

  lastHovered: null,
  lastHoverTime: 0,
  HOVER_THROTTLE_MS: 55, // evita el "ametralladora" al barrer el ratón muy rápido por la lista

  ensureCtx() {
    if (this.ctx) return this.ctx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    this.ctx = new AudioCtx();
    // Compresor a la salida: permite subir el volumen de los tonos sin riesgo
    // de que se distorsionen si alguna vez llegan a solaparse dos sonidos.
    this.master = this.ctx.createGain();
    this.master.gain.value = 1;
    const compressor = this.ctx.createDynamicsCompressor();
    this.master.connect(compressor).connect(this.ctx.destination);
    return this.ctx;
  },

  _getVoice(name, freq, type) {
    const ctx = this.ensureCtx();
    if (!ctx) return null;
    if (ctx.state === "suspended") ctx.resume();
    if (this.voices[name]) return this.voices[name];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0;
    osc.connect(gain).connect(this.master);
    osc.start();
    const voice = { osc, gain };
    this.voices[name] = voice;
    return voice;
  },

  // "Puntea" la voz: sube el volumen casi de golpe y lo deja caer, como un
  // pequeño pulso percusivo. Si se llama otra vez antes de que termine de
  // apagarse, parte del volumen que tuviera en ese momento (sin salto/clic).
  _pluck(name, freq, type, duration, peak) {
    const voice = this._getVoice(name, freq, type);
    if (!voice) return;
    try {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const g = voice.gain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(peak, now + 0.008);
      g.exponentialRampToValueAtTime(0.0001, now + duration);
    } catch (e) {
      // Audio no disponible (autoplay bloqueado, etc.) — se ignora, no debe romper la UI.
    }
  },

  hover() {
    const now = performance.now();
    if (now - this.lastHoverTime < this.HOVER_THROTTLE_MS) return;
    this.lastHoverTime = now;
    this._pluck("hover", 620, "sine", 0.09, 0.16);
  },
  click() { this._pluck("click", 880, "triangle", 0.12, 0.28); },
  back() { this._pluck("back", 320, "sine", 0.1, 0.22); },
  hop() { this._pluck("hop", 520, "sine", 0.07, 0.2); },
  hit() { this._pluck("hit", 170, "square", 0.16, 0.4); },

  // Eliminar a un rival debe sentirse como una pequeña recompensa, no como
  // un error o un golpe apagado — un solo tono grave plano (lo que había
  // antes) no genera esa sensación. Encadena un golpe seco grave (el impacto
  // de la caída) con un destellito agudo de dos notas justo después (la
  // "recompensa"), como un mini jingle de victoria.
  death() {
    this._pluck("death-thud", 115, "square", 0.14, 0.4);
    setTimeout(() => this._pluck("death-chime-1", 880, "triangle", 0.2, 0.26), 70);
    setTimeout(() => this._pluck("death-chime-2", 1320, "triangle", 0.26, 0.22), 150);
  },
};

const SFX_TARGETS =
  ".menu-btn:not(:disabled), .option-card, .back-btn, .range-marker, .attack-marker, .unit, .unit-info-btn";

// IMPORTANTE: se usa "mouseover"/"mouseout" (delegados en document) en vez de
// "mouseenter"/"mouseleave" para poder delegar en un único listener, pero eso
// obliga a comprobar `relatedTarget`: sin esa comprobación, mover el ratón
// entre elementos hijos del mismo botón (el icono y el texto, por ejemplo)
// se interpreta como "salir y volver a entrar", repitiendo el sonido sin parar.

document.addEventListener("mouseover", (e) => {
  const el = e.target.closest(SFX_TARGETS);
  if (!el) return;
  if (el.contains(e.relatedTarget)) return; // seguimos dentro del mismo elemento
  if (el === SFX.lastHovered) return;
  SFX.hover();
  SFX.lastHovered = el;
});

document.addEventListener("mouseout", (e) => {
  const el = e.target.closest(SFX_TARGETS);
  if (!el) return;
  if (el.contains(e.relatedTarget)) return; // seguimos dentro del mismo elemento
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

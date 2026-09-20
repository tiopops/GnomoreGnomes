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

  // El gnomo (js/gnome.js): coger debe sonar a "agarrado" limpio y
  // satisfactorio; pasar con éxito reutiliza la misma idea de mini-jingle de
  // dos notas que death() (recompensa) pero sin el golpe grave inicial, para
  // no confundirse con "algo ha muerto"; fallar el pase es justo lo
  // contrario de esa recompensa — un tono grave y descendente, sin brillo.
  catch() { this._pluck("gnome-catch", 740, "triangle", 0.14, 0.32); },
  passSuccess() {
    this._pluck("gnome-pass-1", 700, "triangle", 0.16, 0.26);
    setTimeout(() => this._pluck("gnome-pass-2", 1050, "triangle", 0.22, 0.24), 90);
  },
  dropFail() { this._pluck("gnome-drop-fail", 140, "sawtooth", 0.22, 0.35); },

  // Un gnomo suelto perdiendo puntos al pasar turno (js/turns.js,
  // GnomeInstance._loseCooldownPoints) — a propósito NO reutiliza hit() (un
  // golpe de verdad, seco y agudo): esto es lo contrario, se está calmando,
  // así que suena grave y blando (sine en vez de square, más largo y suave)
  // en vez de un impacto.
  gnomeCooldown() { this._pluck("gnome-cooldown", 210, "sine", 0.28, 0.22); },

  // Grito del gnomo mientras vuela por el aire (Gnome.animateThrowTo) —
  // pedido explícito: "un sonido... como iiiiiiiiu o que den un gritito...
  // asegúrate de que sea un sonido de calidad". No reutiliza _pluck/_getVoice
  // (pensados para un tono fijo con solo un envolvente de volumen): aquí hace
  // falta un oscilador PROPIO por cada vuelo porque su frecuencia se desliza
  // de principio a fin (glissando descendente, el clásico "caída" de dibujos
  // animados) y con la voz compartida un segundo vuelo que empezara antes de
  // que la anterior terminara de apagarse heredaría a medias su rampa de
  // frecuencia. Tres capas para que no suene a tono puro de sintetizador:
  //   - osc (sawtooth): el propio "grito", más brillante que una sinusoide,
  //     de startFreq a endFreq con exponentialRamp (una caída de tono se
  //     percibe más natural en escala exponencial que lineal).
  //   - vibrato: una segunda oscilación (LFO) modulando la frecuencia de
  //     osc unos ±26Hz a ~11Hz — el temblor que distingue un "grito" de un
  //     pitido liso.
  //   - filter (lowpass): su frecuencia de corte baja EN PARALELO al tono
  //     para que el final del grito también se sienta "apagándose", no solo
  //     más grave.
  // duration en SEGUNDOS (a diferencia del resto de SFX, en ms) porque quien
  // llama a esto ya tiene la duración del vuelo en segundos a mano.
  gnomeFly(duration) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;
      const dur = Math.max(0.15, duration);

      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(1100, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + dur);

      const vibrato = ctx.createOscillator();
      vibrato.type = "sine";
      vibrato.frequency.value = 11;
      const vibratoGain = ctx.createGain();
      vibratoGain.gain.value = 26;
      vibrato.connect(vibratoGain).connect(osc.frequency);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(4200, now);
      filter.frequency.exponentialRampToValueAtTime(900, now + dur);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.24, now + Math.min(0.12, dur * 0.3));
      gain.gain.setValueAtTime(0.24, now + Math.max(0, dur - 0.12));
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      osc.connect(filter).connect(gain).connect(this.master);
      osc.start(now);
      vibrato.start(now);
      osc.stop(now + dur + 0.05);
      vibrato.stop(now + dur + 0.05);
    } catch (e) {
      // Audio no disponible — se ignora, no debe romper la animación de vuelo.
    }
  },

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
  ".menu-btn:not(:disabled), .option-card, .back-btn, .range-marker, .attack-marker, .unit, .unit-info-btn, " +
  ".catch-marker, .pass-marker, .gnome-action-btn";

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

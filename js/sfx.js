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

  // ---------- Activar/desactivar (checkbox de ajustes) ----------
  // Pedido explícito: "añade a configuracion otro checkbox que desconecte
  // los efectos de sonido (ojo! en un futuro habra musica, pero eso ira
  // por un lado distinto a los efectos de sonido)" — mismo patrón que
  // Shadows (js/shadows.js): su propia clave en localStorage, su propio
  // "enabled", nada compartido con lo que sea que use la música el día de
  // mañana. Silenciar TODO el módulo con un único nodo de ganancia maestro
  // (this.master) en vez de tener que acordarse de comprobar "enabled" en
  // cada método (_pluck, hit, glory, captureVillage...) es a prueba de
  // descuidos: cualquier sonido nuevo que se añada más adelante queda
  // mudo automáticamente si el checkbox está desmarcado, sin tocar nada
  // más que este bloque.
  _STORAGE_KEY: "gnomoregnomes_sfx",
  enabled: true,

  init() {
    const saved = localStorage.getItem(this._STORAGE_KEY);
    this.enabled = saved === null ? true : saved === "1";
    if (this.master) this.master.gain.value = this.enabled ? 1 : 0;
  },

  setEnabled(enabled) {
    this.enabled = !!enabled;
    localStorage.setItem(this._STORAGE_KEY, this.enabled ? "1" : "0");
    if (this.master) this.master.gain.value = this.enabled ? 1 : 0;
  },

  ensureCtx() {
    if (this.ctx) return this.ctx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    this.ctx = new AudioCtx();
    // Compresor a la salida: permite subir el volumen de los tonos sin riesgo
    // de que se distorsionen si alguna vez llegan a solaparse dos sonidos.
    this.master = this.ctx.createGain();
    // Arranca ya silenciado si el checkbox estaba desmarcado (ver
    // setEnabled arriba) — el contexto de audio se crea de forma perezosa
    // en el primer sonido, así que "enabled" puede llevar rato fijado
    // antes de que master exista de verdad.
    this.master.gain.value = this.enabled ? 1 : 0;
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

  // Aterrizaje de un lanzamiento EXITOSO a una zona vacía (pedido explícito:
  // "lanzarlo a una zona dentro de tu rango de movimiento" — ver
  // GnomeInstance.executeThrowToTile en gnome.js). Usa la misma animación de
  // impacto que un pase fallido (GnomeInstance.landAt) pero con este sonido
  // en vez de dropFail(): triangular y más agudo, sin nada de "sawtooth
  // grave" — tiene que sonar a logro, no a error, aunque físicamente el
  // gnomo golpee el suelo igual en los dos casos.
  gnomeLandSoft() { this._pluck("gnome-land-soft", 480, "triangle", 0.16, 0.26); },

  // Un gnomo suelto perdiendo puntos al pasar turno (js/turns.js,
  // GnomeInstance._loseCooldownPoints) — a propósito NO reutiliza hit() (un
  // golpe de verdad, seco y agudo): esto es lo contrario, se está calmando,
  // así que suena grave y blando (sine en vez de square, más largo y suave)
  // en vez de un impacto.
  gnomeCooldown() { this._pluck("gnome-cooldown", 210, "sine", 0.28, 0.22); },

  // Grito del gnomo mientras vuela por el aire (Gnome.animateThrowTo) —
  // pedido explícito: "un sonido... como iiiiiiiiu o que den un gritito...
  // asegúrate de que sea un sonido de calidad".
  //
  // REHECHO — la primera versión (un único sawtooth crudo deslizándose hacia
  // abajo) sonaba a sirena/alarma en vez de a algo divertido ("muy
  // desagradable... no me gusta NADA", feedback directo de Jesús). El sonido
  // de un "lanzamiento" alegre de dibujos animados casi nunca es un sawtooth
  // solo: ese timbre tiene demasiados armónicos agudos crudos, se percibe
  // metálico/duro pite el oído lo asocie enseguida a un aviso de error, no a
  // diversión. Rehecho con tres cambios de fondo:
  //   1. DOS triangulares casi al unísono (osc1/osc2, desafinadas ±6 cents)
  //      en vez de un sawtooth — un triangle ya es mucho más suave de por sí
  //      (solo armónicos impares, más débiles), y dos voces casi idénticas
  //      sonando juntas dan ese "grosor" cálido de coro en vez de un pitido
  //      plano de sintetizador de un solo oscilador.
  //   2. Un pequeño "flick" de despegue: sube de tono en el primer 12% del
  //      vuelo antes de empezar a bajar — un salto que arranca "p'arriba" y
  //      LUEGO cae se lee como un lanzamiento juguetón (el clásico "wheee!"),
  //      mientras que deslizarse hacia abajo desde el primer instante (como
  //      hacía antes) se lee de entrada como una caída/alarma, no como una
  //      salida con ganas.
  //   3. Vibrato más lento y su mitad de profundo (6.5Hz/±12Hz en vez de
  //      11Hz/±26Hz) — suficiente para que no suene a tono robótico plano,
  //      sin llegar a temblar como un grito de socorro.
  // El filtro paso-bajo se mantiene (el corte baja en paralelo al tono, para
  // que el propio timbre se sienta "apagándose" al final, no solo más
  // grave), solo con un rango menos agresivo a juego con el resto.
  // duration en SEGUNDOS (a diferencia del resto de SFX, en ms) porque quien
  // llama a esto ya tiene la duración del vuelo en segundos a mano.
  gnomeFly(duration) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;
      const dur = Math.max(0.15, duration);
      const flickEnd = now + dur * 0.12;

      const osc1 = ctx.createOscillator();
      osc1.type = "triangle";
      osc1.detune.value = -6;
      const osc2 = ctx.createOscillator();
      osc2.type = "triangle";
      osc2.detune.value = 6;

      [osc1, osc2].forEach((osc) => {
        osc.frequency.setValueAtTime(560, now);
        osc.frequency.exponentialRampToValueAtTime(780, flickEnd); // "flick" de despegue hacia arriba
        osc.frequency.exponentialRampToValueAtTime(300, now + dur); // y luego cae hasta aterrizar
      });

      const vibrato = ctx.createOscillator();
      vibrato.type = "sine";
      vibrato.frequency.value = 6.5;
      const vibratoGain = ctx.createGain();
      vibratoGain.gain.value = 12;
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc1.frequency);
      vibratoGain.connect(osc2.frequency);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 0.7;
      filter.frequency.setValueAtTime(2600, now);
      filter.frequency.exponentialRampToValueAtTime(1400, now + dur);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.22, now + Math.min(0.09, dur * 0.25));
      gain.gain.setValueAtTime(0.22, now + Math.max(0, dur - 0.14));
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      // Suma las dos voces ANTES del filtro/envolvente compartidos (en vez
      // de duplicar filter+gain por voz) y compensa el volumen combinado
      // para que sumar una segunda voz no salga más fuerte que antes.
      const merge = ctx.createGain();
      merge.gain.value = 0.6;
      osc1.connect(merge);
      osc2.connect(merge);
      merge.connect(filter).connect(gain).connect(this.master);

      osc1.start(now);
      osc2.start(now);
      vibrato.start(now);
      osc1.stop(now + dur + 0.05);
      osc2.stop(now + dur + 0.05);
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

  // Puntos de Gloria (js/glory.js) — pedido explícito: "cuando alguna cosa
  // genera +X puntos de gloria, el icono de los puntos de gloria debe hacer
  // una animacion de pulsacion y escucharse un sonido de recompensa". Mini
  // arpegio ascendente de 3 notas (a diferencia de death(), que es solo 2 y
  // empieza con un golpe grave) para que suene a "tesoro"/moneda, no a
  // "victoria de combate" — nada de golpe seco inicial, solo brillo.
  glory() {
    this._pluck("glory-1", 660, "triangle", 0.18, 0.24);
    setTimeout(() => this._pluck("glory-2", 880, "triangle", 0.18, 0.24), 70);
    setTimeout(() => this._pluck("glory-3", 1180, "triangle", 0.3, 0.26), 140);
  },

  // Conquistar un tótem (Villages._capture) — pedido explícito: "un sonido
  // de satisfaccion, recuerda, dopamina en vena con todo". Más largo y más
  // "grande" que glory() de arriba a propósito (ese es el jingle genérico
  // de "+X gloria", este es el remate de haber ganado todo un tótem):
  // golpe grave de aterrizaje + arpegio de CUATRO notas (no tres) que sube
  // más alto y remata con una nota brillante sostenida, como una campana de
  // "jackpot" en vez de solo una moneda.
  captureVillage() {
    this._pluck("capture-thud", 130, "square", 0.16, 0.42);
    setTimeout(() => this._pluck("capture-1", 520, "triangle", 0.16, 0.28), 60);
    setTimeout(() => this._pluck("capture-2", 780, "triangle", 0.16, 0.28), 130);
    setTimeout(() => this._pluck("capture-3", 1040, "triangle", 0.18, 0.3), 200);
    setTimeout(() => this._pluck("capture-4", 1560, "triangle", 0.4, 0.34), 280);
  },

  // Mochila (js/backpack.js) — colocar un objeto sobre el tablero: un
  // "plop" corto y limpio, distinto del click de menú/UI para que se lea
  // como una acción sobre el propio tablero, no como navegación.
  itemPlace() {
    this._pluck("item-place", 460, "triangle", 0.14, 0.3);
    setTimeout(() => this._pluck("item-place-2", 700, "triangle", 0.12, 0.24), 70);
  },
  // El gnomo se come la Setarcoiris — mismo espíritu "dopamina en vena" que
  // captureVillage(), pero más juguetón/corto (comerse un aperitivo, no
  // conquistar un tótem): un mordisco grave seguido de un brillo rápido.
  itemEaten() {
    this._pluck("item-eaten-bite", 210, "square", 0.1, 0.36);
    setTimeout(() => this._pluck("item-eaten-sparkle", 980, "triangle", 0.22, 0.3), 90);
  },

  // Tienda Goblin (js/shops.js) — comprar un objeto: reutiliza el mismo
  // espíritu "tintineo de monedas" que glory()/captureVillage() (arpegio
  // ascendente y brillante, nada de golpe grave inicial: aquí no se ha
  // vencido a nadie, solo se ha hecho un buen trato), pero con solo dos
  // notas rápidas — más corto que captureVillage() a propósito, para que
  // comprar dos objetos seguidos no se sienta repetitivo ni pesado.
  buy() {
    this._pluck("buy-1", 720, "triangle", 0.14, 0.26);
    setTimeout(() => this._pluck("buy-2", 1040, "triangle", 0.2, 0.3), 80);
  },
};

document.addEventListener("DOMContentLoaded", () => SFX.init());

const SFX_TARGETS =
  ".menu-btn:not(:disabled), .option-card, .back-btn, .range-marker, .attack-marker, .unit, .unit-info-btn, " +
  ".catch-marker, .pass-marker, .gnome-action-btn, .settings-gear-btn, .settings-panel__option, " +
  ".backpack-btn, .backpack-slot:not(:disabled), .backpack-close-btn, " +
  // Tienda Goblin (js/shops.js) — reutiliza el popup de la mochila tal
  // cual (mismas clases .backpack-slot/.backpack-close-btn de arriba, ya
  // cubiertas), solo el botón COMPRAR es propio de este popup.
  ".shop-buy-btn:not(:disabled), " +
  // Pedido explícito: "el boton pasar turno no hace sonido cuando el
  // raton pasa sobre el" — faltaba en la lista de objetivos con sonido de
  // hover (ver js/turns.js, btn.className = "end-turn-btn"). :not(:disabled)
  // igual que .menu-btn/.backpack-slot de arriba: no suena durante el
  // turno rival, cuando turns.js pone btn.disabled = true.
  ".end-turn-btn:not(:disabled)";

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

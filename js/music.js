// Música de fondo con crossfade. Dos pistas en bucle: menús (MainTheme) y
// partida/tutorial (MushBoomForestMainTheme). La pista que toca depende de si
// #screen-board está activa. Cualquier cambio (menú↔partida, on/off) se hace
// con fundido cruzado. Los navegadores bloquean el audio hasta el primer gesto
// del usuario, así que la música arranca en el primer clic/tecla.
const Music = {
  _KEY_ON: "gnomoregnomes_music",
  _KEY_VOL: "gnomoregnomes_music_vol",
  FADE_MS: 1800,
  TRACKS: {
    menu: "assets/musica/MainTheme.mp3",
    match: "assets/musica/MushBoomForestMainTheme.mp3",
    rock: "assets/musica/RocknTrollaMainTheme.mp3", // Colinas Rock'n Troll
  },
  enabled: true,
  volume: 0.2,
  _els: {},
  _gain: { menu: 0, match: 0, rock: 0 },
  _duck: 1,
  _duckGoal: 1,
  _duckTimer: null,
  _target: null,
  _unlocked: false,
  _timer: null,
  _last: 0,

  init() {
    try {
      const on = localStorage.getItem(this._KEY_ON);
      this.enabled = on === null ? true : on === "1";
      const v = parseFloat(localStorage.getItem(this._KEY_VOL));
      this.volume = isNaN(v) ? 0.2 : Math.min(1, Math.max(0, v));
    } catch (e) {}
    for (const k of Object.keys(this.TRACKS)) {
      const a = new Audio();
      a.src = this.TRACKS[k];
      a.loop = true;
      a.preload = k === "rock" ? "metadata" : "auto";
      a.volume = 0;
      this._els[k] = a;
    }
    const unlock = () => {
      if (this._unlocked) return;
      this._unlocked = true;
      ["pointerdown", "keydown", "touchstart"].forEach((ev) => document.removeEventListener(ev, unlock, true));
      this._refresh();
    };
    ["pointerdown", "keydown", "touchstart"].forEach((ev) => document.addEventListener(ev, unlock, true));
    const board = document.getElementById("screen-board");
    if (board) new MutationObserver(() => this._refresh()).observe(board, { attributes: true, attributeFilter: ["class"] });
    this._refresh();
  },

  _wanted() {
    if (!this.enabled) return null;
    const board = document.getElementById("screen-board");
    if (!(board && board.classList.contains("screen--active"))) return "menu";
    return typeof LevelAssets !== "undefined" && LevelAssets.current === "colinas_rockntroll" ? "rock" : "match";
  },

  _refresh() {
    if (!this._unlocked) return;
    this._target = this._wanted();
    for (const k of Object.keys(this._els)) {
      if (k === this._target && this._els[k].paused) {
        const p = this._els[k].play();
        if (p && p.catch) p.catch(() => {});
      }
    }
    this._startLoop();
  },

  _startLoop() {
    if (this._timer) return;
    this._last = performance.now();
    this._timer = setInterval(() => this._tick(), 50);
  },

  _tick() {
    const now = performance.now();
    const dt = now - this._last;
    this._last = now;
    const step = dt / this.FADE_MS;
    let busy = false;
    for (const k of Object.keys(this._els)) {
      const goal = k === this._target ? 1 : 0;
      let g = this._gain[k];
      if (g < goal) g = Math.min(goal, g + step);
      else if (g > goal) g = Math.max(goal, g - step);
      if (g !== goal) busy = true;
      this._gain[k] = g;
      const a = this._els[k];
      a.volume = Math.min(1, Math.max(0, g * this.volume * this._duck));
      if (g === 0 && !a.paused && k !== this._target) a.pause();
    }
    // Atenuación temporal (Music.duck): baja rápido, vuelve despacio.
    if (this._duck !== this._duckGoal) {
      busy = true;
      const up = this._duckGoal > this._duck;
      const st = dt / (up ? 1000 : 150) * 0.8;
      this._duck = up ? Math.min(this._duckGoal, this._duck + st) : Math.max(this._duckGoal, this._duck - st);
    }
    if (!busy) { clearInterval(this._timer); this._timer = null; }
  },

  // Baja la música al 20 % durante `ms` (p. ej. mientras suenan los Tambores de Guerra) y la devuelve.
  duck(ms) {
    this._duckGoal = 0.2;
    if (this._duckTimer) clearTimeout(this._duckTimer);
    this._duckTimer = setTimeout(() => { this._duckGoal = 1; this._startLoop(); }, ms);
    this._startLoop();
  },

  setEnabled(on) {
    this.enabled = !!on;
    try { localStorage.setItem(this._KEY_ON, this.enabled ? "1" : "0"); } catch (e) {}
    this._refresh();
  },

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, v));
    try { localStorage.setItem(this._KEY_VOL, String(this.volume)); } catch (e) {}
    for (const k of Object.keys(this._els)) this._els[k].volume = Math.min(1, this._gain[k] * this.volume * this._duck);
  },
};
document.addEventListener("DOMContentLoaded", () => Music.init());

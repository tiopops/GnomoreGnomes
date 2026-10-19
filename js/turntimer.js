/* Gnomore Gnomes — reloj de turno de la Partida Rápida online (js/matchmaking.js).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Contar TURN_TIMER_MS desde que el tablero queda libre en cada turno.
     - Enseñar el tiempo restante dentro del botón PASAR TURNO (el de quien juega).
     - Pasar el turno automáticamente si TÚ te quedas sin tiempo.
   Solo existe en partidas con Net.mm (emparejadas por SK); amigos e IA van sin reloj.
   El rival hace lo mismo en su cliente, así que nunca se espera a alguien que se haya ido. */

const TURN_TIMER_MS = 90000;
const TURN_TIMER_WARN_MS = 15000;

const TurnTimer = {
  _el: null,
  _iv: null,
  _key: "",
  _deadline: 0,
  _lastSec: -1,

  start() {
    if (this._iv) return;
    this._iv = setInterval(() => this._tick(), 250);
  },
  stop() {
    clearInterval(this._iv);
    this._iv = null;
    this._key = "";
    this._deadline = 0;
    if (this._el) { this._el.remove(); this._el = null; }
  },

  _ensure() {
    if (this._el && this._el.isConnected) return this._el;
    const lab = typeof Turns !== "undefined" && Turns._btnLabelEl ? Turns._btnLabelEl : null;
    if (!lab || !lab.parentNode) return null;
    const el = document.createElement("span");
    el.className = "end-turn-btn__timer";
    lab.parentNode.insertBefore(el, lab);
    this._el = el;
    return el;
  },

  _tick() {
    const on = typeof Net !== "undefined" && Net.active && Net.mm && !Net.ended && Net._go && !(typeof Obelisks !== "undefined" && Obelisks.gameOver);
    if (!on) { if (this._el) { this._el.remove(); this._el = null; } this._key = ""; this._deadline = 0; return; }
    const mine = Turns.activeTeam === Net.myTeam;
    const key = Turns.activeTeam + "#" + Turns.roundNumber;
    if (key !== this._key) { this._key = key; this._deadline = 0; this._lastSec = -1; }
    // Mi reloj arranca cuando el tablero queda libre (tras los carteles y animaciones); el del rival, ya.
    if (!this._deadline && (!mine || !Turns._aiRunning)) this._deadline = Date.now() + TURN_TIMER_MS;
    const el = this._ensure();
    if (!el || !this._deadline) { if (el) el.textContent = ""; return; }
    const left = Math.max(0, this._deadline - Date.now());
    const sec = Math.ceil(left / 1000);
    const warn = left <= TURN_TIMER_WARN_MS;
    el.className = "end-turn-btn__timer" + (mine ? " end-turn-btn__timer--mine" : " end-turn-btn__timer--rival") + (warn ? " end-turn-btn__timer--warn" : "");
    if (sec !== this._lastSec) {
      this._lastSec = sec;
      el.innerHTML = '<i class="ph-bold ph-hourglass-medium"></i>' + Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
      if (mine && warn && sec > 0 && typeof SFX !== "undefined" && SFX.turnWarn) { try { SFX.turnWarn(sec); } catch (e) {} }
    }
    if (mine && left <= 0 && !Turns._aiRunning) Net.localEndTurn();
  },
};

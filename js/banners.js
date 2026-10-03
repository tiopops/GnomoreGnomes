// Cola de carteles de pantalla: se muestran uno tras otro, nunca a la vez.
// Menor `priority` = antes (¡ES TU TURNO! = 0, el resto = 1).
const Banners = {
  _q: [],
  _busy: false,
  _seq: 0,

  // item: { priority, duration (ms), show(), hide() }. Devuelve { started, ended }.
  enqueue(item) {
    let startedRes, endedRes;
    const started = new Promise((r) => (startedRes = r));
    const ended = new Promise((r) => (endedRes = r));
    this._q.push(Object.assign({ priority: 1, duration: 2600, seq: this._seq++, startedRes, endedRes }, item));
    setTimeout(() => this._next(), 0);
    return { started, ended };
  },

  async _next() {
    if (this._busy || this._q.length === 0) return;
    this._busy = true;
    this._q.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
    const it = this._q.shift();
    try { it.show && it.show(); } catch (e) { console.error(e); }
    it.startedRes();
    await new Promise((r) => setTimeout(r, it.duration));
    try { it.hide && it.hide(); } catch (e) { console.error(e); }
    it.endedRes();
    await new Promise((r) => setTimeout(r, 250));
    this._busy = false;
    this._next();
  },

  clear() {
    this._q.forEach((it) => { it.startedRes(); it.endedRes(); });
    this._q = [];
  },

  // Cartel genérico de texto central (mismo estilo que ¡ES TU TURNO!).
  text(text, priority = 1) {
    let el;
    return this.enqueue({
      priority,
      duration: 2100,
      show: () => {
        el = document.createElement("div");
        el.className = "turn-banner";
        el.innerHTML = '<span class="turn-banner__text">' + text + "</span>";
        document.body.appendChild(el);
      },
      hide: () => el && el.remove(),
    });
  },
};

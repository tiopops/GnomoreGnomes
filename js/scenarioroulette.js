/* Gnomore Gnomes — ruleta de escenarios de la Partida Rápida.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Barajar a la vista todos los escenarios disponibles (LEVELS con available),
       frenar poco a poco y quedarse en el que dice la sala (el resultado ya viene
       decidido: los dos jugadores ven el mismo), mostrarlo y terminar.
     - Los sonidos de la ruleta (SFX.scenarioTick / SFX.scenarioLock).
   Uso: await ScenarioRoulette.play(idDelEscenario) → se resuelve al acabar;
   ScenarioRoulette.hide() lo retira (js/mp-lobby.js lo llama al empezar la partida). */

Object.assign(STRINGS.es, { mm_scenario: "ESCENARIO" });
Object.assign(STRINGS.en, { mm_scenario: "SCENARIO" });

const ScenarioRoulette = {
  _el: null,

  _levels() {
    return (typeof LEVELS !== "undefined" ? LEVELS : []).filter((l) => l.available && !l.experimental);
  },

  _cardHtml(l) {
    return `<img src="${l.islandImg || ""}" alt="" draggable="false"><span>${Account._esc(I18N.t(l.nameKey))}</span>`;
  },

  play(targetId) {
    this.hide();
    const levels = this._levels();
    const target = levels.find((l) => l.id === targetId) || levels[0];
    if (!target) return Promise.resolve();
    const el = document.createElement("div");
    el.className = "mp-overlay sr-overlay";
    el.innerHTML = `<div class="mp-panel mp-panel--small p5-banner sr-panel"><div class="mp-body">
      <div class="p5-banner__label settings-panel__title">${I18N.t("mm_scenario")}</div>
      <div class="sr-card"><div class="sr-card__in"></div></div>
    </div></div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("mp-overlay--visible"));
    this._el = el;
    const card = el.querySelector(".sr-card");
    const inner = el.querySelector(".sr-card__in");

    // Secuencia: vueltas completas por los escenarios, cada vez más lentas, acabando en el elegido.
    const seq = [];
    const n = levels.length;
    const steps = 16 + (n > 1 ? (n - ((16 + (levels.indexOf(target) - 0)) % n)) % n : 0);
    let idx = Math.floor(Math.random() * n);
    const targetIdx = levels.indexOf(target);
    for (let i = 0; i < steps; i++) { seq.push(levels[idx % n]); idx++; }
    // Ajuste para que la última carta sea siempre la elegida.
    seq.push(target);
    const total = seq.length;

    return new Promise((resolve) => {
      let i = 0;
      const tick = () => {
        if (this._el !== el) return resolve();
        const l = seq[i];
        inner.innerHTML = this._cardHtml(l);
        card.classList.remove("sr-card--flip"); void card.offsetWidth; card.classList.add("sr-card--flip");
        const last = i === total - 1;
        if (typeof SFX !== "undefined") { try { last ? SFX.scenarioLock() : SFX.scenarioTick(i); } catch (e) {} }
        if (last) {
          card.classList.add("sr-card--lock");
          el.classList.add("sr-overlay--locked");
          setTimeout(resolve, 1500);
          return;
        }
        i++;
        const p = i / total; // 0 → 1: de rápido a lento
        setTimeout(tick, 70 + Math.pow(p, 3) * 420);
      };
      tick();
    });
  },

  hide() {
    if (!this._el) return;
    const el = this._el;
    this._el = null;
    el.classList.remove("mp-overlay--visible");
    setTimeout(() => el.remove(), 320);
  },
};

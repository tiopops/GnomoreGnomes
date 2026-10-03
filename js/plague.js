/* Gnomore Gnomes — Plaga Gnoma.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Detectar el turno 15 (Turns.roundNumber) y quién va perdiendo en ese
       momento (Turns.losingTeam, mismo criterio que la IA).
     - Lanzar la alerta en pantalla y soltar 10 gnomos sueltos repartidos
       por el mapa durante el turno 15 de ESE jugador. Los gnomos son
       gnomos normales (Gnome.spawnNear): huyen igual que cualquier otro
       cuando un personaje se les acerca, esa mecánica no se toca aquí.

   Pedido explícito: "cuando llegue el turno 15 debe aparecer un mensaje en
   pantalla como de alarma, indicando que se acerca una plaga Gnoma! (efecto
   de alerta por un instante) durante el turno 15 del jugador que vaya
   perdiendo. apareceran 10 gnomos repartidos por el mapa con su movimiento
   de huir."

   Decisiones de diseño: "turno 15" = ronda 15 (misma cuenta que el
   contador sobre el botón de pasar turno); quién pierde se decide UNA vez,
   al empezar esa ronda, y la plaga salta al empezar el turno de ese bando
   (si es el rival, durante su turno). Si van exactamente igual, se sortea. */

const PLAGUE_ROUND = 15;
const PLAGUE_GNOME_COUNT = 10;
const PLAGUE_ALERT_MS = 2600;

const Plague = {
  _fired: false,
  _target: null, // bando que sufre la plaga (se fija al empezar la ronda 15)
  _alertEl: null,
  _flashEl: null,

  resetAll() {
    this._fired = false;
    this._target = null;
    if (this._alertEl) this._alertEl.classList.remove("plague-alert--visible");
    if (this._flashEl) this._flashEl.classList.remove("plague-flash--visible");
  },

  async onTurnStart(team) {
    if (this._fired) return;
    if (typeof Turns === "undefined" || Turns.roundNumber !== PLAGUE_ROUND) return;
    if (typeof Obelisks !== "undefined" && Obelisks.gameOver) return;
    if (!this._target) {
      this._target = Turns.losingTeam() || (Teams.all[Math.floor(Math.random() * Teams.all.length)]);
    }
    if (team !== this._target) return;
    this._fired = true;
    await this._trigger();
  },

  async _trigger() {
    // El aviso espera su turno en la cola de carteles (tras ¡ES TU TURNO!).
    const b = Banners.enqueue({ priority: 1, duration: 2600, show: () => this._showAlert() });
    await b.started;
    if (typeof SFX !== "undefined" && SFX.alarm) SFX.alarm();
    await new Promise((resolve) => setTimeout(resolve, 1300));
    await this._spawnGnomes();
    await new Promise((resolve) => setTimeout(resolve, 900));
  },

  // Reparte PLAGUE_GNOME_COUNT gnomos: por cada uno prueba unas cuantas
  // losetas al azar y se queda con la más alejada de los gnomos ya soltados
  // en esta plaga (reparto uniforme por el mapa), y deja a Gnome.spawnNear
  // resolver la loseta libre más cercana.
  async _spawnGnomes() {
    if (typeof Gnome === "undefined" || typeof Units === "undefined") return;
    const size = Units.boardSize;
    const placed = [];
    for (let i = 0; i < PLAGUE_GNOME_COUNT; i++) {
      let best = null;
      let bestDist = -1;
      for (let a = 0; a < 40; a++) {
        const row = Math.floor(Math.random() * size);
        const col = Math.floor(Math.random() * size);
        if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) continue;
        const d = placed.reduce((min, p) => Math.min(min, Math.max(Math.abs(p.row - row), Math.abs(p.col - col))), Infinity);
        if (d > bestDist) {
          bestDist = d;
          best = { row, col };
        }
      }
      if (!best) continue;
      const g = Gnome.spawnNear(best.row, best.col);
      placed.push({ row: g && g.row != null ? g.row : best.row, col: g && g.col != null ? g.col : best.col });
      await new Promise((resolve) => setTimeout(resolve, 90));
    }
    if (typeof Fog !== "undefined" && Fog.applyVisibility) Fog.applyVisibility();
  },

  _showAlert() {
    if (!this._alertEl) {
      const el = document.createElement("div");
      el.className = "plague-alert";
      el.innerHTML =
        '<i class="ph ph-warning plague-alert__icon"></i>' +
        '<span class="p5-banner__label">¡ALERTA! ¡Se acerca una plaga Gnoma!</span>';
      document.body.appendChild(el);
      this._alertEl = el;
      const flash = document.createElement("div");
      flash.className = "plague-flash";
      document.body.appendChild(flash);
      this._flashEl = flash;
    }
    [this._alertEl, this._flashEl].forEach((el) => el.classList.remove("plague-alert--visible", "plague-flash--visible"));
    void this._alertEl.offsetWidth;
    this._alertEl.classList.add("plague-alert--visible");
    this._flashEl.classList.add("plague-flash--visible");
  },
};

if (typeof Turns !== "undefined") Turns.registerTurnStartListener(Plague);

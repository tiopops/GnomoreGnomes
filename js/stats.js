/* Gnomore Gnomes — estadísticas del jugador (por cuenta).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Anotar el resultado de cada partida (victoria/derrota/empate, online o
       contra la IA, raza usada, tótems capturados, bajas enemigas).
     - Guardarlo en Firestore (stats/{uid}) y leerlo para el menú de usuario.
     - Pintar el bloque de estadísticas dentro del menú de usuario (auth.js).
   No cuenta el tutorial ni las partidas sin sesión iniciada. Si falla la red,
   la partida queda pendiente en el navegador y se reenvía al volver a entrar.
   Rango (siempre 0 por ahora), desbloqueos y misión diaria: DESACTIVADOS. */

const PlayerStats = {
  _matchDone: false,
  _cache: null, // última lectura del servidor
  _captures: 0,

  get _db() { return typeof Account !== "undefined" ? Account._db : null; },
  get _uid() { return typeof Account !== "undefined" && Account._user ? Account._user.uid : null; },

  init() {
    document.addEventListener("gg:authchange", (e) => {
      this._cache = null;
      if (e.detail && e.detail.user) this._flush();
    });
  },

  // Villages._capture avisa cada vez que EL JUGADOR conquista un tótem.
  recordCapture() { this._captures++; },

  // Se llama al empezar cada partida (Obelisks.init) para empezar de cero.
  startMatch() {
    this._matchDone = false;
    this._captures = 0;
  },

  // Obelisks._endGame -> resultado de la partida.
  recordEnd(winnerTeam) {
    this._submit(winnerTeam == null ? "draw" : winnerTeam === "player" ? "win" : "loss");
  },

  // El jugador abandona una partida online: cuenta como derrota.
  recordResign() { this._submit("loss"); },

  _submit(result) {
    if (this._matchDone) return;
    if (typeof Tutorial !== "undefined" && Tutorial.active) return;
    const uid = this._uid;
    if (!uid) return;
    this._matchDone = true;
    let kills = 0;
    if (typeof Obelisks !== "undefined" && Obelisks._deaths) {
      Object.keys(Obelisks._deaths).forEach((t) => { if (t !== "player") kills += Obelisks._deaths[t] || 0; });
    }
    const m = {
      result,
      online: typeof Net !== "undefined" && !!Net.active,
      race: (typeof Obelisks !== "undefined" && Obelisks._raceIds && Obelisks._raceIds.player) || null,
      totems: this._captures,
      kills,
    };
    this._send(uid, [m]);
  },

  _pendingKey(uid) { return "gg_stats_pending_" + uid; },
  _loadPending(uid) { try { return JSON.parse(localStorage.getItem(this._pendingKey(uid)) || "[]"); } catch (e) { return []; } },
  _savePending(uid, list) { try { localStorage.setItem(this._pendingKey(uid), JSON.stringify(list)); } catch (e) {} },

  async _send(uid, matches) {
    const pending = this._loadPending(uid).concat(matches);
    this._savePending(uid, pending);
    await this._flush();
  },

  async _flush() {
    const uid = this._uid;
    const db = this._db;
    if (!uid || !db || this._flushing) return;
    const list = this._loadPending(uid);
    if (!list.length) return;
    this._flushing = true;
    try {
      const ref = db.collection("stats").doc(uid);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const s = this._normalize(snap.exists ? snap.data() : {});
        list.forEach((m) => this._apply(s, m));
        tx.set(ref, s);
        this._cache = s;
      });
      this._savePending(uid, []);
    } catch (e) {
      console.warn("stats:", e && e.code);
    }
    this._flushing = false;
  },

  _normalize(d) {
    const n = (v) => (typeof v === "number" && v >= 0 ? Math.floor(v) : 0);
    const races = {};
    const src = d && typeof d.races === "object" && d.races ? d.races : {};
    Object.keys(src).forEach((k) => { races[k] = { g: n(src[k] && src[k].g), w: n(src[k] && src[k].w) }; });
    return {
      games: n(d.games), wins: n(d.wins), losses: n(d.losses), draws: n(d.draws),
      streak: n(d.streak), bestStreak: n(d.bestStreak),
      onlineGames: n(d.onlineGames), onlineWins: n(d.onlineWins),
      aiGames: n(d.aiGames), aiWins: n(d.aiWins),
      totems: n(d.totems), kills: n(d.kills), races,
    };
  },

  _apply(s, m) {
    s.games++;
    const win = m.result === "win";
    if (win) s.wins++; else if (m.result === "loss") s.losses++; else s.draws++;
    s.streak = win ? s.streak + 1 : 0;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    if (m.online) { s.onlineGames++; if (win) s.onlineWins++; } else { s.aiGames++; if (win) s.aiWins++; }
    s.totems += m.totems || 0;
    s.kills += m.kills || 0;
    if (m.race) {
      const r = s.races[m.race] || (s.races[m.race] = { g: 0, w: 0 });
      r.g++;
      if (win) r.w++;
    }
  },

  async load() {
    const uid = this._uid;
    const db = this._db;
    if (!uid || !db) return this._normalize({});
    await this._flush();
    try {
      const snap = await db.collection("stats").doc(uid).get();
      this._cache = this._normalize(snap.exists ? snap.data() : {});
    } catch (e) {
      console.warn("stats:", e && e.code);
      if (!this._cache) this._cache = this._normalize({});
    }
    return this._cache;
  },

  // ---------- Vista (dentro del menú de usuario) ----------
  _cell(icon, value, label) {
    return `<div class="pstat-cell"><i class="ph-fill ph-${icon}"></i><div><b>${value}</b><span>${label}</span></div></div>`;
  },
  _pct(w, g) { return g ? Math.round((100 * w) / g) + "%" : "—"; },

  html(s) {
    const races = (typeof RACES !== "undefined" ? RACES : []).filter((r) => r.available);
    const raceRows = races
      .map((r) => {
        const x = s.races[r.id] || { g: 0, w: 0 };
        return `<div class="pstat-race"><img src="${r.iconImg}" alt="" draggable="false"><div class="pstat-race__t">${I18N.t(r.nameKey)}<em>${x.g} ${x.g === 1 ? "partida" : "partidas"}</em></div><div class="pstat-race__v">${this._pct(x.w, x.g)}</div></div>`;
      })
      .join("");
    return `
      <div class="pstat-rank">
        <div class="pstat-rank__badge">0</div>
        <div class="pstat-rank__t">Rango<em>Nivel 0</em></div>
      </div>
      <div class="pstat-tabs">
        <span class="pstat-tab pstat-tab--on">Estadísticas</span>
        <span class="pstat-tab pstat-off"><i class="ph-fill ph-lock"></i> Desbloqueos</span>
      </div>
      <div class="pstat-sec">Partidas</div>
      <div class="pstat-grid">
        ${this._cell("game-controller", s.games, "Jugadas")}
        ${this._cell("trophy", s.wins, "Victorias")}
        ${this._cell("percent", this._pct(s.wins, s.games), "Ratio de victorias")}
        ${this._cell("fire", s.bestStreak, "Mejor racha")}
      </div>
      <div class="pstat-sec">Online y contra la IA</div>
      <div class="pstat-grid">
        ${this._cell("users", `${s.onlineWins} / ${s.onlineGames}`, "Online ganadas")}
        ${this._cell("target", `${s.aiWins} / ${s.aiGames}`, "Contra la IA")}
      </div>
      <div class="pstat-sec">Récords</div>
      <div class="pstat-grid">
        ${this._cell("flag-banner", s.totems, "Tótems capturados")}
        ${this._cell("sword", s.kills, "Bajas enemigas")}
      </div>
      <div class="pstat-sec">Razas</div>
      <div class="pstat-races">${raceRows}</div>
      <div class="pstat-sec">Misión del día</div>
      <div class="pstat-mission pstat-off"><i class="ph-fill ph-calendar-check"></i><div>Próximamente<em>Misiones y rachas diarias</em></div></div>`;
  },

  // Rellena el contenedor del menú de usuario (auth.js) con las estadísticas.
  async mount(el) {
    if (!el) return;
    el.innerHTML = this.html(this._cache || this._normalize({}));
    const s = await this.load();
    if (el.isConnected) el.innerHTML = this.html(s);
  },
};
document.addEventListener("DOMContentLoaded", () => PlayerStats.init());

/* Gnomore Gnomes — Partida Rápida online: emparejamiento por SK (Skill Rating).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Ponerte en la cola de búsqueda (mmQueue/{uid}) con tu SK y mantenerte "vivo".
     - Buscar al rival en cola con el SK más cercano al tuyo (el mismo SK si lo hay)
       y crear con él una sala (rooms/{id} con mm:true) en una transacción: si dos
       jugadores se encuentran a la vez, solo uno de los dos intentos se queda la sala.
     - Mostrar el indicador de búsqueda (radar) y cancelar.
     - Entregar la sala a MPLobby (js/mp-lobby.js): ahí cada uno elige equipo; el
       escenario lo sortea el servidor de salas (aquí, el que crea la sala) y la partida
       empieza sola cuando los dos están listos. Reglas: 1 contra 1, 30 rondas y reloj
       de turno (js/turntimer.js).
   Datos (reglas en firebase/firestore.rules):
     mmQueue/{uid}: { uid, name, sk, ts, status:'searching'|'matched', roomId } */

Object.assign(STRINGS.es, {
  mm_quick: "PARTIDA RÁPIDA",
  mm_title: "PARTIDA RÁPIDA",
  mm_searching: "BUSCANDO RIVAL",
  mm_found: "¡RIVAL ENCONTRADO!",
  mm_cancel: "CANCELAR",
  mm_err: "No se ha podido buscar partida.",
  mm_random_level: "Escenario al azar",
  mm_afk: "Tu rival no ha confirmado a tiempo.",
});
Object.assign(STRINGS.en, {
  mm_quick: "QUICK MATCH",
  mm_title: "QUICK MATCH",
  mm_searching: "SEARCHING FOR AN OPPONENT",
  mm_found: "OPPONENT FOUND!",
  mm_cancel: "CANCEL",
  mm_err: "Could not search for a match.",
  mm_random_level: "Random level",
  mm_afk: "Your opponent did not confirm in time.",
});

const MM_STALE_MS = 20000; // un ticket sin latido en este tiempo ya no cuenta
const MM_BEAT_MS = 6000;
const MM_SEEK_MS = 2500;

const Matchmaking = {
  _active: false,
  _handled: false,
  _busy: false,
  _ref: null,
  _unsub: null,
  _poll: null,
  _beat: null,
  _clock: null,
  _t0: 0,
  _el: null,
  _info: null, // { uid, name, sk }

  get _db() { return Account._db; },
  t(k, v) { return I18N.t(k, v); },

  // ---------- Entrada ----------
  async start() {
    if (this._active) return;
    if (typeof MPLobby === "undefined" || !MPLobby._uid || MPLobby._roomId || MPLobby._inMatch()) return;
    const db = this._db;
    if (!db) { MPLobby._toast(this.t("mm_err")); return; }
    if (typeof Progress !== "undefined" && !Progress._loaded) { try { await Progress.load(); } catch (e) {} }
    this._info = { uid: MPLobby._uid, name: MPLobby._name, sk: typeof Progress !== "undefined" ? Progress.sk : 1000 };
    this._active = true;
    this._handled = false;
    this._busy = false;
    this._t0 = Date.now();
    this._show();
    try {
      this._ref = db.collection("mmQueue").doc(this._info.uid);
      await this._ref.set({ uid: this._info.uid, name: this._info.name, sk: this._info.sk, ts: Date.now(), status: "searching", roomId: null });
    } catch (e) {
      console.warn("mm:", e && e.code);
      this._abort(this.t("mm_err"));
      return;
    }
    this._unsub = this._ref.onSnapshot(
      (snap) => {
        const d = snap.exists ? snap.data() : null;
        if (d && d.status === "matched" && d.roomId) this._onMatched(d.roomId);
      },
      (e) => { console.warn("mm:", e && e.code); this._abort(this.t("mm_err")); }
    );
    this._beat = setInterval(() => { if (!this._handled) this._ref.update({ ts: Date.now() }).catch(() => {}); }, MM_BEAT_MS);
    this._poll = setInterval(() => this._seek(), MM_SEEK_MS);
    this._ping = setInterval(() => { if (this._active && !this._handled && typeof SFX !== "undefined") { try { SFX.radarPing(); } catch (e) {} } }, 2500);
    try { SFX.radarPing(); } catch (e) {}
    this._seek();
  },

  async cancel() {
    if (!this._active) return;
    const ref = this._ref;
    this._stopTimers();
    this._active = false;
    this._hide();
    if (ref && !this._handled) { try { await ref.delete(); } catch (e) {} }
  },

  _abort(msg) {
    const ref = this._ref;
    this._stopTimers();
    this._active = false;
    this._hide();
    if (ref) ref.delete().catch(() => {});
    if (msg && typeof MPLobby !== "undefined") MPLobby._toast(msg);
  },

  _stopTimers() {
    clearInterval(this._poll); clearInterval(this._beat); clearInterval(this._clock); clearInterval(this._ping);
    this._poll = this._beat = this._clock = this._ping = null;
    if (this._unsub) { this._unsub(); this._unsub = null; }
  },

  // ---------- Búsqueda del rival ----------
  async _seek() {
    if (!this._active || this._handled || this._busy) return;
    const me = this._info;
    this._busy = true;
    try {
      const snap = await this._db.collection("mmQueue").where("ts", ">", Date.now() - MM_STALE_MS).limit(40).get();
      const cands = [];
      snap.forEach((d) => { const c = d.data(); if (c && c.uid !== me.uid && c.status === "searching" && typeof c.sk === "number") cands.push(c); });
      if (!cands.length || this._handled) return;
      // El SK más cercano al mío (el mismo si lo hay); a igualdad, quien lleva más esperando.
      cands.sort((a, b) => Math.abs(a.sk - me.sk) - Math.abs(b.sk - me.sk) || a.ts - b.ts);
      await this._tryMatch(cands[0]);
    } catch (e) {
      console.warn("mm:", e && e.code);
    } finally {
      this._busy = false;
    }
  },

  async _tryMatch(c) {
    const db = this._db, me = this._info;
    const roomRef = db.collection("rooms").doc();
    const candRef = db.collection("mmQueue").doc(c.uid);
    const levels = (typeof LEVELS !== "undefined" ? LEVELS : []).filter((l) => l.available && !l.experimental);
    const level = levels.length ? levels[Math.floor(Math.random() * levels.length)].id : "mushboom_forest";
    try {
      await db.runTransaction(async (tx) => {
        const a = await tx.get(this._ref);
        const b = await tx.get(candRef);
        if (!a.exists || a.data().status !== "searching") throw new Error("self");
        if (!b.exists || b.data().status !== "searching" || Date.now() - b.data().ts > MM_STALE_MS + 5000) throw new Error("gone");
        tx.set(roomRef, {
          hostUid: me.uid, hostName: me.name, guestUid: c.uid, guestName: b.data().name,
          status: "lobby", level, hostRace: null, guestRace: null, hostReady: false, guestReady: false,
          guestJoined: false, guestDeclined: false, createdAt: Date.now(),
          mm: true, hostSk: me.sk, guestSk: b.data().sk,
        });
        tx.update(candRef, { status: "matched", roomId: roomRef.id });
        tx.update(this._ref, { status: "matched", roomId: roomRef.id });
      });
    } catch (e) {
      // Otro jugador se nos adelantó o el rival se fue: seguimos buscando.
    }
  },

  // ---------- Encontrado ----------
  async _onMatched(roomId) {
    if (this._handled) return;
    this._handled = true;
    this._stopTimers();
    const ref = this._ref;
    try {
      const snap = await this._db.collection("rooms").doc(roomId).get();
      if (!snap.exists) throw new Error("noroom");
      const d = snap.data();
      const host = d.hostUid === this._info.uid;
      const other = host ? d.guestName : d.hostName;
      this._foundUi(other);
      if (typeof SFX !== "undefined" && SFX.matchFound) { try { SFX.matchFound(); } catch (e) {} }
      await new Promise((r) => setTimeout(r, 1500));
      if (!this._active) return; // cancelado justo ahora
      if (ref) ref.delete().catch(() => {});
      this._active = false;
      this._hide();
      await MPLobby.joinMatched(roomId, host);
    } catch (e) {
      console.warn("mm:", e);
      this._active = false;
      this._hide();
      if (ref) ref.delete().catch(() => {});
      MPLobby._toast(this.t("mm_err"));
    }
  },

  // ---------- Vista ----------
  _show() {
    this._hide();
    const el = document.createElement("div");
    el.className = "mp-overlay mm-overlay";
    el.innerHTML = `<div class="mp-panel mp-panel--small p5-banner mm-panel"><div class="mp-body">
      <div class="p5-banner__label settings-panel__title">${this.t("mm_title")}</div>
      <div class="mm-radar"><i class="mm-radar__ring"></i><i class="mm-radar__ring mm-radar__ring--2"></i><i class="mm-radar__ring mm-radar__ring--3"></i>
        <i class="mm-radar__sweep"></i><div class="mm-radar__core"><i class="ph-fill ph-lightning"></i></div></div>
      <div class="mm-state"><span class="mm-state__t">${this.t("mm_searching")}<em class="mm-dots"><i>.</i><i>.</i><i>.</i></em></span><b class="mm-clock">0:00</b></div>
      <div class="mp-actions"><button type="button" class="p5-banner p5-banner--action mp-btn" data-act="cancel" style="--p5-tone:#5a1d1d"><span class="p5-banner__label">${this.t("mm_cancel")}</span></button></div>
    </div></div>`;
    el.querySelector('[data-act="cancel"]').addEventListener("click", () => { if (typeof SFX !== "undefined") SFX.click(); this.cancel(); });
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("mp-overlay--visible"));
    this._el = el;
    clearInterval(this._clock);
    this._clock = setInterval(() => {
      const c = el.querySelector(".mm-clock");
      if (!c || !c.isConnected) return;
      const s = Math.floor((Date.now() - this._t0) / 1000);
      c.textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    }, 500);
  },

  _foundUi(name) {
    if (!this._el) return;
    clearInterval(this._clock);
    this._el.classList.add("mm-overlay--found");
    const st = this._el.querySelector(".mm-state");
    if (st) st.innerHTML = `<span class="mm-state__t mm-state__t--found">${this.t("mm_found")}</span><b class="mm-clock mm-clock--name">${Account._esc(name || "")}</b>`;
    const act = this._el.querySelector(".mp-actions");
    if (act) act.style.visibility = "hidden";
  },

  _hide() {
    clearInterval(this._clock);
    if (!this._el) return;
    const el = this._el;
    this._el = null;
    el.classList.remove("mp-overlay--visible");
    setTimeout(() => el.remove(), 300);
  },
};

window.addEventListener("pagehide", () => {
  if (Matchmaking._active && !Matchmaking._handled && Matchmaking._ref) { try { Matchmaking._ref.delete(); } catch (e) {} }
});
document.addEventListener("gg:authchange", () => { if (Matchmaking._active) Matchmaking.cancel(); });

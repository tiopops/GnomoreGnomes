/* Gnomore Gnomes — multijugador online: invitaciones y sala (lobby).
   Este archivo SOLO sabe: invitar a un amigo en línea, aceptar/rechazar una
   invitación, la sala previa (el anfitrión elige nivel, cada uno su raza,
   los dos pulsan "listo") y lanzar la partida con Net (js/net.js).
   Datos (reglas en firebase/firestore.rules):
     rooms/{id}: { hostUid, hostName, guestUid, guestName, status:'lobby'|'playing',
                   level, hostRace, guestRace, hostReady, guestReady,
                   guestJoined, guestDeclined, seed, createdAt, startedAt }
     rooms/{id}/msgs/*: comandos de la partida (ver Net). */

Object.assign(STRINGS.es, {
  mp_invite: "Invitar a jugar",
  mp_title: "PARTIDA ONLINE",
  mp_waiting_guest: "Esperando a {name}…",
  mp_choosing: "Eligiendo…",
  mp_ready: "¡Listo!",
  mp_not_ready: "Sin confirmar",
  mp_host: "Anfitrión",
  mp_guest: "Invitado",
  mp_pick_race: "Elige tu equipo",
  mp_pick_level: "Elige el nivel",
  mp_level_by: "Nivel elegido por {name}",
  mp_im_ready: "ESTOY LISTO",
  mp_cancel_ready: "CAMBIAR ELECCIÓN",
  mp_start: "EMPEZAR PARTIDA",
  mp_start_wait: "Esperando a que los dos estén listos",
  mp_leave: "SALIR",
  mp_invited: "{name} te invita a una partida online",
  mp_accept: "ACEPTAR",
  mp_decline: "RECHAZAR",
  mp_declined: "{name} ha rechazado la invitación.",
  mp_closed: "La sala se ha cerrado.",
  mp_guest_left: "{name} ha salido de la sala.",
  mp_err: "No se ha podido conectar con la sala.",
  mp_offline_friend: "Tu amigo no está en línea.",
  mp_connecting: "Conectando con {name}…",
  mp_lost: "Se ha perdido la conexión con {name}. Esperando…",
  mp_back: "Conexión recuperada.",
  mp_claim: "RECLAMAR LA VICTORIA",
  mp_resigned: "Tu rival ha abandonado la partida.",
  mp_resign_q: "¿Abandonar la partida online? Contará como derrota.",
  mp_resign_yes: "ABANDONAR",
  mp_resign_no: "SEGUIR JUGANDO",
  mp_mismatch: "Los dos mapas no coinciden. Salid y volved a empezar la partida.",
  mp_turn_wait: "Turno de {name}…",
});
Object.assign(STRINGS.en, {
  mp_invite: "Invite to play",
  mp_title: "ONLINE MATCH",
  mp_waiting_guest: "Waiting for {name}…",
  mp_choosing: "Choosing…",
  mp_ready: "Ready!",
  mp_not_ready: "Not ready",
  mp_host: "Host",
  mp_guest: "Guest",
  mp_pick_race: "Choose your team",
  mp_pick_level: "Choose the level",
  mp_level_by: "Level chosen by {name}",
  mp_im_ready: "I'M READY",
  mp_cancel_ready: "CHANGE CHOICE",
  mp_start: "START MATCH",
  mp_start_wait: "Waiting for both players to be ready",
  mp_leave: "LEAVE",
  mp_invited: "{name} invites you to an online match",
  mp_accept: "ACCEPT",
  mp_decline: "DECLINE",
  mp_declined: "{name} declined the invitation.",
  mp_closed: "The room was closed.",
  mp_guest_left: "{name} left the room.",
  mp_err: "Could not connect to the room.",
  mp_offline_friend: "Your friend is not online.",
  mp_connecting: "Connecting with {name}…",
  mp_lost: "Connection with {name} lost. Waiting…",
  mp_back: "Connection restored.",
  mp_claim: "CLAIM VICTORY",
  mp_resigned: "Your opponent left the match.",
  mp_resign_q: "Leave the online match? It will count as a defeat.",
  mp_resign_yes: "LEAVE",
  mp_resign_no: "KEEP PLAYING",
  mp_mismatch: "The two maps do not match. Leave and start the match again.",
  mp_turn_wait: "{name}'s turn…",
});

const MP_INVITE_TTL_MS = 120000;

const MPLobby = {
  _uid: null,
  _name: "",
  _roomId: null,
  _isHost: false,
  _data: null,
  _unsubRoom: null,
  _unsubInv: null,
  _overlay: null,
  _invEl: null,
  _toastEl: null,
  _launched: false,
  _invTimer: null,
  _seenInv: {},

  get _db() { return Account._db; },
  t(k, v) { return I18N.t(k, v); },
  _esc(s) { return Account._esc ? Account._esc(s) : String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); },

  init() {
    document.addEventListener("gg:authchange", (e) => this._onAuth(e.detail && e.detail.user, e.detail && e.detail.profile));
    document.addEventListener("gg:langchange", () => { if (this._overlay) this._renderLobby(); });
  },

  // ---------- Sesión ----------
  _onAuth(user, profile) {
    this._stopInvites();
    if (this._roomId) this._closeRoomLocal();
    this._uid = user ? user.uid : null;
    this._name = (profile && profile.username) || (user && user.displayName) || "";
    if (this._uid) this._listenInvites();
  },

  // ---------- Invitaciones recibidas ----------
  _listenInvites() {
    try {
      this._unsubInv = this._db
        .collection("rooms")
        .where("guestUid", "==", this._uid)
        .where("status", "==", "lobby")
        .onSnapshot(
          (snap) => {
            snap.docChanges().forEach((ch) => {
              if (ch.type === "removed") { if (this._invEl && this._invEl.dataset.id === ch.doc.id) this._hideInvite(); return; }
              const d = ch.doc.data();
              if (!d || d.guestJoined || d.guestDeclined) { if (this._invEl && this._invEl.dataset.id === ch.doc.id) this._hideInvite(); return; }
              if (Date.now() - (d.createdAt || 0) > MP_INVITE_TTL_MS) return;
              if (this._roomId || this._inMatch()) return; // ya estás en una sala / partida
              if (this._seenInv[ch.doc.id]) return;
              this._seenInv[ch.doc.id] = 1;
              this._showInvite(ch.doc.id, d);
            });
          },
          (e) => console.warn("rooms:", e && e.code)
        );
    } catch (e) { console.warn(e); }
  },

  _stopInvites() {
    if (this._unsubInv) { this._unsubInv(); this._unsubInv = null; }
    this._hideInvite();
  },

  _inMatch() {
    return typeof Net !== "undefined" && Net.active && !Net.ended;
  },

  _showInvite(id, d) {
    this._hideInvite();
    if (typeof SFX !== "undefined" && SFX.captureVillage) { try { SFX.captureVillage(); } catch (e) {} }
    const el = document.createElement("div");
    el.className = "mp-invite";
    el.dataset.id = id;
    el.innerHTML = `
      <div class="mp-invite__box p5-banner">
        <i class="ph-fill ph-sword mp-invite__icon"></i>
        <div class="mp-invite__txt">${this._esc(this.t("mp_invited", { name: d.hostName }))}</div>
        <div class="mp-invite__btns">
          <button type="button" class="p5-banner p5-banner--action friends-btn" data-act="ok" style="--p5-tone:#1f6b34"><span class="p5-banner__label">${this.t("mp_accept")}</span></button>
          <button type="button" class="p5-banner p5-banner--action friends-btn" data-act="no" style="--p5-tone:#5a1d1d"><span class="p5-banner__label">${this.t("mp_decline")}</span></button>
        </div>
      </div>`;
    el.querySelector('[data-act="ok"]').addEventListener("click", () => { this._hideInvite(); this.accept(id); });
    el.querySelector('[data-act="no"]').addEventListener("click", () => { this._hideInvite(); this.decline(id); });
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("mp-invite--visible"));
    this._invEl = el;
    clearTimeout(this._invTimer);
    this._invTimer = setTimeout(() => this._hideInvite(), MP_INVITE_TTL_MS);
  },

  _hideInvite() {
    clearTimeout(this._invTimer);
    if (!this._invEl) return;
    const el = this._invEl;
    this._invEl = null;
    el.classList.remove("mp-invite--visible");
    setTimeout(() => el.remove(), 250);
  },

  async decline(id) {
    try { await this._db.collection("rooms").doc(id).update({ guestDeclined: true }); } catch (e) {}
  },

  async accept(id) {
    if (this._roomId || this._inMatch()) return;
    try {
      const ref = this._db.collection("rooms").doc(id);
      const snap = await ref.get();
      if (!snap.exists) { this._toast(this.t("mp_closed")); return; }
      await ref.update({ guestJoined: true });
      this._enter(id, false);
    } catch (e) {
      console.warn(e);
      this._toast(this.t("mp_err"));
    }
  },

  // ---------- Invitar (anfitrión) ----------
  async invite(friendUid, friendName) {
    if (!this._uid || this._roomId || this._inMatch()) return;
    try {
      const ref = this._db.collection("rooms").doc();
      const lv = (typeof LEVELS !== "undefined" ? LEVELS : []).find((l) => l.available);
      await ref.set({
        hostUid: this._uid,
        hostName: this._name,
        guestUid: friendUid,
        guestName: friendName,
        status: "lobby",
        level: lv ? lv.id : "mushboom_forest",
        hostRace: null,
        guestRace: null,
        hostReady: false,
        guestReady: false,
        guestJoined: false,
        guestDeclined: false,
        createdAt: Date.now(),
      });
      if (typeof Friends !== "undefined") Friends.close();
      this._enter(ref.id, true);
    } catch (e) {
      console.warn(e);
      this._toast(this.t("mp_err"));
    }
  },

  // ---------- Sala ----------
  _enter(id, isHost) {
    this._roomId = id;
    this._isHost = isHost;
    this._data = null;
    this._launched = false;
    this._ensureOverlay();
    this._renderLobby();
    this._overlay.classList.add("mp-overlay--visible");
    this._unsubRoom = this._db.collection("rooms").doc(id).onSnapshot(
      (snap) => this._onRoom(snap),
      (e) => { console.warn("room:", e && e.code); this._toast(this.t("mp_err")); this._closeRoomLocal(); }
    );
  },

  _onRoom(snap) {
    if (!this._roomId) return;
    if (!snap.exists) {
      if (!this._launched) { this._toast(this.t("mp_closed")); this._closeRoomLocal(); }
      return;
    }
    const d = snap.data();
    const prev = this._data;
    this._data = d;
    if (d.guestDeclined && this._isHost && !this._launched) {
      this._toast(this.t("mp_declined", { name: d.guestName }));
      this.leave();
      return;
    }
    if (prev && prev.guestJoined && !d.guestJoined && this._isHost && !this._launched) {
      this._toast(this.t("mp_guest_left", { name: d.guestName }));
    }
    if (d.status === "playing" && !this._launched) {
      this._launched = true;
      this._launch(d);
      return;
    }
    if (!this._launched) this._renderLobby();
  },

  async _upd(patch) {
    if (!this._roomId) return;
    try { await this._db.collection("rooms").doc(this._roomId).update(patch); } catch (e) { console.warn(e); }
  },

  async leave() {
    const id = this._roomId;
    const host = this._isHost;
    const wasLaunched = this._launched;
    this._closeRoomLocal();
    if (!id || wasLaunched) return;
    try {
      const ref = this._db.collection("rooms").doc(id);
      if (host) await ref.delete();
      else await ref.update({ guestJoined: false, guestReady: false, guestRace: null });
    } catch (e) {}
  },

  _closeRoomLocal() {
    if (this._unsubRoom) { this._unsubRoom(); this._unsubRoom = null; }
    this._roomId = null;
    this._data = null;
    if (this._overlay) {
      this._overlay.classList.remove("mp-overlay--visible");
    }
  },

  // ---------- Vista de la sala ----------
  _ensureOverlay() {
    if (this._overlay) return;
    const o = document.createElement("div");
    o.className = "mp-overlay";
    o.innerHTML = '<div class="mp-panel p5-banner"><div class="mp-body"></div></div>';
    document.body.appendChild(o);
    this._overlay = o;
    this._body = o.querySelector(".mp-body");
  },

  _races() {
    return (typeof RACES !== "undefined" ? RACES : []).filter((r) => r.available);
  },
  _levels() {
    return (typeof LEVELS !== "undefined" ? LEVELS : []).filter((l) => l.available);
  },

  _slotHtml(role) {
    const d = this._data || {};
    const host = role === "host";
    const name = host ? d.hostName : d.guestName;
    const race = host ? d.hostRace : d.guestRace;
    const ready = host ? d.hostReady : d.guestReady;
    const joined = host ? true : !!d.guestJoined;
    const mine = host === this._isHost;
    const r = this._races().find((x) => x.id === race);
    let state;
    if (!joined) state = `<span class="mp-slot__state mp-slot__state--wait">${this._esc(this.t("mp_waiting_guest", { name }))}</span>`;
    else if (ready) state = `<span class="mp-slot__state mp-slot__state--ready"><i class="ph-fill ph-check-circle"></i> ${this.t("mp_ready")}</span>`;
    else state = `<span class="mp-slot__state">${race ? this.t("mp_not_ready") : this.t("mp_choosing")}</span>`;
    return `<div class="mp-slot ${mine ? "mp-slot--me" : ""} ${ready ? "mp-slot--ready" : ""} ${joined ? "" : "mp-slot--empty"}">
      <div class="mp-slot__role">${this.t(host ? "mp_host" : "mp_guest")}</div>
      <div class="mp-slot__art">${r ? `<img src="${r.iconImg}" alt="" draggable="false">` : '<i class="ph ph-question"></i>'}</div>
      <div class="mp-slot__name">${this._esc(name || "")}</div>
      <div class="mp-slot__race">${r ? this._esc(this.t(r.nameKey)) : "&nbsp;"}</div>
      ${state}
    </div>`;
  },

  _renderLobby() {
    if (!this._body) return;
    const d = this._data;
    if (!d) {
      this._body.innerHTML = `<div class="p5-banner__label settings-panel__title">${this.t("mp_title")}</div><div class="mp-wait">${this.t("mp_connecting", { name: "…" })}</div>`;
      return;
    }
    const meRace = this._isHost ? d.hostRace : d.guestRace;
    const meReady = this._isHost ? d.hostReady : d.guestReady;
    const otherJoined = this._isHost ? !!d.guestJoined : true;
    const raceCards = this._races().map((r) => `
      <button type="button" class="mp-race ${meRace === r.id ? "mp-race--on" : ""}" data-race="${r.id}" ${meReady ? "disabled" : ""} style="--card-accent:${r.color || "#ffcf3d"}">
        <img src="${r.iconImg}" alt="" draggable="false"><span>${this._esc(this.t(r.nameKey))}</span>
      </button>`).join("");
    const lvl = this._levels().find((l) => l.id === d.level) || this._levels()[0];
    const levelCards = this._levels().map((l) => `
      <button type="button" class="mp-level ${d.level === l.id ? "mp-level--on" : ""}" data-level="${l.id}" ${this._isHost && !d.hostReady && !d.guestReady ? "" : "disabled"}>
        <img src="${l.islandImg}" alt="" draggable="false"><span>${this._esc(this.t(l.nameKey))}</span>
      </button>`).join("");
    const bothReady = d.hostReady && d.guestReady && d.guestJoined && d.hostRace && d.guestRace;
    const readyBtn = `<button type="button" class="p5-banner p5-banner--action mp-btn" data-act="ready" ${meRace && otherJoined ? "" : "disabled"} style="--p5-tone:${meReady ? "#4a3d52" : "#1f6b34"}"><span class="p5-banner__label">${this.t(meReady ? "mp_cancel_ready" : "mp_im_ready")}</span></button>`;
    const startBtn = this._isHost
      ? `<button type="button" class="p5-banner p5-banner--action mp-btn mp-btn--go ${bothReady ? "" : "mp-btn--off"}" data-act="start" ${bothReady ? "" : "disabled"} style="--p5-tone:#ffcf3d"><span class="p5-banner__label">${this.t("mp_start")}</span></button>`
      : "";
    this._body.innerHTML = `
      <div class="p5-banner__label settings-panel__title">${this.t("mp_title")}</div>
      <div class="mp-slots">
        ${this._slotHtml("host")}
        <div class="mp-vs">VS</div>
        ${this._slotHtml("guest")}
      </div>
      <div class="mp-section">
        <div class="mp-section__title">${this.t("mp_pick_race")}</div>
        <div class="mp-races">${raceCards}</div>
      </div>
      <div class="mp-section">
        <div class="mp-section__title">${this._isHost ? this.t("mp_pick_level") : this._esc(this.t("mp_level_by", { name: d.hostName }))}</div>
        <div class="mp-levels">${this._isHost ? levelCards : `<div class="mp-level mp-level--on mp-level--static"><img src="${lvl ? lvl.islandImg : ""}" alt="" draggable="false"><span>${lvl ? this._esc(this.t(lvl.nameKey)) : ""}</span></div>`}</div>
      </div>
      <div class="mp-actions">
        ${readyBtn}${startBtn}
        <button type="button" class="p5-banner p5-banner--action mp-btn" data-act="leave" style="--p5-tone:#5a1d1d"><span class="p5-banner__label">${this.t("mp_leave")}</span></button>
      </div>
      ${this._isHost && !bothReady ? `<div class="mp-hint">${this.t("mp_start_wait")}</div>` : ""}`;
    this._body.querySelectorAll("[data-race]").forEach((b) =>
      b.addEventListener("click", () => {
        if (typeof SFX !== "undefined") SFX.click();
        this._upd(this._isHost ? { hostRace: b.dataset.race } : { guestRace: b.dataset.race });
      }));
    this._body.querySelectorAll("[data-level]").forEach((b) =>
      b.addEventListener("click", () => {
        if (typeof SFX !== "undefined") SFX.click();
        this._upd({ level: b.dataset.level });
      }));
    this._body.querySelectorAll("[data-act]").forEach((b) =>
      b.addEventListener("click", () => {
        if (typeof SFX !== "undefined") SFX.click();
        const a = b.dataset.act;
        if (a === "leave") this.leave();
        else if (a === "ready") this._upd(this._isHost ? { hostReady: !d.hostReady } : { guestReady: !d.guestReady });
        else if (a === "start") this._start();
      }));
  },

  async _start() {
    const d = this._data;
    if (!this._isHost || !d || !(d.hostReady && d.guestReady && d.guestJoined && d.hostRace && d.guestRace)) return;
    await this._upd({ status: "playing", seed: 1 + Math.floor(Math.random() * 2147483000), startedAt: Date.now() });
  },

  // ---------- Lanzar la partida ----------
  async _launch(d) {
    const host = this._isHost;
    const other = host ? d.guestName : d.hostName;
    if (this._overlay) this._overlay.classList.remove("mp-overlay--visible");
    if (this._unsubRoom) { this._unsubRoom(); this._unsubRoom = null; }
    const roomId = this._roomId;
    Net.onStatus = (s) => this._onNetStatus(s);
    try {
      await Net.launch({
        role: host ? "host" : "guest",
        seed: d.seed,
        roomId,
        levelId: d.level,
        myRace: host ? d.hostRace : d.guestRace,
        otherRace: host ? d.guestRace : d.hostRace,
        me: this._uid,
        myName: host ? d.hostName : d.guestName,
        otherName: other,
        transport: NetFirestoreTransport(this._db, roomId, this._uid),
      });
    } catch (e) {
      console.error(e);
      this._toast(this.t("mp_err"));
    }
  },

  _onNetStatus(s) {
    if (s === "go") {
      this._clearToast();
    } else if (s === "lost-link") {
      this._banner(this.t("mp_lost", { name: Net.names.other }), true);
    } else if (s === "back") {
      this._clearToast();
      this._toast(this.t("mp_back"));
    } else if (s === "left" || s === "left-bye") {
      this._clearToast();
      if (typeof Obelisks !== "undefined" && !Obelisks.gameOver) {
        Obelisks._endGame("player", "resigned");
      }
    } else if (s === "layout-mismatch") {
      this._banner(this.t("mp_mismatch"), false);
    }
  },

  // Aviso fijo arriba (conexión perdida) con opción de reclamar la victoria.
  _banner(text, claim) {
    this._clearToast();
    const el = document.createElement("div");
    el.className = "mp-toast mp-toast--sticky";
    el.innerHTML = `<span>${this._esc(text)}</span>`;
    if (claim) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "p5-banner p5-banner--action friends-btn";
      b.style.setProperty("--p5-tone", "#ffcf3d");
      b.innerHTML = `<span class="p5-banner__label" style="color:#111;text-shadow:none">${this.t("mp_claim")}</span>`;
      b.style.display = "none";
      b.addEventListener("click", () => this._onNetStatus("left"));
      el.appendChild(b);
      setTimeout(() => { b.style.display = ""; }, 20000); // tras 20 s se puede reclamar
    }
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("mp-toast--visible"));
    this._toastEl = el;
  },

  _toast(text) {
    this._clearToast();
    const el = document.createElement("div");
    el.className = "mp-toast";
    el.textContent = text;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("mp-toast--visible"));
    this._toastEl = el;
    setTimeout(() => { if (this._toastEl === el) this._clearToast(); }, 3600);
  },

  _clearToast() {
    if (!this._toastEl) return;
    const el = this._toastEl;
    this._toastEl = null;
    el.classList.remove("mp-toast--visible");
    setTimeout(() => el.remove(), 250);
  },

  // ---------- Durante / al acabar la partida ----------
  // "Salir de la partida" desde Ajustes en una partida online.
  confirmResign(done) {
    const el = document.createElement("div");
    el.className = "mp-overlay mp-overlay--visible mp-overlay--confirm";
    el.innerHTML = `<div class="mp-panel mp-panel--small p5-banner"><div class="mp-body">
      <div class="mp-wait">${this._esc(this.t("mp_resign_q"))}</div>
      <div class="mp-actions">
        <button type="button" class="p5-banner p5-banner--action mp-btn" data-act="yes" style="--p5-tone:#5a1d1d"><span class="p5-banner__label">${this.t("mp_resign_yes")}</span></button>
        <button type="button" class="p5-banner p5-banner--action mp-btn" data-act="no" style="--p5-tone:#2b2733"><span class="p5-banner__label">${this.t("mp_resign_no")}</span></button>
      </div></div></div>`;
    el.querySelector('[data-act="no"]').addEventListener("click", () => el.remove());
    el.querySelector('[data-act="yes"]').addEventListener("click", () => {
      el.remove();
      this.finishMatch(true);
      if (done) done();
    });
    document.body.appendChild(el);
  },

  // El anfitrión borra los comandos de la partida y luego la sala.
  async _cleanup(roomId) {
    try {
      const ref = this._db.collection("rooms").doc(roomId);
      const snap = await ref.collection("msgs").get();
      let batch = this._db.batch();
      let n = 0;
      for (const d of snap.docs) {
        batch.delete(d.ref);
        if (++n % 400 === 0) { await batch.commit(); batch = this._db.batch(); }
      }
      await batch.commit();
      await ref.delete();
    } catch (e) { console.warn("limpieza", e && e.code); }
  },

  // Cierra la sesión online (al volver al menú). `resign`: avisa de abandono.
  finishMatch(resign) {
    if (typeof Net === "undefined" || !Net.active) return;
    const id = Net.roomId;
    const host = Net.role === "host";
    if (resign && !Net.ended) Net.resign();
    this._clearToast();
    const roomId = this._roomId || id;
    Net.end(true);
    this._roomId = null;
    this._launched = false;
    this._seenInv = {};
    if (host && roomId) this._cleanup(roomId);
  },
};

document.addEventListener("DOMContentLoaded", () => MPLobby.init());
window.addEventListener("pagehide", () => {
  if (typeof Net !== "undefined" && Net.active && !Net.ended) { try { Net._send({ t: "bye" }); } catch (e) {} }
});

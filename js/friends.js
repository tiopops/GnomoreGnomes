/* Gnomore Gnomes — amigos.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Pintar el botón de amigos (a la izquierda del engranaje, solo con sesión).
     - Abrir/cerrar su panel: añadir por nombre de usuario, solicitudes
       recibidas/enviadas, lista de amigos con su estado "en línea" y eliminar.
     - Hablar con Firestore a través de la sesión de Account (js/auth.js).
   Datos (reglas en firebase/firestore.rules):
     friends/{uidMenor_uidMayor}: { users:[from,to], from, to, fromName, toName,
                                    status:'pending'|'accepted', createdAt }
     presence/{uid}: { lastSeen }   (latido cada minuto mientras hay sesión)
   Los duelos / partidas entre amigos NO están aquí (multijugador pospuesto). */

const FRIENDS_ONLINE_MS = 150000; // "en línea" = latido en los últimos 2,5 min
const FRIENDS_BEAT_MS = 60000;

const Friends = {
  _btn: null,
  _badge: null,
  _overlay: null,
  _body: null,
  _uid: null,
  _name: "",
  _docs: [], // [{id, ...data}]
  _unsub: null,
  _beat: null,
  _poll: null,
  _presence: {}, // uid -> lastSeen
  _confirm: null, // id de amistad pendiente de confirmar borrado
  _msg: null, // {text, kind}
  _busy: false,

  get _db() {
    return Account._db;
  },

  init() {
    this._ensureButton();
    this._ensurePopup();
    // Botón MULTIJUGADOR del menú principal: abre los amigos (o la cuenta si no hay sesión).
    const mp = document.getElementById("btn-multiplayer");
    if (mp)
      mp.addEventListener("click", () => {
        if (typeof SFX !== "undefined") SFX.click();
        if (this._uid) this.open();
        else Account.open();
      });
    document.addEventListener("gg:authchange", (e) => this._onAuth(e.detail && e.detail.user, e.detail && e.detail.profile));
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this._heartbeat();
    });
  },

  // ---------- Botón ----------
  _ensureButton() {
    if (this._btn) return;
    const btn = document.createElement("button");
    btn.className = "settings-gear-btn settings-gear-btn--friends";
    btn.setAttribute("aria-label", I18N.t("fr_aria"));
    btn.innerHTML = '<i class="ph-fill ph-users settings-gear-btn__icon"></i><span class="friends-badge"></span>';
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (typeof SFX !== "undefined") SFX.click();
      this.open();
    });
    document.body.appendChild(btn);
    this._btn = btn;
    this._badge = btn.querySelector(".friends-badge");
  },

  _ensurePopup() {
    if (this._overlay) return;
    const overlay = document.createElement("div");
    overlay.className = "settings-overlay account-overlay friends-overlay";
    overlay.addEventListener("click", () => this.close());
    const panel = document.createElement("div");
    panel.className = "p5-banner settings-panel account-panel friends-panel";
    panel.addEventListener("click", (e) => e.stopPropagation());
    const closeBtn = document.createElement("button");
    closeBtn.className = "backpack-close-btn";
    closeBtn.setAttribute("aria-label", "Cerrar");
    closeBtn.innerHTML = '<i class="ph ph-x backpack-close-btn__icon"></i>';
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.close();
    });
    panel.appendChild(closeBtn);
    const body = document.createElement("div");
    body.className = "account-body friends-body";
    panel.appendChild(body);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    this._overlay = overlay;
    this._body = body;
  },

  _isOpen() {
    return this._overlay && this._overlay.classList.contains("settings-overlay--visible");
  },

  open() {
    this._msg = null;
    this._confirm = null;
    this._render();
    this._overlay.classList.add("settings-overlay--visible");
    this._refreshPresence();
    clearInterval(this._poll);
    this._poll = setInterval(() => this._refreshPresence(), 20000);
  },

  close() {
    if (this._overlay) this._overlay.classList.remove("settings-overlay--visible");
    clearInterval(this._poll);
    this._poll = null;
  },

  // ---------- Sesión ----------
  _onAuth(user, profile) {
    if (this._unsub) {
      this._unsub();
      this._unsub = null;
    }
    clearInterval(this._beat);
    this._beat = null;
    this._docs = [];
    this._presence = {};
    this._uid = user ? user.uid : null;
    this._name = (profile && profile.username) || (user && user.displayName) || "";
    this._btn.classList.toggle("settings-gear-btn--visible", !!user);
    if (!user) {
      this._updateBadge();
      if (this._isOpen()) this.close();
      return;
    }
    this._unsub = this._db
      .collection("friends")
      .where("users", "array-contains", user.uid)
      .onSnapshot(
        (snap) => {
          this._docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          this._updateBadge();
          if (this._isOpen()) {
            this._render();
            this._refreshPresence();
          }
        },
        (e) => console.warn("friends:", e && e.code)
      );
    this._heartbeat();
    this._beat = setInterval(() => this._heartbeat(), FRIENDS_BEAT_MS);
  },

  _heartbeat() {
    if (!this._uid || document.hidden) return;
    this._db.collection("presence").doc(this._uid).set({ lastSeen: Date.now() }).catch(() => {});
  },

  async _refreshPresence() {
    const ids = this._accepted().map((f) => f.otherUid);
    if (!ids.length) return;
    await Promise.all(
      ids.map((uid) =>
        this._db
          .collection("presence")
          .doc(uid)
          .get()
          .then((s) => {
            this._presence[uid] = s.exists ? s.data().lastSeen || 0 : 0;
          })
          .catch(() => {})
      )
    );
    if (this._isOpen() && !this._confirm) this._render();
  },

  // ---------- Datos ----------
  _view(d) {
    const mine = d.from === this._uid;
    return { id: d.id, status: d.status, mine, otherUid: mine ? d.to : d.from, otherName: mine ? d.toName : d.fromName };
  },
  _accepted() {
    return this._docs.filter((d) => d.status === "accepted").map((d) => this._view(d)).sort((a, b) => this._isOn(b.otherUid) - this._isOn(a.otherUid) || a.otherName.localeCompare(b.otherName));
  },
  _incoming() {
    return this._docs.filter((d) => d.status === "pending" && d.to === this._uid).map((d) => this._view(d));
  },
  _outgoing() {
    return this._docs.filter((d) => d.status === "pending" && d.from === this._uid).map((d) => this._view(d));
  },
  _isOn(uid) {
    return Date.now() - (this._presence[uid] || 0) < FRIENDS_ONLINE_MS;
  },
  _updateBadge() {
    const n = this._incoming().length;
    this._badge.textContent = n > 9 ? "9+" : String(n);
    this._badge.style.display = n ? "flex" : "none";
  },

  // ---------- Vista ----------
  _esc(s) {
    return Account._esc(s);
  },

  _row(v, kind) {
    const on = kind === "friend" && this._isOn(v.otherUid);
    const sub = kind === "friend" ? (on ? I18N.t("fr_online") : I18N.t("fr_offline")) : kind === "out" ? I18N.t("fr_pending") : "";
    let actions = "";
    if (kind === "in")
      actions = `<button type="button" class="p5-banner p5-banner--action friends-btn" data-act="accept" data-id="${v.id}" style="--p5-tone:#1f6b34"><span class="p5-banner__label">${I18N.t("fr_accept")}</span></button>
        <button type="button" class="p5-banner p5-banner--action friends-btn" data-act="del" data-id="${v.id}" style="--p5-tone:#5a1d1d"><span class="p5-banner__label">${I18N.t("fr_reject")}</span></button>`;
    else if (kind === "out") actions = `<button type="button" class="p5-banner p5-banner--action friends-btn" data-act="del" data-id="${v.id}" style="--p5-tone:#2b2733"><span class="p5-banner__label">${I18N.t("fr_cancel")}</span></button>`;
    else actions = `<button type="button" class="friends-trash" data-act="ask" data-id="${v.id}" title="${I18N.t("fr_remove")}" aria-label="${I18N.t("fr_remove")}"><i class="ph ph-trash"></i></button>`;
    if (kind === "friend" && this._confirm === v.id) {
      return `<div class="friends-row friends-row--confirm">
        <div class="friends-row__txt">${this._esc(I18N.t("fr_confirm").replace("{0}", v.otherName))}</div>
        <div class="friends-row__act">
          <button type="button" class="p5-banner p5-banner--action friends-btn" data-act="del" data-id="${v.id}" style="--p5-tone:#5a1d1d"><span class="p5-banner__label">${I18N.t("fr_yes")}</span></button>
          <button type="button" class="p5-banner p5-banner--action friends-btn" data-act="back" style="--p5-tone:#2b2733"><span class="p5-banner__label">${I18N.t("fr_no")}</span></button>
        </div></div>`;
    }
    return `<div class="friends-row">
      ${kind === "friend" ? `<span class="friends-dot friends-dot--${on ? "on" : "off"}"></span>` : ""}
      <div class="friends-row__txt"><span class="friends-row__name">${this._esc(v.otherName)}</span>${sub ? `<span class="friends-row__sub">${sub}</span>` : ""}</div>
      <div class="friends-row__act">${actions}</div></div>`;
  },

  _section(title, rows) {
    return rows ? `<div class="friends-section"><div class="friends-section__title">${title}</div>${rows}</div>` : "";
  },

  _render() {
    const B = this._body;
    if (!B) return;
    if (!this._uid) {
      B.innerHTML = `<div class="p5-banner__label settings-panel__title">${I18N.t("fr_title")}</div><div class="account-msg account-msg--error">${I18N.t("fr_login")}</div>`;
      return;
    }
    const keep = document.getElementById("fr-name");
    const typed = keep ? keep.value : "";
    const hadFocus = keep && document.activeElement === keep;
    const inc = this._incoming().map((v) => this._row(v, "in")).join("");
    const out = this._outgoing().map((v) => this._row(v, "out")).join("");
    const fr = this._accepted().map((v) => this._row(v, "friend")).join("");
    const msg = this._msg ? `<div class="account-msg account-msg--${this._msg.kind}">${this._esc(this._msg.text)}</div>` : "";
    B.innerHTML = `
      <div class="p5-banner__label settings-panel__title">${I18N.t("fr_title")}</div>
      <div class="friends-add">
        <label class="account-field"><span class="account-field__label">${I18N.t("fr_add_title")}</span>
          <input id="fr-name" type="text" placeholder="${I18N.t("fr_ph")}" maxlength="16" autocomplete="off" spellcheck="false" autocapitalize="none"></label>
        <button type="button" class="p5-banner p5-banner--action friends-send" data-act="send"><span class="p5-banner__label">${I18N.t("fr_add_btn")}</span></button>
      </div>
      ${msg}
      ${this._section(I18N.t("fr_requests"), inc)}
      ${this._section(I18N.t("fr_list"), fr || `<div class="friends-empty">${I18N.t("fr_none")}</div>`)}
      ${this._section(I18N.t("fr_sent"), out)}`;
    const input = document.getElementById("fr-name");
    input.value = typed;
    if (hadFocus) input.focus();
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this._send();
      }
    });
    B.querySelectorAll("[data-act]").forEach((b) =>
      b.addEventListener("click", () => {
        if (typeof SFX !== "undefined") SFX.click();
        const a = b.dataset.act;
        if (a === "send") this._send();
        else if (a === "accept") this._accept(b.dataset.id);
        else if (a === "del") this._remove(b.dataset.id);
        else if (a === "ask") {
          this._confirm = b.dataset.id;
          this._render();
        } else if (a === "back") {
          this._confirm = null;
          this._render();
        }
      })
    );
  },

  _say(text, kind) {
    this._msg = { text, kind: kind || "error" };
    const el = this._body.querySelector(".account-msg");
    if (el) {
      el.className = `account-msg account-msg--${this._msg.kind}`;
      el.textContent = text;
    } else {
      this._render();
    }
  },

  // ---------- Acciones ----------
  async _send() {
    if (this._busy) return;
    const input = document.getElementById("fr-name");
    const name = (input ? input.value : "").trim();
    if (!name) return this._say(I18N.t("fr_e_empty"));
    if (!ACCOUNT_NAME_RE.test(name)) return this._say(I18N.t("fr_e_notfound"));
    this._busy = true;
    try {
      const db = this._db;
      const target = await db.collection("usernames").doc(name.toLowerCase()).get();
      if (!target.exists) return this._say(I18N.t("fr_e_notfound"));
      const to = target.data().uid;
      const toName = target.data().username;
      if (to === this._uid) return this._say(I18N.t("fr_e_self"));
      const id = this._uid < to ? `${this._uid}_${to}` : `${to}_${this._uid}`;
      const ref = db.collection("friends").doc(id);
      const cur = await ref.get();
      if (cur.exists) {
        const d = cur.data();
        if (d.status === "accepted") return this._say(I18N.t("fr_e_already"));
        if (d.from === this._uid) return this._say(I18N.t("fr_e_waiting"));
        await ref.update({ status: "accepted" }); // me la había enviado él: se acepta directamente
        this._msg = { text: I18N.t("fr_ok_joined").replace("{0}", toName), kind: "ok" };
        return;
      }
      await ref.set({ users: [this._uid, to], from: this._uid, to, fromName: this._name, toName, status: "pending", createdAt: Date.now() });
      this._msg = { text: I18N.t("fr_ok_sent").replace("{0}", toName), kind: "ok" };
      const i = document.getElementById("fr-name");
      if (i) i.value = "";
    } catch (e) {
      console.warn("friends send:", e);
      this._say(I18N.t("fr_e_generic"));
    } finally {
      this._busy = false;
      if (this._msg && this._msg.kind === "ok") this._render();
    }
  },

  async _accept(id) {
    try {
      await this._db.collection("friends").doc(id).update({ status: "accepted" });
    } catch (e) {
      this._say(I18N.t("fr_e_generic"));
    }
  },

  async _remove(id) {
    this._confirm = null;
    try {
      await this._db.collection("friends").doc(id).delete();
    } catch (e) {
      this._say(I18N.t("fr_e_generic"));
    }
  },
};

document.addEventListener("DOMContentLoaded", () => Friends.init());
document.addEventListener("gg:langchange", () => {
  if (Friends._btn) Friends._btn.setAttribute("aria-label", I18N.t("fr_aria"));
  if (Friends._isOpen()) Friends._render();
});

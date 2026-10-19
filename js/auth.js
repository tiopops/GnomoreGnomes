/* Gnomore Gnomes — cuenta de usuario (registro / login).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Pintar el botón de cuenta (icono de usuario, a la derecha del engranaje).
     - Abrir/cerrar su panel: ENTRAR / REGISTRARSE (o los datos de la cuenta si
       ya hay sesión).
     - Hablar con Firebase Auth + Firestore (SDK "compat" cargado a demanda).

   Unicidad:
     - Correo: Firebase Auth ya impide dos cuentas con el mismo correo.
     - Nombre: documento usernames/{nombreEnMinúsculas}, que solo se puede
       CREAR (ver firebase/firestore.rules). Si dos personas lo piden a la vez,
       a la segunda le falla el lote y se borra su cuenta recién creada.
   Configuración: js/firebase-config.js. */

const FIREBASE_SDK_VERSION = "10.12.2";
const ACCOUNT_NAME_RE = /^[A-Za-z0-9_]{3,16}$/;
const NAME_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const Account = {
  _btn: null,
  _overlay: null,
  _panel: null,
  _body: null,
  _mode: "login", // "login" | "register" | "reset"
  _user: null,
  _profile: null,
  _auth: null,
  _db: null,
  _sdkPromise: null,
  _busy: false,
  _editingName: false,
  _authKnown: false, // ya se sabe si hay sesión o no (primer aviso de Firebase)
  _knownWaiters: [],
  _whenKnown() { return this._authKnown ? Promise.resolve() : new Promise((r) => this._knownWaiters.push(r)); },

  init() {
    this._ensureButton();
    this._ensurePopup();
    // Si ya hay configuración, se carga el SDK en segundo plano para recuperar
    // la sesión guardada (sin bloquear el arranque del juego).
    if (typeof GG_FIREBASE_CONFIG !== "undefined" && GG_FIREBASE_CONFIG) {
      setTimeout(() => this._ensureFirebase().catch(() => {}), 1500);
    }
  },

  // ---------- Botón ----------
  _ensureButton() {
    if (this._btn) return;
    const btn = document.createElement("button");
    btn.className = "settings-gear-btn settings-gear-btn--account settings-gear-btn--visible";
    btn.setAttribute("aria-label", I18N.t("acc_aria"));
    btn.innerHTML = '<i class="ph-fill ph-user settings-gear-btn__icon"></i><span class="account-dot"></span>';
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (typeof SFX !== "undefined") SFX.click();
      this.open();
    });
    document.body.appendChild(btn);
    this._btn = btn;
  },

  _ensurePopup() {
    if (this._overlay) return;
    const overlay = document.createElement("div");
    overlay.className = "settings-overlay account-overlay";
    // Entrar, crear cuenta y recuperar: solo se cierran con la X (así no se pierde lo escrito por un clic fuera).
    overlay.addEventListener("click", () => {
      if (!this._user) return; // sin sesión (entrar / crear cuenta / recuperar): solo se cierra con la X
      this.close();
    });
    const panel = document.createElement("div");
    panel.className = "p5-banner settings-panel account-panel";
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
    body.className = "account-body";
    panel.appendChild(body);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    this._overlay = overlay;
    this._panel = panel;
    this._body = body;
  },

  open() {
    this._mode = "login";
    this._render();
    this._overlay.classList.add("settings-overlay--visible");
    if (typeof GG_FIREBASE_CONFIG !== "undefined" && GG_FIREBASE_CONFIG) this._ensureFirebase().catch(() => {});
  },

  close() {
    if (this._overlay) this._overlay.classList.remove("settings-overlay--visible");
  },

  // Mi Cuenta dentro de Ajustes (pestaña que aparece con mando conectado).
  embed(host) {
    if (!this._body || this._embedded) return;
    this._embedded = true;
    this._mode = "login";
    this._editingName = false;
    this._render();
    host.appendChild(this._body);
    if (typeof GG_FIREBASE_CONFIG !== "undefined" && GG_FIREBASE_CONFIG) this._ensureFirebase().catch(() => {});
  },
  unembed() {
    if (!this._embedded) return;
    this._embedded = false;
    if (this._panel && this._body) this._panel.appendChild(this._body);
  },

  // ---------- Vista ----------
  _esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  },

  _render(msg, kind) {
    const B = this._body;
    if (!B) return;
    const note = msg ? `<div class="account-msg account-msg--${kind || "error"}">${this._esc(msg)}</div>` : "";
    if (this._user) {
      const nick = (this._profile && this._profile.username) || this._user.displayName || I18N.t("acc_player");
      const verified = this._user.emailVerified;
      B.innerHTML = `
        <div class="p5-banner__label settings-panel__title">${I18N.t("acc_my")}</div>
        <div class="pf-hero">
          <button type="button" class="pf-logout" data-act="logout" title="${I18N.t("acc_logout")}" aria-label="${I18N.t("acc_logout")}"><i class="ph-bold ph-sign-out"></i></button>
          <div class="pf-hero__row">
            <div class="pf-av"><i class="ph-fill ph-user"></i><span class="pf-av__lv"><small>${typeof Progress !== "undefined" ? Progress.t("pg_lv_short") : "NIV"}</small><b id="acc-lv">1</b></span></div>
            <div class="pf-id">
              ${
                this._editingName
                  ? `<label class="account-field account-field--rename"><input id="acc-newnick" type="text" value="${this._esc(nick)}" maxlength="16" autocomplete="off" spellcheck="false" autocapitalize="none"></label>
                     <div class="account-rename-btns">
                       <button type="button" class="p5-banner p5-banner--action friends-btn" data-act="rename-save" style="--p5-tone:#1f6b34"><span class="p5-banner__label">${I18N.t("acc_rename_save")}</span></button>
                       <button type="button" class="p5-banner p5-banner--action friends-btn" data-act="rename-cancel" style="--p5-tone:#2b2733"><span class="p5-banner__label">${I18N.t("acc_rename_cancel")}</span></button>
                     </div>`
                  : `<div class="pf-id__nick"><span>${this._esc(nick)}</span><button type="button" class="account-edit" data-act="rename" title="${I18N.t("acc_rename")}" aria-label="${I18N.t("acc_rename")}"><i class="ph-fill ph-pencil-simple"></i></button></div>`
              }
              <div class="pf-id__mail">${this._esc(this._user.email || "")}</div>
              <div class="pf-id__state pf-id__state--${verified ? "ok" : "pending"}"><i class="ph-fill ph-${verified ? "seal-check" : "warning-circle"}"></i>${verified ? I18N.t("acc_verified") : I18N.t("acc_unverified")}</div>
            </div>
          </div>
          <div class="pf-xp" id="acc-xp"></div>
        </div>
        ${note}
        <div class="pf" id="acc-stats"></div>`;
      B.querySelector("[data-act=logout]").addEventListener("click", () => this.logout());
      const bind = (act, fn) => { const el = B.querySelector(`[data-act=${act}]`); if (el) el.addEventListener("click", fn); };
      bind("rename", () => {
        const left = this._nameCooldownLeftMs();
        if (left > 0) return this._note(I18N.t("acc_rename_wait", { n: this._daysText(left) }));
        this._editingName = true;
        this._render(I18N.t("acc_rename_hint"), "ok");
        const i = document.getElementById("acc-newnick");
        if (i) { i.focus(); i.select(); }
      });
      bind("rename-cancel", () => { this._editingName = false; this._render(); });
      bind("rename-save", () => this._rename());
      const ni = document.getElementById("acc-newnick");
      if (ni) ni.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); this._rename(); } });
      if (typeof PlayerStats !== "undefined") PlayerStats.mount(B.querySelector("#acc-stats"));
      return;
    }
    const m = this._mode;
    const field = (id, label, type, ph, extra = "") => `
      <label class="account-field">
        <span class="account-field__label">${label}</span>
        <input id="acc-${id}" type="${type}" placeholder="${ph}" autocomplete="${extra}" spellcheck="false" autocapitalize="none">
      </label>`;
    let fields = "";
    let title = I18N.t("acc_login");
    let submit = I18N.t("acc_login");
    if (m === "login") {
      fields = field("email", I18N.t("acc_f_email_or_name"), "text", I18N.t("acc_ph_email_or_name"), "username") + field("pass", I18N.t("acc_f_pass"), "password", "••••••", "current-password");
    } else if (m === "register") {
      title = I18N.t("acc_create_title");
      submit = I18N.t("acc_register_btn");
      fields =
        field("email", I18N.t("acc_f_email"), "email", "tu@correo.com", "email") +
        field("nick", I18N.t("acc_f_nick"), "text", I18N.t("acc_ph_nick"), "username") +
        field("pass", I18N.t("acc_f_pass"), "password", I18N.t("acc_ph_pass"), "new-password") +
        field("pass2", I18N.t("acc_f_pass2"), "password", "••••••", "new-password");
    } else {
      title = I18N.t("acc_recover_title");
      submit = I18N.t("acc_send_mail");
      fields = field("email", I18N.t("acc_f_email_account"), "email", "tu@correo.com", "email");
    }
    B.innerHTML = `
      <div class="p5-banner__label settings-panel__title">${title}</div>
      <div class="account-tabs">
        <button type="button" class="p5-banner p5-banner--action account-tab${m === "login" ? " account-tab--active" : ""}" data-mode="login"><span class="p5-banner__label">${I18N.t("acc_login")}</span></button>
        <button type="button" class="p5-banner p5-banner--action account-tab${m === "register" ? " account-tab--active" : ""}" data-mode="register"><span class="p5-banner__label">${I18N.t("acc_register")}</span></button>
      </div>
      <form class="account-form" novalidate>${fields}</form>
      ${note}
      <button type="button" class="p5-banner p5-banner--action account-submit" data-act="submit"><span class="p5-banner__label">${submit}</span></button>
      ${m === "login" ? `<button type="button" class="account-link" data-mode="reset">${I18N.t("acc_forgot")}</button>` : ""}
      ${m === "reset" ? `<button type="button" class="account-link" data-mode="login">${I18N.t("acc_back")}</button>` : ""}`;
    B.querySelectorAll("[data-mode]").forEach((b) =>
      b.addEventListener("click", () => {
        this._mode = b.dataset.mode;
        this._render();
      })
    );
    const go = () => this._submit();
    // Registro: el botón se pone amarillo cuando todos los campos están rellenos.
    if (m === "register") {
      const submitBtn = B.querySelector("[data-act=submit]");
      const refreshReady = () => {
        const ready = [...B.querySelectorAll("form input")].every((i) => i.value.trim() !== "");
        submitBtn.classList.toggle("account-submit--ready", ready);
      };
      B.querySelectorAll("form input").forEach((i) => i.addEventListener("input", refreshReady));
      refreshReady();
    }
    B.querySelector("[data-act=submit]").addEventListener("click", go);
    B.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      go();
    });
    B.querySelectorAll("input").forEach((i) =>
      i.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          go();
        }
      })
    );
  },

  // Mensaje en su sitio, sin repintar el formulario (así no se pierde lo escrito).
  _note(msg, kind) {
    let el = this._body.querySelector(".account-msg");
    if (!el) {
      el = document.createElement("div");
      const btn = this._body.querySelector("[data-act=submit]") || this._body.querySelector(".pf");
      if (btn) btn.parentNode.insertBefore(el, btn);
      else this._body.appendChild(el);
    }
    el.className = `account-msg account-msg--${kind || "error"}`;
    el.textContent = msg;
  },

  _val(id) {
    const el = document.getElementById(`acc-${id}`);
    return el ? el.value.trim() : "";
  },

  // ---------- Firebase ----------
  _loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("No se pudo cargar Firebase"));
      document.head.appendChild(s);
    });
  },

  _ensureFirebase() {
    if (this._sdkPromise) return this._sdkPromise;
    if (typeof GG_FIREBASE_CONFIG === "undefined" || !GG_FIREBASE_CONFIG) {
      return Promise.reject(new Error("not-configured"));
    }
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/`;
    this._sdkPromise = (async () => {
      await this._loadScript(base + "firebase-app-compat.js");
      await Promise.all([this._loadScript(base + "firebase-auth-compat.js"), this._loadScript(base + "firebase-firestore-compat.js")]);
      if (!firebase.apps.length) firebase.initializeApp(GG_FIREBASE_CONFIG);
      this._auth = firebase.auth();
      // Los correos de Firebase (verificar / recuperar contraseña) salen en el idioma del juego.
      this._auth.languageCode = I18N.currentLang;
      this._db = firebase.firestore();
      this._auth.onAuthStateChanged(async (user) => {
        this._user = user;
        this._profile = null;
        if (user) {
          try {
            const snap = await this._db.collection("users").doc(user.uid).get();
            if (snap.exists) this._profile = snap.data();
          } catch (e) {}
        }
        if (user && this._profile) this._indexEmail(user, this._profile.username); // cuentas anteriores al buscador por correo
        this._btn.classList.toggle("settings-gear-btn--logged", !!user);
        document.dispatchEvent(new CustomEvent("gg:authchange", { detail: { user, profile: this._profile } }));
        this._authKnown = true;
        this._knownWaiters.splice(0).forEach((r) => r());
        if (this._overlay.classList.contains("settings-overlay--visible") && !this._busy) this._render();
      });
    })().catch((e) => {
      this._sdkPromise = null; // permite reintentar
      throw e;
    });
    return this._sdkPromise;
  },

  _errText(e) {
    const c = (e && e.code) || (e && e.message) || "";
    const map = {
      "not-configured": "acc_x_notcfg",
      "auth/email-already-in-use": "acc_x_emailused",
      "auth/invalid-email": "acc_x_bademail",
      "auth/weak-password": "acc_x_weak",
      "auth/invalid-credential": "acc_x_cred",
      "auth/wrong-password": "acc_x_cred",
      "auth/user-not-found": "acc_x_cred",
      "auth/too-many-requests": "acc_x_many",
      "auth/network-request-failed": "acc_x_net",
      "name-taken": "acc_x_nametaken",
    };
    if (map[c]) return I18N.t(map[c]);
    // Error no previsto: se muestra su código para poder diagnosticarlo.
    console.warn("[Account]", e);
    const code = String(c).replace(/^(auth|firestore)\//, "").slice(0, 60);
    return I18N.t("acc_x_generic") + (code ? ` (${code})` : "");
  },

  _setBusy(b) {
    this._busy = b;
    const btn = this._body.querySelector("[data-act=submit], [data-act=logout]");
    if (btn) btn.style.opacity = b ? "0.6" : "";
    if (btn) btn.style.pointerEvents = b ? "none" : "";
  },

  async _submit() {
    if (this._busy) return;
    const m = this._mode;
    const email = this._val("email");
    const pass = (document.getElementById("acc-pass") || {}).value || "";
    try {
      if (m === "login") {
        if (!email) return this._note(I18N.t("acc_e_idf"));
      } else if (!email || !/^\S+@\S+\.\S+$/.test(email)) return this._note(I18N.t("acc_e_email"));
      if (m !== "reset" && !pass) return this._note(I18N.t("acc_e_pass"));
      if (m === "register") {
        const nick = this._val("nick");
        if (!ACCOUNT_NAME_RE.test(nick)) return this._note(I18N.t("acc_e_nick"));
        if (pass.length < 6) return this._note(I18N.t("acc_e_pass_len"));
        if (pass !== ((document.getElementById("acc-pass2") || {}).value || "")) return this._note(I18N.t("acc_e_pass_match"));
      }
      this._setBusy(true);
      await this._ensureFirebase();
      if (m === "login") {
        const loginEmail = await this._resolveLoginEmail(email);
        await this._auth.signInWithEmailAndPassword(loginEmail, pass);
        this._setBusy(false);
        this._render();
      } else if (m === "register") {
        await this._register(email, this._val("nick"), pass);
        this._setBusy(false);
        this._render(I18N.t("acc_ok_created"), "ok");
      } else {
        await this._auth.sendPasswordResetEmail(email);
        this._setBusy(false);
        this._mode = "login";
        this._render(I18N.t("acc_ok_reset"), "ok");
      }
    } catch (e) {
      this._setBusy(false);
      this._note(this._errText(e));
    }
  },

  // Correo o nombre de usuario indistintamente: si no lleva "@" se busca el
  // correo asociado en loginIndex/{nombre} (solo consultable por nombre exacto).
  async _resolveLoginEmail(idf) {
    if (idf.includes("@")) return idf;
    const snap = await this._db.collection("loginIndex").doc(idf.toLowerCase()).get();
    if (!snap.exists || !snap.data().email) throw { code: "auth/invalid-credential" };
    return snap.data().email;
  },

  async _register(email, nick, pass) {
    const lower = nick.toLowerCase();
    const nameRef = this._db.collection("usernames").doc(lower);
    // 1) ¿Nombre libre? (comprobación rápida; la garantía real es el paso 3).
    if ((await nameRef.get()).exists) throw { code: "name-taken" };
    // 2) Crea la cuenta (Firebase rechaza correos repetidos).
    const cred = await this._auth.createUserWithEmailAndPassword(email, pass);
    const user = cred.user;
    try {
      // 3) Reserva el nombre + perfil en UN solo lote: si el nombre ya existe,
      // las reglas lo rechazan y no se guarda nada.
      const ts = firebase.firestore.FieldValue.serverTimestamp();
      const batch = this._db.batch();
      batch.set(nameRef, { uid: user.uid, username: nick, usernameLower: lower, createdAt: ts });
      batch.set(this._db.collection("users").doc(user.uid), { username: nick, usernameLower: lower, email, createdAt: ts });
      batch.set(this._db.collection("loginIndex").doc(lower), { uid: user.uid, email: user.email, createdAt: ts });
      await batch.commit();
    } catch (e) {
      // Pierde la carrera por el nombre: se deshace la cuenta recién creada.
      try {
        await user.delete();
      } catch (e2) {}
      throw { code: "name-taken" };
    }
    this._indexEmail(user, nick); // para que te puedan añadir como amigo por correo (sin bloquear el registro)
    this._profile = { username: nick, usernameLower: lower, email };
    try {
      await user.updateProfile({ displayName: nick });
      await user.sendEmailVerification();
    } catch (e) {}
  },

  // emails/{correo en minúsculas} -> { uid, username }: solo para buscar amigos por correo.
  async _indexEmail(user, nick) {
    try {
      if (!user || !user.email || !nick) return;
      const ref = this._db.collection("emails").doc(user.email.toLowerCase());
      if ((await ref.get()).exists) return;
      await ref.set({ uid: user.uid, username: nick });
    } catch (e) {
      console.warn("emails index:", e && e.code);
    }
  },

  // Límite: un cambio de nombre cada 7 días (también lo exigen las reglas de Firestore).
  _nameCooldownLeftMs(profile) {
    const p = profile || this._profile;
    const at = p && p.nameChangedAt && typeof p.nameChangedAt.toMillis === "function" ? p.nameChangedAt.toMillis() : 0;
    return at ? at + NAME_CHANGE_COOLDOWN_MS - Date.now() : 0;
  },
  _daysText(ms) {
    const d = Math.max(1, Math.ceil(ms / 86400000));
    return d === 1 ? I18N.t("acc_days_1") : I18N.t("acc_days_n", { n: d });
  },

  // Cambiar el nombre de usuario: reserva el nuevo, libera el viejo y actualiza
  // el perfil, el índice de correo y el nombre en las amistades (todo en un lote).
  async _rename() {
    if (this._busy || !this._user || !this._profile) return;
    const input = document.getElementById("acc-newnick");
    const nick = ((input && input.value) || "").trim();
    const old = this._profile.username;
    if (nick === old) { this._editingName = false; return this._render(); }
    if (!ACCOUNT_NAME_RE.test(nick)) return this._note(I18N.t("acc_e_nick"));
    const left = this._nameCooldownLeftMs();
    if (left > 0) return this._note(I18N.t("acc_rename_wait", { n: this._daysText(left) }));
    try {
      this._setBusy(true);
      await this._ensureFirebase();
      const uid = this._user.uid;
      const db = this._db;
      const lower = nick.toLowerCase();
      const oldLower = old.toLowerCase();
      const same = lower === oldLower; // solo cambian mayúsculas/minúsculas
      if (!same && (await db.collection("usernames").doc(lower).get()).exists) throw { code: "name-taken" };
      const fs = await db.collection("friends").where("users", "array-contains", uid).get();
      const ts = firebase.firestore.FieldValue.serverTimestamp();
      const batch = db.batch();
      if (!same) {
        batch.set(db.collection("usernames").doc(lower), { uid, username: nick, usernameLower: lower, createdAt: ts });
        batch.set(db.collection("loginIndex").doc(lower), { uid, email: this._user.email, createdAt: ts });
        batch.delete(db.collection("usernames").doc(oldLower));
        batch.delete(db.collection("loginIndex").doc(oldLower));
      }
      batch.update(db.collection("users").doc(uid), { username: nick, usernameLower: lower, nameChangedAt: ts });
      fs.forEach((d) => batch.update(d.ref, { [d.data().from === uid ? "fromName" : "toName"]: nick }));
      try {
        await batch.commit();
      } catch (e) {
        if (e && e.code === "permission-denied") {
          // ¿Límite de 7 días (cambio hecho desde otro dispositivo) o nombre ocupado?
          try {
            const fresh = (await db.collection("users").doc(uid).get()).data();
            const wait = this._nameCooldownLeftMs(fresh);
            if (wait > 0) {
              this._profile.nameChangedAt = fresh.nameChangedAt;
              throw { code: "name-wait", ms: wait };
            }
          } catch (e2) { if (e2 && e2.code === "name-wait") throw e2; }
          if (!same) throw { code: "name-taken" };
        }
        throw e;
      }
      // Índice de correo (para buscarte por correo): no bloquea si falla.
      try {
        const eref = db.collection("emails").doc(this._user.email.toLowerCase());
        if ((await eref.get()).exists) await eref.update({ username: nick });
        else await eref.set({ uid, username: nick });
      } catch (e) { console.warn("emails index:", e && e.code); }
      try { await this._user.updateProfile({ displayName: nick }); } catch (e) {}
      this._profile.username = nick;
      this._profile.usernameLower = lower;
      this._profile.nameChangedAt = { toMillis: () => Date.now() };
      if (typeof Friends !== "undefined") {
        Friends._name = nick;
        Friends._docs.forEach((d) => { if (d.from === uid) d.fromName = nick; else if (d.to === uid) d.toName = nick; });
      }
      if (typeof MPLobby !== "undefined") MPLobby._name = nick;
      this._editingName = false;
      this._setBusy(false);
      this._render(I18N.t("acc_ok_renamed"), "ok");
    } catch (e) {
      this._setBusy(false);
      if (e && e.code === "name-wait") return this._note(I18N.t("acc_rename_wait", { n: this._daysText(e.ms) }));
      this._note(this._errText(e));
    }
  },

  async logout() {
    this._editingName = false;
    try {
      await this._ensureFirebase();
      await this._auth.signOut();
    } catch (e) {}
    this._render();
  },
};

document.addEventListener("DOMContentLoaded", () => Account.init());
document.addEventListener("gg:langchange", () => {
  if (Account._auth) Account._auth.languageCode = I18N.currentLang;
  if (Account._btn) Account._btn.setAttribute("aria-label", I18N.t("acc_aria"));
  if (Account._overlay && Account._overlay.classList.contains("settings-overlay--visible")) Account._render();
});

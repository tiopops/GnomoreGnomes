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
    btn.setAttribute("aria-label", "Cuenta");
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
    overlay.addEventListener("click", () => this.close());
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

  // ---------- Vista ----------
  _esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  },

  _render(msg, kind) {
    const B = this._body;
    if (!B) return;
    const note = msg ? `<div class="account-msg account-msg--${kind || "error"}">${this._esc(msg)}</div>` : "";
    if (this._user) {
      const nick = (this._profile && this._profile.username) || this._user.displayName || "Jugador";
      const verified = this._user.emailVerified;
      B.innerHTML = `
        <div class="p5-banner__label settings-panel__title">MI CUENTA</div>
        <div class="account-card">
          <i class="ph-fill ph-user account-card__icon"></i>
          <div class="account-card__nick">${this._esc(nick)}</div>
          <div class="account-card__mail">${this._esc(this._user.email || "")}</div>
          <div class="account-card__state account-card__state--${verified ? "ok" : "pending"}">
            ${verified ? "Correo verificado" : "Correo sin verificar · revisa tu bandeja"}
          </div>
        </div>
        ${note}
        <button type="button" class="p5-banner p5-banner--action account-submit" data-act="logout" style="--p5-tone:#5a1d1d">
          <span class="p5-banner__label">CERRAR SESIÓN</span>
        </button>`;
      B.querySelector("[data-act=logout]").addEventListener("click", () => this.logout());
      return;
    }
    const m = this._mode;
    const field = (id, label, type, ph, extra = "") => `
      <label class="account-field">
        <span class="account-field__label">${label}</span>
        <input id="acc-${id}" type="${type}" placeholder="${ph}" autocomplete="${extra}" spellcheck="false" autocapitalize="none">
      </label>`;
    let fields = "";
    let title = "ENTRAR";
    let submit = "ENTRAR";
    if (m === "login") {
      fields = field("email", "Correo", "email", "tu@correo.com", "email") + field("pass", "Contraseña", "password", "••••••", "current-password");
    } else if (m === "register") {
      title = "CREAR CUENTA";
      submit = "REGISTRARME";
      fields =
        field("email", "Correo", "email", "tu@correo.com", "email") +
        field("nick", "Nombre de usuario", "text", "3-16 letras, números o _", "username") +
        field("pass", "Contraseña", "password", "mínimo 6 caracteres", "new-password") +
        field("pass2", "Repite la contraseña", "password", "••••••", "new-password");
    } else {
      title = "RECUPERAR";
      submit = "ENVIAR CORREO";
      fields = field("email", "Correo de tu cuenta", "email", "tu@correo.com", "email");
    }
    B.innerHTML = `
      <div class="p5-banner__label settings-panel__title">${title}</div>
      <div class="account-tabs">
        <button type="button" class="p5-banner p5-banner--action account-tab${m === "login" ? " account-tab--active" : ""}" data-mode="login"><span class="p5-banner__label">ENTRAR</span></button>
        <button type="button" class="p5-banner p5-banner--action account-tab${m === "register" ? " account-tab--active" : ""}" data-mode="register"><span class="p5-banner__label">REGISTRARSE</span></button>
      </div>
      <form class="account-form" novalidate>${fields}</form>
      ${note}
      <button type="button" class="p5-banner p5-banner--action account-submit" data-act="submit"><span class="p5-banner__label">${submit}</span></button>
      ${m === "login" ? '<button type="button" class="account-link" data-mode="reset">¿Has olvidado la contraseña?</button>' : ""}
      ${m === "reset" ? '<button type="button" class="account-link" data-mode="login">Volver</button>' : ""}`;
    B.querySelectorAll("[data-mode]").forEach((b) =>
      b.addEventListener("click", () => {
        this._mode = b.dataset.mode;
        this._render();
      })
    );
    const go = () => this._submit();
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
      const btn = this._body.querySelector("[data-act=submit]");
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
        this._btn.classList.toggle("settings-gear-btn--logged", !!user);
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
      "not-configured": "El servicio de cuentas aún no está configurado.",
      "auth/email-already-in-use": "Ese correo ya está registrado.",
      "auth/invalid-email": "El correo no es válido.",
      "auth/weak-password": "La contraseña es demasiado débil (mínimo 6 caracteres).",
      "auth/invalid-credential": "Correo o contraseña incorrectos.",
      "auth/wrong-password": "Correo o contraseña incorrectos.",
      "auth/user-not-found": "Correo o contraseña incorrectos.",
      "auth/too-many-requests": "Demasiados intentos. Espera un momento.",
      "auth/network-request-failed": "Sin conexión. Inténtalo de nuevo.",
      "name-taken": "Ese nombre de usuario ya está en uso.",
    };
    return map[c] || "Ha ocurrido un error. Inténtalo de nuevo.";
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
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) return this._note("Escribe un correo válido.");
      if (m !== "reset" && !pass) return this._note("Escribe tu contraseña.");
      if (m === "register") {
        const nick = this._val("nick");
        if (!ACCOUNT_NAME_RE.test(nick)) return this._note("El nombre debe tener 3-16 letras, números o _ (sin espacios).");
        if (pass.length < 6) return this._note("La contraseña debe tener al menos 6 caracteres.");
        if (pass !== ((document.getElementById("acc-pass2") || {}).value || "")) return this._note("Las contraseñas no coinciden.");
      }
      this._setBusy(true);
      await this._ensureFirebase();
      if (m === "login") {
        await this._auth.signInWithEmailAndPassword(email, pass);
        this._setBusy(false);
        this._render();
      } else if (m === "register") {
        await this._register(email, this._val("nick"), pass);
        this._setBusy(false);
        this._render("¡Cuenta creada! Te hemos enviado un correo para verificarla.", "ok");
      } else {
        await this._auth.sendPasswordResetEmail(email);
        this._setBusy(false);
        this._mode = "login";
        this._render("Si el correo existe, recibirás un enlace para cambiar la contraseña.", "ok");
      }
    } catch (e) {
      this._setBusy(false);
      this._note(this._errText(e));
    }
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
      await batch.commit();
    } catch (e) {
      // Pierde la carrera por el nombre: se deshace la cuenta recién creada.
      try {
        await user.delete();
      } catch (e2) {}
      throw { code: "name-taken" };
    }
    this._profile = { username: nick, usernameLower: lower, email };
    try {
      await user.updateProfile({ displayName: nick });
      await user.sendEmailVerification();
    } catch (e) {}
  },

  async logout() {
    try {
      await this._ensureFirebase();
      await this._auth.signOut();
    } catch (e) {}
    this._render();
  },
};

document.addEventListener("DOMContentLoaded", () => Account.init());

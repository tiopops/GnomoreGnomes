/* Gnomore Gnomes — colores de equipo personalizados.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Qué zonas de color (pelo, piel, ropa...) tiene cada personaje y cómo reconocerlas en su sprite.
     - Recolorear un sprite con los colores elegidos (conservando luces, sombras y contorno).
     - Guardar/leer esos colores: navegador (siempre) y Firestore skins/{uid} (con sesión).
     - Entregar a las mecánicas del juego la ruta del sprite que toca para cada equipo (TeamColors.url).
   El editor (pantalla del menú principal) vive en js/coloreditor.js.

   Cómo funciona el recoloreado: cada píxel se clasifica en una zona por su tono/saturación/luminosidad
   (no por su posición, así sirve igual para las poses de golpear, machacar, etc. del mismo personaje) y
   se limpia con reglas espaciales (franjas finas de antialiasing, motas, mejillas). Después cada zona se
   pinta con el color elegido manteniendo la luminosidad RELATIVA de cada píxel respecto a la media de su
   zona, así las sombras y luces del dibujo original se conservan. El contorno negro nunca se toca.

   Añadir un personaje: una entrada en TEAMCOLOR_CHARS con sus zonas (id, nombre, muestras) y su función
   classify(p) -> id de zona | "dark" (sombra oscura ambigua, se resuelve por vecinos) | -1 (contorno).
   Sus sprites (idle, machaca, impacto, pegar) se descubren solos desde UNIT_TYPES. */

const TEAMCOLOR_CHARS = {
  surcabosques: {
    name: "SurcaBosques",
    zones: [
      { id: "hair", name: "Pelo", sw: ["#b12735", "#2b1a12", "#e9c46a", "#6a4c93", "#2a9d8f", "#e8e8e8"] },
      { id: "skin", name: "Piel", sw: ["#f4c69c", "#c68642", "#8d5524", "#ffe0d0", "#a8d5a2", "#9ec1e8"] },
      { id: "cheek", name: "Mejillas", sw: ["#a62330", "#ff8fab", "#ff5d8f", "#e76f51", "#c77dff", "#4cc9f0"] },
      { id: "green", name: "Hojas y ropa", sw: ["#84822c", "#2d6a4f", "#b5651d", "#6a4c93", "#c1121f", "#3a86ff"] },
      { id: "brown", name: "Botas y muñequeras", sw: ["#663d27", "#2b2b2b", "#8d5524", "#7b2cbf", "#1d3557", "#c0c0c0"] },
      { id: "flower", name: "Flor", sw: ["#faeed3", "#ff6b9d", "#ffd23f", "#4cc9f0", "#ffffff", "#7bf1a8"] },
      { id: "eyewhite", name: "Blanco de los ojos", sw: ["#ffffff", "#fff3b0", "#ffd6d6", "#cfe8ff"] },
    ],
    // p: { h, s, l (HSL, h en grados), sv, v (HSV) }
    classify(p) {
      const { h, s, l, sv, v } = p;
      if (l < 0.17) {
        if (h >= 50 && h <= 170 && l > 0.07 && s > 0.25) return "green";
        if ((h >= 335 || h < 4) && l > 0.1 && s > 0.3) return "hair";
        if (h >= 10 && h < 48 && l >= 0.13) return "dark";
        return -1;
      }
      if (sv < 0.07 && v > 0.8) return "eyewhite";
      if (v > 0.8 && sv < 0.3 && h >= 25 && h <= 60) return "flower";
      if (h >= 34 && h <= 50 && sv > 0.5 && l > 0.5) return "flower";
      if (h >= 48 && h <= 170) return "green";
      if (h < 18 || h > 330) return "hair";
      if (h >= 18 && h < 48) return l > 0.58 ? "skin" : l < 0.24 ? "dark" : "brown";
      return -1;
    },
    // Reglas espaciales que dependen del dibujo (k = factor de escala de área respecto al sprite base 300x278).
    refine(ctx) {
      const { lab, W, H, nb, majority, components, k } = ctx;
      // Franjas finas del borde de la piel (antialiasing oscuro) -> piel.
      for (let it = 0; it < 3; it++) {
        const ch = [];
        for (let p = 0; p < W * H; p++) {
          if (lab[p] !== "brown") continue;
          let skin = 0, brown = 0;
          nb(p, (q) => { if (lab[q] === "skin") skin++; else if (lab[q] === "brown") brown++; });
          if (skin >= 2 && brown <= 2) ch.push(p);
        }
        ch.forEach((p) => (lab[p] = "skin"));
      }
      return { cheekMax: 200 * k, cheekMin: 40 * k };
    },
    cheek: true,
  },
};

const TeamColors = {
  VERSION: 1,
  LS_KEY: "gg_teamcolors_v1",
  saved: {}, // { typeId: { zoneId: "#rrggbb" } } — del jugador local
  teams: {}, // { equipo: { typeId: { zoneId: "#hex" } } } — colores que se usan en partida por equipo ("player", "enemy"...)
  _cache: new Map(), // clave -> URL (blob) ya recoloreada
  _pending: new Map(),
  _seg: new Map(), // url -> { lab, stats } segmentación ya calculada
  _imgs: new Map(),

  // ---------- Utilidades de color ----------
  _hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const M = Math.max(r, g, b), m = Math.min(r, g, b), l = (M + m) / 2, d = M - m;
    let h = 0, s = 0;
    if (d) {
      s = l > 0.5 ? d / (2 - M - m) : d / (M + m);
      h = M === r ? (g - b) / d + (g < b ? 6 : 0) : M === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  },
  _rgb(h, s, l) {
    h = (((h % 360) + 360) % 360) / 360;
    if (!s) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  },
  hex(c) { return "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join(""); },
  rgbOf(hex) { return [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16)); },
  validHex(v) { return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v); },

  chars() { return TEAMCOLOR_CHARS; },
  hasChar(typeId) { return !!TEAMCOLOR_CHARS[typeId]; },

  // Rutas de los sprites de un personaje (idle, machaca, impacto, pegar) tomadas de UNIT_TYPES.
  spritePaths(typeId) {
    const d = typeof UNIT_TYPES !== "undefined" ? UNIT_TYPES[typeId] : null;
    if (!d) return [];
    return [d.spriteUrl, d.machacaUrl, d.machacaImpactUrl, d.pegarGnomoUrl].filter(Boolean);
  },
  _clean(url) { return String(url || "").replace(/\?.*$/, ""); },

  // ---------- Segmentación ----------
  _segment(typeId, img) {
    const ch = TEAMCOLOR_CHARS[typeId];
    const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const cx = cv.getContext("2d", { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    const base = cx.getImageData(0, 0, W, H), b = base.data;
    const lab = new Array(W * H).fill(-1);
    for (let p = 0; p < W * H; p++) {
      const i = p * 4;
      if (b[i + 3] < 8) continue;
      const [h, s, l] = this._hsl(b[i], b[i + 1], b[i + 2]);
      const v = Math.max(b[i], b[i + 1], b[i + 2]) / 255, mn = Math.min(b[i], b[i + 1], b[i + 2]) / 255;
      lab[p] = ch.classify({ h, s, l, v, sv: v ? (v - mn) / v : 0 });
    }
    const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
    const nb = (p, fn) => {
      const x = p % W, y = (p / W) | 0;
      for (const [dx, dy] of N8) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        fn(Y * W + X);
      }
    };
    const majority = (p, allow) => {
      const c = {}; let best = null, bn = 0;
      nb(p, (q) => {
        const l = lab[q];
        if (l === -1 || l === undefined) return;
        if (allow && !allow(l)) return;
        c[l] = (c[l] || 0) + 1;
        if (c[l] > bn) { bn = c[l]; best = l; }
      });
      return best;
    };
    const components = () => {
      const seen = new Uint8Array(W * H), comps = [];
      for (let p = 0; p < W * H; p++) {
        if (seen[p] || lab[p] === -1) continue;
        const l = lab[p], st = [p], pix = [];
        seen[p] = 1;
        while (st.length) {
          const q = st.pop();
          pix.push(q);
          const x = q % W, y = (q / W) | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const X = x + dx, Y = y + dy;
            if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
            const r = Y * W + X;
            if (!seen[r] && lab[r] === l) { seen[r] = 1; st.push(r); }
          }
        }
        comps.push({ l, pix });
      }
      return comps;
    };
    const k = (W * H) / (300 * 278);
    const ctx = { lab, W, H, nb, majority, components, k };
    // 1) Sombras oscuras ambiguas: toman la zona de sus vecinos (hasta que se agote).
    const resolveDark = () => {
      for (let it = 0; it < 10; it++) {
        const chg = [];
        for (let p = 0; p < W * H; p++) {
          if (lab[p] !== "dark") continue;
          const m = majority(p, (l) => l !== "dark");
          if (m) chg.push([p, m]);
        }
        chg.forEach(([p, m]) => (lab[p] = m));
        if (!chg.length) break;
      }
      for (let p = 0; p < W * H; p++) if (lab[p] === "dark") lab[p] = -1;
    };
    resolveDark();
    const opts = ch.refine ? ch.refine(ctx) : {};
    // 2) Motas diminutas: toman la zona vecina dominante.
    for (let it = 0; it < 2; it++) {
      for (const c of components()) {
        if (c.pix.length >= 30 * k) continue;
        const cnt = {};
        c.pix.forEach((p) => nb(p, (q) => { const l = lab[q]; if (l !== c.l && l !== -1) cnt[l] = (cnt[l] || 0) + 1; }));
        let bb = null, bn = 0;
        for (const kk in cnt) if (cnt[kk] > bn) { bn = cnt[kk]; bb = kk; }
        if (bb) c.pix.forEach((p) => (lab[p] = bb));
      }
    }
    // 3) Mejillas: manchas de "pelo" pequeñas rodeadas de piel (lo demás pequeño, como la lengua, no se toca).
    if (ch.cheek) {
      for (const c of components()) {
        if (c.l !== "hair" || c.pix.length > opts.cheekMax) continue;
        let sk = 0, ot = 0;
        c.pix.forEach((p) => nb(p, (q) => { if (lab[q] === "skin") sk++; else if (lab[q] !== c.l && lab[q] !== -1) ot++; }));
        if (sk > ot * 1.5) c.pix.forEach((p) => (lab[p] = c.pix.length >= opts.cheekMin ? "cheek" : -1));
      }
    }
    // Estadísticas de cada zona (media circular del tono, saturación y luminosidad).
    const acc = {}, stats = {};
    for (let p = 0; p < W * H; p++) {
      const c = lab[p];
      if (c === -1) continue;
      const i = p * 4, [h, s, l] = this._hsl(b[i], b[i + 1], b[i + 2]);
      const a = acc[c] || (acc[c] = { n: 0, s: 0, l: 0, x: 0, y: 0 });
      a.n++; a.s += s; a.l += l;
      a.x += Math.cos((h * Math.PI) / 180); a.y += Math.sin((h * Math.PI) / 180);
    }
    for (const c in acc) {
      const a = acc[c];
      stats[c] = { s: a.s / a.n, l: a.l / a.n, h: ((Math.atan2(a.y, a.x) * 180) / Math.PI + 360) % 360 };
    }
    return { W, H, base, lab, stats };
  },

  // Pinta la imagen segmentada con los colores {zona: "#hex"}; devuelve un canvas.
  paint(seg, colors, opts) {
    const { W, H, base, lab, stats } = seg;
    const out = new ImageData(W, H), d = out.data, b = base.data;
    const T = {};
    for (const id in colors) if (this.validHex(colors[id])) { const [h, s, l] = this._hsl(...this.rgbOf(colors[id])); T[id] = { h, s, l }; }
    const hot = opts && opts.hot, zones = opts && opts.zones;
    for (let p = 0; p < W * H; p++) {
      const i = p * 4, c = lab[p];
      d[i] = b[i]; d[i + 1] = b[i + 1]; d[i + 2] = b[i + 2]; d[i + 3] = b[i + 3];
      if (c === -1) { if (hot && b[i + 3] > 8) d[i + 3] = b[i + 3] * 0.35; continue; }
      if (zones && zones[c]) { d[i] = zones[c][0]; d[i + 1] = zones[c][1]; d[i + 2] = zones[c][2]; continue; }
      if (hot && c !== hot) { d[i + 3] = b[i + 3] * 0.25; continue; }
      const t = T[c], st = stats[c];
      if (!t) continue;
      const [h, s, l] = this._hsl(b[i], b[i + 1], b[i + 2]);
      const nl = Math.min(1, Math.max(0, t.l + (l - st.l) * (t.l < 0.12 || t.l > 0.9 ? 0.5 : 1)));
      const ns = Math.min(1, Math.max(0, st.s ? t.s * (s / st.s) : t.s));
      const nh = t.h + (((h - st.h + 540) % 360) - 180) * 0.35;
      const [r2, g2, b2] = this._rgb(nh, ns, nl);
      d[i] = r2; d[i + 1] = g2; d[i + 2] = b2;
    }
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    cv.getContext("2d").putImageData(out, 0, 0);
    return cv;
  },

  // Zona original de cada píxel de un sprite ya cargado (el editor lo usa para el modo "ver zonas" y los tonos base).
  analyse(typeId, img) { return this._segment(typeId, img); },
  baseHex(seg, id) { const st = seg.stats[id]; return st ? this.hex(this._rgb(st.h, st.s, st.l)) : "#888888"; },

  // ---------- Entrega de sprites a las mecánicas del juego ----------
  _key(url, colors) { return this._clean(url) + "|" + JSON.stringify(colors); },
  colorsFor(typeId, team) { return (this.teams[team] && this.teams[team][typeId]) || null; },

  // Ruta del sprite que toca para este personaje y equipo. Si hay colores personalizados y ya está recoloreado,
  // devuelve la URL recoloreada (blob:); si aún no lo está, lo prepara en segundo plano y devuelve la original
  // (cuando acaba avisa con onReady para que quien llama refresque). Sin colores personalizados no cambia nada.
  url(url, typeId, team, onReady) {
    if (!url) return url;
    const colors = this.colorsFor(typeId, team);
    if (!colors || !TEAMCOLOR_CHARS[typeId]) return url;
    const key = this._key(url, colors);
    const hit = this._cache.get(key);
    if (hit) return hit;
    this.prepare(typeId, url, colors).then((u) => { if (u && onReady) onReady(u); }).catch(() => {});
    return url;
  },

  _load(url) {
    const k = this._clean(url);
    if (!this._imgs.has(k)) {
      this._imgs.set(k, new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = url;
      }));
    }
    return this._imgs.get(k);
  },

  async prepare(typeId, url, colors) {
    const key = this._key(url, colors);
    if (this._cache.has(key)) return this._cache.get(key);
    if (this._pending.has(key)) return this._pending.get(key);
    const pr = (async () => {
      const sk = this._clean(url);
      let seg = this._seg.get(sk);
      if (!seg) {
        const im = await this._load(url);
        seg = this._segment(typeId, im);
        this._seg.set(sk, seg);
      }
      const cv = this.paint(seg, colors);
      const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
      const u = URL.createObjectURL(blob);
      this._cache.set(key, u);
      return u;
    })();
    this._pending.set(key, pr);
    try { return await pr; } finally { this._pending.delete(key); }
  },

  // Prepara todos los sprites del personaje para un equipo (se llama al empezar la partida, antes de pintar nada).
  async prepareAll(typeId, team) {
    const colors = this.colorsFor(typeId, team);
    if (!colors) return;
    await Promise.all(this.spritePaths(typeId).map((u) => this.prepare(typeId, u, colors)));
  },
  async prepareTeam(team) {
    const t = this.teams[team];
    if (!t) return;
    await Promise.all(Object.keys(t).map((id) => this.prepareAll(id, team)));
  },

  // ---------- Equipos en partida ----------
  setTeam(team, map) {
    const clean = {};
    Object.keys(map || {}).forEach((id) => { const c = this.sanitize(id, map[id]); if (c) clean[id] = c; });
    if (Object.keys(clean).length) this.teams[team] = clean; else delete this.teams[team];
  },
  clearTeams() { this.teams = {}; },
  // El jugador local usa lo que tiene guardado.
  applyLocalToPlayer() { this.setTeam("player", this.saved); },

  sanitize(typeId, colors) {
    const ch = TEAMCOLOR_CHARS[typeId];
    if (!ch || !colors || typeof colors !== "object") return null;
    const out = {};
    ch.zones.forEach((z) => { if (this.validHex(colors[z.id])) out[z.id] = colors[z.id].toLowerCase(); });
    return Object.keys(out).length ? out : null;
  },

  // ---------- Guardado ----------
  get _db() { return typeof Account !== "undefined" ? Account._db : null; },
  get _uid() { return typeof Account !== "undefined" && Account._user ? Account._user.uid : null; },

  _readLocal() {
    try { const v = JSON.parse(localStorage.getItem(this.LS_KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; }
  },
  _writeLocal() {
    try { localStorage.setItem(this.LS_KEY, JSON.stringify(this.saved)); } catch (e) {}
  },
  _cleanAll(map) {
    const out = {};
    Object.keys(map || {}).forEach((id) => { const c = this.sanitize(id, map[id]); if (c) out[id] = c; });
    return out;
  },

  // Antes de construir una partida: fija qué equipos llevan colores y deja sus sprites ya recoloreados
  // (así ningún sprite aparece primero con los colores originales). online = true respeta los equipos que
  // Net.launch ya dejó puestos (el rival lleva SUS colores).
  async beforeMatch(online) {
    try {
      if (!online) { this.clearTeams(); this.applyLocalToPlayer(); }
      await this.prepareTeam("player");
      await this.prepareTeam("enemy");
    } catch (e) { console.warn("[TeamColors] preparar", e); }
  },

  init() {
    this.saved = this._cleanAll(this._readLocal());
    this.applyLocalToPlayer();
    this.prepareTeam("player").catch(() => {});
    document.addEventListener("gg:authchange", (e) => {
      if (e.detail && e.detail.user) this.loadRemote().catch(() => {});
    });
  },

  // Con sesión, la cuenta manda (los colores viajan entre dispositivos). Si la cuenta aún no tiene nada y el
  // navegador sí, se sube lo del navegador.
  async loadRemote() {
    const db = this._db, uid = this._uid;
    if (!db || !uid) return;
    const snap = await db.collection("skins").doc(uid).get();
    if (snap.exists) {
      const d = snap.data() || {};
      this.saved = this._cleanAll(d.chars || {});
      this._writeLocal();
    } else if (Object.keys(this.saved).length) {
      await this._saveRemote();
    }
    this.applyLocalToPlayer();
    try { await this.prepareTeam("player"); } catch (e) {}
    document.dispatchEvent(new CustomEvent("gg:teamcolors"));
  },

  async _saveRemote() {
    const db = this._db, uid = this._uid;
    if (!db || !uid) return;
    await db.collection("skins").doc(uid).set({ v: this.VERSION, chars: this.saved, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  },

  // Guarda los colores de UN personaje (o los borra si colors es null: volver a los originales).
  async saveChar(typeId, colors) {
    const c = colors ? this.sanitize(typeId, colors) : null;
    if (c) this.saved[typeId] = c; else delete this.saved[typeId];
    this._writeLocal();
    this.applyLocalToPlayer();
    try { await this.prepareTeam("player"); } catch (e) {}
    document.dispatchEvent(new CustomEvent("gg:teamcolors"));
    try { await this._saveRemote(); } catch (e) { console.warn("[TeamColors] guardar", e); return false; }
    return true;
  },

  // Colores de otro jugador (para online): skins/{uid} es legible por cualquier jugador con sesión.
  async fetchOf(uid) {
    const db = this._db;
    if (!db || !uid) return {};
    try {
      const snap = await db.collection("skins").doc(uid).get();
      return snap.exists ? this._cleanAll((snap.data() || {}).chars || {}) : {};
    } catch (e) { return {}; }
  },
};

document.addEventListener("DOMContentLoaded", () => TeamColors.init());

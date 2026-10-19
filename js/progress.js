/* Gnomore Gnomes — progreso de la cuenta: nivel, experiencia, SK y misiones diarias.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Calcular el nivel a partir de la experiencia total (XP) y su barra.
     - Dar XP al terminar cada partida (stats.js le pasa el resultado) y al cumplir
       misiones diarias (al instante) y todas ellas (bonus).
     - El SK (Skill Rating), número interno que usa el emparejamiento online:
       sube y baja con los resultados (Elo contra personas, pequeño contra la IA)
       y recibe un empujón cada vez que se sube de nivel. No se muestra al jugador.
     - Generar la lista de misiones del día (igual para todos, se renueva a las 00:00 locales).
     - Pintar el bloque de nivel + misiones del perfil y el bloque de XP de la pantalla final.
   Datos: progress/{uid} en Firestore (reglas en firebase/firestore.rules) con copia en
   localStorage: si las reglas aún no están publicadas o no hay red, el progreso sigue
   funcionando en este navegador y se sube cuando se puede. No cuenta el tutorial. */

Object.assign(STRINGS.es, {
  pg_level: "NIVEL",
  pg_lv_short: "NIV",
  pg_missions: "Misiones diarias",
  pg_tab_missions: "MISIONES",
  pg_tab_stats: "ESTADÍSTICAS",
  pg_tab_unlocks: "PREMIOS",
  pg_bonus: "Completa todas",
  pg_streak: "Racha diaria",
  pg_days: "{n} días",
  pg_day: "{n} día",
  pg_renew: "Se renueva en {t}",
  pg_levelup: "¡SUBES DE NIVEL!",
  m_play: "Juega {n} partidas",
  m_play1: "Juega una partida",
  m_win1: "Gana una partida",
  m_totems1: "Captura un tótem",
  m_kills1: "Derrota a una unidad rival",
  m_win: "Gana {n} partidas",
  m_totems: "Captura {n} tótems",
  m_kills: "Derrota a {n} unidades rivales",
  m_online: "Juega una partida online",
  m_onlinewin: "Gana una partida online",
  m_raceplay: "Juega con {race}",
  m_racewin: "Gana con {race}",
  m_levelplay: "Lucha en {level}",
  m_multiwin: "Gana contra 2 rivales a la vez",
});
Object.assign(STRINGS.en, {
  pg_level: "LEVEL",
  pg_lv_short: "LVL",
  pg_missions: "Daily missions",
  pg_tab_missions: "MISSIONS",
  pg_tab_stats: "STATS",
  pg_tab_unlocks: "REWARDS",
  pg_bonus: "Complete them all",
  pg_streak: "Daily streak",
  pg_days: "{n} days",
  pg_day: "{n} day",
  pg_renew: "Resets in {t}",
  pg_levelup: "LEVEL UP!",
  m_play: "Play {n} matches",
  m_play1: "Play a match",
  m_win1: "Win a match",
  m_totems1: "Capture a totem",
  m_kills1: "Defeat an enemy unit",
  m_win: "Win {n} matches",
  m_totems: "Capture {n} totems",
  m_kills: "Defeat {n} enemy units",
  m_online: "Play an online match",
  m_onlinewin: "Win an online match",
  m_raceplay: "Play with {race}",
  m_racewin: "Win with {race}",
  m_levelplay: "Fight in {level}",
  m_multiwin: "Win against 2 rivals at once",
});

const PROGRESS_LEVEL_CAP = 99;
const PROGRESS_SK_START = 1000;
const PROGRESS_SK_MIN = 100;
const PROGRESS_SK_LEVELUP = 10; // el SK sube un poco con cada nivel (el progreso también cuenta)
const PROGRESS_MISSIONS_PER_DAY = 4;
const PROGRESS_ALL_BONUS_XP = 100;
const PROGRESS_XP_WIN = 100;
const PROGRESS_XP_DRAW = 50;
const PROGRESS_XP_LOSS = 40;
const PROGRESS_XP_ONLINE = 25;

// Plantillas de misión. metric: qué contador de partida las hace avanzar; param: raza/nivel concreto.
const PROGRESS_POOL = [
  { id: "play", metric: "games", targets: [2, 3], xp: 40, icon: "game-controller", key: "m_play", kind: "play" },
  { id: "win", metric: "wins", targets: [1, 2], xp: 70, icon: "trophy", key: "m_win", kind: "win" },
  { id: "totems", metric: "totems", targets: [3, 5], xp: 50, icon: "flag-banner", key: "m_totems", kind: "play" },
  { id: "kills", metric: "kills", targets: [4, 8], xp: 50, icon: "sword", key: "m_kills", kind: "play" },
  { id: "online", metric: "online", targets: [1], xp: 70, icon: "users", key: "m_online", kind: "online" },
  { id: "onlinewin", metric: "onlineWins", targets: [1], xp: 110, icon: "crown", key: "m_onlinewin", kind: "online" },
  { id: "raceplay", metric: "racePlay", param: "race", targets: [1], xp: 40, icon: "users-three", key: "m_raceplay", kind: "play" },
  { id: "racewin", metric: "raceWin", param: "race", targets: [1], xp: 80, icon: "medal", key: "m_racewin", kind: "win" },
  { id: "levelplay", metric: "levelPlay", param: "level", targets: [1], xp: 40, icon: "map-trifold", key: "m_levelplay", kind: "play" },
  { id: "multiwin", metric: "multiWin", targets: [1], xp: 90, icon: "skull", key: "m_multiwin", kind: "win" },
];

const Progress = {
  _s: null, // estado: { xp, sk, day, prog, done, bonus, streak, lastDay }
  _uid: null,
  _loaded: false,
  _saveT: null,
  _tick: null,
  lastSummary: null, // resultado de la última partida (para la pantalla final)

  get _db() { return typeof Account !== "undefined" ? Account._db : null; },
  t(k, v) { return I18N.t(k, v); },

  init() {
    document.addEventListener("gg:authchange", (e) => this._onAuth(e.detail && e.detail.user));
  },

  // ---------- Sesión y almacenamiento ----------
  _blank() {
    return { xp: 0, sk: PROGRESS_SK_START, day: "", prog: {}, done: {}, bonus: 0, streak: 0, lastDay: "" };
  },

  _normalize(d) {
    const n = (v, def) => (typeof v === "number" && isFinite(v) && v >= 0 ? Math.floor(v) : def);
    const map = (m) => {
      const o = {};
      if (m && typeof m === "object") Object.keys(m).forEach((k) => { const v = n(m[k], 0); if (v) o[k] = v; });
      return o;
    };
    const b = this._blank();
    d = d || {};
    return {
      xp: n(d.xp, 0), sk: Math.max(PROGRESS_SK_MIN, n(d.sk, b.sk)),
      day: typeof d.day === "string" ? d.day : "", prog: map(d.prog), done: map(d.done),
      bonus: d.bonus ? 1 : 0, streak: n(d.streak, 0), lastDay: typeof d.lastDay === "string" ? d.lastDay : "",
    };
  },

  _key(uid) { return "gg_progress_" + uid; },

  _onAuth(user) {
    clearInterval(this._tick);
    this._uid = user ? user.uid : null;
    this._loaded = false;
    this._s = null;
    this.lastSummary = null;
    if (this._uid) this.load();
  },

  async load() {
    const uid = this._uid;
    if (!uid) return this._blank();
    let local = null;
    try { local = JSON.parse(localStorage.getItem(this._key(uid)) || "null"); } catch (e) {}
    local = local ? this._normalize(local) : null;
    let remote = null;
    const db = this._db;
    if (db) {
      try {
        const snap = await db.collection("progress").doc(uid).get();
        if (snap.exists) remote = this._normalize(snap.data());
      } catch (e) { console.warn("progress:", e && e.code); }
    }
    if (uid !== this._uid) return this._s || this._blank();
    // Gana quien tenga más experiencia (el otro pudo quedarse sin subir por falta de red).
    let s = remote && (!local || remote.xp >= local.xp) ? remote : local || this._blank();
    this._s = s;
    this._loaded = true;
    this._ensureDay();
    this._persist(!remote || (local && local.xp > remote.xp));
    return s;
  },

  get s() {
    if (!this._s) this._s = this._blank();
    return this._s;
  },

  _persist(remoteToo) {
    const uid = this._uid;
    if (!uid || !this._s) return;
    try { localStorage.setItem(this._key(uid), JSON.stringify(this._s)); } catch (e) {}
    if (remoteToo === false) return;
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => this._push(), 400);
  },

  async _push() {
    const db = this._db, uid = this._uid;
    if (!db || !uid || !this._s) return;
    try { await db.collection("progress").doc(uid).set(this._s); } catch (e) { console.warn("progress:", e && e.code); }
  },

  // ---------- Nivel ----------
  need(level) { return 100 + 30 * level; }, // XP para pasar de `level` al siguiente
  info(xp) {
    let level = 1, rem = Math.max(0, xp | 0);
    while (level < PROGRESS_LEVEL_CAP && rem >= this.need(level)) { rem -= this.need(level); level++; }
    return { level, into: level >= PROGRESS_LEVEL_CAP ? this.need(level) : rem, need: this.need(level) };
  },
  get level() { return this.info(this.s.xp).level; },
  get sk() { return this.s.sk; },

  // ---------- Día y misiones ----------
  _today() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  },
  _yesterday() {
    const d = new Date(Date.now() - 86400000);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  },
  _msToMidnight() {
    const d = new Date();
    const n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
    return Math.max(0, n - d);
  },

  _ensureDay() {
    const s = this.s, today = this._today();
    if (s.day !== today) {
      s.day = today;
      s.prog = {};
      s.done = {};
      s.bonus = 0;
      this._persist();
      return true;
    }
    return false;
  },

  _rng(seedStr) {
    let h = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = (h ^ (h >>> 16)) >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  },

  // Misiones de hoy: las mismas para todos los jugadores, deterministas por fecha.
  missions(day) {
    day = day || this._today();
    const rnd = this._rng("gg-" + day);
    const races = (typeof RACES !== "undefined" ? RACES : []).filter((r) => r.available);
    const levels = (typeof LEVELS !== "undefined" ? LEVELS : []).filter((l) => l.available);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const pool = PROGRESS_POOL.filter((p) => !(p.param === "race" && !races.length) && !(p.param === "level" && !levels.length));
    const out = [];
    const used = new Set();
    const take = (p) => {
      used.add(p.id);
      const t = p.targets[Math.floor(rnd() * p.targets.length)];
      const m = { i: out.length, id: p.id, metric: p.metric, target: t, xp: p.xp * (p.targets.length > 1 && t === p.targets[p.targets.length - 1] ? 1.5 : 1), icon: p.icon, key: p.key };
      m.xp = Math.round(m.xp / 5) * 5;
      if (p.param === "race") { const r = pick(races); m.param = r.id; m.vars = { race: this.t(r.nameKey) }; }
      else if (p.param === "level") { const l = pick(levels); m.param = l.id; m.vars = { level: this.t(l.nameKey) }; }
      else m.vars = { n: t };
      out.push(m);
    };
    // Siempre una fácil de jugar, una de ganar y el resto variadas.
    take(pick(pool.filter((p) => p.kind === "play")));
    take(pick(pool.filter((p) => p.kind === "win" && !used.has(p.id))));
    while (out.length < PROGRESS_MISSIONS_PER_DAY) {
      const rest = pool.filter((p) => !used.has(p.id));
      if (!rest.length) break;
      take(pick(rest));
    }
    return out;
  },

  missionTitle(m) {
    const one = m.vars && m.vars.n === 1 && typeof STRINGS !== "undefined" && STRINGS.es[m.key + "1"] ? m.key + "1" : m.key;
    return this.t(one, m.vars);
  },

  // ---------- Fin de partida ----------
  // m: { result, online, race, level, rivals, totems, kills, mmOppSk }
  onMatch(m) {
    if (!this._uid) return null;
    const s = this.s;
    this._ensureDay();
    const before = this.info(s.xp);
    const skBefore = s.sk;
    const win = m.result === "win";
    const gained = { base: 0, missions: [], bonus: 0 };

    // XP de la partida
    let base = win ? PROGRESS_XP_WIN : m.result === "draw" ? PROGRESS_XP_DRAW : PROGRESS_XP_LOSS;
    base += Math.min(10, m.kills || 0) * 2 + Math.min(5, m.totems || 0) * 5;
    if (m.online) base += PROGRESS_XP_ONLINE;
    gained.base = base;
    s.xp += base;

    // Racha de días jugados
    const today = this._today();
    if (s.lastDay !== today) { s.streak = s.lastDay === this._yesterday() ? s.streak + 1 : 1; s.lastDay = today; }

    // Misiones: se premian al instante
    const add = (key, n) => { if (n > 0) s.prog[key] = (s.prog[key] || 0) + n; };
    const list = this.missions(s.day);
    const bump = {
      games: 1, wins: win ? 1 : 0, totems: m.totems || 0, kills: m.kills || 0,
      online: m.online ? 1 : 0, onlineWins: m.online && win ? 1 : 0,
      multiWin: win && (m.rivals || 1) >= 2 ? 1 : 0,
    };
    list.forEach((mi) => {
      if (s.done[mi.i]) return;
      let inc = bump[mi.metric] || 0;
      if (mi.metric === "racePlay") inc = m.race === mi.param ? 1 : 0;
      if (mi.metric === "raceWin") inc = win && m.race === mi.param ? 1 : 0;
      if (mi.metric === "levelPlay") inc = m.level === mi.param ? 1 : 0;
      if (!inc) return;
      add(mi.i, inc);
      if ((s.prog[mi.i] || 0) >= mi.target) {
        s.prog[mi.i] = mi.target;
        s.done[mi.i] = 1;
        s.xp += mi.xp;
        gained.missions.push({ title: this.missionTitle(mi), xp: mi.xp, icon: mi.icon });
      }
    });
    if (!s.bonus && list.length && list.every((mi) => s.done[mi.i])) {
      s.bonus = 1;
      s.xp += PROGRESS_ALL_BONUS_XP;
      gained.bonus = PROGRESS_ALL_BONUS_XP;
    }

    // SK: Elo contra personas, pequeño contra la IA, y empujón por subir de nivel
    let d;
    if (typeof m.mmOppSk === "number") {
      const exp = 1 / (1 + Math.pow(10, (m.mmOppSk - s.sk) / 400));
      const sc = win ? 1 : m.result === "draw" ? 0.5 : 0;
      d = Math.round(32 * (sc - exp));
    } else d = win ? 6 : m.result === "draw" ? 0 : -4;
    const after = this.info(s.xp);
    d += Math.max(0, after.level - before.level) * PROGRESS_SK_LEVELUP;
    s.sk = Math.max(PROGRESS_SK_MIN, s.sk + d);

    this._persist();
    this.lastSummary = { before, after, gained, total: gained.base + gained.bonus + gained.missions.reduce((a, x) => a + x.xp, 0), skDelta: s.sk - skBefore };
    return this.lastSummary;
  },

  // ---------- Vista: perfil ----------
  _pad(n) { return String(n).padStart(2, "0"); },
  _clock(ms) {
    const t = Math.floor(ms / 1000);
    return this._pad(Math.floor(t / 3600)) + ":" + this._pad(Math.floor((t % 3600) / 60)) + ":" + this._pad(t % 60);
  },

  // Barra de nivel del perfil (va dentro de la tarjeta del jugador).
  heroXpHtml() {
    const s = this.s;
    this._ensureDay();
    const inf = this.info(s.xp);
    const pct = Math.max(0, Math.min(100, Math.round((100 * inf.into) / inf.need)));
    return `<div class="pf-xp__top"><span>${this.t("pg_level")} ${inf.level}</span><em>${inf.into} / ${inf.need} XP</em></div>
      <div class="pf-xp__bar"><i style="width:${pct}%"></i></div>`;
  },

  levelNow() { return this.info(this.s.xp).level; },

  // Pestaña de misiones diarias.
  missionsHtml() {
    const s = this.s;
    this._ensureDay();
    const rows = this.missions(s.day).map((m) => {
      const done = !!s.done[m.i];
      const p = Math.min(m.target, s.prog[m.i] || 0);
      return `<div class="pmis__row${done ? " pmis__row--done" : ""}">
        <i class="ph-fill ph-${m.icon} pmis__icon"></i>
        <div class="pmis__t"><span>${Account._esc(this.missionTitle(m))}</span>
          <div class="pmis__bar"><i style="width:${Math.round((100 * p) / m.target)}%"></i><em>${p}/${m.target}</em></div></div>
        <span class="pmis__xp">+${m.xp}<small>XP</small></span>
        <span class="pmis__chk"><i class="ph-bold ph-check"></i></span>
      </div>`;
    }).join("");
    const streak = `<div class="pmis__streak"><i class="ph-fill ph-fire"></i>${this.t("pg_streak")}<b>${this.t(s.streak === 1 ? "pg_day" : "pg_days", { n: s.streak })}</b></div>`;
    return `<div class="pmis">${rows}
        <div class="pmis__row pmis__row--bonus${s.bonus ? " pmis__row--done" : ""}">
          <i class="ph-fill ph-gift pmis__icon"></i>
          <div class="pmis__t"><span>${this.t("pg_bonus")}</span></div>
          <span class="pmis__xp">+${PROGRESS_ALL_BONUS_XP}<small>XP</small></span>
          <span class="pmis__chk"><i class="ph-bold ph-check"></i></span>
        </div>
        <div class="pmis__foot">${streak}<span class="pmis__timer"><i class="ph-bold ph-clock"></i><b id="pmis-timer">${this._clock(this._msToMidnight())}</b></span></div>
      </div>`;
  },

  // Mantiene el reloj de renovación y repinta si pasa la medianoche mientras está abierto.
  watch(el, repaint) {
    clearInterval(this._tick);
    this._tick = setInterval(() => {
      const t = document.getElementById("pmis-timer");
      if (!t || !t.isConnected) { clearInterval(this._tick); return; }
      if (this._ensureDay()) { repaint(); return; }
      t.textContent = this._clock(this._msToMidnight());
    }, 1000);
  },

  // ---------- Vista: pantalla final ----------
  endHtml() {
    const r = this.lastSummary;
    if (!r) return "";
    const g = r.gained;
    const chips = g.missions.map((m) => `<span class="pxp__chip"><i class="ph-bold ph-check"></i>${Account._esc(m.title)}<b>+${m.xp}</b></span>`).join("")
      + (g.bonus ? `<span class="pxp__chip pxp__chip--bonus"><i class="ph-fill ph-gift"></i>${this.t("pg_bonus")}<b>+${g.bonus}</b></span>` : "");
    const pct0 = Math.round((100 * r.before.into) / r.before.need);
    return `<div class="pxp">
      <div class="pxp__lv"><small>${this.t("pg_lv_short")}</small><b>${r.before.level}</b></div>
      <div class="pxp__main">
        <div class="pxp__top"><span class="pxp__gain">+${r.total} XP</span><span class="pxp__up">${this.t("pg_levelup")}</span></div>
        <div class="pxp__bar"><i style="width:${pct0}%"></i></div>
        ${chips ? `<div class="pxp__chips">${chips}</div>` : ""}
      </div></div>`;
  },

  // Anima la barra de XP del panel final: llena, sube de nivel (si toca) y se detiene.
  async animateEnd(root) {
    const r = this.lastSummary;
    const el = root && root.querySelector(".pxp");
    if (!r || !el) return;
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const bar = el.querySelector(".pxp__bar i"), lv = el.querySelector(".pxp__lv b");
    const ok = () => el.isConnected;
    el.classList.add("pxp--in");
    await sleep(700);
    let level = r.before.level;
    const pctOf = (into, need) => Math.round((100 * into) / need);
    while (ok() && level < r.after.level) {
      bar.style.transition = "width .55s cubic-bezier(.2,.8,.2,1)";
      bar.style.width = "100%";
      await sleep(620);
      if (!ok()) return;
      level++;
      lv.textContent = level;
      el.classList.remove("pxp--up"); void el.offsetWidth; el.classList.add("pxp--up");
      if (typeof SFX !== "undefined") { try { SFX.glory && SFX.glory(); SFX.gloryCoin && SFX.gloryCoin(9); } catch (e) {} }
      bar.style.transition = "none";
      bar.style.width = "0%";
      void bar.offsetWidth;
      await sleep(500);
    }
    if (!ok()) return;
    bar.style.transition = "width .8s cubic-bezier(.2,.8,.2,1)";
    bar.style.width = pctOf(r.after.into, r.after.need) + "%";
    if (typeof SFX !== "undefined" && r.after.level === r.before.level) { try { SFX.gloryCoin && SFX.gloryCoin(2); } catch (e) {} }
  },
};

document.addEventListener("DOMContentLoaded", () => Progress.init());

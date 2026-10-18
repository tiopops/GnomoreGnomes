/* Gnomore Gnomes — Huevo de Grulla (nivel Hurrycrane Village).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Colocar un huevo sobre una NUBE en el centro del mapa (solo en ese nivel).
     - GNOMAZO: lanzarle un gnomo lo manda EN LA DIRECCIÓN del golpe (se aleja de
       quien lo lanza). Rebota en los límites del tablero como la bola del Arkanoid.
       Mientras se apunta, un fantasma enseña dónde acabará.
     - CARGA ESTILO STRIKERS: cada rebote (bumper, tótem, obelisco o borde) sube 1
       nivel (máx. EGG_LEVELS = 10). No hay contador: el huevo destella cambiando de
       color, cada rebote suena más agudo y, a partir del nivel 6, tiembla, se tiñe
       de rojo y late como a punto de explotar. Cada turno sin rebotar pierde 1 nivel.
     - Un rebote más con el nivel al máximo lo hace EXPLOTAR: cada equipo recibe tantos
       puntos de Gloria como rebotes hizo y aparece la Grulla (js/crane.js) para
       equilibrar la partida; cuando se va, el huevo reaparece en el centro.
     - Contra un OBELISCO o un TÓTEM rebota y le quita 2, 5 o 10 de vida según la carga.
     - Atropella unidades (amigas o enemigas): 1 de daño y las aparta 1 casilla.
   La vista previa dibuja toda la trayectoria con sus rebotes.
   Mientras sea visible, el huevo bloquea su casilla (se engancha a Drums.at). */

const EGG_DIR = "assets/niveles/hurrycrane/";
const EGG_LEVELS = 10; // niveles de carga (máx.)
const EGG_BASE_DIST = 6; // casillas del vuelo con carga 0
const EGG_DIST_PER_LEVEL = 0.6; // casillas extra del gnomazo por nivel de carga
const EGG_PUSH_AWAY = 1; // 1 = en la dirección del golpe; -1 = hacia quien lanza
const EGG_GNOME_POINTS = 5; // puntos que carga el gnomo al estamparse
const EGG_BOUNCE_BONUS_MAX = 8; // tope de casillas extra por rebotes
const EGG_STEP_MS = 210; // tiempo por casilla durante el vuelo
const EGG_TURBO_BONUS = 2; // casillas extra por golpear un bumper (turbo)
const EGG_TURBO_STEP_MS = 120; // tiempo por casilla tras el primer bumper
const EGG_ASSIST_TOL = 1.25; // desvío lateral (casillas) que la ayuda de puntería perdona
const EGG_HOMING_RANGE = 4; // alcance (casillas) del teledirigido entre bumpers
const EGG_PULSE = [2.6, 2.2, 1.7, 1.05, 0.55]; // segundos por latido según carga (con carga 0 respira como el resto del escenario)
const EGG_AMP = [0.03, 0.035, 0.042, 0.052, 0.065];
// Daño a obeliscos y tótems según el nivel de carga del huevo al chocar.
function eggImpactDamage(level) { return level >= 8 ? 10 : level >= 4 ? 5 : 2; }
// Pareja de colores del destello por nivel (0 = sin carga): el destello oscila entre los dos.
const EGG_FLASH = [null, ["#ffffff", "#bfe9ff"], ["#7fe8ff", "#ffffff"], ["#6cff9c", "#bfffe0"], ["#c6ff4a", "#6cff9c"], ["#ffe95a", "#c6ff4a"],
  ["#ffb23a", "#ffe95a"], ["#ff7a2a", "#ffb23a"], ["#ff3a2a", "#ff7a2a"], ["#ff1c1c", "#ff6a3a"], ["#ff1010", "#ffffff"]];
const EGG_DIRS = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];

const Egg = {
  egg: null, // { id,row,col,el,spriteEl(envoltorio animado),imgEl,charge(0..10),bn(rebotes por equipo),exploded,... }
  nests: {}, // sin uso (compatibilidad con fog.js / net.js)
  _respawnPending: false,
  _busy: false,
  _pressed: false,

  isActive() {
    return typeof LevelAssets !== "undefined" && LevelAssets.current === "hurrycrane_village";
  },

  resetAll() {
    this._stopLoop();
    if (this.egg) this.egg.el.remove();
    this.egg = null;
    if (typeof Crane !== "undefined") Crane.resetAll();
    this._respawnPending = false;
    this._roundSeen = null;
    this._idle = 0;
    this._hitThisRound = false;
    this._bouncedThisRound = false;
    this._busy = false;
    this._pressed = false;
  },

  cheb(a, b) {
    return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
  },

  blocks(row, col) {
    const e = this.egg;
    if (e && !e.exploded && e.row === row && e.col === col) return e;
    return null;
  },

  // ---------- Reparto ----------
  spawn(size) {
    if (!this.isActive()) return;
    const best = this._centerTile(size, 6);
    if (best) this._createEgg(best.row, best.col);
  },

  _centerTile(size, openMin) {
    const mid = (size - 1) / 2;
    let best = null;
    for (let row = 1; row < size - 1; row++) for (let col = 1; col < size - 1; col++) {
      if (!this._free(row, col, size, openMin)) continue;
      if (typeof Obelisks !== "undefined" && Obelisks.list.some((o) => this.cheb(o, { row, col }) < 4)) continue;
      const s = Math.hypot(row - mid, col - mid);
      if (!best || s < best.s) best = { row, col, s };
    }
    return best;
  },

  _tileObjectAt(row, col) {
    const mods = [
      typeof Villages !== "undefined" ? Villages : null,
      typeof Bumpers !== "undefined" ? Bumpers : null,
      typeof Shops !== "undefined" ? Shops : null,
      typeof Obelisks !== "undefined" ? Obelisks : null,
      typeof Altar !== "undefined" ? Altar : null,
      typeof Oracle !== "undefined" ? Oracle : null,
      typeof Bushes !== "undefined" ? Bushes : null,
      typeof Resources !== "undefined" ? Resources : null,
      typeof TotemVision !== "undefined" ? TotemVision : null,
      typeof GnomOgro !== "undefined" ? GnomOgro : null,
      typeof Mushrooms !== "undefined" ? Mushrooms : null,
    ];
    return mods.some((m) => m && typeof m.at === "function" && m.at(row, col));
  },

  _free(row, col, size, openMin) {
    if (row < 0 || col < 0 || row >= size || col >= size) return false;
    if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) return false;
    if (typeof Units !== "undefined" && Units.unitAt(row, col)) return false;
    if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) return false;
    if (this._tileObjectAt(row, col)) return false;
    if (typeof Obelisks !== "undefined" && Obelisks.isAdjacent && Obelisks.isAdjacent(row, col)) return false;
    if (typeof Drums !== "undefined" && Drums.at(row, col)) return false;
    if (typeof Volcano !== "undefined" && Volcano.isNear && Volcano.isNear(row, col, 2)) return false;
    let open = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if ((dr || dc) && (typeof TerrainMap === "undefined" || TerrainMap.isWalkable(row + dr, col + dc))) open++;
    }
    return open >= (openMin || 5);
  },

  // ¿Puede posarse aquí? Firme, libre (salvo unidades que se apartarán) y dentro.
  _canRest(row, col, ignoreUnit) {
    const size = Units.boardSize;
    if (row < 0 || col < 0 || row >= size || col >= size) return false;
    const u = Units.unitAt(row, col);
    if (u && u !== ignoreUnit) return false;
    if (Gnome.isAt(row, col)) return false;
    if (this._tileObjectAt(row, col)) return false;
    if (typeof Drums !== "undefined" && Drums.list.some((d) => d.row === row && d.col === col)) return false;
    return typeof TerrainMap === "undefined" || TerrainMap.isWalkable(row, col);
  },

  _setSprite(img, file) {
    const src = EGG_DIR + file;
    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(img, src);
    else img.src = src;
  },

  _place(el, row, col, zExtra) {
    const { x, y } = getTileCenter(row, col, Units.boardSize);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.zIndex = String((row + col) * 10 + (zExtra || 5));
  },

  _createEgg(row, col) {
    const el = document.createElement("div");
    el.className = "unit egg";
    // Estructura: halo (destello) + envoltorio que tiembla + cuerpo animado (latido/rebote) con la
    // imagen y dos capas con la silueta del huevo: el destello de color y el tinte rojo.
    const glowEl = document.createElement("div");
    glowEl.className = "egg__glow";
    const shakeEl = document.createElement("div");
    shakeEl.className = "egg__shake";
    const spriteEl = document.createElement("div");
    spriteEl.className = "egg__sprite";
    const imgEl = document.createElement("img");
    imgEl.className = "egg__img";
    imgEl.decoding = "async";
    imgEl.alt = "";
    imgEl.draggable = false;
    const flashEl = document.createElement("div");
    flashEl.className = "egg__flash";
    const tintEl = document.createElement("div");
    tintEl.className = "egg__tint";
    spriteEl.append(imgEl, flashEl, tintEl);
    shakeEl.appendChild(spriteEl);
    el.append(glowEl, shakeEl);
    Units.container.appendChild(el);
    this._place(el, row, col, 6);
    el.addEventListener("contextmenu", (ev) => ev.preventDefault());
    this.egg = { id: "egg-1", row, col, el, spriteEl, imgEl, shakeEl, glowEl, flashEl, tintEl, charge: 0, bn: {}, exploded: false, lastTeam: null };
    this._applyStage();
    this.refreshFog();
    return this.egg;
  },

  // ---------- Carga: sprite, temblor, tinte y destello ----------
  _stageFile(level) {
    return level >= 9 ? "huevo_muy_agrietado.png" : level >= 7 ? "huevo_agrietado.png" : "huevo.png";
  },

  _setImg(file) {
    const e = this.egg;
    if (!e) return;
    this._setSprite(e.imgEl, file);
    e.spriteEl.style.setProperty("--egg-mask", `url("${new URL(EGG_DIR + file, document.baseURI).href}")`);
  },

  _applyStage() {
    const e = this.egg;
    if (!e) return;
    const f = this._stageFile(e.charge);
    if (e._stage !== f) {
      e._stage = f;
      this._setImg(f);
    }
    const L = e.charge;
    // Latido de respiración (como antes, más rápido cuanto más cargado).
    const h = Math.min(EGG_PULSE.length - 1, Math.floor(L / 2));
    e.spriteEl.style.setProperty("--egg-pulse", `${EGG_PULSE[h]}s`);
    e.spriteEl.style.setProperty("--egg-amp", String(EGG_AMP[h]));
    // Nivel 6+: tiembla cada vez más y se tiñe de rojo.
    e.shakeEl.className = "egg__shake" + (L >= 6 ? ` egg__shake--l${L}` : "");
    e.tintEl.style.opacity = L >= 6 ? String(Math.min(0.8, (L - 5) * 0.17)) : "0";
    if (L > 0 && this.isActive()) this._startLoop();
    else this._stopLoop(true);
  },

  // Bucle del destello: oscila entre los dos colores del nivel, más rápido cuanto más cargado,
  // y a partir del 6 añade el latido sonoro de "a punto de explotar".
  _startLoop() {
    if (this._raf) return;
    const mix = (a, b, t) => {
      const A = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
      const B = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
      return "rgb(" + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",") + ")";
    };
    const tick = (t) => {
      const e = this.egg;
      if (!e || e.exploded || e.charge <= 0) { this._raf = 0; this._clearFlash(); return; }
      const L = e.charge, pair = EGG_FLASH[Math.min(L, 10)];
      const ph = Math.sin((t / 1000) * Math.PI * 2 * (0.9 + L * 0.55)) * 0.5 + 0.5;
      const col = mix(pair[0], pair[1], ph);
      const hidden = this._hidden();
      e.el.style.setProperty("--fc", col);
      e.flashEl.style.opacity = hidden ? "0" : String(0.18 + ph * (0.25 + L * 0.045));
      e.glowEl.style.opacity = hidden ? "0" : String(0.12 + ph * (0.1 + L * 0.045));
      if (L >= 6 && !hidden && !this._busy && t - (this._tickT || 0) > 900 - (L - 6) * 190) {
        this._tickT = t;
        if (typeof SFX !== "undefined" && SFX.eggTick) { try { SFX.eggTick(L); } catch (er) {} }
      }
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  },

  _stopLoop(clear) {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    if (clear) this._clearFlash();
  },

  _clearFlash() {
    const e = this.egg;
    if (!e) return;
    e.flashEl.style.opacity = "0";
    e.glowEl.style.opacity = "0";
  },

  // Ya no hay contador de carga (se sustituye por el destello): se dejan vacíos por compatibilidad.
  _placeBadge() {},
  showBadge() {},
  hideBadge() { this._pressed = false; },

  _live() {
    return this.isActive() && this.egg && !this.egg.exploded;
  },

  _hidden() {
    const e = this.egg;
    if (!e) return true;
    return typeof Fog !== "undefined" && (Fog.isFoggedReal(e.row, e.col) || !!e._unseen);
  },

  // ---------- Plan del vuelo ----------
  // k = -1 / 0 / +1: desvío de 45° a un lado, recto o al otro (el jugador elige 1 de las 3).
  _dirFrom(holder, e, choice) {
    const k = Math.round(Math.atan2(e.row - holder.row, e.col - holder.col) / (Math.PI / 4)) + (choice || 0);
    const d = EGG_DIRS[((k % 8) + 8) % 8];
    return [d[0] * EGG_PUSH_AWAY, d[1] * EGG_PUSH_AWAY];
  },

  _distFor(charge) {
    return EGG_BASE_DIST + Math.round(charge * EGG_DIST_PER_LEVEL);
  },

  // Casilla a la que se aparta una unidad atropellada (perpendicular al vuelo).
  _shoveTile(unit, dr, dc, avoid) {
    const size = Units.boardSize;
    for (const [pr, pc] of [[dc, -dr], [-dc, dr]]) {
      const row = unit.row + pr, col = unit.col + pc;
      if (row < 0 || col < 0 || row >= size || col >= size) continue;
      if (avoid.some((t) => t.row === row && t.col === col)) continue;
      if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) continue;
      if (Units.unitAt(row, col) || Gnome.isAt(row, col) || this._tileObjectAt(row, col)) continue;
      if (typeof Drums !== "undefined" && Drums.list.some((d) => d.row === row && d.col === col)) continue;
      return { row, col };
    }
    return null;
  },

  // Simula el vuelo de `dist` casillas desde el huevo en la dirección `dir`
  // con rebotes en los límites del tablero y en los obeliscos (pinball).
  _simulate(dir, dist, holderTeam, holder) {
    const e = this.egg;
    const size = Units.boardSize;
    // Para el huevo el obelisco ocupa 4 losetas (la suya y las 3 de "detrás", donde se alza el sprite):
    // si no, es muy difícil que impacte y visualmente ya parece que las ocupe.
    const obAt = (r, c) => {
      if (typeof Obelisks === "undefined" || r < 0 || c < 0 || r >= size || c >= size) return null;
      return Obelisks.at(r, c) || Obelisks.at(r + 1, c) || Obelisks.at(r, c + 1) || Obelisks.at(r + 1, c + 1) || null;
    };
    // Tótems (aldeas, js/villages.js): rebotan igual que los obeliscos, de cualquier equipo.
    const vAt = (r, c) => (typeof Villages !== "undefined" && r >= 0 && c >= 0 && r < size && c < size ? Villages.at(r, c) : null);
    const bAt = (r, c) => (typeof Bumpers !== "undefined" && r >= 0 && c >= 0 && r < size && c < size ? Bumpers.at(r, c) : null);
    // Bumpers ya golpeados en este vuelo: el huevo los atraviesa sin efecto.
    // Y los que ya rebotaron en este turno (Bumpers.used): un bumper solo rebota una vez por turno.
    const seen = new Set([...(typeof Bumpers !== "undefined" && Bumpers.lit ? Bumpers.lit : []), ...(typeof Bumpers !== "undefined" && Bumpers.used ? Bumpers.used : [])]), blocked = new Set();
    const bLive = (r, c) => { const b = bAt(r, c); return b && !seen.has(b) ? b : null; };
    const wall = (r, c) => r < 0 || c < 0 || r >= size || c >= size || !!obAt(r, c) || !!vAt(r, c) || !!bLive(r, c);
    // Aleatorio determinista (misma vista previa y vuelo real).
    let sd = ((e.row * 73856093) ^ (e.col * 19349663) ^ (dir[0] * 83492791 + dir[1] * 2654435) ^ (e.charge * 1013)) >>> 0;
    const rng = () => { sd = (sd + 0x6d2b79f5) >>> 0; let x = sd; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    const lineNext = (fr, fc, t) => {
      const ar = t.row - fr, ac = t.col - fc, st = Math.max(Math.abs(ar), Math.abs(ac)) || 1;
      return [fr + Math.round(ar / st), fc + Math.round(ac / st)];
    };
    // Bumper al que teledirigirse: a la vista (sin niebla), sin golpear aún y a poca distancia.
    const pickTarget = (fr, fc, cur, clear) => {
      if (typeof Bumpers === "undefined") return null;
      let best = null, bs = Infinity;
      Bumpers.list.forEach((b) => {
        if (b === cur || seen.has(b) || blocked.has(b)) return;
        if (typeof Fog !== "undefined" && Fog.isFoggedReal(b.row, b.col)) return;
        const ar = b.row - fr, ac = b.col - fc, st = Math.max(Math.abs(ar), Math.abs(ac));
        if (!st || st > EGG_HOMING_RANGE) return;
        // La trayectoria no puede atravesar niebla de guerra: si hay niebla de por medio, no se teledirige.
        for (let j = 1; j < st; j++) {
          const lr = fr + Math.round(ar * j / st), lc = fc + Math.round(ac * j / st);
          if (typeof Fog !== "undefined" && Fog.isFoggedReal(lr, lc)) return;
          if (clear && wall(lr, lc)) return;
        }
        const sc = st * 10 + Math.abs(ar) + Math.abs(ac);
        if (sc < bs) { bs = sc; best = b; }
      });
      return best;
    };
    // Ayuda de puntería (permisiva, un poco de "trampa"): si un bumper visible queda casi en la
    // línea del tiro (hasta ~1 casilla de desvío lateral) y el camino está despejado, el huevo se
    // corrige hacia él. Así apuntar a un bumper no es un tedio de milímetros.
    const assist = (fr, fc, dr0, dc0, rem) => {
      if (typeof Bumpers === "undefined") return null;
      const dl = Math.hypot(dr0, dc0) || 1;
      let best = null, bs = Infinity;
      Bumpers.list.forEach((b) => {
        if (seen.has(b) || blocked.has(b)) return;
        if (typeof Fog !== "undefined" && Fog.isFoggedReal(b.row, b.col)) return;
        const ar = b.row - fr, ac = b.col - fc, st = Math.max(Math.abs(ar), Math.abs(ac));
        if (st < 2 || st > rem) return;
        const fwd = (ar * dr0 + ac * dc0) / dl, cross = Math.abs(ar * dc0 - ac * dr0) / dl;
        if (fwd < 1.5 || cross > EGG_ASSIST_TOL || cross < 0.01) return;
        for (let j = 1; j < st; j++) {
          const lr = fr + Math.round(ar * j / st), lc = fc + Math.round(ac * j / st);
          if (wall(lr, lc)) return;
          if (typeof Fog !== "undefined" && Fog.isFoggedReal(lr, lc)) return;
        }
        const sc = cross * 10 + st;
        if (sc < bs) { bs = sc; best = b; }
      });
      return best;
    };
    let r = e.row, c = e.col, dr = dir[0], dc = dir[1];
    const steps = [];
    // Cada rebote regala 1 casilla más de recorrido (con tope para no ciclar); los bumpers dan +2 (turbo).
    let total = dist;
    const maxTotal = dist + EGG_BOUNCE_BONUS_MAX;
    let target = null, fast = false;
    let lv = e.charge, explode = false;
    for (let i = 0; i < total; i++) {
      const step_r0 = r, step_c0 = c;
      if (!target && i === 0) target = assist(r, c, dr, dc, total - i);
      let nr, nc;
      if (target) { [nr, nc] = lineNext(r, c, target); dr = nr - r; dc = nc - c; }
      else { nr = r + dr; nc = c + dc; }
      const lock = target;
      let bounced = false, ob = null, wallAt = null, village = null, bumper = null;
      const aim = (t) => { // pone rumbo (recto) hacia el bumper t; si está pegado a un obstáculo, se queda
        [nr, nc] = lineNext(r, c, t); dr = nr - r; dc = nc - c;
        if (wall(nr, nc)) { nr = r; nc = c; }
      };
      const reflect = () => {
        const wr = wall(r + dr, c), wc = wall(r, c + dc);
        if (dr && dc) {
          if (wr && !wc) dr = -dr;
          else if (wc && !wr) dc = -dc;
          else if (!wr && !wc) dc = -dc; // esquina de un objeto suelto: rebote en espejo (diagrama)
          else { dr = -dr; dc = -dc; }
        } else if (dr) dr = -dr;
        else dc = -dc;
        nr = r + dr; nc = c + dc;
        if (wall(nr, nc)) { nr = r; nc = c; } // atrapado: se queda en su casilla
      };
      if (wall(nr, nc)) {
        bounced = true;
        wallAt = { row: nr, col: nc };
        ob = obAt(nr, nc);
        village = ob ? null : vAt(nr, nc);
        bumper = ob || village ? null : bLive(nr, nc);
        if (bumper) {
          // Golpe de bumper: +2 casillas, turbo y teledirigido hacia el siguiente bumper visible.
          seen.add(bumper);
          total += EGG_TURBO_BONUS;
          fast = true;
          target = pickTarget(r, c, bumper, false);
          if (target) aim(target); else reflect();
        } else if (target) {
          // Algo se interpone yendo hacia un bumper: otro bumper libre de obstáculos o rebote al azar.
          blocked.add(target);
          if (total < maxTotal) total++;
          target = pickTarget(r, c, null, true);
          if (target) aim(target);
          else {
            const ok = EGG_DIRS.filter((d) => !wall(r + d[0], c + d[1]));
            const d = ok.length ? ok[Math.floor(rng() * ok.length)] : [-dr, -dc];
            dr = d[0]; dc = d[1]; nr = r + dr; nc = c + dc;
            if (wall(nr, nc)) { nr = r; nc = c; }
          }
        } else {
          if (total < maxTotal) total++;
          reflect();
          const at = (nr !== r || nc !== c) ? assist(nr, nc, dr, dc, total - i - 1) : null;
          if (at) target = at;
        }
      }
      // Cada rebote sube un nivel de carga; con el nivel al máximo, el siguiente rebote lo hace explotar.
      let level = lv, dmg = 0;
      if (bounced) {
        if (lv >= EGG_LEVELS) { explode = true; nr = step_r0; nc = step_c0; }
        else { lv++; level = lv; }
        if (ob || village) dmg = eggImpactDamage(Math.max(1, level));
      }
      r = nr; c = nc;
      const step = { row: r, col: c, dr, dc, bounced, unit: null, shove: null, ob: ob || null, village: village || null, bumper: bumper || null, wallAt, prev: { row: step_r0, col: step_c0 }, lock: lock || null, fast, level, dmg, explode };
      steps.push(step);
      if (explode) break;
      const u = Units.unitAt(r, c);
      if (u && u !== holder && !(r === e.row && c === e.col)) step.unit = u;
    }
    // Explota en el último rebote: no se posa, revienta donde está.
    if (explode) return { steps, explode: true, dest: { row: r, col: c }, dir, endLevel: lv };
    // Posarse: hacia atrás hasta una casilla válida (una unidad atropellada se aparta).
    const avoid = steps.map((s) => ({ row: s.row, col: s.col }));
    for (let k = steps.length - 1; k >= 0; k--) {
      const s = steps[k];
      const own = s.row === e.row && s.col === e.col;
      if (s.unit) {
        const sh = this._shoveTile(s.unit, s.dr, s.dc, avoid);
        if (!sh || !this._canRest(s.row, s.col, s.unit)) continue;
      } else if (!own && !this._canRest(s.row, s.col)) continue;
      steps.length = k + 1;
      steps.forEach((x) => { if (x.unit) x.shove = this._shoveTile(x.unit, x.dr, x.dc, avoid); });
      // El nivel final es el del último rebote que se conserva.
      let end = e.charge;
      steps.forEach((x) => { if (x.bounced) end = x.level; });
      return { steps, explode: null, dest: { row: s.row, col: s.col }, dir, endLevel: end };
    }
    return { steps: [], explode: null, dest: null, dir, endLevel: e.charge };
  },

  // Plan del vuelo cuando un gnomo rebota en un bumper y golpea el huevo desde una casilla vecina:
  // la dirección la marca el rebote (dir), no la posición de quien lanza.
  _planDir(dir) {
    const d = [dir[0] * EGG_PUSH_AWAY, dir[1] * EGG_PUSH_AWAY];
    return this._simulate(d, this._distFor(this.egg.charge), "player", null);
  },

  // Golpe del gnomo (tras rebotar en un bumper) contra el huevo: mismo efecto que un gnomazo.
  async _ricochetHit(holder, dir) {
    const e = this.egg;
    if (!e || e.exploded) { if (typeof Bumpers !== "undefined") await Bumpers.endFlight(holder.team); return; }
    e.lastTeam = holder.team;
    const plan = this._planDir(dir);
    if (typeof SFX !== "undefined") { try { SFX.hit(); if (SFX.rockHit) SFX.rockHit(); } catch (er) {} }
    if (typeof Bumpers !== "undefined") { const n = Bumpers.registerHit(); Bumpers.reactAt({ row: e.row, col: e.col, spriteEl: e.spriteEl }, n); }
    this._pulseFx();
    this._flash();
    await new Promise((r) => setTimeout(r, 280));
    await this._fly(plan, holder);
  },

  // Qué pasaría si `holder` le lanzase un gnomo ahora mismo.
  _plan(holder, choice) {
    const e = this.egg;
    const dir = this._dirFrom(holder, e, choice);
    const sim = this._simulate(dir, this._distFor(e.charge), holder.team, holder);
    sim.choice = choice || 0;
    return sim;
  },

  // ---------- Lanzar gnomos contra el huevo ----------
  _targetable() {
    return this._live() && !this._hidden() && !this._busy;
  },

  _interceptor(holder) {
    const e = this.egg;
    const d = this.cheb(holder, e);
    for (let i = 1; i < d; i++) {
      const r = Math.round(holder.row + ((e.row - holder.row) * i) / d);
      const c = Math.round(holder.col + ((e.col - holder.col) * i) / d);
      const u = Units.unitAt(r, c);
      if (u && u !== holder) return u;
    }
    return null;
  },

  // Elegir 1 de 3 direcciones: flechas sobre las 3 casillas vecinas del huevo
  // (desvío -45°, recto, +45° respecto a quien lanza). Ratón: pasar = ver el
  // recorrido, clic = lanzar. Táctil: 1.er toque = ver, 2.º = lanzar.
  addThrowMarker(unit, gnome) {
    if (!this._targetable()) return;
    const e = this.egg;
    const dist = this.cheb(unit, e);
    if (dist < 1 || dist > GNOME_THROW_MAX_RANGE) return;
    const blocked = !!this._interceptor(unit);
    this._pv = [];
    this._pvK = null;
    const size = Units.boardSize;
    const base = Math.round(Math.atan2(e.row - unit.row, e.col - unit.col) / (Math.PI / 4));
    const fire = (k) => {
      if (this._pvK !== k || !this._pv || !this._pv.some((m) => m.isConnected)) { this._showPreview(unit, k); return; }
      this.throwGnome(unit, gnome, k);
    };
    const arrows = [];
    const setHot = (k) => arrows.forEach((a) => a.el && a.el.classList.toggle("egg-arrow--hot", a.k === k));
    // Marcador central (casilla del huevo): lanza recto; sirve de reserva en los bordes.
    const mk0 = Units.addMarker({
      className: "pass-marker egg-throw-marker egg-throw-marker--center" + (blocked ? " egg-throw-marker--blocked" : ""),
      row: e.row,
      col: e.col,
      zOffset: 12,
      visibleClass: "pass-marker--visible",
      owner: "gnome",
      alwaysOnTop: true,
      buildContent: (marker) => {
        const icon = document.createElement("i");
        icon.className = "ph ph-paper-plane-tilt pass-marker__icon";
        marker.appendChild(icon);
      },
      onClick: () => fire(0),
    });
    if (mk0) {
      mk0.addEventListener("pointerenter", (ev) => { if (ev.pointerType === "mouse") { this._showPreview(unit, 0); setHot(0); } });
      mk0.addEventListener("pointerleave", (ev) => { if (ev.pointerType === "mouse") { this._clearPreview(); setHot(null); } });
    }
    [-1, 0, 1].forEach((k) => {
      const d = EGG_DIRS[(((base + k) % 8) + 8) % 8];
      const row = e.row + d[0], col = e.col + d[1];
      if (row < 0 || col < 0 || row >= size || col >= size) return;
      const mk = Units.addMarker({
        className: "pass-marker egg-throw-marker egg-arrow-marker" + (blocked ? " egg-throw-marker--blocked" : ""),
        row, col,
        zOffset: 13,
        visibleClass: "pass-marker--visible",
        owner: "gnome",
        alwaysOnTop: true,
        buildContent: (marker) => {
          // Flecha plana sobre el suelo (proyectada en la perspectiva del tablero).
          const NS = "http://www.w3.org/2000/svg";
          const hw = TILE_WIDTH / 2, hh = TILE_TOP_HEIGHT / 2;
          // Se construye en el plano del suelo (casillas) y se proyecta a la perspectiva del tablero.
          const len = Math.hypot(d[0], d[1]);
          const ud = [d[0] / len, d[1] / len], up = [-d[1] / len, d[0] / len];
          const pt = (a, b2) => {
            const gr = ud[0] * a + up[0] * b2, gc = ud[1] * a + up[1] * b2;
            return ((gc - gr) * hw).toFixed(1) + "," + ((gc + gr) * hh).toFixed(1);
          };
          const svg = document.createElementNS(NS, "svg");
          svg.setAttribute("class", "egg-arrow__svg");
          svg.setAttribute("width", "1");
          svg.setAttribute("height", "1");
          svg.style.overflow = "visible";
          const poly = document.createElementNS(NS, "polygon");
          poly.setAttribute("points", [pt(0.3, 0), pt(-0.17, 0.24), pt(-0.07, 0), pt(-0.17, -0.24)].join(" "));
          poly.setAttribute("class", "egg-arrow__poly");
          svg.appendChild(poly);
          marker.appendChild(svg);
        },
        onClick: () => fire(k),
      });
      if (!mk) return;
      arrows.push({ k, el: mk });
      mk.addEventListener("pointerenter", (ev) => { if (ev.pointerType === "mouse") { this._showPreview(unit, k); setHot(k); } });
      mk.addEventListener("pointerleave", (ev) => { if (ev.pointerType === "mouse") { this._clearPreview(); setHot(null); } });
    });
  },

  _showPreview(unit, choice) {
    this._clearPreview();
    this._pvK = choice || 0;
    if (this._live()) this._addPreview(unit, choice || 0);
  },

  _clearPreview() {
    (this._pv || []).forEach((m) => {
      m.remove();
      if (Units.markerEls) { const i = Units.markerEls.indexOf(m); if (i >= 0) Units.markerEls.splice(i, 1); }
    });
    this._pv = [];
  },

  // Fantasma del huevo donde acabará + casillas de paso + avisos, para poder rectificar.
  _addPreview(holder, choice) {
    const plan = this._plan(holder, choice || 0);
    const hot = "";
    const mk = (row, col, build, zOffset) => {
      const mm = Units.addMarker({
        className: "pass-marker egg-preview-marker" + hot,
        row, col,
        zOffset: zOffset || 8,
        visibleClass: "pass-marker--visible",
        owner: "gnome",
        alwaysOnTop: true,
        buildContent: build,
      });
      if (this._pv) this._pv.push(mm);
      return mm;
    };
    const lab = (m, text, cls) => {
      const l = document.createElement("div");
      l.className = "egg-preview__label" + (cls ? " " + cls : "");
      l.textContent = text;
      m.appendChild(l);
    };
    // Trayectoria estilo billar: línea de puntos desde el huevo, que se
    // quiebra en cada rebote, y el huevo fantasma al final.
    this._addTrail(plan, mk);
    plan.steps.forEach((t) => {
      if (t.unit) {
        mk(t.row, t.col, (m) => {
          const ring = document.createElement("div");
          ring.className = "egg-preview__hit";
          m.appendChild(ring);
          lab(m, "-1");
        }, 7);
      }
    });
    const obs = new Set();
    plan.steps.forEach((t) => {
      if (!t.ob || obs.has(t.ob)) return;
      obs.add(t.ob);
      mk(t.ob.row, t.ob.col, (m) => lab(m, "-" + t.dmg), 14);
    });
    if (plan.explode && plan.dest) {
      mk(plan.dest.row, plan.dest.col, (m) => lab(m, "¡EXPLOTA!", "egg-preview__label--blocked"), 9);
    } else if (plan.dest) {
      mk(plan.dest.row, plan.dest.col, (m) => {
        const ring = document.createElement("div");
        ring.className = "egg-preview__ring";
        m.appendChild(ring);
        const img = document.createElement("img");
        img.className = "egg-preview__ghost";
        img.alt = "";
        img.draggable = false;
        img.src = EGG_DIR + "huevo_lowres.png";
        m.appendChild(img);
        if (plan.steps.length && plan.steps[plan.steps.length - 1].unit) lab(m, "-1");
      }, 9);
    } else {
      mk(this.egg.row, this.egg.col, (m) => lab(m, "Sin sitio", "egg-preview__label--blocked"), 9);
    }
  },

  // Línea de puntos (como la guía de las bolas de billar) a lo largo del recorrido.
  _addTrail(plan, mk) {
    const e = this.egg;
    if (!plan.steps.length) return;
    const size = Units.boardSize;
    const C = (row, col) => getTileCenter(row, col, size);
    const o = C(e.row, e.col);
    const pts = [{ x: 0, y: 0 }];
    plan.steps.forEach((t) => {
      if (t.wallAt) {
        // El quiebro se dibuja a medio camino de la pared contra la que rebota.
        const a = C(t.prev.row, t.prev.col), w = C(t.wallAt.row, t.wallAt.col);
        pts.push({ x: (a.x + w.x) / 2 - o.x, y: (a.y + w.y) / 2 - o.y });
      }
      const p = C(t.row, t.col);
      pts.push({ x: p.x - o.x, y: p.y - o.y });
    });
    const d = pts.map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");
    const trail = mk(e.row, e.col, (m) => {
      const NS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(NS, "svg");
      svg.setAttribute("class", "egg-trail__svg");
      svg.setAttribute("width", "1");
      svg.setAttribute("height", "1");
      svg.style.overflow = "visible";
      const mkPath = (cls) => {
        const p = document.createElementNS(NS, "path");
        p.setAttribute("d", d);
        p.setAttribute("class", cls);
        svg.appendChild(p);
      };
      mkPath("egg-trail__shadow");
      mkPath("egg-trail__dots");
      plan.steps.forEach((t) => {
        if (!t.wallAt) return;
        const a = C(t.prev.row, t.prev.col), w = C(t.wallAt.row, t.wallAt.col);
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", ((a.x + w.x) / 2 - o.x).toFixed(1));
        c.setAttribute("cy", ((a.y + w.y) / 2 - o.y).toFixed(1));
        c.setAttribute("r", "12");
        c.setAttribute("class", "egg-trail__bounce");
        svg.appendChild(c);
      });
      m.appendChild(svg);
    }, 4);
    if (trail && trail.classList) trail.classList.add("egg-trail");
  },

  async throwGnome(holder, gnome, choice) {
    const e = this.egg;
    if (!this._targetable() || gnome.heldBy !== holder.id || gnome.busy) return;
    if (typeof Turns !== "undefined" && !Turns.canAct(holder)) return;
    if (typeof Turns !== "undefined") Turns.useAction(holder);
    this._pv = [];
    Units.clearRangeOverlays();
    gnome.passing = false;
    gnome.busy = true;
    gnome.hideBadge();

    const dist = this.cheb(holder, e);
    const type = UNIT_TYPES[holder.typeId];
    const success = Math.random() < gnome.computePassSuccess(type.agilidad, dist, type.movimiento);
    Units.faceTowardsTile(holder, e.row, e.col);
    gnome.row = holder.row;
    gnome.col = holder.col;
    Units.faceTowardsTile(gnome, e.row, e.col);
    if (holder.el) {
      holder.el.classList.remove("unit--throwing");
      void holder.spriteEl.offsetWidth;
      holder.el.classList.add("unit--throwing");
      setTimeout(() => holder.el && holder.el.classList.remove("unit--throwing"), 380);
    }
    gnome.detachFrom();
    gnome.spriteEl.src = GNOME_ASSETS.grita;

    const blocker = success ? this._interceptor(holder) : null;
    if (!success) {
      const end = gnome.findDropTile(holder, GNOME_THROW_MAX_RANGE);
      await gnome.animateThrowTo(holder.row, holder.col, end.row, end.col);
      await gnome.landAt(end);
    } else if (blocker) {
      await gnome.animateThrowTo(holder.row, holder.col, blocker.row, blocker.col);
      if (!Gnome.isHeldBy(blocker.id)) {
        gnome.row = blocker.row;
        gnome.col = blocker.col;
        gnome.attachTo(blocker);
        const gained = gnome.computePassPoints(dist, type.movimiento);
        gnome._addPoints(gained);
        Units.spawnFloatingText(blocker, `+${gained}`, { className: "dmg-popup gnome-points-popup" });
        SFX.passSuccess();
      } else {
        const end = gnome.findDropTile(blocker);
        await gnome.landAt({ row: end.row, col: end.col });
      }
    } else {
      this._busy = true;
      try { await this._gnomazo(holder, gnome, choice || 0); } finally { this._busy = false; }
    }

    gnome.busy = false;
    if (holder.el) Units.refreshRange(holder);
    if (gnome._refreshSelectedUnitRange) gnome._refreshSelectedUnitRange();
  },

  async _gnomazo(holder, gnome, choice) {
    const e = this.egg;
    e.lastTeam = holder.team;
    const plan = this._plan(holder, choice); // ANTES de que cambie nada
    const from = { row: e.row, col: e.col };
    await gnome.animateThrowTo(holder.row, holder.col, e.row, e.col);
    gnome.row = e.row;
    gnome.col = e.col;
    gnome._addPoints(EGG_GNOME_POINTS);
    Units.spawnFloatingText({ row: e.row, col: e.col, team: "player" }, `+${EGG_GNOME_POINTS}`, { className: "dmg-popup gnome-points-popup" });
    if (typeof SFX !== "undefined") { try { SFX.hit(); if (SFX.rockHit) SFX.rockHit(); } catch (er) {} }
    if (gnome.spriteEl && gnome.spriteEl.animate) {
      gnome.spriteEl.animate(
        [{ transform: "scale(1,1)" }, { transform: "scale(1.35,.6)", offset: 0.3 }, { transform: "scale(.85,1.2)", offset: 0.7 }, { transform: "scale(1,1)" }],
        { duration: 300, easing: "ease-out" }
      );
    }
    this._pulseFx();
    this._flash();
    await new Promise((r) => setTimeout(r, 280));

    const eggFlight = this._fly(plan, holder);
    const tile = this._bounceTile(from, holder, gnome, plan);
    if (tile) {
      await gnome.animateThrowTo(from.row, from.col, tile.row, tile.col);
      await gnome.landAt(tile, { sound: () => SFX.gnomeLandSoft() });
    } else {
      const end = gnome.findDropTile(holder, GNOME_THROW_MAX_RANGE);
      await gnome.animateThrowTo(from.row, from.col, end.row, end.col);
      await gnome.landAt(end);
    }
    await eggFlight;
    await gnome._fleeAwayFrom(from.row, from.col, 3);
  },

  _bounceTile(from, holder, gnome, plan) {
    let best = null;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const row = from.row + dr, col = from.col + dc;
      if (row < 0 || col < 0 || row >= Units.boardSize || col >= Units.boardSize) continue;
      if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) continue;
      if (Units.unitAt(row, col) || Gnome._otherGnomeAt(gnome, row, col) || this._tileObjectAt(row, col)) continue;
      if (plan.steps.some((t) => t.row === row && t.col === col)) continue;
      const score = this.cheb({ row, col }, holder) * 10 + Math.hypot(row - holder.row, col - holder.col);
      if (!best || score < best.score) best = { row, col, score };
    }
    return best;
  },

  // ---------- Vuelo del huevo ----------
  async _fly(plan, holder) {
    const e = this.egg;
    if (!plan.steps.length) {
      if (!this._hidden()) Units.spawnFloatingText({ row: e.row, col: e.col, team: "player" }, "Sin sitio", { className: "dmg-popup" });
      return;
    }
    const avoid = plan.steps.map((s) => ({ row: s.row, col: s.col }));
    e.el.style.setProperty("--egg-step", `${EGG_STEP_MS}ms`);
    e.el.classList.add("egg--moving");
    e.lastTeam = holder.team;
    if (typeof Bumpers !== "undefined") { if (!Bumpers._keepCombo) Bumpers.beginFlight(); Bumpers._keepCombo = false; }
    let prev = plan.dir;
    let exploded = false;
    for (const s of plan.steps) {
      const ms = s.fast ? EGG_TURBO_STEP_MS : EGG_STEP_MS;
      e.el.style.setProperty("--egg-step", `${ms}ms`);
      if (s.fast) this._ghost(e.el);
      if (typeof Bumpers !== "undefined") Bumpers.setLock(s.lock);
      e.row = s.row;
      e.col = s.col;
      this._place(e.el, s.row, s.col, 6);
      prev = [s.dr, s.dc];
      await new Promise((r) => setTimeout(r, ms));
      if (s.bounced) {
        // Efecto del objeto golpeado (daño, onda, luces) y luego la carga del huevo.
        if (s.ob) { this._hitObelisk(s.ob, holder.team, s.dmg); if (typeof Bumpers !== "undefined") Bumpers.registerHit(); }
        if (s.village) { this._bumpVillage(s.village, holder.team, s.dmg); if (typeof Bumpers !== "undefined") { const n = Bumpers.registerHit(); Bumpers.reactAt(s.village, n); } }
        if (s.bumper && typeof Bumpers !== "undefined") { const n = Bumpers.registerHit(); Bumpers.reactAt(s.bumper, n); Bumpers.markLit(s.bumper, holder.team); Bumpers.markUsed(s.bumper); }
        if (!s.ob && !s.village && !s.bumper && typeof Bumpers !== "undefined") { Bumpers.registerHit(); Bumpers.reactAt({ row: s.row, col: s.col }, Bumpers.combo); this._shake(false); }
        if (s.explode) { exploded = true; break; }
        this._bounced(s, holder.team);
      }
      if (s.unit && s.unit.el && s.unit.hp > 0) { if (typeof Bumpers !== "undefined") Bumpers.registerHit(); await this._trample(s, holder.team, avoid); }
      if (typeof Fog !== "undefined") Fog.applyVisibility();
    }
    e.el.classList.remove("egg--moving");
    if (typeof Fog !== "undefined") Fog.applyVisibility();
    this.refreshFog();
    if (typeof Bumpers !== "undefined") await Bumpers.endFlight(holder.team);
    if (exploded) await this._explode(holder.team);
  },

  // Rebote: sube 1 nivel de carga y suma 1 rebote al equipo que lanzó (cada uno cobra los suyos al explotar).
  _bounced(s, team) {
    const e = this.egg;
    if (!e || e.exploded) return;
    e.charge = Math.min(EGG_LEVELS, e.charge + 1);
    e.bn[team] = (e.bn[team] || 0) + 1;
    this._bouncedThisRound = true;
    this._applyStage();
    this._bounceFx(!!(s.ob || s.village));
    this._ring();
  },

  // Atropello: 1 de daño y se aparta 1 casilla de lado.
  async _trample(step, causer, avoid) {
    const u = step.unit;
    if (typeof SFX !== "undefined") { try { SFX.hit(); } catch (er) {} }
    if (typeof Drums !== "undefined" && Drums._applyDamage) Drums._applyDamage({ kind: "unit", ref: u, row: u.row, col: u.col }, 1, causer);
    if (!u.el || u.hp <= 0) return;
    const to = step.shove || this._shoveTile(u, step.dr, step.dc, avoid);
    if (!to) return;
    const prevLeft = u.el.style.left, prevTop = u.el.style.top;
    u.el.classList.add("unit--moving");
    u.row = to.row;
    u.col = to.col;
    const { x, y } = getTileCenter(to.row, to.col, Units.boardSize);
    u.el.style.left = `${x}px`;
    u.el.style.top = `${y}px`;
    u.el.style.zIndex = String((to.row + to.col) * 10 + 5);
    if (u.spriteEl) {
      u.spriteEl.classList.remove("unit__sprite--hop");
      void u.spriteEl.offsetWidth;
      u.spriteEl.classList.add("unit__sprite--hop");
    }
    await Units.awaitPositionSettle(u.el, prevLeft, prevTop, 160);
    u.el.classList.remove("unit--moving");
    if (u.spriteEl) u.spriteEl.classList.remove("unit__sprite--hop");
    if (typeof Villages !== "undefined") Villages.refreshOcclusion();
    if (typeof Obelisks !== "undefined") Obelisks.refreshOcclusion();
    if (typeof Units !== "undefined" && Units.refreshUnitOcclusion) Units.refreshUnitOcclusion();
  },

  // Estela del vuelo turbo: copia fantasma del huevo que se desvanece.
  _ghost(el) {
    if (!el || !el.parentNode) return;
    const g = el.cloneNode(true);
    g.classList.remove("egg--moving");
    g.classList.add("egg-ghost");
    g.style.zIndex = String((parseInt(el.style.zIndex, 10) || 6) - 1);
    el.parentNode.appendChild(g);
    requestAnimationFrame(() => { g.style.opacity = "0"; });
    setTimeout(() => g.remove(), 320);
  },

  _shake(big) {
    const vp = document.getElementById("board-viewport");
    if (!vp) return;
    const cls = big ? "board-viewport--shake--big" : "board-viewport--shake";
    vp.classList.remove(cls);
    void vp.offsetWidth;
    vp.classList.add(cls);
    setTimeout(() => vp.classList.remove(cls), 420);
  },

  // Rebote contra un tótem (aldea): solo rebota, sin daño. Pequeño temblor + sonido + estirón del tótem.
  _bumpVillage(v, causer, dmgIn) {
    this._shake(false);
    if (v && v.el && v.el.animate) {
      v.el.animate([{ filter: "brightness(1)" }, { filter: "brightness(1.6)" }, { filter: "brightness(1)" }], { duration: 260 });
    }
    // El huevo también le quita vida al tótem (2, 5 o 10 según su carga, igual que al obelisco).
    // Si llega a 0 lo captura el equipo que lanzó; un tótem propio no recibe daño.
    if (v && typeof Villages !== "undefined" && v.hp > 0 && v.owner !== causer) {
      const dmg = dmgIn || eggImpactDamage(Math.max(1, (this.egg && this.egg.charge) || 1));
      v.hp = Math.max(0, v.hp - dmg);
      if (Villages._isLive(v)) {
        Units.updateHpBar(v);
        Units.spawnFloatingText(v, `-${dmg}`, { className: "dmg-popup" });
        Units.playShake(v);
      } else v._visualDirty = true;
      if (v.hp <= 0) Villages._capture(v, causer, 1);
    }
  },

  // Rebote contra un obelisco: 1 de daño (sea amigo o enemigo), temblor y destello.
  _hitObelisk(ob, causer, dmgIn) {
    this._shake(false);
    this._flash();
    const dmg = dmgIn || eggImpactDamage(Math.max(1, (this.egg && this.egg.charge) || 1));
    if (typeof Drums !== "undefined" && Drums._applyDamage) Drums._applyDamage({ kind: "obelisk", ref: ob, row: ob.row, col: ob.col }, dmg, causer);
  },

  // El huevo explota (un rebote más con la carga al máximo): cada equipo cobra tantos puntos
  // de Gloria como rebotes hizo, y la Grulla aparece para equilibrar la partida.
  async _explode(team) {
    const e = this.egg;
    if (!e || e.exploded) return;
    e.exploded = true;
    this._stopLoop(true);
    this._busy = true;
    const hidden = this._hidden();
    if (!hidden && e.spriteEl.animate) {
      e.shakeEl.animate([{ transform: "scale(1)" }, { transform: "scale(1.2,.85)", offset: 0.5 }, { transform: "scale(1.45,1.45)" }], { duration: 380, easing: "ease-in" });
      await new Promise((r) => setTimeout(r, 360));
    }
    if (!hidden) {
      if (typeof SFX !== "undefined" && SFX.eggBoom) { try { SFX.eggBoom(); } catch (er) {} }
      this._shake(true);
      this._flash();
      this._shatter();
    }
    e.el.style.opacity = "0";
    const bn = Object.assign({}, e.bn);
    e.bn = {};
    e.charge = 0;
    // Gloria por rebotes.
    await new Promise((r) => setTimeout(r, hidden ? 50 : 450));
    let coin = 0;
    for (const t of Teams.all) {
      const n = bn[t] || 0;
      if (n <= 0) continue;
      this._grantGlory(t, n);
      const ob = typeof Obelisks !== "undefined" ? Obelisks.byTeam(t) : null;
      if (!hidden && ob) {
        for (let k = 0; k < Math.min(n, 12); k++) setTimeout(() => { if (typeof SFX !== "undefined" && SFX.gloryCoin) { try { SFX.gloryCoin(coin++); } catch (er) {} } }, k * 70);
        Units.spawnFloatingText({ row: ob.row, col: ob.col, team: t }, `+${n}`, { className: "dmg-popup popup--good" });
        await new Promise((r) => setTimeout(r, 380));
      }
    }
    // La Grulla equilibra la partida.
    if (typeof Crane !== "undefined") await Crane.arrive(bn);
    else this._respawn();
    this._busy = false;
  },

  _grantGlory(t, g) {
    if (g > 0 && typeof Glory !== "undefined" && t in Glory.points) {
      const room = Math.max(0, (typeof GLORY_CAP !== "undefined" ? GLORY_CAP : 999) - Glory.points[t]);
      const add = Math.min(g, room);
      Glory.points[t] += add;
      Glory._render(t, { bump: add > 0, gained: add });
    }
  },

  _shatter() {
    const e = this.egg;
    const { x, y } = getTileCenter(e.row, e.col, Units.boardSize);
    for (let i = 0; i < 14; i++) {
      const s = document.createElement("div");
      s.className = "egg-shard";
      s.style.left = `${x}px`;
      s.style.top = `${y - 60}px`;
      s.style.zIndex = String((e.row + e.col) * 10 + 22);
      Units.container.appendChild(s);
      const a = (i / 14) * Math.PI * 2 + NR() * 0.4;
      const d = 80 + NR() * 90;
      s.animate(
        [
          { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d - 60}px)) rotate(${NR() * 360}deg) scale(.6)`, opacity: 1, offset: 0.6 },
          { transform: `translate(calc(-50% + ${Math.cos(a) * d * 1.1}px), calc(-50% + ${Math.sin(a) * d + 40}px)) rotate(${NR() * 540}deg) scale(.3)`, opacity: 0 },
        ],
        { duration: 950, easing: "ease-out" }
      ).onfinish = () => s.remove();
    }
    if (e.spriteEl.animate) {
      e.spriteEl.animate(
        [{ transform: "scale(1,1)", opacity: 1 }, { transform: "scale(1.3,.8)", opacity: 1, offset: 0.25 }, { transform: "scale(.4,1.5)", opacity: 0 }],
        { duration: 520, easing: "ease-in", fill: "forwards" }
      );
    }
  },

  // ---------- Efectos ----------
  _bounceFx(heavy) {
    const e = this.egg;
    if (!e || !e.spriteEl.animate) return;
    if (!this._hidden() && typeof SFX !== "undefined") {
      try {
        SFX.eggBounce(Math.max(1, e.charge), heavy);
        if (e.charge >= 3) SFX.eggSparkle(e.charge);
      } catch (er) {}
    }
    e.spriteEl.animate(
      [{ scale: "1 1" }, { scale: "1.28 0.74", offset: 0.28 }, { scale: "0.9 1.14", offset: 0.62 }, { scale: "1 1" }],
      { duration: 260, easing: "ease-out" }
    );
  },

  // Onda de color del nivel alrededor del huevo en cada rebote.
  _ring() {
    const e = this.egg;
    if (!e || this._hidden()) return;
    const { x, y } = getTileCenter(e.row, e.col, Units.boardSize);
    const r = document.createElement("div");
    r.className = "egg-ring";
    r.style.left = `${x}px`;
    r.style.top = `${y - 60}px`;
    r.style.zIndex = String((e.row + e.col) * 10 + 19);
    r.style.borderColor = e.el.style.getPropertyValue("--fc") || "#fff";
    Units.container.appendChild(r);
    r.animate(
      [{ transform: "translate(-50%,-50%) scale(.25)", opacity: 0.95 }, { transform: "translate(-50%,-50%) scale(1.5)", opacity: 0 }],
      { duration: 420, easing: "ease-out" }
    ).onfinish = () => r.remove();
  },

  _pulseFx() {
    const e = this.egg;
    if (!e || !e.spriteEl.animate) return;
    e.spriteEl.animate(
      [{ scale: "1 1" }, { scale: "1.08 0.9", offset: 0.2 }, { scale: "0.96 1.07", offset: 0.5 }, { scale: "1 1" }],
      { duration: 420, easing: "ease-out" }
    );
  },

  _flash() {
    const e = this.egg;
    if (!e) return;
    const { x, y } = getTileCenter(e.row, e.col, Units.boardSize);
    const f = document.createElement("div");
    f.className = "egg-flash";
    f.style.left = `${x}px`;
    f.style.top = `${y - 60}px`;
    f.style.zIndex = String((e.row + e.col) * 10 + 20);
    Units.container.appendChild(f);
    f.animate(
      [{ transform: "translate(-50%,-50%) scale(.2)", opacity: 1 }, { transform: "translate(-50%,-50%) scale(1.3)", opacity: 0 }],
      { duration: 420, easing: "ease-out" }
    ).onfinish = () => f.remove();
  },

  // ---------- Turnos ----------
  onTurnStart(team) {
    // Un bumper solo rebota una vez por turno.
    if (typeof Bumpers !== "undefined" && Bumpers.resetUsed) Bumpers.resetUsed();
    this._decay();
  },

  // Cada turno (ronda) sin ningún rebote le resta 1 nivel de carga.
  _decay() {
    const e = this.egg;
    if (!e || e.exploded || typeof Turns === "undefined") return;
    const round = Turns.roundNumber;
    if (this._roundSeen === round) return;
    if (this._roundSeen != null && !this._bouncedThisRound && e.charge > 0) {
      e.charge = Math.max(0, e.charge - 1);
      this._applyStage();
      this._pulseFx();
      if (!this._hidden()) Units.spawnFloatingText({ row: e.row, col: e.col, team: "player" }, "-1", { className: "dmg-popup" });
    }
    this._roundSeen = round;
    this._bouncedThisRound = false;
  },

  // Reaparece en el centro (cuando la Grulla se va) con la carga y los rebotes a cero.
  _respawn() {
    const e = this.egg;
    this._respawnPending = false;
    if (!e) return;
    const best = this._centerTile(Units.boardSize, 5) || { row: e.row, col: e.col };
    e.row = best.row;
    e.col = best.col;
    e.charge = 0;
    e.bn = {};
    e.exploded = false;
    e._stage = null;
    this._bouncedThisRound = false;
    this._busy = false;
    e.el.classList.add("egg--respawn");
    e.el.style.opacity = "0";
    if (e.spriteEl.getAnimations) e.spriteEl.getAnimations().forEach((a) => { if (!a.animationName) a.cancel(); });
    this._place(e.el, e.row, e.col, 6);
    this._applyStage();
    void e.el.offsetWidth;
    e.el.style.opacity = "1";
    setTimeout(() => e.el.classList.remove("egg--respawn"), 1400);
    if (typeof Fog !== "undefined") Fog.applyVisibility();
    this.refreshFog();
    if (!this._hidden()) {
      this._flash();
      if (typeof SFX !== "undefined" && SFX.eggPop) { try { SFX.eggPop(); } catch (er) {} }
    }
  },

  // ---------- Niebla ----------
  refreshFog() {
    if (typeof Fog === "undefined") return;
    const e = this.egg;
    if (!e) return;
    if (e._unseen && Fog.isPerceived(e.row, e.col) && !Fog.isFoggedReal(e.row, e.col)) e._unseen = false;
    const fogged = Fog.isFoggedReal(e.row, e.col) || !!e._unseen;
    e.el.classList.toggle("unit--fog-hidden", fogged);
    e.el.classList.toggle("gg-remembered", !fogged && !Fog.isPerceived(e.row, e.col));
    if (fogged && this._pressed) this.hideBadge();
  },
};

// ---------- IA rival ----------
// Lanza si el golpe rebota en obeliscos ENEMIGOS o atropella a más enemigos que aliados.
Egg.aiAct = async function (unit) {
  if (!this._live() || this._busy || !unit.el || unit.team === "player") return false;
  if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return false;
  const held = typeof Gnome !== "undefined" ? Gnome.list.find((g) => g.heldBy === unit.id) : null;
  if (!held || held.busy) return false;
  const e = this.egg;
  const dist = this.cheb(unit, e);
  if (dist < 1 || dist > GNOME_THROW_MAX_RANGE) return false;
  if (this._interceptor(unit)) return false;
  const bn = (this.egg && this.egg.bn) || {};
  const mine = bn[unit.team] || 0;
  const theirs = Math.max(0, ...Teams.all.filter((t) => t !== unit.team).map((t) => bn[t] || 0));
  const evalPlan = (plan) => {
    let score = 0;
    let bounces = 0;
    plan.steps.forEach((s) => {
      // Obelisco/tótem: el daño depende de la carga; dañar uno enemigo vale mucho (y al revés si es propio).
      if (s.ob) {
        const dmg = Math.min(s.dmg, s.ob.hp || s.dmg);
        const kill = dmg >= (s.ob.hp || 99) ? 10 : 0;
        score += (s.ob.team !== unit.team ? 1 : -1) * (dmg * 0.8 + kill);
      }
      if (s.unit) score += s.unit.team !== unit.team ? 3 : -3;
      if (s.bounced && !s.explode) bounces++;
    });
    // Cada rebote es 1 punto de Gloria para quien lanza, y ponerse por delante de los demás...
    score += bounces * 1.2;
    // ...pero si explota, la Grulla se posa sobre el obelisco del que va primero: solo conviene si NO soy yo.
    if (plan.explode) score += mine + bounces > theirs ? -6 : 4;
    return score;
  };
  // Elige el mejor de los 3 desvíos (-45°, recto, +45°); a igualdad, recto.
  let best = null;
  [0, -1, 1].forEach((k) => {
    const plan = this._plan(unit, k);
    const sc = evalPlan(plan);
    if (!best || sc > best.sc) best = { k, sc };
  });
  if (!best || best.sc <= 0) return false;
  await this.throwGnome(unit, held, best.k);
  return true;
};
(function () {
  if (typeof Turns === "undefined" || !Turns._aiActOnce) return;
  const orig = Turns._aiActOnce;
  Turns._aiActOnce = async function (unit) {
    try {
      if (await Egg.aiAct(unit)) return true;
    } catch (er) {
      console.warn("[IA] huevo", er);
    }
    return orig.apply(this, arguments);
  };
})();

// Soltar el dedo/ratón en cualquier sitio cierra el contador de carga.
window.addEventListener("pointerup", () => { if (Egg._pressed) Egg.hideBadge(); });
window.addEventListener("pointercancel", () => { if (Egg._pressed) Egg.hideBadge(); });

// El huevo ocupa su casilla igual que un tambor.
if (typeof Drums !== "undefined" && !Drums._eggPatched) {
  Drums._eggPatched = true;
  const _drumsAt = Drums.at;
  Drums.at = function (row, col) {
    return _drumsAt.call(this, row, col) || Egg.blocks(row, col) || (typeof Bumpers !== "undefined" ? Bumpers.at(row, col) : null);
  };
}

if (typeof Turns !== "undefined") Turns.registerTurnStartListener(Egg);

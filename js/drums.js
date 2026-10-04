/* Gnomore Gnomes — Tambores de Guerra (nivel Colinas Rock'n Troll).
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Repartir tambores neutrales por el mapa (solo en ese nivel).
     - La ruleta PROPIA de 10 porciones de cada equipo (cada jugador ve solo
       la suya, en el color de su equipo) y su marcador sobre cada tambor
       con al menos una unidad propia adyacente.
     - Al FINAL del turno de un equipo: cada tambor donde tiene mayoría de
       unidades adyacentes (empate/minoría = nada) rellena +1 porción, y
       cada golpe a un gnomo dado por una unidad adyacente a un tambor suma
       +1 más (solo si la mayoría sigue siendo suya; el tambor tiembla y el
       marcador deja una porción fantasma pendiente).
     - Al llegar a 10/10, o en los turnos múltiplos de 10 (gana la pugna
       quien más porciones tenga; los empatados en cabeza se libran), cae la
       lluvia de rocas sobre los demás equipos: unidades, tótems y
       obeliscos. El juego queda en pausa como en un turno ajeno.
       Daño = 2 + nº de lluvias anteriores.
     - Los fragmentos que saltan de cada roca rota: se recogen al pisarlos y
       van a la mochila (recurso apilable "Fragmento de roca"). */

const DRUM_SLICES = 10;
const DRUM_DISPUTE_EVERY = 10;
const DRUM_BASE_RAIN_DAMAGE = 2;
const DRUM_DIR = "assets/niveles/rockntroll/";
const DRUM_TEAM_COLORS = { player: "#3aa0ff", enemy: "#ff5148", enemy2: "#52d66a", enemy3: "#c067ff" };

const Drums = {
  list: [],
  frags: [],
  slices: {},
  rains: 0,
  _nextId: 1,
  _busy: false,

  isActive() {
    return typeof LevelAssets !== "undefined" && LevelAssets.current === "colinas_rockntroll";
  },

  resetAll() {
    this.list.forEach((d) => { d.el.remove(); if (d.markerEl) d.markerEl.remove(); if (d.badgeEl) d.badgeEl.remove(); });
    this.frags.forEach((f) => f.el.remove());
    this.list = [];
    this.frags = [];
    this.slices = {};
    this.rains = 0;
    this._busy = false;
    (typeof Teams !== "undefined" ? Teams.all : ["player", "enemy"]).forEach((t) => (this.slices[t] = 0));
    document.body.classList.remove("drums-raining");
  },

  at(row, col) {
    return this.list.find((d) => d.row === row && d.col === col) || null;
  },

  // ---------- Reparto ----------
  spawn(size) {
    if (!this.isActive()) return;
    const count = Math.max(3, Math.min(8, Math.round(size / 4)));
    let attempts = 0;
    while (this.list.length < count && attempts < 4000) {
      attempts++;
      const row = 2 + Math.floor(Math.random() * (size - 4));
      const col = 2 + Math.floor(Math.random() * (size - 4));
      if (!this._free(row, col, size)) continue;
      if (this.list.some((d) => Math.max(Math.abs(d.row - row), Math.abs(d.col - col)) < 4)) continue;
      if (typeof Obelisks !== "undefined" && Obelisks.list.some((o) => Math.max(Math.abs(o.row - row), Math.abs(o.col - col)) < 5)) continue;
      this._create(row, col);
    }
  },

  _free(row, col, size) {
    if (row < 0 || col < 0 || row >= size || col >= size) return false;
    if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) return false;
    if (typeof Units !== "undefined" && Units.unitAt(row, col)) return false;
    if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) return false;
    if (typeof Villages !== "undefined" && Villages.at(row, col)) return false;
    if (typeof Shops !== "undefined" && Shops.at(row, col)) return false;
    if (typeof Obelisks !== "undefined" && (Obelisks.at(row, col) || Obelisks.isAdjacent(row, col))) return false;
    if (typeof Altar !== "undefined" && Altar.at(row, col)) return false;
    if (this.at(row, col)) return false;
    // Todos sus vecinos transitables mínimos para poder rodearlo.
    let open = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if ((dr || dc) && (typeof TerrainMap === "undefined" || TerrainMap.isWalkable(row + dr, col + dc))) open++;
    }
    return open >= 6;
  },

  _create(row, col) {
    const el = document.createElement("div");
    el.className = "unit drum";
    const spriteEl = document.createElement("img");
    spriteEl.className = "drum__sprite";
    spriteEl.decoding = "async";
    spriteEl.alt = "";
    spriteEl.draggable = false;
    const src = DRUM_DIR + "tambor.png";
    if (typeof SpriteQuality !== "undefined") SpriteQuality.register(spriteEl, src);
    else spriteEl.src = src;
    spriteEl.style.animationDelay = `-${(Math.random() * 3).toFixed(2)}s`;
    el.appendChild(spriteEl);
    if (typeof Shadows !== "undefined") Shadows.attach(spriteEl);
    Units.container.appendChild(el);

    const { x, y } = getTileCenter(row, col, Units.boardSize);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.zIndex = String((row + col) * 10 + 5);

    const markerEl = document.createElement("div");
    markerEl.className = "drum-marker";
    markerEl.style.left = `${x}px`;
    markerEl.style.top = `${y - 238}px`;
    markerEl.style.zIndex = String((row + col) * 10 + 45);
    Units.container.appendChild(markerEl);

    // Placa con las veces que TU equipo ha hecho sonar este tambor.
    const badgeEl = document.createElement("div");
    badgeEl.className = "drum-plays";
    badgeEl.style.left = `${x}px`;
    badgeEl.style.top = `${y - 128}px`;
    badgeEl.style.zIndex = String((row + col) * 10 + 45);
    Units.container.appendChild(badgeEl);

    const drum = { id: `drum-${this._nextId++}`, row, col, el, spriteEl, markerEl, badgeEl, hits: {}, plays: {} };
    this.list.push(drum);
    return drum;
  },

  // ---------- Reglas ----------
  _unitsNear(row, col) {
    return Units.list.filter((u) => Math.max(Math.abs(u.row - row), Math.abs(u.col - col)) <= 1);
  },

  // Equipo con mayoría ESTRICTA de unidades adyacentes (o null).
  majority(drum) {
    const counts = {};
    this._unitsNear(drum.row, drum.col).forEach((u) => (counts[u.team] = (counts[u.team] || 0) + 1));
    let best = null, bestN = 0, tie = false;
    Object.keys(counts).forEach((t) => {
      if (counts[t] > bestN) { best = t; bestN = counts[t]; tie = false; }
      else if (counts[t] === bestN) tie = true;
    });
    return tie ? null : best;
  },

  pendingFor(team, drum) {
    return this.majority(drum) === team ? 1 + (drum.hits[team] || 0) : 0;
  },

  totalPending(team) {
    const n = this.list.reduce((a, d) => a + this.pendingFor(team, d), 0);
    return Math.min(n, DRUM_SLICES - (this.slices[team] || 0));
  },

  // Llamado desde Gnome.hit: cada golpe de una unidad adyacente a un tambor.
  onGnomeHit(unit) {
    if (!this.isActive()) return;
    this.list.forEach((d) => {
      if (Math.max(Math.abs(unit.row - d.row), Math.abs(unit.col - d.col)) > 1) return;
      d.hits[unit.team] = (d.hits[unit.team] || 0) + 1;
      d.plays[unit.team] = (d.plays[unit.team] || 0) + 1;
      this._shake(d);
    });
    this.refreshMarkers();
  },

  _shake(d, soft) {
    // Un solo sonido aunque tiemblen varios a la vez (sin solaparse).
    const t = performance.now();
    if (typeof SFX !== "undefined" && SFX.enabled && t - (this._lastSound || 0) > 450) {
      this._lastSound = t;
      try { SFX.drum(soft); } catch (e) {}
    }
    if (!d.spriteEl.animate) return;
    // Encoge hacia abajo y se estira hacia arriba, al ritmo del golpe.
    const k = soft ? 0.5 : 1;
    d.spriteEl.animate(
      [
        { scale: "1 1" },
        { scale: `${1 + 0.07 * k} ${1 - 0.1 * k}`, offset: 0.18 },
        { scale: `${1 - 0.04 * k} ${1 + 0.07 * k}`, offset: 0.45 },
        { scale: `${1 + 0.015 * k} ${1 - 0.02 * k}`, offset: 0.7 },
        { scale: "1 1" },
      ],
      { duration: soft ? 380 : 520, easing: "ease-out" }
    );
    this._wave(d, soft);
  },

  // Onda sutil que se expande por el suelo desde el tambor.
  _wave(d, soft) {
    const { x, y } = getTileCenter(d.row, d.col, Units.boardSize);
    const n = soft ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const w = document.createElement("div");
      w.className = "drum-wave";
      w.style.left = `${x}px`;
      w.style.top = `${y + 6}px`;
      w.style.zIndex = String((d.row + d.col) * 10 + 3);
      Units.container.appendChild(w);
      const a = w.animate(
        [
          { transform: "translate(-50%,-50%) scale(0.25, 0.125)", opacity: soft ? 0.5 : 0.75 },
          { transform: "translate(-50%,-50%) scale(1.5, 0.75)", opacity: 0 },
        ],
        { duration: 700, delay: i * 140, easing: "ease-out", fill: "backwards" }
      );
      a.onfinish = () => w.remove();
    }
  },

  // ---------- Fin de turno ----------
  async onTurnEnd(team) {
    if (!this.isActive() || !this.list.length) return;
    // 1) Porciones del turno
    let gained = 0;
    this.list.forEach((d) => {
      gained += this.pendingFor(team, d);
      d.hits[team] = 0;
    });
    this.list.forEach((d) => (d.hits[team] = 0));
    if (gained > 0) {
      this.slices[team] = Math.min(DRUM_SLICES, (this.slices[team] || 0) + gained);
      this.list.forEach((d) => { if (this.majority(d) === team) { d.plays[team] = (d.plays[team] || 0) + 1; this._shake(d); } });
    }
    this.refreshMarkers();
    // 2) ¿10/10?
    if (this.slices[team] >= DRUM_SLICES) {
      await this._flashFull(team);
      await this._rain([team], Teams.all.filter((t) => t !== team));
      return;
    }
    // 3) Pugna cada 10 turnos, al cerrar la ronda
    const alive = Teams.all.filter((t) => typeof Obelisks === "undefined" || Obelisks.byTeam(t));
    const last = alive[alive.length - 1];
    if (team === last && typeof Turns !== "undefined" && Turns.roundNumber % DRUM_DISPUTE_EVERY === 0) {
      const max = Math.max(...alive.map((t) => this.slices[t] || 0));
      if (max > 0) {
        const leaders = alive.filter((t) => (this.slices[t] || 0) === max);
        const victims = alive.filter((t) => !leaders.includes(t));
        if (victims.length) {
          if (typeof Banners !== "undefined") await Banners.text("¡Los tambores deciden!", 0).ended;
          await this._rain(leaders, victims);
        }
      }
    }
  },

  async _flashFull(team) {
    this.refreshMarkers(team === "player" ? "flash" : null);
    await new Promise((r) => setTimeout(r, team === "player" ? 700 : 250));
  },

  // ---------- Lluvia de rocas ----------
  async _rain(causers, victimTeams) {
    if (this._busy) return;
    this._busy = true;
    const dmg = DRUM_BASE_RAIN_DAMAGE + this.rains;
    document.body.classList.add("drums-raining");
    if (typeof Banners !== "undefined") Banners.text("¡Llueven rocas!", 0);
    await new Promise((r) => setTimeout(r, 900));

    const targets = [];
    Units.list.filter((u) => victimTeams.includes(u.team)).forEach((u) => targets.push({ kind: "unit", ref: u, row: u.row, col: u.col }));
    if (typeof Villages !== "undefined") Villages.list.filter((v) => victimTeams.includes(v.owner)).forEach((v) => targets.push({ kind: "village", ref: v, row: v.row, col: v.col }));
    if (typeof Obelisks !== "undefined") Obelisks.list.filter((o) => victimTeams.includes(o.team)).forEach((o) => targets.push({ kind: "obelisk", ref: o, row: o.row, col: o.col }));
    targets.sort(() => Math.random() - 0.5);

    const jobs = targets.map((t, i) => new Promise((resolve) => {
      setTimeout(() => this._dropRock(t, dmg, causers[0]).then(resolve, resolve), i * 230);
    }));
    await Promise.all(jobs);

    this.rains++;
    this.slices = {};
    Teams.all.forEach((t) => (this.slices[t] = 0));
    this.list.forEach((d) => (d.hits = {}));
    document.body.classList.remove("drums-raining");
    this.refreshMarkers();
    if (typeof Obelisks !== "undefined" && Obelisks.refreshAll) Obelisks.refreshAll();
    if (typeof Fog !== "undefined") Fog.applyVisibility();
    this._busy = false;
  },

  async _dropRock(t, dmg, causer) {
    const hidden = typeof Fog !== "undefined" && Fog.isFoggedReal(t.row, t.col);
    const { x, y } = getTileCenter(t.row, t.col, Units.boardSize);
    let rock = null;
    if (!hidden) {
      const s = 0.75 + Math.random() * 0.5;
      const flip = Math.random() < 0.5 ? -1 : 1;
      rock = document.createElement("img");
      rock.className = "drum-rock";
      rock.draggable = false;
      rock.alt = "";
      const src = DRUM_DIR + "roca_caida.png";
      if (typeof SpriteQuality !== "undefined") SpriteQuality.register(rock, src); else rock.src = src;
      rock.style.left = `${x}px`;
      rock.style.top = `${y + 18}px`;
      rock.style.zIndex = String((t.row + t.col) * 10 + 12);
      Units.container.appendChild(rock);
      const at = (off, rot) => `translate(-50%, ${off}) scale(${s * flip}, ${s}) rotate(${rot}deg)`;
      if (rock.animate) {
        await rock.animate(
          [{ transform: at("-1500px", 8), opacity: 1 }, { transform: at("-82%", 0), opacity: 1 }],
          { duration: 460, easing: "cubic-bezier(.55,0,.9,.55)", fill: "forwards" }
        ).finished.catch(() => {});
        rock.style.transform = at("-82%", 0);
      }
      this._impact(x, y, t);
    }
    this._applyDamage(t, dmg, causer);
    if (rock) {
      rock.animate && rock.animate(
        [{ opacity: 1, filter: "brightness(1)" }, { opacity: 1, filter: "brightness(1.6)", offset: 0.25 }, { opacity: 0, filter: "brightness(1)" }],
        { duration: 520, easing: "ease-out", fill: "forwards" }
      );
      this._fragments(t, hidden);
      setTimeout(() => rock.remove(), 560);
    } else {
      this._fragments(t, true);
    }
    await new Promise((r) => setTimeout(r, 380));
  },

  _impact(x, y, t) {
    if (typeof SFX !== "undefined" && SFX.enabled) { try { SFX.explosion(); } catch (e) {} }
    const vp = document.getElementById("board-viewport");
    if (vp) {
      vp.classList.remove("board-viewport--shake--big");
      void vp.offsetWidth;
      vp.classList.add("board-viewport--shake--big");
      setTimeout(() => vp.classList.remove("board-viewport--shake--big"), 420);
    }
    for (let i = 0; i < 6; i++) {
      const p = document.createElement("div");
      p.className = "drum-dust";
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      p.style.zIndex = String((t.row + t.col) * 10 + 13);
      Units.container.appendChild(p);
      const ang = (Math.PI * 2 * i) / 6 + Math.random() * 0.5;
      const dist = 40 + Math.random() * 40;
      p.animate(
        [{ transform: "translate(-50%,-50%) scale(.4)", opacity: 0.85 },
         { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist * 0.5}px)) scale(1.6)`, opacity: 0 }],
        { duration: 600, easing: "ease-out" }
      ).onfinish = () => p.remove();
    }
  },

  _applyDamage(t, dmg, causer) {
    const popupHost = t.ref;
    if (t.kind === "unit") {
      const u = t.ref;
      if (!u.el) return;
      if (typeof Skills !== "undefined" && Skills.resolveDamage) Skills.resolveDamage(u, dmg, { melee: false });
      else {
        u.hp = Math.max(0, u.hp - dmg);
        Units.updateHpBar(u);
        Units.spawnFloatingText(u, `-${dmg}`, { className: "dmg-popup" });
        Units.playShake(u);
      }
      if (u.hp <= 0) {
        Units.removeUnit(u).then(() => { if (typeof Gnome !== "undefined") Gnome.dropHeldBy(u); });
      }
      return;
    }
    const e = popupHost;
    e.hp = Math.max(0, e.hp - dmg);
    Units.updateHpBar(e);
    Units.spawnFloatingText(e, `-${dmg}`, { className: "dmg-popup" });
    Units.playShake(e);
    if (e.hp > 0) return;
    if (t.kind === "village" && typeof Villages !== "undefined") Villages._capture(e, causer, 1);
    if (t.kind === "obelisk" && typeof Obelisks !== "undefined") Obelisks._destroy(e);
  },

  // ---------- Fragmentos ----------
  _fragments(t, silent) {
    const size = Units.boardSize;
    const spots = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = t.row + dr, c = t.col + dc;
      if (r < 0 || c < 0 || r >= size || c >= size) continue;
      if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(r, c)) continue;
      if ((typeof Resources !== "undefined" && Resources.at(r, c)) || this.at(r, c)) continue;
      if (typeof Obelisks !== "undefined" && Obelisks.at(r, c)) continue;
      if (typeof Villages !== "undefined" && Villages.at(r, c)) continue;
      if (typeof Shops !== "undefined" && Shops.at(r, c)) continue;
      if (this.frags.some((f) => f.row === r && f.col === c)) continue;
      if (Units.unitAt(r, c)) continue;
      spots.push({ r, c });
    }
    spots.sort(() => Math.random() - 0.5);
    const n = Math.min(spots.length, 2 + Math.floor(Math.random() * 3)); // 2 a 4 por roca
    const from = getTileCenter(t.row, t.col, size);
    for (let i = 0; i < n; i++) {
      const { r, c } = spots[i];
      const to = getTileCenter(r, c, size);
      const el = document.createElement("img");
      el.className = "drum-frag";
      el.draggable = false;
      el.alt = "";
      const src = DRUM_DIR + "fragmento.png";
      if (typeof SpriteQuality !== "undefined") SpriteQuality.register(el, src); else el.src = src;
      const flip = Math.random() < 0.5 ? -1 : 1;
      const sc = 0.85 + Math.random() * 0.3;
      el.style.left = `${to.x}px`;
      el.style.top = `${to.y}px`;
      el.style.zIndex = String((r + c) * 10 + 4);
      el.style.setProperty("--frag-flip", String(flip * sc));
      el.style.setProperty("--frag-sc", String(sc));
      Units.container.appendChild(el);
      const dx = from.x - to.x, dy = from.y - to.y;
      const base = (px, py, rot, k) => `translate(calc(-50% + ${px}px), calc(-80% + ${py}px)) rotate(${rot}deg) scale(${flip * sc * k}, ${sc * k})`;
      if (el.animate) {
        el.animate(
          [
            { transform: base(dx, dy, 0, 0.5), opacity: 0 },
            { transform: base(dx * 0.45, dy * 0.45 - 130, 200 * flip, 1.15), opacity: 1, offset: 0.45 },
            { transform: base(0, 0, 360 * flip, 1), opacity: 1, offset: 0.78 },
            { transform: base(0, -26, 380 * flip, 1), opacity: 1, offset: 0.9 },
            { transform: base(0, 0, 360 * flip, 1), opacity: 1 },
          ],
          { duration: 760 + i * 90, easing: "ease-in-out" }
        );
      }
      const frag = { row: r, col: c, el };
      this.frags.push(frag);
      if (silent) el.classList.add("unit--fog-hidden");
    }
    if (typeof Fog !== "undefined") this.refreshFog();
  },

  // Llamado desde Units.walkPath en cada salto.
  onUnitStep(unit, row, col) {
    // Roce: una unidad que llega a una casilla junto a un tambor lo toca.
    const now = performance.now();
    this.list.forEach((d) => {
      if (Math.max(Math.abs(d.row - row), Math.abs(d.col - col)) !== 1) return;
      if (d.el.classList.contains("unit--fog-hidden") || now - (d._lastTouch || 0) < 700) return;
      d._lastTouch = now;
      this._shake(d, true);
    });
    if (!this.frags.length) return;
    const f = this.frags.find((x) => x.row === row && x.col === col);
    if (!f) return;
    if (unit.team !== "player") {
      // Cualquier bando puede recogerlos: el rival se los queda.
      this.frags = this.frags.filter((x) => x !== f);
      f.el.remove();
      const c = Resources.countsFor(unit.team);
      c.fragmento = (c.fragmento || 0) + 1;
      return;
    }
    if (typeof Backpack !== "undefined" && !(Resources.counts.fragmento > 0) && !Backpack.hasFreeSlot()) return; // mochila llena: se queda en el suelo
    this.frags = this.frags.filter((x) => x !== f);
    f.el.remove();
    Resources._spawnPickupAt(row, col, "fragmento", {
      iconUrl: DRUM_DIR + "fragmento.png",
      onArrive: () => Resources._collect("fragmento"),
    });
  },

  // ---------- Niebla ----------
  refreshFog() {
    if (typeof Fog === "undefined") return;
    this.list.forEach((d) => {
      const fogged = Fog.isFoggedReal(d.row, d.col);
      d.el.classList.toggle("unit--fog-hidden", fogged);
      d.el.classList.toggle("gg-remembered", !fogged && !Fog.isPerceived(d.row, d.col));
    });
    this.frags.forEach((f) => {
      const fogged = Fog.isFoggedReal(f.row, f.col);
      f.el.classList.toggle("unit--fog-hidden", fogged);
      // Explorado pero fuera de percepción: oscurecido como el resto del escenario.
      f.el.classList.toggle("gg-remembered", !fogged && !Fog.isPerceived(f.row, f.col));
    });
    this.refreshMarkers();
  },

  // ---------- Marcador ----------
  refreshMarkers(mode) {
    if (!this.list.length) return;
    const team = "player";
    const have = this.slices[team] || 0;
    const pending = this.totalPending(team);
    this.list.forEach((d) => {
      this._updateBadge(d);
      const near = this._unitsNear(d.row, d.col).some((u) => u.team === team);
      const fogged = typeof Fog !== "undefined" && Fog.isFoggedReal(d.row, d.col);
      const show = near && !fogged && !Obelisks.gameOver;
      d.markerEl.classList.toggle("drum-marker--visible", show);
      if (!show) return;
      const key = `${have}/${pending}/${mode || ""}`;
      if (d._markerKey === key) return;
      d._markerKey = key;
      d.markerEl.innerHTML = this._markerSvg(have, pending, DRUM_TEAM_COLORS[team], mode === "flash");
      if (mode === "flash") {
        d.markerEl.classList.remove("drum-marker--flash");
        void d.markerEl.offsetWidth;
        d.markerEl.classList.add("drum-marker--flash");
      }
    });
  },

  _updateBadge(d) {
    const n = d.plays.player || 0;
    const fogged = typeof Fog !== "undefined" && Fog.isFoggedReal(d.row, d.col);
    d.badgeEl.classList.toggle("drum-plays--visible", n > 0 && !fogged);
    if (d._badgeN === n) return;
    const grew = n > (d._badgeN || 0);
    d._badgeN = n;
    d.badgeEl.innerHTML = `<i class="ph-fill ph-music-notes"></i><span>×${n}</span>`;
    if (grew && d.badgeEl.animate) {
      d.badgeEl.animate(
        [{ scale: "1" }, { scale: "1.35" }, { scale: "1" }],
        { duration: 380, easing: "cubic-bezier(.34,1.6,.64,1)" }
      );
    }
  },

  _markerSvg(have, pending, color, full) {
    const cx = 70, cy = 70, rIn = 30, rOut = 52, gap = 0.07;
    const pt = (r, a) => `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
    let slices = "";
    for (let i = 0; i < DRUM_SLICES; i++) {
      const a0 = -Math.PI / 2 + (i / DRUM_SLICES) * Math.PI * 2 + gap;
      const a1 = -Math.PI / 2 + ((i + 1) / DRUM_SLICES) * Math.PI * 2 - gap;
      const jag = 1 + ((i * 37) % 5) * 0.025; // astilla irregular
      const rO = rOut * jag;
      const am = (a0 + a1) / 2;
      const d = `M${pt(rIn, a0)} L${pt(rO, a0)} L${pt(rO * 1.04, am)} L${pt(rO, a1)} L${pt(rIn, a1)} L${pt(rIn * 0.93, am)} Z`;
      let cls = "drum-slice";
      let fill = "#3b342d";
      if (i < have) { fill = full ? "#ffd23f" : color; cls += " drum-slice--on"; }
      else if (i < have + pending) { fill = "rgba(255,210,63,.18)"; cls += " drum-slice--ghost"; }
      slices += `<path class="${cls}" d="${d}" fill="${fill}"/>`;
    }
    const plate = Array.from({ length: 14 }, (_, k) => {
      const a = (k / 14) * Math.PI * 2;
      const r = 60 + ((k * 53) % 4) * 1.6;
      return pt(r, a);
    }).join(" ");
    return (
      `<svg viewBox="0 0 140 140" width="108" height="108" xmlns="http://www.w3.org/2000/svg">` +
      `<polygon class="drum-plate" points="${plate}"/>` +
      slices +
      `<text class="drum-count" x="70" y="79" text-anchor="middle">${have}/${DRUM_SLICES}</text>` +
      `</svg>` +
      (pending ? `<span class="drum-marker__tag">+${pending}</span>` : "")
    );
  },
};

if (typeof Turns !== "undefined") Turns.registerTurnStartListener(Drums);

/* Gnomore Gnomes — multijugador online 1 contra 1 (núcleo de red).

   Modelo: "lockstep" por comandos. Las DOS partidas ejecutan el mismo juego
   con la misma semilla aleatoria (js/rand.js). Cada acción de un jugador
   humano (mover, atacar, comprar...) se envía al otro, que la repite con la
   misma función que usaría la IA — por eso se ve TODO animado en ambos lados.
   Cada cliente se ve a sí mismo como "player" y al rival como "enemy"; el
   mundo es idéntico, solo cambia qué esquina/etiqueta es cada uno.

   Este archivo SOLO sabe: transporte (Firestore o BroadcastChannel para
   pruebas), cola de comandos, motor de turnos por asientos, referencias a
   entidades y comprobación de sincronía. Qué acciones se sincronizan vive en
   js/net-hooks.js; la sala/invitaciones en js/mp-lobby.js. */

const NET_PING_MS = 8000;
const NET_DEAD_MS = 40000;

// ---------- Transportes ----------
// Interfaz: send(obj), onmessage = fn(obj), close(). Los mensajes llevan
// {from, n, p} y la capa de Net los reordena por n (entrega fiable en orden).

function NetBroadcastTransport(room, me) {
  const ch = new BroadcastChannel("gg-mp-" + room);
  const t = {
    onmessage: null,
    onping: null,
    send(obj) { ch.postMessage(obj); },
    close() { try { ch.close(); } catch (e) {} },
  };
  ch.onmessage = (e) => {
    const m = e.data;
    if (!m || m.from === me) return;
    if (m.ping) { if (t.onping) t.onping(m); return; }
    if (t.onmessage) t.onmessage(m);
  };
  t.sendPing = () => ch.postMessage({ from: me, ping: Date.now() });
  return t;
}

function NetFirestoreTransport(db, room, me) {
  const col = db.collection("rooms").doc(room).collection("msgs");
  const t = { onmessage: null, onping: null, _unsub: null, _seen: {} };
  t.send = (obj) => {
    const id = obj.from + "_" + String(obj.n).padStart(7, "0");
    col.doc(id).set({ from: obj.from, n: obj.n, p: obj.p }).catch((e) => console.warn("[Net] envío", e));
  };
  t.sendPing = () => {
    col.doc("ping_" + me).set({ from: me, ping: Date.now() }).catch(() => {});
  };
  t._unsub = col.onSnapshot(
    (snap) => {
      const added = [];
      snap.docChanges().forEach((ch) => {
        if (ch.type === "removed") return;
        const d = ch.doc.data();
        if (!d || d.from === me) return;
        if (d.ping) { if (t.onping) t.onping(d); return; }
        if (t._seen[ch.doc.id]) return;
        t._seen[ch.doc.id] = 1;
        added.push(d);
      });
      added.sort((a, b) => a.n - b.n);
      added.forEach((d) => t.onmessage && t.onmessage(d));
    },
    (err) => console.warn("[Net] escucha", err)
  );
  t.close = () => { if (t._unsub) t._unsub(); t._unsub = null; };
  return t;
}

// ---------- Núcleo ----------
const Net = {
  active: false,
  ended: false,
  role: null, // "host" | "guest"
  seat: 0, // 0 = anfitrión (juega primero), 1 = invitado
  myTeam: "player",
  otherTeam: "enemy",
  names: { me: "", other: "" },
  seed: 1,
  roomId: null,
  levelId: null,
  _tp: null,
  _me: null,
  _nOut: 0,
  _nIn: 1,
  _stash: {},
  _queue: [],
  _pumping: false,
  _replaying: false,
  _busy: 0,
  _seqOut: 0,
  _lastRx: 0,
  _pingTimer: null,
  _deadTimer: null,
  _hooks: {},
  _hashes: {},
  _turnIx: 0,
  _log: [],
  onStatus: null, // (estado) => void  ("playing"|"lost-link"|"back"|"left"|"ended")

  // ---------- Equipos y asientos ----------
  teamOfSeat(seat) { return seat === this.seat ? this.myTeam : this.otherTeam; },
  seatOfTeam(team) { return team === this.myTeam ? this.seat : 1 - this.seat; },
  firstTeam() { return this.teamOfSeat(0); },
  // Etiqueta neutral de un equipo, igual en los dos clientes ("s0"/"s1").
  canon(team) { return Teams.all.includes(team) ? "s" + this.seatOfTeam(team) : String(team); },

  // ---------- Arranque / parada ----------
  begin(cfg) {
    this.end(true);
    this.active = true;
    this.ended = false;
    this.role = cfg.role;
    this.seat = cfg.role === "host" ? 0 : 1;
    this.myTeam = "player";
    this.otherTeam = "enemy";
    this.names = { me: cfg.myName || "", other: cfg.otherName || "" };
    this.seed = cfg.seed;
    this.roomId = cfg.roomId;
    this.levelId = cfg.levelId;
    this._me = cfg.me;
    this._tp = cfg.transport;
    this._nOut = 0;
    this._nIn = 1;
    this._stash = {};
    this._queue = [];
    this._pumping = false;
    this._replaying = false;
    this._busy = 0;
    this._seqOut = 0;
    this._hashes = {};
    this._turnIx = 0;
    this._log = [];
    this._lastRx = Date.now();
    this._lostLink = false;
    this._selfReady = false;
    this._peerReady = false;
    this._go = false;
    this._tp.onmessage = (m) => this._rx(m);
    this._tp.onping = () => { this._lastRx = Date.now(); this._checkBack(); };
    this._pingTimer = setInterval(() => { try { this._tp.sendPing(); } catch (e) {} }, NET_PING_MS);
    this._deadTimer = setInterval(() => this._checkDead(), 4000);
    try { this._tp.sendPing(); } catch (e) {}
  },

  // Cierra la sesión. `silent`: sin avisar al rival (arranque de otra).
  end(silent) {
    if (this._pingTimer) clearInterval(this._pingTimer);
    if (this._deadTimer) clearInterval(this._deadTimer);
    this._pingTimer = this._deadTimer = null;
    if (this._tp) {
      if (!silent && this.active && !this.ended) {
        try { this._send({ t: "bye" }); } catch (e) {}
      }
      const tp = this._tp;
      setTimeout(() => { try { tp.close(); } catch (e) {} }, 400);
    }
    this._tp = null;
    this.active = false;
    this.ended = true;
    this._queue = [];
    if (typeof GGRand !== "undefined") GGRand.disable();
  },

  // ---------- Mensajes ----------
  _send(obj) {
    if (!this._tp) return;
    const n = ++this._nOut;
    this._tp.send({ from: this._me, n, p: JSON.stringify(obj) });
  },

  _rx(m) {
    this._lastRx = Date.now();
    this._checkBack();
    if (m.n < this._nIn || this._stash[m.n]) return;
    this._stash[m.n] = m;
    while (this._stash[this._nIn]) {
      const cur = this._stash[this._nIn];
      delete this._stash[this._nIn];
      this._nIn++;
      let o;
      try { o = JSON.parse(cur.p); } catch (e) { continue; }
      this._dispatch(o);
    }
  },

  _dispatch(o) {
    if (!this.active) return;
    switch (o.t) {
      case "cmd":
      case "end":
        this._queue.push(o);
        this._pump();
        break;
      case "ready":
        if (!this._peerReady) {
          this._peerReady = true;
          this._peerLay = o.lay;
          this._send({ t: "ready", lay: this.layoutHash() });
          if (this._selfReady && o.lay !== this.layoutHash()) {
            console.error("[Net] MUNDO DISTINTO entre los dos clientes", o.lay, this.layoutHash());
            if (this.onStatus) this.onStatus("layout-mismatch");
          }
        }
        this._maybeGo();
        break;
      case "hash":
        this._onHash(o);
        break;
      case "resign":
      case "bye":
        this._onLeft(o.t);
        break;
      case "fix":
        this._onFix(o);
        break;
      default:
        break;
    }
  },

  async _pump() {
    if (this._pumping) return;
    this._pumping = true;
    try {
      while (this._queue.length && this.active) {
        const o = this._queue.shift();
        if (o.t === "end") await this._runTurnEnd(o.local ? this.seat : 1 - this.seat, true);
        else await this._replay(o);
      }
    } finally {
      this._pumping = false;
    }
  },

  async _replay(o) {
    const h = this._hooks[o.k];
    if (!h) { console.warn("[Net] comando desconocido", o.k); return; }
    this._replaying = true;
    try {
      GGRand.reseed(o.s);
      const r = h.dec(o.a);
      if (r) {
        if (Array.isArray(r)) await h.orig.apply(h.obj, r);
        else await r.o[h.name].apply(r.o, r.args);
      }
    } catch (e) {
      console.error("[Net] fallo al repetir", o.k, e);
    } finally {
      this._replaying = false;
    }
  },

  // ---------- Enganches de acciones ----------
  // hook(obj, "metodo", "id", enc, dec): enc(...args) -> JSON; dec(json) -> args
  // (o {o, args} para métodos de instancia; null si la entidad ya no existe).
  // Solo se envía lo que hace el jugador local en SU turno, y solo la llamada
  // más externa (las anidadas no).
  hook(obj, name, id, enc, dec) {
    if (!obj || typeof obj[name] !== "function") { console.warn("[Net] sin método", id); return; }
    if (this._hooks[id]) return;
    const orig = obj[name];
    this._hooks[id] = { obj, name, orig, dec };
    obj[name] = this._wrap(orig, id, enc);
  },

  // Para métodos que viven en cada instancia (gnomos): se registra una vez
  // y cada instancia nueva se envuelve con wrapInstance(inst).
  hookInstance(name, id, enc, dec) {
    this._hooks[id] = { obj: null, name, orig: null, dec, enc };
    this._instHooks = this._instHooks || [];
    this._instHooks.push(id);
  },

  wrapInstance(inst) {
    (this._instHooks || []).forEach((id) => {
      const rec = this._hooks[id];
      if (typeof inst[rec.name] !== "function") return;
      inst[rec.name] = this._wrap(inst[rec.name], id, rec.enc);
    });
  },

  _wrap(orig, id, enc) {
    return function (...args) {
      if (!Net.active || Net._replaying || Net._busy > 0 || Net.ended) return orig.apply(this, args);
      // Fuera de tu turno (o con el rival aún cargando) no se puede actuar.
      if (!Net._go || (typeof Turns !== "undefined" && Turns.activeTeam !== Net.myTeam)) return Net._blocked();
      let payload;
      try { payload = enc.apply(this, args); } catch (e) { console.warn("[Net] enc", id, e); return orig.apply(this, args); }
      const s = Net.seat + ":" + ++Net._seqOut;
      Net._send({ t: "cmd", k: id, a: payload, s });
      GGRand.reseed(s);
      Net._busy++;
      let r;
      try { r = orig.apply(this, args); } catch (e) { Net._busy--; throw e; }
      if (r && typeof r.then === "function") {
        return r.then(
          (v) => { Net._busy--; return v; },
          (e) => { Net._busy--; throw e; }
        );
      }
      Net._busy--;
      return r;
    };
  },

  _blocked() {
    return undefined;
  },

  // Un comando que no pasa por ninguna función existente (p. ej. fin de
  // turno): lo enviamos a mano.
  sendCmd(id, payload) {
    const s = this.seat + ":" + ++this._seqOut;
    this._send({ t: "cmd", k: id, a: payload, s });
    GGRand.reseed(s);
  },

  // ---------- Referencias a entidades (iguales en ambos clientes) ----------
  ref(o) {
    if (!o) return null;
    if (typeof o === "string") return o;
    if (o.typeId !== undefined && typeof o.id === "string") return o.id; // unidad
    if (typeof o.gid === "number") return "gnome:" + o.gid;
    if (typeof o.id === "string") return o.id; // tambor, tótem, tienda, recurso...
    if (typeof Obelisks !== "undefined" && Obelisks.list.indexOf(o) >= 0) return "obelisk:" + this.seatOfTeam(o.team);
    if (typeof Mushrooms !== "undefined" && Mushrooms.list.indexOf(o) >= 0) return "mush:" + o.id;
    if (typeof Altar !== "undefined" && Altar.list.indexOf(o) >= 0) return "altar";
    if (typeof Volcano !== "undefined" && Volcano.list.indexOf(o) >= 0) return "volcano";
    if (typeof GnomOgro !== "undefined" && GnomOgro.current === o) return "ogro";
    return null;
  },

  unref(r) {
    if (!r) return null;
    const find = (list) => (list || []).find((x) => x.id === r) || null;
    if (r.startsWith("unit-")) return find(Units.list);
    if (r.startsWith("drum-")) return find(Drums.list);
    if (r.startsWith("village-")) return find(Villages.list);
    if (r.startsWith("shop-")) return find(Shops.list);
    if (r.startsWith("resource-")) return find(Resources.list);
    if (r.startsWith("totemvision-")) return find(TotemVision.list);
    if (r.startsWith("bush-")) return find(Bushes.list);
    if (r.startsWith("gnome:")) return Gnome.list.find((g) => g.gid === Number(r.slice(6))) || null;
    if (r.startsWith("obelisk:")) return Obelisks.byTeam(this.teamOfSeat(Number(r.slice(8)))) || null;
    if (r.startsWith("mush:")) return Mushrooms.list.find((m) => m.id === Number(r.slice(5))) || null;
    if (r === "altar") return Altar.list[0] || null;
    if (r === "volcano") return Volcano.list[0] || null;
    if (r === "ogro") return GnomOgro.current || null;
    return null;
  },

  // Equipos en los comandos: se mandan como asiento (0/1), no como etiqueta.
  teamOut(team) { return team == null ? null : this.seatOfTeam(team); },
  teamIn(seat) { return seat == null ? null : this.teamOfSeat(seat); },

  // ---------- Motor de turnos (sustituye a Turns.endTurn en multijugador) ----------
  turnSeat: 0,

  // Inicio de partida: turno del asiento 0. El tablero queda bloqueado hasta
  // que los DOS clientes hayan terminado de construir la partida.
  startTurns() {
    this.turnSeat = 0;
    this._turnIx = 0;
    this._selfReady = true;
    this._announceReady();
    this._maybeGo();
  },

  _announceReady() {
    if (this._readyTimer) clearInterval(this._readyTimer);
    const send = () => { if (this.active && !this._go) this._send({ t: "ready", lay: this.layoutHash() }); else clearInterval(this._readyTimer); };
    send();
    this._readyTimer = setInterval(send, 1500);
  },

  _maybeGo() {
    if (this._go || !this._selfReady || !this._peerReady) return;
    this._go = true;
    if (this._readyTimer) clearInterval(this._readyTimer);
    Turns.activeTeam = this.teamOfSeat(0);
    Turns._aiRunning = this.seat !== 0;
    Turns._updateButtonState();
    if (this.onStatus) this.onStatus("go");
    if (this.seat === 0) setTimeout(() => this.showMyTurnBanner(), 300);
  },

  // Botón "Pasar turno" local.
  localEndTurn() {
    if (!this.active || this.ended || !this._go) return;
    if (Turns._aiRunning || Turns.activeTeam !== this.myTeam) return;
    if (typeof Obelisks !== "undefined" && Obelisks.gameOver) return;
    this._send({ t: "end" });
    Turns._aiRunning = true;
    Turns._updateButtonState();
    this._queue.push({ t: "end", local: true });
    return this._pump();
  },

  // Cierra el turno del asiento `seat` y abre el siguiente — se ejecuta igual
  // en los dos clientes (en el rival, al recibir "end").
  async _runTurnEnd(seat, remote) {
    const team = this.teamOfSeat(seat);
    this._replaying = true;
    this._turnBusy = true;
    try {
      Units.deselect();
      if (typeof Villages !== "undefined") Villages.deselect();
      if (typeof Abilities !== "undefined") Abilities.releaseMindControl();
      GGRand.reseed("te" + this._turnIx);
      Turns._aiRunning = true;
      Turns._updateButtonState();
      await Turns._fireTurnEnd(team);
      if (typeof Obelisks !== "undefined" && Obelisks.gameOver) return;
      if (typeof Gnome !== "undefined") Gnome.applyTurnPassDecay();
      this._turnIx++;
      const next = 1 - seat;
      this.turnSeat = next;
      const nextTeam = this.teamOfSeat(next);
      const newRound = next === 0;
      if (newRound) Turns.roundNumber++;
      Turns.activeTeam = nextTeam;
      Turns._resetTeamActions(nextTeam);
      GGRand.reseed("ts" + this._turnIx);
      if (typeof Glory !== "undefined") Glory.grantTurnStart(nextTeam);
      if (nextTeam === this.myTeam) this.showMyTurnBanner();
      else if (typeof Banners !== "undefined" && !Obelisks.gameOver) Banners.text(I18N.t("mp_turn_wait", { name: this.names.other }), 0, "red");
      Turns._aiRunning = true;
      Turns._updateButtonState();
      await Turns._fireTurnStart(nextTeam);
      if (typeof Obelisks !== "undefined" && Obelisks.gameOver) return;
      if (newRound) {
        Turns._turnEndListeners.forEach((l) => l.onRoundEnd && l.onRoundEnd());
        if (typeof Obelisks !== "undefined" && Obelisks.checkTurnLimit) Obelisks.checkTurnLimit(Turns.roundNumber);
      }
      await this._sendHash();
    } finally {
      this._replaying = false;
      this._turnBusy = false;
      Turns._aiRunning = Turns.activeTeam !== this.myTeam;
      Turns._updateButtonState();
    }
  },

  showMyTurnBanner() {
    if (typeof Turns !== "undefined" && Turns.showTurnBanner) Turns.showTurnBanner();
  },

  // ---------- Sincronía ----------
  // Estado canónico (sin etiquetas de equipo propias) para comparar.
  snapshot() {
    const c = (t) => this.canon(t);
    const s = {};
    s.u = Units.list
      .map((u) => [u.id, c(u.team), u.row, u.col, u.hp, u.typeId])
      .sort((a, b) => (a[0] < b[0] ? -1 : 1));
    s.g = Gnome.list.map((g) => [g.gid, g.row, g.col, g.points, g.heldBy || "", g.isDecoy ? 1 : 0]);
    s.v = Villages.list.map((v) => [v.id, c(v.owner), v.hp]);
    s.o = Obelisks.list.map((o) => [c(o.team), o.hp]).sort();
    s.gl = Teams.all.map((t) => [c(t), typeof Glory !== "undefined" ? Glory.points[t] : 0]).sort();
    s.r = Turns.roundNumber;
    // Economía y extras (para detectar desincronías raras).
    const byTeam = (f) => Teams.all.map((t) => [c(t), f(t)]).sort();
    s.sk = byTeam((t) => JSON.stringify(Skills.ranks[t] || {}));
    s.ar = byTeam((t) => JSON.stringify(Armory.state[t] || {}));
    s.rc = byTeam((t) => JSON.stringify(Resources.countsFor(t)));
    s.sh = Shops.list.map((x) => x.stock.map((e) => e.uid + e.itemId).join(","));
    s.mi = [Abilities._mines.length, Backpack.traps.length, TotemVision.list.length, Mushrooms.list.length];
    s.dr = byTeam((t) => (typeof Drums !== "undefined" && Drums.slices ? Drums.slices[t] || 0 : 0));
    s.fr = (Drums.frags || []).map((f) => f.row + "," + f.col).sort();
    s.dp = Drums.list.map((d) => d.row + "," + d.col);
    s.av = Units.list.map((u) => [u.id, u.abilityUsed ? 1 : 0, u.shielded ? 1 : 0, u.thorny ? 1 : 0]);
    return s;
  },

  // Huella del mundo recién generado (debe ser idéntica en los dos clientes).
  layoutHash() {
    const L = (arr, f) => (arr || []).map(f);
    const w = {
      o: Obelisks.list.map((o) => [this.canon(o.team), o.row, o.col]).sort(),
      v: L(Villages.list, (v) => [v.row, v.col]),
      s: L(Shops.list, (v) => [v.row, v.col]),
      r: L(Resources.list, (v) => [v.row, v.col]),
      d: L(Drums.list, (v) => [v.row, v.col]),
      b: L(Bushes.list, (v) => [v.row, v.col]),
      m: L(Mushrooms.list, (v) => [v.row, v.col]),
      a: L(Altar.list, (v) => [v.row, v.col]),
      vo: L(Volcano.list, (v) => [v.row, v.col]),
      sz: Units.boardSize,
    };
    return this.hashOf(w);
  },

  hashOf(obj) {
    const str = JSON.stringify(obj);
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return h >>> 0;
  },

  async _sendHash() {
    // Las animaciones de gnomos (huida, golpe...) acaban a ritmo distinto en cada ordenador: se espera a que paren.
    const t0 = Date.now();
    while (Gnome.list.some((g) => g.busy || g._hitting) && Date.now() - t0 < 4000) await new Promise((r) => setTimeout(r, 80));
    const snap = this.snapshot();
    const h = this.hashOf(snap);
    const ix = this._turnIx;
    this._hashes[ix] = { mine: h, snap };
    this._send({ t: "hash", ix, h, snap: ix % 1 === 0 ? snap : undefined });
    this._compare(ix);
  },

  _onHash(o) {
    const rec = this._hashes[o.ix] || (this._hashes[o.ix] = {});
    rec.theirs = o.h;
    rec.theirSnap = o.snap;
    this._compare(o.ix);
  },

  _compare(ix) {
    const rec = this._hashes[ix];
    if (!rec || rec.mine === undefined || rec.theirs === undefined || rec.done) return;
    rec.done = true;
    if (rec.mine === rec.theirs) return;
    // Desincronizado: se anota qué difiere y el ANFITRIÓN es la autoridad.
    const diff = this._diff(rec.snap, rec.theirSnap);
    console.warn("[Net] DESINCRONIZADO en turno", ix, diff);
    this._log.push({ ix, diff });
    this.desyncs = (this.desyncs || 0) + 1;
    if (this.role === "guest" && rec.theirSnap) {
      // El invitado corrige su estado con el del anfitrión.
      try { this._applyAuthority(rec.theirSnap); } catch (e) { console.error("[Net] corrección", e); }
    }
  },

  _diff(a, b) {
    const out = [];
    if (!a || !b) return ["sin detalle"];
    Object.keys(a).forEach((k) => {
      if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push(k + ": " + JSON.stringify(a[k]).slice(0, 160) + " <> " + JSON.stringify(b[k]).slice(0, 160));
    });
    return out;
  },

  // Corrección mínima con el estado del anfitrión (posiciones/vida/propietarios).
  _applyAuthority(snap) {
    // Las etiquetas "s0"/"s1" se traducen a mi equipo.
    const team = (c) => this.teamOfSeat(Number(String(c).slice(1)));
    snap.u.forEach((r) => {
      const u = Units.list.find((x) => x.id === r[0]);
      if (!u) return;
      if (u.hp !== r[4]) { u.hp = r[4]; Units.updateHpBar && Units.updateHpBar(u); }
      if (u.row !== r[2] || u.col !== r[3]) {
        u.row = r[2]; u.col = r[3];
        if (Units._placeInstant) Units._placeInstant(u);
      }
    });
    (snap.g || []).forEach((r) => {
      const g = Gnome.list.find((x) => x.gid === r[0]);
      if (g && g.points !== r[3]) { g.points = r[3]; if (g._applyNervousness) g._applyNervousness(); }
    });
    snap.v.forEach((r) => {
      const v = Villages.list.find((x) => x.id === r[0]);
      if (v) { v.hp = r[2]; }
    });
    snap.o.forEach((r) => {
      const o = Obelisks.byTeam(team(r[0]));
      if (o) o.hp = r[1];
    });
    snap.gl.forEach((r) => {
      if (typeof Glory !== "undefined") { Glory.points[team(r[0])] = r[1]; Glory._render(team(r[0])); }
    });
  },

  _onFix() {},

  // ---------- Conexión ----------
  _checkDead() {
    if (!this.active || this.ended) return;
    if (Date.now() - this._lastRx > NET_DEAD_MS && !this._lostLink) {
      this._lostLink = true;
      if (this.onStatus) this.onStatus("lost-link");
    }
  },

  _checkBack() {
    if (this._lostLink) {
      this._lostLink = false;
      if (this.onStatus) this.onStatus("back");
    }
  },

  _onLeft(kind) {
    if (this.ended) return;
    this.ended = true;
    if (this.onStatus) this.onStatus(kind === "resign" ? "left" : "left-bye");
  },

  // El jugador local abandona (se pierde la partida).
  resign() {
    if (!this.active || this.ended) return;
    try { this._send({ t: "resign" }); } catch (e) {}
    this.ended = true;
  },
};

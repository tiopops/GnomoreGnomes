/* Gnomore Gnomes — multijugador: qué acciones del jugador se sincronizan.

   Cada hook envuelve una función "de entrada" que llama el jugador humano
   (o la IA) y define cómo se codifica a JSON (referencias a entidades por id,
   equipos como asiento) y cómo se decodifica en el otro cliente. Ver
   js/net.js para el mecanismo. Se instalan UNA vez al cargar el juego; si no
   hay partida online activa, los envoltorios no hacen nada. */

(function () {
  if (typeof Net === "undefined") return;
  const R = (o) => Net.ref(o);
  const U = (r) => Net.unref(r);
  const alive = (...xs) => xs.every((x) => x);

  // ---------- Movimiento y combate ----------
  Net.hook(Movement, "moveTo", "move",
    (unit, r, c) => ({ u: R(unit), r, c }),
    (a) => { const u = U(a.u); return u ? [u, a.r, a.c] : null; });

  Net.hook(Combat, "approachAndAttack", "atk",
    (unit, target) => ({ u: R(unit), t: R(target) }),
    (a) => { const u = U(a.u), t = U(a.t); return alive(u, t) ? [u, t] : null; });

  // ---------- Acciones "unidad + objetivo" (acercarse y actuar) ----------
  const UT = (obj, name, id) =>
    Net.hook(obj, name, id,
      (unit, target) => ({ u: R(unit), t: R(target) }),
      (a) => { const u = U(a.u), t = U(a.t); return alive(u, t) ? [u, t] : null; });
  UT(Villages, "approachAndAttack", "vil");
  UT(Obelisks, "approachAndAttack", "obl");
  UT(Resources, "approachAndAttack", "res");
  UT(TotemVision, "approachAndAttack", "tvis");
  UT(GnomOgro, "approachAndAttack", "ogro");
  UT(Altar, "approachAndSacrifice", "alt");
  UT(Volcano, "approachAndSmash", "vsm");
  UT(Mushrooms, "catchBy", "mush");
  Net.hook(Volcano, "throwGnome", "vthrow",
    (unit, gnome, v) => ({ u: R(unit), g: R(gnome), v: R(v) }),
    (a) => { const u = U(a.u), g = U(a.g), v = U(a.v); return alive(u, g, v) ? [u, g, v] : null; });

  // ---------- Gnomos (métodos de cada instancia) ----------
  Net.hookInstance("catchBy", "g.catch",
    function (unit) { return { g: R(this), u: R(unit) }; },
    (a) => { const g = U(a.g), u = U(a.u); return alive(g, u) ? { o: g, args: [u] } : null; });
  Net.hookInstance("hit", "g.hit",
    function (unit) { return { g: R(this), u: R(unit) }; },
    (a) => { const g = U(a.g), u = U(a.u); return alive(g, u) ? { o: g, args: [u] } : null; });
  Net.hookInstance("executePass", "g.pass",
    function (holder, target) { return { g: R(this), u: R(holder), t: R(target) }; },
    (a) => { const g = U(a.g), u = U(a.u), t = U(a.t); return alive(g, u, t) ? { o: g, args: [u, t] } : null; });
  Net.hookInstance("executeThrowToTile", "g.throw",
    function (holder, r, c) { return { g: R(this), u: R(holder), r, c }; },
    (a) => { const g = U(a.g), u = U(a.u); return alive(g, u) ? { o: g, args: [u, a.r, a.c] } : null; });

  // ---------- Economía: tienda, armería, habilidades ----------
  // Ir a la tienda: el rival solo anda hasta ella (sin abrirle el popup a nadie).
  Net.hook(Shops, "approachAndOpen", "shop.go",
    (unit, shop) => ({ u: R(unit), s: R(shop) }),
    (a) => { const u = U(a.u), s = U(a.s); return alive(u, s) ? [u, s] : null; });
  const _openPopup = Shops.openPopup;
  Shops.openPopup = function (...args) {
    if (Net.active && Net._replaying) return;
    return _openPopup.apply(this, args);
  };
  Net.hook(Shops, "purchase", "shop.buy",
    (team, shop, uid) => ({ s: R(shop), uid }),
    (a) => { const s = U(a.s); return s ? [Net.otherTeam, s, a.uid] : null; });
  Net.hook(Armory, "upgrade", "armory",
    (team, kind, lvl) => ({ k: kind, l: lvl }),
    (a) => [Net.otherTeam, a.k, a.l]);
  Net.hook(Skills, "buy", "skill",
    (team, id) => ({ id }),
    (a) => [Net.otherTeam, a.id]);

  // ---------- Habilidades especiales ----------
  Net.hook(Abilities, "_activateThorns", "ab.thorns",
    (unit) => ({ u: R(unit) }),
    (a) => { const u = U(a.u); return u ? [u] : null; });
  Net.hook(Abilities, "_castVision", "ab.vision",
    (unit, r, c) => ({ u: R(unit), r, c }),
    (a) => { const u = U(a.u); return u ? [u, a.r, a.c] : null; });
  Net.hook(Abilities, "_resolveMinePlacement", "ab.mine",
    (unit, r, c) => ({ u: R(unit), r, c }),
    (a) => { const u = U(a.u); return u ? [u, a.r, a.c] : null; });
  Net.hook(Abilities, "_resolveMindControl", "ab.mind",
    (unit, t) => ({ u: R(unit), t: R(t) }),
    (a) => { const u = U(a.u), t = U(a.t); return alive(u, t) ? [u, t] : null; });
  Net.hook(Abilities, "_resolveKnockback", "ab.punch",
    (unit, t) => ({ u: R(unit), t: R(t) }),
    (a) => { const u = U(a.u), t = U(a.t); return alive(u, t) ? [u, t] : null; });
  Net.hook(Abilities, "_resolveThrow", "ab.throw",
    (g, t, r, c) => ({ g: R(g), t: R(t), r, c }),
    (a) => { const g = U(a.g), t = U(a.t); return alive(g, t) ? [g, t, a.r, a.c] : null; });

  // ---------- Objetos de la mochila (el rival no tiene tu mochila: solo repite el efecto) ----------
  const placeHook = (name, id, withTeam) =>
    Net.hook(Backpack, name, id,
      (uid, r, c) => ({ r, c }),
      (a) => (withTeam ? [null, a.r, a.c, Net.otherTeam] : [null, a.r, a.c]));
  placeHook("_placeSetarcoirisAt", "it.rainbow", false);
  placeHook("_placeAtrapaPinrelesAt", "it.trap", true);
  placeHook("_placeTotemVisionAt", "it.tvis", true);
  placeHook("_placeSenueloAt", "it.decoy", true);
  Net.hook(Backpack, "_giveBevidaTo", "it.bevida",
    (uid, t) => ({ t: R(t) }),
    (a) => { const t = U(a.t); return t ? [null, t] : null; });
  Net.hook(Backpack, "_repairTotemWith", "it.repair",
    (uid, v) => ({ t: R(v) }),
    (a) => { const v = U(a.t); return v ? [null, v] : null; });
  Net.hook(Backpack, "_launchKatapum", "it.kata",
    (uid, t) => ({ t: R(t) }),
    (a) => { const t = U(a.t); return t ? [null, t, Net.otherTeam] : null; });
  Net.hook(Backpack, "_launchRock", "it.rock",
    (t) => ({ k: t.kind, r: t.row, c: t.col, u: t.kind === "firegnome" ? R(t.ref) : null }),
    (a) => {
      let ref = null;
      if (a.k === "volcano") ref = Volcano.current();
      else if (a.k === "lava") ref = Volcano.lava.find((l) => l.row === a.r && l.col === a.c);
      else if (a.k === "firegnome") ref = U(a.u);
      return ref ? [{ kind: a.k, ref, row: a.r, col: a.c, el: ref.el || null }, Net.otherTeam] : null;
    });

  // ---------- Reclutar ----------
  Net.hook(Obelisks, "_spawnRecruit", "recruit",
    (row, col) => ({ t: Obelisks._pendingRecruit.typeId, r: row, c: col }),
    (a) => {
      const obelisk = Obelisks.byTeam(Net.otherTeam);
      if (!obelisk) return null;
      Obelisks._pendingRecruit = { obelisk, typeId: a.t, price: Units.recruitPriceFor(a.t) };
      return [a.r, a.c];
    });
})();

// ---------- Arranque de una partida online ----------
// cfg: { role, seed, roomId, levelId, myRace, otherRace, me, myName, otherName, transport }
Net.launch = async function (cfg) {
  Net.begin(cfg);
  await startMatch({
    modeId: "quick",
    raceId: cfg.myRace,
    levelId: cfg.levelId,
    opponents: 1,
    mp: { otherRace: cfg.otherRace },
  });
};

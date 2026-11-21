// ============================================================
// CampaignIntro — escena "La Guerra Eterna" del modo campaña.
//
// Se pinta sobre un tablero real de losetas (mismas losetas, mismo encaje
// isométrico y mismos sprites de unidad que la partida: getTileCenter de
// js/mapgen.js es la única fuente de verdad de posiciones) mientras Nizak
// narra. La cámara recorre el campo con un scroll suave; las razas se
// enfrentan, caen rocas, hay sangre... hasta que llega la plaga de gnomos.
//
// Todo son colores planos y sombras duras (sin desenfoques ni brillos) y toda
// la coreografía va con la Web Animations API (una animación por elemento y
// propiedad, sin mezclar keyframes con transiciones). Este archivo solo sabe
// pintar la escena: Campaign le pasa textos y recibe una promesa al terminar.
// ============================================================
const CampaignIntro = (() => {
  const S = 11; // tablero 11x11: anillo de agua + 9x9 de hierba
  const IMG = {
    grass: "assets/losetas/hierba_01_midres.png",
    water: ["assets/losetas/agua_02_midres.png", "assets/losetas/agua_03_midres.png"],
    blood: [1, 2, 3].map((i) => `assets/decals/efecto_sangre_0${i}_midres.png`),
    rock: "assets/iconos/recurso_roca_nodo_midres.png",
    gnome: "assets/equipos/MushboomForest/gnomo_corre_midres.png",
    nizak: "assets/tutorial/nizak_grunon.png",
  };
  // Duelos: A (izquierda) en (r,c), B (derecha) en (r-1,c+1) — misma fila de pantalla.
  const SPOTS = [[6, 3], [3, 5], [5, 6], [7, 5], [4, 2]];
  const KINDS = ["launch", "rock", "rock2", "launch", "rock"];
  const PAIRS = [["mushboom_forest", "equipo_surcanubes"], ["colinas_rockntroll", "equipo_enmurallado"],
    ["equipo_surcanubes", "mushboom_forest"], ["equipo_enmurallado", "colinas_rockntroll"], ["mushboom_forest", "colinas_rockntroll"]];

  const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const mk = (tag, cls, css) => { const e = document.createElement(tag); if (cls) e.className = cls; if (css) e.style.cssText = css; return e; };
  const A = (el, kf, t, d, ease = "linear") =>
    el.animate(kf, { delay: Math.max(0, Math.round(t * 1000)), duration: Math.max(1, Math.round(d * 1000)), easing: ease, fill: "forwards" });
  const BASE = "translate(-50%,-92%)";
  const T = (x = 0, y = 0, rot = 0) => `${BASE} translate(${x}px,${y}px) rotate(${rot}deg)`;
  const sfx = (name) => { try { if (typeof SFX !== "undefined" && SFX[name]) SFX[name](); } catch (e) {} };

  function preload(urls) {
    return Promise.all(urls.map((u) => new Promise((ok) => {
      const i = new Image(); i.onload = i.onerror = () => ok(); i.src = u; if (i.decode) i.decode().then(ok, ok);
    }))).then(() => {});
  }

  function play(cfg) {
    const rand = rng(cfg.seed || 7);
    const sprites = (race) => Object.keys(UNIT_TYPES).filter((k) => UNIT_TYPES[k].raceId === race);
    const pickType = (race, i) => { const l = sprites(race); return l[i % l.length]; };
    const lines = cfg.lines;
    const total = lines.length * cfg.per + 3;
    const tg = lines.length >= 3 ? (lines.length - 2) * cfg.per + 0.5 : 3; // llegada de los gnomos
    const nDuels = Math.max(1, Math.min(5, Math.floor((tg - 0.5) / 2.6)));
    const duels = Array.from({ length: nDuels }, (_, i) => {
      const pr = PAIRS[i];
      return { i, r: SPOTS[i][0], c: SPOTS[i][1], t0: 0.6 + i * 2.6, kind: KINDS[i], loserIsA: i % 2 === 0,
        a: pickType(pr[0], i), b: pickType(pr[1], i + 1) };
    });
    const urls = [IMG.grass, ...IMG.water, ...IMG.blood, IMG.rock, IMG.gnome, IMG.nizak,
      ...duels.flatMap((d) => [UNIT_TYPES[d.a].spriteUrl, UNIT_TYPES[d.b].spriteUrl])];

    return preload(urls).then(() => new Promise((resolve) => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const k = Math.max(0.55, Math.min(1, vw / 1180));
      const ov = mk("div", "war");
      ov.innerHTML = `<div class="war__view"><div class="war__shake"><div class="war__world"></div></div></div>
        <div class="war__dusk"></div>
        <svg class="war__rainbow" viewBox="0 0 100 52" preserveAspectRatio="none">${["#e0262a", "#ff9a1f", "#ffd23f", "#7be07b", "#5ad1ff", "#a96bff"]
          .map((c, i) => { const r = 48 - i * 3.4; return `<path d="M ${50 - r} 51 A ${r} ${r} 0 0 1 ${50 + r} 51" fill="none" stroke="${c}" stroke-width="3.5"/>`; }).join("")}</svg>
        <div class="war__fx"></div>
        <div class="war__title">${cfg.title}</div>
        <button type="button" class="war__skip">${cfg.skip}</button>
        <div class="war__nz"><img class="war__nizak" src="${IMG.nizak}" alt="">
          <div class="war__box"><div class="war__name">${cfg.nizak}</div><div class="war__text"></div>
          <button type="button" class="war__go">${cfg.start}</button></div></div>`;
      const world = ov.querySelector(".war__world"), shake = ov.querySelector(".war__shake");
      const fx = ov.querySelector(".war__fx");
      const W = (S - 1) * TILE_WIDTH / 2 * 2 + TILE_WIDTH, H = (S - 1) * TILE_TOP_HEIGHT + TILE_RENDER_HEIGHT;
      world.style.width = W + "px"; world.style.height = H + "px";

      // ---- Terreno: losetas reales (anillo de agua + hierba) ----
      const cells = [];
      for (let r = 0; r < S; r++) for (let c = 0; c < S; c++) cells.push([r, c]);
      cells.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]) || a[0] - b[0]);
      cells.forEach(([r, c]) => {
        const p = getTileTopLeft(r, c, S);
        const edge = r === 0 || c === 0 || r === S - 1 || c === S - 1;
        const im = mk("img", "war__tile", `left:${p.x}px;top:${p.y}px;width:${TILE_WIDTH}px;height:${TILE_RENDER_HEIGHT}px`);
        im.src = edge ? IMG.water[(r + c) % 2] : IMG.grass; im.alt = ""; im.draggable = false;
        world.appendChild(im);
      });
      const at = (r, c) => getTileCenter(r, c, S);
      const put = (el, p, extra = "") => { el.style.left = p.x + "px"; el.style.top = p.y + "px"; if (extra) el.style.cssText += extra; return el; };

      // ---- Efectos planos ----
      const dust = (p, t, n = 6, big = 1) => {
        for (let i = 0; i < n; i++) {
          const e = mk("i", "war__dust"); put(e, p, `z-index:90;width:${rand() * 22 + 26}px;height:${rand() * 22 + 26}px;opacity:0`); world.appendChild(e);
          const dx = (rand() - 0.5) * 180 * big, dy = -rand() * 70 - 20;
          A(e, [{ opacity: 0.85, transform: "translate(-50%,-50%) scale(.4)" }, { opacity: 0, transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(${1.6 + rand()})` }], t, 0.7 + rand() * 0.3, "ease-out");
        }
      };
      const ring = (p, t) => {
        const e = mk("i", "war__ring"); put(e, p, "z-index:4;opacity:0"); world.appendChild(e);
        A(e, [{ opacity: 0.9, transform: "translate(-50%,-50%) scale(.2)" }, { opacity: 0, transform: "translate(-50%,-50%) scale(2.6)" }], t, 0.55, "ease-out");
      };
      const spark = (p, t) => {
        const e = mk("i", "war__spark"); put(e, { x: p.x, y: p.y - 70 }, "z-index:95;opacity:0"); world.appendChild(e);
        A(e, [{ opacity: 1, transform: "translate(-50%,-50%) scale(.2) rotate(0deg)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1.4) rotate(40deg)", offset: 0.4 }, { opacity: 0, transform: "translate(-50%,-50%) scale(.1) rotate(80deg)" }], t, 0.3, "ease-out");
      };
      const blood = (p, t, n = 9, up = 1) => {
        for (let i = 0; i < n; i++) {
          const s = rand() * 8 + 7, e = mk("i", "war__drop", `width:${s}px;height:${s}px;opacity:0`); put(e, { x: p.x, y: p.y - 70 }, "z-index:92"); world.appendChild(e);
          const dx = (rand() - 0.5) * 240, peak = -(rand() * 90 + 50) * up, land = rand() * 70 + 40;
          A(e, [{ opacity: 1, transform: "translate(-50%,-50%)" }, { opacity: 1, transform: `translate(calc(-50% + ${dx * 0.5}px),calc(-50% + ${peak}px))`, offset: 0.45, easing: "ease-in" }, { opacity: 1, transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${land}px))` }], t, 0.7 + rand() * 0.2, "ease-out");
        }
      };
      const decal = (p, t, size = 200, i = 0) => {
        const e = mk("img", "war__decal", `width:${size}px;opacity:0`); e.src = IMG.blood[i % 3]; e.alt = ""; put(e, p); world.appendChild(e);
        A(e, [{ opacity: 0, transform: "translate(-50%,-50%) scale(.3)" }, { opacity: 0.95, transform: "translate(-50%,-50%) scale(1)" }], t, 0.35, "cubic-bezier(.2,.9,.3,1)");
      };
      const chips = (p, t, n = 7) => {
        for (let i = 0; i < n; i++) {
          const s = rand() * 10 + 12, e = mk("i", "war__chip", `width:${s}px;height:${s}px;background:${["#7b6f64", "#5d544c", "#948779"][i % 3]};opacity:0`); put(e, { x: p.x, y: p.y - 30 }, "z-index:93"); world.appendChild(e);
          const dx = (rand() - 0.5) * 260, g = rand() * 40;
          const f = (x, y, o = 1, rot = 0) => ({ opacity: o, transform: `translate(calc(-50% + ${dx * x}px),calc(-50% + ${y}px)) rotate(${rot}deg)` });
          A(e, [{ ...f(0, 0), offset: 0 }, { ...f(0.35, -130 - rand() * 50, 1, 160), offset: 0.2, easing: "ease-in" }, { ...f(0.6, g), offset: 0.45, easing: "ease-out" }, { ...f(0.8, g - 38, 1, 300), offset: 0.65, easing: "ease-in" }, { ...f(0.95, g), offset: 0.85 }, { ...f(1, g, 0, 320) }], t, 1.6, "linear");
        }
      };
      const quake = (t, big = 1) => {
        const a = 9 * big;
        A(shake, [{ transform: "translate(0,0)" }, { transform: `translate(${a}px,${-a}px)`, offset: 0.15 }, { transform: `translate(${-a}px,${a * 0.7}px)`, offset: 0.35 }, { transform: `translate(${a * 0.6}px,${a * 0.4}px)`, offset: 0.55 }, { transform: `translate(${-a * 0.3}px,0)`, offset: 0.8 }, { transform: "translate(0,0)" }], t, 0.4, "ease-out");
      };

      // ---- Unidades (mismos sprites y tamaños que la partida) ----
      const mkUnit = (typeId, r, c, right, z) => {
        const def = UNIT_TYPES[typeId], p = at(r, c);
        const sc = typeof SPRITE_SCALES !== "undefined" ? (SPRITE_SCALES[typeId] ?? SPRITE_SCALES.default ?? 1) : 1;
        const flip = ((def.defaultFacing || "right") === "right") === right ? 1 : -1;
        const w = mk("div", "war__u", `left:${p.x}px;top:${p.y}px;z-index:${z};opacity:0;transform:${BASE}`);
        w.innerHTML = `<div class="war__flip" style="transform:scaleX(${flip})"><img class="war__sp" style="width:${120 * sc}px" src="${def.spriteUrl}" alt="" draggable="false"></div>`;
        const sh = mk("i", "war__sh", `left:${p.x}px;top:${p.y}px;width:${78 * sc}px;opacity:0;z-index:3`);
        world.appendChild(sh); world.appendChild(w);
        return { w, sp: w.querySelector(".war__sp"), sh, p, r, c, z, dir: right ? 1 : -1 };
      };
      const walk = (u, dx, t, d) => {
        A(u.w, [{ opacity: 1, transform: T(dx, 0) }, { opacity: 1, transform: T(0, 0) }], t, d, "cubic-bezier(.2,.7,.3,1)");
        A(u.sh, [{ opacity: 0.38, transform: `translate(calc(-50% + ${dx}px),-50%)` }, { opacity: 0.38, transform: "translate(-50%,-50%)" }], t, d, "cubic-bezier(.2,.7,.3,1)");
      };
      const bobs = (u, t, n) => { for (let j = 0; j < n; j++) A(u.sp, [{ transform: "translateY(0) scale(1,1)" }, { transform: "translateY(-16px) scale(1.05,.95)", offset: 0.5 }, { transform: "translateY(0) scale(1,1)" }], t + j * 0.2, 0.2, "ease-out"); };
      const lunge = (u, t, far = 30) => A(u.sp, [{ transform: "translateX(0) scale(1,1)" }, { transform: `translateX(${far}px) scale(1.1,.92)`, offset: 0.4 }, { transform: "translateX(0) scale(1,1)" }], t, 0.24, "ease-out");
      const hop = (u, t) => A(u.sp, [{ transform: "translateY(0) scale(1,1)" }, { transform: "translateY(-34px) scale(.94,1.08)", offset: 0.45 }, { transform: "translateY(0) scale(1.06,.94)", offset: 0.85 }, { transform: "translateY(0) scale(1,1)" }], t, 0.45, "ease-out");
      const flatten = (u, t, w = 1.7) => { A(u.sp, [{ transform: "scale(1,1)" }, { transform: `scale(${w},.08)` }], t, 0.1, "ease-in"); A(u.sh, [{ opacity: 0.38 }, { opacity: 0 }], t, 0.1); };

      const rockHit = (u, t) => { // cae una roca sobre la unidad u, aterriza en t
        const sh = mk("i", "war__rs", `opacity:0;z-index:3`); put(sh, u.p); world.appendChild(sh);
        A(sh, [{ opacity: 0.1, transform: "translate(-50%,-50%) scale(.2)" }, { opacity: 0.5, transform: "translate(-50%,-50%) scale(1)" }], t - 0.9, 0.9, "ease-in");
        const rk = mk("img", "war__rock", `opacity:0;z-index:${u.z + 2}`); rk.src = IMG.rock; rk.alt = ""; put(rk, u.p); world.appendChild(rk);
        A(rk, [{ opacity: 1, transform: `${BASE} translateY(-1100px) rotate(-30deg)` }, { opacity: 1, transform: `${BASE} translateY(0) rotate(0deg)` }], t - 0.9, 0.9, "cubic-bezier(.5,0,1,.6)");
        A(rk, [{ transform: `${BASE} translateY(0) scale(1,1)` }, { transform: `${BASE} translateY(0) scale(1.08,.9)`, offset: 0.4 }, { transform: `${BASE} translateY(0) scale(1,1)` }], t, 0.25, "ease-out");
        flatten(u, t);
        decal(u.p, t, 230, Math.floor(rand() * 3));
        blood(u.p, t, 7, 0.8); dust(u.p, t, 6, 1.2); ring(u.p, t); chips(u.p, t); quake(t, 1);
        setTimers.push([t, () => sfx("death")]);
      };

      const setTimers = [];
      const survivors = [];
      const camPts = [];
      duels.forEach((d) => {
        const a = mkUnit(d.a, d.r, d.c, true, 20 + (d.r + d.c) * 3);
        const b = mkUnit(d.b, d.r - 1, d.c + 1, false, 20 + (d.r + d.c) * 3 + 1);
        const L = d.loserIsA ? a : b, Wn = d.loserIsA ? b : a;
        const mid = { x: (a.p.x + b.p.x) / 2, y: a.p.y };
        const t0 = d.t0;
        walk(a, -300, t0, 1.0); walk(b, 300, t0, 1.0);
        bobs(a, t0, 5); bobs(b, t0 + 0.1, 5);
        // choque 1
        lunge(a, t0 + 1.1); lunge(b, t0 + 1.1); spark(mid, t0 + 1.15); dust(mid, t0 + 1.2, 3, 0.6); setTimers.push([t0 + 1.15, () => sfx("hit")]);
        // choque 2: el ganador remata
        lunge(Wn, t0 + 1.65, 46);
        A(L.sp, [{ transform: "translateX(0) rotate(0deg)" }, { transform: "translateX(-16px) rotate(-8deg)", offset: 0.4 }, { transform: "translateX(0) rotate(0deg)" }], t0 + 1.7, 0.3, "ease-out");
        spark(mid, t0 + 1.75); setTimers.push([t0 + 1.75, () => sfx("hit")]);
        const tk = t0 + 2.2;
        camPts.push({ t: t0 + 1.4, x: mid.x, y: mid.y });
        if (d.kind === "launch") {
          const dx = L.dir * -1; // sale despedido hacia su lado
          const dirx = d.loserIsA ? -1 : 1;
          A(L.w, [{ opacity: 1, transform: T(0, 0, 0), offset: 0 }, { opacity: 1, transform: T(dirx * 340, -360, dirx * 540), offset: 0.4, easing: "ease-in" }, { opacity: 1, transform: T(dirx * 780, 200, dirx * 1060), offset: 0.92 }, { opacity: 0, transform: T(dirx * 800, 230, dirx * 1090) }], tk, 1.6, "ease-out");
          A(L.sh, [{ opacity: 0.38 }, { opacity: 0 }], tk, 0.05);
          spark(L.p, tk); blood(L.p, tk, 10, 1.2); decal(L.p, tk + 0.1, 190, d.i); dust(L.p, tk, 4, 0.8); setTimers.push([tk, () => sfx("death")]);
          hop(Wn, tk + 0.5); hop(Wn, tk + 1.1);
          survivors.push(Wn);
        } else {
          rockHit(L, tk + 0.9);
          hop(Wn, tk + 0.9);
          if (d.kind === "rock2") { // el ganador celebra... y le cae otra roca
            hop(Wn, tk + 1.6); hop(Wn, tk + 2.2);
            rockHit(Wn, tk + 3.6);
          } else survivors.push(Wn);
        }
        d.end = tk + (d.kind === "rock2" ? 3.9 : 2.2);
      });

      // ---- Llegada de la plaga: gnomos corriendo, arcoíris y chuches ----
      const lanes = [...new Set(survivors.map((u) => u.r + u.c))].slice(0, 3);
      [9, 10, 11].forEach((s) => { if (lanes.length < 3 && !lanes.includes(s)) lanes.push(s); });
      const x0 = at(5, 5).x;
      const gn = [];
      let gi = 0;
      lanes.forEach((sum, li) => {
        const fromLeft = li % 2 === 0;
        const count = 5;
        for (let n = 0; n < count; n++, gi++) {
          const y = (sum) * TILE_TOP_HEIGHT / 2 + TILE_TOP_HEIGHT / 2 + (n % 2) * 14;
          const g = mk("div", "war__u", `left:0;top:${y}px;z-index:${20 + sum * 3 + 2};opacity:0;transform:${BASE}`);
          g.innerHTML = `<div class="war__flip" style="transform:scaleX(${fromLeft ? 1 : -1})"><img class="war__sp" style="width:92px" src="${IMG.gnome}" alt="" draggable="false"></div>`;
          world.appendChild(g);
          const t = tg + 0.3 + li * 0.35 + n * 0.22, dur = 3.4;
          const xa = fromLeft ? x0 - 1000 : x0 + 1000, xb = fromLeft ? x0 + 1000 : x0 - 1000;
          A(g, [{ opacity: 1, left: xa + "px" }, { opacity: 1, left: xb + "px" }], t, dur, "linear");
          const sp = g.querySelector(".war__sp");
          sp.animate([{ transform: "translateY(0) rotate(-5deg)" }, { transform: "translateY(-18px) rotate(5deg)" }, { transform: "translateY(0) rotate(-5deg)" }],
            { delay: Math.round(t * 1000), duration: 300, iterations: Math.ceil(dur / 0.3), easing: "ease-in-out", fill: "forwards" });
          gn.push({ g, t, dur, xa, xb, y, sum });
        }
      });
      // los supervivientes caen pisoteados cuando pasa el primer gnomo por su carril
      survivors.forEach((u, i) => {
        const lane = gn.find((q) => q.sum === u.r + u.c) || gn[0];
        const frac = Math.min(0.95, Math.max(0.05, ((u.p.x - lane.xa) / (lane.xb - lane.xa))));
        const tp = lane.t + lane.dur * frac;
        flatten(u, tp, 1.8); dust(u.p, tp, 5, 0.9); spark(u.p, tp);
        setTimers.push([tp, () => sfx("hit")]);
      });
      // arcoíris + chuches + atardecer que se aclara
      const rb = ov.querySelector(".war__rainbow");
      A(rb, [{ opacity: 1, transform: "scaleY(0)" }, { opacity: 1, transform: "scaleY(1)" }], tg + 0.4, 0.9, "cubic-bezier(.2,1.2,.3,1)");
      for (let i = 0; i < 22; i++) {
        const e = mk("i", "war__candy", `left:${(i * 47) % 100}%;background:${["#ff5a8a", "#ffd23f", "#5ad1ff", "#7be07b"][i % 4]};opacity:0`); fx.appendChild(e);
        e.animate([{ opacity: 1, transform: "translateY(-6vh) rotate(0deg)" }, { opacity: 1, transform: `translateY(75vh) rotate(${i % 2 ? 360 : -360}deg)` }],
          { delay: Math.round((tg + 0.5 + (i % 7) * 0.3) * 1000), duration: 2600 + (i % 5) * 400, iterations: Infinity, easing: "linear", fill: "backwards" });
      }
      A(ov.querySelector(".war__dusk"), [{ opacity: 1 }, { opacity: 0 }], tg, 1.6);
      // brasas ambientales
      for (let i = 0; i < 18; i++) {
        const e = mk("i", "war__ember", `left:${(i * 53) % 100}%;width:${4 + (i % 3) * 2}px;height:${4 + (i % 3) * 2}px;background:${i % 2 ? "#ff9d3b" : "#ffcf3f"}`); fx.appendChild(e);
        const dur = 6000 + (i % 6) * 1200;
        e.animate([{ opacity: 0, transform: "translate(0,105vh)" }, { opacity: 0.9, offset: 0.15 }, { opacity: 0.9, offset: 0.8 }, { opacity: 0, transform: `translate(${-14 - (i % 4) * 6}vw,-8vh) rotate(260deg)` }],
          { duration: dur, iterations: Infinity, delay: -((i * 937) % dur), easing: "linear" });
      }

      // ---- Cámara: scroll suave siguiendo la acción ----
      const first = camPts[0] || { x: at(5, 5).x, y: at(5, 5).y };
      const center = { x: at(5, 5).x, y: at(5, 5).y };
      const pts = [{ t: 0, x: first.x - 170, y: first.y - 50 }, ...camPts, { t: tg + 1.2, x: center.x, y: center.y }, { t: total, x: center.x + 150, y: center.y }];
      const camY = vh * 0.37;
      const kfs = pts.map((p) => ({ offset: Math.min(1, p.t / total), transform: `translate(${vw / 2 - p.x * k}px,${camY - p.y * k}px) scale(${k})`, easing: "ease-in-out" }));
      kfs[0].offset = 0; kfs[kfs.length - 1].offset = 1;
      for (let i = 1; i < kfs.length; i++) if (kfs[i].offset <= kfs[i - 1].offset) kfs[i].offset = Math.min(1, kfs[i - 1].offset + 0.001);
      world.style.transformOrigin = "0 0";
      world.animate(kfs, { duration: total * 1000, fill: "forwards", easing: "linear" });
      // título
      A(ov.querySelector(".war__title"), [{ opacity: 0, transform: "translateX(-50%) scale(.8)" }, { opacity: 1, transform: "translateX(-50%) scale(1)", offset: 0.15 }, { opacity: 1, transform: "translateX(-50%) scale(1)", offset: 0.8 }, { opacity: 0, transform: "translateX(-50%) scale(1.05)" }], 0.3, 3.6, "ease-out");

      // ---- Narración de Nizak, botones y cierre ----
      document.body.appendChild(ov);
      if (cfg.onMount) cfg.onMount(ov);
      const textEl = ov.querySelector(".war__text"), goBtn = ov.querySelector(".war__go");
      const timers = [];
      let done = false;
      const finish = () => {
        if (done) return; done = true;
        timers.forEach(clearTimeout);
        ov.classList.remove("war--on");
        setTimeout(() => { ov.remove(); if (cfg.onEnd) cfg.onEnd(ov); resolve(); }, 250);
      };
      lines.forEach((ln, i) => timers.push(setTimeout(() => {
        textEl.textContent = ln; textEl.classList.remove("war__text--in"); void textEl.offsetWidth; textEl.classList.add("war__text--in");
      }, i * cfg.per * 1000)));
      setTimers.forEach(([t, fn]) => timers.push(setTimeout(fn, t * 1000)));
      timers.push(setTimeout(() => goBtn.classList.add("war__go--on"), lines.length * cfg.per * 1000));
      ov.querySelector(".war__skip").addEventListener("click", () => { if (cfg.click) cfg.click(); finish(); });
      goBtn.addEventListener("click", () => { if (cfg.click) cfg.click(); finish(); });
      requestAnimationFrame(() => ov.classList.add("war--on"));
    }));
  }

  return { play };
})();

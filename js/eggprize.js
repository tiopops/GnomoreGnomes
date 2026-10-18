/* ==========================================================================
   Premio del huevo (js/eggprize.js)
   --------------------------------------------------------------------------
   Cuando el huevo explota, el jugador local ve su premio en mitad de la pantalla:
   cartel "+N" con el icono de Gloria de su raza, cuenta ascendente tipo tragaperras,
   tres estrellas (1 = hasta 3 rebotes, 2 = 4-7, 3 = 8 o más), lluvia de monedas que
   rebotan y un imán las lleva al marcador de Gloria, que sube moneda a moneda.
   Sin texto explicativo. Todo va con pointer-events:none: nunca bloquea el juego.
   Egg._explode lo llama con { team, n, from:{x,y}, grant(k) }.
   ========================================================================== */
const EggPrize = {
  _layer: null,
  _sleep(ms) { return new Promise((r) => setTimeout(r, ms)); },
  _rnd(a, b) { return a + Math.random() * (b - a); },
  _sfx(name, a) { if (typeof SFX !== "undefined" && SFX[name]) { try { SFX[name](a); } catch (e) {} } },

  _iconSrc(team) {
    const hud = typeof Glory !== "undefined" && Glory._els ? Glory._els[team] : null;
    const img = hud && hud.querySelector(".glory-hud__icon");
    return img ? img.src : null;
  },
  _target(team) {
    const hud = typeof Glory !== "undefined" && Glory._els ? Glory._els[team] : null;
    const img = hud && (hud.querySelector(".glory-hud__icon") || hud);
    if (img) { const r = img.getBoundingClientRect(); if (r.width) return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    return { x: 60, y: 50 };
  },

  _el(cls, parent) { const d = document.createElement("div"); d.className = cls; (parent || this._layer).appendChild(d); return d; },

  _physics(items, floor) {
    return new Promise((done) => {
      let last = performance.now();
      const f = (t) => {
        const dt = Math.min(0.033, (t - last) / 1000); last = t;
        let alive = 0;
        for (const p of items) {
          if (p.done) continue;
          alive++;
          p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.age += dt;
          if (p.y > floor && p.vy > 0 && p.bounces < 2) { p.y = floor; p.vy *= -0.5; p.vx *= 0.7; p.bounces++; }
          if (p.stop && p.stop(p)) continue;
          p.el.style.transform = `translate(${p.x}px,${p.y}px) rotate(${p.rot}deg) scale(${p.sx ? Math.cos(p.age * p.sp) : 1},1)`;
          if (p.life) {
            if (p.age > p.life) { p.done = true; p.el.remove(); }
            else p.el.style.opacity = Math.max(0, 1 - Math.max(0, p.age - p.life * 0.6) / (p.life * 0.4));
          }
        }
        if (alive) requestAnimationFrame(f); else done();
      };
      requestAnimationFrame(f);
    });
  },

  _ring(x, y, size, color, delay) {
    const r = this._el("ep-ring");
    r.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;border-color:${color}`;
    r.animate([{ transform: "translate(-50%,-50%) scale(.2)", opacity: 0.95 }, { transform: "translate(-50%,-50%) scale(1.5)", opacity: 0 }], { duration: 700, delay, easing: "ease-out" }).onfinish = () => r.remove();
  },
  _spark(x, y, delay) {
    const s = this._el("ep-spark");
    s.style.left = x + "px"; s.style.top = y + "px";
    s.animate([{ opacity: 0, transform: "scale(0) rotate(0)" }, { opacity: 1, transform: "scale(1.3) rotate(45deg)", offset: 0.4 }, { opacity: 0, transform: "scale(0) rotate(90deg)" }], { duration: 650, delay }).onfinish = () => s.remove();
  },

  async play({ team, n, from, grant }) {
    if (!(n > 0)) return;
    if (this._busy) { grant(n); return; }
    this._busy = true;
    try { await this._run(team, n, from, grant); } finally { this._busy = false; if (this._layer) { this._layer.remove(); this._layer = null; } }
  },

  async _run(team, n, from, grant) {
    const W = innerWidth, H = innerHeight;
    const c = from && isFinite(from.x) ? from : { x: W / 2, y: H * 0.55 };
    const tier = n >= 8 ? "jack" : n >= 4 ? "mid" : "low";
    const lit = tier === "jack" ? 3 : tier === "mid" ? 2 : 1;
    const layer = this._layer = document.createElement("div");
    layer.className = "ep-layer";
    document.body.appendChild(layer);

    const dim = this._el("ep-dim"); dim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: "forwards" });
    const flash = this._el("ep-flash");
    flash.animate([{ opacity: tier === "jack" ? 0.85 : 0.5 }, { opacity: 0 }], { duration: 420, easing: "ease-out" });
    this._ring(c.x, c.y, 260, "#fff", 0); this._ring(c.x, c.y, 380, "#ffd23f", 90);
    if (tier === "jack") { this._ring(c.x, c.y, 520, "#ff7a2a", 180); this._ring(c.x, c.y, 680, "#fff", 260); }

    const rays = this._el("ep-rays");
    rays.animate([{ opacity: 0, transform: "scale(.2)" }, { opacity: tier === "low" ? 0.5 : 1, transform: "scale(1)" }], { duration: 500, fill: "forwards", easing: "ease-out" });

    // Cartel
    const win = this._el("ep-win" + (tier !== "low" ? " ep-big" : "") + (tier === "jack" ? " ep-jack" : ""));
    const stars = this._el("ep-stars", win);
    const starEls = [0, 1, 2].map(() => { const sw = this._el("ep-sw", stars); return this._el("ep-star", sw); });
    const fr = this._el("ep-fr", win);
    const src = this._iconSrc(team);
    if (src) { const im = document.createElement("img"); im.className = "ep-ic"; im.src = src; im.alt = ""; fr.appendChild(im); }
    const num = this._el("ep-num", fr);
    num.innerHTML = '<i>+</i><b>0</b>';
    const nb = num.querySelector("b");
    const sc = tier === "jack" ? 1.25 : tier === "mid" ? 1 : 0.8;
    const base = Math.min(1, W / 900);
    win.animate([
      { transform: "translate(-50%,-50%) scale(0) rotate(-12deg)", opacity: 1 },
      { transform: `translate(-50%,-50%) scale(${sc * base * 1.2}) rotate(3deg)`, opacity: 1, offset: 0.6 },
      { transform: `translate(-50%,-50%) scale(${sc * base}) rotate(-1.5deg)`, opacity: 1 },
    ], { duration: 480, fill: "forwards", easing: "cubic-bezier(.3,1.4,.5,1)" });
    await this._sleep(380);

    // Cuenta ascendente + una moneda por cada punto (hasta 12 monedas, cada una vale varios si hace falta)
    const nCoins = Math.min(n, 12);
    const per = []; for (let i = 0; i < nCoins; i++) per.push(Math.floor(n / nCoins) + (i < n % nCoins ? 1 : 0));
    const coins = [];
    const step = Math.min(150, 1500 / n);
    let shown = 0;
    for (let i = 1; i <= n; i++) {
      nb.textContent = i; num.classList.remove("ep-pop"); void num.offsetWidth; num.classList.add("ep-pop");
      this._sfx("gloryCoin", i - 1);
      const wr = win.getBoundingClientRect();
      for (let k = 0; k < 3; k++) this._spark(wr.left + this._rnd(0, wr.width), wr.top + this._rnd(0, wr.height), k * 60);
      const ci = Math.min(nCoins - 1, Math.floor(((i - 1) * nCoins) / n));
      if (ci >= coins.length) {
        const e = this._el("ep-coin");
        if (src) e.innerHTML = `<img src="${src}" alt="">`;
        const a = -Math.PI / 2 + this._rnd(-0.9, 0.9), v = this._rnd(750, 1250) * Math.min(1, H / 800);
        coins.push({ el: e, x: c.x, y: c.y, vx: Math.cos(a) * v * 0.7, vy: Math.sin(a) * v, rot: 0, vr: this._rnd(-360, 360), g: 1900, bounces: 0, age: 0, sx: true, sp: this._rnd(10, 16), val: per[coins.length] });
      }
      await this._sleep(step);
    }
    // Estrellas: siempre 3, apagadas las no conseguidas
    for (let k = 0; k < 3; k++) {
      starEls[k].classList.add("ep-show");
      if (k < lit) { starEls[k].classList.add("ep-on"); this._sfx("gloryCoin", 7 + k * 3); }
      await this._sleep(170);
    }
    this._sfx("glory");

    // Confeti
    const cols = ["#ffd23f", "#ff4a3a", "#3fb0ff", "#7be04a", "#fff"];
    const nconf = tier === "jack" ? 120 : tier === "mid" ? 60 : 20, cf = [];
    for (let i = 0; i < nconf; i++) {
      const e = this._el("ep-conf"); e.style.background = cols[i % 5];
      cf.push({ el: e, x: this._rnd(0, W), y: this._rnd(-300, -20), vx: this._rnd(-80, 80), vy: this._rnd(100, 300), rot: this._rnd(0, 360), vr: this._rnd(-500, 500), g: 260, bounces: 9, age: 0, life: 3.2, sx: true, sp: this._rnd(6, 14) });
    }
    this._physics(cf, H + 400);
    if (tier === "jack") for (let k = 0; k < 10; k++) this._spark(this._rnd(0.2, 0.8) * W, this._rnd(0.15, 0.6) * H, k * 50);

    // Imán: las monedas rebotan y vuelan al marcador, que sube con cada una
    const tg = this._target(team), floor = H * 0.9;
    let got = 0, granted = 0;
    coins.forEach((p, idx) => {
      p.stop = (q) => {
        if (q.age < 0.9 + idx * 0.07) return false;
        if (!q.mag) { q.mag = true; q.sx = false; q.m0 = { x: q.x, y: q.y }; q.mt = q.age; }
        const k = Math.min(1, (q.age - q.mt) / 0.45), e = k * k * (3 - 2 * k);
        q.x = q.m0.x + (tg.x - q.m0.x) * e; q.y = q.m0.y + (tg.y - q.m0.y) * e - Math.sin(k * Math.PI) * 90;
        q.el.style.transform = `translate(${q.x}px,${q.y}px) scale(${1 - 0.35 * e})`;
        if (k >= 1) { q.done = true; q.el.remove(); granted += q.val; grant(q.val); this._sfx("gloryCoin", got++); }
        return true;
      };
    });
    await this._physics(coins, floor);
    if (granted < n) grant(n - granted); // seguro por si algo se interrumpe

    await this._sleep(250);
    win.animate([{ opacity: 1 }, { transform: "translate(-50%,-50%) scale(.1)", opacity: 0 }], { duration: 300, easing: "ease-in", fill: "forwards" });
    rays.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: "forwards" });
    dim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: "forwards" });
    await this._sleep(520);
  },
};

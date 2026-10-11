/* Gnomore Gnomes — vendedor de la Tienda Goblin (decoración animada).
   Un solo cometido: dibujar al goblin apoyado en el borde superior de la
   ventana de la tienda y animar su moneda: gira en reposo entre sus dedos y,
   cada cierto tiempo, sale disparada girando en el aire y aterriza de nuevo.
   Solo vive mientras la ventana está abierta (Shops.openPopup/closePopup).
   Todos los valores salen del debug aprobado (posiciones en % del ancho de la
   ventana, y de la moneda en % del dibujo del goblin). */
const ShopVendor = {
  CFG: {
    gx: -5.0, gy: -18.1, gs: 44.6,     // goblin: x, y y tamaño (% del ancho de la ventana)
    cx: 90.1, cy: 55.3, cs: 9.4, ct: 9, // moneda: x, y (% del dibujo), tamaño (% del ancho del goblin) y grosor (% del ancho de la moneda)
    fk: 100,                           // gesto del goblin al lanzar (% de intensidad; 0 = ninguno)
    th: 60,                            // altura del lanzamiento (% de la altura del goblin)
    iv: 4, td: 1.1, sp: 2.2, as: 4,    // cada (s), vuelo (s), giro en reposo (s), vueltas en el aire
    fx: 83, fy: 53, fw: 6.9, fh: 24,   // dedo delantero (% del dibujo): se pinta por encima de la moneda
  },
  GOB_ASPECT: 992 / 648,
  _raf: null,
  _el: null,

  // Crea el vendedor dentro de `panel` (el contenedor exterior de la ventana) y arranca la animación.
  mount(panel) {
    this.stop();
    const c = this.CFG;
    const el = document.createElement("div");
    el.className = "shop-vendor";
    const src = "assets/ui/goblin_vendedor.png";
    el.innerHTML =
      `<div class="shop-vendor__body">` +
      `<img class="shop-vendor__img" src="${src}" alt="" draggable="false">` +
      `<div class="shop-vendor__coin"></div>` +
      `<div class="shop-vendor__front"><img src="${src}" alt="" draggable="false"></div>` +
      `</div>`;
    el.style.setProperty("--gx", c.gx);
    el.style.setProperty("--gy", c.gy);
    el.style.setProperty("--gs", c.gs);
    const body = el.querySelector(".shop-vendor__body");
    const coin = el.querySelector(".shop-vendor__coin");
    coin.style.left = c.cx + "%";
    coin.style.top = c.cy + "%";
    coin.style.width = c.cs + "%";
    coin.style.aspectRatio = "321 / 360";
    const front = el.querySelector(".shop-vendor__front");
    front.style.cssText = `left:${c.fx}%;top:${c.fy}%;width:${c.fw}%;height:${c.fh}%`;
    const fi = front.firstElementChild;
    fi.style.cssText = `width:${(100 / c.fw) * 100}%;height:${(100 / c.fh) * 100}%;left:${(-c.fx / c.fw) * 100}%;top:${(-c.fy / c.fh) * 100}%`;
    panel.style.setProperty("--vend-over", String(Math.max(0, -c.gy)));
    panel.appendChild(el);
    this._el = el;
    this._buildCoin(coin);
    this._run(el, body, coin);
  },

  // La moneda es una pila de capas con profundidad (Z): de canto se ve el grosor.
  _buildCoin(coin) {
    const src = "assets/ui/goblin_moneda.png";
    const w = coin.clientWidth || 40;
    const T = (w * this.CFG.ct) / 100;
    const N = Math.max(0, Math.round(T / 0.8));
    let h = "";
    for (let i = 0; i < N; i++) h += `<img class="mid" src="${src}" alt="" draggable="false" style="transform:translateZ(${(-T / 2 + (T * (i + 1)) / (N + 1)).toFixed(2)}px)">`;
    h += `<img class="face" src="${src}" alt="" draggable="false" style="transform:translateZ(${(T / 2).toFixed(2)}px)">`;
    h += `<img class="face" src="${src}" alt="" draggable="false" style="transform:translateZ(${(-T / 2).toFixed(2)}px) rotateY(180deg)">`;
    coin.innerHTML = h;
    coin._w = w;
  },

  _run(el, body, coin) {
    const c = this.CFG;
    let clock = 0;
    let last = performance.now();
    let nextToss = 0.8;
    let tossStart = -1;
    const PRE = 0.14; // el goblin "arma" el gesto y la moneda sale justo después
    const ease = (a) => (a < 0 ? 0 : a > 1 ? 1 : a * a * (3 - 2 * a));
    const k = c.fk / 100;
    const frame = (now) => {
      if (this._el !== el) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;
      if (coin.clientWidth && Math.abs(coin.clientWidth - coin._w) > 0.5) this._buildCoin(coin);
      const gh = el.clientHeight;
      let dy = 0, rot = 0, rz = 0, sc = 1, by = 0, br = 0, bs = 1;
      let inHand = true;
      if (tossStart < 0 && clock >= nextToss) tossStart = clock;
      if (tossStart >= 0) {
        const t = clock - tossStart;
        const u = (t - PRE) / c.td;
        // gesto del goblin: anticipación, latigazo hacia arriba y vuelta a reposo
        let a;
        if (t < PRE) { a = ease(t / PRE); by = a * 0.012; br = a * 1.0; bs = 1 - a * 0.012; }
        else if (t < PRE + 0.2) { a = ease((t - PRE) / 0.2); by = 0.012 - a * 0.032; br = 1.0 - a * 3.0; bs = 0.988 + a * 0.027; }
        else { a = ease((t - PRE - 0.2) / 0.55); by = -0.02 * (1 - a); br = -2.0 * (1 - a); bs = 1.015 - 0.015 * a; }
        if (u >= 1) {
          inHand = false;
          const s2 = (t - PRE - c.td) / 0.25; // aterriza con un pequeño rebote; la mano amortigua
          if (s2 < 1) {
            dy = -Math.sin(s2 * Math.PI) * gh * 0.035;
            sc = 1 + Math.sin(s2 * Math.PI) * 0.06;
            by += Math.sin(s2 * Math.PI) * 0.01;
            inHand = true;
            rot = c.as * 360;
          } else { tossStart = -1; nextToss = clock + c.iv; }
        } else if (u >= 0) {
          inHand = false;
          dy = -gh * (c.th / 100) * (1 - Math.pow(2 * u - 1, 2));
          rot = u * c.as * 360;
          rz = Math.sin(u * Math.PI * 3) * 14;
          sc = 1 + 0.12 * Math.sin(u * Math.PI);
        }
      }
      if (tossStart < 0 || (inHand && rot === 0)) {
        rot = (clock / c.sp) * 360;
        dy += Math.sin(clock * 3) * gh * 0.006;
      }
      coin.style.transform = `translate(-50%,-50%) translateY(${dy}px) rotateZ(${rz}deg) rotateY(${rot}deg) scale(${sc})`;
      body.style.transform = `translateY(${by * gh * k}px) rotate(${br * k}deg) scaleY(${1 + (bs - 1) * k})`;
      this._raf = requestAnimationFrame(frame);
    };
    this._raf = requestAnimationFrame(frame);
  },

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this._el = null;
  },
};

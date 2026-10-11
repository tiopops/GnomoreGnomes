/* Gnomore Gnomes — vendedor de la Tienda Goblin (decoración animada).
   Un solo cometido: dibujar al goblin apoyado en el borde superior de la
   ventana de la tienda y animar su moneda: gira en reposo entre sus dedos y,
   cada cierto tiempo, sale disparada girando en el aire y aterriza de nuevo.
   Solo vive mientras la ventana está abierta (Shops.openPopup/closePopup).
   Todos los valores salen del debug aprobado (posiciones en % del ancho de la
   ventana, y de la moneda en % del dibujo del goblin). */
const ShopVendor = {
  CFG: {
    gx: -3.9, gy: -20.3, gs: 39.1,     // goblin: x, y y tamaño (% del ancho de la ventana)
    cx: 90.1, cy: 55.3, cs: 9.4,       // moneda: x, y (% del dibujo) y tamaño (% del ancho del goblin)
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
      `<img class="shop-vendor__img" src="${src}" alt="" draggable="false">` +
      `<div class="shop-vendor__coin"><img src="assets/ui/goblin_moneda.png" alt="" draggable="false"></div>` +
      `<div class="shop-vendor__front"><img src="${src}" alt="" draggable="false"></div>`;
    el.style.setProperty("--gx", c.gx);
    el.style.setProperty("--gy", c.gy);
    el.style.setProperty("--gs", c.gs);
    const coin = el.querySelector(".shop-vendor__coin");
    coin.style.left = c.cx + "%";
    coin.style.top = c.cy + "%";
    coin.style.width = c.cs + "%";
    const front = el.querySelector(".shop-vendor__front");
    front.style.cssText = `left:${c.fx}%;top:${c.fy}%;width:${c.fw}%;height:${c.fh}%`;
    const fi = front.firstElementChild;
    fi.style.cssText = `width:${(100 / c.fw) * 100}%;height:${(100 / c.fh) * 100}%;left:${(-c.fx / c.fw) * 100}%;top:${(-c.fy / c.fh) * 100}%`;
    panel.appendChild(el);
    this._el = el;
    this._run(el, coin);
  },

  _run(el, coin) {
    const c = this.CFG;
    let clock = 0;
    let last = performance.now();
    let nextToss = 0.8;
    let tossStart = -1;
    const frame = (now) => {
      if (this._el !== el) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;
      const gh = el.clientHeight;
      let dy = 0, rot = 0, rz = 0, sc = 1;
      if (tossStart < 0 && clock >= nextToss) tossStart = clock;
      if (tossStart >= 0) {
        const u = (clock - tossStart) / c.td;
        if (u >= 1) {
          const s = (clock - tossStart - c.td) / 0.25; // pequeño rebote al aterrizar
          if (s < 1) {
            dy = -Math.sin(s * Math.PI) * gh * 0.035;
            sc = 1 + Math.sin(s * Math.PI) * 0.06;
          } else {
            tossStart = -1;
            nextToss = clock + c.iv;
          }
          rot = c.as * 360;
        } else {
          dy = -gh * (c.th / 100) * (1 - Math.pow(2 * u - 1, 2));
          rot = u * c.as * 360;
          rz = Math.sin(u * Math.PI * 3) * 14;
          sc = 1 + 0.12 * Math.sin(u * Math.PI);
        }
      }
      if (tossStart < 0) {
        rot = (clock / c.sp) * 360;
        dy = Math.sin(clock * 3) * gh * 0.006;
      }
      coin.style.transform = `translate(-50%,-50%) translateY(${dy}px) rotateZ(${rz}deg) rotateY(${rot}deg) scale(${sc})`;
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

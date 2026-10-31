/* Gnomore Gnomes — destrucción del Obelisco (llamado desde Obelisks._destroy).
   El sprite se parte en 15 trozos con grosor (capas apiladas: cara superior clara, laterales oscuros), más esquirlas con
   los colores del propio obelisco; salen despedidos, rebotan por el suelo y se desvanecen. Colores planos, sin contornos.
   Todo vive en el contenedor del tablero (sigue a la cámara) y se limpia solo. */
const ObeliskDebris = {
  _palette(img) {
    try {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext("2d");
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data, out = [];
      for (let i = 0; i < 160; i++) {
        const k = (((Math.random() * c.height) | 0) * c.width + ((Math.random() * c.width) | 0)) * 4;
        if (d[k + 3] > 200) out.push(`rgb(${d[k]},${d[k + 1]},${d[k + 2]})`);
      }
      if (out.length) return out;
    } catch (e) {}
    return ["#7d776d", "#5d584f", "#9a9285", "#4a463f"];
  },

  play(obelisk) {
    const el = obelisk && obelisk.el, spr = obelisk && obelisk.spriteEl;
    const host = el && el.parentElement;
    if (!host || !spr || !spr.offsetWidth) return;
    const src = spr.currentSrc || spr.src;
    const perf = document.body.classList.contains("perf-mode");
    const W = spr.offsetWidth, H = spr.offsetHeight;
    const left = parseFloat(el.style.left) || 0, top = parseFloat(el.style.top) || 0;
    const L = left - el.offsetWidth / 2 + spr.offsetLeft, T = top - 0.92 * el.offsetHeight + spr.offsetTop;
    const fl = T + H - 14; // suelo: base del obelisco
    const pal = this._palette(spr);
    const Z = "9000";
    const parts = [];
    const mk = (w, h, style, N, step) => {
      const wrap = document.createElement("div");
      wrap.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;pointer-events:none;z-index:${Z};will-change:transform,opacity`;
      const layers = [];
      for (let k = 0; k < N; k++) {
        const d = document.createElement("div");
        d.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;${style};filter:brightness(${(0.4 + (0.6 * k) / (N - 1)).toFixed(2)})`;
        wrap.appendChild(d);
        layers.push({ d, off: (N - 1 - k) * step });
      }
      const sh = document.createElement("div");
      sh.style.cssText = `position:absolute;left:0;top:0;width:${w * 0.9}px;height:${Math.max(6, w * 0.22)}px;border-radius:50%;background:#000;opacity:0;pointer-events:none;z-index:${Z}`;
      host.appendChild(sh);
      host.appendChild(wrap);
      return { wrap, layers, sh };
    };
    const cols = perf ? 2 : 3, rows = perf ? 3 : 5, pts = [];
    for (let j = 0; j <= rows; j++) {
      pts[j] = [];
      for (let i = 0; i <= cols; i++) {
        const jx = i > 0 && i < cols ? (Math.random() - 0.5) * (W / cols) * 0.6 : 0;
        const jy = j > 0 && j < rows ? (Math.random() - 0.5) * (H / rows) * 0.5 : 0;
        pts[j][i] = [(i * W) / cols + jx, (j * H) / rows + jy];
      }
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const q = [pts[j][i], pts[j][i + 1], pts[j + 1][i + 1], pts[j + 1][i]];
      const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
      const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0;
      const style = `background:url(${src}) -${x0}px -${y0}px/${W}px ${H}px no-repeat;clip-path:polygon(${q.map((p) => `${p[0] - x0}px ${p[1] - y0}px`).join(",")})`;
      const m = mk(w, h, style, perf ? 4 : 9, perf ? 3.4 : 1.7);
      const cx = L + x0 + w / 2, cy = T + y0 + h / 2, dir = (cx - (L + W / 2)) / W;
      parts.push({ ...m, x: cx, y: cy, w, h, vx: dir * 420 + (Math.random() - 0.5) * 160, vy: -(120 + Math.random() * 260) - (1 - j / rows) * 40, rot: 0, vr: (Math.random() - 0.5) * 600, fl: fl + (Math.random() * 40 - 10), b: 0, t: 0, big: 1 });
    }
    for (let k = 0; k < (perf ? 8 : 20); k++) {
      const s = 8 + Math.random() * 14, n = 3 + ((Math.random() * 2) | 0), poly = [];
      for (let a = 0; a < n; a++) {
        const an = (a / n) * 6.283 + Math.random() * 0.8, rr = (s / 2) * (0.6 + Math.random() * 0.6);
        poly.push(`${s / 2 + Math.cos(an) * rr}px ${s / 2 + Math.sin(an) * rr}px`);
      }
      const m = mk(s, s, `background:${pal[(Math.random() * pal.length) | 0]};clip-path:polygon(${poly.join(",")})`, perf ? 2 : 4, 1.5);
      const x = L + W * (0.2 + Math.random() * 0.6), y = T + H * (0.1 + Math.random() * 0.85);
      parts.push({ ...m, x, y, w: s, h: s, vx: (x - (L + W / 2)) * 3 + (Math.random() - 0.5) * 300, vy: -(180 + Math.random() * 380), rot: 0, vr: (Math.random() - 0.5) * 1200, fl: fl + (Math.random() * 40 - 10), b: 0, t: 0, big: 0 });
    }
    // polvo plano del color del obelisco
    for (let k = 0; k < (perf ? 3 : 7); k++) {
      const d = document.createElement("div"), sz = 40 + Math.random() * 50;
      d.style.cssText = `position:absolute;width:${sz}px;height:${sz}px;border-radius:50%;left:${L + W / 2 + (Math.random() - 0.5) * W - sz / 2}px;top:${fl - sz / 2 - Math.random() * 20}px;background:${pal[(Math.random() * pal.length) | 0]};opacity:.5;pointer-events:none;z-index:${Z}`;
      host.appendChild(d);
      const done = () => d.remove();
      d.animate([{ transform: "scale(.3)", opacity: 0.55 }, { transform: `translate(${(Math.random() - 0.5) * 80}px,-30px) scale(1.2)`, opacity: 0 }], { duration: 700 + Math.random() * 300, easing: "ease-out" }).finished.then(done, done);
    }
    if (typeof SFX !== "undefined" && SFX._tone) { try { SFX._tone(120, 48, 0.35, "triangle", 0.25); SFX._tone(220, 90, 0.2, "triangle", 0.15, 0.02); } catch (e) {} }
    let last = performance.now();
    const G = 1500;
    const cleanup = () => parts.forEach((p) => { p.wrap.remove(); p.sh.remove(); });
    const t0 = last;
    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      let alive = 0;
      parts.forEach((p) => {
        p.t += dt; p.vy += G * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        if (p.y + p.h / 2 >= p.fl && p.vy > 0) {
          p.y = p.fl - p.h / 2;
          if (p.b < 3) {
            p.vy = -p.vy * (0.42 - p.b * 0.08); p.vx *= 0.7; p.vr *= 0.6; p.b++;
            if (p.b === 1 && p.big && typeof SFX !== "undefined" && SFX._tone) { try { SFX._tone(90 + Math.random() * 60, 50, 0.12, "triangle", 0.1); } catch (e) {} }
          } else { p.vy = 0; p.vx *= 0.8; p.vr *= 0.7; }
        }
        const life = p.t - 1.05, o = life > 0 ? Math.max(0, 1 - life / 0.55) : 1;
        p.wrap.style.opacity = o;
        p.wrap.style.transform = `translate(${p.x - p.w / 2}px,${p.y - p.h / 2}px)`;
        p.layers.forEach((l) => { l.d.style.transform = `translateY(${l.off}px) rotate(${p.rot}deg)`; });
        const air = Math.max(0, p.fl - (p.y + p.h / 2)), sc = 1 / (1 + air / 260);
        p.sh.style.opacity = 0.32 * o * sc;
        p.sh.style.transform = `translate(${p.x - p.w * 0.45}px,${p.fl - 3}px) scale(${sc})`;
        if (o > 0) alive++;
      });
      if (alive && now - t0 < 4000 && host.isConnected) requestAnimationFrame(step);
      else cleanup();
    };
    requestAnimationFrame(step);
  },
};

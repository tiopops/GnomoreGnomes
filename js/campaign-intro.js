// ============================================================
// CampaignIntro — vídeo de introducción del capítulo 1 de la campaña.
// Solo el capítulo 1 tiene intro; los demás capítulos empiezan directamente.
// Este archivo solo sabe reproducir el vídeo con subtítulos propios y el
// salto manteniendo pulsado; Campaign le pasa textos y recibe una promesa.
// ============================================================
const CampaignIntro = (() => {
  const mk = (tag, cls, css) => { const e = document.createElement(tag); if (cls) e.className = cls; if (css) e.style.cssText = css; return e; };

  // ---- Escena de vídeo cinematográfica (3D renderizado con los sprites del juego) ----
  // El vídeo NO lleva texto ni voces: los subtítulos son una capa HTML propia (cfg.subs: [{t0,t1,text}]) en el idioma
  // elegido. Se salta manteniendo pulsado 3 s (ratón/táctil, tecla o botón del mando), igual que el retrato del tutorial.
  const HOLD_MS = 3000;
  function playVideo(cfg) {
    return new Promise((resolve) => {
      const ov = mk("div", "cine");
      ov.innerHTML = `<video class="cine__v" playsinline preload="auto" src="${cfg.src}"></video>
        <div class="cine__sub"><span class="cine__who">${cfg.nizak}</span><span class="cine__txt"></span></div>
        <button type="button" class="cine__skip"><span class="cine__skiptxt">${cfg.hold}</span><i class="cine__fill"></i></button>`;
      const v = ov.querySelector("video"), txt = ov.querySelector(".cine__txt"), sub = ov.querySelector(".cine__sub");
      const fill = ov.querySelector(".cine__fill"), btn = ov.querySelector(".cine__skip");
      let done = false, hold = null, raf = 0;
      // En vertical el vídeo (16:9) se recorta: se panea para seguir la acción y acabar con el gnomo final centrado.
      const FOCUS = [[0, .5], [3, .52], [6, .55], [9, .5], [12, .5], [15, .55], [18, .5], [21, .58], [24, .62], [27, .5], [30, .5], [33, .55], [35, .55], [99, .55]];
      const frame = (t) => {
        const cw = ov.clientWidth, ch = ov.clientHeight, vw = v.videoWidth, vh = v.videoHeight;
        if (!vw || !vh || ch <= cw) { v.style.objectPosition = ""; return; }
        let fx = FOCUS[FOCUS.length - 1][1];
        for (let i = 1; i < FOCUS.length; i++) if (t < FOCUS[i][0]) { const a = FOCUS[i - 1], b = FOCUS[i]; fx = a[1] + (b[1] - a[1]) * ((t - a[0]) / (b[0] - a[0])); break; }
        const iw = vw * (ch / vh); // ancho mostrado del vídeo con object-fit: cover
        if (iw <= cw) { v.style.objectPosition = ""; return; }
        const p = Math.max(0, Math.min(1, (fx * iw - cw / 2) / (iw - cw)));
        v.style.objectPosition = (p * 100).toFixed(2) + "% 50%";
      };
      // Locución: archivo de audio aparte (según el idioma elegido), sincronizado con el vídeo. Sin archivo para ese idioma = sin voz.
      let voice = null;
      if (cfg.voice) { try { voice = new Audio(cfg.voice); voice.preload = "auto"; voice.volume = 1; v.volume = 0.22; } catch (e) { voice = null; } }
      const finish = () => {
        if (done) return; done = true;
        if (voice) { try { voice.pause(); } catch (e) {} }
        cancelAnimationFrame(raf); document.removeEventListener("keydown", kd); document.removeEventListener("keyup", ku);
        try { v.pause(); } catch (e) {}
        if (cfg.onEnd) cfg.onEnd();
        // La escena siguiente retira este telón negro al montarse (sin parpadeo del tablero entre medias).
        sub.classList.remove("cine__sub--on"); btn.style.display = "none";
        CampaignIntro._cine = ov;
        setTimeout(() => { if (CampaignIntro._cine === ov) { ov.remove(); CampaignIntro._cine = null; } }, 6000);
        resolve();
      };
      const loop = () => {
        raf = requestAnimationFrame(loop);
        const t = v.currentTime;
        if (voice) {
          if (v.paused) { if (!voice.paused) voice.pause(); }
          else {
            if (voice.paused && v.currentTime > 0.05) { try { voice.currentTime = v.currentTime; const pp = voice.play(); if (pp && pp.catch) pp.catch(() => {}); } catch (e) {} }
            else if (Math.abs(voice.currentTime - v.currentTime) > 0.25) { try { voice.currentTime = v.currentTime; } catch (e) {} }
          }
        }
        frame(t);
        const cur = (cfg.subs || []).find((x) => t >= x.t0 && t < x.t1);
        sub.classList.toggle("cine__sub--on", !!cur);
        if (cur && txt.textContent !== cur.text) txt.textContent = cur.text;
        // Mando: cualquier botón mantenido cuenta como "pulsar".
        let pad = false;
        try { (navigator.getGamepads ? [...navigator.getGamepads()] : []).forEach((g) => { if (g && g.buttons.some((b) => b.pressed)) pad = true; }); } catch (e) {}
        if (pad && !hold) hold = { t0: performance.now(), pad: true };
        if (!pad && hold && hold.pad) hold = null;
        if (hold) {
          const f = Math.min(1, (performance.now() - hold.t0) / HOLD_MS);
          fill.style.width = f * 100 + "%"; btn.classList.add("cine__skip--on");
          if (f >= 1) finish();
        } else { fill.style.width = "0%"; btn.classList.remove("cine__skip--on"); }
      };
      const start = (src) => { if (!hold) hold = { t0: performance.now(), src }; };
      const stop = (src) => { if (hold && hold.src === src) hold = null; };
      const kd = (e) => { if (e.repeat) return; if (["Space", "Enter", "Escape"].includes(e.code)) start("key"); };
      const ku = (e) => { if (["Space", "Enter", "Escape"].includes(e.code)) stop("key"); };
      document.addEventListener("keydown", kd); document.addEventListener("keyup", ku);
      ov.addEventListener("pointerdown", () => start("ptr"));
      ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => ov.addEventListener(ev, () => stop("ptr")));
      v.addEventListener("ended", finish);
      v.addEventListener("error", finish);
      if (cfg.onStart) cfg.onStart();
      document.body.appendChild(ov);
      requestAnimationFrame(() => { ov.classList.add("cine--on"); const p = v.play(); if (p && p.catch) p.catch(finish); loop(); });
    });
  }

  return { playVideo };
})();

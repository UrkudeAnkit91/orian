/* ORIAN — Motion layer (3D scroll planes, cursor, magnet, rotator) */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(pointer:fine)').matches;

  /* ---- dynamic word rotator ---- */
  const rot = $('.rotator');
  if (rot) {
    const words = (rot.dataset.words || 'executes').split('|');
    let i = 0;
    const swap = () => {
      rot.classList.add('out');
      setTimeout(() => {
        i = (i + 1) % words.length;
        rot.textContent = words[i];
        rot.classList.remove('out');
        rot.classList.add('in');
      }, 260);
    };
    if (reduce) { rot.textContent = words[0]; }
    else { setInterval(swap, 3200); }
  }

  /* ---- cursor ring ---- */
  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  document.body.appendChild(ring);
  let cx = -80, cy = -80, rx = -80, ry = -80, big = false, ringsOn = false;
  if (fine && !reduce && matchMedia('(hover:hover)').matches) ringsOn = true;
  if (ringsOn) {
    addEventListener('pointermove', e => { rx = e.clientX; ry = e.clientY; }, { passive: true });
    addEventListener('pointerover', e => {
      const hot = e.target.closest && e.target.closest('a,button,.btn,.card,.mail,.stat,.badge');
      if (!!hot !== big) { big = !!hot; ring.classList.toggle('hot', big); }
    }, { passive: true });
    (function loop() {
      cx += (rx - cx) * 0.18; cy += (ry - cy) * 0.18;
      ring.style.transform = 'translate(' + (cx - 22) + 'px,' + (cy - 22) + 'px)';
      requestAnimationFrame(loop);
    })();
  } else ring.remove();

  /* ---- magnetic buttons ---- */
  if (fine && !reduce) {
    $$('.btn, .mail').forEach(b => {
      b.addEventListener('pointermove', e => {
        const r = b.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        b.style.setProperty('--mxg', (dx * 0.22).toFixed(1) + 'px');
        b.style.setProperty('--myg', (dy * 0.22).toFixed(1) + 'px');
      });
      b.addEventListener('pointerleave', () => {
        b.style.setProperty('--mxg', '0px');
        b.style.setProperty('--myg', '0px');
      });
    });
  }

  /* ---- 3D scroll planes ---- */
  const planes = $$('[data-plane]');
  const par = $$('[data-parallax]');
  if (planes.length && fine && !reduce && matchMedia('(min-width: 821px)').matches) {
    const vh = () => innerHeight;
    let raf = false;
    const update = () => {
      raf = false;
      const v = vh();
      for (const p of planes) {
        const r = p.getBoundingClientRect();
        const c = r.top + r.height / 2 - v / 2;
        const prog = Math.max(-1, Math.min(1, c / (v / 2)));
        const rot = prog * 4.5;
        p.style.transform = 'perspective(1300px) translateZ(' + (-Math.abs(prog) * 46).toFixed(1) + 'px) rotateX(' + rot.toFixed(2) + 'deg)';
      }
      for (const el of par) {
        const r = el.getBoundingClientRect();
        const c = r.top + r.height / 2 - v / 2;
        if (Math.abs(c) > v * 0.95) continue;
        const f = parseFloat(el.dataset.parallax || '0.3');
        el.style.transform = 'translateY(' + (c * f).toFixed(1) + 'px)';
      }
    };
    const onScroll = () => { if (!raf) { raf = true; requestAnimationFrame(update); } };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
    update();
  }

  /* ---- multi-layer parallax (touch fallback) ---- */
  if (par.length && (!fine || reduce)) {
    const vh2 = () => innerHeight;
    let raf2 = false;
    const update2 = () => {
      raf2 = false;
      const v = vh2();
      for (const el of par) {
        const r = el.getBoundingClientRect();
        const c = r.top + r.height / 2 - v / 2;
        if (Math.abs(c) > v * 0.95) continue;
        const f = parseFloat(el.dataset.parallax || '0.3');
        el.style.transform = 'translateY(' + (c * f).toFixed(1) + 'px)';
      }
    };
    const onS2 = () => { if (!raf2) { raf2 = true; requestAnimationFrame(update2); } };
    addEventListener('scroll', onS2, { passive: true });
    addEventListener('resize', onS2, { passive: true });
  }

  /* ---- live hero HUD readout ---- */
  const hud = $('.hero-hud');
  if (hud) {
    const get = k => hud.querySelector('.' + k);
    let tick = 2653.42;
    setInterval(() => {
      tick += (Math.random() - 0.48) * 3;
      const sys = get('v-sys'); if (sys) sys.textContent = (Math.random() > 0.08 ? 'ONLINE' : 'SYNC');
      const agt = get('v-agt'); if (agt) agt.textContent = 56 + (Math.random() * 5 | 0);
      const tk = get('v-tick'); if (tk) tk.textContent = tick.toFixed(2);
      const pg = get('v-ping'); if (pg) pg.textContent = 8 + (Math.random() * 30 | 0) + 'ms';
    }, 1300);
  }

  /* ---- hero parallax ---- */
  if (fine && !reduce) {
    const inner = $('.hero-inner');
    let raf = false;
    const hLoop = () => {
      raf = false;
      const sy = scrollY * 0.14;
      if (inner && sy < innerHeight * 0.9) inner.style.setProperty('--py', Math.min(90, sy).toFixed(1) + 'px');
    };
    const onH = () => { if (!raf) { raf = true; requestAnimationFrame(hLoop); } };
    addEventListener('scroll', onH, { passive: true });
  }
})();
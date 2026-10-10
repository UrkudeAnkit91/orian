/* ORIAN — Interactions (vanilla, no deps) */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(pointer:fine)').matches;

  // nav scrolled state
  const nav = $('.nav');
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 14);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // reveal on scroll
  const io = new IntersectionObserver((es) => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.14 });
  $$('[data-reveal]').forEach(el => io.observe(el));

  // 3D tilt cards
  if (!reduce && fine) {
    $$('[data-tilt]').forEach(card => {
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--ry', (px * 12).toFixed(2) + 'deg');
        card.style.setProperty('--rx', (-py * 12).toFixed(2) + 'deg');
        card.style.setProperty('--mx', ((px + 0.5) * 100).toFixed(1) + '%');
        card.style.setProperty('--my', ((py + 0.5) * 100).toFixed(1) + '%');
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });
  }

  // counter animation
  const cio = new IntersectionObserver((es) => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target, end = parseFloat(el.dataset.count), suf = el.dataset.suffix || '';
    if (reduce) { el.textContent = end + suf; cio.unobserve(el); return; }
    const dur = 1400; let st;
    const step = ts => { st ??= ts; const p = Math.min(1, (ts - st) / dur); const v = Math.round(end * (1 - Math.pow(1 - p, 3))); el.textContent = v + suf; if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step); cio.unobserve(el);
  }), { threshold: 0.5 });
  $$('[data-count]').forEach(el => cio.observe(el));

  // terminal typewriter
  const term = $('#term-body');
  if (term && !reduce) {
    const rows = $$('[data-term]', term);
    rows.forEach(r => r.style.visibility = 'hidden');
    const tio = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting) return; tio.disconnect();
      rows.forEach((r, i) => setTimeout(() => { r.style.visibility = 'visible'; r.classList.add('typed'); }, 350 + i * 480));
    }, { threshold: 0.35 });
    tio.observe(term);
  }

  // meters random walk
  if (!reduce) {
    $$('.meter').forEach(m => {
      const bar = $('i', m), lbl = $('b', m);
      let v = 15 + Math.random() * 60;
      setInterval(() => {
        v = Math.max(6, Math.min(96, v + (Math.random() * 22 - 11)));
        bar.style.width = v.toFixed(0) + '%';
        if (lbl) lbl.textContent = v.toFixed(0) + '%';
      }, 850 + Math.random() * 700);
    });
  }

  // activity feed
  const feed = $('#feed');
  if (feed && !reduce) {
    const msgs = [
      'agent.cluster :: heartbeat ok',
      'mt5.feed :: tick  XAUUSD 2650.34',
      'vision.ai  :: frame processed 42ms',
      'earn.engine:: rotation cycle 7',
      'tbq.core  :: signal BUY 0.87 conf',
      'ollama    :: qwen2.5:3b inference 0.31s',
      'gateway   :: websocket pong 12ms',
      'storage   :: vault sync ok'
    ];
    let idx = 0;
    const stamp = () => {
      const d = new Date();
      return d.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };
    setInterval(() => {
      const li = document.createElement('li');
      li.textContent = stamp() + '  ' + msgs[idx % msgs.length];
      feed.prepend(li);
      while (feed.children.length > 7) feed.lastElementChild.remove();
      idx++;
    }, 2400);
  }

  // smooth scroll for anchor links
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id === '#') return;
    const el = $(id);
    if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }));

  // footer year
  const y = $('#year');
  if (y) y.textContent = new Date().getFullYear();
})();
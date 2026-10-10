/* ORIAN — 3D Neural Field (vanilla, no deps) */
(() => {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, DPR = 1, cx = 0, cy = 0;
  const FOCAL = 760;

  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;

  // starfield
  const stars = Array.from({ length: 220 }, () => ({
    x: rand(-1600, 1600), y: rand(-1000, 1000), z: rand(180, 2200),
    tw: rand(0, Math.PI * 2), size: rand(0.5, 1.8)
  }));

  // fibonacci sphere nodes
  const N = 160, R = 270, nodes = [];
  const GA = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const rr = Math.sqrt(Math.max(0, 1 - y * y));
    const th = GA * i;
    nodes.push({
      x: Math.cos(th) * rr * R,
      y: y * R,
      z: Math.sin(th) * rr * R,
      type: i % 7 === 0 ? 2 : i % 5 === 0 ? 1 : 0,
      pu: Math.random() * Math.PI * 2
    });
  }
  const COL = [
    [59, 130, 246],    // blue
    [6, 182, 212],     // cyan
    [168, 85, 247]     // purple
  ];

  // edges
  const edges = [];
  const TH = R * 0.4;
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y, dz = nodes[i].z - nodes[j].z;
      if (dx*dx + dy*dy + dz*dz < TH*TH) edges.push([i, j]);
    }
  }

  // data pulses
  const pulses = Array.from({ length: 18 }, () => ({
    e: (Math.random() * edges.length) | 0, t: Math.random(), v: rand(0.18, 0.55)
  }));

  // orbit rings (3 tilted ellipses)
  const rings = [
    { r: R * 1.45, tilt: 0.35, color: [59, 130, 246], pts: 70 },
    { r: R * 1.85, tilt: -0.22, color: [6, 182, 212], pts: 55 },
    { r: R * 2.25, tilt: 0.55, color: [168, 85, 247], pts: 40 }
  ].map(r => ({
    ...r,
    pts: Array.from({ length: r.pts }, (_, i) => {
      const a = (i / r.pts) * Math.PI * 2;
      return { x: Math.cos(a) * r.r, y: 0, z: Math.sin(a) * r.r };
    })
  }));

  // orbiting core satellites
  const sats = [
    { a: 0, r: R * 1.2, spd: 0.32, tilt: 0.15, color: [59, 130, 246] },
    { a: 2.1, r: R * 1.6, spd: -0.22, tilt: -0.3, color: [6, 182, 212] },
    { a: 4.2, r: R * 2.0, spd: 0.16, tilt: 0.4, color: [168, 85, 247] }
  ];

  let rotY = 0.6, rotX = -0.2, mX = 0, mY = 0, tmX = 0, tmY = 0, t0 = performance.now();

  function resize() {
    const hero = canvas.parentElement;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = hero.clientWidth; H = hero.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cx = W / 2; cy = H / 2 + Math.min(50, H * 0.07);
  }

  function project(p, ry, rx) {
    let x = p.x * Math.cos(ry) - p.z * Math.sin(ry);
    let z = p.x * Math.sin(ry) + p.z * Math.cos(ry);
    let y = p.y;
    const cosX = Math.cos(rx), sinX = Math.sin(rx);
    const y2 = y * cosX - z * sinX;
    const z2 = y * sinX + z * cosX;
    const s = FOCAL / (FOCAL + z2);
    return { x: cx + x * s, y: cy + y2 * s, s, z: z2 };
  }

  function projectRing(p, ry, rx, tilt) {
    let x = p.x * Math.cos(ry) - p.z * Math.sin(ry);
    let z = p.x * Math.sin(ry) + p.z * Math.cos(ry);
    let y = p.y * Math.cos(tilt);
    z = p.y * Math.sin(tilt) + z;
    y = y * Math.cos(rx) - z * Math.sin(rx);
    z = y * Math.sin(rx) + z * Math.cos(rx);
    const s = FOCAL / (FOCAL + z);
    return { x: cx + x * s, y: cy + y * s, s, z };
  }

  const heroEl = canvas.parentElement;
  heroEl.addEventListener('pointermove', e => {
    const r = heroEl.getBoundingClientRect();
    tmX = ((e.clientX - r.left) / r.width - 0.5) * 2;
    tmY = ((e.clientY - r.top) / r.height - 0.5) * 2;
  });
  heroEl.addEventListener('pointerleave', () => { tmX = 0; tmY = 0; });

  function frame(now) {
    const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
    if (!reduce) {
      rotY += dt * (0.14 + Math.abs(tmX) * 0.3);
      mX += (tmX - mX) * 0.05; mY += (tmY - mY) * 0.05;
      for (const s of sats) s.a += dt * s.spd;
      for (const p of pulses) {
        p.t += dt * p.v;
        if (p.t > 1) { p.t = 0; p.e = (Math.random() * edges.length) | 0; p.v = rand(0.18, 0.55); }
      }
    }
    const rx = rotX + mY * 0.3;
    const ry = rotY + mX * 0.4;
    ctx.clearRect(0, 0, W, H);

    // starfield with depth parallax
    for (const st of stars) {
      if (!reduce) {
        st.z -= dt * 40;
        if (st.z < 80) { st.z = 2200; st.x = rand(-1600, 1600); st.y = rand(-1000, 1000); }
      }
      const s = FOCAL / (FOCAL + st.z);
      const px = cx + (st.x + mX * 120) * s;
      const py = cy + (st.y + mY * 80) * s;
      if (px < -2 || px > W + 2 || py < -2 || py > H + 2) continue;
      const a = (1 - st.z / 2200) * 0.85 * (0.55 + 0.45 * Math.sin(now * 0.0015 + st.tw));
      ctx.fillStyle = `rgba(148, 197, 255, ${a.toFixed(3)})`;
      const sz = st.size * s;
      ctx.fillRect(px, py, sz, sz);
    }

    // project nodes
    const P = nodes.map(n => project(n, ry, rx));

    // rings
    for (const ring of rings) {
      const RP = ring.pts.map(p => projectRing(p, ry, rx, ring.tilt));
      ctx.strokeStyle = `rgba(${ring.color[0]},${ring.color[1]},${ring.color[2]},0.12)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < RP.length; i++) {
        const p = RP[i];
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // globe edges
    ctx.lineWidth = 1;
    for (const [i, j] of edges) {
      const a = P[i], b = P[j];
      const sAvg = (a.s + b.s) * 0.5;
      if (sAvg < 0.65 || sAvg > 2.2) continue;
      const al = Math.max(0, Math.min(0.38, (sAvg - 0.6) * 0.65));
      const type = nodes[i].type === nodes[j].type ? nodes[i].type : 0;
      const c = COL[type];
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${al.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // nodes with glow
    for (let i = 0; i < N; i++) {
      const p = P[i];
      if (p.s < 0.4 || p.s > 2.5) continue;
      const n = nodes[i];
      const c = COL[n.type];
      const r = 2.2 * p.s;
      // outer glow
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3.5);
      grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0.18)`);
      grad.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 3.5, 0, Math.PI * 2);
      ctx.fill();
      // core
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // pulses
    for (const p of pulses) {
      const [i, j] = edges[p.e];
      const a = P[i], b = P[j];
      const px = lerp(a.x, b.x, p.t);
      const py = lerp(a.y, b.y, p.t);
      const ps = lerp(a.s, b.s, p.t);
      if (ps < 0.5 || ps > 2.3) continue;
      const r = 2.6 * ps;
      const g = ctx.createRadialGradient(px, py, 0, px, py, r * 4);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.2, 'rgba(148,197,255,0.6)');
      g.addColorStop(1, 'rgba(59,130,246,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, r * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // sats
    for (const s of sats) {
      const cosA = Math.cos(s.a), sinA = Math.sin(s.a);
      const px = cosA * s.r, pz = sinA * s.r;
      const p = project({ x: px, y: 0, z: pz }, ry, rx);
      if (p.s < 0.3 || p.s > 3) continue;
      const r = 5 * p.s;
      const c = s.color;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.5);
      g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0.6)`);
      g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(frame);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(heroEl);
  window.addEventListener('resize', resize);
  resize();
  if (reduce) frame(performance.now()); else requestAnimationFrame(frame);
})();
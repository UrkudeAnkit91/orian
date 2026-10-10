/* ORIAN — Fullpage 3D world (vanilla WebGL, no deps) */
(() => {
  const canvas = document.getElementById('field');
  if (!canvas) return;
  const coarse = window.matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(pointer:fine)').matches;
  if (coarse) {
    canvas.width = 1; canvas.height = 1;
    return;
  }
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'low-power' }) || canvas.getContext('experimental-webgl', { alpha: true });
  if (!gl) return;

  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------- shaders ---------- */
  function sh(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error('shader:', gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  function prog(vsSrc, fsSrc) {
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error('link:', gl.getProgramInfoLog(p)); return null; }
    return p;
  }

  const V_PT = `
    attribute vec3 aPos;
    attribute vec3 aColor;
    attribute float aSize;
    uniform mat4 uProj;
    uniform mat4 uView;
    uniform float uScale;
    varying vec3 vColor;
    void main() {
      vec4 v = uView * vec4(aPos, 1.0);
      gl_Position = uProj * v;
      gl_PointSize = aSize * uScale / max(0.15, -v.z);
      vColor = aColor;
    }`;
  const F_PT = `
    precision mediump float;
    varying vec3 vColor;
    void main() {
      vec2 d = gl_PointCoord - 0.5;
      float r = length(d);
      float a = smoothstep(0.5, 0.0, r);
      a *= a;
      gl_FragColor = vec4(vColor, a);
    }`;
  const V_LN = `
    attribute vec3 aPos;
    attribute vec3 aColor;
    uniform mat4 uProj;
    uniform mat4 uView;
    varying vec3 vColor;
    void main() {
      gl_Position = uProj * uView * vec4(aPos, 1.0);
      vColor = aColor;
    }`;
  const F_LN = `
    precision mediump float;
    varying vec3 vColor;
    void main() { gl_FragColor = vec4(vColor, 0.28); }`;

  const pt = prog(V_PT, F_PT);
  const ln = prog(V_LN, F_LN);
  if (!pt || !ln) return;

  const aPt = {
    pos: gl.getAttribLocation(pt, 'aPos'), col: gl.getAttribLocation(pt, 'aColor'), size: gl.getAttribLocation(pt, 'aSize'),
    proj: gl.getUniformLocation(pt, 'uProj'), view: gl.getUniformLocation(pt, 'uView'), scale: gl.getUniformLocation(pt, 'uScale')
  };
  const aLn = {
    pos: gl.getAttribLocation(ln, 'aPos'), col: gl.getAttribLocation(ln, 'aColor'),
    proj: gl.getUniformLocation(ln, 'uProj'), view: gl.getUniformLocation(ln, 'uView')
  };

  /* ---------- geometry ---------- */
  const N = 170, R = 270, GA = Math.PI * (3 - Math.sqrt(5));
  const nodes = [], nodeCols = [], nodeSizes = [];
  const C = [[0.23, 0.51, 0.96], [0.024, 0.71, 0.83], [0.66, 0.33, 0.97]];
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const rr = Math.sqrt(Math.max(0, 1 - y * y));
    const th = GA * i;
    const c = C[i % 7 === 0 ? 2 : i % 5 === 0 ? 1 : 0];
    nodes.push(Math.cos(th) * rr * R, y * R, Math.sin(th) * rr * R);
    nodeCols.push(c[0], c[1], c[2]);
    nodeSizes.push(i % 7 === 0 ? 11 : i % 5 === 0 ? 9 : 7);
  }
  const bNodes = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bNodes);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nodes), gl.STATIC_DRAW);
  const bNodeCols = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bNodeCols);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nodeCols), gl.STATIC_DRAW);
  const bNodeSizes = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bNodeSizes);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nodeSizes), gl.STATIC_DRAW);

  // edges
  const TH = R * 0.4, lineData = [];
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const dx = nodes[i * 3] - nodes[j * 3], dy = nodes[i * 3 + 1] - nodes[j * 3 + 1], dz = nodes[i * 3 + 2] - nodes[j * 3 + 2];
    if (dx * dx + dy * dy + dz * dz < TH * TH) lineData.push(nodes[i * 3], nodes[i * 3 + 1], nodes[i * 3 + 2], nodes[j * 3], nodes[j * 3 + 1], nodes[j * 3 + 2]);
  }
  const bEdges = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bEdges);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lineData), gl.STATIC_DRAW);
  const edgeCols = new Float32Array(lineData.length / 3 * 3).fill(0.16); // cheap? no—fill once: per vertex
  const bEdgeCols = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bEdgeCols);
  gl.bufferData(gl.ARRAY_BUFFER, edgeCols, gl.STATIC_DRAW);

  // rings (tilt baked in)
  const ringDefs = [
    { r: R * 1.42, tilt: 0.4, c: [0.23, 0.51, 0.96] },
    { r: R * 1.8, tilt: -0.26, c: [0.024, 0.71, 0.83] },
    { r: R * 2.2, tilt: 0.62, c: [0.66, 0.33, 0.97] }
  ];
  const ringData = [], ringCols = [];
  for (const rd of ringDefs) {
    const nPts = 60;
    for (let i = 0; i < nPts; i++) {
      const a0 = (i / nPts) * Math.PI * 2, a1 = ((i + 1) / nPts) * Math.PI * 2;
      for (const a of [a0, a1]) {
        let x = Math.cos(a) * rd.r, y = 0, z = Math.sin(a) * rd.r;
        const t = rd.tilt, ct = Math.cos(t), st = Math.sin(t);
        const y2 = y * ct - z * st, z2 = y * st + z * ct;
        ringData.push(x, y2, z2);
        ringCols.push(rd.c[0], rd.c[1], rd.c[2]);
      }
    }
  }
  const bRings = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bRings);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ringData), gl.DYNAMIC_DRAW);
  const bRingCols = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bRingCols);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ringCols), gl.STATIC_DRAW);

  // stars
  const starData = [], starCols = [], starSizes = [];
  for (let i = 0; i < 260; i++) {
    starData.push(rand(-5200, 5200), rand(-3200, 3200), rand(-4200, -900));
    const v = rand(0.4, 1);
    starCols.push(0.55 * v, 0.72 * v, 1.0 * v);
    starSizes.push(rand(2.5, 7));
  }
  const bStars = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bStars);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(starData), gl.STATIC_DRAW);
  const bStarCols = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bStarCols);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(starCols), gl.STATIC_DRAW);
  const bStarSizes = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bStarSizes);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(starSizes), gl.STATIC_DRAW);

  // pulses (dynamic positions)
  const nPulse = 20;
  const pulses = Array.from({ length: nPulse }, () => ({ e0: (Math.random() * (lineData.length / 6)) | 0, t: Math.random(), v: rand(0.2, 0.6) }));
  const pulseData = new Float32Array(nPulse * 3);
  const pulseCols = new Float32Array(nPulse * 3).fill(1); // white
  const bPulse = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bPulse);
  gl.bufferData(gl.ARRAY_BUFFER, pulseData, gl.DYNAMIC_DRAW);
  const bPulseCols = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bPulseCols);
  gl.bufferData(gl.ARRAY_BUFFER, pulseCols, gl.STATIC_DRAW);

  // shockwave rings (dynamic)
  let waves = [];
  const bWave = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bWave);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(64 * 2 * 3), gl.DYNAMIC_DRAW);
  const waveCols = new Float32Array(64 * 2 * 3);
  for (let i = 0; i < waveCols.length; i += 3) { waveCols[i] = 0.3; waveCols[i + 1] = 0.8; waveCols[i + 2] = 1; }
  const bWaveCols = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bWaveCols);
  gl.bufferData(gl.ARRAY_BUFFER, waveCols, gl.STATIC_DRAW);

  // sats
  const S = 4;
  const satDefs = [
    { a: 0, r: R * 1.15, tilt: 0.14, spd: 0.34, c: [0.23, 0.51, 0.96] },
    { a: 2.2, r: R * 1.6, tilt: -0.32, spd: -0.24, c: [0.024, 0.71, 0.83] },
    { a: 4.1, r: R * 2.0, tilt: 0.44, spd: 0.17, c: [0.66, 0.33, 0.97] }
  ];
  const bSats = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bSats);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(S * 3), gl.DYNAMIC_DRAW);

  /* ---------- camera / matrices ---------- */
  let W = 0, H = 0, DPR = 1, scale = 300;
  const FOV = 62 * Math.PI / 180;
  const proj = new Float32Array(16), view = new Float32Array(16);

  function mat4proj(out, fov, asp, zNear, zFar) {
    const f = 1 / Math.tan(fov / 2);
    out[0] = f / asp; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = (zFar + zNear) / (zNear - zFar); out[11] = -1;
    out[12] = 0; out[13] = 0; out[14] = 2 * zFar * zNear / (zNear - zFar); out[15] = 0;
  }
  function mat4view(out, rotY, rotX, tx, ty, tz) {
    const cy = Math.cos(rotY), sy = Math.sin(rotY), cx = Math.cos(rotX), sx = Math.sin(rotX);
    // inv rotation Rx * Ry, then translate
    const r = [
      cy, 0, -sy, 0,
      sy * sx, cx, cy * sx, 0,
      sy * cx, -sx, cy * cx, 0,
      tx, ty, tz, 1
    ];
    for (let i = 0; i < 16; i++) out[i] = r[i];
  }

  let rotY = 0.5, rotX = -0.22, tRotY = 0.5, tRotX = -0.22, rotVel = 0;
  let mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const scrollState = { y: 0, ty: 0 };
  let t0 = performance.now(), dragging = false, lastX = 0, lastY = 0;

  window.addEventListener('pointerdown', e => {
    if (!fine || reduce) return;
    if (e.isPrimary && e.target.closest && e.target.closest('a,button,.btn,.card,.mail')) return;
    dragging = true; lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('pointermove', e => {
    mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    if (dragging) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      tRotY += dx * 0.0055; tRotX = Math.max(-1.1, Math.min(1.1, tRotX + dy * 0.004));
      rotVel = dx * 0.0012;
    }
  });
  window.addEventListener('pointerup', () => { dragging = false; tRotX += 0; });
  window.addEventListener('pointercancel', () => dragging = false);
  window.addEventListener('scroll', () => scrollState.ty = window.scrollY, { passive: true });

  // shockwave
  document.querySelector('.hero')?.addEventListener('click', e => {
    if (e.target.closest && e.target.closest('a,button,.btn,.iframe')) return;
    const hero = canvas.parentElement.querySelector('.hero');
    const r = hero && hero.getBoundingClientRect();
    const nz = -500, halfW = 420;
    const x = (e.clientX - (r ? r.left : 0)) - (r ? r.width : window.innerWidth) / 2;
    const y = (e.clientY - (r ? r.top : 0)) - (r ? r.height : window.innerHeight) / 2;
    waves.push({ t: 0, x: x * 0.5, y: y * 0.42, v: 26, nz, halfW });
    if (waves.length > 3) waves.shift();
  });

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth * DPR; H = window.innerHeight * DPR;
    canvas.width = W; canvas.height = H;
    gl.viewport(0, 0, W, H);
    scale = H / 2 / Math.tan(FOV / 2);
  }

  function setAttr(buf, loc, size, stride, off) { gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride || 0, off || 0); }

  function drawPoints(progU, count, bP, bC, bSz) {
    gl.useProgram(pt);
    setAttr(bP, progU.pos, 3, 0, 0);
    setAttr(bC, progU.col, 3, 0, 0);
    if (bSz) setAttr(bSz, progU.size, 1, 0, 0); else gl.vertexAttrib1f(progU.size, 8);
    gl.drawArrays(gl.POINTS, 0, count);
  }
  function drawLines(progU, count, bP, bC) {
    gl.useProgram(ln);
    setAttr(bP, progU.pos, 3, 0, 0);
    setAttr(bC, progU.col, 3, 0, 0);
    gl.drawArrays(gl.LINES, 0, count);
  }
  function bindPt() {
    gl.useProgram(pt);
    gl.uniformMatrix4fv(aPt.proj, false, proj);
    gl.uniformMatrix4fv(aPt.view, false, view);
    gl.uniform1f(aPt.scale, scale);
  }
  function bindLn() {
    gl.useProgram(ln);
    gl.uniformMatrix4fv(aLn.proj, false, proj);
    gl.uniformMatrix4fv(aLn.view, false, view);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
    if (!reduce) {
      if (!dragging) rotY += dt * (0.16 + Math.abs(mouse.tx) * 0.18);
      rotVel *= 0.94;
      rotY += (tRotY - rotY) * 0.1 + rotVel;
      rotX += (tRotX - rotX) * 0.1;
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      scrollState.y += (scrollState.ty - scrollState.y) * 0.08;
      for (const p of pulses) { p.t += dt * p.v; if (p.t > 1) { p.t = 0; p.e0 = (Math.random() * (lineData.length / 6)) | 0; p.v = rand(0.2, 0.6); } }
      for (const w of waves) w.t += dt;
    }
    const camZ = -900 - scrollState.y * 0.55;
    mat4proj(proj, FOV, W / H, 1, 9000);
    mat4view(view, rotY, rotX + mouse.y * 0.18, -mouse.x * 60, mouse.y * 40, camZ);

    gl.enable(gl.BLEND);

    // stars (additive glow)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    bindPt();
    drawPoints(aPt, 260, bStars, bStarCols, bStarSizes);

    // rings + node edges (normal alpha)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    bindLn();
    const br = 1 + Math.sin(now * 0.0014) * 0.045;
    const ringNow = new Float32Array(ringData.length);
    for (let i = 0; i < ringData.length; i++) ringNow[i] = ringData[i] * br;
    gl.bindBuffer(gl.ARRAY_BUFFER, bRings);
    gl.bufferData(gl.ARRAY_BUFFER, ringNow, gl.DYNAMIC_DRAW);
    drawLines(aLn, ringData.length / 3, bRings, bRingCols);
    drawLines(aLn, lineData.length / 3, bEdges, bEdgeCols);

    // orbiting satellites
    const sat = new Float32Array(S * 3);
    for (let i = 0; i < satDefs.length; i++) {
      const s = satDefs[i];
      const a = s.a + now * 0.0006 * s.spd / 0.001;
      sat[i * 3] = Math.cos(a) * s.r;
      sat[i * 3 + 1] = 0;
      sat[i * 3 + 2] = Math.sin(a) * s.r;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, bSats);
    gl.bufferData(gl.ARRAY_BUFFER, sat, gl.DYNAMIC_DRAW);
    bindPt();
    setAttr(bSats, aPt.pos, 3, 0, 0);
    gl.vertexAttrib3f(aPt.col, 0.5, 0.9, 1.0);
    gl.vertexAttrib1f(aPt.size, 16);
    gl.drawArrays(gl.POINTS, 0, satDefs.length);

    // globe nodes
    bindPt();
    drawPoints(aPt, N, bNodes, bNodeCols, bNodeSizes);

    // data pulses along edges
    for (let i = 0; i < nPulse; i++) {
      const p = pulses[i];
      const e = p.e0 * 6;
      pulseData[i * 3] = lineData[e] + (lineData[e + 3] - lineData[e]) * p.t;
      pulseData[i * 3 + 1] = lineData[e + 1] + (lineData[e + 4] - lineData[e + 1]) * p.t;
      pulseData[i * 3 + 2] = lineData[e + 2] + (lineData[e + 5] - lineData[e + 2]) * p.t;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, bPulse);
    gl.bufferData(gl.ARRAY_BUFFER, pulseData, gl.DYNAMIC_DRAW);
    bindPt();
    setAttr(bPulse, aPt.pos, 3, 0, 0);
    setAttr(bPulseCols, aPt.col, 3, 0, 0);
    gl.vertexAttrib1f(aPt.size, 26);
    gl.drawArrays(gl.POINTS, 0, nPulse);

    // shockwaves (expanding rings)
    const waveData = new Float32Array(64 * 2 * 3);
    for (let wi = waves.length - 1; wi >= 0; wi--) {
      const w = waves[wi];
      w.x += dt * 30; w.y += dt * 26;
      if (w.t > 5) { waves.splice(wi, 1); continue; }
      const rad = 8 + w.t * 60;
      let k = 0;
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        waveData[k++] = w.x + Math.cos(a) * rad;
        waveData[k++] = w.y + Math.sin(a) * rad;
        waveData[k++] = w.nz;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, bWave);
      gl.bufferData(gl.ARRAY_BUFFER, waveData, gl.DYNAMIC_DRAW);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      bindLn();
      setAttr(bWave, aLn.pos, 3, 0, 0);
      setAttr(bWaveCols, aLn.col, 3, 0, 0);
      gl.drawArrays(gl.LINE_LOOP, 0, 64);
    }

    if (reduce) return;
    requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();
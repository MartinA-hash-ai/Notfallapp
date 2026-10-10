/* ===================================================================== Startbildschirm mit Animation (kleine Lottie-Wiedergabe, offline) */

// Unterstützt genau das, was die Startanimation braucht: Form- und Vorkompositions-Ebenen, Pfade, Ellipsen,
// Füllung, Kontur, Pfad-Trimmen, Gruppen-Transformation und animierte Werte mit Bezier-Easing (auch räumlich).
const Lottie = (() => {
  const SVGNS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); return e; };
  function easing(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = t => ((ax * t + bx) * t + cx) * t, Y = t => ((ay * t + by) * t + cy) * t, dX = t => (3 * ax * t + 2 * bx) * t + cx;
    return x => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) { const e = X(t) - x, d = dX(t); if (Math.abs(e) < 1e-6) return Y(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
      let a = 0, b = 1; t = x;
      for (let i = 0; i < 40; i++) { const v = X(t); if (Math.abs(v - x) < 1e-6) break; if (v < x) a = t; else b = t; t = (a + b) / 2; }
      return Y(t);
    };
  }
  const arr = v => Array.isArray(v) ? v : [v];
  const pick = (v, d) => { const a = arr(v); return a[Math.min(d, a.length - 1)]; };
  // räumliche Bewegung entlang einer Bezier-Kurve, gleichmäßig nach Weglänge
  function spatial(k) {
    if (k._sp) return k._sp;
    const P0 = k.s, P3 = k._next.s, P1 = P0.map((v, i) => v + (k.to[i] || 0)), P2 = P3.map((v, i) => v + (k.ti[i] || 0));
    const pt = t => P0.map((_, i) => (1 - t) ** 3 * P0[i] + 3 * (1 - t) ** 2 * t * P1[i] + 3 * (1 - t) * t * t * P2[i] + t ** 3 * P3[i]);
    const N = 150, pts = [pt(0)], len = [0];
    for (let j = 1; j <= N; j++) { const q = pt(j / N), p = pts[j - 1]; pts.push(q); len.push(len[j - 1] + Math.hypot(q[0] - p[0], q[1] - p[1])); }
    return (k._sp = { pts, len, total: len[N] });
  }
  function value(prop, t) {
    if (!prop) return null;
    if (!prop.a) return prop.k;
    const K = prop.k;
    if (!K._ready) { K.forEach((k, i) => { k._next = K[i + 1]; }); K._ready = true; }
    if (t <= K[0].t) return K[0].s;
    for (let n = 0; n < K.length - 1; n++) {
      const a = K[n], b = K[n + 1];
      if (t >= b.t && n < K.length - 2) continue;
      if (t >= b.t) return b.s;
      if (a.h) return a.s;
      const u = (t - a.t) / (b.t - a.t), s = arr(a.s), e = arr(b.s);
      if (!a._ease) a._ease = s.map((_, d) => easing(pick(a.o.x, d), pick(a.o.y, d), pick(a.i.x, d), pick(a.i.y, d)));
      if (a.to && a.ti && (a.to.some(v => v) || a.ti.some(v => v))) {
        const sp = spatial(a), want = clamp(a._ease[0](u), 0, 1) * sp.total;
        let j = 1; while (j < sp.len.length - 1 && sp.len[j] < want) j++;
        const f = sp.len[j] === sp.len[j - 1] ? 0 : (want - sp.len[j - 1]) / (sp.len[j] - sp.len[j - 1]);
        return sp.pts[j - 1].map((v, i) => v + (sp.pts[j][i] - v) * f);
      }
      const out = s.map((v, d) => v + (e[d] - v) * a._ease[d](u));
      return Array.isArray(a.s) ? out : out[0];
    }
    return K[K.length - 1].s;
  }
  const n0 = v => Array.isArray(v) ? v[0] : v;
  function transform(ks, t) {
    const p = value(ks.p, t) || [0, 0], a = value(ks.a, t) || [0, 0], s = value(ks.s, t) || [100, 100], r = n0(value(ks.r, t)) || 0;
    return `translate(${p[0]},${p[1]}) rotate(${r}) scale(${s[0] / 100},${s[1] / 100}) translate(${-a[0]},${-a[1]})`;
  }
  const opac = (ks, t) => ks && ks.o ? n0(value(ks.o, t)) / 100 : 1;
  const rgb = c => `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
  function pathD(k) {
    const { v, i, o, c } = k; if (!v || !v.length) return '';
    let d = `M${v[0][0]},${v[0][1]}`;
    const seg = (a, b) => { d += `C${v[a][0] + o[a][0]},${v[a][1] + o[a][1]} ${v[b][0] + i[b][0]},${v[b][1] + i[b][1]} ${v[b][0]},${v[b][1]}`; };
    for (let n = 1; n < v.length; n++) seg(n - 1, n);
    if (c) { seg(v.length - 1, 0); d += 'Z'; }
    return d;
  }
  // baut die SVG-Elemente einmal auf und liefert Aktualisierer je Zeitpunkt
  function buildShapes(items, parent, ups, getTime) {
    const paths = items.filter(q => q.ty === 'sh' || q.ty === 'el'), trim = items.find(q => q.ty === 'tm');
    // Reihenfolge wie in Lottie: was zuerst steht, liegt oben → in Listenreihenfolge sammeln, rückwärts einfügen
    const nodes = [];
    for (const it of items) {
      if (it.ty === 'gr') {
        const tr = (it.it || []).find(q => q.ty === 'tr'), ge = el('g');
        if (tr) ups.push(() => { const t = getTime(); ge.setAttribute('transform', transform(tr, t)); ge.setAttribute('opacity', opac(tr, t)); });
        buildShapes(it.it || [], ge, ups, getTime);
        nodes.push(ge);
      } else if (it.ty === 'fl' || it.ty === 'st') for (const ps of paths) nodes.push(styledPath(ps, it, trim, ups, getTime));
    }
    for (const nd of nodes.reverse()) parent.append(nd);
  }
  function styledPath(ps, st, trim, ups, getTime) {
    const e = ps.ty === 'el' ? el('ellipse') : el('path', { d: pathD(ps.ks.a ? ps.ks.k[0].s[0] : ps.ks.k) });
    if (st.ty === 'fl') e.setAttribute('stroke', 'none');
    else { e.setAttribute('fill', 'none'); e.setAttribute('stroke-linecap', ['butt', 'butt', 'round', 'square'][st.lc || 1]); e.setAttribute('stroke-linejoin', ['miter', 'miter', 'round', 'bevel'][st.lj || 1]); }
    if (trim && st.ty === 'st') e.setAttribute('pathLength', '100');
    ups.push(() => {
      const t = getTime();
      if (ps.ty === 'el') { const sz = value(ps.s, t), p = value(ps.p, t); e.setAttribute('cx', p[0]); e.setAttribute('cy', p[1]); e.setAttribute('rx', sz[0] / 2); e.setAttribute('ry', sz[1] / 2); }
      const c = value(st.c, t), o = n0(value(st.o, t)) / 100;
      if (st.ty === 'fl') { e.setAttribute('fill', rgb(c)); e.setAttribute('fill-opacity', o); }
      else { e.setAttribute('stroke', rgb(c)); e.setAttribute('stroke-opacity', o); e.setAttribute('stroke-width', n0(value(st.w, t))); }
      if (trim && st.ty === 'st') {
        const s = n0(value(trim.s, t)), en = n0(value(trim.e, t)), off = (n0(value(trim.o, t)) || 0) / 3.6, a = Math.min(s, en), b = Math.max(s, en);
        if (b - a < 0.01) e.setAttribute('visibility', 'hidden');
        else { e.removeAttribute('visibility'); e.setAttribute('stroke-dasharray', `${b - a} 200`); e.setAttribute('stroke-dashoffset', -(a + off)); }
      }
    });
    return e;
  }
  function buildLayers(layers, assets, parent, ups, getCompTime) {
    for (const L of layers.slice().reverse()) {
      const g = el('g'), lt = getCompTime;                // Schlüsselbilder in Kompositionszeit (wie lottie-web)
      ups.push(() => {
        const ct = getCompTime(), vis = ct >= L.ip && ct < L.op;
        g.setAttribute('display', vis ? 'inline' : 'none');
        if (!vis) return;
        const t = lt();
        g.setAttribute('transform', transform(L.ks, t)); g.setAttribute('opacity', opac(L.ks, t));
      });
      if (L.ty === 4) buildShapes(L.shapes || [], g, ups, lt);
      else if (L.ty === 0) { const asset = assets.find(a => a.id === L.refId); if (asset) buildLayers(asset.layers, assets, g, ups, () => (getCompTime() - (L.st || 0)) / (L.sr || 1)); }
      parent.append(g);
    }
  }
  function load(anim, box) {
    const svg = el('svg', { viewBox: `0 0 ${anim.w} ${anim.h}`, preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' });
    let frame = anim.ip;
    const ups = [];
    buildLayers(anim.layers, anim.assets || [], svg, ups, () => frame);
    box.append(svg);
    const go = f => { frame = f; ups.forEach(u => u()); };
    go(anim.ip);
    return {
      svg, goTo: go,
      play(onDone) {
        const t0 = performance.now(), dur = (anim.op - anim.ip) / anim.fr * 1000;
        const step = now => {
          const f = anim.ip + Math.min(1, (now - t0) / dur) * (anim.op - 1 - anim.ip);
          go(f);
          if (now - t0 < dur && svg.isConnected) requestAnimationFrame(step); else if (onDone) onDone();
        };
        requestAnimationFrame(step);
      },
    };
  }
  return { load };
})();

function showSplash() {
  if (UI.splash === false || typeof SPLASH_ANIM === 'undefined') return;
  if (navigator.webdriver && !window.__splashTest) return;             // automatisierte Tests
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const anim = h('div', { class: 'splash-anim' });
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    box.classList.add('out');
    document.removeEventListener('keydown', close, true);
    setTimeout(() => box.remove(), 450);
  };
  const box = h('div', { class: 'splash', onclick: close, tip: null },
    h('div', { class: 'splash-mid' }, anim, h('img', { class: 'splash-logo', src: logoSrc(), alt: 'Malteser' })),
    h('div', { class: 'splash-ver' }, 'Version ' + APP_INFO.version));
  document.body.append(box);
  document.addEventListener('keydown', close, true);
  const player = Lottie.load(JSON.parse(JSON.stringify(SPLASH_ANIM)), anim);
  if (reduce) { player.goTo(SPLASH_ANIM.op - 1); setTimeout(close, 900); }
  else player.play(() => setTimeout(close, 350));
}

/* =====================================================================
 * Blocos e paredes de fundo na grade fina (32×32 px por bloco).
 * Cada bloco é pintado uma vez (no carregamento ou quando muda) no
 * canvas pré-renderizado: sem transformação, 1 unidade = 1 px.
 * Tudo fica preso à célula (clip) e usa coordenadas locais 0..31.
 * Variação determinística por célula com Pix.hash(tx, ty, n).
 * ===================================================================== */
(function (G) {
  'use strict';
  const A = G.ArtTiles = G.ArtTiles || {};
  const S = 32;

  /* ---------------- utilitários ---------------- */
  // contexto de pintura de uma célula: pintor, vizinhos e hash
  function cell(c, world, tx, ty) {
    const Pix = G.Pix;
    const get = (dx, dy) => world.get(tx + dx, ty + dy);
    const def = (dx, dy) => G.TILES[get(dx, dy)] || G.TILES[0];
    return {
      c, world, tx, ty, p: Pix.painter(c),
      h: (n) => Pix.hash(tx, ty, n),
      get, def,
      solid: (dx, dy) => def(dx, dy).solid,
      // aberto = não sólido e não porta (degraus contam como abertos)
      open: (dx, dy) => { const d = def(dx, dy); return !d.solid && !d.door; },
      bg: (dx, dy) => world.getBg(tx + dx, ty + dy),
    };
  }
  // pinta fn em coordenadas locais, presa à célula
  function inCell(c, tx, ty, fn) {
    c.save();
    c.beginPath(); c.rect(tx * S, ty * S, S, S); c.clip();
    c.translate(tx * S, ty * S);
    try { fn(); } finally { c.restore(); }
  }
  const hx = (a, b, n) => G.Pix.hash(a, b, n);
  const alpha = (c, a, fn) => { c.save(); c.globalAlpha = a; fn(); c.restore(); };

  /** Pedrinha 1–4 px com luz em cima à esquerda e sombra embaixo. */
  function pebble(p, x, y, w, hh, col) {
    const T = G.Pix.tones(col);
    p.rect(x, y, w, hh, T.b);
    p.hline(x, y, w - 1, T.l);
    if (w > 2 && hh > 1) p.px(x, y, T.h);
    p.hline(x + 1, y + hh, w - 1, T.d2);
    if (hh > 1) p.vline(x + w - 1, y + 1, hh - 1, T.d);
  }

  /* ---------------- terra ---------------- */
  const DIRT = '#6e4a2e';
  let GROUND = null; // tipos que contam como chão para a profundidade
  // quantos blocos de chão há acima (para escurecer com a profundidade)
  function depthOf(k) {
    const T = G.T;
    GROUND = GROUND || new Set([T.DIRT, T.STONE, T.GRASS, T.ASPHALT, T.SIDEWALK, T.GRAVEL, T.CONCRETE, T.MANHOLE]);
    let d = 0;
    for (let i = 1; i <= 4; i++) { if (GROUND.has(k.get(0, -i))) d++; else break; }
    return d;
  }
  function dirtBody(k, y0, depth) {
    const { p, h } = k, M = G.Pix.mix;
    // faixas de 8 px que escurecem devagar com a profundidade
    for (let b = 0; b < 4; b++) {
      const yy = b * 8;
      if (yy + 8 <= y0) continue;
      const f = Math.min(0.42, (depth * 32 + yy) / 128 * 0.3);
      p.rect(0, Math.max(y0, yy), S, yy + 8 - Math.max(y0, yy), M(DIRT, '#24161f', f));
    }
    const base = M(DIRT, '#24161f', Math.min(0.42, depth * 0.075 + 0.04));
    const T = G.Pix.tones(base);
    // torrões: mancha escura com borda de luz em cima
    const Dm = G.Pix.mix(T.b, T.d, 0.7);
    for (let i = 0; i < 4; i++) {
      const x = Math.floor(h(10 + i) * 27), y = y0 + 2 + Math.floor(h(30 + i) * (28 - y0));
      const w = 3 + Math.floor(h(50 + i) * 3);
      p.rect(x, y, w, 2, Dm); p.px(x + w - 1, y + 1, T.d);
      p.hline(x + 1, y - 1, w - 2, T.l);
    }
    // grãos claros
    { const x = Math.floor(h(90) * 30), y = y0 + 1 + Math.floor(h(100) * (29 - y0)); p.hline(x, y, 3, T.l); p.hline(x + 1, y + 1, 2, T.d); }
    // estrias horizontais (camadas)
    if (h(5) > 0.5) { const y = y0 + 4 + Math.floor(h(6) * Math.max(1, 24 - y0)); p.hline(Math.floor(h(7) * 12), y, 8 + Math.floor(h(8) * 12), T.d); }
    // pedrinhas cinzas (poucas e maiores)
    const nPeb = h(110) > 0.72 ? 1 : 0;
    for (let i = 0; i < nPeb; i++) {
      const x = 1 + Math.floor(h(120 + i) * 25), y = y0 + 2 + Math.floor(h(130 + i) * Math.max(1, 25 - y0));
      pebble(p, x, y, 4 + Math.floor(h(140 + i) * 3), 3, ['#857b70', '#94897a', '#766d64'][Math.floor(h(145) * 3)]);
    }
    // raiz fina perto da superfície
    if (depth <= 1 && h(160) > 0.8) {
      let x = Math.floor(h(161) * 20), y = y0 + 2 + Math.floor(h(162) * 6);
      for (let s = 0; s < 6; s++) { const w = 2 + Math.floor(h(163 + s) * 3); p.hline(x, y, w, '#8d6842'); p.hline(x, y + 1, w, T.d2); x += w; y += h(170 + s) > 0.5 ? 1 : 0; if (y > 30) break; }
    }
  }
  function drawDirt(k) {
    const d = depthOf(k);
    const top = k.open(0, -1);
    dirtBody(k, 0, d);
    if (top) { // terra exposta: borda clara e irregular
      const T = G.Pix.tones(DIRT);
      k.p.hline(0, 0, S, T.l);
      for (let x = 0; x < S; x += 3) if (k.h(200 + x) > 0.5) k.p.hline(x, 1, 2, T.l);
    }
  }

  /* ---------------- pedra ---------------- */
  function drawStone(k) {
    const { p, h } = k, M = G.Pix.mix;
    const depth = Math.max(0, k.ty - 42);
    const base = M('#666a70', '#2a2a36', Math.min(0.3, depth * 0.05));
    const T = G.Pix.tones(base);
    p.rect(0, 0, S, S, T.b);
    p.clusters(0, 0, S, S, T.d, 7, 3, k.tx * 23 + k.ty * 5);
    // pedras angulosas encaixadas: sombra, borda de luz e corpo
    const spots = [[9, 9], [24, 10], [9, 25], [24, 25]];
    for (let i = 0; i < 4; i++) {
      if (h(48 + i) > 0.8) continue;
      const cx = spots[i][0] + Math.floor(h(30 + i) * 5) - 2, cy = spots[i][1] + Math.floor(h(40 + i) * 5) - 2;
      const rx = 5 + h(10 + i) * 3, ry = 4 + h(20 + i) * 2.5;
      const pts = [];
      for (let v = 0; v < 6; v++) { const a = v / 6 * Math.PI * 2 + h(80 + i) , r = 0.75 + hx(k.tx * 4 + i, k.ty * 6 + v, 3) * 0.35; pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]); }
      const col = M(base, h(50 + i) > 0.5 ? '#80786a' : '#5c6478', 0.15 + h(60 + i) * 0.2);
      const R = G.Pix.tones(col);
      const sh = (dx, dy) => pts.map((q) => [q[0] + dx, q[1] + dy]);
      p.poly(sh(1, 2), T.d2);
      p.poly(pts, R.l);
      p.poly(sh(1, 1), R.d);
      p.poly(sh(0.5, 0.5).map((q) => [cx + (q[0] - cx) * 0.8, cy + (q[1] - cy) * 0.8]), R.b);
      p.px(Math.round(cx - rx * 0.4), Math.round(cy - ry * 0.5), R.h);
    }
    // rachadura ocasional
    if (h(70) > 0.82) {
      let x = 4 + Math.floor(h(71) * 20), y = 1;
      for (let s = 0; s < 4; s++) { const nx = x + (h(72 + s) > 0.5 ? 2 : -2); p.line(x, y, nx, y + 3, T.o); x = nx; y += 3; }
    }
    // bolsões de terra na transição terra → pedra
    if (k.get(0, -1) === G.T.DIRT) {
      const D = G.Pix.tones(M(DIRT, '#24161f', 0.36));
      for (let x = 0; x < S; x += 4) {
        const hh = 1 + Math.floor(hx(k.tx * 8 + x / 4, k.ty, 3) * 5);
        p.rect(x, 0, 4, hh, D.b); p.hline(x, hh, 4, D.d2);
      }
    }
  }
  function drawBedrock(k) {
    const { p, h } = k;
    const T = G.Pix.tones('#2b2c30');
    p.rect(0, 0, S, S, T.b);
    // facetas angulosas
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(h(i) * 26), y = Math.floor(h(i + 10) * 26), s = 5 + Math.floor(h(i + 20) * 6);
      p.poly([[x, y + s], [x + s / 2, y], [x + s, y + s * 0.7]], i % 2 ? T.l : T.d);
      p.line(x, y + s, x + s / 2, y, T.h);
    }
    p.clusters(0, 0, S, S, T.d2, 6, 3, k.tx * 31 + k.ty);
  }

  /* ---------------- cascalho (terreno baldio) ---------------- */
  const GRAVEL_COLS = ['#958b7c', '#7d7466', '#a89d8b', '#6b6356', '#8a8070'];
  function drawGravel(k) {
    const { p, h, tx } = k;
    const top = k.open(0, -1);
    const T = G.Pix.tones('#7d7466');
    p.rect(0, 0, S, S, T.b);
    p.rect(0, 22, S, 10, G.Pix.mix(T.b, T.d, 0.5));
    // pedriscos espaçados em fileiras desencontradas (coordenadas do mundo)
    for (let y = 1, r = 0; y < 30; y += 5, r++) {
      const wy = k.ty * 7 + r;
      for (let wx = tx * S - 8 + ((r % 2) * 3); wx < tx * S + S; wx += 7) {
        const q = hx(wx, wy, 1);
        if (q < 0.25) continue;
        const x = wx - tx * S + Math.floor(hx(wx, wy, 2) * 3), yy = y + Math.floor(hx(wx, wy, 3) * 2);
        const w = 3 + Math.floor(hx(wx, wy, 4) * 3), hh = 2 + (q > 0.6 ? 1 : 0);
        pebble(p, x, yy, w, hh, GRAVEL_COLS[Math.floor(hx(wx, wy, 5) * 5)]);
      }
    }
    // grãos miúdos em grupinhos
    p.clusters(0, 0, S, S, T.d, 6, 2, tx * 19 + k.ty);
    if (top) {
      p.hline(0, 0, S, T.h); p.hline(0, 1, S, T.l);
      // tufo de mato
      if (h(600) > 0.5) {
        const x = 3 + Math.floor(h(601) * 24);
        const Gr = G.Pix.tones('#6a9a40');
        for (let b = -3; b <= 3; b++) { const hh = 6 - Math.abs(b) - Math.floor(h(610 + b + 3) * 2); p.vline(x + b, 7 - hh, hh, b % 2 ? Gr.d : Gr.b); p.px(x + b, 7 - hh, Gr.l); }
        p.hline(x - 3, 7, 7, Gr.d2);
      }
    }
  }

  /* ---------------- grama da praça ---------------- */
  function drawGrass(k) {
    const { p, h } = k;
    if (!k.open(0, -1)) { dirtBody(k, 0, depthOf(k)); return; }
    dirtBody(k, 8, 0);
    const G0 = '#4f9a3a', T = G.Pix.tones(G0);
    // franja escura irregular por baixo
    for (let x = 0; x < S; x += 2) {
      const d = 9 + Math.floor(hx(k.tx * 16 + x / 2, 7, 2) * 4);
      p.rect(x, 6, 2, d - 6, T.d); p.rect(x, d, 2, 1, T.d2);
      if (hx(k.tx * 16 + x / 2, 8, 2) > 0.6) p.rect(x, d + 1, 1, 1, T.d2);
    }
    p.rect(0, 1, S, 7, T.b);
    p.rect(0, 1, S, 2, T.l);
    // tufos escuros verticais (lâminas)
    for (let i = 0; i < 10; i++) { const x = Math.floor(h(20 + i) * 31); p.vline(x, 3 + Math.floor(h(40 + i) * 3), 2 + Math.floor(h(60 + i) * 2), T.d); }
    for (let i = 0; i < 6; i++) { const x = Math.floor(h(80 + i) * 31); p.vline(x, 3 + Math.floor(h(90 + i) * 2), 2, T.l); }
    // lâminas no topo (só a linha 0 fica com recortes)
    for (let x = 0; x < S; x++) {
      const r = hx(k.tx * 32 + x, 11, 4);
      if (r > 0.45) p.px(x, 0, r > 0.8 ? T.h : T.l);
      if (r > 0.88) p.px(x, 1, T.h);
    }
    // florzinhas
    if (h(100) > 0.6) { const x = 2 + Math.floor(h(101) * 27); const col = ['#f4e36b', '#ffffff', '#f29bb8'][Math.floor(h(102) * 3)]; p.px(x, 1, col); p.px(x, 2, T.d2); }
    if (h(103) > 0.8) { const x = 2 + Math.floor(h(104) * 27); p.px(x, 2, '#ffffff'); p.px(x, 3, T.d2); }
  }

  /* ---------------- asfalto ---------------- */
  function asphaltBody(k, y0, y1) {
    const { p, h } = k;
    const T = G.Pix.tones('#3a3d42');
    p.rect(0, y0, S, y1 - y0, T.b);
    // agregado em grupinhos
    for (let i = 0; i < 16; i++) {
      const x = Math.floor(h(10 + i) * 30), y = y0 + Math.floor(h(30 + i) * (y1 - y0 - 1));
      if (i % 3 === 0) { p.hline(x, y, 2, '#55585e'); p.px(x + 1, y + 1, '#2a2c30'); }
      else if (i % 3 === 1) p.rect(x, y, 2, 1, '#33363b');
      else { p.px(x, y, '#4a4d53'); }
    }
    for (let i = 0; i < 3; i++) { const x = Math.floor(h(60 + i) * 30), y = y0 + Math.floor(h(70 + i) * (y1 - y0 - 2)); p.px(x, y, '#6a6d72'); p.px(x + 1, y, '#4a4d53'); p.px(x, y + 1, '#26282c'); }
  }
  function drawAsphalt(k) {
    const { p, h } = k;
    const top = k.open(0, -1);
    if (!top) { asphaltBody(k, 0, S); return; }
    asphaltBody(k, 0, 24);
    // remendo
    if (h(200) > 0.78) { const x = 2 + Math.floor(h(201) * 14), w = 8 + Math.floor(h(202) * 8); p.rect(x, 4, w, 10, '#323539'); p.hline(x, 4, w, '#45484d'); p.vline(x + w, 4, 11, '#2a2c30'); p.hline(x, 14, w, '#2a2c30'); }
    // rachadura em zigue-zague
    if (h(210) > 0.86) {
      let x = 3 + Math.floor(h(211) * 24), y = 2;
      for (let s = 0; s < 5; s++) { const nx = x + (h(212 + s) > 0.5 ? 2 : -2); p.line(x, y, nx, y + 2, '#1f2125'); p.px(nx + 1, y + 2, '#4c4f55'); x = nx; y += 2; }
      p.line(x, y, x + 3, y + 1, '#1f2125');
    }
    // borda superior gasta e trilha de pneu
    p.hline(0, 0, S, '#5b5f66'); p.hline(0, 1, S, '#4a4e54');
    if ((k.tx + Math.floor(h(220) * 2)) % 3 !== 0) p.rect(0, 2, S, 2, '#42454b');
    // mancha de óleo
    if (h(230) > 0.8) { alpha(k.c, 0.5, () => p.ellipse(8 + Math.floor(h(231) * 16), 3, 6, 1.5, '#1c1d22')); }
    // base de brita compactada
    p.hline(0, 24, S, '#24262a');
    p.rect(0, 25, S, 7, '#55493f');
    for (let x = 0; x < S; x += 3) pebble(p, x + Math.floor(h(240 + x) * 2), 26 + Math.floor(h(280 + x) * 3), 2, 2, h(320 + x) > 0.5 ? '#7a6e60' : '#665b4f');
  }
  function drawManhole(k) {
    const { p } = k;
    drawAsphalt(k);
    // tampa de ferro fundido vista de lado + aro
    p.rect(2, 0, 28, 6, '#3d4045');
    p.rect(3, 0, 26, 4, '#26282b'); p.hline(3, 0, 26, '#4b4f54');
    for (let x = 5; x < 28; x += 3) { p.px(x, 1, '#5a5e64'); p.px(x + 1, 2, '#1a1b1e'); }
    p.hline(2, 6, 28, '#1c1d20');
    // poço escuro com anel de concreto
    p.rect(6, 7, 20, 17, '#56595e'); p.vline(6, 7, 17, '#6a6d72'); p.rect(9, 7, 14, 17, '#1d1e22'); p.hline(9, 7, 14, '#111214');
    for (let y = 10; y < 24; y += 5) { p.hline(11, y, 10, '#6b6f75'); p.hline(11, y + 1, 10, '#2c2e32'); } // degraus de ferro
    p.hline(6, 24, 20, '#2a2c30');
  }

  /* ---------------- calçada ---------------- */
  function drawSidewalk(k) {
    const { p, h, tx } = k;
    const top = k.open(0, -1);
    const T = G.Pix.tones('#a9a59c');
    p.rect(0, 0, S, S, T.b);
    let y0 = 0;
    if (top) {
      // pedra portuguesa: mosaico em ondas preto e branco
      p.rect(0, 0, S, 7, '#8f8b83');
      for (let row = 0; row < 3; row++) {
        const off = row % 2 ? 1 : 0;
        for (let x = -off; x < S; x += 3) {
          const wx = tx * S + x;
          const wave = 1 + Math.sin(wx / 9) * 1.4;
          const black = Math.abs(row - wave) < 0.8;
          const col = black ? (hx(wx, row, 3) > 0.5 ? '#45433f' : '#3a3936') : (hx(wx, row, 4) > 0.5 ? '#e8e4da' : '#d8d3c7');
          p.rect(x, row * 2, 2, 1, col);
          p.px(x, row * 2 + 1, black ? '#2c2b29' : '#bdb8ad');
        }
      }
      p.hline(0, 6, S, '#76726a');
      y0 = 7;
    } else p.hline(0, 0, S, T.d);
    // laje de concreto com junta por bloco
    p.hline(0, y0, S, T.l);
    p.vline(31, y0, S - y0, T.d2); p.vline(0, y0 + 1, S - y0, T.l);
    for (let i = 0; i < 7; i++) { const x = 1 + Math.floor(h(10 + i) * 28), y = y0 + 2 + Math.floor(h(20 + i) * (28 - y0)); p.hline(x, y, 2, i % 2 ? T.d : T.l); }
    if (h(40) > 0.7) { const x = 4 + Math.floor(h(41) * 22); p.rect(x, y0 + 1, 3, 2, T.d); p.hline(x, y0 + 3, 3, T.l); } // lasca
    p.rect(1, 28, 30, 4, G.Pix.mix(T.b, T.d, 0.5)); p.hline(0, 31, S, T.d2);
  }

  /* ---------------- concreto, laje e piso de madeira ---------------- */
  function concreteBody(k, y0, top) {
    const { p, h } = k;
    const T = G.Pix.tones('#8d9095');
    p.rect(0, y0, S, S - y0, T.b);
    // marcas de fôrma (tábuas) com emendas desencontradas
    for (const [yy, n] of [[y0 + 9, 1], [y0 + 18, 2]]) {
      if (yy >= 29) continue;
      const cut = 4 + Math.floor(h(n * 7) * 24);
      p.hline(0, yy, cut, G.Pix.mix(T.b, T.d, 0.45)); p.hline(cut + 1, yy, S - cut - 1, G.Pix.mix(T.b, T.d, 0.45));
      p.hline(0, yy + 1, S, G.Pix.mix(T.b, T.l, 0.3));
    }
    // furos dos tirantes
    if ((k.tx % 2 === 0) && y0 < 12) { const y = Math.min(26, y0 + 13); p.rect(15, y, 2, 2, T.d2); p.px(17, y + 1, T.l); p.hline(15, y + 2, 2, T.l); }
    // poros e manchas em grupinhos
    for (let i = 0; i < 6; i++) { const x = Math.floor(h(20 + i) * 30), y = y0 + 1 + Math.floor(h(30 + i) * (28 - y0)); p.px(x, y, T.d); p.px(x + 1, y, G.Pix.mix(T.b, T.d, 0.5)); }
    // escorridos verticais
    for (let i = 0; i < 2; i++) if (h(40 + i) > 0.55) { const x = 2 + Math.floor(h(42 + i) * 28); p.vline(x, y0 + 1, 4 + Math.floor(h(44 + i) * 9), G.Pix.mix(T.b, T.d, 0.35)); }
    if (top) { p.hline(0, y0, S, T.h); p.hline(0, y0 + 1, S, T.l); }
    else p.hline(0, y0, S, G.Pix.mix(T.b, T.d, 0.5));
    p.hline(0, 30, S, G.Pix.mix(T.b, T.d, 0.6)); p.hline(0, 31, S, T.d);
  }
  function drawConcrete(k) { concreteBody(k, 0, k.open(0, -1)); }
  const WOODS = ['#a8713e', '#b07a46', '#9c6838'];
  function drawWood(k) {
    const { p, tx } = k;
    concreteBody(k, 10, false);
    p.rect(0, 8, S, 2, '#4f3522'); p.hline(0, 10, S, '#6b6e72');
    // tábuas de comprimento variado (emendas em coordenadas do mundo)
    const joints = [];
    for (let x = 0; x < S; x++) { const wx = tx * S + x; if (hx(Math.floor(wx / 6), 3, 9) > 0.78 && wx % 6 === 0) joints.push(x); }
    let start = 0;
    const segs = [];
    for (const j of joints.concat([S])) { if (j > start) segs.push([start, j]); start = j; }
    for (const [a, b] of segs) {
      const id = Math.floor((tx * S + a) / 6);
      const T = G.Pix.tones(WOODS[Math.floor(hx(id, 5, 2) * 3)]);
      p.rect(a, 0, b - a, 8, T.b);
      p.hline(a, 0, b - a, T.h); p.hline(a, 1, b - a, T.l);
      p.hline(a, 7, b - a, T.d);
      // veio em traços
      for (let g = 0; g < 3; g++) {
        const gx = a + Math.floor(hx(id, g, 7) * Math.max(1, b - a - 4)), gy = 3 + g + (g === 2 ? -2 : 0);
        p.hline(gx, gy, 3 + Math.floor(hx(id, g, 8) * 4), T.d);
      }
      if (hx(id, 9, 9) > 0.6) { const kx = a + 2 + Math.floor(hx(id, 9, 10) * Math.max(1, b - a - 5)); p.rect(kx, 3, 2, 2, T.d2); p.px(kx, 2, T.d); } // nó
    }
    for (const j of joints) { p.vline(j, 0, 8, '#5c3b1c'); p.px(j + 1, 0, '#d39a62'); p.px(j - 2, 3, '#4f3522'); p.px(j + 2, 3, '#4f3522'); }
  }
  function drawRoof(k) {
    const { p, h } = k;
    concreteBody(k, 7, false);
    const top = k.open(0, -1);
    const M = G.Pix.tones('#4a4a4f');
    // manta impermeabilizante com grãos
    p.rect(0, 0, S, 7, M.b);
    if (top) { p.hline(0, 0, S, '#6a6a71'); p.hline(0, 1, S, M.l); }
    p.clusters(0, 2, S, 4, M.d, 7, 2, k.tx * 13 + 1);
    p.clusters(0, 2, S, 4, M.l, 5, 2, k.tx * 13 + 2);
    p.hline(0, 6, S, M.d2);
    // pingadeira e manchas escorridas da manta
    for (let i = 0; i < 3; i++) if (h(60 + i) > 0.5) { const x = Math.floor(h(63 + i) * 30); p.vline(x, 7, 2 + Math.floor(h(66 + i) * 6), '#6f7176'); }
  }
  function drawTileF(k) {
    const { p, h } = k;
    const T = G.Pix.tones('#e8e8e2');
    p.rect(0, 0, S, S, '#c9c9c2');
    for (const [x, y] of [[0, 0], [16, 0], [0, 16], [16, 16]]) {
      const v = h(x + y) > 0.5 ? T.b : G.Pix.mix(T.b, '#dcdcd4', 0.6);
      p.rect(x, y, 15, 15, v);
      p.hline(x, y, 15, T.h); p.vline(x, y, 15, T.l);
      p.hline(x + 1, y + 14, 14, G.Pix.mix(T.b, T.d, 0.4)); p.vline(x + 14, y + 1, 14, G.Pix.mix(T.b, T.d, 0.4));
      p.line(x + 3, y + 6, x + 6, y + 3, '#ffffff'); p.px(x + 3, y + 3, '#ffffff');
    }
    p.hline(0, 0, S, '#f7f7f2');
    p.hline(0, 31, S, '#b5b5ad');
  }

  /* ---------------- tijolo ---------------- */
  const BRICK_FG = { cols: ['#9c4a35', '#b25a42', '#a5513b', '#8e4230'], mortar: '#cdbca6' };
  const BRICK_BG = { cols: ['#6e3426', '#7c3d2d', '#743829', '#673022'], mortar: '#8f8170' };
  function brickWall(k, pal, y0) {
    const { p, tx, ty } = k;
    const Mo = G.Pix.tones(pal.mortar);
    p.rect(0, y0, S, S - y0, Mo.b);
    for (let r = 0; r < 4; r++) {
      const wy = ty * 4 + r, yy = r * 8;
      if (yy + 8 <= y0) continue;
      const off = wy % 2 ? 8 : 0;
      for (let bx = -1; bx < 3; bx++) {
        const wx0 = tx * S + bx * 16 + off;              // início do tijolo no mundo
        const id = Math.floor((wx0 - off) / 16);
        const T = G.Pix.tones(pal.cols[Math.floor(hx(id, wy, 7) * pal.cols.length)]);
        const x = wx0 - tx * S, top = Math.max(y0, yy);
        p.rect(x, top, 15, yy + 7 - top, T.b);
        if (top === yy) p.hline(x, yy, 14, T.l);
        p.vline(x, top, yy + 7 - top, T.l);
        p.hline(x + 1, yy + 6, 14, T.d); p.vline(x + 14, top + 1, yy + 6 - top, T.d);
        // textura do tijolo: grupinho escuro e claro
        const r1 = hx(id, wy, 9);
        p.rect(x + 3 + Math.floor(r1 * 8), yy + 2 + Math.floor(hx(id, wy, 10) * 3), 2, 1, T.d);
        if (r1 > 0.5) p.px(x + 2 + Math.floor(hx(id, wy, 11) * 10), yy + 2, T.h);
        if (hx(id, wy, 12) > 0.85) { p.px(x + 13, yy, Mo.b); p.px(x + 14, yy, Mo.b); p.px(x + 14, yy + 1, Mo.b); } // canto lascado
        // sombra da argamassa sob o tijolo
        p.hline(x + 1, yy + 7, 15, Mo.d);
      }
    }
  }
  function drawBrick(k) {
    const { p } = k;
    const top = k.open(0, -1);
    brickWall(k, BRICK_FG, top ? 5 : 0);
    if (top) { // pingadeira de concreto no topo do muro
      const T = G.Pix.tones('#b9b4aa');
      p.rect(0, 0, S, 5, T.b); p.hline(0, 0, S, T.h); p.hline(0, 1, S, T.l); p.hline(0, 4, S, T.d2); p.hline(0, 3, S, T.d);
    }
    // quinas: luz no lado esquerdo exposto, sombra no direito
    if (k.open(-1, 0)) alpha(k.c, 0.25, () => p.rect(0, 0, 1, S, '#fff4dc'));
    if (k.open(1, 0)) alpha(k.c, 0.3, () => p.rect(31, 0, 1, S, '#1a1230'));
  }

  /* ---------------- janela, grade, tapume, patamar ---------------- */
  function drawGlass(k) {
    const { p, c } = k;
    const F = G.Pix.tones('#d5d9dc');
    // vidro azul em bandas, levemente transparente
    alpha(c, 0.72, () => p.bands(3, 3, 26, 24, '#a9d0ea', '#5f8fb5', 4));
    alpha(c, 0.45, () => { p.line(6, 13, 13, 6, '#ffffff'); p.line(6, 16, 16, 6, '#ffffff'); p.line(19, 24, 26, 17, '#ffffff'); });
    // caixilho
    p.rect(0, 0, S, 3, F.b); p.rect(0, 0, 3, 28, F.b); p.rect(29, 0, 3, 28, F.b);
    p.hline(0, 0, S, F.h); p.vline(0, 0, 28, F.l); p.vline(31, 0, 28, F.d); p.hline(3, 3, 26, F.d2);
    p.vline(3, 3, 24, F.d);
    p.rect(15, 3, 2, 24, F.b); p.vline(16, 3, 24, F.d);
    // peitoril
    p.rect(0, 27, S, 5, F.l); p.hline(0, 27, S, F.h); p.hline(0, 30, S, F.d); p.hline(0, 31, S, F.d2);
  }
  function drawRail(k) {
    const { p, tx } = k;
    const T = G.Pix.tones('#2f3439');
    p.rect(0, 4, S, 3, T.b); p.hline(0, 4, S, T.h); p.hline(0, 5, S, T.l); p.hline(0, 7, S, T.o);
    p.rect(0, 27, S, 2, T.b); p.hline(0, 27, S, T.l);
    for (let x = 0; x < S; x++) {
      const wx = tx * S + x;
      if (wx % 6 === 1) { p.rect(x, 7, 2, 20, T.b); p.vline(x, 8, 19, T.l); }
    }
    if (k.solid(0, 1)) { p.rect(0, 29, S, 3, T.d); p.hline(0, 29, S, T.b); }
  }
  function drawFence(k) {
    const { p, h, tx, ty, c } = k;
    const top = k.open(0, -1);
    const cols = ['#8b6a3e', '#94723f', '#82633a', '#8f6c40'];
    for (let b = 0; b < 4; b++) {
      const wb = tx * 4 + b, T = G.Pix.tones(cols[Math.floor(hx(wb, 1, 3) * 4)]);
      const x = b * 8, y0 = top ? (hx(wb, 2, 3) > 0.5 ? 1 : 0) : 0;
      p.rect(x, y0, 8, S - y0, T.b);
      p.vline(x, y0, S - y0, T.l); p.vline(x + 7, y0, S - y0, T.d2); p.vline(x + 6, y0, S - y0, T.d);
      // veio vertical
      for (let g = 0; g < 2; g++) { const gx = x + 2 + Math.floor(hx(wb, ty * 3 + g, 4) * 3), gy = Math.floor(hx(wb, ty * 3 + g, 5) * 22); p.vline(gx, gy, 4 + Math.floor(hx(wb, ty, 6 + g) * 6), T.d); }
      // pregos
      if ((wb + ty) % 3 === 0) { p.px(x + 3, 4, T.o); p.px(x + 3, 3, T.h); p.px(x + 3, 26, T.o); p.px(x + 3, 25, T.h); }
      if (top) { p.hline(x, y0, 7, T.h); p.hline(x, y0 + 1, 7, T.l); }
    }
    // cartaz rasgado ou pichação
    const r = h(50);
    if (!top && r > 0.9) {
      const pc = ['#e9d8a6', '#c0504d', '#6a8caf'][Math.floor(h(51) * 3)];
      const T = G.Pix.tones(pc);
      p.rect(7, 6, 16, 19, T.b); p.hline(7, 6, 16, T.l); p.rect(9, 9, 12, 5, T.d); p.rect(9, 16, 9, 1, T.d2); p.rect(9, 18, 11, 1, T.d2); p.rect(9, 20, 7, 1, T.d2);
      p.rect(20, 22, 3, 3, cols[0]); p.rect(7, 23, 2, 2, cols[0]); p.px(22, 6, cols[0]);
      alpha(c, 0.35, () => p.rect(7, 6, 16, 19, '#8b6a3e'));
    } else if (!top && r > 0.8 && k.get(0, 1) === G.T.FENCE) {
      const pc = ['#4fa3d8', '#e05a8a', '#f2f2f2'][Math.floor(h(52) * 3)];
      let x = 4, y = 14 + Math.floor(h(53) * 6);
      for (let s = 0; s < 8; s++) { const nx = x + 2 + Math.floor(h(60 + s) * 2), ny = y + (s % 2 ? -4 : 3); p.line(x, y, nx, ny, pc); x = nx; y = ny; }
      p.line(4, y + 6, 22, y + 5, pc);
    }
    // sujeira de lama na base
    if (k.solid(0, 1) && k.get(0, 1) !== G.T.FENCE) { alpha(c, 0.35, () => p.rect(0, 26, S, 6, '#3f2a1c')); p.clusters(0, 24, S, 4, '#6e5230', 5, 2, tx * 7); }
  }
  function drawPlatform(k) {
    const { p } = k;
    const T = G.Pix.tones('#8a5a2b');
    p.rect(0, 0, S, 6, T.b); p.hline(0, 0, S, T.h); p.hline(0, 1, S, T.l); p.hline(0, 5, S, T.d2);
    p.hline(6, 3, 5, T.d); p.hline(19, 2, 6, T.d);
    for (const x of [4, 24]) { p.rect(x, 6, 4, 8, T.d); p.vline(x, 6, 8, T.b); p.line(x + 1, 13, x + 4, 6, T.d2); p.px(x + 1, 7, T.o); }
  }

  /* ---------------- escadas ---------------- */
  function drawStair(k, left) {
    const { p } = k;
    const T = G.Pix.tones('#8a5a32');
    for (let i = 0; i < 8; i++) {
      const sx = (left ? i : 7 - i) * 4, sy = i * 4;          // degrau i: 4 px de piso, 4 de espelho
      const hh = Math.min(12, S - sy);
      p.rect(sx, sy, 4, hh, '#6d4a2a');                     // espelho / longarina
      p.rect(sx, sy + 3, 4, hh - 3, T.d);
      p.hline(sx, sy, 4, '#cf9a5e'); p.hline(sx, sy + 1, 4, '#b07a44'); // piso com quina clara
      p.hline(sx, sy + 2, 4, '#5a3b1f');
      if (sy + 11 < S) p.hline(sx, sy + 11, 4, '#3f2914');
      p.px(left ? sx : sx + 3, sy + 1, '#e2b47a');           // brilho do bocel
    }
    // longarina: faixa lateral sob os degraus
    for (let i = 0; i < 8; i++) {
      const sx = (left ? i : 7 - i) * 4, sy = i * 4 + 7;
      if (sy + 4 < S) { p.rect(sx, sy, 4, 3, '#4f3522'); p.hline(sx, sy, 4, '#7a5432'); }
    }
  }
  function drawStairF(k) {
    const { p } = k;
    p.rect(0, 0, S, 8, '#6d4a2a');
    p.hline(0, 0, S, '#cf9a5e'); p.hline(0, 1, S, '#b07a44'); p.hline(0, 2, S, '#5a3b1f');
    p.hline(5, 4, 6, '#5a3b1f'); p.hline(18, 5, 8, '#5a3b1f');
    p.hline(0, 7, S, '#3f2914');
    // pilarete de apoio
    p.rect(2, 8, 4, 24, '#4b311a'); p.vline(2, 8, 24, '#6d4a2a'); p.vline(5, 8, 24, '#33210f');
    p.line(6, 18, 14, 8, '#4b311a'); p.line(6, 19, 15, 8, '#33210f');
  }

  /* ---------------- portas (2 blocos de altura) ---------------- */
  // desenha a porta inteira em coordenadas da porta (oy = -32 na metade de baixo)
  function drawDoor(k, t) {
    const { p, c } = k;
    const T0 = G.T, top = k.get(0, -1) !== t;
    const oy = top ? 0 : -S;
    const J = G.Pix.tones('#5e4029');
    c.translate(0, oy);
    // batentes e verga
    p.rect(1, 0, 4, 64, J.b); p.vline(1, 0, 64, J.l); p.vline(4, 3, 61, J.d2);
    p.rect(27, 0, 4, 64, J.b); p.vline(27, 3, 61, J.d); p.vline(30, 0, 64, J.d2);
    p.rect(1, 0, 30, 4, J.b); p.hline(1, 0, 30, J.h); p.hline(1, 1, 30, J.l); p.hline(5, 3, 22, J.d2);
    if (t === T0.DOOR_C) {
      const D = G.Pix.tones('#8f6343');
      p.rect(5, 4, 22, 60, D.b);
      p.vline(5, 4, 60, D.l); p.vline(26, 4, 60, D.d);
      // almofadas rebaixadas
      for (const [y, hh] of [[9, 20], [34, 24]]) {
        p.rect(9, y, 14, hh, D.d); p.rect(10, y + 1, 13, hh - 1, D.l); p.rect(10, y + 1, 12, hh - 2, '#9a6d4b');
        p.vline(14, y + 3, hh - 7, D.b); p.vline(18, y + 5, hh - 9, D.b);
      }
      // veio
      p.vline(7, 10, 8, D.d); p.vline(24, 36, 10, D.d);
      // maçaneta de latão
      p.rect(21, 30, 4, 3, '#b8913f'); p.hline(21, 30, 3, '#f0d590'); p.px(24, 32, '#7a5a20');
      p.rect(22, 34, 2, 3, '#3a2616');
      p.hline(5, 62, 22, D.d2); p.hline(5, 63, 22, J.o);
    } else if (t === T0.DOOR_O) {
      // folha aberta vista de lado, encostada no batente esquerdo
      const D = G.Pix.tones('#8f6343');
      p.rect(5, 4, 6, 60, D.b); p.vline(5, 4, 60, D.l); p.vline(10, 4, 60, D.d2);
      p.rect(7, 10, 2, 18, D.d); p.rect(7, 35, 2, 22, D.d);
      p.rect(10, 31, 2, 2, '#d4b16a');
      p.rect(5, 12, 1, 4, '#c8a050'); p.rect(5, 50, 1, 4, '#c8a050'); // dobradiças
    }
  }
  function drawGlassDoor(k, t) {
    const { p, c } = k;
    const top = k.get(0, -1) !== t;
    c.translate(0, top ? 0 : -S);
    const F = G.Pix.tones('#d5d9dc');
    const pane = (x, w, a) => {
      alpha(c, a, () => p.bands(x, 4, w, 56, '#b7def4', '#7fb6dc', 4));
      p.rect(x, 4, 2, 56, F.b); p.vline(x, 4, 56, F.h); p.rect(x + w - 2, 4, 2, 56, F.b); p.vline(x + w - 1, 4, 56, F.d);
      p.hline(x, 4, w, F.l); p.hline(x, 59, w, F.d);
      alpha(c, 0.5, () => { p.line(x + 3, 20, x + w - 4, 9, '#ffffff'); p.line(x + 3, 24, x + w - 4, 13, '#ffffff'); p.line(x + 3, 44, x + 8, 41, '#ffffff'); });
    };
    if (t === G.T.GDOOR_C) { pane(4, 13, 0.38); pane(15, 13, 0.38); p.rect(18, 26, 2, 12, '#8a9096'); p.px(18, 26, '#eef0f1'); }
    else { pane(15, 13, 0.3); pane(17, 11, 0.38); }
    // marco de alumínio, trilho e cabeçote
    p.rect(0, 0, 4, 64, F.b); p.vline(0, 0, 64, F.h); p.vline(3, 0, 64, F.d);
    p.rect(28, 0, 4, 64, F.b); p.vline(28, 0, 64, F.l); p.vline(31, 0, 64, F.d2);
    p.rect(0, 0, S, 4, F.b); p.hline(0, 0, S, F.h); p.hline(0, 3, S, F.d2);
    p.rect(0, 60, S, 4, F.d); p.hline(0, 60, S, F.b); p.hline(0, 63, S, F.d2);
  }

  /* ---------------- alçapão do telhado ---------------- */
  function drawHatch(k, t) {
    const { p } = k;
    const T = G.Pix.tones('#5d656c');
    if (t === G.T.HATCH_O) {
      // aro aberto + montantes
      for (const x of [0, 28]) { p.rect(x, 0, 4, S, T.b); p.vline(x, 0, S, T.l); p.vline(x + 3, 0, S, T.d2); }
      p.rect(0, 0, S, 4, T.l); p.hline(0, 0, S, T.h); p.hline(0, 3, S, T.d2);
      return;
    }
    p.rect(0, 0, S, S, T.b);
    // chapa xadrez (losangos em relevo) na tampa
    p.rect(0, 0, S, 8, T.l); p.hline(0, 0, S, T.h);
    for (let y = 2; y < 7; y += 3) for (let x = (y % 2) * 2; x < S; x += 4) { p.hline(x, y, 2, T.h); p.px(x + 1, y + 1, T.d); }
    p.hline(0, 7, S, T.d2);
    // corpo com painel, rebites e alça
    p.rect(3, 10, 26, 19, T.d); p.rect(4, 11, 24, 17, T.b); p.hline(4, 11, 24, T.l);
    for (const [x, y] of [[5, 12], [26, 12], [5, 26], [26, 26]]) { p.px(x, y, T.h); p.px(x, y + 1, T.d2); }
    if (k.h(1) > 0.5 || t === G.T.HATCH_SC) { p.rect(13, 16, 6, 3, '#c9a24a'); p.hline(13, 16, 6, '#e8c870'); p.hline(14, 19, 4, '#6a5020'); }
    p.vline(0, 0, S, T.h); p.vline(31, 0, S, T.d2); p.hline(0, 31, S, T.o);
  }

  /* ---------------- fachada do prédio B ---------------- */
  const CURTAINS = ['#c0504d', '#e9d8a6', '#6a8caf', '#9b7bb5', '#7fa86b'];
  function drawFacade(k) {
    const { p, h, tx, ty, c } = k;
    const W = G.Pix.tones('#dcb68e');
    const wx = (tx - 103) % 4, wy = (ty - 26) % 4;
    const mcol = Math.floor((tx - 103) / 4), mrow = Math.floor((ty - 26) / 4);
    const mod = mcol * 7 + mrow;
    // reboco com textura em grupinhos
    p.rect(0, 0, S, S, W.b);
    for (let i = 0; i < 6; i++) { const x = Math.floor(h(i) * 29), y = Math.floor(h(i + 9) * 31); p.hline(x, y, 2 + Math.floor(h(i + 20) * 2), h(i + 3) > 0.5 ? W.l : G.Pix.mix(W.b, W.d, 0.5)); }
    // frisos horizontais discretos do reboco
    if (wy !== 0) { p.hline(0, 15, S, G.Pix.mix(W.b, W.d, 0.35)); p.hline(0, 16, S, G.Pix.mix(W.b, W.l, 0.5)); }
    // o resto é desenhado em coordenadas do módulo 4×4 (128×128 px), recortado pela célula
    c.translate(-wx * S, -wy * S);
    const m = p;
    // cornija no topo do módulo
    const Cr = G.Pix.tones('#f1e2c8');
    m.rect(0, 0, 128, 7, Cr.b); m.hline(0, 0, 128, Cr.h); m.hline(0, 1, 128, Cr.l);
    m.hline(0, 4, 128, Cr.d); m.hline(0, 5, 128, Cr.l); m.hline(0, 6, 128, '#b48f68');
    m.rect(0, 7, 128, 2, G.Pix.mix(W.b, W.d, 0.6));
    for (let x = 4; x < 128; x += 8) { m.rect(x, 7, 3, 3, Cr.d); m.hline(x, 7, 3, Cr.b); } // dentículos
    // cano de descida em alguns módulos
    if (mcol % 3 === 1) {
      const Pt = G.Pix.tones('#9aa0a4');
      m.rect(3, 9, 4, 119, Pt.b); m.vline(3, 9, 119, Pt.l); m.vline(6, 9, 119, Pt.d);
      for (let y = 30; y < 128; y += 40) { m.rect(2, y, 6, 3, Pt.d); m.hline(2, y, 6, Pt.l); }
    }
    // verga com pedra-chave
    m.rect(30, 26, 68, 6, Cr.b); m.hline(30, 26, 68, Cr.h); m.hline(30, 31, 68, Cr.d);
    m.rect(59, 23, 10, 11, Cr.l); m.hline(59, 23, 10, Cr.h); m.vline(68, 23, 11, Cr.d); m.hline(59, 33, 10, Cr.d2);
    // moldura da janela
    const Fr = G.Pix.tones('#f4ecdc');
    m.rect(34, 32, 60, 60, Fr.b);
    m.hline(34, 32, 60, Fr.h); m.vline(34, 32, 60, Fr.h); m.hline(34, 91, 60, Fr.d); m.vline(93, 32, 60, Fr.d);
    // vidro: reflexo do céu em bandas
    m.bands(38, 36, 52, 52, '#a9c8db', '#557590', 6);
    m.hline(38, 36, 52, '#5d6f7d'); m.vline(38, 36, 52, '#6d8090'); // recuo/sombra da moldura
    // brilho diagonal em cada vidraça
    for (const [gx, gy] of [[40, 38], [66, 38], [40, 66], [66, 66]]) {
      alpha(c, 0.4, () => { m.line(gx + 3, gy + 14, gx + 14, gy + 3, '#ffffff'); m.line(gx + 3, gy + 18, gx + 18, gy + 3, '#ffffff'); m.line(gx + 12, gy + 20, gx + 20, gy + 12, '#ffffff'); });
    }
    // planta dentro de casa em algumas janelas
    if (hx(mod, 2, 5) > 0.7) { m.rect(78, 80, 6, 7, '#8e5a3a'); m.ellipse(81, 76, 5, 5, '#3f6a3a'); m.ellipse(80, 74, 3, 3, '#5a8a4a'); }
    // cortinas (cor por janela)
    if (hx(mod, 1, 5) > 0.3) {
      const cur = CURTAINS[Math.floor(hx(mod, 3, 5) * 5)], Ct = G.Pix.tones(cur);
      const both = hx(mod, 4, 5) > 0.45;
      const drape = (x0, dir) => {
        // painel franzido: largo em cima, preso no meio, abre embaixo
        const pts = dir > 0 ? [[x0, 37], [x0 + 13, 37], [x0 + 7, 66], [x0 + 10, 88], [x0, 88]] : [[x0, 37], [x0 - 13, 37], [x0 - 7, 66], [x0 - 10, 88], [x0, 88]];
        m.poly(pts, Ct.b);
        for (let f = 2; f < 12; f += 3) { const fx = x0 + dir * f; m.line(fx, 38, x0 + dir * Math.round(f * 0.5), 66, Ct.d); m.line(x0 + dir * Math.round(f * 0.5), 66, x0 + dir * Math.round(f * 0.8), 87, Ct.d); }
        m.line(x0 + dir * 1, 38, x0 + dir * 1, 87, Ct.l);
        m.rect(x0 + (dir > 0 ? 0 : -8), 64, 8, 3, Ct.d2); m.hline(x0 + (dir > 0 ? 0 : -8), 64, 8, Ct.l);
      };
      drape(38, 1); if (both) drape(90, -1);
      m.rect(36, 36, 56, 2, '#5a4a3a'); m.px(36, 35, '#7a6a5a'); m.px(91, 35, '#7a6a5a'); // varão
    }
    // caixilhos em cruz
    m.rect(63, 36, 2, 52, Fr.b); m.vline(64, 36, 52, Fr.d);
    m.rect(38, 62, 52, 2, Fr.b); m.hline(38, 63, 52, Fr.d);
    // peitoril saliente
    const Sl = G.Pix.tones('#f7f0e2');
    m.rect(30, 92, 68, 5, Sl.b); m.hline(30, 92, 68, Sl.h); m.hline(30, 95, 68, Sl.d); m.hline(30, 96, 68, '#a88763');
    m.rect(32, 97, 64, 2, G.Pix.mix(W.b, W.d, 0.6));
    if (hx(mcol, ty - wy, 8) > 0.45) {
      // floreira apoiada no peitoril
      const Bx = G.Pix.tones('#8e5a3a');
      const leaves = ['#3f7f34', '#4f9a3a', '#6fbf4f'];
      for (let i = 0; i < 14; i++) {
        const lx = 37 + i * 4, ly = 80 + Math.floor(hx(mod, i, 6) * 4);
        m.ellipse(lx, ly + 2, 3, 3, leaves[0]); m.ellipse(lx - 1, ly + 1, 2, 2, leaves[1]); m.px(lx - 1, ly, leaves[2]);
      }
      for (let i = 0; i < 7; i++) {
        const fx = 39 + i * 8 + Math.floor(hx(mod, i, 7) * 3), fy = 79 + Math.floor(hx(mod, i, 8) * 4);
        const fc = ['#e74c3c', '#f1c40f', '#ecf0f1', '#f29bb8'][Math.floor(hx(tx, i, 4) * 4)];
        m.rect(fx, fy, 2, 2, fc); m.px(fx, fy, G.Pix.light(fc, 0.5)); m.px(fx + 1, fy + 2, '#2f5f28');
      }
      m.rect(36, 84, 56, 9, Bx.b); m.hline(36, 84, 56, Bx.h); m.hline(36, 85, 56, Bx.l); m.hline(36, 92, 56, Bx.d2);
      m.hline(38, 88, 52, Bx.d); for (let x = 50; x < 90; x += 14) m.vline(x, 86, 6, Bx.d);
    } else {
      // escorridos de sujeira sob o peitoril
      for (let i = 0; i < 4; i++) { const sx = 36 + Math.floor(hx(mod, i, 9) * 56); alpha(c, 0.25, () => m.vline(sx, 99, 4 + Math.floor(hx(mod, i, 10) * 10), '#8a6a4a')); }
    }
    // ar-condicionado no vão à direita
    if (hx(mcol * 5 + mrow, 77, 9) > 0.55) {
      const Ac = G.Pix.tones('#e3e5e2');
      m.rect(100, 72, 24, 16, Ac.b); m.hline(100, 72, 24, Ac.h); m.vline(100, 72, 16, Ac.l); m.vline(123, 72, 16, Ac.d); m.hline(100, 87, 24, Ac.d2);
      for (let y = 75; y < 86; y += 2) m.hline(103, y, 11, Ac.d);
      m.ellipse(118, 79, 4, 4, Ac.d); m.ellipse(118, 79, 2, 2, Ac.d2); m.px(117, 77, Ac.l);
      m.rect(101, 88, 2, 4, '#8a8f8a'); m.rect(121, 88, 2, 4, '#8a8f8a');
      m.vline(106, 88, 10, '#7d8ea0');
      alpha(c, 0.25, () => m.rect(106, 98, 1, 14, '#7a5a3a'));
    }
  }

  /* ---------------- tabela dos blocos ---------------- */
  function fgTable() {
    const T = G.T, F = {};
    F[T.DIRT] = drawDirt; F[T.STONE] = drawStone; F[T.BEDROCK] = drawBedrock; F[T.GRAVEL] = drawGravel;
    F[T.GRASS] = drawGrass; F[T.ASPHALT] = drawAsphalt; F[T.MANHOLE] = drawManhole; F[T.SIDEWALK] = drawSidewalk;
    F[T.CONCRETE] = drawConcrete; F[T.WOOD] = drawWood; F[T.ROOF] = drawRoof; F[T.TILEF] = drawTileF;
    F[T.BRICK] = drawBrick; F[T.GLASS] = drawGlass; F[T.RAIL] = drawRail; F[T.FENCE] = drawFence;
    F[T.PLATFORM] = drawPlatform; F[T.FACADE] = drawFacade;
    F[T.STAIR_L] = (k) => drawStair(k, true); F[T.STAIR_R] = (k) => drawStair(k, false); F[T.HATCH_SO] = (k) => drawStair(k, false);
    F[T.STAIR_F] = drawStairF;
    F[T.DOOR_C] = (k) => drawDoor(k, T.DOOR_C); F[T.DOOR_O] = (k) => drawDoor(k, T.DOOR_O);
    F[T.GDOOR_C] = (k) => drawGlassDoor(k, T.GDOOR_C); F[T.GDOOR_O] = (k) => drawGlassDoor(k, T.GDOOR_O);
    F[T.HATCH_C] = (k) => drawHatch(k, T.HATCH_C); F[T.HATCH_SC] = (k) => drawHatch(k, T.HATCH_SC); F[T.HATCH_O] = (k) => drawHatch(k, T.HATCH_O);
    return F;
  }
  let FG = null;

  A.drawTile = function (c, world, t, tx, ty) {
    if (t === G.T.AIR) return true;
    FG = FG || fgTable();
    const fn = FG[t];
    if (!fn || !G.Pix) return false;
    inCell(c, tx, ty, () => fn(cell(c, world, tx, ty)));
    return true;
  };

  /* =====================================================================
   * Paredes de fundo
   * ===================================================================== */
  function baseboard(p, col) {
    const T = G.Pix.tones(col);
    p.rect(0, 25, S, 7, T.b); p.hline(0, 25, S, T.h); p.hline(0, 26, S, T.l); p.hline(0, 29, S, T.d); p.hline(0, 31, S, T.d2);
  }
  function outlet(p) { p.rect(20, 19, 5, 4, '#ece6d8'); p.px(21, 20, '#6b6050'); p.px(23, 20, '#6b6050'); p.hline(20, 22, 5, '#b9b0a0'); }

  function bgSala(k) { // papel de parede com listras e arabescos
    const { p, tx, ty } = k;
    const T = G.Pix.tones('#cdbf9f');
    p.rect(0, 0, S, S, T.b);
    for (let x = 0; x < S; x += 8) { p.rect(x + 2, 0, 2, S, G.Pix.mix(T.b, T.d, 0.35)); p.vline(x + 4, 0, S, G.Pix.mix(T.b, T.l, 0.4)); }
    for (let y = 0; y < S; y += 8) for (let x = 0; x < S; x += 8) {
      const ox = x + 6 + ((ty * 4 + y / 8) % 2 ? 0 : 0), oy = y + 3 + ((x / 8 + tx) % 2) * 4;
      if (oy < S - 1) { p.px(ox, oy, G.Pix.mix(T.b, T.d, 0.5)); p.px(ox, oy + 1, G.Pix.mix(T.b, T.l, 0.5)); }
    }
  }
  function bgQuarto(k) { // azul com motivo de losango
    const { p, ty } = k;
    const T = G.Pix.tones('#a9b9c9');
    p.rect(0, 0, S, S, T.b);
    for (let y = 0; y < S; y += 8) {
      const off = ((ty * 4 + y / 8) % 2) * 4;
      for (let x = off; x < S; x += 8) { p.px(x + 3, y + 2, T.d); p.hline(x + 2, y + 3, 3, G.Pix.mix(T.b, T.d, 0.5)); p.px(x + 3, y + 4, T.d); p.px(x + 3, y + 3, T.l); }
    }
  }
  function tileWall(k, col, size, grout) { // azulejos com brilho
    const { p } = k;
    const T = G.Pix.tones(col);
    p.rect(0, 0, S, S, grout);
    for (let y = 0; y < S; y += size) for (let x = 0; x < S; x += size) {
      const v = k.h(x * 3 + y) > 0.7 ? G.Pix.mix(T.b, T.d, 0.15) : T.b;
      p.rect(x, y, size - 1, size - 1, v);
      p.hline(x, y, size - 2, T.l); p.vline(x, y, size - 2, T.l);
      p.hline(x + 1, y + size - 2, size - 2, G.Pix.mix(T.b, T.d, 0.35));
      p.px(x + 2, y + 2, T.h); p.px(x + 3, y + 2, T.h); p.px(x + 2, y + 3, T.h);
    }
  }
  function bgConcrete(k) {
    const { p, h } = k;
    const T = G.Pix.tones('#6f7378');
    p.rect(0, 0, S, S, T.b);
    p.hline(0, 15, S, T.d); p.hline(0, 16, S, G.Pix.mix(T.b, T.l, 0.4));
    p.vline(31, 0, S, T.d);
    if (k.tx % 2 === 0) for (const y of [7, 23]) { p.rect(8, y, 2, 2, T.d2); p.px(10, y + 1, T.l); }
    p.clusters(0, 0, S, S, G.Pix.mix(T.b, T.d, 0.5), 6, 2, k.tx * 17 + k.ty);
    if (h(3) > 0.6) p.vline(Math.floor(h(4) * 30), 0, 10 + Math.floor(h(5) * 12), G.Pix.mix(T.b, T.d, 0.4));
  }
  function bgCorredor(k, floorBelow) { // tinta com rodameio e lambri na faixa de baixo
    const { p } = k;
    const T = G.Pix.tones('#b8ac93');
    p.rect(0, 0, S, S, T.b);
    for (let i = 0; i < 4; i++) { const x = Math.floor(k.h(i) * 30); p.vline(x, Math.floor(k.h(i + 8) * 16), 6 + Math.floor(k.h(i + 4) * 8), G.Pix.mix(T.b, T.l, 0.3)); }
    if (floorBelow || k.ty % 4 === 1) {
      const L = G.Pix.tones('#9c8f76');
      p.rect(0, 10, S, 22, L.b);
      for (let x = 0; x < S; x += 16) { p.vline(x + 15, 13, 12, L.d); p.vline(x, 13, 12, L.l); } // painéis
      p.rect(0, 8, S, 3, L.l); p.hline(0, 8, S, L.h); p.hline(0, 10, S, L.d2);
      p.hline(0, 11, S, G.Pix.mix(L.b, L.d, 0.5));
    }
  }
  function bgPadaria(k, floorBelow) {
    const { p } = k;
    const T = G.Pix.tones('#ead4aa');
    p.rect(0, 0, S, S, T.b);
    p.clusters(0, 0, S, S, G.Pix.mix(T.b, T.l, 0.5), 5, 3, k.tx * 5 + k.ty);
    if (floorBelow || k.ty === 37) {
      // azulejo de metrô branco (16×8 em amarração)
      const W = G.Pix.tones('#f3f0e8');
      p.rect(0, 12, S, 20, '#d6d2c8');
      for (let r = 0; r < 3; r++) {
        const y = 12 + r * 7, off = r % 2 ? 8 : 0;
        for (let x = -off; x < S; x += 16) { p.rect(x, y, 15, 6, W.b); p.hline(x, y, 14, '#ffffff'); p.hline(x + 1, y + 5, 14, W.d); }
      }
      p.rect(0, 10, S, 2, '#c49a6c'); p.hline(0, 10, S, '#e0b888');
    }
  }
  function bgStone(k) {
    const { p, h } = k;
    const T = G.Pix.tones('#3d3f43');
    p.rect(0, 0, S, S, T.b);
    for (let i = 0; i < 4; i++) {
      const cx = 6 + Math.floor(h(i) * 20), cy = 6 + Math.floor(h(i + 5) * 20);
      p.ellipse(cx + 1, cy + 1, 5, 4, T.d); p.ellipse(cx, cy, 5, 4, G.Pix.mix(T.b, T.l, 0.4)); p.ellipse(cx, cy + 1, 4, 2.5, T.b);
    }
    p.clusters(0, 0, S, S, T.d2, 5, 2, k.tx * 3 + k.ty * 7);
  }
  function bgDirt(k) {
    const { p } = k;
    const T = G.Pix.tones('#47301f');
    p.rect(0, 0, S, S, T.b);
    p.clusters(0, 0, S, S, T.d, 8, 3, k.tx * 11 + k.ty);
    p.clusters(0, 0, S, S, G.Pix.mix(T.b, T.l, 0.5), 5, 2, k.tx * 11 + k.ty + 5);
  }
  function bgLobby(k) { // painéis de pedra clara com lambri de madeira escura no térreo
    const { p, h } = k;
    const T = G.Pix.tones('#c9c4ba');
    p.rect(0, 0, S, S, T.b);
    // veios de mármore
    if (h(1) > 0.4) { let x = Math.floor(h(2) * 28), y = 0; for (let s = 0; s < 8; s++) { p.line(x, y, x + 2, y + 4, G.Pix.mix(T.b, T.d, 0.4)); x += 2; y += 4; if (x > 30) break; } }
    p.vline(31, 0, S, G.Pix.mix(T.b, T.d, 0.5)); p.vline(0, 0, S, T.l);
    p.hline(0, 31, S, G.Pix.mix(T.b, T.d, 0.5)); p.hline(0, 0, S, T.l);
    if (k.ty === 37) {
      const W = G.Pix.tones('#6b5e52');
      p.rect(0, 12, S, 20, W.b); p.rect(0, 10, S, 3, W.l); p.hline(0, 10, S, W.h); p.hline(0, 13, S, W.d2);
      for (let x = 0; x < S; x += 16) { p.rect(x + 3, 16, 10, 12, W.d); p.rect(x + 4, 17, 9, 11, W.b); p.hline(x + 4, 17, 9, W.l); }
      p.rect(0, 29, S, 3, W.d2);
    }
  }

  function bgTable() {
    const B = G.B, F = {};
    F[B.SALA] = bgSala; F[B.QUARTO] = bgQuarto;
    F[B.COZINHA] = (k) => tileWall(k, '#e3dccb', 16, '#cfc7b5');
    F[B.BANHEIRO] = (k) => tileWall(k, '#d3e8e4', 8, '#b8d3ce');
    F[B.BRICK] = (k) => brickWall(k, BRICK_BG, 0);
    F[B.CONCRETE] = bgConcrete; F[B.CORREDOR] = bgCorredor; F[B.PADARIA] = bgPadaria;
    F[B.STONE] = bgStone; F[B.DIRT] = bgDirt; F[B.LOBBY] = bgLobby;
    return F;
  }
  let BG = null;
  // paredes que ganham rodapé de madeira sobre o piso
  const BASEBOARD = { 1: '#6b5440', 2: '#6b5440', 3: '#8a7f6c', 4: null, 5: null, 6: '#9fc4be', 7: '#6b5440' };

  A.drawBg = function (c, world, b, tx, ty) {
    if (b === G.B.NONE) return true;
    BG = BG || bgTable();
    const fn = BG[b];
    if (!fn || !G.Pix) return false;
    inCell(c, tx, ty, () => {
      const k = cell(c, world, tx, ty), p = k.p;
      const floorBelow = k.solid(0, 1) && k.bg(0, 1) !== b;
      fn(k, floorBelow);
      if (floorBelow && BASEBOARD[b]) { baseboard(p, BASEBOARD[b]); if ((b === 1 || b === 2) && k.h(77) > 0.85) outlet(p); }
      const under = b === G.B.STONE || b === G.B.DIRT;
      // oclusão: sombra sob a laje e junto das paredes sólidas
      if (!under) {
        const d = (dx, dy) => { const t = k.def(dx, dy); return t.solid || t.door; };
        if (d(0, -1)) { alpha(c, 0.28, () => p.rect(0, 0, S, 2, '#1a1230')); alpha(c, 0.14, () => p.rect(0, 2, S, 3, '#1a1230')); }
        if (d(-1, 0)) { alpha(c, 0.22, () => p.rect(0, 0, 2, S, '#1a1230')); alpha(c, 0.1, () => p.rect(2, 0, 2, S, '#1a1230')); }
        if (d(1, 0)) { alpha(c, 0.22, () => p.rect(30, 0, 2, S, '#1a1230')); alpha(c, 0.1, () => p.rect(28, 0, 2, S, '#1a1230')); }
      }
      // escurece a parede de fundo para separar dos blocos da frente
      alpha(c, 0.2, () => p.rect(0, 0, S, S, '#1a1230'));
    });
    return true;
  };
})(window.VG = window.VG || {});

/* =====================================================================
 * Rua, praça, padaria, telhado, veículos e animais na grade fina.
 * Tudo é desenhado em pixels finos (S por unidade do mundo); as partes
 * paradas ficam em cache (G.Pix.sprite) e só o que mexe é pintado a cada
 * quadro (folhas balançando, luz dos postes, rodas, bichos).
 * ===================================================================== */
(function (G) {
  'use strict';
  G.ArtDecor = G.ArtDecor || {};
  G.ArtSprites = G.ArtSprites || {};
  const A = G.ArtDecor, SP = G.ArtSprites;
  const P = G.Pix;
  const H = (a, b, c) => G.util.hash(a, b, c || 0);
  const R = Math.round;

  /** Sprite com 1 px de margem para o contorno; fn desenha a partir de (0,0). */
  function spr(key, w, h, fn, o) {
    return P.sprite('ext:' + key, R(w) + 2, R(h) + 2, (p, c) => { c.translate(1, 1); fn(p, c); }, o);
  }

  /* ---------- ajudantes de volume ---------- */
  /** Cilindro em pé: colunas com luz à esquerda e brilho metálico. */
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  /** Tom de um cilindro na fração f (0..1) da largura, com pontilhado ordenado entre tons vizinhos. */
  function cylTone(T, f, sheen, i, j) {
    // perfil: claro na borda esquerda, brilho perto dela, escurecendo até a direita
    const ramp = sheen ? [T.l, T.h, T.l, T.b, T.b, T.d, T.d2] : [T.l, T.l, T.b, T.b, T.d, T.d, T.d2];
    const v = f * (ramp.length - 1), a = Math.floor(v), k = v - a;
    if (a >= ramp.length - 1) return ramp[ramp.length - 1];
    return k * 16 > BAYER[(j & 3) * 4 + (i & 3)] + 0.5 ? ramp[a + 1] : ramp[a];
  }
  /** Cilindro em pé: colunas com luz à esquerda e brilho metálico. */
  function cylV(p, x, y, w, h, hex, sheen) {
    const T = P.tones(hex);
    if (w < 12) {
      for (let i = 0; i < w; i++) {
        const f = (i + 0.5) / w;
        p.rect(x + i, y, 1, h, f < 0.12 ? T.l : f < 0.3 ? (sheen ? T.h : T.l) : f < 0.6 ? T.b : f < 0.86 ? T.d : T.d2);
      }
      return;
    }
    for (let i = 0; i < w; i++) for (let j = 0; j < Math.min(h, 4); j++) {
      const col = cylTone(T, (i + 0.5) / w, sheen, x + i, y + j);
      for (let jj = j; jj < h; jj += 4) p.px(x + i, y + jj, col);
    }
  }
  /** Cilindro deitado: linhas com luz em cima. */
  function cylH(p, x, y, w, h, hex, sheen) {
    const T = P.tones(hex);
    if (h < 12) {
      for (let j = 0; j < h; j++) {
        const f = (j + 0.5) / h;
        p.rect(x, y + j, w, 1, f < 0.14 ? T.l : f < 0.32 ? (sheen ? T.h : T.l) : f < 0.62 ? T.b : f < 0.85 ? T.d : T.d2);
      }
      return;
    }
    for (let j = 0; j < h; j++) for (let i = 0; i < Math.min(w, 4); i++) {
      const col = cylTone(T, (j + 0.5) / h, sheen, x + i, y + j);
      for (let ii = i; ii < w; ii += 4) p.px(x + ii, y + j, col);
    }
  }
  /** Galho/tronco: segmento grosso sombreado pela normal, com sulcos de casca. */
  function limb(p, x0, y0, x1, y1, r0, r1, hex, seed) {
    const T = P.tones(hex);
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1, L = Math.sqrt(L2);
    let nx = -dy / L, ny = dx / L;
    if (-nx * 0.7 - ny * 0.7 < 0) { nx = -nx; ny = -ny; }
    const rm = Math.max(r0, r1) + 1;
    for (let y = Math.floor(Math.min(y0, y1) - rm); y <= Math.ceil(Math.max(y0, y1) + rm); y++) {
      for (let x = Math.floor(Math.min(x0, x1) - rm); x <= Math.ceil(Math.max(x0, x1) + rm); x++) {
        const qx = x + 0.5, qy = y + 0.5;
        const t = Math.max(0, Math.min(1, ((qx - x0) * dx + (qy - y0) * dy) / L2));
        const px = x0 + dx * t, py = y0 + dy * t, r = r0 + (r1 - r0) * t;
        if ((qx - px) * (qx - px) + (qy - py) * (qy - py) > r * r) continue;
        const s = ((qx - px) * nx + (qy - py) * ny) / r;
        let k = s > 0.5 ? 3 : s > -0.15 ? 2 : s > -0.6 ? 1 : 0;
        const band = Math.floor((s + 1) * r / 2.2), seg = Math.floor(t * L / 4);
        if (H(band, seg, seed) > 0.72) k = Math.max(0, k - 1);
        if (k === 3 && H(band, seg, seed + 9) > 0.8) k = 4;
        p.px(x, y, [T.d2, T.d, T.b, T.l, T.h][k]);
      }
    }
  }

  /* ---------- fonte de pixel 5×7 ---------- */
  const FONT = {
    A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
    C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
    D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
    E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    G: ['01111', '10000', '10000', '10011', '10001', '10001', '01111'],
    I: ['111', '010', '010', '010', '010', '010', '111'],
    L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
    N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
    O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
    R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
    T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
    'Ç': ['01111', '10000', '10000', '10000', '10000', '10000', '01111', '00100', '01100'],
    'Ã': ['01010', '10100', '01110', '10001', '11111', '10001', '10001'],
    '-': ['000', '000', '000', '111', '000', '000', '000'],
    ':': ['0', '1', '0', '0', '0', '1', '0'],
    ' ': ['000', '000', '000', '000', '000', '000', '000'],
    0: ['01110', '10011', '10101', '10101', '10101', '11001', '01110'],
    1: ['011', '111', '011', '011', '011', '011', '011'],
    2: ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
    3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    4: ['00110', '01010', '10010', '11111', '00010', '00010', '00010'],
    5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    6: ['01110', '10000', '11110', '10001', '10001', '10001', '01110'],
    7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    9: ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  };
  const glyph = (ch) => FONT[ch] || FONT[ch.toUpperCase()] || FONT[' '];
  const textW = (s, k) => [...s].reduce((a, ch) => a + (glyph(ch)[0].length + 1) * k, -k);
  function text(p, s, x, y, k, col, shadow) {
    let cx = Math.round(x);
    for (const ch of s) {
      const g = glyph(ch);
      g.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '1') { if (shadow) { const o = Math.max(1, R(k / 3)); p.rect(cx + i * k + o, y + j * k + o, k, k, shadow); } p.rect(cx + i * k, y + j * k, k, k, col); } });
      cx += (g[0].length + 1) * k;
    }
  }

  /* ---------- folhagem em tufos (estilo da referência) ---------- */
  const LEAF = ['#1c3a2a', '#28572f', '#3a7737', '#579c41', '#83c155', '#b6e07a'];
  const LEAF_BACK = ['#152b27', '#1d412c', '#2a5c33', '#3d7a3a', '#5a9849', '#7cb75c'];
  /**
   * Massa de folhas w×h (px): muitos grupinhos redondos, cada um com luz própria,
   * sombreados também pela posição na copa. extra(p, inside) pinta frutas/flores.
   */
  function blob(key, w, h, pal, seed, br, extra, cut) {
    return spr(key, w, h, (p) => {
      const cx = w / 2, cy = cut ? h * 0.62 : h / 2, rx = w / 2 - 0.5, ry = cut ? h * 0.62 - 0.5 : h / 2 - 0.5;
      const bumps = [];
      const m = Math.max(6, R((rx + ry) * 3.2 / br));
      for (let k = 0; k < m; k++) {
        const a = (k / m) * Math.PI * 2 + H(k, seed, 1) * 0.4;
        const r = br * (0.75 + H(k, seed, 2) * 0.5);
        bumps.push({ x: cx + Math.cos(a) * (rx - r * 0.95), y: cy + Math.sin(a) * (ry - r * 0.95), r, j: (H(k, seed, 3) - 0.5) * 0.25 });
      }
      const n = Math.max(4, R(w * h / (br * br * 2.4)));
      for (let k = 0; k < n; k++) {
        const a = H(k, seed, 4) * Math.PI * 2, d = Math.sqrt(H(k, seed, 5));
        const r = br * (0.8 + H(k, seed, 6) * 0.5);
        bumps.push({ x: cx + Math.cos(a) * (rx - r) * d, y: cy + Math.sin(a) * (ry - r) * d, r, j: (H(k, seed, 7) - 0.5) * 0.25 });
      }
      bumps.sort((a, b) => a.y - b.y);
      const lit = new Float32Array(w * h).fill(-9);
      for (const b of bumps) {
        for (let y = Math.floor(b.y - b.r); y <= Math.ceil(b.y + b.r); y++) for (let x = Math.floor(b.x - b.r); x <= Math.ceil(b.x + b.r); x++) {
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const lu = (x + 0.5 - b.x) / b.r, lv = (y + 0.5 - b.y) / b.r;
          if (lu * lu + lv * lv > 1) continue;
          const gu = (x + 0.5 - cx) / rx, gv = (y + 0.5 - cy) / ry;
          const nz = H(x >> 1, y >> 1, seed) - 0.5;
          let l = (-gu * 0.45 - gv * 0.85) * 0.7 + (-lu * 0.45 - lv * 0.8) * 0.6 + nz * 0.35 + b.j;
          if (lv > 0.72) l -= 0.35;
          lit[y * w + x] = l;
          const k = l > 0.7 ? 4 : l > 0.3 ? 3 : l > -0.08 ? 2 : l > -0.5 ? 1 : 0;
          p.px(x, y, pal[k]);
        }
      }
      // folhinhas de brilho nos tufos mais iluminados
      for (const b of bumps) {
        const gl = -((b.x - cx) / rx) * 0.45 - ((b.y - cy) / ry) * 0.85;
        if (gl < 0.15) continue;
        const ox = R(b.x - b.r * 0.35), oy = R(b.y - b.r * 0.45);
        if (ox >= 0 && oy >= 0 && ox < w - 1 && oy < h - 1 && lit[oy * w + ox] > 0.2) { p.rect(ox, oy, 2, 1, pal[5]); p.px(ox, oy + 1, pal[4]); }
      }
      // franja irregular: folhinhas saltando da borda (nada de contorno liso)
      const pal2 = [pal[0], pal[1], pal[2], pal[3], pal[4]];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (lit[y * w + x] > -9) continue;
        const nb = [[0, 1], [1, 0], [-1, 0], [0, -1]].map(([a, b]) => (x + a >= 0 && y + b >= 0 && x + a < w && y + b < h) ? lit[(y + b) * w + x + a] : -9).filter((v) => v > -9);
        if (!nb.length || H(x, y, seed + 3) < 0.62) continue;
        const l = nb[0], k = l > 0.7 ? 3 : l > 0.3 ? 2 : l > -0.08 ? 1 : 0;
        p.px(x, y, pal2[k]);
      }
      if (extra) extra(p, (x, y) => x >= 0 && y >= 0 && x < w && y < h && lit[y * w + x] > -9, lit);
    });
  }

  /* ======================= TELHADO ======================= */
  A.caixa_dagua = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S, u = (n) => R(n * S);
    const s = spr('caixa' + W + 'x' + Hh, W, Hh, (p) => {
      const steel = '#59616b';
      // estrutura: pernas, travessas em X e plataforma
      for (const lx of [u(5), W - u(8)]) cylV(p, lx, u(27), u(3), Hh - u(27), steel, true);
      p.line(u(8), u(30), W - u(8), Hh - u(2), '#4a5059').line(u(8), Hh - u(2), W - u(8), u(30), '#4a5059');
      p.line(u(8), u(30) + 1, W - u(8), Hh - u(2) + 1, '#6d7680').line(u(8), Hh - u(2) + 1, W - u(8), u(30) + 1, '#6d7680');
      cylH(p, u(1), u(26), W - u(2), u(2.5), '#6b737d', true);
      // cano de saída descendo pela perna
      cylV(p, W - u(13), u(28), u(2), Hh - u(28), '#c9c9c2', true);
      cylH(p, W - u(13), Hh - u(3), u(6), u(2), '#c9c9c2', true);
      // corpo do reservatório
      const bx = u(4), bw = W - u(8), by = u(7), bh = u(19.5);
      cylV(p, bx, by, bw, bh, '#3f7fbf', true);
      const T = P.tones('#3f7fbf');
      for (const ry of [11, 16, 21]) { p.rect(bx + 1, u(ry), bw - 2, 1, T.d2); p.rect(bx + 1, u(ry) + 1, bw - 2, 1, T.l); }
      p.rect(bx, by + bh - 1, bw, 1, T.d2);
      // tampa abaulada
      p.rect(u(2.5), by - u(1.2), W - u(5), u(1.6), T.l);
      p.rect(u(2.5), by + u(0.3), W - u(5), 1, T.d2);
      for (let j = 0; j < u(5); j++) {
        const k = j / u(5), hw = (W / 2 - u(4)) * Math.sqrt(1 - (1 - k) * (1 - k));
        const yy = by - u(1.2) - u(5) + j;
        for (let x = R(W / 2 - hw); x < R(W / 2 + hw); x++) { const f = (x - W / 2) / hw; p.px(x, yy, f < -0.5 ? T.h : f < 0.1 ? T.l : f < 0.6 ? T.b : T.d); }
      }
      cylV(p, R(W / 2 - u(2)), by - u(7.5), u(4), u(1.6), '#3a6fa6', true);
      // etiqueta e respiro
      p.rect(bx + u(6), u(13), u(9), u(2), '#e9eef2').rect(bx + u(7), u(13.5), u(7), 1, '#3f7fbf');
      cylV(p, W - u(8), by - u(4), u(1.2), u(3), '#bdbdb6', true);
      // escadinha
      for (const rx2 of [u(1), u(3)]) p.rect(rx2, u(8), 1, Hh - u(8), '#7a838d');
      for (let ry = u(10); ry < Hh; ry += u(3)) p.rect(u(1), ry, u(2) + 1, 1, '#9aa3ad');
      // manchas de sujeira escorrendo
      for (let i = 0; i < 6; i++) p.rect(bx + R(H(i, 3, 1) * bw), by + bh - u(4), 1, u(2 + H(i, 3, 2) * 3), P.rgba('#1d2c40', 0.35));
    });
    c.drawImage(s, X - 1, Y - 1);
  };

  A.antena = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S, u = (n) => R(n * S);
    const s = spr('antena' + W + 'x' + Hh, W + u(6), Hh, (p) => {
      const o = u(3), mast = '#8d959e';
      // estais
      p.line(o + u(7), u(14), o - u(2), Hh - 1, '#5d646c').line(o + u(7), u(14), o + W + u(2), Hh - 1, '#5d646c');
      cylV(p, o + u(6), 0, u(1.5), Hh, mast, true);
      // elementos (dipolos) com pontas
      [[1, 14, 0], [7, 11, 1], [13, 8, 2], [19, 5, 3]].forEach(([yy, ww]) => {
        const x0 = o + R(u(7) - u(ww) / 2);
        p.rect(x0, u(yy), u(ww), Math.max(2, u(0.8)), '#b4bcc4').hline(x0, u(yy), u(ww), '#e2e7ec');
        p.rect(x0 - 1, u(yy) - 1, 2, 3, '#4a5058').rect(x0 + u(ww) - 1, u(yy) - 1, 2, 3, '#4a5058');
      });
      // cabo enrolado no mastro
      for (let yy = u(3); yy < Hh - u(3); yy += u(2)) p.px(o + u(6) + ((yy / u(2)) % 2 ? -1 : u(1.5)), yy, '#22262c');
      // base
      p.rect(o + u(4), Hh - u(2), u(6), u(2), '#5d646c').hline(o + u(4), Hh - u(2), u(6), '#8d959e');
    });
    c.drawImage(s, X - 1 - u(3), Y - 1);
  };

  /* ======================= TERRENO BALDIO ======================= */
  A.outdoor = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S, u = (n) => R(n * S), BH = Hh - u(40);
    const s = spr('outdoor' + W + 'x' + Hh, W, Hh, (p) => {
      const steel = '#5f666e';
      // pernas em viga I e travamento
      for (const lx of [u(14), W - u(20)]) {
        cylV(p, lx, BH, u(6), Hh - BH, steel, true);
        p.rect(lx + u(2.5), BH, 1, Hh - BH, '#3c4148');
        p.rect(lx - u(2), Hh - u(2), u(10), u(2), '#4d535a').hline(lx - u(2), Hh - u(2), u(10), '#7a828a');
      }
      for (let i = 0; i < 2; i++) {
        const y0 = BH + u(5 + i * 17), y1 = y0 + u(14);
        p.line(u(20), y0, W - u(20), y1, '#525962').line(u(20), y1, W - u(20), y0, '#525962');
        cylH(p, u(20), y0 - 1, W - u(40), u(1.5), '#5f666e', true);
      }
      // passarela com guarda-corpo
      p.rect(u(4), BH + u(1), W - u(8), u(1.5), '#4d535a').hline(u(4), BH + u(1), W - u(8), '#8a929a');
      for (let x = u(6); x < W - u(4); x += u(3)) p.rect(x, BH + u(1.5), 1, u(1), '#2f343a');
      // moldura
      p.rect(0, 0, W, BH + u(1), '#3f454c');
      p.rect(1, 1, W - 2, 1, '#737b84').rect(1, 1, 1, BH - 1, '#737b84');
      const ix = u(2.5), iy = u(2.5), iw = W - u(5), ih = BH - u(4);
      // cartaz: papel creme, faixa vermelha, letras
      p.bands(ix, iy, iw, ih, '#f6efdf', '#e3d8bf', 5);
      p.rect(ix, iy + R(ih * 0.62), iw, R(ih * 0.38), '#c8352e');
      p.rect(ix, iy + R(ih * 0.62), iw, 1, '#e8584f').rect(ix, iy + ih - 2, iw, 2, '#9c2621');
      const msg = 'ALUGA-SE';
      const k = Math.max(1, Math.floor(iw * 0.82 / textW(msg, 1)));
      const tw = textW(msg, k);
      text(p, msg, ix + R((iw - tw) / 2), iy + R(ih * 0.62 / 2 - 3.5 * k), k, '#c8352e', '#8f241f');
      const tel = 'TRATAR: 3456-7890', k2 = Math.max(1, Math.floor(k / 3));
      text(p, tel, ix + R((iw - textW(tel, k2)) / 2), iy + R(ih * 0.62 + ih * 0.19 - 3.5 * k2), k2, '#fff4dc');
      // emendas das folhas de papel
      for (let i = 1; i < 4; i++) p.rect(ix + R(iw * i / 4), iy, 1, ih, P.rgba('#8a7d63', 0.35));
      // canto descolado mostrando cartaz antigo azul
      const cx0 = ix + iw - u(22), cy0 = iy + ih - u(16);
      p.poly([[ix + iw, cy0], [ix + iw, iy + ih], [cx0, iy + ih]], '#3d6fa8');
      p.poly([[ix + iw, cy0], [cx0, iy + ih], [cx0 + u(5), cy0 + u(4)]], '#efe5cc');
      p.line(ix + iw, cy0, cx0, iy + ih, '#b8ab8c');
      // sujeira escorrida e ferrugem
      for (let i = 0; i < 14; i++) p.rect(ix + R(H(i, 7, 1) * iw), iy + R(H(i, 7, 2) * u(4)), 1, u(3 + H(i, 7, 3) * 8), P.rgba('#5a4a30', 0.22));
      p.dither(ix, iy + ih - u(5), iw, u(5), P.rgba('#3a2a20', 0.25), 0.3);
      for (let i = 0; i < 6; i++) p.rect(R(H(i, 8, 1) * W), R(H(i, 8, 2) < 0.5 ? 0 : BH - 1), u(2), 1, '#8a5a3a');
      // refletores no topo
      for (const lx of [u(28), W - u(34)]) { p.rect(lx + u(2), -0, 1, u(0)); p.rect(lx, 0, u(6), u(2), '#2e3338').hline(lx, 0, u(6), '#6d757d'); }
    });
    c.drawImage(s, X - 1, Y - 1);
    if (env.night > 0.25) {
      // refletores acesos lavando o cartaz
      c.save(); c.globalCompositeOperation = 'lighter';
      for (const lx of [u(31), W - u(31)]) for (let i = 0; i < 4; i++) {
        c.fillStyle = 'rgba(255,230,170,' + (0.05 * env.night) + ')';
        const ww = u(10 + i * 10), hh = u(10 + i * 14);
        c.fillRect(X + lx - R(ww / 2), Y + u(2), ww, Math.min(hh, BH - u(3)));
      }
      c.fillStyle = '#fff3c0'; for (const lx of [u(28), W - u(34)]) c.fillRect(X + lx + 1, Y + u(2), u(6) - 2, 1);
      c.restore();
    }
  };

  A.manilha = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S, u = (n) => R(n * S);
    const s = spr('manilha' + W + 'x' + Hh, W, Hh, (p) => {
      const conc = '#a7a59c', T = P.tones(conc);
      const r = Hh / 2, cx = r, cy = r;
      // corpo deitado indo para trás
      cylH(p, R(cx), 0, W - R(cx) - u(2), Hh, '#999790');
      p.ellipse(W - u(2.5), cy, u(2.5), r, T.d);
      for (let i = 0; i < 10; i++) p.rect(R(cx + H(i, 4, 1) * (W - cx - u(4))), R(H(i, 4, 2) * Hh), 2, 1, T.d);
      // boca: anel com volume
      p.ball(cx, cy, r, r, conc);
      p.clusters(R(cx - r), 0, R(r * 2), Hh, T.d, 14, 2, 21).clusters(R(cx - r), 0, R(r * 2), Hh, T.l, 8, 2, 22);
      p.ellipse(cx, cy, r * 0.72, r * 0.72, T.o);
      // parede interna: fundo escuro, borda de baixo pegando luz
      for (let y = Math.floor(cy - r * 0.72); y <= cy + r * 0.72; y++) for (let x = Math.floor(cx - r * 0.72); x <= cx + r * 0.72; x++) {
        const du = (x + 0.5 - cx) / (r * 0.72), dv = (y + 0.5 - cy) / (r * 0.72);
        const dd = du * du + dv * dv;
        if (dd > 0.8) continue;
        const inner = (x + 0.5 - cx - r * 0.12) / (r * 0.5), innerv = (y + 0.5 - cy + r * 0.12) / (r * 0.5);
        const deep = inner * inner + innerv * innerv < 1;
        p.px(x, y, deep ? '#1f1d1c' : dv > 0.1 ? T.d : '#3c3a37');
      }
      // textura de concreto e trinca
      p.line(R(cx + r * 0.5), R(cy - r * 0.9), R(cx + r * 0.7), R(cy - r * 0.55), T.d2).line(R(cx + r * 0.7), R(cy - r * 0.55), R(cx + r * 0.6), R(cy - r * 0.3), T.d2);
      // capim nascendo na base
      for (let i = 0; i < 6; i++) { const gx = R(cx + r * 0.6 + i * u(1.4)), gh = u(1.5 + H(i, 5, 1) * 2.5); p.rect(gx, Hh - gh, 1, gh, i % 2 ? '#4e8f3a' : '#6cb24c'); }
    });
    c.drawImage(s, X - 1, Y - 1);
  };

  A.cone = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S, u = (n) => R(n * S);
    const s = spr('cone' + W + 'x' + Hh, W, Hh, (p) => {
      const T = P.tones('#ee7a1f'), Wt = P.tones('#eef0f2');
      const top = 0, bot = Hh - u(1);
      for (let y = top; y < bot; y++) {
        const k = (y - top) / (bot - top), hw = 1 + k * (W / 2 - u(0.6) - 1);
        const band = (k > 0.3 && k < 0.44) || (k > 0.58 && k < 0.72);
        const TT = band ? Wt : T;
        for (let x = R(W / 2 - hw); x < R(W / 2 + hw); x++) {
          const f = (x + 0.5 - (W / 2 - hw)) / (hw * 2);
          p.px(x, y, f < 0.2 ? TT.l : f < 0.38 ? TT.h : f < 0.7 ? TT.b : TT.d);
        }
      }
      p.rect(0, bot, W, u(1), '#2b2b30').hline(0, bot, W, '#4b4b52');
    });
    c.drawImage(s, X - 1, Y - 1);
  };

  /* ======================= RUA ======================= */
  A.faixa = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S, u = (n) => R(n * S);
    const s = spr('faixa' + W + 'x' + Hh, W, Hh, (p) => {
      for (let i = 0, n = 0; i < W; i += u(8), n++) {
        const w = Math.min(u(5), W - i);
        p.rect(i, 0, w, Hh, '#e9e8df').hline(i, 0, w, '#fbfaf2').hline(i, Hh - 1, w, '#bdbcb4');
        // desgaste em grupinhos
        for (let k = 0; k < 3; k++) p.rect(i + R(H(n, k, 1) * (w - 3)), R(H(n, k, 2) * Hh), 2 + R(H(n, k, 3)), 1, '#8e8f93');
      }
    }, { outline: false });
    c.drawImage(s, X - 1, Y - 1);
  };

  /** Luz amarelada (pixels em anéis, sem borrar) somada à cena. */
  function glow(c, x, y, r, k, col) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 4; i >= 1; i--) { c.fillStyle = 'rgba(' + col + ',' + (0.07 * k) + ')'; P.painter(c).ellipse(x, y, r * i / 4, r * i / 4 * 0.8, c.fillStyle); }
    c.restore();
  }

  A.poste_ok = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S, u = (n) => R(n * S);
    const lit = env.night > 0.25;
    const s = spr('poste' + W + 'x' + Hh + (lit ? 'on' : 'off'), W, Hh, (p) => {
      const pole = '#3a4550';
      // braço em pescoço de ganso
      limb(p, u(7), u(8), u(7.2), u(3), u(1), u(0.9), pole, 3);
      limb(p, u(7.2), u(3), u(9), u(1.2), u(0.9), u(0.8), pole, 4);
      limb(p, u(9), u(1.2), u(12), u(1.6), u(0.8), u(0.8), pole, 5);
      // luminária
      p.poly([[u(9.6), u(1.6)], [u(14), u(1.6)], [u(14), u(2.6)], [u(13.4), u(3.8)], [u(10.2), u(3.8)], [u(9.6), u(2.6)]], '#2e383d');
      p.hline(u(9.8), u(1.6), u(4), '#6d7c83').hline(u(9.8), u(1.6) + 1, u(2), '#8b9aa1');
      p.rect(u(10.4), u(3.8), u(2.8), u(0.7), lit ? '#fff4c6' : '#9fb1bb').hline(u(10.4), u(3.8), u(2.8), lit ? '#ffffff' : '#cad6dc');
      // poste afinando para cima
      for (let y = u(6); y < Hh - u(3); y++) {
        const k = (y - u(6)) / (Hh - u(9)), w = R(u(1.6) + k * u(0.8));
        cylV(p, R(u(7) - w / 2), y, w, 1, pole, true);
      }
      // anéis decorativos e base
      for (const ry of [Hh - u(14), Hh - u(9)]) cylV(p, u(5.4), ry, u(3.2), u(1), '#4a5764', true);
      cylV(p, u(4.4), Hh - u(3), u(5.2), u(3), '#323c47', true);
      p.hline(u(4.4), Hh - u(3), u(5.2), '#6a7a7a');
      p.px(u(5), Hh - u(1.5), '#9aa8a8').px(u(9), Hh - u(1.5), '#9aa8a8');
    });
    c.drawImage(s, X - 1, Y - 1);
    if (lit) {
      const fl = 0.92 + 0.08 * Math.sin(env.time * 9) * Math.sin(env.time * 2.3);
      const lx = X + u(11.8), ly = Y + u(4.2);
      glow(c, lx, ly, u(9), env.night * fl, '255,214,140');
      // cone de luz até o chão
      c.save(); c.globalCompositeOperation = 'lighter';
      const pn = P.painter(c);
      pn.poly([[lx - u(1.4), ly], [lx + u(1.4), ly], [lx + u(13), Y + Hh], [lx - u(13), Y + Hh]], 'rgba(255,220,150,' + (0.05 * env.night * fl).toFixed(3) + ')');
      pn.poly([[lx - u(1), ly], [lx + u(1), ly], [lx + u(7), Y + Hh], [lx - u(7), Y + Hh]], 'rgba(255,220,150,' + (0.04 * env.night * fl).toFixed(3) + ')');
      c.restore();
    }
  };

  /** Sedã de perfil (frente à direita). */
  A.carro = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S, u = (n) => R(n * S), col = d.cor || '#7d2e2e';
    const T = P.tones(col);
    const s = spr('carro' + col + W + 'x' + Hh, W, Hh, (p, cx) => {
      const body = [[2, 12], [14, 11], [22.5, 3.4], [25, 2.6], [46, 2.6], [49, 3.4], [57, 10.6], [72, 11.8], [75.4, 13.4], [76, 16], [76, 20.5], [74.5, 22], [1.5, 22], [0, 20], [0, 14]].map(([a, b]) => [a * S, b * S]);
      p.poly(body, T.b);
      // volumes: tampa e capô claros, vinco, saia escura (pinta só sobre a lataria)
      cx.globalCompositeOperation = 'source-atop';
      p.rect(0, 0, W, u(11.8), T.l);
      p.rect(0, u(11), W, u(1.2), T.h);
      p.rect(0, u(13.6), W, 1, T.h).rect(0, u(13.6) + 1, W, u(1.6), T.l);
      p.rect(0, u(17.6), W, u(2.4), T.d).rect(0, u(20), W, u(2), T.d2);
      // reflexo do céu e do chão na lateral (faixas diagonais)
      for (const [x0, w0] of [[8, 5], [16, 2], [44, 6], [53, 2]]) p.poly([[u(x0), u(15.2)], [u(x0 + w0), u(15.2)], [u(x0 + w0 - 2), u(17.6)], [u(x0 - 2), u(17.6)]], P.mix(T.b, '#cfe4f2', 0.25));
      cx.globalCompositeOperation = 'source-over';
      // vidros
      const glass = '#2c4458', gl = '#5e86a3', gh = '#a9cbe0';
      p.poly([[u(16.2), u(11)], [u(23.6), u(4)], [u(34.5), u(4)], [u(34.5), u(11)]], glass);
      p.poly([[u(36.5), u(11)], [u(36.5), u(4)], [u(47.6), u(4)], [u(54.6), u(11)]], glass);
      p.poly([[u(18), u(11)], [u(23.8), u(5.2)], [u(26.6), u(5.2)], [u(20.6), u(11)]], gl);
      p.poly([[u(38.5), u(11)], [u(44.5), u(4.6)], [u(46.6), u(4.6)], [u(40.6), u(11)]], gl);
      p.poly([[u(22), u(11)], [u(28), u(5.2)], [u(28.8), u(5.2)], [u(22.8), u(11)]], gh);
      p.poly([[u(42), u(11)], [u(48), u(5.2)], [u(48.8), u(5.6)], [u(42.8), u(11)]], gh);
      p.hline(u(16.4), u(11) - 1, u(38), '#1b2b38');
      // colunas, borrachas, portas
      p.rect(u(34.5), u(3.6), u(2), u(7.6), T.d2).rect(u(34.5), u(3.6), 1, u(7.6), T.d);
      p.hline(u(23), u(3.4), u(25), T.h);
      const door = T.d2;
      p.line(u(35.5), u(11.4), u(35.5), u(20.6), door).line(u(56), u(11.2), u(55.4), u(20.6), door).line(u(17), u(11.4), u(17.6), u(17), door);
      p.hline(u(17.6), u(20.6), u(37.8), door);
      p.rect(u(29.5), u(14.6), u(3.2), u(0.8), '#d9dde2').hline(u(29.5), u(14.6) + u(0.8), u(3.2), T.d2);
      p.rect(u(49.5), u(14.6), u(3.2), u(0.8), '#d9dde2').hline(u(49.5), u(14.6) + u(0.8), u(3.2), T.d2);
      // retrovisor
      p.poly([[u(54), u(9)], [u(57.6), u(8.6)], [u(58), u(11)], [u(54.6), u(11)]], T.b); p.hline(u(54.4), u(9), u(3), T.h);
      // para-choques cromados
      cylH(p, u(70), u(17.4), u(6), u(2.4), '#b9c0c8', true); cylH(p, 0, u(17.4), u(5), u(2.4), '#b9c0c8', true);
      p.rect(u(73), u(19.8), u(3), u(1), '#2a2d33').rect(0, u(19.8), u(3), u(1), '#2a2d33');
      // faróis, lanternas, seta
      p.rect(u(73.6), u(13.2), u(2.2), u(2.4), '#fff1b8').rect(u(73.6), u(13.2), u(1), u(1), '#ffffff').rect(u(72.6), u(13.4), u(1), u(2), '#f39c3a');
      p.rect(u(0.2), u(13.2), u(1.8), u(3), '#c0262b').rect(u(0.2), u(13.2), u(1.8), u(1), '#ff6b5e').rect(u(0.2), u(15.4), u(1.8), u(0.8), '#f3a03a');
      // frisos e maçaneta do tanque
      p.rect(u(8), u(13), u(2.4), u(1.6), T.d).hline(u(8), u(13), u(2.4), T.h);
      // caixas de roda e rodas
      for (const wx of [16.5, 61]) {
        const wc = u(wx), wy = Hh - u(5.4);
        p.ellipse(wc, wy, u(7), u(7), '#16161c');
        p.ellipse(wc, wy, u(5.4), u(5.4), '#1f1f25');
        // pneu com banda de rodagem
        for (let a = 0; a < 16; a++) { const an = a / 16 * Math.PI * 2; p.px(R(wc + Math.cos(an) * u(4.9)), R(wy + Math.sin(an) * u(4.9)), '#34343c'); }
        // calota com raios
        p.ball(wc, wy, u(3.4), u(3.4), '#aab2bb');
        p.ellipse(wc, wy, u(2.4), u(2.4), '#6c747d');
        for (let a = 0; a < 5; a++) { const an = a / 5 * Math.PI * 2 - 0.3; p.line(wc, wy, R(wc + Math.cos(an) * u(2.6)), R(wy + Math.sin(an) * u(2.6)), '#d4dae0'); }
        p.ball(wc, wy, u(1), u(1), '#e6eaee');
        p.hline(R(wc - u(1.6)), R(wy - u(3)), u(2.2), '#eef2f5');
      }
    });
    // sombra no chão
    c.fillStyle = 'rgba(14,10,30,0.28)'; P.painter(c).ellipse(X + W / 2, Y + Hh - 1, W / 2 - u(1), u(1.6), c.fillStyle);
    c.drawImage(s, X - 1, Y - 1);
  };

  A.ponto = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S, u = (n) => R(n * S), lit = env.night > 0.25;
    const s = spr('ponto' + W + 'x' + Hh + (lit ? 'on' : ''), W, Hh, (p) => {
      // vidro do fundo (translúcido)
      p.rect(u(4), u(4), W - u(8), u(20), 'rgba(170,215,235,0.42)');
      p.line(u(26), u(5), u(31), u(23), 'rgba(255,255,255,0.55)').line(u(28), u(5), u(33), u(23), 'rgba(255,255,255,0.3)');
      p.hline(u(4), u(24), W - u(8), '#6b7c86');
      // painel de anúncio luminoso (pão de queijo da padaria)
      const ax = u(6), ay = u(6), aw = u(14), ah = u(16);
      p.rect(ax - 1, ay - 1, aw + 2, ah + 2, '#2f3a42');
      p.bands(ax, ay, aw, ah, lit ? '#ffe7a6' : '#f7c75a', lit ? '#ffb347' : '#e68a2e', 4);
      p.ball(ax + aw / 2, ay + ah * 0.42, u(4), u(3), '#e8b45c');
      p.ball(ax + aw / 2 - u(3), ay + ah * 0.55, u(2.6), u(2.2), '#dca04a');
      p.ball(ax + aw / 2 + u(3.2), ay + ah * 0.56, u(2.6), u(2.2), '#dca04a');
      p.rect(ax + u(1), ay + ah - u(4), aw - u(2), u(2.6), '#7b2e1f');
      text(p, 'PÃO', ax + R((aw - textW('PÃO', 1)) / 2), ay + ah - u(3.8), 1, '#fff2c8');
      // tabela de horários
      p.rect(u(24), u(7), u(7), u(9), '#f2f0e8').rect(u(24), u(7), u(7), u(1.4), '#2a64a8');
      for (let i = 0; i < 4; i++) p.hline(u(25), u(10) + i * u(1.4), u(4.5 - (i % 2)), '#8a8f96');
      // postes
      cylV(p, u(1.5), u(3), u(2), Hh - u(3), '#6f7f89', true);
      cylV(p, W - u(3.5), u(3), u(2), Hh - u(3), '#6f7f89', true);
      // banco
      cylH(p, u(21), u(25), u(16), u(1.6), '#8a9aa4', true);
      p.rect(u(22), u(26.6), u(1), Hh - u(26.6), '#55626b').rect(u(35), u(26.6), u(1), Hh - u(26.6), '#55626b');
      // cobertura
      p.rect(-0, 0, W, u(3), '#3a5568');
      p.hline(0, 0, W, '#7ea3bb').hline(0, 1, W, '#5d8099').hline(0, u(3) - 1, W, '#24394a');
      p.rect(u(3), u(3), W - u(6), u(0.8), lit ? '#fff1c4' : '#9fb3c0');
      // placa de ônibus
      p.rect(W - u(10), u(4), u(6), u(5), '#f1f1ea').rect(W - u(9.4), u(4.6), u(4.8), u(3.8), '#2a64a8');
      p.rect(W - u(8.8), u(5.2), u(3.6), u(1.8), '#f1f1ea').rect(W - u(8.8), u(5.6), u(3.6), u(0.6), '#8fc3e8');
      p.px(W - u(8.2), u(7.4), '#f1f1ea').px(W - u(5.8), u(7.4), '#f1f1ea');
    });
    c.drawImage(s, X - 1, Y - 1);
    if (lit) { glow(c, X + u(13), Y + u(14), u(13), env.night * 0.8, '255,200,120'); glow(c, X + W / 2, Y + u(4), u(10), env.night * 0.6, '255,236,190'); }
  };

  A.barreira = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S, u = (n) => R(n * S);
    const s = spr('barreira' + W + 'x' + Hh, W, Hh, (p, cx) => {
      // cavaletes em A
      for (const lx of [u(4), W - u(4)]) {
        limb(p, lx, u(1.5), lx - u(2.6), Hh - u(0.5), u(0.7), u(0.8), '#e6e6e0', 2);
        limb(p, lx, u(1.5), lx + u(2.6), Hh - u(0.5), u(0.7), u(0.8), '#c9c9c2', 3);
        p.rect(lx - u(3.4), Hh - u(1), u(1.8), u(1), '#2b2b30').rect(lx + u(1.6), Hh - u(1), u(1.8), u(1), '#2b2b30');
      }
      // tábuas listradas na diagonal
      const plank = (y0, h0) => {
        p.rect(0, y0, W, h0, '#f3f3ee');
        cx.globalCompositeOperation = 'source-atop';
        for (let x = -u(6); x < W + u(6); x += u(6)) p.poly([[x, y0 + h0], [x + u(3), y0 + h0], [x + u(3) + h0, y0], [x + h0, y0]], '#d6342c');
        p.rect(0, y0, W, 1, 'rgba(255,255,255,0.55)').rect(0, y0 + h0 - 1, W, 1, 'rgba(40,20,40,0.3)');
        cx.globalCompositeOperation = 'source-over';
      };
      plank(u(2), u(4)); plank(u(8), u(2.4));
      // suporte da lanterna
      p.rect(u(5), 0, u(1.2), u(2), '#3a3a40');
    });
    c.drawImage(s, X - 1, Y - 1);
    // lanterna âmbar piscando
    const on = Math.sin(env.time * 5) > 0;
    const pn = P.painter(c);
    pn.ball(X + u(5.6), Y - u(0.8), u(1.4), u(1.2), on ? '#ffb02e' : '#a8641c');
    if (on) glow(c, X + u(5.6), Y - u(0.8), u(6), 0.7 + env.night, '255,170,60');
  };

  /* ======================= PRAÇA ======================= */
  // tufos da copa: [cx, cy, w, h] em unidades relativas à caixa da árvore, camada (0 = fundo)
  const TUFTS = [
    [6, 31, 30, 22, 0], [52, 29, 30, 22, 0], [29, 11, 42, 26, 0], [30, 34, 50, 20, 0],
    [4, 36, 24, 17, 1], [54, 35, 24, 17, 1], [15, 21, 30, 22, 1], [44, 18, 30, 22, 1],
    [27, 4, 32, 18, 1], [31, 36, 28, 12, 1], [31, 26, 28, 18, 1], [20, 10, 22, 14, 1],
  ];
  A.arvore = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S, u = (n) => R(n * S), t = env.time;
    const pad = u(14);
    const drawTufts = (layer) => TUFTS.forEach(([tx, ty, tw, th, L], i) => {
      if (L !== layer) return;
      const w = u(tw), h = u(th);
      const b = blob('tuft' + S + '_' + i, w, h, L ? LEAF : LEAF_BACK, 40 + i * 13, u(L ? 3.4 : 4));
      const amp = 0.6 + (1 - ty / 45) * 1.4;
      const sx = R(Math.sin(t * 1.3 + i * 0.9) * amp + Math.sin(t * 3.1 + i * 2.1) * 0.5);
      const sy = Math.sin(t * 1.3 + i * 0.9) > 0.75 ? 1 : 0;
      c.drawImage(b, X + u(tx) - R(w / 2) - 1 + sx, Y + u(ty) - R(h / 2) - 1 + sy);
    });
    drawTufts(0);
    // tronco com raízes e galhos abertos em Y
    const trunk = spr('tronco' + W + 'x' + Hh, W + pad * 2, Hh, (p) => {
      const o = pad, bark = '#6e4a30';
      limb(p, o + u(30), Hh, o + u(29), u(52), u(3.6), u(3), bark, 1);
      limb(p, o + u(29), u(53), o + u(30.5), u(40), u(3), u(2.4), bark, 2);
      limb(p, o + u(29), u(46), o + u(15), u(33), u(1.9), u(1.1), bark, 3);
      limb(p, o + u(30.5), u(42), o + u(45), u(29), u(1.9), u(1.1), bark, 4);
      limb(p, o + u(30.5), u(41), o + u(32), u(26), u(1.7), u(1), bark, 5);
      limb(p, o + u(16.5), u(34.5), o + u(8), u(31), u(1), u(0.6), bark, 6);
      limb(p, o + u(44), u(30), o + u(52), u(27), u(1), u(0.6), bark, 7);
      // raízes saltadas
      limb(p, o + u(28), Hh - u(3), o + u(22), Hh, u(1.6), u(0.8), bark, 8);
      limb(p, o + u(32), Hh - u(3), o + u(38.5), Hh, u(1.6), u(0.8), bark, 9);
      // nó e musgo
      p.ellipse(o + u(30.6), u(60), u(0.9), u(1.3), '#3a2618').px(o + u(30.2), u(59.2), '#9a7350');
      p.clusters(o + u(27), u(56), u(2), u(10), '#4f6b34', 5, 2, 31);
    });
    c.drawImage(trunk, X - pad - 1, Y - 1);
    drawTufts(1);
  };

  A.arbusto = function (c, d, X, Y, env, S) {
    const u = (n) => R(n * S);
    const kind = d.w >= 20 ? 'fruta' : 'flor'; // um com laranjinhas, outro florido
    const w = d.w * S + u(4), h = d.h * S + u(7);
    const b = blob('bush' + kind + w + 'x' + h, w, h, LEAF, 90 + w, u(2.6), (p, inside, lit) => {
      for (let i = 0; i < (kind === 'fruta' ? 9 : 16); i++) {
        const x = R(u(2) + H(i, w, 1) * (w - u(4))), y = R(u(2) + H(i, w, 2) * (h * 0.55));
        if (!inside(x, y) || !inside(x + 2, y + 2)) continue;
        if (kind === 'fruta') { p.ball(x + 1.5, y + 1.5, 1.8, 1.8, '#f08a1c'); p.px(x + 1, y + 1, '#ffd38a'); p.px(x + 1, y - 1, '#2d5a2a'); }
        else { const cl = H(i, w, 3) > 0.4 ? '#f28bb5' : '#fff1f4'; p.px(x + 1, y, cl).px(x, y + 1, cl).px(x + 2, y + 1, cl).px(x + 1, y + 2, cl).px(x + 1, y + 1, '#ffd84d'); }
      }
    }, true);
    const sway = R(Math.sin(env.time * 1.7 + d.x * 0.1) * 0.8);
    c.drawImage(b, X - u(2) - 1 + sway, Y + d.h * S - h - 1 + 1);
  };

  A.banco_ok = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S, u = (n) => R(n * S), top = u(4.5);
    const s = spr('banco' + W + 'x' + Hh, W, Hh + top, (p) => {
      const wood = '#a5713f', T = P.tones(wood), iron = '#3a3f46';
      const slat = (y, h, seed) => {
        p.rect(0, y, W, h, T.b).hline(0, y, W, T.l).hline(0, y + h - 1, W, T.d);
        p.clusters(1, y + 1, W - 2, Math.max(1, h - 2), T.d, 8, 3, seed).clusters(1, y + 1, W - 2, Math.max(1, h - 2), T.l, 4, 3, seed + 1);
        p.px(u(4), y + 1, T.o).px(W - u(4), y + 1, T.o);
      };
      // laterais de ferro fundido
      for (const lx of [u(3), W - u(4.5)]) {
        p.rect(lx, 0, u(1.2), top + Hh, iron).vline(lx, 0, top + Hh, '#5c636c');
        p.line(lx + u(1), top + u(6.5), lx + u(2.2), top + Hh - 1, iron).line(lx + u(1), top + u(6.5) + 1, lx + u(2.2), top + Hh, iron);
        p.rect(lx - u(0.8), top + Hh - u(0.8), u(3.6), u(0.8), '#2a2e33');
        p.rect(lx - u(0.4), top + u(3), u(2.4), u(0.8), iron);
      }
      // encosto e assento
      slat(0, u(1.6), 1); slat(u(2.4), u(1.6), 2);
      p.rect(0, top + u(3.6), W, u(1.4), T.l); p.hline(0, top + u(3.6), W, T.h);
      slat(top + u(5), u(1.6), 3);
      p.hline(0, top + u(6.6), W, T.o);
    });
    c.drawImage(s, X - 1, Y - top - 1);
  };

  A.placa = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S, u = (n) => R(n * S), msg = (d.text || '').toUpperCase();
    const s = spr('placa' + msg + W + 'x' + Hh, W, Hh, (p) => {
      cylV(p, u(8), u(8), u(2), Hh - u(8), '#7f8a90', true);
      p.rect(u(7), Hh - u(1), u(4), u(1), '#4f585d');
      p.rect(0, 0, W, u(9), '#2b7a48');
      p.hline(0, 0, W, '#4fa56a').rect(0, u(9) - 1, W, 1, '#1b5532');
      p.rect(2, 2, W - 4, 1, '#eef4ea').rect(2, u(9) - 3, W - 4, 1, '#eef4ea').rect(2, 2, 1, u(9) - 4, '#eef4ea').rect(W - 3, 2, 1, u(9) - 4, '#eef4ea');
      const tw = textW(msg, 1);
      text(p, msg, R((W - tw) / 2), R(u(4.5) - 4), 1, '#ffffff', '#1b5532');
      p.px(u(1), u(1), '#b9c7bd').px(W - u(1) - 1, u(1), '#b9c7bd');
    });
    c.drawImage(s, X - 1, Y - 1);
  };

  /* ======================= PADARIA ======================= */
  A.toldo = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S, u = (n) => R(n * S);
    const s = spr('toldo' + W + 'x' + Hh, W, Hh + u(1), (p) => {
      const red = P.tones('#cf3b33'), cr = P.tones('#f4ecda');
      const sw = u(3), y0 = u(1.6), y1 = u(9);
      for (let x = 0, i = 0; x < W; x += sw, i++) {
        const T = i % 2 ? cr : red, w = Math.min(sw, W - x);
        // pano: sombra no topo, claro no meio, dobra embaixo
        p.rect(x, y0, w, y1 - y0, T.b).rect(x, y0, w, u(1), T.d).rect(x, y0 + u(3), w, u(2), T.l).rect(x, y1 - u(1), w, u(1), T.d);
        p.vline(x, y0, y1 - y0, T.d);
        // babado arredondado
        for (let j = 0; j < u(3); j++) {
          const k = j / u(3), hw = (w / 2) * Math.sqrt(1 - k * k);
          p.rect(R(x + w / 2 - hw), y1 + j, R(hw * 2), 1, j < u(1) ? T.b : T.d);
        }
      }
      // barra de ferro e suportes
      cylH(p, 0, 0, W, u(1.6), '#4a3a35', true);
      for (const bx of [u(1), W - u(2)]) p.rect(bx, 0, u(1), u(9), '#3a2c28');
    });
    c.drawImage(s, X - 1, Y - 1);
  };

  A.vaso_rua = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S, u = (n) => R(n * S);
    const plant = blob('vasoPlanta' + W, W + u(2), u(9), LEAF, 7, u(1.8), (p, inside) => {
      for (let i = 0; i < 7; i++) {
        const x = R(2 + H(i, 9, 1) * (W - 4)), y = R(1 + H(i, 9, 2) * u(4));
        if (inside(x, y) && inside(x + 2, y + 2)) { p.rect(x, y, 2, 2, '#e8463c').px(x, y, '#ff9a8a').px(x + 1, y + 1, '#a82a24'); }
      }
    });
    const pot = spr('vasoRua' + W + 'x' + Hh, W, u(6), (p) => {
      const T = P.tones('#a9a49a');
      p.poly([[0, 0], [W, 0], [W - u(1), u(6)], [u(1), u(6)]], T.b);
      p.rect(0, 0, W, u(1.2), T.l).hline(0, 0, W, T.h).rect(0, u(1.2), W, 1, T.d);
      p.rect(u(1), u(2), u(1), u(3.5), T.l).rect(W - u(2.2), u(2), u(1), u(3.5), T.d);
      p.clusters(u(1), u(2), W - u(2), u(3.5), T.d, 5, 2, 4);
    });
    const sway = R(Math.sin(env.time * 2 + d.x) * 0.6);
    c.drawImage(plant, X - u(1) - 1 + sway, Y - u(1) - 1);
    c.drawImage(pot, X - 1, Y + u(6) - 1);
  };

  A.lixeira = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S, u = (n) => R(n * S);
    const s = spr('lixeira' + W + 'x' + Hh, W, Hh, (p) => {
      // poste curto
      cylV(p, R(W / 2 - u(1)), u(9), u(2), Hh - u(9), '#5d666e', true);
      p.rect(R(W / 2 - u(2)), Hh - u(0.8), u(4), u(0.8), '#3e454b');
      // cesto
      cylV(p, u(0.5), u(1.6), W - u(1), u(8), '#2e8b55', true);
      p.rect(u(0.5), u(9.6) - 1, W - u(1), 1, '#1a5434');
      cylH(p, 0, 0, W, u(1.8), '#279050', true);
      p.rect(u(2), u(1.8), W - u(4), u(0.8), '#123a24');
      // faixa branca com setinhas de reciclagem
      p.rect(u(0.5), u(4.4), W - u(1), u(2.2), '#eef2ee').hline(u(0.5), u(4.4) + u(2.2), W - u(1), '#b9c3bb');
      const mx = R(W / 2);
      p.px(mx - 2, u(5.6), '#2e8b55').px(mx - 1, u(5), '#2e8b55').px(mx, u(4.8), '#2e8b55').px(mx + 1, u(5), '#2e8b55').px(mx + 2, u(5.6), '#2e8b55').px(mx, u(5.9), '#2e8b55');
    });
    c.drawImage(s, X - 1, Y - 1);
  };

  A.hidrante = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S, u = (n) => R(n * S);
    const s = spr('hidrante' + W + 'x' + Hh, W, Hh, (p) => {
      const red = '#cc3329', T = P.tones(red);
      p.ball(W / 2, u(1.8), u(1.9), u(1.6), red);
      p.rect(R(W / 2 - u(0.5)), 0, u(1), u(0.8), T.d);
      cylV(p, u(0.6), u(2.4), W - u(1.2), u(0.9), red, true);
      cylV(p, u(1), u(3.2), W - u(2), u(5.8), red, true);
      // bocais laterais com tampa e corrente
      cylH(p, 0, u(4.4), W, u(1.8), red, true);
      p.rect(0, u(4.4), u(0.5), u(1.8), T.d2).rect(W - u(0.5), u(4.4), u(0.5), u(1.8), T.d2);
      p.px(u(1.4), u(6.6), '#d4c070').px(u(1.8), u(7.2), '#d4c070');
      cylV(p, 0, Hh - u(1.1), W, u(1.1), '#9e2a22', true);
      p.px(u(1.5), Hh - u(0.6), '#e7d9a0').px(W - u(1.5), Hh - u(0.6), '#e7d9a0');
    });
    c.drawImage(s, X - 1, Y - 1);
  };

  /* ======================= VEÍCULOS E BICHOS ======================= */
  /** Moto de entrega: caixa 24×20; desenha o entregador (em unidades) e a moto (em pixels finos). */
  SP.moto = function (c, x, y, facing, anim, hop) {
    const f = facing >= 0 ? 1 : -1;
    const lift = hop ? Math.round(hop * 3) : 0;
    const fr = Math.floor(anim / 2) % 4;
    const S = G.HI || 2, u = (n) => R(n * S);
    c.save();
    const bx = Math.round(x) + (f > 0 ? -4 : 28), by = Math.round(y) - 20 + 2 - lift;
    c.translate(bx, by); if (f < 0) c.scale(-1, 1);
    G.Characters.draw(c, 12, 23, { state: 'sit', facing: 1, t: 0, hairStyle: 'helmet', carrying: true, jacket: true, shadow: false,
      pal: { skin: '#8d5a3b', hair: '#111', shirt: '#2c3e50', pants: '#34495e', shoe: '#222', belt: '#222' } });
    const body = spr('motoCorpo' + S, u(34), u(40), (p, cx) => {
      const red = '#c8302f', T = P.tones(red), chrome = '#c3cad2';
      const wy = u(33);
      // garfo dianteiro e balança traseira
      limb(p, u(22.4), u(17), u(27), wy, u(0.8), u(0.7), chrome, 1);
      limb(p, u(7), wy, u(15), u(29.5), u(1), u(1), '#3a3d44', 2);
      // motor com aletas e escapamento cromado
      p.rect(u(12), u(26.5), u(7), u(5), '#4b5059');
      for (let i = 0; i < 4; i++) p.hline(u(12.5), u(27) + i * u(1.1), u(6), '#8b929b');
      p.rect(u(13), u(31.5), u(5), u(1), '#2f3238');
      limb(p, u(16), u(31.5), u(9), u(31), u(0.6), u(0.7), chrome, 3);
      limb(p, u(9), u(31), u(1.5), u(28.6), u(0.9), u(1.1), chrome, 4);
      p.rect(u(1), u(28), u(1), u(1.6), '#1d1f24');
      // carenagem lateral, tanque e frente
      p.poly([[u(8), u(23)], [u(17), u(23)], [u(18.5), u(26.5)], [u(10), u(27.5)], [u(7.5), u(25.5)]], T.b);
      p.hline(u(8.5), u(23.5), u(8), T.l).hline(u(10), u(27.5) - 1, u(8), T.d);
      p.poly([[u(15), u(22)], [u(21), u(20.5)], [u(23), u(23)], [u(21), u(25.5)], [u(16), u(25.5)]], T.b);
      p.poly([[u(15.6), u(22)], [u(20.6), u(20.8)], [u(21), u(21.8)], [u(16), u(22.8)]], T.h);
      p.poly([[u(22), u(18)], [u(26.5), u(18.6)], [u(28.5), u(22)], [u(25), u(25)], [u(22.5), u(23.5)]], T.b);
      p.line(u(22.4), u(18.2), u(26.4), u(18.8), T.h).line(u(25), u(25), u(28.4), u(22.2), T.d2);
      p.rect(u(9), u(24.6), u(4), u(1), '#f6f1e4');
      // farol, seta, painel
      p.rect(u(27.4), u(19.4), u(1.6), u(2.2), '#fff2b8').px(u(27.6), u(19.6), '#ffffff');
      p.rect(u(26.4), u(17.6), u(1.2), u(0.9), '#f39c3a');
      // banco
      p.poly([[u(5.5), u(22)], [u(9), u(21)], [u(16), u(21.4)], [u(16.5), u(23)], [u(6), u(23.2)]], '#24242b');
      p.hline(u(7), u(21.4), u(8), '#4a4a55');
      // guidão e retrovisor
      p.rect(u(21.4), u(16), u(3.6), u(1), '#1d1f24'); p.line(u(23.4), u(16), u(22.6), u(12.6), '#55595f'); p.rect(u(21.6), u(12), u(2), u(1.2), '#1d1f24');
      // paralama traseiro, rack e baú
      p.poly([[u(1), u(25)], [u(9), u(24.6)], [u(10), u(26.2)], [u(2), u(26.6)]], T.d);
      p.rect(u(0.4), u(24.6), u(1.4), u(1.4), '#e0302a').px(u(0.6), u(24.8), '#ff8a7a');
      p.rect(u(1), u(23), u(10), u(0.8), '#2f3238');
      const box = P.tones('#ee7f1f');
      p.rect(u(0.4), u(11), u(11), u(12), box.b);
      p.rect(u(0.4), u(11), u(11), u(1.6), box.l).hline(u(0.4), u(11), u(11), box.h);
      p.rect(u(0.4), u(12.6), u(11), 1, box.d2);
      p.rect(u(0.4), u(11), u(1), u(12), box.l).rect(u(10.4), u(11), u(1), u(12), box.d);
      p.rect(u(0.4), u(22), u(11), u(1), box.d);
      p.rect(u(3), u(15.4), u(6), u(4), '#fff3d6').rect(u(4.2), u(16.4), u(3.6), u(2), '#ee7f1f');
      p.px(u(5.4), u(16.8), '#fff3d6').px(u(6.4), u(16.8), '#fff3d6');
      p.rect(u(5.2), u(13), u(1.6), u(1), '#3a3d44');
    });
    const wheel = spr('motoRoda' + S + '_' + fr, u(10), u(10), (p) => {
      const cxw = u(5), r = u(4.8);
      p.ellipse(cxw, cxw, r, r, '#17171c');
      for (let a = 0; a < 14; a++) { const an = a / 14 * Math.PI * 2; p.px(R(cxw + Math.cos(an) * (r - 1.5)), R(cxw + Math.sin(an) * (r - 1.5)), '#33333b'); }
      p.ellipse(cxw, cxw, u(3), u(3), '#2a2b31');
      p.ellipse(cxw, cxw, u(2.6), u(2.6), '#8a929b');
      p.ellipse(cxw, cxw, u(2), u(2), '#3a3d44');
      for (let a = 0; a < 3; a++) { const an = a / 3 * Math.PI * 2 + fr * Math.PI / 6; p.line(cxw, cxw, R(cxw + Math.cos(an) * u(2.3)), R(cxw + Math.sin(an) * u(2.3)), '#c9d0d8'); }
      p.ellipse(cxw, cxw, u(0.7), u(0.7), '#e2e7ec');
      p.hline(cxw - u(1.2), cxw - u(2.4), u(1.6), '#b8c0c8');
    });
    G.hi(c, () => {
      c.drawImage(wheel, u(2) - 1, u(28) - 1);
      c.drawImage(wheel, u(22) - 1, u(28) - 1);
      c.drawImage(body, -1, -1);
    });
    c.restore();
  };

  /** Vira-lata caramelo (caixa ~14×8, patas no chão em y + 8). */
  SP.dog = function (c, x, y, dir, anim) {
    const f = dir >= 0 ? 1 : -1;
    const fr = Math.floor(anim / 1.6) % 4;
    const S = G.HI || 2, u = (n) => R(n * S);
    const s = spr('dog' + S + '_' + fr, u(17), u(12), (p) => {
      const fur = '#c98a4a', T = P.tones(fur), belly = '#ecc890';
      const k = [0, 1, 0, -1][fr];
      // pernas: as de trás (longe) mais escuras
      const leg = (lx, sw, col, colL) => {
        p.line(u(lx), u(7.4), u(lx + sw * 0.6), u(9.4), col).line(u(lx) + 1, u(7.4), u(lx + sw * 0.6) + 1, u(9.4), col);
        p.line(u(lx + sw * 0.6), u(9.4), u(lx + sw), u(11) - 1, col).line(u(lx + sw * 0.6) + 1, u(9.4), u(lx + sw) + 1, u(11) - 1, colL);
        p.rect(u(lx + sw), u(11) - 1, 3, 1, T.d2);
      };
      leg(4.4, -k * 0.8, T.d2, T.d); leg(11, k * 0.8, T.d2, T.d);
      // rabo enrolado abanando
      const tw = fr % 2;
      p.line(u(3.4), u(5), u(1.6), u(3 - tw * 0.6), T.d).line(u(1.6), u(3 - tw * 0.6), u(2.2), u(1.4 - tw * 0.4), T.b).px(u(2.2), u(1.4 - tw * 0.4), T.l);
      p.line(u(3.4), u(5) + 1, u(1.6) + 1, u(3 - tw * 0.6) + 1, T.b);
      // corpo
      p.ball(u(7.6), u(5.6), u(4.6), u(2.2), fur);
      p.rect(u(5), u(7.2), u(5), 1, belly);
      p.clusters(u(4), u(3.6), u(6), u(1), T.d, 3, 2, 5);
      leg(5.6, k * 0.8, T.d, fur); leg(12, -k * 0.8, T.d, fur);
      // cabeça, focinho, orelha caída
      p.ball(u(12.8), u(3.6), u(2.4), u(2.1), fur);
      p.ball(u(15), u(4.4), u(1.4), u(1), T.l);
      p.rect(u(15.6), u(3.8), u(0.9), u(0.8), '#2b1d14');
      p.px(u(13.4), u(3), '#1b1414').px(u(13.4) - 1, u(3) - 1, '#fff4dc');
      p.poly([[u(11), u(1.8)], [u(12.6), u(1.4)], [u(12.2), u(4.6)], [u(11.2), u(4)]], T.d);
      p.px(u(15.2), u(5.2), '#7a3a2c');
      // coleira vermelha
      p.rect(u(10.8), u(4.6), u(1), u(2.2), '#c0392b').px(u(11.2), u(6.6), '#f1c40f');
    });
    G.hi(c, () => {
      const X = R((x - 2) * S), Yy = R((y - 3) * S);
      if (f > 0) c.drawImage(s, X - 1, Yy - 1);
      else { c.save(); c.translate(R((x + 14) * S) + 1, Yy - 1); c.scale(-1, 1); c.drawImage(s, 0, 0); c.restore(); }
    });
  };

  /** Pombo da cidade: bicando no chão ou batendo asas. (x, y) = canto; patas em y + 3. */
  SP.pigeon = function (c, x, y, fly, t, dir) {
    const f = dir >= 0 ? 1 : -1;
    const S = G.HI || 2, u = (n) => R(n * S);
    let key, frame;
    if (fly > 0) { frame = Math.sin(t * 30) > 0 ? 1 : 0; key = 'pomboV' + S + frame; }
    else { frame = Math.sin(t * 4 + x * 0.37) > 0.7 ? 1 : 0; key = 'pomboC' + S + frame; }
    const s = spr(key, u(7), u(7), (p) => {
      const grey = '#8e95a6', T = P.tones(grey), wing = '#a3aabb';
      const by = u(3.6);
      // cauda escura
      p.poly([[u(0), by], [u(2), by - u(0.6)], [u(2.2), by + u(0.8)], [u(0.2), by + u(1)]], '#4d5464');
      // corpo
      p.ball(u(3), by + u(0.2), u(2.2), u(1.4), grey);
      if (fly > 0) {
        // asas batendo
        if (frame) p.poly([[u(2), by - u(0.4)], [u(4), by - u(0.4)], [u(1.6), by - u(3.4)], [u(0.6), by - u(3)]], wing);
        else p.poly([[u(2), by + u(0.4)], [u(4), by + u(0.4)], [u(2), by + u(3)], [u(1), by + u(2.6)]], T.d);
      } else {
        p.poly([[u(1.6), by - u(0.6)], [u(4), by - u(0.8)], [u(3.6), by + u(0.8)], [u(1.4), by + u(0.6)]], wing);
        p.hline(u(2), by, u(1.4), '#3a3f4c').hline(u(2.2), by + u(0.5), u(1.2), '#3a3f4c');
        // patinhas rosadas
        p.rect(u(2.6), by + u(1.2), 1, u(1.4), '#d9707a').rect(u(3.4), by + u(1.2), 1, u(1.4), '#d9707a');
        p.hline(u(2.6), by + u(2.6) - 1, 2, '#b85560').hline(u(3.4), by + u(2.6) - 1, 2, '#b85560');
      }
      // pescoço furta-cor e cabeça
      const hx = fly > 0 ? u(5) : frame ? u(5.4) : u(4.8), hy = fly > 0 ? by - u(0.6) : frame ? by + u(1.2) : by - u(1.6);
      p.line(u(4), by - u(0.2), hx, hy, '#5d7f6a').line(u(4) + 1, by, hx, hy + 1, '#7a5f8e');
      p.ball(hx, hy, u(0.9), u(0.9), '#6f7688');
      p.px(hx + 1, hy - 1, '#e8862c');
      p.rect(hx + u(0.8), hy, u(0.8), 1, '#3a3438');
    });
    G.hi(c, () => {
      const X = R(x * S), Yy = R((y + 3) * S) - u(6.2);
      if (f > 0) c.drawImage(s, X - 1, Yy - 1);
      else { c.save(); c.translate(X + u(5) + 1, Yy - 1); c.scale(-1, 1); c.drawImage(s, 0, 0); c.restore(); }
    });
  };
})(window.VG = window.VG || {});

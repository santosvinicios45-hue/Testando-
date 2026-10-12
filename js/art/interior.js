/* =====================================================================
 * Móveis e objetos de dentro dos prédios na grade fina.
 * Cada desenhista recebe (c, d, X, Y, env, S): X/Y = canto superior em
 * pixels de tela, caixa de d.w*S × d.h*S. Partes fixas vão em sprites
 * com cache (Pix.sprite, contorno automático); partes animadas (tela da
 * TV, LEDs, luz) são pintadas por cima a cada quadro.
 * ===================================================================== */
(function (G) {
  'use strict';
  G.ArtDecor = G.ArtDecor || {};
  const A = G.ArtDecor;
  const P = G.Pix;
  const tn = (hex) => P.tones(hex);
  const H = (a, b, c) => P.hash(a, b, c);

  /**
   * Sprite em cache numa caixa W×H com margens extras m = {l,t,r,b} (px)
   * para partes que saem da caixa; fn(p, W, H, c) desenha com (0,0) no canto da caixa.
   */
  function blit(c, key, X, Y, W, Hh, fn, m) {
    m = m || {};
    const l = m.l || 0, t = m.t || 0, r = m.r || 0, b = m.b || 0;
    const cv = P.sprite('dec:' + key + ':' + W + 'x' + Hh, W + l + r + 2, Hh + t + b + 2, (p, cx) => {
      cx.translate(l + 1, t + 1); fn(p, W, Hh, cx);
    }, m.outline === false ? { outline: false } : undefined);
    c.drawImage(cv, X - l - 1, Y - t - 1);
  }
  const R = (c, x, y, w, h, col) => { if (w <= 0 || h <= 0) return; c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

  /* ---------- pequenos ajudantes de material ---------- */
  // painel em relevo (porta de armário): luz em cima/esquerda, sombra embaixo/direita
  function raised(p, x, y, w, h, T) {
    p.rect(x, y, w, h, T.b);
    p.hline(x, y, w, T.l); p.vline(x, y, h, T.l);
    p.hline(x, y + h - 1, w, T.d); p.vline(x + w - 1, y, h, T.d);
  }
  // rebaixo (moldura interna): sombra em cima/esquerda, luz embaixo/direita
  function sunk(p, x, y, w, h, T) {
    p.hline(x, y, w, T.d); p.vline(x, y, h, T.d);
    p.hline(x, y + h - 1, w, T.l); p.vline(x + w - 1, y, h, T.l);
  }
  // veio de madeira: tracinhos horizontais em grupos (nada de chuvisco)
  function grain(p, x, y, w, h, T, seed, n) {
    n = n || Math.max(2, Math.round(w * h / 40));
    for (let i = 0; i < n; i++) {
      const gx = x + Math.floor(H(i, seed, 1) * w), gy = y + Math.floor(H(i, seed, 2) * h);
      const gw = Math.min(2 + Math.floor(H(i, seed, 3) * 6), x + w - gx);
      p.hline(gx, gy, gw, H(i, seed, 4) > 0.35 ? T.d : T.l);
    }
  }
  // veio vertical (portas altas)
  function vgrain(p, x, y, w, h, T, seed, n) {
    n = n || Math.max(2, Math.round(w * h / 50));
    for (let i = 0; i < n; i++) {
      const gx = x + Math.floor(H(i, seed, 1) * w), gy = y + Math.floor(H(i, seed, 2) * h);
      const gh = Math.min(3 + Math.floor(H(i, seed, 3) * 8), y + h - gy);
      p.vline(gx, gy, gh, H(i, seed, 4) > 0.35 ? T.d : T.l);
    }
  }
  // puxador de metal horizontal / vertical
  function handleH(p, x, y, w) { p.hline(x, y, w, '#e6ebee'); p.hline(x, y + 1, w, '#7d878e'); }
  function handleV(p, x, y, h) { p.vline(x, y, h, '#e6ebee'); p.vline(x + 1, y, h, '#7d878e'); }

  /* ---------- fonte de pixel (letras bem nítidas) ---------- */
  const F3 = {
    '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'],
    '3': ['111', '001', '011', '001', '111'], '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'], '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '111'], W: ['10001', '10001', '10101', '10101', '01010'], C: ['011', '100', '100', '100', '011'],
    S: ['011', '100', '010', '001', '110'], A: ['010', '101', '111', '101', '101'], I: ['1', '1', '1', '1', '1'], 'Í': ['1', '1', '1', '1', '1'],
    D: ['110', '101', '101', '101', '110'], E: ['111', '100', '110', '100', '111'], ' ': ['0', '0', '0', '0', '0'],
  };
  const F5 = {
    P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'], A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'], R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    I: ['111', '010', '010', '010', '010', '010', '111'], O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'], C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
    S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'], N: ['10001', '11001', '10101', '10101', '10011', '10001', '10001'],
    L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'], T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    ' ': ['000', '000', '000', '000', '000', '000', '000'],
  };
  const textW = (s, F, k) => { let w = 0; for (const ch of s) { const g = F[ch] || F[' ']; w += (g[0].length + 1) * k; } return Math.max(0, w - k); };
  const canText = (s, F) => [...s].every((ch) => F[ch]);
  function text(p, s, x, y, F, col, k) {
    k = k || 1;
    for (const ch of s) {
      const g = F[ch] || F[' '];
      for (let j = 0; j < g.length; j++) for (let i = 0; i < g[j].length; i++) if (g[j][i] === '1') p.rect(x + i * k, y + j * k, k, k, col);
      x += (g[0].length + 1) * k;
    }
  }

  /* =================================================================
   * COZINHA
   * ================================================================= */
  A.geladeira = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    blit(c, 'geladeira', X, Y, W, Hh, (p) => {
      const T = tn('#e4e8eb'), split = 11 * S;
      // corpo com cantos arredondados em cima
      p.rect(1, 0, W - 2, Hh - 3, T.b); p.rect(0, 1, W, Hh - 4, T.b);
      p.rect(W - 4, 1, 4, Hh - 4, T.d); p.vline(W - 4, 1, Hh - 4, T.b);           // lateral em sombra
      p.vline(0, 1, Hh - 4, T.l); p.hline(1, 0, W - 5, T.h);
      p.vline(2, 3, split - 6, T.h); p.vline(2, split + 3, Hh - split - 12, T.h); // brilho do esmalte
      p.vline(3, 4, 4, T.h);
      // vão entre as portas
      p.hline(0, split, W, T.d2); p.hline(0, split + 1, W, T.l);
      p.rect(1, split - 2, W - 5, 1, T.d);
      // puxadores verticais
      handleV(p, W - 7, 4 * S, 5 * S); handleV(p, W - 7, split + 4 * S, 8 * S);
      p.px(W - 7, 4 * S - 1, T.d2); p.px(W - 7, split + 4 * S - 1, T.d2);
      // rodapé / grade de ventilação
      p.rect(1, Hh - 4, W - 2, 4, '#5d6670'); for (let i = 3; i < W - 3; i += 3) p.vline(i, Hh - 3, 2, '#3c434c');
      p.hline(1, Hh - 4, W - 2, '#7b858e');
      // desenho de criança preso com ímã vermelho
      const dx = 4, dy = split + 7;
      p.rect(dx, dy, 11, 12, '#fbf6ea'); p.hline(dx, dy + 11, 11, '#d9d0bd'); p.vline(dx + 10, dy, 12, '#e6dcc6');
      p.ball(dx + 8, dy + 3, 1.6, 1.6, '#f2c230');                                // sol
      p.poly([[dx + 1, dy + 7], [dx + 4, dy + 4], [dx + 7, dy + 7]], '#d9473d');   // telhado
      p.rect(dx + 2, dy + 7, 4, 3, '#3f7fc4'); p.px(dx + 3, dy + 8, '#fbf6ea');
      p.hline(dx, dy + 10, 10, '#5aa64a');
      p.rect(dx + 4, dy - 1, 3, 3, '#d63b3b'); p.px(dx + 4, dy - 1, '#ff8a80');
      // bilhete amarelo + ímãs redondos
      p.rect(5 * S - 2, 19 * S + 2, 8, 7, '#f4d04a'); p.hline(5 * S - 2, 19 * S + 2, 8, '#fbe58a');
      p.hline(5 * S - 1, 19 * S + 5, 5, '#c79b2a'); p.hline(5 * S - 1, 19 * S + 7, 4, '#c79b2a');
      p.ball(5 * S + 1, 19 * S + 1, 1.5, 1.5, '#3f8fd8');
      p.ball(9, 6, 1.6, 1.6, '#4fb05a'); p.ball(14, 8, 1.6, 1.6, '#e8834a');
      // calendariozinho no congelador
      p.rect(5, 9, 8, 9, '#ffffff'); p.rect(5, 9, 8, 2, '#d24a4a');
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) p.px(6 + i * 2, 12 + j * 2, '#9aa4ad');
    });
  };

  A.armario_alto = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    blit(c, 'armario_alto', X, Y, W, Hh, (p) => {
      const T = tn('#b38658');
      p.rect(0, 0, W, Hh, T.d); p.hline(0, Hh - 1, W, T.d2);
      const n = Math.max(1, Math.round(W / 32)), dw = W / n;
      for (let i = 0; i < n; i++) {
        const x0 = Math.round(i * dw) + 1, w = Math.round((i + 1) * dw) - Math.round(i * dw) - 2;
        raised(p, x0, 1, w, Hh - 3, T);
        p.rect(x0 + 3, 3, w - 6, Hh - 8, T.b); sunk(p, x0 + 2, 3, w - 4, Hh - 7, T);
        grain(p, x0 + 4, 4, w - 8, Hh - 10, T, 31 + i, 4);
        handleH(p, x0 + (w >> 1) - 4, Hh - 5, 8);
      }
      // sombra que o armário joga na parede, embaixo
      p.hline(1, Hh - 2, W - 2, T.d2);
    });
  };

  A.bancada = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S, back = 14;
    blit(c, 'bancada', X, Y, W, Hh, (p) => {
      // azulejo de metrô atrás da bancada
      const Ti = tn('#d9ece8');
      p.rect(0, -back, W, back, Ti.b);
      for (let r = 0; r < back / 5; r++) {
        const y = -back + r * 5;
        p.hline(0, y + 4, W, Ti.d);
        for (let x = (r % 2 ? 5 : 0); x < W; x += 10) { p.vline(x, y, 4, Ti.d); p.hline(x + 1, y, 3, Ti.h); }
      }
      p.hline(0, -back, W, Ti.d);
      // tampo de pedra
      const Tp = tn('#d9d4c7');
      p.rect(0, 0, W, 4, Tp.b); p.hline(0, 0, W, Tp.h); p.hline(0, 3, W, Tp.d);
      p.clusters(2, 1, W - 4, 2, Tp.l, 10, 3, 91);
      // cuba de inox
      const sx = 17 * S, sw = 14 * S;
      p.rect(sx, 0, sw, 2, '#7f939f'); p.hline(sx, 0, sw, '#5e707c'); p.hline(sx + 1, 1, sw - 2, '#b9c8d0'); p.px(sx + 3, 1, '#eef4f7');
      // móveis de baixo
      const Tw = tn('#a8805b');
      p.rect(0, 4, W, Hh - 4, Tw.d);
      const n = Math.max(1, Math.round(W / 32)), dw = W / n;
      for (let i = 0; i < n; i++) {
        const x0 = Math.round(i * dw) + 1, w = Math.round((i + 1) * dw) - Math.round(i * dw) - 2;
        raised(p, x0, 5, w, 6, Tw); handleH(p, x0 + (w >> 1) - 3, 7, 6);         // gaveta
        raised(p, x0, 12, w, Hh - 16, Tw); sunk(p, x0 + 2, 14, w - 4, Hh - 20, Tw);
        grain(p, x0 + 3, 15, w - 6, Hh - 22, Tw, 50 + i, 3);
        handleV(p, i % 2 ? x0 + 3 : x0 + w - 5, 15, 4);
      }
      // rodapé recuado
      p.rect(0, Hh - 3, W, 3, '#4a3a2e'); p.hline(0, Hh - 3, W, '#2e2420');
    }, { t: back });
  };

  A.torneira = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    blit(c, 'torneira', X, Y, W, Hh, (p) => {
      const M = tn('#b8c4cc');
      p.rect(2, Hh - 3, 6, 3, M.d); p.hline(2, Hh - 3, 6, M.l);                    // base
      p.rect(4, 3, 2, Hh - 5, M.b); p.vline(4, 3, Hh - 5, M.h);                     // cano
      p.rect(5, 1, 5, 2, M.b); p.hline(5, 1, 5, M.h); p.px(4, 2, M.b);              // pescoço curvo
      p.rect(9, 3, 2, 3, M.d); p.px(9, 3, M.l);                                     // bico
      p.rect(1, Hh - 6, 3, 1, M.l); p.px(0, Hh - 7, M.h);                           // alavanca
    });
    // gota de vez em quando
    const k = (env.time * 0.7) % 1;
    if (k > 0.75) R(c, X + 9, Y + 6 + Math.floor((k - 0.75) * 4 * 14), 1, 2, 'rgba(170,215,240,0.8)');
  };

  /* =================================================================
   * SALA
   * ================================================================= */
  const BOOKS = ['#9b59b6', '#16a085', '#e67e22', '#2f6db5', '#c0392b', '#f1c40f', '#2c3e50', '#d7cfb8', '#5a8f3c', '#b0524a'];
  function books(p, x, y, w, seed) {
    // fileira de livros apoiada em y (base), lombadas variadas
    let cx = x, i = 0;
    while (cx < x + w - 1) {
      const bw = 2 + Math.floor(H(i, seed, 1) * 3), bh = 9 + Math.floor(H(i, seed, 2) * 8);
      if (cx + bw > x + w) break;
      const col = BOOKS[Math.floor(H(i, seed, 3) * BOOKS.length)], T = tn(col);
      if (H(i, seed, 5) > 0.85 && cx + bh <= x + w) { // livro deitado
        p.rect(cx, y - 3, bh, 3, T.b); p.hline(cx, y - 3, bh, T.l); p.hline(cx + 1, y - 2, bh - 2, T.h);
        cx += bh + 1; i++; continue;
      }
      p.rect(cx, y - bh, bw, bh, T.b); p.vline(cx, y - bh, bh, T.l); if (bw > 2) p.vline(cx + bw - 1, y - bh, bh, T.d);
      p.hline(cx, y - bh + 2, bw, T.h); p.hline(cx, y - 4, bw, T.d);              // faixas da lombada
      cx += bw + (H(i, seed, 4) > 0.8 ? 1 : 0); i++;
    }
  }
  A.estante = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    blit(c, 'estante', X, Y, W, Hh, (p) => {
      const T = tn('#7a5233'), Bk = '#3a2718';
      p.rect(0, 0, W, Hh, T.b);
      p.rect(3, 3, W - 6, Hh - 6, Bk);                                              // fundo
      p.vline(3, 3, Hh - 6, '#2a1c12');
      p.rect(0, 0, W, 3, T.l); p.hline(0, 0, W, T.h);                               // tampo
      p.vline(0, 0, Hh, T.l); p.vline(W - 1, 0, Hh, T.d); p.vline(W - 2, 3, Hh - 3, T.d);
      vgrain(p, 0, 4, 2, Hh - 6, T, 7, 5); vgrain(p, W - 3, 4, 1, Hh - 6, T, 8, 4);
      const shelves = (d.surfaces || [[1, 10], [1, 22], [1, 34]]).map((s) => s[1] * S).sort((a, b) => a - b);
      for (const sy of shelves) {
        p.rect(2, sy, W - 4, 3, T.b); p.hline(2, sy, W - 4, T.h); p.hline(2, sy + 2, W - 4, T.d);
        p.hline(3, sy + 3, W - 6, '#22170e');                                       // sombra sob a prateleira
      }
      p.rect(0, Hh - 4, W, 4, T.d); p.hline(0, Hh - 4, W, T.b);                     // rodapé
      const s0 = shelves[0] || 20, s1 = shelves[1] || 44, s2 = shelves[2] || 68;
      // nicho de cima: livros
      books(p, 4, s0, W - 8, 3);
      // nicho 2: livro (objeto) fica à esquerda; aqui livros à direita e um porta-retrato
      books(p, 20, s1, W - 24, 11);
      p.rect(4, s1 - 8, 6, 8, '#d9b45a'); p.rect(5, s1 - 7, 4, 5, '#8fc1d9'); p.rect(5, s1 - 4, 4, 2, '#5f9e55'); p.hline(4, s1 - 8, 6, '#f2d88a');
      // nicho 3: jogos (objetos) na esquerda; console e controle à direita
      p.rect(W - 13, s2 - 5, 9, 5, '#2d2f38'); p.hline(W - 13, s2 - 5, 9, '#4a4d5a'); p.px(W - 6, s2 - 3, '#4cd964');
      p.rect(W - 12, s2 - 8, 6, 3, '#e8e8ee'); p.hline(W - 12, s2 - 8, 6, '#ffffff'); p.px(W - 11, s2 - 7, '#e74c3c'); p.px(W - 8, s2 - 7, '#3f8fd8');
      // nicho de baixo: cestos de palha e livros grandes
      const bot = Hh - 4;
      const Tc = tn('#c79a5a');
      p.rect(4, bot - 10, 12, 10, Tc.b); p.hline(4, bot - 10, 12, Tc.h); p.hline(4, bot - 9, 12, Tc.d);
      for (let j = bot - 7; j < bot; j += 3) for (let i = 4 + (j % 2); i < 16; i += 3) p.rect(i, j, 2, 1, Tc.l);
      books(p, 18, bot, W - 22, 21);
    });
  };

  A.mesa = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    blit(c, 'mesa', X, Y, W, Hh, (p) => {
      const T = tn('#93612f');
      // tampo
      p.rect(0, 0, W, 4, T.b); p.hline(0, 0, W, T.h); p.hline(0, 1, W, T.l); p.hline(0, 3, W, T.d);
      grain(p, 2, 1, W - 4, 2, T, 61, 6);
      // saia com gaveta
      p.rect(3, 4, W - 6, 5, T.d); p.hline(3, 8, W - 6, T.d2);
      raised(p, (W >> 1) - 8, 4, 16, 4, T); handleH(p, (W >> 1) - 2, 5, 4);
      // pernas afinando
      for (const lx of [3, W - 7]) {
        p.rect(lx, 4, 4, Hh - 4, T.d); p.vline(lx, 4, Hh - 4, T.b); p.vline(lx + 3, 9, Hh - 9, T.d2);
        p.rect(lx, Hh - 2, 4, 2, T.d2);
      }
    });
  };

  A.notebook = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S, on = !!env.flags.notebookOn;
    blit(c, 'notebook' + (on ? 1 : 0), X, Y, W, Hh, (p) => {
      const M = tn('#4a4c58');
      p.rect(1, 0, W - 3, Hh - 2, M.d); p.hline(1, 0, W - 3, M.l); p.vline(1, 0, Hh - 2, M.b);  // tampa
      if (on) { p.rect(3, 2, W - 7, Hh - 6, '#5f9fd0'); p.rect(3, 2, W - 7, 2, '#2c5f8f'); p.rect(4, 5, 5, 3, '#e8f4ff'); p.rect(10, 5, 3, 1, '#cfe6f8'); p.rect(10, 7, 4, 1, '#cfe6f8'); }
      else { p.rect(3, 2, W - 7, Hh - 6, '#1b2533'); p.line(5, Hh - 5, 9, 2, '#2c3b4f'); p.line(6, Hh - 5, 10, 2, '#2c3b4f'); p.px(4, 2, '#3a4c63'); }
      p.px((W >> 1) - 1, 1, '#2a2b33');                                             // câmera
      // base / teclado
      const K = tn('#b9bcc6');
      p.rect(0, Hh - 2, W, 2, K.b); p.hline(0, Hh - 2, W, K.h); p.hline(3, Hh - 1, W - 6, K.d);
    });
    if (on && Math.floor(env.time * 2) % 2) R(c, X + 9, Y + 9, 1, 2, '#ffffff');    // cursor piscando
  };

  A.celular = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    blit(c, 'celular', X, Y, W, Hh, (p) => {
      p.rect(0, 0, W, Hh, '#1c1d24'); p.hline(1, 0, W - 2, '#4a4e5e'); p.hline(0, Hh - 1, W, '#0e0f14');
      p.rect(2, 1, 4, 1, '#2c3e50'); p.px(W - 2, 1, '#55607a');
    });
    if (Math.floor(env.time * 1.5) % 3 === 0) R(c, X + 1, Y + 1, 1, 1, '#4cd964'); // LED de notificação
  };

  A.caderno = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    blit(c, 'caderno', X, Y, W, Hh, (p) => {
      const T = tn('#2e6b52');
      p.rect(0, 0, W, Hh, T.b); p.hline(0, 0, W, T.l); p.hline(1, 1, W - 2, '#efe6cf');   // folhas
      p.hline(0, Hh - 1, W, T.d); p.vline(W - 3, 0, Hh, '#1a1a22');                   // elástico
      p.px(1, 2, T.h);
    });
  };

  A.mesinha = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    blit(c, 'mesinha', X, Y, W, Hh, (p) => {
      const T = tn('#83582f');
      p.rect(0, 0, W, 3, T.b); p.hline(0, 0, W, T.h); p.hline(0, 2, W, T.d);
      p.rect(1, 3, W - 2, 7, T.d);
      raised(p, 2, 3, W - 4, 6, T); grain(p, 3, 4, W - 6, 4, T, 17, 3); p.rect((W >> 1) - 1, 5, 2, 2, '#d9b45a');
      p.rect(2, 10, 3, Hh - 10, T.d); p.vline(2, 10, Hh - 10, T.b);
      p.rect(W - 5, 10, 3, Hh - 10, T.d); p.vline(W - 3, 10, Hh - 10, T.d2);
      p.rect(4, Hh - 7, W - 8, 2, T.d2); p.hline(4, Hh - 7, W - 8, T.d);            // travessa
    });
  };

  A.abajur = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    const on = !!(env.flags.abajurOn || env.flags.abajurGlow);
    const col = env.flags.abajurCor || '255,226,170';
    const hex = '#' + col.split(',').map((n) => (+n).toString(16).padStart(2, '0')).join('');
    blit(c, 'abajur' + (on ? hex : 'off'), X, Y, W, Hh, (p) => {
      // base e haste
      const M = tn('#4a4440');
      p.rect(3, Hh - 3, W - 6, 3, M.b); p.hline(3, Hh - 3, W - 6, M.l); p.hline(4, Hh - 1, W - 8, M.d);
      p.rect(7, 11, 2, Hh - 13, M.b); p.vline(7, 11, Hh - 13, M.h);
      p.ball(8, Hh - 8, 2.2, 2.2, '#b07a3a');                                         // bojo de cerâmica
      // cúpula em trapézio
      const Ts = on ? tn(P.light(hex, 0.35)) : tn('#ddd0b4');
      p.poly([[3, 0], [13, 0], [16, 12], [0, 12]], Ts.b);
      p.poly([[3, 0], [6, 0], [4, 12], [0, 12]], on ? Ts.h : Ts.l);
      p.poly([[11, 0], [13, 0], [16, 12], [13, 12]], on ? Ts.l : Ts.d);
      p.hline(3, 0, 10, Ts.h); p.hline(0, 11, 16, on ? P.light(hex, 0.7) : Ts.d);
      for (let x = 4; x < 13; x += 3) p.vline(x, 3, 7, on ? Ts.l : Ts.d);        // pregas do tecido
      if (on) { p.rect(5, 12, 6, 1, '#fffbe8'); p.rect(6, 13, 4, 1, P.light(hex, 0.6)); }
    });
  };

  A.sofa = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    blit(c, 'sofa', X, Y, W, Hh, (p) => {
      const T = tn('#6b5a8c');
      // encosto
      p.rect(4, 1, W - 8, 16, T.d); p.rect(5, 0, W - 10, 1, T.b);
      const half = (W - 12) >> 1;
      for (let i = 0; i < 2; i++) {
        const x0 = 6 + i * half;
        p.rect(x0 + 1, 2, half - 2, 13, T.b); p.rect(x0, 3, half, 11, T.b);
        p.hline(x0 + 2, 2, half - 4, T.l); p.hline(x0 + 2, 3, half - 6, T.h);
        p.vline(x0, 4, 8, T.l);
        p.hline(x0 + 1, 14, half - 2, T.d); p.vline(x0 + half - 1, 4, 10, T.d);
        // capitonê e dobrinhas
        p.px(x0 + 7, 8, T.d2); p.px(x0 + half - 8, 8, T.d2);
        p.line(x0 + 4, 11, x0 + 8, 10, T.d); p.line(x0 + half - 5, 6, x0 + half - 3, 9, T.d);
      }
      // assento
      p.rect(7, 14, W - 14, 8, T.b);
      for (let i = 0; i < 2; i++) {
        const x0 = 7 + i * ((W - 14) >> 1), w = (W - 14) >> 1;
        p.hline(x0 + 1, 14, w - 2, T.h); p.hline(x0, 15, w, T.l);
        p.vline(x0 + w - 1, 15, 6, T.d); p.hline(x0, 21, w, T.d);
        p.line(x0 + 5, 18, x0 + 9, 19, T.d);
      }
      // saia com vivo
      p.rect(2, 22, W - 4, 5, T.d); p.hline(2, 22, W - 4, T.b); p.hline(2, 26, W - 4, T.d2);
      // braços enrolados
      for (const [ax, dir] of [[0, 1], [W - 8, -1]]) {
        p.rect(ax, 9, 8, 18, T.b); p.rect(ax + 1, 8, 6, 1, T.b);
        p.hline(ax + 1, 8, 6, T.h); p.hline(ax, 9, 8, T.l); p.hline(ax, 10, 8, T.l);
        p.vline(dir > 0 ? ax : ax + 7, 9, 18, dir > 0 ? T.l : T.d);
        p.vline(dir > 0 ? ax + 7 : ax, 11, 16, T.d);
        p.hline(ax, 26, 8, T.d2);
        p.ball(ax + 4, 13, 2, 2, T.b);
      }
      // almofada mostarda do lado direito
      const Tm = tn('#d9a441');
      p.poly([[W - 19, 6], [W - 11, 5], [W - 9, 15], [W - 20, 16]], Tm.b);
      p.line(W - 19, 6, W - 12, 5, Tm.h); p.line(W - 19, 7, W - 20, 15, Tm.l);
      p.line(W - 10, 7, W - 9, 15, Tm.d); p.hline(W - 19, 15, 10, Tm.d);
      p.px(W - 15, 10, Tm.d2);
      // pés de madeira
      for (const lx of [5, W - 8]) { p.rect(lx, 27, 3, 3, '#3b2a1c'); p.px(lx, 27, '#6a4a32'); }
    });
  };

  A.rack = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    blit(c, 'rack', X, Y, W, Hh, (p) => {
      const T = tn('#6b4830');
      p.rect(0, 0, W, Hh, T.d);
      p.rect(0, 0, W, 3, T.b); p.hline(0, 0, W, T.h); p.hline(0, 2, W, T.d);
      grain(p, 2, 1, W - 4, 1, T, 71, 3);
      const half = W >> 1;
      p.rect(2, 4, half - 3, Hh - 8, '#2e2018'); p.rect(half + 1, 4, half - 3, Hh - 8, '#2e2018');
      sunk(p, 2, 4, half - 3, Hh - 8, T); sunk(p, half + 1, 4, half - 3, Hh - 8, T);
      // aparelho receptor e caixinha
      p.rect(3, Hh - 9, half - 5, 4, '#1d1d24'); p.hline(3, Hh - 9, half - 5, '#3c3d49');
      p.rect(half + 3, Hh - 11, 6, 6, '#3b4c63'); p.hline(half + 3, Hh - 11, 6, '#5a6f8a');
      p.rect(half + 10, Hh - 8, 2, 3, '#c0392b');
      p.rect(0, Hh - 4, W, 2, T.b); p.hline(0, Hh - 2, W, T.d2);
      p.rect(1, Hh - 2, 2, 2, T.d2); p.rect(W - 3, Hh - 2, 2, 2, T.d2);
    });
    // LED do receptor
    R(c, X + 11, Y + Hh - 8, 1, 1, env.flags.tvOn ? '#4cd964' : (Math.floor(env.time) % 2 ? '#e74c3c' : '#7a2620'));
  };

  A.tv = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S, sh = Hh - 4;
    blit(c, 'tv' + (d.wall ? 'w' : ''), X, Y, W, Hh, (p) => {
      if (d.wall) p.rect((W >> 1) - 4, -4, 8, 4, '#3a3a44');
      p.rect(0, 0, W, sh, '#16171d'); p.hline(1, 0, W - 2, '#3a3c48'); p.vline(0, 1, sh - 2, '#2a2c36');
      p.hline(0, sh - 1, W, '#0c0c10');
      p.rect(2, 2, W - 4, sh - 5, '#1c232c');
      p.line(4, sh - 5, 12, 3, '#26303c'); p.line(5, sh - 5, 13, 3, '#26303c'); p.line(8, sh - 5, 14, 5, '#222b36');
      if (!d.wall) {
        p.rect((W >> 1) - 1, sh, 2, 2, '#26272f');
        p.rect((W >> 1) - 6, sh + 2, 12, 2, '#2e2f38'); p.hline((W >> 1) - 6, sh + 2, 12, '#4a4c58');
      }
    }, { t: d.wall ? 4 : 0 });
    R(c, X + W - 4, Y + sh - 2, 1, 1, env.flags.tvOn ? '#7fd3ff' : '#c0392b');
    if (!env.flags.tvOn) return;
    // imagem animada: céu, morros, sol passando, letreiro de notícia
    const sx = X + 2, sy = Y + 2, sw = W - 4, shh = sh - 5, t = env.time;
    const n = Math.floor(t * 8);
    R(c, sx, sy, sw, shh, n % 2 ? '#3a6ea5' : '#4277ae');
    R(c, sx, sy, sw, 3, '#2d5b8f');
    const sun = Math.floor((t * 4) % (sw + 6)) - 3;
    R(c, sx + sun, sy + 3, 3, 3, '#f1c40f'); R(c, sx + sun + 1, sy + 3, 1, 1, '#fff2a0');
    R(c, sx, sy + shh - 7, sw, 4, '#3f8f4a');
    R(c, sx + 3, sy + shh - 9, 8, 2, '#4fa65a'); R(c, sx + 15, sy + shh - 8, 7, 1, '#4fa65a');
    R(c, sx, sy + shh - 3, sw, 3, '#d24a3a');
    const off = Math.floor(t * 10) % 6;
    for (let x = -off; x < sw; x += 6) R(c, sx + Math.max(0, x), sy + shh - 2, Math.min(3, sw - Math.max(0, x)), 1, '#ffe9d8');
    c.fillStyle = 'rgba(10,20,40,0.18)';
    for (let y = 1; y < shh; y += 2) c.fillRect(sx, sy + y, sw, 1);
    R(c, sx, sy, 1, 1, 'rgba(255,255,255,0.5)');
  };

  A.quadro = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    blit(c, 'quadro', X, Y, W, Hh, (p) => {
      const F = tn('#7a5233');
      p.rect(0, 0, W, Hh, F.b); p.hline(0, 0, W, F.h); p.vline(0, 0, Hh, F.l);
      p.hline(0, Hh - 1, W, F.d2); p.vline(W - 1, 0, Hh, F.d);
      sunk(p, 2, 2, W - 4, Hh - 4, F);
      p.rect(3, 3, W - 6, Hh - 6, '#f4ecdc');                                       // passe-partout
      const ix = 5, iy = 5, iw = W - 10, ih = Hh - 10;
      p.bands(ix, iy, iw, ih - 6, '#7fb4d8', '#cfe6ee', 4);
      p.rect(ix + 3, iy + 3, 6, 2, '#ffffff'); p.rect(ix + 5, iy + 2, 3, 1, '#ffffff'); // nuvem
      p.ball(ix + iw - 6, iy + 4, 2.4, 2.4, '#f9e27d');                              // sol
      p.poly([[ix, iy + ih - 6], [ix + 10, iy + ih - 11], [ix + 20, iy + ih - 6]], '#6f9a8a'); // serra ao fundo
      p.poly([[ix + 12, iy + ih - 6], [ix + 22, iy + ih - 12], [ix + iw, iy + ih - 7], [ix + iw, iy + ih - 6]], '#7fa89a');
      p.rect(ix, iy + ih - 6, iw, 6, '#5f9e55'); p.hline(ix, iy + ih - 6, iw, '#7cbf62');
      p.clusters(ix, iy + ih - 4, iw, 4, '#4f8a47', 6, 3, 13);
      p.rect(ix + 6, iy + ih - 10, 2, 5, '#6b4a2f'); p.ball(ix + 7, iy + ih - 11, 3, 2.6, '#3f8040'); // árvore
      p.hline(ix + iw - 9, iy + ih - 3, 5, '#8fc1d9');                                // riacho
    });
  };

  A.lustre = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S, on = !!env.lampOn;
    blit(c, 'lustre' + (on ? 1 : 0), X, Y, W, Hh, (p) => {
      p.rect(5, 0, 6, 1, '#3a3a44'); p.vline(7, 1, 4, '#4a4a55'); p.vline(8, 1, 4, '#2a2a33');
      const T = tn('#d8c9a8');
      p.poly([[4, 5], [12, 5], [16, 11], [0, 11]], T.b);
      p.poly([[4, 5], [7, 5], [3, 11], [0, 11]], T.l); p.poly([[11, 5], [12, 5], [16, 11], [13, 11]], T.d);
      p.hline(4, 5, 8, T.h);
      p.hline(0, 10, 16, on ? '#fff6d8' : T.d);
      if (on) { p.rect(6, 11, 4, 1, '#fffef0'); } else p.rect(6, 11, 4, 1, '#bdb6a4');
    });
  };

  A.luminaria = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S, on = env.night > 0.2;
    blit(c, 'luminaria' + (on ? 1 : 0), X, Y, W, Hh, (p) => {
      const T = tn('#cfd2d6');
      p.rect(0, 0, W, 3, T.b); p.hline(0, 0, W, T.d); p.hline(0, 2, W, T.l);
      p.rect(1, 3, W - 2, Hh - 3, on ? '#fff3cf' : '#e9ecef');
      p.hline(1, Hh - 1, W - 2, on ? '#ffe7a8' : '#c8ccd1');
      if (on) p.hline(3, 3, W - 6, '#ffffff');
      p.px(0, 3, T.d); p.px(W - 1, 3, T.d);
    });
  };

  A.interruptor = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S, on = !!env.flags.luz_sala;
    blit(c, 'interruptor' + (on ? 1 : 0), X, Y, W, Hh, (p) => {
      const T = tn('#ece8de');
      p.rect(0, 0, W, Hh, T.b); p.hline(0, 0, W, T.h); p.vline(W - 1, 0, Hh, T.d); p.hline(0, Hh - 1, W, T.d);
      p.rect(2, 2, 2, 4, T.d);
      if (on) { p.rect(2, 2, 2, 2, T.h); p.px(3, 3, T.l); } else { p.rect(2, 4, 2, 2, T.l); p.px(3, 5, T.b); }
    });
  };

  /* =================================================================
   * QUARTO
   * ================================================================= */
  A.guarda_roupa = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    blit(c, 'guarda_roupa', X, Y, W, Hh, (p) => {
      const T = tn('#9c6b45');
      p.rect(0, 0, W, Hh, T.d);
      p.rect(0, 0, W, 3, T.l); p.hline(0, 0, W, T.h); p.hline(0, 3, W, T.d2);       // cornija
      const half = W >> 1, hy = 16 * S;
      for (let i = 0; i < 2; i++) {
        const x0 = i ? half : 1, w = half - 1;
        raised(p, x0, 4, w, Hh - 9, T);
        sunk(p, x0 + 2, 7, w - 4, hy - 12, T); sunk(p, x0 + 2, hy + 6, w - 4, Hh - hy - 16, T);
        vgrain(p, x0 + 3, 8, w - 6, hy - 14, T, 41 + i, 4); vgrain(p, x0 + 3, hy + 7, w - 6, Hh - hy - 18, T, 43 + i, 5);
      }
      p.vline(half - 1, 4, Hh - 9, T.d2);
      handleV(p, half - 4, hy, 7); handleV(p, half + 1, hy, 7);
      p.rect(0, Hh - 5, W, 3, T.b); p.hline(0, Hh - 5, W, T.l);                      // base
      p.rect(1, Hh - 2, 3, 2, T.d2); p.rect(W - 4, Hh - 2, 3, 2, T.d2);              // pés
    });
  };

  A.cama = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    blit(c, 'cama', X, Y, W, Hh, (p) => {
      const Tw = tn('#6e4b32');
      // cabeceira (esquerda, alta) e peseira (direita)
      p.rect(0, -12, 5, Hh + 12, Tw.b); p.rect(1, -13, 3, 1, Tw.b); p.hline(1, -13, 3, Tw.h);
      p.vline(0, -12, Hh + 12, Tw.l); p.vline(4, -12, Hh + 12, Tw.d);
      p.rect(W - 4, -4, 4, Hh + 4, Tw.b); p.hline(W - 4, -4, 4, Tw.h); p.vline(W - 1, -4, Hh + 4, Tw.d);
      // estrado
      p.rect(4, 11, W - 8, Hh - 11, Tw.d); p.rect(4, 11, W - 8, 4, Tw.b); p.hline(4, 11, W - 8, Tw.l);
      grain(p, 6, 12, W - 12, 2, Tw, 81, 5);
      p.hline(4, 15, W - 8, Tw.d2);
      p.rect(5, Hh - 3, 3, 3, Tw.d2); p.rect(W - 8, Hh - 3, 3, 3, Tw.d2);
      // colchão + lençol
      const Tl = tn('#ece6da');
      p.rect(5, 2, W - 9, 9, Tl.b); p.hline(5, 2, W - 9, Tl.h); p.hline(5, 10, W - 9, Tl.d);
      // cobertor azul dobrado, caindo pela lateral
      const Tb = tn('#5d7fa3');
      const bx = 24;
      p.rect(bx, 1, W - bx - 4, 13, Tb.b);
      p.rect(bx - 3, 1, 5, 11, Tl.l); p.hline(bx - 3, 1, 5, Tl.h); p.vline(bx - 3, 1, 11, Tl.b); // dobra do lençol
      p.hline(bx, 1, W - bx - 4, Tb.h); p.hline(bx, 2, W - bx - 4, Tb.l);
      p.hline(bx, 13, W - bx - 4, Tb.d2);
      for (let i = 0; i < 4; i++) {                                                  // pregas
        const fx = bx + 8 + i * 12;
        p.line(fx, 5, fx + 4, 12, Tb.d); p.line(fx + 1, 5, fx + 5, 12, Tb.l);
      }
      for (let x = bx + 2; x < W - 6; x += 6) p.px(x, 9, Tb.l);                      // costura xadrez
      // travesseiro
      const Tp = tn('#f5f1e8');
      p.rect(6, -3, 17, 8, Tp.b); p.rect(7, -4, 15, 1, Tp.b); p.rect(7, 5, 15, 1, Tp.b);
      p.hline(7, -4, 15, Tp.h); p.vline(6, -3, 7, Tp.h); p.hline(7, 5, 15, Tp.d); p.vline(22, -3, 8, Tp.d);
      p.line(12, -1, 15, 2, Tp.d); p.px(17, 0, Tp.l);
    }, { t: 14 });
  };

  A.janela_poco = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    // vista do poço de ventilação (sem contorno)
    blit(c, 'janela_poco_bg', X, Y, W, Hh, (p) => {
      p.rect(3, 3, W - 6, Hh - 6, '#2a2f36');
      for (let y = 3; y < Hh - 3; y += 4) for (let x = 3 + ((y >> 2) % 2) * 3; x < W - 3; x += 7) p.rect(x, y, 5, 3, '#333a43');
      p.rect(3, 3, W - 6, 2, '#1d2127');
    }, { outline: false });
    const day = 1 - env.night;
    R(c, X + 3, Y + 3, W - 6, Hh - 6, 'rgba(150,170,190,' + (0.12 + day * 0.33).toFixed(3) + ')');
    R(c, X + 3, Y + 3, W - 6, 4, 'rgba(210,225,235,' + (day * 0.25).toFixed(3) + ')');
    blit(c, 'janela_poco_fr', X, Y, W, Hh, (p) => {
      const T = tn('#6a7078');
      p.rect(0, 0, W, 3, T.b); p.rect(0, 0, 3, Hh, T.b); p.rect(W - 3, 0, 3, Hh, T.b); p.rect(0, Hh - 3, W, 3, T.b);
      p.hline(0, 0, W, T.h); p.vline(0, 0, Hh, T.l); p.vline(W - 1, 0, Hh, T.d);
      p.rect((W >> 1) - 1, 3, 2, Hh - 6, T.b); p.vline((W >> 1) - 1, 3, Hh - 6, T.l);
      p.rect(3, (Hh >> 1) - 1, W - 6, 2, T.b); p.hline(3, (Hh >> 1) - 1, W - 6, T.l);
      // peitoril
      p.rect(-2, Hh - 3, W + 4, 3, '#cfc8b8'); p.hline(-2, Hh - 3, W + 4, '#ece6d8'); p.hline(-2, Hh - 1, W + 4, '#9a9384');
    }, { l: 2, r: 2 });
    // reflexos no vidro
    c.fillStyle = 'rgba(255,255,255,0.14)';
    for (let i = 0; i < 4; i++) { c.fillRect(X + 5 + i, Y + 11 - i * 2, 1, 2); c.fillRect(X + (W >> 1) + 4 + i, Y + Hh - 7 - i * 2, 1, 2); }
  };

  /* =================================================================
   * HALL / PORTARIA
   * ================================================================= */
  A.porta_fundo = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S, lab = d.label || '';
    blit(c, 'porta:' + lab, X, Y, W, Hh, (p) => {
      // batente
      const Tf = tn('#5f4a39');
      p.rect(-2, -2, W + 4, Hh + 2, Tf.b); p.hline(-2, -2, W + 4, Tf.l); p.vline(-2, -2, Hh + 2, Tf.l); p.vline(W + 1, -2, Hh + 2, Tf.d);
      // folha
      const T = tn('#8d6c50');
      p.rect(0, 0, W, Hh, T.b); p.vline(0, 0, Hh, T.l); p.vline(W - 1, 0, Hh, T.d); p.hline(0, 0, W, T.d2);
      vgrain(p, 1, 1, W - 2, Hh - 2, T, lab.length * 7 + 3, 6);
      // dois painéis em relevo
      const up = [4, 4, W - 8, 20], lo = [4, 28, W - 8, 26];
      for (const [x, y, w, h] of [up, lo]) { sunk(p, x, y, w, h, T); raised(p, x + 2, y + 2, w - 4, h - 4, T); grain(p, x + 3, y + 3, w - 6, h - 6, T, y, 3); }
      // dobradiças
      p.rect(0, 6, 1, 4, '#c9a85a'); p.rect(0, Hh - 10, 1, 4, '#c9a85a');
      // maçaneta
      p.rect(W - 6, 15 * S - 1, 4, 3, '#8a6d2f'); p.rect(W - 6, 15 * S - 1, 3, 2, '#d4b16a'); p.px(W - 6, 15 * S - 1, '#fff0b8');
      p.rect(W - 5, 15 * S + 3, 2, 2, '#5a4a2a');
      // plaquinha com número
      if (lab.length <= 3 && canText(lab, F3)) {
        const tw = textW(lab, F3, 1), pw = tw + 6;
        const px0 = (W - pw) >> 1;
        p.rect(px0, 9, pw, 9, '#b8913f'); p.rect(px0 + 1, 10, pw - 2, 7, '#e0c070'); p.hline(px0 + 1, 10, pw - 2, '#f6e3a6');
        text(p, lab, px0 + 3, 11, F3, '#4a3418', 1);
        if (lab !== 'WC') p.px(W >> 1, 21, '#2a2018');                                // olho mágico
      }
      // placa verde de saída acima da porta
      if (lab.length > 3 && canText(lab, F3)) {
        const tw = textW(lab, F3, 1), pw = tw + 6, px0 = (W - pw) >> 1;
        p.rect(px0, -14, pw, 9, '#1e8a4c'); p.hline(px0, -14, pw, '#3fbf74'); p.hline(px0, -6, pw, '#136034');
        text(p, lab, px0 + 3, -12, F3, '#eafff0', 1); p.px(px0 + 3 + 4 + 2, -13, '#eafff0');
      }
    }, { l: 2, r: 2, t: lab.length > 3 ? 15 : 2 });
  };

  A.cabideiro = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    blit(c, 'cabideiro', X, Y, W, Hh, (p) => {
      const T = tn('#6a4a32');
      const cx = (W >> 1) - 1;
      p.rect(cx, 2, 3, Hh - 4, T.b); p.vline(cx, 2, Hh - 4, T.l); p.vline(cx + 2, 2, Hh - 4, T.d);
      p.ball(cx + 1.5, 1.5, 2, 2, '#7a5638');
      // ganchos
      p.line(cx - 1, 5, cx - 4, 2, T.b); p.line(cx + 3, 5, cx + 6, 2, T.b);
      p.line(cx - 1, 9, cx - 4, 7, T.d); p.line(cx + 3, 9, cx + 6, 7, T.d);
      // pés em tripé
      p.line(cx + 1, Hh - 5, cx - 4, Hh - 1, T.b); p.line(cx + 1, Hh - 5, cx + 6, Hh - 1, T.d); p.rect(cx, Hh - 3, 3, 3, T.d);
      // jaqueta azul pendurada (sai um pouco para a esquerda)
      const J = tn('#34495e');
      p.poly([[-2, 9], [3, 5], [7, 9], [7, 26], [-3, 26]], J.b);
      p.poly([[-2, 9], [3, 5], [2, 26], [-3, 26]], J.l);
      p.vline(3, 9, 17, J.d); p.hline(-3, 25, 10, J.d2); p.rect(4, 17, 3, 1, J.d);
      p.line(-1, 12, 1, 22, J.d); p.rect(1, 5, 4, 3, J.d);                            // capuz
      p.px(4, 14, '#d4b16a'); p.px(4, 19, '#d4b16a');
      // boné no outro gancho
      p.ball(cx + 7, 4, 3, 2, '#c0392b'); p.hline(cx + 7, 5, 4, '#7d241b');
    }, { l: 4, r: 6 });
  };

  A.caixas_correio = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    blit(c, 'caixas_correio', X, Y, W, Hh, (p) => {
      const T = tn('#8a949a');
      p.rect(0, 0, W, Hh, T.d); p.hline(0, 0, W, T.h); p.vline(0, 0, Hh, T.l); p.vline(W - 1, 0, Hh, T.d2); p.hline(0, Hh - 1, W, T.d2);
      const cols = 3, rows = 2, cw = Math.floor((W - 2) / cols), ch = Math.floor((Hh - 2) / rows);
      const D = tn('#a3acb2');
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const x0 = 2 + i * cw, y0 = 2 + j * ch, w = cw - 2, h = ch - 2;
        raised(p, x0, y0, w, h, D);
        p.hline(x0 + 1, y0 + 2, w - 3, D.h);                                         // brilho escovado
        p.hline(x0 + 2, y0 + (h >> 1) + 2, w - 5, D.l);
        p.rect(x0 + 5, y0 + 4, w - 10, 2, '#3c4246'); p.hline(x0 + 5, y0 + 6, w - 10, D.l); // fenda
        p.rect(x0 + 3, y0 + h - 6, 7, 4, '#f1ead6'); p.hline(x0 + 4, y0 + h - 4, 4, '#8a7a5a'); // etiqueta
        p.rect(x0 + w - 5, y0 + h - 6, 3, 3, '#d4b16a'); p.px(x0 + w - 4, y0 + h - 5, '#5a4a2a'); // fechadura
      }
    });
  };

  A.balcao_portaria = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    blit(c, 'balcao_portaria', X, Y, W, Hh, (p) => {
      // monitor CRT antigo
      const M = tn('#3a3e46');
      p.rect(8, -14, 18, 12, M.b); p.hline(8, -14, 18, M.l); p.vline(8, -14, 12, M.l); p.vline(25, -14, 12, M.d);
      p.rect(10, -12, 14, 8, '#14202a');
      p.rect(14, -2, 6, 2, M.d);
      // telefone e papéis
      p.rect(30, -4, 7, 4, '#2c2c34'); p.rect(29, -6, 9, 2, '#3a3a44'); p.hline(29, -6, 9, '#55555f');
      p.rect(44, -3, 16, 3, '#ece2c8'); p.hline(44, -3, 16, '#fbf4e2'); p.hline(46, -2, 10, '#9a8c6a'); p.rect(56, -5, 1, 4, '#2f6db5');
      // tampo
      const Tp = tn('#d9d4c7');
      p.rect(-1, 0, W + 2, 6, Tp.b); p.hline(-1, 0, W + 2, Tp.h); p.hline(-1, 4, W + 2, Tp.d); p.hline(-1, 5, W + 2, Tp.d2);
      p.clusters(1, 1, W - 2, 3, Tp.l, 8, 3, 33);
      // frente de madeira em ripas (opaca)
      const T = tn('#5d4a3a');
      p.rect(0, 6, W, Hh - 6, T.b);
      for (let x = 2; x < W - 1; x += 5) { p.vline(x, 7, Hh - 10, T.d); p.vline(x + 1, 7, Hh - 10, T.l); }
      p.rect(0, 6, W, 2, T.d2);
      p.rect(0, Hh - 3, W, 3, T.d); p.hline(0, Hh - 3, W, T.d2);
      // plaquinha "PORTARIA"
      p.rect((W >> 1) - 9, 12, 18, 6, '#c9a85a'); p.hline((W >> 1) - 9, 12, 18, '#ecd28f'); p.hline((W >> 1) - 7, 15, 14, '#6a5228');
    }, { t: 15, l: 1, r: 1 });
    // imagem das câmeras: 4 quadros com linha de varredura
    const sx = X + 10, sy = Y - 12, t = env.time;
    R(c, sx, sy, 14, 8, '#2b4a5e');
    R(c, sx, sy, 7, 4, '#3d5f73'); R(c, sx + 7, sy + 4, 7, 4, '#36566a');
    R(c, sx + 2, sy + 2, 2, 2, '#9fb7c4'); R(c, sx + 9, sy + 1, 3, 1, '#7d97a5'); R(c, sx + 10, sy + 6, 2, 2, '#c9d9e0');
    R(c, sx + 7, sy, 1, 8, '#14202a'); R(c, sx, sy + 4, 14, 1, '#14202a');
    R(c, sx, sy + Math.floor((t * 6) % 8), 14, 1, 'rgba(200,240,255,0.35)');
    if (Math.floor(t * 2) % 2) R(c, sx + 12, sy + 1, 1, 1, '#ff4d4d');
  };

  A.planta = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    blit(c, 'planta', X, Y, W, Hh, (p) => {
      // folhas longas (costela-de-adão / palmeirinha)
      const L = [['#2f7d3a', [[9, 23], [1, 8], [0, 4], [5, 9], [10, 20]]], ['#3a9a47', [[10, 23], [8, 3], [10, -1], [12, 4], [11, 22]]],
        ['#2a6e33', [[11, 23], [18, 7], [21, 5], [19, 12], [12, 23]]], ['#46ad54', [[9, 23], [3, 14], [-1, 15], [4, 18], [9, 23]]],
        ['#358a40', [[11, 23], [16, 15], [21, 16], [15, 20], [11, 23]]]];
      for (const [col, pts] of L) {
        const T = tn(col);
        p.poly(pts, T.b);
        const a = pts[0], b = pts[2];
        p.line(a[0], a[1] - 1, b[0], b[1] + 1, T.d);                                 // nervura
        p.line(pts[1][0] + 1, pts[1][1] + 1, (a[0] + pts[1][0]) >> 1, (a[1] + pts[1][1]) >> 1, T.l);
      }
      p.px(9, 4, '#7ccf6a'); p.px(2, 6, '#5fbf5f'); p.px(19, 7, '#5fbf5f');
      // vaso de barro
      const T = tn('#a85e36');
      p.poly([[3, 22], [17, 22], [15, Hh], [5, Hh]], T.b);
      p.rect(2, 22, 16, 3, T.l); p.hline(2, 22, 16, T.h); p.hline(2, 24, 16, T.d);
      p.vline(5, 25, Hh - 26, T.l); p.vline(14, 25, Hh - 26, T.d);
      p.hline(5, Hh - 1, 10, T.d2);
      p.rect(3, 22, 14, 1, '#4a3022');                                               // terra
    }, { l: 2, r: 2, t: 2 });
  };

  A.tapete = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    blit(c, 'tapete', X, Y, W, Hh, (p) => {
      const T = tn('#8a3229');
      p.rect(2, 0, W - 4, Hh, T.b); p.hline(2, 0, W - 4, T.l); p.hline(2, Hh - 1, W - 4, T.d);
      for (let x = 5; x < W - 5; x += 4) { p.px(x, 1, '#d9a441'); p.px(x + 2, 2, '#e8d9b0'); }
      p.vline(4, 0, Hh, '#d9a441'); p.vline(W - 5, 0, Hh, '#d9a441');
      for (let y = 0; y < Hh; y += 2) { p.px(0, y, '#e8d9b0'); p.px(1, y + 1, '#e8d9b0'); p.px(W - 1, y, '#e8d9b0'); p.px(W - 2, y + 1, '#e8d9b0'); }
    }, { outline: false });
  };

  /* =================================================================
   * BANHEIRO
   * ================================================================= */
  A.espelho = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    blit(c, 'espelho', X, Y, W, Hh, (p) => {
      const F = tn('#c9d3d9');
      p.rect(0, 0, W, Hh, F.b); p.hline(0, 0, W, F.h); p.vline(0, 0, Hh, F.l); p.vline(W - 1, 0, Hh, F.d); p.hline(0, Hh - 1, W, F.d);
      p.bands(2, 2, W - 4, Hh - 4, '#b7cbd8', '#8aa3b5', 4);
      p.line(4, 10, 10, 3, '#e6f0f6'); p.line(4, 11, 11, 3, '#d4e4ee'); p.line(5, 14, 13, 5, '#c8dbe6');
      p.line(W - 9, Hh - 3, W - 3, Hh - 9, '#c8dbe6');
      // prateleirinha de vidro com escova
      p.rect(2, Hh, W - 4, 2, '#dfe9ef'); p.hline(2, Hh + 1, W - 4, '#9fb3c2');
      p.rect(5, Hh - 4, 3, 4, '#e8f2f6'); p.rect(6, Hh - 7, 1, 3, '#3f8fd8'); p.rect(10, Hh - 3, 4, 3, '#f2a65a');
    }, { b: 2 });
  };

  A.pia_banheiro = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    blit(c, 'pia_banheiro', X, Y, W, Hh, (p) => {
      const T = tn('#f2f2f0');
      // torneira
      p.rect((W >> 1) - 1, -5, 2, 5, '#b8c4cc'); p.rect((W >> 1) - 1, -6, 5, 2, '#d8e2e8'); p.px((W >> 1) + 3, -4, '#8a99a3');
      p.rect((W >> 1) - 5, -2, 3, 2, '#b8c4cc');
      // bacia
      p.rect(0, 0, W, 4, T.b); p.hline(0, 0, W, T.h); p.rect(3, 1, W - 6, 1, '#c8d0d4');
      p.poly([[0, 4], [W, 4], [W - 3, 9], [3, 9]], T.b); p.hline(1, 4, W - 2, T.l);
      p.line(W - 1, 4, W - 4, 9, T.d); p.hline(3, 8, W - 6, T.d);
      // coluna
      p.poly([[(W >> 1) - 4, 9], [(W >> 1) + 4, 9], [(W >> 1) + 3, Hh - 2], [(W >> 1) - 3, Hh - 2]], T.b);
      p.vline((W >> 1) - 3, 9, Hh - 11, T.h); p.vline((W >> 1) + 2, 9, Hh - 11, T.d);
      p.rect((W >> 1) - 5, Hh - 2, 10, 2, T.d); p.hline((W >> 1) - 5, Hh - 2, 10, T.b);
    }, { t: 7 });
  };

  A.vaso = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    blit(c, 'vaso', X, Y, W, Hh, (p) => {
      const T = tn('#f3f3f1');
      // caixa acoplada (direita)
      p.rect(W - 7, -8, 7, 17, T.b); p.hline(W - 7, -8, 7, T.h); p.rect(W - 8, -9, 8, 2, T.l); p.hline(W - 8, -9, 8, T.h);
      p.vline(W - 1, -7, 16, T.d); p.rect(W - 5, -11, 3, 2, '#c8d0d4');
      // assento e bacia
      p.rect(0, 7, W - 4, 3, T.l); p.hline(0, 7, W - 4, T.h); p.hline(0, 9, W - 4, T.d);
      p.poly([[1, 10], [W - 5, 10], [W - 7, 17], [3, 17]], T.b);
      p.line(1, 10, 3, 16, T.h); p.line(W - 5, 10, W - 7, 16, T.d);
      // pé
      p.rect(5, 17, W - 12, Hh - 17, T.b); p.vline(5, 17, Hh - 17, T.l); p.vline(W - 8, 17, Hh - 17, T.d);
      p.rect(4, Hh - 2, W - 10, 2, T.d); p.hline(4, Hh - 2, W - 10, T.b);
    }, { t: 11 });
  };

  A.chuveiro = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    // vidro do box (translúcido, sem contorno)
    R(c, X, Y + 16, W, Hh - 16, 'rgba(180,220,240,0.14)');
    c.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 10; i++) { c.fillRect(X + 3 + Math.floor(i / 2), Y + 40 - i * 2, 1, 2); c.fillRect(X + 9 + Math.floor(i / 2), Y + 52 - i * 2, 1, 2); }
    blit(c, 'chuveiro', X, Y, W, Hh, (p) => {
      const M = tn('#b8c4cc');
      p.rect(8, 0, 2, 11, M.b); p.vline(8, 0, 11, M.h);                              // cano
      p.rect(7, 0, 4, 2, M.d);
      p.rect(3, 11, 12, 2, M.l); p.hline(3, 11, 12, M.h);                            // ducha
      p.rect(4, 13, 10, 2, M.d); for (let x = 5; x < 14; x += 2) p.px(x, 14, '#4a5862');
      // registro na parede
      p.rect(15, 30, 4, 4, M.b); p.px(15, 30, M.h); p.rect(16, 28, 2, 2, M.d);
      // perfis do box
      p.rect(0, 16, 1, Hh - 16, '#c9d3d9'); p.rect(0, Hh - 2, W, 2, '#c9d3d9'); p.hline(0, Hh - 2, W, '#eef4f7');
    });
  };

  /* =================================================================
   * PADARIA
   * ================================================================= */
  function bread(p, kind, x, y) {
    // y = base onde o pão apoia
    const T = tn('#d9a05b');
    if (kind === 0) {           // pão francês
      p.ellipse(x + 4, y - 3, 4, 3, T.b); p.hline(x + 2, y - 6, 5, T.l); p.hline(x + 1, y - 1, 7, T.d);
      p.line(x + 2, y - 4, x + 4, y - 5, T.h); p.line(x + 5, y - 3, x + 6, y - 4, T.h);
    } else if (kind === 1) {    // baguete
      p.rect(x, y - 3, 12, 3, T.b); p.hline(x + 1, y - 3, 10, T.l);
      p.hline(x, y - 1, 12, T.d); for (let i = 2; i < 11; i += 3) p.px(x + i, y - 2, T.h);
    } else if (kind === 2) {    // pão redondo
      const Tr = tn('#c0803f');
      p.ball(x + 4, y - 4, 4, 4, Tr.b); p.px(x + 3, y - 6, Tr.h); p.hline(x + 1, y - 1, 7, Tr.d);
    } else if (kind === 3) {    // croissant
      const Tc = tn('#e0a24a');
      p.ellipse(x + 4, y - 2, 5, 2, Tc.b); p.vline(x + 2, y - 4, 3, Tc.d); p.vline(x + 5, y - 4, 3, Tc.d); p.hline(x + 1, y - 4, 6, Tc.l);
    } else {                    // sonho com açúcar
      const Ts = tn('#e8b56a');
      p.ellipse(x + 4, y - 3, 4, 3, Ts.b); p.hline(x + 1, y - 3, 7, '#fff4d6'); p.px(x + 2, y - 5, '#ffffff'); p.px(x + 5, y - 5, '#ffffff');
    }
  }
  A.prateleira_pao = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    blit(c, 'prateleira_pao', X, Y, W, Hh, (p) => {
      const T = tn('#7a5230');
      p.rect(0, 0, W, Hh, T.d2); p.rect(0, 0, W, 2, T.b); p.hline(0, 0, W, T.l);
      p.rect(0, 0, 3, Hh, T.b); p.rect(W - 3, 0, 3, Hh, T.b); p.vline(0, 0, Hh, T.l); p.vline(W - 1, 0, Hh, T.d);
      for (let j = 0; j < 2; j++) {
        const sy = 7 * S + j * 8 * S;
        // cestos de vime com pães
        for (let i = 0; i < 4; i++) {
          const bx = 5 + i * 30, kinds = [[0, 0, 0], [1, 1], [2, 4, 2], [3, 3, 3]][(i + j * 2) % 4];
          let x = bx + 2;
          for (const k of kinds) { bread(p, k, x, sy - 2); x += k === 1 ? 13 : 9; }
          const Tc = tn('#b8864a');
          p.rect(bx, sy - 3, 26, 3, Tc.b); p.hline(bx, sy - 3, 26, Tc.h);
          for (let q = bx + 1; q < bx + 26; q += 3) p.px(q, sy - 2, Tc.d);
        }
        p.rect(1, sy, W - 2, 3, T.b); p.hline(1, sy, W - 2, T.h); p.hline(1, sy + 2, W - 2, T.d);
        for (let i = 0; i < 4; i++) { p.rect(12 + i * 30, sy + 3, 6, 3, '#f6efe2'); p.hline(13 + i * 30, sy + 4, 3, '#a63d28'); } // preços
      }
    });
  };

  A.balcao = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    blit(c, 'balcao', X, Y, W, Hh, (p) => {
      // vitrine de vidro em cima, com doces
      const gx = 12, gw = 24;
      p.rect(gx, -12, gw, 12, '#cfe6f2'); p.rect(gx + 1, -11, gw - 2, 10, '#a9cde0');
      p.hline(gx + 1, -6, gw - 2, '#e8f4fa');
      bread(p, 4, gx + 2, -6); bread(p, 3, gx + 12, -6); bread(p, 2, gx + 3, -1); bread(p, 0, gx + 13, -1);
      p.line(gx + 2, -10, gx + 6, -11, '#ffffff'); p.vline(gx, -12, 12, '#8aa4b2'); p.vline(gx + gw - 1, -12, 12, '#8aa4b2');
      p.hline(gx, -12, gw, '#e8f4fa');
      // caixa registradora no canto direito
      const Mx = W - 18;
      p.rect(Mx, -7, 12, 7, '#4a4f5a'); p.hline(Mx, -7, 12, '#6d7380'); p.rect(Mx + 2, -11, 8, 4, '#2c3038');
      p.rect(Mx + 3, -10, 6, 2, '#7ee08a'); for (let i = 0; i < 3; i++) p.px(Mx + 2 + i * 3, -4, '#c9ccd1');
      // tampo
      const Tp = tn('#d9d4c7');
      p.rect(-1, 0, W + 2, 6, Tp.b); p.hline(-1, 0, W + 2, Tp.h); p.hline(-1, 4, W + 2, Tp.d); p.hline(-1, 5, W + 2, Tp.d2);
      p.clusters(1, 1, W - 2, 3, Tp.l, 14, 3, 57);
      // frente: madeira com azulejos e painéis
      const T = tn('#a0522d');
      p.rect(0, 6, W, Hh - 6, T.d); p.rect(0, 6, W, 2, T.d2);
      const n = 4, pw = Math.floor((W - 4) / n);
      for (let i = 0; i < n; i++) {
        const x0 = 2 + i * pw;
        raised(p, x0, 9, pw - 2, Hh - 13, T); sunk(p, x0 + 2, 11, pw - 6, Hh - 17, T);
        grain(p, x0 + 3, 12, pw - 8, Hh - 19, T, 90 + i, 4);
      }
      p.rect(0, Hh - 3, W, 3, '#5a2e1a'); p.hline(0, Hh - 3, W, '#3a1d12');
    }, { t: 13, l: 1, r: 1 });
  };

  A.mesa_bar = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S;
    blit(c, 'mesa_bar', X, Y, W, Hh, (p) => {
      const Tm = tn('#e6e2da'), M = tn('#8a9096');
      p.rect(0, 0, W, 3, Tm.b); p.hline(1, 0, W - 2, Tm.h); p.hline(0, 2, W, Tm.d);
      p.clusters(3, 1, W - 6, 1, '#cfc8bc', 5, 4, 7);
      p.rect(3, 3, W - 6, 1, M.d);
      const cx = (W >> 1) - 2;
      p.rect(cx, 4, 4, Hh - 7, M.b); p.vline(cx, 4, Hh - 7, M.h); p.vline(cx + 3, 4, Hh - 7, M.d);
      p.rect(cx - 7, Hh - 3, 18, 2, M.b); p.hline(cx - 7, Hh - 3, 18, M.l); p.rect(cx - 8, Hh - 1, 20, 1, M.d);
      // açucareiro
      p.rect(4, -4, 4, 4, '#f4f4f2'); p.rect(5, -5, 2, 1, '#b8c4cc'); p.vline(4, -4, 4, '#ffffff');
    }, { t: 5 });
  };

  A.letreiro = function (c, d, X, Y, env, S) {
    const W = d.w * S, Hh = d.h * S, s = (d.text || '').toUpperCase();
    const k = 2;
    blit(c, 'letreiro:' + s, X, Y, W, Hh, (p, w, h, cx) => {
      const T = tn('#a63d28');
      p.rect(0, 0, W, Hh, T.d); p.hline(0, 0, W, T.l); p.vline(0, 0, Hh, T.l); p.hline(0, Hh - 1, W, T.d2); p.vline(W - 1, 0, Hh, T.d2);
      p.rect(2, 2, W - 4, Hh - 4, T.b); p.hline(2, 2, W - 4, T.h); p.hline(2, Hh - 3, W - 4, T.d);
      p.hline(4, 4, W - 8, '#e8c07a'); p.hline(4, Hh - 5, W - 8, '#e8c07a');         // filete dourado
      if (canText(s, F5)) {
        const tw = textW(s, F5, k), tx = (W - tw) >> 1, ty = (Hh - 7 * k) >> 1;
        text(p, s, tx + 1, ty + 1, F5, '#4a1a10', k);
        text(p, s, tx, ty, F5, '#ffe9b0', k);
        for (let i = 0; i < tw; i += 1) p.px(tx + i, ty, '#fff8dc');
        // ramos de trigo dos lados
        for (const wx of [tx - 16, tx + tw + 6]) {
          p.vline(wx + 4, ty, 14, '#c9a24a');
          for (let j = 0; j < 4; j++) { p.rect(wx + 2, ty + 1 + j * 3, 2, 2, '#e8c07a'); p.rect(wx + 5, ty + 2 + j * 3, 2, 2, '#d9a441'); }
        }
      } else {
        cx.fillStyle = '#ffe9b0'; cx.font = 'bold 16px monospace'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(s, W / 2, Hh / 2 + 1);
      }
    });
    // lampadinhas acesas à noite
    if (env.night > 0.3) {
      for (let x = 8; x < W - 6; x += 12) {
        const blink = Math.floor(env.time * 2 + x / 12) % 4 !== 0;
        R(c, X + x, Y - 2, 2, 2, blink ? '#fff2b8' : '#d9a441');
      }
    }
  };
})(window.VG = window.VG || {});

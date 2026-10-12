/* =====================================================================
 * Objetos físicos (props) e estruturas da praça na grade fina.
 * Cada função recebe (c, p, X, Y, env, S): (X,Y) = canto superior da
 * caixa do objeto em px de tela; caixa = p.w*S × p.h*S (S = G.HI = 2).
 * Sprites estáticos ficam em cache (G.Pix.sprite) com 1 px de margem.
 * ===================================================================== */
(function (G) {
  'use strict';
  G.ArtProps = G.ArtProps || {};
  const A = G.ArtProps;
  const P = G.Pix;
  const ease = (t) => (G.util && G.util.easeInOut ? G.util.easeInOut(t) : t);
  const lerp = (a, b, t) => a + (b - a) * t;

  /** Sprite de W×H px com margem de 1 px; fn desenha em (0,0)…(W,H). */
  function spr(key, W, H, fn, o) {
    return P.sprite('prop:' + key + ':' + W + 'x' + H, W + 2, H + 2, (p, c) => { c.translate(1, 1); fn(p, c, W, H); }, o);
  }
  /** Cola o sprite (com brilho de restauração se p.flash > 0). */
  function blit(c, s, x, y, p) {
    c.drawImage(s, x, y);
    if (p && p.flash > 0) {
      c.save(); c.globalAlpha = Math.min(0.8, p.flash * 2); c.globalCompositeOperation = 'lighter';
      c.drawImage(s, x, y); c.restore();
    }
  }
  const put = (c, p, s, X, Y) => blit(c, s, X - 1, Y - 1, p);

  /* ---------------- fonte de pixel 3×5 (para a nota) ---------------- */
  const FONT = {
    R: ['##.', '#.#', '##.', '#.#', '#.#'],
    $: ['.##', '##.', '.#.', '.##', '##.'],
    1: ['.#', '##', '.#', '.#', '.#'],
    0: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  };
  function glyph(p, ch, x, y, col) {
    const g = FONT[ch];
    for (let j = 0; j < g.length; j++) for (let i = 0; i < g[j].length; i++) if (g[j][i] === '#') p.px(x + i, y + j, col);
    return g[0].length;
  }

  /* ============================ COZINHA ============================ */

  // copo de requeijão: vidro grosso, etiqueta velha, líquido
  A.copo = function (c, p, X, Y, env, S) {
    const sab = p.state.sabor || '';
    const s = spr('copo:' + sab, p.w * S, p.h * S, (q, cx, W, H) => {
      // vidro translúcido (cantos de baixo arredondados)
      q.rect(0, 1, W, H - 2, 'rgba(200,232,252,0.42)'); q.rect(1, H - 1, W - 2, 1, '#9cc4e0');
      // líquido
      if (sab === 'coca') {
        q.rect(1, 3, W - 2, H - 5, '#3a1a0c');
        q.rect(1, 4, 2, H - 6, '#5a2a12');
        q.rect(W - 3, 4, 2, H - 6, '#24100a');
        q.hline(1, 3, W - 2, '#d8aa78'); q.hline(2, 4, W - 4, '#7a4626'); // espuma
        q.px(5, 7, '#7a4020'); q.px(4, 9, '#8a4a26'); q.px(6, 6, '#8a4a26');
      } else if (sab === 'agua') {
        q.rect(1, 5, W - 2, H - 7, 'rgba(110,190,250,0.7)');
        q.hline(1, 5, W - 2, '#e2f6ff'); q.rect(W - 3, 6, 2, H - 8, 'rgba(70,140,215,0.7)');
      }
      // pedacinho de etiqueta velha
      q.rect(5, 6, 3, 3, '#efe3c8'); q.px(7, 8, '#d6c8a8'); q.hline(5, 7, 3, '#c94a3a'); q.px(5, 8, 'rgba(200,232,252,0.42)');
      // paredes do vidro
      q.vline(0, 1, H - 2, '#e8f6ff'); q.vline(W - 1, 1, H - 2, '#86b0d2'); q.vline(W - 2, 2, H - 4, 'rgba(120,170,210,0.55)');
      q.hline(0, 0, W, '#ffffff'); q.hline(1, 1, W - 2, '#9cc6e6'); q.px(0, 0, '#d8eefc'); q.px(W - 1, 0, '#b4d6ee');
      // fundo grosso
      q.hline(1, H - 2, W - 2, '#c6e4f8'); q.hline(2, H - 2, 3, '#ffffff');
      // reflexos verticais
      q.vline(1, 2, H - 5, 'rgba(255,255,255,0.9)'); q.vline(3, 3, 2, 'rgba(255,255,255,0.7)'); q.px(3, 6, 'rgba(255,255,255,0.5)');
    });
    put(c, p, s, X, Y);
  };

  // colher de inox (pode estar entortada)
  A.colher = function (c, p, X, Y, env, S) {
    const bent = !!p.state.bent;
    const s = spr('colher:' + bent, p.w * S, p.h * S, (q, cx, W, H) => {
      const L = '#eef2f5', B = '#bcc6ce', D = '#8a96a0';
      if (bent) {
        q.hline(0, 2, 4, L); q.hline(0, 3, 4, D);
        q.hline(3, 1, 3, L); q.hline(4, 2, 2, D); q.px(3, 2, B);
        q.hline(5, 0, 3, L); q.hline(6, 1, 2, D);
      } else {
        q.hline(0, 1, 8, L); q.hline(0, 2, 8, D); q.px(0, 1, B); q.px(0, 2, B);
      }
      // concha
      q.ellipse(W - 2, 2, 2.6, 2, D); q.ellipse(W - 2.5, 1.6, 2, 1.5, B);
      q.px(W - 4, 1, L); q.px(W - 3, 1, '#ffffff');
    });
    put(c, p, s, X, Y);
  };

  // vassoura: cabo de madeira, ponteira plástica, cerdas de palha
  A.vassoura = function (c, p, X, Y, env, S) {
    const s = spr('vassoura', p.w * S, p.h * S, (q, cx, W, H) => {
      const wd = P.tones('#a0683a');
      q.rect(3, 2, 2, 33, wd.b); q.vline(3, 2, 33, wd.l); q.vline(4, 2, 33, wd.d);
      for (let y = 6; y < 34; y += 9) q.px(3, y, wd.h);
      q.rect(2, 0, 4, 3, '#c0392b'); q.hline(2, 0, 4, '#e2604f'); q.px(5, 1, '#8a2418'); q.px(3, 1, '#a12c20');
      // ponteira / amarração
      const r = P.tones('#b0402a');
      q.rect(1, 34, 6, 5, r.b); q.hline(1, 34, 6, r.l); q.vline(1, 34, 5, r.l); q.vline(6, 35, 4, r.d);
      q.hline(1, 36, 6, r.d2); q.hline(2, 36, 1, r.h);
      // cerdas
      const st = P.tones('#d8b25a');
      q.rect(1, 39, 6, 2, st.b); q.rect(0, 41, 8, 7, st.b);
      for (let x = 0; x < 8; x++) {
        const col = x % 3 === 0 ? st.l : x % 3 === 1 ? st.b : st.d;
        q.vline(x, x === 0 || x === 7 ? 41 : 39, 8, col);
      }
      q.vline(1, 39, 6, st.h); q.vline(4, 40, 5, st.h);
      q.hline(0, 41, 8, st.d); q.hline(1, 39, 6, st.d2);
      for (let x = 0; x < 8; x += 2) q.px(x, 47, 'rgba(0,0,0,0)');
      cx.clearRect(1, 47, 1, 1); cx.clearRect(4, 47, 1, 1); cx.clearRect(6, 47, 1, 1);
      q.px(2, 47, st.d2); q.px(5, 46, st.d2);
    });
    put(c, p, s, X, Y);
  };

  /* ============================ SALA ============================ */

  A.controle = function (c, p, X, Y, env, S) {
    const s = spr('controle', p.w * S, p.h * S, (q, cx, W, H) => {
      const T = P.tones('#34343f');
      q.rect(1, 0, W - 2, H, T.b); q.rect(0, 1, W, H - 2, T.b);
      q.hline(1, 0, W - 2, T.h); q.hline(0, 1, W, T.l);
      q.hline(1, H - 1, W - 2, T.d2); q.hline(0, H - 2, W, T.d);
      for (let i = 0; i < 3; i++) { q.px(2 + i * 2, 2, '#9aa0b0'); q.px(2 + i * 2, 3, '#5d6274'); }
      q.rect(8, 2, 2, 1, '#ff6a5a'); q.rect(8, 3, 2, 1, '#b02a1e');
      q.vline(W - 1, 2, 2, '#6a2232');
    });
    put(c, p, s, X, Y);
  };

  A.cadeira = function (c, p, X, Y, env, S) {
    const s = spr('cadeira', p.w * S, p.h * S, (q, cx, W, H) => {
      const T = P.tones('#a06e40'), D = P.tones('#7a4f2a');
      // pernas de trás (longe) e travessa
      q.rect(8, 16, 2, 12, D.d); q.hline(2, 22, 16, D.d2); q.hline(2, 21, 16, D.d);
      // encosto
      q.rect(16, 0, 4, 16, T.b); q.vline(16, 0, 16, T.l); q.vline(19, 1, 15, T.d);
      q.rect(15, 0, 5, 2, T.l); q.hline(15, 0, 5, T.h);
      q.rect(17, 4, 2, 1, T.d2); q.rect(17, 9, 2, 1, T.d2);
      // assento
      q.rect(0, 12, 20, 4, T.b); q.hline(0, 12, 20, T.h); q.hline(0, 13, 20, T.l); q.hline(0, 15, 20, T.d2);
      q.hline(4, 14, 3, T.d); q.hline(11, 14, 2, T.d);
      // pernas da frente
      q.rect(0, 16, 2, 12, T.b); q.vline(0, 16, 12, T.l); q.vline(1, 17, 11, T.d);
      q.rect(18, 16, 2, 12, T.b); q.vline(18, 16, 12, T.l); q.vline(19, 17, 11, T.d);
      q.hline(0, 27, 2, T.d2); q.hline(18, 27, 2, T.d2);
    });
    put(c, p, s, X, Y);
  };

  // caixa de videogame em pé
  A.jogo = function (c, p, X, Y, env, S) {
    const cor = p.state.cor || '#c0392b';
    const s = spr('jogo:' + cor, p.w * S, p.h * S, (q, cx, W, H) => {
      const T = P.tones(cor);
      q.rect(0, 0, W, H, T.b);
      q.rect(0, 0, W, 3, '#eef0f2'); q.hline(0, 2, W, '#b8bec6'); q.px(1, 1, '#2a2a33'); q.px(2, 1, '#2a2a33');
      // arte da capa
      q.rect(1, 4, 5, 5, T.d); q.poly([[1, 9], [3, 5], [6, 9]], T.l); q.px(3, 5, T.h); q.px(5, 5, '#ffe9a0');
      q.rect(1, 10, 2, 1, '#f5f5f5');
      q.vline(0, 3, H - 3, T.l);
      // lombada
      q.rect(W - 2, 0, 2, H, T.d2); q.vline(W - 2, 3, H - 3, T.d);
    });
    put(c, p, s, X, Y);
  };

  A.livro = function (c, p, X, Y, env, S) {
    const open = !!p.state.aberto;
    const s = spr('livro:' + open, p.w * S, p.h * S, (q, cx, W, H) => {
      if (open) {
        const pg = P.tones('#ece2cb');
        q.rect(0, 1, W, H - 1, pg.b);
        q.rect(0, 0, 3, 1, pg.l); q.rect(W - 3, 0, 3, 1, pg.l);
        q.vline(3, 1, H - 1, pg.d); q.vline(4, 1, H - 1, pg.d2);
        for (let y = 3; y < H - 2; y += 2) { q.hline(1, y, 2, '#9a8c70'); q.hline(5, y, 2, '#9a8c70'); }
        q.hline(0, H - 1, W, '#7a4a2e');
        q.vline(0, 1, H - 2, pg.h);
      } else {
        const T = P.tones('#7a4a2e');
        q.rect(0, 0, W, H, T.b);
        q.rect(W - 2, 1, 2, H - 2, '#f2ead8'); q.vline(W - 1, 1, H - 2, '#d6cbb0');
        for (let y = 3; y < H - 1; y += 3) q.px(W - 2, y, '#c8bc9e');
        q.vline(0, 0, H, T.d); q.vline(1, 0, H, T.l);
        q.hline(0, 0, W - 2, T.h);
        q.rect(2, 4, 4, 3, '#c9a24a'); q.hline(2, 4, 4, '#ecd07a'); q.hline(3, 5, 2, '#8a6a24');
        q.hline(1, 1, 1, '#c9a24a'); q.hline(1, H - 2, 1, '#c9a24a');
      }
    });
    put(c, p, s, X, Y);
  };

  // caixa de papelão com fita e etiqueta
  A.caixa = function (c, p, X, Y, env, S) {
    const s = spr('caixa', p.w * S, p.h * S, (q, cx, W, H) => {
      const T = P.tones('#c49a5e');
      q.rect(0, 0, W, H, T.b);
      q.rect(0, 0, W, 4, T.l); q.hline(0, 0, W, T.h); q.hline(0, 4, W, T.d);
      q.vline(0, 0, H, T.l); q.vline(W - 1, 1, H - 1, T.d); q.hline(0, H - 1, W, T.d2); q.hline(1, H - 2, W - 2, T.d);
      // fita adesiva
      q.rect(10, 0, 4, 9, '#e6d39f'); q.vline(10, 0, 9, '#f4e6bc'); q.vline(13, 0, 9, '#b89a5e'); q.hline(10, 8, 4, '#a88a52');
      // etiqueta
      q.rect(3, 9, 6, 5, '#f4efe2'); q.hline(4, 10, 4, '#8a7a5a'); q.hline(4, 12, 3, '#8a7a5a'); q.vline(8, 9, 5, '#cfc6b0');
      // setas "este lado para cima"
      for (const ax of [16, 19]) { q.vline(ax, 11, 4, T.d2); q.hline(ax - 1, 12, 3, T.d2); q.px(ax, 10, T.d2); }
      q.clusters(2, 15, W - 4, 3, T.d, 4, 3, 11);
    });
    put(c, p, s, X, Y);
  };

  /* ============================ TERRENO BALDIO ============================ */

  A.caixote = function (c, p, X, Y, env, S) {
    const metal = !!p.state.metal;
    const s = spr('caixote:' + metal, p.w * S, p.h * S, (q, cx, W, H) => {
      if (metal) {
        const T = P.tones('#8d99a6');
        q.rect(0, 0, W, H, T.d);
        q.box(0, 0, W, H, '#7f8b98', { bevel: 1 });
        q.rect(3, 3, W - 6, H - 6, T.b);
        q.hline(3, 3, W - 6, T.l); q.vline(3, 3, H - 6, T.l); q.hline(3, H - 4, W - 6, T.d); q.vline(W - 4, 3, H - 6, T.d);
        // nervuras horizontais estampadas
        for (const y of [8, 13, 18]) { q.hline(5, y, W - 10, T.d); q.hline(5, y + 1, W - 10, T.h); }
        // placa com aviso
        q.rect(9, 21, 10, 3, '#e8c13a'); for (let i = 0; i < 10; i += 3) q.rect(9 + i, 21, 1, 3, '#2a2a33');
        // rebites
        const riv = (x, y) => { q.rect(x, y, 2, 2, T.d2); q.px(x, y, T.h); };
        for (const [a, b] of [[1, 1], [W - 3, 1], [1, H - 3], [W - 3, H - 3], [13, 1], [13, H - 3], [1, 13], [W - 3, 13]]) riv(a, b);
      } else {
        const F = P.tones('#8e5d32'), B = P.tones('#b0804c');
        // tábuas internas
        q.rect(0, 0, W, H, F.d);
        for (let i = 0; i < 3; i++) {
          const y = 3 + i * 7;
          q.rect(3, y, W - 6, 7, B.b); q.hline(3, y, W - 6, B.l); q.hline(3, y + 6, W - 6, B.d2);
          q.clusters(4, y + 2, W - 8, 3, B.d, 3, 4, 31 + i);
        }
        // travessa diagonal
        for (let k = -1; k <= 1; k++) q.line(3, H - 4 + k, W - 4 + k, 3, k < 0 ? F.l : k > 0 ? F.d : F.b);
        q.line(3, H - 3, W - 3, 3, F.d2);
        // moldura
        q.rect(0, 0, W, 3, F.b); q.rect(0, H - 3, W, 3, F.b); q.rect(0, 0, 3, H, F.b); q.rect(W - 3, 0, 3, H, F.b);
        q.hline(0, 0, W, F.h); q.vline(0, 0, H, F.l); q.hline(1, 1, W - 2, F.l);
        q.hline(0, H - 1, W, F.d2); q.vline(W - 1, 0, H, F.d); q.hline(3, 2, W - 6, F.d); q.hline(3, H - 3, W - 6, F.d);
        // pregos
        for (const [a, b] of [[1, 1], [W - 2, 1], [1, H - 2], [W - 2, H - 2], [1, 13], [W - 2, 13], [13, 1], [13, H - 2]]) { q.px(a, b, '#3a3540'); }
        for (const [a, b] of [[1, 1], [W - 2, 1], [13, 1]]) q.px(a, b - 0, '#5a5560');
      }
    });
    put(c, p, s, X, Y);
  };

  A.lata = function (c, p, X, Y, env, S) {
    const am = !!p.state.amassada;
    const s = spr('lata:' + am, p.w * S, p.h * S, (q, cx, W, H) => {
      const R = P.tones('#c8352a'), M = P.tones('#c4ccd4');
      if (am) {
        // lata pisada: baixinha e torta
        q.poly([[0, 6], [7, 4], [8, 11], [1, 12]], R.b);
        q.poly([[0, 5], [7, 3], [7, 5], [0, 7]], M.l); q.line(0, 5, 7, 3, M.h);
        q.line(1, 9, 7, 7, R.d2); q.line(2, 8, 4, 10, R.d); q.px(5, 9, R.h); q.px(2, 7, R.l); q.px(3, 7, R.h);
        q.line(1, 12, 7, 11, M.d); q.px(4, 8, '#f1f1f1');
      } else {
        q.rect(0, 1, W, H - 2, R.b);
        q.vline(0, 1, H - 2, R.d); q.vline(1, 1, H - 2, R.l); q.vline(2, 1, H - 2, R.h); q.vline(W - 2, 1, H - 2, R.d); q.vline(W - 1, 1, H - 2, R.d2);
        // onda branca do rótulo
        q.hline(0, 6, 3, '#f4f4f4'); q.hline(3, 5, 3, '#f4f4f4'); q.hline(6, 6, 2, '#d8d8d8'); q.hline(1, 7, 3, '#e0e0e0');
        // tampa e fundo de alumínio
        q.rect(0, 0, W, 2, M.b); q.hline(1, 0, W - 2, M.h); q.px(W - 3, 1, M.d2); q.px(W - 1, 1, M.d);
        q.rect(0, H - 2, W, 2, M.d); q.hline(1, H - 2, 3, M.l);
      }
    });
    put(c, p, s, X, Y);
  };

  A.bola = function (c, p, X, Y, env, S) {
    const cor = p.state.cor || '#e74c3c';
    const s = spr('bola:' + cor, p.w * S, p.h * S, (q, cx, W, H) => {
      const r = W / 2;
      q.ball(r, r, r, r, cor);
      // faixa clara curva
      const band = '#f4efe4', bandD = P.mix('#f4efe4', P.dark(cor, 0.3), 0.4);
      for (let x = 1; x < W - 1; x++) {
        const u = (x + 0.5 - r) / r;
        const y = Math.round(r + 2 - u * u * 3.2);
        if (u * u + ((y + 0.5 - r) / r) ** 2 > 0.8) continue;
        q.px(x, y, x > W * 0.62 ? bandD : band); q.px(x, y + 1, x > W * 0.62 ? P.dark(cor, 0.35) : P.dark(cor, 0.12));
      }
      q.rect(3, 3, 2, 2, P.light(cor, 0.75)); q.px(4, 2, P.light(cor, 0.55));
    });
    put(c, p, s, X, Y);
  };

  A.garrafa = function (c, p, X, Y, env, S) {
    const s = spr('garrafa', p.w * S, p.h * S, (q, cx, W, H) => {
      const T = P.tones('#2f8f46');
      const g = (a) => P.rgba(T.b, a);
      q.rect(2, 1, 2, 5, T.b); q.rect(1, 6, 4, 1, T.b); q.rect(0, 7, W, H - 7, g(0.9));
      q.rect(2, 0, 2, 1, T.h); q.hline(2, 1, 2, T.l);
      q.vline(W - 1, 7, H - 7, T.d); q.vline(3, 2, 4, T.d); q.hline(0, H - 1, W, T.d2);
      // rótulo
      q.rect(0, 10, W, 3, '#efe3c8'); q.hline(1, 11, 4, '#c0392b'); q.vline(W - 1, 10, 3, '#c4b898');
      // reflexo
      q.vline(1, 7, 3, T.h); q.vline(1, 13, 2, T.h); q.px(2, 2, T.h); q.px(2, 3, T.l);
    });
    put(c, p, s, X, Y);
  };

  /* ============================ PORTARIA ============================ */

  A.painel = function (c, p, X, Y, env, S) {
    const loose = !!p.perceived;
    const s = spr('painel:' + loose, p.w * S, p.h * S, (q, cx, W, H) => {
      const T = P.tones('#9aa2a8');
      q.box(0, 0, W, H, '#9aa2a8');
      q.rect(2, 2, W - 4, H - 4, T.b); q.hline(2, 2, W - 4, T.d); q.vline(2, 2, H - 4, T.d); q.hline(2, H - 3, W - 4, T.l); q.vline(W - 3, 2, H - 4, T.l);
      // grelha de ventilação
      for (const y of [5, 8, 11]) { q.hline(6, y, 12, T.d2); q.hline(6, y + 1, 12, T.h); }
      // parafusos: só dois, os outros furos vazios
      q.rect(1, 1, 2, 2, '#5d6468'); q.px(1, 1, '#d8dde0');
      q.rect(W - 3, H - 3, 2, 2, '#5d6468'); q.px(W - 3, H - 3, '#d8dde0');
      q.px(W - 2, 1, '#3d4245'); q.px(1, H - 2, '#3d4245');
      if (loose) { q.poly([[W - 9, 0], [W, 0], [W, 7]], '#2a2e31'); q.line(W - 9, 0, W - 1, 7, T.h); q.line(W - 9, 1, W - 2, 7, T.l); q.px(W - 3, 2, '#6b5a2a'); }
    });
    put(c, p, s, X, Y);
  };

  /* ============================ COMIDAS ============================ */

  A.laranja = function (c, p, X, Y, env, S) {
    const s = spr('laranja', p.w * S, p.h * S, (q, cx, W, H) => {
      q.ball(5, 5.5, 4.6, 4.4, '#f7901c');
      const T = P.tones('#f7901c');
      q.px(6, 4, T.l); q.px(3, 7, T.l); q.px(7, 7, T.d); q.px(5, 8, T.d);
      q.rect(2, 3, 2, 1, '#fff0c8'); q.px(2, 4, T.h);
      q.px(5, 1, '#6a4a24'); q.rect(6, 0, 2, 1, '#4caf50'); q.px(8, 0, '#2f7a34'); q.px(6, 1, '#2f7a34');
    });
    put(c, p, s, X, Y);
  };

  A.maca = function (c, p, X, Y, env, S) {
    const s = spr('maca', p.w * S, p.h * S, (q, cx, W, H) => {
      q.ball(5, 5.8, 4.6, 4.2, '#d62828');
      const T = P.tones('#d62828');
      // covinha de cima
      q.px(4, 1, 'rgba(0,0,0,0)'); cx.clearRect(4, 1, 2, 1); q.px(4, 2, T.d); q.px(5, 2, T.d2);
      q.rect(2, 3, 1, 2, '#ffc0b0'); q.px(3, 3, T.h);
      q.px(7, 8, T.d2); q.px(4, 9, T.d);
      q.vline(5, 0, 2, '#6a4628'); q.rect(6, 0, 3, 1, '#58b04a'); q.px(7, 1, '#3a8a34');
    });
    put(c, p, s, X, Y);
  };

  A.banana = function (c, p, X, Y, env, S) {
    const s = spr('banana', p.w * S, p.h * S, (q, cx, W, H) => {
      const T = P.tones('#f2cf3a');
      for (let x = 0; x < W; x++) {
        const sn = Math.sin(Math.PI * (x + 0.5) / W);
        const yb = Math.round(1.6 + 3.6 * sn), th = Math.max(1, Math.round(0.8 + 2.3 * sn));
        const yt = yb - th + 1;
        for (let y = yt; y <= yb; y++) q.px(x, y, y === yb ? T.d : y === yt ? T.h : T.b);
        if (th >= 3) q.px(x, yb - 1, T.l);
      }
      q.rect(0, 0, 2, 2, '#7a8a2e'); q.px(0, 0, '#4a3420');
      q.px(W - 1, 1, '#4a3420');
      q.px(5, 3, '#8a6a20'); q.px(9, 3, '#8a6a20');
    });
    put(c, p, s, X, Y);
  };

  A.pao = function (c, p, X, Y, env, S) {
    const s = spr('pao', p.w * S, p.h * S, (q, cx, W, H) => {
      q.ball(7, 4.4, 7, 3.7, '#d79a52');
      const T = P.tones('#d79a52');
      q.hline(2, H - 1, W - 4, T.d2);
      // pestana do pão francês
      q.line(3, 4, 10, 1, '#f6dca4'); q.line(4, 4, 11, 1, '#ecc47c'); q.line(4, 5, 11, 2, T.d);
      q.px(4, 3, '#fff0cc'); q.px(5, 3, '#fff0cc');
    });
    put(c, p, s, X, Y);
  };

  A.cafe = function (c, p, X, Y, env, S) {
    const s = spr('cafe', p.w * S, p.h * S, (q, cx, W, H) => {
      const T = P.tones('#eeeae4');
      q.rect(0, 2, 6, 8, T.b); q.vline(0, 2, 8, T.h); q.vline(1, 3, 6, T.l); q.vline(5, 2, 8, T.d); q.hline(1, 9, 5, T.d2);
      q.hline(0, 2, 6, '#ffffff');
      q.rect(1, 3, 4, 1, '#4a2410'); q.px(1, 3, '#8a5432'); q.px(2, 3, '#6a3a1e');
      // asa
      q.rect(6, 4, 2, 4, T.d); q.px(6, 5, 'rgba(0,0,0,0)'); cx.clearRect(6, 5, 1, 2); q.vline(7, 5, 2, T.d2);
      q.hline(1, 6, 4, '#c0392b');
    });
    put(c, p, s, X, Y);
    // vapor animado
    const t = env.time || 0;
    c.save(); c.globalAlpha = 0.55;
    for (let i = 0; i < 2; i++) {
      const ph = (t * 1.2 + i * 0.5) % 1, yy = Math.round(Y + 2 - ph * 7), xx = Math.round(X + 2 + i * 2 + Math.sin(t * 5 + i * 2) * 1);
      c.globalAlpha = 0.6 * (1 - ph);
      c.fillStyle = '#ffffff'; c.fillRect(xx, yy, 1, 2);
    }
    c.restore();
  };

  A.chocolate = function (c, p, X, Y, env, S) {
    const s = spr('chocolate', p.w * S, p.h * S, (q, cx, W, H) => {
      const C = P.tones('#5b3418');
      q.rect(0, 0, 7, H, C.b);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const x = i * 3 + 1, y = j * 3;
        q.rect(x, y, 2, 2, C.b); q.px(x, y, C.l); q.px(x + 1, y + 1, C.d);
      }
      q.vline(0, 0, H, C.l); q.hline(0, H - 1, 7, C.d2); q.vline(3, 0, H, C.d); q.hline(0, 2, 7, C.d);
      // papel alumínio + embalagem
      q.vline(6, 0, H, '#dfe4ea'); q.px(6, 1, '#ffffff');
      const R = P.tones('#c0392b');
      q.rect(7, 0, W - 7, H, R.b); q.hline(7, 0, W - 7, R.l); q.hline(7, H - 1, W - 7, R.d);
      q.hline(8, 2, 4, '#f4e2b0'); q.px(9, 3, '#f4e2b0');
      for (let y = 0; y < H; y += 2) q.px(W - 1, y, R.d2);
    });
    put(c, p, s, X, Y);
  };

  // nota de R$ 10
  A.dinheiro = function (c, p, X, Y, env, S) {
    const s = spr('dinheiro', p.w * S, p.h * S, (q, cx, W, H) => {
      const T = P.tones('#e0896a');
      q.rect(0, 0, W, H, T.b); q.hline(0, 0, W, T.l); q.vline(0, 0, H, T.l); q.hline(0, H - 1, W, T.d);
      for (let x = 1; x < W; x += 2) q.px(x, H - 2, T.d);
      let x = 1;
      x += glyph(q, 'R', x, 1, '#7a2a1a') + 1;
      x += glyph(q, '$', x - 1, 1, '#7a2a1a');
      x += 1;
      x += glyph(q, '1', x, 1, '#5a1a10') + 1;
      glyph(q, '0', x, 1, '#5a1a10');
    });
    put(c, p, s, X, Y);
  };

  // pipa com rabiola (balança quando presa na árvore)
  A.pipa = function (c, p, X, Y, env, S) {
    const t = env.time || 0;
    const sway = p.static ? Math.round(Math.sin(t * 3) * S) : 0;
    const fr = p.static ? (Math.floor(t * 4) % 2) : 0;
    const s = spr('pipa:' + fr, p.w * S, p.h * S, (q, cx, W, H) => {
      const top = [9, 0], lf = [1, 7], rt = [17, 7], bot = [9, 14];
      const R = P.tones('#e74c3c'), Y2 = P.tones('#f1c40f'), B = P.tones('#3498db');
      q.poly([top, rt, bot, lf], Y2.b);
      q.poly([top, [13.6, 3.6], [4.4, 3.6]], R.b);
      q.poly([[1, 7.5], [17, 7.5], [13, 10.5], [5, 10.5]].map((a) => a), Y2.b);
      q.poly([[5, 10.5], [13, 10.5], bot], B.b);
      // lado direito em sombra
      q.poly([top, rt, bot, [9, 14]], 'rgba(40,20,60,0.18)');
      q.line(9, 1, 5, 3, R.h); q.line(2, 7, 6, 5, Y2.h);
      // varetas
      q.vline(9, 1, 13, '#7a5a3a'); q.hline(2, 6, 15, '#8a6a46');
      // rabiola
      const pts = fr ? [[9, 14], [10, 16], [9, 18], [8, 20], [9, 21]] : [[9, 14], [8, 16], [9, 18], [10, 20], [9, 21]];
      for (let i = 0; i + 1 < pts.length; i++) q.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], '#ecf0f1');
      q.px(pts[1][0] - 1, pts[1][1], '#e74c3c'); q.px(pts[1][0] + 1, pts[1][1], '#e74c3c');
      q.px(pts[3][0] - 1, pts[3][1], '#3498db'); q.px(pts[3][0] + 1, pts[3][1], '#3498db');
    });
    put(c, p, s, X, Y + sway);
  };

  /* ============================ PRAÇA: BANCO ============================ */

  const WOOD = P.tones('#a5713f'), WOODB = P.tones('#8a5a2e'), IRON = P.tones('#3c4148');

  // tábua avulsa (desenhada por quadro, com contorno manual)
  function plank(c, x, y, w, broken, seed) {
    const q = P.painter(c), T = broken ? WOODB : WOOD;
    x = Math.round(x); y = Math.round(y); w = Math.max(4, Math.round(w));
    q.rect(x - 1, y - 1, w + 2, 6, T.o);
    q.rect(x, y, w, 4, T.b); q.hline(x, y, w, T.h); q.hline(x, y + 1, w, T.l); q.hline(x, y + 3, w, T.d2);
    for (let i = 0; i < Math.floor(w / 9); i++) { const gx = x + 3 + Math.floor(P.hash(i, seed, 5) * (w - 6)); q.hline(gx, y + 2, 3, T.d); }
    if (broken) {
      // ponta lascada
      c.clearRect(x + w - 1, y + 1, 2, 1); c.clearRect(x + w - 2, y + 3, 3, 1);
      q.px(x + w, y + 2, T.d); q.px(x + w - 1, y + 3, T.o); q.px(x + w - 2, y + 4, T.o);
    } else { q.px(x + 1, y + 1, T.d2); q.px(x + w - 2, y + 1, T.d2); }
  }

  function benchLegs(full) {
    return P.sprite('prop:banco:pes:' + full, 62, 30, (q, c) => {
      c.translate(1, 5);
      const leg = (lx) => {
        // pé de ferro fundido com voluta
        q.rect(lx, 12, 4, 10, IRON.b); q.vline(lx, 12, 10, IRON.l); q.vline(lx + 3, 12, 10, IRON.d);
        q.rect(lx - 2, 22, 8, 2, IRON.b); q.hline(lx - 2, 22, 8, IRON.l); q.hline(lx - 2, 23, 8, IRON.d2);
        q.px(lx - 1, 15, IRON.b); q.px(lx + 4, 15, IRON.b);
        if (full) { q.rect(lx - 2, -4, 4, 16, IRON.b); q.vline(lx - 2, -4, 16, IRON.l); q.vline(lx + 1, -4, 16, IRON.d); q.hline(lx - 2, -4, 4, IRON.h); }
        else { q.rect(lx - 2, 8, 4, 4, IRON.b); q.vline(lx - 2, 8, 4, IRON.l); q.px(lx - 2, 7, IRON.d); q.px(lx + 1, 8, IRON.d2); }
      };
      leg(6); leg(50);
    });
  }

  A.banco = function (c, p, X, Y, env, S) {
    const intact = !p.broken;
    const asm = p.restoring && p.restoring.phase === 'assemble';
    const k = asm ? ease(Math.min(1, p.restoring.t)) : (intact ? 1 : 0);
    const planks = [[0, 5, 30], [0, 2, 30], [1, -2, 28]];
    if (k >= 1) {
      const s = P.sprite('prop:banco:ok', 62, 30, (q, cx) => {
        cx.drawImage(benchLegs(true), 0, 0);
        cx.translate(1, 5);
        planks.forEach((pl, i) => plank(cx, pl[0] * 2, pl[1] * 2, pl[2] * 2, false, i));
        // parafusos nas tábuas
        for (const [bx, by] of [[5, -2], [53, -2], [5, 6], [53, 6], [7, 12], [51, 12]]) q.px(bx, by, '#c8d0d8');
      }, { outline: false });
      blit(c, s, X - 1, Y - 5, p);
      return;
    }
    blit(c, benchLegs(false), X - 1, Y - 5, p);
    planks.forEach((pl, i) => {
      const qx = (i * 9 - 2) * S, qy = (10 - i) * S;
      const px = lerp(qx, pl[0] * S, k), py = lerp(qy, pl[1] * S, k);
      plank(c, X + px, Y + py, pl[2] * S * (0.5 + k * 0.5), true, i);
    });
  };

  /* ============================ PRAÇA: POSTE ============================ */

  const PO = P.tones('#3a4550');
  // parte de cima do poste (pivô no canto (4,60) do canvas)
  function posteTop(lit) {
    return P.sprite('prop:poste:topo:' + lit, 24, 64, (q) => {
      const ox = 4, oy = 60;
      const r = (x, y, w, h, col) => q.rect(ox + x, oy + y, w, h, col);
      // haste
      r(-2, -56, 4, 56, PO.b); r(-2, -56, 1, 56, PO.l); r(1, -56, 1, 56, PO.d);
      r(-3, -20, 6, 2, PO.b); r(-3, -20, 6, 1, PO.l);
      // remate no topo
      r(-1, -59, 2, 3, PO.d); r(-1, -59, 1, 1, PO.h);
      // braço
      r(-2, -56, 14, 3, PO.b); r(-2, -56, 14, 1, PO.l); r(2, -53, 6, 1, PO.d); r(0, -53, 2, 2, PO.b);
      // luminária: chapéu + vidro
      r(7, -54, 10, 2, PO.b); r(7, -54, 10, 1, PO.h); r(8, -52, 8, 2, PO.d);
      r(9, -50, 6, 3, lit ? '#ffe9a8' : '#9aa8b4'); r(9, -50, 2, 1, lit ? '#ffffff' : '#d4dde4');
      r(14, -50, 1, 3, lit ? '#f0b850' : '#6a7884'); r(9, -47, 6, 1, PO.d);
    }, { outline: false });
  }
  // rotação pixel a pixel (sem borrão) + contorno, em cache por ângulo
  function posteTopRot(lit, ang) {
    const step = Math.round(ang / 0.04);
    ang = step * 0.04;
    const src = posteTop(lit);
    const sw = src.width, sh = src.height, ox = 4, oy = 60;
    const cs = Math.cos(ang), sn = Math.sin(ang);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [u, v] of [[-ox, -oy], [sw - ox, -oy], [-ox, sh - oy], [sw - ox, sh - oy]]) {
      const x = u * cs - v * sn, y = u * sn + v * cs;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    x0 = Math.floor(x0) - 1; y0 = Math.floor(y0) - 1; x1 = Math.ceil(x1) + 1; y1 = Math.ceil(y1) + 1;
    const W = x1 - x0, H = y1 - y0;
    const cv = P.sprite('prop:poste:rot:' + lit + ':' + step, W, H, (q, c) => {
      const sd = src.getContext('2d').getImageData(0, 0, sw, sh).data;
      const img = c.createImageData(W, H), d = img.data;
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const u = x0 + i + 0.5, v = y0 + j + 0.5;
        const sx = Math.floor(u * cs + v * sn + ox), sy = Math.floor(-u * sn + v * cs + oy);
        if (sx < 0 || sy < 0 || sx >= sw || sy >= sh) continue;
        const a = (sy * sw + sx) * 4, b = (j * W + i) * 4;
        d[b] = sd[a]; d[b + 1] = sd[a + 1]; d[b + 2] = sd[a + 2]; d[b + 3] = sd[a + 3];
      }
      c.putImageData(img, 0, 0);
    });
    return { cv, x0, y0 };
  }
  function posteBase() {
    return P.sprite('prop:poste:base', 18, 60, (q, c) => {
      c.translate(3, 1); // origem = (x+0, y+56) da caixa em px → base desenhada em y 0..57
      // haste de baixo (y 56..112 da caixa → 0..56 aqui)
      q.rect(4, 0, 4, 50, PO.b); q.vline(4, 0, 50, PO.l); q.vline(7, 0, 50, PO.d);
      q.rect(3, 22, 6, 3, PO.b); q.hline(3, 22, 6, PO.l); q.hline(3, 24, 6, PO.d);
      // pedestal
      q.rect(2, 44, 8, 8, PO.b); q.vline(2, 44, 8, PO.l); q.vline(9, 44, 8, PO.d); q.hline(2, 44, 8, PO.h);
      q.rect(0, 52, 12, 4, PO.b); q.hline(0, 52, 12, PO.l); q.vline(11, 52, 4, PO.d); q.hline(0, 55, 12, PO.d2);
      q.hline(3, 47, 6, PO.d); q.hline(3, 48, 6, PO.l);
    });
  }

  A.poste = function (c, p, X, Y, env, S) {
    const intact = !p.broken;
    const asm = p.restoring && p.restoring.phase === 'assemble';
    const k = asm ? ease(Math.min(1, p.restoring.t)) : (intact ? 1 : 0);
    const lit = k >= 1 && env && env.night > 0.25;
    blit(c, posteBase(), X - 3, Y + 56 - 1, p);
    const ang = lerp(1.25, 0, k);
    const pvx = X + 6, pvy = Y + 56;
    if (k >= 1) {
      const s = posteTopRot(lit, 0);
      blit(c, s.cv, pvx + s.x0, pvy + s.y0, p);
      if (lit) {
        // halo suave da lâmpada
        c.save(); c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 0.12 * Math.min(1, env.night * 1.5); c.fillStyle = '#ffd890';
        c.fillRect(pvx + 5, pvy - 50, 14, 8); c.fillRect(pvx + 3, pvy - 46, 18, 8); c.fillRect(pvx + 7, pvy - 39, 10, 3);
        c.restore();
      }
      return;
    }
    const s = posteTopRot(false, ang);
    blit(c, s.cv, pvx + s.x0, pvy + s.y0, p);
    // metal rasgado na dobra
    const q = P.painter(c);
    q.px(pvx - 3, pvy - 1, PO.o); q.px(pvx + 2, pvy - 2, PO.l); q.px(pvx - 2, pvy - 2, PO.d);
    if (!p.restoring) {
      // cacos da lâmpada no chão
      q.rect(X - 6, Y + 108, 2, 1, '#c9d6df'); q.px(X - 3, Y + 109, '#ffffff'); q.rect(X - 2, Y + 110, 2, 1, '#9fb0bd');
      q.rect(X + 14, Y + 110, 2, 1, '#c9d6df'); q.px(X + 17, Y + 110, '#ffffff');
    }
  };
})(window.VG = window.VG || {});

/* =====================================================================
 * Vida do cenário, desenhada na grade fina (o dobro de pixels do mundo):
 * árvores e arbustos com folhagem detalhada que balança com o vento,
 * folhas caindo, grama, borboletas de dia, mariposas nos postes à noite,
 * vapor saindo da padaria, poeira dançando na luz do apartamento e um
 * gato de rua (conteúdo original do jogo) andando pelo terreno baldio.
 * ===================================================================== */
(function (G) {
  'use strict';
  const U = G.util;
  const TS = G.TILE;

  /* ---------- texturas geradas uma vez (pixel a pixel, sem borrar) ---------- */
  function canvas(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }

  /** Tufo de folhas: muitas folhinhas com 4 tons (luz de cima à esquerda) e contorno escuro. */
  function foliage(w, h, seed, pal) {
    const cv = canvas(w, h), cx = cv.getContext('2d');
    const img = cx.createImageData(w, h), d = img.data;
    const cols = pal.map(hexRgb);
    const rx = w / 2 - 2, ry = h / 2 - 2, ox = w / 2, oy = h / 2;
    const set = (x, y, c) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const i = (y * w + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; };
    // massa de fundo (sombra) e depois folhinhas sobrepostas, das de trás para as da frente
    const n = Math.round(w * h / 9);
    const leaves = [];
    for (let i = 0; i < n; i++) {
      const a = U.hash(i, seed, 1) * Math.PI * 2, r = Math.sqrt(U.hash(i, seed, 2));
      const x = ox + Math.cos(a) * rx * r, y = oy + Math.sin(a) * ry * r * 0.95;
      leaves.push([x, y, U.hash(i, seed, 3)]);
    }
    leaves.sort((p, q) => p[1] - q[1]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = (x - ox) / rx, v = (y - oy) / ry;
      if (u * u + v * v < 0.82) set(x, y, cols[0]);
    }
    for (const [x, y, k] of leaves) {
      const lu = (x - ox) / rx, lv = (y - oy) / ry;
      const lit = -lu * 0.55 - lv * 0.85 + (k - 0.5) * 0.5;
      const t = lit > 0.55 ? 3 : lit > 0.05 ? 2 : lit > -0.5 ? 1 : 0;
      const c = cols[t];
      // folhinha de 3×2 com ponta
      set(Math.round(x), Math.round(y), c); set(Math.round(x) + 1, Math.round(y), c); set(Math.round(x) - 1, Math.round(y), c);
      set(Math.round(x), Math.round(y) - 1, c); set(Math.round(x) + (k > 0.5 ? 1 : -1), Math.round(y) + 1, cols[Math.max(0, t - 1)]);
      if (t === 3 && k > 0.7) set(Math.round(x), Math.round(y) - 1, cols[4] || c);
    }
    // contorno
    const src = new Uint8ClampedArray(d);
    const A = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : src[(y * w + x) * 4 + 3];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (A(x, y)) continue;
      if (A(x + 1, y) || A(x - 1, y) || A(x, y + 1) || A(x, y - 1)) { const i = (y * w + x) * 4; d[i] = 18; d[i + 1] = 34; d[i + 2] = 24; d[i + 3] = 235; }
    }
    cx.putImageData(img, 0, 0);
    return cv;
  }
  const LEAF = ['#24502b', '#2f6e36', '#3f8c41', '#5bab4e', '#8fd06a'];
  const texCache = new Map();
  const tex = (key, fn) => { let t = texCache.get(key); if (!t) { t = fn(); texCache.set(key, t); } return t; };

  /** Árvore da praça: tronco com casca, galhos e 6 tufos que balançam separados. */
  function tree(c, d, x, y, time, S) {
    const w = d.w * S, h = d.h * S, X = Math.round(x * S), Y = Math.round(y * S);
    const trunk = tex('trunk' + w + 'x' + h, () => {
      const cv = canvas(w, h), cx = cv.getContext('2d');
      const mid = Math.round(w / 2), top = Math.round(h * 0.42);
      const P = (a, b, ww, hh, col) => { cx.fillStyle = col; cx.fillRect(a, b, ww, hh); };
      for (let yy = top; yy < h; yy++) {
        const k = (yy - top) / (h - top), half = Math.round(4 + k * 3 + (yy > h - 6 ? (yy - (h - 6)) * 1.5 : 0));
        P(mid - half, yy, half * 2, 1, '#5e4028'); P(mid - half, yy, 2, 1, '#3e2a1a'); P(mid + half - 3, yy, 2, 1, '#7a5636');
        if ((yy * 7) % 11 < 2) P(mid - half + 3 + (yy % 3), yy, 2, 1, '#4a3220');
      }
      // galhos
      for (const [sx, dir, len] of [[0, -1, 26], [0, 1, 22], [0, -1, 14]]) {
        for (let i = 0; i < len; i++) P(mid + dir * i, top + 12 - Math.round(i * 0.8) - sx, 3, 2, '#5e4028');
      }
      const g = cx.getImageData(0, 0, w, h); // contorno
      const dd = g.data, src = new Uint8ClampedArray(dd);
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        const i = (yy * w + xx) * 4; if (src[i + 3]) continue;
        const n = (a, b) => a >= 0 && b >= 0 && a < w && b < h && src[(b * w + a) * 4 + 3];
        if (n(xx + 1, yy) || n(xx - 1, yy) || n(xx, yy + 1) || n(xx, yy - 1)) { dd[i] = 30; dd[i + 1] = 18; dd[i + 2] = 12; dd[i + 3] = 240; }
      }
      cx.putImageData(g, 0, 0);
      return cv;
    });
    c.drawImage(trunk, X, Y);
    // tufos: (posição relativa, tamanho, fase)
    const tufts = [[0.2, 0.36, 72, 56, 0], [0.82, 0.36, 70, 54, 1.3], [0.5, 0.24, 104, 76, 2.1], [0.3, 0.12, 70, 54, 3.4], [0.7, 0.12, 70, 54, 4.2], [0.5, 0.42, 90, 48, 5.0], [0.52, 0.04, 56, 40, 0.7]];
    tufts.forEach(([u, v, tw, th, ph], i) => {
      const t = tex('tuft' + i + tw, () => foliage(tw, th, 31 + i * 7, LEAF));
      const sway = Math.round(Math.sin(time * 1.4 + ph) * (1.5 + (1 - v) * 1.5) + Math.sin(time * 3.1 + ph * 2) * 0.6);
      c.drawImage(t, Math.round(X + w * u - tw / 2 + sway), Math.round(Y + h * v - th / 2 + (Math.sin(time * 1.4 + ph) > 0.7 ? 1 : 0)));
    });
  }
  function bush(c, d, x, y, time, S) {
    const w = d.w * S + 6, h = d.h * S + 8;
    const t = tex('bush' + w + 'x' + h, () => foliage(w, h, 77 + w, LEAF));
    const sway = Math.round(Math.sin(time * 1.7 + x * 0.1) * 1);
    // só a metade de cima aparece (a de baixo fica "dentro" do chão)
    c.drawImage(t, 0, 0, w, Math.round(h * 0.62), Math.round(x * S) - 3 + sway, Math.round((y + d.h) * S) - Math.round(h * 0.62), w, Math.round(h * 0.62));
  }

  /* ---------- seres e efeitos vivos ---------- */
  class Ambient {
    constructor(game) {
      this.g = game;
      this.t = 0;
      this.butterflies = [];
      for (let i = 0; i < 3; i++) this.butterflies.push({ x: TS * (82 + i * 6), y: TS * 38 - 20, hx: TS * (82 + i * 6), hy: TS * 38 - 22, t: Math.random() * 10, col: ['#ffd84d', '#ffffff', '#ff9ec7'][i] });
      this.moths = [];
      this.cat = { x: TS * 12, dir: 1, state: 'walk', t: 0, wait: 0 };
      this.motes = [];
      for (let i = 0; i < 18; i++) this.motes.push({ x: TS * (53 + Math.random() * 6), y: TS * 27 + Math.random() * 44, t: Math.random() * 10 });
      this.grass = [];
      for (let x = TS * 80 + 2; x < TS * 102; x += 3 + Math.floor(U.hash(x, 1, 1) * 4)) this.grass.push({ x, h: 2 + Math.floor(U.hash(x, 2, 2) * 4), ph: U.hash(x, 3, 3) * 6 });
    }

    update(dt) {
      const g = this.g;
      this.t += dt;
      const night = G.nightAt(g.clock.min);
      // folhas caindo da árvore da praça
      const tree = g.decor.find((d) => d.type === 'arvore');
      if (tree && Math.random() < dt * 0.6) g.particles.leaf(tree.x + 8 + Math.random() * (tree.w - 16), tree.y + 10 + Math.random() * 24, LEAF[1 + Math.floor(Math.random() * 3)]);
      // vapor saindo da porta da padaria (aberta) e do café no balcão
      if (G.padariaAberta(g) && Math.random() < dt * 2.5) g.particles.steam(TS * 113 + Math.random() * 6, TS * 38 - 17);
      // borboletas: voo em oito em volta de um ponto
      for (const b of this.butterflies) {
        b.t += dt;
        b.x = b.hx + Math.sin(b.t * 0.7) * 30 + Math.sin(b.t * 2.3) * 6;
        b.y = b.hy - 10 + Math.sin(b.t * 1.4) * 8 + Math.sin(b.t * 5) * 2;
      }
      // mariposas em volta dos postes acesos
      if (night > 0.4 && this.moths.length < 9) {
        for (const l of g.lights) if (l.night && Math.random() < dt * 0.5) this.moths.push({ cx: l.x, cy: l.y + 4, a: Math.random() * 6, r: 4 + Math.random() * 6, s: 2 + Math.random() * 3 });
      }
      if (night < 0.3) this.moths.length = 0;
      for (const m of this.moths) m.a += m.s * dt;
      // gato de rua: anda, para, se lambe, volta
      const cat = this.cat;
      cat.t += dt;
      if (cat.state === 'walk') {
        cat.x += cat.dir * 14 * dt;
        if (cat.x < TS * 3 || cat.x > TS * 27) { cat.dir *= -1; }
        if (Math.random() < dt * 0.12) { cat.state = Math.random() < 0.5 ? 'sit' : 'lick'; cat.wait = 3 + Math.random() * 5; }
        const p = g.player;
        if (Math.abs(p.cx - cat.x) < 26 && Math.abs(p.y + p.h - TS * 38) < 8 && Math.abs(p.vx) > 60) { cat.state = 'run'; cat.dir = cat.x > p.cx ? 1 : -1; cat.wait = 1.2; }
      } else if (cat.state === 'run') {
        cat.x = U.clamp(cat.x + cat.dir * 60 * dt, TS * 3, TS * 27); cat.wait -= dt; if (cat.wait <= 0) cat.state = 'walk';
      } else { cat.wait -= dt; if (cat.wait <= 0) cat.state = 'walk'; }
      for (const m of this.motes) { m.t += dt; }
    }

    /** Desenhado logo depois da decoração (atrás das pessoas). */
    drawBack(c, cam, env) {
      const g = this.g, T = this.t;
      G.hi(c, (S) => {
        // grama da praça balançando
        for (const gr of this.grass) {
          const x = Math.round((gr.x - cam.x) * S), y = Math.round((TS * 38 - cam.y) * S);
          if (x < -4 || x > G.VIEW_W * S + 4) continue;
          const sw = Math.round(Math.sin(T * 2 + gr.ph) * 1.2);
          c.fillStyle = '#3f8a3a'; c.fillRect(x, y - gr.h, 1, gr.h); c.fillRect(x + sw, y - gr.h - 1, 1, 1);
          c.fillStyle = '#6cbf55'; c.fillRect(x + 1, y - gr.h + 1, 1, gr.h - 1); c.fillRect(x + 1 + sw, y - gr.h, 1, 1);
        }
        // poeira dançando na luz da sala (de dia, com a janela da sacada)
        if (env.night < 0.5) {
          for (const m of this.motes) {
            const x = Math.round((m.x + Math.sin(m.t * 0.4) * 6 - cam.x) * S), y = Math.round((m.y + Math.sin(m.t * 0.3 + 2) * 4 - cam.y) * S);
            c.globalAlpha = 0.25 + 0.25 * Math.sin(m.t * 1.5); c.fillStyle = '#fff6d8'; c.fillRect(x, y, 1, 1);
          }
          c.globalAlpha = 1;
        }
        // gato
        this.drawCat(c, cam, S);
      });
    }

    /** Desenhado por cima das pessoas (insetos voando). */
    drawFront(c, cam, env) {
      const T = this.t;
      G.hi(c, (S) => {
        if (env.night < 0.6) for (const b of this.butterflies) {
          const x = Math.round((b.x - cam.x) * S), y = Math.round((b.y - cam.y) * S);
          if (x < -10 || x > G.VIEW_W * S + 10) continue;
          const open = Math.sin(T * 22 + b.hx) > 0;
          c.fillStyle = '#2a2230'; c.fillRect(x, y - 1, 1, 4);
          c.fillStyle = b.col;
          if (open) { c.fillRect(x - 3, y - 2, 3, 3); c.fillRect(x + 1, y - 2, 3, 3); c.fillRect(x - 2, y + 1, 2, 2); c.fillRect(x + 1, y + 1, 2, 2); }
          else { c.fillRect(x - 1, y - 3, 1, 3); c.fillRect(x + 1, y - 3, 1, 3); }
        }
        for (const m of this.moths) {
          const x = Math.round((m.cx + Math.cos(m.a) * m.r - cam.x) * S), y = Math.round((m.cy + Math.sin(m.a * 1.3) * m.r * 0.6 - cam.y) * S);
          c.fillStyle = '#f3ead2'; c.fillRect(x, y, 2, 1); if (Math.sin(T * 30 + m.r) > 0) c.fillRect(x, y - 1, 1, 1);
        }
      });
    }

    drawCat(c, cam, S) {
      const cat = this.cat, T = this.t;
      const x = Math.round((cat.x - cam.x) * S), y = Math.round((TS * 38 - cam.y) * S);
      if (x < -30 || x > G.VIEW_W * S + 30) return;
      c.save(); c.translate(x, y); if (cat.dir < 0) c.scale(-1, 1);
      const P = (a, b, w, h, col) => { c.fillStyle = col; c.fillRect(a, b, w, h); };
      const fur = '#3b3a44', furL = '#5c5a68', furD = '#24232b', eye = '#c8e86a';
      const ol = '#121117';
      if (cat.state === 'sit' || cat.state === 'lick') {
        // sentado, rabo enrolado; lambendo a pata de vez em quando
        P(-6, -13, 10, 13, ol); P(-5, -12, 8, 12, fur); P(-4, -11, 3, 6, furL);
        P(1, -19, 9, 8, ol); P(2, -18, 7, 6, fur); P(2, -20, 2, 3, ol); P(7, -20, 2, 3, ol); P(3, -18, 1, 1, furL);
        P(6, -16, 1, 1, eye); P(3, -16, 1, 1, eye);
        P(-11, -3, 7, 3, ol); P(-10, -2, 6, 1, fur);
        if (cat.state === 'lick' && Math.sin(T * 6) > 0) { P(5, -13, 3, 3, ol); P(6, -12, 1, 1, '#e88a9a'); }
      } else {
        // andando: 4 quadros de patas
        const f = Math.floor(T * (cat.state === 'run' ? 16 : 8)) % 4;
        const legs = [[0, 1, 1, 0], [1, 0, 0, 1], [0, 1, 1, 0], [1, 0, 0, 1]][f];
        P(-9, -11, 18, 7, ol); P(-8, -10, 16, 5, fur); P(-7, -10, 10, 1, furL); P(-8, -6, 16, 1, furD);
        for (let i = 0; i < 4; i++) { const lx = [-7, -4, 3, 6][i]; P(lx, -5, 3, 5 - legs[i], ol); P(lx + 1, -5, 1, 4 - legs[i], fur); }
        P(7, -16, 9, 8, ol); P(8, -15, 7, 6, fur); P(8, -17, 2, 3, ol); P(13, -17, 2, 3, ol); P(9, -15, 2, 1, furL);
        P(13, -13, 1, 1, eye); P(15, -12, 1, 1, '#e88a9a');
        const tl = Math.round(Math.sin(T * 4) * 2);
        P(-13, -15 + tl, 3, 6, ol); P(-12, -14 + tl, 1, 5, fur); P(-10, -11, 2, 2, ol);
      }
      c.restore();
    }
  }

  G.Ambient = Ambient;
  G.AmbientArt = { tree, bush, foliage };
})(window.VG = window.VG || {});

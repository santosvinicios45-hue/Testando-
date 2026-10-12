/* =====================================================================
 * Ferramentas de pixel art da grade fina (G.HI pixels por unidade do
 * mundo; um bloco tem 32×32 px). Usadas por toda a arte em js/art/*.
 *
 * Regras de estilo (valem para todo o jogo):
 * - luz vem de cima à esquerda; sombras puxam para roxo/azul frio e
 *   luzes para creme quente (Pix.tones faz a rampa de 5 tons);
 * - objetos e móveis têm contorno colorido de 1 px (versão bem escura
 *   do próprio material, nunca preto puro) — Pix.sprite faz sozinho;
 * - textura em grupinhos de 2–4 px (veio de madeira, tijolo, folhas),
 *   nada de chuvisco aleatório pixel a pixel;
 * - sempre coordenadas inteiras: nada de antisserrilhado.
 * ===================================================================== */
(function (G) {
  'use strict';

  const rgbCache = new Map();
  function rgb(hex) {
    let v = rgbCache.get(hex);
    if (v) return v;
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
    v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    rgbCache.set(hex, v);
    return v;
  }
  const toHex = (a) => '#' + a.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, k) => { const x = rgb(a), y = rgb(b); return toHex([x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k]); };
  const dark = (hex, k) => mix(hex, '#1a1230', k === undefined ? 0.28 : k);
  const light = (hex, k) => mix(hex, '#fff4dc', k === undefined ? 0.2 : k);
  const rgba = (hex, a) => { const [r, g, b] = rgb(hex); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; };
  /** Rampa de tons de um material: o (contorno), d2, d, b (base), l, h (brilho). */
  const tones = (hex) => ({ o: dark(hex, 0.68), d2: dark(hex, 0.45), d: dark(hex, 0.24), b: hex, l: light(hex, 0.2), h: light(hex, 0.45) });
  const hash = (a, b, c) => G.util.hash(a, b, c || 0);

  /** Pintor de pixels sobre um contexto 2D (coordenadas inteiras). */
  class Painter {
    constructor(c) { this.c = c; }
    rect(x, y, w, h, col) { if (w <= 0 || h <= 0) return this; this.c.fillStyle = col; this.c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); return this; }
    px(x, y, col) { return this.rect(x, y, 1, 1, col); }
    hline(x, y, w, col) { return this.rect(x, y, w, 1, col); }
    vline(x, y, h, col) { return this.rect(x, y, 1, h, col); }
    /** Linha de Bresenham. */
    line(x0, y0, x1, y1, col) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let e = dx + dy;
      this.c.fillStyle = col;
      for (;;) { this.c.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
      return this;
    }
    /** Elipse cheia, nítida. */
    ellipse(cx, cy, rx, ry, col) {
      this.c.fillStyle = col;
      for (let y = Math.floor(-ry); y <= Math.ceil(ry); y++) {
        const k = 1 - ((y + 0.5) * (y + 0.5)) / (ry * ry);
        if (k <= 0) continue;
        const w = Math.round(rx * Math.sqrt(k));
        this.c.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
      }
      return this;
    }
    /** Elipse sombreada em 4 tons (luz de cima à esquerda). */
    ball(cx, cy, rx, ry, hex) {
      const T = tones(hex);
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, d = u * u + v * v;
        if (d > 1) continue;
        const lit = -u * 0.6 - v * 0.8;
        const col = lit > 0.55 ? T.h : lit > 0.15 ? T.l : lit > -0.35 ? T.b : lit > -0.7 ? T.d : T.d2;
        this.px(x, y, col);
      }
      return this;
    }
    /** Polígono cheio (par-ímpar). */
    poly(pts, col) {
      let y0 = Infinity, y1 = -Infinity;
      for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      this.c.fillStyle = col;
      for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
        const sy = y + 0.5, xs = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy)) xs.push(a[0] + (sy - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
        xs.sort((p, q) => p - q);
        for (let k = 0; k + 1 < xs.length; k += 2) { const xa = Math.round(xs[k]), xb = Math.round(xs[k + 1]); if (xb > xa) this.c.fillRect(xa, y, xb - xa, 1); }
      }
      return this;
    }
    /**
     * Bloco com volume: base, luz no topo e à esquerda, sombra embaixo e à direita.
     * o.bevel = espessura (px), o.top = cor da face de cima (opcional).
     */
    box(x, y, w, h, hex, o) {
      o = o || {};
      const T = tones(hex), b = o.bevel || 1;
      this.rect(x, y, w, h, T.b);
      this.rect(x, y, w, b, T.l); this.rect(x, y, b, h, T.l);
      this.rect(x, y + h - b, w, b, T.d); this.rect(x + w - b, y, b, h, T.d);
      if (o.shine) this.px(x + b, y + b, T.h);
      return this;
    }
    /** Faixa vertical em bandas (degradê de pixel art). */
    bands(x, y, w, h, top, bottom, n) {
      n = n || 4;
      for (let i = 0; i < n; i++) { const y0 = Math.round(y + h * i / n), y1 = Math.round(y + h * (i + 1) / n); this.rect(x, y0, w, y1 - y0, mix(top, bottom, i / Math.max(1, n - 1))); }
      return this;
    }
    /** Pontilhado ordenado (xadrez) com densidade 0..1. */
    dither(x, y, w, h, col, density) {
      const M = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
      this.c.fillStyle = col;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (M[((y + j) & 3) * 4 + ((x + i) & 3)] / 16 < density) this.c.fillRect(x + i, y + j, 1, 1);
      return this;
    }
    /** Textura em grupinhos: n manchas de tamanho ~s em posições fixas pela semente. */
    clusters(x, y, w, h, col, n, s, seed) {
      for (let i = 0; i < n; i++) {
        const cx = x + Math.floor(hash(i, seed, 1) * w), cy = y + Math.floor(hash(i, seed, 2) * h);
        const ww = 1 + Math.floor(hash(i, seed, 3) * s), hh = 1 + Math.floor(hash(i, seed, 4) * Math.max(1, s - 1));
        this.rect(cx, cy, Math.min(ww, x + w - cx), Math.min(hh, y + h - cy), col);
      }
      return this;
    }
  }

  /** Contorno colorido de 1 px em volta de tudo que não é transparente. */
  function outline(cv, strength) {
    const k = strength === undefined ? 1 : strength;
    const cx = cv.getContext('2d'), W = cv.width, H = cv.height;
    const img = cx.getImageData(0, 0, W, H), d = img.data, src = new Uint8ClampedArray(d);
    const A = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : src[(y * W + x) * 4 + 3] > 40;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (src[i + 3] > 40) continue;
      let n = -1;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (A(x + ox, y + oy)) { n = ((y + oy) * W + x + ox) * 4; break; }
      if (n < 0) continue;
      d[i] = src[n] * 0.22 + 16; d[i + 1] = src[n + 1] * 0.17 + 10; d[i + 2] = src[n + 2] * 0.24 + 22; d[i + 3] = Math.round(240 * k);
    }
    cx.putImageData(img, 0, 0);
    return cv;
  }

  const cache = new Map();
  /**
   * Sprite em cache: canvas w×h pintado por fn(p, c) (p = Painter). Recebe contorno automático
   * (a menos que o.outline === false). Deixe 1 px de margem livre para o contorno.
   */
  function sprite(key, w, h, fn, o) {
    let cv = cache.get(key);
    if (cv) return cv;
    cv = document.createElement('canvas'); cv.width = Math.max(1, Math.ceil(w)); cv.height = Math.max(1, Math.ceil(h));
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    fn(new Painter(c), c);
    if (!o || o.outline !== false) outline(cv, o && o.outlineAlpha);
    if (cache.size > 3000) cache.clear();
    cache.set(key, cv);
    return cv;
  }
  const painter = (c) => new Painter(c);

  G.Pix = { rgb, mix, dark, light, rgba, tones, hash, Painter, painter, sprite, outline, cache };
})(window.VG = window.VG || {});

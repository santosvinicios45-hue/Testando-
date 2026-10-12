/* =====================================================================
 * Personagens em pixel art de alta resolução (o dobro de pixels do
 * mundo: uma pessoa tem ~64 px de altura), montados sobre um esqueleto.
 *
 * - Quadril, joelhos e tornozelos: as pernas são resolvidas por
 *   cinemática inversa (2 ossos), então nunca se soltam do corpo e os
 *   pés ficam plantados no chão durante a passada.
 * - Ombros, cotovelos e mãos: cinemática direta com ângulos por quadro.
 * - Cada parte é rasterizada pixel a pixel num buffer próprio (sem
 *   antisserrilhado), com 4 tons de sombreamento (luz vindo de cima à
 *   esquerda), traço interno nos membros e contorno colorido no fim.
 * - Rosto e cabelos são mapas de pixels desenhados à mão.
 * - Quadros ficam em cache; só a pose muda com o tempo.
 *
 * Coordenadas do buffer (personagem virado para a direita): pés no
 * ponto (AX, AY); y cresce para baixo.
 * ===================================================================== */
(function (G) {
  'use strict';

  const K = (G.HI || 3) / 2;                 // o esqueleto foi medido na grade 2×; escala para a grade atual
  const BW = Math.round(64 * K), BH = Math.round(104 * K), AX = Math.round(30 * K), AY = Math.round(84 * K);
  const cache = new Map();

  /* ---------------- cores ---------------- */
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
  const mix = (hex, to, k) => { const a = rgb(hex), b = rgb(to); return toHex([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]); };
  // sombras puxam para um roxo frio, luzes para um creme quente
  const dark = (hex, k) => mix(hex, '#1a1230', k === undefined ? 0.28 : k);
  const light = (hex, k) => mix(hex, '#fff4dc', k === undefined ? 0.2 : k);
  const c32 = (hex) => { const [r, g, b] = rgb(hex); return (255 << 24 | b << 16 | g << 8 | r) >>> 0; };
  /** 4 tons de um material: [traço, sombra, base, luz] já em 32 bits. */
  function tones(hex, k) {
    k = k || 0;
    const base = k ? dark(hex, k) : hex;
    return [c32(dark(base, 0.62)), c32(dark(base, 0.3)), c32(base), c32(light(base, 0.22))];
  }

  /* ---------------- buffer e rasterização ---------------- */
  class Buf {
    constructor(w, h) { this.w = w; this.h = h; this.px = new Uint32Array(w * h); }
    set(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c; }
    get(x, y) { return (x >= 0 && y >= 0 && x < this.w && y < this.h) ? this.px[y * this.w + x] : 0; }
  }
  const LX = -0.55, LY = -0.83;   // direção de onde vem a luz

  /** Cápsula (membro) de a até b, raio r0 → r1, com sombreamento e traço interno opcional. */
  function capsule(B, ax, ay, bx, by, r0, r1, T, edge) {
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-6, L = Math.sqrt(L2);
    const nx = -dy / L, ny = dx / L;
    const R = Math.max(r0, r1) + 1;
    const x0 = Math.floor(Math.min(ax, bx) - R), x1 = Math.ceil(Math.max(ax, bx) + R);
    const y0 = Math.floor(Math.min(ay, by) - R), y1 = Math.ceil(Math.max(ay, by) + R);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax, py = y + 0.5 - ay;
      let t = (px * dx + py * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = px - dx * t, qy = py - dy * t;
      const d = Math.sqrt(qx * qx + qy * qy), r = r0 + (r1 - r0) * t;
      if (d > r) continue;
      const s = (qx * nx + qy * ny) / (r || 1);          // −1..1 através do membro
      const lit = (nx * s) * LX + (ny * s) * LY;
      let c = lit > 0.42 ? 3 : lit < -0.38 ? 1 : 2;
      if (edge && d > r - 1) c = 0;
      B.set(x, y, T[c]);
    }
  }
  /**
   * Membro inteiro (várias cápsulas unidas, ex.: coxa + canela): o sombreamento vem do segmento
   * mais próximo e o traço só aparece na borda da união, então as juntas ficam limpas.
   */
  function limb(B, segs, T, edge) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of segs) {
      const R = Math.max(s[4], s[5]) + 1;
      x0 = Math.min(x0, s[0] - R, s[2] - R); x1 = Math.max(x1, s[0] + R, s[2] + R);
      y0 = Math.min(y0, s[1] - R, s[3] - R); y1 = Math.max(y1, s[1] + R, s[3] + R);
    }
    x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.ceil(x1); y1 = Math.ceil(y1);
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const tone = new Int8Array(w * h).fill(-1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let best = Infinity, bt = -1;
      for (const sg of segs) {
        const [ax, ay, bx, by, r0, r1] = sg;
        const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-6, L = Math.sqrt(L2);
        const px = x + 0.5 - ax, py = y + 0.5 - ay;
        let t = (px * dx + py * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = px - dx * t, qy = py - dy * t, d = Math.sqrt(qx * qx + qy * qy), r = r0 + (r1 - r0) * t;
        if (d > r || d / r >= best) continue;
        best = d / r;
        const nx = -dy / L, ny = dx / L, sgn = (qx * nx + qy * ny) / (r || 1);
        const lit = nx * sgn * LX + ny * sgn * LY;
        bt = lit > 0.42 ? 3 : lit < -0.38 ? 1 : 2;
      }
      if (bt >= 0) tone[(y - y0) * w + (x - x0)] = bt;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let t = tone[y * w + x];
      if (t < 0) continue;
      if (edge && (x === 0 || y === 0 || x === w - 1 || y === h - 1 || tone[y * w + x - 1] < 0 || tone[y * w + x + 1] < 0 || tone[(y - 1) * w + x] < 0 || tone[(y + 1) * w + x] < 0)) t = 0;
      B.set(x + x0, y + y0, T[t]);
    }
  }

  /** Elipse sombreada. */
  function ellipse(B, cx, cy, rx, ry, T, edge) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, d = u * u + v * v;
      if (d > 1) continue;
      const lit = u * LX + v * LY;
      let c = lit > 0.45 ? 3 : lit < -0.35 ? 1 : 2;
      if (edge && d > 0.72) c = 0;
      B.set(x, y, T[c]);
    }
  }
  /**
   * Polígono preenchido por linhas (par-ímpar). shade(x, y, u, v) devolve o tom (0..3) ou −1 para pular;
   * u = posição horizontal na linha (0 = esquerda), v = posição vertical no polígono (0 = topo).
   */
  function poly(B, pts, T, shade) {
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    const y0 = Math.floor(minY), y1 = Math.ceil(maxY);
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy)) xs.push(a[0] + (sy - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.round(xs[k]), xb = Math.round(xs[k + 1]) - 1;
        for (let x = xa; x <= xb; x++) {
          const u = xb > xa ? (x - xa) / (xb - xa) : 0.5, v = (y - y0) / Math.max(1, y1 - y0);
          const c = shade ? shade(x, y, u, v) : 2;
          if (c >= 0) B.set(x, y, T[c]);
        }
      }
    }
  }
  /** Mapa de pixels desenhado à mão: cada letra é uma cor da paleta; '.' é vazio. */
  function stamp(B, rows, ox, oy, pal, flow) {
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const shift = flow ? Math.round(flow * Math.max(0, 1 - r / (rows.length * 0.6))) : 0;
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.' || ch === ' ') continue;
        const col = pal[ch];
        if (col !== undefined) B.set(ox + i + shift, oy + r, col);
      }
    }
  }
  /** Contorno colorido de 1 px em volta da silhueta. */
  function outline(B) {
    const src = B.px.slice(), W = B.w, H = B.h;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (src[y * W + x]) continue;
      let n = 0;
      if (x + 1 < W && src[y * W + x + 1]) n = src[y * W + x + 1];
      else if (x > 0 && src[y * W + x - 1]) n = src[y * W + x - 1];
      else if (y + 1 < H && src[(y + 1) * W + x]) n = src[(y + 1) * W + x];
      else if (y > 0 && src[(y - 1) * W + x]) n = src[(y - 1) * W + x];
      if (!n) continue;
      const r = n & 255, g = (n >> 8) & 255, b = (n >> 16) & 255;
      B.px[y * W + x] = (255 << 24 | Math.round(b * 0.22 + 22) << 16 | Math.round(g * 0.16 + 10) << 8 | Math.round(r * 0.2 + 16)) >>> 0;
    }
  }
  function toCanvas(B, flip) {
    const cv = document.createElement('canvas');
    cv.width = B.w; cv.height = B.h;
    const cx = cv.getContext('2d');
    const img = cx.createImageData(B.w, B.h);
    const out = new Uint32Array(img.data.buffer);
    if (!flip) out.set(B.px);
    else for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) out[y * B.w + x] = B.px[y * B.w + (B.w - 1 - x)];
    cx.putImageData(img, 0, 0);
    return cv;
  }

  /* ---------------- mapas desenhados à mão (virado para a direita) ---------------- */
  // rosto 3/4: s pele, d sombra, D sombra forte, l luz, n nariz
  const FACE = [
    '....sssss....',
    '..sssssssss..',
    '.ssssssssssl.',
    '.sssssssssssl',
    '.sssssssssssl',
    '.sssssssssssl',
    'ddssssssssssl',
    'dDdsssssssssl',
    'dDdssssssssss',
    '.ddssssssssssn',
    '..dsssssssssd',
    '..dssssssssd.',
    '..ddssssssd..',
    '...ddsssdd...',
    '.....ddd.....',
  ];
  // cabelos: h base, H luz, k sombra (origem: 3 px à esquerda e 6 px acima do rosto)
  const HAIR = {
    spiky: [
      '........h....h.....',
      '...h...hh...hh..h..',
      '..hh..hhhh.hhh.hh..',
      '.hhhhhhhHhhhhhhhh.h',
      'hhhhhhhHHhhhHhhhhh.',
      '.hhhhhHhhhhHhhhhhhh',
      'hhhhhhhhhhhhhhhhhhh',
      'hhhhhhhhhhhhhhhhhh.',
      'hhhhkhhhkhhhhhhhhh.',
      'hhhhk.hhhhh.hhh.hh.',
      'hhhk....h.....h....',
      '.hhk...............',
      '.hk................',
      '.k.................',
    ],
    short: [
      '...................',
      '...................',
      '...................',
      '......hhhhhhh......',
      '....hhhHHHhhhhh....',
      '...hhhHhhhhhhhhh...',
      '..hhhhhhhhhhhhhhh..',
      '..hhhhhhhhhhhhhhh..',
      '.hhhhhkhhhhhhhhh...',
      '.hhhhk.....hhh.....',
      '.hhhk..............',
      '.hhk...............',
      '..k................',
    ],
    long: [
      '...................',
      '...................',
      '...................',
      '......hhhhhhh......',
      '....hhhHHHhhhhh....',
      '...hhhHhhhhhhhhh...',
      '..hhhhhhhhhhhhhhh..',
      '.hhhhhhhhhhhhhhhhh.',
      '.hhhhhhkhhhhhhhhhh.',
      'hhhhhk......hhhhhh.',
      'hhhhk...........hh.',
      'hhhhk...........h..',
      'hhhhk..............',
      'hhhhk..............',
      'hhhhk..............',
      'hhhhk..............',
      'hhhk...............',
      'hhhk...............',
      '.hk................',
      '.k.................',
    ],
    bun: [
      '.hhh...............',
      'hhHhh..............',
      'hhhhh..............',
      'hhhhhhhhhhhhh......',
      '.hhhhhHHHhhhhh.....',
      '..hhhHhhhhhhhhhh...',
      '..hhhhhhhhhhhhhhh..',
      '..hhhhhhhhhhhhhhh..',
      '.hhhhhkhhhhhhhhhh..',
      '.hhhhk.......hhh...',
      '.hhhk..............',
      '..hk...............',
    ],
    bald: [
      '...................', '...................', '...................', '...................',
      '...................', '...................', '...................', '...................',
      '.hhh...............', '.hhh...............', '.hhk...............', '..k................',
    ],
  };

  /* ---------------- proporções ---------------- */
  function rigDims(o, unscaled) {
    const k = o.kid ? 0.6 : 1, s = unscaled ? 1 : K;
    return {
      k, foot: 3 * s, thigh: 13.5 * k * s, shin: 13 * k * s, torso: (20 * k + (o.kid ? 1 : 0)) * s,
      upper: (11 * k + (o.kid ? 1 : 0)) * s, fore: (10 * k + (o.kid ? 1 : 0)) * s, neck: 2 * s,
      hipY: -(3 + 26.5 * k) * s, legR: (o.kid ? 2.4 : 3.4) * s, armR: (o.kid ? 2 : 2.6) * s,
    };
  }

  /* ---------------- poses (esqueleto por quadro) ---------------- */
  const FRAMES = { walk: 12, run: 10, idle: 4, fly: 6, fall: 4, stun: 4, sweep: 4, wave: 4 };
  function frameIndex(o) {
    const st = o.state || 'idle', t = o.t || 0;
    if (st === 'walk' && o.run) return ['run', Math.floor(t * 15) % FRAMES.run];
    if (st === 'walk') return ['walk', Math.floor(t * 18.5) % FRAMES.walk];
    if (st === 'idle') return [o.gesture ? 'wave' : 'idle', o.gesture ? Math.floor(t * 8) % 4 : Math.floor(t * 2.4 + (o.seed || 0)) % FRAMES.idle];
    if (st === 'fly') return ['fly', Math.floor(t * 9) % FRAMES.fly];
    if (st === 'fall') return ['fall', Math.floor(t * 10) % FRAMES.fall];
    if (st === 'stun') return ['stun', Math.floor(t * 7) % FRAMES.stun];
    if (st === 'sweep') return ['sweep', Math.floor(t * 9) % FRAMES.sweep];
    return [st, 0];
  }

  /** Pé numa fase do ciclo de passada: posição relativa (x, levantamento) e ângulo do pé. */
  function stepFoot(p, stride, lift, duty) {
    if (p < duty) {
      const s = p / duty;
      let up = 0, ang = 0;
      if (s > 0.78) { const k = (s - 0.78) / 0.22; up = k * 2; ang = k * 0.55; }   // calcanhar sai do chão
      return { x: stride / 2 - stride * s, up, ang };
    }
    const s = (p - duty) / (1 - duty), e = (1 - Math.cos(Math.PI * s)) / 2;
    return { x: -stride / 2 + stride * e, up: 2 + lift * Math.sin(Math.PI * s), ang: 0.55 * (1 - s) * (1 - s) - 0.2 * s * s };
  }

  function makePose(o, kind, f) {
    const P = makePoseBase(o, kind, f);
    // medidas da pose estão na grade 2×: escala para a grade atual
    P.hipX *= K; P.hipY *= K; P.headDY = Math.round(P.headDY * K); P.chest = Math.round(P.chest * K);
    for (const L of P.legs) { L.x *= K; L.up *= K; }
    return P;
  }
  function makePoseBase(o, kind, f) {
    const D = rigDims(o, true);
    const P = {
      hipX: 0, hipY: D.hipY, lean: 0, headDY: 0, chest: 0,
      legs: [{ x: -3, up: 0, ang: 0 }, { x: 3, up: 0, ang: 0 }],   // [trás, frente]
      arms: [{ u: -0.08, f: 0.18 }, { u: 0.08, f: 0.2 }],
      eyes: 'open', hairFlow: 0, mouth: 0, blink: false, legMode: 'ik',
    };
    const pocket = o.hoodie && !o.kid;
    if (kind === 'walk' || kind === 'run') {
      const run = kind === 'run', N = FRAMES[kind];
      const ph = f / N;
      const stride = (run ? 30 : 17) * D.k, lift = (run ? 9 : 4) * D.k, duty = run ? 0.4 : 0.6;
      const a = stepFoot(ph, stride, lift, duty), b = stepFoot((ph + 0.5) % 1, stride, lift, duty);
      P.legs = [{ x: b.x - 1, up: b.up, ang: b.ang }, { x: a.x + 1, up: a.up, ang: a.ang }];
      P.hipY = D.hipY + (run ? 2.2 : 1.1) + (run ? 1.6 : 0.9) * Math.cos(ph * Math.PI * 4);
      P.lean = run ? 0.2 : 0.04;
      const sw = (x) => -x / (stride / 2);
      P.arms = run
        ? [{ u: -0.85 * sw(b.x) * 0.9, f: 1.5 }, { u: -0.85 * sw(a.x) * 0.9, f: 1.5 }]
        : [{ u: 0.42 * sw(a.x) - 0.02, f: 0.2 + 0.25 * Math.max(0, 0.42 * sw(a.x)) }, { u: 0.42 * sw(b.x) + 0.02, f: 0.22 + 0.3 * Math.max(0, 0.42 * sw(b.x)) }];
      P.hairFlow = run ? -1 : 0; P.mouth = run ? 1 : 0;
      P.chest = Math.round(Math.cos(ph * Math.PI * 4) * 0.5);
    } else if (kind === 'idle') {
      P.chest = f >= 2 ? 1 : 0; P.headDY = f >= 2 ? 1 : 0;
      if (pocket) P.arms = [{ mode: 'pocket' }, { mode: 'pocket' }];
    } else if (kind === 'wave') {
      P.arms = [{ u: -0.05, f: 0.15 }, { u: 2.6, f: 0.35 + [0, 0.35, 0.6, 0.35][f] }]; P.mouth = 1;
    } else if (kind === 'jump') {
      P.legs = [{ x: -6, up: 7, ang: 0.6 }, { x: 5, up: 11, ang: 0.3 }];
      P.arms = [{ u: -0.9, f: 0.3 }, { u: 2.5, f: 0.3 }];
      P.hairFlow = 1; P.eyes = 'happy'; P.mouth = 2;
    } else if (kind === 'fall') {
      P.legs = [{ x: -5, up: 3, ang: 0.4 }, { x: 5, up: 5, ang: 0.2 }];
      P.arms = f % 2 ? [{ u: 2.1, f: 0.3 }, { u: 1.7, f: 0.4 }] : [{ u: 1.8, f: 0.4 }, { u: 2.3, f: 0.25 }];
      P.hairFlow = -1;
    } else if (kind === 'fly') {
      const w = Math.sin(f / FRAMES.fly * Math.PI * 2);
      P.lean = 0.32; P.hipY = D.hipY - 1 + Math.round(w);
      P.legs = [{ x: -13, up: 9 + w, ang: 1.0 }, { x: -9, up: 5 - w, ang: 0.9 }];
      P.arms = [{ u: -0.7, f: 0.2 }, { u: 2.2, f: 0.05 }];
      P.hairFlow = -2 + (f % 2 ? 0 : -1); P.mouth = 1;
    } else if (kind === 'sit') {
      P.legMode = 'sit'; P.hipY = -3;
      P.arms = pocket ? [{ mode: 'pocket' }, { mode: 'pocket' }] : [{ u: 0.3, f: 0.9 }, { u: 0.45, f: 0.95 }];
    } else if (kind === 'sitFloor') {
      P.legMode = 'sitFloor'; P.hipY = -3; P.lean = -0.25;
      P.arms = [{ u: -0.55, f: 0 }, { u: 0.7, f: 0.6 }];
    } else if (kind === 'rise') {
      P.hipY = D.hipY + 10; P.lean = 0.35;
      P.legs = [{ x: -2, up: 0, ang: 0 }, { x: 4, up: 0, ang: 0 }];
      P.arms = [{ u: 0.6, f: 0.5 }, { u: 0.8, f: 0.6 }];
    } else if (kind === 'stun') {
      P.lean = [0.12, 0, -0.12, 0][f]; P.eyes = 'dizzy';
      P.arms = [{ u: 0.25, f: 0.1 }, { u: -0.2 + 0.1 * f, f: 0.1 }];
    } else if (kind === 'sweep') {
      P.lean = 0.25; P.legs = [{ x: -5, up: 0, ang: 0 }, { x: 5, up: 0, ang: 0 }];
      const k = [0, 0.15, 0.3, 0.15][f];
      P.arms = [{ u: 0.75 + k, f: 0.55 }, { u: 0.95 + k, f: 0.5 }];
    }
    if (o.carrying && kind !== 'sweep') P.arms[1] = { u: 0.95, f: 0.75 };
    if (o.handOnBag) P.arms[1] = { u: 0.2, f: 1.0 };
    if (o.aim) { P.arms[1] = { mode: 'none' }; if (P.arms[0].mode === 'pocket') P.arms[0] = { u: -0.05, f: 0.15 }; }
    if (P.arms[0].mode === 'pocket' && P.arms[1].mode !== 'pocket') P.arms[0] = { u: -0.05, f: 0.15 };
    const t = o.t || 0;
    if (o.blink || (P.eyes === 'open' && Math.sin(t * 0.9 + (o.seed || 0) * 1.7) > 0.985)) P.eyes = 'closed';
    return P;
  }

  /* ---------------- cabeça (rosto e cabelo desenhados por partes) ---------------- */
  /** Mancha elíptica: fn(x, y, nx, ny) devolve a cor (32 bits) ou 0 para pular; nx/ny = posição normalizada. */
  function blob(B, cx, cy, rx, ry, fn) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const c = fn(x, y, nx, ny);
      if (c) B.set(x, y, c);
    }
  }
  /** Mecha de cabelo: triângulo da base até a ponta, com lado escuro e fio de brilho. */
  function spike(B, ox, oy, u, sp, flow, T) {
    const [bx, by, tx0, ty, w] = sp;
    const tx = tx0 + flow;
    const dx = tx - bx, dy = ty - by, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const pts = [[ox + (bx + nx * w) * u, oy + (by + ny * w) * u], [ox + tx * u, oy + ty * u], [ox + (bx - nx * w) * u, oy + (by - ny * w) * u]];
    poly(B, pts, T, (x, y, uu, v) => (uu < 0.14 ? 0 : uu < 0.38 ? 1 : (uu > 0.6 && uu < 0.74 && v > 0.15 && v < 0.75) ? 3 : 2));
  }
  const SPIKES = {
    spiky: {
      top: [[3, 4, -5, 0, 4], [5, 1, -2, -7, 4.2], [9, 0, 6, -9, 4.4], [13, 0, 14, -8, 4], [16.5, 2, 21.5, -3, 3.6], [2.5, 8, -4, 10, 3.2]],
      fringe: [[8, 4, 8.5, 10, 2.8], [11, 4, 12, 11, 3], [14, 4, 16, 10.5, 3], [17, 4, 20, 8.5, 2.6]],
      mass: [9.5, 4.5, 10.5, 7],
    },
    short: {
      top: [[5, 0, 3, -4, 3], [10, -1, 10, -5, 3.2], [14.5, 0, 17, -3, 3], [2, 5, -2, 6, 2.5]],
      fringe: [[11, 3, 12, 6.5, 2.4], [14.5, 3, 16.5, 6.5, 2.2]],
      mass: [9.5, 4.5, 10, 5.5],
    },
    long: { top: [[6, 0, 5, -3, 3], [12, -1, 13, -3, 3]], fringe: [[12, 3, 13, 7, 3], [16, 3, 18, 7, 2.4]], mass: [9.5, 4.5, 10.5, 6] },
    bun: { top: [], fringe: [[13, 3, 14, 6, 2.6], [16, 3, 18, 6, 2.2]], mass: [9.5, 4.5, 10, 5.5] },
  };
  function drawHead(B, o, P, pal, hx, hy, skinT, hairT, style, backOnly) {
    const u = K / 1.5;
    const at = (x, y) => [Math.round(hx + x * u), Math.round(hy + y * u)];
    const put = (x, y, col) => { const [a, b] = at(x, y); B.set(a, b, col); };
    const flow = (P.hairFlow || 0) * 2;
    if (backOnly) {
      // cabelo comprido: cortina atrás dos ombros (desenhada antes do corpo)
      poly(B, [at(-1, 3), at(9, 3), at(10, 30), at(5, 33), at(-3, 30)], hairT, (x, y, uu) => (uu < 0.25 ? 0 : uu < 0.5 ? 1 : 2));
      return;
    }
    // rosto: crânio + mandíbula, iluminado de frente
    const skinShade = (x, y, nx, ny) => { const l = nx * 0.55 - ny * 0.5; return l > 0.42 ? skinT[3] : l < -0.5 ? skinT[1] : skinT[2]; };
    blob(B, hx + 10 * u, hy + 9 * u, 9.5 * u, 9.5 * u, skinShade);
    poly(B, [at(2.5, 9), at(19.5, 9), at(19.8, 13), at(17.5, 17), at(13.5, 20), at(10, 20.4), at(6, 18.5), at(3, 14)], skinT, (x, y, uu, v) => (uu < 0.22 ? 1 : (v > 0.82 && uu < 0.8) ? 1 : uu > 0.8 && v < 0.4 ? 3 : 2));
    // cabelo: massa, mechas de cima e de trás
    const S = SPIKES[style];
    const hairShade = (x, y, nx, ny) => (ny > 0.4 || nx < -0.6 ? hairT[1] : hairT[2]);
    if (S) {
      const [mx, my, rx, ry] = S.mass;
      blob(B, hx + mx * u, hy + my * u, rx * u, ry * u, (x, y, nx, ny) => ((y - hy) / u <= 7.5 || (x - hx) / u <= 5.5) ? hairShade(x, y, nx, ny) : 0);
      blob(B, hx + 4 * u, hy + 8 * u, 5 * u, 5.5 * u, (x, y, nx, ny) => ((x - hx) / u <= 5.5 && (y - hy) / u <= 11) ? hairShade(x, y, nx, ny) : 0);
      for (const sp of S.top) spike(B, hx, hy, u, sp, flow * (sp[3] < 0 ? 1 : 0.5), hairT);
    } else if (style === 'bald') {
      blob(B, hx + 4 * u, hy + 10 * u, 3 * u, 3.5 * u, hairShade);
    }
    if (style === 'bun') blob(B, hx + 2 * u, hy - 1 * u, 4.5 * u, 4.5 * u, hairShade);
    // orelha
    blob(B, hx + 4.5 * u, hy + 11.5 * u, 2.2 * u, 3 * u, () => skinT[1]);
    put(4, 11, skinT[0]); put(4, 12, skinT[0]); put(5, 10, skinT[2]);
    // olhos
    const lash = c32('#1a1218'), white = c32('#f6f2ea'), iris = c32(mix(pal.eye || '#3a2414', '#6b4423', 0.45)), pupil = c32('#120c10'), hl = c32('#ffffff');
    const eyes = P.eyes;
    if (eyes === 'closed') {
      for (let x = 8; x <= 10; x++) put(x, 12, lash); for (let x = 13; x <= 16; x++) put(x, 12, lash); put(17, 11, lash);
    } else if (eyes === 'happy') {
      put(8, 12, lash); put(9, 11, lash); put(10, 12, lash); put(13, 12, lash); put(14, 11, lash); put(15, 11, lash); put(16, 12, lash);
    } else if (eyes === 'dizzy') {
      for (const ex of [8, 13]) { put(ex, 10, lash); put(ex + 2, 10, lash); put(ex + 1, 11, lash); put(ex, 12, lash); put(ex + 2, 12, lash); }
    } else {
      for (let x = 8; x <= 10; x++) put(x, 10, lash);
      for (let x = 13; x <= 16; x++) put(x, 10, lash); put(17, 11, lash);
      put(8, 11, white); put(9, 11, iris); put(10, 11, pupil); put(10, 10, lash);
      put(8, 12, skinT[1]); put(9, 12, iris); put(10, 12, iris);
      put(13, 11, white); put(14, 11, iris); put(15, 11, pupil); put(16, 11, white);
      put(13, 12, white); put(14, 12, iris); put(15, 12, iris); put(16, 12, skinT[1]);
      put(14, 11, hl);                                                    // brilho no olho
      put(14, 13, skinT[1]); put(15, 13, skinT[1]);                      // pálpebra de baixo
    }
    // sobrancelhas
    if (style !== 'helmet') { const br = hairT[0]; put(8, 8, br); put(9, 8, br); put(10, 8, br); put(13, 8, br); put(14, 8, br); put(15, 7, br); put(16, 7, br); put(14, 7, br); }
    // nariz, bochecha, boca
    put(19, 11, skinT[3]); put(20, 12, skinT[2]); put(20, 13, skinT[1]); put(19, 14, skinT[1]); put(18, 14, skinT[1]);
    put(16, 14, c32(mix(pal.skin, '#e2706a', 0.32))); put(17, 14, c32(mix(pal.skin, '#e2706a', 0.25)));
    const md = skinT[0];
    if (P.mouth === 2) { put(13, 16, md); put(14, 17, md); put(15, 17, md); put(16, 17, md); put(17, 16, md); put(14, 16, white); put(15, 16, white); put(16, 16, white); }
    else if (P.mouth === 1) { put(13, 16, md); put(14, 17, md); put(15, 17, md); put(16, 16, md); }
    else { put(14, 17, skinT[1]); put(15, 17, md); put(16, 17, skinT[1]); }
    put(10, 19, skinT[1]); put(11, 19, skinT[1]);
    if (o.beard) { const bt = tones(o.beard); poly(B, [at(4, 13), at(19, 14), at(18, 18), at(13.5, 21), at(9, 20.5), at(5, 17)], bt, (x, y, uu) => (uu < 0.25 ? 1 : 2)); put(15, 17, bt[0]); }
    if (o.glasses) { const gc = c32('#1c1e26'); for (let x = 7; x <= 18; x++) put(x, 9, gc); for (const gx of [7, 11, 12, 17]) { put(gx, 10, gc); put(gx, 11, gc); put(gx, 12, gc); } }
    // franja por cima da testa
    if (S) for (const sp of S.fringe) spike(B, hx, hy, u, sp, flow * 0.4, hairT);
    if (style === 'helmet') {
      const hc = tones(o.helmet || '#c0392b');
      blob(B, hx + 10 * u, hy + 7 * u, 11.5 * u, 10.5 * u, (x, y, nx, ny) => { const l = -nx * 0.5 - ny * 0.7; return l > 0.4 ? hc[3] : l < -0.4 ? hc[1] : hc[2]; });
      poly(B, [at(13, 6), at(22, 6), at(22.5, 13), at(13, 13)], tones('#252a36'), (x, y, uu, v) => (v < 0.3 && uu > 0.3 ? 3 : 1));
      poly(B, [at(-2, 12), at(6, 12), at(6, 15), at(-2, 15)], hc, () => 1);
    } else if (style === 'cap') {
      const cc = tones(o.cap || '#f1efe8');
      blob(B, hx + 9.5 * u, hy + 3 * u, 10.5 * u, 5.5 * u, (x, y, nx, ny) => (ny > 0.25 ? 0 : (-nx * 0.5 - ny * 0.7 > 0.35 ? cc[3] : cc[2])));
      poly(B, [at(15, 4.5), at(26, 5.5), at(26, 7.5), at(15, 7.5)], cc, (x, y, uu, v) => (v > 0.6 ? 1 : 2));
      for (let x = 0; x <= 19; x++) put(x, 4.5, cc[1]);
    }
  }

  /* ---------------- desenho de um quadro ---------------- */
  function paint(B, o, P) {
    const pal = o.pal || G.PAL_V;
    const D = rigDims(o);
    const style = o.hairStyle || 'short';
    const skinT = tones(pal.skin), skinB = tones(pal.skin, 0.18);
    const topT = tones(pal.shirt), topB = tones(pal.shirt, 0.22);
    const pantT = tones(pal.pants), pantB = tones(pal.pants, 0.25);
    const shoeT = tones(pal.shoe), shoeB = tones(pal.shoe, 0.18);
    const hairT = tones(pal.hair);
    const longSleeve = o.hoodie || o.jacket || o.longSleeve;

    // --- esqueleto ---
    const hip = { x: AX + P.hipX, y: AY + P.hipY };
    const up = { x: Math.sin(P.lean), y: -Math.cos(P.lean) };          // eixo do tronco
    const side = { x: -up.y, y: up.x };                                  // perpendicular (para a frente)
    const along = (a, s) => ({ x: hip.x + up.x * a + side.x * s, y: hip.y + up.y * a + side.y * s });
    const sh = along(D.torso - 2 * K, 0);                    // centro dos ombros
    const shoulders = [{ x: sh.x - 3 * K, y: sh.y + K + P.chest }, { x: sh.x + 3 * K, y: sh.y + K + P.chest }];
    const neckTop = along(D.torso + D.neck, K);
    const hips = [{ x: hip.x - 2 * K, y: hip.y }, { x: hip.x + 2 * K, y: hip.y }];

    // --- pernas ---
    const legData = [];
    for (let i = 0; i < 2; i++) {
      const H = hips[i];
      let ankle, knee, ang;
      if (P.legMode === 'sit') {
        knee = { x: H.x + D.thigh - K, y: H.y - K + i * K };
        ankle = { x: knee.x + K - i * 2 * K, y: knee.y + D.shin };
        ang = 0;
      } else if (P.legMode === 'sitFloor') {
        knee = { x: H.x + (10 - i * 2) * K, y: H.y + (-7 + i * 2) * K };
        ankle = { x: H.x + (18 - i * 2) * K, y: AY - 3 * K };
        ang = -0.25;
      } else {
        const L = P.legs[i];
        ankle = { x: AX + L.x, y: AY - D.foot - L.up };
        ang = L.ang;
        const dx = ankle.x - H.x, dy = ankle.y - H.y;
        let d = Math.hypot(dx, dy);
        const maxD = D.thigh + D.shin - 0.2;
        if (d > maxD) { ankle = { x: H.x + dx / d * maxD, y: H.y + dy / d * maxD }; d = maxD; }
        const a = Math.acos(Math.max(-1, Math.min(1, (D.thigh * D.thigh + d * d - D.shin * D.shin) / (2 * D.thigh * d))));
        const phi = Math.atan2(ankle.y - H.y, ankle.x - H.x);
        knee = { x: H.x + Math.cos(phi - a) * D.thigh, y: H.y + Math.sin(phi - a) * D.thigh };
      }
      legData.push({ H, knee, ankle, ang });
    }

    // --- braços ---
    const armData = [];
    for (let i = 0; i < 2; i++) {
      const A = P.arms[i], S = shoulders[i];
      if (A.mode === 'none') { armData.push(null); continue; }
      if (A.mode === 'pocket') {
        if (i === 0) { armData.push(null); continue; }   // o braço de trás fica escondido atrás do corpo
        // mão dentro do bolso canguru: braço desce rente ao corpo e o antebraço entra no bolso
        const pocketP = along(5 * K, 3 * K);
        const ua = -0.12 + P.lean;
        const elbow = { x: S.x + Math.sin(ua) * D.upper, y: S.y + Math.cos(ua) * D.upper };
        armData.push({ S, elbow, wrist: pocketP, hand: null, pocket: true });
        continue;
      }
      const ua = A.u + P.lean, fa = A.u + A.f + P.lean;
      const elbow = { x: S.x + Math.sin(ua) * D.upper, y: S.y + Math.cos(ua) * D.upper };
      const wrist = { x: elbow.x + Math.sin(fa) * D.fore, y: elbow.y + Math.cos(fa) * D.fore };
      const hand = { x: wrist.x + Math.sin(fa) * 1.6 * K, y: wrist.y + Math.cos(fa) * 1.6 * K };
      armData.push({ S, elbow, wrist, hand });
    }

    const drawArm = (a, back) => {
      if (!a) return;
      const sl = longSleeve ? (back ? topB : topT) : (o.shirtless ? (back ? skinB : skinT) : (back ? topB : topT));
      const fore = longSleeve ? sl : (back ? skinB : skinT);
      const r = D.armR;
      if (fore === sl) limb(B, [[a.S.x, a.S.y, a.elbow.x, a.elbow.y, r + 0.3, r], [a.elbow.x, a.elbow.y, a.wrist.x, a.wrist.y, r, r - 0.4]], sl, true);
      else { limb(B, [[a.elbow.x, a.elbow.y, a.wrist.x, a.wrist.y, r - 0.2, r - 0.6]], fore, true); limb(B, [[a.S.x, a.S.y, a.elbow.x, a.elbow.y, r + 0.3, r]], sl, true); }
      if (!longSleeve && !o.shirtless) capsule(B, a.S.x, a.S.y, a.S.x + (a.elbow.x - a.S.x) * 0.55, a.S.y + (a.elbow.y - a.S.y) * 0.55, r + 0.6, r + 0.4, sl, true); // manga curta
      if (o.hoodie && !a.pocket) { // punho canelado
        const cx = a.wrist.x - (a.wrist.x - a.elbow.x) * 0.15, cy = a.wrist.y - (a.wrist.y - a.elbow.y) * 0.15;
        capsule(B, cx, cy, a.wrist.x, a.wrist.y, r - 0.2, r - 0.3, back ? tones(pal.shirt, 0.35) : tones(pal.shirt, 0.15), true);
      }
      if (a.hand) ellipse(B, a.hand.x, a.hand.y, 1.9 * K, 1.9 * K, back ? skinB : skinT, true);
    };
    const drawLeg = (L, back) => {
      const T = back ? pantB : pantT;
      limb(B, [[L.H.x, L.H.y, L.knee.x, L.knee.y, D.legR, D.legR - 0.4], [L.knee.x, L.knee.y, L.ankle.x, L.ankle.y, D.legR - 0.4, D.legR - 0.5]], T, true);
      if (!back && !o.kid) { // dobra do jeans atrás do joelho
        const kx = Math.round(L.knee.x - 1), ky = Math.round(L.knee.y + 1);
        if (B.get(kx, ky) === T[2]) B.set(kx, ky, T[1]);
      }
      shoe(L.ankle, L.ang, back ? shoeB : shoeT);
    };
    const shoe = (A, ang, T) => {
      // sola alinhada ao ângulo do pé (positivo = ponta para baixo)
      const c = Math.cos(ang), s = Math.sin(ang);
      const k = (o.kid ? 0.75 : 1) * K;
      const pt = (a, u) => [A.x + (a * c + u * s) * k, A.y + 2.5 * K + (a * s - u * c) * k];
      const pts = [pt(-3, 0), pt(7, 0), pt(7.8, 1.6), pt(6, 3.2), pt(2.5, 4.2), pt(-2.5, 4.4), pt(-3.4, 2.8)];
      poly(B, pts, T, (x, y, u, v) => (v > 0.78 ? 1 : v < 0.25 && u > 0.35 ? 3 : 2));
      // cadarço
      const l = pt(2.2, 3.4); B.set(Math.round(l[0]), Math.round(l[1]), T[1]);
    };

    // --- ordem: cabelo de trás, braço de trás, perna de trás, perna da frente, tronco, cabeça, braço da frente ---
    const HU = K / 1.5;
    const headX = Math.round(neckTop.x - 10 * HU);
    const headY = Math.round(neckTop.y - 19 * HU + P.headDY);
    if (style === 'long') drawHead(B, o, P, pal, headX, headY, skinT, hairT, style, true);
    drawArm(armData[0], true);
    drawLeg(legData[0], true);
    drawLeg(legData[1], false);

    // tronco
    const tw = o.kid ? 0.75 : 1;
    const TP = (a, s) => { const q = along(a * (D.torso / 20), s * tw * K); return [q.x, q.y]; };
    const torsoPts = o.hoodie
      ? [TP(-1.5, -7.5), TP(3, -8), TP(10, -8), TP(16, -7.2), TP(19.5, -5), TP(20.5, 0), TP(20, 4), TP(18.5, 7.5), TP(14, 9), TP(8, 8.6), TP(2, 8.4), TP(-1.5, 8.2)]
      : [TP(-1, -6.5), TP(4, -6.8), TP(11, -6.6), TP(17, -6), TP(19.5, -4.2), TP(20.2, 0), TP(19.8, 4), TP(18, 6.8), TP(13, 7.8), TP(7, 7), TP(1, 6.8), TP(-1, 6.6)];
    if (o.dress) {
      const dT = tones(o.dress);
      poly(B, [TP(1, -6.5), TP(1, 6.5), TP(-12, 9.5), TP(-13, 0), TP(-12, -9)], dT, (x, y, u, v) => (u < 0.2 ? 1 : u > 0.86 ? 3 : v > 0.9 ? 1 : (x + y) % 7 === 0 ? 1 : 2));
    }
    const bodyT = o.shirtless ? skinT : topT;
    poly(B, torsoPts, bodyT, (x, y, u, v) => {
      if (u < 0.12) return 0 + 1;
      if (u < 0.3) return 1;
      if (u > 0.88 && v < 0.8) return 3;
      return 2;
    });
    if (o.hoodie) {
      // barra canelada
      const bandA = TP(0.5, -7.5), bandB = TP(2.6, 8.2);
      for (let y = Math.round(Math.min(bandA[1], bandB[1]) - 1); y <= Math.round(Math.max(bandA[1], bandB[1])); y++) {
        for (let x = Math.round(TP(0, -8)[0]); x <= Math.round(TP(0, 8.5)[0]); x++) {
          const cur = B.get(x, y);
          if (cur && (cur === topT[1] || cur === topT[2] || cur === topT[3] || cur === topT[0])) {
            const q = along(0, 0); const rel = (q.y - y);
            if (rel > -1 && rel < 3) B.set(x, y, (x % 2) ? topT[1] : topT[0]);
          }
        }
      }
      // bolso canguru
      poly(B, [TP(4, 0.5), TP(9.5, 1.5), TP(9.5, 7.6), TP(4, 7.8)], topT, (x, y, u, v) => (v < 0.12 ? 0 : u < 0.1 || u > 0.92 ? 0 : v > 0.9 ? 1 : 2 - (u < 0.35 ? 1 : 0)));
      // capuz caído nas costas
      poly(B, [TP(15, -8.5), TP(21.5, -8.5), TP(23.5, -5), TP(22, -1), TP(18.5, -2), TP(16.5, -5)], topT, (x, y, u, v) => (u < 0.3 ? 1 : v > 0.75 ? 0 : 2));
      // gola do capuz em volta do pescoço
      const g1 = TP(20, -1.5), g2 = TP(20.4, 3.5);
      capsule(B, g1[0], g1[1], g2[0], g2[1], 1.6, 1.6, tones(pal.shirt, 0.45), false);
      // cordões
      const sa = TP(19.2, 2.2), sb = TP(13.5, 2.8), sc = TP(19.2, 4.4), sd = TP(14.5, 5.2);
      const cord = tones('#d5d8e2');
      capsule(B, sa[0], sa[1], sb[0], sb[1], 0.5, 0.5, cord, false); capsule(B, sc[0], sc[1], sd[0], sd[1], 0.5, 0.5, cord, false);
      B.set(Math.round(sb[0]), Math.round(sb[1]) + 1, cord[1]); B.set(Math.round(sd[0]), Math.round(sd[1]) + 1, cord[1]);
      // dobras
      const f1 = TP(10, -3), f2 = TP(7, -1);
      capsule(B, f1[0], f1[1], f2[0], f2[1], 0.4, 0.4, [topT[1], topT[1], topT[1], topT[1]], false);
    } else if (o.shirtless) {
      const t1 = TP(1.5, -7), t2 = TP(1.5, 7);
      poly(B, [TP(-1.5, -7.5), TP(3.5, -7.5), TP(3.5, 7.2), TP(-1.5, 7)], tones('#f1f1f1'), (x, y, u, v) => (u < 0.2 ? 1 : 2)); void t1; void t2;
      const m1 = TP(13, 1), m2 = TP(13, 5); B.set(Math.round(m1[0]), Math.round(m1[1]), skinT[1]); B.set(Math.round(m2[0]), Math.round(m2[1]), skinT[1]);
    } else {
      // gola em V
      const n1 = TP(19.8, 0.5), n2 = TP(17, 2.5), n3 = TP(19.8, 4.2);
      poly(B, [n1, n2, n3], skinT, () => 1);
      if (o.inner) {
        // jaqueta aberta: camiseta aparecendo na frente e lapelas
        poly(B, [TP(19.6, 2.2), TP(19.6, 6.4), TP(-0.5, 6.6), TP(-0.5, 3.6), TP(10, 3.2)], tones(o.inner), (x, y, u) => (u < 0.18 ? 1 : 2));
        const l1 = TP(19.5, 2), l2 = TP(9, 3), l3 = TP(-0.5, 3.4);
        capsule(B, l1[0], l1[1], l2[0], l2[1], 0.6, 0.6, tones(pal.shirt, 0.45), false); capsule(B, l2[0], l2[1], l3[0], l3[1], 0.6, 0.6, tones(pal.shirt, 0.45), false);
      }
      if (o.jacket && !o.inner) { const j1 = TP(19, 3), j2 = TP(0.5, 3.4); capsule(B, j1[0], j1[1], j2[0], j2[1], 0.6, 0.6, tones(pal.shirt, 0.5), false); B.set(Math.round(TP(12, 4.5)[0]), Math.round(TP(12, 4.5)[1]), c32('#d9d9d9')); B.set(Math.round(TP(6, 4.6)[0]), Math.round(TP(6, 4.6)[1]), c32('#d9d9d9')); }
      if (o.stripe) poly(B, [TP(11, -7), TP(13.5, -7), TP(13.5, 7.5), TP(11, 7.5)], tones(o.stripe), (x, y, u) => (u < 0.25 ? 1 : 2));
      if (o.apron) poly(B, [TP(-1, 0), TP(17, 0.5), TP(17, 7.2), TP(-1, 7.6)], tones('#f3efe6'), (x, y, u, v) => (u < 0.18 ? 1 : v < 0.06 ? 1 : 2));
      if (!o.kid && !o.dress) { const b1 = TP(0.6, -6.5), b2 = TP(0.6, 6.6); capsule(B, b1[0], b1[1], b2[0], b2[1], 0.6, 0.6, tones(pal.belt || dark(pal.pants, 0.4)), false); }
    }

    // pescoço e cabeça
    const nb = along(D.torso - K, K);
    capsule(B, nb.x, nb.y, neckTop.x, neckTop.y + K, 2 * K, 2 * K, skinB, false);
    drawHead(B, o, P, pal, headX, headY, skinT, hairT, style, false);

    // braço da frente por último (no bolso, o bolso fica por cima da mão)
    drawArm(armData[1], false);
    if (armData[1] && armData[1].pocket && o.hoodie) {
      const TP2 = (a, s2) => { const q = along(a * (D.torso / 20), s2 * K); return [q.x, q.y]; };
      poly(B, [TP2(4, 0.5), TP2(9.5, 1.5), TP2(9.5, 7.6), TP2(4, 7.8)], topT, (x, y, u2, v) => (v < 0.12 ? 0 : u2 < 0.1 || u2 > 0.92 ? 0 : v > 0.9 ? 1 : 2 - (u2 < 0.35 ? 1 : 0)));
      const w1 = TP2(9.2, 2.2); B.set(Math.round(w1[0]), Math.round(w1[1]), topT[3]);
    }
  }

  function keyOf(o, kind, f, P, flip) {
    const pal = o.pal || G.PAL_V;
    return [kind, f, P.eyes, flip ? 1 : 0, o.carrying ? 1 : 0, o.handOnBag ? 1 : 0, o.aim ? 1 : 0, pal.skin, pal.hair, pal.shirt, pal.pants, pal.shoe, pal.belt, pal.eye,
      o.hairStyle || '', o.dress || '', o.apron ? 1 : 0, o.shirtless ? 1 : 0, o.kid ? 1 : 0, o.beard || '', o.glasses ? 1 : 0,
      o.helmet || '', o.cap || '', o.jacket ? 1 : 0, o.stripe || '', o.hoodie ? 1 : 0, o.longSleeve ? 1 : 0, o.inner || ''].join('|');
  }

  /** Quadro (canvas) com contorno; virado para a esquerda quando facing < 0. */
  function frame(o) {
    const [kind, f] = frameIndex(o);
    const P = makePose(o, kind, f);
    const flip = o.facing < 0;
    const k = keyOf(o, kind, f, P, flip);
    let cv = cache.get(k);
    if (cv) return { cv, P };
    const B = new Buf(BW, BH);
    paint(B, o, P);
    outline(B);
    cv = toCanvas(B, flip);
    if (cache.size > 2500) cache.clear();
    cache.set(k, cv);
    return { cv, P };
  }

  /** Sombra suave no chão. */
  function shadow(c, x, y, w) {
    c.save(); c.globalAlpha = 0.2; c.fillStyle = '#05030a';
    c.fillRect(x - w / 2 + 4, y - 2, w - 8, 4); c.fillRect(x - w / 2, y - 1, w, 2);
    c.restore();
  }

  /**
   * Desenha um personagem com o centro dos pés em (cx, feetY), coordenadas do mundo.
   * o: { facing, state, t, pal, hairStyle, hoodie, dress, apron, shirtless, kid, run, carrying,
   *      handOnBag, gesture, aim, glow, glowColor, flash, landT, seed, beard, glasses, shadow }
   */
  function draw(c, cx, feetY, o) {
    const st = o.state || 'idle';
    if (st === 'lie' || st === 'sleep' || st === 'collapse') return drawLying(c, cx, feetY, o);
    const { cv, P } = frame(o);
    const S = G.HI || 2;
    G.hi(c, () => {
      const X = Math.round(cx * S), Y = Math.round(feetY * S) + (o.landT > 0 ? 1 : 0);
      if (o.shadow !== false && (st === 'idle' || st === 'walk' || st === 'sweep' || st === 'stun' || st === 'rise')) shadow(c, X, Y, Math.round((o.kid ? 16 : 24) * K));
      const ox = X - (o.facing < 0 ? BW - 1 - AX : AX), oy = Y - AY;
      c.drawImage(cv, ox, oy);
      if (o.aim) aimArm(c, X, Y, o, P);
      if (o.flash > 0) {
        c.save(); c.globalAlpha = Math.min(0.8, o.flash); c.globalCompositeOperation = 'lighter';
        c.drawImage(cv, ox, oy); c.drawImage(cv, ox, oy); c.restore();
      }
    });
  }

  /* ---------------- braço apontando (poderes) ---------------- */
  const armCache = new Map();
  function aimArm(c, X, Y, o, P) {
    const f = o.facing < 0 ? -1 : 1;
    const D = rigDims(o);
    const S = G.HI || 2;
    const sx = X + Math.round(f * 3 * K), sy = Y + Math.round(D.hipY - D.torso + 3 * K + P.chest);
    const ang = Math.atan2(o.aim.y * S - sy, o.aim.x * S - sx);
    const N = 48, bucket = ((Math.round(ang / (Math.PI * 2) * N) % N) + N) % N;
    const pal = o.pal || G.PAL_V;
    const key = bucket + '|' + pal.shirt + pal.skin + (o.hoodie ? 1 : 0);
    let cv = armCache.get(key);
    if (!cv) {
      const AB = Math.round(56 * K), B = new Buf(AB, AB), a = bucket / N * Math.PI * 2;
      const dx = Math.cos(a), dy = Math.sin(a), cx0 = AB / 2, cy0 = AB / 2;
      const L = D.upper + D.fore;
      const sl = tones(pal.shirt);
      capsule(B, cx0, cy0, cx0 + dx * (L - 2), cy0 + dy * (L - 2), D.armR + 0.3, D.armR - 0.3, o.hoodie || o.jacket ? sl : tones(pal.skin), true);
      capsule(B, cx0, cy0, cx0 + dx * 6 * K, cy0 + dy * 6 * K, D.armR + 0.6 * K, D.armR + 0.4 * K, sl, true);
      if (o.hoodie) capsule(B, cx0 + dx * (L - 4.5 * K), cy0 + dy * (L - 4.5 * K), cx0 + dx * (L - 2 * K), cy0 + dy * (L - 2 * K), D.armR - 0.1, D.armR - 0.2, tones(pal.shirt, 0.15), true);
      // mão aberta (dedos esticados)
      ellipse(B, cx0 + dx * L, cy0 + dy * L, 2.2 * K, 2.2 * K, tones(pal.skin), true);
      capsule(B, cx0 + dx * L, cy0 + dy * L, cx0 + dx * (L + 3.2 * K), cy0 + dy * (L + 3.2 * K), 1 * K, 0.8 * K, tones(pal.skin), false);
      outline(B);
      cv = toCanvas(B, false);
      armCache.set(key, cv);
    }
    c.drawImage(cv, sx - cv.width / 2, sy - cv.height / 2);
    if (o.glow > 0) {
      const L = D.upper + D.fore + 2 * K, hx = sx + Math.cos(ang) * L, hy = sy + Math.sin(ang) * L;
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(hx, hy, 0, hx, hy, 9 * K);
      g.addColorStop(0, hexA(o.glowColor || '#9fd8ff', 0.75 * o.glow)); g.addColorStop(1, hexA(o.glowColor || '#9fd8ff', 0));
      c.fillStyle = g; c.fillRect(hx - 9 * K, hy - 9 * K, 18 * K, 18 * K); c.restore();
    }
  }
  function hexA(hex, a) { const [r, g, b] = rgb(hex); return 'rgba(' + r + ',' + g + ',' + b + ',' + a.toFixed(3) + ')'; }

  /** Deitado: o quadro parado (olhos fechados se dormindo) girado 90°, pixel a pixel. */
  function drawLying(c, cx, feetY, o) {
    const f = o.facing < 0 ? -1 : 1;
    const closed = o.state !== 'lie';
    const { cv } = frame(Object.assign({}, o, { state: 'idle', t: 0, seed: 0, facing: f, blink: closed, aim: null, carrying: false, gesture: 0, handOnBag: 0, run: false }));
    const S = G.HI || 2;
    G.hi(c, () => {
      const X = Math.round(cx * S), Y = Math.round(feetY * S);
      c.save(); c.translate(X, Y);
      // cabeça para o lado de f (esquerda quando f > 0), costas no chão
      if (f > 0) { c.rotate(-Math.PI / 2); c.drawImage(cv, -(AX - 12 * K), -(AY - 34 * K)); }
      else { c.rotate(Math.PI / 2); c.drawImage(cv, -(BW - 1 - AX + 14 * K), -(AY - 34 * K)); }
      c.restore();
      if (o.state === 'lie') { // bolsa de gelo na testa
        const hx = X + Math.round(f * -26 * K) - 9;
        c.fillStyle = '#cfeaff'; c.fillRect(hx, Y - Math.round(26 * K), 18, 9); c.fillStyle = '#ffffff'; c.fillRect(hx + 2, Y - Math.round(26 * K), 14, 3);
      }
    });
  }

  /** Sprite genérico em cache (resolução do mundo): fn(ctx, P) pinta em (0..w, 0..h); recebe contorno. */
  const misc = new Map();
  function cached(key, w, h, fn, noOutline) {
    let cv = misc.get(key);
    if (cv) return cv;
    cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d');
    fn(cx, (x, y, ww, hh, col) => { cx.fillStyle = col; cx.fillRect(x, y, ww, hh); });
    if (!noOutline) {
      const img = cx.getImageData(0, 0, w, h);
      const B = new Buf(w, h); B.px.set(new Uint32Array(img.data.buffer));
      outline(B);
      new Uint32Array(img.data.buffer).set(B.px);
      cx.putImageData(img, 0, 0);
    }
    if (misc.size > 600) misc.clear();
    misc.set(key, cv);
    return cv;
  }

  G.Characters = { cached, draw, frame, mix, dark, light, BW, BH, AX, AY, _cache: cache };
})(window.VG = window.VG || {});

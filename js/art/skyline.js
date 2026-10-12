/* =====================================================================
 * Céu, nuvens, sol/lua e cidade ao fundo em camadas, na grade fina.
 * Tudo é pré-desenhado uma vez (versão dia + noite de cada camada);
 * por quadro só se copiam canvases e alguns pixels animados.
 * ===================================================================== */
(function (G) {
  'use strict';

  function mk(w, h) {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(w)); cv.height = Math.max(1, Math.ceil(h));
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    return [cv, c];
  }
  // gerador pseudoaleatório com semente (a cidade é sempre a mesma)
  function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const pick = (R, a) => a[Math.floor(R() * a.length) % a.length];
  // 'rgb(r,g,b)' ou '#hex' → '#hex'
  function hex(s) {
    if (s[0] === '#') return s;
    const m = s.match(/\d+/g).map(Number);
    return '#' + m.slice(0, 3).map((n) => n.toString(16).padStart(2, '0')).join('');
  }
  // intensidade do nascer/pôr do sol (0..1)
  function duskAt(min) {
    const m = ((min % 1440) + 1440) % 1440;
    const tri = (c, w) => Math.max(0, 1 - Math.abs(m - c) / w);
    return Math.max(tri(395, 75), tri(1095, 95));
  }

  const WARM = ['#ffd27a', '#ffc35c', '#ffe3a0', '#ffcf70', '#f7b85a'];
  const COOL = ['#cfe6ff', '#a9d4ff', '#e0f0ff'];

  function create(renderer) {
    const P = G.Pix, S = G.HI, u = S / 2;
    const SW = G.VIEW_W * S, SH = G.VIEW_H * S;
    const U = (v) => Math.round(v * u);
    const N = (col, k) => P.mix(col, '#0a0f24', k === undefined ? 0.8 : k);

    /* ---------- desenho duplo: dia e noite no mesmo traço ---------- */
    function dual(W, H) {
      const [cd, xd] = mk(W, H), [cn, xn] = mk(W, H);
      const d = P.painter(xd), n = P.painter(xn);
      return {
        cd, cn, d, n,
        r(x, y, w, h, a, b) { if (a) d.rect(x, y, w, h, a); if (b) n.rect(x, y, w, h, b); },
      };
    }

    /* ---------- itens de telhado ---------- */
    function waterTower(D, x, top, hz) {
      const wood = P.mix('#8b5a3c', hz.c, hz.k), T = P.tones(wood), nw = N(wood, 0.78);
      const leg = P.mix('#4e3a2c', hz.c, hz.k);
      // pernas e travessa
      D.r(x + 1, top - 5, 1, 5, leg, N(leg)); D.r(x + 8, top - 5, 1, 5, leg, N(leg)); D.r(x + 4, top - 5, 1, 5, leg, N(leg));
      D.r(x + 1, top - 3, 8, 1, leg, N(leg));
      // barril com cintas
      D.r(x, top - 15, 10, 10, T.b, nw); D.r(x, top - 15, 2, 10, T.l, null); D.r(x + 8, top - 15, 2, 10, T.d, P.mix(nw, '#000', 0.3));
      D.r(x, top - 12, 10, 1, T.d2, null); D.r(x, top - 8, 10, 1, T.d2, null);
      // telhado cônico
      D.r(x - 1, top - 16, 12, 1, T.d, nw); D.r(x, top - 17, 10, 1, T.d, nw); D.r(x + 2, top - 18, 6, 1, T.d2, nw); D.r(x + 4, top - 19, 2, 1, T.d2, nw);
    }
    function antenna(D, x, top, h, hz, L, primary) {
      const m = P.mix('#5c6470', hz.c, hz.k), nm = N(m, 0.6);
      D.r(x, top - h, 1, h, m, nm);
      for (let y = top - h + 4; y < top - 2; y += 5) D.r(x - 2, y, 5, 1, m, nm);
      D.r(x - 1, top - 2, 3, 2, m, nm);
      if (primary) L.lights.push({ x, y: top - h - 1, ph: Math.random() * 6, sp: 1.6 + Math.random() * 1.4 });
    }
    function tvAntenna(D, x, top, hz) {
      const m = P.mix('#4a515c', hz.c, hz.k), nm = N(m, 0.55);
      D.r(x, top - 10, 1, 10, m, nm);
      D.r(x - 3, top - 10, 7, 1, m, nm); D.r(x - 2, top - 8, 5, 1, m, nm); D.r(x - 1, top - 6, 3, 1, m, nm);
    }
    function dish(D, x, top, hz) {
      const w = P.mix('#e3e6ea', hz.c, hz.k), s = P.mix('#a9b0ba', hz.c, hz.k), nw = N(w, 0.7);
      D.r(x + 2, top - 3, 1, 3, s, nw);
      D.r(x, top - 8, 2, 5, w, nw); D.r(x + 1, top - 9, 2, 1, w, nw); D.r(x + 1, top - 3, 2, 1, s, nw); D.r(x + 2, top - 7, 1, 3, s, null);
      D.r(x + 3, top - 6, 2, 1, s, nw);
    }
    function acUnits(D, x, top, n, hz) {
      const g = P.mix('#b9bfc6', hz.c, hz.k), T = P.tones(g);
      for (let k = 0; k < n; k++) {
        const X = x + k * 7;
        D.r(X, top - 4, 6, 4, T.b, N(g, 0.75)); D.r(X, top - 4, 6, 1, T.h, null); D.r(X + 5, top - 3, 1, 3, T.d, null);
        D.r(X + 2, top - 3, 2, 2, T.d2, P.mix(N(g), '#000', 0.3));
      }
    }
    function roofBox(D, x, top, w, h, col, hz) {
      const c = P.mix(col, hz.c, hz.k), T = P.tones(c);
      D.r(x, top - h, w, h, T.b, N(c, 0.8)); D.r(x, top - h, w, 1, T.h, N(c, 0.7)); D.r(x + w - 1, top - h, 1, h, T.d, null);
      if (w > 6 && h > 6) D.r(x + 2, top - h + 3, 3, h - 3, T.d2, null);
    }
    function waterTank(D, x, top, hz) {
      const c = P.mix('#4f86b8', hz.c, hz.k), T = P.tones(c), nc = N(c, 0.78);
      D.r(x + 1, top - 2, 1, 2, T.d2, nc); D.r(x + 9, top - 2, 1, 2, T.d2, nc);
      D.r(x, top - 9, 11, 7, T.b, nc); D.r(x, top - 9, 11, 1, T.h, null); D.r(x, top - 9, 2, 7, T.l, null); D.r(x + 9, top - 9, 2, 7, T.d, null);
      D.r(x + 4, top - 8, 1, 6, T.d, null);
    }

    /* ---------- janela genérica (dia/noite) ---------- */
    function windowPx(D, x, y, w, h, glass, refl, litP, R, L, primary, dayWarm) {
      const warmDay = R() < (dayWarm || 0);
      D.d.rect(x, y, w, h, warmDay ? '#f2d68a' : glass);
      if (!warmDay && refl && w > 1 && h > 1) D.d.rect(x, y, w, 1, refl);
      const lit = R() < litP;
      if (lit) {
        const col = R() < 0.18 ? pick(R, COOL) : pick(R, WARM);
        D.n.rect(x, y, w, h, col);
        if (h > 3 && R() < 0.4) D.n.rect(x, y, w, 1, P.mix(col, '#7a4a20', 0.35)); // cortina
      } else {
        D.n.rect(x, y, w, h, '#171d33');
        const f = R(), fc = pick(R, WARM), fp = R();
        if (primary && L.flick.length < 60 && f < 0.05) L.flick.push({ x, y, w, h, col: fc, ph: fp * 50, per: 6 + fp * 14 });
      }
    }

    /* ---------- prédio de escritórios (azul-acinzentado, grade de janelas) ---------- */
    const OFFICE = ['#7f93ad', '#8a9bb3', '#6f86a3', '#9aa9bd', '#7a8ca8', '#8796a8', '#94a6bb', '#6d7f99'];
    function office(D, x, base, w, h, R, L, primary) {
      const hz = L.hz, lv = L.lv;
      const col = P.mix(pick(R, OFFICE), hz.c, hz.k), T = P.tones(col), nc = N(col, 0.8);
      const top = base - h;
      const sw = Math.max(2, Math.round(w * 0.16)), fw = w - sw;
      D.r(x, top, fw, h, T.b, nc);
      D.r(x + fw, top, sw, h, T.d, P.mix(nc, '#000', 0.3));
      D.r(x, top, 1, h, T.l, null);
      const glass = P.mix('#b4cfe4', hz.c, hz.k * 0.7), refl = P.mix('#dcebf5', hz.c, hz.k * 0.7);
      const glassS = P.mix(glass, '#30405a', 0.3);
      const litP = L.lit * (0.5 + R());
      const style = R();
      if (lv === 0) {
        // longe: faixas finas de janelas
        const fh = 3 + (R() < 0.5 ? 1 : 0);
        for (let y = top + 4; y < base - 2; y += fh) {
          D.r(x + 2, y, fw - 4, 1, glass, null); D.r(x + fw + 1, y, sw - 2, 1, glassS, null);
          for (let wx = x + 2; wx < x + fw - 3; wx += 3) if (R() < litP) D.n.rect(wx, y, 2, 1, pick(R, WARM)); else if (R() < 0.03) D.d.rect(wx, y, 2, 1, '#e8d79a');
        }
      } else if (style < 0.45) {
        // fitas horizontais com montantes
        const gh = 3, fh = 6;
        for (let y = top + 6; y < base - 4; y += fh) {
          D.r(x + 2, y, fw - 4, gh, glass, '#151b30'); D.d.rect(x + 2, y, fw - 4, 1, refl);
          D.r(x + 2, y + gh, fw - 4, 1, T.d, null);
          D.r(x + fw + 1, y, sw - 2, gh, glassS, '#10152a');
          for (let wx = x + 2; wx < x + fw - 2; wx += 5) {
            D.r(wx, y, 1, gh, T.d, P.mix(nc, '#000', 0.2));
            const cw = Math.min(4, x + fw - 2 - wx - 1);
            if (cw > 0 && R() < litP) D.n.rect(wx + 1, y, cw, gh, pick(R, R() < 0.3 ? COOL : WARM));
            else if (cw > 0 && R() < 0.06) D.d.rect(wx + 1, y, cw, gh, '#efd690');
          }
        }
      } else if (style < 0.8) {
        // grade de janelas
        const ww = 3, wh = 3, gx = 5, fh = 6;
        const cols = Math.max(1, Math.floor((fw - 4) / gx)), ox = x + Math.floor((fw - cols * gx) / 2) + 1;
        for (let y = top + 6; y < base - 4; y += fh) {
          for (let k = 0; k < cols; k++) windowPx(D, ox + k * gx, y, ww, wh, glass, refl, litP, R, L, primary, 0.07);
          for (let sx = x + fw + 1; sx < x + w - 2; sx += 3) D.r(sx, y, 2, wh, glassS, R() < litP * 0.6 ? pick(R, WARM) : '#10152a');
        }
      } else {
        // fachada de vidro com pilares verticais
        D.r(x + 2, top + 4, fw - 4, h - 6, glass, '#141a30');
        for (let wx = x + 2; wx < x + fw - 2; wx += 4) D.r(wx, top + 4, 1, h - 6, T.l, P.mix(nc, '#fff', 0.05));
        for (let y = top + 8; y < base - 2; y += 6) {
          D.r(x + 2, y, fw - 4, 1, T.d, nc);
          for (let wx = x + 3; wx < x + fw - 3; wx += 4) if (R() < litP) D.n.rect(wx, y - 5, 3, 5, pick(R, R() < 0.4 ? COOL : WARM));
        }
        D.d.rect(x + 3, top + 5, Math.max(1, Math.round(fw * 0.25)), 1, refl);
      }
      // platibanda
      D.r(x - 1, top - 2, w + 2, 2, T.h, P.mix(nc, '#fff', 0.08)); D.r(x - 1, top, w + 2, 1, T.d, null);
      // topo escalonado
      let rt = top - 2, rx = x, rw = w;
      if (lv && R() < 0.35 && fw > 26) {
        const w2 = Math.round(fw * (0.45 + R() * 0.2)), h2 = U(8 + R() * 14), x2 = x + Math.round((fw - w2) / 2);
        D.r(x2, rt - h2, w2, h2, T.b, nc); D.r(x2 + w2 - 3, rt - h2, 3, h2, T.d, null); D.r(x2, rt - h2, 1, h2, T.l, null);
        for (let y = rt - h2 + 3; y < rt - 2; y += 5) D.r(x2 + 2, y, w2 - 6, 2, glass, R() < litP ? pick(R, WARM) : '#151b30');
        D.r(x2 - 1, rt - h2 - 2, w2 + 2, 2, T.h, P.mix(nc, '#fff', 0.08));
        rt = rt - h2 - 2; rx = x2; rw = w2;
      }
      if (lv === 0) {
        if (R() < 0.3) antenna(D, rx + Math.floor(rw / 2), rt, 8 + Math.floor(R() * 14), hz, L, primary);
        else if (R() < 0.5) roofBox(D, rx + 2, rt, Math.min(8, rw - 4), 3, '#8a96a6', hz);
        return;
      }
      // equipamentos no telhado
      let cx = rx + 2;
      const items = 1 + Math.floor(R() * 3);
      for (let k = 0; k < items && cx < rx + rw - 8; k++) {
        const t = R();
        if (t < 0.25 && cx + 11 < rx + rw) { waterTower(D, cx, rt, hz); cx += 13; }
        else if (t < 0.45) { antenna(D, cx + 2, rt, 12 + Math.floor(R() * 18), hz, L, primary); cx += 6; }
        else if (t < 0.6) { dish(D, cx, rt, hz); cx += 7; }
        else if (t < 0.8 && cx + 13 < rx + rw) { acUnits(D, cx, rt, 2, hz); cx += 15; }
        else { const bw = Math.min(10, rx + rw - cx - 2); roofBox(D, cx, rt, bw, 6, '#8d97a4', hz); cx += bw + 2; }
      }
    }

    /* ---------- prédio residencial (tijolo, terracota, bege) ---------- */
    const RES = ['#c46a55', '#b8584a', '#d9c29a', '#e0b77e', '#d98f86', '#e8dcc0', '#c99a5b', '#cf8a6a', '#a9b9c4', '#d4a88c', '#bf7b63', '#e3cfa4'];
    const ADS = ['#e74c3c', '#2e86de', '#27ae60', '#f39c12', '#8e44ad', '#16a085'];
    function residential(D, x, base, w, h, R, L, primary) {
      const hz = L.hz;
      const col = P.mix(pick(R, RES), hz.c, hz.k), T = P.tones(col), nc = N(col, 0.78);
      const top = base - h;
      D.r(x, top, w, h, T.b, nc);
      D.r(x + w - 2, top, 2, h, T.d, P.mix(nc, '#000', 0.3));
      D.r(x, top, 1, h, T.l, null);
      if (R() < 0.45) D.d.clusters(x + 1, top + 3, w - 3, h - 3, P.mix(T.b, T.d, 0.55), Math.floor(w * h / 45), 2, Math.floor(R() * 999)); // tijolinhos
      const glass = P.mix('#8fb4cf', hz.c, hz.k * 0.6), refl = P.mix('#c9deea', hz.c, hz.k * 0.6);
      const frame = P.mix(P.light(col, 0.45), hz.c, hz.k * 0.3);
      const fh = 12, ww = 5, wh = 6, gx = R() < 0.5 ? 9 : 10;
      const cols = Math.max(1, Math.floor((w - 6) / gx)), ox = x + Math.floor((w - cols * gx) / 2) + 2;
      const style = R(), litP = L.lit * (0.6 + R() * 0.8);
      const ac = P.mix('#cfd3d8', hz.c, hz.k);
      for (let y = top + 7; y < base - 10; y += fh) {
        if (style > 0.7) D.r(x + 1, y + wh + 3, w - 3, 1, T.d, null); // faixa de laje
        for (let k = 0; k < cols; k++) {
          const wx = ox + k * gx;
          D.r(wx - 1, y - 1, ww + 2, wh + 2, frame, P.mix(nc, '#fff', 0.06));
          windowPx(D, wx, y, ww, wh, glass, refl, litP, R, L, primary, 0.14);
          D.d.rect(wx + 2, y, 1, wh, P.mix(glass, frame, 0.5));
          D.r(wx - 1, y + wh + 1, ww + 2, 1, T.d, null); // peitoril
          if (style < 0.35 && (k % 2 === 0 || style < 0.15)) {
            // sacada com grade
            D.r(wx - 2, y + wh - 2, ww + 4, 1, T.h, P.mix(nc, '#fff', 0.12));
            for (let p = wx - 2; p < wx + ww + 2; p += 2) D.r(p, y + wh - 1, 1, 2, T.h, P.mix(nc, '#fff', 0.12));
            D.r(wx - 2, y + wh + 1, ww + 4, 1, T.d2, P.mix(nc, '#000', 0.3));
          }
          if (R() < 0.12) { D.r(wx + ww + 1, y + wh - 3, 3, 3, ac, N(ac, 0.75)); D.d.px(wx + ww + 2, y + wh - 2, P.dark(ac, 0.4)); }
        }
      }
      // térreo com loja e toldo
      const aw = pick(R, ADS);
      D.r(x + 1, base - 9, w - 3, 9, P.dark(col, 0.35), P.mix(nc, '#000', 0.3));
      for (let sx = x + 3; sx < x + w - 6; sx += 8) D.r(sx, base - 7, 6, 7, glass, R() < 0.6 ? '#ffd98a' : '#141a30');
      for (let sx = x + 1; sx < x + w - 2; sx += 2) D.r(sx, base - 10, 1, 2, ((sx - x) >> 1) % 2 ? aw : '#f4efe6', ((sx - x) >> 1) % 2 ? N(aw, 0.6) : N('#f4efe6', 0.75));
      // platibanda
      D.r(x - 1, top - 3, w + 2, 3, T.l, P.mix(nc, '#fff', 0.08)); D.r(x - 1, top - 3, w + 2, 1, T.h, null); D.r(x, top, w, 1, T.d2, null);
      // telhado
      let cx = x + 2;
      const rt = top - 3;
      if (R() < 0.2 && w > 48) {
        // outdoor
        const bw = Math.min(40, w - 8), bh = 15, bx = x + Math.floor((w - bw) / 2), by = rt - 6 - bh;
        const pc = P.mix('#5b6370', hz.c, hz.k);
        D.r(bx + 4, by + bh, 1, 6, pc, N(pc)); D.r(bx + bw - 5, by + bh, 1, 6, pc, N(pc)); D.r(bx + 3, by + bh + 3, bw - 6, 1, pc, N(pc));
        const ad = P.mix(pick(R, ADS), hz.c, hz.k * 0.5), ad2 = P.mix(pick(R, ADS), hz.c, hz.k * 0.5);
        D.r(bx, by, bw, bh, '#f4f1ea', '#a8a49a'); D.r(bx + 1, by + 1, bw - 2, bh - 2, ad, P.mix(ad, '#000', 0.25));
        D.r(bx + 3, by + 3, Math.floor(bw * 0.45), 2, '#ffffff', '#e8e8e8'); D.r(bx + 3, by + 7, Math.floor(bw * 0.3), 1, '#ffffff', '#d8d8d8');
        D.r(bx + bw - 12, by + 3, 8, 9, ad2, P.mix(ad2, '#000', 0.2)); D.r(bx + bw - 10, by + 5, 4, 5, '#fff4dc', '#e0d8c0');
        for (let k = 0; k < 3; k++) D.r(bx + 4 + k * Math.floor((bw - 8) / 2), by - 2, 2, 2, pc, '#fff3c0');
        if (primary) L.boards.push({ x: bx, y: by, w: bw, h: bh });
        return;
      }
      const items = 1 + Math.floor(R() * 3);
      for (let k = 0; k < items && cx < x + w - 8; k++) {
        const t = R();
        if (t < 0.3 && cx + 12 < x + w) { waterTank(D, cx, rt, hz); cx += 13; }
        else if (t < 0.55) { tvAntenna(D, cx + 3, rt, hz); cx += 8; }
        else if (t < 0.7) { dish(D, cx, rt, hz); cx += 7; }
        else if (t < 0.85 && cx + 12 < x + w) { roofBox(D, cx, rt, 11, 8, P.dark(col, 0.1), hz); cx += 13; }
        else { acUnits(D, cx, rt, 1, hz); cx += 8; }
      }
    }

    /* ---------- silhuetas bem distantes ---------- */
    function haze(D, x, base, w, h, R, L, primary) {
      const c0 = P.mix(pick(R, ['#9db0c4', '#a6b6c8', '#95a9bf']), L.hz.c, L.hz.k);
      const top = base - h, nc = N(c0, 0.82);
      D.r(x, top, w, h, c0, nc);
      D.r(x + w - 3, top, 3, h, P.mix(c0, '#5a6a86', 0.12), null);
      for (let y = top + 4; y < base; y += 4) {
        D.d.rect(x + 2, y, w - 6, 1, P.mix(c0, '#e4eef6', 0.18));
        for (let wx = x + 2; wx < x + w - 4; wx += 3) if (R() < 0.12) D.n.rect(wx, y, 2, 1, P.mix(pick(R, WARM), nc, 0.35));
      }
      if (R() < 0.25) { // agulha
        const ax = x + Math.floor(w / 2), ah = 10 + Math.floor(R() * 20);
        D.r(ax - 1, top - 4, 3, 4, c0, nc); D.r(ax, top - 4 - ah, 1, ah, c0, nc);
        const ph = R() * 6;
        if (primary) L.lights.push({ x: ax, y: top - 5 - ah, ph, sp: 1.2 });
      }
    }

    /* ---------- camada de prédios que se repete na horizontal ---------- */
    function cityLayer(o) {
      const W = U(o.W), H = U(o.H);
      const D = dual(W, H);
      const L = { W, H, fx: o.fx, fy: o.fy, hz: o.hz, lv: o.lv, lit: o.lit, haze: o.haze, fill: o.fill, lights: [], flick: [], boards: [] };
      const R0 = rng(o.seed), list = [];
      let x = 0, i = 0;
      while (x < W - U(o.wMin)) {
        let bw = U(o.wMin + R0() * (o.wMax - o.wMin));
        const gap = R0() < o.gapP ? U(2 + R0() * 8) : 0;
        if (W - (x + bw + gap) < U(o.wMin)) bw = W - x - gap;
        const h = U(o.hMin + Math.pow(R0(), o.pow || 1) * (o.hMax - o.hMin));
        list.push({ x, w: bw, h, s: o.seed * 977 + i });
        x += bw + gap; i++;
      }
      // os mais baixos primeiro? não: ordem natural, mas fileira de trás opcional
      for (const b of list) {
        o.paint(D, b.x, H, b.w, b.h, rng(b.s), L, true);
        if (b.x < 4) o.paint(D, b.x + W, H, b.w, b.h, rng(b.s), L, false);
        if (b.x + b.w > W - 4) o.paint(D, b.x - W, H, b.w, b.h, rng(b.s), L, false);
      }
      L.day = D.cd; L.night = D.cn;
      return L;
    }

    /* ---------- viaduto ---------- */
    function highway() {
      const W = U(1080), H = U(110), top = 22;
      const D = dual(W, H);
      const con = '#a3abb4', T = P.tones(con), nc = N(con, 0.78);
      const L = { W, H, fx: 0.34, fy: 0.62, deck: top, haze: 0.08, lights: [], flick: [], boards: [], lamps: [] };
      // pilares
      for (let px = 40; px < W; px += 120) {
        D.r(px, top + 9, 12, H - top - 9, T.b, nc); D.r(px, top + 9, 2, H - top - 9, T.l, null); D.r(px + 9, top + 9, 3, H - top - 9, T.d, P.mix(nc, '#000', 0.3));
        D.r(px - 3, top + 9, 18, 3, T.l, P.mix(nc, '#fff', 0.05)); D.r(px - 3, top + 12, 18, 1, T.d2, null);
        D.d.clusters(px + 2, top + 16, 7, H - top - 20, T.d, 6, 2, px);
      }
      // tabuleiro
      D.r(0, top, W, 9, T.b, nc); D.r(0, top, W, 1, T.h, P.mix(nc, '#fff', 0.1)); D.r(0, top + 7, W, 2, T.d2, P.mix(nc, '#000', 0.35));
      D.r(0, top + 3, W, 1, T.l, null);
      for (let jx = 0; jx < W; jx += 60) D.r(jx, top + 1, 1, 6, T.d, P.mix(nc, '#000', 0.2));
      // mureta de trás (grade fina)
      const rail = P.mix('#8c949d', '#c3d3df', 0.2), nr = N(rail, 0.7);
      D.r(0, top - 6, W, 1, rail, nr);
      for (let rx = 0; rx < W; rx += 4) D.r(rx, top - 6, 1, 6, rail, nr);
      // postes de luz
      for (let lx = 70; lx < W; lx += 180) {
        const pc = '#59616c';
        D.r(lx, top - 20, 1, 20, pc, N(pc, 0.5)); D.r(lx, top - 20, 6, 1, pc, N(pc, 0.5)); D.r(lx + 5, top - 19, 3, 1, '#d8dde3', '#fff2b0');
        L.lamps.push({ x: lx + 6, y: top - 18 });
      }
      L.day = D.cd; L.night = D.cn;
      // mureta da frente (desenhada por cima dos carros)
      const F = dual(W, 6);
      F.r(0, 2, W, 1, P.light(rail, 0.3), nr);
      for (let rx = 2; rx < W; rx += 4) F.r(rx, 2, 1, 4, rail, nr);
      F.r(0, 5, W, 1, T.l, nc);
      L.front = { day: F.cd, night: F.cn };
      return L;
    }

    /* ---------- fileira de árvores ---------- */
    function treeRow() {
      const W = U(900), H = U(80);
      const D = dual(W, H);
      const L = { W, H, fx: 0.45, fy: 0.8, haze: 0.04, fill: ['#4f6b45', '#0b1310'], lights: [], flick: [], boards: [] };
      const R = rng(77);
      const greens = ['#4f8a3f', '#5c9a48', '#3f7537', '#6aa54e', '#477f40'];
      // sebe contínua no pé
      const hedge = P.tones('#4a7a3e');
      D.r(0, H - 8, W, 8, hedge.b, '#0f1a15');
      for (let x = 0; x < W; x += 6) { D.d.ellipse(x + 3, H - 8, 4, 3, hedge.b); D.n.ellipse(x + 3, H - 8, 4, 3, '#0f1a15'); D.d.rect(x + 1, H - 10, 3, 1, hedge.l); }
      const drawTree = (cx, R2, primary) => {
        const r = U(9 + R2() * 8), th = U(10 + R2() * 10), base = H - 4;
        const T = P.tones(pick(R2, greens)), tr = '#5a4230';
        D.r(cx - 1, base - th, 3, th, tr, '#090c10'); D.r(cx + 1, base - th, 1, th, P.dark(tr, 0.3), null);
        D.r(cx - 3, base - th + 2, 2, 1, tr, '#090c10');
        const cy = base - th - r + 3;
        const blobs = [];
        for (let k = 0; k < 6; k++) blobs.push([cx + Math.round((R2() - 0.5) * r * 1.3), cy + Math.round((R2() - 0.6) * r * 0.9), Math.round(r * (0.5 + R2() * 0.35))]);
        // sombra, base e luz (de cima à esquerda)
        for (const [bx, by, rr] of blobs) { D.d.ellipse(bx + 1, by + 1, rr, rr * 0.85, T.d); D.n.ellipse(bx + 1, by + 1, rr, rr * 0.85, '#0c1612'); }
        for (const [bx, by, rr] of blobs) { D.d.ellipse(bx, by, rr - 1, (rr - 1) * 0.85, T.b); D.n.ellipse(bx, by, rr - 1, (rr - 1) * 0.85, '#101d18'); }
        for (const [bx, by, rr] of blobs) { D.d.ellipse(bx - Math.round(rr * 0.3), by - Math.round(rr * 0.35), Math.max(1, rr * 0.45), Math.max(1, rr * 0.35), T.l); D.n.ellipse(bx - Math.round(rr * 0.3), by - Math.round(rr * 0.35), Math.max(1, rr * 0.4), Math.max(1, rr * 0.3), '#18282a'); }
        D.d.clusters(cx - r, cy - r, r * 2, r * 2, T.d, Math.floor(r * 0.8), 2, Math.floor(R2() * 999));
        for (const [bx, by, rr] of blobs) D.d.rect(bx - Math.round(rr * 0.4), by - Math.round(rr * 0.55), 2, 1, T.h);
      };
      const trees = [];
      for (let x = 12; x < W - 20;) { trees.push({ x, s: Math.floor(R() * 99999) }); x += U(22 + R() * 34); }
      for (const t of trees) {
        drawTree(t.x, rng(t.s), true);
        if (t.x < 30) drawTree(t.x + W, rng(t.s), false);
        if (t.x > W - 30) drawTree(t.x - W, rng(t.s), false);
      }
      L.day = D.cd; L.night = D.cn;
      return L;
    }

    const layers = [
      cityLayer({ seed: 3, W: 1100, H: 240, fx: 0.03, fy: 0.1, hMin: 70, hMax: 210, wMin: 16, wMax: 44, gapP: 0.3, pow: 1.3, paint: haze, hz: { c: '#bfd0df', k: 0.35 }, lit: 0.1, haze: 0.55, fill: ['#a9bbcd', '#121a30'], lv: 0 }),
      cityLayer({ seed: 11, W: 1300, H: 300, fx: 0.07, fy: 0.18, hMin: 100, hMax: 225, wMin: 24, wMax: 52, gapP: 0.35, pow: 1.2, paint: office, hz: { c: '#c3d3e0', k: 0.42 }, lit: 0.22, haze: 0.38, fill: ['#9fb0c3', '#10172b'], lv: 0 }),
      cityLayer({ seed: 23, W: 1500, H: 300, fx: 0.15, fy: 0.22, hMin: 70, hMax: 185, wMin: 38, wMax: 78, gapP: 0.45, pow: 1.3, paint: office, hz: { c: '#c3d3e0', k: 0.14 }, lit: 0.3, haze: 0.18, fill: ['#7d8ea6', '#0d1326'], lv: 1 }),
      cityLayer({ seed: 37, W: 1400, H: 190, fx: 0.26, fy: 0.5, hMin: 55, hMax: 140, wMin: 48, wMax: 92, gapP: 0.3, paint: residential, hz: { c: '#c3d3e0', k: 0.05 }, lit: 0.42, haze: 0.07, fill: ['#6e6a6c', '#0b0f1e'], lv: 1 }),
    ];
    const hwy = highway(), trees = treeRow();

    /* ---------- nuvens (máscara de bolhas, colorida por altura) ---------- */
    const CLOUD_TONES = {
      day: ['#ffffff', '#f1f6fb', '#d9e5f0', '#bfd0e2'],
      dusk: ['#ffe6c8', '#f8bfa0', '#d993a0', '#a07498'],
      night: ['#56658a', '#3c4769', '#2c3453', '#232a45'],
    };
    function cloudShape(seed) {
      const R = rng(seed);
      const cw = U(40 + R() * 50), ch = U(16 + R() * 10);
      const [mcv, mc] = mk(cw, ch);
      const p = P.painter(mc);
      const n = 3 + Math.floor(R() * 4);
      for (let k = 0; k < n; k++) {
        const rx = U(6 + R() * 9), cx = Math.round(rx + 1 + (cw - 2 * rx - 2) * (k + 0.5) / n + (R() - 0.5) * 6);
        const ry = Math.round(rx * (0.7 + R() * 0.25)), cy = ch - 3 - ry + U(3) - Math.round((1 - Math.abs(k - (n - 1) / 2) / n) * U(5) * R());
        p.ellipse(cx, Math.max(ry, cy), rx, ry, '#fff');
      }
      p.rect(U(5), ch - U(5), cw - U(10), U(4), '#fff');
      const md = mc.getImageData(0, 0, cw, ch).data;
      const A = (x, y) => x >= 0 && y >= 0 && x < cw && y < ch && md[(y * cw + x) * 4 + 3] > 100;
      const out = {};
      for (const key of Object.keys(CLOUD_TONES)) {
        const tn = CLOUD_TONES[key].map((h) => P.rgb(h));
        const [cv, c] = mk(cw, ch);
        const img = c.createImageData(cw, ch), d = img.data;
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
          if (!A(x, y)) continue;
          let dt = 0; while (dt < 4 && A(x, y - dt - 1)) dt++;
          let db = 0; while (db < 6 && A(x, y + db + 1)) db++;
          let t = 1;
          if (db < 1) t = 3; else if (db < U(3)) t = 2; else if (dt < 2 || !A(x - 1, y)) t = 0;
          const i = (y * cw + x) * 4, cc = tn[t];
          d[i] = cc[0]; d[i + 1] = cc[1]; d[i + 2] = cc[2]; d[i + 3] = 255;
        }
        c.putImageData(img, 0, 0);
        out[key] = cv;
      }
      return out;
    }
    const cloudShapes = [];
    for (let k = 0; k < 7; k++) cloudShapes.push(cloudShape(100 + k * 13));
    const CW = SW * 3;
    const clouds = [];
    for (let k = 0; k < 10; k++) {
      const far = k < 4;
      clouds.push({ sh: cloudShapes[k % cloudShapes.length], x: Math.random() * CW, y: Math.round(SH * (far ? 0.25 + Math.random() * 0.2 : 0.04 + Math.random() * 0.26)), fx: far ? 0.015 : 0.03 + Math.random() * 0.03, v: U(far ? 1.5 : 3 + Math.random() * 4), a: far ? 0.7 : 0.95 });
    }
    clouds.sort((a, b) => a.fx - b.fx);

    /* ---------- estrelas ---------- */
    const stars = [];
    const SR = rng(5);
    for (let k = 0; k < 160; k++) stars.push({ x: SR() * SW * 1.5, y: Math.pow(SR(), 1.4) * SH * 0.85, b: SR(), ph: SR() * 6.28, sp: 0.8 + SR() * 2.5, col: SR() > 0.85 ? '#ffe9b0' : SR() > 0.8 ? '#bcd4ff' : '#ffffff' });

    /* ---------- sol e lua ---------- */
    function bodySprite(r, disc, rim, glow, glow2, moon) {
      const gr = Math.round(r * 2.4), sz = gr * 2 + 2;
      const [cv, c] = mk(sz, sz);
      const p = P.painter(c), m = sz / 2;
      p.ellipse(m, m, gr, gr, glow2); p.ellipse(m, m, Math.round(r * 1.6), Math.round(r * 1.6), glow);
      p.ellipse(m, m, r + 1, r + 1, rim); p.ellipse(m, m, r, r, disc);
      if (moon) {
        p.ellipse(m + 2, m + 1, r - 1, r - 1, P.mix(disc, '#9aa3bf', 0.25)); p.ellipse(m - 1, m - 1, r - 2, r - 2, disc);
        p.rect(m - 3, m - 2, 3, 2, '#c3c9da'); p.rect(m + 2, m + 2, 2, 2, '#c3c9da'); p.rect(m - 1, m + 3, 2, 1, '#c9cfe0'); p.rect(m + 1, m - 4, 2, 1, '#cdd3e2');
      } else {
        p.ellipse(m - Math.round(r * 0.25), m - Math.round(r * 0.25), Math.round(r * 0.55), Math.round(r * 0.55), P.light(disc, 0.6));
      }
      return cv;
    }
    const sunDay = bodySprite(U(9), '#fff6cf', '#ffe08a', 'rgba(255,240,190,0.28)', 'rgba(255,240,200,0.12)');
    const sunDusk = bodySprite(U(10), '#ffcf7a', '#ff9a4e', 'rgba(255,150,80,0.32)', 'rgba(255,130,90,0.14)');
    const moonSp = bodySprite(U(7), '#eef1f8', '#d6dcea', 'rgba(190,210,255,0.14)', 'rgba(170,190,255,0.06)', true);

    /* ---------- carros do viaduto ---------- */
    const CAR_COLS = ['#d64541', '#ecf0f1', '#f1c40f', '#3478c6', '#2c3e50', '#95a5a6', '#e67e22', '#27ae60'];
    function vehicle(type, col, dir, night) {
      const w = type === 'bus' ? 26 : type === 'truck' ? 22 : 15, h = type === 'car' ? 9 : 12;
      return P.sprite('sky-veh-' + type + col + dir + (night ? 'n' : 'd'), w, h, (p, c) => {
        if (dir < 0) { c.translate(w, 0); c.scale(-1, 1); }
        const bc = night ? N(col, 0.62) : col, T = P.tones(bc);
        const gl = night ? '#2a3552' : '#a9cde0', tire = '#22252c';
        if (type === 'car') {
          p.rect(1, 4, 13, 3, T.b); p.rect(1, 4, 13, 1, T.l); p.rect(12, 5, 2, 1, T.d);
          p.rect(4, 2, 7, 2, T.b); p.rect(5, 2, 2, 2, gl); p.rect(8, 2, 2, 2, gl); p.rect(4, 2, 7, 1, T.l);
          p.rect(2, 7, 3, 1, tire); p.rect(10, 7, 3, 1, tire);
        } else if (type === 'bus') {
          p.rect(1, 2, 24, 7, T.b); p.rect(1, 2, 24, 1, T.h); p.rect(1, 8, 24, 1, T.d);
          for (let x = 3; x < 23; x += 4) p.rect(x, 4, 3, 2, night ? '#ffd98a' : gl);
          p.rect(22, 4, 2, 3, gl); p.rect(3, 9, 3, 2, tire); p.rect(19, 9, 3, 2, tire);
        } else {
          const box = night ? N('#e8e4da', 0.65) : '#e8e4da', B = P.tones(box);
          p.rect(1, 1, 14, 8, B.b); p.rect(1, 1, 14, 1, B.h); p.rect(1, 8, 14, 1, B.d);
          p.rect(15, 4, 6, 5, T.b); p.rect(15, 4, 6, 1, T.l); p.rect(18, 5, 2, 2, gl);
          p.rect(3, 9, 3, 2, tire); p.rect(16, 9, 3, 2, tire);
        }
      });
    }
    const cars = [];
    for (let k = 0; k < 16; k++) {
      const dir = k % 2 ? 1 : -1, r = Math.random();
      cars.push({ x: Math.random() * hwy.W, dir, v: U(dir > 0 ? 34 + Math.random() * 18 : 28 + Math.random() * 18), type: r < 0.12 ? 'bus' : r < 0.22 ? 'truck' : 'car', col: CAR_COLS[k % CAR_COLS.length] });
    }

    // canvas de rascunho para tingir camadas (névoa da cor do céu e luz do poente)
    const [scv, sx] = mk(SW, SH);
    let skyCv = null, skyKey = '';

    const sky = {
      t: 0, birds: null, birdT: 4, plane: null, planeT: 15,

      update(dt) {
        this.t += dt;
        for (const cl of clouds) { cl.x += cl.v * dt; if (cl.x > CW) cl.x -= CW; }
        for (const v of cars) { v.x += v.dir * v.v * dt; if (v.x > hwy.W) v.x -= hwy.W; if (v.x < 0) v.x += hwy.W; }
        this.birdT -= dt;
        if (!this.birds && this.birdT <= 0) {
          const dir = Math.random() < 0.5 ? 1 : -1;
          this.birds = { x: dir > 0 ? -40 : SW + 40, y: SH * (0.12 + Math.random() * 0.3), dir, n: 4 + Math.floor(Math.random() * 6), t: 0, v: U(26 + Math.random() * 12) };
        }
        if (this.birds) { const b = this.birds; b.t += dt; b.x += b.dir * b.v * dt; b.y += Math.sin(b.t * 0.9) * 4 * dt; if (b.x < -90 || b.x > SW + 90) { this.birds = null; this.birdT = 8 + Math.random() * 18; } }
        this.planeT -= dt;
        if (!this.plane && this.planeT <= 0) { const dir = Math.random() < 0.5 ? 1 : -1; this.plane = { x: dir > 0 ? -30 : SW + 30, y: SH * (0.06 + Math.random() * 0.14), dir }; }
        if (this.plane) { const p = this.plane; p.x += p.dir * U(20) * dt; if (p.x < -60 || p.x > SW + 60) { this.plane = null; this.planeT = 35 + Math.random() * 45; } }
      },

      /** Degradê do céu em faixas com pontilhado, guardado em cache por minuto. */
      skyCanvas(min, dusk) {
        const key = Math.floor(min) + '';
        if (skyCv && key === skyKey) return skyCv;
        skyKey = key;
        if (!skyCv) skyCv = mk(SW, SH);
        const [cv, c] = skyCv, p = P.painter(c);
        const [a, b] = G.skyAt(min).map(hex);
        const NB = 18, cols = [];
        for (let i = 0; i < NB; i++) {
          const t = i / (NB - 1);
          let col = P.mix(a, b, Math.pow(t, 1.35));
          const g = dusk * Math.pow(Math.max(0, (t - 0.45) / 0.55), 2) * 0.55;
          if (g > 0) col = P.mix(col, '#ffb27a', g);
          cols.push(col);
        }
        for (let i = 0; i < NB; i++) {
          const y0 = Math.round(SH * i / NB), y1 = Math.round(SH * (i + 1) / NB);
          p.rect(0, y0, SW, y1 - y0, cols[i]);
          if (i > 0) { p.dither(0, y0 - 2, SW, 1, cols[i], 0.25); p.dither(0, y0 - 1, SW, 1, cols[i], 0.5); p.dither(0, y0, SW, 1, cols[i - 1], 0.25); }
        }
        return skyCv;
      },

      // base ancorada na linha da rua vista do térreo (H0); camadas longe sobem menos com a câmera
      layerBase(L, gy) { const H0 = Math.round(SH * 0.77); return Math.round(H0 + (gy - H0) * L.fy); },
      offOf(L, cam) { return -Math.round((((cam.x * S * L.fx) % L.W) + L.W) % L.W); },

      /** Camada: dia tingido no rascunho, depois noite por cima com alfa. */
      drawLayer(c, L, cam, gy, night, tint, warm) {
        const off = this.offOf(L, cam), base = this.layerBase(L, gy), y = base - L.H;
        if (y >= SH) return null;
        if (night < 0.999) {
          sx.globalCompositeOperation = 'source-over'; sx.globalAlpha = 1;
          sx.clearRect(0, 0, SW, SH);
          for (let x = off; x < SW; x += L.W) sx.drawImage(L.day, x, y);
          if (L.fill && base < SH) { sx.fillStyle = L.fill[0]; sx.fillRect(0, base, SW, SH - base); }
          sx.globalCompositeOperation = 'source-atop';
          const ha = L.haze * 0.6;
          if (ha > 0.01) { sx.globalAlpha = ha; sx.fillStyle = tint; sx.fillRect(0, 0, SW, SH); }
          if (warm > 0.01) { sx.globalAlpha = warm * (0.16 + L.haze * 0.3); sx.fillStyle = '#ff8a5a'; sx.fillRect(0, 0, SW, SH); }
          sx.globalCompositeOperation = 'source-over'; sx.globalAlpha = 1;
          c.drawImage(scv, 0, 0);
        }
        if (night > 0.001) {
          c.globalAlpha = night;
          for (let x = off; x < SW; x += L.W) c.drawImage(L.night, x, y);
          if (L.fill && base < SH) { c.fillStyle = L.fill[1]; c.fillRect(0, base, SW, SH - base); }
          c.globalAlpha = 1;
        }
        this.drawLayerFx(c, L, off, y, night);
        return { off, y, base };
      },

      /** Luzes de antena piscando e janelas que acendem/apagam. */
      drawLayerFx(c, L, off, y, night) {
        const t = this.t;
        for (let x0 = off; x0 < SW; x0 += L.W) {
          for (const l of L.lights) {
            const X = x0 + l.x, Y = y + l.y;
            if (X < -3 || X > SW + 3 || Y < -3 || Y > SH) continue;
            const on = Math.sin(t * l.sp + l.ph) > 0.55;
            if (!on) continue;
            c.globalAlpha = 0.45 + night * 0.55;
            c.fillStyle = '#ff4a3a'; c.fillRect(X, Y, 1, 1);
            if (night > 0.3) { c.globalAlpha = night * 0.35; c.fillRect(X - 1, Y, 3, 1); c.fillRect(X, Y - 1, 1, 3); }
          }
          if (night > 0.2) {
            for (let i = 0; i < L.flick.length; i++) {
              const f = L.flick[i], X = x0 + f.x;
              if (X < -6 || X > SW) continue;
              if (P.hash(Math.floor((t + f.ph) / f.per), i, 7) < 0.5) continue;
              c.globalAlpha = night; c.fillStyle = f.col; c.fillRect(X, y + f.y, f.w, f.h);
            }
            for (const b of L.boards) {
              const X = x0 + b.x;
              if (X > SW || X + b.w < 0) continue;
              c.globalAlpha = night * 0.18; c.fillStyle = '#fff3c0'; c.fillRect(X, y + b.y, b.w, b.h);
            }
          }
          c.globalAlpha = 1;
        }
      },

      drawClouds(c, cam, list, dusk, night) {
        for (const cl of list) {
          const sp = cl.sh.day;
          let x = Math.round(((cl.x - cam.x * S * cl.fx) % CW + CW) % CW) - sp.width;
          if (x > SW) continue;
          c.globalAlpha = cl.a; c.drawImage(sp, x, cl.y);
          if (dusk > 0.02) { c.globalAlpha = cl.a * Math.min(1, dusk * 1.3); c.drawImage(cl.sh.dusk, x, cl.y); }
          if (night > 0.02) { c.globalAlpha = cl.a * night * 0.85; c.drawImage(cl.sh.night, x, cl.y); }
        }
        c.globalAlpha = 1;
      },

      drawBodies(c, min, night, dusk) {
        const m = ((min % 1440) + 1440) % 1440, VW = G.VIEW_W, VH = G.VIEW_H;
        // mesma trajetória do código antigo (06:00–18:30 sol, 19:00–06:00 lua)
        const sunT = (m - 360) / (1110 - 360);
        if (sunT > -0.05 && sunT < 1.05) {
          const x = Math.round((VW * 0.12 + sunT * VW * 0.76) * S), y = Math.round((VH * 0.85 - Math.sin(Math.PI * G.util.clamp(sunT, 0, 1)) * VH * 0.68) * S);
          c.drawImage(sunDay, x - (sunDay.width >> 1), y - (sunDay.height >> 1));
          const k = Math.min(1, dusk * 1.4);
          if (k > 0.02) { c.globalAlpha = k; c.drawImage(sunDusk, x - (sunDusk.width >> 1), y - (sunDusk.height >> 1)); c.globalAlpha = 1; }
        }
        const mm = m < 360 ? m + 1440 : m;
        const moonT = (mm - 1140) / (1800 - 1140);
        if (moonT > 0 && moonT < 1) {
          const x = Math.round((VW * 0.12 + moonT * VW * 0.76) * S), y = Math.round((VH * 0.85 - Math.sin(Math.PI * moonT) * VH * 0.62) * S);
          c.globalAlpha = Math.max(0.35, night); c.drawImage(moonSp, x - (moonSp.width >> 1), y - (moonSp.height >> 1)); c.globalAlpha = 1;
        }
      },

      drawStars(c, cam, night) {
        if (night < 0.05) return;
        const off = cam.x * S * 0.01, W = SW * 1.5;
        for (const s of stars) {
          const x = Math.round(((s.x - off) % W + W) % W);
          if (x >= SW) continue;
          const tw = 0.55 + 0.45 * Math.sin(this.t * s.sp + s.ph);
          c.globalAlpha = night * tw * (0.4 + s.b * 0.6);
          c.fillStyle = s.col; c.fillRect(x, Math.round(s.y), 1, 1);
          if (s.b > 0.93) { c.globalAlpha *= 0.5; c.fillRect(x - 1, Math.round(s.y), 3, 1); c.fillRect(x, Math.round(s.y) - 1, 1, 3); }
        }
        c.globalAlpha = 1;
      },

      drawPlane(c, night) {
        const p = this.plane;
        if (!p) return;
        const x = Math.round(p.x), y = Math.round(p.y), d = p.dir;
        const body = night > 0.5 ? '#3a4260' : '#eef1f5', sh = night > 0.5 ? '#2a3048' : '#b9c2cf';
        const X = (o) => (d > 0 ? x + o : x - o);
        const R = (o, yy, w, h, col) => { c.fillStyle = col; c.fillRect(d > 0 ? x + o : x - o - w + 1, y + yy, w, h); };
        if (night < 0.6) { // rastro
          c.globalAlpha = 0.35 * (1 - night); c.fillStyle = '#ffffff';
          c.fillRect(d > 0 ? x - 50 : x + 1, y + 1, 50, 1);
          c.globalAlpha = 0.18 * (1 - night); c.fillRect(d > 0 ? x - 90 : x + 50, y + 1, 40, 1);
          c.globalAlpha = 1;
        }
        R(0, 0, 13, 2, body); R(0, 2, 13, 1, sh); R(12, 1, 2, 1, body);
        R(0, -3, 2, 3, body); R(1, -1, 3, 1, sh); R(5, 2, 4, 1, sh); R(6, 3, 3, 1, sh);
        for (let k = 3; k < 11; k += 2) R(k, 0, 1, 1, night > 0.5 ? '#ffd98a' : '#6a7d94');
        if (Math.sin(this.t * 7) > 0.3) { c.fillStyle = '#ff4a4a'; c.fillRect(X(0), y - 3, 1, 1); }
        if (Math.sin(this.t * 7 + 2) > 0.5) { c.fillStyle = '#ffffff'; c.fillRect(X(7), y + 3, 1, 1); }
      },

      drawBirds(c, night) {
        const b = this.birds;
        if (!b || night > 0.85) return;
        const col = night > 0.4 ? '#1c2030' : '#343b4a';
        c.fillStyle = col;
        for (let i = 0; i < b.n; i++) {
          const k = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
          const x = Math.round(b.x - b.dir * k * 8 + Math.sin(b.t * 1.3 + i) * 1.5), y = Math.round(b.y + side * k * 4 + Math.sin(b.t * 2 + i * 1.7));
          const up = Math.sin(b.t * 11 + i * 1.9) > 0;
          if (up) { c.fillRect(x - 2, y - 1, 1, 1); c.fillRect(x - 1, y, 1, 1); c.fillRect(x, y, 1, 1); c.fillRect(x + 1, y, 1, 1); c.fillRect(x + 2, y - 1, 1, 1); }
          else { c.fillRect(x - 2, y + 1, 1, 1); c.fillRect(x - 1, y, 3, 1); c.fillRect(x + 2, y + 1, 1, 1); }
        }
      },

      drawHighway(c, cam, gy, night, tint, warm) {
        const r = this.drawLayer(c, hwy, cam, gy, night, tint, warm);
        if (!r) return;
        const { off, y } = r;
        const road = y + hwy.deck;
        // carros: pista de trás (indo para a esquerda) um pouco acima
        for (const lane of [-1, 1]) {
          for (const v of cars) {
            if (v.dir !== lane) continue;
            const spD = vehicle(v.type, v.col, v.dir, false);
            const yy = road - spD.height + (lane < 0 ? -1 : 1);
            for (let x0 = off; x0 < SW + hwy.W; x0 += hwy.W) {
              const x = Math.round(x0 + v.x);
              if (x < -30 || x > SW + 4) continue;
              if (night < 0.999) c.drawImage(spD, x, yy);
              if (night > 0.001) { c.globalAlpha = night; c.drawImage(vehicle(v.type, v.col, v.dir, true), x, yy); c.globalAlpha = 1; }
              if (night > 0.25) {
                const w = spD.width, ly = yy + spD.height - 4;
                const fx = v.dir > 0 ? x + w - 2 : x + 1, bx = v.dir > 0 ? x + 1 : x + w - 2;
                c.fillStyle = '#fff6c8'; c.fillRect(fx, ly, 1, 1);
                c.fillStyle = '#ff3b3b'; c.fillRect(bx, ly, 1, 1);
                c.globalAlpha = night * 0.28; c.fillStyle = '#fff2b0';
                c.fillRect(v.dir > 0 ? fx + 1 : fx - 8, ly - 1, 8, 2);
                c.globalAlpha = 1;
              }
            }
          }
        }
        // mureta da frente
        const fy = road - 4;
        for (let x0 = off; x0 < SW; x0 += hwy.W) {
          if (night < 0.999) c.drawImage(hwy.front.day, x0, fy);
          if (night > 0.001) { c.globalAlpha = night; c.drawImage(hwy.front.night, x0, fy); c.globalAlpha = 1; }
        }
        // halos dos postes à noite
        if (night > 0.2) {
          for (let x0 = off; x0 < SW; x0 += hwy.W) for (const l of hwy.lamps) {
            const X = x0 + l.x, Y = y + l.y;
            if (X < -20 || X > SW + 20) continue;
            c.globalAlpha = night * 0.12; c.fillStyle = '#ffe9a8';
            c.fillRect(X - 6, Y - 2, 12, 5); c.fillRect(X - 3, Y + 3, 6, hwy.deck - l.y - 3);
            c.globalAlpha = night * 0.25; c.fillRect(X - 2, Y - 1, 4, 3);
          }
          c.globalAlpha = 1;
        }
      },

      draw(c, cam, min, night) {
        const dusk = duskAt(min);
        const [, bot] = G.skyAt(min);
        const tint = hex(bot);
        const warm = dusk * (1 - night * 0.6);
        G.hi(c, (Sc) => {
          const gy = (38 * G.TILE - cam.y) * Sc;
          c.drawImage(this.skyCanvas(min, dusk)[0], 0, 0);
          this.drawStars(c, cam, night);
          this.drawBodies(c, min, night, dusk);
          this.drawClouds(c, cam, clouds.slice(0, 4), dusk, night);
          this.drawPlane(c, night);
          this.drawLayer(c, layers[0], cam, gy, night, tint, warm);
          this.drawClouds(c, cam, clouds.slice(4), dusk, night);
          this.drawLayer(c, layers[1], cam, gy, night, tint, warm);
          this.drawBirds(c, night);
          this.drawLayer(c, layers[2], cam, gy, night, tint, warm);
          this.drawLayer(c, layers[3], cam, gy, night, tint, warm);
          this.drawHighway(c, cam, gy, night, tint, warm);
          this.drawLayer(c, trees, cam, gy, night, tint, warm);
        });
      },
    };
    return sky;
  }

  G.ArtSky = { create };
})(window.VG = window.VG || {});

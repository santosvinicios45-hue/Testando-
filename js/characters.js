/* =====================================================================
 * Personagens em pixel art (estilo "chibi" de Stardew/Terraria).
 * Cada quadro é desenhado uma vez num canvas pequeno, recebe contorno
 * automático e sombreamento, e fica em cache. Depois só é copiado.
 *
 * Espaço do sprite (virado para a direita): canvas CW×CH, pés na linha
 * FY e centro em X0. A caixa de colisão (10×26) fica com a base em FY.
 * ===================================================================== */
(function (G) {
  'use strict';

  const CW = 28, CH = 48, X0 = 13, FY = 36;
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
  // sombra puxa para um roxo frio e luz para um creme quente (como nos jogos de referência)
  const dark = (hex, k) => mix(hex, '#24142e', k === undefined ? 0.28 : k);
  const light = (hex, k) => mix(hex, '#fff3d6', k === undefined ? 0.2 : k);

  /* ---------------- poses ---------------- */
  /**
   * Converte estado/tempo em uma pose discreta (o quadro).
   * Campos: bob (desce +), lean (frente +), legs, arms, eyes.
   */
  function poseFor(o) {
    const st = o.state || 'idle';
    const t = o.t || 0;
    const p = { id: st, bob: 0, lean: 0, legs: 'stand', fl: 0, bl: 0, fLift: 0, bLift: 0, fa: 'down', ba: 'down', fad: 0, bad: 0, eyes: 'open', mouth: 0 };
    if (st === 'walk' && o.run) {
      const f = Math.floor(t * 9) % 6; p.id = 'run' + f;
      const s = Math.sin(f / 6 * Math.PI * 2);
      p.fl = Math.round(s * 3); p.bl = -p.fl;
      p.fLift = s > 0.3 ? 2 : 0; p.bLift = s < -0.3 ? 2 : 0;
      p.fa = 'run'; p.ba = 'run'; p.fad = -Math.round(s * 2); p.bad = -p.fad;
      p.bob = Math.abs(s) < 0.5 ? -1 : 0; p.lean = 1;
    } else if (st === 'walk') {
      const f = Math.floor(t * 10.5) % 6; p.id = 'walk' + f;
      const s = Math.sin(f / 6 * Math.PI * 2);
      p.fl = Math.round(s * 2); p.bl = -p.fl;
      p.fLift = s > 0.5 ? 1 : 0; p.bLift = s < -0.5 ? 1 : 0;
      p.fa = 'swing'; p.ba = 'swing'; p.fad = -Math.round(s * 1.5); p.bad = -p.fad;
      p.bob = Math.abs(s) < 0.5 ? -1 : 0;
    } else if (st === 'idle') {
      const f = Math.floor(t * 1.6 + (o.seed || 0)) % 2; p.id = 'idle' + f;
      p.bob = f;  // respiração: desce 1 px a cada ~0,6 s
    } else if (st === 'jump') {
      p.legs = 'tuck'; p.fa = 'up'; p.ba = 'back';
    } else if (st === 'fall') {
      const f = Math.floor(t * 8) % 2; p.id = 'fall' + f;
      p.legs = 'apart'; p.fa = f ? 'up' : 'out'; p.ba = f ? 'out' : 'up';
    } else if (st === 'fly') {
      const f = Math.floor(t * 4) % 2; p.id = 'fly' + f;
      p.legs = 'dangle'; p.fa = 'forwardUp'; p.ba = 'back'; p.lean = 1; p.bob = f ? 0 : -1;
    } else if (st === 'sit') {
      p.legs = 'sit'; p.bob = 6;
    } else if (st === 'sitFloor') {
      p.legs = 'sitFloor'; p.bob = 9; p.fa = 'floor'; p.ba = 'floor';
    } else if (st === 'rise') {
      p.legs = 'crouch'; p.bob = 3; p.fa = 'knee';
    } else if (st === 'stun') {
      const f = Math.floor(t * 6) % 2; p.id = 'stun' + f;
      p.fa = 'out'; p.ba = 'out'; p.eyes = 'dizzy'; p.lean = f ? 1 : -1;
    } else if (st === 'sweep') {
      const f = Math.floor(t * 7) % 2; p.id = 'sweep' + f;
      p.fa = 'sweep'; p.ba = 'sweep'; p.lean = 1; p.fad = f;
    }
    if (o.carrying && p.fa !== 'sweep') p.fa = 'hold';
    if (o.handOnBag) p.fa = 'bag';
    if (o.gesture) { p.fa = 'wave'; p.fad = o.gesture; }
    if (o.aim) p.fa = 'none';
    if (o.blink || o.sleepy || (p.eyes === 'open' && Math.sin(t * 0.9 + (o.seed || 0) * 1.7) > 0.985)) p.eyes = 'closed';
    return p;
  }

  /* ---------------- desenho de um quadro ---------------- */
  function paint(cx, o, p) {
    const pal = o.pal || G.PAL_V;
    const kid = !!o.kid;
    const skin = pal.skin, skinD = dark(skin, 0.22), skinL = light(skin, 0.18);
    const hair = pal.hair, hairD = dark(hair, 0.3), hairL = light(hair, 0.25);
    const shirt = pal.shirt, shirtD = dark(shirt, 0.3), shirtL = light(shirt, 0.2);
    const pants = pal.pants, pantsD = dark(pants, 0.3);
    const shoe = pal.shoe, shoeD = dark(shoe, 0.35);
    const P = (x, y, w, h, col) => { cx.fillStyle = col; cx.fillRect(x, y, w, h); };

    const legH = kid ? 4 : 8, torsoH = kid ? 6 : 8, headH = 10;
    const b = p.bob;
    const legTop = FY - legH;                 // linha onde as pernas começam (em pé)
    const tT = legTop - torsoH + b;           // topo do tronco
    const hT = tT - headH;                    // topo da cabeça
    const L = p.lean;                         // inclinação do tronco/cabeça
    const hx = X0 - 5 + L;                    // cabeça: x hx..hx+9

    /* ----- braço de trás ----- */
    arm(p.ba, p.bad, true);

    /* ----- pernas ----- */
    const hip = tT + torsoH;                  // linha logo abaixo do tronco
    if (p.legs === 'stand') {
      leg(X0 - 3 + p.bl, hip, FY - hip - 2 - p.bLift, pantsD, shoeD, p.bLift);
      if (!o.dress) leg(X0 + p.fl, hip, FY - hip - 2 - p.fLift, pants, shoe, p.fLift);
      else leg(X0 + p.fl, hip, FY - hip - 2 - p.fLift, pants, shoe, p.fLift);
    } else if (p.legs === 'tuck') {
      P(X0 - 3, hip, 3, 4, pantsD); P(X0 - 4, hip + 4, 3, 2, pantsD); P(X0 - 5, hip + 5, 4, 2, shoeD);
      P(X0, hip, 4, 3, pants); P(X0 + 2, hip + 2, 3, 3, pants); P(X0 + 2, hip + 5, 4, 2, shoe);
    } else if (p.legs === 'apart') {
      P(X0 - 4, hip, 3, 6, pantsD); P(X0 - 6, hip + 6, 4, 2, shoeD);
      P(X0 + 1, hip, 3, 6, pants); P(X0 + 2, hip + 6, 4, 2, shoe);
    } else if (p.legs === 'dangle') {
      P(X0 - 3, hip, 3, 6, pantsD); P(X0 - 5, hip + 5, 3, 2, shoeD);
      P(X0, hip, 3, 6, pants); P(X0 - 2, hip + 6, 4, 2, shoe);
    } else if (p.legs === 'sit') {
      // coxas para a frente, canelas para baixo
      P(X0 - 2, hip - 1, 8, 3, pantsD); P(X0 - 1, hip - 2, 8, 3, pants);
      P(X0 + 5, hip + 1, 3, 6, pants); P(X0 + 5, hip + 7, 5, 2, shoe);
    } else if (p.legs === 'sitFloor') {
      P(X0 - 2, hip - 2, 11, 3, pantsD); P(X0 - 1, hip - 3, 11, 2, pants);
      P(X0 + 9, hip - 5, 2, 5, shoe); P(X0 + 10, hip - 4, 1, 4, shoeD);
    } else if (p.legs === 'crouch') {
      P(X0 - 3, hip, 3, 2, pantsD); P(X0 - 3, hip + 2, 3, FY - hip - 4, pantsD); P(X0 - 4, FY - 2, 4, 2, shoeD);
      P(X0, hip - 1, 6, 3, pants); P(X0 + 3, hip + 2, 3, FY - hip - 4, pants); P(X0 + 3, FY - 2, 4, 2, shoe);
    }

    /* ----- tronco ----- */
    const tx = X0 - 4 + (L > 0 ? 1 : 0);
    if (o.dress) {
      // saia em trapézio por cima das pernas
      const sk = o.dress, skD = dark(sk, 0.3);
      P(tx, tT, 8, torsoH, shirt); P(tx, tT, 1, torsoH, shirtD); P(tx + 7, tT + 1, 1, torsoH - 1, shirtL);
      for (let i = 0; i < 6; i++) { const w = 8 + Math.floor(i / 2) * 2; P(X0 - w / 2, tT + torsoH + i - 1, w, 1, i === 5 ? skD : sk); }
      P(X0 - 4, tT + torsoH + 1, 1, 4, skD);
    } else if (o.shirtless) {
      P(tx, tT, 8, torsoH, skin); P(tx, tT, 1, torsoH, skinD); P(tx + 2, tT + 2, 2, 1, skinD); P(tx + 5, tT + 2, 2, 1, skinD);
      P(tx, tT + torsoH - 2, 8, 3, '#f1f1f1'); P(tx, tT + torsoH - 2, 8, 1, '#d9d9d9');   // toalha
    } else {
      P(tx, tT, 8, torsoH, shirt);
      P(tx, tT, 2, torsoH, shirtD);                       // costas na sombra
      P(tx + 6, tT + 1, 1, torsoH - 3, shirtL);           // luz na frente
      P(tx, tT + torsoH - 1, 8, 1, shirtD);               // barra
      P(tx + 4, tT, 3, 1, skinD); P(tx + 5, tT + 1, 1, 1, skinD);   // gola
      if (o.jacket) { P(tx + 4, tT + 1, 1, torsoH - 1, dark(shirt, 0.45)); }
      if (o.apron) { P(tx + 3, tT + 2, 5, torsoH - 1, '#f4f1ea'); P(tx + 3, tT + 2, 1, torsoH - 1, '#d8d3c8'); P(tx + 2, tT + 3, 1, 1, '#d8d3c8'); }
      if (!o.dress && !kid) P(tx, tT + torsoH - 1, 8, 1, pal.belt || dark(pants, 0.4));
      if (o.stripe) P(tx, tT + 3, 8, 2, o.stripe);
    }

    /* ----- cabeça ----- */
    const style = o.hairStyle || 'short';
    if (style === 'long') { P(hx - 1, hT + 3, 4, 10, hairD); P(hx - 1, hT + 3, 1, 9, dark(hair, 0.45)); }
    if (style === 'bun') { P(hx - 2, hT - 2, 5, 5, hair); P(hx - 1, hT - 2, 3, 1, hairL); P(hx - 2, hT + 1, 1, 2, hairD); }
    // rosto
    P(hx + 1, hT, 8, headH, skin); P(hx, hT + 1, 10, headH - 2, skin);
    P(hx + 1, hT + headH - 1, 8, 1, skinD);              // queixo
    P(hx + 8, hT + 2, 1, 3, skinL);                      // luz na testa
    // cabelo
    if (style === 'short') {
      P(hx + 1, hT - 1, 8, 1, hair); P(hx, hT, 10, 3, hair); P(hx, hT + 3, 4, 3, hair); P(hx, hT + 6, 2, 2, hair);
      P(hx + 5, hT + 3, 2, 1, hair); P(hx + 8, hT + 3, 1, 1, hair);             // franja picotada
      P(hx + 2, hT - 1, 4, 1, hairL); P(hx + 6, hT, 2, 1, hairL);                // brilho
      P(hx, hT + 4, 1, 4, hairD); P(hx + 9, hT, 1, 2, hairD);
    } else if (style === 'long') {
      P(hx + 1, hT - 1, 8, 1, hair); P(hx, hT, 10, 3, hair); P(hx, hT + 3, 3, 7, hair); P(hx + 6, hT + 3, 3, 1, hair);
      P(hx + 2, hT - 1, 5, 1, hairL); P(hx + 1, hT + 4, 1, 6, hairD);
    } else if (style === 'bun') {
      P(hx + 1, hT - 1, 8, 1, hair); P(hx, hT, 10, 2, hair); P(hx, hT + 2, 3, 4, hair);
      P(hx + 3, hT - 1, 4, 1, hairL); P(hx, hT + 3, 1, 3, hairD);
    } else if (style === 'helmet') {
      const hc = o.helmet || '#c0392b';
      P(hx, hT - 2, 10, 7, hc); P(hx - 1, hT, 12, 5, hc); P(hx + 1, hT - 2, 6, 1, light(hc, 0.35));
      P(hx + 6, hT + 3, 5, 3, '#2b2f38'); P(hx + 7, hT + 3, 3, 1, '#6c7a8c'); P(hx - 1, hT + 4, 3, 1, dark(hc, 0.3));
    } else if (style === 'cap') {
      const cc = o.cap || '#f1efe8';
      P(hx, hT - 1, 10, 3, cc); P(hx + 9, hT + 1, 3, 1, cc); P(hx + 2, hT - 1, 4, 1, light(cc, 0.3));
      P(hx, hT + 2, 3, 3, hair); P(hx, hT + 1, 10, 1, dark(cc, 0.2));
    } else if (style === 'bald') {
      P(hx, hT + 2, 2, 4, hair); P(hx + 3, hT, 4, 1, skinL);
    }
    // orelha, olhos, boca
    P(hx + 3, hT + 5, 1, 2, skinD);
    const ey = hT + 5;
    if (p.eyes === 'closed') { P(hx + 5, ey + 1, 2, 1, '#3a2228'); P(hx + 8, ey + 1, 1, 1, '#3a2228'); }
    else if (p.eyes === 'dizzy') { P(hx + 5, ey, 1, 1, '#3a2228'); P(hx + 6, ey + 1, 1, 1, '#3a2228'); P(hx + 8, ey, 1, 2, '#3a2228'); }
    else {
      P(hx + 5, ey, 2, 2, '#ffffff'); P(hx + 6, ey, 1, 2, pal.eye || '#2a1a22');   // olho de trás
      P(hx + 8, ey, 1, 2, pal.eye || '#2a1a22');                                  // olho da frente
      if (style !== 'helmet' && style !== 'cap') P(hx + 5, ey - 2, 2, 1, hairD);   // sobrancelha
    }
    if (style !== 'helmet') {
      P(hx + 8, ey + 3, 1, 1, mix(skin, '#e05a5a', 0.35));   // bochecha
      P(hx + 6, ey + 3, 2, 1, dark(skin, 0.4));                // boca
    }
    if (o.beard) P(hx + 4, hT + headH - 3, 6, 3, o.beard);
    if (o.glasses) { P(hx + 4, ey - 1, 6, 1, '#20232a'); P(hx + 4, ey, 1, 2, '#20232a'); P(hx + 7, ey, 1, 2, '#20232a'); }

    /* ----- braço da frente ----- */
    arm(p.fa, p.fad, false);

    function leg(x, y, h, col, sh, lift) {
      P(x, y, 3, Math.max(1, h), col);
      P(x, y, 1, Math.max(1, h), dark(col, 0.25));
      P(x, y + h, 4, 2, sh); P(x, y + h + 1, 4, 1, dark(sh, 0.25));
      if (lift) P(x + 3, y + h, 1, 1, sh);
    }
    function arm(mode, d, back) {
      if (mode === 'none') return;
      const sc = back ? shirtD : shirt, sk = back ? skinD : skin;
      const ax = back ? X0 - 4 + (L > 0 ? 1 : 0) : X0 + 1 + (L > 0 ? 1 : 0), ay = tT + 1;
      const sleeve = o.shirtless ? sk : sc;
      switch (mode) {
        case 'down': P(ax, ay, 2, 6, sleeve); P(ax, ay + 6, 2, 2, sk); break;
        case 'swing': P(ax + d, ay, 2, 6, sleeve); P(ax + d * 2, ay + 5, 2, 2, sk); break;
        case 'run': P(ax + d, ay, 2, 4, sleeve); P(ax + d * 2 + (d > 0 ? 1 : 0), ay + 3, 2, 3, sleeve); P(ax + d * 2 + (d > 0 ? 1 : 0), ay + 6, 2, 1, sk); break;
        case 'up': P(ax, ay - 6, 2, 7, sleeve); P(ax, ay - 8, 2, 2, sk); break;
        case 'out': P(ax + (back ? -3 : 1), ay, 4, 2, sleeve); P(ax + (back ? -5 : 5), ay - 1, 2, 2, sk); break;
        case 'back': P(ax - 2, ay, 2, 5, sleeve); P(ax - 3, ay + 4, 2, 2, sk); break;
        case 'forwardUp': P(ax + 1, ay - 2, 5, 2, sleeve); P(ax + 6, ay - 4, 2, 3, sk); break;
        case 'hold': P(ax, ay, 2, 3, sleeve); P(ax + 1, ay + 2, 3, 2, sleeve); P(ax + 4, ay + 2, 2, 2, sk); break;
        case 'sweep': P(ax + 1, ay + 1, 4, 2, sleeve); P(ax + 4 + d, ay + 3, 2, 2, sk); break;
        case 'bag': P(ax, ay, 2, 5, sleeve); P(ax - 1, ay + 5, 2, 2, sk); break;
        case 'wave': P(ax, ay - d, 2, 4, sleeve); P(ax + 1, ay - d - 3, 2, 3, sleeve); P(ax + 1, ay - d - 5, 2, 2, sk); break;
        case 'floor': P(ax - (back ? 3 : 0), ay + 2, 2, 5, sleeve); P(ax - (back ? 3 : 0), ay + 7, 2, 2, sk); break;
        case 'knee': P(ax + 1, ay + 1, 2, 4, sleeve); P(ax + 3, ay + 4, 2, 2, sk); break;
        default: break;
      }
    }
  }

  /** Contorno de 1 px: cada pixel vazio vizinho de um pixel cheio vira a cor do vizinho bem escurecida. */
  function outline(cx, CW_, CH_) {
    const CW = CW_ || 28, CH = CH_ || 48;
    const img = cx.getImageData(0, 0, CW, CH), d = img.data;
    const src = new Uint8ClampedArray(d);
    const A = (x, y) => (x < 0 || y < 0 || x >= CW || y >= CH) ? 0 : src[(y * CW + x) * 4 + 3];
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const i = (y * CW + x) * 4;
      if (src[i + 3]) continue;
      let n = -1;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (A(x + ox, y + oy)) { n = ((y + oy) * CW + x + ox) * 4; break; }
      if (n < 0) continue;
      d[i] = src[n] * 0.28 + 14; d[i + 1] = src[n + 1] * 0.22 + 8; d[i + 2] = src[n + 2] * 0.28 + 20; d[i + 3] = 235;
    }
    cx.putImageData(img, 0, 0);
  }

  function makeCanvas() {
    const cv = document.createElement('canvas');
    cv.width = CW; cv.height = CH;
    return cv;
  }

  function keyOf(o, p, f) {
    const pal = o.pal || G.PAL_V;
    return [p.id, p.fa, p.fad, p.ba, p.eyes, f, pal.skin, pal.hair, pal.shirt, pal.pants, pal.shoe, pal.belt, pal.eye,
      o.hairStyle || '', o.dress || '', o.apron ? 1 : 0, o.shirtless ? 1 : 0, o.kid ? 1 : 0, o.beard || '', o.glasses ? 1 : 0,
      o.helmet || '', o.cap || '', o.jacket ? 1 : 0, o.stripe || ''].join('|');
  }

  /** Quadro (canvas) já com contorno, virado para f. */
  function frame(o) {
    const p = poseFor(o);
    const f = o.facing >= 0 ? 1 : -1;
    const k = keyOf(o, p, f);
    let cv = cache.get(k);
    if (cv) return cv;
    const base = makeCanvas();
    const bx = base.getContext('2d');
    paint(bx, o, p);
    outline(bx);
    if (f > 0) cv = base;
    else {
      cv = makeCanvas();
      const fx = cv.getContext('2d');
      fx.translate(CW, 0); fx.scale(-1, 1); fx.drawImage(base, 0, 0);
    }
    if (cache.size > 1500) cache.clear();
    cache.set(k, cv);
    return cv;
  }

  /**
   * Desenha um personagem com o centro dos pés em (cx, feetY).
   * o: { facing, state, t, pal, hairStyle, dress, apron, shirtless, kid, run, carrying,
   *      handOnBag, gesture, aim, glow, glowColor, flash, landT, seed, beard, glasses }
   */
  function draw(c, cx, feetY, o) {
    const st = o.state || 'idle';
    if (st === 'lie' || st === 'sleep' || st === 'collapse') return drawLying(c, cx, feetY, o);
    const cv = frame(o);
    const f = o.facing >= 0 ? 1 : -1;
    const ox = Math.round(cx) - (f > 0 ? X0 : CW - X0) , oy = Math.round(feetY) - FY + (o.landT > 0 ? 1 : 0);
    c.drawImage(cv, ox, oy);
    if (o.aim) aimArm(c, cx, feetY, o, f);
    if (o.flash > 0) {
      c.save(); c.globalAlpha = Math.min(0.8, o.flash); c.globalCompositeOperation = 'lighter';
      c.drawImage(cv, ox, oy); c.drawImage(cv, ox, oy); c.restore();
    }
  }

  /** Braço que aponta para o cursor (desenhado por cima, com contorno). */
  function aimArm(c, cx, feetY, o, f) {
    const pal = o.pal || G.PAL_V;
    const p = poseFor(o);
    const legH = o.kid ? 4 : 8, torsoH = o.kid ? 6 : 8;
    const sx = Math.round(cx) + f * 1, sy = Math.round(feetY) - legH - torsoH + p.bob + 2;
    let ax = o.aim.x - sx, ay = o.aim.y - sy;
    const d = Math.hypot(ax, ay) || 1; ax /= d; ay /= d;
    const R = G.R;
    for (let i = 0; i < 7; i++) R(c, sx + ax * i - 2, sy + ay * i - 2, 4, 4, '#1c1424');
    for (let i = 0; i < 7; i++) R(c, sx + ax * i - 1, sy + ay * i - 1, 2, 2, i < 5 ? pal.shirt : pal.skin);
    if (o.glow > 0) {
      c.save(); c.globalAlpha = 0.45 * o.glow; c.globalCompositeOperation = 'lighter';
      R(c, sx + ax * 7 - 3, sy + ay * 7 - 3, 6, 6, o.glowColor || '#9fd8ff'); c.restore();
    }
  }

  /** Deitado: o quadro em pé girado 90° (pixel a pixel, sem borrar). Base em feetY. */
  function drawLying(c, cx, feetY, o) {
    const f = o.facing >= 0 ? 1 : -1;
    const closed = o.state !== 'lie';
    const cv = frame(Object.assign({}, o, { state: 'idle', t: 0, seed: 0, facing: f, blink: closed, aim: null, carrying: false, gesture: 0, handOnBag: 0 }));
    c.save();
    // girado 90°: cabeça do lado esquerdo quando f>0 (direito quando f<0), rosto para cima
    c.translate(Math.round(cx), Math.round(feetY));
    if (f > 0) { c.rotate(-Math.PI / 2); c.drawImage(cv, -6, -22); }
    else { c.rotate(Math.PI / 2); c.drawImage(cv, -(CW - 7), -22); }
    c.restore();
    if (o.state === 'lie') {
      // bolsa de gelo na testa
      const hx = Math.round(cx) + (f > 0 ? -12 : 6);
      G.R(c, hx, Math.round(feetY) - 14, 6, 3, '#cfeaff'); G.R(c, hx, Math.round(feetY) - 14, 6, 1, '#ffffff');
    }
  }

  /** Sprite genérico em cache: fn(ctx, P) pinta em (0..w, 0..h); recebe contorno automático. */
  const misc = new Map();
  function cached(key, w, h, fn, noOutline) {
    let cv = misc.get(key);
    if (cv) return cv;
    cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d');
    fn(cx, (x, y, ww, hh, col) => { cx.fillStyle = col; cx.fillRect(x, y, ww, hh); });
    if (!noOutline) outline(cx, w, h);
    if (misc.size > 600) misc.clear();
    misc.set(key, cv);
    return cv;
  }

  G.Characters = { cached, draw, frame, poseFor, mix, dark, light, CW, CH, X0, FY, _cache: cache };
})(window.VG = window.VG || {});

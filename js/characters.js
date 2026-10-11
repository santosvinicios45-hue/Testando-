/* =====================================================================
 * Personagens em pixel art com proporções realistas (cabeça ≈ 1/4,5 do
 * corpo), vista 3/4: cabelo com mechas, moletom com capuz e cordões,
 * jeans com dobras e tênis. Cada quadro é desenhado uma vez num canvas
 * pequeno, recebe contorno automático e fica em cache.
 *
 * Espaço do sprite (virado para a direita): canvas CW×CH, pés na linha
 * FY e centro em X0. A caixa de colisão (10×G.PH) fica com a base em FY.
 * ===================================================================== */
(function (G) {
  'use strict';

  const CW = 34, CH = 60, X0 = 16, FY = 48;
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
  const dark = (hex, k) => mix(hex, '#1c1430', k === undefined ? 0.28 : k);
  const light = (hex, k) => mix(hex, '#fff6e0', k === undefined ? 0.2 : k);

  /* ---------------- proporções ---------------- */
  function dims(o) {
    const kid = !!o.kid;
    return { legLen: kid ? 6 : 11, torso: kid ? 8 : 11, head: kid ? 8 : 9, shoe: 3 };
  }

  /* ---------------- poses ---------------- */
  function poseFor(o) {
    const st = o.state || 'idle';
    const t = o.t || 0;
    const p = { id: st, bob: 0, lean: 0, legs: 'stand', fl: 0, bl: 0, fLift: 0, bLift: 0, fa: 'down', ba: 'down', fad: 0, bad: 0, eyes: 'open' };
    const pocket = o.hoodie && !o.kid;
    if (st === 'walk' && o.run) {
      const f = Math.floor(t * 9) % 6; p.id = 'run' + f;
      const s = Math.sin(f / 6 * Math.PI * 2);
      p.fl = Math.round(s * 4); p.bl = -p.fl;
      p.fLift = s > 0.3 ? 3 : 0; p.bLift = s < -0.3 ? 3 : 0;
      p.fa = 'run'; p.ba = 'run'; p.fad = -Math.round(s * 3); p.bad = -p.fad;
      p.bob = Math.abs(s) < 0.5 ? -1 : 1; p.lean = 1;
    } else if (st === 'walk') {
      const f = Math.floor(t * 10.5) % 6; p.id = 'walk' + f;
      const s = Math.sin(f / 6 * Math.PI * 2);
      p.fl = Math.round(s * 3); p.bl = -p.fl;
      p.fLift = s > 0.5 ? 1 : 0; p.bLift = s < -0.5 ? 1 : 0;
      p.fa = 'swing'; p.ba = 'swing'; p.fad = -Math.round(s * 2); p.bad = -p.fad;
      p.bob = Math.abs(s) < 0.5 ? -1 : 0;
    } else if (st === 'idle') {
      const f = Math.floor(t * 1.4 + (o.seed || 0)) % 2; p.id = 'idle' + f;
      p.bob = f;
      if (pocket) { p.fa = 'pocket'; p.ba = 'pocket'; }
    } else if (st === 'jump') {
      p.legs = 'tuck'; p.fa = 'up'; p.ba = 'back';
    } else if (st === 'fall') {
      const f = Math.floor(t * 8) % 2; p.id = 'fall' + f;
      p.legs = 'apart'; p.fa = f ? 'up' : 'out'; p.ba = f ? 'out' : 'up';
    } else if (st === 'fly') {
      const f = Math.floor(t * 4) % 2; p.id = 'fly' + f;
      p.legs = 'dangle'; p.fa = 'forwardUp'; p.ba = 'back'; p.lean = 1; p.bob = f ? 0 : -1;
    } else if (st === 'sit') {
      p.legs = 'sit'; p.bob = 12; if (pocket) { p.fa = 'pocket'; p.ba = 'pocket'; }
    } else if (st === 'sitFloor') {
      p.legs = 'sitFloor'; p.bob = 14; p.fa = 'floor'; p.ba = 'floor';
    } else if (st === 'rise') {
      p.legs = 'crouch'; p.bob = 5; p.fa = 'knee';
    } else if (st === 'stun') {
      const f = Math.floor(t * 6) % 2; p.id = 'stun' + f;
      p.fa = 'out'; p.ba = 'out'; p.eyes = 'dizzy'; p.lean = f ? 1 : -1;
    } else if (st === 'sweep') {
      const f = Math.floor(t * 7) % 2; p.id = 'sweep' + f;
      p.fa = 'sweep'; p.ba = 'sweep'; p.lean = 1; p.fad = f;
    }
    if (o.carrying && p.fa !== 'sweep') { p.fa = 'hold'; if (p.ba === 'pocket') p.ba = 'down'; }
    if (o.handOnBag) p.fa = 'bag';
    if (o.gesture) { p.fa = 'wave'; p.fad = o.gesture; if (p.ba === 'pocket') p.ba = 'down'; }
    if (o.aim) { p.fa = 'none'; if (p.ba === 'pocket') p.ba = 'down'; }
    if (o.blink || (p.eyes === 'open' && Math.sin(t * 0.9 + (o.seed || 0) * 1.7) > 0.985)) p.eyes = 'closed';
    return p;
  }

  /* ---------------- desenho de um quadro ---------------- */
  function paint(cx, o, p) {
    const pal = o.pal || G.PAL_V;
    const D = dims(o);
    const skin = pal.skin, skinD = dark(skin, 0.22), skinDD = dark(skin, 0.42), skinL = light(skin, 0.2);
    const hair = pal.hair, hairD = dark(hair, 0.35), hairL = mix(hair, '#7f8fb0', 0.3);
    const top = pal.shirt, topD = dark(top, 0.3), topDD = dark(top, 0.5), topL = light(top, 0.18);
    const pants = pal.pants, pantsD = dark(pants, 0.32), pantsL = light(pants, 0.16);
    const shoe = pal.shoe, shoeD = dark(shoe, 0.3), sole = dark(shoe, 0.45);
    const P = (x, y, w, h, col) => { if (w > 0 && h > 0) { cx.fillStyle = col; cx.fillRect(x, y, w, h); } };

    const b = p.bob, L = p.lean;
    const legTop = FY - D.shoe - D.legLen;          // primeira linha das pernas (em pé)
    const tT = legTop - D.torso + b;                // topo do tronco
    const hip = tT + D.torso;                       // linha abaixo do tronco
    const hT = tT - 1 - D.head;                     // topo do rosto (1 linha de pescoço)
    const hx = X0 - 4 + L;                          // rosto: hx..hx+8
    const tx = X0 - 5 + (L > 0 ? 1 : 0);            // tronco: tx..tx+9
    const kid = !!o.kid;
    const style = o.hairStyle || 'short';

    /* ----- cabelo de trás (por baixo de tudo) ----- */
    if (style === 'long') { P(hx - 2, hT + 2, 5, D.head + 6, hairD); P(hx - 2, hT + 3, 1, D.head + 4, dark(hair, 0.5)); }
    if (style === 'bun') { P(hx - 3, hT - 3, 5, 5, hair); P(hx - 2, hT - 3, 3, 1, hairL); }

    /* ----- braço de trás ----- */
    arm(p.ba, p.bad, true);

    /* ----- pernas ----- */
    const legW = kid ? 3 : 4;
    if (p.legs === 'stand') {
      leg(X0 - legW + p.bl, hip, FY - D.shoe - hip - p.bLift, true);
      leg(X0 + p.fl, hip, FY - D.shoe - hip - p.fLift, false);
    } else if (p.legs === 'tuck') {
      P(X0 - 4, hip, legW, 5, pantsD); P(X0 - 6, hip + 5, legW, 3, pantsD); sneaker(X0 - 8, hip + 8, true);
      P(X0, hip, legW + 1, 4, pants); P(X0 + 3, hip + 3, legW, 4, pants); P(X0 + 4, hip + 3, 1, 4, pantsL); sneaker(X0 + 3, hip + 7, false);
    } else if (p.legs === 'apart') {
      P(X0 - 5, hip, legW, 9, pantsD); sneaker(X0 - 8, hip + 9, true);
      P(X0 + 1, hip, legW, 9, pants); P(X0 + 3, hip + 1, 1, 7, pantsL); sneaker(X0 + 2, hip + 9, false);
    } else if (p.legs === 'dangle') {
      P(X0 - 4, hip, legW, 9, pantsD); sneaker(X0 - 7, hip + 8, true);
      P(X0, hip, legW, 9, pants); P(X0 + 2, hip + 1, 1, 7, pantsL); sneaker(X0 - 2, hip + 9, false);
    } else if (p.legs === 'sit') {
      // coxas para a frente, canelas para baixo
      P(X0 - 4, hip - 3, 11, 4, pantsD); P(X0 - 3, hip - 4, 11, 4, pants); P(X0, hip - 4, 7, 1, pantsL);
      P(X0 + 5, hip, legW, 8, pants); P(X0 + 6, hip + 1, 1, 6, pantsL); sneaker(X0 + 5, hip + 8, false);
    } else if (p.legs === 'sitFloor') {
      P(X0 - 4, hip - 4, 15, 3, pantsD); P(X0 - 3, hip - 5, 15, 3, pants); P(X0 + 2, hip - 5, 8, 1, pantsL);
      P(X0 + 12, hip - 9, 3, 6, shoe); P(X0 + 14, hip - 8, 1, 5, shoeD); P(X0 + 11, hip - 3, 4, 1, sole);
    } else if (p.legs === 'crouch') {
      P(X0 - 4, hip, legW, 3, pantsD); P(X0 - 4, hip + 3, legW, FY - D.shoe - hip - 3, pantsD); sneaker(X0 - 6, FY - D.shoe, true);
      P(X0, hip - 1, 8, 4, pants); P(X0 + 4, hip + 3, legW, FY - D.shoe - hip - 3, pants); sneaker(X0 + 4, FY - D.shoe, false);
    }

    /* ----- tronco ----- */
    const tw = 10, th = D.torso;
    if (o.dress) {
      const sk = o.dress, skD = dark(sk, 0.3), skL = light(sk, 0.15);
      P(tx + 1, tT, tw - 2, th, top); P(tx + 1, tT, 2, th, topD); P(tx + tw - 3, tT + 1, 1, th - 2, topL);
      for (let i = 0; i < 9; i++) { const w = 10 + Math.floor(i / 2) * 2; P(X0 - w / 2, hip - 1 + i, w, 1, i === 8 ? skD : sk); }
      P(X0 - 5, hip, 2, 7, skD); P(X0 + 2, hip + 1, 1, 6, skL);
    } else if (o.shirtless) {
      P(tx + 1, tT, tw - 2, th, skin); P(tx + 1, tT, 2, th, skinD); P(tx + 4, tT + 3, 2, 1, skinD); P(tx + 7, tT + 3, 2, 1, skinD); P(tx + 5, tT + 6, 3, 1, skinD);
      P(tx, hip - 3, tw, 4, '#f1f1f1'); P(tx, hip - 3, tw, 1, '#d9d9d9'); P(tx + 2, hip - 2, 1, 3, '#d9d9d9');   // toalha
    } else if (o.hoodie) {
      // moletom: ombros arredondados, capuz atrás do pescoço, cordões, bolso canguru e barra canelada
      P(tx + 1, tT, tw - 2, th - 2, top); P(tx, tT + 2, tw, th - 4, top);
      P(tx, tT + 2, 3, th - 4, topD); P(tx + 1, tT, 2, 2, topD);
      P(tx + tw - 2, tT + 2, 1, th - 6, topL); P(tx + 4, tT + 1, 4, 1, topL);
      P(tx, hip - 2, tw, 2, topD); for (let i = 0; i < tw; i += 2) P(tx + i, hip - 2, 1, 2, topDD);   // barra
      // capuz
      P(tx - 1, tT - 2, 5, 4, top); P(tx - 1, tT - 2, 2, 4, topD); P(tx + 3, tT - 1, 5, 2, topD); P(tx + 4, tT - 1, 3, 1, topDD);
      // cordões
      P(tx + 5, tT + 1, 1, 4, '#c9ccd6'); P(tx + 7, tT + 1, 1, 3, '#c9ccd6'); P(tx + 5, tT + 5, 1, 1, '#8c909c'); P(tx + 7, tT + 4, 1, 1, '#8c909c');
      // bolso canguru
      P(tx + 3, hip - 6, 6, 1, topDD); P(tx + 3, hip - 5, 1, 3, topDD); P(tx + 8, hip - 5, 1, 3, topDD); P(tx + 4, hip - 5, 4, 3, topD);
    } else {
      P(tx + 1, tT, tw - 2, th, top); P(tx, tT + 2, tw, th - 2, top);
      P(tx, tT + 2, 3, th - 2, topD); P(tx + tw - 2, tT + 2, 1, th - 4, topL);
      P(tx, hip - 1, tw, 1, topD);
      P(tx + 5, tT, 3, 1, skinD); P(tx + 6, tT + 1, 1, 1, skinD);   // gola
      if (o.jacket) { P(tx + 6, tT + 1, 1, th - 1, dark(top, 0.5)); P(tx + 7, tT + 2, 1, 1, '#d0d0d0'); P(tx + 7, tT + 5, 1, 1, '#d0d0d0'); }
      if (o.stripe) { P(tx, tT + 4, tw, 2, o.stripe); }
      if (o.apron) { P(tx + 4, tT + 2, 6, th - 1, '#f4f1ea'); P(tx + 4, tT + 2, 1, th - 1, '#d8d3c8'); P(tx + 3, tT + 4, 1, 1, '#d8d3c8'); P(tx + 5, hip - 4, 3, 1, '#d8d3c8'); }
      if (!kid) P(tx, hip - 1, tw, 1, pal.belt || dark(pants, 0.45));
    }

    /* ----- pescoço e cabeça ----- */
    P(hx + 3, tT - 1, 3, 2, skinD); P(hx + 3, tT - 1, 1, 2, skinDD);
    // rosto: oval com mandíbula estreitando no queixo
    const H9 = D.head;
    P(hx + 1, hT, 8, H9 - 2, skin); P(hx + 2, hT + H9 - 2, 6, 1, skin); P(hx + 3, hT + H9 - 1, 4, 1, skinD);
    P(hx + 2, hT + H9 - 2, 1, 1, skinD); P(hx + 7, hT + H9 - 2, 1, 1, skinD);
    P(hx + 1, hT + H9 - 3, 1, 1, skinD);
    P(hx + 8, hT + 3, 1, 2, skinL);                                    // luz na maçã do rosto
    P(hx + 9, hT + 3, 1, 2, skin); P(hx + 9, hT + 5, 1, 1, skinD);     // nariz
    P(hx + 1, hT + 3, 2, 3, skinD); P(hx + 1, hT + 4, 1, 1, skinDD);   // orelha
    // olhos (vista 3/4) e boca
    const ey = hT + 3;
    const eye = pal.eye || '#1e1622';
    if (p.eyes === 'closed') { P(hx + 4, ey + 1, 2, 1, skinDD); P(hx + 7, ey + 1, 2, 1, skinDD); }
    else if (p.eyes === 'dizzy') { P(hx + 4, ey, 1, 1, eye); P(hx + 5, ey + 1, 1, 1, eye); P(hx + 7, ey, 1, 1, eye); P(hx + 8, ey + 1, 1, 1, eye); }
    else {
      P(hx + 4, ey, 2, 2, '#f2efe8'); P(hx + 5, ey, 1, 2, eye);
      P(hx + 7, ey, 2, 2, '#f2efe8'); P(hx + 8, ey, 1, 2, eye);
      P(hx + 4, ey - 1, 2, 1, hairD); P(hx + 7, ey - 1, 2, 1, hairD);  // sobrancelhas
    }
    if (style !== 'helmet') P(hx + 6, ey + 4, 2, 1, skinDD);           // boca
    if (o.beard) { P(hx + 2, hT + H9 - 4, 7, 3, o.beard); P(hx + 3, hT + H9 - 1, 4, 1, o.beard); P(hx + 6, ey + 4, 2, 1, dark(o.beard, 0.3)); }
    if (o.glasses) { P(hx + 3, ey - 1, 7, 1, '#20232a'); P(hx + 3, ey, 1, 2, '#20232a'); P(hx + 6, ey, 1, 2, '#20232a'); P(hx + 9, ey, 1, 2, '#20232a'); }

    /* ----- cabelo ----- */
    if (style === 'spiky') {
      // bagunçado e espetado, mechas apontando para trás e franja caindo na testa
      P(hx + 0, hT - 2, 10, 3, hair); P(hx - 1, hT - 1, 2, 5, hair); P(hx + 1, hT - 3, 8, 1, hair);
      P(hx + 1, hT - 4, 2, 1, hair); P(hx + 4, hT - 5, 2, 2, hair); P(hx + 7, hT - 4, 2, 1, hair); P(hx + 6, hT - 4, 1, 1, hair);
      P(hx - 2, hT - 3, 2, 2, hair); P(hx - 3, hT - 4, 1, 1, hair); P(hx - 2, hT + 1, 1, 2, hair); P(hx + 10, hT - 1, 1, 2, hair);
      P(hx + 1, hT + 1, 1, 2, hair);                                     // costeleta
      P(hx + 3, hT + 1, 3, 1, hair); P(hx + 4, hT + 2, 1, 1, hair);      // franja
      P(hx + 6, hT + 1, 4, 1, hair); P(hx + 8, hT + 2, 1, 1, hair);
      P(hx + 4, hT - 4, 1, 1, hairL); P(hx + 2, hT - 2, 1, 1, hairL); P(hx + 6, hT - 2, 2, 1, hairL); P(hx + 8, hT - 3, 1, 1, hairL);
      P(hx - 1, hT + 2, 1, 2, hairD); P(hx + 2, hT, 1, 1, hairD);
    } else if (style === 'short') {
      P(hx, hT - 1, 9, 3, hair); P(hx + 1, hT - 2, 7, 1, hair); P(hx - 1, hT, 3, 5, hair); P(hx + 4, hT + 2, 5, 1, hair);
      P(hx + 2, hT - 2, 4, 1, hairL); P(hx + 6, hT - 1, 2, 1, hairL); P(hx - 1, hT + 3, 1, 2, hairD);
    } else if (style === 'long') {
      P(hx, hT - 1, 9, 3, hair); P(hx + 1, hT - 2, 7, 1, hair); P(hx - 1, hT, 3, 9, hair); P(hx + 5, hT + 2, 4, 1, hair); P(hx + 8, hT + 2, 1, 3, hair);
      P(hx + 2, hT - 2, 4, 1, hairL); P(hx, hT + 2, 1, 6, hairD);
    } else if (style === 'bun') {
      P(hx, hT - 1, 9, 3, hair); P(hx + 1, hT - 2, 7, 1, hair); P(hx - 1, hT, 3, 4, hair);
      P(hx + 2, hT - 2, 4, 1, hairL); P(hx - 1, hT + 2, 1, 2, hairD);
    } else if (style === 'helmet') {
      const hc = o.helmet || '#c0392b';
      P(hx - 1, hT - 3, 11, 8, hc); P(hx - 2, hT - 1, 13, 5, hc); P(hx + 1, hT - 3, 6, 1, light(hc, 0.35)); P(hx, hT - 2, 2, 3, light(hc, 0.2));
      P(hx + 6, hT + 1, 5, 3, '#2b2f38'); P(hx + 7, hT + 1, 3, 1, '#6c7a8c'); P(hx - 2, hT + 3, 4, 1, dark(hc, 0.3));
    } else if (style === 'cap') {
      const cc = o.cap || '#f1efe8';
      P(hx, hT - 2, 9, 3, cc); P(hx + 8, hT, 4, 1, cc); P(hx + 2, hT - 2, 4, 1, light(cc, 0.3)); P(hx, hT, 9, 1, dark(cc, 0.2));
      P(hx - 1, hT + 1, 3, 3, hair);
    } else if (style === 'bald') {
      P(hx - 1, hT + 2, 3, 3, hair); P(hx + 3, hT, 4, 1, skinL);
    }

    /* ----- braço da frente ----- */
    arm(p.fa, p.fad, false);

    function sneaker(x, y, back) {
      const s1 = back ? shoeD : shoe;
      P(x, y, 5, 2, s1); P(x + 1, y - 1, 3, 1, s1); P(x, y + 2, 6, 1, sole);
      if (!back) { P(x + 1, y, 2, 1, light(shoe, 0.3)); P(x + 3, y - 1, 1, 1, dark(shoe, 0.15)); }
    }
    function leg(x, y, h, back) {
      const c = back ? pantsD : pants;
      P(x, y, legW, Math.max(1, h), c);
      if (!back) { P(x + legW - 2, y + 1, 1, Math.max(1, h - 2), pantsL); P(x, y, 1, Math.max(1, h), pantsD); P(x + 1, y + Math.floor(h / 2), 2, 1, pantsL); }
      P(x, y + h - 1, legW, 1, dark(c, 0.25));   // barra da calça
      sneaker(x - (back ? 1 : 0), y + h, back);
    }
    function arm(mode, d, back) {
      if (mode === 'none') return;
      const sl = o.shirtless ? (back ? skinD : skin) : (back ? topD : top);
      const slL = o.shirtless ? skinL : topL;
      const sk = back ? skinD : skin;
      const short = !o.hoodie && !o.dress && !o.jacket && !o.shirtless && !o.longSleeve;
      const ax = back ? tx - 1 : tx + 5, ay = tT + 1;
      // manga: comprida no moletom, curta na camiseta (antebraço aparece)
      const sleeve = (x, y, w, h) => {
        if (short) { P(x, y, w, Math.min(h, 3), sl); P(x, y + 3, w, h - 3, sk); }
        else { P(x, y, w, h, sl); if (!back) { P(x + w - 1, y + 1, 1, Math.max(1, h - 2), slL); P(x - 1, y + 2, 1, Math.max(1, h - 2), topDD); } }
      };
      switch (mode) {
        case 'down': sleeve(ax, ay, 3, 9); P(ax, ay + 9, 3, 2, sk); break;
        case 'swing': sleeve(ax + d, ay, 3, 9); P(ax + d * 2, ay + 9, 3, 2, sk); break;
        case 'run': sleeve(ax + d, ay, 3, 5); P(ax + d * 2 + (d > 0 ? 1 : 0), ay + 4, 3, 4, short ? sk : sl); P(ax + d * 2 + (d > 0 ? 1 : 0), ay + 8, 3, 2, sk); break;
        case 'pocket': // mãos no bolso do moletom
          if (back) { P(ax, ay, 3, 7, sl); }
          else {
            P(ax + 1, ay + 1, 1, 4, topDD);                       // vinco entre braço e corpo
            P(ax + 2, ay, 3, 4, sl); P(ax + 3, ay + 3, 3, 3, sl);  // ombro e cotovelo (para fora do corpo)
            P(ax + 1, ay + 5, 4, 2, sl);                          // antebraço entrando no bolso
            P(ax + 5, ay + 3, 1, 2, slL); P(ax + 4, ay + 1, 1, 2, slL);
            P(ax + 1, ay + 7, 4, 1, topDD); P(ax, ay + 5, 1, 2, topDD);
          }
          break;
        case 'up': sleeve(ax, ay - 9, 3, 10); P(ax, ay - 11, 3, 2, sk); break;
        case 'out': P(ax + (back ? -4 : 1), ay, 5, 3, sl); P(ax + (back ? -6 : 6), ay - 1, 2, 3, sk); break;
        case 'back': sleeve(ax - 2, ay, 3, 7); P(ax - 3, ay + 7, 3, 2, sk); break;
        case 'forwardUp': P(ax + 1, ay - 2, 7, 3, sl); P(ax + 8, ay - 4, 2, 4, sk); break;
        case 'hold': P(ax, ay, 3, 5, sl); P(ax + 1, ay + 4, 5, 3, short ? sk : sl); P(ax + 6, ay + 4, 2, 3, sk); break;
        case 'sweep': P(ax + 1, ay + 2, 6, 3, sl); P(ax + 6 + d, ay + 5, 3, 2, sk); break;
        case 'bag': sleeve(ax, ay, 3, 8); P(ax - 1, ay + 8, 3, 2, sk); break;
        case 'wave': sleeve(ax + 1, ay - d - 7, 3, 8); P(ax + 1, ay - d - 9, 3, 2, sk); break;
        case 'floor': sleeve(ax - (back ? 4 : 0), ay + 2, 3, 8); P(ax - (back ? 4 : 0), ay + 10, 3, 2, sk); break;
        case 'knee': sleeve(ax + 1, ay + 1, 3, 6); P(ax + 3, ay + 6, 3, 2, sk); break;
        default: break;
      }
    }
  }

  /** Contorno de 1 px: pixel vazio vizinho de um cheio vira a cor do vizinho bem escurecida. */
  function outline(cx, CW_, CH_) {
    const W = CW_ || CW, H = CH_ || CH;
    const img = cx.getImageData(0, 0, W, H), d = img.data;
    const src = new Uint8ClampedArray(d);
    const A = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : src[(y * W + x) * 4 + 3];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (src[i + 3]) continue;
      let n = -1;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (A(x + ox, y + oy)) { n = ((y + oy) * W + x + ox) * 4; break; }
      if (n < 0) continue;
      d[i] = src[n] * 0.22 + 12; d[i + 1] = src[n + 1] * 0.18 + 8; d[i + 2] = src[n + 2] * 0.24 + 18; d[i + 3] = 240;
    }
    cx.putImageData(img, 0, 0);
  }

  function makeCanvas(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w || CW; cv.height = h || CH;
    return cv;
  }

  function keyOf(o, p, f) {
    const pal = o.pal || G.PAL_V;
    return [p.id, p.fa, p.fad, p.ba, p.eyes, f, pal.skin, pal.hair, pal.shirt, pal.pants, pal.shoe, pal.belt, pal.eye,
      o.hairStyle || '', o.dress || '', o.apron ? 1 : 0, o.shirtless ? 1 : 0, o.kid ? 1 : 0, o.beard || '', o.glasses ? 1 : 0,
      o.helmet || '', o.cap || '', o.jacket ? 1 : 0, o.stripe || '', o.hoodie ? 1 : 0, o.longSleeve ? 1 : 0].join('|');
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

  /** Sombra oval no chão. */
  function shadow(c, cx, feetY, w) {
    c.save(); c.globalAlpha = 0.22; c.fillStyle = '#000';
    const x = Math.round(cx), y = Math.round(feetY);
    c.fillRect(x - w / 2 + 2, y - 1, w - 4, 2); c.fillRect(x - w / 2, y, w, 1);
    c.restore();
  }

  /**
   * Desenha um personagem com o centro dos pés em (cx, feetY).
   * o: { facing, state, t, pal, hairStyle, hoodie, dress, apron, shirtless, kid, run, carrying,
   *      handOnBag, gesture, aim, glow, glowColor, flash, landT, seed, beard, glasses, shadow }
   */
  function draw(c, cx, feetY, o) {
    const st = o.state || 'idle';
    if (st === 'lie' || st === 'sleep' || st === 'collapse') return drawLying(c, cx, feetY, o);
    const cv = frame(o);
    const f = o.facing >= 0 ? 1 : -1;
    if (o.shadow !== false && (st === 'idle' || st === 'walk' || st === 'sweep' || st === 'stun')) shadow(c, cx, feetY, o.kid ? 10 : 14);
    const ox = Math.round(cx) - (f > 0 ? X0 : CW - X0), oy = Math.round(feetY) - FY + (o.landT > 0 ? 1 : 0);
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
    const p = poseFor(o), D = dims(o);
    const sx = Math.round(cx) + f * 1, sy = Math.round(feetY) - D.shoe - D.legLen - D.torso + p.bob + 3;
    let ax = o.aim.x - sx, ay = o.aim.y - sy;
    const d = Math.hypot(ax, ay) || 1; ax /= d; ay /= d;
    const R = G.R;
    for (let i = 0; i < 10; i++) R(c, sx + ax * i - 2, sy + ay * i - 2, 5, 5, '#1a1424');
    for (let i = 0; i < 10; i++) R(c, sx + ax * i - 1, sy + ay * i - 1, 3, 3, i < 8 ? pal.shirt : pal.skin);
    if (o.glow > 0) {
      c.save(); c.globalAlpha = 0.45 * o.glow; c.globalCompositeOperation = 'lighter';
      R(c, sx + ax * 10 - 3, sy + ay * 10 - 3, 6, 6, o.glowColor || '#9fd8ff'); c.restore();
    }
  }

  /** Deitado: o quadro em pé girado 90° (pixel a pixel, sem borrar). Base em feetY. */
  function drawLying(c, cx, feetY, o) {
    const f = o.facing >= 0 ? 1 : -1;
    const closed = o.state !== 'lie';
    const cv = frame(Object.assign({}, o, { state: 'idle', t: 0, seed: 0, facing: f, blink: closed, aim: null, carrying: false, gesture: 0, handOnBag: 0, run: false }));
    const mid = Math.round((FY + 10) / 2);   // meio do corpo no eixo vertical do quadro
    c.save();
    c.translate(Math.round(cx), Math.round(feetY));
    // cabeça do lado esquerdo quando f>0 (direito quando f<0), rosto para cima
    if (f > 0) { c.rotate(-Math.PI / 2); c.drawImage(cv, -(X0 - 8), -mid); }
    else { c.rotate(Math.PI / 2); c.drawImage(cv, -(CW - X0 + 8 - 1), -mid); }
    c.restore();
    if (o.state === 'lie') {
      const hx = Math.round(cx) + (f > 0 ? -(mid - 14) : mid - 20);
      G.R(c, hx, Math.round(feetY) - 16, 6, 3, '#cfeaff'); G.R(c, hx, Math.round(feetY) - 16, 6, 1, '#ffffff');
    }
  }

  /** Sprite genérico em cache: fn(ctx, P) pinta em (0..w, 0..h); recebe contorno automático. */
  const misc = new Map();
  function cached(key, w, h, fn, noOutline) {
    let cv = misc.get(key);
    if (cv) return cv;
    cv = makeCanvas(w, h);
    const cx = cv.getContext('2d');
    fn(cx, (x, y, ww, hh, col) => { cx.fillStyle = col; cx.fillRect(x, y, ww, hh); });
    if (!noOutline) outline(cx, w, h);
    if (misc.size > 600) misc.clear();
    misc.set(key, cv);
    return cv;
  }

  G.Characters = { cached, draw, frame, poseFor, mix, dark, light, CW, CH, X0, FY, _cache: cache };
})(window.VG = window.VG || {});

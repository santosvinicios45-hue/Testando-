/* =====================================================================
 * Pixel art procedural: V, pessoas, objetos, móveis e ícones.
 * Tudo é desenhado com retângulos de 1 px na resolução interna
 * (480×270), sem imagens externas.
 * ===================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  G.R = R;

  const PAL_V = {
    skin: '#d9a066', skinS: '#b5814f', hair: '#2a1b14', shirt: '#3f6ea8', shirtS: '#2c5283',
    pants: '#2e3854', pantsS: '#202840', shoe: '#e6e1d6', eye: '#1a1010', belt: '#5a4630',
  };
  G.PAL_V = PAL_V;

  /* ------------------------------------------------------------------
   * Humanos (V e pessoas da rua). Caixa 10×26, (x,y) = canto superior.
   * ------------------------------------------------------------------ */
  function human(c, x, y, o) {
    const pal = o.pal || PAL_V;
    const f = o.facing >= 0 ? 1 : -1;
    const W = 10;
    const px = (dx, dy, w, h, col) => R(c, f > 0 ? x + dx : x + (W - dx - w), y + dy, w, h, col);
    const t = o.t || 0;
    const st = o.state || 'idle';

    if (st === 'lie' || st === 'collapse' || st === 'sleep') return lying(c, x, y, o, pal);

    let bob = 0, lf = 0, lb = 0, liftF = 0, liftB = 0, armF = 0, armB = 0;
    if (st === 'walk') {
      const s = Math.sin(t * 11);
      lf = Math.round(s * 1.6); lb = -lf;
      liftF = s > 0.6 ? 1 : 0; liftB = s < -0.6 ? 1 : 0;
      armF = -lf; armB = lf;
      bob = Math.abs(s) > 0.8 ? -1 : 0;
    } else if (st === 'idle') bob = Math.sin(t * 2.2) > 0.75 ? 1 : 0;
    if (o.landT > 0) bob = 1;

    const sit = st === 'sit', sitFloor = st === 'sitFloor';
    const dy = sit ? 7 : sitFloor ? 9 : bob;
    const hy = (n) => n + dy;

    // braço de trás
    if (!o.aim && st !== 'fall' && st !== 'fly') px(2 + armB, hy(10), 2, 6, pal.shirtS);
    // pernas
    if (sit) {
      px(3, hy(16), 7, 3, pal.pants); px(8, hy(18), 2, 6, pal.pants); px(8, hy(24), 3, 2, pal.shoe);
    } else if (sitFloor) {
      px(3, hy(14), 10, 3, pal.pants); px(12, hy(14), 2, 3, pal.shoe);
    } else if (st === 'jump') {
      px(2, 17, 2, 5, pal.pantsS); px(2, 22, 3, 2, pal.shoe);
      px(5, 17, 3, 4, pal.pants); px(6, 20, 2, 3, pal.pants); px(6, 23, 3, 2, pal.shoe);
    } else if (st === 'fly') {
      px(3, 17, 2, 7, pal.pantsS); px(5, 17, 2, 7, pal.pants); px(3, 24, 2, 2, pal.shoe); px(5, 24, 2, 2, pal.shoe);
    } else if (st === 'fall') {
      px(2, 17, 2, 6, pal.pantsS); px(1, 23, 3, 2, pal.shoe);
      px(6, 17, 2, 6, pal.pants); px(6, 23, 3, 2, pal.shoe);
    } else if (o.dress) {
      px(2, hy(16), 7, 6, o.dress); px(3, hy(22), 2, 2, pal.skinS); px(6, hy(22), 2, 2, pal.skinS);
      px(3, hy(24) - dy, 2, 2, pal.shoe); px(6, hy(24) - dy, 2, 2, pal.shoe);
    } else {
      px(3 + lb, 17 + Math.max(0, dy), 2, 7 - liftB - Math.max(0, dy), pal.pantsS); px(3 + lb, 24 - liftB, 3, 2, pal.shoe);
      px(5 + lf, 17 + Math.max(0, dy), 2, 7 - liftF - Math.max(0, dy), pal.pants); px(5 + lf, 24 - liftF, 3, 2, pal.shoe);
    }
    // tronco
    if (o.shirtless) { px(2, hy(9), 6, 7, pal.skin); px(2, hy(15), 6, 2, '#f4f4f4'); }
    else {
      px(2, hy(9), 6, 8, pal.shirt); px(2, hy(15), 6, 1, pal.shirtS);
      if (o.apron) { px(3, hy(10), 4, 7, '#f1efe8'); }
      if (!o.dress) px(2, hy(16), 6, 1, pal.belt);
    }
    // cabeça
    px(3, hy(2), 5, 6, pal.skin); px(3, hy(7), 5, 1, pal.skinS);
    px(4, hy(8), 2, 1, pal.skinS);
    px(6, hy(4), 1, 1, pal.eye);
    if (o.blink || (Math.sin(t * 0.9 + (o.seed || 0)) > 0.985)) px(6, hy(4), 1, 1, pal.skin);
    px(3, hy(4), 1, 2, pal.skinS);
    const hair = o.hairStyle || 'short';
    if (hair === 'short') { px(2, hy(0), 6, 2, pal.hair); px(2, hy(2), 1, 3, pal.hair); px(3, hy(2), 4, 1, pal.hair); px(7, hy(1), 1, 1, pal.hair); }
    else if (hair === 'long') { px(2, hy(0), 6, 2, pal.hair); px(1, hy(2), 2, 7, pal.hair); px(3, hy(2), 4, 1, pal.hair); }
    else if (hair === 'bun') { px(2, hy(1), 6, 2, pal.hair); px(1, hy(0), 3, 3, pal.hair); px(2, hy(3), 1, 2, pal.hair); }
    else if (hair === 'helmet') { px(2, hy(0), 7, 4, '#c0392b'); px(7, hy(2), 2, 2, '#2b2b2b'); }
    else if (hair === 'cap') { px(2, hy(0), 6, 2, '#f1efe8'); px(7, hy(1), 2, 1, '#f1efe8'); }
    // braço da frente
    if (o.aim) {
      const sx = x + (f > 0 ? 6 : 4), sy = y + hy(10);
      let ax = o.aim.x - sx, ay = o.aim.y - sy;
      const d = Math.hypot(ax, ay) || 1; ax /= d; ay /= d;
      for (let i = 0; i < 6; i++) R(c, sx + ax * i - 1, sy + ay * i - 1, 2, 2, i < 4 ? pal.shirt : pal.skin);
      if (o.glow > 0) {
        c.save(); c.globalAlpha = 0.35 * o.glow; R(c, sx + ax * 6 - 2, sy + ay * 6 - 2, 4, 4, o.glowColor || '#9fd8ff'); c.restore();
      }
    } else if (st === 'fall') { px(6, hy(5), 2, 5, pal.shirt); px(6, hy(4), 2, 1, pal.skin); }
    else if (st === 'fly') { px(6, hy(10), 2, 5, pal.shirt); px(7, hy(15), 2, 1, pal.skin); }
    else if (st === 'stun') { px(6, hy(10), 2, 4, pal.shirt); px(7, hy(6), 2, 4, pal.shirt); px(7, hy(5), 2, 1, pal.skin); }
    else if (o.handOnBag) { px(5, hy(11), 2, 4, pal.shirt); px(5, hy(15 + o.handOnBag), 2, 1, pal.skin); }
    else if (o.gesture) { px(6, hy(9 - o.gesture), 2, 5, pal.shirt); px(7, hy(8 - o.gesture), 1, 1, pal.skin); }
    else { px(5 + armF, hy(10), 2, 5, pal.shirt); px(5 + armF, hy(15), 2, 1, pal.skin); }

    if (o.flash > 0) { c.save(); c.globalAlpha = Math.min(0.7, o.flash); c.globalCompositeOperation = 'lighter'; R(c, x, y, 10, 26, '#ffffff'); c.restore(); }
  }

  /** Corpo deitado: âncora na base da caixa (y+26). */
  function lying(c, x, y, o, pal) {
    const f = o.facing >= 0 ? 1 : -1;
    const by = y + 26;
    const L = 26;
    const x0 = x + 5 - L / 2;
    const px = (dx, dy, w, h, col) => R(c, f > 0 ? x0 + dx : x0 + (L - dx - w), by + dy, w, h, col);
    // cabeça à esquerda (f>0)
    px(0, -7, 6, 6, pal.skin); px(0, -8, 6, 2, pal.hair); px(0, -6, 1, 4, pal.hair); px(3, -5, 1, 1, o.state === 'sleep' || o.state === 'collapse' ? pal.skinS : pal.eye);
    px(6, -7, 9, 6, pal.shirt); px(6, -2, 9, 1, pal.shirtS);
    px(15, -6, 9, 5, pal.pants); px(15, -2, 9, 1, pal.pantsS);
    px(24, -6, 2, 5, pal.shoe);
    if (o.state === 'lie') { px(1, -10, 5, 3, '#cfeaff'); } // bolsa de gelo na testa
  }

  /* ------------------------------------------------------------------
   * Animais e veículos
   * ------------------------------------------------------------------ */
  function dog(c, x, y, dir, anim) {
    const f = dir >= 0 ? 1 : -1;
    const px = (dx, dy, w, h, col) => R(c, f > 0 ? x + dx : x + (12 - dx - w), y + dy, w, h, col);
    const s = Math.sin(anim);
    px(1, 2, 8, 4, '#a0703c'); px(8, 0, 4, 4, '#a0703c'); px(11, 2, 1, 1, '#2b1d14'); px(10, 1, 1, 1, '#1b1b1b');
    px(9, -1, 1, 2, '#7a5028'); px(0, 1 + (s > 0 ? 0 : 1), 2, 1, '#a0703c');
    px(2 + (s > 0 ? 1 : 0), 6, 1, 2, '#7a5028'); px(7 - (s > 0 ? 1 : 0), 6, 1, 2, '#7a5028');
    px(3 - (s > 0 ? 1 : 0), 6, 1, 2, '#a0703c'); px(6 + (s > 0 ? 1 : 0), 6, 1, 2, '#a0703c');
  }
  function moto(c, x, y, facing, anim, hop) {
    const f = facing >= 0 ? 1 : -1;
    const px = (dx, dy, w, h, col) => R(c, f > 0 ? x + dx : x + (22 - dx - w), y + dy, w, h, col);
    const wy = 13 - (hop ? Math.round(hop * 3) : 0);
    px(1, wy, 5, 5, '#1b1b1b'); px(16, wy, 5, 5, '#1b1b1b'); px(3, wy + 2, 1, 1, '#888'); px(18, wy + 2, 1, 1, '#888');
    px(4, wy - 3, 14, 3, '#c0392b'); px(15, wy - 6, 2, 4, '#555'); px(14, wy - 7, 4, 1, '#333');
    px(0, wy - 9, 7, 6, '#e67e22'); px(1, wy - 8, 5, 1, '#f5b041'); // baú de entrega
    // piloto
    human(c, x + (f > 0 ? 6 : 6), y - 10 - (hop ? Math.round(hop * 3) : 0), { facing: f, state: 'sit', t: anim, pal: { skin: '#8d5a3b', skinS: '#6e432a', hair: '#111', shirt: '#2c3e50', shirtS: '#1f2d3a', pants: '#34495e', pantsS: '#273746', shoe: '#222', eye: '#111', belt: '#222' }, hairStyle: 'helmet' });
  }
  function pigeon(c, x, y, fly, t, dir) {
    const f = dir >= 0 ? 1 : -1;
    const px = (dx, dy, w, h, col) => R(c, f > 0 ? x + dx : x + (5 - dx - w), y + dy, w, h, col);
    if (fly > 0) {
      const flap = Math.sin(t * 30) > 0;
      px(1, 0, 3, 2, '#8a8f99'); px(0, flap ? -2 : 1, 2, 1, '#6d727c'); px(3, flap ? -2 : 1, 2, 1, '#6d727c'); px(4, 0, 1, 1, '#5b6b7a');
      return;
    }
    const peck = Math.sin(t * 4) > 0.7 ? 1 : 0;
    px(0, -2, 4, 2, '#8a8f99'); px(3, -3 + peck, 2, 2, '#5b6b7a'); px(4, -3 + peck, 1, 1, '#d98c3a'); px(1, 0, 1, 1, '#c96'); px(2, 0, 1, 1, '#c96');
  }

  /* ------------------------------------------------------------------
   * Objetos físicos
   * ------------------------------------------------------------------ */
  function prop(c, p, sx, sy, env) {
    const T = p.type;
    if (p.broken && !p.T.structure) {
      for (const s of p.shards) R(c, s.x - env.cam.x, s.y - env.cam.y, 2, 1, s.c);
      return;
    }
    const rot = Math.abs(p.angle) > 0.05 && !p.T.structure;
    if (rot) { c.save(); c.translate(Math.round(sx + p.w / 2), Math.round(sy + p.h / 2)); c.rotate(p.angle); sx = -p.w / 2; sy = -p.h / 2; }
    const x = sx, y = sy;
    switch (T) {
      case 'copo': {
        c.save(); c.globalAlpha = 0.55; R(c, x, y + 1, 5, 5, '#cfe9ff'); c.restore();
        R(c, x, y, 5, 1, '#ffffff'); R(c, x, y + 1, 1, 5, '#e8f6ff'); R(c, x + 4, y + 1, 1, 5, '#a9d0ee'); R(c, x, y + 5, 5, 1, '#9cc7e6');
        if (p.state.sabor === 'coca') { R(c, x + 1, y + 2, 3, 3, '#5a2d14'); R(c, x + 1, y + 2, 3, 1, '#b07a4f'); }
        else if (p.state.sabor === 'agua') R(c, x + 1, y + 3, 3, 2, '#9fd6ff');
        R(c, x + 1, y + 2, 2, 2, 'rgba(239,227,200,0.85)'); // etiqueta velha meio descascada
        break;
      }
      case 'colher':
        if (p.state.bent) { R(c, x, y + 1, 2, 1, '#c3cbd2'); R(c, x + 2, y, 2, 1, '#c3cbd2'); R(c, x + 4, y, 2, 2, '#e3e9ee'); }
        else { R(c, x, y + 1, 4, 1, '#c3cbd2'); R(c, x + 4, y, 2, 2, '#e3e9ee'); }
        break;
      case 'vassoura': R(c, x + 1, y, 2, 18, '#8a5a2b'); R(c, x + 1, y, 1, 18, '#a46d38'); R(c, x, y + 17, 4, 2, '#7a3b1c'); R(c, x, y + 19, 4, 5, '#d8b25a'); R(c, x + 1, y + 20, 1, 4, '#b8923c'); break;
      case 'controle': R(c, x, y, 6, 3, '#1c1c22'); R(c, x + 4, y, 1, 1, '#e74c3c'); R(c, x + 1, y + 1, 1, 1, '#777'); R(c, x + 2, y + 1, 1, 1, '#777'); break;
      case 'cadeira': R(c, x, y + 6, 10, 2, '#9c6b3e'); R(c, x + 8, y, 2, 8, '#8a5a2b'); R(c, x, y + 8, 1, 6, '#7a4d24'); R(c, x + 9, y + 8, 1, 6, '#7a4d24'); R(c, x + 4, y + 8, 1, 6, '#6a4220'); break;
      case 'jogo': R(c, x, y, 4, 6, p.state.cor || '#c0392b'); R(c, x, y + 1, 4, 1, '#f5f5f5'); R(c, x + 3, y, 1, 6, 'rgba(0,0,0,0.25)'); break;
      case 'livro': R(c, x, y, 4, 6, p.state.aberto ? '#e9dfc9' : '#7a4a2e'); R(c, x + 3, y, 1, 6, '#f2ead8'); R(c, x, y + 2, 3, 1, p.state.aberto ? '#e9dfc9' : '#c9a24a'); break;
      case 'caixa': R(c, x, y, 12, 10, '#c8a165'); R(c, x, y, 12, 1, '#dcbb85'); R(c, x + 5, y, 2, 10, '#e3cf9a'); R(c, x, y + 9, 12, 1, '#a88445'); break;
      case 'laranja': R(c, x + 1, y, 3, 5, '#ff9a1f'); R(c, x, y + 1, 5, 3, '#ff9a1f'); R(c, x + 1, y + 1, 1, 1, '#ffd08a'); R(c, x + 3, y + 3, 1, 1, '#e07b0c'); R(c, x + 2, y - 1, 2, 1, '#3f9b3a'); break;
      case 'caixote':
        if (p.state.metal) { R(c, x, y, 14, 14, '#8d99a6'); R(c, x + 1, y + 1, 12, 12, '#a7b2bd'); for (const [a, b] of [[1, 1], [11, 1], [1, 11], [11, 11]]) R(c, x + a, y + b, 2, 2, '#5f6b77'); R(c, x + 3, y + 6, 8, 2, '#7d8995'); }
        else { R(c, x, y, 14, 14, '#7a5230'); R(c, x + 1, y + 1, 12, 12, '#a87a4a'); R(c, x + 1, y + 4, 12, 1, '#7a5230'); R(c, x + 1, y + 9, 12, 1, '#7a5230'); for (let i = 0; i < 12; i++) R(c, x + 1 + i, y + 1 + i, 1, 1, '#8d6238'); }
        break;
      case 'lata': if (p.state.amassada) { R(c, x + 1, y + 2, 3, 4, '#c0392b'); R(c, x, y + 3, 4, 1, '#ddd'); } else { R(c, x, y, 4, 6, '#c0392b'); R(c, x, y, 4, 1, '#ddd'); R(c, x, y + 5, 4, 1, '#aaa'); R(c, x + 1, y + 2, 2, 2, '#f1f1f1'); } break;
      case 'bola': { const col = p.state.cor || '#e74c3c'; R(c, x + 2, y, 3, 7, col); R(c, x, y + 2, 7, 3, col); R(c, x + 1, y + 1, 5, 5, col); R(c, x + 2, y + 1, 2, 2, 'rgba(255,255,255,0.6)'); break; }
      case 'garrafa': R(c, x, y + 3, 3, 5, '#2f8f46'); R(c, x + 1, y, 1, 3, '#2f8f46'); R(c, x, y + 4, 1, 3, '#55c16f'); break;
      case 'painel': R(c, x, y, 12, 8, '#8e969c'); R(c, x + 1, y + 1, 10, 6, '#a6aeb4'); R(c, x + 1, y + 1, 1, 1, '#555'); R(c, x + 10, y + 6, 1, 1, '#555'); R(c, x + 3, y + 3, 6, 1, '#6b7378'); if (p.perceived) R(c, x + 8, y, 1, 4, '#3d4245'); break;
      case 'banco': bench(c, x, y, p); break;
      case 'poste': lampPost(c, x, y, p, env); break;
      default: R(c, x, y, p.w, p.h, '#f0f');
    }
    if (rot) c.restore();
    if (p.flash > 0) { c.save(); c.globalAlpha = Math.min(0.8, p.flash * 2); c.globalCompositeOperation = 'lighter'; R(c, sx, sy, p.w, p.h, '#fff3c4'); c.restore(); }
  }

  function bench(c, x, y, p) {
    const intact = !p.broken;
    const k = p.restoring && p.restoring.phase === 'assemble' ? U.easeInOut(Math.min(1, p.restoring.t)) : (intact ? 1 : 0);
    // pés de ferro (sempre no lugar)
    R(c, x + 3, y + 6, 2, 6, '#3b3f44'); R(c, x + 25, y + 6, 2, 6, '#3b3f44');
    // tábuas: posição quebrada (no chão, tortas) → montada
    const planks = [[0, 5, 30], [0, 2, 30], [1, -2, 28]];
    planks.forEach((pl, i) => {
      const bx = x + pl[0], by = y + pl[1];
      const qx = x + i * 9 - 2, qy = y + 10 - i;
      const X = U.lerp(qx, bx, k), Y = U.lerp(qy, by, k);
      const w = pl[2];
      if (k < 1) { R(c, X, Y, w * (0.5 + k * 0.5), 2, '#8a5a2b'); R(c, X, Y, w * (0.5 + k * 0.5), 1, '#a87444'); }
      else { R(c, X, Y, w, 2, '#9c6b3e'); R(c, X, Y, w, 1, '#b98552'); }
    });
    if (k >= 1) { R(c, x + 2, y - 2, 2, 8, '#3b3f44'); R(c, x + 26, y - 2, 2, 8, '#3b3f44'); }
  }

  function lampPost(c, x, y, p, env) {
    const intact = !p.broken;
    const k = p.restoring && p.restoring.phase === 'assemble' ? U.easeInOut(Math.min(1, p.restoring.t)) : (intact ? 1 : 0);
    // metade de baixo fixa
    R(c, x + 2, y + 28, 2, 28, '#2f3439'); R(c, x + 1, y + 52, 4, 4, '#262a2e');
    // metade de cima: tombada (ângulo) → em pé
    const ang = U.lerp(1.25, 0, k);
    c.save(); c.translate(Math.round(x + 3), Math.round(y + 28)); c.rotate(ang);
    R(c, -1, -28, 2, 28, '#2f3439');
    R(c, -1, -28, 7, 2, '#2f3439'); R(c, 4, -27, 4, 3, '#3b4249');
    const lit = k >= 1 && env && env.night > 0.25;
    R(c, 5, -24, 2, 1, lit ? '#ffe6a8' : '#666');
    c.restore();
    if (k < 1 && !p.restoring) { R(c, x - 3, y + 54, 3, 1, '#c9d6df'); R(c, x + 7, y + 55, 2, 1, '#c9d6df'); } // cacos da lâmpada
  }

  /* ------------------------------------------------------------------
   * Móveis e cenário (decor)
   * ------------------------------------------------------------------ */
  function decor(c, d, x, y, env) {
    const w = d.w, h = d.h;
    switch (d.type) {
      case 'geladeira': R(c, x, y, w, h, '#dfe3e6'); R(c, x, y, w, 1, '#f4f6f7'); R(c, x, y + 11, w, 1, '#a9b0b5'); R(c, x + w - 3, y + 4, 1, 5, '#9aa1a6'); R(c, x + w - 3, y + 15, 1, 8, '#9aa1a6'); R(c, x + w - 1, y, 1, h, '#b8bfc4'); R(c, x + 2, y + 14, 4, 3, '#e8c547'); break;
      case 'armario_alto': R(c, x, y, w, h, '#a87c52'); for (let i = 0; i < 3; i++) { R(c, x + i * 16 + 1, y + 1, 14, h - 2, '#b98d62'); R(c, x + i * 16 + 7, y + h - 4, 2, 1, '#6a4a2c'); } break;
      case 'bancada': R(c, x, y, w, 2, '#d9d4c7'); R(c, x, y + 2, w, h - 2, '#9a7350'); R(c, x + 1, y + 3, 14, h - 4, '#a8805b'); R(c, x + 17, y + 3, 14, h - 4, '#a8805b'); R(c, x + 33, y + 3, 14, h - 4, '#a8805b'); R(c, x + 7, y + 8, 2, 1, '#5a3d24'); R(c, x + 23, y + 8, 2, 1, '#5a3d24'); R(c, x + 39, y + 8, 2, 1, '#5a3d24'); R(c, x + 17, y, 14, 1, '#9fb2bd'); break;
      case 'torneira': R(c, x + 2, y + 1, 1, 6, '#b8c4cc'); R(c, x + 2, y, 4, 1, '#b8c4cc'); R(c, x + 5, y + 1, 1, 1, '#b8c4cc'); break;
      case 'estante': R(c, x, y, w, h, '#6e4b2e'); R(c, x + 1, y + 1, w - 2, h - 2, '#4a3220');
        for (const s of [10, 22, 34]) R(c, x + 1, y + s, w - 2, 1, '#8a6240');
        for (let i = 0; i < 6; i++) R(c, x + 8 + (i % 3) * 2, y + 4 + Math.floor(i / 3) * 0, 1, 6, ['#9b59b6', '#16a085', '#e67e22', '#2980b9', '#c0392b', '#f1c40f'][i]);
        R(c, x + 2, y + 28, 3, 6, '#2c3e50'); R(c, x + 6, y + 29, 3, 5, '#27ae60'); R(c, x + 10, y + 28, 4, 6, '#8e44ad'); break;
      case 'mesa': R(c, x, y, w, 2, '#8a5a2b'); R(c, x, y, w, 1, '#a46d38'); R(c, x + 1, y + 2, 2, h - 2, '#6a4220'); R(c, x + w - 3, y + 2, 2, h - 2, '#6a4220'); break;
      case 'notebook': R(c, x, y + 6, w, 1, '#3d3d46'); R(c, x + 1, y, w - 2, 6, '#2b2b33'); R(c, x + 2, y + 1, w - 4, 4, env.flags.notebookOn ? '#7fb3d5' : '#1b2533'); break;
      case 'celular': R(c, x, y, w, h, '#151518'); R(c, x + 1, y, 3, 1, '#2c3e50'); break;
      case 'caderno': R(c, x, y, w, h, '#2e5d4b'); R(c, x + 1, y, w - 2, 1, '#e9dfc9'); break;
      case 'mesinha': R(c, x, y, w, 2, '#7a5230'); R(c, x + 1, y + 2, 1, h - 2, '#5c3d22'); R(c, x + w - 2, y + 2, 1, h - 2, '#5c3d22'); break;
      case 'abajur': {
        const on = env.flags.abajurOn || env.flags.abajurGlow;
        const col = env.flags.abajurCor || '255,226,170';
        R(c, x + 3, y + 6, 2, 6, '#3b3b3b'); R(c, x + 2, y + 11, 4, 1, '#2b2b2b');
        R(c, x, y, 8, 6, on ? 'rgb(' + col + ')' : '#d9cdb4'); R(c, x + 1, y, 6, 1, on ? '#fff8e6' : '#e8dfc9');
        break;
      }
      case 'sofa': R(c, x, y + 2, w, h - 4, '#5b4a7a'); R(c, x + 2, y, w - 4, 7, '#6b5a8c'); R(c, x + 3, y + 7, w - 6, 3, '#7a69a0'); R(c, x + 15, y + 7, 1, 3, '#5b4a7a'); R(c, x, y + 5, 3, 7, '#4e3f6b'); R(c, x + w - 3, y + 5, 3, 7, '#4e3f6b'); R(c, x + 2, y + h - 2, 2, 2, '#2b2333'); R(c, x + w - 4, y + h - 2, 2, 2, '#2b2333'); break;
      case 'rack': R(c, x, y, w, h, '#3d3027'); R(c, x + 1, y + 2, w - 2, h - 3, '#2a211b'); R(c, x + 2, y + 4, 5, 2, '#111'); break;
      case 'tv': {
        R(c, x, y, w, h - 2, '#111317'); R(c, x + 6, y + h - 2, 2, 2, '#222');
        if (env.flags.tvOn) { const n = Math.floor(env.time * 8); R(c, x + 1, y + 1, w - 2, h - 4, n % 2 ? '#3a6ea5' : '#4a7eb5'); R(c, x + 2 + (n % 5), y + 3, 3, 2, '#f1c40f'); R(c, x + 1, y + h - 5, w - 2, 1, '#e74c3c'); }
        else R(c, x + 1, y + 1, w - 2, h - 4, '#1c232c');
        break;
      }
      case 'lustre': R(c, x + 3, y, 2, 2, '#444'); R(c, x, y + 2, 8, 3, env.lampOn ? '#fff1c9' : '#d8d2c2'); break;
      case 'luminaria': R(c, x, y, w, 2, '#ddd'); R(c, x + 1, y + 2, w - 2, 1, env.night > 0.2 ? '#fff6dc' : '#eee'); break;
      case 'interruptor': R(c, x, y, 3, 4, '#ece8de'); R(c, x + 1, y + (env.flags.luz_sala ? 1 : 2), 1, 1, '#888'); break;
      case 'guarda_roupa': R(c, x, y, w, h, '#8b5e3c'); R(c, x + 1, y + 1, w / 2 - 1, h - 2, '#9c6b45'); R(c, x + w / 2, y + 1, w / 2 - 1, h - 2, '#9c6b45'); R(c, x + w / 2 - 2, y + 16, 1, 4, '#3b2a1c'); R(c, x + w / 2 + 1, y + 16, 1, 4, '#3b2a1c'); break;
      case 'cama': R(c, x, y + 4, w, h - 4, '#6a4a32'); R(c, x + 1, y + 1, w - 2, 5, '#e9e4da'); R(c, x + 12, y + 1, w - 13, 5, '#5d7fa3'); R(c, x + 2, y - 1, 9, 4, '#f5f1e8'); R(c, x, y - 6, 2, h + 6, '#5a3d28'); R(c, x + w - 2, y - 2, 2, h + 2, '#5a3d28'); break;
      case 'janela_poco': R(c, x, y, w, h, '#4a4f55'); R(c, x + 1, y + 1, w - 2, h - 2, '#1f2428'); R(c, x + 2, y + 2, w - 4, h - 4, 'rgba(120,130,140,' + (0.25 + (1 - env.night) * 0.35) + ')'); R(c, x + w / 2, y + 1, 1, h - 2, '#4a4f55'); break;
      case 'porta_fundo': R(c, x - 1, y - 1, w + 2, h + 1, '#5a4636'); R(c, x, y, w, h, '#8a6a4f'); R(c, x + 2, y + 2, w - 4, 10, '#94735a'); R(c, x + 2, y + 14, w - 4, 12, '#94735a'); R(c, x + w - 3, y + 15, 2, 1, '#d4b16a');
        if (d.label && d.label.length <= 3) { c.fillStyle = '#e8d9b0'; c.font = '5px monospace'; c.textAlign = 'center'; c.fillText(d.label, x + w / 2, y + 8); }
        break;
      case 'cabideiro': R(c, x + 2, y, 2, h, '#5a3d28'); R(c, x, y + 2, 6, 1, '#5a3d28'); R(c, x, y + h - 1, 6, 1, '#5a3d28'); R(c, x - 1, y + 3, 4, 9, '#34495e'); break;
      case 'caixas_correio': R(c, x, y, w, h, '#7f878c'); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { R(c, x + 1 + i * 13, y + 1 + j * 9, 12, 8, '#98a1a6'); R(c, x + 4 + i * 13, y + 3 + j * 9, 6, 1, '#555c60'); } break;
      case 'planta': R(c, x + 2, y + 11, 6, 7, '#9c5a34'); R(c, x, y + 2, 4, 9, '#2f7d3a'); R(c, x + 4, y, 3, 11, '#3a9a47'); R(c, x + 6, y + 4, 4, 7, '#2f7d3a'); break;
      case 'tapete': R(c, x, y, w, h, '#7b2d26'); break;
      case 'caixa_dagua': R(c, x + 6, y + 30, 4, 10, '#555'); R(c, x + w - 10, y + 30, 4, 10, '#555'); R(c, x, y, w, 30, '#3a6c9a'); R(c, x, y, w, 3, '#5a8cba'); R(c, x + 4, y + 8, w - 8, 1, '#2e5a82'); R(c, x + 4, y + 18, w - 8, 1, '#2e5a82'); break;
      case 'antena': R(c, x + 6, y, 2, h, '#666'); R(c, x, y + 4, 14, 1, '#777'); R(c, x + 2, y + 10, 10, 1, '#777'); R(c, x + 4, y + 16, 6, 1, '#777'); break;
      case 'espelho': R(c, x, y, w, h, '#c9d3d9'); R(c, x + 1, y + 1, w - 2, h - 2, '#9fb3c2'); R(c, x + 2, y + 2, 3, 6, '#d8e5ee'); break;
      case 'pia_banheiro': R(c, x, y, w, 3, '#f1f1f1'); R(c, x + 4, y + 3, 4, h - 3, '#e2e2e2'); break;
      case 'vaso': R(c, x, y + 4, w, 5, '#f3f3f3'); R(c, x + 2, y + 9, w - 4, 3, '#e0e0e0'); R(c, x + w - 3, y - 4, 3, 8, '#f3f3f3'); break;
      case 'chuveiro': R(c, x + 4, y, 1, 6, '#b8c4cc'); R(c, x + 2, y + 6, 6, 2, '#b8c4cc'); R(c, x, y + 8, 10, h - 8, 'rgba(180,220,240,0.15)'); break;
      case 'outdoor': R(c, x + 10, y + h - 40, 3, 40, '#5a5a5a'); R(c, x + w - 13, y + h - 40, 3, 40, '#5a5a5a'); R(c, x, y, w, h - 40, '#f2efe6'); R(c, x + 2, y + 2, w - 4, h - 44, '#d9534f');
        c.fillStyle = '#fff'; c.font = '10px monospace'; c.textAlign = 'center'; c.fillText('ALUGA-SE', x + w / 2, y + (h - 40) / 2 + 4); break;
      case 'manilha': R(c, x, y, w, h, '#9a9a96'); R(c, x + 3, y + 3, w - 6, h - 6, '#5e5e5a'); R(c, x + 6, y + 6, w - 12, h - 12, '#3f3f3c'); break;
      case 'cone': R(c, x + 2, y, 2, 2, '#e67e22'); R(c, x + 1, y + 2, 4, 2, '#f5f5f5'); R(c, x + 1, y + 4, 4, 3, '#e67e22'); R(c, x, y + 7, 6, 1, '#333'); break;
      case 'faixa': for (let i = 0; i < w; i += 8) R(c, x + i, y, 5, 1, '#f1f1ea'); break;
      case 'poste_ok': R(c, x + 6, y + 6, 2, h - 6, '#2f3439'); R(c, x + 6, y + 4, 8, 2, '#2f3439'); R(c, x + 10, y + 6, 4, 3, '#3b4249'); R(c, x + 11, y + 8, 2, 1, env.night > 0.25 ? '#ffe6a8' : '#888'); R(c, x + 4, y + h - 3, 6, 3, '#262a2e'); break;
      case 'carro': { const col = d.cor || '#7d2e2e'; R(c, x + 2, y + 6, w - 4, 7, col); R(c, x + 8, y + 1, w - 18, 6, col); R(c, x + 10, y + 2, 7, 4, '#9fc3d6'); R(c, x + 19, y + 2, 7, 4, '#9fc3d6'); R(c, x + 5, y + 12, 6, 4, '#151515'); R(c, x + w - 11, y + 12, 6, 4, '#151515'); R(c, x + w - 4, y + 7, 2, 2, '#ffd166'); break; }
      case 'ponto': R(c, x, y, w, 3, '#5b6b75'); R(c, x + 2, y + 3, 2, h - 3, '#5b6b75'); R(c, x + w - 4, y + 3, 2, h - 3, '#5b6b75'); R(c, x + 6, y + 6, 18, 16, '#f0f0e8'); R(c, x + 7, y + 7, 16, 14, '#9ec5e8'); R(c, x + 6, y + h - 10, w - 10, 2, '#7a8a94'); break;
      case 'barreira': for (let i = 0; i < w; i += 6) R(c, x + i, y + 2, 4, 4, (i / 6) % 2 ? '#f5f5f5' : '#e74c3c'); R(c, x + 2, y + 6, 2, h - 6, '#555'); R(c, x + w - 4, y + 6, 2, h - 6, '#555'); break;
      case 'arvore': R(c, x + w / 2 - 3, y + 34, 6, h - 34, '#6b4a2f'); R(c, x + w / 2 - 1, y + 34, 2, h - 34, '#7d5a3a');
        for (const [a, b, r, col] of [[0.5, 0.25, 22, '#2f7d3a'], [0.25, 0.35, 15, '#2a6e33'], [0.75, 0.35, 16, '#2a6e33'], [0.45, 0.15, 14, '#3a9a47'], [0.62, 0.22, 10, '#46ad54']]) {
          c.fillStyle = col; c.beginPath(); c.arc(Math.round(x + w * a), Math.round(y + h * b), r, 0, Math.PI * 2); c.fill();
        }
        break;
      case 'arbusto': c.fillStyle = '#2f7d3a'; c.beginPath(); c.ellipse(Math.round(x + w / 2), Math.round(y + h), w / 2, h, 0, Math.PI, 0); c.fill(); R(c, x + w / 2 - 2, y + 2, 3, 2, '#46ad54'); break;
      case 'banco_ok': bench(c, x, y, { broken: false }); break;
      case 'placa': R(c, x + 8, y + 8, 2, h - 8, '#555'); R(c, x, y, w, 9, '#2e7d4a'); c.fillStyle = '#fff'; c.font = '5px monospace'; c.textAlign = 'center'; c.fillText(d.text || '', x + w / 2, y + 6); break;
      case 'letreiro': R(c, x, y, w, h, '#7a2e1f'); R(c, x + 1, y + 1, w - 2, h - 2, '#a63d28'); c.fillStyle = '#ffe9b0'; c.font = '8px monospace'; c.textAlign = 'center'; c.fillText(d.text || '', x + w / 2, y + 9); break;
      case 'prateleira_pao': R(c, x, y, w, h, '#7a5230'); for (let j = 0; j < 2; j++) { R(c, x + 1, y + 7 + j * 8, w - 2, 1, '#9c6b3e'); for (let i = 0; i < 9; i++) R(c, x + 3 + i * 7, y + 3 + j * 8, 5, 3, '#d9a05b'); } break;
      case 'balcao': R(c, x, y, w, 3, '#d9d4c7'); R(c, x, y + 3, w, h - 3, '#a0522d'); R(c, x + 3, y + 5, w - 6, h - 8, '#b5653a'); R(c, x + 6, y - 6, 12, 6, 'rgba(200,230,255,0.4)'); R(c, x + 7, y - 4, 4, 2, '#d9a05b'); R(c, x + 12, y - 4, 4, 2, '#e8c07a'); break;
      case 'mesa_bar': R(c, x, y, w, 2, '#c0c0c0'); R(c, x + w / 2 - 1, y + 2, 2, h - 3, '#888'); R(c, x + w / 2 - 4, y + h - 1, 8, 1, '#666'); break;
      default: break;
    }
  }

  /* ------------------------------------------------------------------
   * Ícones dos poderes e itens (16×16, desenhados em canvases pequenos)
   * ------------------------------------------------------------------ */
  function icon(c, id) {
    c.clearRect(0, 0, 16, 16);
    const P = (x, y, w, h, col) => R(c, x, y, w, h, col);
    switch (id) {
      case 'levitar': P(6, 3, 5, 6, '#cfe9ff'); P(6, 3, 5, 1, '#fff'); P(4, 12, 9, 1, '#9fd8ff'); P(5, 11, 1, 1, '#9fd8ff'); P(11, 11, 1, 1, '#9fd8ff'); P(8, 10, 1, 1, '#9fd8ff'); break;
      case 'restaurar': c.strokeStyle = '#ffd27a'; c.lineWidth = 2; c.beginPath(); c.arc(8, 8, 5, 0.6, Math.PI * 1.9); c.stroke(); P(2, 3, 4, 2, '#ffd27a'); P(2, 3, 2, 4, '#ffd27a'); break;
      case 'deslocar': P(2, 9, 3, 3, '#c39bff'); for (let i = 0; i < 4; i++) P(5 + i * 2, 8 - i, 1, 1, '#c39bff'); P(11, 3, 4, 4, '#e3d1ff'); break;
      case 'transformar': P(2, 11, 5, 2, '#c3cbd2'); P(7, 8, 2, 3, '#c3cbd2'); P(9, 5, 4, 4, '#e3e9ee'); P(12, 2, 2, 2, '#7fe3a0'); P(3, 3, 1, 1, '#7fe3a0'); break;
      case 'criar': P(5, 5, 6, 7, '#ff9a1f'); P(4, 6, 8, 5, '#ff9a1f'); P(6, 6, 2, 2, '#ffd08a'); P(8, 3, 3, 2, '#3f9b3a'); P(2, 2, 1, 1, '#fff'); P(13, 4, 1, 1, '#fff'); break;
      case 'perceber': P(2, 7, 12, 3, '#6fe0ff'); P(4, 6, 8, 5, '#6fe0ff'); P(6, 6, 4, 5, '#0b2a3a'); P(7, 7, 2, 2, '#fff'); break;
      case 'laranja': P(5, 5, 6, 7, '#ff9a1f'); P(4, 6, 8, 5, '#ff9a1f'); P(6, 6, 2, 2, '#ffd08a'); P(8, 3, 3, 2, '#3f9b3a'); break;
      case 'gelo': P(3, 5, 10, 7, '#cfeaff'); P(4, 6, 8, 5, '#a7d4f2'); P(6, 3, 4, 2, '#5d7fa3'); break;
      case 'pao': P(2, 7, 12, 5, '#d9a05b'); P(3, 6, 10, 1, '#e8c07a'); P(5, 8, 1, 2, '#b07a3a'); P(8, 8, 1, 2, '#b07a3a'); P(11, 8, 1, 2, '#b07a3a'); break;
      case 'chave': P(2, 6, 5, 5, '#d4b16a'); P(3, 7, 3, 3, '#1b1b1b'); P(7, 8, 7, 1, '#d4b16a'); P(11, 9, 1, 2, '#d4b16a'); P(13, 9, 1, 2, '#d4b16a'); break;
      default: P(4, 4, 8, 8, '#888');
    }
  }

  G.Sprites = { human, dog, moto, pigeon, prop, decor, icon, bench, lampPost, PAL_V };
})(window.VG = window.VG || {});

/* =====================================================================
 * Física de corpos retangulares (AABB) contra blocos e outros corpos.
 * - Movimento em sub‑passos de no máximo 4 px: nada atravessa um bloco
 *   de 16 px, mesmo em queda rápida.
 * - Eixos resolvidos separadamente (X depois Y) para não prender nas
 *   quinas das paredes.
 * - Plataformas de mão única (patamares) só seguram quem vem de cima.
 * ===================================================================== */
(function (G) {
  'use strict';
  const TS = G.TILE;
  const EPS = 0.001;

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  const Physics = {
    /**
     * Move o corpo b pelo seu vx/vy durante dt.
     * o.solids   : corpos que bloqueiam por todos os lados
     * o.platforms: corpos de mão única (bloqueiam só por cima)
     * o.surfaces : tampos de mão única (retângulos {x,y,w})
     * o.dropThrough: ignora mão única (descer do patamar)
     * o.onPush(s, d): chamado quando b empurra um sólido na horizontal
     */
    move(b, world, o) {
      b.onGround = false; b.hitWall = 0; b.hitCeil = false;
      b.impactY = 0; b.impactX = 0; b.groundRef = null;
      const dx = b.vx * o.dt, dy = b.vy * o.dt;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
      const sx = dx / steps, sy = dy / steps;
      let bx = false, by = false;
      for (let i = 0; i < steps; i++) {
        if (sx && !bx) bx = this._mx(b, world, sx, o);
        if (sy && !by) by = this._my(b, world, sy, o);
      }
      // corpo parado exatamente sobre o chão continua "no chão"
      if (!b.onGround && b.vy >= 0 && this.groundBelow(b, world, o)) b.onGround = true;
      return b;
    },

    _mx(b, world, d, o) {
      b.x += d;
      const maxX = world.w * TS;
      if (b.x < 0) { b.x = 0; return this._stopX(b, d); }
      if (b.x + b.w > maxX) { b.x = maxX - b.w; return this._stopX(b, d); }
      const y0 = Math.floor(b.y / TS), y1 = Math.floor((b.y + b.h - EPS) / TS);
      const tx = d > 0 ? Math.floor((b.x + b.w - EPS) / TS) : Math.floor(b.x / TS);
      for (let ty = y0; ty <= y1; ty++) {
        if (!world.isSolid(tx, ty)) continue;
        // degrau baixo (quina de laje no fim da escada): sobe até o.stepUp px
        const rise = b.y + b.h - ty * TS;
        if (o.stepUp && o.grounded && rise > 0 && rise <= o.stepUp && world.rectFree({ x: b.x, y: b.y - rise, w: b.w, h: b.h })) { b.y -= rise; break; }
        b.x = d > 0 ? tx * TS - b.w : (tx + 1) * TS;
        return this._stopX(b, d);
      }
      if (o.solids) {
        for (const s of o.solids) {
          if (s === b || !overlaps(b, s)) continue;
          if (o.onPush) o.onPush(s, d);
          b.x = d > 0 ? s.x - b.w : s.x + s.w;
          return this._stopX(b, d);
        }
      }
      return false;
    },
    _stopX(b, d) { b.impactX = Math.abs(b.vx); b.hitWall = d > 0 ? 1 : -1; b.vx = 0; return true; },

    _my(b, world, d, o) {
      const prevBottom = b.y + b.h, prevTop = b.y;
      b.y += d;
      const x0 = Math.floor(b.x / TS), x1 = Math.floor((b.x + b.w - EPS) / TS);
      if (d > 0) {
        const ty = Math.floor((b.y + b.h - EPS) / TS);
        const top = ty * TS;
        for (let tx = x0; tx <= x1; tx++) {
          const df = world.def(tx, ty);
          if (df.solid || (df.oneWay && !o.dropThrough && prevBottom <= top + 0.01)) {
            b.y = top - b.h; return this._land(b, null);
          }
        }
        if (o.solids) for (const s of o.solids) {
          if (s === b || !overlaps(b, s)) continue;
          if (prevBottom <= s.y + 0.01) { b.y = s.y - b.h; return this._land(b, s); }
        }
        if (o.platforms && !o.dropThrough) for (const s of o.platforms) {
          if (s === b || !overlaps(b, s)) continue;
          if (prevBottom <= s.y + 0.01) { b.y = s.y - b.h; return this._land(b, s); }
        }
        if (o.surfaces && !o.dropThrough) for (const s of o.surfaces) {
          if (b.x < s.x + s.w && b.x + b.w > s.x && prevBottom <= s.y + 0.01 && b.y + b.h > s.y) {
            b.y = s.y - b.h; return this._land(b, null);
          }
        }
      } else {
        const ty = Math.floor(b.y / TS);
        for (let tx = x0; tx <= x1; tx++) {
          if (world.isSolid(tx, ty)) { b.y = (ty + 1) * TS; return this._ceil(b); }
        }
        if (o.solids) for (const s of o.solids) {
          if (s === b || !overlaps(b, s)) continue;
          if (prevTop >= s.y + s.h - 0.01) { b.y = s.y + s.h; return this._ceil(b); }
        }
      }
      return false;
    },
    _land(b, ref) {
      b.impactY = Math.max(b.impactY, b.vy); b.vy = 0; b.onGround = true; b.groundRef = ref; return true;
    },
    _ceil(b) { b.impactY = Math.max(b.impactY, -b.vy); b.vy = 0; b.hitCeil = true; return true; },

    /** Há apoio a 1 px abaixo dos pés? */
    groundBelow(b, world, o) {
      const y = b.y + b.h + 0.5;
      const ty = Math.floor(y / TS);
      const x0 = Math.floor(b.x / TS), x1 = Math.floor((b.x + b.w - EPS) / TS);
      for (let tx = x0; tx <= x1; tx++) {
        const df = world.def(tx, ty);
        if (df.solid) return true;
        if (df.oneWay && !o.dropThrough && Math.abs(b.y + b.h - ty * TS) < 0.5) return true;
      }
      const probe = { x: b.x, y: b.y + b.h, w: b.w, h: 1 };
      const lists = [o.solids, o.dropThrough ? null : o.platforms];
      for (const L of lists) if (L) for (const s of L) {
        if (s !== b && overlaps(probe, s) && Math.abs(b.y + b.h - s.y) < 0.5) { b.groundRef = s; return true; }
      }
      if (o.surfaces && !o.dropThrough) for (const s of o.surfaces) {
        if (b.x < s.x + s.w && b.x + b.w > s.x && Math.abs(b.y + b.h - s.y) < 0.5) return true;
      }
      return false;
    },

    /** Superfícies de degrau (px, y) na coluna px entre y0 e y1. */
    slopeSurfaces(world, px, y0, y1) {
      const out = [];
      const tx = Math.floor(px / TS), lx = px - tx * TS;
      for (let ty = Math.floor(y0 / TS); ty <= Math.floor(y1 / TS); ty++) {
        const sl = world.def(tx, ty).slope;
        if (!sl) continue;
        const top = ty * TS;
        out.push(sl === 'L' ? top + lx : sl === 'R' ? top + TS - lx : top);
      }
      return out;
    },

    /**
     * Degraus no estilo Terraria: depois do movimento normal, apoia os pés de b
     * na superfície inclinada sob o centro do corpo.
     * o.prevFeet, o.wasGround, o.prefer ('up' | 'down')
     * Retorna 'snap', 'blocked' (teto impede subir) ou null.
     */
    resolveSlope(b, world, o) {
      if (b.vy < 0) return null;                 // subindo (pulo/voo): atravessa os degraus
      const px = b.x + b.w / 2, feet = b.y + b.h;
      const maxUp = 9, maxDown = o.wasGround ? 9 : 0;
      const cands = [];
      for (const sy of this.slopeSurfaces(world, px, feet - 20, feet + 12)) {
        if (b.onGround && sy > feet + 0.5) continue;   // já apoiado em algo mais alto
        if (b.onGround && o.prefer === 'down' && sy < feet - 0.5) continue; // no chão firme segurando S: espera o degrau de descida
        let ok;
        if (o.wasGround) ok = sy >= feet - maxUp && sy <= feet + maxDown;
        else ok = o.prevFeet <= sy + 2 && feet >= sy - 2;
        if (ok) cands.push(sy);
      }
      if (!cands.length) return null;
      cands.sort((a, c) => Math.abs(a - feet) - Math.abs(c - feet));
      let sy = cands[0];
      for (const c of cands) {
        if (Math.abs(Math.abs(c - feet) - Math.abs(sy - feet)) > 1.6) continue;
        if (o.prefer === 'down' ? c > sy : c < sy) sy = c;   // bifurcação: escolhe pelo sentido
      }
      if (!world.rectFree({ x: b.x, y: sy - b.h, w: b.w, h: b.h })) {
        if (sy < feet - 0.01) return 'blocked';
        // descendo rente à quina de uma laje: apoia no topo do bloco
        const top = Math.floor(sy / TS) * TS;
        if (top >= feet - 0.01 && world.rectFree({ x: b.x, y: top - b.h, w: b.w, h: b.h })) sy = top;
        else return null;
      }
      b.y = sy - b.h;
      if (b.vy > 0) b.impactY = Math.max(b.impactY || 0, b.vy);
      b.vy = 0; b.onGround = true; b.onSlope = true;
      return 'snap';
    },

    /** Empurra para fora um corpo que, por algum motivo, começou dentro de blocos sólidos. */
    unstick(b, world) {
      if (world.rectFree(b)) return false;
      for (let r = 1; r <= 48; r++) {
        for (const [ox, oy] of [[0, -r], [r, 0], [-r, 0], [0, r]]) {
          const c = { x: b.x + ox, y: b.y + oy, w: b.w, h: b.h };
          if (world.rectFree(c)) { b.x = c.x; b.y = c.y; return true; }
        }
      }
      return false;
    },
    overlaps,
  };
  G.Physics = Physics;
})(window.VG = window.VG || {});

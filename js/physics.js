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
      if (d > 0) {
        const tx = Math.floor((b.x + b.w - EPS) / TS);
        for (let ty = y0; ty <= y1; ty++) if (world.isSolid(tx, ty)) { b.x = tx * TS - b.w; return this._stopX(b, d); }
      } else {
        const tx = Math.floor(b.x / TS);
        for (let ty = y0; ty <= y1; ty++) if (world.isSolid(tx, ty)) { b.x = (tx + 1) * TS; return this._stopX(b, d); }
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

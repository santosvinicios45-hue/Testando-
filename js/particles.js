/* =====================================================================
 * Partículas leves: poeira, faíscas de poder, glifos de tempo, anéis.
 * ===================================================================== */
(function (G) {
  'use strict';
  const U = G.util;
  const MAX = 700;

  class Particles {
    constructor() { this.list = []; }
    add(p) {
      if (this.list.length >= MAX) this.list.shift();
      this.list.push(Object.assign({ vx: 0, vy: 0, g: 0, drag: 0, life: 1, t: 0, size: 1, color: '#fff', kind: 'px', alpha: 1 }, p));
    }
    burst(x, y, n, o) {
      o = o || {};
      for (let i = 0; i < n; i++) {
        const a = U.rand(0, Math.PI * 2), s = U.rand(0.3, 1) * (o.speed || 40);
        this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up || 0), g: o.g || 0, drag: 2, life: U.rand(0.5, 1) * (o.life || 0.6), color: o.color || '#fff', size: o.size || 1 });
      }
    }
    dust(x, y, n) {
      for (let i = 0; i < n; i++) this.add({ x: x + U.rand(-4, 4), y, vx: U.rand(-25, 25), vy: U.rand(-18, -4), drag: 3, life: U.rand(0.25, 0.5), color: 'rgba(210,200,185,0.8)', size: 1 });
    }
    spark(x, y, color) {
      this.add({ x, y, vx: U.rand(-12, 12), vy: U.rand(-20, -5), drag: 1.5, life: U.rand(0.3, 0.7), color: color || '#9fd8ff', size: 1 });
    }
    glyph(x, y) { this.add({ x, y, vx: U.rand(-6, 6), vy: U.rand(-14, -4), life: 0.6, color: '#ffd27a', kind: 'glyph', size: 1 }); }
    ring(x, y, color, r) { this.add({ x, y, life: 0.5, color: color || '#ffd27a', kind: 'ring', size: r || 18 }); }
    line(x, y, color) { this.add({ x, y, life: 0.25, color, kind: 'thread', vx: U.rand(-1, 1) }); }

    update(dt) {
      const L = this.list;
      for (let i = L.length - 1; i >= 0; i--) {
        const p = L[i];
        p.t += dt;
        if (p.t >= p.life) { L.splice(i, 1); continue; }
        p.vy += p.g * dt;
        if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
    }

    draw(ctx, cam) {
      for (const p of this.list) {
        const k = 1 - p.t / p.life;
        const x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y);
        if (x < -30 || y < -30 || x > G.VIEW_W + 30 || y > G.VIEW_H + 30) continue;
        ctx.globalAlpha = Math.max(0, k * p.alpha);
        if (p.kind === 'px') { ctx.fillStyle = p.color; ctx.fillRect(x, y, p.size, p.size); }
        else if (p.kind === 'glyph') {
          // pequeno ponteiro de relógio girando ao contrário
          ctx.strokeStyle = p.color; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(x + 0.5, y + 0.5, 2, 0, Math.PI * 2); ctx.stroke();
          const a = -p.t * 12;
          ctx.beginPath(); ctx.moveTo(x + 0.5, y + 0.5); ctx.lineTo(x + 0.5 + Math.cos(a) * 2, y + 0.5 + Math.sin(a) * 2); ctx.stroke();
        } else if (p.kind === 'ring') {
          ctx.strokeStyle = p.color; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(x, y, (1 - k) * p.size + 2, 0, Math.PI * 2); ctx.stroke();
        } else if (p.kind === 'thread') {
          ctx.strokeStyle = p.color; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + p.vx * 30, G.VIEW_H); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }
  }
  G.Particles = Particles;
})(window.VG = window.VG || {});

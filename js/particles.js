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
      if (Math.random() < 0.25) this.add({ x, y, vx: U.rand(-8, 8), vy: U.rand(-16, -4), drag: 1.5, life: U.rand(0.35, 0.7), color: color || '#9fd8ff', size: 1.5, kind: 'star' });
      else this.add({ x, y, vx: U.rand(-12, 12), vy: U.rand(-20, -5), drag: 1.5, life: U.rand(0.3, 0.7), color: color || '#9fd8ff', size: 0.5 });
    }
    leaf(x, y, color) { this.add({ x, y, vx: U.rand(-10, 4), vy: U.rand(6, 12), life: U.rand(3, 5), color: color || '#5d9e4c', kind: 'leaf', seed: Math.random() * 6 }); }
    steam(x, y) { this.add({ x, y, vx: U.rand(-2, 2), vy: U.rand(-9, -6), life: U.rand(1.5, 2.4), color: '#ffffff', kind: 'steam' }); }
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
        if (p.kind === 'leaf') p.x += Math.sin(p.t * 2.5 + p.seed) * 14 * dt;
      }
    }

    draw(ctx, cam) {
      // partículas na grade fina (o dobro de pixels do mundo)
      G.hi(ctx, (S) => {
        for (const p of this.list) {
          const k = 1 - p.t / p.life;
          const x = Math.round((p.x - cam.x) * S), y = Math.round((p.y - cam.y) * S);
          if (x < -60 || y < -60 || x > G.VIEW_W * S + 60 || y > G.VIEW_H * S + 60) continue;
          ctx.globalAlpha = Math.max(0, k * p.alpha);
          if (p.kind === 'px') {
            const sz = Math.max(1, Math.round(p.size * S * (0.5 + 0.5 * k)));
            ctx.fillStyle = p.color; ctx.fillRect(x, y, sz, sz);
            // faíscas rápidas deixam um rastro curto
            const sp = Math.abs(p.vx) + Math.abs(p.vy);
            if (sp > 30 && p.size <= 1) { ctx.globalAlpha *= 0.5; ctx.fillRect(Math.round(x - p.vx * 0.02 * S), Math.round(y - p.vy * 0.02 * S), 1, 1); }
          } else if (p.kind === 'glyph') {
            // ponteiro de relógio girando ao contrário
            ctx.strokeStyle = p.color; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(x + 0.5, y + 0.5, 4, 0, Math.PI * 2); ctx.stroke();
            const a = -p.t * 12;
            ctx.beginPath(); ctx.moveTo(x + 0.5, y + 0.5); ctx.lineTo(x + 0.5 + Math.cos(a) * 3.5, y + 0.5 + Math.sin(a) * 3.5); ctx.stroke();
          } else if (p.kind === 'ring') {
            ctx.strokeStyle = p.color; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(x, y, ((1 - k) * p.size + 2) * S, 0, Math.PI * 2); ctx.stroke();
          } else if (p.kind === 'thread') {
            ctx.strokeStyle = p.color; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + p.vx * 30 * S, G.VIEW_H * S); ctx.stroke();
          } else if (p.kind === 'star') {
            const r = Math.max(1, Math.round(p.size * S * k));
            ctx.fillStyle = p.color; ctx.fillRect(x - r, y, r * 2 + 1, 1); ctx.fillRect(x, y - r, 1, r * 2 + 1);
            ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1);
          } else if (p.kind === 'leaf') {
            const a = p.t * 4 + (p.seed || 0);
            ctx.fillStyle = p.color; ctx.fillRect(x, y, 2, 1); ctx.fillRect(x + (Math.sin(a) > 0 ? 1 : 0), y + 1, 2, 1);
          } else if (p.kind === 'steam') {
            const r = Math.round((1.5 + (1 - k) * 4) * S / 2);
            ctx.globalAlpha = Math.max(0, k * 0.35); ctx.fillStyle = p.color;
            ctx.fillRect(x - r, y - r + 1, r * 2, r * 2 - 2); ctx.fillRect(x - r + 1, y - r, r * 2 - 2, r * 2);
          }
        }
        ctx.globalAlpha = 1;
      });
    }
  }
  G.Particles = Particles;
})(window.VG = window.VG || {});

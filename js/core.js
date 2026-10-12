/* =====================================================================
 * V: O Arquiteto da Realidade — núcleo
 * Namespace global, constantes e utilitários sem dependência de DOM.
 * Todos os módulos usam o padrão (function (G) { ... })(window.VG)
 * para funcionar abrindo index.html direto do disco (file://), sem
 * servidor e sem módulos ES.
 * ===================================================================== */
(function (G) {
  'use strict';

  G.VERSION = '0.1.0-etapa1';
  G.PH = 32;            // altura da caixa de colisão das pessoas (≈ 1,8 m)
  G.TILE = 16;          // 1 bloco = 16 px ≈ 1 metro
  G.VIEW_W = 240;       // área do mundo visível (unidades do mundo; 16 = 1 bloco)
  G.VIEW_H = 135;
  G.HI = 2;             // cada unidade do mundo vira 2×2 pixels finos (personagens, blocos e efeitos usam a grade fina)
  /** Desenha em fn com 1 unidade = 1 pixel fino (coordenadas do mundo × G.HI). */
  G.hi = function (c, fn) { c.save(); c.scale(1 / G.HI, 1 / G.HI); try { fn(G.HI); } finally { c.restore(); } };
  G.STEP = 1 / 60;      // passo fixo da simulação
  G.CLOCK_RATE = 1;     // minutos de jogo por segundo real

  const U = G.util = {};
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.approach = (v, target, amt) => (v < target ? Math.min(v + amt, target) : Math.max(v - amt, target));
  U.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  U.pointIn = (px, py, r) => px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h;
  U.easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  U.easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  U.deepClone = (o) => JSON.parse(JSON.stringify(o));

  /** Hash determinístico 0..1 para texturas procedurais estáveis. */
  U.hash = (x, y, s) => {
    let h = (x * 374761393 + y * 668265263 + (s || 0) * 982451653) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  /** Formata minutos do dia como HH:MM. */
  U.fmtClock = (min) => {
    const m = ((Math.floor(min) % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  };

  let uidN = 0;
  U.uid = (p) => (p || 'id') + '_' + (++uidN) + '_' + Math.floor(Math.random() * 1e6).toString(36);

  G.WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  /** O dia 1 da história é uma terça-feira de janeiro (cap. 1 e 8). */
  G.weekdayOf = (day) => G.WEEKDAYS[(2 + (day - 1)) % 7];

  /** Barramento de eventos simples. Erros em ouvintes são registrados, não engolidos em silêncio. */
  class Events {
    constructor() { this.map = {}; this.errors = []; }
    on(t, f) { (this.map[t] = this.map[t] || []).push(f); return () => this.off(t, f); }
    off(t, f) { const a = this.map[t]; if (a) { const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); } }
    emit(t, d) {
      const run = (f, args) => {
        try { f.apply(null, args); } catch (e) { this.errors.push(e); console.error('[V] erro em evento', t, e); }
      };
      const a = this.map[t];
      if (a) a.slice().forEach((f) => run(f, [d]));
      const s = this.map['*'];
      if (s) s.slice().forEach((f) => run(f, [t, d]));
    }
    clear() { this.map = {}; }
  }
  G.Events = Events;
})(window.VG = window.VG || {});

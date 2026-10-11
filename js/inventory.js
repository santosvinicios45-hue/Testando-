/* =====================================================================
 * Bolsos de V (inventário com slots e pilhas).
 * A Etapa 2 amplia isto para mineração/fabricação; a API (add, remove,
 * count, has, use) já é a definitiva.
 * ===================================================================== */
(function (G) {
  'use strict';

  /** Catálogo de itens. use(game) devolve true se o item foi consumido. */
  G.ITEMS = {
    laranja_perfeita: {
      name: 'Laranja perfeita', stack: 6, icon: 'laranja',
      desc: '"Laranja demais, se é que isso faz sentido." (cap. 1)',
      actions: ['Comer', 'Largar'],
      use(g) {
        g.powers.tension = Math.max(0, g.powers.tension - 30);
        g.powers.setEmotion('calmo');
        g.bubble('Era boa. Perfeita de um jeito levemente errado.', 3);
        g.audio.play('pickup');
        g.bus.emit('eat', { item: 'laranja_perfeita' });
        return true;
      },
      drop: 'laranja',
    },
    bolsa_gelo: {
      name: 'Bolsa de gelo', stack: 1, icon: 'gelo',
      desc: 'Para a testa. Depois de bater no teto tentando voar.',
      actions: ['Usar'],
      use(g) { g.player.stun = 0; g.bubble('Frio. Humilhante. Funciona.', 2); g.bus.emit('use', { item: 'bolsa_gelo' }); return false; },
    },
    pao_frances: {
      name: 'Pão francês', stack: 6, icon: 'pao',
      desc: 'Conteúdo original do jogo. Pão comum, de padaria comum.',
      actions: ['Comer', 'Largar'], drop: 'pao',
      use(g) { g.powers.tension = Math.max(0, g.powers.tension - 10); g.bubble('Pão. Normal. Maravilhosamente normal.', 2.5, true); g.bus.emit('eat', { item: 'pao_frances' }); return true; },
    },
    maca: {
      name: 'Maçã perfeita', stack: 6, icon: 'maca', desc: 'Conteúdo original do jogo. Vermelha demais. Nenhuma marca, nenhum bicho.', actions: ['Comer', 'Largar'], drop: 'maca',
      use(g) { g.powers.tension = Math.max(0, g.powers.tension - 20); g.bubble('Crocante. Simétrica. Um pouco assustadora.', 2.5, true); g.audio.play('pickup'); g.bus.emit('eat', { item: 'maca' }); return true; },
    },
    banana: {
      name: 'Banana perfeita', stack: 6, icon: 'banana', desc: 'Conteúdo original do jogo. Amarela sem uma pinta sequer.', actions: ['Comer', 'Largar'], drop: 'banana',
      use(g) { g.powers.tension = Math.max(0, g.powers.tension - 20); g.bubble('Banana. Do jeito que banana devia ser e nunca é.', 2.5, true); g.audio.play('pickup'); g.bus.emit('eat', { item: 'banana' }); return true; },
    },
    cafe: {
      name: 'Café', stack: 6, icon: 'cafe', desc: 'Conteúdo original do jogo. Quente, no ponto, sem açúcar.', actions: ['Comer', 'Largar'], drop: 'cafe',
      use(g) { g.powers.tension = Math.max(0, g.powers.tension - 25); g.bubble('O café que ele ainda não tinha feito. Agora tinha.', 2.5, true); g.audio.play('pickup'); g.bus.emit('eat', { item: 'cafe' }); return true; },
    },
    chocolate: {
      name: 'Chocolate', stack: 6, icon: 'chocolate', desc: 'Conteúdo original do jogo. Barra de chocolate ao leite.', actions: ['Comer', 'Largar'], drop: 'chocolate',
      use(g) { g.powers.tension = Math.max(0, g.powers.tension - 15); g.bubble('Doce demais. Igualzinho ao da infância.', 2.5, true); g.audio.play('pickup'); g.bus.emit('eat', { item: 'chocolate' }); return true; },
    },
    sonho: {
      name: 'Sonho de padaria', stack: 6, icon: 'sonho', desc: 'Conteúdo original do jogo. Recheado de creme, polvilhado de açúcar.', actions: ['Comer', 'Largar'], drop: null,
      use(g) { g.powers.tension = Math.max(0, g.powers.tension - 15); g.bubble('Açúcar na camisa inteira. Valeu a pena.', 2.5, true); g.audio.play('pickup'); g.bus.emit('eat', { item: 'sonho' }); return true; },
    },
    bala: {
      name: 'Bala de goma', stack: 6, icon: 'bala', desc: 'Conteúdo original do jogo. Presente da senhora da chave.', actions: ['Comer', 'Largar'], drop: null,
      use(g) { g.powers.tension = Math.max(0, g.powers.tension - 5); g.bubble('Bala de goma. Gosto de domingo.', 2.5, true); g.audio.play('pickup'); g.bus.emit('eat', { item: 'bala' }); return true; },
    },
    pacote: { name: 'Pacote do 32', stack: 1, icon: 'pacote', desc: 'Conteúdo original do jogo. Uma entrega para o apartamento 32. Leve ao porteiro.', actions: [] },
    chave_terraco: {
      name: 'Chave do terraço', stack: 1, icon: 'chave',
      desc: 'Conteúdo original do jogo. Abre o alçapão no topo da escada.',
      actions: [],
    },
  };

  class Inventory {
    constructor(size) { this.size = size || 12; this.slots = new Array(this.size).fill(null); }
    count(id) { return this.slots.reduce((n, s) => n + (s && s.id === id ? s.n : 0), 0); }
    has(id, n) { return this.count(id) >= (n || 1); }
    /** Adiciona; devolve quantos NÃO couberam. */
    add(id, n) {
      const def = G.ITEMS[id];
      if (!def) throw new Error('Item desconhecido: ' + id);
      n = n || 1;
      for (const s of this.slots) {
        if (n <= 0) break;
        if (s && s.id === id && s.n < def.stack) { const k = Math.min(n, def.stack - s.n); s.n += k; n -= k; }
      }
      for (let i = 0; i < this.size && n > 0; i++) {
        if (!this.slots[i]) { const k = Math.min(n, def.stack); this.slots[i] = { id, n: k }; n -= k; }
      }
      return n;
    }
    remove(id, n) {
      n = n || 1;
      if (!this.has(id, n)) return false;
      for (let i = this.size - 1; i >= 0 && n > 0; i--) {
        const s = this.slots[i];
        if (s && s.id === id) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (s.n <= 0) this.slots[i] = null; }
      }
      return true;
    }
    useSlot(i, game) {
      const s = this.slots[i];
      if (!s) return false;
      const def = G.ITEMS[s.id];
      if (!def.use) return false;
      const consumed = def.use(game);
      if (consumed) this.remove(s.id, 1);
      return true;
    }
    dropSlot(i, game) {
      const s = this.slots[i];
      if (!s) return false;
      const def = G.ITEMS[s.id];
      if (!def.drop) return false;
      const p = game.player;
      const T = G.PropTypes[def.drop];
      const x = p.cx + p.facing * 10 - T.w / 2, y = p.y + 8;
      if (!game.world.rectFree({ x, y, w: T.w, h: T.h })) return false;
      game.addProp({ type: def.drop, x, y, dynamic: true });
      this.remove(s.id, 1);
      return true;
    }
    serialize() { return this.slots.map((s) => (s ? { id: s.id, n: s.n } : null)); }
    applySave(arr) {
      this.slots = new Array(this.size).fill(null);
      (arr || []).forEach((s, i) => { if (s && G.ITEMS[s.id] && i < this.size) this.slots[i] = { id: s.id, n: Math.max(1, s.n | 0) }; });
    }
  }
  G.Inventory = Inventory;

  /** Carteira de V (reais). "criado" guarda quanto dinheiro saiu do poder de Criar. */
  class Wallet {
    constructor(reais) { this.reais = reais; this.criado = 0; }
    pay(v) { if (this.reais + 1e-9 < v) return false; this.reais = Math.round((this.reais - v) * 100) / 100; return true; }
    add(v, criado) { this.reais = Math.round((this.reais + v) * 100) / 100; if (criado) this.criado += v; }
    get text() { return 'R$ ' + this.reais.toFixed(2).replace('.', ','); }
    serialize() { return { reais: this.reais, criado: this.criado }; }
    applySave(d) { if (d) { this.reais = +d.reais || 0; this.criado = +d.criado || 0; } }
  }
  G.Wallet = Wallet;
})(window.VG = window.VG || {});

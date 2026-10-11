/* =====================================================================
 * Poderes de V — sistema modular.
 *
 * Por que não há "mana": no romance, a realidade é "feita inteira de uma
 * linha só" (cap. 2). Puxar demais um fio arrasta o resto junto. Aqui,
 * cada uso de poder tensiona A LINHA. A tensão relaxa sozinha quando V
 * para; se passar do limite, a linha DESFIA: o que V segurava cai, ele
 * cambaleia e algo frágil por perto pode quebrar — a realidade cobra o
 * puxão. O limite cresce com COMPREENSÃO (descobertas e escolhas), não
 * com treino repetitivo, porque os poderes de V "não obedeciam à
 * disciplina. Obedeciam à necessidade". O estado emocional altera o
 * custo e o relaxamento (pânico torna tudo mais barato e mais perigoso).
 *
 * Para adicionar um poder: registre em G.POWERS com os ganchos
 * down/up/hold/update/draw/cancel e inclua o id em G.POWER_ORDER.
 * ===================================================================== */
(function (G) {
  'use strict';
  const U = G.util;
  const TS = G.TILE;
  const RANGE = TS * 12;

  G.EMOTIONS = {
    calmo: { label: 'Calmo', relax: 1.25, cost: 1.0, color: '#7fd1b9' },
    curioso: { label: 'Curioso', relax: 1.0, cost: 0.9, color: '#ffd27a' },
    irritado: { label: 'Irritado', relax: 0.7, cost: 1.15, color: '#ff8c69' },
    assustado: { label: 'Assustado', relax: 0.9, cost: 0.85, color: '#b8a1ff' },
    panico: { label: 'Pânico', relax: 0.6, cost: 0.6, color: '#ff5e7a' },
    exausto: { label: 'Exausto', relax: 0.8, cost: 1.2, color: '#9aa5b1' },
  };

  G.POWER_ORDER = ['levitar', 'restaurar', 'deslocar', 'transformar', 'criar', 'perceber', 'teleporte'];

  /** O que o poder Criar consegue fazer existir. A laranja é do romance; o resto é extensão original. */
  G.CRIAVEIS = [
    { id: 'laranja', name: 'Laranja', cost: 14 },
    { id: 'maca', name: 'Maçã', cost: 14 },
    { id: 'banana', name: 'Banana', cost: 14 },
    { id: 'pao', name: 'Pão', cost: 16 },
    { id: 'cafe', name: 'Café', cost: 18 },
    { id: 'chocolate', name: 'Chocolate', cost: 16 },
    { id: 'dinheiro', name: 'Dinheiro (R$ 10)', cost: 30 },
  ];

  /* ---------------- transformações por tipo de objeto ---------------- */
  G.Transforms = {
    colher(g, p) {
      p.state.bent = !p.state.bent;
      return { kind: p.state.bent ? 'entortar' : 'desentortar', msg: p.state.bent ? 'A colher entorta.' : 'E desentorta.' };
    },
    copo(g, p) {
      if (p.state.sabor === 'coca') { p.state.sabor = 'agua'; return { kind: 'agua', msg: 'Água de novo. Só água.' }; }
      p.state.sabor = 'coca';
      return { kind: 'sabor', msg: 'A água no copo ganha gosto de coca-cola. A substância continua a mesma.' };
    },
    caixote(g, p) {
      p.state.metal = !p.state.metal; p.mass = p.state.metal ? 7 : 3;
      return { kind: p.state.metal ? 'metal' : 'madeira', msg: p.state.metal ? 'A madeira vira ferro. Fica pesado de levantar.' : 'Volta a ser madeira.' };
    },
    lata(g, p) { p.state.amassada = !p.state.amassada; return { kind: 'lata', msg: p.state.amassada ? 'A lata se amassa sozinha.' : 'Desamassa.' }; },
    bola(g, p) {
      const cores = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6'];
      p.state.cor = cores[(cores.indexOf(p.state.cor) + 1) % cores.length];
      return { kind: 'cor', msg: 'A bola muda de cor.' };
    },
    livro(g, p) { p.state.aberto = !p.state.aberto; return { kind: 'livro', msg: p.state.aberto ? 'As páginas ficam em branco.' : 'As letras voltam.' }; },
  };

  /* ---------------- sistema ---------------- */
  class PowerSystem {
    constructor(game) {
      this.game = game;
      this.unlocked = new Set();
      this.selected = null;
      this.tension = 0;
      this.emotion = 'curioso';
      this.compreensao = 0;
      this.idle = 0;
      this.held = null;
      this.deslocarSel = null;
      this.perceive = null;
      this.blockedRegions = new Set();
      this.unravelT = 0;
      this.hover = null;
      this.lastAim = null;
      this.vooInstavel = false;
      this.vooLivre = false;
      this.criaveis = new Set(['laranja']);
      this.criarSel = 'laranja';
    }
    unlockCriavel(id, silent) {
      if (this.criaveis.has(id)) return;
      this.criaveis.add(id);
      const c = G.CRIAVEIS.find((q) => q.id === id);
      if (!silent && c) this.game.ui.toast('Criar agora também faz: ' + c.name + ' (botão direito troca o que criar).', 'power');
    }
    cycleCriar() {
      const list = G.CRIAVEIS.filter((c) => this.criaveis.has(c.id));
      const i = list.findIndex((c) => c.id === this.criarSel);
      this.criarSel = list[(i + 1) % list.length].id;
      this.game.audio.play('ui');
      this.game.bubble('Criar: ' + list[(i + 1) % list.length].name, 1.2);
    }
    get capacity() { return 100 + 8 * this.compreensao; }
    get ratio() { return this.tension / this.capacity; }
    get emo() { return G.EMOTIONS[this.emotion] || G.EMOTIONS.calmo; }
    get def() { return this.selected ? G.POWERS[this.selected] : null; }
    isUnlocked(id) { return this.unlocked.has(id); }

    unlock(id, opts) {
      opts = opts || {};
      if (!G.POWERS[id] || this.unlocked.has(id)) return false;
      this.unlocked.add(id);
      if (opts.select !== false) this.select(id);
      if (!opts.silent) {
        const P = G.POWERS[id];
        this.game.ui.toast('Novo poder: ' + P.name + ' — ' + P.hint, 'power');
        this.game.audio.play('success');
      }
      this.game.bus.emit('power:unlock', { id });
      return true;
    }
    select(id) {
      if (!this.unlocked.has(id) || this.selected === id) return;
      this.cancelAll();
      this.selected = id;
      this.game.audio.play('ui', 0.6);
    }
    cycle(dir) {
      const list = G.POWER_ORDER.filter((p) => this.unlocked.has(p));
      if (!list.length) return;
      const i = list.indexOf(this.selected);
      this.select(list[(i + dir + list.length) % list.length]);
    }
    setEmotion(e) { if (G.EMOTIONS[e]) { this.emotion = e; this.game.bus.emit('emotion', { e }); } }
    addCompreensao(n, why) {
      this.compreensao += n;
      this.game.ui.toast('Compreensão +' + n + (why ? ' · ' + why : '') + ' — a Linha aguenta mais.', 'good');
    }
    cost(amount) { this.tension += amount * this.emo.cost; this.idle = 0; }

    mouseWorld() { return this.game.renderer.screenToWorld(this.game.input.mouse.sx, this.game.input.mouse.sy); }
    inRange(x, y) { const p = this.game.player; return U.dist(p.cx, p.cy - 6, x, y) <= RANGE; }
    clampToRange(x, y) {
      const p = this.game.player, cx = p.cx, cy = p.cy - 6;
      const d = U.dist(cx, cy, x, y);
      if (d <= RANGE) return { x, y };
      return { x: cx + (x - cx) / d * RANGE, y: cy + (y - cy) / d * RANGE };
    }
    propAt(x, y, filter) {
      const props = this.game.props;
      for (let i = props.length - 1; i >= 0; i--) {
        const p = props[i];
        if (p.removed) continue;
        if (p.hidden && !p.perceived) continue;
        if (filter && !filter(p)) continue;
        if (U.pointIn(x, y, p.hitBox())) return p;
      }
      return null;
    }

    cancelAll() {
      for (const id of G.POWER_ORDER) { const P = G.POWERS[id]; if (P.cancel) P.cancel(this, this.game); }
      this.game.player.powerAim = null;
    }

    update(dt) {
      const g = this.game, inp = g.input;
      const can = g.canControl() && !g.player.locked && g.player.stun <= 0 && !g.player.pose;

      // seleção
      if (can) {
        for (let i = 0; i < 7; i++) if (inp.hit('p' + (i + 1))) this.select(G.POWER_ORDER[i]);
        if (inp.mouse.wheel) this.cycle(inp.mouse.wheel > 0 ? 1 : -1);
        if (inp.hit('cancel')) this.cancelAll();
      }

      // relaxamento da Linha
      this.idle += dt;
      if (this.idle > 0.5) this.tension = Math.max(0, this.tension - 15 * this.emo.relax * dt);
      if (this.unravelT > 0) this.unravelT -= dt;

      const P = this.def;
      const m = this.mouseWorld();
      this.hover = null;
      if (P && can) {
        if (P.hover) this.hover = P.hover(this, g, m.x, m.y);
        if (inp.mouse.pressed[0] && P.down) P.down(this, g, m.x, m.y);
        if (inp.mouse.buttons[0] && P.hold) P.hold(this, g, dt, m.x, m.y);
        if (inp.mouse.released[0] && P.up) P.up(this, g, m.x, m.y);
        if (inp.mouse.pressed[2] && P.alt) P.alt(this, g, m.x, m.y);
      } else if (!can) {
        // perdeu o controle (diálogo, cena): solta o que estiver segurando
        if (this.held) G.POWERS.levitar.cancel(this, g);
        this.perceive = null;
      }
      for (const id of G.POWER_ORDER) { const Q = G.POWERS[id]; if (Q.update) Q.update(this, g, dt); }

      // braço de V aponta para onde o poder age
      g.player.powerAim = (this.held || (P && can && inp.mouse.buttons[0]) || this.deslocarSel) ? m : null;
      if (g.player.powerAim) g.player.powerGlow = 1;

      if (this.tension > this.capacity) this.unravel();
    }

    /** A Linha desfia: consequência por puxar demais. */
    unravel() {
      const g = this.game;
      this.cancelAll();
      this.tension = this.capacity * 0.55;
      this.unravelT = 0.7;
      g.player.stun = Math.max(g.player.stun, 0.7);
      g.audio.play('unravel');
      g.shake(5);
      g.renderer.glitch(0.6);
      if (!g.story || !g.story.safe) {
        const p = g.player;
        const candidates = g.props.filter((q) => q.T.fragile && !q.broken && !q.removed && U.dist(q.cx, q.cy, p.cx, p.cy) < 140);
        if (candidates.length) { const q = U.choice(candidates); q.vy = -40; q.forceBreak = true; }
      }
      g.bubble(U.choice(['Puxei demais.', 'Tudo amarrado em tudo...', 'Calma. Respira.', 'A linha... quase arrebentou.']), 2);
      g.bus.emit('unravel', {});
    }

    serialize() {
      return { unlocked: [...this.unlocked], selected: this.selected, tension: Math.round(this.tension), emotion: this.emotion, compreensao: this.compreensao, blocked: [...this.blockedRegions], vooInstavel: this.vooInstavel, vooLivre: this.vooLivre, criaveis: [...this.criaveis], criarSel: this.criarSel };
    }
    applySave(d) {
      this.unlocked = new Set((d.unlocked || []).filter((id) => G.POWERS[id]));
      this.selected = this.unlocked.has(d.selected) ? d.selected : ([...this.unlocked][0] || null);
      this.tension = d.tension || 0;
      this.emotion = G.EMOTIONS[d.emotion] ? d.emotion : 'calmo';
      this.compreensao = d.compreensao || 0;
      this.blockedRegions = new Set(d.blocked || []);
      this.vooInstavel = !!d.vooInstavel;
      this.vooLivre = !!d.vooLivre;
      this.criaveis = new Set((d.criaveis || ['laranja']).filter((id) => G.CRIAVEIS.some((c) => c.id === id)));
      if (!this.criaveis.size) this.criaveis.add('laranja');
      this.criarSel = this.criaveis.has(d.criarSel) ? d.criarSel : 'laranja';
    }
  }
  G.PowerSystem = PowerSystem;
  G.POWER_RANGE = RANGE;

  /* ===================================================================
   * Registro de poderes
   * =================================================================== */
  G.POWERS = {};

  // ---------------- Levitar ("Sobe." / "Desce.") ----------------
  G.POWERS.levitar = {
    id: 'levitar', name: 'Levitar', key: '1', color: '#9fd8ff',
    hint: 'segure o botão esquerdo sobre um objeto e arraste; solte para arremessar, botão direito para pousar.',
    desc: 'Erguer, puxar, empurrar e arremessar objetos. C segura com precisão. Custo contínuo, maior para objetos pesados.',
    hover(ps, g, x, y) { const p = ps.propAt(x, y, (q) => q.grabbable); return p && ps.inRange(p.cx, p.cy) ? p : null; },
    down(ps, g, x, y) {
      if (ps.held) return;
      const p = ps.propAt(x, y, (q) => q.grabbable);
      if (!p) return;
      if (!ps.inRange(p.cx, p.cy)) { g.bubble('Longe demais.', 1.2); return; }
      if (g.player.groundRef === p) { g.bubble('Não dá pra erguer o chão em que eu piso. Ainda não.', 2); return; }
      p.held = true; p.static = false; p.frozen = false;
      p.holdX = p.cx; p.holdY = p.cy;
      ps.held = p;
      g.audio.play('lift', 0.8);
      g.bus.emit('levitate:start', { prop: p });
    },
    hold(ps, g, dt, x, y) {
      const p = ps.held; if (!p) return;
      const t = ps.clampToRange(x, y);
      p.holdX = t.x; p.holdY = t.y;
      p.precise = g.input.is('hold');
      ps.cost((3 + p.mass * 7) * dt * (p.precise ? 1.2 : 1));
      if (g.player.groundRef === p) { this.cancel(ps, g); g.bubble('Não consigo me erguer assim. Ainda não.', 2); }
      if (Math.random() < 0.35) g.particles.spark(p.cx + U.rand(-p.w / 2, p.w / 2), p.y + p.h, '#9fd8ff');
    },
    up(ps, g) { this.release(ps, g, false); },
    alt(ps, g) { this.release(ps, g, true); },
    release(ps, g, gentle) {
      const p = ps.held; if (!p) return;
      p.held = false; ps.held = null;
      if (gentle) { p.vx *= 0.1; p.vy = Math.min(p.vy, 0) * 0.1; }
      else { p.vx = U.clamp(p.vx, -520, 520); p.vy = U.clamp(p.vy, -520, 520); }
      g.audio.play('drop', 0.5);
      g.bus.emit('levitate:end', { prop: p, gentle });
    },
    cancel(ps, g) { if (ps.held) this.release(ps, g, true); },
    update(ps, g) { if (ps.held && (ps.held.broken || ps.held.removed || ps.held.restoring)) { ps.held.held = false; ps.held = null; } },
  };

  // ---------------- Restaurar ("eu queria que isso não tivesse acontecido") ----------------
  G.POWERS.restaurar = {
    id: 'restaurar', name: 'Restaurar', key: '2', color: '#ffd27a',
    hint: 'clique num objeto quebrado (ou que você moveu) para desfazer o que aconteceu com ele.',
    desc: 'Desfaz eventos recentes de um objeto: cacos voltam a ser copo, o que caiu volta para onde estava. Quanto mais longe no tempo, mais a Linha estica.',
    hover(ps, g, x, y) {
      const p = ps.propAt(x, y, (q) => !q.restoring && (q.broken || q.history.length > 4));
      return p && ps.inRange(p.cx, p.cy) ? p : null;
    },
    down(ps, g, x, y) {
      const p = ps.propAt(x, y, (q) => !q.restoring && (q.broken || q.history.length > 4));
      if (!p) { g.bubble('Nada aqui pra desfazer.', 1.2); return; }
      if (!ps.inRange(p.cx, p.cy)) { g.bubble('Longe demais.', 1.2); return; }
      G.POWERS.restaurar.apply(ps, g, p, false);
    },
    /** Usado também pela história (restauração "involuntária" do copo). */
    apply(ps, g, p, free) {
      if (ps.held === p) G.POWERS.levitar.cancel(ps, g);
      const r = p.startRestore(g);
      if (!free) {
        const len = r.path.length / 2;
        ps.cost(p.T.structure ? 34 : 14 + p.mass * 8 + Math.min(22, len * 0.25));
      }
      g.audio.play('restore');
      g.renderer.timeRipple(p.cx, p.cy);
      g.bus.emit('restore:start', { prop: p, free });
    },
  };

  // ---------------- Deslocar (o controle remoto que atravessou a sala sem percorrer o caminho) ----------------
  G.POWERS.deslocar = {
    id: 'deslocar', name: 'Deslocar', key: '3', color: '#c39bff',
    hint: 'clique num objeto e depois num lugar livre: ele aparece lá sem percorrer o caminho.',
    desc: 'Leva um objeto de um ponto a outro sem atravessar o espaço entre eles. O destino precisa estar livre e ao alcance.',
    hover(ps, g, x, y) {
      if (ps.deslocarSel) return null;
      const p = ps.propAt(x, y, (q) => q.grabbable);
      return p && ps.inRange(p.cx, p.cy) ? p : null;
    },
    target(ps, g, x, y) {
      const p = ps.deslocarSel;
      const r = { x: Math.round(x - p.w / 2), y: Math.round(y - p.h / 2), w: p.w, h: p.h };
      let ok = g.world.rectFree(r) && ps.inRange(x, y) && !U.overlap(r, g.player);
      if (ok) for (const q of g.props) if (q !== p && !q.removed && (q.solid || q.platform) && U.overlap(r, q)) { ok = false; break; }
      return { r, ok };
    },
    down(ps, g, x, y) {
      if (!ps.deslocarSel) {
        const p = ps.propAt(x, y, (q) => q.grabbable);
        if (!p) return;
        if (!ps.inRange(p.cx, p.cy)) { g.bubble('Longe demais.', 1.2); return; }
        ps.deslocarSel = p; g.audio.play('ui');
        return;
      }
      const p = ps.deslocarSel;
      if (p.broken || p.removed) { ps.deslocarSel = null; return; }
      const t = this.target(ps, g, x, y);
      if (!t.ok) { g.bubble('Ali não cabe.', 1); g.audio.play('tick'); return; }
      const fromX = p.cx, fromY = p.cy;
      const dist = U.dist(fromX, fromY, t.r.x + p.w / 2, t.r.y + p.h / 2);
      g.particles.burst(fromX, fromY, 14, { color: '#c39bff', speed: 50, life: 0.5 });
      p.x = t.r.x; p.y = t.r.y; p.vx = 0; p.vy = 0; p.held = false; if (p.static && p.type === 'painel') p.static = false;
      p.history = []; p.flash = 0.3;
      g.particles.burst(p.cx, p.cy, 14, { color: '#e3d1ff', speed: 40, life: 0.5 });
      g.audio.play('teleport');
      ps.cost(10 + p.mass * 5 + dist / 40);
      ps.deslocarSel = null;
      g.bus.emit('deslocar', { prop: p, dist });
    },
    alt(ps) { ps.deslocarSel = null; },
    cancel(ps) { ps.deslocarSel = null; },
  };

  // ---------------- Transformar (a colher, a cor do abajur, o gosto da água) ----------------
  G.POWERS.transformar = {
    id: 'transformar', name: 'Transformar', key: '4', color: '#7fe3a0',
    hint: 'clique num objeto para alterar uma propriedade dele (forma, cor, gosto, material).',
    desc: 'Altera propriedades sem trocar a coisa: entorta, colore, muda gosto e material. Alguns objetos fixos (como o abajur) também respondem.',
    findTarget(ps, g, x, y) {
      const p = ps.propAt(x, y, (q) => !q.broken && !q.restoring && G.Transforms[q.type]);
      if (p) return { prop: p };
      const it = g.interactables.find((i) => i.transform && i.enabled !== false && U.pointIn(x, y, i));
      if (it) return { inter: it };
      return null;
    },
    hover(ps, g, x, y) { const t = this.findTarget(ps, g, x, y); return t ? (t.prop || t.inter) : null; },
    down(ps, g, x, y) {
      const t = this.findTarget(ps, g, x, y);
      if (!t) { g.bubble('Isso não parece querer mudar.', 1.2); return; }
      const tx = t.prop ? t.prop.cx : t.inter.x + t.inter.w / 2, ty = t.prop ? t.prop.cy : t.inter.y + t.inter.h / 2;
      if (!ps.inRange(tx, ty)) { g.bubble('Longe demais.', 1.2); return; }
      let res;
      if (t.prop) { res = G.Transforms[t.prop.type](g, t.prop); t.prop.flash = 0.3; }
      else res = t.inter.transform(g);
      if (!res) return;
      g.particles.burst(tx, ty, 10, { color: '#7fe3a0', speed: 30, life: 0.5 });
      g.audio.play('transform');
      ps.cost(6);
      if (res.msg) g.bubble(res.msg, 2.2);
      g.bus.emit('transform', { prop: t.prop || null, inter: t.inter || null, kind: res.kind, type: t.prop ? t.prop.type : t.inter.id });
    },
  };

  // ---------------- Criar (a laranja "perfeita de um jeito levemente errado") ----------------
  G.POWERS.criar = {
    id: 'criar', name: 'Criar', key: '5', color: '#ffa94d',
    hint: 'clique num espaço livre para fazer uma laranja aparecer.',
    desc: 'Faz coisas existirem. Começa pela laranja perfeita demais; depois outras comidas e até dinheiro. Botão direito troca o que criar.',
    target(ps, g, x, y) {
      const T = G.PropTypes[ps.criarSel] || G.PropTypes.laranja;
      const r = { x: Math.round(x - T.w / 2), y: Math.round(y - T.h / 2), w: T.w, h: T.h };
      return { r, ok: g.world.rectFree(r) && ps.inRange(x, y) };
    },
    alt(ps) { ps.cycleCriar(); },
    down(ps, g, x, y) {
      const t = this.target(ps, g, x, y);
      if (!t.ok) { g.bubble('Ali não.', 1); return; }
      const n = g.props.filter((p) => p.dynamic && !p.removed).length;
      if (n >= 10) { g.bubble('Já tem coisa criada demais por aqui.', 1.6); return; }
      const c = G.CRIAVEIS.find((q) => q.id === ps.criarSel) || G.CRIAVEIS[0];
      const p = g.addProp({ type: c.id, x: t.r.x, y: t.r.y, dynamic: true });
      p.state.criado = true;
      g.particles.burst(p.cx, p.cy, 16, { color: '#ffb347', speed: 35, life: 0.6 });
      g.audio.play('create');
      ps.cost(c.cost);
      if (c.id === 'dinheiro' && !g.flags.dinheiroCriadoMsg) {
        g.flags.dinheiroCriadoMsg = true;
        g.say([{ who: 'pensamento', orig: true, text: 'Uma nota de dez. Novinha. Perfeita demais, como a laranja. De onde é que ela saiu — e de quem eu acabei de tirar o valor dela?' }]);
      }
      g.bus.emit('create', { prop: p, kind: c.id });
    },
  };

  // ---------------- Teleporte (extensão original desta versão; no romance V atravessa a cidade "num pensamento") ----------------
  G.POWERS.teleporte = {
    id: 'teleporte', name: 'Teleporte', key: '7', color: '#ff7ad9',
    hint: 'clique num lugar livre ao alcance: V aparece lá sem percorrer o caminho.',
    desc: 'O mesmo que fez com o controle remoto, agora consigo mesmo. O destino precisa estar livre e ao alcance. Quem vir, vai se assustar.',
    target(ps, g, x, y) {
      const p = g.player;
      const r = { x: Math.round(x - p.w / 2), y: Math.round(y - p.h / 2), w: p.w, h: p.h };
      let ok = g.world.rectFree(r) && ps.inRange(x, y);
      if (ok) for (const q of g.props) if (!q.removed && (q.solid || q.platform) && U.overlap(r, q)) { ok = false; break; }
      return { r, ok };
    },
    down(ps, g, x, y) {
      const t = this.target(ps, g, x, y);
      if (!t.ok) { g.bubble('Ali não cabe.', 1); g.audio.play('tick'); return; }
      const p = g.player;
      const fromX = p.cx, fromY = p.cy;
      const dist = U.dist(fromX, fromY, t.r.x + p.w / 2, t.r.y + p.h / 2);
      g.particles.burst(fromX, fromY, 22, { color: '#ff7ad9', speed: 60, life: 0.5 });
      p.x = t.r.x; p.y = t.r.y; p.vx = 0; p.vy = 0;
      g.particles.burst(p.cx, p.cy, 22, { color: '#ffd1f2', speed: 45, life: 0.5 });
      g.audio.play('teleport');
      ps.cost(16 + dist / 18);
      g.bus.emit('teleport', { x: fromX, y: fromY, tx: p.cx, ty: p.cy, dist });
    },
  };

  // ---------------- Percepção (a parede que ficou transparente) ----------------
  G.POWERS.perceber = {
    id: 'perceber', name: 'Percepção', key: '6', color: '#6fe0ff',
    hint: 'segure o botão esquerdo para enxergar através das coisas ao redor do cursor.',
    desc: 'Torna paredes e superfícies transparentes perto do cursor, revelando o que está escondido. V jurou nunca mais usar isso na casa dos vizinhos.',
    down(ps, g) { g.audio.play('perceive'); },
    hold(ps, g, dt, x, y) {
      ps.perceive = { x, y, r: 42 };
      let culpa = false;
      for (const reg of Object.values(g.regions)) {
        if (!reg.apto) continue;
        const cx = U.clamp(x, reg.x, reg.x + reg.w), cy = U.clamp(y, reg.y, reg.y + reg.h);
        if (U.dist(cx, cy, x, y) < 30) culpa = true;
      }
      ps.cost((culpa ? 11 : 4) * dt); // olhar a casa dos outros pesa na Linha
      for (const p of g.props) {
        if (p.hidden && !p.perceived && U.dist(p.cx, p.cy, x, y) < 42) {
          p.perceived = true; p.flash = 0.6; g.audio.play('success', 0.6);
          g.bus.emit('perceive:reveal', { prop: p });
        }
      }
      for (const [id, reg] of Object.entries(g.regions)) {
        if (!reg.perceivable) continue;
        const cx = U.clamp(x, reg.x, reg.x + reg.w), cy = U.clamp(y, reg.y, reg.y + reg.h);
        if (U.dist(cx, cy, x, y) < 30) {
          if (ps.blockedRegions.has(id)) { if (!ps._refuseT || ps._refuseT <= 0) { g.bubble(reg.refuse || 'Não.', 1.6); ps._refuseT = 2; } }
          else g.bus.emit('perceive:region', { id, dt });
        }
      }
    },
    up(ps) { ps.perceive = null; },
    cancel(ps) { ps.perceive = null; },
    update(ps, g, dt) {
      if (ps._refuseT > 0) ps._refuseT -= dt;
      if (ps.perceive && (ps.selected !== 'perceber' || !g.input.mouse.buttons[0])) ps.perceive = null;
    },
  };
})(window.VG = window.VG || {});

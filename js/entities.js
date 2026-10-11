/* =====================================================================
 * Entidades: objetos físicos (props), itens coletáveis, pessoas da rua
 * e pombos. Cada prop guarda um histórico recente de posições — é isso
 * que permite à Restauração "desfazer" o que aconteceu com ele.
 * ===================================================================== */
(function (G) {
  'use strict';
  const U = G.util;
  const GRAV = 900;
  const HISTORY_MAX = 200;        // ~10 s gravando a cada 3 quadros
  const HISTORY_EVERY = 3;

  /* ------------------------------------------------------------------
   * Tipos de objeto. Flags:
   *  solid    : bloqueia jogador e outros objetos por todos os lados
   *  platform : o jogador pode ficar em cima (mão única)
   *  pushable : o jogador empurra andando contra ele
   *  fragile  : quebra com impacto acima de breakSpeed
   *  static   : não sofre gravidade (estruturas da praça, painel preso)
   * ------------------------------------------------------------------ */
  G.PropTypes = {
    copo: { name: 'Copo de requeijão', w: 5, h: 6, mass: 0.2, fragile: true, breakSpeed: 115,
      shards: ['#d9f0ff', '#b7dcf5', '#ffffff', '#9cc7e6'], sound: 'glass' },
    colher: { name: 'Colher', w: 6, h: 2, mass: 0.05 },
    vassoura: { name: 'Vassoura', w: 4, h: 24, mass: 0.5 },
    controle: { name: 'Controle remoto', w: 6, h: 3, mass: 0.1 },
    cadeira: { name: 'Cadeira', w: 10, h: 14, mass: 2.2, platform: true },
    jogo: { name: 'Caixa de videogame', w: 4, h: 6, mass: 0.1 },
    livro: { name: 'Livro', w: 4, h: 6, mass: 0.15 },
    caixa: { name: 'Caixa de papelão', w: 12, h: 10, mass: 0.8, platform: true },
    laranja: { name: 'Laranja perfeita', w: 5, h: 5, mass: 0.2, bounce: 0.3, item: 'laranja_perfeita' },
    caixote: { name: 'Caixote', w: 14, h: 14, mass: 3, solid: true, pushable: true },
    lata: { name: 'Lata', w: 4, h: 6, mass: 0.1, bounce: 0.15 },
    bola: { name: 'Bola', w: 7, h: 7, mass: 0.3, bounce: 0.7 },
    garrafa: { name: 'Garrafa', w: 3, h: 8, mass: 0.3, fragile: true, breakSpeed: 130,
      shards: ['#2f8f46', '#4fb468', '#1d6b31'], sound: 'glass' },
    painel: { name: 'Painel solto', w: 12, h: 8, mass: 0.4, static: true, hidden: true },
    banco: { name: 'Banco da praça', w: 30, h: 12, mass: 20, static: true, structure: true, startsBroken: true, platform: true },
    poste: { name: 'Poste da praça', w: 6, h: 56, mass: 30, static: true, structure: true, startsBroken: true },
  };

  class Prop {
    constructor(spec) {
      const T = G.PropTypes[spec.type];
      if (!T) throw new Error('Tipo de objeto desconhecido: ' + spec.type);
      this.id = spec.id || U.uid(spec.type);
      this.type = spec.type;
      this.T = T;
      this.w = T.w; this.h = T.h;
      this.x = spec.x; this.y = spec.y;
      this.vx = 0; this.vy = 0;
      this.mass = T.mass;
      this.state = Object.assign({}, spec.state || {});
      this.static = !!T.static;
      this.hidden = !!T.hidden;
      this.perceived = false;
      this.broken = !!T.startsBroken;
      this.shards = [];
      this.history = [];
      this.histTick = 0;
      this.restTime = 0;
      this.lastRest = { x: this.x, y: this.y };
      this.spawn = { x: this.x, y: this.y };
      this.held = false;
      this.frozen = false;
      this.restoring = null;
      this.onGround = false;
      this.angle = 0;
      this.noFriction = false;
      this.forceBreak = false;
      this.dynamic = !!spec.dynamic; // criado durante o jogo (ex.: laranjas)
      this.removed = false;
      this.flash = 0;
      if (this.type === 'caixote' && this.state.metal) this.mass = 7;
      if (this.broken) { this.breakPoint = { x: this.x, y: this.y }; this.restOnBreak = { x: this.x, y: this.y }; this.preBreak = []; }
    }

    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
    get solid() { return !!this.T.solid && !this.broken && !this.restoring; }
    get platform() { return !!this.T.platform && !this.broken && !this.restoring; }
    get grabbable() { return !this.broken && !this.restoring && !(this.hidden && !this.perceived) && !this.T.structure; }

    /** Caixa usada para mirar com o mouse (shards contam quando quebrado). */
    hitBox() {
      if (this.broken && this.shards.length) {
        let x0 = this.x, y0 = this.y, x1 = this.x + this.w, y1 = this.y + this.h;
        for (const s of this.shards) { x0 = Math.min(x0, s.x); y0 = Math.min(y0, s.y); x1 = Math.max(x1, s.x + 2); y1 = Math.max(y1, s.y + 2); }
        return { x: x0 - 3, y: y0 - 3, w: x1 - x0 + 6, h: y1 - y0 + 6 };
      }
      const pad = this.w < 8 || this.h < 8 ? 4 : 1;
      return { x: this.x - pad, y: this.y - pad, w: this.w + pad * 2, h: this.h + pad * 2 };
    }

    update(dt, game) {
      if (this.flash > 0) this.flash -= dt;
      this.updateShards(dt, game);
      if (this.restoring) { this.updateRestore(dt, game); return; }
      if (this.broken || this.frozen || this.removed) return;
      if (this.static && !this.held) return;

      if (this.held) {
        // o alvo é definido pelo poder de Levitação
        const tx = this.holdX - this.w / 2, ty = this.holdY - this.h / 2;
        const k = this.precise ? 7 : 13;
        this.vx = U.clamp((tx - this.x) * k, -420, 420);
        this.vy = U.clamp((ty - this.y) * k, -420, 420);
      } else {
        this.vy = Math.min(this.vy + GRAV * dt, 620);
      }
      const prevVx = this.vx, prevVy = this.vy;
      G.Physics.move(this, game.world, {
        dt,
        solids: game.solidPropsExcept(this),
        platforms: game.platformPropsExcept(this),
        surfaces: game.surfaces,
      });

      // carregado por quem está embaixo (caixote sobre caixote empurrado)
      if (this.groundRef && this.groundRef.lastDx) this.x += this.groundRef.lastDx * 0.9;

      // impactos: quebra, som, quique
      const impact = Math.max(this.impactY, this.impactX);
      if (!this.held && !this.noBreak && (this.forceBreak && this.onGround || (this.T.fragile && impact > this.T.breakSpeed))) {
        this.break(game, impact);
        return;
      }
      if (impact > 60 && game.audio) game.audio.play(this.mass > 1 ? 'thud' : 'tick', Math.min(1, impact / 300));
      if (this.T.bounce && this.impactY > 40 && !this.held) this.vy = -this.impactY * this.T.bounce;
      if (this.T.bounce && this.impactX > 40 && !this.held) this.vx = -prevVx * this.T.bounce;
      if (this.impactY > 0 && !this.T.bounce) this.angle *= 0.5;

      // atrito
      if (this.onGround && !this.held && !this.noFriction) this.vx = U.approach(this.vx, 0, 500 * dt);
      if (!this.onGround && !this.held) this.angle += this.vx * dt * 0.05;
      if (this.onGround) this.angle = U.approach(this.angle, 0, dt * 4);

      // histórico (para a Restauração) e ponto de repouso
      if (++this.histTick >= HISTORY_EVERY) {
        this.histTick = 0;
        this.history.push(this.x, this.y);
        if (this.history.length > HISTORY_MAX * 2) this.history.splice(0, 2);
      }
      const moving = Math.abs(this.vx) > 2 || Math.abs(this.vy) > 2 || this.held;
      if (!moving && this.onGround) {
        this.restTime += dt;
        if (this.restTime > 0.4) { this.lastRest.x = this.x; this.lastRest.y = this.y; }
      } else this.restTime = 0;
      this.lastDx = this.x - (this._px === undefined ? this.x : this._px);
      this._px = this.x;
      void prevVy;
    }

    break(game, impact) {
      if (this.broken) return;
      this.broken = true;
      this.held = false;
      this.forceBreak = false;
      this.breakPoint = { x: this.x, y: this.y };
      this.preBreak = this.history.slice();
      this.restOnBreak = { x: this.lastRest.x, y: this.lastRest.y };
      const colors = this.T.shards || ['#aaa'];
      const n = this.T.shards ? 8 : 5;
      this.shards = [];
      for (let i = 0; i < n; i++) {
        this.shards.push({
          x: this.cx + U.rand(-2, 2), y: this.y + this.h - 2,
          vx: U.rand(-70, 70), vy: U.rand(-110, -30),
          c: colors[i % colors.length], rest: false, ox: U.rand(-2, 2), oy: U.rand(-3, 2),
        });
      }
      if (game) {
        if (game.audio) game.audio.play(this.T.sound || 'crack', 1);
        if (game.particles) game.particles.burst(this.cx, this.y + this.h, 6, { color: '#e8f6ff', speed: 60, life: 0.4 });
        if (game.bus) game.bus.emit('prop:break', { prop: this, impact });
      }
    }

    updateShards(dt, game) {
      if (!this.shards.length || this.restoring) return;
      for (const s of this.shards) {
        if (s.rest) continue;
        s.vy += GRAV * dt;
        s.x += s.vx * dt; s.y += s.vy * dt;
        const T = G.TILE;
        const tx = Math.floor((s.x + 1) / T), ty = Math.floor((s.y + 2) / T);
        let floorY = null;
        if (game.world.isSolid(tx, ty)) floorY = ty * T;
        if (floorY === null && game.surfaces) {
          for (const sf of game.surfaces) if (s.x >= sf.x && s.x <= sf.x + sf.w && s.y + 2 >= sf.y && s.y + 2 - s.vy * dt <= sf.y + 0.5) { floorY = sf.y; break; }
        }
        if (floorY !== null && s.vy > 0) {
          s.y = floorY - 2;
          if (Math.abs(s.vy) < 60) { s.vy = 0; s.vx = 0; s.rest = true; } else { s.vy *= -0.3; s.vx *= 0.5; }
        }
        if (game.world.isSolid(Math.floor((s.x + (s.vx > 0 ? 2 : 0)) / T), Math.floor(s.y / T))) s.vx *= -0.4;
      }
    }

    /**
     * Começa a restauração. Se quebrado: os cacos voltam ao ponto da queda e
     * o objeto refaz o caminho de trás para frente até onde estava em repouso.
     * Se inteiro: desfaz os últimos segundos de movimento.
     */
    startRestore(game) {
      const path = [];
      if (this.broken && this.T.structure) {
        // estruturas (banco, poste) se remontam no próprio lugar
        this.restoring = { phase: 'assemble', t: 0, path: [this.spawn.x, this.spawn.y], pi: 0, wasBroken: true };
      } else if (this.broken) {
        const h = this.preBreak || [];
        path.push(this.breakPoint.x, this.breakPoint.y);
        for (let i = h.length - 2; i >= 0; i -= 2) path.push(h[i], h[i + 1]);
        const rest = this.restOnBreak || this.lastRest;
        path.push(rest.x, rest.y);
        this.restoring = {
          phase: 'shards', t: 0,
          shardStart: this.shards.map((s) => ({ x: s.x, y: s.y })),
          path: compressPath(path), pi: 0, wasBroken: true,
        };
      } else {
        const h = this.history;
        path.push(this.x, this.y);
        for (let i = h.length - 2; i >= 0; i -= 2) path.push(h[i], h[i + 1]);
        this.restoring = { phase: 'rewind', t: 0, path: compressPath(path), pi: 0, wasBroken: false };
      }
      this.held = false; this.vx = 0; this.vy = 0; this.frozen = false;
      return this.restoring;
    }

    updateRestore(dt, game) {
      const r = this.restoring;
      r.t += dt;
      if (r.phase === 'shards') {
        const d = 0.45, k = U.easeInOut(Math.min(1, r.t / d));
        this.shards.forEach((s, i) => {
          const st = r.shardStart[i];
          s.x = U.lerp(st.x, this.breakPoint.x + this.w / 2 + s.ox * (1 - k), k);
          s.y = U.lerp(st.y, this.breakPoint.y + this.h / 2 + s.oy * (1 - k), k);
        });
        if (r.t >= d) {
          this.broken = false; this.shards = [];
          this.x = this.breakPoint.x; this.y = this.breakPoint.y;
          r.phase = 'rewind'; r.t = 0;
          if (game.particles) game.particles.ring(this.cx, this.cy, '#ffd27a');
        }
        return;
      }
      if (r.phase === 'assemble') {
        const d = 1.0;
        if (r.t >= d) { this.broken = false; this.shards = []; this.finishRestore(game); }
        return;
      }
      // rewind: percorre o caminho comprimido em até ~1.1 s
      const pts = r.path.length / 2;
      const dur = U.clamp(pts * 0.04, 0.25, 1.1);
      const k = Math.min(1, r.t / dur);
      const fi = k * (pts - 1);
      const i0 = Math.floor(fi), i1 = Math.min(pts - 1, i0 + 1), f = fi - i0;
      this.x = U.lerp(r.path[i0 * 2], r.path[i1 * 2], f);
      this.y = U.lerp(r.path[i0 * 2 + 1], r.path[i1 * 2 + 1], f);
      this.angle = U.lerp(this.angle, 0, 0.2);
      if (game.particles && Math.random() < 0.5) game.particles.glyph(this.cx + U.rand(-4, 4), this.cy + U.rand(-4, 4));
      if (k >= 1) this.finishRestore(game);
    }

    finishRestore(game) {
      const wasBroken = this.restoring && this.restoring.wasBroken;
      this.restoring = null;
      this.vx = 0; this.vy = 0; this.angle = 0;
      this.history = [];
      this.lastRest = { x: this.x, y: this.y };
      this.restTime = 1;
      this.flash = 0.4;
      if (game && game.bus) game.bus.emit('prop:restored', { prop: this, wasBroken });
    }

    serialize() {
      return {
        id: this.id, type: this.type, x: Math.round(this.x * 10) / 10, y: Math.round(this.y * 10) / 10,
        broken: this.broken, state: this.state, perceived: this.perceived, dynamic: this.dynamic,
        lastRest: this.lastRest, spawn: this.spawn,
        breakPoint: this.breakPoint || null, restOnBreak: this.restOnBreak || null,
      };
    }
    applySave(d) {
      this.x = d.x; this.y = d.y; this.state = d.state || {};
      this.perceived = !!d.perceived;
      if (d.lastRest) this.lastRest = d.lastRest;
      if (d.spawn) this.spawn = d.spawn;
      this.broken = !!d.broken;
      this.breakPoint = d.breakPoint || { x: this.x, y: this.y };
      this.restOnBreak = d.restOnBreak || this.lastRest;
      this.preBreak = [];
      this.shards = [];
      if (this.broken && !this.T.structure) {
        // recria cacos já assentados no chão
        const colors = this.T.shards || ['#aaa'];
        for (let i = 0; i < 6; i++) this.shards.push({ x: this.x + i * 2 - 3, y: this.y + this.h - 2, vx: 0, vy: 0, c: colors[i % colors.length], rest: false, ox: 0, oy: 0 });
      }
      if (this.type === 'caixote') this.mass = this.state.metal ? 7 : 3;
      if (this.type === 'painel' && (Math.abs(this.x - this.spawn.x) > 1 || Math.abs(this.y - this.spawn.y) > 1)) this.static = false;
    }
  }

  /** Remove pontos muito próximos para a animação de rebobinar ficar fluida. */
  function compressPath(p) {
    const out = [p[0], p[1]];
    for (let i = 2; i < p.length; i += 2) {
      const lx = out[out.length - 2], ly = out[out.length - 1];
      if (Math.abs(p[i] - lx) + Math.abs(p[i + 1] - ly) >= 1.5 || i === p.length - 2) out.push(p[i], p[i + 1]);
    }
    return out;
  }
  G.Prop = Prop;

  /* ------------------------------------------------------------------
   * Itens no chão (coleta com E)
   * ------------------------------------------------------------------ */
  class Pickup {
    constructor(spec) {
      Object.assign(this, { taken: false, bob: Math.random() * 6 }, spec);
    }
    visible(game) {
      if (this.taken) return false;
      if (this.hiddenBehind) {
        const p = game.propById(this.hiddenBehind);
        if (p && Math.abs(p.x - p.spawn.x) + Math.abs(p.y - p.spawn.y) < 10) return false;
      }
      return true;
    }
  }
  G.Pickup = Pickup;

  /* ------------------------------------------------------------------
   * Pessoas da rua. As quatro cenas vêm da janela de V no capítulo 1
   * ("um cachorro puxando uma pessoa, uma moto de entrega subindo na
   * calçada, uma senhora conferindo se trouxe a chave, um casal
   * discutindo em volume moderado"). Falas e comportamentos são
   * conteúdo original do jogo.
   * ------------------------------------------------------------------ */
  class NPC {
    constructor(spec) {
      Object.assign(this, spec);
      this.w = 10; this.h = 26; this.t = Math.random() * 10; this.facing = -1;
      this.anim = 0; this.moving = false; this.say = null; this.sayT = 0;
      this.homeX = this.x; this.phase = 0; this.timer = U.rand(1, 4); this.visibleNow = true;
      if (this.kind === 'moto') { this.w = 22; this.h = 18; this.y += 8; }
      if (this.kind === 'senhora') { this.h = 24; }
      this.dog = this.kind === 'passeador' ? { x: this.x - 16, y: this.y + 18, anim: 0 } : null;
    }
    isDaytime(game) { const m = game.clock.min % 1440; return m >= 6 * 60 && m < 20 * 60; }
    update(dt, game) {
      this.t += dt;
      if (this.sayT > 0) this.sayT -= dt;
      const day = this.isDaytime(game);
      const T = G.TILE;
      this.moving = false;
      if (this.kind === 'atendente') { this.visibleNow = true; this.facing = 1; return; }
      this.visibleNow = day;
      if (!day) return;
      if (this.kind === 'passeador') {
        // o cachorro puxa: ele vai na frente e a pessoa acompanha
        const minX = T * 62, maxX = T * 135;
        if (this.dir === undefined) this.dir = -1;
        const speed = 34;
        this.x += this.dir * speed * dt;
        this.facing = this.dir; this.moving = true;
        if (this.x < minX) { this.x = minX; this.dir = 1; }
        if (this.x > maxX) { this.x = maxX; this.dir = -1; }
        const dx = this.x + this.dir * 22 + Math.sin(this.t * 3) * 3;
        this.dog.x = U.lerp(this.dog.x, dx, 0.1);
        this.dog.anim += dt * 12;
        this.dog.dir = this.dir;
        this.anim += dt * 9;
      } else if (this.kind === 'moto') {
        // chega pela rua, sobe na calçada, entrega, vai embora (ciclo)
        this.timer -= dt;
        const curbX = T * 62, startX = T * 79;
        if (this.phase === 0) { this.x = startX; this.alpha = 0; this.phase = 1; }
        if (this.phase === 1) { this.alpha = Math.min(1, (this.alpha || 0) + dt * 2); this.x -= 70 * dt; this.facing = -1; this.moving = true;
          if (this.x < T * 64.5) { this.phase = 2; this.timer = 0.4; } }
        else if (this.phase === 2) { this.x -= 50 * dt; this.hop = Math.min(1, (this.hop || 0) + dt * 3); this.moving = true;
          if (this.x <= curbX) { this.x = curbX; this.phase = 3; this.timer = 6; } }
        else if (this.phase === 3) { if (this.timer <= 0) { this.phase = 4; this.facing = 1; } }
        else if (this.phase === 4) { this.x += 60 * dt; this.moving = true; this.facing = 1; if (this.x > T * 64) this.hop = Math.max(0, this.hop - dt * 3);
          if (this.x > startX) { this.alpha = Math.max(0, this.alpha - dt * 2); if (this.alpha <= 0) { this.phase = 5; this.timer = U.rand(18, 30); } } }
        else if (this.phase === 5) { this.alpha = 0; if (this.timer <= 0) this.phase = 0; }
        this.anim += dt * 20;
      } else if (this.kind === 'senhora') {
        this.facing = 1;
        this.anim = Math.sin(this.t * 1.7); // apalpa a bolsa procurando a chave
      } else if (this.kind === 'casal_a' || this.kind === 'casal_b') {
        this.facing = this.kind === 'casal_a' ? 1 : -1;
        this.timer -= dt;
        if (this.timer <= 0) {
          this.timer = U.rand(2.5, 5);
          const lines = this.kind === 'casal_a'
            ? ['Eu disse sábado.', 'Não foi isso que eu falei.', 'Você nunca lembra.', 'Tá, tá bom.']
            : ['Você disse domingo!', 'Foi exatamente isso.', 'Eu lembro, sim.', 'Tá bom nada.'];
          if (Math.random() < 0.6) { this.say = U.choice(lines); this.sayT = 2.2; }
        }
        this.anim = Math.sin(this.t * 6) * (this.sayT > 0 ? 1 : 0.2);
      }
    }
  }
  G.NPC = NPC;

  /** Pombos: bicam o chão e voam quando alguém chega perto. */
  class Pigeon {
    constructor(x, y) { this.x = x; this.y = y; this.homeX = x; this.homeY = y; this.vx = 0; this.vy = 0; this.fly = 0; this.t = Math.random() * 5; this.dir = Math.random() < 0.5 ? -1 : 1; }
    update(dt, game) {
      this.t += dt;
      const p = game.player;
      const near = Math.abs(p.x + 5 - this.x) < 26 && Math.abs(p.y + 26 - this.y) < 30;
      if (this.fly > 0) {
        this.fly -= dt; this.x += this.vx * dt; this.y += this.vy * dt; this.vy += 20 * dt;
        if (this.fly <= 0) { this.x = this.homeX + U.rand(-20, 20); this.y = this.homeY; this.landing = 0.5; }
      } else if (near) {
        this.fly = 2.5; this.vx = (this.x > p.x ? 1 : -1) * U.rand(60, 100); this.vy = U.rand(-80, -50);
        if (game.audio) game.audio.play('flap', 0.4);
      } else if (Math.random() < dt * 0.5) this.dir *= -1;
    }
  }
  G.Pigeon = Pigeon;
})(window.VG = window.VG || {});

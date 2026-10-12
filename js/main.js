/* =====================================================================
 * Jogo: laço principal com passo fixo, estados (menu / jogando),
 * montagem do mundo, interação, relógio, transições, salvar/carregar e
 * tratamento de erros.
 * ===================================================================== */
(function (G) {
  'use strict';
  const U = G.util;
  const TS = G.TILE;

  const NPC_TEXT = {
    passeador: 'O cachorro puxa, a pessoa vai atrás. Não dá pra saber quem está levando quem.',
    moto: 'A moto sobe na calçada como se a calçada fosse dela. O entregador nem olha.',
    senhora: 'Ela confere a bolsa. A chave está lá. Ela confere de novo.',
    casal: 'Discutem em volume moderado sobre alguma coisa que daqui a três meses nenhum dos dois vai lembrar.',
  };

  class Game {
    constructor() {
      this.settings = G.Save.loadSettings();
      this.bus = new G.Events();
      this.input = new G.Input(document.getElementById('game'), this.settings.bindings);
      this.audio = new G.Audio(this.settings);
      this.renderer = new G.Renderer(this);
      this.particles = new G.Particles();
      this.ui = new G.UI(this);
      this.state = 'menu';
      this.backdrop = true;
      this.flags = {};
      this.clock = { day: 1, min: 18 * 60 };
      this.scale = 3;
      this.fps = 60; this._fpsN = 0; this._fpsT = 0;
      this.acc = 0; this.last = 0;
      this.fading = false; this.inputLock = false; this.errorPaused = false;
      this.areaId = null; this.areaName = '';
      this.sequence = null;

      window.addEventListener('resize', () => this.resize());
      const unlock = () => this.audio.unlock();
      window.addEventListener('pointerdown', unlock);
      window.addEventListener('keydown', unlock);
      window.addEventListener('error', (e) => this.reportError(e.error || e.message));
      window.addEventListener('unhandledrejection', (e) => this.reportError(e.reason));
      document.getElementById('fps').classList.toggle('hidden', !this.settings.showFps);

      this.resize();
      this.setupBackdrop();
      this.ui.showMainMenu();
      requestAnimationFrame((t) => this.frame(t));
    }

    /* ---------------- montagem ---------------- */
    setupWorld() {
      const spec = G.buildStage1();
      this.spec = spec;
      this.world = spec.world;
      this.props = spec.props.map((s) => new G.Prop(s));
      this.pickups = spec.pickups.map((s) => new G.Pickup(s));
      this.decor = spec.decor;
      this.surfaces = [];
      for (const d of spec.decor) if (d.surfaces) for (const [dx, dy, w] of d.surfaces) this.surfaces.push({ x: d.x + dx, y: d.y + dy, w, h: 2 });
      this.lights = spec.lights;
      this.regions = JSON.parse(JSON.stringify(spec.regions));
      this.npcs = spec.npcs.map((s) => new G.NPC(s));
      this.pigeons = spec.pigeons.map((p) => new G.Pigeon(p.x, p.y));
      this.stairs = spec.stairs || [];
      this.particles = new G.Particles();
      this.ambient = G.Ambient ? new G.Ambient(this) : null;
      this.renderer.initWorld(this.world);
      this.interactables = G.buildInteractables(this, spec);
      this.sequence = null;
      this.areaId = null;
    }

    setupBackdrop() {
      this.bus = new G.Events();
      this.setupWorld();
      this.backdrop = true;
      this.player = new G.Player(TS * 70, TS * 38 - G.PH);
      this.powers = null; this.story = null; this.inventory = null;
      this.clock = { day: 1, min: 18 * 60 + 20 };
      this.flags = { luz_sala: true, abajurOn: true };
      this.renderer.snapCamera();
    }

    newGame() {
      try {
        this.audio.unlock();
        this.bus = new G.Events();
        this.setupWorld();
        this.backdrop = false;
        this.flags = {};
        this.clock = { day: 1, min: 7 * 60 + 15 };
        this.player = new G.Player(this.spec.spawn.x, this.spec.spawn.y);
        this.powers = new G.PowerSystem(this);
        this.inventory = new G.Inventory(12);
        this.wallet = new G.Wallet(23.5);
        this.story = new G.Story(this);
        this.setupWitnesses();
        this.state = 'playing';
        this.ui.closeAll();
        this.ui.setHudVisible(true);
        this.renderer.snapCamera();
        this.story.start('s1_acordar');
      } catch (e) { this.reportError(e); }
    }

    continueGame() { this.load('auto'); }

    load(slot) {
      const r = G.Save.read(slot);
      if (!r.ok) { this.ui.toast('Não foi possível carregar: ' + r.error, 'error'); return false; }
      try {
        this.bus = new G.Events();
        this.setupWorld();
        this.backdrop = false;
        this.flags = {};
        this.player = new G.Player(this.spec.spawn.x, this.spec.spawn.y);
        this.powers = new G.PowerSystem(this);
        this.inventory = new G.Inventory(12);
        this.wallet = new G.Wallet(23.5);
        this.story = new G.Story(this);
        this.setupWitnesses();
        this.state = 'playing';
        this.ui.closeAll();
        this.ui.setHudVisible(true);
        G.Save.apply(this, r.data);
        this.renderer.snapCamera();
        this.ui.toast('Jogo carregado (' + (slot === 'auto' ? 'automático' : 'espaço ' + slot) + ').', 'good');
        return true;
      } catch (e) {
        this.reportError(e);
        this.quitToMenu();
        return false;
      }
    }

    /** Salva. silent = salvamento automático (sem avisos, e só se for seguro). */
    save(slot, silent) {
      if (this.state !== 'playing' || !this.story) return false;
      const busy = this.story.dialog.active || this.sequence || this.story.safe || this.fading;
      if (busy && slot !== 'auto') { this.ui.toast('Não dá pra salvar no meio desta cena. Tente quando ela terminar.', 'error'); return false; }
      if (busy && silent) return false;
      const r = G.Save.write(slot, this);
      if (!r.ok) { this.ui.toast('Falha ao salvar: ' + r.error, 'error'); return false; }
      if (!silent) this.ui.toast(slot === 'auto' ? 'Salvo automaticamente.' : 'Jogo salvo no espaço ' + slot + '.', 'good');
      return true;
    }
    saveSettings() { G.Save.saveSettings(this.settings); }

    quitToMenu() {
      if (this.state === 'playing') this.save('auto', true);
      this.state = 'menu';
      this.ui.closeAll();
      this.setupBackdrop();
      this.ui.showMainMenu();
    }

    /* ---------------- consultas usadas pelos módulos ---------------- */
    canControl() {
      return this.state === 'playing' && !this.ui.modal && !this.inputLock && !this.fading && !this.sequence &&
        !(this.story && this.story.dialog.active);
    }
    propById(id) { return this.props.find((p) => p.id === id) || null; }
    decorByType(t) { return this.decor.find((d) => d.type === t) || null; }
    addProp(spec) { const p = new G.Prop(spec); this.props.push(p); return p; }
    resetProp(id) {
      const p = this.propById(id);
      if (!p) return null;
      p.x = p.spawn.x; p.y = p.spawn.y; p.vx = 0; p.vy = 0; p.broken = false; p.shards = []; p.frozen = false;
      p.restoring = null; p.held = false; p.history = []; p.lastRest = { x: p.x, y: p.y }; p.angle = 0; p.noFriction = false; p.forceBreak = false; p.noBreak = false; p.removed = false;
      if (this.powers && this.powers.held === p) this.powers.held = null;
      return p;
    }
    solidProps() { return this._solids || []; }
    platformProps() { return this._platforms || []; }
    solidPropsExcept(p) { return (this._solidsAll || []).filter((q) => q !== p); }
    platformPropsExcept(p) { return (this._platformsAll || []).filter((q) => q !== p); }
    bubble(text, dur, orig) { this.ui.bubble(text, dur, orig); }
    say(entries, cb) { this.story.say(entries, cb); }
    shake(a) { this.renderer.shake(a); }

    /** Pula o relógio para um horário (mesmo dia ou seguinte), com tela preta. */
    skipTo(min, label, cb) {
      this.ui.fade(label, () => {
        const cur = this.clock.min % 1440;
        this.clock.min = min + (min < cur ? 1440 : 0) + Math.floor(this.clock.min / 1440) * 1440;
        this.clock.min %= 1440 * 365;
      }, cb);
    }
    sleep(day, min, cb) {
      this.ui.fade(G.weekdayOf(day) + ' — dia ' + day, () => {
        this.clock.day = day; this.clock.min = min;
        const p = this.player;
        p.clearPose(); p.dropCarry();
        // acorda deitado na cama e levanta (sem aparecer em outro lugar)
        const cama = this.decorByType('cama');
        p.setPose('sleep', cama.x + 15, cama.y - G.PH, 1);
        this.flags.abajurGlow = false;
        if (this.powers) this.powers.tension = 0;
        this.renderer.snapCamera();
        this.bus.emit('sleep', { day });
      }, () => {
        this.player.locked = true;
        setTimeout(() => this.player.getUp(() => { this.player.locked = false; if (cb) cb(); this.save('auto', true); }), 500);
      });
    }
    teleport(pos, label) {
      this.ui.fade('', () => {
        this.player.clearPose(); this.player.x = pos.x; this.player.y = pos.y; this.player.vx = 0; this.player.vy = 0;
        if (this.powers) this.powers.cancelAll();
        this.renderer.snapCamera();
      });
      void label;
    }

    resize() {
      const s = Math.min(window.innerWidth / G.VIEW_W, window.innerHeight / G.VIEW_H);
      // modo inteiro: múltiplo exato dos pixels finos (G.HI por unidade), sem pixels tortos
      this.scale = this.settings.scaleMode === 'fit' ? Math.max(0.5, s) : Math.max(1, Math.floor(s * G.HI) / G.HI);
      const st = document.getElementById('stage');
      st.style.width = (G.VIEW_W * this.scale) + 'px';
      st.style.height = (G.VIEW_H * this.scale) + 'px';
      document.documentElement.style.setProperty('--scale', this.scale);
    }

    reportError(e) {
      if (!e) return;
      console.error('[V] erro', e);
      this.errorPaused = true;
      try { this.ui.showError(e); } catch (x) { /* a própria UI falhou */ }
    }

    /* ---------------- laço ---------------- */
    frame(ts) {
      requestAnimationFrame((t) => this.frame(t));
      const dt = Math.min(0.1, Math.max(0, (ts - (this.last || ts)) / 1000));
      this.last = ts;
      this._fpsN++; this._fpsT += dt;
      if (this._fpsT >= 1) { this.fps = this._fpsN; this._fpsN = 0; this._fpsT = 0; }
      try {
        this.acc += dt;
        let steps = 0;
        while (this.acc >= G.STEP && steps < 5) {
          this.tick(G.STEP, steps === 0);
          this.acc -= G.STEP; steps++;
          if (steps === 1) this.input.consume();
        }
        if (steps >= 5) this.acc = 0;
        this.ui.update(dt);
        this.renderer.render();
        this.renderer.drawCursor();
      } catch (e) { this.reportError(e); }
    }

    tick(dt, first) {
      if (this.state === 'menu') {
        // fundo animado do menu
        this.clock.min += dt * 6;
        this.player.x += 10 * dt; if (this.player.x > TS * 130) this.player.x = TS * 40;
        for (const n of this.npcs) n.update(dt, this);
        for (const pg of this.pigeons) pg.update(dt, this);
        if (this.ambient) this.ambient.update(dt);
        this.particles.update(dt);
        this.renderer.update(dt);
        return;
      }
      if (this.errorPaused) return;
      if (first) this.handleMenuKeys();
      if (this.ui.modal) return;
      this.update(dt, first);
    }

    handleMenuKeys() {
      const inp = this.input, ui = this.ui, m = ui.modal;
      if (m) {
        if (inp.hit('pause')) { if (['pause', 'caderno', 'bolsos', 'endcard'].includes(m)) ui.closeAll(); else ui.back(); }
        else if (m === 'caderno' && inp.hit('caderno')) ui.closeAll();
        else if (m === 'bolsos' && inp.hit('bolsos')) ui.closeAll();
        return;
      }
      if (inp.hit('pause')) { ui.openPause(); return; }
      if (this.fading) return;
      if (inp.hit('caderno')) { ui.openCaderno(); return; }
      if (inp.hit('bolsos')) { ui.openBolsos(); return; }
    }

    update(dt, first) {
      const inp = this.input, st = this.story;
      const dialogWas = st.dialog.active;
      this.inputLock = dialogWas;
      if (dialogWas && first) {
        if (inp.hit('interact') || inp.hit('jump') || inp.mouse.pressed[0]) st.dialog.advance();
        const cur = st.dialog.current;
        if (cur && cur.choices && st.dialog.done) for (let i = 0; i < cur.choices.length; i++) if (inp.pressed['Digit' + (i + 1)]) { st.dialog.choose(i); break; }
      }

      if (!st.dialog.active && !this.fading) this.clock.min += dt * G.CLOCK_RATE;

      // listas de colisão do quadro
      this._solidsAll = this.props.filter((p) => p.solid && !p.removed);
      this._platformsAll = this.props.filter((p) => p.platform && !p.removed);
      this._solids = this._solidsAll.filter((p) => !p.held);
      this._platforms = this._platformsAll.filter((p) => !p.held);

      st.update(dt);
      if (this.sequence) this.sequence.update(dt);
      this.player.update(dt, this);
      this.powers.update(dt);
      for (const p of this.props) p.update(dt, this);
      this.checkHits();
      this.checkQuestTriggers();
      if (this.props.some((p) => p.removed && p.dynamic)) this.props = this.props.filter((p) => !(p.removed && p.dynamic));
      for (const n of this.npcs) n.update(dt, this);
      for (const pg of this.pigeons) pg.update(dt, this);
      if (this.ambient) this.ambient.update(dt);
      this.particles.update(dt);

      // área atual
      const a = this.world.areaAt(this.player.cx, this.player.cy);
      if (a && a.id !== this.areaId) { this.areaId = a.id; this.areaName = a.name; this.bus.emit('area', a); }

      // interação
      if (this.canControl() && !dialogWas) {
        const c = this.findInteraction();
        this.ui.prompt(c ? c.label : null);
        if (c && inp.hit('interact')) this.doInteract(c);
      } else this.ui.prompt(null);

      this.renderer.update(dt);
    }

    /* ---------------- interação ---------------- */
    propLabel(p) {
      const st = this.story;
      if (p.type === 'copo' && !p.broken && !p.restoring) {
        if (p.frozen && st.stepId === 's1_queda') return 'Cutucar o copo';
        if (p.state.sabor === 'coca') return 'Beber';
        if (st.stepId === 's4_manha') return 'Olhar o copo';
        return null;
      }
      if (p.type === 'vassoura') return st.stepId === 's1_vassoura' ? 'Pegar a vassoura' : 'Vassoura';
      if (p.carried) return null;
      if (p.T.item) return 'Pegar ' + p.T.name.toLowerCase();
      if (p.T.money) return 'Pegar o dinheiro';
      return null;
    }
    npcLabel(n) {
      if (!n.visibleNow || n.scared > 0) return null;
      const names = { atendente: 'Falar com a atendente', porteiro: 'Falar com o porteiro', crianca: 'Falar com o menino', moto: 'Falar com o entregador', senhora: 'Falar com a senhora', passeador: 'Falar com o homem do cachorro', casal_a: 'Falar com o casal', casal_b: 'Falar com o casal' };
      if (n.kind === 'moto') return n.alpha > 0.5 && n.phase === 3 ? names.moto : null;
      return names[n.kind] || 'Conversar';
    }
    findInteraction() {
      const p = this.player;
      const box = { x: p.x - 8, y: p.y - 4, w: p.w + 16, h: p.h + 8 };
      let best = null, bd = Infinity;
      // desempate: o que está à frente de V e sob o cursor tem preferência
      const m = this.input.mouse.inside ? this.renderer.screenToWorld(this.input.mouse.sx, this.input.mouse.sy) : null;
      const consider = (rect, label, data, bias) => {
        if (!label || !U.overlap(box, rect)) return;
        const hovered = m && m.x >= rect.x - 2 && m.x <= rect.x + rect.w + 2 && m.y >= rect.y - 2 && m.y <= rect.y + rect.h + 2;
        const rcx = rect.x + rect.w / 2;
        const behind = (rcx - p.cx) * p.facing < -3; // prefere o que está à frente de V
        const d = U.dist(p.cx, p.cy, rcx, rect.y + rect.h / 2) - (bias || 0) - (hovered ? 8 : 0) + (behind ? 12 : 0);
        if (d < bd) { bd = d; best = Object.assign({ label }, data); }
      };
      for (const q of this.props) if (!q.removed && !(q.hidden && !q.perceived)) consider(q.hitBox(), this.propLabel(q), { kind: 'prop', prop: q, id: q.id }, 12);
      for (const pk of this.pickups) if (pk.visible(this)) consider({ x: pk.x - 3, y: pk.y - 3, w: pk.w + 6, h: pk.h + 6 }, pk.item.startsWith('registro') ? 'Ler o papel' : 'Pegar', { kind: 'pickup', pickup: pk, id: pk.id }, 12);
      for (const n of this.npcs) consider({ x: n.x - 6, y: n.y, w: n.w + 12, h: n.h }, this.npcLabel(n), { kind: 'npc', npc: n, id: n.id }, 6);
      for (const it of this.interactables) {
        if (!it.enabled) continue;
        const label = typeof it.label === 'function' ? it.label(this) : it.label;
        consider(it, label, { kind: 'static', it, id: it.id }, 0);
      }
      return best;
    }

    doInteract(c) {
      const st = this.story;
      this.audio.play('ui', 0.4);
      if (c.kind === 'prop') {
        if (!st.intercept(c.id)) this.defaultPropAction(c.prop);
      } else if (c.kind === 'pickup') {
        const pk = c.pickup;
        pk.taken = true;
        if (G.ITEMS[pk.item]) { this.inventory.add(pk.item); this.ui.toast(G.ITEMS[pk.item].name + ' foi para os bolsos.', 'item'); }
        this.audio.play('pickup');
        this.bus.emit('pickup', { item: pk.item, id: pk.id });
      } else if (c.kind === 'npc') {
        this.npcInteract(c.npc);
      } else if (c.kind === 'static') {
        if (!st.intercept(c.id)) c.it.action(this);
      }
      this.bus.emit('interact', { id: c.id, kind: c.kind });
    }

    defaultPropAction(p) {
      if (p.T.money) {
        p.removed = true; this.wallet.add(p.T.money, !!p.state.criado); this.audio.play('pickup');
        this.ui.toast('+ R$ ' + p.T.money + ',00 na carteira (' + this.wallet.text + ').', 'item');
        return;
      }
      if (p.T.item) {
        if (this.inventory.add(p.T.item) === 0) { p.removed = true; this.audio.play('pickup'); this.ui.toast(p.T.name + ' foi para os bolsos (I).', 'item'); }
        else this.bubble('Os bolsos estão cheios.', 1.5, true);
      } else if (p.type === 'vassoura') this.bubble('Atrás da porta do banheiro, onde ele nunca lembrava de guardá-la direito.', 3);
    }

    /* ---------------- testemunhas (conteúdo original do jogo) ---------------- */
    setupWitnesses() {
      const at = (d) => {
        if (d.prop) return { x: d.prop.cx, y: d.prop.cy };
        if (d.x !== undefined) return { x: d.x, y: d.y };
        return { x: this.player.cx, y: this.player.cy };
      };
      const map = { 'levitate:start': 'levitate', 'prop:break': 'break', create: 'create', deslocar: 'deslocar', teleport: 'teleport', fly: 'fly', 'restore:start': 'restore' };
      for (const ev of Object.keys(map)) this.bus.on(ev, (d) => this.witness(map[ev], at(d || {})));
    }
    /** Quem estiver perto e no mesmo ambiente vê o que V fez — e reage. */
    witness(type, pos) {
      if (!this.story || this.state !== 'playing') return;
      const area = this.world.areaAt(pos.x, pos.y);
      let seen = 0;
      for (const n of this.npcs) {
        if (!n.visibleNow) continue;
        const na = this.world.areaAt(n.cx, n.y + 10);
        const sameSpace = (area && na && area.id === na.id) || (area && na && !area.indoor && !na.indoor);
        if (!sameSpace) continue;
        if (Math.abs(n.cx - pos.x) > 150 || Math.abs(n.y + 13 - pos.y) > 60) continue;
        if (n.react(type, this, pos.x)) seen++;
      }
      if (!seen) return;
      const st = this.story;
      st.flags.testemunhas = (st.flags.testemunhas || 0) + seen;
      if (!st.flags.primeiraTestemunha) {
        st.flags.primeiraTestemunha = true;
        this.bubble('Alguém viu.', 2.2, true);
        st.registro('testemunhas', 'Alguém viu', 'A primeira vez que alguém viu uma coisa impossível acontecer perto de V. Ninguém sabe que foi ele. Ainda. Cada pessoa que vê é uma pergunta a mais solta no mundo.', true);
      }
      this.bus.emit('witness', { type, count: seen });
    }

    /** Objetos arremessados acertam pessoas. */
    checkHits() {
      for (const p of this.props) {
        if (p.removed || p.broken || p.held || p.carried) continue;
        const sp = Math.hypot(p.vx, p.vy);
        if (sp < 140) continue;
        for (const n of this.npcs) {
          if (!n.visibleNow || n.hitT > 0 || (n.kind === 'moto' && n.phase !== 3)) continue;
          if (!U.overlap(p, { x: n.x, y: n.y, w: n.w, h: n.h })) continue;
          p.vx *= -0.3; p.vy = -60;
          n.react('hit', this, p.cx);
          this.audio.play('thud', 0.6);
          this.story.flags.acertouAlguem = (this.story.flags.acertouAlguem || 0) + 1;
          this.bus.emit('npc:hit', { id: n.id });
        }
      }
    }

    /** Gatilhos de missões que dependem de posição (pipa, chave da senhora). */
    checkQuestTriggers() {
      const st = this.story, ps = this.powers;
      const kid = this.npcs.find((n) => n.kind === 'crianca');
      const pipa = this.propById('pipa');
      if (kid && pipa && !pipa.static && !pipa.held && !st.flags.pipaDevolvida && kid.visibleNow && U.dist(pipa.cx, pipa.cy, kid.cx, kid.y + 10) < 40 && !st.dialog.active) {
        st.flags.pipaDevolvida = true;
        st.activateSide('pipa'); st.progressSide('pipa', 'descer');
        this.kidReturn(kid, pipa);
      }
      const sra = this.npcs.find((n) => n.kind === 'senhora');
      if (sra && ps && ps.perceive && sra.visibleNow && !st.flags.viuChaveSenhora && st.side.chave_senhora && U.dist(ps.perceive.x, ps.perceive.y, sra.x + 8, sra.y + 15) < 26) {
        st.flags.viuChaveSenhora = true; st.progressSide('chave_senhora', 'ver');
        this.bubble('Lá está: no bolsinho de dentro, do lado do zíper.', 3, true);
      }
    }

    kidReturn(kid, pipa) {
      pipa.removed = true;
      const st = this.story;
      kid.stare = 3;
      const fim = (k) => {
        st.flags.pipaResposta = k;
        st.progressSide('pipa', 'conversa');
        st.registro('pipa', 'A pipa do menino', { mentira: 'Disse que foi o vento. O menino olhou para a árvore, para o céu parado, e não acreditou.', verdade: 'Disse a verdade: "fui eu". O menino achou a coisa mais incrível do mundo — e vai contar para todo mundo.', nada: 'Não disse nada. Entregou a pipa e foi embora. O menino ficou olhando.' }[k], true);
      };
      this.say([{ who: 'Menino', orig: true, text: 'MINHA PIPA! Ela desceu sozinha?! Moço, como ela desceu?', choices: [
        { text: '"Foi o vento."', orig: true, fn: () => { fim('mentira'); this.say([{ who: 'Menino', orig: true, text: 'Que vento? Não tá ventando nada... Bom, obrigado.' }]); } },
        { text: '"Fui eu. Com a cabeça."', orig: true, fn: () => { fim('verdade'); this.story.flags.testemunhas = (this.story.flags.testemunhas || 0) + 1; this.say([{ who: 'Menino', orig: true, text: 'MENTIRA! Faz de novo! Faz de novo! Eu vou contar pra minha mãe!' }, { who: 'pensamento', orig: true, text: 'Talvez não tenha sido a melhor ideia.' }]); } },
        { text: 'Entregar a pipa sem dizer nada.', orig: true, fn: () => { fim('nada'); this.say([{ who: 'Menino', orig: true, text: '...valeu.' }]); } },
      ] }]);
      this.inventory && this.audio.play('success');
    }

    npcInteract(n) {
      const st = this.story, f = st.flags;
      const observe = (key) => ({ text: 'Só observar.', orig: true, fn: () => { this.bubble(NPC_TEXT[key], 4, key !== 'casal'); this.bus.emit('observe', { id: key }); } });
      const bye = (t) => ({ text: t || 'Nada não. Até mais.', orig: true });
      const saw = Object.keys(n.memory).length > 0;
      n.stare = 1.5;
      const who = { atendente: 'Atendente', porteiro: 'Seu Valdir (porteiro)', crianca: 'Menino', moto: 'Entregador', senhora: 'Senhora', passeador: 'Homem do cachorro', casal_a: 'Casal', casal_b: 'Casal' }[n.kind];
      const S = (text, choices) => ({ who, orig: true, text, choices });
      switch (n.kind) {
        case 'atendente': return this.bakery(n);
        case 'porteiro': {
          const ch = [{ text: 'Alguma novidade no prédio?', orig: true, fn: () => this.say([S(f.chaveDevolvida ? 'Novidade é o terraço aberto de novo, graças a você. O resto é o de sempre: o do 31 arrastando coisa às onze da noite.' : 'Novidade nenhuma. Só a chave do terraço, que sumiu faz anos. Acho que caiu atrás das caixas de correio quando trocaram os painéis.')]) }];
          if (this.inventory.has('pacote')) ch.unshift({ text: 'Chegou isso pro 32.', orig: true, fn: () => { this.inventory.remove('pacote'); this.wallet.add(5); st.progressSide('entrega', 'resolver'); this.say([S('Pro 32? Tá vazio desde março. Deixa que eu resolvo com a transportadora. Toma, pelo trabalho.'), { who: 'narr', orig: true, text: 'Seu Valdir deu cinco reais. V tentou recusar. Não conseguiu.' }]); } });
          if (this.inventory.has('chave_terraco') && !f.chaveDevolvida) ch.unshift({ text: 'Achei a chave do terraço.', orig: true, fn: () => {
            f.chaveDevolvida = true; this.inventory.remove('chave_terraco');
            for (const [x, y] of G.HATCH_CELLS) { const t = this.world.get(x, y); if (G.TILES[t].solid && G.TILES[t].toggle != null) this.world.set(x, y, G.TILES[t].toggle); }
            this.wallet.add(20);
            this.say([S('Não acredito! Onde tava? ... Atrás das caixas? Eu falei! Vou deixar o alçapão destrancado de vez. E isso aqui é pra você, não discute.'), { who: 'narr', orig: true, text: 'Vinte reais e um tapinha no ombro.' }]);
          } });
          ch.push(bye('Bom dia, seu Valdir.'));
          return this.say([S(saw ? 'Seu V... o senhor viu umas coisas estranhas acontecendo por aqui? Eu tô ficando velho.' : (f.porteiroOi ? 'E aí, seu V. Precisando de alguma coisa?' : 'Bom dia, seu V! Sumido, hein? Faz dias que não desce.'), ch)], () => { f.porteiroOi = true; });
        }
        case 'crianca': {
          const pipa = this.propById('pipa');
          if (pipa && pipa.static) return this.say([S('Moço, minha pipa enganchou lá em cima da árvore. Meu pai disse que agora só com escada.', [
            { text: 'Vou ver o que dá pra fazer.', orig: true, fn: () => { st.activateSide('pipa'); this.bubble('Uma pipa presa num galho. Sem escada. Hm.', 2.5, true); } }, bye('Que pena.')])]);
          const r = f.pipaResposta;
          return this.say([S(r === 'verdade' ? 'Faz de novo! Faz a pipa voar sem vento!' : r === 'mentira' ? 'Ainda não acredito nesse vento aí.' : 'Valeu pela pipa, moço!', [bye('Vai brincar.')])]);
        }
        case 'moto': {
          if (st.side.entrega && st.side.entrega.state === 'done') return this.say([S('Valeu de novo, mano!', [bye()])]);
          n.waitPlayer = true;
          st.activateSide('entrega');
          const ch = [];
          if (f.viu32) ch.push({ text: '"O 32 está vazio. Só caixa e poeira."', orig: true, fn: () => { st.progressSide('entrega', 'resolver'); n.waitPlayer = false; n.timer = 3; this.say([S('Sério? Então vou devolver. Tu salvou meu dia, valeu!')]); } });
          ch.push({ text: '"Deixa comigo, eu entrego pro porteiro."', orig: true, fn: () => { this.inventory.add('pacote'); n.waitPlayer = false; n.timer = 3; this.ui.toast('Pacote do 32 foi para os bolsos.', 'item'); this.say([S('Show! Valeu!')]); } });
          ch.push({ text: '"Não sei, não."', orig: true, fn: () => { n.waitPlayer = false; } });
          return this.say([S(saw ? 'Mano, tu viu aquilo agora? ...Enfim. Sabe se tem alguém no 32? Ninguém atende o interfone.' : 'E aí! Sabe se tem alguém no 32? Ninguém atende o interfone.', ch)]);
        }
        case 'senhora': {
          if (f.senhoraAchou) return this.say([S('Achei, meu filho, achei! Você é um anjo.', [bye('De nada.')])]);
          const ch = [{ text: 'A senhora perdeu alguma coisa?', orig: true, fn: () => { st.activateSide('chave_senhora'); this.say([S('A chave de casa. Eu já olhei a bolsa três vezes. Ela some lá dentro.')]); } }];
          if (f.viuChaveSenhora) ch.unshift({ text: '"Está no bolsinho de dentro, do lado do zíper."', orig: true, fn: () => {
            f.senhoraAchou = true; st.progressSide('chave_senhora', 'contar'); this.inventory.add('bala', 2);
            this.say([S('...Está aqui! Como é que você sabia?', [
              { text: '"Chute."', orig: true, fn: () => this.say([S('Que chute bom! Toma uma bala. Toma duas.')]) },
              { text: '"Eu vi."', orig: true, fn: () => { f.testemunhas = (f.testemunhas || 0) + 1; this.say([S('Viu? Através da bolsa? ...Ah, esses jovens e as piadas. Toma uma bala.')]); } },
            ])]);
          } });
          ch.push(observe('senhora'), bye());
          return this.say([S(saw ? 'Ai, menino, eu vi uma coisa... deixa pra lá, ninguém ia acreditar. Ai, a minha chave...' : 'Ai, meu filho... eu sempre acho que esqueci a chave.', ch)]);
        }
        case 'passeador':
          return this.say([S(saw ? 'Rapaz, você viu? Uma coisa ficou voando ali. O Pipoca latiu feito doido.' : 'Bom dia! Ele puxa, mas é manso. Chama Pipoca.', [
            { text: 'Fazer carinho no Pipoca.', orig: true, fn: () => { n.dog.bark = 1; this.bubble('O rabo do Pipoca vira um ventilador.', 2.5, true); f.carinhoPipoca = true; } },
            observe('passeador'), bye('Bom passeio.')])]);
        case 'casal_a': case 'casal_b':
          if (f.casalCalmo) return this.say([S('A gente ainda tá rindo daquilo. Obrigado, viu?', [bye()])]);
          return this.say([S('Desculpa... a gente tá falando alto?', [
            { text: '"Tá tudo bem."', orig: true, fn: () => this.say([S('Ufa. É que ele não lembra de nada que combina.')]) },
            { text: '"Vocês dois estão certos, sabia?"', orig: true, fn: () => { f.casalCalmo = true; this.bus.emit('casal:calmo', {}); this.say([S('...Os dois? Como assim os dois? — e os dois começam a rir.')]); } },
            observe('casal'), bye()])]);
        default: return null;
      }
    }

    /** Padaria (conteúdo original do jogo): compra com a carteira de V. */
    bakery(n) {
      if (!G.padariaAberta(this)) { this.bubble('A padaria está fechando.', 1.5, true); return; }
      const st = this.story;
      const item = (id, price, name) => ({ text: name + ' — R$ ' + price.toFixed(2).replace('.', ','), orig: true, fn: () => {
        if (!this.wallet.pay(price)) { this.say([{ who: 'Atendente', orig: true, text: 'Ih, não deu. Tá faltando dinheiro aí, moço.' }]); return; }
        if (this.inventory.add(id) !== 0) { this.wallet.add(price); this.say([{ who: 'Atendente', orig: true, text: 'Seus bolsos estão cheios, moço.' }]); return; }
        const suspeita = this.wallet.criado > 0 && Math.random() < 0.35;
        if (suspeita) st.flags.notaSuspeita = (st.flags.notaSuspeita || 0) + 1;
        const lines = [{ who: 'Atendente', orig: true, text: suspeita ? 'Nossa... essa nota tá novinha demais. Parece que saiu da gráfica agora. Bom, tá aqui.' : 'Tá aqui. Bom dia pra você!' }];
        if (!st.flags.primeiroPao && id === 'pao_frances') { st.flags.primeiroPao = true; lines.push({ who: 'pensamento', orig: true, text: 'Comprar pão. Parece uma vitória enorme. E é patético perceber isso.' }); }
        this.say(lines);
        this.bus.emit('buy', { item: id });
      } });
      this.say([{ who: 'Atendente', orig: true, text: 'Bom dia! Vai querer o quê? (você tem ' + this.wallet.text + ')', choices: [
        item('pao_frances', 1, 'Pão francês'), item('cafe', 4.5, 'Café'), item('sonho', 5, 'Sonho'),
        { text: 'Só olhando, obrigado.', orig: true, fn: () => this.say([{ who: 'Atendente', orig: true, text: 'Fica à vontade.' }]) },
      ] }]);
    }
  }
  G.Game = Game;

  // inicia quando a página carregar (não roda nos testes em Node)
  if (typeof document !== 'undefined' && document.getElementById && document.getElementById('game')) {
    window.addEventListener('DOMContentLoaded', () => {
      try { G.game = new Game(); } catch (e) {
        console.error(e);
        const el = document.getElementById('error');
        if (el) { document.getElementById('error-msg').textContent = String(e.stack || e); el.classList.remove('hidden'); }
      }
    });
  }
})(window.VG = window.VG || {});

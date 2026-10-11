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
      this.particles = new G.Particles();
      this.renderer.initWorld(this.world);
      this.interactables = G.buildInteractables(this, spec);
      this.sequence = null;
      this.areaId = null;
    }

    setupBackdrop() {
      this.bus = new G.Events();
      this.setupWorld();
      this.backdrop = true;
      this.player = new G.Player(TS * 70, TS * 38 - 26);
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
        this.story = new G.Story(this);
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
        this.story = new G.Story(this);
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
        this.player.clearPose();
        const cama = this.decorByType('cama');
        this.player.x = cama.x + cama.w + 4; this.player.y = TS * 30 - 26; this.player.vx = 0; this.player.vy = 0;
        this.flags.abajurGlow = false;
        if (this.powers) this.powers.tension = 0;
        this.renderer.snapCamera();
        this.bus.emit('sleep', { day });
      }, () => { if (cb) cb(); this.save('auto', true); });
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
      this.scale = this.settings.scaleMode === 'fit' ? Math.max(0.5, s) : Math.max(1, Math.floor(s));
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
      if (this.props.some((p) => p.removed && p.dynamic)) this.props = this.props.filter((p) => !(p.removed && p.dynamic));
      for (const n of this.npcs) n.update(dt, this);
      for (const pg of this.pigeons) pg.update(dt, this);
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
      if (p.type === 'laranja') return 'Pegar a laranja';
      return null;
    }
    npcLabel(n) {
      if (!n.visibleNow) return null;
      if (n.kind === 'atendente') return 'Falar com a atendente';
      if (n.kind === 'moto') return n.alpha > 0.5 && n.phase === 3 ? 'Observar' : null;
      return 'Observar';
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
      for (const n of this.npcs) consider({ x: n.x, y: n.y, w: n.w, h: n.h }, this.npcLabel(n), { kind: 'npc', npc: n, id: n.id }, 6);
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
      if (p.type === 'laranja') {
        if (this.inventory.add('laranja_perfeita') === 0) { p.removed = true; this.audio.play('pickup'); this.ui.toast('Laranja perfeita foi para os bolsos (I).', 'item'); }
        else this.bubble('Os bolsos estão cheios.', 1.5, true);
      } else if (p.type === 'vassoura') this.bubble('Atrás da porta do banheiro, onde ele nunca lembrava de guardá-la direito.', 3);
    }

    npcInteract(n) {
      if (n.kind === 'atendente') {
        const st = this.story;
        if (!G.padariaAberta(this)) { this.bubble('A padaria está fechando.', 1.5, true); return; }
        const today = st.flags.paoDia === this.clock.day;
        this.say([{ who: 'Atendente', orig: true, text: today ? 'De novo? Ainda tem pão quentinho.' : 'Bom dia! Vai querer o quê?', choices: [
          { text: 'Um pão francês.', orig: true, fn: () => {
            if (this.inventory.add('pao_frances') === 0) { st.flags.paoDia = this.clock.day; this.ui.toast('Pão francês foi para os bolsos.', 'item'); this.say([{ who: 'Atendente', orig: true, text: 'Tá aqui. Bom dia pra você!' }, { who: 'pensamento', orig: true, text: 'Comprar pão. Parece uma vitória enorme. E é patético perceber isso.' }]); }
            else this.say([{ who: 'Atendente', orig: true, text: 'Seus bolsos estão cheios, moço.' }]);
          } },
          { text: 'Só olhando, obrigado.', orig: true, fn: () => this.say([{ who: 'Atendente', orig: true, text: 'Fica à vontade.' }]) },
        ] }]);
        return;
      }
      const key = n.kind.startsWith('casal') ? 'casal' : n.kind;
      this.bubble(NPC_TEXT[key], 4, key !== 'casal');
      this.bus.emit('observe', { id: key });
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

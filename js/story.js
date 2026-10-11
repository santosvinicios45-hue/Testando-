/* =====================================================================
 * História: diálogos, missões (passos), caderno e missões secundárias.
 *
 * Marcação de autoria (exigência do projeto):
 *   - Falas com kind 'narr' citam ou condensam o romance
 *     "V — O Homem Que Acordou Grande Demais" (caps. 1 e 2).
 *   - Tudo marcado com orig: true é CONTEÚDO ORIGINAL DO JOGO e aparece
 *     na tela com o selo "◆ original".
 *
 * Um passo (step) é um objeto com:
 *   chapter, objective (texto ou função), checklist(st, g) opcional,
 *   enter(st, g, resumed), update(st, g, dt), on(st, g, evento, dados),
 *   intercept(st, g, idInteração) → true se a história tratou a interação,
 *   allowSleep, safe (a Linha não quebra coisas nessa cena).
 * ===================================================================== */
(function (G) {
  'use strict';
  const U = G.util;
  const TS = G.TILE;

  /* ------------------------------------------------------------------
   * Diálogo
   * ------------------------------------------------------------------ */
  class Dialogue {
    constructor(game) { this.game = game; this.queue = []; this.current = null; this.onDone = null; this.chars = 0; this.active = false; }
    say(entries, onDone) {
      const list = (Array.isArray(entries) ? entries : [entries]).map((e) => (typeof e === 'string' ? { who: 'narr', text: e } : e));
      if (this.active) {
        // encadeia: o callback anterior roda antes dos novos itens
        const prev = this.onDone;
        this.queue.push(...list);
        this.onDone = () => { if (prev) prev(); if (onDone) onDone(); };
        return;
      }
      this.queue = list; this.onDone = onDone || null; this.active = true; this.next();
    }
    next() {
      this.current = this.queue.shift() || null;
      this.chars = 0;
      if (!this.current) {
        this.active = false;
        const cb = this.onDone; this.onDone = null;
        if (cb) cb();
        return;
      }
      if (this.current.onShow) this.current.onShow();
    }
    get fullText() { return this.current ? this.current.text : ''; }
    get done() { return this.current && this.chars >= this.current.text.length; }
    update(dt) {
      if (!this.active || !this.current) return;
      if (this.chars < this.current.text.length) {
        const before = Math.floor(this.chars);
        this.chars = Math.min(this.current.text.length, this.chars + dt * 70);
        if (Math.floor(this.chars) !== before && Math.floor(this.chars) % 3 === 0) this.game.audio.play('type', 0.6);
      }
    }
    advance() {
      if (!this.active || !this.current) return;
      if (!this.done) { this.chars = this.current.text.length; return; }
      if (this.current.choices) return; // escolha obrigatória
      this.next();
    }
    choose(i) {
      if (!this.current || !this.current.choices) return;
      const c = this.current.choices[i];
      if (!c) return;
      this.game.audio.play('ui');
      this.current.choices = null; // libera o avanço
      const fn = c.fn;
      this.next();
      if (fn) fn();
    }
    clear() { this.queue = []; this.current = null; this.active = false; this.onDone = null; }
  }
  G.Dialogue = Dialogue;

  /* atalhos para montar falas */
  const N = (text) => ({ who: 'narr', text });                       // narração do romance
  const V = (text, orig) => ({ who: 'V', text, orig: !!orig });       // fala de V
  const P = (text, orig) => ({ who: 'pensamento', text, orig: !!orig }); // pensamento de V
  const O = (text) => ({ who: 'narr', text, orig: true });            // narração original do jogo

  /* ------------------------------------------------------------------
   * Sequência "A Linha" (cap. 2, dia 3): segurar a avó, o primo, a tarde
   * de 2009 enquanto o fio arrebenta. Não é combate — é segurar.
   * ------------------------------------------------------------------ */
  class LinhaSequence {
    constructor(game, onSuccess) {
      this.g = game; this.onSuccess = onSuccess; this.failures = 0;
      this.labels = ['A avó', 'O nome do primo', 'A bicicleta do primo', 'A casa da avó', 'Café coado com pano', 'A tarde de 2009'];
      this.reset();
    }
    reset() {
      const p = this.g.player;
      this.frags = this.labels.map((label, i) => {
        const a = (i / this.labels.length) * Math.PI * 2 - Math.PI / 2 + U.rand(-0.15, 0.15); // espalhadas ao redor de V
        return { label, a, dist: 16, speed: U.rand(9, 14), locked: false, drag: false, x: p.cx, y: p.cy, wob: Math.random() * 6 };
      });
      this.t = 0; this.state = 'run'; this.amount = 0; this.dragging = null;
    }
    get center() { const p = this.g.player; return { x: p.cx, y: p.y + 10 }; }
    update(dt) {
      if (this.state !== 'run') return;
      const g = this.g, inp = g.input;
      this.t += dt;
      const c = this.center;
      const m = g.renderer.screenToWorld(inp.mouse.sx, inp.mouse.sy);
      const hold = inp.is('hold');
      const drift = (hold ? 0.45 : 1) * (1 + this.t * 0.04);
      const grabR = g.powers.emotion === 'panico' ? 15 : 11;
      if (inp.mouse.pressed[0]) {
        let best = null, bd = grabR;
        for (const f of this.frags) if (!f.locked) { const d = U.dist(f.x, f.y, m.x, m.y); if (d < bd) { bd = d; best = f; } }
        if (best) { best.drag = true; this.dragging = best; g.audio.play('lift', 0.6); }
      }
      if (this.dragging && !inp.mouse.buttons[0]) {
        const f = this.dragging; f.drag = false; this.dragging = null;
        if (U.dist(f.x, f.y, c.x, c.y) < 18) { f.locked = true; f.dist = 9; g.audio.play('heart'); g.particles.ring(f.x, f.y, '#ffd27a', 10); }
        else f.dist = U.dist(f.x, f.y, c.x, c.y);
      }
      let sum = 0, failed = false;
      for (const f of this.frags) {
        if (f.locked) { f.a += dt * 0.8; f.x = c.x + Math.cos(f.a) * 12; f.y = c.y + Math.sin(f.a) * 7; continue; }
        if (f.drag) { f.x = U.lerp(f.x, m.x, 0.35); f.y = U.lerp(f.y, m.y, 0.35); f.a = Math.atan2(f.y - c.y, f.x - c.x); }
        else {
          f.dist += f.speed * drift * dt;
          f.x = c.x + Math.cos(f.a) * f.dist; f.y = c.y + Math.sin(f.a) * f.dist * 0.75 + Math.sin(this.t * 2 + f.wob) * 2;
        }
        sum += Math.min(1, f.dist / 150);
        if (f.dist > 150 && !f.drag) failed = true;
      }
      // segurar com força estica a linha (custa)
      if (hold) g.powers.tension = Math.min(g.powers.capacity * 0.98, g.powers.tension + 10 * dt);
      this.amount = U.clamp(sum / this.frags.length + 0.15, 0, 1);
      g.renderer.desat = this.amount;
      if (this.frags.every((f) => f.locked)) {
        this.state = 'done'; g.renderer.desat = 0; g.audio.play('restore');
        g.renderer.timeRipple(c.x, c.y);
        this.onSuccess();
      } else if (failed) {
        this.state = 'fail'; this.failures++;
        g.audio.play('unravel'); g.renderer.glitch(0.6); g.shake(4);
        g.say([O('Escorregou. Ele sentiu escorregar — e puxou de volta antes que sumisse de vez.'), P('Segura. Segura tudo.', true)], () => this.reset());
      }
    }
    draw(ctx, cam) {
      if (this.state === 'done') return;
      const c = this.center;
      ctx.save();
      ctx.font = '10px "VT323", monospace';
      ctx.textAlign = 'center';
      for (const f of this.frags) {
        const x = Math.round(f.x - cam.x), y = Math.round(f.y - cam.y);
        // fio ligando a memória a V
        ctx.strokeStyle = f.locked ? 'rgba(255,210,122,0.9)' : 'rgba(255,210,122,' + (0.7 - Math.min(0.6, f.dist / 250)) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(c.x - cam.x, c.y - cam.y);
        ctx.quadraticCurveTo((c.x + f.x) / 2 - cam.x, (c.y + f.y) / 2 - cam.y + 10, x, y); ctx.stroke();
        ctx.fillStyle = f.drag ? '#fff6d8' : (f.locked ? '#ffd27a' : '#f4e6c8');
        ctx.globalAlpha = f.locked ? 1 : 1 - Math.min(0.7, f.dist / 220);
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a2a14'; ctx.fillRect(x - 1, y - 1, 2, 2);
        const m = this.g.renderer.screenToWorld(this.g.input.mouse.sx, this.g.input.mouse.sy);
        const hov = G.util.dist(m.x, m.y, f.x, f.y) < 10;
        if (!f.locked && (f.dist > 30 || hov || f.drag)) {
          const label = f.label === 'O nome do primo' && f.dist > 70 ? 'O nome do ______' : f.label;
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          const w = ctx.measureText(label).width + 4;
          const ly = f.y < c.y ? y - 15 : y + 7; // rótulo do lado de fora, para não sobrepor
          ctx.fillRect(x - w / 2, ly, w, 9);
          ctx.fillStyle = '#ffe9b8'; ctx.fillText(label, x, ly + 8);
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  }
  G.LinhaSequence = LinhaSequence;

  /* ------------------------------------------------------------------
   * Passos da campanha — Ato I, capítulos 1 e 2
   * ------------------------------------------------------------------ */
  const S = {};
  const floorApt = TS * 30;
  const counterTop = TS * 29;

  // ---------- Capítulo 1 — O Copo ----------
  S.s1_acordar = {
    chapter: 1, objective: 'Lave o copo de requeijão na pia (chegue perto e aperte E).',
    enter(st, g, resumed) {
      g.clock.day = 1; g.clock.min = 7 * 60 + 15;
      g.resetProp('copo');
      g.powers.setEmotion('calmo');
      if (!resumed) {
        st.say([
          N('O copo caiu numa terça-feira, às sete e dezenove da manhã, e essa é a parte da história que ninguém nunca vai acreditar quando ele contar.'),
          N('Foi um copo de requeijão, desses que a mãe dele lavava e guardava para virar copo, escorregando da beirada da pia porque ele estava com a mão molhada e pensando em outra coisa.'),
        ]);
      }
    },
    intercept(st, g, id) { if (id === 'pia') { st.go('s1_queda'); return true; } return false; },
  };

  S.s1_queda = {
    chapter: 1, safe: true, objective: '...',
    enter(st, g) {
      const cup = g.resetProp('copo');
      g.player.locked = true;
      g.player.x = TS * 51 + 2; g.player.y = floorApt - 26; g.player.vx = 0; g.player.facing = -1;
      g.player.powerAim = { x: cup.cx - 6, y: cup.cy + 4 };
      cup.noFriction = true; cup.noBreak = true; cup.vx = -30; cup.vy = 0;
      st.local = { phase: 'slide', t: 0 };
      g.audio.play('water', 0.6);
    },
    update(st, g, dt) {
      const L = st.local, cup = g.propById('copo');
      if (!cup) return;
      L.t += dt;
      if (L.phase === 'slide') {
        if (cup.onGround) cup.vx = -30; else cup.noFriction = false;
        g.player.powerAim = { x: cup.cx, y: cup.cy };
        const nearFloor = cup.y + cup.h >= floorApt - 3 && cup.vy > 0;
        if (nearFloor || L.t > 4) {
          cup.frozen = true; cup.vx = 0; cup.vy = 0;
          cup.y = floorApt - 3 - cup.h; cup.angle = 0.32;
          L.phase = 'frozen';
          g.clock.min = 7 * 60 + 19;
          g.renderer.freezeOn(cup);
          g.audio.play('freeze');
          g.player.powerAim = { x: cup.cx, y: cup.cy };
          g.player.walkTo = cup.x + 3; // ele se agacha perto do copo
          st.say([
            N('E o copo parou.'),
            N('Não desacelerou. Não caiu devagar como nos filmes. Parou, a quinze centímetros do chão, ligeiramente inclinado, com uma gota d\'água suspensa logo abaixo da borda.'),
            P('Eu não tomei café ainda.'),
            P('...talvez seja um AVC. Gente tendo AVC sente cheiro de torrada queimada.'),
            N('Ele parou pra farejar o ar da cozinha com uma seriedade absurda. Não tinha. Tinha cheiro de café que ele ainda não tinha feito.'),
            N('Aí ele fez a coisa mais humana possível. Se agachou, com muito cuidado, e cutucou o copo com o dedo.'),
          ], () => { g.player.locked = false; g.player.powerAim = null; L.phase = 'poke'; st.refresh(); });
        }
      }
    },
    objectiveFn(st) { return st.local && st.local.phase === 'poke' ? 'Cutuque o copo (E).' : 'O copo escorrega da mão molhada...'; },
    intercept(st, g, id) {
      if (id === 'copo' && st.local && st.local.phase === 'poke') {
        const cup = g.propById('copo');
        cup.frozen = false; cup.noBreak = false; cup.forceBreak = true; cup.vy = 40;
        g.renderer.freezeOff();
        st.local.phase = 'broken';
        return true;
      }
      return false;
    },
    on(st, g, ev, d) {
      if (ev === 'prop:break' && d.prop.id === 'copo' && st.local && st.local.phase === 'broken') {
        g.clock.min = 7 * 60 + 20;
        g.powers.setEmotion('curioso');
        st.say([
          N('O copo caiu e quebrou.'),
          N('E V riu. Riu alto, sozinho, na cozinha, às sete e vinte da manhã, porque era engraçado, era ridículo, ele tinha acabado de fazer o tempo parar e estragou tudo com o dedo indicador como um idiota.'),
        ], () => st.go('s1_vassoura'));
      }
    },
  };

  S.s1_vassoura = {
    chapter: 1, safe: true, objective: 'Pegue a vassoura (no hall, atrás da porta do banheiro).',
    enter(st, g, resumed) {
      const cup = g.propById('copo');
      if (resumed && cup && !cup.broken) { cup.break(g, 999); }
    },
    intercept(st, g, id) {
      if (id !== 'vassoura') return false;
      if (st.local && st.local.started) return true;
      st.local = { started: true };
      st.say([
        N('Foi só quando ele foi pegar a vassoura que a coisa se tornou séria.'),
        N('Ele olhou os cacos espalhados no piso, aqueles pedacinhos que vão parar debaixo da geladeira e reaparecem seis meses depois na sola do pé, e pensou, com muita clareza, sem esforço nenhum:'),
        P('Eu queria que isso não tivesse acontecido.'),
      ], () => {
        const cup = g.propById('copo');
        if (cup && cup.broken) G.POWERS.restaurar.apply(g.powers, g, cup, true);
        else st.afterRestore();
      });
      return true;
    },
    on(st, g, ev, d) { if (ev === 'prop:restored' && d.prop.id === 'copo') st.afterRestore(); },
  };

  S.s1_sobe = {
    chapter: 1,
    objective: 'Aponte para o copo e segure o botão esquerdo do mouse — "Sobe."',
    checklist(st, g) {
      return [
        { label: 'Erguer o copo acima da bancada (Levitar)', done: !!st.flags.sobe },
        { label: 'Pousar o copo de volta na pia — "Desce."', done: !!st.flags.desce },
      ];
    },
    enter(st, g) { g.powers.unlock('levitar'); st.local = { t: 0 }; },
    update(st, g, dt) {
      const cup = g.propById('copo');
      if (!cup || cup.broken || cup.restoring) return;
      if (!st.flags.sobe) {
        if (cup.held && cup.y + cup.h < counterTop - 14) { st.local.t += dt; if (st.local.t > 0.7) { st.flags.sobe = true; g.bubble('Sobe.', 1.5); st.refresh(); } }
      } else if (!st.flags.desce && !cup.held && cup.onGround && Math.abs(cup.y + cup.h - counterTop) < 1 && cup.x >= TS * 50 && cup.x + cup.w <= TS * 53) {
        st.flags.desce = true;
        g.bubble('Desce.', 1.5);
        st.discover('sobe', 'Sobe / Desce: erguer o copo só apontando. Ele pousou sem fazer barulho.');
        st.say([N('Desceu. Pousou na pia sem fazer barulho.'), V('— Ok. Ok. Ok.')], () => st.go('s1_geladeira'));
      }
    },
    on(st, g, ev, d) { if (ev === 'prop:break' && d.prop.id === 'copo') g.bubble('De novo, não... (Restaurar: tecla 2)', 2.5, true); },
  };

  S.s1_geladeira = {
    chapter: 1, objective: 'Faça uma coisa normal: abra a geladeira (E).',
    intercept(st, g, id) {
      if (id !== 'geladeira') return false;
      st.say([
        N('Foi até a geladeira. Abriu. Fechou. Não porque queria alguma coisa, mas porque abrir e fechar a geladeira era a coisa mais normal que existia.'),
        N('Dentro da geladeira tinha metade de uma cebola, três iogurtes vencidos e uma marmita que a mãe dele tinha mandado no domingo.'),
        V('— Cadê o manual. Sério. Cadê o manual.'),
      ], () => st.go('s1_chefe'));
      return true;
    },
  };

  S.s1_chefe = {
    chapter: 1, objective: 'Avise o trabalho: celular na mesa da sala (E).',
    intercept(st, g, id) {
      if (id !== 'celular') return false;
      g.clock.min = Math.max(g.clock.min, 8 * 60 + 30);
      st.say([
        N('Ele passou o resto do dia sem trabalhar. Mandou uma mensagem pro chefe às oito e meia dizendo que tinha acordado passando mal, o que era tecnicamente verdadeiro.'),
        N('V nunca foi o tipo de pessoa que recua. Ele é do tipo que enfia o dedo na tomada pra ver como é. A curiosidade nele chega antes do bom senso e sempre chegou.'),
        N('Então ele testou.'),
      ], () => {
        g.powers.unlock('transformar', { select: false });
        g.powers.unlock('deslocar', { select: false });
        g.powers.unlock('criar', { select: false });
        st.go('s1_caderno');
      });
      return true;
    },
  };

  S.s1_caderno = {
    chapter: 1, objective: 'Pegue o caderno na mesa — anotar era outra coisa normal (E).',
    intercept(st, g, id) {
      if (id !== 'caderno') return false;
      st.flags.caderno = true;
      st.say([N('Começou a anotar tudo num caderno, porque anotar era outra coisa normal.'), N('Coisas que eu consigo fazer (dia 1), ele escreveu, e a letra estava tremida.')], () => {
        g.ui.openCaderno('descobertas');
        st.go('s1_testes');
      });
      return true;
    },
  };

  S.s1_testes = {
    chapter: 1, objective: 'Teste o que você consegue fazer (dia 1). Teclas 1–5 trocam o poder.',
    checklist(st) {
      const f = st.flags;
      return [
        { label: 'Entortar a colher (Transformar)', done: !!f.t_entortar },
        { label: 'Desentortar a colher', done: !!f.t_desentortar },
        { label: 'Controle remoto atravessar a sala sem percorrer o caminho (Deslocar, 6+ blocos)', done: !!f.t_controle },
        { label: 'Mudar a cor do abajur aceso (E acende; depois Transformar)', done: !!f.t_abajur },
        { label: 'Mudar a cor do abajur sem ele estar ligado', done: !!f.t_abajur_off },
        { label: 'Fazer uma laranja aparecer (Criar)', done: !!f.t_laranja },
        { label: 'Comer a laranja (E pega; coma pelos Bolsos — tecla I)', done: !!f.t_comer },
      ];
    },
    on(st, g, ev, d) {
      const f = st.flags;
      if (ev === 'transform' && d.type === 'colher') {
        if (d.kind === 'entortar' && !f.t_entortar) { f.t_entortar = true; st.discover('colher', 'Fez a colher entortar...'); }
        if (d.kind === 'desentortar' && f.t_entortar && !f.t_desentortar) { f.t_desentortar = true; st.discover('colher2', '...e desentortar.'); }
      }
      if (ev === 'deslocar' && d.prop.type === 'controle' && d.dist >= TS * 6 && !f.t_controle) {
        f.t_controle = true;
        st.discover('controle', 'O controle remoto atravessou a sala sem sair do lugar.');
        st.say([N('Fez o controle remoto atravessar a sala sem sair do lugar — apareceu do outro lado sem percorrer o caminho, o que ele achou muito mais assustador do que se tivesse voado.')]);
      }
      if (ev === 'transform' && d.type === 'abajur') {
        if (d.kind === 'cor_ligado' && !f.t_abajur) { f.t_abajur = true; st.discover('abajur', 'Fez a luz do abajur mudar de cor.'); }
        if (d.kind === 'cor_desligado' && !f.t_abajur_off) { f.t_abajur_off = true; st.discover('abajur2', 'Fez a luz do abajur mudar de cor sem o abajur estar ligado.'); }
      }
      if (ev === 'create' && !f.t_laranja) {
        f.t_laranja = true;
        st.discover('laranja', 'Fez uma laranja aparecer na mesa.');
        st.say([N('Fez uma laranja aparecer e depois passou quinze minutos olhando a laranja com uma desconfiança profunda, porque de onde é que ela tinha vindo, exatamente, e se ele comesse aquilo, o que é que ele estaria comendo.')]);
      }
      if (ev === 'eat' && d.item === 'laranja_perfeita' && f.t_laranja && !f.t_comer) {
        f.t_comer = true;
        st.discover('comeu', 'Comeu a laranja. Era laranja demais.');
        st.say([N('Comeu a laranja. Era boa. Era laranja demais, se é que isso faz sentido — como se alguém tivesse pego a ideia de laranja e feito uma fruta a partir dela, sem o gomo ressecado, sem a semente inesperada. Perfeita de um jeito levemente errado.')]);
      }
      st.refresh();
      if (f.t_entortar && f.t_desentortar && f.t_controle && f.t_abajur && f.t_abajur_off && f.t_laranja && f.t_comer && !f.t_fim) {
        f.t_fim = true;
        st.say([N('E foi ali, olhando aquela lista curta e ridícula — copo, colher, laranja, luz —, que ele teve o primeiro pensamento que valeria o peso de tudo que veio depois.')], () => st.go('s1_janela'));
      }
    },
  };

  S.s1_janela = {
    chapter: 1, objective: 'Vá até a porta de vidro da sacada e olhe a rua (E).',
    enter(st, g, resumed) { if (!resumed) g.skipTo(18 * 60 + 10, 'Onze horas de testes depois'); g.flags.luz_sala = true; g.powers.setEmotion('calmo'); },
    intercept(st, g, id) {
      if (id !== 'porta_sacada') return false;
      st.say([
        P('E se não for só copo?'),
        N('Não foi um pensamento ambicioso. Foi quase um sussurro, a mesma voz baixinha com que a gente pergunta pra si mesmo se apagou o fogão. Mas ficou.'),
        N('Porque se a realidade era negociável naquela cozinha, ela era negociável em todo lugar.'),
        N('Lá embaixo a rua estava fazendo exatamente o que ruas fazem: um cachorro puxando uma pessoa, uma moto de entrega subindo na calçada, uma senhora conferindo se trouxe a chave, um casal discutindo em volume moderado.'),
        N('Oito bilhões de pessoas fazendo suas terças-feiras.'),
        N('Teve só um homem de vinte e seis anos com a testa encostada no vidro, pensando que a partir daquela manhã ele nunca mais ia poder dizer não tinha nada que eu pudesse fazer.'),
      ], () => st.go('s1_dormir'));
      return true;
    },
  };

  S.s1_dormir = { chapter: 1, objective: 'Durma (cama no quarto, E).', allowSleep: true, onSleep(st) { st.go('s2_percepcao'); } };

  // ---------- Capítulo 2 — Testes Domésticos ----------
  S.s2_percepcao = {
    chapter: 2, objective: 'Dia 2, manhã: olhe através da parede da sala (Percepção — tecla 6, segure o botão esquerdo).',
    enter(st, g, resumed) {
      g.regions.paredeVizinho.perceivable = true;
      g.regions.paredeVizinho.refuse = 'Não. NUNCA MAIS.';
      st.local = { acc: 0 };
      if (!resumed) {
        st.say([
          N('No terceiro dia ele quase se apagou.'),
          N('Vale a pena contar como chegou até ali, porque a sequência é importante. Os dois primeiros dias foram bons. Foram, na verdade, os melhores dois dias que V teve em anos.'),
          N('Ele avisou no trabalho que ia tirar a semana. Desligou o interfone. E se trancou nos quarenta e dois metros quadrados com um caderno, três canetas e a coisa mais perigosa do universo, que é uma pessoa curiosa sem supervisão.'),
        ], () => g.powers.unlock('perceber'));
      } else g.powers.unlock('perceber', { silent: true });
    },
    on(st, g, ev, d) {
      if (ev === 'perceive:region' && d.id === 'paredeVizinho' && st.local) {
        st.local.acc += d.dt;
        if (st.local.acc > 0.7 && !st.local.done) {
          st.local.done = true;
          g.powers.blockedRegions.add('paredeVizinho');
          G.POWERS.perceber.cancel(g.powers);
          g.powers.setEmotion('assustado');
          g.shake(2);
          st.discover('parede', 'Fez a parede da sala ficar transparente. NÃO FAZER ISSO NUNCA MAIS.', { underline: true });
          st.say([
            N('Fez a parede da sala ficar transparente e viu, do outro lado, o quarto do vizinho, e o vizinho de cueca, e desfez tudo em pânico com uma velocidade que ele não sabia que tinha.'),
            N('Anotou: NÃO FAZER ISSO NUNCA MAIS. Sublinhou duas vezes.'),
          ], () => st.go('s2_sabor'));
        }
      }
    },
  };

  S.s2_sabor = {
    chapter: 2, objective: 'Dia 2, tarde: mude o gosto da água no copo (Transformar) e beba (E).',
    checklist(st) { return [{ label: 'Água com gosto de coca-cola', done: !!st.flags.s_sabor }, { label: 'Beber', done: !!st.flags.s_bebeu }]; },
    enter(st, g, resumed) { if (!resumed) g.skipTo(14 * 60, 'Dia 2, tarde'); g.powers.setEmotion('curioso'); },
    on(st, g, ev, d) { if (ev === 'transform' && d.type === 'copo' && d.kind === 'sabor') { st.flags.s_sabor = true; st.refresh(); } },
    intercept(st, g, id) {
      if (id !== 'copo') return false;
      const cup = g.propById('copo');
      if (!cup || cup.state.sabor !== 'coca') return false;
      cup.state.sabor = null; st.flags.s_bebeu = true;
      st.discover('sabor', 'Mudar o gosto das coisas sem mudar a substância.');
      st.say([
        N('Descobriu que conseguia mudar o gosto das coisas sem mudar a substância. Tomou água com sabor de coca-cola durante quarenta minutos, achando isso a coisa mais engraçada do mundo,'),
        N('até perceber que estava se divertindo com um poder que provavelmente conseguia curar doenças, e o riso morreu no meio.'),
      ], () => st.go('s2_voo'));
      return true;
    },
  };

  S.s2_voo = {
    chapter: 2,
    objectiveFn(st) { return st.flags.bonk ? 'Pegue gelo no congelador (geladeira) e deite no sofá (E).' : 'Dia 2, noite: tente voar — pule e, no ar, continue segurando Pular.'; },
    enter(st, g, resumed) {
      if (!resumed) g.skipTo(21 * 60, 'Dia 2, noite');
      g.flags.luz_sala = true;
      if (!st.flags.bonk) g.player.flyEnabled = true;
    },
    on(st, g, ev, d) {
      if (ev === 'player:ceiling' && d.flying && !st.flags.bonk) {
        st.flags.bonk = true;
        g.player.flyEnabled = false; g.player.stun = 1.4; g.player.vy = 120;
        g.audio.play('bonk'); g.shake(4); g.renderer.stars(g.player);
        st.say([N('Tentou voar. Conseguiu. Bateu a cabeça no teto com força suficiente pra ver estrelas.')]);
        st.refresh();
      }
    },
    update(st, g) {
      if (!st.flags.bonk && g.player.flyEnabled && g.player.flyFuel <= 0 && !g.player.onGround && !st.local) {
        st.local = { hinted: true };
        const a = g.world.areaAt(g.player.cx, g.player.cy);
        if (a && !a.indoor) g.bubble('Aqui fora não tem teto pra... espera, isso é bom ou ruim?', 3, true);
      }
    },
    intercept(st, g, id) {
      if (!st.flags.bonk) return false;
      if (id === 'geladeira' && !g.inventory.has('bolsa_gelo')) {
        g.inventory.add('bolsa_gelo'); g.audio.play('pickup');
        g.ui.toast('Bolsa de gelo foi para os bolsos.', 'item');
        return true;
      }
      if (id === 'sofa' && g.inventory.has('bolsa_gelo')) {
        const sofa = g.decorByType('sofa');
        g.player.setPose('lie', sofa.x + 6, floorApt - 8 - 26, 1);
        st.say([
          N('Passou dez minutos deitado no sofá com uma bolsa de gelo dizendo em voz alta, pro apartamento vazio, que aquilo era humilhante.'),
          V('— Isso é humilhante.'),
          N('Foi nesse dia que ele começou a falar sozinho de verdade. Do jeito de quem precisa de companhia e não tem.'),
          V('— Se eu contar pra alguém, eu não desconto. Não tem como. Não tem como contar isso pra alguém e a pessoa continuar te olhando igual.'),
          N('O teto não respondeu, o que ele achou justo.'),
        ], () => {
          st.discover('voo', 'Voar. (Bati a cabeça no teto. Humilhante.)');
          g.powers.vooInstavel = true;
          g.player.clearPose(); G.Physics.unstick(g.player, g.world);
          st.go('s2_dormir');
        });
        return true;
      }
      return false;
    },
  };

  S.s2_dormir = { chapter: 2, objective: 'Durma (cama no quarto, E).', allowSleep: true, onSleep(st) { st.go('s3_irritado'); } };

  S.s3_irritado = {
    chapter: 2, objective: 'Ao meio-dia: sente no sofá para fazer um teste sério (E).',
    enter(st, g, resumed) {
      g.powers.setEmotion('irritado');
      if (!resumed) {
        st.say([
          N('Dia 3. Ele acordou irritado. Não tinha motivo.'),
          N('Tinha dormido mal, tinha sonhado com o trabalho, tinha aquela sensação chata de estar desperdiçando alguma coisa enorme com brincadeira de criança.'),
        ]);
      }
    },
    intercept(st, g, id) {
      if (id !== 'sofa') return false;
      const go = () => {
        const sofa = g.decorByType('sofa');
        g.player.setPose('sit', sofa.x + 6, floorApt - 8 - 26, 1);
        st.say([
          N('Ao meio-dia ele decidiu fazer um teste sério.'),
          N('Se ele conseguia desfazer o copo quebrado, ele conseguia desfazer eventos. Não coisas — eventos. Então a pergunta natural era: até onde?'),
          N('Ele escolheu uma coisa pequena. Uma cicatriz no joelho esquerdo, de quando tinha nove anos e caiu da bicicleta do primo na rua de trás da casa da avó.'),
          { who: 'pensamento', text: 'Sentou no sofá. Olhou pro joelho.', choices: [
            { text: 'Pensar: "isso nunca aconteceu."', fn: () => st.go('s3_linha') },
            { text: 'Ainda não.', orig: true, fn: () => { g.player.clearPose(); G.Physics.unstick(g.player, g.world); g.bubble('Daqui a pouco.', 1.5, true); } },
          ] },
        ]);
      };
      if (g.clock.min % 1440 < 12 * 60) g.skipTo(12 * 60, 'Meio-dia', go); else go();
      return true;
    },
  };

  S.s3_linha = {
    chapter: 2, safe: true, objective: 'Segure tudo: arraste cada memória de volta até V. (Shift segura com mais força.)',
    enter(st, g) {
      const sofa = g.decorByType('sofa');
      g.player.setPose('sit', sofa.x + 6, floorApt - 8 - 26, 1);
      g.player.locked = true;
      g.powers.setEmotion('panico');
      st.say([N('Sentou no sofá. Olhou pro joelho. E pensou: isso nunca aconteceu.'), N('O que aconteceu em seguida durou, na melhor estimativa que ele conseguiu fazer depois, cerca de um segundo e meio.')], () => {
        g.ui.toast('Arraste as memórias de volta até V antes que escorreguem. Shift = segurar com força.', 'power');
        g.sequence = new LinhaSequence(g, () => st.go('s3_chao'));
      });
    },
    exit(st, g) { g.sequence = null; g.renderer.desat = 0; },
  };

  S.s3_chao = {
    chapter: 2, safe: true, objective: '...',
    enter(st, g) {
      g.sequence = null; g.renderer.desat = 0;
      g.player.setPose('collapse', TS * 55, floorApt - 26, 1);
      g.player.locked = true;
      g.powers.setEmotion('exausto');
      st.say([
        N('A cicatriz sumiu. Mas junto com ela sumiu a tarde. Sumiu a bicicleta do primo. Sumiu o primo, por um instante. Sumiu a casa da avó. Sumiu a avó. Sumiu o cheiro de café coado com pano.'),
        N('Ele estava puxando um fio e o mundo inteiro estava vindo junto. Porque nada acontece sozinho.'),
        N('E ele segurou. Segurou a avó, segurou o café, segurou o primo, segurou a tarde inteira de 2009 com as duas mãos e empurrou tudo de volta pro lugar antes que a linha arrebentasse.'),
        N('Quando ele finalmente conseguiu se sentar, a cicatriz estava de volta no joelho. Ele passou o polegar nela, devagar, umas vinte vezes.'),
        V('— Eu quase apaguei a minha vó. Por causa de uma cicatriz.'),
      ], () => {
        st.discover('linha', 'Desfazer eventos: tudo está amarrado em tudo. (Quase apaguei a minha vó.)');
        g.player.locked = false;
        g.flags.luz_sala = true;
        g.skipTo(22 * 60, 'Aquela noite', () => { g.player.clearPose(); g.player.x = TS * 45; g.player.y = floorApt - 26; st.go('s3_noite'); });
      });
    },
  };

  S.s3_noite = {
    chapter: 2, objective: 'Sente na cama (E).',
    intercept(st, g, id) {
      if (id !== 'cama') return false;
      const cama = g.decorByType('cama');
      g.player.setPose('sit', cama.x + 14, floorApt - 10 - 26, 1);
      const reacoes = {
        parar: [P('Seria a opção mais segura que já esteve disponível pra qualquer ser humano na história.', true)],
        regras: [P('Se for continuar, que seja com regras. Com limites. Com um caderno de verdade.', true)],
        agir: [P('E se alguém precisar? E se eu podia, e não fiz?', true)],
      };
      const choose = (k) => {
        st.flags.postura = k;
        if (k === 'parar') g.powers.setEmotion('calmo');
        if (k === 'regras') g.powers.setEmotion('curioso');
        if (k === 'agir') { g.powers.setEmotion('assustado'); g.powers.addCompreensao(1, 'a necessidade abre portas'); }
        st.registro('postura', 'O que fazer com isso (noite do dia 3)', {
          parar: 'Pensou em trancar tudo num armário mental até morrer. Ficou quarenta minutos com essa opção na mão.',
          regras: 'Pensou em continuar com regras e limites. Precisava, sobretudo, de alguém pra conversar.',
          agir: 'Pensou em quem ia precisar dele. A pergunta não aceitou ser adiada.',
        }[k], true);
        st.say(reacoes[k].concat([
          N('O problema é que ele já sabia demais.'),
          N('Se você passa três dias descobrindo que consegue desfazer eventos, você não consegue mais olhar pro noticiário do mesmo jeito. Cada coisa horrível que passa na tela deixa de ser tragédia e vira pergunta.'),
          P('E se fosse eu?'),
          N('Não eu poderia. Não eu deveria. Só: se eu não fizer nada, e alguém morrer, e eu podia ter feito — o que é que eu sou?'),
          V('— Eu prefiro carregar a culpa de ter feito.'),
          N('Achou que era só uma coisa que a gente fala pra conseguir dormir. E dormiu.'),
        ]), () => g.sleep(4, 7 * 60 + 17, () => st.go('s4_manha')));
      };
      st.say([
        N('Aquela noite foi a primeira vez que ele pensou em parar. Sério mesmo. Ele considerou.'),
        { who: 'pensamento', text: 'O que fazer com tudo isso?', choices: [
          { text: 'Nunca mais usar. Trancar tudo num armário mental.', orig: true, fn: () => choose('parar') },
          { text: 'Continuar — mas com regras. Com limites.', orig: true, fn: () => choose('regras') },
          { text: 'E se alguém morrer, e eu podia ter feito?', orig: true, fn: () => choose('agir') },
        ] },
      ]);
      return true;
    },
  };

  S.s4_manha = {
    chapter: 2,
    objectiveFn(st, g) { const c = g.propById('copo'); return c && c.broken ? 'O copo está quebrado. Restaure-o (tecla 2) e depois olhe para ele (E).' : 'Olhe o copo de requeijão na pia (E).'; },
    enter(st, g) {
      g.clock.day = 4; g.clock.min = Math.max(g.clock.min % 1440, 7 * 60 + 19);
      g.player.clearPose();
      g.player.x = TS * 52 - 2; g.player.y = floorApt - 26;
      g.powers.setEmotion(st.flags.postura === 'parar' ? 'calmo' : 'curioso');
    },
    intercept(st, g, id) {
      if (id !== 'copo') return false;
      const c = g.propById('copo');
      if (!c || c.broken) return false;
      st.say([
        N('No dia seguinte ele acordou às sete e dezenove — o corpo tinha aprendido o horário —, foi até a cozinha, olhou o copo de requeijão na pia, e decidiu que já que ia continuar com aquilo, ia continuar direito.'),
        N('Precisava de regras. Precisava de limites. Precisava, mais do que qualquer coisa, de alguém pra conversar.'),
        N('E foi assim, por pura solidão, que ele criou a Van.'),
      ], () => { st.go('s_livre'); g.ui.showEndcard(); g.save('auto'); });
      return true;
    },
  };

  S.s_livre = {
    chapter: 2, allowSleep: true,
    objective: 'Fim da Etapa 1. Explore, complete missões secundárias e procure segredos. A próxima etapa começa com a Van.',
  };

  G.STORY_STEPS = S;
  G.CHAPTERS = {
    1: { title: 'Capítulo 1 — O Copo', sub: 'Uma terça-feira qualquer, um copo caindo da pia — e a primeira vez que o mundo pisca.' },
    2: { title: 'Capítulo 2 — Testes Domésticos', sub: 'Três dias trancado em casa descobrindo o que consegue fazer. E o que quase não consegue desfazer.' },
  };

  /* ------------------------------------------------------------------
   * Missões secundárias — CONTEÚDO ORIGINAL DO JOGO
   * ------------------------------------------------------------------ */
  G.SIDE_QUESTS = {
    tercas: {
      title: 'Gente fazendo suas terças-feiras', orig: true,
      desc: 'As cenas que V viu da janela estão lá embaixo, na rua. Observe cada uma (E perto delas, de dia).',
      steps: [['passeador', 'O cachorro e a pessoa'], ['moto', 'A moto de entrega'], ['senhora', 'A senhora e a chave'], ['casal', 'O casal discutindo']],
    },
    consertos: {
      title: 'Pequenos consertos', orig: true,
      desc: 'Um banco e um poste quebrados na praça. Ninguém parece ter pressa de consertar. V tem.',
      steps: [['banco', 'Restaurar o banco'], ['poste', 'Restaurar o poste']],
    },
    terraco: {
      title: 'A chave do terraço', orig: true,
      desc: 'Atrás das caixas de correio da portaria há um painel que não está bem preso.',
      steps: [['painel', 'Tirar o painel do lugar'], ['chave', 'Pegar a chave'], ['alcapao', 'Abrir o alçapão do telhado'], ['registro', 'Ler o que ficou no telhado']],
    },
  };

  /* ------------------------------------------------------------------
   * Motor
   * ------------------------------------------------------------------ */
  class Story {
    constructor(game) {
      this.g = game;
      this.dialog = new Dialogue(game);
      this.stepId = null; this.step = null; this.local = null;
      this.flags = {};
      this.discoveries = [];   // {id, day, text, underline}
      this.registros = [];     // {id, title, text, orig}
      this.side = {};          // id -> {state, done:{}}
      this.seen = {};
      this.dirty = true;
      this.unsub = game.bus.on('*', (ev, d) => this.onEvent(ev, d));
    }
    get safe() { return !!(this.step && this.step.safe); }
    say(entries, onDone) { this.dialog.say(entries, onDone); }
    refresh() { this.dirty = true; }

    start(id) { this.go(id, false); }
    go(id, resumed) {
      const next = G.STORY_STEPS[id];
      if (!next) { console.error('[V] passo inexistente', id); return; }
      if (this.step && this.step.exit) this.step.exit(this, this.g);
      const prevChapter = this.step ? this.step.chapter : null;
      this.stepId = id; this.step = next; this.local = null;
      this.dirty = true;
      if (!resumed && next.chapter && next.chapter !== prevChapter && G.CHAPTERS[next.chapter]) this.g.ui.chapterCard(G.CHAPTERS[next.chapter]);
      if (next.enter) next.enter(this, this.g, !!resumed);
      if (!resumed && !next.safe && this.g.state === 'playing') this.g.save('auto', true);
    }
    /** Interação do jogador: a história tem prioridade. */
    intercept(id) {
      if (this.dialog.active) return true;
      return !!(this.step && this.step.intercept && this.step.intercept(this, this.g, id));
    }
    update(dt) {
      this.dialog.update(dt);
      if (this.step && this.step.update && !this.dialog.active) this.step.update(this, this.g, dt);
    }
    onEvent(ev, d) {
      if (this.step && this.step.on) this.step.on(this, this.g, ev, d || {});
      this.sideEvent(ev, d || {});
    }
    objective() {
      if (!this.step) return { text: '', checklist: [] };
      const s = this.step;
      const text = s.objectiveFn ? s.objectiveFn(this, this.g) : s.objective;
      return { text, checklist: s.checklist ? s.checklist(this, this.g) : [], chapter: s.chapter };
    }
    afterRestore() {
      if (this.stepId !== 's1_vassoura' || this.flags.restaurouCopo) return;
      this.flags.restaurouCopo = true;
      const g = this.g;
      g.powers.unlock('restaurar', { select: false });
      st_discover(this, 'restaurar', 'Desfazer: o copo voltou inteiro pra pia. O chão estava seco.');
      g.player.setPose('sitFloor', TS * 50 + 2, TS * 30 - 26, -1);
      this.say([
        N('E não tinha acontecido.'),
        N('O copo estava na pia. Inteiro. Com a marca da etiqueta velha ainda meio descascada de um lado. O chão estava seco.'),
        N('Dessa vez ele não riu.'),
        N('Ele sentou no chão da cozinha, encostou a nuca no armário de baixo, e ficou ali por muito tempo.'),
        N('É a sensação de estar sentado numa cadeira que você usou a vida inteira e descobrir, de repente, que ela nunca teve pernas. Que ela estava flutuando esse tempo todo. E que ninguém te avisou.'),
        N('V levantou. Olhou para o copo. Estendeu a mão de novo — não para pegar, só apontada, meio boba, do jeito que criança aponta pra coisa que quer.'),
      ], () => { g.player.clearPose(); G.Physics.unstick(g.player, g.world); this.go('s1_sobe'); });
    }
    discover(id, text, opts) { st_discover(this, id, text, opts); }
    registro(id, title, text, orig) {
      if (this.registros.find((r) => r.id === id)) return;
      this.registros.push({ id, title, text, orig: !!orig });
      this.g.ui.toast('Novo registro no caderno: ' + title, 'item');
      this.dirty = true;
    }

    /* ----- missões secundárias ----- */
    activateSide(id) {
      if (this.side[id]) return;
      this.side[id] = { state: 'active', done: {} };
      this.g.ui.toast('Missão secundária: ' + G.SIDE_QUESTS[id].title + ' ◆ original', 'quest');
      this.dirty = true;
    }
    progressSide(id, key) {
      const q = this.side[id];
      if (!q || q.state === 'done' || q.done[key]) return;
      q.done[key] = true; this.dirty = true;
      const def = G.SIDE_QUESTS[id];
      if (def.steps.every(([k]) => q.done[k])) {
        q.state = 'done';
        this.g.audio.play('success');
        this.g.ui.toast('Missão concluída: ' + def.title, 'good');
        this.completeSide(id);
      }
    }
    completeSide(id) {
      const g = this.g;
      if (id === 'consertos') {
        g.powers.addCompreensao(1, 'pequenos consertos');
        this.registro('consertos', 'Pequenos consertos', 'O banco e o poste da praça voltaram a ser banco e poste. Ninguém viu. Ninguém nunca vai saber quem foi — e isso, estranhamente, foi bom.', true);
      }
      if (id === 'tercas') {
        g.powers.addCompreensao(1, 'olhar as pessoas');
        this.registro('tercas', 'Gente fazendo suas terças-feiras', 'Um cachorro puxando uma pessoa, uma moto de entrega subindo na calçada, uma senhora conferindo se trouxe a chave, um casal discutindo em volume moderado. Oito bilhões de pessoas fazendo suas terças-feiras. (cena do cap. 1; observações de V são conteúdo original)', true);
      }
      if (id === 'terraco') g.powers.addCompreensao(1, 'segredo do telhado');
    }
    sideEvent(ev, d) {
      const g = this.g;
      if (ev === 'area') {
        if (!d.indoor && d.id !== 'sacada') {
          this.activateSide('tercas');
          if (!this.flags.saiuCedo && this.stepId && this.stepId.match(/^s1|^s2|^s3/)) {
            this.flags.saiuCedo = true;
            g.bubble('Eu devia estar lá dentro, testando. Mas um pouco de ar não mata ninguém.', 3.5, true);
          }
        }
        if (d.id === 'praca') this.activateSide('consertos');
      }
      if (ev === 'observe') { this.activateSide('tercas'); this.progressSide('tercas', d.id); }
      if (ev === 'prop:restored') {
        if (d.prop.id === 'banco') { this.activateSide('consertos'); this.progressSide('consertos', 'banco'); }
        if (d.prop.id === 'poste') { this.activateSide('consertos'); this.progressSide('consertos', 'poste'); }
      }
      if (ev === 'perceive:reveal' && d.prop.id === 'painel') {
        this.activateSide('terraco');
        g.bubble('Esse painel está solto... tem alguma coisa atrás.', 2.5, true);
      }
      if ((ev === 'levitate:end' || ev === 'deslocar') && d.prop.id === 'painel') {
        const p = d.prop;
        if (Math.abs(p.x - p.spawn.x) + Math.abs(p.y - p.spawn.y) > 10) { this.activateSide('terraco'); this.progressSide('terraco', 'painel'); }
      }
      if (ev === 'pickup') {
        if (d.item === 'chave_terraco') { this.activateSide('terraco'); this.progressSide('terraco', 'chave'); }
        if (d.item === 'registro_telhado') {
          this.progressSide('terraco', 'registro');
          this.registro('telhado', 'Terça-feira vista de cima', 'Daqui de cima a rua inteira cabe num olhar: o terreno baldio, a praça, a padaria. Lá embaixo, a cidade continua fazendo o que cidades fazem, sem saber que um homem a doze metros consegue fazer quase qualquer coisa. Ele ainda não sabe o que fazer com isso.', true);
        }
      }
      if (ev === 'door' && d.id === 'alcapao' && d.open) this.progressSide('terraco', 'alcapao');
    }

    serialize() {
      return { stepId: this.stepId, flags: this.flags, discoveries: this.discoveries, registros: this.registros, side: this.side, seen: this.seen };
    }
    applySave(d) {
      this.flags = d.flags || {};
      this.discoveries = d.discoveries || [];
      this.registros = d.registros || [];
      this.side = d.side || {};
      this.seen = d.seen || {};
      const id = G.STORY_STEPS[d.stepId] ? d.stepId : 's1_acordar';
      this.step = null;
      this.go(id, true);
    }
  }
  function st_discover(st, id, text, opts) {
    if (st.discoveries.find((x) => x.id === id)) return;
    st.discoveries.push({ id, day: st.g.clock.day, text, underline: !!(opts && opts.underline) });
    st.g.powers.compreensao += 1;
    st.g.ui.toast('Caderno — dia ' + st.g.clock.day + ': ' + text, 'discovery');
    st.dirty = true;
  }
  G.Story = Story;
})(window.VG = window.VG || {});

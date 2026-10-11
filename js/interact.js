/* =====================================================================
 * Objetos interativos fixos (E): eletrodomésticos, portas, móveis,
 * placas. A história sempre tem prioridade (story.intercept); quando
 * ela não trata a interação, roda a ação padrão daqui.
 * Textos marcados com orig são conteúdo original do jogo.
 * ===================================================================== */
(function (G) {
  'use strict';
  const TS = G.TILE;

  const DOOR_IDS = {
    '38,28': 'porta_apto', '42,28': 'porta_quarto', '60,28': 'porta_sacada',
    '60,36': 'porta_predio', '102,36': 'porta_padaria',
  };
  const DOOR_NAMES = {
    porta_apto: 'porta do apartamento', porta_quarto: 'porta do quarto', porta_sacada: 'porta da sacada',
    porta_predio: 'porta do prédio', porta_padaria: 'porta da padaria', alcapao: 'alçapão',
  };

  G.HATCH_CELLS = [[31, 22], [32, 22], [33, 22]];

  G.padariaAberta = (g) => { const m = g.clock.min % 1440; return m >= 6 * 60 && m < 21 * 60; };

  function text(g, msg, orig) { g.bubble(msg, Math.min(5, 1.6 + msg.length / 28), orig); }

  G.buildInteractables = function (g, spec) {
    const list = [];
    const add = (o) => { list.push(Object.assign({ enabled: true }, o)); };
    const decor = (type, n) => spec.decor.filter((d) => d.type === type)[n || 0];
    const rectOf = (d, pad) => ({ x: d.x - (pad || 0), y: d.y - (pad || 0), w: d.w + (pad || 0) * 2, h: d.h + (pad || 0) * 2 });

    // ---------- portas (blocos) ----------
    const w = g.world;
    for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
      const id = DOOR_IDS[x + ',' + y];
      if (!id) continue;
      add({
        id, x: x * TS - 8, y: y * TS, w: TS + 16, h: TS * 2, door: { x, y, h: 2 },
        label: (g2) => (G.TILES[g2.world.get(x, y)].solid ? 'Abrir a ' : 'Fechar a ') + DOOR_NAMES[id],
        action: (g2) => toggleDoor(g2, id, [[x, y], [x, y + 1]]),
      });
    }
    add({
      id: 'alcapao', x: TS * 31, y: TS * 22 - 10, w: TS * 3, h: 52,
      label: (g2) => (G.TILES[g2.world.get(32, 22)].solid ? 'Abrir o alçapão' : 'Fechar o alçapão'),
      action: (g2) => toggleDoor(g2, 'alcapao', G.HATCH_CELLS),
    });

    // ---------- cozinha ----------
    add({ id: 'pia', ...spec.regions.pia, label: (g2) => (g2.story.stepId === 's1_acordar' ? 'Lavar o copo' : 'Abrir a torneira'),
      action: (g2) => { g2.audio.play('water'); for (let i = 0; i < 12; i++) g2.particles.add({ x: TS * 51 + 4, y: TS * 29 - 6, vx: Math.random() * 6 - 3, vy: 20 + Math.random() * 30, g: 300, life: 0.4, color: '#a9d8ff' }); } });
    add({ id: 'geladeira', ...rectOf(decor('geladeira')), label: 'Abrir a geladeira',
      action: (g2) => text(g2, g2.story.flags.marmitaComida ? 'A marmita da mãe continua lá. Ele fecha de novo.' : 'Meia cebola, três iogurtes vencidos e a marmita da mãe. Ele fecha.', !!g2.story.flags.marmitaComida) });
    add({ id: 'interruptor', ...rectOf(decor('interruptor'), 4), label: 'Interruptor da sala',
      action: (g2) => { g2.flags.luz_sala = !g2.flags.luz_sala; g2.audio.play('switch'); } });

    // ---------- sala ----------
    const abajur = decor('abajur');
    add({
      id: 'abajur', ...rectOf(abajur, 3), label: (g2) => (g2.flags.abajurOn ? 'Apagar o abajur' : 'Acender o abajur'),
      action: (g2) => { g2.flags.abajurOn = !g2.flags.abajurOn; g2.audio.play('switch'); },
      transform: (g2) => {
        const cores = ['255,226,170', '255,120,140', '120,200,255', '140,255,170', '210,150,255', '255,190,90'];
        const i = cores.indexOf(g2.flags.abajurCor || cores[0]);
        g2.flags.abajurCor = cores[(i + 1) % cores.length];
        if (g2.flags.abajurOn) return { kind: 'cor_ligado', msg: 'A luz do abajur muda de cor.' };
        g2.flags.abajurGlow = true;
        return { kind: 'cor_desligado', msg: 'O abajur está desligado. E mesmo assim a luz muda de cor.' };
      },
    });
    add({ id: 'celular', ...rectOf(decor('celular'), 5), label: 'Celular', action: (g2) => text(g2, 'Nenhuma mensagem nova. Ele colocou o celular no silencioso.', true) });
    add({ id: 'caderno', ...rectOf(decor('caderno'), 5), label: 'Caderno', action: (g2) => g2.ui.openCaderno() });
    add({ id: 'notebook', ...rectOf(decor('notebook'), 2), label: 'Notebook do trabalho', action: (g2) => text(g2, 'O sistema da empresa. A sala que era também escritório. Hoje não.', true) });
    add({ id: 'estante', ...rectOf(decor('estante')), label: 'Estante', action: (g2) => text(g2, 'Uma estante com mais videogame do que livro, o que ele achava vergonhoso e ninguém mais achava.') });
    add({
      id: 'sofa', ...rectOf(decor('sofa')), label: 'Sentar no sofá',
      action: (g2) => {
        const s = decor('sofa');
        const right = g2.player.cx > s.x + s.w / 2;
        g2.player.setPose('sit', s.x + (right ? 17 : 5), TS * 30 - 8 - G.PH, right ? -1 : 1);
        if (right) { g2.audio.play('creak'); text(g2, 'Range do lado direito. Sempre rangeu.'); }
      },
    });
    add({ id: 'tv', ...rectOf(decor('tv')), label: (g2) => (g2.flags.tvOn ? 'Desligar a TV' : 'Ligar a TV'),
      action: (g2) => { g2.flags.tvOn = !g2.flags.tvOn; g2.audio.play('switch'); if (g2.flags.tvOn) text(g2, 'Uma televisão de tamanho honesto. Nada que preste passando.', true); } });

    // ---------- quarto ----------
    add({
      id: 'cama', ...rectOf(decor('cama')), label: (g2) => (g2.story.step && g2.story.step.allowSleep ? 'Dormir' : 'Cama'),
      action: (g2) => {
        const st = g2.story;
        if (st.step && st.step.allowSleep) {
          g2.sleep(g2.clock.day + 1, 8 * 60, () => { if (st.step.onSleep) st.step.onSleep(st, g2); });
        } else text(g2, 'Ainda não. Tem coisa demais pra testar.', true);
      },
    });
    add({ id: 'janela_poco', ...rectOf(decor('janela_poco')), label: 'Janela', action: (g2) => text(g2, 'Um quarto com uma janela que dava pro poço de ventilação.') });
    add({ id: 'guarda_roupa', ...rectOf(decor('guarda_roupa')), label: 'Guarda-roupa', action: (g2) => text(g2, 'Camisetas, o terno do casamento de alguém, uma caixa de cabos que ele jura que um dia vai organizar.', true) });

    // ---------- hall e banheiro ----------
    const portas = spec.decor.filter((d) => d.type === 'porta_fundo');
    for (const d of portas) {
      if (d.label === 'WC') {
        add({ id: 'porta_banheiro', ...rectOf(d), label: 'Entrar no banheiro', action: (g2) => {
          if (g2.story.stepId === 's_livre' && !g2.story.flags.mansaoTeaser) {
            g2.story.flags.mansaoTeaser = true;
            g2.say([{ who: 'narr', orig: true, text: 'Por um instante, com a mão na maçaneta, a porta do banheiro parece levar a outro lugar. Pé-direito alto. Madeira escura. Ainda não.' }], () => g2.teleport(spec.bathroomSpawn, 'Banheiro'));
            return;
          }
          g2.teleport(spec.bathroomSpawn, 'Banheiro');
        } });
      } else if (d.label === 'SAÍDA') {
        add({ id: 'saida_banheiro', ...rectOf(d), label: 'Voltar para o hall', action: (g2) => g2.teleport(spec.hallSpawn, 'Hall') });
      } else {
        const msgs = {
          '22': ['Apartamento 22. O vizinho do lado.', true],
          '11': ['Apartamento 11. Não é seu.', true],
          '12': ['Apartamento 12. Cheiro de feijão.', true],
          '31': ['O vizinho de cima. Às onze da noite, sempre o barulho de arrastar alguma coisa que em sete anos ele nunca descobriu o que era.', false],
          '32': ['Apartamento 32. Silêncio.', true],
        };
        const m = msgs[d.label] || ['Trancada.', true];
        add({ id: 'apto_' + d.label, ...rectOf(d), label: 'Apartamento ' + d.label, action: (g2) => text(g2, m[0], m[1]) });
      }
    }
    add({ id: 'espelho', ...rectOf(decor('espelho')), label: 'Espelho', action: (g2) => text(g2, 'O mesmo rosto de sempre. Não tem nada de errado com ele. O errado está dentro.', true) });
    add({ id: 'chuveiro', ...rectOf(decor('chuveiro')), label: 'Chuveiro', action: (g2) => { g2.audio.play('water'); text(g2, 'Água morna. Normal. Ele precisava de normal.', true); } });

    // ---------- prédio ----------
    add({ id: 'caixas_correio', ...rectOf(decor('caixas_correio')), label: 'Caixas de correio', action: (g2) => {
      const p = g2.propById('painel');
      if (p && p.perceived) text(g2, 'Um dos painéis está solto. Dá pra tirar sem tocar — se ele quiser.', true);
      else text(g2, 'Contas, propaganda, um cardápio de pizzaria.', true);
    } });

    // ---------- rua, terreno, praça ----------
    add({ id: 'bueiro', x: TS * 20 - 4, y: TS * 38 - 20, w: TS + 8, h: 22, label: 'Bueiro', action: (g2) => text(g2, 'Uma grade enferrujada. Lá embaixo, algo ressoa como um eco grave. (O subterrâneo abre na Etapa 2.)', true) });
    add({ id: 'outdoor', ...rectOf(decor('outdoor')), label: 'Outdoor', action: (g2) => text(g2, '"ALUGA-SE". Há anos.', true) });
    add({ id: 'barreira', x: TS * 143, y: TS * 30, w: TS * 4, h: TS * 8, label: 'Barreira de obras', action: (g2) => text(g2, 'Rua interditada para obras. (O mundo se expande na Etapa 2.)', true) });
    add({ id: 'banco_ok', ...rectOf(decor('banco_ok')), label: 'Sentar no banco', action: (g2) => { const d = decor('banco_ok'); g2.player.setPose('sit', d.x + 10, TS * 38 - 7 - G.PH, 1); } });
    add({ id: 'placa_praca', ...rectOf(decor('placa')), label: 'Placa', action: (g2) => text(g2, 'Praça. Alguém riscou o nome com chave.', true) });
    add({ id: 'ponto', ...rectOf(decor('ponto')), label: 'Ponto de ônibus', action: (g2) => text(g2, 'Um banco de metal e um painel de propaganda de faculdade.', true) });

    return list;
  };

  /** Abre/fecha portas formadas por blocos, respeitando trancas e corpos no caminho. */
  function toggleDoor(g, id, cells) {
    const [x0, y0] = cells[0];
    const closed = G.TILES[g.world.get(x0, y0)].solid;
    if (closed) {
      if (id === 'porta_padaria' && !G.padariaAberta(g)) { text(g, 'Fechada. Abre às seis.', true); g.audio.play('tick'); return; }
      if (id === 'alcapao' && !g.inventory.has('chave_terraco') && !(g.story && g.story.flags && g.story.flags.chaveDevolvida)) { text(g, 'Trancado. A chave sumiu há anos.', true); g.audio.play('tick'); return; }
    } else {
      // não fecha em cima de alguém ou de algum objeto
      for (const [cx, cy] of cells) {
        const r = { x: cx * TS, y: cy * TS, w: TS, h: TS };
        if (G.util.overlap(r, g.player) || g.props.some((p) => !p.removed && !p.broken && G.util.overlap(r, p))) { text(g, 'Tem alguma coisa no caminho.', true); return; }
      }
    }
    for (const [cx, cy] of cells) {
      const t = g.world.get(cx, cy);
      const tg = G.TILES[t].toggle;
      if (tg !== null && tg !== undefined) g.world.set(cx, cy, tg);
    }
    g.audio.play('door');
    g.bus.emit('door', { id, open: closed });
  }
  G.toggleDoor = toggleDoor;
})(window.VG = window.VG || {});

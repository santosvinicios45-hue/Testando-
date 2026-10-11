/* Teste de ponta a ponta no navegador (Chromium headless via Playwright).
 * Joga a Etapa 1 inteira usando teclado e mouse reais sobre o canvas,
 * verificando cada passo da história, salvamento e ausência de erros.
 * Uso: NODE_PATH=$(npm root -g) node tests/playthrough.js [pasta-para-capturas]
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = process.argv[2] || null;
let failures = 0;
const ok = (cond, msg) => { if (cond) console.log('  ok  ' + msg); else { failures++; console.log('  FALHA ' + msg); } };

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForTimeout(800);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

  const shot = async (name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png') }); } };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const step = () => ev(() => VG.game.story.stepId);
  const wait = (ms) => page.waitForTimeout(ms);
  /** Avança todos os diálogos com a tecla E (escolhe a opção `pick` se houver). */
  const drain = async (pick) => {
    for (let i = 0; i < 80; i++) {
      const s = await ev(() => { const d = VG.game.story.dialog; return { a: d.active, ch: !!(d.current && d.current.choices && d.done), f: VG.game.fading }; });
      if (s.f) { await wait(200); continue; }
      if (!s.a) return;
      if (s.ch) { await page.keyboard.press('Digit' + ((pick || 0) + 1)); await wait(120); continue; }
      await page.keyboard.press('KeyE'); await wait(60);
    }
  };
  const waitFor = async (fn, ms, arg) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 5000)) { if (await ev(fn, arg)) return true; await wait(80); } return false; };
  const toClient = (x, y) => ev(([x, y]) => { const g = VG.game, r = g.renderer, c = document.getElementById('game').getBoundingClientRect(); return { x: c.left + (x - r.cam.x) * c.width / 480, y: c.top + (y - r.cam.y) * c.height / 270 }; }, [x, y]);
  const place = (x, y) => ev(([x, y]) => { const p = VG.game.player; p.clearPose(); p.x = x; p.y = y; p.vx = 0; p.vy = 0; VG.game.renderer.snapCamera(); }, [x, y]);
  const pressE = async () => { await page.keyboard.press('KeyE'); await wait(120); };
  const selectPower = async (n) => { await page.keyboard.press('Digit' + n); await wait(60); };
  const clickWorld = async (x, y, btn) => { const c = await toClient(x, y); await page.mouse.move(c.x, c.y); await wait(40); await page.mouse.click(c.x, c.y, { button: btn || 'left' }); await wait(80); };
  const propCenter = (id) => ev((id) => { const p = VG.game.propById(id); return { x: p.cx, y: p.cy }; }, id);

  console.log('Menu e início');
  ok(await ev(() => !!VG.game && VG.game.state === 'menu'), 'menu principal carregado');
  await page.click('button[data-act="new"]');
  await wait(400);
  ok(await step() === 's1_acordar', 'novo jogo começa em s1_acordar');
  await drain();
  await shot('p01-cozinha');

  console.log('Capítulo 1 — o copo');
  await place(16 * 51, 16 * 30 - 26);
  await pressE();
  ok(await step() === 's1_queda', 'lavar o copo inicia a queda');
  ok(await waitFor(() => VG.game.propById('copo').frozen, 6000), 'o copo para a 15 cm do chão');
  await shot('p02-copo-parado');
  await drain();
  await pressE(); // cutucar
  ok(await waitFor(() => VG.game.propById('copo').broken, 3000), 'cutucar quebra o copo');
  await drain();
  ok(await step() === 's1_vassoura', 'passa para a vassoura');
  await place(16 * 41 + 2, 16 * 30 - 26);
  await pressE();
  ok(await ev(() => VG.game.player.carry && VG.game.player.carry.id === 'vassoura'), 'V pega a vassoura e carrega');
  const shard = await ev(() => VG.game.propById('copo').cx);
  await place(shard - 8, 16 * 30 - 26);
  ok(await waitFor(() => VG.game.player.sweepT > 0, 2000), 'V começa a varrer os cacos');
  await shot('p02b-varrendo');
  await waitFor(() => VG.game.story.dialog.active, 4000);
  await drain();
  ok(await waitFor(() => !VG.game.propById('copo').broken && !VG.game.propById('copo').restoring, 4000), 'o copo é restaurado (involuntariamente)');
  ok(await ev(() => !VG.game.player.carry && Math.abs(VG.game.propById('vassoura').x - VG.game.propById('vassoura').spawn.x) < 1), 'a vassoura volta para trás da porta (como no livro)');
  await drain();
  ok(await waitFor(() => VG.game.story.stepId === 's1_sobe', 3000), 'V levanta do chão e passa para Sobe/Desce');
  ok(await ev(() => VG.game.powers.isUnlocked('restaurar') && VG.game.powers.isUnlocked('levitar')), 'Restaurar e Levitar desbloqueados');

  // Levitar com o mouse: segurar sobre o copo, subir, descer na pia
  await place(16 * 50, 16 * 30 - 26);
  await selectPower(1);
  const cup = await propCenter('copo');
  let c = await toClient(cup.x, cup.y);
  await page.mouse.move(c.x, c.y); await wait(50);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) { const t = await toClient(cup.x, cup.y - i * 3); await page.mouse.move(t.x, t.y); await wait(60); }
  await wait(900);
  ok(await ev(() => VG.game.story.flags.sobe === true), 'Sobe: copo erguido com o mouse');
  await shot('p03-levitando');
  for (let i = 10; i >= 0; i--) { const t = await toClient(16 * 51 + 8, cup.y - i * 3 - 1); await page.mouse.move(t.x, t.y); await wait(50); }
  await page.mouse.up({ button: 'left' });
  await page.mouse.click(c.x, c.y, { button: 'right' });
  ok(await waitFor(() => VG.game.story.flags.desce === true, 4000), 'Desce: copo pousado na pia');
  await drain();
  ok(await step() === 's1_geladeira', 'passa para a geladeira');
  await place(16 * 49, 16 * 30 - 26);
  await pressE(); await drain();
  ok(await step() === 's1_chefe', 'geladeira → avisar o chefe');
  await place(16 * 54, 16 * 30 - 26);
  await pressE(); await drain();
  ok(await step() === 's1_caderno', 'celular → caderno');
  await place(16 * 54 + 9, 16 * 30 - 26);
  await pressE(); await drain();
  await wait(200);
  ok(await ev(() => VG.game.ui.modal === 'caderno'), 'caderno abre');
  await shot('p04-caderno');
  await page.keyboard.press('KeyJ'); await wait(120);
  ok(await ev(() => VG.game.ui.modal === null), 'caderno fecha com J');
  ok(await step() === 's1_testes', 'testes do dia 1');

  // Transformar: colher (entortar e desentortar)
  await place(16 * 52, 16 * 30 - 26);
  await selectPower(4);
  let col = await propCenter('colher');
  await clickWorld(col.x, col.y); await drain();
  await clickWorld(col.x, col.y); await drain();
  ok(await ev(() => VG.game.story.flags.t_entortar && VG.game.story.flags.t_desentortar), 'colher entortou e desentortou');
  // Deslocar: controle remoto para o outro lado da sala (cozinha)
  await place(16 * 54, 16 * 30 - 26);
  await selectPower(3);
  const ctl = await propCenter('controle');
  await clickWorld(ctl.x, ctl.y);
  await clickWorld(16 * 50 + 6, 16 * 29 - 8);
  await drain();
  ok(await ev(() => VG.game.story.flags.t_controle), 'controle remoto atravessou a sala sem percorrer o caminho');
  // Abajur: acender com E, mudar cor; apagar, mudar cor
  await place(16 * 56 + 2, 16 * 30 - 26);
  await ev(() => { VG.game.flags.abajurOn = false; });
  const ab = await ev(() => { const it = VG.game.interactables.find((i) => i.id === 'abajur'); return { x: it.x + it.w / 2, y: it.y + it.h / 2 }; });
  await ev(() => { const it = VG.game.interactables.find((i) => i.id === 'abajur'); it.action(VG.game); });
  await selectPower(4);
  await clickWorld(ab.x, ab.y); await drain();
  await ev(() => { VG.game.flags.abajurOn = false; });
  await clickWorld(ab.x, ab.y); await drain();
  ok(await ev(() => VG.game.story.flags.t_abajur && VG.game.story.flags.t_abajur_off), 'abajur mudou de cor aceso e apagado');
  // Criar laranja, pegar (E) e comer pelos bolsos
  await selectPower(5);
  await clickWorld(16 * 55, 16 * 30 - 10); await drain();
  ok(await ev(() => VG.game.props.some((p) => p.type === 'laranja')), 'laranja criada');
  await wait(500);
  const lar = await ev(() => { const p = VG.game.props.find((q) => q.type === 'laranja'); return { x: p.x, y: p.y }; });
  await place(lar.x - 2, 16 * 30 - 26);
  await pressE();
  ok(await ev(() => VG.game.inventory.has('laranja_perfeita')), 'laranja foi para os bolsos');
  await page.keyboard.press('KeyI'); await wait(150);
  await page.click('#inv-grid .slot:first-child'); await wait(100);
  await shot('p05-bolsos');
  await page.click('button[data-act="inv-use"]'); await wait(100);
  await page.keyboard.press('KeyI'); await wait(100);
  await drain();
  ok(await ev(() => VG.game.story.flags.t_comer), 'comeu a laranja');
  await drain();
  ok(await waitFor(() => VG.game.story.stepId === 's1_janela', 4000), 'testes concluídos → janela');
  await waitFor(() => !VG.game.fading, 4000);
  await place(16 * 60 - 4, 16 * 30 - 26);
  await ev(() => { VG.game.player.facing = 1; });
  const gd = await toClient(16 * 60 + 8, 16 * 29); await page.mouse.move(gd.x, gd.y); await wait(50);
  await pressE(); await drain();
  ok(await step() === 's1_dormir', 'janela → dormir');
  await place(16 * 45, 16 * 30 - 26);
  await pressE();
  ok(await waitFor(() => VG.game.story.stepId === 's2_percepcao', 5000), 'dormir → dia 2');
  await drain();

  console.log('Capítulo 2 — testes domésticos');
  ok(await ev(() => VG.game.clock.day === 2), 'é o dia 2');
  await place(16 * 53, 16 * 30 - 26);
  await selectPower(6);
  const wallC = await toClient(16 * 56, 16 * 28);
  await page.mouse.move(wallC.x, wallC.y); await page.mouse.down(); await wait(500);
  await shot('p06-percepcao');
  await wait(900); await page.mouse.up();
  await drain();
  ok(await waitFor(() => VG.game.story.stepId === 's2_sabor', 4000), 'parede transparente → NUNCA MAIS → sabor');
  ok(await ev(() => VG.game.powers.blockedRegions.has('paredeVizinho')), 'Percepção na parede do vizinho fica bloqueada por V');
  await waitFor(() => !VG.game.fading, 4000);
  await place(16 * 51, 16 * 30 - 26);
  await selectPower(4);
  const cup2 = await propCenter('copo');
  await clickWorld(cup2.x, cup2.y); await drain();
  await pressE(); await drain();
  ok(await waitFor(() => VG.game.story.stepId === 's2_voo', 3000), 'água com gosto de coca bebida → voo');
  await waitFor(() => !VG.game.fading, 4000);
  await place(16 * 55, 16 * 30 - 26);
  await page.keyboard.down('KeyW'); await wait(1300); await page.keyboard.up('KeyW');
  await drain();
  ok(await ev(() => VG.game.story.flags.bonk), 'tentou voar e bateu a cabeça no teto');
  await wait(1500);
  await place(16 * 49, 16 * 30 - 26);
  await pressE();
  ok(await ev(() => VG.game.inventory.has('bolsa_gelo')), 'pegou a bolsa de gelo');
  await place(16 * 57 + 4, 16 * 30 - 26);
  await pressE(); await drain();
  ok(await waitFor(() => VG.game.story.stepId === 's2_dormir', 3000), 'deitou no sofá → dormir');
  await place(16 * 45, 16 * 30 - 26);
  await pressE();
  ok(await waitFor(() => VG.game.story.stepId === 's3_irritado', 5000), 'dia 3');
  await drain();
  await place(16 * 57 + 4, 16 * 30 - 26);
  await pressE();
  await waitFor(() => !VG.game.fading, 5000);
  await drain(0);
  ok(await waitFor(() => VG.game.story.stepId === 's3_linha', 3000), 'escolheu desfazer a cicatriz → A Linha');
  await drain();
  ok(await waitFor(() => !!VG.game.sequence, 3000), 'sequência A Linha ativa');
  await wait(300);
  await shot('p07-linha');
  // arrasta cada memória de volta até V
  for (let k = 0; k < 6; k++) {
    const f = await ev(() => { const s = VG.game.sequence; if (!s) return null; const fr = s.frags.find((q) => !q.locked); const c = s.center; return fr ? { x: fr.x, y: fr.y, cx: c.x, cy: c.y } : null; });
    if (!f) break;
    const a = await toClient(f.x, f.y), b = await toClient(f.cx, f.cy);
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    for (let i = 1; i <= 6; i++) { await page.mouse.move(a.x + (b.x - a.x) * i / 6, a.y + (b.y - a.y) * i / 6); await wait(25); }
    await page.mouse.up(); await wait(60);
  }
  await drain();
  ok(await waitFor(() => ['s3_chao', 's3_noite'].includes(VG.game.story.stepId), 6000), 'segurou tudo → V no chão');
  await drain();
  ok(await waitFor(() => VG.game.story.stepId === 's3_noite', 6000), 'aquela noite');
  await waitFor(() => !VG.game.fading, 5000);
  await place(16 * 45, 16 * 30 - 26);
  await pressE();
  await drain(1);
  ok(await waitFor(() => VG.game.story.stepId === 's4_manha', 7000), 'dormiu → manhã do dia 4');
  ok(await ev(() => VG.game.story.flags.postura === 'regras'), 'escolha da noite registrada (regras)');
  await waitFor(() => !VG.game.fading, 5000);
  await place(16 * 51, 16 * 30 - 26);
  await pressE(); await drain();
  ok(await waitFor(() => VG.game.story.stepId === 's_livre', 3000), 'fim do capítulo 2 → exploração livre');
  ok(await ev(() => VG.game.ui.modal === 'endcard'), 'tela de fim da etapa');
  await shot('p08-fim');
  await page.click('#endcard button[data-act="close-panel"]'); await wait(100);
  await wait(200); await drain();

  console.log('Exploração, missões secundárias e salvamento');
  // sair pela porta do apartamento até a rua
  await place(16 * 39, 16 * 30 - 26);
  await ev(() => { VG.game.interactables.find((i) => i.id === 'porta_apto').action(VG.game); });
  ok(await ev(() => !VG.G_TILES_SOLID && !VG.TILES[VG.game.world.get(38, 28)].solid), 'porta do apartamento abre');
  await place(16 * 66, 16 * 38 - 26);
  await wait(300);
  ok(await ev(() => !!VG.game.story.side.tercas), 'missão "terças-feiras" ativada ao sair');
  await place(16 * 92, 16 * 38 - 26);
  await wait(200);
  ok(await ev(() => !!VG.game.story.side.consertos), 'missão "consertos" ativada na praça');
  await selectPower(2);
  const banco = await propCenter('banco');
  await clickWorld(banco.x, banco.y);
  await wait(1300);
  await place(16 * 96, 16 * 38 - 26);
  const poste = await propCenter('poste');
  await clickWorld(poste.x, poste.y + 20);
  await wait(1300);
  ok(await ev(() => VG.game.story.side.consertos.state === 'done'), 'banco e poste restaurados');
  await shot('p09-praca');
  // segredo do telhado
  await place(16 * 43, 16 * 38 - 26);
  await selectPower(6);
  const pn = await propCenter('painel');
  let pc = await toClient(pn.x, pn.y);
  await page.mouse.move(pc.x, pc.y); await page.mouse.down(); await wait(300); await page.mouse.up();
  ok(await ev(() => VG.game.propById('painel').perceived), 'Percepção revela o painel solto');
  await selectPower(1);
  pc = await toClient(pn.x, pn.y);
  await page.mouse.move(pc.x, pc.y); await page.mouse.down();
  for (let i = 1; i <= 6; i++) { const t = await toClient(pn.x - i * 6, pn.y); await page.mouse.move(t.x, t.y); await wait(50); }
  await page.mouse.up(); await wait(400);
  await place(16 * 44 + 2, 16 * 38 - 26);
  await pressE();
  ok(await ev(() => VG.game.inventory.has('chave_terraco')), 'pegou a chave do terraço');
  // sobe a escada de verdade do 3º andar até o alçapão
  await ev(() => { const g = VG.game, s = g.stairs[3]; g.player.clearPose(); g.player.x = s.x0; g.player.y = s.y0 - 26; g.renderer.snapCamera(); });
  await wait(150);
  await page.keyboard.press('KeyW'); await wait(50);
  ok(await ev(() => !!VG.game.player.stair), 'entrou no último lance da escada com W');
  await page.keyboard.down('KeyW'); await wait(1600); await page.keyboard.up('KeyW');
  ok(await ev(() => VG.game.player.stair && VG.game.player.stair.t <= 0.61), 'parou no alçapão trancado');
  await shot('p09b-escada');
  await pressE();
  ok(await ev(() => !VG.TILES[VG.game.world.get(33, 22)].solid), 'alçapão abre com a chave');
  await page.keyboard.down('KeyW'); await wait(1500); await page.keyboard.up('KeyW');
  ok(await ev(() => !VG.game.player.stair && VG.game.player.y + 26 <= 16 * 22 + 1), 'chegou ao telhado pela escada');
  await place(16 * 40 - 2, 16 * 22 - 26);
  await pressE();
  ok(await ev(() => VG.game.story.side.terraco && VG.game.story.side.terraco.state === 'done'), 'segredo do telhado concluído');
  await shot('p10-telhado');

  console.log('Novidades: padaria, porteiro, pipa, Criar, voo e teleporte');
  // padaria: comprar pão com a carteira
  await ev(() => { VG.game.clock.min = 10 * 60; VG.game.interactables.find((i) => i.id === 'porta_padaria').action(VG.game); });
  await place(16 * 109, 16 * 38 - 26);
  const money0 = await ev(() => VG.game.wallet.reais);
  await pressE();
  await waitFor(() => VG.game.story.dialog.active, 2000);
  await drain(0);
  ok(await ev((m) => VG.game.inventory.has('pao_frances') && Math.abs(VG.game.wallet.reais - (m - 1)) < 1e-6, money0), 'comprou um pão francês por R$ 1,00');
  // porteiro
  await place(16 * 53 + 2, 16 * 38 - 26);
  await ev(() => { VG.game.player.facing = 1; });
  await pressE();
  ok(await ev(() => VG.game.story.dialog.active && /Valdir/.test(VG.game.story.dialog.current.who)), 'conversa com o porteiro');
  await drain(0);
  ok(await ev(() => VG.game.story.flags.chaveDevolvida && VG.game.wallet.reais > 20), 'devolveu a chave ao porteiro e ganhou gorjeta');
  // pipa: levitar até o menino
  await place(16 * 86, 16 * 38 - 26);
  await selectPower(1);
  const pipa = await propCenter('pipa');
  const kid = await ev(() => { const n = VG.game.npcs.find((q) => q.kind === 'crianca'); return { x: n.cx, y: n.y + 6 }; });
  let pa = await toClient(pipa.x, pipa.y);
  await page.mouse.move(pa.x, pa.y); await page.mouse.down();
  for (let i = 1; i <= 10; i++) { const t = await toClient(pipa.x + (kid.x + 14 - pipa.x) * i / 10, pipa.y + (kid.y - pipa.y) * i / 10); await page.mouse.move(t.x, t.y); await wait(50); }
  await wait(300); await page.mouse.up(); await page.mouse.click(pa.x, pa.y, { button: 'right' });
  ok(await waitFor(() => VG.game.story.flags.pipaDevolvida, 4000), 'pipa trazida até o menino');
  await drain(1);
  ok(await ev(() => VG.game.story.flags.pipaResposta === 'verdade'), 'escolha registrada (contou a verdade)');
  // Criar: trocar para maçã com botão direito e criar
  await selectPower(5);
  const cm = await toClient(16 * 84, 16 * 38 - 20);
  await page.mouse.move(cm.x, cm.y); await page.mouse.click(cm.x, cm.y, { button: 'right' }); await wait(80);
  ok(await ev(() => VG.game.powers.criarSel !== 'laranja'), 'botão direito troca o que Criar faz');
  await page.mouse.click(cm.x, cm.y); await wait(100);
  ok(await ev(() => VG.game.props.some((p) => p.dynamic && p.type !== 'laranja')), 'criou outra comida');
  // voo livre fora do prédio
  await place(16 * 75, 16 * 38 - 26);
  await page.keyboard.down('KeyW'); await wait(1000);
  const flyY = await ev(() => VG.game.player.y);
  await page.keyboard.up('KeyW');
  ok(flyY < 16 * 38 - 26 - 70, 'voa lá fora (subiu ' + Math.round(16 * 38 - 26 - flyY) + ' px)');
  await wait(1500);
  // teleporte
  await selectPower(7);
  const tx = await toClient(16 * 70, 16 * 38 - 13);
  const before0 = await ev(() => VG.game.player.x);
  await page.mouse.click(tx.x, tx.y); await wait(100);
  ok(await ev((b) => Math.abs(VG.game.player.x - b) > 40, before0), 'teleporte de V funciona');
  await shot('p11-novidades');

  // salvar, alterar, carregar
  await page.keyboard.press('Escape'); await wait(100);
  await page.click('#menu-pause button[data-act="save"]'); await wait(100);
  await page.click('button[data-act="slot-save"][data-slot="1"]'); await wait(150);
  ok(await ev(() => !!localStorage.getItem('vgame_save_1')), 'salvou no espaço 1');
  await page.click('#panel-saves button[data-act="back"]'); await wait(80);
  await page.click('#menu-pause button[data-act="resume"]'); await wait(80);
  const before = await ev(() => ({ x: VG.game.player.x, step: VG.game.story.stepId, inv: VG.game.inventory.count('chave_terraco'), comp: VG.game.powers.compreensao, banco: VG.game.propById('banco').broken, alc: VG.game.world.get(33, 22), regs: VG.game.story.registros.length }));
  await place(16 * 10, 16 * 38 - 26);
  await page.keyboard.press('Escape'); await wait(100);
  await page.click('#menu-pause button[data-act="load"]'); await wait(100);
  await page.click('button[data-act="slot-load"][data-slot="1"]'); await wait(400);
  const after = await ev(() => ({ x: VG.game.player.x, step: VG.game.story.stepId, inv: VG.game.inventory.count('chave_terraco'), comp: VG.game.powers.compreensao, banco: VG.game.propById('banco').broken, alc: VG.game.world.get(33, 22), regs: VG.game.story.registros.length }));
  ok(JSON.stringify(before) === JSON.stringify(after), 'carregar restaura posição, história, bolsos, poderes, objetos e mapa ' + JSON.stringify(after));

  // configurações: remapear pular para K e testar
  await page.keyboard.press('Escape'); await wait(80);
  await page.click('#menu-pause button[data-act="settings"]'); await wait(100);
  const jumpBtn = await page.$$('#bindings button');
  await jumpBtn[2].click(); await page.keyboard.press('KeyK'); await wait(80);
  ok(await ev(() => VG.game.settings.bindings.jump[0] === 'KeyK'), 'remapeou Pular para K');
  await page.click('#panel-settings button[data-act="reset-keys"]'); await wait(60);
  ok(await ev(() => VG.game.settings.bindings.jump[0] === 'KeyW'), 'teclas padrão restauradas');
  await page.click('#panel-settings button[data-act="back"]'); await wait(60);
  await page.click('#menu-pause button[data-act="quit"]'); await wait(300);
  ok(await ev(() => VG.game.state === 'menu' && !document.getElementById('btn-continue').disabled), 'voltou ao menu com "Continuar" disponível');
  await page.click('#btn-continue'); await wait(400);
  ok(await ev(() => VG.game.state === 'playing'), 'Continuar carrega o salvamento automático');

  ok(errors.length === 0, 'nenhum erro no console' + (errors.length ? ':\n' + errors.join('\n') : ''));
  await browser.close();
  console.log(failures ? '\n' + failures + ' falha(s).' : '\nTudo certo.');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

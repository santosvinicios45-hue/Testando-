/* Testes das mecânicas principais, sem navegador.
 * Carrega os módulos do jogo num contexto isolado (vm) com stubs mínimos
 * e verifica física, colisões, poderes, objetos, inventário e salvamento.
 * Uso: node tests/unit.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const FILES = ['core', 'world', 'physics', 'entities', 'particles', 'input', 'player', 'powers', 'inventory', 'story', 'interact', 'save'];

function makeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() };
}

function loadGame() {
  const ctx = { console, Math, Date, JSON, setTimeout, clearTimeout };
  ctx.window = ctx;
  ctx.localStorage = makeStorage();
  vm.createContext(ctx);
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
  return ctx.VG;
}

const G = loadGame();
const TS = G.TILE;
let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { fail++; console.log('  FALHA ' + name + '\n        ' + (e && e.message)); }
}
function assert(c, msg) { if (!c) throw new Error(msg || 'asserção falhou'); }
function near(a, b, eps, msg) { if (Math.abs(a - b) > (eps || 0.01)) throw new Error((msg || '') + ' esperado ' + b + ', obtido ' + a); }

/** Jogo falso: só o necessário para simular física e poderes. */
function fakeGame() {
  const spec = G.buildStage1();
  const g = {
    spec, world: spec.world,
    props: spec.props.map((s) => new G.Prop(s)),
    pickups: spec.pickups.map((s) => new G.Pickup(s)),
    surfaces: [], decor: spec.decor, regions: JSON.parse(JSON.stringify(spec.regions)),
    bus: new G.Events(),
    audio: { play() {} },
    particles: { burst() {}, dust() {}, spark() {}, ring() {}, glyph() {}, line() {}, add() {} },
    renderer: { mouse: { x: 0, y: 0 }, screenToWorld: () => g.renderer.mouse, timeRipple() {}, glitch() {}, shake() {} },
    ui: { toast() {}, bubble() {} },
    input: { keys: {}, is(a) { return !!this.keys[a]; }, hit(a) { return !!this.keys['hit_' + a]; }, mouse: { buttons: [false, false, false], pressed: [false, false, false], released: [false, false, false], wheel: 0, sx: 0, sy: 0 } },
    clock: { day: 1, min: 600 },
    flags: {},
    story: { safe: false },
    shake() {}, bubble() {},
    canControl: () => true,
    propById(id) { return this.props.find((p) => p.id === id) || null; },
    addProp(s) { const p = new G.Prop(s); this.props.push(p); return p; },
    solidProps() { return this.props.filter((p) => p.solid && !p.held && !p.removed); },
    platformProps() { return this.props.filter((p) => p.platform && !p.held && !p.removed); },
    solidPropsExcept(p) { return this.props.filter((q) => q !== p && q.solid && !q.removed); },
    platformPropsExcept(p) { return this.props.filter((q) => q !== p && q.platform && !q.removed); },
  };
  for (const d of spec.decor) if (d.surfaces) for (const [dx, dy, w] of d.surfaces) g.surfaces.push({ x: d.x + dx, y: d.y + dy, w, h: 2 });
  g.stairs = spec.stairs;
  g.npcs = spec.npcs.map((n) => new G.NPC(n));
  g.wallet = new G.Wallet(10);
  g.player = new G.Player(spec.spawn.x, spec.spawn.y);
  g.powers = new G.PowerSystem(g);
  g.inventory = new G.Inventory(12);
  return g;
}
const STEP = 1 / 60;
function run(g, seconds, each) { const n = Math.round(seconds / STEP); for (let i = 0; i < n; i++) { if (each) each(i); g.player.update(STEP, g); for (const p of g.props) p.update(STEP, g); } }
function inSolid(g, b) { return !g.world.rectFree(b); }

console.log('Física e movimento');
test('V nasce, cai e para exatamente sobre o piso do apartamento', () => {
  const g = fakeGame();
  g.player.y -= 10;
  run(g, 1);
  near(g.player.y + g.player.h, TS * 30, 0.001, 'pés no piso');
  assert(g.player.onGround, 'no chão');
});
test('Andar contra a porta fechada para na parede, sem entrar nela', () => {
  const g = fakeGame();
  g.input.keys.left = true;
  run(g, 4);
  assert(g.player.x >= TS * 39 - 0.001, 'parou na porta: x=' + g.player.x);
  assert(!inSolid(g, g.player), 'não está dentro de bloco');
});
test('Depois de encostar na parede, V consegue se afastar (não fica preso)', () => {
  const g = fakeGame();
  g.input.keys.left = true; run(g, 3);
  const x0 = g.player.x;
  g.input.keys.left = false; g.input.keys.right = true; run(g, 0.6);
  assert(g.player.x > x0 + 20, 'afastou-se: ' + x0 + ' → ' + g.player.x);
});
test('Pulo na rua sobe ~3,5 blocos e volta ao chão', () => {
  const g = fakeGame();
  g.player.x = TS * 70; g.player.y = TS * 38 - G.PH; run(g, 0.3);
  const y0 = g.player.y; let minY = y0;
  g.input.keys.hit_jump = true; g.input.keys.jump = true;
  run(g, 1.2, (i) => { if (i === 1) g.input.keys.hit_jump = false; minY = Math.min(minY, g.player.y); });
  const rise = y0 - minY;
  assert(rise > TS * 3 && rise < TS * 4.2, 'altura do pulo ' + rise.toFixed(1));
  near(g.player.y, y0, 0.001, 'voltou ao chão');
});
test('Soltar o botão cedo dá um pulo mais baixo (pulo variável)', () => {
  const g = fakeGame();
  g.player.x = TS * 70; g.player.y = TS * 38 - G.PH; run(g, 0.3);
  const y0 = g.player.y; let minY = y0;
  g.input.keys.hit_jump = true; g.input.keys.jump = true;
  run(g, 1, (i) => { if (i === 1) g.input.keys.hit_jump = false; if (i === 6) g.input.keys.jump = false; minY = Math.min(minY, g.player.y); });
  assert(y0 - minY < TS * 2.5, 'pulo curto ' + (y0 - minY).toFixed(1));
});
test('Dentro de casa a cabeça bate no teto e não atravessa a laje', () => {
  const g = fakeGame();
  run(g, 0.3);
  g.input.keys.hit_jump = true; g.input.keys.jump = true;
  let minY = 1e9;
  run(g, 0.8, (i) => { if (i === 1) g.input.keys.hit_jump = false; minY = Math.min(minY, g.player.y); });
  assert(minY >= TS * 27 - 0.001, 'topo da cabeça abaixo do teto (linha 27): ' + minY);
});
test('Queda muito rápida não atravessa o chão (sub‑passos)', () => {
  const g = fakeGame();
  g.player.x = TS * 70; g.player.y = 0; g.player.vy = 5000;
  G.Physics.move(g.player, g.world, { dt: 1 / 20 });
  for (let i = 0; i < 60; i++) { g.player.vy = 5000; G.Physics.move(g.player, g.world, { dt: 1 / 20 }); }
  near(g.player.y + g.player.h, TS * 38, 0.001, 'parou na superfície da rua');
});
test('Escada (degraus): andar para a esquerda no térreo sobe até o telhado-andar sem atravessar lajes', () => {
  const g = fakeGame();
  g.player.x = TS * 37; g.player.y = TS * 38 - G.PH; run(g, 0.3);
  let worst = 0, stuck = 0;
  // sobe os três andares: esquerda no 1º lance, direita no 2º — o caminho segue o degrau
  for (let floor = 0; floor < 3; floor++) {
    const target = TS * (34 - floor * 4);
    for (let k = 0; k < 400 && Math.abs(g.player.y + g.player.h - target) > 0.5; k++) {
      const onLanding = g.player.y + g.player.h <= target + 32.5;
      g.input.keys.left = !onLanding; g.input.keys.right = onLanding;
      run(g, STEP);
      if (inSolid(g, g.player)) worst++;
    }
    g.input.keys.left = g.input.keys.right = true; g.input.keys.left = false; run(g, 0.4); g.input.keys.right = false; run(g, 0.2);
    near(g.player.y + g.player.h, target, 0.5, 'chegou ao andar ' + (floor + 1));
    assert(g.player.x >= TS * 34 - 6, 'saiu do poço para o corredor');
  }
  assert(worst === 0, 'ficou dentro de bloco ' + worst + ' quadros');
});
test('Escada: segurar S no corredor desce; o patamar continua descendo', () => {
  const g = fakeGame();
  g.player.x = TS * 36; g.player.y = TS * 30 - G.PH; run(g, 0.3);
  g.input.keys.down = true; g.input.keys.left = true; run(g, 0.6); g.input.keys.down = false;
  assert(g.player.y + g.player.h > TS * 30 + 8, 'começou a descer');
  // vira no patamar e continua descendo sem segurar S
  for (let k = 0; k < 300 && g.player.y + g.player.h < TS * 34 - 0.5; k++) {
    const landing = Math.abs(g.player.y + g.player.h - TS * 32) < 0.6 && g.player.cx < TS * 32 - 1;
    if (landing || g.input.keys.right) { g.input.keys.left = false; g.input.keys.right = true; }
    run(g, STEP);
    assert(!inSolid(g, g.player), 'dentro de bloco');
  }
  near(g.player.y + g.player.h, TS * 34, 0.5, 'chegou ao 1º andar');
});
test('Pular no meio da escada não prende na laje de cima', () => {
  const g = fakeGame();
  g.player.x = TS * 32 + 3; g.player.y = TS * 36 - G.PH - 4; run(g, 0.4);
  g.input.keys.hit_jump = true; g.input.keys.jump = true;
  run(g, 1, (i) => { if (i === 1) g.input.keys.hit_jump = false; });
  g.input.keys.jump = false; run(g, 0.5);
  assert(!inSolid(g, g.player), 'livre');
  assert(g.player.onGround, 'apoiado num degrau ou patamar');
});
test('Alçapão fechado barra a subida para o telhado', () => {
  const g = fakeGame();
  g.player.x = TS * 36; g.player.y = TS * 26 - G.PH; run(g, 0.3);
  g.input.keys.left = true; run(g, 3); g.input.keys.left = false;
  g.input.keys.right = true; run(g, 3);
  assert(g.player.y + g.player.h > TS * 22 + 8, 'não chegou ao telhado: pés em ' + (g.player.y + g.player.h));
  assert(!inSolid(g, g.player), 'não entrou no alçapão');
  for (const [x, y] of G.HATCH_CELLS) g.world.set(x, y, G.TILES[g.world.get(x, y)].toggle);
  g.input.keys.right = false; g.player.x = TS * 36; g.player.y = TS * 26 - G.PH; run(g, 0.3);
  g.input.keys.left = true;
  for (let k = 0; k < 400 && !(g.player.y + g.player.h <= TS * 24 + 0.5 && g.player.x < TS * 32); k++) run(g, STEP);
  g.input.keys.left = false; g.input.keys.right = true; run(g, 2.5);
  near(g.player.y + g.player.h, TS * 22, 0.5, 'com o alçapão aberto chega ao telhado');
});
test('Voo livre: Pular de novo no ar entra em voo controlado; W sobe, S desce, chão encerra', () => {
  const g = fakeGame();
  g.powers.vooLivre = true;
  g.player.x = TS * 72; g.player.y = TS * 38 - G.PH; run(g, 0.3);
  g.input.keys.hit_jump = true; g.input.keys.jump = true; run(g, STEP); g.input.keys.hit_jump = false; g.input.keys.jump = false;
  run(g, 0.2);
  g.input.keys.hit_jump = true; run(g, STEP); g.input.keys.hit_jump = false;
  assert(g.player.hover, 'entrou no voo');
  const y0 = g.player.y; g.input.keys.jump = true; run(g, 1); g.input.keys.jump = false;
  assert(g.player.y < y0 - 60, 'subiu voando: ' + (y0 - g.player.y).toFixed(0));
  const y1 = g.player.y; run(g, 1);
  assert(Math.abs(g.player.y - y1) < 12, 'parado no ar sem segurar nada');
  g.input.keys.down = true; run(g, 4); g.input.keys.down = false;
  assert(!g.player.hover && g.player.onGround, 'pousou e o voo acabou');
});
test('Correr é mais rápido que andar', () => {
  const g = fakeGame();
  g.player.x = TS * 66; g.player.y = TS * 38 - G.PH; run(g, 0.2);
  g.input.keys.right = true; run(g, 0.6); const walk = g.player.vx;
  g.input.keys.run = true; run(g, 0.6);
  assert(g.player.vx > walk * 1.4, 'correndo ' + g.player.vx.toFixed(0) + ' vs ' + walk.toFixed(0));
});
test('Levantar com animação: deitado → sentado → em pé', () => {
  const g = fakeGame();
  g.player.setPose('collapse', TS * 55, TS * 30 - G.PH, 1);
  let done = false;
  g.player.getUp(() => { done = true; });
  assert(g.player.pose === 'sitFloor', 'primeiro senta');
  run(g, 1.2);
  assert(done && !g.player.pose, 'de pé');
});
test('Empurrar um caixote andando contra ele', () => {
  const g = fakeGame();
  const c = g.propById('caixote4');
  g.player.x = c.x - 14; g.player.y = TS * 38 - G.PH; run(g, 0.2);
  const cx0 = c.x;
  g.input.keys.right = true; run(g, 1.5);
  assert(c.x > cx0 + 10, 'caixote andou ' + (c.x - cx0).toFixed(1));
  assert(!G.util.overlap(g.player, c), 'V não entrou no caixote');
});
test('Caixotes empilhados repousam um sobre o outro', () => {
  const g = fakeGame();
  run(g, 1.5);
  const top = g.propById('caixote3'), b1 = g.propById('caixote1');
  near(top.y + top.h, b1.y, 0.01, 'caixote de cima apoiado');
});

console.log('Objetos, quebra e Restauração');
test('O copo cai da pia, quebra no chão e a Restauração o devolve à pia', () => {
  const g = fakeGame();
  const cup = g.propById('copo');
  run(g, 0.6);
  const rest = { x: cup.lastRest.x, y: cup.lastRest.y };
  cup.x = TS * 49; cup.y = TS * 26 + 18; cup.vx = 0; // fora da bancada, alto
  let broke = false; g.bus.on('prop:break', () => { broke = true; });
  run(g, 1);
  assert(broke && cup.broken, 'quebrou');
  assert(cup.shards.length > 0, 'tem cacos');
  let restored = false; g.bus.on('prop:restored', () => { restored = true; });
  G.POWERS.restaurar.apply(g.powers, g, cup, false);
  run(g, 3);
  assert(restored && !cup.broken, 'restaurado');
  near(cup.x, rest.x, 0.5, 'x de volta à pia'); near(cup.y, rest.y, 0.5, 'y de volta à pia');
  assert(g.powers.tension > 0, 'a Restauração tensionou a Linha');
});
test('Restaurar um objeto inteiro desfaz o movimento recente', () => {
  const g = fakeGame();
  const book = g.propById('livro');
  run(g, 0.6);
  const x0 = book.x, y0 = book.y;
  book.vx = 120; book.vy = -100; run(g, 1.2);
  assert(Math.abs(book.x - x0) > 4, 'livro saiu do lugar');
  G.POWERS.restaurar.apply(g.powers, g, book, false);
  run(g, 2);
  near(book.x, x0, 1, 'x'); near(book.y, y0, 1, 'y');
});
test('Estruturas da praça começam quebradas e se remontam', () => {
  const g = fakeGame();
  const banco = g.propById('banco');
  assert(banco.broken && !banco.platform, 'banco quebrado não serve de apoio');
  G.POWERS.restaurar.apply(g.powers, g, banco, false);
  run(g, 1.5);
  assert(!banco.broken && banco.platform, 'banco remontado vira apoio');
});

console.log('Poderes e a Linha');
test('Levitar: o objeto segue o alvo e o custo cresce com a massa', () => {
  const g = fakeGame();
  const P = G.POWERS.levitar;
  const ps = g.powers;
  ['levitar', 'restaurar'].forEach((id) => ps.unlock(id, { silent: true }));
  run(g, 0.5);
  const cup = g.propById('copo');
  P.down(ps, g, cup.cx, cup.cy);
  assert(ps.held === cup, 'segurou o copo');
  for (let i = 0; i < 60; i++) { P.hold(ps, g, STEP, cup.cx, TS * 28); cup.update(STEP, g); }
  assert(cup.cy < TS * 28 + 4, 'copo subiu até o alvo: ' + cup.cy.toFixed(1));
  const lightCost = ps.tension;
  P.up(ps, g);
  ps.tension = 0;
  const g2 = fakeGame(); g2.powers.unlock('levitar', { silent: true });
  g2.player.x = TS * 12; g2.player.y = TS * 38 - G.PH;
  const crate = g2.propById('caixote4');
  P.down(g2.powers, g2, crate.cx, crate.cy);
  for (let i = 0; i < 60; i++) { P.hold(g2.powers, g2, STEP, crate.cx, crate.cy - 20); crate.update(STEP, g2); }
  assert(g2.powers.tension > lightCost * 3, 'caixote custa bem mais que copo (' + g2.powers.tension.toFixed(1) + ' vs ' + lightCost.toFixed(1) + ')');
});
test('Não dá para levitar o objeto em que V está pisando', () => {
  const g = fakeGame();
  g.powers.unlock('levitar', { silent: true });
  const crate = g.propById('caixote4');
  g.player.x = crate.x + 2; g.player.y = crate.y - G.PH - 2; run(g, 0.3);
  assert(g.player.groundRef === crate, 'V está em cima do caixote');
  G.POWERS.levitar.down(g.powers, g, crate.cx, crate.cy);
  assert(g.powers.held === null, 'recusou erguer o próprio apoio');
});
test('Passar do limite da Linha faz ela desfiar: solta o objeto e cobra tensão', () => {
  const g = fakeGame();
  const ps = g.powers;
  ps.unlock('levitar', { silent: true });
  let unr = false; g.bus.on('unravel', () => { unr = true; });
  ps.tension = ps.capacity + 1;
  ps.update(STEP);
  assert(unr, 'desfiou');
  assert(ps.tension < ps.capacity, 'tensão voltou abaixo do limite');
  assert(g.player.stun > 0, 'V cambaleia');
});
test('A Linha relaxa sozinha quando V para de usar poderes', () => {
  const g = fakeGame();
  g.powers.tension = 60;
  for (let i = 0; i < 180; i++) g.powers.update(STEP);
  assert(g.powers.tension < 40, 'relaxou para ' + g.powers.tension.toFixed(1));
});
test('Compreensão aumenta o limite da Linha', () => {
  const g = fakeGame();
  const c0 = g.powers.capacity; g.powers.compreensao += 3;
  assert(g.powers.capacity === c0 + 24, 'limite ' + g.powers.capacity);
});
test('Deslocar recusa destino dentro de parede e aceita lugar livre', () => {
  const g = fakeGame();
  const ps = g.powers; ps.unlock('deslocar', { silent: true });
  run(g, 0.3);
  const ctl = g.propById('controle');
  ps.deslocarSel = ctl;
  const bad = G.POWERS.deslocar.target(ps, g, TS * 48 + 8, TS * 27 + 8);
  assert(!bad.ok, 'parede recusada');
  const good = G.POWERS.deslocar.target(ps, g, TS * 53, TS * 29);
  assert(good.ok, 'lugar livre aceito');
});
test('Transformar: colher entorta e desentorta; caixote vira ferro e fica pesado', () => {
  const g = fakeGame();
  const sp = g.propById('colher');
  assert(G.Transforms.colher(g, sp).kind === 'entortar' && sp.state.bent, 'entortou');
  assert(G.Transforms.colher(g, sp).kind === 'desentortar' && !sp.state.bent, 'desentortou');
  const cx = g.propById('caixote1');
  G.Transforms.caixote(g, cx);
  assert(cx.state.metal && cx.mass === 7, 'virou ferro');
});

test('Criar faz várias comidas e dinheiro; dinheiro vai para a carteira', () => {
  const g = fakeGame(); const ps = g.powers;
  ps.unlock('criar', { silent: true });
  ['maca', 'dinheiro'].forEach((id) => ps.unlockCriavel(id, true));
  g.say = () => {}; g.flags = {};
  ps.criarSel = 'maca';
  G.POWERS.criar.down(ps, g, TS * 55, TS * 30 - 10);
  assert(g.props.some((p) => p.type === 'maca'), 'maçã criada');
  ps.criarSel = 'dinheiro';
  G.POWERS.criar.down(ps, g, TS * 53, TS * 30 - 10);
  const nota = g.props.find((p) => p.type === 'dinheiro');
  assert(nota && nota.state.criado, 'nota criada');
  g.wallet.add(nota.T.money, true);
  assert(g.wallet.reais === 20 && g.wallet.criado === 10, 'carteira ' + g.wallet.text);
  assert(g.wallet.pay(4.5) && Math.abs(g.wallet.reais - 15.5) < 1e-9 && !g.wallet.pay(100), 'pagar e recusar sem saldo');
});
test('Teleporte leva V a um lugar livre e recusa parede', () => {
  const g = fakeGame(); const ps = g.powers; ps.unlock('teleporte', { silent: true });
  run(g, 0.3);
  const x0 = g.player.x;
  G.POWERS.teleporte.down(ps, g, TS * 48 + 8, TS * 28);
  near(g.player.x, x0, 0.01, 'parede recusada');
  G.POWERS.teleporte.down(ps, g, TS * 45, TS * 29);
  assert(Math.abs(g.player.x - x0) > 40 && !inSolid(g, g.player), 'teleportou');
});
test('O homem do cachorro não atravessa as paredes dos prédios', () => {
  const g = fakeGame();
  const n = g.npcs.find((q) => q.kind === 'passeador');
  let minX = 1e9, maxX = -1e9;
  for (let i = 0; i < 60 * 120; i++) { n.update(STEP, g); minX = Math.min(minX, n.x, n.dog.x); maxX = Math.max(maxX, n.x + n.w, n.dog.x + 12); }
  assert(minX >= TS * 61 && maxX <= TS * 102, 'faixa ' + (minX / TS).toFixed(1) + '–' + (maxX / TS).toFixed(1));
});
test('Pessoas reagem quando veem um poder (e fogem de voo)', () => {
  const g = fakeGame();
  const n = g.npcs.find((q) => q.kind === 'senhora');
  assert(n.react('levitate', g, n.x + 30) && n.stare > 0 && n.say, 'espanto');
  assert(n.react('fly', g, n.x + 30) && n.scared > 0, 'fuga');
  assert(!n.react('fly', g, n.x + 30), 'voo repetido não conta outra vez');
  g.clock.min = 600; g.story.flags = {};
  for (let i = 0; i < 60 * 3; i++) n.update(1 / 60, g);
  assert(Math.abs(n.x - n.homeX) <= 56.5, 'fuga limitada perto de casa');
  for (let i = 0; i < 60 * 8; i++) n.update(1 / 60, g);
  assert(Math.abs(n.x - n.homeX) < 1, 'voltou para o lugar: ' + (n.x - n.homeX).toFixed(1));
});

console.log('Inventário e salvamento');
test('Bolsos empilham, respeitam limite e removem corretamente', () => {
  const inv = new G.Inventory(3);
  assert(inv.add('laranja_perfeita', 8) === 0, 'cabe em 2 pilhas');
  assert(inv.count('laranja_perfeita') === 8, 'contagem');
  assert(inv.add('chave_terraco') === 0, 'chave cabe');
  assert(inv.add('bolsa_gelo') === 1, 'bolsos cheios devolvem o excedente');
  assert(inv.remove('laranja_perfeita', 7) && inv.count('laranja_perfeita') === 1, 'removeu 7');
  assert(!inv.remove('laranja_perfeita', 5), 'não remove o que não tem');
});
test('Mapa: diferenças (portas abertas) são salvas e reaplicadas', () => {
  const g1 = fakeGame();
  g1.world.set(38, 28, G.T.DOOR_O); g1.world.set(38, 29, G.T.DOOR_O);
  const diff = g1.world.diff();
  const g2 = fakeGame();
  g2.world.applyDiff(diff);
  assert(g2.world.get(38, 28) === G.T.DOOR_O && !g2.world.isSolid(38, 29), 'porta aberta no mundo novo');
});
test('Abrir/fechar portas respeita trancas e quem está no caminho', () => {
  const g = fakeGame();
  g.player.x = TS * 36; g.player.y = TS * 26 - G.PH;
  G.toggleDoor(g, 'alcapao', G.HATCH_CELLS);
  assert(g.world.isSolid(33, 22), 'alçapão trancado sem a chave');
  g.inventory.add('chave_terraco');
  G.toggleDoor(g, 'alcapao', G.HATCH_CELLS);
  assert(!g.world.isSolid(33, 22), 'abriu com a chave');
  g.player.x = TS * 38; g.player.y = TS * 30 - G.PH;
  G.toggleDoor(g, 'porta_apto', [[38, 28], [38, 29]]);
  assert(!g.world.isSolid(38, 28), 'porta do apartamento abriu');
  G.toggleDoor(g, 'porta_apto', [[38, 28], [38, 29]]);
  assert(!g.world.isSolid(38, 28), 'não fecha em cima de V');
});
test('Objetos e poderes sobrevivem a serializar → aplicar', () => {
  const g = fakeGame();
  const cup = g.propById('copo'); cup.x = 700; cup.y = 470; cup.broken = true; cup.state.sabor = 'coca';
  const crate = g.propById('caixote2'); crate.state.metal = true;
  g.powers.unlock('levitar', { silent: true }); g.powers.unlock('criar', { silent: true });
  g.powers.compreensao = 5; g.powers.blockedRegions.add('paredeVizinho');
  const data = { props: g.props.map((p) => p.serialize()), powers: g.powers.serialize(), inv: g.inventory.serialize() };
  const json = JSON.parse(JSON.stringify(data));
  const g2 = fakeGame();
  for (const pd of json.props) g2.propById(pd.id).applySave(pd);
  g2.powers.applySave(json.powers);
  const c2 = g2.propById('copo');
  assert(c2.broken && c2.x === 700 && c2.state.sabor === 'coca', 'copo quebrado e com sabor');
  assert(g2.propById('caixote2').mass === 7, 'caixote de ferro continua pesado');
  assert(g2.powers.isUnlocked('criar') && g2.powers.compreensao === 5 && g2.powers.blockedRegions.has('paredeVizinho'), 'poderes, compreensão e promessa de V');
});
test('Validação rejeita save corrompido e aceita save bem formado', () => {
  assert(G.Save.validate(null), 'nulo rejeitado');
  assert(G.Save.validate({ format: 1 }), 'incompleto rejeitado');
  const ok = { format: 1, player: { x: 1, y: 2 }, clock: { day: 1, min: 0 }, story: { stepId: 's1_acordar' }, props: [] };
  assert(G.Save.validate(ok) === null, 'save bom aceito');
});
test('Configurações: teclas padrão completas para todas as ações', () => {
  for (const a of G.ACTIONS) assert((G.DEFAULT_BINDINGS[a.id] || []).length > 0, 'sem tecla: ' + a.id);
});
test('História: todos os passos referenciados existem e têm objetivo', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'story.js'), 'utf8');
  const refs = [...src.matchAll(/st\.go\('([a-z0-9_]+)'\)|this\.go\('([a-z0-9_]+)'\)/g)].map((m) => m[1] || m[2]);
  for (const r of refs) assert(G.STORY_STEPS[r], 'passo inexistente: ' + r);
  for (const [id, s] of Object.entries(G.STORY_STEPS)) assert(s.objective || s.objectiveFn, 'sem objetivo: ' + id);
});

console.log('\n' + pass + ' passaram, ' + fail + ' falharam.');
process.exit(fail ? 1 : 0);

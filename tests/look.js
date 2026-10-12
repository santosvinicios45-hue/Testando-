/* Captura de tela para conferir a arte em qualquer ponto do mapa.
 * Uso: NODE_PATH=$(npm root -g) node tests/look.js saida.png '<json>'
 * json: { "x": 1440, "y": 576, "min": 620, "wait": 1500, "hud": false,
 *         "clip": [x, y, w, h], "eval": "código JS opcional rodado antes (g = VG.game)" }
 * x/y são a posição de V em unidades do mundo (16 = 1 bloco; o chão da rua fica em y = 576).
 */
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2];
const o = Object.assign({ x: 1440, y: 576, min: 620, wait: 1500, hud: false }, JSON.parse(process.argv[3] || '{}'));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await b.newPage({ viewport: { width: 1440, height: 810 } });
  page.on('pageerror', (e) => console.log('ERRO', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('ERRO console', m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(700);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.click('button[data-act="new"]');
  await page.waitForTimeout(300);
  for (let i = 0; i < 40; i++) { const a = await page.evaluate(() => VG.game.story.dialog.active); if (!a) break; await page.keyboard.press('KeyE'); await page.waitForTimeout(50); }
  await page.evaluate((o) => {
    const g = VG.game, p = g.player;
    p.clearPose(); p.x = o.x; p.y = o.y - VG.PH; p.vx = 0; p.vy = 0; g.clock.min = o.min;
    if (o.eval) (new Function('g', o.eval))(g);
    g.renderer.snapCamera();
    if (!o.hud) for (const s of ['#hud', '#objective', '#hotbar', '#toasts', '#prompt', '#bubble', '#chapter', '.chapter-card', '#chapter-card']) document.querySelectorAll(s).forEach((e) => { e.style.visibility = 'hidden'; });
  }, o);
  await page.waitForTimeout(o.wait);
  const opts = { path: out };
  if (o.clip) opts.clip = { x: o.clip[0], y: o.clip[1], width: o.clip[2], height: o.clip[3] };
  await page.screenshot(opts);
  await b.close();
})();

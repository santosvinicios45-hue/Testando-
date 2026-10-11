/* =====================================================================
 * Renderização: câmera, céu e paralaxe, blocos pré‑desenhados,
 * entidades, iluminação dinâmica e efeitos dos poderes (tempo parado,
 * rebobinar, percepção, desfiar da Linha).
 * ===================================================================== */
(function (G) {
  'use strict';
  const U = G.util;
  const TS = G.TILE;
  const VW = G.VIEW_W, VH = G.VIEW_H;
  const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

  function mkCanvas(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    return [c, x];
  }

  /* --------------------- texturas de blocos --------------------- */
  function drawTile(c, w, t, tx, ty) {
    const x = tx * TS, y = ty * TS;
    const h = (n) => U.hash(tx, ty, n);
    const T = G.T;
    const speck = (base, dark, light, n) => {
      R(c, x, y, TS, TS, base);
      for (let i = 0; i < n; i++) { const a = U.hash(tx, ty, i * 3 + 1), b = U.hash(tx, ty, i * 3 + 2); R(c, x + Math.floor(a * 15), y + Math.floor(b * 15), 1, 1, U.hash(tx, ty, i * 3 + 3) > 0.5 ? dark : light); }
    };
    const above = w.get(tx, ty - 1);
    const openAbove = !G.TILES[above].solid && !G.TILES[above].door;
    switch (t) {
      case T.AIR: return;
      case T.DIRT: speck('#6e4a2e', '#5a3b23', '#83593a', 10); break;
      case T.STONE: speck('#666a70', '#55595e', '#7a7e84', 8); if (h(9) > 0.7) R(c, x + 3, y + 7, 7, 1, '#4f5257'); break;
      case T.BEDROCK: speck('#2b2c30', '#1f2023', '#3a3b40', 6); break;
      case T.ASPHALT: speck('#3a3d42', '#2f3236', '#4a4d52', 8); if (openAbove) R(c, x, y, TS, 2, '#4f5359'); break;
      case T.SIDEWALK: R(c, x, y, TS, TS, '#a9a59c'); R(c, x, y, TS, 3, '#c4c0b6'); R(c, x + 15, y, 1, TS, '#8f8b83'); speck2(c, x, y, tx, ty, '#9a968d'); break;
      case T.BRICK: brick(c, x, y, tx, ty, '#9c4a35', '#b25a42', '#cdbca6'); break;
      case T.CONCRETE: R(c, x, y, TS, TS, '#8d9095'); R(c, x, y, TS, 1, '#a3a6ab'); R(c, x, y + 15, TS, 1, '#76797d'); if (h(4) > 0.8) R(c, x + 4, y + 6, 1, 1, '#7c7f83'); break;
      case T.WOOD: R(c, x, y, TS, TS, '#8d9095'); R(c, x, y, TS, 4, '#a8713e'); R(c, x, y, TS, 1, '#c08752'); R(c, x + (tx % 2 ? 7 : 11), y, 1, 4, '#8a5a2b'); R(c, x, y + 4, TS, 1, '#6d4a2a'); break;
      case T.TILEF: R(c, x, y, TS, TS, '#e8e8e2'); R(c, x + 7, y, 1, TS, '#c9c9c2'); R(c, x, y + 7, TS, 1, '#c9c9c2'); break;
      case T.PLATFORM: R(c, x, y, TS, 3, '#8a5a2b'); R(c, x, y, TS, 1, '#a87444'); R(c, x + 2, y + 3, 2, 3, '#5c3b1c'); R(c, x + 12, y + 3, 2, 3, '#5c3b1c'); break;
      case T.DOOR_C: case T.DOOR_O: {
        const top = w.get(tx, ty - 1) !== t;
        if (t === T.DOOR_C) {
          R(c, x + 2, y, 12, TS, '#7a5236'); R(c, x + 3, y + (top ? 1 : 0), 10, TS - (top ? 1 : 0), '#8f6343');
          R(c, x + 4, y + (top ? 3 : 2), 8, 10, '#9a6d4b');
          if (!top) R(c, x + 11, y + 4, 2, 2, '#d4b16a');
          if (top) R(c, x + 1, y, 14, 1, '#4f3522');
        } else {
          R(c, x + 1, y, 2, TS, '#4f3522'); R(c, x + 13, y, 2, TS, '#4f3522');
          R(c, x + 2, y, 3, TS, '#8f6343');
          if (top) R(c, x + 1, y, 14, 1, '#4f3522');
        }
        break;
      }
      case T.GDOOR_C: case T.GDOOR_O: {
        const top = w.get(tx, ty - 1) !== t;
        R(c, x + 1, y, 2, TS, '#d5d9dc'); R(c, x + 13, y, 2, TS, '#d5d9dc');
        if (top) R(c, x + 1, y, 14, 2, '#d5d9dc');
        if (t === T.GDOOR_C) { c.save(); c.globalAlpha = 0.35; R(c, x + 3, y + (top ? 2 : 0), 10, TS, '#9fd3f0'); c.restore(); R(c, x + 4, y + 3, 1, 6, 'rgba(255,255,255,0.6)'); R(c, x + 8, y + 7, 3, 1, '#c8ccd0'); }
        else { c.save(); c.globalAlpha = 0.3; R(c, x + 10, y + (top ? 2 : 0), 3, TS, '#9fd3f0'); c.restore(); }
        break;
      }
      case T.HATCH_C: R(c, x, y, TS, TS, '#5d656c'); R(c, x, y, TS, 2, '#7a838a'); R(c, x + 2, y + 6, 12, 1, '#454c52'); R(c, x + 7, y + 10, 2, 2, '#c9a24a'); break;
      case T.HATCH_O: R(c, x, y, 2, TS, '#5d656c'); R(c, x + 14, y, 2, TS, '#5d656c'); R(c, x, y, TS, 3, '#6d757c'); break;
      case T.RAIL: R(c, x, y + 1, TS, 2, '#2f3439'); for (let i = 1; i < TS; i += 4) R(c, x + i, y + 3, 1, 13, '#2f3439'); break;
      case T.GRASS: R(c, x, y, TS, TS, '#6e4a2e'); R(c, x, y, TS, 4, '#4f9a3a'); R(c, x, y, TS, 1, '#6fc04f'); for (let i = 0; i < 4; i++) R(c, x + Math.floor(h(i) * 15), y - 1, 1, 1, '#5aae44'); break;
      case T.FENCE: R(c, x, y, TS, TS, '#8b6a3e'); for (let i = 0; i < TS; i += 4) R(c, x + i, y, 1, TS, '#6e5230'); if (openAbove) R(c, x, y, TS, 2, '#a7834f'); break;
      case T.MANHOLE: speck('#3a3d42', '#2f3236', '#4a4d52', 6); R(c, x + 1, y, 14, 3, '#25272a'); for (let i = 2; i < 14; i += 3) R(c, x + i, y + 1, 1, 1, '#4b4f54'); break;
      case T.GLASS: R(c, x + 1, y + 1, 14, 14, '#d5d9dc'); c.save(); c.globalAlpha = 0.5; R(c, x + 2, y + 2, 12, 12, '#7fb8dd'); c.restore(); R(c, x + 7, y + 2, 1, 12, '#d5d9dc'); R(c, x + 3, y + 3, 2, 4, 'rgba(255,255,255,0.5)'); break;
      case T.ROOF: R(c, x, y, TS, TS, '#808388'); R(c, x, y, TS, 3, '#4a4a4f'); R(c, x, y + 15, TS, 1, '#6b6e72'); break;
      case T.GRAVEL: speck('#7d7466', '#685f52', '#958b7c', 12); if (openAbove) R(c, x, y, TS, 1, '#9a9081'); break;
      case T.FACADE: {
        R(c, x, y, TS, TS, '#c9a27e'); R(c, x, y, TS, 1, '#d4ae8b');
        const wx = (tx - 103) % 4, wy = (ty - 26) % 4;
        if ((wx === 1 || wx === 2) && (wy === 1 || wy === 2)) {
          R(c, x, y, TS, TS, '#7a8e9c');
          if (wx === 1) R(c, x, y, 2, TS, '#efe6d8'); if (wx === 2) R(c, x + 14, y, 2, TS, '#efe6d8');
          if (wy === 1) R(c, x, y, TS, 2, '#efe6d8'); if (wy === 2) R(c, x, y + 14, TS, 2, '#efe6d8');
          R(c, x + (wx === 1 ? 4 : 2), y + (wy === 1 ? 4 : 2), 3, 5, 'rgba(255,255,255,0.35)');
        }
        break;
      }
      default: R(c, x, y, TS, TS, '#f0f');
    }
  }
  function speck2(c, x, y, tx, ty, col) { for (let i = 0; i < 4; i++) R(c, x + Math.floor(U.hash(tx, ty, i + 40) * 15), y + 4 + Math.floor(U.hash(tx, ty, i + 50) * 11), 1, 1, col); }
  function brick(c, x, y, tx, ty, a, b, m) {
    R(c, x, y, TS, TS, m);
    for (let r = 0; r < 4; r++) {
      const off = (r + ty) % 2 ? 4 : 0;
      for (let k = -1; k < 2; k++) { const bx = x + k * 8 + off; R(c, Math.max(x, bx), y + r * 4, Math.min(7, bx + 7 - Math.max(x, bx)), 3, U.hash(tx * 3 + k, ty * 4 + r, 7) > 0.5 ? a : b); }
    }
  }
  function drawBg(c, w, b, tx, ty) {
    const x = tx * TS, y = ty * TS, B = G.B;
    const floorBelow = G.TILES[w.get(tx, ty + 1)].solid && w.getBg(tx, ty + 1) !== b;
    switch (b) {
      case B.NONE: return;
      case B.SALA: R(c, x, y, TS, TS, '#cdbf9f'); for (let i = 2; i < TS; i += 6) R(c, x + i, y, 1, TS, '#c2b392'); break;
      case B.QUARTO: R(c, x, y, TS, TS, '#a9b9c9'); for (let i = 0; i < TS; i += 8) R(c, x + i + 3, y + ((ty % 2) * 8) + 3, 1, 1, '#98a9ba'); break;
      case B.COZINHA: R(c, x, y, TS, TS, '#e3dccb'); R(c, x, y + 7, TS, 1, '#cfc7b5'); R(c, x + 7, y, 1, TS, '#cfc7b5'); R(c, x, y + 15, TS, 1, '#cfc7b5'); R(c, x + 15, y, 1, TS, '#cfc7b5'); break;
      case B.BRICK: brick(c, x, y, tx, ty, '#6e3426', '#7c3d2d', '#8f8170'); break;
      case B.CONCRETE: R(c, x, y, TS, TS, '#6f7378'); break;
      case B.BANHEIRO: R(c, x, y, TS, TS, '#d3e8e4'); R(c, x + 7, y, 1, TS, '#b8d3ce'); R(c, x, y + 7, TS, 1, '#b8d3ce'); break;
      case B.CORREDOR: R(c, x, y, TS, TS, '#b8ac93'); if (ty % 4 === 1) R(c, x, y + 12, TS, 2, '#9c8f76'); break;
      case B.PADARIA: R(c, x, y, TS, TS, '#ead4aa'); if (floorBelow || ty === 37) { R(c, x, y + 6, TS, 10, '#f3f0e8'); R(c, x + 7, y + 6, 1, 10, '#d6d2c8'); R(c, x, y + 11, TS, 1, '#d6d2c8'); } break;
      case B.STONE: R(c, x, y, TS, TS, '#3d3f43'); break;
      case B.DIRT: R(c, x, y, TS, TS, '#47301f'); break;
      case B.LOBBY: R(c, x, y, TS, TS, '#c9c4ba'); if (ty === 37) R(c, x, y + 6, TS, 10, '#6b5e52'); R(c, x + (tx % 3) * 5, y + 4, 1, 1, '#b5afa4'); break;
      default: R(c, x, y, TS, TS, '#555');
    }
    if (floorBelow && b !== B.PADARIA && b !== B.LOBBY && b !== B.STONE && b !== B.DIRT) R(c, x, y + 13, TS, 3, '#6b5440');
    // escurece a parede de fundo para separar dos blocos da frente
    c.save(); c.globalAlpha = 0.22; R(c, x, y, TS, TS, '#000'); c.restore();
  }

  /* --------------------- céu --------------------- */
  const SKY = [
    // [minuto, topo, base]
    [0, '#070b1e', '#141a3a'], [300, '#0b1030', '#1d2550'], [360, '#3a3f78', '#e58e6b'], [420, '#7fb6e0', '#f3d2a2'],
    [540, '#6fb2e8', '#cbe7f5'], [960, '#76b4e4', '#d5ebf5'], [1050, '#6d7fc4', '#f2b177'], [1110, '#3b3470', '#d9785d'],
    [1170, '#141a3e', '#3a2e5a'], [1260, '#070b1e', '#141a3a'], [1440, '#070b1e', '#141a3a'],
  ];
  function lerpColor(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(U.lerp(pa >> 16, pb >> 16, t)), g = Math.round(U.lerp((pa >> 8) & 255, (pb >> 8) & 255, t)), bl = Math.round(U.lerp(pa & 255, pb & 255, t));
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }
  G.skyAt = function (min) {
    const m = ((min % 1440) + 1440) % 1440;
    for (let i = 0; i < SKY.length - 1; i++) {
      const a = SKY[i], b = SKY[i + 1];
      if (m >= a[0] && m <= b[0]) { const t = (m - a[0]) / (b[0] - a[0]); return [lerpColor(a[1], b[1], t), lerpColor(a[2], b[2], t)]; }
    }
    return [SKY[0][1], SKY[0][2]];
  };
  /** 0 = dia claro, 1 = noite fechada. */
  G.nightAt = function (min) {
    const m = ((min % 1440) + 1440) % 1440;
    if (m < 330) return 1; if (m < 420) return 1 - (m - 330) / 90;
    if (m < 1050) return 0; if (m < 1170) return (m - 1050) / 120; return 1;
  };

  class Renderer {
    constructor(game) {
      this.g = game;
      this.canvas = document.getElementById('game');
      this.canvas.width = VW; this.canvas.height = VH;
      this.ctx = this.canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;
      this.cam = { x: 0, y: 0 }; this.camF = { x: 0, y: 0 };
      this.shakeT = 0; this.shakeA = 0;
      this.freezeTarget = null; this.freezeAmt = 0; this.freezeGoal = 0;
      this.desat = 0; this.glitchT = 0; this.ripples = []; this.sepia = 0;
      [this.lightCv, this.lctx] = mkCanvas(VW, VH);
      this.clouds = [];
      for (let i = 0; i < 7; i++) this.clouds.push({ x: Math.random() * 1400, y: 10 + Math.random() * 70, w: 30 + Math.random() * 50, s: 2 + Math.random() * 4 });
      this.buildSkyline();
      this.time = 0;
    }

    buildSkyline() {
      const make = (seed, hMin, hMax, colDay, colNight, lit) => {
        const W = 1440, H = 200;
        const [cd, xd] = mkCanvas(W, H); const [cn, xn] = mkCanvas(W, H);
        let x = 0, i = 0;
        while (x < W) {
          const bw = 24 + Math.floor(U.hash(i, seed, 1) * 46), bh = hMin + Math.floor(U.hash(i, seed, 2) * (hMax - hMin));
          R(xd, x, H - bh, bw - 2, bh, colDay); R(xn, x, H - bh, bw - 2, bh, colNight);
          for (let wy = H - bh + 5; wy < H - 6; wy += 7) for (let wx = x + 3; wx < x + bw - 6; wx += 5) {
            R(xd, wx, wy, 2, 3, 'rgba(255,255,255,0.12)');
            if (U.hash(wx, wy, seed) < lit) R(xn, wx, wy, 2, 3, U.hash(wy, wx, seed) > 0.3 ? '#ffd98a' : '#bfe0ff');
          }
          if (U.hash(i, seed, 5) > 0.75) { R(xd, x + bw / 2 - 1, H - bh - 8, 1, 8, colDay); R(xn, x + bw / 2 - 1, H - bh - 8, 1, 8, colNight); R(xn, x + bw / 2 - 1, H - bh - 9, 1, 1, '#ff4d4d'); }
          x += bw; i++;
        }
        return { day: cd, night: cn, W, H };
      };
      this.farSky = make(11, 50, 150, '#8fa7bd', '#151a33', 0.25);
      this.midSky = make(23, 30, 110, '#6f8aa3', '#0f1428', 0.35);
    }

    initWorld(world) {
      [this.bgCv, this.bgx] = mkCanvas(world.w * TS, world.h * TS);
      [this.fgCv, this.fgx] = mkCanvas(world.w * TS, world.h * TS);
      for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) this.redrawTile(world, x, y);
      world.dirty = [];
    }
    redrawTile(w, x, y) {
      this.fgx.clearRect(x * TS, y * TS, TS, TS);
      this.bgx.clearRect(x * TS, y * TS, TS, TS);
      drawBg(this.bgx, w, w.getBg(x, y), x, y);
      drawTile(this.fgx, w, w.get(x, y), x, y);
    }
    flushDirty(w) {
      if (!w.dirty.length) return;
      const seen = new Set();
      for (let i = 0; i < w.dirty.length; i += 2) {
        const x = w.dirty[i], y = w.dirty[i + 1];
        for (const [dx, dy] of [[0, 0], [0, 1], [0, -1]]) {
          const k = (x + dx) + ',' + (y + dy);
          if (seen.has(k) || !w.inb(x + dx, y + dy)) continue;
          seen.add(k); this.redrawTile(w, x + dx, y + dy);
        }
      }
      w.dirty = [];
    }

    screenToWorld(sx, sy) { return { x: sx + this.cam.x, y: sy + this.cam.y }; }

    /* ----- efeitos acionados pelo jogo ----- */
    shake(a) { if (!this.g.settings.shake) return; this.shakeA = Math.max(this.shakeA, a); this.shakeT = 0.3; }
    freezeOn(p) { this.freezeTarget = p; this.freezeGoal = 1; }
    freezeOff() { this.freezeGoal = 0; }
    glitch(t) { if (!this.g.settings.reduceFlashes) this.glitchT = Math.max(this.glitchT, t); }
    timeRipple(x, y) { this.ripples.push({ x, y, t: 0 }); this.sepia = this.g.settings.reduceFlashes ? 0.15 : 0.35; }
    stars() { this.starsT = 1.6; }

    snapCamera() {
      const p = this.g.player;
      this.camF.x = p.cx - VW / 2; this.camF.y = p.cy - VH / 2 - 20;
      this.clampCam(); this.cam.x = Math.round(this.camF.x); this.cam.y = Math.round(this.camF.y);
    }
    clampCam() {
      const w = this.g.world, p = this.g.player;
      const a = w.areaAt(p.cx, p.cy);
      const maxY = a && a.id === 'banheiro' ? w.h * TS - VH : (38 + 2) * TS + 8 - VH;
      this.camF.x = U.clamp(this.camF.x, 0, w.w * TS - VW);
      this.camF.y = U.clamp(this.camF.y, 0, maxY);
    }

    update(dt) {
      this.time += dt;
      const p = this.g.player;
      const look = p.pose ? 0 : p.facing * 18 + p.vx * 0.15;
      const tx = p.cx + look - VW / 2, ty = p.cy - VH / 2 - 20;
      const k = 1 - Math.exp(-dt * 6);
      this.camF.x += (tx - this.camF.x) * k;
      this.camF.y += (ty - this.camF.y) * (1 - Math.exp(-dt * 5));
      this.clampCam();
      let sx = 0, sy = 0;
      if (this.shakeT > 0) { this.shakeT -= dt; sx = U.rand(-1, 1) * this.shakeA; sy = U.rand(-1, 1) * this.shakeA; if (this.shakeT <= 0) this.shakeA = 0; }
      this.cam.x = Math.round(this.camF.x + sx); this.cam.y = Math.round(this.camF.y + sy);
      this.freezeAmt = U.approach(this.freezeAmt, this.freezeGoal, dt * 2.5);
      if (this.freezeAmt <= 0) this.freezeTarget = this.freezeGoal ? this.freezeTarget : null;
      if (this.glitchT > 0) this.glitchT -= dt;
      if (this.sepia > 0) this.sepia = Math.max(0, this.sepia - dt * 0.6);
      if (this.starsT > 0) this.starsT -= dt;
      for (const r of this.ripples) r.t += dt;
      this.ripples = this.ripples.filter((r) => r.t < 0.9);
      for (const c of this.clouds) { c.x += c.s * dt; if (c.x > 1500) c.x = -80; }
    }

    /* =================== desenho do quadro =================== */
    render() {
      const g = this.g, c = this.ctx, cam = this.cam;
      if (!g.world) return;
      this.flushDirty(g.world);
      const min = g.clock.min;
      const night = G.nightAt(min);
      const env = { cam, night, flags: g.flags, time: this.time, lampOn: !!g.flags.luz_sala, g };
      const ps = g.powers;
      const perc = ps && ps.perceive;

      // céu
      const [top, bot] = G.skyAt(min);
      const grad = c.createLinearGradient(0, 0, 0, VH);
      grad.addColorStop(0, top); grad.addColorStop(1, bot);
      c.fillStyle = grad; c.fillRect(0, 0, VW, VH);
      this.drawSkyBodies(c, min, night);
      // paralaxe
      const groundY = 38 * TS - cam.y;
      this.drawLayer(c, this.farSky, 0.12, groundY - 30, night);
      this.drawLayer(c, this.midSky, 0.3, groundY - 6, night);

      // o que há atrás das paredes (só aparece com Percepção)
      if (perc) {
        for (const [id, reg] of Object.entries(g.regions)) {
          if (!reg.scene || !reg.perceivable || ps.blockedRegions.has(id)) continue;
          if (perc.x + perc.r < reg.x || perc.x - perc.r > reg.x + reg.w || perc.y + perc.r < reg.y || perc.y - perc.r > reg.y + reg.h) continue;
          this.drawScene(c, cam, reg);
        }
      }

      // parede de fundo
      this.drawWorldLayer(c, this.bgCv, perc, 0.15);
      // decoração
      for (const d of g.decor) {
        const x = d.x - cam.x, y = d.y - cam.y;
        if (x > VW + 80 || y > VH + 80 || x + d.w < -80 || y + d.h < -80) continue;
        G.Sprites.decor(c, d, x, y, env);
      }
      // janelas da fachada acesas à noite
      if (night > 0.2) this.drawFacadeLights(c, cam, night);
      // atendente atrás do balcão já está desenhado por cima do balcão? (desenha antes dos blocos)
      // blocos da frente
      this.drawWorldLayer(c, this.fgCv, perc, 0.35);
      // escada do prédio
      this.drawStairs(c, cam);

      // pickups
      for (const pk of g.pickups) {
        if (!pk.visible(g)) continue;
        const x = Math.round(pk.x - cam.x), y = Math.round(pk.y - cam.y + Math.sin(this.time * 3 + pk.bob) * 1);
        if (pk.item === 'chave_terraco') { R(c, x, y, 3, 3, '#d4b16a'); R(c, x + 3, y + 1, 3, 1, '#d4b16a'); }
        else { R(c, x, y, 8, 8, '#e9dfc9'); R(c, x + 1, y + 2, 6, 1, '#8a7a5a'); R(c, x + 1, y + 4, 5, 1, '#8a7a5a'); R(c, x + 7, y, 1, 8, '#c9b98f'); }
        if (Math.random() < 0.05) g.particles.spark(pk.x + 3, pk.y, '#fff3c4');
      }

      // pessoas atrás do balcão
      for (const n of g.npcs) if (n.behind && n.visibleNow) this.drawNPC(c, n, cam);
      // balcões por cima de quem está atrás deles
      for (const d of g.decor) if (d.front) G.Sprites.decor(c, d, d.x - cam.x, d.y - cam.y, env);

      // objetos
      for (const p of g.props) {
        if (p.removed) continue;
        if (p.hidden && !p.perceived) continue;
        if (p === this.freezeTarget && this.freezeAmt > 0) continue;
        const x = p.x - cam.x, y = p.y - cam.y;
        if (x > VW + 60 || x < -80 || y > VH + 60 || y < -80) continue;
        G.Sprites.prop(c, p, x, y, env);
      }
      // pessoas e animais
      for (const n of g.npcs) if (!n.behind && n.visibleNow) this.drawNPC(c, n, cam);
      for (const pg of g.pigeons) G.Sprites.pigeon(c, Math.round(pg.x - cam.x), Math.round(pg.y - cam.y), pg.fly, pg.t, pg.dir);

      // V
      this.drawPlayer(c, cam);
      // efeitos dos poderes
      this.drawPowerFx(c, cam, env);
      g.particles.draw(c, cam);
      if (g.sequence) g.sequence.draw(c, cam);

      // luz
      this.drawLighting(c, cam, night, env);

      // pós-processamento
      const desat = Math.max(this.freezeAmt * 0.85, this.desat);
      if (desat > 0.01) {
        c.save();
        c.globalCompositeOperation = 'saturation'; c.globalAlpha = Math.min(1, desat); c.fillStyle = '#808080'; c.fillRect(0, 0, VW, VH);
        c.globalCompositeOperation = 'source-over'; c.globalAlpha = desat * 0.12; c.fillStyle = '#7da7d9'; c.fillRect(0, 0, VW, VH);
        c.restore();
      }
      if (this.freezeTarget && this.freezeAmt > 0) this.drawFrozen(c, cam, env);
      if (this.sepia > 0) { c.save(); c.globalAlpha = this.sepia; c.globalCompositeOperation = 'overlay'; c.fillStyle = '#c99a50'; c.fillRect(0, 0, VW, VH); c.restore(); }
      for (const r of this.ripples) {
        c.save(); c.strokeStyle = '#ffd27a'; c.globalAlpha = 1 - r.t / 0.9;
        for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(r.x - cam.x, r.y - cam.y, r.t * 90 + i * 9, 0, Math.PI * 2); c.stroke(); }
        c.restore();
      }
      this.drawTensionFx(c);
      if (this.desat > 0.05) this.vignette(c, this.desat * 0.7, '0,0,0');
      if (this.glitchT > 0) this.doGlitch(c);
    }

    drawSkyBodies(c, min, night) {
      const m = ((min % 1440) + 1440) % 1440;
      // estrelas
      if (night > 0.05) {
        c.save(); c.globalAlpha = night;
        for (let i = 0; i < 60; i++) {
          const x = (U.hash(i, 1, 9) * VW * 2 - this.cam.x * 0.02) % VW, y = U.hash(i, 2, 9) * 140;
          R(c, (x + VW) % VW, y, 1, 1, U.hash(i, 3, 9) > 0.9 ? '#ffe9b0' : '#ffffff');
        }
        c.restore();
      }
      // sol / lua
      const sunT = (m - 360) / (1110 - 360);
      if (sunT > -0.05 && sunT < 1.05) {
        const x = 30 + sunT * (VW - 60), y = 150 - Math.sin(Math.PI * U.clamp(sunT, 0, 1)) * 120;
        c.fillStyle = '#fff1b8'; c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 0.25; c.beginPath(); c.arc(x, y, 15, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
      }
      const mm = m < 360 ? m + 1440 : m;
      const moonT = (mm - 1140) / (1800 - 1140);
      if (moonT > 0 && moonT < 1) {
        const x = 30 + moonT * (VW - 60), y = 150 - Math.sin(Math.PI * moonT) * 110;
        c.fillStyle = '#e8ecf5'; c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(160,170,190,0.6)'; R(c, x - 2, y - 2, 2, 2, 'rgba(160,170,190,0.6)'); R(c, x + 2, y + 1, 1, 1, 'rgba(160,170,190,0.6)');
      }
      // nuvens
      c.save(); c.globalAlpha = 0.55 - night * 0.35;
      for (const cl of this.clouds) {
        const x = Math.round(cl.x - this.cam.x * 0.05) % 1500 - 60;
        c.fillStyle = night > 0.5 ? '#3a4366' : '#ffffff';
        R(c, x, cl.y, cl.w, 6, c.fillStyle); R(c, x + 6, cl.y - 4, cl.w * 0.5, 5, c.fillStyle); R(c, x + cl.w * 0.4, cl.y - 6, cl.w * 0.35, 7, c.fillStyle);
      }
      c.restore();
    }

    drawLayer(c, L, f, baseY, night) {
      const off = -((this.cam.x * f) % L.W);
      const y = Math.round(baseY - L.H);
      for (let k = -1; k < 2; k++) {
        const x = Math.round(off + k * L.W);
        if (x > VW || x + L.W < 0) continue;
        c.drawImage(L.day, x, y);
        if (night > 0) { c.globalAlpha = night; c.drawImage(L.night, x, y); c.globalAlpha = 1; }
      }
    }

    /** Desenha uma camada do mundo; com Percepção ativa, fica translúcida dentro do círculo. */
    drawWorldLayer(c, cv, perc, alphaIn) {
      const cam = this.cam;
      if (!perc) { c.drawImage(cv, cam.x, cam.y, VW, VH, 0, 0, VW, VH); return; }
      const px = perc.x - cam.x, py = perc.y - cam.y;
      c.save();
      c.beginPath(); c.rect(0, 0, VW, VH); c.arc(px, py, perc.r, 0, Math.PI * 2, true); c.clip('evenodd');
      c.drawImage(cv, cam.x, cam.y, VW, VH, 0, 0, VW, VH);
      c.restore();
      c.save();
      c.beginPath(); c.arc(px, py, perc.r, 0, Math.PI * 2); c.clip();
      c.globalAlpha = alphaIn;
      c.drawImage(cv, cam.x, cam.y, VW, VH, 0, 0, VW, VH);
      c.restore();
    }

    /** Interiores revelados pela Percepção. Moradores e cenas são conteúdo original do jogo,
     *  exceto o vizinho de cueca (cap. 2) e o barulho de arrastar do vizinho de cima (cap. 1). */
    drawScene(c, cam, r) {
      const x = r.x - cam.x, y = r.y - cam.y, t = this.time, H = G.Sprites.human;
      const pal = (o) => Object.assign({ skin: '#e2b48f', skinS: '#c08f6b', hair: '#4a3a2a', shirt: '#5d6d7e', shirtS: '#4a5866', pants: '#34495e', pantsS: '#2c3e50', shoe: '#222', eye: '#222', belt: '#333' }, o);
      const floor = y + r.h;
      switch (r.scene) {
        case 'vizinho':
          R(c, x, y, r.w, r.h, '#8f8269'); for (let i = 0; i < r.w; i += 10) R(c, x + i, y, 1, r.h, '#857860');
          R(c, x + 4, floor - 10, 34, 10, '#6b5040'); R(c, x + 5, floor - 13, 32, 4, '#d8d0c0'); R(c, x + 50, y + 8, 14, 10, '#3d5a73');
          H(c, x + 40, floor - 26, { facing: -1, state: 'idle', t, shirtless: true, pal: pal({ shirt: '#e2b48f', shirtS: '#c08f6b', pants: '#f4f4f4', pantsS: '#e0e0e0', shoe: '#e2b48f', hair: '#6b5a4a', belt: '#f4f4f4' }) });
          break;
        case 'apto11': // senhora vendo novela
          R(c, x, y, r.w, r.h, '#a7b88f'); R(c, x + 8, floor - 14, 26, 14, '#7b4b3a'); R(c, x + 10, floor - 18, 22, 6, '#8c5a48');
          R(c, x + 60, floor - 20, 18, 14, '#111'); R(c, x + 61, floor - 19, 16, 10, Math.sin(t * 3) > 0 ? '#c0587e' : '#d07090');
          H(c, x + 16, floor - 26 - 6, { facing: 1, state: 'sit', t, pal: pal({ hair: '#cfcfcf', shirt: '#8e6fb3', shirtS: '#6f548f' }), hairStyle: 'bun' });
          R(c, x + 30, floor - 10, 4, 10, '#7b4b3a');
          break;
        case 'apto12': // família jantando feijão
          R(c, x, y, r.w, r.h, '#e3c79a'); R(c, x + 18, floor - 13, 50, 2, '#8a5a2b'); R(c, x + 22, floor - 11, 2, 11, '#6a4220'); R(c, x + 62, floor - 11, 2, 11, '#6a4220');
          R(c, x + 32, floor - 16, 6, 3, '#4a2a14'); R(c, x + 46, floor - 16, 6, 3, '#f1f1f1');
          H(c, x + 10, floor - 26, { facing: 1, state: 'idle', t, pal: pal({ shirt: '#2e86c1' }), gesture: Math.sin(t * 4) > 0.5 ? 2 : 0 });
          H(c, x + 70, floor - 26, { facing: -1, state: 'idle', t: t + 2, pal: pal({ shirt: '#c0392b', hair: '#111', skin: '#8d5a3b', skinS: '#6e432a' }), hairStyle: 'long' });
          H(c, x + 40, floor - 22, { facing: 1, state: 'idle', t: t + 4, pal: pal({ shirt: '#27ae60' }) });
          break;
        case 'apto31': { // o vizinho de cima arrastando... alguma coisa coberta (o romance nunca diz o que é)
          R(c, x, y, r.w, r.h, '#6e6a80'); const k = (Math.sin(t * 0.8) + 1) / 2;
          const ox = x + 20 + k * 40;
          R(c, ox, floor - 14, 18, 14, '#d9d4c7'); R(c, ox + 2, floor - 15, 14, 2, '#cfc9ba'); R(c, ox - 1, floor - 2, 20, 2, '#bdb7a8');
          H(c, ox + 20, floor - 26, { facing: -1, state: 'walk', t: t * 0.6, pal: pal({ shirt: '#7f8c8d', hair: '#2c2c2c' }) });
          if (Math.sin(t * 9) > 0.7) R(c, ox - 4, floor - 1, 2, 1, '#fff');
          break;
        }
        case 'apto32': // vazio: caixas e poeira
          R(c, x, y, r.w, r.h, '#4b4f58'); R(c, x + 12, floor - 10, 12, 10, '#a0825a'); R(c, x + 26, floor - 8, 10, 8, '#8c6f48'); R(c, x + 15, floor - 18, 9, 8, '#a0825a');
          R(c, x + 60, y + 6, 14, 10, '#2b2e35'); for (let i = 0; i < 6; i++) R(c, x + 40 + ((t * 6 + i * 13) % 40), y + 10 + i * 6, 1, 1, 'rgba(255,255,255,0.3)');
          break;
        default: break;
      }
    }

    /** Lances da escada: degraus de madeira desenhados sobre as lajes. */
    drawStairs(c, cam) {
      for (const s of this.g.stairs || []) {
        const n = 8, dx = (s.x1 - s.x0) / n, dy = (s.y0 - s.y1) / n;
        for (let i = 0; i < n; i++) {
          const sx = s.x0 + dx * i + (dx > 0 ? 0 : dx) + 5 - cam.x, sy = s.y0 - dy * (i + 1) - cam.y;
          R(c, sx - 3, sy, Math.abs(dx) + 6, 2, '#a87444'); R(c, sx - 3, sy + 2, Math.abs(dx) + 6, dy - 2, 'rgba(70,45,24,0.85)');
        }
        // corrimão
        c.save(); c.strokeStyle = '#5c3b1c'; c.lineWidth = 1; c.beginPath();
        c.moveTo(s.x0 + 5 - cam.x, s.y0 - 14 - cam.y); c.lineTo(s.x1 + 5 - cam.x, s.y1 - 14 - cam.y); c.stroke(); c.restore();
      }
    }

    drawFacadeLights(c, cam, night) {
      c.save(); c.globalAlpha = Math.min(1, night * 1.2);
      for (let ty = 26; ty <= 33; ty++) for (let tx = 103; tx <= 123; tx++) {
        const wx = (tx - 103) % 4, wy = (ty - 26) % 4;
        if (wx !== 1 || wy !== 1) continue;
        if (U.hash(tx, ty, 77) > 0.55) continue;
        const x = tx * TS - cam.x, y = ty * TS - cam.y;
        if (x < -40 || x > VW || y < -40 || y > VH) continue;
        R(c, x + 2, y + 2, 28, 28, U.hash(tx, ty, 78) > 0.4 ? 'rgba(255,214,140,0.85)' : 'rgba(170,210,255,0.8)');
      }
      c.restore();
    }

    drawNPC(c, n, cam) {
      const x = Math.round(n.x - cam.x), y = Math.round(n.y - cam.y);
      if (x < -40 || x > VW + 40) return;
      const base = { skin: '#c68e64', skinS: '#a46f48', hair: '#2a1b14', shirt: '#4a8a5a', shirtS: '#356b43', pants: '#3b3b48', pantsS: '#2b2b36', shoe: '#2b2b2b', eye: '#1a1010', belt: '#3a2a1a' };
      const st = n.moving ? 'walk' : 'idle';
      switch (n.kind) {
        case 'passeador':
          G.Sprites.human(c, x, y, { facing: n.facing, state: st, t: n.anim / 9, pal: base, seed: 1 });
          G.Sprites.dog(c, Math.round(n.dog.x - cam.x), Math.round(n.dog.y - cam.y), n.dog.dir, n.dog.anim);
          c.strokeStyle = '#c0392b'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + (n.facing > 0 ? 8 : 2), y + 15); c.lineTo(Math.round(n.dog.x - cam.x) + (n.dog.dir > 0 ? 9 : 3), Math.round(n.dog.y - cam.y) + 1); c.stroke();
          break;
        case 'moto':
          if (n.alpha <= 0) return;
          c.save(); c.globalAlpha = n.alpha; G.Sprites.moto(c, x, y, n.facing, n.anim, n.hop || 0); c.restore();
          break;
        case 'senhora':
          G.Sprites.human(c, x, y - 2, { facing: 1, state: 'idle', t: n.t, pal: Object.assign({}, base, { skin: '#e0b896', skinS: '#c39a78', hair: '#cfcfcf', shirt: '#7d5a8c', shirtS: '#5e4269', shoe: '#5a3d2b' }), hairStyle: 'bun', dress: '#6b4a7a', handOnBag: n.anim > 0 ? 1 : 0, seed: 3 });
          R(c, x + 6, y + 13, 4, 5, '#8e4b2c');
          break;
        case 'casal_a':
          G.Sprites.human(c, x, y, { facing: 1, state: 'idle', t: n.t, pal: Object.assign({}, base, { shirt: '#b03a48', shirtS: '#8a2c38', hair: '#5a3a22' }), hairStyle: 'long', gesture: n.sayT > 0 ? Math.round(Math.abs(n.anim) * 3) : 0, seed: 4 });
          break;
        case 'casal_b':
          G.Sprites.human(c, x, y, { facing: -1, state: 'idle', t: n.t, pal: Object.assign({}, base, { skin: '#8d5a3b', skinS: '#6e432a', shirt: '#2e6f8e', shirtS: '#235a73', hair: '#111' }), gesture: n.sayT > 0 ? Math.round(Math.abs(n.anim) * 3) : 0, seed: 5 });
          break;
        case 'crianca': {
          const jump = n.anim > 0.6 ? 2 : 0;
          c.save(); c.translate(x + 5, y + n.h - jump); c.scale(0.7, 0.7);
          G.Sprites.human(c, -5, -26, { facing: n.facing, state: 'idle', t: n.t, pal: Object.assign({}, base, { skin: '#c68e64', shirt: '#f39c12', shirtS: '#d68910', pants: '#2e86c1', pantsS: '#21618c', hair: '#3b2416' }), seed: 7, gesture: n.anim > 0.3 ? 4 : 0 });
          c.restore();
          break;
        }
        case 'porteiro':
          G.Sprites.human(c, x, y, { facing: n.facing, state: 'idle', t: n.t, pal: Object.assign({}, base, { skin: '#a9714b', skinS: '#8a5a3a', shirt: '#34495e', shirtS: '#2c3e50', hair: '#d0d0d0' }), seed: 8 });
          break;
        case 'atendente':
          G.Sprites.human(c, x, y, { facing: 1, state: 'idle', t: n.t, pal: Object.assign({}, base, { shirt: '#d9d4c7', shirtS: '#bfb9aa', skin: '#d8a27a' }), apron: true, hairStyle: 'cap', seed: 6 });
          break;
        default: break;
      }
      if (n.alert > 0 && !(n.say && n.sayT > 0)) { R(c, x + 4, y - 10, 2, 5, '#ffd27a'); R(c, x + 4, y - 4, 2, 2, '#ffd27a'); }
      if (n.say && n.sayT > 0) {
        c.save(); c.font = '11px "VT323", monospace'; c.textAlign = 'center';
        const tw = Math.ceil(c.measureText(n.say).width) + 6;
        R(c, x + 5 - tw / 2, y - 13, tw, 10, 'rgba(255,255,255,0.9)');
        c.fillStyle = '#222'; c.fillText(n.say, x + 5, y - 5); c.restore();
      }
    }

    drawPlayer(c, cam) {
      const g = this.g, p = g.player;
      if (g.backdrop || !g.powers) return;
      const x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y);
      const P = g.powers.def;
      let aim = null;
      if (p.powerAim) aim = { x: p.powerAim.x - cam.x, y: p.powerAim.y - cam.y };
      if (p.powerGlow > 0 || g.powers.held) {
        c.save(); c.globalAlpha = 0.18 * Math.max(p.powerGlow, g.powers.held ? 1 : 0);
        c.fillStyle = P ? P.color : '#9fd8ff'; c.beginPath(); c.arc(x + 5, y + 12, 16, 0, Math.PI * 2); c.fill(); c.restore();
      }
      G.Sprites.human(c, x, y, { facing: p.facing, state: p.running && p.state === 'walk' ? 'walk' : p.state, t: p.anim * (p.running ? 1.5 : 1), landT: p.landT, aim, carrying: !!p.carry, glow: p.powerGlow, glowColor: P ? P.color : '#9fd8ff', flash: g.powers.unravelT > 0 ? g.powers.unravelT : 0 });
      if (p.state === 'stun' || this.starsT > 0) {
        for (let i = 0; i < 3; i++) {
          const a = this.time * 6 + i * 2.1;
          R(c, x + 5 + Math.cos(a) * 7, y - 2 + Math.sin(a) * 2, 2, 2, '#ffe66b');
        }
      }
      if (p.state === 'sleep' || (p.state === 'collapse' && Math.sin(this.time * 2) > 0)) {
        c.save(); c.fillStyle = '#dfe8ff'; c.font = '8px "Silkscreen", monospace'; c.fillText('z', x + 12, y + 10 - (this.time * 6 % 8)); c.restore();
      }
    }

    drawPowerFx(c, cam, env) {
      const g = this.g, ps = g.powers;
      if (!ps) return;
      const P = ps.def;
      const p = g.player;
      const hand = { x: p.cx + p.facing * 6 - cam.x, y: p.y + 11 - cam.y };
      const outline = (r, col, dash) => {
        c.save(); c.strokeStyle = col; c.lineWidth = 1; if (dash) c.setLineDash([2, 2]);
        c.strokeRect(Math.round(r.x - cam.x) - 0.5, Math.round(r.y - cam.y) - 0.5, Math.round(r.w) + 1, Math.round(r.h) + 1); c.restore();
      };
      const m = ps.mouseWorld();
      const showRange = P && g.canControl() && (ps.hover || ps.held || ps.deslocarSel);
      if (showRange) {
        c.save(); c.strokeStyle = P.color; c.globalAlpha = 0.12; c.setLineDash([3, 4]);
        c.beginPath(); c.arc(p.cx - cam.x, p.cy - 6 - cam.y, G.POWER_RANGE, 0, Math.PI * 2); c.stroke(); c.restore();
      }
      if (ps.hover && P) {
        const h = ps.hover.hitBox ? ps.hover.hitBox() : ps.hover;
        outline(h, P.color, true);
      }
      if (ps.held) {
        const q = ps.held;
        outline(q, '#bfe8ff', false);
        c.save(); c.strokeStyle = 'rgba(159,216,255,0.7)'; c.lineWidth = 1; c.beginPath();
        const steps = 10;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const x = U.lerp(hand.x, q.cx - cam.x, t), y = U.lerp(hand.y, q.cy - cam.y, t) + Math.sin(t * Math.PI * 3 + this.time * 12) * 2 * Math.sin(t * Math.PI);
          if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.stroke(); c.restore();
      }
      if (ps.deslocarSel) {
        const q = ps.deslocarSel;
        outline(q, '#c39bff', true);
        const t = G.POWERS.deslocar.target(ps, g, m.x, m.y);
        c.save(); c.globalAlpha = 0.6; c.strokeStyle = t.ok ? '#c39bff' : '#ff5e7a'; c.setLineDash([2, 2]);
        c.strokeRect(t.r.x - cam.x - 0.5, t.r.y - cam.y - 0.5, t.r.w + 1, t.r.h + 1); c.restore();
      }
      if (P && P.id === 'criar' && g.canControl()) {
        const t = G.POWERS.criar.target(ps, g, m.x, m.y);
        c.save(); c.globalAlpha = 0.45; R(c, t.r.x - cam.x, t.r.y - cam.y, t.r.w, t.r.h, t.ok ? '#ffb347' : '#ff5e7a'); c.restore();
      }
      if (P && P.id === 'teleporte' && g.canControl()) {
        const t = G.POWERS.teleporte.target(ps, g, m.x, m.y);
        c.save(); c.globalAlpha = 0.35; c.strokeStyle = t.ok ? '#ff7ad9' : '#ff5e7a'; c.setLineDash([2, 2]);
        c.strokeRect(t.r.x - cam.x - 0.5, t.r.y - cam.y - 0.5, t.r.w + 1, t.r.h + 1); c.restore();
      }
      if (ps.perceive) {
        const pr = ps.perceive;
        c.save(); c.strokeStyle = 'rgba(111,224,255,0.8)'; c.beginPath(); c.arc(pr.x - cam.x, pr.y - cam.y, pr.r, 0, Math.PI * 2); c.stroke();
        c.globalAlpha = 0.08; c.fillStyle = '#6fe0ff'; c.beginPath(); c.arc(pr.x - cam.x, pr.y - cam.y, pr.r, 0, Math.PI * 2); c.fill(); c.restore();
        // contornos dos escondidos já percebidos
        for (const q of g.props) if (q.hidden && q.perceived && U.dist(q.cx, q.cy, pr.x, pr.y) < pr.r + 10) outline(q, '#6fe0ff', true);
        for (const pk of g.pickups) if (pk.hiddenBehind && !pk.taken && U.dist(pk.x, pk.y, pr.x, pr.y) < pr.r) outline(pk, '#ffe9b0', true);
      }
      for (const q of g.props) if (q.restoring) {
        c.save(); c.globalAlpha = 0.5; c.strokeStyle = '#ffd27a'; c.beginPath(); c.arc(q.cx - cam.x, q.cy - cam.y, 6 + Math.sin(this.time * 20) * 2, 0, Math.PI * 2); c.stroke(); c.restore();
      }
    }

    drawFrozen(c, cam, env) {
      const p = this.freezeTarget;
      const x = p.x - cam.x, y = p.y - cam.y;
      c.save(); c.globalAlpha = 0.35 * this.freezeAmt; c.fillStyle = '#bfe8ff'; c.beginPath(); c.arc(x + p.w / 2, y + p.h / 2, 9 + Math.sin(this.time * 2) * 1.5, 0, Math.PI * 2); c.fill(); c.restore();
      G.Sprites.prop(c, p, x, y, env);
      // a gota suspensa logo abaixo da borda
      R(c, x + 4, y + 7, 1, 2, '#bfe8ff'); R(c, x + 4, y + 9, 1, 1, '#ffffff');
    }

    drawLighting(c, cam, night, env) {
      const g = this.g, L = this.lctx;
      const dark = night * 0.82;
      const lights = [];
      for (const li of g.lights) {
        let on = false, color = li.color;
        if (li.always) on = night > 0.02 || this.indoorLit(li);
        else if (li.flag === 'abajur') { on = !!(g.flags.abajurOn || g.flags.abajurGlow); color = g.flags.abajurCor || '255,226,170'; }
        else if (li.flag) on = !!g.flags[li.flag];
        else if (li.night) on = night > 0.25 && (!li.prop || (g.propById(li.prop) && !g.propById(li.prop).broken));
        else if (li.shop) on = G.padariaAberta(g);
        if (on) lights.push({ x: li.x, y: li.y, r: li.r, color, k: li.flag === 'abajur' && !g.flags.abajurOn ? 0.5 : 1 });
      }
      if (g.flags.tvOn) { const tv = g.decor.find((d) => d.type === 'tv'); if (tv) lights.push({ x: tv.x + 7, y: tv.y + 5, r: 30, color: '120,170,255', k: 0.7 }); }
      const p = g.player;
      const heldP = g.powers && g.powers.held;
      if (!g.backdrop && (p.powerGlow > 0 || heldP)) lights.push({ x: p.cx, y: p.cy - 4, r: 34, color: '159,216,255', k: 0.7 });
      if (heldP) lights.push({ x: g.powers.held.cx, y: g.powers.held.cy, r: 18, color: '159,216,255', k: 0.6 });
      if (this.freezeTarget && this.freezeAmt > 0) lights.push({ x: this.freezeTarget.cx, y: this.freezeTarget.cy, r: 24, color: '191,232,255', k: 0.8 });

      if (dark > 0.01) {
        L.globalCompositeOperation = 'source-over';
        L.clearRect(0, 0, VW, VH);
        L.fillStyle = 'rgba(6,8,26,' + dark.toFixed(3) + ')';
        L.fillRect(0, 0, VW, VH);
        L.globalCompositeOperation = 'destination-out';
        for (const l of lights) {
          const x = l.x - cam.x, y = l.y - cam.y;
          if (x < -l.r || y < -l.r || x > VW + l.r || y > VH + l.r) continue;
          const gr = L.createRadialGradient(x, y, 0, x, y, l.r);
          gr.addColorStop(0, 'rgba(0,0,0,' + (0.95 * l.k) + ')'); gr.addColorStop(0.6, 'rgba(0,0,0,' + (0.5 * l.k) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
          L.fillStyle = gr; L.beginPath(); L.arc(x, y, l.r, 0, Math.PI * 2); L.fill();
        }
        L.globalCompositeOperation = 'source-over';
        c.drawImage(this.lightCv, 0, 0);
      }
      // brilho colorido
      c.save(); c.globalCompositeOperation = 'lighter';
      for (const l of lights) {
        const x = l.x - cam.x, y = l.y - cam.y;
        if (x < -l.r || y < -l.r || x > VW + l.r || y > VH + l.r) continue;
        const a = (0.1 + dark * 0.18) * l.k;
        const gr = c.createRadialGradient(x, y, 0, x, y, l.r * 0.8);
        gr.addColorStop(0, 'rgba(' + l.color + ',' + a.toFixed(3) + ')'); gr.addColorStop(1, 'rgba(' + l.color + ',0)');
        c.fillStyle = gr; c.beginPath(); c.arc(x, y, l.r * 0.8, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }
    indoorLit() { return false; }

    drawTensionFx(c) {
      const ps = this.g.powers;
      if (!ps) return;
      const r = ps.ratio;
      if (r > 0.65) {
        const k = U.clamp((r - 0.65) / 0.35, 0, 1);
        this.vignette(c, k * 0.55, '120,60,170');
        if (!this.g.settings.reduceFlashes && Math.random() < k * 0.3) this.g.particles.line(Math.random() * VW + this.cam.x, 0, 'rgba(255,210,122,0.35)');
      }
    }
    vignette(c, a, rgb) {
      const gr = c.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VW * 0.62);
      gr.addColorStop(0, 'rgba(' + rgb + ',0)'); gr.addColorStop(1, 'rgba(' + rgb + ',' + a.toFixed(3) + ')');
      c.fillStyle = gr; c.fillRect(0, 0, VW, VH);
    }
    doGlitch(c) {
      const n = 5;
      for (let i = 0; i < n; i++) {
        const y = Math.floor(Math.random() * VH), h = 2 + Math.floor(Math.random() * 10), dx = Math.floor((Math.random() - 0.5) * 16);
        c.drawImage(this.canvas, 0, y, VW, h, dx, y, VW, h);
      }
      c.save(); c.globalAlpha = 0.08; c.fillStyle = Math.random() > 0.5 ? '#ff5e7a' : '#6fe0ff'; c.fillRect(0, 0, VW, VH); c.restore();
    }

    /** Desenha o cursor na tela (sobre tudo). */
    drawCursor() {
      const g = this.g, c = this.ctx, m = g.input.mouse;
      if (!m.inside || g.state !== 'playing' || g.ui.blocking()) return;
      const P = g.powers && g.powers.def;
      const col = P ? P.color : '#ffffff';
      const x = Math.round(m.sx), y = Math.round(m.sy);
      c.save();
      R(c, x - 4, y, 3, 1, col); R(c, x + 2, y, 3, 1, col); R(c, x, y - 4, 1, 3, col); R(c, x, y + 2, 1, 3, col);
      R(c, x, y, 1, 1, '#fff');
      c.restore();
    }
  }
  G.Renderer = Renderer;
})(window.VG = window.VG || {});

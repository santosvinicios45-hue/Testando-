/* =====================================================================
 * Mundo em blocos (tiles) + montagem do cenário da Etapa 1.
 * O mundo tem duas camadas: fg (blocos com colisão) e bg (paredes de
 * fundo, sem colisão). A Etapa 2 vai acrescentar mineração/construção
 * sobre esta mesma estrutura — por isso o World guarda o mapa base e
 * consegue gerar/aplicar "diffs" para o salvamento.
 * ===================================================================== */
(function (G) {
  'use strict';
  const TS = G.TILE;

  const T = G.T = {
    AIR: 0, DIRT: 1, STONE: 2, ASPHALT: 3, SIDEWALK: 4, BRICK: 5, CONCRETE: 6, WOOD: 7,
    TILEF: 8, PLATFORM: 10, DOOR_C: 11, DOOR_O: 12, GDOOR_C: 13, GDOOR_O: 14,
    HATCH_C: 15, HATCH_O: 16, RAIL: 17, GRASS: 18, BEDROCK: 19, FENCE: 20, MANHOLE: 21,
    GLASS: 22, ROOF: 23, GRAVEL: 24, FACADE: 25,
  };

  const def = (o) => Object.assign({ solid: false, oneWay: false, name: '?', toggle: null }, o);
  G.TILES = [];
  G.TILES[T.AIR] = def({ name: 'Ar' });
  G.TILES[T.DIRT] = def({ name: 'Terra', solid: true });
  G.TILES[T.STONE] = def({ name: 'Pedra', solid: true });
  G.TILES[T.ASPHALT] = def({ name: 'Asfalto', solid: true });
  G.TILES[T.SIDEWALK] = def({ name: 'Calçada', solid: true });
  G.TILES[T.BRICK] = def({ name: 'Tijolo', solid: true });
  G.TILES[T.CONCRETE] = def({ name: 'Concreto', solid: true });
  G.TILES[T.WOOD] = def({ name: 'Taco de madeira', solid: true });
  G.TILES[T.TILEF] = def({ name: 'Piso', solid: true });
  G.TILES[T.PLATFORM] = def({ name: 'Patamar', oneWay: true });
  G.TILES[T.DOOR_C] = def({ name: 'Porta (fechada)', solid: true, door: true, toggle: T.DOOR_O });
  G.TILES[T.DOOR_O] = def({ name: 'Porta (aberta)', door: true, toggle: T.DOOR_C });
  G.TILES[T.GDOOR_C] = def({ name: 'Porta de vidro (fechada)', solid: true, door: true, toggle: T.GDOOR_O });
  G.TILES[T.GDOOR_O] = def({ name: 'Porta de vidro (aberta)', door: true, toggle: T.GDOOR_C });
  G.TILES[T.HATCH_C] = def({ name: 'Alçapão (fechado)', solid: true, door: true, toggle: T.HATCH_O });
  G.TILES[T.HATCH_O] = def({ name: 'Alçapão (aberto)', oneWay: true, door: true, toggle: T.HATCH_C });
  G.TILES[T.RAIL] = def({ name: 'Grade', solid: true });
  G.TILES[T.GRASS] = def({ name: 'Grama', solid: true });
  G.TILES[T.BEDROCK] = def({ name: 'Rocha', solid: true });
  G.TILES[T.FENCE] = def({ name: 'Tapume', solid: true });
  G.TILES[T.MANHOLE] = def({ name: 'Bueiro', solid: true });
  G.TILES[T.GLASS] = def({ name: 'Vidro', solid: true });
  G.TILES[T.ROOF] = def({ name: 'Laje', solid: true });
  G.TILES[T.GRAVEL] = def({ name: 'Cascalho', solid: true });
  G.TILES[T.FACADE] = def({ name: 'Fachada', solid: true });

  const B = G.B = {
    NONE: 0, SALA: 1, QUARTO: 2, COZINHA: 3, BRICK: 4, CONCRETE: 5, BANHEIRO: 6,
    CORREDOR: 7, PADARIA: 8, STONE: 9, DIRT: 10, LOBBY: 11,
  };

  class World {
    constructor(w, h) {
      this.w = w; this.h = h;
      this.fg = new Uint8Array(w * h);
      this.bg = new Uint8Array(w * h);
      this.base = null; this.baseBg = null;
      this.dirty = [];
      this.areas = [];
    }
    inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    /** Fora do mapa: céu acima, rocha nas laterais e embaixo (o jogador nunca sai do mundo). */
    get(x, y) {
      if (!this.inb(x, y)) return y < 0 && x >= 0 && x < this.w ? T.AIR : T.BEDROCK;
      return this.fg[y * this.w + x];
    }
    set(x, y, t) {
      if (!this.inb(x, y)) return;
      const i = y * this.w + x;
      if (this.fg[i] !== t) { this.fg[i] = t; this.dirty.push(x, y); }
    }
    getBg(x, y) { return this.inb(x, y) ? this.bg[y * this.w + x] : B.NONE; }
    setBg(x, y, b) { if (this.inb(x, y)) { this.bg[y * this.w + x] = b; this.dirty.push(x, y); } }
    def(x, y) { return G.TILES[this.get(x, y)] || G.TILES[T.AIR]; }
    isSolid(x, y) { return this.def(x, y).solid; }
    fill(x1, y1, x2, y2, t) { for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) this.set(x, y, t); }
    fillBg(x1, y1, x2, y2, b) { for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) this.setBg(x, y, b); }

    /** Retângulo (px) livre de blocos sólidos? */
    rectFree(r) {
      const x0 = Math.floor(r.x / TS), x1 = Math.floor((r.x + r.w - 0.001) / TS);
      const y0 = Math.floor(r.y / TS), y1 = Math.floor((r.y + r.h - 0.001) / TS);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.isSolid(x, y)) return false;
      return r.x >= 0 && r.x + r.w <= this.w * TS && r.y + r.h <= this.h * TS;
    }

    snapshotBase() { this.base = this.fg.slice(); this.baseBg = this.bg.slice(); }
    /** Lista compacta [índice, valor, ...] das diferenças em relação ao mapa base. */
    diff() {
      const out = [];
      for (let i = 0; i < this.fg.length; i++) if (this.fg[i] !== this.base[i]) out.push(i, this.fg[i]);
      return out;
    }
    applyDiff(list) {
      if (!Array.isArray(list)) return;
      for (let k = 0; k + 1 < list.length; k += 2) {
        const i = list[k] | 0, v = list[k + 1] | 0;
        if (i >= 0 && i < this.fg.length && G.TILES[v]) {
          this.fg[i] = v; this.dirty.push(i % this.w, Math.floor(i / this.w));
        }
      }
    }
    areaAt(px, py) {
      const tx = px / TS, ty = py / TS;
      for (const a of this.areas) if (tx >= a.x && tx < a.x + a.w && ty >= a.y && ty < a.y + a.h) return a;
      return null;
    }
  }
  G.World = World;

  /* ===================================================================
   * Cenário da Etapa 1 (montado à mão, com pontos fixos da história).
   * Coordenadas em blocos. GR = linha do chão da rua.
   * =================================================================== */
  G.buildStage1 = function () {
    const W = 150, H = 50, GR = 38;
    const w = new World(W, H);
    const t = (n) => n * TS;

    // ---------- chão e subsolo ----------
    const surface = (x) => {
      if (x <= 29) return T.GRAVEL;
      if (x <= 60) return T.CONCRETE;
      if (x <= 63) return T.SIDEWALK;
      if (x <= 79) return T.ASPHALT;
      if (x <= 81) return T.SIDEWALK;
      if (x <= 99) return T.GRASS;
      if (x <= 101) return T.SIDEWALK;
      if (x <= 124) return T.CONCRETE;
      if (x <= 127) return T.SIDEWALK;
      if (x <= 143) return T.ASPHALT;
      return T.SIDEWALK;
    };
    for (let x = 0; x < W; x++) {
      w.set(x, GR, surface(x));
      for (let y = GR + 1; y <= GR + 3; y++) { w.set(x, y, T.DIRT); w.setBg(x, y, B.DIRT); }
      for (let y = GR + 4; y < H - 1; y++) { w.set(x, y, T.STONE); w.setBg(x, y, B.STONE); }
      w.set(x, H - 1, T.BEDROCK);
    }
    w.set(20, GR, T.MANHOLE); // bueiro (subterrâneo chega na Etapa 2)

    // tapume no limite esquerdo e barreira de obras no limite direito
    w.fill(0, 30, 1, GR - 1, T.FENCE);
    w.fill(147, 30, 149, GR - 1, T.FENCE);

    // ---------- banheiro do apartamento (cômodo isolado, acessado pela porta do hall) ----------
    w.fill(2, 43, 9, 45, T.AIR);
    w.fill(2, 46, 9, 46, T.TILEF);
    w.fillBg(2, 43, 9, 45, B.BANHEIRO);

    // ---------- Prédio de V (x 30..60) ----------
    w.fillBg(31, 35, 59, 37, B.LOBBY);
    w.fillBg(31, 31, 59, 33, B.CORREDOR);
    w.fillBg(31, 27, 37, 29, B.CORREDOR);
    w.fillBg(31, 23, 59, 25, B.CORREDOR);
    w.fill(30, 22, 30, 37, T.BRICK);
    w.fill(60, 22, 60, 37, T.BRICK);
    for (const row of [34, 30, 26]) w.fill(30, row, 60, row, T.CONCRETE);
    w.fill(30, 22, 60, 22, T.ROOF);
    w.fill(32, 22, 34, 22, T.HATCH_C);     // alçapão do telhado
    // portaria
    w.set(60, 36, T.DOOR_C); w.set(60, 37, T.DOOR_C);
    // janelas laterais
    for (const r of [32, 24]) { w.set(60, r, T.GLASS); w.set(30, r, T.GLASS); }
    w.set(30, 28, T.GLASS);
    // parapeito do telhado
    w.set(30, 21, T.BRICK); w.set(60, 21, T.BRICK);

    // ---------- Apartamento de V (2º andar, linhas 27-29, piso na 30) ----------
    w.fill(39, 30, 59, 30, T.WOOD);
    w.set(38, 27, T.BRICK); w.set(38, 28, T.DOOR_C); w.set(38, 29, T.DOOR_C); // porta de entrada
    w.set(42, 27, T.BRICK); w.set(42, 28, T.DOOR_O); w.set(42, 29, T.DOOR_O); // porta do quarto
    w.set(48, 27, T.BRICK);                                                   // arco para a sala
    w.set(60, 28, T.GDOOR_C); w.set(60, 29, T.GDOOR_C);                       // porta da sacada
    w.fill(61, 30, 63, 30, T.CONCRETE);                                       // sacada
    w.set(63, 29, T.RAIL);
    w.fillBg(38, 27, 41, 29, B.SALA);
    w.fillBg(42, 27, 47, 29, B.QUARTO);
    w.fillBg(48, 27, 52, 29, B.COZINHA);
    w.fillBg(53, 27, 59, 29, B.SALA);

    // ---------- Prédio B: padaria no térreo (x 102..124) ----------
    w.fill(102, 26, 102, 37, T.BRICK);
    w.fill(124, 26, 124, 37, T.BRICK);
    w.fill(102, 34, 124, 34, T.CONCRETE);
    w.fill(103, 26, 123, 33, T.FACADE);
    w.fill(102, 25, 124, 25, T.ROOF);
    w.set(102, 36, T.DOOR_C); w.set(102, 37, T.DOOR_C);
    w.fillBg(103, 35, 123, 37, B.PADARIA);

    // ---------- áreas (primeira que contém o ponto vence) ----------
    w.areas = [
      { id: 'banheiro', name: 'Banheiro', x: 1, y: 42, w: 10, h: 6, indoor: true },
      { id: 'apto', name: 'Apartamento de V', x: 38, y: 26, w: 23, h: 5, indoor: true },
      { id: 'sacada', name: 'Sacada', x: 61, y: 26, w: 3, h: 5, indoor: false },
      { id: 'telhado', name: 'Telhado do prédio', x: 30, y: 8, w: 31, h: 14, indoor: false },
      { id: 'predio', name: 'Prédio de V', x: 30, y: 22, w: 31, h: 16, indoor: true },
      { id: 'padaria', name: 'Padaria', x: 102, y: 34, w: 23, h: 4, indoor: true },
      { id: 'obra', name: 'Terreno baldio', x: 0, y: 0, w: 30, h: 39 },
      { id: 'praca', name: 'Praça', x: 80, y: 0, w: 22, h: 39 },
      { id: 'rua', name: 'Rua', x: 0, y: 0, w: W, h: H },
    ];

    w.snapshotBase();

    // ---------- objetos físicos (props) ----------
    const floorApt = t(30);
    const counterTop = t(29);
    const ground = t(GR);
    const props = [
      { id: 'copo', type: 'copo', x: t(51) + 6, y: counterTop - 6 },
      { id: 'colher', type: 'colher', x: t(52) + 6, y: counterTop - 2 },
      { id: 'vassoura', type: 'vassoura', x: t(41) + 9, y: floorApt - 24 },
      { id: 'controle', type: 'controle', x: t(57) + 6, y: floorApt - 8 - 3 },
      { id: 'cadeira', type: 'cadeira', x: t(55) + 3, y: floorApt - 14 },
      { id: 'jogo1', type: 'jogo', x: t(53) + 3, y: floorApt - 22 - 6, state: { cor: '#c0392b' } },
      { id: 'jogo2', type: 'jogo', x: t(53) + 8, y: floorApt - 22 - 6, state: { cor: '#2e86de' } },
      { id: 'livro', type: 'livro', x: t(53) + 5, y: floorApt - 34 - 6 },
      { id: 'caixa', type: 'caixa', x: t(47) + 3, y: floorApt - 10 },
      // terreno baldio
      { id: 'caixote1', type: 'caixote', x: t(6), y: ground - 14 },
      { id: 'caixote2', type: 'caixote', x: t(7) + 2, y: ground - 14 },
      { id: 'caixote3', type: 'caixote', x: t(6) + 7, y: ground - 28 },
      { id: 'caixote4', type: 'caixote', x: t(13), y: ground - 14 },
      { id: 'caixote5', type: 'caixote', x: t(24), y: ground - 14 },
      { id: 'garrafa', type: 'garrafa', x: t(13) + 5, y: ground - 14 - 8 },
      { id: 'lata1', type: 'lata', x: t(16), y: ground - 6 },
      { id: 'lata2', type: 'lata', x: t(17) + 3, y: ground - 6 },
      { id: 'bola', type: 'bola', x: t(10), y: ground - 7 },
      // segredo da portaria (conteúdo original do jogo)
      { id: 'painel', type: 'painel', x: t(44) + 2, y: ground - 22 },
      // praça (conteúdo original do jogo)
      { id: 'banco', type: 'banco', x: t(92) + 1, y: ground - 12 },
      { id: 'poste', type: 'poste', x: t(97) + 5, y: ground - 56 },
      { id: 'pipa', type: 'pipa', x: t(87) + 6, y: ground - 66 },
    ];

    // ---------- itens coletáveis ----------
    const pickups = [
      { id: 'chave', item: 'chave_terraco', x: t(44) + 5, y: ground - 20, w: 6, h: 4, hiddenBehind: 'painel' },
      { id: 'registro_telhado', item: 'registro_telhado', x: t(40), y: t(22) - 8, w: 8, h: 8 },
    ];

    // ---------- decoração (desenhada proceduralmente em sprites.js) ----------
    // surfaces: [dx, dy, largura] = tampos onde objetos pequenos podem apoiar
    const decor = [
      // apartamento — cozinha
      { type: 'geladeira', x: t(49) + 1, y: floorApt - 30, w: 14, h: 30 },
      { type: 'armario_alto', x: t(50), y: t(27), w: 48, h: 9 },
      { type: 'bancada', x: t(50), y: counterTop, w: 48, h: 16, surfaces: [[0, 0, 48]] },
      { type: 'torneira', x: t(51) + 1, y: counterTop - 7, w: 6, h: 7 },
      // sala
      { type: 'estante', x: t(53), y: floorApt - 44, w: 16, h: 44, surfaces: [[1, 22, 14], [1, 10, 14], [1, 34, 14]] },
      { type: 'mesa', x: t(54) + 2, y: floorApt - 13, w: 28, h: 13, surfaces: [[0, 0, 28]] },
      { type: 'notebook', x: t(54) + 19, y: floorApt - 20, w: 9, h: 7 },
      { type: 'celular', x: t(54) + 3, y: floorApt - 15, w: 5, h: 2 },
      { type: 'caderno', x: t(54) + 12, y: floorApt - 15, w: 5, h: 2 },
      { type: 'mesinha', x: t(56) + 3, y: floorApt - 10, w: 10, h: 10, surfaces: [[0, 0, 10]] },
      { type: 'abajur', x: t(56) + 4, y: floorApt - 22, w: 8, h: 12 },
      { type: 'sofa', x: t(57), y: floorApt - 15, w: 30, h: 15, surfaces: [[3, 7, 24]] },
      { type: 'tv', x: t(54) + 8, y: t(27) + 3, w: 16, h: 11, wall: true },
      { type: 'planta', x: t(59) + 3, y: floorApt - 18, w: 10, h: 18 },
      { type: 'lustre', x: t(55) + 4, y: t(27), w: 8, h: 6 },
      { type: 'interruptor', x: t(49) - 3, y: floorApt - 18, w: 3, h: 4 },
      // quarto
      { type: 'guarda_roupa', x: t(43) + 1, y: floorApt - 36, w: 14, h: 36 },
      { type: 'cama', x: t(44) + 2, y: floorApt - 12, w: 40, h: 12 },
      { type: 'janela_poco', x: t(46), y: t(27) + 3, w: 20, h: 16 },
      { type: 'lustre', x: t(45) + 4, y: t(27), w: 8, h: 6 },
      // hall
      { type: 'porta_fundo', x: t(39) + 2, y: floorApt - 30, w: 14, h: 30, label: 'WC' },
      { type: 'cabideiro', x: t(41) + 1, y: floorApt - 28, w: 6, h: 28 },
      // corredores e portas dos vizinhos
      { type: 'porta_fundo', x: t(35) + 1, y: floorApt - 30, w: 14, h: 30, label: '22' },
      { type: 'porta_fundo', x: t(40), y: t(34) - 30, w: 14, h: 30, label: '11' },
      { type: 'porta_fundo', x: t(50), y: t(34) - 30, w: 14, h: 30, label: '12' },
      { type: 'porta_fundo', x: t(45), y: t(26) - 30, w: 14, h: 30, label: '31' },
      { type: 'porta_fundo', x: t(52), y: t(26) - 30, w: 14, h: 30, label: '32' },
      { type: 'luminaria', x: t(46), y: t(31), w: 8, h: 3 },
      { type: 'luminaria', x: t(36), y: t(27), w: 8, h: 3 },
      { type: 'luminaria', x: t(48), y: t(23), w: 8, h: 3 },
      { type: 'luminaria', x: t(50), y: t(35), w: 8, h: 3 },
      // portaria
      { type: 'caixas_correio', x: t(42), y: ground - 26, w: 40, h: 18 },
      { type: 'balcao_portaria', x: t(52) + 4, y: ground - 15, w: 34, h: 15, front: true },
      { type: 'planta', x: t(56), y: ground - 18, w: 10, h: 18 },
      { type: 'tapete', x: t(57), y: ground - 2, w: 30, h: 2 },
      // telhado
      { type: 'caixa_dagua', x: t(49), y: t(22) - 40, w: 64, h: 40 },
      { type: 'antena', x: t(36), y: t(22) - 34, w: 14, h: 34 },
      // banheiro
      { type: 'porta_fundo', x: t(3), y: t(46) - 30, w: 14, h: 30, label: 'SAÍDA' },
      { type: 'espelho', x: t(5) + 4, y: t(43) + 4, w: 14, h: 12 },
      { type: 'pia_banheiro', x: t(5) + 5, y: t(46) - 14, w: 12, h: 14 },
      { type: 'vaso', x: t(7) + 2, y: t(46) - 12, w: 11, h: 12 },
      { type: 'chuveiro', x: t(8) + 4, y: t(43), w: 10, h: 40 },
      // terreno baldio
      { type: 'outdoor', x: t(8), y: t(29), w: t(9), h: t(9) },
      { type: 'manilha', x: t(21) + 6, y: ground - 20, w: 26, h: 20 },
      { type: 'cone', x: t(19), y: ground - 8, w: 6, h: 8 },
      { type: 'cone', x: t(22) - 2, y: ground - 8, w: 6, h: 8 },
      // rua
      { type: 'faixa', x: t(66), y: ground - 1, w: t(12), h: 2 },
      { type: 'poste_ok', x: t(65), y: ground - 58, w: 14, h: 58, light: true },
      { type: 'carro', x: t(69), y: ground - 26, w: 76, h: 26, cor: '#7d2e2e' },
      { type: 'poste_ok', x: t(126), y: ground - 58, w: 14, h: 58, light: true },
      { type: 'ponto', x: t(130), y: ground - 34, w: 40, h: 34 },
      { type: 'carro', x: t(135), y: ground - 26, w: 76, h: 26, cor: '#3d5a80' },
      { type: 'barreira', x: t(144) + 4, y: ground - 14, w: 36, h: 14 },
      // praça
      { type: 'arvore', x: t(86), y: ground - 74, w: 58, h: 74 },
      { type: 'arbusto', x: t(82) + 2, y: ground - 10, w: 20, h: 10 },
      { type: 'arbusto', x: t(99) - 4, y: ground - 10, w: 18, h: 10 },
      { type: 'banco_ok', x: t(83) + 8, y: ground - 12, w: 30, h: 12, surfaces: [[2, 5, 26]] },
      { type: 'placa', x: t(80) + 4, y: ground - 26, w: 18, h: 26, text: 'PRAÇA' },
      // padaria
      { type: 'letreiro', x: t(103), y: t(33) + 4, w: t(8), h: 12, text: 'PADARIA' },
      { type: 'prateleira_pao', x: t(108), y: t(35) + 1, w: 64, h: 18 },
      { type: 'balcao', x: t(108) + 4, y: ground - 15, w: 60, h: 15, surfaces: [[0, 0, 60]], front: true },
      { type: 'mesa_bar', x: t(117), y: ground - 13, w: 20, h: 13 },
      { type: 'mesa_bar', x: t(120) + 4, y: ground - 13, w: 20, h: 13 },
      { type: 'luminaria', x: t(110), y: t(35), w: 8, h: 3 },
      { type: 'luminaria', x: t(119), y: t(35), w: 8, h: 3 },
    ];

    // ---------- luzes ----------
    // on(game) decide se está acesa; cor em "r,g,b"
    const lights = [
      { id: 'luz_sala', x: t(55) + 8, y: t(27) + 6, r: 80, color: '255,226,170', flag: 'luz_sala' },
      { id: 'luz_quarto', x: t(45) + 8, y: t(27) + 6, r: 60, color: '255,226,170', flag: 'luz_sala' },
      { id: 'abajur', x: t(56) + 8, y: floorApt - 18, r: 46, color: 'abajur', flag: 'abajur' },
      { id: 'luz_banheiro', x: t(6), y: t(43) + 4, r: 70, color: '230,240,255', always: true },
      { id: 'corredor1', x: t(46) + 4, y: t(31) + 3, r: 70, color: '240,235,210', always: true },
      { id: 'corredor2', x: t(36) + 4, y: t(27) + 3, r: 55, color: '240,235,210', always: true },
      { id: 'corredor3', x: t(48) + 4, y: t(23) + 3, r: 70, color: '240,235,210', always: true },
      { id: 'portaria', x: t(50) + 4, y: t(35) + 3, r: 90, color: '240,235,210', always: true },
      { id: 'poste_rua1', x: t(65) + 11, y: ground - 54, r: 95, color: '255,200,120', night: true },
      { id: 'poste_rua2', x: t(126) + 11, y: ground - 54, r: 95, color: '255,200,120', night: true },
      { id: 'poste_praca', x: t(97) + 8, y: ground - 52, r: 95, color: '255,214,150', night: true, prop: 'poste' },
      { id: 'padaria1', x: t(110) + 4, y: t(35) + 3, r: 80, color: '255,230,180', shop: true },
      { id: 'padaria2', x: t(119) + 4, y: t(35) + 3, r: 80, color: '255,230,180', shop: true },
    ];

    // ---------- pessoas da rua (cenas vistas da janela no cap. 1) ----------
    const npcs = [
      { id: 'passeador', kind: 'passeador', x: t(70), y: ground - 26 },
      { id: 'moto', kind: 'moto', x: t(78), y: ground - 26 },
      { id: 'senhora', kind: 'senhora', x: t(100), y: ground - 24 },
      { id: 'casal_a', kind: 'casal_a', x: t(90) + 4, y: ground - 26 },
      { id: 'casal_b', kind: 'casal_b', x: t(91) + 10, y: ground - 25 },
      { id: 'crianca', kind: 'crianca', x: t(86) + 12, y: ground - 18 },
      { id: 'porteiro', kind: 'porteiro', x: t(53) + 6, y: ground - 26, behind: true },
      { id: 'atendente', kind: 'atendente', x: t(110) + 4, y: ground - 26, behind: true },
    ];

    // ---------- regiões especiais (px) ----------
    const regions = {
      paredeVizinho: { x: t(54), y: t(27), w: t(5), h: t(3), scene: 'vizinho' },
      apto11: { x: t(38), y: t(31), w: t(6), h: t(3), scene: 'apto11', perceivable: true, apto: true },
      apto12: { x: t(48), y: t(31), w: t(6), h: t(3), scene: 'apto12', perceivable: true, apto: true },
      apto31: { x: t(43), y: t(23), w: t(6), h: t(3), scene: 'apto31', perceivable: true, apto: true },
      apto32: { x: t(50), y: t(23), w: t(6), h: t(3), scene: 'apto32', perceivable: true, apto: true },
      pia: { x: t(50), y: counterTop - 14, w: t(3), h: 16 },
      bancadaTopo: { x: t(50), y: counterTop - 1, w: t(3), h: 2 },
      chaoCozinha: { x: t(49) - 4, y: floorApt - 4, w: 24, h: 4 },
    };

    // ---------- escada do prédio (lances em zigue-zague) ----------
    const xa = t(31) + 2, xb = t(35) + 2;
    const stairs = [
      { id: 'lance0', x0: xa, y0: t(38), x1: xb, y1: t(34) },
      { id: 'lance1', x0: xb, y0: t(34), x1: xa, y1: t(30) },
      { id: 'lance2', x0: xa, y0: t(30), x1: xb, y1: t(26) },
      { id: 'lance3', x0: xb, y0: t(26), x1: t(32) + 3, y1: t(22), hatch: true },
    ];

    // ---------- pombos da praça ----------
    const pigeons = [];
    for (let i = 0; i < 7; i++) pigeons.push({ x: t(84) + i * 22 + (i % 2) * 7, y: ground - 3 });

    return {
      world: w, props, pickups, decor, lights, npcs, regions, pigeons, stairs,
      spawn: { x: t(52) - 2, y: floorApt - 26 },
      bathroomSpawn: { x: t(4) + 2, y: t(46) - 26 },
      hallSpawn: { x: t(40) + 4, y: floorApt - 26 },
      ground,
    };
  };
})(window.VG = window.VG || {});

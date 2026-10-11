/* =====================================================================
 * Entrada: teclado + mouse, com ações configuráveis (remapeáveis no
 * menu de Configurações). O jogo consulta ações, nunca teclas cruas.
 * ===================================================================== */
(function (G) {
  'use strict';

  G.ACTIONS = [
    { id: 'left', label: 'Andar para a esquerda' },
    { id: 'right', label: 'Andar para a direita' },
    { id: 'jump', label: 'Pular' },
    { id: 'down', label: 'Descer do patamar' },
    { id: 'interact', label: 'Interagir / avançar diálogo' },
    { id: 'hold', label: 'Segurar (precisão / firmeza)' },
    { id: 'cancel', label: 'Cancelar poder' },
    { id: 'caderno', label: 'Abrir o caderno' },
    { id: 'bolsos', label: 'Abrir os bolsos' },
    { id: 'pause', label: 'Pausar' },
    { id: 'p1', label: 'Poder 1' }, { id: 'p2', label: 'Poder 2' }, { id: 'p3', label: 'Poder 3' },
    { id: 'p4', label: 'Poder 4' }, { id: 'p5', label: 'Poder 5' }, { id: 'p6', label: 'Poder 6' },
  ];

  G.DEFAULT_BINDINGS = {
    left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], jump: ['KeyW', 'Space', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'], interact: ['KeyE', 'Enter'], hold: ['ShiftLeft', 'ShiftRight'],
    cancel: ['KeyQ'], caderno: ['KeyJ', 'Tab'], bolsos: ['KeyI'], pause: ['Escape', 'KeyP'],
    p1: ['Digit1'], p2: ['Digit2'], p3: ['Digit3'], p4: ['Digit4'], p5: ['Digit5'], p6: ['Digit6'],
  };

  /** Nome legível de um código de tecla. */
  G.keyName = (code) => {
    if (!code) return '—';
    const map = { Space: 'Espaço', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', ShiftLeft: 'Shift', ShiftRight: 'Shift dir.', Escape: 'Esc', Enter: 'Enter', Tab: 'Tab', ControlLeft: 'Ctrl', AltLeft: 'Alt', Backspace: '⌫' };
    if (map[code]) return map[code];
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    return code;
  };

  class Input {
    constructor(target, bindings) {
      this.bindings = bindings || G.DEFAULT_BINDINGS;
      this.down = {}; this.pressed = {}; this.released = {};
      this.mouse = { sx: 0, sy: 0, inside: false, buttons: [false, false, false], pressed: [false, false, false], released: [false, false, false], wheel: 0 };
      this.listeners = [];
      this.captureCb = null;   // usado ao remapear teclas
      this.enabled = true;
      if (target) this.attach(target);
    }
    attach(canvas) {
      this.canvas = canvas;
      const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); this.listeners.push([el, ev, fn, opt]); };
      on(window, 'keydown', (e) => {
        if (this.captureCb) { e.preventDefault(); const cb = this.captureCb; this.captureCb = null; cb(e.code); return; }
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code) && !isTyping(e)) e.preventDefault();
        if (!this.down[e.code]) this.pressed[e.code] = true;
        this.down[e.code] = true;
      });
      on(window, 'keyup', (e) => { this.down[e.code] = false; this.released[e.code] = true; });
      on(window, 'blur', () => { this.down = {}; this.mouse.buttons = [false, false, false]; });
      on(canvas, 'mousemove', (e) => this._pos(e));
      on(canvas, 'mouseenter', () => { this.mouse.inside = true; });
      on(canvas, 'mouseleave', () => { this.mouse.inside = false; });
      on(canvas, 'mousedown', (e) => { this._pos(e); const b = e.button; if (b < 3) { this.mouse.buttons[b] = true; this.mouse.pressed[b] = true; } e.preventDefault(); });
      on(window, 'mouseup', (e) => { const b = e.button; if (b < 3) { this.mouse.buttons[b] = false; this.mouse.released[b] = true; } });
      on(canvas, 'contextmenu', (e) => e.preventDefault());
      on(canvas, 'wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    }
    _pos(e) {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.sx = (e.clientX - r.left) / r.width * G.VIEW_W;
      this.mouse.sy = (e.clientY - r.top) / r.height * G.VIEW_H;
      this.mouse.inside = true;
    }
    is(action) { const k = this.bindings[action] || []; for (const c of k) if (this.down[c]) return true; return false; }
    hit(action) { const k = this.bindings[action] || []; for (const c of k) if (this.pressed[c]) return true; return false; }
    up(action) { const k = this.bindings[action] || []; for (const c of k) if (this.released[c]) return true; return false; }
    /** Limpa os eventos "deste quadro". Chamado após o primeiro passo de simulação do quadro. */
    consume() {
      this.pressed = {}; this.released = {};
      this.mouse.pressed = [false, false, false]; this.mouse.released = [false, false, false];
      this.mouse.wheel = 0;
    }
    capture(cb) { this.captureCb = cb; }
    detach() { for (const [el, ev, fn, opt] of this.listeners) el.removeEventListener(ev, fn, opt); this.listeners = []; }
  }
  function isTyping(e) { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'); }
  G.Input = Input;
})(window.VG = window.VG || {});

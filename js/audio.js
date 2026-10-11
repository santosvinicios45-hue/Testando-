/* =====================================================================
 * Efeitos sonoros sintetizados com WebAudio (nenhum arquivo externo).
 * O contexto só é criado após a primeira interação do jogador, como os
 * navegadores exigem.
 * ===================================================================== */
(function (G) {
  'use strict';

  class Audio {
    constructor(settings) { this.settings = settings; this.ctx = null; this.master = null; this.noise = null; this.loops = {}; }
    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.setVolume(this.settings ? this.settings.volume : 0.6);
        const len = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { console.warn('[V] áudio indisponível', e); this.ctx = null; }
    }
    setVolume(v) { if (this.master) this.master.gain.value = Math.max(0, Math.min(1, v)) * 0.5; }

    _tone(freq, dur, type, vol, slide, delay) {
      const c = this.ctx, t = c.currentTime + (delay || 0);
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
    }
    _noise(dur, vol, freq, q, delay) {
      const c = this.ctx, t = c.currentTime + (delay || 0);
      const s = c.createBufferSource(); s.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 2000; f.Q.value = q || 1;
      const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    }

    play(name, vol) {
      if (!this.ctx || !this.master) return;
      const v = vol === undefined ? 1 : vol;
      try {
        switch (name) {
          case 'jump': this._tone(260, 0.09, 'square', 0.05 * v, 420); break;
          case 'land': this._noise(0.06, 0.08 * v, 400, 1); break;
          case 'step': this._noise(0.03, 0.025 * v, 900, 2); break;
          case 'tick': this._noise(0.04, 0.06 * v, 3000, 3); break;
          case 'thud': this._noise(0.12, 0.14 * v, 250, 1); break;
          case 'glass':
            for (let i = 0; i < 6; i++) this._tone(1800 + Math.random() * 2400, 0.12 + Math.random() * 0.15, 'triangle', 0.05 * v, null, i * 0.025);
            this._noise(0.25, 0.12 * v, 5000, 0.8); break;
          case 'crack': this._noise(0.18, 0.15 * v, 700, 1.5); break;
          case 'restore':
            [523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.25, 'sine', 0.05 * v, f * 0.98, i * 0.06));
            this._noise(0.4, 0.03 * v, 6000, 4); break;
          case 'freeze': this._tone(880, 0.9, 'sine', 0.06 * v, 220); this._noise(0.9, 0.05 * v, 1200, 6); break;
          case 'lift': this._tone(330, 0.18, 'sine', 0.05 * v, 660); break;
          case 'drop': this._tone(500, 0.12, 'sine', 0.04 * v, 250); break;
          case 'teleport': this._tone(1200, 0.12, 'sawtooth', 0.03 * v, 200); this._tone(200, 0.15, 'sine', 0.05 * v, 1400, 0.1); break;
          case 'transform': [700, 940, 1180].forEach((f, i) => this._tone(f, 0.12, 'triangle', 0.04 * v, null, i * 0.04)); break;
          case 'create': this._tone(440, 0.08, 'sine', 0.06 * v, 880); this._tone(880, 0.2, 'sine', 0.05 * v, null, 0.08); break;
          case 'perceive': this._tone(150, 0.3, 'sine', 0.03 * v, 140); break;
          case 'unravel': this._noise(0.5, 0.18 * v, 300, 0.7); this._tone(90, 0.5, 'sawtooth', 0.05 * v, 40); break;
          case 'bonk': this._tone(180, 0.12, 'square', 0.08 * v, 90); this._noise(0.08, 0.1 * v, 600, 1); break;
          case 'door': this._noise(0.15, 0.08 * v, 300, 2); this._tone(120, 0.1, 'triangle', 0.04 * v, 90); break;
          case 'creak': this._tone(140, 0.25, 'sawtooth', 0.025 * v, 190); break;
          case 'pickup': this._tone(660, 0.07, 'square', 0.04 * v); this._tone(990, 0.1, 'square', 0.04 * v, null, 0.07); break;
          case 'ui': this._tone(520, 0.05, 'square', 0.03 * v); break;
          case 'type': this._tone(380 + Math.random() * 60, 0.02, 'square', 0.012 * v); break;
          case 'flap': this._noise(0.2, 0.05 * v, 1500, 2); break;
          case 'switch': this._noise(0.03, 0.08 * v, 2500, 4); break;
          case 'water': this._noise(0.6, 0.05 * v, 1800, 0.6); break;
          case 'success': [523, 659, 784].forEach((f, i) => this._tone(f, 0.18, 'triangle', 0.05 * v, null, i * 0.09)); break;
          case 'heart': this._tone(60, 0.15, 'sine', 0.12 * v, 45); this._tone(60, 0.15, 'sine', 0.1 * v, 45, 0.22); break;
          default: break;
        }
      } catch (e) { /* som nunca deve derrubar o jogo */ }
    }
  }
  G.Audio = Audio;
})(window.VG = window.VG || {});

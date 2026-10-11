/* =====================================================================
 * Salvamento em localStorage: 3 espaços manuais + 1 automático.
 * Guarda posição, relógio, poderes, Linha, bolsos, objetos (inclusive
 * quebrados/transformados/criados), diferenças no mapa (portas etc.),
 * história, caderno e missões. Configurações ficam em chave separada.
 * ===================================================================== */
(function (G) {
  'use strict';
  const PREFIX = 'vgame_save_';
  const SETTINGS_KEY = 'vgame_settings';
  const FORMAT = 1;

  /** Acesso seguro: localStorage pode estar bloqueado (modo privado, file:// em alguns navegadores). */
  function store() {
    try {
      const s = window.localStorage;
      const k = '__vgame_test__';
      s.setItem(k, '1'); s.removeItem(k);
      return s;
    } catch (e) { return null; }
  }

  const Save = {
    SLOTS: ['auto', '1', '2', '3'],
    available() { return !!store(); },

    collect(g) {
      return {
        format: FORMAT, version: G.VERSION, savedAt: Date.now(),
        place: g.areaName || '',
        clock: { day: g.clock.day, min: Math.round(g.clock.min) },
        player: g.player.serialize(),
        powers: g.powers.serialize(),
        inventory: g.inventory.serialize(),
        wallet: g.wallet ? g.wallet.serialize() : null,
        props: g.props.filter((p) => !p.removed || !p.dynamic).map((p) => Object.assign(p.serialize(), { removed: p.removed })),
        pickups: g.pickups.map((p) => ({ id: p.id, taken: p.taken })),
        world: g.world.diff(),
        flags: g.flags,
        story: g.story.serialize(),
      };
    },

    write(slot, g) {
      const s = store();
      if (!s) return { ok: false, error: 'O navegador bloqueou o armazenamento local.' };
      try {
        const data = this.collect(g);
        s.setItem(PREFIX + slot, JSON.stringify(data));
        return { ok: true, data };
      } catch (e) {
        console.error('[V] falha ao salvar', e);
        return { ok: false, error: e && e.name === 'QuotaExceededError' ? 'Sem espaço no armazenamento do navegador.' : String(e.message || e) };
      }
    },

    read(slot) {
      const s = store();
      if (!s) return { ok: false, error: 'Armazenamento indisponível.' };
      const raw = s.getItem(PREFIX + slot);
      if (!raw) return { ok: false, empty: true, error: 'Espaço vazio.' };
      try {
        const data = JSON.parse(raw);
        const err = this.validate(data);
        if (err) return { ok: false, error: 'Save inválido: ' + err };
        return { ok: true, data };
      } catch (e) { return { ok: false, error: 'Save corrompido (JSON ilegível).' }; }
    },

    validate(d) {
      if (!d || typeof d !== 'object') return 'formato';
      if (d.format !== FORMAT) return 'versão de formato ' + d.format;
      if (!d.player || typeof d.player.x !== 'number' || typeof d.player.y !== 'number') return 'posição do jogador';
      if (!d.clock || typeof d.clock.day !== 'number') return 'relógio';
      if (!d.story || typeof d.story.stepId !== 'string') return 'história';
      if (!Array.isArray(d.props)) return 'objetos';
      return null;
    },

    meta(slot) {
      const r = this.read(slot);
      if (!r.ok) return r.empty ? null : { broken: true, error: r.error };
      const d = r.data;
      return { day: d.clock.day, min: d.clock.min, savedAt: d.savedAt, place: d.place, step: d.story.stepId, chapter: (G.STORY_STEPS[d.story.stepId] || {}).chapter };
    },

    remove(slot) { const s = store(); if (s) s.removeItem(PREFIX + slot); },

    /** Aplica os dados num jogo recém‑montado (mundo base já construído). */
    apply(g, d) {
      g.clock.day = d.clock.day; g.clock.min = d.clock.min;
      g.flags = Object.assign({}, d.flags || {});
      g.world.applyDiff(d.world || []);
      // objetos fixos do mapa: atualiza; objetos criados: recria
      const byId = new Map(g.props.map((p) => [p.id, p]));
      for (const pd of d.props) {
        if (!G.PropTypes[pd.type]) continue;
        let p = byId.get(pd.id);
        if (!p) { if (!pd.dynamic || pd.removed) continue; p = g.addProp({ id: pd.id, type: pd.type, x: pd.x, y: pd.y, dynamic: true }); }
        p.applySave(pd);
        if (pd.removed) p.removed = true;
      }
      for (const pk of d.pickups || []) { const p = g.pickups.find((q) => q.id === pk.id); if (p) p.taken = !!pk.taken; }
      g.inventory.applySave(d.inventory);
      if (g.wallet) g.wallet.applySave(d.wallet);
      g.powers.applySave(d.powers || {});
      g.player.x = d.player.x; g.player.y = d.player.y; g.player.facing = d.player.facing || 1;
      G.Physics.unstick(g.player, g.world);
      g.story.applySave(d.story);
    },

    loadSettings() {
      const def = { volume: 0.6, shake: true, reduceFlashes: false, showFps: false, scaleMode: 'integer', bindings: U_clone(G.DEFAULT_BINDINGS) };
      const s = store();
      if (!s) return def;
      try {
        const raw = s.getItem(SETTINGS_KEY);
        if (!raw) return def;
        const d = JSON.parse(raw);
        const out = Object.assign(def, d);
        out.bindings = Object.assign(U_clone(G.DEFAULT_BINDINGS), d.bindings || {});
        return out;
      } catch (e) { return def; }
    },
    saveSettings(settings) {
      const s = store();
      if (!s) return false;
      try { s.setItem(SETTINGS_KEY, JSON.stringify(settings)); return true; } catch (e) { return false; }
    },
  };
  function U_clone(o) { return JSON.parse(JSON.stringify(o)); }
  G.Save = Save;
})(window.VG = window.VG || {});

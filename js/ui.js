/* =====================================================================
 * Interface em DOM sobre o canvas: HUD, barra de poderes, objetivo,
 * diálogo, balões, menus, caderno, bolsos, salvamentos e
 * configurações. Todo botão aqui tem uma ação real.
 * ===================================================================== */
(function (G) {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  class UI {
    constructor(game) {
      this.g = game;
      this.modal = null;       // painel aberto que pausa o jogo
      this.stack = [];         // navegação "Voltar"
      this.savesMode = 'save';
      this.nbTab = 'descobertas';
      this.invSel = -1;
      this.hudT = 0;
      this.bubbleT = 0;
      this.lastDlg = null;
      this.iconCache = {};
      this.bind();
      this.buildHotbar();
      $('#version').textContent = 'versão ' + G.VERSION;
    }

    /* ---------------- ligação de eventos ---------------- */
    bind() {
      document.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-act]');
        if (b) { this.g.audio.unlock(); this.g.audio.play('ui'); this.action(b.dataset.act, b); }
        const t = e.target.closest('button[data-tab]');
        if (t) { this.nbTab = t.dataset.tab; this.renderCaderno(); this.g.audio.play('ui'); }
      });
      $('#dialogue').addEventListener('click', (e) => { if (!e.target.closest('button')) this.g.story.dialog.advance(); });
      const s = this.g.settings;
      $('#set-volume').addEventListener('input', (e) => { s.volume = +e.target.value; this.g.audio.setVolume(s.volume); this.g.saveSettings(); });
      $('#set-shake').addEventListener('change', (e) => { s.shake = e.target.checked; this.g.saveSettings(); });
      $('#set-flashes').addEventListener('change', (e) => { s.reduceFlashes = e.target.checked; this.g.saveSettings(); });
      $('#set-fps').addEventListener('change', (e) => { s.showFps = e.target.checked; $('#fps').classList.toggle('hidden', !s.showFps); this.g.saveSettings(); });
      $('#set-scale').addEventListener('change', (e) => { s.scaleMode = e.target.value; this.g.saveSettings(); this.g.resize(); });
    }

    action(act, btn) {
      const g = this.g;
      switch (act) {
        case 'new': this.confirmNew(); break;
        case 'continue': g.continueGame(); break;
        case 'load': this.openSaves('load'); break;
        case 'save': this.openSaves('save'); break;
        case 'settings': this.push('settings'); break;
        case 'controls': this.push('controls'); break;
        case 'about': this.push('about'); break;
        case 'resume': this.closeAll(); break;
        case 'caderno': this.closeAll(); this.openCaderno(); break;
        case 'quit': g.quitToMenu(); break;
        case 'back': this.back(); break;
        case 'close-panel': this.closeAll(); break;
        case 'reset-keys': g.settings.bindings = JSON.parse(JSON.stringify(G.DEFAULT_BINDINGS)); g.input.bindings = g.settings.bindings; g.saveSettings(); this.renderSettings(); break;
        case 'error-continue': $('#error').classList.add('hidden'); g.errorPaused = false; break;
        case 'slot-save': g.save(btn.dataset.slot); this.renderSaves(); break;
        case 'slot-load': g.load(btn.dataset.slot); break;
        case 'slot-del': if (btn.dataset.confirm === '1') { G.Save.remove(btn.dataset.slot); this.renderSaves(); this.refreshMainMenu(); } else { btn.dataset.confirm = '1'; btn.textContent = 'Confirmar?'; } break;
        case 'inv-use': if (this.invSel >= 0) { g.inventory.useSlot(this.invSel, g); this.renderBolsos(); } break;
        case 'inv-drop': if (this.invSel >= 0) { if (!g.inventory.dropSlot(this.invSel, g)) this.toast('Não dá pra largar isso aqui.', 'error'); this.renderBolsos(); } break;
        case 'new-confirm': g.newGame(); break;
        default: break;
      }
    }
    confirmNew() {
      const has = G.Save.meta('auto');
      if (has && !has.broken && this.g.state !== 'menu-fresh') {
        const b = document.querySelector('#menu-main button[data-act="new"]');
        if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Começar do zero? (clique de novo)'; return; }
      }
      this.g.newGame();
    }

    /* ---------------- navegação de telas ---------------- */
    screens() { return { main: '#menu-main', pause: '#menu-pause', saves: '#panel-saves', settings: '#panel-settings', controls: '#panel-controls', about: '#panel-about', caderno: '#caderno', bolsos: '#bolsos', endcard: '#endcard' }; }
    show(name) {
      const S = this.screens();
      for (const k in S) $(S[k]).classList.toggle('hidden', k !== name);
      this.modal = name === 'main' ? 'main' : name;
      if (name === 'settings') this.renderSettings();
      if (name === 'controls') this.renderControls();
      if (name === 'about') this.renderAbout();
      if (name === 'saves') this.renderSaves();
      if (name === 'main') this.refreshMainMenu();
    }
    push(name) { this.stack.push(this.modal); this.show(name); }
    back() { const prev = this.stack.pop(); if (prev) this.show(prev); else this.closeAll(); }
    closeAll() {
      const S = this.screens();
      for (const k in S) $(S[k]).classList.add('hidden');
      this.modal = null; this.stack = [];
      if (this.g.state === 'menu') this.show('main');
    }
    blocking() { return this.modal !== null; }
    showMainMenu() { this.stack = []; this.show('main'); this.setHudVisible(false); }
    refreshMainMenu() {
      const meta = G.Save.meta('auto');
      const b = $('#btn-continue');
      b.disabled = !meta || meta.broken;
      b.textContent = meta && !meta.broken ? 'Continuar — dia ' + meta.day + ', ' + G.util.fmtClock(meta.min) : 'Continuar';
      const nb = document.querySelector('#menu-main button[data-act="new"]');
      nb.dataset.confirm = ''; nb.textContent = 'Novo jogo';
    }
    openPause() { this.stack = []; this.show('pause'); }
    openSaves(mode) { this.savesMode = mode; this.push('saves'); }
    openCaderno(tab) { if (tab) this.nbTab = tab; this.stack = []; this.show('caderno'); this.renderCaderno(); }
    openBolsos() { this.stack = []; this.invSel = -1; this.show('bolsos'); this.renderBolsos(); }
    showEndcard() { this.stack = []; this.show('endcard'); }
    setHudVisible(v) { for (const id of ['#hud', '#objective', '#hotbar']) $(id).classList.toggle('hidden', !v); if (!v) { $('#prompt').classList.add('hidden'); $('#bubble').classList.add('hidden'); $('#dialogue').classList.add('hidden'); } }

    /* ---------------- HUD ---------------- */
    buildHotbar() {
      const hb = $('#hotbar'); hb.innerHTML = '';
      G.POWER_ORDER.forEach((id, i) => {
        const P = G.POWERS[id];
        const d = document.createElement('div');
        d.className = 'slot'; d.dataset.power = id;
        const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
        G.Sprites.icon(cv.getContext('2d'), id);
        d.appendChild(cv);
        d.insertAdjacentHTML('beforeend', '<span class="key">' + (i + 1) + '</span><span class="name">' + esc(P.name) + '</span>');
        d.title = P.name + ': ' + P.desc;
        d.addEventListener('click', () => this.g.powers && this.g.powers.select(id));
        hb.appendChild(d);
      });
    }
    update(dt) {
      const g = this.g;
      if (!g.powers || g.state === 'menu') return;
      this.hudT -= dt;
      // Linha
      const ps = g.powers;
      const r = Math.min(1, ps.ratio);
      $('#linha-fill').style.width = (r * 100).toFixed(1) + '%';
      $('#linha').classList.toggle('tense', ps.ratio > 0.75);
      // diálogo
      this.renderDialogue();
      // balão
      this.positionBubble(dt);
      if (this.hudT > 0) return;
      this.hudT = 0.2;
      $('#linha-val').textContent = Math.round(ps.tension) + ' / ' + ps.capacity;
      const emo = ps.emo;
      const em = $('#emotion'); em.textContent = emo.label; em.style.color = emo.color;
      em.title = 'Estado emocional: altera o custo dos poderes e o quanto a Linha relaxa.';
      $('#compreensao').textContent = 'Compreensão ' + ps.compreensao + (g.wallet ? ' · ' + g.wallet.text : '');
      $('#clock').textContent = G.weekdayOf(g.clock.day) + ' · ' + G.util.fmtClock(g.clock.min) + ' · dia ' + g.clock.day;
      $('#place').textContent = g.areaName || '';
      // hotbar
      document.querySelectorAll('#hotbar .slot').forEach((el) => {
        const id = el.dataset.power;
        el.classList.toggle('locked', !ps.isUnlocked(id));
        el.classList.toggle('sel', ps.selected === id);
        if (id === 'criar') {
          const c = G.CRIAVEIS.find((q) => q.id === ps.criarSel);
          el.querySelector('.name').textContent = 'Criar: ' + (c ? c.name : 'Laranja');
        }
      });
      // objetivo
      if (g.story.dirty) {
        g.story.dirty = false;
        const o = g.story.objective();
        const ch = G.CHAPTERS[o.chapter];
        $('#obj-chapter').textContent = ch ? ch.title.toUpperCase() : '';
        $('#obj-text').textContent = o.text || '';
        $('#obj-list').innerHTML = (o.checklist || []).map((c) => '<li class="' + (c.done ? 'done' : '') + '">' + esc(c.label) + '</li>').join('');
        if (this.modal === 'caderno') this.renderCaderno();
      }
      if (g.settings.showFps) $('#fps').textContent = g.fps + ' fps';
    }
    prompt(text) {
      const el = $('#prompt');
      if (!text) { el.classList.add('hidden'); return; }
      const key = G.keyName((this.g.settings.bindings.interact || [])[0]);
      el.innerHTML = '<kbd>' + esc(key) + '</kbd>' + esc(text);
      el.classList.remove('hidden');
    }
    bubble(text, dur, orig) {
      const el = $('#bubble');
      el.innerHTML = esc(text) + (orig ? '<span class="orig">◆ ORIGINAL</span>' : '');
      el.classList.remove('hidden');
      this.bubbleT = dur || 2;
    }
    positionBubble(dt) {
      const el = $('#bubble');
      if (this.bubbleT <= 0) return;
      this.bubbleT -= dt;
      if (this.bubbleT <= 0 || this.g.story.dialog.active) { el.classList.add('hidden'); this.bubbleT = Math.min(this.bubbleT, 0); return; }
      const g = this.g, p = g.player, cam = g.renderer.cam, s = g.scale;
      el.style.left = ((p.cx - cam.x) * s) + 'px';
      el.style.top = ((p.y - cam.y - 6) * s) + 'px';
    }
    toast(msg, kind) {
      const box = $('#toasts');
      const d = document.createElement('div');
      d.className = 'toast ' + (kind || '');
      d.textContent = msg;
      box.appendChild(d);
      while (box.children.length > 5) box.removeChild(box.firstChild);
      setTimeout(() => d.classList.add('out'), 4200);
      setTimeout(() => d.remove(), 4800);
    }
    chapterCard(ch) {
      const el = $('#chapter-card');
      el.querySelector('.cc-title').textContent = ch.title;
      el.querySelector('.cc-sub').textContent = ch.sub;
      el.classList.remove('hidden');
      el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
      clearTimeout(this._ccT);
      this._ccT = setTimeout(() => el.classList.add('hidden'), 4600);
    }
    fade(caption, mid, done) {
      const el = $('#fade'), cap = $('#fade-caption');
      cap.textContent = caption || '';
      el.classList.remove('hidden');
      requestAnimationFrame(() => el.classList.add('on'));
      this.g.fading = true;
      setTimeout(() => {
        try { if (mid) mid(); } catch (e) { this.g.reportError(e); }
        setTimeout(() => {
          el.classList.remove('on');
          setTimeout(() => { el.classList.add('hidden'); this.g.fading = false; try { if (done) done(); } catch (e) { this.g.reportError(e); } }, 460);
        }, caption ? 1100 : 250);
      }, 470);
    }

    /* ---------------- diálogo ---------------- */
    renderDialogue() {
      const d = this.g.story.dialog, box = $('#dialogue');
      if (!d.active || !d.current) { if (!box.classList.contains('hidden')) box.classList.add('hidden'); this.lastDlg = null; return; }
      box.classList.remove('hidden');
      const cur = d.current;
      const kind = cur.who === 'narr' ? 'narr' : cur.who === 'pensamento' ? 'thought' : 'speech';
      if (this.lastDlg !== cur) {
        this.lastDlg = cur;
        const who = $('#dlg-who');
        const label = kind === 'narr' ? (cur.orig ? 'Narração' : 'Narração · do romance') : kind === 'thought' ? 'V (pensamento)' : cur.who;
        who.className = kind;
        who.innerHTML = esc(label) + (cur.orig ? '<span class="orig">◆ CONTEÚDO ORIGINAL DO JOGO</span>' : '');
        $('#dlg-text').className = kind;
        $('#dlg-choices').innerHTML = '';
        this.choicesShown = false;
      }
      $('#dlg-text').textContent = cur.text.slice(0, Math.floor(d.chars));
      if (cur.choices && d.done && !this.choicesShown) {
        this.choicesShown = true;
        const cdiv = $('#dlg-choices');
        cur.choices.forEach((c, i) => {
          const b = document.createElement('button');
          b.innerHTML = (i + 1) + '. ' + esc(c.text) + (c.orig ? '<span class="orig">◆ ORIGINAL</span>' : '');
          b.addEventListener('click', (e) => { e.stopPropagation(); d.choose(i); });
          cdiv.appendChild(b);
        });
        const first = cdiv.querySelector('button'); if (first) first.focus();
      }
      $('#dlg-hint').classList.toggle('hidden', !!(cur.choices && d.done));
    }

    /* ---------------- caderno ---------------- */
    renderCaderno() {
      const g = this.g, st = g.story, page = $('#nb-page');
      document.querySelectorAll('.nb-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === this.nbTab));
      let h = '';
      if (this.nbTab === 'descobertas') {
        const byDay = {};
        st.discoveries.forEach((d) => { (byDay[d.day] = byDay[d.day] || []).push(d); });
        const days = Object.keys(byDay).sort((a, b) => a - b);
        if (!days.length) h += '<p class="muted">(ainda em branco)</p>';
        for (const day of days) {
          h += '<h3>Coisas que eu consigo fazer (dia ' + day + ')</h3>';
          for (const d of byDay[day]) h += '<p class="entry"><span class="day">—</span><span class="' + (d.underline ? 'underline' : '') + '">' + esc(d.text) + '</span></p>';
        }
      } else if (this.nbTab === 'registros') {
        if (!st.registros.length) h += '<p class="muted">Nenhum registro ainda. Explore.</p>';
        for (const r of st.registros) h += '<h3>' + esc(r.title) + (r.orig ? '<span class="orig">◆ ORIGINAL</span>' : '') + '</h3><p class="entry">' + esc(r.text) + '</p>';
      } else if (this.nbTab === 'missoes') {
        const o = st.objective();
        const ch = G.CHAPTERS[o.chapter];
        h += '<h3>Agora</h3><p class="entry"><b>' + esc(ch ? ch.title : '') + '</b> — ' + esc(o.text) + '</p>';
        for (const c of o.checklist) h += '<p class="entry ' + (c.done ? 'quest-done' : '') + '">' + (c.done ? '☑ ' : '☐ ') + esc(c.label) + '</p>';
        h += '<h3>Missões secundárias</h3>';
        const ids = Object.keys(st.side);
        if (!ids.length) h += '<p class="muted">Nenhuma ainda. Lá fora tem gente, e coisas quebradas.</p>';
        for (const id of ids) {
          const q = st.side[id], def = G.SIDE_QUESTS[id];
          h += '<p class="entry ' + (q.state === 'done' ? 'quest-done' : '') + '"><b>' + esc(def.title) + '</b><span class="orig">◆ ORIGINAL</span>' + (q.state === 'done' ? ' — concluída' : '') + '</p>';
          h += '<p class="entry muted">' + esc(def.desc) + '</p>';
          for (const [k, label] of def.steps) h += '<p class="entry ' + (q.done[k] ? 'quest-done' : '') + '">' + (q.done[k] ? '☑ ' : '☐ ') + esc(label) + '</p>';
        }
      } else if (this.nbTab === 'poderes') {
        const ps = g.powers;
        h += '<h3>A Linha</h3><p class="entry">"A realidade é feita inteira de uma linha só." Cada poder puxa o fio. Parado, ele relaxa. Se eu puxar demais, desfia: o que eu seguro cai e alguma coisa frágil por perto pode quebrar. O limite cresce com compreensão, não com treino. (mecânica original inspirada no cap. 2)</p>';
        h += '<p class="entry muted">Limite atual: ' + ps.capacity + ' · Compreensão: ' + ps.compreensao + ' · Humor: ' + esc(ps.emo.label) + '</p>';
        h += '<h3>O que eu já sei fazer</h3>';
        for (const id of G.POWER_ORDER) {
          const P = G.POWERS[id];
          if (!ps.isUnlocked(id)) { h += '<p class="entry muted">' + (G.POWER_ORDER.indexOf(id) + 1) + '. ???</p>'; continue; }
          h += '<div class="pw"><canvas data-icon="' + id + '" width="16" height="16"></canvas><p class="entry"><b>' + (G.POWER_ORDER.indexOf(id) + 1) + '. ' + esc(P.name) + '</b> — ' + esc(P.desc) + '</p></div>';
        }
        if (ps.vooLivre) h += '<p class="entry">Voar: no ar, segure Pular. Gasta a Linha e dura pouco. Ainda instável, mas lá fora não tem teto. (extensão original)</p>';
        else if (ps.vooInstavel) h += '<p class="entry muted">Voar: ainda instável. (Bati a cabeça no teto.)</p>';
        h += '<p class="entry muted">Criar sabe fazer: ' + G.CRIAVEIS.filter((c) => ps.criaveis.has(c.id)).map((c) => c.name).join(', ') + '.</p>';
        if (g.story.flags.testemunhas) h += '<p class="entry muted">Pessoas que viram alguma coisa impossível: ' + g.story.flags.testemunhas + '.</p>';
      }
      page.innerHTML = h;
      page.querySelectorAll('canvas[data-icon]').forEach((cv) => G.Sprites.icon(cv.getContext('2d'), cv.dataset.icon));
    }

    /* ---------------- bolsos ---------------- */
    renderBolsos() {
      const inv = this.g.inventory, grid = $('#inv-grid');
      grid.innerHTML = '';
      inv.slots.forEach((s, i) => {
        const d = document.createElement('div');
        d.className = 'slot' + (i === this.invSel ? ' sel' : '');
        if (s) {
          const def = G.ITEMS[s.id];
          const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
          G.Sprites.icon(cv.getContext('2d'), def.icon);
          d.appendChild(cv);
          if (s.n > 1) d.insertAdjacentHTML('beforeend', '<span class="count">' + s.n + '</span>');
          d.title = def.name;
        }
        d.addEventListener('click', () => { this.invSel = s ? i : -1; this.renderBolsos(); this.g.audio.play('ui'); });
        grid.appendChild(d);
      });
      const det = $('#inv-detail');
      det.dataset.wallet = '';
      $('#bolsos h2').textContent = 'Bolsos · carteira ' + (this.g.wallet ? this.g.wallet.text : '');
      const s = inv.slots[this.invSel];
      if (!s) { det.innerHTML = '<span class="muted">Clique num item para ver o que dá pra fazer com ele.</span>'; return; }
      const def = G.ITEMS[s.id];
      let h = '<b>' + esc(def.name) + '</b> ×' + s.n + '<br><span class="muted">' + esc(def.desc) + '</span><div class="actions">';
      if (def.use) h += '<button class="small-btn" data-act="inv-use">' + esc(def.actions[0] || 'Usar') + '</button>';
      if (def.drop) h += '<button class="small-btn" data-act="inv-drop">Largar</button>';
      h += '</div>';
      det.innerHTML = h;
    }

    /* ---------------- saves ---------------- */
    renderSaves() {
      $('#saves-title').textContent = this.savesMode === 'save' ? 'Salvar jogo' : 'Carregar jogo';
      const list = $('#saves-list');
      if (!G.Save.available()) { list.innerHTML = '<p>O navegador bloqueou o armazenamento local (modo privado?). Não é possível salvar nesta sessão.</p>'; return; }
      let h = '';
      for (const slot of G.Save.SLOTS) {
        const m = G.Save.meta(slot);
        const name = slot === 'auto' ? 'Automático' : 'Espaço ' + slot;
        let info;
        if (!m) info = '<span class="muted">vazio</span>';
        else if (m.broken) info = '<span style="color:#ff8fa3">corrompido — ' + esc(m.error) + '</span>';
        else info = 'Dia ' + m.day + ' · ' + G.util.fmtClock(m.min) + ' · ' + esc(m.place || '') + '<br><span class="muted">' + esc((G.CHAPTERS[m.chapter] || {}).title || '') + ' · salvo ' + new Date(m.savedAt).toLocaleString('pt-BR') + '</span>';
        h += '<div class="save-row"><div class="info"><b>' + name + '</b><br>' + info + '</div><div class="actions">';
        if (this.savesMode === 'save' && slot !== 'auto') h += '<button class="small-btn" data-act="slot-save" data-slot="' + slot + '">Salvar aqui</button>';
        if (this.savesMode === 'load' && m && !m.broken) h += '<button class="small-btn" data-act="slot-load" data-slot="' + slot + '">Carregar</button>';
        if (m) h += '<button class="small-btn" data-act="slot-del" data-slot="' + slot + '">Apagar</button>';
        h += '</div></div>';
      }
      list.innerHTML = h;
    }

    /* ---------------- configurações ---------------- */
    renderSettings() {
      const s = this.g.settings;
      $('#set-volume').value = s.volume; $('#set-shake').checked = s.shake; $('#set-flashes').checked = s.reduceFlashes;
      $('#set-fps').checked = s.showFps; $('#set-scale').value = s.scaleMode;
      const box = $('#bindings'); box.innerHTML = '';
      for (const a of G.ACTIONS) {
        const lab = document.createElement('span'); lab.textContent = a.label;
        const b = document.createElement('button');
        const keys = s.bindings[a.id] || [];
        b.textContent = keys.map(G.keyName).join(' / ') || '—';
        b.addEventListener('click', () => {
          b.classList.add('wait'); b.textContent = 'Aperte uma tecla…';
          this.g.input.capture((code) => {
            if (code !== 'Escape') {
              // remove a tecla de outras ações para evitar conflito
              for (const k in s.bindings) s.bindings[k] = (s.bindings[k] || []).filter((c) => c !== code);
              const rest = (s.bindings[a.id] || []).slice(1);
              s.bindings[a.id] = [code].concat(rest.filter((c) => c !== code));
              this.g.input.bindings = s.bindings;
              this.g.saveSettings();
            }
            this.renderSettings();
          });
        });
        box.appendChild(lab); box.appendChild(b);
      }
    }
    renderControls() {
      const b = this.g.settings.bindings, k = (a) => (b[a] || []).map(G.keyName).join(' / ');
      const rows = [
        [k('left') + ' · ' + k('right'), 'Andar'], [k('run'), 'Correr (segure enquanto anda)'], [k('jump'), 'Pular (segure para ir mais alto) · subir escada · voar no ar (quando liberado)'], [k('down'), 'Descer escada e patamares'],
        [k('interact'), 'Interagir / avançar diálogo'], ['1–7 · roda do mouse', 'Escolher poder'], ['Botão esquerdo', 'Usar o poder escolhido (segurar, clicar)'],
        ['Botão direito', 'Pousar com cuidado / cancelar seleção'], [k('hold'), 'Segurar com precisão (Levitar) e com força (cenas)'], ['Botão direito (Criar)', 'Trocar o que criar'], [k('cancel'), 'Cancelar poder'],
        [k('caderno'), 'Caderno: descobertas, registros, missões, poderes'], [k('bolsos'), 'Bolsos (inventário)'], [k('pause'), 'Pausa · salvar · carregar'],
      ];
      $('#controls-list').innerHTML = rows.map((r) => '<span class="k">' + esc(r[0]) + '</span><span>' + esc(r[1]) + '</span>').join('');
    }
    renderAbout() {
      $('#about-text').innerHTML = [
        '<p>Etapa 1 — protótipo jogável. Cobre o Ato I, capítulos 1 (O Copo) e 2 (Testes Domésticos), mais uma pequena área externa.</p>',
        '<h4>De onde vem cada coisa</h4>',
        '<p>Falas marcadas como <b>Narração · do romance</b> citam ou condensam <em>V — O Homem Que Acordou Grande Demais</em>. Tudo que traz o selo <span class="orig">◆ ORIGINAL</span> foi criado para o jogo: missões secundárias, falas das pessoas da rua, a padaria, o segredo do telhado e a mecânica da Linha.</p>',
        '<p>A rua lá fora é liberdade de sandbox: no romance, V fica dezenove dias trancado antes de sair (cap. 6). As cenas da rua são as que ele vê da janela no cap. 1.</p>',
        '<h4>Próximas etapas</h4><p>2 — sandbox (mineração, construção, fabricação) · 3 — voo, teleporte, tempo, combate e chefe · 4 — a Van e a Mansão Viva · 5 — Gustavo, Téo e decisões · 6 — Agência, Rayan e o Entre · 7 — expansão cósmica.</p>',
      ].join('');
    }

    showError(err) {
      $('#error-msg').textContent = String(err && (err.stack || err.message) || err);
      $('#error').classList.remove('hidden');
    }
  }
  G.UI = UI;
})(window.VG = window.VG || {});

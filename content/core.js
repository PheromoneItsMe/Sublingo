/* SubLingo — subtitle engine: overlay, side panel, playback tools, keyboard. */
var SL = (typeof SL !== 'undefined') ? SL : {};
(function (SL) {
  'use strict';

  const HELP = [
    ['A', 'предыдущая реплика'], ['S', 'повторить реплику'], ['D', 'следующая реплика'],
    ['Q', 'автопауза вкл/выкл'], ['R', 'зациклить реплику'], ['E', 'показать/скрыть перевод'],
    ['W', 'сохранить реплику как фразу'], ['C', 'копировать реплику'], ['X', 'озвучить реплику'],
    ['Z', 'медленная речь вкл/выкл'], ['H', 'подсветка произносимого слова (эксперимент)'], ['[ / ]', 'медленнее / быстрее'], ['Shift+[ / Shift+]', 'сдвинуть субтитры раньше / позже'], ['\\', 'обычная скорость'], ['V', 'скрыть/показать субтитры'], ['B', 'панель субтитров'],
    ['1 / 2 / 3', 'в словаре: знаю / учу / не учить'], ['ЛКМ по слову', 'словарь'], ['ПКМ по слову', 'отметить «учу» (настраивается)'],
    ['Ctrl + клик по словам', 'выбрать фразу (первое и последнее слово), отпустить Ctrl — перевод'], ['Выделить несколько слов', 'перевод фразы и сохранение']
  ];

  class SubPlayer {
    constructor(adapter) {
      this.a = adapter;
      this.lines = [];
      this.trans = [];
      this.tokens = [];
      this.shown = -2;
      this.activeLine = -1;
      this.autoPausedFor = -1;
      this.repeatLine = -1;
      this.userRate = 1;
      this.pausedBy = null;
      this.overLines = false;
      this.statusMsg = '';
      this.transStatus = '';
      this.tab = 'subs';
      this.follow = true;
      this.followHold = 0;
      this.filter = '';
      this.wordsFilter = 'new';
      this.wordTr = {};
      this.meta = {};
      this.trackOptions = [];
      this.transOptions = [];
      this.mounted = false;
    }

    /* ---------------- mounting ---------------- */
    mount() {
      if (this.mounted) return;
      this.mounted = true;
      this._buildOverlay();
      this._buildPanel();
      this._keys = this._onKey.bind(this);
      window.addEventListener('keydown', this._keys, true);
      window.addEventListener('keyup', (e) => { if ((e.key === 'Control' || e.key === 'Meta') && this._multi && !this._multi.done) this._finishMulti(); }, true);
      window.addEventListener('blur', () => { if (this._multi && !this._multi.done) this._finishMulti(); });
      // обычный клик (без Ctrl) вне окна перевода или Esc — сбросить выделенную группу
      window.addEventListener('mousedown', (e) => {
        if (!this._multi || !this._multi.done || e.ctrlKey || e.metaKey) return;
        if (e.composedPath().some(n => n && n.classList && n.classList.contains('sl-dict'))) return;
        this._clearMulti();
      }, true);
      window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this._multi) this._clearMulti(); }, true);
      this._timer = setInterval(() => this.tick(), 60);
      SL.onVocab(SL.debounce(() => this.refreshColors(), 250));
      SL.onSettings(() => this.applySettings());
      this.applySettings();
      const onFs = () => { this._placeHosts(); this.applyLayout(); setTimeout(() => this.applySettings(), 300); };
      document.addEventListener('fullscreenchange', onFs);
      document.addEventListener('webkitfullscreenchange', onFs);
      window.addEventListener('resize', SL.debounce(() => this.applySettings(), 200));
    }

    destroy() {
      clearInterval(this._timer);
      window.removeEventListener('keydown', this._keys, true);
      if (this.ovHost) this.ovHost.el.remove();
      if (this.pnHost) this.pnHost.el.remove();
      this.a.layout && this.a.layout(0);
      this.mounted = false;
    }

    // Контейнер для субтитров. В полноэкранном режиме плеер разворачивает свой элемент —
    // если наш контейнер оказался снаружи, переезжаем внутрь полноэкранного элемента.
    container() {
      let c = this.a.getContainer();
      const fs = document.fullscreenElement || document.webkitFullscreenElement;
      const v = this.a.getVideo();
      if (fs && fs.tagName !== 'VIDEO' && v && fs.contains(v) && (!c || !fs.contains(c))) c = fs;
      return c;
    }

    _placeHosts() {
      const c = this.container();
      if (c && this.ovHost) {
        if (this.ovHost.el.parentNode !== c) { this.ovHost.fixedParent = c; c.appendChild(this.ovHost.el); }
      }
      if (this.pnHost) {
        const t = document.fullscreenElement || document.body;
        if (this.pnHost.el.parentNode !== t) t.appendChild(this.pnHost.el);
      }
    }

    _buildOverlay() {
      const c = this.container() || document.body;
      const h = this.ovHost = SL.makeHost('sl-overlay-host-' + this.a.name, c);
      const ov = this.ov = SL.el('div', { class: 'sl-overlay sl-root' });
      ov.innerHTML = `<div class="sl-badge" style="display:none"></div>
        <div class="sl-wrap">
          <div class="sl-side sl-left">
            <button class="sl-sbtn" data-c="prev" title="Предыдущая реплика (A, колесо вверх)">⏮</button>
            <button class="sl-sbtn" data-c="repeat" title="Повторить (S)">↻</button>
          </div>
          <div class="sl-line sl-orig"></div>
          <div class="sl-side sl-right">
            <button class="sl-sbtn" data-c="next" title="Следующая реплика (D, колесо вниз)">⏭</button>
            <button class="sl-sbtn" data-c="save" title="Сохранить фразу (W)">☆</button>
            <button class="sl-sbtn" data-c="menu" title="Ещё">⋯</button>
            <div class="sl-menu" style="display:none">
              <button class="sl-mi" data-c="autopause"><span>Автопауза</span><i>Q</i></button>
              <button class="sl-mi" data-c="loop"><span>Повтор реплики</span><i>R</i></button>
              <button class="sl-mi" data-c="slow"><span>Медленная речь</span><i>Z</i></button>
              <button class="sl-mi" data-c="karaoke"><span>Подсветка слова речи</span><i>H</i></button>
              <button class="sl-mi" data-c="trans"><span>Перевод</span><i>E</i></button>
              <button class="sl-mi" data-c="speak"><span>Озвучить реплику</span><i>X</i></button>
              <button class="sl-mi" data-c="copy"><span>Копировать</span><i>C</i></button>
              <button class="sl-mi" data-c="panel"><span>Список реплик</span><i>B</i></button>
              <div class="sl-mrow"><span>Синхронизация</span><button class="sl-sbtn sm" data-c="syncMinus" title="Раньше (Shift+[)">−</button><b class="sl-sync">0.00с</b><button class="sl-sbtn sm" data-c="syncPlus" title="Позже (Shift+])">+</button></div>
              <button class="sl-mi" data-c="overlay"><span>Скрыть субтитры</span><i>V</i></button>
            </div>
          </div>
        </div>
        <div class="sl-line sl-trans"></div>
        <div class="sl-status" style="display:none"></div>`;
      if (this.a.overlayZ) ov.style.zIndex = this.a.overlayZ;
      h.shadow.appendChild(ov);
      this.origEl = ov.querySelector('.sl-orig');
      this.transEl = ov.querySelector('.sl-trans');
      this.badgeEl = ov.querySelector('.sl-badge');
      this.statusEl = ov.querySelector('.sl-status');
      this.menuEl = ov.querySelector('.sl-menu');
      this.wrapEl = ov.querySelector('.sl-wrap');
      this.wrapEl.addEventListener('mouseleave', () => this._menu(false));
      // колесо мыши над субтитрами — листать реплики
      const wheel = (e) => {
        if (e.target.closest('.sl-menu')) return;
        e.preventDefault();
        const now = Date.now();
        if (now - (this._wheelAt || 0) < 280) return;
        this._wheelAt = now;
        this.command(e.deltaY < 0 ? 'prev' : 'next');
      };
      this.wrapEl.addEventListener('wheel', wheel, { passive: false });
      this.transEl.addEventListener('wheel', wheel, { passive: false });
      // keep clicks away from the site's player
      ['click', 'mousedown', 'mouseup', 'dblclick', 'pointerdown', 'pointerup', 'contextmenu', 'auxclick', 'wheel', 'touchstart'].forEach(ev => h.el.addEventListener(ev, e => e.stopPropagation()));
      ov.addEventListener('click', e => {
        const b = e.target.closest('[data-c]');
        if (b) {
          if (b.dataset.c === 'menu') { this._menu(this.menuEl.style.display === 'none'); return; }
          if (b.dataset.c === 'overlay' || b.dataset.c === 'panel') this._menu(false);
          this.command(b.dataset.c);
          return;
        }
        if (e.target.closest('.sl-trans.sl-blur')) { this.transRevealed = !this.transRevealed; this.render(true); }
        if (e.target.closest('.sl-status') && this.a.onStatusClick) this.a.onStatusClick();
      });
      this._wireWords(this.origEl, () => this.shown, true);
      [this.wrapEl, this.transEl].forEach(el => {
        el.addEventListener('mouseenter', () => this._hover(true));
        el.addEventListener('mouseleave', () => this._hover(false));
      });
    }

    _hover(on) {
      this.overLines = on;
      const v = this.a.getVideo();
      if (!v) return;
      if (on && SL.settings.pauseOnHover && !v.paused) { this.a.pause(); this.pausedBy = 'hover'; }
      if (!on && this.pausedBy === 'hover' && !SL.Dict.open) { this.pausedBy = null; this.a.play(); }
    }

    // Word interactions inside a container (overlay line or panel rows)
    _wireWords(root, lineIndexFn, isOverlay) {
      const act = async (kind, w, e) => {
        const S = SL.settings;
        const action = kind === 'left' ? S.leftClick : kind === 'right' ? S.rightClick : S.middleClick;
        const li = lineIndexFn(e);
        const line = this.lines[li];
        const sentence = line ? line.text.replace(/\n/g, ' ') : '';
        const word = w.dataset.w;
        if (action === 'none') return;
        if (action === 'speak') { SL.speak(word); return; }
        if (action === 'learning' || action === 'known') {
          const lemma = SL.lemma(word);
          const cur = SL.words[lemma] && SL.words[lemma].status;
          const st = cur === action ? null : action;
          await SL.send('vocab:mark', { lemma, word, status: st, context: st ? { text: sentence, translation: this.trans[li] || '', source: this.source(line) } : null });
          SL.toast(st ? `«${lemma}» → ${SL.STATUS_LABEL[st]}` : `«${lemma}»: отметка снята`, 1200);
          return;
        }
        this.openDict(word, li, w.getBoundingClientRect(), action === 'dictSpeak', w);
      };
      root.addEventListener('click', e => {
        const w = e.target.closest('.sl-w');
        if (!w) return;
        const sel = (root.getRootNode().getSelection ? root.getRootNode().getSelection() : getSelection());
        if (sel && !sel.isCollapsed && String(sel).trim().includes(' ')) return;
        e.preventDefault(); e.stopPropagation();
        if (e.ctrlKey || e.metaKey) { this._multiClick(w, lineIndexFn(e)); return; }
        act('left', w, e);
      });
      root.addEventListener('contextmenu', e => {
        const w = e.target.closest('.sl-w');
        if (!w || SL.settings.rightClick === 'none') return;
        e.preventDefault(); e.stopPropagation();
        act('right', w, e);
      });
      root.addEventListener('auxclick', e => {
        if (e.button !== 1) return;
        const w = e.target.closest('.sl-w');
        if (!w) return;
        e.preventDefault(); e.stopPropagation();
        act('middle', w, e);
      });
      root.addEventListener('mousedown', e => { if (e.button === 1 && e.target.closest('.sl-w')) e.preventDefault(); });
      root.addEventListener('mouseup', e => {
        setTimeout(() => {
          const sel = (root.getRootNode().getSelection ? root.getRootNode().getSelection() : getSelection());
          if (!sel || sel.isCollapsed) return;
          const txt = String(sel).replace(/\s+/g, ' ').trim();
          if (!txt || !txt.includes(' ') || txt.length > 300) return;
          if (!root.contains(sel.anchorNode)) return;
          const li = lineIndexFn(e);
          const line = this.lines[li];
          let rect = null;
          try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch (er) {}
          this._pauseForDict();
          SL.Dict.show({ phrase: txt, sentence: line ? line.text.replace(/\n/g, ' ') : '', rect, source: this.source(line), onClose: () => this._dictClosed() });
        }, 10);
      });
    }

    _pauseForDict() {
      const v = this.a.getVideo();
      if (SL.settings.pauseOnDict && v && !v.paused) { this.a.pause(); this.pausedBy = 'dict'; }
      else if (this.pausedBy === 'hover') this.pausedBy = 'dict';
    }
    /* Ctrl + клик по словам → фраза (отпустите Ctrl, чтобы перевести) */
    _multiClick(w, li) {
      const box = w.closest('.sl-ro') || w.closest('.sl-orig') || w.parentElement;
      const m0 = this._multi;
      if (m0 && m0.box === box && box.isConnected && m0.li === li) {
        // продолжаем ту же группу (даже если Ctrl отпускали и перевод уже открывался)
        if (m0.done) { m0.done = false; if (SL.Dict.open) SL.Dict.close(); this._pauseForDict(); }
      } else {
        this._clearMulti();
        if (SL.Dict.open) SL.Dict.close();
        this._multi = { box, li, picked: new Set() };
        this._pauseForDict();
        this._flash('Ctrl: выберите слова, отпустите Ctrl — перевод фразы', 2500);
      }
      const words = [...box.querySelectorAll('.sl-w')];
      const i = words.indexOf(w);
      if (i < 0) return;
      const m = this._multi;
      if (m.picked.has(i) && m.picked.size > 1) m.picked.delete(i); else m.picked.add(i);
      this._applyMulti();
    }
    // перерисовать выделение (после клика или после перерисовки строки)
    _applyMulti() {
      const m = this._multi;
      if (!m || !m.box.isConnected || !m.picked.size) return;
      const words = [...m.box.querySelectorAll('.sl-w')];
      const idx = [...m.picked].filter(k => k < words.length);
      if (!idx.length) { this._clearMulti(); return; }
      const a = Math.min(...idx), b = Math.max(...idx);
      words.forEach((el, k) => el.classList.toggle('sl-sel', k >= a && k <= b));
      // пока выбирается фраза — подсветку произносимого слова убираем, чтобы не мешала
      m.box.querySelectorAll('.sl-now, .sl-said').forEach(el => el.classList.remove('sl-now', 'sl-said'));
      if (m.box === this.origEl) this._nowIdx = -1;
      SL.selMark(m.box, words[a], words[b]);
    }
    _clearMulti() {
      if (this._multi && this._multi.box) { this._multi.box.querySelectorAll('.sl-sel').forEach(el => el.classList.remove('sl-sel')); SL.clearSelMark(this._multi.box); }
      this._multi = null;
    }
    _finishMulti() {
      const m = this._multi;
      if (!m || !m.picked.size || !m.box.isConnected) { this._clearMulti(); return; }
      const words = [...m.box.querySelectorAll('.sl-w')];
      const idx = [...m.picked];
      const a = Math.min(...idx), b = Math.max(...idx);
      const line = this.lines[m.li];
      if (a === b) {
        m.done = true;
        this._flash('');
        this.openDict(words[a].dataset.w, m.li, words[a].getBoundingClientRect(), false, words[a]);
        return;
      }
      const text = SL.rangeText(words[a], words[b]);
      const r1 = words[a].getBoundingClientRect(), r2 = words[b].getBoundingClientRect();
      const rect = { left: Math.min(r1.left, r2.left), right: Math.max(r1.right, r2.right), top: Math.min(r1.top, r2.top), bottom: Math.max(r1.bottom, r2.bottom) };
      rect.width = rect.right - rect.left; rect.height = rect.bottom - rect.top;
      m.done = true;
      this._flash('');
      // выделение остаётся: Ctrl + клик добавит слова, обычный клик или Esc — сбросит
      SL.Dict.show({ phrase: text, sentence: line ? line.text.replace(/\n/g, ' ') : '', rect, source: this.source(line), onClose: () => { this._dictClosed(); } });
    }

    _dictClosed() {
      if (this.activeWordEl) { this.activeWordEl.classList.remove('sl-active'); this.activeWordEl = null; }
      if (this.pausedBy === 'dict' && !this.overLines) { this.pausedBy = null; this.a.play(); }
      else if (this.pausedBy === 'dict') this.pausedBy = 'hover';
    }

    openDict(word, li, rect, speak, el) {
      this._pauseForDict();
      if (this.activeWordEl) this.activeWordEl.classList.remove('sl-active');
      if (el) { el.classList.add('sl-active'); this.activeWordEl = el; }
      const line = this.lines[li];
      SL.Dict.show({
        word, rect, speak,
        sentence: line ? line.text.replace(/\n/g, ' ') : '',
        sentenceTranslation: this.trans[li] || '',
        source: this.source(line),
        getExamples: (lemma) => this.examplesFor(lemma, li),
        onJump: (t) => { this.a.seek(t + (this.offset || 0)); },
        onClose: () => this._dictClosed()
      });
    }

    source(line) {
      const base = this.a.source ? this.a.source() : { type: this.a.name, url: location.href, title: document.title };
      return Object.assign({}, base, { time: line ? Math.floor(line.start) : 0 });
    }

    examplesFor(lemma, skip) {
      const out = [];
      for (let i = 0; i < this.tokens.length && out.length < 4; i++) {
        if (i === skip) continue;
        const tk = this.tokens[i];
        if (tk && tk.lemmas.has(lemma)) out.push({ text: this.lines[i].text.replace(/\n/g, ' '), tr: this.trans[i] || '', time: this.lines[i].start, jump: true });
      }
      return out;
    }

    /* ---------------- data ---------------- */
    setMeta(meta) { this.meta = meta || {}; this._renderHeader(); }
    setStatus(msg) { this.statusMsg = msg || ''; this.render(true); this._renderPanelBody(); }
    setTransStatus(msg) { this.transStatus = msg || ''; this.render(true); }

    setLines(lines) {
      this.lines = lines || [];
      this.trans = new Array(this.lines.length).fill('');
      this.tokens = this.lines.map(l => {
        const lemmas = new Set();
        SL.tokenize(l.text).forEach(t => { if (t.t === 'w') lemmas.add(SL.lemma(t.text)); });
        return { lemmas };
      });
      this.shown = -2; this.activeLine = -1; this.autoPausedFor = -1; this.repeatLine = -1;
      this.wordTr = {};
      this.statusMsg = '';
      this._wordStats = null;
      this.render(true);
      this._renderPanelBody(true);
    }

    setTranslations(arr) {
      this.trans = arr || new Array(this.lines.length).fill('');
      this.transStatus = '';
      this.render(true);
      this._renderPanelBody(true);
    }

    setTrackOptions(orig, trans) {
      this.trackOptions = orig || [];
      this.transOptions = trans || [];
      this._renderBar();
    }

    /* ---------------- settings ---------------- */
    applySettings() {
      const S = SL.settings;
      if (!this.ov) return;
      const c = this.container();
      const hgt = (c && c.clientHeight) || window.innerHeight;
      const scale = Math.max(0.55, Math.min(1.8, hgt / 720));
      const fs = Math.round(S.fontSize * scale);
      const fam = { default: '', serif: 'Georgia, "Times New Roman", serif', mono: 'Consolas, "Courier New", monospace', round: '"Trebuchet MS", "Comic Sans MS", sans-serif', netflix: '"Netflix Sans", "Helvetica Neue", Arial, sans-serif' }[S.fontFamily] || '';
      this.ov.style.bottom = S.bottomOffset + '%';
      this.origEl.style.fontSize = fs + 'px';
      this.transEl.style.fontSize = Math.round(fs * S.transFontScale) + 'px';
      [this.origEl, this.transEl].forEach(e => { e.style.background = `rgba(0,0,0,${S.subBackground})`; e.style.fontFamily = fam; });
      this.ov.classList.toggle('sl-hidden', !S.enabled || !!this.overlayHidden);
      if (this.panel) {
        this.panel.style.width = (this.a.panelWidth ? this.a.panelWidth(S.panelWidth) : S.panelWidth) + 'px';
        this.panel.classList.toggle('sl-hidden', !S.enabled || !S.panelOpen || !!this.a.noPanel);
      }
      this.a.applyNative && this.a.applyNative(S);
      this.applyLayout();
      this._renderBar();
      this.render(true);
      this.refreshColors();
    }

    applyLayout() {
      const S = SL.settings;
      if (this.a.layout) this.a.layout(S.enabled && S.panelOpen && !this.a.noPanel && !document.fullscreenElement ? S.panelWidth : 0);
    }

    /* ---------------- main loop ---------------- */
    tick() {
      const v = this.a.getVideo();
      if (!v || !this.lines) return;
      this._placeHosts();
      const S = SL.settings;
      if (!S.enabled) return;
      const ad = this.a.isAd && this.a.isAd();
      this.ov.style.visibility = ad ? 'hidden' : '';
      if (ad) return;
      this._watchMouse(this.container());
      this._updateLift(v);
      const t = v.currentTime - (this.offset || 0);
      const L = this.lines;
      const idx = SL.findLine(L, t);
      const inside = idx >= 0 && t < L[idx].end;
      if (inside) this.activeLine = idx;

      // infinite repeat
      if (S.infiniteRepeat && this.repeatLine >= 0 && L[this.repeatLine] && !v.paused) {
        const r = L[this.repeatLine];
        if (t >= r.end - 0.05 || t < r.start - 1) { this.a.seek(r.start + (this.offset || 0) + 0.01); this.autoPausedFor = -1; return; }
      }
      // auto-pause at end of line
      else if (S.autoPause && !v.paused && this.activeLine >= 0) {
        const l = L[this.activeLine];
        if (l && this.autoPausedFor !== this.activeLine && t >= l.end - 0.1 && t < l.end + 0.6) {
          this.autoPausedFor = this.activeLine;
          this.a.pause();
          this.pausedBy = 'auto';
          this._flash('АВТОПАУЗА · пробел — продолжить');
        }
      }
      // slow segments
      if (S.slowSegments) {
        const want = +(inside ? this.userRate * S.slowRate : this.userRate).toFixed(3);
        if (Math.abs(v.playbackRate - want) > 0.01) this._setRate(v, want);
      }
      let disp = -1;
      if (inside) disp = idx;
      else if (S.keepLastLine && idx >= 0 && t - L[idx].end < 5) disp = idx;
      if (disp !== this.shown) {
        if (this._multi && this._multi.box === this.origEl && this._multi.li !== disp) this._clearMulti();
        this.shown = disp; this.transRevealed = false; this.render(); this._highlightRow(disp);
      }
      if (S.wordHighlight) this._karaoke(t, inside);
      if (v.paused && this.pausedBy !== 'auto' && this.badgeEl.dataset.k === 'auto') this._flash('');
    }

    // Подсветка слова, которое сейчас произносится
    _karaoke(t, inside) {
      if (this._multi && this._multi.box === this.origEl) return;
      const els = this._wordEls, times = this._wordTimes;
      if (!els || !times || !els.length) return;
      let k = -1;
      if (inside) { for (let i = 0; i < times.length; i++) { if (times[i] <= t + 0.05) k = i; else break; } }
      if (k === this._nowIdx) return;
      if (this._nowIdx >= 0 && els[this._nowIdx]) els[this._nowIdx].classList.remove('sl-now');
      els.forEach((e, i) => e.classList.toggle('sl-said', inside && i < k));
      if (k >= 0 && els[k]) els[k].classList.add('sl-now');
      this._nowIdx = k;
    }

    _setRate(v, r) {
      this._ownRate = r;
      if (this.a.setRate) this.a.setRate(r); else v.playbackRate = r;
    }
    _watchRate() {
      const v = this.a.getVideo();
      if (!v || v._slRate) return;
      v._slRate = true;
      v.addEventListener('ratechange', () => {
        if (this._ownRate && Math.abs(v.playbackRate - this._ownRate) < 0.01) return;
        this.userRate = v.playbackRate; this._renderBar();
      });
      v.addEventListener('play', () => { if (this.pausedBy === 'auto') this.pausedBy = null; this._flash(''); });
    }

    _flash(msg, ms) {
      const b = this.badgeEl;
      clearTimeout(this._flashT);
      if (!msg) { b.style.display = 'none'; b.dataset.k = ''; return; }
      b.textContent = msg; b.style.display = '';
      b.dataset.k = msg.startsWith('АВТОПАУЗА') ? 'auto' : '';
      if (ms) this._flashT = setTimeout(() => { b.style.display = 'none'; }, ms);
    }

    render(force) {
      if (!this.ov) return;
      this._watchRate();
      const S = SL.settings;
      const i = this.shown;
      const line = this.lines[i];
      if (this.statusMsg && !this.lines.length) {
        this.statusEl.style.display = ''; this.statusEl.textContent = this.statusMsg;
      } else this.statusEl.style.display = 'none';
      if (!line) { this.origEl.style.display = 'none'; this.transEl.style.display = 'none'; this._updateControls(); return; }
      const dim = this.a.getVideo() && this.a.getVideo().currentTime - (this.offset || 0) > line.end + 0.05;
      if (S.showOriginal) {
        this.origEl.style.display = '';
        this.origEl.innerHTML = SL.renderTokensHTML(line.text);
        this.origEl.style.opacity = dim ? '0.75' : '1';
        this._wordEls = [...this.origEl.querySelectorAll('.sl-w, .sl-n')];
        this._wordTimes = S.wordHighlight ? SL.wordTimes(line) : null;
        this._nowIdx = -1;
      } else this.origEl.style.display = 'none';
      const tr = this.trans[i];
      if (S.showTranslation && S.translationMode !== 'off' && (tr || this.transStatus)) {
        this.transEl.style.display = '';
        this.transEl.textContent = tr || this.transStatus;
        this.transEl.classList.toggle('sl-blur', !!(S.blurTranslation && !this.transRevealed && tr));
        this.transEl.style.opacity = dim ? '0.7' : '1';
      } else this.transEl.style.display = 'none';
      this._updateControls();
    }

    _menu(open) {
      if (!this.menuEl) return;
      const m = this.menuEl;
      m.style.display = open ? '' : 'none';
      this._menuOpen = !!open;
      this.ov.classList.toggle('sl-menuopen', !!open);
      if (!open) return;
      // уместить меню внутри плеера: вверх, если есть место, иначе вниз, иначе с прокруткой
      m.style.top = ''; m.style.bottom = ''; m.style.maxHeight = '';
      const c = this.container();
      const cr = c ? c.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
      const br = m.parentElement.getBoundingClientRect();
      const need = m.scrollHeight + 12;
      const above = br.top - cr.top, below = cr.bottom - br.bottom;
      if (above >= need) return;
      if (below >= need || below > above) { m.style.bottom = 'auto'; m.style.top = 'calc(100% + 10px)'; m.style.maxHeight = Math.max(120, below - 16) + 'px'; }
      else m.style.maxHeight = Math.max(120, above - 16) + 'px';
    }

    // Поднимаем субтитры, только когда указатель над панелью управления плеера (шкала перемотки, кнопки),
    // чтобы она не перекрывалась. Если вести мышь к субтитрам — они остаются на месте.
    _updateLift(v) {
      if (!this.ov) return;
      if (this._menuOpen || SL.Dict.open || this.overLines) return;
      const c = this.container();
      const h = (c && c.clientHeight) || 0;
      const now = Date.now();
      const ctrl = h ? (this.a.controlsHeight ? this.a.controlsHeight(h) : (h > 560 ? 92 : 78)) : 0;
      if (h && this._ptrAt && now - this._ptrAt < 2500 && this._ptrY > h - ctrl - 14) this._bandAt = now;
      let lift = 0;
      if (h && now - (this._bandAt || 0) < 1300) {
        const bottomPx = h * SL.settings.bottomOffset / 100;
        lift = Math.max(0, Math.round(ctrl + 12 - bottomPx));
      }
      if (lift !== this._lift) { this._lift = lift; this.ov.style.transform = lift ? `translateY(-${lift}px)` : ''; }
    }
    _watchMouse(c) {
      if (!c || this._mouseC === c) return;
      this._mouseC = c;
      c.addEventListener('mousemove', (e) => { const r = c.getBoundingClientRect(); this._ptrY = e.clientY - r.top; this._ptrAt = Date.now(); }, { passive: true });
      c.addEventListener('mouseleave', () => { this._ptrAt = 0; }, { passive: true });
      document.documentElement.addEventListener('mouseleave', () => { this._ptrAt = 0; }, { passive: true });
    }

    _updateControls() {
      const S = SL.settings;
      const q = (c) => this.ov.querySelector(`[data-c="${c}"]`);
      q('slow').classList.toggle('on', !!S.slowSegments);
      q('karaoke').classList.toggle('on', !!S.wordHighlight);
      const sy = this.ov.querySelector('.sl-sync'); if (sy) sy.textContent = ((this.offset || 0) > 0 ? '+' : '') + (this.offset || 0).toFixed(2) + 'с';
      q('autopause').classList.toggle('on', !!S.autoPause);
      q('loop').classList.toggle('on', !!(S.infiniteRepeat && this.repeatLine >= 0));
      q('trans').classList.toggle('on', !!S.showTranslation);
      q('panel').classList.toggle('on', !!(S.panelOpen && !this.a.noPanel));
      const line = this.lines[this.shown];
      const saved = line && Object.values(SL.phrases).some(p => p.text === line.text.replace(/\n/g, ' '));
      q('save').textContent = saved ? '★' : '☆';
    }

    refreshColors() {
      this.render(true);
      setTimeout(() => this._applyMulti(), 0);
      if (this.panel && SL.settings.panelOpen) {
        this.listEl && this.listEl.querySelectorAll('.sl-ro').forEach(el => {
          const i = Number(el.dataset.i);
          if (this.lines[i]) el.innerHTML = SL.renderTokensHTML(this.lines[i].text, { br: false });
        });
        if (this.tab === 'words' || this.tab === 'saved') this._renderPanelBody(true);
        this._renderFooter();
      }
    }

    /* ---------------- commands ---------------- */
    curIndex() {
      const v = this.a.getVideo();
      if (!v) return -1;
      if (this.shown >= 0) return this.shown;
      return SL.findLine(this.lines, v.currentTime - (this.offset || 0));
    }
    seekLine(i, play) {
      if (!this.lines.length) return;
      i = Math.max(0, Math.min(this.lines.length - 1, i));
      this.autoPausedFor = -1;
      this.activeLine = i;
      if (SL.settings.infiniteRepeat) this.repeatLine = i;
      this.a.seek(this.lines[i].start + (this.offset || 0) + 0.01);
      if (play !== false) { this.pausedBy = null; this.a.play(); }
      this.shown = -2;
    }

    async command(c) {
      const S = SL.settings;
      const v = this.a.getVideo();
      const t = v ? v.currentTime - (this.offset || 0) : 0;
      const i = this.curIndex();
      switch (c) {
        case 'prev': {
          const inside = i >= 0 && this.lines[i] && t < this.lines[i].end;
          // если реплика только началась — к предыдущей, иначе тоже к предыдущей (как в оригинале: A = назад)
          this.seekLine(inside || i < 0 ? i - 1 : i); break;
        }
        case 'repeat': this.seekLine(i < 0 ? 0 : i); break;
        case 'next': {
          const n = SL.findLine(this.lines, t) + 1;
          this.seekLine(Math.max(n, i + 1)); break;
        }
        case 'autopause': await SL.saveSettings({ autoPause: !S.autoPause }); this._flash('Автопауза: ' + (SL.settings.autoPause ? 'вкл' : 'выкл'), 1200); break;
        case 'loop': {
          const on = !(S.infiniteRepeat && this.repeatLine >= 0);
          this.repeatLine = on ? Math.max(0, i) : -1;
          await SL.saveSettings({ infiniteRepeat: on });
          this._flash(on ? 'Повтор реплики: вкл' : 'Повтор реплики: выкл', 1200); break;
        }
        case 'trans':
          if (S.blurTranslation) { this.transRevealed = !this.transRevealed; this.render(true); }
          else await SL.saveSettings({ showTranslation: !S.showTranslation });
          break;
        case 'overlay': this.overlayHidden = !this.overlayHidden; this.applySettings(); break;
        case 'panel':
          if (this.a.togglePanel) { this.a.togglePanel(); this.applySettings(); break; }
          await SL.saveSettings({ panelOpen: !S.panelOpen }); break;
        case 'syncMinus': case 'syncPlus':
          this.offset = Math.round(((this.offset || 0) + (c === 'syncPlus' ? 0.25 : -0.25)) * 100) / 100;
          this.shown = -2;
          this._flash('Сдвиг субтитров: ' + (this.offset > 0 ? '+' : '') + this.offset.toFixed(2) + ' с', 1200);
          this._renderBar();
          break;
        case 'copy': {
          const l = this.lines[i]; if (!l) break;
          try { await navigator.clipboard.writeText(l.text.replace(/\n/g, ' ')); this._flash('Скопировано', 900); } catch (e) { this._flash('Не удалось скопировать', 1200); }
          break;
        }
        case 'save': {
          const l = this.lines[i]; if (!l) break;
          const text = l.text.replace(/\n/g, ' ');
          const ex = Object.values(SL.phrases).find(p => p.text === text);
          if (ex) { await SL.send('vocab:removePhrase', { id: ex.id }); this._flash('Фраза удалена', 1000); }
          else { await SL.send('vocab:savePhrase', { text, translation: this.trans[i] || '', source: this.source(l) }); this._flash('★ Фраза сохранена', 1000); }
          break;
        }
        case 'speak': { const l = this.lines[i]; if (l) SL.speak(l.text.replace(/\n/g, ' ')); break; }
        case 'slower': case 'faster': case 'normal': {
          let r = c === 'normal' ? 1 : this.userRate + (c === 'faster' ? 0.1 : -0.1);
          r = Math.round(Math.max(0.3, Math.min(2.5, r)) * 100) / 100;
          this.userRate = r;
          if (v) this._setRate(v, S.slowSegments && t < ((this.lines[i] || {}).end || 0) ? r * S.slowRate : r);
          this._flash('Скорость ' + r.toFixed(2) + '×', 900);
          this._renderBar();
          break;
        }
        case 'karaoke':
          await SL.saveSettings({ wordHighlight: !S.wordHighlight });
          this.shown = -2;
          this._flash('Подсветка слова: ' + (SL.settings.wordHighlight ? 'вкл (эксперимент)' : 'выкл'), 1400);
          break;
        case 'slow':
          await SL.saveSettings({ slowSegments: !S.slowSegments });
          if (!SL.settings.slowSegments && v) this._setRate(v, this.userRate);
          this._flash(SL.settings.slowSegments ? 'Медленная речь: ' + S.slowRate + '×' : 'Медленная речь: выкл', 1200);
          break;
        case 'playpause': if (v) { if (v.paused) { this.pausedBy = null; this.a.play(); } else this.a.pause(); } break;
      }
      this._updateControls();
      this._renderBar();
    }

    _onKey(e) {
      const S = SL.settings;
      if (!S.enabled || e.ctrlKey || e.metaKey || e.altKey) return;
      const path = e.composedPath ? e.composedPath() : [e.target];
      const tgt = path[0];
      if (tgt && (tgt.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName))) return;
      if (!this.a.getVideo()) return;
      let c = null;
      const k = e.key;
      const map = { a: 'prev', s: 'repeat', d: 'next', q: 'autopause', r: 'loop', e: 'trans', w: 'save', c: 'copy', x: 'speak', v: 'overlay', b: 'panel', '[': 'slower', ']': 'faster', '\\': 'normal', z: 'slow', 'я': 'slow', h: 'karaoke', 'р': 'karaoke', 'ф': 'prev', 'ы': 'repeat', 'в': 'next', 'й': 'autopause', 'к': 'loop', 'у': 'trans', 'ц': 'save', 'с': 'copy', 'ч': 'speak', 'м': 'overlay', 'и': 'panel', 'х': 'slower', 'ъ': 'faster' };
      if (!e.shiftKey) c = map[k.toLowerCase()];
      else if (k === '{' || k === 'Х') c = 'syncMinus';
      else if (k === '}' || k === 'Ъ') c = 'syncPlus';
      if (S.overrideArrows && !e.shiftKey) {
        if (k === 'ArrowLeft') c = 'prev'; else if (k === 'ArrowRight') c = 'next'; else if (k === 'ArrowDown') c = 'repeat';
      }
      if (k === ' ' && this.pausedBy === 'auto') c = 'playpause';
      if (!c) return;
      if (SL.Dict.open && /^[123]$/.test(k)) return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      this.command(c);
    }

    /* ---------------- panel ---------------- */
    _buildPanel() {
      const h = this.pnHost = SL.makeHost('sl-panel-host-' + this.a.name);
      const p = this.panel = SL.el('div', { class: 'sl-panel sl-root' });
      p.innerHTML = `<div class="sl-resize" title="Потяните, чтобы изменить ширину"></div>
        <div class="sl-ph"><span class="sl-logo">SubLingo</span><span class="sl-title"></span>
          <button class="sl-ibtn" data-p="settings" title="Настройки">⚙</button>
          <button class="sl-ibtn" data-p="close" title="Скрыть панель (B)">✕</button></div>
        <div class="sl-bar"></div>
        <div class="sl-tabs">
          <button class="sl-tab on" data-tab="subs">Субтитры</button>
          <button class="sl-tab" data-tab="words">Слова</button>
          <button class="sl-tab" data-tab="saved">Сохранённое</button>
          <button class="sl-tab" data-tab="help">Клавиши</button></div>
        <div class="sl-body"></div>
        <div class="sl-foot"></div>`;
      h.shadow.appendChild(p);
      this.barEl = p.querySelector('.sl-bar');
      this.bodyEl = p.querySelector('.sl-body');
      this.footEl = p.querySelector('.sl-foot');
      ['keydown', 'keyup', 'keypress'].forEach(ev => p.addEventListener(ev, e => { if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) e.stopPropagation(); }));
      p.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
      p.addEventListener('click', e => {
        const b = e.target.closest('[data-p],[data-tab],[data-cmd],[data-seek],[data-star],[data-tts],[data-wf],[data-wm],[data-open],[data-gx]');
        if (!b) return;
        if (b.dataset.tab) { this.tab = b.dataset.tab; p.querySelectorAll('.sl-tab').forEach(x => x.classList.toggle('on', x === b)); this._renderPanelBody(true); return; }
        if (b.dataset.gx) { this.a.onExtra && this.a.onExtra(b.dataset.gx, b); return; }
        if (b.dataset.p === 'close') { if (this.a.togglePanel) { this.command('panel'); return; } SL.saveSettings({ panelOpen: false }); return; }
        if (b.dataset.p === 'settings') { SL.send('open', { page: 'options.html' }); return; }
        if (b.dataset.cmd) { this.command(b.dataset.cmd); return; }
        if (b.dataset.open) { SL.send('open', { page: b.dataset.open }); return; }
        if (b.dataset.star != null) { const i = Number(b.dataset.star); const sv = this.shown; this.shown = i; this.command('save').then(() => { this.shown = sv; this._renderPanelBody(true); }); return; }
        if (b.dataset.tts != null) { const l = this.lines[Number(b.dataset.tts)]; if (l) SL.speak(l.text.replace(/\n/g, ' ')); return; }
        if (b.dataset.wf) { this.wordsFilter = b.dataset.wf; this._renderPanelBody(true); return; }
        if (b.dataset.wm) { const [st, lemma] = b.dataset.wm.split('|'); const cur = SL.words[lemma] && SL.words[lemma].status; SL.send('vocab:mark', { lemma, word: lemma, status: cur === st ? null : st, context: this._ctxFor(lemma) }); return; }
        if (b.dataset.seek != null && !e.target.closest('.sl-w')) { this.follow = true; this.seekLine(Number(b.dataset.seek)); }
      });
      p.addEventListener('change', e => {
        const t = e.target;
        if (t.dataset.sel === 'track' && this.onTrackChange) this.onTrackChange(t.value);
        if (t.dataset.sel === 'trans') { SL.saveSettings({ translationMode: t.value }); if (this.onTransChange) this.onTransChange(t.value); }
      });
      p.addEventListener('input', e => {
        if (e.target.dataset.f === 'filter') { this.filter = e.target.value.toLowerCase(); this._applyFilter(); }
      });
      // words in rows → dictionary
      this._wireWords(p, (e) => {
        const r = e.target.closest('[data-li]');
        return r ? Number(r.dataset.li) : this.shown;
      });
      // resize
      const rz = p.querySelector('.sl-resize');
      rz.addEventListener('mousedown', e => {
        e.preventDefault();
        const move = (ev) => { const w = Math.max(260, Math.min(window.innerWidth * 0.7, window.innerWidth - ev.clientX)); p.style.width = w + 'px'; this.a.layout && !document.fullscreenElement && this.a.layout(w); };
        const up = (ev) => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); SL.saveSettings({ panelWidth: parseInt(p.style.width, 10) }); };
        window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
      });
      this.bodyEl.addEventListener('scroll', () => { if (!this._autoScrolling) this.followHold = Date.now() + 4000; });
      this._renderBar();
      this._renderPanelBody(true);
    }

    _ctxFor(lemma) {
      for (let i = 0; i < this.tokens.length; i++) if (this.tokens[i].lemmas.has(lemma)) return { text: this.lines[i].text.replace(/\n/g, ' '), translation: this.trans[i] || '', source: this.source(this.lines[i]) };
      return null;
    }

    _renderHeader() {
      if (!this.panel) return;
      this.panel.querySelector('.sl-title').textContent = this.meta.title || '';
    }

    _renderBar() {
      if (!this.barEl) return;
      const S = SL.settings;
      const opt = (arr, val) => arr.map(o => `<option value="${SL.esc(o.value)}" ${o.value === val ? 'selected' : ''}>${SL.esc(o.label)}</option>`).join('');
      const tr = [{ value: 'auto', label: 'Перевод: авто' }, { value: 'human', label: 'Перевод: человеческий' }, { value: 'machine', label: 'Перевод: Google' }].concat(this.a.name === 'youtube' ? [{ value: 'youtube', label: 'Перевод: YouTube авто' }] : []).concat([{ value: 'off', label: 'Без перевода' }]);
      const html = `
        ${this.trackOptions.length ? `<select data-sel="track" title="Субтитры оригинала">${opt(this.trackOptions, this.currentTrack)}</select>` : ''}
        <select data-sel="trans" title="Источник перевода">${opt(tr, S.translationMode)}</select>
        <button class="sl-chip ${S.autoPause ? 'on' : ''}" data-cmd="autopause" title="Q">Автопауза</button>
        <button class="sl-chip ${S.infiniteRepeat && this.repeatLine >= 0 ? 'on' : ''}" data-cmd="loop" title="R">Повтор</button>
        <button class="sl-chip ${S.slowSegments ? 'on' : ''}" data-cmd="slow" title="Замедлять речь до ${S.slowRate}× (Z)">Медленно</button>
        <button class="sl-chip" data-cmd="slower">−</button><span class="sl-muted">${(this.userRate || 1).toFixed(2)}×</span><button class="sl-chip" data-cmd="faster">+</button>
        <button class="sl-chip" data-cmd="syncMinus" title="Субтитры раньше (Shift+[)">⏪</button><span class="sl-muted" title="Сдвиг синхронизации">${(this.offset || 0) > 0 ? '+' : ''}${(this.offset || 0).toFixed(2)}с</span><button class="sl-chip" data-cmd="syncPlus" title="Субтитры позже (Shift+])">⏩</button>
        ${this.a.barExtra ? this.a.barExtra() : ''}`;
      if (this._barHtml !== html) { this._barHtml = html; this.barEl.innerHTML = html; }
      this._renderFooter();
    }

    _renderFooter() {
      if (!this.footEl) return;
      const now = Date.now();
      let due = 0;
      for (const k in SL.words) { const w = SL.words[k]; if (w.status === 'learning' && w.srs && (!w.srs.seen || w.srs.due <= now)) due++; }
      for (const k in SL.phrases) { const p = SL.phrases[k]; if (p.srs && (!p.srs.seen || p.srs.due <= now)) due++; }
      this.footEl.innerHTML = `<button class="sl-btn primary" data-open="review.html">Повторить (${due})</button>
        <button class="sl-btn" data-open="vocab.html">Мои слова</button>
        <button class="sl-btn" data-open="reader.html">Чтение</button>
        <span style="margin-left:auto">${this.lines.length ? this.lines.length + ' реплик' : ''}</span>`;
    }

    _highlightRow(i) {
      if (!this.listEl || this.tab !== 'subs') return;
      const prev = this.listEl.querySelector('.sl-row.cur');
      if (prev) prev.classList.remove('cur');
      const row = this.listEl.querySelector(`.sl-row[data-li="${i}"]`);
      if (!row) return;
      row.classList.add('cur');
      if (this.follow && Date.now() > this.followHold && SL.settings.panelOpen) {
        const body = this.bodyEl;
        const top = row.offsetTop - body.clientHeight * 0.35;
        this._autoScrolling = true;
        body.scrollTo({ top, behavior: 'smooth' });
        setTimeout(() => { this._autoScrolling = false; }, 600);
      }
    }

    _applyFilter() {
      if (!this.listEl) return;
      const f = this.filter;
      this.listEl.querySelectorAll('.sl-row').forEach(r => {
        const i = Number(r.dataset.li);
        r.style.display = !f || this.lines[i].text.toLowerCase().includes(f) || (this.trans[i] || '').toLowerCase().includes(f) ? '' : 'none';
      });
    }

    _renderPanelBody(force) {
      if (!this.bodyEl) return;
      const S = SL.settings;
      if (this.tab === 'help') {
        this.bodyEl.innerHTML = `<div class="sl-help">${HELP.map(([k, d]) => `<div><span class="sl-kbd">${SL.esc(k)}</span> ${SL.esc(d)}</div>`).join('')}
          <div style="margin-top:10px" class="sl-muted">Клавиши работают и в русской раскладке. Стрелки можно включить в настройках.</div></div>`;
        this.listEl = null; return;
      }
      if (!this.lines.length) {
        this.bodyEl.innerHTML = `<div class="sl-empty">${SL.esc(this.statusMsg || 'Субтитры не загружены')}</div>`;
        this.listEl = null; return;
      }
      if (this.tab === 'subs') {
        const scroll = this.bodyEl.scrollTop;
        const phr = new Set(Object.values(SL.phrases).map(p => p.text));
        let html = `<div class="sl-bar" style="position:sticky;top:0;background:#121214;z-index:2"><input type="text" class="sl-input" data-f="filter" placeholder="Поиск по субтитрам…" style="flex:1" value="${SL.esc(this.filter)}"></div><div class="sl-list">`;
        for (let i = 0; i < this.lines.length; i++) {
          const l = this.lines[i];
          const saved = phr.has(l.text.replace(/\n/g, ' '));
          html += `<div class="sl-row" data-li="${i}" data-seek="${i}"><div class="sl-rt">${SL.fmtTime(l.start)}</div><div class="sl-rc">
            <div class="sl-ro" data-i="${i}">${SL.renderTokensHTML(l.text, { br: false })}</div>
            ${S.panelShowTranslation && this.trans[i] ? `<div class="sl-rtr">${SL.esc(this.trans[i])}</div>` : ''}</div>
            <div class="sl-ra"><button class="sl-ibtn sl-star ${saved ? 'on' : ''}" data-star="${i}" title="Сохранить фразу">${saved ? '★' : '☆'}</button><button class="sl-ibtn" data-tts="${i}" title="Озвучить">🔊</button></div></div>`;
        }
        html += '</div>';
        this.bodyEl.innerHTML = html;
        this.listEl = this.bodyEl.querySelector('.sl-list');
        this._applyFilter();
        this.bodyEl.scrollTop = scroll;
        if (this.shown >= 0) { const r = this.listEl.querySelector(`.sl-row[data-li="${this.shown}"]`); if (r) r.classList.add('cur'); }
        return;
      }
      this.listEl = null;
      if (this.tab === 'words') return this._renderWords();
      if (this.tab === 'saved') return this._renderSaved();
    }

    _computeWordStats() {
      const map = new Map();
      let total = 0;
      this.lines.forEach((l, i) => {
        SL.tokenize(l.text).forEach(tk => {
          if (tk.t !== 'w') return;
          const c = SL.classify(tk.text, tk.sentStart);
          if (c.status === 'special') return;
          total++;
          let e = map.get(c.lemma);
          if (!e) { e = { lemma: c.lemma, surface: tk.text, count: 0, rank: c.rank, first: i }; map.set(c.lemma, e); }
          e.count++;
        });
      });
      return { map, total };
    }

    _renderWords() {
      const ws = this._computeWordStats();
      const arr = [...ws.map.values()];
      let k = 0, l = 0, u = 0;
      arr.forEach(e => {
        const c = SL.classify(e.lemma, true);
        e.status = c.status; e.marked = c.marked;
        if (c.status === 'known' || c.status === 'ignored') k += e.count; else if (c.status === 'learning') l += e.count; else u += e.count;
      });
      const pct = (n) => ws.total ? Math.round(n / ws.total * 100) : 0;
      const f = this.wordsFilter;
      const list = arr.filter(e => f === 'all' ? true : f === 'new' ? !['known', 'ignored', 'learning'].includes(e.status) : f === 'learning' ? e.status === 'learning' : e.status === 'known' || e.status === 'ignored')
        .sort((a, b) => b.count - a.count || (a.rank || 99999) - (b.rank || 99999));
      let html = `<div class="sl-cov">Вы знаете <b>${pct(k)}%</b> слов этого видео · учите ${pct(l)}% · новых ${pct(u)}%
        <div class="sl-covbar"><i style="width:${pct(k)}%;background:#22c55e"></i><i style="width:${pct(l)}%;background:#f97316"></i><i style="width:${pct(u)}%;background:#3b82f6"></i></div>
        <div class="sl-muted" style="margin-top:6px">${arr.length} уникальных слов. Уровень словаря: ${SL.settings.vocabLevel} слов — меняется в настройках.</div></div>
        <div class="sl-bar">${[['new', 'Новые'], ['learning', 'Учу'], ['known', 'Знаю'], ['all', 'Все']].map(([v, t]) => `<button class="sl-chip ${f === v ? 'on' : ''}" data-wf="${v}">${t}</button>`).join('')}
        <button class="sl-btn" data-act="trwords" style="margin-left:auto">Перевести список</button>
        ${f === 'new' ? '<button class="sl-btn" data-act="allknown" title="Отметить все слова из списка как известные">Все → знаю</button>' : ''}</div>`;
      html += list.slice(0, 600).map(e => `<div class="sl-wrow" data-li="${e.first}">
        <span class="sl-ww"><span class="${SL.statusClass(SL.classify(e.lemma, true))}" data-w="${SL.esc(e.lemma)}">${SL.esc(e.lemma)}</span></span>
        <span class="sl-wt">${SL.esc(this.wordTr[e.lemma] || (SL.words[e.lemma] && SL.words[e.lemma].translation) || '')}</span>
        <span class="sl-wc" title="Сколько раз в видео">×${e.count}</span>
        <button class="sl-mini k" data-wm="known|${SL.esc(e.lemma)}" title="Знаю">✓</button>
        <button class="sl-mini l" data-wm="learning|${SL.esc(e.lemma)}" title="Учу">★</button></div>`).join('');
      if (!list.length) html += '<div class="sl-empty">Пусто</div>';
      const scroll = this.bodyEl.scrollTop;
      this.bodyEl.innerHTML = html;
      this.bodyEl.scrollTop = scroll;
      const trBtn = this.bodyEl.querySelector('[data-act="trwords"]');
      trBtn && trBtn.addEventListener('click', async () => {
        trBtn.innerHTML = '<span class="sl-spin"></span>';
        const need = list.slice(0, 600).map(e => e.lemma).filter(x => !this.wordTr[x]);
        try { const res = await SL.send('translate', { texts: need, tl: SL.settings.targetLang }); need.forEach((w, i) => { this.wordTr[w] = res[i]; }); } catch (e) { SL.toast('Ошибка перевода: ' + e.message); }
        this._renderWords();
      });
      const akBtn = this.bodyEl.querySelector('[data-act="allknown"]');
      akBtn && akBtn.addEventListener('click', async () => {
        if (!confirm(`Отметить ${list.length} слов как известные?`)) return;
        await SL.send('vocab:markMany', { lemmas: list.map(e => e.lemma), status: 'known' });
      });
    }

    _renderSaved() {
      const src = this.a.source ? this.a.source() : {};
      const same = (s) => s && ((src.videoId && s.videoId === src.videoId) || (src.movieId && s.movieId === src.movieId) || (src.url && s.url === src.url && !src.videoId && !src.movieId));
      const words = Object.values(SL.words).filter(w => (w.contexts || []).some(c => same(c.source)));
      const phrases = Object.values(SL.phrases).filter(p => same(p.source));
      let html = `<div class="sl-cov">Из этого видео: ${words.length} слов, ${phrases.length} фраз</div>`;
      html += words.map(w => {
        const c = (w.contexts || []).find(x => same(x.source));
        return `<div class="sl-row" ${c && c.source && c.source.time != null ? `data-seek="${Math.max(0, SL.findLine(this.lines, c.source.time + 0.5))}"` : ''}><div class="sl-rc"><div class="sl-ro"><span class="${SL.statusClass(SL.classify(w.lemma, true))}" data-w="${SL.esc(w.lemma)}">${SL.esc(w.lemma)}</span> <span class="sl-muted">${SL.esc(w.translation || '')}</span></div>${c ? `<div class="sl-rtr">${SL.esc(c.text)}</div>` : ''}</div></div>`;
      }).join('');
      html += phrases.map(p => `<div class="sl-row" ${p.source && p.source.time != null ? `data-seek="${Math.max(0, SL.findLine(this.lines, p.source.time + 0.5))}"` : ''}><div class="sl-rc"><div class="sl-ro">★ ${SL.esc(p.text)}</div><div class="sl-rtr">${SL.esc(p.translation || '')}</div></div></div>`).join('');
      if (!words.length && !phrases.length) html += '<div class="sl-empty">Нажмите на слово и выберите «Учу», или ☆ рядом с репликой, чтобы сохранить фразу.</div>';
      this.bodyEl.innerHTML = html;
    }
  }

  SL.SubPlayer = SubPlayer;

  /* Shared translation loader used by site adapters.
     provider(kind) returns lines in target language for 'human'/'youtube', or null. */
  SL.loadTranslations = async function (player, opts) {
    const S = SL.settings;
    const mode = S.translationMode;
    const token = (player._trToken = (player._trToken || 0) + 1);
    if (mode === 'off' || !player.lines.length) { player.setTranslations(new Array(player.lines.length).fill('')); return; }
    player.setTransStatus('Загружаю перевод…');
    try {
      let lines = null;
      if (mode === 'human' || mode === 'auto') lines = opts.human ? await opts.human() : null;
      if (!lines && mode === 'youtube' && opts.youtube) lines = await opts.youtube();
      if (token !== player._trToken) return;
      if (lines && lines.length) { player.setTranslations(SL.alignTranslations(player.lines, lines)); return; }
      if (mode === 'human' || (mode === 'youtube' && !opts.youtube)) { player.setTranslations(new Array(player.lines.length).fill('')); player.setTransStatus(mode === 'human' ? 'Нет человеческого перевода — выберите «Google»' : 'Перевод недоступен'); return; }
      // machine: translate in chunks around current position first
      const texts = player.lines.map(l => l.text.replace(/\n/g, ' '));
      const res = new Array(texts.length).fill('');
      const v = player.a.getVideo();
      const start = Math.max(0, SL.findLine(player.lines, v ? v.currentTime : 0));
      const order = [];
      for (let i = start; i < texts.length; i += 60) order.push(i);
      for (let i = Math.max(0, start - 60); i >= 0; i -= 60) order.push(i);
      if (start > 0 && start < 60) order.push(0);
      const done = new Set();
      for (const from of order) {
        const a = Math.max(0, from), b = Math.min(texts.length, a + 60);
        if (done.has(a)) continue; done.add(a);
        const chunk = texts.slice(a, b);
        const out = await SL.send('translate', { texts: chunk, sl: 'en', tl: S.targetLang });
        if (token !== player._trToken) return;
        out.forEach((t, k) => { res[a + k] = t; });
        player.trans = res.slice();
        player.transStatus = '';
        player.render(true);
      }
      player.setTranslations(res);
    } catch (e) {
      if (token === player._trToken) player.setTransStatus('Перевод недоступен: ' + e.message);
    }
  };

})(SL);

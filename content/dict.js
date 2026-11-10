/* SubLingo — dictionary popup (works in content scripts and extension pages) */
var SL = (typeof SL !== 'undefined') ? SL : {};
(function (SL) {
  'use strict';

  SL.speak = function (text, opts) {
    const mode = SL.settings.ttsMode || 'manual';
    const auto = !!(opts && opts.auto);
    if (mode === 'off') { if (!auto) SL.toast('Синтетический голос выключен — включить можно в настройках («Озвучка»)', 1800); return Promise.resolve('off'); }
    if (mode === 'manual' && auto) return Promise.resolve('skip');
    opts = Object.assign({}, opts || {}); delete opts.auto;
    return SL.send('tts', Object.assign({ text }, opts)).catch(() => {
      try { const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = SL.settings.ttsRate || 1; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {}
    });
  };

  SL.toast = function (msg, ms) {
    const host = SL.makeHost('sl-toast-host');
    const t = document.createElement('div');
    t.className = 'sl-toast sl-root';
    t.textContent = msg;
    host.shadow.appendChild(t);
    setTimeout(() => t.remove(), ms || 1800);
  };

  // A shadow-DOM host. If a fullscreen element exists, the host is moved inside it so it stays visible.
  const hosts = {};
  SL.makeHost = function (id, parent) {
    let h = hosts[id];
    if (!h || !h.el.isConnected) {
      const el = document.createElement('sublingo-ui');
      el.id = id;
      el.style.cssText = 'all:initial;display:contents;';
      const shadow = el.attachShadow({ mode: 'open' });
      const st = document.createElement('style');
      st.textContent = SL.UI_CSS;
      shadow.appendChild(st);
      h = hosts[id] = { el, shadow, fixedParent: parent || null };
    }
    const target = h.fixedParent || document.fullscreenElement || document.body || document.documentElement;
    if (h.el.parentNode !== target) target.appendChild(h.el);
    return h;
  };
  document.addEventListener('fullscreenchange', () => {
    for (const id in hosts) { const h = hosts[id]; if (!h.fixedParent && h.el.isConnected) { const t = document.fullscreenElement || document.body; if (h.el.parentNode !== t) t.appendChild(h.el); } }
  });

  /* Перевод при наведении: маленькая подсказка над словом, клик — полная карточка */
  const tipCache = new Map();
  let tipEl = null, tipFor = null;
  function hideTip() { tipFor = null; if (tipEl) tipEl.classList.remove('show'); }
  async function showTip(w) {
    const isX = w.classList.contains('sl-xp');
    const word = isX ? w.dataset.x : w.dataset.w;
    if (!word) return;
    tipFor = w;
    const key = word.toLowerCase();
    let text = isX ? w.dataset.g : tipCache.get(key);
    if (text == null) {
      try {
        const r = await SL.send('lookup', { word, tl: SL.settings.targetLang });
        const terms = (r.dict && r.dict[0] && r.dict[0].terms || []).map(t => t.word);
        const main = r.translation || '';
        const list = [main].concat(terms.filter(t => t.toLowerCase() !== main.toLowerCase())).filter(Boolean).slice(0, 3);
        text = list.join(', ');
      } catch (e) { text = ''; }
      tipCache.set(key, text);
      if (tipCache.size > 3000) tipCache.delete(tipCache.keys().next().value);
    }
    if (tipFor !== w || !text || SL.Dict.open || !w.isConnected) return;
    const host = SL.makeHost('sl-tip-host');
    if (!tipEl || !tipEl.isConnected) { tipEl = document.createElement('div'); tipEl.className = 'sl-tip sl-root'; host.shadow.appendChild(tipEl); }
    tipEl.classList.toggle('x', isX);
    if (isX) { tipEl.innerHTML = ''; const b = document.createElement('b'); b.textContent = word; tipEl.append(b, ' — ' + text); }
    else tipEl.textContent = text;
    const r = w.getBoundingClientRect();
    tipEl.style.left = '0px'; tipEl.style.top = '0px';
    tipEl.classList.add('show');
    const tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
    tipEl.style.left = Math.max(6, Math.min(window.innerWidth - tw - 6, r.left + r.width / 2 - tw / 2)) + 'px';
    tipEl.style.top = (r.top - th - 8 > 4 ? r.top - th - 8 : r.bottom + 8) + 'px';
  }
  SL.hoverTip = function (root, opts) {
    if (!root || root.__slTip) return;
    root.__slTip = true;
    let timer = null, cur = null;
    // слово внутри устойчивого выражения показывает перевод всего выражения
    const unit = (t) => { const w = t.closest && t.closest('.sl-w'); return w && SL.settings.showExpr !== false && w.closest('.sl-xp') || w; };
    root.addEventListener('mouseover', (e) => {
      const w = unit(e.target);
      if (!w || w === cur) return;
      cur = w; clearTimeout(timer); hideTip();
      if (SL.settings.hoverTranslate === false || SL.Dict.open || (opts && opts.skip && opts.skip()) || e.ctrlKey) return;
      timer = setTimeout(() => { if (cur === w) showTip(w); }, 380);
    });
    root.addEventListener('mouseout', (e) => {
      const w = unit(e.target);
      if (w && !(e.relatedTarget && w.contains(e.relatedTarget))) { if (cur === w) cur = null; clearTimeout(timer); hideTip(); }
    });
    root.addEventListener('mousedown', () => { clearTimeout(timer); cur = null; hideTip(); }, true);
  };

  /* Красивое выделение фразы: сплошная «капсула» под словами, по одной на строку */
  SL.selMark = function (box, first, last) {
    if (!box || !first || !last) { SL.clearSelMark(box); return; }
    const r = document.createRange();
    r.setStartBefore(first); r.setEndAfter(last);
    const br = box.getBoundingClientRect();
    const lines = [];
    for (const c of r.getClientRects()) {
      if (c.width < 1 || c.height < 1) continue;
      const ln = lines.find(l => Math.abs(l.top - c.top) < c.height * 0.5);
      if (ln) { ln.left = Math.min(ln.left, c.left); ln.right = Math.max(ln.right, c.right); ln.bottom = Math.max(ln.bottom, c.bottom); }
      else lines.push({ top: c.top, bottom: c.bottom, left: c.left, right: c.right });
    }
    lines.sort((x, y) => x.top - y.top);
    if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
    box.style.isolation = 'isolate';
    const old = [...box.querySelectorAll('.sl-selmark:not(.out)')];
    const padX = 2, padY = 0;
    const geo = (l) => ({ left: (l.left - br.left - padX) + 'px', top: (l.top - br.top - padY) + 'px', width: (l.right - l.left + padX * 2) + 'px', height: (l.bottom - l.top + padY * 2) + 'px' });
    lines.forEach((l, i) => {
      const cls = 'sl-selmark' + (lines.length > 1 ? (i === 0 ? ' first' : i === lines.length - 1 ? ' last' : ' mid') : '');
      let m = old[i];
      const g = geo(l);
      if (m) {
        // плавно растягиваем существующую плашку к новым границам
        m.className = cls;
        Object.assign(m.style, g);
      } else {
        m = document.createElement('span');
        m.className = cls;
        // новая строка появляется из левого края и плавно разворачивается
        Object.assign(m.style, g, { width: '0px', opacity: '0' });
        box.appendChild(m);
        m.getBoundingClientRect();
        requestAnimationFrame(() => { Object.assign(m.style, { width: g.width, opacity: '1' }); });
      }
    });
    old.slice(lines.length).forEach(m => { m.classList.add('out'); m.style.opacity = '0'; m.style.width = '0px'; setTimeout(() => m.remove(), 260); });
  };
  SL.clearSelMark = function (box) {
    if (!box) return;
    box.querySelectorAll('.sl-selmark').forEach(m => { m.classList.add('out'); m.style.opacity = '0'; setTimeout(() => m.remove(), 220); });
  };
  // текст диапазона слов; переносы строк (<br>) превращаем в пробелы
  SL.rangeText = function (first, last) {
    const r = document.createRange();
    r.setStartBefore(first); r.setEndAfter(last);
    const f = r.cloneContents();
    f.querySelectorAll('br').forEach(b => b.replaceWith(' '));
    f.querySelectorAll('.sl-selmark').forEach(m => m.remove());
    return f.textContent.replace(/\s+/g, ' ').trim();
  };

  function highlight(sentence, word) {
    if (!sentence) return '';
    const esc = SL.esc(sentence);
    if (!word) return esc;
    const re = new RegExp('(^|[^A-Za-z])(' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?=[^A-Za-z]|$)', 'i');
    return esc.replace(re, '$1<b>$2</b>');
  }

  async function getLemmaRank(word) {
    if (SL.hasFreq()) return { lemma: SL.lemma(word), rank: SL.rank(word) };
    try { return await SL.send('lemma', { word }); } catch (e) { return { lemma: word.toLowerCase(), rank: 0 }; }
  }

  async function ensureVocab() {
    if (!SL._vocabLoaded) { SL._vocabLoaded = true; await SL.loadVocab(); }
  }

  const Dict = SL.Dict = {
    open: false,
    _box: null,
    close() {
      if (Dict._box) { Dict._box.remove(); Dict._box = null; }
      if (Dict.open) { Dict.open = false; const cb = Dict._onClose; Dict._onClose = null; if (cb) try { cb(); } catch (e) {} }
      document.removeEventListener('mousedown', Dict._outside, true);
      document.removeEventListener('keydown', Dict._keys, true);
    },
    _outside(e) {
      const path = e.composedPath();
      if (Dict._box && !path.includes(Dict._box)) {
        // clicks on another word are handled by the caller; just close
        Dict.close();
      }
    },
    _keys(e) {
      if (e.key === 'Escape') { e.stopPropagation(); Dict.close(); }
    },
    position(box, rect) {
      const vw = window.innerWidth, vh = window.innerHeight;
      const w = Math.min(box.classList.contains('sl-compact') ? 300 : 400, vw - 16);
      let left = rect ? rect.left + rect.width / 2 - w / 2 : vw / 2 - w / 2;
      left = Math.max(8, Math.min(vw - w - 8, left));
      box.style.left = left + 'px';
      box.style.width = w + 'px';
      const h = box.offsetHeight || 300;
      let top;
      if (!rect) top = Math.max(8, vh / 2 - h / 2);
      else if (rect.top > vh * 0.55 || rect.bottom + h + 12 > vh) top = Math.max(8, rect.top - h - 10);
      else top = rect.bottom + 10;
      box.style.top = Math.max(8, Math.min(top, vh - h - 8)) + 'px';
    },

    /* opts: {word, sentence, sentenceTranslation, rect, source, getExamples(lemma), onClose, phrase} */
    async show(opts) {
      Dict.close();
      await ensureVocab();
      const host = SL.makeHost('sl-dict-host');
      const box = document.createElement('div');
      box.className = 'sl-dict sl-root';
      host.shadow.appendChild(box);
      Dict._box = box;
      Dict.open = true;
      Dict._onClose = opts.onClose || null;
      setTimeout(() => {
        document.addEventListener('mousedown', Dict._outside, true);
        document.addEventListener('keydown', Dict._keys, true);
      }, 0);
      box.addEventListener('mousedown', e => e.stopPropagation());
      box.addEventListener('keydown', e => e.stopPropagation());
      box.addEventListener('keyup', e => e.stopPropagation());
      box.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
      SL.send('stats:bump', { field: 'lookups' }).catch(() => {});
      if (opts.phrase) return Dict._phrase(box, opts);
      return Dict._word(box, opts);
    },

    async _word(box, opts) {
      const word = opts.word.replace(/[’‘`]/g, "'");
      const { lemma, rank } = await getLemmaRank(word);
      const S = SL.settings;
      const state = { entry: SL.words[lemma] || null, look: null, def: null, sentTr: opts.sentenceTranslation || '', expanded: !!S.dictDetailed };

      const render = () => {
        const e = state.entry = SL.words[lemma] || null;
        const st = e && e.status;
        const look = state.look, def = state.def;
        const main = look ? (e && e.translation) || look.translation : '';
        const lemmaHtml = lemma !== word.toLowerCase() ? `<span class="sl-dlemma">← ${SL.esc(lemma)}</span>` : '';
        const phon = (def && def.phonetic) || '';
        const alts = [];
        if (look) {
          const pool = (look.dict && look.dict.length) ? [].concat(...look.dict.map(d => d.terms.map(t => t.word))) : (look.alternatives || []);
          for (const a of pool) { if (a && a.toLowerCase() !== String(main).toLowerCase() && !alts.includes(a)) alts.push(a); if (alts.length >= 4) break; }
        }
        box.classList.toggle('sl-compact', !state.expanded);
        let html = `<div class="sl-dh">
          <button class="sl-ibtn sl-dclose" data-a="close" title="Закрыть (Esc)">✕</button>
          <div class="sl-dw"><span class="sl-dword">${SL.esc(word)}</span>${lemmaHtml}
            <button class="sl-ibtn" data-a="speak" title="Произнести">🔊</button>
            ${phon ? `<span class="sl-dphon">${SL.esc(phon)}</span>` : ''}
            ${state.expanded ? (rank ? `<span class="sl-drank" title="Место в частотном списке английских слов">#${rank}</span>` : '<span class="sl-drank">редкое</span>') : ''}
          </div>
          <div class="sl-dmain">${look ? SL.esc(main) : '<span class="sl-spin"></span>'}</div>
          ${!state.expanded && alts.length ? `<div class="sl-alts">${alts.map(a => SL.esc(a)).join(', ')}</div>` : ''}
          <div class="sl-stages">
            <button class="sl-stage known ${st === 'known' ? 'on' : ''}" data-st="known" title="1">✓ Знаю</button>
            <button class="sl-stage learning ${st === 'learning' ? 'on' : ''}" data-st="learning" title="2">★ Учу</button>
            ${state.expanded ? `<button class="sl-stage ignored ${st === 'ignored' ? 'on' : ''}" data-st="ignored" title="3">Не учить</button>
            <div class="sl-tags">${Object.keys(SL.TAG_COLORS).map(t => `<button class="sl-tagdot ${(e && (e.tags || []).includes(t)) ? 'on' : ''}" data-tag="${t}" title="Метка: ${t}" style="background:${SL.TAG_COLORS[t]}"></button>`).join('')}</div>` : ''}
            <button class="sl-more" data-a="more">${state.expanded ? 'Свернуть ▴' : 'Подробнее ▾'}</button>
          </div>
        </div>`;
        if (!state.expanded) {
          box.innerHTML = html;
          Dict.position(box, opts.rect);
          return;
        }
        html += `<div class="sl-dbody">`;

        if (look && look.dict && look.dict.length) {
          html += `<div class="sl-sec"><div class="sl-sech">Переводы</div>`;
          for (const d of look.dict) {
            html += `<div><span class="sl-pos">${SL.esc(d.pos)}</span><span class="sl-terms">${d.terms.map(t => `<span class="sl-term" ${t.reverse.length ? `title="${SL.esc(t.reverse.join(', '))}"` : ''}>${SL.esc(t.word)}</span>`).join('')}</span></div>`;
          }
          html += `</div>`;
        } else if (look && look.alternatives && look.alternatives.length > 1) {
          html += `<div class="sl-sec"><div class="sl-sech">Варианты</div><div class="sl-terms">${look.alternatives.map(a => `<span class="sl-term">${SL.esc(a)}</span>`).join('')}</div></div>`;
        }

        if (opts.sentence) {
          html += `<div class="sl-sec"><div class="sl-sech">Контекст
            <button class="sl-btn" data-a="sentTr">Перевести</button>
            <button class="sl-btn" data-a="speakSent">🔊</button>
            ${S.aiKey ? '<button class="sl-btn" data-a="ai">🤖 Объяснить</button>' : ''}</div>
            <div class="sl-ctx">${highlight(opts.sentence, word)}${state.sentTr ? `<div class="sl-ctxt">${SL.esc(state.sentTr)}</div>` : ''}</div>
            <div class="sl-aiout"></div></div>`;
        }

        if (e) {
          html += `<div class="sl-sec"><div class="sl-sech">Мой перевод / заметка</div>
            <textarea class="sl-note" data-f="translation" rows="1" placeholder="Свой вариант перевода">${SL.esc(e.translation || '')}</textarea>
            <textarea class="sl-note" data-f="note" rows="1" placeholder="Заметка" style="margin-top:4px">${SL.esc(e.note || '')}</textarea></div>`;
        }

        if (def && def.meanings && def.meanings.length) {
          html += `<div class="sl-sec"><div class="sl-sech">Определения (English)</div>`;
          for (const m of def.meanings.slice(0, 4)) {
            html += `<div><span class="sl-pos">${SL.esc(m.pos)}</span></div>`;
            m.defs.slice(0, 3).forEach((d, i) => { html += `<div class="sl-def">${i + 1}. ${SL.esc(d.def)}</div>${d.example ? `<div class="sl-ex">“${SL.esc(d.example)}”</div>` : ''}`; });
            if (m.synonyms && m.synonyms.length) html += `<div class="sl-muted">синонимы: ${SL.esc(m.synonyms.slice(0, 6).join(', '))}</div>`;
          }
          html += `</div>`;
        } else if (look && look.definitions && look.definitions.length) {
          html += `<div class="sl-sec"><div class="sl-sech">Определения</div>`;
          for (const d of look.definitions) { html += `<div><span class="sl-pos">${SL.esc(d.pos)}</span></div>` + d.items.map((x, i) => `<div class="sl-def">${i + 1}. ${SL.esc(x.gloss)}</div>${x.example ? `<div class="sl-ex">“${SL.esc(x.example)}”</div>` : ''}`).join(''); }
          html += `</div>`;
        }

        const exs = [];
        if (e && e.contexts) e.contexts.forEach(c => { if (c.text !== opts.sentence) exs.push({ text: c.text, tr: c.translation, src: c.source }); });
        if (opts.getExamples) { try { (opts.getExamples(lemma) || []).forEach(x => { if (x.text !== opts.sentence && !exs.some(y => y.text === x.text)) exs.push(x); }); } catch (er) {} }
        if (look && look.examples) look.examples.forEach(t => { if (!exs.some(y => y.text === t)) exs.push({ text: t }); });
        if (exs.length) {
          html += `<div class="sl-sec"><div class="sl-sech">Примеры</div>`;
          exs.slice(0, 6).forEach(x => {
            const link = x.src ? SL.sourceLink(x.src) : '';
            html += `<div class="sl-ex" style="font-style:normal;margin-left:0">• ${highlight(x.text, word)}${x.tr ? `<div class="sl-muted">${SL.esc(x.tr)}</div>` : ''}${link ? ` <a class="sl-link" href="${SL.esc(link)}" target="_blank">↗ источник</a>` : ''}${x.time != null && x.jump ? ` <button class="sl-btn" data-jump="${x.time}">▶ ${SL.fmtTime(x.time)}</button>` : ''}</div>`;
          });
          html += `</div>`;
        }

        const links = (S.externalDicts || []).map(k => SL.EXTERNAL_DICTS[k]).filter(Boolean).concat(S.customDicts || []);
        html += `<div class="sl-sec"><div class="sl-sech">Словари</div><div class="sl-links">${links.map(l => `<a class="sl-link" target="_blank" href="${SL.esc(String(l.url).replace('{word}', encodeURIComponent(lemma)).replace(/english-russian|tl=ru/g, m => m.replace('russian', langName(S.targetLang)).replace('tl=ru', 'tl=' + S.targetLang)))}">${SL.esc(l.name)}</a>`).join('')}</div></div>`;
        html += `</div>`;
        const scroll = box.querySelector('.sl-dbody') ? box.querySelector('.sl-dbody').scrollTop : 0;
        const aiOld = box.querySelector('.sl-aiout') ? box.querySelector('.sl-aiout').innerHTML : '';
        box.innerHTML = html;
        if (aiOld && box.querySelector('.sl-aiout')) box.querySelector('.sl-aiout').innerHTML = aiOld;
        if (box.querySelector('.sl-dbody')) box.querySelector('.sl-dbody').scrollTop = scroll;
        Dict.position(box, opts.rect);
      };

      const ctx = () => ({ text: opts.sentence || '', translation: state.sentTr || '', source: opts.source || null });
      const mark = async (status) => {
        const cur = SL.words[lemma] && SL.words[lemma].status;
        const next = cur === status ? null : status;
        if (next && opts.sentence && !state.sentTr && next === 'learning') {
          try { state.sentTr = (await SL.send('translate', { texts: [opts.sentence], tl: S.targetLang }))[0] || ''; } catch (e) {}
        }
        const c = next ? ctx() : null;
        if (c && next === 'learning' && opts.media && !(SL.words[lemma] && (SL.words[lemma].contexts || []).some(x => x.text === c.text && x.media))) { try { c.media = await opts.media(); } catch (e) {} }
        await SL.send('vocab:mark', { lemma, word, status: next, context: c, translation: state.look ? state.look.translation : '' });
        await SL.loadVocab();
        render();
        if (opts.onChange) opts.onChange();
      };

      box.addEventListener('click', async (ev) => {
        const t = ev.target.closest('[data-a],[data-st],[data-tag],[data-jump]');
        if (!t) return;
        if (t.dataset.st) return mark(t.dataset.st);
        if (t.dataset.tag) { await SL.send('vocab:tag', { lemma, word, tag: t.dataset.tag }); await SL.loadVocab(); render(); if (opts.onChange) opts.onChange(); return; }
        if (t.dataset.jump && opts.onJump) { opts.onJump(Number(t.dataset.jump)); return; }
        const a = t.dataset.a;
        if (a === 'close') Dict.close();
        else if (a === 'more') { state.expanded = !state.expanded; render(); }
        else if (a === 'speak') {
          if (state.def && state.def.audio) { const au = new Audio(state.def.audio); au.play().catch(() => SL.speak(word)); } else SL.speak(word);
        } else if (a === 'speakSent') SL.speak(opts.sentence);
        else if (a === 'sentTr') {
          t.innerHTML = '<span class="sl-spin"></span>';
          try { state.sentTr = (await SL.send('translate', { texts: [opts.sentence], tl: S.targetLang }))[0] || '—'; } catch (e) { state.sentTr = 'Ошибка: ' + e.message; }
          render();
        } else if (a === 'ai') {
          const out = box.querySelector('.sl-aiout');
          out.innerHTML = '<div class="sl-ai"><span class="sl-spin"></span> думаю…</div>';
          try {
            const txt = await SL.send('ai', {
              system: `Ты преподаватель английского. Отвечай кратко на языке: ${SL.humanLang(S.targetLang)}.`,
              messages: [{ role: 'user', content: `Предложение: "${opts.sentence}"\nСлово/выражение: "${word}"\nОбъясни значение слова именно в этом контексте, разбери грамматику предложения, укажи идиомы или сленг, если есть, и дай перевод всего предложения.` }]
            });
            out.innerHTML = `<div class="sl-ai">${SL.esc(txt)}</div>`;
          } catch (e) { out.innerHTML = `<div class="sl-ai">Ошибка: ${SL.esc(e.message)}</div>`; }
          Dict.position(box, opts.rect);
        }
      });
      box.addEventListener('change', async (ev) => {
        const f = ev.target.dataset && ev.target.dataset.f;
        if (!f || !SL.words[lemma]) return;
        await SL.send('vocab:patch', { kind: 'word', id: lemma, patch: { [f]: ev.target.value } });
        await SL.loadVocab();
      });
      box.addEventListener('keydown', (ev) => {
        if (ev.target.tagName === 'TEXTAREA') return;
        if (ev.key === '1') mark('known'); else if (ev.key === '2') mark('learning'); else if (ev.key === '3') mark('ignored');
      });
      box.tabIndex = -1;

      render();
      if (S.speakOnClick || opts.speak) SL.speak(word, { auto: true });
      const p1 = SL.send('lookup', { word, tl: S.targetLang }).then(r => { state.look = r; }).catch(e => { state.look = { translation: '⚠ ' + e.message, dict: [] }; });
      const p2 = SL.send('define', { word: lemma }).then(r => { state.def = r; }).catch(() => {});
      await p1; if (Dict._box === box) render();
      await p2; if (Dict._box === box) render();
      box.focus({ preventScroll: true });
    },

    async _phrase(box, opts) {
      const S = SL.settings;
      const text = opts.phrase.trim();
      const state = { tr: opts.translation || '', expanded: !!S.dictDetailed };
      const saved = () => Object.values(SL.phrases).find(p => p.text === text);
      const render = () => {
        const sp = saved();
        box.classList.toggle('sl-compact', !state.expanded);
        box.innerHTML = `<div class="sl-dh"><button class="sl-ibtn sl-dclose" data-a="close">✕</button>
          <div style="font-size:16px;font-weight:600;color:#fff;padding-right:24px">${SL.esc(text)}</div>
          <div class="sl-dmain">${state.tr ? SL.esc(state.tr) : '<span class="sl-spin"></span>'}</div>
          ${opts.surface && opts.surface.toLowerCase() !== text.toLowerCase() ? `<div class="sl-xsurf">в реплике: «${SL.esc(opts.surface)}»</div>` : ''}
          ${opts.words && opts.words.length && opts.onWord ? `<div class="sl-xwords"><span>Слова:</span>${opts.words.map(w => `<button class="sl-xword" data-a="word" data-w="${SL.esc(w)}">${SL.esc(w)}</button>`).join('')}</div>` : ''}
          <div class="sl-stages">
            <button class="sl-stage learning ${sp ? 'on' : ''}" data-a="save">${sp ? '★ Сохранено' : '☆ Сохранить'}</button>
            <button class="sl-stage" data-a="speak">🔊</button>
            ${S.aiKey && state.expanded ? '<button class="sl-stage" data-a="ai">🤖 Объяснить</button>' : ''}
            <button class="sl-more" data-a="more">${state.expanded ? 'Свернуть ▴' : 'Подробнее ▾'}</button>
          </div></div>
          ${state.expanded ? `<div class="sl-dbody">
            ${opts.sentence && opts.sentence !== text ? `<div class="sl-sec"><div class="sl-sech">Контекст</div><div class="sl-ctx">${highlight(opts.sentence, '')}</div></div>` : ''}
            <div class="sl-aiout"></div>
            <div class="sl-sec"><div class="sl-sech">Искать</div><div class="sl-links">
              <a class="sl-link" target="_blank" href="https://context.reverso.net/translation/english-${langName(S.targetLang)}/${encodeURIComponent(text)}">Reverso Context</a>
              <a class="sl-link" target="_blank" href="https://translate.google.com/?sl=en&tl=${S.targetLang}&text=${encodeURIComponent(text)}">Google Translate</a>
              <a class="sl-link" target="_blank" href="https://youglish.com/pronounce/${encodeURIComponent(text)}/english">YouGlish</a>
              <a class="sl-link" target="_blank" href="https://www.urbandictionary.com/define.php?term=${encodeURIComponent(text)}">Urban</a>
            </div></div></div>` : ''}`;
        Dict.position(box, opts.rect);
      };
      box.addEventListener('click', async (ev) => {
        const t = ev.target.closest('[data-a]');
        if (!t) return;
        const a = t.dataset.a;
        if (a === 'close') Dict.close();
        else if (a === 'word') { opts.onWord(t.dataset.w, t.getBoundingClientRect()); }
        else if (a === 'more') { state.expanded = !state.expanded; render(); }
        else if (a === 'speak') SL.speak(opts.surface || text);
        else if (a === 'save') {
          const sp = saved();
          if (sp) await SL.send('vocab:removePhrase', { id: sp.id });
          else {
            let media = null;
            if (opts.media) { try { media = await opts.media(); } catch (e) {} }
            await SL.send('vocab:savePhrase', { text, translation: state.tr, source: opts.source || null, context: opts.sentence || '', media });
          }
          await SL.loadVocab(); render(); if (opts.onChange) opts.onChange();
        } else if (a === 'ai') {
          const out = box.querySelector('.sl-aiout');
          out.innerHTML = '<div class="sl-ai"><span class="sl-spin"></span> думаю…</div>';
          try {
            const txt = await SL.send('ai', {
              system: `Ты преподаватель английского. Отвечай кратко на языке: ${SL.humanLang(S.targetLang)}.`,
              messages: [{ role: 'user', content: `Фраза: "${text}"${opts.sentence && opts.sentence !== text ? `\nКонтекст: "${opts.sentence}"` : ''}\nОбъясни смысл, грамматику, идиомы/сленг и дай естественный перевод.` }]
            });
            out.innerHTML = `<div class="sl-ai">${SL.esc(txt)}</div>`;
          } catch (e) { out.innerHTML = `<div class="sl-ai">Ошибка: ${SL.esc(e.message)}</div>`; }
          Dict.position(box, opts.rect);
        }
      });
      render();
      if (!state.tr) {
        try { state.tr = (await SL.send('translate', { texts: [text], tl: S.targetLang }))[0] || '—'; } catch (e) { state.tr = '⚠ ' + e.message; }
        if (Dict._box === box) render();
      }
    }
  };

  function langName(code) {
    return ({ ru: 'russian', uk: 'ukrainian', de: 'german', fr: 'french', es: 'spanish', it: 'italian', pt: 'portuguese', pl: 'polish', tr: 'turkish', ja: 'japanese', 'zh-CN': 'chinese', ar: 'arabic', he: 'hebrew' })[code] || 'russian';
  }
  SL.langName = langName;
  SL.humanLang = function (code) { const l = SL.LANGS.find(x => x[0] === code); return l ? l[1] : 'Русский'; };
})(SL);

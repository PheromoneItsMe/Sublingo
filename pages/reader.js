(async function () {
  await SL.loadSettings();
  await SL.loadVocab();
  SL._vocabLoaded = true;
  const $ = (id) => document.getElementById(id);
  let texts = {};
  let cur = null;
  let sentences = [];
  let fontSize = Number(localStorage.getItem('sl_reader_fs')) || 20;
  let speaking = false;

  const SAMPLE = {
    id: 'sample', title: 'Пример: The Little Things',
    text: "The Little Things\n\nMost people think that big changes come from big decisions. In reality, it's usually the little things that make the difference. If you read a few pages every day, you'll finish dozens of books a year. If you learn five new words a day, you'll know almost two thousand new words by the end of the year.\n\nThe trick is consistency. Don't wait for the perfect moment, because it rarely shows up. Just get started, keep going, and be patient with yourself. You might stumble along the way, but that's part of the process."
  };

  async function loadTexts() {
    texts = (await chrome.storage.local.get('sl_texts')).sl_texts || {};
    renderList();
  }
  function renderList() {
    const arr = Object.values(texts).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    $('list').innerHTML = arr.map(t => `<div class="li ${cur && cur.id === t.id ? 'on' : ''}" data-id="${t.id}"><b>${SL.esc(t.title || 'Без названия')}</b><span>${(t.text || '').split(/\s+/).length} слов · ${new Date(t.updatedAt || t.createdAt).toLocaleDateString()}</span></div>`).join('') +
      `<div class="li ${cur && cur.id === 'sample' ? 'on' : ''}" data-id="sample"><b>${SAMPLE.title}</b><span>пример</span></div>`;
  }
  $('list').addEventListener('click', e => { const li = e.target.closest('.li'); if (li) open(li.dataset.id); });

  function show(which) { ['editor', 'view', 'blank'].forEach(id => $(id).classList.toggle('hidden', id !== which)); }

  function open(id) {
    cur = id === 'sample' ? SAMPLE : texts[id];
    if (!cur) return;
    history.replaceState(null, '', '?id=' + id);
    renderList();
    renderReader();
    show('view');
  }

  function edit(t) {
    cur = t || { title: '', text: '' };
    $('title').value = cur.title || '';
    $('body').value = cur.text || '';
    $('del').classList.toggle('hidden', !cur.id || cur.id === 'sample');
    show('editor');
    $('body').focus();
  }

  function stripSubs(text) {
    if (!/-->/.test(text)) return text;
    return SL.parseVTT(text).map(l => l.text.replace(/\n/g, ' ')).join('\n');
  }

  function renderReader() {
    const S = SL.settings;
    $('reader').style.fontSize = fontSize + 'px';
    const paras = String(cur.text || '').replace(/\r/g, '').split(/\n\s*\n|\n(?=[A-Z"“'‘(\-—])/).map(p => p.trim()).filter(Boolean);
    sentences = [];
    let html = '';
    paras.forEach((p, pi) => {
      const isTitle = pi === 0 && p.length < 90 && !/[.!?]$/.test(p) && paras.length > 1;
      let ph = '';
      SL.splitSentences(p.replace(/\s*\n\s*/g, ' ')).forEach(s => {
        const i = sentences.length;
        sentences.push(s.trim());
        ph += `<span class="snt" data-s="${i}"><span class="st"><button data-a="say" title="Озвучить">🔊</button><button data-a="tr" title="Перевести">文A</button><button data-a="save" title="Сохранить фразу">☆</button>${S.aiKey ? '<button data-a="ai" title="Объяснить">🤖</button>' : ''}</span>${SL.renderTokensHTML(s, { br: false })}</span>`;
      });
      html += isTitle ? `<h1>${ph}</h1>` : `<p data-p="${pi}">${ph}</p>`;
    });
    $('reader').innerHTML = html || '<div class="mut">Пустой текст</div>';
    const link = $('srcLink');
    link.classList.toggle('hidden', !cur.url);
    if (cur.url) link.href = cur.url;
    renderSide();
  }

  function refreshColors() {
    document.querySelectorAll('.snt').forEach(el => {
      const i = Number(el.dataset.s);
      const tools = el.querySelector('.st').outerHTML;
      const trs = [...el.querySelectorAll('.tr')].map(x => x.outerHTML).join('');
      el.innerHTML = tools + SL.renderTokensHTML(sentences[i], { br: false }) + trs;
    });
    renderSide();
  }
  SL.onVocab(SL.debounce(() => { if (cur && !$('view').classList.contains('hidden')) refreshColors(); }, 200));

  function renderSide() {
    const counts = new Map();
    let total = 0, k = 0, l = 0, u = 0;
    sentences.forEach(s => SL.tokenize(s).forEach(t => {
      if (t.t !== 'w') return;
      const c = SL.classify(t.text, t.sentStart);
      if (c.status === 'special') return;
      total++;
      if (c.status === 'known' || c.status === 'ignored') k++; else if (c.status === 'learning') l++; else u++;
      const e = counts.get(c.lemma) || { lemma: c.lemma, n: 0, st: c.status, rank: c.rank };
      e.n++; counts.set(c.lemma, e);
    }));
    const pct = (n) => total ? Math.round(n / total * 100) : 0;
    const fresh = [...counts.values()].filter(e => !['known', 'ignored', 'learning'].includes(SL.classify(e.lemma, true).status)).sort((a, b) => b.n - a.n || (a.rank || 1e9) - (b.rank || 1e9));
    $('side').innerHTML = `<h3 style="margin-top:0">Понимание текста</h3>
      <div>Знаю <b>${pct(k)}%</b> · учу ${pct(l)}% · новых ${pct(u)}%</div>
      <div class="covbar"><i style="width:${pct(k)}%;background:#22c55e"></i><i style="width:${pct(l)}%;background:#f97316"></i><i style="width:${pct(u)}%;background:#3b82f6"></i></div>
      <div class="mut">${total} слов, ${counts.size} уникальных, ${sentences.length} предложений</div>
      <h3>Новые слова (${fresh.length})</h3>
      <div class="row" style="margin-bottom:6px"><button class="btn sm" id="allKnown">Все → знаю</button></div>
      ${fresh.slice(0, 150).map(e => `<div class="wl"><span class="${SL.statusClass(SL.classify(e.lemma, true))}" data-w="${SL.esc(e.lemma)}">${SL.esc(e.lemma)}</span><span class="c">×${e.n}</span><button class="btn sm" data-m="learning|${SL.esc(e.lemma)}">★</button><button class="btn sm" data-m="known|${SL.esc(e.lemma)}">✓</button></div>`).join('')}`;
    const b = $('allKnown');
    b && b.addEventListener('click', async () => { if (confirm(`Отметить ${fresh.length} слов как известные?`)) await SL.send('vocab:markMany', { lemmas: fresh.map(e => e.lemma), status: 'known' }); });
  }

  function source() { return { type: 'text', textId: cur.id, title: cur.title, url: cur.url || '' }; }

  $('side').addEventListener('click', async e => {
    const m = e.target.closest('[data-m]');
    if (m) { const [st, lemma] = m.dataset.m.split('|'); const s = sentences.find(x => SL.tokenize(x).some(t => t.t === 'w' && SL.lemma(t.text) === lemma)); await SL.send('vocab:mark', { lemma, word: lemma, status: st, context: s ? { text: s, source: source() } : null }); return; }
    const w = e.target.closest('.sl-w');
    if (w) { const lemma = w.dataset.w; const s = sentences.find(x => SL.tokenize(x).some(t => t.t === 'w' && SL.lemma(t.text) === lemma)) || ''; SL.Dict.show({ word: lemma, rect: w.getBoundingClientRect(), sentence: s, source: source(), getExamples: (lm) => examples(lm, s) }); }
  });

  function examples(lemma, skip) {
    return sentences.filter(s => s !== skip && SL.tokenize(s).some(t => t.t === 'w' && SL.lemma(t.text) === lemma)).slice(0, 4).map(text => ({ text }));
  }

  // word clicks and selection in reader
  const rd = $('reader');
  rd.addEventListener('click', async (e) => {
    const b = e.target.closest('.st button');
    const snt = e.target.closest('.snt');
    if (b && snt) {
      const i = Number(snt.dataset.s), s = sentences[i];
      const a = b.dataset.a;
      if (a === 'say') SL.speak(s);
      else if (a === 'tr') {
        let tr = snt.querySelector('.tr');
        if (tr) { tr.remove(); return; }
        tr = document.createElement('span'); tr.className = 'tr'; tr.innerHTML = '<span class="sl-spin"></span>';
        snt.appendChild(tr);
        try { tr.textContent = (await SL.send('translate', { texts: [s], tl: SL.settings.targetLang }))[0]; } catch (er) { tr.textContent = er.message; }
      } else if (a === 'save') {
        const tr = (await SL.send('translate', { texts: [s], tl: SL.settings.targetLang }).catch(() => ['']))[0];
        await SL.send('vocab:savePhrase', { text: s, translation: tr, source: source() });
        b.textContent = '★';
        SL.toast('★ Фраза сохранена');
      } else if (a === 'ai') SL.Dict.show({ phrase: s, rect: b.getBoundingClientRect(), source: source() });
      return;
    }
    const w = e.target.closest('.sl-w');
    if (!w) return;
    if ((e.ctrlKey || e.metaKey) && snt) { e.preventDefault(); multiClick(w, snt); return; }
    const sel = getSelection();
    if (sel && !sel.isCollapsed && String(sel).trim().includes(' ')) return;
    const s = snt ? sentences[Number(snt.dataset.s)] : '';
    const S = SL.settings;
    if (S.leftClick === 'speak') return SL.speak(w.dataset.w);
    document.querySelectorAll('.sl-active').forEach(x => x.classList.remove('sl-active'));
    w.classList.add('sl-active');
    SL.Dict.show({ word: w.dataset.w, rect: w.getBoundingClientRect(), sentence: s, source: source(), speak: S.leftClick === 'dictSpeak', getExamples: (lm) => examples(lm, s), onClose: () => w.classList.remove('sl-active') });
  });
  // Ctrl + клик по словам → фраза (отпустите Ctrl)
  let multi = null;
  function clearMulti() { if (multi) { multi.box.querySelectorAll('.sl-sel').forEach(x => x.classList.remove('sl-sel')); SL.clearSelMark(multi.box); } multi = null; }
  function multiClick(w, box) {
    if (multi && multi.box === box) { if (multi.done) { multi.done = false; SL.Dict.close(); } }
    else { clearMulti(); SL.Dict.close(); multi = { box, picked: new Set() }; }
    const words = [...box.querySelectorAll('.sl-w')];
    const i = words.indexOf(w);
    if (multi.picked.has(i) && multi.picked.size > 1) multi.picked.delete(i); else multi.picked.add(i);
    const idx = [...multi.picked], a = Math.min(...idx), b = Math.max(...idx);
    words.forEach((el, k) => el.classList.toggle('sl-sel', k >= a && k <= b));
    SL.selMark(box, words[a], words[b]);
  }
  function finishMulti() {
    const m = multi;
    if (!m || m.done) return;
    const words = [...m.box.querySelectorAll('.sl-w')];
    const idx = [...m.picked], a = Math.min(...idx), b = Math.max(...idx);
    const s = sentences[Number(m.box.dataset.s)];
    m.done = true;
    if (a === b) { SL.Dict.show({ word: words[a].dataset.w, rect: words[a].getBoundingClientRect(), sentence: s, source: source(), getExamples: (lm) => examples(lm, s) }); return; }
    const r = document.createRange(); r.setStartBefore(words[a]); r.setEndAfter(words[b]);
    SL.Dict.show({ phrase: SL.rangeText(words[a], words[b]), rect: r.getBoundingClientRect(), sentence: s, source: source() });
  }
  window.addEventListener('mousedown', (e) => {
    if (!multi || !multi.done || e.ctrlKey || e.metaKey) return;
    if (e.composedPath().some(n => n && n.classList && n.classList.contains('sl-dict'))) return;
    clearMulti();
  }, true);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && multi) clearMulti(); }, true);
  window.addEventListener('keyup', (e) => { if ((e.key === 'Control' || e.key === 'Meta') && multi) finishMulti(); });
  window.addEventListener('blur', () => { if (multi) finishMulti(); });

  rd.addEventListener('contextmenu', async (e) => {
    const w = e.target.closest('.sl-w');
    const S = SL.settings;
    if (!w || !['learning', 'known'].includes(S.rightClick)) return;
    e.preventDefault();
    const lemma = SL.lemma(w.dataset.w);
    const snt = e.target.closest('.snt');
    const cur2 = SL.words[lemma] && SL.words[lemma].status;
    const st = cur2 === S.rightClick ? null : S.rightClick;
    await SL.send('vocab:mark', { lemma, word: w.dataset.w, status: st, context: st && snt ? { text: sentences[Number(snt.dataset.s)], source: source() } : null });
  });
  rd.addEventListener('mouseup', (e) => {
    setTimeout(() => {
      const sel = getSelection();
      const txt = String(sel || '').replace(/\s+/g, ' ').trim();
      if (!txt || !txt.includes(' ') || txt.length > 400) return;
      const snt = e.target.closest('.snt');
      SL.Dict.show({ phrase: txt, rect: sel.getRangeAt(0).getBoundingClientRect(), sentence: snt ? sentences[Number(snt.dataset.s)] : '', source: source() });
    }, 10);
  });

  // toolbar
  $('edit').addEventListener('click', () => edit(cur && cur.id !== 'sample' ? cur : Object.assign({}, SAMPLE, { id: null })));
  $('new').addEventListener('click', () => edit(null));
  $('cancel').addEventListener('click', () => cur && cur.text ? (renderReader(), show('view')) : show('blank'));
  $('save').addEventListener('click', async () => {
    const text = stripSubs($('body').value.trim());
    if (!text) return;
    const t = await SL.send('texts:save', { text: { id: cur && cur.id && cur.id !== 'sample' ? cur.id : undefined, title: $('title').value.trim() || text.split('\n')[0].slice(0, 60), text, url: cur && cur.url } });
    await loadTexts(); open(t.id);
  });
  $('del').addEventListener('click', async () => {
    if (!cur || !cur.id || !confirm('Удалить текст?')) return;
    await SL.send('texts:remove', { id: cur.id }); cur = null; await loadTexts(); show('blank');
  });
  $('fsm').addEventListener('click', () => { fontSize = Math.max(14, fontSize - 2); localStorage.setItem('sl_reader_fs', fontSize); $('reader').style.fontSize = fontSize + 'px'; });
  $('fsp').addEventListener('click', () => { fontSize = Math.min(34, fontSize + 2); localStorage.setItem('sl_reader_fs', fontSize); $('reader').style.fontSize = fontSize + 'px'; });
  $('trAll').addEventListener('click', async () => {
    const b = $('trAll');
    b.disabled = true; b.textContent = '…';
    try {
      const res = await SL.send('translate', { texts: sentences, tl: SL.settings.targetLang });
      document.querySelectorAll('.snt').forEach(el => {
        const i = Number(el.dataset.s);
        if (el.querySelector('.tr')) return;
        const tr = document.createElement('span'); tr.className = 'tr'; tr.textContent = res[i] || '';
        el.appendChild(tr);
      });
    } catch (e) { alert(e.message); }
    b.disabled = false; b.textContent = '文A Перевести всё';
  });
  $('readAloud').addEventListener('click', async () => {
    const b = $('readAloud');
    if (speaking) { speaking = false; SL.send('tts:stop'); b.textContent = '▶ Читать вслух'; return; }
    speaking = true; b.textContent = '■ Стоп';
    for (let i = 0; i < sentences.length && speaking; i++) {
      const el = document.querySelector(`.snt[data-s="${i}"]`);
      document.querySelectorAll('.speaking').forEach(x => x.classList.remove('speaking'));
      if (el) { el.classList.add('speaking'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      const r = await SL.send('tts', { text: sentences[i] }).catch(() => 'error');
      if (r === 'interrupted' || r === 'cancelled') break;
    }
    document.querySelectorAll('.speaking').forEach(x => x.classList.remove('speaking'));
    speaking = false; b.textContent = '▶ Читать вслух';
  });

  // import
  $('file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const text = stripSubs(await f.text());
    const t = await SL.send('texts:save', { text: { title: f.name.replace(/\.\w+$/, ''), text } });
    await loadTexts(); open(t.id);
    e.target.value = '';
  });
  $('fetch').addEventListener('click', async () => {
    const url = $('url').value.trim();
    if (!/^https?:\/\//.test(url)) return;
    $('fetch').textContent = '…';
    try {
      const html = await SL.send('fetchPage', { url });
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const pick = doc.querySelector('article') || doc.querySelector('main') || doc.body;
      pick.querySelectorAll('script,style,noscript,nav,header,footer,aside,form,iframe,svg,button').forEach(n => n.remove());
      const blocks = [...pick.querySelectorAll('h1,h2,h3,p,li,blockquote')].map(n => n.textContent.replace(/\s+/g, ' ').trim()).filter(t => t.length > 1);
      const text = blocks.length > 2 ? blocks.join('\n\n') : pick.textContent.replace(/\s+\n/g, '\n').trim();
      const t = await SL.send('texts:save', { text: { title: (doc.title || url).trim(), text, url } });
      $('url').value = '';
      await loadTexts(); open(t.id);
    } catch (e) { alert('Не удалось загрузить: ' + e.message); }
    $('fetch').textContent = '↓';
  });

  await loadTexts();
  const qs = new URLSearchParams(location.search);
  if (qs.get('error')) alert('Не удалось импортировать страницу. Выделите текст и выберите «открыть выделенное в режиме чтения».');
  if (qs.get('id')) open(qs.get('id')); else show('blank');
})();

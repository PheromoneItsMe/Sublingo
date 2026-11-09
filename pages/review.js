(async function () {
  await SL.loadSettings();
  await SL.loadVocab();
  SL._vocabLoaded = true;
  const $ = (id) => document.getElementById(id);
  const S = () => SL.settings;
  const MODES = { recall: 'Узнавание', cloze: 'Пропуск', listen: 'Аудирование', reverse: 'Обратные' };

  /* ---------------- home ---------------- */
  async function home() {
    await SL.loadVocab();
    const now = Date.now();
    const words = Object.values(SL.words), phrases = Object.values(SL.phrases);
    const learning = words.filter(w => w.status === 'learning');
    const pool = learning.map(w => w.srs).concat(phrases.map(p => p.srs)).filter(Boolean);
    const due = pool.filter(s => s.seen && s.due <= now).length;
    const fresh = learning.filter(w => !w.srs || !w.srs.seen).length + phrases.filter(p => !p.srs || !p.srs.seen).length;
    const known = words.filter(w => w.status === 'known').length;
    const mature = pool.filter(s => s.interval >= 21).length;
    const st = (await chrome.storage.local.get('sl_stats')).sl_stats || { days: {} };
    const today = st.days[SL.srs.dayKey()] || {};
    let streak = 0;
    for (let d = 0; d < 3650; d++) { const k = SL.srs.dayKey(now - d * 86400000); if (st.days[k] && st.days[k].reviewed) streak++; else if (d > 0) break; }
    $('stats').innerHTML = [
      [due, 'к повторению сейчас'], [fresh, 'новых в очереди'], [learning.length + phrases.length, 'учу (слова + фразы)'],
      [mature, 'закреплено (интервал ≥ 21 дн)'], [known + SL.settings.vocabLevel, 'знаю (отмечено + уровень)'], [(today.reviewed || 0) + ' / 🔥' + streak, 'сегодня / дней подряд']
    ].map(([b, t]) => `<div class="stat"><b>${b}</b><span>${t}</span></div>`).join('');
    $('size').value = S().reviewSessionSize;
    $('newp').value = S().reviewNewPercent;
    $('modes').innerHTML = Object.entries(MODES).map(([k, n]) => `<button class="chip ${S().reviewModes[k] ? 'on' : ''}" data-mode="${k}">${n}</button>`).join('') + `<button class="chip ${S().reviewSuggestions ? 'on' : ''}" data-sugg="1">+ предложения новых слов</button>`;
    $('startInfo').textContent = due + fresh ? '' : 'Нет карточек: отметьте слова «★ Учу» в субтитрах.';
    // chart
    const days = [];
    for (let d = 29; d >= 0; d--) { const k = SL.srs.dayKey(now - d * 86400000); days.push([k, (st.days[k] || {}).reviewed || 0]); }
    const max = Math.max(1, ...days.map(d => d[1]));
    $('chart').innerHTML = days.map(([k, n]) => `<div style="height:${Math.max(2, n / max * 100)}%" title="${k}: ${n}">${n ? `<span>${n}</span>` : ''}</div>`).join('');
    const sum = (f) => Object.values(st.days).reduce((a, d) => a + (d[f] || 0), 0);
    $('chartInfo').textContent = `Всего повторений: ${sum('reviewed')} · начато новых: ${sum('newStarted')} · выучено: ${sum('learned')} · отмечено к изучению: ${sum('marked')}`;
  }
  $('size').addEventListener('change', e => SL.saveSettings({ reviewSessionSize: Math.max(5, Number(e.target.value) || 30) }));
  $('newp').addEventListener('change', e => SL.saveSettings({ reviewNewPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }));
  $('modes').addEventListener('click', e => {
    const b = e.target.closest('[data-mode],[data-sugg]');
    if (!b) return;
    if (b.dataset.sugg) SL.saveSettings({ reviewSuggestions: !S().reviewSuggestions }).then(home);
    else SL.saveSettings({ reviewModes: Object.assign({}, S().reviewModes, { [b.dataset.mode]: !S().reviewModes[b.dataset.mode] }) }).then(home);
  });

  /* ---------------- session ---------------- */
  let queue = [], pos = 0, total = 0, card = null, revealed = false;

  function suggestions(n) {
    const list = SL.freqList();
    const out = [];
    const lvl = SL.settings.vocabLevel || 0;
    for (let i = lvl; i < list.length && out.length < n; i++) {
      const w = list[i];
      if (w.length < 3 || /'/.test(w) || SL.lemma(w) !== w || SL.words[w]) continue;
      out.push({ kind: 'suggest', id: w, lemma: w });
    }
    return out;
  }

  function pickMode(item) {
    const m = S().reviewModes;
    const ctx = item.kind === 'word' ? ((item.e.contexts || []).find(c => new RegExp('(^|[^A-Za-z])' + esc(item.e.word || item.e.lemma), 'i').test(c.text)) || (item.e.contexts || [])[0]) : null;
    const opts = [];
    if (item.kind === 'word') {
      if (m.recall) opts.push('recall');
      if (m.cloze && ctx && clozeable(ctx.text, item.e)) opts.push('cloze');
      if (m.listen && ctx) opts.push('listen');
      if (m.reverse && item.e.translation) opts.push('reverse');
    } else {
      if (m.recall || m.cloze) opts.push('recall');
      if (m.listen) opts.push('listen');
      if (m.reverse && item.e.translation) opts.push('reverse');
    }
    if (!opts.length) opts.push('recall');
    // first exposure: always recognition
    if (!(item.e.srs && item.e.srs.seen)) return { mode: 'recall', ctx };
    return { mode: opts[Math.floor(Math.random() * opts.length)], ctx };
  }
  function esc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function findForm(text, e) {
    const toks = SL.tokenize(text).filter(t => t.t === 'w');
    return toks.find(t => SL.lemma(t.text) === e.lemma || t.text.toLowerCase() === (e.word || '').toLowerCase());
  }
  function clozeable(text, e) { return !!findForm(text, e); }

  async function start() {
    await SL.loadVocab();
    const now = Date.now();
    const items = [];
    for (const w of Object.values(SL.words)) if (w.status === 'learning') items.push({ kind: 'word', id: w.lemma, e: w });
    for (const p of Object.values(SL.phrases)) items.push({ kind: 'phrase', id: p.id, e: p });
    const due = items.filter(x => x.e.srs && x.e.srs.seen && x.e.srs.due <= now).sort((a, b) => a.e.srs.due - b.e.srs.due);
    const fresh = items.filter(x => !x.e.srs || !x.e.srs.seen).sort((a, b) => (a.e.createdAt || 0) - (b.e.createdAt || 0));
    const size = S().reviewSessionSize;
    let nNew = Math.min(fresh.length, Math.round(size * S().reviewNewPercent / 100));
    let nDue = Math.min(due.length, size - nNew);
    nNew = Math.min(fresh.length, size - nDue);
    const sel = due.slice(0, nDue);
    const nw = fresh.slice(0, nNew);
    // interleave new cards evenly between due cards
    queue = sel.slice();
    const totalN = sel.length + nw.length;
    nw.forEach((x, k) => { const at = Math.min(queue.length, Math.floor(k * totalN / nw.length)); queue.splice(at, 0, x); });
    if (S().reviewSuggestions && SL.hasFreq()) {
      const sg = suggestions(Math.max(1, Math.min(5, Math.round(size / 10))));
      sg.forEach((s, i) => queue.splice(Math.min(queue.length, (i + 1) * 5), 0, s));
    }
    if (!queue.length) { alert('Сейчас нечего повторять. Отметьте новые слова «★ Учу» или загляните позже.'); return; }
    total = queue.length; pos = 0;
    $('home').classList.add('hidden'); $('session').classList.remove('hidden');
    next();
  }

  function finish() {
    $('session').classList.add('hidden'); $('home').classList.remove('hidden');
    home();
  }

  async function ensureTranslation(item) {
    if (item.e && item.e.translation) return item.e.translation;
    if (item._tr) return item._tr;
    try {
      if (item.kind === 'word' || item.kind === 'suggest') { const r = await SL.send('lookup', { word: item.kind === 'suggest' ? item.lemma : item.e.lemma, tl: S().targetLang }); item._tr = r.translation; item._dict = r.dict; }
      else item._tr = (await SL.send('translate', { texts: [item.e.text], tl: S().targetLang }))[0];
    } catch (e) { item._tr = '—'; }
    return item._tr;
  }

  function next() {
    revealed = false;
    $('prog').style.width = Math.round(pos / Math.max(1, total) * 100) + '%';
    if (!queue.length) {
      $('card').innerHTML = `<div class="grow"></div><div class="center"><div style="font-size:44px">🎉</div><h2>Сессия завершена</h2><div class="mut">Карточек: ${total}</div><div class="row" style="justify-content:center;margin-top:16px"><button class="btn primary" id="again">Ещё сессия</button><button class="btn" id="back">Назад</button></div></div><div class="grow"></div>`;
      $('again').onclick = start; $('back').onclick = finish;
      return;
    }
    card = queue.shift();
    if (card.kind === 'suggest') return renderSuggest();
    const pm = pickMode(card);
    card.mode = pm.mode; card.ctx = pm.ctx;
    renderCard();
  }

  function head(label) {
    const s = card.e.srs;
    return `<div class="mode"><span>${label}</span><span class="grow"></span><span>${card.kind === 'phrase' ? 'фраза' : (s && s.seen ? 'повтор' : 'новое')}</span><span>${pos + 1} / ${total}</span></div>`;
  }

  function sentHTML(text, e, hide) {
    if (!text) return '';
    let done = false;
    return SL.tokenize(text).map(t => {
      if (!done && t.t === 'w' && (SL.lemma(t.text) === e.lemma || t.text.toLowerCase() === (e.word || '').toLowerCase())) {
        done = true;
        return hide ? '<span class="gap">&nbsp;</span>' : `<b>${SL.esc(t.text)}</b>`;
      }
      return SL.esc(t.text);
    }).join('');
  }

  async function renderCard() {
    const e = card.e;
    const c = card.ctx;
    let html = '';
    if (card.mode === 'recall') {
      html = head(card.kind === 'phrase' ? 'Вспомните перевод фразы' : 'Вспомните значение') +
        `<div class="front ${card.kind === 'phrase' ? 'phrase' : ''}">${SL.esc(card.kind === 'phrase' ? e.text : e.lemma)} <button class="btn sm" data-a="speak">🔊</button></div>` +
        (card.kind === 'word' && c ? `<div class="sent">${sentHTML(c.text, e)}</div>` : '');
    } else if (card.mode === 'cloze') {
      html = head('Впишите пропущенное слово') + `<div class="sent" style="margin-top:28px">${sentHTML(c.text, e, true)}</div>` +
        (c.translation ? `<div class="center mut">${SL.esc(c.translation)}</div>` : e.translation ? `<div class="center mut">подсказка: ${SL.esc(e.translation)}</div>` : '') +
        `<div class="center" style="margin-top:16px"><input class="cloze-in" id="cin" placeholder="слово…" autocomplete="off"></div><div class="center" id="cres" style="margin-top:8px"></div>`;
    } else if (card.mode === 'listen') {
      html = head('Аудирование: послушайте и поймите') + `<div class="center" style="margin:30px 0"><button class="btn primary" data-a="speakCtx" style="font-size:20px;padding:14px 28px">🔊 Слушать</button> <button class="btn" data-a="speakSlow">🐢 медленно</button></div>`;
    } else if (card.mode === 'reverse') {
      html = head('Вспомните по-английски') + `<div class="front phrase">${SL.esc(e.translation)}</div>` +
        `<div class="center" style="margin-top:16px"><input class="cloze-in" id="cin" placeholder="по-английски…" autocomplete="off"></div><div class="center" id="cres" style="margin-top:8px"></div>`;
    }
    html += `<div class="grow"></div><div id="ansBox"></div><div id="gradeBox"><div class="center" style="margin-top:20px"><button class="btn primary" data-a="reveal" style="padding:10px 30px">Показать ответ</button></div></div>`;
    $('card').innerHTML = html;
    const src = card.kind === 'word' ? (c && c.source) : e.source;
    if (src && SL.sourceLink(src)) $('card').insertAdjacentHTML('beforeend', `<div class="src"><a href="${SL.esc(SL.sourceLink(src))}" target="_blank">↗ ${SL.esc((src.title || src.url || '').slice(0, 80))}${src.time ? ' · ' + SL.fmtTime(src.time) : ''}</a></div>`);
    if (card.mode === 'listen') speakCtx();
    const inp = $('cin');
    if (inp) { inp.focus(); inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); reveal(); } }); }
    ensureTranslation(card);
  }

  function speakCtx(rate) {
    const txt = card.kind === 'phrase' ? card.e.text : (card.ctx ? card.ctx.text : card.e.lemma);
    SL.speak(txt, rate ? { rate } : undefined);
  }

  async function reveal() {
    if (revealed) return;
    revealed = true;
    const e = card.e, c = card.ctx;
    let verdict = '';
    let suggest = 2;
    const inp = $('cin');
    if (inp) {
      const v = inp.value.trim().toLowerCase();
      inp.disabled = true;
      const target = card.mode === 'cloze' ? (findForm(c.text, e) || {}).text : (card.kind === 'phrase' ? e.text : e.lemma);
      const ok = v && (v === String(target).toLowerCase() || SL.lemma(v) === (e.lemma || SL.lemma(String(target))) || (card.kind === 'phrase' && v.replace(/[^a-z ]/g, '') === e.text.toLowerCase().replace(/[^a-z ]/g, '')));
      verdict = ok ? `<div class="ok">✓ Верно: ${SL.esc(target)}</div>` : `<div class="bad">✗ Правильно: <b>${SL.esc(target)}</b>${v ? ` (вы: ${SL.esc(v)})` : ''}</div>`;
      suggest = ok ? 2 : 0;
      $('cres').innerHTML = verdict;
    }
    const tr = await ensureTranslation(card);
    let ans = '';
    if (card.mode === 'listen') ans += `<div class="sent">${card.kind === 'phrase' ? SL.esc(e.text) : sentHTML(c.text, e)}</div>`;
    if (card.mode === 'reverse' && card.kind === 'word') ans += `<div class="front">${SL.esc(e.lemma)}</div>`;
    ans += `<div class="tr">${SL.esc(tr || '')}</div>`;
    if (card._dict && card._dict.length && !e.translation) ans += `<div class="mut">${card._dict.slice(0, 2).map(d => `<i>${SL.esc(d.pos)}</i> ${SL.esc(d.terms.slice(0, 4).map(t => t.word).join(', '))}`).join(' · ')}</div>`;
    if (card.kind === 'word' && c && c.translation && card.mode !== 'cloze') ans += `<div class="ctr">${SL.esc(c.translation)}</div>`;
    if (card.kind === 'phrase' && e.context && e.context !== e.text) ans += `<div class="ctr">${SL.esc(e.context)}</div>`;
    if (e.note) ans += `<div class="ctr"><i>${SL.esc(e.note)}</i></div>`;
    ans += `<div style="margin-top:8px"><button class="btn sm" data-a="speak">🔊</button> ${card.kind === 'word' ? '<button class="btn sm" data-a="dict">📖 словарь</button> <button class="btn sm" data-a="known">✓ уже знаю</button>' : ''}</div>`;
    $('ansBox').innerHTML = `<div class="ans">${ans}</div>`;
    const s = e.srs || SL.srs.init();
    $('gradeBox').innerHTML = `<div class="grades">
      ${[['Снова', 0], ['Трудно', 1], ['Хорошо', 2], ['Легко', 3]].map(([n, g]) => `<button class="btn g${g} ${g === suggest && inp ? 'primary' : ''}" data-g="${g}">${n}<small>${SL.srs.preview(s, g)}</small></button>`).join('')}</div>`;
    if (card.mode !== 'listen') speakWord();
  }

  function speakWord() { SL.speak(card.kind === 'phrase' ? card.e.text : card.e.lemma); }

  async function grade(g) {
    if (!revealed) return;
    const it = card;
    await SL.send('vocab:grade', { kind: it.kind, id: it.id, grade: g });
    if (g === 0) { queue.splice(Math.min(queue.length, 3 + Math.floor(Math.random() * 3)), 0, Object.assign({}, it, { e: Object.assign({}, it.e, { srs: Object.assign({}, it.e.srs || {}, { seen: 1 }) }) })); total++; }
    pos++;
    next();
  }

  async function renderSuggest() {
    const w = card.lemma;
    // skip names / non-dictionary words
    const def = await SL.send('define', { word: w }).catch(() => null);
    if (!def) { total--; return next(); }
    $('card').innerHTML = `<div class="mode"><span>Новое частотное слово (#${SL.rank(w)})</span><span class="grow"></span><span>${pos + 1} / ${total}</span></div>
      <div class="front">${SL.esc(w)} <button class="btn sm" data-a="speakS">🔊</button></div><div class="center tr" id="sgtr" style="font-size:20px;color:#fdba74"><span class="sl-spin"></span></div>
      <div class="grow"></div><div class="center mut">Хотите учить это слово?</div>
      <div class="grades" style="grid-template-columns:repeat(3,1fr)"><button class="btn primary" data-s="learning">★ Учить</button><button class="btn" data-s="known">✓ Уже знаю</button><button class="btn" data-s="skip">Пропустить</button></div>`;
    const tr = await ensureTranslation(card);
    const el = $('sgtr'); if (el) el.textContent = tr || '';
    SL.speak(w);
  }

  $('card').addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-a],[data-g],[data-s]');
    if (!b) return;
    if (b.dataset.g) return grade(Number(b.dataset.g));
    if (b.dataset.s) {
      const st = b.dataset.s;
      if (st !== 'skip') await SL.send('vocab:mark', { lemma: card.lemma, word: card.lemma, status: st, translation: card._tr || '' });
      pos++; return next();
    }
    const a = b.dataset.a;
    if (a === 'reveal') reveal();
    else if (a === 'speak') speakWord();
    else if (a === 'speakS') SL.speak(card.lemma);
    else if (a === 'speakCtx') speakCtx();
    else if (a === 'speakSlow') speakCtx(0.65);
    else if (a === 'dict') SL.Dict.show({ word: card.e.lemma, rect: b.getBoundingClientRect(), sentence: card.ctx ? card.ctx.text : '', sentenceTranslation: card.ctx ? card.ctx.translation : '', source: card.ctx && card.ctx.source });
    else if (a === 'known') { await SL.send('vocab:patch', { kind: 'word', id: card.id, patch: { status: 'known' } }); pos++; next(); }
  });

  document.addEventListener('keydown', (e) => {
    if ($('session').classList.contains('hidden') || SL.Dict.open) return;
    if (e.target.tagName === 'INPUT' && !e.target.disabled) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!revealed && card && card.kind !== 'suggest') reveal(); else if (revealed && e.key === 'Enter') grade(2); }
    else if (/^[1-4]$/.test(e.key)) { if (card && card.kind === 'suggest') { const m = { 1: 'learning', 2: 'known', 3: 'skip' }[e.key]; const b = document.querySelector(`[data-s="${m}"]`); b && b.click(); } else grade(Number(e.key) - 1); }
    else if (e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 'к') { if (card) (card.mode === 'listen' && !revealed) ? speakCtx() : speakWord(); }
  });

  $('start').addEventListener('click', start);
  $('quit').addEventListener('click', finish);
  home();
  if (location.hash === '#start') start();
})();

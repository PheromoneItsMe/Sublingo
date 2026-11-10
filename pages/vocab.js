(async function () {
  await SL.loadSettings();
  await SL.loadVocab();
  SL._vocabLoaded = true;
  const $ = (id) => document.getElementById(id);
  let kind = 'word', limit = 300;
  const selected = new Set();
  const TAGS = Object.keys(SL.TAG_COLORS);
  const tagNames = { red: 'красная', yellow: 'жёлтая', green: 'зелёная', blue: 'синяя', purple: 'фиолетовая' };
  $('fTag').innerHTML += TAGS.map(t => `<option value="${t}">● ${tagNames[t]}</option>`).join('');
  $('bulkTag').innerHTML += TAGS.map(t => `<option value="${t}">● ${tagNames[t]}</option>`).join('');

  function hl(text, word) {
    const e = SL.esc(text || '');
    if (!word) return e;
    const re = new RegExp('(^|[^A-Za-z])(' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[a-z]*)', 'i');
    return e.replace(re, '$1<b>$2</b>');
  }
  function dueText(s) {
    if (!s) return '—';
    if (!s.seen) return '<span class="mut">новая</span>';
    const d = (s.due - Date.now()) / 86400000;
    if (d <= 0) return '<b style="color:var(--acc)">сейчас</b>';
    return 'через ' + SL.srs.fmtInterval(d);
  }

  function items() {
    const q = $('q').value.trim().toLowerCase();
    const st = $('fStatus').value, tg = $('fTag').value, sort = $('sort').value;
    const now = Date.now();
    let arr = kind === 'word' ? Object.values(SL.words) : Object.values(SL.phrases);
    arr = arr.filter(x => {
      const text = kind === 'word' ? x.lemma : x.text;
      if (q && !(text.toLowerCase().includes(q) || (x.translation || '').toLowerCase().includes(q) || (x.note || '').toLowerCase().includes(q))) return false;
      if (tg && !(x.tags || []).includes(tg)) return false;
      if (st === 'due') return x.srs && x.srs.seen && x.srs.due <= now && (kind === 'phrase' || x.status === 'learning');
      if (kind === 'word' && st) { if (st === 'none') return !x.status; if (x.status !== st) return false; }
      return true;
    });
    const key = (x) => kind === 'word' ? x.lemma : x.text;
    if (sort === 'alpha') arr.sort((a, b) => key(a).localeCompare(key(b)));
    else if (sort === 'rank') arr.sort((a, b) => (SL.rank(key(a)) || 1e9) - (SL.rank(key(b)) || 1e9));
    else if (sort === 'due') arr.sort((a, b) => ((a.srs && a.srs.due) || 9e15) - ((b.srs && b.srs.due) || 9e15));
    else arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return arr;
  }

  function render() {
    $('nW').textContent = Object.keys(SL.words).length;
    $('nP').textContent = Object.keys(SL.phrases).length;
    $('fStatus').disabled = false;
    const arr = items();
    $('count').textContent = arr.length + ' шт.';
    $('empty').classList.toggle('hidden', arr.length > 0);
    const rows = arr.slice(0, limit).map(x => {
      const id = kind === 'word' ? x.lemma : x.id;
      const c = kind === 'word' ? ((x.contexts || []).find(cc => cc.media) || (x.contexts || [])[0]) : { text: x.context && x.context !== x.text ? x.context : '', translation: '', source: x.source, media: x.media };
      const link = c && c.source ? SL.sourceLink(c.source) : '';
      const src = c && c.source ? (c.source.title || c.source.url || '') : '';
      const status = kind === 'word' ? `<select data-st="${SL.esc(id)}"><option value="learning" ${x.status === 'learning' ? 'selected' : ''}>Учу</option><option value="known" ${x.status === 'known' ? 'selected' : ''}>Знаю</option><option value="ignored" ${x.status === 'ignored' ? 'selected' : ''}>Не учить</option><option value="" ${!x.status ? 'selected' : ''}>—</option></select>` : '<span class="pill learning">фраза</span>';
      return `<tr data-id="${SL.esc(id)}">
        <td class="chk"><input type="checkbox" data-sel="${SL.esc(id)}" ${selected.has(id) ? 'checked' : ''}></td>
        <td>${kind === 'word' ? `<span class="w sl-w" data-w="${SL.esc(x.lemma)}">${SL.esc(x.lemma)}</span>${x.word && x.word.toLowerCase() !== x.lemma ? `<div class="mut">${SL.esc(x.word)}</div>` : ''}<div class="mut">#${SL.rank(x.lemma) || '—'}</div>` : `<span class="w" style="font-weight:500">${SL.esc(x.text)}</span> <button class="btn sm" data-tts="${SL.esc(x.text)}">🔊</button>`}${c && c.media ? ` <button class="btn sm" data-clip="${SL.esc(c.media)}" title="Голос и кадр из видео">🎬</button>` : ''}</td>
        <td style="min-width:180px"><input type="text" class="tr-in" data-tr="${SL.esc(id)}" value="${SL.esc(x.translation || '')}" placeholder="перевод"><input type="text" class="tr-in mut" data-note="${SL.esc(id)}" value="${SL.esc(x.note || '')}" placeholder="заметка"></td>
        <td class="ctx">${c && c.text ? hl(c.text, kind === 'word' ? (x.word || x.lemma) : '') : ''}${c && c.translation ? `<div class="mut">${SL.esc(c.translation)}</div>` : ''}${link ? `<div><a href="${SL.esc(link)}" target="_blank" class="mut">↗ ${SL.esc(src.slice(0, 60))}${c.source.time ? ' · ' + SL.fmtTime(c.source.time) : ''}</a></div>` : ''}${kind === 'word' && (x.contexts || []).length > 1 ? `<div class="mut">+${x.contexts.length - 1} примеров</div>` : ''}</td>
        <td>${status}</td>
        <td class="tags">${TAGS.map(t => `<span class="tagdot ${(x.tags || []).includes(t) ? 'on' : ''}" data-tag="${t}" data-tid="${SL.esc(id)}" style="background:${SL.TAG_COLORS[t]}" title="${tagNames[t]}"></span>`).join('')}</td>
        <td class="mut">${dueText(x.srs)}<div>${x.srs && x.srs.seen ? 'повторов: ' + x.srs.seen : ''}</div></td></tr>`;
    }).join('');
    $('tb').innerHTML = rows;
    $('more').classList.toggle('hidden', arr.length <= limit);
    $('bulk').classList.toggle('hidden', !selected.size);
    $('selN').textContent = selected.size;
    $('bulk').querySelectorAll('[data-bulk="learning"],[data-bulk="known"],[data-bulk="ignored"]').forEach(b => b.classList.toggle('hidden', kind !== 'word'));
  }

  SL.onVocab(SL.debounce(render, 200));
  ['q', 'fStatus', 'fTag', 'sort'].forEach(id => $(id).addEventListener('input', () => { limit = 300; render(); }));
  document.querySelectorAll('[data-kind]').forEach(b => b.addEventListener('click', () => {
    kind = b.dataset.kind; selected.clear(); limit = 300;
    document.querySelectorAll('[data-kind]').forEach(x => x.classList.toggle('on', x === b));
    render();
  }));
  $('more').addEventListener('click', () => { limit += 300; render(); });
  $('all').addEventListener('change', (e) => { const arr = items().slice(0, limit); arr.forEach(x => { const id = kind === 'word' ? x.lemma : x.id; if (e.target.checked) selected.add(id); else selected.delete(id); }); render(); });

  $('tb').addEventListener('change', async (e) => {
    const t = e.target;
    if (t.dataset.sel) { t.checked ? selected.add(t.dataset.sel) : selected.delete(t.dataset.sel); $('bulk').classList.toggle('hidden', !selected.size); $('selN').textContent = selected.size; return; }
    if (t.dataset.st != null) {
      const id = t.dataset.st;
      if (!t.value) await SL.send('vocab:mark', { lemma: id, status: null });
      else await SL.send('vocab:patch', { kind: 'word', id, patch: { status: t.value } });
    }
    if (t.dataset.tr != null) await SL.send('vocab:patch', { kind, id: t.dataset.tr, patch: { translation: t.value } });
    if (t.dataset.note != null) await SL.send('vocab:patch', { kind, id: t.dataset.note, patch: { note: t.value } });
  });
  $('tb').addEventListener('click', async (e) => {
    const t = e.target;
    if (t.dataset.tag) {
      const id = t.dataset.tid;
      const store = kind === 'word' ? SL.words : SL.phrases;
      const tags = (store[id].tags || []).slice();
      const i = tags.indexOf(t.dataset.tag);
      if (i >= 0) tags.splice(i, 1); else tags.push(t.dataset.tag);
      await SL.send('vocab:patch', { kind, id, patch: { tags } });
      return;
    }
    if (t.dataset.tts) { SL.speak(t.dataset.tts); return; }
    if (t.dataset.clip) { showClip(t.dataset.clip); return; }
    const w = t.closest('.sl-w');
    if (w) {
      const e2 = SL.words[w.dataset.w];
      const c = e2 && (e2.contexts || [])[0];
      SL.Dict.show({ word: w.dataset.w, rect: w.getBoundingClientRect(), sentence: c ? c.text : '', sentenceTranslation: c ? c.translation : '', source: c ? c.source : null });
    }
  });

  $('bulk').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-bulk]');
    if (!b) return;
    const ids = [...selected];
    const a = b.dataset.bulk;
    if (a === 'remove') { if (!confirm(`Удалить ${ids.length}?`)) return; await SL.send('vocab:bulk', { kind, ids, remove: true }); selected.clear(); }
    else if (a === 'clearTags') await SL.send('vocab:bulk', { kind, ids, patch: { clearTags: true } });
    else if (a === 'resetSrs') await SL.send('vocab:bulk', { kind, ids, patch: { resetSrs: true } });
    else await SL.send('vocab:bulk', { kind, ids, patch: { status: a } });
  });
  $('bulkTag').addEventListener('change', async (e) => {
    if (!e.target.value) return;
    await SL.send('vocab:bulk', { kind, ids: [...selected], patch: { addTag: e.target.value } });
    e.target.value = '';
  });

  $('addList').addEventListener('click', () => $('addBox').classList.toggle('hidden'));
  $('addGo').addEventListener('click', async () => {
    const lines = $('addText').value.split('\n').map(s => s.trim()).filter(Boolean);
    let n = 0;
    for (const l of lines) {
      const [w, tr] = l.split(/\s+[—–-]\s+|\t|;/);
      if (!w) continue;
      const text = w.trim();
      if (/\s/.test(text)) await SL.send('vocab:savePhrase', { text, translation: (tr || '').trim() });
      else { const lemma = SL.lemma(text); await SL.send('vocab:mark', { lemma, word: text, status: 'learning', translation: (tr || '').trim() }); }
      n++;
    }
    $('addOut').textContent = 'Добавлено: ' + n;
    $('addText').value = '';
  });

  // ------- голос и кадр -------
  let clipBox = null;
  async function showClip(id) {
    const m = await SL.media.get(id).catch(() => null);
    if (!m) { alert('Медиа не найдено'); return; }
    if (!clipBox) { clipBox = document.createElement('div'); clipBox.className = 'clipbox'; document.body.appendChild(clipBox); clipBox.addEventListener('click', e => { if (e.target.dataset.x) clipBox.style.display = 'none'; }); }
    clipBox.innerHTML = `<button class="btn sm" data-x="1" style="float:right">✕</button>${m.image ? `<img src="${SL.esc(m.image)}" alt="">` : ''}${m.text ? `<div class="mut" style="margin:6px 0">${SL.esc(m.text)}</div>` : ''}${m.audio ? `<audio controls autoplay src="${SL.esc(m.audio)}"></audio>` : '<div class="mut">звук не сохранён</div>'}`;
    clipBox.style.display = '';
  }
  function dataUrlBytes(u) {
    const b = atob(String(u).split(',')[1] || '');
    const out = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
    return out;
  }
  // минимальный ZIP (без сжатия)
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(d) { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name), data = f.data, crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const csize = central.reduce((a, b) => a + b.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: 'application/zip' });
  }

  // ------- export -------
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; a.click();
  }
  const csvEsc = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
  $('export').addEventListener('click', async () => {
    const fmt = $('exportFmt').value;
    const last = (await chrome.storage.local.get('sl_lastExport')).sl_lastExport || 0;
    let arr = selected.size ? items().filter(x => selected.has(kind === 'word' ? x.lemma : x.id)) : items();
    if ($('onlyNew').checked) arr = arr.filter(x => (x.createdAt || 0) > last);
    if (!arr.length) { alert('Нечего экспортировать'); return; }
    const day = SL.srs.dayKey();
    const ctxOf = (x) => kind === 'word' ? ((x.contexts || []).find(c => c.media) || (x.contexts || [])[0] || {}) : { text: x.context || '', source: x.source, media: x.media };
    if (fmt === 'json') download(`sublingo-${kind}s-${day}.json`, JSON.stringify(arr, null, 1), 'application/json');
    else if (fmt === 'csv') {
      const head = kind === 'word' ? ['word', 'lemma', 'translation', 'status', 'tags', 'context', 'context_translation', 'source', 'link', 'note', 'created'] : ['phrase', 'translation', 'tags', 'source', 'link', 'note', 'created'];
      const rows = arr.map(x => {
        const c = ctxOf(x);
        return kind === 'word'
          ? [x.word || x.lemma, x.lemma, x.translation, x.status, (x.tags || []).join(' '), c.text, c.translation, c.source && c.source.title, SL.sourceLink(c.source), x.note, new Date(x.createdAt || 0).toISOString()]
          : [x.text, x.translation, (x.tags || []).join(' '), x.source && x.source.title, SL.sourceLink(x.source), x.note, new Date(x.createdAt || 0).toISOString()];
      });
      download(`sublingo-${kind}s-${day}.csv`, '﻿' + [head].concat(rows).map(r => r.map(csvEsc).join(';')).join('\r\n'), 'text/csv');
    } else if (fmt === 'anki') {
      // Fields: Front, Back, Context, ContextTranslation, Audio, Image, Source, Tags
      const clean = (s) => String(s || '').replace(/[\t\r\n]+/g, ' ');
      const lines = ['#separator:tab', '#html:true', '#columns:Front\tBack\tContext\tContextTranslation\tAudio\tImage\tSource\tTags', '#tags column:8'];
      const files = [];
      for (const x of arr) {
        const c = ctxOf(x);
        const front = kind === 'word' ? x.lemma : x.text;
        const ctxHtml = c.text ? SL.esc(c.text).replace(new RegExp('(' + (x.word || x.lemma || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'i'), '<b>$1</b>') : '';
        const link = SL.sourceLink(c.source);
        let audio = '', image = '';
        if (c.media) {
          const m = await SL.media.get(c.media).catch(() => null);
          if (m && m.audio) { const n = 'sublingo_' + c.media + '.wav'; files.push({ name: n, data: dataUrlBytes(m.audio) }); audio = '[sound:' + n + ']'; }
          if (m && m.image) { const n = 'sublingo_' + c.media + '.jpg'; files.push({ name: n, data: dataUrlBytes(m.image) }); image = '<img src="' + n + '">'; }
        }
        lines.push([clean(front), clean((x.translation || '') + (x.note ? '<br><i>' + SL.esc(x.note) + '</i>' : '')), clean(kind === 'word' ? ctxHtml : ''), clean(c.translation || ''), audio, image, link ? `<a href="${SL.esc(link)}">${SL.esc((c.source && c.source.title) || 'источник')}</a>` : '', ['sublingo', kind].concat(x.tags || []).join(' ')].join('\t'));
      }
      const deck = lines.join('\n');
      if (!files.length) download(`sublingo-anki-${kind}s-${day}.txt`, deck, 'text/plain');
      else {
        const howto = 'SubLingo → Anki\r\n\r\n1. Скопируйте все файлы sublingo_*.wav и sublingo_*.jpg в папку collection.media вашего профиля Anki\r\n   (Windows: %APPDATA%\\Anki2\\<профиль>\\collection.media).\r\n2. В Anki: Файл → Импорт → deck.txt. Поля: Front, Back, Context, ContextTranslation, Audio, Image, Source.\r\n3. Добавьте поля Audio и Image в шаблон карточки, чтобы слышать голос и видеть кадр.\r\n';
        const enc = new TextEncoder();
        const blob = zip([{ name: 'deck.txt', data: enc.encode(deck) }, { name: 'КАК_ИМПОРТИРОВАТЬ.txt', data: enc.encode(howto) }].concat(files));
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `sublingo-anki-${kind}s-${day}.zip`; a.click();
      }
    } else if (fmt === 'print') {
      const w = window.open('', '_blank');
      w.document.write(`<html><head><meta charset="utf-8"><title>SubLingo — ${day}</title><style>body{font:14px Arial;margin:30px}td{border-bottom:1px solid #ddd;padding:6px;vertical-align:top}b{color:#c2410c}</style></head><body><h2>SubLingo — ${kind === 'word' ? 'слова' : 'фразы'} (${arr.length})</h2><table>${arr.map(x => { const c = ctxOf(x); return `<tr><td><b>${SL.esc(kind === 'word' ? x.lemma : x.text)}</b></td><td>${SL.esc(x.translation || '')}</td><td><i>${SL.esc(c.text || '')}</i></td></tr>`; }).join('')}</table></body></html>`);
      w.document.close(); w.print();
    }
    await chrome.storage.local.set({ sl_lastExport: Date.now() });
  });

  render();
})();

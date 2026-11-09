/* SubLingo — word lookup on any web page (Alt+click / double-click / selection bubble) */
(function () {
  'use strict';
  if (window.__slWeb) return;
  window.__slWeb = true;

  let ready = SL.loadSettings();
  const isLatin = (s) => /[A-Za-z]/.test(s);

  function wordAt(x, y) {
    let node, offset;
    if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); if (!p) return null; node = p.offsetNode; offset = p.offset; }
    else if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); if (!r) return null; node = r.startContainer; offset = r.startOffset; }
    if (!node || node.nodeType !== 3) return null;
    const text = node.textContent;
    const re = /[A-Za-z]+(?:['’][A-Za-z]+)*/g;
    let m;
    while ((m = re.exec(text))) {
      if (offset >= m.index && offset <= m.index + m[0].length) {
        const range = document.createRange();
        range.setStart(node, m.index); range.setEnd(node, m.index + m[0].length);
        const rect = range.getBoundingClientRect();
        if (x < rect.left - 2 || x > rect.right + 2 || y < rect.top - 2 || y > rect.bottom + 2) return null;
        return { word: m[0], rect, sentence: sentenceAround(node, m.index) };
      }
    }
    return null;
  }

  function sentenceAround(node, idx) {
    let block = node.parentElement;
    while (block && block.parentElement && getComputedStyle(block).display.startsWith('inline')) block = block.parentElement;
    const full = (block ? block.innerText || block.textContent : node.textContent) || '';
    // locate approximate position of the word
    const before = node.textContent.slice(Math.max(0, idx - 30), idx + 20);
    let pos = full.indexOf(before);
    if (pos < 0) pos = 0; else pos += Math.min(30, idx);
    const sents = SL.splitSentences(full.replace(/\s+/g, ' '));
    let acc = 0;
    for (const s of sents) { if (pos <= acc + s.length) return s.trim().slice(0, 500); acc += s.length; }
    return node.textContent.trim().slice(0, 300);
  }

  function selectionRect() {
    const s = getSelection();
    if (!s || s.isCollapsed || !s.rangeCount) return null;
    return s.getRangeAt(0).getBoundingClientRect();
  }

  function show(text, rect, sentence) {
    text = text.trim();
    const single = /^[A-Za-z]+(?:['’-][A-Za-z]+)*$/.test(text);
    const source = { type: 'web', url: location.href, title: document.title };
    if (single) SL.Dict.show({ word: text, rect, sentence: sentence || '', source });
    else SL.Dict.show({ phrase: text, rect, source, sentence: sentence || '' });
  }

  document.addEventListener('click', async (e) => {
    await ready;
    const S = SL.settings;
    if (!S.enabled || S.webLookup !== 'alt' || !e.altKey) return;
    if (e.composedPath().some(n => n.tagName === 'SUBLINGO-UI')) return;
    const w = wordAt(e.clientX, e.clientY);
    if (!w) return;
    e.preventDefault(); e.stopPropagation();
    show(w.word, w.rect, w.sentence);
  }, true);

  document.addEventListener('dblclick', async (e) => {
    await ready;
    const S = SL.settings;
    if (!S.enabled || S.webLookup !== 'dblclick') return;
    if (e.composedPath().some(n => n.tagName === 'SUBLINGO-UI')) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA)$/.test(t.tagName))) return;
    const sel = String(getSelection() || '').trim();
    if (!sel || !isLatin(sel) || sel.length > 60) return;
    const w = wordAt(e.clientX, e.clientY);
    show(sel, selectionRect(), w ? w.sentence : '');
  }, true);

  // selection bubble
  let bubble = null;
  function hideBubble() { if (bubble) { bubble.remove(); bubble = null; } }
  document.addEventListener('mouseup', async (e) => {
    await ready;
    const S = SL.settings;
    if (!S.enabled || !S.webSelectionBubble) return;
    if (e.composedPath().some(n => n.tagName === 'SUBLINGO-UI')) return;
    setTimeout(() => {
      const sel = getSelection();
      const txt = String(sel || '').trim();
      hideBubble();
      if (!txt || txt.length < 2 || txt.length > 600 || !isLatin(txt)) return;
      if (/[А-Яа-яЁё]/.test(txt) && !/[A-Za-z]{3}/.test(txt)) return;
      const a = document.activeElement;
      if (a && (/^(INPUT|TEXTAREA)$/.test(a.tagName) || a.isContentEditable)) return;
      const rect = selectionRect();
      if (!rect || (!rect.width && !rect.height)) return;
      const host = SL.makeHost('sl-bubble-host');
      bubble = document.createElement('button');
      bubble.className = 'sl-bubble sl-root';
      bubble.textContent = 'Перевести';
      bubble.style.left = Math.min(window.innerWidth - 90, Math.max(4, rect.right - 40)) + 'px';
      bubble.style.top = Math.max(4, rect.top - 34) + 'px';
      bubble.addEventListener('mousedown', ev => { ev.preventDefault(); ev.stopPropagation(); });
      bubble.addEventListener('click', ev => {
        ev.preventDefault(); ev.stopPropagation();
        hideBubble();
        const node = sel.anchorNode;
        let sentence = '';
        if (node && node.nodeType === 3) sentence = sentenceAround(node, sel.anchorOffset);
        show(txt, rect, sentence !== txt ? sentence : '');
      });
      host.shadow.appendChild(bubble);
    }, 20);
  }, true);
  document.addEventListener('mousedown', (e) => { if (bubble && !e.composedPath().includes(bubble)) hideBubble(); }, true);
  window.addEventListener('scroll', hideBubble, { passive: true });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'sl:showTranslate') { ready.then(() => show(msg.text, selectionRect(), '')); sendResponse({ ok: true }); }
    if (msg.type === 'sl:savePhraseSel') {
      SL.send('translate', { texts: [msg.text] }).catch(() => ['']).then(tr => SL.send('vocab:savePhrase', { text: msg.text.trim(), translation: (tr || [''])[0], source: { type: 'web', url: location.href, title: document.title } }))
        .then(() => SL.toast('★ Фраза сохранена'), (e) => SL.toast('Ошибка: ' + e.message));
      sendResponse({ ok: true });
    }
  });
})();

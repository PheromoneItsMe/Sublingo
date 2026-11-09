(async function () {
  await SL.loadSettings();
  await SL.loadVocab();
  const S = SL.settings;
  const tl = document.getElementById('targetLang');
  tl.innerHTML = SL.LANGS.map(([c, n]) => `<option value="${c}">${n}</option>`).join('');
  ['enabled', 'autoPause', 'blurTranslation', 'pauseOnHover', 'panelOpen'].forEach(k => {
    const el = document.getElementById(k);
    el.checked = !!S[k];
    el.addEventListener('change', () => SL.saveSettings({ [k]: el.checked }));
  });
  ['targetLang', 'translationMode'].forEach(k => {
    const el = document.getElementById(k);
    el.value = S[k];
    el.addEventListener('change', () => SL.saveSettings({ [k]: el.value }));
  });
  document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => { chrome.tabs.create({ url: chrome.runtime.getURL('pages/' + b.dataset.open) }); window.close(); }));
  document.getElementById('genericOn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) chrome.tabs.sendMessage(tab.id, { type: 'sl:genericActivate' }, () => void chrome.runtime.lastError);
    window.close();
  });
  const now = Date.now();
  let due = 0, fresh = 0, learning = 0;
  for (const k in SL.words) { const w = SL.words[k]; if (w.status === 'learning') { learning++; if (w.srs && w.srs.seen && w.srs.due <= now) due++; else if (!w.srs || !w.srs.seen) fresh++; } }
  for (const k in SL.phrases) { const p = SL.phrases[k]; if (p.srs && p.srs.seen && p.srs.due <= now) due++; else if (!p.srs || !p.srs.seen) fresh++; }
  document.getElementById('due').textContent = `${due} к повторению · ${fresh} новых`;
  document.getElementById('cnt').textContent = `${learning} учу · ${Object.keys(SL.phrases).length} фраз`;
})();

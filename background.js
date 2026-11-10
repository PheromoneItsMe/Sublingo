/* SubLingo — service worker */
importScripts('common/freq.js', 'common/lib.js', 'common/srs.js', 'common/media.js');

const state = { settingsLoaded: SL.loadSettings() };

/* ------------------------------------------------------------------ */
/* Serialized storage writes                                           */
/* ------------------------------------------------------------------ */
let queue = Promise.resolve();
function serial(fn) { const p = queue.then(fn, fn); queue = p.catch(() => {}); return p; }

async function getVocab() {
  const r = await chrome.storage.local.get(['sl_words', 'sl_phrases']);
  return { words: r.sl_words || {}, phrases: r.sl_phrases || {} };
}
async function bumpStat(field, n) {
  const k = SL.srs.dayKey();
  const r = await chrome.storage.local.get('sl_stats');
  const st = r.sl_stats || { days: {} };
  st.days[k] = st.days[k] || {};
  st.days[k][field] = (st.days[k][field] || 0) + (n || 1);
  await chrome.storage.local.set({ sl_stats: st });
}

function addContext(entry, ctx) {
  if (!ctx || !ctx.text) return;
  entry.contexts = entry.contexts || [];
  const ex = entry.contexts.find(c => c.text === ctx.text);
  if (ex) { if (ctx.media && !ex.media) ex.media = ctx.media; return; }
  const c = { text: String(ctx.text).slice(0, 600), translation: ctx.translation || '', source: ctx.source || null, at: Date.now() };
  if (ctx.media) c.media = ctx.media;
  entry.contexts.unshift(c);
  entry.contexts = entry.contexts.slice(0, 8);
}

const vocab = {
  mark: ({ lemma, word, status, context, translation }) => serial(async () => {
    const { words } = await getVocab();
    const now = Date.now();
    let e = words[lemma];
    if (!status) {
      if (e) { delete e.status; if (!(e.tags && e.tags.length)) { SL.media.del(mediaIds(e)).catch(() => {}); delete words[lemma]; } }
      await chrome.storage.local.set({ sl_words: words });
      return null;
    }
    if (!e) { e = words[lemma] = { lemma, word: word || lemma, tags: [], translation: '', note: '', contexts: [], createdAt: now }; }
    const prev = e.status;
    e.status = status;
    e.updatedAt = now;
    if (translation && !e.translation) e.translation = translation;
    addContext(e, context);
    if (status === 'learning' && !e.srs) e.srs = SL.srs.init(now);
    if (status === 'known' && prev === 'learning') await bumpStat('learned');
    await chrome.storage.local.set({ sl_words: words });
    if (status === 'learning' && prev !== 'learning') await bumpStat('marked');
    return e;
  }),
  tag: ({ lemma, word, tag }) => serial(async () => {
    const { words } = await getVocab();
    let e = words[lemma];
    if (!e) e = words[lemma] = { lemma, word: word || lemma, tags: [], translation: '', note: '', contexts: [], createdAt: Date.now() };
    e.tags = e.tags || [];
    const i = e.tags.indexOf(tag);
    if (i >= 0) e.tags.splice(i, 1); else e.tags.push(tag);
    if (!e.status && !e.tags.length) delete words[lemma];
    await chrome.storage.local.set({ sl_words: words });
    return words[lemma] || null;
  }),
  patch: ({ kind, id, patch }) => serial(async () => {
    const v = await getVocab();
    const store = kind === 'phrase' ? v.phrases : v.words;
    if (!store[id]) return null;
    Object.assign(store[id], patch, { updatedAt: Date.now() });
    if (kind !== 'phrase' && patch.status === 'learning' && !store[id].srs) store[id].srs = SL.srs.init();
    await chrome.storage.local.set(kind === 'phrase' ? { sl_phrases: v.phrases } : { sl_words: v.words });
    return store[id];
  }),
  bulk: ({ kind, ids, patch, remove }) => serial(async () => {
    const v = await getVocab();
    const store = kind === 'phrase' ? v.phrases : v.words;
    for (const id of ids) {
      if (!store[id]) continue;
      if (remove) { SL.media.del(mediaIds(store[id])).catch(() => {}); delete store[id]; continue; }
      if (patch.addTag) { store[id].tags = store[id].tags || []; if (!store[id].tags.includes(patch.addTag)) store[id].tags.push(patch.addTag); }
      else if (patch.clearTags) store[id].tags = [];
      else Object.assign(store[id], patch);
      if (patch.status === 'learning' && !store[id].srs) store[id].srs = SL.srs.init();
      if (patch.resetSrs) { store[id].srs = SL.srs.init(); delete store[id].resetSrs; }
      store[id].updatedAt = Date.now();
    }
    await chrome.storage.local.set(kind === 'phrase' ? { sl_phrases: v.phrases } : { sl_words: v.words });
    return ids.length;
  }),
  savePhrase: ({ text, translation, source, context, media }) => serial(async () => {
    const { phrases } = await getVocab();
    const existing = Object.values(phrases).find(p => p.text === text);
    if (existing) { if (translation && !existing.translation) existing.translation = translation; if (media && !existing.media) existing.media = media; await chrome.storage.local.set({ sl_phrases: phrases }); return existing; }
    const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    phrases[id] = { id, text, translation: translation || '', source: source || null, context: context || '', tags: [], note: '', createdAt: Date.now(), srs: SL.srs.init() };
    if (media) phrases[id].media = media;
    await chrome.storage.local.set({ sl_phrases: phrases });
    await bumpStat('marked');
    return phrases[id];
  }),
  removePhrase: ({ text, id }) => serial(async () => {
    const { phrases } = await getVocab();
    for (const k in phrases) if (k === id || phrases[k].text === text) { if (phrases[k].media) SL.media.del(phrases[k].media).catch(() => {}); delete phrases[k]; }
    await chrome.storage.local.set({ sl_phrases: phrases });
    return true;
  }),
  grade: ({ kind, id, grade }) => serial(async () => {
    const v = await getVocab();
    const store = kind === 'phrase' ? v.phrases : v.words;
    const e = store[id];
    if (!e) return null;
    const wasNew = !(e.srs && e.srs.seen);
    e.srs = SL.srs.grade(e.srs, grade);
    const s = SL.settings;
    let learned = false;
    if (kind !== 'phrase' && s.autoKnownDays && e.srs.interval >= s.autoKnownDays) { e.status = 'known'; learned = true; }
    await chrome.storage.local.set(kind === 'phrase' ? { sl_phrases: v.phrases } : { sl_words: v.words });
    await bumpStat('reviewed');
    if (wasNew) await bumpStat('newStarted');
    if (learned) await bumpStat('learned');
    return e;
  }),
  import: ({ data, replace }) => serial(async () => {
    const v = replace ? { words: {}, phrases: {} } : await getVocab();
    let nw = 0, np = 0;
    const words = data.words || data.sl_words || {};
    const phrases = data.phrases || data.sl_phrases || {};
    // из файла берём только обычные записи-объекты (без __proto__ и прочих служебных ключей)
    const okKey = (k, val) => !/^(__proto__|constructor|prototype)$/.test(k) && val && typeof val === 'object' && !Array.isArray(val);
    for (const k of Object.keys(words)) { if (!okKey(k, words[k])) continue; if (!v.words[k]) nw++; v.words[k] = Object.assign({}, v.words[k] || {}, words[k]); }
    for (const k of Object.keys(phrases)) { if (!okKey(k, phrases[k])) continue; if (!v.phrases[k]) np++; v.phrases[k] = Object.assign({}, v.phrases[k] || {}, phrases[k]); }
    const patch = { sl_words: v.words, sl_phrases: v.phrases };
    if (data.texts || data.sl_texts) patch.sl_texts = Object.assign({}, (await chrome.storage.local.get('sl_texts')).sl_texts || {}, data.texts || data.sl_texts);
    if (data.settings || data.sl_settings) patch.sl_settings = Object.assign({}, SL.settings, data.settings || data.sl_settings);
    await chrome.storage.local.set(patch);
    return { words: nw, phrases: np };
  }),
  markMany: ({ lemmas, status }) => serial(async () => {
    const { words } = await getVocab();
    const now = Date.now();
    for (const l of lemmas) {
      let e = words[l];
      if (!e) e = words[l] = { lemma: l, word: l, tags: [], translation: '', note: '', contexts: [], createdAt: now };
      e.status = status; e.updatedAt = now;
      if (status === 'learning' && !e.srs) e.srs = SL.srs.init(now);
    }
    await chrome.storage.local.set({ sl_words: words });
    return lemmas.length;
  })
};

const texts = {
  save: ({ text }) => serial(async () => {
    const r = await chrome.storage.local.get('sl_texts');
    const all = r.sl_texts || {};
    const id = text.id || ('t' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5));
    all[id] = Object.assign({ createdAt: Date.now() }, all[id] || {}, text, { id, updatedAt: Date.now() });
    await chrome.storage.local.set({ sl_texts: all });
    return all[id];
  }),
  remove: ({ id }) => serial(async () => {
    const r = await chrome.storage.local.get('sl_texts');
    const all = r.sl_texts || {};
    delete all[id];
    await chrome.storage.local.set({ sl_texts: all });
    return true;
  })
};

/* ------------------------------------------------------------------ */
/* Translation / dictionary                                            */
/* ------------------------------------------------------------------ */
const tCache = new Map();
function cacheGet(k) { return tCache.get(k); }
function cacheSet(k, v) { if (tCache.size > 20000) tCache.delete(tCache.keys().next().value); tCache.set(k, v); }

async function fetchRetry(url, opts, tries) {
  tries = tries || 3;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, opts);
      if (r.status === 429 || r.status >= 500) { await new Promise(res => setTimeout(res, 800 * (i + 1) * (i + 1))); continue; }
      return r;
    } catch (e) { if (i === tries - 1) throw e; await new Promise(res => setTimeout(res, 500 * (i + 1))); }
  }
  throw new Error('Сервис перевода недоступен (слишком много запросов)');
}

async function gtxTranslate(q, sl, tl) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(q)}`;
  const r = await fetchRetry(url);
  if (!r.ok) throw new Error('Перевод: HTTP ' + r.status);
  const d = await r.json();
  return (d[0] || []).map(s => s[0] || '').join('');
}

async function translateMany(textsIn, sl, tl) {
  sl = sl || 'en'; tl = tl || SL.settings.targetLang || 'ru';
  const res = new Array(textsIn.length);
  const todo = [];
  textsIn.forEach((t, i) => {
    const clean = String(t || '').replace(/\s*\n\s*/g, ' ').trim();
    if (!clean) { res[i] = ''; return; }
    const c = cacheGet(sl + tl + clean);
    if (c != null) res[i] = c; else todo.push({ i, text: clean });
  });
  const chunks = [];
  let cur = [], len = 0;
  for (const it of todo) {
    if (cur.length && (len + it.text.length > 1500 || cur.length >= 40)) { chunks.push(cur); cur = []; len = 0; }
    cur.push(it); len += it.text.length + 1;
  }
  if (cur.length) chunks.push(cur);
  let idx = 0;
  async function worker() {
    while (idx < chunks.length) {
      const ch = chunks[idx++];
      try {
        const out = await gtxTranslate(ch.map(x => x.text).join('\n'), sl, tl);
        const parts = out.split('\n');
        if (parts.length === ch.length) {
          ch.forEach((x, k) => { res[x.i] = parts[k].trim(); cacheSet(sl + tl + x.text, res[x.i]); });
          continue;
        }
      } catch (e) {
        // сервис ответил ошибкой (часто 429 — слишком много запросов): не добиваем его поштучными запросами
        if (/HTTP \d/.test(e.message)) { ch.forEach(x => { res[x.i] = ''; }); continue; }
      }
      for (const x of ch) {
        try { res[x.i] = (await gtxTranslate(x.text, sl, tl)).trim(); cacheSet(sl + tl + x.text, res[x.i]); }
        catch (e) { res[x.i] = ''; }
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  return res;
}

async function lookup({ word, sl, tl }) {
  sl = sl || 'en'; tl = tl || SL.settings.targetLang || 'ru';
  const key = 'L' + sl + tl + word.toLowerCase();
  const c = cacheGet(key);
  if (c) return c;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&hl=${tl}&dt=t&dt=bd&dt=rm&dt=md&dt=ex&dt=ss&dt=at&dj=1&q=${encodeURIComponent(word)}`;
  const r = await fetchRetry(url);
  if (!r.ok) throw new Error('Словарь: HTTP ' + r.status);
  const d = await r.json();
  const out = {
    translation: (d.sentences || []).filter(s => s.trans).map(s => s.trans).join(''),
    translit: ((d.sentences || []).find(s => s.src_translit) || {}).src_translit || '',
    dict: (d.dict || []).map(x => ({
      pos: x.pos, base: x.base_form,
      terms: (x.entry || []).slice(0, 8).map(e => ({ word: e.word, reverse: (e.reverse_translation || []).slice(0, 5), score: e.score || 0 }))
    })),
    definitions: (d.definitions || []).map(x => ({ pos: x.pos, items: (x.entry || []).slice(0, 4).map(e => ({ gloss: e.gloss, example: e.example })) })),
    examples: ((d.examples && d.examples.example) || []).slice(0, 5).map(e => SL.cleanText(e.text)),
    synonyms: (d.synsets || []).map(s => ({ pos: s.pos, words: [].concat(...(s.entry || []).map(e => e.synonym || [])).slice(0, 10) })),
    alternatives: ((d.alternative_translations || [])[0] || { alternative: [] }).alternative ? (((d.alternative_translations || [])[0] || {}).alternative || []).map(a => a.word_postproc).filter(Boolean).slice(0, 6) : []
  };
  cacheSet(key, out);
  return out;
}

async function define({ word }) {
  const key = 'D' + word.toLowerCase();
  const c = cacheGet(key);
  if (c !== undefined) return c;
  try {
    const r = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word.toLowerCase()));
    if (!r.ok) { cacheSet(key, null); return null; }
    const d = await r.json();
    const first = d[0] || {};
    const ph = [].concat(...d.map(x => x.phonetics || []));
    const out = {
      word: first.word,
      phonetic: first.phonetic || (ph.find(p => p.text) || {}).text || '',
      audio: (ph.find(p => p.audio && /-us\./.test(p.audio)) || ph.find(p => p.audio) || {}).audio || '',
      meanings: [].concat(...d.map(x => x.meanings || [])).map(m => ({
        pos: m.partOfSpeech,
        defs: (m.definitions || []).slice(0, 4).map(x => ({ def: x.definition, example: x.example || '' })),
        synonyms: (m.synonyms || []).slice(0, 8)
      })).slice(0, 6)
    };
    cacheSet(key, out);
    return out;
  } catch (e) { return null; }
}

async function ai({ messages, system }) {
  const s = SL.settings;
  if (!s.aiKey) throw new Error('Добавьте API-ключ ИИ в настройках');
  const ep = s.aiEndpoint || SL.DEFAULTS.aiEndpoint;
  if (/anthropic\.com/.test(ep)) {
    const r = await fetch(ep, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': s.aiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: s.aiModel, max_tokens: 1200, system: system || undefined, messages })
    });
    const d = await r.json();
    if (!r.ok) throw new Error((d.error && d.error.message) || ('HTTP ' + r.status));
    return (d.content || []).map(c => c.text || '').join('');
  }
  const msgs = system ? [{ role: 'system', content: system }].concat(messages) : messages;
  const r = await fetch(ep, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + s.aiKey },
    body: JSON.stringify({ model: s.aiModel, messages: msgs, temperature: 0.3 })
  });
  const d = await r.json();
  if (!r.ok) throw new Error((d.error && d.error.message) || ('HTTP ' + r.status));
  return ((d.choices || [])[0] || {}).message ? d.choices[0].message.content : '';
}

/* ------------------------------------------------------------------ */
/* TTS                                                                 */
/* ------------------------------------------------------------------ */
// если голос не выбран — берём самый естественный из доступных (а не системный «робот»)
let bestVoice = null;
function pickVoice() {
  if (bestVoice !== null) return Promise.resolve(bestVoice);
  return new Promise(r => chrome.tts.getVoices(vs => {
    const en = (vs || []).filter(v => /^en/i.test(v.lang || ''));
    const score = (v) => (/natural|neural|online/i.test(v.voiceName) ? 40 : 0) + (/google/i.test(v.voiceName) ? 20 : 0) + (/en-US/i.test(v.lang) ? 5 : 0) + (v.remote ? 3 : 0) - (/david|zira|mark|espeak/i.test(v.voiceName) ? 10 : 0);
    en.sort((a, b) => score(b) - score(a));
    bestVoice = en[0] ? en[0].voiceName : '';
    r(bestVoice);
  }));
}
async function tts({ text, rate, voice, lang }) {
  const v = voice || SL.settings.ttsVoice || await pickVoice();
  return new Promise((resolve) => {
    chrome.tts.stop();
    const opts = { lang: lang || 'en-US', rate: rate || SL.settings.ttsRate || 1, onEvent: (e) => { if (['end', 'error', 'interrupted', 'cancelled'].includes(e.type)) resolve(e.type); } };
    if (v) opts.voiceName = v;
    chrome.tts.speak(String(text).slice(0, 1000), opts);
  });
}

/* ------------------------------------------------------------------ */
/* Due badge                                                           */
/* ------------------------------------------------------------------ */
async function dueCount() {
  const { words, phrases } = await getVocab();
  const now = Date.now();
  let n = 0;
  for (const k in words) { const w = words[k]; if (w.status === 'learning' && w.srs && w.srs.seen && w.srs.due <= now) n++; }
  for (const k in phrases) { const p = phrases[k]; if (p.srs && p.srs.seen && p.srs.due <= now) n++; }
  return n;
}
function mediaIds(e) { if (!e) return []; return [e.media].concat((e.contexts || []).map(c => c.media)).filter(Boolean); }

// снимок «честного» словаря на сегодня: сколько учу, сколько реально закреплено повторением, сколько отмечено «знаю»
async function snapshot() {
  const { words, phrases } = await getVocab();
  let learning = 0, mature = 0, known = 0;
  for (const k in words) { const w = words[k]; if (w.status === 'learning') { learning++; if (w.srs && w.srs.interval >= 21) mature++; } else if (w.status === 'known') known++; }
  for (const k in phrases) { const p = phrases[k]; learning++; if (p.srs && p.srs.interval >= 21) mature++; }
  const r = await chrome.storage.local.get('sl_stats');
  const st = r.sl_stats || { days: {} };
  const d = SL.srs.dayKey();
  st.days[d] = st.days[d] || {};
  st.days[d].snap = { learning, mature, known };
  await chrome.storage.local.set({ sl_stats: st });
}

// просмотр: минуты, услышанные реплики и слова, журнал видео
const watch = ({ sec, lines, heard, source }) => serial(async () => {
  const r = await chrome.storage.local.get(['sl_stats', 'sl_heard', 'sl_watchlog']);
  const st = r.sl_stats || { days: {} };
  const d = SL.srs.dayKey();
  st.days[d] = st.days[d] || {};
  st.days[d].watchSec = (st.days[d].watchSec || 0) + (sec || 0);
  st.days[d].lines = (st.days[d].lines || 0) + (lines || 0);
  const hd = r.sl_heard || {};
  let fresh = 0;
  for (const w in (heard || {})) { if (!hd[w]) fresh++; hd[w] = (hd[w] || 0) + heard[w]; }
  st.days[d].newHeard = (st.days[d].newHeard || 0) + fresh;
  const log = r.sl_watchlog || {};
  if (source && (source.url || source.videoId || source.movieId || source.title)) {
    const key = source.videoId ? 'yt:' + source.videoId : source.movieId ? 'nf:' + source.movieId : (source.url || source.title);
    const e = log[key] = log[key] || { title: source.title || '', url: SL.sourceLink(source) || source.url || '', sec: 0, first: Date.now() };
    e.sec += sec || 0; e.last = Date.now(); if (source.title) e.title = source.title;
    const keys = Object.keys(log);
    if (keys.length > 400) keys.sort((a, b) => log[a].last - log[b].last).slice(0, keys.length - 400).forEach(k => delete log[k]);
  }
  await chrome.storage.local.set({ sl_stats: st, sl_heard: hd, sl_watchlog: log });
  return true;
});

async function updateBadge() {
  try {
    serial(snapshot).catch(() => {});
    const n = await dueCount();
    chrome.action.setBadgeText({ text: n ? String(n > 999 ? '999+' : n) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#f97316' });
  } catch (e) {}
}
chrome.storage.onChanged.addListener((ch) => { if (ch.sl_words || ch.sl_phrases) updateBadgeDebounced(); });
const updateBadgeDebounced = SL.debounce(updateBadge, 1500);

/* ------------------------------------------------------------------ */
/* Context menus                                                       */
/* ------------------------------------------------------------------ */
function setupMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'sl-translate', title: 'SubLingo: перевести «%s»', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'sl-save-phrase', title: 'SubLingo: сохранить как фразу', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'sl-reader-sel', title: 'SubLingo: открыть выделенное в режиме чтения', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'sl-reader-page', title: 'SubLingo: импортировать страницу в режим чтения', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'sl-open-vocab', title: 'Мои слова', contexts: ['action'] });
    chrome.contextMenus.create({ id: 'sl-open-review', title: 'Повторение (карточки)', contexts: ['action'] });
    chrome.contextMenus.create({ id: 'sl-open-reader', title: 'Режим чтения', contexts: ['action'] });
  });
}
chrome.runtime.onInstalled.addListener((d) => {
  setupMenus();
  chrome.alarms.create('sl-badge', { periodInMinutes: 10 });
  updateBadge();
  if (d.reason === 'update') setTimeout(gcMedia, 30000);
  if (d.reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('pages/options.html#welcome') });
});
chrome.runtime.onStartup.addListener(() => { setupMenus(); updateBadge(); setTimeout(gcMedia, 60000); });

/* Чистка медиа: голос и кадры слов/фраз, которые уже удалены (или вытеснены новыми примерами).
   Свежие записи (моложе часа) не трогаем — их могли только что сохранить, а слово ещё не записано. */
async function gcMedia() {
  try {
    const v = await getVocab();
    const used = new Set();
    Object.values(v.words).forEach(e => mediaIds(e).forEach(id => used.add(id)));
    Object.values(v.phrases).forEach(e => mediaIds(e).forEach(id => used.add(id)));
    const hourAgo = Date.now() - 3600e3;
    const stale = (await SL.media.keys()).filter(id => {
      if (used.has(id)) return false;
      const ts = parseInt(String(id).slice(1, 9), 36);   // id = 'm' + время (8 знаков в base36) + случайное
      return !(ts > hourAgo);
    });
    if (stale.length) await SL.media.del(stale);
  } catch (e) {}
}
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'sl-badge') updateBadge(); });

function extractPage() {
  const sel = String(getSelection() || '').trim();
  if (sel.length > 40) return { title: document.title, text: sel, url: location.href };
  const pick = document.querySelector('article') || document.querySelector('main') || document.querySelector('[role=main]') || document.body;
  const clone = pick.cloneNode(true);
  clone.querySelectorAll('script,style,noscript,nav,header,footer,aside,form,iframe,svg,button,figure figcaption,[aria-hidden=true]').forEach(n => n.remove());
  const blocks = [];
  clone.querySelectorAll('h1,h2,h3,h4,p,li,blockquote,pre').forEach(n => { const t = n.innerText || n.textContent; if (t && t.trim().length > 1) blocks.push(t.trim()); });
  let text = blocks.length > 3 ? blocks.join('\n\n') : (clone.innerText || clone.textContent || '');
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return { title: document.title, text, url: location.href };
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const open = (p) => chrome.tabs.create({ url: chrome.runtime.getURL('pages/' + p) });
  if (info.menuItemId === 'sl-open-vocab') return open('vocab.html');
  if (info.menuItemId === 'sl-open-review') return open('review.html');
  if (info.menuItemId === 'sl-open-reader') return open('reader.html');
  if (info.menuItemId === 'sl-translate' || info.menuItemId === 'sl-save-phrase') {
    if (!tab || tab.id < 0) return;
    chrome.tabs.sendMessage(tab.id, { type: info.menuItemId === 'sl-translate' ? 'sl:showTranslate' : 'sl:savePhraseSel', text: info.selectionText }, { frameId: info.frameId || 0 }, () => void chrome.runtime.lastError);
    return;
  }
  if (info.menuItemId === 'sl-reader-sel') {
    const t = await texts.save({ text: { title: (tab && tab.title) || 'Выделенный текст', text: info.selectionText, url: tab && tab.url } });
    return open('reader.html?id=' + t.id);
  }
  if (info.menuItemId === 'sl-reader-page') {
    try {
      const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractPage });
      const d = res && res.result;
      if (!d || !d.text) throw new Error('empty');
      const t = await texts.save({ text: { title: d.title, text: d.text, url: d.url } });
      open('reader.html?id=' + t.id);
    } catch (e) { open('reader.html?error=import'); }
  }
});

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */
const handlers = {
  'translate': (m) => translateMany(m.texts || [], m.sl, m.tl),
  'lookup': lookup,
  'define': define,
  'lemma': (m) => ({ lemma: SL.lemma(m.word), rank: SL.rank(m.word) }),
  'tts': tts,
  'tts:stop': () => { chrome.tts.stop(); return true; },
  'tts:voices': () => new Promise(r => chrome.tts.getVoices(v => r((v || []).filter(x => !x.lang || /^en/i.test(x.lang)).map(x => ({ name: x.voiceName, lang: x.lang, remote: x.remote }))))),
  'ai': ai,
  'vocab:mark': vocab.mark,
  'vocab:tag': vocab.tag,
  'vocab:patch': vocab.patch,
  'vocab:bulk': vocab.bulk,
  'vocab:savePhrase': vocab.savePhrase,
  'vocab:removePhrase': vocab.removePhrase,
  'vocab:grade': vocab.grade,
  'vocab:import': vocab.import,
  'vocab:markMany': vocab.markMany,
  'texts:save': texts.save,
  'texts:remove': texts.remove,
  'due': dueCount,
  'media:put': (m) => SL.media.put(m.id, m.value),
  'stats:watch': watch,
  'stats:bump': (m) => serial(() => bumpStat(m.field, m.n || 1)).then(() => true),
  'stats:snapshot': () => serial(snapshot).then(() => true),
  'injectCore': async (m, sender) => {
    await chrome.scripting.executeScript({ target: { tabId: sender.tab.id, frameIds: [sender.frameId || 0] }, files: ['common/freq.js', 'common/phrases.js', 'content/clip.js', 'content/core.js'] });
    return true;
  },
  'tabInfo': (m, sender) => ({ url: sender.tab && sender.tab.url, title: sender.tab && sender.tab.title }),
  'fetchPage': fetchPage,
  'open': (m) => chrome.tabs.create({ url: chrome.runtime.getURL('pages/' + String(m.page || '').replace(/[^\w.#?=&-]/g, '')) }).then(() => true)
};

/* Загрузка файла субтитров в обход CORS. Адрес может подсунуть сама страница (через плеер),
   поэтому пускаем только обычные http(s)-адреса в интернете: без localhost, локальной сети и т.п. */
function isPublicUrl(u) {
  let url;
  try { url = new URL(u); } catch (e) { return false; }
  if (!/^https?:$/.test(url.protocol)) return false;
  const h = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!h || h === 'localhost' || /\.(localhost|local|internal|lan|home|corp)$/.test(h) || !h.includes('.') && !h.includes(':')) return false;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(h)) return false;
  if (h.includes(':') && (h === '::1' || /^(fc|fd|fe80)/.test(h) || h.startsWith('::ffff:'))) return false;
  return true;
}
async function fetchPage(m) {
  if (!isPublicUrl(m.url)) throw new Error('адрес не разрешён');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(m.url, { credentials: 'omit', signal: ctl.signal, redirect: 'follow' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    if (r.url && !isPublicUrl(r.url)) throw new Error('адрес не разрешён');
    return (await r.text()).slice(0, 3000000);
  } finally { clearTimeout(timer); }
}

// эти действия меняют много данных разом — их можно вызывать только со страниц самого расширения
const PAGES_ONLY = new Set(['vocab:import', 'vocab:bulk', 'vocab:grade', 'texts:save', 'texts:remove', 'stats:snapshot']);
const EXT_ORIGIN = chrome.runtime.getURL('');

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const h = msg && handlers[msg.type];
  if (!h) return false;
  if (sender.id !== chrome.runtime.id || (PAGES_ONLY.has(msg.type) && !(sender.url || '').startsWith(EXT_ORIGIN))) {
    sendResponse({ error: 'forbidden' });
    return false;
  }
  state.settingsLoaded.then(() => h(msg, sender)).then(
    (result) => sendResponse({ result }),
    (e) => sendResponse({ error: (e && e.message) || String(e) })
  );
  return true;
});

SL.onSettings(() => {});

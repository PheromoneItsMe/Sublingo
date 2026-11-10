/* SubLingo — shared library (content scripts, extension pages, service worker). */
var SL = (typeof SL !== 'undefined') ? SL : {};
(function (SL) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Settings                                                            */
  /* ------------------------------------------------------------------ */
  SL.DEFAULTS = {
    enabled: true,
    sourceLang: 'en',
    targetLang: 'ru',
    translationMode: 'auto',      // auto | human | machine | youtube | off
    showOriginal: true,
    showTranslation: true,
    blurTranslation: false,       // скрыть перевод до наведения / клавиши E
    fontSize: 30,
    transFontScale: 0.8,
    fontFamily: 'default',
    bottomOffset: 9,              // % от низа видео
    subBackground: 0.6,
    keepLastLine: true,
    autoPause: false,
    infiniteRepeat: false,
    slowSegments: false,
    slowRate: 0.8,
    pauseOnHover: true,
    pauseOnDict: true,
    overrideArrows: false,
    hideNativeSubs: true,
    panelOpen: true,
    panelWidth: 400,
    panelShowTranslation: true,
    vocabLevel: 2000,             // сколько самых частых слов считать известными
    suggestWindow: 1500,          // сколько слов после уровня подсвечивать как «рекомендуемые»
    rareRank: 20000,              // ранг, после которого слово считается редким
    colorKnownGreen: false,
    colorLearning: true,
    colorSuggested: true,
    colorUnknown: true,
    dimRare: true,
    outlineMarked: true,
    showTagUnderline: true,
    leftClick: 'dict',            // dict | dictSpeak | speak | none
    rightClick: 'learning',       // learning | known | dict | speak | none
    middleClick: 'known',
    speakOnClick: false,
    dictDetailed: false,
    hoverTranslate: true,         // перевод при наведении
    saveMedia: true,              // сохранять голос и кадр вместе с фразой          // словарь сразу в подробном виде
    genericSites: [],             // сайты, где включены субтитры для обычных HTML5-плееров
    genericAuto: true,            // включаться автоматически, если найдены субтитры
    subOffset: 0,
    wordHighlight: false,
    subPos: {},                   // своя позиция субтитров по сайтам: { key: { x, y } } в % от плеера
    subStyle: {},                 // вид субтитров по сайтам: { key: { fontSize, subBackground, transFontScale } }
    panelBarCollapsed: false,     // свернуть верхнюю панель управления в списке реплик
    pauseBefore: 'off',           // пауза ДО реплики: off | all | hard
    autoPauseHard: false,         // автопауза только на трудных репликах
    hardMin: 2,                   // трудная реплика — от стольких незнакомых слов
    showExpr: true,               // подчёркивать устойчивые выражения и фразовые глаголы
    summaryAtEnd: true,           // итог по видео в конце
    ttsMode: 'manual',            // синтетический голос: on — сам и по кнопке, manual — только по кнопке 🔊, off — никогда
    ttsRate: 0.95,
    ttsVoice: '',
    webLookup: 'alt',             // off | alt | dblclick
    webSelectionBubble: true,
    externalDicts: ['cambridge', 'oxford', 'wiktionary', 'urban', 'youglish', 'reverso', 'images'],
    customDicts: [],              // [{name, url}] url содержит {word}
    aiEndpoint: 'https://api.openai.com/v1/chat/completions',
    aiKey: '',
    aiModel: 'gpt-4o-mini',
    reviewSessionSize: 30,
    reviewNewPercent: 30,
    reviewModes: { recall: true, cloze: true, listen: true, reverse: false },
    reviewSuggestions: true,
    autoKnownDays: 60,
    uiScale: 1
  };

  SL.EXTERNAL_DICTS = {
    cambridge: { name: 'Cambridge', url: 'https://dictionary.cambridge.org/dictionary/english-russian/{word}' },
    oxford: { name: 'Oxford', url: 'https://www.oxfordlearnersdictionaries.com/search/english/?q={word}' },
    wiktionary: { name: 'Wiktionary', url: 'https://en.wiktionary.org/wiki/{word}' },
    urban: { name: 'Urban', url: 'https://www.urbandictionary.com/define.php?term={word}' },
    youglish: { name: 'YouGlish', url: 'https://youglish.com/pronounce/{word}/english' },
    reverso: { name: 'Reverso', url: 'https://context.reverso.net/translation/english-russian/{word}' },
    images: { name: 'Картинки', url: 'https://www.google.com/search?tbm=isch&q={word}' },
    multitran: { name: 'Multitran', url: 'https://www.multitran.com/m.exe?l1=1&l2=2&s={word}' },
    gtranslate: { name: 'G.Translate', url: 'https://translate.google.com/?sl=en&tl=ru&text={word}' },
    merriam: { name: 'Merriam-W.', url: 'https://www.merriam-webster.com/dictionary/{word}' }
  };

  SL.LANGS = [
    ['ru', 'Русский'], ['hy', 'Հայերեն'], ['uk', 'Українська'], ['be', 'Беларуская'], ['kk', 'Қазақша'],
    ['ka', 'ქართული'], ['az', 'Azərbaycan'], ['uz', 'Oʻzbek'], ['de', 'Deutsch'], ['fr', 'Français'],
    ['es', 'Español'], ['it', 'Italiano'], ['pt', 'Português'], ['pl', 'Polski'], ['tr', 'Türkçe'],
    ['zh-CN', '中文'], ['ja', '日本語'], ['ko', '한국어'], ['ar', 'العربية'], ['fa', 'فارسی'], ['he', 'עברית']
  ];

  SL.TAG_COLORS = { red: '#ef4444', yellow: '#eab308', green: '#22c55e', blue: '#3b82f6', purple: '#a855f7' };

  const hasChrome = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

  /* После обновления расширения (⟳) старые скрипты на открытой странице теряют связь с ним:
     любой вызов chrome.* падает с «Extension context invalidated». Тогда тихо выключаемся
     и один раз просим обновить страницу. */
  SL.alive = function () { try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; } };
  const deadCbs = [];
  SL.whenDead = function (cb) { if (SL._dead) cb(); else deadCbs.push(cb); };
  SL.checkAlive = function () {
    if (SL._dead) return false;
    if (!hasChrome || SL.alive()) return true;
    SL._dead = true;
    deadCbs.splice(0).forEach(cb => { try { cb(); } catch (e) {} });
    return false;
  };
  const isDeadErr = (e) => /context invalidated/i.test(String(e && e.message || e));
  const hang = () => new Promise(() => {});   // мёртвый скрипт просто замолкает, без ошибок в консоли

  SL.settings = Object.assign({}, SL.DEFAULTS);
  const settingsListeners = [];
  SL.loadSettings = async function () {
    if (!hasChrome) return SL.settings;
    if (!SL.checkAlive()) return hang();
    let r;
    try { r = await chrome.storage.local.get('sl_settings'); } catch (e) { if (isDeadErr(e)) { SL.checkAlive(); return hang(); } throw e; }
    SL.settings = Object.assign({}, SL.DEFAULTS, r.sl_settings || {});
    SL.settings.reviewModes = Object.assign({}, SL.DEFAULTS.reviewModes, (r.sl_settings || {}).reviewModes || {});
    return SL.settings;
  };
  let saveChain = Promise.resolve();
  SL.saveSettings = async function (patch) {
    Object.assign(SL.settings, patch);
    if (!hasChrome) return;
    if (!SL.checkAlive()) return hang();
    // записи по очереди: два быстрых сохранения подряд не должны затирать друг друга
    const run = async () => {
      const r = await chrome.storage.local.get('sl_settings');
      await chrome.storage.local.set({ sl_settings: Object.assign({}, r.sl_settings || {}, patch) });
    };
    const p = saveChain.then(run, run);
    saveChain = p.catch(() => {});
    try { await p; } catch (e) { if (isDeadErr(e)) { SL.checkAlive(); return hang(); } throw e; }
  };
  SL.onSettings = function (cb) { settingsListeners.push(cb); };

  /* ------------------------------------------------------------------ */
  /* Vocabulary cache (read here, all writes go through the background)  */
  /* ------------------------------------------------------------------ */
  SL.words = {};
  SL.phrases = {};
  const vocabListeners = [];
  SL.loadVocab = async function () {
    if (!hasChrome) return;
    if (!SL.checkAlive()) return hang();
    let r;
    try { r = await chrome.storage.local.get(['sl_words', 'sl_phrases']); } catch (e) { if (isDeadErr(e)) { SL.checkAlive(); return hang(); } throw e; }
    SL.words = r.sl_words || {};
    SL.phrases = r.sl_phrases || {};
  };
  SL.onVocab = function (cb) { vocabListeners.push(cb); };

  if (hasChrome && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.sl_settings) {
        SL.settings = Object.assign({}, SL.DEFAULTS, changes.sl_settings.newValue || {});
        SL.settings.reviewModes = Object.assign({}, SL.DEFAULTS.reviewModes, (changes.sl_settings.newValue || {}).reviewModes || {});
        settingsListeners.forEach(cb => { try { cb(SL.settings); } catch (e) { console.error(e); } });
      }
      if (changes.sl_words || changes.sl_phrases) {
        if (changes.sl_words) SL.words = changes.sl_words.newValue || {};
        if (changes.sl_phrases) SL.phrases = changes.sl_phrases.newValue || {};
        vocabListeners.forEach(cb => { try { cb(); } catch (e) { console.error(e); } });
      }
    });
  }

  SL.send = function (type, data) {
    if (hasChrome && !SL.checkAlive()) return hang();
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(Object.assign({ type }, data || {}), (resp) => {
          const err = chrome.runtime.lastError;
          if (err) { if (isDeadErr(err)) { SL.checkAlive(); return; } return reject(new Error(err.message)); }
          if (resp && resp.error) return reject(new Error(resp.error));
          resolve(resp ? resp.result : undefined);
        });
      } catch (e) { if (isDeadErr(e)) { SL.checkAlive(); return; } reject(e); }
    });
  };

  /* ------------------------------------------------------------------ */
  /* Frequency + lemmatizer                                              */
  /* ------------------------------------------------------------------ */
  let FREQ = null;
  function freq() {
    if (FREQ) return FREQ;
    FREQ = new Map();
    if (typeof SL_FREQ_WORDS === 'string') {
      const arr = SL_FREQ_WORDS.split(' ');
      for (let i = 0; i < arr.length; i++) if (!FREQ.has(arr[i])) FREQ.set(arr[i], i + 1);
    }
    return FREQ;
  }
  SL.hasFreq = () => typeof SL_FREQ_WORDS === 'string';
  SL.freqList = function () { return typeof SL_FREQ_WORDS === 'string' ? SL_FREQ_WORDS.split(' ') : []; };

  const IRREGULAR = {};
  (function () {
    const verbs = 'arise arose arisen|awake awoke awoken|be was were been being am is are|bear bore borne born|beat beat beaten|become became become|begin began begun|bend bent|bet bet|bind bound|bite bit bitten|bleed bled|blow blew blown|break broke broken|breed bred|bring brought|build built|burn burnt|burst burst|buy bought|catch caught|choose chose chosen|cling clung|come came come|cost cost|creep crept|cut cut|deal dealt|dig dug|do did done does doing|draw drew drawn|dream dreamt|drink drank drunk|drive drove driven|eat ate eaten|fall fell fallen|feed fed|feel felt|fight fought|find found|flee fled|fling flung|fly flew flown flies|forbid forbade forbidden|forget forgot forgotten|forgive forgave forgiven|freeze froze frozen|get got gotten|give gave given|go went gone goes|grind ground|grow grew grown|hang hung|have had has having|hear heard|hide hid hidden|hit hit|hold held|hurt hurt|keep kept|kneel knelt|know knew known|lay laid|lead led|lean leant|leap leapt|learn learnt|leave left|lend lent|let let|lie lay lain|light lit|lose lost|make made|mean meant|meet met|pay paid|prove proven|put put|quit quit|read read|rid rid|ride rode ridden|ring rang rung|rise rose risen|run ran run|say said|see saw seen|seek sought|sell sold|send sent|set set|sew sewn|shake shook shaken|shed shed|shine shone|shoot shot|show shown|shrink shrank shrunk|shut shut|sing sang sung|sink sank sunk|sit sat|sleep slept|slide slid|sling slung|speak spoke spoken|speed sped|spend spent|spill spilt|spin spun|spit spat|split split|spread spread|spring sprang sprung|stand stood|steal stole stolen|stick stuck|sting stung|stink stank stunk|strike struck stricken|string strung|strive strove striven|swear swore sworn|sweep swept|swell swollen|swim swam swum|swing swung|take took taken|teach taught|tear tore torn|tell told|think thought|throw threw thrown|thrust thrust|tread trod trodden|understand understood|wake woke woken|wear wore worn|weave wove woven|weep wept|win won|wind wound|withdraw withdrew withdrawn|wring wrung|write wrote written|overcome overcame|undertake undertook undertaken|mistake mistook mistaken|forsee foresaw foreseen|upset upset|withstand withstood';
    verbs.split('|').forEach(g => { const p = g.split(' '); const base = p[0]; p.slice(1).forEach(f => { if (f !== base && !IRREGULAR[f]) IRREGULAR[f] = base; }); });
    const nouns = 'man men|woman women|child children|person people|foot feet|tooth teeth|mouse mice|goose geese|ox oxen|louse lice|die dice|leaf leaves|life lives|knife knives|wife wives|wolf wolves|half halves|shelf shelves|thief thieves|loaf loaves|calf calves|self selves|elf elves|analysis analyses|crisis crises|thesis theses|phenomenon phenomena|criterion criteria|datum data|medium media|cactus cacti|fungus fungi|nucleus nuclei|radius radii|stimulus stimuli|index indices|matrix matrices|appendix appendices';
    nouns.split('|').forEach(g => { const p = g.split(' '); IRREGULAR[p[1]] = p[0]; });
    const adj = 'good better best|bad worse worst|far further furthest farther farthest|little less least|many more most|well better best';
    adj.split('|').forEach(g => { const p = g.split(' '); p.slice(1).forEach(f => { if (!IRREGULAR[f]) IRREGULAR[f] = p[0]; }); });
    // these comparatives are words in their own right; keep them as their own lemmas
    ['more', 'most', 'less', 'least', 'better', 'best', 'worse', 'worst', 'further', 'well', 'data', 'media', 'people', 'left', 'found', 'ground', 'saw', 'lay', 'wound', 'lit', 'bound', 'spoke', 'rose', 'felt', 'fell', 'fed', 'lead', 'read', 'lie', 'press'].forEach(w => delete IRREGULAR[w]);
    IRREGULAR['people'] = 'people'; // keep
  })();

  const CONTRACTIONS = { "n't": '', "'s": '', "'re": '', "'ve": '', "'ll": '', "'d": '', "'m": '' };
  const KEEP_CONTRACTIONS = new Set(["don't", "doesn't", "didn't", "can't", "won't", "isn't", "aren't", "wasn't", "weren't", "haven't", "hasn't", "hadn't", "wouldn't", "shouldn't", "couldn't", "mustn't", "i'm", "you're", "we're", "they're", "i've", "you've", "we've", "they've", "i'll", "you'll", "he'll", "she'll", "we'll", "they'll", "i'd", "you'd", "he'd", "she'd", "we'd", "they'd", "it's", "that's", "there's", "what's", "let's", "he's", "she's", "who's", "here's", "ain't", "y'all", "ma'am", "o'clock"]);

  const KEEP_ING = new Set(['evening', 'morning', 'during', 'interesting', 'according', 'nothing', 'something', 'anything', 'everything', 'thing', 'king', 'ring', 'bring', 'spring', 'string', 'swing', 'wing', 'ceiling', 'wedding', 'pudding', 'darling', 'sibling', 'lightning', 'offspring', 'awning', 'herring', 'inning', 'amazing', 'boring']);

  // лемма считается часто (каждое слово каждой реплики) — запоминаем результат
  const lemmaMemo = new Map();
  SL.lemma = function (word) {
    const key = String(word || '');
    let r = lemmaMemo.get(key);
    if (r !== undefined) return r;
    r = lemmaRaw(key);
    if (lemmaMemo.size > 30000) lemmaMemo.clear();
    lemmaMemo.set(key, r);
    return r;
  };
  function lemmaRaw(word) {
    let w = String(word || '').toLowerCase().replace(/[’‘`]/g, "'").trim();
    if (!w) return w;
    if (KEEP_CONTRACTIONS.has(w)) return w;
    for (const c in CONTRACTIONS) {
      if (w.endsWith(c) && w.length > c.length + 1) { w = w.slice(0, -c.length); break; }
    }
    if (w.endsWith("s'") && w.length > 3) w = w.slice(0, -1);
    if (IRREGULAR[w]) return IRREGULAR[w];
    if (w.length <= 3) return w;
    const cands = [];
    const add = (c, pen) => { if (c && c.length >= 2) cands.push([c, pen]); };
    // plurals / 3rd person
    if (w.endsWith('ies')) add(w.slice(0, -3) + 'y', 0);
    if (w.endsWith('ves')) { add(w.slice(0, -3) + 'f', 1); add(w.slice(0, -3) + 'fe', 1); }
    if (/(ss|sh|ch|x|z|o)es$/.test(w)) add(w.slice(0, -2), 0);
    if (w.endsWith('es') && !w.endsWith('ees')) add(w.slice(0, -1), 1);
    if (/[^s]ses$/.test(w)) add(w.slice(0, -2), 1);
    if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) add(w.slice(0, -1), 0);
    // past
    if (w.endsWith('ied')) add(w.slice(0, -3) + 'y', 0);
    if (w.endsWith('ed')) {
      const s = w.slice(0, -2);
      if (s.length >= 3) add(s, 0);
      if (!s.endsWith('e')) add(s + 'e', 0);
      if (/([bcdfghjklmnprstvz])\1$/.test(s)) add(s.slice(0, -1), 0);
      if (w.endsWith('eed') && w.length > 5) add(w.slice(0, -1), 1);
    }
    // -ing
    if (w.endsWith('ing') && w.length > 4) {
      const s = w.slice(0, -3);
      if (s.length >= 3) { add(s, 0); add(s + 'e', 0); }
      if (/([bcdfghjklmnprstvz])\1$/.test(s)) add(s.slice(0, -1), 0);
      if (s.endsWith('y')) add(s.slice(0, -1) + 'ie', 1);
    }
    // comparatives
    if (w.endsWith('ier')) add(w.slice(0, -3) + 'y', 2);
    if (w.endsWith('iest')) add(w.slice(0, -4) + 'y', 2);
    if (w.endsWith('est') && w.length > 5) { const s = w.slice(0, -3); add(s, 2); add(s + 'e', 2); if (/([bdgmnpt])\1$/.test(s)) add(s.slice(0, -1), 2); }
    if (w.endsWith('er') && w.length > 4) { const s = w.slice(0, -2); add(s, 3); add(s + 'e', 3); if (/([bdgmnpt])\1$/.test(s)) add(s.slice(0, -1), 3); }

    if (!cands.length) return w;
    const f = freq();
    if (!f.size) return cands[0][0] || w;
    const wr = f.get(w);
    let best = null, bestScore = Infinity;
    for (const [c, pen] of cands) {
      const r = f.get(c);
      if (!r) continue;
      const score = r * (1 + pen * 0.6);
      if (score < bestScore) { best = c; bestScore = score; }
    }
    if (!best) return w;
    if (wr && f.get(best) > wr * 4) return w;
    if (KEEP_ING.has(w)) return w;
    // comparatives / agentive -er: keep word if it is itself much more frequent ("water", "number", "paper")
    if (wr && /(er|est)$/.test(w) && !/(ied|ed|ing|s)$/.test(w)) {
      const br = f.get(best);
      if (wr < br * 3) return w;
    }
    // words like "news", "series", "always", "during", "nothing", "something", "morning"
    if (wr && /ing$/.test(w) && wr < 3000 && /(thing|ning|ring|ding|ling)$/.test(w) && f.get(best) > wr) return w;
    if (wr && /s$/.test(w) && KEEP_S.has(w)) return w;
    return best;
  }
  const KEEP_S = new Set(['news', 'series', 'always', 'perhaps', 'sometimes', 'besides', 'towards', 'afterwards', 'species', 'politics', 'physics', 'mathematics', 'economics', 'thanks', 'glasses', 'clothes', 'pants', 'jeans', 'scissors', 'headquarters', 'means', 'whereas', 'yes', 'this', 'his', 'its', 'us', 'was', 'has', 'is', 'as', 'does', 'goes']);

  SL.rank = function (word) {
    const f = freq();
    if (!f.size) return 0;
    const w = String(word || '').toLowerCase().replace(/[’‘`]/g, "'");
    const l = SL.lemma(w);
    const a = f.get(l), b = f.get(w);
    if (a && b) return Math.min(a, b);
    return a || b || 0;
  };

  /* ------------------------------------------------------------------ */
  /* Tokenizer                                                           */
  /* ------------------------------------------------------------------ */
  const TOKEN_RE = /([A-Za-zÀ-ɏ]+(?:['’][A-Za-zÀ-ɏ]+)*)|(\d+(?:[.,:]\d+)*)/g;
  SL.tokenize = function (text) {
    const out = [];
    let last = 0, m;
    text = String(text || '');
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(text))) {
      if (m.index > last) out.push({ t: 's', text: text.slice(last, m.index) });
      if (m[1]) out.push({ t: 'w', text: m[1] });
      else out.push({ t: 'n', text: m[2] });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ t: 's', text: text.slice(last) });
    // mark sentence starts (for proper-noun detection)
    let start = true;
    for (const tk of out) {
      if (tk.t === 'w') { tk.sentStart = start; start = false; }
      else if (tk.t === 's' && /[.!?…:"“\-—–]\s*$|^\s*[-—–]/.test(tk.text)) start = true;
      else if (tk.t === 'n') start = false;
    }
    return out;
  };

  SL.splitSentences = function (text) {
    const res = [];
    const re = /[^.!?…]+(?:[.!?…]+["'”’)\]]*|$)\s*/g;
    let m;
    while ((m = re.exec(text))) { if (m[0].trim()) res.push(m[0]); if (m.index + m[0].length >= text.length) break; }
    return res.length ? res : [text];
  };

  /* ------------------------------------------------------------------ */
  /* Word status                                                         */
  /* ------------------------------------------------------------------ */
  // returns {status, marked, rank, lemma, tags}
  SL.classify = function (surface, sentStart) {
    const s = SL.settings;
    const lower = surface.toLowerCase().replace(/[’‘`]/g, "'");
    const lemma = SL.lemma(lower);
    const entry = SL.words[lemma] || (lemma !== lower ? SL.words[lower] : null);
    const rank = SL.rank(lower);
    if (entry && entry.status) return { status: entry.status, marked: true, rank, lemma, tags: entry.tags || [] };
    const cap = /^[A-Z]/.test(surface);
    if (cap && !sentStart && (!rank || rank > 3000) && lower !== 'i') return { status: 'special', marked: false, rank, lemma, tags: [] };
    if (!rank) return { status: (lower.length <= 2 ? 'special' : 'rare'), marked: false, rank, lemma, tags: [] };
    if (rank <= s.vocabLevel) return { status: 'known', marked: false, rank, lemma, tags: [] };
    if (rank <= s.vocabLevel + s.suggestWindow) return { status: 'suggested', marked: false, rank, lemma, tags: [] };
    if (rank > s.rareRank) return { status: 'rare', marked: false, rank, lemma, tags: [] };
    return { status: 'unknown', marked: false, rank, lemma, tags: [] };
  };

  SL.statusClass = function (c) {
    const s = SL.settings;
    const cls = ['sl-w'];
    switch (c.status) {
      case 'learning': if (s.colorLearning) cls.push('sl-learning'); break;
      case 'known': if (s.colorKnownGreen) cls.push('sl-known'); break;
      case 'ignored': cls.push('sl-ignored'); break;
      case 'suggested': if (s.colorSuggested) cls.push('sl-suggested'); break;
      case 'unknown': if (s.colorUnknown) cls.push('sl-unknown'); break;
      case 'rare': if (s.dimRare) cls.push('sl-rare'); break;
      case 'special': cls.push('sl-special'); break;
    }
    if (c.marked && s.outlineMarked && c.status !== 'ignored') cls.push('sl-marked');
    return cls.join(' ');
  };

  SL.STATUS_LABEL = { known: 'Знаю', learning: 'Учу', ignored: 'Не учить', suggested: 'Рекомендуемое', unknown: 'Новое', rare: 'Редкое', special: 'Имя/число' };

  /* ------------------------------------------------------------------ */
  /* Subtitle parsers                                                    */
  /* ------------------------------------------------------------------ */
  function decodeEntities(s) {
    return s.replace(/&(#\d+|#x[0-9a-f]+|amp|lt|gt|quot|apos|nbsp|lrm|rlm);/gi, (m, e) => {
      e = e.toLowerCase();
      if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', lrm: '', rlm: '' }[e];
    });
  }
  function cleanText(s) {
    return decodeEntities(String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\{\\[^}]*\}/g, ''))
      .replace(/​/g, '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
  }
  SL.cleanText = cleanText;

  function parseTime(t) {
    t = t.trim().replace(',', '.');
    const p = t.split(':').map(Number);
    if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
    if (p.length === 2) return p[0] * 60 + p[1];
    return Number(t) || 0;
  }

  SL.parseVTT = function (text) {
    const lines = [];
    const blocks = String(text).replace(/\r/g, '').split(/\n\n+/);
    for (const b of blocks) {
      const rows = b.split('\n');
      const ti = rows.findIndex(r => r.includes('-->'));
      if (ti < 0) continue;
      const [a, rest] = rows[ti].split('-->');
      const bEnd = rest.trim().split(/\s+/)[0];
      const txt = cleanText(rows.slice(ti + 1).join('\n'));
      if (!txt) continue;
      lines.push({ start: parseTime(a), end: parseTime(bEnd), text: txt });
    }
    return SL.normalizeLines(lines);
  };
  SL.parseSRT = SL.parseVTT;

  SL.parseTTML = function (xml) {
    const out = [];
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const tickRate = Number(doc.documentElement.getAttribute('ttp:tickRate')) || 10000000;
    const t = (v) => {
      if (!v) return 0;
      if (v.endsWith('t')) return Number(v.slice(0, -1)) / tickRate;
      if (v.endsWith('ms')) return Number(v.slice(0, -2)) / 1000;
      if (v.endsWith('s')) return Number(v.slice(0, -1));
      return parseTime(v);
    };
    doc.querySelectorAll('p').forEach(p => {
      const html = new XMLSerializer().serializeToString(p).replace(/<br[^>]*\/?>/g, '\n');
      const txt = cleanText(html);
      if (txt) out.push({ start: t(p.getAttribute('begin')), end: t(p.getAttribute('end')), text: txt });
    });
    return SL.normalizeLines(out);
  };

  // YouTube json3. ASR tracks get merged from word segments into readable lines.
  SL.parseJSON3 = function (json, isASR) {
    const ev = (json && json.events) || [];
    if (!isASR) {
      const out = [];
      for (const e of ev) {
        if (!e.segs) continue;
        const txt = cleanText(e.segs.map(s => s.utf8 || '').join(''));
        if (!txt || txt === '\n') continue;
        const start = (e.tStartMs || 0) / 1000;
        out.push({ start, end: start + (e.dDurationMs || 2000) / 1000, text: txt });
      }
      return SL.normalizeLines(out);
    }
    // ASR: collect words with timing
    const words = [];
    for (const e of ev) {
      if (!e.segs || e.aAppend) continue;
      const base = e.tStartMs || 0;
      const evEnd = base + (e.dDurationMs || 0);
      e.segs.forEach((s, i) => {
        const w = (s.utf8 || '').replace(/\n/g, ' ');
        if (!w.trim()) return;
        const st = base + (s.tOffsetMs || 0);
        words.push({ w: w.trim(), t: st / 1000, evEnd: evEnd / 1000 });
      });
    }
    for (let i = 0; i < words.length; i++) words[i].end = i + 1 < words.length ? Math.min(words[i + 1].t, words[i].t + 1.5) : words[i].t + 1;
    const out = [];
    let cur = [];
    const flush = () => {
      if (!cur.length) return;
      out.push({ start: cur[0].t, end: Math.max(cur[cur.length - 1].end, cur[0].t + 0.8), text: cur.map(x => x.w).join(' '), words: cur.map(x => ({ w: x.w, t: x.t })) });
      cur = [];
    };
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (cur.length) {
        const prev = cur[cur.length - 1];
        const gap = w.t - prev.end;
        const chars = cur.reduce((a, x) => a + x.w.length + 1, 0);
        if (gap > 0.9 || cur.length >= 14 || chars > 75 || (/[.?!]$/.test(prev.w) && cur.length > 3)) flush();
      }
      cur.push(w);
    }
    flush();
    return SL.normalizeLines(out);
  };

  SL.normalizeLines = function (lines) {
    lines = lines.filter(l => l.text && isFinite(l.start)).sort((a, b) => a.start - b.start);
    // merge exact duplicates (YouTube sometimes repeats)
    const out = [];
    for (const l of lines) {
      const p = out[out.length - 1];
      if (p && p.text === l.text && Math.abs(p.start - l.start) < 0.05) { p.end = Math.max(p.end, l.end); continue; }
      if (!(l.end > l.start)) l.end = l.start + 2;
      const o = { start: l.start, end: l.end, text: l.text };
      if (l.words) o.words = l.words;
      out.push(o);
    }
    // trim overlaps so that only one line is "current"
    for (let i = 0; i < out.length - 1; i++) {
      if (out[i].end > out[i + 1].start && out[i + 1].start > out[i].start) out[i].end = out[i + 1].start;
    }
    out.forEach((l, i) => { l.i = i; });
    return out;
  };

  // Align translation lines (different timing) to original lines.
  SL.alignTranslations = function (orig, trans) {
    const res = new Array(orig.length).fill('');
    if (!trans || !trans.length) return res;
    const used = new Array(trans.length).fill(-1);
    // надписи на экране (ПОЧЁТНАЯ ПРЕМИЯ…) пишут капсом — в перевод реплик их не берём
    const isSign = (l) => { const L = l.replace(/[^A-Za-zА-Яа-яЁё]/g, ''); return L.length >= 4 && L === L.toUpperCase() && L !== L.toLowerCase(); };
    const origCaps = orig.slice(0, 50).every(o => isSign(o.text));
    for (let j = 0; j < trans.length; j++) {
      let t = trans[j];
      if (!origCaps) {
        const kept = t.text.split('\n').filter(l => !isSign(l)).join(' ').trim();
        if (!kept) continue;
        if (kept !== t.text) t = Object.assign({}, t, { text: kept });
      }
      let best = -1, bestOv = 0;
      // binary search start
      let lo = 0, hi = orig.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (orig[mid].end < t.start) lo = mid + 1; else hi = mid; }
      for (let i = Math.max(0, lo - 1); i < orig.length && orig[i].start <= t.end; i++) {
        const ov = Math.min(orig[i].end, t.end) - Math.max(orig[i].start, t.start);
        if (ov > bestOv) { bestOv = ov; best = i; }
      }
      if (best < 0) {
        // nearest by start
        let d = Infinity;
        for (let i = Math.max(0, lo - 2); i < Math.min(orig.length, lo + 2); i++) { const dd = Math.abs(orig[i].start - t.start); if (dd < d) { d = dd; best = i; } }
        if (d > 3) best = -1;
      }
      if (best >= 0) { used[j] = best; res[best] = res[best] ? res[best] + ' ' + t.text : t.text; }
    }
    return res;
  };

  SL.findLine = function (lines, t) {
    let lo = 0, hi = lines.length - 1, ans = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (lines[mid].start <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
    return ans;
  };

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */
  SL.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); };
  SL.fmtTime = function (sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
  };
  SL.debounce = function (fn, ms) { let t; return function () { clearTimeout(t); const a = arguments; t = setTimeout(() => fn.apply(this, a), ms); }; };
  SL.el = function (tag, attrs, html) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) { if (k === 'class') e.className = attrs[k]; else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]); }
    if (html != null) e.innerHTML = html;
    return e;
  };
  SL.sourceLink = function (src) {
    if (!src) return '';
    if (src.type === 'youtube' && src.videoId) return 'https://www.youtube.com/watch?v=' + src.videoId + (src.time ? '&t=' + Math.floor(src.time) + 's' : '');
    if (src.type === 'netflix' && src.movieId) return 'https://www.netflix.com/watch/' + src.movieId + (src.time ? '?t=' + Math.floor(src.time) : '');
    return /^https?:\/\//i.test(src.url || '') ? src.url : '';
  };
  /* Сколько в реплике слов, которые ещё не знаешь (учишь, новые, рекомендуемые, редкие из словаря) */
  SL.hardCount = function (text) {
    let n = 0;
    for (const tk of parsed(String(text || '')).toks) {
      if (tk.t !== 'w') continue;
      const c = SL.classify(tk.text, tk.sentStart);
      if (c.status === 'learning' || c.status === 'unknown' || c.status === 'suggested' || (c.status === 'rare' && c.rank)) n++;
    }
    return n;
  };
  // разбор реплики на слова и поиск выражений не зависят от словаря — кэшируем по тексту
  const parseMemo = new Map();
  function parsed(text) {
    let r = parseMemo.get(text);
    if (r) return r;
    const toks = SL.tokenize(text);
    r = { toks, xs: SL.findExpr ? SL.findExpr(toks) : [] };
    if (parseMemo.size > 6000) parseMemo.clear();
    parseMemo.set(text, r);
    return r;
  }
  let savedSrc = null, savedSet = new Set();
  function savedPhrases() {
    if (savedSrc !== SL.phrases) { savedSrc = SL.phrases; savedSet = new Set(Object.values(SL.phrases || {}).map(p => String(p.text || '').toLowerCase())); }
    return savedSet;
  }
  SL.renderTokensHTML = function (text, opts) {
    opts = opts || {};
    const pr = parsed(String(text || ''));
    const toks = pr.toks;
    const xs = (opts.expr !== false && SL.settings.showExpr !== false) ? pr.xs : [];
    const xOpen = new Map(), xClose = new Set();
    if (xs.length) {
      const saved = savedPhrases();
      xs.forEach(x => { xOpen.set(x.a, { x, saved: saved.has(x.canon.toLowerCase()) }); xClose.add(x.b); });
    }
    let html = '';
    for (let ti = 0; ti < toks.length; ti++) {
      const tk = toks[ti];
      const xo = xOpen.get(ti);
      if (xo) html += `<span class="sl-xp${xo.saved ? ' sl-xpsaved' : ''}" data-x="${SL.esc(xo.x.canon)}" data-g="${SL.esc(xo.x.gloss)}">`;
      if (tk.t === 'w') {
        const c = SL.classify(tk.text, tk.sentStart);
        let style = '';
        if (SL.settings.showTagUnderline && c.tags && c.tags.length) style = ` style="text-decoration:underline 3px ${SL.TAG_COLORS[c.tags[0]] || '#fff'};text-underline-offset:4px"`;
        html += `<span class="${SL.statusClass(c)}" data-w="${SL.esc(tk.text)}"${style}>${SL.esc(tk.text)}</span>`;
      } else if (tk.t === 'n') html += `<span class="sl-n">${SL.esc(tk.text)}</span>`;
      else html += SL.esc(tk.text).replace(/\n/g, opts.br === false ? ' ' : '<br>');
      if (xClose.has(ti)) html += '</span>';
    }
    return html;
  };
  /* Время каждого слова в реплике.
     Если у реплики есть метки слов (автосубтитры YouTube) — берём их, иначе распределяем
     длительность по словам пропорционально слогам, с короткими паузами на знаках препинания. */
  SL.wordTimes = function (line) {
    const toks = SL.tokenize(line.text);
    const idx = [];
    toks.forEach((t, i) => { if (t.t === 'w' || t.t === 'n') idx.push(i); });
    const times = new Array(idx.length).fill(line.start);
    if (!idx.length) return times;
    if (line.words && line.words.length) {
      let k = 0;
      for (const w of line.words) {
        const n = SL.tokenize(w.w).filter(t => t.t === 'w' || t.t === 'n').length;
        for (let j = 0; j < n && k < times.length; j++) times[k++] = w.t;
      }
      for (; k < times.length; k++) times[k] = times[k - 1] || line.start;
      return times;
    }
    const syl = (w) => Math.max(1, (String(w).toLowerCase().replace(/e\b/g, '').match(/[aeiouy]+/g) || []).length);
    const weights = [];
    let total = 0;
    idx.forEach((ti, j) => {
      let wgt = toks[ti].t === 'n' ? Math.max(1, toks[ti].text.length / 2) : syl(toks[ti].text);
      const after = toks[ti + 1];
      const pause = after && after.t === 's' ? (/[.!?…]/.test(after.text) ? 1.2 : /[,;:—–-]/.test(after.text) ? 0.6 : 0) : 0;
      weights.push([wgt, pause]);
      total += wgt + (j < idx.length - 1 ? pause : 0);
    });
    const dur = Math.max(0.3, (line.end - line.start) * 0.92);
    let acc = 0;
    weights.forEach(([wgt, pause], j) => { times[j] = line.start + dur * (acc / total); acc += wgt + pause; });
    return times;
  };

  /* Bridge to the MAIN-world script */
  SL.bridge = function () {
    let n = 0;
    const pending = {};
    const events = [];
    window.addEventListener('message', (ev) => {
      if (ev.source !== window) return;
      const d = ev.data;
      if (!d || d.__sl !== 'to-content') return;
      if (d.event) { events.forEach(cb => cb(d)); return; }
      const p = pending[d.id];
      if (!p) return;
      delete pending[d.id];
      d.error ? p.reject(new Error(d.error)) : p.resolve(d.result);
    });
    return {
      call(cmd, args, timeout) {
        const id = 'c' + (++n) + Math.random().toString(36).slice(2, 6);
        return new Promise((resolve, reject) => {
          pending[id] = { resolve, reject };
          window.postMessage({ __sl: 'to-main', id, cmd, args }, '*');
          setTimeout(() => { if (pending[id]) { delete pending[id]; reject(new Error('timeout: ' + cmd)); } }, timeout || 20000);
        });
      },
      on(cb) { events.push(cb); }
    };
  };
})(SL);

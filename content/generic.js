/* SubLingo — learning subtitles for any HTML5 video player (online cinemas, embedded players, your own sites). */
(function () {
  'use strict';
  if (window.__slGeneric) return;
  window.__slGeneric = true;

  const isFrame = window.top !== window;
  const host = location.hostname;
  const ready = SL.loadSettings();
  const br = SL.bridge();
  const sources = [];          // {id, key, label, lang, lines, kind}
  let video = null, player = null, active = false, activating = false, framePanel = false;
  let cur = null, userTrans = null, tabInfo = null, containerCache = new WeakMap();
  const autoTried = new Set();   // video sources for which we already toggled the player's subtitles
  let autoRunning = false;
  const css = document.createElement('style');

  /* ---------------- subtitle sources ---------------- */
  function guessLang(lines) {
    const t = lines.slice(0, 80).map(l => l.text).join(' ');
    const cyr = (t.match(/[А-Яа-яЁё]/g) || []).length;
    const lat = (t.match(/[A-Za-z]/g) || []).length;
    if (cyr > lat * 0.6) return /[іїєґ]/i.test(t) ? 'uk' : 'ru';
    if (lat > 20) return 'en';
    return '?';
  }
  const LANG_NAME = { en: 'English', ru: 'Русские', uk: 'Українські', '?': 'Субтитры' };
  function fileName(url) { try { return decodeURIComponent(new URL(url).pathname.split('/').pop()).slice(0, 40); } catch (e) { return ''; } }

  function parseASS(text) {
    const out = [];
    let fmt = null;
    text.replace(/\r/g, '').split('\n').forEach(line => {
      if (/^Format:/i.test(line) && !fmt) fmt = line.slice(7).split(',').map(s => s.trim().toLowerCase());
      if (!/^Dialogue:/i.test(line)) return;
      const f = fmt || ['layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text'];
      const parts = line.slice(9).split(',');
      const textIdx = f.indexOf('text');
      const vals = parts.slice(0, textIdx).concat([parts.slice(textIdx).join(',')]);
      const tm = (s) => { const p = s.trim().split(':').map(Number); return p[0] * 3600 + p[1] * 60 + p[2]; };
      const txt = vals[textIdx].replace(/\{[^}]*\}/g, '').replace(/\\N/gi, '\n').trim();
      if (txt) out.push({ start: tm(vals[f.indexOf('start')]), end: tm(vals[f.indexOf('end')]), text: txt });
    });
    return SL.normalizeLines(out);
  }

  function parseAny(text) {
    text = String(text || '').replace(/^﻿/, '');
    if (/^\s*\[Script Info\]/i.test(text)) return parseASS(text);
    if (/<tt[\s>]/.test(text.slice(0, 2000))) return SL.parseTTML(text);
    return SL.parseVTT(text);
  }

  function upsert(key, lines, label, kind) {
    if (!lines || lines.length < 2) return null;
    const lang = guessLang(lines);
    let s = sources.find(x => x.key === key);
    if (s) {
      if (lines.length <= s.lines.length) return s;
      s.lines = lines;
      if (s === cur && player) { player.setLines(lines); loadTrans(); }
      return s;
    }
    // same content captured twice (e.g. different URLs)
    if (sources.some(x => x.lines.length === lines.length && x.lines[0].text === lines[0].text)) return null;
    s = { id: 's' + sources.length, key, lines, lang, kind, label: (LANG_NAME[lang] || lang) + (label ? ' · ' + label : '') };
    sources.push(s);
    onSourcesChanged(s);
    return s;
  }

  function addText(url, text, kind) {
    try { upsert(url + '#' + text.length, parseAny(text), fileName(url), kind); } catch (e) { console.warn('SubLingo: parse failed', e); }
  }

  const hlsSeen = new Set();
  async function addHls(entries) {
    for (const en of entries) {
      if (hlsSeen.has(en.uri)) continue;
      hlsSeen.add(en.uri);
      try {
        const pl = await SL.send('fetchPage', { url: en.uri });
        const segs = pl.split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#')).map(s => new URL(s, en.uri).href);
        const texts = new Array(segs.length);
        let i = 0;
        const worker = async () => { while (i < segs.length) { const k = i++; try { texts[k] = await SL.send('fetchPage', { url: segs[k] }); } catch (e) { texts[k] = ''; } } };
        await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
        let lines = [];
        texts.forEach(t => { if (t) lines = lines.concat(SL.parseVTT(t)); });
        lines = SL.normalizeLines(lines);
        upsert('hls:' + en.uri, lines, en.name || en.lang, 'hls');
      } catch (e) { console.warn('SubLingo: HLS subtitles failed', e); }
    }
  }

  const trackSeen = new Set();
  function scanVideo(v) {
    if (!v) return;
    v.querySelectorAll('track[src]').forEach(tr => {
      if (trackSeen.has(tr.src)) return;
      trackSeen.add(tr.src);
      SL.send('fetchPage', { url: tr.src }).then(t => addText(tr.src, t, 'track')).catch(() => {});
    });
    const tts = v.textTracks || [];
    for (let i = 0; i < tts.length; i++) {
      const tt = tts[i];
      if (!/subtitles|captions/.test(tt.kind)) continue;
      if (tt.mode === 'disabled') { try { tt.mode = 'hidden'; } catch (e) {} }
      const cues = tt.cues ? Array.from(tt.cues) : [];
      if (cues.length > 1) upsert('tt:' + (tt.label || tt.language || i), SL.normalizeLines(cues.map(c => ({ start: c.startTime, end: c.endTime, text: SL.cleanText(c.text || '') }))), tt.label || tt.language, 'texttrack');
    }
  }

  br.on(d => {
    if (d.event === 'sl-subs') addText(d.url, d.text, 'player');
    if (d.event === 'sl-hls') addHls(d.entries);
  });
  // subtitles fetched before this script started
  setTimeout(() => br.call('getSubs', {}, 3000).then(r => { (r.found || []).forEach(f => addText(f.url, f.text, 'player')); (r.hls || []).forEach(h => addHls(h.entries)); }).catch(() => {}), 300);

  /* ---------------- video detection ---------------- */
  function findVideo() {
    let best = null, area = 0;
    document.querySelectorAll('video').forEach(v => {
      const r = v.getBoundingClientRect();
      const a = r.width * r.height;
      if (r.width >= 240 && r.height >= 130 && a > area) { best = v; area = a; }
    });
    return best;
  }

  function containerFor(v) {
    if (!v) return null;
    let c = containerCache.get(v);
    if (c && c.isConnected && c.contains(v)) return c;
    const vr = v.getBoundingClientRect();
    let el = v.parentElement, best = el;
    while (el && el !== document.body && el !== document.documentElement) {
      const r = el.getBoundingClientRect();
      if (Math.abs(r.width - vr.width) <= 8 && Math.abs(r.height - vr.height) <= 60) best = el; else break;
      el = el.parentElement;
    }
    if (best && getComputedStyle(best).position === 'static') best.style.position = 'relative';
    containerCache.set(v, best);
    return best;
  }

  document.addEventListener('fullscreenchange', () => { containerCache = new WeakMap(); });

  /* ---------------- mini button ---------------- */
  let mini = null, miniT = 0;
  function showMini(v) {
    if (active || !SL.settings.enabled) return;
    const h = SL.makeHost('sl-mini-host');
    if (!mini) {
      mini = document.createElement('button');
      mini.className = 'sl-bubble sl-root';
      mini.textContent = 'SL · субтитры';
      mini.title = 'SubLingo: включить обучающие субтитры для этого видео';
      mini.style.cssText = 'opacity:.92;font-size:12px;padding:3px 8px';
      ['mousedown', 'pointerdown', 'mouseup'].forEach(ev => mini.addEventListener(ev, e => e.stopPropagation()));
      mini.addEventListener('click', async (e) => {
        e.preventDefault(); e.stopPropagation();
        hideMini();
        const sites = (SL.settings.genericSites || []).slice();
        if (!sites.includes(host)) { sites.push(host); await SL.saveSettings({ genericSites: sites }); }
        activate(true);
      });
      h.shadow.appendChild(mini);
    }
    const r = v.getBoundingClientRect();
    mini.style.left = Math.max(4, r.left + 10) + 'px';
    mini.style.top = Math.max(4, r.top + 10) + 'px';
    mini.style.display = '';
    clearTimeout(miniT);
    miniT = setTimeout(hideMini, 2500);
  }
  function hideMini() { if (mini) mini.style.display = 'none'; }
  document.addEventListener('mousemove', (e) => {
    if (active || !video) return;
    const r = video.getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) showMini(video);
  }, { passive: true });

  /* ---------------- player ---------------- */
  const adapter = {
    name: 'web',
    overlayZ: 2147483000,
    getVideo: () => (video && video.isConnected ? video : null),
    getContainer: () => containerFor(video),
    seek: (t) => { if (video) video.currentTime = Math.max(0, t); },
    play: () => { if (video) video.play().catch(() => {}); },
    pause: () => { if (video) video.pause(); },
    source: () => ({ type: 'web', url: (tabInfo && tabInfo.url) || location.href, title: (tabInfo && tabInfo.title) || document.title }),
    applyNative(S) {
      css.textContent = S.enabled && S.hideNativeSubs && cur ? 'video::cue { opacity: 0 !important; background: transparent !important; color: transparent !important; }' : '';
      if (!css.isConnected) (document.head || document.documentElement).appendChild(css);
    },
    panelWidth: (w) => isFrame ? Math.round(Math.min(w, Math.max(240, window.innerWidth * 0.42))) : w,
    barExtra: () => `<button class="sl-chip" data-gx="loadSubs" title="Загрузить английские субтитры (.srt, .vtt, .ass)">📂 Субтитры</button><button class="sl-chip" data-gx="loadTrans" title="Загрузить субтитры с переводом">📂 Перевод</button>`,
    onExtra: (a) => pickFile(a === 'loadTrans' ? 'trans' : 'subs'),
    onStatusClick: () => pickFile('subs')
  };
  if (isFrame) {
    Object.defineProperty(adapter, 'noPanel', { get: () => !framePanel });
    adapter.togglePanel = () => { framePanel = !framePanel; };
  }

  function pickFile(kind) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.srt,.vtt,.ass,.ssa,.ttml,.dfxp,.xml,.txt';
    inp.style.display = 'none';
    inp.addEventListener('change', async () => {
      const f = inp.files[0];
      inp.remove();
      if (!f) return;
      const lines = parseAny(await f.text());
      if (!lines.length) { SL.toast('Не удалось прочитать файл субтитров'); return; }
      if (kind === 'trans') { userTrans = lines; if (SL.settings.translationMode !== 'auto' && SL.settings.translationMode !== 'human') await SL.saveSettings({ translationMode: 'auto' }); loadTrans(); SL.toast('Перевод загружен'); }
      else {
        const s = upsert('user:' + f.name + ':' + lines.length, lines, f.name, 'user') || sources.find(x => x.key === 'user:' + f.name + ':' + lines.length);
        if (s) useSource(s.id);
      }
    });
    (document.body || document.documentElement).appendChild(inp);
    inp.click();
  }

  function bestOriginal() {
    const sl = SL.settings.sourceLang || 'en';
    const c = sources.filter(s => s.lang === sl);
    if (!c.length) return null;
    return c.find(s => s.kind === 'user') || c.sort((a, b) => b.lines.length - a.lines.length)[0];
  }

  function useSource(id) {
    const s = sources.find(x => x.id === id);
    if (!s || !player) return;
    cur = s;
    player.currentTrack = s.id;
    player.setLines(s.lines);
    player._renderBar();
    adapter.applyNative(SL.settings);
    loadTrans();
  }

  function loadTrans() {
    if (!player || !cur) return;
    const tl = (SL.settings.targetLang || 'ru').split('-')[0];
    SL.loadTranslations(player, {
      human: async () => {
        if (userTrans) return userTrans;
        const h = sources.filter(s => s !== cur && s.lang === tl).sort((a, b) => b.lines.length - a.lines.length)[0];
        return h ? h.lines : null;
      }
    });
  }

  function refreshOptions() {
    if (!player) return;
    player.setTrackOptions(sources.map(s => ({ value: s.id, label: s.label + ' (' + s.lines.length + ')' })), []);
  }

  function onSourcesChanged(s) {
    if (!player) { maybeAuto(); return; }
    refreshOptions();
    const best = bestOriginal();
    if (!cur && best) useSource(best.id);
    else if (cur && cur.lang !== (SL.settings.sourceLang || 'en') && best) useSource(best.id);
    else if (s && cur && s !== cur && s.lang === (SL.settings.targetLang || 'ru').split('-')[0]) loadTrans();
    if (!cur) noSubsStatus();
  }

  /* Включить субтитры в плеере, забрать файлы и выключить обратно */
  async function autoGrab(force) {
    if (!video || autoRunning) return;
    const key = (video.currentSrc || video.src || 'v') + '|' + (force ? Date.now() : '');
    if (autoTried.has(key)) return;
    if (!force && sources.some(s => s.lang === (SL.settings.sourceLang || 'en'))) return;
    autoTried.add(key);
    autoRunning = true;
    if (player && !cur) player.setStatus('SubLingo: ищу субтитры в плеере…');
    try {
      const r = await br.call('autoSubs', { tl: SL.settings.targetLang }, 40000);
      for (const u of (r.urls || [])) {
        try { addText(u.url, await SL.send('fetchPage', { url: u.url }), 'player'); } catch (e) {}
      }
      autoGrab.last = r;
    } catch (e) {}
    autoRunning = false;
    if (player && !cur) noSubsStatus();
  }

  function noSubsStatus() {
    if (!player || cur) return;
    if (autoRunning) return;
    const others = sources.length ? ' Есть только: ' + sources.map(s => s.label).join(', ') + '.' : '';
    const r = autoGrab.last;
    const inPlayer = r && r.names && r.names.length ? ' В плеере есть: ' + r.names.join(', ') + '.' : '';
    player.setStatus('SubLingo: английских субтитров нет.' + others + inPlayer + ' Выберите озвучку «English / Оригинал» — я проверю ещё раз. Или нажмите здесь, чтобы загрузить свой .srt');
  }

  async function activate() {
    if (active || activating) return;
    activating = true;
    try {
      await ready;
      if (!SL.SubPlayer) await SL.send('injectCore');
      if (!SL.SubPlayer) throw new Error('core not loaded');
      await SL.loadVocab();
      SL._vocabLoaded = true;
      tabInfo = await SL.send('tabInfo').catch(() => null);
      player = new SL.SubPlayer(adapter);
      player.mount();
      player.onTrackChange = (id) => useSource(id);
      player.onTransChange = () => loadTrans();
      player.setMeta({ title: (tabInfo && tabInfo.title) || document.title });
      active = true;
      hideMini();
      refreshOptions();
      const best = bestOriginal();
      if (best) useSource(best.id); else { noSubsStatus(); autoGrab(); }
      SL.onSettings(SL.debounce((s) => { if (player && cur && (s.targetLang !== loadTrans._tl || s.translationMode !== loadTrans._mode)) { loadTrans._tl = s.targetLang; loadTrans._mode = s.translationMode; loadTrans(); } }, 300));
      loadTrans._tl = SL.settings.targetLang; loadTrans._mode = SL.settings.translationMode;
    } catch (e) { console.warn('SubLingo: activation failed', e); }
    activating = false;
  }

  function maybeAuto() {
    const S = SL.settings;
    if (active || !S.enabled || !video) return;
    if ((S.genericSites || []).includes(host)) return activate();
    if (S.genericAuto && sources.some(s => s.lang === (S.sourceLang || 'en'))) activate();
  }

  let tick = 0;
  setInterval(async () => {
    await ready;
    const v = findVideo();
    if (v && v !== video) { video = v; scanVideo(v); if (player) { player.shown = -2; player._placeHosts(); } }
    if (!video) return;
    tick++;
    if (tick % 3 === 0) scanVideo(video);
    maybeAuto();
    if (video.readyState >= 1 && (active || SL.settings.genericAuto) && !sources.some(s => s.lang === (SL.settings.sourceLang || 'en'))) {
      const k = video.currentSrc || video.src || 'v';
      if (!autoTried.has(k + '|')) { if (!autoGrab._seen || autoGrab._seen !== k) { autoGrab._seen = k; autoGrab._at = Date.now(); } else if (Date.now() - autoGrab._at > 2500) autoGrab(); }
    }
  }, 1500);

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'sl:genericActivate') { if (findVideo()) { video = findVideo(); activate(); sendResponse({ ok: true }); } }
  });
})();

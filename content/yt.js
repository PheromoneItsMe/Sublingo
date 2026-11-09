/* SubLingo — YouTube adapter (isolated world) */
(async function () {
  'use strict';
  if (window.__slYTAdapter) return;
  window.__slYTAdapter = true;
  await SL.loadSettings();
  await SL.loadVocab();
  SL._vocabLoaded = true;

  const br = SL.bridge();
  const isEmbed = /\/embed\//.test(location.pathname);
  let cur = { videoId: null, title: '', tracks: [], track: null };
  let player = null;

  const css = document.createElement('style');
  css.id = 'sl-yt-native';
  (document.head || document.documentElement).appendChild(css);

  const adapter = {
    name: 'youtube',
    noPanel: isEmbed,
    getVideo: () => document.querySelector('#movie_player video.html5-main-video') || document.querySelector('.html5-video-player video') || null,
    getContainer: () => document.querySelector('#movie_player') || document.querySelector('.html5-video-player'),
    seek: (t) => { const v = adapter.getVideo(); if (v) v.currentTime = t; },
    play: () => { const v = adapter.getVideo(); if (v) v.play().catch(() => {}); },
    pause: () => { const v = adapter.getVideo(); if (v) v.pause(); },
    controlsVisible: () => { const p = adapter.getContainer(); return !!p && !p.classList.contains('ytp-autohide'); },
    controlsHeight: (h) => Math.max(58, Math.round(h * 0.085)),
    isAd: () => { const p = adapter.getContainer(); return !!(p && (p.classList.contains('ad-showing') || p.classList.contains('ad-interrupting'))); },
    source: () => ({ type: 'youtube', videoId: cur.videoId, title: cur.title, url: 'https://www.youtube.com/watch?v=' + cur.videoId }),
    applyNative(S) {
      let rules = '';
      if (S.enabled && S.hideNativeSubs && cur.videoId) rules += '.ytp-caption-window-container, .caption-window { display: none !important; }';
      if (adapter._w) rules += `ytd-app { margin-right: ${adapter._w}px !important; } #masthead-container.ytd-app, ytd-masthead { width: calc(100% - ${adapter._w}px) !important; } tp-yt-app-drawer#guide { }`;
      css.textContent = rules;
    },
    layout(w) {
      w = (isEmbed || !/\/watch/.test(location.pathname)) ? 0 : w;
      if (adapter._w === w) return;
      adapter._w = w;
      adapter.applyNative(SL.settings);
      window.dispatchEvent(new Event('resize'));
    }
  };

  function videoIdFromUrl() {
    const m = location.href.match(/[?&]v=([\w-]{11})/) || location.pathname.match(/\/(?:embed|live)\/([\w-]{11})/);
    return m ? m[1] : null;
  }

  function trackLabel(t) { return t.virtual ? t.name : (t.name || t.lang) + (t.kind === 'asr' ? ' (автосубтитры)' : ''); }

  // Если у видео нет субтитров на изучаемом языке — добавляем английский автоперевод YouTube.
  function withVirtual(tracks) {
    const sl = SL.settings.sourceLang || 'en';
    const has = tracks.some(t => t.lang === sl || t.lang.startsWith(sl + '-'));
    if (has) return tracks;
    const base = tracks.find(t => t.translatable && t.kind !== 'asr') || tracks.find(t => t.translatable);
    if (!base) return tracks;
    return [{ virtual: true, baseUrl: base.baseUrl, lang: sl, from: base.lang, base, kind: base.kind, tlang: sl, vssId: 'tr:' + (base.vssId || base.lang),
      name: 'English · автоперевод YouTube (из «' + (base.name || base.lang) + '»)' }].concat(tracks);
  }
  function trackKey(t) { return t.vssId || (t.lang + ':' + t.kind); }

  function pickOriginal(tracks) {
    const S = SL.settings;
    const sl = S.sourceLang || 'en';
    const same = tracks.filter(t => t.lang === sl || t.lang.startsWith(sl + '-'));
    return same.find(t => t.kind !== 'asr' && !t.virtual) || same.find(t => !t.virtual) || same[0] || tracks.find(t => t.kind !== 'asr') || tracks[0] || null;
  }

  async function info(vid) {
    for (let i = 0; i < 40; i++) {
      try {
        const r = await br.call('info', {}, 3000);
        if (r && r.prVideoId === vid) return r;
      } catch (e) {}
      await new Promise(r => setTimeout(r, 400));
    }
    return null;
  }

  async function loadOriginal(track, token) {
    player.setStatus('Загружаю субтитры: ' + trackLabel(track) + '…');
    const json = await br.call('fetchTrack', { baseUrl: track.baseUrl, videoId: cur.videoId, lang: track.from || track.lang, tlang: track.tlang || '' }, 45000);
    if (token !== cur.token) return;
    const lines = SL.parseJSON3(json, track.kind === 'asr');
    if (!lines.length) throw new Error('пустые субтитры');
    player.currentTrack = trackKey(track);
    player.setLines(lines);
    player._renderBar();
    await loadTrans(token);
  }

  function humanTrack() {
    const tl = SL.settings.targetLang;
    const same = (t) => !t.virtual && t !== cur.track && (t.lang === tl || t.lang.split('-')[0] === tl.split('-')[0]);
    const manual = cur.tracks.find(t => t.kind !== 'asr' && same(t));
    if (manual) return manual;
    // для автоперевода оригинал (например, русские субтитры видео) и есть лучший «перевод»
    if (cur.track && cur.track.virtual && cur.track.base && same(cur.track.base)) return cur.track.base;
    return null;
  }

  async function loadTrans(token) {
    const S = SL.settings;
    await SL.loadTranslations(player, {
      human: async () => {
        const h = humanTrack();
        if (!h) return null;
        const json = await br.call('fetchTrack', { baseUrl: h.baseUrl, videoId: cur.videoId, lang: h.lang }, 45000);
        return SL.parseJSON3(json, h.kind === 'asr');
      },
      youtube: async () => {
        if (!cur.track) return null;
        const t = cur.track.virtual ? cur.track.base : cur.track;
        const json = await br.call('fetchTrack', { baseUrl: t.baseUrl, videoId: cur.videoId, tlang: t.lang.split('-')[0] === S.targetLang.split('-')[0] ? '' : S.targetLang, lang: t.lang }, 45000);
        return SL.parseJSON3(json, t.kind === 'asr');
      }
    });
  }

  async function onNavigate() {
    const vid = videoIdFromUrl();
    if (!vid) {
      if (player) { player.setLines([]); player.setStatus(''); }
      cur.videoId = null;
      adapter.layout(0);
      adapter.applyNative(SL.settings);
      return;
    }
    if (vid === cur.videoId) return;
    const token = Math.random();
    cur = { videoId: vid, title: '', tracks: [], track: null, token };
    if (!SL.settings.enabled) return;
    if (!player) {
      // wait for the player element
      for (let i = 0; i < 50 && !adapter.getContainer(); i++) await new Promise(r => setTimeout(r, 200));
      if (!adapter.getContainer()) return;
      player = new SL.SubPlayer(adapter);
      player.mount();
      player.onTrackChange = async (key) => {
        const t = cur.tracks.find(x => trackKey(x) === key);
        if (!t) return;
        cur.track = t;
        try { await loadOriginal(t, cur.token); } catch (e) { player.setStatus('Не удалось загрузить субтитры: ' + e.message); }
      };
      player.onTransChange = () => loadTrans(cur.token);
    }
    player.setLines([]);
    player.setStatus('Загрузка субтитров…');
    adapter.applyNative(SL.settings);
    player.applyLayout();
    const inf = await info(vid);
    if (token !== cur.token) return;
    if (!inf) { player.setStatus('Не удалось получить данные видео. Перезагрузите страницу.'); return; }
    cur.title = inf.title;
    cur.tracks = withVirtual(inf.tracks);
    player.setMeta({ title: inf.title });
    if (!inf.tracks.length) { player.setTrackOptions([], []); player.setStatus('У этого видео нет субтитров'); adapter.applyNative(SL.settings); return; }
    player.setTrackOptions(cur.tracks.map(t => ({ value: trackKey(t), label: trackLabel(t) })), []);
    cur.track = pickOriginal(cur.tracks);
    try { await loadOriginal(cur.track, token); }
    catch (e) { if (token === cur.token) player.setStatus('Не удалось загрузить субтитры: ' + e.message + '. Перезагрузите страницу (F5).'); }
  }

  document.addEventListener('yt-navigate-finish', () => setTimeout(onNavigate, 50));
  let lastUrl = location.href;
  setInterval(() => { if (location.href !== lastUrl) { lastUrl = location.href; onNavigate(); } }, 800);
  SL.onSettings(SL.debounce((s) => {
    if (s.enabled && !cur.videoId) onNavigate();
    if (player && s.enabled && player.lines.length && (s.targetLang !== loadTrans._tl || s.translationMode !== loadTrans._mode)) { loadTrans._tl = s.targetLang; loadTrans._mode = s.translationMode; loadTrans(cur.token); }
    if (s.sourceLang !== onNavigate._sl) { onNavigate._sl = s.sourceLang; }
  }, 300));
  loadTrans._tl = SL.settings.targetLang; loadTrans._mode = SL.settings.translationMode;
  onNavigate();
})();

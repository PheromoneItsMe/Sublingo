/* SubLingo — Netflix adapter (isolated world) */
(async function () {
  'use strict';
  if (window.__slNFAdapter) return;
  window.__slNFAdapter = true;
  await SL.loadSettings();
  await SL.loadVocab();
  SL._vocabLoaded = true;

  const br = SL.bridge();
  let cur = { movieId: null, tracks: [], track: null, title: '' };
  let player = null;
  const css = document.createElement('style');
  (document.head || document.documentElement).appendChild(css);

  const adapter = {
    name: 'netflix',
    getVideo: () => document.querySelector('.watch-video video') || document.querySelector('video'),
    getContainer: () => {
      const v = adapter.getVideo();
      return (v && (v.closest('.watch-video--player-view') || v.closest('[data-uia="player"]'))) || document.querySelector('.watch-video--player-view') || document.querySelector('.watch-video') || (v && v.parentElement);
    },
    seek: (t) => { br.call('seek', { t }).catch(() => {}); },
    play: () => { br.call('play').catch(() => { const v = adapter.getVideo(); v && v.play(); }); },
    pause: () => { br.call('pause').catch(() => { const v = adapter.getVideo(); v && v.pause(); }); },
    setRate: (r) => { const v = adapter.getVideo(); if (v) v.playbackRate = r; },
    controlsHeight: (h) => Math.round(h * 0.16),
    isAd: () => !!document.querySelector('[data-uia="ads-info-container"], [data-uia="ad-break"]'),
    source: () => ({ type: 'netflix', movieId: cur.movieId, title: cur.title, url: 'https://www.netflix.com/watch/' + cur.movieId }),
    applyNative(S) {
      let r = '';
      if (S.enabled && S.hideNativeSubs && cur.movieId) r += '.player-timedtext { display: none !important; }';
      if (adapter._w) r += `.watch-video--player-view { width: calc(100% - ${adapter._w}px) !important; }`;
      css.textContent = r;
    },
    layout(w) { if (adapter._w === w) return; adapter._w = w; adapter.applyNative(SL.settings); window.dispatchEvent(new Event('resize')); }
  };

  function movieIdFromUrl() { const m = location.pathname.match(/\/watch\/(\d+)/); return m ? m[1] : null; }
  function title() {
    const t = document.querySelector('[data-uia="video-title"]');
    return (t && t.innerText.replace(/\n+/g, ' · ')) || document.title.replace(/ ?[-|] ?Netflix$/, '');
  }
  const trackKey = (t) => String(t.id);
  const trackLabel = (t) => (t.name || t.lang) + (t.type === 'closedcaptions' ? ' [CC]' : '') + (t.forced ? ' (forced)' : '');

  function pick(tracks, lang) {
    const same = tracks.filter(t => !t.forced && t.sources.length && (t.lang === lang || t.lang.split('-')[0] === lang.split('-')[0]));
    return same.find(t => t.type !== 'closedcaptions') || same[0] || null;
  }

  async function fetchTrack(t) {
    const src = t.sources[0];
    const text = await br.call('fetchText', { urls: src.urls }, 30000);
    let lines = /webvtt/.test(src.profile) || /^WEBVTT/.test(text) ? SL.parseVTT(text) : SL.parseTTML(text);
    lines = lines.map(l => Object.assign(l, { text: l.text.replace(/^\s*-\s*/gm, '– ') }));
    return lines;
  }

  async function loadOriginal(t, token) {
    player.setStatus('Загружаю субтитры: ' + trackLabel(t) + '…');
    const lines = await fetchTrack(t);
    if (token !== cur.token) return;
    player.currentTrack = trackKey(t);
    player.setLines(lines);
    player._renderBar();
    await loadTrans(token);
  }

  async function loadTrans() {
    await SL.loadTranslations(player, {
      human: async () => {
        const h = pick(cur.tracks, SL.settings.targetLang);
        return h && h !== cur.track ? fetchTrack(h) : null;
      }
    });
  }

  async function onNavigate() {
    const id = movieIdFromUrl();
    if (!id) { cur.movieId = null; if (player) { player.setLines([]); adapter.layout(0); } adapter.applyNative(SL.settings); return; }
    if (id === cur.movieId) return;
    const token = Math.random();
    cur = { movieId: id, tracks: [], track: null, title: '', token };
    if (!SL.settings.enabled) return;
    for (let i = 0; i < 100 && !adapter.getVideo(); i++) await new Promise(r => setTimeout(r, 200));
    if (token !== cur.token || !adapter.getVideo()) return;
    if (!player) {
      player = new SL.SubPlayer(adapter);
      player.mount();
      player.onTrackChange = async (key) => {
        const t = cur.tracks.find(x => trackKey(x) === key);
        if (!t) return;
        cur.track = t;
        try { await loadOriginal(t, cur.token); } catch (e) { player.setStatus('Ошибка: ' + e.message); }
      };
      player.onTransChange = () => loadTrans();
    }
    player.setLines([]);
    player.setStatus('Жду данные Netflix…');
    adapter.applyNative(SL.settings);
    player.applyLayout();
    const r = await br.call('getTracks', { movieId: id, wait: 20000 }, 25000).catch(() => null);
    if (token !== cur.token) return;
    cur.title = title();
    player.setMeta({ title: cur.title });
    const tracks = (r && r.tracks || []).filter(t => t.sources.length);
    cur.tracks = tracks;
    if (!tracks.length) { player.setStatus('Субтитры не найдены. Перезагрузите страницу (F5) — расширение должно загрузиться раньше плеера.'); return; }
    player.setTrackOptions(tracks.map(t => ({ value: trackKey(t), label: trackLabel(t) })), []);
    cur.track = pick(tracks, SL.settings.sourceLang) || (r.current && tracks.find(t => t.lang === r.current.lang)) || tracks[0];
    if (r.audio && r.audio.lang && !r.audio.lang.startsWith(SL.settings.sourceLang)) SL.toast('Внимание: дорожка аудио — ' + (r.audio.name || r.audio.lang) + '. Для учёбы включите оригинальный звук.', 4000);
    try { await loadOriginal(cur.track, token); } catch (e) { if (token === cur.token) player.setStatus('Не удалось загрузить субтитры: ' + e.message); }
  }

  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) { lastUrl = location.href; onNavigate(); }
    if (player && cur.movieId && !cur.title) { cur.title = title(); player.setMeta({ title: cur.title }); }
  }, 1000);
  SL.onSettings(SL.debounce((s) => {
    if (s.enabled && !cur.movieId) onNavigate();
    if (player && player.lines.length && (s.targetLang !== loadTrans._tl || s.translationMode !== loadTrans._mode)) { loadTrans._tl = s.targetLang; loadTrans._mode = s.translationMode; loadTrans(); }
  }, 300));
  loadTrans._tl = SL.settings.targetLang; loadTrans._mode = SL.settings.translationMode;
  onNavigate();
})();

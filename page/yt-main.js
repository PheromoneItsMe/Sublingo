/* SubLingo — YouTube page-world bridge (runs in the page's MAIN world). */
(function () {
  'use strict';
  if (window.__subLingoYT) return;
  window.__subLingoYT = true;

  const POT = {};      // videoId -> { pot, c, cver }
  const waiters = [];

  function post(msg) { window.postMessage(Object.assign({ __sl: 'to-content' }, msg), '*'); }

  function seeUrl(u) {
    try {
      if (!u) return;
      u = String(u);
      if (u.indexOf('/timedtext') < 0) return;
      const url = new URL(u, location.href);
      const v = url.searchParams.get('v');
      const pot = url.searchParams.get('pot');
      if (v && pot) {
        POT[v] = { pot, c: url.searchParams.get('c') || 'WEB', cver: url.searchParams.get('cver') || '', potc: url.searchParams.get('potc') || '' };
        waiters.splice(0).forEach(w => w());
      }
    } catch (e) {}
  }

  const xo = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) { seeUrl(u); return xo.apply(this, arguments); };
  const fo = window.fetch;
  window.fetch = function (input) {
    try { seeUrl(typeof input === 'string' ? input : (input && input.url)); } catch (e) {}
    return fo.apply(this, arguments);
  };

  function player() {
    return document.getElementById('movie_player') || document.querySelector('.html5-video-player');
  }

  function playerResponse() {
    const p = player();
    let pr = null;
    try { pr = p && p.getPlayerResponse && p.getPlayerResponse(); } catch (e) {}
    const vid = currentVideoId();
    if ((!pr || (pr.videoDetails && vid && pr.videoDetails.videoId !== vid)) && window.ytInitialPlayerResponse) {
      const ip = window.ytInitialPlayerResponse;
      if (!vid || (ip.videoDetails && ip.videoDetails.videoId === vid)) pr = ip;
    }
    return pr;
  }

  function currentVideoId() {
    try {
      const p = player();
      const d = p && p.getVideoData && p.getVideoData();
      if (d && d.video_id) return d.video_id;
    } catch (e) {}
    const m = location.href.match(/[?&]v=([\w-]{11})/) || location.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{11})/);
    return m ? m[1] : null;
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function waitPot(v, ms) {
    const end = Date.now() + ms;
    while (!POT[v] && Date.now() < end) {
      await Promise.race([new Promise(r => waiters.push(r)), sleep(300)]);
    }
    return POT[v] || null;
  }

  // Новый плеер YouTube получает обычные субтитры внутри видеопотока (без запроса timedtext),
  // а с автопереводом — отдельным запросом, к которому прикреплён токен "pot".
  // Поэтому на мгновение включаем субтитры с автопереводом, ловим токен и возвращаем всё как было.
  let ensuring = null;
  function ensurePot(v, lang) {
    if (POT[v]) return Promise.resolve(POT[v]);
    if (ensuring) return ensuring;
    ensuring = (async () => {
      const p = player();
      if (!p || !p.setOption) return null;
      let prev = null;
      try { prev = p.getOption && p.getOption('captions', 'track'); } catch (e) {}
      const prevOn = !!(prev && prev.languageCode);
      try { p.loadModule && p.loadModule('captions'); } catch (e) {}
      let got = await waitPot(v, 800);
      const src = lang || (prevOn && prev.languageCode) || 'en';
      const tl = src.split('-')[0] === 'en' ? 'ru' : 'en';
      const attempts = [
        () => p.setOption('captions', 'track', { languageCode: src, translationLanguage: { languageCode: tl, languageName: tl } }),
        () => p.setOption('captions', 'track', { languageCode: src }),
        () => { p.toggleSubtitles && p.toggleSubtitles(); }
      ];
      for (const a of attempts) {
        if (got) break;
        try { a(); } catch (e) {}
        got = await waitPot(v, 4000);
      }
      // вернуть субтитры плеера в исходное состояние
      try {
        if (prevOn) p.setOption('captions', 'track', prev);
        else p.setOption('captions', 'track', {});
      } catch (e) {}
      return got;
    })();
    const pr = ensuring;
    pr.finally(() => { if (ensuring === pr) ensuring = null; });
    return pr;
  }

  async function fetchTrack({ baseUrl, videoId, tlang, lang }) {
    const v = videoId || currentVideoId();
    const pot = await ensurePot(v, lang);
    const u = new URL(baseUrl, location.origin);
    u.searchParams.set('fmt', 'json3');
    if (pot) { u.searchParams.set('pot', pot.pot); u.searchParams.set('c', pot.c || 'WEB'); if (pot.cver) u.searchParams.set('cver', pot.cver); if (pot.potc) u.searchParams.set('potc', pot.potc); }
    if (tlang) u.searchParams.set('tlang', tlang); else u.searchParams.delete('tlang');
    let lastErr = null;
    let renewed = false;
    for (let i = 0; i < 3; i++) {
      try {
        const r = await fo.call(window, u.toString(), { credentials: 'include' });
        const txt = await r.text();
        if (txt && txt.trim().startsWith('{')) return JSON.parse(txt);
        lastErr = new Error('YouTube вернул пустые субтитры (' + r.status + ')');
        // токен мог устареть — получаем новый один раз
        if (!renewed) {
          renewed = true;
          delete POT[v];
          const np = await ensurePot(v, lang);
          if (np) { u.searchParams.set('pot', np.pot); u.searchParams.set('c', np.c || 'WEB'); if (np.cver) u.searchParams.set('cver', np.cver); if (np.potc) u.searchParams.set('potc', np.potc); }
        }
      } catch (e) { lastErr = e; }
      await sleep(600 * (i + 1));
    }
    throw lastErr || new Error('timedtext failed');
  }

  function getInfo() {
    const pr = playerResponse();
    const vid = currentVideoId();
    const cap = pr && pr.captions && pr.captions.playerCaptionsTracklistRenderer;
    const tracks = ((cap && cap.captionTracks) || []).map(t => ({
      baseUrl: t.baseUrl,
      lang: t.languageCode,
      name: (t.name && (t.name.simpleText || (t.name.runs || []).map(r => r.text).join(''))) || t.languageCode,
      kind: t.kind || '',
      vssId: t.vssId || '',
      translatable: !!t.isTranslatable
    }));
    const tl = ((cap && cap.translationLanguages) || []).map(l => ({ lang: l.languageCode, name: (l.languageName && (l.languageName.simpleText || (l.languageName.runs || []).map(r => r.text).join(''))) || l.languageCode }));
    const vd = (pr && pr.videoDetails) || {};
    return { videoId: vid, prVideoId: vd.videoId || null, title: vd.title || document.title.replace(/ - YouTube$/, ''), author: vd.author || '', length: Number(vd.lengthSeconds) || 0, tracks, translationLanguages: tl };
  }

  const cmds = {
    info: getInfo,
    fetchTrack,
    seek: ({ t }) => { const p = player(); if (p && p.seekTo) p.seekTo(t, true); else { const v = document.querySelector('video'); if (v) v.currentTime = t; } return true; },
    play: () => { const p = player(); p && p.playVideo ? p.playVideo() : document.querySelector('video').play(); return true; },
    pause: () => { const p = player(); p && p.pauseVideo ? p.pauseVideo() : document.querySelector('video').pause(); return true; },
    hideCaptionsOff: () => true
  };

  window.addEventListener('message', async (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || d.__sl !== 'to-main' || !cmds[d.cmd]) return;
    try { post({ id: d.id, result: await cmds[d.cmd](d.args || {}) }); }
    catch (e) { post({ id: d.id, error: (e && e.message) || String(e) }); }
  });
})();

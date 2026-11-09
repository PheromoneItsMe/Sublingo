/* SubLingo — Netflix page-world bridge (MAIN world, document_start). */
(function () {
  'use strict';
  if (window.__subLingoNF) return;
  window.__subLingoNF = true;

  const PROFILE = 'webvtt-lssdh-ios8';
  const manifests = {}; // movieId -> tracks
  const waiters = [];

  function post(msg) { window.postMessage(Object.assign({ __sl: 'to-content' }, msg), '*'); }

  const origParse = JSON.parse;
  const origStringify = JSON.stringify;

  function extractTracks(result) {
    const list = result.timedtexttracks || result.textTracks || [];
    const out = [];
    for (const t of list) {
      if (!t || t.isNoneTrack) continue;
      const dl = t.ttDownloadables || {};
      const urls = [];
      for (const prof of [PROFILE, 'webvtt-lssdh-ios8', 'dfxp-ls-sdh', 'imsc1.1', 'simplesdh']) {
        const d = dl[prof];
        if (!d) continue;
        let u = [];
        if (d.downloadUrls) u = Object.values(d.downloadUrls);
        else if (Array.isArray(d.urls)) u = d.urls.map(x => x.url || x).filter(Boolean);
        if (u.length) urls.push({ profile: prof, urls: u });
      }
      out.push({
        id: t.new_track_id || t.id || t.trackId,
        lang: t.language || t.bcp47 || '',
        name: t.languageDescription || t.language || '',
        type: t.rawTrackType || t.trackType || '',
        forced: !!t.isForcedNarrative,
        sources: urls
      });
    }
    return out;
  }

  JSON.parse = function () {
    const v = origParse.apply(this, arguments);
    try {
      const r = v && v.result;
      if (r && (r.timedtexttracks || r.textTracks)) {
        const id = String(r.movieId || r.viewableId || '');
        if (id) {
          manifests[id] = { tracks: extractTracks(r), at: Date.now() };
          waiters.splice(0).forEach(w => w());
          post({ event: 'nf-manifest', movieId: id });
        }
      }
    } catch (e) {}
    return v;
  };

  JSON.stringify = function (value) {
    try {
      if (value && value.params && Array.isArray(value.params.profiles) && value.params.profiles.indexOf(PROFILE) < 0) {
        value.params.profiles.push(PROFILE);
      }
    } catch (e) {}
    return origStringify.apply(this, arguments);
  };

  function videoPlayer() {
    try {
      const api = window.netflix.appContext.state.playerApp.getAPI().videoPlayer;
      const ids = api.getAllPlayerSessionIds();
      const id = ids.find(s => s.startsWith('watch')) || ids[0];
      return id ? api.getVideoPlayerBySessionId(id) : null;
    } catch (e) { return null; }
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function getTracks({ movieId, wait }) {
    const end = Date.now() + (wait || 0);
    while (!manifests[movieId] && Date.now() < end) await Promise.race([new Promise(r => waiters.push(r)), sleep(500)]);
    let m = manifests[movieId];
    if (!m) { const all = Object.values(manifests).sort((a, b) => b.at - a.at); m = all[0]; }
    let cur = null;
    try { const p = videoPlayer(); const t = p && p.getTextTrack && p.getTextTrack(); if (t) cur = { lang: t.bcp47, id: t.trackId }; } catch (e) {}
    let audio = null;
    try { const p = videoPlayer(); const a = p && p.getAudioTrack && p.getAudioTrack(); if (a) audio = { lang: a.bcp47, name: a.displayName }; } catch (e) {}
    return { tracks: m ? m.tracks : [], current: cur, audio, ids: Object.keys(manifests) };
  }

  async function fetchText({ urls }) {
    let err;
    for (const u of urls || []) {
      try {
        const r = await fetch(u);
        if (r.ok) return await r.text();
        err = new Error('HTTP ' + r.status);
      } catch (e) { err = e; }
    }
    throw err || new Error('no url');
  }

  const cmds = {
    getTracks,
    fetchText,
    seek: ({ t }) => { const p = videoPlayer(); if (p) p.seek(Math.round(t * 1000)); return !!p; },
    play: () => { const p = videoPlayer(); if (p) p.play(); else { const v = document.querySelector('video'); v && v.play(); } return true; },
    pause: () => { const p = videoPlayer(); if (p) p.pause(); else { const v = document.querySelector('video'); v && v.pause(); } return true; },
    setRate: ({ rate }) => { const v = document.querySelector('video'); if (v) v.playbackRate = rate; return true; }
  };

  window.addEventListener('message', async (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || d.__sl !== 'to-main' || !cmds[d.cmd]) return;
    try { post({ id: d.id, result: await cmds[d.cmd](d.args || {}) }); }
    catch (e) { post({ id: d.id, error: (e && e.message) || String(e) }); }
  });
})();

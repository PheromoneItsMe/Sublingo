/* SubLingo — catches subtitle files that any web player downloads (MAIN world, all frames). */
(function () {
  'use strict';
  if (window.__subLingoSniff) return;
  window.__subLingoSniff = true;

  const found = [];        // {url, text}
  let subsEvents = 0;
  const captured = [];     // Playerjs instances created after we started
  try {
    let real;
    Object.defineProperty(window, 'Playerjs', {
      configurable: true,
      get() { return real; },
      set(v) {
        if (typeof v !== 'function') { real = v; return; }
        const wrapped = function () { const inst = new (Function.prototype.bind.apply(v, [null].concat([].slice.call(arguments))))(); try { captured.push(inst); } catch (e) {} return inst; };
        wrapped.prototype = v.prototype;
        real = wrapped;
      }
    });
  } catch (e) {}
  const hls = [];          // {url, entries:[{lang,name,uri}]}
  const URL_RE = /\.(vtt|srt|ass|ssa|ttml|dfxp)(\?|#|$)|subtit|caption|\/subs?\/|texttrack|\.m3u8/i;

  function post(msg) { try { window.postMessage(Object.assign({ __sl: 'to-content' }, msg), '*'); } catch (e) {} }

  function looksLikeSubs(t) {
    if (!t || t.length < 20 || t.length > 3000000) return false;
    const head = t.slice(0, 400).replace(/^﻿/, '').trimStart();
    if (head.startsWith('WEBVTT')) return true;
    if (/^\d+\s*\r?\n\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->/.test(head)) return true;
    if (/^\[Script Info\]/i.test(head)) return true;
    if (/<tt[\s>]/.test(head) && /<p[\s>]/.test(t.slice(0, 5000))) return true;
    return false;
  }

  function onText(url, text) {
    try {
      if (!text) return;
      if (/^#EXTM3U/.test(text)) {
        const entries = [];
        text.split('\n').forEach(line => {
          if (!/^#EXT-X-MEDIA:.*TYPE=SUBTITLES/i.test(line)) return;
          const attr = (k) => { const m = line.match(new RegExp(k + '="([^"]*)"')); return m ? m[1] : ''; };
          const uri = attr('URI');
          if (uri) entries.push({ lang: attr('LANGUAGE'), name: attr('NAME'), uri: new URL(uri, url).href });
        });
        if (entries.length && !hls.some(h => h.url === url)) { hls.push({ url, entries }); post({ event: 'sl-hls', url, entries }); }
        return;
      }
      if (!looksLikeSubs(text)) return;
      if (found.some(f => f.url === url && f.text.length === text.length)) return;
      // skip HLS subtitle segments here (they are tiny pieces of one track)
      const segment = /X-TIMESTAMP-MAP/.test(text.slice(0, 300)) && text.length < 20000;
      if (segment) return;
      found.push({ url, text });
      subsEvents++;
      if (found.length > 30) found.shift();
      post({ event: 'sl-subs', url, text });
    } catch (e) {}
  }

  const xo = XMLHttpRequest.prototype.open;
  const xs = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { try { this.__slUrl = String(u); } catch (e) {} return xo.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    const url = this.__slUrl || '';
    if (URL_RE.test(url)) {
      this.addEventListener('load', () => {
        try {
          if (this.responseType === '' || this.responseType === 'text') onText(new URL(url, location.href).href, this.responseText);
          else if (this.responseType === 'arraybuffer' && this.response && this.response.byteLength < 3000000) onText(new URL(url, location.href).href, new TextDecoder().decode(this.response));
        } catch (e) {}
      });
    }
    return xs.apply(this, arguments);
  };
  const fo = window.fetch;
  window.fetch = function (input) {
    const p = fo.apply(this, arguments);
    try {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (URL_RE.test(url)) p.then(r => r.clone().text().then(t => onText(new URL(url, location.href).href, t)).catch(() => {})).catch(() => {});
    } catch (e) {}
    return p;
  };

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  async function waitFor(fn, ms) { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return true; await sleep(150); } return false; }

  function subNames(list) {
    if (!list) return [];
    if (Array.isArray(list)) return list.map(x => typeof x === 'string' ? x.replace(/^\[([^\]]*)\].*$/, '$1') : (x && (x.title || x.name || x.label || x.lang)) || '');
    if (typeof list === 'string') return list.split(/,(?=\s*\[)|,(?=https?:)/).map(x => { const m = x.match(/^\s*\[([^\]]*)\]/); return m ? m[1] : x.trim(); }).filter(Boolean);
    if (typeof list === 'object') return Object.keys(list);
    return [];
  }

  const RE_EN = /eng|english|англ|\ben\b|original|оригин/i;
  async function autoSubs(args) {
    const tl = String((args && args.tl) || 'ru').split('-')[0];
    const RE_TL = tl === 'ru' ? /rus|русск|\bru\b/i : new RegExp('\\b' + tl + '\\b', 'i');
    const res = { urls: [], tried: [], players: 0, names: [] };
    // JW Player
    try {
      if (typeof window.jwplayer === 'function') {
        const p = window.jwplayer();
        const item = p && p.getPlaylistItem && p.getPlaylistItem();
        ((item && item.tracks) || []).forEach(t => { if (/captions|subtitles/i.test(t.kind || '') && t.file) res.urls.push({ url: new URL(t.file, location.href).href, label: t.label || '' }); });
      }
    } catch (e) {}
    // Video.js
    try {
      if (window.videojs && window.videojs.getPlayers) {
        Object.values(window.videojs.getPlayers()).forEach(p => {
          if (!p || !p.remoteTextTracks) return;
          const tt = p.remoteTextTracks();
          for (let i = 0; i < tt.length; i++) if (tt[i].src) res.urls.push({ url: new URL(tt[i].src, location.href).href, label: tt[i].label || tt[i].language || '' });
        });
      }
    } catch (e) {}
    // Playerjs (многие онлайн-кинотеатры)
    const players = [];
    try { (window.pljssglobal || []).forEach(p => { if (p && typeof p.api === 'function' && !players.includes(p)) players.push(p); }); } catch (e) {}
    captured.forEach(p => { if (p && typeof p.api === 'function' && !players.includes(p)) players.push(p); });
    res.players = players.length;
    for (const p of players) {
      let names = [];
      try { names = subNames(p.api('subtitles')); } catch (e) {}
      res.names = res.names.concat(names);
      if (!names.length) continue;
      let prev = null;
      try { prev = p.api('subtitle'); } catch (e) {}
      let prevIdx = -1;
      if (typeof prev === 'number') prevIdx = prev;
      else if (prev) prevIdx = names.findIndex(n => n === prev || String(prev).indexOf(n) >= 0);
      const picks = [];
      const en = names.findIndex(n => RE_EN.test(n));
      if (en >= 0) picks.push(en);
      const tr = names.findIndex((n, i) => i !== en && RE_TL.test(n));
      if (tr >= 0) picks.push(tr);
      if (!picks.length) names.forEach((n, i) => { if (picks.length < 3) picks.push(i); });
      for (const idx of picks) {
        const before = subsEvents;
        try { p.api('subtitle', idx); } catch (e) {}
        await waitFor(() => subsEvents > before, 5000);
        res.tried.push(names[idx]);
      }
      try { p.api('subtitle', prevIdx >= 0 ? prevIdx : -1); } catch (e) {}
    }
    return res;
  }

  window.addEventListener('message', async (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || d.__sl !== 'to-main') return;
    if (d.cmd === 'getSubs') post({ id: d.id, result: { found: found.slice(), hls: hls.slice() } });
    else if (d.cmd === 'autoSubs') {
      try { post({ id: d.id, result: await autoSubs(d.args || {}) }); }
      catch (e) { post({ id: d.id, error: String(e && e.message || e) }); }
    }
  });
})();

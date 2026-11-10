(async function () {
  await SL.loadSettings();
  await SL.loadVocab();
  SL._vocabLoaded = true;
  const $ = (id) => document.getElementById(id);
  await SL.send('stats:snapshot').catch(() => {});

  const fmtMin = (sec) => {
    const m = Math.round((sec || 0) / 60);
    if (m < 60) return m + ' мин';
    return Math.floor(m / 60) + ' ч ' + String(m % 60).padStart(2, '0') + ' мин';
  };
  const card = (big, label, small) => `<div class="stat"><b>${big}</b><span>${label}</span>${small ? `<small>${small}</small>` : ''}</div>`;

  // Линейный график: оси X/Y, сетка, плавная линия с заливкой, подсказка при наведении
  function niceMax(v) {
    if (v <= 4) return 4;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }
  const COLORS = { chWatch: '#f97316', chMature: '#22c55e', chReview: '#3b82f6' };
  function bars(el, ax, values, labels, fmt) {
    const box = $(el);
    const color = COLORS[el] || '#f97316';
    const W = Math.max(280, box.clientWidth || 600), H = box.clientHeight || 190;
    const pl = 38, pr = 12, pt = 14, pb = 26;
    const iw = W - pl - pr, ih = H - pt - pb;
    const ymax = niceMax(Math.max(...values, 0));
    const n = values.length;
    const X = (i) => pl + (n === 1 ? iw / 2 : i * iw / (n - 1));
    const Y = (v) => pt + ih - (v / ymax) * ih;
    const pts = values.map((v, i) => [X(i), Y(v)]);
    // плавная кривая (кардинальный сплайн) без выбросов ниже нуля
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const t = 0.18;
      const c1 = [p1[0] + (p2[0] - p0[0]) * t, Math.min(pt + ih, p1[1] + (p2[1] - p0[1]) * t)];
      const c2 = [p2[0] - (p3[0] - p1[0]) * t, Math.min(pt + ih, p2[1] - (p3[1] - p1[1]) * t)];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    const area = d + ` L${pts[n - 1][0]},${pt + ih} L${pts[0][0]},${pt + ih} Z`;
    const gid = 'g' + el;
    let grid = '';
    for (let k = 0; k <= 4; k++) {
      const v = ymax * k / 4, y = Y(v);
      grid += `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" stroke="#2a2a2f" stroke-dasharray="${k ? '3 4' : ''}"/>`;
      grid += `<text x="${pl - 8}" y="${y + 4}" fill="#71717a" font-size="11" text-anchor="end">${Math.round(v * 10) / 10}</text>`;
    }
    let xl = '';
    const step = Math.ceil(n / 6);
    for (let i = 0; i < n - step * 0.7; i += step) xl += `<text x="${X(i)}" y="${H - 6}" fill="#71717a" font-size="11" text-anchor="middle">${labels[i]}</text>`;
    xl += `<text x="${X(n - 1)}" y="${H - 6}" fill="#a1a1aa" font-size="11" text-anchor="end">сегодня</text>`;
    const last = pts[n - 1];
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
      ${grid}${xl}
      <path d="${area}" fill="url(#${gid})"/>
      <path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${pts.map((p, i) => values[i] ? `<circle cx="${p[0]}" cy="${p[1]}" r="2.4" fill="${color}"/>` : '').join('')}
      <circle cx="${last[0]}" cy="${last[1]}" r="4.5" fill="${color}" stroke="#0f0f11" stroke-width="2"/>
      <line class="guide" x1="0" x2="0" y1="${pt}" y2="${pt + ih}" stroke="#52525b" stroke-dasharray="3 3" opacity="0"/>
      <circle class="hot" r="5" fill="${color}" stroke="#fff" stroke-width="2" opacity="0"/>
      <rect x="${pl}" y="${pt}" width="${iw}" height="${ih}" fill="transparent"/>
    </svg><div class="tip"></div>`;
    const svg = box.querySelector('svg'), tip = box.querySelector('.tip'), guide = svg.querySelector('.guide'), hot = svg.querySelector('.hot');
    svg.addEventListener('mousemove', (e) => {
      const r = svg.getBoundingClientRect();
      const mx = (e.clientX - r.left) * W / r.width;
      const i = Math.max(0, Math.min(n - 1, Math.round((mx - pl) / iw * (n - 1))));
      const [x, y] = pts[i];
      guide.setAttribute('x1', x); guide.setAttribute('x2', x); guide.setAttribute('opacity', 1);
      hot.setAttribute('cx', x); hot.setAttribute('cy', y); hot.setAttribute('opacity', 1);
      tip.innerHTML = `${labels[i]}${i === n - 1 ? ' (сегодня)' : ''}<br><b>${fmt ? fmt(values[i]) : values[i]}</b>`;
      tip.style.left = (x * r.width / W) + 'px';
      tip.style.top = (y * r.height / H - 10) + 'px';
      tip.style.opacity = 1;
    });
    svg.addEventListener('mouseleave', () => { tip.style.opacity = 0; guide.setAttribute('opacity', 0); hot.setAttribute('opacity', 0); });
  }

  async function render() {
    const r = await chrome.storage.local.get(['sl_stats', 'sl_heard', 'sl_watchlog']);
    const days = (r.sl_stats || { days: {} }).days;
    const heard = r.sl_heard || {};
    const log = r.sl_watchlog || {};
    const now = Date.now();
    const keys = [];
    for (let d = 29; d >= 0; d--) keys.push(SL.srs.dayKey(now - d * 86400000));
    const labels = keys.map(k => k.slice(8) + '.' + k.slice(5, 7));
    const get = (k, f) => (days[k] && days[k][f]) || 0;
    const sum = (f, ks) => (ks || Object.keys(days)).reduce((a, k) => a + get(k, f), 0);
    const today = keys[keys.length - 1];
    const week = keys.slice(-7);

    // ----- слушание
    $('listen').innerHTML =
      card(fmtMin(get(today, 'watchSec')), 'сегодня', get(today, 'lines') + ' реплик') +
      card(fmtMin(sum('watchSec', week)), 'за 7 дней', sum('lines', week) + ' реплик') +
      card(fmtMin(sum('watchSec')), 'всего', sum('lines') + ' реплик услышано') +
      card(Object.keys(heard).length, 'разных слов услышано', '+' + sum('newHeard', week) + ' новых за неделю') +
      card(sum('lookups'), 'раз заглянул в словарь', get(today, 'lookups') + ' сегодня');
    bars('chWatch', 'axWatch', keys.map(k => Math.round(get(k, 'watchSec') / 60)), labels, v => v + ' мин');

    // ----- словарь
    const words = Object.values(SL.words), phrases = Object.values(SL.phrases);
    const learning = words.filter(w => w.status === 'learning');
    const mature = learning.filter(w => w.srs && w.srs.interval >= 21).length + phrases.filter(p => p.srs && p.srs.interval >= 21).length;
    const young = learning.filter(w => w.srs && w.srs.seen && w.srs.interval < 21).length + phrases.filter(p => p.srs && p.srs.seen && p.srs.interval < 21).length;
    const known = words.filter(w => w.status === 'known').length;
    $('vocab').innerHTML =
      card(learning.length + phrases.length, 'учу сейчас', learning.length + ' слов, ' + phrases.length + ' фраз') +
      card(young, 'в процессе', 'уже повторял, но ещё не закрепилось') +
      card(mature, 'закреплено', 'повторение через 3+ недели') +
      card(known, 'отмечено «знаю»', 'вручную, тобой') +
      card(sum('reviewed'), 'повторений всего', sum('reviewed', week) + ' за неделю');
    let last = 0;
    const mat = keys.map(k => { const s = days[k] && days[k].snap; if (s) last = s.mature; return last; });
    bars('chMature', 'axMature', mat, labels, v => v + ' закреплено');
    bars('chReview', 'axReview', keys.map(k => get(k, 'reviewed')), labels, v => v + ' повторений');

    // ----- слышишь, но не учишь
    const often = Object.entries(heard)
      .filter(([l, n]) => n >= 3 && l.length > 1)
      .filter(([l]) => { const c = SL.classify(l, true); return !c.marked && c.status !== 'special' && !(c.rank && c.rank <= 100); })
      .sort((a, b) => b[1] - a[1]).slice(0, 25);
    $('often').innerHTML = often.length ? often.map(([l, n]) => `<div class="wl"><span class="sl-w ${SL.statusClass(SL.classify(l, true)).replace('sl-w', '')}" data-w="${SL.esc(l)}">${SL.esc(l)}</span><span class="c">×${n}</span><button class="btn sm" data-m="learning|${SL.esc(l)}" title="Учить">★ учить</button><button class="btn sm" data-m="known|${SL.esc(l)}" title="Уже знаю">✓</button></div>`).join('')
      : '<div class="mut">Пока пусто — посмотри что-нибудь с субтитрами.</div>';

    // ----- видео
    const vids = Object.values(log).sort((a, b) => b.last - a.last).slice(0, 20);
    $('videos').innerHTML = vids.length ? vids.map(v => `<div class="vl"><a href="${SL.esc(v.url || '#')}" target="_blank" title="${SL.esc(v.title)}">${SL.esc(v.title || v.url || 'без названия')}</a><span class="mut">${fmtMin(v.sec)}</span><span class="mut">${new Date(v.last).toLocaleDateString()}</span></div>`).join('')
      : '<div class="mut">Пока пусто.</div>';
  }

  document.body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-m]');
    if (b) { const [st, l] = b.dataset.m.split('|'); await SL.send('vocab:mark', { lemma: l, word: l, status: st }); await SL.loadVocab(); render(); return; }
    const w = e.target.closest('.sl-w');
    if (w) SL.Dict.show({ word: w.dataset.w, rect: w.getBoundingClientRect() });
  });
  SL.hoverTip && SL.hoverTip(document.body);
  render();
  window.addEventListener('resize', SL.debounce(render, 200));
})();

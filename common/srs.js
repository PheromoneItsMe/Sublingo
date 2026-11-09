/* SubLingo — spaced repetition (SM-2 variant) */
var SL = (typeof SL !== 'undefined') ? SL : {};
(function (SL) {
  'use strict';
  const DAY = 86400000;
  SL.srs = {
    init(now) {
      now = now || Date.now();
      return { due: now, interval: 0, ease: 2.5, reps: 0, lapses: 0, last: 0, started: 0, seen: 0 };
    },
    // grade: 0 again, 1 hard, 2 good, 3 easy
    grade(s, g, now) {
      now = now || Date.now();
      s = Object.assign(SL.srs.init(now), s || {});
      if (!s.started) s.started = now;
      s.seen = (s.seen || 0) + 1;
      let iv = s.interval || 0;
      if (g === 0) {
        s.lapses += 1; s.reps = 0; s.ease = Math.max(1.3, s.ease - 0.2);
        iv = 10 / 1440; // 10 минут
      } else if (g === 1) {
        s.ease = Math.max(1.3, s.ease - 0.15);
        iv = s.reps === 0 ? 0.5 : Math.max(1, iv * 1.2);
        s.reps += 1;
      } else if (g === 2) {
        iv = s.reps === 0 ? 1 : s.reps === 1 ? 3 : Math.max(iv + 1, iv * s.ease);
        s.reps += 1;
      } else {
        s.ease = Math.min(3.2, s.ease + 0.15);
        iv = s.reps === 0 ? 4 : Math.max(iv + 2, iv * s.ease * 1.3);
        s.reps += 1;
      }
      // небольшой разброс, чтобы карточки не скапливались в один день
      if (iv >= 3) iv = iv * (0.95 + Math.random() * 0.1);
      s.interval = iv;
      s.last = now;
      s.due = now + iv * DAY;
      return s;
    },
    isDue(s, now) { return !!s && (s.due || 0) <= (now || Date.now()); },
    preview(s, g) { const n = SL.srs.grade(JSON.parse(JSON.stringify(s || {})), g); return SL.srs.fmtInterval(n.interval); },
    fmtInterval(d) {
      if (d < 1 / 24) return Math.max(1, Math.round(d * 1440)) + ' мин';
      if (d < 1) return Math.round(d * 24) + ' ч';
      if (d < 30) return Math.round(d) + ' дн';
      if (d < 365) return Math.round(d / 30) + ' мес';
      return (d / 365).toFixed(1) + ' г';
    },
    dayKey(t) { const d = new Date(t || Date.now()); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  };
})(SL);

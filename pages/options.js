(async function () {
  await SL.loadSettings();
  if (location.hash === '#welcome') document.getElementById('welcome').classList.remove('hidden');
  const langs = SL.LANGS.map(([v, l]) => [v, l]);
  const clickActs = [['dict', 'Словарь'], ['dictSpeak', 'Словарь + озвучка'], ['speak', 'Озвучить'], ['learning', 'Отметить «Учу»'], ['known', 'Отметить «Знаю»'], ['none', 'Ничего']];

  const SECTIONS = [
    ['Основное', [
      ['enabled', 'bool', 'Расширение включено'],
      ['targetLang', 'select', 'Язык перевода (родной)', langs],
      ['sourceLang', 'select', 'Изучаемый язык субтитров', [['en', 'English']]],
      ['translationMode', 'select', 'Источник перевода', [['auto', 'Авто: человеческий, если есть, иначе Google'], ['human', 'Только человеческий (субтитры на вашем языке)'], ['machine', 'Машинный (Google)'], ['youtube', 'Автоперевод YouTube'], ['off', 'Без перевода']]],
      ['showOriginal', 'bool', 'Показывать оригинальные субтитры'],
      ['showTranslation', 'bool', 'Показывать перевод'],
      ['blurTranslation', 'bool', 'Перевод скрыт до наведения', 'Сначала пробуешь понять сам, потом наводишь мышь (или E). Клавиша T включает и выключает'],
      ['showExpr', 'bool', 'Подчёркивать устойчивые выражения и фразовые глаголы', 'give up, figure it out, by the way… Наведение и клик показывают перевод всего выражения. Клавиша G'],
      ['summaryAtEnd', 'bool', 'Итог по видео в конце', 'Какие из твоих слов встретились, что ты смотрел в словаре, выражения из видео. Без оценок. Всегда доступен в меню ⋯'],
      ['hideNativeSubs', 'bool', 'Скрывать родные субтитры сайта'],
      ['keepLastLine', 'bool', 'Не убирать реплику в паузах между фразами'],
      ['wordHighlight', 'bool', 'Подсвечивать слово, которое сейчас произносится (эксперимент)', 'Точно — на автосубтитрах YouTube; на остальных — примерно, по длине слов. Клавиша H'],
      ['panelShowTranslation', 'bool', 'Перевод в панели со списком реплик']
    ]],
    ['Внешний вид субтитров', [
      ['fontSize', 'range', 'Размер шрифта', [14, 60, 1]],
      ['transFontScale', 'range', 'Размер перевода относительно оригинала', [0.5, 1.2, 0.05]],
      ['fontFamily', 'select', 'Шрифт', [['default', 'Системный'], ['netflix', 'Netflix Sans / Helvetica'], ['serif', 'С засечками'], ['mono', 'Моноширинный'], ['round', 'Округлый']]],
      ['bottomOffset', 'range', 'Отступ снизу, %', [0, 40, 1]],
      ['subBackground', 'range', 'Затемнение фона', [0, 1, 0.05]],
      ['panelWidth', 'number', 'Ширина панели, px']
    ]],
    ['Воспроизведение', [
      ['autoPause', 'bool', 'Автопауза после реплики', 'Пробел или D — продолжить. Клавиша Q: выкл → все → только трудные'],
      ['pauseBefore', 'select', 'Пауза до реплики', [['off', 'Выключена'], ['all', 'Перед каждой репликой'], ['hard', 'Только перед трудными']], 'Видео встаёт перед фразой: сначала читаешь английский, потом слушаешь. Удобно, когда речь в ролике на русском. Пробел или D — слушать. Клавиша P'],
      ['autoPauseHard', 'bool', 'Только на трудных репликах', 'Останавливаться, если в реплике есть незнакомые слова (новые, рекомендуемые, те, что учишь). Простые реплики идут без остановки'],
      ['hardMin', 'range', 'Трудная реплика — от скольких незнакомых слов', [1, 5, 1]],
      ['pauseOnHover', 'bool', 'Пауза, когда мышь над субтитрами'],
      ['pauseOnDict', 'bool', 'Пауза при открытии словаря'],
      ['slowSegments', 'bool', 'Замедлять речь', 'Во время реплик скорость снижается, в паузах — обычная'],
      ['slowRate', 'range', 'Скорость при замедлении', [0.5, 0.95, 0.05]],
      ['overrideArrows', 'bool', 'Стрелки ← → ↓ управляют репликами', 'Вместо перемотки на 5 секунд']
    ]],
    ['Мышь и клавиатура', [
      ['leftClick', 'select', 'Левый клик по слову', clickActs],
      ['rightClick', 'select', 'Правый клик по слову', clickActs],
      ['middleClick', 'select', 'Средний клик по слову', clickActs],
      ['speakOnClick', 'bool', 'Произносить слово при открытии словаря'],
      ['hoverTranslate', 'bool', 'Перевод при наведении на слово', 'Маленькая подсказка через полсекунды; клик — полная карточка'],
      ['saveMedia', 'bool', 'Сохранять голос и кадр вместе с фразой', 'Звук реплики и стоп-кадр из видео — для повторения и Anki. На защищённых видео (Netflix) недоступно'],
      ['dictDetailed', 'bool', 'Открывать словарь сразу подробно', 'По умолчанию — коротко: перевод и кнопки; остальное по «Подробнее»']
    ]],
    ['Подсветка слов', [
      ['colorLearning', 'bool', '<span class="sl-learning">Оранжевый</span> — слова, которые вы учите'],
      ['colorSuggested', 'bool', '<span class="sl-suggested">Жёлтый</span> — рекомендуемые (следующие по частоте после вашего уровня)'],
      ['colorUnknown', 'bool', '<span class="sl-unknown">Голубой</span> — новые слова'],
      ['colorKnownGreen', 'bool', '<span class="sl-known">Зелёный</span> — известные слова'],
      ['dimRare', 'bool', '<span class="sl-rare">Приглушать</span> редкие слова'],
      ['outlineMarked', 'bool', 'Подчёркивать слова, отмеченные вручную'],
      ['showTagUnderline', 'bool', 'Показывать цветные метки подчёркиванием'],
      ['suggestWindow', 'number', 'Сколько слов после уровня считать рекомендуемыми'],
      ['rareRank', 'number', 'Слова реже этого ранга — редкие']
    ]],
    ['Другие сайты', [
      ['webLookup', 'select', 'Перевод слова на любом сайте', [['alt', 'Alt + клик'], ['dblclick', 'Двойной клик'], ['off', 'Выключено']]],
      ['webSelectionBubble', 'bool', 'Кнопка «Перевести» при выделении текста'],
      ['genericAuto', 'bool', 'Субтитры в других видеоплеерах (онлайн-кинотеатры и т.п.)', 'Включаться самим, когда в плеере найдены субтитры. Иначе — кнопка «SL» на видео']
    ]],
    ['Повторение (карточки)', [
      ['reviewSessionSize', 'number', 'Карточек за сессию'],
      ['reviewNewPercent', 'range', 'Доля новых карточек, %', [0, 100, 5]],
      ['reviewModes.recall', 'bool', 'Узнавание: слово → значение'],
      ['reviewModes.cloze', 'bool', 'Пропуск в предложении (вписать слово)'],
      ['reviewModes.listen', 'bool', 'Аудирование: услышать фразу → понять'],
      ['reviewModes.reverse', 'bool', 'Обратные: перевод → английское слово'],
      ['reviewSuggestions', 'bool', 'Предлагать новые частотные слова в сессии'],
      ['autoKnownDays', 'number', 'Считать выученным при интервале (дней)', 'Слово переходит в «Знаю». 0 — никогда']
    ]],
    ['Озвучка', [
      ['ttsMode', 'select', 'Синтетический голос', [['manual', 'Только по кнопке 🔊'], ['on', 'Сам озвучивает (в повторении и при клике)'], ['off', 'Выключен совсем']]],
      ['ttsVoice', 'voice', 'Голос'],
      ['ttsRate', 'range', 'Скорость речи', [0.5, 1.5, 0.05]]
    ]],
    ['ИИ-объяснения (необязательно)', [
      ['aiEndpoint', 'text', 'Адрес API', 'OpenAI-совместимый /v1/chat/completions (OpenAI, OpenRouter, Groq, LM Studio…) или https://api.anthropic.com/v1/messages'],
      ['aiKey', 'password', 'API-ключ', 'Хранится только в этом браузере'],
      ['aiModel', 'text', 'Модель', 'например gpt-4o-mini, claude-haiku-4-5, llama-3.1-8b-instant']
    ]]
  ];

  const get = (k) => k.includes('.') ? (SL.settings[k.split('.')[0]] || {})[k.split('.')[1]] : SL.settings[k];
  const set = (k, v) => {
    if (k.includes('.')) { const [a, b] = k.split('.'); return SL.saveSettings({ [a]: Object.assign({}, SL.settings[a], { [b]: v }) }); }
    return SL.saveSettings({ [k]: v });
  };

  const root = document.getElementById('sections');
  let html = '<div class="cols">';
  for (const [title, opts] of SECTIONS) {
    html += `<div class="card"><h2 style="margin-top:0">${title}</h2>`;
    for (const [k, type, label, extra, hint] of opts) {
      const h = typeof extra === 'string' ? extra : hint;
      const lab = `<span>${label}${h ? `<small>${h}</small>` : ''}</span>`;
      if (type === 'bool') html += `<label class="opt">${lab}<input type="checkbox" data-k="${k}"></label>`;
      else if (type === 'select') html += `<label class="opt">${lab}<select data-k="${k}">${extra.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>`;
      else if (type === 'range') html += `<label class="opt">${lab}<input type="range" data-k="${k}" min="${extra[0]}" max="${extra[1]}" step="${extra[2]}"><b data-v="${k}" style="width:44px;text-align:right"></b></label>`;
      else if (type === 'number') html += `<label class="opt">${lab}<input type="number" data-k="${k}" style="width:100px"></label>`;
      else if (type === 'voice') html += `<label class="opt">${lab}<select data-k="${k}" id="voice" style="max-width:260px"><option value="">Лучший доступный (авто)</option></select><button class="btn sm" id="ttsTest">▶</button></label>`;
      else html += `<label class="opt" style="flex-wrap:wrap">${lab}<input type="${type}" data-k="${k}" style="width:100%"></label>`;
    }
    if (title.startsWith('ИИ')) html += `<div class="row" style="margin-top:8px"><button class="btn sm" id="aiTest">Проверить</button><span class="mut" id="aiOut"></span></div>`;
    if (title === 'Другие сайты') {
      html += `<h3>Внешние словари в карточке слова</h3><div class="row">${Object.entries(SL.EXTERNAL_DICTS).map(([k, d]) => `<label class="chip"><input type="checkbox" data-dict="${k}" style="width:14px;height:14px;vertical-align:-2px"> ${d.name}</label>`).join('')}</div>
        <h3>Свои словари</h3><div class="mut">По одному на строку: <code>Название | https://site/{word}</code></div><textarea id="customDicts" rows="3" style="margin-top:6px"></textarea>`;
    }
    html += '</div>';
  }
  html += '</div>';
  root.innerHTML = html;

  function fill() {
    root.querySelectorAll('[data-k]').forEach(el => {
      const v = get(el.dataset.k);
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v == null ? '' : v;
      const out = root.querySelector(`[data-v="${el.dataset.k}"]`);
      if (out) out.textContent = el.value;
    });
    root.querySelectorAll('[data-dict]').forEach(el => { el.checked = (SL.settings.externalDicts || []).includes(el.dataset.dict); });
    document.getElementById('customDicts').value = (SL.settings.customDicts || []).map(d => d.name + ' | ' + d.url).join('\n');
    document.getElementById('lvlNow').textContent = SL.settings.vocabLevel + ' слов';
  }
  fill();
  root.addEventListener('input', e => {
    const el = e.target;
    if (el.type === 'range') { const out = root.querySelector(`[data-v="${el.dataset.k}"]`); if (out) out.textContent = el.value; }
  });
  root.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.k) {
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.type === 'range' || el.type === 'number') v = Number(v);
      set(el.dataset.k, v);
    } else if (el.dataset.dict) {
      const list = [...root.querySelectorAll('[data-dict]')].filter(x => x.checked).map(x => x.dataset.dict);
      SL.saveSettings({ externalDicts: list });
    } else if (el.id === 'customDicts') {
      const list = el.value.split('\n').map(l => l.split('|').map(s => s.trim())).filter(p => p.length >= 2 && p[1].includes('{word}')).map(([name, url]) => ({ name, url }));
      SL.saveSettings({ customDicts: list });
    }
  });

  // voices
  SL.send('tts:voices').then(vs => {
    const sel = document.getElementById('voice');
    (vs || []).forEach(v => { const o = document.createElement('option'); o.value = v.name; o.textContent = `${v.name} (${v.lang || '?'})${v.remote ? ' ☁' : ''}`; sel.appendChild(o); });
    sel.value = SL.settings.ttsVoice || '';
  }).catch(() => {});
  document.getElementById('ttsTest').addEventListener('click', (e) => { e.preventDefault(); SL.send('tts', { text: 'Hello! This is how I sound. Learning English is fun.' }); });

  document.getElementById('aiTest').addEventListener('click', async () => {
    const out = document.getElementById('aiOut');
    out.textContent = '…';
    try { out.textContent = '✅ ' + (await SL.send('ai', { messages: [{ role: 'user', content: 'Reply with one short English sentence.' }] })).slice(0, 120); }
    catch (e) { out.textContent = '❌ ' + e.message; }
  });

  // vocabulary level test
  const BANDS = [500, 1000, 2000, 3000, 4000, 5000, 7000, 9000, 12000, 15000, 20000, 25000];
  const words = SL.freqList();
  const lvRoot = document.getElementById('levels');
  function sample(from, to) {
    const out = [];
    const step = Math.max(1, Math.floor((to - from) / 60));
    for (let i = from; i < to && out.length < 10; i += step) {
      const w = words[i];
      if (w && w.length > 2 && SL.lemma(w) === w && !/'/.test(w)) out.push(w);
    }
    return out;
  }
  let prev = 0;
  lvRoot.innerHTML = BANDS.map(b => { const s = sample(prev, b); const r = `<div class="lvl" data-l="${b}"><b>${b}</b><span>${s.join(', ')}</span></div>`; prev = b; return r; }).join('');
  const markLvl = () => lvRoot.querySelectorAll('.lvl').forEach(d => d.classList.toggle('on', Number(d.dataset.l) === SL.settings.vocabLevel));
  markLvl();
  lvRoot.addEventListener('click', e => {
    const d = e.target.closest('.lvl');
    if (!d) return;
    SL.saveSettings({ vocabLevel: Number(d.dataset.l) }).then(() => { fill(); markLvl(); });
  });
  document.getElementById('lvlZero').addEventListener('click', () => SL.saveSettings({ vocabLevel: 0 }).then(() => { fill(); markLvl(); }));

  // data
  async function info() {
    const all = await chrome.storage.local.get(null);
    const bytes = await chrome.storage.local.getBytesInUse(null);
    document.getElementById('dataInfo').textContent = `Слов: ${Object.keys(all.sl_words || {}).length}, фраз: ${Object.keys(all.sl_phrases || {}).length}, текстов: ${Object.keys(all.sl_texts || {}).length}. Занято ${(bytes / 1024).toFixed(0)} КБ.`;
  }
  info();
  document.getElementById('backup').addEventListener('click', async () => {
    const all = await chrome.storage.local.get(['sl_words', 'sl_phrases', 'sl_texts', 'sl_stats', 'sl_settings']);
    const data = { app: 'SubLingo', version: 1, exportedAt: new Date().toISOString(), words: all.sl_words || {}, phrases: all.sl_phrases || {}, texts: all.sl_texts || {}, stats: all.sl_stats || {}, settings: Object.assign({}, all.sl_settings || {}, { aiKey: '' }) };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
    a.download = 'sublingo-backup-' + SL.srs.dayKey() + '.json';
    a.click();
  });
  document.getElementById('restore').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const replace = confirm('Заменить текущие данные?\nОК — заменить, Отмена — объединить.');
      const r = await SL.send('vocab:import', { data, replace });
      if (data.stats) await chrome.storage.local.set({ sl_stats: data.stats });
      alert(`Готово: новых слов ${r.words}, фраз ${r.phrases}`);
      await SL.loadSettings(); fill(); info();
    } catch (err) { alert('Ошибка: ' + err.message); }
    e.target.value = '';
  });
  document.getElementById('resetSettings').addEventListener('click', async () => {
    if (!confirm('Сбросить все настройки к значениям по умолчанию?')) return;
    await chrome.storage.local.set({ sl_settings: {} }); await SL.loadSettings(); fill(); markLvl();
  });
  document.getElementById('wipe').addEventListener('click', async () => {
    if (!confirm('Удалить ВСЕ слова, фразы, тексты и статистику? Это нельзя отменить.')) return;
    if (!confirm('Точно удалить?')) return;
    await chrome.storage.local.remove(['sl_words', 'sl_phrases', 'sl_texts', 'sl_stats']); info();
  });
})();

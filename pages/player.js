(async function () {
  await SL.loadSettings();
  await SL.loadVocab();
  SL._vocabLoaded = true;
  const $ = (id) => document.getElementById(id);
  const vid = $('vid');
  let name = '';
  let transLines = null;
  let player = null;

  const adapter = {
    name: 'local',
    getVideo: () => (vid.src ? vid : null),
    getContainer: () => $('stage'),
    seek: (t) => { vid.currentTime = t; },
    play: () => { vid.play().catch(() => {}); },
    pause: () => vid.pause(),
    source: () => ({ type: 'local', title: name, url: '' }),
    controlsHeight: () => 54,
    layout: (w) => { document.body.classList.toggle('withpanel', !!w); document.body.style.setProperty('--pw', (w || 0) + 'px'); }
  };

  function ensurePlayer() {
    if (player) return player;
    player = new SL.SubPlayer(adapter);
    player.mount();
    player.onTransChange = () => loadTrans();
    return player;
  }

  function parseAny(text, fname) {
    if (/\.(ttml|xml|dfxp)$/i.test(fname) || /^\s*<\?xml|<tt[\s>]/.test(text)) return SL.parseTTML(text);
    return SL.parseVTT(text);
  }

  async function loadTrans() {
    if (!player || !player.lines.length) return;
    await SL.loadTranslations(player, { human: async () => transLines });
  }

  async function setVideo(src, label) {
    name = label;
    vid.src = src;
    $('stage').classList.remove('hidden');
    ensurePlayer().setMeta({ title: label });
    $('info').textContent = 'Видео: ' + label + (player.lines.length ? ' · субтитров: ' + player.lines.length : ' · теперь добавьте субтитры');
  }
  async function setSubs(file) {
    const text = await file.text();
    const lines = parseAny(text, file.name);
    if (!lines.length) { alert('Не удалось прочитать субтитры: ' + file.name); return; }
    ensurePlayer().setLines(lines);
    $('info').textContent = (name ? 'Видео: ' + name + ' · ' : '') + 'субтитров: ' + lines.length;
    loadTrans();
  }
  async function setTrans(file) {
    transLines = parseAny(await file.text(), file.name);
    if (SL.settings.translationMode === 'machine' || SL.settings.translationMode === 'off') await SL.saveSettings({ translationMode: 'auto' });
    loadTrans();
  }

  $('fVideo').addEventListener('change', e => { const f = e.target.files[0]; if (f) setVideo(URL.createObjectURL(f), f.name); });
  $('fSub').addEventListener('change', e => { const f = e.target.files[0]; if (f) setSubs(f); });
  $('fTr').addEventListener('change', e => { const f = e.target.files[0]; if (f) setTrans(f); });
  $('vGo').addEventListener('click', () => { const u = $('vUrl').value.trim(); if (u) setVideo(u, u.split('/').pop()); });

  const drop = $('drop');
  ['dragenter', 'dragover'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); if (ev === 'dragleave' && e.relatedTarget) return; drop.classList.remove('over'); }));
  document.addEventListener('drop', async e => {
    const files = [...(e.dataTransfer.files || [])];
    const subs = files.filter(f => /\.(srt|vtt|ttml|dfxp|xml)$/i.test(f.name));
    const media = files.find(f => /^(video|audio)\//.test(f.type) || /\.(mkv|mp4|webm|mov|mp3|m4a)$/i.test(f.name));
    if (media) setVideo(URL.createObjectURL(media), media.name);
    if (subs.length) {
      // the first file (or one that looks English) is the original, a second one is the translation
      subs.sort((a, b) => (/\b(en|eng|english)\b/i.test(b.name) ? 1 : 0) - (/\b(en|eng|english)\b/i.test(a.name) ? 1 : 0));
      await setSubs(subs[0]);
      if (subs[1]) setTrans(subs[1]);
    }
  });
})();

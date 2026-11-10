/* SubLingo — keeps the last ~60 s of the video's sound in memory, so a saved line can carry
   the actor's real voice and a still frame. Works where the browser allows capturing the video
   (YouTube, most embedded players, local files); on DRM-protected video it silently does nothing. */
var SL = (typeof SL !== 'undefined') ? SL : {};
(function (SL) {
  'use strict';
  const RATE = 16000;        // храним в 16 кГц моно — для голоса достаточно
  const KEEP = 70;           // секунд

  class ClipRecorder {
    constructor(getVideo) {
      this.getVideo = getVideo;
      this.blocks = [];      // {t0, t1, data: Float32Array}
      this.video = null;
      this.ctx = null;
      this.failed = false;
    }

    tick() {
      const v = this.getVideo();
      if (!v || this.failed) return;
      if (v !== this.video) this._attach(v);
      if (this.ctx && this.ctx.state === 'suspended' && !v.paused) this.ctx.resume().catch(() => {});
    }

    _attach(v) {
      this._detach();
      this.video = v;
      this.blocks = [];
      let stream;
      try { stream = v.captureStream ? v.captureStream() : (v.mozCaptureStream ? v.mozCaptureStream() : null); } catch (e) { stream = null; }
      if (!stream) return;
      const hook = async () => {
        if (this.ctx || this._hooking || !stream.getAudioTracks().length) return;
        this._hooking = true;
        try {
          const ctx = this.ctx = new AudioContext();
          const src = ctx.createMediaStreamSource(stream);
          const ratio = ctx.sampleRate / RATE;
          const onBlock = (inp) => {
            const vv = this.video;
            if (!vv || vv.paused || vv.seeking) return;
            const n = Math.floor(inp.length / ratio);
            const out = new Float32Array(n);
            for (let i = 0; i < n; i++) out[i] = inp[Math.floor(i * ratio)];
            const dur = inp.length / ctx.sampleRate;
            const rate = vv.playbackRate || 1;
            const t1 = vv.currentTime - 0.04;                // небольшая задержка вывода
            const t0 = t1 - dur * rate;
            this.blocks.push({ t0, t1, data: out });
            const cut = t1 - KEEP;
            while (this.blocks.length && (this.blocks[0].t1 < cut || this.blocks.length > 600)) this.blocks.shift();
          };
          let proc = null;
          // современный способ — AudioWorklet; если страница не даёт его загрузить, старый ScriptProcessor
          try {
            if (ctx.audioWorklet && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
              await ctx.audioWorklet.addModule(chrome.runtime.getURL('content/clip-worklet.js'));
              proc = new AudioWorkletNode(ctx, 'sl-tap', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
              proc.port.onmessage = (e) => onBlock(e.data);
            }
          } catch (e) { proc = null; }
          if (!proc) {
            proc = ctx.createScriptProcessor(4096, 1, 1);
            proc.onaudioprocess = (e) => onBlock(e.inputBuffer.getChannelData(0));
          }
          src.connect(proc);
          const mute = ctx.createGain(); mute.gain.value = 0;   // звук не дублируем в колонки
          proc.connect(mute); mute.connect(ctx.destination);
          this.nodes = [src, proc, mute];
          this.mode = proc instanceof ScriptProcessorNode ? 'script' : 'worklet';
        } catch (e) { this.failed = true; }
        this._hooking = false;
      };
      hook();
      stream.addEventListener('addtrack', hook);
      this.stream = stream;
      const resume = () => { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); };
      ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, resume, { capture: true, passive: true }));
    }

    _detach() {
      try { (this.nodes || []).forEach(n => n.disconnect()); } catch (e) {}
      try { this.ctx && this.ctx.close(); } catch (e) {}
      this.ctx = null; this.nodes = null; this.stream = null;
    }

    // Звук фрагмента [start, end] (секунды видео) — WAV dataURL или null
    audio(start, end) {
      start -= 0.2; end += 0.35;
      const parts = this.blocks.filter(b => b.t1 > start && b.t0 < end);
      if (!parts.length) return null;
      // покрытие должно быть почти полным, иначе фрагмент не был прослушан целиком
      const covered = parts.reduce((a, b) => a + (Math.min(b.t1, end) - Math.max(b.t0, start)), 0);
      if (covered < (end - start) * 0.75) return null;
      const seen = new Map();
      parts.sort((a, b) => a.t0 - b.t0).forEach(b => seen.set(Math.round(b.t0 * 20), b));   // повторы после перемотки — берём последний
      const list = [...seen.values()].sort((a, b) => a.t0 - b.t0);
      const out = [];
      let peak = 0;
      for (const b of list) {
        const per = (b.t1 - b.t0) / b.data.length;
        for (let i = 0; i < b.data.length; i++) {
          const t = b.t0 + i * per;
          if (t < start || t > end) continue;
          const x = b.data[i];
          out.push(x);
          if (Math.abs(x) > peak) peak = Math.abs(x);
        }
      }
      if (out.length < RATE * 0.3 || peak < 0.003) return null;   // тишина (например, защищённое видео)
      const gain = Math.min(4, 0.9 / peak);
      return wav(out, gain);
    }

    // Кадр видео — JPEG dataURL или null
    frame() {
      const v = this.video || this.getVideo();
      if (!v || !v.videoWidth) return null;
      try {
        const w = Math.min(480, v.videoWidth), h = Math.round(w * v.videoHeight / v.videoWidth);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        g.drawImage(v, 0, 0, w, h);
        const px = g.getImageData(0, 0, w, h).data;
        let sum = 0;
        for (let i = 0; i < px.length; i += 400) sum += px[i] + px[i + 1] + px[i + 2];
        if (sum < 50) return null;   // чёрный кадр
        return c.toDataURL('image/jpeg', 0.72);
      } catch (e) { return null; }
    }
  }

  function wav(samples, gain) {
    const n = samples.length;
    const buf = new ArrayBuffer(44 + n * 2);
    const dv = new DataView(buf);
    const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, RATE, true); dv.setUint32(28, RATE * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    ws(36, 'data'); dv.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) { const x = Math.max(-1, Math.min(1, samples[i] * gain)); dv.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return 'data:audio/wav;base64,' + btoa(bin);
  }

  SL.ClipRecorder = ClipRecorder;
})(SL);

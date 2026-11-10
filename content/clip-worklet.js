/* SubLingo — AudioWorklet: copies the video's sound into 4096-sample blocks for content/clip.js */
class SLTap extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(4096); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      let i = 0;
      while (i < ch.length) {
        const k = Math.min(ch.length - i, 4096 - this.n);
        this.buf.set(ch.subarray(i, i + k), this.n);
        this.n += k; i += k;
        if (this.n === 4096) { this.port.postMessage(this.buf, [this.buf.buffer]); this.buf = new Float32Array(4096); this.n = 0; }
      }
    }
    return true;
  }
}
registerProcessor('sl-tap', SLTap);

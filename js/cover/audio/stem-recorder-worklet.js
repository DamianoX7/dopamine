/* global currentFrame, registerProcessor, AudioWorkletProcessor */
// AudioWorklet processor that captures the backing and voice as separate stems.
//
// Input 0 = backing, input 1 = voice (mic). Both inputs are delivered in the same render
// quantum, so the two stems stay sample-accurately aligned with each other. Recording
// starts and stops at exact context frames sent from the main thread.
//
// Per chunk it posts: the mono voice samples, optionally the stereo backing samples, and
// peak/energy stats for both inputs (so the backing level can be verified even when its
// samples are not kept, e.g. for an uploaded file we already have).

class StemRecorderProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.keepBacking = !!opts.keepBacking;
    this.chunkFrames = opts.chunkFrames || 8192;
    this.startFrame = -1;
    this.stopFrame = Infinity;
    this.finished = false;
    this.total = 0;
    this.resetChunk();
    this.port.onmessage = (event) => {
      const msg = event.data || {};
      if (msg.type === 'start') this.startFrame = msg.frame;
      else if (msg.type === 'stop') this.stopFrame = Math.max(msg.frame, this.startFrame < 0 ? 0 : this.startFrame);
    };
  }

  resetChunk() {
    this.pos = 0;
    this.voice = new Float32Array(this.chunkFrames);
    if (this.keepBacking) {
      this.backL = new Float32Array(this.chunkFrames);
      this.backR = new Float32Array(this.chunkFrames);
    }
    this.vPeak = 0;
    this.vSum = 0;
    this.bPeak = 0;
    this.bSum = 0;
  }

  flush() {
    const n = this.pos;
    if (n === 0) return;
    const full = n === this.chunkFrames;
    const voice = full ? this.voice : this.voice.slice(0, n);
    const msg = {
      type: 'chunk', frames: n, voice,
      vPeak: this.vPeak, vSum: this.vSum, bPeak: this.bPeak, bSum: this.bSum,
    };
    const transfer = [voice.buffer];
    if (this.keepBacking) {
      msg.backL = full ? this.backL : this.backL.slice(0, n);
      msg.backR = full ? this.backR : this.backR.slice(0, n);
      transfer.push(msg.backL.buffer, msg.backR.buffer);
    }
    this.total += n;
    this.port.postMessage(msg, transfer);
    this.resetChunk();
  }

  process(inputs, outputs) {
    if (this.finished || this.startFrame < 0) return true;
    const out = outputs[0] && outputs[0][0];
    const n = out ? out.length : 128;
    const blockStart = currentFrame;
    const blockEnd = blockStart + n;
    if (blockEnd <= this.startFrame) return true;

    const from = Math.max(0, this.startFrame - blockStart);
    const to = Math.min(n, this.stopFrame - blockStart);
    const back = inputs[0] || [];
    const vin = inputs[1] || [];
    const bl = back[0];
    const br = back[1] || back[0];
    const v0 = vin[0];
    const v1 = vin[1];

    for (let i = from; i < to; i++) {
      let v = 0;
      if (v0) v = v1 ? (v0[i] + v1[i]) * 0.5 : v0[i];
      const av = v < 0 ? -v : v;
      if (av > this.vPeak) this.vPeak = av;
      this.vSum += v * v;
      this.voice[this.pos] = v;

      let l = 0;
      let r = 0;
      if (bl) { l = bl[i]; r = br[i]; }
      const al = l < 0 ? -l : l;
      const ar = r < 0 ? -r : r;
      const ab = al > ar ? al : ar;
      if (ab > this.bPeak) this.bPeak = ab;
      this.bSum += (l * l + r * r) * 0.5;
      if (this.keepBacking) {
        this.backL[this.pos] = l;
        this.backR[this.pos] = r;
      }

      this.pos++;
      if (this.pos === this.chunkFrames) this.flush();
    }

    if (blockEnd >= this.stopFrame) {
      this.flush();
      this.finished = true;
      this.port.postMessage({ type: 'done', totalFrames: this.total });
    }
    return true;
  }
}

registerProcessor('stem-recorder', StemRecorderProcessor);

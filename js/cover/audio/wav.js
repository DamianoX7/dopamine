// 16-bit PCM WAV encode/decode. WAV is used for the lossless stems and the final render
// because every target browser can play it and it can be produced faster than real time.

function writeStr(view, offset, s) {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}

export function wavHeader({ numChannels, sampleRate, dataBytes, bitsPerSample = 16 }) {
  const buf = new ArrayBuffer(44);
  const v = new DataView(buf);
  const blockAlign = (numChannels * bitsPerSample) / 8;
  writeStr(v, 0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  writeStr(v, 8, 'WAVE');
  writeStr(v, 12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, numChannels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * blockAlign, true);
  v.setUint16(32, blockAlign, true);
  v.setUint16(34, bitsPerSample, true);
  writeStr(v, 36, 'data');
  v.setUint32(40, dataBytes, true);
  return buf;
}

function toInt16(s) {
  s = s < -1 ? -1 : s > 1 ? 1 : s;
  return Math.round(s < 0 ? s * 32768 : s * 32767);
}

/** Float32 -> Int16 into `dst` (optionally interleaved with `stride`). */
export function floatToInt16(src, dst, offset = 0, stride = 1) {
  for (let i = 0, j = offset; i < src.length; i++, j += stride) dst[j] = toInt16(src[i]);
  return dst;
}

/** Build a WAV Blob from already-converted Int16 parts (interleaved when stereo). */
export function pcm16PartsToWav(parts, numChannels, sampleRate) {
  let samples = 0;
  for (const p of parts) samples += p.length;
  const header = wavHeader({ numChannels, sampleRate, dataBytes: samples * 2 });
  return new Blob([header, ...parts], { type: 'audio/wav' });
}

/**
 * Encode (a frame range of) an AudioBuffer as a 16-bit WAV Blob, in chunks to keep peak
 * memory low.
 */
export function encodeWavFromAudioBuffer(buffer, { gain = 1, chunkFrames = 262144, startFrame = 0, frameCount = null } = {}) {
  const nCh = buffer.numberOfChannels;
  const first = Math.max(0, Math.min(startFrame, buffer.length));
  const last = frameCount == null ? buffer.length : Math.min(buffer.length, first + frameCount);
  const len = last - first;
  const channels = [];
  for (let c = 0; c < nCh; c++) channels.push(buffer.getChannelData(c));
  const parts = [wavHeader({ numChannels: nCh, sampleRate: buffer.sampleRate, dataBytes: len * nCh * 2 })];
  for (let start = first; start < last; start += chunkFrames) {
    const end = Math.min(last, start + chunkFrames);
    const out = new Int16Array((end - start) * nCh);
    for (let c = 0; c < nCh; c++) {
      const ch = channels[c];
      for (let i = start, j = c; i < end; i++, j += nCh) out[j] = toInt16(ch[i] * gain);
    }
    parts.push(out);
  }
  return new Blob(parts, { type: 'audio/wav' });
}

function readStr(view, offset, len) {
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}

/**
 * Parse a PCM WAV (16-bit int or 32-bit float). Returns { sampleRate, channels: Float32Array[] }
 * or null for anything else (callers then fall back to decodeAudioData).
 */
export function parseWav(arrayBuffer) {
  const v = new DataView(arrayBuffer);
  if (v.byteLength < 44 || readStr(v, 0, 4) !== 'RIFF' || readStr(v, 8, 4) !== 'WAVE') return null;
  let off = 12;
  let fmt = null;
  let dataOff = -1;
  let dataLen = 0;
  while (off + 8 <= v.byteLength) {
    const id = readStr(v, off, 4);
    const size = v.getUint32(off + 4, true);
    if (id === 'fmt ') {
      fmt = {
        format: v.getUint16(off + 8, true),
        channels: v.getUint16(off + 10, true),
        sampleRate: v.getUint32(off + 12, true),
        bits: v.getUint16(off + 22, true),
      };
    } else if (id === 'data') {
      dataOff = off + 8;
      dataLen = Math.min(size, v.byteLength - dataOff);
      break;
    }
    off += 8 + size + (size & 1);
  }
  if (!fmt || dataOff < 0 || !fmt.channels) return null;
  const isInt16 = fmt.format === 1 && fmt.bits === 16;
  const isFloat32 = fmt.format === 3 && fmt.bits === 32;
  if (!isInt16 && !isFloat32) return null;
  const nCh = fmt.channels;
  const bytes = fmt.bits / 8;
  const frames = Math.floor(dataLen / (bytes * nCh));
  const channels = Array.from({ length: nCh }, () => new Float32Array(frames));
  if (isInt16 && dataOff % 2 === 0) {
    const s = new Int16Array(arrayBuffer, dataOff, frames * nCh);
    for (let i = 0, k = 0; i < frames; i++) {
      for (let c = 0; c < nCh; c++, k++) channels[c][i] = s[k] / 32768;
    }
  } else {
    for (let i = 0, p = dataOff; i < frames; i++) {
      for (let c = 0; c < nCh; c++, p += bytes) {
        channels[c][i] = isInt16 ? v.getInt16(p, true) / 32768 : v.getFloat32(p, true);
      }
    }
  }
  return { sampleRate: fmt.sampleRate, channels, frames };
}

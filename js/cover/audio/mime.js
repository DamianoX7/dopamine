// MIME helpers. Extensions always follow the real container — never relabelled.

export function baseMime(mime) {
  return String(mime || '').split(';')[0].trim().toLowerCase();
}

export function extensionForMime(mime) {
  switch (baseMime(mime)) {
    case 'audio/webm':
    case 'video/webm':
      return 'webm';
    case 'audio/mp4':
    case 'video/mp4':
    case 'audio/x-m4a':
    case 'audio/m4a':
      return 'm4a';
    case 'audio/aac':
    case 'audio/x-aac':
      return 'aac';
    case 'audio/ogg':
    case 'application/ogg':
      return 'ogg';
    case 'audio/wav':
    case 'audio/wave':
    case 'audio/x-wav':
    case 'audio/vnd.wave':
      return 'wav';
    case 'audio/mpeg':
    case 'audio/mp3':
      return 'mp3';
    case 'audio/flac':
    case 'audio/x-flac':
      return 'flac';
    default:
      return 'audio';
  }
}

export function mimeLabel(mime) {
  const base = baseMime(mime);
  const codec = /codecs=["']?([\w.]+)/i.exec(mime || '');
  const names = {
    'audio/webm': 'WebM',
    'audio/mp4': 'MP4 오디오 (M4A)',
    'audio/aac': 'AAC',
    'audio/ogg': 'Ogg',
    'audio/wav': 'WAV (16-bit PCM)',
    'audio/mpeg': 'MP3',
  };
  const name = names[base] || base || 'unknown';
  return codec ? `${name} · ${codec[1]}` : name;
}

/** 'audio/webm;codecs=opus' -> 'audio/webm; codecs="opus"' (the form canPlayType expects). */
export function canPlayTypeString(mime) {
  return String(mime || '').replace(/;\s*codecs=["']?([^;"']+)["']?/i, '; codecs="$1"');
}

let probeEl = null;
/** '' | 'maybe' | 'probably' */
export function canPlay(mime) {
  if (!mime) return '';
  probeEl = probeEl || document.createElement('audio');
  try {
    return probeEl.canPlayType(canPlayTypeString(mime)) || probeEl.canPlayType(baseMime(mime)) || '';
  } catch {
    return '';
  }
}

/** Accept known audio file types even when the OS doesn't report a MIME type. */
export function looksLikeAudioFile(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith('audio/')) return true;
  if (file.type === 'video/mp4' || file.type === 'video/webm' || file.type === 'application/ogg') return true;
  return /\.(mp3|wav|wave|m4a|aac|mp4|ogg|oga|opus|flac|webm|aif|aiff|caf)$/i.test(file.name || '');
}

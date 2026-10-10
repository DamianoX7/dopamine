// Download / share the saved audio. The extension always matches the real MIME type.
import { getBlob } from './core/db.js';
import { toast } from './core/toast.js';
import { sanitizeFilename } from './core/util.js';
import { extensionForMime } from './audio/mime.js';

export function singleFilename(single, { original = false } = {}) {
  const mime = original ? single.originalTakeMimeType : single.mimeType;
  const artist = single.coverArtist || single.originalArtist || '도파민 월드';
  const base = `${artist} - ${single.title || 'Untitled'}${original ? ' (original take)' : ''}`;
  return `${sanitizeFilename(base)}.${extensionForMime(mime)}`;
}

async function loadAudio(single, original) {
  const blob = await getBlob(original ? single.originalTakeId : single.audioId);
  if (!blob) toast('이 기기의 저장 공간에서 오디오 파일을 찾을 수 없어요.', { type: 'error' });
  return blob;
}

export async function downloadSingle(single, { original = false } = {}) {
  const blob = await loadAudio(single, original);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = singleFilename(single, { original });
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function canShareFiles() {
  try {
    return !!(navigator.canShare && navigator.canShare({ files: [new File([new Uint8Array(4)], 'test.wav', { type: 'audio/wav' })] }));
  } catch {
    return false;
  }
}

export async function shareSingle(single) {
  const blob = await loadAudio(single, false);
  if (!blob) return;
  const file = new File([blob], singleFilename(single), { type: single.mimeType || blob.type });
  try {
    if (!navigator.canShare || !navigator.canShare({ files: [file] })) {
      toast('이 브라우저는 파일 공유를 지원하지 않아요 — 대신 내려받기를 이용해 주세요.');
      return;
    }
    await navigator.share({ files: [file], title: single.title || '내 커버' });
  } catch (err) {
    if (err && err.name !== 'AbortError') toast('공유하지 못했어요 — 대신 내려받기를 이용해 주세요.', { type: 'warn' });
  }
}

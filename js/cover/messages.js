// User-facing messages in one place so wording stays consistent and honest.

// Chrome's own labels in its sharing dialogs (checked in Chrome 154), so the instructions name
// exactly what is on screen. Other browser languages fall back to the English wording.
const KOREAN_UI = typeof navigator !== 'undefined' && /^ko\b/i.test(navigator.language || '');
export const CHROME_UI = KOREAN_UI
  ? { allow: '허용', allowTabAudio: '탭 오디오도 허용', tabPage: 'Chrome 탭', screenPage: '전체 화면', tabAudio: '탭 오디오와 함께 공유', systemAudio: '시스템 오디오와 함께 공유', shareWithAudio: '오디오와 함께 공유' }
  : { allow: 'Allow', allowTabAudio: 'Also allow tab audio', tabPage: 'Chrome Tab', screenPage: 'Entire Screen', tabAudio: 'Share with tab audio', systemAudio: 'Share with system audio', shareWithAudio: 'Share with Audio' };

export const MSG = {
  // Microphone
  micDenied: '목소리를 녹음하려면 마이크 권한이 필요해요.',
  micDeniedHelp: '브라우저 설정에서 이 사이트의 마이크를 허용해 주세요 (예: 주소창 옆의 자물쇠 / 조절 아이콘, 아이폰은 설정 → Safari → 마이크). 그런 다음 다시 시도해 주세요.',
  micNotFound: '마이크를 찾지 못했어요. 마이크나 헤드셋을 연결하고 다시 시도해 주세요.',
  micBusy: '마이크를 쓸 수 없어요 — 다른 앱이나 탭이 쓰고 있을 수 있어요. 그쪽을 닫고 다시 시도해 주세요.',
  micUnsupported: '이 브라우저는 마이크 녹음을 지원하지 않아요.',
  micError: '마이크를 켜지 못했어요. 다시 시도해 주세요.',
  micLost: '마이크를 더 이상 쓸 수 없어요. 녹음하기 전에 마이크를 다시 허용해 주세요.',
  micEnded: '마이크 연결이 끊어져서 녹음을 멈췄어요.',
  insecure: '녹음은 보안 페이지(https:// 또는 localhost)에서만 할 수 있어요. 마이크를 쓰려면 도파민 월드를 https로 열어 주세요.',

  // Tab / system audio capture
  tabUnavailable: '이 브라우저는 탭이나 컴퓨터 소리를 가져올 수 없어요. 대신 반주 파일을 올려 보세요.',
  noAudioTrack: '공유는 시작됐는데 소리가 함께 오지 않았어요. 다시 공유하면서 브라우저 창의 오디오 스위치를 켜 두세요.',
  noAudioTab: `탭이 소리 없이 공유됐어요. 다시 공유하면서 “${CHROME_UI.tabAudio}” 스위치를 켜 두세요.`,
  noAudioSystem: `화면이 소리 없이 공유됐어요. 다시 공유하면서 먼저 “${CHROME_UI.systemAudio}” 스위치를 켜 주세요 — Chrome은 이 스위치를 꺼 둬요. 켜면 버튼 이름이 “${CHROME_UI.shareWithAudio}”(으)로 바뀌어요.`,
  tabCancelled: '공유를 취소했어요. 공유 버튼을 눌러 다시 시도해 주세요.',
  tabGestureNeeded: '공유는 직접 누르거나 클릭해서 시작해야 해요. 버튼을 다시 눌러 주세요.',
  tabError: '공유를 시작하지 못했어요. 다시 시도해 주세요.',
  tabEnded: '공유가 멈춰서 반주를 더 이상 가져올 수 없었어요. 녹음을 멈췄어요.',
  tabLost: '공유가 끝났어요. 녹음하기 전에 노래 소리를 다시 공유해 주세요.',
  silentThisTab: '이 페이지의 플레이어에서 소리가 오지 않아요. 영상이 재생 중이고 음소거가 아닌지 확인해 주세요.',
  silentOtherTab: '공유한 탭에서 소리가 오지 않아요. 그 탭에서 노래를 틀고, 음소거가 아닌지 확인해 주세요.',
  silentSystem: '컴퓨터에서 소리가 오지 않아요. 노래를 틀어 주세요 — 어떤 앱이든 괜찮아요.',

  // Recording
  unsupportedMethod: '이 브라우저는 이 녹음 방식을 지원하지 않아요.',
  recordingFailed: '녹음하는 중에 문제가 생겼어요. 다시 시도해 주세요.',
  unsupportedFormat: '이 브라우저는 호환되는 녹음 형식을 만들 수 없어요.',
  audioSuspended: '브라우저가 오디오를 잠시 멈췄어요. 녹음 버튼을 다시 눌러 시작해 주세요.',
  audioInterrupted: '오디오가 끊겨서(예: 전화나 다른 앱) 녹음을 멈췄어요.',
  backgrounded: '앱이 백그라운드로 가서 녹음을 멈췄어요.',
  maxLength: '최대 길이인 15분이 되어 녹음을 멈췄어요.',
  emptyRecording: '녹음된 내용이 비어 있어요. 다시 시도해 주세요.',

  // Speaker / headphones
  speakerShort: '스피커 방식은 마이크로 반주까지 녹음돼서 울림이 생길 수 있어요.',
  speakerFull: '⚠️ 스피커 방식은 울림, 하울링, 주변 소음, 박자 어긋남이 생길 수 있어요. 가장 깨끗하게 녹음하려면 헤드폰을 쓰거나 반주 파일을 올려 주세요.',
  speakerListening: '⚠️ 더 좋은 음질을 원하면 헤드폰을 써 주세요. 마이크가 스피커 소리까지 담아서 울림이나 위상 문제가 생길 수 있어요.',
  headphonesTitle: '🎧 추천: 가장 깨끗하게 녹음하려면 헤드폰이나 이어폰을 써 주세요.',
  headphonesBody: '헤드폰을 쓰면 반주가 마이크로 새어 들어가지 않아서 울림, 하울링, 위상 문제가 줄어들어요.',

  // Verification
  backingMissing: '목소리는 녹음됐지만 반주는 담기지 않았어요.',
  voiceMissing: '이 녹음에서 목소리를 찾지 못했어요 — 마이크 신호가 조용했어요.',

  // YouTube
  invalidYouTube: '유튜브 링크가 아닌 것 같아요. youtube.com/watch?v=… 또는 youtu.be/… 같은 링크를 넣어 주세요.',
  embedBlockedTitle: '이 영상은 다른 사이트에서 재생할 수 없어요',
  embedBlockedDesktop: '영상 주인이 막아 뒀지만 따라 부를 수는 있어요: 다른 탭에서 유튜브로 열고, 반주 소스에서 “다른 탭”을 골라 그 탭의 소리를 녹음하세요.',
  embedBlockedOther: '영상 주인이 막아 뒀어요. 같은 노래의 다른 영상(예: 노래방/MR 버전)을 써 보거나, 반주 파일을 올려 주세요.',

  // Files & storage
  decodeFailed: '브라우저가 이 오디오 파일을 읽지 못했어요. MP3, M4A/AAC, WAV 파일로 해 보세요.',
  notAudio: '오디오 파일이 아닌 것 같아요.',
  uploadRights: '사용할 권리가 있는 오디오만 올려 주세요.',
  downloadRights: '사용할 권리가 있는 음악의 녹음만 공유하거나 공개해 주세요.',
  storageFull: '이 기기에 녹음을 저장할 공간이 부족해요.',
  storageUnavailable: '이 브라우저가 로컬 저장소(IndexedDB)를 막고 있어서 여기에는 녹음을 저장할 수 없어요. 시크릿 모드에서 이런 일이 생기기도 해요.',
  playbackUnsupported: (mime) => `이 브라우저는 녹음된 형식(${mime})을 재생할 수 없어요.`,
};

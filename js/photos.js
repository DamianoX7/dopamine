'use strict';
/* ==================================================================
   📷 Pictures of the foxes. In the foxes' world she can stop the
   game, have the family pose and take pictures (FoxRoom.setPhoto in
   js/pet.js; the 3D side draws them). They are kept on this device,
   in IndexedDB (js/db.js: photos), and shown in an album that opens
   from the camera and from "Me". Nothing is uploaded.
   ================================================================== */
const PHOTO_MAX = 240; // the album holds this many; after that she has to make room first

const Photos = {
  busy: false,
  last: undefined, // the newest picture — null: the album is empty, undefined: not looked up yet
  album: null, //     the open album (its overlay)

  /* All of them, newest first. */
  async all() {
    const list = await DB.all('photos');
    return list.sort((a, b) => b.at - a.at);
  },

  /* Click! What the camera sees now goes into the album. */
  async shoot() {
    if (this.busy || !FoxHost.api || !FoxRoom.photoOn) return;
    this.busy = true;
    try {
      if ((await DB.keys('photos')).length >= PHOTO_MAX) {
        UI.toast(`사진첩이 가득 찼어요 (${PHOTO_MAX}장). 지난 사진을 정리하면 다시 찍을 수 있어요.`, { icon: '📷', ms: 4200 });
        return;
      }
      const canvas = FoxHost.api.capture(1440);
      if (!canvas) return;
      Sfx.play('shutter');
      this.flash();
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) throw new Error('the picture could not be encoded');
      const p = State.pet;
      const rec = {
        id: `p${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`,
        blob,
        thumb: this.thumbOf(canvas),
        w: canvas.width,
        h: canvas.height,
        at: Date.now(),
        scene: p.scene,
        names: p.out.map((id) => Pet.nameOf(id)),
      };
      await DB.put('photos', rec);
      State.statistics.photos = (State.statistics.photos || 0) + 1;
      Diary.note('photos');
      Diary.put('photo', rec.id); // (the newest of the day goes on its page)
      Store.save();
      this.last = rec;
      this.showLast(true);
      Game.checkAchievements();
    } catch (err) {
      console.warn('[Photos] could not keep the picture', err);
      UI.toast(err && err.code === 'quota' ? '저장 공간이 가득 차서 사진을 간직하지 못했어요. 사진첩을 정리해 주세요.' : '사진을 간직하지 못했어요. 다시 찍어 볼까요?', { icon: '📷', ms: 3800 });
    } finally {
      this.busy = false;
    }
  },

  /* A small copy for the album's pages (the album never has to open the big pictures to show itself). */
  thumbOf(canvas) {
    const k = 360 / Math.max(canvas.width, canvas.height);
    const small = document.createElement('canvas');
    small.width = Math.round(canvas.width * k);
    small.height = Math.round(canvas.height * k);
    const ctx = small.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, small.width, small.height);
    return small.toDataURL('image/jpeg', 0.82);
  },

  flash() {
    const el = $('[data-photo-flash]');
    if (!el || reducedMotion()) return;
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
  },

  /* The newest picture, small, on the button that opens the album (as on a phone's camera). */
  async showLast(pop = false) {
    if (this.last === undefined) {
      try {
        this.last = (await this.all())[0] || null;
      } catch (e) {
        this.last = null;
      }
    }
    const el = $('[data-photo-last]');
    if (!el) return;
    el.innerHTML = this.last ? `<img src="${this.last.thumb}" alt="">` : '<span aria-hidden="true">🖼️</span>';
    if (pop && !reducedMotion()) {
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
    }
  },

  /* ----- the album ----- */
  tileHtml(r) {
    return `<button class="album-item" data-photo="${r.id}" style="aspect-ratio:${r.w} / ${r.h}" aria-label="${esc(fmtDate(r.at))}에 찍은 사진 보기"><img src="${r.thumb}" alt="" loading="lazy"></button>`;
  },

  albumHtml(list) {
    return `<div class="album">
      <header class="album-head">
        <button class="icon-btn" data-action="close-overlay" aria-label="닫기">‹</button>
        <h2>📷 여우 사진첩</h2>
        <span class="chip" data-album-count>${list.length}장</span>
      </header>
      ${
        list.length
          ? `<div class="album-grid">${list.map((r) => this.tileHtml(r)).join('')}</div>`
          : `<div class="card">${emptyState('📷', '아직 사진이 없어요', '여우 세상에서 📷를 누르면 여우들이 포즈를 잡아요. 찍은 사진은 여기에 모여요.')}</div>`
      }
    </div>`;
  },

  async openAlbum() {
    if (this.album) return;
    let list = [];
    try {
      list = await this.all();
    } catch (e) {
      console.warn('[Photos] the album could not be read', e);
    }
    const ov = (this.album = UI.open(this.albumHtml(list), { full: true, cls: 'is-album', label: '여우 사진첩', onClose: () => (this.album = null) }));
    ov.panel.addEventListener('click', (e) => {
      const tile = e.target.closest('[data-photo]');
      const rec = tile && list.find((r) => r.id === tile.dataset.photo);
      if (rec) this.view(rec);
    });
  },

  /* One picture, large: when and of whom, and the ways to keep it elsewhere or throw it away. */
  view(rec) {
    const url = URL.createObjectURL(rec.blob);
    const name = `${rec.kind === 'four' ? '여우 네컷' : rec.kind === 'house' ? '우리 집' : '여우 사진'} ${dateKey(new Date(rec.at))}.jpg`;
    const share = canShareFile(rec.blob, name);
    const scene = HABITATS.find((h) => h.id === rec.scene);
    const ov = UI.open(
      `<div class="photo-view">
        <img class="pv-img" src="${url}" alt="${rec.names.length ? `${esc(rec.names.join(', '))}의 사진` : '우리 집 사진'}" style="aspect-ratio:${rec.w} / ${rec.h}">
        <p class="pv-cap"><b>${esc(fmtDateLong(rec.at))}</b>${scene ? ` · ${esc(scene.name)}` : rec.kind === 'house' ? ` · ${esc(HOUSE_NAME)}` : ''}${rec.names.length ? `<br>${esc(rec.names.join(' · '))}` : ''}</p>
        <div class="dialog-actions col">
          <a class="btn primary wide" href="${url}" download="${esc(name)}" data-pv-save>⬇️ 내 기기에 저장</a>
          ${share ? '<button class="btn soft wide" data-pv-share>📤 공유하기</button>' : ''}
          <div class="dialog-actions">
            <button class="btn ghost" data-pv-delete>🗑️ 삭제</button>
            <button class="btn soft" data-ov-cancel>닫기</button>
          </div>
        </div>
      </div>`,
      { cls: 'is-dialog is-photo', label: '사진 보기', onClose: () => setTimeout(() => URL.revokeObjectURL(url), 60000) }
    );
    const on = (sel, fn) => {
      const el = $(sel, ov.panel);
      if (el) el.addEventListener('click', fn);
    };
    on('[data-ov-cancel]', () => UI.close(ov));
    on('[data-pv-save]', () => UI.toast('저장 중… 다운로드 폴더를 확인해 보세요 💗', { icon: '⬇️' }));
    on('[data-pv-share]', () => shareFile(rec.blob, name, '여우 사진').catch(() => UI.toast('여기서는 공유할 수 없어요 — 저장을 이용해 주세요.', { icon: '📤' })));
    on('[data-pv-delete]', async () => {
      const ok = await UI.confirm({ icon: '🗑️', title: '이 사진을 지울까요?', text: '지운 사진은 되돌릴 수 없어요.', ok: '삭제', danger: true });
      if (!ok) return;
      await this.remove(rec.id);
      UI.close(ov);
    });
  },

  async remove(id) {
    await DB.del('photos', id);
    if (this.last && this.last.id === id) this.last = undefined;
    this.showLast();
    if (!this.album) return;
    const tile = $(`[data-photo="${id}"]`, this.album.panel);
    if (tile) tile.remove();
    const left = $$('[data-photo]', this.album.panel).length;
    const count = $('[data-album-count]', this.album.panel);
    if (count) count.textContent = `${left}장`;
    if (!left) $('.album', this.album.panel).outerHTML = this.albumHtml([]);
  },
};

Object.assign(Actions, {
  'photo-shoot': () => (Booth.mode === 'four' ? Booth.run() : Photos.shoot()), // (four in a row: js/booth.js)
  'photo-album': () => Photos.openAlbum(),
});

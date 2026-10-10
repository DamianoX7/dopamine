// Pointer-based drag & drop reordering (mouse, pen and touch) via a drag handle.

export function makeSortable(listEl, { itemSelector, handleSelector, onReorder }) {
  function onPointerDown(e) {
    const handle = e.target.closest(handleSelector);
    if (!handle || !listEl.contains(handle) || e.button > 0) return;
    const item = handle.closest(itemSelector);
    if (!item) return;
    e.preventDefault();
    const items = [...listEl.querySelectorAll(itemSelector)];
    const from = items.indexOf(item);
    if (from < 0 || items.length < 2) return;
    const rects = items.map((el) => el.getBoundingClientRect());
    const gap = rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0;
    const shiftBy = rects[from].height + gap;
    const startY = e.clientY;
    let to = from;
    handle.setPointerCapture(e.pointerId);
    item.classList.add('is-dragging');
    listEl.classList.add('is-sorting');

    const move = (ev) => {
      const dy = ev.clientY - startY;
      item.style.transform = `translateY(${dy}px)`;
      const center = rects[from].top + rects[from].height / 2 + dy;
      to = from;
      for (let i = 0; i < rects.length; i++) {
        const mid = rects[i].top + rects[i].height / 2;
        if (i > from && center > mid) to = i;
        if (i < from && center < mid && to === from) { to = i; break; }
      }
      items.forEach((el, i) => {
        if (i === from) return;
        let shift = 0;
        if (from < to && i > from && i <= to) shift = -shiftBy;
        else if (from > to && i >= to && i < from) shift = shiftBy;
        el.style.transform = shift ? `translateY(${shift}px)` : '';
      });
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      items.forEach((el) => { el.style.transform = ''; });
      item.classList.remove('is-dragging');
      listEl.classList.remove('is-sorting');
      if (to !== from) onReorder(from, to);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }

  listEl.addEventListener('pointerdown', onPointerDown);
  return () => listEl.removeEventListener('pointerdown', onPointerDown);
}

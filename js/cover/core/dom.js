// Tiny DOM helpers. User-provided text always goes through text nodes (never innerHTML).

const PROPS = new Set([
  'checked', 'disabled', 'hidden', 'selected', 'multiple', 'textContent', 'htmlFor',
  'tabIndex', 'readOnly', 'min', 'max', 'step', 'type', 'accept', 'placeholder', 'rows',
  'maxLength', 'spellcheck', 'title', 'id', 'name', 'src', 'alt', 'href', 'target', 'rel',
  'download', 'autocomplete', 'inputMode', 'open', 'draggable',
]);

/**
 * Create an element: h('button', { class: 'btn', onClick }, 'Label', childNode, [more]).
 * `html` sets innerHTML and must only be used with trusted static markup (icons).
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  let value;
  if (props) {
    for (const key of Object.keys(props)) {
      const v = props[key];
      if (v === undefined || v === null || v === false) continue;
      if (key === 'class') el.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
      else if (key === 'style') {
        if (typeof v === 'string') el.style.cssText = v;
        else for (const [p, val] of Object.entries(v)) {
          if (p.startsWith('--')) el.style.setProperty(p, val);
          else el.style[p] = val;
        }
      } else if (key === 'dataset') Object.assign(el.dataset, v);
      else if (key === 'html') el.innerHTML = v;
      else if (key === 'ref') v(el);
      else if (key.startsWith('on') && typeof v === 'function') el.addEventListener(key.slice(2).toLowerCase(), v);
      else if (key === 'value') value = v;
      else if (PROPS.has(key)) el[key] = v;
      else el.setAttribute(key, v === true ? '' : String(v));
    }
  }
  append(el, children);
  // value last: <select> needs its options, range inputs need min/max first.
  if (value !== undefined) el.value = value;
  return el;
}

export function append(parent, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false || c === true) continue;
    if (Array.isArray(c)) append(parent, c);
    else if (c instanceof Node) parent.appendChild(c);
    else parent.appendChild(document.createTextNode(String(c)));
  }
  return parent;
}

export function setChildren(el, ...children) {
  el.replaceChildren();
  append(el, children);
  return el;
}

export function toggleClass(el, name, on) {
  el.classList.toggle(name, !!on);
}

/** Replace `el` in the DOM with `next` (if mounted) and return `next`. */
export function swap(el, next) {
  if (el && el.parentNode) el.parentNode.replaceChild(next, el);
  return next;
}

// His figure on the page where he plans a visit (js/him.js: VisitDesk): built as he will come round to her house (me.js,
// with a boy's face and build, a little taller than she is), standing in the house's soft light and turning slowly —
// round under a finger, too. A small canvas of its own, drawn only while it is on the screen.
import * as THREE from '../vendor/three.module.min.js';
import { FUR_SUN } from '../fox/rig.js';
import { LoreleiAnimator } from '../fox/lorelei.js';
import { buildMe, ME_SIZE } from './me.js';

const TALL = 1.06; // (as in him.js)
const SPIN = 0.32; //  how fast he turns by himself (radians a second)

/** His figure in `stage` (an element), as `look` (me.js's LOOK) has him. → { set(look), attach(stage), dispose() } */
export function mountPortrait(stage, look) {
  const canvas = document.createElement('canvas');
  canvas.className = 'him-canvas';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 40);
  const hemi = new THREE.HemisphereLight('#fff7ee', '#d9c6b0', 1.2);
  const key = new THREE.DirectionalLight('#fffaf0', 1.5);
  key.position.set(-1.6, 4.2, 3.4);
  scene.add(hemi, key, key.target);
  // (a soft shadow on the ground under him)
  const shade = new THREE.Mesh(new THREE.CircleGeometry(0.36, 40), new THREE.MeshBasicMaterial({ color: '#7a4a5a', transparent: true, opacity: 0.12, depthWrite: false }));
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = 0.002;
  scene.add(shade);
  // (lit as the people in the house are: js/house/world.js update)
  const lit = new THREE.Color();
  lit.copy(hemi.color).multiplyScalar(hemi.intensity * 0.32).add(new THREE.Color(key.color).multiplyScalar(key.intensity * 0.2));
  const grey = (lit.r + lit.g + lit.b) / 3;
  lit.lerp(new THREE.Color().setScalar(Math.max(grey, 0.6)), 0.45);
  const sun = Math.min(1, Math.max(0.25, key.intensity / 1.6));

  let rig = null;
  let anim = null;
  let yaw = 0.5;
  let turn = SPIN;
  let host = null;
  let raf = 0;
  let last = 0;
  let seen = true;
  let gone = false;
  const pointer = { down: false, x: 0, id: -1 };

  function set(next) {
    if (gone) return;
    if (rig) {
      scene.remove(rig.group);
      rig.dispose();
    }
    rig = buildMe({ ...next, boy: true });
    rig.size = ME_SIZE * TALL;
    rig.group.scale.setScalar(ME_SIZE * TALL);
    rig.light.uLight.value.copy(lit);
    rig.light.uSun.value = sun;
    const was = anim;
    anim = new LoreleiAnimator(rig);
    if (was) anim.time = was.time;
    anim.yaw = yaw;
    anim.setPose('stand', 30);
    anim.snap();
    scene.add(rig.group);
    wake();
  }

  function size() {
    if (!host) return;
    const w = Math.max(2, host.clientWidth);
    const h = Math.max(2, host.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // (all of him, from his shoes to the top of his head, with a little room round)
    const tall = 1.36 * TALL * (ME_SIZE / 1.3);
    const fit = (tall * 0.62) / Math.tan((camera.fov * Math.PI) / 360) / Math.min(1, camera.aspect * 1.25);
    camera.position.set(0, tall * 0.62, fit);
    camera.lookAt(0, tall * 0.5, 0);
    camera.updateProjectionMatrix();
    wake();
  }

  const ro = new ResizeObserver(size);
  const io = new IntersectionObserver((entries) => {
    seen = entries[entries.length - 1].isIntersecting;
    wake();
  });

  function attach(next) {
    if (gone || next === host) return;
    if (host) {
      ro.unobserve(host);
      io.unobserve(host);
    }
    host = next;
    host.prepend(canvas);
    host.classList.add('is-ready');
    ro.observe(host);
    io.observe(host);
    size();
  }

  function frame(now) {
    raf = 0;
    if (gone || !host || !host.isConnected) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    if (!pointer.down) yaw += turn * dt;
    if (anim) {
      anim.yaw = yaw;
      anim.update(dt);
    }
    FUR_SUN.value.copy(key.position).sub(key.target.position).normalize();
    renderer.render(scene, camera);
    if (seen && !document.hidden) raf = requestAnimationFrame(frame);
  }

  function wake() {
    if (!raf && !gone && seen && !document.hidden) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    pointer.down = true;
    pointer.x = e.clientX;
    pointer.id = e.pointerId;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      /* (a pointer that cannot be captured: it still turns him while it is over him) */
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointer.down || e.pointerId !== pointer.id) return;
    yaw += (e.clientX - pointer.x) * 0.012;
    pointer.x = e.clientX;
    wake();
  });
  const up = (e) => {
    if (e.pointerId !== pointer.id) return;
    pointer.down = false;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  const visible = () => wake();
  document.addEventListener('visibilitychange', visible);

  attach(stage);
  set(look);

  return {
    set,
    attach,
    dispose() {
      if (gone) return;
      gone = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', visible);
      if (rig) rig.dispose();
      shade.geometry.dispose();
      shade.material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

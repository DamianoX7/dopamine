// The pet's 3D world, on the whole screen: one renderer and canvas, a camera that looks down
// at a slant like a top-down game, the habitat, the foxes and their things. Tap the ground and
// the fox you are with comes; tap or stroke any fox to pet it (and be with that one); pinch or
// scroll to come closer. Up to a handful of foxes live here together, and the yard grows with
// the family. His letters arrive in the mailbox, and a fox fetches them. In photo mode the
// family poses, and the camera is hers to move. What she buys for the yard — a house, a swing,
// a pond — stands where she puts it, and the foxes use it. When one of her covers plays, a
// radio comes out and they gather behind it and dance. And a fox can be sent off exploring: it
// leaves through the bushes, and hours later comes back with a parcel in its mouth for her.
// The place has seasons and weather (the app keeps their clock): when it rains the foxes run for
// cover — the house, a tree, the barn — and when it is over they play in the puddles.
// Round the yard lies a wide country: a finger on the ground slides the view over it, a tap out
// there sends her fox running to the place, and left to themselves the foxes go roaming in it.
// And the foxes have somebody: Lorelei lives in the yard with them (lorelei.js, keeper.js) — she
// strokes them, it is she who fills the bowl and throws the ball, and she is in their picture.
// On a day of theirs she has a present: a parcel she puts down before her, and a fox comes out of it.
// And on Halloween the yard dresses up: jack-o'-lanterns round it, bats over the woods, the foxes in costume, Lorelei
// in a witch's hat — and on the evening of it, the light of a late autumn sunset.
import * as THREE from '../vendor/three.module.min.js';
import { buildFox, FUR_SUN } from './rig.js';
import { FoxAnimator } from './animator.js';
import { Brain, PAD, ASIDE } from './brain.js';
import { buildLorelei, LoreleiAnimator } from './lorelei.js';
import { Keeper } from './keeper.js';
import { buildHabitat } from './scenes.js';
import { speciesOf } from './species.js';
import { makeBowl, makeBall, makeBed, makeMic, makeMailbox, makeLetter, makeGift, makeAccessory, makeRadio, makePresent, makeOwnerHat, makeLantern } from './props.js';
import { makeDecor } from './decor.js';
import { Sky } from './sky.js';
import { beatAt, curveAt, pickMove } from './dance.js';
import { V, clamp, TAU, glyphMaterial, disposeTree } from './kit.js';

const FOV = 30;
const TAN = Math.tan((FOV * Math.PI) / 360);
const PITCH = (56 * Math.PI) / 180; //      how steeply the camera looks down
const PITCH_CLOSE = (44 * Math.PI) / 180; // …and when it comes in close, in the shop
const PITCH_PHOTO = (40 * Math.PI) / 180; // …and when she starts taking pictures (from there she tilts it herself)
// each fox its own pose, for the "all different" picture
const MIXED = ['sit', 'smile', 'lie', 'proud', 'bow'];
const ZOOM_MIN = 0.55;
/** Has this fox left the yard for cover (under a tree, in the barn)? The view stands back for it. */
const HIDING = (f) => f.brain.stray && (f.brain.doing === 'takeCover' || f.brain.doing === 'sleep');
const SHADE = 10; //                      how far round where she is looking things throw shadows
const NEAR = 0.18; //                     how near the middle of a fox comes to what stands out in the country, on its way round it
const ZOOM_MAX = 2.4;
const PRINTS = 160;
// Halloween: where the jack-o'-lanterns stand, round the edge of the yard (0 = the front, towards you; π = the back)
const LANTERNS = [2.5, -2.45, 1.5, -1.42, 0.66];
const LANTERN_R = 0.085;
// where the family stands when the world is first shown (offsets from the middle of the yard, and which way they face)
const HOMES = [[-0.5, -0.2, 0.6], [0.5, 0.05, -0.5], [-0.05, -0.6, 0.2], [0.95, -0.4, -0.9], [-1.0, 0.15, 0.9], [0.1, 0.4, 0]];
// A fox can always walk between any two things in the yard: they stand a fox's width apart
// (twice the room the middle of the largest fox needs from a thing, and a little). So no
// arrangement of hers can shut a way. At the edge of the yard a thing may stand, and hang over
// it: nobody has to get round the back of it there.
const BIG = 1.04; //                        the size of the largest fox there is
const GAP = 2 * PAD * BIG + 0.08; //        between two of her things
const GAP_OWN = (PAD + ASIDE) * BIG + 0.08; // between one of hers and one of the foxes' own (the bowl, the bed…) or the scenery
const EDGE = 0.5; //                        how much of a thing may hang over the edge of the yard (of each of its circles)
// The yard grows for her things: by the ground they take, times ROOMY (the room between them
// has to come from somewhere) — and by ROOM as soon as there is one, so that it can stand in
// more than one place (the bowl, the bed, the mailbox and the dance floor leave little, else).
const ROOMY = 2.2;
const ROOM = 0.9; // (in yards for a lone fox)
// the foxes' places when they dance: behind the radio (x to the side, z back from it), staggered so that they can turn round
const STAGE = [[0, 0.72], [-0.9, 1.28], [0.9, 1.28], [-0.45, 1.88], [0.45, 1.88], [0, 2.44]];
// how far a line-up may be moved as a whole to find everyone in it a place to stand: the nearest first, rather sideways than back or forth
const SHIFTS = [];
for (let dx = -1.6; dx <= 1.601; dx += 0.2) for (let dz = -1.2; dz <= 1.201; dz += 0.2) SHIFTS.push([Math.round(dx * 10) / 10, Math.round(dz * 10) / 10]);
SHIFTS.sort((p, q) => Math.hypot(p[0], 1.3 * p[1]) - Math.hypot(q[0], 1.3 * q[1]));
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const _v = V();
const _w = V();
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _plane = new THREE.Plane(V(0, 1, 0), 0);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _c = new THREE.Color();
const _sa = [];
const _sb = [];
const _pa = V();
const _pb = V();

/** Emoji that float up and fade: hearts, notes, Zzz, sparkles, crumbs. */
class Fx {
  constructor(scene) {
    this.scene = scene;
    this.live = [];
  }

  emit(glyph, at, { n = 1, spread = 0.08, rise = 0.5, life = 1.2, size = 0.14, drift = 0.15, gravity = 0 } = {}) {
    for (let i = 0; i < n; i++) {
      const sprite = new THREE.Sprite(glyphMaterial(glyph).clone());
      sprite.position.set(at.x + (Math.random() - 0.5) * spread * 2, at.y + Math.random() * spread, at.z + (Math.random() - 0.5) * spread * 2);
      sprite.scale.setScalar(size);
      sprite.renderOrder = 50;
      this.scene.add(sprite);
      this.live.push({ sprite, t: -i * 0.07, life, size, vx: (Math.random() - 0.5) * drift * 2, vy: rise * (0.8 + Math.random() * 0.4), gravity });
    }
  }

  update(dt) {
    this.live = this.live.filter((p) => {
      p.t += dt;
      if (p.t < 0) {
        p.sprite.visible = false;
        return true;
      }
      p.sprite.visible = true;
      const k = p.t / p.life;
      if (k >= 1) {
        this.scene.remove(p.sprite);
        p.sprite.material.dispose();
        return false;
      }
      p.vy -= p.gravity * dt;
      p.sprite.position.x += p.vx * dt;
      p.sprite.position.y += p.vy * dt;
      p.sprite.material.opacity = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4);
      p.sprite.scale.setScalar(p.size * (0.7 + 0.5 * Math.min(1, k * 4)));
      return true;
    });
  }

  clear() {
    this.live.forEach((p) => {
      this.scene.remove(p.sprite);
      p.sprite.material.dispose();
    });
    this.live = [];
  }
}

export class World {
  constructor(host) {
    this.host = host;
    this.time = 0;
    this.state = { scene: null, season: null, night: false, mood: 'idle', reduce: false };
    this.stage = null;
    this.onScreen = true;
    this.raf = 0;
    this.frames = 0;
    this.slowFrames = 0;
    this.graceUntil = 0;
    this.quality = 0; // 0 = full; each step up trades looks for speed

    const canvas = (this.canvas = document.createElement('canvas'));
    canvas.className = 'fox-canvas';
    // The picture has no see-through places — but three.js asks for a canvas that can have them whatever `alpha` says,
    // and the fur writes there how much of a pixel a strand covers: along the edge of every strand the page behind the
    // canvas showed through, a pale outline round each one, and the foxes looked wiry. So: a canvas of our own asking.
    const context = canvas.getContext('webgl2', { alpha: false, antialias: true, depth: true, stencil: false, powerPreference: 'default' });
    const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: false, powerPreference: 'default' }));
    this.coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(this.pixelRatio);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color('#8cc462');
    this.camera = new THREE.PerspectiveCamera(FOV, 4 / 3, 0.5, 80);
    this.camTarget = V(0, 0.15, -0.3);
    this.camDist = 6;
    this.unitPpu = 110; //   pixels per world unit at the middle of the view for one fox's yard, before zooming
    this.basePpu = 110; //   …for the yard as large as it is now
    this.ppu = 0; //         …eased (0 = not shown yet)
    this.zoom = 1; //        what she chose (pinch, wheel)
    this.zoomNow = 1; //     …eased
    this.pitch = PITCH;
    this.showcaseOn = false; // the shop is open: the foxes pose, the camera comes close
    this.photoOn = false; //    she is taking pictures: the family poses, and she moves the camera
    this.pose = 'sit'; //       …how they pose ('mix' = each its own)
    this.poseSeed = 0;
    this.orbit = { yaw: 0, pitch: PITCH_PHOTO }; // where she turned and tilted the camera to
    this.yawNow = 0;
    this.inset = { right: 0, bottom: 0 }; // how much of the view the shop covers (px)
    this.offset = { x: 0, y: 0 };
    this.free = null; //        where she has slid the view to, { x, z } — otherwise it stays with her fox
    this.fling = null; //       …and how fast it is still gliding on after her finger let go, { x, z } a second

    this.hemi = new THREE.HemisphereLight('#ffffff', '#b6d695', 1.9);
    this.sun = new THREE.DirectionalLight('#fff0d4', 2.3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.setScalar(this.coarse ? 1536 : 3072);
    Object.assign(this.sun.shadow.camera, { left: -SHADE, right: SHADE, top: SHADE, bottom: -SHADE, near: 1, far: 46 });
    this.sunOff = V(-7, 14, 4); // where the sun stands, seen from where she is looking (see placeSun)
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.02;
    this.sun.target.position.set(0, 0, -0.3);
    scene.add(this.hemi, this.sun, this.sun.target);
    this.makeEnvironment();

    // the foxes' things
    this.things = { bowl: makeBowl(), ball: makeBall(), bed: makeBed(), mic: makeMic(), mailbox: makeMailbox(), radio: makeRadio() };
    Object.values(this.things).forEach((t) => scene.add(t.object));
    this.things.mic.object.visible = false;
    // his letters: 'box' = one waits in the mailbox, 'fetching' = a fox is on its way to it, 'fox' = a fox has it in its mouth
    this.mail = 'none';
    this.letter = null; //   { fox, object } while it is carried
    this.courier = null; //  the fox that went for it
    this.mailWait = 0;
    this.ballBusy = null; // the fox that has the ball for this go
    this.ballIdle = 0;
    this.feast = false; //   the bowl was filled and is being eaten
    this.bedFox = null; //   who has the bed tonight
    this.denFox = null; //   …and who the house (if she has put one in the yard)
    this.noDen = false; //   …unless there was no way in
    // what she has put in the yard (decor.js), and the ground it takes: circles in the world, { x, z, r, h, item }
    this.decor = [];
    this.decorSolids = [];
    this.stamp = 0; //       counts up whenever something in the yard moves
    this.editOn = false; //  the shop is open on the yard: a touch moves its things about
    this.held = null; //     …the one she has picked
    this.drag = null; //     …and is moving right now: { item, dx, dz, moved, grabbed }
    this.tune = null; //     the cover that is playing, and where the foxes are in it (see setTune)
    this.lines = {}; //      the foxes' places when they line up — for a picture, in the shop (see lineUp)
    // expeditions: foxes that live here but are out exploring ([{ id, grown }] — the yard is kept as it is for them),
    // those on their way out of the yard right now, and the parcel one has brought home: { fox, object } until she takes it
    this.absent = [];
    this.leaving = [];
    this.gift = null;
    // Lorelei's present (see present): the parcel; its story while it is told — { step, t, ready, speaking, shown, down, at, lid, fox };
    // and where the fox that is new with the next apply() is to appear — out of it, not in from the side: { id, x, z, yaw }
    this.parcel = makePresent();
    scene.add(this.parcel.object);
    this.gifting = null;
    this.spawn = null;
    this.hailing = null; // Lorelei would like a word (see hail): { bye, now } while she waits to be tapped
    // Halloween (see setHalloween): { dusk } while it is on; the jack-o'-lanterns round the yard, { object, update, bx, bz }
    // (where they stand, in the measure of a lone fox's yard); how much they glow; when the next bats fly over
    this.spooky = null;
    this.lanterns = [];
    this.lanternsIn = null;
    this.glow = 0;
    this.batsIn = 3;

    // where you tapped
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.135, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.y = 0.012;
    this.marker.renderOrder = 5;
    scene.add(this.marker);
    this.markerT = 9;

    // a soft ring under the fox she is with (only where there are several to choose from)
    this.halo = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: '#fff3fa', transparent: true, opacity: 0, depthWrite: false }));
    this.halo.rotation.x = -Math.PI / 2;
    this.halo.position.y = 0.01;
    this.halo.renderOrder = 4;
    scene.add(this.halo);

    // …and one round the thing in the yard she is moving
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 56), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.014;
    this.ring.renderOrder = 4;
    scene.add(this.ring);

    // paw prints in sand and snow (they multiply the ground darker, then fade back to white)
    const printGeo = new THREE.CircleGeometry(1, 10);
    printGeo.rotateX(-Math.PI / 2);
    this.prints = new THREE.InstancedMesh(printGeo, new THREE.MeshBasicMaterial({ blending: THREE.MultiplyBlending, transparent: true, depthWrite: false, premultipliedAlpha: true }), PRINTS);
    this.prints.frustumCulled = false;
    this.prints.renderOrder = 2;
    this.printList = [];
    this.printNext = 0;
    scene.add(this.prints);
    this.clearPrints();

    this.fx = new Fx(scene);
    this.sky = new Sky(this); // the weather: what falls, the light under it, the puddles it leaves (sky.js)
    this.lit = null; //         the light of the habitat as it is by day or by night, before the weather dims it
    this.cover = null; //       the foxes' places out of the rain: { key, at: fox → place } (see coverFor)
    this.foxes = []; //   { id, rig, anim, brain, worn, accessories, baby, guest, wet } — in the app's order
    this.owner = null; // Lorelei, the girl they belong to: { id, rig, anim, brain } — a creature of the yard like them, but never one of `foxes`
    this.serving = 0; //  when she set off for the bowl with the food (there is nothing in it until she tips it in: fillBowl)
    this.pitching = 0; // …and when she drew back her arm with the ball (until it flies: throwBall)
    this.lead = null; //  the fox she is with: the camera stays near it, a tap on the ground calls it
    this.focus = null; // the fox the shop is about (one being tried out, otherwise the lead)
    this.yard = 1; //     how much larger than a lone fox's yard the world is
    this.env = null;
    this.thumbs = new Map();
    this.bubble = { el: null, until: 0, fox: null };
    this.pointer = { down: false, x: 0, y: 0, t: 0, fox: null, lastPet: 0, lastX: 0, lastY: 0, pan: false };
    this.fingers = new Map(); // pointers that are down (two = pinch)
    this.pinch = null;

    this.makeOwner();

    this.tick = this.tick.bind(this);
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('pointerup', (e) => this.onUp(e));
    canvas.addEventListener('pointercancel', (e) => this.onUp(e, true));
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.setZoom(this.zoom * Math.exp(-e.deltaY * 0.0014));
      },
      { passive: false }
    );
    canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
    canvas.addEventListener('webglcontextrestored', () => this.wake());
    document.addEventListener('visibilitychange', () => this.wake());
  }

  /** Lorelei: built once, and at home in every habitat. */
  makeOwner() {
    const rig = buildLorelei();
    const anim = new LoreleiAnimator(rig);
    const me = (this.owner = { id: '~owner', rig, anim, brain: null, baby: false, guest: false, wet: 0, isOwner: true });
    me.brain = new Keeper(this, me);
    anim.onStep = (p) => this.footfall(p, me);
    this.scene.add(rig.group);
    // her witch's hat, for Halloween (props.js)
    const hat = (me.hat = makeOwnerHat(rig));
    hat.visible = false;
    rig.bones.head.add(hat);
  }

  /** A tiny lit room to reflect in the shiny things (eyes, crown, sunglasses, the bowl). */
  makeEnvironment() {
    const room = new THREE.Scene();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 12), new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }));
    const pos = shell.geometry.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const top = new THREE.Color('#dfeeff');
    const mid = new THREE.Color('#fff4e2');
    const low = new THREE.Color('#6f6a5a');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 10;
      if (y > 0) c.copy(mid).lerp(top, y);
      else c.copy(mid).lerp(low, Math.min(1, -y * 2.5));
      col.set([c.r, c.g, c.b], i * 3);
    }
    shell.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    room.add(shell);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.6, 5) }));
    lamp.position.set(-5, 7, 3);
    room.add(lamp);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(room, 0.03).texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();
    shell.geometry.dispose();
    shell.material.dispose();
    lamp.geometry.dispose();
    lamp.material.dispose();
  }

  // ---------------------------------------------------------------- mounting & the loop

  mount(stage, { greet = false } = {}) {
    if (this.stage === stage) return;
    this.unmount();
    this.stage = stage;
    stage.prepend(this.canvas);
    this.bubble.el = stage.querySelector('[data-fox-bubble]');
    if (!this.bubble.el) {
      this.bubble.el = document.createElement('div');
      this.bubble.el.className = 'fox-bubble';
      this.bubble.el.dataset.foxBubble = '';
      this.bubble.el.hidden = true;
      stage.appendChild(this.bubble.el);
    }
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(stage);
    this.io = new IntersectionObserver((entries) => {
      this.onScreen = entries[entries.length - 1].isIntersecting;
      this.wake();
    });
    this.io.observe(stage);
    this.onScreen = true;
    this.ppu = 0;
    this.mailWait = 0;
    this.grace(1500);
    this.resize();
    if (greet && this.state.mood !== 'sleepy') {
      this.foxes.forEach((f) => f.brain.do('greet'));
      this.owner.brain.do('helloYou', null, 1.3); // …and Lorelei waves
    }
    if (this.gift && this.state.mood !== 'sleepy') this.gift.fox.brain.then('bringGift');
    this.wake();
  }

  unmount() {
    if (!this.stage) return;
    this.ro.disconnect();
    this.io.disconnect();
    this.canvas.remove();
    this.stage.classList.remove('is-night');
    this.stage = null;
    this.bubble.el = null;
    this.pointer.down = false;
    this.fingers.clear();
    this.pinch = null;
    this.lookBack();
    this.setMode(null);
    this.photo(false);
    this.endPresent();
    this.unhail();
    this.leaving.splice(0).forEach((f) => this.forget(f)); // (one that was on its way out is gone by the time she looks again)
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  resize() {
    if (!this.stage) return;
    const w = Math.max(2, this.stage.clientWidth);
    const h = Math.max(2, this.stage.clientHeight);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.fitView();
    this.placeCamera();
    this.draw();
  }

  /**
   * How large the world is drawn: a fox about as large on a phone held upright as on a wide
   * monitor, and — a little smaller — the whole of a bigger family's yard still in view.
   */
  fitView() {
    if (!this.stage) return;
    const w = Math.max(2, this.stage.clientWidth);
    const h = Math.max(2, this.stage.clientHeight);
    const k = this.yard;
    // (a little more than the yard goes in: some of the country round it shows from the start)
    this.unitPpu = clamp(Math.min(w, h) / 3.8, 98, 250);
    this.basePpu = clamp(Math.min(w / (3.8 * k), h / (3.8 * Math.sqrt(k))), 98 / Math.sqrt(k), 250);
    if (!this.ppu) this.ppu = this.basePpu;
  }

  /** The foxes' fur is drawn for how large they are on the screen right now (rig.js: tuneFur). */
  tuneFur() {
    const pxPerUnit = (this.ppu || this.basePpu) * this.zoomNow * this.renderer.getPixelRatio();
    this.foxes.forEach((f) => f.rig.tuneFur(pxPerUnit));
    this.furAt = pxPerUnit;
  }

  /** Fur layers: the fox she is looking at gets the most, and a big family shares what the device can draw. */
  tuneShells() {
    const q = this.quality;
    const main = q >= 3 ? 6 : q >= 1 ? 9 : 16;
    const rest = q >= 3 ? 4 : q >= 1 || this.foxes.length > 3 ? 6 : 9;
    const star = (this.showcaseOn && this.focus) || this.lead;
    const all = this.photoOn && (q >= 1 || this.foxes.length > 3) ? 9 : main; // posing for a picture: everyone alike
    this.foxes.forEach((f) => f.rig.setShells(this.photoOn ? all : f === star ? main : rest));
  }

  setZoom(z) {
    this.zoom = clamp(z, ZOOM_MIN, ZOOM_MAX);
    this.wake();
  }

  /**
   * The shop is open — or closed again (null). On its foxes, outfits and habitats ('shop') the
   * foxes pose and the camera comes close; on the yard ('yard') all of the yard shows, and a
   * touch moves its things. `inset` = how much of the view the shop covers (px): what matters
   * is kept in the part it leaves free.
   */
  setMode(mode, inset = {}) {
    this.inset = { right: (mode && inset.right) || 0, bottom: (mode && inset.bottom) || 0 };
    const show = mode === 'shop';
    const edit = mode === 'yard';
    if (show !== this.showcaseOn) {
      this.showcaseOn = show;
      this.foxes.forEach((f) => {
        if (show) f.brain.do('model');
        else if (f.brain.doing === 'model') f.brain.script = null;
      });
      if (show) this.owner.brain.do('standBy');
      else if (this.owner.brain.doing === 'standBy') this.owner.brain.script = null;
      this.tuneShells();
    }
    if (edit !== this.editOn) {
      this.editOn = edit;
      this.drag = null;
      this.pointer.down = false;
      this.canvas.style.cursor = '';
    }
    if (mode) this.lookBack();
    this.wake();
  }

  /** How far out the camera has to be for the whole yard to show in the part of the view the shop leaves free. */
  fitZoom() {
    const b = this.env.bounds;
    const w = this.stage.clientWidth - this.inset.right;
    const h = this.stage.clientHeight - this.inset.bottom;
    return Math.min(w / (2.16 * b.rx), (h - 96) / (1.66 * b.rz + 0.7)) / this.basePpu;
  }

  placeCamera() {
    if (!this.stage) return;
    const w = this.stage.clientWidth;
    const h = Math.max(2, this.stage.clientHeight);
    const cam = this.camera;
    const ppu = (this.ppu || this.basePpu) * this.zoomNow;
    this.camDist = h / ppu / (2 * TAN);
    const c = this.camTarget;
    const flat = Math.cos(this.pitch) * this.camDist;
    cam.position.set(c.x + Math.sin(this.yawNow) * flat, c.y + Math.sin(this.pitch) * this.camDist, c.z + Math.cos(this.yawNow) * flat);
    cam.lookAt(c);
    // shift the picture so its middle sits in the part of the screen the shop leaves free
    if (Math.abs(this.offset.x) > 0.5 || Math.abs(this.offset.y) > 0.5) cam.setViewOffset(w, h, this.offset.x, this.offset.y, w, h);
    else if (cam.view && cam.view.enabled) cam.clearViewOffset();
    else cam.updateProjectionMatrix();
    if (Math.abs((ppu * this.renderer.getPixelRatio()) / (this.furAt || 1) - 1) > 0.04) this.tuneFur();
  }

  wake() {
    if (this.raf || !this.stage || document.hidden || !this.onScreen) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  tick(now) {
    this.raf = 0;
    if (!this.stage || document.hidden || !this.onScreen) return;
    const real = (now - this.last) / 1000;
    this.last = now;
    this.update(Math.min(0.05, Math.max(0, real)));
    this.draw();
    this.watchSpeed(real, now);
    this.raf = requestAnimationFrame(this.tick);
  }

  /**
   * On a device that can't keep up, give up sharpness first and fur layers second. Only a
   * steady crawl counts: single long frames (a picture being drawn for the shop, a new
   * habitat being built) are left out.
   */
  watchSpeed(real, now) {
    if (real > 0.1 || now < this.graceUntil || this.quality >= 3) return;
    this.frames++;
    if (real > 0.034) this.slowFrames++;
    if (this.frames < 150) return;
    const crawling = this.slowFrames > 95;
    this.frames = this.slowFrames = 0;
    if (!crawling) return;
    this.quality++;
    if (this.quality === 1) this.pixelRatio = Math.min(this.pixelRatio, 1.5);
    if (this.quality === 2) this.pixelRatio = 1;
    this.tuneShells();
    this.resize();
  }

  /** Give the frame counter a moment after something heavy. */
  grace(ms = 900) {
    this.graceUntil = performance.now() + ms;
    this.frames = this.slowFrames = 0;
  }

  draw() {
    this.renderer.render(this.scene, this.camera);
  }

  // ---------------------------------------------------------------- what is shown

  /**
   * Bring the world in line with the game: `next` = { foxes: [{ id, worn, grown, guest }], away:
   * [{ id, grown }], gift, lead, focus, things, decor: [{ id, x, z, r, trial }], held, tune:
   * { id, on }, mail, scene, season, sky: { kind, level, wet }, night, mood, reduce, halloween } — who is in
   * the yard wearing what (and how far a kit has grown), who is out exploring, which fox has
   * come back with a parcel, which one she is with, what stands in the yard and where (and
   * which of it she is moving), which cover is playing, whether a letter is waiting, where, at
   * what time of year and in what weather, day or night, in what mood — and whether it is Halloween
   * (halloween: { dusk } or null).
   */
  apply(next) {
    const s = this.state;
    const season = next.season || null;
    const sceneChanged = next.scene !== s.scene || season !== s.season;
    const nightChanged = sceneChanged || next.night !== s.night;
    this.state = { scene: next.scene, season, night: next.night, mood: next.mood, reduce: next.reduce };
    this.night = next.night;
    if (next.mood !== 'sleepy') {
      this.bedFox = this.denFox = null;
      this.noDen = false;
    }
    if (sceneChanged) this.setHabitat(next.scene, season, next.scene === s.scene);
    this.absent = next.away || [];
    this.setFoxes(next.foxes);
    this.setDecor(next.decor || [], next.held);
    this.things.mic.object.visible = next.things.includes('mic');
    this.lead = this.byId(next.lead) || this.foxes[0] || null;
    this.focus = this.byId(next.focus) || this.lead;
    if (next.mail && this.mail === 'none') this.setMail('box');
    else if (!next.mail && this.mail !== 'none') this.setMail('none');
    const was = this.yard;
    this.layout();
    this.homeDecor();
    if (this.yard !== was) {
      // (everyone stays where they stand, like her things: the yard has grown round them — or come in, and its edge brings them along)
      this.clearPrints();
      this.fitView();
    }
    this.setTune(next.tune);
    const dusk = this.setHalloween(next.halloween || null);
    // a fox that is back from an expedition has a parcel for her
    const bringer = this.byId(next.gift);
    const had = this.gift && this.gift.fox;
    this.setGift(bringer);
    if (bringer && bringer !== had) this.homecoming(bringer);
    this.foxes.forEach((f) => (f.fresh = false));
    if (nightChanged || dusk) this.setLight();
    // the weather: as it is, at once, while nobody is looking (or in another place) — else it turns before her eyes
    const turned = this.sky.set(next.sky, !this.stage || sceneChanged);
    if (turned && this.stage && !sceneChanged) this.weatherTurned();
    if (this.stage) this.draw();
  }

  byId(id) {
    return this.foxes.find((f) => f.id === id) || null;
  }

  /** Move house — or (`same`) the same place in another season: then everyone stays where they are. */
  setHabitat(id, season = null, same = false) {
    if (this.env) {
      this.scene.remove(this.env.group);
      this.env.dispose();
    }
    this.fx.clear();
    this.clearPrints();
    this.grace();
    same = same && !!this.env;
    this.clearLanterns(false); // (they are placed afresh in the new place: see setHalloween)
    const env = (this.env = buildHabitat(id, season));
    // as it was built, for one fox; scaleYard() makes room for more
    env.base = {
      bounds: { ...env.bounds },
      range: { ...env.range },
      wilds: env.wilds.concat(env.obstacles),
      spots: Object.fromEntries(Object.entries(env.spots).map(([k, p]) => [k, p.clone()])),
      obstacles: env.obstacles.map((o) => ({ ...o })),
      shelters: env.shelters,
    };
    this.scene.add(env.group);
    this.cover = null;
    this.scaleYard();
    if (same) return;
    this.lookBack();
    this.hideBall();
    this.feast = false;
    this.serving = this.pitching = 0;
    this.things.bowl.setLevel(0);
    this.camTarget.set(env.bounds.cx, 0.15, env.bounds.cz);
    // everyone starts somewhere sensible in the new place (in the shop: where they were sitting)
    this.decor.forEach((it) => (it.users.length = 0));
    this.foxes.forEach((f, i) => {
      f.brain.using = null;
      this.sendHome(f, i);
      if (this.showcaseOn) {
        f.anim.pos.copy(this.modelSpot(f));
        f.anim.yaw = 0;
        f.anim.snap();
      }
      f.brain.reset();
    });
    // …and Lorelei: at the back of the yard, to one side
    const me = this.owner;
    me.anim.pos.copy(me.brain.randomPoint(0.78)); // (wherever there is room: not on the bed, not on a fox)
    me.anim.yaw = 0.5;
    me.anim.speed = 0;
    me.anim.snap();
    me.brain.reset();
  }

  /** Stretch the habitat (and everything that is placed by it) to the size of the yard. */
  scaleYard() {
    const env = this.env;
    const k = this.yard;
    const B = env.base;
    env.group.scale.setScalar(k);
    Object.assign(env.bounds, { cx: B.bounds.cx * k, cz: B.bounds.cz * k, rx: B.bounds.rx * k, rz: B.bounds.rz * k });
    env.range = { cx: B.range.cx * k, cz: B.range.cz * k, rx: B.range.rx * k, rz: B.range.rz * k };
    env.wilds = B.wilds.map((o) => ({ x: o.x * k, z: o.z * k, r: o.r * k }));
    env.grid = null; // (the ways through the country are looked for afresh: see countryGrid)
    for (const key in B.spots) env.spots[key].copy(B.spots[key]).multiplyScalar(k);
    env.obstacles = B.obstacles.map((o) => ({ x: o.x * k, z: o.z * k, r: o.r * k }));
    env.shelters = B.shelters.map((s) => ({
      via: s.via ? { x: s.via.x * k, z: s.via.z * k } : null,
      roof: s.roof ? { x: s.roof.x * k, z: s.roof.z * k, r: s.roof.r * k } : null,
      spots: s.spots.map((p) => ({ x: p.x * k, z: p.z * k, yaw: p.yaw, lie: !!p.lie })),
    }));
    const { bowl, bed, mic, mailbox } = this.things;
    bowl.object.position.copy(env.spots.bowl);
    bed.object.position.copy(env.spots.bed);
    mic.object.position.copy(env.spots.mic);
    mailbox.object.position.copy(env.spots.mail);
    // a family eats sitting all round the bowl and sleeps round the bed, so theirs stand further in from the edge
    const n = this.foxes.length + this.absent.length;
    if (n > 1) {
      const b = env.bounds;
      const inBy = Math.max(0.55, 1 - 0.075 * n);
      bowl.object.position.set(b.cx + (env.spots.bowl.x - b.cx) * 0.62, 0, b.cz + (env.spots.bowl.z - b.cz) * 0.62);
      bed.object.position.set(b.cx + (env.spots.bed.x - b.cx) * inBy, 0, b.cz + (env.spots.bed.z - b.cz) * inBy);
    }
    // the radio stands at the front, where the foxes come to meet her
    this.things.radio.object.position.set(env.spots.front.x, 0, env.spots.front.z + 0.12);
    for (const l of this.lanterns) l.object.position.set(l.bx * k, 0, l.bz * k);
    this.placeDecor();
  }

  sendHome(fox, i) {
    const b = this.env.bounds;
    const [x, z, yaw] = HOMES[i % HOMES.length];
    fox.anim.pos.copy(this.clearOf({ x: b.cx + x, z: b.cz + z }, 0.22 * fox.rig.scale));
    fox.anim.yaw = yaw;
    fox.anim.speed = 0;
    fox.anim.snap();
  }

  /** Who lives here now, and what each one wears. Foxes that are new while she watches come running in. */
  setFoxes(list) {
    const ids = list.map((f) => f.id);
    this.foxes.filter((f) => !ids.includes(f.id)).forEach((f) => this.removeFox(f));
    list.forEach((def) => {
      let fox = this.byId(def.id) || this.turnBack(def.id);
      if (!fox) {
        fox = this.addFox(def.id, def.grown || 0);
        fox.fresh = true; // (new in the yard with this — see homecoming)
      }
      if (fox.grown !== (def.grown || 0)) fox = this.remake(fox, def.id, def.grown || 0); // a kit has grown a little
      fox.guest = !!def.guest;
      if (fox.worn.join() !== def.worn.join()) this.setWorn(fox, def.worn);
    });
    this.foxes.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    this.stamp++;
  }

  makeFox(id, grown) {
    const rig = buildFox(id, { grown });
    const anim = new FoxAnimator(rig);
    const fox = { id, grown, rig, anim, brain: null, worn: [], accessories: [], baby: !!rig.species.baby, guest: false, wet: 0 };
    fox.brain = new Brain(this, fox);
    anim.onStep = (p) => this.footfall(p, fox);
    return fox;
  }

  addFox(id, grown = 0) {
    this.grace();
    const fox = this.makeFox(id, grown);
    const { rig, anim } = fox;
    const walksIn = !!this.stage && this.foxes.length > 0;
    const born = this.spawn && this.spawn.id === id ? this.spawn : null;
    this.foxes.push(fox);
    this.scene.add(rig.group);
    if (born) {
      // out of Lorelei's parcel
      this.spawn = null;
      if (this.gifting) this.gifting.fox = fox;
      anim.pos.set(born.x, 0, born.z);
      anim.yaw = born.yaw;
      anim.snap();
      fox.brain.do('unwrapped');
    } else if (walksIn) {
      // from the side of the yard, facing in
      const b = this.env.bounds;
      const side = Math.random() < 0.5 ? 1 : -1;
      const a = side * (Math.PI / 2 + (Math.random() - 0.5) * 0.7);
      anim.pos.set(b.cx + Math.sin(a) * b.rx, 0, b.cz + Math.cos(a) * b.rz);
      anim.yaw = Math.atan2(b.cx - anim.pos.x, b.cz - anim.pos.z);
      anim.snap();
      fox.brain.do(this.showcaseOn ? 'model' : 'arrive');
    } else if (this.env) this.sendHome(fox, this.foxes.length - 1);
    anim.update(0.016);
    return fox;
  }

  /**
   * The same fox in a new body, where it stands: a kit that has grown a little (`grown`), or
   * one that has grown up (`id` is then the grown fox it has become).
   */
  remake(old, id, grown) {
    this.grace();
    const fox = this.makeFox(id, grown);
    fox.guest = old.guest;
    fox.wet = old.wet;
    fox.anim.pos.copy(old.anim.pos);
    fox.anim.yaw = old.anim.yaw;
    fox.anim.snap();
    this.scene.add(fox.rig.group);
    this.foxes[this.foxes.indexOf(old)] = fox;
    for (const key of ['lead', 'focus', 'bedFox', 'denFox', 'courier']) if (this[key] === old) this[key] = fox;
    const carried = this.letter && this.letter.fox === old;
    const parcel = this.gift && this.gift.fox === old;
    this.forget(old);
    this.setWorn(fox, old.worn);
    if (carried) this.setMail('fox', fox);
    if (parcel) this.setGift(fox);
    fox.anim.update(0.016);
    this.fx.emit('✨', fox.anim.headPoint(V()), { n: 9, spread: 0.3, rise: 0.55, life: 1.2, size: 0.13 });
    fox.brain.do(this.showcaseOn ? 'model' : this.photoOn ? 'strike' : 'joy');
    return fox;
  }

  removeFox(fox) {
    this.fx.emit('✨', fox.anim.headPoint(V()), { n: 6, spread: 0.2, rise: 0.45, life: 0.9, size: 0.12 });
    this.foxes = this.foxes.filter((f) => f !== fox);
    if (this.lead === fox) this.lead = null;
    if (this.focus === fox) this.focus = null;
    // a letter it had (or was going for) is back in the mailbox
    if ((this.letter && this.letter.fox === fox) || (this.mail === 'fetching' && this.courier === fox)) this.setMail('box');
    this.forget(fox);
  }

  /** Take a fox's body out of the scene. */
  forget(fox) {
    if (this.letter && this.letter.fox === fox) {
      this.letter.object.removeFromParent();
      disposeTree(this.letter.object);
      this.letter = null;
    }
    if (this.gift && this.gift.fox === fox) {
      this.gift.object.removeFromParent();
      disposeTree(this.gift.object);
      this.gift = null;
    }
    this.scene.remove(fox.rig.group);
    fox.accessories.forEach((a) => disposeTree(a.object));
    fox.rig.dispose();
    this.unclaim(fox);
    if (this.ballBusy === fox) this.ballBusy = null;
    if (this.bubble.fox === fox) this.hush();
    if (this.pointer.fox === fox) this.pointer.fox = null;
  }

  /** The app renamed a fox (a kit that grew up is a grown fox of its kind from now on). */
  rename(from, to) {
    const fox = this.byId(from);
    if (fox) fox.id = to;
  }

  setWorn(fox, list) {
    fox.accessories.forEach((a) => {
      a.object.removeFromParent();
      disposeTree(a.object);
    });
    fox.accessories = [];
    fox.worn = list.slice();
    list.forEach((id) => {
      const acc = makeAccessory(id, fox.rig);
      if (!acc) return;
      fox.rig.bones[acc.bone].add(acc.object);
      fox.accessories.push(acc);
    });
  }

  /** After the family changed: the size of the yard and of the things in it, and how much fur each fox gets. */
  layout() {
    if (!this.env) return;
    // room for everyone: a grown fox counts for one, a kit for half; a fox that is only being looked at for none
    // (one that is out exploring keeps its room: the yard does not change while it is away)
    const sizes = this.foxes.map((f) => f.rig.scale).concat(this.absent.map((f) => speciesOf(f.id, f.grown || 0).size));
    const load = this.foxes.reduce((s, f) => s + (f.guest ? 0 : f.baby ? 0.5 : 1), 0) + this.absent.reduce((s, f) => s + (speciesOf(f.id).baby ? 0.5 : 1), 0);
    const kf = 1 + 0.1 * Math.max(0, load - 1);
    // …and for what she has put in the yard: it grows by the ground her things take, and more —
    // and never shrinks under those she has placed herself (with a thing put away, or a fox
    // gone to rest, it gets only as small as the ones nearest its edge allow)
    const B = this.env.base.bounds;
    const taken = this.decor.length ? ROOM + (ROOMY * this.decor.reduce((s, it) => s + it.def.area, 0)) / (Math.PI * B.rx * B.rz) : 0;
    let k = Math.round(Math.sqrt(kf * kf + taken) * 100) / 100;
    while (k < 5 && !this.holds(k)) k = Math.round((k + 0.02) * 100) / 100;
    this.yard = k;
    const big = sizes.length ? Math.max(...sizes) : 1;
    this.big = big;
    this.things.bed.object.scale.setScalar(0.5 + 0.5 * big);
    this.things.bowl.object.scale.setScalar((0.6 + 0.4 * big) * (1 + 0.08 * Math.max(0, sizes.length - 1)));
    this.scaleYard();
    this.tuneShells();
    this.tuneFur();
  }

  /** Would a yard of this size hold everything she has placed in it herself, where it stands? */
  holds(k) {
    const B = this.env.base.bounds;
    return this.decor.every(
      (it) =>
        it.loose ||
        it.homeless ||
        this.circlesOf(it, it.x, it.z, (it.r * Math.PI) / 4).every(
          (c) => Math.hypot((c.x - B.cx * k) / Math.max(0.05, B.rx * k - c.r * EDGE), (c.z - B.cz * k) / Math.max(0.05, B.rz * k - c.r * EDGE)) <= 1.002
        )
    );
  }

  /** The microphone stands at the height of whoever is about to sing. */
  fitMic(rig) {
    this.things.mic.setHeight(0.5 * rig.scale * (0.86 + 0.14 * rig.headScale));
  }

  setLight() {
    const env = this.env;
    if (!env) return;
    const L = this.night ? { ...env.day, ...env.night } : env.day;
    // (the light as the habitat has it; the sky dims and tints it for the weather, every frame)
    this.lit = { sunI: L.sunI, hemi: L.hemi, sun: new THREE.Color(L.sun), sky: new THREE.Color(L.sky), ground: new THREE.Color(L.ground), bg: new THREE.Color(L.bg) };
    if (this.spooky && this.spooky.dusk && !this.night) {
      // Halloween evening: the sun low and red, the sky gone violet, the ground in shadow — and the lanterns lit
      const lit = this.lit;
      lit.sunI *= 0.62;
      lit.hemi *= 0.66;
      lit.sun.lerp(_c.set('#ff8a4a'), 0.6);
      lit.sky.lerp(_c.set('#9d80dc'), 0.55);
      lit.ground.lerp(_c.set('#3d2c4c'), 0.45);
      lit.bg.lerp(_c.set('#4d3b62'), 0.5);
    }
    this.sunOff.set(L.pos[0], L.pos[1], L.pos[2]).multiplyScalar(2.3);
    this.placeSun();
    this.sky.light();
    this.scene.environmentIntensity = this.night ? 0.3 : 0.55;
    env.setNight(this.night);
    if (this.stage) this.stage.classList.toggle('is-night', this.night);
  }

  // ---------------------------------------------------------------- every frame

  update(dt) {
    if (!this.env) return;
    this.time += dt;
    this.sky.update(dt, this.time);
    this.env.setFair(this.sky.rain < 0.25 && this.sky.snow < 0.25 && this.sky.sand < 0.25); // (no butterflies in the rain)
    this.env.update(dt, this.time, this);
    if (this.env.butterflies) this.env.butterflies.forEach((f) => (f.at || (f.at = V())).copy(f.g.position).multiplyScalar(this.yard));
    for (const it of this.decor) if (it.update) it.update(dt, this.time, this);
    this.updateTune(dt);
    this.foxes.forEach((f) => f.brain.update(dt));
    this.leaving.forEach((f) => f.brain.update(dt));
    const me = this.owner;
    me.brain.update(dt);
    if (this.hailing && me.brain.doing !== 'hailYou') {
      // (called away while she waited to be heard — the shop was opened, a picture is being taken: the app tries again)
      this.hailing = null;
      this.host.onHail('off');
    }
    // (should she never get to the bowl, or never let the ball go: the foxes are not kept waiting for ever)
    if (this.serving && this.time - this.serving > 9) this.fillBowl();
    if (this.pitching && this.time - this.pitching > 4) this.throwBall();
    this.soak(dt);
    this.makeRoom();
    this.foxes.forEach((f) => f.anim.update(dt));
    this.leaving.forEach((f) => f.anim.update(dt));
    // she is lit softly, in her own colours — as bright as the day is, a shade darker out of the sun (lorelei.js: dress)
    const lit = me.rig.light;
    lit.uLight.value.copy(this.hemi.color).multiplyScalar(this.hemi.intensity * 0.29).add(_c.copy(this.sun.color).multiplyScalar(this.sun.intensity * 0.2));
    const grey = (lit.uLight.value.r + lit.uLight.value.g + lit.uLight.value.b) / 3;
    lit.uLight.value.lerp(_c.setScalar(Math.max(grey, 0.62)), 0.45); // (by night not as blue as the night is, nor as dark: she is still herself)
    lit.uSun.value = Math.min(1, (this.sun.intensity * (this.sun.color.r + this.sun.color.g + this.sun.color.b)) / 3 / 0.3); // (how much of a sun there is: under heavy cloud or the moon, less of a light side to her)
    me.anim.update(dt);
    if (this.spooky) me.hat.scale.y = 1 - 0.32 * me.anim.umb; // (under her umbrella, her hat's soft point gives)
    // (one that has run off through the bushes is out of the picture — or, should it never get there, after a while)
    if (this.leaving.some((f) => f.gone || this.time > f.leftAt + 25)) {
      this.leaving.filter((f) => f.gone || this.time > f.leftAt + 25).forEach((f) => this.forget(f));
      this.leaving = this.leaving.filter((f) => !f.gone && this.time <= f.leftAt + 25);
    }
    this.updateBowl();
    this.updateBall(dt);
    this.updateMail(dt);
    this.updatePresent(dt);
    this.updateHalloween(dt);
    this.fx.update(dt);
    this.updatePrints(dt);

    // the ring where you tapped
    if (this.markerT < 1) {
      this.markerT += dt * 1.8;
      const k = Math.min(1, this.markerT);
      this.marker.scale.setScalar(0.55 + k * 0.9);
      this.marker.material.opacity = (1 - k) * 0.9;
    }

    // the ring under the fox she is with
    const close = this.showcaseOn;
    const lead = this.lead;
    const halo = this.halo;
    const edit = this.editOn;
    halo.material.opacity = damp(halo.material.opacity, lead && this.foxes.length > 1 && !close && !edit && !this.photoOn && lead.anim.air < 0.02 ? 0.42 : 0, 6, dt);
    if (lead) {
      halo.position.x = lead.anim.pos.x;
      halo.position.z = lead.anim.pos.z;
      halo.scale.setScalar(damp(halo.scale.x, 0.3 * lead.rig.scale + 0.03, 10, dt));
    }

    // …and the one round the thing in the yard she is moving
    const ring = this.ring;
    const held = edit && this.held && !this.held.homeless ? this.held : null;
    ring.material.opacity = damp(ring.material.opacity, held ? 0.6 + 0.25 * Math.sin(this.time * 5) : 0, 10, dt);
    if (held) {
      ring.position.x = held.object.position.x;
      ring.position.z = held.object.position.z;
      ring.scale.setScalar(held.reach + 0.07);
    }

    this.ppu = damp(this.ppu || this.basePpu, this.basePpu, 4, dt); // eases when the yard grows
    if (this.photoOn) return this.updatePhotoCamera(dt);

    // the camera: a little after her fox from afar, right on it up close (on the yard, with nobody at home)
    const b = this.env.bounds;
    const who = (close && this.focus) || lead;
    const S = who ? who.rig.scale : 1;
    this.yawNow = damp(this.yawNow, 0, 6, dt);
    // in the shop a fox fills the view the same whatever the size of the yard, and a small one comes closer still
    // …and while she arranges the yard, all of it shows
    // …and when foxes have left it for cover (under a tree, in the barn), the camera goes most of the way to where
    // the family is, and stands back far enough to see them all — with as much of the yard as will go in
    // …but not while she is looking about the country herself, nor for a fox that is out roaming in it
    const h = this.stage.clientHeight;
    const chat = this.gifting && !close && !edit ? me : null; // Lorelei has something to say: the view is on her
    const roam = !close && !edit && !chat && !!this.free;
    const away = !close && !edit && !roam && !chat && this.foxes.some(HIDING) ? this.spread(this.hailing ? me : null) : null; // (…Lorelei too, while she waits to be heard)
    let fit = Infinity;
    if (away) {
      const x = b.cx + (away.x - b.cx) * 0.6;
      const z = b.cz + (away.z - b.cz) * 0.6;
      fit = Math.min(this.stage.clientWidth / (2 * (Math.abs(away.x - x) + away.w / 2 + 0.75)), (0.62 * h) / (2 * (Math.abs(away.z - z) + away.d / 2 + 0.7) * Math.sin(this.pitch))) / this.basePpu;
      fit = Math.max(fit, ZOOM_MIN);
      away.x = x;
      away.z = z;
    }
    const zoomTo = close ? (this.zoom * 1.5 * this.unitPpu) / this.basePpu / Math.pow(clamp(S, 0.45, 1.1), 0.55) : chat ? Math.min(1.85 * this.unitPpu, (0.44 * h) / me.rig.size) / this.basePpu : edit ? Math.min(this.zoom, this.fitZoom()) : Math.min(this.zoom, fit);
    this.zoomNow = damp(this.zoomNow, zoomTo, away ? 2.5 : 5, dt);
    this.pitch = damp(this.pitch, close ? PITCH_CLOSE : chat ? PITCH_PHOTO : PITCH, 4, dt);
    // on a tall screen the yard sits a little below the middle: woods above it, the buttons below
    const tall = clamp(h / Math.max(1, this.stage.clientWidth) - 1.1, 0, 1);
    this.offset.x = damp(this.offset.x, this.inset.right / 2, 7, dt);
    // (…and while Lorelei talks, above the window her words are in)
    this.offset.y = damp(this.offset.y, chat ? Math.min(90, 0.11 * h) : this.inset.bottom / 2 - (close || edit ? 0 : tall * 0.09 * h), 7, dt);
    // (a fox that has left the yard for the country takes the view along, all the way)
    const out = this.outside(who);
    const follow = !who ? 0 : close || away ? 1 : edit ? 0 : clamp((this.state.reduce ? 0 : 0.3) + (this.yard - 1) * 0.6 + (this.zoomNow - 1) * 0.85 + out, 0, 1);
    const aimX = away ? away.x : who ? who.anim.pos.x : b.cx;
    const aimZ = away ? away.z : who ? who.anim.pos.z : b.cz;
    if (chat) {
      // (on her, and on what she puts down before her)
      this.camTarget.x = damp(this.camTarget.x, me.anim.pos.x + Math.sin(me.anim.yaw) * 0.3, 3.4, dt);
      this.camTarget.z = damp(this.camTarget.z, me.anim.pos.z + Math.cos(me.anim.yaw) * 0.3, 3.4, dt);
    } else if (roam) {
      // the view is hers: where she slid it to — and on a little, if she let it go with a push
      const to = this.free;
      const fling = this.fling;
      if (fling && !this.pointer.pan) {
        to.x += fling.x * dt;
        to.z += fling.z * dt;
        fling.x = damp(fling.x, 0, 4.5, dt);
        fling.z = damp(fling.z, 0, 4.5, dt);
        if (Math.hypot(fling.x, fling.z) < 0.05) this.fling = null;
        this.keepLook(to);
      }
      this.camTarget.x = damp(this.camTarget.x, to.x, 22, dt);
      this.camTarget.z = damp(this.camTarget.z, to.z, 22, dt);
    } else {
      let toX = b.cx + (aimX - b.cx) * follow;
      let toZ = b.cz + (aimZ - b.cz) * follow;
      if (this.hailing && !close && !edit && !away) {
        // Lorelei would like a word: the view leans her way, as far as it takes for her to be seen — between the card
        // at the top and the buttons at the bottom (a fox that goes out into the country takes it along all the same)
        const k = (this.ppu || this.basePpu) * this.zoomNow;
        const deep = k * Math.sin(this.pitch);
        const mid = h / 2 - this.offset.y; // (where the middle of the view is on the screen)
        const side = Math.max(0.2, (this.stage.clientWidth / 2 - 70) / k);
        const at = me.anim.pos;
        const keep = this.hailing.now ? 1 : 1 - out;
        toX += (clamp(toX, at.x - side, at.x + side) - toX) * keep;
        toZ += (clamp(toZ, at.z - Math.max(0, 0.7 * h - mid) / deep, at.z + Math.max(0, mid - 0.38 * h) / deep) - toZ) * keep;
      }
      this.camTarget.x = damp(this.camTarget.x, toX, 2.8, dt);
      this.camTarget.z = damp(this.camTarget.z, toZ, 2.8, dt);
    }
    this.camTarget.y = damp(this.camTarget.y, close ? 0.3 * S : chat ? 0.5 : 0.15, 4, dt);
    this.placeCamera();
    this.placeSun();
    this.placeBubble();
  }

  /**
   * The sun stands over where she is looking, so that things throw shadows wherever that is.
   * It moves a whole texel of its shadow map at a time: the shadows do not crawl as the view slides.
   */
  placeSun() {
    const d = _v.copy(this.sunOff).normalize();
    const right = _w.set(d.z, 0, -d.x).normalize();
    const up = _pa.crossVectors(d, right);
    const step = (2 * SHADE) / this.sun.shadow.mapSize.x;
    const c = this.camTarget;
    const a = Math.round((c.x * right.x + c.z * right.z) / step) * step;
    const b = Math.round((c.x * up.x + c.z * up.z) / step) * step;
    const along = -(up.y * b) / d.y; // (…and back down the ray of the sun to the ground)
    const at = this.sun.target.position.set(right.x * a + up.x * b + d.x * along, 0, right.z * a + up.z * b + d.z * along);
    this.sun.position.copy(at).add(this.sunOff);
    FUR_SUN.value.copy(d); // (the foxes look up their shadows a little way towards it: rig.js)
  }

  // ---------------------------------------------------------------- ways through the country

  /**
   * The country round the yard as squares of ground, open or shut: shut where something
   * stands (with the room the middle of a fox needs from it), and beyond where the country
   * ends. Made when a fox first needs a way through, kept until the yard changes.
   */
  countryGrid() {
    const env = this.env;
    if (env.grid) return env.grid;
    const R = env.range;
    const step = 0.2 * Math.max(1, 0.6 * this.yard);
    const x0 = R.cx - R.rx;
    const z0 = R.cz - R.rz;
    const nx = Math.ceil((2 * R.rx) / step) + 1;
    const nz = Math.ceil((2 * R.rz) / step) + 1;
    const shut = new Uint8Array(nx * nz);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) if (Math.hypot((x0 + i * step - R.cx) / R.rx, (z0 + j * step - R.cz) / R.rz) > 1) shut[j * nx + i] = 1;
    }
    for (const o of env.wilds) {
      const r = o.r + NEAR;
      const i1 = Math.min(nx - 1, Math.ceil((o.x + r - x0) / step));
      const j1 = Math.min(nz - 1, Math.ceil((o.z + r - z0) / step));
      for (let j = Math.max(0, Math.floor((o.z - r - z0) / step)); j <= j1; j++) {
        for (let i = Math.max(0, Math.floor((o.x - r - x0) / step)); i <= i1; i++) if (Math.hypot(x0 + i * step - o.x, z0 + j * step - o.z) < r) shut[j * nx + i] = 1;
      }
    }
    const cell = (x, z) => {
      const i = Math.round((x - x0) / step);
      const j = Math.round((z - z0) / step);
      return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i;
    };
    /** Does the straight stretch from p to q lie over open ground all the way? */
    const clear = (p, q) => {
      const n = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / (step * 0.5)));
      for (let k = 0; k <= n; k++) {
        const c = cell(p.x + ((q.x - p.x) * k) / n, p.z + ((q.z - p.z) * k) / n);
        if (c < 0 || shut[c]) return false;
      }
      return true;
    };
    /** The open square nearest a place (itself, if it is open). */
    const open = (x, z) => {
      const i0 = clamp(Math.round((x - x0) / step), 0, nx - 1);
      const j0 = clamp(Math.round((z - z0) / step), 0, nz - 1);
      for (let ring = 0; ring < 9; ring++) {
        let best = -1;
        let near = Infinity;
        for (let j = j0 - ring; j <= j0 + ring; j++) {
          for (let i = i0 - ring; i <= i0 + ring; i++) {
            if (i < 0 || j < 0 || i >= nx || j >= nz || Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== ring || shut[j * nx + i]) continue;
            const d = Math.hypot(x0 + i * step - x, z0 + j * step - z);
            if (d < near) {
              near = d;
              best = j * nx + i;
            }
          }
        }
        if (best >= 0) return best;
      }
      return -1;
    };
    return (env.grid = { x0, z0, nx, nz, step, shut, clear, open, at: (c) => ({ x: x0 + (c % nx) * step, z: z0 + Math.floor(c / nx) * step }) });
  }

  /**
   * The way through the country from one place to another, round whatever stands between:
   * the places to turn at, in order ([] = straight there). The shortest way from square to
   * square of the grid (A*), drawn tight. Where there is none: straight there, and what
   * happens happens.
   */
  wayThrough(from, to) {
    const G = this.countryGrid();
    if (G.clear(from, to)) return [];
    const { nx, nz, shut, step } = G;
    const start = G.open(from.x, from.z);
    const goal = G.open(to.x, to.z);
    if (start < 0 || goal < 0 || start === goal) return [];
    const far = new Float32Array(nx * nz).fill(Infinity); // how far it is to each square by the best way found so far
    const via = new Int32Array(nx * nz).fill(-1);
    const done = new Uint8Array(nx * nz);
    const gi = goal % nx;
    const gj = Math.floor(goal / nx);
    const left = (c) => Math.hypot((c % nx) - gi, Math.floor(c / nx) - gj);
    // the squares to be looked at, the most promising at the top of a heap: [square, how promising]
    const heap = [[start, left(start)]];
    far[start] = 0;
    const push = (c, f) => {
      let k = heap.push([c, f]) - 1;
      while (k > 0) {
        const up = (k - 1) >> 1;
        if (heap[up][1] <= heap[k][1]) break;
        [heap[up], heap[k]] = [heap[k], heap[up]];
        k = up;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        for (let k = 0; ; ) {
          let low = k;
          for (const d of [2 * k + 1, 2 * k + 2]) if (d < heap.length && heap[d][1] < heap[low][1]) low = d;
          if (low === k) break;
          [heap[low], heap[k]] = [heap[k], heap[low]];
          k = low;
        }
      }
      return top[0];
    };
    let found = false;
    while (heap.length) {
      const c = pop();
      if (done[c]) continue;
      done[c] = 1;
      if (c === goal) {
        found = true;
        break;
      }
      const i = c % nx;
      const j = Math.floor(c / nx);
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if ((!di && !dj) || i + di < 0 || j + dj < 0 || i + di >= nx || j + dj >= nz) continue;
          const n = (j + dj) * nx + i + di;
          if (shut[n] || done[n]) continue;
          if (di && dj && (shut[j * nx + i + di] || shut[(j + dj) * nx + i])) continue; // (not across a corner of something)
          const d = far[c] + (di && dj ? 1.4142 : 1);
          if (d >= far[n]) continue;
          far[n] = d;
          via[n] = c;
          push(n, d + left(n));
        }
      }
    }
    if (!found) return [];
    const squares = [];
    for (let c = goal; c >= 0 && c !== start; c = via[c]) squares.unshift(G.at(c));
    // drawn tight: from where it stands, on to the furthest place the way to which lies open — and so on from there
    const way = [];
    let p = from;
    for (let k = 0; k < squares.length; ) {
      let reach = k;
      for (let m = squares.length - 1; m > k; m--) {
        if (G.clear(p, squares[m])) {
          reach = m;
          break;
        }
      }
      p = squares[reach];
      way.push(p);
      k = reach + 1;
    }
    // (the last of them is the square she tapped in, or as near that as a fox can stand: from there it is a step)
    if (way.length && G.clear(way[way.length - 1], to) && Math.hypot(way[way.length - 1].x - to.x, way[way.length - 1].z - to.z) < 2 * step) way.pop();
    return way;
  }

  // ---------------------------------------------------------------- looking about the country

  /** How far out of the yard a fox is: 0 in it … 1 well out in the country (the view goes all the way along with it). */
  outside(fox) {
    const b = this.env.bounds;
    return fox ? clamp((Math.hypot((fox.anim.pos.x - b.cx) / b.rx, (fox.anim.pos.z - b.cz) / b.rz) - 0.9) / 0.45, 0, 1) : 0;
  }

  /** As far as the view may be slid: over the country the foxes roam. */
  keepLook(p) {
    const R = this.env.range;
    p.x = clamp(p.x, R.cx - R.rx, R.cx + R.rx);
    p.z = clamp(p.z, R.cz - R.rz, R.cz + R.rz);
    return p;
  }

  /** The point of the ground under a place on the page. */
  groundAt(x, y) {
    return this.cast({ clientX: x, clientY: y }).intersectPlane(_plane, _pb);
  }

  /** Her finger on the ground has begun to move: from now on the ground comes along with it. */
  grab(e) {
    const p = this.pointer;
    const at = this.groundAt(p.x, p.y);
    if (!at) return;
    p.pan = true;
    // (where her finger is, counted from the middle of the view — and where that middle was)
    p.rel = { x: at.x - this.camTarget.x, z: at.z - this.camTarget.z };
    p.from = { x: this.camTarget.x, z: this.camTarget.z };
    p.last = { x: p.from.x, z: p.from.z, t: performance.now() };
    this.fling = null;
    this.free = { x: p.from.x, z: p.from.z };
    this.canvas.style.cursor = 'grabbing';
    this.host.onLook(true);
    this.slide(e);
  }

  slide(e) {
    const p = this.pointer;
    const at = this.groundAt(e.clientX, e.clientY);
    if (!at) return;
    const to = this.keepLook({ x: p.from.x + p.rel.x - (at.x - this.camTarget.x), z: p.from.z + p.rel.z - (at.z - this.camTarget.z) });
    const now = performance.now();
    const dt = Math.max(1, now - p.last.t) / 1000;
    if (dt > 0.012) {
      const k = Math.min(1, dt / 0.08);
      this.fling = { x: ((this.fling ? this.fling.x : 0) * (1 - k)) + ((to.x - p.last.x) / dt) * k, z: ((this.fling ? this.fling.z : 0) * (1 - k)) + ((to.z - p.last.z) / dt) * k };
      p.last = { x: to.x, z: to.z, t: now };
    }
    this.free = to;
    this.wake();
  }

  /** Back to her fox (the button that says so, a tap that calls it, a treat, the shop…). */
  lookBack() {
    this.fling = null;
    this.pointer.pan = false;
    if (!this.free) return;
    this.free = null;
    this.host.onLook(false);
    this.wake();
  }

  /** Where the family is, all of them (and `also`): the middle of the ground they are spread over, and how wide and deep that is. */
  spread(also = null) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const f of also ? this.foxes.concat(also) : this.foxes) {
      x0 = Math.min(x0, f.anim.pos.x);
      x1 = Math.max(x1, f.anim.pos.x);
      z0 = Math.min(z0, f.anim.pos.z);
      z1 = Math.max(z1, f.anim.pos.z);
    }
    return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 };
  }

  /** A fox seen from above, as three circles — rump, shoulders, head: [x, z, r] × 3 into `out`. */
  shape(fox, out) {
    const S = fox.rig.scale;
    const p = fox.anim.pos;
    const s = Math.sin(fox.anim.yaw) * S;
    const c = Math.cos(fox.anim.yaw) * S;
    out[0] = p.x - s * 0.22;
    out[1] = p.z - c * 0.22;
    out[2] = 0.125 * S;
    out[3] = p.x + s * 0.12;
    out[4] = p.z + c * 0.12;
    out[5] = 0.125 * S;
    out[6] = p.x + s * 0.42;
    out[7] = p.z + c * 0.42;
    out[8] = 0.1 * S;
    return out;
  }

  /**
   * Foxes don't walk through each other: one that is moving, or just standing about, gives
   * way. Those that have settled (sitting, lying, at the bowl, in a line-up) are left be.
   */
  makeRoom() {
    const list = this.foxes;
    const gives = (f) => (f.anim.speed > 0.05 || f.brain.loose ? 1 : 0);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const A = list[i];
        const B = list[j];
        if (A.anim.air > 0.02 || B.anim.air > 0.02) continue;
        const a = gives(A);
        const c = gives(B);
        if (!a && !c) continue;
        // one that is on its way to squeeze in somewhere (next to this fox, at the bowl, into a line-up) is let through
        if ((A.anim.speed > 0.05 && (A.brain.close || A.brain.skip === B)) || (B.anim.speed > 0.05 && (B.brain.close || B.brain.skip === A))) continue;
        this.shape(A, _sa);
        this.shape(B, _sb);
        let deep = 0;
        let nx = 0;
        let nz = 0;
        for (let u = 0; u < 9; u += 3) {
          for (let v = 0; v < 9; v += 3) {
            const dx = _sb[v] - _sa[u];
            const dz = _sb[v + 1] - _sa[u + 1];
            const d = Math.hypot(dx, dz) || 1e-3;
            const pen = _sa[u + 2] + _sb[v + 2] - d;
            if (pen > deep) {
              deep = pen;
              nx = dx / d;
              nz = dz / d;
            }
          }
        }
        if (deep <= 0) continue;
        const push = (deep * 0.4) / (a + c);
        A.anim.pos.x -= nx * push * a;
        A.anim.pos.z -= nz * push * a;
        B.anim.pos.x += nx * push * c;
        B.anim.pos.z += nz * push * c;
      }
    }
    // …nor through Lorelei, nor she through them — unless one of them has come to the other
    const me = this.owner;
    const hers = me.anim.pos;
    const mine = me.anim.speed > 0.05 || me.brain.loose ? 1 : 0;
    for (const f of list) {
      if (f.anim.air > 0.02 || me.anim.air > 0.02) continue;
      if (f.brain.target === me || f.brain.skip === me || me.brain.target === f || me.brain.skip === f) continue;
      const a = gives(f);
      if (!a && !mine) continue;
      this.shape(f, _sa);
      let deep = 0;
      let nx = 0;
      let nz = 0;
      for (let u = 0; u < 9; u += 3) {
        const dx = _sa[u] - hers.x;
        const dz = _sa[u + 1] - hers.z;
        const d = Math.hypot(dx, dz) || 1e-3;
        const pen = 0.12 * me.rig.size + _sa[u + 2] - d;
        if (pen > deep) {
          deep = pen;
          nx = dx / d;
          nz = dz / d;
        }
      }
      if (deep <= 0) continue;
      const push = (deep * 0.4) / (a + mine);
      f.anim.pos.x += nx * push * a;
      f.anim.pos.z += nz * push * a;
      hers.x -= nx * push * mine;
      hers.z -= nz * push * mine;
    }
  }

  // ---------------------------------------------------------------- speech bubble

  /** `fox` speaks (the one she is with, unless another is named). */
  say(text, ms = 2600, fox = null) {
    const el = this.bubble.el;
    if (!el || !text) return;
    this.bubble.fox = fox || this.lead;
    // (what Lorelei says has her name over it)
    if (this.bubble.fox === this.owner) el.dataset.who = this.host.ownerName();
    else delete el.dataset.who;
    el.textContent = text;
    el.hidden = false;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    this.bubble.until = performance.now() + ms;
    this.placeBubble();
  }

  hush() {
    if (this.bubble.el) this.bubble.el.hidden = true;
    this.bubble.until = 0;
  }

  placeBubble() {
    const el = this.bubble.el;
    if (!el || el.hidden) return;
    const fox = this.bubble.fox === this.owner || this.foxes.includes(this.bubble.fox) ? this.bubble.fox : this.lead;
    if (performance.now() > this.bubble.until || !fox) {
      el.hidden = true;
      return;
    }
    const p = this.project(fox.anim.headPoint(_v));
    const w = this.stage.clientWidth;
    const half = el.offsetWidth / 2;
    const x = clamp(p.x, half + 6, w - half - 6);
    const y = Math.max(el.offsetHeight + 8, p.y - 14);
    el.style.transform = `translate(${(x - half).toFixed(1)}px, ${(y - el.offsetHeight).toFixed(1)}px)`;
    el.style.setProperty('--tail', `${clamp(p.x - (x - half), 14, el.offsetWidth - 14).toFixed(1)}px`);
  }

  /** World point → pixels inside the stage. */
  project(p) {
    _w.copy(p).project(this.camera);
    return { x: (_w.x * 0.5 + 0.5) * this.stage.clientWidth, y: (-_w.y * 0.5 + 0.5) * this.stage.clientHeight };
  }

  /** Where a fox's head is on the page (for effects drawn by the app). */
  foxOnPage(id) {
    const fox = this.byId(id) || this.lead;
    if (!this.stage || !fox) return null;
    const p = this.project(fox.anim.headPoint(_v));
    const r = this.stage.getBoundingClientRect();
    return { x: r.left + p.x, y: r.top + p.y };
  }

  // ---------------------------------------------------------------- pointer

  cast(e) {
    const r = this.canvas.getBoundingClientRect();
    _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    _ray.setFromCamera(_ndc, this.camera);
    return _ray.ray;
  }

  /** The fox under the pointer, if any (each one is a fat line from its rump to its nose; small ones are a little easier to hit). */
  foxAt(ray) {
    let hit = null;
    let best = 1;
    for (const fox of this.foxes) {
      const a = _v.setFromMatrixPosition(fox.rig.bones.hips.matrixWorld);
      const b = fox.anim.headPoint(_w);
      const r = 0.19 * fox.rig.scale + 0.045;
      const k = ray.distanceSqToSegment(a, b) / (r * r);
      if (k < best) {
        best = k;
        hit = fox;
      }
    }
    return hit;
  }

  /** Is Lorelei under the pointer? (From her hips to the top of her head; a fox in front of her comes first.) */
  ownerAt(ray) {
    const me = this.owner;
    return ray.distanceSqToSegment(_pa.setFromMatrixPosition(me.rig.bones.hips.matrixWorld), me.anim.headPoint(_pb)) < 0.024 * me.rig.size * me.rig.size;
  }

  /** She was tapped (or the app has something for her to say): she turns and waves — busy, she only says it. */
  ownerHello(line) {
    const b = this.owner.brain;
    if (b.idle || b.doing === 'helloYou' || b.doing === 'standBy') b.do('helloYou', line);
    else if (line) {
      this.say(line, 2800, this.owner);
      if (!b.asleep) this.owner.anim.mood.smile = 1;
    }
    this.wake();
  }

  onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      /* not capturable: fine */
    }
    this.fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = this.pointer;
    if (this.fingers.size === 2) {
      // a second finger: this is a pinch, not a tap
      const [a, b] = [...this.fingers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: this.zoom };
      p.down = false;
      return;
    }
    if (this.photoOn) return void Object.assign(p, { down: true, x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, fox: null });
    if (this.editOn) return void this.editDown(e);
    Object.assign(p, { down: true, pan: false, owner: false, x: e.clientX, y: e.clientY, t: performance.now(), fox: this.foxAt(this.cast(e)) });
    this.fling = null; // (a finger on the ground stops it gliding)
    // a tap on Lorelei: she says hello
    if (!p.fox && this.ownerAt(_ray.ray)) {
      p.owner = true;
      return void this.host.onOwner();
    }
    // the fox with the letter hands it over, the one with a parcel gives her that; any other gets a pat
    if (p.fox && this.letter && this.letter.fox === p.fox) this.host.onLetter();
    else if (p.fox && this.gift && this.gift.fox === p.fox) this.host.onGift();
    else if (p.fox) this.petAt(e, p.fox);
  }

  onMove(e) {
    const p = this.pointer;
    if (this.fingers.has(e.pointerId)) this.fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pinch && this.fingers.size >= 2) {
      const [a, b] = [...this.fingers.values()];
      this.setZoom((this.pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / this.pinch.d);
      return;
    }
    if (this.photoOn) {
      // drag: round the family, and up and down
      if (!p.down) return;
      this.orbit.yaw = clamp(this.orbit.yaw - (e.clientX - p.lastX) * 0.006, -1.3, 1.3);
      this.orbit.pitch = clamp(this.orbit.pitch + (e.clientY - p.lastY) * 0.004, 0.52, 1.08);
      p.lastX = e.clientX;
      p.lastY = e.clientY;
      this.wake();
      return;
    }
    if (this.editOn) return void this.editMove(e);
    // a finger on the ground that moves: the view slides over the country (in the shop it stays on the foxes)
    if (p.down && !p.fox && !p.owner && !this.showcaseOn) {
      if (p.pan) return void this.slide(e);
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) return void this.grab(e);
    }
    if (!this.lead) return;
    const over = this.foxAt(this.cast(e));
    this.canvas.style.cursor = over ? 'grab' : '';
    // stroking: keep petting while the finger moves over the fur of the fox it came down on
    if (p.down && over && over === p.fox && performance.now() - p.lastPet > 340 && Math.hypot(e.clientX - p.lastX, e.clientY - p.lastY) > 14) this.petAt(e, over);
  }

  onUp(e, cancelled) {
    this.fingers.delete(e.pointerId);
    if (this.fingers.size < 2) this.pinch = null;
    const p = this.pointer;
    if (this.editOn) return void this.editUp(e, cancelled);
    if (!p.down) return;
    p.down = false;
    if (p.pan) {
      // she lets the ground go: with a push it glides on a little
      p.pan = false;
      this.canvas.style.cursor = '';
      if (this.fling && (performance.now() - p.last.t > 90 || Math.hypot(this.fling.x, this.fling.z) < 0.6 || this.state.reduce)) this.fling = null;
      return;
    }
    if (this.photoOn || cancelled || p.fox || p.owner || !this.lead || performance.now() - p.t > 600 || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 12) return;
    const ray = this.cast(e);
    // the mailbox with its flag up: off goes a fox to fetch what is in it
    const box = this.things.mailbox.object.position;
    if (this.mail === 'box' && ray.distanceSqToSegment(_v.set(box.x, 0.05, box.z), _w.set(box.x, 0.42, box.z)) < 0.03) {
      this.lookBack();
      this.fetchLetter();
      return void this.host.onCommand();
    }
    // one of the things in the yard: the fox she is with goes and uses it
    const toy = this.decorAt(ray);
    if (toy && !toy.trial) {
      this.lookBack();
      this.marker.position.set(toy.object.position.x, 0.012, toy.object.position.z);
      this.markerT = 0;
      this.lead.brain.do('useDecor', toy);
      return void this.host.onCommand();
    }
    const at = ray.intersectPlane(_plane, _v);
    if (!at) return;
    // anywhere in the yard — or out in the country: her fox runs there, and the view goes with it
    const lead = this.lead;
    const to = lead.brain.inYard(at, 0.97) ? lead.brain.clampPoint(at.x, at.z, 0.97) : lead.brain.landAt(at.x, at.z);
    this.lookBack();
    this.marker.position.set(to.x, 0.012, to.z);
    this.markerT = 0;
    lead.brain.do('comeTo', to.x, to.z);
    // kits like to come along
    this.foxes.forEach((f) => f !== lead && f.baby && f.brain.free && Math.random() < 0.6 && f.brain.do('follow', lead));
    this.host.onCommand();
  }

  petAt(e, fox) {
    const p = this.pointer;
    p.lastPet = performance.now();
    p.lastX = e.clientX;
    p.lastY = e.clientY;
    this.host.onPet(fox.id);
  }

  // ---------------------------------------------------------------- reactions asked for by the app

  /** `id` = the fox it is about (a pat, a new outfit, an arrival); otherwise the one she is with — or all of them. */
  act(name, id) {
    if (name === 'depart') {
      // off on an expedition
      const fox = this.byId(id);
      if (fox) this.sendOff(fox);
      return void this.wake();
    }
    const one = this.byId(id) || this.lead;
    if (!one) return;
    if (!['cheer', 'joy', 'greet', 'encore'].includes(name)) this.lookBack(); // (something she did for them: back to the foxes)
    const all = (what, ...args) => this.foxes.forEach((f) => f.brain.do(what, ...args));
    const me = this.owner.brain;
    if (name === 'pet') one.brain.pat();
    else if (name === 'feed') {
      // Lorelei brings the food: the foxes gather round the bowl and wait until she has tipped it in (fillBowl)
      this.foxes.forEach((f) => (f.brain.ate = 0));
      this.serving = this.time;
      me.do('serve');
      all('eat');
    } else if (name === 'play') {
      // …and she throws the ball: they watch her arm until it flies (throwBall)
      this.hideBall();
      this.pitching = this.time;
      me.do('tossBall');
      all('playBall');
    } else if (name === 'sing') {
      one.brain.do('sing');
      this.foxes.forEach((f) => f !== one && f.brain.do('listen', one));
    } else if (name === 'cheer') all('cheer');
    else if (name === 'joy') all('joy');
    else if (name === 'greet') all('greet');
    if (['cheer', 'joy', 'encore', 'gift', 'letter', 'dress'].includes(name) && (me.idle || me.doing === 'standBy')) me.do('clapHands', name === 'dress' ? 1 : 1.6);
    if (name === 'hello' && me.idle) me.do('waveAt', one);
    if (name === 'dress') {
      one.brain.do('joy');
      this.fx.emit('✨', one.anim.headPoint(V()), { n: 6, spread: 0.3, rise: 0.5, life: 1.1, size: 0.12 });
    } else if (name === 'hello') {
      // a new member of the family: it shows itself, the others come and have a sniff
      if (one.brain.doing !== 'arrive') one.brain.do('joy');
      this.foxes.forEach((f) => f !== one && f.brain.free && f.brain.do('visit', one));
    } else if (name === 'fetch') this.fetchLetter();
    else if (name === 'encore') all('cheer'); // the cover is over: that was lovely
    else if (name === 'gift') {
      // she took the parcel: one proud fox
      const fox = this.gift ? this.gift.fox : one;
      this.setGift(null);
      fox.brain.do('cheer');
      this.fx.emit('💗', fox.anim.headPoint(V()), { n: 5, spread: 0.24, rise: 0.55, life: 1.2, size: 0.13 });
    }
    else if (name === 'newThing') {
      // something new in the yard: whoever has nothing better to do comes and sniffs at it
      const item = this.decor.find((it) => it.id === id);
      if (item) this.foxes.filter((f) => f.brain.free).slice(0, 3).forEach((f) => f.brain.do('inspect', item));
    } else if (name === 'letter') {
      // she took the letter: one proud fox
      const fox = this.letter ? this.letter.fox : one;
      this.setMail('none');
      fox.brain.do('cheer');
      this.fx.emit('💗', fox.anim.headPoint(V()), { n: 5, spread: 0.24, rise: 0.55, life: 1.2, size: 0.13 });
    }
    this.wake();
  }

  // ---------------------------------------------------------------- what she has put in the yard

  /**
   * The things that stand in the yard: `list` = [{ id, x, z, r, trial }]; `held` = the one she
   * has picked. One with a place (x, z; r = eighths of a turn) stands where she put it. One
   * without is the world's to place (arrange) — and to move again when the yard changes.
   */
  setDecor(list, held = null) {
    const ids = list.map((d) => d.id);
    this.decor.filter((it) => !ids.includes(it.id)).forEach((it) => this.removeDecor(it));
    list.forEach((d) => {
      let it = this.decor.find((x) => x.id === d.id);
      if (!it) {
        it = makeDecor(d.id);
        if (!it) return;
        this.grace();
        it.r = it.def.turn;
        it.homeless = true; // (no place in the world yet)
        it.loose = true;
        this.decor.push(it);
        this.scene.add(it.object);
      }
      it.trial = !!d.trial;
      if (this.drag && this.drag.item === it) return; // it is in her hand
      it.loose = d.x == null;
      if (it.loose) return;
      it.homeless = false;
      it.x = d.x;
      it.z = d.z;
      it.r = d.r || 0;
    });
    this.decor.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    this.held = this.decor.find((it) => it.id === held) || null;
  }

  removeDecor(it) {
    this.evict(it);
    const p = it.object.position;
    if (this.stage && !it.homeless) this.fx.emit('✨', V(p.x, 0.25, p.z), { n: 6, spread: 0.25, rise: 0.45, life: 0.9, size: 0.12 });
    this.decor = this.decor.filter((x) => x !== it);
    if (this.held === it) this.held = null;
    if (this.drag && this.drag.item === it) this.drag = null;
    this.scene.remove(it.object);
    disposeTree(it.object);
    this.noDen = false;
  }

  /** Whoever is on a thing, or on its way to it, leaves it be. */
  evict(it) {
    it.users.slice().forEach((f) => f.brain.do('lookAbout'));
    it.users.length = 0;
  }

  /** A fox wants a thing for itself (the swing takes one, the fire several). */
  claim(it, fox) {
    if (it.users.includes(fox)) return true;
    if (it.trial || it.homeless || (this.drag && this.drag.item === it) || it.users.length >= (it.def.share || 1)) return false;
    it.users.push(fox);
    return true;
  }

  unclaim(fox) {
    for (const it of this.decor) {
      const i = it.users.indexOf(fox);
      if (i >= 0) it.users.splice(i, 1);
    }
  }

  /** The house, if one stands in the yard. */
  house() {
    return this.decor.find((it) => it.def.use === 'den' && !it.trial && !it.homeless) || null;
  }

  /** The house for the night: for the fox she is with — null for the others (and where there is none). */
  denFor(fox) {
    const house = this.noDen ? null : this.house();
    if (!house) return null;
    if (!this.foxes.includes(this.denFox)) this.denFox = this.lead || this.foxes[0];
    return fox === this.denFox ? house : null;
  }

  /** The ground a thing takes where it stands — or would: at (x, z), turned by `yaw` — as circles in the world. */
  circlesOf(it, x = it.object.position.x, z = it.object.position.z, yaw = it.yaw) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    return it.def.solid.map(([lx, lz, r]) => ({ x: x + lx * c + lz * s, z: z - lx * s + lz * c, r, h: it.def.h, item: it }));
  }

  /** Stand every thing where the game says. */
  placeDecor() {
    const solids = [];
    for (const it of this.decor) {
      it.object.visible = !it.homeless;
      if (it.homeless) continue;
      const p = it.object.position;
      const ox = p.x;
      const oz = p.z;
      if (!(this.drag && this.drag.item === it)) {
        it.yaw = (it.r * Math.PI) / 4;
        p.set(it.x, 0, it.z);
        it.object.rotation.y = it.yaw;
      }
      // a fox that is on it goes with it
      if (p.x !== ox || p.z !== oz) {
        this.foxes.forEach((f) => {
          if (f.brain.using !== it) return;
          f.anim.pos.x += p.x - ox;
          f.anim.pos.z += p.z - oz;
          if (f.brain.way) {
            f.brain.way.x += p.x - ox;
            f.brain.way.z += p.z - oz;
          }
          f.anim.snap();
        });
      }
      solids.push(...this.circlesOf(it));
    }
    this.decorSolids = solids;
    this.stamp++;
    if (!this.drag) this.yieldThings();
    const box = this.things.mailbox.object;
    box.rotation.y = Math.atan2(this.env.bounds.cx - box.position.x, this.env.bounds.cz - box.position.z) * 0.6; // its door half towards the yard, half towards her
  }

  /**
   * The bowl, the bed, the microphone, the mailbox and the radio make way for the things she
   * has placed herself (they stand by the habitat's plan, which knows nothing of those). The
   * things that are the world's to place make way for them in turn (homeDecor).
   */
  yieldThings() {
    const solids = this.decorSolids.filter((o) => !o.item.loose);
    if (!solids.length) return;
    const b = this.env.bounds;
    for (const key of ['bowl', 'bed', 'mic', 'mailbox', 'radio']) {
      const thing = this.things[key];
      const p = thing.object.position;
      const r = thing.radius * thing.object.scale.x + GAP_OWN;
      const free = (x, z) => Math.hypot((x - b.cx) / b.rx, (z - b.cz) / b.rz) < 0.97 && !solids.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + r - 2e-3);
      if (free(p.x, p.z)) continue;
      // the nearest free ground, looking round it in wider and wider rings
      search: for (let d = 0.15; d < 2.6; d += 0.15) {
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * TAU + d;
          if (!free(p.x + Math.sin(a) * d, p.z + Math.cos(a) * d)) continue;
          p.x += Math.sin(a) * d;
          p.z += Math.cos(a) * d;
          break search;
        }
      }
    }
  }

  /**
   * Where she may not put anything: by the foxes' own things and the scenery (a fox has to get
   * past), and on the places where they stand — the singer at the microphone, the one that
   * fetches the letter, all of them when they come to meet her, and when they dance.
   */
  keepOut() {
    const { bowl, bed, mic, mailbox, radio } = this.things;
    const b = this.env.bounds;
    const out = this.env.obstacles.map((o) => ({ x: o.x, z: o.z, r: o.r, gap: GAP_OWN }));
    const add = (at, r, gap = 0) => out.push({ x: at.x, z: at.z, r, gap });
    for (const thing of [bowl, bed, mailbox, radio]) add(thing.object.position, thing.radius * thing.object.scale.x, GAP_OWN);
    if (mic.object.visible) {
      add(mic.object.position, mic.radius, GAP_OWN);
      add({ x: mic.object.position.x, z: mic.object.position.z - 0.3 }, 0.16); // where the singer stands
    }
    const m = mailbox.object.position;
    const ang = Math.atan2(b.cx - m.x, b.cz - m.z);
    add({ x: m.x + Math.sin(ang) * 0.45, z: m.z + Math.cos(ang) * 0.45 }, 0.2);
    add(this.env.spots.front, 0.3);
    // (…their places there, and the floor between them)
    const floor = this.danceFloor();
    for (const at of floor) add(at, 0.5);
    if (floor.length > 1) {
      const radio = this.things.radio.object.position;
      const near = Math.max(...floor.map((at) => at.z));
      const far = Math.min(...floor.map((at) => at.z));
      add({ x: radio.x, z: (near + far) / 2 }, (near - far) / 2 + 0.2);
    }
    return out;
  }

  /** The foxes' places when they dance, as they are meant to be: behind the radio, the fox she is with in front, the others in rows behind it. */
  danceFloor() {
    const radio = this.things.radio.object.position;
    const s = 0.55 + 0.45 * Math.max(0.6, this.big || 1); // small foxes dance closer together
    // (a place for everyone who lives here — one that is out exploring keeps its own)
    return Array.from({ length: this.foxes.length + this.absent.length }, (_, i) => ({ x: radio.x + STAGE[i % STAGE.length][0] * s, z: radio.z - STAGE[i % STAGE.length][1] * s }));
  }

  /** Everything a thing has to stand clear of where she puts it: the other things, and what has to stay free. */
  blockersFor(it) {
    return this.decorSolids.filter((o) => o.item !== it).map((o) => ({ x: o.x, z: o.z, r: o.r, gap: GAP })).concat(this.keepOut());
  }

  /** Does a thing stand free at (x, z), turned by `yaw`: in the yard, and clear of the `blockers`? */
  fits(it, x, z, yaw, blockers) {
    const b = this.env.bounds;
    return this.circlesOf(it, x, z, yaw).every(
      (c) =>
        Math.hypot((c.x - b.cx) / Math.max(0.05, b.rx - c.r * EDGE), (c.z - b.cz) / Math.max(0.05, b.rz - c.r * EDGE)) <= 1.002 &&
        blockers.every((o) => Math.hypot(c.x - o.x, c.z - o.z) >= c.r + o.r + o.gap - 2e-3)
    );
  }

  /** The place nearest (x, z) where it does stand free — pushed back into the yard and off whatever it touches — or null. */
  nudge(it, x, z, yaw, blockers) {
    const b = this.env.bounds;
    for (let pass = 0; pass < 40; pass++) {
      let hit = false;
      for (const c of this.circlesOf(it, x, z, yaw)) {
        const k = Math.hypot((c.x - b.cx) / Math.max(0.05, b.rx - c.r * EDGE), (c.z - b.cz) / Math.max(0.05, b.rz - c.r * EDGE));
        if (k > 1) {
          x += b.cx + (c.x - b.cx) / k - c.x;
          z += b.cz + (c.z - b.cz) / k - c.z;
          hit = true;
          break;
        }
        const o = blockers.find((q) => Math.hypot(c.x - q.x, c.z - q.z) < c.r + q.r + q.gap - 1e-3);
        if (!o) continue;
        const d = Math.hypot(c.x - o.x, c.z - o.z);
        const push = c.r + o.r + o.gap - d + 0.004;
        x += d > 1e-4 ? ((c.x - o.x) / d) * push : push;
        z += d > 1e-4 ? ((c.z - o.z) / d) * push : 0;
        hit = true;
        break;
      }
      if (!hit) return { x, z };
    }
    return null;
  }

  /** Room for a thing: the place nearest to where its kind likes to stand where it is clear of the `blockers` — or null. */
  roomFor(it, blockers) {
    const b = this.env.bounds;
    const yaw = (it.r * Math.PI) / 4;
    const wantX = b.cx + it.def.home[0] * b.rx;
    const wantZ = b.cz + it.def.home[1] * b.rz;
    let best = null;
    let near = Infinity;
    for (let gx = -1; gx <= 1.001; gx += 0.06) {
      for (let gz = -1; gz <= 1.001; gz += 0.08) {
        const x = b.cx + gx * b.rx;
        const z = b.cz + gz * b.rz;
        const d = Math.hypot(x - wantX, z - wantZ);
        if (d < near && this.fits(it, x, z, yaw, blockers)) {
          near = d;
          best = { x, z };
        }
      }
    }
    return best;
  }

  /** Places for all the things that are the world's to place, the largest first: [[thing, { x, z }], …] — or null, if the yard is too small for that. */
  planDecor(loose) {
    const blockers = this.keepOut();
    for (const it of this.decor) if (!it.loose && !it.homeless) for (const c of this.circlesOf(it)) blockers.push({ x: c.x, z: c.z, r: c.r, gap: GAP });
    const plan = [];
    for (const it of loose.slice().sort((p, q) => q.def.area - p.def.area)) {
      const at = this.roomFor(it, blockers);
      if (!at) return null;
      plan.push([it, at]);
      for (const c of this.circlesOf(it, at.x, at.z, (it.r * Math.PI) / 4)) blockers.push({ x: c.x, z: c.z, r: c.r, gap: GAP });
    }
    return plan;
  }

  /**
   * The things she has not placed herself — just bought, or put out again, and never moved —
   * stand where the world finds best: all of them afresh whenever the yard changes (so one
   * that is only being tried out leaves no trace when it goes again). Where the yard is too
   * full for that, it grows until it is not. If even that does not help, the app is told that
   * there was no room for the last of them (host.onDecorFull).
   */
  homeDecor() {
    const loose = this.decor.filter((it) => it.loose && !(this.drag && this.drag.item === it));
    if (!loose.length) return;
    let plan = this.planDecor(loose);
    for (let more = 0; !plan && more < 24; more++) {
      this.yard = Math.round((this.yard + 0.05) * 100) / 100;
      this.scaleYard();
      plan = this.planDecor(loose);
    }
    if (!plan) return void this.host.onDecorFull(loose[loose.length - 1].id);
    const moved = [];
    for (const [it, at] of plan) {
      const x = Math.round(at.x * 1000) / 1000;
      const z = Math.round(at.z * 1000) / 1000;
      if (!it.homeless && Math.hypot(x - it.x, z - it.z) < 0.02) continue;
      it.homeless = false;
      it.x = x;
      it.z = z;
      moved.push(it);
    }
    if (!moved.length) return;
    this.placeDecor();
    for (const it of moved) {
      if (this.stage) this.fx.emit('✨', V(it.x, 0.3, it.z), { n: 8, spread: 0.3, rise: 0.5, life: 1.1, size: 0.13 });
      this.clearFoxes(it);
    }
  }

  /** A fox that stands where a thing has just been put jumps clear of it. */
  clearFoxes(it) {
    for (const f of this.foxes) {
      if (f.anim.air > 0.02 || f.brain.using === it) continue;
      if (this.circlesOf(it).some((c) => Math.hypot(f.anim.pos.x - c.x, f.anim.pos.z - c.z) < c.r + 0.1 * f.rig.scale)) f.brain.do('scoot', it);
    }
  }

  /** She has given a thing its place (in the world): from now on it stands there. The app is told, and a fox that stood there jumps clear. */
  setPlace(it, x, z, r = it.r) {
    it.x = Math.round(x * 1000) / 1000;
    it.z = Math.round(z * 1000) / 1000;
    it.r = r;
    it.loose = false;
    this.placeDecor();
    this.clearFoxes(it);
    this.host.onDecor(it.id, { x: it.x, z: it.z, r: it.r });
    this.wake();
  }

  /** Turn a thing an eighth of a turn on — or as far as it takes to stand free again. False: it can't be turned where it is. */
  turnDecor(id) {
    const it = this.decor.find((x) => x.id === id);
    if (!it || it.homeless) return false;
    this.evict(it);
    const blockers = this.blockersFor(it);
    const p = it.object.position;
    for (let i = 1; i < 8; i++) {
      const r = (it.r + i) % 8;
      const at = this.nudge(it, p.x, p.z, (r * Math.PI) / 4, blockers);
      if (!at) continue;
      this.setPlace(it, at.x, at.z, r);
      return true;
    }
    return false;
  }

  /** The point nearest `p` that is not inside one of the things (`pad` = the room it needs, `but` = a thing that doesn't count). */
  clearOf(p, pad = 0.1, but = null) {
    const out = V(p.x, 0, p.z);
    const b = this.env.bounds;
    const free = (x, z) => !this.decorSolids.some((o) => o.item !== but && Math.hypot(x - o.x, z - o.z) < o.r + pad);
    if (free(p.x, p.z)) return out;
    for (let pass = 0; pass < 6; pass++) {
      let hit = false;
      for (const o of this.decorSolids) {
        if (o.item === but) continue;
        const d = Math.hypot(out.x - o.x, out.z - o.z);
        const r = o.r + pad;
        if (d >= r) continue;
        // out the way it lies from the middle of it (towards the middle of the yard if it is dead centre)
        const ang = d > 1e-3 ? Math.atan2(out.x - o.x, out.z - o.z) : Math.atan2(b.cx - o.x, b.cz - o.z);
        out.x = o.x + Math.sin(ang) * (r + 0.01);
        out.z = o.z + Math.cos(ang) * (r + 0.01);
        hit = true;
      }
      if (!hit) break;
    }
    const inYard = (x, z) => Math.hypot((x - b.cx) / b.rx, (z - b.cz) / b.rz) <= 1;
    if (inYard(out.x, out.z) && free(out.x, out.z)) return out;
    // that way lies the edge of the yard, or the next thing: the nearest free ground, then, looking round in wider and wider rings
    for (let d = 0.1; d < 3; d += 0.1) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU + d * 2.4;
        const x = p.x + Math.sin(a) * d;
        const z = p.z + Math.cos(a) * d;
        if (inYard(x, z) && free(x, z)) return out.set(x, 0, z);
      }
    }
    return out;
  }

  /** …and off the foxes' own things — the bed, the bowl, the mailbox, the microphone: `p` itself is moved, if it lies within `pad` of one. */
  offThings(p, pad) {
    for (const key of ['bed', 'bowl', 'mailbox', 'mic']) {
      const thing = this.things[key];
      if (!thing.object.visible) continue;
      const c = thing.object.position;
      const r = thing.radius * thing.object.scale.x + pad;
      const d = Math.hypot(p.x - c.x, p.z - c.z);
      if (d >= r) continue;
      const ang = d > 1e-3 ? Math.atan2(p.x - c.x, p.z - c.z) : 0;
      p.x = c.x + Math.sin(ang) * r;
      p.z = c.z + Math.cos(ang) * r;
    }
    return p;
  }

  /** The thing in the yard under the pointer, if any. */
  decorAt(ray) {
    let hit = null;
    let best = 1;
    for (const o of this.decorSolids) {
      const k = ray.distanceSqToSegment(_pa.set(o.x, 0.02, o.z), _pb.set(o.x, Math.max(0.04, o.h * 0.85), o.z)) / (o.r * o.r * 1.1);
      if (k < best) {
        best = k;
        hit = o.item;
      }
    }
    return hit;
  }

  // ----- arranging it (the shop is open on the yard)

  editDown(e) {
    const p = this.pointer;
    Object.assign(p, { down: true, x: e.clientX, y: e.clientY, t: performance.now(), fox: null });
    const ray = this.cast(e);
    const hit = this.decorAt(ray);
    const ground = ray.intersectPlane(_plane, _v);
    const at = ground ? { x: ground.x, z: ground.z } : null;
    if (hit && hit !== this.held) this.host.onDecorPick(hit.id); // (the app answers with the new look: this.held)
    const it = hit || this.held;
    if (!it || !at || it.homeless) return void (p.down = false);
    this.evict(it);
    const c = it.object.position;
    // taken by itself it keeps its place under the finger; a touch on open ground calls it there
    this.drag = { item: it, dx: hit ? c.x - at.x : 0, dz: hit ? c.z - at.z : 0, moved: false, grabbed: !!hit };
  }

  editMove(e) {
    const p = this.pointer;
    const d = this.drag;
    if (!d || !p.down) return void (this.canvas.style.cursor = this.decorAt(this.cast(e)) ? 'grab' : '');
    if (!d.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6) return;
    d.moved = true;
    this.canvas.style.cursor = 'grabbing';
    this.dragTo(e);
  }

  /** The thing in her hand follows the pointer — as far as it stands free. */
  dragTo(e) {
    const at = this.cast(e).intersectPlane(_plane, _v);
    if (!at) return false;
    const d = this.drag;
    const it = d.item;
    const spot = this.nudge(it, at.x + d.dx, at.z + d.dz, it.yaw, this.blockersFor(it));
    if (!spot) return false;
    it.object.position.set(spot.x, 0, spot.z);
    this.decorSolids = this.decor.filter((x) => !x.homeless).flatMap((x) => this.circlesOf(x));
    this.wake();
    return true;
  }

  editUp(e, cancelled) {
    const p = this.pointer;
    const d = this.drag;
    this.canvas.style.cursor = '';
    if (!p.down || !d) return void (this.drag = null);
    p.down = false;
    // a tap on open ground: the thing she has picked goes there
    if (!d.moved && !d.grabbed && !cancelled && performance.now() - p.t < 600) d.moved = this.dragTo(e);
    this.drag = null;
    const it = d.item;
    if (d.moved && this.decor.includes(it)) this.setPlace(it, it.object.position.x, it.object.position.z);
    else this.placeDecor();
  }

  // ---------------------------------------------------------------- one of her covers is playing

  /**
   * `tune` = { id, on } while a cover is in the player (on: false = paused), otherwise null.
   * The radio comes out, the foxes gather behind it, listen and dance (dance.js). The beat they
   * keep is the cover's own, as soon as the app has listened to it (host.beats) — until then an
   * even 108 to the minute.
   */
  setTune(tune) {
    let T = this.tune;
    if (!tune) {
      if (T) {
        if (T.on) T.offAt = this.time;
        T.on = T.live = false;
      }
      return;
    }
    if (!T) T = this.tune = { id: null, on: false, live: true, t: 0, beat: 0, bar: -1, last: -1, move: 'nod', moveAt: 0, energy: 0.5, level: 0, ready: false, since: 0, offAt: -99, singer: null, g: null, spots: null, order: [], key: '' };
    T.live = true;
    if (T.id !== tune.id) Object.assign(T, { id: tune.id, g: null, bar: -1, last: -1, t: 0, ready: false, since: this.time });
    if (!!tune.on === T.on) return;
    T.on = !!tune.on;
    if (!T.on) return void (T.offAt = this.time);
    if (this.time - T.offAt > 8) Object.assign(T, { since: this.time, ready: false }); // after a silence they listen first again
    // everyone comes — but the one with a letter in its mouth, and not while they pose
    if (!this.showcaseOn && !this.photoOn) {
      const what = this.state.mood === 'sleepy' ? 'lullaby' : 'party';
      this.foxes.forEach((f) => !f.brain.busyWith('fetchLetter') && !f.brain.busyWith(what) && f.brain.do(what));
      if (what === 'party' && this.owner.brain.idle) this.owner.brain.do('swayAlong');
    }
    this.wake();
  }

  updateTune(dt) {
    const T = this.tune;
    const radio = this.things.radio;
    // the radio stays out while the cover is in the player (for a while, if it is paused)
    radio.update(dt, !!T && !!this.stage && (T.on || (T.live && this.time - T.offAt < 40) || this.time - T.offAt < 1));
    if (!T || !T.on) return;
    // the cover's own clock, followed smoothly
    const now = this.host.clock();
    T.t += dt;
    T.t = Math.abs(now - T.t) > 0.35 ? now : T.t + (now - T.t) * Math.min(1, dt * 6);
    // its beat, once the app has listened to it (five seconds is long enough to wait for that)
    const g = this.host.beats(T.id);
    if (g !== T.g) {
      T.g = g;
      T.bar = -1;
    }
    if (!T.ready && (g || this.time - T.since > 5)) T.ready = true;
    const slow = g && g.bpm > 150 ? 2 : 1; // too fast to dance to: every other beat
    T.beat = (g ? beatAt(g.beats, T.t) : T.t * 1.8) / slow;
    T.level = g ? curveAt(g.level, g.step, T.t) : 0.45 + 0.3 * Math.sin(T.t * 5);
    T.energy = g ? curveAt(g.energy, g.step, T.t) : 0.5;
    // a new move every eight beats — a livelier one in every fourth eight, whatever the song is doing
    const bar = Math.floor(T.beat / 8);
    if (bar !== T.bar) {
      T.bar = bar;
      T.moveAt = bar * 8;
      const e = clamp(T.energy + (((bar % 4) + 4) % 4 === 3 ? 0.3 : 0), 0, 1);
      T.move = pickMove(e, T.move, this.foxes.length, this.state.reduce);
      // …and now and then one of them sings along instead
      T.singer = !this.state.reduce && this.state.mood !== 'sleepy' && e > 0.3 && Math.random() < 0.35 ? this.foxes[Math.floor(Math.random() * this.foxes.length)] : null;
    }
    // notes out of the radio, in time
    const n = Math.floor(T.beat);
    if (n !== T.last) {
      T.last = n;
      radio.kick(0.5 + 0.6 * T.level);
      if (n % 2 === 0) {
        const p = radio.object.position;
        this.fx.emit(n % 4 ? '🎵' : '🎶', V(p.x + (Math.random() - 0.5) * 0.2, radio.top, p.z), { size: 0.12, rise: 0.5, life: 1.3, drift: 0.35 });
      }
    }
  }

  /** The foxes' places behind the radio: the one she is with in front, the others in rows behind it, facing her. */
  partySpots() {
    const T = this.tune;
    const key = `${this.lead.id}|${this.stamp}|${this.yard}`;
    if (T.spots && T.key === key) return T.spots;
    const order = [this.lead].concat(this.foxes.filter((f) => f !== this.lead));
    const stage = this.danceFloor();
    const spots = new Map();
    order.forEach((f, i) => {
      // (where it can stand: clear of her things by as much as goTo keeps, and off the bed)
      const p = this.offThings(this.clearOf(stage[i], 0.5 * f.rig.scale), 0.3 * f.rig.scale);
      spots.set(f, f.brain.clampPoint(p.x, p.z, 0.97));
    });
    Object.assign(T, { spots, order, key });
    return spots;
  }

  partySpot(fox) {
    return this.partySpots().get(fox) || fox.anim.pos;
  }

  /** Its place in the line (0 = the fox she is with). */
  partyPlace(fox) {
    this.partySpots();
    return Math.max(0, this.tune.order.indexOf(fox));
  }

  // ---------------------------------------------------------------- the weather

  /** The app says what the weather is now (sky.js draws it). If the sky has turned while she is watching, the foxes take notice. */
  setWeather(sky) {
    if (this.sky.set(sky, !this.stage) && this.stage) this.weatherTurned();
    this.wake();
  }

  /** The sky has changed before her eyes: whoever is free to runs for cover — or, when it starts to snow, after the flakes. */
  weatherTurned() {
    this.cover = null;
    if (this.showcaseOn || this.photoOn) return;
    const sky = this.sky;
    // (Lorelei gets up off the wet ground)
    if (sky.raining && ['sitAwhile', 'petOne'].includes(this.owner.brain.doing)) this.owner.brain.reset();
    for (const f of this.foxes) {
      const b = f.brain;
      const wants = sky.shelterFrom(f);
      if (b.asleep) {
        // woken by the rain, it looks for a drier place to sleep (the one in the house sleeps on)
        if (wants && !b.sheltered && !b.using) b.do('sleep');
      } else if (!b.heedful) continue;
      else if (wants) b.do('takeCover', true);
      else if (sky.snowing) b.do('snowJoy');
    }
  }

  /**
   * A fox's place out of the rain: under a tree, in a doorway — wherever the habitat has cover
   * (scenes.js: shelters). Each fox has its own, for as long as the yard stays as it is.
   * { x, z, yaw, lie, via, roof } — or null: there is none (left).
   */
  coverFor(fox) {
    const key = `${this.env.id}|${this.yard}`;
    if (!this.cover || this.cover.key !== key) this.cover = { key, at: new Map() };
    const at = this.cover.at;
    for (const f of at.keys()) if (!this.foxes.includes(f)) at.delete(f);
    if (at.has(fox)) return at.get(fox);
    const taken = [...at.values()];
    for (const shelter of this.env.shelters) {
      for (const p of shelter.spots) {
        // (free: nobody else's, and nothing of hers standing on it)
        if (taken.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 0.05)) continue;
        if (this.decorSolids.some((o) => Math.hypot(p.x - o.x, p.z - o.z) < o.r + 0.2)) continue;
        const place = { ...p, via: shelter.via, roof: shelter.roof };
        at.set(fox, place);
        return place;
      }
    }
    return null;
  }

  /** Out in the rain a fox's fur gets wet. It dries again, slowly — or at once, with a good shake (weatherlife.js). */
  soak(dt) {
    const rain = this.sky.rain;
    for (const f of this.foxes) {
      const dry = f.brain.sheltered || (f.brain.using && f.brain.using.def.use === 'den');
      if (rain > 0.15 && !dry) f.wet = Math.min(1, f.wet + (dt / 12) * rain);
      else if (f.wet > 0) f.wet = Math.max(0, f.wet - dt / 45);
      f.rig.furUniforms.uWet.value = f.wet;
    }
  }

  // ---------------------------------------------------------------- expeditions

  /**
   * Where a fox leaves the yard for the woods, and comes back in: at the back, to one side —
   * wherever nothing stands in the way. { x, z, yaw }: the gap, and the way out through it.
   */
  gate() {
    const b = this.env.bounds;
    const blocked = (x, z, pad) =>
      this.decorSolids.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + pad) ||
      this.env.obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + pad) ||
      ['bed', 'mailbox', 'mic'].some((key) => {
        const thing = this.things[key];
        return thing.object.visible && Math.hypot(x - thing.object.position.x, z - thing.object.position.z) < thing.radius * thing.object.scale.x + pad;
      });
    let first = null;
    for (const ang of [Math.PI - 0.75, -(Math.PI - 0.75), Math.PI - 1.2, -(Math.PI - 1.2), Math.PI - 0.3, -(Math.PI - 0.3), Math.PI]) {
      const dx = Math.sin(ang) * b.rx;
      const dz = Math.cos(ang) * b.rz;
      const gate = { x: b.cx + dx * 0.98, z: b.cz + dz * 0.98, yaw: Math.atan2(dx, dz) };
      first = first || gate;
      // (clear where it goes out, and a little further on)
      if (!blocked(gate.x, gate.z, 0.5) && !blocked(b.cx + dx * 1.25, b.cz + dz * 1.25, 0.3)) return gate;
    }
    return first;
  }

  /** A fox sets off on an expedition: it is no longer one of the family in the yard — it runs off through the bushes, the others watch it go. */
  sendOff(fox) {
    this.foxes = this.foxes.filter((f) => f !== fox);
    for (const key of ['lead', 'focus', 'bedFox', 'denFox']) if (this[key] === fox) this[key] = null;
    this.lead = this.lead || this.foxes[0] || null;
    this.focus = this.focus || this.lead;
    // a letter it had (or was going for) is back in the mailbox
    if ((this.letter && this.letter.fox === fox) || (this.mail === 'fetching' && this.courier === fox)) this.setMail('box');
    if (this.ballBusy === fox) this.ballBusy = null;
    fox.away = true;
    fox.gone = false;
    fox.leftAt = this.time;
    this.leaving.push(fox);
    fox.brain.do('depart', this.gate());
    if (!this.showcaseOn && !this.photoOn) this.foxes.forEach((f) => f.brain.free && f.brain.do('seeOff', fox));
    if (this.owner.brain.idle) this.owner.brain.do('waveAt', fox); // Lorelei waves after it
    this.stamp++;
    this.tuneShells();
  }

  /** A fox that was on its way out is wanted in the yard after all (she called it back at once): it turns round. */
  turnBack(id) {
    const fox = this.leaving.find((f) => f.id === id);
    if (!fox) return null;
    this.leaving = this.leaving.filter((f) => f !== fox);
    fox.away = fox.gone = false;
    this.foxes.push(fox);
    fox.brain.do(this.showcaseOn ? 'model' : this.photoOn ? 'strike' : 'arrive');
    return fox;
  }

  /** The parcel a fox has brought home: in its mouth until she takes it (`fox` = null: she has). */
  setGift(fox) {
    if (this.gift && this.gift.fox === fox) return;
    if (this.gift) {
      this.gift.object.removeFromParent();
      disposeTree(this.gift.object);
      this.gift.fox.anim.carry = false;
      this.gift = null;
    }
    if (!fox) return;
    const object = makeGift(fox.rig);
    fox.rig.bones.head.add(object);
    fox.anim.carry = true;
    this.gift = { fox, object };
  }

  /**
   * A fox is home from an expedition with a parcel. If she is watching, it comes running in
   * through the gap in the bushes, and the others come to see what it has. If she comes later,
   * it is there, and brings it to her (mount).
   */
  homecoming(fox) {
    if (!this.stage) return;
    const busy = this.showcaseOn ? 'model' : this.photoOn ? 'strike' : null;
    if (fox.fresh) {
      const gate = this.gate();
      fox.anim.pos.set(gate.x, 0, gate.z);
      fox.anim.yaw = gate.yaw + Math.PI;
      fox.anim.speed = 0;
      fox.anim.snap();
      fox.brain.do(busy || 'bringGift', true);
      if (!busy) this.foxes.forEach((f) => f !== fox && f.brain.free && f.brain.do('visit', fox));
      if (!busy && this.owner.brain.idle) this.owner.brain.do('waveAt', fox);
    } else if (!busy && this.state.mood !== 'sleepy') fox.brain.do('bringGift');
    this.wake();
  }

  // ---------------------------------------------------------------- Lorelei would like a word

  /**
   * Now and then she has something to say (js/chat.js): she comes to the front, waves and calls — `line`, in a bubble
   * over her head — and waits there to be tapped, a speech mark over her head from time to time. The app begins the
   * conversation then (present: 'call'); if nobody taps her she says `bye` and lets it be.
   * → false if she cannot just now: asleep, busy with the foxes, a picture being taken… — or would not be seen: the
   * view slid away over the country, gone along with a fox that is out in it, or close up on one.
   * (`now`: he has asked to be shown — she leaves off what she is doing, and the view comes to her.)
   */
  hail(line, bye, now = false) {
    const b = this.owner.brain;
    if (this.gifting || this.hailing || this.photoOn || this.editOn || this.showcaseOn || this.state.mood === 'sleepy' || this.serving || this.pitching) return false;
    if (now) this.lookBack();
    else if (!b.idle || this.free || this.zoom > 1.6 || (this.outside(this.lead) > 0 && !this.foxes.some(HIDING))) return false; // (under cover out there, the view shows them all: her too)
    this.hailing = { bye, now };
    b.do('hailYou', line);
    this.wake();
    return true;
  }

  /** …she need not wait any longer (it was called off, or the foxes' world is being left). */
  unhail() {
    if (!this.hailing) return;
    this.hailing = null;
    const b = this.owner.brain;
    if (b.doing === 'hailYou') b.script = null;
  }

  // ---------------------------------------------------------------- Lorelei's present

  /**
   * Lorelei has the word. The app tells it (her present: js/present.js — her first hello: js/meet.js — a chat she
   * struck up: js/chat.js), a step at a time:
   *   'call'   she comes to the front of the yard and waves, `arg` in a bubble over her head (none: she has called
   *            already, see hail); the view goes to her
   *   'speak'  she is speaking (`arg`) — or has stopped
   *   'show'   the parcel is in her hands
   *   'give'   …she holds it out, and puts it down before her
   *   'open'   it opens: the fox `arg` was in it (it comes out with the app's next sync)
   *   'meet'   "…and this is the one": the fox `arg` steps up beside her
   *   'wave'   a wave, to end with
   * …and on Halloween (js/halloween.js), trick or treat:
   *   'costume'  "look at them": a hand towards the foxes, who hop in their costumes
   *   'hat'      "…and me": her witch's hat
   *   'treat'    she has been given sweets: she shares them out, and the foxes jump for them
   *   'trick'    …or the trick: the foxes spring up round her, and ghosts and bats with them
   *   'end'    that was it
   */
  present(step, arg) {
    if (step === 'call') {
      this.endPresent();
      this.hailing = null; // (she was waiting to be heard: now she is)
      this.gifting = { step, t: 0, ready: false, speaking: false, shown: 0, down: false, at: V(), lid: 0, fox: null, hops: 0 };
      this.lookBack();
      this.owner.brain.do('presentIt', arg);
      // (whoever is awake comes to look on, from either side of her)
      let place = 0;
      for (const f of this.foxes) if (!f.brain.asleep && !f.brain.stray) f.brain.do('lookOn', place++);
    } else if (!this.gifting) return;
    else if (step === 'speak') this.gifting.speaking = !!arg;
    else if (step === 'end') this.endPresent();
    else {
      const g = this.gifting;
      g.step = step;
      g.t = 0;
      if (step === 'open') {
        if (!g.down) g.at.copy(this.parcel.object.position).setY(0); // (opened in her hands, should it come to that)
        const cam = this.camera.position;
        this.spawn = { id: arg, x: g.at.x, z: g.at.z, yaw: Math.atan2(cam.x - g.at.x, cam.z - g.at.z) };
        this.fx.emit('✨', V(g.at.x, 0.24, g.at.z), { n: 12, spread: 0.24, rise: 0.75, life: 1.2, size: 0.14 });
        this.fx.emit('💗', V(g.at.x, 0.3, g.at.z), { n: 5, spread: 0.2, rise: 0.6, life: 1.4, size: 0.13 });
      } else if (step === 'costume' || step === 'treat' || step === 'trick') {
        // the foxes that are looking on hop where they sit (brain.js: lookOn) — under a shower of sweets, or of ghosts
        g.hops++;
        const me = this.owner.anim;
        const watching = this.foxes.filter((f) => f.brain.doing === 'lookOn');
        if (step === 'treat') this.fx.emit('🍬', me.headPoint(V()), { n: 5, spread: 0.25, rise: 0.7, life: 1.4, size: 0.13, drift: 0.4 });
        watching.forEach((f, i) => {
          const top = f.anim.headPoint(V());
          if (step === 'costume') this.fx.emit('✨', top, { n: 4, spread: 0.2, rise: 0.5, life: 1, size: 0.11 });
          else if (step === 'treat') this.fx.emit(['🍭', '🍬', '🍫'][i % 3], top, { n: 2, spread: 0.12, rise: 0.45, life: 1.2, size: 0.12 });
          else this.fx.emit(i % 2 ? '🦇' : '👻', top, { n: 2, spread: 0.25, rise: 0.6, life: 1.5, size: 0.15, drift: 0.3 });
        });
      } else if (step === 'hat') {
        this.fx.emit('✨', this.owner.anim.headPoint(V()).add(V(0, 0.18, 0)), { n: 7, spread: 0.2, rise: 0.4, life: 1.1, size: 0.12 });
      } else if (step === 'meet') {
        // (one that is asleep is spoken of where it lies)
        const fox = this.byId(arg) || this.lead;
        g.fox = fox || null;
        if (fox && !fox.brain.asleep) fox.brain.do('stepUp');
      }
    }
    this.wake();
  }

  endPresent() {
    if (!this.gifting) return;
    this.gifting = null;
    this.spawn = null;
    this.parcel.object.visible = false;
    this.parcel.object.scale.setScalar(1);
    this.parcel.lid.visible = true;
    this.parcel.lid.position.set(0, this.parcel.height, 0);
    this.parcel.lid.rotation.set(0, 0, 0);
    this.parcel.lid.scale.setScalar(1);
    const b = this.owner.brain;
    if (b.doing === 'presentIt') b.script = null;
  }

  /** The parcel once it is out of her hands: it stirs, the lid flies off, and then it is in nobody's way any more. */
  updatePresent(dt) {
    const g = this.gifting;
    if (!g) return;
    g.t += dt; // (how long this step of it has been going)
    const { object, lid, height } = this.parcel;
    if (g.step === 'give' && g.down) {
      // (something in it wants out)
      const k = Math.max(0, Math.sin(this.time * 19)) * Math.max(0, Math.sin(this.time * 3.1));
      object.rotation.z = 0.07 * k;
      object.position.y = 0.012 * k;
    } else if (g.step === 'open') {
      g.lid = Math.min(1, g.lid + dt * 1.9);
      const k = g.lid;
      object.rotation.z = 0;
      object.position.y = 0;
      lid.position.set(0.5 * k, height + 0.9 * k * (1.5 - k), -0.3 * k);
      lid.rotation.set(-2.4 * k, 0, 3.2 * k);
      lid.scale.setScalar(1 - k * k * k);
      lid.visible = k < 1;
      // …and the box is gone from under whoever was in it
      const gone = clamp((g.t - 0.5) / 0.5, 0, 1);
      object.scale.setScalar(1 - gone * gone);
      if (gone >= 1) object.visible = false;
    }
  }

  // ---------------------------------------------------------------- Halloween

  /**
   * Halloween, as the app says (js/halloween.js): `h` = { dusk } while it is on, else null. Lorelei puts her witch's hat
   * on, jack-o'-lanterns stand round the yard, bats fly over the woods; `dusk` is the evening of it, with the light of a
   * sunset (setLight). (The foxes' costumes come with what they wear: props.js, witch and pumpkin.)
   * → true if the light has to change.
   */
  setHalloween(h) {
    const was = this.spooky;
    this.spooky = h ? { dusk: !!h.dusk } : null;
    this.owner.hat.visible = !!h;
    if (!h) this.clearLanterns();
    else if (this.lanternsIn !== this.env) this.placeLanterns();
    return !!was !== !!h || (!!was && !!h && was.dusk !== !!h.dusk);
  }

  /**
   * The jack-o'-lanterns: round the edge of the yard, each where nothing else stands and a fox can get round it — and
   * from then on part of the scenery, which the foxes step round and she cannot put anything on. They look out
   * towards you, a little in towards the yard.
   */
  placeLanterns() {
    this.clearLanterns(false);
    const env = this.env;
    if (!env) return;
    this.lanternsIn = env;
    const b = env.bounds;
    const k = this.yard;
    const R = LANTERN_R * 1.2;
    const taken = this.keepOut().concat(this.decorSolids.map((o) => ({ x: o.x, z: o.z, r: o.r, gap: GAP })));
    const free = (x, z) => !taken.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + R + Math.max(0.1, o.gap * 0.5));
    for (const a0 of LANTERNS) {
      // (where it is meant to stand, or the nearest place along the edge to it that is free)
      for (let n = 0; n < 11; n++) {
        const a = a0 + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 0.08;
        const x = b.cx + Math.sin(a) * b.rx * 0.94;
        const z = b.cz + Math.cos(a) * b.rz * 0.94;
        if (!free(x, z)) continue;
        const it = makeLantern(LANTERN_R);
        it.bx = x / k;
        it.bz = z / k;
        it.object.position.set(x, 0, z);
        it.object.rotation.y = Math.atan2(b.cx - x, b.cz + 4 * b.rz - z);
        this.scene.add(it.object);
        this.lanterns.push(it);
        taken.push({ x, z, r: R, gap: GAP });
        env.base.obstacles.push({ x: it.bx, z: it.bz, r: R / k, lantern: true });
        env.base.wilds.push({ x: it.bx, z: it.bz, r: R / k, lantern: true });
        break;
      }
    }
    this.scaleYard();
  }

  /** …and away with them (`rescale`: the yard is set out again without them). */
  clearLanterns(rescale = true) {
    this.lanternsIn = null;
    if (!this.lanterns.length) return;
    this.lanterns.forEach((it) => {
      this.scene.remove(it.object);
      disposeTree(it.object);
    });
    this.lanterns = [];
    const B = this.env && this.env.base;
    if (!B) return;
    B.obstacles = B.obstacles.filter((o) => !o.lantern);
    B.wilds = B.wilds.filter((o) => !o.lantern);
    if (rescale) this.scaleYard();
  }

  /** Every frame: the lanterns flicker (and glow, as it gets dark), and now and then bats flit up out of the woods. */
  updateHalloween(dt) {
    const h = this.spooky;
    if (!h) return;
    this.glow = damp(this.glow, this.night ? 1 : h.dusk ? 0.8 : 0, 2, dt);
    for (const it of this.lanterns) it.update(this.time, this.glow);
    this.batsIn -= dt;
    if (this.batsIn > 0 || !this.stage) return;
    const calm = this.state.reduce;
    this.batsIn = (calm ? 9 : 3) + Math.random() * (calm ? 8 : 4);
    const b = this.env.bounds;
    const x = this.camTarget.x + (Math.random() - 0.5) * 1.6 * b.rx;
    const at = V(x, 0.5, b.cz - b.rz * (0.8 + 0.3 * Math.random()));
    const ghost = (h.dusk || this.night) && Math.random() < 0.3;
    this.fx.emit(ghost ? '👻' : '🦇', at, { n: ghost ? 1 : 1 + Math.floor(Math.random() * 3), spread: 0.3, rise: 0.32, life: 3.2, size: ghost ? 0.2 : 0.16, drift: 0.35 });
  }

  // ---------------------------------------------------------------- his letters

  /** Where the letter is: nowhere, in the mailbox, being fetched, or in a fox's mouth (`fox`). */
  setMail(phase, fox = null) {
    if (this.letter) {
      this.letter.object.removeFromParent();
      disposeTree(this.letter.object);
      this.letter.fox.anim.carry = false;
      this.letter = null;
    }
    this.mail = phase;
    this.mailWait = 0;
    if (phase !== 'fetching') this.courier = null;
    this.things.mailbox.setFlag(phase === 'box' || phase === 'fetching');
    if (phase === 'fox' && fox) {
      const object = makeLetter(fox.rig);
      fox.rig.bones.head.add(object);
      fox.anim.carry = true;
      this.letter = { fox, object };
    }
    this.host.onMail(phase);
  }

  /** Send the fox she is with to the mailbox (another, if that one has a parcel in its mouth). */
  fetchLetter() {
    const full = this.gift && this.gift.fox;
    const courier = this.lead !== full ? this.lead : this.foxes.find((f) => f !== full);
    if (this.mail !== 'box' || !courier) return;
    this.setMail('fetching');
    this.courier = courier;
    this.courier.brain.do('fetchLetter');
    this.wake();
  }

  /** A fox has reached the mailbox and taken the letter out (called by its brain). */
  pickLetter(fox) {
    if (this.mail !== 'fetching') return;
    this.setMail('fox', fox);
    const at = this.things.mailbox.object.position;
    this.fx.emit('✨', V(at.x, 0.4, at.z), { n: 5, spread: 0.12, rise: 0.4, life: 0.9, size: 0.1 });
  }

  updateMail(dt) {
    const box = this.things.mailbox;
    box.update(dt);
    if (this.mail === 'box') {
      // a letter is waiting: a twinkle on the mailbox, and before long the fox she is with goes for it by itself
      this.mailWait += dt;
      if (Math.random() < dt * 0.7) this.fx.emit('✨', V(box.object.position.x, 0.46, box.object.position.z), { spread: 0.1, rise: 0.25, life: 1, size: 0.08 });
      if (this.mailWait > 6 && this.stage && !this.showcaseOn && !this.photoOn && this.state.mood !== 'sleepy') this.fetchLetter();
    } else if (this.mail === 'fetching' && !(this.courier && this.foxes.includes(this.courier) && this.courier.brain.busyWith('fetchLetter'))) {
      this.setMail('box'); // it was called away before it got there
    }
  }

  // ---------------------------------------------------------------- pictures of the family

  /** She starts (or stops) taking pictures: the family lines up and poses, the buttons go, the camera is hers. */
  photo(on) {
    if (on === this.photoOn) return;
    this.photoOn = on;
    this.lookBack();
    if (on) this.owner.brain.do('poseForPicture');
    else if (this.owner.brain.doing === 'poseForPicture') this.owner.brain.script = null;
    if (on) {
      this.zoomKept = this.zoom;
      this.zoom = 1;
      this.orbit = { yaw: 0, pitch: PITCH_PHOTO };
      this.poseSeed = Math.floor(Math.random() * MIXED.length);
    } else this.zoom = this.zoomKept || 1;
    this.foxes.forEach((f) => {
      if (on) f.brain.do('strike');
      else if (f.brain.doing === 'strike') f.brain.script = null;
    });
    this.tuneShells();
    this.wake();
  }

  setPose(pose) {
    this.pose = pose;
    this.poseSeed++;
    this.wake();
  }

  poseFor(fox) {
    return this.pose === 'mix' ? MIXED[(this.foxes.indexOf(fox) + this.poseSeed) % MIXED.length] : this.pose;
  }

  /** Can a fox of this size stand at (x, z): in the yard, with room between it and her things, and not on the foxes' own? */
  standable(x, z, S) {
    const b = this.env.bounds;
    if (Math.hypot((x - b.cx) / b.rx, (z - b.cz) / b.rz) > 0.97) return false;
    if (this.decorSolids.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + 0.5 * S)) return false;
    return ['bed', 'bowl', 'mailbox', 'mic'].every((key) => {
      const thing = this.things[key];
      return !thing.object.visible || Math.hypot(x - thing.object.position.x, z - thing.object.position.z) >= thing.radius * thing.object.scale.x + 0.3 * S;
    });
  }

  /**
   * A line-up: places for the foxes — `build()` gives [[fox, x, z], …] as it is meant to be —
   * moved as a whole to where every one of them can stand, as near to that as there is room.
   * (Where there is none, each stands as near its own place as it can.) Kept under `name`
   * until something changes.
   */
  lineUp(name, build) {
    const key = `${this.lead ? this.lead.id : ''}|${this.focus ? this.focus.id : ''}|${this.foxes.length}|${this.stamp}|${this.yard}`;
    const had = this.lines[name];
    if (had && had.key === key) return had.spots;
    const want = build();
    const shift = SHIFTS.find(([dx, dz]) => want.every(([f, x, z]) => this.standable(x + dx, z + dz, f.rig.scale)));
    const spots = new Map(
      want.map(([f, x, z]) => {
        if (shift) return [f, V(x + shift[0], 0, z + shift[1])];
        const p = this.offThings(this.clearOf({ x, z }, 0.5 * f.rig.scale), 0.3 * f.rig.scale);
        return [f, f.brain.clampPoint(p.x, p.z, 0.97)];
      })
    );
    this.lines[name] = { key, spots };
    return spots;
  }

  /** Its place in the family picture: grown foxes in a row, the fox she is with in the middle, the kits in front of them. */
  photoSpot(fox) {
    const spots = this.lineUp('photo', () => {
      const b = this.env.bounds;
      const order = [this.lead].concat(this.foxes.filter((f) => f !== this.lead));
      const big = order.filter((f) => !f.baby);
      const small = order.filter((f) => f.baby);
      const out = (i, gap) => (i === 0 ? 0 : (i % 2 ? -1 : 1) * Math.ceil(i / 2) * gap); // the middle, then left and right of it
      const spots = order.map((f) => {
        if (!big.length) return [f, b.cx + out(small.indexOf(f), 0.42), b.cz + 0.1]; // a litter on its own
        if (!f.baby) return [f, b.cx + out(big.indexOf(f), 0.6), b.cz - 0.12];
        // the kits sit in front, where there is a gap between two grown-ups (so nobody's nose is in anybody's fur)
        const i = small.indexOf(f);
        return [f, b.cx + (i % 2 ? 1 : -1) * (0.3 + 0.6 * Math.floor(i / 2)), b.cz + 0.4];
      });
      // Lorelei stands behind the middle of the row — or, where that is a single fox, beside it
      const row = big.length || small.length;
      spots.push(row > 1 ? [this.owner, b.cx + (row % 2 ? 0 : big.length ? -0.3 : -0.21), b.cz - 0.68] : [this.owner, b.cx + 0.58, b.cz - 0.2]);
      return spots;
    });
    return spots.get(fox) || fox.anim.pos;
  }

  /** Its place while the shop is open: the fox it is about in the middle, the family round it. */
  modelSpot(fox) {
    const spots = this.lineUp('model', () => {
      const b = this.env.bounds;
      const rest = this.foxes.filter((f) => f !== this.focus);
      return this.foxes.map((f) => {
        if (f === this.focus) return [f, b.cx, b.cz + 0.1];
        const [x, z] = [[-0.6, -0.3], [0.6, -0.3], [-1.15, -0.55], [1.15, -0.55], [0, -0.75]][rest.indexOf(f) % 5];
        return [f, b.cx + x, b.cz + 0.1 + z];
      });
    });
    return spots.get(fox) || fox.anim.pos;
  }

  /** The camera while she takes pictures: on the family, as wide as the group, turned and tilted as she left it. */
  updatePhotoCamera(dt) {
    if (!this.foxes.length) return void this.placeCamera();
    let lo = Infinity;
    let hi = -Infinity;
    let z = 0;
    for (const f of this.foxes) {
      const p = this.photoSpot(f);
      lo = Math.min(lo, p.x - 0.2 * f.rig.scale);
      hi = Math.max(hi, p.x + 0.2 * f.rig.scale);
      z += p.z / this.foxes.length;
    }
    // (…and Lorelei, who is a good deal taller than they are)
    const hers = this.photoSpot(this.owner);
    lo = Math.min(lo, hers.x - 0.24);
    hi = Math.max(hi, hers.x + 0.24);
    const w = this.stage.clientWidth;
    const h = this.stage.clientHeight;
    const fit = Math.min((0.74 * w) / (hi - lo + 0.25), (0.54 * h) / (0.2 + this.owner.rig.dims.height * this.owner.rig.size)); // pixels per unit that take the whole group in
    this.zoomNow = damp(this.zoomNow, (this.zoom * fit) / this.basePpu, 5, dt);
    this.pitch = damp(this.pitch, this.orbit.pitch, 10, dt);
    this.yawNow = damp(this.yawNow, this.orbit.yaw, 10, dt);
    // on a tall screen the family stands below the middle of the picture, the scenery over their heads
    const tall = clamp(h / Math.max(1, w) - 1.1, 0, 1);
    this.offset.x = damp(this.offset.x, 0, 7, dt);
    this.offset.y = damp(this.offset.y, -tall * 0.1 * h, 7, dt);
    this.camTarget.x = damp(this.camTarget.x, (lo + hi) / 2, 4, dt);
    this.camTarget.z = damp(this.camTarget.z, z, 4, dt);
    this.camTarget.y = damp(this.camTarget.y, 0.46, 4, dt);
    this.placeCamera();
    this.placeBubble();
  }

  /**
   * The picture she just took: what the camera sees now, on a canvas of its own — larger than
   * the screen (`long` pixels on its longer side), everyone in full fur, none of the game's marks.
   */
  capture(long = 1440) {
    if (!this.stage) return null;
    this.grace();
    const r = this.renderer;
    const keep = { w: this.canvas.width, h: this.canvas.height, ratio: r.getPixelRatio() };
    const w0 = this.stage.clientWidth;
    const h0 = this.stage.clientHeight;
    const k = long / Math.max(w0, h0);
    const W = Math.round(w0 * k);
    const H = Math.round(h0 * k);
    // drawn half as large again and scaled down, so the fur comes out soft
    const over = Math.max(W, H) * 1.5 <= r.capabilities.maxTextureSize ? 1.5 : 1;
    const marks = [this.halo, this.marker, this.ring].map((m) => [m, m.visible]);
    marks.forEach(([m]) => (m.visible = false));
    this.foxes.forEach((f) => f.rig.setShells(16));
    const pxPerUnit = (this.ppu || this.basePpu) * this.zoomNow * k;
    this.foxes.forEach((f) => f.rig.tuneFur(pxPerUnit));
    r.setPixelRatio(1);
    r.setSize(Math.round(W * over), Math.round(H * over), false);
    r.render(this.scene, this.camera);
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const ctx = out.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.canvas, 0, 0, W, H);
    // back to the live view
    marks.forEach(([m, was]) => (m.visible = was));
    r.setPixelRatio(keep.ratio);
    r.setSize(keep.w / keep.ratio, keep.h / keep.ratio, false);
    this.tuneShells();
    this.tuneFur();
    this.draw();
    return out;
  }

  // ---------------------------------------------------------------- the bowl and the ball

  /** The bowl empties as everyone eats their share; what a fox that was called away leaves, the others finish. */
  updateBowl() {
    if (!this.feast) return;
    const bowl = this.things.bowl;
    const left = this.foxes.reduce((s, f) => s + 1 - f.brain.ate, 0) / this.foxes.length;
    if (left < 0.01 || !this.foxes.some((f) => f.brain.busyWith('eat'))) {
      this.feast = false;
      bowl.setLevel(0);
    } else bowl.setLevel(left);
  }

  /** The food is in the bowl — Lorelei has tipped it in (or could not get there): now there is something to eat. */
  fillBowl() {
    this.serving = 0;
    this.things.bowl.setLevel(1);
    this.feast = true;
  }

  /** The ball flies: out of Lorelei's hand (`from`), to come down where she aimed (`to`) — or, without her, in from the front. */
  throwBall(from = null, to = null) {
    const ball = this.things.ball;
    const b = this.env.bounds;
    this.pitching = 0;
    ball.active = true;
    ball.object.visible = true;
    this.ballBusy = null;
    this.ballIdle = 0;
    if (from && to) {
      ball.object.position.copy(from);
      const up = 2.3;
      const air = (up + Math.sqrt(up * up + 13 * Math.max(0.05, from.y - ball.radius))) / 6.5; // how long it is in the air
      ball.vel.set((to.x - from.x) / air, up, (to.z - from.z) / air);
      return;
    }
    ball.object.position.set(b.cx + (Math.random() - 0.5) * 1.2, 0.5, b.cz + b.rz + 0.5);
    const ang = Math.PI + (Math.random() - 0.5) * 1.1; // away from the camera
    ball.vel.set(Math.sin(ang) * 1.5, 1.6, Math.cos(ang) * 1.5);
  }

  kickBall(angle, speed, up) {
    const ball = this.things.ball;
    ball.vel.set(Math.sin(angle) * speed, up, Math.cos(angle) * speed);
  }

  hideBall() {
    this.things.ball.active = false;
    this.things.ball.object.visible = false;
    this.ballBusy = null;
  }

  updateBall(dt) {
    const ball = this.things.ball;
    if (!ball.active) return;
    // put away once nobody is playing with it any more
    this.ballIdle = this.foxes.some((f) => f.brain.busyWith('playBall')) ? 0 : this.ballIdle + dt;
    if (this.ballIdle > 1.2) return this.hideBall();
    const p = ball.object.position;
    const v = ball.vel;
    v.y -= 6.5 * dt;
    p.addScaledVector(v, dt);
    if (p.y < ball.radius) {
      p.y = ball.radius;
      v.y = v.y < -0.5 ? -v.y * 0.55 : 0;
      const drag = Math.exp(-1.6 * dt);
      v.x *= drag;
      v.z *= drag;
    }
    // stay in the yard
    const b = this.env.bounds;
    const k = Math.hypot((p.x - b.cx) / (b.rx * 0.98), (p.z - b.cz) / (b.rz * 0.98));
    if (k > 1 && p.y < 0.4) {
      const nx = (p.x - b.cx) / (b.rx * b.rx);
      const nz = (p.z - b.cz) / (b.rz * b.rz);
      const len = Math.hypot(nx, nz) || 1;
      const dot = (v.x * nx + v.z * nz) / len;
      if (dot > 0) {
        v.x -= (1.7 * dot * nx) / len;
        v.z -= (1.7 * dot * nz) / len;
      }
      p.x = b.cx + (p.x - b.cx) / k;
      p.z = b.cz + (p.z - b.cz) / k;
    }
    // …and it bounces off what she has put there (over what is lower than its flight)
    for (const o of this.decorSolids) {
      if (p.y - ball.radius > o.h) continue;
      const dx = p.x - o.x;
      const dz = p.z - o.z;
      const d = Math.hypot(dx, dz) || 1e-3;
      const r = o.r + ball.radius;
      if (d >= r) continue;
      p.x = o.x + (dx / d) * r;
      p.z = o.z + (dz / d) * r;
      const dot = (v.x * dx + v.z * dz) / d;
      if (dot < 0) {
        v.x -= (1.6 * dot * dx) / d;
        v.z -= (1.6 * dot * dz) / d;
      }
    }
    const roll = Math.hypot(v.x, v.z);
    if (roll > 0.01) ball.object.rotateOnWorldAxis(_w.set(v.z, 0, -v.x).normalize(), (roll * dt) / ball.radius);
  }

  // ---------------------------------------------------------------- tracks & puffs

  clearPrints() {
    _m.makeScale(0, 0, 0);
    _c.setRGB(1, 1, 1);
    for (let i = 0; i < this.prints.count; i++) {
      this.prints.setMatrixAt(i, _m);
      this.prints.setColorAt(i, _c);
    }
    this.printList = [];
    this.prints.instanceMatrix.needsUpdate = true;
    this.prints.instanceColor.needsUpdate = true;
  }

  footfall(p, fox) {
    // a paw in a puddle: a ring on the water (and no print)
    if (this.sky.wet > 0.05 && this.sky.puddleAt(p.x, p.z)) return void this.sky.ring(p.x, p.z, 0.07 + 0.04 * fox.rig.scale, 0.6, 0.6);
    const cfg = this.env && this.env.prints;
    if (!cfg) return;
    const S = fox.rig.scale;
    const i = this.printNext;
    this.printNext = (i + 1) % this.prints.count;
    _m.compose(_w.set(p.x, 0.008, p.z), _q.setFromAxisAngle(_plane.normal, fox.anim.yaw), _v.set(0.026 * S, 1, 0.034 * S));
    this.prints.setMatrixAt(i, _m);
    this.prints.instanceMatrix.needsUpdate = true;
    this.printList = this.printList.filter((x) => x.i !== i);
    this.printList.push({ i, age: 0 });
  }

  updatePrints(dt) {
    const cfg = this.env.prints;
    if (!cfg || !this.printList.length) return;
    this.printList = this.printList.filter((pr) => {
      pr.age += dt;
      const k = Math.min(1, pr.age / cfg.life);
      const f = k < 0.6 ? 0 : (k - 0.6) / 0.4; // fade over the last part of its life
      _c.setRGB(cfg.color[0] + (1 - cfg.color[0]) * f, cfg.color[1] + (1 - cfg.color[1]) * f, cfg.color[2] + (1 - cfg.color[2]) * f);
      this.prints.setColorAt(pr.i, _c);
      return k < 1;
    });
    this.prints.instanceColor.needsUpdate = true;
  }

  /** A landing: snow or dust flies up, or fallen leaves — or water, where it comes down in a puddle. */
  thump(at) {
    if (this.sky.puddleAt(at.x, at.z)) {
      this.sky.splash(at.x, at.z, 1.3);
      return void this.fx.emit('💦', V(at.x, 0.08, at.z), { n: 5, spread: 0.18, rise: 0.7, life: 0.75, size: 0.1, drift: 0.9, gravity: 2.2 });
    }
    const glyph = this.env.snow ? '❄️' : this.env.prints ? '💨' : this.env.litter || '✨';
    this.fx.emit(glyph, V(at.x, 0.06, at.z), { n: 4, spread: 0.14, rise: 0.4, life: 0.7, size: 0.09, drift: 0.5, gravity: 0.6 });
  }

  // ---------------------------------------------------------------- pictures for the shop

  /**
   * A small picture as a data URL: 'fox' (id = which fox, wearing `worn`, a kit `grown` this far), 'scene' (id = habitat)
   * or 'decor' (id = a thing for the yard). Drawn with this same renderer, at once, then the real view is drawn again.
   */
  snapshot(kind, id, { worn = [], size = 220, bg = '#ffe9f3', grown = 0, season = null } = {}) {
    const key = `${kind}:${id}:${grown}:${worn.join()}:${size}:${bg}:${season || ''}`;
    if (this.thumbs.has(key)) return this.thumbs.get(key);
    this.grace();
    const r = this.renderer;
    const keep = { w: this.canvas.width, h: this.canvas.height, ratio: r.getPixelRatio() };
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(26, kind === 'scene' ? 4 / 3 : 1, 0.2, 40);
    let cleanup;
    const w = size;
    const h = kind === 'scene' ? Math.round((size * 3) / 4) : size;
    if (kind === 'scene') {
      const env = buildHabitat(id, season, { small: true });
      const L = env.day;
      scene.background = new THREE.Color(L.bg);
      const hemi = new THREE.HemisphereLight(L.sky, L.ground, L.hemi);
      const sun = new THREE.DirectionalLight(L.sun, L.sunI);
      sun.position.set(L.pos[0], L.pos[1], L.pos[2] - 0.3);
      sun.target.position.set(0, 0, -0.3);
      sun.castShadow = true;
      sun.shadow.mapSize.setScalar(1024);
      Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 22 });
      sun.shadow.bias = -0.0008;
      scene.add(env.group, hemi, sun, sun.target);
      env.setNight(false);
      env.update(0.016, 3, { night: false, hemi, foxes: [], yard: 1 });
      // a lower, wider look than the live camera, so the scenery shows
      const dist = 8.4;
      const pitch = 0.74;
      camera.position.set(0, 0.2 + Math.sin(pitch) * dist, -0.75 + Math.cos(pitch) * dist);
      camera.lookAt(0, 0.2, -0.75);
      cleanup = () => {
        env.dispose();
        sun.shadow.map && sun.shadow.map.dispose();
      };
    } else if (kind === 'decor') {
      const it = makeDecor(id);
      if (!it) return '';
      const [dist, look] = it.def.view;
      it.object.rotation.y = it.yaw = -0.6;
      if (it.update) it.update(0.016, 2, { night: false });
      scene.background = new THREE.Color(bg);
      scene.environment = this.scene.environment;
      scene.environmentIntensity = 0.5;
      const hemi = new THREE.HemisphereLight('#ffffff', '#f3d9e4', 2.0);
      const sun = new THREE.DirectionalLight('#fff3e2', 2.0);
      sun.position.set(-2, 4, 3);
      scene.add(it.object, hemi, sun);
      camera.position.set(0, look + dist * 0.62, dist * 0.8);
      camera.lookAt(0, look, 0);
      cleanup = () => disposeTree(it.object);
    } else {
      const rig = buildFox(id, { grown });
      const anim = new FoxAnimator(rig);
      anim.yaw = 0.5;
      anim.snap();
      anim.setPose('sit', 30);
      anim.look = V(1.2, 0.75, 2.4);
      anim.lookW = 1;
      anim.twitchT = anim.blinkT = 99;
      for (let i = 0; i < 80; i++) anim.update(1 / 30);
      const accs = worn.map((a) => makeAccessory(a, rig)).filter(Boolean);
      accs.forEach((a) => rig.bones[a.bone].add(a.object));
      scene.background = new THREE.Color(bg);
      scene.environment = this.scene.environment;
      scene.environmentIntensity = 0.5;
      const hemi = new THREE.HemisphereLight('#ffffff', '#f3d9e4', 2.0);
      const sun = new THREE.DirectionalLight('#fff3e2', 2.0);
      sun.position.set(-2, 4, 4);
      scene.add(rig.group, hemi, sun);
      rig.group.updateMatrixWorld(true);
      // frame the head and chest
      const head = anim.headPoint(V());
      const S = rig.scale;
      const top = head.y + rig.dims.earH * S * 0.85;
      const centre = V(head.x * 0.7, top * 0.56, head.z * 0.6);
      const dist = (top * 0.54) / Math.tan((26 * Math.PI) / 360);
      camera.position.set(centre.x + dist * 0.4, centre.y + dist * 0.38, centre.z + dist * 0.83);
      camera.lookAt(centre);
      const pxPerUnit = h / (2 * dist * Math.tan((26 * Math.PI) / 360));
      rig.tuneFur(pxPerUnit);
      cleanup = () => {
        accs.forEach((a) => disposeTree(a.object));
        rig.dispose();
      };
    }
    // drawn at twice the size and scaled down: fur this small is all fine strands, and they come out soft instead of speckled
    r.setPixelRatio(1);
    r.setSize(w * 2, h * 2, false);
    r.render(scene, camera);
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.canvas, 0, 0, w, h);
    const url = out.toDataURL('image/webp', 0.9);
    cleanup();
    // back to the live view
    r.setPixelRatio(keep.ratio);
    r.setSize(keep.w / keep.ratio, keep.h / keep.ratio, false);
    if (this.stage) this.draw();
    this.thumbs.set(key, url);
    return url;
  }
}

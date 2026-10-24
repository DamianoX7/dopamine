// The foxes: proportions and coat colours of each kind. rig.js turns one of these into a
// model; the names and prices shown in the shop live in js/pet.js (same ids).
//
// Sizes are multipliers on the red fox, colours are sRGB hex. `paint(part, col, info)` can
// repaint any vertex after the standard coat (saddle, belly, socks, tail tip) has been applied:
// info.v runs 0 … 1 along the part, info.s / info.c are the sine / cosine of the angle around it,
// info.P is the place in the model and, on the head, info.H the place in the head's own space.

import { ANIMUD } from './animud.js';

const RED = {
  size: 1,
  leg: 0.93, //     leg length
  legR: 1, //       leg thickness
  girth: 1.05, //   body thickness
  bodyLen: 1,
  neck: 1, //       neck length
  head: 1.2,
  skull: 1, //      width of the head behind the muzzle
  crown: 1, //      height of the head above the eyes
  boxy: 0, //       how square the skull is (0 = round)
  jowl: 0, //       heavy cheeks: how much wider the face is below the eyes than above them
  ruff: 1, //       size of the tufts on the cheeks (0 = none)
  muzzle: 0.86, //  muzzle length
  snout: 1, //      muzzle thickness
  eye: 1,
  lids: 0, //       0 = round button eyes; above that real eyes, and how far their lids are closed
  earH: 0.125,
  earW: 0.09,
  earRound: 0, //   0 = pointed, 1 = rounded
  earSpread: 0.3, // how far the ears lean apart (radians)
  earSet: 1, //     how far apart the ears sit
  tailLen: 1,
  tailR: 1,
  tails: 1,
  tailFan: 1.05, // how wide several tails spread (radians to either side)
  tailLift: -0.3, // how a single tail is carried (radians above level)
  fur: 1, //        fur length
  tipAmt: 0, //     how strongly the tips of the fur take `tip`
  // where a sweater goes (knit.js), in keys of the lofts of the torso and the forelegs (rig.js): its hem — further back
  // along the spine than under the belly — its collar, and how far down the forelegs its sleeves reach
  knit: { hemTop: 3.3, hemBelly: 4.5, collar: 8.6, sleeveFrom: 0, sleeve: 3.1 },
  colors: {
    coat: '#de6a1f',
    back: '#b24a14',
    belly: '#fff7ee',
    sock: '#2a1b18',
    earBack: '#2a1a17',
    earIn: '#ffe9dc',
    earTip: '#221614',
    tailTip: '#fffaf3',
    nose: '#1c1312',
    eye: '#2b1509',
    tongue: '#f48aa2',
    tip: '#ffffff',
  },
};

const make = (over) => ({ ...RED, ...over, colors: { ...RED.colors, ...(over.colors || {}) } });

export const SPECIES = {
  red: RED,

  // Fennec: tiny and sand-coloured, with enormous round-tipped ears set wide apart, a small pale face
  // with a dark streak from each eye down the muzzle, white legs and a black tip to the tail.
  fennec: make({
    size: 0.8,
    leg: 0.9,
    legR: 0.86,
    girth: 0.92,
    head: 1.2,
    muzzle: 0.74,
    snout: 0.82,
    eye: 1.15,
    ruff: 0.6,
    earSet: 1.18,
    earH: 0.225,
    earW: 0.16,
    earRound: 0.35,
    earSpread: 0.55,
    tailLen: 0.9,
    tailR: 0.92,
    fur: 0.95,
    colors: {
      coat: '#e9c791',
      back: '#d7a96f',
      belly: '#fffaf0',
      sock: '#fbf1dd',
      earBack: '#e9c890',
      earIn: '#f6d8cc',
      earTip: '#e2bd84',
      tailTip: '#2e2118',
      eye: '#1d0f08',
    },
    paint(part, col, i) {
      const S = i.smooth;
      if (part === 'head') {
        const H = i.H;
        const ax = Math.abs(H.x);
        col.lerp(i.C.belly, S(0.02, 0.05, ax) * S(0.075, 0.045, H.y) * S(0.02, 0.06, H.z) * 0.75); // a pale face around the eyes
        // the streak from under each eye along the side of the muzzle (it follows one row of the mesh, to stay a clean line)
        col.lerp(i.C.streak, S(0.2, 0.38, i.s) * S(0.62, 0.42, i.s) * S(0.076, 0.092, H.z) * S(0.15, 0.12, H.z) * 0.8);
      }
      if (part === 'ear') col.lerp(i.C.belly, i.front * S(0.45, 0.9, Math.abs(i.c)) * S(0.95, 0.6, i.v) * 0.8); // white hair along the edges, inside
      // (around a tail, which points backwards, s = 1 is underneath)
      if (part === 'tail') col.lerp(i.C.tailTip, S(0.04, 0.1, i.v) * S(0.24, 0.15, i.v) * S(-0.2, -0.8, i.s) * 0.55); // the dark patch near its root
    },
    extra: { streak: '#9a5f2e' },
  }),

  // Arctic fox in its winter coat: round, short-legged, small round ears, all white.
  arctic: make({
    size: 0.9,
    leg: 0.82,
    legR: 1.22,
    girth: 1.13,
    bodyLen: 0.94,
    head: 1.12,
    muzzle: 0.76,
    eye: 1.05,
    earH: 0.07,
    earW: 0.078,
    earRound: 1,
    earSpread: 0.42,
    tailLen: 0.95,
    tailR: 1.2,
    fur: 1.45,
    colors: {
      coat: '#f4f8fc',
      back: '#e3ecf5',
      belly: '#ffffff',
      sock: '#eef3f9',
      earBack: '#e9eff6',
      earIn: '#e9d3d3',
      earTip: '#eef3f9',
      tailTip: '#ffffff',
      eye: '#20130c',
    },
  }),

  // Silver fox: a black coat frosted with silver, and the white tail tip every red fox has.
  silver: make({
    tipAmt: 0.36,
    fur: 1.1,
    colors: {
      coat: '#2f3038',
      back: '#1d1e24',
      belly: '#3a3b44',
      sock: '#15151a',
      earBack: '#131317',
      earIn: '#6a5c60',
      earTip: '#101014',
      tailTip: '#f7f8fb',
      tip: '#cfd4de',
      eye: '#3a2208',
    },
    paint(part, col, i) {
      // a pale mask around the muzzle keeps the face readable on a dark head
      if (part === 'head') col.lerp(i.C.pale, i.muzzle * 0.55);
    },
    extra: { pale: '#9a9ca8' },
  }),

  // Marble fox: white, with charcoal ears, eye stripes and a line down the back and tail.
  marble: make({
    fur: 1.2,
    girth: 1.04,
    colors: {
      coat: '#f7f5f2',
      back: '#f1eeea',
      belly: '#ffffff',
      sock: '#efece8',
      earBack: '#3a3638',
      earIn: '#f3cfc8',
      earTip: '#2c292b',
      tailTip: '#ffffff',
      eye: '#2a1608',
    },
    paint(part, col, i) {
      const ink = i.C.ink;
      if (part === 'torso') col.lerp(ink, i.smooth(0.82, 0.97, i.s) * i.smooth(0.9, 0.55, i.v) * 0.9);
      if (part === 'tail') col.lerp(ink, i.smooth(0.7, 0.95, i.s) * i.smooth(0.72, 0.5, i.v) * 0.85);
      if (part === 'head') {
        // from above each eye up to the ear, plus a touch on the brow
        const side = i.smooth(0.2, 0.55, Math.abs(i.c)) * i.smooth(0.05, 0.45, i.s);
        col.lerp(ink, side * i.smooth(0.3, 0.42, i.v) * i.smooth(0.66, 0.52, i.v) * 0.92);
      }
    },
    extra: { ink: '#3b3739' },
  }),

  // Tibetan fox in its winter coat, after photographs: a broad square head with pale cheek ruffs, small
  // narrow amber eyes, small ears at the corners of the skull, a stocky body on short legs. A tan
  // saddle from the crown to the hips, grey flanks, a dark rump, a short bushy tail that ends white.
  tibetan: make({
    size: 0.98,
    leg: 0.8,
    legR: 1.25,
    girth: 1.3,
    bodyLen: 0.95,
    neck: 0.66,
    head: 1.1,
    skull: 1.2,
    crown: 0.86,
    boxy: 0.5,
    jowl: 0.4,
    ruff: 0,
    muzzle: 0.9,
    snout: 0.74,
    eye: 1.15,
    lids: 0.58,
    earSet: 1.2,
    earH: 0.06,
    earW: 0.07,
    earRound: 0.1,
    earSpread: 0.36,
    tailLen: 0.52,
    tailR: 0.98,
    tailLift: -0.85,
    fur: 0.85,
    colors: {
      coat: '#a8905e',
      back: '#9c7848',
      belly: '#e6e0d2',
      sock: '#c2a06c',
      earBack: '#b09e70',
      earIn: '#a08e6c',
      earTip: '#a38d5c',
      tailTip: '#ebe6da',
      eye: '#16100c',
      iris: '#b3aa6e',
      lid: '#a39468',
    },
    paint(part, col, i) {
      const { grey, dark, cream } = i.C;
      const S = i.smooth;
      if (part === 'torso') {
        const side = S(-0.8, -0.5, i.s); //                           all but the narrow white belly
        col.lerp(i.C.back, S(0.35, 0.75, i.s) * 0.5); //              an ochre saddle…
        col.lerp(grey, S(0.5, 0.3, i.s) * side * 0.92); //            …over grey flanks, shoulders and neck
        col.lerp(grey, S(0.3, 0.12, i.v) * side * 0.9); //            the saddle gives out over the hips
        col.lerp(dark, S(0.25, 0.05, i.v) * S(-0.3, 0.4, i.s) * 0.85); // a dark rump
        col.lerp(dark, S(0.64, 0.7, i.v) * S(0.84, 0.76, i.v) * S(0.35, 0.1, i.s) * S(-0.6, -0.3, i.s) * 0.75); // the dark band down the side of the neck
      }
      if (part === 'leg') {
        col.lerp(grey, S(0.42, 0.22, i.v) * 0.9); //                                 grey shoulders and thighs over tan legs
        col.lerp(cream, S(0.2, 0.8, -i.c * Math.sign(i.P.x)) * S(0.3, 0.5, i.v) * 0.6); // pale on the inside
        col.lerp(cream, S(0.8, 1, i.v) * 0.5);
      }
      if (part === 'paw') col.lerp(cream, 0.55);
      // (around a tail, which points backwards, s = 1 is underneath)
      if (part === 'tail') col.copy(grey).lerp(dark, S(0.5, -0.7, i.s) * 0.9).lerp(i.C.tailTip, S(0.42, 0.6, i.v));
      if (part === 'head') {
        // cream cheeks: all of the face beside the eyes and under them — the tan of the crown only runs on down the bridge of the muzzle
        const H = i.H;
        const ax = Math.abs(H.x);
        const cheek = Math.max(S(0.045, 0.07, ax) * S(0.075, 0.04, H.y), S(0.018, 0.04, ax) * S(0.04, 0.012, H.y));
        col.copy(i.C.buff).lerp(cream, cheek * S(-0.05, -0.01, H.z));
        col.lerp(cream, S(0.13, 0.19, H.z) * 0.5); //                      …and pales towards the nose
        col.lerp(i.C.belly, S(0, -0.03, H.y) * S(0, 0.04, H.z) * S(0.075, 0.035, ax) * 0.8); // white lips, chin and throat
        col.lerp(grey, S(-0.01, -0.05, H.z) * S(0.05, 0.02, H.y) * 0.6); // behind the cheeks the head greys into the neck
      }
    },
    extra: { grey: '#8e8a83', dark: '#56534f', cream: '#c4baa4', buff: '#b5a274' },
  }),

  // Gumiho: the nine-tailed fox of the old stories — pearl white, rose-tipped, nine tails.
  gumiho: make({
    size: 1.04,
    head: 1.12,
    earH: 0.14,
    tails: 9,
    tailLen: 1.15,
    tailR: 0.62,
    fur: 1.25,
    tipAmt: 0.5,
    glow: true,
    colors: {
      coat: '#fff4e2',
      back: '#ffe6c7',
      belly: '#ffffff',
      sock: '#ffd9c9',
      earBack: '#ffc2c4',
      earIn: '#ffd3da',
      earTip: '#ff7fa8',
      tailTip: '#ff86ae',
      tip: '#ffd0de',
      nose: '#3a1d24',
      eye: '#5a1620',
    },
    paint(part, col, i) {
      // the red mark of a spirit fox on the brow
      if (part === 'head') col.lerp(i.C.mark, i.smooth(0.9, 0.98, i.s) * i.smooth(0.3, 0.38, i.v) * i.smooth(0.56, 0.46, i.v));
    },
    extra: { mark: '#e8375f' },
  }),

  // Animud: not a kind of fox, but a fox of her own making (animud.js). It is a gift, and has no kits.
  animud: make(ANIMUD),
};

// A kit of any kind ("<id>-baby"): small, with a cub's big head and eyes, short muzzle, rounder
// ears, stubby legs and a lot of fluff. A nine-tailed kit has only grown three tails so far.
const kit = (sp) => ({
  ...sp,
  baby: true,
  size: sp.size * 0.62,
  leg: Math.max(0.8, sp.leg * 0.9),
  legR: sp.legR * 1.18,
  girth: sp.girth * 1.06,
  bodyLen: sp.bodyLen * 0.84,
  head: sp.head * 1.2,
  muzzle: sp.muzzle * 0.64,
  eye: sp.eye * 1.1,
  earH: sp.earH * 0.8,
  earW: sp.earW * 0.95,
  earRound: Math.min(1, sp.earRound + 0.35),
  tailLen: sp.tailLen * 0.72,
  tailR: sp.tails > 1 ? 0.8 : sp.tailR * 0.95,
  tails: sp.tails > 1 ? 3 : 1,
  tailFan: 0.55,
  fur: sp.fur * 1.2,
});

const KITS = {};

/** A fox's id is its kind ("red", "red-baby") — with "~2", "~3"… when she has more than one of a kind. */
export const kindOf = (id) => String(id).split('~')[0];
export const isBaby = (id) => kindOf(id).endsWith('-baby');

/**
 * The proportions of a fox. A kit grows up in steps: `grown` (0 … 1) says how far along it is,
 * and everything about it — size, legs, muzzle, even the number of a spirit fox's tails — lies
 * that far between the kit and the grown fox of its kind.
 */
export function speciesOf(id, grown = 0) {
  const kind = kindOf(id);
  if (!isBaby(kind)) return SPECIES[kind] || SPECIES.red;
  const adult = SPECIES[kind.slice(0, -5)] || SPECIES.red;
  const g = Math.max(0, Math.min(0.99, grown));
  const key = `${kind}@${g.toFixed(2)}`;
  if (!KITS[key]) {
    const young = kit(adult);
    if (g > 0) {
      for (const k in young) if (typeof young[k] === 'number' && typeof adult[k] === 'number') young[k] += (adult[k] - young[k]) * g;
      young.leg = Math.max(0.8, young.leg);
      if (adult.tails > 1) young.tails = Math.min(adult.tails - 2, 3 + 2 * Math.round(g * 3));
    }
    KITS[key] = young;
  }
  return KITS[key];
}

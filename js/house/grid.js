// The neighbourhood's ground as squares (town.js): open, or not — under a wall, a shelf, a tree — and what each costs to
// cross (the road more than the pavement, but for the zebra crossing: she crosses where one crosses). A* finds her way
// over it, and the way is then cut short wherever she can walk straight on. (The house has its own, older copy of this,
// for its one room: world.js.)
import * as THREE from '../vendor/three.module.min.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class Grid {
  /** Squares of `cell` over x0 … x1, z0 … z1 (all open, at a cost of 1). */
  constructor(x0, x1, z0, z1, cell = 0.25) {
    this.x0 = x0;
    this.z0 = z0;
    this.cell = cell;
    this.nx = Math.ceil((x1 - x0) / cell);
    this.nz = Math.ceil((z1 - z0) / cell);
    this.open = new Uint8Array(this.nx * this.nz).fill(1);
    this.cost = new Float32Array(this.nx * this.nz).fill(1);
  }

  /** Every square whose middle is in the rectangle (x0 … x1, z0 … z1, grown by `pad`): shut (or given `cost`). */
  rect(x0, x1, z0, z1, { pad = 0, open = 0, cost = null } = {}) {
    const c = this.cell;
    for (let i = 0; i < this.nx; i++) {
      const x = this.x0 + (i + 0.5) * c;
      if (x < Math.min(x0, x1) - pad || x > Math.max(x0, x1) + pad) continue;
      for (let j = 0; j < this.nz; j++) {
        const z = this.z0 + (j + 0.5) * c;
        if (z < Math.min(z0, z1) - pad || z > Math.max(z0, z1) + pad) continue;
        const k = i + j * this.nx;
        if (cost != null) this.cost[k] = cost;
        else this.open[k] = open;
      }
    }
  }

  /** …or a round thing (a tree, a lamp post). */
  disc(x, z, r) {
    const c = this.cell;
    for (let i = 0; i < this.nx; i++)
      for (let j = 0; j < this.nz; j++) {
        const cx = this.x0 + (i + 0.5) * c;
        const cz = this.z0 + (j + 0.5) * c;
        if (Math.hypot(cx - x, cz - z) < r) this.open[i + j * this.nx] = 0;
      }
  }

  /** A wall from (ax, az) to (bx, bz), `t` thick — with the gaps in it (doors) left open: [[u0, u1]] along it from a. */
  wall(ax, az, bx, bz, t = 0.14, gaps = []) {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.ceil(len / (this.cell * 0.5));
    for (let s = 0; s <= n; s++) {
      const u = (s / n) * len;
      if (gaps.some(([g0, g1]) => u > g0 && u < g1)) continue;
      const x = ax + ((bx - ax) * u) / len;
      const z = az + ((bz - az) * u) / len;
      this.disc(x, z, t / 2 + this.cell * 0.55);
    }
  }

  cellOf(p) {
    return [clamp(Math.floor((p.x - this.x0) / this.cell), 0, this.nx - 1), clamp(Math.floor((p.z - this.z0) / this.cell), 0, this.nz - 1)];
  }

  centre(i, j) {
    return V(this.x0 + (i + 0.5) * this.cell, 0, this.z0 + (j + 0.5) * this.cell);
  }

  isOpen(p) {
    const [i, j] = this.cellOf(p);
    return !!this.open[i + j * this.nx];
  }

  /** The open square nearest to `p` (within `reach` squares). */
  nearestOpen(p, reach = 40) {
    const [ci, cj] = this.cellOf(p);
    let best = null;
    let bd = Infinity;
    for (let i = Math.max(0, ci - reach); i <= Math.min(this.nx - 1, ci + reach); i++)
      for (let j = Math.max(0, cj - reach); j <= Math.min(this.nz - 1, cj + reach); j++) {
        if (!this.open[i + j * this.nx]) continue;
        const d = (i - ci) ** 2 + (j - cj) ** 2;
        if (d < bd) {
          bd = d;
          best = [i, j];
        }
      }
    return best;
  }

  /** A way from `from` to `to`: the points to walk to — or null if there is none. */
  path(from, to) {
    const s = this.nearestOpen(from);
    const t = this.nearestOpen(to);
    if (!s || !t) return null;
    const nx = this.nx;
    const key = (i, j) => i + j * nx;
    const g = new Float32Array(this.nx * this.nz).fill(Infinity);
    const came = new Int32Array(this.nx * this.nz).fill(-1);
    const done = new Uint8Array(this.nx * this.nz);
    // (a binary heap of [f, key])
    const heap = [];
    const push = (f, k) => {
      heap.push([f, k]);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    const h = (i, j) => Math.hypot(i - t[0], j - t[1]);
    const sk = key(s[0], s[1]);
    const tk = key(t[0], t[1]);
    g[sk] = 0;
    push(h(s[0], s[1]), sk);
    let found = false;
    let guard = 0;
    while (heap.length && guard++ < 60000) {
      const [, k] = pop();
      if (done[k]) continue;
      done[k] = 1;
      if (k === tk) {
        found = true;
        break;
      }
      const i = k % nx;
      const j = (k - i) / nx;
      for (let di = -1; di <= 1; di++)
        for (let dj = -1; dj <= 1; dj++) {
          if (!di && !dj) continue;
          const ni = i + di;
          const nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= this.nx || nj >= this.nz) continue;
          const nk = key(ni, nj);
          if (!this.open[nk] || done[nk]) continue;
          if (di && dj && (!this.open[key(i + di, j)] || !this.open[key(i, j + dj)])) continue; // (no cutting a corner)
          const c = g[k] + (di && dj ? 1.414 : 1) * (this.cost[k] + this.cost[nk]) * 0.5;
          if (c < g[nk]) {
            g[nk] = c;
            came[nk] = k;
            push(c + h(ni, nj), nk);
          }
        }
    }
    if (!found) return null;
    const cells = [];
    for (let k = tk; k !== -1; k = came[k]) {
      cells.push([k % nx, Math.floor(k / nx)]);
      if (k === sk) break;
    }
    cells.reverse();
    // (straight on wherever she can see her way — and the squares on the way cost no more than going round)
    const pts = [];
    let a = 0;
    while (a < cells.length - 1) {
      let b = cells.length - 1;
      while (b > a + 1 && !this.clearLine(cells[a], cells[b])) b--;
      pts.push(this.centre(...cells[b]));
      a = b;
    }
    if (to.distanceTo(this.centre(...t)) < this.cell * 1.5) pts.push(V(to.x, 0, to.z));
    return pts;
  }

  /** Can she walk straight from one square to the other (nothing shut in between, and no dearer ground than the ends)? */
  clearLine(a, b) {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2);
    const ends = Math.max(this.cost[a[0] + a[1] * this.nx], this.cost[b[0] + b[1] * this.nx]);
    for (let k = 0; k <= n; k++) {
      const i = Math.round(a[0] + ((b[0] - a[0]) * k) / n);
      const j = Math.round(a[1] + ((b[1] - a[1]) * k) / n);
      const q = i + j * this.nx;
      if (!this.open[q] || this.cost[q] > ends + 1e-3) return false;
    }
    return true;
  }

  /** Somewhere open, near `p` (within `r`) — or anywhere. */
  randomNear(p, r) {
    const list = [];
    for (let i = 0; i < this.nx; i++)
      for (let j = 0; j < this.nz; j++) {
        if (!this.open[i + j * this.nx]) continue;
        const c = this.centre(i, j);
        if (!p || Math.hypot(c.x - p.x, c.z - p.z) < r) list.push(c);
      }
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }
}

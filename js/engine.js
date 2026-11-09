// Core engine for the MozPong port: 8-bit-era QuickDraw-style rects,
// the SAT sprite list, fixed-point maths and the deterministic random source.

export const SCREEN_W = 512;
export const SCREEN_H = 400;

// ---------------------------------------------------------------------------
// Toolbox rectangle helpers.  SAT's internal rect order is left, top, right,
// bottom (QuickDraw's SetRect argument order); Mac Rect fields are stored in
// that same order by SAT.
// ---------------------------------------------------------------------------
export function makeRect(left = 0, top = 0, right = 0, bottom = 0) {
  return { left, top, right, bottom };
}

export function setRect(r, left, top, right, bottom) {
  r.left = left | 0;
  r.top = top | 0;
  r.right = right | 0;
  r.bottom = bottom | 0;
  return r;
}

export function copyRect(dst, src) {
  dst.left = src.left;
  dst.top = src.top;
  dst.right = src.right;
  dst.bottom = src.bottom;
  return dst;
}

export function offsetRect(r, dx, dy) {
  r.left += dx | 0;
  r.top += dy | 0;
  r.right += dx | 0;
  r.bottom += dy | 0;
  return r;
}

export function insetRect(r, dx, dy) {
  r.left = (r.left + dx) | 0;
  r.top = (r.top + dy) | 0;
  r.right = (r.right - dx) | 0;
  r.bottom = (r.bottom - dy) | 0;
  return r;
}

export function sectRect(a, b, out = makeRect()) {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.right, b.right);
  const bottom = Math.min(a.bottom, b.bottom);
  if (left < right && top < bottom) {
    out.left = left;
    out.top = top;
    out.right = right;
    out.bottom = bottom;
    return true;
  }
  out.left = out.top = out.right = out.bottom = 0;
  return false;
}

export function ptInRect(r, x, y) {
  return x >= r.left && x < r.right && y >= r.top && y < r.bottom;
}

export function rectsOverlap(a, b) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

// Stores a signed 16-bit value the way the original's `sth` does.
export function s16(x) {
  return (x << 16) >> 16;
}
export function u16(x) {
  return x & 0xffff;
}
// C signed division truncates toward zero; JS Math.trunc gives the same.
export function idiv(a, b) {
  return Math.trunc(a / b);
}
export function imod(a, b) {
  return a % b;
}

// ---------------------------------------------------------------------------
// Toolbox random.  QuickDraw's Random is the Park-Miller minimal standard
// generator: seed = seed * 16807 mod (2^31 - 1), and the 16-bit result is the
// high half.  The original game never calls SetRandSeed, so the seed comes
// from the OS.  We start from 1 (the usual Mac OS boot seed) and expose
// setSeed() so a recorded session can be replayed with the real seed later.
// ---------------------------------------------------------------------------
export const rand = {
  seed: 1,
  setSeed(s) { this.seed = (s >>> 0) % 2147483647 || 1; },
  next16() {
    // 16807 * 2^31 exceeds 2^53?  16807 * 2^31 ~= 3.6e13, well below 2^53,
    // so plain Number arithmetic is exact here.
    this.seed = (this.seed * 16807) % 2147483647;
    return Math.floor(this.seed / 65536) & 0xffff;
  },
};

export function SATRand(range) {
  // abs(Random()) % range, with C's truncating remainder.
  return Math.abs(rand.next16()) % range;
}

// ---------------------------------------------------------------------------
// Tick counter, 60 ticks per second.
// ---------------------------------------------------------------------------
export const clock = {
  ticks: 0,
  TickCount() { return this.ticks; },
  advance(n = 1) { this.ticks += n; },
};

// ---------------------------------------------------------------------------
// Sprite record.  The original is a 170-byte record; the names below follow the
// byte offsets used by the game code.  (Offsets in comments are from the PPC
// analysis.)
// ---------------------------------------------------------------------------
export class Sprite {
  constructor(kind, h, v) {
    this.kind = kind | 0;              // +0x00
    this.v = v | 0;                    // +0x02
    this.h = h | 0;                    // +0x04
    this.local = makeRect();           // +0x06 left, +0x08 top, +0x0a right, +0x0c bottom
    this.screen = makeRect();          // +0x0e .. +0x14
    this.face = null;                  // +0x16
    this.handle = null;                // +0x1a
    this.hit = null;                   // +0x1e
    this.drawProc = 0;                 // +0x22 (unused by the game)
    this.extra26 = 0;                  // +0x26
    this.cachedPos = 0;                // +0x2a (v<<16 | h)
    this.next = null;                  // +0x2e
    this.prev = null;                  // +0x32
    this.destRect = makeRect();        // +0x36 .. +0x3d  (top, left, right, bottom)
    this.prevDrawn = makeRect();       // +0x3e .. +0x45
    this.cachedFace = null;            // +0x46
    this.dirty = false;                // +0x4a
    this.layer = 0;                    // +0x4c
    this.subtype = 0;                  // +0x4e
    this.angle = 0;                    // +0x52
    this.angle2 = 0;                   // +0x56
    this.anim = 0;                     // +0x5a
    this.speed = 0;                    // +0x5e
    this.state = 0;                    // +0x62
    this.extra66 = 0;                  // +0x66
    this.dir = -1;                     // +0x6a
    this.x = 0;                        // +0x6e fixed 20.12
    this.y = 0;                        // +0x72
    this.oldX = 0;                     // +0x76
    this.oldY = 0;                     // +0x7a
    this.count = 0;                    // +0x7e
    this.count2 = 0;                   // +0x82
    this.otherV = 0;                   // +0x86 (hitButa: saved other.v)
    this.otherH = 0;                   // +0x88 (hitButa: saved other.h)
    this.savedV = 0;                   // +0x8a (hitButa: first-contact other.v)
    this.h2 = 0;                       // +0x8c (MozMoz: home H; hitButa: first-contact other.h)
    this.intactFace = null;            // +0x8e (egg resource face)
    this.sub = null;                   // +0x92
    this.t96 = 0;                      // +0x96
    this.t98 = 0;                      // +0x98
    this.t9a = 0;                      // +0x9a
    this.t9e = 0;                      // +0x9e
    this.tA0 = 0;                      // +0xa0
  }
}

// ---------------------------------------------------------------------------
// SAT face.  PICT faces are composed from a colour PICT and a 1-bit mask;
// cicn faces already carry transparency.
// ---------------------------------------------------------------------------
export class Face {
  constructor(width, height) {
    this.width = width | 0;
    this.height = height | 0;
    this.rgba = new Uint8ClampedArray(this.width * this.height * 4);
    this.id = 0;       // cicn resource id (0 for PICT faces)
    this.drawProc = 0; // face+0x2a
  }

  static fromPICT(colorCanvas, maskCanvas) {
    const w = colorCanvas.width;
    const h = colorCanvas.height;
    const face = new Face(w, h);
    const c = colorCanvas.data;
    const m = maskCanvas.data;
    const out = face.rgba;
    // The mask PICT is 1-bit black/white.  Black means "copy the colour".
    for (let i = 0, n = w * h; i < n; i++) {
      const mi = i * 4;
      // If the mask is the same size; resource_dasm always produces matching
      // dimensions for the face pairs used by the game.
      const opaque = m[mi] < 128; // black -> opaque
      if (opaque) {
        const oi = i * 4;
        out[oi] = c[oi];
        out[oi + 1] = c[oi + 1];
        out[oi + 2] = c[oi + 2];
        out[oi + 3] = 255;
      }
    }
    return face;
  }

  static fromIcon(canvas) {
    const face = new Face(canvas.width, canvas.height);
    face.rgba.set(canvas.data);
    return face;
  }
}

// ---------------------------------------------------------------------------
// Framebuffer.  We keep RGBA, but all drawing is a straight CopyBits/CopyMask
// style copy rather than canvas blending.  That matches the original 8-bit
// framebuffer and avoids fractional-pixel/antialias surprises.
// ---------------------------------------------------------------------------
export class Framebuffer {
  constructor(width = SCREEN_W, height = SCREEN_H) {
    this.width = width;
    this.height = height;
    this.rgba = new Uint8ClampedArray(width * height * 4);
  }

  clear(r = 255, g = 255, b = 255) {
    const d = this.rgba;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
  }

  // Copy a full image (used for backgrounds and PICTs drawn directly).
  blitImage(img, dx, dy, sx = 0, sy = 0, sw = img.width, sh = img.height) {
    dx = Math.trunc(dx); dy = Math.trunc(dy);
    sx = Math.trunc(sx); sy = Math.trunc(sy);
    const src = img.data;
    const swidth = img.width;
    const dst = this.rgba;
    const dwidth = this.width;
    for (let y = 0; y < sh; y++) {
      const ty = dy + y;
      if (ty < 0 || ty >= this.height) continue;
      for (let x = 0; x < sw; x++) {
        const tx = dx + x;
        if (tx < 0 || tx >= this.width) continue;
        const si = ((sy + y) * swidth + (sx + x)) * 4;
        const di = (ty * dwidth + tx) * 4;
        dst[di] = src[si];
        dst[di + 1] = src[si + 1];
        dst[di + 2] = src[si + 2];
        dst[di + 3] = 255;
      }
    }
  }

  // Copy a masked face at (dx,dy).  Dest pixels are untouched where the face is
  // transparent.  Returns nothing.
  blitFace(face, dx, dy) {
    dx = Math.trunc(dx); dy = Math.trunc(dy);
    const src = face.rgba;
    const fw = face.width;
    const dst = this.rgba;
    const dw = this.width;
    for (let y = 0; y < face.height; y++) {
      const ty = dy + y;
      if (ty < 0 || ty >= this.height) continue;
      for (let x = 0; x < fw; x++) {
        const tx = dx + x;
        if (tx < 0 || tx >= this.width) continue;
        const si = (y * fw + x) * 4;
        if (src[si + 3] === 0) continue;
        const di = (ty * dw + tx) * 4;
        dst[di] = src[si];
        dst[di + 1] = src[si + 1];
        dst[di + 2] = src[si + 2];
        dst[di + 3] = 255;
      }
    }
  }

  fillRect(r, r8, g8, b8) {
    const x0 = Math.max(0, r.left), y0 = Math.max(0, r.top);
    const x1 = Math.min(this.width, r.right), y1 = Math.min(this.height, r.bottom);
    if (x1 <= x0 || y1 <= y0) return;
    const d = this.rgba;
    for (let y = y0; y < y1; y++) {
      let i = (y * this.width + x0) * 4;
      for (let x = x0; x < x1; x++, i += 4) {
        d[i] = r8; d[i + 1] = g8; d[i + 2] = b8; d[i + 3] = 255;
      }
    }
  }

  frameRect(r, r8, g8, b8) {
    const one = { left: r.left, top: r.top, right: r.right, bottom: r.top + 1 };
    this.fillRect(one, r8, g8, b8);
    this.fillRect({ ...r, top: r.bottom - 1 }, r8, g8, b8);
    this.fillRect({ ...r, right: r.left + 1 }, r8, g8, b8);
    this.fillRect({ ...r, left: r.right - 1 }, r8, g8, b8);
  }

  drawText(text, x, y, scale = 1) {
    // Minimal bitmap text for the rare UI leftovers; game text uses PICTs.
    const glyphs = Framebuffer.font;
    let cx = x;
    for (const ch of text) {
      const g = glyphs[ch] || glyphs['?'];
      for (let gy = 0; gy < 7; gy++) {
        for (let gx = 0; gx < 5; gx++) {
          if (g[gy] & (1 << (4 - gx))) {
            this.fillRect({ left: cx + gx * scale, top: y + gy * scale, right: cx + (gx + 1) * scale, bottom: y + (gy + 1) * scale }, 0, 0, 0);
          }
        }
      }
      cx += 6 * scale;
    }
  }
}

// A tiny 5x7 font, only used for debug/fallback UI.
Framebuffer.font = (() => {
  const f = {};
  const defs = {
    '?': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x00, 0x04],
    '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
    '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
    '2': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
    '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
    '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
    '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
    '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
    '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
    '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
    '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
    'A': [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
    'B': [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
    'C': [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
    'D': [0x1c, 0x12, 0x11, 0x11, 0x11, 0x12, 0x1c],
    'E': [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
    'F': [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
    'G': [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
    'H': [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
    'I': [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
    'J': [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
    'K': [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
    'L': [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
    'M': [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
    'N': [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
    'O': [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
    'P': [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
    'Q': [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
    'R': [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
    'S': [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
    'T': [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
    'U': [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
    'V': [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
    'W': [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0a],
    'X': [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
    'Y': [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
    'Z': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
    ' ': [0, 0, 0, 0, 0, 0, 0],
  };
  for (const [k, v] of Object.entries(defs)) f[k] = v;
  return f;
})();

// ---------------------------------------------------------------------------
// SAT sprite list and run loop.
// ---------------------------------------------------------------------------
export class SAT {
  constructor() {
    this.head = null;
    this.tail = null;
    this.imageSort = 2;      // g_2E08+0x60
    this.collisionSort = 0;  // g_2E08+0x62
    this.spriteRecSize = 170;
    this.background = null;
    this.fb = new Framebuffer();
    this.onKill = null;
    this.sound = null;
  }

  configure(imageSort, collisionSort) {
    this.imageSort = imageSort;
    this.collisionSort = collisionSort;
  }

  // SATNewSpriteAfter(NULL, kind, h, v, setup)
  newSprite(kind, h, v, setup, setupArg = undefined) {
    const sp = new Sprite(kind, h, v);
    // The original constructor calls the setup proc before linking when it is
    // supplied.  Callers in the game use the return value of SATNewSprite and
    // the setup proc captures that value, so link first and then run setup.
    // (The PPC code links before invoking the proc as well.)
    this.append(sp);
    if (setup) {
      // The setup proc is responsible for filling in the handler pointer at
      // sprite+0x1a; SAT itself does not store the setup proc.
      setup(sp, setupArg);
      // copy local rect to screen/dest rect, offset by h/v, as the original
      // SATNewSpriteAfter does after the setup proc.
      sp.screen.left = sp.local.left + sp.h;
      sp.screen.top = sp.local.top + sp.v;
      sp.screen.right = sp.local.right + sp.h;
      sp.screen.bottom = sp.local.bottom + sp.v;
      sp.destRect.left = sp.h;
      sp.destRect.top = sp.v;
      sp.destRect.right = sp.local.right + sp.h;
      sp.destRect.bottom = sp.local.bottom + sp.v;
    } else {
      sp.handle = this.defaultHandle;
    }
    sp.cachedPos = (sp.v << 16) | (sp.h & 0xffff);
    sp.cachedFace = sp.face;
    return sp;
  }

  // SAT's default handler is an empty proc; it keeps the sprite alive but the
  // game always supplies a real setup for visible sprites.
  defaultHandle() {}

  append(sp) {
    if (!this.head) {
      this.head = this.tail = sp;
      sp.prev = null;
      sp.next = null;
    } else {
      sp.prev = this.tail;
      sp.next = null;
      this.tail.next = sp;
      this.tail = sp;
    }
  }

  unlink(sp) {
    if (sp.prev) sp.prev.next = sp.next; else this.head = sp.next;
    if (sp.next) sp.next.prev = sp.prev; else this.tail = sp.prev;
    sp.prev = sp.next = null;
  }

  // Remove sprites whose handler was cleared, after a frame.
  reap() {
    let sp = this.head;
    while (sp) {
      const next = sp.next;
      if (sp.handle === null) {
        this.unlink(sp);
        if (this.onKill) this.onKill(sp);
      }
      sp = next;
    }
  }

  // SATLayerSort(lo, hi): stable-by-bucket but reverses order inside a bucket.
  layerSort(lo, hi) {
    const n = hi - lo + 1;
    if (n <= 0) return;
    const buckets = new Array(n).fill(null);
    let sp = this.head;
    while (sp) {
      const next = sp.next;
      sp.next = sp.prev = null;
      let b = sp.layer - lo;
      if (b < 0) b = 0;
      if (b >= n) b = n - 1;
      sp.next = buckets[b];
      if (buckets[b]) buckets[b].prev = sp;
      buckets[b] = sp;
      sp = next;
    }
    this.head = this.tail = null;
    for (let b = 0; b < n; b++) {
      let p = buckets[b];
      while (p) {
        const next = p.next;
        this.append(p);
        p = next;
      }
    }
  }

  // SATSortSprites: imageSort 2 means SATLayerSort already did the work.
  sortSprites() {
    if (this.imageSort === 2) return;
    // The game runs with imageSort=2; the other modes are not needed by the
    // port.  Keep the entry point for completeness.
  }

  // Collision mode 0 with imageSort 2: every positive-kind sprite against every
  // negative-kind sprite, both callbacks in order.  This is sub_18A78.
  collide() {
    for (let pos = this.head; pos; pos = pos.next) {
      if (!(pos.kind > 0)) continue;
      for (let neg = this.head; neg; neg = neg.next) {
        if (!(neg.kind < 0)) continue;
        if (!rectsOverlap(pos.screen, neg.screen)) continue;
        pos.kind = 10;
        neg.kind = -10;
        if (pos.hit) pos.hit(pos, neg);
        if (neg.hit) neg.hit(neg, pos);
      }
    }
  }

  // One game tick of SATRun.  `fast` only affects drawing in the original; we
  // always draw the whole scene deterministically.
  run(fast = false, render = true) {
    for (let sp = this.head; sp; sp = sp.next) {
      if (sp.handle) sp.handle(sp);
    }
    for (let sp = this.head; sp; sp = sp.next) {
      sp.screen.left = sp.local.left + sp.h;
      sp.screen.top = sp.local.top + sp.v;
      sp.screen.right = sp.local.right + sp.h;
      sp.screen.bottom = sp.local.bottom + sp.v;
    }
    this.sortSprites();
    this.collide();
    // The original marks a sprite dirty when position or face changed.  We
    // redraw everything, so preserve the dirty flags only for code that reads
    // them (none in the game).
    for (let sp = this.head; sp; sp = sp.next) {
      const pos = (sp.v << 16) | (sp.h & 0xffff);
      sp.dirty = pos !== sp.cachedPos || sp.face !== sp.cachedFace;
      sp.cachedPos = pos;
      sp.cachedFace = sp.face;
    }
    if (render) this.render();
    this.reap();
  }

  redraw() {
    this.render();
  }

  render() {
    const fb = this.fb;
    if (this.background) {
      fb.blitImage(this.background, 0, 0);
    } else {
      fb.clear(255, 255, 255);
    }
    for (let sp = this.head; sp; sp = sp.next) {
      if (!sp.handle || !sp.face) continue;
      fb.blitFace(sp.face, sp.h, sp.v);
    }
  }

  // SATGetFacePP is implemented by the asset layer; the game obtains faces
  // through these helpers in game.js.
}

// ---------------------------------------------------------------------------
// Utility for QuickDraw-style MaskRgn drawing of a sprite-free face (score
// cards, title cards).  The game draws these full-screen PICTs directly.
// ---------------------------------------------------------------------------

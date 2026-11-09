// Resource-fork reader and asset loader.
//
// The original MozPong 1.0.5 resource fork is shipped unchanged as
// assets/MozPong.rsrc.  This module implements the classic Mac resource map
// format, then layers the game-facing resource API on top of it.

import { Face } from './engine.js';

const ROMAN = (() => {
  // MacRoman high half.  Only the printable characters used by the game.
  const high = [
    'Ä', 'Å', 'Ç', 'É', 'Ñ', 'Ö', 'Ü', 'á', 'à', 'â', 'ä', 'ã', 'å', 'ç', 'é', 'è',
    'ê', 'ë', 'í', 'ì', 'î', 'ï', 'ñ', 'ó', 'ò', 'ô', 'ö', 'õ', 'ú', 'ù', 'û', 'ü',
    '†', '°', '¢', '£', '§', '•', '¶', 'ß', '®', '©', '™', '´', '¨', '≠', 'Æ', 'Ø',
    '∞', '±', '≤', '≥', '¥', 'µ', '∂', 'Σ', 'Π', 'π', '∫', 'ª', 'º', 'Ω', 'æ', 'ø',
    '¿', '¡', '¬', '√', 'ƒ', '≈', '∆', '«', '»', '…', ' ', 'À', 'Ã', 'Õ', 'Œ', 'œ',
    '–', '—', '“', '”', '‘', '’', '÷', '◊', 'ÿ', 'Ÿ', '⁄', '€', '‹', '›', 'ﬁ', 'ﬂ',
    '‡', '·', '‚', '„', '‰', 'Â', 'Ê', 'Á', 'Ë', 'È', 'Í', 'Î', 'Ï', 'Ì', 'Ó', 'Ô',
    '', 'Ò', 'Ú', 'Û', 'Ù', 'ı', 'ˆ', '˜', '¯', '˘', '˙', '˚', '¸', '˝', '˛', 'ˇ',
  ];
  return high;
})();

function decodeRoman(bytes) {
  let s = '';
  for (const b of bytes) {
    if (b < 0x80) s += String.fromCharCode(b);
    else s += ROMAN[b - 0x80] ?? '?';
  }
  return s;
}

function decodeJapanese(bytes) {
  try {
    return new TextDecoder('shift_jis').decode(bytes);
  } catch {
    return decodeRoman(bytes);
  }
}

export class ResourceFork {
  constructor(buffer) {
    this.buf = new Uint8Array(buffer);
    const dv = new DataView(buffer);
    const dataOff = dv.getUint32(0);
    const mapOff = dv.getUint32(4);
    const mapLen = dv.getUint32(12);
    this.dataOff = dataOff;
    this.mapOff = mapOff;
    this.map = new DataView(buffer, mapOff, mapLen);
    const typeList = this.map.getUint16(24);
    const nTypes = this.map.getUint16(typeList) + 1;
    this.types = new Map();
    for (let i = 0; i < nTypes; i++) {
      const off = typeList + 2 + i * 8;
      const type = String.fromCharCode(
        this.map.getUint8(off), this.map.getUint8(off + 1),
        this.map.getUint8(off + 2), this.map.getUint8(off + 3));
      const count = this.map.getUint16(off + 4) + 1;
      const refOff = this.map.getUint16(off + 6);
      const refs = new Map();
      const nameList = this.map.getUint16(26);
      for (let j = 0; j < count; j++) {
        const e = typeList + refOff + j * 12;
        const id = this.map.getInt16(e);
        const nameOff = this.map.getInt16(e + 2);
        const attrData = this.map.getUint32(e + 4);
        const dataOff2 = (attrData & 0xffffff) + dataOff;
        const len = dv.getUint32(dataOff2);
        let name = null;
        if (nameOff !== -1) {
          const no = this.mapOff + nameList + nameOff;
          const nlen = this.buf[no];
          name = decodeRoman(this.buf.subarray(no + 1, no + 1 + nlen));
        }
        refs.set(id, {
          id,
          name,
          attrs: (attrData >>> 24) & 0xff,
          data: this.buf.subarray(dataOff2 + 4, dataOff2 + 4 + len),
        });
      }
      this.types.set(type, refs);
    }
  }

  get(type, id) {
    return this.types.get(type)?.get(id)?.data ?? null;
  }

  getByName(type, name) {
    const refs = this.types.get(type);
    if (!refs) return null;
    for (const r of refs.values()) {
      if (r.name === name) return r.data;
    }
    return null;
  }

  idByName(type, name) {
    const refs = this.types.get(type);
    if (!refs) return null;
    for (const r of refs.values()) {
      if (r.name === name) return r.id;
    }
    return null;
  }

  nameOf(type, id) {
    return this.types.get(type)?.get(id)?.name ?? null;
  }

  readPString(off) {
    const len = this.buf[off];
    return decodeRoman(this.buf.subarray(off + 1, off + 1 + len));
  }

  // STR# resource: short count followed by Pascal strings.
  getStringList(id, japanese = false) {
    const data = this.get('STR#', id);
    if (!data) return [];
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const count = dv.getUint16(0);
    const out = [];
    let p = 2;
    for (let i = 0; i < count; i++) {
      const len = data[p++];
      const bytes = data.subarray(p, p + len);
      p += len;
      out.push(japanese ? decodeJapanese(bytes) : decodeRoman(bytes));
    }
    return out;
  }

  getIndString(listId, index, japanese = false) {
    return this.getStringList(listId, japanese)[index - 1] ?? '';
  }

  getString(id, japanese = false) {
    const data = this.get('STR ', id);
    if (!data) return '';
    const len = data[0];
    const bytes = data.subarray(1, 1 + len);
    return japanese ? decodeJapanese(bytes) : decodeRoman(bytes);
  }
}

// ---------------------------------------------------------------------------
// Image asset loader.  PNGs were produced from the original PICT/cicn bytes;
// they are decoded to RGBA ImageData once and kept as plain byte arrays so the
// renderer never depends on browser compositing.
// ---------------------------------------------------------------------------
// The original runs on a Mac 8-bit display.  The emulator/reference capture
// shows the palette through the classic Mac display gamma, which makes the
// PICT colours noticeably softer than the raw palette values.  Apply the
// recovered display curve to pictures/icons only; game text colours are
// already specified in the softened display space.
const DISPLAY_GAMMA = 0.6776;
const GAMMA_LUT = (() => {
  const t = new Uint8Array(256);
  for (let i = 0; i < 256; i++) t[i] = Math.round(255 * Math.pow(i / 255, DISPLAY_GAMMA));
  return t;
})();

async function loadImageData(url) {
  const img = new Image();
  img.src = url;
  await new Promise((resolve, reject) => {
    if (img.complete && img.naturalWidth) return resolve();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`failed to load ${url}`));
  });
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, c.width, c.height);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    d[i] = GAMMA_LUT[d[i]];
    d[i + 1] = GAMMA_LUT[d[i + 1]];
    d[i + 2] = GAMMA_LUT[d[i + 2]];
  }
  return { width: c.width, height: c.height, data: d };
}

export class Assets {
  constructor() {
    this.manifest = null;
    this.fork = null;
    this.pictures = new Map(); // PICT id -> ImageData-like
    this.icons = new Map();    // cicn id -> ImageData-like
    this.facesPP = new Map();  // "color:mask" -> Face
    this.facesCicn = new Map();
    this.sounds = new Map();   // id -> AudioBuffer (filled by audio.js)
    this.audioUrls = new Map();
    this.japanese = false;
  }

  async load() {
    const [manifest, rsrc] = await Promise.all([
      fetch('assets/manifest.json').then(r => r.json()),
      fetch('assets/MozPong.rsrc').then(r => r.arrayBuffer()),
    ]);
    this.manifest = manifest;
    this.fork = new ResourceFork(rsrc);
    for (const [id, url] of Object.entries(manifest.snd)) this.audioUrls.set(+id, url);
    return this;
  }

  async getPicture(id) {
    id = id | 0;
    if (this.pictures.has(id)) return this.pictures.get(id);
    const url = this.manifest.pict[String(id)];
    if (!url) throw new Error(`missing PICT ${id}`);
    const img = await loadImageData(url);
    this.pictures.set(id, img);
    return img;
  }

  async getIcon(id) {
    id = id | 0;
    if (this.icons.has(id)) return this.icons.get(id);
    const url = this.manifest.cicn[String(id)];
    if (!url) throw new Error(`missing cicn ${id}`);
    const img = await loadImageData(url);
    this.icons.set(id, img);
    return img;
  }

  // SATGetFacePP(colourPict, maskPict, bwPict)
  async getFacePP(colorId, _bwColorId = 0, bwId = 0) {
    const key = `${colorId}:${bwId}`;
    if (this.facesPP.has(key)) return this.facesPP.get(key);
    const [color, mask] = await Promise.all([
      this.getPicture(colorId),
      bwId ? this.getPicture(bwId) : null,
    ]);
    let face;
    if (mask && mask.width === color.width && mask.height === color.height) {
      face = Face.fromPICT(color, mask);
    } else {
      // No mask / mismatched mask: treat as fully opaque colour picture.
      face = new Face(color.width, color.height);
      face.rgba.set(color.data);
    }
    face.resourceId = colorId;
    this.facesPP.set(key, face);
    return face;
  }

  // SATGetFace(cicnID)
  async getFaceCicn(id) {
    id = id | 0;
    if (this.facesCicn.has(id)) return this.facesCicn.get(id);
    const icon = await this.getIcon(id);
    const face = Face.fromIcon(icon);
    face.id = id;
    this.facesCicn.set(id, face);
    return face;
  }

  async preloadAll(onProgress = null) {
    const ids = [
      ...Object.keys(this.manifest.pict).map(id => ['pict', +id]),
      ...Object.keys(this.manifest.cicn).map(id => ['cicn', +id]),
    ];
    let done = 0;
    const total = ids.length || 1;
    const jobs = ids.map(([kind, id]) => {
      const job = kind === 'pict' ? this.getPicture(id) : this.getIcon(id);
      return job.then(() => {
        done++;
        if (onProgress) onProgress(done, total);
      });
    });
    await Promise.all(jobs);
  }

  getPictureSync(id) {
    return this.pictures.get(id | 0) ?? null;
  }

  getFacePPSync(colorId, _bwColorId = 0, bwId = 0) {
    const key = `${colorId}:${bwId}`;
    if (this.facesPP.has(key)) return this.facesPP.get(key);
    const color = this.getPictureSync(colorId);
    const mask = bwId ? this.getPictureSync(bwId) : null;
    if (!color) return null;
    let face;
    if (mask && mask.width === color.width && mask.height === color.height) {
      face = Face.fromPICT(color, mask);
    } else {
      face = new Face(color.width, color.height);
      face.rgba.set(color.data);
    }
    face.resourceId = colorId;
    this.facesPP.set(key, face);
    return face;
  }

  getFaceCicnSync(id) {
    id |= 0;
    if (this.facesCicn.has(id)) return this.facesCicn.get(id);
    const icon = this.icons.get(id);
    if (!icon) return null;
    const face = Face.fromIcon(icon);
    face.id = id;
    this.facesCicn.set(id, face);
    return face;
  }

  // Preload a list of faces in parallel.
  async preloadFacesPP(list) {
    await Promise.all(list.map(([c, m, b]) => this.getFacePP(c, m, b)));
  }
}

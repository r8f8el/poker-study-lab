import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as zlib from 'zlib';
import { CardDetector } from '../../apps/desktop/src/vision/CardDetector';

function decodePNG(filePath: string) {
  const buf = fs.readFileSync(filePath);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  let pos = 8;
  const idatChunks: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    if (type === 'IDAT') idatChunks.push(buf.slice(pos + 8, pos + 8 + len));
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const bpp = 4;
  const stride = width * bpp;
  const pixels = new Uint8ClampedArray(width * height * 4);
  let rawPos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rawPos++];
    const lineStart = y * stride;
    for (let x = 0; x < stride; x++) {
      const cur = raw[rawPos++];
      let prior = x >= bpp ? pixels[lineStart + x - bpp] : 0;
      let above = y > 0 ? pixels[lineStart - stride + x] : 0;
      let abovePrior = (y > 0 && x >= bpp) ? pixels[lineStart - stride + x - bpp] : 0;
      let val = cur;
      if (filter === 1) val = (cur + prior) & 0xff;
      else if (filter === 2) val = (cur + above) & 0xff;
      else if (filter === 3) val = (cur + ((prior + above) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = prior + above - abovePrior;
        const pa = Math.abs(p - prior);
        const pb = Math.abs(p - above);
        const pc = Math.abs(p - abovePrior);
        let pr = (pa <= pb && pa <= pc) ? prior : (pb <= pc ? above : abovePrior);
        val = (cur + pr) & 0xff;
      }
      pixels[lineStart + x] = val;
    }
  }
  return { width, height, pixels };
}

function crop(img: { width: number; height: number; pixels: Uint8ClampedArray }, cx: number, cy: number, cw: number, ch: number) {
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const s = ((cy + y) * img.width + (cx + x)) * 4;
      const d = (y * cw + x) * 4;
      out[d] = img.pixels[s];
      out[d + 1] = img.pixels[s + 1];
      out[d + 2] = img.pixels[s + 2];
      out[d + 3] = img.pixels[s + 3];
    }
  }
  return out;
}

describe('PokerStars Live Image Validation', () => {
  const detector = new CardDetector(0.70);
  const imgPath = 'C:/Users/rafae/.gemini/antigravity-ide/brain/10d11b07-0727-46f5-acd9-c1e6a1ae9ecc/.user_uploaded/media_1790911047409.png';
  const img = decodePNG(imgPath);

  it('correctly detects all 4 community board cards from user PokerStars screenshot', () => {
    const boardCards = [
      { expected: '2h', x: 384, y: 182, w: 48, h: 68 },
      { expected: 'Qc', x: 434, y: 182, w: 48, h: 68 },
      { expected: '3d', x: 485, y: 182, w: 48, h: 68 },
      { expected: 'Kd', x: 536, y: 182, w: 48, h: 68 }
    ];

    for (const c of boardCards) {
      const px = crop(img, c.x, c.y, c.w, c.h);
      const res = detector.analyzeCrop(px, c.w, c.h);
      expect(res.visualState).toBe('VISIBLE_CARD');
      expect(res.card).toBe(c.expected);
    }
  });

  it('correctly detects both Hero hole cards from user PokerStars screenshot', () => {
    const heroCards = [
      { expected: 'Jc', x: 464, y: 343, w: 46, h: 32 }, // Bounded before player plate
      { expected: 'Tc', x: 512, y: 343, w: 46, h: 32 }
    ];

    for (const c of heroCards) {
      const px = crop(img, c.x, c.y, c.w, c.h);
      const res = detector.analyzeCrop(px, c.w, c.h);
      expect(res.visualState).toBe('VISIBLE_CARD');
      expect(res.card).toBe(c.expected);
    }
  });
});

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as zlib from 'zlib';
import * as path from 'path';
import { CardDetector } from '../../apps/desktop/src/vision/CardDetector';
import { RoiManager } from '../../apps/desktop/src/capture/RoiManager';
import { POKERSTARS_LAYOUT_PROFILE } from '../../packages/test-fixtures/src';

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
  const imgPath = path.resolve(__dirname, '../../packages/test-fixtures/assets/pokerstars_sample.png');
  const hasImage = fs.existsSync(imgPath);
  const img = hasImage ? decodePNG(imgPath) : { width: 0, height: 0, pixels: new Uint8ClampedArray() };

  it('correctly detects all 4 community board cards from user PokerStars screenshot', () => {
    if (!hasImage) {
      console.warn('PokerStars sample image not found, skipping visual assertion.');
      return;
    }
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
    if (!hasImage) {
      console.warn('PokerStars sample image not found, skipping visual assertion.');
      return;
    }
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

  it('reads the same cards through the PokerStars layout profile, including a 2px top pad on the 3d', () => {
    if (!hasImage) return;

    const regions = new RoiManager(POKERSTARS_LAYOUT_PROFILE).getComputedCardRegions(img.width, img.height);
    const expected: Record<string, string | null> = {
      board_flop_1: '2h',
      board_flop_2: 'Qc',
      board_flop_3: '3d',
      board_turn: 'Kd',
      board_river: null,
      hero_card_1: 'Jc',
      hero_card_2: 'Tc'
    };

    for (const [key, card] of Object.entries(expected)) {
      const region = regions[key as keyof typeof regions];
      const px = crop(img, region.x, region.y, region.width, region.height);
      const res = detector.analyzeCrop(px, region.width, region.height);
      if (card === null) {
        expect(res.card).toBeNull();
      } else {
        expect(res.card).toBe(card);
      }
    }

    // The previous card-top scan locked onto 2px of padding and called this 5h.
    const padded = crop(img, 485, 180, 48, 70);
    const paddedResult = detector.analyzeCrop(padded, 48, 70);
    expect(paddedResult.card).toBe('3d');
  });
});

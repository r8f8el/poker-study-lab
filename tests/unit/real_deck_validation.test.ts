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

function cropRegion(
  fullPixels: Uint8ClampedArray,
  fullWidth: number,
  cropX: number,
  cropY: number,
  cropW: number,
  cropH: number
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(cropW * cropH * 4);
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const srcIdx = ((cropY + y) * fullWidth + (cropX + x)) * 4;
      const dstIdx = (y * cropW + x) * 4;
      out[dstIdx] = fullPixels[srcIdx];
      out[dstIdx + 1] = fullPixels[srcIdx + 1];
      out[dstIdx + 2] = fullPixels[srcIdx + 2];
      out[dstIdx + 3] = fullPixels[srcIdx + 3];
    }
  }
  return out;
}

function extractNormalized8x12(crop: Uint8ClampedArray, cw: number, ch: number, minX: number, minY: number, gw: number, gh: number): number[] {
  const rows: number[] = [];
  for (let gy = 0; gy < 12; gy++) {
    let rowMask = 0;
    for (let gx = 0; gx < 8; gx++) {
      const srcX = Math.floor(minX + (gx / 8) * gw);
      const srcY = Math.floor(minY + (gy / 12) * gh);
      const idx = (srcY * cw + srcX) * 4;
      const r = crop[idx];
      const g = crop[idx + 1];
      const b = crop[idx + 2];
      const isInk = (r < 175 || g < 175 || b < 175) && !(r > 205 && g > 205 && b > 205);
      if (isInk) {
        rowMask |= (1 << (7 - gx));
      }
    }
    rows.push(rowMask);
  }
  return rows;
}

const realTemplates: Record<string, number[]> = {
  A: [
    0b00001110, 0b00001110, 0b00001110, 0b00011111,
    0b00011011, 0b00011011, 0b00011011, 0b00110001,
    0b00111111, 0b00111111, 0b01110001, 0b01100000
  ],
  K: [
    0b00110000, 0b00110001, 0b00110001, 0b00110011,
    0b00110111, 0b00111110, 0b00111111, 0b00111111,
    0b00111011, 0b00110001, 0b00110001, 0b00110000
  ],
  Q: [
    0b00001111, 0b00111111, 0b00111001, 0b01110000,
    0b01100000, 0b01100000, 0b01100000, 0b01100000,
    0b01110110, 0b00110011, 0b00111111, 0b00011111
  ],
  J: [
    0b00000001, 0b00000001, 0b00000001, 0b00000001,
    0b00000001, 0b00000001, 0b00000001, 0b00000001,
    0b00110001, 0b00110001, 0b00110011, 0b00111111
  ],
  T: [
    0b00010011, 0b00010111, 0b00110100, 0b00110100,
    0b01110100, 0b01011100, 0b00011100, 0b00011100,
    0b00011100, 0b00010100, 0b00010100, 0b00010111
  ],
  '8': [
    0b00011100, 0b00011100, 0b00111110, 0b00100110,
    0b00100110, 0b00111100, 0b00111110, 0b00111110,
    0b11100110, 0b11100110, 0b00111110, 0b00111100
  ],
  '5': [
    0b00111110, 0b00111110, 0b11111110, 0b11100000,
    0b11000000, 0b11111110, 0b11001110, 0b11001110,
    0b00001110, 0b11001110, 0b11111110, 0b11111100
  ]
};

function matchRank(grid: number[]): { rank: string; score: number } {
  let bestRank = '';
  let bestScore = -1;
  for (const [rKey, tpl] of Object.entries(realTemplates)) {
    let matches = 0, intersection = 0, union = 0;
    for (let r = 0; r < 12; r++) {
      const rowMask = tpl[r];
      for (let c = 0; c < 8; c++) {
        const expected = (rowMask >> (7 - c)) & 1;
        const actual = (grid[r] >> (7 - c)) & 1;
        if (expected === actual) matches++;
        if (expected === 1 && actual === 1) intersection++;
        if (expected === 1 || actual === 1) union++;
      }
    }
    const score = (matches / 96) * 0.6 + (union > 0 ? intersection / union : 0) * 0.4;
    if (score > bestScore) {
      bestScore = score;
      bestRank = rKey;
    }
  }
  return { rank: bestRank, score: bestScore };
}

describe('Real Deck Image Validation', () => {
  const detector = new CardDetector(0.70);
  const deckImagePath = 'C:/Users/rafae/.gemini/antigravity-ide/brain/10d11b07-0727-46f5-acd9-c1e6a1ae9ecc/.user_uploaded/media_1790904716760.png';

  it('tests the 5 real cards from user screenshot', () => {
    if (!fs.existsSync(deckImagePath)) return;
    const { width, height, pixels } = decodePNG(deckImagePath);

    // The 5 cards at the bottom are around y = 350, height = 62, width = 37
    const cardDefs = [
      { name: 'As', expected: 'As', x: 39, y: 350, w: 37, h: 62 },
      { name: 'Kh', expected: 'Kh', x: 79, y: 350, w: 37, h: 62 },
      { name: 'Qc', expected: 'Qc', x: 120, y: 350, w: 37, h: 62 },
      { name: 'Jd', expected: 'Jd', x: 161, y: 350, w: 37, h: 62 },
      { name: 'Ts', expected: 'Ts', x: 202, y: 350, w: 37, h: 62 }
    ];

    const glyphDefs = [
      { name: 'A', cropIdx: 0, minX: 3, minY: 5, gw: 8, gh: 13 },
      { name: 'K', cropIdx: 1, minX: 4, minY: 5, gw: 7, gh: 13 },
      { name: 'Q', cropIdx: 2, minX: 3, minY: 5, gw: 9, gh: 14 },
      { name: 'J', cropIdx: 3, minX: 4, minY: 5, gw: 7, gh: 13 },
      { name: 'T', cropIdx: 4, minX: 0, minY: 5, gw: 12, gh: 13 }
    ];

    for (const c of cardDefs) {
      const crop = cropRegion(pixels, width, c.x, c.y, c.w, c.h);
      const res = detector.analyzeCrop(crop, c.w, c.h);
      console.log(`Deck card ${c.name} -> detected: ${res.card}, state: ${res.visualState}, conf: ${res.confidence}`);
      expect(res.visualState).toBe('VISIBLE_CARD');
      expect(res.card).toBe(c.expected);
    }
  });

  const liveTablePath = 'C:/Users/rafae/.gemini/antigravity-ide/brain/10d11b07-0727-46f5-acd9-c1e6a1ae9ecc/.user_uploaded/media_1790905105217.png';

  it('tests the live table screenshot with Rafael cards 8c and 5s', () => {
    if (!fs.existsSync(liveTablePath)) return;
    const { width, height, pixels } = decodePNG(liveTablePath);
    console.log(`Live table dimensions: ${width}x${height}`);

    // In media_1790905105217.png:
    // Suprema Poker window is roughly x: 103..390, y: 0..540
    // Rafael avatar is near x: 240..270, y: 400..450
    // Cards are to the right of Rafael avatar, roughly x: 270..330, y: 400..450
    // Let's find white pixels near this area
    // Let's find exact bounds of the cards in this region
    let minCardX = 999, maxCardX = 0, minCardY = 999, maxCardY = 0;
    for (let y = 405; y < 460; y++) {
      for (let x = 265; x < 330; x++) {
        const idx = (y * width + x) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        if (r > 200 && g > 200 && b > 200) {
          if (x < minCardX) minCardX = x;
          if (x > maxCardX) maxCardX = x;
          if (y < minCardY) minCardY = y;
          if (y > maxCardY) maxCardY = y;
        }
      }
    }
    console.log(`Cards bounds: x: ${minCardX}..${maxCardX}, y: ${minCardY}..${maxCardY} (w: ${maxCardX - minCardX + 1}, h: ${maxCardY - minCardY + 1})`);

    // In this window:
    // Card 1: x: 276..298 (w: 22, h: 36)
    // Card 2: x: 295..317 (w: 22, h: 36)
    const card1Crop = cropRegion(pixels, width, 276, 417, 22, 36);
    const card2Crop = cropRegion(pixels, width, 295, 417, 22, 36);

    // Print ASCII grid of Card 1 and Card 2
    console.log('--- CARD 1 CROP (8c) ---');
    for (let y = 0; y < 16; y++) {
      let line = '';
      for (let x = 0; x < 22; x++) {
        const idx = (y * 22 + x) * 4;
        const r = card1Crop[idx];
        const g = card1Crop[idx + 1];
        const b = card1Crop[idx + 2];
        const isInk = (r < 175 || g < 175 || b < 175) && !(r > 205 && g > 205 && b > 205);
        line += isInk ? '#' : '.';
      }
      console.log(`${y.toString().padStart(2, '0')}: ${line}`);
    }


    const mask8 = extractNormalized8x12(card1Crop, 22, 36, 4, 3, 7, 10);
    const mask5 = extractNormalized8x12(card2Crop, 22, 36, 2, 3, 6, 10);

    console.log('--- TESTING ROI WHEN ENCLOSING ONLY THE CARDS (x: 275..318) ---');
    const hero1Clean = cropRegion(pixels, width, 275, 417, 22, 36);
    const hero2Clean = cropRegion(pixels, width, 296, 417, 22, 36);

    const resHero1Clean = detector.analyzeCrop(hero1Clean, 22, 36);
    console.log('CLEAN HERO 1:', resHero1Clean.card, resHero1Clean.visualState, resHero1Clean.confidence, JSON.stringify(resHero1Clean.debug));

    const resHero2Clean = detector.analyzeCrop(hero2Clean, 22, 36);
    console.log('CLEAN HERO 2:', resHero2Clean.card, resHero2Clean.visualState, resHero2Clean.confidence, JSON.stringify(resHero2Clean.debug));
    expect(resHero1Clean.card).toBe('8c');
    expect(resHero2Clean.card).toBe('5s');
  });
});

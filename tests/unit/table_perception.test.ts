import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as zlib from 'zlib';
import * as path from 'path';
import { paintDigitText } from '../../apps/desktop/src/vision/NumberOcr';
import { paintBadgeWord, perceiveTable } from '../../apps/desktop/src/vision/tablePerception';
import { resolveLiveCards } from '../../apps/desktop/src/vision/resolveLiveCards';

function feltScene(width: number, height: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 22;
    pixels[i + 1] = 92;
    pixels[i + 2] = 48;
    pixels[i + 3] = 255;
  }
  return pixels;
}

function fillCircle(
  pixels: Uint8ClampedArray,
  width: number,
  cx: number,
  cy: number,
  radius: number,
  color: [number, number, number]
): void {
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > radius ** 2) continue;
      const i = (y * width + x) * 4;
      pixels[i] = color[0];
      pixels[i + 1] = color[1];
      pixels[i + 2] = color[2];
      pixels[i + 3] = 255;
    }
  }
}

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
      const prior = x >= bpp ? pixels[lineStart + x - bpp] : 0;
      const above = y > 0 ? pixels[lineStart - stride + x] : 0;
      const abovePrior = y > 0 && x >= bpp ? pixels[lineStart - stride + x - bpp] : 0;
      let val = cur;
      if (filter === 1) val = (cur + prior) & 0xff;
      else if (filter === 2) val = (cur + above) & 0xff;
      else if (filter === 3) val = (cur + ((prior + above) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = prior + above - abovePrior;
        const pa = Math.abs(p - prior);
        const pb = Math.abs(p - above);
        const pc = Math.abs(p - abovePrior);
        const pr = pa <= pb && pa <= pc ? prior : pb <= pc ? above : abovePrior;
        val = (cur + pr) & 0xff;
      }
      pixels[lineStart + x] = val;
    }
  }
  return { width, height, pixels };
}

describe('table perception — find objects, then recognize', () => {
  it('reproduces the Suprema preflop capture contract without inventing cards or a 0.7 pot', () => {
    // Stand-in for electron_3536.png: the attached file was not present on disk.
    // The scene matches what that capture showed: preflop, hero avatar instead of
    // hole cards, central 48,00, side bets, and Fold/Raise/Call badges.
    const width = 360;
    const height = 640;
    const pixels = feltScene(width, height);
    fillCircle(pixels, width, 180, 540, 28, [214, 168, 130]);
    const gold: [number, number, number] = [220, 176, 40];
    paintDigitText(pixels, width, 130, 250, '48,00', gold, 2);
    paintDigitText(pixels, width, 24, 180, '32,00', gold, 2);
    paintDigitText(pixels, width, 24, 430, '8,00', gold, 2);
    paintDigitText(pixels, width, 300, 80, '0.7', gold, 2);
    paintBadgeWord(pixels, width, 150, 70, 'FOLD');
    paintBadgeWord(pixels, width, 30, 210, 'RAISE');
    paintBadgeWord(pixels, width, 250, 400, 'CALL');

    const result = perceiveTable(pixels, width, height);

    expect(result.heroCards).toEqual([]);
    expect(result.boardCards).toEqual([]);
    expect(result.potValue).not.toBe(0.7);
    expect(result.potValue).not.toBe(0);
    expect(result.potValue).toBe(48);
    expect(result.confidence).not.toBe(0.95);
    expect(result.confidence).toBeLessThanOrEqual(0.5);
    expect(result.heroButtons.isHeroTurn).toBe(false);
    const actions = result.badges.map(badge => badge.action).sort();
    expect(actions).toEqual(['call', 'fold', 'raise']);
  });

  it('reads the live Suprema flop window: 3d 9c Js, pot 90, hero Ad Td', () => {
    const imagePath = path.resolve(__dirname, '../../packages/test-fixtures/assets/suprema_live_flop.png');
    const { width, height, pixels } = decodePNG(imagePath);
    const result = perceiveTable(pixels, width, height);
    const reading = resolveLiveCards(result.heroOutputs, result.boardOutputs, undefined, 1);
    const detail = `hero=${result.heroCards.join(' ')} board=${result.boardCards.join(' ')} pot=${result.potValue} raw=${result.potRaw} street=${reading.street}`;
    expect(reading.street, detail).toBe('FLOP');
    expect(result.boardCards, detail).toEqual(['3d', '9c', 'Js']);
    expect(reading.boardCards, detail).toEqual(['3d', '9c', 'Js']);
    expect(result.heroCards, detail).toEqual(['Ad', 'Td']);
    expect(result.potValue, detail).toBe(90);
    expect(result.potValue).not.toBe(47);
    expect(result.heroButtons.isHeroTurn).toBe(false);
    expect(result.confidence).not.toBe(0.95);
  });

  it('does not publish a fake pot or a fake 0.95 on the saved Suprema desktop fixture', () => {
    const imagePath = path.resolve(__dirname, '../../packages/test-fixtures/assets/live_table_sample.png');
    const capturedPath = path.resolve(__dirname, '../../packages/test-fixtures/assets/electron_3536.png');
    const { width, height, pixels } = decodePNG(fs.existsSync(capturedPath) ? capturedPath : imagePath);
    const result = perceiveTable(pixels, width, height);
    if (!fs.existsSync(capturedPath)) {
      expect(result.heroCards).toEqual(['8c', '5s']);
      expect(result.boardCards).toEqual([]);
    }

    expect(result.potValue).not.toBe(0.7);
    expect(result.potValue).not.toBe(0);
    expect(result.confidence).not.toBe(0.95);
    if (result.heroCards.length === 0) {
      expect(result.boardCards.length).toBeLessThan(3);
    }
    if (!fs.existsSync(capturedPath) && result.heroCards.length === 2) {
      expect(result.heroCards).toEqual(['8c', '5s']);
    }
  });
});

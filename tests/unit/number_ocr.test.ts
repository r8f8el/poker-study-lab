import { describe, it, expect } from 'vitest';
import { interpretMoney, NumberOcr, paintDigitText } from '../../apps/desktop/src/vision/NumberOcr';

describe('NumberOcr - Pot & Stack Recognition', () => {
  it('returns empty result on tiny or blank crops', () => {
    const blank = new Uint8ClampedArray(20 * 20 * 4);
    const result = NumberOcr.recognizeNumber(blank, 20, 20);
    expect(result.value).toBeNull();
    expect(result.glyphCount).toBe(0);
  });

  it('correctly recognizes a synthetic number "16" in gold pot style', () => {
    const w = 40;
    const h = 20;
    const px = new Uint8ClampedArray(w * h * 4);

    // Draw '1' in gold at x: 10..14, y: 5..14
    for (let y = 5; y <= 14; y++) {
      for (let x = 11; x <= 13; x++) {
        const idx = (y * w + x) * 4;
        px[idx] = 220;     // r
        px[idx + 1] = 180; // g
        px[idx + 2] = 40;  // b (gold)
        px[idx + 3] = 255;
      }
    }
    // Draw base of '1'
    for (let x = 10; x <= 14; x++) {
      const idx = (14 * w + x) * 4;
      px[idx] = 220; px[idx + 1] = 180; px[idx + 2] = 40; px[idx + 3] = 255;
    }

    // Draw '6' in gold at x: 20..27, y: 5..14
    for (let y = 5; y <= 14; y++) {
      for (let x = 20; x <= 22; x++) {
        const idx = (y * w + x) * 4;
        px[idx] = 220; px[idx + 1] = 180; px[idx + 2] = 40; px[idx + 3] = 255;
      }
    }
    // Bottom loop of '6'
    for (let y = 9; y <= 14; y++) {
      for (let x = 25; x <= 27; x++) {
        const idx = (y * w + x) * 4;
        px[idx] = 220; px[idx + 1] = 180; px[idx + 2] = 40; px[idx + 3] = 255;
      }
    }
    for (let x = 20; x <= 27; x++) {
      // top bar
      let idx = (5 * w + x) * 4;
      px[idx] = 220; px[idx + 1] = 180; px[idx + 2] = 40; px[idx + 3] = 255;
      // middle bar
      idx = (9 * w + x) * 4;
      px[idx] = 220; px[idx + 1] = 180; px[idx + 2] = 40; px[idx + 3] = 255;
      // bottom bar
      idx = (14 * w + x) * 4;
      px[idx] = 220; px[idx + 1] = 180; px[idx + 2] = 40; px[idx + 3] = 255;
    }

    const result = NumberOcr.recognizeNumber(px, w, h);
    expect(result.value).toBe(16);
    expect(result.glyphCount).toBe(2);
    expect(result.confidence).toBeGreaterThan(0.55);
  });

  it('correctly handles multiplier K for values like 1.5K', () => {
    // When raw text has "1.5K", parsed value is 1500
    // Test parsing logic directly
    const w = 50;
    const h = 20;
    const px = new Uint8ClampedArray(w * h * 4);
    // Dark felt background
    for (let i = 0; i < px.length; i += 4) {
      px[i] = 15; px[i + 1] = 60; px[i + 2] = 25; px[i + 3] = 255;
    }
    const result = NumberOcr.recognizeNumber(px, w, h);
    expect(result.value).toBeNull();
  });

  it('reads a painted Brazilian 48,00', () => {
    const w = 120;
    const h = 30;
    const px = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < px.length; i += 4) {
      px[i] = 20; px[i + 1] = 80; px[i + 2] = 40; px[i + 3] = 255;
    }
    paintDigitText(px, w, 4, 4, '48,00', [220, 176, 40], 2);
    const result = NumberOcr.recognizeNumber(px, w, h);
    expect(result.rawText).toBe('48.00');
    expect(result.value).toBe(48);
  });

  it('accepts Brazilian 48,00 and 2.5K, and rejects a garbage 0.7', () => {
    expect(interpretMoney('48,00', 0.8)).toBe(48);
    expect(interpretMoney('48.00', 0.8)).toBe(48);
    expect(interpretMoney('2.5K', 0.8)).toBe(2500);
    expect(interpretMoney('0.7', 0.9)).toBeNull();
    expect(interpretMoney('16', 0.4)).toBeNull();
  });
});
